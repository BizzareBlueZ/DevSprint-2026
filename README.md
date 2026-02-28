# IUT Cafeteria — Frontend & Database

DevSprint 2026 · IUT Computer Society

---

## Quick Start (Dev Mode)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

**Test credentials:**

| Student ID | Email | Password |
|---|---|---|
| 230042135 | 230042135@iut-dhaka.edu | password123 |
| 220041001 | 220041001@iut-dhaka.edu | password123 |
| 230041002 | 230041002@iut-dhaka.edu | password123 |

---

## Frontend Pages

| Route | Page | Description |
|---|---|---|
| `/login` | Login | IUT email + password authentication |
| `/apps` | Apps | Home dashboard with app tiles |
| `/apps/cafeteria` | Cafeteria | Buy dinner / emergency coupons + calendar |
| `/apps/cafeteria-ramadan` | Ramadan | Advance token booking with date picker |
| `/apps/wallet` | Wallet | SmartCard balance + transaction history |
| `/order/:id` | Order Tracker | Real-time status (Pending → Ready) via WebSocket |
| `/account` | Account | Student profile |

---

## Database Setup

```bash
# With PostgreSQL running locally:
psql -U postgres -f database/init.sql

# Or via Docker:
docker run --name iut-postgres \
  -e POSTGRES_DB=cafeteria \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=secret123 \
  -v $(pwd)/database/init.sql:/docker-entrypoint-initdb.d/init.sql \
  -p 5432:5432 -d postgres:15-alpine
```

### Schema Overview

```
students        — IUT student accounts (email-based login)
menu_items      — Cafeteria food offerings
stock           — Inventory with optimistic locking (version column)
orders          — All meal orders with status tracking
tokens          — Pre-purchased meal tokens (Ramadan)
transactions    — SmartCard wallet ledger
wallet_balances — View: computed balance per student
```

### Optimistic Locking (Stock)

The `stock` table uses a `version` column to prevent overselling:

```sql
UPDATE stock
SET quantity = quantity - 1, version = version + 1
WHERE item_id = $1 AND version = $2 AND quantity > 0;
-- If 0 rows affected → conflict, retry or reject
```

---

## Environment Variables (frontend dev)

The Vite dev server proxies API calls:
- `/api/auth/*` → `http://localhost:3001`  (Identity Provider)
- `/api/*`      → `http://localhost:3000`  (Order Gateway)

In production Docker, nginx handles the proxying.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| UI Framework | React 18 + Vite | Fast HMR, React state for live updates |
| Routing | React Router v6 | SPA navigation |
| HTTP | Axios | Interceptors for JWT injection |
| Real-time | Socket.IO client | WebSocket order tracker |
| Date utils | date-fns | Calendar & formatting |
| Database | PostgreSQL 15 | ACID, optimistic locking |
| Auth | JWT (bcrypt passwords) | Stateless, no DB call on validation |
