import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, IconButton } from "./Button";

describe("Button primitives", () => {
  it("renders variant buttons and preserves disabled loading behavior", () => {
    render(
      <Button loading variant="primary">
        Transfer
      </Button>
    );

    expect(screen.getByRole("button", { name: /transfer/i })).toBeDisabled();
  });

  it("requires an accessible name for icon buttons", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<IconButton icon="settings" label="Open settings" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: /open settings/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
