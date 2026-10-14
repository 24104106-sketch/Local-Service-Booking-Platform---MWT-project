const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Complaint = sequelize.define('Complaint', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ticket_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_name: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  user_email: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  booking_number: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    defaultValue: 'service_quality'
  },
  status: {
    type: DataTypes.ENUM('open', 'investigating', 'resolved', 'closed'),
    defaultValue: 'open'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  admin_notes: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  resolution: {
    type: DataTypes.TEXT,
    defaultValue: ''
  }
}, {
  tableName: 'complaints',
  timestamps: true,
  underscored: true
});

Complaint.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  values.ticketId = values.ticket_id;
  values.userName = values.user_name;
  values.userEmail = values.user_email;
  values.bookingNumber = values.booking_number;
  values.adminNotes = values.admin_notes;
  values.user = values.user || values.user_id;
  values.booking = values.booking || values.booking_id;
  return values;
};

module.exports = Complaint;
