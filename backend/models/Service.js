const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Service = sequelize.define('Service', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Service title is required' }
    }
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Category is required' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'per service'
  },
  duration: {
    type: DataTypes.STRING,
    defaultValue: '1-2 hrs'
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 4.8
  },
  reviews_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  icon: {
    type: DataTypes.STRING,
    defaultValue: 'Wrench'
  },
  image: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'services',
  timestamps: true,
  underscored: true
});

Service.beforeValidate((service) => {
  if (service.category) {
    const { isTestCategory, getCanonicalCategory } = require('../utils/categoryNormalizer');
    if (isTestCategory(service.category)) {
      throw new Error(`Invalid service category '${service.category}': Test categories are strictly prohibited in the database.`);
    }
    const canonical = getCanonicalCategory(service.category);
    if (canonical) {
      service.category = canonical;
    }
  }
});

Service.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  values.reviewsCount = values.reviews_count;
  values.isActive = values.is_active;
  return values;
};

module.exports = Service;
