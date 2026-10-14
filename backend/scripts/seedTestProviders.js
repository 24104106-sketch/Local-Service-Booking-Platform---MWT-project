require('dotenv').config({ path: __dirname + '/../.env' });
const { connectDB } = require('../config/database');
const { User, ProviderProfile, Service, ProviderService, Wallet } = require('../models');

/**
 * 20 Development Test Providers Specification
 * Distributed across 5 categories:
 * - 5 Electricians
 * - 4 Plumbers
 * - 4 Carpenters
 * - 4 AC Service Providers
 * - 3 Cleaning Providers
 * TOTAL = 20
 *
 * All coordinates are situated across the Chennai metropolitan area
 * with varying distances from a central reference point (e.g. Anna Nagar ~13.0827, 80.2100).
 *
 * Each provider offers 2-3 services with differentiated, provider-specific pricing.
 * All accounts use fictional identities with the @fixitlocal.test domain.
 */

const DEFAULT_DEV_PASSWORD = process.env.TEST_PROVIDER_PASSWORD || 'TestProvider@123';

// Catalog services to ensure exist in the master Service table
const REQUIRED_CATALOG_SERVICES = [
  // Electrician
  {
    title: 'Fan Installation & Repair',
    category: 'Electrician',
    description: 'Ceiling and exhaust fan installation, capacitor replacement, and speed regulator repair.',
    price: 350,
    unit: 'per appliance',
    duration: '30-45 mins',
    rating: 4.8,
    reviews_count: 24,
    icon: 'Fan',
    is_active: true
  },
  {
    title: 'Electrical Wiring',
    category: 'Electrical',
    description: 'Diagnosis and repair for short circuits, DB tripping, socket replacements, and wiring.',
    price: 349,
    unit: 'per visit',
    duration: '45-60 mins',
    rating: 4.9,
    reviews_count: 51,
    icon: 'Zap',
    is_active: true
  },
  {
    title: 'MCB Installation',
    category: 'Electrician',
    description: 'Miniature circuit breaker installation, replacement, and distribution board check.',
    price: 300,
    unit: 'per visit',
    duration: '30-45 mins',
    rating: 4.7,
    reviews_count: 18,
    icon: 'Shield',
    is_active: true
  },
  // Plumber
  {
    title: 'Pipe Repair',
    category: 'Plumber',
    description: 'Concealed and external PVC/GI pipe leak detection, joint sealing, and pipe replacement.',
    price: 350,
    unit: 'per repair',
    duration: '45-60 mins',
    rating: 4.7,
    reviews_count: 29,
    icon: 'Wrench',
    is_active: true
  },
  {
    title: 'Tap Repair',
    category: 'Plumber',
    description: 'Fix dripping taps, washer replacement, spindle repair, and tap replacement.',
    price: 250,
    unit: 'per tap',
    duration: '30 mins',
    rating: 4.8,
    reviews_count: 33,
    icon: 'Droplets',
    is_active: true
  },
  {
    title: 'Plumbing Fix',
    category: 'Plumbing',
    description: 'General plumbing inspection, drainage unclogging, flush valve repair, and fitting.',
    price: 299,
    unit: 'per visit',
    duration: '30-45 mins',
    rating: 4.7,
    reviews_count: 36,
    icon: 'Droplets',
    is_active: true
  },
  // Carpenter
  {
    title: 'Carpentry Work',
    category: 'Carpentry',
    description: 'Precision wood carving, furniture repair, door lock installation, hinge replacement, and shelf fitting.',
    price: 449,
    unit: 'per visit',
    duration: '1-2 hrs',
    rating: 4.7,
    reviews_count: 27,
    icon: 'Wrench',
    is_active: true
  },
  {
    title: 'Furniture Repair',
    category: 'Carpenter',
    description: 'Dining chair wobbling fix, wardrobe door realignment, drawer slide replacement, and bed frame repair.',
    price: 399,
    unit: 'per item',
    duration: '45-60 mins',
    rating: 4.8,
    reviews_count: 22,
    icon: 'Tool',
    is_active: true
  },
  // AC Service
  {
    title: 'AC Repair & Service',
    category: 'AC Repair',
    description: 'Complete indoor & outdoor unit pressure wash, filter cleaning, cooling check, and inspection.',
    price: 599,
    unit: 'per AC unit',
    duration: '45-60 mins',
    rating: 4.8,
    reviews_count: 42,
    icon: 'Wind',
    is_active: true
  },
  {
    title: 'AC General Service',
    category: 'AC Repair',
    description: 'Seasonal preventive maintenance, air filter wash, fin cleaning, and airflow check.',
    price: 499,
    unit: 'per AC unit',
    duration: '30-45 mins',
    rating: 4.8,
    reviews_count: 19,
    icon: 'Wind',
    is_active: true
  },
  {
    title: 'AC Gas Refilling',
    category: 'AC Repair',
    description: 'Refrigerant R32 / R410A / R22 gas top-up and pressure leak inspection.',
    price: 1299,
    unit: 'per unit',
    duration: '60 mins',
    rating: 4.9,
    reviews_count: 31,
    icon: 'Activity',
    is_active: true
  },
  // Cleaning
  {
    title: 'Deep Home Cleaning',
    category: 'Cleaning',
    description: 'Intensive mechanized cleaning of living spaces, bathrooms, kitchen degreasing, and floor scrubbing.',
    price: 1999,
    unit: 'per home',
    duration: '4-6 hrs',
    rating: 4.9,
    reviews_count: 58,
    icon: 'Sparkles',
    is_active: true
  },
  {
    title: 'Home Cleaning',
    category: 'Cleaning',
    description: 'Standard residential cleaning, dusting, floor mopping, and cobweb removal.',
    price: 899,
    unit: 'per visit',
    duration: '2-3 hrs',
    rating: 4.7,
    reviews_count: 26,
    icon: 'Home',
    is_active: true
  },
  {
    title: 'Bathroom Cleaning',
    category: 'Cleaning',
    description: 'Deep tile descaling, stain removal, mirror buffing, and toilet sanitization.',
    price: 499,
    unit: 'per bathroom',
    duration: '45-60 mins',
    rating: 4.8,
    reviews_count: 38,
    icon: 'Sparkles',
    is_active: true
  }
];

