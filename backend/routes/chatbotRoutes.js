const express = require('express');
const router = express.Router();
const {
  getHistory,
  postMessage,
  clearHistory
} = require('../controllers/chatbotController');
const { requireAuth, optionalAuth, checkDB } = require('../middleware/auth');

router.use(checkDB);

router.get('/history', requireAuth, getHistory);
router.post('/message', optionalAuth, postMessage);
router.delete('/history', requireAuth, clearHistory);

module.exports = router;
