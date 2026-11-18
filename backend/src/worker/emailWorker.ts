import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { env } from '../config/env';
import { sendEmail } from '../config/mailer';
import { renderTemplate } from '../utils/renderTemplate';

interface QueuedEmailRow extends RowDataPacket {
  log_id: number;
  campaign_id: number;
  retry_count: number;
  lead_name: string;
  lead_email: string;
  lead_company: string;
  subject: string;
  body: string;
}

export interface BatchResult {
  processed: number;
  sent: number;
  failed: number;
}

/**
 * Processes one batch of queued emails (default: up to 10).
 *
 * Retry policy:
 * - Picks rows with status = 'pending' OR (status = 'failed' AND retry_count < 3).
 * - On success: marks row as 'sent' and records sent_at timestamp.
 * - On failure: increments retry_count, saves error_message, and marks as 'failed'.
 *   Once retry_count reaches 3, future worker runs ignore it and leave it as 'failed'.
 */
export async function processEmailBatch(
  batchSize = env.worker.batchSize,
  maxRetries = env.worker.maxRetries
): Promise<BatchResult> {
  const [jobs] = await pool.query<QueuedEmailRow[]>(
    `
    SELECT
      el.id AS log_id,
      el.campaign_id,
      el.retry_count,
      l.name AS lead_name,
      l.email AS lead_email,
      l.company AS lead_company,
      t.subject,
      t.body
    FROM email_logs el
    INNER JOIN leads l ON l.id = el.lead_id
    INNER JOIN campaigns c ON c.id = el.campaign_id
    INNER JOIN templates t ON t.id = c.template_id
    WHERE el.status = 'pending'
       OR (el.status = 'failed' AND el.retry_count < ?)
    ORDER BY (el.status = 'pending') DESC, el.id ASC
    LIMIT ?
    `,
    [maxRetries, batchSize]
  );

  if (jobs.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const touchedCampaignIds = new Set<number>();

  for (const job of jobs) {
    touchedCampaignIds.add(job.campaign_id);

    // Pure function replaces {{name}}, {{company}}, {{email}}
    const variables = {
      name: job.lead_name,
      company: job.lead_company,
      email: job.lead_email,
    };
    const renderedSubject = renderTemplate(job.subject, variables);
    const renderedBody = renderTemplate(job.body, variables);

    try {
      await sendEmail({
        to: job.lead_email,
        subject: renderedSubject,
        text: renderedBody,
      });

      await pool.query(
        `
        UPDATE email_logs
        SET status = 'sent', error_message = NULL, sent_at = NOW()
        WHERE id = ?
        `,
        [job.log_id]
      );

      sent += 1;
      console.log(`[Worker] Sent email_log #${job.log_id} -> ${job.lead_email}`);
    } catch (error) {
      const nextRetryCount = job.retry_count + 1;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown SMTP error';

      await pool.query(
        `
        UPDATE email_logs
        SET status = 'failed', retry_count = ?, error_message = ?
        WHERE id = ?
        `,
        [nextRetryCount, errorMessage.slice(0, 1000), job.log_id]
      );

      failed += 1;
      const retryNote =
        nextRetryCount < maxRetries
          ? `will retry (${nextRetryCount}/${maxRetries})`
          : `max retries reached (${nextRetryCount}/${maxRetries})`;
      console.error(
        `[Worker] Failed email_log #${job.log_id} -> ${job.lead_email}: ${errorMessage} [${retryNote}]`
      );
    }
  }

  // Update each affected campaign's overall status (running vs completed)
  for (const campaignId of touchedCampaignIds) {
    await refreshCampaignStatus(campaignId, maxRetries);
  }

  return { processed: jobs.length, sent, failed };
}

/**
 * Checks whether a campaign still has any pending or retryable emails left.
 * If 0 remain, marks the campaign as 'completed'; otherwise 'running'.
 */
async function refreshCampaignStatus(
  campaignId: number,
  maxRetries: number
): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS remaining
    FROM email_logs
    WHERE campaign_id = ?
      AND (status = 'pending' OR (status = 'failed' AND retry_count < ?))
    `,
    [campaignId, maxRetries]
  );

  const remaining = Number(rows[0]?.remaining ?? 0);
  const nextStatus = remaining === 0 ? 'completed' : 'running';

  await pool.query('UPDATE campaigns SET status = ? WHERE id = ?', [
    nextStatus,
    campaignId,
  ]);
}
