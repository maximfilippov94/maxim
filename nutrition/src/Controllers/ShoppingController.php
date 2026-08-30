<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\Repo;
use App\Request;
use App\Services\NutritionCalculator;

/**
 * Список покупок: агрегирует сырьё по всем блюдам меню (или диапазону дней),
 * суммирует по ингредиентам, группирует по категориям.
 */
class ShoppingController extends Controller
{
    public function list(Request $req, array $args): array
    {
        $auth = Auth::require($req);
        $menu = Repo::menuFor((int)$args['id'], $auth);
        if ($auth['type'] === 'client' && $menu['status'] !== 'published') {
            throw new \App\HttpException('Меню недоступно', 403);
        }

        $fromDay = isset($req->query['from_day']) ? (int)$req->query['from_day'] : 1;
        $toDay = isset($req->query['to_day']) ? (int)$req->query['to_day'] : (int)$menu['days_count'];

        $items = Database::all(
            'SELECT * FROM menu_items WHERE menu_id = ? AND day_number BETWEEN ? AND ?',
            [(int)$menu['id'], $fromDay, $toDay]
        );

        $dishCache = [];
        $compCache = [];
        $agg = []; // ingredient_id => [name, category, grams]

        foreach ($items as $item) {
            $did = (int)$item['dish_id'];
            if (!isset($dishCache[$did])) {
                $dishCache[$did] = Repo::dish($did);
                $compCache[$did] = Repo::dishComposition($did);
            }
            $overrides = json_decode((string)$item['overrides'], true);
            $rows = NutritionCalculator::ingredientGrams(
                $dishCache[$did] ?? [], $compCache[$did], (float)$item['portion_g'],
                is_array($overrides) && $overrides ? $overrides : null
            );
            foreach ($rows as $r) {
                $id = $r['ingredient_id'];
                if (!isset($agg[$id])) {
                    $agg[$id] = ['name' => $r['name'], 'category' => $r['category'] ?: 'Прочее', 'grams' => 0.0];
                }
                $agg[$id]['grams'] += $r['grams'];
            }
        }

        // Группировка по категориям.
        $byCat = [];
        foreach ($agg as $id => $a) {
            $cat = $a['category'];
            $byCat[$cat] ??= [];
            $byCat[$cat][] = [
                'ingredient_id' => $id,
                'name' => $a['name'],
                'grams' => round($a['grams'], 1),
                'display' => $this->human($a['grams']),
            ];
        }
        ksort($byCat);
        $groups = [];
        foreach ($byCat as $cat => $list) {
            usort($list, fn($x, $y) => strcmp($x['name'], $y['name']));
            $groups[] = ['category' => $cat, 'items' => $list];
        }

        return [
            'menu_id' => (int)$menu['id'],
            'from_day' => $fromDay,
            'to_day' => $toDay,
            'groups' => $groups,
            'total_items' => count($agg),
        ];
    }

    /** Человекочитаемое количество: граммы или килограммы. */
    private function human(float $grams): string
    {
        $g = round($grams);
        if ($g >= 1000) {
            return rtrim(rtrim(number_format($g / 1000, 2, '.', ''), '0'), '.') . ' кг';
        }
        return $g . ' г';
    }
}
