<?php
declare(strict_types=1);

/**
 * Демо-данные для админ-панели: тарифы, владелец, ~32 нутрициолога,
 * ~130 клиентов, платежи за полгода, обращения в поддержку, отзывы.
 * Идемпотентно: повторный запуск не плодит дубликаты (сверяет по маркеру).
 * Запуск: php bin/seed_admin.php
 */

$root = dirname(__DIR__);
require_once $root . '/src/Database.php';
$config = require $root . '/config.php';

use App\Database;

Database::init($config['db_path']);
$now = gmdate('c');
function ago(int $days, int $secJitter = 86400): string { return gmdate('c', time() - $days * 86400 - random_int(0, $secJitter)); }
function pick(array $a) { return $a[array_rand($a)]; }

// ---------- Тарифы ----------
$plans = [
    ['trial',      'Trial',      0,  'trial', 5,    50,   ['База блюд', '1 клиент демо', '14 дней'], 0],
    ['pro',        'Pro',        29, 'month', 30,   500,  ['До 30 клиентов', 'Конструктор меню', 'Чат', 'Экспорт PDF'], 1],
    ['business',   'Business',   59, 'month', 100,  2000, ['До 100 клиентов', 'Все функции Pro', 'Аналитика', 'Приоритетная поддержка'], 2],
    ['enterprise', 'Enterprise', 99, 'month', null, null, ['Без лимитов', 'Все функции', 'API', 'Персональный менеджер'], 3],
];
foreach ($plans as [$code, $name, $price, $period, $cl, $dl, $feat, $sort]) {
    $exists = Database::one('SELECT code FROM plans WHERE code = ?', [$code]);
    if (!$exists) {
        Database::insert(
            'INSERT INTO plans (code, name, price, period, client_limit, dish_limit, features, is_active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
            [$code, $name, $price, $period, $cl, $dl, json_encode($feat, JSON_UNESCAPED_UNICODE), $sort]
        );
    }
}
$planPrice = ['trial' => 0, 'pro' => 29, 'business' => 59, 'enterprise' => 99];

// ---------- Владелец ----------
if (!Database::one('SELECT id FROM admins LIMIT 1')) {
    Database::insert(
        'INSERT INTO admins (email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)',
        ['owner@nutrimenu.app', password_hash('admin123', PASSWORD_DEFAULT), 'Максим Филиппов', 'owner', $now]
    );
    echo "Владелец: owner@nutrimenu.app / admin123\n";
}

// Маркер: если демо-платежи уже есть — не пересоздаём массив демо-данных.
if (Database::one('SELECT id FROM payments LIMIT 1')) {
    echo "Демо-данные уже созданы. Пропускаю.\n";
    return;
}

// ---------- Имена ----------
$fnamesF = ['Елена','Анна','Мария','Ольга','Ирина','Наталья','Татьяна','Екатерина','Светлана','Юлия','Виктория','Дарья','Полина','Ксения','Алина','Марина'];
$fnamesM = ['Дмитрий','Иван','Сергей','Александр','Андрей','Максим','Алексей','Михаил','Николай','Павел','Роман','Егор','Артём','Владимир'];
$lnamesF = ['Кузнецова','Смирнова','Иванова','Петрова','Соколова','Попова','Лебедева','Козлова','Новикова','Морозова','Волкова','Соловьёва','Васильева','Зайцева','Павлова','Семёнова'];
$lnamesM = ['Кузнецов','Смирнов','Иванов','Петров','Соколов','Попов','Лебедев','Козлов','Новиков','Морозов','Волков','Соловьёв','Васильев','Зайцев','Павлов','Семёнов'];
$specs = ['Снижение веса, ЖКТ','Спортивное питание','Детская нутрициология','Пищевые привычки','Набор массы','Вегетарианство','Эндокринология','Здоровое питание','Коррекция веса','Спорт и восстановление'];
$cities = ['Москва','Санкт-Петербург','Екатеринбург','Новосибирск','Казань','Краснодар','Нижний Новгород','Самара'];
$goals = ['Снижение веса','Набор массы','Поддержание формы','Здоровое питание','Коррекция ЖКТ','Спортивная форма','Энергия и сон'];

$transTable = ['а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh','з'=>'z','и'=>'i','й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ф'=>'f','х'=>'h','ц'=>'ts','ч'=>'ch','ш'=>'sh','щ'=>'sch','ъ'=>'','ы'=>'y','ь'=>'','э'=>'e','ю'=>'yu','я'=>'ya'];
function translit(string $s, array $t): string {
    $s = mb_strtolower($s); $out = '';
    for ($i = 0; $i < mb_strlen($s); $i++) { $c = mb_substr($s, $i, 1); $out .= $t[$c] ?? (preg_match('/[a-z0-9]/', $c) ? $c : ''); }
    return $out;
}

