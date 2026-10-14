// Fake backend — every function returns a Promise, just like a real fetch() would.
// Replace the internals with real API calls (e.g. fetch("/api/...")) when you build the backend.

const delay = (data, ms = 350) => new Promise((resolve) => setTimeout(() => resolve(data), ms));

// ============ AUTH (mock) ============
// A handful of ready-to-use demo accounts, plus anything registered at runtime
// (persisted separately from the "logged in" user so registering doesn't log you
// in as a different session by accident)
const SEED_ACCOUNTS = [
  { name: "Santhiya M", email: "santhiyam0603@gmail.com", password: "Password@123", role: "admin", joinedDate: "2025-01-01" },
  { name: "Radha", email: "radha@gmail.com", password: "Password@123", role: "customer", joinedDate: "2026-01-15" },
  { name: "Arun Kumar", email: "arun@gmail.com", password: "Password@123", role: "provider", verified: true, category: "Home Appliances", experience: 6, joinedDate: "2025-10-01" },
  { name: "Priya Ramesh", email: "priya@gmail.com", password: "Password@123", role: "provider", verified: true, category: "Cleaning", experience: 5, joinedDate: "2025-08-02" },
  { name: "Riyas Mohamed", email: "riyas@gmail.com", password: "Password@123", role: "provider", verified: true, category: "Plumbing", experience: 7, joinedDate: "2025-09-18" },
  { name: "Yaazh S", email: "yaazh@gmail.com", password: "Password@123", role: "provider", verified: true, category: "Electrical", experience: 9, joinedDate: "2025-06-14" },
  { name: "Deva R", email: "deva@gmail.com", password: "Password@123", role: "provider", verified: true, category: "Home Care", experience: 8, joinedDate: "2025-05-11" },
  { name: "Siva K", email: "siva@gmail.com", password: "Password@123", role: "provider", verified: true, category: "Carpentry", experience: 10, joinedDate: "2025-04-12" },
];
const REGISTERED_USERS_KEY = "fixit_local_registered_users";
export const PLATFORM_USERS_KEY = "fixit_local_platform_users";
export const PROVIDER_APPLICATIONS_KEY = "fixit_local_provider_applications";

export function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRegisteredUsers(list) {
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(list));
  } catch {
    // storage full or unavailable — fail silently
  }
}

export function getStoredPlatformUsers() {
  try {
    const raw = localStorage.getItem(PLATFORM_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.some((u) => u.email === "provider@fixit.com" || u.name?.includes("Kumar Cooling"))) {
        localStorage.setItem(PLATFORM_USERS_KEY, JSON.stringify(PLATFORM_USERS));
        return PLATFORM_USERS;
      }
      return parsed;
    }
    return PLATFORM_USERS;
  } catch {
    return PLATFORM_USERS;
  }
}

export function saveStoredPlatformUsers(list) {
  try {
    localStorage.setItem(PLATFORM_USERS_KEY, JSON.stringify(list));
  } catch {
    // fail silently
  }
}

export function getStoredProviderApplications() {
  try {
    const raw = localStorage.getItem(PROVIDER_APPLICATIONS_KEY);
    return raw ? JSON.parse(raw) : PROVIDER_APPLICATIONS;
  } catch {
    return PROVIDER_APPLICATIONS;
  }
}

export function saveStoredProviderApplications(list) {
  try {
    localStorage.setItem(PROVIDER_APPLICATIONS_KEY, JSON.stringify(list));
  } catch {
    // fail silently
  }
}

/**
 * Simulates POST /api/auth/login. Resolves with the user (no password field)
 * or rejects with an Error whose .message is safe to show in the UI.
 */
export function loginRequest({ email, password }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const allAccounts = [...SEED_ACCOUNTS, ...getRegisteredUsers()];
      const match = allAccounts.find((u) => u.email.toLowerCase() === email.toLowerCase());

      if (!match) return reject(new Error("No account found with this email."));

      const isTestAcc = ['santhiyam0603@gmail.com', 'radha@gmail.com', 'arun@gmail.com', 'priya@gmail.com', 'riyas@gmail.com', 'yaazh@gmail.com', 'deva@gmail.com', 'siva@gmail.com'].includes(match.email.toLowerCase());
      const passOk = match.password === password || (isTestAcc && (password === 'Password@123' || password === 'password123' || password === '123456'));
      if (!passOk) return reject(new Error("Incorrect password."));

      // Check if user is suspended in platform users
      const platformUsers = getStoredPlatformUsers();
      const pMatch = platformUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (pMatch && pMatch.status === "Suspended") {
        return reject(new Error("Your account has been suspended. Please contact the administrator."));
      }

      const { password: _pw, ...safeUser } = match;
      resolve(safeUser);
    }, 300);
  });
}

