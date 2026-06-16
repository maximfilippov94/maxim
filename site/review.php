<?php
/**
 * review.php — LUKA OUTDOOR
 * Приём и сохранение отзывов
 */
require __DIR__.'/includes/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db();

    // Создаём таблицу если нет
    $pdo->exec("CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        author TEXT NOT NULL,
        rating INTEGER DEFAULT 5,
        text TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )");

    $productId = (int)($_POST['product_id'] ?? 0);
    $author    = trim($_POST['author'] ?? '');
    $rating    = max(1, min(5, (int)($_POST['rating'] ?? 5)));
    $text      = trim($_POST['text'] ?? '');

    if (!$productId || !$author || !$text) {
        echo json_encode(['ok'=>false,'message'=>'Заполните все поля']);
        exit;
    }
    if (mb_strlen($author) > 100) {
        echo json_encode(['ok'=>false,'message'=>'Слишком длинное имя']);
        exit;
    }
    if (mb_strlen($text) < 10) {
        echo json_encode(['ok'=>false,'message'=>'Отзыв слишком короткий']);
        exit;
    }
    if (mb_strlen($text) > 2000) {
        echo json_encode(['ok'=>false,'message'=>'Отзыв слишком длинный (макс. 2000 символов)']);
        exit;
    }

    // Проверяем что товар существует
    $st = $pdo->prepare('SELECT id FROM products WHERE id=? AND is_active=1');
    $st->execute([$productId]);
    if (!$st->fetchColumn()) {
        echo json_encode(['ok'=>false,'message'=>'Товар не найден']);
        exit;
    }

    // Сохраняем (is_active=0 — ждёт модерации)
    $pdo->prepare('INSERT INTO reviews(product_id,author,rating,text,is_active) VALUES(?,?,?,?,0)')
        ->execute([$productId, $author, $rating, $text]);

    echo json_encode([
        'ok'      => true,
        'message' => 'Спасибо за отзыв! Он появится после проверки.'
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    echo json_encode(['ok'=>false,'message'=>'Ошибка сервера']);
}
