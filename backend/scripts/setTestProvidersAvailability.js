require('dotenv').config({ path: __dirname + '/../.env' });
const { Op } = require('sequelize');
const { connectDB } = require('../config/database');
const { User, ProviderProfile, Booking } = require('../models');

/**
 * FixIt Local - Set Test Providers Availability Script (Part 11)
 * Configures the controlled set of available / offline test providers:
 *
 * Electricians:  3 AVAILABLE, 2 OFFLINE
 * Plumbers:      3 AVAILABLE, 1 OFFLINE
 * Carpenters:    3 AVAILABLE, 1 OFFLINE
 * AC Service:    3 AVAILABLE, 1 OFFLINE
 * Cleaning:      2 AVAILABLE, 1 OFFLINE
 * TOTAL:        14 AVAILABLE, 6 OFFLINE = 20 Test Providers
 *
 * Adheres strictly to providerController availability rules:
 * - Providers must be approved and active before going online.
 * - Providers with active jobs in progress remain BUSY.
 */

const TARGET_AVAILABILITY_MAP = {
  // Electricians (3 AVAILABLE, 2 OFFLINE)
  'test.electrician01@fixitlocal.test': 'AVAILABLE',
  'test.electrician02@fixitlocal.test': 'AVAILABLE',
  'test.electrician03@fixitlocal.test': 'AVAILABLE',
  'test.electrician04@fixitlocal.test': 'OFFLINE',
  'test.electrician05@fixitlocal.test': 'OFFLINE',

  // Plumbers (3 AVAILABLE, 1 OFFLINE)
  'test.plumber01@fixitlocal.test': 'AVAILABLE',
  'test.plumber02@fixitlocal.test': 'AVAILABLE',
  'test.plumber03@fixitlocal.test': 'AVAILABLE',
  'test.plumber04@fixitlocal.test': 'OFFLINE',

  // Carpenters (3 AVAILABLE, 1 OFFLINE)
  'test.carpenter01@fixitlocal.test': 'AVAILABLE',
  'test.carpenter02@fixitlocal.test': 'AVAILABLE',
  'test.carpenter03@fixitlocal.test': 'AVAILABLE',
  'test.carpenter04@fixitlocal.test': 'OFFLINE',

  // AC Service (3 AVAILABLE, 1 OFFLINE)
  'test.acservice01@fixitlocal.test': 'AVAILABLE',
  'test.acservice02@fixitlocal.test': 'AVAILABLE',
  'test.acservice03@fixitlocal.test': 'AVAILABLE',
  'test.acservice04@fixitlocal.test': 'OFFLINE',

  // Cleaning (2 AVAILABLE, 1 OFFLINE)
  'test.cleaning01@fixitlocal.test': 'AVAILABLE',
  'test.cleaning02@fixitlocal.test': 'AVAILABLE',
  'test.cleaning03@fixitlocal.test': 'OFFLINE'
};

async function setTestProvidersAvailability() {
  console.log('================================================================');
  console.log('   FIXIT LOCAL: CONFIGURE TEST PROVIDERS AVAILABILITY (PART 11) ');
  console.log('================================================================\n');

  try {
    const db = await connectDB();
    if (!db) {
      console.error('[SetAvailability] Database connection failed. Aborting.');
      process.exit(1);
    }

    const testUsers = await User.findAll({
      where: {
        email: { [Op.like]: '%@fixitlocal.test' },
        role: 'provider'
      },
      include: [{ model: ProviderProfile, as: 'providerProfile' }]
    });

    if (testUsers.length === 0) {
      console.warn('! No test providers found ending with @fixitlocal.test.');
      console.warn('  Please run "npm run seed:test-providers" first.');
      process.exit(0);
    }

    console.log(`Found ${testUsers.length} test provider accounts.\n`);

    const summary = {
      AVAILABLE: 0,
      OFFLINE: 0,
      BUSY: 0,
      SKIPPED: 0
    };

    const categorySummary = {};

    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const profile = user.providerProfile;
      const indexStr = String(i + 1).padStart(2, '0');
      const target = TARGET_AVAILABILITY_MAP[user.email] || 'OFFLINE';

      if (!profile) {
        console.warn(`  [#${indexStr}] SKIP: User ${user.email} has no ProviderProfile.`);
        summary.SKIPPED++;
        continue;
      }

      // Check active booking in progress (strict BUSY enforcement)
      const activeBookingsCount = await Booking.count({
        where: {
          provider_id: user.id,
          status: { [Op.in]: ['accepted', 'on_the_way', 'arrived', 'in_progress'] }
        }
      });

      if (activeBookingsCount > 0) {
        profile.availability_status = 'BUSY';
        profile.is_available = false;
        await profile.save();
        summary.BUSY++;
        console.log(`  [#${indexStr}] BUSY: ${user.name} (${profile.category}) - active booking in progress.`);
        continue;
      }

      if (target === 'AVAILABLE') {
        if (!profile.is_approved || profile.is_active === false) {
          console.warn(`  [#${indexStr}] CANNOT SET AVAILABLE: ${user.name} is not approved yet. (Run approve:test-providers first)`);
          summary.SKIPPED++;
          continue;
        }

        profile.availability_status = 'AVAILABLE';
        profile.is_available = true;
        await profile.save();
        summary.AVAILABLE++;
        categorySummary[profile.category] = categorySummary[profile.category] || { available: 0, offline: 0 };
        categorySummary[profile.category].available++;
        console.log(`  [#${indexStr}] ONLINE  -> ${user.name} (${profile.category}) => AVAILABLE`);
      } else {
        profile.availability_status = 'OFFLINE';
        profile.is_available = false;
        await profile.save();
        summary.OFFLINE++;
        categorySummary[profile.category] = categorySummary[profile.category] || { available: 0, offline: 0 };
        categorySummary[profile.category].offline++;
        console.log(`  [#${indexStr}] OFFLINE -> ${user.name} (${profile.category}) => OFFLINE`);
      }
    }

    console.log('\n================================================================');
    console.log('   AVAILABILITY CONFIGURATION SUMMARY                           ');
    console.log('================================================================');
    console.log(`✓ Total Processed: ${testUsers.length}`);
    console.log(`  - AVAILABLE: ${summary.AVAILABLE}`);
    console.log(`  - OFFLINE:   ${summary.OFFLINE}`);
    console.log(`  - BUSY:      ${summary.BUSY}`);
    console.log(`  - SKIPPED:   ${summary.SKIPPED}`);

    console.log('\nControlled Distribution by Category:');
    for (const [cat, data] of Object.entries(categorySummary)) {
      console.log(`  - ${cat}: ${data.available} AVAILABLE, ${data.offline} OFFLINE (Total: ${data.available + data.offline})`);
    }
    console.log('================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[SetAvailability Error]:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setTestProvidersAvailability();
}

module.exports = { setTestProvidersAvailability, TARGET_AVAILABILITY_MAP };
