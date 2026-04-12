import { logger } from './logger';

export interface NotificationAttempt {
  notificationType: string;
  recipient: string;
  channel: 'email' | 'sms' | 'push';
  status: 'sent' | 'skipped' | 'failed';
  timestamp: string;
}

const logAttempt = (attempt: NotificationAttempt): void => {
  logger.info('notification sent', attempt);
};

export const sendEmail = (notificationType: string, recipient: string): Promise<void> => {
  logAttempt({
    notificationType,
    recipient,
    channel: 'email',
    status: 'sent',
    timestamp: new Date().toISOString(),
  });

  return Promise.resolve();
};

export const sendSms = (notificationType: string, recipient: string): Promise<void> => {
  logAttempt({
    notificationType,
    recipient,
    channel: 'sms',
    status: 'sent',
    timestamp: new Date().toISOString(),
  });

  return Promise.resolve();
};

export const sendPush = (notificationType: string, recipient: string): Promise<void> => {
  logAttempt({
    notificationType,
    recipient,
    channel: 'push',
    status: 'sent',
    timestamp: new Date().toISOString(),
  });

  return Promise.resolve();
};
