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
require $root . '/src/Database.php';
require $root . '/src/Repo.php';
require $root . '/src/Services/NutritionCalculator.php';
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
echo "Готово.\n";
