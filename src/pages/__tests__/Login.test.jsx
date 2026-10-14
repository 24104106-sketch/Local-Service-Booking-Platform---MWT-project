import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "../Login";
import { UserProvider } from "../../context/UserContext";
import { ToastProvider } from "../../context/ToastContext";
import * as useAuthHook from "../../hooks/useAuth";

function renderLogin(customLoginFn) {
  if (customLoginFn) {
    vi.spyOn(useAuthHook, "useAuth").mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: "",
      login: customLoginFn,
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      clearError: vi.fn(),
    });
  }

  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <UserProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/customer/dashboard" element={<div>Customer Dashboard Page</div>} />
            <Route path="/provider/dashboard" element={<div>Provider Dashboard Page</div>} />
            <Route path="/admin/dashboard" element={<div>Admin Dashboard Page</div>} />
          </Routes>
        </ToastProvider>
      </UserProvider>
    </MemoryRouter>
  );
}

describe("Login Component — Automatic Role Detection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders email and password inputs without role selection cards or 'Continue as'", () => {
    renderLogin();

    // Verify email and password inputs exist
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Login/i })).toBeInTheDocument();

    // Verify role selection elements are NOT present
    expect(screen.queryByText(/Continue as/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Customer")).not.toBeInTheDocument();
    expect(screen.queryByText("Service Provider")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("authenticates and redirects customer to /customer/dashboard automatically", async () => {
    const mockLogin = vi.fn().mockResolvedValue({
      id: 1,
      name: "Radha",
      email: "radha@gmail.com",
      role: "customer",
    });

    renderLogin(mockLogin);

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: "radha@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: "Password@123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Login/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "radha@gmail.com",
        password: "Password@123",
      });
      expect(screen.getByText("Customer Dashboard Page")).toBeInTheDocument();
    });
  });

  it("authenticates and redirects provider to /provider/dashboard automatically", async () => {
    const mockLogin = vi.fn().mockResolvedValue({
      id: 2,
      name: "Arun Kumar",
      email: "arun@gmail.com",
      role: "provider",
    });

    renderLogin(mockLogin);

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: "arun@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: "Password@123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Login/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "arun@gmail.com",
        password: "Password@123",
      });
      expect(screen.getByText("Provider Dashboard Page")).toBeInTheDocument();
    });
  });

  it("authenticates and redirects admin to /admin/dashboard automatically", async () => {
    const mockLogin = vi.fn().mockResolvedValue({
      id: 3,
      name: "Santhiya M",
      email: "santhiyam0603@gmail.com",
      role: "admin",
    });

    renderLogin(mockLogin);

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: "santhiyam0603@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: "Password@123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Login/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "santhiyam0603@gmail.com",
        password: "Password@123",
      });
      expect(screen.getByText("Admin Dashboard Page")).toBeInTheDocument();
    });
  });
});
