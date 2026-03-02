-- ============================================================
-- IUT Cafeteria Microservices - Database Schema with Microservice Isolation
-- DevSprint 2026
-- =======================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- CREATE SCHEMAS FOR MICROSERVICE ISOLATION
-- ============================================================
CREATE SCHEMA IF NOT EXISTS public;        -- Shared core data
CREATE SCHEMA IF NOT EXISTS identity;      -- Identity Provider service
CREATE SCHEMA IF NOT EXISTS orders;        -- Order Gateway service
CREATE SCHEMA IF NOT EXISTS inventory;     -- Stock Service
CREATE SCHEMA IF NOT EXISTS kitchen;       -- Kitchen Queue service

-- Drop existing tables for clean slate
DROP TABLE IF EXISTS orders.order_wallet_transactions CASCADE;
DROP TABLE IF EXISTS orders.tokens CASCADE;
DROP TABLE IF EXISTS orders.orders CASCADE;
DROP TABLE IF EXISTS inventory.stock CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.menu_items CASCADE;
DROP TABLE IF EXISTS identity.students CASCADE;
DROP TABLE IF EXISTS identity.admins CASCADE;
DROP TABLE IF EXISTS public.wallet_balances_materialized CASCADE;

-- ============================================================
-- IDENTITY SCHEMA - Identity Provider Service
-- ============================================================

