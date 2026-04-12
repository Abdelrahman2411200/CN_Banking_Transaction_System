import { KafkaProducer } from '@cn-banking/shared-kafka';
import { getKafkaBrokers } from '@cn-banking/shared-types';
import { logger } from './logger';

const clientId = 'account-service';
const brokers = getKafkaBrokers();

export const producer = new KafkaProducer(clientId, brokers);

export async function initKafka() {
  try {
    await producer.connect();
    logger.info('account-service Kafka producer initialized');
  } catch (error) {
    logger.error('failed to initialize account-service Kafka producer', {
      error: error instanceof Error ? error.message : String(error),
    });
    // In production, we might want to retry or exit
  }
}
