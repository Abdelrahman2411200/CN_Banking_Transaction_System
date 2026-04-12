import { KafkaProducer } from '@cn-banking/shared-kafka';
import { getKafkaBrokers } from '@cn-banking/shared-types';

const clientId = 'transfer-service';
const brokers = getKafkaBrokers();

export const producer = new KafkaProducer(clientId, brokers);

export async function initKafka() {
  try {
    await producer.connect();
    console.log('Transfer Service Kafka Producer initialized');
  } catch (error) {
    console.error('Failed to initialize Transfer Service Kafka Producer:', error);
  }
}
