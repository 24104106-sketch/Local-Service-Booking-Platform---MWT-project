const express = require('express');
const router = express.Router();
const {
  getPaymentConfig,
  createOrder,
  verifyPayment,
  getBookingPayment,
  handleWebhook
} = require('../controllers/paymentController');
const { requireAuth, checkDB } = require('../middleware/auth');

// Public route to get client-side gateway key
router.get('/config', getPaymentConfig);

// Webhook endpoint (Signature verified, does not require user JWT)
router.post('/webhook', handleWebhook);

// Protected routes
router.use(checkDB);
router.use(requireAuth);

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.get('/booking/:bookingId', getBookingPayment);

module.exports = router;
