const bcrypt = require('bcryptjs');
const { sequelize, User, ProviderProfile, Service, ProviderService, Booking, Notification } = require('../models');

const API_URL = 'http://localhost:5000/api';

async function api(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function runE2ETests() {
  console.log('=== FIXIT LOCAL END-TO-END VERIFICATION ===\n');

  try {
    // 1. EXACT DEFAULT ACCOUNTS CHECK
    console.log('[1/8] Verifying Exact Default Accounts in MySQL...');
    const users = await User.findAll({ order: [['id', 'ASC']] });
    console.log(`Found ${users.length} users in database:`);
    users.forEach(u => console.log(`  - ID: ${u.id} | ${u.email} | Role: ${u.role} | Status: ${u.status}`));

    if (users.length !== 8) {
      throw new Error(`Expected exactly 8 users, but found ${users.length}`);
    }

    // Verify Password@123 on all 8 accounts
    for (const u of users) {
      const isMatch = await bcrypt.compare('Password@123', u.password);
      if (!isMatch) {
        throw new Error(`Password check failed for ${u.email}`);
      }
    }
    console.log('✔ All 8 default accounts have valid Password@123 credentials.\n');

    // 2. CANONICAL SERVICES & PROVIDER MAPPINGS CHECK
    console.log('[2/8] Verifying Canonical Services & Provider Services...');
    const services = await Service.findAll({ where: { is_active: true } });
    console.log(`Found ${services.length} active master services:`);
    for (const s of services) {
      const mapping = await ProviderService.findOne({
        where: { service_id: s.id },
        include: [{
          model: ProviderProfile,
          as: 'providerProfile',
          include: [{ model: User, as: 'user' }]
        }]
      });
      const provName = mapping?.providerProfile?.business_name || mapping?.providerProfile?.user?.name || 'Unassigned';
      const provEmail = mapping?.providerProfile?.user?.email || 'N/A';
      console.log(`  - #${s.id} "${s.title}" (${s.category}) | Price: ₹${s.price} | Custom: ₹${mapping?.custom_price} | Provider: ${provName} (${provEmail})`);
    }

    // Specifically verify Yaazh -> Electrical Wiring -> ₹349
    const yaazhUser = await User.findOne({ where: { email: 'yaazh@gmail.com' } });
    const yaazhProfile = await ProviderProfile.findOne({ where: { user_id: yaazhUser.id } });
    const elecService = await Service.findOne({ where: { title: 'Electrical Wiring' } });
    const yaazhMapping = await ProviderService.findOne({
      where: { provider_profile_id: yaazhProfile.id, service_id: elecService.id }
    });

    if (!yaazhMapping || yaazhMapping.custom_price !== 349) {
      throw new Error(`Yaazh mapping to Electrical Wiring with custom_price=349 not found! Mapping: ${JSON.stringify(yaazhMapping)}`);
    }
    console.log('✔ Yaazh is correctly mapped to Electrical Wiring at ₹349.\n');

    // 3. AUTHENTICATION & LOGIN FLOW
    console.log('[3/8] Testing Authentication...');
    const radhaLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'radha@gmail.com', password: 'Password@123' }
    });
    const customerToken = radhaLogin.data.token;
    console.log('✔ Customer Radha login successful (JWT acquired).');

    const yaazhLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'yaazh@gmail.com', password: 'Password@123' }
    });
    const providerToken = yaazhLogin.data.token;
    console.log('✔ Provider Yaazh login successful (JWT acquired).');

    const adminLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'santhiyam0603@gmail.com', password: 'Password@123' }
    });
    const adminToken = adminLogin.data.token;
    console.log('✔ Admin Santhiya login successful (JWT acquired).\n');

    // 4. BOOKING VALIDATION RULES
    console.log('[4/8] Testing Booking Validation Rules...');

    // Rule A: Provider attempts to book a service -> MUST fail with 403
    try {
      await api('/bookings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${providerToken}` },
        body: {
          serviceId: elecService.id,
          providerId: yaazhProfile.id,
          date: '2026-09-15',
          time: '10:00 AM'
        }
      });
      throw new Error('Provider booking should have been rejected with 403!');
    } catch (err) {
      if (err.status === 403 && err.data?.message === 'Only customer accounts can book services.') {
        console.log('✔ Rule 1 Passed: Provider booking attempt rejected with 403: "Only customer accounts can book services."');
      } else {
        throw new Error(`Unexpected error on provider booking: ${err.message}`);
      }
    }

    // Rule B: Customer books with provider who does NOT offer that service -> MUST fail with 400
    const acService = await Service.findOne({ where: { title: 'AC Repair & Service' } });
    try {
      await api('/bookings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: {
          serviceId: acService.id,
          providerId: yaazhProfile.id, // Yaazh only offers Electrical Wiring
          date: '2026-09-15',
          time: '10:00 AM'
        }
      });
      throw new Error('Mismatched provider-service booking should have been rejected with 400!');
    } catch (err) {
      if (err.status === 400 && err.data?.message === 'The selected provider does not offer this service.') {
        console.log('✔ Rule 2 Passed: Provider-service mismatch rejected with 400: "The selected provider does not offer this service."');
      } else {
        throw new Error(`Unexpected error on mismatched booking: ${err.message}`);
      }
    }

    // Rule C: Valid booking of Electrical Wiring with Yaazh at ₹349
    // Clear previous notifications to test isolation
    await Notification.destroy({ where: {} });

    const createRes = await api('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        serviceId: elecService.id,
        providerId: yaazhProfile.id,
        date: '2026-09-15',
        time: '11:00 AM',
        paymentMethod: 'cash',
        customerNotes: 'Living room light switch and wiring check'
      }
    });

    const createdBooking = createRes.data;
    console.log(`✔ Rule 3 Passed: Booking #${createdBooking.booking_number} created successfully!`);
    console.log(`  - Service: ${createdBooking.service_title}`);
    console.log(`  - Provider: ${createdBooking.provider?.name} (Profile ID: ${createdBooking.provider_profile_id})`);
    console.log(`  - Amount: ₹${createdBooking.amount}`);
    console.log(`  - Status: ${createdBooking.status}`);

    if (createdBooking.amount !== 349) {
      throw new Error(`Expected booking amount to be 349, but got ${createdBooking.amount}`);
    }

    // 5. NOTIFICATION TARGETING & PRIVACY CHECK
    console.log('\n[5/8] Verifying Targeted Notification Dispatch...');
    const allNotifs = await Notification.findAll();
    console.log(`Total notifications generated: ${allNotifs.length}`);

    // Check Customer notification
    const custNotif = await Notification.findOne({ where: { recipient_id: radhaLogin.data.user.id } });
    if (!custNotif) throw new Error('Customer Radha did not receive booking confirmation notification!');
    console.log(`✔ Customer notification: "${custNotif.title}" - ${custNotif.message}`);

    // Check Yaazh notification
    const yaazhNotif = await Notification.findOne({ where: { recipient_id: yaazhUser.id } });
    if (!yaazhNotif) throw new Error('Assigned Provider Yaazh did not receive service request notification!');
    console.log(`✔ Assigned Provider notification: "${yaazhNotif.title}" - ${yaazhNotif.message}`);

    // Check Admin notification
    const adminNotif = await Notification.findOne({ where: { recipient_id: adminLogin.data.user.id } });
    if (!adminNotif) throw new Error('Admin did not receive booking notification!');
    console.log(`✔ Admin notification: "${adminNotif.title}" - ${adminNotif.message}`);

    // Check Other 5 Providers have ZERO notifications
    const otherProviders = await User.findAll({
      where: {
        role: 'provider',
        id: { [sequelize.Sequelize.Op.ne]: yaazhUser.id }
      }
    });

    for (const op of otherProviders) {
      const opNotif = await Notification.findOne({ where: { recipient_id: op.id } });
      if (opNotif) {
        throw new Error(`Unrelated provider ${op.email} leaked a notification: ${JSON.stringify(opNotif)}`);
      }
    }
    console.log(`✔ Privacy Verified: All ${otherProviders.length} unrelated providers received exactly 0 notifications.\n`);

    // 6. PROVIDER ACCEPTS BOOKING
    console.log('[6/8] Provider Yaazh accepts booking...');
    const acceptRes = await api(`/bookings/${createdBooking.id}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: { status: 'accepted' }
    });
    console.log(`✔ Booking updated to status: ${acceptRes.data.status}`);

    // Check that customer got an accepted notification
    const acceptNotif = await Notification.findOne({
      where: {
        recipient_id: radhaLogin.data.user.id,
        title: 'Booking Accepted'
      }
    });
    if (!acceptNotif) throw new Error('Customer did not receive Booking Accepted notification!');
    console.log(`✔ Customer received notification: "${acceptNotif.title}" - ${acceptNotif.message}\n`);

    // 7. ADMIN MANAGE USERS API
    console.log('[7/8] Testing Admin User Management APIs...');
    const adminUsersRes = await api('/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminUsersList = adminUsersRes.data;
    console.log(`✔ Admin GET /api/admin/users returned ${adminUsersList.length} users.`);

    // Get single user details
    const userDetailRes = await api(`/admin/users/${yaazhUser.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`✔ Admin GET /api/admin/users/${yaazhUser.id} returned profile: "${userDetailRes.data.providerProfile?.business_name}"`);

    // Admin self-deletion prevention
    try {
      await api(`/admin/users/${adminLogin.data.user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      throw new Error('Admin self-deletion should have been rejected!');
    } catch (err) {
      if (err.status === 400 && err.data?.message && err.data.message.includes('delete your own admin account')) {
        console.log(`✔ Admin self-deletion prevented: "${err.data.message}"`);
      } else {
        throw new Error(`Unexpected error on admin self-deletion: ${err.message}`);
      }
    }
    console.log('✔ Admin user management validated.\n');

    // 8. DYNAMIC PROVIDER REGISTRATION FLOW
    console.log('[8/8] Testing Dynamic Provider Registration Flow...');
    const regRes = await api('/auth/register', {
      method: 'POST',
      body: {
        name: 'Test Tech',
        fullName: 'Test Tech',
        username: 'testtech',
        email: 'testtech@fixit.com',
        password: 'Password@123',
        role: 'provider',
        phone: '9840999999',
        address: 'Velachery, Chennai',
        city: 'Chennai',
        serviceArea: 'Velachery',
        businessName: 'Test Tech Solutions',
        serviceId: acService.id,
        experienceYears: 4,
        skills: 'AC Service, Cleaning',
        bio: 'Professional AC specialist with 4 years experience.'
      }
    });

    const newProv = regRes.data.user;
    console.log(`✔ Provider registered: ${newProv.email} | Status: ${newProv.status} | Role: ${newProv.role}`);

    // Verify junction entry created immediately
    const junctionCheck = await ProviderService.findOne({
      where: {
        provider_profile_id: newProv.providerProfile.id,
        service_id: acService.id
      }
    });

    if (!junctionCheck) {
      throw new Error('ProviderService junction row was not created automatically upon registration!');
    }
    console.log(`✔ ProviderService junction row automatically created: Profile #${junctionCheck.provider_profile_id} -> Service #${junctionCheck.service_id}`);

    // Clean up test provider to keep exactly 8 default accounts
    await ProviderService.destroy({ where: { provider_profile_id: newProv.providerProfile.id } });
    await ProviderProfile.destroy({ where: { id: newProv.providerProfile.id } });
    await User.destroy({ where: { id: newProv.id } });
    console.log('✔ Test provider cleaned up. MySQL reverted to exact 8 canonical default accounts.\n');

    // Final user count verification
    const finalCount = await User.count();
    console.log(`FINAL USER COUNT IN MYSQL: ${finalCount}`);
    if (finalCount !== 8) {
      throw new Error(`Final user count expected 8, but found ${finalCount}`);
    }

    console.log('\n=========================================');
    console.log('🎉 ALL END-TO-END VERIFICATIONS PASSED! 🎉');
    console.log('=========================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error.message);
    if (error.data) {
      console.error('API Response Data:', error.data);
    }
    process.exit(1);
  }
}

runE2ETests();
