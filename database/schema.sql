-- =============================================================================
-- Email Campaigner - MySQL Database Schema
-- =============================================================================
-- Run this file once to set up the database and tables:
--   mysql -u root -p < database/schema.sql
-- =============================================================================

CREATE DATABASE IF NOT EXISTS email_campaigner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE email_campaigner;

-- 1. Leads: people who will receive campaign emails.
-- The UNIQUE constraint on email prevents duplicate contacts at the DB level.
CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  company VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Templates: reusable email blueprints supporting {{name}} and {{company}}.
CREATE TABLE IF NOT EXISTS templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Campaigns: ties a campaign name to one template and tracks overall status.
-- ON DELETE RESTRICT prevents deleting a template that is already used by a campaign.
CREATE TABLE IF NOT EXISTS campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  template_id INT NOT NULL,
  status ENUM('pending', 'running', 'completed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaigns_template
    FOREIGN KEY (template_id) REFERENCES templates(id)
    ON DELETE RESTRICT
);

-- 4. Email Logs: acts as our database-backed job queue + delivery audit log.
-- One row is created per (campaign, lead) pair when a campaign starts.
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
  -- Prevents accidentally queueing the same lead twice in the same campaign
  CONSTRAINT uq_campaign_lead UNIQUE (campaign_id, lead_id)
);

-- Index on status so the background worker can quickly fetch pending/retryable emails
-- without scanning the entire email_logs table.
CREATE INDEX idx_email_logs_status ON email_logs(status);

-- Index on campaign_id + status so dashboard stats queries (COUNT ... GROUP BY status)
-- stay fast as the table grows.
CREATE INDEX idx_email_logs_campaign_status ON email_logs(campaign_id, status);
