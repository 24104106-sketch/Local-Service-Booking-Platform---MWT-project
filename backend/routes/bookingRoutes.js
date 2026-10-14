const express = require('express');
const router = express.Router();
const {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  rescheduleBooking,
  cancelBooking,
  getBookingLocation,
  getBookingQuote,
  requestAdditionalCharge,
  respondAdditionalCharge,
  acceptBooking,
  rejectBooking,
  startTravelBooking,
  arriveBooking,
  startServiceBooking,
  completeBooking,
  confirmCashPayment
} = require('../controllers/bookingController');
const { requireAuth, checkDB } = require('../middleware/auth');

router.use(checkDB);
router.use(requireAuth);

router.post('/', createBooking);
router.post('/quote', getBookingQuote);
router.get('/', getBookings);
router.get('/:id', getBookingById);
router.put('/:id/status', updateBookingStatus);
router.patch('/:id/status', updateBookingStatus);
router.put('/:id/reschedule', rescheduleBooking);
router.patch('/:id/reschedule', rescheduleBooking);
router.put('/:id/cancel', cancelBooking);
router.patch('/:id/cancel', cancelBooking);
router.get('/:id/location', getBookingLocation);
router.post('/:id/additional-charges', requestAdditionalCharge);
router.put('/:id/additional-charges/:chargeId/respond', respondAdditionalCharge);
router.patch('/:id/additional-charges/:chargeId/respond', respondAdditionalCharge);

// Action sub-path aliases
router.patch('/:id/accept', acceptBooking);
router.put('/:id/accept', acceptBooking);
router.patch('/:id/reject', rejectBooking);
router.put('/:id/reject', rejectBooking);
router.patch('/:id/start-travel', startTravelBooking);
router.put('/:id/start-travel', startTravelBooking);
router.patch('/:id/arrived', arriveBooking);
router.put('/:id/arrived', arriveBooking);
router.patch('/:id/start-service', startServiceBooking);
router.put('/:id/start-service', startServiceBooking);
router.patch('/:id/complete', completeBooking);
router.put('/:id/complete', completeBooking);
router.patch('/:id/confirm-cash', confirmCashPayment);
router.put('/:id/confirm-cash', confirmCashPayment);

module.exports = router;
