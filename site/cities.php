<?php
require __DIR__.'/includes/db.php';
require __DIR__.'/includes/nav.php';
$pdo = db();

// Список городов — берём из нашего массива
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
      <b style="color:var(--text)">Города доставки</b>
    </nav>

    <div style="margin-bottom:32px;padding-bottom:28px;border-bottom:1px solid rgba(243,241,236,.08)">
      <p class="eyebrow">ДОСТАВКА</p>
      <h1 style="font-family:var(--head);font-size:clamp(36px,4vw,64px);text-transform:uppercase;line-height:.9;margin:0 0 12px">Города доставки</h1>
      <p style="font-size:15px;color:var(--muted);max-width:480px;line-height:1.5">Доставляем через СДЭК по всей России. Выберите ваш город.</p>
    </div>

    <?php
    // Группируем по первой букве
    $grouped = [];
    foreach($cities_data as $city){
        $letter = mb_strtoupper(mb_substr($city['name'], 0, 1));
        $grouped[$letter][] = $city;
    }
    ksort($grouped);

    // Популярные города — выносим отдельно
    $popular = ['Москва','Санкт-Петербург','Екатеринбург','Новосибирск','Казань','Краснодар','Нижний Новгород','Самара','Ростов-на-Дону','Уфа','Челябинск','Тюмень'];
    $popularCities = array_filter($cities_data, fn($c) => in_array($c['name'], $popular));
    ?>

    <!-- Популярные -->
    <div style="margin-bottom:28px">
      <p class="eyebrow" style="margin-bottom:10px">ПОПУЛЯРНЫЕ</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <?php foreach($popularCities as $city): ?>
        <a href="/city/<?=h($city['slug'])?>" style="border:1px solid rgba(201,121,43,.3);border-radius:999px;padding:7px 16px;font-size:13px;font-weight:600;color:var(--copper2);text-decoration:none;background:rgba(201,121,43,.06);transition:.2s" onmouseover="this.style.background='rgba(201,121,43,.14)'" onmouseout="this.style.background='rgba(201,121,43,.06)'"><?=h($city['name'])?></a>
        <?php endforeach; ?>
      </div>
    </div>

    <!-- Все города по алфавиту -->
    <div style="margin-bottom:24px">
      <p class="eyebrow" style="margin-bottom:10px">ВСЕ ГОРОДА</p>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:20px">
        <?php foreach(array_keys($grouped) as $letter): ?>
        <a href="#letter-<?=$letter?>" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(243,241,236,.12);border-radius:6px;font-size:13px;font-weight:700;color:var(--muted);text-decoration:none;transition:.2s" onmouseover="this.style.color='var(--copper2)';this.style.borderColor='rgba(201,121,43,.4)'" onmouseout="this.style.color='var(--muted)';this.style.borderColor='rgba(243,241,236,.12)'"><?=$letter?></a>
        <?php endforeach; ?>
      </div>

      <?php foreach($grouped as $letter => $lcities): ?>
      <div id="letter-<?=$letter?>" style="margin-bottom:20px">
        <div style="font-family:var(--head);font-size:28px;color:var(--copper2);margin-bottom:8px;line-height:1"><?=$letter?></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px">
          <?php foreach($lcities as $city): ?>
          <a href="/city/<?=h($city['slug'])?>" style="padding:8px 12px;border:1px solid rgba(243,241,236,.07);border-radius:10px;font-size:13px;color:var(--text);text-decoration:none;transition:.2s;background:rgba(255,255,255,.02)" onmouseover="this.style.borderColor='rgba(201,121,43,.3)';this.style.color='var(--copper2)'" onmouseout="this.style.borderColor='rgba(243,241,236,.07)';this.style.color='var(--text)'"><?=h($city['name'])?></a>
          <?php endforeach; ?>
        </div>
      </div>
      <?php endforeach; ?>
    </div>

  </div>
</main>

<?php render_footer($pdo); ?>
<?php include __DIR__.'/includes/cart.php'; ?>
<script src="/assets/script.js?v=5.0.0"></script>
</body>
</html>
