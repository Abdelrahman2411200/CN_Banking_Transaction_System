import { Kafka, type Producer } from 'kafkajs';
import type { Pool, PoolClient } from 'pg';
import { createKafkaClientConfig } from './kafka-config';
import { serializeEvent } from './events';
import type { SupportedEvent } from './events';

interface OutboxRow {
  id: string;
  topic: string;
  event_key: string;
  payload: SupportedEvent;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const enqueueOutboxEvent = async (
  client: PoolClient,
  topic: string,
  eventKey: string,
  payload: SupportedEvent
): Promise<void> => {
  await client.query(
    `
      INSERT INTO outbox_events (event_type, topic, event_key, payload)
      VALUES ($1, $2, $3, $4::jsonb)
    `,
    [payload.eventType, topic, eventKey, serializeEvent(payload)]
  );
};

export const createOutboxPublisher = (clientIdSuffix: string) => {
  const kafka = new Kafka(
    createKafkaClientConfig(`${process.env.KAFKA_CLIENT_ID || 'cn-banking-platform'}-${clientIdSuffix}`)
  );

  const producer: Producer = kafka.producer();

  let producerConnected = false;
  let publishTimer: NodeJS.Timeout | null = null;
  let publishing = false;

  const ensureProducer = async (): Promise<void> => {
    if (!producerConnected) {
      await producer.connect();
      producerConnected = true;
    }
  };

  const publishPendingOutboxEvents = async (db: Pool): Promise<void> => {
    if (publishing) {
      return;
    }

    publishing = true;

    try {
      await ensureProducer();

      const result = await db.query<OutboxRow>(
        `
          SELECT id, topic, event_key, payload
          FROM outbox_events
          WHERE published_at IS NULL
          ORDER BY created_at ASC
          LIMIT 20
        `
      );

      for (const row of result.rows) {
        try {
          // Outbox publishing is intentionally at-least-once: if the process dies
          // after Kafka accepts the event but before this row is marked published,
          // the row will be retried and downstream idempotent consumers absorb it.
          await producer.send({
            topic: row.topic,
            messages: [
              {
                key: row.event_key,
                value: serializeEvent(row.payload),
              },
            ],
          });

          await db.query(
            `
              UPDATE outbox_events
              SET published_at = NOW(), last_error = NULL
              WHERE id = $1
            `,
            [row.id]
          );
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error);

          await db.query(
            `
              UPDATE outbox_events
              SET last_error = $1
              WHERE id = $2
            `,
            [errorMessage, row.id]
          );

          console.error(`Failed to publish ${clientIdSuffix} outbox row ${row.id}`, error);
        }
      }
    } catch (error: unknown) {
      console.error(`Failed to load ${clientIdSuffix} outbox events`, error);
    } finally {
      publishing = false;
    }
  };

  const startOutboxPublisher = async (db: Pool): Promise<void> => {
    await ensureProducer();
    await publishPendingOutboxEvents(db);

    // Fixed polling keeps Phase 2 simple. If outbox traffic grows, replace this
    // with adaptive backoff or database notifications.
    publishTimer = setInterval(() => {
      void publishPendingOutboxEvents(db);
    }, 1000);
  };

  const stopOutboxPublisher = async (): Promise<void> => {
    if (publishTimer) {
      clearInterval(publishTimer);
      publishTimer = null;
    }

    if (producerConnected) {
      await producer.disconnect();
      producerConnected = false;
    }
  };

  return {
    enqueueOutboxEvent,
    publishPendingOutboxEvents,
    startOutboxPublisher,
    stopOutboxPublisher,
  };
};
