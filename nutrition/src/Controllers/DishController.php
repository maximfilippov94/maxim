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

        $scope = trim((string)($req->query['scope'] ?? ''));   // '', 'mine', 'favorites'

        $sql = 'SELECT DISTINCT d.* FROM dishes d';
        $params = [];
        $where = ['(d.is_public = 1 OR d.created_by = ?)'];
        $params[] = $auth['id'];

        if ($tag !== '') {
            $sql .= ' JOIN dish_tags dt ON dt.dish_id = d.id';
            $where[] = 'dt.tag = ?';
            $params[] = $tag;
        }
        if ($scope === 'favorites') {
            $sql .= ' JOIN dish_favorites df ON df.dish_id = d.id AND df.specialist_id = ?';
            $params[] = $auth['id'];
        }
        if ($scope === 'mine') {
            $where[] = 'd.created_by = ?';
            $params[] = $auth['id'];
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

        // Множество избранных для отметки is_favorite (один запрос).
        $favs = array_column(
            Database::all('SELECT dish_id FROM dish_favorites WHERE specialist_id = ?', [$auth['id']]),
            'dish_id'
        );
        $favSet = array_flip(array_map('intval', $favs));

        foreach ($dishes as &$d) {
            $d['meal_types'] = $this->decodeJson($d['meal_types']);
            $d['tags'] = Repo::dishTags((int)$d['id']);
            $d['is_favorite'] = isset($favSet[(int)$d['id']]);
            $d['is_mine'] = ((int)($d['created_by'] ?? 0) === (int)$auth['id']);
        }
        return ['items' => $dishes, 'favorites_count' => count($favs)];
    }

    /** Добавить блюдо в избранное. */
    public function favorite(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        if (!Repo::dish($id)) {
            throw new HttpException('Блюдо не найдено', 404);
        }
        Database::exec(
            'INSERT OR IGNORE INTO dish_favorites (specialist_id, dish_id, created_at) VALUES (?, ?, ?)',
            [$auth['id'], $id, gmdate('c')]
        );
        return ['ok' => true, 'is_favorite' => true];
    }

    /** Убрать блюдо из избранного. */
    public function unfavorite(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        Database::exec(
            'DELETE FROM dish_favorites WHERE specialist_id = ? AND dish_id = ?',
            [$auth['id'], $id]
        );
        return ['ok' => true, 'is_favorite' => false];
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
        $dish['recipe_steps'] = $this->decodeJson($dish['recipe_steps']);
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
                'INSERT INTO dishes (name, meal_types, cook_minutes, instructions, recipe_steps, photo_url, is_public, created_by, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
                [
                    trim((string)$req->input('name')),
                    json_encode($req->input('meal_types', []), JSON_UNESCAPED_UNICODE),
                    $req->input('cook_minutes'),
                    $req->input('instructions'),
                    $this->encodeSteps($req->input('recipe_steps')),
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
            if (array_key_exists('recipe_steps', $req->body)) {
                $set[] = 'recipe_steps = ?';
                $params[] = $this->encodeSteps($req->input('recipe_steps'));
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

    /** Нормализует шаги рецепта в JSON-массив непустых строк. */
    private function encodeSteps(mixed $steps): ?string
    {
        if (!is_array($steps)) {
            return null;
        }
        $clean = array_values(array_filter(array_map(
            fn($s) => trim((string)$s),
            $steps
        ), fn($s) => $s !== ''));
        return $clean ? json_encode($clean, JSON_UNESCAPED_UNICODE) : null;
    }
}
