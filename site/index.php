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
<section class="sectionV2 reveal" style="padding:80px 0">
  <div class="sectionHeadV2">
    <?php if($beyebrow): ?><p class="eyebrow"><?=$beyebrow?></p><?php endif; ?>
    <h2><?=$btitle?></h2>
    <?php if($btext): ?><p><?=$btext?></p><?php endif; ?>
  </div>
  <?php if(!empty($bextra)): ?>
  <div class="featuresGrid">
    <?php foreach($bextra as $feat): ?>
    <div class="featureCard">
      <span><?=h($feat)?></span>
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
    <?php foreach(array_values($bextra) as $mi=>$mat): ?>
    <article><span><?=h($mat)?></span></article>
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
  <div class="craftCards">
    <?php foreach(array_values($bextra) as $ti=>$trust): 
      $parts = explode(':', $trust, 2);
    ?>
    <article><span><?=h(trim($parts[0]))?></span><?php if(!empty($parts[1])): ?><p style="color:var(--muted);font-size:14px;margin-top:8px"><?=h(trim($parts[1]))?></p><?php endif; ?></article>
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
  <div class="craftCards">
    <?php foreach($bextra as $di=>$ditem): 
      $parts = explode(':', $ditem, 2);
    ?>
    <article><span><?=h(trim($parts[0]))?></span><?php if(!empty($parts[1])): ?><p style="color:var(--muted);font-size:14px;margin-top:8px"><?=h(trim($parts[1]))?></p><?php endif; ?></article>
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
  <p><?=$btitle?></p>
  <?php if($btext): ?><p><?=$btext?></p><?php endif; ?>
</section>

<?php endif; ?>
<?php endforeach; ?>

<?php render_footer($pdo); ?>

<?php include __DIR__.'/includes/cart.php'; ?>
<script src="assets/script.js?v=5.0.0"></script>
</body></html>
