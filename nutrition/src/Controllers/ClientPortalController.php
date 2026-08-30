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
