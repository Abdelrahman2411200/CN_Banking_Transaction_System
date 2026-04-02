import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

export const EVENT_VERSION = 'v1' as const;

export const KafkaTopics = {
  accountCreated: 'bank.account.created',
  transferInitiated: 'bank.transfer.initiated',
  transferCompleted: 'bank.transfer.completed',
  transferFailed: 'bank.transfer.failed',
  fraudAlert: 'bank.fraud.alert',
} as const;

export type KafkaTopic = (typeof KafkaTopics)[keyof typeof KafkaTopics];

export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  version: string;
}

export interface AccountCreatedEvent extends BaseEvent {
  accountId: string;
  ownerName: string;
  email: string;
  initialDeposit: string;
}

export interface TransferInitiatedEvent extends BaseEvent {
  transferId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
}

export interface TransferCompletedEvent extends BaseEvent {
  transferId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  completedAt: string;
}

export interface TransferFailedEvent extends BaseEvent {
  transferId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  reason: string;
}

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FraudAlertEvent extends BaseEvent {
  alertId: string;
  transferId: string;
  fromAccountId: string;
  amount: string;
  ruleTriggered: string;
  severity: FraudSeverity;
}

const baseEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1),
  timestamp: z.string().datetime(),
  version: z.literal(EVENT_VERSION),
});

export const AccountCreatedEventSchema = baseEventSchema.extend({
  accountId: z.string().uuid(),
  ownerName: z.string().min(1),
  email: z.string().email(),
  initialDeposit: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const TransferInitiatedEventSchema = baseEventSchema.extend({
  transferId: z.string().uuid(),
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const TransferCompletedEventSchema = baseEventSchema.extend({
  transferId: z.string().uuid(),
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  completedAt: z.string().datetime(),
});

export const TransferFailedEventSchema = baseEventSchema.extend({
  transferId: z.string().uuid(),
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  reason: z.string().min(1),
});

export const FraudAlertEventSchema = baseEventSchema.extend({
  alertId: z.string().uuid(),
  transferId: z.string().uuid(),
  fromAccountId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  ruleTriggered: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

export type SupportedEvent =
  | AccountCreatedEvent
  | TransferInitiatedEvent
  | TransferCompletedEvent
  | TransferFailedEvent
  | FraudAlertEvent;

export const buildBaseEvent = (eventType: string): BaseEvent => ({
  eventId: randomUUID(),
  eventType,
  timestamp: new Date().toISOString(),
  version: EVENT_VERSION,
});

export const serializeEvent = (event: SupportedEvent): string => JSON.stringify(event);

export const parseEvent = <T>(payload: string, schema: z.ZodSchema<T>): T =>
  schema.parse(JSON.parse(payload) as unknown);

export const createDeterministicUuid = (input: string): string => {
  const hash = createHash('sha1').update(input).digest('hex');
  const bytes = hash.slice(0, 32).split('');

  bytes[12] = '5';
  bytes[16] = ((parseInt(bytes[16] || '0', 16) & 0x3) | 0x8).toString(16);

  return [
    bytes.slice(0, 8).join(''),
    bytes.slice(8, 12).join(''),
    bytes.slice(12, 16).join(''),
    bytes.slice(16, 20).join(''),
    bytes.slice(20, 32).join(''),
  ].join('-');
};

export const createLedgerEntryId = (
  topic: string,
  partition: number,
  offset: string,
  entryType: string
): string => createDeterministicUuid(`${topic}:${partition}:${offset}:${entryType}`);
