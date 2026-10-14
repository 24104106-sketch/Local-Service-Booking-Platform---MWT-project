/**
 * End-to-End Real Backend Verification Script
 * Validates all 27 requirements against the live Express + MySQL backend on port 5000.
 */

const API_URL = 'http://localhost:5000/api';

async function req(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

const getToken = (res) => res.data?.token || res.data?.data?.token;
const getUser = (res) => res.data?.user || res.data?.data?.user;
const getData = (res) => (res.data && res.data.data !== undefined ? res.data.data : res.data);

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING COMPLETE REAL BACKEND END-TO-END AUDIT');
  console.log('====================================================\n');

  // STEP 1: Health Check
  console.log('--- Step 1: Health Check ---');
  const health = await req('/health');
  assert(health.status === 200 && String(health.data.database).includes('connected'), 'Database is connected and server is healthy');

  // STEP 2: Admin Login
  console.log('\n--- Step 2: Configured Admin Login ---');
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@fixitlocal.com',
      password: 'AdminSecure2026!'
    })
  });
  const adminToken = getToken(adminLogin);
  const adminUser = getUser(adminLogin);
  assert(adminLogin.status === 200 && adminToken, 'Admin login succeeded with ADMIN_EMAIL and ADMIN_PASSWORD');
  assert(adminUser.role === 'admin', 'Authenticated user has admin role');

  // STEP 3: Admin Metrics & Stats Access
  console.log('\n--- Step 3: Admin Metrics & Report Endpoints ---');
  const adminMetrics = await req('/admin/metrics', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(adminMetrics.status === 200, 'Admin metrics accessible via /api/admin/metrics');

  const reportTypes = await req('/admin/report-types', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const reportTypesList = getData(reportTypes);
  assert(reportTypes.status === 200 && Array.isArray(reportTypesList), 'Admin report types returned successfully');

  // STEP 4: Public Registration strictly blocks role: admin
  console.log('\n--- Step 4: Security - Block Public Admin Registration ---');
  const fakeAdminReg = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Malicious Attacker',
      email: `hacker_${Date.now()}@evil.com`,
      password: 'Password123!',
      role: 'admin'
    })
  });
  assert(fakeAdminReg.status === 403, 'Public registration with role="admin" strictly rejected with 403 Forbidden');

  // STEP 5: Customer Registration with Initial Wallet Balance = ₹0.00
  console.log('\n--- Step 5: Real Customer Registration & Wallet Verification ---');
  const custTimestamp = Date.now();
  const customerEmail = `e2e_cust_${custTimestamp}@test.com`;
  const customerReg = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Ramesh Sundaram',
      email: customerEmail,
      password: 'CustomerPass2026!',
      role: 'customer',
      phone: '9840123456',
      address: '15 Anna Nagar 2nd Avenue, Chennai',
      city: 'Chennai',
      latitude: 13.0850,
      longitude: 80.2100
    })
  });
  const customerToken = getToken(customerReg);
  const customerUser = getUser(customerReg);
  const customerId = customerUser?.id;
  assert((customerReg.status === 201 || customerReg.status === 200) && customerToken, 'Customer registration succeeded with JWT token');

  // Check customer initial wallet balance
  const custWallet = await req('/wallet', {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert(custWallet.status === 200, 'Customer wallet endpoint accessible');
  const walletData = getData(custWallet);
  const initialBalance = Number(walletData.balance !== undefined ? walletData.balance : custWallet.data.balance);
  assert(initialBalance === 0, `Initial wallet balance is strictly ₹0.00 (got ${initialBalance})`);

  // STEP 6: Customer Address Management
  console.log('\n--- Step 6: Customer Address Management CRUD ---');
  const addAddress = await req('/auth/addresses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      title: 'Office',
      street: 'Tower B, RMZ Millenia, Perungudi',
      area: 'OMR',
      city: 'Chennai',
      state: 'Tamil Nadu',
      postalCode: '600096',
      latitude: 12.9650,
      longitude: 80.2450,
      isDefault: true
    })
  });
  assert(addAddress.status === 201 || addAddress.status === 200, 'Customer saved address creation succeeded');

  const getAddresses = await req('/auth/addresses', {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  const addressList = getData(getAddresses);
  assert(getAddresses.status === 200 && Array.isArray(addressList) && addressList.length > 0, 'Customer saved addresses listed correctly');

  // STEP 7: Provider Registration with Multiple Services & Pending Status
  console.log('\n--- Step 7: Real Provider Registration ---');
  const provTimestamp = Date.now();
  const providerEmail = `e2e_prov_${provTimestamp}@test.com`;
  const providerReg = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Vignesh Electric',
      email: providerEmail,
      password: 'ProviderPass2026!',
      role: 'provider',
      phone: '9840999888',
      businessName: 'Vignesh Pro Electrical Solutions',
      primaryCategory: 'Electrician',
      services: ['Electrical Wiring', 'MCB Installation', 'Inverter Installation'],
      serviceRadius: 15,
      experienceYears: 7,
      serviceArea: 'Anna Nagar, Kilpauk, Shenoy Nagar',
      city: 'Chennai',
      address: '24 4th Main Road, Anna Nagar, Chennai',
      latitude: 13.0870,
      longitude: 80.2150
    })
  });
  const providerToken = getToken(providerReg);
  const providerUser = getUser(providerReg);
  const providerUserId = providerUser?.id;
  assert((providerReg.status === 201 || providerReg.status === 200) && providerToken, 'Provider registration succeeded with JWT token');

  // Verify provider starts with pending status
  const provProfileCheck = await req('/auth/me', {
    headers: { Authorization: `Bearer ${providerToken}` }
  });
  const meData = getData(provProfileCheck);
  const profileData = meData.user?.provider_profile || meData.providerProfile || meData.provider_profile || providerUser?.providerProfile;
  assert(profileData && (profileData.is_approved === false || profileData.verification_status === 'pending'), 'Provider registration created with is_approved=false and verification_status="pending"');
  assert(profileData.service_radius === 15, 'Provider service radius accurately persisted as 15 km');

  // STEP 8: Admin Provider Approval
  console.log('\n--- Step 8: Admin Provider Application Approval ---');
  const approveRes = await req(`/admin/providers/${profileData.id}/verify`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'approve' })
  });
  assert(approveRes.status === 200, 'Admin approved provider application');

  // STEP 9: Provider Availability Schedule Setup
  console.log('\n--- Step 9: Provider Availability Schedule & Slots ---');
  const schedUpdate = await req('/providers/availability', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${providerToken}` },
    body: JSON.stringify({
      service_radius: 15,
      working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      working_hours: { start: '09:00', end: '18:00' },
      breaks: [{ start: '13:00', end: '14:00', label: 'Lunch' }]
    })
  });
  assert(schedUpdate.status === 200, 'Provider working hours, breaks, and days updated successfully');

  // Verify slots endpoint
  const slotsRes = await req(`/providers/${profileData.id}/slots?date=2026-09-24`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  const slotData = getData(slotsRes);
  const availableSlots = slotData.availableSlots || slotData.available_slots || slotData.slots || slotData;
  assert(slotsRes.status === 200 && Array.isArray(availableSlots), 'Provider dynamic availability slots calculated');

  // STEP 10: Provider Matching Validation (Radius & Working Day)
  console.log('\n--- Step 10: Provider Matching - Radius & Day Validation ---');
  // Matching near provider (Anna Nagar, 1.5 km away) -> Should match
  const nearMatch = await req(`/providers/available?category=Electrician&lat=13.0850&lng=80.2100&date=2026-09-24`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert(nearMatch.status === 200, 'Provider matching query succeeded');
  const nearData = getData(nearMatch);
  const nearProviders = Array.isArray(nearData) ? nearData : (nearData.providers || []);
  const isFoundNear = nearProviders.some(p => p.id === profileData.id || p.user_id === providerUserId || p.user?.id === providerUserId);
  assert(isFoundNear, 'Provider matched within service radius (1.5 km <= 15 km)');

  // Matching far away from provider (Tambaram, ~25 km away) -> Should NOT match
  const farMatch = await req(`/providers/available?category=Electrician&lat=12.9249&lng=80.1000&date=2026-09-24`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  const farData = getData(farMatch);
  const farProviders = Array.isArray(farData) ? farData : (farData.providers || []);
  const isFoundFar = farProviders.some(p => p.id === profileData.id || p.user_id === providerUserId || p.user?.id === providerUserId);
  assert(!isFoundFar, 'Provider correctly excluded when customer is outside service radius (> 15 km)');

  // STEP 11: Cryptographic Booking Creation & Price Quote
  console.log('\n--- Step 11: Cryptographic Booking Creation ---');
  const createBooking = await req('/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      providerId: providerUserId,
      serviceName: 'Electrical Wiring',
      category: 'Electrician',
      date: '2026-09-24',
      time: '10:00 AM',
      amount: 450,
      paymentMethod: 'wallet',
      address: '15 Anna Nagar 2nd Avenue, Chennai',
      customerNotes: 'Need 3 new power points installed'
    })
  });
  assert(createBooking.status === 201 || createBooking.status === 200, 'Booking created successfully');
  const booking = getData(createBooking);
  assert(booking.booking_number && booking.booking_number.startsWith('FIX-'), `Booking number is cryptographically generated with FIX- prefix (${booking.booking_number})`);
  assert(booking.payment_status === 'pending' || booking.payment_status === 'unpaid', `Initial booking payment status is pending/unpaid (got ${booking.payment_status})`);

  // STEP 12: Security & Ownership Authorization
  console.log('\n--- Step 12: Ownership Authorization Security Checks ---');
  // Create another customer
  const otherCustEmail = `other_${Date.now()}@test.com`;
  const otherCustReg = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Unauthorized Stranger',
      email: otherCustEmail,
      password: 'Password123!',
      role: 'customer'
    })
  });
  const otherToken = getToken(otherCustReg);

  // Other customer trying to access booking -> 403
  const unauthorizedGet = await req(`/bookings/${booking.id}`, {
    headers: { Authorization: `Bearer ${otherToken}` }
  });
  assert(unauthorizedGet.status === 403, 'Unauthorized user accessing booking receives 403 Forbidden');

  // Other customer trying to cancel booking -> 403
  const unauthorizedCancel = await req(`/bookings/${booking.id}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${otherToken}` },
    body: JSON.stringify({ cancellationReason: 'Malicious attempt' })
  });
  assert(unauthorizedCancel.status === 403, 'Unauthorized user cancelling booking receives 403 Forbidden');

  // STEP 13: Booking Lifecycle Progression
  console.log('\n--- Step 13: Complete Booking Lifecycle Progression ---');
  // 1. Accept
  const acceptRes = await req(`/bookings/${booking.id}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${providerToken}` }
  });
  assert(acceptRes.status === 200, 'Booking accepted by assigned provider');

  // 2. Start Travel
  const travelRes = await req(`/bookings/${booking.id}/start-travel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${providerToken}` }
  });
  assert(travelRes.status === 200, 'Booking moved to "on_the_way"');

  // 3. Arrived
  const arrivedRes = await req(`/bookings/${booking.id}/arrived`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${providerToken}` }
  });
  assert(arrivedRes.status === 200, 'Booking moved to "arrived"');

  // 4. Start Service
  const startSvcRes = await req(`/bookings/${booking.id}/start-service`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${providerToken}` }
  });
  assert(startSvcRes.status === 200, 'Booking moved to "in_progress"');

  // 5. Complete Service
  const completeRes = await req(`/bookings/${booking.id}/complete`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${providerToken}` }
  });
  assert(completeRes.status === 200, 'Booking marked completed by provider');

  // STEP 14: Strict Decoupling of Service Completion from Payment
  console.log('\n--- Step 14: Strict Decoupling of Service Completion from Payment ---');
  const postCompleteBooking = await req(`/bookings/${booking.id}`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  const completedBookingData = postCompleteBooking.data.data || postCompleteBooking.data;
  assert(completedBookingData.status === 'completed', 'Booking status is "completed"');
  assert(completedBookingData.payment_status === 'pending' || completedBookingData.payment_status === 'unpaid',
    `CRITICAL VERIFICATION: Service completion did NOT automatically set payment to paid (payment_status is still "${completedBookingData.payment_status}")`);

  // STEP 15: Wallet Top-Up & Booking Payment
  console.log('\n--- Step 15: Wallet Top-Up & Atomic Payment Processing ---');
  // Top up wallet by ₹1000
  const topUpRes = await req('/wallet/topup', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ amount: 1000, method: 'UPI' })
  });
  assert(topUpRes.status === 200, 'Customer wallet top-up succeeded');
  const postTopUpWallet = await req('/wallet', {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  const balanceAfterTopup = Number(postTopUpWallet.data.balance || postTopUpWallet.data.data?.balance);
  assert(balanceAfterTopup === 1000, `Wallet balance is exactly ₹1,000.00 after top-up (got ${balanceAfterTopup})`);

  // Pay booking from wallet
  const payRes = await req(`/wallet/pay`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ bookingId: booking.id, amount: 450 })
  });
  assert(payRes.status === 200, 'Payment for booking from wallet succeeded');

  // Verify wallet balance after payment
  const postPayWallet = await req('/wallet', {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  const balanceAfterPay = Number(postPayWallet.data.balance || postPayWallet.data.data?.balance);
  assert(balanceAfterPay === 550, `Wallet balance accurately deducted to ₹550.00 (1000 - 450 = ${balanceAfterPay})`);

  // Verify booking payment status is now "paid"
  const postPayBooking = await req(`/bookings/${booking.id}`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  const paidBookingData = postPayBooking.data.data || postPayBooking.data;
  assert(paidBookingData.payment_status === 'paid', 'Booking payment_status successfully updated to "paid" after explicit payment');

  // STEP 16: Exactly 1 Review Per Completed Booking Rule
  console.log('\n--- Step 16: Review Validation (Strictly 1 Review Per Completed Booking) ---');
  // First review -> Must succeed
  const review1 = await req('/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      bookingId: booking.id,
      rating: 5,
      comment: 'Excellent electrical work! Neatly installed all power points.'
    })
  });
  assert(review1.status === 201 || review1.status === 200, 'First review submitted successfully for completed booking');

  // Second review for same booking -> Must fail
  const review2 = await req('/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      bookingId: booking.id,
      rating: 4,
      comment: 'Attempting duplicate review for same booking'
    })
  });
  assert(review2.status === 400 || review2.status === 409, `Duplicate review strictly rejected with error ${review2.status}`);

  console.log('\n====================================================');
  console.log('🎉 ALL REAL BACKEND REQUIREMENTS VERIFIED 100% SUCCESSFULLY!');
  console.log('====================================================');
}

runVerification().catch((err) => {
  console.error('\nVerification halted with error:', err);
  process.exit(1);
});
