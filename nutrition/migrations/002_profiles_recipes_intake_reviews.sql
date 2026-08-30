-- ==========================================================================
-- Миграция 002 — профили специалистов, пошаговые рецепты, анкета клиента,
-- отзывы/рейтинг (каталог). Совместимо с PostgreSQL.
-- ==========================================================================

-- ---------- Профиль нутрициолога (публичная страница + каталог) ----------
ALTER TABLE specialists ADD COLUMN bio TEXT;
ALTER TABLE specialists ADD COLUMN specialization TEXT;   -- напр. "Спортивное питание, ЖКТ"
ALTER TABLE specialists ADD COLUMN credentials TEXT;      -- образование, сертификаты
ALTER TABLE specialists ADD COLUMN photo_url TEXT;
ALTER TABLE specialists ADD COLUMN city TEXT;
ALTER TABLE specialists ADD COLUMN experience_years INTEGER;
ALTER TABLE specialists ADD COLUMN price_from INTEGER;    -- «от N ₽»
ALTER TABLE specialists ADD COLUMN slug TEXT;             -- ЧПУ для публичной страницы
ALTER TABLE specialists ADD COLUMN is_listed INTEGER DEFAULT 0;  -- согласие быть в каталоге

CREATE UNIQUE INDEX idx_specialists_slug ON specialists(slug);
CREATE INDEX idx_specialists_listed ON specialists(is_listed);

-- ---------- Пошаговые рецепты + фото у блюда ----------
-- recipe_steps: JSON-массив строк-шагов. instructions остаётся как fallback.
ALTER TABLE dishes ADD COLUMN recipe_steps TEXT;

-- ---------- Анкета клиента (само-заполнение при старте) ----------
ALTER TABLE clients ADD COLUMN allergies TEXT;            -- аллергии/непереносимости, текст
ALTER TABLE clients ADD COLUMN medical_flags TEXT;        -- JSON: ["pregnancy","diabetes",...]
ALTER TABLE clients ADD COLUMN dietary_prefs TEXT;        -- предпочтения (веган и т.п.), текст
ALTER TABLE clients ADD COLUMN intake_completed_at TEXT;  -- когда клиент прошёл анкету

-- ---------- Отзывы и рейтинг ----------
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  specialist_id INTEGER NOT NULL REFERENCES specialists(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  rating INTEGER NOT NULL,        -- 1..5
  body TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(specialist_id, client_id) -- один отзыв клиента на своего специалиста
);

CREATE INDEX idx_reviews_specialist ON reviews(specialist_id);
