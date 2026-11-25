import dotenv from 'dotenv';

// Load variables from backend/.env into process.env
dotenv.config();

const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

/**
 * Centralized configuration object.
 * Reading environment variables in one place makes defaults obvious
 * and avoids scattered `process.env.*` lookups across the codebase.
 */
export const env = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'mailqueue-super-secret-jwt-key-2026',
  // Supports comma-separated origins for production + local preview, or "*"
  corsOrigins:
    rawCorsOrigin === '*'
      ? '*'
      : rawCorsOrigin
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),

  db: {
    // Optional single connection URI provided by hosts like Railway / Aiven / TiDB
    url: process.env.DATABASE_URL || process.env.MYSQL_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'email_campaigner',
    ssl: process.env.DB_SSL === 'true',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
    port: Number(process.env.SMTP_PORT) || 2525,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Email Campaigner <no-reply@campaigner.local>',
  },

  worker: {
    batchSize: Number(process.env.WORKER_BATCH_SIZE) || 10,
    maxRetries: Number(process.env.WORKER_MAX_RETRIES) || 3,
    cronSchedule: process.env.WORKER_CRON_SCHEDULE || '* * * * *',
  },
};
