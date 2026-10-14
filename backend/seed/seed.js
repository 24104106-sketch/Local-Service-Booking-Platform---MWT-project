require('dotenv').config({ path: __dirname + '/../.env' });
const {
  sequelize,
  User,
  ProviderProfile,
  Service,
  ProviderService,
  Booking,
  Review,
  Notification,
  ChatConversation,
  ChatMessage,
  ChatbotHistory,
  Complaint,
  Wallet,
  WalletTransaction,
  PasswordResetToken
} = require('../models');

const seedData = async () => {
  // CRITICAL PRODUCTION SAFETY GUARD
  // Force-sync drops and recreates all database tables, resulting in irreversible data loss.
  if (process.env.NODE_ENV === 'production') {
    console.error('\n==================================================================');
    console.error(' [CRITICAL SAFETY ABORT]: SEED SCRIPT IS FORBIDDEN IN PRODUCTION ');
    console.error(' sequelize.sync({ force: true }) would destroy live production data! ');
    console.error(' Script execution halted immediately without modifying database. ');
    console.error('==================================================================\n');
    process.exit(1);
  }

  try {
    console.log('[Seed] Connecting to MySQL...');
    await sequelize.authenticate();
    console.log('[Seed] Connected successfully.');

    console.log('[Seed] Syncing database schema...');
    // Drop existing tables and recreate cleanly
    await sequelize.sync({ force: true });
    console.log('[Seed] Database schema synchronized.');

    const defaultPassword = 'Password@123';

    // 1. Create Admin user
    console.log('[Seed] Creating Admin user...');
    const adminMain = await User.create({
      name: 'Santhiya M',
      email: 'santhiyam0603@gmail.com',
      password: defaultPassword,
      role: 'admin',
      phone: '9876543210',
      city: 'Chennai',
      status: 'active'
    });
    await Wallet.create({ user_id: adminMain.id, balance: 1000 });

    // 2. Create Customer user
    console.log('[Seed] Creating Customer user...');
    const customerRadha = await User.create({
      name: 'Radha',
      email: 'radha@gmail.com',
      password: defaultPassword,
      role: 'customer',
      phone: '8123456789',
      address: 'k.r.nagar,theni',
      city: 'theni',
      status: 'active'
    });
    await Wallet.create({ user_id: customerRadha.id, balance: 1500 });

    // 3. Create Master Services Catalog (6 Master Services)
    console.log('[Seed] Creating Master Services Catalog...');
    const canonicalServices = [
      {
        title: 'AC Repair & Service',
        category: 'AC Repair',
        description: 'Complete indoor & outdoor unit pressure wash, filter cleaning, cooling check, and gas inspection.',
        price: 599,
        unit: 'per AC unit',
        duration: '60-90 mins',
        rating: 4.8,
        reviews_count: 42,
        icon: 'Wind',
        featured: true,
        tags: ['ac', 'cooling', 'cleaning', 'filter', 'gas'],
        is_active: true
      },
      {
        title: 'Deep Home Cleaning',
        category: 'Cleaning',
        description: 'Intensive mechanized cleaning of living spaces, bathrooms, kitchen degreasing, balconies, and floor scrubbing.',
        price: 1999,
        unit: 'per home (2-3 BHK)',
        duration: '4-6 hrs',
        rating: 4.9,
        reviews_count: 58,
        icon: 'Sparkles',
        featured: true,
        tags: ['cleaning', 'deep clean', 'home', 'kitchen', 'floor'],
        is_active: true
      },
      {
        title: 'Plumbing Fix',
        category: 'Plumbing',
        description: 'Inspection and repair of dripping taps, loose joints, drain clogs, flush valves, and minor pipe fitting.',
        price: 299,
        unit: 'per visit',
        duration: '45-60 mins',
        rating: 4.7,
        reviews_count: 36,
        icon: 'Droplets',
        featured: true,
        tags: ['tap', 'pipe', 'leak', 'plumber', 'drain'],
        is_active: true
      },
      {
        title: 'Electrical Wiring',
        category: 'Electrical',
        description: 'Diagnosis and fix for tripping MCBs, faulty switches, short circuits, socket replacements, and wiring.',
        price: 349,
        unit: 'per visit',
        duration: '30-60 mins',
        rating: 4.9,
        reviews_count: 51,
        icon: 'Zap',
        featured: true,
        tags: ['electrical', 'switch', 'wiring', 'mcb', 'light'],
        is_active: true
      },
      {
        title: 'Pest Control',
        category: 'Pest Control',
        description: 'Complete pest extermination, termite protection, bed bug spray, and herbal anti-cockroach treatment.',
        price: 899,
        unit: 'per treatment',
        duration: '60-120 mins',
        rating: 4.8,
        reviews_count: 31,
        icon: 'Shield',
        featured: true,
        tags: ['pest', 'termite', 'cockroach', 'disinfection', 'spray'],
        is_active: true
      },
      {
        title: 'Carpentry Work',
        category: 'Carpentry',
        description: 'Furniture assembly, wooden door & window alignment, lock installation, hinge repair, and custom woodcraft.',
        price: 449,
        unit: 'per service',
        duration: '60-90 mins',
        rating: 4.7,
        reviews_count: 27,
        icon: 'Wrench',
        featured: true,
        tags: ['carpentry', 'wood', 'furniture', 'door', 'lock'],
        is_active: true
      }
    ];

    const services = await Service.bulkCreate(canonicalServices);

    console.log('[Seed] Creating 6 Canonical Providers...');
    const providerDefs = [
      {
        name: 'Arun Kumar',
        email: 'arun@gmail.com',
        phone: '9876500001',
        businessName: 'Arun AC Care & Service',
        category: 'AC Repair',
        hourlyRate: 599,
        rating: 4.9,
        reviewCount: 42,
        experienceYears: 6,
        bio: 'Certified HVAC & refrigeration technician with 6+ years experience in split, window, and inverter AC systems.',
        lat: 13.0850,
        lng: 80.2100,
        address: '88, 2nd Avenue, Anna Nagar, Chennai',
        skills: ['AC Repair', 'Gas Refill', 'Filter Cleaning', 'Inverter AC'],
        serviceIndex: 0 // AC Repair & Service
      },
      {
        name: 'Priya Ramesh',
        email: 'priya@gmail.com',
        phone: '9876500002',
        businessName: 'Priya Deep Home Cleaning',
        category: 'Cleaning',
        hourlyRate: 1999,
        rating: 4.9,
        reviewCount: 58,
        experienceYears: 5,
        bio: 'Professional deep cleaning and sanitization team using eco-friendly solutions and commercial vacuum equipment.',
        lat: 13.0334,
        lng: 80.2690,
        address: '5B, Luz Church Rd, Mylapore, Chennai',
        skills: ['Deep Cleaning', 'Sanitization', 'Kitchen Cleaning', 'Bathroom Scrubbing'],
        serviceIndex: 1 // Deep Home Cleaning
      },
      {
        name: 'Riyas Mohamed',
        email: 'riyas@gmail.com',
        phone: '9876500003',
        businessName: 'Riyas Plumbing Solutions',
        category: 'Plumbing',
        hourlyRate: 299,
        rating: 4.7,
        reviewCount: 36,
        experienceYears: 7,
        bio: 'Expert residential plumber offering emergency leakage fixes, pipeline routing, and sanitaryware fittings.',
        lat: 13.0418,
        lng: 80.2341,
        address: '14, Usman Road, T. Nagar, Chennai',
        skills: ['Pipe Leakage', 'Tap Fitting', 'Drainage Unclog', 'Bathroom Plumbing'],
        serviceIndex: 2 // Plumbing Fix
      },
      {
        name: 'Yaazh S',
        email: 'yaazh@gmail.com',
        phone: '9876500004',
        businessName: 'Yaazh Electrical Works',
        category: 'Electrical',
        hourlyRate: 349,
        rating: 4.9,
        reviewCount: 51,
        experienceYears: 8,
        bio: 'Licensed electrician specializing in domestic wiring, DB box upgrades, inverter installations, and safety fault resolution.',
        lat: 13.0067,
        lng: 80.2206,
        address: '23, Sardar Patel Rd, Guindy, Chennai',
        skills: ['Wiring', 'Switchboard Repair', 'Inverter Setup', 'Fuse & MCB'],
        serviceIndex: 3 // Electrical Wiring
      },
      {
        name: 'Deva R',
        email: 'deva@gmail.com',
        phone: '9876500005',
        businessName: 'Deva Pest Care Solutions',
        category: 'Pest Control',
        hourlyRate: 899,
        rating: 4.8,
        reviewCount: 31,
        experienceYears: 8,
        bio: 'Master pest control technician providing eco-friendly termite treatments, bed bug control, and general fumigation.',
        lat: 12.9815,
        lng: 80.2180,
        address: '42, Velachery Main Rd, Velachery, Chennai',
        skills: ['Termite Control', 'Bed Bug Treatment', 'Cockroach Spray', 'Sanitization'],
        serviceIndex: 4 // Pest Control
      },
      {
        name: 'Siva K',
        email: 'siva@gmail.com',
        phone: '9876500006',
        businessName: 'Siva Carpentry Works',
        category: 'Carpentry',
        hourlyRate: 449,
        rating: 4.7,
        reviewCount: 27,
        experienceYears: 7,
        bio: 'Skilled carpenter specializing in furniture repair, lock installation, modular kitchen fittings, and custom wood craftsmanship.',
        lat: 13.0500,
        lng: 80.2500,
        address: '10, Cathedral Road, Gopalapuram, Chennai',
        skills: ['Furniture Assembly', 'Door Locks', 'Cabinet Making', 'Wood Polish'],
        serviceIndex: 5 // Carpentry Work
      }
    ];

    for (const p of providerDefs) {
      const user = await User.create({
        name: p.name,
        email: p.email,
        password: defaultPassword,
        role: 'provider',
        phone: p.phone,
        address: p.address,
        city: 'Chennai',
        status: 'active'
      });

      const profile = await ProviderProfile.create({
        user_id: user.id,
        business_name: p.businessName,
        category: p.category,
        experience_years: p.experienceYears,
        rating: p.rating,
        review_count: p.reviewCount,
        hourly_rate: p.hourlyRate,
        bio: p.bio,
        is_approved: true,
        is_available: true,
        verification_status: 'verified',
        location: {
          lat: p.lat,
          lng: p.lng,
          address: p.address
        },
        current_location: {
          lat: p.lat,
          lng: p.lng,
          heading: 0,
          speed: 0
        },
        skills: p.skills
      });

      // Link provider to master service via provider_services join table
      const targetService = services[p.serviceIndex];
      await ProviderService.create({
        provider_profile_id: profile.id,
        service_id: targetService.id,
        custom_price: targetService.price
      });

      // Provider wallet
      await Wallet.create({ user_id: user.id, balance: 1000 });
    }

    // VERIFICATION
    const userCount = await User.count();
    const adminCount = await User.count({ where: { role: 'admin' } });
    const customerCount = await User.count({ where: { role: 'customer' } });
    const providerCount = await User.count({ where: { role: 'provider' } });
    const serviceCount = await Service.count();

    console.log(`
==================================================================
  [SUCCESS] Clean MySQL Database Seed Complete!
==================================================================
  Users: Total = ${userCount}
    - Admin:     ${adminCount} (santhiyam0603@gmail.com)
    - Customer:  ${customerCount} (radha@gmail.com)
    - Providers: ${providerCount} (All ACTIVE & VERIFIED)
        1. arun@gmail.com  (Arun AC Care & Service - AC Repair)
        2. priya@gmail.com (Priya Deep Home Cleaning - Cleaning)
        3. riyas@gmail.com (Riyas Plumbing Solutions - Plumbing)
        4. yaazh@gmail.com (Yaazh Electrical Works - Electrical)
        5. deva@gmail.com  (Deva Pest Care Solutions - Pest Control)
        6. siva@gmail.com  (Siva Carpentry Works - Carpentry)

  Default Password for all: Password@123
  Master Services: ${serviceCount}
==================================================================
`);

    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
