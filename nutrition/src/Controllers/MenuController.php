<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Repo;
use App\Request;
use App\Services\NutritionCalculator;

class MenuController extends Controller
{
    public function index(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $clientId = (int)($req->query['client_id'] ?? 0);

        if ($clientId > 0) {
            Repo::clientOwnedBy($clientId, $auth['id']);
            $menus = Database::all(
                'SELECT * FROM menus WHERE client_id = ? AND specialist_id = ? ORDER BY created_at DESC',
                [$clientId, $auth['id']]
            );
        } else {
            $menus = Database::all(
                'SELECT * FROM menus WHERE specialist_id = ? ORDER BY created_at DESC',
                [$auth['id']]
            );
        }
        return ['items' => $menus];
    }

    public function create(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $this->require($req->body, ['client_id', 'start_date']);
        $clientId = (int)$req->input('client_id');
        Repo::clientOwnedBy($clientId, $auth['id']);

        $daysCount = max(1, min(31, (int)$req->input('days_count', 7)));
        $id = Database::insert(
            'INSERT INTO menus (client_id, specialist_id, title, start_date, days_count, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                $clientId,
                $auth['id'],
                $req->input('title'),
                (string)$req->input('start_date'),
                $daysCount,
                'draft',
                $this->now(),
            ]
        );
        return $this->show($req, ['id' => $id]);
    }

    /** Полное меню с рассчитанным КБЖУ по каждому пункту и итогами дня. */
    public function show(Request $req, array $args): array
    {
        $auth = Auth::require($req);
        $menuId = (int)$args['id'];
        $menu = Repo::menuFor($menuId, $auth);

        // Клиент видит только опубликованные меню.
        if ($auth['type'] === 'client' && $menu['status'] !== 'published') {
            throw new HttpException('Меню ещё не опубликовано', 403);
        }

        $client = Database::one('SELECT * FROM clients WHERE id = ?', [(int)$menu['client_id']]);
        $targets = [
            'target_kcal'    => $client['target_kcal'] ?? null,
            'target_protein' => $client['target_protein'] ?? null,
            'target_fat'     => $client['target_fat'] ?? null,
            'target_carbs'   => $client['target_carbs'] ?? null,
        ];

        $items = Database::all(
            'SELECT * FROM menu_items WHERE menu_id = ? ORDER BY day_number, sort_order, id',
            [$menuId]
        );

        // Кэш составов блюд, чтобы не дёргать БД по кругу.
        $compositionCache = [];
        $dishCache = [];

        // meal_logs (для клиента и статистики соблюдения)
        $logs = [];
        foreach (Database::all(
            'SELECT ml.* FROM meal_logs ml
             JOIN menu_items mi ON mi.id = ml.menu_item_id
             WHERE mi.menu_id = ?', [$menuId]
        ) as $log) {
            $logs[(int)$log['menu_item_id']] = $log;
        }

        $days = [];
        $mealOrder = $GLOBALS['config']['meal_types'];

        for ($d = 1; $d <= (int)$menu['days_count']; $d++) {
            $days[$d] = ['day_number' => $d, 'meals' => [], 'item_nutritions' => []];
        }

        foreach ($items as $item) {
            $dishId = (int)$item['dish_id'];
            if (!isset($dishCache[$dishId])) {
                $dishCache[$dishId] = Repo::dish($dishId);
                $compositionCache[$dishId] = Repo::dishComposition($dishId);
            }
            $dish = $dishCache[$dishId];
            $composition = $compositionCache[$dishId];
            $overrides = $this->decodeJson($item['overrides']);

            $nutrition = NutritionCalculator::menuItem(
                $dish ?? [],
                $composition,
                (float)$item['portion_g'],
                $overrides ?: null
            );

            $d = (int)$item['day_number'];
            if (!isset($days[$d])) {
                $days[$d] = ['day_number' => $d, 'meals' => [], 'item_nutritions' => []];
            }
            $log = $logs[(int)$item['id']] ?? null;

            $days[$d]['meals'][] = [
                'id'         => (int)$item['id'],
                'meal_type'  => $item['meal_type'],
                'dish_id'    => $dishId,
                'dish_name'  => $dish['name'] ?? '—',
                'photo_url'  => $dish['photo_url'] ?? null,
                'portion_g'  => (float)$item['portion_g'],
                'overrides'  => $overrides,
                'comment'    => $item['comment'],
                'sort_order' => (int)$item['sort_order'],
                'nutrition'  => $nutrition,
                'log'        => $log ? ['status' => $log['status'], 'comment' => $log['comment'], 'logged_at' => $log['logged_at']] : null,
            ];
            $days[$d]['item_nutritions'][] = $nutrition;
        }

        // Итоги дня + отклонение + сортировка приёмов пищи.
        $daysOut = [];
        foreach ($days as $d => $day) {
            usort($day['meals'], function ($a, $b) use ($mealOrder) {
                $ia = array_search($a['meal_type'], $mealOrder, true);
                $ib = array_search($b['meal_type'], $mealOrder, true);
                $ia = $ia === false ? 99 : $ia;
                $ib = $ib === false ? 99 : $ib;
                return $ia <=> $ib ?: ($a['sort_order'] <=> $b['sort_order']);
            });
            $totals = NutritionCalculator::dayTotals($day['item_nutritions'], $targets);
            $daysOut[] = [
                'day_number' => $d,
                'meals'      => $day['meals'],
                'totals'     => $totals['totals'],
                'deviation'  => $totals['deviation'],
            ];
        }

        return [
            'menu' => [
                'id'           => (int)$menu['id'],
                'client_id'    => (int)$menu['client_id'],
                'title'        => $menu['title'],
                'start_date'   => $menu['start_date'],
                'days_count'   => (int)$menu['days_count'],
                'status'       => $menu['status'],
                'published_at' => $menu['published_at'],
            ],
            'targets' => $targets,
            'days'    => $daysOut,
        ];
    }

    public function update(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $menu = Repo::menuFor((int)$args['id'], $auth);

        $set = [];
        $params = [];
        if (array_key_exists('title', $req->body)) {
            $set[] = 'title = ?';
            $params[] = $req->input('title');
        }
        if (array_key_exists('start_date', $req->body)) {
            $set[] = 'start_date = ?';
            $params[] = (string)$req->input('start_date');
        }
        if (array_key_exists('days_count', $req->body)) {
            $newCount = max(1, min(31, (int)$req->input('days_count')));
            $set[] = 'days_count = ?';
            $params[] = $newCount;
            // Обрезаем пункты за пределами нового диапазона.
            Database::exec('DELETE FROM menu_items WHERE menu_id = ? AND day_number > ?', [(int)$menu['id'], $newCount]);
        }
        if ($set) {
            $params[] = (int)$menu['id'];
            Database::exec('UPDATE menus SET ' . implode(', ', $set) . ' WHERE id = ?', $params);
        }
        return $this->show($req, ['id' => (int)$menu['id']]);
    }

    public function publish(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $menu = Repo::menuFor((int)$args['id'], $auth);
        $status = $req->input('status', 'published') === 'draft' ? 'draft' : 'published';

        Database::exec(
            'UPDATE menus SET status = ?, published_at = ? WHERE id = ?',
            [$status, $status === 'published' ? $this->now() : null, (int)$menu['id']]
        );
        return $this->show($req, ['id' => (int)$menu['id']]);
    }

    public function delete(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $menu = Repo::menuFor((int)$args['id'], $auth);
        Database::exec('DELETE FROM menus WHERE id = ?', [(int)$menu['id']]);
        return ['ok' => true];
    }

    // ---------- Пункты меню ----------

    public function addItem(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $menu = Repo::menuFor((int)$args['id'], $auth);
        $this->require($req->body, ['day_number', 'meal_type', 'dish_id']);

        $this->inList($req->input('meal_type'), $GLOBALS['config']['meal_types'], 'meal_type');
        $day = (int)$req->input('day_number');
        if ($day < 1 || $day > (int)$menu['days_count']) {
            throw new HttpException('day_number вне диапазона меню', 422);
        }

        $dish = Repo::dish((int)$req->input('dish_id'));
        if (!$dish) {
            throw new HttpException('Блюдо не найдено', 404);
        }

        // По умолчанию порция = базовому весу блюда.
        $portion = $req->input('portion_g') !== null
            ? $this->num($req->input('portion_g'))
            : (float)($dish['base_portion_g'] ?? 0);
        if ($portion <= 0) {
            $portion = 100.0;
        }

        $maxSort = (int)(Database::one(
            'SELECT COALESCE(MAX(sort_order), -1) s FROM menu_items WHERE menu_id = ? AND day_number = ? AND meal_type = ?',
            [(int)$menu['id'], $day, $req->input('meal_type')]
        )['s'] ?? -1);

        $overrides = $req->input('overrides');
        $id = Database::insert(
            'INSERT INTO menu_items (menu_id, day_number, meal_type, dish_id, portion_g, overrides, comment, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                (int)$menu['id'], $day, $req->input('meal_type'), (int)$dish['id'],
                $portion,
                $overrides ? json_encode($overrides, JSON_UNESCAPED_UNICODE) : null,
                $req->input('comment'),
                $maxSort + 1,
            ]
        );
        return ['item_id' => $id] + $this->show($req, ['id' => (int)$menu['id']]);
    }

    public function updateItem(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $menu = Repo::menuFor((int)$args['id'], $auth);
        $item = $this->itemInMenu((int)$args['item_id'], (int)$menu['id']);

        $set = [];
        $params = [];
        if (array_key_exists('portion_g', $req->body)) {
            $set[] = 'portion_g = ?';
            $params[] = $this->num($req->input('portion_g'));
        }
        if (array_key_exists('comment', $req->body)) {
            $set[] = 'comment = ?';
            $params[] = $req->input('comment');
        }
        if (array_key_exists('meal_type', $req->body)) {
            $this->inList($req->input('meal_type'), $GLOBALS['config']['meal_types'], 'meal_type');
            $set[] = 'meal_type = ?';
            $params[] = $req->input('meal_type');
        }
        if (array_key_exists('overrides', $req->body)) {
            $ov = $req->input('overrides');
            $set[] = 'overrides = ?';
            $params[] = $ov ? json_encode($ov, JSON_UNESCAPED_UNICODE) : null;
        }
        if ($set) {
            $params[] = (int)$item['id'];
            Database::exec('UPDATE menu_items SET ' . implode(', ', $set) . ' WHERE id = ?', $params);
        }
        return $this->show($req, ['id' => (int)$menu['id']]);
    }

    public function deleteItem(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $menu = Repo::menuFor((int)$args['id'], $auth);
        $item = $this->itemInMenu((int)$args['item_id'], (int)$menu['id']);
        Database::exec('DELETE FROM menu_items WHERE id = ?', [(int)$item['id']]);
        return $this->show($req, ['id' => (int)$menu['id']]);
    }

    // ---------- Копирование ----------

    /** Скопировать все пункты одного дня в другой (перезаписав целевой день). */
    public function copyDay(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $menu = Repo::menuFor((int)$args['id'], $auth);
        $this->require($req->body, ['from_day', 'to_day']);
        $from = (int)$req->input('from_day');
        $to = (int)$req->input('to_day');

        if ($to < 1 || $to > (int)$menu['days_count'] || $from < 1 || $from > (int)$menu['days_count']) {
            throw new HttpException('День вне диапазона меню', 422);
        }
        if ($from === $to) {
            throw new HttpException('Дни совпадают', 422);
        }

        Database::transaction(function () use ($menu, $from, $to) {
            Database::exec('DELETE FROM menu_items WHERE menu_id = ? AND day_number = ?', [(int)$menu['id'], $to]);
            $src = Database::all(
                'SELECT * FROM menu_items WHERE menu_id = ? AND day_number = ? ORDER BY sort_order, id',
                [(int)$menu['id'], $from]
            );
            foreach ($src as $it) {
                Database::insert(
                    'INSERT INTO menu_items (menu_id, day_number, meal_type, dish_id, portion_g, overrides, comment, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [(int)$menu['id'], $to, $it['meal_type'], $it['dish_id'], $it['portion_g'], $it['overrides'], $it['comment'], $it['sort_order']]
                );
            }
        });
        return $this->show($req, ['id' => (int)$menu['id']]);
    }

    /** Дублировать всё меню (например, на следующую неделю). Возвращает новое меню. */
    public function duplicate(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $menu = Repo::menuFor((int)$args['id'], $auth);

        $newId = Database::transaction(function () use ($menu, $req) {
            $startDate = $req->input('start_date') ?: $this->nextWeek((string)$menu['start_date']);
            $newId = Database::insert(
                'INSERT INTO menus (client_id, specialist_id, title, start_date, days_count, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    (int)$menu['client_id'], (int)$menu['specialist_id'],
                    $req->input('title') ?: ((string)($menu['title'] ?? 'Меню') . ' (копия)'),
                    $startDate, (int)$menu['days_count'], 'draft', $this->now(),
                ]
            );
            $src = Database::all('SELECT * FROM menu_items WHERE menu_id = ? ORDER BY day_number, sort_order, id', [(int)$menu['id']]);
            foreach ($src as $it) {
                Database::insert(
                    'INSERT INTO menu_items (menu_id, day_number, meal_type, dish_id, portion_g, overrides, comment, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [$newId, $it['day_number'], $it['meal_type'], $it['dish_id'], $it['portion_g'], $it['overrides'], $it['comment'], $it['sort_order']]
                );
            }
            return $newId;
        });
        return $this->show($req, ['id' => $newId]);
    }

    // ---------- helpers ----------

    private function itemInMenu(int $itemId, int $menuId): array
    {
        $item = Database::one('SELECT * FROM menu_items WHERE id = ? AND menu_id = ?', [$itemId, $menuId]);
        if (!$item) {
            throw new HttpException('Пункт меню не найден', 404);
        }
        return $item;
    }

    private function nextWeek(string $date): string
    {
        $ts = strtotime($date);
        return $ts ? date('Y-m-d', $ts + 7 * 86400) : $date;
    }

    private function decodeJson(?string $json): array
    {
        $v = json_decode((string)$json, true);
        return is_array($v) ? $v : [];
    }
}
