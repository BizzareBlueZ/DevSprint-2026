# IUT Cafeteria — Microservices Platform

DevSprint 2026 · IUT Computer Society

Minimal setup and usage notes. (Requirement analysis and stack report are provided separately.)

---

## Run (Recommended: Docker Compose)

```bash
docker-compose up --build
```

Open:

- Frontend: http://localhost/
- RabbitMQ UI: http://localhost:15672 (credentials from `.env` — `RABBITMQ_USER` / `RABBITMQ_PASSWORD`)
- pgAdmin: http://localhost:5050

Service ports:

- `order-gateway`: 3000
- `identity-provider`: 3001
- `stock-service`: 3002
- `kitchen-queue`: 3003
- `notification-hub`: 3004

---

## Local Dev (Frontend)

```bash
cd frontend
npm ci
npm run dev
# http://localhost:5173
```

Frontend dev proxy:

- `/api/auth/*` → `http://localhost:3001`
- `/api/*` → `http://localhost:3000`

---

## Test Accounts (Seeded)

The database seed in `database/init.sql` includes students and admins.

Students (password set via `SEED_STUDENT_PASSWORD` in `.env`):

| Student ID | Email                   |
| ---------- | ----------------------- |
| 230042135  | 230042135@iut-dhaka.edu |
| 220041001  | 220041001@iut-dhaka.edu |
| 230041002  | 230041002@iut-dhaka.edu |

Admins (passwords set via `SEED_ADMIN_PASSWORD` / `SEED_IUTCS_ADMIN_PASSWORD` in `.env`):

- `admin`
- `iutcs`

---

## Real-time Order Tracking

Order status updates are delivered via Socket.io from `notification-hub` (port 3004).

Flow (high-level):

1. Frontend joins an order room (by `orderId`).
2. `kitchen-queue` updates order status and POSTs to `notification-hub`.
3. The client receives `order-status` events until READY.

---

## Database Notes

Schema is initialized automatically in Docker via `database/init.sql`.

The database uses separate schemas for service isolation:

- `identity` (students/admins)
- `orders` (orders, tokens)
- `inventory` (stock)
- `public` (menu_items, transactions, wallet_balances_materialized)

---

## Useful Commands

Run a backend service locally (example):

```bash
cd order-gateway
npm ci
npm run dev
```

Tests (where available):

```bash
cd order-gateway
npm test

cd ..\stock-service
npm test
```

Dependency installs are reproducible via per-service `package-lock.json` files (use `npm ci`).
