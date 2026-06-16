<?php
require __DIR__.'/includes/db.php';
header('Content-Type: application/json; charset=utf-8');
try{
    $quick = !empty($_POST['quick_request']);
    $name = trim($_POST['customer_name'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    $city = trim($_POST['city'] ?? $_POST['address'] ?? '');
    $delivery = trim($_POST['delivery_method'] ?? 'После согласования');
    $payment = trim($_POST['payment_method'] ?? 'После подтверждения');
    $comment = trim($_POST['comment'] ?? '');
    if(!$name || !$phone) throw new Exception('Заполните имя и телефон');
    $cart = json_decode($_POST['cart'] ?? '[]', true);
    if(!$quick && !$cart) throw new Exception('Корзина пустая');
    if(!$quick && !$city) throw new Exception('Укажите город доставки');
    $total = 0;
    if(is_array($cart)){ foreach($cart as $i){ $total += ((int)($i['price'] ?? 0))*max(1,(int)($i['qty'] ?? 1)); } }
    $pdo = db(); $pdo->beginTransaction();
    $source = $quick ? 'quick_request' : 'cart_checkout';
    $finalComment = $quick ? ('Быстрая заявка из блока «Оставить заявку». '.$comment) : $comment;
    $stmt=$pdo->prepare('INSERT INTO orders (customer_name,phone,email,address,delivery_method,payment_method,comment,source,total,status) VALUES (?,?,?,?,?,?,?,?,?,?)');
    $stmt->execute([$name,$phone,'',$city ?: 'Не указан',$delivery,$payment,$finalComment,$source,$total,'new']);
    $orderId=(int)$pdo->lastInsertId();
    $item=$pdo->prepare('INSERT INTO order_items (order_id,product_id,product_name,price,qty) VALUES (?,?,?,?,?)');
    if($quick){ $item->execute([$orderId,null,'Быстрая заявка / подбор чаши',0,1]); }
    else { foreach($cart as $i){ $item->execute([$orderId,is_numeric($i['id'] ?? null)?(int)$i['id']:null,$i['name'] ?? 'Товар',(int)($i['price'] ?? 0),max(1,(int)($i['qty'] ?? 1))]); } }
    $pdo->commit();
    echo json_encode(['ok'=>true,'message'=>'Заявка отправлена. Мы свяжемся с вами в ближайшее время.'], JSON_UNESCAPED_UNICODE);
}catch(Throwable $e){ if(isset($pdo) && $pdo->inTransaction()) $pdo->rollBack(); echo json_encode(['ok'=>false,'message'=>$e->getMessage()], JSON_UNESCAPED_UNICODE); }
?>
