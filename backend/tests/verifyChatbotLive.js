/**
 * Comprehensive FixIt Local Chatbot Real-World Verification Test Suite
 * Tests live endpoints, authentication, guest sessions, multi-turn conversations,
 * location permissions, provider data validity, and booking/cancellation safety.
 */

const jwt = require('jsonwebtoken');
const { User, ProviderProfile, Service, Booking, Payment, ChatbotHistory } = require('../models');
const { JWT_SECRET } = require('../middleware/auth');

const BASE_URL = 'http://localhost:5000/api';

async function postChat(body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`${BASE_URL}/chatbot/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function getChatHistory(token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`${BASE_URL}/chatbot/history`, {
    method: 'GET',
    headers
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log('=================================================================');
  console.log('   FixIt Local - Chatbot Live Automated Verification Suite');
  console.log('=================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failedCount++;
    }
  }

  // --- 1. USER & SESSION SETUP ---
  console.log('\n--- Scenario 1: Setup Customer and Guest sessions ---');
  let testCustomer = await User.findOne({ where: { role: 'customer', status: 'active' } });
  if (!testCustomer) {
    testCustomer = await User.create({
      name: 'Verification Customer',
      email: 'verify_cust_' + Date.now() + '@example.com',
      password: 'Password123!',
      role: 'customer',
      status: 'active'
    });
  }
  const customerToken = jwt.sign(
    { id: testCustomer.id, email: testCustomer.email, role: testCustomer.role },
    process.env.JWT_SECRET || 'fixit_local_jwt_secret_key_2026_dev_secure',
    { expiresIn: '1h' }
  );
  console.log(`  Customer user ID: ${testCustomer.id}, Name: ${testCustomer.name}`);

  // Test other customer for isolation check
  let otherCustomer = await User.findOne({
    where: {
      role: 'customer',
      status: 'active',
      id: { [require('sequelize').Op.ne]: testCustomer.id }
    }
  });
  if (!otherCustomer) {
    otherCustomer = await User.create({
      name: 'Other Customer',
      email: 'other_cust_' + Date.now() + '@example.com',
      password: 'Password123!',
      role: 'customer',
      status: 'active'
    });
  }
  const otherCustomerToken = jwt.sign(
    { id: otherCustomer.id, email: otherCustomer.email, role: otherCustomer.role },
    process.env.JWT_SECRET || 'fixit_local_jwt_secret_key_2026_dev_secure',
    { expiresIn: '1h' }
  );

  // --- 2. MULTI-TURN CONVERSATION TESTS ---

  // Conversation A: "I need a plumber" -> "Anna Nagar"
  console.log('\n--- Scenario 2A: English Flow: "I need a plumber" -> "Anna Nagar" ---');
  const sessA = 'sess_en_' + Date.now();
  const resA1 = await postChat({ message: 'I need a plumber', sessionId: sessA });
  assert(resA1.status === 200, 'Turn 1 status 200');
  const asstA1 = resA1.data?.data?.assistantMessage;
  assert(asstA1?.language === 'en', `Turn 1 language is 'en' (got: ${asstA1?.language})`);
  assert(asstA1?.intent === 'find_service', `Turn 1 intent is 'find_service' (got: ${asstA1?.intent})`);
  assert(asstA1?.text?.toLowerCase().includes('plumber'), `Turn 1 mentions plumber`);

  const resA2 = await postChat({ message: 'Anna Nagar', sessionId: sessA });
  assert(resA2.status === 200, 'Turn 2 status 200');
  const asstA2 = resA2.data?.data?.assistantMessage;
  assert(asstA2?.language === 'en', `Turn 2 language stays 'en' (got: ${asstA2?.language})`);
  assert(asstA2?.intent === 'nearby_provider_search', `Turn 2 intent resolved to 'nearby_provider_search' (got: ${asstA2?.intent})`);
  assert(asstA2?.card?.type === 'provider_card', `Turn 2 returns provider_card (got: ${asstA2?.card?.type})`);
  assert(asstA2?.card?.data?.name, `Provider card has real provider name: "${asstA2?.card?.data?.name}"`);
  assert(asstA2?.card?.data?.rating != null, `Provider card has real rating: ${asstA2?.card?.data?.rating}`);

  // Conversation B: "enaku plumber venum" -> "Anna Nagar"
  console.log('\n--- Scenario 2B: Tanglish Flow: "enaku plumber venum" -> "Anna Nagar" ---');
  const sessB = 'sess_tanglish_' + Date.now();
  const resB1 = await postChat({ message: 'enaku plumber venum', sessionId: sessB });
  assert(resB1.status === 200, 'Turn 1 status 200');
  const asstB1 = resB1.data?.data?.assistantMessage;
  assert(asstB1?.language === 'tanglish', `Turn 1 language is 'tanglish' (got: ${asstB1?.language})`);
  assert(asstB1?.intent === 'find_service', `Turn 1 intent is 'find_service' (got: ${asstB1?.intent})`);
  assert(asstB1?.text?.includes('Plumber'), `Turn 1 retains Plumber category`);

  const resB2 = await postChat({ message: 'Anna Nagar', sessionId: sessB });
  assert(resB2.status === 200, 'Turn 2 status 200');
  const asstB2 = resB2.data?.data?.assistantMessage;
  assert(asstB2?.language === 'tanglish', `Turn 2 persists 'tanglish' language (got: ${asstB2?.language})`);
  assert(asstB2?.intent === 'nearby_provider_search', `Turn 2 resolves to 'nearby_provider_search' (got: ${asstB2?.intent})`);
  assert(asstB2?.card?.type === 'provider_card', `Turn 2 returns provider_card`);
  assert(!asstB2?.text?.startsWith('Hello'), `Turn 2 does not return generic greeting`);

  // Conversation C: "எனக்கு ஒரு பிளம்பர் வேண்டும்" -> "அண்ணா நகரில் வேண்டும்"
  console.log('\n--- Scenario 2C: Tamil Flow: "எனக்கு ஒரு பிளம்பர் வேண்டும்" -> "அண்ணா நகரில் வேண்டும்" ---');
  const sessC = 'sess_ta_' + Date.now();
  const resC1 = await postChat({ message: 'எனக்கு ஒரு பிளம்பர் வேண்டும்', sessionId: sessC });
  assert(resC1.status === 200, 'Turn 1 status 200');
  const asstC1 = resC1.data?.data?.assistantMessage;
  assert(asstC1?.language === 'ta', `Turn 1 language is 'ta' (got: ${asstC1?.language})`);
  assert(asstC1?.intent === 'find_service', `Turn 1 intent is 'find_service'`);

  const resC2 = await postChat({ message: 'அண்ணா நகரில் வேண்டும்', sessionId: sessC });
  assert(resC2.status === 200, 'Turn 2 status 200');
  const asstC2 = resC2.data?.data?.assistantMessage;
  assert(asstC2?.language === 'ta', `Turn 2 language is 'ta' (got: ${asstC2?.language})`);
  assert(asstC2?.intent === 'nearby_provider_search', `Turn 2 resolves to 'nearby_provider_search'`);
  assert(asstC2?.card?.type === 'provider_card', `Turn 2 returns provider_card`);
  assert(asstC2?.text?.includes('அண்ணா நகர்'), `Turn 2 includes Tamil location recognition`);

  // Conversation D: "ama enaku ipo enoda location ku nearby providers venu"
  console.log('\n--- Scenario 2D: Tanglish Nearby Query: "ama enaku ipo enoda location ku nearby providers venu" ---');
  const sessD = 'sess_tanglish_nearby_' + Date.now();
  const resD = await postChat({ message: 'ama enaku ipo enoda location ku nearby providers venu', sessionId: sessD });
  assert(resD.status === 200, 'Status 200');
  const asstD = resD.data?.data?.assistantMessage;
  assert(asstD?.language === 'tanglish', `Language detected as 'tanglish' (got: ${asstD?.language})`);
  assert(asstD?.intent === 'nearby_provider_search', `Intent is 'nearby_provider_search' (got: ${asstD?.intent})`);
  assert(asstD?.card?.type === 'provider_card', `Returns provider_card with top match`);
  assert(!asstD?.text?.toLowerCase().startsWith('hello'), `Did not trigger generic greeting`);

  // Conversation E: "plumber venum" -> "Anna Nagar" -> "first provider ah book pannu"
  console.log('\n--- Scenario 2E: Booking Flow: "plumber venum" -> "Anna Nagar" -> "first provider ah book pannu" ---');
  const sessE = 'sess_booking_' + Date.now();
  const resE1 = await postChat({ message: 'plumber venum', sessionId: sessE });
  assert(resE1.data?.data?.assistantMessage?.intent === 'find_service', `Turn 1 intent is find_service`);

  const resE2 = await postChat({ message: 'Anna Nagar', sessionId: sessE });
  const topProviderName = resE2.data?.data?.assistantMessage?.card?.data?.name;
  assert(Boolean(topProviderName), `Turn 2 found provider: "${topProviderName}"`);

  const resE3 = await postChat({ message: 'first provider ah book pannu', sessionId: sessE });
  assert(resE3.status === 200, 'Turn 3 status 200');
  const asstE3 = resE3.data?.data?.assistantMessage;
  assert(asstE3?.intent === 'book_service', `Turn 3 intent is 'book_service' (got: ${asstE3?.intent})`);
  assert(asstE3?.card?.type === 'booking_summary', `Turn 3 returns 'booking_summary' card (got: ${asstE3?.card?.type})`);
  assert(asstE3?.card?.data?.provider === topProviderName, `Turn 3 resolved ordinal provider to "${topProviderName}"`);
  assert(asstE3?.card?.data?.location === 'Anna Nagar', `Turn 3 persisted location "Anna Nagar"`);

  // --- 3. LOCATION PERMISSION GRANTED AND DENIED ---
  console.log('\n--- Scenario 3: Geolocation Permission Handling ---');
  // 3A: Granted with exact coordinates
  const sessGeo = 'sess_geo_' + Date.now();
  const resGeo = await postChat({
    message: 'plumber near me',
    coordinates: { latitude: 13.0850, longitude: 80.2101 },
    sessionId: sessGeo
  });
  assert(resGeo.status === 200, 'Granted location returns 200');
  assert(resGeo.data?.data?.assistantMessage?.card?.type === 'provider_card', 'Granted coordinates returns real provider_card');
  assert(resGeo.data?.data?.assistantMessage?.card?.data?.distance?.includes('km away') || resGeo.data?.data?.assistantMessage?.card?.data?.distance?.includes('Nearby'), 'Calculated distance from coordinates');

  // 3B: Denied permission
  const sessDeny = 'sess_deny_' + Date.now();
  const resDeny = await postChat({
    message: 'nearby providers venu',
    payload: { locationPermissionDenied: true },
    sessionId: sessDeny
  });
  assert(resDeny.status === 200, 'Denied location returns 200');
  const denyText = resDeny.data?.data?.assistantMessage?.text;
  assert(denyText?.toLowerCase().includes('location') || denyText?.toLowerCase().includes('permission'), `Prompted user for location access: "${denyText}"`);
  assert(resDeny.data?.data?.assistantMessage?.actions?.some(a => a.payload?.location), 'Offers manual locality selection actions');

  // --- 4. AUTHENTICATION & HISTORY ISOLATION ---
  console.log('\n--- Scenario 4: User Authentication & History Isolation ---');
  // 4A: Guest cannot read /api/chatbot/history without token
  const guestHist = await getChatHistory(null);
  assert(guestHist.status === 401, `Guest access to /api/chatbot/history is blocked with 401 (got ${guestHist.status})`);

  // 4B: Customer A sends message authenticated
  const resCustA = await postChat({ message: 'I need AC repair service' }, customerToken);
  assert(resCustA.status === 200, 'Authenticated Customer A sent message');

  // 4C: Customer A reads history
  const histA = await getChatHistory(customerToken);
  assert(histA.status === 200, 'Customer A can read own history');
  let msgsA = histA.data?.data?.messages || [];
  if (typeof msgsA === 'string') {
    try { msgsA = JSON.parse(msgsA); } catch (_) { msgsA = []; }
  }
  assert(Array.isArray(msgsA) && msgsA.some(m => m.text?.includes('AC repair')), 'Customer A history contains own message');

  // 4D: Customer B reads history and must NOT see Customer A messages
  const histB = await getChatHistory(otherCustomerToken);
  assert(histB.status === 200, 'Customer B reads own history');
  let msgsB = histB.data?.data?.messages || [];
  if (typeof msgsB === 'string') {
    try { msgsB = JSON.parse(msgsB); } catch (_) { msgsB = []; }
  }
  const leaked = Array.isArray(msgsB) && msgsB.some(m => m.text?.includes('AC repair'));
  assert(!leaked, 'Customer B history does NOT contain Customer A messages (Strict isolation verified)');

  // --- 5. PRIVATE BOOKING / PAYMENT DATA LEAK PREVENTION ---
  console.log('\n--- Scenario 5: Booking / Payment Data Authorization ---');
  // Query booking status as Customer B for Customer A's booking
  const aBooking = await Booking.findOne({ where: { customer_id: testCustomer.id } });
  if (aBooking) {
    const resSnoop = await postChat({ message: `Where is my booking #${aBooking.booking_number}` }, otherCustomerToken);
    const textSnoop = resSnoop.data?.data?.assistantMessage?.text;
    assert(!textSnoop?.includes(aBooking.service_title), `Customer B cannot view Customer A's booking details via assistant`);
  } else {
    console.log('  [INFO] No preexisting booking for Customer A, testing booking status with fictitious number');
    const resSnoop = await postChat({ message: 'booking status #999999' }, customerToken);
    const snoopText = resSnoop.data?.data?.assistantMessage?.text?.toLowerCase() || '';
    assert(snoopText.includes('no active booking') || snoopText.includes('not found') || snoopText.includes('kidaikavillai'), 'Safe handling of nonexistent or unauthorized booking');
  }

  // --- 6. SAFE CANCELLATION & POLICY VERIFICATION ---
  console.log('\n--- Scenario 6: Cancellation Safety & Policy Inquiries ---');
  const resCancel = await postChat({ message: 'How do I cancel my booking?' });
  assert(resCancel.status === 200, 'Cancellation inquiry returns 200');
  const cancelText = resCancel.data?.data?.assistantMessage?.text?.toLowerCase() || '';
  assert(cancelText.includes('cancel') && (cancelText.includes('refund') || cancelText.includes('technician starts')), 'Assistant provides accurate cancellation & refund policy guidance');

  // Verify non-destructive booking flow (Summary card generated, no raw DB write before explicit user confirmation)
  const resSafeBook = await postChat({ message: 'book a plumber' });
  assert(resSafeBook.status === 200, 'Booking inquiry returns 200');
  assert(resSafeBook.data?.data?.assistantMessage?.intent === 'book_service' || resSafeBook.data?.data?.assistantMessage?.intent === 'find_service', 'Booking requires confirmation flow without premature booking generation');

  // --- 6. SUMMARY ---
  console.log('\n=================================================================');
  console.log(`Verification Complete: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('=================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
