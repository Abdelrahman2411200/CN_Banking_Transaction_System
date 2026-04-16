import { afterEach, describe, expect, it, vi } from "vitest";
import { getNotifications } from "./notifications";

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init
  });

describe("notifications api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads notification metadata from the gateway endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: true,
          data: {
            channels: ["email", "sms"],
            mode: "event-consumer",
            persistence: "none",
            subscribedTopics: ["bank.transfer.completed", "bank.fraud.alert"]
          }
        },
        { headers: { "x-request-id": "req-notifications" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getNotifications({
      baseUrl: "http://gateway.test",
      session: { accessToken: "access-token", role: "admin" }
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      data: {
        channels: ["email", "sms"],
        mode: "event-consumer",
        persistence: "none",
        records: [],
        subscribedTopics: ["bank.transfer.completed", "bank.fraud.alert"]
      },
      requestId: "req-notifications"
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://gateway.test/v1/notifications");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("normalizes returned notification records when the backend starts persisting them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            notifications: [
              {
                delivery_status: "sent",
                notification_id: "notification-1",
                notification_type: "transfer_completed",
                recipient: "client@example.com",
                sent_at: "2026-04-15T09:42:44.000Z",
                channel: "email",
                kafka_topic: "bank.transfer.completed",
                transfer_id: "223e4567-e89b-12d3-a456-426614174111"
              }
            ],
            topics: ["bank.transfer.completed"]
          }
        })
      )
    );

    await expect(
      getNotifications({
        baseUrl: "http://gateway.test",
        session: { accessToken: "access-token", role: "admin" }
      })
    ).resolves.toMatchObject({
      ok: true,
      data: {
        records: [
          {
            channel: "email",
            createdAt: "2026-04-15T09:42:44.000Z",
            id: "notification-1",
            recipient: "client@example.com",
            status: "sent",
            topic: "bank.transfer.completed",
            transferId: "223e4567-e89b-12d3-a456-426614174111",
            type: "transfer_completed"
          }
        ],
        subscribedTopics: ["bank.transfer.completed"]
      }
    });
  });

  it("normalizes admin-only notification errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: "forbidden" },
          { status: 403, headers: { "x-request-id": "req-denied" } }
        )
      )
    );

    await expect(
      getNotifications({
        baseUrl: "http://gateway.test",
        session: { accessToken: "access-token", role: "operator" }
      })
    ).resolves.toEqual({ ok: false, status: 403, error: "forbidden", requestId: "req-denied" });
  });
});
