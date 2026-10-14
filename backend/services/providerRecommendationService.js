/**
 * FixIt Local - Real Provider Recommendation Engine
 * Compares all eligible providers based on:
 * 1. Distance (35%)
 * 2. Price (25%)
 * 3. Service Quality (30% - Bayesian confidence-adjusted rating + completed jobs)
 * 4. Reliability & Availability (10%)
 * 
 * Does NOT hardcode rankings. Does NOT use fake ratings.
 * Returns transparent score breakdown for customer UI.
 */

const { Op } = require('sequelize');
const { ProviderProfile, ProviderService, Service, User, Booking } = require('../models');
const { checkProviderEligibility } = require('./providerEligibilityService');
const { areCategoriesMatching } = require('../utils/categoryNormalizer');

/**
 * Configurable recommendation weights
 */
const RECOMMENDATION_WEIGHTS = {
  DISTANCE: 0.35,
  PRICE: 0.25,
  QUALITY: 0.30,
  RELIABILITY: 0.10
};

/**
 * Calculate Bayesian confidence-adjusted rating
 * @param {number} rawRating Average rating from DB (0.0 - 5.0)
 * @param {number} reviewCount Number of reviews from DB
 * @param {number} [priorRating=4.0] Expected baseline
 * @param {number} [priorWeight=3] Weight of prior (equivalent to 3 reviews)
 * @returns {number} Confidence-adjusted rating
 */
function calculateAdjustedRating(rawRating, reviewCount, priorRating = 4.0, priorWeight = 3) {
  const v = Math.max(0, Number(reviewCount) || 0);
  const r = Math.max(0, Math.min(5, Number(rawRating) || 0));

  if (v === 0) {
    return priorRating;
  }
  return Number(((v * r + priorWeight * priorRating) / (v + priorWeight)).toFixed(2));
}

/**
 * Calculate transparent distance score (0 - 100)
 * Closer distance relative to provider radius produces higher score
 */
function calculateDistanceScore(distanceKm, radiusKm) {
  if (distanceKm == null) return 70; // Fallback if customer did not provide GPS
  const dist = Math.max(0, Number(distanceKm));
  const rad = Math.max(1, Number(radiusKm) || 15);

  if (dist <= 0.2) return 100;
  const ratio = dist / rad;
  const rawScore = 100 * (1 - Math.min(1, ratio));
  return Number(Math.max(15, Math.min(100, rawScore)).toFixed(1));
}

/**
 * Calculate transparent price score (0 - 100)
 * Compares provider price against range of prices for the requested service
 */
function calculatePriceScore(price, minPrice, maxPrice) {
  const p = Number(price) || 0;
  const minP = Number(minPrice) || p;
  const maxP = Number(maxPrice) || p;

  if (maxP === minP || maxP <= 0) {
    return 85.0; // Baseline when uniform pricing
  }

  const normalized = (maxP - p) / (maxP - minP);
  // Scale between 60 (highest price) to 100 (lowest price)
  const score = 60 + 40 * Math.max(0, Math.min(1, normalized));
  return Number(score.toFixed(1));
}

/**
 * Calculate service quality score (0 - 100)
 * Combines Bayesian adjusted rating (70%) and completed jobs track record (30%)
 */
function calculateQualityScore(rawRating, reviewCount, completedJobs) {
  const adjRating = calculateAdjustedRating(rawRating, reviewCount);
  const ratingScore = (adjRating / 5.0) * 70;

  const jobs = Math.max(0, Number(completedJobs) || 0);
  // Log-linear scale for completed jobs: reaches max 30 points at ~15 completed jobs
  const jobsScore = Math.min(30, jobs * 2);

  return Number(Math.min(100, Math.max(10, ratingScore + jobsScore)).toFixed(1));
}

/**
 * Calculate reliability score (0 - 100)
 */
function calculateReliabilityScore(completedCount, cancelledCount) {
  const comp = Math.max(0, Number(completedCount) || 0);
  const canc = Math.max(0, Number(cancelledCount) || 0);

  if (comp + canc === 0) {
    return 85.0; // Clean slate for newly approved providers
  }
  const rate = comp / (comp + canc);
  return Number((rate * 100).toFixed(1));
}

/**
 * Main Recommendation Engine function:
 * Compares eligible providers and calculates multi-factor recommendation score.
 * 
 * @param {object} criteria
 * @param {number} criteria.customerLat Customer latitude
 * @param {number} criteria.customerLng Customer longitude
 * @param {number|string} [criteria.serviceId] Requested service ID
 * @param {string} [criteria.serviceTitle] Requested service title
 * @param {string} [criteria.category] Requested category
 * @param {string} [criteria.date] Scheduled booking date
 * @param {string} [criteria.time] Scheduled booking time
 * @param {number} [criteria.radiusKm] Maximum search radius
 * @param {boolean} [criteria.availableOnly=true] Whether to enforce live availability
 * @returns {Promise<Array<object>>} Ranked list of recommended providers
 */
