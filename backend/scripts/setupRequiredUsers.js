require('dotenv').config({ path: __dirname + '/../.env' });
const { User, ProviderProfile, Wallet, sequelize } = require('../models');

async function setupRequiredUsers() {
  try {
    await sequelize.authenticate();
    console.log('[SetupUsers] Database connected.');

    const defaultPassword = 'Password@123';

    // 1. ADMIN
    let admin = await User.findOne({ where: { email: 'santhiyam0603@gmail.com' } });
    if (!admin) {
      console.log('[SetupUsers] Creating Admin: santhiyam0603@gmail.com');
      admin = await User.create({
        name: 'Santhiya M',
        email: 'santhiyam0603@gmail.com',
        password: defaultPassword,
        role: 'admin',
        phone: '9876543210',
        city: 'Chennai',
        status: 'active'
      });
    } else {
      admin.role = 'admin';
      admin.password = defaultPassword;
      await admin.save();
    }
    await Wallet.findOrCreate({ where: { user_id: admin.id }, defaults: { balance: 0 } });

    // 2. CUSTOMER
    let customer = await User.findOne({ where: { email: 'radha@gmail.com' } });
    if (!customer) {
      console.log('[SetupUsers] Creating Customer: radha@gmail.com');
      customer = await User.create({
        name: 'Radha',
        email: 'radha@gmail.com',
        password: defaultPassword,
        role: 'customer',
        phone: '8123456789',
        address: 'k.r.nagar,theni',
        city: 'theni',
        status: 'active'
      });
    } else {
      customer.role = 'customer';
      customer.password = defaultPassword;
      await customer.save();
    }
    await Wallet.findOrCreate({ where: { user_id: customer.id }, defaults: { balance: 500 } });

    // 3. PROVIDERS
    const providers = [
      {
        email: 'arun@gmail.com',
        name: 'Arun Kumar',
        phone: '9876500001',
        businessName: 'Arun Electrical Services',
        category: 'Electrical',
        hourlyRate: 299,
        address: 'Anna Nagar, Chennai',
        city: 'Chennai'
      },
      {
        email: 'priya@gmail.com',
        name: 'Priya Ramesh',
        phone: '9876500002',
        businessName: 'Priya Deep Cleaning',
        category: 'Cleaning',
        hourlyRate: 399,
        address: 'T. Nagar, Chennai',
        city: 'Chennai'
      },
      {
        email: 'riyas@gmail.com',
        name: 'Riyas Mohamed',
        phone: '9876500003',
        businessName: 'Riyas AC Care & Repair',
        category: 'AC Repair',
        hourlyRate: 499,
        address: 'Velachery, Chennai',
        city: 'Chennai'
      },
      {
        email: 'yaazh@gmail.com',
        name: 'Yaazh S',
        phone: '9876500004',
        businessName: 'Yaazh Plumbing Works',
        category: 'Plumbing',
        hourlyRate: 349,
        address: 'Adyar, Chennai',
        city: 'Chennai'
      },
      {
        email: 'deva@gmail.com',
        name: 'Deva R',
        phone: '9876500005',
        businessName: 'Deva Wall Painting & Touchup',
        category: 'Painting',
        hourlyRate: 449,
        address: 'Tambaram, Chennai',
        city: 'Chennai'
      }
    ];

    for (const p of providers) {
      let provUser = await User.findOne({ where: { email: p.email } });
      if (!provUser) {
        console.log(`[SetupUsers] Creating Provider: ${p.email}`);
        provUser = await User.create({
          name: p.name,
          email: p.email,
          password: defaultPassword,
          role: 'provider',
          phone: p.phone,
          address: p.address,
          city: p.city,
          status: 'active'
        });
      } else {
        provUser.role = 'provider';
        provUser.password = defaultPassword;
        await provUser.save();
      }

      await Wallet.findOrCreate({ where: { user_id: provUser.id }, defaults: { balance: 0 } });

      let profile = await ProviderProfile.findOne({ where: { user_id: provUser.id } });
      if (!profile) {
        await ProviderProfile.create({
          user_id: provUser.id,
          business_name: p.businessName,
          category: p.category,
          hourly_rate: p.hourlyRate,
          is_approved: true,
          is_available: true,
          verification_status: 'verified',
          rating: 4.8
        });
      }
    }

    console.log('[SetupUsers] All requested accounts created and configured successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[SetupUsers Error]:', err);
    process.exit(1);
  }
}

setupRequiredUsers();
