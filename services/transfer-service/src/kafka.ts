import { KafkaProducer } from '@cn-banking/shared-kafka';
import { getKafkaBrokers } from '@cn-banking/shared-types';
import { logger } from './logger';

const clientId = 'transfer-service';
const brokers = getKafkaBrokers();

export const producer = new KafkaProducer(clientId, brokers);

export async function initKafka() {
  try {
    await producer.connect();
    logger.info('transfer-service Kafka producer initialized');
  } catch (error) {
    logger.error('failed to initialize transfer-service Kafka producer', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