// Specification for the 20 test providers
const TEST_PROVIDERS = [
  // -------------------------------------------------------------
  // 5 ELECTRICIANS
  // -------------------------------------------------------------
  {
    email: 'test.electrician01@fixitlocal.test',
    name: 'Test Electrician 01',
    businessName: 'Test Electrician 01 Services',
    phone: '9800000101',
    category: 'Electrician',
    experienceYears: 4,
    hourlyRate: 350,
    bio: 'Fictional test provider #01 specializing in electrical installations and quick repairs.',
    address: '12 3rd Avenue, Shenoy Nagar, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600030',
    latitude: 13.0780,
    longitude: 80.2180,
    serviceRadiusKm: 10,
    services: [
      { title: 'Fan Installation & Repair', price: 300 },
      { title: 'Electrical Wiring', price: 320 },
      { title: 'MCB Installation', price: 250 }
    ]
  },
  {
    email: 'test.electrician02@fixitlocal.test',
    name: 'Test Electrician 02',
    businessName: 'Test Electrician 02 Services',
    phone: '9800000102',
    category: 'Electrician',
    experienceYears: 6,
    hourlyRate: 380,
    bio: 'Fictional test provider #02 with domestic wiring and switchgear experience.',
    address: '45 Poonamallee High Rd, Aminjikarai, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600029',
    latitude: 13.0690,
    longitude: 80.2190,
    serviceRadiusKm: 12,
    services: [
      { title: 'Fan Installation & Repair', price: 350 },
      { title: 'Electrical Wiring', price: 360 },
      { title: 'MCB Installation', price: 280 }
    ]
  },
  {
    email: 'test.electrician03@fixitlocal.test',
    name: 'Test Electrician 03',
    businessName: 'Test Electrician 03 Services',
    phone: '9800000103',
    category: 'Electrician',
    experienceYears: 3,
    hourlyRate: 320,
    bio: 'Fictional test provider #03 focused on affordable household wiring and fans.',
    address: '8 Ormes Road, Kilpauk, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600010',
    latitude: 13.0820,
    longitude: 80.2300,
    serviceRadiusKm: 8,
    services: [
      { title: 'Fan Installation & Repair', price: 400 },
      { title: 'Electrical Wiring', price: 280 },
      { title: 'MCB Installation', price: 320 }
    ]
  },
  {
    email: 'test.electrician04@fixitlocal.test',
    name: 'Test Electrician 04',
    businessName: 'Test Electrician 04 Services',
    phone: '9800000104',
    category: 'Electrician',
    experienceYears: 8,
    hourlyRate: 450,
    bio: 'Fictional test provider #04 offering comprehensive electrical panel maintenance.',
    address: '22 Sterling Road, Nungambakkam, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600034',
    latitude: 13.0580,
    longitude: 80.2400,
    serviceRadiusKm: 15,
    services: [
      { title: 'Fan Installation & Repair', price: 450 },
      { title: 'Electrical Wiring', price: 420 },
      { title: 'MCB Installation', price: 350 }
    ]
  },
  {
    email: 'test.electrician05@fixitlocal.test',
    name: 'Test Electrician 05',
    businessName: 'Test Electrician 05 Services',
    phone: '9800000105',
    category: 'Electrician',
    experienceYears: 5,
    hourlyRate: 480,
    bio: 'Fictional test provider #05 based in south industrial corridor with local radius.',
    address: '5 Kathipara Junction, Guindy, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600032',
    latitude: 13.0067,
    longitude: 80.2206,
    serviceRadiusKm: 5, // Intentionally tight radius for distance-cutoff testing
    services: [
      { title: 'Fan Installation & Repair', price: 500 },
      { title: 'Electrical Wiring', price: 480 },
      { title: 'MCB Installation', price: 400 }
    ]
  },

  // -------------------------------------------------------------
  // 4 PLUMBERS
  // -------------------------------------------------------------
  {
    email: 'test.plumber01@fixitlocal.test',
    name: 'Test Plumber 01',
    businessName: 'Test Plumber 01 Services',
    phone: '9800000106',
    category: 'Plumber',
    experienceYears: 5,
    hourlyRate: 299,
    bio: 'Fictional test provider #06 resolving leaky pipes, taps, and sanitary fittings.',
    address: '32 2nd Avenue, Anna Nagar East, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600102',
    latitude: 13.0850,
    longitude: 80.2180,
    serviceRadiusKm: 10,
    services: [
      { title: 'Pipe Repair', price: 280 },
      { title: 'Tap Repair', price: 180 },
      { title: 'Plumbing Fix', price: 299 }
    ]
  },
  {
    email: 'test.plumber02@fixitlocal.test',
    name: 'Test Plumber 02',
    businessName: 'Test Plumber 02 Services',
    phone: '9800000107',
    category: 'Plumber',
    experienceYears: 7,
    hourlyRate: 350,
    bio: 'Fictional test provider #07 specializing in concealed piping and pressure issues.',
    address: '18 Spurtank Road, Chetpet, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600031',
    latitude: 13.0710,
    longitude: 80.2350,
    serviceRadiusKm: 12,
    services: [
      { title: 'Pipe Repair', price: 320 },
      { title: 'Tap Repair', price: 220 },
      { title: 'Plumbing Fix', price: 349 }
    ]
  },
  {
    email: 'test.plumber03@fixitlocal.test',
    name: 'Test Plumber 03',
    businessName: 'Test Plumber 03 Services',
    phone: '9800000108',
    category: 'Plumber',
    experienceYears: 3,
    hourlyRate: 280,
    bio: 'Fictional test provider #08 offering affordable residential tap and pipe repairs.',
    address: '77 Usman Road, T. Nagar, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600017',
    latitude: 13.0418,
    longitude: 80.2341,
    serviceRadiusKm: 15,
    services: [
      { title: 'Pipe Repair', price: 360 },
      { title: 'Tap Repair', price: 260 },
      { title: 'Plumbing Fix', price: 259 }
    ]
  },
  {
    email: 'test.plumber04@fixitlocal.test',
    name: 'Test Plumber 04',
    businessName: 'Test Plumber 04 Services',
    phone: '9800000109',
    category: 'Plumber',
    experienceYears: 9,
    hourlyRate: 420,
    bio: 'Fictional test provider #09 serving south-east Chennai coastal neighborhood.',
    address: '14 Luz Church Road, Mylapore, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600004',
    latitude: 13.0334,
    longitude: 80.2690,
    serviceRadiusKm: 12,
    services: [
      { title: 'Pipe Repair', price: 400 },
      { title: 'Tap Repair', price: 300 },
      { title: 'Plumbing Fix', price: 399 }
    ]
  },

  // -------------------------------------------------------------
  // 4 CARPENTERS
  // -------------------------------------------------------------
  {
    email: 'test.carpenter01@fixitlocal.test',
    name: 'Test Carpenter 01',
    businessName: 'Test Carpenter 01 Services',
    phone: '9800000110',
    category: 'Carpenter',
    experienceYears: 6,
    hourlyRate: 450,
    bio: 'Fictional test provider #10 with expertise in door alignment and lock installation.',
    address: '6th Avenue, Anna Nagar West, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600040',
    latitude: 13.0890,
    longitude: 80.2050,
    serviceRadiusKm: 10,
    services: [
      { title: 'Carpentry Work', price: 420 },
      { title: 'Furniture Repair', price: 350 }
    ]
  },
  {
    email: 'test.carpenter02@fixitlocal.test',
    name: 'Test Carpenter 02',
    businessName: 'Test Carpenter 02 Services',
    phone: '9800000111',
    category: 'Carpenter',
    experienceYears: 8,
    hourlyRate: 480,
    bio: 'Fictional test provider #11 skilled in modular cabinetry and wooden furniture repairs.',
    address: '25 MTH Road, Villivakkam, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600049',
    latitude: 13.1070,
    longitude: 80.2050,
    serviceRadiusKm: 12,
    services: [
      { title: 'Carpentry Work', price: 460 },
      { title: 'Furniture Repair', price: 390 }
    ]
  },
  {
    email: 'test.carpenter03@fixitlocal.test',
    name: 'Test Carpenter 03',
    businessName: 'Test Carpenter 03 Services',
    phone: '9800000112',
    category: 'Carpenter',
    experienceYears: 4,
    hourlyRate: 390,
    bio: 'Fictional test provider #12 focused on affordable hinge and drawer slide repairs.',
    address: '9 Station Road, Kodambakkam, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600024',
    latitude: 13.0520,
    longitude: 80.2250,
    serviceRadiusKm: 15,
    services: [
      { title: 'Carpentry Work', price: 390 },
      { title: 'Furniture Repair', price: 320 }
    ]
  },
  {
    email: 'test.carpenter04@fixitlocal.test',
    name: 'Test Carpenter 04',
    businessName: 'Test Carpenter 04 Services',
    phone: '9800000113',
    category: 'Carpenter',
    experienceYears: 10,
    hourlyRate: 550,
    bio: 'Fictional test provider #13 specialized in antique and custom woodwork.',
    address: '3 Kasturba Nagar, Adyar, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600020',
    latitude: 13.0012,
    longitude: 80.2565,
    serviceRadiusKm: 15,
    services: [
      { title: 'Carpentry Work', price: 520 },
      { title: 'Furniture Repair', price: 450 }
    ]
  },

  // -------------------------------------------------------------
  // 4 AC SERVICE PROVIDERS
  // -------------------------------------------------------------
  {
    email: 'test.acservice01@fixitlocal.test',
    name: 'Test AC Service 01',
    businessName: 'Test AC Service 01 Services',
    phone: '9800000114',
    category: 'AC Repair',
    experienceYears: 5,
    hourlyRate: 599,
    bio: 'Fictional test provider #14 providing AC pressure washing and cooling coil inspection.',
    address: '42 Park Road, Mogappair East, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600037',
    latitude: 13.0830,
    longitude: 80.1920,
    serviceRadiusKm: 10,
    services: [
      { title: 'AC Repair & Service', price: 550 },
      { title: 'AC General Service', price: 450 },
      { title: 'AC Gas Refilling', price: 1200 }
    ]
  },
  {
    email: 'test.acservice02@fixitlocal.test',
    name: 'Test AC Service 02',
    businessName: 'Test AC Service 02 Services',
    phone: '9800000115',
    category: 'AC Repair',
    experienceYears: 7,
    hourlyRate: 650,
    bio: 'Fictional test provider #15 specializing in inverter split and cassette air conditioners.',
    address: '11 Balfour Road, Kilpauk, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600010',
    latitude: 13.0760,
    longitude: 80.2320,
    serviceRadiusKm: 12,
    services: [
      { title: 'AC Repair & Service', price: 620 },
      { title: 'AC General Service', price: 499 },
      { title: 'AC Gas Refilling', price: 1350 }
    ]
  },
  {
    email: 'test.acservice03@fixitlocal.test',
    name: 'Test AC Service 03',
    businessName: 'Test AC Service 03 Services',
    phone: '9800000116',
    category: 'AC Repair',
    experienceYears: 4,
    hourlyRate: 520,
    bio: 'Fictional test provider #16 offering budget-friendly AC filter cleaning and diagnostics.',
    address: '81 North Usman Road, T. Nagar, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600017',
    latitude: 13.0450,
    longitude: 80.2380,
    serviceRadiusKm: 15,
    services: [
      { title: 'AC Repair & Service', price: 499 },
      { title: 'AC General Service', price: 420 },
      { title: 'AC Gas Refilling', price: 1100 }
    ]
  },
  {
    email: 'test.acservice04@fixitlocal.test',
    name: 'Test AC Service 04',
    businessName: 'Test AC Service 04 Services',
    phone: '9800000117',
    category: 'AC Repair',
    experienceYears: 9,
    hourlyRate: 720,
    bio: 'Fictional test provider #17 based in south Chennai with comprehensive gas charging tools.',
    address: '90 Velachery Bypass Rd, Velachery, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600042',
    latitude: 12.9815,
    longitude: 80.2180,
    serviceRadiusKm: 15,
    services: [
      { title: 'AC Repair & Service', price: 699 },
      { title: 'AC General Service', price: 550 },
      { title: 'AC Gas Refilling', price: 1500 }
    ]
  },

  // -------------------------------------------------------------
  // 3 CLEANING PROVIDERS
  // -------------------------------------------------------------
  {
    email: 'test.cleaning01@fixitlocal.test',
    name: 'Test Cleaning 01',
    businessName: 'Test Cleaning 01 Services',
    phone: '9800000118',
    category: 'Cleaning',
    experienceYears: 4,
    hourlyRate: 850,
    bio: 'Fictional test provider #18 offering mechanized scrubbers and eco-friendly detergents.',
    address: '15 4th Cross St, Shenoy Nagar, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600030',
    latitude: 13.0750,
    longitude: 80.2200,
    serviceRadiusKm: 10,
    services: [
      { title: 'Deep Home Cleaning', price: 1800 },
      { title: 'Home Cleaning', price: 850 },
      { title: 'Bathroom Cleaning', price: 450 }
    ]
  },
  {
    email: 'test.cleaning02@fixitlocal.test',
    name: 'Test Cleaning 02',
    businessName: 'Test Cleaning 02 Services',
    phone: '9800000119',
    category: 'Cleaning',
    experienceYears: 6,
    hourlyRate: 950,
    bio: 'Fictional test provider #19 specialized in bathroom descaling and full kitchen degreasing.',
    address: '6 Haddows Road, Nungambakkam, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600006',
    latitude: 13.0600,
    longitude: 80.2420,
    serviceRadiusKm: 15,
    services: [
      { title: 'Deep Home Cleaning', price: 1999 },
      { title: 'Home Cleaning', price: 950 },
      { title: 'Bathroom Cleaning', price: 499 }
    ]
  },
  {
    email: 'test.cleaning03@fixitlocal.test',
    name: 'Test Cleaning 03',
    businessName: 'Test Cleaning 03 Services',
    phone: '9800000120',
    category: 'Cleaning',
    experienceYears: 8,
    hourlyRate: 1100,
    bio: 'Fictional test provider #20 offering industrial deep sanitization and stain treatment.',
    address: '2 GST Road, Guindy, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600032',
    latitude: 13.0080,
    longitude: 80.2150,
    serviceRadiusKm: 12,
    services: [
      { title: 'Deep Home Cleaning', price: 2200 },
      { title: 'Home Cleaning', price: 1100 },
      { title: 'Bathroom Cleaning', price: 550 }
    ]
  }
];