/**
 * Simulates POST /api/auth/register. Resolves with the new user (no password field)
 * or rejects with an Error (e.g. duplicate email).
 */
export function registerRequest(form) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const allAccounts = [...SEED_ACCOUNTS, ...getRegisteredUsers()];
      if (allAccounts.some((u) => u.email.toLowerCase() === form.email.toLowerCase())) {
        return reject(new Error("An account with this email already exists."));
      }

      const newUser = {
        name: form.fullName,
        username: form.username,
        email: form.email,
        phone: form.phone,
        password: form.password,
        address: form.address,
        role: form.role,
        joinedDate: new Date().toISOString().slice(0, 10),
        verified: form.role === "provider" ? true : undefined,
      };
      saveRegisteredUsers([...getRegisteredUsers(), newUser]);

      const { password: _pw, ...safeUser } = newUser;
      resolve(safeUser);
    }, 400);
  });
}

export const SERVICES = [
  { id: 1, name: "AC Repair & Service", title: "AC Repair & Service", provider: "Arun AC Care & Service", providerName: "Arun Kumar", providerEmail: "arun@gmail.com", price: 599, category: "Home Appliances", rating: 4.8, duration: "45–60 min", status: "Active" },
  { id: 2, name: "Plumbing Fix", title: "Plumbing Fix", provider: "Riyas Plumbing Solutions", providerName: "Riyas Mohamed", providerEmail: "riyas@gmail.com", price: 299, category: "Plumbing", rating: 4.7, duration: "30–45 min", status: "Active" },
  { id: 3, name: "Electrical Wiring", title: "Electrical Wiring", provider: "Yaazh Electrical Works", providerName: "Yaazh S", providerEmail: "yaazh@gmail.com", price: 349, category: "Electrical", rating: 4.9, duration: "1–2 hrs", status: "Active" },
  { id: 4, name: "Deep Home Cleaning", title: "Deep Home Cleaning", provider: "Priya Deep Home Cleaning", providerName: "Priya Ramesh", providerEmail: "priya@gmail.com", price: 1999, category: "Cleaning", rating: 4.9, duration: "4–6 hrs", status: "Active" },
  { id: 7, name: "Pest Control", title: "Pest Control", provider: "Deva Pest Care Solutions", providerName: "Deva R", providerEmail: "deva@gmail.com", price: 899, category: "Home Care", rating: 4.8, duration: "1–2 hrs", status: "Active" },
  { id: 8, name: "Carpentry Work", title: "Carpentry Work", provider: "Siva Carpentry Works", providerName: "Siva K", providerEmail: "siva@gmail.com", price: 449, category: "Carpentry", rating: 4.7, duration: "1–2 hrs", status: "Active" },
];

export const PROVIDERS = [
  { name: "Arun AC Care & Service", providerName: "Arun Kumar", email: "arun@gmail.com", category: "Home Appliances", experience: 6, verified: true, phone: "+91 98765 00001", bio: "Certified AC and appliances repair specialist with genuine parts and 30-day warranty.", lat: 13.0827, lng: 80.2707, joinedDate: "2025-10-01" },
  { name: "Priya Deep Home Cleaning", providerName: "Priya Ramesh", email: "priya@gmail.com", category: "Cleaning", experience: 5, verified: true, phone: "+91 98765 00002", bio: "Deep-cleaning expert using eco-friendly products, background-checked and insured.", lat: 13.0475, lng: 80.2140, joinedDate: "2025-08-02" },
  { name: "Riyas Plumbing Solutions", providerName: "Riyas Mohamed", email: "riyas@gmail.com", category: "Plumbing", experience: 7, verified: true, phone: "+91 98765 00003", bio: "Round-the-clock plumbing repairs and pipe installations with transparent pricing.", lat: 13.0067, lng: 80.2206, joinedDate: "2025-09-18" },
  { name: "Yaazh Electrical Works", providerName: "Yaazh S", email: "yaazh@gmail.com", category: "Electrical", experience: 9, verified: true, phone: "+91 98765 00004", bio: "Licensed electricians for home wiring, switchboards, MCBs, and safety inspections.", lat: 13.1143, lng: 80.2917, joinedDate: "2025-06-14" },
  { name: "Deva Pest Care Solutions", providerName: "Deva R", email: "deva@gmail.com", category: "Home Care", experience: 8, verified: true, phone: "+91 98765 00005", bio: "Odorless, family-safe pest control treatments with a 60-day revisit guarantee.", lat: 12.9906, lng: 80.2200, joinedDate: "2025-05-11" },
  { name: "Siva Carpentry Works", providerName: "Siva K", email: "siva@gmail.com", category: "Carpentry", experience: 10, verified: true, phone: "+91 98765 00006", bio: "Custom carpentry and furniture repair with precision craftsmanship.", lat: 13.0358, lng: 80.2297, joinedDate: "2025-04-12" },
];

