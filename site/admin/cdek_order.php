<?php
/**
 * admin/cdek_order.php — Фанера63.рф
 * Создание заказов СДЭК, получение треков, печать накладных
 */
if (session_status() === PHP_SESSION_NONE) session_start();
if (empty($_SESSION['admin'])) { http_response_code(403); echo json_encode(['error'=>'Unauthorized']); exit; }

require __DIR__ . '/../includes/db.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$pdo    = db();
$action = $_GET['action'] ?? $_POST['action'] ?? '';
$orderId = (int)($_GET['order_id'] ?? $_POST['order_id'] ?? 0);

// ── Мигрируем таблицу orders если надо ──────────────────────────────────
foreach ([
    'cdek_order_uuid TEXT DEFAULT ""',
    'cdek_track TEXT DEFAULT ""',
    'cdek_status TEXT DEFAULT ""',
    'cdek_pvz_code TEXT DEFAULT ""',
    'delivery_cost INTEGER DEFAULT 0',
    'cdek_raw TEXT DEFAULT ""',
] as $col_def) {
    $col = explode(' ', $col_def)[0];
    try {
        $pdo->exec("ALTER TABLE orders ADD COLUMN $col_def");
    } catch (Exception $e) {}
}

// ── Токен СДЭК ──────────────────────────────────────────────────────────
function cdek_token_admin(): string {
    $pdo = db();
    $clientId     = setting('cdek_client_id');
    $clientSecret = setting('cdek_client_secret');
    if (!$clientId || !$clientSecret) return '';

    try {
        $st = $pdo->prepare("SELECT value FROM settings WHERE key='cdek_token_cache'");
        $st->execute();
        $cached = $st->fetchColumn();
        if ($cached) {
            $data = json_decode($cached, true);
            if ($data && $data['expires'] > time() + 60) return $data['token'];
        }
    } catch (Exception $e) {}

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
    $res = curl_exec($ch); curl_close($ch);
    $data = json_decode($res, true);
    $token = $data['access_token'] ?? '';
    $expires = time() + (int)($data['expires_in'] ?? 3600);
    if ($token) {
        $pdo->prepare("INSERT INTO settings(key,value) VALUES('cdek_token_cache',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
            ->execute([json_encode(['token'=>$token,'expires'=>$expires])]);
    }
    return $token;
}

function cdek_api(string $method, string $url, array $body = [], string $token = ''): array {
    $ch = curl_init($method === 'GET' && $body ? $url.'?'.http_build_query($body) : $url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer '.$token,
            'Content-Type: application/json',
        ],
    ];
    if ($method === 'POST') { $opts[CURLOPT_POST] = true; $opts[CURLOPT_POSTFIELDS] = json_encode($body); }
    if ($method === 'DELETE') { $opts[CURLOPT_CUSTOMREQUEST] = 'DELETE'; }
    curl_setopt_array($ch, $opts);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) return ['error' => $err];
    return json_decode($res, true) ?? ['error' => 'Invalid JSON'];
}

// ── Получить заказ из БД ────────────────────────────────────────────────
function get_order(PDO $pdo, int $id): ?array {
    $st = $pdo->prepare('SELECT o.*, GROUP_CONCAT(i.product_name||" x"||i.qty, ", ") as items_str FROM orders o LEFT JOIN order_items i ON i.order_id=o.id WHERE o.id=? GROUP BY o.id');
    $st->execute([$id]);
    return $st->fetch(PDO::FETCH_ASSOC) ?: null;
}

// ── ACTION: reset — сбросить UUID для повторного создания ───────────────
if ($action === 'reset') {
    $pdo->prepare('UPDATE orders SET cdek_order_uuid="", cdek_status="", cdek_track="" WHERE id=?')->execute([$orderId]);
    echo json_encode(['ok' => true, 'message' => 'СДЭК сброшен']);
    exit;
}

