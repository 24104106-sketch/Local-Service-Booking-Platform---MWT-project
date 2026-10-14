const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WalletTransaction = sequelize.define('WalletTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('credit', 'debit'),
    allowNull: false
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  reference_id: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  balance_after: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('success', 'pending', 'failed'),
    defaultValue: 'success'
  }
}, {
  tableName: 'wallet_transactions',
  timestamps: true,
  underscored: true
});

WalletTransaction.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  values.user = values.user_id;
  values.referenceId = values.reference_id;
  values.balanceAfter = values.balance_after;
  return values;
};

module.exports = WalletTransaction;
