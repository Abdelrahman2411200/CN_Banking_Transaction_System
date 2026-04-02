import axios from 'axios';
import { Kafka, type Consumer } from 'kafkajs';
import {
  FraudAlertEventSchema,
  KafkaTopics,
  TransferCompletedEventSchema,
  TransferFailedEventSchema,
  parseEvent,
} from '@cn-banking/shared-types';
import type { FraudAlertEvent, TransferCompletedEvent, TransferFailedEvent } from '@cn-banking/shared-types';
import { sendEmail, sendSms } from './adapters';

const kafka = new Kafka({
  clientId: `${process.env.KAFKA_CLIENT_ID || 'cn-banking-platform'}-notification-service`,
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean),
});

const consumer: Consumer = kafka.consumer({
  groupId: `${process.env.KAFKA_GROUP_ID_PREFIX || 'cn-banking'}-notification-service`,
});

const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:3001';

type NotificationPlanItem = {
  channel: 'email' | 'sms';
  recipient: string;
  notificationType: string;
};

interface AccountResponse {
  data: {
    email: string;
  };
}

const fetchAccountEmail = async (accountId: string): Promise<string> => {
  const response = await axios.get<AccountResponse>(
    `${ACCOUNT_SERVICE_URL}/v1/accounts/${accountId}`
  );
  return response.data.data.email;
};

const isTransferCompletedEvent = (
  event: TransferCompletedEvent | TransferFailedEvent | FraudAlertEvent
): event is TransferCompletedEvent => 'completedAt' in event;

const isTransferFailedEvent = (
  event: TransferCompletedEvent | TransferFailedEvent | FraudAlertEvent
): event is TransferFailedEvent => 'reason' in event;

export const buildNotificationPlan = async (
  event: TransferCompletedEvent | TransferFailedEvent | FraudAlertEvent
): Promise<NotificationPlanItem[]> => {
  if (isTransferCompletedEvent(event)) {
    const [senderEmail, receiverEmail] = await Promise.all([
      fetchAccountEmail(event.fromAccountId),
      fetchAccountEmail(event.toAccountId),
    ]);

    return [
      { channel: 'email', recipient: senderEmail, notificationType: event.eventType },
      { channel: 'email', recipient: receiverEmail, notificationType: event.eventType },
    ];
  }

  if (isTransferFailedEvent(event)) {
    const senderEmail = await fetchAccountEmail(event.fromAccountId);
    return [{ channel: 'email', recipient: senderEmail, notificationType: event.eventType }];
  }

  const accountEmail = await fetchAccountEmail(event.fromAccountId);
  const plan: NotificationPlanItem[] = [
    { channel: 'email', recipient: accountEmail, notificationType: event.eventType },
  ];

  if (event.severity === 'high' || event.severity === 'critical') {
    plan.push({
      channel: 'sms',
      recipient: `account:${event.fromAccountId}`,
      notificationType: event.eventType,
    });
  }

  return plan;
};

export const handleNotificationEvent = async (payload: string, topic: string): Promise<void> => {
  let event: TransferCompletedEvent | TransferFailedEvent | FraudAlertEvent;

  if (topic === KafkaTopics.transferCompleted) {
    event = parseEvent(payload, TransferCompletedEventSchema);
  } else if (topic === KafkaTopics.transferFailed) {
    event = parseEvent(payload, TransferFailedEventSchema);
  } else {
    event = parseEvent(payload, FraudAlertEventSchema);
  }

  const plan = await buildNotificationPlan(event);
  for (const attempt of plan) {
    if (attempt.channel === 'email') {
      await sendEmail(attempt.notificationType, attempt.recipient);
    } else {
      await sendSms(attempt.notificationType, attempt.recipient);
    }
  }
};

export const startNotificationConsumer = async (): Promise<void> => {
  await consumer.connect();
  await consumer.subscribe({ topic: KafkaTopics.transferCompleted, fromBeginning: false });
  await consumer.subscribe({ topic: KafkaTopics.transferFailed, fromBeginning: false });
  await consumer.subscribe({ topic: KafkaTopics.fraudAlert, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const payload = message.value?.toString();
      if (!payload) {
        return;
      }

      await handleNotificationEvent(payload, topic);
    },
  });
};

export const stopNotificationConsumer = async (): Promise<void> => {
  await consumer.disconnect();
};
