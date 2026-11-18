import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class that attaches an HTTP status code to an error.
 * Example: `throw new AppError('Template not found', 404);`
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Express 404 handler for unknown routes.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Centralized Express error handler.
 *
 * All controllers pass unexpected or validation errors to `next(err)`.
 * Handling them in one place guarantees consistent JSON error responses
 * and keeps controllers short and readable.
 */
export function errorHandler(
  err: Error & { code?: string; statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Known application error thrown intentionally by our code
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Handle common MySQL errors with friendly HTTP status codes
  if (err.code === 'ER_DUP_ENTRY') {
    res.status(409).json({
      error: 'A record with that unique value already exists.',
    });
    return;
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    res.status(409).json({
      error: 'Cannot delete this record because it is used by an existing campaign.',
    });
    return;
  }

  // Handle Multer file upload errors (e.g. file too large)
  if (err.name === 'MulterError') {
    res.status(400).json({
      error: `File upload error: ${err.message}`,
    });
    return;
  }

  // Fallback for unexpected server bugs
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    error: 'Internal server error',
  });
}
