# Mailqueue — Email Campaigner

A full-stack bulk email campaign application built with **Node.js, TypeScript, Express, MySQL (`mysql2`), Nodemailer, `node-cron`, and Next.js (App Router)**.

A user uploads leads via CSV, writes reusable email templates with `{{name}}` and `{{company}}` placeholders, and launches a campaign. Instead of sending emails inside the HTTP request (which would time out on large lists), the API queues one `pending` row per lead in MySQL. A separate background worker wakes up every minute, sends 10 emails at a time via Nodemailer, retries failures up to 3 times, and updates delivery status in real time for the dashboard.

---

## Architecture Overview

```
[ Next.js Frontend (:3000) ]
           │  HTTP / JSON + CSV upload
           ▼
[ Express REST API (:4000) ] ──────► [ MySQL Database ]
                                       - leads
                                       - templates
                                       - campaigns
                                       - email_logs (job queue + audit log)
                                            ▲
                                            │ polls 10 rows / minute
                                   [ node-cron Worker ]
                                            │ renders {{placeholders}}
                                            ▼
                                   [ Nodemailer -> Mailtrap SMTP ]
```

### Folder Structure

```
email-campigner/
├── database/
│   └── schema.sql                 # MySQL tables, foreign keys, and indexes
├── backend/
│   ├── .env.example
│   ├── jest.config.js
│   ├── src/
│   │   ├── app.ts                 # Express app (CORS, Swagger, routes, error handler)
│   │   ├── server.ts              # HTTP server entry point
│   │   ├── config/                # env, mysql2 pool, Nodemailer, OpenAPI spec
│   │   ├── controllers/           # leads, templates, campaigns business logic
│   │   ├── routes/                # Express routers
│   │   ├── middleware/            # AppError + centralized error handler
│   │   ├── utils/
│   │   │   └── renderTemplate.ts  # Pure function for {{placeholder}} substitution
│   │   └── worker/
│   │       ├── emailWorker.ts     # Batch fetch, render, send, retry, status update
│   │       └── index.ts           # Standalone node-cron process
│   └── tests/
│       ├── renderTemplate.test.ts # Unit tests for template rendering
│       └── campaigns.test.ts      # API tests for campaign creation & stats
├── frontend/
│   ├── .env.example
│   └── src/
│       ├── lib/                   # Typed API client + client-side preview renderer
│       ├── components/            # Persistent sidebar navigation + API status check
│       └── app/                   # Dashboard (/), /leads, /templates, /campaigns
├── sample-leads.csv               # Sample CSV for testing uploads
└── README.md
```

---

## Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Database**: MySQL (`mysql2/promise` with plain parameterized SQL — no heavy ORM)
- **Email Delivery**: Nodemailer (configured for Mailtrap SMTP in development)
- **Background Worker**: `node-cron` (runs every minute, processes 10 emails per batch)
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **API Docs**: Swagger UI / OpenAPI 3.0 at `/api-docs`
- **Testing**: Jest + Supertest

---

## Features

- **Lead Management**: Upload contacts via CSV (`POST /leads/upload`), automatically skip duplicate emails with MySQL `INSERT IGNORE` + `UNIQUE(email)`, search/filter leads.
- **Template Studio**: Create, edit, and delete email templates (`POST/GET/PUT/DELETE /templates`) with clickable `{{name}}`, `{{company}}`, `{{email}}` tokens and an instant live email preview.
- **Transactional Campaign Creation**: `POST /campaigns` creates the campaign and bulk-inserts one `pending` `email_log` per lead inside a single MySQL transaction.
- **Fault-Tolerant Background Worker**: Runs every minute via `node-cron`, picks up to 10 pending or retryable emails, renders placeholders with a pure function, sends via Nodemailer, and retries failed sends up to 3 times before marking them permanently `failed`.
- **Auto-Refreshing Delivery Dashboard**: Polls `GET /campaigns/:id/stats` every 5 seconds with pause/resume controls, delivery breakdown (`sent` / `pending` / `failed`), segmented progress bar, and per-recipient delivery logs + error messages.
- **Interactive API Docs**: OpenAPI 3.0 specification served at `http://localhost:4000/api-docs`.

---

## Setup Guide

### Prerequisites

