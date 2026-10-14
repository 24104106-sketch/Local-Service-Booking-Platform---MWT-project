const { Wallet, WalletTransaction, Booking, Payment, sequelize } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');
const paymentService = require('../services/paymentService');

// Helper to get or create user wallet (strictly starting at 0.00)
const getOrCreateWallet = async (userId, transaction = null) => {
  const options = { where: { user_id: userId } };
  if (transaction) {
    options.transaction = transaction;
    options.lock = transaction.LOCK.UPDATE;
  }
  let wallet = await Wallet.findOne(options);
  if (!wallet) {
    wallet = await Wallet.create({ user_id: userId, balance: 0 }, transaction ? { transaction } : {});
  }
  return wallet;
};

// @desc    Get user's wallet balance
// @route   GET /api/wallet
// @access  Private
const getWallet = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const wallet = await getOrCreateWallet(userId);
    return sendSuccess(res, wallet.toJSON(), 'Wallet details retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get transaction history
// @route   GET /api/wallet/transactions
// @access  Private
const getTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const transactions = await WalletTransaction.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: 50
    });

    return sendSuccess(res, transactions.map(t => t.toJSON()), 'Wallet transactions retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Initiate a secure wallet top-up by creating a gateway order
// @route   POST /api/wallet/topup-order
// @access  Private
const createTopupOrder = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { amount } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return sendError(res, 'Please provide a valid top-up amount greater than 0', 400);
    }
    if (numAmount > 50000) {
      return sendError(res, 'Maximum top-up amount per transaction is ₹50,000', 400);
    }

    const orderResult = await paymentService.createPaymentOrder({
      userId,
      amount: numAmount,
      autoCapture: true, // Top-up captures immediately upon successful payment
      notes: { purpose: 'wallet_topup' }
    });

    return sendSuccess(res, orderResult, 'Wallet top-up order created', 201);
  } catch (error) {
    if (error.message.includes('not configured')) {
      return sendError(res, error.message, 503);
    }
    next(error);
  }
};

// @desc    Verify gateway payment and atomically credit user wallet
// @route   POST /api/wallet/verify-topup
// @access  Private
const verifyTopup = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const orderId = req.body.orderId || req.body.order_id || req.body.razorpay_order_id;
    const paymentId = req.body.paymentId || req.body.payment_id || req.body.razorpay_payment_id;
    const signature = req.body.signature || req.body.razorpay_signature;

    if (!orderId || !paymentId || !signature) {
      return sendError(res, 'Missing verification parameters (orderId, paymentId, signature required)', 400);
    }

    const result = await sequelize.transaction(async (t) => {
      // 1. Fetch & Lock Payment record
      let payment = await Payment.findOne({
        where: { gateway_order_id: orderId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!payment) {
        throw new Error('Payment order record not found');
      }

      if (payment.user_id !== userId) {
        throw new Error('Forbidden: You are not authorized to verify this payment');
      }

      // Idempotency: Block duplicate top-up verification replay attacks
      if (payment.status === 'captured') {
        const err = new Error('This payment order has already been verified and credited');
        err.statusCode = 409;
        throw err;
      }

      // 2. Cryptographic signature check
      const { keySecret } = paymentService.getRazorpayConfig();
      if (!keySecret) {
        throw new Error('Payment gateway secret key is not configured');
      }

      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      if (expectedSignature !== signature) {
        payment.status = 'failed';
        payment.failure_reason = 'Signature verification mismatch';
        await payment.save({ transaction: t });
        throw new Error('Invalid payment signature. Authentication failed');
      }

      // 3. Verify status with Razorpay
      const razorpay = paymentService.getRazorpayClient();
      if (!razorpay) {
        throw new Error('Payment gateway client unavailable');
      }

      const rzpPayment = await razorpay.payments.fetch(paymentId);
      if (!rzpPayment) {
        throw new Error('Payment transaction not found on gateway');
      }
      if (rzpPayment.order_id && rzpPayment.order_id !== orderId) {
        throw new Error('Payment order mismatch');
      }

      const isSuccessful = rzpPayment.status === 'captured' || rzpPayment.status === 'authorized';
      if (!isSuccessful) {
        payment.status = 'failed';
        payment.failure_reason = `Gateway status: ${rzpPayment.status}`;
        await payment.save({ transaction: t });
        throw new Error(`Payment is not in successful status: ${rzpPayment.status}`);
      }

      // If authorized but not yet captured, capture it now
      if (rzpPayment.status === 'authorized') {
        await razorpay.payments.capture(paymentId, rzpPayment.amount, rzpPayment.currency || 'INR');
      }

      // 4. Update Payment record
      payment.gateway_payment_id = paymentId;
      payment.gateway_signature = signature;
      payment.payment_method = rzpPayment.method || 'online';
      payment.status = 'captured';
      payment.captured_at = new Date();
      await payment.save({ transaction: t });

      // 5. Atomically credit user's wallet
      const topupAmount = Number(payment.amount);
      const wallet = await getOrCreateWallet(userId, t);
      wallet.balance = Number((Number(wallet.balance) + topupAmount).toFixed(2));
      await wallet.save({ transaction: t });

      // 6. Record immutable credit transaction
      const transaction = await WalletTransaction.create({
        user_id: userId,
        type: 'credit',
        amount: topupAmount,
        description: `Wallet top-up via ${rzpPayment.method || 'Razorpay'}`,
        reference_id: paymentId,
        balance_after: wallet.balance,
        status: 'success'
      }, { transaction: t });

      return {
        wallet: wallet.toJSON(),
        transaction: transaction.toJSON(),
        payment: payment.toJSON(),
        newBalance: wallet.balance,
        balance: wallet.balance
      };
    });

    return sendSuccess(res, result, 'Wallet funds credited successfully');
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    if (error.message.includes('Invalid payment signature') || error.message.includes('Authentication failed')) {
      return sendError(res, 'Payment verification failed', 400);
    }
    if (error.message.includes('Forbidden')) {
      return sendError(res, error.message, 403);
    }
    next(error);
  }
};

