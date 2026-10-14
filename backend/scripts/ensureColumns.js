const { sequelize } = require('../config/database');

async function ensureColumns() {
  try {
    await sequelize.authenticate();
    console.log('[DB] Connected.');

    // Add service_location to bookings if missing
    try {
      await sequelize.query('ALTER TABLE bookings ADD COLUMN service_location JSON NULL;');
      console.log('[DB] Added service_location column to bookings.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column service_location already exists.');
      } else {
        console.warn('[DB] service_location warning:', err.message);
      }
    }

    // Add provider_location to bookings if missing
    try {
      await sequelize.query('ALTER TABLE bookings ADD COLUMN provider_location JSON NULL;');
      console.log('[DB] Added provider_location column to bookings.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column provider_location already exists.');
      } else {
        console.warn('[DB] provider_location warning:', err.message);
      }
    }

    // Add current_location to provider_profiles if missing
    try {
      await sequelize.query('ALTER TABLE provider_profiles ADD COLUMN current_location JSON NULL;');
      console.log('[DB] Added current_location column to provider_profiles.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column current_location already exists in provider_profiles.');
      } else {
        console.warn('[DB] current_location warning:', err.message);
      }
    }

    console.log('[DB] Schema verified.');
    process.exit(0);
  } catch (err) {
    console.error('[DB] Error:', err);
    process.exit(1);
  }
}

ensureColumns();
