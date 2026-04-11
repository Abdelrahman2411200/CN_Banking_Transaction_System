import { Kafka, type Producer, type ProducerRecord } from 'kafkajs';

export class KafkaProducer {
  private producer: Producer;

  constructor(clientId: string, brokers: string[]) {
    const kafka = new Kafka({
      clientId,
      brokers,
    });
    this.producer = kafka.producer();
  }

  async connect() {
    await this.producer.connect();
    console.log('Kafka Producer connected');
  }

  async disconnect() {
    await this.producer.disconnect();
  }

  async send(record: ProducerRecord) {
    return this.producer.send(record);
  }

  async emit(topic: string, key: string, data: unknown) {
    return this.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(data),
          timestamp: new Date().getTime().toString(),
        },
      ],
    });
  }
}
