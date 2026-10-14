const crypto = require('crypto');
const { Op } = require('sequelize');
const { Booking, Service, User, ProviderProfile, ProviderService, Notification, Community, Payment, Wallet, WalletTransaction } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');
const { sequelize } = require('../config/database');
const { checkProviderEligibility } = require('../services/providerEligibilityService');
const paymentService = require('../services/paymentService');

const bookingIncludes = [
  {
    model: User,
    as: 'customer',
    attributes: ['id', 'name', 'email', 'phone', 'avatar', 'address', 'city', 'status', 'role']
  },
  {
    model: User,
    as: 'provider',
    attributes: ['id', 'name', 'email', 'phone', 'avatar', 'status', 'role']
  },
  {
    model: ProviderProfile,
    as: 'providerProfile'
  },
  {
    model: Service,
    as: 'service'
  },
  {
    model: Community,
    as: 'community'
  }
];

// Helper: Synchronize provider availability status & completed jobs counter
const syncProviderAvailability = async (providerUserId, options = {}) => {
  if (!providerUserId) return;
  try {
    const profile = await ProviderProfile.findOne({ where: { user_id: providerUserId } });
    if (!profile) return;

    if (options.incrementCompleted) {
      const current = Number(profile.completed_jobs || profile.completed_jobs_count || 0);
      profile.completed_jobs = current + 1;
      profile.completed_jobs_count = current + 1;
    }

    const whereActive = {
      provider_id: providerUserId,
      status: { [Op.in]: ['accepted', 'confirmed', 'on_the_way', 'arrived', 'in_progress'] }
    };
    if (options.excludeBookingId) {
      whereActive.id = { [Op.ne]: options.excludeBookingId };
    }

    const activeCount = await Booking.count({ where: whereActive });

    if (activeCount > 0) {
      profile.availability_status = 'BUSY';
      profile.is_available = false;
    } else {
      if (profile.is_active !== false && profile.is_approved) {
        profile.availability_status = 'AVAILABLE';
        profile.is_available = true;
      }
    }
    await profile.save();
  } catch (err) {
    console.error('[syncProviderAvailability error]:', err);
  }
};

