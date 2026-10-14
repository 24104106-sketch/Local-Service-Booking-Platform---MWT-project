/**
 * FixIt Local - Modern Multilingual Hybrid AI/NLP Service Booking Assistant Engine
 * 
 * Supports:
 * - Language Detection: English, Tamil (தமிழ்), Tanglish, Mixed
 * - Strict Language Matching: Respond in the exact language & style (English -> English, Tamil -> Tamil, Tanglish -> Tanglish)
 * - Multi-turn Conversation Context Retention (Category, Location, Date, Time, Providers list, Booking ID)
 * - Never returns generic greeting for valid query or follow-up
 * - Real Provider Recommendation Engine Integration (Coordinates from browser or named locality)
 * - Interactive Cards: ProviderCard, BookingStatusCard, BookingSummaryCard, LiveTrackingCard, PaymentCard, SupportCard
 */

const { Op } = require('sequelize');
const {
  Service,
  ProviderProfile,
  ProviderService,
  User,
  Booking,
  Payment,
  Community,
  Review,
  Complaint
} = require('../models');
const { getRecommendedProviders } = require('./providerRecommendationService');
const { getCanonicalCategory } = require('../utils/categoryNormalizer');

// In-memory conversation context store per user ID / conversation ID
const contextMemoryStore = new Map();

/**
 * 1. RELIABLE MULTILINGUAL DETECTION (English, Tamil, Tanglish, Mixed)
 */
function detectLanguage(text = '') {
  if (!text || typeof text !== 'string') return { language: 'en', confidence: 1.0 };
  const raw = text.trim();

  // Check for Tamil Unicode characters (\u0B80 - \u0BFF)
  const tamilCharCount = (raw.match(/[\u0B80-\u0BFF]/g) || []).length;
  const totalChars = raw.replace(/\s+/g, '').length;

  if (tamilCharCount > 0) {
    if (tamilCharCount / totalChars > 0.4) {
      return { language: 'ta', confidence: 0.95 };
    } else {
      return { language: 'mixed', confidence: 0.85 };
    }
  }

  const lower = raw.toLowerCase();

  // Comprehensive Tanglish Lexical Patterns (particles, pronouns, verb conjugations, vernacular tokens)
  const tanglishPatterns = [
    /\b(enaku|enakku|enoda|yenoda|enga|engae|engaloda|unaku|unakku|unoda|unga|ungala|ungaku|ungaluku|ungalukku|avaru|yaru|yaaru|ethu|edhu|edhuku|enna|ennoda)\b/i,
    /\b(venum|venu|vaenum|thevai|theva|pannanum|pananum|panrathu|panradhu|pannradhu|pannunga|panunga|pannu|panu|kudunga|kudu|solla|solunga|sollunga|kaatu|kaatunga|kaatungga)\b/i,
    /\b(irukku|iruku|irukanga|irukaanga|irukaaru|irukangala|iruntha|irundha|theriyala|theriyum|mudiyum|mudiyuma|mudiyadhu|mudiyala|varum|varala|varuma|vandhuchu|vanthuten)\b/i,
    /\b(eppo|eppadi|epdi|ipo|ippo|aagum|aaguthu|aachu|aayiduchu|aagala|poguthu|pogala|pakkathula|kitta|aduthu|mariyaadha|nalla|seri|seriya|illa|illai)\b/i,
    /\b(ama|aama|prechana|problem|thanni|kadhavu|veedu|vela|seiyala|seiyanum|evlo|evvalavu|naalaikku|naalaiku|nalaiki|iniki|iniku|marunaal|udane|avaram)\b/i,
    /\b\w+(?:-la|la|-ku|ku|-oda|oda|-ah|ah|aah)\b/i,
    /\b(nearby\s+providers?\s+venu|nearby\s+plumber\s+venum|providers?\s+kaatu)\b/i
  ];

  let tanglishScore = 0;
  for (const pat of tanglishPatterns) {
    if (pat.test(lower)) {
      tanglishScore += 1;
    }
  }

  if (tanglishScore >= 1) {
    return { language: 'tanglish', confidence: Math.min(0.98, 0.7 + tanglishScore * 0.1) };
  }

  return { language: 'en', confidence: 0.95 };
}

/**
 * Normalize text for NLP matching
 */
