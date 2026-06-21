<?php
/**
 * admin/crm.php — LUKA OUTDOOR — Standalone CRM (orders & customers)
 */
require __DIR__.'/../includes/db.php'; require __DIR__.'/../includes/auth.php';
$pdo=db();
// миграция полей СДЭК / источника
foreach(['cdek_order_uuid TEXT DEFAULT ""','cdek_track TEXT DEFAULT ""','cdek_status TEXT DEFAULT ""','cdek_pvz_code TEXT DEFAULT ""','delivery_cost INTEGER DEFAULT 0','cdek_raw TEXT DEFAULT ""','manager_note TEXT DEFAULT ""','source TEXT DEFAULT "site"','email TEXT DEFAULT ""','ym_uid TEXT DEFAULT ""','display_id INTEGER DEFAULT 0'] as $col_def){
  try{$pdo->exec("ALTER TABLE orders ADD COLUMN $col_def");}catch(Exception $e){}
}
// Заполняем display_id для старых заказов у которых он не задан
$pdo->exec("UPDATE orders SET display_id = id + 6470 WHERE display_id = 0 OR display_id IS NULL");

if(!is_admin()){ header('Location:/admin'); exit; }

// ── POST HANDLERS (order CRUD; CDEK lives in cdek_order.php) ─────────────
if($_SERVER['REQUEST_METHOD']==='POST'){
  header('Content-Type: application/json; charset=utf-8');
  $a=$_POST['action']??'';
  if($a==='update_order'){
    $orderId=(int)$_POST['id'];
    $newStatus=trim($_POST['status']??'new');
    $note=trim($_POST['manager_note']??'');
    $oldRow=$pdo->prepare('SELECT status,total,ym_uid FROM orders WHERE id=?');
    $oldRow->execute([$orderId]); $oldOrder=$oldRow->fetch(PDO::FETCH_ASSOC);
    $pdo->prepare('UPDATE orders SET status=?,manager_note=? WHERE id=?')->execute([$newStatus,$note,$orderId]);
    // офлайн-конверсия в Яндекс.Метрику при переводе в "Готово"
    if($newStatus==='done' && ($oldOrder['status']??'')!=='done' && !empty($oldOrder['ym_uid'])){
      try{
        $ymData=['id'=>'luka-order-'.$orderId,'date_time'=>date('Y-m-d\TH:i:s'),'client_id'=>$oldOrder['ym_uid'],'target'=>'purchase','price'=>(float)($oldOrder['total']??0),'currency'=>'RUB'];
        $ch=curl_init('https://api-metrika.yandex.net/management/v1/counter/109475188/offline_conversions/upload');
        curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode(['conversions'=>[$ymData]]),CURLOPT_HTTPHEADER=>['Authorization: OAuth y0__wgBEKW57BcYz9BCILD7uNkXkiUmFv4ceEovyav43JHemXdvGIQ','Content-Type: application/json'],CURLOPT_TIMEOUT=>5,CURLOPT_SSL_VERIFYPEER=>false]);
        curl_exec($ch); curl_close($ch);
      }catch(Exception $e){}
    }
    echo json_encode(['ok'=>true]); exit;
  }
  if($a==='delete_order'){ $pdo->prepare('DELETE FROM orders WHERE id=?')->execute([(int)$_POST['id']]); echo json_encode(['ok'=>true]); exit; }
  if($a==='pending_orders'){
    $lastId=(int)($_POST['last_id']??0);
    $st=$pdo->prepare("SELECT o.*, GROUP_CONCAT(i.product_name||' x'||i.qty,', ') as items_str, COUNT(i.id) items_count FROM orders o LEFT JOIN order_items i ON i.order_id=o.id WHERE o.id>? GROUP BY o.id ORDER BY o.id DESC LIMIT 20");
    $st->execute([$lastId]);
    echo json_encode(['orders'=>$st->fetchAll(PDO::FETCH_ASSOC)]); exit;
  }
  echo json_encode(['ok'=>false,'error'=>'unknown: '.$a]); exit;
}

