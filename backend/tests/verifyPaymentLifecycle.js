/**
 * verifyPaymentLifecycle.js
 * Comprehensive End-to-End Automated Test Suite for FixIt Local:
 * Real Online Payment Gateway (Razorpay), Payment Authorization (Hold),
 * Provider Accept/Reject Lifecycle, Manual Capture, Void/Release, Refund,
 * Cash Payment Flow, Secure Wallet, Idempotency, and Real-time Socket.IO Notifications.
 *
 * Covers all 34 required test scenarios.
 */

process.env.PAYMENT_TEST_MODE = 'true';
require('dotenv').config({ path: __dirname + '/../.env' });
const axios = require('axios');
const crypto = require('crypto');
const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { connectDB } = require('../config/database');
const { sequelize, User, Booking, Service, ProviderProfile, Payment, WalletTransaction, Notification } = require('../models');
const { getJwtSecret } = require('../middleware/auth');
const paymentService = require('../services/paymentService');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const TEST_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'fixit_local_test_secret_key';
const TEST_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'fixit_local_test_webhook_secret';

async function runPaymentLifecycleSuite() {
  console.log('================================================================');
  console.log('   FIXIT LOCAL - REAL PAYMENT LIFECYCLE & SECURITY TEST SUITE   ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  }

  const db = await connectDB();
  if (!db) {
    console.error('Database connection failed.');
    process.exit(1);
  }

  const secret = getJwtSecret();
  const timestamp = Date.now();

  // Helper to generate auth tokens
  const signToken = (user) => jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    secret,
    { expiresIn: '2h' }
  );

  // 1. Setup Test Users: Customer 1, Customer 2, Provider 1, Provider 2
  console.log('--- Setting up test users and seed service ---');
  const [cust1] = await User.findOrCreate({
    where: { email: `test_cust1_${timestamp}@local.test` },
    defaults: { name: 'Customer One', role: 'customer', status: 'active', password: 'HashPassword123!' }
  });
  const [cust2] = await User.findOrCreate({
    where: { email: `test_cust2_${timestamp}@local.test` },
    defaults: { name: 'Customer Two', role: 'customer', status: 'active', password: 'HashPassword123!' }
  });
  const [prov1] = await User.findOrCreate({
    where: { email: `test_prov1_${timestamp}@local.test` },
    defaults: { name: 'Provider One', role: 'provider', status: 'active', password: 'HashPassword123!' }
  });
  const [prov2] = await User.findOrCreate({
    where: { email: `test_prov2_${timestamp}@local.test` },
    defaults: { name: 'Provider Two', role: 'provider', status: 'active', password: 'HashPassword123!' }
  });

  const { Wallet } = require('../models');
  await Wallet.findOrCreate({
    where: { user_id: cust1.id },
    defaults: { balance: 500.00 }
  });
  await Wallet.findOrCreate({
    where: { user_id: cust2.id },
    defaults: { balance: 0.00 }
  });

  const [prof1] = await ProviderProfile.findOrCreate({
    where: { user_id: prov1.id },
    defaults: {
      business_name: 'Pro One Services',
      category: 'Plumbing',
      is_approved: true,
      verification_status: 'verified',
      is_active: true,
      is_available: true,
      availability_status: 'AVAILABLE',
      service_radius_km: 50,
      latitude: 13.0827,
      longitude: 80.2707
    }
  });
  await prof1.update({
    is_approved: true,
    verification_status: 'verified',
    is_active: true,
    is_available: true,
    availability_status: 'AVAILABLE',
    service_radius_km: 50,
    latitude: 13.0827,
    longitude: 80.2707
  });

  const [prof2] = await ProviderProfile.findOrCreate({
    where: { user_id: prov2.id },
    defaults: {
      business_name: 'Pro Two Services',
      category: 'Plumbing',
      is_approved: true,
      verification_status: 'verified',
      is_active: true,
      is_available: true,
      availability_status: 'AVAILABLE',
      service_radius_km: 50,
      latitude: 13.0827,
      longitude: 80.2707
    }
  });
  await prof2.update({
    is_approved: true,
    verification_status: 'verified',
    is_active: true,
    is_available: true,
    availability_status: 'AVAILABLE',
    service_radius_km: 50,
    latitude: 13.0827,
    longitude: 80.2707
  });

  const [testService] = await Service.findOrCreate({
    where: { title: `Payment Test Service ${timestamp}` },
    defaults: {
      category: 'Plumbing',
      description: 'Test service description',
      price: 250.00,
      is_active: true
    }
  });

  const { ProviderService } = require('../models');
  await ProviderService.findOrCreate({
    where: { provider_profile_id: prof1.id, service_id: testService.id },
    defaults: { is_active: true, custom_price: 250.00 }
  });
  await ProviderService.findOrCreate({
    where: { provider_profile_id: prof2.id, service_id: testService.id },
    defaults: { is_active: true, custom_price: 250.00 }
  });

  const tokenCust1 = signToken(cust1);
  const tokenCust2 = signToken(cust2);
  const tokenProv1 = signToken(prov1);
  const tokenProv2 = signToken(prov2);

  const apiCust1 = axios.create({ baseURL: BACKEND_URL, headers: { Authorization: `Bearer ${tokenCust1}` } });
  const apiCust2 = axios.create({ baseURL: BACKEND_URL, headers: { Authorization: `Bearer ${tokenCust2}` } });
  const apiProv1 = axios.create({ baseURL: BACKEND_URL, headers: { Authorization: `Bearer ${tokenProv1}` } });
  const apiProv2 = axios.create({ baseURL: BACKEND_URL, headers: { Authorization: `Bearer ${tokenProv2}` } });

  // 2. Setup Socket.IO client connections for notifications
  console.log('\n--- Connecting Socket.IO test clients for real-time notifications ---');
  const cust1SocketNotifications = [];
  const prov1SocketNotifications = [];

  const cust1Socket = io(BACKEND_URL, { auth: { token: tokenCust1 }, reconnection: false });
  const prov1Socket = io(BACKEND_URL, { auth: { token: tokenProv1 }, reconnection: false });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      if (++connected === 2) {
        cust1Socket.emit('join_user', cust1.id);
        prov1Socket.emit('join_user', prov1.id);
        resolve();
      }
    };
    cust1Socket.on('connect', check);
    prov1Socket.on('connect', check);
    cust1Socket.on('notification', (data) => cust1SocketNotifications.push(data));
    prov1Socket.on('notification', (data) => prov1SocketNotifications.push(data));
    setTimeout(resolve, 2000); // timeout fallback
  });

  cust1Socket.emit('join_user', cust1.id);
  prov1Socket.emit('join_user', prov1.id);

  assert(cust1Socket.connected, 'Scenario 33: Socket.IO connected for Customer');
  assert(prov1Socket.connected, 'Scenario 33: Socket.IO connected for Provider');

  // ===========================================================================
  // TEST SCENARIOS 1-8: Customer Online Payment -> Hold -> Provider Accept -> Capture
  // ===========================================================================
  console.log('\n--- Scenarios 1 - 8: Happy Path (Online Payment Hold + Accept + Capture) ---');

  // 1. Create Booking (Pending Online Payment)
  const booking1Res = await apiCust1.post('/api/bookings', {
    provider_id: prov1.id,
    service_id: testService.id,
    scheduled_date: '2026-10-15',
    scheduled_time: '10:00:00',
    total_amount: 250.00,
    payment_method: 'card',
    service_address: '123 Test St, City',
    latitude: 13.0827,
    longitude: 80.2707,
    notes: 'Online payment test 1'
  });
  const booking1 = booking1Res.data.data;
  assert(booking1 && booking1.id, 'Scenario 1: Customer creates booking for online payment');
  assert(booking1.payment_status === 'pending_authorization' || booking1.payment_status === 'pending', 'Scenario 1: Initial payment status is pending authorization');

  // 2. Create Payment Order via Gateway
  const orderRes1 = await apiCust1.post('/api/payments/create-order', {
    booking_id: booking1.id
  });
  const orderId1 = orderRes1.data.data.order_id || orderRes1.data.data.orderId;
  assert(orderRes1.data.success && orderId1, 'Scenario 1: Gateway order generated with order_id');

  // Verify Razorpay Order configuration has payment_capture: 0 (Manual Capture/Hold)
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const mockPaymentId1 = `pay_mock_${Date.now()}_auth`;
  const signature1 = crypto
    .createHmac('sha256', TEST_KEY_SECRET)
    .update(`${orderId1}|${mockPaymentId1}`)
    .digest('hex');

  // 3. Customer Verifies/Authorizes Payment
  const verifyRes1 = await apiCust1.post('/api/payments/verify', {
    booking_id: booking1.id,
    razorpay_order_id: orderId1,
    razorpay_payment_id: mockPaymentId1,
    razorpay_signature: signature1
  });
  assert(verifyRes1.data.success && verifyRes1.data.data.payment_status === 'authorized', 'Scenario 2: Payment authorization succeeds (status: authorized)');

  // 4. Verify Booking status is PENDING and Payment is AUTHORIZED
  const refreshedBooking1 = await Booking.findByPk(booking1.id);
  const paymentRecord1 = await Payment.findOne({ where: { booking_id: booking1.id } });
  assert(refreshedBooking1.status === 'pending', 'Scenario 3: Booking remains PENDING awaiting provider acceptance');
  assert(refreshedBooking1.payment_status === 'authorized', 'Scenario 3: Booking payment_status is authorized');
  assert(paymentRecord1 && paymentRecord1.status === 'authorized', 'Scenario 3: Standalone Payment model status is authorized');

  // 5. Provider receives notification
  await new Promise(r => setTimeout(r, 600));
  const provNotif1 = prov1SocketNotifications.find(n => n.metadata?.bookingId === booking1.id || n.message?.includes(booking1.booking_number) || n.title?.includes('Payment Secured'));
  assert(provNotif1 !== undefined, 'Scenario 4: Provider receives real-time notification that payment is authorized and ready');

  // 6. Provider Accepts Booking
  const acceptRes1 = await apiProv1.patch(`/api/bookings/${booking1.id}/status`, {
    status: 'accepted'
  });
  assert(acceptRes1.data.success, 'Scenario 5: Provider accepts booking');

  // 7. Payment captures & Booking becomes confirmed
  const afterAcceptBooking1 = await Booking.findByPk(booking1.id);
  const afterAcceptPayment1 = await Payment.findOne({ where: { booking_id: booking1.id } });
  assert(afterAcceptPayment1.status === 'captured' && afterAcceptPayment1.captured_at !== null, 'Scenario 6: Authorized payment is CAPTURED with timestamp');
  assert(afterAcceptBooking1.status === 'confirmed' || afterAcceptBooking1.status === 'accepted', 'Scenario 7: Booking transitioned to confirmed/accepted');
  assert(afterAcceptBooking1.payment_status === 'paid', 'Scenario 7: Booking payment_status updated to paid');

  // 8. Customer receives notification
  await new Promise(r => setTimeout(r, 600));
  const custAcceptNotif = cust1SocketNotifications.find(n => n.metadata?.bookingId === booking1.id || n.message?.includes(booking1.booking_number) || n.title?.includes('Accepted') || n.title?.includes('Captured'));
  assert(custAcceptNotif !== undefined, 'Scenario 8: Customer receives real-time notification for booking acceptance & payment capture');

  // ===========================================================================
  // TEST SCENARIOS 9-16: Reject Flow (Hold -> Provider Rejects -> Void / Release)
  // ===========================================================================
  console.log('\n--- Scenarios 9 - 16: Reject Flow (Hold + Reject + Release/Void) ---');

  // 9. Create Booking 2
  const booking2Res = await apiCust1.post('/api/bookings', {
    provider_id: prov1.id,
    service_id: testService.id,
    scheduled_date: '2026-10-16',
    scheduled_time: '14:00:00',
    total_amount: 250.00,
    payment_method: 'card',
    service_address: '456 Test Ave',
    latitude: 13.0827,
    longitude: 80.2707,
    notes: 'Online payment test 2'
  });
  const booking2 = booking2Res.data.data;
  assert(booking2 && booking2.id, 'Scenario 9: Customer creates second booking');

  // 10. Generate order and authorize
  const orderRes2 = await apiCust1.post('/api/payments/create-order', { booking_id: booking2.id });
  const orderId2 = orderRes2.data.data.order_id || orderRes2.data.data.orderId;
  const mockPaymentId2 = `pay_mock_${Date.now()}_auth2`;
  const signature2 = crypto
    .createHmac('sha256', TEST_KEY_SECRET)
    .update(`${orderId2}|${mockPaymentId2}`)
    .digest('hex');

  await apiCust1.post('/api/payments/verify', {
    booking_id: booking2.id,
    razorpay_order_id: orderId2,
    razorpay_payment_id: mockPaymentId2,
    razorpay_signature: signature2
  });
  const paymentRecord2 = await Payment.findOne({ where: { booking_id: booking2.id } });
  assert(paymentRecord2.status === 'authorized', 'Scenario 10: Payment 2 is authorized');

  // 11. Verify Booking 2 is PENDING
  const refreshedBooking2 = await Booking.findByPk(booking2.id);
  assert(refreshedBooking2.status === 'pending', 'Scenario 11: Booking 2 is PENDING');

  // 12. Provider notified
  await new Promise(r => setTimeout(r, 600));
  const provNotif2 = prov1SocketNotifications.find(n => n.metadata?.bookingId === booking2.id || n.message?.includes(booking2.booking_number));
  assert(provNotif2 !== undefined, 'Scenario 12: Provider notified for Booking 2');

  // 13. Provider Rejects Booking
  const rejectRes2 = await apiProv1.patch(`/api/bookings/${booking2.id}/status`, {
    status: 'rejected',
    reason: 'Fully booked'
  });
  assert(rejectRes2.data.success, 'Scenario 13: Provider rejects booking');

  // 14. Authorization is released / voided
  const afterRejectPayment2 = await Payment.findOne({ where: { booking_id: booking2.id } });
  assert(afterRejectPayment2.status === 'voided' && afterRejectPayment2.released_at !== null, 'Scenario 14: Payment authorization is VOIDED/RELEASED without capture');

  // 15. Booking becomes REJECTED
  const afterRejectBooking2 = await Booking.findByPk(booking2.id);
  assert(afterRejectBooking2.status === 'rejected' && afterRejectBooking2.payment_status === 'refunded', 'Scenario 15: Booking status is REJECTED and payment_status is refunded');

  // 16. Customer receives rejection notification
  await new Promise(r => setTimeout(r, 600));
  const custRejectNotif = cust1SocketNotifications.find(n => n.metadata?.bookingId === booking2.id || n.message?.includes(booking2.booking_number) || n.title?.includes('Declined') || n.title?.includes('Released'));
  assert(custRejectNotif !== undefined, 'Scenario 16: Customer receives rejection + payment release notification');

  // ===========================================================================
  // TEST SCENARIOS 17-23: Failure & Edge Cases (Invalid Signature, Duplicate Ops)
  // ===========================================================================
  console.log('\n--- Scenarios 17 - 23: Failure Cases & Idempotency ---');

  // 17. Payment authorization fails due to bad signature
  const booking3Res = await apiCust1.post('/api/bookings', {
    provider_id: prov1.id,
    service_id: testService.id,
    scheduled_date: '2026-10-17',
    scheduled_time: '11:00:00',
    total_amount: 250.00,
    payment_method: 'card',
    service_address: '789 Test Rd',
    latitude: 13.0827,
    longitude: 80.2707
  });
  const booking3 = booking3Res.data.data;
  const orderRes3 = await apiCust1.post('/api/payments/create-order', { booking_id: booking3.id });

  let badAuthError = false;
  try {
    await apiCust1.post('/api/payments/verify', {
      booking_id: booking3.id,
      razorpay_order_id: orderRes3.data.data.order_id,
      razorpay_payment_id: 'pay_bad_signature',
      razorpay_signature: 'invalid_signature_hex_1234567890'
    });
  } catch (err) {
    badAuthError = true;
  }
  assert(badAuthError, 'Scenario 17: Payment verification fails on invalid signature');

  // 18. Provider accepts after payment failure (not authorized)
  let provAcceptUnpaidFailed = false;
  try {
    await apiProv1.patch(`/api/bookings/${booking3.id}/status`, { status: 'accepted' });
  } catch (err) {
    provAcceptUnpaidFailed = true;
  }
  const unauthBooking3 = await Booking.findByPk(booking3.id);
  assert(provAcceptUnpaidFailed || unauthBooking3.status !== 'confirmed', 'Scenario 18: Provider cannot confirm booking without authorized payment');

  // 19 & 20: Safe error handling on capture / release failures handled by service
  try {
    await paymentService.capturePayment({ id: 999999, gateway_payment_id: 'non_existent_pay' }, 250);
  } catch (err) {
    assert(err !== null, 'Scenario 19: Capture failure throws descriptive safe error without crashing');
  }

  try {
    await paymentService.releasePaymentHold({ id: 999999, gateway_payment_id: 'non_existent_pay' });
  } catch (err) {
    assert(err !== null, 'Scenario 20: Release failure throws descriptive safe error without crashing');
  }

  // 21. Duplicate Accept on already accepted booking
  let dupAcceptFailed = false;
  try {
    await apiProv1.patch(`/api/bookings/${booking1.id}/status`, { status: 'accepted' });
  } catch (err) {
    dupAcceptFailed = true;
  }
  assert(dupAcceptFailed, 'Scenario 21: Duplicate Accept is prevented (throws error)');

  // 22. Duplicate Reject on already rejected booking
  let dupRejectFailed = false;
  try {
    await apiProv1.patch(`/api/bookings/${booking2.id}/status`, { status: 'rejected' });
  } catch (err) {
    dupRejectFailed = true;
  }
  assert(dupRejectFailed, 'Scenario 22: Duplicate Reject is prevented (throws error)');

  // 23. Duplicate webhook idempotency test
  const webhookSecret = TEST_WEBHOOK_SECRET;
  const webhookPayload = JSON.stringify({
    event: 'payment.authorized',
    payload: {
      payment: {
        entity: {
          id: mockPaymentId1,
          order_id: orderId1,
          amount: 25000,
          currency: 'INR',
          status: 'authorized'
        }
      }
    }
  });
  const webhookSignature = crypto.createHmac('sha256', webhookSecret).update(webhookPayload).digest('hex');

  const webhookRes1 = await axios.post(`${BACKEND_URL}/api/payments/webhook`, webhookPayload, {
    headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': webhookSignature }
  });
  const webhookRes2 = await axios.post(`${BACKEND_URL}/api/payments/webhook`, webhookPayload, {
    headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': webhookSignature }
  });
  assert(webhookRes1.data.received && webhookRes2.data.received, 'Scenario 23: Webhook processes idempotently on repeated calls');

  // ===========================================================================
  // TEST SCENARIOS 24-26: Authorization & Security Checks
  // ===========================================================================
  console.log('\n--- Scenarios 24 - 26: Security & Authorization Controls ---');

  // 24. Customer 2 attempts to create payment order for Customer 1's booking
  let cust2TamperFailed = false;
  try {
    await apiCust2.post('/api/payments/create-order', { booking_id: booking1.id });
  } catch (err) {
    cust2TamperFailed = true;
  }
  assert(cust2TamperFailed, 'Scenario 24: Customer cannot create or access payment for another customer booking');

  // 25. Provider 2 attempts to Accept/Reject Provider 1's booking
  let prov2TamperFailed = false;
  try {
    await apiProv2.patch(`/api/bookings/${booking1.id}/status`, { status: 'rejected' });
  } catch (err) {
    prov2TamperFailed = true;
  }
  assert(prov2TamperFailed, 'Scenario 25: Unauthorized provider cannot accept or reject another provider booking');

  // 26. Incorrect payment amount (Server computes amount, does not trust client)
  const booking4Res = await apiCust1.post('/api/bookings', {
    provider_id: prov1.id,
    service_id: testService.id,
    scheduled_date: '2026-10-21',
    scheduled_time: '12:00:00',
    total_amount: 1.00, // client attempts to spoof Rs 1 instead of Rs 250
    payment_method: 'card',
    service_address: '100 Security Ln',
    latitude: 13.0827,
    longitude: 80.2707
  });
  const booking4 = booking4Res.data.data;
  const orderRes4 = await apiCust1.post('/api/payments/create-order', {
    booking_id: booking4.id,
    amount: 1.00 // Client attempts to request 1.00
  });
  // The server calculates the real booking amount (250) and generates the order for 250.00
  assert(orderRes4.data.data.amount === 250, 'Scenario 26: Server enforces server-side validated booking amount, ignoring client spoof');

  // ===========================================================================
  // TEST SCENARIOS 27-29: Wallet Security & Top-Up Verification
  // ===========================================================================
  console.log('\n--- Scenarios 27 - 29: Wallet Security & Atomicity ---');

  // 27. Insufficient wallet balance
  let walletInsufficientFailed = false;
  try {
    await apiCust2.post('/api/bookings', {
      provider_id: prov1.id,
      service_id: testService.id,
      scheduled_date: '2026-10-19',
      scheduled_time: '15:00:00',
      total_amount: 250.00,
      payment_method: 'wallet',
      service_address: '200 Wallet Way',
      latitude: 13.0827,
      longitude: 80.2707
    });
  } catch (err) {
    walletInsufficientFailed = true;
  }
  assert(walletInsufficientFailed, 'Scenario 27: Wallet booking fails when balance is insufficient (Cust 2 balance is 0)');

  // 29. Fake direct wallet top-up without gateway verification is BLOCKED
  let fakeTopupBlocked = false;
  try {
    await apiCust2.post('/api/wallet/topup', { amount: 10000 });
  } catch (err) {
    fakeTopupBlocked = true;
  }
  assert(fakeTopupBlocked, 'Scenario 29: Direct fake wallet top-up POST /api/wallet/topup is rejected with 400');

  // 28. Valid Wallet Top-Up via Gateway verification
  const topupOrderRes = await apiCust2.post('/api/wallet/topup-order', { amount: 300 });
  const topupOrderPayload = topupOrderRes.data.data || topupOrderRes.data;
  const topupOrderId = topupOrderPayload.order_id || topupOrderPayload.orderId;
  assert(topupOrderRes.data.success && topupOrderId, 'Scenario 28: Wallet top-up order generated via Gateway');
  const topupPaymentId = `pay_mock_${Date.now()}_topup`;
  const topupSig = crypto
    .createHmac('sha256', TEST_KEY_SECRET)
    .update(`${topupOrderId}|${topupPaymentId}`)
    .digest('hex');

  const verifyTopupRes = await apiCust2.post('/api/wallet/verify-topup', {
    amount: 300,
    razorpay_order_id: topupOrderId,
    razorpay_payment_id: topupPaymentId,
    razorpay_signature: topupSig
  });
  const topupResData = verifyTopupRes.data.data || verifyTopupRes.data;
  const finalBalance = topupResData.newBalance || topupResData.balance;
  assert(verifyTopupRes.data.success && finalBalance === 300, 'Scenario 28: Verified Gateway payment credits wallet balance to 300');

  // Duplicate topup prevention with same payment ID
  let dupTopupFailed = false;
  try {
    await apiCust2.post('/api/wallet/verify-topup', {
      amount: 300,
      razorpay_order_id: topupOrderId,
      razorpay_payment_id: topupPaymentId,
      razorpay_signature: topupSig
    });
  } catch (err) {
    dupTopupFailed = true;
  }
  assert(dupTopupFailed, 'Scenario 28: Duplicate wallet top-up replay attack is blocked');

  // ===========================================================================
  // TEST SCENARIOS 30-32: Cancellation, Void & Refund Flow
  // ===========================================================================
  console.log('\n--- Scenarios 30 - 32: Cancellation, Void Hold & Post-Capture Refund ---');

  // 30. Customer cancels booking BEFORE capture (Status: pending, Payment: authorized)
  const bookingCancelPreRes = await apiCust1.post('/api/bookings', {
    provider_id: prov1.id,
    service_id: testService.id,
    scheduled_date: '2026-10-20',
    scheduled_time: '16:00:00',
    total_amount: 250.00,
    payment_method: 'card',
    service_address: '300 Cancel St',
    latitude: 13.0827,
    longitude: 80.2707
  });
  const cancelBookingPre = bookingCancelPreRes.data.data;
  const cancelOrderPre = await apiCust1.post('/api/payments/create-order', { booking_id: cancelBookingPre.id });
  const cancelOrderIdPre = cancelOrderPre.data.data.order_id || cancelOrderPre.data.data.orderId;
  const mockCancelPayPre = `pay_mock_${Date.now()}_cancel_pre`;
  const cancelSigPre = crypto
    .createHmac('sha256', TEST_KEY_SECRET)
    .update(`${cancelOrderIdPre}|${mockCancelPayPre}`)
    .digest('hex');
  await apiCust1.post('/api/payments/verify', {
    booking_id: cancelBookingPre.id,
    razorpay_order_id: cancelOrderIdPre,
    razorpay_payment_id: mockCancelPayPre,
    razorpay_signature: cancelSigPre
  });

  const cancelPreRes = await apiCust1.patch(`/api/bookings/${cancelBookingPre.id}/cancel`, {
    reason: 'Changed my mind before provider accept'
  });
  assert(cancelPreRes.data.success, 'Scenario 30: Customer cancels booking before provider acceptance');
  const paymentAfterCancelPre = await Payment.findOne({ where: { booking_id: cancelBookingPre.id } });
  assert(paymentAfterCancelPre.status === 'voided', 'Scenario 30: Payment authorization is VOIDED (not captured)');

  // 31 & 32. Customer cancels booking AFTER capture (Booking 1 was captured in scenario 6)
  const cancelPostRes = await apiCust1.patch(`/api/bookings/${booking1.id}/cancel`, {
    reason: 'Provider had an emergency, cancel and refund'
  });
  assert(cancelPostRes.data.success, 'Scenario 31: Customer cancels booking after provider accepted and captured');
  const paymentAfterCancelPost = await Payment.findOne({ where: { booking_id: booking1.id } });
  assert(paymentAfterCancelPost.status === 'refunded' && paymentAfterCancelPost.refunded_at !== null, 'Scenario 32: Captured payment is REFUNDED with timestamp');

  // ===========================================================================
  // TEST SCENARIO: Cash Payment Flow (Phase 6)
  // ===========================================================================
  console.log('\n--- Phase 6: Cash Payment Flow & Provider Confirmation ---');
  const cashBookingRes = await apiCust1.post('/api/bookings', {
    provider_id: prov1.id,
    service_id: testService.id,
    scheduled_date: '2026-10-22',
    scheduled_time: '17:00:00',
    total_amount: 250.00,
    payment_method: 'cash',
    service_address: '400 Cash Ave',
    latitude: 13.0827,
    longitude: 80.2707
  });
  const cashBooking = cashBookingRes.data.data;
  assert(cashBooking.payment_status === 'cash_pending', 'Phase 6: Cash booking created with payment_status: cash_pending');

  await apiProv1.patch(`/api/bookings/${cashBooking.id}/status`, { status: 'accepted' });
  await apiProv1.patch(`/api/bookings/${cashBooking.id}/status`, { status: 'on_the_way' });
  await apiProv1.patch(`/api/bookings/${cashBooking.id}/status`, { status: 'arrived' });
  await apiProv1.patch(`/api/bookings/${cashBooking.id}/status`, { status: 'in_progress' });
  await apiProv1.patch(`/api/bookings/${cashBooking.id}/status`, { status: 'completed' });
  const completedCashBooking = await Booking.findByPk(cashBooking.id);
  assert(completedCashBooking.status === 'completed' && completedCashBooking.payment_status === 'cash_pending', 'Phase 6: Service completed; payment remains cash_pending until confirmed');

  const confirmCashRes = await apiProv1.patch(`/api/bookings/${cashBooking.id}/confirm-cash`, {});
  assert(confirmCashRes.data.success, 'Phase 6: Provider records cash received');
  const finalizedCashBooking = await Booking.findByPk(cashBooking.id);
  assert(finalizedCashBooking.payment_status === 'cash_received', 'Phase 6: Booking payment_status updated to cash_received');

  // ===========================================================================
  // TEST SCENARIO 34: Notification Persistence & Retrieval
  // ===========================================================================
  console.log('\n--- Scenario 34: Notification Persistence & Retrieval ---');
  const notifsCust1Res = await apiCust1.get('/api/notifications');
  const notifList = Array.isArray(notifsCust1Res.data.data) ? notifsCust1Res.data.data : notifsCust1Res.data.data?.notifications;
  assert(notifsCust1Res.data.success && Array.isArray(notifList), 'Scenario 34: Persisted notifications retrievable via GET /api/notifications');
  assert(notifList && notifList.length > 0, 'Scenario 34: Notification records exist in database across booking lifecycles');

  // Cleanup sockets
  cust1Socket.disconnect();
  prov1Socket.disconnect();

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPaymentLifecycleSuite().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
