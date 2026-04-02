import axios from 'axios';
import { buildNotificationPlan } from '../consumer';
import { KafkaTopics } from '@cn-banking/shared-types';
import type { FraudAlertEvent, TransferCompletedEvent, TransferFailedEvent } from '@cn-banking/shared-types';

jest.mock('axios');

describe('notification planning', () => {
  const mockAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends two emails for completed transfers', async () => {
    const event: TransferCompletedEvent = {
      eventId: '123e4567-e89b-12d3-a456-426614174000',
      eventType: KafkaTopics.transferCompleted,
      timestamp: '2025-01-01T00:00:00.000Z',
      version: 'v1',
      transferId: '123e4567-e89b-12d3-a456-426614174001',
      fromAccountId: '123e4567-e89b-12d3-a456-426614174002',
      toAccountId: '123e4567-e89b-12d3-a456-426614174003',
      amount: '100.00',
      completedAt: '2025-01-01T00:00:01.000Z',
    };

    mockAxios.get
      .mockResolvedValueOnce({ data: { data: { email: 'sender@example.com' } } })
      .mockResolvedValueOnce({ data: { data: { email: 'receiver@example.com' } } });

    const plan = await buildNotificationPlan(event);

    expect(plan).toEqual([
      {
        channel: 'email',
        recipient: 'sender@example.com',
        notificationType: KafkaTopics.transferCompleted,
      },
      {
        channel: 'email',
        recipient: 'receiver@example.com',
        notificationType: KafkaTopics.transferCompleted,
      },
    ]);
  });

  it('sends one email for failed transfers', async () => {
    const event: TransferFailedEvent = {
      eventId: '123e4567-e89b-12d3-a456-426614174004',
      eventType: KafkaTopics.transferFailed,
      timestamp: '2025-01-01T00:00:00.000Z',
      version: 'v1',
      transferId: '123e4567-e89b-12d3-a456-426614174005',
      fromAccountId: '123e4567-e89b-12d3-a456-426614174006',
      toAccountId: '123e4567-e89b-12d3-a456-426614174007',
      amount: '100.00',
      reason: 'Insufficient funds',
    };

    mockAxios.get.mockResolvedValue({ data: { data: { email: 'sender@example.com' } } });

    const plan = await buildNotificationPlan(event);

    expect(plan).toEqual([
      {
        channel: 'email',
        recipient: 'sender@example.com',
        notificationType: KafkaTopics.transferFailed,
      },
    ]);
  });

  it('uses email only for low severity fraud alerts', async () => {
    const event: FraudAlertEvent = {
      eventId: '123e4567-e89b-12d3-a456-426614174010',
      eventType: KafkaTopics.fraudAlert,
      timestamp: '2025-01-01T00:00:00.000Z',
      version: 'v1',
      alertId: '123e4567-e89b-12d3-a456-426614174011',
      transferId: '123e4567-e89b-12d3-a456-426614174012',
      fromAccountId: '123e4567-e89b-12d3-a456-426614174013',
      amount: '5000.00',
      ruleTriggered: 'round_number',
      severity: 'low',
    };

    mockAxios.get.mockResolvedValue({ data: { data: { email: 'user@example.com' } } });

    const plan = await buildNotificationPlan(event);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toEqual({
      channel: 'email',
      recipient: 'user@example.com',
      notificationType: KafkaTopics.fraudAlert,
    });
  });

  it('uses email and sms for high severity fraud alerts', async () => {
    const event: FraudAlertEvent = {
      eventId: '123e4567-e89b-12d3-a456-426614174020',
      eventType: KafkaTopics.fraudAlert,
      timestamp: '2025-01-01T00:00:00.000Z',
      version: 'v1',
      alertId: '123e4567-e89b-12d3-a456-426614174021',
      transferId: '123e4567-e89b-12d3-a456-426614174022',
      fromAccountId: '123e4567-e89b-12d3-a456-426614174023',
      amount: '15000.00',
      ruleTriggered: 'large_transfer',
      severity: 'high',
    };

    mockAxios.get.mockResolvedValue({ data: { data: { email: 'user@example.com' } } });

    const plan = await buildNotificationPlan(event);

    expect(plan).toEqual([
      {
        channel: 'email',
        recipient: 'user@example.com',
        notificationType: KafkaTopics.fraudAlert,
      },
      {
        channel: 'sms',
        recipient: 'account:123e4567-e89b-12d3-a456-426614174023',
        notificationType: KafkaTopics.fraudAlert,
      },
    ]);
  });
});
