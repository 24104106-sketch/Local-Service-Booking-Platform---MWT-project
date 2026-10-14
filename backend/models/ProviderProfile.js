const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const safeJsonParse = (val) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return val; }
  }
  return val;
};

const ProviderProfile = sequelize.define('ProviderProfile', {
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
  business_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  experience_years: {
    type: DataTypes.INTEGER,
    defaultValue: 2
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  review_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  hourly_rate: {
    type: DataTypes.FLOAT,
    defaultValue: 299
  },
  bio: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  is_approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false // Strictly false on registration until admin approval
  },
  is_available: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  availability_status: {
    type: DataTypes.ENUM('AVAILABLE', 'BUSY', 'OFFLINE'),
    defaultValue: 'OFFLINE'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  completed_jobs: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  verification_status: {
    type: DataTypes.ENUM('verified', 'pending', 'rejected'),
    defaultValue: 'pending' // Strictly pending until admin review
  },
  service_radius: {
    type: DataTypes.INTEGER,
    defaultValue: 15 // Service radius in km (e.g. 5, 10, 15, 25)
  },
  working_days: {
    type: DataTypes.JSON,
    defaultValue: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    get() {
      return safeJsonParse(this.getDataValue('working_days')) || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    }
  },
  working_hours: {
    type: DataTypes.JSON,
    defaultValue: { start: '09:00', end: '18:00' },
    get() {
      return safeJsonParse(this.getDataValue('working_hours')) || { start: '09:00', end: '18:00' };
    }
  },
  breaks: {
    type: DataTypes.JSON,
    defaultValue: [{ start: '13:00', end: '14:00' }],
    get() {
      return safeJsonParse(this.getDataValue('breaks')) || [{ start: '13:00', end: '14:00' }];
    }
  },
  blocked_dates: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      return safeJsonParse(this.getDataValue('blocked_dates')) || [];
    }
  },
  service_duration: {
    type: DataTypes.INTEGER,
    defaultValue: 60 // Default service slot duration in minutes
  },
  location: {
    type: DataTypes.JSON,
    defaultValue: null,
    get() {
      return safeJsonParse(this.getDataValue('location'));
    }
  },
  current_location: {
    type: DataTypes.JSON,
    defaultValue: null,
    get() {
      return safeJsonParse(this.getDataValue('current_location'));
    }
  },
  id_proof_url: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  skills: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      return safeJsonParse(this.getDataValue('skills')) || [];
    }
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    defaultValue: null
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    defaultValue: null
  },
  address: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  city: {
    type: DataTypes.STRING,
    defaultValue: 'Chennai'
  },
  state: {
    type: DataTypes.STRING,
    defaultValue: 'Tamil Nadu'
  },
  pincode: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  service_radius_km: {
    type: DataTypes.INTEGER,
    defaultValue: 15
  }
}, {
  tableName: 'provider_profiles',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'], unique: true },
    { fields: ['category'] },
    { fields: ['is_approved'] },
    { fields: ['is_active'] },
    { fields: ['availability_status'] },
    { fields: ['verification_status'] },
    { fields: ['latitude', 'longitude'] }
  ]
});

ProviderProfile.beforeSave((profile) => {
  const loc = typeof profile.location === 'string' ? safeJsonParse(profile.location) : (profile.location || {});
  const curLoc = typeof profile.current_location === 'string' ? safeJsonParse(profile.current_location) : (profile.current_location || {});

  const lat = profile.latitude != null ? Number(profile.latitude) : (curLoc?.lat != null ? Number(curLoc.lat) : (loc?.lat != null ? Number(loc.lat) : (curLoc?.latitude != null ? Number(curLoc.latitude) : (loc?.latitude != null ? Number(loc.latitude) : null))));
  const lng = profile.longitude != null ? Number(profile.longitude) : (curLoc?.lng != null ? Number(curLoc.lng) : (loc?.lng != null ? Number(loc.lng) : (curLoc?.longitude != null ? Number(curLoc.longitude) : (loc?.longitude != null ? Number(loc.longitude) : null))));

  if (lat != null && !isNaN(lat)) {
    profile.latitude = lat;
  }
  if (lng != null && !isNaN(lng)) {
    profile.longitude = lng;
  }
  if (!profile.address && (loc?.address || curLoc?.address)) {
    profile.address = loc?.address || curLoc?.address || '';
  }
  if (!profile.city && (loc?.city || curLoc?.city)) {
    profile.city = loc?.city || curLoc?.city || 'Chennai';
  }
  if (!profile.state && (loc?.state || curLoc?.state)) {
    profile.state = loc?.state || curLoc?.state || 'Tamil Nadu';
  }
  if (!profile.pincode && (loc?.pincode || curLoc?.pincode)) {
    profile.pincode = loc?.pincode || curLoc?.pincode || '';
  }
  if (profile.service_radius && !profile.service_radius_km) {
    profile.service_radius_km = profile.service_radius;
  }
  if (profile.service_radius_km && !profile.service_radius) {
    profile.service_radius = profile.service_radius_km;
  }
  if (profile.category) {
    const { isTestCategory, getCanonicalCategory } = require('../utils/categoryNormalizer');
    if (isTestCategory(profile.category)) {
      throw new Error(`Invalid provider category '${profile.category}': Test categories are strictly prohibited in the database.`);
    }
    const canonical = getCanonicalCategory(profile.category);
    if (canonical) {
      profile.category = canonical;
    }
  }
});

