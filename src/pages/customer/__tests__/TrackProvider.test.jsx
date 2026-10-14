import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TrackProvider from "../TrackProvider";
import { UserContext } from "../../../context/UserContext";
import { BookingProvider } from "../../../context/BookingContext";
import { ServiceProvider } from "../../../context/ServiceContext";
import { NotificationProvider } from "../../../context/NotificationContext";
import { ToastProvider } from "../../../context/ToastContext";
import { ChatProvider } from "../../../context/ChatContext";
import { ThemeProvider } from "../../../context/ThemeContext";
import { PersonalizationProvider } from "../../../context/PersonalizationContext";

function renderTrackProvider(user, bookingId = "BK1001") {
  return render(
    <MemoryRouter initialEntries={[`/customer/track/${bookingId}`]}>
      <ThemeProvider>
        <PersonalizationProvider>
          <UserContext.Provider value={{ user, login: vi.fn(), logout: vi.fn() }}>
            <ServiceProvider>
              <NotificationProvider>
                <ToastProvider>
                  <ChatProvider>
                    <BookingProvider>
                      <Routes>
                        <Route path="/customer/track/:bookingId" element={<TrackProvider />} />
                      </Routes>
                    </BookingProvider>
                  </ChatProvider>
                </ToastProvider>
              </NotificationProvider>
            </ServiceProvider>
          </UserContext.Provider>
        </PersonalizationProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("TrackProvider Component", () => {
  const customerUser = {
    id: "cust-1",
    name: "Radha",
    email: "customer@fixit.com",
    role: "customer",
  };

  const otherUser = {
    id: "cust-2",
    name: "Other Customer",
    email: "other@fixit.com",
    role: "customer",
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders track provider page with correct provider info, service, and booking details", async () => {
    renderTrackProvider(customerUser, "BK1001");

    expect(await screen.findByText(/Track Your Provider/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Arun AC Care & Service/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/AC Repair & Service/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/BK1001/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Contact Provider/i })).toBeInTheDocument();
  });

  it("enforces customer privacy: unauthorized customer cannot track another customer's provider", async () => {
    renderTrackProvider(otherUser, "BK1001");

    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Privacy Notice: You can only track providers assigned to your own active bookings/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Arun AC Care & Service/i)).not.toBeInTheDocument();
  });

  it("displays booking not found error for invalid booking id", async () => {
    renderTrackProvider(customerUser, "NON_EXISTENT_ID");

    expect(await screen.findByText(/Booking Not Found/i)).toBeInTheDocument();
  });

  it("opens the contact provider chat modal when Contact Provider button is clicked", async () => {
    renderTrackProvider(customerUser, "BK1001");

    const contactBtn = await screen.findByRole("button", { name: /Contact Provider/i });
    fireEvent.click(contactBtn);

    expect(screen.getByText(/Chat with Arun AC Care & Service/i)).toBeInTheDocument();
  });

  it("renders real-time GPS tracking status card and provider tracking map", async () => {
    renderTrackProvider(customerUser, "BK1001");

    expect(await screen.findByText(/Real-Time GPS Tracking Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Live GPS Radar Tracking/i)).toBeInTheDocument();
  });
});
