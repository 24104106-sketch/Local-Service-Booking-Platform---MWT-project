const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RecentlyAccessed = sequelize.define('RecentlyAccessed', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  item_type: {
    type: DataTypes.ENUM('service', 'provider'),
    allowNull: false
  },
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  accessed_at: {
    type: DataTypes.DATE(6),
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'recently_accessed',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      name: 'idx_user_item_unique',
      unique: true,
      fields: ['user_id', 'item_type', 'item_id']
    },
    {
      name: 'idx_user_accessed_at',
      fields: ['user_id', 'accessed_at']
    }
  ]
});

RecentlyAccessed.prototype.toJSON = function () {
  const values = { ...this.get() };
  if (typeof values.metadata === 'string') {
    try {
      values.metadata = JSON.parse(values.metadata);
    } catch (e) {
      values.metadata = {};
    }
  }
  values._id = values.id;
  return values;
};

module.exports = RecentlyAccessed;
