const paymentService = require('../services/paymentService');
const { Payment, Booking, Wallet, WalletTransaction, Notification } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * FixIt Local - Payment Controller
 * Coordinates order creation, verification, authorization, capture, and webhooks.
 */

// @desc    Get public gateway configuration for frontend checkout
// @route   GET /api/payments/config
// @access  Public
const getPaymentConfig = (req, res) => {
  return sendSuccess(res, {
    gateway: 'razorpay',
    keyId: paymentService.getPublicKey(),
    isConfigured: paymentService.isGatewayConfigured(),
    currency: 'INR'
  }, 'Payment configuration retrieved');
};

// @desc    Create payment order for booking or top-up
// @route   POST /api/payments/create-order
// @access  Private (Customer)
const createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const bookingId = req.body.bookingId || req.body.booking_id;
    const amount = req.body.amount || req.body.total_amount;
    const currency = req.body.currency || 'INR';

    const orderResult = await paymentService.createPaymentOrder({
      bookingId,
      userId,
      amount,
      currency,
      autoCapture: false // Always manual capture (authorization hold) for bookings
    });

    return sendSuccess(res, orderResult, 'Payment order created successfully', 201);
  } catch (error) {
    if (error.message.includes('not configured')) {
      return sendError(res, error.message, 503);
    }
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 404);
    }
    if (error.message.includes('Forbidden')) {
      return sendError(res, error.message, 403);
    }
    next(error);
  }
};

// @desc    Verify payment signature and authorize payment
// @route   POST /api/payments/verify
// @access  Private (Customer)
const verifyPayment = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const orderId = req.body.orderId || req.body.order_id || req.body.razorpay_order_id;
    const paymentId = req.body.paymentId || req.body.payment_id || req.body.razorpay_payment_id;
    const signature = req.body.signature || req.body.razorpay_signature;
    const io = req.app.get('io');

    const result = await paymentService.verifyAndAuthorizePayment({
      orderId,
      paymentId,
      signature,
      userId,
      io
    });

    return sendSuccess(res, result, 'Payment verified and authorized successfully');
  } catch (error) {
    if (error.message.includes('Invalid payment signature') || error.message.includes('Authentication failed')) {
      return sendError(res, 'Payment signature verification failed. Untrusted payment transaction.', 400);
    }
    next(error);
  }
};

// @desc    Get payment details for a specific booking
// @route   GET /api/payments/booking/:bookingId
// @access  Private (Customer / Provider / Admin)
const getBookingPayment = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const booking = await Booking.findByPk(req.params.bookingId);

    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    const isCustomer = booking.customer_id === userId;
    const isProvider = booking.provider_id === userId;
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return sendError(res, 'Forbidden: You do not have access to this booking payment', 403);
    }

    const payment = await Payment.findOne({
      where: { booking_id: booking.id },
      order: [['created_at', 'DESC']]
    });

    return sendSuccess(res, {
      bookingId: booking.id,
      paymentStatus: booking.payment_status,
      paymentMethod: booking.payment_method,
      amount: booking.amount,
      payment: payment ? payment.toJSON() : null
    }, 'Booking payment retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Handle Razorpay Webhooks (cryptographically verified)
// @route   POST /api/payments/webhook
// @access  Public (Signature-Verified)
const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing x-razorpay-signature header' });
    }

    // Use raw body for accurate HMAC signature check
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const isValid = paymentService.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.warn('[Webhook] Rejected untrusted webhook with invalid signature');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;
    const io = req.app.get('io');

    console.log(`[Webhook] Verified Razorpay event received: ${event}`);

    if (event === 'payment.captured') {
      const paymentEntity = payload.payment?.entity;
      if (paymentEntity) {
        const paymentRecord = await Payment.findOne({
          where: { gateway_order_id: paymentEntity.order_id }
        });
        if (paymentRecord && paymentRecord.status !== 'captured') {
          paymentRecord.status = 'captured';
          paymentRecord.captured_at = new Date();
          paymentRecord.gateway_payment_id = paymentEntity.id;
          await paymentRecord.save();

          if (paymentRecord.booking_id) {
            const booking = await Booking.findByPk(paymentRecord.booking_id);
            if (booking) {
              booking.payment_status = 'paid';
              booking.status = 'confirmed';
              await booking.save();
            }
          }
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      if (paymentEntity) {
        const paymentRecord = await Payment.findOne({
          where: { gateway_order_id: paymentEntity.order_id }
        });
        if (paymentRecord) {
          paymentRecord.status = 'failed';
          paymentRecord.failure_reason = paymentEntity.error_description || 'Payment failed';
          await paymentRecord.save();
        }
      }
    }

    return res.status(200).json({ status: 'ok', received: true });
  } catch (error) {
    console.error('[Webhook Error]:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getPaymentConfig,
  createOrder,
  verifyPayment,
  getBookingPayment,
  handleWebhook
};
