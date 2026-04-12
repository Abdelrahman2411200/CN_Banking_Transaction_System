import { Kafka, type Consumer, type EachMessagePayload } from 'kafkajs';
import { createKafkaClientConfig } from './config';

export abstract class KafkaConsumer {
  protected consumer: Consumer;
  protected groupId: string;

  constructor(clientId: string, groupId: string, brokers: string[]) {
    const kafka = new Kafka(createKafkaClientConfig(clientId, brokers));
    this.consumer = kafka.consumer({ groupId });
    this.groupId = groupId;
  }

  async connect() {
    await this.consumer.connect();
    console.log(`Kafka Consumer connected as group ${this.groupId}`);
  }

  async disconnect() {
    await this.consumer.disconnect();
  }

  async subscribe(topics: string[], fromBeginning: boolean = false) {
    await this.consumer.subscribe({ topics, fromBeginning });
  }

  abstract handleMessage(payload: EachMessagePayload): Promise<void>;

  async run() {
    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        try {
          await this.handleMessage(payload);
        } catch (error) {
          console.error('Error handling kafka message:', error);
          // Potential DLQ logic or retry strategy here in Month 4+
        }
      },
    });
  }
}
