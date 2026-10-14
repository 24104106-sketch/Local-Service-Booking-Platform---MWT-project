const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Name is required' }
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: { msg: 'Must be a valid email address' },
      notEmpty: { msg: 'Email is required' }
    },
    set(value) {
      if (value) this.setDataValue('email', value.toLowerCase().trim());
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: { args: [6, 128], msg: 'Password must be at least 6 characters' }
    }
  },
  role: {
    type: DataTypes.ENUM('customer', 'provider', 'admin'),
    defaultValue: 'customer'
  },
  phone: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  avatar: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  address: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  city: {
    type: DataTypes.STRING,
    defaultValue: 'Chennai'
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'pending'),
    defaultValue: 'active'
  },
  google_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  saved_addresses: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      const val = this.getDataValue('saved_addresses');
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return []; }
      }
      return val || [];
    }
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Compare password helper method - strictly verify against bcrypt hash
User.prototype.comparePassword = async function (candidatePassword) {
  if (!candidatePassword || !this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Exclude password from JSON serialization and provide _id compatibility alias
User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  values._id = values.id;
  const rawSaved = values.saved_addresses;
  values.savedAddresses = typeof rawSaved === 'string' ? (() => { try { return JSON.parse(rawSaved); } catch(e) { return []; } })() : (rawSaved || []);
  return values;
};

module.exports = User;
