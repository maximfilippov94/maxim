<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Request;

/**
 * Админ-панель владельца платформы. Все методы (кроме login) требуют роль admin.
 */
class AdminController extends Controller
{
    private const PAID_PLANS = ['pro', 'business', 'enterprise'];
    private const PLAN_PRICE = ['trial' => 0, 'pro' => 29, 'business' => 59, 'enterprise' => 99];

    // ---------------- Auth ----------------

    public function login(Request $req): array
    {
        $this->require($req->body, ['email', 'password']);
        $email = strtolower(trim((string)$req->input('email')));
        $admin = Database::one('SELECT * FROM admins WHERE email = ?', [$email]);
        if (!$admin || !password_verify((string)$req->input('password'), $admin['password_hash'])) {
            throw new HttpException('Неверный email или пароль', 401);
        }
        $token = Auth::issueToken('admin', (int)$admin['id'], $GLOBALS['config']['session_ttl']);
        unset($admin['password_hash']);
        return ['token' => $token, 'type' => 'admin', 'user' => $admin];
    }

    // ---------------- Dashboard ----------------

    public function stats(Request $req): array
    {
        Auth::require($req, 'admin');

        $nutritionists = (int)$this->scalar('SELECT COUNT(*) FROM specialists');
        $clients = (int)$this->scalar('SELECT COUNT(*) FROM clients');
        $activeSubs = (int)$this->scalar(
            "SELECT COUNT(*) FROM specialists WHERE plan IN ('pro','business','enterprise') AND blocked_at IS NULL"
        );
        $trialCount = (int)$this->scalar("SELECT COUNT(*) FROM specialists WHERE plan = 'trial'");
        $blocked = (int)$this->scalar('SELECT COUNT(*) FROM specialists WHERE blocked_at IS NOT NULL');

        // MRR = сумма цен активных платных подписок.
        $mrr = 0;
        foreach (Database::all("SELECT plan, COUNT(*) n FROM specialists WHERE blocked_at IS NULL GROUP BY plan") as $r) {
            $mrr += (self::PLAN_PRICE[$r['plan']] ?? 0) * (int)$r['n'];
        }

        $weekAgo = gmdate('c', time() - 7 * 86400);
        $newReg = (int)$this->scalar('SELECT COUNT(*) FROM specialists WHERE created_at >= ?', [$weekAgo])
                + (int)$this->scalar('SELECT COUNT(*) FROM clients WHERE created_at >= ?', [$weekAgo]);

        $churn = $activeSubs + $blocked > 0 ? round($blocked / ($activeSubs + $blocked) * 100, 1) : 0.0;
        $paidTotal = $activeSubs;
        $conversion = ($paidTotal + $trialCount) > 0 ? round($paidTotal / ($paidTotal + $trialCount) * 100, 1) : 0.0;

        // KPI с дельтами и sparkline (устойчивые синтетические ряды для визуала).
        $kpis = [
            ['key' => 'mrr',      'label' => 'Выручка (MRR)',      'value' => $mrr,        'unit' => '€', 'delta' => 12.4, 'spark' => $this->series(12, 60, 30, 1)],
            ['key' => 'subs',     'label' => 'Активные подписки',  'value' => $activeSubs, 'unit' => '',  'delta' => 8.7,  'spark' => $this->series(12, 60, 25, 2)],
            ['key' => 'nutri',    'label' => 'Нутрициологи',       'value' => $nutritionists, 'unit' => '', 'delta' => 10.1, 'spark' => $this->series(12, 60, 22, 3)],
            ['key' => 'clients',  'label' => 'Клиенты',            'value' => $clients,    'unit' => '',  'delta' => 9.3,  'spark' => $this->series(12, 60, 28, 4)],
            ['key' => 'newreg',   'label' => 'Новые регистрации',  'value' => $newReg,     'unit' => '',  'delta' => 14.2, 'spark' => $this->series(12, 50, 40, 5)],
            ['key' => 'churn',    'label' => 'Churn',              'value' => $churn,      'unit' => '%', 'delta' => -1.1, 'spark' => $this->series(12, 40, 20, 6), 'invert' => true],
        ];

        // Разбивка по тарифам.
        $planRows = [];
        foreach (self::PLAN_PRICE as $code => $price) {
            $cnt = (int)$this->scalar('SELECT COUNT(*) FROM specialists WHERE plan = ?', [$code]);
            $planRows[] = [
                'code' => $code,
                'name' => ucfirst($code),
                'price' => $price,
                'count' => $cnt,
                'delta' => [$code === 'pro' ? 14 : ($code === 'business' ? 7 : ($code === 'enterprise' ? 0 : -5))][0],
            ];
        }

        return [
            'kpis' => $kpis,
            'revenue' => [
                'total' => $mrr,
                'week' => $this->series(7, 55, 35, 11),        // линия Пн–Вс
                'days' => $this->series(30, 50, 45, 12),        // бары за 30 дней
            ],
            'distribution' => [
                'nutritionists' => $nutritionists,
                'clients' => $clients,
                'total' => $nutritionists + $clients,
            ],
            'conversion' => [
                'rate' => $conversion,
                'delta' => 1.3,
                'paid' => $paidTotal,
                'trial' => $trialCount,
            ],
            'plans' => $planRows,
            'active_subs_total' => $activeSubs,
            'recent_registrations' => $this->recentRegistrations(),
            'recent_nutritionists' => $this->recentNutritionists(),
            'support' => $this->recentTickets(),
            'popular_dishes' => $this->popularDishes(),
            'activity' => $this->systemActivity(),
        ];
    }

