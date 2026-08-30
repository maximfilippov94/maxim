-- ==========================================================================
-- Миграция 003 — админ-панель владельца: администраторы, тарифы, платежи,
-- поддержка, модерация. Совместимо с PostgreSQL.
-- ==========================================================================

-- ---------- Администраторы платформы ----------
CREATE TABLE admins (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',   -- owner | admin | support | content
  created_at TEXT NOT NULL
);

-- ---------- Тарифы ----------
CREATE TABLE plans (
  code TEXT PRIMARY KEY,                 -- trial | pro | business | enterprise
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,      -- в валюте, целые единицы (€)
  period TEXT NOT NULL DEFAULT 'month',  -- month | year | trial
  client_limit INTEGER,                  -- NULL = без лимита
  dish_limit INTEGER,
  features TEXT,                         -- JSON-массив строк
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- ---------- Платежи ----------
CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  specialist_id INTEGER NOT NULL REFERENCES specialists(id),
  plan_code TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL,                  -- paid | pending | failed | refunded | cancelled
  method TEXT,                           -- card | invoice | ...
  external_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_payments_specialist ON payments(specialist_id);
CREATE INDEX idx_payments_created ON payments(created_at);
CREATE INDEX idx_payments_status ON payments(status);

-- ---------- Обращения в поддержку ----------
CREATE TABLE support_tickets (
  id INTEGER PRIMARY KEY,
  user_type TEXT NOT NULL,               -- specialist | client
  user_id INTEGER NOT NULL,
  user_name TEXT,                        -- денормализация для списка
  subject TEXT NOT NULL,
  channel TEXT DEFAULT 'email',          -- email | chat | phone
  priority TEXT DEFAULT 'normal',        -- low | normal | high
  status TEXT DEFAULT 'new',             -- new | in_progress | waiting | resolved
  assigned_to INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_tickets_status ON support_tickets(status);

CREATE TABLE support_messages (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL,             -- admin | user
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ---------- Модерация ----------
ALTER TABLE dishes ADD COLUMN status TEXT DEFAULT 'published';   -- published | pending | rejected | draft
ALTER TABLE reviews ADD COLUMN status TEXT DEFAULT 'published';  -- published | hidden

-- ---------- Признаки для админ-таблиц ----------
ALTER TABLE specialists ADD COLUMN blocked_at TEXT;
ALTER TABLE specialists ADD COLUMN last_active_at TEXT;
ALTER TABLE clients ADD COLUMN last_active_at TEXT;
ALTER TABLE specialists ADD COLUMN verified INTEGER DEFAULT 0;   -- verified profile в каталоге
ALTER TABLE specialists ADD COLUMN featured INTEGER DEFAULT 0;   -- featured в каталоге
