const express = require('express');
const router = express.Router();
const { createReview, getProviderReviews, getAllReviews } = require('../controllers/reviewController');
const { requireAuth, checkDB } = require('../middleware/auth');

router.get('/', checkDB, getAllReviews);
router.get('/provider/:id', checkDB, getProviderReviews);
router.post('/', checkDB, requireAuth, createReview);

module.exports = router;
