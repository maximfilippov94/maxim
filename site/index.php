<?php
require __DIR__.'/includes/db.php';
require __DIR__.'/includes/nav.php';
$pdo = db();
$categories = $pdo->query("SELECT * FROM categories WHERE is_active=1 AND (parent_id IS NULL OR parent_id=0) ORDER BY sort_order,id LIMIT 6")->fetchAll(PDO::FETCH_ASSOC);
$products   = $pdo->query("SELECT p.*, c.name category_name, c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.is_active=1 ORDER BY c.sort_order,p.sort_order,p.id")->fetchAll(PDO::FETCH_ASSOC);
$coreBlockMap = [];
foreach($pdo->query("SELECT * FROM page_blocks WHERE code<>''")->fetchAll(PDO::FETCH_ASSOC) as $cb){
    $coreBlockMap[$cb['code']] = $cb;
}
function block_data($code){ global $coreBlockMap; return $coreBlockMap[$code] ?? []; }
function block_text($code,$field,$fallback=''){ $b=block_data($code); return ($b[$field]??'')!=='' ? $b[$field] : $fallback; }
function block_image($code,$fallback='assets/images/hero.webp'){ $b=block_data($code); return !empty($b['image']) ? $b['image'] : $fallback; }
$title     = setting('site_title','LUKA OUTDOOR');
$desc      = setting('site_description','Premium outdoor fire culture.');
$heroImage = block_image('hero','assets/images/hero.webp');

// Все активные блоки кроме системных (hero рендерится отдельно)
$allBlocks = $pdo->query("SELECT * FROM page_blocks WHERE is_active=1 AND code NOT IN ('hero','culture') ORDER BY sort_order,id")->fetchAll(PDO::FETCH_ASSOC);
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($title)?></title>
<meta name="description" content="<?=h($desc)?>">
<meta property="og:title" content="<?=h($title)?>"><meta property="og:description" content="<?=h($desc)?>"><meta property="og:image" content="<?=h($heroImage)?>">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css?v=5.0.0">
</head>

<body>
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   m[i].l=1*new Date();
   for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
   k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window, document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
   ym(109475188, 'init', {
     clickmap:true, trackLinks:true, accurateTrackBounce:true,
     webvisor:true, ecommerce:"dataLayer"
   });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/109475188" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->
<?php render_topbar($pdo); ?>

<section id="top" class="heroV2" style="background-image:url('<?=h($heroImage)?>?v=<?=time()?>')">
  <div class="heroShade"></div><div class="emberLayer"><i></i><i></i><i></i><i></i><i></i></div>
  <div class="heroInner">
    <p class="eyebrow"><?=h(block_text('hero','eyebrow','PREMIUM OUTDOOR FIRE CULTURE'))?></p>
    <h1><?=nl2br(h(block_text('hero','title','ОГОНЬ\nДЛЯ НАСТОЯЩИХ\nВСТРЕЧ')))?></h1>
    <p class="heroLead"><?=h(block_text('hero','text','Костровые системы и outdoor аксессуары для живого огня, кухни на природе и атмосферных вечеров.'))?></p>
    <div class="actions"><a class="btn primary" href="#catalog"><?=h(block_text('hero','cta_text','ВЫБРАТЬ СИСТЕМУ'))?></a><a class="btn ghost" href="#ritual">Узнать больше</a></div>
  </div>
  <div class="heroMeta"><span>STEEL</span><span>FIRE COOKING</span><span>SLOW OUTDOOR</span></div>
</section>

