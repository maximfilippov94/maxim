<?php
require __DIR__.'/includes/db.php';
$pdo = db();

$title = setting('site_title', 'Volga Smoker BBQ');
$desc  = setting('site_description', 'Мясные полуфабрикаты слоу-смок оптом.');
$phone = setting('phone', '+7 000 000-00-00');
$phoneHref = preg_replace('~[^0-9+]~', '', $phone);

$categories = $pdo->query("SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order,id")->fetchAll(PDO::FETCH_ASSOC);
$productsByCat = [];
foreach ($categories as $c) {
    $st = $pdo->prepare("SELECT * FROM products WHERE is_active=1 AND category_id=? ORDER BY sort_order,id");
    $st->execute([$c['id']]);
    $productsByCat[$c['id']] = $st->fetchAll(PDO::FETCH_ASSOC);
}

$gallery = [
    ['assets/images/gallery/grate-raw-ribs.jpg', 'На решётке смокера'],
    ['assets/images/gallery/grate-hand.jpg', 'Контроль готовности'],
    ['assets/images/gallery/seasoning-crop.jpg', 'Сухой посол перед томлением'],
];

$faq   = landing_list('faq_items');
$steps = landing_list('steps_items');
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($title)?></title>
<meta name="description" content="<?=h($desc)?>">
<meta name="robots" content="index, follow">
<meta property="og:title" content="<?=h($title)?>">
<meta property="og:description" content="<?=h($desc)?>">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Volga Smoker BBQ">
<link rel="icon" href="favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css?v=1">
<link rel="stylesheet" href="assets/volga-landing.css?v=3">
<?php include __DIR__.'/includes/metrika.php'; ?>
</head>
<body class="volgaPage">

<header class="vHeader">
  <div class="vHeader__inner">
    <a href="#top" class="vHeader__logo"><img src="assets/images/volga-logo.png" alt="Volga Smoker BBQ"></a>
    <a class="vHeader__phone" href="tel:<?=h($phoneHref)?>"><?=h($phone)?></a>
    <a class="btn btn--accent vHeader__cta" href="#lead-form-1">Оставить заявку</a>
  </div>
</header>

