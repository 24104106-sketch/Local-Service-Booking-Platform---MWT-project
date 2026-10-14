const { Op } = require('sequelize');
const { Community, Booking } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Great-circle distance helper (Haversine formula in km)
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

// @desc    Get all communities (Public / Customer)
// @route   GET /api/communities
// @access  Public
const getAllCommunities = async (req, res, next) => {
  try {
    const { search, city, area, activeOnly, latitude, longitude } = req.query;
    const where = {};

    // By default, customer sees active communities unless explicitly set to false
    if (activeOnly !== 'false') {
      where.is_active = true;
    }

    if (city) {
      where.city = { [Op.like]: `%${city.trim()}%` };
    }

    if (area) {
      where.area = { [Op.like]: `%${area.trim()}%` };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { address: { [Op.like]: `%${q}%` } },
        { area: { [Op.like]: `%${q}%` } },
        { city: { [Op.like]: `%${q}%` } },
        { pincode: { [Op.like]: `%${q}%` } }
      ];
    }

    const communities = await Community.findAll({
      where,
      order: [['name', 'ASC']]
    });

    let results = communities.map((c) => c.toJSON());

    // If client supplied GPS, attach distance in km and sort by nearest
    if (latitude != null && longitude != null && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
      const uLat = Number(latitude);
      const uLng = Number(longitude);
      results = results.map((c) => {
        const dist = calculateHaversineDistance(uLat, uLng, c.latitude, c.longitude);
        return {
          ...c,
          distanceKm: dist
        };
      });
      results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }

    return sendSuccess(res, results, 'Communities retrieved successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get single community by ID
// @route   GET /api/communities/:id
// @access  Public
const getCommunityById = async (req, res, next) => {
  try {
    const community = await Community.findByPk(req.params.id);
    if (!community) {
      return sendError(res, 'Community not found', 404);
    }
    return sendSuccess(res, community.toJSON(), 'Community retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Create new community (Admin)
// @route   POST /api/admin/communities
// @access  Private (Admin)
const createCommunity = async (req, res, next) => {
  try {
    const { name, address, latitude, longitude, city, area, pincode, is_active, isActive } = req.body;

    if (!name || !address || latitude == null || longitude == null) {
      return sendError(res, 'Name, address, latitude, and longitude are required.', 400);
    }

    const numLat = Number(latitude);
    const numLng = Number(longitude);

    if (isNaN(numLat) || numLat < -90 || numLat > 90) {
      return sendError(res, 'Latitude must be a valid number between -90 and 90.', 400);
    }
    if (isNaN(numLng) || numLng < -180 || numLng > 180) {
      return sendError(res, 'Longitude must be a valid number between -180 and 180.', 400);
    }

    const community = await Community.create({
      name: name.trim(),
      address: address.trim(),
      latitude: numLat,
      longitude: numLng,
      city: (city || 'Chennai').trim(),
      area: (area || '').trim(),
      pincode: (pincode || '').trim(),
      is_active: isActive !== undefined ? Boolean(isActive) : (is_active !== undefined ? Boolean(is_active) : true)
    });

    return sendSuccess(res, community.toJSON(), 'Community created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update community (Admin)
// @route   PUT /api/admin/communities/:id
// @access  Private (Admin)
const updateCommunity = async (req, res, next) => {
  try {
    const community = await Community.findByPk(req.params.id);
    if (!community) {
      return sendError(res, 'Community not found', 404);
    }

    const { name, address, latitude, longitude, city, area, pincode, is_active, isActive } = req.body;

    if (name !== undefined) community.name = name.trim();
    if (address !== undefined) community.address = address.trim();

    if (latitude !== undefined) {
      const numLat = Number(latitude);
      if (isNaN(numLat) || numLat < -90 || numLat > 90) {
        return sendError(res, 'Latitude must be between -90 and 90.', 400);
      }
      community.latitude = numLat;
    }

    if (longitude !== undefined) {
      const numLng = Number(longitude);
      if (isNaN(numLng) || numLng < -180 || numLng > 180) {
        return sendError(res, 'Longitude must be between -180 and 180.', 400);
      }
      community.longitude = numLng;
    }

    if (city !== undefined) community.city = city.trim();
    if (area !== undefined) community.area = area.trim();
    if (pincode !== undefined) community.pincode = pincode.trim();
    if (isActive !== undefined) community.is_active = Boolean(isActive);
    if (is_active !== undefined) community.is_active = Boolean(is_active);

    await community.save();

    return sendSuccess(res, community.toJSON(), 'Community updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle community active status (Admin)
// @route   PUT /api/admin/communities/:id/status
// @access  Private (Admin)
const toggleCommunityStatus = async (req, res, next) => {
  try {
    const community = await Community.findByPk(req.params.id);
    if (!community) {
      return sendError(res, 'Community not found', 404);
    }

    const { isActive, is_active } = req.body;
    if (isActive !== undefined) {
      community.is_active = Boolean(isActive);
    } else if (is_active !== undefined) {
      community.is_active = Boolean(is_active);
    } else {
      community.is_active = !community.is_active;
    }

    await community.save();

    return sendSuccess(res, community.toJSON(), `Community is now ${community.is_active ? 'active' : 'inactive'}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete community (Admin)
// @route   DELETE /api/admin/communities/:id
// @access  Private (Admin)
const deleteCommunity = async (req, res, next) => {
  try {
    const community = await Community.findByPk(req.params.id);
    if (!community) {
      return sendError(res, 'Community not found', 404);
    }

    // Check if bookings are associated with this community
    const associatedBookings = await Booking.count({ where: { community_id: community.id } });
    if (associatedBookings > 0) {
      // Soft-deactivate if bookings exist to preserve integrity
      community.is_active = false;
      await community.save();
      return sendSuccess(res, { deactivated: true, community: community.toJSON() }, 'Community has active booking history and was deactivated instead of deleted.');
    }

    await community.destroy();
    return sendSuccess(res, null, 'Community deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCommunities,
  getCommunityById,
  createCommunity,
  updateCommunity,
  toggleCommunityStatus,
  deleteCommunity
};
