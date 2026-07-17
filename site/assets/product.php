<?php require __DIR__.'/includes/db.php';
require __DIR__.'/includes/nav.php';
$pdo=db(); $slug=$_GET['slug'] ?? ''; $st=$pdo->prepare("SELECT p.*, c.name category_name, c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE (p.slug=? OR p.id=?) AND p.is_active=1 LIMIT 1"); $st->execute([$slug, ctype_digit($slug)?(int)$slug:0]); $p=$st->fetch(PDO::FETCH_ASSOC); if(!$p){ http_response_code(404); echo 'Товар не найден'; exit; }
$mediaSt=$pdo->prepare("SELECT * FROM product_media WHERE product_id=? AND type='image' ORDER BY sort_order,id"); $mediaSt->execute([$p['id']]); $media=$mediaSt->fetchAll(PDO::FETCH_ASSOC); $gallery=array_values(array_unique(array_filter(array_merge([$p['image'] ?: 'assets/images/hero.webp'], array_map(fn($m)=>$m['path'], $media))))); $thumbGallery=array_values(array_filter($gallery, fn($img)=>$img!==($gallery[0] ?? '')));
// Похожие товары — ручной выбор или автоматически из категории
$relIds = array_filter(array_map('intval', explode(',', $p['related_ids'] ?? '')));
if(!empty($relIds)){
    $placeholders = implode(',', array_fill(0, count($relIds), '?'));
    $related = $pdo->prepare("SELECT * FROM products WHERE is_active=1 AND id IN ($placeholders) ORDER BY sort_order,id LIMIT 3");
    $related->execute(array_values($relIds));
    $related = $related->fetchAll(PDO::FETCH_ASSOC);
} else {
    $related = $pdo->prepare("SELECT * FROM products WHERE is_active=1 AND category_id=? AND id<>? ORDER BY sort_order,id LIMIT 3");
    $related->execute([$p['category_id'],$p['id']]);
    $related = $related->fetchAll(PDO::FETCH_ASSOC);
}
$pblocks=$pdo->prepare("SELECT * FROM product_blocks WHERE product_id=? AND is_active=1 ORDER BY sort_order,id"); $pblocks->execute([$p['id']]); $pblocks=$pblocks->fetchAll(PDO::FETCH_ASSOC);
$title=$p['seo_title'] ?: $p['name'].' — Фанера63.рф'; $desc=$p['seo_description'] ?: $p['description']; $payload=["id"=>(int)$p["id"],"name"=>$p["name"],"price"=>(int)$p["price"],"image"=>$gallery[0] ?? $p["image"]];
$baseUrl = 'https://fanera63.ru';
$ogImage = $p['image'] ? $baseUrl.'/'.$p['image'] : $baseUrl.'/assets/images/hero.webp';
$ogUrl   = $baseUrl.'/product.php?slug='.urlencode($p['slug'] ?: $p['id']);
?>
<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?=h($title)?></title><meta name="description" content="<?=h($desc)?>"><meta property="og:title" content="<?=h($title)?>"><meta property="og:description" content="<?=h($desc)?>"><meta property="og:image" content="<?=h($ogImage)?>"><meta property="og:url" content="<?=h($ogUrl)?>"><meta property="og:type" content="product"><link rel="canonical" href="<?=h($ogUrl)?>"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="assets/style.css?v=8.0.0"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"<?=h($p['name'])?>","description":"<?=h($desc)?>","image":"<?=h($p['image'])?>","offers":{"@type":"Offer","price":"<?=h($p['price'])?>","priceCurrency":"RUB","availability":"https://schema.org/InStock"}}</script></head><body>
<?php render_topbar($pdo); ?>

