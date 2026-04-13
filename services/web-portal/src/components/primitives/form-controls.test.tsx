import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input, Select } from "./FormControls";

describe("form controls", () => {
  it("links input labels and validation errors accessibly", () => {
    render(<Input error="Amount is required" label="Amount" name="amount" />);

    const input = screen.getByLabelText("Amount");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Amount is required")).toHaveAttribute("id", "amount-error");
  });

  it("renders select options with a label", () => {
    render(
      <Select label="Status" name="status">
        <option>Active</option>
      </Select>
    );

    expect(screen.getByLabelText("Status")).toHaveValue("Active");
  });
});
