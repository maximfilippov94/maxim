<?php
/**
 * sitemap.php — Фанера63.рф
 * Динамический XML-sitemap из БД (товары, категории, CMS-страницы)
 * Загрузи этот файл в корень сайта (рядом с index.php)
 */
require __DIR__ . '/includes/db.php';
$pdo = db();

$BASE = 'https://fanera63.ru';

// Текущая дата для статических страниц
$today = date('Y-m-d');

// Собираем все URL
$urls = [];

// ── 1. Статические страницы ────────────────────────────────────────────────
$urls[] = [
    'loc'        => $BASE . '/',
    'changefreq' => 'weekly',
    'priority'   => '1.0',
    'lastmod'    => $today,
];
$urls[] = [
    'loc'        => $BASE . '/catalog.php',
    'changefreq' => 'weekly',
    'priority'   => '0.9',
    'lastmod'    => $today,
];

// ── 2. Категории товаров ───────────────────────────────────────────────────
$cats = $pdo->query(
    "SELECT slug, parent_id FROM categories WHERE is_active=1 ORDER BY sort_order, id"
)->fetchAll(PDO::FETCH_ASSOC);

foreach ($cats as $cat) {
    if (!$cat['slug']) continue;
    $priority = empty($cat['parent_id']) ? '0.8' : '0.7';
    $urls[] = [
        'loc'        => $BASE . '/catalog.php?cat=' . rawurlencode($cat['slug']),
        'changefreq' => 'weekly',
        'priority'   => $priority,
        'lastmod'    => $today,
    ];
}

// ── 3. Товары ──────────────────────────────────────────────────────────────
$products = $pdo->query(
    "SELECT slug, id FROM products WHERE is_active=1 ORDER BY sort_order, id"
)->fetchAll(PDO::FETCH_ASSOC);

foreach ($products as $p) {
    $identifier = ($p['slug'] && $p['slug'] !== '') ? $p['slug'] : $p['id'];
    $urls[] = [
        'loc'        => $BASE . '/product.php?slug=' . rawurlencode($identifier),
        'changefreq' => 'weekly',
        'priority'   => '0.8',
        'lastmod'    => $today,
    ];
}

// ── 4. Страница городов доставки ───────────────────────────────────────────
$urls[] = [
    'loc'        => $BASE . '/cities.php',
    'changefreq' => 'monthly',
    'priority'   => '0.7',
    'lastmod'    => $today,
];

// Страницы отдельных городов
require_once __DIR__ . '/includes/cities_data.php';
foreach ($cities_data as $city) {
    if (!$city['slug']) continue;
    $urls[] = [
        'loc'        => $BASE . '/city/' . rawurlencode($city['slug']),
        'changefreq' => 'monthly',
        'priority'   => '0.6',
        'lastmod'    => $today,
    ];
}

// ── 5. CMS-страницы ────────────────────────────────────────────────────────
try {
    $pages = $pdo->query(
        "SELECT slug FROM pages WHERE is_active=1 ORDER BY id"
    )->fetchAll(PDO::FETCH_ASSOC);

    foreach ($pages as $pg) {
        if (!$pg['slug']) continue;
        $urls[] = [
            'loc'        => $BASE . '/page.php?slug=' . rawurlencode($pg['slug']),
            'changefreq' => 'monthly',
            'priority'   => '0.6',
            'lastmod'    => $today,
        ];
    }
} catch (Exception $e) {
    // Таблица pages может быть пуста — не страшно
}

// ── Отдаём XML ─────────────────────────────────────────────────────────────
header('Content-Type: application/xml; charset=UTF-8');

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

foreach ($urls as $u) {
    echo "  <url>\n";
    echo "    <loc>" . htmlspecialchars($u['loc'], ENT_XML1, 'UTF-8') . "</loc>\n";
    echo "    <lastmod>" . $u['lastmod'] . "</lastmod>\n";
    echo "    <changefreq>" . $u['changefreq'] . "</changefreq>\n";
    echo "    <priority>" . $u['priority'] . "</priority>\n";
    echo "  </url>\n";
}

echo '</urlset>';
