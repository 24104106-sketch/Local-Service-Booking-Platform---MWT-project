const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  balance: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'INR'
  }
}, {
  tableName: 'wallets',
  timestamps: true,
  underscored: true
});

Wallet.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  values.user = values.user_id;
  return values;
};

module.exports = Wallet;