<main class="productPage"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span aria-hidden="true">›</span><a href="/catalog.php">Каталог</a><span aria-hidden="true">›</span><?php if($p['category_name'] && $p['category_slug']): ?><a href="/catalog.php?cat=<?=h($p['category_slug'])?>"><?=h($p['category_name'])?></a><span aria-hidden="true">›</span><?php endif; ?><b aria-current="page"><?=h($p['name'])?></b></nav><section class="productHero"><div class="productGallery"><img class="mainProductImage" src="<?=h($gallery[0] ?? 'assets/images/hero.webp')?>" alt="<?=h($p['name'])?>"><?php if(!empty($thumbGallery)): ?><div class="thumbs"><?php foreach($thumbGallery as $g): ?><button type="button"><img src="<?=h($g)?>" alt=""></button><?php endforeach; ?></div><?php endif; ?></div><div class="productInfo"><p class="eyebrow"><?=h($p['category_name'])?></p><h1><?=h($p['name'])?></h1><p class="productSub"><?=h($p['subtitle'])?></p><p><?=nl2br(h($p['description']))?></p><div class="productPrice"><?=money($p['price'])?></div><div class="actions"><button class="btn primary" onclick='addToCart(<?=json_encode($payload, JSON_UNESCAPED_UNICODE)?>,this)'>В корзину</button><button class="btn ghost" onclick="openOneClick('<?=h($p['name'])?>','<?=money($p['price'])?>')">Купить в 1 клик</button></div></div></section>
<?php
$hasSpecs = $p['specs'] || $p['dimensions'] || $p['materials'] || $p['assembly'];
if($hasSpecs): ?>
<section class="productSpecs">
  <?php if($p['specs']): ?><article><span>Характеристики</span><p><?=h($p['specs'])?></p></article><?php endif; ?>
  <?php if($p['dimensions']): ?><article><span>Размеры</span><p><?=h($p['dimensions'])?></p></article><?php endif; ?>
  <?php if($p['materials']): ?><article><span>Материалы</span><p><?=h($p['materials'])?></p></article><?php endif; ?>
  <?php if($p['assembly']): ?><article><span>Сборка</span><p><?=h($p['assembly'])?></p></article><?php endif; ?>
</section>
<?php endif; ?>

<?php foreach($pblocks as $pb):
  $pbitems = array_filter(array_map('trim', explode('|', $pb['extra'] ?? '')));
?>
<?php if($pb['type']==='included'): ?>
<section class="productIncluded reveal">
  <div><p class="eyebrow">Комплектация</p><h2><?=h($pb['title'] ?: 'Что входит')?></h2></div>
  <div class="includedGrid">
    <?php foreach($pbitems as $item): ?><article><?=h($item)?></article><?php endforeach; ?>
  </div>
</section>
<?php elseif($pb['type']==='how'): ?>
<section class="productHow reveal">
  <div class="sectionIntro"><p class="eyebrow">КАК ЭТО РАБОТАЕТ</p><h2><?=h($pb['title'] ?: 'Собрать. Разжечь. Готовить.')?></h2></div>
  <div class="stepsGrid">
    <?php foreach(array_values($pbitems) as $si=>$step):
      $parts=explode(':',$step,2); $stitle=trim($parts[0]); $sdesc=trim($parts[1]??'');
    ?>
    <article><span><?=str_pad($si+1,2,'0',STR_PAD_LEFT)?></span><h3><?=h($stitle)?></h3><?php if($sdesc):?><p><?=h($sdesc)?></p><?php endif;?></article>
    <?php endforeach; ?>
  </div>
</section>
<?php elseif($pb['type']==='lifestyle' || $pb['type']==='text_image'): ?>
<section class="productLifestyle">
  <img src="<?=h($pb['image'] ?: 'assets/images/lifestyle.webp')?>" alt="">
  <div>
    <?php if($pb['subtitle']):?><p class="eyebrow"><?=h($pb['subtitle'])?></p><?php endif;?>
    <h2><?=h($pb['title'])?></h2>
    <?php if($pb['text']):?><p><?=h($pb['text'])?></p><?php endif;?>
  </div>
</section>
<?php elseif($pb['type']==='features'): ?>
<section class="sectionV2 reveal">
  <div class="sectionHeadV2"><h2><?=h($pb['title'])?></h2><?php if($pb['text']):?><p><?=h($pb['text'])?></p><?php endif;?></div>
  <div class="craftCards">
    <?php foreach(array_values($pbitems) as $fi=>$feat):
      $parts=explode(':',$feat,2);
    ?>
    <article><b><?=str_pad($fi+1,2,'0',STR_PAD_LEFT)?></b><span><?=h(trim($parts[0]))?></span><?php if(!empty($parts[1])):?><p style="color:var(--muted);font-size:14px;margin-top:8px"><?=h(trim($parts[1]))?></p><?php endif;?></article>
    <?php endforeach;?>
  </div>
