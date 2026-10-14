import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProviderOnboardingWizard from "../../components/auth/ProviderOnboardingWizard";
import { UserProvider } from "../../context/UserContext";
import { NotificationProvider } from "../../context/NotificationContext";
import { ToastProvider } from "../../context/ToastContext";
import { PersonalizationProvider } from "../../context/PersonalizationContext";
import { ThemeProvider } from "../../context/ThemeContext";
import { ServiceProvider } from "../../context/ServiceContext";

function renderWizard(props = {}) {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <PersonalizationProvider>
          <UserProvider>
            <ServiceProvider>
              <NotificationProvider>
                <ToastProvider>
                  <ProviderOnboardingWizard
                    initialData={{
                      fullName: "Test Provider",
                      username: "testprovider",
                      email: "testprovider@example.com",
                      phone: "9876543210",
                      password: "Password123",
                      confirmPassword: "Password123",
                      address: "123 Main St, T. Nagar",
                      city: "Chennai"
                    }}
                    onSwitchToCustomer={vi.fn()}
                    {...props}
                  />
                </ToastProvider>
              </NotificationProvider>
            </ServiceProvider>
          </UserProvider>
        </PersonalizationProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("ProviderOnboardingWizard Component", () => {
  it("renders Step 1 with prefilled data and step indicators", () => {
    renderWizard();
    expect(screen.getByText(/Service Provider Registration/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1: Basic Information/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Provider")).toBeInTheDocument();
    expect(screen.getByDisplayValue("testprovider@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("9876543210")).toBeInTheDocument();
  });

  it("navigates from Step 1 to Step 2 when fields are valid", async () => {
    renderWizard();
    const nextBtn = screen.getByRole("button", { name: /Next Step →/i });
    fireEvent.click(nextBtn);

    // Expect Step 2: Services
    await waitFor(() => {
      expect(screen.getByText(/Step 2: Choose Services You Offer/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/0 Services Selected/i)).toBeInTheDocument();
  });

  it("prevents proceeding past Step 2 when no service is selected", async () => {
    renderWizard();
    // Go to Step 2
    fireEvent.click(screen.getByRole("button", { name: /Next Step →/i }));
    await waitFor(() => {
      expect(screen.getByText(/Step 2: Choose Services You Offer/i)).toBeInTheDocument();
    });

    // Try to click Next Step without selecting a service
    const nextBtn = screen.getByRole("button", { name: /Next Step →/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Please select at least 1 service/i)).toBeInTheDocument();
  });

  it("allows selecting a service from the catalog and moving to Step 3", async () => {
    renderWizard();
    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole("button", { name: /Next Step →/i }));
    await waitFor(() => {
      expect(screen.getByText(/Step 2: Choose Services You Offer/i)).toBeInTheDocument();
    });

    // Select first service card
    const firstCard = (screen.queryByText("AC Repair & Service") || screen.queryByText("AC Deep Clean & Service")).closest(".catalog-service-card");
    expect(firstCard).toBeInTheDocument();
    fireEvent.click(firstCard);

    expect(screen.getByText(/1 Service Selected/i)).toBeInTheDocument();

    // Now Next Step proceeds to Step 3
    fireEvent.click(screen.getByRole("button", { name: /Next Step →/i }));
    await waitFor(() => {
      expect(screen.getByText(/Step 3: Experience & Specialization/i)).toBeInTheDocument();
    });
  });
});
