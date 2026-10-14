const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatConversation = sequelize.define('ChatConversation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  provider_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  last_message: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  last_message_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'chat_conversations',
  timestamps: true,
  underscored: true
});

ChatConversation.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  values.lastMessage = values.last_message;
  values.lastMessageAt = values.last_message_at;
  // If customer and provider associations exist, provide participants array
  const participants = [];
  if (values.customer) participants.push(values.customer);
  else if (values.customer_id) participants.push(values.customer_id);
  if (values.provider) participants.push(values.provider);
  else if (values.provider_id) participants.push(values.provider_id);
  values.participants = participants;
  return values;
};

module.exports = ChatConversation;