// ── CSV export ──────────────────────────────────────────────────────────
if(isset($_GET['export']) && $_GET['export']==='orders'){
  header('Content-Type:text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="luka-orders.csv"');
  $out=fopen('php://output','w'); fwrite($out,"\xEF\xBB\xBF");
  fputcsv($out,['id','date','status','name','phone','city','total','comment','items','manager_note'],';');
  $orders=$pdo->query("SELECT * FROM orders ORDER BY id DESC")->fetchAll(PDO::FETCH_ASSOC);
  foreach($orders as $o){$it=$pdo->prepare('SELECT product_name,price,qty FROM order_items WHERE order_id=?');$it->execute([$o['id']]);$items=[];foreach($it->fetchAll(PDO::FETCH_ASSOC) as $i){$items[]=$i['product_name'].' x'.$i['qty'].' '.money($i['price']);}fputcsv($out,[$o['id'],$o['created_at'],$o['status'],$o['customer_name'],$o['phone'],$o['address'],$o['total'],$o['comment'],implode(' | ',$items),$o['manager_note']],';');}
  exit;
}

// ── DATA ────────────────────────────────────────────────────────────────
$orders=$pdo->query('SELECT * FROM orders ORDER BY id DESC')->fetchAll(PDO::FETCH_ASSOC);
$itemsCount=[]; $itemsPreview=[];
$icSt=$pdo->query("SELECT order_id, COUNT(*) c, GROUP_CONCAT(product_name||' ×'||qty,', ') prev FROM order_items GROUP BY order_id");
foreach($icSt->fetchAll(PDO::FETCH_ASSOC) as $r){ $itemsCount[$r['order_id']]=(int)$r['c']; $itemsPreview[$r['order_id']]=$r['prev']; }

$STATUSES=['new'=>['Новые','new'],'processing'=>['В работе','processing'],'done'=>['Выполнено','done'],'cancelled'=>['Отменено','cancelled']];
$byStatus=['new'=>[],'processing'=>[],'done'=>[],'cancelled'=>[]];
foreach($orders as $o){ $s=$o['status']??'new'; if(!isset($byStatus[$s])) $s='new'; $byStatus[$s][]=$o; }

$today=date('Y-m-d');
$weekAgo=date('Y-m-d',strtotime('-7 days'));
$todayCount=0; $weekRevenue=0;
foreach($orders as $o){
  $d=substr($o['created_at']??'',0,10);
  if($d===$today) $todayCount++;
  if($d>=$weekAgo && $o['status']!=='cancelled') $weekRevenue+=(int)$o['total'];
}
$totalOrders=count($orders);

function time_ago_crm($dt){
  if(!$dt) return '';
  $diff=time()-strtotime($dt);
  if($diff<60) return 'только что';
  if($diff<3600) return floor($diff/60).' мин назад';
  if($diff<86400) return floor($diff/3600).' ч назад';
  if($diff<2592000) return floor($diff/86400).' дн назад';
  return date('d.m.Y',strtotime($dt));
}
function ord_city($o){
  $a=$o['address']??'';
  if(!$a) return '—';
  $parts=preg_split('/[·,]/u',$a);
  return trim($parts[0]??$a);
}
function search_blob($o,$prev){ return mb_strtolower(($o['customer_name']??'').' '.($o['phone']??'').' '.($prev??'').' '.($o['address']??'')); }
?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LUKA / CRM</title>
<link rel="stylesheet" href="admin.css">
</head>
<body>
<div class="adminWrap">

<!-- SIDEBAR -->
<div class="sidebarBackdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>
<aside class="sidebar" id="sidebar">
  <div class="sidebarLogo"><div class="sidebarLogoMark">L</div><span>LUKA<br>OUTDOOR<br>CRM</span></div>
  <nav class="sidebarNav">
    <a class="active"><svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Заказы<?php if(count($byStatus['new'])):?><span class="sideBadge"><?=count($byStatus['new'])?></span><?php endif;?></a>
    <a href="/admin/index.php"><svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> CMS / Контент</a>
  </nav>
  <div class="sidebarBottom">
    <a href="?export=orders"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Экспорт CSV</a>
    <a href="/" target="_blank"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> На сайт</a>
    <a href="logout.php"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg> Выйти</a>
  </div>
