import { createOutboxPublisher, enqueueOutboxEvent } from '@cn-banking/shared-types';

export { enqueueOutboxEvent };

export const {
  publishPendingOutboxEvents,
  startOutboxPublisher,
  stopOutboxPublisher,
} = createOutboxPublisher('transfer-service');
