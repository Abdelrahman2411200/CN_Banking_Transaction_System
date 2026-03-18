import { KafkaProducer } from '@cn-banking/shared-kafka';

const clientId = 'account-service';
const brokers = [process.env.KAFKA_BROKERS || 'localhost:9092'];

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
