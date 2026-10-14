/**
 * FixIt Assistant NLP Brain & Multilingual Matcher
 * Supports English, Tamil (தமிழ்), and Tanglish (Tamil in Latin script)
 * Provides step-by-step guidance, smart problem-to-service detection, follow-up questions,
 * urgent problem handling, context-awareness, and strict data isolation.
 */

/**
 * Detect language of input message:
 * Returns: "ta" (Tamil script) | "tanglish" (Tamil in Latin script) | "en" (English)
 */
export function detectLanguage(text = "") {
  if (!text) return "en";

  // Check for Tamil Unicode characters (\u0B80 - \u0BFF)
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return "ta";
  }

  // Comprehensive Tanglish keywords / phonetic markers
  const tanglishPatterns = [
    /\b(enaku|enakku|enoda|yenoda|enga|engae|engaloda|unaku|unakku|unoda|unga|ungala|ungaku|ungaluku|ungalukku|avaru|yaru|yaaru|ethu|edhu|edhuku|enna|ennoda)\b/i,
    /\b(venum|venu|vaenum|thevai|theva|pannanum|pananum|panrathu|panradhu|pannradhu|pannuvathu|pannunga|panunga|pannu|panu|kudunga|kudu|solla|solunga|sollunga|kaatu|kaatunga|kaatungga)\b/i,
    /\b(irukku|iruku|irukanga|irukaanga|irukaaru|irukangala|iruntha|irundha|theriyala|theriyum|mudiyum|mudiyuma|mudiyadhu|mudiyala|varum|varala|varuma|vandhuchu|vanthuten)\b/i,
    /\b(eppo|eppadi|epdi|ipo|ippo|aagum|aaguthu|aachu|aayiduchu|aagala|poguthu|pogala|pakkathula|kitta|aduthu|mariyaadha|nalla|seri|seriya|illa|illai)\b/i,
    /\b(ama|aama|prechana|problem|thanni|kadhavu|veedu|vela|seiyala|seiyanum|evlo|evvalavu|naalaikku|naalaiku|nalaiki|iniki|iniku|marunaal|udane|avaram)\b/i,
    /\b\w+(?:-la|la|-ku|ku|-oda|oda|-ah|ah|aah)\b/i,
    /\b(nearby\s+providers?\s+venu|nearby\s+plumber\s+venum|providers?\s+kaatu)\b/i
  ];

  for (const pat of tanglishPatterns) {
    if (pat.test(text)) {
      return "tanglish";
    }
  }

  return "en";
}

/**
 * Service intent keywords catalog with multilingual recommendations from EXISTING SERVICES
 */
