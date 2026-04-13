import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "./MetricCard";
import { StatusChip } from "./StatusChip";

describe("display primitives", () => {
  it("renders semantic status chips", () => {
    render(<StatusChip status="warning">Pending</StatusChip>);

    expect(screen.getByText("Pending")).toHaveAttribute("data-status", "warning");
  });

  it("renders metric values without requiring fixed content length", () => {
    render(<MetricCard label="Total balance" status="success" value="$1,242,900.50" />);

    expect(screen.getByText("Total balance")).toBeInTheDocument();
    expect(screen.getByText("$1,242,900.50")).toBeInTheDocument();
  });
});
