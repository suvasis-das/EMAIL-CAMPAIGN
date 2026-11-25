import { RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { pool } from './db';

/**
 * Ensures all application tables and indexes exist in MySQL.
 *
 * Mirrors database/schema.sql using idempotent DDL (`CREATE TABLE IF NOT EXISTS`)
 * so fresh cloud deployments (Railway, Render, Docker) bootstrap automatically
 * without manual SQL steps.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  // Retry briefly on startup in case MySQL is still finishing initialization
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.log(
        `[DB] Waiting for MySQL (attempt ${attempt}/${maxAttempts})...`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // 0. Users table (for authentication)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed demo account if no users exist yet
  try {
    const [userRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users LIMIT 1'
    );
    if (userRows.length === 0) {
      const demoHash = await bcrypt.hash('DemoPassword123!', 10);
      await pool.query(
        'INSERT IGNORE INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        ['Demo Operator', 'demo@mailqueue.app', demoHash]
      );
      console.log('[DB] Seeded default demo account (demo@mailqueue.app).');
    }
  } catch (seedErr) {
    console.warn('[DB] Could not check or seed demo user:', seedErr);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      company VARCHAR(255) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      template_id INT NOT NULL,
      status ENUM('pending', 'running', 'completed') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_campaigns_template
        FOREIGN KEY (template_id) REFERENCES templates(id)
        ON DELETE RESTRICT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT NOT NULL,
      lead_id INT NOT NULL,
      status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
      retry_count INT NOT NULL DEFAULT 0,
      error_message TEXT NULL,
      sent_at TIMESTAMP NULL DEFAULT NULL,
      CONSTRAINT fk_email_logs_campaign
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_email_logs_lead
        FOREIGN KEY (lead_id) REFERENCES leads(id)
        ON DELETE CASCADE,
      CONSTRAINT uq_campaign_lead UNIQUE (campaign_id, lead_id)
    )
  `);

  await ensureIndex('email_logs', 'idx_email_logs_status', '(status)');
  await ensureIndex(
    'email_logs',
    'idx_email_logs_campaign_status',
    '(campaign_id, status)'
  );

  console.log('[DB] Schema verified.');
}

async function ensureIndex(
  tableName: string,
  indexName: string,
  columnsSql: string
): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND index_name = ?
    LIMIT 1
    `,
    [tableName, indexName]
  );

  if (rows.length === 0) {
    await pool.query(`CREATE INDEX ${indexName} ON ${tableName} ${columnsSql}`);
  }
}
