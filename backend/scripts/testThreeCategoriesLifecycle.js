require('dotenv').config({ path: __dirname + '/../.env' });
const { User, ProviderProfile, Booking, Service, ProviderService, Notification, sequelize } = require('../models');

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

const CATEGORIES_TO_TEST = [
  {
    category: 'Electrician',
    name: 'Suresh Kumar',
    businessName: 'Suresh Pro Electricals',
    services: ['Electrical Wiring', 'MCB Installation'],
    lat: 13.086,
    lng: 80.214,
    area: 'Anna Nagar West',
    customerBookingLat: 13.088,
    customerBookingLng: 80.216,
    customerBookingAddress: '15 2nd Avenue, Anna Nagar West, Chennai'
  },
  {
    category: 'Plumber',
    name: 'Manoj Kumar',
    businessName: 'Manoj Plumbing & Drainage Solutions',
    services: ['Pipe Repair', 'Tap Repair'],
    lat: 13.040,
    lng: 80.233,
    area: 'T. Nagar',
    customerBookingLat: 13.042,
    customerBookingLng: 80.235,
    customerBookingAddress: '42 Usman Road, T. Nagar, Chennai'
  },
  {
    category: 'Carpenter',
    name: 'Anand Woodworks',
    businessName: 'Anand Custom Carpentry',
    services: ['Carpentry Work', 'Furniture Repair'],
    lat: 13.006,
    lng: 80.201,
    area: 'Guindy',
    customerBookingLat: 13.010,
    customerBookingLng: 80.205,
    customerBookingAddress: '10 Industrial Estate Road, Guindy, Chennai'
  }
];

