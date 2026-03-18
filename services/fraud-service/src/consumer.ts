import { KafkaConsumer, KafkaProducer } from '@cn-banking/shared-kafka';
import { EachMessagePayload } from 'kafkajs';
import { EVENT_TYPES } from '@cn-banking/shared-types';

export class FraudConsumer extends KafkaConsumer {
  private producer: KafkaProducer;

  constructor(brokers: string[], producer: KafkaProducer) {
    super('fraud-service', 'fraud-group', brokers);
    this.producer = producer;
  }

  async handleMessage({ topic, message }: EachMessagePayload): Promise<void> {
    const value = message.value?.toString();
    if (!value) return;

    const event = JSON.parse(value);
    console.log(`Fraud Service analyzing transfer: ${event.transferId}`);

    // Simple rule: transfers > $10,000 are flagged as suspicious
    if (event.amount > 10000) {
      console.warn(`Suspicious transfer detected: ${event.transferId} (Amount: ${event.amount})`);
      
      try {
        await this.producer.emit(EVENT_TYPES.FRAUD_ALERT, event.transferId, {
          transferId: event.transferId,
          reason: 'HIGH_AMOUNT',
          severity: 'HIGH',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to emit fraud alert:', error);
      }
    }
  }
}
