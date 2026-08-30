<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\Request;

/**
 * Кабинет клиента: свои опубликованные меню и прогресс соблюдения.
 */
class ClientPortalController extends Controller
{
    private const ACTIVITY = ['low', 'medium', 'high'];
    private const MEDICAL = ['pregnancy', 'diabetes', 'gi', 'eating_disorder', 'none'];

    private function decodeJson(?string $json): array
    {
        $v = json_decode((string)$json, true);
        return is_array($v) ? $v : [];
    }

    /** Текущее состояние анкеты клиента (для экрана онбординга). */
    public function intake(Request $req): array
    {
        $auth = Auth::require($req, 'client');
        $c = Database::one('SELECT * FROM clients WHERE id = ?', [$auth['id']]);
        return [
            'completed'    => !empty($c['intake_completed_at']),
            'name'         => $c['name'],
            'goal'         => $c['goal'],
            'weight_kg'    => $c['weight_kg'],
            'height_cm'    => $c['height_cm'],
            'birth_year'   => $c['birth_year'],
            'sex'          => $c['sex'],
            'activity_level' => $c['activity_level'],
            'allergies'    => $c['allergies'],
            'dietary_prefs' => $c['dietary_prefs'],
            'medical_flags' => $this->decodeJson($c['medical_flags']),
        ];
    }

    /** Клиент заполняет/обновляет анкету. Целевые КБЖУ ставит специалист — здесь их нет. */
    public function submitIntake(Request $req): array
    {
        $auth = Auth::require($req, 'client');
        if ($req->input('sex') !== null && !in_array($req->input('sex'), ['m', 'f'], true)) {
            throw new \App\HttpException('Некорректный пол', 422);
        }
        if ($req->input('activity_level') !== null && $req->input('activity_level') !== ''
            && !in_array($req->input('activity_level'), self::ACTIVITY, true)) {
            throw new \App\HttpException('Некорректная активность', 422);
        }
        $flags = $req->input('medical_flags', []);
        if (!is_array($flags)) $flags = [];
        $flags = array_values(array_intersect($flags, self::MEDICAL));

        Database::exec(
            'UPDATE clients SET goal = ?, weight_kg = ?, height_cm = ?, birth_year = ?, sex = ?,
                    activity_level = ?, allergies = ?, dietary_prefs = ?, medical_flags = ?, intake_completed_at = ?
             WHERE id = ?',
            [
                $req->input('goal'),
                $req->input('weight_kg') !== null && $req->input('weight_kg') !== '' ? (float)$req->input('weight_kg') : null,
                $req->input('height_cm') !== null && $req->input('height_cm') !== '' ? (int)$req->input('height_cm') : null,
                $req->input('birth_year') !== null && $req->input('birth_year') !== '' ? (int)$req->input('birth_year') : null,
                $req->input('sex') ?: null,
                $req->input('activity_level') ?: null,
                $req->input('allergies'),
                $req->input('dietary_prefs'),
                json_encode($flags, JSON_UNESCAPED_UNICODE),
                gmdate('c'),
                $auth['id'],
            ]
        );
        // Первый замер веса заодно в историю.
        if ($req->input('weight_kg')) {
            Database::exec(
                'INSERT INTO weight_logs (client_id, weight_kg, measured_on) VALUES (?, ?, ?)
                 ON CONFLICT(client_id, measured_on) DO UPDATE SET weight_kg = excluded.weight_kg',
                [$auth['id'], (float)$req->input('weight_kg'), date('Y-m-d')]
            );
        }
        return ['ok' => true];
    }

    /** Список опубликованных меню клиента (для «Неделя»/выбора меню). */
    public function menus(Request $req): array
    {
        $auth = Auth::require($req, 'client');
        $menus = Database::all(
            "SELECT id, title, start_date, days_count, status, published_at
             FROM menus WHERE client_id = ? AND status = 'published' ORDER BY start_date DESC, id DESC",
            [$auth['id']]
        );
        return ['items' => $menus];
    }

    /** Активное (последнее опубликованное) меню. */
    public function activeMenu(Request $req): array
    {
        $auth = Auth::require($req, 'client');
        $menu = Database::one(
            "SELECT id FROM menus WHERE client_id = ? AND status = 'published'
             ORDER BY start_date DESC, id DESC LIMIT 1",
            [$auth['id']]
        );
        if (!$menu) {
            return ['menu' => null];
        }
        return (new MenuController())->show($req, ['id' => (int)$menu['id']]);
    }

    /** Прогресс: процент соблюдения меню и краткая статистика. */
    public function progress(Request $req): array
    {
        $auth = Auth::require($req, 'client');

        $counts = Database::one(
            "SELECT
                (SELECT COUNT(*) FROM menu_items mi JOIN menus m ON m.id = mi.menu_id
                 WHERE m.client_id = ? AND m.status = 'published') AS total_items,
                (SELECT COUNT(*) FROM meal_logs WHERE client_id = ? AND status = 'eaten') AS eaten,
                (SELECT COUNT(*) FROM meal_logs WHERE client_id = ? AND status = 'skipped') AS skipped,
                (SELECT COUNT(*) FROM meal_logs WHERE client_id = ? AND status = 'replaced') AS replaced",
            [$auth['id'], $auth['id'], $auth['id'], $auth['id']]
        );

        $logged = (int)$counts['eaten'] + (int)$counts['skipped'] + (int)$counts['replaced'];
        $compliance = $logged > 0 ? round((int)$counts['eaten'] / $logged * 100) : null;

        $client = Database::one('SELECT weight_kg, target_kcal FROM clients WHERE id = ?', [$auth['id']]);
        $weight = Database::all(
            'SELECT weight_kg, measured_on FROM weight_logs WHERE client_id = ? ORDER BY measured_on',
            [$auth['id']]
        );
        // Текущий вес — последний замер, иначе значение из анкеты.
        $currentWeight = !empty($weight) ? (float)end($weight)['weight_kg'] : ($client['weight_kg'] ?? null);

        return [
            'total_items'  => (int)$counts['total_items'],
            'eaten'        => (int)$counts['eaten'],
            'skipped'      => (int)$counts['skipped'],
            'replaced'     => (int)$counts['replaced'],
            'compliance'   => $compliance,       // % съеденного из отмеченного
            'current_weight' => $currentWeight,
            'weight_series'  => $weight,
        ];
    }
}