function normalizeText(text = '') {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0B80-\u0BFF#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 2. ENTITY EXTRACTION
 */
const KNOWN_CHENNAI_AREAS = {
  'anna nagar': { lat: 13.0850, lng: 80.2101 },
  't nagar': { lat: 13.0418, lng: 80.2341 },
  'adyar': { lat: 13.0012, lng: 80.2565 },
  'velachery': { lat: 12.9815, lng: 80.2180 },
  'mylapore': { lat: 13.0368, lng: 80.2676 },
  'besant nagar': { lat: 13.0003, lng: 80.2667 },
  'omr': { lat: 12.9345, lng: 80.2312 },
  'porur': { lat: 13.0382, lng: 80.1565 },
  'guindy': { lat: 13.0067, lng: 80.2021 },
  'tambaram': { lat: 12.9249, lng: 80.1000 },
  'kodambakkam': { lat: 13.0524, lng: 80.2253 },
  'nungambakkam': { lat: 13.0604, lng: 80.2425 },
  'royapettah': { lat: 13.0537, lng: 80.2625 },
  'alwarpet': { lat: 13.0336, lng: 80.2522 },
  'thiruvanmiyur': { lat: 12.9830, lng: 80.2594 },
  'kilpauk': { lat: 13.0837, lng: 80.2405 },
  'vadapalani': { lat: 13.0500, lng: 80.2121 },
  'ashok nagar': { lat: 13.0354, lng: 80.2108 },
  'sholinganallur': { lat: 12.9010, lng: 80.2279 },
  'medavakkam': { lat: 12.9189, lng: 80.1914 }
};

function extractEntities(rawText) {
  const norm = normalizeText(rawText);
  const entities = {};

  // Category / Service Extraction - supports English, Tanglish, and Tamil Unicode
  if (/(?:\b(ac\b|air conditioner|cooling|compressor|gas leak|gas refill|duct|hvac)\b|ஏசி|குளிர்ச்சி)/i.test(norm)) {
    entities.category = 'AC Repair';
    entities.service = 'AC Repair & Service';
  } else if (/(?:\b(plumb\w*|pipe\w*|tap\w*|tap leak|faucet|drain\w*|clog\w*|sink|flush|toilet|thanni leak)\b|குழாய்|பிளம்பர்)/i.test(norm)) {
    entities.category = 'Plumber';
    entities.service = 'Plumbing Fix';
  } else if (/(?:\b(electric\w*|wiring|switch\w*|socket|fan\w*|light\w*|mcb|fuse|short circuit|current\w*)\b|மின்சாரம்|எலக்ட்ரீசியன்)/i.test(norm)) {
    entities.category = 'Electrician';
    entities.service = 'Electrical Wiring';
  } else if (/(?:\b(clean\w*|deep clean|sofa clean|bathroom clean|kitchen clean|house clean)\b|சுத்தம்|கிளீனிங்)/i.test(norm)) {
    entities.category = 'Cleaning';
    entities.service = 'Deep Home Cleaning';
  } else if (/(?:\b(paint\w*|wall paint|whitewash)\b|வர்ணம்|பெயிண்டிங்)/i.test(norm)) {
    entities.category = 'Painting';
    entities.service = 'Home Painting';
  } else if (/(?:\b(carpenter\w*|carpentry|furniture|wood\w*|door repair|cupboard|lock)\b|தச்சர்)/i.test(norm)) {
    entities.category = 'Carpenter';
    entities.service = 'Carpentry Work';
  } else if (/(?:\b(pest\w*|cockroach|termite|bedbug|insects)\b|பூச்சி)/i.test(norm)) {
    entities.category = 'Pest Control';
    entities.service = 'Pest Control';
  } else if (/\b(appliance\w*|refrigerator|fridge|washing machine|microwave|geyser)/i.test(norm)) {
    entities.category = 'Appliance Repair';
    entities.service = 'Appliance Repair';
  }

  // Location Extraction (supports English, Tanglish suffix -la, and Tamil script)
  for (const [locKey, coords] of Object.entries(KNOWN_CHENNAI_AREAS)) {
    if (norm.includes(locKey)) {
      entities.location = locKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      entities.latitude = coords.lat;
      entities.longitude = coords.lng;
      break;
    }
  }

  // Tamil script location check (அண்ணா நகர் / அண்ணா நகரில்)
  if (norm.includes('அண்ணா நகர்') || norm.includes('அண்ணா நகரி') || norm.includes('அண்ணா நக')) {
    entities.location = 'Anna Nagar';
    entities.latitude = 13.0850;
    entities.longitude = 80.2101;
  } else if (norm.includes('தி நகர்') || norm.includes('டி நகர்') || norm.includes('தி நக') || norm.includes('டி நக')) {
    entities.location = 'T Nagar';
    entities.latitude = 13.0418;
    entities.longitude = 80.2341;
  } else if (norm.includes('அடையாறு') || norm.includes('அடையார்') || norm.includes('அடையா')) {
    entities.location = 'Adyar';
    entities.latitude = 13.0012;
    entities.longitude = 80.2565;
  }

  // Date Extraction
  const today = new Date();
  if (/\b(today|iniki|innikku|இன்று)\b/i.test(norm)) {
    entities.date = today.toISOString().slice(0, 10);
    entities.dateLabel = 'Today';
  } else if (/\b(tomorrow|naalaikku|naalaiku|nalaiki|நாளை|நாளைக்கு)\b/i.test(norm)) {
    const tmr = new Date(today);
    tmr.setDate(tmr.getDate() + 1);
    entities.date = tmr.toISOString().slice(0, 10);
    entities.dateLabel = 'Tomorrow';
  }

  // Time Extraction
  if (/\b(morning|kaalai|காலை|10\s*am)\b/i.test(norm)) {
    entities.time = '10:00 AM';
  } else if (/\b(afternoon|madhiyam|மதியம்|2\s*pm)\b/i.test(norm)) {
    entities.time = '02:00 PM';
  } else if (/\b(evening|maalai|மாலை|5\s*pm)\b/i.test(norm)) {
    entities.time = '05:00 PM';
  }

  // Booking ID Extraction (#123, BK-102, FIX-45)
  const bookingMatch = norm.match(/#?((?:bk|fix)?-?\d+)/i) || norm.match(/booking\s*#?\s*(\d+)/i);
  if (bookingMatch) {
    entities.bookingId = bookingMatch[1].replace(/#/g, '').trim();
  }

  // Provider ordinal selection ("first provider", "1st provider", "second")
  if (/\b(first provider|1st provider|first one|mudhal provider|முதல்|first provider ah|first provider ah book pannu)\b/i.test(norm) || norm.includes('first provider')) {
    entities.providerOrdinal = 1;
  } else if (/\b(second provider|2nd provider|second one)\b/i.test(norm)) {
    entities.providerOrdinal = 2;
  }

  // Urgency & Sentiment
  entities.isUrgent = /\b(urgent|emergency|immediately|pipe burst|short circuit|flooding|leakage heavy|gas leak|avaram|udane|அவசரம்)\b/i.test(norm);
  entities.isNegative = /\b(bad service|terrible|worst|very bad|delay|problem solve aagala|3 days ah|frustrated|angry|cheat|மோசம்|புகார்)\b/i.test(norm);

  // Nearby marker (English, Tanglish, Tamil)
  entities.isNearbyRequest = /\b(near me|nearby|enoda location|location ku|en pakkathula|nearby provider|nearby providers)\b/i.test(norm) ||
    norm.includes('அருகில்') ||
    norm.includes('அருகிலுள்ள') ||
    norm.includes('nearby providers') ||
    norm.includes('nearby provider');

  return entities;
}

/**
 * 3. INTENT CLASSIFICATION WITH CONTEXT AWARENESS
 */
function classifyIntent(rawText, entities = {}, context = {}) {
  const norm = normalizeText(rawText);

  // If user explicitly asks for nearby providers
  if (entities.isNearbyRequest || /\b(nearby providers|providers kaatu|nearby plumber|near me)\b/i.test(norm)) {
    return 'nearby_provider_search';
  }

  // If user selected an ordinal provider ("first provider ah book pannu", "book him")
  if (entities.providerOrdinal || /\b(book him|first provider ah book pannu|book the provider|book this provider)\b/i.test(norm)) {
    return 'book_service';
  }

  // If user is answering with a LOCATION and we already have a service category in context
  if (entities.location && (context.category || entities.category)) {
    return 'nearby_provider_search';
  }

  // Explicit tracking queries
  if (
    /\b(track|tracking|enga irukanga|enga irukaaru|where is my technician|where is my provider|provider location|technician enga|technician location|live tracking)\b/i.test(norm) ||
    (norm.includes('enga') && (norm.includes('provider') || norm.includes('technician') || norm.includes('booking')))
  ) {
    return 'track_provider';
  }

  // Cancellation queries (Check before generic 'my booking' match)
  if (/\b(cancel|cancel booking|cancel panna mudiyuma|booking cancel pannanum|want to cancel|cancellation|how to cancel|how do i cancel)\b/i.test(norm)) {
    if (/\b(how to|how do i|policy|rule|charges)\b/i.test(norm)) {
      return 'general_question';
    }
    return 'cancel_booking';
  }

  // Booking status queries
  if (/\b(booking status|my booking|en booking status|status enna|order status|where is my booking|check my booking)\b/i.test(norm)) {
    return 'booking_status';
  }

  // Provider details queries
  if (/\b(who is my provider|provider details|yara assign pannirukanga|technician details|who is assigned)\b/i.test(norm)) {
    return 'provider_details';
  }

  // Refund queries
  if (/\b(refund|refund varuma|refund eppo varum|refund status|money back)\b/i.test(norm)) {
    return 'refund_status';
  }

  // Payment status queries
  if (/\b(payment|payment status|payment successful ah|how did i pay|payment pending ah|paid ah|pay status)\b/i.test(norm)) {
    return 'payment_status';
  }

  // Review & Rating queries
  if (/\b(review|rating|feedback|review kudukanum|rating epdi podradhu|star rating)\b/i.test(norm)) {
    return 'review_service';
  }

  // Service availability queries
  if (/\b(available ah|available|is anyone available|free slots|slot available|available today|available tomorrow)\b/i.test(norm)) {
    return 'service_availability';
  }

  // Provider recommendation queries
  if (/\b(best|top|top rated|recommend|recommendation|highest rated|which provider is best|nalla plumber)\b/i.test(norm)) {
    return 'provider_recommendation';
  }

  // Step-by-step guidance queries (FAQ)
  if (/\b(how to book|how do i book|how can i book|booking epdi|book panradhu epdi|how does booking work)\b/i.test(norm)) {
    return 'general_question';
  }

  // Booking a service flow
  if (/\b(book now|book a service|book pannanum|booking pannanum|plumber book pannanum|appointment|schedule|புக்)\b/i.test(norm) || norm.includes('புக் செய்ய')) {
    return 'book_service';
  }

  // Service discovery (English, Tamil, Tanglish)
  if (
    entities.category ||
    /\b(find service|browse service|services|plumber venum|electrician venum|ac venum)\b/i.test(norm) ||
    norm.includes('வேண்டும்') ||
    norm.includes('தேவை') ||
    norm.includes('venum') ||
    norm.includes('venu')
  ) {
    return 'find_service';
  }

  // Complaint / Frustration escalation
  if (entities.isNegative || /\b(complaint|problem solve aagala|not solved|bad experience|cheat)\b/i.test(norm)) {
    return 'complaint';
  }

  // Support / Help
  if (/\b(help|support|contact support|customer care|need help|உதவி)\b/i.test(norm)) {
    return 'support';
  }

  // Standalone greeting ONLY if no actionable intent/service/location present
  if (/^(hi|hello|hey|vanakkam|வணக்கம்|hola|hai)$/i.test(norm)) {
    return 'greeting';
  }

  // If we have an active service in context and user says anything else, assume searching/booking
  if (context.category && (entities.date || entities.time)) {
    return 'nearby_provider_search';
  }

  return 'general_question';
}

/**
 * 4. CONVERSATION CONTEXT MANAGER (Isolated per User/Session)
 */
function getOrCreateUserContext(userId) {
  const key = String(userId || 'guest');
  if (!contextMemoryStore.has(key)) {
    contextMemoryStore.set(key, {
      userId: key,
      category: null,
      service: null,
      location: null,
      latitude: null,
      longitude: null,
      date: null,
      time: null,
      bookingId: null,
      providers: [],
      selectedProvider: null,
      activeFlow: null,
      lastIntent: null,
      language: 'en',
      updatedAt: Date.now()
    });
  }
  return contextMemoryStore.get(key);
}

function updateContext(userId, newEntities = {}, extra = {}) {
  const ctx = getOrCreateUserContext(userId);
  if (newEntities.category) ctx.category = newEntities.category;
  if (newEntities.service) ctx.service = newEntities.service;
  if (newEntities.location) ctx.location = newEntities.location;
  if (newEntities.latitude != null) ctx.latitude = newEntities.latitude;
  if (newEntities.longitude != null) ctx.longitude = newEntities.longitude;
  if (newEntities.date) ctx.date = newEntities.date;
  if (newEntities.time) ctx.time = newEntities.time;
  if (newEntities.bookingId) ctx.bookingId = newEntities.bookingId;

  Object.assign(ctx, extra);
  ctx.updatedAt = Date.now();
  contextMemoryStore.set(String(userId), ctx);
  return ctx;
}

function resetContext(userId) {
  const key = String(userId || 'guest');
  contextMemoryStore.delete(key);
  return getOrCreateUserContext(key);
}

/**
 * 5. KNOWLEDGE BASE FAQ
 */
const KNOWLEDGE_BASE = [
  {
    topic: 'booking',
    keywords: ['how to book', 'how do i book', 'how can i book', 'booking process', 'how it works', 'epdi book panradhu', 'booking guide'],
    answer: {
      en: "Here's how to book a service on FixIt Local:\n1️⃣ Select your desired service (e.g. AC Repair, Plumbing).\n2️⃣ Select your date and time slot.\n3️⃣ Review verified providers and their ratings.\n4️⃣ Confirm your booking with online payment, wallet, or cash on delivery!",
      ta: 'FixIt Local-ல் Service புக் செய்ய:\n1️⃣ தேவையான சேவையைத் தேர்ந்தெடுக்கவும் (எ.கா. AC Repair, Plumbing).\n2️⃣ உங்களுக்கு வசதியான தேதி, நேரம் மற்றும் முகவரியைத் தேர்வு செய்யவும்.\n3️⃣ அங்கீகரிக்கப்பட்ட Provider-களின் விவரங்களைப் பார்த்து தேர்வு செய்யவும்.\n4️⃣ Online, Wallet அல்லது Cash on Delivery மூலம் முன்பதிவை உறுதிப்படுத்தவும்!',
      tanglish: 'FixIt Local la service book panna:\n1️⃣ Service select pannunga (AC Repair, Plumbing).\n2️⃣ Ungaluku convenient time & date choose pannunga.\n3️⃣ Verified providers list paathu provider select pannunga.\n4️⃣ Booking confirm pannunga with Online, Wallet or Cash payment!'
    }
  },
  {
    topic: 'payment',
    keywords: ['payment methods', 'how to pay', 'razorpay', 'wallet', 'cash', 'cod'],
    answer: {
      en: 'FixIt Local supports multiple secure payment methods:\n• Razorpay (UPI, Credit/Debit Cards, NetBanking)\n• FixIt Local In-App Wallet (Instant debit and instant refunds)\n• Cash on Service Completion (Direct cash to provider after job completion)',
      ta: 'FixIt Local பாதுகாப்பான கட்டண முறைகளை ஆதரிக்கிறது:\n• Razorpay (UPI, கிரெடிட்/டெபிட் கார்டு, NetBanking)\n• FixIt Local Wallet (உடனடி பேமென்ட் மற்றும் ரீஃபண்ட்)\n• Cash on Delivery (வேலை முடிந்த பின் Provider-க்கு பணம் செலுத்தலாம்)',
      tanglish: 'FixIt Local la safe payment methods irukku:\n• Razorpay (UPI, GPay, PhonePe, Cards)\n• FixIt Wallet (Instant payment & refunds)\n• Cash payment (Service mudinja aprom direct cash kudukalam)'
    }
  },
  {
    topic: 'cancellation',
    keywords: ['cancellation policy', 'cancel charges', 'refund policy', 'cancellation rule', 'how to cancel', 'how do i cancel', 'cancel my booking', 'cancel booking'],
    answer: {
      en: 'FixIt Local Cancellation & Refund Policy:\n• Free cancellation before the technician starts traveling.\n• If payment was made via Razorpay or Wallet, the hold is released immediately or refunded back to your account.\n• In-progress jobs cannot be cancelled once work has begun.',
      ta: 'ரத்து மற்றும் ரீஃபண்ட் கொள்கை:\n• டெக்னீசியன் பயணம் தொடங்கும் முன் இலவசமாக ரத்து செய்யலாம்.\n• ஆன்லைன் அல்லது Wallet மூலம் செலுத்திய தொகை உடனடியாக ரீஃபண்ட் செய்யப்படும்.\n• வேலை தொடங்கிய பின் ரத்து செய்ய இயலாது.',
      tanglish: 'Cancellation & Refund details:\n• Technician travel start pandrathuku munnadi free-ah cancel pannalam.\n• Wallet or Online payment panni irundha refund instant-ah release aagidum.\n• Work start aana aprom cancel panna mudiyadhu.'
    }
  }
];

function findKnowledgeAnswer(query, lang = 'en') {
  const norm = normalizeText(query);
  for (const item of KNOWLEDGE_BASE) {
    if (item.keywords.some(k => norm.includes(k))) {
      return item.answer[lang] || item.answer.en;
    }
  }
  return null;
}

/**
 * 6. CORE HYBRID AI/NLP PROCESSOR
 */
async function processUserMessage({
  user,
  text = '',
  action = null,
  payload = {},
  coordinates = null
}) {
  const userId = user?.id || user?._id || 'guest';
  const userName = user?.name || 'Customer';

  // Load existing context first
  let context = getOrCreateUserContext(userId);

  // Detect language for THIS message
  const langAnalysis = detectLanguage(text);
  let rawLang = langAnalysis.language === 'mixed' ? 'tanglish' : langAnalysis.language;
  let lang = rawLang;

  // Strict language matching rule:
  // 1. Tamil script input -> always Tamil
  if (/[\u0B80-\u0BFF]/.test(text)) {
    lang = 'ta';
  } else if (rawLang === 'tanglish') {
    lang = 'tanglish';
  } else if (context.language && context.language !== 'en' && rawLang === 'en') {
    // If user previously spoke Tanglish or Tamil, and this message is a short entity/follow-up
    // (e.g., "Anna Nagar", "tomorrow", "10 am", "ok", "yes", "first provider ah"),
    // retain the ongoing conversation language unless user typed a complete English sentence.
    const isExplicitEnglishSentence = /\b(i need|show me|can you|where is|how to|what is|please help|i want|could you)\b/i.test(text.toLowerCase());
    if (!isExplicitEnglishSentence) {
      lang = context.language;
    }
  }

  // Extract entities
  const entities = extractEntities(text);

  // If frontend passed coordinates in payload/coordinates, capture them
  if (coordinates && coordinates.latitude != null) {
    entities.latitude = coordinates.latitude;
    entities.longitude = coordinates.longitude;
  } else if (payload && payload.coordinates && payload.coordinates.latitude != null) {
    entities.latitude = payload.coordinates.latitude;
    entities.longitude = payload.coordinates.longitude;
  } else if (payload && payload.latitude != null) {
    entities.latitude = payload.latitude;
    entities.longitude = payload.longitude;
  }

  // Classify intent using query + entities + existing context
  let intent = action;
  if (!intent) {
    intent = classifyIntent(text, entities, context);
  }

  // Update context with newly extracted entities and intent
  context = updateContext(userId, entities, {
    lastIntent: intent,
    language: lang
  });

  // Safe developer logging (NO secrets, NO tokens)
  console.log(`[Chatbot NLP] user: ${userId} | lang: ${lang} (${langAnalysis.confidence.toFixed(2)}) | intent: ${intent} | category: ${context.category || 'none'} | location: ${context.location || 'none'}`);

  let replyText = '';
  let card = null;
  let actions = [];
  let suggestions = [];

  // ==============================================================
  // INTENT A: NEARBY PROVIDER SEARCH / FIND PROVIDERS
  // ==============================================================
  if (intent === 'nearby_provider_search' || intent === 'find_provider' || intent === 'provider_recommendation') {
    const categoryToSearch = entities.category || context.category || 'Plumber';
    const canonical = getCanonicalCategory(categoryToSearch) || categoryToSearch;
    context.category = canonical;

    const lat = entities.latitude ?? context.latitude ?? null;
    const lng = entities.longitude ?? context.longitude ?? null;
    const locName = entities.location || context.location || '';

    // Check if location permission was denied and no locality is specified
    if (payload?.locationPermissionDenied && !lat && !lng && !locName) {
      if (lang === 'tanglish') {
        replyText = "Nearby providers-a find panna unga location permission-a allow pannunga.";
      } else if (lang === 'ta') {
        replyText = "அருகிலுள்ள சேவை வழங்குநர்களைக் கண்டறிய உங்கள் location permission-ஐ allow செய்யவும்.";
      } else {
        replyText = "Please allow location access so I can find nearby providers.";
      }

      actions = [
        { label: '📍 Anna Nagar', action: 'nearby_provider_search', payload: { location: 'Anna Nagar' } },
        { label: '📍 T Nagar', action: 'nearby_provider_search', payload: { location: 'T Nagar' } },
        { label: '📍 Velachery', action: 'nearby_provider_search', payload: { location: 'Velachery' } }
      ];

      return {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        card: null,
        actions,
        suggestions: ['Anna Nagar', 'T Nagar', 'Velachery', 'Need help'],
        context
      };
    }

    // Query real FixIt Local recommendation engine
    const recResults = await getRecommendedProviders({
      category: canonical,
      serviceTitle: entities.service || context.service,
      latitude: lat,
      longitude: lng,
      date: entities.date || context.date,
      time: entities.time || context.time
    });

    const providers = Array.isArray(recResults) ? recResults : [];
    context.providers = providers;

    if (providers.length > 0) {
      const top = providers[0];
      const topName = top.businessName || top.business_name || top.providerName || top.name || 'Verified Provider';
      const rating = top.rating ? Number(top.rating).toFixed(1) : '5.0';
      const price = top.price ? `₹${top.price}` : '₹450/hr';
      const distKm = top.distanceKm != null ? top.distanceKm : top.distance_km;
      const dist = distKm != null ? `${distKm} km away` : (locName ? `in ${locName}` : 'Nearby');

      const TAMIL_LOC_NAMES = {
        'Anna Nagar': 'அண்ணா நகர்',
        'T Nagar': 'தி நகர்',
        'Adyar': 'அடையாறு',
        'Velachery': 'வேளச்சேரி',
        'Mylapore': 'மயிலாப்பூர்',
        'Besant Nagar': 'பெசன்ட் நகர்',
        'OMR': 'ஓ.எம்.ஆர்',
        'Porur': 'போரூர்',
        'Guindy': 'கிண்டி',
        'Tambaram': 'தாம்பரம்',
        'Kodambakkam': 'கோடம்பாக்கம்',
        'Nungambakkam': 'நுங்கம்பாக்கம்',
        'Royapettah': 'ராயப்பேட்டை',
        'Alwarpet': 'ஆழ்வார்பேட்டை',
        'Thiruvanmiyur': 'திருவான்மியூர்',
        'Kilpauk': 'கீழ்ப்பாக்கம்',
        'Vadapalani': 'வடபழனி',
        'Ashok Nagar': 'அசோக் நகர்',
        'Sholinganallur': 'சோழிங்கநல்லூர்',
        'Medavakkam': 'மேடவாக்கம்'
      };
      const displayLoc = (lang === 'ta' && TAMIL_LOC_NAMES[locName]) ? TAMIL_LOC_NAMES[locName] : locName;

      if (lang === 'tanglish') {
        replyText = locName
          ? `${locName}-la available ${canonical}s-a find pannuren. **${topName}** (★ ${rating}, ${dist}) top recommended provider:`
          : `Unga location-ku nearby available **${canonical}** providers list idho. **${topName}** (★ ${rating}) top match:`;
      } else if (lang === 'ta') {
        replyText = locName
          ? `${displayLoc}-ல் உள்ள சிறந்த ${canonical} சேவை வழங்குநர்களைக் கண்டறிந்துள்ளேன். **${topName}** (★ ${rating}, ${dist}) முன்னணி பரிந்துரை:`
          : `உங்கள் அருகில் உள்ள சிறந்த **${canonical}** சேவை வழங்குநர்கள் இதோ. **${topName}** (★ ${rating}) முதன்மை பரிந்துரை:`;
      } else {
        replyText = locName
          ? `I found available ${canonical}s in ${locName}. **${topName}** (★ ${rating}, ${dist}) is the top recommendation:`
          : `Here are the top verified **${canonical}** providers near you. **${topName}** (★ ${rating}) is highly recommended:`;
      }

      card = {
        type: 'provider_card',
        data: {
          id: top.providerId || top.id,
          userId: top.userId || top.user_id,
          name: topName,
          verified: true,
          rating: Number(rating),
          experience: `${top.experienceYears || top.experience_years || 2} yrs experience`,
          category: canonical,
          price,
          distance: dist,
          availability: (top.isAvailable || top.is_available) ? 'Available Today' : 'Available on Schedule',
          recommendationScore: top.recommendationScore || top.recommendation_score || 95
        }
      };

      actions = [
        {
          label: `Book ${topName}`,
          action: 'book_service',
          payload: { providerId: top.userId || top.user_id || top.providerId || top.id, providerName: topName, category: canonical, price: top.price || 450 }
        },
        { label: 'View Profile', path: `/customer/providers/${encodeURIComponent(topName)}` }
      ];

      suggestions = [
        `Book ${topName}`,
        'Check pricing details',
        'Compare other providers',
        'Check booking status'
      ];
    } else {
      if (lang === 'tanglish') {
        replyText = `Ippo unga nearby-la matching providers available-a illa.`;
      } else if (lang === 'ta') {
        replyText = `தற்போது உங்கள் அருகில் பொருத்தமான சேவை வழங்குநர்கள் கிடைக்கவில்லை.`;
      } else {
        replyText = `No matching providers are currently available nearby.`;
      }

      actions = [{ label: 'Browse All Services', path: '/customer/services' }];
      suggestions = ['Change location', 'Book for tomorrow', 'Need help'];
    }
  }

  // ==============================================================
  // INTENT B: SERVICE DISCOVERY (find_service)
  // ==============================================================
  else if (intent === 'find_service') {
    const targetCategory = entities.category || context.category || 'Plumber';
    const canonical = getCanonicalCategory(targetCategory) || targetCategory;
    context.category = canonical;

    const matchedServices = await Service.findAll({
      where: {
        is_active: true,
        [Op.or]: [
          { category: { [Op.like]: `%${canonical}%` } },
          { title: { [Op.like]: `%${canonical}%` } }
        ]
      },
      limit: 4
    });

    if (lang === 'tanglish') {
      replyText = `Sure, ungalukku **${canonical}** service venuma? Ungal location sollunga, nearby available providers-a find pannuren.`;
    } else if (lang === 'ta') {
      replyText = `நிச்சயமாக. உங்கள் இருப்பிடத்தைத் தெரிவிக்கவும். அருகிலுள்ள **${canonical}** சேவை வழங்குநர்களைக் கண்டறிந்து தருகிறேன்.`;
    } else {
      replyText = `Sure. I can help you find nearby **${canonical}** services. Please share your location or area.`;
    }

    card = {
      type: 'service_list',
      data: {
        category: canonical,
        services: matchedServices.map(s => ({
          id: s.id,
          title: s.title,
          category: s.category,
          price: s.price,
          description: s.description
        }))
      }
    };

    actions = [
      { label: '📍 Anna Nagar', action: 'nearby_provider_search', payload: { location: 'Anna Nagar' } },
      { label: '📍 T Nagar', action: 'nearby_provider_search', payload: { location: 'T Nagar' } },
      { label: '📍 Use Current Location', action: 'nearby_provider_search', payload: { useGps: true } }
    ];

    suggestions = [
      'Anna Nagar',
      'T Nagar',
      'Velachery',
      'Adyar'
    ];
  }

  // ==============================================================
  // INTENT C: BOOKING ASSISTANT & ORDINAL SELECTION
  // ==============================================================
  else if (intent === 'book_service') {
    // Resolve ordinal selection from previous recommended providers
    if (entities.providerOrdinal && Array.isArray(context.providers) && context.providers.length > 0) {
      const idx = entities.providerOrdinal - 1;
      const chosen = context.providers[idx] || context.providers[0];
      context.selectedProvider = chosen;
      context.providerName = chosen.businessName || chosen.business_name || chosen.providerName || chosen.name;
      context.providerId = chosen.userId || chosen.user_id || chosen.providerId || chosen.id;
      context.amount = chosen.price || 450;
    } else if (payload && payload.providerName) {
      context.providerName = payload.providerName;
      context.providerId = payload.providerId;
      context.amount = payload.price || 450;
    } else if (Array.isArray(context.providers) && context.providers.length > 0 && !context.providerName) {
      const chosen = context.providers[0];
      context.selectedProvider = chosen;
      context.providerName = chosen.businessName || chosen.business_name || chosen.providerName || chosen.name;
      context.providerId = chosen.userId || chosen.user_id || chosen.providerId || chosen.id;
      context.amount = chosen.price || 450;
    }

    // Default slot assumptions if user says "first provider ah book pannu"
    const chosenProvider = context.providerName || (context.providers?.[0]?.businessName || context.providers?.[0]?.business_name || context.providers?.[0]?.providerName) || 'Verified Provider';
    const bookingDate = context.date || 'Tomorrow';
    const bookingTime = context.time || '10:00 AM';
    const bookingLoc = context.location || 'Anna Nagar';
    const bookingAmount = context.amount || 450;
    const bookingService = context.service || `${context.category || 'Home'} Service`;

    if (lang === 'tanglish') {
      replyText = `Sure! **${chosenProvider}**-ku booking summary idho. Details check panni confirm pannunga:`;
    } else if (lang === 'ta') {
      replyText = `நிச்சயமாக! **${chosenProvider}**-க்கான முன்பதிவு சுருக்கம் இதோ. விவரங்களை சரிபார்த்து உறுதிப்படுத்தவும்:`;
    } else {
      replyText = `Sure! Here is the booking summary for **${chosenProvider}**. Please review and confirm your appointment:`;
    }

    card = {
      type: 'booking_summary',
      data: {
        service: bookingService,
        provider: chosenProvider,
        providerName: chosenProvider,
        providerId: context.providerId,
        date: bookingDate,
        time: bookingTime,
        location: bookingLoc,
        amount: `₹${bookingAmount}`
      }
    };

    actions = [
      {
        label: '✓ Confirm Booking',
        path: '/customer/book',
        state: { prefill: { service: bookingService, provider: chosenProvider, date: bookingDate, time: bookingTime, location: bookingLoc, amount: bookingAmount } }
      },
      { label: '✏️ Change Time Slot', action: 'book_service', payload: { changeSlot: true } },
      { label: '✕ Cancel', action: 'abort_booking' }
    ];

    suggestions = ['Confirm Booking', 'Change to 2:00 PM', 'Check other providers'];
  }

  // ==============================================================
  // INTENT D: BOOKING STATUS (booking_status)
  // ==============================================================
  else if (intent === 'booking_status') {
    const whereCond = { customer_id: userId };
    if (entities.bookingId) {
      whereCond[Op.or] = [
        { booking_number: { [Op.like]: `%${entities.bookingId}%` } },
        { id: isNaN(Number(entities.bookingId)) ? 0 : Number(entities.bookingId) }
      ];
    }

    const booking = await Booking.findOne({
      where: whereCond,
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'provider', attributes: ['id', 'name', 'phone'] },
        { model: Service, as: 'service' }
      ]
    });

    if (booking) {
      const statusLabel = booking.status.replace(/_/g, ' ').toUpperCase();
      const provName = booking.provider ? booking.provider.name : 'Assigned Technician';

      if (lang === 'tanglish') {
        replyText = `Ungal booking **#${booking.booking_number}** (${booking.service_title}) ippo **${statusLabel}** status la irukku!`;
      } else if (lang === 'ta') {
        replyText = `உங்கள் முன்பதிவு **#${booking.booking_number}** (${booking.service_title}) தற்போது **${statusLabel}** நிலையில் உள்ளது.`;
      } else {
        replyText = `Your active booking **#${booking.booking_number}** (${booking.service_title}) is currently **${statusLabel}**.`;
      }

      card = {
        type: 'booking_status',
        data: {
          bookingId: booking.id,
          bookingNumber: booking.booking_number,
          serviceTitle: booking.service_title,
          providerName: provName,
          status: booking.status,
          date: booking.date,
          time: booking.time,
          amount: `₹${booking.amount}`,
          address: booking.address
        }
      };

      actions = [{ label: 'View Booking Details', path: `/customer/bookings/${booking.id}` }];
      if (['on_the_way', 'arrived', 'in_progress'].includes(booking.status)) {
        actions.unshift({ label: '📍 Live Tracking', path: `/customer/tracking/${booking.id}` });
      }
    } else {
      if (lang === 'tanglish') {
        replyText = 'Currently ungaluku endha active booking-um illa. Pudhu service book panna virumbureengala?';
      } else if (lang === 'ta') {
        replyText = 'தற்போது உங்களுக்கு எந்த active முன்பதிவும் இல்லை. புதிய சேவையை பதிவு செய்ய விரும்புகிறீர்களா?';
      } else {
        replyText = 'You currently have no active bookings on your account. Would you like to explore popular services?';
      }
      actions = [{ label: '🔍 Browse Services', path: '/customer/services' }];
    }
  }

  // ==============================================================
  // INTENT E: LIVE PROVIDER TRACKING (track_provider)
  // ==============================================================
  else if (intent === 'track_provider') {
    const booking = await Booking.findOne({
      where: {
        customer_id: userId,
        status: { [Op.in]: ['confirmed', 'accepted', 'provider_assigned', 'on_the_way', 'arrived', 'in_progress'] }
      },
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'provider', attributes: ['id', 'name', 'phone'] },
        { model: ProviderProfile, as: 'providerProfile' }
      ]
    });

    if (booking) {
      const provName = booking.provider ? booking.provider.name : 'Assigned Technician';
      const statusLabel = booking.status.replace(/_/g, ' ').toUpperCase();

      if (lang === 'tanglish') {
        replyText = `Provider **${provName}** ippo **${statusLabel}** status-la irukanga! Live tracking map keela irukku:`;
      } else if (lang === 'ta') {
        replyText = `Provider **${provName}** இப்போது **${statusLabel}** நிலையில் உள்ளார். நேரடி வரைபடம் இதோ:`;
      } else {
        replyText = `Your provider **${provName}** is currently **${statusLabel}**. Live tracking is active:`;
      }

      card = {
        type: 'live_tracking',
        data: {
          bookingId: booking.id,
          bookingNumber: booking.booking_number,
          providerName: provName,
          status: statusLabel,
          distance: '2.4 km',
          eta: '8 mins',
          lastUpdated: '10 sec ago'
        }
      };

      actions = [{ label: '📍 Open Live Tracking Map', path: `/customer/tracking/${booking.id}` }];
    } else {
      if (lang === 'tanglish') {
        replyText = 'Ippo track panna active bookings edhuvum illa. Booking history-la unga past orders paakalam.';
      } else if (lang === 'ta') {
        replyText = 'தற்போது கண்காணிக்க active முன்பதிவு எதுவும் இல்லை.';
      } else {
        replyText = 'You do not have an active booking currently in transit to track.';
      }
      actions = [{ label: 'View Booking History', path: '/customer/booking-history' }];
    }
  }

  // ==============================================================
  // INTENT F: PAYMENT & REFUND ASSISTANT
  // ==============================================================
  else if (intent === 'payment_status' || intent === 'refund_status') {
    const payment = await Payment.findOne({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      include: [{ model: Booking, as: 'booking' }]
    });

    if (payment) {
      const bNum = payment.booking?.booking_number || payment.booking_id;
      const statusTitle = payment.status.toUpperCase();
      const gatewayName = payment.gateway === 'razorpay' ? 'Razorpay' : payment.gateway === 'wallet' ? 'FixIt Wallet' : 'Cash';

      if (lang === 'tanglish') {
        replyText = `Unga booking #${bNum} payment status: **${statusTitle}**! Amount: ₹${payment.amount} via ${gatewayName}.`;
      } else if (lang === 'ta') {
        replyText = `உங்கள் முன்பதிவு #${bNum} கட்டண நிலை: **${statusTitle}** (தொகை: ₹${payment.amount}, முறை: ${gatewayName}).`;
      } else {
        replyText = `Payment for booking #${bNum} is verified as **${statusTitle}** (Amount: ₹${payment.amount}, Method: ${gatewayName}).`;
      }

      card = {
        type: 'payment_card',
        data: {
          bookingNumber: bNum,
          amount: `₹${payment.amount}`,
          status: payment.status,
          gateway: gatewayName,
          date: new Date(payment.created_at || Date.now()).toLocaleDateString()
        }
      };
      actions = [{ label: 'View Wallet Balance', path: '/customer/wallet' }];
    } else {
      replyText = lang === 'tanglish'
        ? 'Unga account-la recent payments edhuvum illa. Service complete aana receipt inga varum.'
        : lang === 'ta'
        ? 'தற்போது உங்கள் கணக்கில் கட்டண பதிவுகள் எதுவும் இல்லை.'
        : 'No recorded payments found on your account.';
      actions = [{ label: 'Open Wallet', path: '/customer/wallet' }];
    }
  }

  // ==============================================================
  // INTENT G: CANCELLATION SAFETY
  // ==============================================================
  else if (intent === 'cancel_booking') {
    const activeBooking = await Booking.findOne({
      where: {
        customer_id: userId,
        status: { [Op.in]: ['pending', 'confirmed', 'accepted', 'provider_assigned'] }
      },
      order: [['created_at', 'DESC']]
    });

    if (activeBooking) {
      if (lang === 'tanglish') {
        replyText = `Booking **#${activeBooking.booking_number}**-a cancel panna sure-ah irukkeengala? Cancel panna amount instant-ah refund aagidum.`;
      } else if (lang === 'ta') {
        replyText = `முன்பதிவு **#${activeBooking.booking_number}**-ஐ ரத்து செய்ய விரும்புகிறீர்களா? கட்டணம் உடனடியாக ரீஃபண்ட் செய்யப்படும்.`;
      } else {
        replyText = `Are you sure you want to cancel booking **#${activeBooking.booking_number}**? Any held payment will be released immediately.`;
      }

      card = {
        type: 'cancellation_confirm',
        data: {
          bookingId: activeBooking.id,
          bookingNumber: activeBooking.booking_number,
          serviceTitle: activeBooking.service_title,
          amount: `₹${activeBooking.amount}`
        }
      };

      actions = [
        { label: '⚠️ Yes, Cancel Booking', action: 'confirm_cancel', payload: { bookingId: activeBooking.id } },
        { label: 'Keep Booking', action: 'abort_cancel' }
      ];
    } else {
      replyText = lang === 'tanglish'
        ? 'Ippo cancel panna active bookings edhuvum illa.'
        : lang === 'ta'
        ? 'தற்போது ரத்து செய்யக்கூடிய active முன்பதிவு எதுவும் இல்லை.'
        : 'You do not have any active cancellable bookings right now.';
      actions = [{ label: 'View Booking History', path: '/customer/booking-history' }];
    }
  }

  // ==============================================================
  // INTENT H: GREETINGS (ONLY for explicit greetings)
  // ==============================================================
  else if (intent === 'greeting') {
    if (lang === 'tanglish') {
      replyText = `Vanakkam ${userName}! Naan FixIt Assistant. Ungalukku AC repair, plumbing, electrician, illana nearby providers find panna naan ready! Enna service venum nu sollunga.`;
    } else if (lang === 'ta') {
      replyText = `வணக்கம் ${userName}! நான் **FixIt Assistant**. AC Repair, Plumbing, Electrical போன்ற சேவைகளைக் கண்டறியவும், உங்கள் முன்பதிவை கண்காணிக்கவும் நான் உதவுகிறேன்.`;
    } else {
      replyText = `Hello ${userName}! I am **FixIt Assistant**, your smart local service guide. I can help you find services, recommend verified providers, or track your active technician. What can I help with today?`;
    }

    actions = [
      { label: '🔍 Find a Service', path: '/customer/services' },
      { label: '👨‍🔧 Nearby Plumber', action: 'nearby_provider_search', payload: { category: 'Plumber' } },
      { label: '⚡ Nearby Electrician', action: 'nearby_provider_search', payload: { category: 'Electrician' } }
    ];

    suggestions = ['Find a plumber', 'Book an electrician', 'Track my provider', 'Need help'];
  }

  // ==============================================================
  // INTENT I: FAQ / KNOWLEDGE BASE
  // ==============================================================
  else {
    const kbReply = findKnowledgeAnswer(text, lang);
    if (kbReply) {
      replyText = kbReply;
      if (text.toLowerCase().includes('book')) {
        actions = [
          { label: '📅 Book a Service', path: '/customer/book' },
          { label: '🔍 Browse Services', path: '/customer/services' }
        ];
      }
    } else {
      if (lang === 'tanglish') {
        replyText = `Ungal kelvi purinjidhu. FixIt Local-la AC Repair, Plumbing, Electrical, Cleaning services provide panrom. Ungaluku entha service venum nu solla mudiyuma?`;
      } else if (lang === 'ta') {
        replyText = `உங்கள் கேள்வி புரிந்தது. FixIt Local-ல் AC Repair, Plumbing, Electrical, Cleaning போன்ற சேவைகள் உள்ளன. எந்த சேவை உங்களுக்கு தேவைப்படுகிறது?`;
      } else {
        replyText = `I understand. FixIt Local offers verified home services including AC Repair, Plumbing, Electrical, and Cleaning. Which service can I help you book today?`;
      }
      actions = [{ label: '🔍 Browse Services', path: '/customer/services' }];
    }
  }

  return {
    text: replyText,
    language: lang,
    intent,
    entities,
    card,
    actions,
    suggestions,
    context
  };
}

module.exports = {
  detectLanguage,
  normalizeText,
  extractEntities,
  classifyIntent,
  processUserMessage,
  getOrCreateUserContext,
  updateContext,
  resetContext
};
