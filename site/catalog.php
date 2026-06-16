<?php
require __DIR__.'/includes/db.php';
require __DIR__.'/includes/nav.php';
$pdo = db();

$catSlug = isset($_GET['cat']) ? $_GET['cat'] : '';
$search  = isset($_GET['q']) ? trim($_GET['q']) : '';
$sort    = isset($_GET['sort']) ? $_GET['sort'] : 'popular';

// Миграция
foreach(['parent_id INTEGER DEFAULT NULL',"image TEXT DEFAULT ''"," description TEXT DEFAULT ''"] as $col_def){
    $col=explode(' ',$col_def)[0];
    try{$pdo->exec("ALTER TABLE categories ADD COLUMN $col_def");}catch(Exception $e){}
}

// Все категории
$allCats = $pdo->query("SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order,id")->fetchAll(PDO::FETCH_ASSOC);
// Только корневые
$cats = array_values(array_filter($allCats, fn($c)=>empty($c['parent_id'])));
// Подкатегории по parent_id
$subsByParent = [];
foreach($allCats as $ac){ if(!empty($ac['parent_id'])) $subsByParent[$ac['parent_id']][] = $ac; }

// Текущая категория
$currentCat = null;
foreach($allCats as $cc){ if($cc['slug']===$catSlug){ $currentCat=$cc; break; } }

// Подкатегории текущей категории
$currentSubs = [];
if($currentCat) $currentSubs = $subsByParent[$currentCat['id']] ?? [];

// Если выбрана родительская категория — включаем товары из подкатегорий тоже
$catIds = [];
if($currentCat){
    $catIds[] = (int)$currentCat['id'];
    foreach($currentSubs as $sub) $catIds[] = (int)$sub['id'];
}

$where = array("p.is_active=1");
$params = array();
if($catSlug && $catSlug !== 'all' && !empty($catIds)){
    $ph = implode(',', array_fill(0, count($catIds), '?'));
    $where[] = "p.category_id IN ($ph)";
    $params = array_merge($params, $catIds);
}
if($search){
    $where[] = "(p.name LIKE ? OR p.subtitle LIKE ?)";
    $params[] = "%" . $search . "%";
    $params[] = "%" . $search . "%";
}
if($sort === 'price_asc') $orderBy = 'p.price ASC';
elseif($sort === 'price_desc') $orderBy = 'p.price DESC';
elseif($sort === 'new') $orderBy = 'p.id DESC';
else $orderBy = 'c.sort_order ASC, p.sort_order ASC, p.id ASC';

$sql = "SELECT p.*, c.name category_name, c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE " . implode(' AND ', $where) . " ORDER BY " . $orderBy;
$st = $pdo->prepare($sql);
$st->execute($params);
$products = $st->fetchAll(PDO::FETCH_ASSOC);

