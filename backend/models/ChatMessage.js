const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  conversation_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  recipient_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'chat_messages',
  timestamps: true,
  underscored: true
});

ChatMessage.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  values.conversation = values.conversation || values.conversation_id;
  values.sender = values.sender || values.sender_id;
  values.recipient = values.recipient || values.recipient_id;
  values.booking = values.booking || values.booking_id;
  return values;
};

module.exports = ChatMessage;
