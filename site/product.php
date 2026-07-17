<?php require __DIR__.'/includes/db.php';
require __DIR__.'/includes/nav.php';
$pdo=db(); $slug=$_GET['slug'] ?? ''; $st=$pdo->prepare("SELECT p.*, c.name category_name, c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE (p.slug=? OR p.id=?) AND p.is_active=1 LIMIT 1"); $st->execute([$slug, ctype_digit($slug)?(int)$slug:0]); $p=$st->fetch(PDO::FETCH_ASSOC); if(!$p){ http_response_code(404); echo 'Товар не найден'; exit; }
$mediaSt=$pdo->prepare("SELECT * FROM product_media WHERE product_id=? AND type='image' ORDER BY sort_order,id"); $mediaSt->execute([$p['id']]); $media=$mediaSt->fetchAll(PDO::FETCH_ASSOC); $gallery=array_values(array_unique(array_filter(array_merge([$p['image'] ?: 'assets/images/hero.webp'], array_map(fn($m)=>$m['path'], $media))))); $thumbGallery=$gallery;
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

// Отзывы
try{$pdo->exec("CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, author TEXT NOT NULL, rating INTEGER DEFAULT 5, text TEXT NOT NULL, is_active INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE)");}catch(Exception $e){}
$reviews=$pdo->prepare("SELECT * FROM reviews WHERE product_id=? AND is_active=1 ORDER BY id DESC"); $reviews->execute([$p['id']]); $reviews=$reviews->fetchAll(PDO::FETCH_ASSOC);
$avgRating = count($reviews) ? round(array_sum(array_column($reviews,'rating'))/count($reviews),1) : 0;
$title=$p['seo_title'] ?: $p['name'].' — Фанера63.рф'; $desc=$p['seo_description'] ?: $p['description']; $payload=["id"=>(int)$p["id"],"name"=>$p["name"],"price"=>(int)$p["price"],"image"=>$gallery[0] ?? $p["image"]];
$baseUrl = 'https://fanera63.ru';
$ogImage = $p['image'] ? $baseUrl.'/'.$p['image'] : $baseUrl.'/assets/images/hero.webp';
$ogUrl   = $baseUrl.'/product.php?slug='.urlencode($p['slug'] ?: $p['id']);
?>
<?php
$imagesJson = json_encode(array_map(fn($img) => $baseUrl.'/'.$img, $gallery), JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
$ldJson = [
  '@context'    => 'https://schema.org',
  '@type'       => 'Product',
  'name'        => $p['name'],
  'description' => strip_tags($desc),
  'image'       => json_decode($imagesJson),
  'brand'       => ['@type'=>'Brand','name'=>'Фанера63.рф'],
  'sku'         => 'LO-'.$p['id'],
  'offers'      => [
    '@type'           => 'Offer',
    'price'           => (int)$p['price'],
    'priceCurrency'   => 'RUB',
    'availability'    => 'https://schema.org/InStock',
    'url'             => $ogUrl,
    'seller'          => ['@type'=>'Organization','name'=>'Фанера63.рф'],
  ],
];
if($avgRating > 0 && count($reviews) > 0){
  $ldJson['aggregateRating'] = ['@type'=>'AggregateRating','ratingValue'=>$avgRating,'reviewCount'=>count($reviews),'bestRating'=>5,'worstRating'=>1];
  $ldJson['review'] = array_map(fn($r)=>['@type'=>'Review','author'=>['@type'=>'Person','name'=>h($r['author'])],'reviewRating'=>['@type'=>'Rating','ratingValue'=>(int)$r['rating'],'bestRating'=>5],'reviewBody'=>h($r['text'])], array_slice($reviews,0,5));
}
$breadcrumbLd = ['@context'=>'https://schema.org','@type'=>'BreadcrumbList','itemListElement'=>[
  ['@type'=>'ListItem','position'=>1,'name'=>'Главная','item'=>$baseUrl.'/'],
  ['@type'=>'ListItem','position'=>2,'name'=>'Каталог','item'=>$baseUrl.'/catalog.php'],
  ['@type'=>'ListItem','position'=>3,'name'=>$p['name'],'item'=>$ogUrl],
]];
?>
<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="csrf-token" content="<?=csrf_token()?>"><title><?=h($title)?></title><meta name="description" content="<?=h($desc)?>"><meta name="robots" content="index, follow"><meta property="og:title" content="<?=h($title)?>"><meta property="og:description" content="<?=h($desc)?>"><meta property="og:image" content="<?=h($ogImage)?>"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="<?=h($ogUrl)?>"><meta property="og:type" content="product"><meta property="og:site_name" content="Фанера63.рф"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="<?=h($ogUrl)?>"><link rel="icon" type="image/png" href="/assets/images/favicon.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="assets/style.css?v=8.0.0"><script type="application/ld+json"><?=json_encode($ldJson,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT)?></script><script type="application/ld+json"><?=json_encode($breadcrumbLd,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)?></script></head><body>
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

<main class="productPage"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span aria-hidden="true">›</span><a href="/catalog.php">Каталог</a><span aria-hidden="true">›</span><?php if($p['category_name'] && $p['category_slug']): ?><a href="/catalog.php?cat=<?=h($p['category_slug'])?>"><?=h($p['category_name'])?></a><span aria-hidden="true">›</span><?php endif; ?><b aria-current="page"><?=h($p['name'])?></b></nav><section class="productHero"><div class="productGallery"><div class="galleryTrack" id="galleryTrack"><?php foreach($gallery as $gi=>$g): ?><img src="<?=h($g)?>" alt="<?=h($p['name'])?>" class="gallerySlide<?=$gi===0?' active':''?>"><?php endforeach; ?></div><?php if(count($thumbGallery)>1): ?><div class="thumbs"><?php foreach($thumbGallery as $gi=>$g): ?><button type="button" class="<?=$gi===0?'active':''?>"><img src="<?=h($g)?>" alt=""></button><?php endforeach; ?></div><?php endif; ?></div><div class="productInfo"><p class="eyebrow"><?=h($p['category_name'])?></p><h1 style="font-size:clamp(42px,4.5vw,80px)"><?=h($p['name'])?></h1><p class="productSub" style="font-size:14px;opacity:.65;font-weight:500;text-transform:none;letter-spacing:0"><?=h($p['subtitle'])?></p><p><?=nl2br(h($p['description']))?></p><?php if($avgRating>0): ?><div class="ratingNearPrice">★ <?=$avgRating?> <span class="ratingCount">(<?=count($reviews)?> <?=count($reviews)===1?'отзыв':( count($reviews)<5?'отзыва':'отзывов')?>)</span></div><?php endif; ?><div class="productPrice"><?=money($p['price'])?></div><div class="deliveryHint"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;opacity:.7"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Доставка по России от 350 ₽ · СДЭК 3–7 дней · Возврат 14 дней</div><div class="actions"><button class="btn primary" onclick='addToCart(<?=json_encode($payload, JSON_UNESCAPED_UNICODE)?>,this)'>В корзину</button><button class="btn ghost" onclick="openOneClick('<?=h($p['name'])?>','<?=money($p['price'])?>')">Купить в 1 клик</button></div></div></section>
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
  <img src="<?=h($pb['image'] ?: 'assets/images/lifestyle.webp')?>" alt="<?=h($pb['title'] ?: $p['name'])?>">
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
<?php endif; ?><!-- Отзывы -->
<section class="reviewsSection">
  <h2 class="reviewsTitle">Отзывы<?php if($avgRating>0): ?> <span style="font-size:.5em;color:var(--copper2);vertical-align:middle"><?=$avgRating?> ★</span><?php endif; ?></h2>

  <?php if(empty($reviews)): ?>
  <p style="color:var(--muted);font-size:16px;padding:32px 0">Пока нет отзывов. Будьте первым!</p>
  <?php else: ?>
  <div class="reviewsList">
    <?php foreach($reviews as $rv): ?>
    <div class="reviewCard">
      <div class="reviewCardTop">
        <div class="reviewAuthorRow">
          <div class="reviewAvatar"><?=mb_substr(h($rv['author']),0,1)?></div>
          <div>
            <div class="reviewAuthorName"><?=h($rv['author'])?></div>
            <div class="reviewDate"><?=date('d.m.Y',strtotime($rv['created_at']))?></div>
          </div>
        </div>
        <div class="reviewStars"><?=str_repeat('★',$rv['rating']).str_repeat('☆',5-$rv['rating'])?></div>
      </div>
      <p class="reviewText"><?=nl2br(h($rv['text']))?></p>
    </div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>

  <!-- Форма отзыва -->
  <div id="reviewForm" class="reviewFormBlock">
    <h3 class="reviewFormTitle">Оставить отзыв</h3>
    <form id="reviewFormEl" class="reviewFormGrid">
      <input type="hidden" name="product_id" value="<?=(int)$p['id']?>">
      <div class="reviewFormRow">
        <input name="author" required placeholder="Ваше имя" class="reviewInput">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--muted);font-size:13px;white-space:nowrap">Оценка:</span>
          <div class="starRating">
            <?php for($i=1;$i<=5;$i++): ?>
            <span data-val="<?=$i?>" onmouseover="highlightStars(<?=$i?>)" onmouseout="highlightStars(window._selectedStar||0)" onclick="selectStar(<?=$i?>)">★</span>
            <?php endfor; ?>
          </div>
          <input type="hidden" name="rating" id="ratingInput" value="5">
        </div>
      </div>
      <textarea name="text" required rows="4" placeholder="Расскажите о своём опыте использования..." class="reviewInput"></textarea>
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <button class="btn primary" type="submit">Отправить отзыв</button>
        <p style="color:var(--muted);font-size:12px;margin:0">Отзыв появится после проверки модератором</p>
      </div>
      <p id="reviewResult" style="font-size:14px;color:var(--copper2);margin:0"></p>
    </form>
  </div>
