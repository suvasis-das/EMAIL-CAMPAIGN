import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './errorHandler';

export interface TokenPayload {
  userId: number;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Creates a signed JWT token valid for 7 days.
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: '7d',
  });
}

/**
 * Express middleware that enforces authentication.
 * Looks for `Authorization: Bearer <token>` in the HTTP request headers.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Please sign in.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;
    req.user = decoded;
    return next();
  } catch {
    return next(
      new AppError('Session expired or invalid token. Please sign in again.', 401)
    );
  }
}

/**
 * Express middleware that checks for authentication optionally.
 * If a valid token is provided, attaches `req.user`, but allows the request to proceed if omitted.
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;
      req.user = decoded;
    } catch {
      // Ignore token verification errors for optional auth
    }
  }

  next();
}