- Node.js 18+ (tested on Node 22/26)
- MySQL 8.0+ running locally
- A free [Mailtrap](https://mailtrap.io/) Email Testing inbox for development SMTP credentials

### 1. Create the MySQL Database

Run the provided schema file to create the `email_campaigner` database, all 4 tables, foreign keys, and indexes:

```bash
mysql -u root -p < database/schema.sql
```

### 2. Configure Environment Variables

**Backend:**

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in your MySQL password and Mailtrap SMTP credentials (`SMTP_USER` and `SMTP_PASS`).

**Frontend:**

```bash
cp frontend/.env.example frontend/.env.local
```

(`NEXT_PUBLIC_API_URL=http://localhost:4000` works out of the box for local development.)

### 3. Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend (in another terminal or back from project root)
cd frontend && npm install
```

### 4. Run the Application (3 Terminals)

Running the API, worker, and frontend in separate terminals mirrors how they are deployed independently in production:

```bash
# Terminal 1: Backend API (http://localhost:4000)
cd backend
npm run dev

# Terminal 2: Background Email Worker (runs every minute)
cd backend
npm run worker:dev

# Terminal 3: Next.js Frontend (http://localhost:3000)
cd frontend
npm run dev
```

- **App UI**: http://localhost:3000
- **Swagger API Docs**: http://localhost:4000/api-docs
- **Health Check**: http://localhost:4000/health

### 5. Run Tests

```bash
cd backend
npm test
```

---

## API Reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Verify API and MySQL connectivity |
| `GET` | `/api-docs` | Interactive Swagger / OpenAPI UI |
| `POST` | `/leads/upload` | Upload CSV (`file` field); skips duplicate emails |
| `GET` | `/leads` | List all leads |
| `POST` | `/templates` | Create an email template |
| `GET` | `/templates` | List all templates |
| `PUT` | `/templates/:id` | Update a template |
| `DELETE` | `/templates/:id` | Delete a template (returns `409` if used by a campaign) |
| `POST` | `/campaigns` | Create a campaign and queue one `pending` email per lead |
| `GET` | `/campaigns` | List all campaigns with delivery stats |
| `GET` | `/campaigns/:id/stats` | Get `sent`/`failed`/`pending` counts and recipient logs |

---

## Challenges and How I Solved Them

1. **Preventing HTTP timeouts during bulk email sending**
   - *Challenge*: Sending emails synchronously inside `POST /campaigns` would block the HTTP request for minutes if there are hundreds of leads, and a single SMTP error could crash the request halfway through.
   - *Solution*: Decoupled queueing from sending. `POST /campaigns` only inserts `pending` rows into `email_logs` inside a fast SQL transaction and returns `201` immediately. A standalone `node-cron` worker sends 10 emails per minute in the background.

2. **Handling duplicate leads cleanly on CSV re-uploads**
   - *Challenge*: Users often re-upload updated CSVs that overlap with existing leads, or contain duplicate emails inside the same file. Checking every email one-by-one with `SELECT` queries is slow and prone to race conditions.
   - *Solution*: Added a `UNIQUE` constraint on `leads.email` in MySQL and used bulk `INSERT IGNORE INTO leads (name, email, company) VALUES ?`. MySQL inserts new rows in one round-trip, skips duplicates automatically, and `result.affectedRows` tells us the exact count of newly inserted vs. skipped rows.

3. **Retry logic without infinite loops or overlapping worker ticks**
   - *Challenge*: Temporary SMTP blips shouldn't permanently fail an email, but broken addresses shouldn't retry forever. Also, if a batch takes longer than 60 seconds, two cron ticks could pick up the same rows simultaneously.
   - *Solution*: Tracked `retry_count` on `email_logs`. The worker queries `WHERE status = 'pending' OR (status = 'failed' AND retry_count < 3)`. After 3 failed attempts, the row stays permanently `failed` with its `error_message`. An in-process `isRunning` lock prevents overlapping cron runs (and for multi-worker scaling, the next step would be `SELECT ... FOR UPDATE SKIP LOCKED` or a Redis queue like BullMQ).

4. **Keeping template rendering predictable and easy to test**
   - *Challenge*: Mixing placeholder substitution directly into Nodemailer calls makes edge cases (`{{ name }}`, missing company fields, case differences) hard to test without mocking SMTP.
   - *Solution*: Extracted `renderTemplate(template, variables)` into a standalone pure function in `backend/src/utils/renderTemplate.ts`. It has zero external dependencies, is covered by fast Jest unit tests, and is mirrored on the frontend for instant live previews.
