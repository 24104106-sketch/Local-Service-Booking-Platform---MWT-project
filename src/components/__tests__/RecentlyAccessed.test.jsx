import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RecentlyAccessed from "../customer/RecentlyAccessed";
import * as useRecentlyAccessedModule from "../../hooks/useRecentlyAccessed";
import { translations } from "../../i18n/translations";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("RecentlyAccessed Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state cleanly when no items exist", () => {
    vi.spyOn(useRecentlyAccessedModule, "useRecentlyAccessed").mockReturnValue({
      items: [],
      loading: false,
      error: null,
      clearHistory: vi.fn(),
      refresh: vi.fn(),
    });

    render(
      <MemoryRouter>
        <RecentlyAccessed />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Recently Viewed/i })).toBeInTheDocument();
    expect(screen.getByText(/No recently viewed items yet/i)).toBeInTheDocument();
  });

  it("renders recently viewed services and providers with badges and prices", () => {
    const mockItems = [
      {
        id: 1,
        itemType: "service",
        itemId: 10,
        accessedAt: new Date().toISOString(),
        service: {
          id: 10,
          title: "AC Repair & Maintenance",
          category: "AC Repair",
          price: 599,
        },
      },
      {
        id: 2,
        itemType: "provider",
        itemId: 20,
        accessedAt: new Date(Date.now() - 3600000).toISOString(),
        provider: {
          id: 20,
          name: "Suresh Electrician",
          businessName: "Suresh Electrical Services",
          category: "Electrical",
          rating: 4.8,
        },
      },
    ];

    vi.spyOn(useRecentlyAccessedModule, "useRecentlyAccessed").mockReturnValue({
      items: mockItems,
      loading: false,
      error: null,
      clearHistory: vi.fn(),
      refresh: vi.fn(),
    });

    render(
      <MemoryRouter>
        <RecentlyAccessed />
      </MemoryRouter>
    );

    expect(screen.getByText("AC Repair & Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Suresh Electrical Services")).toBeInTheDocument();
    expect(screen.getByText(/View Service/i)).toBeInTheDocument();
    expect(screen.getByText(/View Provider/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear History/i)).toBeInTheDocument();
  });

  it("navigates to service details when a recently accessed service is clicked", () => {
    const mockItems = [
      {
        id: 1,
        itemType: "service",
        itemId: 10,
        accessedAt: new Date().toISOString(),
        service: {
          id: 10,
          title: "Plumbing Leak Fix",
          category: "Plumbing",
          price: 299,
        },
      },
    ];

    vi.spyOn(useRecentlyAccessedModule, "useRecentlyAccessed").mockReturnValue({
      items: mockItems,
      loading: false,
      error: null,
      clearHistory: vi.fn(),
      refresh: vi.fn(),
    });

    render(
      <MemoryRouter>
        <RecentlyAccessed />
      </MemoryRouter>
    );

    const card = screen.getByText("Plumbing Leak Fix");
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith("/customer/services/10", expect.any(Object));
  });

  it("calls clearHistory when Clear History button is clicked", () => {
    const mockClear = vi.fn();
    vi.spyOn(useRecentlyAccessedModule, "useRecentlyAccessed").mockReturnValue({
      items: [
        {
          id: 1,
          itemType: "service",
          itemId: 5,
          accessedAt: new Date().toISOString(),
          service: { id: 5, title: "Deep Cleaning", category: "Cleaning", price: 1499 },
        },
      ],
      loading: false,
      error: null,
      clearHistory: mockClear,
      refresh: vi.fn(),
    });

    render(
      <MemoryRouter>
        <RecentlyAccessed />
      </MemoryRouter>
    );

    const clearBtn = screen.getByText(/Clear History/i);
    fireEvent.click(clearBtn);

    expect(mockClear).toHaveBeenCalledTimes(1);
  });
});
