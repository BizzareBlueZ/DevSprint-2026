# Database Architecture & Migrations

## Overview

This database system has been redesigned to implement **true microservice isolation** with separate PostgreSQL schemas per service, proper migrations management, and optimized wallet calculations.

## Schema Structure

The database is organized into 5 schemas:

### 1. **identity** - Identity Provider Service

- `admins` - System administrators
- `students` - Student accounts with credentials
- **Responsibility**: User authentication and identity management
- **Access Pattern**: Only accessed by identity-provider service

### 2. **public** - Shared Core Data

- `menu_items` - Items available in cafeteria
- `transactions` - **Authoritative** wallet transaction history
- `wallet_balances_materialized` - **Cached** wallet balances (table, not view)
- **Responsibility**: Shared data accessible across services
- **Access Pattern**: Read by all services, written by order-gateway

### 3. **orders** - Order Gateway Service

- `orders` - Customer orders
- `tokens` - Ramadan meal tokens
- `order_wallet_transactions` - Order-specific wallet changes (audit trail)
- **Responsibility**: Order management
- **Access Pattern**: Only accessed by order-gateway service (with cross-service messaging for kitchen-queue)

### 4. **inventory** - Stock Service

- `stock` - Item inventory with optimistic locking
- **Responsibility**: Stock management
- **Access Pattern**: Only accessed by stock-service and order-gateway for availability check

### 5. **kitchen** - Kitchen Queue Service

- _Reserved for future use_
- **Responsibility**: Kitchen preparation queue management

## Key Improvements

### ✅ Schema Isolation

- **Before**: All tables in public schema, mixed responsibilities
- **After**: Clear schema boundaries per service
- **Benefit**: Better microservice autonomy, easier to scale/version per service

### ✅ Wallet Performance Fix

- **Before**: `wallet_balances` was a regular VIEW (slow on millions of transactions)

  ```sql
  -- OLD: Expensive calculation every query
  CREATE VIEW wallet_balances AS
  SELECT s.student_id, s.name, SUM(...) as balance FROM students...
  ```

- **After**: Materialized VIEW using `wallet_balances_materialized` table

  ```sql
  -- NEW: Pre-calculated cache table (O(1) lookup)
  CREATE TABLE public.wallet_balances_materialized (
    student_id VARCHAR(20) PRIMARY KEY,
    balance DECIMAL(10,2),
    last_updated TIMESTAMP
  );
  ```

  - Fast lookups: `SELECT balance FROM wallet_balances_materialized WHERE student_id = $1`
  - Refreshed via `refresh_wallet_balances()` function
  - Automatically updated on new student registration

### ✅ Database Migrations

- **Before**: Single `init.sql` - no versioning, hard to track changes
- **After**: Timestamped migration files in `/database/migrations/`
  - `001-create-schemas.sql` - Schema definitions
  - `002-create-identity-tables.sql` - Identity tables
  - `003-create-public-tables.sql` - Shared tables
  - `004-create-inventory-tables.sql` - Stock tables
  - `005-create-orders-tables.sql` - Order tables
  - `006-create-functions-triggers.sql` - Functions and triggers
  - `007-seed-data.sql` - Initial data
  - **Benefit**: Easy to track DB changes, rollback-friendly, peer reviews possible

## Wallet Calculation Strategy

### Fast Path (Default)

```javascript
// DatabaseUtils.getWalletBalanceFast(studentId)
// Reads from materialized cache - O(1) lookup
const balance = await db.getWalletBalanceFast('230042135')
// Response time: ~1-2ms
```

### Accurate Path (Critical Operations)

```javascript
// DatabaseUtils.getWalletBalanceAccurate(studentId)
// Calculates from transactions table - O(n) scan
const balance = await db.getWalletBalanceAccurate('230042135')
// Response time: ~5-50ms depending on transaction count
```

### Refresh Materialized View

```javascript
// Manually refresh cache when needed
await db.refreshWalletBalances()
// Call during off-peak hours or after batch transactions
```

## Service Database Configuration

Each service should configure its connection and preferred schema:

### Identity Provider

```javascript
// Use identity schema
const result = await pool.query('SELECT * FROM identity.students WHERE email = $1', [email])
```

### Order Gateway

```javascript
// Primary: orders schema, reads from: public + inventory schemas
const result = await pool.query('SELECT * FROM orders.orders WHERE order_id = $1', [id])
const balance = await db.getWalletBalanceFast(studentId) // From public
```

