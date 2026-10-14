const express = require('express');
const router = express.Router();
const {
  getRecentlyAccessed,
  recordRecentlyAccessed,
  clearRecentlyAccessed
} = require('../controllers/recentlyAccessedController');
const { requireAuth, checkDB } = require('../middleware/auth');

router.use(checkDB);
router.use(requireAuth);

router.get('/', getRecentlyAccessed);
router.post('/', recordRecentlyAccessed);
router.delete('/:id', clearRecentlyAccessed);
router.delete('/', clearRecentlyAccessed);

module.exports = router;
