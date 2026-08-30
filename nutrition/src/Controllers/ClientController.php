<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Repo;
use App\Request;

class ClientController extends Controller
{
    private const SEX = ['m', 'f'];
    private const ACTIVITY = ['low', 'medium', 'high'];

    /** Список клиентов специалиста: имя, цель, статус меню, непрочитанные. */
    public function index(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $search = trim((string)($req->query['q'] ?? ''));

        $sql = 'SELECT * FROM clients WHERE specialist_id = ?';
        $params = [$auth['id']];
        if ($search !== '') {
            $sql .= ' AND name LIKE ?';
            $params[] = '%' . $search . '%';
        }
        $sql .= ' ORDER BY created_at DESC';
        $clients = Database::all($sql, $params);

        foreach ($clients as &$c) {
            unset($c['password_hash']);
            $c['excluded_ingredients'] = $this->decodeJson($c['excluded_ingredients']);
            $c = array_merge($c, $this->clientSignals((int)$c['id']));
            $c['has_password'] = false; // не раскрываем хэш, но флаг полезен фронту
        }
        return ['items' => $clients];
    }

    /**
     * Лёгкие вычисляемые сигналы клиента для Главной, списка клиентов и движка
     * «Требуют внимания». Все данные берутся из существующих таблиц, без новых
     * сущностей. Возвращает статус меню, вес и его динамику, соблюдение и список
     * причин внимания (простые правила — без AI).
     */
    private function clientSignals(int $clientId): array
    {
        $today = new \DateTimeImmutable('today');
        $out = [
            'unread_messages' => 0,
            'menu_status' => null,
            'menu_end_days' => null,
            'last_weight_kg' => null,
            'last_weight_on' => null,
            'weight_delta' => null,
            'weight_days_ago' => null,
            'meal_days_ago' => null,
            'compliance_pct' => null,
            'attention' => [],
        ];

        $out['unread_messages'] = (int)(Database::one(
            "SELECT COUNT(*) n FROM messages WHERE client_id = ? AND author_type = 'client' AND read_at IS NULL",
            [$clientId]
        )['n'] ?? 0);

        $lastMsg = Database::one(
            'SELECT body, author_type, created_at FROM messages WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
            [$clientId]
        );
        $out['last_message'] = $lastMsg['body'] ?? null;
        $out['last_message_author'] = $lastMsg['author_type'] ?? null;
        $out['last_message_at'] = $lastMsg['created_at'] ?? null;

        // Активное меню (опубликованное — приоритетно, иначе последнее).
        $menu = Database::one(
            "SELECT id, status, start_date, days_count FROM menus WHERE client_id = ?
             ORDER BY (status = 'published') DESC, created_at DESC LIMIT 1",
            [$clientId]
        );
        $out['menu_status'] = $menu['status'] ?? null;
        if ($menu && $menu['status'] === 'published' && !empty($menu['start_date'])) {
            try {
                $end = (new \DateTimeImmutable($menu['start_date']))
                    ->modify('+' . ((int)$menu['days_count'] - 1) . ' days');
                $out['menu_end_days'] = (int)$today->diff($end)->format('%r%a');
            } catch (\Throwable $e) {}
        }

        // Вес: последний и предыдущий замеры.
        $weights = Database::all(
            'SELECT weight_kg, measured_on FROM weight_logs WHERE client_id = ?
             ORDER BY measured_on DESC LIMIT 2',
            [$clientId]
        );
        if ($weights) {
            $out['last_weight_kg'] = (float)$weights[0]['weight_kg'];
            $out['last_weight_on'] = $weights[0]['measured_on'];
            try {
                $on = new \DateTimeImmutable($weights[0]['measured_on']);
                $out['weight_days_ago'] = (int)$on->diff($today)->format('%r%a');
            } catch (\Throwable $e) {}
            if (isset($weights[1])) {
                $out['weight_delta'] = round((float)$weights[0]['weight_kg'] - (float)$weights[1]['weight_kg'], 1);
            }
        }

        // Последняя отметка приёма пищи.
        $lastLog = Database::one(
            'SELECT logged_at FROM meal_logs WHERE client_id = ? ORDER BY logged_at DESC LIMIT 1',
            [$clientId]
        );
        if ($lastLog && !empty($lastLog['logged_at'])) {
            try {
                $on = new \DateTimeImmutable(substr($lastLog['logged_at'], 0, 10));
                $out['meal_days_ago'] = (int)$on->diff($today)->format('%r%a');
            } catch (\Throwable $e) {}
        }

        // Соблюдение по опубликованному меню: отмеченные «съедено» / всего позиций.
        if ($menu && $menu['status'] === 'published') {
            $total = (int)(Database::one(
                'SELECT COUNT(*) n FROM menu_items WHERE menu_id = ?',
                [(int)$menu['id']]
            )['n'] ?? 0);
            if ($total > 0) {
                $eaten = (int)(Database::one(
                    "SELECT COUNT(*) n FROM meal_logs ml
                     JOIN menu_items mi ON mi.id = ml.menu_item_id
                     WHERE mi.menu_id = ? AND ml.status = 'eaten'",
                    [(int)$menu['id']]
                )['n'] ?? 0);
                $out['compliance_pct'] = (int)round($eaten / $total * 100);
            }
        }

        // ---- Правила «Требуют внимания» ----
        $a = [];
        if ($out['unread_messages'] > 0) {
            $a[] = ['type' => 'message', 'text' => 'Новое сообщение'];
        }
        if ($out['menu_status'] === null) {
            $a[] = ['type' => 'no_menu', 'text' => 'Меню не создано'];
        } elseif ($out['menu_end_days'] !== null && $out['menu_end_days'] <= 1) {
            $a[] = ['type' => 'menu_ending', 'text' => $out['menu_end_days'] < 0
                ? 'Меню закончилось'
                : ($out['menu_end_days'] === 0 ? 'Меню заканчивается сегодня' : 'Меню заканчивается завтра')];
        }
        if ($out['menu_status'] === 'published' && ($out['meal_days_ago'] === null || $out['meal_days_ago'] >= 3)) {
            $a[] = ['type' => 'no_logs', 'text' => $out['meal_days_ago'] === null
                ? 'Ещё не отмечал питание'
                : 'Не отмечает питание ' . $this->plDays($out['meal_days_ago'])];
        }
        if ($out['weight_days_ago'] !== null && $out['weight_days_ago'] >= 7) {
            $a[] = ['type' => 'no_weight', 'text' => 'Не вносил вес ' . $this->plDays($out['weight_days_ago'])];
        }
        if ($out['weight_delta'] !== null && abs($out['weight_delta']) < 0.3
            && $out['weight_days_ago'] !== null && $out['weight_days_ago'] >= 5) {
            $a[] = ['type' => 'weight_stall', 'text' => 'Вес не меняется'];
        }
        // Сортировка по важности: сообщение и «стоп-сигналы» выше, «меню не создано» ниже.
        $sev = ['message' => 0, 'menu_ending' => 1, 'no_logs' => 2, 'weight_stall' => 3, 'no_weight' => 4, 'no_menu' => 5];
        usort($a, fn($x, $y) => ($sev[$x['type']] ?? 9) <=> ($sev[$y['type']] ?? 9));
        $out['attention'] = $a;
        $out['attention_rank'] = $a ? ($sev[$a[0]['type']] ?? 9) : 99;

        return $out;
    }

