const { User, Wallet } = require('../models');

/**
 * Idempotently and safely initialize the platform admin account.
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD only from process.env (backend/.env).
 * Enforces:
 *  - If an admin user already exists with a different email: does NOT create another admin, reports existing admin email and halts safely.
 *  - If an admin user with ADMIN_EMAIL already exists: does NOT create a duplicate; ensures active status and credentials synchronization.
 *  - If no admin exists: creates exactly one admin user with role="admin", status="active", and bcrypt-hashed password.
 *  - Never modifies or deletes existing real non-admin users.
 *  - Never prints passwords or secrets in terminal/console logs.
 */
async function initAdminAccount() {
  try {
    const rawEmail = process.env.ADMIN_EMAIL;
    const rawPassword = process.env.ADMIN_PASSWORD;

    if (!rawEmail || !rawPassword) {
      console.warn('[Admin Init] ADMIN_EMAIL or ADMIN_PASSWORD not configured in process.env. Admin initialization skipped.');
      return { success: false, reason: 'MISSING_ENV_VARS' };
    }

    const adminEmail = String(rawEmail).toLowerCase().trim();
    const adminPassword = String(rawPassword).trim();

    if (!adminEmail || !adminPassword) {
      console.warn('[Admin Init] ADMIN_EMAIL or ADMIN_PASSWORD is empty. Admin initialization skipped.');
      return { success: false, reason: 'EMPTY_CREDENTIALS' };
    }

    // Step 1: Check the users table for any existing admin users
    const existingAdmins = await User.findAll({ where: { role: 'admin' } });

    if (existingAdmins && existingAdmins.length > 0) {
      // Check if an admin matching ADMIN_EMAIL already exists
      const matchingAdmin = existingAdmins.find(
        (admin) => admin.email && admin.email.toLowerCase().trim() === adminEmail
      );

      if (matchingAdmin) {
        let wasUpdated = false;

        // Ensure active status
        if (matchingAdmin.status !== 'active') {
          matchingAdmin.status = 'active';
          wasUpdated = true;
        }

        // Verify that password matches the configured ADMIN_PASSWORD
        const isPasswordMatch = await matchingAdmin.comparePassword(adminPassword);
        if (!isPasswordMatch) {
          // Update password so backend/.env credentials work; beforeUpdate hook automatically hashes via bcrypt
          matchingAdmin.password = adminPassword;
          wasUpdated = true;
        }

        if (wasUpdated) {
          await matchingAdmin.save();
        }

        // Ensure wallet exists for admin
        await Wallet.findOrCreate({
          where: { user_id: matchingAdmin.id },
          defaults: { balance: 0 }
        });

        console.log(`[Admin Init] Admin account already exists for ${matchingAdmin.email} (ID: ${matchingAdmin.id}, Status: ${matchingAdmin.status}). Duplicate creation skipped.`);
        return { success: true, created: false, user: matchingAdmin };
      } else {
        // An admin exists with a DIFFERENT email — DO NOT automatically create another admin
        const existingEmails = existingAdmins.map((a) => a.email).filter(Boolean).join(', ');
        console.warn(`[Admin Init Warning] An admin user already exists with a different email: [${existingEmails}]. Halting admin initialization safely without creating duplicate admin accounts.`);
        return {
          success: false,
          reason: 'EXISTING_ADMIN_DIFFERENT_EMAIL',
          existingEmails
        };
      }
    }

    // Step 2: No admin exists in the database. Check if a non-admin user already has ADMIN_EMAIL
    const existingUser = await User.findOne({ where: { email: adminEmail } });
    if (existingUser) {
      console.warn(`[Admin Init Warning] A non-admin user already exists with email ${adminEmail}. Existing user was not modified or deleted.`);
      return { success: false, reason: 'EXISTING_NON_ADMIN_USER', user: existingUser };
    }

    // Step 3: Create exactly one initial admin user
    // User model's beforeCreate hook automatically hashes password via bcrypt
    const newAdmin = await User.create({
      name: 'System Administrator',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      phone: '',
      city: 'Chennai',
      status: 'active'
    });

    await Wallet.create({
      user_id: newAdmin.id,
      balance: 0
    });

    console.log(`[Admin Init] Initial admin user successfully created with role: admin (ID: ${newAdmin.id}).`);
    return { success: true, created: true, user: newAdmin };
  } catch (err) {
    console.error(`[Admin Init Error]: ${err.message || err}`);
    return { success: false, error: err.message || err };
  }
}

module.exports = { initAdminAccount };
