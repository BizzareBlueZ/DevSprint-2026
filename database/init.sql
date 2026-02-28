-- ============================================================
-- IUT Cafeteria Microservices - Database Schema
-- DevSprint 2026
-- ============================================================

-- Drop existing tables (order matters for FK constraints)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS tokens CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- ============================================================
-- STUDENTS TABLE
-- Mirrors IUT student database structure
-- Email format: <studentId>@iut-dhaka.edu
-- ============================================================
CREATE TABLE students (
    id              SERIAL PRIMARY KEY,
    student_id      VARCHAR(20)  UNIQUE NOT NULL,   -- e.g. 230042135
    email           VARCHAR(100) UNIQUE NOT NULL,   -- e.g. 230042135@iut-dhaka.edu
    password_hash   VARCHAR(255) NOT NULL,           -- bcrypt hashed
    name            VARCHAR(100) NOT NULL,
    department      VARCHAR(10)  NOT NULL DEFAULT 'CSE',
    year            SMALLINT     NOT NULL DEFAULT 1, -- 1..4
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_email      ON students(email);
CREATE INDEX idx_students_student_id ON students(student_id);

-- ============================================================
-- MENU ITEMS TABLE
-- Items available in the cafeteria
-- ============================================================
CREATE TABLE menu_items (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100)   NOT NULL,
    description TEXT,
    price       DECIMAL(10,2)  NOT NULL,
    category    VARCHAR(50)    NOT NULL DEFAULT 'main',   -- 'main' | 'iftar' | 'snack'
    is_available BOOLEAN       NOT NULL DEFAULT true,
    image_url   VARCHAR(255),
    created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STOCK TABLE
-- Source of truth for inventory with optimistic locking
-- ============================================================
CREATE TABLE stock (
    id          SERIAL PRIMARY KEY,
    item_id     INTEGER        NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    quantity    INTEGER        NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    version     INTEGER        NOT NULL DEFAULT 0,         -- optimistic locking version
    updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (item_id)
);

CREATE INDEX idx_stock_item_id ON stock(item_id);

-- ============================================================
-- ORDERS TABLE
-- All student meal orders with idempotency support
-- ============================================================
CREATE TABLE orders (
    id              SERIAL PRIMARY KEY,
    order_id        VARCHAR(50)  UNIQUE NOT NULL,   -- UUID - for idempotency
    student_id      VARCHAR(20)  NOT NULL REFERENCES students(student_id),
    item_id         INTEGER      NOT NULL REFERENCES menu_items(id),
    type            VARCHAR(20)  NOT NULL DEFAULT 'dinner', -- 'dinner' | 'iftar' | 'emergency'
    status          VARCHAR(30)  NOT NULL DEFAULT 'PENDING',
    -- PENDING → STOCK_VERIFIED → IN_KITCHEN → READY | FAILED
    amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes           TEXT,
    meal_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
    acknowledged_at TIMESTAMP,   -- when gateway confirmed to student (<2s requirement)
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_student_id ON orders(student_id);
CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_orders_meal_date  ON orders(meal_date);
CREATE INDEX idx_orders_order_id   ON orders(order_id);

-- ============================================================
-- TOKENS TABLE
-- Pre-purchased meal tokens (Ramadan feature)
-- ============================================================
CREATE TABLE tokens (
    id          SERIAL PRIMARY KEY,
    student_id  VARCHAR(20)  NOT NULL REFERENCES students(student_id),
    type        VARCHAR(20)  NOT NULL,   -- 'dinner' | 'iftar'
    meal_date   DATE         NOT NULL,
    is_used     BOOLEAN      NOT NULL DEFAULT false,
    order_id    VARCHAR(50),             -- linked order
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, type, meal_date)   -- one token per student per type per day
);

CREATE INDEX idx_tokens_student_id ON tokens(student_id);
CREATE INDEX idx_tokens_meal_date  ON tokens(meal_date);

-- ============================================================
-- TRANSACTIONS TABLE (Wallet)
-- SmartCard balance ledger
-- ============================================================
CREATE TABLE transactions (
    id          SERIAL PRIMARY KEY,
    student_id  VARCHAR(20)  NOT NULL REFERENCES students(student_id),
    type        VARCHAR(10)  NOT NULL CHECK (type IN ('credit', 'debit')),
    amount      DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    balance_after DECIMAL(10,2) NOT NULL,
    description VARCHAR(255),
    order_id    VARCHAR(50),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_student_id ON transactions(student_id);

-- ============================================================
-- WALLET VIEW (computed balance per student)
-- ============================================================
CREATE VIEW wallet_balances AS
SELECT
    s.student_id,
    s.name,
    COALESCE(
        SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE -t.amount END),
        0.00
    ) AS balance
FROM students s
LEFT JOIN transactions t ON t.student_id = s.student_id
GROUP BY s.student_id, s.name;

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_students_updated_at    BEFORE UPDATE ON students    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at      BEFORE UPDATE ON orders      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_updated_at       BEFORE UPDATE ON stock       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Menu items
INSERT INTO menu_items (name, description, price, category) VALUES
    ('Biryani',       'Fragrant basmati rice with spiced chicken',  120.00, 'main'),
    ('Haleem',        'Slow-cooked meat and lentil stew',            80.00, 'main'),
    ('Jilapi',        'Crispy sweet fried dessert',                  30.00, 'snack'),
    ('Iftar Special', 'Date, sharbat, beguni, chola, and rice',     100.00, 'iftar'),
    ('Khichuri',      'Lentil and rice comfort meal',                60.00, 'main'),
    ('Roti & Curry',  'Freshly baked roti with vegetable curry',     50.00, 'main');

-- Initial stock (linked to menu items by id 1-6)
INSERT INTO stock (item_id, quantity, version) VALUES
    (1, 50, 0),   -- Biryani
    (2, 30, 0),   -- Haleem
    (3, 100, 0),  -- Jilapi
    (4, 80, 0),   -- Iftar Special
    (5, 40, 0),   -- Khichuri
    (6, 60, 0);   -- Roti & Curry

-- Seed student accounts (passwords: 'password123' hashed with bcrypt rounds=10)
-- In production, students register through IUT's existing auth system
-- The hash below is bcrypt of 'password123'
INSERT INTO students (student_id, email, password_hash, name, department, year) VALUES
    ('230042135', '230042135@iut-dhaka.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Khadiza Sultana',  'CSE', 3),
    ('220041001', '220041001@iut-dhaka.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ahmed Hassan',     'CSE', 4),
    ('230041002', '230041002@iut-dhaka.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Fatima Rahman',    'EEE', 3),
    ('240041003', '240041003@iut-dhaka.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Omar Abdullah',    'ME',  2),
    ('210041004', '210041004@iut-dhaka.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Nadia Islam',      'CSE', 4);

-- Seed wallet credits for test students
INSERT INTO transactions (student_id, type, amount, balance_after, description) VALUES
    ('230042135', 'credit', 500.00, 500.00, 'Initial wallet top-up'),
    ('220041001', 'credit', 300.00, 300.00, 'Initial wallet top-up'),
    ('230041002', 'credit', 250.00, 250.00, 'Initial wallet top-up'),
    ('240041003', 'credit', 400.00, 400.00, 'Initial wallet top-up'),
    ('210041004', 'credit', 350.00, 350.00, 'Initial wallet top-up');

-- ============================================================
-- NOTE: Default test password for ALL seed students is:
-- password123
-- Email: <studentId>@iut-dhaka.edu
-- ============================================================
