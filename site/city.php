<?php
require __DIR__.'/includes/db.php';
require __DIR__.'/includes/nav.php';
$pdo = db();
require __DIR__.'/includes/cities_data.php';

$slug = trim($_GET['slug'] ?? '');

// Ищем город по slug
$city = null;
foreach($cities_data as $c){
    if($c['slug'] === $slug){ $city = $c; break; }
}
if(!$city){ http_response_code(404); echo 'Город не найден'; exit; }

// Товары — случайные 8 или по sort_order
$products = $pdo->query("SELECT p.*, c.name category_name, c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.is_active=1 ORDER BY p.sort_order,p.id LIMIT 8")->fetchAll(PDO::FETCH_ASSOC);

// Категории
$categories = $pdo->query("SELECT * FROM categories WHERE is_active=1 AND (parent_id IS NULL OR parent_id=0) ORDER BY sort_order,id")->fetchAll(PDO::FETCH_ASSOC);

$cityName = $city['name'];
$cityNameIn = $city['name_in'] ?? $cityName; // «в Москве», «в Казани» и т.д.

$title = "Костровые чаши и outdoor снаряжение с доставкой {$cityNameIn} — LUKA OUTDOOR";
$desc  = "Купить костровые чаши, outdoor одежду и снаряжение с доставкой {$cityNameIn}. Пункты выдачи СДЭК, быстрая доставка по России.";
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($title)?></title>
<meta name="description" content="<?=h($desc)?>">
<link rel="canonical" href="https://lukaoutdoor.com/city/<?=h($slug)?>">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v=5.0.0">
</head>
<body>
<?php render_topbar($pdo); ?>

