import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Availability from "../Availability";
import { UserProvider } from "../../../context/UserContext";
import { ServiceProvider } from "../../../context/ServiceContext";
import { AvailabilityProvider } from "../../../context/AvailabilityContext";
import { NotificationProvider } from "../../../context/NotificationContext";
import { ToastProvider } from "../../../context/ToastContext";
import { ChatProvider } from "../../../context/ChatContext";
import { BookingProvider } from "../../../context/BookingContext";
import { WalletProvider } from "../../../context/WalletContext";
import { ThemeProvider } from "../../../context/ThemeContext";
import { PersonalizationProvider } from "../../../context/PersonalizationContext";

// Mock socket.io-client to avoid actual network connection in unit tests
vi.mock("socket.io-client", () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  }),
}));

// Mock realApi functions used by useAvailability
vi.mock("../../../api/realApi", () => ({
  fetchProviderDailyScheduleApi: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: {
        date: "2026-10-10",
        providerId: 1,
        startTime: "09:00 AM",
        endTime: "06:00 PM",
        isAvailable: true,
        isDayOff: false,
        busyIntervals: [
          { id: "bi_1", start: "01:00 PM", end: "02:00 PM", reason: "Lunch break" },
        ],
        bookings: [
          {
            id: 101,
            bookingNumber: "FIX-BK-101",
            serviceTitle: "AC Repair & Service",
            time: "10:00 AM",
            status: "confirmed",
            customerName: "Rahul Sharma",
          },
        ],
        isCustomized: true,
        serviceDuration: 60,
      },
    })
  ),
  saveProviderDailyScheduleApi: vi.fn(() => Promise.resolve({ success: true })),
  addBusyIntervalApi: vi.fn(() => Promise.resolve({ success: true })),
  deleteBusyIntervalApi: vi.fn(() => Promise.resolve({ success: true })),
  quickActionAvailabilityApi: vi.fn(() => Promise.resolve({ success: true })),
  restoreDailyAvailabilityApi: vi.fn(() => Promise.resolve({ success: true })),
  fetchProviderAvailabilitySlotsApi: vi.fn(() => Promise.resolve({ success: true, data: [] })),
}));

vi.mock("../../../api/apiClient", () => {
  const mockClient = {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } })),
  };

  return {
    apiClient: mockClient,
    default: mockClient,
    getAuthToken: vi.fn(() => "mock-jwt-token"),
    setAuthToken: vi.fn(),
  };
});

function renderAvailability() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <PersonalizationProvider>
          <UserProvider>
            <ServiceProvider>
              <AvailabilityProvider>
                <NotificationProvider>
                  <ToastProvider>
                    <ChatProvider>
                      <WalletProvider>
                        <BookingProvider>
                          <Availability />
                        </BookingProvider>
                      </WalletProvider>
                    </ChatProvider>
                  </ToastProvider>
                </NotificationProvider>
              </AvailabilityProvider>
            </ServiceProvider>
          </UserProvider>
        </PersonalizationProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("Provider Availability Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem(
      "fixit_local_user",
      JSON.stringify({ id: 1, role: "provider", name: "John Tech" })
    );
  });

  it("renders the page title, accepting bookings toggle, and preserved live GPS tracking", async () => {
    renderAvailability();

    expect(screen.getByText(/Accepting New Bookings/i)).toBeInTheDocument();
    expect(screen.getByText(/Provider Live GPS Location/i)).toBeInTheDocument();
  });

  it("renders the date picker and quick action controls", async () => {
    renderAvailability();

    expect(screen.getByText(/Select Schedule Date/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark as Day Off|Set as Available/i })).toBeInTheDocument();
  });

  it("displays working hours and busy intervals for the selected date", async () => {
    renderAvailability();

    await waitFor(() => {
      expect(screen.getByText(/Customer: Rahul Sharma/i)).toBeInTheDocument();
    });

    const headings = screen.getAllByText(/Working Hours/i);
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByText(/Busy Intervals & Blocked Periods/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Lunch break/i).length).toBeGreaterThan(0);
  });

  it("displays scheduled customer bookings on that date", async () => {
    renderAvailability();

    await waitFor(() => {
      expect(screen.getByText(/#FIX-BK-101/i)).toBeInTheDocument();
      expect(screen.getByText(/AC Repair & Service/i)).toBeInTheDocument();
      expect(screen.getByText(/Customer: Rahul Sharma/i)).toBeInTheDocument();
    });
  });

  it("allows opening the Add Busy Interval form", async () => {
    renderAvailability();

    const addBtn = await screen.findByRole("button", { name: /\+ Add Block \/ Break/i });
    fireEvent.click(addBtn);

    expect(screen.getByText(/Block Start/i)).toBeInTheDocument();
    expect(screen.getByText(/Block End/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Lunch break, Dentist, Travel/i)).toBeInTheDocument();
  });
});
