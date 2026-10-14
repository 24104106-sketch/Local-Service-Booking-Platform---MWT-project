/**
 * FixIt Local - Reusable Provider Eligibility Service
 * Evaluates provider eligibility for:
 * 1. Nearby provider search
 * 2. Recommendation engine
 * 3. Server-side booking creation & revalidation
 */

const { Op } = require('sequelize');
const { Booking, ProviderProfile, ProviderService, Service, User, ProviderDailyAvailability } = require('../models');
const { areCategoriesMatching } = require('../utils/categoryNormalizer');

/**
 * Calculate accurate spherical Haversine distance in kilometers
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number|null} Distance in km rounded to 1 decimal place, or null if invalid
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;

  // Latitude must be -90 to 90, Longitude must be -180 to 180
  if (nLat1 < -90 || nLat1 > 90 || nLat2 < -90 || nLat2 > 90) return null;
  if (nLon1 < -180 || nLon1 > 180 || nLon2 < -180 || nLon2 > 180) return null;

  const R = 6371; // Earth's radius in km
  const dLat = (nLat2 - nLat1) * (Math.PI / 180);
  const dLon = (nLon2 - nLon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(nLat1 * (Math.PI / 180)) *
    Math.cos(nLat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Convert time string (e.g. '09:00 AM', '14:30', '9:00 AM', '09:00') to minutes from midnight
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const str = String(timeStr).trim().toUpperCase();
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const meridian = ampmMatch[3];
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  return null;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayNameFromDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return DAYS_OF_WEEK[d.getDay()];
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return DAYS_OF_WEEK[parsed.getDay()];
  }
  return null;
}

/**
 * Check provider eligibility strictly against all platform requirements
 * @param {object} provider ProviderProfile instance or plain object with associations
 * @param {object} criteria
 * @param {number} [criteria.customerLat]
 * @param {number} [criteria.customerLng]
 * @param {number|string} [criteria.serviceId]
 * @param {string} [criteria.serviceTitle]
 * @param {string} [criteria.category]
 * @param {string} [criteria.date]
 * @param {string} [criteria.time]
 * @param {boolean} [criteria.requireAvailableNow=true] If true, provider must have availability_status == AVAILABLE
 * @param {object} [criteria.transaction] Optional transaction for locking
 * @returns {Promise<{
 *   eligible: boolean,
 *   reason?: string,
 *   distanceKm?: number,
 *   matchedServiceMapping?: object,
 *   resolvedPrice?: number,
 *   pricingType?: string,
 *   serviceTitle?: string
 * }>}
 */
