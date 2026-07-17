<?php
/**
 * download_supplier_images.php — Фанера63.рф
 *
 * Разовый скрипт: скачивает все фото товаров, которые сейчас хранятся как
 * прямые ссылки на сайт поставщика (samara.timberia.ru), сохраняет их
 * локально в assets/uploads/timberia/ и переписывает пути в БД на локальные.
 *
 * Запуск: один раз открыть в браузере https://ваш-домен/download_supplier_images.php
 * либо через SSH: php download_supplier_images.php
 *
 * После успешного запуска скрипт можно удалить с сервера.
 */

require __DIR__.'/includes/db.php';
$pdo = db();

$destDir = __DIR__.'/assets/uploads/timberia';
if (!is_dir($destDir)) mkdir($destDir, 0775, true);

function fetch_binary(string $url): ?string {
    $ctx = stream_context_create([
        'http' => [
            'method'  => 'GET',
            'header'  => "User-Agent: Mozilla/5.0 (compatible; Fanera63Bot/1.0)\r\n",
            'timeout' => 20,
        ],
    ]);
    $data = @file_get_contents($url, false, $ctx);
    if ($data === false && function_exists('curl_init')) {
        // fallback на cURL, если allow_url_fopen выключен
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; Fanera63Bot/1.0)',
        ]);
        $data = curl_exec($ch);
        if ($data === false) $data = null;
        curl_close($ch);
    }
    return $data ?: null;
}

// Собираем все уникальные внешние ссылки на фото из products, product_media и categories
$urls = [];
foreach ($pdo->query("SELECT DISTINCT image FROM products WHERE image LIKE 'http%'")->fetchAll(PDO::FETCH_COLUMN) as $u) $urls[$u] = true;
foreach ($pdo->query("SELECT DISTINCT path FROM product_media WHERE path LIKE 'http%'")->fetchAll(PDO::FETCH_COLUMN) as $u) $urls[$u] = true;
foreach ($pdo->query("SELECT DISTINCT image FROM categories WHERE image LIKE 'http%'")->fetchAll(PDO::FETCH_COLUMN) as $u) $urls[$u] = true;
$urls = array_keys($urls);

echo "Найдено уникальных внешних ссылок на фото: ".count($urls)."\n";

$map = []; // старый url => новый локальный путь
$ok = 0; $fail = 0;

foreach ($urls as $url) {
    $ext = pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION) ?: 'jpg';
    $filename = 'timberia-'.substr(md5($url), 0, 12).'.'.$ext;
    $localPath = 'assets/uploads/timberia/'.$filename;
    $fullPath  = __DIR__.'/'.$localPath;

    if (!file_exists($fullPath)) {
        $data = fetch_binary($url);
        if ($data === null) {
            echo "  [ОШИБКА] Не удалось скачать: $url\n";
            $fail++;
            continue;
        }
        file_put_contents($fullPath, $data);
    }
    $map[$url] = $localPath;
    $ok++;
    echo "  [OK] $url -> $localPath\n";
}

// Переписываем пути в БД
$updProd  = $pdo->prepare("UPDATE products SET image=? WHERE image=?");
$updMedia = $pdo->prepare("UPDATE product_media SET path=? WHERE path=?");
$updCat   = $pdo->prepare("UPDATE categories SET image=? WHERE image=?");
$totalProdUpdated = 0; $totalMediaUpdated = 0; $totalCatUpdated = 0;
foreach ($map as $old => $new) {
    $updProd->execute([$new, $old]);
    $totalProdUpdated += $updProd->rowCount();
    $updMedia->execute([$new, $old]);
    $totalMediaUpdated += $updMedia->rowCount();
    $updCat->execute([$new, $old]);
    $totalCatUpdated += $updCat->rowCount();
}

echo "\nГотово.\n";
echo "Скачано файлов: $ok, ошибок: $fail\n";
echo "Обновлено строк в products: $totalProdUpdated\n";
echo "Обновлено строк в product_media: $totalMediaUpdated\n";
echo "Обновлено строк в categories: $totalCatUpdated\n";
echo "\nПосле проверки результата этот файл (download_supplier_images.php) можно удалить с сервера.\n";