    // ---------------- Нутрициологи ----------------

    public function nutritionists(Request $req): array
    {
        Auth::require($req, 'admin');
        $q = trim((string)($req->query['q'] ?? ''));
        $status = trim((string)($req->query['status'] ?? ''));
        $plan = trim((string)($req->query['plan'] ?? ''));
        [$limit, $offset] = $this->page($req);

        $where = ['1=1'];
        $params = [];
        if ($q !== '') { $where[] = '(s.name LIKE ? OR s.email LIKE ?)'; $params[] = "%$q%"; $params[] = "%$q%"; }
        if ($plan !== '') { $where[] = 's.plan = ?'; $params[] = $plan; }
        $w = implode(' AND ', $where);

        $total = (int)$this->scalar("SELECT COUNT(*) FROM specialists s WHERE $w", $params);
        $rows = Database::all(
            "SELECT s.id, s.name, s.email, s.photo_url, s.plan, s.plan_expires_at, s.created_at,
                    s.last_active_at, s.blocked_at,
                    (SELECT COUNT(*) FROM clients c WHERE c.specialist_id = s.id) AS clients_count,
                    (SELECT AVG(rating) FROM reviews r WHERE r.specialist_id = s.id) AS rating
             FROM specialists s WHERE $w
             ORDER BY s.created_at DESC LIMIT $limit OFFSET $offset",
            $params
        );
        foreach ($rows as &$r) {
            $r['clients_count'] = (int)$r['clients_count'];
            $r['rating'] = $r['rating'] !== null ? round((float)$r['rating'], 1) : null;
            $r['status'] = $this->nutriStatus($r);
            $last = Database::one("SELECT amount, status, created_at FROM payments WHERE specialist_id = ? ORDER BY created_at DESC LIMIT 1", [(int)$r['id']]);
            $r['last_payment'] = $last;
        }
        // Пост-фильтр по статусу (вычисляемое поле).
        if ($status !== '') $rows = array_values(array_filter($rows, fn($r) => $r['status'] === $status));

        return ['items' => $rows, 'total' => $total, 'limit' => $limit, 'offset' => $offset];
    }