async function checkProviderEligibility(provider, criteria = {}) {
  const {
    customerLat,
    customerLng,
    serviceId,
    serviceTitle,
    category,
    date,
    time,
    requireAvailableNow = false,
    transaction = null
  } = criteria;

  if (!provider) {
    return { eligible: false, reason: 'Provider profile does not exist.' };
  }

  let prov = provider;
  if (typeof prov === 'number' || typeof prov === 'string') {
    prov = await ProviderProfile.findByPk(prov, {
      include: [
        { model: User, as: 'user' },
        { model: ProviderService, as: 'providerServices', include: [{ model: Service, as: 'service' }] }
      ],
      transaction
    });
  }

  if (!prov) {
    return { eligible: false, reason: 'Provider profile does not exist.' };
  }

  // 1. Provider User account check
  let user = prov.user;
  if (!user || user.role === undefined || user.status === undefined) {
    if (prov.user_id) {
      user = await User.findByPk(prov.user_id, { transaction });
    }
  }
  if (!user) {
    return { eligible: false, reason: 'Provider user account not found.' };
  }
  if (user.role !== 'provider') {
    return { eligible: false, reason: 'Account role is not provider.' };
  }
  if (user.status !== 'active') {
    return { eligible: false, reason: 'Provider account is blocked or suspended.' };
  }

  // 2. Approval & Verification Check
  if (!prov.is_approved) {
    return { eligible: false, reason: 'Provider is not approved by administrator.' };
  }
  if (prov.verification_status !== 'verified') {
    return { eligible: false, reason: 'Provider verification status is not verified.' };
  }
  if (prov.is_active === false) {
    return { eligible: false, reason: 'Provider account is deactivated.' };
  }

  // 3. Current Operational Availability Check
  const currentStatus = prov.availability_status || (prov.is_available ? 'AVAILABLE' : 'OFFLINE');
  if (currentStatus === 'BUSY') {
    return { eligible: false, reason: 'Provider is currently BUSY on an active job.' };
  }

  if (requireAvailableNow && currentStatus !== 'AVAILABLE') {
    return { eligible: false, reason: 'Provider is currently OFFLINE and not accepting jobs.' };
  }

  // 4. Real GPS Coordinates Check
  const provLat = prov.latitude != null ? Number(prov.latitude) : null;
  const provLng = prov.longitude != null ? Number(prov.longitude) : null;

  if (provLat == null || provLng == null || isNaN(provLat) || isNaN(provLng)) {
    return { eligible: false, reason: 'Provider does not have valid GPS coordinates.' };
  }
  if (provLat < -90 || provLat > 90 || provLng < -180 || provLng > 180) {
    return { eligible: false, reason: 'Provider GPS coordinates are outside valid Earth boundary.' };
  }

  // 5. Distance and Service Radius Check
  let distanceKm = null;
  const radiusKm = Number(prov.service_radius_km || prov.service_radius || 15);

  if (customerLat != null && customerLng != null && !isNaN(Number(customerLat)) && !isNaN(Number(customerLng))) {
    const cLat = Number(customerLat);
    const cLng = Number(customerLng);
    if (cLat >= -90 && cLat <= 90 && cLng >= -180 && cLng <= 180) {
      distanceKm = calculateHaversineDistance(cLat, cLng, provLat, provLng);
      if (distanceKm == null) {
        return { eligible: false, reason: 'Could not calculate distance to customer.' };
      }
      if (distanceKm > radiusKm) {
        return {
          eligible: false,
          reason: `Customer location is outside provider's operating radius (${distanceKm} km > ${radiusKm} km).`,
          distanceKm
        };
      }
    }
  }

  // 6. Service Offering and Pricing Check
  let providerServices = prov.providerServices;
  if (!providerServices && prov.id) {
    providerServices = await ProviderService.findAll({
      where: { provider_profile_id: prov.id, is_active: true },
      include: [{ model: Service, as: 'service' }],
      transaction
    });
  } else if (Array.isArray(providerServices)) {
    providerServices = providerServices.filter(ps => ps.is_active !== false);
  } else {
    providerServices = [];
  }

  let matchedMapping = null;
  let resolvedService = null;

  // Search by exact service ID
  if (serviceId) {
    const sIdNum = Number(serviceId);
    matchedMapping = providerServices.find(ps => ps.service_id === sIdNum);
    if (!matchedMapping) {
      resolvedService = await Service.findByPk(sIdNum, { transaction });
      const targetCat = resolvedService?.category || category;
      const catMatches = areCategoriesMatching(prov.category, targetCat) ||
        providerServices.some(ps => areCategoriesMatching(ps.service?.category, targetCat));
      if (!catMatches) {
        return { eligible: false, reason: 'Provider does not offer the requested service.' };
      }
      matchedMapping = providerServices.find(ps => areCategoriesMatching(ps.service?.category, targetCat)) || providerServices[0] || null;
    } else {
      resolvedService = matchedMapping.service || await Service.findByPk(sIdNum, { transaction });
    }
  } else if (serviceTitle) {
    const sTitleLower = String(serviceTitle).trim().toLowerCase();
    matchedMapping = providerServices.find(ps => {
      const title = (ps.service?.title || ps.service_title || '').toLowerCase();
      return title === sTitleLower || title.includes(sTitleLower) || sTitleLower.includes(title);
    });
    if (!matchedMapping) {
      // Check if category matches at least
      const catMatches = providerServices.some(ps => areCategoriesMatching(ps.service?.category, category || prov.category));
      if (!catMatches && !areCategoriesMatching(prov.category, category)) {
        return { eligible: false, reason: 'Provider does not offer the requested service.' };
      }
      matchedMapping = providerServices[0] || null;
    }
    resolvedService = matchedMapping?.service || null;
  } else if (category && category.toLowerCase() !== 'all') {
    const catMatches = areCategoriesMatching(prov.category, category) ||
      providerServices.some(ps => areCategoriesMatching(ps.service?.category, category));
    if (!catMatches) {
      return { eligible: false, reason: 'Provider does not offer services in this category.' };
    }
    matchedMapping = providerServices[0] || null;
    resolvedService = matchedMapping?.service || null;
  }

  if (!matchedMapping && providerServices.length === 0) {
    return { eligible: false, reason: 'Provider has no active services listed.' };
  }

  // Determine provider-specific price
  const basePrice = matchedMapping
    ? (matchedMapping.base_price ?? matchedMapping.custom_price ?? resolvedService?.price ?? prov.hourly_rate ?? 299)
    : (resolvedService?.price ?? prov.hourly_rate ?? 299);
  const pricingType = matchedMapping?.pricing_type || 'fixed';

  // 7. Schedule & Blocked Dates Check (Date-specific override or Recurring profile default)
  const providerUserId = prov.user_id || prov.user?.id;
  if (date) {
    let daily = null;
    if (providerUserId) {
      daily = await ProviderDailyAvailability.findOne({
        where: { provider_id: providerUserId, date },
        transaction
      });
    }

    if (daily) {
      if (daily.is_day_off || !daily.is_available) {
        return { eligible: false, reason: `Provider has marked ${date} as a day off / unavailable.` };
      }

      // Check daily working hours & busy intervals
      if (time) {
        const slotMin = timeToMinutes(time);
        const startMin = timeToMinutes(daily.start_time || '09:00 AM');
        const endMin = timeToMinutes(daily.end_time || '06:00 PM');

        if (slotMin !== null && startMin !== null && endMin !== null) {
          if (slotMin < startMin || slotMin > endMin) {
            return { eligible: false, reason: `Requested time ${time} is outside provider working hours (${daily.start_time} - ${daily.end_time}).` };
          }
        }

        const busyList = Array.isArray(daily.busy_intervals) ? daily.busy_intervals : [];
        for (const b of busyList) {
          const bStart = timeToMinutes(b.start);
          const bEnd = timeToMinutes(b.end);
          if (bStart !== null && bEnd !== null && slotMin >= bStart && slotMin < bEnd) {
            return { eligible: false, reason: `Requested time ${time} falls during provider's scheduled busy period.` };
          }
        }
      }
    } else {
      // Fallback to recurring schedule
      const dayName = getDayNameFromDate(date);
      const workingDays = Array.isArray(prov.working_days)
        ? prov.working_days
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      if (dayName && !workingDays.includes(dayName)) {
        return { eligible: false, reason: `Provider is off-duty on ${dayName}s.` };
      }

      const blockedDates = Array.isArray(prov.blocked_dates) ? prov.blocked_dates : [];
      if (blockedDates.includes(date)) {
        return { eligible: false, reason: `Provider has blocked bookings for date ${date}.` };
      }

      // 8. Working Hours & Break Slot Check
      if (time) {
        const wh = prov.working_hours || { start: '09:00', end: '18:00' };
        const slotMin = timeToMinutes(time);
        const startMin = timeToMinutes(wh.start || '09:00');
        const endMin = timeToMinutes(wh.end || '18:00');

        if (slotMin !== null && startMin !== null && endMin !== null) {
          if (slotMin < startMin || slotMin > endMin) {
            return { eligible: false, reason: `Requested time ${time} is outside provider working hours (${wh.start} - ${wh.end}).` };
          }
        }

        const breaks = Array.isArray(prov.breaks) ? prov.breaks : [];
        for (const b of breaks) {
          const bStart = timeToMinutes(b.start);
          const bEnd = timeToMinutes(b.end);
          if (bStart !== null && bEnd !== null && slotMin >= bStart && slotMin < bEnd) {
            return { eligible: false, reason: `Requested time ${time} falls during provider's scheduled break.` };
          }
        }
      }
    }

    // 9. Booking Conflict Check
    if (providerUserId && time) {
      const conflict = await Booking.findOne({
        where: {
          provider_id: providerUserId,
          date,
          time,
          status: { [Op.notIn]: ['cancelled', 'rejected'] }
        },
        transaction
      });

      if (conflict) {
        return { eligible: false, reason: `Provider already has an active booking on ${date} at ${time}.` };
      }
    }
  }

  return {
    eligible: true,
    distanceKm,
    matchedServiceMapping: matchedMapping,
    resolvedPrice: Number(basePrice),
    pricingType,
    serviceTitle: resolvedService?.title || matchedMapping?.service?.title || serviceTitle || 'Standard Service'
  };
}

module.exports = {
  calculateHaversineDistance,
  checkProviderEligibility,
  getDayNameFromDate,
  timeToMinutes
};
