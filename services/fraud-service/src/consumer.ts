import axios from 'axios';
import { Kafka, type Consumer, type Producer } from 'kafkajs';
import { Decimal128, MongoServerError, type Collection } from 'mongodb';
import { getDatabase } from './mongo';
import {
  evaluateLargeTransfer,
  evaluateRapidDrain,
  evaluateRoundNumber,
  evaluateVelocityCheck,
} from './rules';
import {
  KafkaTopics,
  TransferInitiatedEventSchema,
  buildBaseEvent,
  createKafkaClientConfig,
  createDeterministicUuid,
  parseEvent,
  serializeEvent,
} from '@cn-banking/shared-types';
import type { FraudAlertEvent, TransferInitiatedEvent } from '@cn-banking/shared-types';
import type { RuleResult } from './rules';

interface TransferActivityDocument {
  eventId: string;
  transferId: string;
  fromAccountId: string;
  amount: Decimal128;
  timestamp: Date;
}

export interface FraudEventDocument {
  alertId: string;
  sourceEventId: string;
  transferId: string;
  fromAccountId: string;
  amount: Decimal128;
  ruleTriggered: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
}

interface AccountBalanceResponse {
  data: {
    balance: string;
  };
}

const kafka = new Kafka(
  createKafkaClientConfig(`${process.env.KAFKA_CLIENT_ID || 'cn-banking-platform'}-fraud-service`)
);

const consumer: Consumer = kafka.consumer({
  groupId: `${process.env.KAFKA_GROUP_ID_PREFIX || 'cn-banking'}-fraud-service`,
});
const producer: Producer = kafka.producer();

const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:3001';

const getTransferActivityCollection = (): Collection<TransferActivityDocument> =>
  getDatabase().collection<TransferActivityDocument>('transfer_activity');

const getFraudEventsCollection = (): Collection<FraudEventDocument> =>
  getDatabase().collection<FraudEventDocument>('fraud_events');

const isDuplicateKeyError = (error: unknown): boolean =>
  error instanceof MongoServerError && error.code === 11000;

const freezeAccount = async (accountId: string): Promise<void> => {
  await axios.post(`${ACCOUNT_SERVICE_URL}/v1/accounts/${accountId}/freeze`);
};

const getAccountBalance = async (accountId: string): Promise<number> => {
  const response = await axios.get<AccountBalanceResponse>(
    `${ACCOUNT_SERVICE_URL}/v1/accounts/${accountId}/balance`
  );
  return Number(response.data.data.balance);
};

const persistActivity = async (event: TransferInitiatedEvent): Promise<boolean> => {
  try {
    await getTransferActivityCollection().insertOne({
      eventId: event.eventId,
      transferId: event.transferId,
      fromAccountId: event.fromAccountId,
      amount: Decimal128.fromString(event.amount),
      timestamp: new Date(event.timestamp),
    });
    return true;
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      return false;
    }

    throw error;
  }
};

const getRecentTransferCount = async (accountId: string, cutoff: Date): Promise<number> =>
  getTransferActivityCollection().countDocuments({
    fromAccountId: accountId,
    timestamp: { $gte: cutoff },
  });

const getRecentOutgoingTotal = async (accountId: string, cutoff: Date): Promise<number> => {
  const documents = await getTransferActivityCollection()
    .find({
      fromAccountId: accountId,
      timestamp: { $gte: cutoff },
    })
    .toArray();

  return documents.reduce((sum, document) => sum + Number(document.amount.toString()), 0);
};

const evaluateRules = async (event: TransferInitiatedEvent): Promise<RuleResult[]> => {
  const amount = Number(event.amount);
  const now = new Date(event.timestamp);
  const velocityCutoff = new Date(now.getTime() - (60 * 60 * 1000));
  const rapidDrainCutoff = new Date(now.getTime() - (10 * 60 * 1000));

  const [recentTransferCount, recentOutgoingTotal, balance] = await Promise.all([
    getRecentTransferCount(event.fromAccountId, velocityCutoff),
    getRecentOutgoingTotal(event.fromAccountId, rapidDrainCutoff),
    getAccountBalance(event.fromAccountId),
  ]);

  return [
    evaluateLargeTransfer(amount),
    evaluateVelocityCheck(recentTransferCount),
    evaluateRoundNumber(amount),
    evaluateRapidDrain(recentOutgoingTotal, balance),
  ].filter((result): result is RuleResult => result !== null);
};

const buildAlertEvent = (event: TransferInitiatedEvent, result: RuleResult): FraudAlertEvent => ({
  ...buildBaseEvent(KafkaTopics.fraudAlert),
  alertId: createDeterministicUuid(`${event.eventId}:${result.ruleTriggered}`),
  transferId: event.transferId,
  fromAccountId: event.fromAccountId,
  amount: event.amount,
  ruleTriggered: result.ruleTriggered,
  severity: result.severity,
});

const persistAndEmitAlert = async (
  sourceEvent: TransferInitiatedEvent,
  alertEvent: FraudAlertEvent
): Promise<void> => {
  try {
    await getFraudEventsCollection().insertOne({
      alertId: alertEvent.alertId,
      sourceEventId: sourceEvent.eventId,
      transferId: alertEvent.transferId,
      fromAccountId: alertEvent.fromAccountId,
      amount: Decimal128.fromString(alertEvent.amount),
      ruleTriggered: alertEvent.ruleTriggered,
      severity: alertEvent.severity,
      createdAt: new Date(alertEvent.timestamp),
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      return;
    }

    throw error;
  }

  await producer.send({
    topic: KafkaTopics.fraudAlert,
    messages: [{ key: alertEvent.alertId, value: serializeEvent(alertEvent) }],
  });

  if (alertEvent.severity === 'critical') {
    await freezeAccount(alertEvent.fromAccountId);
  }
};

export const ensureFraudIndexes = async (): Promise<void> => {
  await getTransferActivityCollection().createIndex({ eventId: 1 }, { unique: true });
  await getTransferActivityCollection().createIndex({ fromAccountId: 1, timestamp: -1 });
  await getFraudEventsCollection().createIndex({ alertId: 1 }, { unique: true });
  await getFraudEventsCollection().createIndex({ fromAccountId: 1, createdAt: -1 });
  await getFraudEventsCollection().createIndex({ severity: 1, createdAt: -1 });
};

export const processFraudEvent = async (payload: string): Promise<void> => {
  const event = parseEvent(payload, TransferInitiatedEventSchema);
  const wasInserted = await persistActivity(event);

  if (!wasInserted) {
    return;
  }

  const rules = await evaluateRules(event);
  for (const rule of rules) {
    const alertEvent = buildAlertEvent(event, rule);
    await persistAndEmitAlert(event, alertEvent);
  }
};

export const startFraudConsumer = async (): Promise<void> => {
  await ensureFraudIndexes();
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: KafkaTopics.transferInitiated, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = message.value?.toString();
      if (!payload) {
        return;
      }

      await processFraudEvent(payload);
    },
  });
};

export const stopFraudConsumer = async (): Promise<void> => {
  await consumer.disconnect();
  await producer.disconnect();
};