<!-- КАТАЛОГ — категории + популярные товары -->
<section id="catalog" class="sectionV2">
  <div class="sectionHeadV2"><p class="eyebrow">COLLECTION</p><h2>Каталог</h2><p>Весь outdoor в одном месте — снаряжение, одежда, аксессуары для природы и путешествий.</p></div>

  <!-- Карточки категорий -->
  <div class="catGrid">
    <?php foreach($categories as $cat): ?>
    <a href="/catalog.php?cat=<?=h($cat['slug'])?>" class="catCard">
      <?php if(!empty($cat['image'])): ?>
      <img src="/<?=h($cat['image'])?>" alt="<?=h($cat['name'])?>">
      <?php else: ?>
      <div class="catCardPlaceholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" color="#c9792b"><path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/><path d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"/></svg>
      </div>
      <?php endif; ?>
      <div class="catCardOverlay"></div>
      <div class="catCardBody">
        <div class="catCardName"><?=h($cat['name'])?></div>
      </div>
    </a>
    <?php endforeach; ?>
    <a href="/catalog.php" class="catCardAll">
      <span>Весь каталог</span>
      <small>→ Все категории</small>
    </a>
  </div>

  <!-- Популярные товары -->
  <?php if(!empty($products)): ?>
  <div class="sectionHeadV2" style="margin-bottom:24px"><p class="eyebrow">POPULAR</p><h2>Популярное</h2></div>
  <div class="productsGrid v2Grid">
    <?php foreach(array_slice($products,0,3) as $p): $payload=["id"=>(int)$p["id"],"name"=>$p["name"],"price"=>(int)$p["price"],"image"=>$p["image"] ?: 'assets/images/hero.webp']; ?>
    <article class="product cardV2 reveal">
      <a class="productImg" href="product.php?slug=<?=h($p['slug'] ?: $p['id'])?>"><img loading="lazy" src="<?=h($p['image'] ?: 'assets/images/hero.webp')?>" alt="<?=h($p['name'])?>">
      <?php if($p['badge']): ?><em><?=h($p['badge'])?></em><?php endif; ?></a>
      <div class="productBody"><small><?=h($p['category_name'])?></small><h3><?=h($p['name'])?></h3><div class="priceLine"><strong><?=money($p['price'])?></strong><button onclick='addToCart(<?=json_encode($payload,JSON_UNESCAPED_UNICODE)?>,this)'>+</button></div><a class="details" href="product.php?slug=<?=h($p['slug'] ?: $p['id'])?>">Подробнее</a></div>
    </article>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</section>

<?php
// SVG иконки для feature-карточек по ключевым словам
function feature_icon(string $text): string {
  $t = mb_strtolower($text);
  if(str_contains($t,'доставк') || str_contains($t,'курьер') || str_contains($t,'сдэк'))
    return '<svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
  if(str_contains($t,'гарант') || str_contains($t,'качест') || str_contains($t,'надёж') || str_contains($t,'надеж'))
    return '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  if(str_contains($t,'производств') || str_contains($t,'россия') || str_contains($t,'россий') || str_contains($t,'сделан'))
    return '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
  if(str_contains($t,'поддержк') || str_contains($t,'помощ') || str_contains($t,'вопрос') || str_contains($t,'консульт') || str_contains($t,'связ'))
    return '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>';
  if(str_contains($t,'оплат') || str_contains($t,'безопасн') || str_contains($t,'карт'))
    return '<svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
  if(str_contains($t,'возврат') || str_contains($t,'обмен'))
    return '<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>';
  return '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
}

// Все активные блоки из БД кроме hero и culture (они системные)
$dynamicBlocks = $pdo->query("SELECT * FROM page_blocks WHERE is_active=1 AND code NOT IN ('hero','culture') ORDER BY sort_order,id")->fetchAll(PDO::FETCH_ASSOC);
foreach($dynamicBlocks as $db_block):
  $btype = $db_block['type'];
  $btitle = h($db_block['title'] ?? '');
  $btext = h($db_block['text'] ?? '');
  $beyebrow = h($db_block['eyebrow'] ?? '');
  $bsub = h($db_block['subtitle'] ?? '');
  $bimage = $db_block['image'] ? h($db_block['image']) : '';
  $bcta = h($db_block['cta_text'] ?? '');
  $bctalink = h($db_block['cta_link'] ?? '#catalog');
  $bextra = array_filter(array_map('trim', explode('|', $db_block['extra'] ?? '')));
