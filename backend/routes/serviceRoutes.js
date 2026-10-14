const express = require('express');
const router = express.Router();
const {
  getAllServices,
  getServiceById,
  getCategories,
  createService,
  updateService,
  deleteService
} = require('../controllers/serviceController');
const { requireAuth, checkDB } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.get('/', checkDB, getAllServices);
router.get('/categories', checkDB, getCategories);
router.get('/:id', checkDB, getServiceById);

// Admin-protected service mutation routes
router.post('/', checkDB, requireAuth, requireRole('admin'), createService);
router.put('/:id', checkDB, requireAuth, requireRole('admin'), updateService);
router.delete('/:id', checkDB, requireAuth, requireRole('admin'), deleteService);

module.exports = router;