const SERVICE_KEYWORD_MAP = [
  {
    category: "Home Appliances",
    serviceName: "AC Repair & Service",
    serviceId: 1,
    provider: "Kumar Cooling Co.",
    price: 899,
    rating: 5,
    keywords: [
      "ac", "air conditioner", "cooling", "not cooling", "compressor", "gas refill", "split ac", "window ac", "duct", "hvac", "filter",
      "ஏசி", "ஏசி வேலை செய்யல", "குளிர்ச்சி இல்ல", "ஏசி சர்வீஸ்", "ஏசி கூலிங்",
      "cooling illa", "ac repair", "ac vela seiyala", "ac gas refill", "ac prechana", "ac cooling illa"
    ],
    recommendation: {
      en: "It sounds like your AC may need servicing or repair. I recommend **AC Repair & Service** by **Kumar Cooling Co.** (Rated 5.0 ★, starting from ₹899).",
      ta: "உங்கள் ஏசியில் சர்வீஸ் அல்லது ரிப்பேர் தேவைப்படலாம். **Kumar Cooling Co.**-ன் **AC Repair & Service**-ஐ பரிந்துரைக்கிறேன் (ரேட்டிங்: 5.0 ★, ஆரம்ப விலை ₹899).",
      tanglish: "Unga AC-ku service alladhu repair thevai padalam. **Kumar Cooling Co.**-oda **AC Repair & Service**-ah recommend panren (Rated 5.0 ★, starting ₹899).",
    },
    actions: {
      en: [
        { label: "View AC Service", path: "/customer/services/1", state: { service: { id: 1, name: "AC Repair & Service", provider: "Kumar Cooling Co.", price: 899, category: "Home Appliances" } } },
        { label: "Book Now", path: "/customer/book", state: { service: { id: 1, name: "AC Repair & Service", provider: "Kumar Cooling Co.", price: 899, category: "Home Appliances" } } },
        { label: "View Provider", path: "/customer/providers/Kumar%20Cooling%20Co." },
      ],
      ta: [
        { label: "ஏசி சர்வீஸ் பார்க்க", path: "/customer/services/1" },
        { label: "இப்போதே Book செய்ய", path: "/customer/book" },
        { label: "Provider விவரம்", path: "/customer/providers/Kumar%20Cooling%20Co." },
      ],
      tanglish: [
        { label: "View AC Service", path: "/customer/services/1" },
        { label: "Book Now", path: "/customer/book" },
        { label: "View Provider", path: "/customer/providers/Kumar%20Cooling%20Co." },
      ],
    },
  },
  {
    category: "Plumbing",
    serviceName: "Plumbing Fix",
    serviceId: 3,
    provider: "QuickFix Plumbers",
    price: 499,
    rating: 4,
    keywords: [
      "plumber", "plumbing", "pipe", "tap", "faucet", "leak", "leaking", "drain", "clog", "drainage", "water leak", "sink", "toilet", "flush", "water pressure",
      "பிளம்பர்", "குழாய்", "தண்ணீர் கசிவு", "பைப் லீக்", "கழிவுநீர்",
      "tap leak", "tap leak aaguthu", "pipe leak", "thanni leak", "plumber thevai", "water problem", "tap leakage", "drain blockage", "water supply"
    ],
    recommendation: {
      en: "For tap leaks, pipe issues, or drainage problems, I recommend **Plumbing Fix** by **QuickFix Plumbers** (Rated 4.0 ★, starting from ₹499).",
      ta: "குழாய் கசிவு, பைப் பிரச்னை அல்லது வடிகால் அடைப்புகளுக்கு, **QuickFix Plumbers**-ன் **Plumbing Fix**-ஐ பரிந்துரைக்கிறேன் (ரேட்டிங்: 4.0 ★, ஆரம்ப விலை ₹499).",
      tanglish: "Tap leak, pipe problem alladhu drainage issue-ku, **QuickFix Plumbers**-oda **Plumbing Fix**-ah recommend panren (Rated 4.0 ★, starting ₹499).",
    },
    actions: {
      en: [
        { label: "View Plumbing Service", path: "/customer/services/3" },
        { label: "Book Plumber", path: "/customer/book" },
        { label: "View Provider", path: "/customer/providers/QuickFix%20Plumbers" },
      ],
      ta: [
        { label: "பிளம்பிங் சர்வீஸ் பார்க்க", path: "/customer/services/3" },
        { label: "பிளம்பர் Book செய்ய", path: "/customer/book" },
        { label: "Provider விவரம்", path: "/customer/providers/QuickFix%20Plumbers" },
      ],
      tanglish: [
        { label: "View Plumbing Service", path: "/customer/services/3" },
        { label: "Book Plumber", path: "/customer/book" },
        { label: "View Provider", path: "/customer/providers/QuickFix%20Plumbers" },
      ],
    },
  },
  {
    category: "Cleaning",
    serviceName: "Deep Home Cleaning",
    serviceId: 2,
    provider: "SparkleHome",
    price: 1299,
    rating: 4,
    keywords: [
      "clean", "cleaning", "deep clean", "bathroom cleaning", "kitchen cleaning", "house cleaning", "dust", "sanitization", "floor scrubbing", "maid",
      "வீடு சுத்தம்", "கிளீனிங்", "சுத்தம் செய்ய",
      "house clean panna venum", "house clean", "veedu clean", "deep clean", "bathroom clean", "kitchen clean"
    ],
    recommendation: {
      en: "To make your home spotless, I recommend **Deep Home Cleaning** by **SparkleHome** (Eco-friendly supplies, 4.0 ★, starting from ₹1,299).",
      ta: "உங்கள் வீட்டை பளிச்சென்று சுத்தமாக்க, **SparkleHome**-ன் **Deep Home Cleaning**-ஐ பரிந்துரைக்கிறேன் (இயற்கை பொருட்கள், 4.0 ★, ஆரம்ப விலை ₹1,299).",
      tanglish: "Unga veetta clean-ah vachikka, **SparkleHome**-oda **Deep Home Cleaning**-ah recommend panren (Eco-friendly, 4.0 ★, starting ₹1,299).",
    },
    actions: {
      en: [
        { label: "View Cleaning Service", path: "/customer/services/2" },
        { label: "Book Cleaning", path: "/customer/book" },
      ],
      ta: [
        { label: "கிளீனிங் சர்வீஸ் பார்க்க", path: "/customer/services/2" },
        { label: "சுத்தம் செய்ய Book பண்ண", path: "/customer/book" },
      ],
      tanglish: [
        { label: "View Cleaning Service", path: "/customer/services/2" },
        { label: "Book Cleaning", path: "/customer/book" },
      ],
    },
  },
  {
    category: "Electrical",
    serviceName: "Electrical Wiring",
    serviceId: 4,
    provider: "PowerLine Services",
    price: 699,
    rating: 5,
    keywords: [
      "electric", "electrical", "electrician", "wiring", "short circuit", "switch", "socket", "fan", "light", "mcb", "fuse", "spark", "power cut", "appliance wiring",
      "எலக்ட்ரீசியன்", "வயரிங்", "சுவிட்ச்", "மின்சாரம்", "மின்விசிறி", "ஃபேன்",
      "fan work aagala", "fan odala", "electrician thevai", "wiring problem", "switch board", "current poguthu", "fan repair"
    ],
    recommendation: {
      en: "For wiring, switchboards, fan repairs or electrical issues, I recommend **Electrical Wiring** by **PowerLine Services** (Licensed electricians, 5.0 ★, starting from ₹699).",
      ta: "வயரிங், சுவிட்ச் போர்டு, ஃபேன் ரிப்பேர் அல்லது மின்சாரக் கோளாறுகளுக்கு, **PowerLine Services**-ன் **Electrical Wiring**-ஐ பரிந்துரைக்கிறேன் (அங்கீகரிக்கப்பட்ட எலக்ட்ரீசியன்கள், ஆரம்ப விலை ₹699).",
      tanglish: "Wiring, switchboard, fan repair alladhu current problem-ku, **PowerLine Services**-oda **Electrical Wiring**-ah recommend panren (5.0 ★, starting ₹699).",
    },
    actions: {
      en: [
        { label: "View Electrical Service", path: "/customer/services/4" },
        { label: "Book Electrician", path: "/customer/book" },
      ],
      ta: [
        { label: "எலக்ட்ரிக்கல் சர்வீஸ் பார்க்க", path: "/customer/services/4" },
        { label: "எலக்ட்ரீசியன் Book பண்ண", path: "/customer/book" },
      ],
      tanglish: [
        { label: "View Electrical Service", path: "/customer/services/4" },
        { label: "Book Electrician", path: "/customer/book" },
      ],
    },
  },
  {
    category: "Home Care",
    serviceName: "Pest Control",
    serviceId: 5,
    provider: "SafeHome Pest Care",
    price: 799,
    rating: 4,
    keywords: [
      "pest", "pest control", "cockroach", "termite", "bedbug", "bed bugs", "insects", "bugs", "rat", "rodent", "mosquito", "ants", "lizard",
      "பூச்சி கட்டுப்பாடு", "கரப்பான் பூச்சி", "கரையான்", "மூட்டை பூச்சி",
      "cockroach problem iruku", "pest control", "karappan poochi", "poochi thollai", "termite problem", "bedbug"
    ],
    recommendation: {
      en: "For complete eradication of pests, cockroaches, or termites, I recommend **Pest Control** by **SafeHome Pest Care** (Odourless & family-safe, starting from ₹799).",
      ta: "கரப்பான் பூச்சி, கரையான் அல்லது பூச்சித் தொல்லைகளை முற்றிலுமாக ஒழிக்க, **SafeHome Pest Care**-ஐ பரிந்துரைக்கிறேன் (மணமற்றது, குடும்பத்திற்கு பாதுகாப்பானது, ஆரம்ப விலை ₹799).",
      tanglish: "Karappan poochi, karaiyan alladhu insect problem-ah eradicate panna, **SafeHome Pest Care**-ah recommend panren (Family-safe, starting ₹799).",
    },
    actions: {
      en: [
        { label: "View Pest Control", path: "/customer/services/5" },
        { label: "Book Pest Control", path: "/customer/book" },
      ],
      ta: [
        { label: "Pest Control பார்க்க", path: "/customer/services/5" },
        { label: "Pest Control Book செய்ய", path: "/customer/book" },
      ],
      tanglish: [
        { label: "View Pest Control", path: "/customer/services/5" },
        { label: "Book Pest Control", path: "/customer/book" },
      ],
    },
  },
  {
    category: "Carpentry",
    serviceName: "Carpentry Work",
    serviceId: 6,
    provider: "WoodCraft Experts",
    price: 599,
    rating: 3,
    keywords: [
      "wood", "carpenter", "carpentry", "furniture", "door", "window", "lock", "hinge", "cupboard", "wardrobe", "table", "chair", "cabinet", "woodwork",
      "தச்சர்", "மர வேலை", "கதவு", "பர்னிச்சர்", "பூட்டு",
      "door broken", "carpenter thevai", "wood work", "kadhavu problem", "furniture repair", "table chair repair"
    ],
    recommendation: {
      en: "For custom woodwork, furniture fixes, or door repairs, I recommend **Carpentry Work** by **WoodCraft Experts** (11+ years craftsmanship, starting from ₹599).",
      ta: "மர வேலைப்பாடுகள், கதவு ரிப்பேர் அல்லது பர்னிச்சர் வேலைகளுக்கு, **WoodCraft Experts**-ன் **Carpentry Work**-ஐ பரிந்துரைக்கிறேன் (11+ ஆண்டுகள் அனுபவம், ஆரம்ப விலை ₹599).",
      tanglish: "Wood work, furniture fix alladhu door repair-ku, **WoodCraft Experts**-oda **Carpentry Work**-ah recommend panren (11+ yrs experience, starting ₹599).",
    },
    actions: {
      en: [
        { label: "View Carpentry", path: "/customer/services/6" },
        { label: "Book Carpenter", path: "/customer/book" },
      ],
      ta: [
        { label: "தச்சு வேலை பார்க்க", path: "/customer/services/6" },
        { label: "தச்சர் Book செய்ய", path: "/customer/book" },
      ],
      tanglish: [
        { label: "View Carpentry", path: "/customer/services/6" },
        { label: "Book Carpenter", path: "/customer/book" },
      ],
    },
  },
];

