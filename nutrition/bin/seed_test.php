<?php
declare(strict_types=1);

/**
 * Готовые тестовые аккаунты и реалистичные данные для пользовательского теста MVP.
 * Идемпотентно: если тестовый нутрициолог уже есть — выходим.
 * Запуск (после migrate.php и seed.php): php bin/seed_test.php
 *
 *   Нутрициолог: nutritionist@test.com / 123456
 *   Клиент:      client@test.com / 123456
 *   Админ:       admin@test.com / 123456
 */

$root = dirname(__DIR__);
require_once $root . '/src/Database.php';
require_once $root . '/src/Repo.php';
require_once $root . '/src/Services/NutritionCalculator.php';
$config = require $root . '/config.php';

use App\Database;

Database::init($config['db_path']);
$now = gmdate('c');
function tago(int $days): string { return gmdate('c', time() - $days * 86400); }
function tpick(array $a) { return $a[array_rand($a)]; }

// ---------- Админ ----------
if (!Database::one('SELECT id FROM admins WHERE email = ?', ['admin@test.com'])) {
    Database::insert('INSERT INTO admins (email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)',
        ['admin@test.com', password_hash('123456', PASSWORD_DEFAULT), 'Тест Владелец', 'owner', $now]);
    echo "Админ: admin@test.com / 123456\n";
}

if (Database::one('SELECT id FROM specialists WHERE email = ?', ['nutritionist@test.com'])) {
    echo "Тестовые данные уже созданы. Пропускаю.\n";
    return;
}

// ---------- Нутрициолог ----------
$specId = Database::insert(
    'INSERT INTO specialists (email, password_hash, name, phone, plan, plan_expires_at, created_at,
        specialization, city, experience_years, price_from, slug, is_listed, verified, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['nutritionist@test.com', password_hash('123456', PASSWORD_DEFAULT), 'Елена Кузнецова', '+7 900 000-00-00',
     'business', gmdate('c', time() + 30 * 86400), tago(120),
     'Снижение веса · пищевые привычки', 'Москва', 7, 3000, 'elena-kuznecova', 1, 1, $now]);
echo "Нутрициолог: nutritionist@test.com / 123456 (id=$specId)\n";

// ---------- Дишиз по типам приёма ----------
function dishesFor(string $meal): array {
    $rows = Database::all("SELECT id, base_portion_g FROM dishes WHERE meal_types LIKE ? ORDER BY RANDOM()", ['%"' . $meal . '"%']);
    return $rows;
}
$pool = [
    'breakfast' => dishesFor('breakfast'),
    'snack1'    => dishesFor('snack1'),
    'lunch'     => dishesFor('lunch'),
    'snack2'    => dishesFor('snack2'),
    'dinner'    => dishesFor('dinner'),
];
function pickDish(array $pool, string $meal, int $i): array {
    $list = $pool[$meal];
    if (!$list) $list = $pool['lunch'];
    return $list[$i % count($list)];
}

/**
 * Создаёт опубликованное меню на 7 дней для клиента.
 * $startOffset — за сколько дней до сегодня начинается меню (для управления
 * датой окончания в сценариях «Требуют внимания»). Возвращает [menuId, itemsDay1].
 */
function makePublishedMenu(int $clientId, int $specId, array $pool, int $startOffset): array {
    $now = gmdate('c');
    $menuId = Database::insert(
        'INSERT INTO menus (client_id, specialist_id, title, start_date, days_count, status, published_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [$clientId, $specId, 'Меню на неделю', date('Y-m-d', time() - $startOffset * 86400), 7, 'published', $now, $now]
    );
    $mealPlan = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];
    $day1 = [];
    for ($d = 1; $d <= 7; $d++) {
        $sort = 0;
        foreach ($mealPlan as $mt) {
            if ($mt === 'snack2' && $d % 2 === 0) continue;
            $dish = pickDish($pool, $mt, $d + $sort);
            $portion = (float)($dish['base_portion_g'] ?: 200);
            $iid = Database::insert(
                'INSERT INTO menu_items (menu_id, day_number, meal_type, dish_id, portion_g, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?)',
                [$menuId, $d, $mt, (int)$dish['id'], $portion, $sort++]
            );
            if ($d === 1) $day1[$mt] = $iid;
        }
    }
    return [$menuId, $day1];
}

// ---------- Клиенты ----------
$fnamesF = ['Анна','Мария','Ольга','Ирина','Наталья','Татьяна','Екатерина','Юлия','Виктория'];
$lnamesF = ['Смирнова','Иванова','Петрова','Соколова','Попова','Лебедева','Козлова','Новикова','Морозова'];
$goals = ['Снижение веса','Поддержание формы','Здоровое питание','Коррекция питания','Набор мышечной массы'];