<main style="padding-top:100px;padding-bottom:60px">
  <div style="width:min(1200px,calc(100vw - 120px));margin:0 auto">

    <nav style="font-size:12px;color:var(--muted);margin-bottom:20px">
      <a href="/" style="color:var(--muted)">Главная</a>
      <span style="margin:0 6px">›</span>
      <a href="/cities.php" style="color:var(--muted)">Города доставки</a>
      <span style="margin:0 6px">›</span>
      <b style="color:var(--text)"><?=h($cityName)?></b>
    </nav>

    <div style="margin-bottom:36px;padding-bottom:28px;border-bottom:1px solid rgba(243,241,236,.08)">
      <p class="eyebrow">ДОСТАВКА <?=h(mb_strtoupper($cityNameIn))?></p>
      <h1 style="font-family:var(--head);font-size:clamp(36px,5vw,72px);text-transform:uppercase;line-height:.9;margin:0 0 14px">LUKA OUTDOOR — <?=h($cityName)?></h1>
      <p style="font-size:15px;color:var(--muted);max-width:540px;line-height:1.5">Костровые чаши и outdoor снаряжение с доставкой <?=h($cityNameIn)?> через СДЭК.</p>
    </div>

    <!-- ПВЗ + доставка info в одном блоке -->
    <div class="cityPvzGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:40px;align-items:start">
      <div>
        <p class="eyebrow" style="margin-bottom:10px">ПУНКТЫ ВЫДАЧИ СДЭК</p>
        <div id="pvzList" style="display:grid;grid-template-columns:1fr;gap:8px"><div style="color:var(--muted);font-size:13px">Загружаем...</div></div>
      </div>
      <div style="background:rgba(255,255,255,.02);border:1px solid rgba(243,241,236,.08);border-radius:18px;padding:22px">
        <p class="eyebrow" style="margin-bottom:12px">КАК ПОЛУЧИТЬ</p>
        <div style="display:grid;gap:12px">
          <div><p style="color:var(--copper2);font-weight:700;font-size:13px;margin:0 0 3px">Самовывоз из ПВЗ</p><p style="color:var(--muted);font-size:13px;line-height:1.4;margin:0">Адреса пунктов СДЭК <?=h($cityNameIn)?> — слева.</p></div>
          <div><p style="color:var(--copper2);font-weight:700;font-size:13px;margin:0 0 3px">Курьер до двери</p><p style="color:var(--muted);font-size:13px;line-height:1.4;margin:0">Доставка СДЭК по адресу <?=h($cityNameIn)?>.</p></div>
          <div><p style="color:var(--copper2);font-weight:700;font-size:13px;margin:0 0 3px">Отправка</p><p style="color:var(--muted);font-size:13px;line-height:1.4;margin:0">Из Тольятти в течение 1–2 рабочих дней.</p></div>
        </div>
      </div>
    </div>

    <?php if(!empty($categories)): ?>
    <div style="margin-bottom:36px">
      <p class="eyebrow" style="margin-bottom:8px">КАТАЛОГ</p>
      <h2 style="font-family:var(--head);font-size:clamp(28px,3vw,48px);text-transform:uppercase;line-height:.9;margin:0 0 16px">Все категории</h2>
      <div class="cityCatGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
        <?php foreach($categories as $cat): ?>
        <a href="/catalog.php?cat=<?=h($cat['slug'])?>" style="position:relative;border-radius:14px;overflow:hidden;aspect-ratio:3/2;background:#0d0d0d;border:1px solid rgba(243,241,236,.08);text-decoration:none;display:block;transition:.3s" onmouseover="this.style.borderColor='rgba(201,121,43,.4)'" onmouseout="this.style.borderColor='rgba(243,241,236,.08)'">
          <?php if(!empty($cat['image'])): ?>
          <img src="/<?=h($cat['image'])?>" alt="<?=h($cat['name'])?>" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">
          <?php endif; ?>
          <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.8),transparent 60%);z-index:1"></div>
          <div style="position:absolute;bottom:0;left:0;right:0;padding:10px;z-index:2;font-family:var(--head);font-size:16px;text-transform:uppercase;color:#fff;line-height:1"><?=h($cat['name'])?></div>
        </a>
        <?php endforeach; ?>
        <a href="/catalog.php" style="border-radius:14px;aspect-ratio:3/2;background:rgba(201,121,43,.08);border:1px solid rgba(201,121,43,.25);text-decoration:none;display:flex;align-items:center;justify-content:center;font-family:var(--head);font-size:16px;text-transform:uppercase;color:var(--copper2);transition:.3s" onmouseover="this.style.background='rgba(201,121,43,.15)'" onmouseout="this.style.background='rgba(201,121,43,.08)'">Весь каталог</a>
      </div>
    </div>
    <?php endif; ?>

    <?php if(!empty($products)): ?>
    <div style="margin-bottom:40px">
      <p class="eyebrow" style="margin-bottom:8px">ПОПУЛЯРНОЕ</p>
      <h2 style="font-family:var(--head);font-size:clamp(28px,3vw,48px);text-transform:uppercase;line-height:.9;margin:0 0 20px">Товары с доставкой <?=h($cityNameIn)?></h2>
      <div class="productsGrid v2Grid">
        <?php foreach($products as $p):
          $payload=["id"=>(int)$p["id"],"name"=>$p["name"],"price"=>(int)$p["price"],"image"=>$p["image"] ?: 'assets/images/hero.webp'];
        ?>
        <article class="product cardV2 reveal">
          <a class="productImg" href="/product.php?slug=<?=h($p['slug'] ?: $p['id'])?>"><img loading="lazy" src="/<?=h($p['image'] ?: 'assets/images/hero.webp')?>" alt="<?=h($p['name'])?>">
          <?php if($p['badge']): ?><em><?=h($p['badge'])?></em><?php endif; ?></a>
          <div class="productBody">
            <small><?=h($p['category_name'])?></small>
            <h3><?=h($p['name'])?></h3>
            <div class="priceLine"><strong><?=money($p['price'])?></strong><button onclick='addToCart(<?=json_encode($payload,JSON_UNESCAPED_UNICODE)?>,this)'>+</button></div>
            <a class="details" href="/product.php?slug=<?=h($p['slug'] ?: $p['id'])?>">Подробнее</a>
          </div>
        </article>
        <?php endforeach; ?>
      </div>
      <div style="margin-top:20px;text-align:center">
        <a href="/catalog.php" class="btn ghost">Смотреть весь каталог</a>
      </div>
    </div>
    <?php endif; ?>

    <!-- SEO блок: категории с ключевыми фразами -->
    <?php if(!empty($categories)): ?>
    <div style="margin-top:48px;padding-top:32px;border-top:1px solid rgba(243,241,236,.08)">
      <p class="eyebrow" style="margin-bottom:12px">КУПИТЬ <?=h(mb_strtoupper($cityNameIn))?></p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">
        <?php foreach($categories as $cat): ?>
        <a href="/catalog.php?cat=<?=h($cat['slug'])?>" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid rgba(243,241,236,.07);border-radius:14px;text-decoration:none;background:rgba(255,255,255,.02);transition:.2s" onmouseover="this.style.borderColor='rgba(201,121,43,.3)'" onmouseout="this.style.borderColor='rgba(243,241,236,.07)'">
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:3px"><?=h($cat['name'])?> с доставкой <?=h($cityNameIn)?></div>
            <div style="font-size:12px;color:var(--muted)">Купить <?=h(mb_strtolower($cat['name']))?> — доставка СДЭК</div>
          </div>
          <span style="margin-left:auto;color:var(--copper2);font-size:18px;flex-shrink:0">→</span>
        </a>
        <?php endforeach; ?>
      </div>
    </div>
    <?php endif; ?>

  </div>
</main>

<?php render_footer($pdo); ?>
<?php include __DIR__.'/includes/cart.php'; ?>
<script src="/assets/script.js?v=5.0.0"></script>
<script>
// Загружаем ПВЗ через CDEK API
(async function(){
  const cityCode = <?=(int)($city['cdek_code'] ?? 0)?>;
  if(!cityCode) return;
  try {
    const r = await fetch('/cdek.php?action=pvz&city_code=' + cityCode);
    const pvz = await r.json();
    const list = document.getElementById('pvzList');
    if(!pvz.length){ list.innerHTML = '<p style="color:var(--muted);font-size:15px">Нет данных о пунктах выдачи</p>'; return; }
    list.innerHTML = pvz.slice(0,6).map(p => `
      <div style="background:rgba(255,255,255,.02);border:1px solid rgba(243,241,236,.08);border-radius:12px;padding:14px">
        <div style="font-weight:600;font-size:13px;margin-bottom:4px;line-height:1.3">${p.address}</div>
        <div style="color:var(--muted);font-size:12px;line-height:1.4">${p.work_time || ''}</div>
      </div>
    `).join('');
  } catch(e) {}
})();
</script>
</body>
</html>
