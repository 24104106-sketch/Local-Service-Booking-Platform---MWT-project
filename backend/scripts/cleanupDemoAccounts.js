require('dotenv').config({ path: __dirname + '/../.env' });
const { Op } = require('sequelize');
const { connectDB } = require('../config/database');
const {
  sequelize,
  User,
  ProviderProfile,
  ProviderService,
  Booking,
  Review,
  Notification,
  Wallet,
  WalletTransaction,
  ChatMessage,
  ChatConversation,
  Complaint,
  PasswordResetToken
} = require('../models');

const DEMO_EMAILS = [
  'arun@gmail.com',
  'radha@gmail.com',
  'priya@gmail.com',
  'riyas@gmail.com',
  'yaazh@gmail.com',
  'deva@gmail.com',
  'siva@gmail.com',
  'demo@gmail.com',
  'test@gmail.com',
  'customer@fixit.com',
  'provider@fixit.com',
  'admin@fixit.com',
  'ananya@fixit.local',
  'cooling@fixit.local',
  'admin@fixit.local'
];

async function cleanupDemoAccounts() {
  try {
    const db = await connectDB();
    if (!db) {
      throw new Error('Database connection failed');
    }

    const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'admin@fixitlocal.com').toLowerCase().trim();

    // Find all demo accounts or temporary test accounts
    const demoUsers = await User.findAll({
      where: {
        [Op.or]: [
          { email: { [Op.in]: DEMO_EMAILS } },
          { email: { [Op.like]: 'prov1_%' } },
          { email: { [Op.like]: 'prov2_%' } },
          { email: { [Op.like]: 'cust_%' } }
        ]
      }
    });

    console.log(`[Cleanup] Found ${demoUsers.length} demo/temporary accounts to remove.`);

    for (const u of demoUsers) {
      // Safety: Never delete configured admin account
      if (u.email.toLowerCase() === configuredAdminEmail) {
        console.log(`[Cleanup] Skipping configured admin: ${u.email}`);
        continue;
      }

      const userId = u.id;

      // 1. Provider Profile and Mappings
      const profile = await ProviderProfile.findOne({ where: { user_id: userId } });
      if (profile) {
        await ProviderService.destroy({ where: { provider_profile_id: profile.id } });
        await profile.destroy();
      }

      // 2. Reviews
      await Review.destroy({
        where: {
          [Op.or]: [{ customer_id: userId }, { provider_id: userId }]
        }
      });

      // 3. Bookings
      await Booking.destroy({
        where: {
          [Op.or]: [{ customer_id: userId }, { provider_id: userId }]
        }
      });

      // 4. Chat & Messages
      await ChatMessage.destroy({
        where: {
          [Op.or]: [{ sender_id: userId }, { recipient_id: userId }]
        }
      });
      await ChatConversation.destroy({
        where: {
          [Op.or]: [{ customer_id: userId }, { provider_id: userId }]
        }
      });

      // 5. Notifications
      await Notification.destroy({ where: { recipient_id: userId } });

      // 6. Wallet & Transactions
      await WalletTransaction.destroy({ where: { user_id: userId } });
      await Wallet.destroy({ where: { user_id: userId } });

      // 7. Complaints & Tokens
      await Complaint.destroy({ where: { user_id: userId } });
      await PasswordResetToken.destroy({ where: { user_id: userId } });

      // 8. Delete User
      await u.destroy();
      console.log(`[Cleanup] Successfully removed demo user: ${u.email} (ID: ${userId})`);
    }

    console.log('[Cleanup] Demo account cleanup completed successfully.');
    return true;
  } catch (err) {
    console.error('[Cleanup Error]:', err);
    throw err;
  }
}

if (require.main === module) {
  cleanupDemoAccounts().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { cleanupDemoAccounts };
