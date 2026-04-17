import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";
import { Toast } from "./Toast";

describe("overlay primitives", () => {
  it("renders toast status semantics", () => {
    render(<Toast message="Retry in a few minutes" status="error" title="Gateway unavailable" />);

    expect(screen.getByText("Gateway unavailable")).toBeInTheDocument();
    expect(screen.getByText("error")).toHaveAttribute("data-status", "error");
  });

  it("renders dialog with accessible title and close action", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Dialog onClose={onClose} open title="Confirm transfer">
        Review before submitting.
      </Dialog>
    );

    expect(screen.getByRole("dialog", { name: /confirm transfer/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close dialog/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps keyboard focus inside dialog and closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <>
        <button type="button">Outside action</button>
        <Dialog onClose={onClose} open title="Review exception">
          <button type="button">Approve exception</button>
        </Dialog>
      </>
    );

    const closeButton = screen.getByRole("button", { name: /close dialog/i });
    const approveButton = screen.getByRole("button", { name: /approve exception/i });

    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(approveButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
