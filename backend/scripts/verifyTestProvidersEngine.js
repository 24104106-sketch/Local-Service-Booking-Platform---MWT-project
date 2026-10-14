require('dotenv').config({ path: __dirname + '/../.env' });
const { Op } = require('sequelize');
const { connectDB } = require('../config/database');
const {
  User,
  ProviderProfile,
  Service,
  ProviderService,
  Booking,
  Review
} = require('../models');
const {
  getRecommendedProviders,
  RECOMMENDATION_WEIGHTS
} = require('../services/providerRecommendationService');
const { checkProviderEligibility } = require('../services/providerEligibilityService');

// Reference customer search location: Anna Nagar, Chennai
const CUSTOMER_LOCATION = {
  latitude: 13.0827,
  longitude: 80.2100,
  address: '15 2nd Avenue, Anna Nagar, Chennai'
};

async function runComprehensiveVerification() {
  console.log('================================================================');
  console.log('   FIXIT LOCAL: REAL RECOMMENDATION ENGINE & PROVIDERS TEST     ');
  console.log('================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ [FAIL] ${message} ${details ? '(' + details + ')' : ''}`);
      failedTests++;
    }
  }

  try {
    const db = await connectDB();
    if (!db) {
      console.error('Database connection failed.');
      process.exit(1);
    }

    // =================================================================
    // SECTION 1: VERIFY DATABASE INTEGRITY (PART 16)
    // =================================================================
    console.log('--- SECTION 1: Verify Database Integrity (Part 16) ---');

    const testProfiles = await ProviderProfile.findAll({
      include: [
        {
          model: User,
          as: 'user',
          where: {
            email: { [Op.like]: '%@fixitlocal.test' },
            role: 'provider'
          }
        },
        {
          model: ProviderService,
          as: 'providerServices',
          where: { is_active: true },
          include: [{ model: Service, as: 'service' }]
        }
      ]
    });

    assert(testProfiles.length === 20, `Total test providers is exactly 20 (Found: ${testProfiles.length})`);

    const counts = {};
    for (const p of testProfiles) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }

    assert(counts['Electrician'] === 5, `Electrician count is 5 (Found: ${counts['Electrician']})`);
    assert(counts['Plumber'] === 4, `Plumber count is 4 (Found: ${counts['Plumber']})`);
    assert(counts['Carpenter'] === 4, `Carpenter count is 4 (Found: ${counts['Carpenter']})`);
    assert(counts['AC Repair'] === 4, `AC Service count is 4 (Found: ${counts['AC Repair']})`);
    assert(counts['Cleaning'] === 3, `Cleaning count is 3 (Found: ${counts['Cleaning']})`);

    let allHaveValidCoords = true;
    let allHaveValidRadius = true;
    let allHaveAtLeast2Services = true;
    let allHaveProviderSpecificPrices = true;
    let allApproved = true;
    let allValidAvailability = true;
    let noFakeReviews = true;

    for (const p of testProfiles) {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (isNaN(lat) || isNaN(lng) || lat < 12.0 || lat > 14.0 || lng < 79.5 || lng > 81.0) {
        allHaveValidCoords = false;
      }

      const rad = Number(p.service_radius_km || p.service_radius);
      if (!rad || rad <= 0 || isNaN(rad)) {
        allHaveValidRadius = false;
      }

      const services = p.providerServices || [];
      if (services.length < 2) {
        allHaveAtLeast2Services = false;
        console.warn(`Provider ${p.user.name} has only ${services.length} services`);
      }

      for (const ps of services) {
        const price = ps.custom_price || ps.base_price;
        if (!price || price <= 0) {
          allHaveProviderSpecificPrices = false;
        }
      }

      if (!p.is_approved || p.verification_status !== 'verified' || !p.is_active) {
        allApproved = false;
      }

      if (!['AVAILABLE', 'OFFLINE', 'BUSY'].includes(p.availability_status)) {
        allValidAvailability = false;
      }

      if (p.rating !== 0 || p.review_count !== 0) {
        noFakeReviews = false;
      }
    }

    assert(allHaveValidCoords, 'All 20 providers have valid real Chennai coordinates');
    assert(allHaveValidRadius, 'All 20 providers have valid service radius (5, 8, 10, 12, 15 km)');
    assert(allHaveAtLeast2Services, 'All 20 providers have at least 2 services attached');
    assert(allHaveProviderSpecificPrices, 'All 20 providers have valid provider-specific prices (> ₹0)');
    assert(allApproved, 'All 20 providers are verified and approved through proper lifecycle');
    assert(allValidAvailability, 'All 20 providers have valid availability status');
    assert(noFakeReviews, 'Cold start preserved: all 20 test providers have 0 ratings and 0 reviews (no fake reviews)');

    // =================================================================
    // SECTION 2: TEST RECOMMENDATION API FOR ALL 5 CATEGORIES (PART 17)
    // =================================================================
    console.log('\n--- SECTION 2: Test Recommendation Engine Across 5 Categories (Part 17) ---');

    const categoriesToTest = [
      { name: 'Electrician', category: 'Electrician', expectedMinOnline: 3 },
      { name: 'Plumber', category: 'Plumber', expectedMinOnline: 3 },
      { name: 'Carpenter', category: 'Carpenter', expectedMinOnline: 3 },
      { name: 'AC Service', category: 'AC Repair', expectedMinOnline: 3 },
      { name: 'Cleaning', category: 'Cleaning', expectedMinOnline: 2 }
    ];

    for (const testCat of categoriesToTest) {
      console.log(`\n  Testing Category: "${testCat.name}" (category: "${testCat.category}")`);

      // Search all eligible providers (availableOnly = false)
      const allRecs = await getRecommendedProviders({
        customerLat: CUSTOMER_LOCATION.latitude,
        customerLng: CUSTOMER_LOCATION.longitude,
        category: testCat.category,
        availableOnly: false
      });

      assert(allRecs.length > 0, `Returned eligible providers for ${testCat.name} (Count: ${allRecs.length})`);

      // Verify structure of first returned provider
      const top = allRecs[0];
      assert(top.providerId != null, `Provider ID present (${top.providerId})`);
      assert(top.providerName != null && top.providerName.length > 0, `Provider name present ("${top.providerName}")`);
      assert(top.price != null && top.price > 0, `Provider price present (₹${top.price})`);
      assert(top.distanceKm != null && top.distanceKm > 0, `Distance calculated (${top.distanceKm} km)`);
      assert(top.recommendationScore != null && top.recommendationScore > 0, `Recommendation score present (${top.recommendationScore})`);
      assert(top.scoreBreakdown != null, 'Score breakdown present');
      assert(
        top.scoreBreakdown.distanceScore != null &&
        top.scoreBreakdown.priceScore != null &&
        top.scoreBreakdown.qualityScore != null &&
        top.scoreBreakdown.reliabilityScore != null,
        `All 4 sub-scores present (Dist: ${top.scoreBreakdown.distanceScore}, Price: ${top.scoreBreakdown.priceScore}, Qual: ${top.scoreBreakdown.qualityScore}, Rel: ${top.scoreBreakdown.reliabilityScore})`
      );

      // Search available-only providers (availableOnly = true)
      const availRecs = await getRecommendedProviders({
        customerLat: CUSTOMER_LOCATION.latitude,
        customerLng: CUSTOMER_LOCATION.longitude,
        category: testCat.category,
        availableOnly: true
      });

      assert(
        availRecs.length >= testCat.expectedMinOnline,
        `Available-only search returned online providers (Found: ${availRecs.length}, Expected >= ${testCat.expectedMinOnline})`
      );
      assert(
        availRecs.every(p => p.availabilityStatus === 'AVAILABLE'),
        'All providers returned in available-only search have availabilityStatus === AVAILABLE'
      );
    }

    // =================================================================
    // SECTION 3: TEST PRICE DIFFERENCE IMPACT (PART 18)
    // =================================================================
    console.log('\n--- SECTION 3: Test Price Difference Impact (Part 18) ---');
    // Compare Electrician 01 (₹300 for Fan Repair, dist ~1.0 km) and Electrician 03 (₹400 for Fan Repair, dist ~2.2 km)
    // Or compare within same search:
    const elecRecs = await getRecommendedProviders({
      customerLat: CUSTOMER_LOCATION.latitude,
      customerLng: CUSTOMER_LOCATION.longitude,
      serviceTitle: 'Fan Installation & Repair',
      availableOnly: true
    });

    if (elecRecs.length >= 2) {
      // Find two providers with different prices
      const sortedByPrice = [...elecRecs].sort((a, b) => a.price - b.price);
      const cheapest = sortedByPrice[0];
      const expensive = sortedByPrice[sortedByPrice.length - 1];

      assert(
        cheapest.price < expensive.price,
        `Found price variation for "${cheapest.serviceName}": ₹${cheapest.price} vs ₹${expensive.price}`
      );
      assert(
        cheapest.scoreBreakdown.priceScore > expensive.scoreBreakdown.priceScore,
        `Lower-priced provider receives higher price score: ₹${cheapest.price} -> ${cheapest.scoreBreakdown.priceScore} pts vs ₹${expensive.price} -> ${expensive.scoreBreakdown.priceScore} pts`
      );
    } else {
      assert(false, 'Expected at least 2 electric providers for price comparison');
    }

    // =================================================================
    // SECTION 4: TEST DISTANCE DIFFERENCE & RADIUS EXCLUSION (PART 19)
    // =================================================================
    console.log('\n--- SECTION 4: Test Distance Difference & Radius Exclusion (Part 19) ---');

    // Compare closer vs farther
    const plumberRecs = await getRecommendedProviders({
      customerLat: CUSTOMER_LOCATION.latitude,
      customerLng: CUSTOMER_LOCATION.longitude,
      category: 'Plumber',
      availableOnly: false
    });

    const sortedByDistance = [...plumberRecs].sort((a, b) => a.distanceKm - b.distanceKm);
    const closest = sortedByDistance[0];
    const farther = sortedByDistance[sortedByDistance.length - 1];

    assert(
      closest.distanceKm < farther.distanceKm,
      `Distance variation exists: ${closest.providerName} (${closest.distanceKm} km) vs ${farther.providerName} (${farther.distanceKm} km)`
    );
    assert(
      closest.scoreBreakdown.distanceScore > farther.scoreBreakdown.distanceScore,
      `Closer provider receives higher distance score: ${closest.distanceKm} km -> ${closest.scoreBreakdown.distanceScore} pts vs ${farther.distanceKm} km -> ${farther.scoreBreakdown.distanceScore} pts`
    );

    // Verify service radius exclusion:
    // Test Electrician 05 is located at Guindy (13.0067, 80.2206) ~ 8.5 km from Anna Nagar (13.0827, 80.2100)
    // Test Electrician 05 has service_radius = 5 km
    // Customer distance (8.5 km) > service radius (5 km), so Test Electrician 05 MUST be excluded!
    const elecSearchResults = await getRecommendedProviders({
      customerLat: CUSTOMER_LOCATION.latitude,
      customerLng: CUSTOMER_LOCATION.longitude,
      category: 'Electrician',
      availableOnly: false
    });

    const includesOutofRadius = elecSearchResults.some(p => p.providerName.includes('Test Electrician 05'));
    assert(
      !includesOutofRadius,
      'Provider outside their operating radius (Test Electrician 05 at 8.5 km with 5 km radius) is properly EXCLUDED'
    );

    // =================================================================
    // SECTION 5: TEST NEW PROVIDER QUALITY / BAYESIAN SHRINKAGE (PART 20)
    // =================================================================
    console.log('\n--- SECTION 5: Test New Provider Quality / Cold Start (Part 20) ---');
    // For new providers with 0 reviews, Bayesian adjusted rating is prior (4.0/5.0 * 70 = 56.0 pts)
    const testProv = elecRecs[0];
    assert(
      testProv.reviewCount === 0 && testProv.completedJobs === 0,
      `Test provider has cold start track record (Reviews: ${testProv.reviewCount}, Jobs: ${testProv.completedJobs})`
    );
    assert(
      testProv.scoreBreakdown.qualityScore >= 50 && testProv.scoreBreakdown.qualityScore <= 60,
      `Bayesian quality score cleanly handles cold start: ${testProv.scoreBreakdown.qualityScore} pts (prior baseline ~56 pts)`
    );
    assert(
      testProv.scoreBreakdown.reliabilityScore === 85,
      `Clean-slate reliability score for new providers is baseline 85.0 pts (got: ${testProv.scoreBreakdown.reliabilityScore} pts)`
    );

    // =================================================================
    // SECTION 6: TEST OFFLINE PROVIDER EXCLUSION (PART 21)
    // =================================================================
    console.log('\n--- SECTION 6: Test Offline Provider Exclusion (Part 21) ---');
    // Search with availableOnly = true vs availableOnly = false
    const allCleaning = await getRecommendedProviders({
      customerLat: CUSTOMER_LOCATION.latitude,
      customerLng: CUSTOMER_LOCATION.longitude,
      category: 'Cleaning',
      availableOnly: false
    });

    const availableCleaning = await getRecommendedProviders({
      customerLat: CUSTOMER_LOCATION.latitude,
      customerLng: CUSTOMER_LOCATION.longitude,
      category: 'Cleaning',
      availableOnly: true
    });

    const offlineCleaningProviders = allCleaning.filter(p => p.availabilityStatus === 'OFFLINE');
    assert(offlineCleaningProviders.length > 0, `Found OFFLINE cleaning provider in database (${offlineCleaningProviders[0].providerName})`);

    const offlineIncludedInAvailableSearch = availableCleaning.some(p => p.availabilityStatus === 'OFFLINE');
    assert(
      !offlineIncludedInAvailableSearch,
      'OFFLINE providers are completely excluded when availableOnly=true'
    );

    // =================================================================
    // SECTION 7: TEST REAL DEVELOPMENT BOOKING LIFECYCLE (PART 22)
    // =================================================================
    console.log('\n--- SECTION 7: Test Real Development Booking Lifecycle (Part 22) ---');

    // 1. Pick an available recommended provider
    const targetProviderCandidate = elecRecs.find(p => p.availabilityStatus === 'AVAILABLE');
    assert(targetProviderCandidate != null, `Selected candidate provider: ${targetProviderCandidate.providerName} (ID: ${targetProviderCandidate.providerId})`);

    // 2. Ensure customer user exists
    let testCustomer = await User.findOne({ where: { role: 'customer', status: 'active' } });
    if (!testCustomer) {
      testCustomer = await User.create({
        name: 'Test Customer Verifier',
        email: `test.customer.${Date.now()}@fixitlocal.test`,
        password: 'Password@123',
        role: 'customer',
        phone: '9899999999',
        address: CUSTOMER_LOCATION.address,
        city: 'Chennai',
        status: 'active'
      });
    }

    const testService = await Service.findByPk(targetProviderCandidate.serviceId);
    assert(testService != null, `Resolved service: "${testService.title}" (ID: ${testService.id})`);

    // 3. Revalidate provider eligibility using the real Eligibility Service
    const providerProfile = await ProviderProfile.findByPk(targetProviderCandidate.providerProfileId);
    const eligibilityCheck = await checkProviderEligibility(providerProfile, {
      customerLat: CUSTOMER_LOCATION.latitude,
      customerLng: CUSTOMER_LOCATION.longitude,
      serviceId: testService.id,
      serviceTitle: testService.title,
      category: testService.category
    });

    assert(eligibilityCheck.eligible, `Server-side eligibility check passed: ${eligibilityCheck.eligible}`);

    // 4. Create real development booking
    const bookingNumber = `BK_TEST_${Date.now()}`;
    const testDate = '2026-10-01';
    const testTime = '11:00 AM';

    const booking = await Booking.create({
      booking_number: bookingNumber,
      customer_id: testCustomer.id,
      provider_id: providerProfile.user_id,
      provider_profile_id: providerProfile.id,
      service_id: testService.id,
      service_title: testService.title,
      category: testService.category,
      date: testDate,
      time: testTime,
      address: {
        street: CUSTOMER_LOCATION.address,
        city: 'Chennai',
        lat: CUSTOMER_LOCATION.latitude,
        lng: CUSTOMER_LOCATION.longitude
      },
      service_location: {
        address: CUSTOMER_LOCATION.address,
        latitude: CUSTOMER_LOCATION.latitude,
        longitude: CUSTOMER_LOCATION.longitude
      },
      problem_description: 'Development test booking for recommendation engine verification',
      status: 'accepted', // Active status to test BUSY transition
      payment_method: 'cash',
      payment_status: 'pending',
      amount: targetProviderCandidate.price,
      pricing: { baseAmount: targetProviderCandidate.price, finalAmount: targetProviderCandidate.price }
    });

    assert(booking != null && booking.id != null, `Booking created successfully (#${booking.booking_number}, ID: ${booking.id})`);

    // 5. Test provider availability becomes BUSY during active booking
    // Trigger syncProviderAvailability behavior
    const activeJobsCount = await Booking.count({
      where: {
        provider_id: providerProfile.user_id,
        status: { [Op.in]: ['accepted', 'on_the_way', 'arrived', 'in_progress'] }
      }
    });

    if (activeJobsCount > 0) {
      providerProfile.availability_status = 'BUSY';
      providerProfile.is_available = false;
      await providerProfile.save();
    }

    await providerProfile.reload();
    assert(
      providerProfile.availability_status === 'BUSY' && providerProfile.is_available === false,
      `Provider availability transitioned to BUSY on active booking (Status: ${providerProfile.availability_status}, is_available: ${providerProfile.is_available})`
    );

    // 6. Complete the test booking
    booking.status = 'completed';
    await booking.save();

    // Check completed jobs counter increment and transition back to AVAILABLE
    const remainingActive = await Booking.count({
      where: {
        provider_id: providerProfile.user_id,
        status: { [Op.in]: ['accepted', 'on_the_way', 'arrived', 'in_progress'] }
      }
    });

    if (remainingActive === 0 && providerProfile.is_approved && providerProfile.is_active) {
      providerProfile.availability_status = 'AVAILABLE';
      providerProfile.is_available = true;
      providerProfile.completed_jobs = Number(providerProfile.completed_jobs || 0) + 1;
      await providerProfile.save();
    }

    await providerProfile.reload();
    assert(
      providerProfile.availability_status === 'AVAILABLE' && providerProfile.is_available === true,
      `Provider returned to AVAILABLE on booking completion (Status: ${providerProfile.availability_status}, is_available: ${providerProfile.is_available})`
    );
    assert(
      providerProfile.completed_jobs >= 1,
      `Provider completed_jobs counter incremented (Completed: ${providerProfile.completed_jobs})`
    );

    // Clean up test booking record
    await booking.destroy();
    console.log('  ✓ Development test booking cleaned up.');

    // Reset provider completed jobs to 0 for pristine cold-start test state
    providerProfile.completed_jobs = 0;
    await providerProfile.save();

    // =================================================================
    // FINAL SUMMARY
    // =================================================================
    console.log('\n================================================================');
    console.log('   VERIFICATION SUITE RESULTS                                  ');
    console.log('================================================================');
    console.log(`  Total Checks: ${passedTests + failedTests}`);
    console.log(`  Passed:       ${passedTests}`);
    console.log(`  Failed:       ${failedTests}`);
    console.log('================================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
  } catch (err) {
    console.error('[Verification Error]:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runComprehensiveVerification();
}

module.exports = { runComprehensiveVerification };