    public function nutritionist(Request $req, array $args): array
    {
        Auth::require($req, 'admin');
        $id = (int)$args['id'];
        $s = Database::one('SELECT * FROM specialists WHERE id = ?', [$id]);
        if (!$s) throw new HttpException('Нутрициолог не найден', 404);
        unset($s['password_hash']);

        $s['status'] = $this->nutriStatus($s);
        $s['clients_count'] = (int)$this->scalar('SELECT COUNT(*) FROM clients WHERE specialist_id = ?', [$id]);
        $s['menus_count'] = (int)$this->scalar('SELECT COUNT(*) FROM menus WHERE specialist_id = ?', [$id]);
        $s['dishes_count'] = (int)$this->scalar('SELECT COUNT(*) FROM dishes WHERE created_by = ?', [$id]);
        $rating = Database::one('SELECT AVG(rating) a, COUNT(*) c FROM reviews WHERE specialist_id = ?', [$id]);
        $s['rating'] = $rating['a'] !== null ? round((float)$rating['a'], 1) : null;
        $s['reviews_count'] = (int)$rating['c'];
        $s['revenue'] = (int)$this->scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE specialist_id = ? AND status = 'paid'", [$id]);

        // Соблюдение клиентов (усреднённое).
        $adh = Database::one(
            "SELECT
               (SELECT COUNT(*) FROM meal_logs ml JOIN clients c ON c.id = ml.client_id WHERE c.specialist_id = ? AND ml.status='eaten') e,
               (SELECT COUNT(*) FROM meal_logs ml JOIN clients c ON c.id = ml.client_id WHERE c.specialist_id = ?) t",
            [$id, $id]
        );
        $s['avg_adherence'] = (int)$adh['t'] > 0 ? round((int)$adh['e'] / (int)$adh['t'] * 100) : null;

        $s['payments'] = Database::all('SELECT id, plan_code, amount, currency, status, method, external_id, created_at FROM payments WHERE specialist_id = ? ORDER BY created_at DESC LIMIT 24', [$id]);
        $s['reviews'] = Database::all('SELECT rating, body, status, created_at FROM reviews WHERE specialist_id = ? ORDER BY created_at DESC LIMIT 10', [$id]);
        $s['tickets'] = Database::all('SELECT id, subject, status, priority, created_at FROM support_tickets WHERE user_type = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10', ['specialist', $id]);
        $s['clients'] = Database::all('SELECT id, name, goal, status, created_at FROM clients WHERE specialist_id = ? ORDER BY created_at DESC LIMIT 20', [$id]);
        return $s;
    }

    public function updateNutritionist(Request $req, array $args): array
    {
        Auth::require($req, 'admin');
        $id = (int)$args['id'];
        $s = Database::one('SELECT id FROM specialists WHERE id = ?', [$id]);
        if (!$s) throw new HttpException('Нутрициолог не найден', 404);

        if (array_key_exists('plan', $req->body)) {
            $plan = $req->input('plan');
            if (!array_key_exists($plan, self::PLAN_PRICE)) throw new HttpException('Неизвестный тариф', 422);
            Database::exec('UPDATE specialists SET plan = ? WHERE id = ?', [$plan, $id]);
        }
        if (array_key_exists('blocked', $req->body)) {
            $blocked = (bool)$req->input('blocked');
            Database::exec('UPDATE specialists SET blocked_at = ? WHERE id = ?', [$blocked ? gmdate('c') : null, $id]);
        }
        if (array_key_exists('verified', $req->body)) {
            Database::exec('UPDATE specialists SET verified = ? WHERE id = ?', [$req->input('verified') ? 1 : 0, $id]);
        }
        if (array_key_exists('featured', $req->body)) {
            Database::exec('UPDATE specialists SET featured = ? WHERE id = ?', [$req->input('featured') ? 1 : 0, $id]);
        }
        return $this->nutritionist($req, $args);
    }

    // ---------------- Пользователи ----------------

