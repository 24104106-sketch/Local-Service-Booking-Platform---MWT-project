const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const data = body ? JSON.parse(body) : null;
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data });
          } catch (e) {
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTest() {
  console.log('=== FULL CUSTOMER JOURNEY E2E TEST ===\n');

  try {
    // 1. Customer Login
    console.log('1. Authenticating customer (radha@gmail.com)...');
    const custLogin = await request(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'radha@gmail.com', password: 'Password@123' }
    });
    if (!custLogin.ok) throw new Error(`Customer login failed: ${JSON.stringify(custLogin.data)}`);
    const custToken = custLogin.data.data.token;
    const custUser = custLogin.data.data.user;
    console.log(`✓ Customer authenticated: ${custUser.name} (Role: ${custUser.role}, ID: ${custUser.id})`);

    // 2. Provider Login
    console.log('\n2. Authenticating provider (arun@gmail.com)...');
    const provLogin = await request(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'arun@gmail.com', password: 'Password@123' }
    });
    if (!provLogin.ok) throw new Error(`Provider login failed: ${JSON.stringify(provLogin.data)}`);
    const provToken = provLogin.data.data.token;
    const provUser = provLogin.data.data.user;
    console.log(`✓ Provider authenticated: ${provUser.name} (ID: ${provUser.id})`);

    // 3. Check Available Providers endpoint
    console.log('\n3. Testing POST /api/providers/available...');
    const availRes = await request(`${BASE_URL}/providers/available`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: { serviceCategory: 'AC Repair', latitude: 13.0827, longitude: 80.2707 }
    });
    if (!availRes.ok) throw new Error(`Available providers failed: ${JSON.stringify(availRes.data)}`);
    console.log(`✓ Found ${availRes.data.data.length} available providers for AC Repair.`);
    const selectedProv = availRes.data.data.find((p) => p.userId === provUser.id) || availRes.data.data[0];
    console.log(`✓ Selected Provider: ${selectedProv.businessName || selectedProv.name} (Distance: ${selectedProv.distanceKm} km, Base Price: ₹${selectedProv.basePrice})`);

    // 4. Test Price Quote
    console.log('\n4. Testing POST /api/bookings/quote...');
    const quoteRes = await request(`${BASE_URL}/bookings/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: { serviceName: 'AC Repair & Service', providerId: selectedProv.userId || selectedProv.id }
    });
    if (!quoteRes.ok) throw new Error(`Price quote failed: ${JSON.stringify(quoteRes.data)}`);
    console.log(`✓ Server Quote received: Base ₹${quoteRes.data.data.pricing.baseAmount}, Total ₹${quoteRes.data.data.pricing.finalAmount}`);

    // 5. Test Booking Creation with Media & Problem Description
    console.log('\n5. Creating booking with problem description and media attachments...');
    const uniqueDate = `2026-12-${Math.floor(Math.random() * 20) + 10}`;
    const uniqueTime = `${Math.floor(Math.random() * 8) + 1}:00 PM`;

    const bookRes = await request(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: {
        serviceName: 'AC Repair & Service',
        providerId: selectedProv.userId || selectedProv.id,
        date: uniqueDate,
        time: uniqueTime,
        problemDescription: 'AC indoor unit making loud vibration noise and air not cold.',
        mediaAttachments: [
          {
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            type: 'image',
            name: 'ac_unit.png'
          }
        ],
        address: {
          street: '45 Lake View Road, Anna Nagar',
          city: 'Chennai',
          lat: 13.085,
          lng: 80.215
        },
        paymentMethod: 'cash'
      }
    });
    if (!bookRes.ok) throw new Error(`Create booking failed: ${JSON.stringify(bookRes.data)}`);
    const booking = bookRes.data.data;
    console.log(`✓ Booking created: #${booking.booking_number} (ID: ${booking.id}, Status: ${booking.status}, Amount: ₹${booking.amount})`);
    console.log(`✓ Problem description persisted: "${booking.problem_description}"`);
    console.log(`✓ Media attachments persisted: ${booking.media_attachments.length} file(s).`);

    // 6. Test Double-Booking Conflict Prevention
    console.log('\n6. Verifying double-booking conflict prevention...');
    const conflictRes = await request(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: {
        serviceName: 'AC Repair & Service',
        providerId: selectedProv.userId || selectedProv.id,
        date: uniqueDate,
        time: uniqueTime,
        address: { street: '45 Lake View Road', city: 'Chennai' }
      }
    });
    if (conflictRes.status === 409) {
      console.log(`✓ Double booking correctly rejected with HTTP 409 Conflict: "${conflictRes.data.message}"`);
    } else {
      throw new Error(`Expected HTTP 409 for double booking, got ${conflictRes.status}`);
    }

    // 7. Test Role-Based State Machine
    console.log('\n7. Verifying role-based state machine...');
    // Customer attempting to complete directly -> must be rejected
    const illegalComplete = await request(`${BASE_URL}/bookings/${booking.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: { status: 'completed' }
    });
    if (illegalComplete.status === 403) {
      console.log(`✓ Direct customer completion correctly rejected with HTTP 403 Forbidden: "${illegalComplete.data.message}"`);
    } else {
      throw new Error(`Expected HTTP 403 for customer completing booking, got ${illegalComplete.status}`);
    }

    // Provider progressive updates: accepted -> on_the_way -> arrived -> in_progress
    console.log('\n8. Provider progressing through lifecycle states...');
    const stages = ['accepted', 'on_the_way', 'arrived', 'in_progress'];
    for (const stage of stages) {
      const stepRes = await request(`${BASE_URL}/bookings/${booking.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provToken}` },
        body: { status: stage }
      });
      if (!stepRes.ok) throw new Error(`Provider transition to ${stage} failed: ${JSON.stringify(stepRes.data)}`);
      console.log(`✓ Status transitioned to: ${stage}`);
    }

    // 9. Test Additional Charges Flow
    console.log('\n9. Testing Additional Charges workflow...');
    // Provider requests additional charge
    const chargeReq = await request(`${BASE_URL}/bookings/${booking.id}/additional-charges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provToken}` },
      body: { amount: 350, description: 'Replacement AC blower capacitor' }
    });
    if (!chargeReq.ok) throw new Error(`Request additional charge failed: ${JSON.stringify(chargeReq.data)}`);
    const charge = chargeReq.data.data.charge;
    console.log(`✓ Additional charge requested by provider: ₹${charge.amount} (${charge.description}, ID: ${charge.id})`);

    // Customer approves additional charge
    const approveReq = await request(`${BASE_URL}/bookings/${booking.id}/additional-charges/${charge.id}/respond`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: { action: 'approve' }
    });
    if (!approveReq.ok) throw new Error(`Approve additional charge failed: ${JSON.stringify(approveReq.data)}`);
    const updatedBooking = approveReq.data.data.booking;
    console.log(`✓ Additional charge approved! Total booking amount updated: ₹${updatedBooking.amount}`);

    // 10. Provider marks job completed
    console.log('\n10. Provider completing service...');
    const completeRes = await request(`${BASE_URL}/bookings/${booking.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provToken}` },
      body: { status: 'completed' }
    });
    if (!completeRes.ok) throw new Error(`Complete booking failed: ${JSON.stringify(completeRes.data)}`);
    console.log(`✓ Booking marked COMPLETED. Payment status: ${completeRes.data.data.payment_status}`);

    // 11. Customer submits Review
    console.log('\n11. Customer submitting review for completed booking...');
    const reviewRes = await request(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: {
        bookingId: booking.id,
        rating: 5,
        comment: 'Super fast arrival, polite technician, fixed the capacitor quickly!'
      }
    });
    if (!reviewRes.ok) throw new Error(`Submit review failed: ${JSON.stringify(reviewRes.data)}`);
    console.log(`✓ Review submitted: 5 stars — "${reviewRes.data.data.comment}"`);

    // 12. Test Duplicate Review Prevention
    console.log('\n12. Testing duplicate review prevention...');
    const dupReviewRes = await request(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: {
        bookingId: booking.id,
        rating: 4,
        comment: 'Trying duplicate review'
      }
    });
    if (dupReviewRes.status === 400) {
      console.log(`✓ Duplicate review correctly rejected: "${dupReviewRes.data.message}"`);
    } else {
      throw new Error(`Expected HTTP 400 for duplicate review, got ${dupReviewRes.status}`);
    }

    console.log('\n======================================================');
    console.log('🎉 FULL CUSTOMER JOURNEY E2E TEST COMPLETED WITH 100% SUCCESS!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed with error:', err.message || err);
    process.exit(1);
  }
}

runTest();
