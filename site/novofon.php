<?php
/**
 * novofon.php — Фанера63.рф
 * Интеграция с Новофон (Zadarma) API
 * - Исходящие звонки из CRM
 * - Вебхук входящих звонков → уведомление в Telegram
 */
require __DIR__ . '/includes/db.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// ── Настройки из БД ──────────────────────────────────────────────────────
function novofon_key():    string { return setting('novofon_key',    ''); }
function novofon_secret(): string { return setting('novofon_secret', ''); }
function novofon_ext():    string { return setting('novofon_ext',    '100'); }

// ── Подпись запроса Новофон ──────────────────────────────────────────────
function novofon_sign(string $path, array $params, string $secret): string {
    ksort($params);
    $str = $path . md5(http_build_query($params));
    return base64_encode(hash_hmac('sha1', $str, $secret));
}

// ── API запрос к Новофон ─────────────────────────────────────────────────
function novofon_request(string $method, array $params = []): array {
    $key    = novofon_key();
    $secret = novofon_secret();
    if (!$key || !$secret) return ['error' => 'Настройте API ключи Новофон в настройках'];

    $sign = novofon_sign($method, $params, $secret);
    $params['format'] = 'json';

    $ch = curl_init('https://my.novofon.ru' . $method . '?' . http_build_query($params));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => [
            'Authorization: ' . $key . ':' . $sign,
            'Content-Type: application/x-www-form-urlencoded',
        ],
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) return ['error' => $err];
    return json_decode($res, true) ?? ['error' => 'Invalid JSON'];
}

// ── ACTION: pending — непоказанные уведомления ───────────────────────────
if ($action === 'pending') {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (empty($_SESSION['admin'])) { echo json_encode([]); exit; }
    $pdo = db();
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS calls (id INTEGER PRIMARY KEY AUTOINCREMENT, caller TEXT NOT NULL DEFAULT '', caller_name TEXT DEFAULT '', order_id INTEGER DEFAULT 0, order_total INTEGER DEFAULT 0, direction TEXT DEFAULT 'in', duration INTEGER DEFAULT 0, status TEXT DEFAULT 'incoming', notified INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
        $calls = $pdo->query("SELECT * FROM calls WHERE notified=0 ORDER BY id DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($calls)) {
            $ids = implode(',', array_column($calls, 'id'));
            $pdo->exec("UPDATE calls SET notified=1 WHERE id IN ($ids)");
        }
        echo json_encode($calls);
    } catch(Exception $e){ echo json_encode([]); }
    exit;
}

// ── ACTION: delete_call — удалить запись ─────────────────────────────────
if ($action === 'delete_call') {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (empty($_SESSION['admin'])) { echo json_encode(['error'=>'Unauthorized']); exit; }
    $pdo = db();
    $pdo->prepare("DELETE FROM calls WHERE id=?")->execute([(int)($_POST['id']??0)]);
    echo json_encode(['ok'=>true]);
    exit;
}

// ── ACTION: call — исходящий звонок ─────────────────────────────────────
if ($action === 'call') {
    // Проверка авторизации — только из админки
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (empty($_SESSION['admin'])) { echo json_encode(['error' => 'Unauthorized']); exit; }

    $to  = preg_replace('/[^0-9+]/', '', $_POST['phone'] ?? '');
    $ext = novofon_ext();

    if (!$to) { echo json_encode(['error' => 'Не указан номер']); exit; }

    // Приводим номер к формату +7
    if (!str_starts_with($to, '+')) $to = '+7' . ltrim($to, '78');

    $res = novofon_request('/v1/request/callback/', [
        'from'       => $ext,   // внутренний номер сотрудника
        'to'         => $to,    // номер клиента
        'sip_id'     => $ext,
    ]);

    if (!empty($res['status']) && $res['status'] === 'success') {
        // Логируем звонок в заказ если передан order_id
        $orderId = (int)($_POST['order_id'] ?? 0);
        if ($orderId) {
            $pdo = db();
            $note = $pdo->prepare("SELECT manager_note FROM orders WHERE id=?");
            $note->execute([$orderId]);
            $existing = $note->fetchColumn() ?: '';
            $logLine = "\n📞 Исходящий звонок: " . $to . " — " . date('d.m.Y H:i');
            $pdo->prepare("UPDATE orders SET manager_note=? WHERE id=?")
                ->execute([trim($existing . $logLine), $orderId]);
        }
        echo json_encode(['ok' => true, 'message' => 'Звонок инициирован. Ожидайте звонка на ваш телефон.']);
    } else {
        $errMsg = $res['message'] ?? $res['error'] ?? json_encode($res);
        echo json_encode(['error' => 'Новофон: ' . $errMsg, 'raw' => $res]);
    }
    exit;
}