export const BOOKINGS = [
  { id: "BK1001", customer: "Radha", provider: "Arun AC Care & Service", service: "AC Repair & Service", category: "Home Appliances", date: "Today", time: "02:00 PM", amount: "₹599", status: "On The Way", paymentStatus: "Paid", location: { lat: 13.0827, lng: 80.2707 }, address: "42 Anna Nagar, Chennai", instructions: "Ring bell twice" },
  { id: "BK1002", customer: "Radha", provider: "Yaazh Electrical Works", service: "Electrical Wiring", category: "Electrical", date: "Tomorrow", time: "10:00 AM", amount: "₹349", status: "Pending", paymentStatus: "Unpaid", location: { lat: 13.0850, lng: 80.2100 }, address: "42 Anna Nagar, Chennai" },
  { id: "BK1003", customer: "Radha", provider: "Priya Deep Home Cleaning", service: "Deep Home Cleaning", category: "Cleaning", date: "15 Jul 2026", time: "11:00 AM", amount: "₹1,999", status: "Completed", paymentStatus: "Paid", location: { lat: 13.0475, lng: 80.2140 } },
  { id: "BK1004", customer: "Radha", provider: "Riyas Plumbing Solutions", service: "Plumbing Fix", category: "Plumbing", date: "10 Jul 2026", time: "09:00 AM", amount: "₹299", status: "Completed", paymentStatus: "Paid" },
  { id: "BK1005", customer: "Radha", provider: "Deva Pest Care Solutions", service: "Pest Control", category: "Home Care", date: "05 Jul 2026", time: "01:00 PM", amount: "₹899", status: "Completed", paymentStatus: "Paid" },
  { id: "BK1006", customer: "Radha", provider: "Siva Carpentry Works", service: "Carpentry Work", category: "Carpentry", date: "01 Jul 2026", time: "03:00 PM", amount: "₹449", status: "Completed", paymentStatus: "Paid" },
];

export const NOTIFICATIONS = [
  { id: 1, recipient: "Radha", title: "Booking Confirmed", body: "Your AC Repair booking is confirmed.", unread: true, timestamp: "2026-07-24T09:14:00.000Z" },
  { id: 2, recipient: "Radha", title: "Service Assigned", body: "Technician Arun Kumar has been assigned to your booking.", unread: true, timestamp: "2026-07-24T09:20:00.000Z" },
  { id: 3, recipient: "Arun AC Care & Service", title: "New Booking Request", body: "Radha requested AC Repair & Service.", unread: true, timestamp: "2026-07-22T14:45:00.000Z" },
  { id: 4, recipient: "Santhiya M", title: "New Booking Placed", body: "Radha placed a new booking for AC Repair.", unread: true, timestamp: "2026-07-21T11:30:00.000Z" },
];

export const PROVIDER_STATS = { activeServices: 6, todaysBookings: 3, completedJobs: 180, monthlyEarnings: "₹52,400" };

export const PROVIDER_SERVICES = [
  { id: 1, name: "AC Repair & Service", category: "Home Appliances", price: "₹599", duration: "45–60 min", status: "Active" },
  { id: 2, name: "Plumbing Fix", category: "Plumbing", price: "₹299", duration: "30–45 min", status: "Active" },
  { id: 3, name: "Electrical Wiring", category: "Electrical", price: "₹349", duration: "1–2 hrs", status: "Active" },
  { id: 4, name: "Deep Home Cleaning", category: "Cleaning", price: "₹1,999", duration: "4–6 hrs", status: "Active" },
  { id: 7, name: "Pest Control", category: "Home Care", price: "₹899", duration: "1–2 hrs", status: "Active" },
  { id: 8, name: "Carpentry Work", category: "Carpentry", price: "₹449", duration: "1–2 hrs", status: "Active" },
];

export const ADMIN_STATS = { totalUsers: 8, activeProviders: 6, totalBookings: 6, revenue: "₹4,594" };

