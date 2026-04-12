import axios from 'axios';
import { Kafka, type EachMessagePayload } from 'kafkajs';
import { Decimal128, type Collection, MongoServerError } from 'mongodb';
import { getDatabase } from './mongo';
import {
  KafkaTopics,
  TransferCompletedEventSchema,
  TransferFailedEventSchema,
  TransferStatus,
  createKafkaClientConfig,
  createLedgerEntryId,
  parseEvent,
} from '@cn-banking/shared-types';
import type {
  Transfer,
  TransferCompletedEvent,
  TransferFailedEvent,
} from '@cn-banking/shared-types';

export interface LedgerEntryDocument {
  entryId: string;
  transferId: string;
  accountId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: Decimal128;
  entryType: 'debit' | 'credit';
  status: 'completed' | 'failed' | 'reversed';
  sourceEvent: string;
  createdAt: Date;
}

interface TransferResponse {
  data: Transfer;
}

const kafka = new Kafka(
  createKafkaClientConfig(`${process.env.KAFKA_CLIENT_ID || 'cn-banking-platform'}-ledger-service`)
);

const consumer = kafka.consumer({
  groupId: `${process.env.KAFKA_GROUP_ID_PREFIX || 'cn-banking'}-ledger-service`,
});

const TRANSFER_SERVICE_URL = process.env.TRANSFER_SERVICE_URL || 'http://localhost:3002';

const getLedgerCollection = (): Collection<LedgerEntryDocument> =>
  getDatabase().collection<LedgerEntryDocument>('ledger_entries');

const isDuplicateKeyError = (error: unknown): boolean =>
  error instanceof MongoServerError && error.code === 11000;

const buildEntries = (
  event: TransferCompletedEvent | TransferFailedEvent,
  topic: string,
  partition: number,
  offset: string,
  status: 'completed' | 'failed' | 'reversed',
  createdAt: Date
): LedgerEntryDocument[] => [
  {
    entryId: createLedgerEntryId(topic, partition, offset, 'debit'),
    transferId: event.transferId,
    accountId: event.fromAccountId,
    fromAccountId: event.fromAccountId,
    toAccountId: event.toAccountId,
    amount: Decimal128.fromString(event.amount),
    entryType: 'debit',
    status,
    sourceEvent: event.eventType,
    createdAt,
  },
  {
    entryId: createLedgerEntryId(topic, partition, offset, 'credit'),
    transferId: event.transferId,
    accountId: event.toAccountId,
    fromAccountId: event.fromAccountId,
    toAccountId: event.toAccountId,
    amount: Decimal128.fromString(event.amount),
    entryType: 'credit',
    status,
    sourceEvent: event.eventType,
    createdAt,
  },
];

const upsertEntries = async (entries: LedgerEntryDocument[]): Promise<void> => {
  const collection = getLedgerCollection();

  await Promise.all(
    entries.map(async (entry) => {
      try {
        await collection.updateOne(
          { entryId: entry.entryId },
          { $setOnInsert: entry },
          { upsert: true }
        );
      } catch (error: unknown) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }
    })
  );
};

const fetchTransfer = async (transferId: string): Promise<Transfer | null> => {
  try {
    const response = await axios.get<TransferResponse>(
      `${TRANSFER_SERVICE_URL}/v1/transfers/${transferId}`
    );
    return response.data.data;
  } catch {
    return null;
  }
};

export const ensureLedgerIndexes = async (): Promise<void> => {
  const collection = getLedgerCollection();
  await collection.createIndex({ entryId: 1 }, { unique: true });
  await collection.createIndex({ accountId: 1, createdAt: -1 });
  await collection.createIndex({ transferId: 1, createdAt: -1 });
};

export const processLedgerEvent = async ({ topic, partition, message }: EachMessagePayload): Promise<void> => {
  const payload = message.value?.toString();
  if (!payload) {
    return;
  }

  if (topic === KafkaTopics.transferCompleted) {
    const event = parseEvent(payload, TransferCompletedEventSchema);
    const entries = buildEntries(
      event,
      topic,
      partition,
      message.offset,
      'completed',
      new Date(event.completedAt)
    );
    await upsertEntries(entries);
    return;
  }

  if (topic === KafkaTopics.transferFailed) {
    const event = parseEvent(payload, TransferFailedEventSchema);
    const transfer = await fetchTransfer(event.transferId);

    if (!transfer?.saga_state.debit_completed) {
      return;
    }

    const status = transfer.status === TransferStatus.COMPENSATION_FAILED ? 'failed' : 'reversed';
    const entries = buildEntries(
      event,
      topic,
      partition,
      message.offset,
      status,
      new Date(event.timestamp)
    );
    await upsertEntries(entries);
  }
};

export const startLedgerConsumer = async (): Promise<void> => {
  await ensureLedgerIndexes();
  await consumer.connect();
  await consumer.subscribe({ topic: KafkaTopics.transferCompleted, fromBeginning: false });
  await consumer.subscribe({ topic: KafkaTopics.transferFailed, fromBeginning: false });
  await consumer.run({
    eachMessage: async (payload) => {
      await processLedgerEvent(payload);
    },
  });
};

export const stopLedgerConsumer = async (): Promise<void> => {
  await consumer.disconnect();
};