?>
<?php if($btype==='features'): ?>
<section class="sectionV2 reveal" style="padding:40px 0 80px">
  <?php if($btitle || $beyebrow): ?>
  <div class="sectionHeadV2">
    <?php if($beyebrow): ?><p class="eyebrow"><?=$beyebrow?></p><?php endif; ?>
    <?php if($btitle): ?><h2><?=$btitle?></h2><?php endif; ?>
    <?php if($btext): ?><p><?=$btext?></p><?php endif; ?>
  </div>
  <?php endif; ?>
  <?php if(!empty($bextra)): ?>
  <div class="featuresGrid">
    <?php foreach($bextra as $feat):
      $parts = explode(':', $feat, 2);
      $ftitle = trim($parts[0]);
      $fdesc  = trim($parts[1] ?? '');
    ?>
    <div class="featureCard">
      <div class="featureIcon"><?=feature_icon($ftitle)?></div>
      <div>
        <p class="featureTitle"><?=h($ftitle)?></p>
        <?php if($fdesc): ?><p class="featureDesc"><?=h($fdesc)?></p><?php endif; ?>
      </div>
    </div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</section>

<?php elseif($btype==='brand_intro'): ?>
<section class="desktopIntro reveal">
  <div>
    <?php if($beyebrow): ?><p class="eyebrow"><?=$beyebrow?></p><?php endif; ?>
    <h2><?=$btitle?></h2>
  </div>
  <p><?=$btext?></p>
</section>

<?php elseif($btype==='accessories'): ?>
<section class="cooking reveal">
  <div class="sectionHeadV2">
    <?php if($beyebrow): ?><p class="eyebrow"><?=$beyebrow?></p><?php endif; ?>
    <h2><?=$btitle?></h2>
    <?php if($btext): ?><p><?=$btext?></p><?php endif; ?>
  </div>
  <?php if($bimage): ?>
  <div class="editorialGrid">
    <img src="<?=$bimage?>" alt="<?=$btitle?>">
  </div>
  <?php endif; ?>
</section>

<?php elseif($btype==='video'): ?>
<?php if($bimage): ?>
<section class="videoBlock reveal">
  <div class="sectionHeadV2">
    <?php if($beyebrow): ?><p class="eyebrow"><?=$beyebrow?></p><?php endif; ?>
    <h2><?=$btitle?></h2>
  </div>
  <video controls poster="<?=$bimage?>" style="width:100%;border-radius:24px;max-height:560px;object-fit:cover">
    <source src="<?=$bimage?>" type="video/mp4">
  </video>
</section>
<?php endif; ?>

<?php elseif($btype==='materials'): ?>
<section class="craft reveal" id="craft">
  <div>
    <?php if($beyebrow): ?><p class="eyebrow"><?=$beyebrow?></p><?php endif; ?>
    <h2><?=$btitle?></h2>
    <?php if($btext): ?><p><?=$btext?></p><?php endif; ?>
  </div>
  <?php if(!empty($bextra)): ?>
  <div class="craftCards">
    <?php
    $craftIcons = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    ];
    foreach(array_values($bextra) as $mi=>$mat):
      $parts = explode(':', $mat, 2);
      $mtitle = trim($parts[0]);
      $mdesc  = trim($parts[1] ?? '');
      $icon = $craftIcons[$mi % count($craftIcons)];
    ?>
    <article>
      <div class="craftCardIcon"><?=$icon?></div>
      <span><?=h($mtitle)?></span>
      <?php if($mdesc): ?><p><?=h($mdesc)?></p><?php endif; ?>
    </article>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</section>

<?php elseif($btype==='how'): ?>
<section class="productHow reveal">
  <div class="sectionIntro">
    <?php if($beyebrow): ?><p class="eyebrow"><?=$beyebrow?></p><?php endif; ?>
    <h2><?=$btitle?></h2>
  </div>
  <?php if(!empty($bextra)): ?>
  <div class="stepsGrid">
    <?php foreach(array_values($bextra) as $si=>$step): 
      $parts = explode(':', $step, 2);
      $stitle = trim($parts[0]);
      $sdesc = trim($parts[1] ?? '');
    ?>
    <article>
      <span><?=str_pad($si+1,2,'0',STR_PAD_LEFT)?></span>
      <h3><?=h($stitle)?></h3>
      <?php if($sdesc): ?><p><?=h($sdesc)?></p><?php endif; ?>
    </article>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</section>

