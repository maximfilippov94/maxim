<?php
require __DIR__.'/includes/db.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

// ── SMTP настройки (Spaceweb) ─────────────────────────────────────────────────
define('SMTP_HOST', 'smtp.spaceweb.ru');
define('SMTP_PORT', 465);
define('SMTP_USER', 'noreply@lukaoutdoor.com');
define('SMTP_PASS', 'qWAszX1994fimax');
define('SMTP_FROM', 'noreply@lukaoutdoor.com');
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

function email_base(string $preheader, string $content): string {
    $logo = 'https://lukaoutdoor.com/assets/images/logo_luka_new.png';
    return '<!doctype html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LUKA OUTDOOR</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#111;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a}
  a{color:#c9792b;text-decoration:none}
  .pre{display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#111}
  .outer{width:100%;background:#111;padding:32px 16px}
  .card{max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden}
  /* Header */
  .hd{background:#0b0b0b;padding:32px 40px 24px;text-align:center;border-bottom:2px solid #c9792b}
  .hd img{height:48px;display:block;margin:0 auto 12px}
  .hd-tag{display:inline-block;background:#c9792b;color:#fff;font-size:11px;font-weight:700;
    letter-spacing:.12em;text-transform:uppercase;padding:4px 14px;border-radius:99px;margin-top:4px}
  /* Body */
  .bd{padding:32px 40px}
  .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;
    color:#aaa;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;margin-bottom:24px}
  .info-cell{padding:10px 0;border-bottom:1px solid #f5f5f5}
  .info-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#aaa;margin-bottom:3px}
  .info-value{font-size:14px;font-weight:700;color:#111}
  /* Product card */
  .prod-card{display:table;width:100%;border:1px solid #f0f0f0;border-radius:12px;
    overflow:hidden;margin-bottom:8px;background:#fafafa}
  .prod-img{display:table-cell;width:88px;vertical-align:top}
  .prod-img img{width:88px;height:88px;object-fit:cover;display:block}
  .prod-img .no-img{width:88px;height:88px;background:#f0f0f0;display:block}
  .prod-info{display:table-cell;vertical-align:middle;padding:14px 16px}
  .prod-name{font-size:14px;font-weight:700;color:#111;margin-bottom:4px}
  .prod-meta{font-size:12px;color:#888}
  .prod-price{display:table-cell;vertical-align:middle;padding:14px 16px;
    text-align:right;white-space:nowrap;font-size:16px;font-weight:700;color:#c9792b;width:110px}
  /* Total */
  .total-row{background:#0b0b0b;border-radius:10px;padding:16px 20px;
    display:table;width:100%;margin-top:16px}
  .total-label{display:table-cell;font-size:13px;font-weight:700;
    text-transform:uppercase;letter-spacing:.08em;color:#9a9288}
  .total-value{display:table-cell;text-align:right;font-size:22px;font-weight:700;color:#c9792b}
  /* Button */
  .btn-wrap{text-align:center;margin:28px 0 4px}
  .btn{display:inline-block;background:#c9792b;color:#fff !important;padding:14px 36px;
    border-radius:10px;font-weight:700;font-size:15px;letter-spacing:.03em;text-decoration:none}
  .btn:hover{background:#e89a42}
  /* Divider */
  .divider{height:1px;background:#f0f0f0;margin:24px 0}
  /* Footer */
  .ft{background:#0b0b0b;padding:24px 40px;text-align:center}
  .ft p{font-size:12px;color:#555;line-height:1.8}
  .ft a{color:#c9792b}
  .socials{margin:12px 0}
  .socials a{display:inline-block;width:32px;height:32px;background:#1a1a1a;border-radius:50%;
    margin:0 4px;line-height:32px;font-size:14px;text-align:center;color:#c9792b !important;text-decoration:none}
  @media(max-width:480px){
    .bd{padding:24px 20px} .hd{padding:24px 20px 18px}
    .ft{padding:20px} .info-grid{grid-template-columns:1fr}
    .prod-img img,.prod-img .no-img{width:72px;height:72px} .prod-img{width:72px}
  }
</style></head><body>
<span class="pre">'.$preheader.'</span>
<div class="outer">
  <div class="card">
    <div class="hd">
      <img src="'.$logo.'" alt="LUKA OUTDOOR">
    </div>
    '.$content.'
    <div class="ft">
      <p style="color:#9a9288;font-size:13px;margin-bottom:8px">LUKA OUTDOOR &mdash; Premium Outdoor Fire Culture</p>
      <p><a href="https://lukaoutdoor.com">lukaoutdoor.com</a></p>
    </div>
  </div>
</div>
</body></html>';
}

function render_product_rows(array $items): string {
    $base = 'https://lukaoutdoor.com/';
    $html = '';
    foreach ($items as $i) {
        $name  = htmlspecialchars($i['name'] ?? 'Товар');
        $qty   = (int)($i['qty'] ?? 1);
        $price = (int)($i['price'] ?? 0);
        $img   = !empty($i['image']) ? '<img src="'.$base.htmlspecialchars($i['image']).'" alt="'.$name.'">' : '<span class="no-img"></span>';
        $html .= '
        <div class="prod-card">
          <div class="prod-img">'.$img.'</div>
          <div class="prod-info">
            <div class="prod-name">'.$name.'</div>
            <div class="prod-meta">'.$qty.' шт.</div>
          </div>
          <div class="prod-price">'.number_format($price * $qty, 0, '.', '&nbsp;').'&nbsp;&#8381;</div>
        </div>';
    }
    return $html;
}

function send_admin_email(array $order, array $items, string $adminEmail): void {
    $id    = $order['id'];
    $name  = htmlspecialchars($order['name']);
    $phone = htmlspecialchars($order['phone']);
    $city  = htmlspecialchars($order['city']);
    $total = number_format($order['total'], 0, '.', '&nbsp;');
    $prodRows = render_product_rows($items);

    $content = '
    <div style="background:#c9792b;padding:12px 40px;text-align:center">
      <span style="color:#fff;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">
        &#9889; Новый заказ #'.$id.' &mdash; '.date('d.m.Y H:i').'
      </span>
    </div>
    <div class="bd">
      <div class="section-title">Покупатель</div>
      <div class="info-grid">
        <div class="info-cell">
          <div class="info-label">Имя</div>
          <div class="info-value">'.$name.'</div>
        </div>
        <div class="info-cell">
          <div class="info-label">Телефон</div>
          <div class="info-value"><a href="tel:'.$order['phone'].'" style="color:#c9792b">'.$phone.'</a></div>
        </div>
        <div class="info-cell">
          <div class="info-label">Город / адрес</div>
          <div class="info-value">'.$city.'</div>
        </div>
        <div class="info-cell">
          <div class="info-label">Доставка</div>
          <div class="info-value">'.htmlspecialchars($order['delivery']).'</div>
        </div>
        <div class="info-cell">
          <div class="info-label">Оплата</div>
          <div class="info-value">'.htmlspecialchars($order['payment']).'</div>
        </div>
      </div>
      '.($order['comment'] ? '<div class="section-title">Комментарий</div><p style="font-size:14px;color:#555;margin-bottom:24px;padding:12px;background:#fafafa;border-radius:8px;border-left:3px solid #c9792b">'.nl2br(htmlspecialchars($order['comment'])).'</p>' : '').'
      <div class="section-title">Состав заказа</div>
      '.$prodRows.'
      <div class="total-row">
        <span class="total-label">Итого</span>
        <span class="total-value">'.$total.'&nbsp;&#8381;</span>
      </div>
      <div class="btn-wrap">
        <a href="https://lukaoutdoor.com/admin/?tab=orders" class="btn">Открыть в CRM &rarr;</a>
      </div>
    </div>';

    $html = email_base('Новый заказ #'.$id.' от '.$order['name'], $content);
    send_order_email($adminEmail, 'Новый заказ #'.$id.' — '.$order['name'].' ('.$order['total'].' руб)', $html);
}

function send_customer_email(array $order, array $items, string $customerEmail): void {
    $name     = htmlspecialchars($order['name']);
    $id       = $order['id'];
    $total    = number_format($order['total'], 0, '.', '&nbsp;');
    $prodRows = render_product_rows($items);

    $content = '
    <div style="background:linear-gradient(135deg,#0b0b0b 0%,#1a1008 100%);padding:28px 40px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">&#128293;</div>
      <div style="color:#c9792b;font-size:24px;font-weight:700;margin-bottom:4px">
        Заказ #'.$id.' принят!
      </div>
      <div style="color:#9a9288;font-size:14px">Спасибо за покупку, '.$name.'</div>
    </div>
    <div class="bd">
      <p style="font-size:15px;color:#444;line-height:1.7;margin-bottom:24px">
        Мы уже обрабатываем ваш заказ. Наш менеджер свяжется с вами в ближайшее время для подтверждения и уточнения деталей доставки.
      </p>

      <div class="section-title">Ваш заказ</div>
      '.$prodRows.'
      <div class="total-row">
        <span class="total-label">Итого</span>
        <span class="total-value">'.$total.'&nbsp;&#8381;</span>
      </div>

      <div class="divider"></div>

      <div class="section-title">Доставка</div>
      <table style="width:100%;font-size:14px;color:#555;line-height:1.8;margin-bottom:24px">
        <tr>
          <td style="padding:6px 0">&#128666; Доставка через <b>СДЭК</b></td>
          <td style="text-align:right;color:#111;font-weight:600">3&ndash;7 дней</td>
        </tr>
        <tr>
          <td style="padding:6px 0">&#128221; Трек-номер</td>
          <td style="text-align:right;color:#888">Пришлём когда отправим</td>
        </tr>
        <tr>
          <td style="padding:6px 0">&#128260; Возврат</td>
          <td style="text-align:right;color:#111;font-weight:600">14 дней</td>
        </tr>
      </table>

      <div style="background:#fafafa;border-radius:12px;padding:20px;border:1px solid #f0f0f0;margin-bottom:24px">
        <div style="font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Есть вопросы?</div>
        <a href="tel:88001234567" style="display:block;font-size:15px;font-weight:700;color:#c9792b;margin-bottom:6px">
          &#128222; 8 800 123-45-67
        </a>
        <a href="mailto:hello@lukaoutdoor.com" style="font-size:14px;color:#888">
          hello@lukaoutdoor.com
        </a>
      </div>

      <div class="btn-wrap">
        <a href="https://lukaoutdoor.com/catalog.php" class="btn">Смотреть каталог</a>
      </div>
    </div>';

    $html = email_base('Ваш заказ #'.$id.' принят — скоро свяжемся с вами!', $content);
    send_order_email($customerEmail, 'Заказ #'.$id.' принят — LUKA OUTDOOR', $html);
}

// ── Основная логика ───────────────────────────────────────────────────────────
try{
    $csrfToken   = $_POST['csrf_token'] ?? '';
    $sessionToken = $_SESSION['csrf_token'] ?? '';
    // Проверяем только если оба токена присутствуют
    if ($csrfToken && $sessionToken && !hash_equals($sessionToken, $csrfToken)) {
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
        // Загружаем фото товаров для писем
        $productIds = array_filter(array_map(fn($i) => is_numeric($i['id'] ?? null) ? (int)$i['id'] : null, $cart));
        $productImages = [];
        if (!empty($productIds)) {
            $ph  = implode(',', array_fill(0, count($productIds), '?'));
            $pst = $pdo->prepare("SELECT id, image FROM products WHERE id IN ($ph)");
            $pst->execute(array_values($productIds));
            foreach ($pst->fetchAll(PDO::FETCH_ASSOC) as $pr) {
                $productImages[$pr['id']] = $pr['image'];
            }
        }
        foreach($cart as $i){
            $iName  = $i['name'] ?? 'Товар';
            $iPrice = (int)($i['price'] ?? 0);
            $iQty   = max(1,(int)($i['qty'] ?? 1));
            $iId    = is_numeric($i['id'] ?? null) ? (int)$i['id'] : null;
            $iImg   = $iId ? ($productImages[$iId] ?? '') : '';
            $itemStmt->execute([$orderId, $iId, $iName, $iPrice, $iQty]);
            $orderItems[] = ['name'=>$iName,'price'=>$iPrice,'qty'=>$iQty,'image'=>$iImg];
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
