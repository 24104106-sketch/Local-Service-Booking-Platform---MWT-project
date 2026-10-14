const { Complaint, Booking, User } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

// @desc    File a new complaint / ticket
// @route   POST /api/complaints
// @access  Private
const createComplaint = async (req, res, next) => {
  try {
    const { subject, description, category, bookingId, priority } = req.body;
    const userId = req.user.id || req.user._id;

    if (!subject || !description) {
      return sendError(res, 'Subject and description are required', 400);
    }

    let bookingNumber = '';
    if (bookingId) {
      const booking = await Booking.findByPk(bookingId);
      if (booking) bookingNumber = booking.booking_number;
    }

    const complaintCount = await Complaint.count();
    const ticketId = `TKT-${1000 + complaintCount + 1}`;

    const complaint = await Complaint.create({
      ticket_id: ticketId,
      user_id: userId,
      user_name: req.user.name,
      user_email: req.user.email,
      booking_id: bookingId || null,
      booking_number: bookingNumber,
      subject: subject.trim(),
      description: description.trim(),
      category: category || 'service_quality',
      priority: priority || 'medium',
      status: 'open'
    });

    return sendSuccess(res, complaint.toJSON(), 'Complaint filed successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's filed complaints
// @route   GET /api/complaints/my
// @access  Private
const getMyComplaints = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;

    const complaints = await Complaint.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: ['id', 'booking_number', 'service_title', 'date', 'status']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return sendSuccess(res, complaints.map(c => c.toJSON()), 'Complaints retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get all complaints (Admin only)
// @route   GET /api/complaints
// @access  Private (Admin)
const getAllComplaints = async (req, res, next) => {
  try {
    const { status, priority } = req.query;
    const where = {};

    if (status && status !== 'all') where.status = status;
    if (priority && priority !== 'all') where.priority = priority;

    const complaints = await Complaint.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'role']
        },
        {
          model: Booking,
          as: 'booking',
          attributes: ['id', 'booking_number', 'service_title', 'date', 'status']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return sendSuccess(res, complaints.map(c => c.toJSON()), 'All complaints retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Update complaint status / resolution (Admin)
// @route   PUT /api/complaints/:id/status
// @access  Private (Admin)
const updateComplaintStatus = async (req, res, next) => {
  try {
    const { status, adminNotes, resolution } = req.body;

    const complaint = await Complaint.findByPk(req.params.id);
    if (!complaint) {
      return sendError(res, 'Complaint ticket not found', 404);
    }

    if (status) complaint.status = status;
    if (adminNotes !== undefined) complaint.admin_notes = adminNotes;
    if (resolution !== undefined) complaint.resolution = resolution;

    await complaint.save();
    return sendSuccess(res, complaint.toJSON(), 'Complaint updated successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createComplaint,
  getMyComplaints,
  getAllComplaints,
  updateComplaintStatus
};
