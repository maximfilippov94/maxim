<?php
require __DIR__.'/../includes/db.php';
require __DIR__.'/../includes/auth.php';
if(!is_admin()){ http_response_code(403); echo '[]'; exit; }
header('Content-Type: application/json; charset=utf-8');
$pid = (int)($_GET['pid'] ?? 0);
if(!$pid){ echo '[]'; exit; }
$pdo = db();
$blocks = $pdo->prepare("SELECT * FROM product_blocks WHERE product_id=? ORDER BY sort_order,id");
$blocks->execute([$pid]);
echo json_encode($blocks->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