// ── ACTION: webhook — входящий звонок от Новофон ─────────────────────────
if ($action === 'webhook' || isset($_POST['event']) || isset($_GET['event'])) {
    // Новофон шлёт JSON body — читаем все форматы
    $raw  = file_get_contents('php://input');
    $json = ($raw && isset($raw[0]) && $raw[0]==='{') ? (json_decode($raw, true) ?? []) : [];
    $data = array_merge($_GET, $_POST, $json);

    $event    = $data['event'] ?? '';
    $caller   = $data['caller_id'] ?? $data['contact_phone_number'] ?? $data['from'] ?? '';
    $called   = $data['called_did'] ?? $data['to'] ?? '';
    $callId   = $data['pbx_call_id'] ?? $data['call_session_id'] ?? $data['call_id'] ?? '';

    $pdo = db();

    // Создаём таблицу если нет, миграция call_id
    $pdo->exec("CREATE TABLE IF NOT EXISTS calls (id INTEGER PRIMARY KEY AUTOINCREMENT, caller TEXT NOT NULL DEFAULT '', caller_name TEXT DEFAULT '', order_id INTEGER DEFAULT 0, order_total INTEGER DEFAULT 0, direction TEXT DEFAULT 'in', duration INTEGER DEFAULT 0, status TEXT DEFAULT 'incoming', notified INTEGER DEFAULT 0, call_id TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
    try { $pdo->exec("ALTER TABLE calls ADD COLUMN call_id TEXT DEFAULT ''"); } catch(Exception $e){}

    // ── Конец звонка — сохраняем длительность ───────────────────────────
    if ($event === 'NOTIFY_END' || $event === 'CALL_END') {
        $duration = (int)($data['duration'] ?? $data['call_duration'] ?? 0);
        $callId   = $data['pbx_call_id'] ?? $data['call_session_id'] ?? $data['call_id'] ?? '';
        $status   = $duration > 0 ? 'answered' : 'missed';
        if ($callId) {
            $pdo->prepare("UPDATE calls SET duration=?, status=? WHERE call_id=?")
                ->execute([$duration, $status, $callId]);
        }
        echo json_encode(['ok' => true, 'event' => $event, 'duration' => $duration]);
        exit;
    }

    // Только входящие START
    if ($event !== 'NOTIFY_START' && $event !== 'CALL_START') {
        echo json_encode(['ok' => true, 'skip' => true, 'event' => $event]);
        exit;
    }

    if (!$caller) { echo json_encode(['ok' => true, 'msg' => 'no caller']); exit; }

    // Ищем клиента по номеру телефона в заказах
    $cleanCaller = preg_replace('/[^0-9]/', '', $caller);
    $orders = $pdo->query("SELECT id, customer_name, phone, total, status FROM orders ORDER BY id DESC LIMIT 200")->fetchAll(PDO::FETCH_ASSOC);

    $found = null;
    foreach ($orders as $o) {
        $cleanPhone = preg_replace('/[^0-9]/', '', $o['phone'] ?? '');
        if (substr($cleanCaller, -10) === substr($cleanPhone, -10)) {
            $found = $o; break;
        }
    }

    $callId = $data['pbx_call_id'] ?? $data['call_session_id'] ?? $data['call_id'] ?? '';

    // Сохраняем в БД
    $pdo->prepare("INSERT INTO calls (caller,caller_name,order_id,order_total,direction,status,notified,call_id) VALUES (?,?,?,?,'in','incoming',0,?)")
        ->execute([$caller, $found['customer_name']??'', $found['id']??0, $found['total']??0, $callId]);

    echo json_encode(['ok' => true, 'found' => $found ? true : false, 'caller' => $caller]);
    exit;
}

echo json_encode(['error' => 'Unknown action']);
