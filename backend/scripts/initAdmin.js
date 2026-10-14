require('dotenv').config({ path: __dirname + '/../.env' });
const { connectDB, sequelize } = require('../config/database');
const { initAdminAccount } = require('../utils/adminInit');

async function main() {
  try {
    const db = await connectDB();
    if (!db) {
      console.error('[Admin Init CLI] Database connection failed.');
      process.exit(1);
    }

    // Ensure models/tables are synchronized
    await sequelize.sync();

    const result = await initAdminAccount();
    if (result && result.success) {
      if (result.created) {
        console.log(`[Admin Init CLI] Admin initialization complete. Successfully created admin user ID: ${result.user.id}, Role: ${result.user.role}.`);
      } else {
        console.log(`[Admin Init CLI] Admin initialization complete. Admin user already exists (ID: ${result.user.id}, Role: ${result.user.role}). No duplicate was created.`);
      }
      process.exit(0);
    } else {
      if (result?.reason === 'EXISTING_ADMIN_DIFFERENT_EMAIL') {
        console.warn(`[Admin Init CLI] Stopped safely: Admin already exists with a different email: [${result.existingEmails}]. No duplicate admin created.`);
        process.exit(0);
      }
      console.error(`[Admin Init CLI] Admin initialization was not completed: ${result?.reason || result?.error || 'Unknown status'}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('[Admin Init CLI Error]:', error.message || error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
