import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Badge from "../Badge";

describe("Badge", () => {
  it("renders the status text", () => {
    render(<Badge status="Completed" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("lowercases single-word statuses into a matching CSS class", () => {
    render(<Badge status="Pending" />);
    expect(screen.getByText("Pending")).toHaveClass("badge", "pending");
  });

  // Regression test: Badge used to only lowercase the status without
  // stripping spaces, so "In Review" became className="badge in review"
  // (two unmatched classes) instead of a single "inreview" class that
  // actually matches the CSS rule .badge.inreview.
  it("strips spaces from multi-word statuses so the CSS class actually matches", () => {
    render(<Badge status="In Review" />);
    const el = screen.getByText("In Review");
    expect(el.className).toBe("badge inreview");
    expect(el.className).not.toContain(" in ");
  });

  it("handles an empty/undefined status without crashing", () => {
    const { container } = render(<Badge status={undefined} />);
    const el = container.querySelector("span");
    expect(el).toHaveClass("badge");
  });
});
