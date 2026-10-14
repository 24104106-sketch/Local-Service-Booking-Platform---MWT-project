const express = require('express');
const router = express.Router();
const {
  getWallet,
  getTransactions,
  createTopupOrder,
  verifyTopup,
  topUpWallet,
  payFromWallet
} = require('../controllers/walletController');
const { requireAuth, checkDB } = require('../middleware/auth');

router.use(checkDB);
router.use(requireAuth);

router.get('/', getWallet);
router.get('/transactions', getTransactions);
router.post('/topup-order', createTopupOrder);
router.post('/verify-topup', verifyTopup);
router.post('/topup', topUpWallet);
router.post('/pay', payFromWallet);

module.exports = router;
