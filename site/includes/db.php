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
    $defaults=['site_title'=>'Volga Smoker BBQ — мясные полуфабрикаты слоу-смок оптом','site_description'=>'Брискет, рёбра, рваная говядина и свинина в дровяном смокере по техасской технологии. Оптовые поставки для ресторанов, кафе и фастфудов в Тольятти и Самаре.','phone'=>'+7 000 000-00-00','telegram'=>'','whatsapp'=>'','og_image'=>'assets/images/volga-logo-solid.png'];
    $st=$pdo->prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)'); foreach($defaults as $k=>$v) $st->execute([$k,$v]);
    $count = (int)$pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn();
    if ($count === 0) {
        $pdo->exec("INSERT INTO categories (name, slug, sort_order, seo_title, seo_description) VALUES
            ('Свинина', 'pork', 1, 'Свинина слоу-смок — Volga Smoker BBQ', 'Свиные рёбра, рваная свинина и рулька слоу-смок для ресторанов и кафе.'),
            ('Говядина', 'beef', 2, 'Говядина слоу-смок — Volga Smoker BBQ', 'Брискет, рваная говядина, рёбра и ростбиф слоу-смок для HoReCa.'),
            ('Курица и индейка', 'poultry', 3, 'Курица и индейка слоу-смок — Volga Smoker BBQ', 'Крылья, рваная курица и голень индейки слоу-смок для ресторанов и кафе.')");
        $catPork = (int)$pdo->query("SELECT id FROM categories WHERE slug='pork'")->fetchColumn();
        $catBeef = (int)$pdo->query("SELECT id FROM categories WHERE slug='beef'")->fetchColumn();
        $catPoultry = (int)$pdo->query("SELECT id FROM categories WHERE slug='poultry'")->fetchColumn();
        $stmt=$pdo->prepare("INSERT INTO products (category_id,name,slug,subtitle,description,price,image,specs,dimensions,materials,assembly,badge,sort_order,seo_title,seo_description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        // Свинина
        $stmt->execute([$catPork,'Рёбра свиные','ribs-pork','Свиные рёбра слоу-смок','Свиные рёбра с дымным ароматом дубовых дров, томлёные по техасской технологии. Готовы к разогреву и подаче.',1450,'assets/images/product-ribs-glazed.jpg','Свинина · вакуумная упаковка','Порция/вес уточняется','—','Разогреть и подавать','',1,'Свиные рёбра BBQ оптом — Volga Smoker BBQ','Свиные рёбра слоу-смок, оптовые поставки для ресторанов и кафе.']);
        $stmt->execute([$catPork,'Рваная свинина','pulled-pork','Pulled pork слоу-смок','Рваная свинина слоу-смок — универсальный ингредиент для бургеров, сэндвичей и пиццы.',1500,'assets/images/placeholder-meat.svg','Свинина · вакуумная упаковка','Порция/вес уточняется','—','Разогреть и использовать как начинку','',2,'Рваная свинина оптом — Volga Smoker BBQ','Pulled pork слоу-смок, ингредиент для бургеров и пиццы.']);
        $stmt->execute([$catPork,'Рулька','ham-hock','Свиная рулька слоу-смок','Свиная рулька, томлёная на дубовых дровах — подача целиком или как основа для блюда.',0,'assets/images/placeholder-meat.svg','Свинина · вакуумная упаковка','Порция/вес уточняется','—','Разогреть и подавать','',3,'Рулька BBQ оптом — Volga Smoker BBQ','Свиная рулька слоу-смок, оптовые поставки для ресторанов и кафе.']);
        // Говядина
        $stmt->execute([$catBeef,'Брискет травяной','brisket-grass-fed','Говяжья грудинка слоу-смок','Говяжья грудинка травяного откорма, томлёная на дубовых дровах по техасской технологии 12+ часов.',2800,'assets/images/product-brisket-pack.jpg','Говядина · вакуумная упаковка','Порция/вес уточняется','—','Разогреть и подавать','ХИТ',4,'Брискет травяной оптом — Volga Smoker BBQ','Говяжий брискет травяного откорма, слоу-смок, оптовые поставки для HoReCa.']);
        $stmt->execute([$catBeef,'Брискет зерновой','brisket-grain-fed','Говяжья грудинка слоу-смок','Говяжья грудинка зернового откорма, томлёная на дубовых дровах по техасской технологии 12+ часов.',2800,'assets/images/brisket-bark.jpg','Говядина · вакуумная упаковка','Порция/вес уточняется','—','Разогреть и подавать','',5,'Брискет зерновой оптом — Volga Smoker BBQ','Говяжий брискет зернового откорма, слоу-смок, оптовые поставки для HoReCa.']);
        $stmt->execute([$catBeef,'Рваная говядина','pulled-beef','Beef pulled слоу-смок','Рваная говядина — готовый ингредиент для бургеров, сэндвичей и пиццы. Томится на дубовых дровах до мягкой текстуры.',2000,'assets/images/product-pulled-beef-pack.jpg','Говядина · вакуумная упаковка','Порция/вес уточняется','—','Разогреть и использовать как начинку','',6,'Рваная говядина оптом — Volga Smoker BBQ','Pulled beef слоу-смок, ингредиент для бургеров и сэндвичей.']);
        $stmt->execute([$catBeef,'Ростбиф','roastbeef','Говяжий ростбиф слоу-смок','Ростбиф длительного томления на дубовых дровах — тонкая нарезка для сэндвичей и подачи холодным способом.',0,'assets/images/placeholder-meat.svg','Говядина · вакуумная упаковка','Порция/вес уточняется','—','Разогреть или подавать охлаждённым','',7,'Ростбиф BBQ оптом — Volga Smoker BBQ','Говяжий ростбиф слоу-смок, оптовые поставки для ресторанов и кафе.']);
        $stmt->execute([$catBeef,'Рёбра говяжьи','ribs-beef','Говяжьи рёбра слоу-смок','Говяжьи рёбра длительного томления на живом огне, техасский стиль копчения.',2500,'assets/images/placeholder-meat.svg','Говядина · вакуумная упаковка','Порция/вес уточняется','—','Разогреть и подавать','',8,'Говяжьи рёбра BBQ оптом — Volga Smoker BBQ','Говяжьи рёбра слоу-смок, оптовые поставки для HoReCa.']);
        $stmt->execute([$catBeef,'Шея говяжья','beef-neck','Говяжья шея слоу-смок','Говяжья шея, томлёная на дубовых дровах — насыщенный вкус для основных блюд и начинок.',0,'assets/images/placeholder-meat.svg','Говядина · вакуумная упаковка','Порция/вес уточняется','—','Разогреть и подавать','',9,'Шея говяжья BBQ оптом — Volga Smoker BBQ','Говяжья шея слоу-смок, оптовые поставки для ресторанов и кафе.']);
        // Курица и индейка
        $stmt->execute([$catPoultry,'Крылья куриные','chicken-wings','Куриные крылья слоу-смок','Куриные крылья с дымным ароматом дубовых дров — готовы к разогреву и подаче.',0,'assets/images/placeholder-meat.svg','Курица · вакуумная упаковка','Порция/вес уточняется','—','Разогреть и подавать','',10,'Куриные крылья BBQ оптом — Volga Smoker BBQ','Куриные крылья слоу-смок, оптовые поставки для ресторанов и кафе.']);
        $stmt->execute([$catPoultry,'Рваная курица','pulled-chicken','Pulled chicken слоу-смок','Рваная курица слоу-смок — лёгкий ингредиент для бургеров, сэндвичей и пиццы.',0,'assets/images/placeholder-meat.svg','Курица · вакуумная упаковка','Порция/вес уточняется','—','Разогреть и использовать как начинку','',11,'Рваная курица оптом — Volga Smoker BBQ','Pulled chicken слоу-смок, ингредиент для бургеров и пиццы.']);
        $stmt->execute([$catPoultry,'Голень индейки','turkey-drumstick','Голень индейки слоу-смок','Голень индейки, томлёная на дубовых дровах — самостоятельная подача или ингредиент для блюда.',0,'assets/images/placeholder-meat.svg','Индейка · вакуумная упаковка','Порция/вес уточняется','—','Разогреть и подавать','',12,'Голень индейки BBQ оптом — Volga Smoker BBQ','Голень индейки слоу-смок, оптовые поставки для ресторанов и кафе.']);
    }

    $mediaCount = (int)$pdo->query('SELECT COUNT(*) FROM product_media')->fetchColumn();
    if($mediaCount === 0){
        $pidStmt=$pdo->prepare('SELECT id FROM products WHERE slug=?');
        $insMedia=$pdo->prepare('INSERT INTO product_media(product_id,path,type,sort_order) VALUES(?,?,?,?)');
        $slugs=['ribs-pork','pulled-pork','ham-hock','brisket-grass-fed','brisket-grain-fed','pulled-beef','roastbeef','ribs-beef','beef-neck','chicken-wings','pulled-chicken','turkey-drumstick'];
        foreach($slugs as $slug){
            $pidStmt->execute([$slug]); $pid=(int)$pidStmt->fetchColumn(); if(!$pid) continue;
            $insMedia->execute([$pid,'assets/images/placeholder-meat.svg','image',10]);
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