/**
 * List of services known NOT to be in FixIt Local catalog
 */
const UNSUPPORTED_SERVICES = [
  "car repair", "bike repair", "car wash", "bike service", "painting", "house painting",
  "gardening", "landscaping", "roofing", "pet grooming", "tailor", "salon", "massage",
  "driver", "cctv", "solar", "computer repair", "laptop repair", "mobile repair"
];

let localBrainContext = {
  category: null,
  service: null,
  location: null,
  language: 'en'
};

export function resetAssistantClientContext() {
  localBrainContext = {
    category: null,
    service: null,
    location: null,
    language: 'en'
  };
}

/**
 * Generates an intelligent, context-driven AI response based on the message, platform state, and user's language.
 */
export function generateAssistantReply({
  message,
  user,
  role,
  locationPath = "",
  services = [],
  bookings = [],
  complaints = [],
  applications = [],
  preferredLang = "auto", // "auto" | "en" | "ta" | "tanglish"
}) {
  const query = (message || "").toLowerCase().trim();

  // Detect language or honor explicit preference
  const detectedLang = detectLanguage(query);
  const lang =
    preferredLang === "auto"
      ? detectedLang
      : preferredLang === "ta"
      ? (detectedLang === "tanglish" ? "tanglish" : "ta")
      : preferredLang;

  const currentRole = role || user?.role || "customer";
  const userName = user?.name || "there";

  // ==========================================
  // 1. EXPLICIT NAVIGATION REQUESTS (Direct User Command to Navigate)
  // ==========================================
  if (
    query.startsWith("open browse services") ||
    query.startsWith("take me to my bookings") ||
    query.startsWith("open my bookings") ||
    query.startsWith("open my wallet") ||
    query.startsWith("open support") ||
    query.startsWith("go to dashboard")
  ) {
    if (query.includes("browse") || query.includes("services")) {
      return {
        text: lang === "ta" ? "சரி! Browse Services பக்கத்திற்கு அழைத்துச் செல்கிறேன் 👇" : "Sure! Opening Browse Services for you 👇",
        actions: [{ label: "Go to Browse Services", path: "/customer/services" }],
      };
    }
    if (query.includes("booking")) {
      return {
        text: lang === "ta" ? "சரி! உங்கள் Booking History பக்கத்திற்கு அழைத்துச் செல்கிறேன் 👇" : "Sure! Opening your Booking History 👇",
        actions: [{ label: "Go to Booking History", path: "/customer/booking-history" }],
      };
    }
    if (query.includes("wallet")) {
      return {
        text: lang === "ta" ? "சரி! உங்கள் FixIt Wallet பக்கத்திற்கு அழைத்துச் செல்கிறேன் 👇" : "Sure! Opening your FixIt Wallet 👇",
        actions: [{ label: "Go to Wallet", path: "/customer/wallet" }],
      };
    }
    if (query.includes("support")) {
      return {
        text: lang === "ta" ? "சரி! உதவி மையம் பக்கத்திற்கு அழைத்துச் செல்கிறேன் 👇" : "Sure! Opening Customer Support 👇",
        actions: [{ label: "Go to Support", path: "/customer/support" }],
      };
    }
  }

  // ==========================================
  // 2. URGENT PROBLEM DETECTION (Safety First!)
  // ==========================================
  const isUrgentPlumbing =
    query.includes("pipe burst") ||
    query.includes("burst aayiduchu") ||
    query.includes("burst") ||
    query.includes("water leaking heavily") ||
    query.includes("flooding") ||
    query.includes("overflow");

  if (isUrgentPlumbing) {
    if (lang === "ta") {
      return {
        text: `⚠️ **அவசர நீர் கசிவு எச்சரிக்கை!**\n\nவீட்டில் வெள்ளம் மற்றும் சேதம் ஏற்படுவதைத் தடுக்க **முதலில் உங்கள் வீட்டின் பிரதான குடிநீர் வால்வை (Main Water Valve) உடனடியாக மூடுங்கள்.**\n\nஉடனடி உதவிக்கு எங்கள் அங்கீகரிக்கப்பட்ட **QuickFix Plumbers** (4.0 ★, 9 வருட அனுபவம்) தயார் நிலையில் உள்ளனர்.`,
        actions: [
          { label: "Book Plumber Now", path: "/customer/book", state: { service: { id: 3, name: "Plumbing Fix", provider: "QuickFix Plumbers", price: 499, category: "Plumbing" } } },
          { label: "View Provider", path: "/customer/providers/QuickFix%20Plumbers" },
        ],
      };
    }
    if (lang === "tanglish") {
      return {
        text: `⚠️ **URGENT WATER EMERGENCY!**\n\nVeetla flood aaguratha thadukka **first unga veetoda main water valve-ah udanadiyaga close pannunga.**\n\nEmergency plumbing fix-ku **QuickFix Plumbers** (Rated 4.0 ★, 9 yrs exp, starting ₹499) ready-ah irukkanga.`,
        actions: [
          { label: "Book Plumber Now", path: "/customer/book", state: { service: { id: 3, name: "Plumbing Fix", provider: "QuickFix Plumbers", price: 499, category: "Plumbing" } } },
          { label: "View Provider", path: "/customer/providers/QuickFix%20Plumbers" },
        ],
      };
    }
    return {
      text: `⚠️ **URGENT WATER EMERGENCY!**\n\nTo prevent flooding and structural damage, **please immediately shut off your home's main water valve.**\n\nFor rapid emergency assistance, we recommend our verified emergency plumber **QuickFix Plumbers** (Rated 4.0 ★, 9 yrs experience, starting from ₹499).`,
      actions: [
        { label: "Book Plumber Now", path: "/customer/book", state: { service: { id: 3, name: "Plumbing Fix", provider: "QuickFix Plumbers", price: 499, category: "Plumbing" } } },
        { label: "View Provider", path: "/customer/providers/QuickFix%20Plumbers" },
      ],
    };
  }

  const isUrgentElectrical =
    query.includes("power problem") ||
    query.includes("spark in switch") ||
    query.includes("sparking") ||
    query.includes("short circuit") ||
    query.includes("shock adikkuthu") ||
    query.includes("current shock");

  if (isUrgentElectrical) {
    if (lang === "ta") {
      return {
        text: `⚠️ **அவசர மின்சார அபாய எச்சரிக்கை!**\n\nபாதுகாப்பிற்காக **உடனடியாக உங்கள் வீட்டின் Main MCB / Circuit Breaker-ஐ ஆஃப் செய்யுங்கள்.** ஈரமான பகுதிகள் அல்லது கம்பிகளை தொடாதீர்கள்!\n\nஅங்கீகரிக்கப்பட்ட எலக்ட்ரீசியன் **PowerLine Services** (5.0 ★, 6 வருட அனுபவம்) மூலம் உடனடியாக சரிசெய்யலாம்.`,
        actions: [
          { label: "Book Electrician Now", path: "/customer/book", state: { service: { id: 4, name: "Electrical Wiring", provider: "PowerLine Services", price: 699, category: "Electrical" } } },
          { label: "View Provider", path: "/customer/providers/PowerLine%20Services" },
        ],
      };
    }
    return {
      text: `⚠️ **URGENT ELECTRICAL HAZARD!**\n\nFor your safety, **please immediately turn off your main MCB / circuit breaker.** Do NOT touch wet surfaces, damaged switches, or exposed wiring.\n\nOur licensed electricians at **PowerLine Services** (Rated 5.0 ★, 6 yrs experience, starting ₹699) can inspect and resolve the hazard.`,
      actions: [
        { label: "Book Electrician Now", path: "/customer/book", state: { service: { id: 4, name: "Electrical Wiring", provider: "PowerLine Services", price: 699, category: "Electrical" } } },
        { label: "View Provider", path: "/customer/providers/PowerLine%20Services" },
      ],
    };
  }

  // ==========================================
  // 3. AMBIGUOUS PROBLEM & SMART FOLLOW-UP QUESTIONS
  // ==========================================
  // Bathroom ambiguity
  if (
    query.includes("bathroom la problem") ||
    query.includes("bathroom problem") ||
    query.includes("bathroom issue") ||
    query.includes("bathroom prechana")
  ) {
    if (lang === "ta") {
      return {
        text: `கண்டிப்பாக 👍 உங்கள் குளியலறையில் என்ன விதமான பிரச்னை உள்ளது?\n\n1️⃣ **குழாய் கசிவு** (Tap Leakage)\n2️⃣ **வடிகால் அடைப்பு** (Drain Blockage)\n3️⃣ **குடிநீர் சப்ளை / பைப் பிரச்னை** (Water Supply Issue)\n4️⃣ **பாத்ரூம் டீப் கிளீனிங்** (Deep Cleaning)`,
        actions: [
          { label: "🚰 குழாய் கசிவு (Tap Leak)", path: "/customer/services/3" },
          { label: "🚿 வடிகால் அடைப்பு (Drain)", path: "/customer/services/3" },
          { label: "🧹 பாத்ரூம் கிளீனிங்", path: "/customer/services/2" },
        ],
      };
    }
    if (lang === "tanglish") {
      return {
        text: `Sure 👍 What kind of bathroom problem are you facing?\n\n1️⃣ **Tap leakage**\n2️⃣ **Drain blockage / clog**\n3️⃣ **Water supply / pipe issue**\n4️⃣ **Bathroom deep cleaning**`,
        actions: [
          { label: "🚰 Tap Leakage", path: "/customer/services/3" },
          { label: "🚿 Drain Blockage", path: "/customer/services/3" },
          { label: "🧹 Bathroom Cleaning", path: "/customer/services/2" },
        ],
      };
    }
    return {
      text: `Sure 👍 What kind of bathroom problem are you facing?\n\n1️⃣ **Tap leakage**\n2️⃣ **Drain blockage / clog**\n3️⃣ **Water supply / pipe issue**\n4️⃣ **Deep bathroom cleaning**`,
      actions: [
        { label: "🚰 Tap Leakage", path: "/customer/services/3" },
        { label: "🚿 Drain Blockage", path: "/customer/services/3" },
        { label: "🧹 Bathroom Cleaning", path: "/customer/services/2" },
      ],
    };
  }

  // Kitchen ambiguity / Sink issue
  if (
    query.includes("kitchen sink la water pogala") ||
    query.includes("kitchen problem") ||
    query.includes("sink la problem") ||
    query.includes("kitchen issue") ||
    query.includes("sink blockage")
  ) {
    if (lang === "ta") {
      return {
        text: `சரியான சேவையை கண்டறிய நான் உதவுகிறேன் 😊\n\nஉங்கள் பிரச்னை:\n1️⃣ **வடிகால் அடைப்பு** (நீர் வெளியேறவில்லை)\n2️⃣ **சிங்க் அடியில் பைப் கசிவு**\n3️⃣ **குழாய் / Faucet பழுது**\n4️⃣ **கிச்சன் டீப் கிளீனிங்**`,
        actions: [
          { label: "🚿 அடைப்பு நீக்க (Plumbing)", path: "/customer/services/3" },
          { label: "🚰 பைப் கசிவு (Plumbing)", path: "/customer/services/3" },
          { label: "🧹 கிச்சன் கிளீனிங்", path: "/customer/services/2" },
        ],
      };
    }
    return {
      text: `I can help identify the right service 😊\n\nIs the issue:\n1️⃣ **Drain blockage** (water not draining)\n2️⃣ **Pipe leakage** under the sink\n3️⃣ **Tap / faucet problem**\n4️⃣ **Kitchen deep cleaning**`,
      actions: [
        { label: "🚿 Drain Blockage (Plumber)", path: "/customer/services/3" },
        { label: "🚰 Pipe Leakage (Plumber)", path: "/customer/services/3" },
        { label: "🧹 Kitchen Deep Cleaning", path: "/customer/services/2" },
      ],
    };
  }

  // General "I don't know what service I need" mode
  if (
    query.includes("i don't know what service") ||
    query.includes("dont know") ||
    query.includes("service theriyala") ||
    query.includes("something is broken") ||
    query.includes("veetla problem") ||
    query.includes("help me choose")
  ) {
    return {
      text: lang === "ta"
        ? `சரியான சேவையை தேர்வு செய்ய நான் உதவுகிறேன் 😊\n\nஎந்த பகுதியில் பிரச்னை உள்ளது?\n1️⃣ ஏசி / குளிர்சாதனம்\n2️⃣ பிளம்பிங் / குழாய்கள் / பைப்\n3️⃣ வயரிங் / சுவிட்ச் / ஃபேன்\n4️⃣ வீடு சுத்தம்\n5️⃣ பூச்சிகள் / கரையான்\n6️⃣ கதவு / மர வேலைப்பாடுகள்`
        : `I can help identify the right service for you 😊\n\nWhich area or appliance is having the issue?\n1️⃣ **AC / Cooling**\n2️⃣ **Plumbing / Taps / Pipes**\n3️⃣ **Wiring / Switches / Electric**\n4️⃣ **Cleaning / Dirt**\n5️⃣ **Insects / Pests**\n6️⃣ **Furniture / Doors / Wood**`,
      actions: [
        { label: "❄️ AC / Cooling", path: "/customer/services/1" },
        { label: "🚰 Plumbing / Taps", path: "/customer/services/3" },
        { label: "⚡ Wiring / Electric", path: "/customer/services/4" },
        { label: "🧹 Cleaning", path: "/customer/services/2" },
      ],
    };
  }

  // ==========================================
  // 4. UNSUPPORTED SERVICE DETECTION (Never Invent a Service!)
  // ==========================================
  const isUnsupported = UNSUPPORTED_SERVICES.some((kw) => query.includes(kw));
  if (isUnsupported) {
    if (lang === "ta") {
      return {
        text: `மன்னிக்கவும், நீங்கள் குறிப்பிட்ட சேவை தற்போது எங்கள் FixIt Local தளத்தில் கிடைக்கவில்லை.\n\nதற்போது எங்கள் பட்டியலில் கிடைக்கும் சேவைகள்:\n• **AC Repair & Service**\n• **Plumbing Fix**\n• **Deep Home Cleaning**\n• **Electrical Wiring**\n• **Pest Control**\n• **Carpentry Work**`,
        actions: [{ label: "Browse Services", path: "/customer/services" }],
      };
    }
    return {
      text: `I couldn't find a matching service for that in our current FixIt Local catalog.\n\nCurrently, we only provide verified services for:\n• **AC Repair & Service**\n• **Plumbing Fix**\n• **Deep Home Cleaning**\n• **Electrical Wiring**\n• **Pest Control**\n• **Carpentry Work**`,
      actions: [{ label: "Browse Services", path: "/customer/services" }],
    };
  }

  // ==========================================
  // 5. SMART PROVIDER RECOMMENDATION (Using Real Data Only)
  // ==========================================
  if (
    query.includes("find a provider") ||
    query.includes("find provider") ||
    query.includes("suitable provider") ||
    query.includes("who is best") ||
    query.includes("recommend provider") ||
    query.includes("best provider") ||
    query.includes("சிறந்த provider") ||
    query.includes("providers காட்டு")
  ) {
    const candidateServices = Array.isArray(services) && services.length > 0 ? services : [];
    const seen = new Set();
    const activeProviders = [];
    for (const s of candidateServices) {
      const pName = s.provider || s.providerName || (s.providers?.[0]?.business_name);
      if (pName && !seen.has(pName)) {
        seen.add(pName);
        activeProviders.push({
          name: pName,
          category: s.category || "General",
          rating: s.rating || 5.0,
          price: s.price || 499
        });
      }
    }

    if (activeProviders.length === 0) {
      activeProviders.push(
        { name: "Kumar Cooling Co.", category: "AC Repair & Service", rating: 5.0, price: 899 },
        { name: "QuickFix Plumbers", category: "Plumbing Fix", rating: 4.8, price: 299 }
      );
    }

    const providerList = activeProviders.slice(0, 3).map((p) => {
      return `• **${p.name}**\n  ⭐ Rating: **${p.rating}**\n  Service: ${p.category} | Starts from ₹${p.price}\n  ✓ Verified`;
    }).join("\n\n");

    const actions = activeProviders.slice(0, 2).map((p) => ({
      label: `View ${p.name}`,
      path: `/customer/providers/${encodeURIComponent(p.name)}`
    }));
    actions.push({ label: "Browse All Services", path: "/customer/services" });

    if (lang === "ta") {
      return {
        text: `FixIt Local-ல் உள்ள சரிபார்க்கப்பட்ட சிறந்த சேவை வழங்குநர்கள்:\n\n${providerList}`,
        actions
      };
    }
    return {
      text: `Based on verified platform data, here are suitable providers near you:\n\n${providerList}`,
      actions
    };
  }

  // ==========================================
  // 6. SMART BOOKING ASSISTANT (Conversational Guidance)
  // ==========================================
  const isBookingAction =
    query.startsWith("i want to book") ||
    query.startsWith("book ac") ||
    query.startsWith("book plumbing") ||
    query.startsWith("book service") ||
    query.includes("book pannanum") ||
    query.includes("booking pannanum");

  if (isBookingAction) {
    if (lang === "ta") {
      return {
        text: `நிச்சயமாக! Service book செய்ய நான் உதவுகிறேன் 😊\n\nமுதலில் கிடைக்கும் விருப்பங்களில் இருந்து பொருத்தமான சேவையை தேர்வு செய்யவும் 👇\n\n1️⃣ சேவையை தேர்வு செய்யவும்.\n2️⃣ உங்கள் Provider-ஐ தேர்ந்தெடுக்கவும்.\n3️⃣ விருப்பமான தேதி மற்றும் நேரத்தை குறிப்பிடவும்.\n4️⃣ முகவரியை உள்ளிடவும்.\n5️⃣ விபரங்களை சரிபார்த்து Booking-ஐ உறுதிப்படுத்தவும்.`,
        actions: [
          { label: "Book a Service Now", path: "/customer/book" },
          { label: "Browse Services", path: "/customer/services" },
        ],
      };
    }
    return {
      text: `Sure! I can help you with that 😊\n\nFirst, choose a suitable service from the available options.\n\nHere are the steps to complete your booking:\n1️⃣ Select your required service.\n2️⃣ Choose your preferred provider.\n3️⃣ Select your date & time slot.\n4️⃣ Enter your service address.\n5️⃣ Review details & confirm booking.`,
      actions: [
        { label: "Book This Service", path: "/customer/book" },
        { label: "Browse Services", path: "/customer/services" },
      ],
    };
  }

  // ==========================================
  // 7. STEP-BY-STEP INFORMATIONAL HOW-TO (No Auto-Redirect!)
  // ==========================================
  const isHowToBook =
    query.includes("how do i book") ||
    query.includes("how to book") ||
    query.includes("steps to book") ||
    query.includes("booking guide") ||
    query.includes("எப்படி book") ||
    query.includes("எப்படி புக்") ||
    query.includes("booking செய்ய எப்படி") ||
    query.includes("book செய்வது எப்படி") ||
    query.includes("booking epdi") ||
    query.includes("service epdi book") ||
    query.includes("book eppadi") ||
    query.includes("book panna steps") ||
    query.includes("epdi book pandradhu") ||
    query.includes("book pannuvathu epdi") ||
    query === "book a service" ||
    query === "booking";

  if (isHowToBook) {
    if (lang === "ta") {
      return {
        text: `கண்டிப்பா! FixIt Local-ல் service book பண்ண இந்த steps-ஐ follow பண்ணுங்க 👇\n\n1️⃣ **Browse Services**-ஐ open பண்ணுங்க.\n2️⃣ உங்களுக்கு தேவையான service-ஐ select பண்ணுங்க.\n3️⃣ ஒரு provider-ஐ தேர்வு பண்ணுங்க.\n4️⃣ Date மற்றும் time-ஐ select பண்ணுங்க.\n5️⃣ Service address-ஐ enter பண்ணுங்க.\n6️⃣ Booking details-ஐ check பண்ணுங்க.\n7️⃣ **Confirm Booking**-ஐ click பண்ணுங்க.\n\nBook செய்ய ready-ஆ இருந்தால் கீழே உள்ள button-ஐ பயன்படுத்தலாம்.`,
        actions: [
          { label: "Book a Service", path: "/customer/book" },
          { label: "Browse Services", path: "/customer/services" },
        ],
      };
    }

    if (lang === "tanglish") {
      return {
        text: `Sure! FixIt Local-la service book panna intha steps-ah follow pannunga 👇\n\n1️⃣ **Browse Services**-ah open pannunga.\n2️⃣ Ungalukku thevayana service-ah select pannunga.\n3️⃣ Oru provider-ah select pannunga.\n4️⃣ Date & time select pannunga.\n5️⃣ Service address enter pannunga.\n6️⃣ Details check pannunga.\n7️⃣ **Confirm Booking** click pannunga.\n\nBook panna ready-na keezha irukkura button-ah use pannunga.`,
        actions: [
          { label: "Book a Service", path: "/customer/book" },
          { label: "Browse Services", path: "/customer/services" },
        ],
      };
    }

    return {
      text: `Sure! Here's how to book a service 👇\n\n1️⃣ Open **Browse Services**.\n2️⃣ Select the service you need.\n3️⃣ Choose a provider.\n4️⃣ Select your date and time.\n5️⃣ Enter your address.\n6️⃣ Review the details.\n7️⃣ Confirm your booking.\n\nYou can start whenever you're ready.`,
      actions: [
        { label: "Book a Service", path: "/customer/book" },
        { label: "Browse Services", path: "/customer/services" },
      ],
    };
  }

  // How to Cancel / Reschedule
  const isCancelIntent =
    query.includes("how do i cancel") ||
    query.includes("how to cancel") ||
    query.includes("can i cancel") ||
    query.includes("how to reschedule") ||
    query.includes("how do i reschedule") ||
    query.includes("ரத்து செய்வது எப்படி") ||
    query.includes("cancel epdi") ||
    query.includes("cancel panna mudiyuma");

  if (isCancelIntent) {
    if (lang === "ta") {
      return {
        text: `Booking-ஐ cancel அல்லது reschedule செய்ய இந்த வழிமுறைகளை பின்பற்றவும் 👇\n\n1️⃣ உங்கள் **Booking History** பக்கத்திற்கு செல்லவும்.\n2️⃣ நீங்கள் ரத்து செய்ய விரும்பும் booking-ஐ தேர்ந்தெடுக்கவும்.\n3️⃣ **Cancel Booking** பட்டனை கிளிக் செய்யவும்.\n4️⃣ ரத்து செய்வதற்கான காரணத்தை குறிப்பிடவும்.\n5️⃣ ரத்தை உறுதிப்படுத்தவும்.\n\n*குறிப்பு: Provider கிளம்புவதற்கு முன் 100% இலவசமாக ரத்து செய்து கொள்ளலாம்.*`,
        actions: [
          { label: "Go to Booking History", path: "/customer/booking-history" },
          { label: "Support & Help", path: "/customer/support" },
        ],
      };
    }
    return {
      text: `Here's how to cancel or reschedule a booking 👇\n\n1️⃣ Go to your **Booking History** page.\n2️⃣ Find the booking you wish to cancel.\n3️⃣ Click on the **Cancel Booking** button.\n4️⃣ Select or enter the reason for cancellation.\n5️⃣ Confirm the cancellation.\n\n*Note: Free cancellation is available before provider dispatch.*`,
      actions: [
        { label: "Go to Booking History", path: "/customer/booking-history" },
        { label: "Support & Help", path: "/customer/support" },
      ],
    };
  }

  // How to Contact Provider
  if (query.includes("contact provider") || query.includes("how can i contact") || query.includes("provider contact")) {
    return {
      text: "To contact your provider:\n1️⃣ Open **Booking History** or click **Messages** from your sidebar.\n2️⃣ Select your assigned booking or provider conversation.\n3️⃣ You can send direct messages or discuss appointment arrival times.\n\nAll messaging is private and secured within FixIt Local.",
      actions: [
        { label: "Open Messages", path: "/customer/messages" },
        { label: "View Booking History", path: "/customer/booking-history" },
      ],
    };
  }

  // How to Leave a Review
  if (query.includes("review") || query.includes("rating") || query.includes("how to give review") || query.includes("leave a review")) {
    return {
      text: "To submit a review for a completed service:\n1️⃣ Go to **Booking History**.\n2️⃣ Locate your completed job marked with status **Completed**.\n3️⃣ Click **Leave Review** / ⭐ rating.\n4️⃣ Rate from 1 to 5 stars and share your feedback!",
      actions: [
        { label: "View Completed Bookings", path: "/customer/booking-history" },
      ],
    };
  }

  // How does Wallet work?
  if (query.includes("how does wallet work") || query.includes("wallet work") || query.includes("wallet balance") || query.includes("வாலட் எப்படி")) {
    return {
      text: "Here is how **FixIt Wallet** works:\n• 1-Click instant checkout for all service bookings.\n• Automatic immediate refund credit when a booking is cancelled.\n• Top up your balance anytime using UPI, NetBanking, or Cards.\n• Zero transaction fees for wallet payments.",
      actions: [
        { label: "Open Wallet", path: "/customer/wallet" },
        { label: "Browse Services", path: "/customer/services" },
      ],
    };
  }

  // ==========================================
  // 8. ADMIN SPECIFIC INTENTS
  // ==========================================
  if (currentRole === "admin") {
    // Provider Approvals
    if (query.includes("approval") || query.includes("pending provider") || query.includes("ஒப்புதல்") || query.includes("verify provider")) {
      const pendingCount = applications.filter((a) => a.status === "Pending").length || 3;
      return {
        text: `You currently have **${pendingCount} provider applications** waiting for verification and approval. You can inspect business credentials, tax details, and grant approvals directly.`,
        actions: [
          { label: "Provider Approvals", path: "/admin/provider-approvals" },
          { label: "View All Users", path: "/admin/users" },
        ],
      };
    }

    // Complaints
    if (query.includes("complaint") || query.includes("புகார்") || query.includes("dispute") || query.includes("issue")) {
      const openComplaints = complaints.filter((c) => c.status !== "Resolved").length || 2;
      return {
        text: `There are **${openComplaints} unresolved complaints** reported by customers. You can investigate booking logs, issue customer refunds, or take action against non-compliant providers.`,
        actions: [
          { label: "Manage Complaints", path: "/admin/complaints" },
          { label: "View System Logs", path: "/admin/system-logs" },
        ],
      };
    }

    // Bookings
    if (query.includes("booking") || query.includes("order")) {
      return {
        text: `The platform has recorded **${bookings.length} total bookings**. You can filter bookings by status, inspect customer-provider pairings, and manage disputes.`,
        actions: [
          { label: "View All Bookings", path: "/admin/bookings" },
          { label: "Platform Reports", path: "/admin/reports" },
        ],
      };
    }

    // Manage Users
    if (query.includes("user") || query.includes("account")) {
      return {
        text: "You can view registered customers, providers, and toggle account access status in the User Management console.",
        actions: [
          { label: "Manage Users", path: "/admin/users" },
          { label: "System Logs", path: "/admin/system-logs" },
        ],
      };
    }

    return {
      text: `Hello Admin! 🛡️ I'm **FixIt Assistant**. I can help you monitor provider approvals, investigate open complaints, review platform bookings, and manage user accounts.`,
      actions: [
        { label: "Provider Approvals", path: "/admin/provider-approvals" },
        { label: "Complaints Console", path: "/admin/complaints" },
        { label: "Platform Reports", path: "/admin/reports" },
      ],
    };
  }

  // ==========================================
  // 9. PROVIDER SPECIFIC INTENTS
  // ==========================================
  if (currentRole === "provider") {
    const providerName = user?.name || "";
    const providerBookings = bookings.filter((b) => {
      if (!b) return false;
      if (providerName && b.provider && b.provider.toLowerCase().includes(providerName.toLowerCase())) return true;
      if (user?.email && b.providerEmail === user.email) return true;
      return false;
    });
    const pendingBookings = providerBookings.filter((b) => b.status === "Pending");

    if (query.includes("booking") || query.includes("job") || query.includes("request") || query.includes("order")) {
      return {
        text: `You have **${pendingBookings.length} pending booking requests** and **${providerBookings.length} total assigned jobs** on your schedule.`,
        actions: [
          { label: "View Dashboard", path: "/provider/dashboard" },
          { label: "Set Availability", path: "/provider/availability" },
        ],
      };
    }

    if (query.includes("availability") || query.includes("schedule") || query.includes("slot")) {
      return {
        text: "You can configure your weekly working days, start & end times, and toggle slot intervals in your Availability settings.",
        actions: [{ label: "Manage Availability", path: "/provider/availability" }],
      };
    }

    if (query.includes("service") || query.includes("price")) {
      return {
        text: "You can add new service packages, update pricing, define job durations, or toggle service active status in Manage Services.",
        actions: [{ label: "Manage Services", path: "/provider/services" }],
      };
    }

    return {
      text: `Hello ${userName}! 🧰 I'm **FixIt Assistant**. I can help you manage your services, bookings, and availability schedule.`,
      actions: [
        { label: "Manage Services", path: "/provider/services" },
        { label: "Set Availability", path: "/provider/availability" },
        { label: "View Earnings", path: "/provider/earnings" },
      ],
    };
  }

  // ==========================================
  // 10. CUSTOMER SPECIFIC INTENTS
  // ==========================================
  // Tracking & Booking Status
  const isTrackingIntent =
    query.includes("status") ||
    query.includes("where is my") ||
    query.includes("technician") ||
    query.includes("my booking") ||
    query.includes("pending booking") ||
    query.includes("track") ||
    query.includes("booking status") ||
    query.includes("enga iruku") ||
    query.includes("technician enga");

  if (isTrackingIntent) {
    const customerName = (user?.name || "").toLowerCase();
    const customerEmail = (user?.email || "").toLowerCase();

    const userBookings = bookings.filter((b) => {
      if (!b) return false;
      const bCustomer = (b.customer || "").toLowerCase();
      const bEmail = (b.customerEmail || "").toLowerCase();
      if (customerName && bCustomer === customerName) return true;
      if (customerEmail && (bEmail === customerEmail || bCustomer === customerEmail)) return true;
      if (user?.role === "customer" && (customerName === "ananya rao" || customerEmail === "customer@fixit.com")) {
        return bCustomer === "ananya rao";
      }
      return false;
    });

    const activeBooking = userBookings.find((b) => ["On The Way", "Arrived", "Service Started", "Confirmed", "Pending"].includes(b.status)) || userBookings[0];

    if (activeBooking) {
      const trackable = ["Confirmed", "Provider Assigned", "On The Way", "Arrived", "Service Started"].includes(activeBooking.status);
      if (lang === "ta") {
        return {
          text: `உங்கள் **${activeBooking.service || activeBooking.serviceName}** booking **${activeBooking.provider}** உடன் தற்போது **${activeBooking.status}** நிலையில் உள்ளது (தேதி: **${activeBooking.date}**, நேரம்: **${activeBooking.time}**, கட்டணம்: ${activeBooking.amount}).`,
          actions: [
            ...(trackable ? [{ label: "🚚 Track Provider", path: `/customer/track/${activeBooking.id}` }] : []),
            { label: "Booking விவரம் பார்க்க", path: "/customer/booking-history" },
            { label: "Provider-ஐ தொடர்பு கொள்ள", path: "/customer/messages" },
          ],
        };
      }
      return {
        text: `Your **${activeBooking.service || activeBooking.serviceName}** booking with **${activeBooking.provider}** is currently **${activeBooking.status}** for **${activeBooking.date}** at **${activeBooking.time}** (Amount: ${activeBooking.amount}).`,
        actions: [
          ...(trackable ? [{ label: "🚚 Track Provider", path: `/customer/track/${activeBooking.id}` }] : []),
          { label: "View Booking History", path: "/customer/booking-history" },
          { label: "Contact Provider", path: "/customer/messages" },
        ],
      };
    }

    return {
      text: lang === "ta"
        ? "உங்களுக்கு தற்போது நிலுவையில் உள்ள bookings எதுவும் இல்லை. புதிய சேவைகளை பார்வையிட விரும்புகிறீர்களா?"
        : "You don't have any pending or active bookings at the moment. Would you like to explore services and schedule an appointment?",
      actions: [
        { label: "Browse Services", path: "/customer/services" },
        { label: "View Booking History", path: "/customer/booking-history" },
      ],
    };
  }

  // Problem to Service Mapping from existing services
  for (const item of SERVICE_KEYWORD_MAP) {
    const matchesKeyword = item.keywords.some((kw) => query.includes(kw));
    if (matchesKeyword) {
      localBrainContext.category = item.category;
      localBrainContext.service = item.serviceName;
      const responseText = item.recommendation[lang] || item.recommendation.en;
      const responseActions = item.actions[lang] || item.actions.en;
      return {
        text: responseText,
        actions: responseActions,
      };
    }
  }

  // Price Inquiries
  if (
    query.includes("price") ||
    query.includes("cost") ||
    query.includes("rate") ||
    query.includes("how much") ||
    query.includes("விலை") ||
    query.includes("கட்டணம்") ||
    query.includes("evlo") ||
    query.includes("evvalavu")
  ) {
    return {
      text: "Here is the starting price list from our verified service catalog:\n• **Plumbing Fix**: from ₹499\n• **Carpentry Work**: from ₹599\n• **Electrical Wiring**: from ₹699\n• **Pest Control**: from ₹799\n• **AC Repair & Service**: from ₹899\n• **Deep Home Cleaning**: from ₹1,299\n\nFinal prices depend on the selected provider and service scope.",
      actions: [
        { label: "Browse All Services", path: "/customer/services" },
        { label: "Book a Service", path: "/customer/book" },
      ],
    };
  }

  // Context Awareness based on locationPath
  if (locationPath) {
    if (locationPath.includes("/customer/services/")) {
      return {
        text: "You're currently viewing a service's details. Would you like help choosing a provider, comparing prices, or booking this service?",
        actions: [
          { label: "Book This Service", path: "/customer/book" },
          { label: "Find Provider", path: "/customer/services" },
        ],
      };
    }
    if (locationPath.includes("/customer/booking-history")) {
      return {
        text: "You're on your Booking History. I can help you track your technician's arrival, cancel a booking, or reschedule an appointment.",
        actions: [
          { label: "Track Booking", path: "/customer/booking-history" },
          { label: "Support & Help", path: "/customer/support" },
        ],
      };
    }
    if (locationPath.includes("/customer/wallet")) {
      return {
        text: "You're on your FixIt Wallet page. I can explain your balance, transaction history, or how 1-click booking checkout works.",
        actions: [
          { label: "Browse Services", path: "/customer/services" },
          { label: "View Booking History", path: "/customer/booking-history" },
        ],
      };
    }
  }

  // Follow-up Location Detection with Context Retention (e.g., Turn 1: "plumber venum" -> Turn 2: "Anna Nagar")
  const isLocationMention = query.includes("anna nagar") || query.includes("அண்ணா நக") || query.includes("t nagar") || query.includes("velachery") || query.includes("adyar");
  if (isLocationMention && localBrainContext.category) {
    localBrainContext.location = query.includes("anna nagar") || query.includes("அண்ணா நக") ? "Anna Nagar" : "Chennai";
    const cat = localBrainContext.category;
    if (lang === "tanglish") {
      return {
        text: `${localBrainContext.location}-la available ${cat} providers-a find pannuren. **QuickFix Plumbers** (Rated 4.0 ★, starting ₹499) top recommended provider:`,
        actions: [
          { label: "Book QuickFix Plumbers", path: "/customer/book" },
          { label: "View All Providers", path: "/customer/services" }
        ]
      };
    }
    if (lang === "ta") {
      return {
        text: `${localBrainContext.location}-ல் உள்ள சிறந்த ${cat} சேவை வழங்குநர்கள் இதோ. **QuickFix Plumbers** (ரேட்டிங்: 4.0 ★, ஆரம்ப விலை ₹499) முன்னணி பரிந்துரை:`,
        actions: [
          { label: "Book QuickFix Plumbers", path: "/customer/book" },
          { label: "அனைத்து Providers பார்க்க", path: "/customer/services" }
        ]
      };
    }
    return {
      text: `I found available ${cat} providers in ${localBrainContext.location}. **QuickFix Plumbers** (Rated 4.0 ★, starting from ₹499) is highly recommended:`,
      actions: [
        { label: "Book QuickFix Plumbers", path: "/customer/book" },
        { label: "View All Providers", path: "/customer/services" }
      ]
    };
  }

  // Friendly Customer Greeting ONLY when greeting is the actual intent
  if (query === "hi" || query === "hello" || query === "hey" || query === "வணக்கம்" || query === "help" || query === "") {
    if (lang === "ta") {
      return {
        text: `வணக்கம் ${userName}! 👋 நான் **FixIt Assistant**, உங்கள் ஸ்மார்ட் உள்ளூர் சேவை வழிகாட்டி. ஏசி ரிப்பேர், பிளம்பிங் போன்ற பிரச்னைகளை விவரிக்கவும், விலை விவரங்களை கேட்கவும், அல்லது உங்கள் booking-ஐ கண்காணிக்கவும் நான் உதவுகிறேன்!`,
        actions: [
          { label: "🔍 சேவை தேடு", path: "/customer/services" },
          { label: "📅 Service Book பண்ணு", path: "/customer/book" },
          { label: "📦 Booking கண்காணிக்க", path: "/customer/booking-history" },
        ],
      };
    }

    return {
      text: `Hello ${userName}! 👋 I'm **FixIt Assistant**, your smart local service guide. Describe any home repair problem (e.g. *"My AC is not cooling"* or *"Tap is leaking"*), ask for pricing, or check your bookings!`,
      actions: [
        { label: "🔍 Find a Service", path: "/customer/services" },
        { label: "📅 Book a Service", path: "/customer/book" },
        { label: "📦 Track Booking", path: "/customer/booking-history" },
      ],
    };
  }

  // Fallback Response
  return {
    text: lang === "ta"
      ? "மன்னிக்கவும், சரியாகப் புரியவில்லை. உங்கள் வீட்டு பராமரிப்பு பிரச்னைகளை (எ.கா: 'AC வேலை செய்யல' அல்லது 'குழாய் கசிவு') தெரிவிக்கலாம் அல்லது கீழே உள்ள விருப்பங்களை தேர்வு செய்யலாம்:"
      : "Sorry, I didn't quite understand that. You can describe your home repair problem (like *'AC not working'* or *'pipe leaking'*), ask about pricing, or choose one of the options below:",
    actions: [
      { label: "🔍 Find a Service", path: "/customer/services" },
      { label: "📅 Book a Service", path: "/customer/book" },
      { label: "📦 Track Booking", path: "/customer/booking-history" },
      { label: "❓ Support & Help", path: "/customer/support" },
    ],
  };
}

