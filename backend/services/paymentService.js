const crypto = require('crypto');
const Razorpay = require('razorpay');
const { Payment, Booking, User, Wallet, WalletTransaction, Notification, sequelize } = require('../models');

/**
 * FixIt Local - Dedicated Real Payment Gateway Service (Razorpay)
 * Supports Two-Step Payment Authorization (Hold), Manual Capture,
 * Release/Void, Refund, and Cryptographic Webhook Verification.
 */

let cachedRazorpayInstance = null;

function createTestRazorpayClient(keyId, keySecret) {
  return {
    orders: {
      create: async (options) => {
        const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;
        return {
          id: orderId,
          entity: 'order',
          amount: options.amount,
          amount_paid: 0,
          amount_due: options.amount,
          currency: options.currency || 'INR',
          receipt: options.receipt,
          status: 'created',
          attempts: 0,
          notes: options.notes || {},
          created_at: Math.floor(Date.now() / 1000)
        };
      }
    },
    payments: {
      fetch: async (paymentId) => {
        return {
          id: paymentId,
          entity: 'payment',
          amount: 25000,
          currency: 'INR',
          status: 'authorized',
          method: 'card',
          captured: false
        };
      },
      capture: async (paymentId, amount, currency) => {
        return {
          id: paymentId,
          entity: 'payment',
          amount,
          currency: currency || 'INR',
          status: 'captured',
          captured: true
        };
      },
      refund: async (paymentId, options = {}) => {
        return {
          id: `rfnd_${crypto.randomBytes(8).toString('hex')}`,
          entity: 'refund',
          payment_id: paymentId,
          amount: options.amount || 25000,
          currency: 'INR',
          status: 'processed'
        };
      }
    }
  };
}

function getRazorpayConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasLiveKeys = Boolean(
    (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('fixit_local')) ||
    (process.env.PAYMENT_GATEWAY_KEY && !process.env.PAYMENT_GATEWAY_KEY.includes('fixit_local'))
  );

  // In production, mock payments are strictly forbidden.
  // Test-mode mock client is only permitted in isolated non-production environments (test/development).
  const isTest = !isProduction && (
    process.env.PAYMENT_TEST_MODE === 'true' ||
    process.env.NODE_ENV === 'test' ||
    !hasLiveKeys
  );

  const rawKeyId = (process.env.RAZORPAY_KEY_ID || process.env.PAYMENT_GATEWAY_KEY || '').trim();
  const rawKeySecret = (process.env.RAZORPAY_KEY_SECRET || process.env.PAYMENT_GATEWAY_SECRET || '').trim();
  const rawWebhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || '').trim();

  // In production, reject mock/placeholder credentials
  const validKeyId = (!isProduction || (rawKeyId && !rawKeyId.includes('fixit_local'))) ? rawKeyId : '';
  const validKeySecret = (!isProduction || (rawKeySecret && !rawKeySecret.includes('fixit_local'))) ? rawKeySecret : '';
  const validWebhookSecret = (!isProduction || (rawWebhookSecret && !rawWebhookSecret.includes('fixit_local'))) ? rawWebhookSecret : '';

  const keyId = validKeyId || (isTest ? 'rzp_test_fixit_local' : '');
  const keySecret = validKeySecret || (isTest ? 'fixit_local_test_secret_key' : '');
  const webhookSecret = validWebhookSecret || (isTest ? 'fixit_local_test_webhook_secret' : '');

  return { keyId, keySecret, webhookSecret, isTest };
}

function getRazorpayClient() {
  if (cachedRazorpayInstance) return cachedRazorpayInstance;

  const { keyId, keySecret, isTest } = getRazorpayConfig();
  if (keyId && keySecret) {
    if (isTest) {
      cachedRazorpayInstance = createTestRazorpayClient(keyId, keySecret);
      return cachedRazorpayInstance;
    }
    cachedRazorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    return cachedRazorpayInstance;
  }
  return null;
}

function isGatewayConfigured() {
  const { keyId, keySecret, isTest } = getRazorpayConfig();
  if (process.env.NODE_ENV === 'production') {
    return Boolean(keyId && keySecret && !isTest && !keyId.includes('fixit_local'));
  }
  return Boolean(keyId && keySecret);
}