// ── ACTION: create — создать заказ в СДЭК ───────────────────────────────
if ($action === 'create') {
    $order = get_order($pdo, $orderId);
    if (!$order) { echo json_encode(['error' => 'Заказ не найден']); exit; }
    if ($order['cdek_order_uuid']) { echo json_encode(['error' => 'Заказ уже создан в СДЭК', 'uuid' => $order['cdek_order_uuid']]); exit; }

    $token = cdek_token_admin();
    if (!$token) { echo json_encode(['error' => 'Не удалось получить токен СДЭК. Проверьте ключи в настройках.']); exit; }

    // Парсим данные из заказа
    $pvzCode  = trim($_POST['pvz_code'] ?? $order['cdek_pvz_code'] ?? '');
    $toCity   = (int)($_POST['city_code'] ?? 0);
    $address  = trim($_POST['address'] ?? $order['address'] ?? '');
    $tariff   = (int)($_POST['tariff'] ?? ($order['delivery_method'] === 'СДЭК курьер' ? 137 : 136));

    // Автопарсинг кода ПВЗ из адреса (формат: "Город · ПВЗ XXXXX: адрес")
    if (!$pvzCode && preg_match('/ПВЗ\s+([A-Z0-9\-]+)\s*:/u', $address, $m)) {
        $pvzCode = $m[1];
    }

    // Если код города не передан — ищем по названию из cities_data
    if (!$toCity && !$pvzCode) {
        require_once __DIR__ . '/../includes/cities_data.php';
        // Город хранится в поле address
        $orderCity = mb_strtolower(trim($order['address'] ?? ''));
        foreach ($cities_data as $cd) {
            if (mb_strtolower($cd['name']) === $orderCity) {
                $toCity = (int)$cd['cdek_code'];
                break;
            }
        }
        // Если точного совпадения нет — ищем вхождение
        if (!$toCity) {
            foreach ($cities_data as $cd) {
                $cdName = mb_strtolower($cd['name']);
                if (mb_strpos($orderCity, $cdName) !== false || mb_strpos($cdName, $orderCity) !== false) {
                    $toCity = (int)$cd['cdek_code'];
                    break;
                }
            }
        }
    }

    // Формируем получателя
    $phone = preg_replace('/[^0-9+]/', '', $order['phone']);
    if (!str_starts_with($phone, '+')) $phone = '+7'.ltrim($phone, '78');

    // Получаем товары заказа для items
    $orderItems = $pdo->prepare('SELECT * FROM order_items WHERE order_id=?');
    $orderItems->execute([$orderId]);
    $orderItemsList = $orderItems->fetchAll(PDO::FETCH_ASSOC);

    $pkgItems = [];
    $maxWeight = 0; $maxLength = 60; $maxWidth = 60; $maxHeight = 40;
    foreach ($orderItemsList as $oi) {
        // Берём габариты из товара если есть
        $prodDims = ['weight_g'=>12000,'length_cm'=>60,'width_cm'=>60,'height_cm'=>40];
        if($oi['product_id']){
            try{
                $ds=$pdo->prepare("SELECT weight_g,length_cm,width_cm,height_cm FROM products WHERE id=?");
                $ds->execute([$oi['product_id']]);
                $dr=$ds->fetch(PDO::FETCH_ASSOC);
                if($dr && $dr['weight_g']) $prodDims=$dr;
            }catch(Exception $e){}
        }
        $itemWeight = (int)($_POST['weight'] ?? $prodDims['weight_g'] ?? 12000);
        $maxWeight += $itemWeight * (int)($oi['qty']??1);
        $maxLength = max($maxLength, (int)($_POST['length'] ?? $prodDims['length_cm'] ?? 60));
        $maxWidth  = max($maxWidth,  (int)($_POST['width']  ?? $prodDims['width_cm']  ?? 60));
        $maxHeight = max($maxHeight, (int)($_POST['height'] ?? $prodDims['height_cm'] ?? 40));
        $pkgItems[] = [
            'name'     => $oi['product_name'] ?: 'Товар Фанера63.рф',
            'ware_key' => 'SKU-'.(int)($oi['product_id'] ?? 0),
            'payment'  => ['value' => 0],
            'cost'     => (int)($oi['price'] ?? 0),
            'weight'   => $itemWeight,
            'amount'   => (int)($oi['qty'] ?? 1),
        ];
    }
    // Если items пустые — добавляем один дефолтный
    if (empty($pkgItems)) {
        $pkgItems[] = [
            'name'    => $order['items_str'] ?: 'Фанера63.рф товар',
            'ware_key'=> 'SKU-0',
            'payment' => ['value' => 0],
            'cost'    => (int)($order['total'] ?? 0),
            'weight'  => (int)($_POST['weight'] ?? 12000),
            'amount'  => 1,
        ];
    }

    $body = [
        'tariff_code'   => $tariff,
        'from_location' => ['code' => 431],
        'sender'        => [
            'name'   => 'Фанера63.рф',
            'phones' => [['number' => setting('phone') ?: '+79000000000']],
        ],
        'recipient' => [
            'name'   => $order['customer_name'],
            'phones' => [['number' => $phone]],
        ],
        'packages' => [[
            'number' => 'PKG-'.$orderId,
            'weight' => $maxWeight ?: (int)($_POST['weight'] ?? 12000),
            'length' => $maxLength,
            'width'  => $maxWidth,
            'height' => $maxHeight,
            'comment'=> $order['items_str'] ?: 'Фанера63.рф',
            'items'  => $pkgItems,
        ]],
        'services'  => [],
        'comment'   => 'Заказ #'.$orderId.' Фанера63.рф',
    ];

    // Доставка до ПВЗ или курьером
    if ($pvzCode) {
        $body['delivery_point'] = $pvzCode;
    } elseif ($toCity) {
        $body['to_location'] = ['code' => $toCity];
        $body['to_location']['address'] = $address;
    } else {
        echo json_encode(['error' => 'Укажите ПВЗ или город доставки']); exit;
    }

    $res = cdek_api('POST', 'https://api.cdek.ru/v2/orders', $body, $token);

    if (!empty($res['entity']['uuid'])) {
        $uuid = $res['entity']['uuid'];
        $pdo->prepare('UPDATE orders SET cdek_order_uuid=?, cdek_status="created", cdek_pvz_code=?, cdek_raw=? WHERE id=?')
            ->execute([$uuid, $pvzCode, json_encode($res), $orderId]);
        echo json_encode(['ok' => true, 'uuid' => $uuid, 'message' => 'Заказ создан в СДЭК']);
    } else {
        // Собираем все ошибки из ответа
        $errors = [];
        if (!empty($res['errors'])) foreach($res['errors'] as $e) $errors[] = $e['message'] ?? json_encode($e);
        if (!empty($res['requests'])) foreach($res['requests'] as $req) {
            if (!empty($req['errors'])) foreach($req['errors'] as $e) $errors[] = $e['message'] ?? json_encode($e);
        }
        $errMsg = $errors ? implode('; ', $errors) : json_encode($res);
        // Сохраняем raw для отладки
        $pdo->prepare('UPDATE orders SET cdek_raw=? WHERE id=?')->execute([json_encode(['request'=>$body,'response'=>$res]), $orderId]);
        echo json_encode(['error' => 'СДЭК: '.$errMsg, 'raw' => $res, 'sent' => $body]);
    }
    exit;
}