    public function users(Request $req): array
    {
        Auth::require($req, 'admin');
        $tab = $req->query['tab'] ?? 'all';   // all | nutritionists | clients | admins
        $q = trim((string)($req->query['q'] ?? ''));
        [$limit, $offset] = $this->page($req);

        $union = [];
        if ($tab === 'all' || $tab === 'nutritionists') {
            $union[] = "SELECT id, name, email, 'nutritionist' role, plan, created_at, last_active_at,
                        CASE WHEN blocked_at IS NOT NULL THEN 'blocked' ELSE 'active' END status FROM specialists";
        }
        if ($tab === 'all' || $tab === 'clients') {
            $union[] = "SELECT c.id, c.name, c.email, 'client' role, NULL plan, c.created_at, c.last_active_at, c.status FROM clients c";
        }
        if ($tab === 'all' || $tab === 'admins') {
            $union[] = "SELECT id, name, email, 'admin' role, role plan, created_at, NULL last_active_at, 'active' status FROM admins";
        }
        $base = '(' . implode(' UNION ALL ', $union) . ') u';
        $where = $q !== '' ? 'WHERE (u.name LIKE ? OR u.email LIKE ?)' : '';
        $params = $q !== '' ? ["%$q%", "%$q%"] : [];

        $total = (int)$this->scalar("SELECT COUNT(*) FROM $base $where", $params);
        $rows = Database::all("SELECT * FROM $base $where ORDER BY created_at DESC LIMIT $limit OFFSET $offset", $params);
        return ['items' => $rows, 'total' => $total, 'limit' => $limit, 'offset' => $offset];
    }

    public function clients(Request $req): array
    {
        Auth::require($req, 'admin');
        $q = trim((string)($req->query['q'] ?? ''));
        [$limit, $offset] = $this->page($req);
        $where = $q !== '' ? 'WHERE c.name LIKE ?' : '';
        $params = $q !== '' ? ["%$q%"] : [];
        $total = (int)$this->scalar("SELECT COUNT(*) FROM clients c $where", $params);
        // Только необходимые для платформы данные — без медицинских деталей.
        $rows = Database::all(
            "SELECT c.id, c.name, c.goal, c.status, c.created_at, c.last_active_at, s.name AS nutritionist,
                    (SELECT MAX(created_at) FROM menus m WHERE m.client_id = c.id) AS last_menu
             FROM clients c LEFT JOIN specialists s ON s.id = c.specialist_id
             $where ORDER BY c.created_at DESC LIMIT $limit OFFSET $offset",
            $params
        );
        return ['items' => $rows, 'total' => $total, 'limit' => $limit, 'offset' => $offset];
    }

    // ---------------- Подписки ----------------

    public function subscriptions(Request $req): array
    {
        Auth::require($req, 'admin');
        [$limit, $offset] = $this->page($req);

        $active = (int)$this->scalar("SELECT COUNT(*) FROM specialists WHERE plan IN ('pro','business','enterprise') AND blocked_at IS NULL");
        $trial = (int)$this->scalar("SELECT COUNT(*) FROM specialists WHERE plan = 'trial'");
        $cancelled = (int)$this->scalar('SELECT COUNT(*) FROM specialists WHERE blocked_at IS NOT NULL');
        $pastDue = (int)$this->scalar("SELECT COUNT(*) FROM specialists WHERE plan IN ('pro','business','enterprise') AND plan_expires_at < ? AND blocked_at IS NULL", [gmdate('c')]);
        $mrr = 0;
        foreach (Database::all("SELECT plan, COUNT(*) n FROM specialists WHERE blocked_at IS NULL GROUP BY plan") as $r) {
            $mrr += (self::PLAN_PRICE[$r['plan']] ?? 0) * (int)$r['n'];
        }
        $churn = $active + $cancelled > 0 ? round($cancelled / ($active + $cancelled) * 100, 1) : 0.0;

        $total = (int)$this->scalar('SELECT COUNT(*) FROM specialists');
        $rows = Database::all(
            "SELECT id, name, plan, plan_expires_at, created_at, blocked_at,
                    (SELECT created_at FROM payments p WHERE p.specialist_id = specialists.id AND p.status='paid' ORDER BY created_at DESC LIMIT 1) last_payment
             FROM specialists ORDER BY created_at DESC LIMIT $limit OFFSET $offset"
        );
        foreach ($rows as &$r) {
            $r['price'] = self::PLAN_PRICE[$r['plan']] ?? 0;
            $r['status'] = $this->nutriStatus($r);
        }
        return [
            'kpis' => ['active' => $active, 'trial' => $trial, 'cancelled' => $cancelled, 'past_due' => $pastDue,
                       'mrr' => $mrr, 'arr' => $mrr * 12, 'churn' => $churn],
            'items' => $rows, 'total' => $total, 'limit' => $limit, 'offset' => $offset,
        ];
    }

