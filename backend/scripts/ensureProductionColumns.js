require('dotenv').config({ path: __dirname + '/../.env' });
const { sequelize, connectDB } = require('../config/database');

async function ensureProductionColumns() {
  try {
    const db = await connectDB();
    if (!db) {
      throw new Error('Could not connect to database');
    }
    console.log('[DB] Connected to MySQL.');

    const addColIfNotExists = async (table, colDef) => {
      try {
        await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN ${colDef};`);
        console.log(`[DB] Added column to ${table}: ${colDef}`);
      } catch (err) {
        if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
          // Expected if already present
        } else {
          console.warn(`[DB] Add column warning on ${table}:`, err.message);
        }
      }
    };

    // 1. provider_profiles columns
    await addColIfNotExists('provider_profiles', '`service_radius` INT DEFAULT 15');
    await addColIfNotExists('provider_profiles', '`working_days` JSON NULL');
    await addColIfNotExists('provider_profiles', '`working_hours` JSON NULL');
    await addColIfNotExists('provider_profiles', '`breaks` JSON NULL');
    await addColIfNotExists('provider_profiles', '`blocked_dates` JSON NULL');
    await addColIfNotExists('provider_profiles', '`service_duration` INT DEFAULT 60');
    await addColIfNotExists('provider_profiles', "`availability_status` ENUM('AVAILABLE', 'BUSY', 'OFFLINE') DEFAULT 'AVAILABLE'");
    await addColIfNotExists('provider_profiles', '`is_active` TINYINT(1) DEFAULT 1');
    await addColIfNotExists('provider_profiles', '`completed_jobs` INT DEFAULT 0');

    // 2. bookings columns & ENUM expansion
    try {
      await sequelize.query(`
        ALTER TABLE \`bookings\` MODIFY COLUMN \`payment_status\` ENUM(
          'pending',
          'processing',
          'paid',
          'failed',
          'refunded',
          'cash_pending',
          'cash_received'
        ) DEFAULT 'pending';
      `);
      console.log('[DB] Updated bookings.payment_status ENUM.');
    } catch (err) {
      console.warn('[DB] bookings.payment_status ENUM warning:', err.message);
    }

    try {
      await sequelize.query(`
        ALTER TABLE \`bookings\` MODIFY COLUMN \`status\` ENUM(
          'pending',
          'requested',
          'confirmed',
          'provider_assigned',
          'accepted',
          'rejected',
          'on_the_way',
          'arrived',
          'in_progress',
          'completed',
          'cancelled'
        ) DEFAULT 'requested';
      `);
      console.log('[DB] Updated bookings.status ENUM.');
    } catch (err) {
      console.warn('[DB] bookings.status ENUM warning:', err.message);
    }

    // 3. Unique index on bookings.booking_number
    try {
      await sequelize.query(`
        ALTER TABLE \`bookings\` ADD UNIQUE INDEX \`idx_booking_number\` (\`booking_number\`);
      `);
      console.log('[DB] Added unique index on bookings.booking_number.');
    } catch (err) {
      if (!err.message.includes('Duplicate key') && !err.message.includes('already exists')) {
        console.warn('[DB] booking_number index warning:', err.message);
      }
    }

    // 4. Unique index on reviews.booking_id
    try {
      await sequelize.query(`
        ALTER TABLE \`reviews\` ADD UNIQUE INDEX \`idx_reviews_booking_id\` (\`booking_id\`);
      `);
      console.log('[DB] Added unique index on reviews.booking_id.');
    } catch (err) {
      if (!err.message.includes('Duplicate key') && !err.message.includes('already exists')) {
        console.warn('[DB] reviews.booking_id index warning:', err.message);
      }
    }

    // 5. users.saved_addresses
    await addColIfNotExists('users', '`saved_addresses` JSON NULL');

    // 6. ProviderDailyAvailability table
    const ProviderDailyAvailability = require('../models/ProviderDailyAvailability');
    await ProviderDailyAvailability.sync();
    console.log('[DB] Synchronized provider_daily_availabilities table.');

    console.log('[DB] Production schema verification complete.');
    return true;
  } catch (err) {
    console.error('[DB Schema Verification Failed]:', err);
    throw err;
  }
}

if (require.main === module) {
  ensureProductionColumns().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { ensureProductionColumns };