</section>


</main>
<!-- Модальное окно «Купить в 1 клик» -->
<div class="oneClickModal" id="oneClickModalWrap">
  <div class="oneClickBackdrop" onclick="closeOneClick()"></div>
  <div class="oneClickBox" id="oneClickModal">
    <button class="oneClickClose" onclick="closeOneClick()" aria-label="Закрыть">×</button>
    <p class="eyebrow" style="margin:0 0 6px">Быстрый заказ</p>
    <h2 id="oneClickTitle" class="oneClickBox h2" style="font-family:var(--head);font-size:36px;text-transform:uppercase;margin:0 0 4px;line-height:.95"></h2>
    <p id="oneClickPrice" style="color:var(--copper2);font-size:20px;font-weight:700;margin:0 0 28px"></p>
    <form id="oneClickForm" style="display:grid;gap:12px">
      <input name="customer_name" required placeholder="Ваше имя" class="reviewInput">
      <input name="phone" required placeholder="Номер телефона" class="reviewInput">
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
</div>
<div class="stickyBuy"><button id="stickyBuyBtn" class="btn primary" onclick='addToCart(<?=json_encode($payload, JSON_UNESCAPED_UNICODE)?>,this)'>В корзину — <?=money($p['price'])?></button><button class="btn ghost" onclick="openOneClick('<?=h($p['name'])?>','<?=money($p['price'])?>')">1 клик</button></div>
<?php render_footer($pdo); ?>
<?php include __DIR__.'/includes/cart.php'; ?><script src="assets/script.js?v=8.0.0"></script><script>
const _slides = document.querySelectorAll(".gallerySlide");
const _tb = document.querySelectorAll(".thumbs button");
let _autoTimer = null;
let _curIdx = 0;

