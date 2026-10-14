const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatbotHistory = sequelize.define('ChatbotHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  messages: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      const val = this.getDataValue('messages');
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch (_) {
          return [];
        }
      }
      return Array.isArray(val) ? val : [];
    }
  }
}, {
  tableName: 'chatbot_histories',
  timestamps: true,
  underscored: true
});

ChatbotHistory.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  values.user = values.user_id;
  if (typeof values.messages === 'string') {
    try {
      values.messages = JSON.parse(values.messages);
    } catch (_) {
      values.messages = [];
    }
  }
  return values;
};

module.exports = ChatbotHistory;