export const PROVIDER_APPLICATIONS = [];

export const CATEGORIES = [
  { id: 1, name: "Home Appliances", description: "AC, refrigerator, washing machine repair", count: 1, status: "Active" },
  { id: 2, name: "Electrical", description: "Wiring, fittings, inspections", count: 1, status: "Active" },
  { id: 3, name: "Plumbing", description: "Leak fixes, installations, drainage", count: 1, status: "Active" },
  { id: 4, name: "Cleaning", description: "Deep home and kitchen cleaning", count: 1, status: "Active" },
  { id: 5, name: "Home Care", description: "Pest control and hygiene treatments", count: 1, status: "Active" },
  { id: 6, name: "Carpentry", description: "Woodcraft, lock fittings, and cabinetry", count: 1, status: "Active" },
];

export const COMPLAINTS = [];

export const REVIEWS = [
  { id: "RV1001", bookingId: "BK1003", customer: "Radha", provider: "Priya Deep Home Cleaning", service: "Deep Home Cleaning", rating: 5, comment: "Spotless job, arrived on time and very professional.", date: "16 Jul 2026" },
  { id: "RV1002", bookingId: "BK1004", customer: "Radha", provider: "Riyas Plumbing Solutions", service: "Plumbing Fix", rating: 5, comment: "Fixed the leak quickly, fair pricing.", date: "11 Jul 2026" },
  { id: "RV1003", bookingId: "BK1005", customer: "Radha", provider: "Deva Pest Care Solutions", service: "Pest Control", rating: 4, comment: "Good service, odorless spray.", date: "06 Jul 2026" },
  { id: "RV1004", bookingId: "BK1006", customer: "Radha", provider: "Siva Carpentry Works", service: "Carpentry Work", rating: 5, comment: "Fixed my door lock and kitchen cabinet smoothly.", date: "02 Jul 2026" },
];

export const PROVIDER_AVAILABILITY = [
  { day: "Monday", slots: ["09:00 AM - 01:00 PM", "03:00 PM - 07:00 PM"] },
  { day: "Tuesday", slots: ["09:00 AM - 01:00 PM"] },
  { day: "Wednesday", slots: [] },
  { day: "Thursday", slots: ["11:00 AM - 06:00 PM"] },
  { day: "Friday", slots: ["09:00 AM - 01:00 PM", "03:00 PM - 07:00 PM"] },
  { day: "Saturday", slots: ["10:00 AM - 04:00 PM"] },
  { day: "Sunday", slots: [] },
];

export const PLATFORM_USERS = [
  { id: 13, name: "Santhiya M", email: "santhiyam0603@gmail.com", role: "admin", status: "Active", joined: "01 Jan 2025" },
  { id: 8, name: "Radha", email: "radha@gmail.com", role: "customer", status: "Active", joined: "15 Jan 2026" },
  { id: 14, name: "Arun AC Care & Service", email: "arun@gmail.com", role: "provider", status: "Active", joined: "01 Oct 2025" },
  { id: 15, name: "Priya Deep Home Cleaning", email: "priya@gmail.com", role: "provider", status: "Active", joined: "02 Aug 2025" },
  { id: 16, name: "Riyas Plumbing Solutions", email: "riyas@gmail.com", role: "provider", status: "Active", joined: "18 Sep 2025" },
  { id: 17, name: "Yaazh Electrical Works", email: "yaazh@gmail.com", role: "provider", status: "Active", joined: "14 Jun 2025" },
  { id: 18, name: "Deva Pest Care Solutions", email: "deva@gmail.com", role: "provider", status: "Active", joined: "11 May 2025" },
  { id: 19, name: "Siva Carpentry Works", email: "siva@gmail.com", role: "provider", status: "Active", joined: "12 Apr 2025" },
];

export const WALLET_SEED_TRANSACTIONS = [
  { id: "WT1001", type: "credit", amount: 2000, note: "Wallet top-up via UPI", date: "01 Jul 2026" },
  { id: "WT1002", type: "debit", amount: 499, note: "Payment for Plumbing Fix (BK1035)", date: "15 Jul 2026" },
  { id: "WT1003", type: "credit", amount: 500, note: "Refund for cancelled booking", date: "09 Jul 2026" },
];

export const REPORT_TYPES = [
  { id: "revenue", name: "Revenue Report", description: "Monthly platform revenue broken down by category.", icon: "📊" },
  { id: "bookings", name: "Bookings Report", description: "Booking volume, completion and cancellation rates.", icon: "📅" },
  { id: "users", name: "User Growth Report", description: "New signups by role over the selected period.", icon: "👤" },
  { id: "complaints", name: "Complaints Report", description: "Complaint volume and resolution turnaround.", icon: "⚠️" },
];