function _setActive(idx) {
  if(!_slides.length) return;
  const prev = _curIdx;
  _curIdx = (idx + _slides.length) % _slides.length;
  const dir = _curIdx > prev ? 1 : -1;

  // Уходящий слайд
  const outSlide = _slides[prev];
  outSlide.style.transition = "none";
  outSlide.style.transform = "translateX(0)";
  outSlide.style.zIndex = "1";
  outSlide.classList.add("active");

  // Входящий слайд — ставим за экраном
  const inSlide = _slides[_curIdx];
  inSlide.style.transition = "none";
  inSlide.style.transform = `translateX(${dir * 100}%)`;
  inSlide.style.zIndex = "2";
  inSlide.classList.add("active");

  // Форсируем reflow
  inSlide.getBoundingClientRect();

  // Анимируем
  inSlide.style.transition = "transform 0.38s cubic-bezier(.4,0,.2,1)";
  outSlide.style.transition = "transform 0.38s cubic-bezier(.4,0,.2,1)";
  inSlide.style.transform = "translateX(0)";
  outSlide.style.transform = `translateX(${-dir * 100}%)`;

  setTimeout(() => {
    _slides.forEach((s, i) => {
      s.classList.remove("active");
      s.style.transform = "";
      s.style.transition = "";
      s.style.zIndex = "";
    });
    inSlide.classList.add("active");
  }, 380);

  // Миниатюры
  _tb.forEach(x => x.classList.remove("active"));
  if(_tb[_curIdx]) _tb[_curIdx].classList.add("active");
}