### Stock Service

```javascript
// Use inventory schema
const result = await pool.query('SELECT * FROM inventory.stock WHERE item_id = $1', [id])
```

### Kitchen Queue

```javascript
// Listen to events from order-gateway
// Only reads from orders.orders when needed
```

## Migration Management

### Initialize Database

```bash
# Linux/Mac
./database/manage-migrations.sh init

# Windows
database\manage-migrations.bat init

# Or using psql directly
psql -h localhost -d cafeteria -U admin -f database/migrations/001-create-schemas.sql
```

### List Available Migrations

```bash
./database/manage-migrations.sh list
```

### Docker Integration

The Docker setup uses the new schema-based init:

```yaml
postgres:
  volumes:
    - ./database/init-microservices.sql:/docker-entrypoint-initdb.d/init.sql
```

## Creating New Migrations

When making schema changes:

1. Create a new migration file:

   ```bash
   # Naming: NNN-description.sql (000-999, sequential)
   touch database/migrations/008-add-new-table.sql
   ```

2. Write migration with UP and DOWN sections:

   ```sql
   -- Migration: Description
   -- Up migration
   BEGIN;
   -- Your changes here
   CREATE TABLE ...;
   COMMIT;

   -- Down migration
   -- DROP TABLE IF EXISTS ...;
   ```

3. Test the migration:

   ```bash
   ./database/manage-migrations.sh init
   ```

4. Commit to version control

## Performance Considerations

### Indexes

- All `student_id` fields are indexed for fast lookups
- Status and date fields indexed for filtering
- Idempotency key unique index to prevent duplicates

### Constraints

- Foreign key constraints to maintain referential integrity
- Check constraints for valid enum values
- Unique constraints for natural keys (student_id, order_id)

### Triggers

- Auto-update `updated_at` timestamps
- Auto-create wallet credit on student registration
- Auto-create dinner token on student registration
- Auto-mark token as used when order is READY

### Materialized View Refresh

Refresh strategies:

**Option 1: After Each Transaction**

```javascript
await db.createTransaction(...);
// Automatically updates materialized view in same transaction
```

**Option 2: Periodic Refresh (Scheduled)**

```javascript
// In a cron/scheduler every 5 minutes
setInterval(
  async () => {
    await db.refreshWalletBalances()
  },
  5 * 60 * 1000
)
```

**Option 3: Event-Driven**

```javascript
// On RabbitMQ message from order-gateway
rabbitmq.on('wallet.updated', async () => {
  await db.refreshWalletBalances()
})
```

## Troubleshooting

### Wallet Balance Mismatch

If materialized balance differs from calculated balance:

```bash
# Refresh the materialized view
psql -d cafeteria -c "SELECT refresh_wallet_balances();"

# Verify accuracy
SELECT student_id,
       (SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0)
        FROM public.transactions t WHERE t.student_id = s.student_id) as calculated,
       balance as materialized
FROM public.wallet_balances_materialized s;
```

### Migration Issues

If a migration fails:

1. Check postgres logs: `docker logs cafeteria-postgres-1`
2. Fix the migration file
3. Remove failed changes manually if needed
4. Re-run migrations

### Schema Access Issues

All services need proper schema search_path:

```javascript
// In service initialization
const pool = new Pool({
  host: DB_HOST,
  // ... other config
  // NOT needed: search_path is schema-qualified in queries
})
```

## Database Utilities

Use the provided `DatabaseUtils.js` in services:

```javascript
const DatabaseUtils = require('../database/DatabaseUtils')
const utils = new DatabaseUtils(pool)

// Wallet operations
const balance = await utils.getWalletBalanceFast(studentId)
await utils.createTransaction(studentId, 'credit', 100, 'Promotion')
const history = await utils.getTransactionHistory(studentId)

// Schema info
const schemas = await utils.getSchemaInfo()
console.log(schemas)
// {
//   identity: ['admins', 'students'],
//   public: ['menu_items', 'transactions', 'wallet_balances_materialized'],
//   orders: ['orders', 'tokens', 'order_wallet_transactions'],
//   inventory: ['stock']
// }
```

## Reference

- PostgreSQL: https://www.postgresql.org/docs/current/
- Schema Management: https://www.postgresql.org/docs/current/sql-createschema.html
- Triggers: https://www.postgresql.org/docs/current/plpgsql-trigger.html
- Materialized Views: https://www.postgresql.org/docs/current/rules-materializedviews.html
