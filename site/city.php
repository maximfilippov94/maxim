<?php
require __DIR__.'/includes/db.php';
require __DIR__.'/includes/nav.php';
$pdo = db();
require __DIR__.'/includes/cities_data.php';

$slug = trim($_GET['slug'] ?? '');

$city = null;
foreach($cities_data as $c){
    if($c['slug'] === $slug){ $city = $c; break; }
}
if(!$city){ http_response_code(404); echo 'Город не найден'; exit; }

$products = $pdo->query("SELECT p.*, c.name category_name, c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.is_active=1 ORDER BY p.sort_order,p.id LIMIT 8")->fetchAll(PDO::FETCH_ASSOC);
$categories = $pdo->query("SELECT * FROM categories WHERE is_active=1 AND (parent_id IS NULL OR parent_id=0) ORDER BY sort_order,id")->fetchAll(PDO::FETCH_ASSOC);
$subcategories = $pdo->query("SELECT * FROM categories WHERE is_active=1 AND parent_id IS NOT NULL AND parent_id>0 ORDER BY sort_order,id")->fetchAll(PDO::FETCH_ASSOC);

$cityName   = $city['name'];
$cityNameIn = $city['name_in'] ?? $cityName;

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
<link rel="stylesheet" href="/assets/style.css?v=6.2.0">
<style>
.cityPage { width: min(var(--max), calc(100vw - 120px)); margin: 0 auto; padding: 120px 0 100px; }
.cityHero { margin-bottom: 48px; padding-bottom: 32px; border-bottom: 1px solid rgba(243,241,236,.08); }
.cityHero h1 { font-family: var(--head); font-size: clamp(42px,7vw,80px); text-transform: uppercase; line-height: .9; margin: 0 0 12px; }
.cityHero p { font-size: 16px; color: var(--muted); max-width: 520px; line-height: 1.55; margin: 0; }

.cityInfoGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 56px;
  align-items: start;
}
.pvzSection {}
.pvzList { display: grid; gap: 10px; margin-top: 14px; }
.pvzCard {
  background: rgba(255,255,255,.02);
  border: 1px solid rgba(243,241,236,.08);
  border-radius: var(--radius-md);
  padding: 16px 18px;
  transition: border-color 200ms ease;
}
.pvzCard:hover { border-color: rgba(201,121,43,.25); }
.pvzCard strong { display: block; font-size: 13px; font-weight: 600; line-height: 1.35; margin-bottom: 4px; }
.pvzCard small { font-size: 12px; color: var(--muted); }

.deliveryInfoCard {
  background: rgba(255,255,255,.02);
  border: 1px solid rgba(243,241,236,.08);
  border-radius: var(--radius-lg);
  padding: 28px;
}
.deliveryStep { padding: 14px 0; border-bottom: 1px solid rgba(243,241,236,.06); }
.deliveryStep:last-child { border-bottom: none; padding-bottom: 0; }
.deliveryStep strong { display: block; font-size: 13px; font-weight: 700; color: var(--copper2); margin-bottom: 4px; }
.deliveryStep p { font-size: 13px; color: var(--muted); line-height: 1.45; margin: 0; }

.citySection { margin-bottom: 52px; }
.citySection h2 { font-family: var(--head); font-size: clamp(28px,3.5vw,52px); text-transform: uppercase; line-height: .9; margin: 0 0 20px; }

.cityCatsGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}
.cityCatCard {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  aspect-ratio: 3 / 2;
  background: #0d0d0d;
  border: 1px solid rgba(243,241,236,.08);
  text-decoration: none;
  display: block;
  transition: border-color 250ms ease, transform 250ms ease;
}
.cityCatCard:hover { border-color: rgba(201,121,43,.4); transform: translateY(-2px); }
.cityCatCard img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cityCatCard .overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.82), transparent 60%); z-index: 1; }
.cityCatCard .label { position: absolute; bottom: 0; left: 0; right: 0; padding: 10px 12px; z-index: 2; font-family: var(--head); font-size: 17px; text-transform: uppercase; color: #fff; line-height: 1; }
.cityCatPlaceholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background:
    radial-gradient(ellipse 80% 60% at 50% 110%, rgba(201,121,43,.2) 0%, transparent 70%),
    linear-gradient(160deg, #0f0f0d 0%, #050505 100%);
}
.cityCatPlaceholder::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(45deg, rgba(201,121,43,.03) 0px, rgba(201,121,43,.03) 1px, transparent 1px, transparent 22px);
  pointer-events: none;
}
.cityCatPlaceholder svg {
  width: 36px; height: 36px;
  opacity: .65;
  position: relative;
  filter: drop-shadow(0 0 8px rgba(201,121,43,.5));
}
.cityCatAll {
  border-radius: var(--radius-md);
  aspect-ratio: 3 / 2;
  background: rgba(201,121,43,.08);
  border: 1px solid rgba(201,121,43,.25);
  text-decoration: none;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--head); font-size: 17px; text-transform: uppercase; color: var(--copper2);
  transition: background 200ms ease, border-color 200ms ease;
}
.cityCatAll:hover { background: rgba(201,121,43,.16); border-color: rgba(201,121,43,.5); }

