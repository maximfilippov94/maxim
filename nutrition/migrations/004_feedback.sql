-- ==========================================================================
-- Миграция 004 — обратная связь тестировщиков MVP.
-- ==========================================================================

CREATE TABLE feedback (
  id INTEGER PRIMARY KEY,
  user_type TEXT,                -- specialist | client | admin | anon
  user_id INTEGER,
  user_name TEXT,
  liked TEXT,                    -- что понравилось
  unclear TEXT,                  -- что было непонятно
  suggest TEXT,                  -- что бы изменили
  missing TEXT,                  -- чего не хватает
  rating INTEGER,                -- 1..5
  page TEXT,                     -- с какого экрана оставлен
  created_at TEXT NOT NULL
);

CREATE INDEX idx_feedback_created ON feedback(created_at);
