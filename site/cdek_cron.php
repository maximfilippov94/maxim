<?php
/**
 * cdek_cron.php — LUKA OUTDOOR
 * Автообновление статусов СДЭК
 * Крон: добавь в Sweb -> Инструменты -> Cron
 * Минута: * /30  Команда: php /home/v/volgasmoke/public_html/cdek_cron.php
 * Или вручную: https://lukaoutdoor.com/cdek_cron.php?key=luka2026cdek
 */

// Защита от случайного запуска в браузере
$secret = 'luka2026cdek'; // можно поменять
$isCli  = php_sapi_name() === 'cli';
if (!$isCli) {
    $key = $_GET['key'] ?? '';
    if ($key !== $secret) { http_response_code(403); echo 'Forbidden'; exit; }
}

require __DIR__ . '/includes/db.php';
$pdo = db();

// ── Токен СДЭК ──────────────────────────────────────────────────────────
function get_cdek_token(): string {
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
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query(['grant_type'=>'client_credentials','client_id'=>$clientId,'client_secret'=>$clientSecret]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false,
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

// ── Статусы которые считаем финальными (не обновляем) ───────────────────
$finalStatuses = ['DELIVERED', 'NOT_DELIVERED', 'INVALID', 'cancelled'];

// ── Берём заказы с UUID которые не финальные ─────────────────────────────
$orders = $pdo->query("
    SELECT id, cdek_order_uuid, cdek_status, cdek_track, customer_name
    FROM orders
    WHERE cdek_order_uuid != ''
    AND cdek_order_uuid IS NOT NULL
    AND (cdek_status NOT IN ('DELIVERED','NOT_DELIVERED','cancelled') OR cdek_status = '' OR cdek_status IS NULL)
    ORDER BY id DESC
    LIMIT 50
")->fetchAll(PDO::FETCH_ASSOC);

if (empty($orders)) {
    echo "Нет заказов для обновления\n";
    exit;
}

$token = get_cdek_token();
if (!$token) { echo "Ошибка токена СДЭК\n"; exit; }

$updated = 0;
$errors  = 0;

foreach ($orders as $order) {
    $ch = curl_init('https://api.cdek.ru/v2/orders/' . $order['cdek_order_uuid']);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer '.$token, 'Content-Type: application/json'],
    ]);
    $res  = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($err) { echo "Ошибка заказа #{$order['id']}: $err\n"; $errors++; continue; }

    $data   = json_decode($res, true);
    $entity = $data['entity'] ?? [];
    $track  = $entity['cdek_number'] ?? $order['cdek_track'];
    $statuses = $entity['statuses'] ?? [];
    $code   = !empty($statuses) ? ($statuses[0]['code'] ?? '') : '';
    $name   = !empty($statuses) ? ($statuses[0]['name'] ?? '') : '';

    if (!$code && !$track) { $errors++; continue; }

    // Обновляем только если что-то изменилось
    if ($code !== $order['cdek_status'] || $track !== $order['cdek_track']) {
        $pdo->prepare('UPDATE orders SET cdek_track=?, cdek_status=?, cdek_raw=? WHERE id=?')
            ->execute([$track, $code, json_encode($entity), $order['id']]);
        $updated++;
        echo "Заказ #{$order['id']} ({$order['customer_name']}): {$order['cdek_status']} → $code" . ($track ? " [трек: $track]" : '') . "\n";
    }

    usleep(200000); // 200ms пауза между запросами
}

echo "\nГотово. Обновлено: $updated, ошибок: $errors\n";
