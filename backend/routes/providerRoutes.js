const express = require('express');
const router = express.Router();
const {
  getAllProviders,
  getProviderById,
  getMyProviderProfile,
  updateMyProviderProfile,
  updateLiveLocation,
  getProviderStats,
  getProviderServices,
  updateServicePricing,
  addServiceToProvider,
  removeServiceFromProvider,
  getAvailableProviders,
  getNearbyProviders,
  getRecommendedProvidersHandler,
  getProviderAvailabilitySlots,
  getMyAvailability,
  getProviderDailySchedule,
  saveDailySchedule,
  addBusyInterval,
  updateBusyInterval,
  deleteBusyInterval,
  quickActionAvailability,
  restoreDailyAvailability,
  updateAvailability
} = require('../controllers/providerController');
const { requireAuth, checkDB } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.get('/', checkDB, getAllProviders);
router.get('/recommended', checkDB, getRecommendedProvidersHandler);
router.get('/nearby', checkDB, getNearbyProviders);
router.post('/available', checkDB, getAvailableProviders);
router.get('/available', checkDB, getAvailableProviders);
router.get('/profile/me', checkDB, requireAuth, requireRole('provider'), getMyProviderProfile);
router.put('/profile/me', checkDB, requireAuth, requireRole('provider'), updateMyProviderProfile);
router.post('/location', checkDB, requireAuth, requireRole('provider'), updateLiveLocation);
router.get('/dashboard/stats', checkDB, requireAuth, requireRole('provider'), getProviderStats);

// Provider Availability Configuration (Weekly & Recurring)
router.get('/availability', checkDB, requireAuth, requireRole('provider'), getMyAvailability);
router.get('/availability/me', checkDB, requireAuth, requireRole('provider'), getMyAvailability);
router.put('/availability', checkDB, requireAuth, requireRole('provider'), updateAvailability);

// Provider Daily Availability & Schedule Overrides
router.get('/availability/daily', checkDB, requireAuth, requireRole('provider'), getProviderDailySchedule);
router.put('/availability/daily', checkDB, requireAuth, requireRole('provider'), saveDailySchedule);
router.post('/availability/daily', checkDB, requireAuth, requireRole('provider'), saveDailySchedule);
router.delete('/availability/daily', checkDB, requireAuth, requireRole('provider'), restoreDailyAvailability);

// Provider Busy Intervals & Breaks Management
router.post('/availability/busy-interval', checkDB, requireAuth, requireRole('provider'), addBusyInterval);
router.put('/availability/busy-interval/:intervalId', checkDB, requireAuth, requireRole('provider'), updateBusyInterval);
router.delete('/availability/busy-interval/:intervalId', checkDB, requireAuth, requireRole('provider'), deleteBusyInterval);

// Quick Action Availability (Rest of today, day off, restore, block time)
router.post('/availability/quick-action', checkDB, requireAuth, requireRole('provider'), quickActionAvailability);

// Provider Service Offerings & Pricing
router.get('/services', checkDB, requireAuth, requireRole('provider'), getProviderServices);
router.put('/services/:serviceId', checkDB, requireAuth, requireRole('provider'), updateServicePricing);
router.post('/services', checkDB, requireAuth, requireRole('provider'), addServiceToProvider);
router.delete('/services/:serviceId', checkDB, requireAuth, requireRole('provider'), removeServiceFromProvider);

router.get('/:id/availability', checkDB, getProviderAvailabilitySlots);
router.get('/:id/slots', checkDB, getProviderAvailabilitySlots);
router.get('/:id', checkDB, getProviderById);

module.exports = router;