<?php elseif($btype==='trust_static' || $btype==='trust'): ?>
<section class="sectionV2 reveal">
  <div class="sectionHeadV2">
    <?php if($beyebrow): ?><p class="eyebrow"><?=$beyebrow?></p><?php endif; ?>
    <h2><?=$btitle?></h2>
    <?php if($btext): ?><p><?=$btext?></p><?php endif; ?>
  </div>
  <?php if(!empty($bextra)): ?>
  <div class="featuresGrid">
    <?php foreach(array_values($bextra) as $trust):
      $parts = explode(':', $trust, 2);
      $ttitle = trim($parts[0]); $tdesc = trim($parts[1] ?? '');
    ?>
    <div class="featureCard">
      <div class="featureIcon"><?=feature_icon($ttitle)?></div>
      <div><p class="featureTitle"><?=h($ttitle)?></p><?php if($tdesc):?><p class="featureDesc"><?=h($tdesc)?></p><?php endif;?></div>
    </div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</section>

<?php elseif($btype==='delivery'): ?>
<section class="sectionV2 reveal">
  <div class="sectionHeadV2">
    <?php if($beyebrow): ?><p class="eyebrow"><?=$beyebrow?></p><?php endif; ?>
    <h2><?=$btitle?></h2>
    <?php if($btext): ?><p><?=$btext?></p><?php endif; ?>
  </div>
  <?php if(!empty($bextra)): ?>
  <div class="featuresGrid">
    <?php foreach($bextra as $ditem):
      $parts = explode(':', $ditem, 2);
      $dtitle = trim($parts[0]); $ddesc = trim($parts[1] ?? '');
    ?>
    <div class="featureCard">
      <div class="featureIcon"><?=feature_icon($dtitle)?></div>
      <div><p class="featureTitle"><?=h($dtitle)?></p><?php if($ddesc):?><p class="featureDesc"><?=h($ddesc)?></p><?php endif;?></div>
    </div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</section>

<?php elseif($btype==='story' || $btype==='text_image'): ?>
<section class="splitRitual reveal">
  <?php if($bimage): ?><div class="bigPhoto"><img src="<?=$bimage?>" alt="<?=$btitle?>"></div><?php endif; ?>
  <div class="ritualText">
    <?php if($beyebrow): ?><p class="eyebrow"><?=$beyebrow?></p><?php endif; ?>
    <h2><?=$btitle?></h2>
    <?php if($btext): ?><p><?=$btext?></p><?php endif; ?>
    <?php if($bcta): ?><a class="btn primary" href="<?=$bctalink?>"><?=$bcta?></a><?php endif; ?>
  </div>
</section>

<?php elseif($btype==='fire_cooking' || $btype==='use_cases'): ?>
<section class="cooking reveal">
  <div class="sectionHeadV2">
    <?php if($beyebrow): ?><p class="eyebrow"><?=$beyebrow?></p><?php endif; ?>
    <h2><?=$btitle?></h2>
    <?php if($btext): ?><p><?=$btext?></p><?php endif; ?>
  </div>
  <?php if($bimage): ?>
  <div class="editorialGrid">
    <img src="<?=$bimage?>" alt="">
  </div>
  <?php endif; ?>
</section>

<?php elseif($btype==='quote'): ?>
<section class="manifest reveal">
  <p class="manifestQuote"><?=$btitle?></p>
  <?php if($btext): ?><p class="manifestSub"><?=$btext?></p><?php endif; ?>
</section>

<?php endif; ?>
<?php endforeach; ?>

<?php render_footer($pdo); ?>

<?php include __DIR__.'/includes/cart.php'; ?>
<script src="assets/script.js?v=5.0.0"></script>
</body></html>
