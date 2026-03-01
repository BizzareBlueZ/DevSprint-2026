-- ============================================================
-- IUT Cafeteria Microservices - Database Schema
-- DevSprint 2026
-- ============================================================

DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS tokens CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

-- ============================================================
-- ADMINS TABLE
-- System admins for monitoring dashboard
-- ============================================================
CREATE TABLE admins (
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

CREATE INDEX idx_admins_username ON admins(username);
CREATE INDEX idx_admins_email    ON admins(email);

-- ============================================================
-- STUDENTS TABLE
-- ============================================================
CREATE TABLE students (
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

CREATE INDEX idx_students_email      ON students(email);
CREATE INDEX idx_students_student_id ON students(student_id);

-- ============================================================
-- MENU ITEMS TABLE
-- ============================================================
CREATE TABLE menu_items (
                            id           SERIAL PRIMARY KEY,
                            name         VARCHAR(100)  NOT NULL,
                            description  TEXT,
                            price        DECIMAL(10,2) NOT NULL,
                            category     VARCHAR(50)   NOT NULL DEFAULT 'main',
                            is_available BOOLEAN       NOT NULL DEFAULT true,
                            image_url    VARCHAR(255),
                            created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STOCK TABLE (optimistic locking)
-- ============================================================
CREATE TABLE stock (
                       id         SERIAL PRIMARY KEY,
                       item_id    INTEGER   NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
                       quantity   INTEGER   NOT NULL DEFAULT 0 CHECK (quantity >= 0),
                       version    INTEGER   NOT NULL DEFAULT 0,
                       updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                       UNIQUE (item_id)
);

CREATE INDEX idx_stock_item_id ON stock(item_id);

-- ============================================================
-- ORDERS TABLE
-- ============================================================
CREATE TABLE orders (
                        id              SERIAL PRIMARY KEY,
                        order_id        VARCHAR(50)   UNIQUE NOT NULL,
                        student_id      VARCHAR(20)   NOT NULL REFERENCES students(student_id),
                        item_id         INTEGER       NOT NULL REFERENCES menu_items(id),
                        type            VARCHAR(20)   NOT NULL DEFAULT 'dinner',
                        status          VARCHAR(30)   NOT NULL DEFAULT 'PENDING',
                        amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
                        notes           TEXT,
                        meal_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
                        acknowledged_at TIMESTAMP,
                        completed_at    TIMESTAMP,
                        created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_student_id ON orders(student_id);
CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_orders_meal_date  ON orders(meal_date);
CREATE INDEX idx_orders_order_id   ON orders(order_id);

-- ============================================================
-- TOKENS TABLE (Ramadan)
-- ============================================================
CREATE TABLE tokens (
                        id         SERIAL PRIMARY KEY,
                        student_id VARCHAR(20) NOT NULL REFERENCES students(student_id),
                        type       VARCHAR(20) NOT NULL,
                        meal_date  DATE        NOT NULL,
                        is_used    BOOLEAN     NOT NULL DEFAULT false,
                        order_id   VARCHAR(50),
                        created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (student_id, type, meal_date)
);

CREATE INDEX idx_tokens_student_id ON tokens(student_id);
CREATE INDEX idx_tokens_meal_date  ON tokens(meal_date);

-- ============================================================
-- TRANSACTIONS TABLE (Wallet)
-- ============================================================
CREATE TABLE transactions (
                              id            SERIAL PRIMARY KEY,
                              student_id    VARCHAR(20)   NOT NULL REFERENCES students(student_id),
                              type          VARCHAR(10)   NOT NULL CHECK (type IN ('credit', 'debit')),
                              amount        DECIMAL(10,2) NOT NULL CHECK (amount > 0),
                              balance_after DECIMAL(10,2) NOT NULL,
                              description   VARCHAR(255),
                              order_id      VARCHAR(50),
                              created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_student_id ON transactions(student_id);

-- ============================================================
-- WALLET VIEW
-- ============================================================
CREATE VIEW wallet_balances AS
SELECT
    s.student_id,
    s.name,
    COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE -t.amount END), 0.00) AS balance
FROM students s
         LEFT JOIN transactions t ON t.student_id = s.student_id
GROUP BY s.student_id, s.name;

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_updated_at    BEFORE UPDATE ON stock    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admins_updated_at   BEFORE UPDATE ON admins   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Auto-insert ৳500 wallet credit on student registration
-- ============================================================
CREATE OR REPLACE FUNCTION on_student_registered_wallet()
    RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO transactions (student_id, type, amount, balance_after, description)
    VALUES (NEW.student_id, 'credit', 500.00, 500.00, 'Welcome bonus — initial wallet credit');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_student_wallet_credit
    AFTER INSERT ON students
    FOR EACH ROW
EXECUTE FUNCTION on_student_registered_wallet();

-- ============================================================
-- TRIGGER: Auto-insert today's dinner token on student registration
-- ============================================================
CREATE OR REPLACE FUNCTION on_student_registered_token()
    RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tokens (student_id, type, meal_date, is_used)
    VALUES (NEW.student_id, 'dinner', CURRENT_DATE, false)
    ON CONFLICT (student_id, type, meal_date) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_student_dinner_token
    AFTER INSERT ON students
    FOR EACH ROW
EXECUTE FUNCTION on_student_registered_token();

-- ============================================================
-- TRIGGER: Mark token as used when order status → READY
-- ============================================================
CREATE OR REPLACE FUNCTION on_order_ready_mark_token()
    RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'READY' AND OLD.status != 'READY' THEN
        UPDATE tokens
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
    AFTER UPDATE ON orders
    FOR EACH ROW
EXECUTE FUNCTION on_order_ready_mark_token();

-- ============================================================
-- MENU SEED DATA
-- (Student + Admin passwords are seeded via seed.js - NOT here,
--  because bcrypt hashes must be generated at runtime)
-- ============================================================
INSERT INTO menu_items (name, description, price, category) VALUES
                                                                ('Biryani',       'Fragrant basmati rice with spiced chicken',  120.00, 'main'),
                                                                ('Haleem',        'Slow-cooked meat and lentil stew',            80.00, 'main'),
                                                                ('Jilapi',        'Crispy sweet fried dessert',                  30.00, 'snack'),
                                                                ('Iftar Special', 'Date, sharbat, beguni, chola, and rice',     100.00, 'iftar'),
                                                                ('Khichuri',      'Lentil and rice comfort meal',                60.00, 'main'),
                                                                ('Roti & Curry',  'Freshly baked roti with vegetable curry',     50.00, 'main');

INSERT INTO stock (item_id, quantity, version) VALUES
                                                   (1, 50, 0), (2, 30, 0), (3, 100, 0),
                                                   (4, 80, 0), (5, 40, 0), (6, 60, 0);

-- ============================================================
-- NOTE: Run `node seed.js` inside identity-provider/ after
-- the database is up to create student and admin accounts.
-- ============================================================