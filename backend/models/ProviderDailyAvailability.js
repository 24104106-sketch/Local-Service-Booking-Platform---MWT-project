const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const safeJsonParse = (val) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return val; }
  }
  return val;
};

const ProviderDailyAvailability = sequelize.define('ProviderDailyAvailability', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  provider_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'User ID of the provider'
  },
  provider_profile_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  date: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: 'Format YYYY-MM-DD'
  },
  is_available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  is_day_off: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  start_time: {
    type: DataTypes.STRING(20),
    defaultValue: '09:00 AM'
  },
  end_time: {
    type: DataTypes.STRING(20),
    defaultValue: '06:00 PM'
  },
  busy_intervals: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      return safeJsonParse(this.getDataValue('busy_intervals')) || [];
    }
  },
  notes: {
    type: DataTypes.TEXT,
    defaultValue: ''
  }
}, {
  tableName: 'provider_daily_availabilities',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['provider_id', 'date'], unique: true },
    { fields: ['date'] }
  ]
});

ProviderDailyAvailability.prototype.toJSON = function () {
  const values = { ...this.get() };
  values.busyIntervals = safeJsonParse(values.busy_intervals) || [];
  values.busy_intervals = values.busyIntervals;
  values.startTime = values.start_time;
  values.endTime = values.end_time;
  values.isAvailable = values.is_available;
  values.isDayOff = values.is_day_off;
  values.providerId = values.provider_id;
  values.providerProfileId = values.provider_profile_id;
  return values;
};

module.exports = ProviderDailyAvailability;
