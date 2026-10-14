const express = require('express');
const router = express.Router();
const {
  getDashboardMetrics,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,
  getPendingProviders,
  getCategoryPoolStats,
  getAllProvidersAdmin,
  getProviderDetailsAdmin,
  verifyProvider,
  updateProviderActiveStatus,
  updateProviderRadius,
  getReportTypes,
  generateReport
} = require('../controllers/adminController');
const { requireAuth, checkDB } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(checkDB);
router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/metrics', getDashboardMetrics);
router.get('/stats', getDashboardMetrics);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.put('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

// Provider Pool & Management Routes
router.get('/providers/pool-stats', getCategoryPoolStats);
router.get('/providers/pending', getPendingProviders);
router.get('/provider-applications', getPendingProviders);
router.get('/providers', getAllProvidersAdmin);
router.get('/providers/:id', getProviderDetailsAdmin);
router.put('/providers/:id/verify', verifyProvider);
router.put('/providers/:id/approve', verifyProvider);
router.put('/providers/:id/status', updateProviderActiveStatus);
router.put('/providers/:id/radius', updateProviderRadius);
router.put('/provider-applications/:id/verify', verifyProvider);

router.get('/report-types', getReportTypes);
router.post('/reports', generateReport);

module.exports = router;

