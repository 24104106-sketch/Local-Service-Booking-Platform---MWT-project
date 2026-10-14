import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BrowseServices from "../BrowseServices";
import { UserProvider } from "../../../context/UserContext";
import { ServiceProvider } from "../../../context/ServiceContext";
import { NotificationProvider } from "../../../context/NotificationContext";
import { ToastProvider } from "../../../context/ToastContext";
import { ChatProvider } from "../../../context/ChatContext";
import { ThemeProvider } from "../../../context/ThemeContext";
import { PersonalizationProvider } from "../../../context/PersonalizationContext";

function renderBrowseServices() {
  return render(
    <MemoryRouter initialEntries={["/customer/services"]}>
      <ThemeProvider>
        <PersonalizationProvider>
          <UserProvider>
            <ServiceProvider>
              <NotificationProvider>
                <ToastProvider>
                  <ChatProvider>
                    <BrowseServices />
                  </ChatProvider>
                </ToastProvider>
              </NotificationProvider>
            </ServiceProvider>
          </UserProvider>
        </PersonalizationProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("BrowseServices Component Filter Header", () => {
  it("renders the enhanced filter header with title, subtitle, and breadcrumbs", () => {
    renderBrowseServices();
    expect(screen.getAllByRole("heading", { name: /Browse Services/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Find the best local services near you/i)).toBeInTheDocument();
    expect(screen.getByText(/^Explore$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Compare$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Book$/i)).toBeInTheDocument();
  });

  it("renders search input and custom dropdown triggers", () => {
    renderBrowseServices();
    expect(screen.getByPlaceholderText(/Search for a service/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All Categories/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Any Price/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Any Rating/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sort: Relevance/i })).toBeInTheDocument();
  });

  it("opens custom dropdown and selects an option", () => {
    renderBrowseServices();
    const catBtn = screen.getByRole("button", { name: /All Categories/i });
    fireEvent.click(catBtn);

    expect(screen.getByRole("button", { name: /Appliance Repair/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Appliance Repair/i }));

    expect(screen.getByRole("button", { name: /Appliance Repair/i })).toBeInTheDocument();
  });
});
