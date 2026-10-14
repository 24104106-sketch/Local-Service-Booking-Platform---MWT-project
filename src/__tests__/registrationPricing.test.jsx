import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Register from "../pages/Register";

// Mock AuthContext
const mockRegister = vi.fn();
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    register: mockRegister,
    loading: false,
    error: null,
  }),
}));

// Mock ToastContext
vi.mock("../hooks/useToast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

// Mock Translation
vi.mock("../hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

describe("Provider Registration & Pricing Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderRegister = () => {
    return render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>
    );
  };

  it("does not show any hardcoded service prices on provider registration", async () => {
    renderRegister();

    // Switch to Provider tab
    const providerCard = screen.getByText("Service Provider");
    fireEvent.click(providerCard);

    // Verify "Primary Service Category" is present
    expect(screen.getByLabelText(/Primary Service Category/i)).toBeInTheDocument();

    // Verify no hardcoded service prices are present anywhere on screen
    const rawBodyText = document.body.textContent;
    expect(rawBodyText).not.toContain("₹899");
    expect(rawBodyText).not.toContain("₹449");
    expect(rawBodyText).not.toContain("₹599");
    expect(rawBodyText).not.toContain("₹299");
    expect(rawBodyText).not.toContain("₹349");
    expect(rawBodyText).not.toContain("₹1999");
  });

  it("contains all required primary categories in the dropdown", async () => {
    renderRegister();

    const providerCard = screen.getByText("Service Provider");
    fireEvent.click(providerCard);

    const categorySelect = screen.getByLabelText(/Primary Service Category/i);
    expect(categorySelect).toBeInTheDocument();

    const expectedCategories = [
      "Electrician",
      "Plumber",
      "AC Repair",
      "Carpenter",
      "Cleaning",
      "Pest Control",
      "Appliance Repair",
      "Painting",
      "Other",
    ];

    expectedCategories.forEach((cat) => {
      expect(screen.getByRole("option", { name: cat })).toBeInTheDocument();
    });
  });

  it("dynamically shows service checkboxes when a primary category is selected", async () => {
    renderRegister();

    const providerCard = screen.getByText("Service Provider");
    fireEvent.click(providerCard);

    const categorySelect = screen.getByLabelText(/Primary Service Category/i);

    // Select "Electrician"
    fireEvent.change(categorySelect, { target: { value: "Electrician" } });

    // Should display services relevant to electrician
    expect(screen.getByText("Electrical Wiring")).toBeInTheDocument();
    expect(screen.getByText("Fan Installation")).toBeInTheDocument();
    expect(screen.getByText("Light Installation")).toBeInTheDocument();

    // Now switch to "Plumber"
    fireEvent.change(categorySelect, { target: { value: "Plumber" } });

    // Should now display plumbing services
    expect(screen.getByText("Pipe Repair")).toBeInTheDocument();
    expect(screen.getByText("Tap Repair")).toBeInTheDocument();
  });

  it("allows selecting multiple services and adding custom services", async () => {
    renderRegister();

    const providerCard = screen.getByText("Service Provider");
    fireEvent.click(providerCard);

    const categorySelect = screen.getByLabelText(/Primary Service Category/i);
    fireEvent.change(categorySelect, { target: { value: "Electrician" } });

    // Select first service
    const wiringCheckbox = screen.getByText("Electrical Wiring");
    fireEvent.click(wiringCheckbox);

    // Select second service
    const fanCheckbox = screen.getByText("Fan Installation");
    fireEvent.click(fanCheckbox);

    // Verify counter shows 2 selected
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    // Add a custom service
    const customInput = screen.getByPlaceholderText(/Add another Electrician service/i);
    const addButton = screen.getByText("+ Add");

    fireEvent.change(customInput, { target: { value: "Solar Inverter Wiring" } });
    fireEvent.click(addButton);

    // Solar Inverter Wiring should now appear
    expect(screen.getByText("Solar Inverter Wiring")).toBeInTheDocument();
    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("validates that at least one service must be selected for provider registration", async () => {
    renderRegister();

    const providerCard = screen.getByText("Service Provider");
    fireEvent.click(providerCard);

    // Fill common fields
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Ramesh Sharma" } });
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: "ramesh123" } });
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: "ramesh@example.com" } });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: "9840123456" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "Password123" } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "Password123" } });

    // Submit form without selecting category
    const submitButton = screen.getByRole("button", { name: /Create Account/i });
    fireEvent.submit(submitButton.closest("form"));

    expect(screen.getByText("Please select your primary service category.")).toBeInTheDocument();

    // Select category but no service checkboxes
    const categorySelect = screen.getByLabelText(/Primary Service Category/i);
    fireEvent.change(categorySelect, { target: { value: "Electrician" } });

    fireEvent.submit(submitButton.closest("form"));
    expect(screen.getByText("Please select at least one service you provide.")).toBeInTheDocument();
  });
});
