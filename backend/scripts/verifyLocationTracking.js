const BASE_URL = 'http://localhost:5000/api';

async function verifyLocationTracking() {
  console.log('=== VERIFYING REAL GPS TRACKING & SECURITY RULES ===\n');
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

  try {
    // 1. Authenticate Provider Arun
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'arun@gmail.com', password: 'Password@123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token || loginData.data?.token;
    assert(token != null, 'Provider Arun authenticated successfully via real credentials');

    // 2. Broadcast Valid Real GPS Coordinates
    const validLocRes = await fetch(`${BASE_URL}/providers/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        lat: 12.971598,
        lng: 77.594566,
        heading: 45,
        accuracy: 12
      })
    });
    const validLocData = await validLocRes.json();
    assert(validLocRes.ok && validLocData.success, 'Valid real GPS location successfully broadcasted');
    assert(validLocData.data.lat === 12.971598 && validLocData.data.lng === 77.594566, 'Exact coordinates persisted in provider profile');

    // 3. Verify Out-of-Bounds Coordinate Rejection (Latitude > 90)
    const invalidLatRes = await fetch(`${BASE_URL}/providers/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        lat: 95.0,
        lng: 77.594566
      })
    });
    assert(invalidLatRes.status === 400, 'Invalid latitude > 90 rejected with HTTP 400');

    // 4. Verify Out-of-Bounds Coordinate Rejection (Longitude > 180)
    const invalidLngRes = await fetch(`${BASE_URL}/providers/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        lat: 12.971598,
        lng: 195.0
      })
    });
    assert(invalidLngRes.status === 400, 'Invalid longitude > 180 rejected with HTTP 400');

    // 5. Verify Unauthenticated Request Rejection
    const unauthRes = await fetch(`${BASE_URL}/providers/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 12.971598, lng: 77.594566 })
    });
    assert(unauthRes.status === 401, 'Unauthenticated location update rejected with HTTP 401');

    // 6. Verify Non-Provider (Customer) Location Rejection
    const custLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'radha@gmail.com', password: 'Password@123' })
    });
    const custData = await custLoginRes.json();
    const custToken = custData.token || custData.data?.token;

    const custLocRes = await fetch(`${BASE_URL}/providers/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`
      },
      body: JSON.stringify({ lat: 12.971598, lng: 77.594566 })
    });
    assert(custLocRes.status === 403, 'Customer attempting provider location broadcast rejected with HTTP 403');

    console.log(`\n=== LOCATION TRACKING RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Error during location verification:', err);
    process.exit(1);
  }
}

verifyLocationTracking();
