import { KafkaConsumer } from '@cn-banking/shared-kafka';
import { EachMessagePayload } from 'kafkajs';
import { EVENT_TYPES } from '@cn-banking/shared-types';

export class NotificationConsumer extends KafkaConsumer {
  constructor(brokers: string[]) {
    super('notification-service', 'notification-group', brokers);
  }

  async handleMessage({ topic, message }: EachMessagePayload): Promise<void> {
    const value = message.value?.toString();
    if (!value) return;

    const event = JSON.parse(value);
    console.log(`[NOTIFICATION] Received event on topic ${topic}`);

    switch (topic) {
      case EVENT_TYPES.ACCOUNT_CREATED:
        console.log(`>>> EMAIL sent to ${event.email}: Welcome ${event.name}! Your account ${event.accountId} is open with balance ${event.initialBalance}.`);
        break;
      case EVENT_TYPES.TRANSFER_INITIATED:
        console.log(`>>> SMS sent: Transfer of ${event.amount} from ${event.fromAccountId} to ${event.toAccountId} initiated.`);
        break;
      case EVENT_TYPES.TRANSFER_COMPLETED:
        console.log(`>>> EMAIL sent: Your transfer of ${event.amount} (ID: ${event.transferId}) has completed successfully.`);
        break;
      case EVENT_TYPES.TRANSFER_FAILED:
        console.log(`>>> ALERT EMAIL sent: Your transfer (ID: ${event.transferId}) failed. Reason: ${event.reason}.`);
        break;
      case EVENT_TYPES.FRAUD_ALERT:
        console.log(`!!! SECURITY ALERT sent: Suspicious activity detected on transfer ${event.transferId}. Severity: ${event.severity}.`);
        break;
      default:
        console.log(`Unhandled event type: ${topic}`);
    }
  }
}
