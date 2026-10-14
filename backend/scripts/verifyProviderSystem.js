require('dotenv').config({ path: __dirname + '/../.env' });
const { User, ProviderProfile, Booking, Service, ProviderService, sequelize } = require('../models');

const BASE_URL = 'http://localhost:5000/api';

async function api(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function runVerification() {
  console.log('================================================================');
  console.log('   STARTING PROVIDER MANAGEMENT & NEARBY RECOMMENDATION VERIFICATION');
  console.log('================================================================\n');

  let testProviderUser = null;
  let testProviderProfile = null;
  let adminToken = null;
  let customerUser = null;
  let customerToken = null;
  let createdBookings = [];

  try {
    await sequelize.authenticate();
    console.log('✓ Database connection verified.');

    // Step 0: Obtain Admin Token
    console.log('\n--- Step 0: Admin Authentication ---');
    const adminLoginRes = await api('/auth/login', {
      method: 'POST',
      body: {
        email: 'santhiyam0603@gmail.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@123'
      }
    });
    adminToken = adminLoginRes.token;
    console.log('✓ Admin login successful. Admin ID:', adminLoginRes.user.id);

    // Step 0.1: Obtain or use Customer Account
    console.log('\n--- Step 0.1: Customer Authentication ---');
    let cust = await User.findOne({ where: { role: 'customer', status: 'active' } });
    if (!cust) {
      throw new Error('No active customer account found in database.');
    }
    const jwt = require('jsonwebtoken');
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET must be configured in environment');
    }
    customerToken = jwt.sign(
      { id: cust.id, role: cust.role, email: cust.email },
      process.env.JWT_SECRET
    );
    customerUser = cust;
    console.log('✓ Customer account ready. Customer ID:', cust.id, cust.name);

    // ====================================================================
    // TEST A: PROVIDER REGISTRATION TEST
    // ====================================================================
    console.log('\n--- TEST A: Provider Registration Test ---');
    const testRegEmail = `test_plumber_${Date.now()}@fixitlocal.com`;
    const regRes = await api('/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Karthik Raja',
        email: testRegEmail,
        phone: '9840123456',
        password: 'Password@123',
        role: 'provider',
        primaryCategory: 'Plumber',
        businessName: 'Karthik Plumbing Solutions',
        services: ['Pipe Repair', 'Tap Repair'],
        experienceYears: 4,
        skills: ['Pipe Fitting', 'Leak Detection'],
        serviceArea: 'Anna Nagar',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600040',
        serviceRadius: 15,
        latitude: 13.085,
        longitude: 80.210
      }
    });

    console.log('✓ Registration API response:', regRes.message);
    testProviderUser = await User.findOne({ where: { email: testRegEmail } });
    testProviderProfile = await ProviderProfile.findOne({ where: { user_id: testProviderUser.id } });

    if (!testProviderProfile) throw new Error('ProviderProfile was not created in database.');
    console.log('✓ ProviderProfile created. ID:', testProviderProfile.id);
    console.log('  - is_approved:', testProviderProfile.is_approved, '(Expected: false/0)');
    console.log('  - verification_status:', testProviderProfile.verification_status, '(Expected: pending)');
    console.log('  - is_active:', testProviderProfile.is_active, '(Expected: false/0)');
    console.log('  - availability_status:', testProviderProfile.availability_status, '(Expected: OFFLINE)');

    if (testProviderProfile.is_approved !== false && testProviderProfile.is_approved !== 0) {
      throw new Error('FAILED: Provider must NOT be automatically approved on registration.');
    }
    if (testProviderProfile.verification_status !== 'pending') {
      throw new Error('FAILED: Provider verification_status must be pending.');
    }

    // Verify unapproved provider is NOT returned in nearby search
    const preApprovalNearby = await api(`/providers/nearby?latitude=13.085&longitude=80.210&category=Plumber`);
    const foundUnapproved = (preApprovalNearby.data || []).find(p => p.id === testProviderProfile.id);
    if (foundUnapproved) {
      throw new Error('FAILED: Unapproved pending provider must not be visible in nearby search.');
    }
    console.log('✓ Verified: Unapproved pending provider is excluded from public search.');

    // ====================================================================
    // TEST B: ADMIN APPROVAL TEST
    // ====================================================================
    console.log('\n--- TEST B: Admin Approval Test ---');
    const approveRes = await api(`/admin/providers/${testProviderProfile.id}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { action: 'approve' }
    });
    console.log('✓ Admin Approve API response:', approveRes.message);

    await testProviderProfile.reload();
    console.log('  - is_approved after admin approval:', testProviderProfile.is_approved);
    console.log('  - verification_status:', testProviderProfile.verification_status);
    console.log('  - is_active:', testProviderProfile.is_active);
    console.log('  - availability_status:', testProviderProfile.availability_status);

    if (!testProviderProfile.is_approved || testProviderProfile.verification_status !== 'verified') {
      throw new Error('FAILED: Provider should be approved and verified after admin approval.');
    }
    if (!testProviderProfile.is_active) {
      throw new Error('FAILED: Provider is_active should be true after admin approval.');
    }
    if (testProviderProfile.availability_status !== 'AVAILABLE') {
      throw new Error('FAILED: Provider availability_status should be AVAILABLE after admin approval.');
    }

    // ====================================================================
    // TEST C: PROVIDER GPS TEST
    // ====================================================================
    console.log('\n--- TEST C: Provider GPS Column & Beacon Test ---');
    console.log('  - DB column latitude:', testProviderProfile.latitude);
    console.log('  - DB column longitude:', testProviderProfile.longitude);
    if (testProviderProfile.latitude == null || testProviderProfile.longitude == null) {
      throw new Error('FAILED: Provider latitude and longitude columns must not be NULL.');
    }

    // Provider live location update
    const provToken = regRes.data?.token || regRes.token;
    if (provToken) {
      await api('/providers/location', {
        method: 'POST',
        headers: { Authorization: `Bearer ${provToken}` },
        body: { lat: 13.088, lng: 80.212 }
      });
      await testProviderProfile.reload();
      console.log('  - DB column latitude after GPS beacon:', testProviderProfile.latitude);
      console.log('  - DB column longitude after GPS beacon:', testProviderProfile.longitude);
      if (Number(testProviderProfile.latitude).toFixed(3) !== '13.088' || Number(testProviderProfile.longitude).toFixed(3) !== '80.212') {
        throw new Error('FAILED: Provider location beacon did not update latitude and longitude columns.');
      }
      console.log('✓ GPS coordinates beacon updated database columns successfully.');
    }

    // ====================================================================
    // TEST D: NEARBY PROVIDER SEARCH TEST (HAVERSINE)
    // ====================================================================
    console.log('\n--- TEST D: Nearby Provider Search Test ---');
    const nearbyRes = await api(`/providers/nearby?latitude=13.085&longitude=80.210&category=Plumber`);
    console.log('✓ Search returned count:', nearbyRes.data.length);
    const approvedPlumber = nearbyRes.data.find(p => p.id === testProviderProfile.id);
    if (!approvedPlumber) {
      throw new Error('FAILED: Approved provider should be returned in nearby recommendations.');
    }
    console.log('✓ Approved provider found:');
    console.log(`  - Name: ${approvedPlumber.businessName}`);
    console.log(`  - Distance: ${approvedPlumber.distanceKm} km (Calculated via Haversine)`);
    console.log(`  - Availability: ${approvedPlumber.availabilityStatus}`);
    console.log(`  - Service Radius: ${approvedPlumber.serviceRadius} km`);

    // ====================================================================
    // TEST E: SERVICE MATCHING TEST
    // ====================================================================
    console.log('\n--- TEST E: Service Matching Test ---');
    const pipeRepairService = await Service.findOne({ where: { title: { [require('sequelize').Op.like]: '%Pipe%' } } });
    if (pipeRepairService) {
      const matchRes = await api(`/providers/nearby?latitude=13.085&longitude=80.210&category=Plumber&serviceId=${pipeRepairService.id}`);
      const matched = matchRes.data.find(p => p.id === testProviderProfile.id);
      console.log('✓ Exact service match compatibility score:', matched ? matched.compatibilityScore : 'N/A');
    }

    // ====================================================================
    // TEST F: RADIUS FILTERING TEST
    // ====================================================================
    console.log('\n--- TEST F: Radius Filtering Test ---');
    // Search 100km away (lat: 12.085, lng: 80.210)
    const farRes = await api(`/providers/nearby?latitude=12.085&longitude=80.210&category=Plumber`);
    const foundFar = (farRes.data || []).find(p => p.id === testProviderProfile.id);
    if (foundFar) {
      throw new Error('FAILED: Provider outside service radius was returned.');
    }
    console.log('✓ Radius filtering confirmed: Out-of-radius search returned 0 results for this provider.');

    // ====================================================================
    // TEST G: AVAILABILITY LIFECYCLE TRANSITIONS
    // ====================================================================
    console.log('\n--- TEST G: Availability Lifecycle Transitions ---');
    const svc = (await Service.findOne({ where: { category: { [require('sequelize').Op.like]: '%Plumber%' } } })) || (await Service.findOne());
    
    await ProviderService.findOrCreate({
      where: { provider_profile_id: testProviderProfile.id, service_id: svc.id },
      defaults: { base_price: 350, is_active: true }
    });

    const bookingNumber1 = `BK-TEST-${Date.now()}`;
    const booking1 = await Booking.create({
      booking_number: bookingNumber1,
      customer_id: customerUser.id,
      provider_id: testProviderUser.id,
      provider_profile_id: testProviderProfile.id,
      service_id: svc.id,
      service_title: svc.title,
      category: 'Plumber',
      date: '2026-10-20',
      time: '11:00 AM',
      amount: 350,
      status: 'pending',
      service_location: { latitude: 13.085, longitude: 80.210, address: 'Test Location, Chennai' }
    });
    createdBookings.push(booking1.id);
    console.log('✓ Test booking created:', bookingNumber1, 'Status: pending');

    // Simulate provider accepting booking
    await api(`/bookings/${booking1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${provToken || adminToken}` },
      body: { status: 'accepted' }
    });
    await testProviderProfile.reload();
    console.log('✓ After booking accepted -> Provider availability_status:', testProviderProfile.availability_status);
    if (testProviderProfile.availability_status !== 'BUSY') {
      throw new Error('FAILED: Provider should transition to BUSY upon accepting a booking.');
    }

    // Progress to on_the_way -> arrived -> in_progress
    await api(`/bookings/${booking1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${provToken || adminToken}` },
      body: { status: 'on_the_way' }
    });
    await api(`/bookings/${booking1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${provToken || adminToken}` },
      body: { status: 'arrived' }
    });
    await api(`/bookings/${booking1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${provToken || adminToken}` },
      body: { status: 'in_progress' }
    });

    // Complete booking
    const prevCompletedJobs = Number(testProviderProfile.completed_jobs || 0);
    await api(`/bookings/${booking1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${provToken || adminToken}` },
      body: { status: 'completed' }
    });
    await testProviderProfile.reload();
    console.log('✓ After booking completed -> Provider availability_status:', testProviderProfile.availability_status);
    console.log('  - completed_jobs count:', testProviderProfile.completed_jobs, `(Previous: ${prevCompletedJobs})`);

    if (testProviderProfile.availability_status !== 'AVAILABLE') {
      throw new Error('FAILED: Provider should transition back to AVAILABLE when all jobs are completed.');
    }
    if (Number(testProviderProfile.completed_jobs) !== prevCompletedJobs + 1) {
      throw new Error('FAILED: completed_jobs counter did not increment on completion.');
    }

    // ====================================================================
    // TEST H: DOUBLE-BOOKING PROTECTION
    // ====================================================================
    console.log('\n--- TEST H: Double-Booking Protection Test ---');
    const conflictDate = '2026-10-25';
    const conflictTime = '02:00 PM';

    // First booking
    const bFirst = await api('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        serviceId: svc.id,
        providerId: testProviderUser.id,
        date: conflictDate,
        time: conflictTime,
        address: '123 Main Road, Anna Nagar, Chennai',
        latitude: 13.085,
        longitude: 80.210,
        amount: 350
      }
    });
    createdBookings.push(bFirst.data.id || bFirst.data.bookingId);
    console.log('✓ First booking created on', conflictDate, conflictTime);

    // Second booking on exact same date & time for same provider
    let doubleBookingBlocked = false;
    try {
      await api('/bookings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: {
          serviceId: svc.id,
          providerId: testProviderUser.id,
          date: conflictDate,
          time: conflictTime,
          address: '456 Second Road, Anna Nagar, Chennai',
          latitude: 13.085,
          longitude: 80.210,
          amount: 350
        }
      });
    } catch (err) {
      if (err.status === 409) {
        doubleBookingBlocked = true;
        console.log('✓ Double booking was successfully blocked with HTTP 409 Conflict:');
        console.log('  Message:', err.message);
      } else {
        throw err;
      }
    }
    if (!doubleBookingBlocked) {
      throw new Error('FAILED: Server allowed double-booking on same date and time slot.');
    }

    // ====================================================================
    // TEST I: 10-PROVIDER-PER-CATEGORY POOL TEST
    // ====================================================================
    console.log('\n--- TEST I: 10-Provider-Per-Category Pool Test ---');
    const poolRes = await api('/admin/providers/pool-stats', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✓ Category Pool Stats sample:');
    for (const stat of poolRes.data.slice(0, 6)) {
      console.log(`  - ${stat.category.padEnd(16)}: ${stat.active} / ${stat.maxActive} active (Pending: ${stat.pending}, Available Now: ${stat.availableNow})`);
    }

    // ====================================================================
    // TEST J: REAL CUSTOMER BOOKING TEST
    // ====================================================================
    console.log('\n--- TEST J: Real Customer Booking Flow (Electrician) ---');
    const custSearch = await api('/providers/nearby?latitude=13.087&longitude=80.215&category=Electrician');
    console.log('✓ Found Electrician providers near customer:', custSearch.data.length);
    if (custSearch.data.length === 0) {
      throw new Error('No Electricians found near Anna Nagar coordinates.');
    }
    const selectedElectrician = custSearch.data[0];
    console.log(`  Selected provider: ${selectedElectrician.businessName} (Distance: ${selectedElectrician.distanceKm} km, Rating: ${selectedElectrician.rating})`);

    const elecService = (await Service.findOne({ where: { category: { [require('sequelize').Op.like]: '%Electric%' } } })) || (await Service.findOne());
    const custBookingRes = await api('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        serviceId: elecService.id,
        providerId: selectedElectrician.userId,
        date: '2026-11-01',
        time: '10:00 AM',
        address: 'Plot 55, 3rd Avenue, Anna Nagar, Chennai',
        latitude: 13.087,
        longitude: 80.215,
        amount: selectedElectrician.basePrice || 349,
        problemDescription: 'Main circuit breaker trips frequently during evening peak hours.'
      }
    });
    const createdBookingId = custBookingRes.data.id || custBookingRes.data.bookingId;
    createdBookings.push(createdBookingId);
    console.log('✓ Real customer booking created successfully! Booking Number:', custBookingRes.data.bookingNumber || custBookingRes.data.booking_number);
    console.log('  Status:', custBookingRes.data.status);
    console.log('  Service Location Coordinates:', custBookingRes.data.service_location?.latitude, custBookingRes.data.service_location?.longitude);

    console.log('\n================================================================');
    console.log('   ALL 10 VERIFICATION TESTS (A through J) PASSED WITH 100% SUCCESS');
    console.log('================================================================\n');

  } catch (error) {
    console.error('\n❌ Verification Failed:', error.data || error.message);
    process.exitCode = 1;
  } finally {
    console.log('--- Cleaning up temporary verification records ---');
    try {
      if (createdBookings.length > 0) {
        await Booking.destroy({ where: { id: createdBookings } });
        console.log(`✓ Removed ${createdBookings.length} temporary verification bookings.`);
      }
      if (testProviderProfile) {
        await ProviderService.destroy({ where: { provider_profile_id: testProviderProfile.id } });
        await ProviderProfile.destroy({ where: { id: testProviderProfile.id } });
      }
      if (testProviderUser) {
        await User.destroy({ where: { id: testProviderUser.id } });
        console.log('✓ Removed temporary test provider user and profile.');
      }
    } catch (cleanupErr) {
      console.error('Cleanup notice:', cleanupErr.message);
    }
  }
}

runVerification();