</aside>

<!-- MAIN -->
<div class="adminContent">
  <div class="topbar">
    <button class="burger" onclick="toggleSidebar()">☰</button>
    <div class="crumb">CRM / <b>Заказы</b></div>
    <div class="spacer"></div>
    <div class="viewToggle">
      <button id="btnKanban" class="act" onclick="setView('kanban')">⊞ Канбан</button>
      <button id="btnList" onclick="setView('list')">☰ Список</button>
    </div>
    <div class="userChip"><div class="userAvatar">A</div></div>
  </div>
  <div class="contentInner">

  <!-- STATS STRIP -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:22px">
    <div class="statCard"><span>Заказов сегодня</span><b style="color:var(--st-new)" id="statToday"><?=$todayCount?></b></div>
    <div class="statCard"><span>Выручка за неделю</span><b style="color:var(--copper);font-size:18px"><?=money($weekRevenue)?></b></div>
    <div class="statCard"><span>Всего заказов</span><b id="statTotal"><?=$totalOrders?></b></div>
    <div class="statCard"><span>Новые</span><b style="color:var(--st-new)" id="statNew"><?=count($byStatus['new'])?></b></div>
    <div class="statCard"><span>В работе</span><b style="color:var(--copper)"><?=count($byStatus['processing'])?></b></div>
  </div>

  <!-- FILTERS BAR -->
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px">
    <input class="searchBar" id="crmSearch" placeholder="Поиск по имени, телефону, городу..." oninput="applyFilters()" style="width:240px">
    <select id="dateFilter" onchange="applyFilters()" style="width:auto;background:var(--bg);border:1px solid var(--line2);border-radius:9px;color:var(--text);padding:9px 32px 9px 13px">
      <option value="all">Все даты</option>
      <option value="today">Сегодня</option>
      <option value="week">Неделя</option>
      <option value="month">Месяц</option>
    </select>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="filterPill active" data-flt="all" onclick="setFilter(this,'all')">Все</button>
      <button class="filterPill" data-flt="new" onclick="setFilter(this,'new')">Новые</button>
      <button class="filterPill" data-flt="processing" onclick="setFilter(this,'processing')">В работе</button>
      <button class="filterPill" data-flt="done" onclick="setFilter(this,'done')">Выполнено</button>
      <button class="filterPill" data-flt="cancelled" onclick="setFilter(this,'cancelled')">Отменено</button>
    </div>
    <button class="btn-ghost btn-sm" onclick="customerLookup()" style="margin-left:auto">👤 Поиск клиента</button>
  </div>

  <!-- KANBAN -->
  <div class="kanban" id="kanban">
  <?php foreach($STATUSES as $sk=>$si): ?>
    <div class="kanCol">
      <div class="kanColHead"><h3 class="statusBadge <?=$si[1]?>" style="border:none;background:none;padding:0"><?=$si[0]?></h3><span class="cnt" id="cnt-<?=$sk?>"><?=count($byStatus[$sk])?></span></div>
      <div class="kanBody" id="col-<?=$sk?>" data-status="<?=$sk?>">
        <?php foreach($byStatus[$sk] as $o):
          $prev=$itemsPreview[$o['id']]??''; $cnt=$itemsCount[$o['id']]??0; ?>
        <div class="crm-card" data-id="<?=$o['id']?>" data-status="<?=h($o['status'])?>" data-date="<?=substr($o['created_at']??'',0,10)?>" data-search="<?=h(search_blob($o,$prev))?>" draggable="true" onclick="openOrder(<?=$o['id']?>)">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="cId">#<?=($o['display_id']??$o['id'])?></span>
            <?php if(!empty($o['cdek_track'])):?><span style="font-size:10px;color:var(--st-done)">🚚 <?=h($o['cdek_track'])?></span><?php elseif(!empty($o['cdek_order_uuid'])):?><span style="font-size:10px;color:var(--st-new)">📦 СДЭК</span><?php endif;?>
          </div>
          <div class="cName"><?=h($o['customer_name'])?></div>
          <div class="cMeta"><?=h($o['phone'])?></div>
          <div class="cMeta" style="margin-top:3px"><?=h(ord_city($o))?> · <?=$cnt?> тов.</div>
          <div class="cFoot">
            <span class="cTotal"><?=$o['total']?money($o['total']):'—'?></span>
            <span class="cAgo"><?=time_ago_crm($o['created_at']??'')?></span>
          </div>
          <div class="cardStatusBtns" onclick="event.stopPropagation()">
            <?php foreach($STATUSES as $bk=>$bi): if($bk!==$sk):?><button onclick="quickStatus(<?=$o['id']?>,'<?=$bk?>')">→ <?=$bi[0]?></button><?php endif; endforeach;?>
          </div>
        </div>
        <?php endforeach; ?>
      </div>
    </div>
  <?php endforeach; ?>
  </div>

  <!-- LIST -->
  <div id="listView" style="display:none">
    <table class="dataTable">
      <thead><tr><th>№</th><th>Дата</th><th>Клиент</th><th>Телефон</th><th>Город</th><th>Товары</th><th>Сумма</th><th>Статус</th><th></th></tr></thead>
      <tbody id="listRows">
      <?php foreach($orders as $o): $prev=$itemsPreview[$o['id']]??''; $cnt=$itemsCount[$o['id']]??0; $st=$o['status']??'new'; ?>
      <tr class="crm-list-row" data-id="<?=$o['id']?>" data-status="<?=h($st)?>" data-date="<?=substr($o['created_at']??'',0,10)?>" data-search="<?=h(search_blob($o,$prev))?>">
        <td style="font-weight:800;color:var(--muted)">#<?=($o['display_id']??$o['id'])?></td>
        <td style="color:var(--muted);font-size:12px;white-space:nowrap"><?=date('d.m.Y H:i',strtotime($o['created_at']??'now'))?></td>
        <td style="font-weight:700;cursor:pointer" onclick="openOrder(<?=$o['id']?>)"><?=h($o['customer_name'])?></td>
        <td><a href="tel:<?=h($o['phone'])?>" style="color:var(--copper)"><?=h($o['phone'])?></a></td>
        <td style="color:var(--muted)"><?=h(ord_city($o))?></td>
        <td style="color:var(--muted);font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="<?=h($prev)?>"><?=$cnt?> тов.</td>
        <td style="font-weight:800;color:var(--copper);white-space:nowrap"><?=$o['total']?money($o['total']):'—'?></td>
        <td>
          <select class="listStatusSel" onchange="quickStatus(<?=$o['id']?>,this.value,this)" style="background:var(--bg);border:1px solid var(--line2);border-radius:7px;color:var(--text);padding:5px 26px 5px 9px;font-size:12px;font-weight:700">
            <?php foreach($STATUSES as $bk=>$bi):?><option value="<?=$bk?>" <?=$st===$bk?'selected':''?>><?=$bi[0]?></option><?php endforeach;?>
          </select>
        </td>
        <td><div class="rowActions"><button class="btn-ghost btn-sm" onclick="openOrder(<?=$o['id']?>)">Открыть</button></div></td>
      </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    <?php if(empty($orders)):?><div class="emptyState"><div class="ico">📭</div><p>Заказов пока нет</p></div><?php endif;?>
  </div>

  </div><!-- /contentInner -->