function getPublicKey() {
  const { keyId, isTest } = getRazorpayConfig();
  if (process.env.NODE_ENV === 'production' && isTest) {
    return '';
  }
  return keyId || '';
}

/**
 * Create a new payment order with Razorpay.
 * For bookings, payment_capture is set to 0 (MANUAL CAPTURE / TWO-STEP AUTHORIZATION),
 * placing an authorization hold on customer funds until provider accepts.
 */
async function createPaymentOrder({ bookingId, userId, amount, currency = 'INR', notes = {}, autoCapture = false }) {
  let targetAmount = Number(amount);
  let booking = null;

  if (bookingId) {
    booking = await Booking.findByPk(bookingId);
    if (!booking) {
      throw new Error(`Booking #${bookingId} not found`);
    }
    if (booking.customer_id !== Number(userId)) {
      throw new Error('Forbidden: You are not authorized to pay for this booking');
    }

    // Authoritative amount validation directly from Booking record
    targetAmount = Number(booking.amount);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      throw new Error('Invalid booking amount');
    }

    // Check if an existing successful or authorized payment exists
    const existingActivePayment = await Payment.findOne({
      where: {
        booking_id: booking.id,
        status: ['authorized', 'captured']
      }
    });

    if (existingActivePayment) {
      if (existingActivePayment.status === 'captured') {
        throw new Error('This booking has already been paid and captured');
      }
      // Return existing authorized payment details
      return {
        success: true,
        orderId: existingActivePayment.gateway_order_id,
        paymentId: existingActivePayment.gateway_payment_id,
        amount: existingActivePayment.amount,
        currency: existingActivePayment.currency,
        status: existingActivePayment.status,
        keyId: getPublicKey(),
        isAlreadyAuthorized: true
      };
    }
  }

  if (isNaN(targetAmount) || targetAmount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    throw new Error('Payment gateway is not configured. Please ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are configured in environment variables.');
  }

  const amountInPaise = Math.round(targetAmount * 100);
  const receiptId = `rcpt_${bookingId ? `bk${bookingId}` : `topup${userId}`}_${Date.now()}`.slice(0, 40);

  // For booking payments: payment_capture = 0 (Two-step Authorization Hold)
  // For wallet top-ups: payment_capture = 1 (Immediate capture upon authorization)
  const orderOptions = {
    amount: amountInPaise,
    currency: currency.toUpperCase(),
    receipt: receiptId,
    payment_capture: autoCapture ? 1 : 0,
    notes: {
      bookingId: bookingId ? String(bookingId) : '',
      userId: String(userId),
      ...notes
    }
  };

  const razorpayOrder = await razorpay.orders.create(orderOptions);

  // Persist Payment record in MySQL
  const paymentRecord = await Payment.create({
    booking_id: booking ? booking.id : null,
    user_id: userId,
    gateway: 'razorpay',
    gateway_order_id: razorpayOrder.id,
    gateway_reference_id: receiptId,
    amount: targetAmount,
    currency: currency.toUpperCase(),
    payment_method: 'online',
    status: 'created',
    metadata: {
      razorpayOrderNotes: orderOptions.notes,
      autoCapture: Boolean(autoCapture)
    }
  });

  return {
    success: true,
    orderId: razorpayOrder.id,
    order_id: razorpayOrder.id,
    paymentRecordId: paymentRecord.id,
    amount: targetAmount,
    currency: currency.toUpperCase(),
    keyId: getPublicKey(),
    captureMethod: autoCapture ? 'automatic' : 'manual_hold'
  };
}

/**
 * Verify client payment credentials and mark Payment as AUTHORIZED.
 * Verifies HMAC SHA256 signature using RAZORPAY_KEY_SECRET.
 */