</section>
<?php endif; ?>
<?php endforeach; ?>
<?php if($p['video']): ?><section class="videoBlock"><div><p class="eyebrow">Video</p><h2>Видео товара</h2></div><video controls poster="<?=h($p['image'])?>"><source src="<?=h($p['video'])?>" type="video/mp4"></video></section><?php endif; ?>
<?php if($related): ?>
<section class="sectionV2 relatedProducts">
  <div class="sectionHeadV2"><div><p class="eyebrow">Related</p><h2>Похожие товары</h2></div><p>Другие материалы из этой категории на Фанера63.рф.</p></div>
  <div class="productsGrid v2Grid">
    <?php foreach($related as $r): $relatedPayload=["id"=>(int)$r["id"],"name"=>$r["name"],"price"=>(int)$r["price"],"image"=>$r["image"] ?: 'assets/images/hero.webp']; ?>
    <article class="product cardV2 reveal">
      <a class="productImg" href="product.php?slug=<?=h($r['slug'] ?: $r['id'])?>"><img loading="lazy" src="<?=h($r['image'] ?: 'assets/images/hero.webp')?>" alt="<?=h($r['name'])?>"></a>
      <div class="productBody"><small><?=h($p['category_name'])?></small><h3><?=h($r['name'])?></h3><p><?=h($r['subtitle'])?></p><div class="priceLine"><strong><?=money($r['price'])?></strong><button onclick='addToCart(<?=json_encode($relatedPayload,JSON_UNESCAPED_UNICODE)?>,this)'>+</button></div><a class="details" href="product.php?slug=<?=h($r['slug'] ?: $r['id'])?>">Подробнее</a></div>
    </article>
    <?php endforeach; ?>
  </div>
</section>
<?php endif; ?><div class="stickyBuy"><button id="stickyBuyBtn" class="btn primary" onclick='addToCart(<?=json_encode($payload, JSON_UNESCAPED_UNICODE)?>,this)'>В корзину — <?=money($p['price'])?></button><button class="btn ghost" onclick="openOneClick('<?=h($p['name'])?>','<?=money($p['price'])?>')">1 клик</button></div>

<!-- Модальное окно «Купить в 1 клик» -->
<div id="oneClickShade" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9000;backdrop-filter:blur(4px)" onclick="closeOneClick()"></div>
<div id="oneClickModal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9001;background:#111;border:1px solid rgba(243,241,236,.1);border-radius:24px;padding:40px;width:min(480px,calc(100vw - 32px));box-shadow:0 32px 80px rgba(0,0,0,.6)">
  <button onclick="closeOneClick()" style="position:absolute;top:16px;right:16px;background:none;border:none;color:rgba(243,241,236,.4);font-size:22px;cursor:pointer;line-height:1">×</button>
  <p class="eyebrow" style="margin:0 0 6px">Быстрый заказ</p>
  <h2 id="oneClickTitle" style="font-family:var(--head);font-size:36px;text-transform:uppercase;margin:0 0 4px;line-height:.95"></h2>
  <p id="oneClickPrice" style="color:var(--copper2);font-size:20px;font-weight:700;margin:0 0 28px"></p>
  <form id="oneClickForm" style="display:grid;gap:12px">
    <input name="customer_name" required placeholder="Ваше имя" style="background:rgba(255,255,255,.06);border:1px solid rgba(243,241,236,.12);border-radius:12px;color:var(--text);padding:14px 16px;font:inherit;font-size:15px;outline:none">
    <input name="phone" required placeholder="Номер телефона" style="background:rgba(255,255,255,.06);border:1px solid rgba(243,241,236,.12);border-radius:12px;color:var(--text);padding:14px 16px;font:inherit;font-size:15px;outline:none">
    <input type="hidden" name="quick_request" value="1">
    <input type="hidden" name="product_name" id="oneClickProduct">
    <input type="hidden" name="utm_source" id="oc_utm_source">
    <input type="hidden" name="utm_medium" id="oc_utm_medium">
    <input type="hidden" name="utm_campaign" id="oc_utm_campaign">
    <input type="hidden" name="page_referer" id="oc_referer">
    <button class="btn primary" type="submit" style="justify-content:center;margin-top:4px">Отправить заявку</button>
    <p id="oneClickResult" style="font-size:13px;color:var(--copper2);margin:0;text-align:center"></p>
  </form>
