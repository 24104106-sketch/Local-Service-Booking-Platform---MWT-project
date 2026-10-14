const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { OAuth2Client } = require('google-auth-library');
const { User, ProviderProfile, Service, ProviderService, Wallet, PasswordResetToken, Notification } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');
const { getJwtSecret } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/emailService');

// Generate JWT token helper
const generateToken = (user) => {
  const secret = getJwtSecret();
  if (!secret) {
    console.error('[JWT Configuration Error] Cannot generate token: JWT_SECRET missing from environment.');
    throw new Error('Authentication configuration error: server secret not configured');
  }
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    secret,
    { expiresIn: '7d' }
  );
};

// @desc    Register a new user (Customer or Provider)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const {
      name,
      fullName,
      username,
      email,
      password,
      role,
      phone,
      address,
      city,
      // Professional fields for provider
      serviceId,
      serviceName,
      businessName,
      category,
      experienceYears,
      skills,
      bio,
      serviceArea,
      hourlyRate
    } = req.body;

    const resolvedName = (name || fullName || username || '').trim();

    if (!resolvedName || !email || !password) {
      return sendError(res, 'Please provide name, email, and password', 400);
    }

    if (String(password).length < 6) {
      return sendError(res, 'Password must be at least 6 characters', 400);
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: cleanEmail } });
    if (existingUser) {
      return sendError(res, 'An account with this email already exists', 400);
    }

    if (role && String(role).toLowerCase().trim() === 'admin') {
      return sendError(res, 'Administrator registration is not permitted.', 403);
    }

    const assignedRole = role === 'provider' ? 'provider' : 'customer';

    // Parse city from address if city was not explicitly given
    let derivedCity = (city || '').trim();
    if (!derivedCity && address && address.includes(',')) {
      const parts = address.split(',');
      derivedCity = parts[parts.length - 1].trim();
    }

    // Prepare initial structured saved address if provided
    const initialSavedAddresses = [];
    const addrLine1 = req.body.addressLine1 || req.body.address_line1 || address || '';
    if (addrLine1 || (req.body.latitude != null && req.body.longitude != null)) {
      initialSavedAddresses.push({
        id: `addr_${Date.now()}`,
        label: req.body.addressLabel || 'Home',
        addressLine1: addrLine1,
        addressLine2: req.body.addressLine2 || req.body.address_line2 || '',
        city: derivedCity || 'Chennai',
        state: req.body.state || 'Tamil Nadu',
        pincode: req.body.pincode || '',
        latitude: req.body.latitude != null ? Number(req.body.latitude) : (req.body.lat != null ? Number(req.body.lat) : null),
        longitude: req.body.longitude != null ? Number(req.body.longitude) : (req.body.lng != null ? Number(req.body.lng) : null),
        isDefault: true
      });
    }

    const user = await User.create({
      name: resolvedName,
      email: cleanEmail,
      password,
      role: assignedRole,
      phone: phone || '',
      avatar: req.body.avatar || req.body.profilePhoto || req.body.profile_photo || '',
      address: addrLine1 || address || '',
      city: derivedCity || 'Chennai',
      status: 'active',
      saved_addresses: initialSavedAddresses
    });

    // If provider, create ProviderProfile and link to selected services
    let providerProfile = null;
    if (assignedRole === 'provider') {
      const { getCanonicalCategory, getCategoryAliases, areCategoriesMatching } = require('../utils/categoryNormalizer');
      const rawCategory = (
        req.body.primaryCategory ||
        req.body.category ||
        category ||
        'General Maintenance'
      ).trim();
      const assignedCategory = getCanonicalCategory(rawCategory) || rawCategory || 'General Maintenance';

      const parsedSkills = Array.isArray(skills)
        ? skills
        : skills
        ? String(skills).split(',').map((s) => s.trim()).filter(Boolean)
        : [assignedCategory];

      const resolvedRadius = Number(req.body.serviceRadius || req.body.service_radius || 15);
      const rawLat = (req.body.latitude != null && req.body.latitude !== '')
        ? Number(req.body.latitude)
        : ((req.body.lat != null && req.body.lat !== '') ? Number(req.body.lat) : null);
      const rawLng = (req.body.longitude != null && req.body.longitude !== '')
        ? Number(req.body.longitude)
        : ((req.body.lng != null && req.body.lng !== '') ? Number(req.body.lng) : null);

      let validatedLat = null;
      let validatedLng = null;
      if (rawLat !== null && rawLng !== null && !isNaN(rawLat) && !isNaN(rawLng)) {
        if (rawLat >= -90 && rawLat <= 90 && rawLng >= -180 && rawLng <= 180) {
          validatedLat = rawLat;
          validatedLng = rawLng;
        }
      }

      const resolvedAddress = (req.body.address || req.body.serviceAddress || serviceArea || addrLine1 || '').trim();
      const resolvedCity = (req.body.city || derivedCity || 'Chennai').trim();
      const resolvedState = (req.body.state || 'Tamil Nadu').trim();
      const resolvedPincode = (req.body.pincode || '').trim();

      providerProfile = await ProviderProfile.create({
        user_id: user.id,
        business_name: businessName ? businessName.trim() : `${user.name} Services`,
        category: assignedCategory,
        hourly_rate: hourlyRate !== undefined && hourlyRate !== '' ? Number(hourlyRate) : null,
        experience_years: Number(experienceYears) || 1,
        bio: bio ? bio.trim() : `Professional ${assignedCategory} specialist.`,
        skills: parsedSkills,
        service_radius: resolvedRadius,
        service_radius_km: resolvedRadius,
        latitude: validatedLat,
        longitude: validatedLng,
        address: resolvedAddress,
        city: resolvedCity,
        state: resolvedState,
        pincode: resolvedPincode,
        working_days: req.body.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        working_hours: req.body.workingHours || { start: '09:00', end: '18:00' },
        breaks: req.body.breaks || [{ start: '13:00', end: '14:00' }],
        blocked_dates: req.body.blockedDates || [],
        service_duration: Number(req.body.serviceDuration || 60),
        location: {
          address: resolvedAddress || resolvedCity,
          city: resolvedCity,
          state: resolvedState,
          pincode: resolvedPincode,
          lat: validatedLat,
          lng: validatedLng
        },
        current_location: (validatedLat != null && validatedLng != null) ? {
          lat: validatedLat,
          lng: validatedLng,
          heading: 0,
          speed: 0
        } : null,
        is_approved: false, // Strictly false on registration until admin approval
        is_available: false,
        is_active: false,
        availability_status: 'OFFLINE',
        verification_status: 'pending', // Strictly pending until admin review
        rating: 0.0,
        review_count: 0,
        completed_jobs: 0
      });

      // Resolve and link multiple services from catalog
      let rawServices = [];
      if (Array.isArray(req.body.services) && req.body.services.length > 0) {
        rawServices = req.body.services;
      } else if (Array.isArray(req.body.serviceIds) && req.body.serviceIds.length > 0) {
        rawServices = req.body.serviceIds;
      } else if (serviceId) {
        rawServices = [serviceId];
      } else if (serviceName) {
        rawServices = [serviceName];
      }

      const defaultRate = Number(hourlyRate || req.body.servicePrice || req.body.price || 0) || null;
      const linkedServiceIds = new Set();
      const linkedCanonicalCategories = new Set();

      for (const item of rawServices) {
        let foundService = null;
        let itemPrice = defaultRate;
        let itemPricingType = 'fixed';

        if (typeof item === 'number' || (!isNaN(item) && String(item).trim() !== '')) {
          foundService = await Service.findByPk(Number(item));
        } else if (typeof item === 'string' && item.trim()) {
          const itemTitle = item.trim();
          const canonical = getCanonicalCategory(itemTitle);
          // Try finding by title first
          foundService = await Service.findOne({
            where: {
              title: { [Op.like]: `%${itemTitle}%` }
            }
          });
          // If not found by title, resolve via canonical category to master service
          if (!foundService && canonical) {
            foundService = await Service.findOne({
              where: {
                category: { [Op.in]: getCategoryAliases(canonical) },
                is_active: true
              }
            });
          }
        } else if (item && typeof item === 'object') {
          if (item.id) {
            foundService = await Service.findByPk(item.id);
          } else if (item.title || item.name) {
            const itemTitle = (item.title || item.name).trim();
            const canonical = getCanonicalCategory(itemTitle) || getCanonicalCategory(item.category);
            foundService = await Service.findOne({
              where: {
                title: { [Op.like]: `%${itemTitle}%` }
              }
            });
            if (!foundService && canonical) {
              foundService = await Service.findOne({
                where: {
                  category: { [Op.in]: getCategoryAliases(canonical) },
                  is_active: true
                }
              });
            }
          }
          if (item.price != null && !isNaN(Number(item.price))) {
            itemPrice = Number(item.price);
          }
          if (item.pricingType) {
            itemPricingType = item.pricingType;
          }
        }

        if (foundService) {
          const svcCanonicalCat = getCanonicalCategory(foundService.category) || foundService.category;

          // Prevent duplicate linking of the exact same service ID
          if (linkedServiceIds.has(foundService.id)) {
            continue;
          }

          // If provider provided multiple category alias names (e.g. Painting, Painting, Painter),
          // ensure it does NOT create duplicate generic service records for the same canonical category
          const isGenericCategoryService = (foundService.title.toLowerCase() === svcCanonicalCat.toLowerCase()) ||
            areCategoriesMatching(foundService.title, svcCanonicalCat);
          if (isGenericCategoryService && linkedCanonicalCategories.has(svcCanonicalCat)) {
            continue;
          }

          linkedServiceIds.add(foundService.id);
          linkedCanonicalCategories.add(svcCanonicalCat);

          const finalPrice = itemPrice != null ? itemPrice : (foundService.price || defaultRate || 299);
          await ProviderService.create({
            provider_profile_id: providerProfile.id,
            service_id: foundService.id,
            custom_price: finalPrice,
            base_price: finalPrice,
            pricing_type: itemPricingType,
            is_active: true
          });
        }
      }

      // If no explicit service list matched catalog title, link to canonical category service if available
      if (linkedServiceIds.size === 0) {
        const aliases = getCategoryAliases(assignedCategory);
        const fallbackService = await Service.findOne({
          where: {
            category: { [Op.in]: aliases }
          }
        });
        if (fallbackService) {
          const finalPrice = defaultRate != null ? defaultRate : (fallbackService.price || 299);
          await ProviderService.create({
            provider_profile_id: providerProfile.id,
            service_id: fallbackService.id,
            custom_price: finalPrice,
            base_price: finalPrice,
            pricing_type: 'fixed',
            is_active: true
          });
          linkedServiceIds.add(fallbackService.id);
        }
      }

      // Dispatch single admin notification for new pending provider application
      try {
        const admins = await User.findAll({ where: { role: 'admin' } });
        for (const admin of admins) {
          const existingNotif = await Notification.findOne({
            where: {
              recipient_id: admin.id,
              type: 'system',
              link: `/admin/provider-approvals?providerId=${providerProfile.id}`
            }
          });
          if (!existingNotif) {
            await Notification.create({
              recipient_id: admin.id,
              title: 'New Provider Application',
              message: `${user.name} (${providerProfile.business_name}) has registered for ${assignedCategory} services and is pending verification.`,
              type: 'system',
              read: false,
              link: `/admin/provider-approvals?providerId=${providerProfile.id}`,
              metadata: {
                providerId: providerProfile.id,
                userId: user.id,
                category: assignedCategory,
                businessName: providerProfile.business_name,
                providerName: user.name,
                status: 'pending'
              }
            });
          }
        }
      } catch (notifErr) {
        console.error('Error creating admin notification for provider registration:', notifErr);
      }
    }

    // Initialize Wallet strictly at 0.00 for newly registered accounts
    await Wallet.create({
      user_id: user.id,
      balance: 0
    });

    const token = generateToken(user);

    return sendSuccess(res, {
      user: {
        ...user.toJSON(),
        providerProfile: providerProfile ? providerProfile.toJSON() : undefined
      },
      token
    }, 'Registration successful', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Please provide email and password', 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ where: { email: cleanEmail } });
    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password', 401);
    }

    if (user.status && user.status.toLowerCase() === 'suspended') {
      return sendError(res, 'Your account has been suspended. Please contact the administrator.', 403);
    }

    let providerProfile = null;
    if (user.role === 'provider') {
      providerProfile = await ProviderProfile.findOne({ where: { user_id: user.id } });
    }

    const token = generateToken(user);
    const authenticatedUser = {
      ...user.toJSON(),
      providerProfile: providerProfile ? providerProfile.toJSON() : undefined
    };

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: authenticatedUser,
      data: {
        user: authenticatedUser,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findByPk(userId);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    let providerProfile = null;
    if (user.role === 'provider') {
      providerProfile = await ProviderProfile.findOne({ where: { user_id: user.id } });
    }

    return sendSuccess(res, {
      user: {
        ...user.toJSON(),
        providerProfile: providerProfile ? providerProfile.toJSON() : undefined
      }
    }, 'User profile retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address, city, avatar, savedAddresses, saved_addresses } = req.body;
    const userId = req.user.id || req.user._id;

    const user = await User.findByPk(userId);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (city !== undefined) user.city = city;
    if (avatar !== undefined) user.avatar = avatar;
    if (savedAddresses !== undefined) user.saved_addresses = savedAddresses;
    if (saved_addresses !== undefined) user.saved_addresses = saved_addresses;

    await user.save();

    let providerProfile = null;
    if (user.role === 'provider') {
      providerProfile = await ProviderProfile.findOne({ where: { user_id: user.id } });
    }

    return sendSuccess(res, {
      user: {
        ...user.toJSON(),
        providerProfile: providerProfile ? providerProfile.toJSON() : undefined
      }
    }, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password - request reset token
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendError(res, 'Please provide your email address', 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ where: { email: cleanEmail } });

    // Anti-enumeration: If user does not exist, return generic success message
    if (!user) {
      return sendSuccess(res, null, 'If this email is registered, password reset instructions have been sent.');
    }

    const expiryMinutes = parseInt(process.env.RESET_TOKEN_EXPIRY_MINUTES || '15', 10);

    // Rate-limiting check: if user already has an active reset token created within the last 60 seconds
    const recentToken = await PasswordResetToken.findOne({
      where: {
        user_id: user.id,
        used: false,
        created_at: { [Op.gt]: new Date(Date.now() - 60 * 1000) }
      }
    });
    if (recentToken) {
      return sendSuccess(res, null, 'If this email is registered, password reset instructions have been sent.');
    }

    // Invalidate previous active tokens for this user
    await PasswordResetToken.update(
      { used: true },
      { where: { user_id: user.id, used: false } }
    );

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await PasswordResetToken.create({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used: false
    });

    // Send real email via emailService abstraction
    await sendPasswordResetEmail({
      toEmail: user.email,
      userName: user.name,
      resetToken,
      expiryMinutes
    });

    // Generic response without leaking token or registration details
    return sendSuccess(res, null, 'If this email is registered, password reset instructions have been sent.');
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password with token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const cleanToken = (token || '').trim();

    if (!cleanToken || !newPassword) {
      return sendError(res, 'Reset token and new password are required', 400);
    }

    if (String(newPassword).length < 6) {
      return sendError(res, 'New password must be at least 6 characters', 400);
    }

    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    const resetRecord = await PasswordResetToken.findOne({
      where: {
        token_hash: tokenHash,
        used: false
      }
    });

    if (!resetRecord || new Date() > new Date(resetRecord.expires_at)) {
      return sendError(res, 'Reset token is invalid or has expired', 400);
    }

    const user = await User.findByPk(resetRecord.user_id);
    if (!user) {
      return sendError(res, 'User associated with token not found', 404);
    }

    // Set new password (model hook will hash it)
    user.password = newPassword;
    await user.save();

    // Mark token as used immediately
    resetRecord.used = true;
    await resetRecord.save();

    return sendSuccess(res, null, 'Password has been reset successfully. You can now login with your new password.');
  } catch (error) {
    next(error);
  }
};