.citySeoList {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.citySeoLink {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: 1px solid rgba(243,241,236,.09);
  border-radius: var(--radius-pill);
  font-size: 13px;
  color: var(--muted);
  text-decoration: none;
  background: rgba(255,255,255,.02);
  transition: border-color 200ms ease, color 200ms ease, background 200ms ease;
  white-space: nowrap;
}
.citySeoLink:hover { border-color: rgba(201,121,43,.4); color: var(--copper2); background: rgba(201,121,43,.06); }

@media(max-width:980px) {
  .cityPage { width: calc(100vw - 48px); padding: 90px 0 80px; }
  .cityInfoGrid { grid-template-columns: 1fr; }
}
@media(max-width:520px) {
  .cityPage { width: calc(100vw - 32px); }
  .cityCatsGrid { grid-template-columns: repeat(2, 1fr); }
  .citySeoGrid { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   m[i].l=1*new Date();
   for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
   k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window, document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
   ym(109475188, 'init', {clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true, ecommerce:"dataLayer"});
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/109475188" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->
<?php render_topbar($pdo); ?>

<main class="cityPage">
  <nav class="breadcrumbs" aria-label="Хлебные крошки">
    <a href="/">Главная</a><span aria-hidden="true">›</span>
    <a href="/cities.php">Города доставки</a><span aria-hidden="true">›</span>
    <b aria-current="page"><?=h($cityName)?></b>
  </nav>

  <div class="cityHero">
    <p class="eyebrow">ДОСТАВКА <?=h(mb_strtoupper($cityNameIn))?></p>
    <h1>LUKA OUTDOOR — <?=h($cityName)?></h1>
    <p>Костровые чаши и outdoor снаряжение с доставкой <?=h($cityNameIn)?> через СДЭК.</p>
  </div>

  <!-- ПВЗ + доставка -->
  <div class="cityInfoGrid">
    <div class="pvzSection">
      <p class="eyebrow">ПУНКТЫ ВЫДАЧИ СДЭК</p>
      <div class="pvzList" id="pvzList">
        <div style="color:var(--muted);font-size:13px">Загружаем...</div>
      </div>
    </div>
    <div class="deliveryInfoCard">
      <p class="eyebrow" style="margin-bottom:16px">КАК ПОЛУЧИТЬ</p>
      <div class="deliveryStep">
        <strong>Самовывоз из ПВЗ</strong>
        <p>Адреса пунктов СДЭК <?=h($cityNameIn)?> — слева.</p>
      </div>
      <div class="deliveryStep">
        <strong>Курьер до двери</strong>
        <p>Доставка СДЭК по адресу <?=h($cityNameIn)?>.</p>
      </div>
      <div class="deliveryStep">
        <strong>Отправка</strong>
        <p>Из Тольятти в течение 1–2 рабочих дней после оплаты.</p>
      </div>
    </div>
  </div>

  <?php if(!empty($categories)): ?>
  <div class="citySection">
    <p class="eyebrow">КАТАЛОГ</p>
    <h2>Все категории</h2>
    <div class="cityCatsGrid">
      <?php foreach($categories as $cat): ?>
      <a class="cityCatCard" href="/catalog.php?cat=<?=h($cat['slug'])?>">
        <?php if(!empty($cat['image'])): ?>
          <img src="/<?=h($cat['image'])?>" alt="<?=h($cat['name'])?>">
        <?php else: ?>
          <div class="cityCatPlaceholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="#c9792b" stroke-width="1.5" aria-hidden="true"><path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/><path d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"/></svg>
          </div>
        <?php endif; ?>
        <div class="overlay"></div>
        <div class="label"><?=h($cat['name'])?></div>
      </a>
      <?php endforeach; ?>
      <a class="cityCatAll" href="/catalog.php">Весь каталог</a>
    </div>
  </div>
  <?php endif; ?>

  <?php if(!empty($products)): ?>
  <div class="citySection">
    <p class="eyebrow">ПОПУЛЯРНОЕ</p>
    <h2>Товары с доставкой <?=h($cityNameIn)?></h2>
    <div class="productsGrid v2Grid">
      <?php foreach($products as $p):
        $payload=["id"=>(int)$p["id"],"name"=>$p["name"],"price"=>(int)$p["price"],"image"=>$p["image"] ?: 'assets/images/hero.webp'];
      ?>
      <article class="product cardV2 sr">
        <a class="productImg" href="/product.php?slug=<?=h($p['slug'] ?: $p['id'])?>">
          <img loading="lazy" src="/<?=h($p['image'] ?: 'assets/images/hero.webp')?>" alt="<?=h($p['name'])?>">
          <?php if($p['badge']): ?><em><?=h($p['badge'])?></em><?php endif; ?>
        </a>
        <div class="productBody">
          <small><?=h($p['category_name'])?></small>
          <h3><?=h($p['name'])?></h3>
          <div class="priceLine"><strong><?=money($p['price'])?></strong><button onclick='addToCart(<?=json_encode($payload,JSON_UNESCAPED_UNICODE)?>,this)'>+</button></div>
          <a class="details" href="/product.php?slug=<?=h($p['slug'] ?: $p['id'])?>">Подробнее</a>
        </div>
      </article>
      <?php endforeach; ?>
    </div>
    <div style="margin-top:28px;text-align:center">
      <a href="/catalog.php" class="btn ghost">Смотреть весь каталог</a>
    </div>
  </div>
  <?php endif; ?>

  <?php
  $allSeoItems = array_merge($categories, $subcategories);
  if(!empty($allSeoItems)): ?>
  <div class="citySection" style="margin-top:48px;padding-top:32px;border-top:1px solid rgba(243,241,236,.08)">
    <p class="eyebrow">КУПИТЬ <?=h(mb_strtoupper($cityNameIn))?></p>
    <div class="citySeoList">
      <?php foreach($allSeoItems as $cat): ?>
      <a class="citySeoLink" href="/catalog.php?cat=<?=h($cat['slug'])?>">
        Купить <?=h(mb_strtolower($cat['name']))?> <?=h($cityNameIn)?>
</a>
      <?php endforeach; ?>
    </div>
  </div>
  <?php endif; ?>
</main>

<?php render_footer($pdo); ?>
<?php include __DIR__.'/includes/cart.php'; ?>
<script src="/assets/script.js?v=6.2.0"></script>
<script>
(async function(){
  const cityCode = <?=(int)($city['cdek_code'] ?? 0)?>;
  if(!cityCode) return;
  try {
    const r = await fetch('/cdek.php?action=pvz&city_code=' + cityCode);
    const pvz = await r.json();
    const list = document.getElementById('pvzList');
    if(!pvz.length){ list.innerHTML = '<p style="color:var(--muted);font-size:13px">Нет данных о пунктах выдачи</p>'; return; }
    list.innerHTML = pvz.slice(0,6).map(p => `
      <div class="pvzCard">
        <div style="display:flex;gap:10px;align-items:flex-start">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <div>
            <strong>${p.address}</strong>
            <small>${p.work_time || ''}</small>
          </div>
        </div>
      </div>
    `).join('');
  } catch(e) {}
})();
</script>
</body>
</html>
