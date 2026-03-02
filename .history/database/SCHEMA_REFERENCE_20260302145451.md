# Database Schema Reference & Query Guide

## Quick Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Microservices DB                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📋 IDENTITY SCHEMA (Identity Provider)                         │
│  ├─ admins                                                       │
│  └─ students                                                     │
│                                                                   │
│  📦 PUBLIC SCHEMA (Shared core data)                            │
│  ├─ menu_items                                                  │
│  ├─ transactions (wallet transactions)                          │
│  └─ wallet_balances_materialized (cached balances)             │
│                                                                  │
│  🛒 ORDERS SCHEMA (Order Gateway)                              │
│  ├─ orders (customer orders)                                   │
│  ├─ tokens (Ramadan meal tokens)                               │
│  └─ order_wallet_transactions (order audit log)                │
│                                                                  │
│  📦 INVENTORY SCHEMA (Stock Service)                           │
│  └─ stock (item inventory with optimistic locking)             │
│                                                                  │
│  👨‍🍳 KITCHEN SCHEMA (Kitchen Queue) - Reserved                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Service Database Access Matrix

| Service | Read | Write | Schema Focus |
|---------|------|-------|----------------|
| **identity-provider** | students, admins | students, admins, last_login_at | identity |
| **order-gateway** | orders, tokens, menu_items, transactions, wallet_balances | orders, tokens, transactions | public, orders |
| **stock-service** | stock, menu_items | stock (quantity, version) | inventory |
| **kitchen-queue** | orders | orders (status) | orders |
| **notification-hub** | (async events only) | - | - |

## Identity Schema

### students table
```sql
-- Read student by email
SELECT id, student_id, name, email, is_active 
FROM identity.students 
WHERE email = 'student@iut-dhaka.edu';

-- Create new student
INSERT INTO identity.students (student_id, email, password_hash, name, department, year)
VALUES ('230042135', '230042135@iut-dhaka.edu', '$2a$10...', 'Khadiza Sultana', 'CSE', 3);

-- Check if student exists
SELECT 1 FROM identity.students 
WHERE email = $1 OR student_id = $2 
LIMIT 1;
```

**Auto-triggers:**
- Creates ৳500 welcome credit in public.transactions
- Creates dinner token in orders.tokens for today

### admins table
```sql
-- Authenticate admin
SELECT id, username, password_hash, role, is_active
FROM identity.admins
WHERE username = $1;

-- Update last login
UPDATE identity.admins 
SET last_login_at = NOW() 
WHERE id = $1;
```

## Public Schema (Shared)

### menu_items table
```sql
-- Get all available menu items
SELECT id, name, price, category, is_available, image_url
FROM public.menu_items
WHERE is_available = true
ORDER BY category;

-- Get item with stock info
SELECT m.id, m.name, m.price, s.quantity
FROM public.menu_items m
LEFT JOIN inventory.stock s ON s.item_id = m.id
WHERE m.id = $1;

-- Seed menu items
INSERT INTO public.menu_items (name, description, price, category)
VALUES ('Biryani', 'Fragrant basmati rice...', 120.00, 'main')
ON CONFLICT DO NOTHING;
```

### transactions table (Authoritative wallet source)
```sql
-- Get wallet balance (slow but accurate)
SELECT COALESCE(SUM(CASE 
    WHEN type='credit' THEN amount 
    ELSE -amount 
END), 0) AS balance
FROM public.transactions
WHERE student_id = '230042135';

-- Insert transaction
INSERT INTO public.transactions 
(student_id, type, amount, balance_after, description, order_id)
VALUES ('230042135', 'debit', 120.00, 1880.00, 'Meal: Biryani', 'ORD-123');

-- Get transaction history
SELECT type, amount, balance_after, description, created_at
FROM public.transactions
WHERE student_id = '230042135'
ORDER BY created_at DESC
LIMIT 50;
```

### wallet_balances_materialized table (Fast cache)
```sql
-- Get wallet balance (fast!)
SELECT student_id, name, balance
FROM public.wallet_balances_materialized
WHERE student_id = '230042135';

-- Get all students with balance
SELECT student_id, name, balance, last_updated
FROM public.wallet_balances_materialized
ORDER BY balance DESC;

-- Refresh all balances (run periodically)
SELECT refresh_wallet_balances();
```

