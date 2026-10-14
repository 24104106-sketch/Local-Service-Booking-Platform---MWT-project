const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  googleLogin,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} = require('../controllers/authController');
const { requireAuth, checkDB } = require('../middleware/auth');

router.post('/register', checkDB, register);
router.post('/login', checkDB, login);
router.get('/me', checkDB, requireAuth, getMe);
router.put('/profile', checkDB, requireAuth, updateProfile);
router.post('/forgot-password', checkDB, forgotPassword);
router.post('/reset-password', checkDB, resetPassword);
router.post('/google', checkDB, googleLogin);

// Saved address routes
router.get('/addresses', checkDB, requireAuth, getAddresses);
router.post('/addresses', checkDB, requireAuth, addAddress);
router.put('/addresses/:id', checkDB, requireAuth, updateAddress);
router.delete('/addresses/:id', checkDB, requireAuth, deleteAddress);
router.put('/addresses/:id/default', checkDB, requireAuth, setDefaultAddress);

module.exports = router;