// @desc    Continue with Google OAuth
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res, next) => {
  try {
    const { credential, idToken, token: rawToken, email: rawEmail, name: rawName, googleId: rawGoogleId, avatar: rawAvatar } = req.body;

    const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    let verifiedEmail = null;
    let verifiedName = null;
    let verifiedGoogleId = null;
    let verifiedAvatar = null;

    const incomingToken = credential || idToken || rawToken;

    // Safe diagnostic logging (verifies configuration without leaking secrets)
    const hasClientId = Boolean(googleClientId);
    const endsWithGoogleDomain = Boolean(googleClientId && googleClientId.endsWith('.apps.googleusercontent.com'));
    console.log(`[Google OAuth Diagnostic] GOOGLE_CLIENT_ID configured: ${hasClientId}, ends with .apps.googleusercontent.com: ${endsWithGoogleDomain}`);

    if (!hasClientId || googleClientId === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
      console.error('[Google OAuth Verify Error] Reason: missing GOOGLE_CLIENT_ID | GOOGLE_CLIENT_ID is not configured in backend/.env');
      return sendError(res, 'Google authentication token verification failed. Please verify GOOGLE_CLIENT_ID.', 401);
    }

    if (incomingToken) {
      // Real backend verification with google-auth-library
      try {
        const client = new OAuth2Client(googleClientId);
        const ticket = await client.verifyIdToken({
          idToken: incomingToken,
          audience: googleClientId
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          console.error('[Google OAuth Verify Error] Reason: invalid payload | Token payload missing email');
          return sendError(res, 'Invalid Google token payload', 401);
        }
        verifiedEmail = payload.email.toLowerCase().trim();
        verifiedName = payload.name;
        verifiedGoogleId = payload.sub;
        verifiedAvatar = payload.picture;
      } catch (verifyErr) {
        // Categorize verification failure reason for internal logs
        let reason = 'token verification failure';
        const errMsg = (verifyErr.message || '').toLowerCase();
        if (!googleClientId) {
          reason = 'missing GOOGLE_CLIENT_ID';
        } else if (errMsg.includes('audience') || errMsg.includes('recipient') || errMsg.includes('requiredaudience')) {
          reason = 'audience mismatch';
        } else if (errMsg.includes('expired') || errMsg.includes('too late')) {
          reason = 'expired token';
        } else if (errMsg.includes('issuer')) {
          reason = 'invalid issuer';
        } else if (errMsg.includes('signature') || errMsg.includes('crypto')) {
          reason = 'invalid signature';
        } else if (errMsg.includes('envelope') || errMsg.includes('segment') || errMsg.includes('malformed') || errMsg.includes('json')) {
          reason = 'invalid token format';
        }

        // Mask any potential client IDs in detail string to protect secrets
        const safeDetail = (verifyErr.message || '').replace(/[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com/g, '[REDACTED_CLIENT_ID]');
        console.error(`[Google OAuth Verify Error] Reason: ${reason} | Detail: ${safeDetail}`);
        return sendError(res, 'Google authentication token verification failed. Please verify GOOGLE_CLIENT_ID.', 401);
      }
    } else if (rawEmail && process.env.NODE_ENV === 'development' && !googleClientId) {
      // Dev diagnostics only when Google Client ID has not been set yet
      return sendError(res, 'Google Client ID not configured. Please set GOOGLE_CLIENT_ID in backend/.env', 400);
    } else {
      return sendError(res, 'Google authentication credential is required.', 400);
    }

    // Safe account linking & retrieval
    let user = null;
    if (verifiedGoogleId) {
      user = await User.findOne({ where: { google_id: verifiedGoogleId } });
    }
    if (!user && verifiedEmail) {
      user = await User.findOne({ where: { email: verifiedEmail } });
    }

    if (!user) {
      // Newly created accounts via Google default strictly to 'customer', NEVER 'admin'
      const randomPassword = crypto.randomBytes(24).toString('hex');
      user = await User.create({
        name: verifiedName || verifiedEmail.split('@')[0],
        email: verifiedEmail,
        password: randomPassword,
        role: 'customer',
        avatar: verifiedAvatar || '',
        status: 'active',
        google_id: verifiedGoogleId || ''
      });

      // Initialize customer wallet
      await Wallet.create({ user_id: user.id, balance: 0 });
    } else {
      // Preserve existing account role (e.g. provider or existing customer)
      if (verifiedGoogleId && !user.google_id) {
        user.google_id = verifiedGoogleId;
      }
      if (verifiedAvatar && !user.avatar) {
        user.avatar = verifiedAvatar;
      }
      await user.save();
    }

    if (user.status === 'suspended') {
      return sendError(res, 'Your account has been suspended. Please contact administrator.', 403);
    }

    let providerProfile = null;
    if (user.role === 'provider') {
      providerProfile = await ProviderProfile.findOne({ where: { user_id: user.id } });
    }

    const authToken = generateToken(user);
    const authenticatedUser = {
      ...user.toJSON(),
      providerProfile: providerProfile ? providerProfile.toJSON() : undefined
    };

    return sendSuccess(res, {
      user: authenticatedUser,
      token: authToken
    }, 'Google authentication successful');
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's saved addresses
// @route   GET /api/auth/addresses
// @access  Private
const getAddresses = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return sendError(res, 'User not found', 404);
    return sendSuccess(res, user.saved_addresses || [], 'Saved addresses retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Add a saved address
// @route   POST /api/auth/addresses
// @access  Private
const addAddress = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return sendError(res, 'User not found', 404);

    const { label, title, addressLine1, addressLine2, street, area, city, state, pincode, postalCode, latitude, longitude, isDefault } = req.body;
    const addrLine1 = addressLine1 || street || req.body.address;
    if (!addrLine1) {
      return sendError(res, 'Address Line 1 or street is required', 400);
    }

    const currentAddresses = Array.isArray(user.saved_addresses) ? [...user.saved_addresses] : [];
    const makeDefault = Boolean(isDefault) || currentAddresses.length === 0;

    if (makeDefault) {
      currentAddresses.forEach((a) => { a.isDefault = false; });
    }

    const newAddr = {
      id: `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      label: label || title || 'Home',
      addressLine1: addrLine1,
      addressLine2: addressLine2 || area || '',
      city: city || user.city || 'Chennai',
      state: state || 'Tamil Nadu',
      pincode: pincode || postalCode || '',
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      isDefault: makeDefault
    };

    currentAddresses.push(newAddr);
    user.saved_addresses = currentAddresses;
    await user.save();

    return sendSuccess(res, { addresses: user.saved_addresses, newAddress: newAddr }, 'Address added successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a saved address
// @route   PUT /api/auth/addresses/:id
// @access  Private
const updateAddress = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return sendError(res, 'User not found', 404);

    const { id } = req.params;
    const { label, addressLine1, addressLine2, city, state, pincode, latitude, longitude, isDefault } = req.body;
    let currentAddresses = Array.isArray(user.saved_addresses) ? [...user.saved_addresses] : [];

    const index = currentAddresses.findIndex((a) => a.id === id);
    if (index === -1) {
      return sendError(res, 'Address not found', 404);
    }

    if (isDefault) {
      currentAddresses.forEach((a) => { a.isDefault = false; });
    }

    currentAddresses[index] = {
      ...currentAddresses[index],
      label: label !== undefined ? label : currentAddresses[index].label,
      addressLine1: addressLine1 !== undefined ? addressLine1 : currentAddresses[index].addressLine1,
      addressLine2: addressLine2 !== undefined ? addressLine2 : currentAddresses[index].addressLine2,
      city: city !== undefined ? city : currentAddresses[index].city,
      state: state !== undefined ? state : currentAddresses[index].state,
      pincode: pincode !== undefined ? pincode : currentAddresses[index].pincode,
      latitude: latitude != null ? Number(latitude) : currentAddresses[index].latitude,
      longitude: longitude != null ? Number(longitude) : currentAddresses[index].longitude,
      isDefault: isDefault !== undefined ? Boolean(isDefault) : currentAddresses[index].isDefault
    };

    user.saved_addresses = currentAddresses;
    await user.save();

    return sendSuccess(res, user.saved_addresses, 'Address updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a saved address
// @route   DELETE /api/auth/addresses/:id
// @access  Private
const deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return sendError(res, 'User not found', 404);

    const { id } = req.params;
    let currentAddresses = Array.isArray(user.saved_addresses) ? [...user.saved_addresses] : [];
    const initialLen = currentAddresses.length;
    currentAddresses = currentAddresses.filter((a) => a.id !== id);

    if (currentAddresses.length === initialLen) {
      return sendError(res, 'Address not found', 404);
    }

    // If we deleted the default address, make the first one default if any exist
    if (!currentAddresses.some((a) => a.isDefault) && currentAddresses.length > 0) {
      currentAddresses[0].isDefault = true;
    }

    user.saved_addresses = currentAddresses;
    await user.save();

    return sendSuccess(res, user.saved_addresses, 'Address deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Set default address
// @route   PUT /api/auth/addresses/:id/default
// @access  Private
const setDefaultAddress = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return sendError(res, 'User not found', 404);

    const { id } = req.params;
    let currentAddresses = Array.isArray(user.saved_addresses) ? [...user.saved_addresses] : [];
    let found = false;

    currentAddresses = currentAddresses.map((a) => {
      if (a.id === id) {
        found = true;
        return { ...a, isDefault: true };
      }
      return { ...a, isDefault: false };
    });

    if (!found) {
      return sendError(res, 'Address not found', 404);
    }

    user.saved_addresses = currentAddresses;
    await user.save();

    return sendSuccess(res, user.saved_addresses, 'Default address set');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  googleLogin,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
