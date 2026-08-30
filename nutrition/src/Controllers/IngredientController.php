<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Request;

class IngredientController extends Controller
{
    /** Список/поиск ингредиентов. Видны общие (created_by IS NULL) + свои. */
    public function index(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $search = trim((string)($req->query['q'] ?? ''));
        $category = trim((string)($req->query['category'] ?? ''));
        $limit = min(200, max(1, (int)($req->query['limit'] ?? 100)));

        $sql = 'SELECT * FROM ingredients WHERE (is_public = 1 OR created_by = ?)';
        $params = [$auth['id']];

        if ($search !== '') {
            $sql .= ' AND name LIKE ?';
            $params[] = '%' . $search . '%';
        }
        if ($category !== '') {
            $sql .= ' AND category = ?';
            $params[] = $category;
        }
        $sql .= ' ORDER BY name LIMIT ' . $limit;

        return ['items' => Database::all($sql, $params)];
    }

    public function categories(Request $req): array
    {
        Auth::require($req, 'specialist');
        $rows = Database::all(
            "SELECT DISTINCT category FROM ingredients WHERE category IS NOT NULL AND category != '' ORDER BY category"
        );
        return ['categories' => array_column($rows, 'category')];
    }

    public function show(Request $req, array $args): array
    {
        Auth::require($req, 'specialist');
        $ing = Database::one('SELECT * FROM ingredients WHERE id = ?', [(int)$args['id']]);
        if (!$ing) {
            throw new HttpException('Ингредиент не найден', 404);
        }
        return $ing;
    }

    public function create(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $this->require($req->body, ['name', 'kcal', 'protein', 'fat', 'carbs']);

        $id = Database::insert(
            'INSERT INTO ingredients (name, category, kcal, protein, fat, carbs, fiber, cooked_ratio, is_public, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
            [
                trim((string)$req->input('name')),
                $req->input('category'),
                $this->num($req->input('kcal')),
                $this->num($req->input('protein')),
                $this->num($req->input('fat')),
                $this->num($req->input('carbs')),
                $this->num($req->input('fiber')),
                $this->num($req->input('cooked_ratio', 1.0), 1.0),
                $auth['id'],
                $this->now(),
            ]
        );
        return Database::one('SELECT * FROM ingredients WHERE id = ?', [$id]);
    }

    public function update(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        $ing = Database::one('SELECT * FROM ingredients WHERE id = ?', [$id]);
        if (!$ing) {
            throw new HttpException('Ингредиент не найден', 404);
        }
        // Общую базу правит только владелец; чужие пользовательские — нельзя.
        if ($ing['created_by'] !== null && (int)$ing['created_by'] !== $auth['id']) {
            throw new HttpException('Нельзя редактировать чужой ингредиент', 403);
        }
        if ($ing['created_by'] === null) {
            throw new HttpException('Общую базу редактировать нельзя', 403);
        }

        $fields = ['name', 'category', 'kcal', 'protein', 'fat', 'carbs', 'fiber', 'cooked_ratio'];
        $set = [];
        $params = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $req->body)) {
                $set[] = "$f = ?";
                $params[] = in_array($f, ['name', 'category'], true)
                    ? $req->input($f)
                    : $this->num($req->input($f));
            }
        }
        if ($set) {
            $params[] = $id;
            Database::exec('UPDATE ingredients SET ' . implode(', ', $set) . ' WHERE id = ?', $params);
        }
        return Database::one('SELECT * FROM ingredients WHERE id = ?', [$id]);
    }

    public function delete(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        $ing = Database::one('SELECT * FROM ingredients WHERE id = ?', [$id]);
        if (!$ing) {
            throw new HttpException('Ингредиент не найден', 404);
        }
        if ($ing['created_by'] === null || (int)$ing['created_by'] !== $auth['id']) {
            throw new HttpException('Можно удалять только свои ингредиенты', 403);
        }
        $used = Database::one('SELECT id FROM dish_ingredients WHERE ingredient_id = ? LIMIT 1', [$id]);
        if ($used) {
            throw new HttpException('Ингредиент используется в блюдах', 409);
        }
        Database::exec('DELETE FROM ingredients WHERE id = ?', [$id]);
        return ['ok' => true];
    }
}