export function fetchServices() { return delay(SERVICES); }
export function fetchProviders() { return delay(PROVIDERS); }
export function fetchProviderByName(name) {
  return delay(PROVIDERS.find((p) => p.name === name) || null);
}
export function fetchServicesByProvider(name) {
  return delay(SERVICES.filter((s) => s.provider === name));
}
export async function fetchBookings() {
  try {
    const token = localStorage.getItem("fixit_local_auth_token") || localStorage.getItem("token");
    if (token) {
      const res = await fetch("http://localhost:5000/api/bookings", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        if (Array.isArray(data) && data.length > 0) {
          return data.map(b => ({
            id: b.booking_number || `BK${b.id}`,
            dbId: b.id,
            customerId: b.customer_id,
            customer_id: b.customer_id,
            customer: b.customer?.name || "Customer",
            customerEmail: b.customer?.email,
            providerId: b.provider_id,
            provider_id: b.provider_id,
            provider: b.providerProfile?.business_name || b.provider?.name || "Provider",
            providerEmail: b.provider?.email,
            serviceId: b.service_id,
            service: b.service_title || b.service?.title || "Service",
            category: b.category,
            date: b.date,
            time: b.time,
            amount: `₹${b.amount}`,
            rawAmount: b.amount,
            status: b.status === "pending" ? "Pending" : (b.status === "confirmed" ? "Confirmed" : (b.status === "accepted" ? "Confirmed" : (b.status === "on_the_way" ? "On The Way" : (b.status === "arrived" ? "Arrived" : (b.status === "in_progress" ? "Service Started" : (b.status === "completed" ? "Completed" : (b.status === "cancelled" ? "Cancelled" : b.status))))))),
            paymentStatus: b.payment_status === "paid" ? "Paid" : "Unpaid",
            paymentMethod: b.payment_method,
            address: typeof b.address === "string" ? b.address : `${b.address?.street || ""}, ${b.address?.city || ""}`,
            location: b.provider_location,
            serviceLocation: b.service_location,
            instructions: b.customer_notes || b.problem_description,
            problemDescription: b.problem_description,
            mediaAttachments: b.media_attachments,
            additionalCharges: b.additional_charges,
            timeline: b.status_timeline
          }));
        }
      }
    }
  } catch {
    // fallback
  }
  return delay(BOOKINGS);
}
export function fetchNotifications() { return delay(NOTIFICATIONS); }
export function fetchProviderStats() { return delay(PROVIDER_STATS); }
export function fetchProviderServices() { return delay(PROVIDER_SERVICES); }
export function fetchAdminStats() { return delay(ADMIN_STATS); }
export function fetchProviderApplications() { return delay(getStoredProviderApplications()); }
export function fetchCategories() { return delay(CATEGORIES); }
export function fetchComplaints() { return delay(COMPLAINTS); }
export function fetchReviews() { return delay(REVIEWS); }
export function fetchProviderAvailability() { return delay(PROVIDER_AVAILABILITY); }
export function fetchPlatformUsers() { return delay(getStoredPlatformUsers()); }

/** Simulates POST /api/complaints — a customer raising a real complaint. */
export function createComplaint(data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!data?.type || !data?.description) {
        return reject(new Error("Please select a type and describe the issue."));
      }
      resolve({
        id: `C${Math.floor(1000 + Math.random() * 9000)}`,
        raisedBy: data.raisedBy,
        type: data.type,
        against: data.against,
        description: data.description,
        date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        status: "Open",
      });
    }, 500);
  });
}

/** Simulates POST /api/reviews — a customer reviewing a completed booking. */
export async function createReview(data) {
  if (!data?.rating) {
    throw new Error("Please choose a star rating.");
  }
  try {
    const token = localStorage.getItem("fixit_local_auth_token") || localStorage.getItem("token");
    if (token && data.bookingId) {
      const numericId = typeof data.bookingId === 'number' ? data.bookingId : (data.dbId || (String(data.bookingId).match(/\d+/)?.[0]));
      await fetch("http://localhost:5000/api/reviews", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bookingId: numericId ? Number(numericId) : data.bookingId,
          rating: data.rating,
          comment: data.comment || ""
        })
      });
    }
  } catch {
    // fallback
  }
  return {
    id: `RV${Date.now()}`,
    bookingId: data.bookingId,
    customer: data.customer,
    provider: data.provider,
    service: data.service,
    rating: data.rating,
    comment: data.comment || "",
    date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
  };
}

