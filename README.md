# Mailqueue — Bulk Email Campaign & Queue Platform

[![Live App](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=flat&logo=vercel)](https://mailqueue-campaigner.vercel.app)
[![API Docs](https://img.shields.io/badge/Swagger_Docs-OpenAPI_3.0-85EA2D?style=flat&logo=swagger&logoColor=black)](https://api-production-2c66ea97.up.railway.app/api-docs)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat&logo=mysql&logoColor=white)](https://www.mysql.com/)

A full-stack bulk email campaign manager built with **Node.js, TypeScript, Express, MySQL (`mysql2`), Nodemailer, `node-cron`, and Next.js (App Router)**.

Instead of sending emails synchronously inside HTTP requests, the API writes queued delivery jobs to MySQL inside an atomic transaction while a decoupled background worker processes batches of 10 emails per minute with automatic 3x retry handling and live status monitoring.

### Live Deployment
- **Web App:** https://mailqueue-campaigner.vercel.app
- **REST API:** https://api-production-2c66ea97.up.railway.app
- **Interactive OpenAPI / Swagger Docs:** https://api-production-2c66ea97.up.railway.app/api-docs
- **API Health Check:** https://api-production-2c66ea97.up.railway.app/health

---

## System Architecture

```text
┌─────────────────────────────┐
│   Next.js Frontend (Vercel) │  Leads CSV Upload · Template Live Preview · Dashboard (5s Poll)
└──────────────┬──────────────┘
               │ REST / JSON + Multipart CSV
               ▼
┌─────────────────────────────┐         ┌──────────────────────────────────────┐
│  Express API (Railway)      │────────▶│        MySQL 8 (Railway)             │
│  - Validation & AppError    │         │  - leads (UNIQUE email)              │
│  - Bulk INSERT IGNORE       │         │  - templates ({{placeholders}})      │
│  - SQL Transactions         │         │  - campaigns (FK -> templates)       │
│  - OpenAPI 3.0 (/api-docs)  │         │  - email_logs (indexed job queue)    │
└─────────────────────────────┘         └──────────────────▲───────────────────┘
                                                           │ Polls 10 rows / min
                                        ┌──────────────────┴───────────────────┐
                                        │   Background Worker (Railway)        │
                                        │  - node-cron + overlap lock          │
                                        │  - Pure renderTemplate() engine      │
                                        │  - Up to 3x retries + error logging  │
                                        └──────────────────┬───────────────────┘
                                                           │ SMTP (Nodemailer)
                                                           ▼
                                        ┌──────────────────────────────────────┐
                                        │      Mailtrap / SMTP Provider        │
                                        └──────────────────────────────────────┘
```

---

## Key Features

- **Operator Authentication & Access:** User registration and sign-in backed by bcrypt password hashing (10 salt rounds) and stateless 7-day JWT tokens (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`), complete with a dedicated login/signup page and instant evaluation demo account.
- **CSV Lead Ingestion with Duplicate Protection:** Upload leads via `POST /leads/upload` (`multer` + `csv-parse`). Validates email syntax and uses bulk `INSERT IGNORE` backed by a MySQL `UNIQUE` constraint on `leads.email`, returning exact `inserted`, `skippedDuplicates`, and `invalidRows` counts.
- **Template Studio with Live Preview:** Full CRUD for reusable templates supporting `{{name}}`, `{{company}}`, and `{{email}}` placeholders, paired with a split-pane email client preview rendered on every keystroke.
- **Transactional Campaign Queueing:** `POST /campaigns` creates the campaign record and bulk-inserts one `pending` row per lead into `email_logs` inside a single MySQL transaction (`beginTransaction` → `commit` / `rollback`), preventing partial or orphaned campaigns.
- **Fault-Tolerant Background Worker:** Runs as an independent process (`node-cron` every minute), fetches up to 10 `pending` or retryable `failed` (`retry_count < 3`) rows, renders templates via a pure function, dispatches via Nodemailer, records SMTP errors, and automatically transitions campaign status (`pending` → `running` → `completed`).
- **Auto-Refreshing Telemetry Dashboard:** Displays live `sent`, `pending`, and `failed` metrics, proportional delivery bar, and recipient-level logs (with retry count `0/3` and last SMTP error) polling every 5 seconds with pause/resume controls.
- **Interactive API Documentation & Tests:** Complete OpenAPI 3.0 spec served at `/api-docs`, plus 19 automated Jest + Supertest tests covering auth, template rendering edge cases, and campaign API transactions/rollbacks.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons |
| **Backend API** | Node.js, TypeScript, Express, bcryptjs, jsonwebtoken, Multer, `csv-parse`, Swagger UI |
| **Database** | MySQL 8 (`mysql2/promise` with plain parameterized SQL — no ORM) |
| **Worker & Email** | `node-cron`, Nodemailer (Mailtrap SMTP in dev / any SMTP in prod) |
| **Testing** | Jest, `ts-jest`, Supertest (19 automated tests) |
| **Deployment** | Vercel (Frontend), Railway (MySQL + API + Worker), GitHub |

---

## Database Schema

Defined in [`database/schema.sql`](./database/schema.sql) (and auto-verified on startup via [`backend/src/config/initDb.ts`](./backend/src/config/initDb.ts)):

- **`users`** (`id`, `name`, `email UNIQUE`, `password_hash`, `created_at`)
- **`leads`** (`id`, `name`, `email UNIQUE`, `company`, `created_at`)
- **`templates`** (`id`, `name`, `subject`, `body`, `created_at`)
- **`campaigns`** (`id`, `name`, `template_id FK -> templates(id) ON DELETE RESTRICT`, `status ENUM('pending','running','completed')`, `created_at`)
- **`email_logs`** (`id`, `campaign_id FK`, `lead_id FK`, `status ENUM('pending','sent','failed')`, `retry_count`, `error_message`, `sent_at`, `UNIQUE(campaign_id, lead_id)`)
- **Indexes:** `idx_email_logs_status (status)` for fast worker queue polling and `idx_email_logs_campaign_status (campaign_id, status)` for fast dashboard aggregations.

---

## API Endpoints

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Register a new user with name, email, and password |
| `POST` | `/auth/login` | Sign in with email and password to receive a JWT |
| `GET` | `/auth/me` | Fetch authenticated user profile via Bearer token |
| `GET` | `/health` | Verifies API uptime and MySQL connectivity |
| `GET` | `/api-docs` | Interactive Swagger / OpenAPI 3.0 documentation |
| `POST` | `/leads/upload` | Multipart CSV upload (`file`); skips duplicate emails |
| `GET` | `/leads` | Returns all stored leads |
| `POST` | `/templates` | Creates an email template with `{{placeholder}}` support |
| `GET` | `/templates` | Lists all templates |
| `PUT` | `/templates/:id` | Updates a template |
| `DELETE` | `/templates/:id` | Deletes a template (`409 Conflict` if referenced by a campaign) |
| `POST` | `/campaigns` | Creates a campaign and queues one `pending` `email_log` per lead |
| `GET` | `/campaigns` | Lists all campaigns with aggregated delivery stats |
| `GET` | `/campaigns/:id/stats` | Returns `total`/`sent`/`failed`/`pending` counts and recipient delivery logs |

---

## Project Structure

```text
email-campigner/
├── database/
│   └── schema.sql                 # MySQL tables, foreign keys, and indexes
├── backend/
│   ├── .env.example
│   ├── jest.config.js
│   ├── src/
│   │   ├── app.ts                 # Express app (CORS, JSON, Swagger, routes, error handler)
│   │   ├── server.ts              # HTTP entry point with graceful SIGTERM shutdown
│   │   ├── config/                # env, mysql2 pool, auto-schema init, Nodemailer, Swagger
│   │   ├── controllers/           # leads, templates, campaigns SQL controllers
│   │   ├── routes/                # Express route definitions
│   │   ├── middleware/            # AppError + centralized error handling
│   │   ├── utils/
│   │   │   └── renderTemplate.ts  # Pure {{placeholder}} rendering function
│   │   └── worker/
│   │       ├── emailWorker.ts     # Batch processor (10/min) + 3x retry state machine
│   │       └── index.ts           # Standalone node-cron process with overlap & SIGTERM guards
│   └── tests/
│       ├── renderTemplate.test.ts # 5 unit tests for placeholder substitution
│       └── campaigns.test.ts      # 6 API tests (Supertest + mocked MySQL pool)
├── frontend/
│   ├── .env.example
│   └── src/
│       ├── lib/                   # Typed API client + live template preview helper
│       ├── components/            # Persistent sidebar navigation + live API health indicator
│       └── app/                   # Dashboard (/), /leads, /templates, /campaigns
├── sample-leads.csv               # Ready-to-upload test dataset
└── README.md
```

---

## Running Locally

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- Free [Mailtrap](https://mailtrap.io/) Email Testing inbox (for SMTP credentials)

### 1. Create the Database
```bash
mysql -u root -p < database/schema.sql
```

### 2. Configure Environment Variables
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```
Fill in your MySQL password and Mailtrap `SMTP_USER` / `SMTP_PASS` inside `backend/.env`.

### 3. Install Dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Start All 3 Processes
```bash
# Terminal 1 — Express API (http://localhost:4000)
cd backend && npm run dev

# Terminal 2 — Background Email Worker (runs every minute)
cd backend && npm run worker:dev

# Terminal 3 — Next.js Frontend (http://localhost:3000)
cd frontend && npm run dev
```

### 5. Run the Test Suite
```bash
cd backend && npm test
```

---

## Engineering Challenges & How I Solved Them

1. **Decoupling bulk email delivery from HTTP request lifecycles**
   - *Problem:* Sending SMTP emails synchronously inside `POST /campaigns` would cause HTTP timeouts on large lead lists and risk partial sends if the server restarted mid-request.
   - *Solution:* Modeled `email_logs` as a durable MySQL job queue. `POST /campaigns` commits the campaign and all `pending` rows in a single SQL transaction and returns `201` immediately. A standalone `node-cron` worker drains 10 emails per minute independently.

2. **Idempotent CSV uploads without N+1 queries**
   - *Problem:* Re-uploading overlapping CSV files or CSVs containing internal duplicate addresses should never fail the whole import or issue one `SELECT` query per row.
   - *Solution:* Enforced a `UNIQUE` index on `leads.email` and performed a single bulk `INSERT IGNORE INTO leads (name, email, company) VALUES ?`. Comparing `result.affectedRows` against valid CSV rows gives exact inserted vs. duplicate-skipped counts in one database round-trip.

3. **Bounded retries and safe shutdown in the background worker**
   - *Problem:* Transient SMTP failures should retry automatically, permanent failures shouldn't loop forever, slow batches shouldn't overlap across cron ticks, and cloud redeploys (`SIGTERM`) shouldn't kill an email mid-flight.
   - *Solution:* Query `WHERE status = 'pending' OR (status = 'failed' AND retry_count < 3)` with an index on `status`, stopping retries permanently at `3/3` while preserving `error_message`. Added an in-process `isRunning` lock to prevent overlapping ticks and `SIGTERM`/`SIGINT` handlers to drain active batches before closing the MySQL connection pool.

4. **Testability without live infrastructure dependencies**
   - *Problem:* Coupling placeholder rendering directly to SMTP delivery or coupling the Express app to `app.listen()` makes unit and API tests slow and flaky.
   - *Solution:* Isolated `renderTemplate()` as a pure function (`backend/src/utils/renderTemplate.ts`) and exported `app` separately from `server.ts`, enabling fast Jest + Supertest suites covering template edge cases and SQL transaction rollbacks.
