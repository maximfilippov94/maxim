<?php
// Security headers — отправляются на каждой странице
if (!headers_sent()) {
    header('X-Frame-Options: SAMEORIGIN');
    header('X-Content-Type-Options: nosniff');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}
function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $dir = __DIR__ . '/../data';
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $pdo = new PDO('sqlite:' . $dir . '/volga_fire_base.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA foreign_keys = ON');
    init_db($pdo);
    return $pdo;
}
function add_col(PDO $pdo, string $table, string $col, string $def): void {
    $cols=$pdo->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_ASSOC);
    foreach($cols as $c){ if($c['name']===$col) return; }
    $pdo->exec("ALTER TABLE $table ADD COLUMN $col $def");
}
function init_db(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,sort_order INTEGER DEFAULT 0,is_active INTEGER DEFAULT 1,seo_title TEXT DEFAULT '',seo_description TEXT DEFAULT '')");
    add_col($pdo,'categories','seo_title',"TEXT DEFAULT ''"); add_col($pdo,'categories','seo_description',"TEXT DEFAULT ''");
    $pdo->exec("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT,category_id INTEGER,name TEXT NOT NULL,slug TEXT DEFAULT '',subtitle TEXT DEFAULT '',description TEXT DEFAULT '',price INTEGER NOT NULL DEFAULT 0,old_price INTEGER DEFAULT 0,image TEXT DEFAULT '',video TEXT DEFAULT '',specs TEXT DEFAULT '',dimensions TEXT DEFAULT '',materials TEXT DEFAULT '',assembly TEXT DEFAULT '',badge TEXT DEFAULT '',seo_title TEXT DEFAULT '',seo_description TEXT DEFAULT '',is_active INTEGER DEFAULT 1,sort_order INTEGER DEFAULT 0,FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL)");
    foreach(['slug'=>"TEXT DEFAULT ''",'video'=>"TEXT DEFAULT ''",'dimensions'=>"TEXT DEFAULT ''",'materials'=>"TEXT DEFAULT ''",'assembly'=>"TEXT DEFAULT ''",'seo_title'=>"TEXT DEFAULT ''",'seo_description'=>"TEXT DEFAULT ''"] as $c=>$d) add_col($pdo,'products',$c,$d);
    $pdo->exec("CREATE TABLE IF NOT EXISTS product_media (id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,path TEXT NOT NULL,type TEXT DEFAULT 'image',sort_order INTEGER DEFAULT 0,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE)");
  $pdo->exec("CREATE TABLE IF NOT EXISTS product_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    title TEXT DEFAULT '',
    subtitle TEXT DEFAULT '',
    text TEXT DEFAULT '',
    image TEXT DEFAULT '',
    extra TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 10,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT,customer_name TEXT NOT NULL,phone TEXT NOT NULL,telegram TEXT DEFAULT '',email TEXT DEFAULT '',address TEXT DEFAULT '',delivery_method TEXT DEFAULT '',payment_method TEXT DEFAULT '',comment TEXT DEFAULT '',source TEXT DEFAULT 'site',total INTEGER DEFAULT 0,status TEXT DEFAULT 'new',manager_note TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
    foreach(['email'=>"TEXT DEFAULT ''",'source'=>"TEXT DEFAULT 'site'",'manager_note'=>"TEXT DEFAULT ''"] as $c=>$d) add_col($pdo,'orders',$c,$d);
    $pdo->exec("CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,product_id INTEGER,product_name TEXT NOT NULL,price INTEGER NOT NULL,qty INTEGER NOT NULL DEFAULT 1,FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE)");

    $pdo->exec("CREATE TABLE IF NOT EXISTS page_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT DEFAULT 'text_image',code TEXT DEFAULT '',label TEXT DEFAULT '',eyebrow TEXT DEFAULT '',title TEXT DEFAULT '',subtitle TEXT DEFAULT '',text TEXT DEFAULT '',image TEXT DEFAULT '',cta_text TEXT DEFAULT '',cta_link TEXT DEFAULT '',extra TEXT DEFAULT '',sort_order INTEGER DEFAULT 0,is_active INTEGER DEFAULT 1)");
    add_col($pdo,'page_blocks','code',"TEXT DEFAULT ''");
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT DEFAULT '')");
    $defaults=['site_title'=>'Фанера63.рф — фанера и ОСБ в Тольятти с доставкой','site_description'=>'Фанера ФК, ФСФ, ламинированная фанера и ОСБ-плиты в Тольятти. Опт и розница, доставка по городу и области.','phone'=>'8 800 123-45-67','telegram'=>'','whatsapp'=>'','og_image'=>'assets/images/hero.webp'];
    $st=$pdo->prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)'); foreach($defaults as $k=>$v) $st->execute([$k,$v]);
    $count = (int)$pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn();
    if ($count === 0) {
        $pdo->exec("INSERT INTO categories (name, slug, sort_order, seo_title, seo_description) VALUES
            ('ОСБ (OSB плиты)', 'osb', 1, 'ОСБ плиты Фанера63.рф', 'Ориентированно-стружечные плиты OSB-3 разных толщин и производителей.'),
            ('Фанера', 'fanera', 2, 'Фанера Фанера63.рф', 'Фанера ФК, ФСФ и ламинированная — берёза и хвоя, разные толщины и размеры.')");
        $catOsb = (int)$pdo->query("SELECT id FROM categories WHERE slug='osb'")->fetchColumn();
        $catFanera = (int)$pdo->query("SELECT id FROM categories WHERE slug='fanera'")->fetchColumn();
        $stmt=$pdo->prepare("INSERT INTO products (category_id,name,slug,subtitle,description,price,image,specs,dimensions,materials,assembly,badge,sort_order,seo_title,seo_description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([$catOsb,'Плита OSB-3 9 мм 2500х1250 мм','osb-3-9mm-2500x1250','ОСБ плита','Ориентированно-стружечная плита OSB-3, влагостойкая, для стен, пола и настила по лагам.',900,'assets/images/hero.webp','Толщина 9 мм · размер 2500х1250 мм','2500х1250 мм','OSB-3','','ХИТ',1,'Плита OSB-3 9 мм — Фанера63.рф','Влагостойкая ОСБ-плита 9 мм с доставкой в Тольятти.']);
        $stmt->execute([$catFanera,'Фанера ФК 10 мм 1525х1525 мм','fanera-fk-10mm-1525x1525','Фанера ФК','Березовая фанера ФК на карбамидном клее, для мебели и внутренних работ.',950,'assets/images/hero.webp','Толщина 10 мм · размер 1525х1525 мм','1525х1525 мм','ФК, береза','','',2,'Фанера ФК 10 мм — Фанера63.рф','Березовая фанера ФК 10 мм с доставкой в Тольятти.']);
    }

    $mediaCount = (int)$pdo->query('SELECT COUNT(*) FROM product_media')->fetchColumn();
    if($mediaCount === 0){
        $mediaSeed = [
            'volga-fire-base' => ['assets/images/product-pro.webp','assets/images/lifestyle.webp'],
            'volga-fire-base-pro' => ['assets/images/hero.webp','assets/images/lifestyle.webp'],
            'volga-fire-base-max' => ['assets/images/product-pro.webp','assets/images/hero.webp'],
            'grill-grate' => ['assets/images/hero.webp','assets/images/lifestyle.webp'],
            'carry-bag' => ['assets/images/product-pro.webp','assets/images/lifestyle.webp'],
            'leather-gloves' => ['assets/images/hero.webp','assets/images/product-pro.webp']
        ];
        $pidStmt=$pdo->prepare('SELECT id FROM products WHERE slug=?');
        $insMedia=$pdo->prepare('INSERT INTO product_media(product_id,path,type,sort_order) VALUES(?,?,?,?)');
        foreach($mediaSeed as $slug=>$paths){
            $pidStmt->execute([$slug]); $pid=(int)$pidStmt->fetchColumn(); if(!$pid) continue;
            $sort=10; foreach($paths as $path){ $insMedia->execute([$pid,$path,'image',$sort]); $sort+=10; }
        }
    }
}
function setting(string $key, string $fallback=''){ $pdo=db(); $st=$pdo->prepare('SELECT value FROM settings WHERE key=?'); $st->execute([$key]); $v=$st->fetchColumn(); return $v!==false?$v:$fallback; }
function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function send_security_headers(): void {
    header('X-Frame-Options: SAMEORIGIN');
    header('X-Content-Type-Options: nosniff');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}
function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}
function csrf_check(): void {
    $token = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
        http_response_code(403);
        exit(json_encode(['ok' => false, 'message' => 'Недопустимый запрос']));
    }
}
function money($n){ return number_format((int)$n,0,' ',' ') . ' ₽'; }
function slugify($s){$s=trim(mb_strtolower($s));$map=['а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh','з'=>'z','и'=>'i','й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ф'=>'f','х'=>'h','ц'=>'c','ч'=>'ch','ш'=>'sh','щ'=>'sch','ъ'=>'','ы'=>'y','ь'=>'','э'=>'e','ю'=>'yu','я'=>'ya'];$s=strtr($s,$map);$s=preg_replace('~[^a-z0-9]+~','-',$s);return trim($s,'-') ?: 'item';}
?>
