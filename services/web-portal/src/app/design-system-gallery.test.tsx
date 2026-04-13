import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DesignSystemGallery } from "./gallery/DesignSystemGallery";

describe("DesignSystemGallery", () => {
  it("renders canonical reference metadata and account shell composition", () => {
    render(
      <MemoryRouter>
        <DesignSystemGallery />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Design System Gallery" })).toBeInTheDocument();
    expect(screen.getAllByText("authentication").length).toBeGreaterThan(0);
    expect(screen.getByText("account_management_dark")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account Ecosystem" })).toBeInTheDocument();
  });
});