async function getRecommendedProviders(criteria = {}) {
  const customerLat = criteria.customerLat ?? criteria.latitude ?? criteria.lat;
  const customerLng = criteria.customerLng ?? criteria.longitude ?? criteria.lng;
  const {
    serviceId,
    serviceTitle,
    category,
    date,
    time,
    radiusKm,
    availableOnly = false
  } = criteria;

  // 1. Resolve master service if ID or Title provided
  let targetService = null;
  if (serviceId && !isNaN(Number(serviceId))) {
    targetService = await Service.findByPk(Number(serviceId));
  }
  if (!targetService && serviceTitle) {
    targetService = await Service.findOne({
      where: { title: { [Op.like]: `%${String(serviceTitle).trim()}%` } }
    });
  }

  const effectiveCategory = targetService?.category || category;

  // 2. Fetch approved, active providers
  const providers = await ProviderProfile.findAll({
    where: {
      is_approved: true,
      is_active: { [Op.ne]: false }
    },
    include: [
      {
        model: User,
        as: 'user',
        where: { status: 'active', role: 'provider' },
        attributes: ['id', 'name', 'email', 'phone', 'avatar', 'city', 'role', 'status']
      },
      {
        model: ProviderService,
        as: 'providerServices',
        where: { is_active: true },
        required: false,
        include: [{ model: Service, as: 'service' }]
      }
    ]
  });

  // 3. Filter providers strictly through Eligibility Service
  const eligibleProviders = [];

  for (const p of providers) {
    const pJson = p.toJSON();

    const eligibility = await checkProviderEligibility(p, {
      customerLat,
      customerLng,
      serviceId: targetService?.id || serviceId,
      serviceTitle: targetService?.title || serviceTitle,
      category: effectiveCategory,
      date,
      time,
      requireAvailableNow: availableOnly
    });

    if (!eligibility.eligible) {
      continue;
    }

    if (radiusKm && eligibility.distanceKm != null && eligibility.distanceKm > Number(radiusKm)) {
      continue;
    }

    eligibleProviders.push({
      profile: p,
      profileJson: pJson,
      distanceKm: eligibility.distanceKm,
      price: eligibility.resolvedPrice,
      pricingType: eligibility.pricingType || 'fixed',
      serviceName: eligibility.serviceTitle || targetService?.title || 'Standard Service',
      serviceId: targetService?.id || eligibility.matchedServiceMapping?.service_id || null
    });
  }

  if (eligibleProviders.length === 0) {
    return [];
  }

  // 4. Calculate relative price bounds among eligible candidate providers
  const allPrices = eligibleProviders.map(ep => ep.price);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);

  // 5. Compute transparent recommendation score for each eligible provider
  const scoredProviders = [];

  for (const item of eligibleProviders) {
    const p = item.profile;
    const pJson = item.profileJson;
    const provRadius = Number(p.service_radius_km || p.service_radius || 15);

    // Multi-factor sub-scores
    const distanceScore = calculateDistanceScore(item.distanceKm, provRadius);
    const priceScore = calculatePriceScore(item.price, minPrice, maxPrice);
    const qualityScore = calculateQualityScore(p.rating, p.review_count, p.completed_jobs);

    // Reliability signal: completed vs cancelled bookings
    const completedCount = Number(p.completed_jobs || 0);
    const cancelledCount = await Booking.count({
      where: { provider_id: p.user_id, status: 'cancelled' }
    });
    const reliabilityScore = calculateReliabilityScore(completedCount, cancelledCount);

    // Composite Weighted Recommendation Score
    const totalScore = Number((
      distanceScore * RECOMMENDATION_WEIGHTS.DISTANCE +
      priceScore * RECOMMENDATION_WEIGHTS.PRICE +
      qualityScore * RECOMMENDATION_WEIGHTS.QUALITY +
      reliabilityScore * RECOMMENDATION_WEIGHTS.RELIABILITY
    ).toFixed(1));

    const isAvailableNow = (p.availability_status === 'AVAILABLE' && p.is_available === true);

    scoredProviders.push({
      providerId: p.id,
      providerProfileId: p.id,
      userId: p.user_id,
      providerName: p.user?.name || p.business_name,
      businessName: p.business_name,
      category: p.category,
      avatar: p.user?.avatar || '',
      phone: p.user?.phone || '',
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      price: item.price,
      pricingType: item.pricingType.toUpperCase(),
      distanceKm: item.distanceKm,
      rating: Number(Number(p.rating || 0).toFixed(1)),
      reviewCount: Number(p.review_count || 0),
      completedJobs: Number(p.completed_jobs || 0),
      availabilityStatus: p.availability_status || (p.is_available ? 'AVAILABLE' : 'OFFLINE'),
      isAvailable: isAvailableNow,
      isVerified: p.verification_status === 'verified',
      recommendationScore: totalScore,
      scoreBreakdown: {
        distanceScore,
        priceScore,
        qualityScore,
        reliabilityScore,
        weights: RECOMMENDATION_WEIGHTS
      },
      servicesOffered: (p.providerServices || []).map(ps => ({
        id: ps.service_id,
        title: ps.service?.title || 'Service',
        price: ps.base_price ?? ps.custom_price ?? ps.service?.price ?? item.price,
        pricingType: (ps.pricing_type || 'fixed').toUpperCase()
      }))
    });
  }

  // 6. Rank providers by recommendationScore descending
  scoredProviders.sort((a, b) => {
    // 1. Available providers preferred when equal
    const aAvail = a.availabilityStatus === 'AVAILABLE' ? 1 : 0;
    const bAvail = b.availabilityStatus === 'AVAILABLE' ? 1 : 0;
    if (aAvail !== bAvail) return bAvail - aAvail;

    // 2. Multi-factor recommendation score
    if (b.recommendationScore !== a.recommendationScore) {
      return b.recommendationScore - a.recommendationScore;
    }

    // 3. Proximity tie-breaker
    if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }

    // 4. Rating tie-breaker
    return b.rating - a.rating;
  });

  return scoredProviders;
}

module.exports = {
  RECOMMENDATION_WEIGHTS,
  calculateAdjustedRating,
  calculateDistanceScore,
  calculatePriceScore,
  calculateQualityScore,
  calculateReliabilityScore,
  getRecommendedProviders
};