</div>
</main>
<?php include __DIR__.'/includes/cart.php'; ?><script src="assets/script.js?v=8.0.0"></script><script>
const _tb = document.querySelectorAll(".thumbs button");
let _autoTimer = null;

function _setActive(idx) {
  const btn = _tb[idx];
  if(!btn) return;
  const main = document.querySelector(".mainProductImage");
  // Плавный переход через CSS transition
  main.style.transition = "opacity 0.4s ease";
  main.style.opacity = "0";
  setTimeout(() => {
    main.src = btn.querySelector("img").src;
    main.style.opacity = "1";
  }, 300);
  _tb.forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
}

_tb.forEach((b, i) => {
  if(i === 0) b.classList.add("active");
  b.addEventListener("click", () => {
    clearInterval(_autoTimer);
    _setActive(i);
    // Перезапускаем автослайд после ручного переключения
    _startAuto();
  });
});

function _startAuto() {
  if(_tb.length < 2) return;
  _autoTimer = setInterval(() => {
    const cur = [..._tb].findIndex(b => b.classList.contains("active"));
    _setActive((cur + 1) % _tb.length);
  }, 3500);
}
_startAuto();

// UTM из URL → скрытые поля форм корзины
(function(){
  const p = new URLSearchParams(location.search);
  const utm = {source:p.get('utm_source')||'',medium:p.get('utm_medium')||'',campaign:p.get('utm_campaign')||'',content:p.get('utm_content')||'',term:p.get('utm_term')||''};
  // Сохраняем в sessionStorage чтобы не терять при переходе
  if(utm.source) sessionStorage.setItem('fanera63_utm', JSON.stringify(utm));
  const saved = JSON.parse(sessionStorage.getItem('fanera63_utm')||'{}');
  document.getElementById('oc_utm_source').value   = saved.source   || '';
  document.getElementById('oc_utm_medium').value   = saved.medium   || '';
  document.getElementById('oc_utm_campaign').value = saved.campaign || '';
  document.getElementById('oc_referer').value      = document.referrer || '';
})();

// 1-клик модал
function openOneClick(name, price) {
  document.getElementById('oneClickTitle').textContent  = name;
  document.getElementById('oneClickPrice').textContent  = price;
  document.getElementById('oneClickProduct').value      = name;
  document.getElementById('oneClickResult').textContent = '';
  document.getElementById('oneClickForm').reset();
  // Восстановим скрытые поля после reset
  const saved = JSON.parse(sessionStorage.getItem('fanera63_utm')||'{}');
  document.getElementById('oc_utm_source').value   = saved.source   || '';
  document.getElementById('oc_utm_medium').value   = saved.medium   || '';
  document.getElementById('oc_utm_campaign').value = saved.campaign || '';
  document.getElementById('oc_referer').value      = document.referrer || '';
  document.getElementById('oneClickProduct').value = name;
  document.getElementById('oneClickShade').style.display = 'block';
  document.getElementById('oneClickModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}
function closeOneClick() {
  document.getElementById('oneClickShade').style.display = 'none';
  document.getElementById('oneClickModal').style.display = 'none';
  document.body.style.overflow = '';
}
document.getElementById('oneClickForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const btn = this.querySelector('button[type=submit]');
  const res = document.getElementById('oneClickResult');
  btn.disabled = true; btn.textContent = 'Отправка...';
  const fd = new FormData(this);
  try {
    const r = await fetch('/order.php', {method:'POST', body:fd});
    const d = await r.json();
    res.textContent = d.message;
    res.style.color = d.ok ? 'var(--copper2)' : '#e05';
    if(d.ok) {
      setTimeout(()=>{ closeOneClick(); if(d.redirect) location.href = d.redirect; }, 800);
    }
  } catch(err) { res.textContent = 'Ошибка отправки'; }
  btn.disabled = false; btn.textContent = 'Отправить заявку';
});
</script></body></html>
