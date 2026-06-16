<?php
/**
 * admin/crm.php — LUKA OUTDOOR CRM
 * Канбан, детальные карточки, СДЭК накладные
 */
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';

$pdo = db();
require_admin();

// Миграция
foreach ([
    'cdek_order_uuid TEXT DEFAULT ""',
    'cdek_track TEXT DEFAULT ""',
    'cdek_status TEXT DEFAULT ""',
    'cdek_pvz_code TEXT DEFAULT ""',
    'delivery_cost INTEGER DEFAULT 0',
    'cdek_raw TEXT DEFAULT ""',
    'email TEXT DEFAULT ""',
] as $col_def) {
    $col = explode(' ', $col_def)[0];
    try { $pdo->exec("ALTER TABLE orders ADD COLUMN $col_def"); } catch (Exception $e) {}
}

$orders = $pdo->query("SELECT o.*, GROUP_CONCAT(i.product_name||' x'||i.qty, ', ') as items_str, COUNT(i.id) as items_count FROM orders o LEFT JOIN order_items i ON i.order_id=o.id GROUP BY o.id ORDER BY o.id DESC")->fetchAll(PDO::FETCH_ASSOC);

$stats = [
    'total'      => count($orders),
    'new'        => count(array_filter($orders, fn($o) => $o['status'] === 'new')),
    'processing' => count(array_filter($orders, fn($o) => $o['status'] === 'processing')),
    'done'       => count(array_filter($orders, fn($o) => $o['status'] === 'done')),
    'revenue'    => array_sum(array_column(array_filter($orders, fn($o) => $o['status'] !== 'cancelled'), 'total')),
    'cdek'       => count(array_filter($orders, fn($o) => !empty($o['cdek_order_uuid']))),
];

// Группируем по статусам для канбана
$columns = [
    'new'        => ['label' => 'Новые',    'color' => '#e8943a', 'orders' => []],
    'processing' => ['label' => 'В работе', 'color' => '#3a8ae8', 'orders' => []],
    'done'       => ['label' => 'Готово',   'color' => '#4caf50', 'orders' => []],
    'cancelled'  => ['label' => 'Отмена',   'color' => '#666',    'orders' => []],
];
foreach ($orders as $o) {
    $s = $o['status'] ?? 'new';
    if (isset($columns[$s])) $columns[$s]['orders'][] = $o;
}

function time_ago($dt) {
    $diff = time() - strtotime($dt);
    if ($diff < 60) return 'только что';
    if ($diff < 3600) return floor($diff/60).' мин назад';
    if ($diff < 86400) return floor($diff/3600).' ч назад';
    return date('d.m.Y', strtotime($dt));
}
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CRM — LUKA OUTDOOR</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #060606;
  --surface: #0d0d0d;
  --surface2: #141414;
  --border: rgba(255,255,255,.07);
  --border2: rgba(255,255,255,.12);
  --text: #f3f1ec;
  --muted: rgba(243,241,236,.45);
  --accent: #c9792b;
  --copper: #e8943a;
  --new: #e8943a;
  --processing: #3a8ae8;
  --done: #4caf50;
  --cancelled: #666;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Manrope, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }

