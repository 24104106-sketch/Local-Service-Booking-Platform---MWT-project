const { sequelize } = require('../config/database');

async function ensureCustomerJourneyColumns() {
  try {
    await sequelize.authenticate();
    console.log('[DB] Connected to MySQL.');

    // 1. Add problem_description to bookings if missing
    try {
      await sequelize.query('ALTER TABLE bookings ADD COLUMN problem_description TEXT NULL;');
      console.log('[DB] Added problem_description column to bookings.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column problem_description already exists in bookings.');
      } else {
        console.warn('[DB] problem_description warning:', err.message);
      }
    }

    // 2. Add media_attachments JSON column to bookings if missing
    try {
      await sequelize.query('ALTER TABLE bookings ADD COLUMN media_attachments JSON NULL;');
      console.log('[DB] Added media_attachments column to bookings.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column media_attachments already exists in bookings.');
      } else {
        console.warn('[DB] media_attachments warning:', err.message);
      }
    }

    // 3. Add additional_charges JSON column to bookings if missing
    try {
      await sequelize.query('ALTER TABLE bookings ADD COLUMN additional_charges JSON NULL;');
      console.log('[DB] Added additional_charges column to bookings.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column additional_charges already exists in bookings.');
      } else {
        console.warn('[DB] additional_charges warning:', err.message);
      }
    }

    // 4. Add saved_addresses JSON column to users if missing
    try {
      await sequelize.query('ALTER TABLE users ADD COLUMN saved_addresses JSON NULL;');
      console.log('[DB] Added saved_addresses column to users.');
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log('[DB] Column saved_addresses already exists in users.');
      } else {
        console.warn('[DB] saved_addresses warning:', err.message);
      }
    }

    console.log('[DB] All customer journey schema columns verified successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[DB] Schema migration failed:', err);
    process.exit(1);
  }
}

ensureCustomerJourneyColumns();
