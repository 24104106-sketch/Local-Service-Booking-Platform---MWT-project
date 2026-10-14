const express = require('express');
const router = express.Router();
const {
  getAllCommunities,
  getCommunityById,
  createCommunity,
  updateCommunity,
  toggleCommunityStatus,
  deleteCommunity
} = require('../controllers/communityController');
const { requireAuth, checkDB } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// Public / Customer routes
router.get('/', checkDB, getAllCommunities);
router.get('/:id', checkDB, getCommunityById);

// Admin-only management routes
router.post('/', checkDB, requireAuth, requireRole('admin'), createCommunity);
router.put('/:id', checkDB, requireAuth, requireRole('admin'), updateCommunity);
router.put('/:id/status', checkDB, requireAuth, requireRole('admin'), toggleCommunityStatus);
router.delete('/:id', checkDB, requireAuth, requireRole('admin'), deleteCommunity);

module.exports = router;
