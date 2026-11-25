import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app';
import { pool } from '../src/config/db';

jest.mock('../src/config/db', () => ({
  pool: {
    query: jest.fn(),
    getConnection: jest.fn(),
  },
}));

const mockedPool = pool as unknown as {
  query: jest.Mock;
  getConnection: jest.Mock;
};

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('successfully registers a new user and returns user info + JWT', async () => {
      // 1. Check existing email -> none found
      mockedPool.query.mockResolvedValueOnce([[]]);
      // 2. Insert into users -> insertId 42
      mockedPool.query.mockResolvedValueOnce([{ insertId: 42 }]);

      const res = await request(app).post('/auth/register').send({
        name: 'Sarah Connor',
        email: 'sarah@resistance.org',
        password: 'Password123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.user).toEqual({
        id: 42,
        name: 'Sarah Connor',
        email: 'sarah@resistance.org',
      });
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(20);
    });

    it('rejects registration with 409 if email already exists', async () => {
      mockedPool.query.mockResolvedValueOnce([[{ id: 1 }]]);

      const res = await request(app).post('/auth/register').send({
        name: 'Existing User',
        email: 'taken@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('rejects registration with 400 if password is under 6 characters', async () => {
      const res = await request(app).post('/auth/register').send({
        name: 'Short Pass',
        email: 'valid@example.com',
        password: '123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 6 characters/i);
    });
  });

  describe('POST /auth/login', () => {
    it('successfully logs in with valid credentials', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass123!', 10);

      mockedPool.query.mockResolvedValueOnce([
        [
          {
            id: 15,
            name: 'John Doe',
            email: 'john@example.com',
            password_hash: passwordHash,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      ]);

      const res = await request(app).post('/auth/login').send({
        email: 'john@example.com',
        password: 'CorrectPass123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        id: 15,
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect(typeof res.body.token).toBe('string');
    });

    it('returns 401 when password does not match', async () => {
      const passwordHash = await bcrypt.hash('Secret123', 10);

      mockedPool.query.mockResolvedValueOnce([
        [
          {
            id: 15,
            name: 'John Doe',
            email: 'john@example.com',
            password_hash: passwordHash,
          },
        ],
      ]);

      const res = await request(app).post('/auth/login').send({
        email: 'john@example.com',
        password: 'WrongPassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('returns 401 when email is not found', async () => {
      mockedPool.query.mockResolvedValueOnce([[]]);

      const res = await request(app).post('/auth/login').send({
        email: 'unknown@example.com',
        password: 'SomePassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns current user profile when valid token is provided', async () => {
      const passwordHash = await bcrypt.hash('Pass123!', 10);

      // Log in first to get a real valid JWT
      mockedPool.query.mockResolvedValueOnce([
        [
          {
            id: 88,
            name: 'Alice',
            email: 'alice@wonderland.com',
            password_hash: passwordHash,
          },
        ],
      ]);

      const loginRes = await request(app).post('/auth/login').send({
        email: 'alice@wonderland.com',
        password: 'Pass123!',
      });

      const token = loginRes.body.token;

      // Mock lookup for GET /auth/me
      mockedPool.query.mockResolvedValueOnce([
        [
          {
            id: 88,
            name: 'Alice',
            email: 'alice@wonderland.com',
            created_at: '2026-03-01T12:00:00.000Z',
          },
        ],
      ]);

      const meRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user).toEqual({
        id: 88,
        name: 'Alice',
        email: 'alice@wonderland.com',
        created_at: '2026-03-01T12:00:00.000Z',
      });
    });
  });
});
