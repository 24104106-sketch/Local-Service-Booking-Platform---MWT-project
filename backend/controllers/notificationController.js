const { Notification } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

// @desc    Get current user's notifications
// @route   GET /api/notifications
// @access  Private
const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;

    const notifications = await Notification.findAll({
      where: { recipient_id: userId },
      order: [['created_at', 'DESC']],
      limit: 50
    });

    const unreadCount = await Notification.count({
      where: {
        recipient_id: userId,
        read: false
      }
    });

    return sendSuccess(res, {
      notifications: notifications.map(n => n.toJSON()),
      unreadCount
    }, 'Notifications retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        recipient_id: userId
      }
    });

    if (!notification) {
      return sendError(res, 'Notification not found', 404);
    }

    notification.read = true;
    await notification.save();

    return sendSuccess(res, notification.toJSON(), 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all user's notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;

    await Notification.update(
      { read: true },
      {
        where: {
          recipient_id: userId,
          read: false
        }
      }
    );

    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead
};
