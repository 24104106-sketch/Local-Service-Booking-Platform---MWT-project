const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Server-side diagnostic logging (sanitized: never logs tokens, passwords, or secrets)
  const logDetails = {
    method: req.method,
    path: req.originalUrl || req.url,
    errorName: err.name || 'Error',
    errorMessage: err.message || 'Unknown error',
    statusCode: err.statusCode || 500
  };
  if (!isProduction && err.stack) {
    logDetails.stack = err.stack;
  }
  console.error('[API Error]:', logDetails);

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors && Array.isArray(err.errors) ? err.errors.map(e => e.message) : [err.message];
    return sendError(res, 'Validation failed: ' + messages.join(', '), 400, messages);
  }

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors && err.errors[0] ? err.errors[0].path : 'field';
    return sendError(res, `A record with this ${field} already exists.`, 400);
  }

  // Sequelize foreign key constraint error
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return sendError(res, 'Referenced related record does not exist.', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid authentication token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Authentication token has expired', 401);
  }

  // Sequelize connection error
  if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
    const dbMsg = isProduction
      ? 'Database service is currently unavailable. Please try again shortly.'
      : 'Database connection is not established. Please check MySQL server and environment configuration.';
    return sendError(res, dbMsg, 503);
  }

  // CORS policy error
  if (err.message && err.message.includes('CORS policy violation')) {
    return sendError(res, isProduction ? 'Access forbidden by security policy.' : err.message, 403);
  }

  const statusCode = err.statusCode || 500;
  
  // Generic message for unexpected production server errors to prevent leaking internal paths or SQL details
  let message = err.message || 'Internal server error';
  if (statusCode >= 500 && isProduction) {
    message = 'An unexpected server error occurred. Please try again later.';
  }

  return sendError(res, message, statusCode);
};

module.exports = errorHandler;