async function seedTestProviders() {
  console.log('================================================================');
  console.log('   FIXIT LOCAL: SEED 20 DEVELOPMENT TEST PROVIDERS              ');
  console.log('================================================================\n');

  try {
    const db = await connectDB();
    if (!db) {
      console.error('[SeedTestProviders] Database connection failed. Aborting.');
      process.exit(1);
    }

    // Step 1: Ensure master services catalog records exist
    console.log('[Step 1] Ensuring master services catalog records exist...');
    const serviceCache = {};
    for (const item of REQUIRED_CATALOG_SERVICES) {
      let [svc, created] = await Service.findOrCreate({
        where: { title: item.title },
        defaults: item
      });
      if (created) {
        console.log(`  + Created master catalog service: "${svc.title}" (ID: ${svc.id}, Category: ${svc.category})`);
      } else {
        if (!svc.is_active) {
          svc.is_active = true;
          await svc.save();
        }
      }
      serviceCache[svc.title] = svc;
    }

    // Step 2: Seed / Update the 20 test providers
    console.log('\n[Step 2] Creating/updating 20 test providers...');
    const categoryCounts = {};
    let createdCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < TEST_PROVIDERS.length; i++) {
      const pDef = TEST_PROVIDERS[i];
      const indexNum = String(i + 1).padStart(2, '0');

      // Check if user already exists (Idempotent lookup)
      let user = await User.findOne({ where: { email: pDef.email } });
      let isNewUser = false;

      if (!user) {
        user = await User.create({
          name: pDef.name,
          email: pDef.email,
          password: DEFAULT_DEV_PASSWORD,
          role: 'provider',
          phone: pDef.phone,
          address: pDef.address,
          city: pDef.city,
          status: 'active'
        });
        isNewUser = true;
        createdCount++;
      } else {
        user.name = pDef.name;
        user.phone = pDef.phone;
        user.address = pDef.address;
        user.city = pDef.city;
        user.status = 'active';
        await user.save();
        updatedCount++;
      }

      await Wallet.findOrCreate({
        where: { user_id: user.id },
        defaults: { balance: 0 }
      });

      // Prepare initial ProviderProfile values (STRICT PENDING LIFECYCLE)
      // Per Part 9:
      // is_approved = false, is_active = false, verification_status = 'pending',
      // availability_status = 'OFFLINE', is_available = false,
      // rating = 0, review_count = 0, completed_jobs = 0
      const profileData = {
        user_id: user.id,
        business_name: pDef.businessName,
        category: pDef.category,
        experience_years: pDef.experienceYears,
        hourly_rate: pDef.hourlyRate,
        bio: pDef.bio,
        skills: pDef.services.map(s => s.title),
        service_radius: pDef.serviceRadiusKm,
        service_radius_km: pDef.serviceRadiusKm,
        latitude: pDef.latitude,
        longitude: pDef.longitude,
        address: pDef.address,
        city: pDef.city,
        state: pDef.state,
        pincode: pDef.pincode,
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        working_hours: { start: '09:00', end: '18:00' },
        breaks: [{ start: '13:00', end: '14:00' }],
        blocked_dates: [],
        service_duration: 60,
        location: {
          address: pDef.address,
          city: pDef.city,
          state: pDef.state,
          pincode: pDef.pincode,
          lat: pDef.latitude,
          lng: pDef.longitude
        },
        current_location: {
          lat: pDef.latitude,
          lng: pDef.longitude,
          heading: 0,
          speed: 0
        },
        // Strict Part 9 initial pending registration values
        is_approved: false,
        is_active: false,
        verification_status: 'pending',
        availability_status: 'OFFLINE',
        is_available: false,
        rating: 0.0,
        review_count: 0,
        completed_jobs: 0
      };

      let profile = await ProviderProfile.findOne({ where: { user_id: user.id } });
      if (!profile) {
        profile = await ProviderProfile.create(profileData);
      } else {
        // Update profile but preserve approval state if already verified in a previous run
        const wasApproved = profile.is_approved && profile.verification_status === 'verified';
        profile.business_name = profileData.business_name;
        profile.category = profileData.category;
        profile.experience_years = profileData.experience_years;
        profile.hourly_rate = profileData.hourly_rate;
        profile.bio = profileData.bio;
        profile.skills = profileData.skills;
        profile.service_radius = profileData.service_radius;
        profile.service_radius_km = profileData.service_radius_km;
        profile.latitude = profileData.latitude;
        profile.longitude = profileData.longitude;
        profile.address = profileData.address;
        profile.city = profileData.city;
        profile.state = profileData.state;
        profile.pincode = profileData.pincode;
        profile.working_days = profileData.working_days;
        profile.working_hours = profileData.working_hours;
        profile.location = profileData.location;
        profile.current_location = profileData.current_location;
        if (!wasApproved) {
          profile.is_approved = false;
          profile.is_active = false;
          profile.verification_status = 'pending';
          profile.availability_status = 'OFFLINE';
          profile.is_available = false;
        }
        await profile.save();
      }

      // Step 3: Attach services with provider-specific prices via ProviderService
      for (const svcSpec of pDef.services) {
        const catSvc = serviceCache[svcSpec.title] || await Service.findOne({ where: { title: svcSpec.title } });
        if (!catSvc) {
          console.warn(`  ! Could not find catalog service for "${svcSpec.title}"`);
          continue;
        }

        let [ps, psCreated] = await ProviderService.findOrCreate({
          where: {
            provider_profile_id: profile.id,
            service_id: catSvc.id
          },
          defaults: {
            provider_profile_id: profile.id,
            service_id: catSvc.id,
            custom_price: svcSpec.price,
            base_price: svcSpec.price,
            pricing_type: 'fixed',
            is_active: true
          }
        });

        if (!psCreated) {
          ps.custom_price = svcSpec.price;
          ps.base_price = svcSpec.price;
          ps.is_active = true;
          await ps.save();
        }
      }

      categoryCounts[pDef.category] = (categoryCounts[pDef.category] || 0) + 1;
      console.log(`  [#${indexNum}] ${pDef.name} (${pDef.category}) -> User ID: ${user.id}, Profile ID: ${profile.id}, Radius: ${pDef.serviceRadiusKm} km, Services: ${pDef.services.length}`);
    }

    console.log('\n================================================================');
    console.log('   SEED SUMMARY REPORT                                          ');
    console.log('================================================================');
    console.log(`✓ Total Test Providers Processed: ${TEST_PROVIDERS.length}`);
    console.log(`  - Newly Created: ${createdCount}`);
    console.log(`  - Reused / Updated: ${updatedCount}`);
    console.log('\nCategory Distribution:');
    for (const [cat, count] of Object.entries(categoryCounts)) {
      console.log(`  - ${cat}: ${count}`);
    }
    console.log('\nNext Steps:');
    console.log('  1. Run "npm run approve:test-providers" to verify & approve accounts.');
    console.log('  2. Run "npm run set:test-availability" to place selected providers online.');
    console.log('================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[SeedTestProviders Error]:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedTestProviders();
}

module.exports = { seedTestProviders, TEST_PROVIDERS };
