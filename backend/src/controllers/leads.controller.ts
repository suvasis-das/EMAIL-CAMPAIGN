import { Request, Response, NextFunction } from 'express';
import { parse } from 'csv-parse/sync';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { AppError } from '../middleware/errorHandler';

// Simple email format check (keeps validation readable and dependency-free)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CsvLeadRow {
  name?: string;
  email?: string;
  company?: string;
}

/**
 * POST /leads/upload
 * Parses an uploaded CSV file (field name: "file") and inserts leads into MySQL.
 * Duplicate emails are skipped automatically using `INSERT IGNORE` + the UNIQUE constraint.
 */
export async function uploadLeads(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('Please upload a CSV file using form field "file".', 400);
    }

    const csvText = req.file.buffer.toString('utf-8');

    let records: CsvLeadRow[];
    try {
      records = parse(csvText, {
        columns: (header: string[]) => header.map((col) => col.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as CsvLeadRow[];
    } catch {
      throw new AppError(
        'Could not parse CSV file. Expected columns: name, email, company.',
        400
      );
    }

    if (records.length === 0) {
      throw new AppError('The uploaded CSV file contains no rows.', 400);
    }

    // Separate valid rows from malformed rows (missing name or invalid email)
    const validRows: Array<[string, string, string]> = [];
    let invalidCount = 0;

    for (const row of records) {
      const name = (row.name || '').trim();
      const email = (row.email || '').trim().toLowerCase();
      const company = (row.company || '').trim();

      if (!name || !EMAIL_REGEX.test(email)) {
        invalidCount += 1;
        continue;
      }

      validRows.push([name, email, company]);
    }

    if (validRows.length === 0) {
      throw new AppError(
        'No valid leads found. Ensure the CSV has "name" and valid "email" columns.',
        400
      );
    }

    // INSERT IGNORE tells MySQL to silently skip any row that violates the
    // UNIQUE constraint on leads.email (both existing DB rows and in-file duplicates).
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT IGNORE INTO leads (name, email, company) VALUES ?',
      [validRows]
    );

    const inserted = result.affectedRows;
    const skippedDuplicates = validRows.length - inserted;

    res.status(201).json({
      message: 'CSV processed successfully.',
      totalRows: records.length,
      inserted,
      skippedDuplicates,
      invalidRows: invalidCount,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /leads
 * Returns all leads, newest first.
 */
export async function getLeads(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, email, company, created_at FROM leads ORDER BY created_at DESC, id DESC'
    );

    res.status(200).json({ leads: rows });
  } catch (error) {
    next(error);
  }
}