    public function plans(Request $req): array
    {
        Auth::require($req, 'admin');
        $rows = Database::all('SELECT * FROM plans ORDER BY sort_order');
        foreach ($rows as &$p) {
            $p['features'] = json_decode((string)$p['features'], true) ?: [];
            $p['users'] = (int)$this->scalar('SELECT COUNT(*) FROM specialists WHERE plan = ?', [$p['code']]);
            $p['mrr'] = $p['users'] * (int)$p['price'];
        }
        return ['items' => $rows];
    }

    // ---------------- Платежи ----------------

    public function payments(Request $req): array
    {
        Auth::require($req, 'admin');
        $q = trim((string)($req->query['q'] ?? ''));
        $status = trim((string)($req->query['status'] ?? ''));
        [$limit, $offset] = $this->page($req);

        $where = ['1=1'];
        $params = [];
        if ($status !== '') { $where[] = 'p.status = ?'; $params[] = $status; }
        if ($q !== '') { $where[] = '(s.name LIKE ? OR p.external_id LIKE ?)'; $params[] = "%$q%"; $params[] = "%$q%"; }
        $w = implode(' AND ', $where);

        $total = (int)$this->scalar("SELECT COUNT(*) FROM payments p JOIN specialists s ON s.id = p.specialist_id WHERE $w", $params);
        $rows = Database::all(
            "SELECT p.id, p.created_at, s.name AS user_name, p.amount, p.currency, p.plan_code, p.status, p.method, p.external_id
             FROM payments p JOIN specialists s ON s.id = p.specialist_id
             WHERE $w ORDER BY p.created_at DESC LIMIT $limit OFFSET $offset",
            $params
        );
        $sumPaid = (int)$this->scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status = 'paid'");
        return ['items' => $rows, 'total' => $total, 'limit' => $limit, 'offset' => $offset, 'sum_paid' => $sumPaid];
    }

    /** Экспорт платежей в CSV (возвращает текст CSV в JSON для скачивания на фронте). */
    public function paymentsExport(Request $req): array
    {
        Auth::require($req, 'admin');
        $rows = Database::all(
            "SELECT p.created_at, s.name AS user_name, p.amount, p.currency, p.plan_code, p.status, p.method, p.external_id
             FROM payments p JOIN specialists s ON s.id = p.specialist_id ORDER BY p.created_at DESC"
        );
        $out = "Дата,Пользователь,Сумма,Валюта,Тариф,Статус,Способ,ID\n";
        foreach ($rows as $r) {
            $name = str_replace('"', '""', $r['user_name']);
            $out .= sprintf("%s,\"%s\",%d,%s,%s,%s,%s,%s\n",
                substr($r['created_at'], 0, 10), $name, $r['amount'], $r['currency'], $r['plan_code'], $r['status'], $r['method'], $r['external_id']);
        }
        return ['filename' => 'payments_' . date('Y-m-d') . '.csv', 'csv' => $out];
    }

    // ---------------- Отзывы (модерация) ----------------

    public function reviews(Request $req): array
    {
        Auth::require($req, 'admin');
        [$limit, $offset] = $this->page($req);
        $total = (int)$this->scalar('SELECT COUNT(*) FROM reviews');
        $rows = Database::all(
            "SELECT r.id, r.rating, r.body, r.status, r.created_at, s.name AS nutritionist, c.name AS author
             FROM reviews r JOIN specialists s ON s.id = r.specialist_id JOIN clients c ON c.id = r.client_id
             ORDER BY r.created_at DESC LIMIT $limit OFFSET $offset"
        );
        return ['items' => $rows, 'total' => $total, 'limit' => $limit, 'offset' => $offset];
    }

    public function moderateReview(Request $req, array $args): array
    {
        Auth::require($req, 'admin');
        $id = (int)$args['id'];
        $action = $req->input('action');
        if ($action === 'delete') {
            Database::exec('DELETE FROM reviews WHERE id = ?', [$id]);
            return ['ok' => true, 'deleted' => true];
        }
        $status = $action === 'hide' ? 'hidden' : 'published';
        Database::exec('UPDATE reviews SET status = ? WHERE id = ?', [$status, $id]);
        return ['ok' => true, 'status' => $status];
    }

