# 🍽️ IUT Cafeteria — Microservices Platform

**DevSprint 2026 · IUT Computer Society**

A production-grade microservices platform built to handle high-concurrency cafeteria ordering at IUT — particularly during Ramadan peak hours. The system keeps order placement responsive under burst traffic, prevents stock overselling, and delivers real-time order updates to students.

📺 **[Watch Live Demo on YouTube →](https://youtu.be/CXwbltAqnac)**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Test Accounts](#test-accounts)
- [Order Flow](#order-flow)
- [API Reference](#api-reference)
- [Real-time Features](#real-time-features)
- [Database](#database)
- [Configuration](#configuration)
- [Testing](#testing)
- [Special Features](#special-features)
- [Project Structure](#project-structure)

---

## Overview

The legacy single-server cafeteria system struggled under burst traffic during rush periods — causing failed requests and student uncertainty about whether orders were placed. This platform redesigns that experience as a **service-based system** that:

- ✅ Stays responsive during rush hours
- ✅ Prevents stock overselling under concurrent load
- ✅ Gives students real-time order progress
- ✅ Tolerates partial failures without collapsing the full flow
- ✅ Provides admins live visibility into service health and metrics

---

## Architecture

The system is decomposed into **six application services** behind an API Gateway, all orchestrated via Docker Compose.

### Why Microservices?

| Benefit | How it applies here |
|---|---|
| **Fault isolation** | A crash in `notification-hub` does not stop orders from being placed |
| **Independent scaling** | `kitchen-queue` — the bottleneck at lunch — can scale horizontally without duplicating the rest |
| **Schema ownership** | Each service owns its PostgreSQL schema, preventing accidental cross-service writes |

### Startup Order (Docker Compose)

Docker Compose enr, Stock Service, Kitchen Queue, Notification Hub |
| 3 — Gateways | Order Gateway, API Gateway |
| 4 — Frontend | Nginx serving the React SPA |

---

## Services

| Service | Port | Responsibility |
|---|---|---|
| 🌐 **Frontend** | 80 / 5173 | React SPA — student ordering, wallet, order tracker, admin dashboard |
| 🛡️ **API Gateway** | 8080 | Single ingress — JWT validation, rate limiting (Redis-backed), security headers (helmet), routing |
| 🔑 **Identity Provider** | 3001 | Auth lifecycle — password hashing (bcrypt, cost 10), JWT issuance via httpOnly cookies, login throttling |
| 💳 **Order Gateway** | 3000 | Core business logic — wallet debits, stock coordination, QR codes, Saga-based compensation on failure |
| 📦 **Stock Service** | 3002 | Concurrency-safe inventory — optimistic locking on `version` column, Redis cache for menu reads |
| 🍳 **Kitchen Queue** | 3003 | Async worker — RabbitMQ consumer, 3–7s prep simulation, order status updates with ack-based delivery |
| 🔔 **Notification Hub** | 3004 | Real-time layer — Socket.io for active users, Web Push (VAPID) for closed browser tabs |

---

## Tech Stack

### Frontend
| Package | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI components and state |
| Vite | 5.4.2 | Dev server + production builds |
| React Router DOM | 6.26.0 | Protected routes, nested layouts, `/order/:orderId` |
| Axios | 1.7.7 | Centralized API calls with JWT interceptors |
| Socket.io Client | 4.7.5 | Real-time order tracking with transport fallback |
| date-fns | 3.6.0 | Immutable date parsing and formatting |
| qrcode.react | — | Client-side QR rendering for order pickup |

### Backend (Common)
| Package | Version | Purpose |
|---|---|---|
| Node.js | 20 (alpine) | Runtime across all services |
| Express | 4.19.2 | HTTP framework and middleware composition |
| pg | 8.12.0 | PostgreSQL client |
| pino | — | JSON-structured logging |

### Data Layer
| Component | Image | Role |
|---|---|---|
| PostgreSQL | `postgres:15-alpine` | ACID-backed system of record for orders and wallet |
| Redis | `redis:7-alpine` | Stock read cache, idempotency markers, rate limit state |
| RabbitMQ | `rabbitmq:3-management-alpine` | Async decoupling between order acceptance and kitchen |

### Infrastructure
- **Docker Compose** — health-check-gated startup, isolated bridge networking
- **Nginx** — SPA serving with `index.html` fallback, optional TLS termination
- **GitHub Actions** — lint → test → build → Docker validation pipeline

---

## Getting Started

### Option 1 — Docker Compose (Recommended)

```bash
# 1. Clone the repo
git clone <repo-url>
cd DevSprint-2026

# 2. Set up environment variables
cp .env.example .env   # then edit values as needed

# 3. Start everything
docker-compose up --build
```

**Service URLs after startup:**

| Service | URL |
|---|---|
| Frontend | http://localhost/ |
| API Gateway | http://localhost:8080 |
| RabbitMQ Management UI | http://localhost:15672 |
| pgAdmin | http://localhost:5050 |

> RabbitMQ credentials come from `RABBITMQ_USER` / `RABBITMQ_PASSWORD` in your `.env`.

---

### Option 2 — Local Dev

**Frontend:**
```bash
cd frontend
npm ci
npm run dev
# → http://localhost:5173
```

Dev proxy routes automatically:
- `/api/auth/*` → `http://localhost:3001`
- `/api/*` → `http://localhost:3000`

**Backend (repeat per service):**
```bash
cd identity-provider   # or order-gateway, stock-service, etc.
npm ci
npm run dev
```

**Database:**

Schema is loaded automatically by Docker Compose via `database/init.sql`. For manual migrations:
```bash
cd database
node migrate.js
```

---

## Test Accounts

The database seeds test accounts on first run. Credentials are controlled by environment variables.

### Students
*(password via `SEED_STUDENT_PASSWORD` in `.env`)*

| Student ID | Email |
|---|---|
| 230042135 | 230042135@iut-dhaka.edu |
| 220041001 | 220041001@iut-dhaka.edu |
| 230041002 | 230041002@iut-dhaka.edu |

### Admins
*(passwords via `SEED_ADMIN_PASSWORD` / `SEED_IUTCS_ADMIN_PASSWORD`)*

| Username |
|---|
| `admin` |
| `iutcs` |

---

## Order Flow

A complete order travels through all six services:

```
Student submits order
        ↓
[API Gateway]       — validates JWT, attaches X-Correlation-ID
        ↓
[Order Gateway]     — deducts wallet balance
        ↓
[Stock Service]     — decrements inventory (optimistic locking)
        ↓
[RabbitMQ]          — order queued for async processing
        ↓
[Kitchen Queue]     — picks up task, simulates 3–7s prep time
        ↓
[Notification Hub]  — pushes live status to student browser / phone
```

### Order Status Lifecycle

```
PENDING → STOCK_VERIFIED → QUEUED → IN_KITCHEN → READY → PICKED_UP
```

### Failure Handling (Saga Pattern)

If stock decrement fails **after** a wallet debit, the Order Gateway automatically posts a wallet refund — keeping financial and fulfillment state aligned at all times.

### Key Implementation Patterns

| Pattern | Where | What it solves |
|---|---|---|
| **Idempotency key** | Order Gateway | Prevents duplicate orders on client retry |
| **Optimistic locking** | Stock Service | Prevents overselling under concurrent requests |
| **Saga compensation** | Order Gateway | Rolls back wallet debit if stock fails |
| **Room-based pub/sub** | Notification Hub | Each student only receives their own order events |

---

## API Reference

### Identity Provider `:3001`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/login` | Authenticate student; set httpOnly JWT cookie |
| `POST` | `/register` | Register new student |
| `POST` | `/verify` | Verify JWT validity |
| `POST` | `/admin/login` | Authenticate admin |
| `POST` | `/logout` | Clear JWT cookie |
| `GET` | `/health` | Dependency readiness |
| `GET` | `/metrics/prometheus` | Prometheus-format metrics |

### Order Gateway `:3000`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/menu` | Fetch available menu items |
| `POST` | `/orders` | Submit order (supports `X-Idempotency-Key`) |
| `GET` | `/orders/:orderId` | Get order status |
| `POST` | `/cafeteria/tokens/bulk` | Bulk Ramadan/Iftar token booking |
| `GET` | `/cafeteria/tokens` | List student's tokens |
| `GET` | `/cafeteria/purchases` | Order purchase history |
| `GET` | `/wallet/balance` | Current wallet balance |
| `GET` | `/wallet/transactions` | Transaction log |
| `POST` | `/wallet/topup` | Top up wallet (bKash / Nagad / Rocket / Bank) |
| `GET` | `/wallet/emergency/status` | Check emergency loan status |
| `POST` | `/wallet/emergency/request` | Request advance up to 1,000৳ |

### Stock Service `:3002`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/stock/:itemId` | Get stock level |
| `POST` | `/stock/:itemId/decrement` | Decrement stock (optimistic lock) |
| `GET` | `/admin/stock` | Full stock view (admin) |
| `GET` | `/admin/stock/alerts` | Low-stock alerts (admin) |
| `PUT` | `/admin/stock/:itemId` | Update stock level (admin) |

### All Services

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Dependency readiness check |
| `GET` | `/metrics` | JSON counters + uptime |
| `GET` | `/metrics/prometheus` | Prometheus text format |
| `POST` | `/chaos` | Toggle chaos mode *(admin JWT required)* |
| `GET` | `/chaos/status` | Check chaos state |
| `GET` | `/api/health/all` | Aggregated health across all services *(Gateway only)* |

---

## Real-time Features

### WebSocket — Order Tracking

Clients connect to `notification-hub` on port 3004 via Socket.io.

```js
// Client joins an order room
socket.emit('join-order', { orderId })

// Server pushes status updates
socket.on('order-status', ({ orderId, status, orderInfo, timestamp }) => {
  // update UI
})
```

### Web Push — Offline Notifications

Students receive browser push notifications even when the tab is closed. VAPID keys are configured in `.env` and managed by the Identity Provider on subscription registration.

### Chaos Engineering

Every service exposes admin-only chaos endpoints for live resilience testing:

```bash
# Toggle failure mode (random 500s or simulated lag)
POST /chaos          # requires admin JWT

# Check current chaos state
GET  /chaos/status
```

Health check endpoints are **exempted** from chaos effects.

---

## Database

A single PostgreSQL instance with strict schema isolation. Each service owns its schema.

| Schema | Tables | Owner |
|---|---|---|
| `identity` | students, admins | Identity Provider |
| `orders` | orders, tokens | Order Gateway |
| `inventory` | stock | Stock Service |
| `kitchen` | kitchen_jobs | Kitchen Queue |
| `public` | menu_items, transactions, emergency_loans, wallet_balances_materialized | Shared (read-only) |

### Automated Triggers

PostgreSQL triggers handle domain automation without application-layer overhead:

- **`updated_at` sync** — automatic timestamp on every row modification
- **Welcome wallet credit** — balance credited automatically on student registration
- **Token auto-insert** — tokens created for new students on registration
- **Token usage on READY** — token state transitions driven by order status changes
- **Wallet balance cache sync** — materialized view kept current automatically

### Migration System

```bash
cd database
node migrate.js                  # run pending migrations
./manage-migrations.sh status    # check migration state (Linux/macOS)
manage-migrations.bat status     # check migration state (Windows)
```

Timestamped migration files live in `database/migrations/`. See `database/README_MIGRATIONS.md` for the full migration guide.

---

## Configuration

All services are configured via environment variables. Docker Compose provides working defaults; override per-service via `.env` for local runs.

### Database (all services)

```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=cafeteria
DB_USER=admin
DB_PASSWORD=secret123
SEED_STUDENT_PASSWORD=<your-value>
SEED_ADMIN_PASSWORD=<your-value>
```

### Identity Provider

```env
PORT=3001
JWT_SECRET=<your-secret>
JWT_EXPIRES_IN=24h
RATE_LIMIT_WINDOW_MS=60000   # 1 minute
RATE_LIMIT_MAX=3             # max login attempts per window
VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated>
```

### Order Gateway

```env
PORT=3000
JWT_SECRET=<must-match-identity-provider>
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
STOCK_SERVICE_URL=http://stock-service:3002
NOTIFICATION_HUB_URL=http://notification-hub:3004
```

### Kitchen Queue

```env
PORT=3003
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
NOTIFICATION_HUB_URL=http://notification-hub:3004
KITCHEN_MIN_MS=3000
KITCHEN_MAX_MS=7000
```

### HTTPS / SSL (Frontend Nginx)

```env
ENABLE_HTTPS=false        # set true to activate TLS termination
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

> **Graceful degradation:** Redis is optional in `order-gateway` and `stock-service` — caching is simply disabled if unavailable. RabbitMQ is optional but required for the full async kitchen pipeline.

---

## Testing

```bash
# Order Gateway — unit tests
cd order-gateway && npm test

# Stock Service — HTTP integration tests
cd stock-service && npm test

# Frontend — component behavioral tests
cd frontend && npm test
```

| Service | Runner | Type |
|---|---|---|
| `order-gateway` | jest | Unit tests |
| `stock-service` | jest + supertest | HTTP integration tests |
| `frontend` | vitest + @testing-library/react | Component behavioral tests |

### CI/CD Pipeline (GitHub Actions)

Every push runs the full pipeline in sequence:

1. **Lint** — ESLint + Prettier across the monorepo
2. **Backend Tests** — jest + supertest per service
3. **Frontend Tests + Build** — vitest suite, then Vite production build
4. **Docker Build Validation** — all 6 images built and validated

Uses `npm ci` and Docker layer caching for reproducible, fast runs.

### End-to-End Verification Checklist

```
1. POST /login                → receive JWT cookie
2. GET  /menu                 → verify menu data returns
3. POST /orders               → include X-Idempotency-Key, get orderId back
4. Open /order/:orderId       → confirm Socket.io room join in browser
5. Watch status transitions   → PENDING → STOCK_VERIFIED → QUEUED → IN_KITCHEN → READY → PICKED_UP
6. Close browser tab          → confirm Web Push notification arrives
7. GET  /api/health/all       → all services report healthy
```

---

## Special Features

### 🚨 Emergency Balance System

Students can request a cash advance of up to **1,000৳** when their wallet balance is insufficient:

- Tracked in `public.emergency_loans`
- Outstanding loans are deducted from the next monthly allowance
- `GET /wallet/emergency/status` — check current loan
- `POST /wallet/emergency/request` — submit a new request

### 🌙 Ramadan / Iftar Token System

A dedicated booking flow for Iftar meal tokens with its own pricing and conflict validation:

| Token Type | Price | Page |
|---|---|---|
| Dinner token | 120৳ | `CafeteriaPage` |
| Iftar token | 100৳ | `CafeteriaRamadanPage` |

Bulk booking includes conflict validation — the same meal slot cannot be booked twice. Tokens are auto-created via PostgreSQL trigger on student registration.

### 💰 Wallet Top-up Methods

`POST /wallet/topup` supports four local payment methods: **bKash**, **Nagad**, **Rocket**, and **Bank transfer**.

### 🌐 Multilingual Support

A global `LanguageContext.jsx` (16 KB) provides language switching across all pages via React Context. No page reload required — switching is instantaneous and applied globally.

### 📊 System Health Dashboard

`GET /api/health/all` pings all five downstream services with a 3-second timeout and returns a combined system status:

| Status | Meaning |
|---|---|
| `healthy` | All downstream services responding within timeout |
| `degraded` | One or more services slow or returning errors |
| `unhealthy` | One or more services unreachable |

---

## Project Structure

```
DevSprint-2026/
├── frontend/              # React + Vite SPA
├── api-gateway/           # Reverse proxy, auth guard, rate limiter
├── identity-provider/     # Auth, JWT issuance, login throttling
├── order-gateway/         # Orders, wallet, menu, QR codes
├── stock-service/         # Inventory + optimistic locking
├── kitchen-queue/         # RabbitMQ consumer, prep simulation
├── notification-hub/      # Socket.io + Web Push broadcasting
├── database/              # PostgreSQL init.sql + migration runner
├── shared/                # Logger, metrics, correlation IDs, validation
├── docs/                  # OpenAPI spec, Swagger UI
└── docker-compose.yml     # Full-system orchestration
```

---

## Acknowledgements

Built for **DevSprint 2026** by the IUT Computer Society. AI tools used during development:

- **Claude / Sonnet + Opus (Anthropic)** — architecture design, backend API generation, database schema and trigger design, Docker Compose orchestration, documentation
- **ChatGPT / GPT-4o (OpenAI)** — frontend component design, React state management, CORS/auth debugging, test case writing
