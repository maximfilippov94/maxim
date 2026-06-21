<?php
require __DIR__.'/includes/db.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

// ── SMTP настройки (Spaceweb) ─────────────────────────────────────────────────
define('SMTP_HOST', 'smtp.spaceweb.ru');
define('SMTP_PORT', 465);
define('SMTP_USER', 'noreply@luka-shop.ru');
define('SMTP_PASS', 'qWAszX1994fimax');
define('SMTP_FROM', 'noreply@luka-shop.ru');
define('SMTP_FROM_NAME', 'LUKA OUTDOOR');

// ── Email helper через SMTP (сокеты, без библиотек) ───────────────────────────
function send_order_email(string $to, string $subject, string $htmlBody): void {
    try {
        // Подключаемся по SSL
        $ctx = stream_context_create(['ssl'=>['verify_peer'=>false,'verify_peer_name'=>false]]);
        $sock = stream_socket_client('ssl://'.SMTP_HOST.':'.SMTP_PORT, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
        if(!$sock) throw new Exception("SMTP connect failed: $errstr");

        $read = function() use ($sock){ return fgets($sock, 512); };
        $send = function(string $cmd) use ($sock){ fwrite($sock, $cmd."\r\n"); };

        $read(); // 220 greeting
        $send('EHLO lukaoutdoor.com'); while(($line=$read()) && substr($line,3,1)=='-');
        $send('AUTH LOGIN'); $read();
        $send(base64_encode(SMTP_USER)); $read();
        $send(base64_encode(SMTP_PASS)); $read(); // 235
        $send('MAIL FROM:<'.SMTP_FROM.'>'); $read();
        $send('RCPT TO:<'.$to.'>'); $read();
        $send('DATA'); $read();

        $encodedSubject = '=?UTF-8?B?'.base64_encode($subject).'?=';
        $boundary = md5(uniqid());
        $msg  = "From: ".SMTP_FROM_NAME." <".SMTP_FROM.">\r\n";
        $msg .= "To: <$to>\r\n";
        $msg .= "Subject: $encodedSubject\r\n";
        $msg .= "MIME-Version: 1.0\r\n";
        $msg .= "Content-Type: text/html; charset=UTF-8\r\n";
        $msg .= "Content-Transfer-Encoding: base64\r\n";
        $msg .= "\r\n";
        $msg .= chunk_split(base64_encode($htmlBody));
        $msg .= "\r\n.";
        $send($msg); $read(); // 250
        $send('QUIT'); fclose($sock);
    } catch(\Throwable $e) {
        error_log('[mail] '.$e->getMessage());
    }
}

function order_email_style(): string {
    return '<style>
      body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
      .wrap{max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
      .head{background:#0b0b0b;padding:28px 32px;text-align:center}
      .head h1{color:#c9792b;font-size:22px;margin:0;letter-spacing:.1em}
      .head p{color:#9a9288;font-size:13px;margin:6px 0 0}
      .body{padding:28px 32px}
      .label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:4px}
      .value{font-size:15px;color:#111;margin-bottom:16px;font-weight:600}
      .items{width:100%;border-collapse:collapse;margin:16px 0}
      .items th{background:#f7f7f7;padding:10px 12px;text-align:left;font-size:12px;color:#555;border-bottom:2px solid #eee}
      .items td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px}
      .total{font-size:18px;font-weight:700;color:#c9792b;text-align:right;padding:12px 0}
      .foot{background:#f7f7f7;padding:18px 32px;text-align:center;font-size:12px;color:#888}
      .btn{display:inline-block;background:#c9792b;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:8px}
    </style>';
}

function send_admin_email(array $order, array $items, string $adminEmail): void {
    $id       = $order['id'];
    $name     = htmlspecialchars($order['name']);
    $phone    = htmlspecialchars($order['phone']);
    $city     = htmlspecialchars($order['city']);
    $delivery = htmlspecialchars($order['delivery']);
    $payment  = htmlspecialchars($order['payment']);
    $comment  = nl2br(htmlspecialchars($order['comment']));
    $total    = number_format($order['total'], 0, '.', ' ');

    $rows = '';
    foreach ($items as $i) {
        $rows .= '<tr>
            <td>'.htmlspecialchars($i['name']).'</td>
            <td style="text-align:center">'.(int)$i['qty'].'</td>
            <td style="text-align:right">'.number_format((int)$i['price'], 0, '.', ' ').' &#8381;</td>
        </tr>';
    }

    $html = '<!doctype html><html><head>'.order_email_style().'</head><body>
    <div class="wrap">
      <div class="head"><h1>LUKA OUTDOOR</h1><p>&#1053;&#1086;&#1074;&#1099;&#1081; &#1079;&#1072;&#1082;&#1072;&#1079; #'.$id.'</p></div>
      <div class="body">
        <div class="label">&#1055;&#1086;&#1082;&#1091;&#1087;&#1072;&#1090;&#1077;&#1083;&#1100;</div><div class="value">'.$name.'</div>
        <div class="label">&#1058;&#1077;&#1083;&#1077;&#1092;&#1086;&#1085;</div><div class="value"><a href="tel:'.$order['phone'].'">'.$phone.'</a></div>
        <div class="label">&#1043;&#1086;&#1088;&#1086;&#1076; / &#1040;&#1076;&#1088;&#1077;&#1089;</div><div class="value">'.$city.'</div>
        <div class="label">&#1044;&#1086;&#1089;&#1090;&#1072;&#1074;&#1082;&#1072;</div><div class="value">'.$delivery.'</div>
        <div class="label">&#1054;&#1087;&#1083;&#1072;&#1090;&#1072;</div><div class="value">'.$payment.'</div>
        '.($order['comment'] ? '<div class="label">&#1050;&#1086;&#1084;&#1084;&#1077;&#1085;&#1090;&#1072;&#1088;&#1080;&#1081;</div><div class="value">'.$comment.'</div>' : '').'
        <table class="items">
          <thead><tr>
            <th>&#1058;&#1086;&#1074;&#1072;&#1088;</th>
            <th style="text-align:center">&#1050;&#1086;&#1083;-&#1074;&#1086;</th>
            <th style="text-align:right">&#1062;&#1077;&#1085;&#1072;</th>
          </tr></thead>
          <tbody>'.$rows.'</tbody>
        </table>
        <div class="total">&#1048;&#1090;&#1086;&#1075;&#1086;: '.$total.' &#8381;</div>
        <div style="text-align:center;margin-top:16px">
          <a href="https://lukaoutdoor.com/admin/?tab=orders" class="btn">&#1054;&#1090;&#1082;&#1088;&#1099;&#1090;&#1100; &#1074; CRM &rarr;</a>
        </div>
      </div>
      <div class="foot">lukaoutdoor.com &middot; '.date('d.m.Y H:i').'</div>
    </div></body></html>';

    send_order_email($adminEmail, 'Новый заказ #'.$id.' — '.$name.' ('.$total.' руб)', $html);
}

function send_customer_email(array $order, array $items, string $customerEmail): void {
    $name  = htmlspecialchars($order['name']);
    $id    = $order['id'];
    $total = number_format($order['total'], 0, '.', ' ');

    $rows = '';
    foreach ($items as $i) {
        $rows .= '<tr>
            <td>'.htmlspecialchars($i['name']).'</td>
            <td style="text-align:center">'.(int)$i['qty'].'</td>
            <td style="text-align:right">'.number_format((int)$i['price'], 0, '.', ' ').' &#8381;</td>
        </tr>';
    }

    $html = '<!doctype html><html><head>'.order_email_style().'</head><body>
    <div class="wrap">
      <div class="head"><h1>LUKA OUTDOOR</h1><p>&#1042;&#1072;&#1096; &#1079;&#1072;&#1082;&#1072;&#1079; #'.$id.' &#1087;&#1088;&#1080;&#1085;&#1103;&#1090;</p></div>
      <div class="body">
        <p style="font-size:16px;color:#111">&#1055;&#1088;&#1080;&#1074;&#1077;&#1090;, <b>'.$name.'</b>! &#128293;</p>
        <p style="color:#444;line-height:1.6">&#1052;&#1099; &#1087;&#1086;&#1083;&#1091;&#1095;&#1080;&#1083;&#1080; &#1074;&#1072;&#1096; &#1079;&#1072;&#1082;&#1072;&#1079; &#1080; &#1091;&#1078;&#1077; &#1085;&#1072;&#1095;&#1080;&#1085;&#1072;&#1077;&#1084; &#1077;&#1075;&#1086; &#1086;&#1073;&#1088;&#1072;&#1073;&#1072;&#1090;&#1099;&#1074;&#1072;&#1090;&#1100;. &#1053;&#1072;&#1096; &#1084;&#1077;&#1085;&#1077;&#1076;&#1078;&#1077;&#1088; &#1089;&#1074;&#1103;&#1078;&#1077;&#1090;&#1089;&#1103; &#1089; &#1074;&#1072;&#1084;&#1080; &#1074; &#1073;&#1083;&#1080;&#1078;&#1072;&#1081;&#1096;&#1077;&#1077; &#1074;&#1088;&#1077;&#1084;&#1103; &#1076;&#1083;&#1103; &#1087;&#1086;&#1076;&#1090;&#1074;&#1077;&#1088;&#1078;&#1076;&#1077;&#1085;&#1080;&#1103;.</p>
        <table class="items">
          <thead><tr>
            <th>&#1058;&#1086;&#1074;&#1072;&#1088;</th>
            <th style="text-align:center">&#1050;&#1086;&#1083;-&#1074;&#1086;</th>
            <th style="text-align:right">&#1062;&#1077;&#1085;&#1072;</th>
          </tr></thead>
          <tbody>'.$rows.'</tbody>
        </table>
        <div class="total">&#1048;&#1090;&#1086;&#1075;&#1086;: '.$total.' &#8381;</div>
        <p style="color:#444;font-size:14px;line-height:1.6;margin-top:20px">
          &#1044;&#1086;&#1089;&#1090;&#1072;&#1074;&#1082;&#1072; &#1095;&#1077;&#1088;&#1077;&#1079; &#1057;&#1044;&#1069;&#1050;, &#1089;&#1088;&#1086;&#1082; &mdash; <b>3&ndash;7 &#1076;&#1085;&#1077;&#1081;</b>.<br>
          &#1050;&#1072;&#1082; &#1073;&#1091;&#1076;&#1077;&#1090; &#1075;&#1086;&#1090;&#1086;&#1074;&#1086; &#1082; &#1086;&#1090;&#1087;&#1088;&#1072;&#1074;&#1082;&#1077; &mdash; &#1087;&#1088;&#1080;&#1096;&#1083;&#1105;&#1084; &#1090;&#1088;&#1077;&#1082; &#1085;&#1086;&#1084;&#1077;&#1088; &#1057;&#1044;&#1069;&#1050;.<br><br>
          &#1045;&#1089;&#1083;&#1080; &#1077;&#1089;&#1090;&#1100; &#1074;&#1086;&#1087;&#1088;&#1086;&#1089;&#1099;:<br>
          &#1058;&#1077;&#1083;: <a href="tel:88001234567" style="color:#c9792b">8 800 123-45-67</a><br>
          Email: <a href="mailto:hello@lukaoutdoor.com" style="color:#c9792b">hello@lukaoutdoor.com</a>
        </p>
        <div style="text-align:center;margin-top:24px">
          <a href="https://lukaoutdoor.com/catalog.php" class="btn">&#1057;&#1084;&#1086;&#1090;&#1088;&#1077;&#1090;&#1100; &#1082;&#1072;&#1090;&#1072;&#1083;&#1086;&#1075;</a>
        </div>
      </div>
      <div class="foot">LUKA OUTDOOR &middot; lukaoutdoor.com<br>
        &#1069;&#1090;&#1086; &#1087;&#1080;&#1089;&#1100;&#1084;&#1086; &#1086;&#1090;&#1087;&#1088;&#1072;&#1074;&#1083;&#1077;&#1085;&#1086; &#1072;&#1074;&#1090;&#1086;&#1084;&#1072;&#1090;&#1080;&#1095;&#1077;&#1089;&#1082;&#1080;.</div>
    </div></body></html>';

    send_order_email($customerEmail, 'Ваш заказ #'.$id.' принят — LUKA OUTDOOR', $html);
}

// ── Основная логика ───────────────────────────────────────────────────────────
try{
    $csrfToken = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!empty($csrfToken) && !hash_equals($_SESSION['csrf_token'] ?? '', $csrfToken)) {
        http_response_code(403);
        echo json_encode(['ok'=>false,'message'=>'Недопустимый запрос'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $quick    = !empty($_POST['quick_request']);
    $name     = trim($_POST['customer_name'] ?? '');
    $phone    = trim($_POST['phone'] ?? '');
    $email    = trim($_POST['email'] ?? '');
    $city     = trim($_POST['city'] ?? $_POST['address'] ?? '');
    $delivery = trim($_POST['delivery_method'] ?? 'После согласования');
    $payment  = trim($_POST['payment_method'] ?? 'После подтверждения');
    $comment  = trim($_POST['comment'] ?? '');

    if(!$name || !$phone) throw new Exception('Заполните имя и телефон');
    $cart = json_decode($_POST['cart'] ?? '[]', true);
    if(!$quick && !$cart) throw new Exception('Корзина пустая');
    if(!$quick && !$city) throw new Exception('Укажите город доставки');

    $total = 0;
    if(is_array($cart)){ foreach($cart as $i){ $total += ((int)($i['price'] ?? 0))*max(1,(int)($i['qty'] ?? 1)); } }

    $ym_uid       = trim($_POST['ym_uid'] ?? $_COOKIE['_ym_uid'] ?? '');
    $utm_source   = trim($_POST['utm_source']   ?? '');
    $utm_medium   = trim($_POST['utm_medium']   ?? '');
    $utm_campaign = trim($_POST['utm_campaign'] ?? '');
    $utm_content  = trim($_POST['utm_content']  ?? '');
    $utm_term     = trim($_POST['utm_term']     ?? '');
    $referer      = trim($_POST['page_referer'] ?? '');
    $utmParts     = array_filter(compact('utm_source','utm_medium','utm_campaign','utm_content','utm_term'));
    $utmStr       = '';
    foreach($utmParts as $k=>$v) $utmStr .= str_replace('utm_','',$k).': '.$v."\n";
    if($referer) $utmStr .= 'referer: '.$referer."\n";

    $pdo = db(); $pdo->beginTransaction();
    $source       = $quick ? 'quick_request' : 'cart_checkout';
    $finalComment = ($quick ? 'Быстрая заявка. ' : '').$comment.($utmStr ? "\n---\n".$utmStr : '');

    try { $pdo->exec("ALTER TABLE orders ADD COLUMN ym_uid TEXT DEFAULT ''"); } catch(Exception $e){}

    $stmt = $pdo->prepare('INSERT INTO orders (customer_name,phone,email,address,delivery_method,payment_method,comment,source,total,status,ym_uid) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    $stmt->execute([$name, $phone, $email, $city ?: 'Не указан', $delivery, $payment, trim($finalComment), $source, $total, 'new', $ym_uid]);
    $orderId = (int)$pdo->lastInsertId();

    $itemStmt   = $pdo->prepare('INSERT INTO order_items (order_id,product_id,product_name,price,qty) VALUES (?,?,?,?,?)');
    $orderItems = [];
    if($quick){
        $iName = 'Быстрая заявка / подбор'.(isset($_POST['product_name']) ? ': '.$_POST['product_name'] : '');
        $itemStmt->execute([$orderId, null, $iName, 0, 1]);
        $orderItems[] = ['name'=>$iName,'price'=>0,'qty'=>1];
    } else {
        foreach($cart as $i){
            $iName  = $i['name'] ?? 'Товар';
            $iPrice = (int)($i['price'] ?? 0);
            $iQty   = max(1,(int)($i['qty'] ?? 1));
            $itemStmt->execute([$orderId, is_numeric($i['id'] ?? null)?(int)$i['id']:null, $iName, $iPrice, $iQty]);
            $orderItems[] = ['name'=>$iName,'price'=>$iPrice,'qty'=>$iQty];
        }
    }
    $pdo->commit();

    // ── Отправка писем ────────────────────────────────────────────────────────
    $orderData = [
        'id'       => $orderId,
        'name'     => $name,
        'phone'    => $phone,
        'city'     => $city ?: 'Не указан',
        'delivery' => $delivery,
        'payment'  => $payment,
        'comment'  => $comment,
        'total'    => $total,
    ];

    // Письмо владельцу
    send_admin_email($orderData, $orderItems, 'maximfilippov94@gmail.com');

    // Письмо клиенту — только если указал email
    if($email && filter_var($email, FILTER_VALIDATE_EMAIL)){
        send_customer_email($orderData, $orderItems, $email);
    }

    echo json_encode(['ok'=>true,'message'=>'Заявка отправлена. Мы свяжемся с вами в ближайшее время.','redirect'=>'/thanks.php'], JSON_UNESCAPED_UNICODE);

}catch(Throwable $e){
    if(isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    $userMsg = ($e instanceof InvalidArgumentException || str_contains($e->getMessage(), 'Заполните') || str_contains($e->getMessage(), 'пустая') || str_contains($e->getMessage(), 'Укажите'))
        ? $e->getMessage()
        : 'Произошла ошибка. Попробуйте ещё раз.';
    error_log('[order.php] '.$e->getMessage());
    echo json_encode(['ok'=>false,'message'=>$userMsg], JSON_UNESCAPED_UNICODE);
}