</div><!-- /adminContent -->
</div><!-- /adminWrap -->

<!-- ORDER MODAL -->
<div class="modalOverlay" id="orderModal"><div class="modalBox lg" style="max-width:640px">
  <button class="modalClose" onclick="closeModal('orderModal')">✕</button>
  <h2 id="orderModalTitle">Заявка</h2>
  <div id="orderModalBody"><div class="emptyState">Загрузка...</div></div>
</div></div>

<!-- CUSTOMER LOOKUP MODAL -->
<div class="modalOverlay" id="lookupModal"><div class="modalBox">
  <button class="modalClose" onclick="closeModal('lookupModal')">✕</button>
  <h2>Поиск клиента по телефону</h2>
  <div style="display:flex;gap:8px;margin-bottom:14px"><input class="searchBar" id="lookupPhone" placeholder="+7..." style="flex:1;max-width:none"><button class="btn-primary" onclick="doLookup()">Найти</button></div>
  <div id="lookupResult"></div>
</div></div>

<div class="toast" id="toast"></div>

<script>
const STATUS_LABELS={new:'Новые',processing:'В работе',done:'Выполнено',cancelled:'Отменено'};
const STATUS_CLASS={new:'new',processing:'processing',done:'done',cancelled:'cancelled'};
let curFilter='all', curView='kanban', curOrderId=null, dragCard=null;