$clientIds = [];
for ($i = 0; $i < 10; $i++) {
    $isMain = ($i === 0);
    $name = $isMain ? 'Анна Смирнова' : (tpick($fnamesF) . ' ' . tpick($lnamesF));
    $email = $isMain ? 'client@test.com' : null;
    $pass = $isMain ? password_hash('123456', PASSWORD_DEFAULT) : null;
    $weight = [58, 62, 65, 70, 72, 75, 80, 68, 63, 90][$i];
    $tk = [1600, 1700, 1800, 1500, 2000, 1900, 2100, 1750, 1650, 2200][$i];

    $cid = Database::insert(
        'INSERT INTO clients (specialist_id, name, email, password_hash, invite_token, sex, birth_year, height_cm, weight_kg,
            activity_level, goal, target_kcal, target_protein, target_fat, target_carbs, allergies, dietary_prefs,
            medical_flags, notes, status, created_at, last_active_at, intake_completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $specId, $name, $email, $pass, bin2hex(random_bytes(16)),
            'f', 1985 + $i, 165 + ($i % 6), $weight, tpick(['low', 'medium', 'high']),
            tpick($goals), $tk, round($tk * 0.075, 0), round($tk * 0.033, 0), round($tk * 0.11, 0),
            $isMain ? 'Орехи' : null, $isMain ? 'Без свинины' : null,
            json_encode($isMain ? [] : [], JSON_UNESCAPED_UNICODE), null,
            'active', tago(90 - $i * 5), tago($i), tago(80 - $i * 5),
        ]
    );
    $clientIds[] = ['id' => $cid, 'main' => $isMain, 'weight' => $weight, 'tk' => $tk];
}
echo "Клиентов: " . count($clientIds) . " (client@test.com — Анна Смирнова)\n";

$main = $clientIds[0];
$mainId = $main['id'];

// ---------- Меню на 7 дней для главного клиента ----------
$menuId = Database::insert(
    'INSERT INTO menus (client_id, specialist_id, title, start_date, days_count, status, published_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [$mainId, $specId, 'Меню на неделю', date('Y-m-d', strtotime('monday this week')), 7, 'published', $now, $now]
);
$mealPlan = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];
$firstDayItemIds = [];
for ($d = 1; $d <= 7; $d++) {
    $sort = 0;
    foreach ($mealPlan as $mt) {
        // Полдник не каждый день — для разнообразия
        if ($mt === 'snack2' && $d % 2 === 0) continue;
        $dish = pickDish($pool, $mt, $d + $sort);
        $portion = (float)($dish['base_portion_g'] ?: 200);
        $iid = Database::insert(
            'INSERT INTO menu_items (menu_id, day_number, meal_type, dish_id, portion_g, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$menuId, $d, $mt, (int)$dish['id'], $portion, $sort++]
        );
        if ($d === 1) $firstDayItemIds[$mt] = $iid;
    }
}
echo "Меню: 7 дней (id=$menuId), опубликовано\n";

// ---------- Отметки съеденного (день 1) ----------
if (isset($firstDayItemIds['breakfast'])) {
    Database::insert('INSERT INTO meal_logs (menu_item_id, client_id, status, logged_at) VALUES (?, ?, ?, ?)',
        [$firstDayItemIds['breakfast'], $mainId, 'eaten', tago(0)]);
}
if (isset($firstDayItemIds['lunch'])) {
    Database::insert('INSERT INTO meal_logs (menu_item_id, client_id, status, logged_at) VALUES (?, ?, ?, ?)',
        [$firstDayItemIds['lunch'], $mainId, 'eaten', tago(0)]);
}
if (isset($firstDayItemIds['snack1'])) {
    Database::insert('INSERT INTO meal_logs (menu_item_id, client_id, status, logged_at) VALUES (?, ?, ?, ?)',
        [$firstDayItemIds['snack1'], $mainId, 'skipped', tago(0)]);
}

// ---------- История веса главного клиента ----------
$w = 74.2;
for ($i = 8; $i >= 0; $i--) {
    Database::exec('INSERT OR IGNORE INTO weight_logs (client_id, weight_kg, measured_on) VALUES (?, ?, ?)',
        [$mainId, round($w, 1), date('Y-m-d', time() - $i * 7 * 86400)]);
    $w -= (0.2 + mt_rand(0, 5) / 10); // плавное снижение
}