### wallet_balances VIEW (Legacy)
```sql
-- For backward compatibility, this view reads from materialized table
SELECT * FROM public.wallet_balances 
WHERE student_id = '230042135';
```

## Orders Schema

### orders table
```sql
-- Get single order
SELECT id, order_id, student_id, item_id, status, amount, created_at
FROM orders.orders
WHERE order_id = $1 AND student_id = $2;

-- Create order
INSERT INTO orders.orders 
(order_id, idempotency_key, student_id, item_id, type, status, amount)
VALUES ('ORD-12345', 'IDEMPKEY-' || uuid_generate_v4(), '230042135', 1, 'dinner', 'PENDING', 120.00);

-- Get orders by status
SELECT order_id, status, amount, created_at
FROM orders.orders
WHERE student_id = $1 AND status != 'FAILED'
ORDER BY created_at DESC;

-- Get orders by date
SELECT order_id, item_id, type, status
FROM orders.orders
WHERE meal_date = CURRENT_DATE
AND status IN ('PENDING', 'READY')
ORDER BY created_at;

-- Update order status
UPDATE orders.orders 
SET status = 'READY', updated_at = NOW()
WHERE order_id = $1;
```

**Idempotency:**
- Unique constraint on `idempotency_key` prevents duplicate orders
- Use same key for retries = automatic deduplication

### tokens table (Meal tokens)
```sql
-- Get available tokens
SELECT id, type, meal_date, is_used
FROM orders.tokens
WHERE student_id = $1 
AND meal_date >= CURRENT_DATE
AND is_used = false
ORDER BY meal_date;

-- Create tokens
INSERT INTO orders.tokens (student_id, type, meal_date, is_used)
VALUES ('230042135', 'dinner', CURRENT_DATE + 1, false)
ON CONFLICT (student_id, type, meal_date) DO NOTHING;

-- Mark token as used
UPDATE orders.tokens
SET is_used = true, order_id = $1
WHERE student_id = $2 
AND type = $3 
AND meal_date = $4;
```

**Triggers:**
- `trigger_student_dinner_token`: Auto-creates dinner token on registration
- `trigger_order_ready_token`: Auto-marks token as used when order status → READY

## Inventory Schema

### stock table (Optimistic locking)
```sql
-- Get current stock
SELECT id, item_id, quantity, version, updated_at
FROM inventory.stock
WHERE item_id = $1;

-- Optimistic locking decrement (race condition safe)
UPDATE inventory.stock
SET quantity = quantity - 1, 
    version = version + 1,
    updated_at = NOW()
WHERE item_id = $1 
  AND version = $2              -- Prevents race conditions
  AND quantity > 0;

-- Batch get stock
SELECT s.item_id, s.quantity, m.name
FROM inventory.stock s
JOIN public.menu_items m ON m.id = s.item_id
ORDER BY s.item_id;

-- Initialize stock for new menu item
INSERT INTO inventory.stock (item_id, quantity, version)
VALUES (7, 100, 0);
```

**Optimistic Locking Pattern:**
```
Read -> Modify -> Write
1. Read current quantity + version
2. Calculate new quantity
3. UPDATE ... WHERE version = expected_version
4. If UPDATE returns 0 rows → version changed → RETRY
```

## Common Patterns

### Create Order (Multi-table transaction)
```javascript
const client = await pool.connect();
try {
    await client.query('BEGIN');
    
    // 1. Verify student wallet
    const balance = await client.query(
        'SELECT COALESCE(SUM(...), 0) FROM public.transactions WHERE student_id = $1',
        [studentId]
    );
    
    // 2. Check item availability
    const item = await client.query(
        'SELECT * FROM public.menu_items WHERE id = $1 AND is_available = true',
        [itemId]
    );
    
    // 3. Create order
    const order = await client.query(
        'INSERT INTO orders.orders (...) VALUES (...) RETURNING *',
        [...]
    );
    
    // 4. Debit wallet
    await client.query(
        'INSERT INTO public.transactions (...) VALUES (...)',
        [studentId, 'debit', item.price, ...]
    );
    
    // 5. Update materialized wallet
    await client.query(
        `INSERT INTO public.wallet_balances_materialized (...)
         SELECT ... FROM identity.students
         ON CONFLICT (student_id) DO UPDATE SET balance = ...`,
        [studentId, newBalance]
    );
    
    await client.query('COMMIT');
    return order;
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    client.release();
}
```