/**
 * Simulates POST /api/bookings — creates a new booking and returns it with
 * a generated ID and Pending status. This is the single source every role
 * (customer/provider/admin) now reads from via BookingContext.
 */
export function createBookingRequest(bookingData) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!bookingData?.date) {
        return reject(new Error("Please choose a service date before confirming."));
      }
      resolve({
        id: `BK${Math.floor(1000 + Math.random() * 9000)}`,
        customer: bookingData.customer,
        service: bookingData.serviceName,
        provider: bookingData.provider,
        category: bookingData.category,
        date: bookingData.date,
        time: bookingData.time,
        amount: bookingData.amount,
        instructions: bookingData.instructions,
        address: bookingData.address || null,
        // Exact GPS point the customer optionally shares at booking time —
        // shown to the provider as a scannable QR code (see LocationQR)
        // instead of relying on a typed address, which can be vague or wrong.
        location: bookingData.location || null,
        status: "Pending",
        paymentMethod: bookingData.payment,
        paymentStatus: bookingData.payment === "cash" ? "Unpaid" : "Paid",
      });
    }, 600);
  });
}

/** Simulates PATCH /api/bookings/:id/cancel */
export function cancelBookingRequest(bookingId) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ id: bookingId, status: "Cancelled" }), 500);
  });
}

/** Simulates PATCH /api/bookings/:id/complete */
/** Simulates PATCH /api/bookings/:id/complete */
export function completeBookingRequest(bookingId) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ id: bookingId, status: "Completed" }), 500);
  });
}

/** Simulates PATCH /api/bookings/:id/reschedule — customer picks a new date/time */
export function rescheduleBookingRequest(bookingId, { date, time }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!date || !time) return reject(new Error("Please choose both a date and a time slot."));
      resolve({ id: bookingId, date, time });
    }, 500);
  });
}

/** Simulates PATCH /api/bookings/:id/accept — a provider accepting a request */
export function acceptBookingRequest(bookingId) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ id: bookingId, status: "Confirmed" }), 500);
  });
}

/** Simulates PATCH /api/bookings/:id/reject — a provider declining a request */
export function rejectBookingRequest(bookingId) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ id: bookingId, status: "Rejected" }), 500);
  });
}

/**
 * The three intermediate lifecycle stages between a provider accepting a
 * job and marking it complete. Previously the booking status machine
 * jumped straight from Confirmed to Completed with nothing in between —
 * these fill that gap so a booking's status genuinely reflects where the
 * provider is: en route, on-site, or actively working.
 */

/** Simulates PATCH /api/bookings/:id/start-travel — provider begins heading to the customer */
export function startTravelRequest(bookingId) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ id: bookingId, status: "On The Way" }), 500);
  });
}

/** Simulates PATCH /api/bookings/:id/arrived — provider has reached the location */
export function markArrivedRequest(bookingId) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ id: bookingId, status: "Arrived" }), 500);
  });
}

/** Simulates PATCH /api/bookings/:id/start-service — provider begins the actual work */
export function startServiceRequest(bookingId) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ id: bookingId, status: "Service Started" }), 500);
  });
}

export function fetchReportTypes() { return delay(REPORT_TYPES); }

/**
 * Simulates GET /api/wallet — every user (matched by name, same convention
 * as bookings/notifications) starts with the same demo seed balance/history
 * the first time they're seen.
 */
export function fetchWallet() {
  return delay({ balance: 2001, transactions: WALLET_SEED_TRANSACTIONS });
}

/** Simulates POST /api/wallet/topup */
export function topUpWallet(amount, method) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!amount || amount <= 0) {
        return reject(new Error("Enter a valid amount to add."));
      }
      resolve({
        id: `WT${Date.now()}`,
        amount,
        note: method ? `Wallet top-up via ${method}` : "Wallet top-up",
        date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      });
    }, 500);
  });
}

/**
 * Simulates POST /api/admin/reports — "generates" a report server-side and
 * returns a Report + File-style reference (mirrors the Report/File entities
 * from the original class diagram).
 */
export function generateReport(reportTypeId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const now = new Date();
      resolve({
        id: `RPT-${now.getTime()}`,
        reportTypeId,
        generatedDate: now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        fileName: `${reportTypeId}-report-${now.getTime()}.csv`,
      });
    }, 700);
  });
}
