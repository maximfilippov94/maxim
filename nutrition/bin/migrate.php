<?php
declare(strict_types=1);

/**
 * Запуск миграций: php bin/migrate.php
 * Применяет нумерованные .sql-файлы из migrations/ по порядку,
 * фиксирует применённые в таблице schema_migrations.
 */

$root = dirname(__DIR__);
require_once $root . '/src/Database.php';

$config = require $root . '/config.php';

use App\Database;

$pdo = Database::init($config['db_path']);

$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
)');

$applied = array_column(
    Database::all('SELECT version FROM schema_migrations'),
    'version'
);

$files = glob($config['migrations_dir'] . '/*.sql');
sort($files);

$count = 0;
foreach ($files as $file) {
    $version = basename($file);
    if (in_array($version, $applied, true)) {
        continue;
    }
    $sql = file_get_contents($file);
    echo "Применяю $version ... ";
    Database::transaction(function () use ($pdo, $sql, $version) {
        $pdo->exec($sql);
        Database::exec(
            'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
            [$version, gmdate('c')]
        );
    });
    echo "ok\n";
    $count++;
}

echo $count === 0 ? "Новых миграций нет.\n" : "Применено миграций: $count\n";
