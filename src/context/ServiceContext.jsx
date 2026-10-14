import { createContext, useCallback, useEffect } from "react";
import { usePersistentReducer } from "../hooks/usePersistentReducer";
import apiClient from "../api/apiClient";

export const ServiceContext = createContext(null);

const SERVICES_KEY = "fixit_local_services";
const CATEGORIES_KEY = "fixit_local_categories";

const LEGACY_MOCK_PROVIDERS = [
  "Kumar Cooling Co.",
  "SparkleHome",
  "QuickFix Plumbers",
  "PowerLine Services",
  "SafeHome Pest Care",
  "WoodCraft Experts",
];

const DEFAULT_CATEGORIES = [
  { id: 1, name: "Electrician", description: "Switchboard repairs, wiring, fan & MCB installation", count: 5, status: "Active" },
  { id: 2, name: "Plumber", description: "Water leak fixes, pipe fittings & tap replacements", count: 3, status: "Active" },
  { id: 3, name: "Carpenter", description: "Furniture repair, door latch & woodwork assembly", count: 2, status: "Active" },
  { id: 4, name: "AC Repair", description: "AC Installation, Uninstallation & Deep Jet Cleaning", count: 3, status: "Active" },
  { id: 5, name: "Cleaning", description: "Deep home cleaning, kitchen & bathroom sanitation", count: 3, status: "Active" },
  { id: 6, name: "Painting", description: "Interior & exterior wall painting & waterproofing", count: 1, status: "Active" },
  { id: 7, name: "Appliance Repair", description: "Washing machine, refrigerator & microwave repair", count: 1, status: "Active" },
  { id: 8, name: "Pest Control", description: "Termite, cockroach, bed bug & rodent treatment", count: 1, status: "Active" },
  { id: 9, name: "Gardening", description: "Lawn mowing, hedge trimming & plant maintenance", count: 1, status: "Active" },
];

const DEFAULT_CATALOG_SERVICES = [
  { id: 1, name: "AC Repair & Service", title: "AC Repair & Service", category: "AC Repair", price: 599, rating: 4.8, duration: "45–60 min", status: "Active" },
  { id: 2, name: "Plumbing Fix", title: "Plumbing Fix", category: "Plumber", price: 299, rating: 4.7, duration: "30–45 min", status: "Active" },
  { id: 3, name: "Electrical Wiring", title: "Electrical Wiring", category: "Electrician", price: 349, rating: 4.9, duration: "45–60 min", status: "Active" },
  { id: 4, name: "Deep Home Cleaning", title: "Deep Home Cleaning", category: "Cleaning", price: 1999, rating: 4.8, duration: "2–3 hours", status: "Active" },
  { id: 5, name: "Wall Painting & Touchup", title: "Wall Painting & Touchup", category: "Painting", price: 3499, rating: 4.7, duration: "3–4 hours", status: "Active" },
  { id: 6, name: "Washing Machine Diagnosis & Fix", title: "Washing Machine Diagnosis & Fix", category: "Appliance Repair", price: 399, rating: 4.7, duration: "45–60 min", status: "Active" },
  { id: 7, name: "Pest Control", title: "Pest Control", category: "Pest Control", price: 899, rating: 4.8, duration: "1–2 hours", status: "Active" },
  { id: 8, name: "Carpentry Work", title: "Carpentry Work", category: "Carpenter", price: 449, rating: 4.8, duration: "1–2 hours", status: "Active" },
  { id: 9, name: "Gardening & Lawn Care", title: "Gardening & Lawn Care", category: "Gardening", price: 499, rating: 4.8, duration: "1–2 hours", status: "Active" },
];

function getSanitizedInitialServices() {
  try {
    const raw = localStorage.getItem(SERVICES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed.filter((s) => !LEGACY_MOCK_PROVIDERS.includes(s.provider));
        if (filtered.length > 0) return filtered;
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_CATALOG_SERVICES;
}

function servicesReducer(state, action) {
  switch (action.type) {
    case "SET":
      return Array.isArray(action.payload) ? action.payload : [];
    case "ADD":
      return [action.payload, ...state];
    case "UPDATE":
      return state.map((s) => (s.id === action.payload.id ? { ...s, ...action.payload.updates } : s));
    case "DELETE":
      return state.filter((s) => s.id !== action.id);
    case "TOGGLE_STATUS":
      return state.map((s) => (s.id === action.id ? { ...s, status: s.status === "Active" ? "Inactive" : "Active" } : s));
    default:
      return state;
  }
}

function categoriesReducer(state, action) {
  switch (action.type) {
    case "SET":
      return Array.isArray(action.payload) ? action.payload : [];
    case "ADD":
      return [...state, action.payload];
    case "DELETE":
      return state.filter((c) => c.id !== action.id);
    default:
      return state;
  }
}

export function ServiceProvider({ children }) {
  const [services, dispatchServices, servicesHydrated] = usePersistentReducer(
    servicesReducer,
    getSanitizedInitialServices(),
    SERVICES_KEY,
    () => getSanitizedInitialServices()
  );

  const [categories, dispatchCategories, categoriesHydrated] = usePersistentReducer(
    categoriesReducer,
    DEFAULT_CATEGORIES,
    CATEGORIES_KEY,
    () => DEFAULT_CATEGORIES
  );

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get("/services")
      .then((res) => {
        const data = res?.data?.data || res?.data;
        if (isMounted && Array.isArray(data)) {
          dispatchServices({ type: "SET", payload: data });
        }
      })
      .catch(() => {});

    apiClient
      .get("/services/categories")
      .then((res) => {
        const data = res?.data?.data || res?.data;
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const formatted = data.map((c, idx) => ({
            id: idx + 1,
            name: c.name || c.category || c,
            description: c.description || "—",
            count: Number(c.count) || 0,
            status: "Active",
          }));
          dispatchCategories({ type: "SET", payload: formatted });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [dispatchServices, dispatchCategories]);

  const addService = useCallback((serviceData) => {
    const newService = {
      id: serviceData.id || Date.now(),
      name: serviceData.name,
      provider: serviceData.provider,
      price: Number(serviceData.price) || 0,
      category: serviceData.category || "General",
      rating: serviceData.rating || 5,
      duration: serviceData.duration || "45–60 min",
      status: "Active",
      ...serviceData,
    };
    dispatchServices({ type: "ADD", payload: newService });
    return newService;
  }, [dispatchServices]);

  const updateService = useCallback((id, updates) => {
    dispatchServices({ type: "UPDATE", payload: { id, updates } });
  }, [dispatchServices]);

  const deleteService = useCallback((id) => {
    dispatchServices({ type: "DELETE", id });
  }, [dispatchServices]);

  const toggleServiceStatus = useCallback((id) => {
    dispatchServices({ type: "TOGGLE_STATUS", id });
  }, [dispatchServices]);

  const addCategory = useCallback((name, description = "—") => {
    if (!name?.trim()) return null;
    const newCat = {
      id: Date.now(),
      name: name.trim(),
      description: description.trim() || "—",
      count: 0,
      status: "Active",
    };
    dispatchCategories({ type: "ADD", payload: newCat });
    return newCat;
  }, [dispatchCategories]);

  const deleteCategory = useCallback((id) => {
    dispatchCategories({ type: "DELETE", id });
  }, [dispatchCategories]);

  const hydrated = servicesHydrated && categoriesHydrated;

  return (
    <ServiceContext.Provider
      value={{
        services,
        categories,
        hydrated,
        addService,
        updateService,
        deleteService,
        toggleServiceStatus,
        addCategory,
        deleteCategory,
      }}
    >
      {children}
    </ServiceContext.Provider>
  );
}
