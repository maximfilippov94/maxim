<?php
session_start();

// Пароль по умолчанию: admin123
// ВАЖНО: после загрузки на хостинг замените пароль и hash.
const ADMIN_PASSWORD_HASH = '$2y$12$bFZdgLnXV4nctqOcvSETmOMp6XS1mYdwofDpTqx/Y2jOmTRCQQUcC';

function is_admin(): bool { return !empty($_SESSION['admin']); }
function require_admin(): void { if (!is_admin()) { header('Location: /admin'); exit; } }
?>
