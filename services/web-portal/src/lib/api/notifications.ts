import { readStoredSession, type AuthSession } from "../../app/auth/session";
import { getApiBaseUrl } from "../env";
import { refreshAccessTokenForRetry } from "./auth";
import { requestJson, type ApiRequestInit, type ApiResult } from "./client";

export type NotificationChannel = string;
export type NotificationStatus = string;

export interface NotificationRecord {
  id: string;
  type: string;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  recipient?: string;
  subject?: string;
  message?: string;
  topic?: string;
  accountId?: string;
  transferId?: string;
  createdAt?: string;
}

export interface NotificationOverview {
  mode?: string;
  persistence?: string;
  channels: string[];
  subscribedTopics: string[];
  records: NotificationRecord[];
}

export interface NotificationApiOptions {
  baseUrl?: string;
  session?: AuthSession | null;
}

type GatewayRecord = Record<string, unknown>;

const notificationsUrl = (baseUrl = getApiBaseUrl()): string => `${baseUrl}/v1/notifications`;

const authInit = (options: NotificationApiOptions): ApiRequestInit => ({
  accessToken: () => options.session?.accessToken ?? readStoredSession()?.accessToken ?? null,
  refreshAccessToken: () => refreshAccessTokenForRetry({ baseUrl: options.baseUrl })
});

const isRecord = (value: unknown): value is GatewayRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const hasDataProperty = (value: unknown): value is { data?: unknown } =>
  isRecord(value) && "data" in value;

const unwrapData = (value: unknown): unknown =>
  hasDataProperty(value) && value.data !== undefined ? value.data : value;

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value.trim() ? value : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(toOptionalString).filter((item): item is string => Boolean(item));
};

const pickString = (source: GatewayRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = toOptionalString(source[key]);

    if (value) {
      return value;
    }
  }

  return undefined;
};

const toNotificationRecord = (value: unknown, index: number): NotificationRecord => {
  const source = isRecord(value) ? value : {};
  const id =
    pickString(source, ["id", "notificationId", "notification_id", "_id", "eventId", "event_id"]) ??
    `notification-${index + 1}`;

  return {
    id,
    type:
      pickString(source, ["type", "notificationType", "notification_type", "eventType", "event_type"]) ??
      "notification",
    accountId: pickString(source, ["accountId", "account_id"]),
    channel: pickString(source, ["channel"]),
    createdAt: pickString(source, ["createdAt", "created_at", "sentAt", "sent_at", "timestamp"]),
    message: pickString(source, ["message", "body", "description"]),
    recipient: pickString(source, ["recipient", "to", "destination"]),
    status: pickString(source, ["status", "deliveryStatus", "delivery_status"]),
    subject: pickString(source, ["subject", "title"]),
    topic: pickString(source, ["topic", "kafkaTopic", "kafka_topic"]),
    transferId: pickString(source, ["transferId", "transfer_id"])
  };
};

const extractRecords = (payload: unknown): NotificationRecord[] => {
  if (Array.isArray(payload)) {
    return payload.map(toNotificationRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const candidate =
    payload.notifications ?? payload.records ?? payload.items ?? payload.events ?? payload.timeline;

  return Array.isArray(candidate) ? candidate.map(toNotificationRecord) : [];
};

const toNotificationOverview = (value: unknown): NotificationOverview => {
  const payload = unwrapData(value);
  const source = isRecord(payload) ? payload : {};

  return {
    channels: toStringArray(source.channels),
    mode: pickString(source, ["mode"]),
    persistence: pickString(source, ["persistence"]),
    records: extractRecords(payload),
    subscribedTopics: toStringArray(source.subscribedTopics ?? source.subscribed_topics ?? source.topics)
  };
};

export const getNotifications = async (
  options: NotificationApiOptions = {}
): Promise<ApiResult<NotificationOverview>> => {
  const result = await requestJson<unknown>(
    notificationsUrl(options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toNotificationOverview(result.data),
    requestId: result.requestId
  };
};