<main id="top">

  <section class="vHero" style="background-image:url('assets/images/hero-ribs-board.jpg')">
    <div class="vHero__overlay" aria-hidden="true"></div>
    <div class="vHero__bull" aria-hidden="true"><img src="assets/images/volga-logo.png" alt=""></div>
    <div class="vHero__inner">
      <p class="vEyebrow"><?=nl2br(h(landing_val('hero_eyebrow')))?></p>
      <h1 class="vHero__title"><?=nl2br(h(landing_val('hero_title')))?></h1>
      <p class="vHero__text"><?=h(landing_val('hero_text'))?></p>
      <div class="vHero__actions">
        <a href="#lead-form-1" class="btn btn--accent">Оставить заявку</a>
        <a href="#products" class="btn btn--ghost">Смотреть продукцию</a>
      </div>
    </div>
  </section>

  <section class="vSection" id="offer">
    <div class="vSection__inner vOffer">
      <div>
        <p class="vEyebrow">О нас</p>
        <h2><?=h(landing_val('offer_title'))?></h2>
      </div>
      <p class="vOffer__text"><?=h(landing_val('offer_text'))?></p>
    </div>
    <div class="vSection__inner vOfferCards">
      <?php $offerIcons=['🥩','🔥','⏱']; foreach (landing_list('offer_cards') as $ci=>$card): ?>
      <div class="vCard">
        <div class="vCard__icon"><?=$offerIcons[$ci] ?? '🔥'?></div>
        <h3><?=h($card[0])?></h3>
        <p><?=h($card[1])?></p>
      </div>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="vSection" id="products">
    <div class="vSection__inner">
      <p class="vEyebrow">Ассортимент</p>
      <h2>Продукция</h2>
    </div>
    <?php foreach ($categories as $cat): if (empty($productsByCat[$cat['id']])) continue; ?>
    <div class="vSection__inner vProductGroup">
      <h3 class="vProductGroup__title">Продукция <span>|</span> <?=h($cat['name'])?></h3>
      <div class="vProducts">
        <?php foreach ($productsByCat[$cat['id']] as $p): ?>
        <div class="vProductCard">
          <div class="vProductCard__media"><img src="<?=h($p['image'])?>" alt="<?=h($p['name'])?>"></div>
          <h3><?=h($p['name'])?></h3>
          <p class="vProductCard__price"><?= (int)$p['price'] > 0 ? h(money($p['price'])).'/кг' : 'Цена по запросу' ?></p>
          <a class="btn btn--accent btn--sm" href="#lead-form-2">Заказать</a>
        </div>
        <?php endforeach; ?>
      </div>
    </div>
    <?php endforeach; ?>
  </section>

  <section class="vSection" id="technology">
    <div class="vSection__inner">
      <p class="vEyebrow">Наш процесс</p>
      <h2>Уникальная технология</h2>
    </div>
    <div class="vSection__inner vGallery">
      <?php foreach ($gallery as $g): ?>
      <div class="vGallery__item"><img src="<?=h($g[0])?>" alt="<?=h($g[1])?>"><span><?=h($g[1])?></span></div>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="vSection" id="advantages">
    <div class="vSection__inner">
      <p class="vEyebrow">Почему мы</p>
      <h2><?=h(landing_val('adv_title'))?></h2>
    </div>
    <div class="vSection__inner vAdvantages">
      <div class="vAdvantages__media" aria-hidden="true" style="background-image:url('assets/images/brisket-slicing.jpg')"></div>
      <ul class="vAdvantages__list">
        <?php foreach (landing_list('adv_items') as $adv): ?>
        <li><h4><?=h($adv[0])?></h4><p><?=h($adv[1])?></p></li>
        <?php endforeach; ?>
      </ul>
    </div>
  </section>

  <section class="vSection vLeadSection" id="lead-form-1">
    <div class="vLeadCard">
      <h2><?=h(landing_val('lead_title'))?></h2>
      <p><?=h(landing_val('lead_text'))?></p>
      <form class="vLeadForm" data-lead-form>
        <input type="text" name="name" placeholder="Ваше имя" required>
        <input type="tel" name="phone" placeholder="Ваш телефон" required>
        <label class="vCheckbox"><input type="checkbox" name="consent" required> Соглашаюсь с политикой обработки персональных данных</label>
        <button type="submit" class="btn btn--accent">Отправить заявку</button>
        <p class="vLeadForm__status" data-lead-status></p>
      </form>
    </div>
  </section>

  <section class="vSection" id="video">
    <div class="vSection__inner">
      <p class="vEyebrow">Наш процесс</p>
      <h2>Как мы готовим</h2>
    </div>
    <div class="vSection__inner">
      <div class="vVideoBlock">
        <span class="vVideoBlock__play" aria-hidden="true">▶</span>
        <span class="vVideoBlock__label">Видео о процессе техасского копчения — добавьте сюда ролик</span>
      </div>
    </div>
  </section>

  <section class="vSection" id="easy">
    <div class="vSection__inner">
      <p class="vEyebrow">Готовый продукт</p>
      <h2><?=h(landing_val('easy_title'))?></h2>
      <p class="vOffer__text"><?=h(landing_val('easy_text'))?></p>
    </div>
    <div class="vSection__inner vGallery vGallery--4">
      <div class="vGallery__item"><img src="assets/images/product-ribs-glazed.jpg" alt="Готовые рёбра слоу-смок"></div>
      <div class="vGallery__item"><img src="assets/images/product-brisket-pack.jpg" alt="Брискет в вакуумной упаковке"></div>
      <div class="vGallery__item"><img src="assets/images/product-pulled-beef-pack.jpg" alt="Рваная говядина в вакуумной упаковке"></div>
      <div class="vGallery__item"><img src="assets/images/brisket-bark.jpg" alt="Брискет слоу-смок"></div>
    </div>
  </section>

  <section class="vSection" id="faq">
    <div class="vSection__inner">
      <h2><?=h(landing_val('faq_title'))?></h2>
    </div>
    <div class="vSection__inner vFaq">
      <?php foreach ($faq as $i => $item): ?>
      <div class="vFaqItem" data-faq-item>
        <button class="vFaqItem__q" type="button" data-faq-toggle>
          <span><?=h($item[0])?></span>
          <span class="vFaqItem__icon" aria-hidden="true">+</span>
        </button>
        <div class="vFaqItem__a"><p><?=h($item[1])?></p></div>
      </div>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="vSection vLeadSection" id="lead-form-2">
    <div class="vLeadCard">
      <h2><?=h(landing_val('lead_title'))?></h2>
      <p><?=h(landing_val('lead_text'))?></p>
      <form class="vLeadForm" data-lead-form>
        <input type="text" name="name" placeholder="Ваше имя" required>
        <input type="tel" name="phone" placeholder="Ваш телефон" required>
        <label class="vCheckbox"><input type="checkbox" name="consent" required> Соглашаюсь с политикой обработки персональных данных</label>
        <button type="submit" class="btn btn--accent">Отправить заявку</button>
        <p class="vLeadForm__status" data-lead-status></p>
      </form>
    </div>
  </section>

  <section class="vSection" id="order">
    <div class="vSection__inner">
      <h2><?=h(landing_val('steps_title'))?></h2>
    </div>
    <div class="vSection__inner vSteps">
      <ol class="vSteps__list">
        <?php $i=1; foreach ($steps as $step): ?>
        <li>
          <span class="vSteps__num"><?=str_pad($i,2,'0',STR_PAD_LEFT)?></span>
          <div><h4><?=h($step[0])?></h4><p><?=h($step[1])?></p></div>
        </li>
        <?php $i++; endforeach; ?>
      </ol>
      <div class="vSteps__media" aria-hidden="true" style="background-image:url('assets/images/brisket-bark.jpg')"></div>
    </div>
  </section>

</main>

<footer class="vFooter">
  <div class="vFooter__inner">
    <div class="vFooter__brand">
      <img src="assets/images/volga-logo.png" alt="Volga Smoker BBQ">
      <p><?=h(landing_val('footer_city'))?></p>
    </div>
    <div class="vFooter__contacts">
      <a href="tel:<?=h($phoneHref)?>"><?=h($phone)?></a>
    </div>
    <a class="btn btn--accent" href="#lead-form-1">Оставить заявку</a>
  </div>
</footer>

<script src="assets/volga-landing.js?v=1"></script>
</body>
</html>
