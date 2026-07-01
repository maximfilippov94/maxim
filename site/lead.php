<?php
/**
 * lead.php — приём заявок с лендинга Volga Smoker BBQ
 * Лёгкий эндпоинт без корзины/checkout: сохраняет заявку в таблицу orders.
 */
require __DIR__.'/includes/db.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['ok' => false, 'message' => 'Метод не поддерживается']));
}

$name  = trim(mb_substr($_POST['name'] ?? '', 0, 100));
$phone = trim(mb_substr($_POST['phone'] ?? '', 0, 40));
$comment = trim(mb_substr($_POST['comment'] ?? '', 0, 500));
$consent = !empty($_POST['consent']);

if ($name === '' || $phone === '' || !$consent) {
    http_response_code(422);
    exit(json_encode(['ok' => false, 'message' => 'Укажите имя, телефон и согласие на обработку данных']));
}

if (!preg_match('~^[+0-9()\s\-]{5,40}$~u', $phone)) {
    http_response_code(422);
    exit(json_encode(['ok' => false, 'message' => 'Проверьте номер телефона']));
}

$pdo = db();
$st = $pdo->prepare("INSERT INTO orders (customer_name, phone, comment, source, status) VALUES (?, ?, ?, 'landing', 'new')");
$st->execute([$name, $phone, $comment]);

echo json_encode(['ok' => true, 'message' => 'Заявка отправлена, мы свяжемся с вами в ближайшее время']);
