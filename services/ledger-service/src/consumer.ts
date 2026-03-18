import { KafkaConsumer } from '@cn-banking/shared-kafka';
import { EachMessagePayload } from 'kafkajs';
import { EVENT_TYPES } from '@cn-banking/shared-types';
import { getCollection } from './db';

export class LedgerConsumer extends KafkaConsumer {
  constructor(brokers: string[]) {
    super('ledger-service', 'ledger-group', brokers);
  }

  async handleMessage({ topic, partition, message }: EachMessagePayload): Promise<void> {
    const value = message.value?.toString();
    if (!value) return;

    const event = JSON.parse(value);
    console.log(`Ledger Service received event: ${topic}`);

    const ledgerCollection = getCollection('ledger');

    // Idempotency: Use topic + partition + offset as a unique metadata key
    const metadata = {
      kafka_topic: topic,
      kafka_partition: partition,
      kafka_offset: message.offset,
    };

    try {
      if (topic === EVENT_TYPES.ACCOUNT_CREATED) {
        await ledgerCollection.insertOne({
          type: 'ACCOUNT_OPENING',
          accountId: event.accountId,
          amount: event.initialBalance,
          timestamp: event.timestamp || new Date().toISOString(),
          metadata,
        });
      } else if (topic === EVENT_TYPES.TRANSFER_COMPLETED) {
        // Dual-entry: record both debit and credit
        await ledgerCollection.insertMany([
          {
            type: 'TRANSFER_DEBIT',
            accountId: event.fromAccountId,
            amount: -event.amount,
            transferId: event.transferId,
            timestamp: event.timestamp || new Date().toISOString(),
            metadata: { ...metadata, entry: 'debit' },
          },
          {
            type: 'TRANSFER_CREDIT',
            accountId: event.toAccountId,
            amount: event.amount,
            transferId: event.transferId,
            timestamp: event.timestamp || new Date().toISOString(),
            metadata: { ...metadata, entry: 'credit' },
          },
        ]);
      }
    } catch (error: any) {
      if (error.code === 11000) {
        console.warn('Duplicate event received, skipping for idempotency:', metadata);
      } else {
        throw error;
      }
    }
  }
}
