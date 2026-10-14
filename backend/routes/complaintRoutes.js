const express = require('express');
const router = express.Router();
const {
  createComplaint,
  getMyComplaints,
  getAllComplaints,
  updateComplaintStatus
} = require('../controllers/complaintController');
const { requireAuth, checkDB } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(checkDB);
router.use(requireAuth);

router.post('/', createComplaint);
router.get('/my', getMyComplaints);
router.get('/', requireRole('admin'), getAllComplaints);
router.put('/:id/status', requireRole('admin'), updateComplaintStatus);

module.exports = router;
