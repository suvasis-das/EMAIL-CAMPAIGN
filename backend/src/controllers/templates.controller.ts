import { Request, Response, NextFunction } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { AppError } from '../middleware/errorHandler';

function parsePositiveId(rawId: string | string[] | undefined): number {
  const value = Array.isArray(rawId) ? rawId[0] : rawId;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('Invalid template ID.', 400);
  }
  return id;
}

function validateTemplateBody(body: Record<string, unknown>): {
  name: string;
  subject: string;
  bodyText: string;
} {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const bodyText = typeof body.body === 'string' ? body.body.trim() : '';

  if (!name) {
    throw new AppError('Template name is required.', 400);
  }
  if (!subject) {
    throw new AppError('Template subject is required.', 400);
  }
  if (!bodyText) {
    throw new AppError('Template body is required.', 400);
  }

  return { name, subject, bodyText };
}

/**
 * POST /templates
 * Creates a new email template with {{placeholder}} support.
 */
export async function createTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, subject, bodyText } = validateTemplateBody(req.body || {});

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO templates (name, subject, body) VALUES (?, ?, ?)',
      [name, subject, bodyText]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, subject, body, created_at FROM templates WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ template: rows[0] });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /templates
 * Lists all saved templates, newest first.
 */
export async function getTemplates(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, subject, body, created_at FROM templates ORDER BY created_at DESC, id DESC'
    );

    res.status(200).json({ templates: rows });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /templates/:id
 * Updates an existing template's name, subject, and body.
 */
export async function updateTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parsePositiveId(req.params.id);
    const { name, subject, bodyText } = validateTemplateBody(req.body || {});

    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE templates SET name = ?, subject = ?, body = ? WHERE id = ?',
      [name, subject, bodyText, id]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Template not found.', 404);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, subject, body, created_at FROM templates WHERE id = ?',
      [id]
    );

    res.status(200).json({ template: rows[0] });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /templates/:id
 * Deletes a template by ID. If a campaign references it, MySQL's foreign key
 * constraint triggers a 409 response via our centralized error handler.
 */
export async function deleteTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parsePositiveId(req.params.id);

    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM templates WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Template not found.', 404);
    }

    res.status(200).json({ message: 'Template deleted.' });
  } catch (error) {
    next(error);
  }
}
