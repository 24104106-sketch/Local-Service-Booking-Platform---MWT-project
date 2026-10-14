import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatCard from "../StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard icon="📅" label="Total Bookings" value={12} />);
    expect(screen.getByText("Total Bookings")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders the sub-label only when provided", () => {
    const { rerender } = render(<StatCard icon="📅" label="Total" value={5} sub="All time" />);
    expect(screen.getByText("All time")).toBeInTheDocument();

    rerender(<StatCard icon="📅" label="Total" value={5} />);
    expect(screen.queryByText("All time")).not.toBeInTheDocument();
  });
});
