const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    index: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true
  },
  gateway: {
    type: DataTypes.STRING(50),
    defaultValue: 'razorpay',
    allowNull: false
  },
  gateway_order_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    index: true
  },
  gateway_payment_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true
  },
  gateway_signature: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  gateway_reference_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'INR'
  },
  payment_method: {
    type: DataTypes.STRING(50),
    defaultValue: 'online'
  },
  status: {
    type: DataTypes.ENUM(
      'created',
      'pending',
      'authorized',
      'captured',
      'voided',
      'failed',
      'refunded'
    ),
    defaultValue: 'created',
    allowNull: false,
    index: true
  },
  authorization_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  captured_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  released_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  refunded_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  failure_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  idempotency_key: {
    type: DataTypes.STRING(150),
    allowNull: true,
    unique: true
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'payments',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['booking_id'] },
    { fields: ['user_id'] },
    { fields: ['gateway_order_id'] },
    { fields: ['status'] }
  ]
});

Payment.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  values.bookingId = values.booking_id;
  values.userId = values.user_id;
  values.gatewayOrderId = values.gateway_order_id;
  values.gatewayPaymentId = values.gateway_payment_id;
  values.paymentMethod = values.payment_method;
  values.capturedAt = values.captured_at;
  values.releasedAt = values.released_at;
  values.refundedAt = values.refunded_at;
  return values;
};

module.exports = Payment;
