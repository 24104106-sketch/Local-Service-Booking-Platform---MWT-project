import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import BookService from "../BookService";
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

function renderBookService(initialEntries = ["/customer/book"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
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
                          <Routes>
                            <Route path="/customer/book" element={<BookService />} />
                          </Routes>
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

describe("BookService Component", () => {
  it("renders without crashing even when navigated directly", () => {
    renderBookService();
    expect(screen.getByRole("heading", { name: /Book Service/i })).toBeInTheDocument();
    expect(screen.getByText(/AC Repair & Service/i)).toBeInTheDocument();
  });

  it("renders continue button and wizard progress", () => {
    renderBookService();
    expect(
      screen.getByRole("button", { name: /Where do you need this service|Continue/i })
    ).toBeInTheDocument();
  });
});
