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
    // BG colors spelled out as hex so Apple Mail cannot override them in light mode
    return '<!doctype html>
<html lang="ru" style="background:#050505">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>LUKA OUTDOOR</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:0; background:#050505 !important; -webkit-text-size-adjust:100%; }
  /* Force dark in Apple Mail / iOS */
  @media (prefers-color-scheme: light) {
    body, .email-bg { background:#050505 !important; }
    .card-bg        { background:#111110 !important; }
    .hd-bg          { background:#0b0b0b !important; }
    .ft-bg          { background:#050505 !important; }
    .hero-bg        { background:#0b0b0b !important; }
    .bar-bg         { background:#c9792b !important; }
    .total-bg       { background:#050505 !important; }
    .prod-bg        { background:#111110 !important; }
    .contact-bg     { background:#111110 !important; }
    .comment-bg     { background:#1a1a18 !important; }
    .text-main      { color:#f3f1ec !important; }
    .text-muted     { color:#9a9288 !important; }
    .text-soft      { color:#d6cfc5 !important; }
    .text-copper    { color:#c9792b !important; }
    .border-sub     { border-color:rgba(243,241,236,0.10) !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,Helvetica,sans-serif" class="email-bg">
<span style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#050505;mso-hide:all">'.$preheader.'</span>

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050505" class="email-bg" style="background:#050505">
  <tr><td align="center" style="padding:28px 12px;background:#050505" class="email-bg">

    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%" class="card-bg">

      <!-- Header -->
      <tr>
        <td bgcolor="#0b0b0b" class="hd-bg" style="background:#0b0b0b;padding:26px 36px 20px;text-align:center;border-bottom:2px solid #c9792b">
          <img src="'.$logo.'" alt="LUKA OUTDOOR" height="42" style="display:block;margin:0 auto;height:42px">
        </td>
      </tr>

      <!-- Content -->
      <tr>
        <td bgcolor="#111110" class="card-bg" style="background:#111110">
          '.$content.'
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td bgcolor="#050505" class="ft-bg" style="background:#050505;padding:20px 36px;text-align:center;border-top:1px solid #1e1e1c">
          <p style="margin:0 0 5px;font-size:11px;color:#9a9288;letter-spacing:.08em;text-transform:uppercase" class="text-muted">LUKA OUTDOOR &mdash; Premium Outdoor Fire Culture</p>
          <p style="margin:0"><a href="https://lukaoutdoor.com" style="font-size:11px;color:#c9792b;text-decoration:none" class="text-copper">lukaoutdoor.com</a></p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body></html>';
}

function render_product_rows(array $items): string {
    $base = 'https://lukaoutdoor.com/';
    $html = '';
    foreach ($items as $i) {
        $name  = htmlspecialchars($i['name'] ?? 'Товар');
        $qty   = (int)($i['qty'] ?? 1);
        $price = (int)($i['price'] ?? 0);
        $imgTag = !empty($i['image'])
            ? '<img src="'.$base.htmlspecialchars($i['image']).'" alt="'.$name.'" width="80" height="80" style="display:block;width:80px;height:80px;object-fit:cover">'
            : '<div style="width:80px;height:80px;background:#1a1a18" class="comment-bg"></div>';
        $html .= '
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1a1a18" class="prod-bg" style="margin-bottom:8px;border:1px solid #2a2a28;border-radius:8px;overflow:hidden;background:#1a1a18">
          <tr>
            <td width="80" bgcolor="#1a1a18" style="background:#1a1a18;vertical-align:top" class="prod-bg">'.$imgTag.'</td>
            <td bgcolor="#1a1a18" style="background:#1a1a18;padding:12px 12px;vertical-align:middle" class="prod-bg">
              <div style="font-size:14px;font-weight:700;color:#f3f1ec;margin-bottom:3px" class="text-main">'.$name.'</div>
              <div style="font-size:12px;color:#9a9288" class="text-muted">'.$qty.'&nbsp;шт.</div>
            </td>
            <td bgcolor="#1a1a18" style="background:#1a1a18;padding:12px 14px;vertical-align:middle;text-align:right;white-space:nowrap;font-size:16px;font-weight:700;color:#c9792b;width:95px" class="prod-bg text-copper">
              '.number_format($price * $qty, 0, '.', '&nbsp;').'&nbsp;&#8381;
            </td>
          </tr>
        </table>';
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
      <!-- Orange alert bar -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td bgcolor="#c9792b" class="bar-bg" style="background:#c9792b;padding:11px 36px;text-align:center">
          <span style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">
            Новый заказ #'.$id.' &mdash; '.date('d.m.Y H:i').'
          </span>
        </td></tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td bgcolor="#111110" class="card-bg" style="background:#111110;padding:24px 32px 0">

          <!-- Customer block -->
          <p style="margin:0 0 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9a9288;padding-bottom:8px;border-bottom:1px solid #252523" class="text-muted">Покупатель</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px">
            <tr>
              <td width="50%" bgcolor="#111110" style="background:#111110;padding:8px 0;border-bottom:1px solid #1e1e1c;vertical-align:top" class="card-bg">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#9a9288;margin-bottom:3px" class="text-muted">Имя</div>
                <div style="font-size:14px;font-weight:700;color:#f3f1ec" class="text-main">'.$name.'</div>
              </td>
              <td width="50%" bgcolor="#111110" style="background:#111110;padding:8px 0 8px 16px;border-bottom:1px solid #1e1e1c;vertical-align:top" class="card-bg">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#9a9288;margin-bottom:3px" class="text-muted">Телефон</div>
                <div style="font-size:14px;font-weight:700"><a href="tel:'.$order['phone'].'" style="color:#c9792b;text-decoration:none" class="text-copper">'.$phone.'</a></div>
              </td>
            </tr>
            <tr>
              <td width="50%" bgcolor="#111110" style="background:#111110;padding:8px 0;border-bottom:1px solid #1e1e1c;vertical-align:top" class="card-bg">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#9a9288;margin-bottom:3px" class="text-muted">Город / адрес доставки</div>
                <div style="font-size:14px;font-weight:700;color:#f3f1ec" class="text-main">'.$city.'</div>
              </td>
              <td width="50%" bgcolor="#111110" style="background:#111110;padding:8px 0 8px 16px;border-bottom:1px solid #1e1e1c;vertical-align:top" class="card-bg">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#9a9288;margin-bottom:3px" class="text-muted">Способ доставки</div>
                <div style="font-size:14px;font-weight:700;color:#f3f1ec" class="text-main">'.htmlspecialchars($order['delivery']).'</div>
              </td>
            </tr>
            <tr>
              <td colspan="2" bgcolor="#111110" style="background:#111110;padding:8px 0;vertical-align:top" class="card-bg">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#9a9288;margin-bottom:3px" class="text-muted">Оплата</div>
                <div style="font-size:14px;font-weight:700;color:#f3f1ec" class="text-main">'.htmlspecialchars($order['payment']).'</div>
              </td>
            </tr>
          </table>

          '.($order['comment'] ? '
          <p style="margin:0 0 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9a9288;padding-bottom:8px;border-bottom:1px solid #252523" class="text-muted">Комментарий</p>
          <p style="font-size:14px;color:#d6cfc5;line-height:1.7;margin:0 0 20px;padding:12px 16px;background:#1a1a18;border-radius:8px;border-left:3px solid #c9792b" class="comment-bg text-soft">'.nl2br(htmlspecialchars($order['comment'])).'</p>
          ' : '').'

          <!-- Products -->
          <p style="margin:0 0 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9a9288;padding-bottom:8px;border-bottom:1px solid #252523" class="text-muted">Состав заказа</p>
          '.$prodRows.'

          <!-- Total -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050505" class="total-bg" style="margin:10px 0 20px;background:#050505;border-radius:8px;border:1px solid #252523">
            <tr>
              <td bgcolor="#050505" class="total-bg" style="background:#050505;padding:13px 18px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#9a9288" class="text-muted">Итого</td>
              <td bgcolor="#050505" class="total-bg" style="background:#050505;padding:13px 18px;text-align:right;font-size:22px;font-weight:700;color:#c9792b" class="text-copper">'.$total.'&nbsp;&#8381;</td>
            </tr>
          </table>

          <!-- CRM button -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
            <tr><td align="center">
              <a href="https://lukaoutdoor.com/admin/?tab=orders" style="display:inline-block;background:#c9792b;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase">Открыть в CRM &rarr;</a>
            </td></tr>
          </table>

        </td></tr>
      </table>';

    $html = email_base('Новый заказ #'.$id.' от '.$order['name'], $content);
    send_order_email($adminEmail, 'Новый заказ #'.$id.' — '.$order['name'].' ('.$order['total'].' руб)', $html);
}

function send_customer_email(array $order, array $items, string $customerEmail): void {
    $name     = htmlspecialchars($order['name']);
    $id       = $order['id'];
    $total    = number_format($order['total'], 0, '.', '&nbsp;');
    $prodRows = render_product_rows($items);

    $city = htmlspecialchars($order['city']);
    $content = '
      <!-- Hero block -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td bgcolor="#0b0b0b" class="hd-bg" style="background:#0b0b0b;padding:32px 36px;text-align:center;border-bottom:2px solid #c9792b">
          <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.18em;color:#9a9288" class="text-muted">Подтверждение заказа</p>
          <p style="margin:0 0 6px;font-size:26px;font-weight:700;color:#c9792b;letter-spacing:.02em" class="text-copper">Заказ #'.$id.' принят</p>
          <p style="margin:0;font-size:14px;color:#9a9288" class="text-muted">Спасибо за покупку, '.$name.'</p>
        </td></tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td bgcolor="#111110" class="card-bg" style="background:#111110;padding:24px 32px 0">

          <p style="margin:0 0 22px;font-size:14px;color:#d6cfc5;line-height:1.8" class="text-soft">
            Мы уже обрабатываем ваш заказ. Наш менеджер свяжется с вами в ближайшее время для подтверждения и уточнения деталей доставки.
          </p>

          <!-- Products -->
          <p style="margin:0 0 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9a9288;padding-bottom:8px;border-bottom:1px solid #252523" class="text-muted">Ваш заказ</p>
          '.$prodRows.'

          <!-- Total -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050505" class="total-bg" style="margin:10px 0 20px;background:#050505;border-radius:8px;border:1px solid #252523">
            <tr>
              <td bgcolor="#050505" class="total-bg" style="background:#050505;padding:13px 18px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#9a9288">Итого</td>
              <td bgcolor="#050505" class="total-bg" style="background:#050505;padding:13px 18px;text-align:right;font-size:22px;font-weight:700;color:#c9792b" class="text-copper">'.$total.'&nbsp;&#8381;</td>
            </tr>
          </table>

          <!-- Delivery info -->
          <p style="margin:0 0 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9a9288;padding-bottom:8px;border-bottom:1px solid #252523" class="text-muted">Доставка</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px">
            <tr>
              <td bgcolor="#111110" class="card-bg" style="background:#111110;padding:8px 0;font-size:14px;color:#d6cfc5;border-bottom:1px solid #1e1e1c" class="text-soft">Адрес доставки</td>
              <td bgcolor="#111110" class="card-bg" style="background:#111110;padding:8px 0;text-align:right;font-size:14px;font-weight:700;color:#f3f1ec;border-bottom:1px solid #1e1e1c" class="text-main">'.$city.'</td>
            </tr>
            <tr>
              <td bgcolor="#111110" class="card-bg" style="background:#111110;padding:8px 0;font-size:14px;color:#d6cfc5;border-bottom:1px solid #1e1e1c" class="text-soft">Доставка через СДЭК</td>
              <td bgcolor="#111110" class="card-bg" style="background:#111110;padding:8px 0;text-align:right;font-size:14px;font-weight:700;color:#f3f1ec;border-bottom:1px solid #1e1e1c" class="text-main">3&ndash;7 дней</td>
            </tr>
            <tr>
              <td bgcolor="#111110" class="card-bg" style="background:#111110;padding:8px 0;font-size:14px;color:#d6cfc5;border-bottom:1px solid #1e1e1c" class="text-soft">Трек-номер</td>
              <td bgcolor="#111110" class="card-bg" style="background:#111110;padding:8px 0;text-align:right;font-size:14px;color:#9a9288;border-bottom:1px solid #1e1e1c" class="text-muted">Пришлём когда отправим</td>
            </tr>
            <tr>
              <td bgcolor="#111110" class="card-bg" style="background:#111110;padding:8px 0;font-size:14px;color:#d6cfc5" class="text-soft">Возврат</td>
              <td bgcolor="#111110" class="card-bg" style="background:#111110;padding:8px 0;text-align:right;font-size:14px;font-weight:700;color:#f3f1ec" class="text-main">14 дней</td>
            </tr>
          </table>

          <!-- Contact box -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1a1a18" class="contact-bg" style="margin-bottom:20px;background:#1a1a18;border-radius:8px;border:1px solid #252523">
            <tr><td bgcolor="#1a1a18" class="contact-bg" style="background:#1a1a18;padding:18px 20px">
              <p style="margin:0 0 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9a9288" class="text-muted">Есть вопросы?</p>
              <a href="tel:88001234567" style="display:block;font-size:16px;font-weight:700;color:#c9792b;text-decoration:none;margin-bottom:5px" class="text-copper">8 800 123-45-67</a>
              <a href="mailto:hello@lukaoutdoor.com" style="font-size:13px;color:#9a9288;text-decoration:none" class="text-muted">hello@lukaoutdoor.com</a>
            </td></tr>
          </table>

          <!-- Catalog button -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
            <tr><td align="center">
              <a href="https://lukaoutdoor.com/catalog.php" style="display:inline-block;background:#c9792b;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase">Смотреть каталог</a>
            </td></tr>
          </table>

        </td></tr>
      </table>';

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
    // Генерируем красивый номер заказа (от 6000+) и сохраняем в БД
    $displayOrderId = 6470 + rand(1, 99) * 10 + $orderId;
    $pdo->prepare('UPDATE orders SET display_id=? WHERE id=?')->execute([$displayOrderId, $orderId]);

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
        'id'       => $displayOrderId,
        'real_id'  => $orderId,
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
