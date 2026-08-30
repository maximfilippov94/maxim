<?php
declare(strict_types=1);

/**
 * Наполнение общей базы: php bin/seed.php
 * Идемпотентно — повторный запуск не плодит дубликаты (сверяет по имени).
 * Общая база: created_by = NULL, is_public = 1.
 */

$root = dirname(__DIR__);
require_once $root . '/src/Database.php';
require_once $root . '/src/Repo.php';
require_once $root . '/src/Services/NutritionCalculator.php';

$config = require $root . '/config.php';

use App\Database;
use App\Repo;

Database::init($config['db_path']);
$now = gmdate('c');

// ---------- Ингредиенты ----------
$ingredients = require $root . '/seeds/ingredients.php';
$ingredientIds = [];
$newIng = 0;

foreach ($ingredients as $ing) {
    [$name, $category, $kcal, $protein, $fat, $carbs, $fiber, $ratio] = $ing;
    $existing = Database::one('SELECT id FROM ingredients WHERE name = ? AND created_by IS NULL', [$name]);
    if ($existing) {
        $ingredientIds[$name] = (int)$existing['id'];
        continue;
    }
    $id = Database::insert(
        'INSERT INTO ingredients (name, category, kcal, protein, fat, carbs, fiber, cooked_ratio, is_public, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?)',
        [$name, $category, $kcal, $protein, $fat, $carbs, $fiber, $ratio, $now]
    );
    $ingredientIds[$name] = $id;
    $newIng++;
}
echo "Ингредиентов добавлено: $newIng (всего в наборе: " . count($ingredients) . ")\n";

// ---------- Блюда ----------
$dishes = require $root . '/seeds/dishes.php';
$newDish = 0;

foreach ($dishes as $dish) {
    $existing = Database::one('SELECT id FROM dishes WHERE name = ? AND created_by IS NULL', [$dish['name']]);
    if ($existing) {
        // Пересчитаем кэш на случай изменения справочника КБЖУ.
        Repo::recomputeDishCache((int)$existing['id']);
        continue;
    }

    Database::transaction(function () use ($dish, $ingredientIds, $now) {
        $dishId = Database::insert(
            'INSERT INTO dishes (name, meal_types, cook_minutes, instructions, is_public, created_by, created_at)
             VALUES (?, ?, ?, ?, 1, NULL, ?)',
            [
                $dish['name'],
                json_encode($dish['meal_types'], JSON_UNESCAPED_UNICODE),
                $dish['cook_minutes'] ?? null,
                $dish['instructions'] ?? null,
                $now,
            ]
        );

        $sort = 0;
        foreach ($dish['ingredients'] as $ingName => $grams) {
            if (!isset($ingredientIds[$ingName])) {
                throw new RuntimeException("Ингредиент '$ingName' не найден для блюда '{$dish['name']}'");
            }
            Database::insert(
                'INSERT INTO dish_ingredients (dish_id, ingredient_id, grams, sort_order) VALUES (?, ?, ?, ?)',
                [$dishId, $ingredientIds[$ingName], $grams, $sort++]
            );
        }
        foreach ($dish['tags'] ?? [] as $tag) {
            Database::exec('INSERT OR IGNORE INTO dish_tags (dish_id, tag) VALUES (?, ?)', [$dishId, $tag]);
        }
        Repo::recomputeDishCache($dishId);
    });
    $newDish++;
}
echo "Блюд добавлено: $newDish (всего в наборе: " . count($dishes) . ")\n";
echo "Готово.\n";
