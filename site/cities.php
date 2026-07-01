<?php
require __DIR__.'/includes/db.php';
require __DIR__.'/includes/nav.php';
$pdo = db();

require __DIR__.'/includes/cities_data.php';

$title = 'Доставка по России — LUKA OUTDOOR';
$desc  = 'Доставляем костровые чаши и outdoor снаряжение во все города России через СДЭК. Выберите ваш город.';
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($title)?></title>
<meta name="description" content="<?=h($desc)?>">
<link rel="canonical" href="https://lukaoutdoor.com/cities.php">
<link rel="icon" type="image/png" href="/assets/images/favicon.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v=6.2.0">
<style>
.citiesPage { width: min(var(--max), calc(100vw - 120px)); margin: 0 auto; padding: 120px 0 100px; }
.citiesHeader { margin-bottom: 48px; padding-bottom: 32px; border-bottom: 1px solid rgba(243,241,236,.08); }
.citiesHeader h1 { font-family: var(--head); font-size: clamp(48px,8vw,88px); text-transform: uppercase; line-height: .9; margin: 0 0 12px; }
.citiesHeader p { font-size: 16px; color: var(--muted); max-width: 480px; line-height: 1.55; margin: 0; }

.popularSection { margin-bottom: 40px; }
.popularChips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.popularChip {
  border: 1px solid rgba(201,121,43,.3);
  border-radius: var(--radius-pill);
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 600;
  color: var(--copper2);
  text-decoration: none;
  background: rgba(201,121,43,.06);
  transition: background 200ms ease, border-color 200ms ease;
}
.popularChip:hover { background: rgba(201,121,43,.16); border-color: rgba(201,121,43,.6); }

.alphaNav { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 24px; margin-top: 12px; }
.alphaBtn {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(243,241,236,.1);
  border-radius: 8px;
  font-size: 13px; font-weight: 700;
  color: var(--muted);
  text-decoration: none;
  transition: color 200ms ease, border-color 200ms ease;
}
.alphaBtn:hover { color: var(--copper2); border-color: rgba(201,121,43,.4); }

.letterGroup { margin-bottom: 28px; }
.letterHeading { font-family: var(--head); font-size: 32px; color: var(--copper2); line-height: 1; margin-bottom: 10px; }
.cityLinks { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; }
.cityLink {
  padding: 9px 14px;
  border: 1px solid rgba(243,241,236,.07);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text);
  text-decoration: none;
  background: rgba(255,255,255,.02);
  transition: border-color 200ms ease, color 200ms ease;
}
.cityLink:hover { border-color: rgba(201,121,43,.35); color: var(--copper2); }

@media(max-width:980px) {
  .citiesPage { width: calc(100vw - 48px); padding: 90px 0 80px; }
}
@media(max-width:520px) {
  .citiesPage { width: calc(100vw - 32px); }
  .cityLinks { grid-template-columns: repeat(2, 1fr); }
}
</style>
</head>
<body>
<?php include __DIR__.'/includes/metrika.php'; ?>
<?php render_topbar($pdo); ?>

<main class="citiesPage">
  <nav class="breadcrumbs" aria-label="Хлебные крошки">
    <a href="/">Главная</a><span aria-hidden="true">›</span>
    <b aria-current="page">Города доставки</b>
  </nav>

  <div class="citiesHeader">
    <p class="eyebrow">ДОСТАВКА ПО РОССИИ</p>
    <h1>Города доставки</h1>
    <p>Доставляем через СДЭК по всей России. Выберите ваш город и узнайте адреса пунктов выдачи.</p>
  </div>

  <?php
  $grouped = [];
  foreach($cities_data as $city){
      $letter = mb_strtoupper(mb_substr($city['name'], 0, 1));
      $grouped[$letter][] = $city;
  }
  ksort($grouped);

  $popular = ['Москва','Санкт-Петербург','Екатеринбург','Новосибирск','Казань','Краснодар','Нижний Новгород','Самара','Ростов-на-Дону','Уфа','Челябинск','Тюмень'];
  $popularCities = array_filter($cities_data, fn($c) => in_array($c['name'], $popular));
  ?>

  <div class="popularSection">
    <p class="eyebrow">ПОПУЛЯРНЫЕ ГОРОДА</p>
    <div class="popularChips">
      <?php foreach($popularCities as $city): ?>
      <a class="popularChip" href="/city/<?=h($city['slug'])?>"><?=h($city['name'])?></a>
      <?php endforeach; ?>
    </div>
  </div>

  <p class="eyebrow">ВСЕ ГОРОДА</p>
  <nav class="alphaNav" aria-label="Алфавитный указатель">
    <?php foreach(array_keys($grouped) as $letter): ?>
    <a class="alphaBtn" href="#letter-<?=$letter?>"><?=$letter?></a>
    <?php endforeach; ?>
  </nav>

  <?php foreach($grouped as $letter => $lcities): ?>
  <div class="letterGroup" id="letter-<?=$letter?>">
    <div class="letterHeading"><?=$letter?></div>
    <div class="cityLinks">
      <?php foreach($lcities as $city): ?>
      <a class="cityLink" href="/city/<?=h($city['slug'])?>"><?=h($city['name'])?></a>
      <?php endforeach; ?>
    </div>
  </div>
  <?php endforeach; ?>
</main>

<?php render_footer($pdo); ?>
<?php include __DIR__.'/includes/cart.php'; ?>
<script src="/assets/script.js?v=6.2.0"></script>
</body>
</html>
