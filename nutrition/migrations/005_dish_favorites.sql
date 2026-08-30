-- Избранные блюда специалиста: быстрый доступ к часто используемым блюдам.
CREATE TABLE dish_favorites (
  specialist_id INTEGER NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (specialist_id, dish_id)
);

CREATE INDEX idx_dish_favorites_spec ON dish_favorites(specialist_id);
