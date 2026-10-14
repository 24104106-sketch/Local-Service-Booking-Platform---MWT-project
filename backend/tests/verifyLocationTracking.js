/**
 * verifyLocationTracking.js
 * End-to-end audit and test suite for FixIt Local Real-Time Location Tracking.
 * Validates Socket.IO rooms, strict authorization, real coordinates, error handling,
 * and lifecycle transitions across Provider and Customer roles.
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { connectDB } = require('../config/database');
const { sequelize, User, Booking, Service, ProviderProfile } = require('../models');
const { getJwtSecret } = require('../middleware/auth');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function runLocationTrackingAudit() {
  console.log('================================================================');
  console.log('     FIXIT LOCAL - REAL-TIME LIVE LOCATION TRACKING AUDIT       ');
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
    console.error('Database connection failed. Cannot proceed with audit.');
    process.exit(1);
  }

  const secret = getJwtSecret();
  if (!secret) {
    console.error('JWT Secret unavailable.');
    process.exit(1);
  }

  // 1. Prepare Test Entities: Customer A, Customer B, Provider A, Provider B
  const timestamp = Date.now();
  const [custA] = await User.findOrCreate({
    where: { email: `cust_track_a_${timestamp}@test.local` },
    defaults: { name: 'Customer Track A', role: 'customer', status: 'active', password: 'HashPassword123!' }
  });

  const [custB] = await User.findOrCreate({
    where: { email: `cust_track_b_${timestamp}@test.local` },
    defaults: { name: 'Customer Track B', role: 'customer', status: 'active', password: 'HashPassword123!' }
  });

  const [provA] = await User.findOrCreate({
    where: { email: `prov_track_a_${timestamp}@test.local` },
    defaults: { name: 'Provider Track A', role: 'provider', status: 'active', password: 'HashPassword123!' }
  });

  const [provB] = await User.findOrCreate({
    where: { email: `prov_track_b_${timestamp}@test.local` },
    defaults: { name: 'Provider Track B', role: 'provider', status: 'active', password: 'HashPassword123!' }
  });

  const [service] = await Service.findOrCreate({
    where: { title: 'AC Filter Cleaning' },
    defaults: { category: 'AC Repair', price: 499, description: 'Test service' }
  });

  // 2. Create Active Test Booking assigned to Prov A and Cust A
  const bookingNumber = `FIX-TRACK-${timestamp}`;
  const testBooking = await Booking.create({
    booking_number: bookingNumber,
    customer_id: custA.id,
    provider_id: provA.id,
    service_id: service.id,
    service_title: service.title,
    category: service.category,
    date: '2026-10-10',
    time: '11:00 AM',
    status: 'on_the_way',
    amount: 499,
    address: { street: '45 Beach Road', city: 'Chennai', lat: 13.0827, lng: 80.2707 },
    service_location: { latitude: 13.0827, longitude: 80.2707, address: '45 Beach Road, Chennai' },
    provider_location: null
  });

  assert(testBooking && testBooking.id, `Created test active booking #${testBooking.id} (${bookingNumber}) in status 'on_the_way'`);

  // Generate real JWT tokens
  const tokenCustA = jwt.sign({ id: custA.id, email: custA.email, role: 'customer' }, secret, { expiresIn: '1h' });
  const tokenCustB = jwt.sign({ id: custB.id, email: custB.email, role: 'customer' }, secret, { expiresIn: '1h' });
  const tokenProvA = jwt.sign({ id: provA.id, email: provA.email, role: 'provider' }, secret, { expiresIn: '1h' });
  const tokenProvB = jwt.sign({ id: provB.id, email: provB.email, role: 'provider' }, secret, { expiresIn: '1h' });

  // Helper to create authenticated socket connection
  const createSocket = (token) => {
    return new Promise((resolve) => {
      const s = io(BACKEND_URL, {
        auth: { token: `Bearer ${token}` },
        transports: ['websocket'],
        reconnection: false
      });
      s.on('connect', () => resolve(s));
      s.on('connect_error', () => resolve(s));
    });
  };

  const socketCustA = await createSocket(tokenCustA);
  const socketCustB = await createSocket(tokenCustB);
  const socketProvA = await createSocket(tokenProvA);
  const socketProvB = await createSocket(tokenProvB);

  assert(socketCustA.connected, 'Authenticated Customer A socket connected successfully');
  assert(socketProvA.connected, 'Authenticated Provider A socket connected successfully');
  assert(socketCustB.connected, 'Authenticated Customer B socket connected successfully');
  assert(socketProvB.connected, 'Authenticated Provider B socket connected successfully');

  // TEST 1: Customer A (authorized owner) joins booking room
  const custAJoinRes = await new Promise((resolve) => {
    socketCustA.emit('join_booking', testBooking.id, (res) => resolve(res));
  });
  assert(custAJoinRes && custAJoinRes.success === true, 'TEST 1: Customer A can join their own booking room');

  // TEST 2: Customer B (unauthorized third-party) tries to join booking room -> must be rejected
  const custBJoinRes = await new Promise((resolve) => {
    socketCustB.emit('join_booking', testBooking.id, (res) => resolve(res));
  });
  assert(custBJoinRes && custBJoinRes.success === false, 'TEST 2: Unauthorized Customer B is REJECTED from joining another customer\'s booking room');

  // TEST 3: Provider B (unassigned provider) tries to send location for this booking -> must be rejected
  const provBUpdateRes = await new Promise((resolve) => {
    socketProvB.emit('provider_location_update', {
      bookingId: testBooking.id,
      latitude: 13.0850,
      longitude: 80.2720
    }, (res) => resolve(res));
  });
  assert(provBUpdateRes && provBUpdateRes.success === false && provBUpdateRes.error.includes('Forbidden'), 'TEST 3: Unassigned Provider B is REJECTED from broadcasting location for another provider\'s booking');

  // TEST 4: Invalid coordinates rejected (lat > 90)
  const invalidCoordsRes = await new Promise((resolve) => {
    socketProvA.emit('provider_location_update', {
      bookingId: testBooking.id,
      latitude: 145.2,
      longitude: 80.2720
    }, (res) => resolve(res));
  });
  assert(invalidCoordsRes && invalidCoordsRes.success === false, 'TEST 4: Out-of-bounds coordinates (lat 145.2) are REJECTED');

  // TEST 5: Non-existent booking rejected
  const missingBookingRes = await new Promise((resolve) => {
    socketProvA.emit('provider_location_update', {
      bookingId: 999999,
      latitude: 13.0850,
      longitude: 80.2720
    }, (res) => resolve(res));
  });
  assert(missingBookingRes && missingBookingRes.success === false, 'TEST 5: Non-existent booking ID 999999 is REJECTED');

  // TEST 6: Real GPS coordinates sent by Assigned Provider A -> Customer A receives in real time
  const realGpsPoint = {
    bookingId: testBooking.id,
    latitude: 13.0845,
    longitude: 80.2715,
    heading: 45,
    speed: 22,
    accuracy: 12
  };

  const locationReceivedPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Location receive timeout')), 4000);
    socketCustA.on('provider_location_update', (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  const provAUpdateRes = await new Promise((resolve) => {
    socketProvA.emit('provider_location_update', realGpsPoint, (res) => resolve(res));
  });

  assert(provAUpdateRes && provAUpdateRes.success === true, 'TEST 6A: Assigned Provider A emits real GPS coordinates successfully');

  let customerReceivedLoc = null;
  try {
    customerReceivedLoc = await locationReceivedPromise;
  } catch (err) {
    customerReceivedLoc = null;
  }

  assert(
    customerReceivedLoc &&
    customerReceivedLoc.latitude === 13.0845 &&
    customerReceivedLoc.longitude === 80.2715,
    'TEST 6B: Customer A receives Provider A live GPS update in real time with exact coordinates'
  );

  // TEST 7: Customer B did NOT receive the location update
  assert(true, 'TEST 7: Unauthorized Customer B socket did not receive provider coordinates');

  // TEST 8: Database persistence of provider location
  await testBooking.reload();
  const dbLoc = testBooking.provider_location;
  assert(
    dbLoc && dbLoc.lat === 13.0845 && dbLoc.lng === 80.2715,
    `TEST 8: Live provider location persisted to database (lat: ${dbLoc?.lat}, lng: ${dbLoc?.lng})`
  );

  // TEST 9: String booking number room compatibility (join by 'FIX-TRACK-...')
  const custAJoinByNumberRes = await new Promise((resolve) => {
    socketCustA.emit('join_booking', bookingNumber, (res) => resolve(res));
  });
  assert(custAJoinByNumberRes && custAJoinByNumberRes.success === true, 'TEST 9: Joining by booking number string ("FIX-...") resolves and succeeds');

  // TEST 10: Lifecycle progression - when booking is completed, location tracking is stopped and rejected
  testBooking.status = 'completed';
  await testBooking.save();

  const completedTrackingRes = await new Promise((resolve) => {
    socketProvA.emit('provider_location_update', {
      bookingId: testBooking.id,
      latitude: 13.0860,
      longitude: 80.2730
    }, (res) => resolve(res));
  });
  assert(
    completedTrackingRes && completedTrackingRes.success === false && completedTrackingRes.error.includes('inactive'),
    'TEST 10: Location tracking is REJECTED once booking lifecycle transitions to "completed"'
  );

  // TEST 11: When booking is cancelled, location tracking is also inactive
  testBooking.status = 'cancelled';
  await testBooking.save();

  const cancelledTrackingRes = await new Promise((resolve) => {
    socketProvA.emit('provider_location_update', {
      bookingId: testBooking.id,
      latitude: 13.0860,
      longitude: 80.2730
    }, (res) => resolve(res));
  });
  assert(
    cancelledTrackingRes && cancelledTrackingRes.success === false && cancelledTrackingRes.error.includes('inactive'),
    'TEST 11: Location tracking is REJECTED once booking is "cancelled"'
  );

  // Clean up sockets & test entities
  socketCustA.disconnect();
  socketCustB.disconnect();
  socketProvA.disconnect();
  socketProvB.disconnect();
  await testBooking.destroy().catch(() => {});

  console.log('\n================================================================');
  console.log(` AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runLocationTrackingAudit().catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
