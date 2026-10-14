const { Op } = require('sequelize');
const {
  User,
  ProviderProfile,
  Booking,
  Service,
  Complaint,
  Wallet,
  WalletTransaction,
  Notification,
  PasswordResetToken,
  ChatbotHistory,
  Review,
  ProviderService
} = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

// @desc    Get overall admin dashboard metrics
// @route   GET /api/admin/metrics
// @access  Private (Admin)
const getDashboardMetrics = async (req, res, next) => {
  try {
    const totalUsers = await User.count();
    const customerCount = await User.count({ where: { role: 'customer' } });
    const providerCount = await User.count({ where: { role: 'provider' } });

    const totalBookings = await Booking.count();
    const completedBookings = await Booking.count({ where: { status: 'completed' } });
    const activeBookings = await Booking.count({
      where: {
        status: { [Op.in]: ['confirmed', 'provider_assigned', 'on_the_way', 'arrived', 'in_progress'] }
      }
    });
    const cancelledBookings = await Booking.count({ where: { status: 'cancelled' } });

    const completedBookingsList = await Booking.findAll({
      where: { status: 'completed' },
      attributes: ['amount']
    });
    const totalRevenue = completedBookingsList.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);

    const activeServices = await Service.count({ where: { is_active: true } });
    const openComplaints = await Complaint.count({
      where: { status: { [Op.in]: ['open', 'investigating'] } }
    });
    const pendingApprovals = await ProviderProfile.count({
      where: { verification_status: 'pending' }
    });

    // Recent 5 bookings
    const recentBookings = await Booking.findAll({
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'provider', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']],
      limit: 5
    });

    return sendSuccess(res, {
      totalUsers,
      activeProviders: providerCount,
      totalBookings,
      totalRevenue,
      users: {
        total: totalUsers,
        customers: customerCount,
        providers: providerCount
      },
      bookings: {
        total: totalBookings,
        completed: completedBookings,
        active: activeBookings,
        cancelled: cancelledBookings
      },
      revenue: {
        total: totalRevenue,
        platformFee: Math.round(totalRevenue * 0.1)
      },
      servicesCount: activeServices,
      openComplaints,
      pendingApprovals,
      recentBookings: recentBookings.map(b => b.toJSON())
    }, 'Admin metrics retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users with search, role and status filter
// @route   GET /api/admin/users
// @access  Private (Admin)
const getAllUsers = async (req, res, next) => {
  try {
    const { role, status, search } = req.query;
    const where = {};

    if (role && role !== 'all') where.role = role;
    if (status && status !== 'all') where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    const users = await User.findAll({
      where,
      include: [
        {
          model: ProviderProfile,
          as: 'providerProfile',
          include: [
            {
              model: Service,
              as: 'servicesOffered',
              attributes: ['id', 'title', 'category', 'price']
            }
          ]
        },
        {
          model: Wallet,
          as: 'wallet',
          attributes: ['balance']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const usersWithStats = await Promise.all(users.map(async (u) => {
      const userJson = u.toJSON();
      if (u.role === 'customer') {
        userJson.bookingCount = await Booking.count({ where: { customer_id: u.id } });
      } else if (u.role === 'provider') {
        userJson.bookingCount = await Booking.count({ where: { provider_id: u.id } });
      } else {
        userJson.bookingCount = 0;
      }
      return userJson;
    }));

    return sendSuccess(res, usersWithStats, 'Users retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed user profile and stats
// @route   GET /api/admin/users/:id
// @access  Private (Admin)
const getUserDetails = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [
        {
          model: ProviderProfile,
          as: 'providerProfile',
          include: [
            {
              model: Service,
              as: 'servicesOffered'
            }
          ]
        },
        {
          model: Wallet,
          as: 'wallet'
        }
      ]
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const userJson = user.toJSON();

    let totalBookings = 0;
    let completedBookings = 0;
    let cancelledBookings = 0;
    let recentBookings = [];

    if (user.role === 'customer') {
      totalBookings = await Booking.count({ where: { customer_id: user.id } });
      completedBookings = await Booking.count({ where: { customer_id: user.id, status: 'completed' } });
      cancelledBookings = await Booking.count({ where: { customer_id: user.id, status: 'cancelled' } });
      recentBookings = await Booking.findAll({
        where: { customer_id: user.id },
        include: [
          { model: User, as: 'provider', attributes: ['id', 'name', 'email'] },
          { model: Service, as: 'service', attributes: ['id', 'title'] }
        ],
        order: [['created_at', 'DESC']],
        limit: 5
      });
    } else if (user.role === 'provider') {
      totalBookings = await Booking.count({ where: { provider_id: user.id } });
      completedBookings = await Booking.count({ where: { provider_id: user.id, status: 'completed' } });
      cancelledBookings = await Booking.count({ where: { provider_id: user.id, status: 'cancelled' } });
      recentBookings = await Booking.findAll({
        where: { provider_id: user.id },
        include: [
          { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
          { model: Service, as: 'service', attributes: ['id', 'title'] }
        ],
        order: [['created_at', 'DESC']],
        limit: 5
      });
    }

    userJson.stats = {
      totalBookings,
      completedBookings,
      cancelledBookings,
      activeBookings: Math.max(0, totalBookings - completedBookings - cancelledBookings)
    };
    userJson.recentBookings = recentBookings.map(b => b.toJSON());

    return sendSuccess(res, userJson, 'User details retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Update user status (active / suspended)
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'pending'].includes(status)) {
      return sendError(res, 'Invalid user status', 400);
    }

    const targetUserId = parseInt(req.params.id, 10);
    const currentAdminId = req.user.id || req.user._id;

    if (targetUserId === currentAdminId && status === 'suspended') {
      return sendError(res, 'You cannot suspend your own admin account.', 400);
    }

    const user = await User.findByPk(targetUserId);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (user.role === 'admin' && status === 'suspended') {
      return sendError(res, 'Admin accounts cannot be suspended.', 400);
    }

    user.status = status;
    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${user.id}`).emit('account_status_changed', {
        userId: user.id,
        status: user.status,
        message: status === 'suspended'
          ? 'Your account has been suspended. Please contact the administrator.'
          : 'Your account is now active.'
      });
    }

    return sendSuccess(res, user.toJSON(), `User account status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Safely remove user and provider profile
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
const deleteUser = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const currentAdminId = req.user.id || req.user._id;

    if (targetUserId === currentAdminId) {
      return sendError(res, 'You cannot delete your own admin account.', 400);
    }

    const user = await User.findByPk(targetUserId);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (user.role === 'admin') {
      return sendError(res, 'Admin accounts cannot be deleted.', 400);
    }

    // Clean up provider links if provider
    const profile = await ProviderProfile.findOne({ where: { user_id: targetUserId } });
    if (profile) {
      await ProviderService.destroy({ where: { provider_profile_id: profile.id } });
      await profile.destroy();
    }

    // Clean up auxiliary user records safely
    await WalletTransaction.destroy({ where: { user_id: targetUserId } });
    await Wallet.destroy({ where: { user_id: targetUserId } });
    await Notification.destroy({ where: { recipient_id: targetUserId } });
    await PasswordResetToken.destroy({ where: { user_id: targetUserId } });
    await ChatbotHistory.destroy({ where: { user_id: targetUserId } });
    await Review.destroy({ where: { [Op.or]: [{ customer_id: targetUserId }, { provider_id: targetUserId }] } });
    await Booking.destroy({ where: { [Op.or]: [{ customer_id: targetUserId }, { provider_id: targetUserId }] } });

    await user.destroy();

    return sendSuccess(res, { deletedUserId: targetUserId }, 'User and associated profile safely deleted');
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending provider approval requests
// @route   GET /api/admin/providers/pending
// @access  Private (Admin)
const getPendingProviders = async (req, res, next) => {
  try {
    const pending = await ProviderProfile.findAll({
      where: { verification_status: 'pending' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'avatar', 'address', 'city', 'created_at']
        }
      ]
    });

    return sendSuccess(res, pending.map(p => p.toJSON()), 'Pending provider applications retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get category pool statistics for Admin Provider Management
// @route   GET /api/admin/providers/pool-stats
// @access  Private (Admin)
const getCategoryPoolStats = async (req, res, next) => {
  try {
    const {
      CANONICAL_CATEGORIES,
      getCategoryAliases,
      getCanonicalCategory,
      isTestCategory
    } = require('../utils/categoryNormalizer');

    // Build the set of categories strictly from CANONICAL_CATEGORIES
    const categorySet = new Set(CANONICAL_CATEGORIES);

    // Also include any active distinct canonical categories from DB, strictly ignoring test categories
    const profileCategories = await ProviderProfile.findAll({
      attributes: ['category'],
      group: ['category']
    });
    const serviceCategories = await Service.findAll({
      attributes: ['category'],
      where: { is_active: true },
      group: ['category']
    });

    profileCategories.forEach(p => {
      if (p.category && !isTestCategory(p.category)) {
        const canonical = getCanonicalCategory(p.category);
        if (canonical) categorySet.add(canonical);
      }
    });
    serviceCategories.forEach(s => {
      if (s.category && !isTestCategory(s.category)) {
        const canonical = getCanonicalCategory(s.category);
        if (canonical) categorySet.add(canonical);
      }
    });

    // Keep CANONICAL_CATEGORIES first in standard order
    const categories = CANONICAL_CATEGORIES.filter(c => categorySet.has(c));
    Array.from(categorySet).forEach(c => {
      if (!categories.includes(c)) categories.push(c);
    });

    const poolStats = [];

    for (const cat of categories) {
      const aliases = getCategoryAliases(cat);
      const catWhere = { [Op.in]: aliases };

      // Active approved providers
      const activeCount = await ProviderProfile.count({
        where: {
          category: catWhere,
          is_approved: true,
          is_active: { [Op.ne]: false }
        }
      });

      // Pending applications
      const pendingCount = await ProviderProfile.count({
        where: {
          category: catWhere,
          verification_status: 'pending'
        }
      });

      // Available now (active, approved, and availability_status == AVAILABLE)
      const availableNowCount = await ProviderProfile.count({
        where: {
          category: catWhere,
          is_approved: true,
          is_active: { [Op.ne]: false },
          [Op.or]: [
            { availability_status: 'AVAILABLE' },
            { availability_status: null, is_available: true }
          ]
        }
      });

      // Total in category
      const totalCount = await ProviderProfile.count({
        where: {
          category: catWhere
        }
      });

      poolStats.push({
        category: cat,
        active: activeCount,
        maxActive: 10,
        isFull: activeCount >= 10,
        remainingSlots: Math.max(0, 10 - activeCount),
        pending: pendingCount,
        availableNow: availableNowCount,
        total: totalCount
      });
    }

    return sendSuccess(res, poolStats, 'Category pool statistics retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get all providers for Admin Provider Management
// @route   GET /api/admin/providers
// @access  Private (Admin)
const getAllProvidersAdmin = async (req, res, next) => {
  try {
    const { category, status, search } = req.query;
    const where = {};

    if (category && category !== 'all') {
      const { getCanonicalCategory, getCategoryAliases } = require('../utils/categoryNormalizer');
      const canonical = getCanonicalCategory(category) || category;
      const aliases = getCategoryAliases(canonical);
      where.category = { [Op.in]: aliases };
    }

    if (status === 'active') {
      where.is_approved = true;
      where.is_active = { [Op.ne]: false };
    } else if (status === 'inactive') {
      where.is_active = false;
    } else if (status === 'pending') {
      where.verification_status = 'pending';
    } else if (status === 'verified') {
      where.verification_status = 'verified';
    } else if (status === 'rejected') {
      where.verification_status = 'rejected';
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
          attributes: ['id', 'name', 'email', 'phone', 'avatar', 'city', 'address', 'status', 'created_at']
        },
        {
          model: ProviderService,
          as: 'providerServices',
          required: false,
          include: [{ model: Service, as: 'service' }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const data = providers.map(p => {
      const pJson = p.toJSON();
      return {
        ...pJson,
        servicesOffered: (p.providerServices || []).map(ps => ({
          id: ps.service_id,
          title: ps.service?.title || 'Service',
          basePrice: ps.base_price ?? ps.custom_price ?? ps.service?.price,
          pricingType: ps.pricing_type || 'fixed',
          isActive: ps.is_active !== false
        }))
      };
    });

    return sendSuccess(res, data, 'Providers retrieved for admin');
  } catch (error) {
    next(error);
  }
};

// @desc    Approve or reject a provider (enforces strict 10-cap per category)
// @route   PUT /api/admin/providers/:id/verify
// @access  Private (Admin)
const verifyProvider = async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return sendError(res, "Action must be 'approve' or 'reject'", 400);
    }

    const isApprove = action === 'approve';

    const profile = await ProviderProfile.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'status'] },
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
      return sendError(res, 'Provider profile not found', 404);
    }

    if (isApprove) {
      // PART 3: Server-side validation of all required onboarding information
      const missingFields = [];

      // 1. Full Name
      if (!profile.user?.name || !profile.user.name.trim()) {
        missingFields.push('full name');
      }

      // 2. Phone
      if (!profile.user?.phone || !profile.user.phone.trim()) {
        missingFields.push('phone number');
      }

      // 3. Business Name
      if (!profile.business_name || !profile.business_name.trim()) {
        missingFields.push('business/provider name');
      }

      // 4. Primary Category
      if (!profile.category || !profile.category.trim()) {
        missingFields.push('primary service category');
      }

      // 5. At least one service & service price
      const services = profile.providerServices || [];
      if (services.length === 0) {
        missingFields.push('at least one service');
      } else {
        const hasValidPrice = services.some(s => {
          const p = s.base_price ?? s.custom_price ?? s.service?.price;
          return p != null && !isNaN(Number(p)) && Number(p) > 0;
        });
        if (!hasValidPrice && (!profile.hourly_rate || profile.hourly_rate <= 0)) {
          missingFields.push('valid service price (> ₹0)');
        }
      }

      // 6. Valid location latitude (-90 to 90)
      const lat = profile.latitude != null ? Number(profile.latitude) : null;
      if (lat == null || isNaN(lat) || lat < -90 || lat > 90) {
        missingFields.push('valid location latitude (-90 to 90)');
      }

      // 7. Valid location longitude (-180 to 180)
      const lng = profile.longitude != null ? Number(profile.longitude) : null;
      if (lng == null || isNaN(lng) || lng < -180 || lng > 180) {
        missingFields.push('valid location longitude (-180 to 180)');
      }

      // 8. Service radius (> 0 km)
      const radius = Number(profile.service_radius_km || profile.service_radius);
      if (!radius || isNaN(radius) || radius <= 0) {
        missingFields.push('service radius (> 0 km)');
      }

      // 9. Availability schedule
      if (!profile.working_days || !Array.isArray(profile.working_days) || profile.working_days.length === 0) {
        missingFields.push('working days schedule');
      }
      if (!profile.working_hours || !profile.working_hours.start || !profile.working_hours.end) {
        missingFields.push('working hours schedule');
      }

      if (missingFields.length > 0) {
        return sendError(
          res,
          `Cannot approve provider: Missing required onboarding information (${missingFields.join(', ')}).`,
          400
        );
      }

      // PART 15: Check active provider capacity limit (10 active per category)
      const { getCanonicalCategory, getCategoryAliases } = require('../utils/categoryNormalizer');
      const canonicalCat = getCanonicalCategory(profile.category) || profile.category;
      const aliases = getCategoryAliases(canonicalCat);

      const activeCount = await ProviderProfile.count({
        where: {
          category: { [Op.in]: aliases },
          is_approved: true,
          is_active: { [Op.ne]: false },
          id: { [Op.ne]: profile.id }
        }
      });

      if (activeCount >= 10) {
        return sendError(
          res,
          `Active provider capacity for this category (${canonicalCat}) is currently full (10/10). Please deactivate an existing provider first or keep this provider in the pending queue.`,
          400
        );
      }

      // PART 2: Provider Approval Lifecycle
      // Approval does NOT mean AVAILABLE. Approval authorizes provider; provider starts OFFLINE.
      profile.is_approved = true;
      profile.verification_status = 'verified';
      profile.is_active = true;
      profile.availability_status = 'OFFLINE';
      profile.is_available = false;
      profile.category = canonicalCat;
    } else {
      profile.is_approved = false;
      profile.verification_status = 'rejected';
      profile.is_active = false;
      profile.availability_status = 'OFFLINE';
      profile.is_available = false;
    }

    await profile.save();

    // Dispatch notification to provider about application status
    try {
      await Notification.create({
        recipient_id: profile.user_id,
        title: isApprove ? 'Application Approved' : 'Application Status Update',
        message: isApprove
          ? 'Congratulations! Your provider application has been approved by admin. You can now toggle your status to AVAILABLE and start receiving jobs.'
          : 'Your provider application has been reviewed and rejected. Please contact support or update your application details.',
        type: 'system',
        read: false,
        link: '/provider/dashboard',
        metadata: {
          profileId: profile.id,
          action: isApprove ? 'approved' : 'rejected'
        }
      });
    } catch (notifErr) {
      console.error('Error dispatching provider notification upon approval/rejection:', notifErr);
    }

    return sendSuccess(res, profile.toJSON(), `Provider application ${isApprove ? 'approved' : 'rejected'} successfully`);
  } catch (error) {
    next(error);
  }
};

// @desc    Activate or deactivate provider (enforces 10-cap per category)
// @route   PUT /api/admin/providers/:id/status
// @access  Private (Admin)
const updateProviderActiveStatus = async (req, res, next) => {
  try {
    const { isActive, status } = req.body;
    const willBeActive = isActive !== undefined
      ? (isActive === true || isActive === 'true' || isActive === 1)
      : (status === 'active');

    const profile = await ProviderProfile.findByPk(req.params.id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
    });

    if (!profile) {
      return sendError(res, 'Provider profile not found', 404);
    }

    if (willBeActive) {
      if (!profile.is_approved || profile.verification_status !== 'verified') {
        return sendError(res, 'Cannot activate an unapproved provider. Please approve the provider first.', 400);
      }

      // Check 10-provider cap
      const { getCanonicalCategory, getCategoryAliases } = require('../utils/categoryNormalizer');
      const canonicalCat = getCanonicalCategory(profile.category) || profile.category;
      const aliases = getCategoryAliases(canonicalCat);

      const activeCount = await ProviderProfile.count({
        where: {
          category: { [Op.in]: aliases },
          is_approved: true,
          is_active: { [Op.ne]: false },
          id: { [Op.ne]: profile.id }
        }
      });

      if (activeCount >= 10) {
        return sendError(
          res,
          `Provider capacity for this category (${canonicalCat}) is currently full (10/10). Please deactivate another provider before activating this one.`,
          400
        );
      }

      profile.is_active = true;
      profile.availability_status = 'AVAILABLE';
      profile.is_available = true;
    } else {
      profile.is_active = false;
      profile.availability_status = 'OFFLINE';
      profile.is_available = false;
    }

    await profile.save();

    return sendSuccess(res, profile.toJSON(), `Provider ${willBeActive ? 'activated' : 'deactivated'} successfully`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update provider service radius
// @route   PUT /api/admin/providers/:id/radius
// @access  Private (Admin)
const updateProviderRadius = async (req, res, next) => {
  try {
    const { radius } = req.body;
    const numRadius = Number(radius);
    if (!numRadius || isNaN(numRadius) || numRadius <= 0) {
      return sendError(res, 'Please provide a valid radius number in km.', 400);
    }

    const profile = await ProviderProfile.findByPk(req.params.id);
    if (!profile) {
      return sendError(res, 'Provider profile not found', 404);
    }

    profile.service_radius = numRadius;
    profile.service_radius_km = numRadius;
    await profile.save();

    return sendSuccess(res, profile.toJSON(), `Provider service radius updated to ${numRadius} km`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed provider information for admin
// @route   GET /api/admin/providers/:id
// @access  Private (Admin)
const getProviderDetailsAdmin = async (req, res, next) => {
  try {
    const profile = await ProviderProfile.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'avatar', 'city', 'address', 'status', 'created_at']
        },
        {
          model: ProviderService,
          as: 'providerServices',
          include: [{ model: Service, as: 'service' }]
        }
      ]
    });

    if (!profile) {
      return sendError(res, 'Provider not found', 404);
    }

    const pJson = profile.toJSON();
    const recentBookings = await Booking.findAll({
      where: { provider_id: profile.user_id },
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: Service, as: 'service', attributes: ['id', 'title'] }
      ],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    pJson.recentBookings = recentBookings.map(b => b.toJSON());
    pJson.servicesOffered = (profile.providerServices || []).map(ps => ({
      id: ps.service_id,
      title: ps.service?.title || 'Service',
      basePrice: ps.base_price ?? ps.custom_price ?? ps.service?.price,
      pricingType: ps.pricing_type || 'fixed',
      isActive: ps.is_active !== false
    }));

    return sendSuccess(res, pJson, 'Provider details retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get report types
// @route   GET /api/admin/report-types
// @access  Private (Admin)
const getReportTypes = async (req, res, next) => {
  try {
    const reportTypes = [
      { id: "revenue", name: "Revenue Report", description: "Monthly platform revenue broken down by category.", icon: "📊" },
      { id: "bookings", name: "Bookings Report", description: "Booking volume, completion and cancellation rates.", icon: "📅" },
      { id: "users", name: "User Growth Report", description: "New signups by role over the selected period.", icon: "👤" },
      { id: "complaints", name: "Complaints Report", description: "Complaint volume and resolution turnaround.", icon: "⚠️" },
    ];
    return res.json(reportTypes);
  } catch (error) {
    next(error);
  }
};

// @desc    Generate report
// @route   POST /api/admin/reports
// @access  Private (Admin)
const generateReport = async (req, res, next) => {
  try {
    const { reportTypeId } = req.body;
    const now = new Date();
    return res.json({
      id: `RPT-${now.getTime()}`,
      reportTypeId: reportTypeId || "revenue",
      generatedDate: now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      fileName: `${reportTypeId || "report"}-report-${now.getTime()}.csv`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardMetrics,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,
  getPendingProviders,
  getCategoryPoolStats,
  getAllProvidersAdmin,
  getProviderDetailsAdmin,
  verifyProvider,
  updateProviderActiveStatus,
  updateProviderRadius,
  getReportTypes,
  generateReport
};

