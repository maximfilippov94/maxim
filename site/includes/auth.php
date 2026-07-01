<?php
// Secure session cookie settings (HTTPS-only when the site is actually served over HTTPS, no JS access)
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
    || (($_SERVER['SERVER_PORT'] ?? '') == 443);
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => $isHttps,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

// ВАЖНО: смените этот хеш! Сгенерировать: php -r "echo password_hash('YOUR_PASSWORD', PASSWORD_BCRYPT, ['cost'=>12]);"
const ADMIN_PASSWORD_HASH = '$2y$12$bFZdgLnXV4nctqOcvSETmOMp6XS1mYdwofDpTqx/Y2jOmTRCQQUcC';

function is_admin(): bool { return !empty($_SESSION['admin']); }
function require_admin(): void { if (!is_admin()) { header('Location: /admin'); exit; } }
?>
