import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { pool } from './config/db';
import { swaggerDocument } from './config/swagger';
import authRoutes from './routes/auth.routes';
import leadsRoutes from './routes/leads.routes';
import templatesRoutes from './routes/templates.routes';
import campaignsRoutes from './routes/campaigns.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Express application definition.
 *
 * Notice we export `app` separately from `server.ts`.
 * This lets Jest + Supertest import `app` directly in tests without opening
 * an actual HTTP port.
 */
export const app = express();

// Allow requests from our Next.js frontend (supports comma-separated origins)
app.use(
  cors({
    origin: env.corsOrigins,
  })
);

// Parse incoming JSON request bodies
app.use(express.json());

// Swagger / OpenAPI interactive documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Simple health endpoint to verify API + MySQL status
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// Feature routes
app.use('/auth', authRoutes);
app.use('/leads', leadsRoutes);
app.use('/templates', templatesRoutes);
app.use('/campaigns', campaignsRoutes);

// 404 + Centralized error handling (must come AFTER all routes)
app.use(notFoundHandler);
app.use(errorHandler);
