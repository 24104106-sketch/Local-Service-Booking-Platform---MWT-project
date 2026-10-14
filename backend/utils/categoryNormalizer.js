/**
 * FixIt Local - Category and Service Identifier Normalizer
 * Standardizes category matching between display names, aliases, and database records.
 * Provides a single backend source of truth for canonical categories.
 */

const CANONICAL_CATEGORIES = [
  'Electrician',
  'Plumber',
  'Carpenter',
  'AC Repair',
  'Cleaning',
  'Painting',
  'Appliance Repair',
  'Pest Control',
  'Gardening'
];

const CATEGORY_MAP = {
  CAT_ELECTRICAL: {
    code: 'CAT_ELECTRICAL',
    displayName: 'Electrician',
    aliases: ['electrician', 'electrical', 'electrical wiring', 'electric', 'wiring', 'power']
  },
  CAT_PLUMBING: {
    code: 'CAT_PLUMBING',
    displayName: 'Plumber',
    aliases: ['plumber', 'plumbing', 'pipe', 'leak', 'drain', 'tap repair', 'pipes', 'pipe repair']
  },
  CAT_CARPENTRY: {
    code: 'CAT_CARPENTRY',
    displayName: 'Carpenter',
    aliases: ['carpenter', 'carpentry', 'woodcraft', 'furniture', 'woodwork', 'wood', 'furniture repair']
  },
  CAT_AC_REPAIR: {
    code: 'CAT_AC_REPAIR',
    displayName: 'AC Repair',
    aliases: ['ac repair', 'ac service', 'air conditioning', 'cooling', 'hvac', 'ac maintenance', 'air conditioner', 'ac installation', 'gas refilling', 'ac general service']
  },
  CAT_CLEANING: {
    code: 'CAT_CLEANING',
    displayName: 'Cleaning',
    aliases: ['cleaning', 'deep cleaning', 'home cleaning', 'housekeeping', 'sanitization', 'cleaner', 'bathroom cleaning', 'kitchen cleaning']
  },
  CAT_PAINTING: {
    code: 'CAT_PAINTING',
    displayName: 'Painting',
    aliases: ['painting', 'painter', 'home painting', 'wall painting', 'paniting', 'panter', 'paint', 'house painting', 'interior painting', 'exterior painting', 'whitewash']
  },
  CAT_APPLIANCE_REPAIR: {
    code: 'CAT_APPLIANCE_REPAIR',
    displayName: 'Appliance Repair',
    aliases: ['appliance repair', 'appliances', 'home appliances', 'refrigerator', 'washing machine', 'microwave', 'appliance', 'water purifier', 'geyser']
  },
  CAT_PEST_CONTROL: {
    code: 'CAT_PEST_CONTROL',
    displayName: 'Pest Control',
    aliases: ['pest control', 'pest care', 'termite', 'fumigation', 'cockroach', 'bedbug', 'pest', 'disinfection']
  },
  CAT_GARDENING: {
    code: 'CAT_GARDENING',
    displayName: 'Gardening',
    aliases: ['gardening', 'gardener', 'lawn care', 'landscaping', 'landscape', 'garden', 'lawn']
  }
};

/**
 * Check if a category string is a test/fixture category that should be excluded
 * @param {string} categoryStr 
 * @returns {boolean}
 */
function isTestCategory(categoryStr) {
  if (!categoryStr || typeof categoryStr !== 'string') return false;
  const clean = categoryStr.trim().toLowerCase();
  return /test.*cat|cat.*test|testdistance|mockcat|fixture/i.test(clean);
}

/**
 * Get category code for a given category string
 * @param {string} categoryStr 
 * @returns {string} Category code or uppercase normalized string
 */
function getCategoryCode(categoryStr) {
  if (!categoryStr || typeof categoryStr !== 'string') return 'CAT_GENERAL';
  if (isTestCategory(categoryStr)) return 'CAT_TEST';
  const clean = categoryStr.trim().toLowerCase();
  
  // 1. Exact match with canonical display name
  for (const [code, data] of Object.entries(CATEGORY_MAP)) {
    if (clean === data.displayName.toLowerCase()) {
      return code;
    }
  }

  // 2. Exact match with any alias
  for (const [code, data] of Object.entries(CATEGORY_MAP)) {
    if (data.aliases.some(alias => clean === alias.toLowerCase())) {
      return code;
    }
  }

  // 3. Substring inclusion
  for (const [code, data] of Object.entries(CATEGORY_MAP)) {
    if (data.aliases.some(alias => clean.includes(alias.toLowerCase()) || alias.toLowerCase().includes(clean))) {
      return code;
    }
  }
  return `CAT_${clean.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
}

/**
 * Check if two category strings match the same domain
 * @param {string} cat1 
 * @param {string} cat2 
 * @returns {boolean}
 */
function areCategoriesMatching(cat1, cat2) {
  if (!cat1 || !cat2) return false;
  if (isTestCategory(cat1) || isTestCategory(cat2)) return false;
  const c1 = String(cat1).trim().toLowerCase();
  const c2 = String(cat2).trim().toLowerCase();
  if (c1 === c2) return true;
  if (c1 === 'all' || c2 === 'all') return true;

  const code1 = getCategoryCode(cat1);
  const code2 = getCategoryCode(cat2);

  if (code1 === code2 && code1 !== 'CAT_GENERAL' && code1 !== 'CAT_TEST') {
    return true;
  }

  return c1.includes(c2) || c2.includes(c1);
}

/**
 * Get all known query aliases for a given category (including Title Case & lowercase)
 * @param {string} categoryStr 
 * @returns {string[]}
 */
function getCategoryAliases(categoryStr) {
  if (!categoryStr) return [];
  const clean = String(categoryStr).trim().toLowerCase();
  for (const data of Object.values(CATEGORY_MAP)) {
    if (clean === data.displayName.toLowerCase() || data.aliases.some(alias => clean === alias.toLowerCase())) {
      const aliasSet = new Set([data.displayName, ...data.aliases]);
      return Array.from(aliasSet);
    }
  }
  return [categoryStr.trim()];
}

/**
 * Resolve any category alias or misspelling to its canonical display name
 * @param {string} categoryStr 
 * @returns {string|null} Canonical category display name, or null if test category
 */
function getCanonicalCategory(categoryStr) {
  if (!categoryStr || typeof categoryStr !== 'string') return categoryStr;
  if (isTestCategory(categoryStr)) return null;

  const clean = categoryStr.trim().toLowerCase();

  // 1. Direct match with canonical display name
  for (const data of Object.values(CATEGORY_MAP)) {
    if (clean === data.displayName.toLowerCase()) {
      return data.displayName;
    }
  }

  // 2. Exact match with alias
  for (const data of Object.values(CATEGORY_MAP)) {
    if (data.aliases.some(alias => clean === alias.toLowerCase())) {
      return data.displayName;
    }
  }

  // 3. Substring match
  for (const data of Object.values(CATEGORY_MAP)) {
    if (data.aliases.some(alias => clean.includes(alias.toLowerCase()) || alias.toLowerCase().includes(clean))) {
      return data.displayName;
    }
  }

  return categoryStr.trim();
}

module.exports = {
  CANONICAL_CATEGORIES,
  CATEGORY_MAP,
  isTestCategory,
  getCategoryCode,
  areCategoriesMatching,
  getCategoryAliases,
  getCanonicalCategory
};
