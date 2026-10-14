const BASE_URL = 'http://localhost:5000/api';

async function req(url, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=== STARTING COMPLETE VERIFICATION OF FIXIT LOCAL ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. TEST AUTHENTICATION FOR ALL 8 ACCOUNTS
  console.log('--- 1. Testing Logins for All 8 Required Accounts ---');
  const accounts = [
    { email: 'santhiyam0603@gmail.com', role: 'admin' },
    { email: 'radha@gmail.com', role: 'customer' },
    { email: 'arun@gmail.com', role: 'provider' },
    { email: 'priya@gmail.com', role: 'provider' },
    { email: 'riyas@gmail.com', role: 'provider' },
    { email: 'yaazh@gmail.com', role: 'provider' },
    { email: 'deva@gmail.com', role: 'provider' },
    { email: 'siva@gmail.com', role: 'provider' },
  ];

  const tokens = {};
  const userObjects = {};

  for (const acc of accounts) {
    try {
      const res = await req(`${BASE_URL}/auth/login`, 'POST', {
        email: acc.email,
        password: 'Password@123'
      });
      assert(
        res.ok && res.data.success && res.data.data.user.role === acc.role,
        `Login succeeded for ${acc.email} (Role: ${acc.role})`
      );
      tokens[acc.email] = res.data.data?.token;
      userObjects[acc.email] = res.data.data?.user;
    } catch (err) {
      assert(false, `Login failed for ${acc.email}: ${err.message}`);
    }
  }

  // 2. TEST CANONICAL SERVICES CATALOG
  console.log('\n--- 2. Testing Canonical Master Services Catalog ---');
  let services = [];
  try {
    const res = await req(`${BASE_URL}/services`);
    assert(res.ok && res.data.success, 'Fetched master services catalog');
    services = res.data.data || [];
    const titles = services.map(s => s.title);
    console.log('  Found services:', titles);
    const expectedServices = [
      'AC Repair & Service',
      'Deep Home Cleaning',
      'Plumbing Fix',
      'Electrical Wiring',
      'Pest Control',
      'Carpentry Work'
    ];
    for (const exp of expectedServices) {
      assert(titles.includes(exp), `Service catalog contains "${exp}"`);
    }
  } catch (err) {
    assert(false, `Failed to fetch services: ${err.message}`);
  }

  // 3. TEST PROVIDER PROFILES AND SERVICE MAPPINGS
  console.log('\n--- 3. Testing Provider Profiles and Service Mappings ---');
  try {
    const res = await req(`${BASE_URL}/providers`);
    assert(res.ok && res.data.success, 'Fetched active provider profiles');
    const providers = res.data.data || [];
    assert(providers.length >= 6, `Found ${providers.length} providers (expected at least 6)`);

    const expectedMappings = {
      'arun@gmail.com': 'AC Repair',
      'priya@gmail.com': 'Cleaning',
      'riyas@gmail.com': 'Plumbing',
      'yaazh@gmail.com': 'Electrical',
      'deva@gmail.com': 'Pest Control',
      'siva@gmail.com': 'Carpentry'
    };

    for (const [pEmail, expCat] of Object.entries(expectedMappings)) {
      const prov = providers.find(p => p.user?.email === pEmail);
      assert(
        prov && prov.category.toLowerCase().includes(expCat.toLowerCase()),
        `Provider ${pEmail} correctly categorized as ${expCat}`
      );
    }
  } catch (err) {
    assert(false, `Failed to verify provider mappings: ${err.message}`);
  }

  // 4. TEST CUSTOMER BOOKING FLOW AND TARGETED NOTIFICATIONS
  console.log('\n--- 4. Testing Booking Creation & Targeted Notifications ---');
  let createdBooking = null;
  const arunUser = userObjects['arun@gmail.com'];
  const acService = services.find(s => s.title === 'AC Repair & Service');

  try {
    const notifsBefore = {};
    for (const acc of accounts) {
      const nRes = await req(`${BASE_URL}/notifications`, 'GET', null, tokens[acc.email]);
      notifsBefore[acc.email] = nRes.data?.data?.notifications?.length || 0;
    }

    const bookRes = await req(
      `${BASE_URL}/bookings`,
      'POST',
      {
        serviceId: acService.id,
        providerId: arunUser.id,
        date: `2026-11-${Math.floor(Math.random() * 20) + 10}`,
        time: `${Math.floor(Math.random() * 8) + 1}:00 PM`,
        address: {
          street: '123 Test Street',
          city: 'Chennai',
          pincode: '600001'
        },
        paymentMethod: 'cash'
      },
      tokens['radha@gmail.com']
    );

    assert(bookRes.ok && bookRes.data.success, `Radha created booking #${bookRes.data.data?.booking_number}`);
    createdBooking = bookRes.data.data;

    // Check notifications for each account
    const notifsAfter = {};
    for (const acc of accounts) {
      const nRes = await req(`${BASE_URL}/notifications`, 'GET', null, tokens[acc.email]);
      notifsAfter[acc.email] = nRes.data?.data?.notifications?.length || 0;
    }

    // Customer Radha should have received +1 notification
    assert(
      notifsAfter['radha@gmail.com'] > notifsBefore['radha@gmail.com'],
      'Customer (Radha) received booking confirmation notification'
    );

    // Assigned Provider Arun should have received +1 notification
    assert(
      notifsAfter['arun@gmail.com'] > notifsBefore['arun@gmail.com'],
      'Assigned Provider (Arun) received new service request notification'
    );

    // Admin should have received +1 notification
    assert(
      notifsAfter['santhiyam0603@gmail.com'] > notifsBefore['santhiyam0603@gmail.com'],
      'Admin (Santhiya) received platform booking notification'
    );

    // Other providers must have received ZERO notifications
    const otherProviders = ['priya@gmail.com', 'riyas@gmail.com', 'yaazh@gmail.com', 'deva@gmail.com', 'siva@gmail.com'];
    for (const op of otherProviders) {
      assert(
        notifsAfter[op] === notifsBefore[op],
        `Privacy maintained: Unrelated provider ${op} received NO notification`
      );
    }
  } catch (err) {
    assert(false, `Booking flow error: ${err.message}`);
  }

  // 5. TEST PROVIDER ACCEPT / TRACKING LIFECYCLE
  console.log('\n--- 5. Testing Provider Accept and Tracking Stage Progression ---');
  if (createdBooking) {
    try {
      // Arun accepts
      const acceptRes = await req(
        `${BASE_URL}/bookings/${createdBooking.id}/status`,
        'PUT',
        { status: 'accepted', note: 'Arun accepted the booking' },
        tokens['arun@gmail.com']
      );
      assert(acceptRes.ok && acceptRes.data.data?.status === 'accepted', 'Arun accepted booking');

      // Check customer received accept notification
      const custNotifs = await req(`${BASE_URL}/notifications`, 'GET', null, tokens['radha@gmail.com']);
      const cList = custNotifs.data?.data?.notifications || [];
      const hasAcceptNotif = cList.some(n => n.title?.includes('Accepted') && n.metadata?.bookingId === createdBooking.id);
      assert(hasAcceptNotif, 'Customer received "Booking Accepted" notification');

      // Tracking stages: on_the_way -> arrived -> in_progress -> completed
      const stages = ['on_the_way', 'arrived', 'in_progress', 'completed'];
      for (const st of stages) {
        const updateRes = await req(
          `${BASE_URL}/bookings/${createdBooking.id}/status`,
          'PUT',
          { status: st, note: `Status updated to ${st}` },
          tokens['arun@gmail.com']
        );
        assert(
          updateRes.ok && updateRes.data.data?.status === st,
          `Booking transitioned to "${st}"`
        );
      }

      // Check final completed customer notification
      const finalCustNotifs = await req(`${BASE_URL}/notifications`, 'GET', null, tokens['radha@gmail.com']);
      const fList = finalCustNotifs.data?.data?.notifications || [];
      const hasCompleteNotif = fList.some(n => n.title?.includes('Completed') && n.metadata?.bookingId === createdBooking.id);
      assert(hasCompleteNotif, 'Customer received "Service Completed" notification');
    } catch (err) {
      assert(false, `Lifecycle progression failed: ${err.message}`);
    }
  }

  // 6. TEST ADMIN USER MANAGEMENT API & PROTECTION
  console.log('\n--- 6. Testing Admin User Management & Protection ---');
  const adminToken = tokens['santhiyam0603@gmail.com'];
  const adminUser = userObjects['santhiyam0603@gmail.com'];
  const arun = userObjects['arun@gmail.com'];

  try {
    // A. Fetch all users
    const allUsersRes = await req(`${BASE_URL}/admin/users`, 'GET', null, adminToken);
    assert(allUsersRes.ok && Array.isArray(allUsersRes.data.data), 'Admin fetched all users');
    assert(allUsersRes.data.data.length >= 8, `Admin user list has ${allUsersRes.data.data.length} users`);

    // B. Fetch single user details with stats
    const userDetailRes = await req(`${BASE_URL}/admin/users/${arun.id}`, 'GET', null, adminToken);
    assert(
      userDetailRes.ok && userDetailRes.data.data?.stats && typeof userDetailRes.data.data.stats.totalBookings === 'number',
      `Admin retrieved user details and stats for ${arun.name}`
    );

    // C. Admin self-suspension protection
    const selfSuspRes = await req(
      `${BASE_URL}/admin/users/${adminUser.id}/status`,
      'PUT',
      { status: 'suspended' },
      adminToken
    );
    assert(
      selfSuspRes.status === 400,
      `Admin self-suspension correctly blocked by backend (HTTP ${selfSuspRes.status}): "${selfSuspRes.data?.message}"`
    );

    // D. Admin self-deletion protection
    const selfDelRes = await req(
      `${BASE_URL}/admin/users/${adminUser.id}`,
      'DELETE',
      null,
      adminToken
    );
    assert(
      selfDelRes.status === 400,
      `Admin self-deletion correctly blocked by backend (HTTP ${selfDelRes.status}): "${selfDelRes.data?.message}"`
    );

    // E. Suspend non-admin user (Deva) and verify login rejection
    const devaUser = userObjects['deva@gmail.com'];
    const suspendRes = await req(
      `${BASE_URL}/admin/users/${devaUser.id}/status`,
      'PUT',
      { status: 'suspended' },
      adminToken
    );
    assert(suspendRes.ok && suspendRes.data.data?.status === 'suspended', 'Admin suspended Deva');

    // Attempt Deva login while suspended
    const devaLoginAttempt = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: 'deva@gmail.com',
      password: 'Password@123'
    });
    const errMsg = devaLoginAttempt.data?.message || '';
    assert(
      devaLoginAttempt.status === 403 && errMsg.includes('Your account has been suspended'),
      `Suspended login blocked with exact required message: "${errMsg}"`
    );

    // Reactivate Deva
    const reactivateRes = await req(
      `${BASE_URL}/admin/users/${devaUser.id}/status`,
      'PUT',
      { status: 'active' },
      adminToken
    );
    assert(reactivateRes.ok && reactivateRes.data.data?.status === 'active', 'Admin reactivated Deva');

    // Deva login succeeds again
    const devaLoginAgain = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: 'deva@gmail.com',
      password: 'Password@123'
    });
    assert(devaLoginAgain.ok, 'Deva can log in again after reactivation');

  } catch (err) {
    assert(false, `Admin management tests failed: ${err.message}`);
  }

  console.log(`\n=== VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
