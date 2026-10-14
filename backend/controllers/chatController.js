const { Op } = require('sequelize');
const { ChatConversation, ChatMessage, Booking, User } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

// @desc    Get all conversations for logged-in user
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;

    const conversations = await ChatConversation.findAll({
      where: {
        [Op.or]: [
          { customer_id: userId },
          { provider_id: userId }
        ]
      },
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone', 'avatar', 'role']
        },
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name', 'email', 'phone', 'avatar', 'role']
        },
        {
          model: Booking,
          as: 'booking',
          attributes: ['id', 'booking_number', 'service_title', 'status', 'category']
        }
      ],
      order: [['updated_at', 'DESC']]
    });

    return sendSuccess(res, conversations.map(c => c.toJSON()), 'Conversations retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get messages for a conversation or booking
// @route   GET /api/chat/conversations/:id/messages
// @access  Private
const getMessages = async (req, res, next) => {
  try {
    const { id } = req.params; // Can be conversationId or bookingId
    const userId = req.user.id || req.user._id;

    let conversation = await ChatConversation.findOne({
      where: {
        [Op.or]: [{ id }, { booking_id: id }],
        [Op.and]: [
          {
            [Op.or]: [
              { customer_id: userId },
              { provider_id: userId }
            ]
          }
        ]
      },
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'avatar', 'role'] },
        { model: User, as: 'provider', attributes: ['id', 'name', 'avatar', 'role'] }
      ]
    });

    if (!conversation) {
      // Check if this is a valid booking where user is a participant
      const booking = await Booking.findOne({
        where: {
          id,
          [Op.or]: [{ customer_id: userId }, { provider_id: userId }]
        }
      });

      if (booking && booking.provider_id) {
        // Create conversation automatically
        conversation = await ChatConversation.create({
          booking_id: booking.id,
          customer_id: booking.customer_id,
          provider_id: booking.provider_id,
          last_message: 'Conversation started',
          last_message_at: new Date()
        });

        conversation = await ChatConversation.findByPk(conversation.id, {
          include: [
            { model: User, as: 'customer', attributes: ['id', 'name', 'avatar', 'role'] },
            { model: User, as: 'provider', attributes: ['id', 'name', 'avatar', 'role'] }
          ]
        });
      } else {
        return sendError(res, 'Conversation not found', 404);
      }
    }

    const messages = await ChatMessage.findAll({
      where: { conversation_id: conversation.id },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'avatar', 'role'] }
      ],
      order: [['created_at', 'ASC']]
    });

    // Mark unread messages as read
    await ChatMessage.update(
      { read: true },
      {
        where: {
          conversation_id: conversation.id,
          recipient_id: userId,
          read: false
        }
      }
    );

    return sendSuccess(res, {
      conversation: conversation.toJSON(),
      messages: messages.map(m => m.toJSON())
    }, 'Messages retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Send a message
// @route   POST /api/chat/messages
// @access  Private
const sendMessage = async (req, res, next) => {
  try {
    const { conversationId, bookingId, recipientId, text } = req.body;
    const userId = req.user.id || req.user._id;

    if (!text || text.trim() === '') {
      return sendError(res, 'Message text cannot be empty', 400);
    }

    let conversation;

    if (conversationId) {
      conversation = await ChatConversation.findByPk(conversationId);
    } else if (bookingId) {
      conversation = await ChatConversation.findOne({ where: { booking_id: bookingId } });
      if (!conversation) {
        const booking = await Booking.findByPk(bookingId);
        if (!booking || !booking.provider_id) {
          return sendError(res, 'Cannot start chat without an assigned provider', 400);
        }
        conversation = await ChatConversation.create({
          booking_id: booking.id,
          customer_id: booking.customer_id,
          provider_id: booking.provider_id,
          last_message: text.trim(),
          last_message_at: new Date()
        });
      }
    }

    if (!conversation) {
      return sendError(res, 'Conversation context not found', 404);
    }

    // Determine recipient
    const recipient = recipientId ||
      (Number(conversation.customer_id) === Number(userId) ? conversation.provider_id : conversation.customer_id);

    if (!recipient) {
      return sendError(res, 'Recipient not found for this conversation', 400);
    }

    const message = await ChatMessage.create({
      conversation_id: conversation.id,
      booking_id: conversation.booking_id,
      sender_id: userId,
      recipient_id: recipient,
      text: text.trim(),
      read: false
    });

    conversation.last_message = text.trim();
    conversation.last_message_at = new Date();
    await conversation.save();

    const populatedMessage = await ChatMessage.findByPk(message.id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'avatar', 'role'] }
      ]
    });

    // Socket.IO real-time emission
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversation.id}`).emit('new_message', populatedMessage.toJSON());
      io.to(`user:${recipient}`).emit('new_chat_notification', {
        conversationId: conversation.id,
        message: populatedMessage.toJSON()
      });
    }

    return sendSuccess(res, populatedMessage.toJSON(), 'Message sent', 201);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage
};