ProviderProfile.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  values.location = safeJsonParse(values.location);
  values.current_location = safeJsonParse(values.current_location);
  values.skills = safeJsonParse(values.skills);
  values.working_days = safeJsonParse(values.working_days);
  values.working_hours = safeJsonParse(values.working_hours);
  values.breaks = safeJsonParse(values.breaks);
  values.blocked_dates = safeJsonParse(values.blocked_dates);
  values.businessName = values.business_name;
  values.experienceYears = values.experience_years;
  values.reviewCount = values.review_count;
  values.hourlyRate = values.hourly_rate;
  values.availabilityStatus = values.availability_status || (values.is_available ? 'AVAILABLE' : 'BUSY');
  values.availability_status = values.availabilityStatus;
  values.isActive = values.is_active !== false;
  values.is_active = values.isActive;
  values.completedJobs = Number(values.completed_jobs || 0);
  values.completed_jobs = values.completedJobs;
  values.isApproved = values.is_approved;
  values.isAvailable = values.availabilityStatus === 'AVAILABLE';
  values.is_available = values.isAvailable;
  values.verificationStatus = values.verification_status;
  values.serviceRadius = values.service_radius != null ? values.service_radius : (values.service_radius_km != null ? values.service_radius_km : 15);
  values.service_radius = values.serviceRadius;
  values.serviceRadiusKm = values.serviceRadius;
  values.service_radius_km = values.serviceRadius;
  
  const parsedLoc = values.location || {};
  const parsedCurLoc = values.current_location || {};
  const lat = values.latitude != null ? Number(values.latitude) : (parsedCurLoc.lat != null ? Number(parsedCurLoc.lat) : (parsedLoc.lat != null ? Number(parsedLoc.lat) : (parsedCurLoc.latitude != null ? Number(parsedCurLoc.latitude) : (parsedLoc.latitude != null ? Number(parsedLoc.latitude) : null))));
  const lng = values.longitude != null ? Number(values.longitude) : (parsedCurLoc.lng != null ? Number(parsedCurLoc.lng) : (parsedLoc.lng != null ? Number(parsedLoc.lng) : (parsedCurLoc.longitude != null ? Number(parsedCurLoc.longitude) : (parsedLoc.longitude != null ? Number(parsedLoc.longitude) : null))));
  
  values.latitude = lat;
  values.longitude = lng;
  values.address = values.address || parsedLoc.address || parsedCurLoc.address || '';
  values.city = values.city || parsedLoc.city || parsedCurLoc.city || 'Chennai';
  values.state = values.state || parsedLoc.state || parsedCurLoc.state || 'Tamil Nadu';
  values.pincode = values.pincode || parsedLoc.pincode || parsedCurLoc.pincode || '';

  // Synchronize location object for any legacy frontend readers
  values.location = {
    address: values.address,
    city: values.city,
    state: values.state,
    pincode: values.pincode,
    lat: lat,
    lng: lng,
    latitude: lat,
    longitude: lng
  };

  values.workingDays = values.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  values.workingHours = values.working_hours || { start: '09:00', end: '18:00' };
  values.breaks = values.breaks || [{ start: '13:00', end: '14:00' }];
  values.blockedDates = values.blocked_dates || [];
  values.serviceDuration = values.service_duration || 60;
  values.currentLocation = values.current_location;
  values.idProofUrl = values.id_proof_url;
  return values;
};

module.exports = ProviderProfile;
