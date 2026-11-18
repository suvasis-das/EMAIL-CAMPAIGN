import mysql, { PoolOptions } from 'mysql2/promise';
import { env } from './env';

/**
 * MySQL connection pool.
 *
 * Supports either:
 * - A single DATABASE_URL / MYSQL_URL (common on Railway, Render, Aiven, TiDB)
 * - Individual DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME variables
 *
 * Set DB_SSL=true when connecting to managed cloud MySQL instances that require TLS.
 */
function buildPoolConfig(): PoolOptions {
  const sslOption = env.db.ssl ? { rejectUnauthorized: false } : undefined;

  if (env.db.url) {
    return {
      uri: env.db.url,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: sslOption,
    };
  }

  return {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: sslOption,
  };
}

export const pool = mysql.createPool(buildPoolConfig());
