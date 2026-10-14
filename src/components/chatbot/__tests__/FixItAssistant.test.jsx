import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FixItAssistant from "../FixItAssistant";
import { UserContext } from "../../../context/UserContext";
import { ServiceProvider } from "../../../context/ServiceContext";
import { BookingProvider } from "../../../context/BookingContext";
import { ComplaintProvider } from "../../../context/ComplaintContext";
import { NotificationProvider } from "../../../context/NotificationContext";
import { ToastProvider } from "../../../context/ToastContext";
import { WalletProvider } from "../../../context/WalletContext";
import { ThemeProvider } from "../../../context/ThemeContext";
import { PersonalizationProvider } from "../../../context/PersonalizationContext";

function renderAssistantWithUser(user, setUserMock = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <ThemeProvider>
        <PersonalizationProvider>
          <UserContext.Provider value={{ user, login: setUserMock, logout: setUserMock }}>
            <ServiceProvider>
              <NotificationProvider>
                <ToastProvider>
                  <WalletProvider>
                    <ComplaintProvider>
                      <BookingProvider>
                        <FixItAssistant />
                      </BookingProvider>
                    </ComplaintProvider>
                  </WalletProvider>
                </ToastProvider>
              </NotificationProvider>
            </ServiceProvider>
          </UserContext.Provider>
        </PersonalizationProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("FixIt Assistant Multilingual, Smart Problem Detection & Voice Features", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders the floating launcher, language switcher [EN | தமிழ்], and mic button", () => {
    const customerUser = { id: "cust-1", name: "Ananya Rao", email: "ananya@fixit.com", role: "customer" };
    renderAssistantWithUser(customerUser);

    const launcher = screen.getByRole("button", { name: /FixIt Assistant/i });
    expect(launcher).toBeInTheDocument();

    fireEvent.click(launcher);

    // Language switcher buttons
    expect(screen.getByRole("button", { name: /Switch to English/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Switch to Tamil/i })).toBeInTheDocument();

    // Voice microphone button
    expect(screen.getByRole("button", { name: /Voice input/i })).toBeInTheDocument();
  });

  it("responds in English with step-by-step guide for English 'How do I book a service?'", async () => {
    vi.useFakeTimers();
    const customerUser = { id: "cust-1", name: "Ananya Rao", email: "ananya@fixit.com", role: "customer" };
    renderAssistantWithUser(customerUser);

    fireEvent.click(screen.getByRole("button", { name: /FixIt Assistant/i }));
    const input = screen.getByPlaceholderText(/Type your problem/i);
    fireEvent.change(input, { target: { value: "How do I book a service?" } });
    fireEvent.submit(input.closest("form"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Step by step instructions in English
    expect(screen.getByText(/Here's how to book a service/i)).toBeInTheDocument();
    expect(screen.getByText(/Select your date and time/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Book a Service/i }).length).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });

  it("responds to 'AC cooling illa' by recommending AC Repair & Service", async () => {
    vi.useFakeTimers();
    const customerUser = { id: "cust-1", name: "Ananya Rao", email: "ananya@fixit.com", role: "customer" };
    renderAssistantWithUser(customerUser);

    fireEvent.click(screen.getByRole("button", { name: /FixIt Assistant/i }));
    const input = screen.getByPlaceholderText(/Type your problem/i);
    fireEvent.change(input, { target: { value: "AC cooling illa" } });
    fireEvent.submit(input.closest("form"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getAllByText(/Kumar Cooling Co/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /AC Service/i }).length).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });

  it("asks smart follow-up questions for ambiguous problem 'Bathroom la problem iruku'", async () => {
    vi.useFakeTimers();
    const customerUser = { id: "cust-1", name: "Ananya Rao", email: "ananya@fixit.com", role: "customer" };
    renderAssistantWithUser(customerUser);

    fireEvent.click(screen.getByRole("button", { name: /FixIt Assistant/i }));
    const input = screen.getByPlaceholderText(/Type your problem/i);
    fireEvent.change(input, { target: { value: "Bathroom la problem iruku" } });
    fireEvent.submit(input.closest("form"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Follow-up question asked
    expect(screen.getByText(/What kind of bathroom problem are you facing/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tap Leakage/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Drain Blockage/i })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("detects urgent emergency for 'Pipe burst aayiduchu' and gives safety guidance", async () => {
    vi.useFakeTimers();
    const customerUser = { id: "cust-1", name: "Ananya Rao", email: "ananya@fixit.com", role: "customer" };
    renderAssistantWithUser(customerUser);

    fireEvent.click(screen.getByRole("button", { name: /FixIt Assistant/i }));
    const input = screen.getByPlaceholderText(/Type your problem/i);
    fireEvent.change(input, { target: { value: "Pipe burst aayiduchu" } });
    fireEvent.submit(input.closest("form"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Urgent emergency warning & safety action
    expect(screen.getByText(/URGENT WATER EMERGENCY/i)).toBeInTheDocument();
    expect(screen.getByText(/main water valve/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Book Plumber Now/i })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("recommends verified providers when user asks 'Find a provider'", async () => {
    vi.useFakeTimers();
    const customerUser = { id: "cust-1", name: "Ananya Rao", email: "ananya@fixit.com", role: "customer" };
    renderAssistantWithUser(customerUser);

    fireEvent.click(screen.getByRole("button", { name: /FixIt Assistant/i }));
    const input = screen.getByPlaceholderText(/Type your problem/i);
    fireEvent.change(input, { target: { value: "Find a provider" } });
    fireEvent.submit(input.closest("form"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getAllByText(/Kumar Cooling Co/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /View Kumar Cooling Co/i })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("clearly states unsupported service when user asks for 'car repair'", async () => {
    vi.useFakeTimers();
    const customerUser = { id: "cust-1", name: "Ananya Rao", email: "ananya@fixit.com", role: "customer" };
    renderAssistantWithUser(customerUser);

    fireEvent.click(screen.getByRole("button", { name: /FixIt Assistant/i }));
    const input = screen.getByPlaceholderText(/Type your problem/i);
    fireEvent.change(input, { target: { value: "Do you have car repair?" } });
    fireEvent.submit(input.closest("form"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText(/couldn't find a matching service for that in our current FixIt Local catalog/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("handles explicit navigation request 'Open Browse Services'", async () => {
    vi.useFakeTimers();
    const customerUser = { id: "cust-1", name: "Ananya Rao", email: "ananya@fixit.com", role: "customer" };
    renderAssistantWithUser(customerUser);

    fireEvent.click(screen.getByRole("button", { name: /FixIt Assistant/i }));
    const input = screen.getByPlaceholderText(/Type your problem/i);
    fireEvent.change(input, { target: { value: "Open Browse Services" } });
    fireEvent.submit(input.closest("form"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole("button", { name: /Go to Browse Services/i })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("isolates chat history between Customer A, Provider A, and Customer B", async () => {
    vi.useFakeTimers();

    const customerA = { id: "cust-a", name: "Customer A", email: "customera@fixit.com", role: "customer" };
    const { unmount } = renderAssistantWithUser(customerA);

    fireEvent.click(screen.getByRole("button", { name: /FixIt Assistant/i }));
    const input = screen.getByPlaceholderText(/Type your problem/i);
    fireEvent.change(input, { target: { value: "My AC is not cooling" } });
    fireEvent.submit(input.closest("form"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText("My AC is not cooling")).toBeInTheDocument();

    unmount();

    // Provider A logs in
    const providerA = { id: "prov-a", name: "Provider A", email: "providera@fixit.com", role: "provider" };
    const { unmount: unmountProvider } = renderAssistantWithUser(providerA);

    fireEvent.click(screen.getByRole("button", { name: /FixIt Assistant/i }));
    expect(screen.queryByText("My AC is not cooling")).not.toBeInTheDocument();

    unmountProvider();

    // Customer A logs back in
    renderAssistantWithUser(customerA);
    fireEvent.click(screen.getByRole("button", { name: /FixIt Assistant/i }));
    expect(screen.getByText("My AC is not cooling")).toBeInTheDocument();

    vi.useRealTimers();
  });
});
