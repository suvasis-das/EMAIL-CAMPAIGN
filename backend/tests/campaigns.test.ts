import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/config/db';
import { generateToken } from '../src/middleware/auth.middleware';

// Mock the MySQL pool so API tests run fast and deterministically
// without requiring a live MySQL database.
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

const testToken = generateToken({
  userId: 1,
  email: 'operator@mailqueue.app',
  name: 'Test Operator',
});

describe('Campaigns API', () => {
  let mockConnection: {
    beginTransaction: jest.Mock;
    query: jest.Mock;
    commit: jest.Mock;
    rollback: jest.Mock;
    release: jest.Mock;
  };

  beforeEach(() => {
    mockConnection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    mockedPool.getConnection.mockResolvedValue(mockConnection);
  });

  describe('POST /campaigns', () => {
    it('returns 401 when no authorization header is provided', async () => {
      const response = await request(app)
        .post('/campaigns')
        .send({ name: 'Unauthorized Run', template_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/authentication required/i);
    });

    it('creates a campaign and queues one pending email_log per lead', async () => {
      // 1. Template lookup
      mockConnection.query
        .mockResolvedValueOnce([[{ id: 2, name: 'Product Intro' }]])
        // 2. Leads lookup
        .mockResolvedValueOnce([[{ id: 10 }, { id: 11 }, { id: 12 }]])
        // 3. Insert campaign
        .mockResolvedValueOnce([{ insertId: 7 }])
        // 4. Bulk insert email_logs
        .mockResolvedValueOnce([{ affectedRows: 3 }]);

      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ name: 'November Launch', template_id: 2 });

      expect(response.status).toBe(201);
      expect(response.body.campaign).toEqual({
        id: 7,
        name: 'November Launch',
        template_id: 2,
        template_name: 'Product Intro',
        status: 'pending',
        queued_emails: 3,
      });

      // Verify transaction lifecycle and bulk insert payload
      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.query).toHaveBeenNthCalledWith(
        4,
        'INSERT INTO email_logs (campaign_id, lead_id, status) VALUES ?',
        [
          [
            [7, 10, 'pending'],
            [7, 11, 'pending'],
            [7, 12, 'pending'],
          ],
        ]
      );
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
      expect(mockConnection.rollback).not.toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when campaign name is missing', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ name: '   ', template_id: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/campaign name is required/i);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('returns 404 and rolls back when the template does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ name: 'Ghost Template Run', template_id: 999 });

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/template not found/i);
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('returns 400 and rolls back when there are no leads in the database', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ id: 1, name: 'Welcome' }]])
        .mockResolvedValueOnce([[]]);

      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ name: 'Empty Audience Run', template_id: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/0 leads/i);
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /campaigns/:id/stats', () => {
    it('returns 401 when no authorization header is provided', async () => {
      const response = await request(app).get('/campaigns/7/stats');

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/authentication required/i);
    });

    it('returns sent, failed, pending counts and recipient logs', async () => {
      mockedPool.query
        // 1. Campaign metadata
        .mockResolvedValueOnce([
          [
            {
              id: 7,
              name: 'November Launch',
              template_id: 2,
              template_name: 'Product Intro',
              status: 'running',
              created_at: '2026-11-18T10:00:00.000Z',
            },
          ],
        ])
        // 2. Aggregated status counts
        .mockResolvedValueOnce([
          [
            { status: 'sent', count: 5 },
            { status: 'failed', count: 1 },
            { status: 'pending', count: 4 },
          ],
        ])
        // 3. Recipient delivery logs
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              lead_id: 10,
              lead_name: 'Aarav Mehta',
              lead_email: 'aarav.mehta@northstarlabs.io',
              lead_company: 'Northstar Labs',
              status: 'sent',
              retry_count: 0,
              error_message: null,
              sent_at: '2026-11-18T10:01:00.000Z',
            },
          ],
        ]);

      const response = await request(app)
        .get('/campaigns/7/stats')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.stats).toEqual({
        total: 10,
        sent: 5,
        failed: 1,
        pending: 4,
      });
      expect(response.body.logs).toHaveLength(1);
    });

    it('returns 404 when campaign does not exist', async () => {
      mockedPool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/campaigns/404/stats')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/campaign not found/i);
    });
  });
});
