require('dotenv').config({ path: __dirname + '/../.env' });
const { Op } = require('sequelize');
const { connectDB } = require('../config/database');
const { User, ProviderProfile, Service, ProviderService } = require('../models');

/**
 * FixIt Local - Approve Development Test Providers Script
 * Uses server-side approval rules matching adminController.js (verifyProvider).
 *
 * Enforces:
 *  1. Full Name
 *  2. Phone
 *  3. Business Name
 *  4. Category
 *  5. At least 1 active service with price > 0
 *  6. Valid latitude (-90 to 90)
 *  7. Valid longitude (-180 to 180)
 *  8. Service radius > 0
 *  9. Working days & hours schedule
 *  10. Active category capacity <= 10
 *
 * Sets approved state:
 *  - is_approved = true
 *  - verification_status = 'verified'
 *  - is_active = true
 *  - availability_status = 'OFFLINE'
 *  - is_available = false
 */

async function approveTestProviders() {
  console.log('================================================================');
  console.log('   FIXIT LOCAL: APPROVE DEVELOPMENT TEST PROVIDERS              ');
  console.log('================================================================\n');

  try {
    const db = await connectDB();
    if (!db) {
      console.error('[ApproveTestProviders] Database connection failed. Aborting.');
      process.exit(1);
    }

    // Step 1: Find all test provider profiles (@fixitlocal.test)
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
          required: false,
          include: [{ model: Service, as: 'service' }]
        }
      ]
    });

    if (testProfiles.length === 0) {
      console.warn('! No test providers found ending with @fixitlocal.test.');
      console.warn('  Please run "npm run seed:test-providers" first.');
      process.exit(0);
    }

    console.log(`Found ${testProfiles.length} test provider accounts to validate & approve.\n`);

    let approvedCount = 0;
    let alreadyApprovedCount = 0;
    let failedValidationCount = 0;

    for (let i = 0; i < testProfiles.length; i++) {
      const profile = testProfiles[i];
      const indexStr = String(i + 1).padStart(2, '0');
      const user = profile.user;

      // Server-side validation matching adminController.js verifyProvider
      const missingFields = [];

      if (!user?.name || !user.name.trim()) missingFields.push('full name');
      if (!user?.phone || !user.phone.trim()) missingFields.push('phone number');
      if (!profile.business_name || !profile.business_name.trim()) missingFields.push('business name');
      if (!profile.category || !profile.category.trim()) missingFields.push('category');

      const services = profile.providerServices || [];
      if (services.length === 0) {
        missingFields.push('at least one active service');
      } else {
        const hasValidPrice = services.some(s => {
          const p = s.base_price ?? s.custom_price ?? s.service?.price;
          return p != null && !isNaN(Number(p)) && Number(p) > 0;
        });
        if (!hasValidPrice && (!profile.hourly_rate || profile.hourly_rate <= 0)) {
          missingFields.push('valid service price (> ₹0)');
        }
      }

      const lat = profile.latitude != null ? Number(profile.latitude) : null;
      if (lat == null || isNaN(lat) || lat < -90 || lat > 90) missingFields.push('latitude (-90 to 90)');

      const lng = profile.longitude != null ? Number(profile.longitude) : null;
      if (lng == null || isNaN(lng) || lng < -180 || lng > 180) missingFields.push('longitude (-180 to 180)');

      const radius = Number(profile.service_radius_km || profile.service_radius);
      if (!radius || isNaN(radius) || radius <= 0) missingFields.push('service radius (> 0 km)');

      if (!profile.working_days || !Array.isArray(profile.working_days) || profile.working_days.length === 0) {
        missingFields.push('working days schedule');
      }
      if (!profile.working_hours || !profile.working_hours.start || !profile.working_hours.end) {
        missingFields.push('working hours schedule');
      }

      if (missingFields.length > 0) {
        console.error(`  [#${indexStr}] FAIL: ${user.name} missing: ${missingFields.join(', ')}`);
        failedValidationCount++;
        continue;
      }

      // Check category capacity limit (10 active per category)
      const activeCount = await ProviderProfile.count({
        where: {
          category: profile.category,
          is_approved: true,
          is_active: { [Op.ne]: false },
          id: { [Op.ne]: profile.id }
        }
      });

      if (activeCount >= 10) {
        console.warn(`  [#${indexStr}] SKIP: Category "${profile.category}" capacity full (${activeCount}/10).`);
        continue;
      }

      if (profile.is_approved && profile.verification_status === 'verified' && profile.is_active) {
        alreadyApprovedCount++;
        console.log(`  [#${indexStr}] ALREADY APPROVED: ${user.name} (${profile.category}) - Status: ${profile.availability_status}`);
        continue;
      }

      // Apply server-side approval lifecycle
      profile.is_approved = true;
      profile.verification_status = 'verified';
      profile.is_active = true;
      profile.availability_status = 'OFFLINE';
      profile.is_available = false;

      await profile.save();
      approvedCount++;
      console.log(`  [#${indexStr}] APPROVED: ${user.name} (${profile.category}) -> is_approved: true, verification_status: verified, availability_status: OFFLINE`);
    }

    console.log('\n================================================================');
    console.log('   APPROVAL SUMMARY REPORT                                      ');
    console.log('================================================================');
    console.log(`✓ Total Test Providers Checked: ${testProfiles.length}`);
    console.log(`  - Newly Approved: ${approvedCount}`);
    console.log(`  - Already Approved: ${alreadyApprovedCount}`);
    console.log(`  - Failed Validation: ${failedValidationCount}`);
    console.log('\nAll approved providers are currently in OFFLINE state.');
    console.log('To put the controlled set online, run:');
    console.log('  npm run set:test-availability\n');

    process.exit(0);
  } catch (error) {
    console.error('[ApproveTestProviders Error]:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  approveTestProviders();
}

module.exports = { approveTestProviders };
