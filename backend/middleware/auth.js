const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { sendError } = require('../utils/response');
const { isDBConnected } = require('../config/database');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    return null;
  }
  return secret.trim();
};

const JWT_SECRET = process.env.JWT_SECRET ? process.env.JWT_SECRET.trim() : null;

// Middleware to verify if MySQL database is connected
const checkDB = (req, res, next) => {
  if (!isDBConnected()) {
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction
      ? 'Database service is currently unavailable. Please try again shortly.'
      : 'Database is not connected. Please verify MySQL server and environment configuration.';
    return sendError(res, message, 503);
  }
  next();
};

const requireAuth = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 'Access denied. No authentication token provided.', 401);
    }

    const secret = getJwtSecret();
    if (!secret) {
      console.error('[JWT Configuration Error] JWT_SECRET is not configured in environment.');
      return sendError(res, 'Authentication configuration error. Please contact administrator.', 500);
    }

    const decoded = jwt.verify(token, secret);

    if (isDBConnected()) {
      const user = await User.findByPk(decoded.id);
      if (!user) {
        return sendError(res, 'User belonging to this token no longer exists.', 401);
      }
      if (user.status === 'suspended') {
        return sendError(res, 'Your account has been suspended. Please contact support.', 403);
      }
      req.user = user;
    } else {
      req.user = { id: decoded.id, _id: decoded.id, role: decoded.role, email: decoded.email, name: decoded.name };
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Token expired. Please login again.', 401);
    }
    return sendError(res, 'Invalid or malformed token.', 401);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    const secret = getJwtSecret();
    if (token && secret) {
      const decoded = jwt.verify(token, secret);
      if (isDBConnected()) {
        const user = await User.findByPk(decoded.id);
        if (user) req.user = user;
      } else {
        req.user = { id: decoded.id, _id: decoded.id, role: decoded.role, email: decoded.email, name: decoded.name };
      }
    }
  } catch (error) {
    // Ignore error for optional authentication
  }
  next();
};

module.exports = {
  checkDB,
  requireAuth,
  optionalAuth,
  getJwtSecret,
  JWT_SECRET
};
