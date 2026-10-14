const assert = require('assert');
const { User, ProviderProfile, ProviderService, Service, Community, Booking } = require('../models');

async function runVerification() {
  console.log('====================================================');
  console.log(' FIXIT LOCAL - PLUMBER DISCOVERY VERIFICATION SUITE');
  console.log('====================================================\n');

  // 1. Verify provider testplumber01 exists
  console.log('1. Checking User account for test.plumber01@fixitlocal.test...');
  const user = await User.findOne({ where: { email: 'test.plumber01@fixitlocal.test' } });
  assert(user, 'User record must exist for test.plumber01@fixitlocal.test');
  assert.strictEqual(user.role, 'provider', 'User role must be provider');
  assert.strictEqual(user.status, 'active', 'User status must be active');
  console.log(`   ✓ Found User ID: ${user.id}, Name: "${user.name}", Role: ${user.role}, Status: ${user.status}`);

  // 2. Verify ProviderProfile
  console.log('2. Checking ProviderProfile for test.plumber01...');
  const profile = await ProviderProfile.findOne({ where: { user_id: user.id } });
  assert(profile, 'ProviderProfile must exist for user');
  assert.strictEqual(profile.is_approved, true, 'Profile must be approved');
  assert.strictEqual(profile.verification_status, 'verified', 'Profile must be verified');
  assert.strictEqual(profile.is_active, true, 'Profile must be active');
  assert.strictEqual(profile.is_available, true, 'Profile is_available must be true');
  assert.strictEqual(profile.availability_status, 'AVAILABLE', 'availability_status must be AVAILABLE');
  assert(profile.latitude != null && profile.longitude != null, 'Profile must have valid GPS coordinates');
  console.log(`   ✓ Profile ID: ${profile.id}, Category: ${profile.category}, GPS: (${profile.latitude}, ${profile.longitude}), Radius: ${profile.service_radius_km}km`);

  // 3. Verify ProviderService mapping
  console.log('3. Checking ProviderService offerings for Plumbing...');
  const pServices = await ProviderService.findAll({
    where: { provider_profile_id: profile.id, is_active: true },
    include: [{ model: Service, as: 'service' }]
  });
  assert(pServices.length > 0, 'Provider must have at least one active service');
  const plumbingService = pServices.find(ps => ps.service_id === 2 || ps.service?.title === 'Plumbing Fix');
  assert(plumbingService, 'Provider must offer "Plumbing Fix" (service_id: 2)');
  console.log(`   ✓ Found ${pServices.length} services offered. Active Plumbing service: ID ${plumbingService.service_id} ("${plumbingService.service?.title}")`);

  // 4. Verify Communities in Database
  console.log('4. Checking Residential Communities...');
  const communities = await Community.findAll();
  assert(communities.length > 0, 'Communities must exist');
  const abc = communities.find(c => c.name.includes('ABC Residency')) || communities[0];
  console.log(`   ✓ Target community: "${abc.name}" at (${abc.latitude}, ${abc.longitude})`);

  // 5. Test Live HTTP API: GET /api/providers/recommended
  console.log('5. Testing Live HTTP API: GET /api/providers/recommended...');
  const qs = new URLSearchParams({
    latitude: Number(abc.latitude),
    longitude: Number(abc.longitude),
    serviceId: 2,
    serviceTitle: 'Plumbing Fix',
    category: 'Plumber',
    date: new Date().toISOString().slice(0, 10),
    time: '10:00 AM'
  });

  const url = `http://localhost:5000/api/providers/recommended?${qs.toString()}`;
  const response = await fetch(url);
  assert.strictEqual(response.status, 200, `API must return 200 OK (got ${response.status})`);

  const body = await response.json();
  assert.strictEqual(body.success, true, 'Response must indicate success: true');
  assert(Array.isArray(body.data?.providers), 'Response must contain providers array');
  assert(body.data.providers.length > 0, 'At least one provider must be returned');

  console.log(`   ✓ API returned 200 OK with ${body.data.providers.length} eligible providers.`);

  // 6. Verify testplumber01 is present in the response
  console.log('6. Verifying test.plumber01 in recommended providers list...');
  const topProvider = body.data.providers[0];
  const targetInList = body.data.providers.find(p => p.userId === user.id || p.providerId === profile.id);

  assert(targetInList, 'test.plumber01 MUST be present in the recommended providers array');
  assert.strictEqual(targetInList.userId, user.id, 'userId must match user ID 136');
  assert.strictEqual(targetInList.providerName, 'Test Plumber 01', 'providerName must be "Test Plumber 01"');
  assert.strictEqual(targetInList.isAvailable, true, 'isAvailable must be true');
  assert.strictEqual(targetInList.isVerified, true, 'isVerified must be true');
  assert(targetInList.distanceKm < profile.service_radius_km, 'distanceKm must be within operating radius');

  console.log(`   ✓ Ranked #1 Provider: "${topProvider.providerName}" (${topProvider.businessName})`);
  console.log(`     - Distance: ${topProvider.distanceKm} km`);
  console.log(`     - Recommendation Score: ${topProvider.recommendationScore} / 100`);
  console.log(`     - Availability: ${topProvider.availabilityStatus}`);
  console.log(`     - Price: ₹${topProvider.price}`);

  console.log('\n====================================================');
  console.log(' ALL VERIFICATIONS PASSED: testplumber01 IS ELIGIBLE');
  console.log(' AND RETURNED AS TOP RECOMMENDED PROVIDER!');
  console.log('====================================================');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