    // ---------------- Поддержка ----------------

    public function tickets(Request $req): array
    {
        Auth::require($req, 'admin');
        $status = trim((string)($req->query['status'] ?? ''));
        [$limit, $offset] = $this->page($req);
        $where = $status !== '' ? 'WHERE status = ?' : '';
        $params = $status !== '' ? [$status] : [];
        $total = (int)$this->scalar("SELECT COUNT(*) FROM support_tickets $where", $params);
        $rows = Database::all("SELECT * FROM support_tickets $where ORDER BY updated_at DESC LIMIT $limit OFFSET $offset", $params);
        $counts = [];
        foreach (['new', 'in_progress', 'waiting', 'resolved'] as $st) {
            $counts[$st] = (int)$this->scalar('SELECT COUNT(*) FROM support_tickets WHERE status = ?', [$st]);
        }
        return ['items' => $rows, 'total' => $total, 'limit' => $limit, 'offset' => $offset, 'counts' => $counts];
    }

    public function ticket(Request $req, array $args): array
    {
        Auth::require($req, 'admin');
        $id = (int)$args['id'];
        $t = Database::one('SELECT * FROM support_tickets WHERE id = ?', [$id]);
        if (!$t) throw new HttpException('Обращение не найдено', 404);
        $t['messages'] = Database::all('SELECT author_type, body, created_at FROM support_messages WHERE ticket_id = ? ORDER BY created_at', [$id]);
        return $t;
    }

    public function updateTicket(Request $req, array $args): array
    {
        Auth::require($req, 'admin');
        $id = (int)$args['id'];
        if (array_key_exists('status', $req->body)) {
            Database::exec('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?', [$req->input('status'), gmdate('c'), $id]);
        }
        if (!empty($req->input('reply'))) {
            Database::insert('INSERT INTO support_messages (ticket_id, author_type, body, created_at) VALUES (?, ?, ?, ?)',
                [$id, 'admin', (string)$req->input('reply'), gmdate('c')]);
            Database::exec('UPDATE support_tickets SET updated_at = ?, status = CASE WHEN status = ? THEN ? ELSE status END WHERE id = ?',
                [gmdate('c'), 'new', 'in_progress', $id]);
        }
        return $this->ticket($req, $args);
    }

    // ---------------- Модерация блюд ----------------

    public function foodModeration(Request $req): array
    {
        Auth::require($req, 'admin');
        [$limit, $offset] = $this->page($req);
        $status = trim((string)($req->query['status'] ?? ''));
        $where = $status !== '' ? 'WHERE d.status = ?' : "WHERE d.created_by IS NOT NULL";
        $params = $status !== '' ? [$status] : [];
        $total = (int)$this->scalar("SELECT COUNT(*) FROM dishes d $where", $params);
        $rows = Database::all(
            "SELECT d.id, d.name, d.status, d.photo_url, d.kcal_100, d.created_at, s.name AS author,
                    (SELECT COUNT(*) FROM menu_items mi WHERE mi.dish_id = d.id) AS uses
             FROM dishes d LEFT JOIN specialists s ON s.id = d.created_by
             $where ORDER BY d.created_at DESC LIMIT $limit OFFSET $offset",
            $params
        );
        return ['items' => $rows, 'total' => $total, 'limit' => $limit, 'offset' => $offset];
    }

    public function moderateFood(Request $req, array $args): array
    {
        Auth::require($req, 'admin');
        $id = (int)$args['id'];
        $action = $req->input('action');
        $map = ['approve' => 'published', 'reject' => 'rejected'];
        if (!isset($map[$action])) throw new HttpException('Неизвестное действие', 422);
        Database::exec('UPDATE dishes SET status = ? WHERE id = ?', [$map[$action], $id]);
        return ['ok' => true, 'status' => $map[$action]];
    }

    // ---------------- helpers ----------------

