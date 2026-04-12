import type { KafkaConfig, SASLOptions } from 'kafkajs';

type KafkaSaslMechanism = 'plain' | 'scram-sha-256' | 'scram-sha-512';

const isTruthy = (value: string | undefined): boolean =>
  value === 'true' || value === '1' || value === 'yes';

export const createKafkaClientConfig = (clientId: string, brokers: string[]): KafkaConfig => {
  const mechanism = process.env.KAFKA_SASL_MECHANISM as KafkaSaslMechanism | undefined;
  const username = process.env.KAFKA_SASL_USERNAME;
  const password = process.env.KAFKA_SASL_PASSWORD;

  const config: KafkaConfig = {
    clientId,
    brokers,
  };

  if (isTruthy(process.env.KAFKA_SSL) || mechanism) {
    config.ssl = true;
  }

  if (mechanism && username && password) {
    config.sasl = {
      mechanism,
      username,
      password,
    } as SASLOptions;
  }

  return config;
};
