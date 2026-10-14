// Real API client pointing to FixIt Local Express backend

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Helper to retrieve stored auth token from localStorage
 */
function getAuthToken() {
  try {
    const directToken = localStorage.getItem('fixit_token');
    if (directToken) return directToken;

    const userRaw = localStorage.getItem('fixit_local_user');
    if (userRaw) {
      const user = JSON.parse(userRaw);
      return user?.token || null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Standard fetch wrapper with JWT and JSON handling
 */
async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || data.error || `HTTP ${response.status}: Request failed`;
    throw new Error(errorMsg);
  }

  return data;
}

// ============ AUTH ============

export async function loginRequest({ email, password }) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const token = data.token || (data.data && data.data.token);
  const user = data.user || (data.data && data.data.user);

  if (token) {
    localStorage.setItem('fixit_token', token);
    if (data.refreshToken) {
      localStorage.setItem('fixit_refresh_token', data.refreshToken);
    }
  }

  return {
    ...user,
    token,
  };
}

export async function registerRequest(form) {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: form.fullName || form.name,
      name: form.fullName || form.name,
      username: form.username,
      email: form.email,
      password: form.password,
      role: form.role,
      phone: form.phone,
      address: form.address,
      serviceId: form.serviceId,
      serviceName: form.serviceName,
      businessName: form.businessName,
      experienceYears: form.experienceYears || form.experience,
      skills: form.skills,
      serviceArea: form.serviceArea,
      city: form.city,
      serviceCategory: form.serviceCategory || form.category,
      experience: form.experienceYears || form.experience,
      bio: form.bio,
    }),
  });

  if (data.token) {
    localStorage.setItem('fixit_token', data.token);
    if (data.refreshToken) {
      localStorage.setItem('fixit_refresh_token', data.refreshToken);
    }
  }

  return {
    ...data.user,
    token: data.token,
  };
}

// ============ SERVICES & PROVIDERS ============

export async function fetchServices() {
  return await apiRequest('/services');
}

export async function fetchProviders() {
  return await apiRequest('/providers');
}

export async function fetchProviderByName(name) {
  return await apiRequest(`/providers/${encodeURIComponent(name)}`);
}

export async function fetchServicesByProvider(name) {
  return await apiRequest(`/providers/${encodeURIComponent(name)}/services`);
}

export async function fetchProviderStats() {
  return await apiRequest('/providers/stats');
}

export async function fetchProviderServices() {
  return await apiRequest('/services');
}

export async function fetchProviderAvailability() {
  return await apiRequest('/providers/availability');
}

export async function fetchProviderDailyScheduleApi(date) {
  return await apiRequest(`/providers/availability/daily?date=${encodeURIComponent(date)}`);
}

