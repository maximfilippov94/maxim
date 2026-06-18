<?php
/**
 * YML-фид для Яндекс.Директ / Яндекс.Маркет
 * URL: https://lukaoutdoor.com/yml.php
 * Обновляется в реальном времени из базы данных
 */
require __DIR__.'/includes/db.php';
$pdo = db();

$baseUrl = 'https://lukaoutdoor.com';

// Получаем все активные категории
$categories = $pdo->query("
    SELECT c.*, p.name parent_name
    FROM categories c
    LEFT JOIN categories p ON p.id = c.parent_id
    WHERE c.is_active = 1
    ORDER BY c.sort_order, c.id
")->fetchAll(PDO::FETCH_ASSOC);

// Получаем все активные товары с медиа
$products = $pdo->query("
    SELECT p.*, c.name category_name, c.slug category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1
    ORDER BY c.sort_order, p.sort_order, p.id
")->fetchAll(PDO::FETCH_ASSOC);

// Получаем дополнительные фото для товаров
$allMedia = $pdo->query("
    SELECT product_id, path FROM product_media
    WHERE type = 'image'
    ORDER BY sort_order, id
")->fetchAll(PDO::FETCH_ASSOC);

$mediaByProduct = [];
foreach ($allMedia as $m) {
    $mediaByProduct[$m['product_id']][] = $m['path'];
}

// Настройки магазина
try {
    $settings = $pdo->query("SELECT key, value FROM settings")->fetchAll(PDO::FETCH_KEY_PAIR);
} catch (Exception $e) {
    $settings = [];
}
$shopName  = $settings['site_title'] ?? 'LUKA OUTDOOR';
$shopPhone = $settings['phone'] ?? '';

header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: public, max-age=3600'); // кэш 1 час

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<!DOCTYPE yml_catalog SYSTEM "shops.dtd">
<yml_catalog date="<?=date('Y-m-d H:i')?>">
  <shop>
    <name><?=htmlspecialchars($shopName, ENT_XML1)?></name>
    <company>LUKA OUTDOOR</company>
    <url><?=$baseUrl?>/</url>

    <currencies>
      <currency id="RUR" rate="1"/>
    </currencies>

    <categories>
<?php foreach ($categories as $cat): ?>
      <category id="<?=(int)$cat['id']?>"<?=!empty($cat['parent_id']) ? ' parentId="'.(int)$cat['parent_id'].'"' : ''?>><?=htmlspecialchars($cat['name'], ENT_XML1)?></category>
<?php endforeach; ?>
    </categories>

    <delivery-options>
      <option cost="350" days="3-7"/>
    </delivery-options>

    <offers>
<?php foreach ($products as $p):
    $slug      = $p['slug'] ?: $p['id'];
    $productUrl = $baseUrl . '/product.php?slug=' . urlencode($slug);
    $price     = (int)$p['price'];
    $oldPrice  = !empty($p['compare_price']) && (int)$p['compare_price'] > $price ? (int)$p['compare_price'] : 0;

    // Собираем галерею
    $images = [];
    if (!empty($p['image'])) {
        $images[] = $p['image'];
    }
    foreach ($mediaByProduct[$p['id']] ?? [] as $path) {
        if (!in_array($path, $images)) $images[] = $path;
    }
    // Лимит — 10 фото в YML
    $images = array_slice($images, 0, 10);

    // Описание — очищаем HTML
    $description = strip_tags($p['description'] ?? '');
    $description = trim(preg_replace('/\s+/', ' ', $description));
    if (mb_strlen($description) > 3000) {
        $description = mb_substr($description, 0, 2997) . '...';
    }

    // Название — макс 150 символов
    $name = mb_substr($p['name'], 0, 150);
?>
      <offer id="<?=(int)$p['id']?>" available="true">
        <url><?=htmlspecialchars($productUrl, ENT_XML1)?></url>
        <name><?=htmlspecialchars($name, ENT_XML1)?></name>
        <price><?=$price?></price>
<?php if ($oldPrice > 0): ?>
        <oldprice><?=$oldPrice?></oldprice>
<?php endif; ?>
        <currencyId>RUR</currencyId>
        <categoryId><?=(int)$p['category_id']?></categoryId>
<?php foreach ($images as $img): ?>
        <picture><?=htmlspecialchars($baseUrl . '/' . $img, ENT_XML1)?></picture>
<?php endforeach; ?>
        <description><![CDATA[<?=htmlspecialchars($description, ENT_XML1)?>]]></description>
        <vendor>LUKA OUTDOOR</vendor>
        <vendorCode>LO-<?=(int)$p['id']?></vendorCode>
        <delivery>true</delivery>
        <pickup>false</pickup>
        <store>false</store>
        <manufacturer_warranty>false</manufacturer_warranty>
<?php if (!empty($p['weight_g']) && (int)$p['weight_g'] > 0): ?>
        <weight><?=round($p['weight_g'] / 1000, 2)?></weight>
<?php endif; ?>
<?php if (!empty($p['length_cm']) && (int)$p['length_cm'] > 0): ?>
        <dimensions><?=(int)$p['length_cm']?>/<?=(int)$p['width_cm']?>/<?=(int)$p['height_cm']?></dimensions>
<?php endif; ?>
        <param name="Материал">Сталь</param>
        <param name="Ручная работа">Да</param>
        <param name="Бренд">LUKA OUTDOOR</param>
      </offer>
<?php endforeach; ?>
    </offers>

  </shop>
</yml_catalog>