    /** Склонение «дней». */
    private function plDays(int $n): string
    {
        $n = abs($n);
        $mod100 = $n % 100;
        $mod10 = $n % 10;
        if ($mod100 >= 11 && $mod100 <= 14) return $n . ' дней';
        if ($mod10 === 1) return $n . ' день';
        if ($mod10 >= 2 && $mod10 <= 4) return $n . ' дня';
        return $n . ' дней';
    }

    public function show(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $client = Repo::clientOwnedBy((int)$args['id'], $auth['id']);
        unset($client['password_hash']);
        $client['excluded_ingredients'] = $this->decodeJson($client['excluded_ingredients']);
        $client['medical_flags'] = $this->decodeJson($client['medical_flags'] ?? null);
        $client['intake_completed'] = !empty($client['intake_completed_at']);
        $client['menus'] = Database::all(
            'SELECT id, title, start_date, days_count, status, published_at, created_at
             FROM menus WHERE client_id = ? ORDER BY created_at DESC',
            [(int)$client['id']]
        );
        $client = array_merge($client, $this->clientSignals((int)$client['id']));
        return $client;
    }

    /**
     * Лента активности клиента (для вкладки «Обзор» и «Дневник»):
     * отметки питания, замеры веса, сообщения, публикации меню — единым списком.
     */
    public function activity(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $client = Repo::clientOwnedBy((int)$args['id'], $auth['id']);
        $cid = (int)$client['id'];
        $limit = min(100, max(1, (int)($req->query['limit'] ?? 40)));
        $items = [];

        $logs = Database::all(
            "SELECT ml.status, ml.logged_at, ml.comment, mi.meal_type, d.name AS dish_name
             FROM meal_logs ml
             JOIN menu_items mi ON mi.id = ml.menu_item_id
             LEFT JOIN dishes d ON d.id = mi.dish_id
             WHERE ml.client_id = ? ORDER BY ml.logged_at DESC LIMIT ?",
            [$cid, $limit]
        );
        foreach ($logs as $l) {
            $items[] = [
                'type' => 'meal_' . $l['status'],
                'at' => $l['logged_at'],
                'meal_type' => $l['meal_type'],
                'dish' => $l['dish_name'],
                'comment' => $l['comment'],
            ];
        }

        $weights = Database::all(
            'SELECT weight_kg, measured_on FROM weight_logs WHERE client_id = ? ORDER BY measured_on DESC LIMIT ?',
            [$cid, $limit]
        );
        foreach ($weights as $w) {
            $items[] = ['type' => 'weight', 'at' => $w['measured_on'], 'weight_kg' => (float)$w['weight_kg']];
        }

        $msgs = Database::all(
            "SELECT body, author_type, created_at FROM messages WHERE client_id = ? ORDER BY created_at DESC LIMIT ?",
            [$cid, $limit]
        );
        foreach ($msgs as $m) {
            $items[] = ['type' => 'message', 'at' => $m['created_at'], 'author' => $m['author_type'], 'body' => $m['body']];
        }

        $menus = Database::all(
            "SELECT title, published_at FROM menus WHERE client_id = ? AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT ?",
            [$cid, $limit]
        );
        foreach ($menus as $mn) {
            $items[] = ['type' => 'menu_published', 'at' => $mn['published_at'], 'title' => $mn['title']];
        }

        // Сортировка по времени (строки ISO/дат сравнимы лексикографически при одинаковом формате;
        // приводим дату-only к полуночи для корректного сравнения с ISO-датами).
        usort($items, fn($a, $b) => strcmp($this->tsKey($b['at']), $this->tsKey($a['at'])));
        return ['items' => array_slice($items, 0, $limit)];
    }

