import { app } from './app';
import { env } from './config/env';
import { pool } from './config/db';
import { ensureDatabaseSchema } from './config/initDb';

async function start(): Promise<void> {
  try {
    await ensureDatabaseSchema();
  } catch (error) {
    console.error('[API] Failed to initialize database schema:', error);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`[API] Server running on port ${env.port}`);
    console.log(`[API] Swagger docs at http://localhost:${env.port}/api-docs`);
  });

  /**
   * Graceful shutdown for cloud hosts (Railway, Render, Fly.io, Docker).
   * Stops accepting new requests, finishes in-flight responses, and closes MySQL pool.
   */
  async function shutdown(signal: string): Promise<void> {
    console.log(`[API] Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      try {
        await pool.end();
        console.log('[API] MySQL pool closed. Exiting.');
        process.exit(0);
      } catch (error) {
        console.error('[API] Error closing MySQL pool:', error);
        process.exit(1);
      }
    });
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void start();
