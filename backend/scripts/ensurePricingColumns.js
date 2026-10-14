const { sequelize } = require('../config/database');

async function ensurePricingColumns() {
  try {
    await sequelize.authenticate();
    console.log('[DB] Connected to MySQL.');

    // 1. Add base_price to provider_services if missing
    try {
      await sequelize.query('ALTER TABLE provider_services ADD COLUMN base_price FLOAT NULL;');
      console.log('[DB] Added base_price column to provider_services.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column base_price already exists in provider_services.');
      } else {
        console.warn('[DB] base_price warning:', err.message);
      }
    }

    // 2. Add pricing_type to provider_services if missing
    try {
      await sequelize.query(`
        ALTER TABLE provider_services ADD COLUMN pricing_type ENUM('fixed', 'starting_from', 'inspection_required') DEFAULT 'fixed';
      `);
      console.log('[DB] Added pricing_type column to provider_services.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column pricing_type already exists in provider_services.');
      } else {
        console.warn('[DB] pricing_type warning:', err.message);
      }
    }

    // 3. Add is_active to provider_services if missing
    try {
      await sequelize.query('ALTER TABLE provider_services ADD COLUMN is_active BOOLEAN DEFAULT TRUE;');
      console.log('[DB] Added is_active column to provider_services.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column is_active already exists in provider_services.');
      } else {
        console.warn('[DB] is_active warning:', err.message);
      }
    }

    // 4. Backfill base_price with custom_price where custom_price exists
    try {
      await sequelize.query('UPDATE provider_services SET base_price = custom_price WHERE base_price IS NULL AND custom_price IS NOT NULL;');
      console.log('[DB] Synced existing custom_price values to base_price.');
    } catch (err) {
      console.warn('[DB] Sync warning:', err.message);
    }

    // 5. Add pricing JSON column to bookings if missing
    try {
      await sequelize.query('ALTER TABLE bookings ADD COLUMN pricing JSON NULL;');
      console.log('[DB] Added pricing column to bookings.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column pricing already exists in bookings.');
      } else {
        console.warn('[DB] pricing warning:', err.message);
      }
    }

    // 6. Add service_location JSON column to bookings if missing
    try {
      await sequelize.query('ALTER TABLE bookings ADD COLUMN service_location JSON NULL;');
      console.log('[DB] Added service_location column to bookings.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column service_location already exists in bookings.');
      } else {
        console.warn('[DB] service_location warning:', err.message);
      }
    }

    console.log('[DB] All pricing schema columns verified successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[DB] Schema update failed:', err);
    process.exit(1);
  }
}

ensurePricingColumns();