### Decrement Stock (With versioning)
```javascript
let retries = 0;
const MAX_RETRIES = 3;

while (retries < MAX_RETRIES) {
    try {
        // Get current version
        const current = await pool.query(
            'SELECT quantity, version FROM inventory.stock WHERE item_id = $1',
            [itemId]
        );
        
        // Attempt atomic update with version check
        const result = await pool.query(
            `UPDATE inventory.stock 
             SET quantity = quantity - 1, version = version + 1
             WHERE item_id = $1 AND version = $2`,
            [itemId, current.rows[0].version]
        );
        
        if (result.rowCount === 0) {
            // Version changed, someone else decremented
            retries++;
            continue;
        }
        
        return result; // Success
    } catch (error) {
        throw error;
    }
}

throw new Error('Stock decrement failed after retries');
```

### Get Wallet Balance (With caching strategy)
```javascript
// 1. Try fast cache first
const cached = await db.getWalletBalanceFast(studentId);
if (cached && Date.now() - cached.last_updated < 60000) {
    return cached.balance; // <2ms
}

// 2. Calculate accurate balance
const accurate = await db.getWalletBalanceAccurate(studentId);

// 3. Update cache
await db.refreshWalletBalances();

return accurate;
```

## Performance Tips

### ✅ DO
- Use `wallet_balances_materialized` for UI displays
- Use `student_id` in WHERE clauses (all indexed)
- Use `status` for filtering orders (indexed)
- Batch select with `inventory.stock` 
- Use materialized view for reports

### ❌ DON'T
- Calculate wallet from transactions in loops
- Join across too many tables unnecessarily
- Use LIKE without % prefix (can't use indexes)
- Calculate wallet on every order check
- Leave connections open during long operations

## Index Reference

All indexes are automatically created by migrations:

```
identity.admins: idx_identity_admins_username, idx_identity_admins_email
identity.students: idx_identity_students_email, idx_identity_students_student_id
public.menu_items: (no indexes needed - few rows)
public.transactions: idx_public_transactions_student_id, idx_public_transactions_created_at
public.wallet_balances_materialized: idx_public_wallet_balances_student_id
inventory.stock: idx_inventory_stock_item_id (plus UNIQUE on item_id)
orders.orders: idx_orders_orders_student_id, idx_orders_orders_status, idx_orders_orders_meal_date, idx_orders_orders_order_id
orders.tokens: idx_orders_tokens_student_id, idx_orders_tokens_meal_date
orders.order_wallet_transactions: idx_orders_order_wallet_student_id, idx_orders_order_wallet_created_at
```

## Emergency Queries

```sql
-- Clear all data (development only!)
TRUNCATE identity.admins, identity.students, public.menu_items, 
         public.transactions, public.wallet_balances_materialized,
         inventory.stock, orders.orders, orders.tokens CASCADE;

-- Check schema status
SELECT schema_name, owner FROM information_schema.schemata 
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pgagent')
ORDER BY schema_name;

-- See all tables by schema
SELECT schemaname, tablename FROM pg_tables 
WHERE schemaname IN ('identity', 'public', 'orders', 'inventory')
ORDER BY schemaname, tablename;

-- Query size by schema
SELECT schemaname, pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint) AS size
FROM pg_tables 
WHERE schemaname IN ('identity', 'public', 'orders', 'inventory')
GROUP BY schemaname 
ORDER BY size DESC;

-- Find slow queries
SELECT query, calls, mean_time, max_time 
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

**Last Updated**: March 2, 2026  
**Microservices Database Schema v2.0**  
**All services updated to compliance**
