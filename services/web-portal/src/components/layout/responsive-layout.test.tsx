import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentGrid, PageHeader } from "./PageLayout";

describe("layout primitives", () => {
  it("renders a page header with actions", () => {
    render(<PageHeader actions={<button type="button">Refresh</button>} eyebrow="Phase 1" title="Tokens" />);

    expect(screen.getByRole("heading", { name: "Tokens" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("renders content grid children without wrapping cards inside cards", () => {
    render(
      <ContentGrid>
        <article>One</article>
        <article>Two</article>
      </ContentGrid>
    );

    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
  });
});