function toast(msg,type='ok'){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+type+' show';clearTimeout(window._tt);window._tt=setTimeout(()=>t.classList.remove('show'),2800);}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmt(n){return new Intl.NumberFormat('ru-RU').format(Number(n||0))+' ₽';}
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){document.getElementById(id).classList.remove('show');}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebarBackdrop').classList.toggle('show');}
document.querySelectorAll('.modalOverlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modalOverlay.show').forEach(m=>m.classList.remove('show'));});

// ── VIEW / FILTERS ──────────────────────────────────────────────────
function setView(v){curView=v;document.getElementById('kanban').style.display=v==='kanban'?'grid':'none';document.getElementById('listView').style.display=v==='list'?'block':'none';document.getElementById('btnKanban').classList.toggle('act',v==='kanban');document.getElementById('btnList').classList.toggle('act',v==='list');}
function setFilter(el,f){curFilter=f;document.querySelectorAll('[data-flt]').forEach(p=>p.classList.remove('active'));el.classList.add('active');applyFilters();}
function dateMatch(d){const df=document.getElementById('dateFilter').value;if(df==='all'||!d)return true;const t=new Date();const od=new Date(d);const diff=(t-od)/86400000;if(df==='today')return d===t.toISOString().slice(0,10);if(df==='week')return diff<=7;if(df==='month')return diff<=31;return true;}
function applyFilters(){
  const q=(document.getElementById('crmSearch').value||'').toLowerCase();
  const test=el=>(curFilter==='all'||el.dataset.status===curFilter)&&(!q||el.dataset.search.includes(q))&&dateMatch(el.dataset.date);
  document.querySelectorAll('.crm-card').forEach(c=>c.style.display=test(c)?'':'none');
  document.querySelectorAll('.crm-list-row').forEach(r=>r.style.display=test(r)?'':'none');
  ['new','processing','done','cancelled'].forEach(updateCount);
}
function updateCount(s){const col=document.getElementById('col-'+s);if(!col)return;const n=[...col.querySelectorAll('.crm-card')].filter(c=>c.style.display!=='none').length;document.getElementById('cnt-'+s).textContent=n;}

// ── DRAG & DROP ─────────────────────────────────────────────────────
function initDnd(){
  document.querySelectorAll('.crm-card').forEach(card=>{
    card.addEventListener('dragstart',()=>{dragCard=card;setTimeout(()=>card.style.opacity='.35',0);});
    card.addEventListener('dragend',()=>{card.style.opacity='';document.querySelectorAll('.kanBody').forEach(b=>b.classList.remove('dragover'));dragCard=null;});
  });
  document.querySelectorAll('.kanBody').forEach(col=>{
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('dragover');});
    col.addEventListener('dragleave',()=>col.classList.remove('dragover'));
    col.addEventListener('drop',async e=>{e.preventDefault();col.classList.remove('dragover');if(!dragCard)return;const ns=col.dataset.status,os=dragCard.dataset.status;if(ns===os)return;col.appendChild(dragCard);dragCard.dataset.status=ns;updateCount(os);updateCount(ns);await saveStatus(dragCard.dataset.id,ns);toast('Статус → '+STATUS_LABELS[ns]);});
  });
}
initDnd();

