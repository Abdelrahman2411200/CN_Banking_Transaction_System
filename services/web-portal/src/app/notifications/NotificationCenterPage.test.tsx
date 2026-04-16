import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ApiResult } from "../../lib/api/client";
import type { NotificationOverview } from "../../lib/api/notifications";
import type { AuthSession } from "../auth/session";
import { NotificationCenterPage, type NotificationClient } from "./NotificationCenterPage";

const sessionFor = (role: AuthSession["role"]): AuthSession => ({
  accessToken: `token-for-${role}`,
  role
});

const success = <T,>(data: T, status = 200, requestId?: string): ApiResult<T> => ({
  ok: true,
  status,
  data,
  requestId
});

const failure = (error: string, status = 400, requestId?: string): ApiResult<never> => ({
  ok: false,
  status,
  error,
  requestId
});

const metadataOnly: NotificationOverview = {
  channels: ["email", "sms"],
  mode: "event-consumer",
  persistence: "none",
  records: [],
  subscribedTopics: ["bank.transfer.completed", "bank.transfer.failed", "bank.fraud.alert"]
};

const populated: NotificationOverview = {
  ...metadataOnly,
  records: [
    {
      id: "notification-1",
      channel: "email",
      createdAt: "2026-04-15T09:42:44.000Z",
      message: "Transfer completed for account settlement.",
      recipient: "client@example.com",
      status: "sent",
      subject: "Transfer Successful Notification",
      topic: "bank.transfer.completed",
      transferId: "223e4567-e89b-12d3-a456-426614174111",
      type: "transfer_completed"
    },
    {
      id: "notification-2",
      channel: "sms",
      createdAt: "2026-04-15T09:38:55.000Z",
      message: "Fraud alert notification failed delivery.",
      recipient: "+15550129982",
      status: "failed",
      subject: "Fraud Alert Critical",
      topic: "bank.fraud.alert",
      type: "fraud_alert"
    }
  ]
};

const makeClient = (result: ApiResult<NotificationOverview> = success(populated)): NotificationClient => ({
  getNotifications: vi.fn<NotificationClient["getNotifications"]>().mockResolvedValue(result)
});

const renderNotifications = (client: NotificationClient, role: AuthSession["role"] = "admin"): void => {
  render(
    <NotificationCenterPage
      getSession={() => sessionFor(role)}
      notificationClient={client}
    />
  );
};

describe("NotificationCenterPage", () => {
  it("renders returned records as a live notification timeline", async () => {
    const client = makeClient();
    renderNotifications(client);

    expect(await screen.findByText("Live Notification Timeline")).toBeInTheDocument();
    expect(screen.getByText("Transfer Successful Notification")).toBeInTheDocument();
    expect(screen.getByText("Fraud Alert Critical")).toBeInTheDocument();
    expect(screen.getAllByText("email").length).toBeGreaterThan(0);
    expect(screen.getAllByText("sms").length).toBeGreaterThan(0);
    expect(screen.getByText("sent")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(client.getNotifications).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }));
  });

  it("renders metadata, empty state, and unsupported-action guidance without fake controls", async () => {
    renderNotifications(makeClient(success(metadataOnly, 200, "req-empty")));

    expect(await screen.findByText("No notifications recorded")).toBeInTheDocument();
    expect(screen.getByText("bank.transfer.completed")).toBeInTheDocument();
    expect(screen.getByText("Persistence none")).toBeInTheDocument();
    expect(screen.getByText("Request req-empty")).toBeInTheDocument();
    expect(screen.getByText(/Resend, acknowledge, mark-read, and creation actions are unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /acknowledge/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark-read/i })).not.toBeInTheDocument();
  });

  it("refreshes the timeline manually", async () => {
    const user = userEvent.setup();
    const client: NotificationClient = {
      getNotifications: vi
        .fn<NotificationClient["getNotifications"]>()
        .mockResolvedValueOnce(success(metadataOnly))
        .mockResolvedValueOnce(success(populated))
    };
    renderNotifications(client);

    expect(await screen.findByText("No notifications recorded")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Refresh/i }));

    expect(await screen.findByText("Live Notification Timeline")).toBeInTheDocument();
    expect(screen.getByText("Transfer Successful Notification")).toBeInTheDocument();
    expect(client.getNotifications).toHaveBeenCalledTimes(2);
  });

  it("announces admin-only gateway failures", async () => {
    renderNotifications(makeClient(failure("forbidden", 403, "req-denied")), "operator");

    expect(await screen.findByText("Notifications unavailable")).toBeInTheDocument();
    expect(screen.getByText("Notifications are restricted to admin sessions. Reference req-denied.")).toBeInTheDocument();
  });
});
