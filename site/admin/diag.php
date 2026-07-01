<?php
require __DIR__.'/../includes/db.php';
require __DIR__.'/../includes/auth.php';
if (!is_admin()) { header('Location: /admin'); exit; }

$uploadsDir = __DIR__.'/../assets/uploads';
$dataDir = __DIR__.'/../data';
$rows = [
    'PHP версия' => PHP_VERSION,
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'post_max_size' => ini_get('post_max_size'),
    'memory_limit' => ini_get('memory_limit'),
    'max_execution_time' => ini_get('max_execution_time').' сек',
    'assets/uploads доступна для записи' => is_dir($uploadsDir) ? (is_writable($uploadsDir) ? 'да' : 'НЕТ — нужны права на запись') : 'папки нет — будет создана при первой загрузке',
    'data доступна для записи' => is_dir($dataDir) ? (is_writable($dataDir) ? 'да' : 'НЕТ — нужны права на запись') : 'папки нет',
];
?>
<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><title>Диагностика сервера</title></head>
<body style="font-family:monospace;background:#111;color:#eee;padding:32px">
<h1>Диагностика сервера</h1>
<table style="border-collapse:collapse">
<?php foreach ($rows as $k => $v): ?>
<tr><td style="padding:6px 16px 6px 0;color:#c9792b"><?=htmlspecialchars($k)?></td><td><?=htmlspecialchars((string)$v)?></td></tr>
<?php endforeach; ?>
</table>
<p style="color:#999;max-width:600px">Если upload_max_filesize или post_max_size меньше 8M — большие фото не будут загружаться в товары. Обычно это можно поднять в панели хостинга (раздел «PHP» / «Настройки PHP» для домена).</p>
<p><a href="/admin" style="color:#c9792b">&larr; Назад в админку</a></p>
</body>
</html>
