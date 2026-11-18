import { Request, Response, NextFunction } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { AppError } from '../middleware/errorHandler';

function parsePositiveId(rawId: string | string[] | undefined): number {
  const value = Array.isArray(rawId) ? rawId[0] : rawId;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('Invalid campaign ID.', 400);
  }
  return id;
}

/**
 * POST /campaigns
 * Creates a campaign and queues one `pending` row in `email_logs` for every lead.
 *
 * Uses a SQL transaction so creating the campaign and queueing its emails happen
 * atomically: either both succeed, or both roll back together.
 */
export async function createCampaign(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const connection = await pool.getConnection();

  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const templateId = Number(req.body?.template_id);

    if (!name) {
      throw new AppError('Campaign name is required.', 400);
    }
    if (!Number.isInteger(templateId) || templateId <= 0) {
      throw new AppError('A valid template_id is required.', 400);
    }

    await connection.beginTransaction();

    // 1. Verify the chosen template exists
    const [templates] = await connection.query<RowDataPacket[]>(
      'SELECT id, name FROM templates WHERE id = ?',
      [templateId]
    );
    if (templates.length === 0) {
      throw new AppError('Template not found.', 404);
    }

    // 2. Fetch all leads so we can queue one email per lead
    const [leads] = await connection.query<RowDataPacket[]>('SELECT id FROM leads');
    if (leads.length === 0) {
      throw new AppError(
        'Cannot start a campaign with 0 leads. Upload leads first.',
        400
      );
    }

    // 3. Create the campaign row
    const [campaignResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO campaigns (name, template_id, status) VALUES (?, ?, ?)',
      [name, templateId, 'pending']
    );
    const campaignId = campaignResult.insertId;

    // 4. Bulk-insert one pending email_log row per lead
    const emailLogRows = leads.map((lead) => [campaignId, lead.id, 'pending']);
    await connection.query(
      'INSERT INTO email_logs (campaign_id, lead_id, status) VALUES ?',
      [emailLogRows]
    );

    await connection.commit();

    res.status(201).json({
      campaign: {
        id: campaignId,
        name,
        template_id: templateId,
        template_name: templates[0].name,
        status: 'pending',
        queued_emails: leads.length,
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * GET /campaigns
 * Lists all campaigns along with template name and live sent/failed/pending counts.
 */
export async function getCampaigns(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT
        c.id,
        c.name,
        c.template_id,
        t.name AS template_name,
        c.status,
        c.created_at,
        COUNT(el.id) AS total,
        COALESCE(SUM(CASE WHEN el.status = 'sent' THEN 1 ELSE 0 END), 0) AS sent,
        COALESCE(SUM(CASE WHEN el.status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
        COALESCE(SUM(CASE WHEN el.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending
      FROM campaigns c
      INNER JOIN templates t ON t.id = c.template_id
      LEFT JOIN email_logs el ON el.campaign_id = c.id
      GROUP BY c.id, c.name, c.template_id, t.name, c.status, c.created_at
      ORDER BY c.created_at DESC, c.id DESC
    `);

    // MySQL returns SUM() as strings in some drivers; normalize to numbers
    const campaigns = rows.map((row) => ({
      id: row.id,
      name: row.name,
      template_id: row.template_id,
      template_name: row.template_name,
      status: row.status,
      created_at: row.created_at,
      stats: {
        total: Number(row.total),
        sent: Number(row.sent),
        failed: Number(row.failed),
        pending: Number(row.pending),
      },
    }));

    res.status(200).json({ campaigns });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /campaigns/:id/stats
 * Returns sent/failed/pending counts and per-lead delivery logs for a campaign.
 */
export async function getCampaignStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const campaignId = parsePositiveId(req.params.id);

    // 1. Fetch campaign metadata
    const [campaignRows] = await pool.query<RowDataPacket[]>(
      `
      SELECT c.id, c.name, c.template_id, t.name AS template_name, c.status, c.created_at
      FROM campaigns c
      INNER JOIN templates t ON t.id = c.template_id
      WHERE c.id = ?
      `,
      [campaignId]
    );

    if (campaignRows.length === 0) {
      throw new AppError('Campaign not found.', 404);
    }

    // 2. Count email_logs grouped by status (fast thanks to idx_email_logs_campaign_status)
    const [countRows] = await pool.query<RowDataPacket[]>(
      `
      SELECT status, COUNT(*) AS count
      FROM email_logs
      WHERE campaign_id = ?
      GROUP BY status
      `,
      [campaignId]
    );

    const stats = { total: 0, sent: 0, failed: 0, pending: 0 };
    for (const row of countRows) {
      const count = Number(row.count);
      if (row.status === 'sent') stats.sent = count;
      if (row.status === 'failed') stats.failed = count;
      if (row.status === 'pending') stats.pending = count;
      stats.total += count;
    }

    // 3. Fetch individual email logs so the dashboard can show recipient-level status & errors
    const [logs] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        el.id,
        el.lead_id,
        l.name AS lead_name,
        l.email AS lead_email,
        l.company AS lead_company,
        el.status,
        el.retry_count,
        el.error_message,
        el.sent_at
      FROM email_logs el
      INNER JOIN leads l ON l.id = el.lead_id
      WHERE el.campaign_id = ?
      ORDER BY el.id ASC
      LIMIT 100
      `,
      [campaignId]
    );

    res.status(200).json({
      campaign: campaignRows[0],
      stats,
      logs,
    });
  } catch (error) {
    next(error);
  }
}
