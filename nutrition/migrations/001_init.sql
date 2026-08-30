-- ==========================================================================
-- Миграция 001 — исходная схема БД сервиса-конструктора меню.
-- Весь SQL совместим с PostgreSQL: без SQLite-специфичных функций,
-- чтобы миграция на PG прошла безболезненно.
-- ==========================================================================

-- ========== ПОЛЬЗОВАТЕЛИ ==========

CREATE TABLE specialists (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  plan TEXT DEFAULT 'trial',        -- trial | active | expired
  plan_expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE clients (
  id INTEGER PRIMARY KEY,
  specialist_id INTEGER NOT NULL REFERENCES specialists(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  password_hash TEXT,               -- заполняется при первом входе по инвайту
  invite_token TEXT UNIQUE,
  sex TEXT,                         -- m | f
  birth_year INTEGER,
  height_cm INTEGER,
  weight_kg REAL,
  activity_level TEXT,              -- low | medium | high
  goal TEXT,                        -- цель словами, свободный текст
  target_kcal INTEGER,              -- целевые значения задаёт специалист
  target_protein REAL,
  target_fat REAL,
  target_carbs REAL,
  excluded_ingredients TEXT,        -- JSON: id ингредиентов, которые не показывать
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_clients_specialist ON clients(specialist_id);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_type TEXT NOT NULL,          -- specialist | client
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_type, user_id);

-- ========== БАЗА ПРОДУКТОВ И БЛЮД ==========

-- КБЖУ всегда на 100 г продукта. Одна точка правды.
CREATE TABLE ingredients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,                    -- мясо, крупы, овощи, молочное...
  kcal REAL NOT NULL,
  protein REAL NOT NULL,
  fat REAL NOT NULL,
  carbs REAL NOT NULL,
  fiber REAL DEFAULT 0,
  -- коэффициент потерь/набора массы при варке (рис 1.0 -> 2.5)
  cooked_ratio REAL DEFAULT 1.0,
  is_public INTEGER DEFAULT 1,
  created_by INTEGER REFERENCES specialists(id),  -- NULL = общая база
  created_at TEXT NOT NULL
);

CREATE INDEX idx_ingredients_name ON ingredients(name);
CREATE INDEX idx_ingredients_category ON ingredients(category);

CREATE TABLE dishes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  meal_types TEXT,                  -- JSON: ["breakfast","dinner"]
  cook_minutes INTEGER,
  instructions TEXT,
  photo_url TEXT,
  base_portion_g REAL,              -- считается из состава, кэш
  -- кэш КБЖУ на 100 г готового блюда, пересчитывается при правке состава
  kcal_100 REAL, protein_100 REAL, fat_100 REAL, carbs_100 REAL,
  is_public INTEGER DEFAULT 1,
  created_by INTEGER REFERENCES specialists(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_dishes_name ON dishes(name);

CREATE TABLE dish_ingredients (
  id INTEGER PRIMARY KEY,
  dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  grams REAL NOT NULL,              -- в сыром виде
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_dish_ingredients_dish ON dish_ingredients(dish_id);

CREATE TABLE dish_tags (
  dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,                -- веган, безлактозный, быстро, бюджетно
  PRIMARY KEY (dish_id, tag)
);

-- ========== МЕНЮ ==========

CREATE TABLE menus (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  specialist_id INTEGER NOT NULL REFERENCES specialists(id),
  title TEXT,
  start_date TEXT NOT NULL,
  days_count INTEGER NOT NULL DEFAULT 7,
  status TEXT DEFAULT 'draft',      -- draft | published
  published_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_menus_client ON menus(client_id);
CREATE INDEX idx_menus_specialist ON menus(specialist_id);

CREATE TABLE menu_items (
  id INTEGER PRIMARY KEY,
  menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,      -- 1..days_count
  meal_type TEXT NOT NULL,          -- breakfast|snack1|lunch|snack2|dinner
  dish_id INTEGER NOT NULL REFERENCES dishes(id),
  portion_g REAL NOT NULL,          -- ИТОГОВАЯ граммовка порции
  -- переопределение отдельных ингредиентов:
  -- {"ingredient_id": grams} — если специалист правит состав точечно
  overrides TEXT,
  comment TEXT,                     -- заметка клиенту к конкретному блюду
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_menu_items_menu_day ON menu_items(menu_id, day_number);

-- ========== ОБРАТНАЯ СВЯЗЬ ==========

CREATE TABLE meal_logs (
  id INTEGER PRIMARY KEY,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  status TEXT NOT NULL,             -- eaten | skipped | replaced
  comment TEXT,
  logged_at TEXT NOT NULL,
  UNIQUE(menu_item_id)
);

CREATE INDEX idx_meal_logs_client ON meal_logs(client_id);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  author_type TEXT NOT NULL,        -- specialist | client
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_messages_client ON messages(client_id);

CREATE TABLE weight_logs (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  weight_kg REAL NOT NULL,
  measured_on TEXT NOT NULL,
  UNIQUE(client_id, measured_on)
);

CREATE INDEX idx_weight_logs_client ON weight_logs(client_id);
