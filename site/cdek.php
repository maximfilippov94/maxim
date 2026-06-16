<?php
/**
 * cdek.php — LUKA OUTDOOR
 * Прокси для СДЭК API v2
 * Загрузи в корень сайта рядом с index.php
 */
require __DIR__ . '/includes/db.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$action = $_GET['action'] ?? '';

$clientId     = setting('cdek_client_id');
$clientSecret = setting('cdek_client_secret');

if (!$clientId || !$clientSecret) {
    echo json_encode(['error' => 'CDEK API не настроен']);
    exit;
}

// ── Получаем токен (кешируем в БД) ────────────────────────────────────
function cdek_token(string $clientId, string $clientSecret): string {
    $pdo = db();
    // Проверяем кеш
    try {
        $st = $pdo->prepare("SELECT value FROM settings WHERE key='cdek_token_cache'");
        $st->execute();
        $cached = $st->fetchColumn();
        if ($cached) {
            $data = json_decode($cached, true);
            if ($data && $data['expires'] > time() + 60) {
                return $data['token'];
            }
        }
    } catch (Exception $e) {}

    // Получаем новый токен
    $ch = curl_init('https://api.cdek.ru/v2/oauth/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type'    => 'client_credentials',
            'client_id'     => $clientId,
            'client_secret' => $clientSecret,
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $res = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($res, true);
    $token = $data['access_token'] ?? '';
    $expires = time() + (int)($data['expires_in'] ?? 3600);

    if ($token) {
        $pdo->prepare("INSERT INTO settings(key,value) VALUES('cdek_token_cache',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
            ->execute([json_encode(['token' => $token, 'expires' => $expires])]);
    }

    return $token;
}

// ── СДЭК API запрос ───────────────────────────────────────────────────
function cdek_request(string $method, string $url, array $params = [], string $token = ''): array {
    $ch = curl_init($url . ($method === 'GET' && $params ? '?' . http_build_query($params) : ''));
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ],
    ];
    if ($method === 'POST') {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = json_encode($params);
    }
    curl_setopt_array($ch, $opts);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) return ['error' => $err];
    return json_decode($res, true) ?? ['error' => 'Invalid response'];
}

$token = cdek_token($clientId, $clientSecret);
if (!$token) {
    echo json_encode(['error' => 'Не удалось получить токен СДЭК']);
    exit;
}

// ── Список городов (поиск) ────────────────────────────────────────────
if ($action === 'cities') {
    $q = trim($_GET['q'] ?? '');
    if (strlen($q) < 2) { echo json_encode([]); exit; }
    $res = cdek_request('GET', 'https://api.cdek.ru/v2/location/cities', [
        'city' => $q,
        'country_codes' => 'RU',
        'size' => 20,
    ], $token);
    $cities = [];
    if (is_array($res)) {
        foreach ($res as $c) {
            $cities[] = [
                'code'   => $c['code'] ?? '',
                'name'   => $c['city'] ?? '',
                'region' => $c['region'] ?? '',
            ];
        }
    }
    echo json_encode($cities);
    exit;
}

// ── ПВЗ по городу ─────────────────────────────────────────────────────
if ($action === 'pvz') {
    $cityCode = (int)($_GET['city_code'] ?? 0);
    if (!$cityCode) { echo json_encode([]); exit; }
    $res = cdek_request('GET', 'https://api.cdek.ru/v2/deliverypoints', [
        'city_code' => $cityCode,
        'type'      => 'PVZ',
        'is_handout'=> 'true',
    ], $token);
    $pvz = [];
    if (is_array($res)) {
        foreach (array_slice($res, 0, 15) as $p) {
            $pvz[] = [
                'code'      => $p['code'] ?? '',
                'name'      => $p['name'] ?? '',
                'address'   => $p['location']['address'] ?? '',
                'work_time' => $p['work_time'] ?? '',
                'type'      => $p['type'] ?? 'PVZ',
            ];
        }
    }
    echo json_encode($pvz);
    exit;
}

// ── Расчёт тарифа ─────────────────────────────────────────────────────
if ($action === 'tariff') {
    $toCityCode = (int)($_GET['city_code'] ?? 0);
    $deliveryType = $_GET['delivery_type'] ?? 'pvz'; // pvz | courier
    if (!$toCityCode) { echo json_encode(['error' => 'Не указан город']); exit; }

    // Вес и размеры — примерные для костровой чаши
    $tariffCode = $deliveryType === 'courier' ? 137 : 136; // 136=посылка склад-склад, 137=склад-дверь

    $body = [
        'tariff_code' => $tariffCode,
        'from_location' => ['code' => 431], // Тольятти
        'to_location'   => ['code' => $toCityCode],
        'packages'      => [['weight' => 12000, 'length' => 60, 'width' => 60, 'height' => 40]],
    ];
    $res = cdek_request('POST', 'https://api.cdek.ru/v2/calculator/tariff', $body, $token);

    if (isset($res['total_sum'])) {
        echo json_encode([
            'price'    => (int)$res['total_sum'],
            'period'   => ($res['period_min'] ?? '?') . '–' . ($res['period_max'] ?? '?') . ' дней',
        ]);
    } else {
        echo json_encode(['error' => $res['errors'][0]['message'] ?? 'Ошибка расчёта', 'raw' => $res]);
    }
    exit;
}

echo json_encode(['error' => 'Unknown action']);