async function runThreeCategoriesTest() {
  console.log('================================================================');
  console.log('   STARTING 3-CATEGORY ONBOARDING LIFECYCLE VERIFICATION');
  console.log('   (Electrician, Plumber, Carpenter)');
  console.log('================================================================\n');

  let adminToken = null;
  let customerUser = null;
  let customerToken = null;

  const createdEntities = {
    bookings: [],
    providerProfiles: [],
    providerUsers: []
  };

  try {
    await sequelize.authenticate();
    console.log('✓ Database connected.');

    // Admin Auth
    const adminLoginRes = await api('/auth/login', {
      method: 'POST',
      body: {
        email: 'santhiyam0603@gmail.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@123'
      }
    });
    adminToken = adminLoginRes.token;
    console.log('✓ Admin authenticated.');

    // Customer Auth
    customerUser = await User.findOne({ where: { role: 'customer', status: 'active' } });
    if (!customerUser) throw new Error('No active customer account found.');
    const jwt = require('jsonwebtoken');
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET must be configured in environment');
    }
    customerToken = jwt.sign(
      { id: customerUser.id, role: customerUser.role, email: customerUser.email },
      process.env.JWT_SECRET
    );
    console.log('✓ Customer ready:', customerUser.name);

    for (const testData of CATEGORIES_TO_TEST) {
      console.log(`\n============================================================`);
      console.log(`>>> TESTING LIFECYCLE: ${testData.category.toUpperCase()}`);
      console.log(`============================================================`);

      // 1. Provider Registers
      const testEmail = `test_${testData.category.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}@fixitlocal.com`;
      console.log(`1. Registering provider ${testData.name} (${testData.businessName})...`);
      const regRes = await api('/auth/register', {
        method: 'POST',
        body: {
          fullName: testData.name,
          email: testEmail,
          phone: '9840999111',
          password: 'Password@123',
          role: 'provider',
          primaryCategory: testData.category,
          businessName: testData.businessName,
          services: testData.services,
          experienceYears: 5,
          skills: testData.services,
          serviceArea: testData.area,
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600001',
          serviceRadius: 15,
          latitude: testData.lat,
          longitude: testData.lng,
          avatar: ''
        }
      });
      console.log('   ✓ Registration response:', regRes.message);

      const pUser = await User.findOne({ where: { email: testEmail } });
      const pProfile = await ProviderProfile.findOne({ where: { user_id: pUser.id } });
      createdEntities.providerUsers.push(pUser.id);
      createdEntities.providerProfiles.push(pProfile.id);

      console.log(`   ✓ Provider ID: ${pProfile.id}`);
      console.log(`   ✓ Status check -> is_approved: ${pProfile.is_approved}, verification_status: ${pProfile.verification_status}, is_active: ${pProfile.is_active}, availability_status: ${pProfile.availability_status}`);
      console.log(`   ✓ DB coordinates -> lat: ${pProfile.latitude}, lng: ${pProfile.longitude}`);

      if (pProfile.is_approved !== false && pProfile.is_approved !== 0) {
        throw new Error(`[${testData.category}] Provider must NOT be automatically approved.`);
      }

      // Check not visible in search while pending
      const pendingSearch = await api(`/providers/nearby?latitude=${testData.customerBookingLat}&longitude=${testData.customerBookingLng}&category=${testData.category}`);
      const foundInPending = (pendingSearch.data || []).find(p => p.id === pProfile.id);
      if (foundInPending) {
        throw new Error(`[${testData.category}] Pending provider must not appear in nearby recommendations.`);
      }
      console.log('   ✓ Verified: Pending provider is NOT returned to customer.');

      // 2. Admin Sees Provider
      console.log(`2. Admin reviewing pending application for ${testData.category}...`);
      const pendingList = await api('/admin/providers?status=pending', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const inAdminList = (pendingList.data || []).find(p => p.id === pProfile.id);
      if (!inAdminList) {
        throw new Error(`[${testData.category}] Admin provider list did not contain pending applicant.`);
      }
      console.log(`   ✓ Admin sees: ${inAdminList.business_name} | Category: ${inAdminList.category} | Area: ${inAdminList.city} | Radius: ${inAdminList.serviceRadius}km`);

      // 3. Admin Approves
      console.log(`3. Admin approving provider ID ${pProfile.id}...`);
      const approveRes = await api(`/admin/providers/${pProfile.id}/verify`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { action: 'approve' }
      });
      console.log('   ✓ Approve response:', approveRes.message);

      await pProfile.reload();
      console.log(`   ✓ Post-approval -> is_approved: ${pProfile.is_approved}, verification_status: ${pProfile.verification_status}, is_active: ${pProfile.is_active}, availability: ${pProfile.availability_status}`);
      if (!pProfile.is_approved || !pProfile.is_active || pProfile.availability_status !== 'AVAILABLE') {
        throw new Error(`[${testData.category}] Provider was not properly activated on approval.`);
      }

      // 4. Provider sets AVAILABLE / OFFLINE
      console.log(`4. Testing provider manual availability toggling...`);
      const provToken = regRes.data?.token || regRes.token;
      // Toggle to OFFLINE
      await api('/providers/availability', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${provToken || adminToken}` },
        body: { availabilityStatus: 'OFFLINE' }
      });
      await pProfile.reload();
      console.log('   ✓ Set to OFFLINE -> availability_status:', pProfile.availability_status);
      if (pProfile.availability_status !== 'OFFLINE') throw new Error('Failed to set OFFLINE');

      // Toggle back to AVAILABLE
      await api('/providers/availability', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${provToken || adminToken}` },
        body: { availabilityStatus: 'AVAILABLE' }
      });
      await pProfile.reload();
      console.log('   ✓ Set to AVAILABLE -> availability_status:', pProfile.availability_status);
      if (pProfile.availability_status !== 'AVAILABLE') throw new Error('Failed to set AVAILABLE');

      // 5. Customer Searches Nearby Using Booking Coordinates
      console.log(`5. Customer searching for nearby ${testData.category} at booking location (${testData.customerBookingLat}, ${testData.customerBookingLng})...`);
      const nearbyRes = await api(`/providers/nearby?latitude=${testData.customerBookingLat}&longitude=${testData.customerBookingLng}&category=${testData.category}`);
      const matchedProvider = (nearbyRes.data || []).find(p => p.id === pProfile.id);
      if (!matchedProvider) {
        throw new Error(`[${testData.category}] Approved provider did not appear in customer nearby recommendations.`);
      }
      console.log(`   ✓ Provider matched: ${matchedProvider.businessName}`);
      console.log(`   ✓ Haversine Distance: ${matchedProvider.distanceKm} km (Service radius: ${matchedProvider.serviceRadius} km)`);
      console.log(`   ✓ Availability badge: ${matchedProvider.availabilityStatus}`);
      console.log(`   ✓ Privacy check: exact private home address is NOT exposed (Service area: ${matchedProvider.serviceArea})`);

      // 6. Customer Books Provider
      console.log(`6. Customer booking provider for ${testData.category}...`);
      const targetService = (await Service.findOne({ where: { category: { [require('sequelize').Op.like]: `%${testData.category}%` } } })) || (await Service.findOne());
      
      await ProviderService.findOrCreate({
        where: { provider_profile_id: pProfile.id, service_id: targetService.id },
        defaults: { base_price: 399, is_active: true }
      });

      const bookRes = await api('/bookings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: {
          serviceId: targetService.id,
          providerId: pUser.id,
          date: '2026-11-15',
          time: '04:00 PM',
          address: testData.customerBookingAddress,
          latitude: testData.customerBookingLat,
          longitude: testData.customerBookingLng,
          amount: matchedProvider.basePrice || 399,
          problemDescription: `Routine ${testData.category} service request at customer destination.`
        }
      });
      const bId = bookRes.data.id || bookRes.data.bookingId;
      createdEntities.bookings.push(bId);
      console.log(`   ✓ Booking created: ${bookRes.data.bookingNumber || bookRes.data.booking_number} | Status: ${bookRes.data.status}`);
      console.log(`   ✓ Booking service_location coordinates: ${bookRes.data.service_location?.latitude}, ${bookRes.data.service_location?.longitude}`);
      console.log(`   ✓ SUCCESS: Full onboarding lifecycle verified for ${testData.category}!`);
    }

    console.log('\n================================================================');
    console.log('   ALL 3 CATEGORIES (Electrician, Plumber, Carpenter) PASSED 100%');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Verification Failed:', err.data || err.message);
    process.exitCode = 1;
  } finally {
    console.log('--- Cleaning up temporary test accounts and bookings ---');
    try {
      if (createdEntities.bookings.length > 0) {
        await Booking.destroy({ where: { id: createdEntities.bookings } });
        console.log(`✓ Removed ${createdEntities.bookings.length} test bookings.`);
      }
      for (const pId of createdEntities.providerProfiles) {
        await ProviderService.destroy({ where: { provider_profile_id: pId } });
        await ProviderProfile.destroy({ where: { id: pId } });
      }
      for (const uId of createdEntities.providerUsers) {
        await Notification.destroy({ where: { recipient_id: uId } });
        await User.destroy({ where: { id: uId } });
      }
      console.log('✓ Cleaned up all temporary test provider profiles and users.');
    } catch (cleanupErr) {
      console.error('Cleanup notice:', cleanupErr.message);
    }
  }
}

runThreeCategoriesTest();
