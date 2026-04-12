import { KafkaProducer } from '@cn-banking/shared-kafka';
import { getKafkaBrokers } from '@cn-banking/shared-types';

const clientId = 'account-service';
const brokers = getKafkaBrokers();

export const producer = new KafkaProducer(clientId, brokers);

export async function initKafka() {
  try {
    await producer.connect();
    console.log('Account Service Kafka Producer initialized');
  } catch (error) {
    console.error('Failed to initialize Account Service Kafka Producer:', error);
    // In production, we might want to retry or exit
  }
}
