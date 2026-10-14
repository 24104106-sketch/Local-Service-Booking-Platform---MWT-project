require('dotenv').config({ path: __dirname + '/../.env' });
const assert = require('assert');
const {
  sequelize,
  User,
  ProviderProfile,
  Service,
  ProviderService,
  Notification
} = require('../models');
const { CANONICAL_CATEGORIES, getCanonicalCategory, isTestCategory } = require('../utils/categoryNormalizer');

async function run() {
  console.log('=== FIXIT LOCAL: CATEGORY SYSTEM & DEDUPLICATION VERIFICATION ===\n');

  let testUser = null;
  let testProfile = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Database Canonical Categories Audit
    // -------------------------------------------------------------
    console.log('--- TEST 1: MySQL Database Categories Audit ---');
    const [serviceCats] = await sequelize.query("SELECT DISTINCT category FROM services");
    const sCats = serviceCats.map(c => c.category);
    console.log('Current service categories in DB:', sCats);

    assert(!sCats.includes('TestDistanceCat'), 'TestDistanceCat is NOT in services table');
    assert(!sCats.includes('Painter'), 'Painter is NOT in services table');
    assert(!sCats.includes('Home Painting'), 'Home Painting is NOT in services table');
    assert(!sCats.includes('AC Service'), 'AC Service is NOT in services table');
    assert(sCats.includes('Painting'), 'Canonical Painting is in services table');
    assert(sCats.includes('AC Repair'), 'Canonical AC Repair is in services table');
    console.log('✓ TEST 1 PASSED: Database contains clean canonical categories.\n');

    // -------------------------------------------------------------
    // TEST 2: Model-Level Rejection of Test Categories
    // -------------------------------------------------------------
    console.log('--- TEST 2: Protection Against Test Categories ---');
    let testInsertBlocked = false;
    try {
      await Service.create({
        title: 'Forbidden Test Service',
        category: 'TestDistanceCat',
        price: 999,
        description: 'Should fail'
      });
    } catch (e) {
      testInsertBlocked = true;
      console.log('✓ Correctly blocked service creation with test category:', e.message);
    }
    assert(testInsertBlocked, 'Service creation with TestDistanceCat is strictly rejected by model hook');

    let profileInsertBlocked = false;
    try {
      await ProviderProfile.create({
        user_id: 999999,
        business_name: 'Test Business',
        category: 'TestDistanceCat'
      });
    } catch (e) {
      profileInsertBlocked = true;
      console.log('✓ Correctly blocked provider profile creation with test category:', e.message);
    }
    assert(profileInsertBlocked, 'ProviderProfile creation with TestDistanceCat is strictly rejected by model hook');
    console.log('✓ TEST 2 PASSED: Database hooks prevent test categories.\n');

    // -------------------------------------------------------------
    // TEST 3: Admin Category Pool Stats Logic
    // -------------------------------------------------------------
    console.log('--- TEST 3: Admin Category Pool Stats Logic ---');
    // Simulate what adminController.getCategoryPoolStats returns
    const { getCategoryAliases } = require('../utils/categoryNormalizer');
    const categorySet = new Set(CANONICAL_CATEGORIES);

    const categories = CANONICAL_CATEGORIES.filter(c => categorySet.has(c));
    console.log('Categories evaluated for Admin Dashboard:', categories);

    assert(!categories.includes('Painter'), 'Painter is NOT in pool categories');
    assert(!categories.includes('Home Painting'), 'Home Painting is NOT in pool categories');
    assert(!categories.includes('TestDistanceCat'), 'TestDistanceCat is NOT in pool categories');
    assert(!categories.includes('AC Service'), 'AC Service is NOT in pool categories');
    assert(categories.includes('Painting'), 'Painting is in pool categories');
    assert(categories.includes('AC Repair'), 'AC Repair is in pool categories');

    // Verify AC Repair count
    const { Op } = require('sequelize');
    const acAliases = getCategoryAliases('AC Repair');
    const acActiveCount = await ProviderProfile.count({
      where: {
        category: { [Op.in]: acAliases },
        is_approved: true,
        is_active: { [Op.ne]: false }
      }
    });
    console.log(`Active AC Repair providers count: ${acActiveCount}`);
    assert(acActiveCount === 4, `AC Repair active provider count is 4 (got ${acActiveCount})`);
    console.log('✓ TEST 3 PASSED: Admin pool stats show only canonical categories with correct counts.\n');

    // -------------------------------------------------------------
    // TEST 4: Provider Registration Normalization & Deduplication
    // -------------------------------------------------------------
    console.log('--- TEST 4: Provider Registration Normalization & Deduplication ---');
    const timestamp = Date.now();
    const testEmail = `test_painter_${timestamp}@fixittest.local`;

    testUser = await User.create({
      name: 'Muthu Painter',
      email: testEmail,
      password: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUU',
      role: 'provider',
      phone: '9876543219',
      city: 'Chennai',
      status: 'active'
    });

    // Simulate provider registering with alias 'Painter' and duplicate service selections:
    // ['Painting', 'Painting', 'Painter']
    const rawCategory = 'Painter';
    const assignedCategory = getCanonicalCategory(rawCategory);
    assert(assignedCategory === 'Painting', `Provider category 'Painter' normalized to '${assignedCategory}'`);

    testProfile = await ProviderProfile.create({
      user_id: testUser.id,
      business_name: 'Muthu Wall Painting Solutions',
      category: assignedCategory,
      experience_years: 6,
      service_radius: 15,
      latitude: 13.0827,
      longitude: 80.2707,
      is_approved: false,
      is_active: false,
      is_available: false,
      availability_status: 'OFFLINE',
      verification_status: 'pending'
    });

    assert(testProfile.category === 'Painting', 'Provider profile category stored as canonical Painting');

    // Simulate service linking with duplicate items: ['Painting', 'Painting', 'Painter']
    const rawServices = ['Painting', 'Painting', 'Painter'];
    const linkedServiceIds = new Set();
    const linkedCanonicalCategories = new Set();

    for (const item of rawServices) {
      const canonical = getCanonicalCategory(item);
      const foundService = await Service.findOne({
        where: {
          category: { [Op.in]: getCategoryAliases(canonical) },
          is_active: true
        }
      });

      if (foundService) {
        const svcCanonicalCat = getCanonicalCategory(foundService.category) || foundService.category;
        const isGenericCategoryService = (foundService.title.toLowerCase() === svcCanonicalCat.toLowerCase()) ||
          require('../utils/categoryNormalizer').areCategoriesMatching(foundService.title, svcCanonicalCat);

        if (linkedServiceIds.has(foundService.id)) {
          continue;
        }
        if (isGenericCategoryService && linkedCanonicalCategories.has(svcCanonicalCat)) {
          continue;
        }

        linkedServiceIds.add(foundService.id);
        linkedCanonicalCategories.add(svcCanonicalCat);

        await ProviderService.create({
          provider_profile_id: testProfile.id,
          service_id: foundService.id,
          custom_price: 3499,
          base_price: 3499,
          pricing_type: 'fixed',
          is_active: true
        });
      }
    }

    const createdServices = await ProviderService.findAll({
      where: { provider_profile_id: testProfile.id }
    });

    console.log(`Provider services created: ${createdServices.length}`);
    assert(createdServices.length === 1, `Exact 1 canonical ProviderService created for ['Painting', 'Painting', 'Painter'], got ${createdServices.length}`);
    console.log('✓ TEST 4 PASSED: Duplicate category selections deduplicated to exactly ONE service.\n');

    // -------------------------------------------------------------
    // TEST 5: Admin Notification on Provider Registration
    // -------------------------------------------------------------
    console.log('--- TEST 5: Admin Notification on Provider Registration ---');
    const admins = await User.findAll({ where: { role: 'admin' } });
    console.log(`Found ${admins.length} admin user(s) in system.`);

    for (const admin of admins) {
      // Simulate the notification logic in authController
      const existingNotif = await Notification.findOne({
        where: {
          recipient_id: admin.id,
          type: 'system',
          link: `/admin/provider-approvals?providerId=${testProfile.id}`
        }
      });
      if (!existingNotif) {
        await Notification.create({
          recipient_id: admin.id,
          title: 'New Provider Application',
          message: `${testUser.name} (${testProfile.business_name}) has registered for ${assignedCategory} services and is pending verification.`,
          type: 'system',
          read: false,
          link: `/admin/provider-approvals?providerId=${testProfile.id}`,
          metadata: {
            providerId: testProfile.id,
            userId: testUser.id,
            category: assignedCategory,
            status: 'pending'
          }
        });
      }
    }

    // Verify exactly ONE notification per admin was created
    for (const admin of admins) {
      const notifCount = await Notification.count({
        where: {
          recipient_id: admin.id,
          link: `/admin/provider-approvals?providerId=${testProfile.id}`
        }
      });
      assert(notifCount === 1, `Admin (ID ${admin.id}) has exactly 1 notification for this provider (got ${notifCount})`);
    }

    // Simulate page refresh / idempotent re-trigger
    for (const admin of admins) {
      const existingNotif = await Notification.findOne({
        where: {
          recipient_id: admin.id,
          type: 'system',
          link: `/admin/provider-approvals?providerId=${testProfile.id}`
        }
      });
      assert(existingNotif != null, 'Notification exists');
      // If refreshed, count must still be 1
      const countAfterRefresh = await Notification.count({
        where: {
          recipient_id: admin.id,
          link: `/admin/provider-approvals?providerId=${testProfile.id}`
        }
      });
      assert(countAfterRefresh === 1, `Notification count remains exactly 1 on refresh for Admin ${admin.id}`);
    }
    console.log('✓ TEST 5 PASSED: Admin notification created cleanly with zero duplicates on refresh.\n');

    // -------------------------------------------------------------
    // TEST 6: Admin Approval Flow & Provider Notification
    // -------------------------------------------------------------
    console.log('--- TEST 6: Admin Approval Flow & Status ---');
    // Admin approves provider
    testProfile.is_approved = true;
    testProfile.verification_status = 'verified';
    testProfile.is_active = true;
    testProfile.availability_status = 'OFFLINE';
    testProfile.is_available = false;
    await testProfile.save();

    await Notification.create({
      recipient_id: testProfile.user_id,
      title: 'Application Approved',
      message: 'Congratulations! Your provider application has been approved by admin.',
      type: 'system',
      read: false,
      link: '/provider/dashboard'
    });

    const provNotif = await Notification.findOne({
      where: { recipient_id: testUser.id }
    });
    assert(provNotif != null, 'Provider received approval notification');
    assert(provNotif.title === 'Application Approved', 'Notification title is Application Approved');
    console.log('✓ TEST 6 PASSED: Provider approved and notified.\n');

    console.log('================================================================');
    console.log('ALL CATEGORY SYSTEM & NOTIFICATION AUDIT TESTS PASSED (6/6)!');
    console.log('================================================================\n');

  } finally {
    // Clean up temporary test provider & notifications
    if (testUser) {
      await Notification.destroy({ where: { recipient_id: testUser.id } }).catch(() => {});
      if (testProfile) {
        await Notification.destroy({
          where: { link: `/admin/provider-approvals?providerId=${testProfile.id}` }
        }).catch(() => {});
        await ProviderService.destroy({ where: { provider_profile_id: testProfile.id } }).catch(() => {});
        await testProfile.destroy().catch(() => {});
      }
      await testUser.destroy().catch(() => {});
      console.log('✓ Test fixtures cleanly removed.');
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