// ── ACTION: status — обновить статус из СДЭК ────────────────────────────
if ($action === 'status') {
    $order = get_order($pdo, $orderId);
    if (!$order || !$order['cdek_order_uuid']) { echo json_encode(['error' => 'Нет UUID заказа СДЭК']); exit; }

    $token = cdek_token_admin();
    $res = cdek_api('GET', 'https://api.cdek.ru/v2/orders/'.$order['cdek_order_uuid'], [], $token);

    $track  = $res['entity']['cdek_number'] ?? '';
    $status = $res['entity']['statuses'][0]['name'] ?? '';
    $code   = $res['entity']['statuses'][0]['code'] ?? '';

    if ($track || $status) {
        $pdo->prepare('UPDATE orders SET cdek_track=?, cdek_status=?, cdek_raw=? WHERE id=?')
            ->execute([$track, $code, json_encode($res['entity'] ?? $res), $orderId]);
        echo json_encode(['ok' => true, 'track' => $track, 'status' => $status, 'code' => $code]);
    } else {
        echo json_encode(['error' => 'Не удалось получить статус', 'raw' => $res]);
    }
    exit;
}

// ── Вспомогательная функция печати ──────────────────────────────────────
function cdek_print(string $uuid, string $type, string $token): array {
    $res = cdek_api('POST', 'https://api.cdek.ru/v2/print/orders', [
        'orders'     => [['order_uuid' => $uuid]],
        'copy_count' => 1,
        'type'       => $type,
    ], $token);
    $printUuid = $res['entity']['uuid'] ?? '';
    if (!$printUuid) return [
        'error'    => 'PDF недоступен (заказ ещё обрабатывается СДЭК). Откройте ЛК СДЭК.',
        'cdek_url' => 'https://lk.cdek.ru/order-history',
        'raw'      => $res,
    ];
    // Polling до 8 попыток по 2 сек
    for ($i = 0; $i < 8; $i++) {
        sleep(2);
        $check = cdek_api('GET', 'https://api.cdek.ru/v2/print/orders/'.$printUuid, [], $token);
        $url = $check['entity']['url'] ?? '';
        if ($url) return ['ok' => true, 'url' => $url];
    }
    return [
        'error'    => 'PDF ещё не готов. Попробуйте через минуту или откройте ЛК СДЭК.',
        'cdek_url' => 'https://lk.cdek.ru/order-history',
    ];
}

