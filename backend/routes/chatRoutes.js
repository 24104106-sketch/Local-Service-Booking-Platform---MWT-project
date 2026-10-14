const express = require('express');
const router = express.Router();
const {
  getConversations,
  getMessages,
  sendMessage
} = require('../controllers/chatController');
const { requireAuth, checkDB } = require('../middleware/auth');

router.use(checkDB);
router.use(requireAuth);

router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getMessages);
router.post('/messages', sendMessage);

module.exports = router;
