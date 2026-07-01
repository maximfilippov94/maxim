<?php
require __DIR__.'/includes/db.php';
require __DIR__.'/includes/nav.php';
$pdo = db();
$title = 'Спасибо за заявку — LUKA OUTDOOR';
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($title)?></title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" type="image/png" href="/assets/images/favicon.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v=4.0.0">
<style>
.thanksPage{min-height:80vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:80px 24px}
.thanksInner{max-width:600px}
.thanksIcon{width:72px;height:72px;border-radius:50%;background:rgba(201,121,43,.15);border:1px solid rgba(201,121,43,.3);display:flex;align-items:center;justify-content:center;margin:0 auto 32px;font-size:32px}
.thanksPage h1{font-family:var(--head);font-size:clamp(52px,9vw,96px);line-height:.9;text-transform:uppercase;margin:0 0 20px}
.thanksPage p{color:var(--muted);font-size:18px;line-height:1.6;margin:0 0 40px;max-width:460px;margin-left:auto;margin-right:auto}
.thanksActions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
</style>
</head>
<body>
<?php include __DIR__.'/includes/metrika.php'; ?>
<?php render_topbar($pdo); ?>

<main class="thanksPage">
  <div class="thanksInner">

    <p class="eyebrow">LUKA OUTDOOR</p>
    <h1>Заявка принята</h1>
    <p>Мы получили вашу заявку и свяжемся с вами в течение нескольких часов. Пока можете посмотреть другие товары коллекции.</p>
    <div class="thanksActions">
      <a class="btn primary" href="/catalog.php">Смотреть каталог</a>
      <a class="btn ghost" href="/">На главную</a>
    </div>
  </div>
</main>

<footer class="footer">
  <div><img src="/assets/images/logo_luka_new.png" alt="LUKA OUTDOOR" class="footerLogo"><p>LIVE OUTSIDE. EXPLORE MORE.</p></div>
  <nav>
    <?php foreach(get_nav_items($pdo) as $ni): ?>
    <a href="<?=h($ni['url'])?>"><?=h($ni['label'])?></a>
    <?php endforeach; ?>
  </nav>
</footer>
<script src="/assets/script.js?v=4.0.0"></script>
<script>
// Яндекс.Метрика — цель "покупка"
(function(){
  try {
    // Читаем данные заказа из localStorage если есть
    const cart = JSON.parse(localStorage.getItem('luka_cart') || '[]');
    const total = cart.reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||1), 0);
    const items = cart.map(i=>({id:i.id, name:i.name, price:i.price, quantity:i.qty||1}));
    if(typeof ym === 'function'){
      ym(110312362, 'reachGoal', 'purchase', {
        order_price: total,
        currency: 'RUB',
        products: items
      });
    }
    // Очищаем корзину после успешного заказа
    localStorage.removeItem('luka_cart');
  } catch(e){}
})();
</script>
</body>
</html>
