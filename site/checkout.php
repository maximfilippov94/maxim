<?php
require __DIR__.'/includes/db.php';
require __DIR__.'/includes/nav.php';
$pdo = db();

$title = 'Оформление заказа — LUKA OUTDOOR';

// Город по умолчанию для СДЭК — Москва (270)
// При подключении СДЭК API: https://api.cdek.ru/v2/
// Для начала работы: https://www.cdek.ru/ru/integration/api
$CDEK_CITIES = [
  ['id'=>'44','code'=>'44',  'name'=>'Москва',           'region'=>'Московская область'],
  ['id'=>'2','code'=>'2','name'=>'Санкт-Петербург',  'region'=>'Ленинградская область'],
  ['id'=>'270','code'=>'270','name'=>'Новосибирск',       'region'=>'Новосибирская область'],
  ['id'=>'233','code'=>'233','name'=>'Екатеринбург',      'region'=>'Свердловская область'],
  ['id'=>'239','code'=>'239','name'=>'Казань',            'region'=>'Республика Татарстан'],
  ['id'=>'168','code'=>'168','name'=>'Нижний Новгород',   'region'=>'Нижегородская область'],
  ['id'=>'336','code'=>'336','name'=>'Красноярск',        'region'=>'Красноярский край'],
  ['id'=>'48','code'=>'48','name'=>'Самара',            'region'=>'Самарская область'],
  ['id'=>'431','code'=>'431','name'=>'Тольятти',          'region'=>'Самарская область'],
  ['id'=>'375','code'=>'375','name'=>'Уфа',               'region'=>'Республика Башкортостан'],
  ['id'=>'298','code'=>'298','name'=>'Краснодар',         'region'=>'Краснодарский край'],
  ['id'=>'438','code'=>'438','name'=>'Ростов-на-Дону',    'region'=>'Ростовская область'],
  ['id'=>'321','code'=>'321','name'=>'Пермь',             'region'=>'Пермский край'],
  ['id'=>'192','code'=>'192','name'=>'Воронеж',           'region'=>'Воронежская область'],
  ['id'=>'181','code'=>'181','name'=>'Волгоград',         'region'=>'Волгоградская область'],
  ['id'=>'446','code'=>'446','name'=>'Тюмень',            'region'=>'Тюменская область'],
  ['id'=>'372','code'=>'372','name'=>'Омск',              'region'=>'Омская область'],
  ['id'=>'96','code'=>'96',  'name'=>'Барнаул',           'region'=>'Алтайский край'],
  ['id'=>'196','code'=>'196','name'=>'Иркутск',           'region'=>'Иркутская область'],
  ['id'=>'201','code'=>'201','name'=>'Хабаровск',         'region'=>'Хабаровский край'],
  ['id'=>'207','code'=>'207','name'=>'Владивосток',       'region'=>'Приморский край'],
  ['id'=>'255','code'=>'255','name'=>'Челябинск',         'region'=>'Челябинская область'],
  ['id'=>'352','code'=>'352','name'=>'Новокузнецк',       'region'=>'Кемеровская область'],
  ['id'=>'461','code'=>'461','name'=>'Ярославль',         'region'=>'Ярославская область'],
  ['id'=>'465','code'=>'465','name'=>'Иваново',           'region'=>'Ивановская область'],
  ['id'=>'464','code'=>'464','name'=>'Тверь',             'region'=>'Тверская область'],
  ['id'=>'409','code'=>'409','name'=>'Саратов',           'region'=>'Саратовская область'],
  ['id'=>'438','code'=>'438','name'=>'Томск',             'region'=>'Томская область'],
  ['id'=>'193','code'=>'193','name'=>'Кемерово',          'region'=>'Кемеровская область'],
  ['id'=>'394','code'=>'394','name'=>'Рязань',            'region'=>'Рязанская область'],
  ['id'=>'150','code'=>'150','name'=>'Пенза',             'region'=>'Пензенская область'],
  ['id'=>'448','code'=>'448','name'=>'Ульяновск',         'region'=>'Ульяновская область'],
  ['id'=>'285','code'=>'285','name'=>'Липецк',            'region'=>'Липецкая область'],
  ['id'=>'182','code'=>'182','name'=>'Вологда',           'region'=>'Вологодская область'],
  ['id'=>'420','code'=>'420','name'=>'Смоленск',          'region'=>'Смоленская область'],
  ['id'=>'248','code'=>'248','name'=>'Калуга',            'region'=>'Калужская область'],
  ['id'=>'241','code'=>'241','name'=>'Курск',             'region'=>'Курская область'],
  ['id'=>'455','code'=>'455','name'=>'Чебоксары',         'region'=>'Республика Чувашия'],
  ['id'=>'173','code'=>'173','name'=>'Владимир',          'region'=>'Владимирская область'],
  ['id'=>'408','code'=>'408','name'=>'Саранск',           'region'=>'Республика Мордовия'],
  ['id'=>'343','code'=>'343','name'=>'Нальчик',           'region'=>'Республика Кабардино-Балкария'],
  ['id'=>'177','code'=>'177','name'=>'Волжский',          'region'=>'Волгоградская область'],
  ['id'=>'306','code'=>'306','name'=>'Махачкала',         'region'=>'Республика Дагестан'],
  ['id'=>'399','code'=>'399','name'=>'Сочи',              'region'=>'Краснодарский край'],
  ['id'=>'165','code'=>'165','name'=>'Нижний Тагил',      'region'=>'Свердловская область'],
  ['id'=>'218','code'=>'218','name'=>'Кострома',          'region'=>'Костромская область'],
  ['id'=>'349','code'=>'349','name'=>'Нижневартовск',     'region'=>'Ханты-Мансийский АО'],
  ['id'=>'340','code'=>'340','name'=>'Набережные Челны',  'region'=>'Республика Татарстан'],
];
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="csrf-token" content="<?=csrf_token()?>">
<title><?=h($title)?></title>
<link rel="canonical" href="https://lukaoutdoor.com/checkout.php">
<meta name="robots" content="noindex,nofollow">
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v=5.0.0">
<style>
.checkoutPage{width:min(1100px,calc(100vw - 48px));margin:0 auto;padding:100px 0 80px}
.checkoutGrid{display:grid;grid-template-columns:1fr 400px;gap:40px;align-items:start}
.checkoutLeft h1{font-family:var(--head);font-size:clamp(42px,6vw,72px);text-transform:uppercase;line-height:.9;margin:0 0 32px}
.checkoutSteps{display:flex;gap:8px;margin-bottom:32px;align-items:center;overflow:hidden}
.checkoutStep{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;flex-shrink:0}
.checkoutStep.active{color:var(--copper2)}
.checkoutStep span{width:24px;height:24px;border-radius:50%;border:1px solid rgba(243,241,236,.2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900}
.checkoutStep.active span{background:var(--accent);border-color:var(--accent);color:#0d0704}
.checkoutStep.done span{background:rgba(76,175,80,.2);border-color:#4caf50;color:#4caf50}
.stepDivider{flex:1;height:1px;background:rgba(243,241,236,.1)}

/* Form */
.checkoutSection{background:rgba(255,255,255,.03);border:1px solid rgba(243,241,236,.08);border-radius:20px;padding:24px;margin-bottom:16px}
.checkoutSection h2{font-family:var(--head);font-size:24px;text-transform:uppercase;margin:0 0 20px;color:var(--text)}
.formRow{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.formRow.single{grid-template-columns:1fr}
.checkoutInput{background:rgba(255,255,255,.05);border:1px solid rgba(243,241,236,.12);border-radius:12px;color:var(--text);padding:14px 16px;font:inherit;font-size:15px;outline:none;width:100%;transition:.15s}
.checkoutInput:focus{border-color:rgba(201,121,43,.5)}
.checkoutInput::placeholder{color:rgba(243,241,236,.3)}
.checkoutLabel{display:grid;gap:6px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
select.checkoutInput{cursor:pointer}

/* Delivery options */
.deliveryOptions{display:grid;gap:10px}
.deliveryOption{border:1px solid rgba(243,241,236,.1);border-radius:14px;padding:16px;cursor:pointer;transition:.2s;position:relative}
.deliveryOption:hover{border-color:rgba(201,121,43,.3)}
.deliveryOption.selected{border-color:var(--accent);background:rgba(201,121,43,.06)}
.deliveryOption input[type=radio]{position:absolute;opacity:0;width:0;height:0}
.deliveryOption .optHead{display:flex;align-items:center;gap:12px}
.deliveryOption .optIcon{width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.deliveryOption .optTitle{font-weight:700;font-size:15px}
.deliveryOption .optDesc{font-size:12px;color:var(--muted);margin-top:3px}
.deliveryOption .optPrice{margin-left:auto;font-weight:900;font-size:15px;color:var(--copper2)}
.deliveryOption .optBody{display:none;margin-top:14px;padding-top:14px;border-top:1px solid rgba(243,241,236,.07)}
.deliveryOption.selected .optBody{display:block}

/* Payment options */
.paymentOptions{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.paymentOption{border:1px solid rgba(243,241,236,.1);border-radius:14px;padding:16px;cursor:pointer;transition:.2s;text-align:center;position:relative}
.paymentOption:hover{border-color:rgba(201,121,43,.3)}
.paymentOption.selected{border-color:var(--accent);background:rgba(201,121,43,.06)}
.paymentOption input[type=radio]{position:absolute;opacity:0}
.paymentOption .payIcon{font-size:28px;margin-bottom:8px}
.paymentOption .payTitle{font-weight:700;font-size:13px}
.paymentOption .payDesc{font-size:11px;color:var(--muted);margin-top:4px}
.paymentBadge{display:inline-block;background:rgba(201,121,43,.15);color:var(--copper2);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:900;text-transform:uppercase;margin-top:6px}

/* Order summary */
.orderSummary{background:rgba(255,255,255,.03);border:1px solid rgba(243,241,236,.08);border-radius:20px;padding:24px;position:sticky;top:100px}
.orderSummary h2{font-family:var(--head);font-size:22px;text-transform:uppercase;margin:0 0 20px}
.summaryItems{margin-bottom:20px}
.summaryItem{display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(243,241,236,.06)}
.summaryItem:last-child{border-bottom:none}
.summaryItem img{width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0}
.summaryItem .itemName{font-size:13px;font-weight:600;line-height:1.3;flex:1}
.summaryItem .itemQty{font-size:12px;color:var(--muted)}
.summaryItem .itemPrice{font-size:14px;font-weight:900;white-space:nowrap}
.summaryEmpty{text-align:center;padding:32px 0;color:var(--muted);font-size:14px}
.summaryTotal{padding-top:16px;border-top:1px solid rgba(243,241,236,.1)}
.summaryRow{display:flex;justify-content:space-between;font-size:14px;margin-bottom:10px;color:var(--muted)}
.summaryRow.total{color:var(--text);font-size:18px;font-weight:900;margin-bottom:0}
.summaryRow span:last-child{color:var(--copper2)}
.checkoutBtn{width:100%;background:linear-gradient(180deg,var(--copper2),var(--accent));color:#0d0704;border:none;border-radius:14px;padding:18px;font:900 15px/1 inherit;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;margin-top:16px;transition:.2s}
.checkoutBtn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(201,121,43,.4)}
.checkoutBtn:disabled{opacity:.5;cursor:default;transform:none}
.emptyCartMsg{text-align:center;padding:40px 20px;color:var(--muted)}
.emptyCartMsg a{color:var(--copper2)}

/* CDEK pvz selector */
.cdekMap{background:rgba(255,255,255,.04);border:1px solid rgba(243,241,236,.1);border-radius:12px;padding:14px;margin-top:12px}
.cdekPvzList{max-height:200px;overflow-y:auto;margin-top:10px}
.cdekPvz{padding:10px 12px;border-radius:8px;cursor:pointer;transition:.15s;font-size:13px;border:1px solid transparent}
.cdekPvz:hover{background:rgba(255,255,255,.05)}
.cdekPvz.selected{border-color:rgba(201,121,43,.4);background:rgba(201,121,43,.06)}
.cdekPvz .pvzName{font-weight:700;margin-bottom:2px}
.cdekPvz .pvzAddr{color:var(--muted);font-size:12px}

/* Notice */
.cdekNotice{background:rgba(201,121,43,.08);border:1px solid rgba(201,121,43,.2);border-radius:12px;padding:14px 16px;font-size:13px;color:rgba(243,241,236,.7);line-height:1.6;margin-top:10px}
.cdekNotice strong{color:var(--copper2)}

@media(max-width:900px){
  .checkoutGrid{grid-template-columns:1fr}
  .orderSummary{position:static}
  .formRow{grid-template-columns:1fr}
  .paymentOptions{grid-template-columns:1fr}
}
@media(max-width:480px){
  .checkoutPage{width:calc(100vw - 32px)}
  .paymentOptions{grid-template-columns:1fr}
  .checkoutSteps{gap:4px}
  .checkoutStep{font-size:10px;gap:5px;letter-spacing:.04em}
  .checkoutStep span{width:20px;height:20px;font-size:10px;flex-shrink:0}
  .stepDivider{min-width:8px}
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
   ym(109475188, 'init', {
     clickmap:true, trackLinks:true, accurateTrackBounce:true,
     webvisor:true, ecommerce:"dataLayer"
   });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/109475188" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->
<?php render_topbar($pdo); ?>

<main class="checkoutPage">
  <div class="checkoutSteps">
    <div class="checkoutStep done"><span>✓</span> Корзина</div>
    <div class="stepDivider"></div>
    <div class="checkoutStep active"><span>2</span> Оформление</div>
    <div class="stepDivider"></div>
    <div class="checkoutStep"><span>3</span> Подтверждение</div>
  </div>

  <div class="checkoutGrid">
    <!-- LEFT: FORM -->
    <div class="checkoutLeft">
      <h1>Оформление</h1>

      <!-- 1. Контакты -->
      <div class="checkoutSection">
        <h2>Контакты</h2>
        <div class="formRow">
          <label class="checkoutLabel">Имя *
            <input class="checkoutInput" id="co_name" placeholder="Максим" required>
          </label>
          <label class="checkoutLabel">Телефон *
            <input class="checkoutInput" id="co_phone" placeholder="+7 900 000-00-00" required>
          </label>
        </div>
        <div class="formRow single">
          <label class="checkoutLabel">Email
            <input class="checkoutInput" id="co_email" type="email" placeholder="mail@example.com">
          </label>
        </div>
      </div>

      <!-- 2. Доставка -->
      <div class="checkoutSection">
        <h2>Доставка</h2>
        <div class="deliveryOptions">

          <!-- СДЭК до ПВЗ -->
          <label class="deliveryOption selected" onclick="selectDelivery(this,'cdek_pvz')">
            <input type="radio" name="delivery" value="cdek_pvz" checked>
            <div class="optHead">
              <div class="optIcon">📦</div>
              <div>
                <div class="optTitle">СДЭК — до пункта выдачи</div>
                <div class="optDesc">3–7 дней · по всей России</div>
              </div>
              <div class="optPrice" id="price_cdek_pvz">от 350 ₽</div>
            </div>
            <div class="optBody">
              <label class="checkoutLabel" style="margin-bottom:10px">Ваш город
                <div style="position:relative">
                  <input class="checkoutInput" id="co_city_cdek_input" placeholder="Начните вводить город..." autocomplete="off" oninput="cdekCitySearch(this.value)">
                  <input type="hidden" id="co_city_cdek" value="">
                  <div id="cdekCitySuggest" style="display:none;position:absolute;z-index:99;top:calc(100% + 4px);left:0;right:0;background:#1a1208;border:1px solid rgba(201,121,43,.35);border-radius:10px;overflow:hidden;max-height:240px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.5)"></div>
                </div>
              </label>
              <div class="cdekMap" id="cdekPvzBlock" style="display:none">
                <div style="font-size:13px;font-weight:700;margin-bottom:6px">Выберите пункт выдачи:</div>
                <div class="cdekPvzList" id="cdekPvzList">
                  <div style="color:var(--muted);font-size:13px;padding:8px">Загрузка...</div>
                </div>
              </div>

            </div>
          </label>

          <!-- СДЭК курьером -->
          <label class="deliveryOption" onclick="selectDelivery(this,'cdek_courier')">
            <input type="radio" name="delivery" value="cdek_courier">
            <div class="optHead">
              <div class="optIcon">🚚</div>
              <div>
                <div class="optTitle">СДЭК — курьер до двери</div>
                <div class="optDesc">3–7 дней · адрес доставки</div>
              </div>
              <div class="optPrice" id="price_cdek_courier">от 500 ₽</div>
            </div>
            <div class="optBody">
              <label class="checkoutLabel" style="margin-bottom:10px">Город
                <div style="position:relative">
                  <input class="checkoutInput" id="co_city_courier_input" placeholder="Начните вводить город..." autocomplete="off" oninput="cdekCourierCitySearch(this.value)">
                  <input type="hidden" id="co_city_courier" value="">
                  <div id="cdekCourierSuggest" style="display:none;position:absolute;z-index:99;top:calc(100% + 4px);left:0;right:0;background:#1a1208;border:1px solid rgba(201,121,43,.35);border-radius:10px;overflow:hidden;max-height:240px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.5)"></div>
                </div>
              </label>
              <label class="checkoutLabel">Адрес доставки
                <input class="checkoutInput" id="co_address" placeholder="ул. Ленина, д. 1, кв. 5">
              </label>
            </div>
          </label>

          <!-- Самовывоз -->
          <label class="deliveryOption" onclick="selectDelivery(this,'pickup')">
            <input type="radio" name="delivery" value="pickup">
            <div class="optHead">
              <div class="optIcon">🏭</div>
              <div>
                <div class="optTitle">Самовывоз</div>
                <div class="optDesc">Тольятти · по договорённости</div>
              </div>
              <div class="optPrice" style="color:#4caf50">Бесплатно</div>
            </div>
            <div class="optBody">
              <div style="font-size:13px;color:var(--muted);line-height:1.6">
                Самовывоз из производства в Тольятти. Адрес и время согласуем по телефону после оформления заказа.
              </div>
            </div>
          </label>

        </div>
      </div>

      <!-- 3. Оплата -->
      <div class="checkoutSection">
        <h2>Оплата</h2>
        <div class="paymentOptions">

          <label class="paymentOption selected" onclick="selectPayment(this,'cash_on_delivery')">
            <input type="radio" name="payment" value="cash_on_delivery" checked>
            <div class="payIcon">💵</div>
            <div class="payTitle">При получении</div>
            <div class="payDesc">Наличными или картой курьеру / в ПВЗ</div>
          </label>

          <label class="paymentOption" onclick="selectPayment(this,'card')">
            <input type="radio" name="payment" value="card">
            <div class="payIcon">💳</div>
            <div class="payTitle">Картой онлайн</div>
            <div class="payDesc">Пришлём ссылку для оплаты после оформления</div>
          </label>

          <label class="paymentOption" onclick="selectPayment(this,'invoice')">
            <input type="radio" name="payment" value="invoice">
            <div class="payIcon">🏦</div>
            <div class="payTitle">На расчётный счёт</div>
            <div class="payDesc">Для ИП и юридических лиц · выставим счёт</div>
          </label>

        </div>
        <div id="paymentNotice" style="display:none;margin-top:12px" class="cdekNotice"></div>
      </div>

      <!-- 4. Комментарий -->
      <div class="checkoutSection">
        <h2>Комментарий</h2>
        <textarea class="checkoutInput" id="co_comment" rows="3" placeholder="Пожелания, уточнения по заказу..."></textarea>
      </div>

    </div>

    <!-- RIGHT: SUMMARY -->
    <div>
      <div class="orderSummary">
        <h2>Ваш заказ</h2>
        <div class="summaryItems" id="summaryItems">
          <div class="summaryEmpty">Корзина пустая</div>
        </div>
        <div class="summaryTotal">
          <div class="summaryRow"><span>Товары</span><span id="summarySubtotal">0 ₽</span></div>
          <div class="summaryRow"><span>Доставка</span><span id="summaryDelivery">—</span></div>
          <div class="summaryRow total"><span>Итого</span><span id="summaryTotal">0 ₽</span></div>
        </div>
        <button id="placeOrderBtn" onclick="placeOrder()" style="width:100%;background:linear-gradient(180deg,#e8943a,#c9792b);color:#fff;border:none;border-radius:14px;padding:18px;font:900 16px/1 Manrope,sans-serif;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;margin-top:20px;transition:.2s;display:block">
          Оформить заказ →
        </button>
        <p id="checkoutResult" style="text-align:center;font-size:13px;margin-top:12px;color:var(--copper2)"></p>
        <p style="text-align:center;font-size:11px;color:rgba(243,241,236,.25);margin-top:12px">
          Нажимая «Оформить заказ», вы соглашаетесь с условиями продажи
        </p>
      </div>
    </div>
  </div>
</main>

<?php render_footer($pdo); ?>

<div id="cartToast" class="cartToast">Добавлено в корзину</div>
<script src="/assets/script.js?v=5.0.0"></script>
<script>
// ── Инициализация ──────────────────────────────────────────────────────
let selectedDelivery = 'cdek_pvz';
let selectedPayment  = 'cash_on_delivery';
let selectedPvz      = null;
const fmt2 = n => new Intl.NumberFormat('ru-RU').format(Number(n||0)) + ' ₽';

// Заполняем корзину при загрузке
window.addEventListener('DOMContentLoaded', ()=>{
  // Обновляем счётчик в шапке
  const count = document.getElementById('cartCount');
  if(count){ count.textContent = cart.reduce((s,i)=>s+Number(i.qty||1),0); }
  
  setTimeout(()=>{
    renderSummary();
    if(cart.length===0){
      document.getElementById('summaryItems').innerHTML = '<div class="summaryEmpty">Корзина пустая.<br><a href="/catalog.php">Перейти в каталог →</a></div>';
      document.getElementById('summarySubtotal').textContent = '0 ₽';
      document.getElementById('summaryTotal').textContent = '0 ₽';
    }
  }, 50);
});

function renderSummary(){
  const el = document.getElementById('summaryItems');
  if(!el) return;
  if(cart.length===0){ el.innerHTML='<div class="summaryEmpty">Корзина пустая</div>'; return; }
  let subtotal = 0;
  el.innerHTML = cart.map(i=>{
    const price = Number(i.price||0)*Number(i.qty||1);
    subtotal += price;
    return `<div class="summaryItem">
      <img src="${i.image||'/assets/images/hero.webp'}" loading="lazy">
      <div class="itemName">${i.name}<div class="itemQty">${i.qty} шт.</div></div>
      <div class="itemPrice">${fmt2(price)}</div>
    </div>`;
  }).join('');
  document.getElementById('summarySubtotal').textContent = fmt2(subtotal);
  updateDeliveryPrice();
}

function updateDeliveryPrice(){
  const subtotal = cart.reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||1),0);
  let deliveryCost = 0;
  let deliveryLabel = '—';
  if(selectedDelivery==='cdek_pvz'){ deliveryCost=cdekPvzPrice||350; deliveryLabel=fmt2(deliveryCost); }
  else if(selectedDelivery==='cdek_courier'){ deliveryCost=cdekCourierPrice||500; deliveryLabel=fmt2(deliveryCost); }
  else if(selectedDelivery==='pickup'){ deliveryCost=0; deliveryLabel='Бесплатно'; }
  document.getElementById('summaryDelivery').textContent = deliveryLabel;
  document.getElementById('summaryTotal').textContent = fmt2(subtotal+(deliveryCost||0));
}

// ── Выбор доставки ─────────────────────────────────────────────────────
function selectDelivery(el, value){
  document.querySelectorAll('.deliveryOption').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  selectedDelivery = value;
  updateDeliveryPrice();
}

// ── Выбор оплаты ───────────────────────────────────────────────────────
function selectPayment(el, value){
  document.querySelectorAll('.paymentOption').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  selectedPayment = value;
  const notice = document.getElementById('paymentNotice');
  if(notice){
    if(value==='card'){
      notice.style.display = 'block';
      notice.innerHTML = '<strong>💳 Оплата картой.</strong> После оформления менеджер пришлёт вам защищённую ссылку для онлайн-оплаты картой (Visa, MasterCard, МИР).';
    } else if(value==='invoice'){
      notice.style.display = 'block';
      notice.innerHTML = '<strong>🏦 Счёт на оплату.</strong> Укажите реквизиты в комментарии или менеджер запросит их. Выставим счёт для оплаты по безналу.';
    } else {
      notice.style.display = 'none';
      notice.innerHTML = '';
    }
  }
}

// ── СДЭК: поиск городов ────────────────────────────────────────────────
let cdekSearchTimer = null;
let cdekCourierTimer = null;

function renderCitySuggest(cities, suggestEl, type) {
  if (!cities.length) { suggestEl.style.display = 'none'; return; }
  // Сортируем: крупные города (код < 1000000) вперёд, убираем дубли по name+region
  const sorted = [...cities].sort((a,b) => (a.code < 1000000 ? 0 : 1) - (b.code < 1000000 ? 0 : 1));
  const seen = new Set();
  const unique = sorted.filter(c => {
    const key = (c.name||'').toLowerCase() + '|' + (c.region||'').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
  if (!unique.length) { suggestEl.style.display = 'none'; return; }
  suggestEl.innerHTML = unique.map((c,i) =>
    `<div data-idx="${i}" style="padding:9px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid rgba(243,241,236,.06);display:flex;justify-content:space-between;align-items:center"
      onmouseover="this.style.background='rgba(201,121,43,.12)'" onmouseout="this.style.background=''"
    ><span style="font-weight:500">${c.name}</span><span style="color:rgba(243,241,236,.35);font-size:12px">${c.region||''}</span></div>`
  ).join('');
  suggestEl.querySelectorAll('[data-idx]').forEach((el, i) => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const ci = unique[i];
      const lbl = ci.region && ci.region !== ci.name ? ci.name + ' (' + ci.region + ')' : ci.name;
      cdekSelectCity(ci.code, lbl, type);
    });
  });
  suggestEl.style.display = 'block';
}

function cdekCitySearch(q) {
  clearTimeout(cdekSearchTimer);
  const suggest = document.getElementById('cdekCitySuggest');
  document.getElementById('co_city_cdek').value = '';
  if (q.length < 2) { suggest.style.display = 'none'; return; }
  cdekSearchTimer = setTimeout(async () => {
    try {
      const r = await fetch('/cdek.php?action=cities&q=' + encodeURIComponent(q));
      const cities = await r.json();
      renderCitySuggest(cities, suggest, 'pvz');
    } catch(e) {}
  }, 300);
}

function cdekCourierCitySearch(q) {
  clearTimeout(cdekCourierTimer);
  const suggest = document.getElementById('cdekCourierSuggest');
  document.getElementById('co_city_courier').value = '';
  if (q.length < 2) { suggest.style.display = 'none'; return; }
  cdekCourierTimer = setTimeout(async () => {
    try {
      const r = await fetch('/cdek.php?action=cities&q=' + encodeURIComponent(q));
      const cities = await r.json();
      renderCitySuggest(cities, suggest, 'courier');
    } catch(e) {}
  }, 300);
}

function cdekSelectCity(code, label, type) {
  if (type === 'pvz') {
    document.getElementById('co_city_cdek_input').value = label;
    document.getElementById('co_city_cdek').value = code;
    document.getElementById('cdekCitySuggest').style.display = 'none';
    loadCdekPvz(code);
    loadCdekTariff(code, 'pvz');
  } else {
    document.getElementById('co_city_courier_input').value = label;
    document.getElementById('co_city_courier').value = code;
    document.getElementById('cdekCourierSuggest').style.display = 'none';
    loadCdekTariff(code, 'courier');
  }
}

// ── СДЭК: загрузка ПВЗ ─────────────────────────────────────────────────
let cdekPvzAbort = null;
async function loadCdekPvz(cityCode) {
  if (cdekPvzAbort) cdekPvzAbort.abort();
  cdekPvzAbort = new AbortController();
  const block = document.getElementById('cdekPvzBlock');
  const list  = document.getElementById('cdekPvzList');
  block.style.display = 'block';
  list.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px">Загрузка пунктов выдачи...</div>';
  selectedPvz = null;
  try {
    const r = await fetch('/cdek.php?action=pvz&city_code=' + cityCode, { signal: cdekPvzAbort.signal });
    const pvz = await r.json();
    if (!pvz.length) {
      list.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px">ПВЗ в этом городе не найдены</div>';
      return;
    }
    list.innerHTML = pvz.map(p => `
      <div class="cdekPvz" data-code="${p.code}" data-addr="${p.address}" onclick="selectPvz(this)">
        <div class="pvzName">${p.type} · ${p.name}</div>
        <div class="pvzAddr">${p.address}</div>
        <div class="pvzAddr">${p.work_time}</div>
      </div>`).join('');
  } catch(e) {
    if (e.name !== 'AbortError') list.innerHTML = '<div style="color:#e05;font-size:13px;padding:8px">Ошибка загрузки ПВЗ</div>';
  }
}

// ── СДЭК: расчёт тарифа ────────────────────────────────────────────────
async function loadCdekTariff(cityCode, type) {
  const priceEl = document.getElementById(type === 'pvz' ? 'price_cdek_pvz' : 'price_cdek_courier');
  if (!priceEl) return;
  priceEl.textContent = 'Расчёт...';
  try {
    const r = await fetch(`/cdek.php?action=tariff&city_code=${cityCode}&delivery_type=${type}`);
    const d = await r.json();
    if (d.price) {
      priceEl.textContent = fmt2(d.price) + ' · ' + d.period;
      if (selectedDelivery === (type === 'pvz' ? 'cdek_pvz' : 'cdek_courier')) {
        // Обновляем итог
        if (type === 'pvz') selectedDelivery = 'cdek_pvz';
        updateDeliveryPriceReal(d.price);
      }
    } else {
      priceEl.textContent = type === 'pvz' ? 'от 350 ₽' : 'от 500 ₽';
    }
  } catch(e) {
    priceEl.textContent = type === 'pvz' ? 'от 350 ₽' : 'от 500 ₽';
  }
}

let cdekPvzPrice = 350;
let cdekCourierPrice = 500;

function updateDeliveryPriceReal(price) {
  if (selectedDelivery === 'cdek_pvz') cdekPvzPrice = price;
  if (selectedDelivery === 'cdek_courier') cdekCourierPrice = price;
  updateDeliveryPrice();
}

function selectPvz(el){
  document.querySelectorAll('.cdekPvz').forEach(p=>p.classList.remove('selected'));
  el.classList.add('selected');
  selectedPvz = { code: el.dataset.code, address: el.dataset.addr };
}

// Закрываем подсказки при клике вне
document.addEventListener('click', e => {
  if (!e.target.closest('#co_city_cdek_input') && !e.target.closest('#cdekCitySuggest'))
    document.getElementById('cdekCitySuggest').style.display = 'none';
  if (!e.target.closest('#co_city_courier_input') && !e.target.closest('#cdekCourierSuggest'))
    document.getElementById('cdekCourierSuggest').style.display = 'none';
});

// ── Оформление заказа ──────────────────────────────────────────────────
async function placeOrder(){
  const btn = document.getElementById('placeOrderBtn');
  const result = document.getElementById('checkoutResult');

  if(cart.length===0){ 
    result.textContent='Корзина пустая — добавьте товары'; 
    result.style.color='#e05'; 
    return; 
  }

  const name  = document.getElementById('co_name')?.value.trim() || '';
  const phone = document.getElementById('co_phone')?.value.trim() || '';
  const email = document.getElementById('co_email')?.value.trim() || '';
  const comment = document.getElementById('co_comment')?.value.trim() || '';

  if(!name){ 
    result.textContent='Введите имя'; 
    result.style.color='#e05'; 
    document.getElementById('co_name').focus();
    return; 
  }
  if(!phone){ 
    result.textContent='Введите телефон'; 
    result.style.color='#e05'; 
    document.getElementById('co_phone').focus();
    return; 
  }

  // Формируем адрес/доставку
  let address = '';
  let deliveryLabel = '';
  if(selectedDelivery==='cdek_pvz'){
    const cityInput = document.getElementById('co_city_cdek_input');
    const cityName = cityInput?.value.trim() || '';
    if(!cityName){ result.textContent='Выберите город доставки'; result.style.color='#e05'; cityInput?.focus(); return; }
    deliveryLabel = 'СДЭК до ПВЗ';
    address = cityName + (selectedPvz ? ' · ПВЗ '+selectedPvz.code+': '+selectedPvz.address : '');
  } else if(selectedDelivery==='cdek_courier'){
    const cityInput = document.getElementById('co_city_courier_input');
    const cityName = cityInput?.value.trim() || '';
    const addr = document.getElementById('co_address')?.value.trim() || '';
    if(!cityName){ result.textContent='Выберите город доставки'; result.style.color='#e05'; cityInput?.focus(); return; }
    if(!addr){ result.textContent='Введите адрес доставки'; result.style.color='#e05'; return; }
    deliveryLabel = 'СДЭК курьер';
    address = cityName + ', ' + addr;
  } else if(selectedDelivery==='pickup'){
    deliveryLabel = 'Самовывоз (Тольятти)';
    address = 'Самовывоз';
  }

  const paymentLabels = {
    'cash_on_delivery':'Оплата при получении',
    'card':'Картой онлайн (ссылка)',
    'invoice':'На расчётный счёт'
  };

  btn.disabled = true; btn.textContent = 'Оформляем...';
  result.textContent = ''; result.style.color = 'var(--copper2)';

  // UTM
  const utm = JSON.parse(sessionStorage.getItem('luka_utm')||'{}');
  const fd = new FormData();
  fd.append('customer_name', name);
  fd.append('phone', phone);
  fd.append('email', email);
  fd.append('city', address);
  fd.append('delivery_method', deliveryLabel);
  fd.append('payment_method', paymentLabels[selectedPayment]||selectedPayment);
  fd.append('comment', comment);
  fd.append('cart', JSON.stringify(cart));
  fd.append('source', 'checkout');
  fd.append('csrf_token', document.querySelector('meta[name="csrf-token"]')?.content || '');
  Object.entries(utm).forEach(([k,v])=>fd.append(k,v));
  fd.append('page_referer', document.referrer||'');

  try{
    const r = await fetch('/order.php',{method:'POST',body:fd});
    const d = await r.json();
    if(d.ok){
      // Очищаем корзину
      localStorage.removeItem('luka_cart');
      location.href = '/thanks.php';
    } else {
      result.textContent = d.message || 'Ошибка';
      result.style.color = '#e05';
      btn.disabled=false; btn.textContent='Оформить заказ';
    }
  }catch(e){
    result.textContent='Ошибка отправки';
    result.style.color='#e05';
    btn.disabled=false; btn.textContent='Оформить заказ';
  }
}
</script>
</body>
</html>
