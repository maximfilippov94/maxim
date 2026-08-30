<?php
namespace App\Services;

/**
 * Ядро расчёта КБЖУ. Единственное место, где рождаются ошибки — поэтому
 * логика собрана здесь, покрыта тестами и вызывается ТОЛЬКО на бэке.
 *
 * Жёсткие правила (см. ТЗ, раздел 4):
 *  1. КБЖУ ингредиента — всегда на 100 г СЫРОГО продукта.
 *  2. КБЖУ блюда = сумма по составу. Базовый вес порции = сумма граммов
 *     состава с учётом cooked_ratio (готовый вес блюда).
 *  3. Порция масштабируется от базовой: k = portion_g / base_portion_g.
 *  4. Если есть overrides — пересчёт по составу с заменёнными граммовками,
 *     коэффициент масштабирования НЕ применяется.
 */
class NutritionCalculator
{
    private const MACROS = ['kcal', 'protein', 'fat', 'carbs', 'fiber'];

    /**
     * Суммирует КБЖУ по составу (сырые граммы).
     *
     * @param array $rows Каждый элемент: [
     *     'kcal','protein','fat','carbs','fiber' — на 100 г сырого,
     *     'cooked_ratio' — коэффициент готового веса,
     *     'grams' — сырой вес в блюде
     *   ]
     * @return array{kcal:float,protein:float,fat:float,carbs:float,fiber:float,
     *               raw_weight:float,cooked_weight:float}
     */
    public static function composition(array $rows): array
    {
        $totals = ['kcal' => 0.0, 'protein' => 0.0, 'fat' => 0.0, 'carbs' => 0.0, 'fiber' => 0.0];
        $rawWeight = 0.0;
        $cookedWeight = 0.0;

        foreach ($rows as $row) {
            $grams = (float)($row['grams'] ?? 0);
            $factor = $grams / 100.0;                       // КБЖУ даны на 100 г
            foreach (self::MACROS as $m) {
                $totals[$m] += (float)($row[$m] ?? 0) * $factor;
            }
            $ratio = (float)($row['cooked_ratio'] ?? 1.0);
            if ($ratio <= 0) {
                $ratio = 1.0;
            }
            $rawWeight    += $grams;
            $cookedWeight += $grams * $ratio;
        }

        $totals['raw_weight']    = self::round($rawWeight);
        $totals['cooked_weight'] = self::round($cookedWeight);
        foreach (self::MACROS as $m) {
            $totals[$m] = self::round($totals[$m]);
        }
        return $totals;
    }

    /**
     * Пересчитывает кэш блюда: КБЖУ на 100 г готового блюда + базовый вес порции.
     *
     * @return array{base_portion_g:float,kcal_100:float,protein_100:float,
     *               fat_100:float,carbs_100:float,totals:array}
     */
    public static function dishCache(array $compositionRows): array
    {
        $totals = self::composition($compositionRows);
        $cooked = $totals['cooked_weight'];

        $per100 = ['kcal_100' => 0.0, 'protein_100' => 0.0, 'fat_100' => 0.0, 'carbs_100' => 0.0];
        if ($cooked > 0) {
            $per100['kcal_100']    = self::round($totals['kcal']    / $cooked * 100);
            $per100['protein_100'] = self::round($totals['protein'] / $cooked * 100);
            $per100['fat_100']     = self::round($totals['fat']     / $cooked * 100);
            $per100['carbs_100']   = self::round($totals['carbs']   / $cooked * 100);
        }

        return array_merge([
            'base_portion_g' => $cooked,
            'totals'         => $totals,
        ], $per100);
    }

