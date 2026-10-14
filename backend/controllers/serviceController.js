const { Op } = require('sequelize');
const { Service, ProviderProfile, User, sequelize } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

// @desc    Get all active services with optional search & category filter
// @route   GET /api/services
// @access  Public
const getAllServices = async (req, res, next) => {
  try {
    const { category, search, minPrice, maxPrice, sort } = req.query;
    const where = { is_active: true };

    if (category && category.toLowerCase() !== 'all') {
      const { getCanonicalCategory, getCategoryAliases } = require('../utils/categoryNormalizer');
      const canonical = getCanonicalCategory(category) || category;
      const aliases = getCategoryAliases(canonical);
      where.category = { [Op.in]: aliases };
    }

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } }
      ];
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = Number(minPrice);
      if (maxPrice) where.price[Op.lte] = Number(maxPrice);
    }

    let order = [['featured', 'DESC'], ['created_at', 'DESC']];
    if (sort === 'price_asc') order = [['price', 'ASC']];
    else if (sort === 'price_desc') order = [['price', 'DESC']];
    else if (sort === 'rating') order = [['rating', 'DESC']];

    const services = await Service.findAll({
      where,
      include: [
        {
          model: ProviderProfile,
          as: 'providers',
          through: { attributes: ['custom_price'] },
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'phone', 'avatar', 'city']
          }]
        }
      ],
      order
    });

    const formatted = services.map((s) => {
      const json = s.toJSON();
      const primaryProvider = json.providers?.[0];
      const customPrice = primaryProvider?.ProviderService?.custom_price;
      const finalPrice = customPrice != null ? customPrice : json.price;
      return {
        ...json,
        name: json.title,
        price: finalPrice,
        provider: primaryProvider?.business_name || primaryProvider?.user?.name || 'FixIt Verified',
        providerName: primaryProvider?.user?.name,
        providerEmail: primaryProvider?.user?.email,
        providerId: primaryProvider?.id,
        providerUserId: primaryProvider?.user?.id,
        rating: json.rating || primaryProvider?.rating || 4.8,
        duration: json.duration || '45–60 min',
        status: json.is_active ? 'Active' : 'Inactive'
      };
    });

    return sendSuccess(res, formatted, 'Services retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get single service by ID
// @route   GET /api/services/:id
// @access  Public
const getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findByPk(req.params.id, {
      include: [
        {
          model: ProviderProfile,
          as: 'providers',
          through: { attributes: ['custom_price'] },
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'phone', 'avatar', 'city']
          }]
        }
      ]
    });
    if (!service) {
      return sendError(res, 'Service not found', 404);
    }
    const json = service.toJSON();
    const primaryProvider = json.providers?.[0];
    const customPrice = primaryProvider?.ProviderService?.custom_price;
    const finalPrice = customPrice != null ? customPrice : json.price;
    const formatted = {
      ...json,
      name: json.title,
      price: finalPrice,
      provider: primaryProvider?.business_name || primaryProvider?.user?.name || 'FixIt Verified',
      providerName: primaryProvider?.user?.name,
      providerEmail: primaryProvider?.user?.email,
      providerId: primaryProvider?.id,
      providerUserId: primaryProvider?.user?.id,
      rating: json.rating || primaryProvider?.rating || 4.8,
      duration: json.duration || '45–60 min',
      status: json.is_active ? 'Active' : 'Inactive'
    };
    return sendSuccess(res, formatted, 'Service retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get list of unique service categories
// @route   GET /api/services/categories
// @access  Public
const getCategories = async (req, res, next) => {
  try {
    const { getCanonicalCategory, isTestCategory, CANONICAL_CATEGORIES } = require('../utils/categoryNormalizer');

    const services = await Service.findAll({
      attributes: ['id', 'category'],
      where: { is_active: true }
    });

    const categoryCounts = {};
    // Seed standard canonical categories
    CANONICAL_CATEGORIES.forEach(cat => {
      categoryCounts[cat] = 0;
    });

    services.forEach(s => {
      if (s.category && !isTestCategory(s.category)) {
        const canonical = getCanonicalCategory(s.category);
        if (canonical) {
          categoryCounts[canonical] = (categoryCounts[canonical] || 0) + 1;
        }
      }
    });

    const result = Object.entries(categoryCounts).map(([name, count]) => ({
      name,
      count
    }));

    return sendSuccess(res, result, 'Categories retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new service
// @route   POST /api/services
// @access  Private (Admin)
const createService = async (req, res, next) => {
  try {
    const { title, category, description, price, unit, duration, icon, image, featured, tags } = req.body;
    if (!title || !category || !description || !price) {
      return sendError(res, 'Please provide title, category, description, and price', 400);
    }

    const service = await Service.create({
      title: title.trim(),
      category: category.trim(),
      description,
      price: Number(price),
      unit: unit || 'per visit',
      duration: duration || '1-2 hrs',
      icon: icon || 'Wrench',
      image: image || '',
      featured: Boolean(featured),
      tags: Array.isArray(tags) ? tags : []
    });

    return sendSuccess(res, service.toJSON(), 'Service created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update an existing service
// @route   PUT /api/services/:id
// @access  Private (Admin)
const updateService = async (req, res, next) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) {
      return sendError(res, 'Service not found', 404);
    }

    const { title, category, description, price, unit, duration, icon, image, featured, tags, isActive } = req.body;

    if (title !== undefined) service.title = title.trim();
    if (category !== undefined) service.category = category.trim();
    if (description !== undefined) service.description = description;
    if (price !== undefined) service.price = Number(price);
    if (unit !== undefined) service.unit = unit;
    if (duration !== undefined) service.duration = duration;
    if (icon !== undefined) service.icon = icon;
    if (image !== undefined) service.image = image;
    if (featured !== undefined) service.featured = Boolean(featured);
    if (tags !== undefined) service.tags = Array.isArray(tags) ? tags : service.tags;
    if (isActive !== undefined) service.is_active = Boolean(isActive);

    await service.save();

    return sendSuccess(res, service.toJSON(), 'Service updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a service
// @route   DELETE /api/services/:id
// @access  Private (Admin)
const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) {
      return sendError(res, 'Service not found', 404);
    }
    await service.destroy();
    return sendSuccess(res, null, 'Service deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllServices,
  getServiceById,
  getCategories,
  createService,
  updateService,
  deleteService
};