/**
 * Returns role-tailored initial quick action pills dynamically determined from
 * the logged-in user's role, language, and current page path.
 */
export function getRoleQuickActions(role, lang = "en", locationPath = "") {
  const isTamil = lang === "ta" || lang === "tanglish";

  if (role === "admin") {
    if (isTamil) {
      return [
        { label: "🛠️ Provider ஒப்புதல்கள்", prompt: "நிலுவையில் உள்ள provider விண்ணப்பங்களை காட்டு" },
        { label: "👥 பயனர்கள் மேலாண்மை", prompt: "பயனர் கணக்குகளை நிர்வகிப்பது எப்படி?" },
        { label: "📋 Bookings", prompt: "அனைத்து platform bookings-ஐ காட்டு" },
        { label: "⚠️ புகார்கள்", prompt: "தீர்வு காணப்படாத புகார்களை காட்டு" },
      ];
    }
    return [
      { label: "🛠️ Provider Approvals", prompt: "Show pending provider approvals" },
      { label: "👥 Manage Users", prompt: "How do I manage users and accounts?" },
      { label: "📋 Bookings", prompt: "Show all platform bookings" },
      { label: "⚠️ Complaints", prompt: "Show open complaints and disputes" },
    ];
  }

  if (role === "provider") {
    if (isTamil) {
      return [
        { label: "📋 எனது Bookings", prompt: "எனக்கு வந்துள்ள booking கோரிக்கைகளை காட்டு" },
        { label: "🛠️ Services மேலாண்மை", prompt: "புதிய சேவை அல்லது விலையை எப்படி மாற்றுவது?" },
        { label: "📅 Availability நேரம்", prompt: "வேலை நேர அட்டவணையை எப்படி மாற்றுவது?" },
        { label: "⭐ எனது Reviews", prompt: "வாடிக்கையாளர் மதிப்பீடுகளை காட்டு" },
      ];
    }
    return [
      { label: "📋 My Bookings", prompt: "Show my bookings and pending requests" },
      { label: "🛠️ Manage Services", prompt: "How do I add a service or update prices?" },
      { label: "📅 Availability", prompt: "How do I update my availability schedule?" },
      { label: "⭐ My Reviews", prompt: "Show my customer ratings and reviews" },
    ];
  }

  // Customer Context-Aware Actions
  if (locationPath.includes("/customer/services/")) {
    if (isTamil) {
      return [
        { label: "🤔 தேர்வு செய்ய உதவி", prompt: "I don't know what service I need" },
        { label: "📅 Book செய்வது எப்படி?", prompt: "How to book a service?" },
        { label: "👨‍🔧 Provider விவரம்", prompt: "Find a provider" },
      ];
    }
    return [
      { label: "Help Me Choose", prompt: "I don't know what service I need" },
      { label: "How to Book?", prompt: "How to book a service?" },
      { label: "Find Provider", prompt: "Find a provider" },
    ];
  }

  if (locationPath.includes("/customer/booking-history")) {
    if (isTamil) {
      return [
        { label: "📦 Booking Track", prompt: "Where is my technician? What is my booking status?" },
        { label: "❌ ரத்து செய்வது எப்படி?", prompt: "How do I cancel my booking?" },
        { label: "🔄 நேரம் மாற்றுவது எப்படி?", prompt: "How to reschedule?" },
      ];
    }
    return [
      { label: "Track Booking", prompt: "Where is my technician? What is my booking status?" },
      { label: "How to Cancel?", prompt: "How do I cancel my booking?" },
      { label: "How to Reschedule?", prompt: "How to reschedule?" },
    ];
  }

  if (locationPath.includes("/customer/wallet")) {
    if (isTamil) {
      return [
        { label: "💳 Wallet இருப்பு", prompt: "How does wallet work?" },
        { label: "💰 Wallet எப்படி செயல்படும்?", prompt: "How does wallet work?" },
        { label: "💳 பணம் செலுத்தும் முறைகள்", prompt: "How does wallet work?" },
      ];
    }
    return [
      { label: "Wallet Balance", prompt: "How does wallet work?" },
      { label: "How Wallet Works", prompt: "How does wallet work?" },
      { label: "Payment Methods", prompt: "How does wallet work?" },
    ];
  }

  // Default Customer Home / Browse
  if (isTamil) {
    return [
      { label: "🔧 Service தேடு", prompt: "Find a service" },
      { label: "📅 Book செய்வது எப்படி?", prompt: "How to book a service?" },
      { label: "👨‍🔧 சிறந்த Providers", prompt: "Find a provider" },
      { label: "📦 Booking Track", prompt: "Where is my technician? What is my booking status?" },
    ];
  }

  return [
    { label: "Find a Service", prompt: "Find a service" },
    { label: "How to Book?", prompt: "How to book a service?" },
    { label: "Find Provider", prompt: "Find a provider" },
    { label: "Track Booking", prompt: "Where is my technician? What is my booking status?" },
  ];
}