$pageTitle = $currentCat ? h($currentCat['name']) . ' — LUKA OUTDOOR' : 'Каталог — LUKA OUTDOOR';
$totalCount = (int)$pdo->query("SELECT COUNT(*) FROM products WHERE is_active=1")->fetchColumn();
?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=$pageTitle?></title>
<meta name="description" content="<?=$currentCat ? h($currentCat['seo_description'] ?: 'Купить '.h($currentCat['name']).' в интернет-магазине LUKA OUTDOOR. Премиальное outdoor снаряжение ручной работы. Быстрая доставка по всей России.') : 'Каталог LUKA OUTDOOR — костровые системы, походная одежда и outdoor аксессуары ручной работы. Более 50 товаров. Быстрая доставка по всей России.'?>">
<link rel="canonical" href="https://lukaoutdoor.com/catalog.php<?=$catSlug ? '?cat='.urlencode($catSlug) : ''?>">
<meta property="og:title" content="<?=$pageTitle?>">
<meta property="og:description" content="<?=$currentCat ? h($currentCat['name']).' — купить в LUKA OUTDOOR' : 'Весь каталог LUKA OUTDOOR'?>">
<meta property="og:url" content="https://lukaoutdoor.com/catalog.php<?=$catSlug ? '?cat='.urlencode($catSlug) : ''?>">
<meta property="og:image" content="https://lukaoutdoor.com/assets/images/hero.webp">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css?v=6.0.0">
<style>
.catalogPage{width:min(var(--max),calc(100vw - 120px));margin:0 auto;padding:120px 0 100px}
.catalogHeader{margin-bottom:40px}
.catalogHeader h1{font-family:var(--head);font-size:clamp(52px,9vw,96px);line-height:.9;text-transform:uppercase;margin:0 0 14px}
.catalogHeader p{color:var(--muted);font-size:17px;max-width:500px}
.catChips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px}
.catChip{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(243,241,236,.12);border-radius:10px;background:transparent;color:var(--text);padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;transition:.2s;white-space:nowrap;font-family:inherit}
.catChip:hover,.catChip.active{background:rgba(201,121,43,.15);border-color:var(--copper);color:var(--copper2)}
.catChip small{color:var(--muted);font-size:11px}
.catalogToolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid rgba(243,241,236,.08)}
.catalogSearch{flex:1;min-width:200px;max-width:340px;background:rgba(255,255,255,.05);border:1px solid rgba(243,241,236,.12);border-radius:12px;color:var(--text);padding:12px 16px;font:inherit;font-size:14px;outline:none}
.catalogSearch:focus{border-color:rgba(201,121,43,.5)}
.sortSelect{background:rgba(255,255,255,.05);border:1px solid rgba(243,241,236,.12);border-radius:12px;color:var(--text);padding:12px 16px;font:inherit;font-size:13px;cursor:pointer;outline:none}
.catalogCount{color:var(--muted);font-size:13px;margin-left:auto}
.catalogGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.catalogEmpty{text-align:center;padding:80px 20px;color:var(--muted)}
.catalogEmpty h2{font-family:var(--head);font-size:52px;text-transform:uppercase;margin:0 0 12px;color:var(--text)}
@media(max-width:980px){.catalogPage{width:calc(100vw - 48px);padding:90px 0 80px}.catalogGrid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.catalogGrid{grid-template-columns:1fr}.catalogPage{width:calc(100vw - 32px)}.catGrid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.catalogGrid{grid-template-columns:1fr}.catalogPage{width:calc(100vw - 32px)}}
</style>
<script type="application/ld+json">
<?php
$breadcrumbs = [
  ['@type'=>'ListItem','position'=>1,'name'=>'Главная','item'=>'https://lukaoutdoor.com/'],
  ['@type'=>'ListItem','position'=>2,'name'=>'Каталог','item'=>'https://lukaoutdoor.com/catalog.php'],
];
if($currentCat) $breadcrumbs[] = ['@type'=>'ListItem','position'=>3,'name'=>$currentCat['name'],'item'=>'https://lukaoutdoor.com/catalog.php?cat='.urlencode($catSlug)];
echo json_encode(['@context'=>'https://schema.org','@type'=>'BreadcrumbList','itemListElement'=>$breadcrumbs],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
?>
</script>
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

<main class="catalogPage">
  <nav class="breadcrumbs" aria-label="Хлебные крошки">
    <a href="/">Главная</a><span aria-hidden="true">›</span>
    <?php if($currentCat): ?>
      <a href="/catalog.php">Каталог</a><span aria-hidden="true">›</span>
      <b aria-current="page"><?=h($currentCat['name'])?></b>
    <?php else: ?>
      <b aria-current="page">Каталог</b>
    <?php endif; ?>
  </nav>
  <div class="catalogHeader">
    <p class="eyebrow"><?=$currentCat ? 'КАТАЛОГ' : 'LUKA OUTDOOR'?></p>
    <h1><?=$currentCat ? h($currentCat['name']) : 'Весь каталог'?></h1>
    <?php if(!$currentCat): ?><p>Костровые системы, аксессуары и outdoor снаряжение.</p><?php endif; ?>
  </div>

<?php if(!$catSlug || $catSlug==='all'): ?>
  <!-- Главный каталог — карточки корневых категорий -->
  <div class="catGrid">
    <?php foreach($cats as $cat):
      $subs = $subsByParent[$cat['id']] ?? [];
      $cnt = (int)$pdo->query("SELECT COUNT(*) FROM products p WHERE p.is_active=1 AND p.category_id IN (SELECT id FROM categories WHERE id=".(int)$cat['id']." OR parent_id=".(int)$cat['id'].")")->fetchColumn();
    ?>
    <a class="catCard" href="/catalog.php?cat=<?=h($cat['slug'])?>">
      <?php if(!empty($cat['image'])): ?>
        <img src="/<?=h($cat['image'])?>" alt="<?=h($cat['name'])?>">
      <?php else: ?>
        <div class="catCardPlaceholder"><svg viewBox="0 0 24 24" fill="none" stroke="#c9792b" stroke-width="1.5" width="52" height="52"><path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/><path d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"/></svg></div>
      <?php endif; ?>
      <div class="catCardOverlay"></div>
      <div class="catCardBody">
        <div class="catCardName"><?=h($cat['name'])?></div>
        <div class="catCardCount"><?=$cnt?> товаров</div>
        <?php if(!empty($subs)): ?>
        <div class="catCardSubs">
          <?php foreach(array_slice($subs,0,3) as $sub): ?>
          <span class="catCardSub"><?=h($sub['name'])?></span>
          <?php endforeach; ?>
        </div>
        <?php endif; ?>
      </div>
    </a>
    <?php endforeach; ?>
  </div>

<?php elseif($currentCat && !empty($currentSubs)): ?>
  <!-- Родительская категория с подкатегориями — карточки подкатегорий -->
  <div class="catChips" style="margin-bottom:16px">
    <a class="catChip" href="/catalog.php">← Все категории</a>
    <a class="catChip active" href="/catalog.php?cat=<?=h($currentCat['slug'])?>"><?=h($currentCat['name'])?></a>
  </div>
  <div class="catGrid" style="margin-bottom:32px">
    <?php foreach($currentSubs as $sub):
      $cnt = (int)$pdo->query("SELECT COUNT(*) FROM products WHERE is_active=1 AND category_id=".(int)$sub['id'])->fetchColumn();
    ?>
    <a class="catCard" href="/catalog.php?cat=<?=h($sub['slug'])?>">
      <?php if(!empty($sub['image'])): ?>
        <img src="/<?=h($sub['image'])?>" alt="<?=h($sub['name'])?>">
      <?php else: ?>
        <div class="catCardPlaceholder"><svg viewBox="0 0 24 24" fill="none" stroke="#c9792b" stroke-width="1.5" width="44" height="44"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg></div>
      <?php endif; ?>
      <div class="catCardOverlay"></div>
      <div class="catCardBody">
        <div class="catCardName"><?=h($sub['name'])?></div>
        <div class="catCardCount"><?=$cnt?> товаров</div>
      </div>
    </a>
    <?php endforeach; ?>
  </div>

<?php else: ?>
  <!-- Конечная категория — только кнопка назад -->
  <div class="catChips">
    <?php
      $parentCat = null;
      if($currentCat && !empty($currentCat['parent_id'])){
        foreach($allCats as $ac){ if($ac['id']==$currentCat['parent_id']){ $parentCat=$ac; break; } }
      }
      // Соседние категории: если есть родитель — его подкатегории, иначе только кнопка назад
      $siblingCats = $parentCat ? ($subsByParent[$parentCat['id']] ?? []) : [];
    ?>
    <a class="catChip" href="<?=$parentCat ? '/catalog.php?cat='.h($parentCat['slug']) : '/catalog.php'?>">← <?=$parentCat ? h($parentCat['name']) : 'Все категории'?></a>
    <?php foreach($siblingCats as $cat):
      $cnt=(int)$pdo->query("SELECT COUNT(*) FROM products WHERE is_active=1 AND category_id=".(int)$cat['id'])->fetchColumn();
    ?>
    <a class="catChip <?=($catSlug===$cat['slug'])?'active':''?>" href="/catalog.php?cat=<?=h($cat['slug'])?>" data-slug="<?=h($cat['slug'])?>" data-name="<?=h($cat['name'])?>"><?=h($cat['name'])?> <small><?=$cnt?></small></a>
    <?php endforeach; ?>
    <?php if(empty($siblingCats)): ?>
    <a class="catChip active" href="/catalog.php?cat=<?=h($currentCat['slug'])?>" data-slug="<?=h($currentCat['slug'])?>"><?=h($currentCat['name'])?></a>
    <?php endif; ?>
  </div>
<?php endif; ?>

  <div class="catalogToolbar">
    <input class="catalogSearch" type="search" placeholder="Поиск..." value="<?=h($search)?>" id="catalogSearchInput">
    <select class="sortSelect" id="sortSelect">
      <option value="popular" <?=($sort==='popular')?'selected':''?>>По популярности</option>
      <option value="new" <?=($sort==='new')?'selected':''?>>Сначала новые</option>
      <option value="price_asc" <?=($sort==='price_asc')?'selected':''?>>Цена: по возрастанию</option>
      <option value="price_desc" <?=($sort==='price_desc')?'selected':''?>>Цена: по убыванию</option>
    </select>
    <span class="catalogCount" id="catalogCount"><?=count($products)?> тов.</span>
  </div>

  <div id="catalogHeader" class="catalogHeader" style="display:none"></div>

  <div class="catalogGrid" id="catalogGrid">
</main>

<?php render_footer($pdo); ?>

<?php include __DIR__.'/includes/cart.php'; ?>
<script src="assets/script.js?v=6.0.0"></script>
<script>
// ── Состояние ────────────────────────────────────────────────────────────
let catalogState = {
  cat:  '<?=h($catSlug)?>',
  q:    '<?=h($search)?>',
  sort: '<?=h($sort)?>'
};

// ── Рендер карточки товара ───────────────────────────────────────────────
function renderCard(p){
  const img  = p.image || 'assets/images/hero.webp';
  const slug = p.slug  || p.id;
  const payload = JSON.stringify({id:p.id, name:p.name, price:p.price, image:img});
  const badge = p.badge ? `<em>${p.badge}</em>` : '';
  const price = new Intl.NumberFormat('ru-RU').format(p.price) + ' ₽';
  return `<article class="product cardV2 reveal">
    <a class="productImg" href="product.php?slug=${slug}">
      <img loading="lazy" src="${img}" alt="${p.name}">${badge}
    </a>
    <div class="productBody">
      <small>${p.category_name || ''}</small>
      <h3>${p.name}</h3>
      <div class="priceLine">
        <strong>${price}</strong>
        <button onclick='addToCart(${payload},this)'>+</button>
      </div>
      <a class="details" href="product.php?slug=${slug}">Подробнее</a>
    </div>
  </article>`;
}

// ── Загрузка товаров ─────────────────────────────────────────────────────
async function loadCatalog(){
  const grid  = document.getElementById('catalogGrid');
  const count = document.getElementById('catalogCount');
  const header = document.getElementById('catalogHeader');

  // Skeleton loader
  grid.innerHTML = Array(6).fill(0).map(()=>`
    <article class="cardV2 skeleton-card">
      <div class="skeleton-img"></div>
      <div class="productBody">
        <div class="skeleton-line" style="width:40%;height:10px;margin-bottom:10px"></div>
        <div class="skeleton-line" style="width:70%;height:18px;margin-bottom:8px"></div>
        <div class="skeleton-line" style="width:90%;height:14px;margin-bottom:20px"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
          <div class="skeleton-line" style="width:35%;height:22px"></div>
          <div class="skeleton-circle"></div>
        </div>
      </div>
    </article>`).join('');
  grid.style.pointerEvents = 'none';

  const params = new URLSearchParams();
  if(catalogState.cat  && catalogState.cat !== 'all') params.set('cat',  catalogState.cat);
  if(catalogState.q)    params.set('q',    catalogState.q);
  if(catalogState.sort) params.set('sort', catalogState.sort);

  // Обновляем URL без перезагрузки
  const newUrl = '/catalog.php' + (params.toString() ? '?' + params.toString() : '');
  history.replaceState(null, '', newUrl);

  try {
    const r = await fetch('/catalog_api.php?' + params.toString());
    const d = await r.json();
    const products = d.products || [];

    // Обновляем счётчик
    if(count) count.textContent = products.length + ' тов.';

    // Обновляем заголовок
    if(header){
      if(catalogState.cat && catalogState.cat !== 'all'){
        const chip = document.querySelector(`.catChip[data-slug="${catalogState.cat}"]`);
        const catName = chip ? chip.dataset.name : catalogState.cat;
        header.innerHTML = `<p class="eyebrow">КАТАЛОГ</p><h1>${catName}</h1>`;
      } else {
        header.innerHTML = `<p class="eyebrow">LUKA OUTDOOR</p><h1>Весь каталог</h1><p>Костровые системы, аксессуары и outdoor снаряжение.</p>`;
      }
    }

    // Рендерим товары
    if(!products.length){
      grid.innerHTML = `<div class="catalogEmpty" style="grid-column:1/-1">
        <h2>Ничего не нашлось</h2>
        <p>Попробуйте другой запрос или категорию</p>
        <a class="btn primary" href="/catalog.php" style="margin-top:24px;display:inline-flex">Показать всё</a>
      </div>`;
    } else {
      grid.innerHTML = products.map(renderCard).join('');
    }

    // Обновляем активный чип категории
    document.querySelectorAll('.catChip').forEach(c=>{
      c.classList.toggle('active', c.dataset.slug === (catalogState.cat || 'all'));
    });

  } catch(e){
    console.error('Catalog load error:', e);
  }

  grid.style.pointerEvents = '';
}

// ── Обработчики ───────────────────────────────────────────────────────────
// Фильтр по категории
document.querySelectorAll('.catChip').forEach(chip=>{
  chip.addEventListener('click', e=>{
    // Если нет data-slug — обычный переход по href
    if(!chip.dataset.slug){
      window.location.href = chip.href;
      return;
    }
    e.preventDefault();
    catalogState.cat = chip.dataset.slug === 'all' ? '' : chip.dataset.slug;
    loadCatalog();
  });
});

// Поиск
let searchTimer;
document.getElementById('catalogSearchInput').addEventListener('input', function(){
  clearTimeout(searchTimer);
  searchTimer = setTimeout(()=>{
    catalogState.q = this.value.trim();
    loadCatalog();
  }, 400);
});

// Загружаем при старте
loadCatalog();
</script>
</body>
</html>