async function verifyAndAuthorizePayment({ orderId, paymentId, signature, userId, io }) {
  if (!orderId || !paymentId || !signature) {
    throw new Error('Missing payment verification parameters (orderId, paymentId, signature required)');
  }

  const { keySecret } = getRazorpayConfig();
  if (!keySecret) {
    throw new Error('Payment gateway secret key is not configured');
  }

  // 1. Cryptographic HMAC SHA256 verification
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature !== signature) {
    throw new Error('Invalid payment signature. Authentication failed');
  }

  // 2. Fetch payment details from Razorpay to verify authoritative gateway state
  const razorpay = getRazorpayClient();
  if (!razorpay) {
    throw new Error('Payment gateway client unavailable');
  }

  const rzpPayment = await razorpay.payments.fetch(paymentId);
  if (!rzpPayment) {
    throw new Error('Payment transaction not found on gateway');
  }
  if (rzpPayment.order_id && rzpPayment.order_id !== orderId) {
    throw new Error('Payment does not match the generated order ID');
  }

  // 3. Atomically update Payment record inside MySQL transaction
  const updatedResult = await sequelize.transaction(async (t) => {
    let payment = await Payment.findOne({
      where: { gateway_order_id: orderId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!payment) {
      payment = await Payment.create({
        user_id: userId,
        gateway: 'razorpay',
        gateway_order_id: orderId,
        gateway_payment_id: paymentId,
        amount: Number((rzpPayment.amount / 100).toFixed(2)),
        currency: rzpPayment.currency || 'INR',
        payment_method: rzpPayment.method || 'online',
        status: 'created'
      }, { transaction: t });
    }

    // Determine status from gateway: if already captured (autoCapture=true), use captured, else authorized
    const isCaptured = rzpPayment.status === 'captured';
    const isAuthorized = rzpPayment.status === 'authorized' || isCaptured;

    if (!isAuthorized) {
      payment.status = 'failed';
      payment.failure_reason = `Gateway status: ${rzpPayment.status}`;
      await payment.save({ transaction: t });
      throw new Error(`Payment is not in authorized state (Current state: ${rzpPayment.status})`);
    }

    payment.gateway_payment_id = paymentId;
    payment.gateway_signature = signature;
    payment.payment_method = rzpPayment.method || payment.payment_method;
    payment.authorization_id = paymentId;
    payment.status = isCaptured ? 'captured' : 'authorized';
    if (isCaptured) {
      payment.captured_at = new Date();
    }
    await payment.save({ transaction: t });

    // Update associated booking if applicable
    let updatedBooking = null;
    if (payment.booking_id) {
      const booking = await Booking.findByPk(payment.booking_id, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (booking) {
        booking.payment_method = rzpPayment.method || 'card';
        booking.payment_status = isCaptured ? 'paid' : 'authorized';
        await booking.save({ transaction: t });
        updatedBooking = booking;
      }
    }

    return { payment, booking: updatedBooking, rzpPayment };
  });

  const { payment, booking } = updatedResult;

  // Real-time socket events & notifications
  if (io && booking) {
    // Notify customer: Payment Authorized (Funds held securely)
    const custNotif = await createSafeNotification({
      recipient_id: booking.customer_id,
      title: 'Payment Authorized (On Hold)',
      message: `Your payment of ₹${payment.amount} is securely held. It will only be captured once the provider accepts your booking.`,
      type: 'payment',
      link: `/customer/bookings/${booking.id}`,
      metadata: { bookingId: booking.id, paymentId: payment.id, status: 'authorized' }
    });

    io.to(`user:${booking.customer_id}`).emit('notification', custNotif.toJSON());

    // Notify provider: Booking ready with guaranteed payment hold
    if (booking.provider_id) {
      const provNotif = await createSafeNotification({
        recipient_id: booking.provider_id,
        title: 'New Service Request (Payment Secured)',
        message: `Booking #${booking.booking_number} payment is held in escrow. Accept to confirm job and capture payment.`,
        type: 'booking',
        link: `/provider/bookings`,
        metadata: { bookingId: booking.id, paymentId: payment.id }
      });
      io.to(`user:${booking.provider_id}`).emit('notification', provNotif.toJSON());
    }

    io.to(`booking:${booking.id}`).emit('payment_authorized', {
      bookingId: booking.id,
      paymentId: payment.id,
      amount: payment.amount,
      status: payment.status
    });
  }

  return {
    success: true,
    payment: payment.toJSON(),
    booking: booking ? booking.toJSON() : null,
    payment_status: payment.status,
    status: payment.status,
    gatewayStatus: rzpPayment.status
  };
}

/**
 * Capture authorized payment upon Provider Acceptance.
 * Calls Razorpay API: POST /v1/payments/{payment_id}/capture
 */
async function capturePayment({ bookingId, paymentId, io }) {
  const razorpay = getRazorpayClient();
  if (!razorpay) {
    throw new Error('Payment gateway client is not configured');
  }

  return await sequelize.transaction(async (t) => {
    let payment = null;
    if (paymentId) {
      payment = await Payment.findByPk(paymentId, { transaction: t, lock: t.LOCK.UPDATE });
    } else if (bookingId) {
      payment = await Payment.findOne({
        where: { booking_id: bookingId },
        order: [['created_at', 'DESC']],
        transaction: t,
        lock: t.LOCK.UPDATE
      });
    }

    if (!payment) {
      throw new Error(`No payment record found for capture`);
    }

    // Idempotent: if already captured, return immediately
    if (payment.status === 'captured') {
      return { success: true, payment: payment.toJSON(), alreadyCaptured: true };
    }

    if (payment.status !== 'authorized') {
      throw new Error(`Cannot capture payment in '${payment.status}' status (must be 'authorized')`);
    }

    // Capture with Razorpay
    const amountInPaise = Math.round(payment.amount * 100);
    const rzpCaptureResult = await razorpay.payments.capture(
      payment.gateway_payment_id,
      amountInPaise,
      payment.currency || 'INR'
    );

    payment.status = 'captured';
    payment.captured_at = new Date();
    await payment.save({ transaction: t });

    // Update booking status
    if (payment.booking_id) {
      const booking = await Booking.findByPk(payment.booking_id, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (booking) {
        booking.payment_status = 'paid';
        booking.status = 'confirmed';
        await booking.save({ transaction: t });

        if (io) {
          const custNotif = await createSafeNotification({
            recipient_id: booking.customer_id,
            title: 'Payment Captured & Booking Confirmed',
            message: `Your booking #${booking.booking_number} is now confirmed! Payment of ₹${payment.amount} has been captured.`,
            type: 'payment',
            link: `/customer/bookings/${booking.id}`,
            metadata: { bookingId: booking.id, paymentId: payment.id, status: 'captured' }
          });
          io.to(`user:${booking.customer_id}`).emit('notification', custNotif.toJSON());
          io.to(`booking:${booking.id}`).emit('payment_captured', {
            bookingId: booking.id,
            paymentId: payment.id,
            amount: payment.amount
          });
        }
      }
    }

    return {
      success: true,
      payment: payment.toJSON(),
      gatewayResult: rzpCaptureResult
    };
  });
}

/**
 * Release/Void payment authorization when Provider Rejects or Booking is Cancelled before capture.
 * Calls Razorpay API: POST /v1/payments/{payment_id}/refund (for authorized payments, this voids the hold).
 */
async function releasePaymentHold({ bookingId, paymentId, reason = 'Provider declined booking', io }) {
  const razorpay = getRazorpayClient();
  if (!razorpay) {
    throw new Error('Payment gateway client is not configured');
  }

  return await sequelize.transaction(async (t) => {
    let payment = null;
    if (paymentId) {
      payment = await Payment.findByPk(paymentId, { transaction: t, lock: t.LOCK.UPDATE });
    } else if (bookingId) {
      payment = await Payment.findOne({
        where: { booking_id: bookingId },
        order: [['created_at', 'DESC']],
        transaction: t,
        lock: t.LOCK.UPDATE
      });
    }

    if (!payment) {
      return { success: false, message: 'No payment record found' };
    }

    if (payment.status === 'voided') {
      return { success: true, payment: payment.toJSON(), alreadyVoided: true };
    }

    if (payment.status !== 'authorized') {
      // If already captured, it needs full refund instead
      if (payment.status === 'captured') {
        return await refundCapturedPaymentInternal(payment, { reason, t, io });
      }
      return { success: false, message: `Payment is not in authorized state (current: ${payment.status})` };
    }

    // For authorized Razorpay payments, calling refund releases the hold back to customer's account/card
    const amountInPaise = Math.round(payment.amount * 100);
    const rzpVoidResult = await razorpay.payments.refund(payment.gateway_payment_id, {
      amount: amountInPaise,
      notes: { reason }
    });

    payment.status = 'voided';
    payment.released_at = new Date();
    payment.failure_reason = reason;
    await payment.save({ transaction: t });

    if (payment.booking_id) {
      const booking = await Booking.findByPk(payment.booking_id, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (booking) {
        booking.payment_status = 'refunded';
        await booking.save({ transaction: t });

        if (io) {
          const custNotif = await createSafeNotification({
            recipient_id: booking.customer_id,
            title: 'Payment Authorization Released',
            message: `The payment hold of ₹${payment.amount} for #${booking.booking_number} has been released back to your account.`,
            type: 'payment',
            link: `/customer/bookings/${booking.id}`,
            metadata: { bookingId: booking.id, paymentId: payment.id, status: 'voided' }
          });
          io.to(`user:${booking.customer_id}`).emit('notification', custNotif.toJSON());
          io.to(`booking:${booking.id}`).emit('payment_released', {
            bookingId: booking.id,
            paymentId: payment.id,
            amount: payment.amount
          });
        }
      }
    }

    return {
      success: true,
      payment: payment.toJSON(),
      gatewayResult: rzpVoidResult
    };
  });
}

/**
 * Refund a previously captured payment.
 */
async function refundCapturedPaymentInternal(payment, { reason, t, io }) {
  const razorpay = getRazorpayClient();
  const amountInPaise = Math.round(payment.amount * 100);

  const rzpRefundResult = await razorpay.payments.refund(payment.gateway_payment_id, {
    amount: amountInPaise,
    notes: { reason: reason || 'Booking cancelled after capture' }
  });

  payment.status = 'refunded';
  payment.refunded_at = new Date();
  payment.failure_reason = reason;
  await payment.save({ transaction: t });

  if (payment.booking_id) {
    const booking = await Booking.findByPk(payment.booking_id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (booking) {
      booking.payment_status = 'refunded';
      await booking.save({ transaction: t });

      if (io) {
        const custNotif = await createSafeNotification({
          recipient_id: booking.customer_id,
          title: 'Payment Refunded',
          message: `Your payment of ₹${payment.amount} for booking #${booking.booking_number} has been refunded.`,
          type: 'payment',
          link: `/customer/bookings/${booking.id}`,
          metadata: { bookingId: booking.id, paymentId: payment.id, status: 'refunded' }
        });
        io.to(`user:${booking.customer_id}`).emit('notification', custNotif.toJSON());
        io.to(`booking:${booking.id}`).emit('payment_refunded', {
          bookingId: booking.id,
          paymentId: payment.id,
          amount: payment.amount
        });
      }
    }
  }

  return {
    success: true,
    payment: payment.toJSON(),
    gatewayResult: rzpRefundResult
  };
}

/**
 * Helper to prevent duplicate notifications during retries and concurrent events.
 */
async function createSafeNotification({ recipient_id, title, message, type = 'booking', link = '', metadata = {} }) {
  const eventKey = metadata.eventKey || `${metadata.bookingId || metadata.paymentId || ''}_${metadata.status || title}`;
  
  // Check if identical notification was created in the last 15 seconds
  const fifteenSecsAgo = new Date(Date.now() - 15000);
  const existing = await Notification.findOne({
    where: {
      recipient_id,
      title,
      created_at: { [require('sequelize').Op.gte]: fifteenSecsAgo }
    }
  });

  if (existing) {
    return existing;
  }

  return await Notification.create({
    recipient_id,
    title,
    message,
    type,
    link,
    metadata
  });
}

/**
 * Webhook signature verification and idempotent event dispatcher.
 */
function verifyWebhookSignature(rawBody, signature) {
  const { webhookSecret } = getRazorpayConfig();
  if (!webhookSecret) {
    throw new Error('PAYMENT_WEBHOOK_SECRET is not configured on server');
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  return expectedSignature === signature;
}

function _resetCachedClient() {
  cachedRazorpayInstance = null;
}

module.exports = {
  getRazorpayConfig,
  getRazorpayClient,
  isGatewayConfigured,
  getPublicKey,
  createPaymentOrder,
  verifyAndAuthorizePayment,
  capturePayment,
  releasePaymentHold,
  createSafeNotification,
  verifyWebhookSignature,
  _resetCachedClient
};
