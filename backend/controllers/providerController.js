const { Op } = require('sequelize');
const { ProviderProfile, User, Booking, Service, ProviderService, ProviderDailyAvailability } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');
const { getRecommendedProviders } = require('../services/providerRecommendationService');
const { checkProviderEligibility } = require('../services/providerEligibilityService');
const availabilityHelper = require('../utils/availabilityHelper');

// @desc    Get all active / approved providers
// @route   GET /api/providers
// @access  Public
const getAllProviders = async (req, res, next) => {
  try {
    const { category, availableOnly, search } = req.query;
    const where = { is_approved: true };

    if (category && category.toLowerCase() !== 'all') {
      const { getCanonicalCategory, getCategoryAliases } = require('../utils/categoryNormalizer');
      const canonical = getCanonicalCategory(category) || category;
      const aliases = getCategoryAliases(canonical);
      where.category = { [Op.in]: aliases };
    }

    if (availableOnly === 'true') {
      where.is_available = true;
    }

    if (search) {
      where[Op.or] = [
        { business_name: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } }
      ];
    }

    const providers = await ProviderProfile.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'avatar', 'city']
        },
        {
          model: Service,
          as: 'servicesOffered',
          through: { attributes: [] }
        }
      ],
      order: [
        ['rating', 'DESC'],
        ['review_count', 'DESC']
      ]
    });

    return sendSuccess(res, providers.map(p => p.toJSON()), 'Providers retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get provider profile by ID (profile ID or user ID)
// @route   GET /api/providers/:id
// @access  Public
const getProviderById = async (req, res, next) => {
  try {
    const providerId = req.params.id;
    const isNumeric = !isNaN(providerId);

    const whereClause = isNumeric
      ? { [Op.or]: [{ id: providerId }, { user_id: providerId }] }
      : { business_name: { [Op.like]: `%${providerId}%` } };

    const provider = await ProviderProfile.findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'avatar', 'city', 'address']
        },
        {
          model: Service,
          as: 'servicesOffered',
          through: { attributes: [] }
        }
      ]
    });

    if (!provider) {
      return sendError(res, 'Provider not found', 404);
    }

    const pData = provider.toJSON();
    // Do NOT expose exact private home address or private coordinates in public provider profile
    delete pData.address;
    delete pData.latitude;
    delete pData.longitude;
    delete pData.current_location;
    if (pData.user) {
      delete pData.user.address;
    }
    if (pData.location) {
      pData.location = {
        city: pData.city || 'Chennai',
        state: pData.state || 'Tamil Nadu',
        area: pData.city || 'Chennai'
      };
    }

    return sendSuccess(res, pData, 'Provider retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get current provider's own profile
// @desc    Get current provider's own profile
// @route   GET /api/providers/profile/me
// @access  Private (Provider)
const getMyProviderProfile = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;

    const profile = await ProviderProfile.findOne({
      where: { user_id: userId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'avatar', 'city', 'address']
        },
        {
          model: Service,
          as: 'servicesOffered',
          through: { attributes: [] }
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

    if (!profile) {
      // PART 1: Return 404. DO NOT automatically create an approved/verified profile.
      return sendError(res, 'Provider profile not found. Please complete provider registration.', 404);
    }

    return sendSuccess(res, profile.toJSON(), 'My provider profile retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Update current provider's profile
// @route   PUT /api/providers/profile/me
// @access  Private (Provider)
const updateMyProviderProfile = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      businessName,
      category,
      hourlyRate,
      bio,
      isAvailable,
      skills,
      address,
      lat,
      lng,
      serviceRadius
    } = req.body;

    let profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) {
      // PART 1: Return 404. Updating profile must NEVER create an automatically approved/verified provider.
      return sendError(res, 'Provider profile not found. Please complete provider registration.', 404);
    }

    // PART 21 - SECURITY: Provider MUST NOT be able to change is_approved, verification_status, is_active, rating, review_count
    // These fields are strictly ignored.

    if (businessName) profile.business_name = businessName.trim();
    if (category) profile.category = category.trim();
    if (hourlyRate !== undefined && !isNaN(Number(hourlyRate))) profile.hourly_rate = Number(hourlyRate);
    if (bio !== undefined) profile.bio = bio;
    if (Array.isArray(skills)) profile.skills = skills;
    if (serviceRadius !== undefined && !isNaN(Number(serviceRadius))) {
      const rad = Number(serviceRadius);
      if (rad > 0 && rad <= 100) {
        profile.service_radius = rad;
        profile.service_radius_km = rad;
      }
    }

    if (lat !== undefined && lng !== undefined && lat !== '' && lng !== '') {
      const numLat = Number(lat);
      const numLng = Number(lng);
      if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
        return sendError(res, 'Valid coordinates required: Latitude between -90 and 90, Longitude between -180 and 180.', 400);
      }
      profile.latitude = numLat;
      profile.longitude = numLng;
      if (address) profile.address = address;
      const currentLoc = profile.location || {};
      profile.location = {
        lat: numLat,
        lng: numLng,
        address: address || currentLoc.address || 'Chennai',
        updatedAt: new Date()
      };
      profile.current_location = {
        lat: numLat,
        lng: numLng,
        heading: 0,
        speed: 0,
        updatedAt: new Date()
      };
    }

    // Availability change subject to server validation
    if (isAvailable !== undefined) {
      const willBeAvailable = Boolean(isAvailable);
      if (willBeAvailable) {
        if (!profile.is_approved || profile.is_active === false || profile.verification_status !== 'verified') {
          return sendError(res, 'Cannot go available while profile is unapproved, unverified, or inactive.', 400);
        }
        profile.is_available = true;
        profile.availability_status = 'AVAILABLE';
      } else {
        profile.is_available = false;
        profile.availability_status = 'OFFLINE';
      }
    }

    await profile.save();

    const updatedProfile = await ProviderProfile.findByPk(profile.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'avatar', 'city', 'address']
        },
        {
          model: Service,
          as: 'servicesOffered',
          through: { attributes: [] }
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

    return sendSuccess(res, updatedProfile.toJSON(), 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Update live location (GPS beacon)
// @route   POST /api/providers/location
// @access  Private (Provider)
const updateLiveLocation = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { lat, lng, heading = 0, speed = 0, bookingId } = req.body;

    const nLat = Number(lat);
    const nLng = Number(lng);

    if (isNaN(nLat) || isNaN(nLng) || nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
      return sendError(res, 'Coordinates must be valid numbers: Latitude between -90 and 90, Longitude between -180 and 180', 400);
    }

    const locUpdate = {
      lat: nLat,
      lng: nLng,
      latitude: nLat,
      longitude: nLng,
      heading: Number(heading || 0),
      speed: Number(speed || 0),
      accuracy: req.body.accuracy || null,
      updatedAt: new Date().toISOString()
    };

    const profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (profile) {
      profile.latitude = nLat;
      profile.longitude = nLng;
      profile.current_location = locUpdate;
      profile.location = {
        ...(profile.location || {}),
        lat: nLat,
        lng: nLng
      };
      await profile.save();
    }

    // If tracking a specific active booking, also update the booking record
    if (bookingId) {
      const rawParam = String(bookingId).trim();
      let booking = null;
      if (!isNaN(Number(rawParam))) {
        booking = await Booking.findByPk(Number(rawParam));
      }
      if (!booking) {
        const cleanNumeric = rawParam.replace(/^(BK|FIX-?)/i, '');
        const searchConds = [{ booking_number: rawParam }];
        if (!isNaN(Number(cleanNumeric)) && Number(cleanNumeric) > 0) {
          searchConds.push({ id: Number(cleanNumeric) });
        }
        booking = await Booking.findOne({
          where: { [Op.or]: searchConds }
        });
      }

      if (!booking) {
        return sendError(res, 'Booking not found', 404);
      }

      // Verify that this provider is the assigned provider for the booking
      if (booking.provider_id !== userId && req.user.role !== 'admin') {
        return sendError(res, 'Forbidden. You are not the assigned provider for this booking.', 403);
      }

      // Verify active tracking status
      const activeStatuses = ['accepted', 'on_the_way', 'arrived', 'in_progress'];
      if (!activeStatuses.includes(booking.status)) {
        return sendError(res, `Location tracking is not active for booking status '${booking.status}'.`, 400);
      }

      booking.provider_location = {
        lat: nLat,
        lng: nLng,
        heading: Number(heading || 0),
        updatedAt: new Date()
      };
      await booking.save();

      // Socket.IO broadcast to the booking's room (both ID and booking_number)
      const io = req.app.get('io');
      if (io) {
        const payload = {
          bookingId: booking.id,
          bookingNumber: booking.booking_number,
          providerId: userId,
          latitude: nLat,
          longitude: nLng,
          lat: nLat,
          lng: nLng,
          heading: Number(heading || 0),
          speed: Number(speed || 0),
          accuracy: req.body.accuracy ? Number(req.body.accuracy) : null,
          timestamp: new Date().toISOString()
        };

        const room1 = `booking:${booking.id}`;
        const room2 = booking.booking_number ? `booking:${booking.booking_number}` : null;

        io.to(room1).emit('provider_location_update', payload);
        io.to(room1).emit('provider_location_updated', payload);
        if (room2 && room2 !== room1) {
          io.to(room2).emit('provider_location_update', payload);
          io.to(room2).emit('provider_location_updated', payload);
        }
      }
    }

    return sendSuccess(res, locUpdate, 'Location updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard metrics for current provider
// @route   GET /api/providers/dashboard/stats
// @access  Private (Provider)
const getProviderStats = async (req, res, next) => {
  try {
    const providerId = req.user.id || req.user._id;

    const totalBookings = await Booking.count({ where: { provider_id: providerId } });
    const completedBookings = await Booking.count({
      where: { provider_id: providerId, status: 'completed' }
    });
    const activeBookings = await Booking.count({
      where: {
        provider_id: providerId,
        status: {
          [Op.in]: ['confirmed', 'provider_assigned', 'on_the_way', 'arrived', 'in_progress']
        }
      }
    });

    const completedList = await Booking.findAll({
      where: { provider_id: providerId, status: 'completed' },
      attributes: ['amount']
    });
    const totalEarnings = completedList.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    const profile = await ProviderProfile.findOne({ where: { user_id: providerId } });

    return sendSuccess(res, {
      totalBookings,
      completedBookings,
      activeBookings,
      totalEarnings,
      rating: profile ? profile.rating : 5.0,
      reviewCount: profile ? profile.review_count : 0,
      isAvailable: profile ? profile.is_available : true
    }, 'Provider stats retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get services offered by the current provider with pricing details
// @route   GET /api/providers/services
// @access  Private (Provider)
const getProviderServices = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    let profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) {
      return sendError(res, 'Provider profile not found', 404);
    }

    const mappings = await ProviderService.findAll({
      where: { provider_profile_id: profile.id },
      include: [{ model: Service, as: 'service' }]
    });

    const result = mappings.map((m) => {
      const s = m.service ? m.service.toJSON() : {};
      const basePrice = m.base_price != null ? m.base_price : (m.custom_price != null ? m.custom_price : (s.price || 0));
      return {
        id: s.id || m.service_id,
        serviceId: s.id || m.service_id,
        service_id: s.id || m.service_id,
        mappingId: m.id,
        title: s.title || 'Untitled Service',
        name: s.title || 'Untitled Service',
        serviceTitle: s.title || 'Untitled Service',
        service_title: s.title || 'Untitled Service',
        category: s.category || profile.category || 'General',
        catalogPrice: s.price || 0,
        basePrice: Number(basePrice),
        base_price: Number(basePrice),
        customPrice: Number(basePrice),
        pricingType: m.pricing_type || 'fixed',
        pricing_type: m.pricing_type || 'fixed',
        isActive: m.is_active !== false,
        is_active: m.is_active !== false,
        duration: s.duration || '45–60 min',
        description: s.description || ''
      };
    });

    return sendSuccess(res, result, 'Provider services retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Update pricing and status for a provider's service
// @route   PUT /api/providers/services/:serviceId
// @access  Private (Provider)
const updateServicePricing = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { serviceId } = req.params;
    const { basePrice, customPrice, pricingType, isActive } = req.body;

    let profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) {
      return sendError(res, 'Provider profile not found', 404);
    }

    let mapping = await ProviderService.findOne({
      where: {
        provider_profile_id: profile.id,
        [Op.or]: [{ service_id: serviceId }, { id: serviceId }]
      },
      include: [{ model: Service, as: 'service' }]
    });

    if (!mapping) {
      return sendError(res, 'Service mapping not found for this provider', 404);
    }

    const resolvedPrice = (basePrice !== undefined && basePrice !== null && basePrice !== '')
      ? Number(basePrice)
      : (customPrice !== undefined && customPrice !== null && customPrice !== '')
      ? Number(customPrice)
      : mapping.base_price;

    if (resolvedPrice !== undefined && resolvedPrice !== null) {
      mapping.base_price = resolvedPrice;
      mapping.custom_price = resolvedPrice;
    }

    if (pricingType && ['fixed', 'starting_from', 'inspection_required'].includes(pricingType)) {
      mapping.pricing_type = pricingType;
    }

    if (isActive !== undefined) {
      mapping.is_active = Boolean(isActive);
    }

    await mapping.save();

    return sendSuccess(res, {
      id: mapping.service_id,
      mappingId: mapping.id,
      title: mapping.service?.title,
      basePrice: mapping.base_price,
      customPrice: mapping.custom_price,
      pricingType: mapping.pricing_type,
      isActive: mapping.is_active
    }, 'Service pricing updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Add a service from catalog to provider's offerings
// @route   POST /api/providers/services
// @access  Private (Provider)
const addServiceToProvider = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { serviceId, title, category, basePrice, customPrice, pricingType } = req.body;

    let profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) {
      return sendError(res, 'Provider profile not found', 404);
    }

    let targetService = null;
    if (serviceId) {
      targetService = await Service.findByPk(serviceId);
    } else if (title) {
      targetService = await Service.findOne({
        where: { title: { [Op.like]: `%${title.trim()}%` } }
      });
    }

    if (!targetService) {
      return sendError(res, 'Service not found in master catalog. Providers cannot create arbitrary services without catalog approval.', 400);
    }

    let [mapping, created] = await ProviderService.findOrCreate({
      where: {
        provider_profile_id: profile.id,
        service_id: targetService.id
      },
      defaults: {
        base_price: basePrice != null ? Number(basePrice) : (customPrice != null ? Number(customPrice) : targetService.price),
        custom_price: basePrice != null ? Number(basePrice) : (customPrice != null ? Number(customPrice) : targetService.price),
        pricing_type: pricingType || 'fixed',
        is_active: true
      }
    });

    if (!created) {
      if (basePrice != null || customPrice != null) {
        mapping.base_price = Number(basePrice ?? customPrice);
        mapping.custom_price = Number(basePrice ?? customPrice);
      }
      if (pricingType) mapping.pricing_type = pricingType;
      mapping.is_active = true;
      await mapping.save();
    }

    return sendSuccess(res, {
      id: targetService.id,
      mappingId: mapping.id,
      title: targetService.title,
      category: targetService.category,
      basePrice: mapping.base_price,
      customPrice: mapping.custom_price,
      pricingType: mapping.pricing_type,
      isActive: mapping.is_active
    }, 'Service added to offerings successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Remove or deactivate a service from provider's offerings
// @route   DELETE /api/providers/services/:serviceId
// @access  Private (Provider)
const removeServiceFromProvider = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { serviceId } = req.params;

    let profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) {
      return sendError(res, 'Provider profile not found', 404);
    }

    const mapping = await ProviderService.findOne({
      where: {
        provider_profile_id: profile.id,
        [Op.or]: [{ service_id: serviceId }, { id: serviceId }]
      }
    });

    if (!mapping) {
      return sendError(res, 'Service mapping not found', 404);
    }

    await mapping.destroy();
    return sendSuccess(res, null, 'Service removed from offerings');
  } catch (error) {
    next(error);
  }
};

// Helper for spherical Haversine distance in km
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;

  const R = 6371; // Earth radius in km
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

// Convert time string (e.g. '09:00 AM', '14:30', '9:00 AM', '09:00') to minutes from midnight
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
  return null;
}

// Standard service time slots
const STANDARD_SLOTS = [
  '09:00 AM',
  '11:00 AM',
  '01:00 PM',
  '03:00 PM',
  '05:00 PM',
  '07:00 PM'
];

// @desc    Find nearby recommended providers based on customer booking location and category/service
// @desc    Find nearby recommended providers based on customer booking location and category/service
// @route   GET /api/providers/nearby
// @access  Public
const getNearbyProviders = async (req, res, next) => {
  try {
    const category = req.query.category || req.body?.category || req.query.serviceCategory;
    const serviceId = req.query.serviceId || req.body?.serviceId;
    const serviceTitle = req.query.serviceTitle || req.body?.serviceTitle || req.query.service || req.body?.service;
    const date = req.query.date || req.body?.date;
    const time = req.query.time || req.body?.time;
    const customerLat = req.query.latitude ?? req.query.lat ?? req.query.customerLat ?? req.body?.latitude ?? req.body?.lat ?? req.body?.customerLat;
    const customerLng = req.query.longitude ?? req.query.lng ?? req.query.customerLng ?? req.body?.longitude ?? req.body?.lng ?? req.body?.customerLng;
    const radiusKm = req.query.radiusKm || req.body?.radiusKm || req.query.radius || req.query.serviceRadius;
    const availableOnly = req.query.availableOnly === 'true' || req.body?.availableOnly === true;

    // Validate customer booking coordinates
    if (customerLat == null || customerLng == null || customerLat === '' || customerLng === '') {
      return sendError(res, 'Valid booking latitude and longitude are required to find nearby providers.', 400);
    }

    const cLat = Number(customerLat);
    const cLng = Number(customerLng);
    if (isNaN(cLat) || isNaN(cLng) || cLat < -90 || cLat > 90 || cLng < -180 || cLng > 180) {
      return sendError(res, 'Latitude (-90 to 90) and Longitude (-180 to 180) must be valid coordinates.', 400);
    }

    const recommended = await getRecommendedProviders({
      customerLat: cLat,
      customerLng: cLng,
      serviceId,
      serviceTitle,
      category,
      date,
      time,
      radiusKm: radiusKm ? Number(radiusKm) : null,
      availableOnly
    });

    return sendSuccess(res, recommended, 'Nearby recommended providers retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get recommended providers based on multi-factor recommendation engine
// @route   GET /api/providers/recommended
// @access  Public
const getRecommendedProvidersHandler = async (req, res, next) => {
  try {
    let queryParams = req.query;
    if (req.query?.params && typeof req.query.params === 'object') {
      queryParams = { ...req.query.params, ...req.query };
    }
    const category = queryParams.category || req.body?.category || queryParams.serviceCategory;
    const serviceId = queryParams.serviceId || req.body?.serviceId;
    const serviceTitle = queryParams.serviceTitle || req.body?.serviceTitle || queryParams.service || req.body?.service;
    const date = queryParams.date || req.body?.date;
    const time = queryParams.time || req.body?.time;
    const customerLat = queryParams.latitude ?? queryParams.lat ?? queryParams.customerLat ?? req.body?.latitude ?? req.body?.lat ?? req.body?.customerLat;
    const customerLng = queryParams.longitude ?? queryParams.lng ?? queryParams.customerLng ?? req.body?.longitude ?? req.body?.lng ?? req.body?.customerLng;
    const radiusKm = queryParams.radiusKm || req.body?.radiusKm || queryParams.radius || queryParams.serviceRadius;
    const availableOnly = queryParams.availableOnly === 'true' || req.body?.availableOnly === true;

    if (customerLat == null || customerLng == null || customerLat === '' || customerLng === '') {
      return sendError(res, 'Valid booking latitude and longitude are required to find recommended providers.', 400);
    }

    const cLat = Number(customerLat);
    const cLng = Number(customerLng);
    if (isNaN(cLat) || isNaN(cLng) || cLat < -90 || cLat > 90 || cLng < -180 || cLng > 180) {
      return sendError(res, 'Latitude (-90 to 90) and Longitude (-180 to 180) must be valid coordinates.', 400);
    }

    const providers = await getRecommendedProviders({
      customerLat: cLat,
      customerLng: cLng,
      serviceId,
      serviceTitle,
      category,
      date,
      time,
      radiusKm: radiusKm ? Number(radiusKm) : null,
      availableOnly
    });

    return sendSuccess(res, {
      count: providers.length,
      providers
    }, 'Recommended providers retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Find eligible available providers for a service, location, and date/time
// @route   POST /api/providers/available or GET /api/providers/available
// @access  Public
const getAvailableProviders = async (req, res, next) => {
  try {
    const customerLat = req.body.latitude ?? req.query.latitude ?? req.body.lat ?? req.query.lat;
    const customerLng = req.body.longitude ?? req.query.longitude ?? req.body.lng ?? req.query.lng;

    // If coordinates are provided, reuse the nearby provider algorithm
    if (customerLat != null && customerLng != null && !isNaN(Number(customerLat)) && !isNaN(Number(customerLng))) {
      return getNearbyProviders(req, res, next);
    }

    const serviceId = req.body.serviceId || req.query.serviceId;
    const serviceTitle = req.body.serviceTitle || req.query.serviceTitle || req.body.service;
    const date = req.body.date || req.query.date;
    const time = req.body.time || req.query.time;

    // 1. Resolve Service
    let targetService = null;
    if (serviceId && !isNaN(serviceId)) {
      targetService = await Service.findByPk(Number(serviceId));
    }
    if (!targetService && serviceTitle) {
      targetService = await Service.findOne({
        where: { title: { [Op.like]: `%${String(serviceTitle).trim()}%` } }
      });
    }

    // 2. Query all approved and active provider profiles
    const allProviders = await ProviderProfile.findAll({
      where: {
        is_approved: true,
        is_active: { [Op.ne]: false }
      },
      include: [
        {
          model: User,
          as: 'user',
          where: { status: 'active' },
          attributes: ['id', 'name', 'email', 'phone', 'avatar', 'city']
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

    const eligibleList = [];

    for (const p of allProviders) {
      const pJson = p.toJSON();

      let matchedMapping = null;
      let compatibilityScore = 0;
      if (targetService) {
        matchedMapping = (p.providerServices || []).find(
          (ps) => ps.service_id === targetService.id || (ps.service && ps.service.title === targetService.title)
        );

        const catMatch =
          (p.category || '').toLowerCase() === (targetService.category || '').toLowerCase();

        if (matchedMapping) {
          compatibilityScore = 2;
        } else if (catMatch) {
          compatibilityScore = 1;
        } else {
          continue;
        }
      }

      // Schedule check: working days, blocked dates, working hours, and breaks
      if (date) {
        const dayName = getDayNameFromDate(date);
        const workingDays = Array.isArray(p.working_days)
          ? p.working_days
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        if (dayName && !workingDays.includes(dayName)) {
          continue;
        }

        const blockedDates = Array.isArray(p.blocked_dates) ? p.blocked_dates : [];
        if (blockedDates.includes(date)) {
          continue;
        }
      }

      let isAvailableNow = (pJson.availabilityStatus === 'AVAILABLE');

      if (date && time) {
        const wh = p.working_hours || { start: '09:00', end: '18:00' };
        const slotMin = timeToMinutes(time);
        const startMin = timeToMinutes(wh.start || '09:00');
        const endMin = timeToMinutes(wh.end || '18:00');

        if (slotMin !== null && startMin !== null && endMin !== null) {
          if (slotMin < startMin || slotMin > endMin) {
            continue;
          }
        }

        const breaks = Array.isArray(p.breaks) ? p.breaks : [];
        let inBreak = false;
        for (const b of breaks) {
          const bStart = timeToMinutes(b.start);
          const bEnd = timeToMinutes(b.end);
          if (bStart !== null && bEnd !== null && slotMin >= bStart && slotMin < bEnd) {
            inBreak = true;
            break;
          }
        }
        if (inBreak) {
          continue;
        }

        const conflict = await Booking.findOne({
          where: {
            provider_id: p.user_id,
            date: date,
            time: time,
            status: { [Op.notIn]: ['cancelled', 'rejected'] }
          }
        });

        if (conflict) {
          isAvailableNow = false;
        }
      }

      const basePrice = matchedMapping
        ? (matchedMapping.base_price ?? matchedMapping.custom_price ?? (targetService ? targetService.price : 499))
        : (targetService ? targetService.price : 499);
      const pricingType = matchedMapping ? (matchedMapping.pricing_type || 'fixed') : 'fixed';

      eligibleList.push({
        id: p.id,
        providerProfileId: p.id,
        userId: p.user_id,
        name: p.user?.name || p.business_name,
        businessName: p.business_name,
        category: p.category,
        avatar: p.user?.avatar || '',
        experienceYears: p.experience_years || 1,
        rating: Number(p.rating || 5.0),
        reviewCount: p.review_count || 0,
        completedJobs: Number(pJson.completedJobs || 0),
        bio: p.bio || '',
        serviceArea: pJson.city ? `${pJson.city}` : 'Chennai',
        serviceRadius: Number(p.service_radius || 15),
        distanceKm: null,
        basePrice: Number(basePrice),
        pricingType: pricingType,
        isVerified: p.verification_status === 'verified',
        availabilityStatus: isAvailableNow ? 'AVAILABLE' : (pJson.availabilityStatus || 'BUSY'),
        isAvailable: isAvailableNow,
        compatibilityScore: compatibilityScore,
        offersService: true,
        servicesOffered: (p.providerServices || []).map(ps => ({
          id: ps.service_id,
          title: ps.service?.title || 'Service',
          price: ps.base_price ?? ps.custom_price ?? ps.service?.price ?? 299
        }))
      });
    }

    // Sort: Available now first, rating, completed jobs
    eligibleList.sort((a, b) => {
      const aAvail = a.availabilityStatus === 'AVAILABLE' ? 1 : 0;
      const bAvail = b.availabilityStatus === 'AVAILABLE' ? 1 : 0;
      if (aAvail !== bAvail) return bAvail - aAvail;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.completedJobs - a.completedJobs;
    });

    return sendSuccess(res, eligibleList, 'Available providers retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get provider availability slots for a specific date
// @desc    Get provider availability slots for a specific date
// @route   GET /api/providers/:id/availability or /api/providers/:id/slots
// @access  Public
const getProviderAvailabilitySlots = async (req, res, next) => {
  try {
    const providerId = req.params.id;
    const { date, serviceDuration, serviceId } = req.query;

    if (!date) {
      return sendError(res, 'Date query parameter (YYYY-MM-DD) is required', 400);
    }

    // Resolve provider user ID and profile
    let providerUserId = Number(providerId);
    const profile = await ProviderProfile.findOne({
      where: { [Op.or]: [{ id: providerId }, { user_id: providerId }] }
    });
    if (profile) {
      providerUserId = profile.user_id;
    }

    if (!profile) {
      return sendError(res, 'Provider not found', 404);
    }

    // Determine slot duration in minutes
    let durationMinutes = profile.service_duration || 60;
    if (serviceDuration && !isNaN(Number(serviceDuration))) {
      durationMinutes = Number(serviceDuration);
    } else if (serviceId) {
      const s = await Service.findByPk(serviceId);
      if (s?.duration) {
        const parsedDur = parseInt(s.duration, 10);
        if (!isNaN(parsedDur) && parsedDur > 0) durationMinutes = parsedDur;
      }
    }

    // Check if there is a date-specific daily schedule override
    const dailyOverride = await ProviderDailyAvailability.findOne({
      where: { provider_id: providerUserId, date }
    });

    let effectiveStartTime = '09:00 AM';
    let effectiveEndTime = '06:00 PM';
    let effectiveBusyIntervals = [];
    let isDayOff = false;

    if (dailyOverride) {
      if (dailyOverride.is_day_off || !dailyOverride.is_available) {
        return sendSuccess(res, {
          date,
          providerId: providerUserId,
          workingHours: { start: dailyOverride.start_time, end: dailyOverride.end_time },
          allSlots: [],
          bookedSlots: [],
          availableSlots: [],
          busyIntervals: [],
          isFullyBooked: true,
          isDayOff: true,
          message: 'Provider has marked this date as unavailable / day off.'
        }, 'Provider is off duty on this day');
      }

      effectiveStartTime = dailyOverride.start_time || '09:00 AM';
      effectiveEndTime = dailyOverride.end_time || '06:00 PM';
      effectiveBusyIntervals = Array.isArray(dailyOverride.busy_intervals) ? dailyOverride.busy_intervals : [];
    } else {
      // Use recurring profile defaults
      const dayName = availabilityHelper.getDayNameFromDate(date);
      const workingDays = Array.isArray(profile.working_days)
        ? profile.working_days
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      if (dayName && !workingDays.includes(dayName)) {
        return sendSuccess(res, {
          date,
          providerId: providerUserId,
          workingHours: profile.working_hours || { start: '09:00', end: '18:00' },
          allSlots: [],
          bookedSlots: [],
          availableSlots: [],
          busyIntervals: [],
          isFullyBooked: true,
          isDayOff: true,
          message: `Provider does not take bookings on ${dayName}s.`
        }, 'Provider is off duty on this day');
      }

      const blockedDates = Array.isArray(profile.blocked_dates) ? profile.blocked_dates : [];
      if (blockedDates.includes(date)) {
        return sendSuccess(res, {
          date,
          providerId: providerUserId,
          workingHours: profile.working_hours || { start: '09:00', end: '18:00' },
          allSlots: [],
          bookedSlots: [],
          availableSlots: [],
          busyIntervals: [],
          isFullyBooked: true,
          isDayOff: true,
          message: 'Provider has blocked bookings for this date.'
        }, 'Date is blocked by provider');
      }

      const wh = profile.working_hours || { start: '09:00', end: '18:00' };
      effectiveStartTime = availabilityHelper.standardizeTime(wh.start || '09:00');
      effectiveEndTime = availabilityHelper.standardizeTime(wh.end || '18:00');
      const breaks = Array.isArray(profile.breaks) ? profile.breaks : [];
      effectiveBusyIntervals = breaks.map((b, i) => ({
        id: `break_${i + 1}`,
        start: availabilityHelper.standardizeTime(b.start),
        end: availabilityHelper.standardizeTime(b.end)
      }));
    }

    // Fetch existing confirmed bookings for that date
    const existingBookings = await Booking.findAll({
      where: {
        provider_id: providerUserId,
        date: date,
        status: { [Op.notIn]: ['cancelled', 'rejected'] }
      },
      attributes: ['time', 'status']
    });

    const bookedSlotsList = existingBookings.map((b) => b.time);

    // Check if date is today
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = date === todayStr;
    const nowMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : null;

    const slotResult = availabilityHelper.generateDailySlots({
      startTime: effectiveStartTime,
      endTime: effectiveEndTime,
      slotDurationMinutes: durationMinutes,
      busyIntervals: effectiveBusyIntervals,
      bookedSlots: bookedSlotsList,
      isToday,
      nowMinutes
    });

    // Sanitized busy intervals for customer view (strip private reasons)
    const sanitizedBusyIntervals = effectiveBusyIntervals.map(b => ({
      start: availabilityHelper.standardizeTime(b.start),
      end: availabilityHelper.standardizeTime(b.end)
    }));

    return sendSuccess(res, {
      date,
      providerId: providerUserId,
      workingHours: {
        start: effectiveStartTime,
        end: effectiveEndTime
      },
      allSlots: slotResult.allSlots,
      bookedSlots: slotResult.bookedSlots,
      busySlots: slotResult.busySlots,
      availableSlots: slotResult.availableSlots,
      busyIntervals: sanitizedBusyIntervals,
      isFullyBooked: slotResult.availableSlots.length === 0,
      isDayOff: false
    }, 'Provider availability slots retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get current provider's availability configuration (recurring + daily if date provided)
// @route   GET /api/providers/availability/me or GET /api/providers/availability
// @access  Private (Provider)
const getMyAvailability = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) return sendError(res, 'Provider profile not found', 404);

    const { date, startDate, endDate } = req.query;

    let dailyData = null;
    if (date) {
      dailyData = await ProviderDailyAvailability.findOne({
        where: { provider_id: userId, date }
      });
    }

    let dateRangeSchedules = [];
    if (startDate && endDate) {
      dateRangeSchedules = await ProviderDailyAvailability.findAll({
        where: {
          provider_id: userId,
          date: { [Op.between]: [startDate, endDate] }
        },
        order: [['date', 'ASC']]
      });
    }

    return sendSuccess(res, {
      workingDays: profile.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      workingHours: profile.working_hours || { start: '09:00', end: '18:00' },
      breaks: profile.breaks || [{ start: '13:00', end: '14:00' }],
      blockedDates: profile.blocked_dates || [],
      serviceRadius: profile.service_radius || 15,
      serviceDuration: profile.service_duration || 60,
      isAvailable: profile.availability_status === 'AVAILABLE' || profile.is_available !== false,
      availabilityStatus: profile.availability_status || (profile.is_available ? 'AVAILABLE' : 'OFFLINE'),
      dailySchedule: dailyData ? dailyData.toJSON() : null,
      rangeSchedules: dateRangeSchedules.map(d => d.toJSON())
    }, 'Availability configuration retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get current provider's daily schedule for a specific date (with bookings & customization status)
// @route   GET /api/providers/availability/daily
// @access  Private (Provider)
const getProviderDailySchedule = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { date } = req.query;

    if (!date) {
      return sendError(res, 'Query parameter date (YYYY-MM-DD) is required', 400);
    }

    const profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) return sendError(res, 'Provider profile not found', 404);

    const daily = await ProviderDailyAvailability.findOne({
      where: { provider_id: userId, date }
    });

    const dayName = availabilityHelper.getDayNameFromDate(date);
    const defaultWorkingDays = Array.isArray(profile.working_days)
      ? profile.working_days
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const defaultIsWorkDay = dayName ? defaultWorkingDays.includes(dayName) : true;
    const defaultWh = profile.working_hours || { start: '09:00', end: '18:00' };
    const defaultBreaks = Array.isArray(profile.breaks) ? profile.breaks : [{ start: '13:00', end: '14:00' }];
    const defaultBlockedDates = Array.isArray(profile.blocked_dates) ? profile.blocked_dates : [];
    const isDefaultBlocked = defaultBlockedDates.includes(date);

    // Fetch existing confirmed bookings for that date
    const existingBookings = await Booking.findAll({
      where: {
        provider_id: userId,
        date: date,
        status: { [Op.notIn]: ['cancelled', 'rejected'] }
      },
      include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] }],
      order: [['time', 'ASC']]
    });

    const formattedBookings = existingBookings.map(b => ({
      id: b.id,
      bookingNumber: b.booking_number,
      serviceTitle: b.service_title,
      time: b.time,
      status: b.status,
      customerName: b.customer?.name || 'Customer',
      customerPhone: b.customer?.phone || ''
    }));

    if (daily) {
      return sendSuccess(res, {
        date,
        providerId: userId,
        startTime: daily.start_time,
        endTime: daily.end_time,
        isAvailable: daily.is_available,
        isDayOff: daily.is_day_off,
        busyIntervals: daily.busy_intervals || [],
        notes: daily.notes || '',
        isCustomized: true,
        bookings: formattedBookings,
        serviceDuration: profile.service_duration || 60
      }, 'Daily schedule retrieved');
    }

    // Inherited from weekly defaults
    const initialBusyIntervals = defaultBreaks.map((b, idx) => ({
      id: `break_${idx + 1}`,
      start: availabilityHelper.standardizeTime(b.start),
      end: availabilityHelper.standardizeTime(b.end),
      reason: b.label || b.reason || 'Scheduled Break'
    }));

    return sendSuccess(res, {
      date,
      providerId: userId,
      startTime: availabilityHelper.standardizeTime(defaultWh.start || '09:00'),
      endTime: availabilityHelper.standardizeTime(defaultWh.end || '18:00'),
      isAvailable: !isDefaultBlocked && defaultIsWorkDay,
      isDayOff: isDefaultBlocked || !defaultIsWorkDay,
      busyIntervals: initialBusyIntervals,
      notes: '',
      isCustomized: false,
      bookings: formattedBookings,
      serviceDuration: profile.service_duration || 60
    }, 'Default daily schedule retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Save or update current provider's daily schedule for a specific date
// @route   PUT /api/providers/availability/daily
// @access  Private (Provider)
const saveDailySchedule = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      date,
      startTime,
      endTime,
      isAvailable,
      isDayOff,
      busyIntervals,
      notes,
      force = false
    } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return sendError(res, 'Valid date in YYYY-MM-DD format is required', 400);
    }

    const profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) return sendError(res, 'Provider profile not found', 404);

    const effectiveStartTime = startTime ? availabilityHelper.standardizeTime(startTime) : '09:00 AM';
    const effectiveEndTime = endTime ? availabilityHelper.standardizeTime(endTime) : '06:00 PM';
    const startMin = availabilityHelper.timeToMinutes(effectiveStartTime);
    const endMin = availabilityHelper.timeToMinutes(effectiveEndTime);

    if (startMin === null || endMin === null) {
      return sendError(res, 'Invalid start or end time format', 400);
    }
    if (endMin <= startMin) {
      return sendError(res, 'End time must be later than start time', 400);
    }

    // Validate busy intervals
    const formattedIntervals = [];
    if (Array.isArray(busyIntervals)) {
      for (let i = 0; i < busyIntervals.length; i++) {
        const item = busyIntervals[i];
        const bStart = availabilityHelper.timeToMinutes(item.start || item.startTime);
        const bEnd = availabilityHelper.timeToMinutes(item.end || item.endTime);
        if (bStart === null || bEnd === null || bEnd <= bStart) {
          return sendError(res, `Busy interval #${i + 1} has invalid times (end must be after start).`, 400);
        }
        if (bStart < startMin || bEnd > endMin) {
          return sendError(res, `Busy interval (${availabilityHelper.minutesToTime(bStart)} - ${availabilityHelper.minutesToTime(bEnd)}) must be within working hours (${effectiveStartTime} - ${effectiveEndTime}).`, 400);
        }

        // Check overlap with preceding intervals in the list
        for (const existing of formattedIntervals) {
          const exStart = availabilityHelper.timeToMinutes(existing.start);
          const exEnd = availabilityHelper.timeToMinutes(existing.end);
          if (availabilityHelper.intervalsOverlap(bStart, bEnd, exStart, exEnd)) {
            return sendError(res, `Busy intervals cannot overlap each other (${item.start} - ${item.end} overlaps with ${existing.start} - ${existing.end}).`, 400);
          }
        }

        formattedIntervals.push({
          id: item.id || `bi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          start: availabilityHelper.minutesToTime(bStart),
          end: availabilityHelper.minutesToTime(bEnd),
          reason: (item.reason || '').trim()
        });
      }
    }

    const effectiveIsDayOff = Boolean(isDayOff);
    const effectiveIsAvailable = isAvailable !== undefined ? Boolean(isAvailable) : !effectiveIsDayOff;

    // Conflict Check against confirmed bookings
    if (!force) {
      const conflicts = await availabilityHelper.findConflictingBookings({
        BookingModel: Booking,
        providerUserId: userId,
        date,
        proposedStartTime: effectiveStartTime,
        proposedEndTime: effectiveEndTime,
        isDayOff: effectiveIsDayOff,
        isUnavailable: !effectiveIsAvailable,
        slotDurationMinutes: profile.service_duration || 60
      });

      // Also check if any busy interval conflicts with a confirmed booking
      if (conflicts.length === 0 && formattedIntervals.length > 0) {
        for (const bInt of formattedIntervals) {
          const intConflicts = await availabilityHelper.findConflictingBookings({
            BookingModel: Booking,
            providerUserId: userId,
            date,
            newBusyInterval: bInt,
            slotDurationMinutes: profile.service_duration || 60
          });
          if (intConflicts.length > 0) {
            conflicts.push(...intConflicts);
          }
        }
      }

      if (conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          hasConflict: true,
          conflictingBookings: conflicts,
          message: `This schedule change conflicts with ${conflicts.length} confirmed booking(s). Confirmed bookings cannot be silently cancelled. Please reschedule or resolve the booking first, or adjust your schedule.`
        });
      }
    }

    // Upsert ProviderDailyAvailability
    let [daily] = await ProviderDailyAvailability.findOrCreate({
      where: { provider_id: userId, date },
      defaults: {
        provider_profile_id: profile.id,
        date,
        start_time: effectiveStartTime,
        end_time: effectiveEndTime,
        is_available: effectiveIsAvailable,
        is_day_off: effectiveIsDayOff,
        busy_intervals: formattedIntervals,
        notes: notes || ''
      }
    });

    daily.start_time = effectiveStartTime;
    daily.end_time = effectiveEndTime;
    daily.is_available = effectiveIsAvailable;
    daily.is_day_off = effectiveIsDayOff;
    daily.busy_intervals = formattedIntervals;
    if (notes !== undefined) daily.notes = notes;
    await daily.save();

    // Socket.IO real-time notification
    const io = req.app.get('io');
    if (io) {
      io.emit('provider_availability_updated', {
        providerId: userId,
        date
      });
    }

    return sendSuccess(res, daily.toJSON(), 'Daily schedule saved successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Add a busy interval for a specific date
// @route   POST /api/providers/availability/busy-interval
// @access  Private (Provider)
const addBusyInterval = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { date, start, startTime, end, endTime, reason, force = false } = req.body;

    if (!date) return sendError(res, 'Date is required', 400);

    const sTime = start || startTime;
    const eTime = end || endTime;
    if (!sTime || !eTime) return sendError(res, 'Start time and end time are required', 400);

    const startMin = availabilityHelper.timeToMinutes(sTime);
    const endMin = availabilityHelper.timeToMinutes(eTime);
    if (startMin === null || endMin === null || endMin <= startMin) {
      return sendError(res, 'Invalid interval: end time must be after start time', 400);
    }

    const profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) return sendError(res, 'Provider profile not found', 404);

    let daily = await ProviderDailyAvailability.findOne({ where: { provider_id: userId, date } });
    const wh = daily ? { start: daily.start_time, end: daily.end_time } : (profile.working_hours || { start: '09:00', end: '18:00' });
    const workStartMin = availabilityHelper.timeToMinutes(wh.start);
    const workEndMin = availabilityHelper.timeToMinutes(wh.end);

    if (workStartMin !== null && workEndMin !== null && (startMin < workStartMin || endMin > workEndMin)) {
      return sendError(res, `Interval must fall within working hours (${wh.start} - ${wh.end})`, 400);
    }

    const currentIntervals = daily?.busy_intervals || (Array.isArray(profile.breaks) ? profile.breaks.map((b, i) => ({ id: `brk_${i}`, start: b.start, end: b.end, reason: 'Break' })) : []);

    // Check overlap with existing intervals
    for (const item of currentIntervals) {
      const iStart = availabilityHelper.timeToMinutes(item.start);
      const iEnd = availabilityHelper.timeToMinutes(item.end);
      if (availabilityHelper.intervalsOverlap(startMin, endMin, iStart, iEnd)) {
        return sendError(res, `Interval overlaps with existing busy time (${item.start} - ${item.end})`, 400);
      }
    }

    const newInterval = {
      id: `bi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      start: availabilityHelper.minutesToTime(startMin),
      end: availabilityHelper.minutesToTime(endMin),
      reason: (reason || '').trim()
    };

    // Check conflict with confirmed bookings
    if (!force) {
      const conflicts = await availabilityHelper.findConflictingBookings({
        BookingModel: Booking,
        providerUserId: userId,
        date,
        newBusyInterval: newInterval,
        slotDurationMinutes: profile.service_duration || 60
      });

      if (conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          hasConflict: true,
          conflictingBookings: conflicts,
          message: `This busy interval conflicts with confirmed booking #${conflicts[0].bookingNumber} at ${conflicts[0].time}. Confirmed bookings cannot be silently cancelled.`
        });
      }
    }

    if (!daily) {
      daily = await ProviderDailyAvailability.create({
        provider_id: userId,
        provider_profile_id: profile.id,
        date,
        start_time: availabilityHelper.standardizeTime(wh.start),
        end_time: availabilityHelper.standardizeTime(wh.end),
        is_available: true,
        is_day_off: false,
        busy_intervals: [...currentIntervals, newInterval]
      });
    } else {
      daily.busy_intervals = [...currentIntervals, newInterval];
      await daily.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('provider_availability_updated', { providerId: userId, date });
    }

    return sendSuccess(res, { daily: daily.toJSON(), interval: newInterval }, 'Busy interval added successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Update a specific busy interval
// @route   PUT /api/providers/availability/busy-interval/:intervalId
// @access  Private (Provider)
const updateBusyInterval = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { intervalId } = req.params;
    const { date, start, startTime, end, endTime, reason, force = false } = req.body;

    if (!date) return sendError(res, 'Date is required', 400);

    const sTime = start || startTime;
    const eTime = end || endTime;
    if (!sTime || !eTime) return sendError(res, 'Start time and end time are required', 400);

    const startMin = availabilityHelper.timeToMinutes(sTime);
    const endMin = availabilityHelper.timeToMinutes(eTime);
    if (startMin === null || endMin === null || endMin <= startMin) {
      return sendError(res, 'Invalid interval: end time must be after start time', 400);
    }

    const profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) return sendError(res, 'Provider profile not found', 404);

    let daily = await ProviderDailyAvailability.findOne({ where: { provider_id: userId, date } });
    if (!daily) return sendError(res, 'No daily availability record found for this date', 404);

    const currentIntervals = daily.busy_intervals || [];
    const targetIdx = currentIntervals.findIndex(item => String(item.id) === String(intervalId));
    if (targetIdx === -1) return sendError(res, 'Busy interval not found', 404);

    // Overlap check with other intervals (excluding itself)
    for (let i = 0; i < currentIntervals.length; i++) {
      if (i === targetIdx) continue;
      const other = currentIntervals[i];
      const oStart = availabilityHelper.timeToMinutes(other.start);
      const oEnd = availabilityHelper.timeToMinutes(other.end);
      if (availabilityHelper.intervalsOverlap(startMin, endMin, oStart, oEnd)) {
        return sendError(res, `Interval overlaps with another busy period (${other.start} - ${other.end})`, 400);
      }
    }

    const updatedInterval = {
      id: intervalId,
      start: availabilityHelper.minutesToTime(startMin),
      end: availabilityHelper.minutesToTime(endMin),
      reason: (reason || '').trim()
    };

    // Conflict check
    if (!force) {
      const conflicts = await availabilityHelper.findConflictingBookings({
        BookingModel: Booking,
        providerUserId: userId,
        date,
        newBusyInterval: updatedInterval,
        slotDurationMinutes: profile.service_duration || 60
      });

      if (conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          hasConflict: true,
          conflictingBookings: conflicts,
          message: `This updated interval conflicts with confirmed booking #${conflicts[0].bookingNumber} at ${conflicts[0].time}.`
        });
      }
    }

    currentIntervals[targetIdx] = updatedInterval;
    daily.busy_intervals = currentIntervals;
    await daily.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('provider_availability_updated', { providerId: userId, date });
    }

    return sendSuccess(res, { daily: daily.toJSON(), interval: updatedInterval }, 'Busy interval updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a busy interval
// @route   DELETE /api/providers/availability/busy-interval/:intervalId
// @access  Private (Provider)
const deleteBusyInterval = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { intervalId } = req.params;
    const { date } = req.query;

    if (!date) return sendError(res, 'Query parameter date is required', 400);

    const daily = await ProviderDailyAvailability.findOne({ where: { provider_id: userId, date } });
    if (!daily) return sendError(res, 'No custom schedule found for this date', 404);

    const currentIntervals = daily.busy_intervals || [];
    const updated = currentIntervals.filter(item => String(item.id) !== String(intervalId));

    daily.busy_intervals = updated;
    await daily.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('provider_availability_updated', { providerId: userId, date });
    }

    return sendSuccess(res, daily.toJSON(), 'Busy interval deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Quick Action Availability Update (sudden work, rest of today, day off, restore)
// @route   POST /api/providers/availability/quick-action
// @access  Private (Provider)
const quickActionAvailability = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { action, date, startTime, endTime, reason, force = false } = req.body;

    const profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) return sendError(res, 'Provider profile not found', 404);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const targetDate = date || todayStr;

    let daily = await ProviderDailyAvailability.findOne({ where: { provider_id: userId, date: targetDate } });

    if (action === 'unavailable_rest_of_today') {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const wh = daily ? { start: daily.start_time, end: daily.end_time } : (profile.working_hours || { start: '09:00', end: '18:00' });
      const workEndMin = availabilityHelper.timeToMinutes(wh.end) || 1080;

      // Start from next 15-minute block
      const blockStartMin = Math.ceil(nowMin / 15) * 15;

      if (blockStartMin >= workEndMin) {
        return sendError(res, 'Working hours for today have already concluded.', 400);
      }

      const blockInterval = {
        id: `rest_today_${Date.now()}`,
        start: availabilityHelper.minutesToTime(blockStartMin),
        end: availabilityHelper.minutesToTime(workEndMin),
        reason: (reason || 'Unavailable for rest of today').trim()
      };

      if (!force) {
        const conflicts = await availabilityHelper.findConflictingBookings({
          BookingModel: Booking,
          providerUserId: userId,
          date: todayStr,
          newBusyInterval: blockInterval,
          slotDurationMinutes: profile.service_duration || 60
        });

        if (conflicts.length > 0) {
          return res.status(409).json({
            success: false,
            hasConflict: true,
            conflictingBookings: conflicts,
            message: `Cannot mark rest of today unavailable: You have confirmed booking #${conflicts[0].bookingNumber} at ${conflicts[0].time}. Please complete or reschedule existing jobs.`
          });
        }
      }

      const currentIntervals = daily?.busy_intervals || [];
      if (!daily) {
        daily = await ProviderDailyAvailability.create({
          provider_id: userId,
          provider_profile_id: profile.id,
          date: todayStr,
          start_time: availabilityHelper.standardizeTime(wh.start),
          end_time: availabilityHelper.standardizeTime(wh.end),
          is_available: true,
          is_day_off: false,
          busy_intervals: [...currentIntervals, blockInterval]
        });
      } else {
        daily.busy_intervals = [...currentIntervals, blockInterval];
        await daily.save();
      }

      const io = req.app.get('io');
      if (io) io.emit('provider_availability_updated', { providerId: userId, date: todayStr });

      return sendSuccess(res, daily.toJSON(), 'Remaining part of today marked unavailable');
    }

    if (action === 'mark_day_off') {
      if (!force) {
        const conflicts = await availabilityHelper.findConflictingBookings({
          BookingModel: Booking,
          providerUserId: userId,
          date: targetDate,
          isDayOff: true,
          slotDurationMinutes: profile.service_duration || 60
        });

        if (conflicts.length > 0) {
          return res.status(409).json({
            success: false,
            hasConflict: true,
            conflictingBookings: conflicts,
            message: `Cannot mark this date as a day off: You have ${conflicts.length} confirmed booking(s) scheduled for this day.`
          });
        }
      }

      const wh = daily ? { start: daily.start_time, end: daily.end_time } : (profile.working_hours || { start: '09:00', end: '18:00' });
      if (!daily) {
        daily = await ProviderDailyAvailability.create({
          provider_id: userId,
          provider_profile_id: profile.id,
          date: targetDate,
          start_time: availabilityHelper.standardizeTime(wh.start),
          end_time: availabilityHelper.standardizeTime(wh.end),
          is_available: false,
          is_day_off: true,
          busy_intervals: daily?.busy_intervals || []
        });
      } else {
        daily.is_day_off = true;
        daily.is_available = false;
        await daily.save();
      }

      const io = req.app.get('io');
      if (io) io.emit('provider_availability_updated', { providerId: userId, date: targetDate });

      return sendSuccess(res, daily.toJSON(), `Date ${targetDate} marked as day off`);
    }

    if (action === 'mark_day_available') {
      const wh = daily ? { start: daily.start_time, end: daily.end_time } : (profile.working_hours || { start: '09:00', end: '18:00' });
      if (!daily) {
        daily = await ProviderDailyAvailability.create({
          provider_id: userId,
          provider_profile_id: profile.id,
          date: targetDate,
          start_time: availabilityHelper.standardizeTime(wh.start),
          end_time: availabilityHelper.standardizeTime(wh.end),
          is_available: true,
          is_day_off: false,
          busy_intervals: []
        });
      } else {
        daily.is_day_off = false;
        daily.is_available = true;
        await daily.save();
      }

      const io = req.app.get('io');
      if (io) io.emit('provider_availability_updated', { providerId: userId, date: targetDate });

      return sendSuccess(res, daily.toJSON(), `Date ${targetDate} marked available`);
    }

    if (action === 'restore_availability') {
      if (daily) {
        await daily.destroy();
      }

      const io = req.app.get('io');
      if (io) io.emit('provider_availability_updated', { providerId: userId, date: targetDate });

      return sendSuccess(res, { restored: true, date: targetDate }, `Default weekly availability restored for ${targetDate}`);
    }

    if (action === 'block_time') {
      if (!startTime || !endTime) {
        return sendError(res, 'Start time and end time are required to block time', 400);
      }
      return addBusyInterval(req, res, next);
    }

    return sendError(res, `Unknown quick action: ${action}`, 400);
  } catch (error) {
    next(error);
  }
};

// @desc    Restore default availability for a specific date (removes date override)
// @route   DELETE /api/providers/availability/daily
// @access  Private (Provider)
const restoreDailyAvailability = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { date } = req.query;

    if (!date) return sendError(res, 'Query parameter date (YYYY-MM-DD) is required', 400);

    const daily = await ProviderDailyAvailability.findOne({ where: { provider_id: userId, date } });
    if (daily) {
      await daily.destroy();
    }

    const io = req.app.get('io');
    if (io) io.emit('provider_availability_updated', { providerId: userId, date });

    return sendSuccess(res, { restored: true, date }, `Availability restored to default for ${date}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update current provider's availability configuration (weekly defaults)
// @route   PUT /api/providers/availability
// @access  Private (Provider)
const updateAvailability = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    let profile = await ProviderProfile.findOne({ where: { user_id: userId } });
    if (!profile) return sendError(res, 'Provider profile not found', 404);

    const {
      workingDays,
      workingHours,
      breaks,
      blockedDates,
      serviceRadius,
      serviceDuration,
      isAvailable,
      availabilityStatus,
      working_days,
      working_hours,
      service_radius,
      service_duration
    } = req.body;

    const effWorkingDays = workingDays || working_days;
    const effWorkingHours = workingHours || working_hours;
    const effServiceRadius = serviceRadius || service_radius;
    const effServiceDuration = serviceDuration || service_duration;

    if (effWorkingDays !== undefined && Array.isArray(effWorkingDays)) profile.working_days = effWorkingDays;
    if (effWorkingHours !== undefined && typeof effWorkingHours === 'object') profile.working_hours = effWorkingHours;
    if (breaks !== undefined && Array.isArray(breaks)) profile.breaks = breaks;
    if (blockedDates !== undefined && Array.isArray(blockedDates)) profile.blocked_dates = blockedDates;
    if (effServiceRadius !== undefined) {
      const rad = Number(effServiceRadius);
      if (rad >= 1 && rad <= 100) {
        profile.service_radius = rad;
        profile.service_radius_km = rad;
      }
    }
    if (effServiceDuration !== undefined) profile.service_duration = Number(effServiceDuration);

    // Active booking check to strictly enforce BUSY
    const activeBookingsCount = await Booking.count({
      where: {
        provider_id: userId,
        status: { [Op.in]: ['accepted', 'on_the_way', 'arrived', 'in_progress'] }
      }
    });

    const targetStatus = availabilityStatus
      ? String(availabilityStatus).trim().toUpperCase()
      : (isAvailable !== undefined ? (isAvailable ? 'AVAILABLE' : 'OFFLINE') : null);

    if (activeBookingsCount > 0) {
      profile.availability_status = 'BUSY';
      profile.is_available = false;
      if (targetStatus === 'AVAILABLE') {
        return sendError(res, 'Cannot set status to AVAILABLE while you have an active booking in progress.', 400);
      }
    } else if (targetStatus) {
      if (targetStatus === 'OFFLINE') {
        profile.availability_status = 'OFFLINE';
        profile.is_available = false;
      } else if (targetStatus === 'AVAILABLE') {
        if (!profile.is_approved || profile.is_active === false) {
          return sendError(res, 'Cannot set status to AVAILABLE while your profile is pending administrator approval or inactive.', 400);
        }
        profile.availability_status = 'AVAILABLE';
        profile.is_available = true;
      }
    }

    await profile.save();

    return sendSuccess(res, {
      workingDays: profile.working_days,
      workingHours: profile.working_hours,
      breaks: profile.breaks,
      blockedDates: profile.blocked_dates,
      serviceRadius: profile.service_radius,
      serviceDuration: profile.service_duration,
      isAvailable: profile.availability_status === 'AVAILABLE',
      availabilityStatus: profile.availability_status
    }, 'Availability configuration updated successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProviders,
  getProviderById,
  getMyProviderProfile,
  updateMyProviderProfile,
  updateLiveLocation,
  getProviderStats,
  getProviderServices,
  updateServicePricing,
  addServiceToProvider,
  removeServiceFromProvider,
  getAvailableProviders,
  getNearbyProviders,
  getRecommendedProvidersHandler,
  getProviderAvailabilitySlots,
  getMyAvailability,
  getProviderDailySchedule,
  saveDailySchedule,
  addBusyInterval,
  updateBusyInterval,
  deleteBusyInterval,
  quickActionAvailability,
  restoreDailyAvailability,
  updateAvailability
};

