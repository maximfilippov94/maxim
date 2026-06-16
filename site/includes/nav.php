<?php
// Глобальная навигация — подключается на всех страницах
// Данные берутся из БД, редактируются через Админка → Навигация
function get_nav_items($pdo) {
    static $items = null;
    if($items !== null) return $items;
    try {
        $items = $pdo->query("SELECT * FROM nav_items WHERE is_active=1 ORDER BY sort_order,id")->fetchAll(PDO::FETCH_ASSOC);
    } catch(Exception $e) {
        // Fallback если таблица ещё не создана
        $items = [
            ['label'=>'Каталог','url'=>'/catalog.php','open_new_tab'=>0],
            ['label'=>'Коллекция','url'=>'/#catalog','open_new_tab'=>0],
            ['label'=>'Ритуал','url'=>'/#ritual','open_new_tab'=>0],
            ['label'=>'Производство','url'=>'/#craft','open_new_tab'=>0],
            ['label'=>'Journal','url'=>'/#journal','open_new_tab'=>0],
            ['label'=>'Контакт','url'=>'/#lead','open_new_tab'=>0],
        ];
    }
    return $items;
}

function render_topbar($pdo, $logoHref = '/') {
    $items = get_nav_items($pdo);
    // ── Яндекс.Метрика ──────────────────────────────────────────────
    static $ym_rendered = false;
    if (!$ym_rendered) {
        $ym_rendered = true;
        ?>
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
<?php
    }
    $ig_raw = setting('instagram');
    $tg_raw = setting('telegram');
    $yt_raw = setting('youtube');
    // Умное формирование ссылок
    $ig = $ig_raw ? (str_starts_with($ig_raw,'http') ? $ig_raw : 'https://instagram.com/'.ltrim($ig_raw,'@')) : '#';
    $tg = $tg_raw ? (str_starts_with($tg_raw,'http') ? $tg_raw : 'https://t.me/'.ltrim($tg_raw,'@')) : '#';
    $yt = $yt_raw ? (str_starts_with($yt_raw,'http') ? $yt_raw : 'https://youtube.com/'.ltrim($yt_raw,'@')) : '#';
    $phone = setting('phone');
    $logo_raw = setting('logo_path') ?: 'assets/images/logo_luka_new.png';
    $logo = str_starts_with($logo_raw, '/') ? $logo_raw : '/' . $logo_raw;
    ?>
<?php
// Загружаем категории для мегаменю
$mega_cats = [];
try {
    $all_cats = $pdo->query("SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order,id")->fetchAll(PDO::FETCH_ASSOC);
    foreach($all_cats as $mc) {
        if(empty($mc['parent_id'])) {
            $mc['children'] = [];
            $mega_cats[$mc['id']] = $mc;
        }
    }
    foreach($all_cats as $mc) {
        if(!empty($mc['parent_id']) && isset($mega_cats[$mc['parent_id']])) {
            $mega_cats[$mc['parent_id']]['children'][] = $mc;
        }
    }
    $mega_cats = array_values($mega_cats);
} catch(Exception $e) { $mega_cats = []; }
?>
<style>
.megaNav{position:relative}
.megaNav>.megaDrop{opacity:0;pointer-events:none;transform:translateY(-6px);transition:opacity .2s,transform .2s}
.megaNav:hover>.megaDrop{opacity:1;pointer-events:auto;transform:translateY(0)}
.megaNav:hover>a svg{transform:rotate(180deg);opacity:1}
.megaNav:hover>.megaDrop{opacity:1;pointer-events:auto;transform:translateY(0)}
.megaDrop{position:absolute;top:calc(100% + 12px);left:0;transform:translateY(-6px);z-index:200;min-width:560px;padding-top:8px}
/* Невидимый мост между ссылкой и дропом чтобы курсор не терялся */
.megaDrop::before{content:"";position:absolute;top:-12px;left:0;right:0;height:12px}
.megaDropInner{background:#0a0a0a;border:1px solid rgba(243,241,236,.1);border-radius:20px;padding:20px;display:flex;gap:0;box-shadow:0 24px 60px rgba(0,0,0,.7)}
.megaLeft{width:200px;flex-shrink:0;border-right:1px solid rgba(243,241,236,.07);padding-right:16px;display:flex;flex-direction:column;gap:2px}
.megaRight{flex:1;padding-left:16px;min-height:200px}
.megaLeftItem{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:10px;cursor:pointer;text-decoration:none;transition:.15s;font-size:13px;font-weight:700;color:rgba(243,241,236,.6);text-transform:uppercase;letter-spacing:.06em}
.megaLeftItem:hover,.megaLeftItem.active{background:rgba(201,121,43,.1);color:var(--copper2)}
.megaLeftItem .arrow{font-size:10px;opacity:.4}
.megaLeftItem:hover .arrow,.megaLeftItem.active .arrow{opacity:1;color:var(--accent)}
.megaRightPanel{display:none;flex-direction:column;gap:4px}
.megaRightPanel.active{display:flex}
.megaRightTitle{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:rgba(243,241,236,.3);margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(243,241,236,.06)}
.megaSub{display:block;padding:8px 12px;border-radius:8px;font-size:13px;color:rgba(243,241,236,.6);text-decoration:none;transition:.15s}
.megaSub:hover{background:rgba(201,121,43,.08);color:var(--text)}
.megaSubAll{font-weight:700;color:var(--accent)!important;margin-bottom:4px}
.megaFooterRow{border-top:1px solid rgba(243,241,236,.07);padding-top:14px;margin-top:14px;display:flex;justify-content:space-between;align-items:center;width:100%}
.megaFooterRow a{font-size:11px;font-weight:700;color:var(--accent);text-decoration:none;letter-spacing:.08em;text-transform:uppercase}
.megaCount{font-size:11px;color:rgba(243,241,236,.3);text-transform:uppercase;letter-spacing:.1em}
/* Mobile menu */
.mobileMenuLinks{overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;padding:8px 0;flex:1}
.mobileMenuInner{position:relative;z-index:1;display:flex;flex-direction:column;height:100%;height:100dvh;padding:0 28px 28px;justify-content:space-between}
/* All nav links — большой размер */
.mobileNavLink,
.mobileMenuLinks a.mobileNavLink{
  font-family:"Bebas Neue",Impact,Arial,sans-serif!important;
  font-size:clamp(38px,11vw,56px)!important;
  line-height:1!important;
  text-transform:uppercase!important;
  color:#e89a42!important;
  padding:10px 0!important;
  border-bottom:1px solid rgba(243,241,236,.07)!important;
  text-decoration:none!important;
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  transition:.2s!important;
  letter-spacing:.015em!important;
  font-weight:400!important;
}
.mobileNavLink:active{opacity:.7!important}
/* Accordion wrapper */
.mobileAccordion{border-bottom:1px solid rgba(243,241,236,.07)}
.mobileAccordionHead{
  font-family:"Bebas Neue",Impact,Arial,sans-serif!important;
  font-size:clamp(38px,11vw,56px)!important;
  line-height:1!important;
  text-transform:uppercase!important;
  color:#f3f1ec;
  padding:10px 0;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  transition:.2s;
  letter-spacing:.015em;
}
.mobileAccordionHead:hover{color:#e89a42}
.mobileAccordion.open .mobileAccordionHead{color:#e89a42}
.mobileAccordionChevron{width:38px;height:38px;border-radius:50%;border:1px solid rgba(243,241,236,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.35s;background:rgba(255,255,255,.04)}
.mobileAccordion.open .mobileAccordionChevron{background:rgba(201,121,43,.15);border-color:#c9792b;transform:rotate(180deg)}
.mobileAccordionBody{max-height:0;overflow:hidden;transition:max-height .4s cubic-bezier(.4,0,.2,1)}
.mobileAccordion.open .mobileAccordionBody{max-height:900px}
/* Categories */
.mobileCatList{padding:4px 0 14px;display:flex;flex-direction:column}
.mobileCatRow{border-bottom:1px solid rgba(243,241,236,.05);padding:0 2px}
.mobileCatRow:last-child{border-bottom:none}
.mobileCatHead{display:flex;align-items:center}
.mobileCatLink{flex:1;font-family:Manrope,sans-serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:rgba(243,241,236,.7);padding:11px 0;text-decoration:none;transition:.15s}
.mobileCatLink:active{color:var(--copper2)}
.mobileCatBtn{width:36px;height:36px;border:1px solid rgba(243,241,236,.1);background:rgba(255,255,255,.04);color:rgba(243,241,236,.35);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.25s;flex-shrink:0;border-radius:8px}
.mobileCatBtn.open{color:var(--copper2);background:rgba(201,121,43,.1);border-color:rgba(201,121,43,.25)}
.mobileCatBtn svg{transition:transform .25s}
.mobileCatBtn.open svg{transform:rotate(180deg)}
/* Подкатегории */
.mobileCatSubs{max-height:0;overflow:hidden;transition:max-height .3s cubic-bezier(.4,0,.2,1);border-left:2px solid rgba(201,121,43,.25);margin-left:4px}
.mobileCatSubs.open{max-height:400px}
.mobileCatSub{display:block;font-family:Manrope,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(243,241,236,.4);padding:9px 0 9px 14px;text-decoration:none;transition:.15s;border-bottom:1px solid rgba(243,241,236,.04)}
.mobileCatSub:last-child{border-bottom:none}
.mobileCatSub:active,.mobileCatSub:hover{color:var(--copper2)}
/* Hamburger button */
.menuBtn{display:none;flex-direction:column;justify-content:center;align-items:center;gap:5px;width:44px;height:44px;border:1px solid rgba(255,255,255,.14)!important;border-radius:12px!important;background:rgba(255,255,255,.07)!important;padding:0!important;cursor:pointer}
.menuBtn span{display:block;width:18px;height:1.5px;background:rgba(243,241,236,.85);transition:.25s;border-radius:2px}
@media(max-width:980px){.menuBtn{display:flex}}
</style>
<header class="topbar">
  <a class="brand logoOnly" href="<?=h($logoHref)?>"><img src="<?=h($logo)?>" alt="LUKA OUTDOOR"></a>
  <nav>
    <?php foreach($items as $item):
      $isCatalog = (stripos($item['label'], 'каталог') !== false || $item['url'] === '/catalog.php');
    ?>
    <?php if($isCatalog && !empty($mega_cats)): ?>
    <div class="megaNav">
      <a href="<?=h($item['url'])?>" style="display:inline-flex;align-items:center;gap:5px"><?=h($item['label'])?> <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="opacity:.6;transition:.2s;flex-shrink:0"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
      <div class="megaDrop">
        <div class="megaDropInner">
          <div class="megaLeft">
            <?php foreach($mega_cats as $mi=>$mc): ?>
            <a class="megaLeftItem <?=$mi===0?'active':''?>"
               href="/catalog.php?cat=<?=h($mc['slug'])?>"
               data-mega="<?=$mc['id']?>"
               onmouseenter="megaHover(<?=$mc['id']?>)">
              <?=h($mc['name'])?> <span class="arrow">›</span>
            </a>
            <?php endforeach; ?>

          </div>
          <div class="megaRight">
            <?php foreach($mega_cats as $mi=>$mc): ?>
            <div class="megaRightPanel <?=$mi===0?'active':''?>" id="mega-panel-<?=$mc['id']?>">
              <div class="megaRightTitle"><?=h($mc['name'])?></div>
              <?php foreach($mc['children'] as $sub): ?>
              <a class="megaSub" href="/catalog.php?cat=<?=h($sub['slug'])?>"><?=h($sub['name'])?></a>
              <?php endforeach; ?>
              <?php if(empty($mc['children'])): ?>
              <div style="color:rgba(243,241,236,.25);font-size:12px;padding:12px">Подкатегории появятся здесь</div>
              <?php endif; ?>
            </div>
            <?php endforeach; ?>
          </div>
        </div>
      </div>
    </div>
    <?php else: ?>
    <a href="<?=h($item['url'])?>"<?=$item['open_new_tab'] ? ' target="_blank" rel="noopener"' : ''?>><?=h($item['label'])?></a>
    <?php endif; ?>
    <?php endforeach; ?>
  </nav>
  <button class="menuBtn" onclick="openMenu()" aria-label="Меню"><span></span><span></span><span></span></button>
  <button class="cartBtn" onclick="openCart()">Корзина <b id="cartCount">0</b></button>
</header>

<script>
function megaHover(id){
  document.querySelectorAll('.megaLeftItem').forEach(el=>el.classList.toggle('active',el.dataset.mega==id));
  document.querySelectorAll('.megaRightPanel').forEach(el=>el.classList.toggle('active',el.id==='mega-panel-'+id));
}
function toggleMobileAccordion(head){
  const acc = head.closest('.mobileAccordion');
  acc.classList.toggle('open');
}
function toggleMobileSubs(btn){
  const row = btn.closest('.mobileCatRow');
  const subs = row.querySelector('.mobileCatSubs');
  const isOpen = subs.classList.contains('open');
  document.querySelectorAll('.mobileCatSubs.open').forEach(s=>s.classList.remove('open'));
  document.querySelectorAll('.mobileCatBtn.open').forEach(b=>b.classList.remove('open'));
  if(!isOpen){ subs.classList.add('open'); btn.classList.add('open'); }
}
</script>
<div id="mobileMenuShade" class="mobileMenuShade" onclick="closeMenu()"></div>
<div id="mobileMenu" class="mobileMenu" role="dialog" aria-modal="true" aria-label="Навигация">
  <div class="mobileMenuInner">
    <div class="mobileMenuTop">
      <div class="menuLogo"><img src="<?=h($logo)?>" alt="LUKA OUTDOOR" class="menuLogoImg"></div>
      <button class="mobileMenuClose" onclick="closeMenu()" aria-label="Закрыть меню">&#x2715;</button>
    </div>

    <nav class="mobileMenuLinks">
      <?php foreach($items as $item):
        $isCatalogMob = stripos($item['label'], 'каталог') !== false || $item['url'] === '/catalog.php';
      ?>
      <?php if($isCatalogMob && !empty($mega_cats)): ?>
      <div class="mobileAccordion">
        <div class="mobileAccordionHead" onclick="toggleMobileAccordion(this)">
          <?=h($item['label'])?>
          <div class="mobileAccordionChevron">
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>
        <div class="mobileAccordionBody">
          <div class="mobileCatList">
          <?php foreach($mega_cats as $mc): ?>
          <div class="mobileCatRow">
            <div class="mobileCatHead">
              <a class="mobileCatLink" href="/catalog.php?cat=<?=h($mc['slug'])?>" onclick="closeMenu()"><?=h($mc['name'])?></a>
              <?php if(!empty($mc['children'])): ?>
              <button class="mobileCatBtn" onclick="toggleMobileSubs(this)" aria-label="Подкатегории">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <?php endif; ?>
            </div>
            <?php if(!empty($mc['children'])): ?>
            <div class="mobileCatSubs">
              <?php foreach($mc['children'] as $sub): ?>
              <a class="mobileCatSub" href="/catalog.php?cat=<?=h($sub['slug'])?>" onclick="closeMenu()"><?=h($sub['name'])?></a>
              <?php endforeach; ?>
            </div>
            <?php endif; ?>
          </div>
          <?php endforeach; ?>
          </div>
        </div>
      </div>
      <?php else: ?>
      <a class="mobileNavLink" onclick="closeMenu()" href="<?=h($item['url'])?>"<?=$item['open_new_tab'] ? ' target="_blank" rel="noopener"' : ''?>><?=h($item['label'])?></a>
      <?php endif; ?>
      <?php endforeach; ?>
    </nav>

    <div class="mobileMenuFooter">
      <?php if($phone): ?>
      <a href="tel:<?=h(preg_replace('/[^0-9+]/','',$phone))?>" class="mobileMenuPhone"><?=h($phone)?></a>
      <?php endif; ?>
      <div class="mobileMenuFooterBottom">
        <span>LUKA OUTDOOR</span>
        <div class="mobileMenuSocials">
          <?php if($ig_raw): ?><a href="<?=h($ig)?>" target="_blank" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></a><?php endif; ?>
          <?php if($tg_raw): ?><a href="<?=h($tg)?>" target="_blank" aria-label="Telegram"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a><?php endif; ?>
          <?php if($yt_raw): ?><a href="<?=h($yt)?>" target="_blank" aria-label="YouTube"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.499 6.203a3.008 3.008 0 0 0-2.089-2.089c-1.87-.501-9.4-.501-9.4-.501s-7.509-.01-9.399.501A3.008 3.008 0 0 0 .522 6.203a31.503 31.503 0 0 0-.522 5.8 31.503 31.503 0 0 0 .522 5.783 3.008 3.008 0 0 0 2.089 2.088c1.868.502 9.4.502 9.4.502s7.509 0 9.399-.502a3.008 3.008 0 0 0 2.089-2.088 31.516 31.516 0 0 0 .5-5.783 31.516 31.516 0 0 0-.5-5.8zM9.609 15.601V8.408l6.264 3.602z"/></svg></a><?php endif; ?>
        </div>
      </div>
    </div>
  </div>
</div>
<?php
}


function render_footer($pdo, $logoPath = null) {
    $items = get_nav_items($pdo);
    $logo_raw  = $logoPath ?: (setting('logo_path') ?: 'assets/images/logo_luka_new.png');
    $logo = str_starts_with($logo_raw, '/') ? $logo_raw : '/' . $logo_raw;
    $phone = setting('phone');
    $ig_raw = setting('instagram');
    $tg_raw = setting('telegram');
    $yt_raw = setting('youtube');
    $ig = $ig_raw ? (str_starts_with($ig_raw,'http') ? $ig_raw : 'https://instagram.com/'.ltrim($ig_raw,'@')) : '';
    $tg = $tg_raw ? (str_starts_with($tg_raw,'http') ? $tg_raw : 'https://t.me/'.ltrim($tg_raw,'@')) : '';
    $yt = $yt_raw ? (str_starts_with($yt_raw,'http') ? $yt_raw : 'https://youtube.com/'.ltrim($yt_raw,'@')) : '';
    ?>
<footer class="footer">
  <div class="footerBrand">
    <img src="<?=h($logo)?>" alt="LUKA OUTDOOR" class="footerLogo">
    <p>LIVE OUTSIDE. EXPLORE MORE.</p>
    <?php if($phone): ?><a href="tel:<?=h(preg_replace('/[^0-9+]/','',$phone))?>" class="footerPhone"><?=h($phone)?></a><?php endif; ?>
    <div class="footerSocials">
      <?php if($ig): ?><a href="<?=h($ig)?>" target="_blank" aria-label="Instagram" class="footerSocialLink"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></a><?php endif; ?>
      <?php if($tg): ?><a href="<?=h($tg)?>" target="_blank" aria-label="Telegram" class="footerSocialLink"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a><?php endif; ?>
      <?php if($yt): ?><a href="<?=h($yt)?>" target="_blank" aria-label="YouTube" class="footerSocialLink"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.499 6.203a3.008 3.008 0 0 0-2.089-2.089c-1.87-.501-9.4-.501-9.4-.501s-7.509-.01-9.399.501A3.008 3.008 0 0 0 .522 6.203a31.503 31.503 0 0 0-.522 5.8 31.503 31.503 0 0 0 .522 5.783 3.008 3.008 0 0 0 2.089 2.088c1.868.502 9.4.502 9.4.502s7.509 0 9.399-.502a3.008 3.008 0 0 0 2.089-2.088 31.516 31.516 0 0 0 .5-5.783 31.516 31.516 0 0 0-.5-5.8zM9.609 15.601V8.408l6.264 3.602z"/></svg></a><?php endif; ?>
    </div>
  </div>
  <nav>
    <?php foreach($items as $item): ?>
    <a href="<?=h($item['url'])?>"<?=$item['open_new_tab'] ? ' target="_blank" rel="noopener"' : ''?>><?=h($item['label'])?></a>
    <?php endforeach; ?>
  </nav>
</footer>
<?php
}
