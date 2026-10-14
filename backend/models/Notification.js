const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  recipient_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('booking', 'system', 'chat', 'payment'),
    defaultValue: 'system'
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  link: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  underscored: true
});

Notification.prototype.toJSON = function () {
  const values = { ...this.get() };
  if (typeof values.metadata === 'string') {
    try {
      values.metadata = JSON.parse(values.metadata);
    } catch (e) {
      values.metadata = {};
    }
  }
  values._id = values.id;
  values.recipient = values.recipient_id;
  return values;
};

module.exports = Notification;
