require('dotenv').config({ path: __dirname + '/../.env' });
const bcrypt = require('bcryptjs');
const { User, ProviderProfile, Wallet, sequelize } = require('../models');

async function seedDemo() {
  try {
    await sequelize.authenticate();
    console.log('[SeedDemo] Database connected.');

    const demoUsers = [
      {
        name: 'Ananya Rao',
        email: 'customer@fixit.com',
        password: 'password123',
        role: 'customer',
        phone: '9876543210',
        address: 'Flat 4B, Shanthi Apts, T. Nagar',
        city: 'Chennai',
        status: 'active'
      },
      {
        name: 'Kumar Cooling Co.',
        email: 'provider@fixit.com',
        password: 'password123',
        role: 'provider',
        phone: '9876543211',
        address: '15 Anna Salai',
        city: 'Chennai',
        status: 'active',
        businessName: 'Kumar Cooling Co.',
        category: 'AC Repair',
        hourlyRate: 349
      },
      {
        name: 'Admin User',
        email: 'admin@fixit.com',
        password: 'password123',
        role: 'admin',
        phone: '9000000000',
        address: 'HQ, Chennai',
        city: 'Chennai',
        status: 'active'
      }
    ];

    for (const d of demoUsers) {
      let u = await User.findOne({ where: { email: d.email } });
      if (!u) {
        console.log(`[SeedDemo] Creating ${d.email}...`);
        u = await User.create({
          name: d.name,
          email: d.email,
          password: d.password,
          role: d.role,
          phone: d.phone,
          address: d.address,
          city: d.city,
          status: 'active'
        });
      } else {
        console.log(`[SeedDemo] Updating password for ${d.email}...`);
        u.password = d.password;
        await u.save();
      }

      // Wallet
      await Wallet.findOrCreate({
        where: { user_id: u.id },
        defaults: { balance: d.role === 'customer' ? 500 : 0 }
      });

      // Provider Profile
      if (d.role === 'provider') {
        await ProviderProfile.findOrCreate({
          where: { user_id: u.id },
          defaults: {
            business_name: d.businessName,
            category: d.category,
            hourly_rate: d.hourlyRate,
            is_approved: true,
            is_available: true,
            verification_status: 'verified',
            rating: 4.8,
            reviews_count: 38
          }
        });
      }
    }

    // Also update existing local demo accounts so password123 works for them too
    const localUsers = ['admin@fixit.local', 'ananya@fixit.local', 'cooling@fixit.local'];
    for (const email of localUsers) {
      const u = await User.findOne({ where: { email } });
      if (u) {
        u.password = 'password123';
        await u.save();
        console.log(`[SeedDemo] Updated ${email} password to password123`);
      }
    }

    console.log('[SeedDemo] Demo users successfully synced!');
    process.exit(0);
  } catch (err) {
    console.error('[SeedDemo Error]:', err);
    process.exit(1);
  }
}

seedDemo();
