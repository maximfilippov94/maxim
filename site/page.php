<?php
require __DIR__.'/includes/db.php';
require __DIR__.'/includes/nav.php';
$pdo = db();

$slug = trim($_GET['slug'] ?? '');
if(!$slug){ header('Location:/'); exit; }

// Ищем страницу
$st = $pdo->prepare("SELECT * FROM pages WHERE slug=? AND is_active=1 LIMIT 1");
$st->execute([$slug]);
$page = $st->fetch(PDO::FETCH_ASSOC);
if(!$page){ http_response_code(404); include __DIR__.'/404.php'; exit; }

// Секции страницы
$sections = $pdo->prepare("SELECT * FROM page_sections WHERE page_id=? AND is_active=1 ORDER BY sort_order,id");
$sections->execute([$page['id']]);
$sections = $sections->fetchAll(PDO::FETCH_ASSOC);

$pageTitle = $page['seo_title'] ?: $page['title'].' — LUKA OUTDOOR';
$pageDesc  = $page['seo_description'] ?: '';
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($pageTitle)?></title>
<meta name="description" content="<?=h($pageDesc)?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v=3.0.0">
<style>
.customPage{width:min(var(--max),calc(100vw - 120px));margin:0 auto;padding:120px 0 100px}
.customPage .breadcrumbs{margin-bottom:48px}
.pageSectionWrap:first-of-type{padding-top:0}
.pageHeroSimple{padding:80px 0 60px;border-bottom:1px solid rgba(243,241,236,.08);margin-bottom:60px}
.pageHeroSimple h1{font-family:var(--head);font-size:clamp(56px,10vw,100px);line-height:.9;text-transform:uppercase;margin:0 0 20px}
.pageHeroSimple p{color:var(--muted);font-size:18px;max-width:560px;line-height:1.6}
.pageSectionWrap{margin-bottom:72px}
.contactsGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:28px}
.contactItem{background:rgba(255,255,255,.04);border:1px solid rgba(243,241,236,.1);border-radius:20px;padding:24px;transition:.2s}
.contactItem:hover{border-color:rgba(201,121,43,.4)}
.contactItem span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.18em;margin-bottom:8px}
.contactItem b{font-size:18px;font-weight:700}
.pageTextBlock h2{font-family:var(--head);font-size:clamp(40px,7vw,72px);text-transform:uppercase;line-height:.9;margin:0 0 20px}
.pageTextBlock p{color:var(--muted);font-size:17px;line-height:1.7;max-width:720px}
.pageSplitBlock{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.pageSplitBlock img{width:100%;border-radius:24px;object-fit:cover;aspect-ratio:4/3}
.pageSplitBlock h2{font-family:var(--head);font-size:clamp(36px,6vw,64px);text-transform:uppercase;line-height:.9;margin:0 0 20px}
.pageSplitBlock p{color:var(--muted);font-size:16px;line-height:1.7}
.pageCardsBlock{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:24px}
.pageCard{background:rgba(255,255,255,.04);border:1px solid rgba(243,241,236,.1);border-radius:20px;padding:24px}
.pageCard h3{font-family:var(--head);font-size:28px;text-transform:uppercase;margin:0 0 10px}
.pageCard p{color:var(--muted);font-size:14px;line-height:1.6;margin:0}
@media(max-width:980px){
  .customPage{width:calc(100vw - 48px);padding:90px 0 80px}
  .contactsGrid{grid-template-columns:1fr}
  .pageSplitBlock{grid-template-columns:1fr}
  .pageCardsBlock{grid-template-columns:1fr}
}
</style>
</head>
<body>
<?php render_topbar($pdo); ?>

<main class="customPage">
<nav class="breadcrumbs" aria-label="Хлебные крошки">
  <a href="/">Главная</a><span aria-hidden="true">›</span>
  <b aria-current="page"><?=h($page['title'])?></b>
</nav>
<div style="height:40px"></div>
<?php foreach($sections as $s):
  $stype   = $s['type'];
  $stitle  = h($s['title'] ?? '');
  $stext   = h($s['text'] ?? '');
  $sey     = h($s['eyebrow'] ?? '');
  $ssub    = h($s['subtitle'] ?? '');
  $simage  = $s['image'] ?? '';
  $scta    = h($s['cta_text'] ?? '');
  $sctalink= h($s['cta_link'] ?? '#');
  $sitems  = array_filter(array_map('trim', explode('|', $s['extra'] ?? '')));
?>

<?php if($stype === 'hero_simple'): ?>
<div class="pageHeroSimple">
  <?php if($sey): ?><p class="eyebrow"><?=$sey?></p><?php endif; ?>
  <h1><?=$stitle?></h1>
  <?php if($stext): ?><p><?=$stext?></p><?php endif; ?>
  <?php if($scta): ?><a class="btn primary" href="<?=$sctalink?>" style="margin-top:28px;display:inline-flex"><?=$scta?></a><?php endif; ?>
</div>

<?php elseif($stype === 'text'): ?>
<div class="pageSectionWrap pageTextBlock">
  <?php if($sey): ?><p class="eyebrow"><?=$sey?></p><?php endif; ?>
  <?php if($stitle): ?><h2><?=$stitle?></h2><?php endif; ?>
  <?php if($stext): ?><p><?=$stext?></p><?php endif; ?>
  <?php if($scta): ?><a class="btn primary" href="<?=$sctalink?>" style="margin-top:24px;display:inline-flex"><?=$scta?></a><?php endif; ?>
</div>

<?php elseif($stype === 'text_image'): ?>
<div class="pageSectionWrap pageSplitBlock">
  <?php if($simage): ?><img src="/<?=h($simage)?>" alt="<?=$stitle?>"><?php endif; ?>
  <div>
    <?php if($sey): ?><p class="eyebrow"><?=$sey?></p><?php endif; ?>
    <?php if($stitle): ?><h2><?=$stitle?></h2><?php endif; ?>
    <?php if($stext): ?><p><?=$stext?></p><?php endif; ?>
    <?php if($scta): ?><a class="btn primary" href="<?=$sctalink?>" style="margin-top:20px;display:inline-flex"><?=$scta?></a><?php endif; ?>
  </div>
</div>

<?php elseif($stype === 'cards'): ?>
<div class="pageSectionWrap">
  <?php if($sey): ?><p class="eyebrow"><?=$sey?></p><?php endif; ?>
  <?php if($stitle): ?><h2 style="font-family:var(--head);font-size:clamp(40px,7vw,72px);text-transform:uppercase;line-height:.9;margin:0 0 8px"><?=$stitle?></h2><?php endif; ?>
  <?php if($stext): ?><p style="color:var(--muted);font-size:16px;margin:0 0 4px"><?=$stext?></p><?php endif; ?>
  <div class="pageCardsBlock">
    <?php foreach($sitems as $item):
      $parts = explode(':', $item, 2);
    ?>
    <div class="pageCard">
      <h3><?=h(trim($parts[0]))?></h3>
      <?php if(!empty($parts[1])): ?><p><?=h(trim($parts[1]))?></p><?php endif; ?>
    </div>
    <?php endforeach; ?>
  </div>
</div>

<?php elseif($stype === 'contacts_block'): ?>
<div class="pageSectionWrap">
  <?php if($sey): ?><p class="eyebrow"><?=$sey?></p><?php endif; ?>
  <?php if($stitle): ?><h2 style="font-family:var(--head);font-size:clamp(40px,7vw,72px);text-transform:uppercase;line-height:.9;margin:0"><?=$stitle?></h2><?php endif; ?>
  <div class="contactsGrid">
    <?php foreach($sitems as $item):
      $parts = explode(':', $item, 2);
      $label = trim($parts[0]);
      $value = trim($parts[1] ?? '');
      // Определяем ссылку
      $href = '#';
      if(str_starts_with($value, '@')) $href = 'https://t.me/'.ltrim($value,'@');
      elseif(str_starts_with($value, '+7') || str_starts_with($value, '8 8')) $href = 'tel:'.preg_replace('/[^0-9+]/','',$value);
      elseif(str_contains($value, '@') && str_contains($value, '.')) $href = 'mailto:'.$value;
    ?>
    <a class="contactItem" href="<?=h($href)?>" <?=$href!='#'?'target="_blank"':''?>>
      <span><?=h($label)?></span>
      <b><?=h($value)?></b>
    </a>
    <?php endforeach; ?>
  </div>
</div>

<?php elseif($stype === 'lead_form'): ?>
<div class="pageSectionWrap">
  <?php if($sey): ?><p class="eyebrow"><?=$sey?></p><?php endif; ?>
  <?php if($stitle): ?><h2 style="font-family:var(--head);font-size:clamp(40px,7vw,72px);text-transform:uppercase;line-height:.9;margin:0 0 32px"><?=$stitle?></h2><?php endif; ?>
  <form id="pageLeadForm" style="max-width:560px;display:grid;gap:14px">
    <input name="customer_name" required placeholder="Ваше имя" style="background:rgba(255,255,255,.05);border:1px solid rgba(243,241,236,.12);border-radius:14px;color:var(--text);padding:16px 18px;font:inherit;font-size:15px;outline:none">
    <input name="phone" required placeholder="Телефон" style="background:rgba(255,255,255,.05);border:1px solid rgba(243,241,236,.12);border-radius:14px;color:var(--text);padding:16px 18px;font:inherit;font-size:15px;outline:none">
    <input name="city" placeholder="Город" style="background:rgba(255,255,255,.05);border:1px solid rgba(243,241,236,.12);border-radius:14px;color:var(--text);padding:16px 18px;font:inherit;font-size:15px;outline:none">
    <textarea name="comment" placeholder="Ваш вопрос или что хотите подобрать" rows="4" style="background:rgba(255,255,255,.05);border:1px solid rgba(243,241,236,.12);border-radius:14px;color:var(--text);padding:16px 18px;font:inherit;font-size:15px;outline:none;resize:vertical"></textarea>
    <button class="btn primary" type="submit" style="justify-content:center">Отправить заявку</button>
    <p id="pageLeadResult" style="color:var(--copper2);font-size:14px;margin:0"></p>
  </form>
</div>

<?php elseif($stype === 'products_grid'): ?>
<?php
  $gridIds = array_filter(array_map('intval', $sitems));
  if(!empty($gridIds)){
    $ph = implode(',', array_fill(0, count($gridIds), '?'));
    $pgSt = $pdo->prepare("SELECT p.*, c.name category_name, c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id IN ($ph) AND p.is_active=1");
    $pgSt->execute(array_values($gridIds));
    $pgProducts = $pgSt->fetchAll(PDO::FETCH_ASSOC);
  } else {
    $pgProducts = $pdo->query("SELECT p.*, c.name category_name, c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.is_active=1 ORDER BY p.sort_order,p.id LIMIT 6")->fetchAll(PDO::FETCH_ASSOC);
  }
?>
<div class="pageSectionWrap">
  <?php if($sey): ?><p class="eyebrow"><?=$sey?></p><?php endif; ?>
  <?php if($stitle): ?><h2 style="font-family:var(--head);font-size:clamp(40px,7vw,72px);text-transform:uppercase;line-height:.9;margin:0 0 28px"><?=$stitle?></h2><?php endif; ?>
  <div class="productsGrid v2Grid">
    <?php foreach($pgProducts as $pr):
      $payload = json_encode(["id"=>(int)$pr["id"],"name"=>$pr["name"],"price"=>(int)$pr["price"],"image"=>$pr["image"]?:'assets/images/hero.webp'], JSON_UNESCAPED_UNICODE);
    ?>
    <article class="product cardV2 reveal">
      <a class="productImg" href="/product.php?slug=<?=h($pr['slug']?:$pr['id'])?>">
        <img loading="lazy" src="/<?=h($pr['image']?:'assets/images/hero.webp')?>" alt="<?=h($pr['name'])?>">
        <?php if($pr['badge']): ?><em><?=h($pr['badge'])?></em><?php endif; ?>
      </a>
      <div class="productBody">
        <small><?=h($pr['category_name'])?></small>
        <h3><?=h($pr['name'])?></h3>
        <div class="priceLine"><strong><?=money($pr['price'])?></strong><button onclick='addToCart(<?=$payload?>,this)'>+</button></div>
        <a class="details" href="/product.php?slug=<?=h($pr['slug']?:$pr['id'])?>">Подробнее</a>
      </div>
    </article>
    <?php endforeach; ?>
  </div>
</div>

<?php elseif($stype === 'quote'): ?>
<div class="pageSectionWrap manifest reveal">
  <p><?=$stitle?></p>
  <?php if($stext): ?><p><?=$stext?></p><?php endif; ?>
</div>

<?php endif; ?>
<?php endforeach; ?>
</main>

<?php render_footer($pdo); ?>

<?php include __DIR__.'/includes/cart.php'; ?>
<script src="/assets/script.js?v=5.0.0"></script>
<script>
// Page lead form
document.getElementById('pageLeadForm') && document.getElementById('pageLeadForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const btn = this.querySelector('button[type=submit]');
  const res = document.getElementById('pageLeadResult');
  const fd = new FormData(this);
  fd.append('quick_request','1');
  btn.disabled = true; btn.textContent = 'Отправка...';
  try {
    const r = await fetch('/order.php',{method:'POST',body:fd});
    const d = await r.json();
    res.textContent = d.message;
    if(d.ok){ this.reset(); }
  } catch(err){ res.textContent = 'Ошибка отправки'; }
  btn.disabled = false; btn.textContent = 'Отправить заявку';
});
</script>
</body>
</html>