// ---------- Нутрициологи ----------
$planDist = array_merge(array_fill(0, 3, 'trial'), array_fill(0, 12, 'pro'), array_fill(0, 10, 'business'), array_fill(0, 5, 'enterprise'));
$specialistIds = [];
$usedEmails = [];
$n = 30;
for ($i = 0; $i < $n; $i++) {
    $female = random_int(0, 3) > 0; // больше женщин в профессии
    $fn = $female ? pick($fnamesF) : pick($fnamesM);
    $ln = $female ? pick($lnamesF) : pick($lnamesM);
    $name = "$fn $ln";
    $slugBase = translit($fn . '-' . $ln, $transTable);
    $email = translit($fn, $transTable) . '.' . translit($ln, $transTable) . random_int(1, 99) . '@example.com';
    while (isset($usedEmails[$email])) { $email = translit($fn, $transTable) . random_int(100, 999) . '@example.com'; }
    $usedEmails[$email] = true;

    $plan = $planDist[$i % count($planDist)];
    $regDays = random_int(15, 360);
    $blocked = (random_int(0, 20) === 0);
    $listed = random_int(0, 1);
    $expires = gmdate('c', time() + random_int(-10, 40) * 86400); // часть просрочена

    $id = Database::insert(
        'INSERT INTO specialists (email, password_hash, name, phone, plan, plan_expires_at, created_at,
             specialization, city, experience_years, price_from, slug, is_listed, verified, featured,
             blocked_at, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $email, password_hash('demo1234', PASSWORD_DEFAULT), $name, null,
            $plan, $expires, ago($regDays),
            pick($specs), pick($cities), random_int(2, 15), pick([2000, 3000, 4000, 5000]),
            $slugBase . random_int(1, 999), $listed, random_int(0, 2) === 0 ? 1 : 0, random_int(0, 4) === 0 ? 1 : 0,
            $blocked ? ago(random_int(1, 20)) : null, ago(0, random_int(60, 90) * 60),
        ]
    );
    $specialistIds[] = ['id' => $id, 'plan' => $plan, 'reg_days' => $regDays, 'blocked' => $blocked];
}
echo "Нутрициологов: " . count($specialistIds) . "\n";

// ---------- Клиенты ----------
$clientCount = 0;
foreach ($specialistIds as $s) {
    $howMany = random_int(2, 8);
    for ($c = 0; $c < $howMany; $c++) {
        $female = random_int(0, 1) === 1;
        $name = ($female ? pick($fnamesF) : pick($fnamesM)) . ' ' . ($female ? pick($lnamesF) : pick($lnamesM));
        Database::insert(
            'INSERT INTO clients (specialist_id, name, goal, weight_kg, activity_level, status, created_at, last_active_at, intake_completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $s['id'], $name, pick($goals), random_int(52, 105) + 0.0, pick(['low', 'medium', 'high']),
                'active', ago(random_int(1, min($s['reg_days'], 200))), ago(random_int(0, 30), 43200),
                random_int(0, 3) > 0 ? ago(random_int(0, 30)) : null,
            ]
        );
        $clientCount++;
    }
}
echo "Клиентов: $clientCount\n";

// ---------- Платежи (последние 6 месяцев) ----------
$payCount = 0;
$methods = ['card', 'card', 'card', 'invoice'];
foreach ($specialistIds as $s) {
    if ($s['plan'] === 'trial') continue;
    $price = $planPrice[$s['plan']];
    $months = min(6, (int)floor($s['reg_days'] / 30) + 1);
    for ($m = 0; $m < $months; $m++) {
        $roll = random_int(1, 100);
        $status = $roll <= 88 ? 'paid' : ($roll <= 93 ? 'failed' : ($roll <= 97 ? 'pending' : 'refunded'));
        if ($s['blocked'] && $m === 0) $status = 'failed';
        Database::insert(
            'INSERT INTO payments (specialist_id, plan_code, amount, currency, status, method, external_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$s['id'], $s['plan'], $price, 'EUR', $status, pick($methods), 'pi_' . bin2hex(random_bytes(6)), ago($m * 30 + random_int(0, 6))]
        );
        $payCount++;
    }
}
echo "Платежей: $payCount\n";

// ---------- Поддержка ----------
$subjects = ['Не могу создать меню', 'Вопрос по оплате', 'Ошибка в расчёте КБЖУ', 'Подключение тарифа', 'Проблема с чатом', 'Не приходит инвайт клиенту', 'Как экспортировать меню?', 'Вопрос по возврату', 'Не сохраняется блюдо', 'Забыл пароль'];
$statuses = ['new', 'new', 'in_progress', 'in_progress', 'waiting', 'resolved', 'resolved'];
$ticketCount = 0;
for ($i = 0; $i < 22; $i++) {
    $s = pick($specialistIds);
    $spec = Database::one('SELECT name FROM specialists WHERE id = ?', [$s['id']]);
    $created = ago(random_int(0, 20), 43200);
    Database::insert(
        'INSERT INTO support_tickets (user_type, user_id, user_name, subject, channel, priority, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['specialist', $s['id'], $spec['name'], pick($subjects), pick(['email', 'chat', 'email']), pick(['low', 'normal', 'normal', 'high']), pick($statuses), $created, $created]
    );
    $ticketCount++;
}
echo "Обращений: $ticketCount\n";

// ---------- Отзывы ----------
$reviewBodies = ['Отличный специалист, меню разнообразное!', 'Помогла наладить питание без жёстких ограничений.', 'Внимательный подход, всё чётко и по делу.', 'Результат уже через месяц, очень довольна.', 'Удобно отмечать съеденное в приложении.', 'Рекомендую, профессионал своего дела.'];
$revCount = 0;
foreach ($specialistIds as $s) {
    if (random_int(0, 2) === 0) continue;
    $clients = Database::all('SELECT id FROM clients WHERE specialist_id = ? LIMIT 3', [$s['id']]);
    foreach ($clients as $cl) {
        if (random_int(0, 1) === 0) continue;
        Database::exec(
            'INSERT OR IGNORE INTO reviews (specialist_id, client_id, rating, body, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$s['id'], (int)$cl['id'], random_int(4, 5), pick($reviewBodies), 'published', ago(random_int(0, 60))]
        );
        $revCount++;
    }
}
echo "Отзывов: $revCount\n";
echo "Готово.\n";
