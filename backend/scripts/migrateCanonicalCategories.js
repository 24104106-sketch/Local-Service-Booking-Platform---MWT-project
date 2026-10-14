require('dotenv').config({ path: __dirname + '/../.env' });
const { sequelize, Service, ProviderProfile, Booking, User, Review } = require('../models');
const { CANONICAL_CATEGORIES, getCanonicalCategory } = require('../utils/categoryNormalizer');

async function migrate() {
  console.log('=== FIXIT LOCAL: CANONICAL CATEGORY MIGRATION ===\n');

  const transaction = await sequelize.transaction();

  try {
    // 0. Baseline counts before migration
    const userCountBefore = await User.count({ transaction });
    const providerCountBefore = await ProviderProfile.count({ transaction });
    const bookingCountBefore = await Booking.count({ transaction });
    const reviewCountBefore = await Review.count({ transaction });

    console.log(`[Baseline] Users: ${userCountBefore}, Providers: ${providerCountBefore}, Bookings: ${bookingCountBefore}, Reviews: ${reviewCountBefore}`);

    // 1. Remove TestDistanceCat & test fixture services
    const [testServices] = await sequelize.query(
      "SELECT id, title, category FROM services WHERE category = 'TestDistanceCat' OR category LIKE '%Test%'",
      { transaction }
    );
    console.log(`[Step 1] Found ${testServices.length} test-fixture services to remove:`, testServices.map(s => `ID ${s.id}: ${s.title} (${s.category})`));

    if (testServices.length > 0) {
      const [delResult] = await sequelize.query(
        "DELETE FROM services WHERE category = 'TestDistanceCat' OR category LIKE '%Test%'",
        { transaction }
      );
      console.log(`✓ Deleted test-fixture services.`);
    }

    // 2. Migrate Services Categories
    console.log('\n[Step 2] Normalizing Service categories...');
    const [acSvcUpdate] = await sequelize.query(
      "UPDATE services SET category = 'AC Repair' WHERE category = 'AC Service'",
      { transaction }
    );
    console.log(`✓ Migrated AC Service -> AC Repair in services (${acSvcUpdate.affectedRows || 0} rows).`);

    const [paintSvcUpdate] = await sequelize.query(
      "UPDATE services SET category = 'Painting', is_active = 1 WHERE category IN ('Painter', 'Home Painting', 'paniting', 'Paniting', 'painting')",
      { transaction }
    );
    console.log(`✓ Migrated Painter/Home Painting -> Painting in services (${paintSvcUpdate.affectedRows || 0} rows).`);

    // Ensure Wall Painting & Touchup is active
    await sequelize.query(
      "UPDATE services SET is_active = 1 WHERE title LIKE '%Paint%'",
      { transaction }
    );

    // Ensure Washing Machine service is active
    await sequelize.query(
      "UPDATE services SET is_active = 1 WHERE title LIKE '%Washing Machine%'",
      { transaction }
    );

    // Ensure Gardening master service exists
    const [existingGardening] = await sequelize.query(
      "SELECT id FROM services WHERE category = 'Gardening'",
      { transaction }
    );
    if (existingGardening.length === 0) {
      await sequelize.query(
        `INSERT INTO services (title, category, description, price, unit, duration, rating, reviews_count, icon, image, featured, tags, is_active, created_at, updated_at)
         VALUES ('Gardening & Lawn Care', 'Gardening', 'Lawn mowing, hedge trimming, garden maintenance, weed removal and plant care.', 499, 'per visit', '1-2 hrs', 4.8, 12, 'Sparkles', '', 1, '[\"gardening\",\"lawn\",\"plants\"]', 1, NOW(), NOW())`,
        { transaction }
      );
      console.log('✓ Created master Gardening & Lawn Care service under canonical Gardening category.');
    }

    // 3. Migrate ProviderProfile Categories
    console.log('\n[Step 3] Normalizing ProviderProfile categories...');
    const [acProfUpdate] = await sequelize.query(
      "UPDATE provider_profiles SET category = 'AC Repair' WHERE category = 'AC Service'",
      { transaction }
    );
    console.log(`✓ Migrated AC Service -> AC Repair in provider_profiles (${acProfUpdate.affectedRows || 0} rows).`);

    const [paintProfUpdate] = await sequelize.query(
      "UPDATE provider_profiles SET category = 'Painting' WHERE category IN ('Painter', 'Home Painting', 'paniting', 'Paniting')",
      { transaction }
    );
    console.log(`✓ Migrated Painter/Home Painting -> Painting in provider_profiles (${paintProfUpdate.affectedRows || 0} rows).`);

    // 4. Migrate Bookings Categories
    console.log('\n[Step 4] Normalizing Bookings categories...');
    const [acBookingUpdate] = await sequelize.query(
      "UPDATE bookings SET category = 'AC Repair' WHERE category = 'AC Service'",
      { transaction }
    );
    console.log(`✓ Migrated AC Service -> AC Repair in bookings (${acBookingUpdate.affectedRows || 0} rows).`);

    const [paintBookingUpdate] = await sequelize.query(
      "UPDATE bookings SET category = 'Painting' WHERE category IN ('Painter', 'Home Painting')",
      { transaction }
    );
    console.log(`✓ Migrated Painter/Home Painting -> Painting in bookings (${paintBookingUpdate.affectedRows || 0} rows).`);

    // Commit Transaction
    await transaction.commit();
    console.log('\n✓ Transaction successfully committed.');

    // 5. Verification after migration
    const userCountAfter = await User.count();
    const providerCountAfter = await ProviderProfile.count();
    const bookingCountAfter = await Booking.count();
    const reviewCountAfter = await Review.count();

    console.log('\n=== MIGRATION INTEGRITY CHECK ===');
    console.log(`Users: Before=${userCountBefore}, After=${userCountAfter} (Delta: ${userCountAfter - userCountBefore})`);
    console.log(`Providers: Before=${providerCountBefore}, After=${providerCountAfter} (Delta: ${providerCountAfter - providerCountBefore})`);
    console.log(`Bookings: Before=${bookingCountBefore}, After=${bookingCountAfter} (Delta: ${bookingCountAfter - bookingCountBefore})`);
    console.log(`Reviews: Before=${reviewCountBefore}, After=${reviewCountAfter} (Delta: ${reviewCountAfter - reviewCountBefore})`);

    const [servicesCategories] = await sequelize.query('SELECT DISTINCT category, count(*) as count FROM services GROUP BY category');
    console.log('\nUpdated Services categories in DB:');
    servicesCategories.forEach(c => console.log(`  - ${c.category}: ${c.count} service(s)`));

    const [profilesCategories] = await sequelize.query('SELECT DISTINCT category, count(*) as count FROM provider_profiles GROUP BY category');
    console.log('\nUpdated ProviderProfile categories in DB:');
    profilesCategories.forEach(c => console.log(`  - ${c.category}: ${c.count} provider(s)`));

    const [bookingsCategories] = await sequelize.query('SELECT DISTINCT category, count(*) as count FROM bookings GROUP BY category');
    console.log('\nUpdated Bookings categories in DB:');
    bookingsCategories.forEach(c => console.log(`  - ${c.category}: ${c.count} booking(s)`));

    console.log('\n✓ Canonical Category Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    await transaction.rollback();
    console.error('\n❌ Migration failed, transaction rolled back:', err);
    process.exit(1);
  }
}

migrate();