-- ADMINS TABLE
-- System admins for monitoring dashboard
-- ============================================================
CREATE TABLE identity.admins (
                        id            SERIAL PRIMARY KEY,
                        username      VARCHAR(50)  UNIQUE NOT NULL,
                        email         VARCHAR(100) UNIQUE NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        full_name     VARCHAR(100) NOT NULL,
                        role          VARCHAR(20)  NOT NULL DEFAULT 'admin', -- 'admin' | 'superadmin'
                        is_active     BOOLEAN      NOT NULL DEFAULT true,
                        last_login_at TIMESTAMP,
                        created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admins_username ON identity.admins(username);
CREATE INDEX idx_admins_email    ON identity.admins(email);

-- STUDENTS TABLE
-- ============================================================
CREATE TABLE identity.students (
                          id              SERIAL PRIMARY KEY,
                          student_id      VARCHAR(20)  UNIQUE NOT NULL,
                          email           VARCHAR(100) UNIQUE NOT NULL,
                          password_hash   VARCHAR(255) NOT NULL,
                          name            VARCHAR(100) NOT NULL,
                          department      VARCHAR(10)  NOT NULL DEFAULT 'CSE',
                          year            SMALLINT     NOT NULL DEFAULT 1,
                          is_active       BOOLEAN      NOT NULL DEFAULT true,
                          created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                          updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_email      ON identity.students(email);
CREATE INDEX idx_students_student_id ON identity.students(student_id);

-- PUSH SUBSCRIPTIONS (Web Push notifications)
-- ============================================================
CREATE TABLE identity.push_subscriptions (
    student_id VARCHAR(20) NOT NULL REFERENCES identity.students(student_id) ON DELETE CASCADE,
    endpoint   TEXT        NOT NULL,
    p256dh     TEXT        NOT NULL,
    auth       TEXT        NOT NULL,
    created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, endpoint)
);

CREATE UNIQUE INDEX idx_push_subscriptions_endpoint ON identity.push_subscriptions(endpoint);

-- ============================================================
-- PUBLIC SCHEMA - Shared Core Data
-- ============================================================

-- MENU ITEMS TABLE
-- ============================================================
CREATE TABLE public.menu_items (
                            id           SERIAL PRIMARY KEY,
                            name         VARCHAR(100)  NOT NULL,
                            description  TEXT,
                            price        DECIMAL(10,2) NOT NULL,
                            category     VARCHAR(50)   NOT NULL DEFAULT 'main',
                            is_available BOOLEAN       NOT NULL DEFAULT true,
                            image_url    VARCHAR(255),
                            created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TRANSACTIONS TABLE (Wallet)
-- ============================================================
CREATE TABLE public.transactions (
                              id            SERIAL PRIMARY KEY,
                              student_id    VARCHAR(20)   NOT NULL,
                              type          VARCHAR(10)   NOT NULL CHECK (type IN ('credit', 'debit')),
                              amount        DECIMAL(10,2) NOT NULL CHECK (amount > 0),
                              balance_after DECIMAL(10,2) NOT NULL,
                              description   VARCHAR(255),
                              order_id      VARCHAR(50),
                              created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_student_id ON public.transactions(student_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);

-- EMERGENCY LOANS (advance from monthly allowance)
-- ============================================================
CREATE TABLE public.emergency_loans (
    id         SERIAL PRIMARY KEY,
    student_id VARCHAR(20)   NOT NULL,
    amount     DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    reason     VARCHAR(255),
    status     VARCHAR(20)   NOT NULL DEFAULT 'active',
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_emergency_loans_student_status ON public.emergency_loans(student_id, status);

-- ============================================================
-- INVENTORY SCHEMA - Stock Service
-- ============================================================

-- STOCK TABLE
-- ============================================================
CREATE TABLE inventory.stock (
    id         SERIAL PRIMARY KEY,
    item_id    INTEGER NOT NULL UNIQUE REFERENCES public.menu_items(id),
    quantity   INTEGER NOT NULL DEFAULT 0,
    version    INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_item_id ON inventory.stock(item_id);

-- ============================================================
-- ORDERS SCHEMA - Order Gateway Service
-- ============================================================

-- ORDERS TABLE
-- ============================================================
CREATE TABLE orders.orders (
    id              SERIAL PRIMARY KEY,
    order_id        VARCHAR(50) UNIQUE NOT NULL,
    student_id      VARCHAR(20) NOT NULL,
    item_id         INTEGER NOT NULL REFERENCES public.menu_items(id),
    type            VARCHAR(20) NOT NULL DEFAULT 'dinner',
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    amount          DECIMAL(10,2) NOT NULL,
    meal_date       DATE DEFAULT CURRENT_DATE,
    scheduled_pickup_time TIMESTAMP,
    qr_code         VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
    pickup_verified BOOLEAN NOT NULL DEFAULT false,
    completed_at    TIMESTAMP,
    idempotency_key VARCHAR(100) UNIQUE,
    acknowledged_at TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_student_id ON orders.orders(student_id);
CREATE INDEX idx_orders_status ON orders.orders(status);
CREATE INDEX idx_orders_idempotency ON orders.orders(idempotency_key);
CREATE INDEX idx_orders_qr_code ON orders.orders(qr_code);

-- REVIEWS
-- ============================================================
CREATE TABLE public.reviews (
    id         SERIAL PRIMARY KEY,
    order_id   VARCHAR(50) UNIQUE NOT NULL REFERENCES orders.orders(order_id) ON DELETE CASCADE,
    student_id VARCHAR(20) NOT NULL,
    item_id    INTEGER     NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    rating     SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT,
    created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_item_created ON public.reviews(item_id, created_at DESC);

-- TOKENS TABLE (Ramadan meal tokens)
-- ============================================================
CREATE TABLE orders.tokens (
    id         SERIAL PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    type       VARCHAR(20) NOT NULL DEFAULT 'dinner',
    meal_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    is_used    BOOLEAN NOT NULL DEFAULT false,
    order_id   VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, type, meal_date)
);

CREATE INDEX idx_tokens_student_id ON orders.tokens(student_id);
CREATE INDEX idx_tokens_meal_date ON orders.tokens(meal_date);

-- WALLET BALANCES MATERIALIZED VIEW (better performance than regular view)
-- This materializes the wallet calculation and will be refreshed periodically
-- ============================================================
CREATE TABLE public.wallet_balances_materialized (
    student_id       VARCHAR(20) PRIMARY KEY,
    name            VARCHAR(100),
    balance         DECIMAL(10,2),
    last_updated    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_balances_student_id ON public.wallet_balances_materialized(student_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON identity.students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at   BEFORE UPDATE ON orders.orders     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_updated_at    BEFORE UPDATE ON inventory.stock    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admins_updated_at   BEFORE UPDATE ON identity.admins    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Auto-insert ৳500 wallet credit on student registration
-- ============================================================
CREATE OR REPLACE FUNCTION on_student_registered_wallet()
    RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.transactions (student_id, type, amount, balance_after, description)
    VALUES (NEW.student_id, 'credit', 500.00, 500.00, 'Welcome bonus — initial wallet credit');

    -- Also update the materialized wallet balance
    INSERT INTO public.wallet_balances_materialized (student_id, name, balance, last_updated)
    VALUES (NEW.student_id, NEW.name, 500.00, CURRENT_TIMESTAMP)
    ON CONFLICT (student_id) DO UPDATE SET
        balance = 500.00,
        last_updated = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_student_wallet_credit
    AFTER INSERT ON identity.students
    FOR EACH ROW
EXECUTE FUNCTION on_student_registered_wallet();

-- ============================================================
-- TRIGGER: Auto-insert today's dinner token on student registration
-- ============================================================
CREATE OR REPLACE FUNCTION on_student_registered_token()
    RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO orders.tokens (student_id, type, meal_date, is_used)
    VALUES (NEW.student_id, 'dinner', CURRENT_DATE, false)
    ON CONFLICT (student_id, type, meal_date) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_student_dinner_token
    AFTER INSERT ON identity.students
    FOR EACH ROW
EXECUTE FUNCTION on_student_registered_token();

-- ============================================================
-- TRIGGER: Mark token as used when order status → READY
-- ============================================================
CREATE OR REPLACE FUNCTION on_order_ready_mark_token()
    RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'READY' AND OLD.status != 'READY' THEN
        UPDATE orders.tokens
        SET is_used = true, order_id = NEW.order_id
        WHERE student_id = NEW.student_id
          AND type = NEW.type
          AND meal_date = NEW.meal_date
          AND is_used = false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_ready_token
    AFTER UPDATE ON orders.orders
    FOR EACH ROW
EXECUTE FUNCTION on_order_ready_mark_token();

-- ============================================================
-- FUNCTION: Refresh materialized wallet balances (full recalculation)
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_wallet_balances()
    RETURNS void AS $$
BEGIN
    TRUNCATE public.wallet_balances_materialized;
    INSERT INTO public.wallet_balances_materialized (student_id, name, balance, last_updated)
    SELECT
        s.student_id,
        s.name,
        COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE -t.amount END), 0.00) AS balance,
        CURRENT_TIMESTAMP
    FROM identity.students s
    LEFT JOIN public.transactions t ON t.student_id = s.student_id
    GROUP BY s.student_id, s.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEW: Legacy wallet_balances for backward compatibility
-- ============================================================
CREATE OR REPLACE VIEW public.wallet_balances AS
SELECT student_id, name, balance
FROM public.wallet_balances_materialized;

-- ============================================================
-- TRIGGER: Auto-update materialized wallet balance on every transaction
-- Keeps wallet_balances_materialized in sync without full-table recalculation.
-- ============================================================
CREATE OR REPLACE FUNCTION on_transaction_update_wallet_balance()
    RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallet_balances_materialized (student_id, name, balance, last_updated)
    SELECT
        NEW.student_id,
        COALESCE(s.name, ''),
        NEW.balance_after,
        CURRENT_TIMESTAMP
    FROM identity.students s
    WHERE s.student_id = NEW.student_id
    ON CONFLICT (student_id) DO UPDATE SET
        balance = NEW.balance_after,
        last_updated = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transaction_wallet_sync
    AFTER INSERT ON public.transactions
    FOR EACH ROW
EXECUTE FUNCTION on_transaction_update_wallet_balance();

-- ============================================================
-- MENU SEED DATA
-- (Student + Admin passwords are seeded via seed.js - NOT here,
--  because bcrypt hashes must be generated at runtime)
-- ============================================================
INSERT INTO public.menu_items (name, description, price, category) VALUES
                                                                ('Biryani',       'Fragrant basmati rice with spiced chicken',  120.00, 'main'),
                                                                ('Haleem',        'Slow-cooked meat and lentil stew',            80.00, 'main'),
                                                                ('Jilapi',        'Crispy sweet fried dessert',                  30.00, 'snack'),
                                                                ('Iftar Special', 'Date, sharbat, beguni, chola, and rice',     100.00, 'iftar'),
                                                                ('Khichuri',      'Lentil and rice comfort meal',                60.00, 'main'),
                                                                ('Roti & Curry',  'Freshly baked roti with vegetable curry',     50.00, 'main');

INSERT INTO inventory.stock (item_id, quantity, version) VALUES
                                                   (1, 50, 0), (2, 30, 0), (3, 100, 0),
                                                   (4, 80, 0), (5, 40, 0), (6, 60, 0);

-- ============================================================
-- STUDENT SEED DATA
-- Password for all students: password123
-- ============================================================
INSERT INTO identity.students (student_id, email, password_hash, name, department, year) VALUES
    ('230042135', '230042135@iut-dhaka.edu', crypt('password123', gen_salt('bf')), 'Khadiza Sultana', 'CSE', 3),
    ('220041001', '220041001@iut-dhaka.edu', crypt('password123', gen_salt('bf')), 'Ahmed Hassan',    'CSE', 4),
    ('230041002', '230041002@iut-dhaka.edu', crypt('password123', gen_salt('bf')), 'Fatima Rahman',   'EEE', 3),
    ('240041003', '240041003@iut-dhaka.edu', crypt('password123', gen_salt('bf')), 'Omar Abdullah',   'ME',  2),
    ('210041004', '210041004@iut-dhaka.edu', crypt('password123', gen_salt('bf')), 'Nadia Islam',     'CSE', 4);

-- ============================================================
-- ADMIN SEED DATA
-- admin / admin123  |  iutcs / devsprint2026
-- ============================================================
INSERT INTO identity.admins (username, email, password_hash, full_name, role) VALUES
    ('admin', 'admin@iut-dhaka.edu', crypt('admin123', gen_salt('bf')),      'System Administrator', 'superadmin'),
    ('iutcs', 'cs@iut-dhaka.edu',    crypt('devsprint2026', gen_salt('bf')), 'CS Department Admin',  'admin');