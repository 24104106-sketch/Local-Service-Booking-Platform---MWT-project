const { ChatbotHistory } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');
const {
  processUserMessage,
  resetContext,
  getOrCreateUserContext
} = require('../services/chatbotAiService');

// @desc    Get current user's chatbot history
// @route   GET /api/chatbot/history
// @access  Private
const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    let history = await ChatbotHistory.findOne({ where: { user_id: userId } });

    if (!history) {
      return sendSuccess(res, {
        messages: [{
          id: 'welcome',
          sender: 'assistant',
          text: `Hello ${req.user.name || 'there'}! I'm **FixIt Assistant**, your smart local service guide. I can help you find services, recommend providers, check booking status, track your provider live, and more.`,
          createdAt: new Date().toISOString(),
          suggestions: [
            'Find a plumber',
            'Book an electrician',
            'Track my provider',
            'Check my booking',
            'Payment status',
            'Need help'
          ]
        }]
      }, 'Chatbot history retrieved');
    }

    return sendSuccess(res, history.toJSON(), 'Chatbot history retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Send a message or action payload to FixIt Assistant
// @route   POST /api/chatbot/message
// @access  Private
const postMessage = async (req, res, next) => {
  try {
    const { message, action, payload } = req.body;
    const userId = req.user ? (req.user.id || req.user._id) : (req.body.sessionId || 'guest-session');

    if ((!message || message.trim() === '') && !action) {
      return sendError(res, 'Message or action is required', 400);
    }

    const userText = message ? message.trim() : (action ? `[Action: ${action}]` : '');
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      createdAt: new Date().toISOString()
    };

    // Run AI/NLP Engine with real database connections and context
    const botResponse = await processUserMessage({
      user: req.user || { id: userId, role: 'customer', name: 'Guest' },
      text: userText,
      action,
      payload,
      coordinates: req.body.coordinates || req.body.locationCoordinates
    });

    const assistantMsg = {
      id: (Date.now() + 1).toString(),
      sender: 'assistant',
      text: botResponse.text,
      language: botResponse.language,
      intent: botResponse.intent,
      entities: botResponse.entities,
      card: botResponse.card,
      actions: botResponse.actions,
      suggestions: botResponse.suggestions,
      createdAt: new Date().toISOString()
    };

    // If authenticated user, persist to database
    if (req.user) {
      let history = await ChatbotHistory.findOne({ where: { user_id: userId } });
      if (!history) {
        history = await ChatbotHistory.create({
          user_id: userId,
          messages: []
        });
      }
      const messages = Array.isArray(history.messages) ? [...history.messages] : [];
      messages.push(userMsg);
      messages.push(assistantMsg);
      history.messages = messages.slice(-50);
      await history.save();
    }

    return sendSuccess(res, {
      userMessage: userMsg,
      assistantMessage: assistantMsg
    }, 'Message processed');
  } catch (error) {
    next(error);
  }
};

// @desc    Clear chatbot history
// @route   DELETE /api/chatbot/history
// @access  Private
const clearHistory = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user.id || req.user._id) : (req.body.sessionId || 'guest-session');
    if (req.user) {
      await ChatbotHistory.destroy({ where: { user_id: userId } });
    }
    resetContext(userId);
    return sendSuccess(res, null, 'Chatbot history cleared');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHistory,
  postMessage,
  clearHistory
};
