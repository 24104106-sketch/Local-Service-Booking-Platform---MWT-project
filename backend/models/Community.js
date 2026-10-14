const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Community = sequelize.define('Community', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
    validate: {
      min: -90,
      max: 90
    }
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
    validate: {
      min: -180,
      max: 180
    }
  },
  city: {
    type: DataTypes.STRING,
    defaultValue: 'Chennai'
  },
  area: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  pincode: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'communities',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['name'] },
    { fields: ['city'] },
    { fields: ['area'] },
    { fields: ['latitude'] },
    { fields: ['is_active'] }
  ]
});

Community.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  values.latitude = Number(values.latitude);
  values.longitude = Number(values.longitude);
  values.isActive = Boolean(values.is_active);
  return values;
};

module.exports = Community;
