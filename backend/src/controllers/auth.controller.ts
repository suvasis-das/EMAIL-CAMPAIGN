import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest, generateToken } from '../middleware/auth.middleware';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

/**
 * POST /auth/register
 * Registers a new user account with a hashed password and returns a JWT token.
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!name) {
      throw new AppError('Please provide your name.', 400);
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new AppError('Please provide a valid email address.', 400);
    }
    if (!password || password.length < 6) {
      throw new AppError('Password must be at least 6 characters long.', 400);
    }

    // Check if email already exists
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      throw new AppError('An account with this email already exists.', 409);
    }

    // Hash the password with 10 salt rounds
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash]
    );

    const userId = result.insertId;
    const token = generateToken({ userId, email, name });

    res.status(201).json({
      message: 'Account created successfully.',
      user: {
        id: userId,
        name,
        email,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/login
 * Verifies email and password, then returns a signed JWT token.
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      throw new AppError('Please provide both email and password.', 400);
    }

    const [users] = await pool.query<UserRow[]>(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      throw new AppError('Invalid email or password.', 401);
    }

    const user = users[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      throw new AppError('Invalid email or password.', 401);
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    res.status(200).json({
      message: 'Signed in successfully.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/me
 * Returns the currently authenticated user's profile based on the Bearer JWT token.
 */
export async function getMe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated.', 401);
    }

    const [users] = await pool.query<UserRow[]>(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      throw new AppError('User account not found.', 404);
    }

    const user = users[0];

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
}
