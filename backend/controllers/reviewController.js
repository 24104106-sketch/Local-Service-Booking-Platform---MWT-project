const { Op } = require('sequelize');
const { Review, Booking, ProviderProfile, User, Service } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

// @desc    Submit a review for a completed booking
// @route   POST /api/reviews
// @access  Private (Customer)
const createReview = async (req, res, next) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const customerId = req.user.id || req.user._id;

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return sendError(res, 'Please provide a valid rating between 1 and 5', 400);
    }

    if (!bookingId) {
      return sendError(res, 'A valid booking ID is required to submit a review.', 400);
    }

    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.customer_id !== customerId && req.user.role !== 'admin') {
      return sendError(res, 'Forbidden. You can only review bookings you have created.', 403);
    }

    if (booking.status !== 'completed' && req.user.role !== 'admin') {
      return sendError(res, 'Reviews can only be submitted for completed bookings.', 400);
    }

    const existingReview = await Review.findOne({
      where: {
        booking_id: booking.id,
        customer_id: customerId
      }
    });

    if (existingReview) {
      return sendError(res, 'You have already submitted a review for this booking.', 400);
    }

    const providerId = booking.provider_id;
    const serviceId = booking.service_id;

    const review = await Review.create({
      booking_id: booking.id,
      customer_id: customerId,
      provider_id: providerId,
      service_id: serviceId || null,
      rating: Number(rating),
      comment: comment || ''
    });

    // Recalculate provider rating average
    const allProviderReviews = await Review.findAll({ where: { provider_id: providerId } });
    if (allProviderReviews.length > 0) {
      const avg = allProviderReviews.reduce((sum, r) => sum + r.rating, 0) / allProviderReviews.length;
      const profile = await ProviderProfile.findOne({ where: { user_id: providerId } });
      if (profile) {
        profile.rating = Number(avg.toFixed(1));
        profile.review_count = allProviderReviews.length;
        await profile.save();
      }
    }

    const populatedReview = await Review.findByPk(review.id, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'avatar'] },
        { model: User, as: 'provider', attributes: ['id', 'name'] },
        { model: Service, as: 'service', attributes: ['id', 'title'] }
      ]
    });

    return sendSuccess(res, populatedReview.toJSON(), 'Review submitted successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Get reviews for a provider
// @route   GET /api/reviews/provider/:id
// @access  Public
const getProviderReviews = async (req, res, next) => {
  try {
    const providerId = req.params.id;

    const reviews = await Review.findAll({
      where: {
        [Op.or]: [{ provider_id: providerId }, { id: providerId }]
      },
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'avatar'] },
        { model: Service, as: 'service', attributes: ['id', 'title'] }
      ],
      order: [['created_at', 'DESC']]
    });

    return sendSuccess(res, reviews.map(r => r.toJSON()), 'Reviews retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reviews with optional filters
// @route   GET /api/reviews
// @access  Public
const getAllReviews = async (req, res, next) => {
  try {
    const { providerId, bookingId, customerId } = req.query;
    const where = {};
    if (providerId) where.provider_id = providerId;
    if (bookingId) where.booking_id = bookingId;
    if (customerId) where.customer_id = customerId;

    const reviews = await Review.findAll({
      where,
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'avatar'] },
        { model: User, as: 'provider', attributes: ['id', 'name', 'avatar'] },
        { model: Service, as: 'service', attributes: ['id', 'title'] }
      ],
      order: [['created_at', 'DESC']]
    });

    return sendSuccess(res, reviews.map(r => r.toJSON()), 'Reviews retrieved');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getProviderReviews,
  getAllReviews
};
