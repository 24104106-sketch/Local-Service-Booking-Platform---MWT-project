import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Register from "../Register";
import { UserProvider } from "../../context/UserContext";
import { NotificationProvider } from "../../context/NotificationContext";
import { ToastProvider } from "../../context/ToastContext";
import { PersonalizationProvider } from "../../context/PersonalizationContext";
import { ThemeProvider } from "../../context/ThemeContext";

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <ThemeProvider>
        <PersonalizationProvider>
          <UserProvider>
            <NotificationProvider>
              <ToastProvider>
                <Routes>
                  <Route path="/register" element={<Register />} />
                </Routes>
              </ToastProvider>
            </NotificationProvider>
          </UserProvider>
        </PersonalizationProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("Register Component UI/UX Redesign", () => {
  it("renders the 2-column registration layout with branding and benefits", () => {
    renderRegister();
    expect(screen.getByText(/Your trusted partner/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified Professionals/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick & Easy Booking/i)).toBeInTheDocument();
    expect(screen.getByText(/24\/7 Support/i)).toBeInTheDocument();
    expect(screen.getByText(/Join 10K\+ satisfied customers/i)).toBeInTheDocument();
  });

  it("renders all required form fields with placeholders and icons", () => {
    renderRegister();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
  });

  it("allows selecting Customer and Service Provider roles", () => {
    renderRegister();
    const customerBtn = screen.getByText("Customer").closest("button");
    const providerBtn = screen.getByText("Service Provider").closest("button");

    expect(customerBtn).toHaveClass("active");
    expect(providerBtn).not.toHaveClass("active");

    fireEvent.click(providerBtn);
    expect(providerBtn).toHaveClass("active");
    expect(customerBtn).not.toHaveClass("active");
  });

  it("displays password strength indicator when typing password", () => {
    renderRegister();
    const pwdInput = screen.getByLabelText(/^Password/i);
    fireEvent.change(pwdInput, { target: { value: "Secret@12345" } });
    expect(screen.getByText(/Strong password/i)).toBeInTheDocument();
  });

  it("renders the submit button and login prompt", () => {
    renderRegister();
    expect(screen.getByRole("button", { name: /Create Account/i })).toBeInTheDocument();
    expect(screen.getByText(/Already have an account\?/i)).toBeInTheDocument();
  });
});