// @desc    Create a new service booking
// @route   POST /api/bookings
// @access  Private (Customer)
const createBooking = async (req, res, next) => {
  try {
    const serviceId = req.body.serviceId || req.body.service_id;
    const providerId = req.body.providerId || req.body.provider_id;
    const date = req.body.date || req.body.scheduled_date;
    const time = req.body.time || req.body.scheduled_time;
    const address = req.body.address || req.body.service_address;
    const paymentMethod = req.body.paymentMethod || req.body.payment_method;
    const customerNotes = req.body.customerNotes || req.body.notes;
    const amount = req.body.amount || req.body.total_amount;

    const customerId = req.user.id || req.user._id;

    // Coordinate resolution
    const resolvedServiceLocation = req.body.serviceLocation || (typeof address === 'object' && address !== null ? address : null);
    const bookingLat = req.body.customer_latitude ?? req.body.latitude ?? req.body.lat ?? resolvedServiceLocation?.latitude ?? resolvedServiceLocation?.lat ?? (typeof address === 'object' ? (address?.lat ?? address?.latitude) : null);
    const bookingLng = req.body.customer_longitude ?? req.body.longitude ?? req.body.lng ?? resolvedServiceLocation?.longitude ?? resolvedServiceLocation?.lng ?? (typeof address === 'object' ? (address?.lng ?? address?.longitude) : null);

    if ((!serviceId && !req.body.serviceName && !req.body.service) || !date || !time) {
      return sendError(res, 'Service, date, and time are required', 400);
    }

    // Execute booking creation inside a database transaction with row-level locking
    const createdBookingResult = await sequelize.transaction(async (t) => {
      // 1. Validate Customer
      const customer = await User.findByPk(customerId, { transaction: t });
      if (!customer) {
        const err = new Error('Customer account not found');
        err.statusCode = 404;
        throw err;
      }
      if (customer.role !== 'customer') {
        const err = new Error('Only customer accounts can book services.');
        err.statusCode = 403;
        throw err;
      }
      if (customer.status !== 'active') {
        const err = new Error('Your account has been suspended. Please contact the administrator.');
        err.statusCode = 403;
        throw err;
      }

      // 2. Resolve Service
      let service = null;
      if (serviceId) {
        service = await Service.findByPk(serviceId, { transaction: t });
      }
      if (!service && (req.body.serviceName || req.body.service)) {
        const searchTitle = (req.body.serviceName || req.body.service).trim();
        service = await Service.findOne({
          where: { title: { [Op.like]: `%${searchTitle}%` } },
          transaction: t
        });
      }
      if (!service) {
        const err = new Error('Selected service does not exist');
        err.statusCode = 404;
        throw err;
      }

      // 3. Resolve Provider with row-level lock (PART 17: Race condition protection)
      let assignedProviderProfile = null;
      let assignedProviderUser = null;

      if (providerId) {
        assignedProviderProfile = await ProviderProfile.findOne({
          where: {
            [Op.or]: [{ id: providerId }, { user_id: providerId }]
          },
          include: [{ model: User, as: 'user' }],
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (assignedProviderProfile) {
          assignedProviderUser = assignedProviderProfile.user;
        }
      }

      if (!assignedProviderProfile && (req.body.provider || req.body.providerEmail)) {
        const searchProv = (req.body.provider || req.body.providerEmail).trim();
        const pUser = await User.findOne({
          where: {
            [Op.or]: [
              { email: searchProv.toLowerCase() },
              { name: { [Op.like]: `%${searchProv}%` } }
            ],
            role: 'provider'
          },
          transaction: t
        });
        if (pUser) {
          assignedProviderProfile = await ProviderProfile.findOne({
            where: { user_id: pUser.id },
            include: [{ model: User, as: 'user' }],
            transaction: t,
            lock: t.LOCK.UPDATE
          });
          if (assignedProviderProfile) {
            assignedProviderUser = pUser;
          }
        }
      }

      // Auto-match an available provider if none explicitly specified
      if (!assignedProviderProfile) {
        const mapping = await ProviderService.findOne({
          where: { service_id: service.id, is_active: true },
          include: [{
            model: ProviderProfile,
            as: 'providerProfile',
            where: { is_approved: true, is_active: true },
            include: [{
              model: User,
              as: 'user',
              where: { status: 'active', role: 'provider' }
            }]
          }],
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        if (mapping && mapping.providerProfile) {
          assignedProviderProfile = mapping.providerProfile;
          assignedProviderUser = mapping.providerProfile.user;
        }
      }

      if (!assignedProviderProfile || !assignedProviderUser) {
        const err = new Error('No eligible provider available for this service.');
        err.statusCode = 400;
        throw err;
      }

      // 4. PART 16: STRICT SERVER-SIDE ELIGIBILITY REVALIDATION
      const eligibility = await checkProviderEligibility(assignedProviderProfile, {
        customerLat: bookingLat,
        customerLng: bookingLng,
        serviceId: service.id,
        serviceTitle: service.title,
        category: service.category,
        date,
        time,
        requireAvailableNow: false,
        transaction: t
      });

      if (!eligibility.eligible) {
        const err = new Error(`Cannot book this provider: ${eligibility.reason}`);
        err.statusCode = 400;
        throw err;
      }

      // 5. PART 17: DOUBLE BOOKING CONFLICT CHECK (LOCK ACQUIRED)
      const existingConflict = await Booking.findOne({
        where: {
          provider_id: assignedProviderUser.id,
          date,
          time,
          status: { [Op.notIn]: ['cancelled', 'rejected'] }
        },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (existingConflict) {
        const err = new Error(`The selected provider has already been booked for ${date} at ${time}. Please select another time slot or provider.`);
        err.statusCode = 409; // 409 Conflict
        throw err;
      }

      // 6. Problem Description & Media Attachments Validation
      const rawProblemDesc = req.body.problemDescription || req.body.problem_description || customerNotes || '';
      const rawMedia = req.body.mediaAttachments || req.body.media_attachments || [];

      const validatedMedia = [];
      if (Array.isArray(rawMedia)) {
        for (const item of rawMedia) {
          const mediaUrl = typeof item === 'string' ? item : (item.url || item.data || '');
          const mediaType = typeof item === 'object' && item.type ? item.type : '';
          const mediaName = typeof item === 'object' && item.name ? item.name : 'media_file';

          if (/\.(exe|bat|sh|cmd|msi|vbs|pif|scr|com|js|php|py)$/i.test(mediaUrl) || /\.(exe|bat|sh|cmd|msi|vbs|pif|scr|com|js|php|py)$/i.test(mediaName)) {
            const err = new Error('Executable and script file uploads are strictly forbidden.');
            err.statusCode = 400;
            throw err;
          }

          if (mediaUrl.startsWith('data:') && mediaUrl.length > 7 * 1024 * 1024) {
            const err = new Error('Media attachment exceeds maximum allowed size of 5MB.');
            err.statusCode = 400;
            throw err;
          }

          validatedMedia.push({
            url: mediaUrl,
            type: mediaType || (mediaUrl.startsWith('data:video') ? 'video' : 'image'),
            name: mediaName,
            uploadedAt: new Date().toISOString()
          });
        }
      }

      // 7. Authoritative Server-Side Price Calculation
      const baseAmount = eligibility.resolvedPrice != null ? eligibility.resolvedPrice : Number(service.price || 299);
      const pricingType = eligibility.pricingType || 'fixed';
      const finalAmount = Math.max(0, baseAmount);

      const pricing = {
        baseAmount,
        travelCharge: 0,
        additionalCharge: 0,
        discount: 0,
        tax: 0,
        finalAmount,
        pricingType,
        currency: 'INR'
      };

      const bookingNumber = `FIX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const initialTimeline = [
        {
          status: 'pending',
          timestamp: new Date().toISOString(),
          note: 'Booking request placed'
        },
        {
          status: 'provider_assigned',
          timestamp: new Date().toISOString(),
          note: `Assigned to ${assignedProviderProfile.business_name || assignedProviderUser.name}`
        }
      ];

      const initialLocation = assignedProviderProfile?.current_location || assignedProviderProfile?.location || null;
      const resolvedAddressStr = typeof address === 'string'
        ? address
        : (resolvedServiceLocation?.address || `${customer.address || ''}, ${customer.city || ''}`.trim() || 'Address Provided');
      const bookingAddress = typeof address === 'string'
        ? address
        : (address?.street || address?.address || resolvedServiceLocation?.address || req.body.booking_address || resolvedAddressStr);

      const communityId = req.body.communityId || req.body.community_id || null;

      let initialPaymentMethod = paymentMethod || 'cash';
      let initialPaymentStatus = 'pending';

      if (initialPaymentMethod === 'wallet') {
        const wallet = await Wallet.findOne({
          where: { user_id: customerId },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (!wallet || Number(wallet.balance) < Number(finalAmount)) {
          const err = new Error(`Insufficient wallet balance. Current balance is ₹${wallet ? wallet.balance : 0}, required ₹${finalAmount}`);
          err.statusCode = 400;
          throw err;
        }
        // Atomically debit/reserve from customer's wallet on server
        wallet.balance = Number((Number(wallet.balance) - Number(finalAmount)).toFixed(2));
        await wallet.save({ transaction: t });

        await WalletTransaction.create({
          user_id: customerId,
          type: 'debit',
          amount: finalAmount,
          description: `Payment reserved for booking #${bookingNumber}`,
          reference_id: `PAY-RES-${Date.now().toString().slice(-8)}`,
          balance_after: wallet.balance,
          status: 'pending'
        }, { transaction: t });

        initialPaymentStatus = 'pending';
      } else if (initialPaymentMethod === 'cash') {
        initialPaymentStatus = 'cash_pending';
      }

      const newBooking = await Booking.create({
        booking_number: bookingNumber,
        customer_id: customerId,
        community_id: communityId ? Number(communityId) : null,
        provider_id: assignedProviderUser.id,
        provider_profile_id: assignedProviderProfile.id,
        service_id: service.id,
        service_title: service.title,
        category: service.category,
        date,
        time,
        address: typeof address === 'object' && address !== null ? address : {
          street: bookingAddress,
          city: address?.city || customer.city || 'Chennai',
          pincode: address?.pincode || '',
          lat: bookingLat != null ? Number(bookingLat) : null,
          lng: bookingLng != null ? Number(bookingLng) : null
        },
        service_location: {
          address: bookingAddress,
          latitude: bookingLat != null ? Number(bookingLat) : null,
          longitude: bookingLng != null ? Number(bookingLng) : null,
          city: address?.city || customer.city || 'Chennai',
          pincode: address?.pincode || ''
        },
        problem_description: rawProblemDesc,
        media_attachments: validatedMedia,
        additional_charges: [],
        status: 'pending',
        payment_method: initialPaymentMethod,
        payment_status: initialPaymentStatus,
        amount: finalAmount,
        pricing: pricing,
        customer_notes: customerNotes || '',
        status_timeline: initialTimeline,
        provider_location: initialLocation
      }, { transaction: t });

      if (initialPaymentMethod === 'wallet') {
        await Payment.create({
          booking_id: newBooking.id,
          user_id: customerId,
          gateway: 'wallet',
          amount: finalAmount,
          currency: 'INR',
          payment_method: 'wallet',
          status: 'authorized'
        }, { transaction: t });
      } else if (req.body.paymentRecordId) {
        const prePayment = await Payment.findByPk(req.body.paymentRecordId, { transaction: t, lock: t.LOCK.UPDATE });
        if (prePayment && prePayment.user_id === customerId) {
          prePayment.booking_id = newBooking.id;
          await prePayment.save({ transaction: t });
        }
      }

      return {
        booking: newBooking,
        service,
        assignedProviderUser,
        assignedProviderProfile,
        customerId
      };
    });

    const { booking, service, assignedProviderUser, assignedProviderProfile } = createdBookingResult;

    // Post-commit: Broadcast notifications & events
    const io = req.app.get('io');

    const payMethod = booking.payment_method;
    const amountVal = booking.amount != null ? booking.amount : (booking.total_amount || 0);
    let custMsg = `Your booking #${booking.booking_number} for ${service.title} has been requested.`;
    if (payMethod === 'wallet') {
      custMsg = `Your booking #${booking.booking_number} for ${service.title} has been requested. ₹${amountVal} is reserved in your wallet pending provider acceptance.`;
    } else if (payMethod === 'cash') {
      custMsg = `Your booking #${booking.booking_number} for ${service.title} has been requested. ₹${amountVal} is payable in cash upon service completion.`;
    } else {
      custMsg = `Your booking #${booking.booking_number} for ${service.title} has been requested. Online payment of ₹${amountVal} is authorized and held securely until provider acceptance.`;
    }

    const custNotif = await Notification.create({
      recipient_id: customerId,
      title: 'Booking Request Sent',
      message: custMsg,
      type: 'booking',
      link: `/customer/bookings/${booking.id}`,
      metadata: { bookingId: booking.id, bookingNumber: booking.booking_number, serviceTitle: service.title }
    });

    if (io) {
      io.to(`user:${customerId}`).emit('notification', custNotif.toJSON());
    }

    const provNotif = await Notification.create({
      recipient_id: assignedProviderUser.id,
      title: 'New Service Request',
      message: `New booking #${booking.booking_number} for ${service.title} on ${date} at ${time}.`,
      type: 'booking',
      link: `/provider/bookings`,
      metadata: { bookingId: booking.id, bookingNumber: booking.booking_number, serviceTitle: service.title }
    });

    if (io) {
      io.to(`user:${assignedProviderUser.id}`).emit('notification', provNotif.toJSON());
      io.emit('provider_availability_updated', { providerId: assignedProviderUser.id, date: booking.date });
    }

    const admins = await User.findAll({ where: { role: 'admin', status: 'active' } });
    for (const admin of admins) {
      const adminNotif = await Notification.create({
        recipient_id: admin.id,
        title: 'New Booking Created',
        message: `New booking #${booking.booking_number} for ${service.title} was created.`,
        type: 'booking',
        link: `/admin/bookings`,
        metadata: { bookingId: booking.id, bookingNumber: booking.booking_number, serviceTitle: service.title }
      });
      if (io) {
        io.to(`user:${admin.id}`).emit('notification', adminNotif.toJSON());
      }
    }

    const populatedBooking = await Booking.findByPk(booking.id, {
      include: bookingIncludes
    });

    return sendSuccess(res, populatedBooking.toJSON(), 'Booking created successfully', 201);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

// @desc    Get user's bookings (role-aware: customer, provider, admin)
// @route   GET /api/bookings
// @access  Private
const getBookings = async (req, res, next) => {
  try {
    const { status, category } = req.query;
    const userId = req.user.id || req.user._id;
    const where = {};

    if (req.user.role === 'customer') {
      where.customer_id = userId;
    } else if (req.user.role === 'provider') {
      where.provider_id = userId;
    }

    if (status && status.toLowerCase() !== 'all') {
      where.status = status;
    }

    if (category && category.toLowerCase() !== 'all') {
      where.category = { [Op.like]: category };
    }

    const bookings = await Booking.findAll({
      where,
      include: bookingIncludes,
      order: [['created_at', 'DESC']]
    });

    return sendSuccess(res, bookings.map(b => b.toJSON()), 'Bookings retrieved');
  } catch (error) {
    next(error);
  }
};

// Helper: Resolve booking with includes by integer ID or booking number
const findBookingWithIncludes = async (idOrNumber) => {
  if (!idOrNumber) return null;
  const strId = String(idOrNumber).trim();
  if (!isNaN(Number(strId))) {
    const byPk = await Booking.findByPk(Number(strId), { include: bookingIncludes });
    if (byPk) return byPk;
  }
  const cleanNumeric = strId.replace(/^(BK|FIX-?)/i, '');
  const searchConds = [{ booking_number: strId }];
  if (!isNaN(Number(cleanNumeric)) && Number(cleanNumeric) > 0) {
    searchConds.push({ id: Number(cleanNumeric) });
  }
  return await Booking.findOne({
    where: { [Op.or]: searchConds },
    include: bookingIncludes
  });
};

// @desc    Get single booking by ID
// @route   GET /api/bookings/:id
// @access  Private
const getBookingById = async (req, res, next) => {
  try {
    const booking = await findBookingWithIncludes(req.params.id);

    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    const requesterId = req.user.id || req.user._id;
    const requesterRole = req.user.role;
    const isCustomer = booking.customer_id === requesterId;
    const isProvider = booking.provider_id === requesterId;
    const isAdmin = requesterRole === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return sendError(res, 'Forbidden. You do not have permission to view this booking.', 403);
    }

    return sendSuccess(res, booking.toJSON(), 'Booking details retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Update booking status (lifecycle progression)
// @route   PUT /api/bookings/:id/status
// @access  Private
const updateBookingStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const validStatuses = [
      'pending',
      'confirmed',
      'provider_assigned',
      'accepted',
      'rejected',
      'on_the_way',
      'arrived',
      'in_progress',
      'completed',
      'cancelled'
    ];

    if (!validStatuses.includes(status)) {
      return sendError(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const booking = await findBookingWithIncludes(req.params.id);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    const requesterId = req.user.id || req.user._id;
    const requesterRole = req.user.role;

    // Role-based state machine enforcement
    if (requesterRole === 'customer') {
      if (booking.customer_id !== requesterId && booking.customerId !== requesterId && req.user.role !== 'admin') {
        return sendError(res, 'Forbidden. You do not own this booking.', 403);
      }
      // Customer can ONLY cancel their booking
      if (status !== 'cancelled') {
        return sendError(res, 'Customers are only permitted to cancel bookings. Lifecycle updates must be performed by the assigned provider or admin.', 403);
      }
      if (['in_progress', 'completed'].includes(booking.status)) {
        return sendError(res, 'Cannot cancel a booking that is already in progress or completed.', 400);
      }
    } else if (requesterRole === 'provider') {
      if (booking.provider_id !== requesterId && booking.providerId !== requesterId && req.user.role !== 'admin') {
        return sendError(res, 'Forbidden. You are not assigned to this booking.', 403);
      }

      // Valid provider transitions
      const validTransitions = {
        pending: ['accepted', 'rejected', 'cancelled'],
        provider_assigned: ['accepted', 'rejected', 'cancelled'],
        confirmed: ['on_the_way', 'cancelled'],
        accepted: ['on_the_way', 'cancelled'],
        on_the_way: ['arrived', 'cancelled'],
        arrived: ['in_progress', 'cancelled'],
        in_progress: ['completed'],
        completed: [],
        cancelled: [],
        rejected: []
      };

      const allowedNext = validTransitions[booking.status] || [];
      if (!allowedNext.includes(status)) {
        return sendError(res, `Invalid status transition from '${booking.status}' to '${status}'. Allowed next states: ${allowedNext.join(', ') || 'none'}`, 400);
      }
    }

    const io = req.app.get('io');
    let effectiveStatus = status;

    if (status === 'accepted') {
      // 1. Check for authorized online Razorpay payment
      const activeOnlinePayment = await Payment.findOne({
        where: {
          booking_id: booking.id,
          status: 'authorized',
          gateway: 'razorpay'
        }
      });

      if (['card', 'online', 'upi'].includes(booking.payment_method)) {
        if (!activeOnlinePayment) {
          return sendError(res, 'Cannot accept booking: Online payment has not been authorized by customer.', 400);
        }
        try {
          await paymentService.capturePayment({ bookingId: booking.id, paymentId: activeOnlinePayment.id, io });
          booking.payment_status = 'paid';
          effectiveStatus = 'confirmed'; // State advances to confirmed upon capture
        } catch (captureErr) {
          console.error('[Payment Capture Failed on Accept]:', captureErr);
          return sendError(res, `Failed to capture authorized payment: ${captureErr.message}. Cannot accept booking without successful payment capture.`, 402);
        }
      } else if (booking.payment_method === 'wallet') {
        // Finalize wallet payment
        const walletPayment = await Payment.findOne({
          where: { booking_id: booking.id, gateway: 'wallet', status: 'authorized' }
        });
        if (walletPayment) {
          walletPayment.status = 'captured';
          walletPayment.captured_at = new Date();
          await walletPayment.save();
        }
        const walletTx = await WalletTransaction.findOne({
          where: { user_id: booking.customer_id, description: { [Op.like]: `%#${booking.booking_number}%` }, status: 'pending' }
        });
        if (walletTx) {
          walletTx.status = 'success';
          await walletTx.save();
        }
        booking.payment_status = 'paid';
        effectiveStatus = 'confirmed';
      } else if (booking.payment_method === 'cash') {
        booking.payment_status = 'cash_pending';
        effectiveStatus = 'confirmed';
      } else {
        effectiveStatus = 'confirmed';
      }
    } else if (status === 'rejected') {
      // 1. Release online payment hold
      const activeOnlinePayment = await Payment.findOne({
        where: { booking_id: booking.id, status: 'authorized', gateway: 'razorpay' }
      });
      if (activeOnlinePayment) {
        try {
          await paymentService.releasePaymentHold({
            bookingId: booking.id,
            paymentId: activeOnlinePayment.id,
            reason: note || 'Provider declined booking',
            io
          });
          booking.payment_status = 'refunded';
        } catch (releaseErr) {
          console.warn('[Payment Release Failed on Reject]:', releaseErr.message);
        }
      } else if (booking.payment_method === 'wallet') {
        // Restore debited wallet balance to customer
        const walletPayment = await Payment.findOne({
          where: { booking_id: booking.id, gateway: 'wallet', status: 'authorized' }
        });
        if (walletPayment) {
          walletPayment.status = 'voided';
          walletPayment.released_at = new Date();
          await walletPayment.save();
        }
        const customerWallet = await Wallet.findOne({ where: { user_id: booking.customer_id } });
        if (customerWallet) {
          customerWallet.balance = Number((Number(customerWallet.balance) + Number(booking.amount)).toFixed(2));
          await customerWallet.save();

          await WalletTransaction.create({
            user_id: booking.customer_id,
            type: 'credit',
            amount: Number(booking.amount),
            description: `Refund for declined booking #${booking.booking_number}`,
            reference_id: `REF-${Date.now().toString().slice(-8)}`,
            balance_after: customerWallet.balance,
            status: 'success'
          });
        }
        booking.payment_status = 'refunded';
      }
    }

    booking.status = effectiveStatus;
    const timeline = Array.isArray(booking.status_timeline) ? [...booking.status_timeline] : [];
    timeline.push({
      status: effectiveStatus,
      timestamp: new Date().toISOString(),
      note: note || `Status updated to ${effectiveStatus.replace(/_/g, ' ')}`
    });
    booking.status_timeline = timeline;

    // Do NOT automatically mark payment as paid on completion.
    // Service completion and payment processing are strictly separated.
    await booking.save();

    // Provider Availability State Machine & Job Completion Tracking
    if (booking.provider_id) {
      if (status === 'accepted') {
        await syncProviderAvailability(booking.provider_id);
      } else if (status === 'completed') {
        await syncProviderAvailability(booking.provider_id, {
          incrementCompleted: true,
          excludeBookingId: booking.id
        });
      } else if (status === 'cancelled' || status === 'rejected') {
        await syncProviderAvailability(booking.provider_id, {
          excludeBookingId: booking.id
        });
      }
    }

    const bNum = booking.booking_number;

    // Send notifications based on status change
    let custTitle = '';
    let custMsg = '';
    let adminTitle = '';
    let adminMsg = '';

    if (status === 'accepted') {
      custTitle = 'Booking Confirmed';
      custMsg = `Booking #${bNum} has been accepted and confirmed by your service provider.`;
      adminTitle = 'Booking Confirmed';
      adminMsg = `Booking #${bNum} was accepted by provider (${booking.provider?.name || 'Provider'}).`;
    } else if (status === 'rejected') {
      custTitle = 'Booking Rejected';
      custMsg = `Booking #${bNum} was rejected by the provider.`;
      adminTitle = 'Booking Rejected';
      adminMsg = `Booking #${bNum} was rejected by provider (${booking.provider?.name || 'Provider'}).`;
    } else if (status === 'on_the_way') {
      custTitle = 'Provider On The Way';
      custMsg = `Your service provider is on the way for booking #${bNum}.`;
    } else if (status === 'arrived') {
      custTitle = 'Provider Arrived';
      custMsg = `Your service provider has arrived at your location for booking #${bNum}.`;
    } else if (status === 'in_progress') {
      custTitle = 'Service In Progress';
      custMsg = `Work for booking #${bNum} is now in progress.`;
    } else if (status === 'completed') {
      custTitle = 'Service Completed';
      custMsg = `Your service for booking #${bNum} has been marked completed. Thank you!`;
      adminTitle = 'Service Completed';
      adminMsg = `Booking #${bNum} has been completed successfully.`;
    }

    const targetCustomerId = booking.customer_id || booking.customerId || booking.customer?.id;
    const targetProviderId = booking.provider_id || booking.providerId || booking.provider?.id;

    // Save notification & emit for customer
    if (custTitle && targetCustomerId) {
      const cNotif = await Notification.create({
        recipient_id: targetCustomerId,
        title: custTitle,
        message: custMsg,
        type: 'booking',
        link: `/customer/bookings/${booking.id}`,
        metadata: { bookingId: booking.id, status }
      });
      if (io) {
        io.to(`user:${targetCustomerId}`).emit('notification', cNotif.toJSON());
      }
    }

    // Save notification & emit for admins
    if (adminTitle) {
      const admins = await User.findAll({ where: { role: 'admin' } });
      for (const admin of admins) {
        const aNotif = await Notification.create({
          recipient_id: admin.id,
          title: adminTitle,
          message: adminMsg,
          type: 'booking',
          link: `/admin/bookings`,
          metadata: { bookingId: booking.id, status }
        });
        if (io) {
          io.to(`user:${admin.id}`).emit('notification', aNotif.toJSON());
        }
      }
    }

    // Emit live status update to booking room and direct user rooms
    if (io) {
      const payload = {
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
        status,
        updatedAt: new Date()
      };
      io.to(`booking:${booking.id}`).emit('booking_status_update', payload);
      if (booking.booking_number) {
        io.to(`booking:${booking.booking_number}`).emit('booking_status_update', payload);
      }
      if (targetCustomerId) {
        io.to(`user:${targetCustomerId}`).emit('booking_status_update', payload);
      }
      if (targetProviderId) {
        io.to(`user:${targetProviderId}`).emit('booking_status_update', payload);
      }
    }

    const updatedBooking = await Booking.findByPk(booking.id, {
      include: bookingIncludes
    });

    return sendSuccess(res, updatedBooking.toJSON(), 'Booking status updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Reschedule booking date / time
// @route   PUT /api/bookings/:id/reschedule
// @access  Private
// @desc    Reschedule booking date / time
// @route   PUT /api/bookings/:id/reschedule
// @access  Private
const rescheduleBooking = async (req, res, next) => {
  try {
    const { date, time } = req.body;
    if (!date || !time) {
      return sendError(res, 'Date and time are required to reschedule', 400);
    }

    const booking = await Booking.findByPk(req.params.id);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    const requesterId = req.user.id || req.user._id;
    const isCustomer = booking.customer_id === requesterId;
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isAdmin) {
      return sendError(res, 'Forbidden. Only the booking customer can reschedule this booking.', 403);
    }

    if (['in_progress', 'completed', 'cancelled', 'rejected'].includes(booking.status)) {
      return sendError(res, `Cannot reschedule a booking that is '${booking.status}'.`, 400);
    }

    // Double-booking check for new date/time
    const conflict = await Booking.findOne({
      where: {
        provider_id: booking.provider_id,
        date: date,
        time: time,
        id: { [Op.ne]: booking.id },
        status: { [Op.notIn]: ['cancelled', 'rejected'] }
      }
    });

    if (conflict) {
      return sendError(res, `The provider already has an active booking on ${date} at ${time}. Please choose another slot.`, 409);
    }

    booking.date = date;
    booking.time = time;
    const timeline = Array.isArray(booking.status_timeline) ? [...booking.status_timeline] : [];
    timeline.push({
      status: booking.status,
      timestamp: new Date().toISOString(),
      note: `Booking rescheduled to ${date} at ${time}`
    });
    booking.status_timeline = timeline;

    await booking.save();

    const updatedBooking = await Booking.findByPk(booking.id, {
      include: bookingIncludes
    });

    return sendSuccess(res, updatedBooking.toJSON(), 'Booking rescheduled successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    const requesterId = req.user.id || req.user._id;
    const isCustomer = booking.customer_id === requesterId;
    const isProvider = booking.provider_id === requesterId;
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return sendError(res, 'Forbidden. You are not authorized to cancel this booking.', 403);
    }

    if (['completed', 'cancelled', 'rejected'].includes(booking.status)) {
      return sendError(res, `Cannot cancel a booking that is already '${booking.status}'.`, 400);
    }

    if (isCustomer && booking.status === 'in_progress') {
      return sendError(res, 'Cannot cancel a booking that is already in progress.', 400);
    }

    booking.status = 'cancelled';
    booking.cancellation_reason = reason || 'Cancelled by user';
    const timeline = Array.isArray(booking.status_timeline) ? [...booking.status_timeline] : [];
    timeline.push({
      status: 'cancelled',
      timestamp: new Date().toISOString(),
      note: `Cancelled: ${reason || 'No reason specified'}`
    });
    booking.status_timeline = timeline;

    // Automatic Payment hold release or refund on cancellation
    const activePayment = await Payment.findOne({
      where: { booking_id: booking.id, status: ['authorized', 'captured'] },
      order: [['created_at', 'DESC']]
    });

    const io = req.app.get('io');

    if (activePayment) {
      if (activePayment.gateway === 'razorpay') {
        try {
          await paymentService.releasePaymentHold({
            bookingId: booking.id,
            paymentId: activePayment.id,
            reason: reason || 'Booking cancelled',
            io
          });
          booking.payment_status = 'refunded';
        } catch (cancelPayErr) {
          console.warn('[Payment Release Error on Cancel]:', cancelPayErr.message);
        }
      } else if (activePayment.gateway === 'wallet') {
        const customerWallet = await Wallet.findOne({ where: { user_id: booking.customer_id } });
        if (customerWallet) {
          customerWallet.balance = Number((Number(customerWallet.balance) + Number(booking.amount)).toFixed(2));
          await customerWallet.save();

          await WalletTransaction.create({
            user_id: booking.customer_id,
            type: 'credit',
            amount: Number(booking.amount),
            description: `Refund for cancelled booking #${booking.booking_number}`,
            reference_id: `REF-CANC-${Date.now().toString().slice(-8)}`,
            balance_after: customerWallet.balance,
            status: 'success'
          });
        }
        activePayment.status = activePayment.status === 'captured' ? 'refunded' : 'voided';
        await activePayment.save();
        booking.payment_status = 'refunded';
      }
    }

    await booking.save();

    // Provider Availability Transition on Cancellation
    if (booking.provider_id) {
      await syncProviderAvailability(booking.provider_id, {
        excludeBookingId: booking.id
      });
    }

    const bNum = booking.booking_number;

    // Notify customer
    if (booking.customer_id) {
      const cNotif = await Notification.create({
        recipient_id: booking.customer_id,
        title: 'Booking Cancelled',
        message: `Booking #${bNum} has been cancelled. Reason: ${reason || 'No reason specified'}`,
        type: 'booking',
        link: `/customer/bookings/${booking.id}`,
        metadata: { bookingId: booking.id, status: 'cancelled' }
      });
      if (io) {
        io.to(`user:${booking.customer_id}`).emit('notification', cNotif.toJSON());
      }
    }

    // Notify provider if assigned
    if (booking.provider_id) {
      const pNotif = await Notification.create({
        recipient_id: booking.provider_id,
        title: 'Booking Cancelled',
        message: `Booking #${bNum} was cancelled.`,
        type: 'booking',
        link: `/provider/bookings`,
        metadata: { bookingId: booking.id, status: 'cancelled' }
      });
      if (io) {
        io.to(`user:${booking.provider_id}`).emit('notification', pNotif.toJSON());
      }
    }

    // Notify Admins
    const admins = await User.findAll({ where: { role: 'admin' } });
    for (const admin of admins) {
      const aNotif = await Notification.create({
        recipient_id: admin.id,
        title: 'Booking Cancelled',
        message: `Booking #${bNum} has been cancelled.`,
        type: 'booking',
        link: `/admin/bookings`,
        metadata: { bookingId: booking.id, status: 'cancelled' }
      });
      if (io) {
        io.to(`user:${admin.id}`).emit('notification', aNotif.toJSON());
      }
    }

    if (io) {
      const payload = {
        bookingId: booking.id,
        status: 'cancelled',
        updatedAt: new Date()
      };
      io.to(`booking:${booking.id}`).emit('booking_status_update', payload);
      if (booking.customer_id) io.to(`user:${booking.customer_id}`).emit('booking_status_update', payload);
      if (booking.provider_id) io.to(`user:${booking.provider_id}`).emit('booking_status_update', payload);
    }

    const updatedBooking = await Booking.findByPk(booking.id, {
      include: bookingIncludes
    });

    return sendSuccess(res, updatedBooking.toJSON(), 'Booking cancelled successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get live provider location for tracking
// @route   GET /api/bookings/:id/location
// @access  Private
const getBookingLocation = async (req, res, next) => {
  try {
    const rawParam = req.params.id;
    let booking = null;
    if (!isNaN(Number(rawParam))) {
      booking = await Booking.findByPk(Number(rawParam), {
        include: [
          { model: ProviderProfile, as: 'providerProfile' },
          { model: User, as: 'provider', attributes: ['id', 'name', 'phone', 'avatar'] }
        ]
      });
    }
    if (!booking) {
      const cleanNumeric = String(rawParam).replace(/^(BK|FIX-?)/i, '');
      const searchConds = [{ booking_number: String(rawParam) }];
      if (!isNaN(Number(cleanNumeric)) && Number(cleanNumeric) > 0) {
        searchConds.push({ id: Number(cleanNumeric) });
      }
      booking = await Booking.findOne({
        where: { [Op.or]: searchConds },
        include: [
          { model: ProviderProfile, as: 'providerProfile' },
          { model: User, as: 'provider', attributes: ['id', 'name', 'phone', 'avatar'] }
        ]
      });
    }

    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    const requesterId = req.user.id || req.user._id;
    const requesterRole = req.user.role;

    // Authorization check: Customer of this booking, assigned provider, or admin
    const isCustomer = booking.customer_id === requesterId;
    const isProvider = booking.provider_id === requesterId;
    const isAdmin = requesterRole === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return sendError(res, 'Forbidden. You are not authorized to view this booking location.', 403);
    }

    const safeParse = (v) => {
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch (e) { return v; }
      }
      return v;
    };

    const rawLoc = booking.provider_location || booking.providerProfile?.current_location;
    const parsedLoc = safeParse(rawLoc);
    const validLoc = (parsedLoc && parsedLoc.lat != null && parsedLoc.lng != null && !isNaN(parsedLoc.lat) && !isNaN(parsedLoc.lng))
      ? parsedLoc
      : null;

    const destination = safeParse(booking.service_location) || safeParse(booking.address);

    return sendSuccess(res, {
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
      status: booking.status,
      provider: booking.provider ? booking.provider.toJSON() : null,
      location: validLoc,
      destination
    }, 'Booking location retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get server-calculated price quote for a booking
// @route   POST /api/bookings/quote
// @access  Private
const getBookingQuote = async (req, res, next) => {
  try {
    const { serviceId, providerId, serviceName, provider } = req.body;

    let service = null;
    if (serviceId) {
      service = await Service.findByPk(serviceId);
    }
    if (!service && serviceName) {
      service = await Service.findOne({
        where: { title: { [Op.like]: `%${serviceName.trim()}%` } }
      });
    }
    if (!service) {
      return sendError(res, 'Service not found', 404);
    }

    let assignedProviderProfile = null;
    let assignedProviderUser = null;
    if (providerId) {
      assignedProviderProfile = await ProviderProfile.findOne({
        where: {
          [Op.or]: [{ id: providerId }, { user_id: providerId }]
        },
        include: [{ model: User, as: 'user' }]
      });
      if (assignedProviderProfile) assignedProviderUser = assignedProviderProfile.user;
    }
    if (!assignedProviderProfile && provider) {
      const pUser = await User.findOne({
        where: {
          [Op.or]: [{ email: provider.toLowerCase() }, { name: { [Op.like]: `%${provider}%` } }],
          role: 'provider'
        }
      });
      if (pUser) {
        assignedProviderProfile = await ProviderProfile.findOne({
          where: { user_id: pUser.id },
          include: [{ model: User, as: 'user' }]
        });
        if (assignedProviderProfile) assignedProviderUser = pUser;
      }
    }

    let baseAmount = Number(service.price || 0);
    let pricingType = 'fixed';

    if (assignedProviderProfile) {
      const mapping = await ProviderService.findOne({
        where: {
          provider_profile_id: assignedProviderProfile.id,
          service_id: service.id
        }
      });
      if (mapping) {
        const pPrice = mapping.base_price != null ? Number(mapping.base_price) : (mapping.custom_price != null ? Number(mapping.custom_price) : null);
        if (pPrice != null) baseAmount = pPrice;
        if (mapping.pricing_type) pricingType = mapping.pricing_type;
      }
    }

    const travelCharge = 0;
    const additionalCharge = 0;
    const discount = 0;
    const tax = 0;
    const finalAmount = Math.max(0, baseAmount + travelCharge + additionalCharge - discount + tax);

    return sendSuccess(res, {
      serviceId: service.id,
      serviceTitle: service.title,
      providerId: assignedProviderUser?.id || assignedProviderProfile?.id || null,
      providerName: assignedProviderProfile?.business_name || assignedProviderUser?.name || 'Verified Partner',
      pricing: {
        baseAmount,
        travelCharge,
        additionalCharge,
        discount,
        tax,
        finalAmount,
        pricingType,
        currency: 'INR'
      }
    }, 'Price quote calculated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Request additional charge for a booking (Provider)
// @route   POST /api/bookings/:id/additional-charges
// @access  Private (Provider)
const requestAdditionalCharge = async (req, res, next) => {
  try {
    const { amount, description } = req.body;
    const providerId = req.user.id || req.user._id;

    if (!amount || Number(amount) <= 0) {
      return sendError(res, 'Please provide a valid additional charge amount greater than 0', 400);
    }
    if (!description || !description.trim()) {
      return sendError(res, 'Please provide a reason / description for the additional charge', 400);
    }

    const booking = await Booking.findByPk(req.params.id, {
      include: bookingIncludes
    });
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.provider_id !== providerId && req.user.role !== 'admin') {
      return sendError(res, 'Forbidden. Only the assigned provider can request additional charges.', 403);
    }

    const allowedStatuses = ['accepted', 'confirmed', 'on_the_way', 'arrived', 'in_progress'];
    if (!allowedStatuses.includes(booking.status)) {
      return sendError(res, `Additional charges can only be requested while booking is active (${allowedStatuses.join(', ')}).`, 400);
    }

    const existingCharges = Array.isArray(booking.additional_charges) ? [...booking.additional_charges] : [];
    const newCharge = {
      id: `chg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      description: description.trim(),
      amount: Number(amount),
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    existingCharges.push(newCharge);
    booking.additional_charges = existingCharges;
    await booking.save();

    const io = req.app.get('io');
    const targetCustomerId = booking.customer_id || booking.customer?.id;

    if (targetCustomerId) {
      const notif = await Notification.create({
        recipient_id: targetCustomerId,
        title: 'Additional Charge Requested',
        message: `Provider requested an additional charge of ₹${amount} for: ${description.trim()}`,
        type: 'booking',
        link: `/customer/bookings/${booking.id}`,
        metadata: { bookingId: booking.id, chargeId: newCharge.id, amount }
      });
      if (io) {
        io.to(`user:${targetCustomerId}`).emit('notification', notif.toJSON());
        io.to(`booking:${booking.id}`).emit('additional_charge_requested', {
          bookingId: booking.id,
          charge: newCharge
        });
      }
    }

    const updatedBooking = await Booking.findByPk(booking.id, { include: bookingIncludes });
    return sendSuccess(res, { charge: newCharge, booking: updatedBooking.toJSON() }, 'Additional charge requested successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Respond to an additional charge request (Customer)
// @route   PUT /api/bookings/:id/additional-charges/:chargeId/respond
// @access  Private (Customer)
const respondAdditionalCharge = async (req, res, next) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    const customerId = req.user.id || req.user._id;

    if (!['approve', 'reject'].includes(action)) {
      return sendError(res, "Action must be either 'approve' or 'reject'", 400);
    }

    const booking = await Booking.findByPk(req.params.id, {
      include: bookingIncludes
    });
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.customer_id !== customerId && req.user.role !== 'admin') {
      return sendError(res, 'Forbidden. Only the booking customer can approve or reject charges.', 403);
    }

    const charges = Array.isArray(booking.additional_charges) ? [...booking.additional_charges] : [];
    const chargeIndex = charges.findIndex(c => c.id === req.params.chargeId);

    if (chargeIndex === -1) {
      return sendError(res, 'Additional charge request not found', 404);
    }

    if (charges[chargeIndex].status !== 'pending') {
      return sendError(res, `This charge has already been ${charges[chargeIndex].status}.`, 400);
    }

    charges[chargeIndex].status = action === 'approve' ? 'approved' : 'rejected';
    charges[chargeIndex].respondedAt = new Date().toISOString();

    if (action === 'approve') {
      const chargeAmount = Number(charges[chargeIndex].amount) || 0;
      booking.amount = Number(booking.amount || 0) + chargeAmount;
      const currentPricing = booking.pricing ? { ...booking.pricing } : {};
      currentPricing.additionalCharge = (Number(currentPricing.additionalCharge) || 0) + chargeAmount;
      currentPricing.finalAmount = booking.amount;
      booking.pricing = currentPricing;
    }

    booking.additional_charges = charges;
    await booking.save();

    const io = req.app.get('io');
    const targetProviderId = booking.provider_id || booking.provider?.id;

    if (targetProviderId) {
      const notif = await Notification.create({
        recipient_id: targetProviderId,
        title: `Additional Charge ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        message: `Customer ${action === 'approve' ? 'approved' : 'declined'} the ₹${charges[chargeIndex].amount} charge for #${booking.booking_number}.`,
        type: 'booking',
        link: `/provider/bookings`,
        metadata: { bookingId: booking.id, chargeId: req.params.chargeId, action }
      });
      if (io) {
        io.to(`user:${targetProviderId}`).emit('notification', notif.toJSON());
        io.to(`booking:${booking.id}`).emit('additional_charge_responded', {
          bookingId: booking.id,
          chargeId: req.params.chargeId,
          status: charges[chargeIndex].status,
          bookingAmount: booking.amount
        });
      }
    }

    const updatedBooking = await Booking.findByPk(booking.id, { include: bookingIncludes });
    return sendSuccess(res, { charge: charges[chargeIndex], booking: updatedBooking.toJSON() }, `Additional charge ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
  } catch (error) {
    next(error);
  }
};

// Lifecycle action helpers
const acceptBooking = (req, res, next) => { req.body.status = 'accepted'; return updateBookingStatus(req, res, next); };
const rejectBooking = (req, res, next) => { req.body.status = 'rejected'; return updateBookingStatus(req, res, next); };
const startTravelBooking = (req, res, next) => { req.body.status = 'on_the_way'; return updateBookingStatus(req, res, next); };
const arriveBooking = (req, res, next) => { req.body.status = 'arrived'; return updateBookingStatus(req, res, next); };
const startServiceBooking = (req, res, next) => { req.body.status = 'in_progress'; return updateBookingStatus(req, res, next); };
const completeBooking = (req, res, next) => { req.body.status = 'completed'; return updateBookingStatus(req, res, next); };

// @desc    Confirm cash payment received by provider
// @route   PATCH /api/bookings/:id/confirm-cash
// @access  Private (Provider / Admin)
const confirmCashPayment = async (req, res, next) => {
  try {
    const booking = await findBookingWithIncludes(req.params.id);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    const requesterId = req.user.id || req.user._id;
    const isAssignedProvider = booking.provider_id === requesterId;
    const isAdmin = req.user.role === 'admin';

    if (!isAssignedProvider && !isAdmin) {
      return sendError(res, 'Forbidden: Only the assigned provider or admin can confirm cash payment', 403);
    }

    if (booking.payment_method !== 'cash') {
      return sendError(res, `Booking payment method is '${booking.payment_method}', not cash`, 400);
    }

    booking.payment_status = 'cash_received';
    await booking.save();

    await Payment.create({
      booking_id: booking.id,
      user_id: booking.customer_id,
      gateway: 'cash',
      amount: booking.amount,
      currency: 'INR',
      payment_method: 'cash',
      status: 'captured',
      captured_at: new Date()
    });

    const io = req.app.get('io');
    if (io && booking.customer_id) {
      const custNotif = await Notification.create({
        recipient_id: booking.customer_id,
        title: 'Cash Payment Received',
        message: `Provider confirmed cash payment of ₹${booking.amount} for #${booking.booking_number}. Thank you!`,
        type: 'payment',
        link: `/customer/bookings/${booking.id}`,
        metadata: { bookingId: booking.id, status: 'cash_received' }
      });
      io.to(`user:${booking.customer_id}`).emit('notification', custNotif.toJSON());
      io.to(`booking:${booking.id}`).emit('payment_status_update', {
        bookingId: booking.id,
        paymentStatus: 'cash_received',
        paymentMethod: 'cash'
      });
    }

    const updatedBooking = await Booking.findByPk(booking.id, { include: bookingIncludes });
    return sendSuccess(res, updatedBooking.toJSON(), 'Cash payment confirmed successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  rescheduleBooking,
  cancelBooking,
  getBookingLocation,
  getBookingQuote,
  requestAdditionalCharge,
  respondAdditionalCharge,
  acceptBooking,
  rejectBooking,
  startTravelBooking,
  arriveBooking,
  startServiceBooking,
  completeBooking,
  confirmCashPayment
};
