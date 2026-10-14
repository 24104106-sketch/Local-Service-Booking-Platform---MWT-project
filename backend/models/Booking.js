const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const safeJsonParse = (val) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return val; }
  }
  return val;
};

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  booking_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  community_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  provider_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  provider_profile_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  service_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  service_title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date: {
    type: DataTypes.STRING,
    allowNull: false
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.JSON,
    defaultValue: {
      street: '',
      city: '',
      pincode: '',
      lat: null,
      lng: null
    },
    get() {
      return safeJsonParse(this.getDataValue('address'));
    }
  },
  service_location: {
    type: DataTypes.JSON,
    defaultValue: null,
    get() {
      return safeJsonParse(this.getDataValue('service_location'));
    }
  },
  status: {
    type: DataTypes.ENUM(
      'pending',
      'requested',
      'confirmed',
      'provider_assigned',
      'accepted',
      'rejected',
      'on_the_way',
      'arrived',
      'in_progress',
      'completed',
      'cancelled'
    ),
    defaultValue: 'requested'
  },
  payment_method: {
    type: DataTypes.ENUM('card', 'cash', 'wallet', 'upi'),
    defaultValue: 'cash'
  },
  payment_status: {
    type: DataTypes.ENUM(
      'pending',
      'processing',
      'authorized',
      'captured',
      'paid',
      'failed',
      'refunded',
      'cash_pending',
      'cash_received'
    ),
    defaultValue: 'pending'
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  customer_notes: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  status_timeline: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      return safeJsonParse(this.getDataValue('status_timeline')) || [];
    }
  },
  provider_location: {
    type: DataTypes.JSON,
    defaultValue: {
      lat: null,
      lng: null,
      heading: 0,
      updatedAt: null
    },
    get() {
      return safeJsonParse(this.getDataValue('provider_location'));
    }
  },
  pricing: {
    type: DataTypes.JSON,
    defaultValue: null,
    get() {
      return safeJsonParse(this.getDataValue('pricing'));
    }
  },
  problem_description: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  media_attachments: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      return safeJsonParse(this.getDataValue('media_attachments')) || [];
    }
  },
  additional_charges: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      return safeJsonParse(this.getDataValue('additional_charges')) || [];
    }
  },
  cancellation_reason: {
    type: DataTypes.TEXT,
    defaultValue: ''
  }
}, {
  tableName: 'bookings',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['booking_number'], unique: true },
    { fields: ['customer_id'] },
    { fields: ['provider_id'] },
    { fields: ['service_id'] },
    { fields: ['status'] },
    { fields: ['community_id'] },
    { fields: ['date', 'time'] }
  ]
});

Booking.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  values.communityId = values.community_id;
  values.address = safeJsonParse(values.address);
  values.serviceLocation = safeJsonParse(values.service_location);
  values.service_location = safeJsonParse(values.service_location);
  values.status_timeline = safeJsonParse(values.status_timeline);
  values.provider_location = safeJsonParse(values.provider_location);
  values.pricing = safeJsonParse(values.pricing);
  values.problemDescription = values.problem_description || '';
  values.mediaAttachments = safeJsonParse(values.media_attachments) || [];
  values.additionalCharges = safeJsonParse(values.additional_charges) || [];
  values.bookingNumber = values.booking_number;
  values.serviceTitle = values.service_title;
  values.paymentMethod = values.payment_method;
  values.paymentStatus = values.payment_status;
  values.customerNotes = values.customer_notes;
  values.statusTimeline = values.status_timeline;
  values.providerLocation = values.provider_location;
  values.serviceLocation = safeJsonParse(values.service_location) || values.address;
  values.cancellationReason = values.cancellation_reason;
  return values;
};

module.exports = Booking;