export async function saveProviderDailyScheduleApi(data) {
  return await apiRequest('/providers/availability/daily', {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function addProviderBusyIntervalApi(data) {
  return await apiRequest('/providers/availability/busy-interval', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function deleteProviderBusyIntervalApi(intervalId, date) {
  return await apiRequest(`/providers/availability/busy-interval/${intervalId}?date=${encodeURIComponent(date)}`, {
    method: 'DELETE'
  });
}

export async function quickActionAvailabilityApi(data) {
  return await apiRequest('/providers/availability/quick-action', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function restoreDailyAvailabilityApi(date) {
  return await apiRequest(`/providers/availability/daily?date=${encodeURIComponent(date)}`, {
    method: 'DELETE'
  });
}

export async function fetchProviderSlotsApi(providerId, date, serviceDuration) {
  const durParam = serviceDuration ? `&serviceDuration=${encodeURIComponent(serviceDuration)}` : '';
  return await apiRequest(`/providers/${providerId}/availability?date=${encodeURIComponent(date)}${durParam}`);
}


// ============ BOOKINGS ============

export async function fetchBookings() {
  return await apiRequest('/bookings');
}

export async function createBookingRequest(bookingData) {
  return await apiRequest('/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  });
}

export async function cancelBookingRequest(bookingId) {
  return await apiRequest(`/bookings/${bookingId}/cancel`, {
    method: 'PATCH',
  });
}

export async function completeBookingRequest(bookingId) {
  return await apiRequest(`/bookings/${bookingId}/complete`, {
    method: 'PATCH',
  });
}

export async function rescheduleBookingRequest(bookingId, { date, time }) {
  return await apiRequest(`/bookings/${bookingId}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify({ date, time }),
  });
}

export async function acceptBookingRequest(bookingId) {
  return await apiRequest(`/bookings/${bookingId}/accept`, {
    method: 'PATCH',
  });
}

export async function rejectBookingRequest(bookingId) {
  return await apiRequest(`/bookings/${bookingId}/reject`, {
    method: 'PATCH',
  });
}

export async function startTravelRequest(bookingId) {
  return await apiRequest(`/bookings/${bookingId}/start-travel`, {
    method: 'PATCH',
  });
}

export async function markArrivedRequest(bookingId) {
  return await apiRequest(`/bookings/${bookingId}/arrived`, {
    method: 'PATCH',
  });
}

export async function startServiceRequest(bookingId) {
  return await apiRequest(`/bookings/${bookingId}/start-service`, {
    method: 'PATCH',
  });
}

// ============ REVIEWS & COMPLAINTS ============

export async function fetchReviews() {
  return await apiRequest('/reviews');
}

export async function createReview(data) {
  return await apiRequest('/reviews', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchComplaints() {
  return await apiRequest('/complaints');
}

export async function createComplaint(data) {
  return await apiRequest('/complaints', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ NOTIFICATIONS ============

export async function fetchNotifications() {
  return await apiRequest('/notifications');
}

// ============ WALLET ============

export async function fetchWallet() {
  return await apiRequest('/wallet');
}

export async function topUpWallet(amount, method) {
  return await apiRequest('/wallet/topup', {
    method: 'POST',
    body: JSON.stringify({ amount, method }),
  });
}

// ============ CATEGORIES & ADMIN ============

export async function fetchCategories() {
  return await apiRequest('/categories');
}

export async function fetchAdminStats() {
  const res = await apiRequest('/admin/stats');
  return res?.data || res;
}

export async function fetchPlatformUsers() {
  const res = await apiRequest('/admin/users');
  return res?.data || res;
}

export async function fetchProviderApplications() {
  const res = await apiRequest('/admin/provider-applications');
  const rawList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
  return rawList.map((p) => ({
    id: p.id,
    dbId: p.id,
    name: p.business_name || p.user?.name || p.name || "Provider",
    category: p.category || "General",
    owner: p.user?.name || "Provider",
    email: p.user?.email || "",
    phone: p.user?.phone || "",
    appliedOn: p.created_at ? new Date(p.created_at).toLocaleDateString() : (p.appliedOn || "Recent"),
    status: p.verification_status === "verified" || p.is_approved ? "Approved" : (p.verification_status === "rejected" ? "Rejected" : "Pending")
  }));
}

export async function fetchReportTypes() {
  const res = await apiRequest('/admin/report-types');
  return res?.data || res;
}

export async function generateReport(reportTypeId) {
  return await apiRequest('/admin/reports', {
    method: 'POST',
    body: JSON.stringify({ reportTypeId }),
  });
}

// ============ RECENTLY ACCESSED ============

export async function fetchRecentlyAccessed(limit = 10) {
  const res = await apiRequest(`/recently-accessed?limit=${limit}`);
  return res?.data || res || [];
}

export async function recordRecentlyAccessed(itemType, itemId, metadata = {}) {
  const res = await apiRequest('/recently-accessed', {
    method: 'POST',
    body: JSON.stringify({ itemType, itemId, metadata }),
  });
  return res?.data || res;
}

export async function clearRecentlyAccessed(id = null) {
  const endpoint = id ? `/recently-accessed/${id}` : '/recently-accessed';
  return await apiRequest(endpoint, {
    method: 'DELETE',
  });
}