    /**
     * КБЖУ одного пункта меню.
     *
     * @param array $dish            Строка блюда (кэш base_portion_g и т.п.)
     * @param array $compositionRows Состав блюда (см. composition())
     * @param float $portionG        Итоговая граммовка порции
     * @param array|null $overrides  ['ingredient_id' => grams] или null
     *
     * @return array{kcal:float,protein:float,fat:float,carbs:float,fiber:float,portion_g:float}
     */
    public static function menuItem(array $dish, array $compositionRows, float $portionG, ?array $overrides = null): array
    {
        // Режим точечной правки состава: пересчёт по заменённым граммовкам,
        // масштабирование k не применяется.
        if (!empty($overrides)) {
            $rows = [];
            foreach ($compositionRows as $row) {
                $iid = (string)($row['ingredient_id'] ?? '');
                if ($iid !== '' && array_key_exists($iid, $overrides)) {
                    $row['grams'] = (float)$overrides[$iid];
                }
                $rows[] = $row;
            }
            $t = self::composition($rows);
            return [
                'kcal'      => $t['kcal'],
                'protein'   => $t['protein'],
                'fat'       => $t['fat'],
                'carbs'     => $t['carbs'],
                'fiber'     => $t['fiber'],
                // Коэффициент (ни k, ни cooked_ratio) не применяется —
                // порция равна сумме заданных сырых граммовок состава.
                'portion_g' => $t['raw_weight'],
            ];
        }

        // Обычный режим: масштабирование от базовой порции.
        $base = (float)($dish['base_portion_g'] ?? 0);
        if ($base <= 0) {
            // fallback: пересчитать из состава
            $cache = self::dishCache($compositionRows);
            $base = (float)$cache['base_portion_g'];
            $whole = $cache['totals'];
        } else {
            $whole = self::composition($compositionRows);
        }

        $k = $base > 0 ? $portionG / $base : 0.0;

        return [
            'kcal'      => self::round($whole['kcal']    * $k),
            'protein'   => self::round($whole['protein'] * $k),
            'fat'       => self::round($whole['fat']     * $k),
            'carbs'     => self::round($whole['carbs']   * $k),
            'fiber'     => self::round($whole['fiber']   * $k),
            'portion_g' => self::round($portionG),
        ];
    }

    /**
     * Итоги дня — сумма по пунктам, плюс отклонение от цели клиента.
     *
     * @param array $itemNutritions Массив результатов menuItem()
     * @param array $targets ['target_kcal','target_protein','target_fat','target_carbs']
     */
    public static function dayTotals(array $itemNutritions, array $targets = []): array
    {
        $sum = ['kcal' => 0.0, 'protein' => 0.0, 'fat' => 0.0, 'carbs' => 0.0, 'fiber' => 0.0];
        foreach ($itemNutritions as $n) {
            foreach ($sum as $m => $_) {
                $sum[$m] += (float)($n[$m] ?? 0);
            }
        }
        foreach ($sum as $m => $v) {
            $sum[$m] = self::round($v);
        }

        $deviation = null;
        if (!empty($targets)) {
            $deviation = [
                'kcal'    => self::deviation($sum['kcal'],    $targets['target_kcal']    ?? null),
                'protein' => self::deviation($sum['protein'], $targets['target_protein'] ?? null),
                'fat'     => self::deviation($sum['fat'],     $targets['target_fat']     ?? null),
                'carbs'   => self::deviation($sum['carbs'],   $targets['target_carbs']   ?? null),
            ];
        }

        return ['totals' => $sum, 'deviation' => $deviation];
    }

    /**
     * Разложение пункта меню по ингредиентам в СЫРЫХ граммах (для списка покупок).
     * В обычном режиме граммовки состава масштабируются на k = portion/base.
     * В режиме overrides — берутся заданные граммовки (коэффициент не применяется).
     *
     * @return array список [ingredient_id, name, category, grams]
     */
    public static function ingredientGrams(array $dish, array $compositionRows, float $portionG, ?array $overrides = null): array
    {
        $out = [];
        if (!empty($overrides)) {
            foreach ($compositionRows as $row) {
                $iid = (string)($row['ingredient_id'] ?? '');
                $grams = ($iid !== '' && array_key_exists($iid, $overrides))
                    ? (float)$overrides[$iid] : (float)($row['grams'] ?? 0);
                $out[] = self::gramRow($row, $grams);
            }
            return $out;
        }

        $base = (float)($dish['base_portion_g'] ?? 0);
        if ($base <= 0) {
            $base = self::composition($compositionRows)['cooked_weight'];
        }
        $k = $base > 0 ? $portionG / $base : 0.0;
        foreach ($compositionRows as $row) {
            $out[] = self::gramRow($row, (float)($row['grams'] ?? 0) * $k);
        }
        return $out;
    }

    private static function gramRow(array $row, float $grams): array
    {
        return [
            'ingredient_id' => (int)($row['ingredient_id'] ?? 0),
            'name'          => $row['name'] ?? '',
            'category'      => $row['category'] ?? null,
            'grams'         => self::round($grams),
        ];
    }

    private static function deviation(float $actual, mixed $target): ?float
    {
        if ($target === null || $target === '') {
            return null;
        }
        return self::round($actual - (float)$target);
    }

    private static function round(float $v): float
    {
        return round($v, 1);
    }
}
