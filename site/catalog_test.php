<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "<pre>";

// Step 1: DB connection
echo "1. Connecting to DB...\n";
require __DIR__.'/includes/db.php';
echo "OK\n";

// Step 2: PDO
echo "2. Getting PDO...\n";
$pdo = db();
echo "OK\n";

// Step 3: Tables
echo "3. Tables in DB:\n";
$tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
print_r($tables);

// Step 4: Categories
echo "4. Categories:\n";
$cats = $pdo->query("SELECT id, name FROM categories WHERE is_active=1")->fetchAll(PDO::FETCH_ASSOC);
print_r($cats);

// Step 5: Products
echo "5. Products count: ";
echo $pdo->query("SELECT COUNT(*) FROM products WHERE is_active=1")->fetchColumn();
echo "\n";

echo "\nAll OK! The issue is elsewhere.\n";
echo "</pre>";