    private function tsKey(?string $s): string
    {
        $s = (string)$s;
        if ($s === '') return '';
        // «YYYY-MM-DD» → «YYYY-MM-DDT00:00:00» для сопоставимости с ISO-датавременем.
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) return $s . 'T00:00:00';
        return $s;
    }

    public function create(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $this->require($req->body, ['name']);
        $this->inList($req->input('sex'), self::SEX, 'sex');
        $this->inList($req->input('activity_level'), self::ACTIVITY, 'activity_level');

        $inviteToken = bin2hex(random_bytes(16));
        $id = Database::insert(
            'INSERT INTO clients
             (specialist_id, name, email, phone, invite_token, sex, birth_year, height_cm, weight_kg,
              activity_level, goal, target_kcal, target_protein, target_fat, target_carbs,
              excluded_ingredients, notes, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $auth['id'],
                trim((string)$req->input('name')),
                $this->normEmail($req->input('email')),
                $req->input('phone'),
                $inviteToken,
                $req->input('sex'),
                $req->input('birth_year') !== null ? (int)$req->input('birth_year') : null,
                $req->input('height_cm') !== null ? (int)$req->input('height_cm') : null,
                $req->input('weight_kg') !== null ? $this->num($req->input('weight_kg')) : null,
                $req->input('activity_level'),
                $req->input('goal'),
                $req->input('target_kcal') !== null ? (int)$req->input('target_kcal') : null,
                $req->input('target_protein') !== null ? $this->num($req->input('target_protein')) : null,
                $req->input('target_fat') !== null ? $this->num($req->input('target_fat')) : null,
                $req->input('target_carbs') !== null ? $this->num($req->input('target_carbs')) : null,
                json_encode($req->input('excluded_ingredients', []), JSON_UNESCAPED_UNICODE),
                $req->input('notes'),
                'active',
                $this->now(),
            ]
        );
        return $this->show($req, ['id' => $id]);
    }

    public function update(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        Repo::clientOwnedBy($id, $auth['id']);

        $this->inList($req->input('sex'), self::SEX, 'sex');
        $this->inList($req->input('activity_level'), self::ACTIVITY, 'activity_level');

        $textFields = ['name', 'email', 'phone', 'sex', 'activity_level', 'goal', 'notes', 'status'];
        $intFields = ['birth_year', 'height_cm', 'target_kcal'];
        $floatFields = ['weight_kg', 'target_protein', 'target_fat', 'target_carbs'];

        $set = [];
        $params = [];
        foreach ($textFields as $f) {
            if (array_key_exists($f, $req->body)) {
                $set[] = "$f = ?";
                $params[] = $f === 'email' ? $this->normEmail($req->input($f)) : $req->input($f);
            }
        }
        foreach ($intFields as $f) {
            if (array_key_exists($f, $req->body)) {
                $set[] = "$f = ?";
                $params[] = $req->input($f) !== null ? (int)$req->input($f) : null;
            }
        }
        foreach ($floatFields as $f) {
            if (array_key_exists($f, $req->body)) {
                $set[] = "$f = ?";
                $params[] = $req->input($f) !== null ? $this->num($req->input($f)) : null;
            }
        }
        if (array_key_exists('excluded_ingredients', $req->body)) {
            $set[] = 'excluded_ingredients = ?';
            $params[] = json_encode($req->input('excluded_ingredients', []), JSON_UNESCAPED_UNICODE);
        }
        if ($set) {
            $params[] = $id;
            Database::exec('UPDATE clients SET ' . implode(', ', $set) . ' WHERE id = ?', $params);
        }
        return $this->show($req, ['id' => $id]);
    }

    /** Получить/пересоздать инвайт-ссылку. */
    public function invite(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        $client = Repo::clientOwnedBy($id, $auth['id']);

        $token = $client['invite_token'];
        if (!empty($req->input('regenerate')) || empty($token)) {
            $token = bin2hex(random_bytes(16));
            Database::exec('UPDATE clients SET invite_token = ?, password_hash = NULL WHERE id = ?', [$token, $id]);
        }
        return [
            'invite_token' => $token,
            'invite_path'  => '/app/#/invite/' . $token,
        ];
    }

    public function delete(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        Repo::clientOwnedBy($id, $auth['id']);
        // Мягкое удаление — статус archived, чтобы не терять историю меню.
        Database::exec("UPDATE clients SET status = 'archived' WHERE id = ?", [$id]);
        return ['ok' => true];
    }

    private function normEmail(mixed $email): ?string
    {
        if (!$email) {
            return null;
        }
        return strtolower(trim((string)$email));
    }

    private function decodeJson(?string $json): array
    {
        $v = json_decode((string)$json, true);
        return is_array($v) ? $v : [];
    }
}