_tb.forEach((b, i) => {
  b.addEventListener("click", () => {
    clearInterval(_autoTimer);
    _setActive(i);
    _startAuto();
  });
});

function _startAuto() {
  if(_slides.length < 2) return;
  clearInterval(_autoTimer);
  _autoTimer = setInterval(() => _setActive(_curIdx + 1), 3500);
}
_startAuto();

// Touch swipe
(function(){
  const track = document.getElementById("galleryTrack");
  if(!track || _slides.length < 2) return;
  let startX = 0, startY = 0, moved = false;
  track.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false;
  }, {passive:true});
  track.addEventListener("touchmove", e => { moved = true; }, {passive:true});
  track.addEventListener("touchend", e => {
    if(!moved) return;
    const diff = startX - e.changedTouches[0].clientX;
    const diffY = Math.abs(startY - e.changedTouches[0].clientY);
    if(Math.abs(diff) < 40 || diffY > Math.abs(diff)) return;
    clearInterval(_autoTimer);
    _setActive(diff > 0 ? _curIdx + 1 : _curIdx - 1);
    _startAuto();
  }, {passive:true});
})();

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
  document.getElementById('oneClickModalWrap').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeOneClick() {
  document.getElementById('oneClickModalWrap').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('oneClickForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const btn = this.querySelector('button[type=submit]');
  const res = document.getElementById('oneClickResult');
  btn.disabled = true; btn.textContent = 'Отправка...';
  const fd = new FormData(this);
  fd.append('csrf_token', document.querySelector('meta[name="csrf-token"]')?.content || '');
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

// ── Отзывы ──────────────────────────────────────────────────────────────
window._selectedStar = 5;
// Инициализируем 5 звёзд по умолчанию
document.addEventListener('DOMContentLoaded', () => {
  highlightStars(5);
  document.getElementById('ratingInput').value = 5;
});
function highlightStars(n){
  document.querySelectorAll('.starRating span').forEach((s,i)=>{
    s.style.color = i < n ? '#f5a623' : 'rgba(26,20,12,.18)';
  });
}
function selectStar(n){
  window._selectedStar = n;
  document.getElementById('ratingInput').value = n;
  highlightStars(n);
}
document.getElementById('reviewFormEl')?.addEventListener('submit', async function(e){
  e.preventDefault();
  const btn = this.querySelector('button[type=submit]');
  const res = document.getElementById('reviewResult');
  btn.disabled = true; btn.textContent = 'Отправка...';
  const fd = new FormData(this);
  try {
    const r = await fetch('/review.php', {method:'POST', body:fd});
    const d = await r.json();
    res.textContent = d.message;
    res.style.color = d.ok ? 'var(--copper2)' : '#e05252';
    if(d.ok) this.reset();
  } catch(err) { res.textContent = 'Ошибка отправки'; }
  btn.disabled = false; btn.textContent = 'Отправить отзыв';
});
</script></body></html>
