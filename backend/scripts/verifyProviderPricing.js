const { sequelize } = require('../config/database');
const { User, ProviderProfile, Service, ProviderService, Booking } = require('../models');

const BASE_URL = 'http://localhost:5000/api';

async function api(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function verifyProviderPricingSystem() {
  console.log('=== FIXIT LOCAL: PROVIDER REGISTRATION & DYNAMIC PRICING VERIFICATION ===\n');

  try {
    await sequelize.authenticate();
    console.log('✓ MySQL database connected.');

    // 1. Ensure at least two test services exist
    let [svcElectrical] = await Service.findOrCreate({
      where: { title: 'Electrical Wiring' },
      defaults: {
        title: 'Electrical Wiring',
        category: 'Electrician',
        description: 'Wiring installation and switchboard repairs',
        price: 349,
        duration: '45-60 min'
      }
    });

    let [svcPlumbing] = await Service.findOrCreate({
      where: { title: 'Plumbing Fix' },
      defaults: {
        title: 'Plumbing Fix',
        category: 'Plumber',
        description: 'Pipe fixes and leak detection',
        price: 299,
        duration: '30-45 min'
      }
    });
    console.log(`✓ Master services verified: ID ${svcElectrical.id} (${svcElectrical.title}) and ID ${svcPlumbing.id} (${svcPlumbing.title}).`);

    // 2. Register Provider 1 WITHOUT sending any prices
    const prov1Email = `prov1_${Date.now()}@example.com`;
    const regRes1 = await api('/auth/register', 'POST', {
      fullName: 'Senthil Electrician',
      email: prov1Email,
      phone: '9840123456',
      password: 'Password123!',
      role: 'provider',
      primaryCategory: 'Electrician',
      services: ['Electrical Wiring', 'Fan Installation & Repair'],
      businessName: 'Senthil Electrical Works',
      experienceYears: 7,
      serviceArea: 'Anna Nagar'
    });

    const token1 = regRes1.token || regRes1.data?.token;
    const prov1User = regRes1.user || regRes1.data?.user;
    if (!token1 || !prov1User) {
      throw new Error(`Provider 1 registration failed: ${JSON.stringify(regRes1)}`);
    }
    console.log(`✓ Provider 1 registered without price payload: User ID ${prov1User.id}, Name: "${prov1User.name}"`);

    // 3. Register Provider 2 (also an Electrician offering Electrical Wiring)
    const prov2Email = `prov2_${Date.now()}@example.com`;
    const regRes2 = await api('/auth/register', 'POST', {
      fullName: 'Kumar Electro Fix',
      email: prov2Email,
      phone: '9840987654',
      password: 'Password123!',
      role: 'provider',
      primaryCategory: 'Electrician',
      services: ['Electrical Wiring', 'Inverter Setup'],
      businessName: 'Kumar Power Solutions',
      experienceYears: 10,
      serviceArea: 'T. Nagar'
    });
    const token2 = regRes2.token || regRes2.data?.token;
    const prov2User = regRes2.user || regRes2.data?.user;
    console.log(`✓ Provider 2 registered without price payload: User ID ${prov2User.id}, Name: "${prov2User.name}"`);

    // 4. Verify Provider 1 services listed via authenticated GET /api/providers/services
    const listRes1 = await api('/providers/services', 'GET', null, token1);
    console.log(`✓ Provider 1 fetched their services via GET /api/providers/services: ${listRes1.data.length} services found.`);
    console.log('Services list:', JSON.stringify(listRes1.data));

    // 5. Provider 1 sets custom pricing: Electrical Wiring -> ₹450, 'starting_from'
    const prov1Svc = listRes1.data.find(s =>
      s.service_title === 'Electrical Wiring' ||
      s.title === 'Electrical Wiring' ||
      s.name === 'Electrical Wiring' ||
      s.service_id === svcElectrical.id ||
      s.serviceId === svcElectrical.id ||
      s.id === svcElectrical.id
    );
    if (!prov1Svc) throw new Error('Provider 1 service mapping not found for Electrical Wiring');

    const updateRes1 = await api(`/providers/services/${prov1Svc.service_id || prov1Svc.serviceId || prov1Svc.id}`, 'PUT', {
      basePrice: 450,
      pricingType: 'starting_from',
      isActive: true
    }, token1);
    console.log(`✓ Provider 1 configured rate: Base Price ₹450, Pricing Type: "starting_from" (API success: ${updateRes1.success})`);

    // 6. Provider 2 sets DIFFERENT pricing for the SAME service: Electrical Wiring -> ₹650, 'fixed'
    const listRes2 = await api('/providers/services', 'GET', null, token2);
    const prov2Svc = listRes2.data.find(s =>
      s.service_title === 'Electrical Wiring' ||
      s.title === 'Electrical Wiring' ||
      s.name === 'Electrical Wiring' ||
      s.service_id === svcElectrical.id ||
      s.serviceId === svcElectrical.id ||
      s.id === svcElectrical.id
    );
    if (!prov2Svc) throw new Error('Provider 2 service mapping not found for Electrical Wiring');

    const updateRes2 = await api(`/providers/services/${prov2Svc.service_id || prov2Svc.serviceId || prov2Svc.id}`, 'PUT', {
      basePrice: 650,
      pricingType: 'fixed',
      isActive: true
    }, token2);
    console.log(`✓ Provider 2 configured DIFFERENT rate for SAME service: Base Price ₹650, Pricing Type: "fixed"`);

    // 7. Register a customer to test quotes and authoritative booking calculations
    const custEmail = `cust_${Date.now()}@example.com`;
    const custReg = await api('/auth/register', 'POST', {
      fullName: 'Ravi Customer',
      email: custEmail,
      phone: '9876501234',
      password: 'Password123!',
      role: 'customer'
    });
    const custToken = custReg.token || custReg.data?.token;
    const custUser = custReg.user || custReg.data?.user;
    console.log(`✓ Test Customer registered: ID ${custUser.id}`);

    // 8. Test Quote API for Provider 1 (base 450) vs Provider 2 (base 650)
    const quote1 = await api('/bookings/quote', 'POST', {
      serviceId: svcElectrical.id,
      providerId: prov1User.id,
      distanceKm: 4
    }, custToken);
    const q1 = quote1.data?.pricing || quote1.pricing || quote1.quote;
    console.log(`✓ Quote for Provider 1: Base ₹${q1.baseAmount}, Type: ${q1.pricingType}, Final: ₹${q1.finalAmount}`);

    const quote2 = await api('/bookings/quote', 'POST', {
      serviceId: svcElectrical.id,
      providerId: prov2User.id,
      distanceKm: 4
    }, custToken);
    const q2 = quote2.data?.pricing || quote2.pricing || quote2.quote;
    console.log(`✓ Quote for Provider 2: Base ₹${q2.baseAmount}, Type: ${q2.pricingType}, Final: ₹${q2.finalAmount}`);

    // 9. Test Authoritative Booking Creation: Customer submits bogus amount: 1
    // The server MUST calculate and enforce Provider 1's real rate (not 1)
    const bookingRes = await api('/bookings', 'POST', {
      serviceId: svcElectrical.id,
      providerId: prov1User.id,
      date: '2026-09-25',
      time: '10:00 AM',
      amount: 1, // Tampered client amount
      address: { street: '4th Main Rd, Anna Nagar', city: 'Chennai' },
      paymentMethod: 'cash'
    }, custToken);

    const createdBooking = bookingRes.data?.booking || bookingRes.booking || bookingRes.data;
    console.log(`✓ Booking created! Server calculated amount: ₹${createdBooking.amount} (Ignored tampered ₹1)`);

    if (createdBooking.amount === 1) {
      throw new Error('FAIL: Server accepted tampered client amount!');
    }
    if (!createdBooking.pricing || createdBooking.pricing.baseAmount !== 450) {
      throw new Error(`FAIL: Pricing breakdown missing or incorrect: ${JSON.stringify(createdBooking.pricing)}`);
    }
    console.log(`✓ Authoritative pricing breakdown stored in booking record:`, createdBooking.pricing);

    console.log('\n======================================================');
    console.log('🎉 ALL PROVIDER REGISTRATION & PRICING TESTS PASSED!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Verification Failed:', err.data || err.message);
    process.exit(1);
  }
}

verifyProviderPricingSystem();
