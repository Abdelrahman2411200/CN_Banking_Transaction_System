import { KafkaProducer } from '@cn-banking/shared-kafka';

const clientId = 'transfer-service';
const brokers = [process.env.KAFKA_BROKERS || 'localhost:9092'];

export const producer = new KafkaProducer(clientId, brokers);

export async function initKafka() {
  try {
    await producer.connect();
    console.log('Transfer Service Kafka Producer initialized');
  } catch (error) {
    console.error('Failed to initialize Transfer Service Kafka Producer:', error);
  }
}