// ---------- Чат ----------
$msgs = [
    ['specialist', 'Здравствуйте, Анна! Составила для вас меню на неделю. Посмотрите, всё ли подходит.'],
    ['client', 'Спасибо большое! Всё выглядит отлично, попробую сегодня.'],
    ['specialist', 'Отлично! Отмечайте, что съели, чтобы я видела ваш прогресс.'],
    ['client', 'Хорошо! А можно заменить рыбу на курицу в четверг?'],
    ['specialist', 'Конечно, без проблем. Обновлю меню сегодня вечером.'],
];
$t = time() - 3 * 86400;
foreach ($msgs as [$who, $body]) {
    Database::insert('INSERT INTO messages (client_id, author_type, body, read_at, created_at) VALUES (?, ?, ?, ?, ?)',
        [$mainId, $who, $body, gmdate('c', $t + 60), gmdate('c', $t)]);
    $t += 3600;
}
echo "Вес: 9 замеров, чат: " . count($msgs) . " сообщений\n";

// ---------- Разные сценарии «Требуют внимания» для демо ----------
// Каждому клиенту — свой правдоподобный статус, чтобы движок внимания и
// список клиентов выглядели как реальная рабочая база.
$logMeal = function (array $day1, int $clientId, int $daysAgo, string $status = 'eaten') {
    $iid = $day1['breakfast'] ?? reset($day1);
    if ($iid) {
        Database::insert('INSERT INTO meal_logs (menu_item_id, client_id, status, logged_at) VALUES (?, ?, ?, ?)',
            [$iid, $clientId, $status, tago($daysAgo)]);
    }
};
$addWeight = function (int $clientId, float $kg, int $daysAgo) {
    Database::exec('INSERT OR IGNORE INTO weight_logs (client_id, weight_kg, measured_on) VALUES (?, ?, ?)',
        [$clientId, round($kg, 1), date('Y-m-d', time() - $daysAgo * 86400)]);
};

// Сценарий 1: меню заканчивается завтра + давно не отмечал питание.
if (isset($clientIds[1])) {
    $cid = $clientIds[1]['id'];
    [$mid, $d1] = makePublishedMenu($cid, $specId, $pool, 5); // start = -5д → конец завтра
    $logMeal($d1, $cid, 4);
    $addWeight($cid, 71.5, 3); $addWeight($cid, 72.3, 10);
}
// Сценарий 2: вес стоит на месте (последний замер 6 дней назад).
if (isset($clientIds[2])) {
    $cid = $clientIds[2]['id'];
    [$mid, $d1] = makePublishedMenu($cid, $specId, $pool, 2);
    $logMeal($d1, $cid, 0);
    $addWeight($cid, 68.1, 6); $addWeight($cid, 68.0, 13); $addWeight($cid, 68.2, 20);
}
// Сценарий 3: давно не вносил вес (последний замер 12 дней назад).
if (isset($clientIds[3])) {
    $cid = $clientIds[3]['id'];
    [$mid, $d1] = makePublishedMenu($cid, $specId, $pool, 1);
    $logMeal($d1, $cid, 1);
    $addWeight($cid, 79.4, 12); $addWeight($cid, 80.2, 19);
}
// Сценарий 4: новое сообщение от клиента (непрочитанное).
if (isset($clientIds[4])) {
    $cid = $clientIds[4]['id'];
    [$mid, $d1] = makePublishedMenu($cid, $specId, $pool, 3);
    $logMeal($d1, $cid, 0);
    $addWeight($cid, 64.8, 2); $addWeight($cid, 65.6, 9);
    Database::insert('INSERT INTO messages (client_id, author_type, body, read_at, created_at) VALUES (?, ?, ?, ?, ?)',
        [$cid, 'client', 'Здравствуйте! Можно заменить курицу на индейку?', null, tago(0)]);
}
// Сценарий 5: всё в норме — свежее меню, отметки и вес есть.
if (isset($clientIds[5])) {
    $cid = $clientIds[5]['id'];
    [$mid, $d1] = makePublishedMenu($cid, $specId, $pool, 2);
    $logMeal($d1, $cid, 0);
    $addWeight($cid, 74.1, 1); $addWeight($cid, 75.0, 8);
}
echo "Сценарии внимания: клиенты 2–6 наполнены (меню/вес/питание/сообщение)\n";

// ---------- Избранные блюда специалиста ----------
if (Database::one("SELECT name FROM sqlite_master WHERE type='table' AND name='dish_favorites'")) {
    $favDishes = Database::all('SELECT id FROM dishes WHERE is_public = 1 ORDER BY RANDOM() LIMIT 6');
    foreach ($favDishes as $fd) {
        Database::exec('INSERT OR IGNORE INTO dish_favorites (specialist_id, dish_id, created_at) VALUES (?, ?, ?)',
            [$specId, (int)$fd['id'], $now]);
    }
    echo "Избранных блюд: " . count($favDishes) . "\n";
}
echo "Готово.\n";
