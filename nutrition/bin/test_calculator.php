<?php
declare(strict_types=1);

/**
 * Тесты ядра расчёта КБЖУ. Запуск: php bin/test_calculator.php
 * Без зависимостей — если хоть одна проверка падает, скрипт выходит с кодом 1.
 */

require dirname(__DIR__) . '/src/Services/NutritionCalculator.php';

use App\Services\NutritionCalculator;

$failed = 0;
$passed = 0;

function check(string $name, $expected, $actual): void
{
    global $failed, $passed;
    $ok = (abs((float)$expected - (float)$actual) < 0.05);
    if ($ok) {
        $passed++;
        echo "  ✓ $name\n";
    } else {
        $failed++;
        echo "  ✗ $name: ожидалось $expected, получено $actual\n";
    }
}

// Состав: рис 80г (cooked 2.5), курица 150г (cooked 0.68), масло 5г.
$composition = [
    ['ingredient_id' => 1, 'kcal' => 344, 'protein' => 6.7,  'fat' => 0.7,  'carbs' => 78.9, 'fiber' => 1.4, 'cooked_ratio' => 2.5, 'grams' => 80],
    ['ingredient_id' => 2, 'kcal' => 113, 'protein' => 23.6, 'fat' => 1.9,  'carbs' => 0.4,  'fiber' => 0,   'cooked_ratio' => 0.68, 'grams' => 150],
    ['ingredient_id' => 3, 'kcal' => 884, 'protein' => 0,    'fat' => 100,  'carbs' => 0,    'fiber' => 0,   'cooked_ratio' => 1.0, 'grams' => 5],
];

echo "1. Состав блюда (сумма по 100 г):\n";
$c = NutritionCalculator::composition($composition);
// рис: 344*0.8=275.2 ; курица: 113*1.5=169.5 ; масло: 884*0.05=44.2 => 488.9
check('kcal', 488.9, $c['kcal']);
check('protein', 6.7 * 0.8 + 23.6 * 1.5, $c['protein']);           // 5.36+35.4=40.76
check('raw_weight', 235, $c['raw_weight']);                        // 80+150+5
check('cooked_weight', 80 * 2.5 + 150 * 0.68 + 5, $c['cooked_weight']); // 200+102+5=307

echo "2. Кэш блюда (на 100 г готового):\n";
$cache = NutritionCalculator::dishCache($composition);
check('base_portion_g', 307, $cache['base_portion_g']);
check('kcal_100', 488.9 / 307 * 100, $cache['kcal_100']);

echo "3. Порция масштабируется от базовой (k = portion/base):\n";
$dish = ['base_portion_g' => 307];
// Порция 614 г = 2x базовой => КБЖУ x2.
$item = NutritionCalculator::menuItem($dish, $composition, 614.0, null);
check('kcal x2', 488.9 * 2, $item['kcal']);
check('portion_g', 614, $item['portion_g']);

// Половинная порция.
$half = NutritionCalculator::menuItem($dish, $composition, 153.5, null);
check('kcal x0.5', round(488.9 * 0.5, 1), $half['kcal']);

echo "4. Overrides — пересчёт по составу, коэффициент НЕ применяется:\n";
// Заменяем рис на 40 г. Итог = рис40 + курица150 + масло5 (сырьё).
$ov = NutritionCalculator::menuItem($dish, $composition, 999, ['1' => 40]);
$expectedKcal = 344 * 0.4 + 113 * 1.5 + 884 * 0.05; // 137.6+169.5+44.2=351.3
check('kcal с override', $expectedKcal, $ov['kcal']);
check('portion_g = raw sum (без cooked_ratio)', 40 + 150 + 5, $ov['portion_g']);

echo "5. Итоги дня и отклонение от цели:\n";
$day = NutritionCalculator::dayTotals(
    [$item, $half],
    ['target_kcal' => 1500, 'target_protein' => 100]
);
check('day kcal', $item['kcal'] + $half['kcal'], $day['totals']['kcal']);
check('deviation kcal', ($item['kcal'] + $half['kcal']) - 1500, $day['deviation']['kcal']);

echo "6. Пустой состав не делит на ноль:\n";
$empty = NutritionCalculator::dishCache([]);
check('base_portion_g = 0', 0, $empty['base_portion_g']);
check('kcal_100 = 0', 0, $empty['kcal_100']);

echo "\n";
echo "Пройдено: $passed, провалено: $failed\n";
exit($failed === 0 ? 0 : 1);
