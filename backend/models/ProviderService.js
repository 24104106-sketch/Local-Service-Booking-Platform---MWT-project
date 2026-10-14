const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProviderService = sequelize.define('ProviderService', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  provider_profile_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  service_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  custom_price: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  base_price: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  pricing_type: {
    type: DataTypes.ENUM('fixed', 'starting_from', 'inspection_required'),
    defaultValue: 'fixed'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'provider_services',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['provider_profile_id', 'service_id'] },
    { fields: ['service_id'] },
    { fields: ['is_active'] }
  ]
});

ProviderService.prototype.toJSON = function () {
  const values = { ...this.get() };
  values.basePrice = values.base_price != null ? values.base_price : values.custom_price;
  values.customPrice = values.custom_price != null ? values.custom_price : values.base_price;
  values.pricingType = values.pricing_type || 'fixed';
  values.isActive = values.is_active !== false;
  return values;
};

module.exports = ProviderService;
