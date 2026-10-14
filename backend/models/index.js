const { sequelize } = require('../config/database');
const User = require('./User');
const ProviderProfile = require('./ProviderProfile');
const Service = require('./Service');
const ProviderService = require('./ProviderService');
const Booking = require('./Booking');
const Review = require('./Review');
const Notification = require('./Notification');
const ChatConversation = require('./ChatConversation');
const ChatMessage = require('./ChatMessage');
const ChatbotHistory = require('./ChatbotHistory');
const Complaint = require('./Complaint');
const Wallet = require('./Wallet');
const WalletTransaction = require('./WalletTransaction');
const PasswordResetToken = require('./PasswordResetToken');
const Community = require('./Community');
const Payment = require('./Payment');

// User <-> ProviderProfile
User.hasOne(ProviderProfile, { foreignKey: 'user_id', as: 'providerProfile', onDelete: 'CASCADE' });
ProviderProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ProviderProfile <-> Service (Many-to-Many via ProviderService)
ProviderProfile.belongsToMany(Service, {
  through: ProviderService,
  foreignKey: 'provider_profile_id',
  otherKey: 'service_id',
  as: 'servicesOffered'
});
Service.belongsToMany(ProviderProfile, {
  through: ProviderService,
  foreignKey: 'service_id',
  otherKey: 'provider_profile_id',
  as: 'providers'
});
ProviderService.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'providerProfile' });
ProviderService.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
ProviderProfile.hasMany(ProviderService, { foreignKey: 'provider_profile_id', as: 'providerServices' });
Service.hasMany(ProviderService, { foreignKey: 'service_id', as: 'providerServices' });

// Booking Associations
Booking.belongsTo(User, { foreignKey: 'customer_id', as: 'customer' });
Booking.belongsTo(User, { foreignKey: 'provider_id', as: 'provider' });
Booking.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'providerProfile' });
Booking.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
Booking.belongsTo(Community, { foreignKey: 'community_id', as: 'community' });
Community.hasMany(Booking, { foreignKey: 'community_id', as: 'bookings' });
User.hasMany(Booking, { foreignKey: 'customer_id', as: 'customerBookings' });
User.hasMany(Booking, { foreignKey: 'provider_id', as: 'providerBookings' });

// Review Associations
Review.belongsTo(User, { foreignKey: 'customer_id', as: 'customer' });
Review.belongsTo(User, { foreignKey: 'provider_id', as: 'provider' });
Review.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
Review.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

// Notification Associations
Notification.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });
User.hasMany(Notification, { foreignKey: 'recipient_id', as: 'notifications' });

// Chat Associations
ChatConversation.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
ChatConversation.belongsTo(User, { foreignKey: 'customer_id', as: 'customer' });
ChatConversation.belongsTo(User, { foreignKey: 'provider_id', as: 'provider' });
ChatConversation.hasMany(ChatMessage, { foreignKey: 'conversation_id', as: 'messages', onDelete: 'CASCADE' });

ChatMessage.belongsTo(ChatConversation, { foreignKey: 'conversation_id', as: 'conversation' });
ChatMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
ChatMessage.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });
ChatMessage.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

// ChatbotHistory Associations
ChatbotHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
User.hasOne(ChatbotHistory, { foreignKey: 'user_id', as: 'chatbotHistory' });

// Complaint Associations
Complaint.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Complaint.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

// Wallet Associations
Wallet.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
User.hasOne(Wallet, { foreignKey: 'user_id', as: 'wallet' });
WalletTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(WalletTransaction, { foreignKey: 'user_id', as: 'walletTransactions' });

// Password Reset Token
PasswordResetToken.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });

// RecentlyAccessed Associations
const RecentlyAccessed = require('./RecentlyAccessed');
RecentlyAccessed.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
User.hasMany(RecentlyAccessed, { foreignKey: 'user_id', as: 'recentlyAccessed', onDelete: 'CASCADE' });

// Payment Associations
Payment.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Booking.hasMany(Payment, { foreignKey: 'booking_id', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Payment, { foreignKey: 'user_id', as: 'payments' });

// ProviderDailyAvailability Associations
const ProviderDailyAvailability = require('./ProviderDailyAvailability');
User.hasMany(ProviderDailyAvailability, { foreignKey: 'provider_id', as: 'dailyAvailabilities', onDelete: 'CASCADE' });
ProviderDailyAvailability.belongsTo(User, { foreignKey: 'provider_id', as: 'user' });
ProviderProfile.hasMany(ProviderDailyAvailability, { foreignKey: 'provider_profile_id', as: 'dailyAvailabilities', onDelete: 'CASCADE' });
ProviderDailyAvailability.belongsTo(ProviderProfile, { foreignKey: 'provider_profile_id', as: 'providerProfile' });

module.exports = {
  sequelize,
  User,
  ProviderProfile,
  Service,
  ProviderService,
  Booking,
  Review,
  Notification,
  ChatConversation,
  ChatMessage,
  ChatbotHistory,
  Complaint,
  Wallet,
  WalletTransaction,
  PasswordResetToken,
  Community,
  RecentlyAccessed,
  Payment,
  ProviderDailyAvailability
};

