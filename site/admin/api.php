<?php
/**
 * admin/api.php — LUKA OUTDOOR
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (empty($_SESSION['admin'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Unauthorized', 'session' => array_keys($_SESSION)]);
    exit;
}

require __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');

$pdo    = db();
$action = trim($_POST['action'] ?? $_GET['action'] ?? '');
$id     = (int)($_POST['id'] ?? $_GET['id'] ?? 0);

switch ($action) {

    case 'delete_block':
        if (!$id) { echo json_encode(['error' => 'No ID']); exit; }
        $pdo->prepare('DELETE FROM page_blocks WHERE id=?')->execute([$id]);
        echo json_encode(['ok' => true, 'deleted' => $id]);
        break;

    case 'toggle_block':
        if (!$id) { echo json_encode(['error' => 'No ID']); exit; }
        $pdo->prepare('UPDATE page_blocks SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=?')->execute([$id]);
        $row = $pdo->prepare('SELECT is_active FROM page_blocks WHERE id=?');
        $row->execute([$id]);
        echo json_encode(['ok' => true, 'is_active' => (int)$row->fetchColumn()]);
        break;

    case 'duplicate_block':
        if (!$id) { echo json_encode(['error' => 'No ID']); exit; }
        $st = $pdo->prepare('SELECT * FROM page_blocks WHERE id=?');
        $st->execute([$id]);
        $b = $st->fetch(PDO::FETCH_ASSOC);
        if ($b) {
            $pdo->prepare('INSERT INTO page_blocks(type,label,eyebrow,title,subtitle,text,image,cta_text,cta_link,extra,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
                ->execute([$b['type'], $b['label'].' — копия', $b['eyebrow'], $b['title'], $b['subtitle'], $b['text'], $b['image'], $b['cta_text'], $b['cta_link'], $b['extra'], (int)$b['sort_order']+1, 0]);
            echo json_encode(['ok' => true]);
        } else {
            echo json_encode(['error' => 'Block not found']);
        }
        break;

    case 'client_history':
        $phone = trim($_POST['phone'] ?? '');
        if (!$phone) { echo json_encode(['orders' => []]); exit; }
        $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
        $last10 = substr($cleanPhone, -10);
        $all = $pdo->query("SELECT o.id, o.status, o.total, o.created_at, o.phone,
            GROUP_CONCAT(i.product_name || ' x' || i.qty, ', ') as items_short
            FROM orders o
            LEFT JOIN order_items i ON i.order_id = o.id
            GROUP BY o.id
            ORDER BY o.id DESC
            LIMIT 200")->fetchAll(PDO::FETCH_ASSOC);
        $matched = [];
        foreach ($all as $o) {
            $cp = preg_replace('/[^0-9]/', '', $o['phone'] ?? '');
            if (substr($cp, -10) === $last10) {
                $matched[] = [
                    'id'          => (int)$o['id'],
                    'status'      => $o['status'],
                    'total'       => (int)$o['total'],
                    'created_at'  => $o['created_at'],
                    'items_short' => $o['items_short'] ?? '',
                ];
            }
        }
        echo json_encode(['orders' => $matched]);
        break;

    case 'toggle_category':
        if (!$id) { echo json_encode(['error' => 'No ID']); exit; }
        $pdo->prepare('UPDATE categories SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=?')->execute([$id]);
        $row = $pdo->prepare('SELECT is_active FROM categories WHERE id=?');
        $row->execute([$id]);
        echo json_encode(['ok' => true, 'is_active' => (int)$row->fetchColumn()]);
        break;

    case 'approve_review':
        if (!$id) { echo json_encode(['error' => 'No ID']); exit; }
        $pdo->prepare('UPDATE reviews SET is_active=1 WHERE id=?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    case 'delete_review':
        if (!$id) { echo json_encode(['error' => 'No ID']); exit; }
        $pdo->prepare('DELETE FROM reviews WHERE id=?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        echo json_encode([
            'error'   => 'Unknown action: ' . $action,
            'post'    => $_POST,
            'method'  => $_SERVER['REQUEST_METHOD'],
            'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'none',
        ]);
}
