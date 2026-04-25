import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { statusSemantics, type StatusSemantic } from "../../design-system";
import { StatusChip } from "./StatusChip";

describe("StatusChip", () => {
  it.each(Object.keys(statusSemantics) as StatusSemantic[])("renders %s semantic status tokens", (status) => {
    render(<StatusChip status={status}>{statusSemantics[status].meaning}</StatusChip>);

    const chip = screen.getByText(statusSemantics[status].meaning);

    expect(chip).toHaveAttribute("data-status", status);
    expect(chip).toHaveClass(...statusSemantics[status].containerClass.split(" "));
  });

  it("defaults to neutral metadata semantics", () => {
    render(<StatusChip>Metadata</StatusChip>);

    expect(screen.getByText("Metadata")).toHaveAttribute("data-status", "neutral");
  });
});
