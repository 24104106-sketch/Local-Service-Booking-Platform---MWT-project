const { Op } = require('sequelize');
const { RecentlyAccessed, Service, ProviderProfile, User } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @desc    Get recently accessed services and providers for authenticated user
 * @route   GET /api/recently-accessed
 * @access  Private
 */
const getRecentlyAccessed = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 20);

    const records = await RecentlyAccessed.findAll({
      where: { user_id: userId },
      order: [['accessed_at', 'DESC']],
      limit
    });

    if (!records || records.length === 0) {
      return sendSuccess(res, [], 'No recently accessed items found');
    }

    // Populate service and provider details safely
    const populated = [];

    for (const record of records) {
      const plain = record.toJSON();

      if (plain.item_type === 'service') {
        const service = await Service.findByPk(plain.item_id);
        // Only return if service exists and is active
        if (service && service.is_active !== false) {
          populated.push({
            id: plain.id,
            itemType: 'service',
            itemId: plain.item_id,
            accessedAt: plain.accessed_at,
            service: {
              id: service.id,
              title: service.title,
              category: service.category,
              description: service.description,
              price: service.price,
              unit: service.unit,
              rating: service.rating,
              reviewsCount: service.reviews_count,
              icon: service.icon,
              featured: service.featured
            }
          });
        }
      } else if (plain.item_type === 'provider') {
        const providerProfile = await ProviderProfile.findOne({
          where: {
            [Op.or]: [
              { id: plain.item_id },
              { user_id: plain.item_id }
            ],
            is_active: { [Op.ne]: false }
          },
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'phone', 'avatar', 'city', 'status']
          }]
        });

        // Only return if provider exists, is active, and is approved
        if (providerProfile && providerProfile.user && providerProfile.user.status === 'active') {
          populated.push({
            id: plain.id,
            itemType: 'provider',
            itemId: plain.item_id,
            accessedAt: plain.accessed_at,
            provider: {
              id: providerProfile.id,
              userId: providerProfile.user_id,
              name: providerProfile.user?.name || providerProfile.business_name,
              businessName: providerProfile.business_name,
              category: providerProfile.category,
              avatar: providerProfile.user?.avatar || '',
              rating: providerProfile.rating,
              reviewCount: providerProfile.review_count,
              completedJobs: providerProfile.completed_jobs,
              isAvailable: providerProfile.is_available,
              availabilityStatus: providerProfile.availability_status || (providerProfile.is_available ? 'AVAILABLE' : 'OFFLINE'),
              isVerified: providerProfile.verification_status === 'verified' || providerProfile.is_approved === true
            }
          });
        }
      }
    }

    return sendSuccess(res, populated, 'Recently accessed items retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record access to a service or provider (upsert: update accessed_at if exists)
 * @route   POST /api/recently-accessed
 * @access  Private
 */
const recordRecentlyAccessed = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { itemType, itemId, metadata } = req.body;

    if (!itemType || !['service', 'provider'].includes(String(itemType).toLowerCase().trim())) {
      return sendError(res, "Valid itemType ('service' or 'provider') is required", 400);
    }

    const resolvedItemType = String(itemType).toLowerCase().trim();
    const resolvedItemId = parseInt(itemId, 10);

    if (isNaN(resolvedItemId) || resolvedItemId <= 0) {
      return sendError(res, 'Valid numeric itemId is required', 400);
    }

    // Verify referenced item exists before recording
    if (resolvedItemType === 'service') {
      const service = await Service.findByPk(resolvedItemId);
      if (!service) {
        return sendError(res, 'Referenced service not found', 404);
      }
    } else if (resolvedItemType === 'provider') {
      const provider = await ProviderProfile.findOne({
        where: {
          [Op.or]: [
            { id: resolvedItemId },
            { user_id: resolvedItemId }
          ]
        }
      });
      if (!provider) {
        return sendError(res, 'Referenced provider not found', 404);
      }
    }

    // Check if an existing record exists for this user + itemType + itemId
    const existing = await RecentlyAccessed.findOne({
      where: {
        user_id: userId,
        item_type: resolvedItemType,
        item_id: resolvedItemId
      }
    });

    const now = new Date();

    if (existing) {
      // Update existing record timestamp instead of duplicating
      existing.accessed_at = now;
      if (metadata && typeof metadata === 'object') {
        existing.metadata = { ...existing.metadata, ...metadata };
      }
      await existing.save();

      return sendSuccess(res, existing.toJSON(), 'Recently accessed record timestamp updated');
    }

    // Create new entry
    const created = await RecentlyAccessed.create({
      user_id: userId,
      item_type: resolvedItemType,
      item_id: resolvedItemId,
      accessed_at: now,
      metadata: metadata && typeof metadata === 'object' ? metadata : {}
    });

    return sendSuccess(res, created.toJSON(), 'Recently accessed record created', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Clear recently accessed history for authenticated user
 * @route   DELETE /api/recently-accessed/:id?
 * @access  Private
 */
const clearRecentlyAccessed = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    if (id) {
      const deletedCount = await RecentlyAccessed.destroy({
        where: {
          id: parseInt(id, 10),
          user_id: userId
        }
      });
      if (deletedCount === 0) {
        return sendError(res, 'Recently accessed record not found or unauthorized', 404);
      }
      return sendSuccess(res, null, 'Recently accessed record removed');
    }

    await RecentlyAccessed.destroy({
      where: { user_id: userId }
    });

    return sendSuccess(res, null, 'Recently accessed history cleared successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRecentlyAccessed,
  recordRecentlyAccessed,
  clearRecentlyAccessed
};
