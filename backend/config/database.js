const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_NAME = process.env.DB_NAME || 'fixit_local';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.DB_PASS || '';

let isConnected = false;

const fs = require('fs');
const { spawn } = require('child_process');

// Configurable SSL with certificate verification enabled by default (never automatically disabled)
const getSslConfig = () => {
  const sslEnabled =
    process.env.DB_SSL === 'true' ||
    process.env.MYSQL_SSL === 'true' ||
    Boolean(process.env.DB_SSL_CA);

  if (!sslEnabled) {
    return null;
  }

  // Certificate verification enabled by default (never rejectUnauthorized: false by default)
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  const sslOptions = {
    rejectUnauthorized
  };

  if (process.env.DB_SSL_CA) {
    try {
      if (fs.existsSync(process.env.DB_SSL_CA)) {
        sslOptions.ca = fs.readFileSync(process.env.DB_SSL_CA, 'utf8');
      } else {
        // Support inline PEM certificate string with literal \n escapes
        sslOptions.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
      }
    } catch (caErr) {
      console.warn('[MySQL SSL] Warning: Could not load CA certificate from DB_SSL_CA path:', caErr.message);
    }
  }

  return sslOptions;
};

const sslConfig = getSslConfig();
const dialectOptions = {};
if (sslConfig) {
  dialectOptions.ssl = sslConfig;
}

// Create Sequelize instance
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  dialectOptions,
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true
  }
});

const formatError = (error) => {
  if (!error) return 'Unknown error';
  if (error.message && error.message.trim()) return error.message;
  if (error.code) return `Error code: ${error.code}`;
  if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors.map(e => e.message || e.code || String(e)).join('; ');
  }
  return String(error);
};

// Local development only: helper to auto-launch XAMPP MySQL on Windows
const tryAutoStartLocalMySQL = async () => {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  const xamppMysqld = 'C:\\xampp\\mysql\\bin\\mysqld.exe';
  const xamppIni = 'C:\\xampp\\mysql\\bin\\my.ini';
  if (process.platform === 'win32' && fs.existsSync(xamppMysqld)) {
    console.log('[MySQL] Port 3306 unreachable. Auto-launching local XAMPP MySQL daemon for development...');
    try {
      const child = spawn(xamppMysqld, [`--defaults-file=${xamppIni}`, '--standalone'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      // Wait for MySQL to initialize socket and accept connections
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return true;
    } catch (e) {
      console.warn('[MySQL] Auto-start attempt error:', e.message);
    }
  }
  return false;
};

/**
 * Ensure database exists on MySQL server before connecting Sequelize.
 * In production or cloud environments where database user lacks CREATE DATABASE privileges,
 * skips gracefully and allows direct connection to pre-provisioned database.
 */
const ensureDatabaseExists = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const shouldSkipCreate = process.env.SKIP_DB_CREATE === 'true' || process.env.DB_SKIP_CREATE === 'true';

  if (shouldSkipCreate) {
    return;
  }

  let connection = null;
  try {
    const connConfig = {
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      connectTimeout: 8000
    };

    if (sslConfig) {
      connConfig.ssl = sslConfig;
    }

    connection = await mysql.createConnection(connConfig);

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
  } catch (error) {
    const isAccessDenied =
      error.code === 'ER_DBACCESS_DENIED_ERROR' ||
      error.code === 'ER_ACCESS_DENIED_ERROR' ||
      error.code === 'ER_SPECIFIC_ACCESS_DENIED_ERROR' ||
      (error.message && /access denied|permission denied/i.test(error.message));

    // In production or when user lacks CREATE DATABASE privileges (e.g. AWS RDS, PlanetScale, Supabase),
    // skip automatically without failing so Sequelize can connect to the assigned database directly.
    if (isProduction || isAccessDenied) {
      console.log(`[MySQL] Note: Automatic database creation bypassed (${error.code || 'insufficient privileges'}). Connecting directly to '${DB_NAME}'.`);
      return;
    }

    if (error.message && !error.message.includes('ECONNREFUSED')) {
      console.error(`[MySQL Setup Error]: Failed to ensure database exists: ${formatError(error)}`);
    }
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (_) {}
    }
  }
};

/**
 * Connect to MySQL using Sequelize with automatic retry/start in local development
 */
const connectDB = async (retry = true) => {
  try {
    await ensureDatabaseExists();
    await sequelize.authenticate();
    isConnected = true;
    console.log(`[MySQL] Connected successfully to database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}`);
    return sequelize;
  } catch (error) {
    if (retry && process.env.NODE_ENV !== 'production' && error.message && (error.message.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED')) {
      const started = await tryAutoStartLocalMySQL();
      if (started) {
        return connectDB(false);
      }
    }
    isConnected = false;
    console.error(`[MySQL] Connection Failed: ${formatError(error)}`);
    console.warn('Please verify DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD environment settings.');
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Make sure local MySQL is running (e.g. open XAMPP Control Panel and start MySQL, or run npm run mysql:start).');
    }
    return null;
  }
};

const isDBConnected = () => isConnected;

module.exports = {
  sequelize,
  connectDB,
  isDBConnected,
  getSslConfig
};