// ── ACTION: label — накладная (barcode) ──────────────────────────────────
if ($action === 'label') {
    $order = get_order($pdo, $orderId);
    if (!$order || !$order['cdek_order_uuid']) { echo json_encode(['error' => 'Сначала создайте заказ в СДЭК']); exit; }
    $token = cdek_token_admin();
    echo json_encode(cdek_print($order['cdek_order_uuid'], 'barcode', $token));
    exit;
}

// ── ACTION: barcode — штрихкод ───────────────────────────────────────────
if ($action === 'barcode') {
    $order = get_order($pdo, $orderId);
    if (!$order || !$order['cdek_order_uuid']) { echo json_encode(['error' => 'Сначала создайте заказ в СДЭК']); exit; }
    $token = cdek_token_admin();
    echo json_encode(cdek_print($order['cdek_order_uuid'], 'barcode', $token));
    exit;
}

// ── ACTION: cancel — отменить заказ СДЭК ────────────────────────────────
if ($action === 'cancel') {
    $order = get_order($pdo, $orderId);
    if (!$order || !$order['cdek_order_uuid']) { echo json_encode(['error' => 'Нет UUID']); exit; }

    $token = cdek_token_admin();
    $res = cdek_api('DELETE', 'https://api.cdek.ru/v2/orders/'.$order['cdek_order_uuid'], [], $token);

    if (!empty($res['entity']['uuid'])) {
        $pdo->prepare('UPDATE orders SET cdek_status="cancelled", cdek_order_uuid="" WHERE id=?')->execute([$orderId]);
        echo json_encode(['ok' => true, 'message' => 'Заказ отменён в СДЭК']);
    } else {
        echo json_encode(['error' => 'Ошибка отмены', 'raw' => $res]);
    }
    exit;
}

// ── ACTION: get_order — детали заказа для drawer ─────────────────────────
if ($action === 'get_order') {
    $order = get_order($pdo, $orderId);
    if (!$order) { echo json_encode(['error' => 'Не найден']); exit; }
    $items = $pdo->prepare('SELECT * FROM order_items WHERE order_id=?');
    $items->execute([$orderId]);
    $order['items'] = $items->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($order);
    exit;
}

// ── ACTION: update — обновить статус/заметку ────────────────────────────
if ($action === 'update_order') {
    $status = $_POST['status'] ?? '';
    $note   = trim($_POST['manager_note'] ?? '');
    $pdo->prepare('UPDATE orders SET status=?, manager_note=? WHERE id=?')->execute([$status, $note, $orderId]);
    echo json_encode(['ok' => true]);
    exit;
}

echo json_encode(['error' => 'Unknown action: '.$action]);