/* ── LAYOUT ── */
.wrap { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
.sidebar { background: #080808; border-right: 1px solid var(--border); padding: 0; position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; }
.sLogo { padding: 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
.sLogo img { height: 30px; }
.sLogo span { font-size: 10px; letter-spacing: .2em; color: var(--muted); text-transform: uppercase; font-weight: 700; line-height: 1.4; }
.sNav { padding: 12px 0; flex: 1; }
.sNav a { display: flex; align-items: center; gap: 10px; padding: 11px 20px; font-size: 13px; font-weight: 600; color: var(--muted); border-left: 3px solid transparent; text-decoration: none; transition: .15s; }
.sNav a:hover { color: var(--text); background: rgba(255,255,255,.03); }
.sNav a.active { color: var(--copper); border-left-color: var(--copper); background: rgba(201,121,43,.08); }
.sBottom { padding: 14px 20px; border-top: 1px solid var(--border); }
.sBottom a { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); text-decoration: none; margin-bottom: 8px; transition: .15s; }
.sBottom a:hover { color: var(--text); }
.main { min-height: 100vh; overflow: hidden; }

/* ── TOP BAR ── */
.topbar { padding: 20px 28px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #080808; position: sticky; top: 0; z-index: 50; }
.topbar h1 { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: -.3px; }
.topbar-actions { display: flex; gap: 8px; align-items: center; }

/* ── STATS ── */
.stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; padding: 20px 28px; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; }
.stat span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .16em; color: var(--muted); margin-bottom: 8px; }
.stat b { display: block; font-size: 26px; font-weight: 900; line-height: 1; }

/* ── TOOLBAR ── */
.toolbar { padding: 0 28px 16px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.searchInput { background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; color: var(--text); padding: 9px 14px; font: inherit; font-size: 13px; outline: none; width: 240px; transition: .15s; }
.searchInput:focus { border-color: rgba(201,121,43,.5); }
.viewToggle { display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.viewBtn { background: none; border: none; color: var(--muted); padding: 8px 14px; font: 600 12px/1 Manrope; cursor: pointer; transition: .15s; }
.viewBtn.active { background: var(--accent); color: #0d0704; }
.pill { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 6px 14px; font: 600 12px/1 Manrope; color: var(--muted); cursor: pointer; transition: .15s; }
.pill:hover, .pill.active { border-color: var(--accent); color: var(--copper); }

/* ── KANBAN ── */
.kanban { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 0 28px 40px; align-items: start; }
.kCol { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; min-height: 120px; }
.kColHead { padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.kColHead h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .16em; font-weight: 700; }
.kCount { background: rgba(255,255,255,.08); border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 900; }
.kBody { padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 60px; }
.kBody.drag-over { background: rgba(201,121,43,.06); border-radius: 12px; }

/* ── ORDER CARD ── */
.oCard { background: var(--bg); border: 1px solid var(--border); border-radius: 14px; padding: 14px; cursor: pointer; transition: .15s; position: relative; }
.oCard:hover { border-color: rgba(201,121,43,.35); transform: translateY(-1px); }
.oCard.drag-src { opacity: .4; }
.oCardTop { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.oNum { font-size: 11px; font-weight: 900; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; }
.oName { font-size: 14px; font-weight: 700; line-height: 1.2; margin-bottom: 3px; }
.oPhone { font-size: 12px; color: var(--muted); }
.oItems { font-size: 11px; color: var(--muted); margin: 8px 0; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.oCardBottom { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
.oPrice { font-size: 14px; font-weight: 900; color: var(--copper); }
.oTime { font-size: 10px; color: var(--muted); }
.cdekTag { display: inline-flex; align-items: center; gap: 4px; background: rgba(58,138,232,.15); border: 1px solid rgba(58,138,232,.3); border-radius: 6px; padding: 2px 7px; font-size: 10px; font-weight: 700; color: #6ab0ff; margin-top: 6px; }
.trackTag { background: rgba(76,175,80,.15); border-color: rgba(76,175,80,.3); color: #7fd882; }

/* ── LIST VIEW ── */
.listView { display: none; padding: 0 28px 40px; }
.listView.active { display: block; }
.kanban.hidden { display: none; }
.listTable { width: 100%; border-collapse: collapse; }
.listTable th { padding: 10px 14px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
.listTable td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,.04); vertical-align: middle; }
.listTable tr:hover td { background: rgba(255,255,255,.02); cursor: pointer; }
.statusDot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }

/* ── DRAWER ── */
.drawerOverlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 800; display: none; backdrop-filter: blur(4px); }
.drawerOverlay.show { display: block; }
.drawer { position: fixed; top: 0; right: 0; width: min(680px, 100vw); height: 100vh; background: #0a0a0a; border-left: 1px solid var(--border2); z-index: 801; transform: translateX(100%); transition: transform .3s cubic-bezier(.22,.1,.36,1); display: flex; flex-direction: column; }
.drawer.open { transform: translateX(0); }
.dHead { padding: 18px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 12px; }
.dHead h2 { font-size: 18px; text-transform: uppercase; font-weight: 900; }
.dClose { background: none; border: none; color: var(--muted); font-size: 22px; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: .15s; }
.dClose:hover { color: var(--text); background: rgba(255,255,255,.06); }
.dBody { flex: 1; overflow-y: auto; padding: 24px; }
.dFoot { padding: 14px 24px; border-top: 1px solid var(--border); display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }

/* Drawer sections */
.dSection { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px; margin-bottom: 14px; }
.dSection h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .16em; color: var(--muted); margin-bottom: 14px; font-weight: 700; }
.dGrid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.dField { display: grid; gap: 5px; }
.dField label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; font-weight: 600; }
.dField span { font-size: 14px; font-weight: 600; line-height: 1.4; }
.dField a { color: var(--copper); text-decoration: none; font-size: 14px; font-weight: 700; }
.dField a:hover { text-decoration: underline; }
.dInput { background: var(--surface2); border: 1px solid var(--border2); border-radius: 10px; color: var(--text); padding: 9px 12px; font: inherit; font-size: 13px; outline: none; width: 100%; transition: .15s; }
.dInput:focus { border-color: rgba(201,121,43,.5); }
select.dInput { cursor: pointer; }
.dItems { display: flex; flex-direction: column; gap: 8px; }
.dItem { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--surface2); border-radius: 10px; font-size: 13px; }
.dItem b { font-weight: 700; color: var(--copper); }

/* CDEK block */
.cdekBlock { background: rgba(58,138,232,.06); border: 1px solid rgba(58,138,232,.2); border-radius: 16px; padding: 18px; margin-bottom: 14px; }
.cdekBlock h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .16em; color: #6ab0ff; margin-bottom: 14px; font-weight: 700; }
.cdekStatus { display: inline-flex; align-items: center; gap: 6px; background: rgba(58,138,232,.15); border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 700; color: #6ab0ff; margin-bottom: 12px; }
.trackNum { font-size: 22px; font-weight: 900; color: var(--text); font-variant-numeric: tabular-nums; }
.cdekForm { display: grid; gap: 10px; }
.cdekFormRow { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.cdekFormRow.single { grid-template-columns: 1fr; }

/* Status badges */
.sBadge { display: inline-flex; align-items: center; gap: 5px; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
.sBadge.new { background: rgba(232,148,58,.15); color: var(--new); }
.sBadge.processing { background: rgba(58,138,232,.15); color: var(--processing); }
.sBadge.done { background: rgba(76,175,80,.15); color: var(--done); }
.sBadge.cancelled { background: rgba(100,100,100,.15); color: var(--cancelled); }

/* Buttons */
.btn { border: none; border-radius: 10px; padding: 9px 16px; font: 700 12px/1 Manrope; cursor: pointer; transition: .15s; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
.btn-primary { background: var(--accent); color: #0d0704; }
.btn-primary:hover { background: var(--copper); }
.btn-primary:disabled { opacity: .5; cursor: default; }
.btn-ghost { background: rgba(255,255,255,.06); border: 1px solid var(--border2); color: var(--text); }
.btn-ghost:hover { border-color: var(--accent); color: var(--copper); }
.btn-blue { background: rgba(58,138,232,.2); border: 1px solid rgba(58,138,232,.4); color: #6ab0ff; }
.btn-blue:hover { background: rgba(58,138,232,.35); }
.btn-blue:disabled { opacity: .5; cursor: default; }
.btn-green { background: rgba(76,175,80,.2); border: 1px solid rgba(76,175,80,.4); color: #7fd882; }
.btn-green:hover { background: rgba(76,175,80,.35); }
.btn-danger { background: rgba(122,27,27,.5); border: 1px solid rgba(180,40,40,.3); color: #ffaaaa; }
.btn-danger:hover { background: rgba(160,30,30,.6); }
.btn-sm { padding: 6px 11px !important; font-size: 11px !important; }

/* Toast */
.toast { position: fixed; bottom: 24px; right: 24px; background: #1a1a1a; border: 1px solid var(--border2); color: var(--text); padding: 12px 18px; border-radius: 14px; font-size: 13px; font-weight: 600; z-index: 9999; transform: translateY(16px); opacity: 0; transition: .25s; pointer-events: none; display: flex; align-items: center; gap: 8px; }
.toast.show { transform: translateY(0); opacity: 1; }
.toast.ok::before { content: '✓'; color: #4caf50; }
.toast.err::before { content: '⚠'; color: #e05252; }

/* Loader */
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.2); border-top-color: var(--copper); border-radius: 50%; animation: spin .6s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 1100px) { .kanban { grid-template-columns: repeat(2, 1fr); } .stats { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 800px) { .wrap { grid-template-columns: 1fr; } .sidebar { display: none; } .kanban { grid-template-columns: 1fr; } .stats { grid-template-columns: repeat(2, 1fr); } }
</style>
</head>
<body>
<div class="wrap">

<!-- SIDEBAR -->
<aside class="sidebar">
  <div class="sLogo">
    <img src="../assets/images/logo_luka_new.png" alt="LUKA" onerror="this.style.display='none'">
    <span>LUKA<br>OUTDOOR<br>CRM</span>
  </div>
  <nav class="sNav">
    <a href="/admin/crm.php" class="active">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
      Заявки CRM
    </a>
    <a href="/admin/index.php?tab=orders">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      Старая CRM
    </a>
    <a href="/admin/index.php?tab=products">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      Товары
    </a>
    <a href="/admin/index.php?tab=settings">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
      Настройки
    </a>
  </nav>
  <div class="sBottom">
    <a href="/" target="_blank">↗ На сайт</a>
    <a href="/admin/logout.php">← Выйти</a>
  </div>
</aside>

<!-- MAIN -->
<div class="main">

  <!-- TOP BAR -->
  <div class="topbar">
    <h1>Заявки CRM</h1>
    <div class="topbar-actions">
      <a href="?export=csv" class="btn btn-ghost btn-sm">↓ CSV</a>
      <a href="/admin/index.php" class="btn btn-ghost btn-sm">← Старая админка</a>
    </div>
  </div>

  <!-- STATS -->
  <div class="stats">
    <div class="stat"><span>Всего заявок</span><b><?= $stats['total'] ?></b></div>
    <div class="stat"><span>Новые</span><b style="color:var(--new)"><?= $stats['new'] ?></b></div>
    <div class="stat"><span>В работе</span><b style="color:var(--processing)"><?= $stats['processing'] ?></b></div>
    <div class="stat"><span>Готово</span><b style="color:var(--done)"><?= $stats['done'] ?></b></div>
    <div class="stat"><span>Выручка</span><b style="font-size:18px"><?= money($stats['revenue']) ?></b></div>
    <div class="stat"><span>В СДЭК</span><b style="color:#6ab0ff"><?= $stats['cdek'] ?></b></div>
  </div>

  <!-- TOOLBAR -->
  <div class="toolbar">
    <input class="searchInput" id="crmSearch" placeholder="🔍 Имя, телефон, товар..." oninput="filterCards()">
    <div class="viewToggle">
      <button class="viewBtn active" id="btnKanban" onclick="setView('kanban')">⊞ Канбан</button>
      <button class="viewBtn" id="btnList" onclick="setView('list')">☰ Список</button>
    </div>
    <button class="pill active" data-filter="all" onclick="setFilter(this,'all')">Все</button>
    <button class="pill" data-filter="new" onclick="setFilter(this,'new')">Новые</button>
    <button class="pill" data-filter="processing" onclick="setFilter(this,'processing')">В работе</button>
    <button class="pill" data-filter="done" onclick="setFilter(this,'done')">Готово</button>
    <button class="pill" data-filter="cancelled" onclick="setFilter(this,'cancelled')">Отмена</button>
  </div>

  <!-- KANBAN VIEW -->
  <div class="kanban" id="kanbanView">
    <?php foreach ($columns as $status => $col): ?>
    <div class="kCol" data-col="<?= $status ?>">
      <div class="kColHead">
        <h3 style="color:<?= $col['color'] ?>"><?= $col['label'] ?></h3>
        <span class="kCount" style="color:<?= $col['color'] ?>"><?= count($col['orders']) ?></span>
      </div>
      <div class="kBody" id="col-<?= $status ?>" data-status="<?= $status ?>">
        <?php foreach ($col['orders'] as $o): ?>
        <div class="oCard"
          data-id="<?= $o['id'] ?>"
          data-status="<?= h($o['status']) ?>"
          data-search="<?= h(mb_strtolower($o['customer_name'].' '.$o['phone'].' '.($o['items_str']??''))) ?>"
          draggable="true"
          onclick="openOrder(<?= $o['id'] ?>)">
          <div class="oCardTop">
            <div class="oNum">#<?= $o['id'] ?></div>
            <?php if($o['cdek_track']): ?>
              <span class="cdekTag trackTag">🚚 <?= h($o['cdek_track']) ?></span>
            <?php elseif($o['cdek_order_uuid']): ?>
              <span class="cdekTag">📦 СДЭК</span>
            <?php endif; ?>
          </div>
          <div class="oName"><?= h($o['customer_name']) ?></div>
          <div class="oPhone"><?= h($o['phone']) ?></div>
          <?php if($o['items_str']): ?>
          <div class="oItems"><?= h($o['items_str']) ?></div>
          <?php endif; ?>
          <div class="oCardBottom">
            <div class="oPrice"><?= $o['total'] ? money($o['total']) : '—' ?></div>
            <div class="oTime"><?= time_ago($o['created_at'] ?? '') ?></div>
          </div>
        </div>
        <?php endforeach; ?>
      </div>
    </div>
    <?php endforeach; ?>
  </div>

  <!-- LIST VIEW -->
  <div class="listView" id="listView">
    <table class="listTable">
      <thead>
        <tr>
          <th>#</th><th>Клиент</th><th>Товары</th><th>Доставка</th><th>Сумма</th><th>Статус</th><th>СДЭК</th><th>Дата</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($orders as $o): ?>
        <tr data-id="<?= $o['id'] ?>"
            data-status="<?= h($o['status']) ?>"
            data-search="<?= h(mb_strtolower($o['customer_name'].' '.$o['phone'].' '.($o['items_str']??''))) ?>"
            onclick="openOrder(<?= $o['id'] ?>)">
          <td><b style="color:var(--muted)">#<?= $o['id'] ?></b></td>
          <td>
            <div style="font-weight:700;font-size:13px"><?= h($o['customer_name']) ?></div>
            <div style="font-size:12px;color:var(--muted)"><?= h($o['phone']) ?></div>
          </td>
          <td style="font-size:12px;color:var(--muted);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><?= h($o['items_str'] ?? '—') ?></td>
          <td style="font-size:12px;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted)"><?= h($o['address'] ?? '—') ?></td>
          <td style="font-weight:800;color:var(--copper);white-space:nowrap"><?= $o['total'] ? money($o['total']) : '—' ?></td>
          <td>
            <span class="sBadge <?= h($o['status']) ?>">
              <?= ['new'=>'Новая','processing'=>'В работе','done'=>'Готово','cancelled'=>'Отмена'][$o['status']] ?? h($o['status']) ?>
            </span>
          </td>
          <td>
            <?php if($o['cdek_track']): ?>
              <span style="font-size:11px;font-weight:700;color:#7fd882">🚚 <?= h($o['cdek_track']) ?></span>
            <?php elseif($o['cdek_order_uuid']): ?>
              <span style="font-size:11px;color:#6ab0ff">📦 создан</span>
            <?php else: ?><span style="color:var(--muted);font-size:11px">—</span><?php endif; ?>
          </td>
          <td style="font-size:12px;color:var(--muted);white-space:nowrap"><?= date('d.m.Y H:i', strtotime($o['created_at'] ?? 'now')) ?></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>

</div><!-- /main -->
</div><!-- /wrap -->

<!-- ── DRAWER ── -->
<div class="drawerOverlay" id="drawerOverlay" onclick="closeDrawer()"></div>
<aside class="drawer" id="orderDrawer">
  <div class="dHead">
    <div style="display:flex;align-items:center;gap:12px">
      <h2 id="dTitle">Заявка</h2>
      <span id="dBadge" class="sBadge new">Новая</span>
    </div>
    <button class="dClose" onclick="closeDrawer()">✕</button>
  </div>
  <div class="dBody" id="dBody">
    <div style="text-align:center;padding:60px;color:var(--muted)"><div class="spinner"></div></div>
  </div>
  <div class="dFoot" id="dFoot"></div>
</aside>

<!-- ── TOAST ── -->
<div class="toast" id="toast"></div>

<?php
// CSV Export
if (isset($_GET['export']) && $_GET['export'] === 'csv') {
    ob_clean();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="luka-crm-'.date('Y-m-d').'.csv"');
    $out = fopen('php://output', 'w');
    fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
    fputcsv($out, ['#','Дата','Статус','Имя','Телефон','Email','Адрес','Доставка','Оплата','Сумма','СДЭК UUID','Трек','Товары','Заметка'], ';');
    foreach ($orders as $o) {
        fputcsv($out, [$o['id'], $o['created_at'], $o['status'], $o['customer_name'], $o['phone'], $o['email'] ?? '', $o['address'], $o['delivery_method'], $o['payment_method'], $o['total'], $o['cdek_order_uuid'] ?? '', $o['cdek_track'] ?? '', $o['items_str'] ?? '', $o['manager_note'] ?? ''], ';');
    }
    fclose($out);
    exit;
}
?>

<script>
const CDEK_API = '/admin/cdek_order.php';
const STATUS_LABELS = {new:'Новая', processing:'В работе', done:'Готово', cancelled:'Отмена'};
const STATUS_COLORS = {new:'var(--new)', processing:'var(--processing)', done:'var(--done)', cancelled:'var(--cancelled)'};
let currentOrderId = null;
let currentView = 'kanban';
let currentFilter = 'all';

// ── TOAST ──────────────────────────────────────────────────────────────
function toast(msg, type='ok') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── VIEW TOGGLE ─────────────────────────────────────────────────────────
function setView(v) {
  currentView = v;
  document.getElementById('kanbanView').classList.toggle('hidden', v !== 'kanban');
  document.getElementById('listView').classList.toggle('active', v === 'list');
  document.getElementById('btnKanban').classList.toggle('active', v === 'kanban');
  document.getElementById('btnList').classList.toggle('active', v === 'list');
}

// ── FILTER ─────────────────────────────────────────────────────────────
function setFilter(el, f) {
  currentFilter = f;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  filterCards();
}

function filterCards() {
  const q = document.getElementById('crmSearch').value.toLowerCase();
  // Kanban
  document.querySelectorAll('.oCard').forEach(c => {
    const matchStatus = currentFilter === 'all' || c.dataset.status === currentFilter;
    const matchQ = !q || c.dataset.search.includes(q);
    c.style.display = matchStatus && matchQ ? '' : 'none';
  });
  // List
  document.querySelectorAll('.listTable tbody tr').forEach(r => {
    const matchStatus = currentFilter === 'all' || r.dataset.status === currentFilter;
    const matchQ = !q || r.dataset.search.includes(q);
    r.style.display = matchStatus && matchQ ? '' : 'none';
  });
}

// ── DRAG AND DROP KANBAN ────────────────────────────────────────────────
let dragCard = null;
document.querySelectorAll('.oCard').forEach(card => {
  card.addEventListener('dragstart', e => {
    dragCard = card;
    setTimeout(() => card.classList.add('drag-src'), 0);
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('drag-src');
    document.querySelectorAll('.kBody').forEach(b => b.classList.remove('drag-over'));
    dragCard = null;
  });
});
document.querySelectorAll('.kBody').forEach(col => {
  col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
  col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
  col.addEventListener('drop', async e => {
    e.preventDefault();
    col.classList.remove('drag-over');
    if (!dragCard || dragCard.dataset.status === col.dataset.status) return;
    const newStatus = col.dataset.status;
    const oldStatus = dragCard.dataset.status;
    const id = dragCard.dataset.id;
    // Обновляем UI
    col.appendChild(dragCard);
    dragCard.dataset.status = newStatus;
    // Обновляем счётчики
    updateColCount(oldStatus);
    updateColCount(newStatus);
    // Обновляем бейдж
    dragCard.querySelector('.oNum') && null; // just trigger rerender
    // Сохраняем
    try {
      const fd = new FormData();
      fd.append('action', 'update_order'); fd.append('order_id', id);
      fd.append('status', newStatus);
      await fetch(CDEK_API, {method:'POST', body: fd});
      toast('Статус → '+STATUS_LABELS[newStatus]);
    } catch(e) { toast('Ошибка сохранения', 'err'); }
  });
});
function updateColCount(status) {
  const col = document.querySelector(`[data-col="${status}"]`);
  if (!col) return;
  const count = col.querySelectorAll('.oCard:not([style*="display: none"])').length;
  col.querySelector('.kCount').textContent = count;
}

// ── OPEN ORDER DRAWER ───────────────────────────────────────────────────
async function openOrder(id) {
  currentOrderId = id;
  document.getElementById('dTitle').textContent = 'Заявка #' + id;
  document.getElementById('dBody').innerHTML = '<div style="text-align:center;padding:60px;color:var(--muted)"><div class="spinner"></div></div>';
  document.getElementById('dFoot').innerHTML = '';
  document.getElementById('drawerOverlay').classList.add('show');
  document.getElementById('orderDrawer').classList.add('open');

  const fd = new FormData();
  fd.append('action', 'get_order'); fd.append('order_id', id);
  const r = await fetch(CDEK_API, {method:'POST', body: fd});
  const o = await r.json();
  if (o.error) { document.getElementById('dBody').innerHTML = '<p style="color:#e05;padding:20px">'+o.error+'</p>'; return; }

  renderDrawer(o);
}

function renderDrawer(o) {
  const badge = document.getElementById('dBadge');
  badge.textContent = STATUS_LABELS[o.status] || o.status;
  badge.className = 'sBadge ' + o.status;

  const items = o.items || [];
  const totalDelivery = o.delivery_cost ? '<div class="dItem"><span>Доставка</span><b>'+fmt(o.delivery_cost)+'</b></div>' : '';

  document.getElementById('dBody').innerHTML = `
    <!-- Контакты -->
    <div class="dSection">
      <h3>Клиент</h3>
      <div class="dGrid2">
        <div class="dField"><label>Имя</label><span>${esc(o.customer_name)}</span></div>
        <div class="dField"><label>Телефон</label><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></div>
        ${o.email ? `<div class="dField"><label>Email</label><a href="mailto:${esc(o.email)}">${esc(o.email)}</a></div>` : ''}
        <div class="dField"><label>Источник</label><span>${esc(o.source||'—')}</span></div>
        <div class="dField" style="grid-column:1/-1"><label>Адрес / Город</label><span>${esc(o.address||'—')}</span></div>
        <div class="dField"><label>Доставка</label><span>${esc(o.delivery_method||'—')}</span></div>
        <div class="dField"><label>Оплата</label><span>${esc(o.payment_method||'—')}</span></div>
        ${o.comment ? `<div class="dField" style="grid-column:1/-1"><label>Комментарий</label><span style="white-space:pre-wrap;font-size:13px;color:var(--muted)">${esc(o.comment)}</span></div>` : ''}
      </div>
    </div>

    <!-- Товары -->
    <div class="dSection">
      <h3>Состав заказа</h3>
      <div class="dItems">
        ${items.map(i => `<div class="dItem"><span>${esc(i.product_name)} × ${i.qty}</span><b>${fmt(i.price * i.qty)}</b></div>`).join('')}
        ${totalDelivery}
        <div class="dItem" style="background:rgba(201,121,43,.08);border:1px solid rgba(201,121,43,.2)">
          <span style="font-weight:800">Итого</span>
          <b style="font-size:16px">${fmt(o.total)}</b>
        </div>
      </div>
    </div>

    <!-- Управление -->
    <div class="dSection">
      <h3>Статус и заметка</h3>
      <div class="dGrid2" style="gap:10px">
        <div class="dField">
          <label>Статус заявки</label>
          <select class="dInput" id="dStatus" onchange="quickSave()">
            ${Object.entries(STATUS_LABELS).map(([v,l]) => `<option value="${v}" ${o.status===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="dField">
          <label>Дата заявки</label>
          <span>${new Date(o.created_at).toLocaleString('ru-RU')}</span>
        </div>
        <div class="dField" style="grid-column:1/-1">
          <label>Заметка менеджера</label>
          <textarea class="dInput" id="dNote" rows="2" placeholder="Внутренняя заметка...">${esc(o.manager_note||'')}</textarea>
        </div>
      </div>
    </div>

    <!-- СДЭК -->
    ${renderCdekBlock(o)}

    <!-- Meta -->
    <div style="font-size:11px;color:var(--muted);padding:4px 0 8px">
      Заявка создана: ${new Date(o.created_at).toLocaleString('ru-RU')}
      ${o.cdek_order_uuid ? ' · UUID: '+o.cdek_order_uuid : ''}
    </div>
  `;

  document.getElementById('dFoot').innerHTML = `
    <button class="btn btn-primary" onclick="saveOrder()">💾 Сохранить</button>
    <button class="btn btn-danger btn-sm" onclick="deleteOrderCRM(${o.id})">Удалить</button>
  `;
}

function renderCdekBlock(o) {
  if (o.cdek_order_uuid) {
    // Заказ уже создан
    return `
    <div class="cdekBlock">
      <h3>📦 СДЭК — Заказ создан</h3>
      ${o.cdek_track ? `<div style="margin-bottom:12px"><label style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;display:block;margin-bottom:4px">Трек-номер</label><div class="trackNum">${esc(o.cdek_track)}</div></div>` : ''}
      <div class="cdekStatus">${esc(o.cdek_status||'создан')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-blue btn-sm" onclick="cdekStatus()">↻ Обновить статус</button>
        <button class="btn btn-green btn-sm" onclick="cdekLabel()">🖨 Печать накладной</button>
        <button class="btn btn-danger btn-sm" onclick="cdekCancel()">✕ Отменить в СДЭК</button>
      </div>
    </div>`;
  }

  // Форма создания заказа
  return `
  <div class="cdekBlock">
    <h3>📦 СДЭК — Создать заказ</h3>
    <div class="cdekForm">
      <div class="cdekFormRow">
        <div class="dField">
          <label>Тип доставки</label>
          <select class="dInput" id="cdekTariff">
            <option value="136">До ПВЗ (136)</option>
            <option value="137">Курьер до двери (137)</option>
          </select>
        </div>
        <div class="dField">
          <label>Код ПВЗ СДЭК</label>
          <input class="dInput" id="cdekPvzCode" placeholder="MSK001" value="${esc(o.cdek_pvz_code||'')}">
        </div>
        <div class="dField">
          <label>Код города СДЭК</label>
          <input class="dInput" id="cdekCityCode" placeholder="270" type="number">
        </div>
      </div>
      <div class="cdekFormRow">
        <div class="dField">
          <label>Вес (г)</label>
          <input class="dInput" id="cdekWeight" type="number" value="12000">
        </div>
        <div class="dField">
          <label>Длина (см)</label>
          <input class="dInput" id="cdekLength" type="number" value="60">
        </div>
        <div class="dField">
          <label>Ширина × Высота</label>
          <input class="dInput" id="cdekWidth" type="number" value="60" placeholder="Ш">
        </div>
      </div>
      <button class="btn btn-blue" onclick="cdekCreate()" id="cdekCreateBtn">
        📦 Создать заказ в СДЭК
      </button>
      <p style="font-size:11px;color:var(--muted);margin-top:4px">
        Укажите код ПВЗ <b>или</b> код города. Коды городов: Москва 270, СПб 1, Тольятти 431.
      </p>
    </div>
  </div>`;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n) { return new Intl.NumberFormat('ru-RU').format(Number(n||0)) + ' ₽'; }

function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('show');
  document.getElementById('orderDrawer').classList.remove('open');
  currentOrderId = null;
}

async function quickSave() { await saveOrder(true); }

async function saveOrder(silent=false) {
  const fd = new FormData();
  fd.append('action', 'update_order');
  fd.append('order_id', currentOrderId);
  fd.append('status', document.getElementById('dStatus').value);
  fd.append('manager_note', document.getElementById('dNote').value);
  const r = await fetch(CDEK_API, {method:'POST', body: fd});
  const d = await r.json();
  if (d.ok) {
    if (!silent) toast('Заявка сохранена');
    // Обновляем карточку в канбане
    const card = document.querySelector(`.oCard[data-id="${currentOrderId}"]`);
    const newStatus = document.getElementById('dStatus').value;
    if (card && card.dataset.status !== newStatus) {
      const oldStatus = card.dataset.status;
      card.dataset.status = newStatus;
      const newCol = document.getElementById('col-' + newStatus);
      if (newCol) { newCol.appendChild(card); updateColCount(oldStatus); updateColCount(newStatus); }
    }
    // Обновляем badge в drawer
    const badge = document.getElementById('dBadge');
    if (badge) { badge.textContent = STATUS_LABELS[newStatus]; badge.className = 'sBadge ' + newStatus; }
  } else {
    toast('Ошибка сохранения', 'err');
  }
}

async function deleteOrderCRM(id) {
  if (!confirm('Удалить заявку #'+id+'?')) return;
  const fd = new FormData();
  fd.append('action', 'delete_order'); fd.append('id', id);
  const r = await fetch('/admin/index.php', {method:'POST', body: fd, headers:{'X-Requested-With':'XMLHttpRequest'}});
  const d = await r.json();
  if (d.ok) {
    toast('Заявка удалена');
    closeDrawer();
    document.querySelector(`.oCard[data-id="${id}"]`)?.remove();
    document.querySelector(`.listTable tr[data-id="${id}"]`)?.remove();
  } else toast('Ошибка', 'err');
}

// ── СДЭК ───────────────────────────────────────────────────────────────
async function cdekCreate() {
  const btn = document.getElementById('cdekCreateBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Создаём...';
  const fd = new FormData();
  fd.append('action', 'create');
  fd.append('order_id', currentOrderId);
  fd.append('tariff', document.getElementById('cdekTariff').value);
  fd.append('pvz_code', document.getElementById('cdekPvzCode').value);
  fd.append('city_code', document.getElementById('cdekCityCode').value);
  fd.append('weight', document.getElementById('cdekWeight').value);
  fd.append('length', document.getElementById('cdekLength').value);
  fd.append('width', document.getElementById('cdekWidth').value);
  fd.append('height', '40');
  try {
    const r = await fetch(CDEK_API, {method:'POST', body: fd});
    const d = await r.json();
    if (d.ok) {
      toast('✓ Заказ создан в СДЭК! UUID: '+d.uuid);
      await openOrder(currentOrderId); // перерендерим
    } else {
      toast(d.error || 'Ошибка СДЭК', 'err');
      btn.disabled = false; btn.innerHTML = '📦 Создать заказ в СДЭК';
    }
  } catch(e) {
    toast('Сетевая ошибка', 'err');
    btn.disabled = false; btn.innerHTML = '📦 Создать заказ в СДЭК';
  }
}

async function cdekStatus() {
  const fd = new FormData();
  fd.append('action', 'status'); fd.append('order_id', currentOrderId);
  const r = await fetch(CDEK_API, {method:'POST', body: fd});
  const d = await r.json();
  if (d.ok) {
    toast(d.track ? '🚚 Трек: '+d.track+' · '+d.status : '✓ '+d.status);
    await openOrder(currentOrderId);
  } else toast(d.error || 'Ошибка', 'err');
}

async function cdekLabel() {
  const btn = event.target;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Готовим...';
  const fd = new FormData();
  fd.append('action', 'label'); fd.append('order_id', currentOrderId);
  const r = await fetch(CDEK_API, {method:'POST', body: fd});
  const d = await r.json();
  btn.disabled = false; btn.innerHTML = '🖨 Печать накладной';
  if (d.ok && d.url) {
    window.open(d.url, '_blank');
    toast('✓ Накладная открыта в новой вкладке');
  } else toast(d.error || 'Ошибка', 'err');
}

async function cdekCancel() {
  if (!confirm('Отменить заказ в СДЭК?')) return;
  const fd = new FormData();
  fd.append('action', 'cancel'); fd.append('order_id', currentOrderId);
  const r = await fetch(CDEK_API, {method:'POST', body: fd});
  const d = await r.json();
  if (d.ok) { toast('Заказ отменён в СДЭК'); await openOrder(currentOrderId); }
  else toast(d.error || 'Ошибка', 'err');
}

// Закрытие по Esc
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
</script>
</body>
</html>
