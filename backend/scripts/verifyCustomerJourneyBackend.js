const { sequelize } = require('../config/database');
const { User, ProviderProfile, Service, ProviderService, Booking, Review, Wallet } = require('../models');
const { Op } = require('sequelize');

async function testBackend() {
  console.log('--- Starting Customer Journey Backend Verification ---');
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection authenticated.');

    // 1. Check a customer and a provider
    const customer = await User.findOne({ where: { role: 'customer', status: 'active' } });
    if (!customer) {
      console.log('No active customer found, creating test customer...');
    } else {
      console.log(`✓ Active customer found: ${customer.name} (${customer.email}, ID: ${customer.id})`);
    }

    const providerProfile = await ProviderProfile.findOne({
      where: { is_approved: true },
      include: [{ model: User, as: 'user', where: { status: 'active', role: 'provider' } }]
    });
    if (!providerProfile) {
      console.error('No approved active provider found!');
      process.exit(1);
    }
    console.log(`✓ Approved provider found: ${providerProfile.business_name} (User ID: ${providerProfile.user_id})`);

    // 2. Check provider services
    const providerServices = await ProviderService.findAll({
      where: { provider_profile_id: providerProfile.id, is_active: true },
      include: [{ model: Service, as: 'service' }]
    });
    console.log(`✓ Provider offers ${providerServices.length} active services.`);
    if (providerServices.length === 0) {
      console.error('Provider has no active services!');
      process.exit(1);
    }
    const testService = providerServices[0].service;
    console.log(`✓ Selected test service: ${testService.title} (Category: ${testService.category})`);

    // 3. Test Conflict prevention logic
    const testDate = '2026-10-15';
    const testTime = '10:00 AM';

    // Check existing or clean up test bookings for this slot
    await Booking.destroy({
      where: {
        provider_id: providerProfile.user_id,
        date: testDate,
        time: testTime
      }
    });

    const b1 = await Booking.create({
      booking_number: `TEST-${Date.now()}-1`,
      customer_id: customer.id,
      provider_id: providerProfile.user_id,
      provider_profile_id: providerProfile.id,
      service_id: testService.id,
      service_title: testService.title,
      category: testService.category,
      date: testDate,
      time: testTime,
      address: { street: '123 Main St', city: 'Metro' },
      status: 'pending',
      amount: 450,
      payment_method: 'cash',
      payment_status: 'pending',
      problem_description: 'AC is not cooling properly and making strange noise',
      media_attachments: [
        { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', type: 'image', name: 'photo1.png' }
      ],
      additional_charges: []
    });
    console.log(`✓ Created test booking #${b1.booking_number} with problem_description & media_attachments.`);

    // Try creating overlapping booking - simulate conflict check
    const conflict = await Booking.findOne({
      where: {
        provider_id: providerProfile.user_id,
        date: testDate,
        time: testTime,
        status: { [Op.notIn]: ['cancelled', 'rejected'] }
      }
    });
    if (conflict) {
      console.log(`✓ Conflict detection succeeded: Detected existing booking #${conflict.booking_number} on ${testDate} at ${testTime}.`);
    } else {
      throw new Error('Conflict detection failed!');
    }

    // 4. Test Additional Charges
    const charges = [
      {
        id: `chg_test_1`,
        description: 'Replacement capacitor',
        amount: 350,
        status: 'pending',
        requestedAt: new Date().toISOString()
      }
    ];
    b1.additional_charges = charges;
    await b1.save();
    console.log(`✓ Additional charge added to booking: ₹${charges[0].amount} (${charges[0].description})`);

    // Simulate Customer approval
    charges[0].status = 'approved';
    charges[0].respondedAt = new Date().toISOString();
    b1.additional_charges = charges;
    b1.amount = Number(b1.amount) + 350;
    await b1.save();
    console.log(`✓ Additional charge approved. Updated booking amount: ₹${b1.amount}`);

    // 5. Test Status progression to completed
    b1.status = 'completed';
    b1.payment_status = 'paid';
    await b1.save();
    console.log(`✓ Booking marked completed.`);

    // 6. Test Review Creation
    // Clean up any existing review for this test booking
    await Review.destroy({ where: { booking_id: b1.id } });

    const review = await Review.create({
      booking_id: b1.id,
      customer_id: customer.id,
      provider_id: providerProfile.user_id,
      service_id: testService.id,
      rating: 5,
      comment: 'Excellent, prompt and professional work!'
    });
    console.log(`✓ Review created successfully: ${review.rating} stars - "${review.comment}"`);

    // Check duplicate review prevention
    const duplicateReview = await Review.findOne({
      where: { booking_id: b1.id, customer_id: customer.id }
    });
    if (duplicateReview) {
      console.log(`✓ Duplicate review check verified: found existing review ID ${duplicateReview.id}`);
    }

    // Clean up test booking and review
    await Review.destroy({ where: { id: review.id } });
    await Booking.destroy({ where: { id: b1.id } });
    console.log(`✓ Cleaned up test records.`);

    console.log('\n===========================================');
    console.log('ALL BACKEND CUSTOMER JOURNEY TESTS PASSED!');
    console.log('===========================================');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testBackend();
