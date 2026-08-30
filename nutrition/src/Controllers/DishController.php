<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Repo;
use App\Request;
use App\Services\NutritionCalculator;

class DishController extends Controller
{
    /** Список/поиск блюд с фильтрами по типу приёма и тегам. */
    public function index(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $search = trim((string)($req->query['q'] ?? ''));
        $mealType = trim((string)($req->query['meal_type'] ?? ''));
        $tag = trim((string)($req->query['tag'] ?? ''));
        $limit = min(200, max(1, (int)($req->query['limit'] ?? 100)));

        $sql = 'SELECT DISTINCT d.* FROM dishes d';
        $params = [];
        $where = ['(d.is_public = 1 OR d.created_by = ?)'];
        $params[] = $auth['id'];

        if ($tag !== '') {
            $sql .= ' JOIN dish_tags dt ON dt.dish_id = d.id';
            $where[] = 'dt.tag = ?';
            $params[] = $tag;
        }
        if ($search !== '') {
            $where[] = 'd.name LIKE ?';
            $params[] = '%' . $search . '%';
        }
        if ($mealType !== '') {
            // meal_types хранится как JSON-массив строк
            $where[] = 'd.meal_types LIKE ?';
            $params[] = '%"' . $mealType . '"%';
        }

        $sql .= ' WHERE ' . implode(' AND ', $where) . ' ORDER BY d.name LIMIT ' . $limit;
        $dishes = Database::all($sql, $params);

        foreach ($dishes as &$d) {
            $d['meal_types'] = $this->decodeJson($d['meal_types']);
            $d['tags'] = Repo::dishTags((int)$d['id']);
        }
        return ['items' => $dishes];
    }

    public function show(Request $req, array $args): array
    {
        Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        $dish = Repo::dish($id);
        if (!$dish) {
            throw new HttpException('Блюдо не найдено', 404);
        }
        $dish['meal_types'] = $this->decodeJson($dish['meal_types']);
        $dish['tags'] = Repo::dishTags($id);
        $dish['ingredients'] = Repo::dishComposition($id);
        $dish['nutrition'] = NutritionCalculator::dishCache($dish['ingredients']);
        return $dish;
    }

    public function create(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $this->require($req->body, ['name']);

        return Database::transaction(function () use ($req, $auth) {
            $id = Database::insert(
                'INSERT INTO dishes (name, meal_types, cook_minutes, instructions, photo_url, is_public, created_by, created_at)
                 VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
                [
                    trim((string)$req->input('name')),
                    json_encode($req->input('meal_types', []), JSON_UNESCAPED_UNICODE),
                    $req->input('cook_minutes'),
                    $req->input('instructions'),
                    $req->input('photo_url'),
                    $auth['id'],
                    $this->now(),
                ]
            );
            $this->saveIngredients($id, $req->input('ingredients', []));
            $this->saveTags($id, $req->input('tags', []));
            Repo::recomputeDishCache($id);
            return $this->show($req, ['id' => $id]);
        });
    }

    public function update(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        $dish = Repo::dish($id);
        if (!$dish) {
            throw new HttpException('Блюдо не найдено', 404);
        }
        if ($dish['created_by'] === null) {
            throw new HttpException('Общую базу блюд редактировать нельзя', 403);
        }
        if ((int)$dish['created_by'] !== $auth['id']) {
            throw new HttpException('Нельзя редактировать чужое блюдо', 403);
        }

        return Database::transaction(function () use ($req, $args, $id) {
            $map = [
                'name' => 'name', 'cook_minutes' => 'cook_minutes',
                'instructions' => 'instructions', 'photo_url' => 'photo_url',
            ];
            $set = [];
            $params = [];
            foreach ($map as $key => $col) {
                if (array_key_exists($key, $req->body)) {
                    $set[] = "$col = ?";
                    $params[] = $req->input($key);
                }
            }
            if (array_key_exists('meal_types', $req->body)) {
                $set[] = 'meal_types = ?';
                $params[] = json_encode($req->input('meal_types', []), JSON_UNESCAPED_UNICODE);
            }
            if ($set) {
                $params[] = $id;
                Database::exec('UPDATE dishes SET ' . implode(', ', $set) . ' WHERE id = ?', $params);
            }

            if (array_key_exists('ingredients', $req->body)) {
                Database::exec('DELETE FROM dish_ingredients WHERE dish_id = ?', [$id]);
                $this->saveIngredients($id, $req->input('ingredients', []));
            }
            if (array_key_exists('tags', $req->body)) {
                Database::exec('DELETE FROM dish_tags WHERE dish_id = ?', [$id]);
                $this->saveTags($id, $req->input('tags', []));
            }
            Repo::recomputeDishCache($id);
            return $this->show($req, ['id' => $id]);
        });
    }

    public function delete(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        $dish = Repo::dish($id);
        if (!$dish) {
            throw new HttpException('Блюдо не найдено', 404);
        }
        if ($dish['created_by'] === null || (int)$dish['created_by'] !== $auth['id']) {
            throw new HttpException('Можно удалять только свои блюда', 403);
        }
        $used = Database::one('SELECT id FROM menu_items WHERE dish_id = ? LIMIT 1', [$id]);
        if ($used) {
            throw new HttpException('Блюдо используется в меню', 409);
        }
        Database::exec('DELETE FROM dishes WHERE id = ?', [$id]);
        return ['ok' => true];
    }

    // ---------- helpers ----------

    private function saveIngredients(int $dishId, array $ingredients): void
    {
        $sort = 0;
        foreach ($ingredients as $item) {
            $iid = (int)($item['ingredient_id'] ?? 0);
            $grams = $this->num($item['grams'] ?? 0);
            if ($iid <= 0 || $grams <= 0) {
                continue;
            }
            $exists = Database::one('SELECT id FROM ingredients WHERE id = ?', [$iid]);
            if (!$exists) {
                throw new HttpException("Ингредиент {$iid} не найден", 422);
            }
            Database::insert(
                'INSERT INTO dish_ingredients (dish_id, ingredient_id, grams, sort_order) VALUES (?, ?, ?, ?)',
                [$dishId, $iid, $grams, $item['sort_order'] ?? $sort++]
            );
        }
    }

    private function saveTags(int $dishId, array $tags): void
    {
        foreach (array_unique(array_filter(array_map('strval', $tags))) as $tag) {
            Database::exec(
                'INSERT OR IGNORE INTO dish_tags (dish_id, tag) VALUES (?, ?)',
                [$dishId, trim($tag)]
            );
        }
    }

    private function decodeJson(?string $json): array
    {
        $v = json_decode((string)$json, true);
        return is_array($v) ? $v : [];
    }
}
