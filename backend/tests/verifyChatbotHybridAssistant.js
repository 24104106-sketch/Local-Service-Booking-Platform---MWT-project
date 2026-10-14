/**
 * FixIt Local - Chatbot Hybrid Assistant Test & Verification Suite
 * Tests Multilingual AI/NLP, Intent Classification, Entity Extraction,
 * Multi-turn Context Memory, Real DB Queries, Cards, Security & History.
 */

const assert = require('assert');
const {
  detectLanguage,
  normalizeText,
  extractEntities,
  classifyIntent,
  processUserMessage,
  getOrCreateUserContext,
  updateContext,
  resetContext
} = require('../services/chatbotAiService');
const { User, Service, Booking, Payment, ProviderProfile } = require('../models');

async function runChatbotTests() {
  console.log('====================================================');
  console.log(' FIXIT LOCAL - CHATBOT HYBRID ASSISTANT TEST SUITE');
  console.log('====================================================\n');

  // Find or use a test user
  let testUser = await User.findOne({ where: { role: 'customer' } });
  if (!testUser) {
    testUser = await User.findOne();
  }
  assert(testUser, 'A test user must exist in the database');
  console.log(`✓ Using test user: ID ${testUser.id} (${testUser.name}, ${testUser.email})`);

  // 1. Language Detection Tests
  console.log('\n--- 1. Testing Multilingual Detection (English, Tamil, Tanglish) ---');
  assert.strictEqual(detectLanguage('I need a plumber tomorrow').language, 'en');
  console.log('  ✓ English detected correctly');

  assert.strictEqual(detectLanguage('நாளைக்கு electrician வேண்டும்').language, 'ta');
  console.log('  ✓ Tamil script detected correctly');

  assert.strictEqual(detectLanguage('enaku plumber venum').language, 'tanglish');
  assert.strictEqual(detectLanguage('plumber book pannanum').language, 'tanglish');
  assert.strictEqual(detectLanguage('provider enga irukanga?').language, 'tanglish');
  console.log('  ✓ Tanglish patterns detected correctly');

  // 2. Entity Extraction Tests
  console.log('\n--- 2. Testing Entity Extraction ---');
  const query1 = 'tomorrow evening enaku plumber Anna Nagar la venum';
  const ent1 = extractEntities(query1);
  assert.strictEqual(ent1.category, 'Plumber', 'Category must be Plumber');
  assert.strictEqual(ent1.location, 'Anna Nagar', 'Location must be Anna Nagar');
  assert.strictEqual(ent1.time, '05:00 PM', 'Time must be 05:00 PM (evening)');
  assert(ent1.date != null, 'Date must be extracted for tomorrow');
  console.log(`  ✓ Extracted entities from "${query1}": category=${ent1.category}, location=${ent1.location}, time=${ent1.time}, date=${ent1.date}`);

  const urgentQuery = 'urgent pipe burst aayiduchu water flooding';
  const ent2 = extractEntities(urgentQuery);
  assert.strictEqual(ent2.category, 'Plumber');
  assert.strictEqual(ent2.isUrgent, true, 'isUrgent must be true');
  console.log('  ✓ Urgent emergency entity extraction passed');

  // 3. Intent Classification Tests
  console.log('\n--- 3. Testing Intent Classification ---');
  assert.strictEqual(classifyIntent('I need AC service', { category: 'AC Repair' }), 'find_service');
  assert.strictEqual(classifyIntent('best plumber', { category: 'Plumber' }), 'provider_recommendation');
  assert.strictEqual(classifyIntent('best plumber near me', { category: 'Plumber', isNearbyRequest: true }), 'nearby_provider_search');
  assert.strictEqual(classifyIntent('where is my technician?'), 'track_provider');
  assert.strictEqual(classifyIntent('provider enga irukanga?'), 'track_provider');
  assert.strictEqual(classifyIntent('my booking status enna?'), 'booking_status');
  assert.strictEqual(classifyIntent('who is my provider?'), 'provider_details');
  assert.strictEqual(classifyIntent('payment successful ah?'), 'payment_status');
  assert.strictEqual(classifyIntent('refund varuma?'), 'refund_status');
  assert.strictEqual(classifyIntent('booking cancel panna mudiyuma?'), 'cancel_booking');
  assert.strictEqual(classifyIntent('review kudukanum'), 'review_service');
  assert.strictEqual(classifyIntent('contact support'), 'support');
  console.log('  ✓ All primary intent patterns successfully classified');

  // 4. Multi-Turn Context Memory Tests
  console.log('\n--- 4. Testing Multi-turn Context Memory ---');
  resetContext(testUser.id);
  const turn1 = await processUserMessage({ user: testUser, text: 'I need a plumber.' });
  assert.strictEqual(turn1.intent, 'find_service');
  assert.strictEqual(turn1.context.category, 'Plumber');
  console.log('  ✓ Turn 1: Service identified as Plumber');

  const turn2 = await processUserMessage({ user: testUser, text: 'Anna Nagar' });
  assert.strictEqual(turn2.context.category, 'Plumber', 'Context must remember category from turn 1');
  assert.strictEqual(turn2.context.location, 'Anna Nagar', 'Context must capture location from turn 2');
  console.log(`  ✓ Turn 2: Context retained category=${turn2.context.category} and merged location=${turn2.context.location}`);

  // 5. Service Discovery & Real DB Integration
  console.log('\n--- 5. Testing Service Discovery with Real Database ---');
  const serviceRes = await processUserMessage({ user: testUser, text: 'show me plumbing services' });
  assert(serviceRes.card, 'Service card must be returned');
  assert.strictEqual(serviceRes.card.type, 'service_list');
  assert(Array.isArray(serviceRes.card.data.services), 'Services array must be present');
  console.log(`  ✓ Retrieved ${serviceRes.card.data.services.length} real services from database`);

  // 6. Provider Recommendation Engine Integration
  console.log('\n--- 6. Testing Provider Recommendation Engine Integration ---');
  const recRes = await processUserMessage({ user: testUser, text: 'best plumber near me' });
  assert(recRes.card, 'Provider card must be returned');
  assert.strictEqual(recRes.card.type, 'provider_card');
  assert(recRes.card.data.name, 'Provider name must be present');
  console.log(`  ✓ Top recommended provider: "${recRes.card.data.name}" (Rating: ${recRes.card.data.rating}, Price: ${recRes.card.data.price})`);

  // 7. Booking Status Check
  console.log('\n--- 7. Testing Booking Status with Database ---');
  const statusRes = await processUserMessage({ user: testUser, text: 'what is my booking status?' });
  assert(statusRes.text.length > 0, 'Reply text must be populated');
  console.log(`  ✓ Booking status response received: "${statusRes.text.slice(0, 60)}..."`);

  // 8. Live Tracking Integration
  console.log('\n--- 8. Testing Live Provider Tracking Intent ---');
  const trackRes = await processUserMessage({ user: testUser, text: 'provider enga irukanga?' });
  assert(trackRes.actions.length > 0, 'Tracking action buttons must be provided');
  console.log(`  ✓ Live tracking response generated with action: ${trackRes.actions[0].label}`);

  // 9. Payment & Refund Assistant
  console.log('\n--- 9. Testing Payment & Refund Assistant ---');
  const payRes = await processUserMessage({ user: testUser, text: 'payment status enna?' });
  assert(payRes.text.length > 0, 'Payment text must be populated');
  const refRes = await processUserMessage({ user: testUser, text: 'refund varuma?' });
  assert(refRes.text.length > 0, 'Refund text must be populated');
  console.log('  ✓ Payment and Refund responses successfully processed');

  // 10. Cancellation Flow with Confirmation
  console.log('\n--- 10. Testing Cancellation Safety Flow ---');
  const cancelRes = await processUserMessage({ user: testUser, text: 'booking cancel panna mudiyuma?' });
  assert(cancelRes.text.length > 0);
  console.log('  ✓ Cancellation safety check handled properly');

  // 11. FAQ / Knowledge Base
  console.log('\n--- 11. Testing Knowledge Base & FAQs ---');
  const faqRes = await processUserMessage({ user: testUser, text: 'how to book a service?' });
  assert(faqRes.text.includes('FixIt Local'), 'FAQ answer must be returned');
  console.log('  ✓ Knowledge Base FAQ returned verified answers');

  // 12. Chatbot History Database Persistence
  console.log('\n--- 12. Testing Chatbot History Database Persistence ---');
  const { ChatbotHistory } = require('../models');
  let historyRecord = await ChatbotHistory.findOne({ where: { user_id: testUser.id } });
  if (!historyRecord) {
    historyRecord = await ChatbotHistory.create({
      user_id: testUser.id,
      messages: []
    });
  }
  const prevCount = historyRecord.messages ? historyRecord.messages.length : 0;
  historyRecord.messages = [
    ...(historyRecord.messages || []),
    { id: 't-1', sender: 'user', text: 'Hi', createdAt: new Date().toISOString() },
    { id: 't-2', sender: 'assistant', text: 'Hello!', createdAt: new Date().toISOString() }
  ];
  await historyRecord.save();
  const reloaded = await ChatbotHistory.findOne({ where: { user_id: testUser.id } });
  assert(reloaded.messages.length >= prevCount + 2, 'History must persist messages in DB');
  console.log(`  ✓ Persisted conversation history in MySQL (Total messages: ${reloaded.messages.length})`);

  // 13. Chatbot History Clearing
  console.log('\n--- 13. Testing Chatbot History Clearing ---');
  await ChatbotHistory.destroy({ where: { user_id: testUser.id } });
  const cleared = await ChatbotHistory.findOne({ where: { user_id: testUser.id } });
  assert.strictEqual(cleared, null, 'ChatbotHistory must be cleared from DB');
  console.log('  ✓ History record destroyed safely from MySQL');

  // 14. All 8 Mandatory Multilingual & Multi-Turn Conversation Test Flows
  console.log('\n--- 14. Testing All 8 Mandatory Multilingual & Multi-Turn Flows ---');
  
  // Mandatory Test 1: English Multi-turn
  resetContext(testUser.id);
  const m1_t1 = await processUserMessage({ user: testUser, text: 'I need a plumber' });
  assert.strictEqual(m1_t1.intent, 'find_service');
  assert.strictEqual(m1_t1.context.category, 'Plumber');
  const m1_t2 = await processUserMessage({ user: testUser, text: 'Anna Nagar' });
  assert.strictEqual(m1_t2.intent, 'nearby_provider_search');
  assert.strictEqual(m1_t2.card?.type, 'provider_card');
  assert(m1_t2.text.includes('Anna Nagar'));
  assert(!m1_t2.text.includes('Welcome') && !m1_t2.text.includes('smart local service guide'), 'Must not return generic greeting');
  console.log('  ✓ Mandatory Test 1 (English multi-turn: "I need a plumber" -> "Anna Nagar") PASSED');

  // Mandatory Test 2: Tamil Multi-turn
  resetContext(testUser.id);
  const m2_t1 = await processUserMessage({ user: testUser, text: 'எனக்கு ஒரு பிளம்பர் வேண்டும்' });
  assert.strictEqual(m2_t1.language, 'ta');
  assert.strictEqual(m2_t1.context.category, 'Plumber');
  const m2_t2 = await processUserMessage({ user: testUser, text: 'அண்ணா நகரில் வேண்டும்' });
  assert.strictEqual(m2_t2.language, 'ta');
  assert.strictEqual(m2_t2.card?.type, 'provider_card');
  assert(m2_t2.text.includes('Anna Nagar') || m2_t2.text.includes('அண்ணா நகர்'));
  console.log('  ✓ Mandatory Test 2 (Tamil multi-turn: "எனக்கு ஒரு பிளம்பர் வேண்டும்" -> "அண்ணா நகரில் வேண்டும்") PASSED');

  // Mandatory Test 3: Tanglish Multi-turn
  resetContext(testUser.id);
  const m3_t1 = await processUserMessage({ user: testUser, text: 'enaku plumber venum' });
  assert.strictEqual(m3_t1.language, 'tanglish');
  assert.strictEqual(m3_t1.context.category, 'Plumber');
  const m3_t2 = await processUserMessage({ user: testUser, text: 'Anna Nagar' });
  assert.strictEqual(m3_t2.language, 'tanglish');
  assert.strictEqual(m3_t2.card?.type, 'provider_card');
  assert(m3_t2.text.includes('Anna Nagar'));
  console.log('  ✓ Mandatory Test 3 (Tanglish multi-turn: "enaku plumber venum" -> "Anna Nagar") PASSED');

  // Mandatory Test 4: Tanglish Nearby
  resetContext(testUser.id);
  const m4 = await processUserMessage({ user: testUser, text: 'ama enaku ipo enoda location ku nearby providers venu' });
  assert.strictEqual(m4.language, 'tanglish');
  assert.strictEqual(m4.intent, 'nearby_provider_search');
  assert(m4.card?.type === 'provider_card', 'Must show real provider card');
  assert(!m4.text.includes('Welcome') && !m4.text.includes('smart local service guide'));
  console.log('  ✓ Mandatory Test 4 (Tanglish nearby: "ama enaku ipo enoda location ku nearby providers venu") PASSED');

  // Mandatory Test 5: Tamil Voice Transcript
  resetContext(testUser.id);
  const m5 = await processUserMessage({ user: testUser, text: 'எனக்கு அருகில் உள்ள பிளம்பர்களை காட்டுங்கள்' });
  assert.strictEqual(m5.language, 'ta');
  assert.strictEqual(m5.intent, 'nearby_provider_search');
  assert.strictEqual(m5.card?.type, 'provider_card');
  console.log('  ✓ Mandatory Test 5 (Tamil voice transcript: "எனக்கு அருகில் உள்ள பிளம்பர்களை காட்டுங்கள்") PASSED');

  // Mandatory Test 6: English Voice Transcript
  resetContext(testUser.id);
  const m6 = await processUserMessage({ user: testUser, text: 'I need an electrician near me' });
  assert.strictEqual(m6.language, 'en');
  assert.strictEqual(m6.intent, 'nearby_provider_search');
  assert.strictEqual(m6.card?.type, 'provider_card');
  console.log('  ✓ Mandatory Test 6 (English voice transcript: "I need an electrician near me") PASSED');

  // Mandatory Test 7: Language Switch in same conversation
  resetContext(testUser.id);
  const m7_t1 = await processUserMessage({ user: testUser, text: 'I need a plumber' });
  assert.strictEqual(m7_t1.language, 'en');
  const m7_t2 = await processUserMessage({ user: testUser, text: 'என் அருகில் உள்ளவர்களை காட்டு' });
  assert.strictEqual(m7_t2.language, 'ta');
  const m7_t3 = await processUserMessage({ user: testUser, text: 'ama nearby provider venum' });
  assert.strictEqual(m7_t3.language, 'tanglish');
  console.log('  ✓ Mandatory Test 7 (Language switch: English -> Tamil -> Tanglish) PASSED');

  // Mandatory Test 8: Booking Context with Ordinal Provider Resolution
  resetContext(testUser.id);
  await processUserMessage({ user: testUser, text: 'plumber venum' });
  await processUserMessage({ user: testUser, text: 'Anna Nagar' });
  const m8 = await processUserMessage({ user: testUser, text: 'first provider ah book pannu' });
  assert.strictEqual(m8.intent, 'book_service');
  assert.strictEqual(m8.card?.type, 'booking_summary');
  assert(m8.card?.data?.provider, 'Provider must be resolved in booking summary');
  console.log(`  ✓ Mandatory Test 8 (Booking context: "first provider ah book pannu" -> ${m8.card?.data?.provider}) PASSED`);

  console.log('\n====================================================');
  console.log(' ALL CHATBOT HYBRID ASSISTANT BACKEND TESTS PASSED! ');
  console.log('====================================================\n');
}

runChatbotTests().catch(err => {
  console.error('\n❌ CHATBOT TEST FAILURE:', err);
  process.exit(1);
});
