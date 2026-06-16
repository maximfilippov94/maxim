<?php
/**
 * catalog_api.php — LUKA OUTDOOR
 * AJAX эндпоинт для каталога
 */
require __DIR__.'/includes/db.php';
header('Content-Type: application/json; charset=utf-8');
$pdo = db();

$catSlug = trim($_GET['cat'] ?? '');
$search  = trim($_GET['q'] ?? '');
$sort    = $_GET['sort'] ?? 'popular';

$where = ['p.is_active=1'];
$params = [];
if($catSlug && $catSlug !== 'all'){
    // Ищем категорию и её подкатегории
    $catSt = $pdo->prepare("SELECT id, parent_id FROM categories WHERE slug=? AND is_active=1 LIMIT 1");
    $catSt->execute([$catSlug]);
    $catRow = $catSt->fetch(PDO::FETCH_ASSOC);
    if($catRow){
        $catIds = [(int)$catRow['id']];
        // Добавляем подкатегории
        $subSt = $pdo->prepare("SELECT id FROM categories WHERE parent_id=? AND is_active=1");
        $subSt->execute([(int)$catRow['id']]);
        foreach($subSt->fetchAll(PDO::FETCH_COLUMN) as $subId) $catIds[] = (int)$subId;
        $ph = implode(',', array_fill(0, count($catIds), '?'));
        $where[] = "p.category_id IN ($ph)";
        $params = array_merge($params, $catIds);
    } else {
        $where[] = 'c.slug=?';
        $params[] = $catSlug;
    }
}
if($search){
    $where[] = '(p.name LIKE ? OR p.subtitle LIKE ?)';
    $params[] = '%'.$search.'%';
    $params[] = '%'.$search.'%';
}
if($sort==='price_asc')       $orderBy='p.price ASC';
elseif($sort==='price_desc')  $orderBy='p.price DESC';
elseif($sort==='new')         $orderBy='p.id DESC';
else                          $orderBy='c.sort_order ASC, p.sort_order ASC, p.id ASC';

$sql = "SELECT p.*, c.name category_name, c.slug category_slug 
        FROM products p 
        LEFT JOIN categories c ON c.id=p.category_id 
        WHERE ".implode(' AND ',$where)." ORDER BY ".$orderBy;
$st = $pdo->prepare($sql);
$st->execute($params);
$products = $st->fetchAll(PDO::FETCH_ASSOC);

$out = [];
foreach($products as $p){
    $img = $p['image'] ?: 'assets/images/hero.webp';
    $out[] = [
        'id'            => (int)$p['id'],
        'name'          => $p['name'],
        'slug'          => $p['slug'] ?: $p['id'],
        'subtitle'      => $p['subtitle'],
        'price'         => (int)$p['price'],
        'image'         => $img,
        'badge'         => $p['badge'],
        'category_name' => $p['category_name'],
        'category_slug' => $p['category_slug'],
    ];
}
echo json_encode(['products' => $out, 'total' => count($out)], JSON_UNESCAPED_UNICODE);
