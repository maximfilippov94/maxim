<?php
/**
 * Одноразовый веб-установщик (для хостинга без SSH).
 * Открыть в браузере: https://ваш-домен/setup.php?confirm=1
 * Выполняет миграции + наполнение базы + тестовые аккаунты.
 *
 * !!! ПОСЛЕ УСПЕШНОЙ УСТАНОВКИ УДАЛИТЕ ЭТОТ ФАЙЛ (public/setup.php) !!!
 */
declare(strict_types=1);
header('Content-Type: text/html; charset=utf-8');

$root = dirname(__DIR__);

echo '<!doctype html><meta charset="utf-8"><title>NutriMenu — установка</title>';
echo '<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#0f172a}'
   . 'pre{background:#f1f5f6;padding:14px;border-radius:10px;overflow:auto;font-size:13px;line-height:1.5}'
   . '.ok{color:#15803d}.err{color:#b91c1c}.warn{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:14px;border-radius:10px}'
   . 'a.btn{display:inline-block;background:#22C55E;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:14px}</style>';
echo '<h1>NutriMenu — установка</h1>';

// Проверка версии PHP.
if (PHP_VERSION_ID < 80000) {
    echo '<p class="err"><b>PHP ' . PHP_VERSION . '.</b> Нужен PHP 8.0 или новее. '
       . 'Переключите версию PHP в панели хостинга и обновите страницу.</p>';
    exit;
}
foreach (['pdo_sqlite'] as $ext) {
    if (!extension_loaded($ext)) {
        echo '<p class="err">Не подключено расширение PHP: <b>' . $ext . '</b>. Включите его в панели хостинга.</p>';
        exit;
    }
}

if (($_GET['confirm'] ?? '') === '') {
    echo '<div class="warn">Установщик создаст базу данных SQLite, наполнит её блюдами и тестовыми '
       . 'аккаунтами. Запускать один раз.</div>';
    echo '<p>PHP ' . PHP_VERSION . ' · pdo_sqlite ✓</p>';
    echo '<a class="btn" href="?confirm=1">Запустить установку</a>';
    exit;
}

echo '<pre>';
try {
    require_once $root . '/src/Database.php';
    $config = require $root . '/config.php';

    // Проверка прав на запись в каталог БД.
    $dir = dirname($config['db_path']);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    if (!is_writable($dir)) {
        echo "</pre><p class=\"err\">Каталог <b>" . htmlspecialchars($dir) . "</b> недоступен для записи. "
           . "Выставьте права 775 (или 777) на папки <code>data/</code> и <code>public/uploads/</code>.</p>";
        exit;
    }

    ob_start();
    require $root . '/bin/migrate.php';    // миграции
    require $root . '/bin/seed.php';       // база блюд
    require $root . '/bin/seed_test.php';  // тестовые аккаунты + данные
    echo htmlspecialchars(ob_get_clean());

    echo "</pre>";
    echo '<p class="ok"><b>Готово!</b></p>';
    echo '<div class="warn"><b>Теперь удалите файл <code>public/setup.php</code></b> — он больше не нужен и не должен оставаться на проде.</div>';
    echo '<a class="btn" href="/">Открыть сайт</a>';
} catch (\Throwable $e) {
    echo htmlspecialchars($e->getMessage());
    echo "</pre><p class=\"err\">Ошибка установки: " . htmlspecialchars($e->getMessage()) . '</p>';
}