async function saveStatus(id,status,note){
  const fd=new FormData();fd.append('action','update_order');fd.append('id',id);fd.append('status',status);if(note!=null)fd.append('manager_note',note);
  const r=await fetch('/admin/crm.php',{method:'POST',body:fd});return r.json();
}
async function quickStatus(id,status,sel){
  await saveStatus(id,status);toast('Статус → '+STATUS_LABELS[status]);
  // move kanban card
  const card=document.querySelector(`.crm-card[data-id="${id}"]`);
  if(card){const os=card.dataset.status;document.getElementById('col-'+status).appendChild(card);card.dataset.status=status;updateCount(os);updateCount(status);
    card.querySelector('.cardStatusBtns').innerHTML=Object.keys(STATUS_LABELS).filter(k=>k!==status).map(k=>`<button onclick="quickStatus(${id},'${k}')">→ ${STATUS_LABELS[k]}</button>`).join('');}
  const row=document.querySelector(`.crm-list-row[data-id="${id}"]`);
  if(row){row.dataset.status=status;const s=row.querySelector('.listStatusSel');if(s&&sel!==s)s.value=status;}
}

// ── ORDER MODAL ─────────────────────────────────────────────────────
async function openOrder(id){
  curOrderId=id;
  const dispId=document.querySelector(`.crm-card[data-id="${id}"] .cId, .crm-list-row[data-id="${id}"] td`)?.textContent?.trim()||('#'+id);
  document.getElementById('orderModalTitle').textContent='Заявка '+dispId;
  document.getElementById('orderModalBody').innerHTML='<div class="emptyState">Загрузка...</div>';
  openModal('orderModal');
  const fd=new FormData();fd.append('action','get_order');fd.append('order_id',id);
  const r=await fetch('/admin/cdek_order.php',{method:'POST',body:fd});const o=await r.json();
  if(o.error){document.getElementById('orderModalBody').innerHTML='<p style="color:#f08585;padding:18px">'+esc(o.error)+'</p>';return;}
  renderOrder(o);loadHistory(o.phone,o.id);
}
function renderOrder(o){
  const items=o.items||[];
  const cdek=o.cdek_track?`<a href="https://lk.cdek.ru/order-history" target="_blank" class="btn-ghost btn-sm" style="color:var(--st-done)">🚚 ${esc(o.cdek_track)} · ЛК СДЭК ↗</a>`
    : o.cdek_order_uuid?`<a href="https://lk.cdek.ru/order-history" target="_blank" class="btn-ghost btn-sm" style="color:var(--st-new)">📦 СДЭК создан · ЛК ↗</a>`
    : `<span style="color:var(--muted);font-size:12px">СДЭК не создан — оформите в карточке заказа CMS</span>`;
  document.getElementById('orderModalBody').innerHTML=`
    <div class="odBlock">
      <h4>Клиент</h4>
      <div class="odGrid">
        <div class="odField"><div class="k">Имя</div><div class="v">${esc(o.customer_name)}</div></div>
        <div class="odField"><div class="k">Телефон</div><div class="v"><a href="tel:${esc(o.phone)}" style="color:var(--copper)">${esc(o.phone)}</a></div></div>
        ${o.email?`<div class="odField"><div class="k">Email</div><div class="v">${esc(o.email)}</div></div>`:''}
        <div class="odField" style="grid-column:1/-1"><div class="k">Адрес / Город</div><div class="v" style="font-weight:500">${esc(o.address||'—')}</div></div>
        <div class="odField"><div class="k">Доставка</div><div class="v" style="font-weight:500">${esc(o.delivery_method||'—')}</div></div>
        <div class="odField"><div class="k">Оплата</div><div class="v" style="font-weight:500">${esc(o.payment_method||'—')}</div></div>
        ${o.comment?`<div class="odField" style="grid-column:1/-1"><div class="k">Комментарий</div><div class="v" style="font-weight:400;white-space:pre-wrap">${esc(o.comment)}</div></div>`:''}
      </div>
    </div>
    <div id="histBlock"></div>
    <div class="odBlock">
      <h4>Состав заказа</h4>
      ${items.map(i=>`<div class="odItem"><span>${esc(i.product_name)} <span style="color:var(--muted)">× ${i.qty}</span></span><b style="color:var(--copper)">${fmt(i.price*i.qty)}</b></div>`).join('')||'<p style="color:var(--muted)">—</p>'}
      <div class="odItem" style="background:var(--surface2);border:1px solid var(--line);margin-top:4px"><b>Итого</b><b style="font-size:16px;color:var(--copper)">${fmt(o.total)}</b></div>
    </div>
    <div class="odBlock">
      <h4>Статус и заметка</h4>
      <div class="odGrid" style="margin-bottom:10px">
        <div><div class="k" style="font-size:10px;color:var(--muted);margin-bottom:5px">Статус</div>
          <select id="odStatus" style="width:100%;background:var(--bg);border:1px solid var(--line2);border-radius:8px;color:var(--text);padding:9px 12px" onchange="saveOrderModal(true)">
            ${Object.entries(STATUS_LABELS).map(([v,l])=>`<option value="${v}" ${o.status===v?'selected':''}>${l}</option>`).join('')}
          </select></div>
        <div><div class="k" style="font-size:10px;color:var(--muted);margin-bottom:5px">Создан</div><div style="padding-top:8px;font-size:13px">${o.created_at?new Date(o.created_at.replace(' ','T')).toLocaleString('ru-RU'):'—'}</div></div>
      </div>
      <div class="k" style="font-size:10px;color:var(--muted);margin-bottom:5px">Заметка менеджера</div>
      <textarea id="odNote" style="width:100%;background:var(--bg);border:1px solid var(--line2);border-radius:8px;color:var(--text);padding:9px 12px;min-height:60px">${esc(o.manager_note||'')}</textarea>
    </div>
    <div class="odBlock"><h4>Доставка СДЭК</h4>${cdek}</div>
    <div style="display:flex;gap:10px;margin-top:6px">
      <button class="btn-primary" onclick="saveOrderModal()">💾 Сохранить</button>
      <button class="btn-danger" style="margin-left:auto" onclick="deleteOrder(${o.id})">Удалить</button>
    </div>
    <div style="font-size:11px;color:var(--muted);padding-top:10px">Источник: ${esc(o.source||'site')} · #${o.display_id||o.id}</div>
  `;
}
async function saveOrderModal(silent){
  const status=document.getElementById('odStatus').value, note=document.getElementById('odNote').value;
  await saveStatus(curOrderId,status,note);
  if(!silent)toast('Заявка сохранена');
  // sync board
  const card=document.querySelector(`.crm-card[data-id="${curOrderId}"]`);
  if(card&&card.dataset.status!==status){const os=card.dataset.status;document.getElementById('col-'+status).appendChild(card);card.dataset.status=status;updateCount(os);updateCount(status);}
  const row=document.querySelector(`.crm-list-row[data-id="${curOrderId}"]`);
  if(row){row.dataset.status=status;const s=row.querySelector('.listStatusSel');if(s)s.value=status;}
}
async function deleteOrder(id){
  if(!confirm('Удалить заявку #'+id+'?'))return;
  const fd=new FormData();fd.append('action','delete_order');fd.append('id',id);
  const r=await fetch('/admin/crm.php',{method:'POST',body:fd});const d=await r.json();
  if(d.ok){toast('Удалено');closeModal('orderModal');document.querySelector(`.crm-card[data-id="${id}"]`)?.remove();document.querySelector(`.crm-list-row[data-id="${id}"]`)?.remove();['new','processing','done','cancelled'].forEach(updateCount);}
  else toast('Ошибка','err');
}
async function loadHistory(phone,currentId){
  if(!phone)return;
  const fd=new FormData();fd.append('action','client_history');fd.append('phone',phone);
  const r=await fetch('/admin/api.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});const d=await r.json();
  const others=(d.orders||[]).filter(o=>o.id!=currentId);
  if(!others.length)return;
  const el=document.getElementById('histBlock');if(!el)return;
  el.innerHTML=`<div class="odBlock"><h4>История клиента (${others.length})</h4>${others.map(o=>`<div class="odItem" style="cursor:pointer" onclick="openOrder(${o.id})"><span><b style="color:var(--muted)">#${o.display_id||o.id}</b> ${esc(o.items_short||'—')}</span><span style="display:flex;gap:8px;align-items:center"><span class="statusBadge ${STATUS_CLASS[o.status]||''}" style="font-size:9px">${STATUS_LABELS[o.status]||o.status}</span><b style="color:var(--copper)">${fmt(o.total)}</b></span></div>`).join('')}</div>`;
}

// ── CUSTOMER LOOKUP ─────────────────────────────────────────────────
function customerLookup(){document.getElementById('lookupResult').innerHTML='';document.getElementById('lookupPhone').value='';openModal('lookupModal');setTimeout(()=>document.getElementById('lookupPhone').focus(),100);}
async function doLookup(){
  const phone=document.getElementById('lookupPhone').value.trim();
  if(!phone){toast('Введите телефон','err');return;}
  const fd=new FormData();fd.append('action','client_history');fd.append('phone',phone);
  const r=await fetch('/admin/api.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});const d=await r.json();
  const res=document.getElementById('lookupResult');
  if(!d.orders||!d.orders.length){res.innerHTML='<p style="color:var(--muted)">Заказы не найдены</p>';return;}
  const total=d.orders.reduce((s,o)=>s+Number(o.total||0),0);
  res.innerHTML=`<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Найдено ${d.orders.length} заказ(ов) на ${fmt(total)}</div>`+d.orders.map(o=>`<div class="odItem" style="cursor:pointer" onclick="closeModal('lookupModal');openOrder(${o.id})"><span><b style="color:var(--muted)">#${o.display_id||o.id}</b> ${esc(o.items_short||'—')}</span><span style="display:flex;gap:8px;align-items:center"><span class="statusBadge ${STATUS_CLASS[o.status]||''}" style="font-size:9px">${STATUS_LABELS[o.status]||o.status}</span><b style="color:var(--copper)">${fmt(o.total)}</b></span></div>`).join('');
}
document.getElementById('lookupPhone').addEventListener('keydown',e=>{if(e.key==='Enter')doLookup();});

// ── POLLING NEW ORDERS ──────────────────────────────────────────────
(function(){
  let lastId=<?=!empty($orders)?max(array_column($orders,'id')):0?>;
  function cardHtml(o){
    return `<div class="crm-card" data-id="${o.id}" data-status="new" data-date="${(o.created_at||'').slice(0,10)}" data-search="${esc(((o.customer_name||'')+' '+(o.phone||'')+' '+(o.items_str||'')).toLowerCase())}" draggable="true" onclick="openOrder(${o.id})" style="animation:fadeInCard .3s ease;border-color:var(--copper)">
      <div style="display:flex;justify-content:space-between"><span class="cId">#${o.display_id||o.id}</span></div>
      <div class="cName">${esc(o.customer_name)}</div><div class="cMeta">${esc(o.phone)}</div>
      <div class="cMeta" style="margin-top:3px">${o.items_count||0} тов.</div>
      <div class="cFoot"><span class="cTotal">${o.total?fmt(o.total):'—'}</span><span class="cAgo">только что</span></div>
      <div class="cardStatusBtns" onclick="event.stopPropagation()">${Object.keys(STATUS_LABELS).filter(k=>k!=='new').map(k=>`<button onclick="quickStatus(${o.id},'${k}')">→ ${STATUS_LABELS[k]}</button>`).join('')}</div></div>`;
  }
  async function poll(){
    try{const fd=new FormData();fd.append('action','pending_orders');fd.append('last_id',lastId);
      const r=await fetch('/admin/crm.php',{method:'POST',body:fd});const d=await r.json();
      (d.orders||[]).forEach(o=>{if(+o.id<=lastId)return;lastId=+o.id;if(document.querySelector(`.crm-card[data-id="${o.id}"]`))return;
        document.getElementById('col-new').insertAdjacentHTML('afterbegin',cardHtml(o));updateCount('new');
        document.getElementById('statToday').textContent=+document.getElementById('statToday').textContent+1;
        document.getElementById('statTotal').textContent=+document.getElementById('statTotal').textContent+1;
        document.getElementById('statNew').textContent=+document.getElementById('statNew').textContent+1;
        toast('Новая заявка #'+(o.display_id||o.id)+' — '+o.customer_name);
        initDnd();
      });
    }catch(e){}
  }
  setInterval(poll,10000);setTimeout(poll,4000);
})();
</script>
</body>
</html>