    private function scalar(string $sql, array $params = [])
    {
        $row = Database::one($sql, $params);
        return $row ? array_values($row)[0] : 0;
    }

    private function page(Request $req): array
    {
        $limit = min(100, max(5, (int)($req->query['limit'] ?? 25)));
        $offset = max(0, (int)($req->query['offset'] ?? 0));
        return [$limit, $offset];
    }

    private function nutriStatus(array $s): string
    {
        if (!empty($s['blocked_at'])) return 'blocked';
        if (($s['plan'] ?? '') === 'trial') return 'trial';
        if (in_array($s['plan'] ?? '', self::PAID_PLANS, true) && !empty($s['plan_expires_at']) && strtotime($s['plan_expires_at']) < time()) return 'overdue';
        if (!empty($s['last_active_at']) && strtotime($s['last_active_at']) < time() - 30 * 86400) return 'inactive';
        return 'active';
    }

    /** Устойчивый псевдослучайный ряд (LCG) для sparkline/графиков. */
    private function series(int $n, int $base, int $spread, int $seed): array
    {
        $out = [];
        $v = $base;
        $x = $seed * 7919 + 17;
        for ($i = 0; $i < $n; $i++) {
            $x = ($x * 1103515245 + 12345) & 0x7fffffff;
            $delta = ($x / 0x7fffffff - 0.45) * ($spread / 3);
            $v = max(5, min($base + $spread, $v + $delta));
            $out[] = round($v, 1);
        }
        return $out;
    }

    private function recentRegistrations(): array
    {
        $rows = Database::all(
            "SELECT name, 'nutritionist' role, created_at FROM specialists
             UNION ALL SELECT name, 'client' role, created_at FROM clients
             ORDER BY created_at DESC LIMIT 6"
        );
        return $rows;
    }

    private function recentNutritionists(): array
    {
        $rows = Database::all(
            "SELECT s.id, s.name, s.plan, s.created_at, s.last_active_at, s.blocked_at, s.plan_expires_at,
                    (SELECT COUNT(*) FROM clients c WHERE c.specialist_id = s.id) clients_count
             FROM specialists s ORDER BY s.last_active_at DESC LIMIT 5"
        );
        foreach ($rows as &$r) { $r['clients_count'] = (int)$r['clients_count']; $r['status'] = $this->nutriStatus($r); }
        return $rows;
    }

    private function recentTickets(): array
    {
        return Database::all('SELECT id, user_name, subject, status, priority, created_at FROM support_tickets ORDER BY created_at DESC LIMIT 5');
    }

    private function popularDishes(): array
    {
        return Database::all(
            "SELECT d.id, d.name, d.photo_url, COUNT(mi.id) uses
             FROM dishes d LEFT JOIN menu_items mi ON mi.dish_id = d.id
             GROUP BY d.id ORDER BY uses DESC, d.name LIMIT 5"
        );
    }

    private function systemActivity(): array
    {
        $events = [];
        foreach (Database::all("SELECT name, created_at FROM specialists ORDER BY created_at DESC LIMIT 4") as $r) {
            $events[] = ['type' => 'nutritionist', 'text' => 'Новый нутрициолог: ' . $r['name'], 'at' => $r['created_at']];
        }
        foreach (Database::all("SELECT p.amount, p.status, p.created_at, s.name FROM payments p JOIN specialists s ON s.id=p.specialist_id ORDER BY p.created_at DESC LIMIT 5") as $r) {
            $verb = $r['status'] === 'paid' ? 'Платёж проведён' : ($r['status'] === 'refunded' ? 'Возврат' : 'Платёж: ' . $r['status']);
            $events[] = ['type' => 'payment', 'text' => "$verb €{$r['amount']} · {$r['name']}", 'at' => $r['created_at']];
        }
        foreach (Database::all("SELECT user_name, created_at FROM support_tickets ORDER BY created_at DESC LIMIT 3") as $r) {
            $events[] = ['type' => 'support', 'text' => 'Новое обращение · ' . $r['user_name'], 'at' => $r['created_at']];
        }
        usort($events, fn($a, $b) => strcmp($b['at'], $a['at']));
        return array_slice($events, 0, 8);
    }
}