// @desc    Legacy top-up endpoint - Now secured against unverified manipulation
// @route   POST /api/wallet/topup
// @access  Private
const topUpWallet = async (req, res, next) => {
  // If payment credentials are provided, redirect to verified flow
  if (req.body.orderId && req.body.paymentId && req.body.signature) {
    return verifyTopup(req, res, next);
  }

  // Reject unverified fake topup requests
  return sendError(
    res,
    'Direct unverified wallet top-ups are disabled for security. Please create a payment order via POST /api/wallet/topup-order and verify via POST /api/wallet/verify-topup.',
    400
  );
};

// @desc    Pay from wallet for a booking (atomically with row locking)
// @route   POST /api/wallet/pay
// @access  Private
const payFromWallet = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { amount, bookingId, bookingNumber } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return sendError(res, 'Invalid payment amount', 400);
    }

    const result = await sequelize.transaction(async (t) => {
      let booking = null;
      if (bookingId || bookingNumber) {
        const searchCond = [];
        if (bookingId) searchCond.push({ id: bookingId });
        if (bookingNumber) searchCond.push({ booking_number: bookingNumber });

        booking = await Booking.findOne({
          where: { [require('sequelize').Op.or]: searchCond },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        if (!booking) {
          throw new Error('Booking not found');
        }
        if (booking.customer_id !== userId && req.user.role !== 'admin') {
          const err = new Error('Forbidden. You do not have permission to pay for this booking.');
          err.statusCode = 403;
          throw err;
        }
      }

      const wallet = await getOrCreateWallet(userId, t);

      if (Number(wallet.balance) < numAmount) {
        const err = new Error(`Insufficient wallet balance. Current balance is ₹${wallet.balance}, required ₹${numAmount}`);
        err.statusCode = 400;
        throw err;
      }

      // Deduct balance atomically
      wallet.balance = Number((Number(wallet.balance) - numAmount).toFixed(2));
      await wallet.save({ transaction: t });

      let updatedBooking = null;
      if (booking) {
        booking.payment_status = 'paid';
        booking.payment_method = 'wallet';
        await booking.save({ transaction: t });
        updatedBooking = booking.toJSON();

        // Create Payment record for audit
        await Payment.create({
          booking_id: booking.id,
          user_id: userId,
          gateway: 'wallet',
          amount: numAmount,
          currency: 'INR',
          payment_method: 'wallet',
          status: 'captured',
          captured_at: new Date()
        }, { transaction: t });
      }

      const transaction = await WalletTransaction.create({
        user_id: userId,
        type: 'debit',
        amount: numAmount,
        description: `Payment for booking #${booking ? booking.booking_number : (bookingNumber || bookingId)}`,
        reference_id: `PAY-${Date.now().toString().slice(-8)}`,
        balance_after: wallet.balance,
        status: 'success'
      }, { transaction: t });

      return {
        wallet: wallet.toJSON(),
        transaction: transaction.toJSON(),
        booking: updatedBooking
      };
    });

    return sendSuccess(res, result, 'Payment successful');
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

module.exports = {
  getWallet,
  getTransactions,
  createTopupOrder,
  verifyTopup,
  topUpWallet,
  payFromWallet
};
