<?php
require __DIR__.'/../includes/db.php'; require __DIR__.'/../includes/auth.php';
$pdo=db();
// Миграция products — новые поля
foreach(['cost_price INTEGER DEFAULT 0','weight_g INTEGER DEFAULT 12000','length_cm INTEGER DEFAULT 60','width_cm INTEGER DEFAULT 60','height_cm INTEGER DEFAULT 40','related_ids TEXT DEFAULT ""'] as $_col){
  try{$pdo->exec("ALTER TABLE products ADD COLUMN $_col");}catch(Exception $e){}
}
// Таблицы CMS
try {
  $pdo->exec("CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT '', slug TEXT NOT NULL, seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '', is_active INTEGER DEFAULT 1, show_in_nav INTEGER DEFAULT 0, nav_label TEXT DEFAULT '', sort_order INTEGER DEFAULT 10, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  $pdo->exec("CREATE TABLE IF NOT EXISTS page_sections (id INTEGER PRIMARY KEY AUTOINCREMENT, page_id INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'text', eyebrow TEXT DEFAULT '', title TEXT DEFAULT '', subtitle TEXT DEFAULT '', text TEXT DEFAULT '', image TEXT DEFAULT '', cta_text TEXT DEFAULT '', cta_link TEXT DEFAULT '', extra TEXT DEFAULT '', sort_order INTEGER DEFAULT 10, is_active INTEGER DEFAULT 1)");
  $pdo->exec("CREATE TABLE IF NOT EXISTS nav_items (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, url TEXT NOT NULL, sort_order INTEGER DEFAULT 10, is_active INTEGER DEFAULT 1, open_new_tab INTEGER DEFAULT 0)");
  $pdo->exec("CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, author TEXT NOT NULL, rating INTEGER DEFAULT 5, text TEXT NOT NULL, is_active INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
} catch(Exception $e){}
try{$pdo->exec("ALTER TABLE categories ADD COLUMN parent_id INTEGER DEFAULT NULL");}catch(Exception $e){}
try{$pdo->exec("ALTER TABLE categories ADD COLUMN image TEXT DEFAULT ''");}catch(Exception $e){}

// ── LOGIN ──────────────────────────────────────────────────────────────
if(!is_admin()){
  $err=''; if($_SERVER['REQUEST_METHOD']==='POST'){ $pass=$_POST['password']??''; if(password_verify($pass, ADMIN_PASSWORD_HASH)){$_SESSION['admin']=true; header('Location:/admin'); exit;} else $err='Неверный пароль'; }
  ?><!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход — LUKA OUTDOOR</title><link rel="stylesheet" href="admin.css"></head><body class="loginPage"><form method="post" class="loginBox"><b>LUKA OUTDOOR / CMS</b><h1>Вход в кабинет</h1><?php if($err):?><p class="alert"><?=h($err)?></p><?php endif;?><input type="password" name="password" placeholder="Пароль" required autofocus><button>Войти</button><a href="/">← Вернуться на сайт</a></form></body></html><?php exit;
}

// ── UPLOAD HELPERS ─────────────────────────────────────────────────────
function upload_file($field){
  if(empty($_FILES[$field]['tmp_name'])) return '';
  $ext=strtolower(pathinfo($_FILES[$field]['name'], PATHINFO_EXTENSION));
  if(!in_array($ext,['jpg','jpeg','png','webp','gif','mp4','webm'])) return '';
  $dir=__DIR__.'/../assets/uploads'; if(!is_dir($dir)) mkdir($dir,0775,true);
  $name=date('YmdHis').'-'.bin2hex(random_bytes(4)).'.'.$ext; $path=$dir.'/'.$name;
  if(move_uploaded_file($_FILES[$field]['tmp_name'],$path)) return 'assets/uploads/'.$name;
  return '';
}

// ════════════════════════════════════════════════════════════════════════
//  POST HANDLERS (CMS only — orders/CRM handled by crm.php & cdek_order.php)
// ════════════════════════════════════════════════════════════════════════
if($_SERVER['REQUEST_METHOD']==='POST'){
  $a=$_POST['action']??'';
  $ajax=!empty($_SERVER['HTTP_X_REQUESTED_WITH']);
  $jh=function() use($ajax){ if($ajax) header('Content-Type: application/json; charset=utf-8'); };

  if($a==='save_product'){
    $id=(int)($_POST['id']??0); $img=upload_file('image') ?: ($_POST['old_image']??''); $vid=upload_file('video') ?: ($_POST['old_video']??''); $slug=trim($_POST['slug']??'') ?: slugify($_POST['name']??'product');
    $relIds=implode(',',array_filter(array_map('intval',explode(',',$_POST['related_ids']??''))));
    $data=[(int)$_POST['category_id'],trim($_POST['name']),$slug,trim($_POST['subtitle']??''),trim($_POST['description']??''),(int)$_POST['price'],(int)($_POST['old_price']??0),$img,$vid,trim($_POST['specs']??''),trim($_POST['dimensions']??''),trim($_POST['materials']??''),trim($_POST['assembly']??''),trim($_POST['badge']??''),trim($_POST['seo_title']??''),trim($_POST['seo_description']??''),isset($_POST['is_active'])?1:0,(int)($_POST['sort_order']??0),$relIds,(int)($_POST['cost_price']??0),(int)($_POST['weight_g']??12000),(int)($_POST['length_cm']??60),(int)($_POST['width_cm']??60),(int)($_POST['height_cm']??40)];
    if($id){$data[]=$id;$pdo->prepare('UPDATE products SET category_id=?,name=?,slug=?,subtitle=?,description=?,price=?,old_price=?,image=?,video=?,specs=?,dimensions=?,materials=?,assembly=?,badge=?,seo_title=?,seo_description=?,is_active=?,sort_order=?,related_ids=?,cost_price=?,weight_g=?,length_cm=?,width_cm=?,height_cm=? WHERE id=?')->execute($data);} else {$pdo->prepare('INSERT INTO products(category_id,name,slug,subtitle,description,price,old_price,image,video,specs,dimensions,materials,assembly,badge,seo_title,seo_description,is_active,sort_order,related_ids,cost_price,weight_g,length_cm,width_cm,height_cm) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute($data); $id=(int)$pdo->lastInsertId();}
    if($id && !empty($_FILES['gallery']['name'][0])){
      $dir=__DIR__.'/../assets/uploads'; if(!is_dir($dir)) mkdir($dir,0775,true);
      $sort=(int)$pdo->query('SELECT COALESCE(MAX(sort_order),0) FROM product_media WHERE product_id='.(int)$id)->fetchColumn();
      foreach($_FILES['gallery']['name'] as $k=>$filename){
        if(empty($_FILES['gallery']['tmp_name'][$k])) continue;
        $ext=strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if(!in_array($ext,['jpg','jpeg','png','webp','gif'])) continue;
        $name=date('YmdHis').'-'.bin2hex(random_bytes(4)).'.'.$ext; $path=$dir.'/'.$name;
        if(move_uploaded_file($_FILES['gallery']['tmp_name'][$k],$path)){
          $rel='assets/uploads/'.$name; $sort+=10;
          $pdo->prepare('INSERT INTO product_media(product_id,path,type,sort_order) VALUES(?,?,?,?)')->execute([$id,$rel,'image',$sort]);
          if(!$img){ $img=$rel; $pdo->prepare('UPDATE products SET image=? WHERE id=?')->execute([$img,$id]); }
        }
      }
    }
    if($ajax){ $jh(); echo json_encode(['ok'=>true,'id'=>$id,'image'=>$img]); exit; }
  }
  if($a==='delete_media'){$mid=(int)$_POST['media_id'];$pid=(int)$_POST['product_id'];$st=$pdo->prepare('SELECT path FROM product_media WHERE id=?');$st->execute([$mid]);$path=$st->fetchColumn();$pdo->prepare('DELETE FROM product_media WHERE id=?')->execute([$mid]); if($path && is_file(__DIR__.'/../'.$path)) @unlink(__DIR__.'/../'.$path);
    if($ajax){$jh();echo json_encode(['ok'=>true]);exit;}
    header('Location:/admin?tab=products'); exit;}
  if($a==='get_media'){
    $jh(); $pid=(int)($_POST['product_id']??0);
    $st=$pdo->prepare("SELECT * FROM product_media WHERE product_id=? AND type='image' ORDER BY sort_order,id");
    $st->execute([$pid]); echo json_encode($st->fetchAll(PDO::FETCH_ASSOC)); exit;
  }
  if($a==='sort_media'){
    $ids=json_decode($_POST['ids']??'[]',true);
    foreach($ids as $i=>$mid){$pdo->prepare('UPDATE product_media SET sort_order=? WHERE id=?')->execute([($i+1)*10,(int)$mid]);}
    $jh(); echo json_encode(['ok'=>true]); exit;
  }
  if($a==='delete_product'){
    $pdo->prepare('DELETE FROM products WHERE id=?')->execute([(int)$_POST['id']]);
    if($ajax){$jh();echo json_encode(['ok'=>true]);exit;}
  }
  if($a==='save_product_block'){
    $pid=(int)$_POST['product_id']; $bid=(int)($_POST['id']??0);
    $img=upload_file('pb_image') ?: ($_POST['old_pb_image']??'');
    $data=[trim($_POST['pb_type']??'how'),trim($_POST['pb_title']??''),trim($_POST['pb_subtitle']??''),trim($_POST['pb_text']??''),$img,trim($_POST['pb_extra']??''),(int)($_POST['pb_sort']??10),isset($_POST['pb_active'])?1:0,$pid];
    if($bid){$data[]=$bid;$pdo->prepare('UPDATE product_blocks SET type=?,title=?,subtitle=?,text=?,image=?,extra=?,sort_order=?,is_active=?,product_id=? WHERE id=?')->execute($data);}
    else{$pdo->prepare('INSERT INTO product_blocks(type,title,subtitle,text,image,extra,sort_order,is_active,product_id) VALUES(?,?,?,?,?,?,?,?,?)')->execute($data);}
    if($ajax){$jh();echo json_encode(['ok'=>true]);exit;}
    header('Location:/admin?tab=products'); exit;
  }
  if($a==='delete_product_block'){$pdo->prepare('DELETE FROM product_blocks WHERE id=?')->execute([(int)$_POST['id']]); if($ajax){$jh();echo json_encode(['ok'=>true]);exit;}}
  if($a==='sort_product_blocks'){
    $ids=json_decode($_POST['ids']??'[]',true);
    foreach($ids as $i=>$id){$pdo->prepare('UPDATE product_blocks SET sort_order=? WHERE id=?')->execute([($i+1)*10,(int)$id]);}
    $jh(); echo json_encode(['ok'=>true]); exit;
  }
  if($a==='sort_products'){
    $ids=json_decode($_POST['ids']??'[]',true);
    foreach($ids as $i=>$id){$pdo->prepare('UPDATE products SET sort_order=? WHERE id=?')->execute([($i+1)*10,(int)$id]);}
    $jh(); echo json_encode(['ok'=>true]); exit;
  }
  if($a==='toggle_product'){
    $id=(int)($_POST['id']??0);$pdo->prepare('UPDATE products SET is_active=CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=?')->execute([$id]);
    $row=$pdo->prepare('SELECT is_active FROM products WHERE id=?');$row->execute([$id]);
    $jh(); echo json_encode(['ok'=>true,'is_active'=>(int)$row->fetchColumn()]); exit;
  }
  if($a==='save_category'){
    $id=(int)($_POST['id']??0);
    $slug=trim($_POST['slug']??'')?:slugify($_POST['name']??'cat');
    $parentId=(int)($_POST['parent_id']??0)?:null;
    $imgPath='';
    if(!empty($_FILES['cat_image']['tmp_name'])){
      $ext=strtolower(pathinfo($_FILES['cat_image']['name'],PATHINFO_EXTENSION));
      if(in_array($ext,['jpg','jpeg','png','webp','gif'])){
        $dir=__DIR__.'/../assets/images/cats/'; if(!is_dir($dir)) mkdir($dir,0775,true);
        $fname='cat_'.time().'_'.rand(100,999).'.'.$ext;
        move_uploaded_file($_FILES['cat_image']['tmp_name'],$dir.$fname);
        $imgPath='assets/images/cats/'.$fname;
      }
    }
    $out=['ok'=>true];
    if($id){
      if($imgPath){$pdo->prepare('UPDATE categories SET name=?,slug=?,seo_title=?,seo_description=?,is_active=?,sort_order=?,parent_id=?,image=? WHERE id=?')->execute([trim($_POST['name']),$slug,trim($_POST['seo_title']??''),trim($_POST['seo_description']??''),isset($_POST['is_active'])?1:0,(int)($_POST['sort_order']??10),$parentId,$imgPath,$id]); $out['image']=$imgPath;}
      else{$pdo->prepare('UPDATE categories SET name=?,slug=?,seo_title=?,seo_description=?,is_active=?,sort_order=?,parent_id=? WHERE id=?')->execute([trim($_POST['name']),$slug,trim($_POST['seo_title']??''),trim($_POST['seo_description']??''),isset($_POST['is_active'])?1:0,(int)($_POST['sort_order']??10),$parentId,$id]);}
    } else {
      $pdo->prepare('INSERT INTO categories(name,slug,seo_title,seo_description,is_active,sort_order,parent_id,image) VALUES(?,?,?,?,?,?,?,?)')->execute([trim($_POST['name']),$slug,trim($_POST['seo_title']??''),trim($_POST['seo_description']??''),isset($_POST['is_active'])?1:0,(int)($_POST['sort_order']??10),$parentId,$imgPath]);
      $out['id']=(int)$pdo->lastInsertId();
    }
    if($ajax){$jh();echo json_encode($out);exit;}
    header('Location:/admin?tab=categories'); exit;
  }
  if($a==='delete_category'){$pdo->prepare('DELETE FROM categories WHERE id=?')->execute([(int)$_POST['id']]); if($ajax){$jh();echo json_encode(['ok'=>true]);exit;}}
  if($a==='toggle_category'){$id=(int)($_POST['id']??0);$pdo->prepare('UPDATE categories SET is_active=CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=?')->execute([$id]);$row=$pdo->prepare('SELECT is_active FROM categories WHERE id=?');$row->execute([$id]);$jh();echo json_encode(['ok'=>true,'is_active'=>(int)$row->fetchColumn()]);exit;}
  if($a==='sort_categories'){
    $ids=json_decode($_POST['ids']??'[]',true);
    foreach($ids as $i=>$id){$pdo->prepare('UPDATE categories SET sort_order=? WHERE id=?')->execute([($i+1)*10,(int)$id]);}
    $jh(); echo json_encode(['ok'=>true]); exit;
  }
  if($a==='save_page'){
    $id=(int)($_POST['id']??0);
    $slug=trim($_POST['slug']??'')?:slugify($_POST['title']??'page');
    $data=[trim($_POST['title']),$slug,trim($_POST['seo_title']??''),trim($_POST['seo_description']??''),isset($_POST['is_active'])?1:0,isset($_POST['show_in_nav'])?1:0,trim($_POST['nav_label']??''),(int)($_POST['sort_order']??10)];
    $out=['ok'=>true];
    if($id){$data[]=$id;$pdo->prepare('UPDATE pages SET title=?,slug=?,seo_title=?,seo_description=?,is_active=?,show_in_nav=?,nav_label=?,sort_order=? WHERE id=?')->execute($data);$out['id']=$id;}
    else{$pdo->prepare('INSERT INTO pages(title,slug,seo_title,seo_description,is_active,show_in_nav,nav_label,sort_order) VALUES(?,?,?,?,?,?,?,?)')->execute($data); $out['id']=(int)$pdo->lastInsertId();}
    $out['slug']=$slug;
    if($ajax){$jh();echo json_encode($out);exit;}
    header('Location:/admin?tab=pages&pid='.$out['id']); exit;
  }
  if($a==='delete_page'){$pdo->prepare('DELETE FROM page_sections WHERE page_id=?')->execute([(int)$_POST['id']]);$pdo->prepare('DELETE FROM pages WHERE id=?')->execute([(int)$_POST['id']]); if($ajax){$jh();echo json_encode(['ok'=>true]);exit;} header('Location:/admin?tab=pages');exit;}
  if($a==='save_page_section'){
    $id=(int)($_POST['id']??0); $pid=(int)$_POST['page_id'];
    $img=upload_file('ps_image') ?: ($_POST['old_ps_image']??'');
    $data=[trim($_POST['ps_type']??'text'),trim($_POST['ps_eyebrow']??''),trim($_POST['ps_title']??''),trim($_POST['ps_subtitle']??''),trim($_POST['ps_text']??''),$img,trim($_POST['ps_cta_text']??''),trim($_POST['ps_cta_link']??''),trim($_POST['ps_extra']??''),(int)($_POST['ps_sort']??10),isset($_POST['ps_active'])?1:0,$pid];
    $out=['ok'=>true];
    if($id){$data[]=$id;$pdo->prepare('UPDATE page_sections SET type=?,eyebrow=?,title=?,subtitle=?,text=?,image=?,cta_text=?,cta_link=?,extra=?,sort_order=?,is_active=?,page_id=? WHERE id=?')->execute($data);}
    else{$pdo->prepare('INSERT INTO page_sections(type,eyebrow,title,subtitle,text,image,cta_text,cta_link,extra,sort_order,is_active,page_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')->execute($data);$out['id']=(int)$pdo->lastInsertId();}
    if($ajax){$jh();echo json_encode($out);exit;}
    header('Location:/admin?tab=pages&pid='.$pid); exit;
  }
  if($a==='delete_page_section'){$pid=(int)$_POST['page_id'];$pdo->prepare('DELETE FROM page_sections WHERE id=?')->execute([(int)$_POST['id']]); if($ajax){$jh();echo json_encode(['ok'=>true]);exit;} header('Location:/admin?tab=pages&pid='.$pid);exit;}
  if($a==='sort_page_sections'){
    $ids=json_decode($_POST['ids']??'[]',true);
    foreach($ids as $i=>$id){$pdo->prepare('UPDATE page_sections SET sort_order=? WHERE id=?')->execute([($i+1)*10,(int)$id]);}
    $jh(); echo json_encode(['ok'=>true]); exit;
  }
  if($a==='save_nav'){
    $id=(int)($_POST['id']??0);
    $data=[trim($_POST['label']),trim($_POST['url']),(int)($_POST['sort_order']??10),(int)($_POST['is_active']??0),(int)($_POST['open_new_tab']??0)];
    $out=['ok'=>true];
    if($id){$data[]=$id;$pdo->prepare('UPDATE nav_items SET label=?,url=?,sort_order=?,is_active=?,open_new_tab=? WHERE id=?')->execute($data);}
    else{$pdo->prepare('INSERT INTO nav_items(label,url,sort_order,is_active,open_new_tab) VALUES(?,?,?,?,?)')->execute($data);$out['id']=(int)$pdo->lastInsertId();}
    if($ajax){$jh();echo json_encode($out);exit;}
    header('Location:/admin?tab=nav'); exit;
  }
  if($a==='delete_nav'){$pdo->prepare('DELETE FROM nav_items WHERE id=?')->execute([(int)$_POST['id']]); if($ajax){$jh();echo json_encode(['ok'=>true]);exit;} header('Location:/admin?tab=nav');exit;}
  if($a==='sort_nav'){
    $ids=json_decode($_POST['ids']??'[]',true);
    foreach($ids as $i=>$id){$pdo->prepare('UPDATE nav_items SET sort_order=? WHERE id=?')->execute([($i+1)*10,(int)$id]);}
    $jh(); echo json_encode(['ok'=>true]); exit;
  }
  if($a==='approve_review'){$pdo->prepare('UPDATE reviews SET is_active=1 WHERE id=?')->execute([(int)$_POST['id']]); $jh(); echo json_encode(['ok'=>true]); exit;}
  if($a==='delete_review'){$pdo->prepare('DELETE FROM reviews WHERE id=?')->execute([(int)$_POST['id']]); $jh(); echo json_encode(['ok'=>true]); exit;}
  if($a==='save_settings'){
    foreach(['site_title','site_description','phone','email','telegram','whatsapp','instagram','youtube','og_image','yandex_api_key','cdek_client_id','cdek_client_secret','novofon_key','novofon_secret','novofon_ext'] as $k){
      if(!array_key_exists($k,$_POST)) continue;
      $pdo->prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')->execute([$k,trim($_POST[$k]??'')]);
    }
    if($ajax){$jh();echo json_encode(['ok'=>true]);exit;}
    header('Location:/admin?tab=settings'); exit;
  }
  if($a==='yandex_seo'){
    $jh();
    $apiKey = setting('yandex_api_key');
    if(!$apiKey){ echo json_encode(['error'=>'API-ключ не настроен']); exit; }
    $name=trim($_POST['name']??''); $desc=trim($_POST['description']??''); $specs=trim($_POST['specs']??''); $cat=trim($_POST['category']??'');
    $prompt="Ты SEO-специалист для российского интернет-магазина премиального outdoor оборудования LUKA OUTDOOR (костровые системы, сталь, живой огонь).\n\nТовар: {$name}\nКатегория: {$cat}\nОписание: {$desc}\nХарактеристики: {$specs}\n\nСгенерируй SEO-данные для Яндекса. Верни ТОЛЬКО JSON без лишнего текста:\n{\"seo_title\":\"заголовок до 60 символов\",\"seo_description\":\"описание 140-160 символов\",\"keywords\":\"5-7 ключевых слов через запятую\"}";
    $ch=curl_init('https://llm.api.cloud.yandex.net/foundationModels/v1/completion');
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Api-Key '.$apiKey],CURLOPT_POSTFIELDS=>json_encode(['modelUri'=>'gpt://b1g0l7oq8ql0j8vmqt8l/yandexgpt-lite','completionOptions'=>['stream'=>false,'temperature'=>0.3,'maxTokens'=>400],'messages'=>[['role'=>'user','text'=>$prompt]]]),CURLOPT_TIMEOUT=>20]);
    $res=curl_exec($ch); $err=curl_error($ch); curl_close($ch);
    if($err){ echo json_encode(['error'=>'Ошибка запроса: '.$err]); exit; }
    $data=json_decode($res,true);
    $text=$data['result']['alternatives'][0]['message']['text']??'';
    $text=preg_replace('/```json|```/','',trim($text));
    $parsed=json_decode($text,true);
    if(!$parsed){ echo json_encode(['error'=>'Не удалось распарсить ответ','raw'=>$text]); exit; }
    echo json_encode(['ok'=>true,'data'=>$parsed]); exit;
  }
  if($ajax){ $jh(); echo json_encode(['ok'=>false,'error'=>'unknown: '.$a]); exit; }
  header('Location:/admin?tab='.urlencode($_GET['tab']??'products')); exit;
}

// ════════════════════════════════════════════════════════════════════════
//  DATA FOR VIEW
// ════════════════════════════════════════════════════════════════════════
$tab=$_GET['tab']??'products'; $pid=(int)($_GET['pid']??0);
$cats=$pdo->query('SELECT * FROM categories ORDER BY sort_order,id')->fetchAll(PDO::FETCH_ASSOC);
$products=$pdo->query('SELECT p.*, c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY c.sort_order,p.sort_order,p.id')->fetchAll(PDO::FETCH_ASSOC);
try{$pages=$pdo->query('SELECT * FROM pages ORDER BY sort_order,id')->fetchAll(PDO::FETCH_ASSOC);}catch(Exception $e){$pages=[];}
try{$navItems=$pdo->query('SELECT * FROM nav_items ORDER BY sort_order,id')->fetchAll(PDO::FETCH_ASSOC);}catch(Exception $e){$navItems=[];}
try{$allRev=$pdo->query("SELECT r.*,p.name product_name,p.slug product_slug FROM reviews r LEFT JOIN products p ON p.id=r.product_id ORDER BY r.is_active ASC,r.id DESC")->fetchAll(PDO::FETCH_ASSOC);}catch(Exception $e){$allRev=[];}
try{$pendingRev=(int)$pdo->query("SELECT COUNT(*) FROM reviews WHERE is_active=0")->fetchColumn();}catch(Exception $e){$pendingRev=0;}
try{$newOrders=(int)$pdo->query("SELECT COUNT(*) FROM orders WHERE status='new'")->fetchColumn();}catch(Exception $e){$newOrders=0;}

$crumbLabels=['products'=>'Товары','categories'=>'Категории','pages'=>'Страницы','nav'=>'Навигация','reviews'=>'Отзывы','settings'=>'Настройки'];

// section type meta for page builder
$SECTION_TYPES=[
  'hero_simple'=>['🎯','Герой','eyebrow, заголовок, текст, кнопка'],
  'text'=>['📝','Текст','eyebrow, H2, абзац, кнопка'],
  'text_image'=>['📸','Текст + фото','двухколоночный блок с фото'],
  'cards'=>['🃏','Карточки','повторяющиеся карточки'],
  'contacts_block'=>['📞','Контакты','строки «метка → значение»'],
  'quote'=>['💬','Цитата','цитата / манифест'],
  'products_grid'=>['🛍','Товары','сетка товаров'],
  'lead_form'=>['📋','Форма заявки','форма обратной связи'],
];
?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LUKA / CMS</title>
<link rel="stylesheet" href="admin.css">
</head>
<body>
<div class="adminWrap">

<!-- SIDEBAR -->
<div class="sidebarBackdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>
<aside class="sidebar" id="sidebar">
  <div class="sidebarLogo">
    <div class="sidebarLogoMark">L</div>
    <span>LUKA<br>OUTDOOR<br>CMS</span>
  </div>
  <nav class="sidebarNav">
    <a data-tab="products" class="<?=$tab==='products'?'active':''?>"><svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> Товары</a>
    <a data-tab="categories" class="<?=$tab==='categories'?'active':''?>"><svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h8M4 18h16"/></svg> Категории</a>
    <a data-tab="pages" class="<?=$tab==='pages'?'active':''?>"><svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg> Страницы</a>
    <a data-tab="nav" class="<?=$tab==='nav'?'active':''?>"><svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg> Навигация</a>
    <a data-tab="reviews" class="<?=$tab==='reviews'?'active':''?>"><svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Отзывы<?php if($pendingRev):?><span class="sideBadge"><?=$pendingRev?></span><?php endif;?></a>
    <a data-tab="settings" class="<?=$tab==='settings'?'active':''?>"><svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> Настройки</a>
  </nav>
  <div class="sidebarBottom">
    <a href="/admin/crm.php"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> CRM / Заказы<?php if($newOrders):?><span class="sideBadge"><?=$newOrders?></span><?php endif;?></a>
    <a href="/" target="_blank"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> На сайт</a>
    <a href="logout.php"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg> Выйти</a>
  </div>
</aside>

<!-- MAIN -->
<div class="adminContent">
  <div class="topbar">
    <button class="burger" onclick="toggleSidebar()">☰</button>
    <div class="crumb">CMS / <b><?=h($crumbLabels[$tab]??'Товары')?></b></div>
    <div class="spacer"></div>
    <div class="userChip"><span>Администратор</span><div class="userAvatar">A</div></div>
  </div>
  <div class="contentInner">

<!-- ════════════ PRODUCTS ════════════ -->
<div class="tabContent <?=$tab==='products'?'active':''?>" id="tab-products" style="<?=$tab==='products'?'':'display:none'?>">
  <div class="pageHeader"><div><h1>Товары</h1><p>Каталог · перетащите строки для смены порядка</p></div><button class="btn-primary" onclick="openProductDrawer(null)">+ Добавить товар</button></div>
  <input class="searchBar" id="productSearch" placeholder="Поиск товаров..." style="margin-bottom:14px">
  <table class="dataTable">
    <thead><tr><th></th><th>Фото</th><th>Название</th><th>Категория</th><th>Цена</th><th>Статус</th><th></th></tr></thead>
    <tbody id="productRows">
    <?php foreach($products as $p): ?>
    <tr data-id="<?=$p['id']?>" data-name="<?=h(mb_strtolower($p['name'].' '.$p['category_name']))?>">
      <td><span class="dragHandle" title="Перетащить">⠿</span></td>
      <td><?php if($p['image']):?><img class="tableThumb" src="../<?=h($p['image'])?>" alt=""><?php else:?><div class="tableThumb noimg">нет</div><?php endif;?></td>
      <td><div style="font-weight:700"><?=h($p['name'])?></div><div style="font-size:12px;color:var(--muted)"><?=h($p['slug'])?></div></td>
      <td style="color:var(--muted)"><?=h($p['category_name']??'—')?></td>
      <td style="font-weight:700;color:var(--copper)"><?=money($p['price'])?></td>
      <td><label class="switch"><input type="checkbox" <?=$p['is_active']?'checked':''?> onchange="toggleProduct(<?=$p['id']?>,this)"><span class="slider"></span></label></td>
      <td><div class="rowActions">
        <button class="btn-ghost btn-sm" onclick='openProductDrawer(<?=json_encode($p,JSON_UNESCAPED_UNICODE|JSON_HEX_APOS|JSON_HEX_QUOT)?>)'>✏</button>
        <button class="btn-danger btn-sm" onclick="deleteProductRow(<?=$p['id']?>,this)">✕</button>
      </div></td>
    </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  <?php if(empty($products)):?><div class="emptyState"><div class="ico">📦</div><p>Товаров пока нет</p></div><?php endif;?>
</div>

<!-- ════════════ CATEGORIES ════════════ -->
<div class="tabContent <?=$tab==='categories'?'active':''?>" id="tab-categories" style="<?=$tab==='categories'?'':'display:none'?>">
  <div class="pageHeader"><div><h1>Категории</h1><p>Дерево разделов каталога</p></div><button class="btn-primary" onclick="openCatModal(null)">+ Добавить</button></div>
  <div id="catList">
  <?php
  $rootCats=array_filter($cats,fn($c)=>empty($c['parent_id']));
  $childCats=[]; foreach($cats as $cc){ if(!empty($cc['parent_id'])) $childCats[$cc['parent_id']][]=$cc; }
  foreach($rootCats as $c): ?>
  <div class="navItemRow" data-id="<?=$c['id']?>">
    <span class="navDragHandle" title="Перетащить">⠿</span>
    <?php if(!empty($c['image'])):?><img src="/<?=h($c['image'])?>" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0"><?php endif;?>
    <div><div class="label"><?=h($c['name'])?></div><div class="url">/catalog.php?cat=<?=h($c['slug'])?></div></div>
    <button class="badge <?=$c['is_active']?'badge-active':'badge-hidden'?>" style="cursor:pointer" onclick="toggleCat(<?=$c['id']?>,this)"><?=$c['is_active']?'Активна':'Скрыта'?></button>
    <button class="btn-ghost btn-sm" onclick='openCatModal(<?=json_encode($c,JSON_UNESCAPED_UNICODE|JSON_HEX_APOS|JSON_HEX_QUOT)?>)'>✏</button>
    <button class="btn-danger btn-sm" onclick="deleteCat(<?=$c['id']?>,this)">✕</button>
  </div>
  <?php foreach($childCats[$c['id']]??[] as $sub): ?>
  <div class="navItemRow" data-id="<?=$sub['id']?>" style="margin-left:28px;border-left:2px solid var(--line2)">
    <div><div class="label" style="font-size:13px">↳ <?=h($sub['name'])?></div><div class="url">/catalog.php?cat=<?=h($sub['slug'])?></div></div>
    <button class="badge <?=$sub['is_active']?'badge-active':'badge-hidden'?>" style="cursor:pointer" onclick="toggleCat(<?=$sub['id']?>,this)"><?=$sub['is_active']?'Активна':'Скрыта'?></button>
    <button class="btn-ghost btn-sm" onclick='openCatModal(<?=json_encode($sub,JSON_UNESCAPED_UNICODE|JSON_HEX_APOS|JSON_HEX_QUOT)?>)'>✏</button>
    <button class="btn-danger btn-sm" onclick="deleteCat(<?=$sub['id']?>,this)">✕</button>
  </div>
  <?php endforeach; endforeach; ?>
  </div>
</div>

<!-- ════════════ PAGES ════════════ -->
<div class="tabContent <?=$tab==='pages'?'active':''?>" id="tab-pages" style="<?=$tab==='pages'?'':'display:none'?>">
  <?php
  $editPage=null; $pageSections=[];
  if($pid){ $st=$pdo->prepare('SELECT * FROM pages WHERE id=?');$st->execute([$pid]);$editPage=$st->fetch(PDO::FETCH_ASSOC);
    if($editPage){ $st2=$pdo->prepare('SELECT * FROM page_sections WHERE page_id=? ORDER BY sort_order,id');$st2->execute([$pid]);$pageSections=$st2->fetchAll(PDO::FETCH_ASSOC);} }
  if(!$editPage): ?>
  <div class="pageHeader"><div><h1>Страницы</h1><p>Произвольные страницы сайта</p></div><button class="btn-primary" onclick="openPageModal(null)">+ Новая страница</button></div>
  <div id="pagesList">
  <?php foreach($pages as $pg): $secCount=(int)$pdo->query("SELECT COUNT(*) FROM page_sections WHERE page_id=".(int)$pg['id'])->fetchColumn(); ?>
  <div class="navItemRow">
    <div><div class="label"><?=h($pg['title'])?></div><div class="url">/page.php?slug=<?=h($pg['slug'])?> · <?=$secCount?> секц.</div></div>
    <span class="badge <?=$pg['is_active']?'badge-active':'badge-hidden'?>"><?=$pg['is_active']?'Активна':'Скрыта'?></span>
    <a href="?tab=pages&pid=<?=$pg['id']?>" class="btn-ghost btn-sm">✏ Редактор</a>
    <a href="/page.php?slug=<?=h($pg['slug'])?>" target="_blank" class="btn-ghost btn-sm">↗</a>
    <button class="btn-ghost btn-sm" onclick='openPageModal(<?=json_encode($pg,JSON_UNESCAPED_UNICODE|JSON_HEX_APOS|JSON_HEX_QUOT)?>)'>⚙</button>
    <button class="btn-danger btn-sm" onclick="deletePage(<?=$pg['id']?>,this)">✕</button>
  </div>
  <?php endforeach; if(empty($pages)):?><div class="emptyState"><div class="ico">📄</div><p>Страниц пока нет</p></div><?php endif;?>
  </div>
  <?php else: ?>
  <!-- PAGE EDITOR -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="?tab=pages" class="btn-ghost btn-sm">← Назад</a>
    <h1 style="font-size:23px"><?=h($editPage['title'])?></h1>
    <a href="/page.php?slug=<?=h($editPage['slug'])?>" target="_blank" class="btn-ghost btn-sm">На сайте ↗</a>
  </div>
  <div style="display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start" class="pageEditorGrid">
    <div>
      <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted);margin-bottom:12px">Секции страницы</h3>
      <div id="pageSections">
      <?php foreach($pageSections as $ps): $m=$SECTION_TYPES[$ps['type']]??['📄',$ps['type'],'']; ?>
      <div class="sectionCard" data-id="<?=$ps['id']?>">
        <span class="navDragHandle">⠿</span>
        <span class="typePill"><?=$m[0]?> <?=h($m[1])?></span>
        <span class="sTitle"><?=h($ps['title']?:$ps['eyebrow']?:'—')?></span>
        <button class="btn-ghost btn-sm" onclick='openSectionEditor(<?=json_encode($ps,JSON_UNESCAPED_UNICODE|JSON_HEX_APOS|JSON_HEX_QUOT)?>,<?=$pid?>)'>✏</button>
        <button class="btn-danger btn-sm" onclick="deleteSection(<?=$ps['id']?>,<?=$pid?>,this)">✕</button>
      </div>
      <?php endforeach; ?>
      </div>
      <button class="btn-primary" style="width:100%;justify-content:center;margin-top:12px" onclick="openTypePicker(<?=$pid?>)">+ Добавить секцию</button>
    </div>
    <div style="position:sticky;top:90px">
      <div class="panel">
        <h3>Настройки страницы</h3>
        <form id="editPageForm" class="formGrid" style="grid-template-columns:1fr">
          <input type="hidden" name="action" value="save_page"><input type="hidden" name="id" value="<?=$editPage['id']?>">
          <label>Название<input name="title" value="<?=h($editPage['title'])?>"></label>
          <label>URL slug<input name="slug" value="<?=h($editPage['slug'])?>"></label>
          <label>SEO Title<input name="seo_title" value="<?=h($editPage['seo_title'])?>"></label>
          <label>SEO Description<textarea name="seo_description"><?=h($editPage['seo_description'])?></textarea></label>
          <label class="checkRow"><input type="checkbox" name="is_active" <?=$editPage['is_active']?'checked':''?>> Активна</label>
          <label class="checkRow"><input type="checkbox" name="show_in_nav" <?=$editPage['show_in_nav']?'checked':''?>> В навигации</label>
          <label>Название в меню<input name="nav_label" value="<?=h($editPage['nav_label'])?>"></label>
          <div class="formActions"><button type="button" class="btn-primary" onclick="ajaxForm('editPageForm')">Сохранить</button></div>
        </form>
      </div>
    </div>
  </div>
  <?php endif; ?>
</div>

<!-- ════════════ NAV ════════════ -->
<div class="tabContent <?=$tab==='nav'?'active':''?>" id="tab-nav" style="<?=$tab==='nav'?'':'display:none'?>">
  <div class="pageHeader"><div><h1>Навигация</h1><p>Пункты меню сайта</p></div><button class="btn-primary" onclick="openNavModal(null)">+ Добавить пункт</button></div>
  <div id="navList">
  <?php foreach($navItems as $ni): ?>
  <div class="navItemRow" data-id="<?=$ni['id']?>">
    <span class="navDragHandle">⠿</span>
    <div><div class="label"><?=h($ni['label'])?></div><div class="url"><?=h($ni['url'])?><?=$ni['open_new_tab']?' · новая вкладка':''?></div></div>
    <span class="badge <?=$ni['is_active']?'badge-active':'badge-hidden'?>"><?=$ni['is_active']?'Активен':'Скрыт'?></span>
    <button class="btn-ghost btn-sm" onclick='openNavModal(<?=json_encode($ni,JSON_UNESCAPED_UNICODE|JSON_HEX_APOS|JSON_HEX_QUOT)?>)'>✏</button>
    <button class="btn-danger btn-sm" onclick="deleteNav(<?=$ni['id']?>,this)">✕</button>
  </div>
  <?php endforeach; ?>
  </div>
</div>

<!-- ════════════ REVIEWS ════════════ -->
<div class="tabContent <?=$tab==='reviews'?'active':''?>" id="tab-reviews" style="<?=$tab==='reviews'?'':'display:none'?>">
  <div class="pageHeader"><div><h1>Отзывы</h1><p>Модерация отзывов покупателей</p></div></div>
  <?php if(empty($allRev)):?><div class="emptyState"><div class="ico">💬</div><p>Отзывов пока нет</p></div>
  <?php else:?><div style="display:grid;gap:12px">
  <?php foreach($allRev as $rv):?>
  <div class="reviewCard panel" style="display:flex;gap:14px;align-items:start;border-color:<?=$rv['is_active']?'var(--line)':'var(--copper)'?>">
    <div style="flex:1"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <b><?=h($rv['author'])?></b>
      <span style="color:#f5a623"><?=str_repeat('★',(int)$rv['rating']).str_repeat('☆',5-(int)$rv['rating'])?></span>
      <a href="/product.php?slug=<?=h($rv['product_slug'])?>" target="_blank" style="color:var(--copper);font-size:12px"><?=h($rv['product_name'])?></a>
      <span style="font-size:11px;color:var(--muted)"><?=date('d.m.Y',strtotime($rv['created_at']))?></span>
      <?php if(!$rv['is_active']):?><span class="pendingBadge badge badge-hidden" style="color:var(--copper)">На модерации</span><?php endif;?>
    </div><p style="color:var(--muted);font-size:14px;line-height:1.6;margin:0"><?=nl2br(h($rv['text']))?></p></div>
    <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
      <?php if(!$rv['is_active']):?><button class="btn-primary btn-sm" onclick="approveReview(<?=$rv['id']?>,this)">Опубликовать</button><?php endif;?>
      <button class="btn-danger btn-sm" onclick="deleteReview(<?=$rv['id']?>,this)">Удалить</button>
    </div>
  </div>
  <?php endforeach;?></div><?php endif;?>
</div>

<!-- ════════════ SETTINGS ════════════ -->
<div class="tabContent <?=$tab==='settings'?'active':''?>" id="tab-settings" style="<?=$tab==='settings'?'':'display:none'?>">
  <div class="pageHeader"><div><h1>Настройки</h1><p>Сайт, соцсети, API-ключи</p></div></div>
  <div style="display:grid;gap:18px;max-width:780px">
    <form id="setSite" class="panel">
      <h3>Сайт</h3><input type="hidden" name="action" value="save_settings">
      <div class="formGrid">
        <label class="wide">SEO Title сайта<input name="site_title" value="<?=h(setting('site_title'))?>"></label>
        <label class="wide">SEO Description<textarea name="site_description"><?=h(setting('site_description'))?></textarea></label>
        <label>Телефон<input name="phone" value="<?=h(setting('phone'))?>"></label>
        <label>Email<input name="email" value="<?=h(setting('email'))?>"></label>
        <div class="formActions"><button type="button" class="btn-primary" onclick="ajaxForm('setSite')">Сохранить</button></div>
      </div>
    </form>
    <form id="setSocial" class="panel">
      <h3>Соцсети</h3><input type="hidden" name="action" value="save_settings">
      <div class="formGrid">
        <label>Telegram<input name="telegram" value="<?=h(setting('telegram'))?>"></label>
        <label>WhatsApp<input name="whatsapp" value="<?=h(setting('whatsapp'))?>"></label>
        <label>Instagram<input name="instagram" value="<?=h(setting('instagram'))?>"></label>
        <label>YouTube<input name="youtube" value="<?=h(setting('youtube'))?>"></label>
        <div class="formActions"><button type="button" class="btn-primary" onclick="ajaxForm('setSocial')">Сохранить</button></div>
      </div>
    </form>
    <form id="setApi" class="panel">
      <h3>API ключи</h3><input type="hidden" name="action" value="save_settings">
      <div class="formGrid">
        <label class="wide">Yandex API Key (YandexGPT)<input name="yandex_api_key" type="password" value="<?=h(setting('yandex_api_key'))?>"></label>
        <label>СДЭК Client ID<input name="cdek_client_id" value="<?=h(setting('cdek_client_id'))?>"></label>
        <label>СДЭК Client Secret<input name="cdek_client_secret" type="password" value="<?=h(setting('cdek_client_secret'))?>"></label>
        <label>Новофон API Key<input name="novofon_key" value="<?=h(setting('novofon_key'))?>"></label>
        <label>Новофон Secret<input name="novofon_secret" type="password" value="<?=h(setting('novofon_secret'))?>"></label>
        <label>Внутренний номер<input name="novofon_ext" value="<?=h(setting('novofon_ext','100'))?>"></label>
        <div class="formActions"><button type="button" class="btn-primary" onclick="ajaxForm('setApi')">Сохранить</button></div>
      </div>
    </form>
    <form id="setSeo" class="panel">
      <h3>SEO</h3><input type="hidden" name="action" value="save_settings">
      <div class="formGrid">
        <label class="wide">OG Image<input name="og_image" value="<?=h(setting('og_image'))?>"></label>
        <div class="formActions"><button type="button" class="btn-primary" onclick="ajaxForm('setSeo')">Сохранить</button></div>
      </div>
    </form>
  </div>
</div>

  </div><!-- /contentInner -->
</div><!-- /adminContent -->
</div><!-- /adminWrap -->

<!-- ══════════ PRODUCT DRAWER ══════════ -->
<div class="drawerOverlay" id="productOverlay" onclick="closeProductDrawer()"></div>
<aside class="drawer" id="productDrawer">
  <div class="drawerHead"><h2 id="productDrawerTitle">Новый товар</h2><button class="modalClose" onclick="closeProductDrawer()">✕</button></div>
  <div class="drawerBody">
    <form id="productForm" enctype="multipart/form-data">
      <input type="hidden" name="action" value="save_product"><input type="hidden" name="id" id="pf_id">
      <input type="hidden" name="old_image" id="pf_old_image"><input type="hidden" name="old_video" id="pf_old_video">
      <div class="photoPreview" id="pf_photo_preview"><span>Нет фото</span></div>
      <div class="drawerTabs">
        <button type="button" class="drawerTab active" data-dtab="main">Основное</button>
        <button type="button" class="drawerTab" data-dtab="specs">Характеристики</button>
        <button type="button" class="drawerTab" data-dtab="media">Галерея</button>
        <button type="button" class="drawerTab" data-dtab="seo">SEO</button>
        <button type="button" class="drawerTab" data-dtab="blocks">Блоки</button>
      </div>
      <!-- MAIN -->
      <div class="drawerTabPanel active" data-dtab="main">
        <div class="drawerRow">
          <label class="drawerLabel">Раздел<select id="pf_parent_cat" onchange="pfFilterSubcats(this.value)"><option value="">— Раздел —</option><?php foreach($cats as $c): if(empty($c['parent_id'])):?><option value="<?=$c['id']?>"><?=h($c['name'])?></option><?php endif; endforeach;?></select></label>
          <label class="drawerLabel">Категория<select name="category_id" id="pf_category_id"><option value="">— Выберите —</option><?php foreach($cats as $c):?><option value="<?=$c['id']?>" data-parent="<?=$c['parent_id']?>"><?=h($c['name'])?></option><?php endforeach;?></select></label>
        </div>
        <label class="drawerLabel">Название *<input name="name" id="pf_name" required oninput="pfAutoSlug()"></label>
        <label class="drawerLabel">Slug URL<input name="slug" id="pf_slug" placeholder="auto"></label>
        <label class="drawerLabel">Подзаголовок<input name="subtitle" id="pf_subtitle"></label>
        <label class="drawerLabel">Описание <span class="charCount" id="pf_desc_cnt">0</span><textarea name="description" id="pf_description" rows="4" oninput="cc('pf_description','pf_desc_cnt')"></textarea></label>
        <div class="drawerRow">
          <label class="drawerLabel">Цена ₽<input name="price" id="pf_price" type="number" oninput="pfMargin()"></label>
          <label class="drawerLabel">Старая цена ₽<input name="old_price" id="pf_old_price" type="number"></label>
        </div>
        <div class="drawerRow">
          <label class="drawerLabel">Себестоимость ₽<input name="cost_price" id="pf_cost_price" type="number" oninput="pfMargin()"></label>
          <label class="drawerLabel">Маржа<input id="pf_margin" disabled placeholder="—"></label>
        </div>
        <div class="drawerRow" style="grid-template-columns:1fr 1fr 1fr 1fr">
          <label class="drawerLabel">Вес (г)<input name="weight_g" id="pf_weight_g" type="number" placeholder="12000"></label>
          <label class="drawerLabel">Длина<input name="length_cm" id="pf_length_cm" type="number" placeholder="60"></label>
          <label class="drawerLabel">Ширина<input name="width_cm" id="pf_width_cm" type="number" placeholder="60"></label>
          <label class="drawerLabel">Высота<input name="height_cm" id="pf_height_cm" type="number" placeholder="40"></label>
        </div>
        <div class="drawerRow">
          <label class="drawerLabel">Бейдж<input name="badge" id="pf_badge" placeholder="ХИТ / NEW"></label>
          <label class="drawerLabel">Порядок<input name="sort_order" id="pf_sort_order" type="number" value="10"></label>
        </div>
        <label class="drawerCheck"><input type="checkbox" name="is_active" id="pf_is_active" checked> Товар активен</label>
      </div>
      <!-- SPECS -->
      <div class="drawerTabPanel" data-dtab="specs">
        <label class="drawerLabel">Характеристики<input name="specs" id="pf_specs"></label>
        <label class="drawerLabel">Размеры<input name="dimensions" id="pf_dimensions"></label>
        <label class="drawerLabel">Материалы<input name="materials" id="pf_materials"></label>
        <label class="drawerLabel">Сборка<input name="assembly" id="pf_assembly"></label>
        <label class="drawerLabel">Похожие товары (ID через запятую)<input name="related_ids" id="pf_related_ids"></label>
      </div>
      <!-- MEDIA -->
      <div class="drawerTabPanel" data-dtab="media">
        <div class="dropzone" id="pf_dropzone" onclick="document.getElementById('pf_gallery_input').click()">📂 Перетащите фото сюда или нажмите для выбора</div>
        <input type="file" id="pf_gallery_input" name="gallery[]" accept="image/*" multiple style="display:none" onchange="pfQueueGallery(this)">
        <div id="pf_media_gallery" class="mediaGrid2" style="margin-bottom:14px"></div>
        <label class="drawerLabel">Главное фото<input type="file" name="image" accept="image/*" onchange="previewImg(this,'pf_photo_preview')"></label>
        <label class="drawerLabel">Видео MP4<input type="file" name="video" accept="video/mp4,video/webm"></label>
      </div>
      <!-- SEO -->
      <div class="drawerTabPanel" data-dtab="seo">
        <button type="button" id="seoAiBtn" class="btn-ghost" style="margin-bottom:10px" onclick="runYandexSEO()">✨ Сгенерировать SEO (YandexGPT)</button>
        <span id="seoAiStatus" style="font-size:12px;color:var(--muted);display:block;margin-bottom:12px">Заполните название, затем нажмите кнопку</span>
        <label class="drawerLabel">SEO Title <span class="charCount" id="pf_st_cnt">0 / 60</span><input name="seo_title" id="pf_seo_title" oninput="ccLimit('pf_seo_title','pf_st_cnt',60)"></label>
        <label class="drawerLabel">SEO Description <span class="charCount" id="pf_sd_cnt">0 / 160</span><textarea name="seo_description" id="pf_seo_description" rows="3" oninput="ccLimit('pf_seo_description','pf_sd_cnt',160)"></textarea></label>
      </div>
      <!-- BLOCKS -->
      <div class="drawerTabPanel" data-dtab="blocks">
        <div id="pf_blocks_list" style="margin-bottom:12px"></div>
        <button type="button" class="btn-ghost" style="width:100%;justify-content:center" onclick="addPbBlock()">+ Добавить блок товара</button>
        <div id="pbBlockEditor" style="display:none;background:var(--bg);border:1px solid var(--line2);border-radius:11px;padding:16px;margin-top:12px">
          <form id="pbBlockForm" enctype="multipart/form-data">
            <input type="hidden" name="action" value="save_product_block"><input type="hidden" name="product_id" id="pb_product_id">
            <input type="hidden" name="id" id="pb_id"><input type="hidden" name="old_pb_image" id="pb_old_image">
            <label class="drawerLabel">Тип<select name="pb_type" id="pb_type"><option value="included">Комплектация</option><option value="how">Как использовать</option><option value="features">Преимущества</option><option value="lifestyle">Lifestyle фото</option></select></label>
            <label class="drawerLabel">Заголовок<input name="pb_title" id="pb_title"></label>
            <label class="drawerLabel">Текст<textarea name="pb_text" id="pb_text" rows="2"></textarea></label>
            <label class="drawerLabel">Пункты через |<input name="pb_extra" id="pb_extra" placeholder="Шаг 1|Шаг 2"></label>
            <label class="drawerLabel">Фото<input type="file" name="pb_image" accept="image/*"></label>
            <input type="hidden" name="pb_active" value="1">
            <div style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn-primary" onclick="submitPbBlock()">Сохранить блок</button><button type="button" class="btn-ghost" onclick="document.getElementById('pbBlockEditor').style.display='none'">Отмена</button></div>
          </form>
        </div>
      </div>
    </form>
  </div>
  <div class="drawerFoot">
    <button class="btn-primary" onclick="submitProductForm()" id="productSaveBtn">Сохранить</button>
    <button class="btn-ghost" onclick="closeProductDrawer()">Отмена</button>
    <button class="btn-danger" id="productDeleteBtn" style="display:none;margin-left:auto" onclick="deleteProduct()">Удалить</button>
  </div>
</aside>

<!-- ══════════ CATEGORY MODAL ══════════ -->
<div class="modalOverlay" id="catModal"><div class="modalBox">
  <button class="modalClose" onclick="closeModal('catModal')">✕</button><h2 id="catModalTitle">Категория</h2>
  <form id="catForm" class="formGrid" style="grid-template-columns:1fr" enctype="multipart/form-data">
    <input type="hidden" name="action" value="save_category"><input type="hidden" name="id" id="cat_id">
    <label>Название *<input name="name" id="cat_name" required></label>
    <label>Slug<input name="slug" id="cat_slug" placeholder="fire-bowls"></label>
    <label>Родительская категория<select name="parent_id" id="cat_parent_id"><option value="">— Корневая —</option><?php foreach($cats as $pc): if(empty($pc['parent_id'])):?><option value="<?=$pc['id']?>"><?=h($pc['name'])?></option><?php endif; endforeach;?></select></label>
    <label>Фото категории<input type="file" name="cat_image" accept="image/*"></label>
    <div id="cat_img_preview" style="display:none"><img id="cat_img_preview_img" src="" style="height:80px;border-radius:8px;object-fit:cover"></div>
    <label>SEO Title<input name="seo_title" id="cat_seo_title"></label>
    <label>SEO Description<textarea name="seo_description" id="cat_seo_desc"></textarea></label>
    <label>Порядок<input name="sort_order" id="cat_sort" type="number" value="10"></label>
    <label class="checkRow"><input type="checkbox" name="is_active" id="cat_active" checked> Активна</label>
    <div class="formActions"><button type="button" class="btn-primary" onclick="saveCat()">Сохранить</button><button type="button" class="btn-ghost" onclick="closeModal('catModal')">Отмена</button></div>
  </form>
</div></div>

<!-- ══════════ PAGE MODAL ══════════ -->
<div class="modalOverlay" id="pageModal"><div class="modalBox">
  <button class="modalClose" onclick="closeModal('pageModal')">✕</button><h2 id="pageModalTitle">Страница</h2>
  <form id="pageForm" class="formGrid" style="grid-template-columns:1fr">
    <input type="hidden" name="action" value="save_page"><input type="hidden" name="id" id="page_id">
    <label>Название *<input name="title" id="page_title" required></label>
    <label>Slug<input name="slug" id="page_slug" placeholder="about"></label>
    <label class="checkRow"><input type="checkbox" name="is_active" id="page_active" checked> Активна</label>
    <div class="formActions"><button type="button" class="btn-primary" onclick="savePage()">Сохранить</button><button type="button" class="btn-ghost" onclick="closeModal('pageModal')">Отмена</button></div>
  </form>
</div></div>

<!-- ══════════ NAV MODAL ══════════ -->
<div class="modalOverlay" id="navModal"><div class="modalBox">
  <button class="modalClose" onclick="closeModal('navModal')">✕</button><h2 id="navModalTitle">Пункт меню</h2>
  <form id="navForm" class="formGrid" style="grid-template-columns:1fr">
    <input type="hidden" name="action" value="save_nav"><input type="hidden" name="id" id="nav_id">
    <label>Название<input name="label" id="nav_label" required></label>
    <label>URL<input name="url" id="nav_url" required placeholder="/#catalog"></label>
    <label>Порядок<input name="sort_order" id="nav_sort" type="number" value="10"></label>
    <label class="checkRow"><input type="checkbox" id="nav_active" checked> Показывать</label>
    <label class="checkRow"><input type="checkbox" id="nav_new_tab"> Новая вкладка</label>
    <div class="formActions"><button type="button" class="btn-primary" onclick="saveNav()">Сохранить</button><button type="button" class="btn-ghost" onclick="closeModal('navModal')">Отмена</button></div>
  </form>
</div></div>

<!-- ══════════ SECTION TYPE PICKER ══════════ -->
<div class="modalOverlay" id="typePicker"><div class="modalBox lg">
  <button class="modalClose" onclick="closeModal('typePicker')">✕</button><h2>Тип секции</h2>
  <div class="typePicker">
  <?php foreach($SECTION_TYPES as $tk=>$tm): ?>
    <button type="button" class="typePickerItem" onclick="pickSectionType('<?=$tk?>')"><span class="ico"><?=$tm[0]?></span><span class="nm"><?=h($tm[1])?></span><span class="ds"><?=h($tm[2])?></span></button>
  <?php endforeach; ?>
  </div>
</div></div>

<!-- ══════════ SECTION EDITOR ══════════ -->
<div class="modalOverlay" id="sectionModal"><div class="modalBox lg">
  <button class="modalClose" onclick="closeModal('sectionModal')">✕</button>
  <h2 id="sectionModalTitle">Секция</h2>
  <form id="sectionForm" enctype="multipart/form-data">
    <input type="hidden" name="action" value="save_page_section">
    <input type="hidden" name="id" id="ps_id"><input type="hidden" name="page_id" id="ps_page_id">
    <input type="hidden" name="ps_type" id="ps_type"><input type="hidden" name="old_ps_image" id="ps_old_image">
    <input type="hidden" name="ps_extra" id="ps_extra"><input type="hidden" name="ps_active" value="1">
    <div id="ps_fields"></div>
    <div class="formActions" style="margin-top:14px"><button type="button" class="btn-primary" onclick="saveSection()">Сохранить</button><button type="button" class="btn-ghost" onclick="closeModal('sectionModal')">Отмена</button></div>
  </form>
</div></div>

<div class="toast" id="toast"></div>
<div class="sortToast" id="sortToast">✓ Порядок сохранён</div>

<script>
const API='/admin/index.php';
const AJAX_HEADERS={'X-Requested-With':'XMLHttpRequest'};
const SECTION_TYPES=<?=json_encode($SECTION_TYPES,JSON_UNESCAPED_UNICODE)?>;

function toast(msg,type='ok'){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+type+' show';clearTimeout(window._tt);window._tt=setTimeout(()=>t.classList.remove('show'),2800);}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
async function apiFetch(action,data={}){const fd=new FormData();Object.entries({action,...data}).forEach(([k,v])=>fd.append(k,v));const r=await fetch(API,{method:'POST',body:fd,headers:AJAX_HEADERS});return r.json();}
async function ajaxForm(formId){const form=document.getElementById(formId);const fd=new FormData(form);const r=await fetch(API,{method:'POST',body:fd,headers:AJAX_HEADERS});const d=await r.json();if(d.ok)toast('Сохранено');else toast(d.error||'Ошибка','err');return d;}
function cc(id,cntId){document.getElementById(cntId).textContent=document.getElementById(id).value.length;}
function ccLimit(id,cntId,max){const n=document.getElementById(id).value.length;const el=document.getElementById(cntId);el.textContent=n+' / '+max;el.classList.toggle('over',n>max);}

// sidebar / tabs
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebarBackdrop').classList.toggle('show');}
document.querySelectorAll('.sidebarNav a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const tab=a.dataset.tab;document.querySelectorAll('.sidebarNav a').forEach(x=>x.classList.remove('active'));a.classList.add('active');document.querySelectorAll('.tabContent').forEach(c=>c.style.display='none');const el=document.getElementById('tab-'+tab);if(el)el.style.display='';document.querySelector('.crumb b').textContent=a.textContent.trim();history.replaceState(null,'','?tab='+tab);document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebarBackdrop').classList.remove('show');}));

// modals
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){document.getElementById(id).classList.remove('show');}
document.querySelectorAll('.modalOverlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.modalOverlay.show').forEach(m=>m.classList.remove('show'));closeProductDrawer();}});

function previewImg(input,previewId){if(!input.files||!input.files[0])return;const r=new FileReader();r.onload=e=>{document.getElementById(previewId).innerHTML=`<img src="${e.target.result}">`;};r.readAsDataURL(input.files[0]);}

// ── PRODUCTS ──────────────────────────────────────────────────────────
const productSearch=document.getElementById('productSearch');
if(productSearch)productSearch.oninput=function(){const q=this.value.toLowerCase();document.querySelectorAll('#productRows tr').forEach(r=>r.style.display=r.dataset.name.includes(q)?'':'none');};
document.querySelectorAll('.drawerTab').forEach(btn=>btn.addEventListener('click',()=>{const t=btn.dataset.dtab;document.querySelectorAll('.drawerTab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.drawerTabPanel').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelector(`.drawerTabPanel[data-dtab="${t}"]`).classList.add('active');}));

function pfAutoSlug(){const s=document.getElementById('pf_slug');if(s.dataset.touched)return;const n=document.getElementById('pf_name').value;s.value=n.toLowerCase().trim().replace(/[а-яё]/g,c=>({а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'}[c]||c)).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
document.getElementById('pf_slug').addEventListener('input',function(){this.dataset.touched='1';});
function pfMargin(){const price=+document.getElementById('pf_price').value||0;const cost=+document.getElementById('pf_cost_price').value||0;const m=document.getElementById('pf_margin');if(price>0&&cost>0){m.value=Math.round((price-cost)/price*100)+'%';}else m.value='—';}
function pfFilterSubcats(parentId,selectVal){const sub=document.getElementById('pf_category_id');[...sub.options].forEach(o=>{if(!o.value){o.hidden=false;return;}o.hidden=!(!parentId||o.dataset.parent==parentId);});if(selectVal)sub.value=selectVal;}

function openProductDrawer(p){
  document.getElementById('productDrawerTitle').textContent=p?'Редактировать товар':'Новый товар';
  document.getElementById('productOverlay').classList.add('show');document.getElementById('productDrawer').classList.add('open');document.body.style.overflow='hidden';
  document.querySelectorAll('.drawerTab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.drawerTabPanel').forEach(t=>t.classList.remove('active'));
  document.querySelector('.drawerTab[data-dtab="main"]').classList.add('active');document.querySelector('.drawerTabPanel[data-dtab="main"]').classList.add('active');
  document.getElementById('productForm').reset();document.getElementById('pf_slug').dataset.touched='';
  if(p){
    const set=(id,v)=>document.getElementById(id).value=v==null?'':v;
    set('pf_id',p.id);set('pf_old_image',p.image);set('pf_old_video',p.video);set('pf_name',p.name);set('pf_slug',p.slug);if(p.slug)document.getElementById('pf_slug').dataset.touched='1';
    set('pf_subtitle',p.subtitle);set('pf_description',p.description);set('pf_price',p.price);set('pf_old_price',p.old_price||'');set('pf_cost_price',p.cost_price||'');
    set('pf_weight_g',p.weight_g||12000);set('pf_length_cm',p.length_cm||60);set('pf_width_cm',p.width_cm||60);set('pf_height_cm',p.height_cm||40);
    set('pf_badge',p.badge);set('pf_sort_order',p.sort_order||10);set('pf_specs',p.specs);set('pf_dimensions',p.dimensions);set('pf_materials',p.materials);set('pf_assembly',p.assembly);set('pf_related_ids',p.related_ids);
    set('pf_seo_title',p.seo_title);set('pf_seo_description',p.seo_description);
    document.getElementById('pf_is_active').checked=p.is_active==1;
    document.getElementById('pf_photo_preview').innerHTML=p.image?`<img src="../${p.image}">`:'<span>Нет фото</span>';
    const subOpt=document.querySelector('#pf_category_id option[value="'+p.category_id+'"]');const parentId=subOpt?subOpt.dataset.parent:'';
    document.getElementById('pf_parent_cat').value=parentId&&parentId!=='null'?parentId:'';pfFilterSubcats(parentId,p.category_id);
    document.getElementById('productDeleteBtn').style.display='block';document.getElementById('productDeleteBtn').dataset.id=p.id;
    cc('pf_description','pf_desc_cnt');ccLimit('pf_seo_title','pf_st_cnt',60);ccLimit('pf_seo_description','pf_sd_cnt',160);pfMargin();
    loadProductBlocks(p.id);loadProductMedia(p.id);
  } else {
    document.getElementById('pf_id').value='';document.getElementById('pf_photo_preview').innerHTML='<span>Нет фото</span>';
    document.getElementById('pf_parent_cat').value='';pfFilterSubcats('');
    document.getElementById('productDeleteBtn').style.display='none';
    document.getElementById('pf_blocks_list').innerHTML='<p style="color:var(--muted);font-size:13px">Сохраните товар, чтобы добавить блоки</p>';
    document.getElementById('pf_media_gallery').innerHTML='';pfMargin();
  }
}
function closeProductDrawer(){document.getElementById('productOverlay').classList.remove('show');document.getElementById('productDrawer').classList.remove('open');document.body.style.overflow='';}

// dropzone
(function(){const dz=document.getElementById('pf_dropzone');const inp=document.getElementById('pf_gallery_input');if(!dz)return;
['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');}));
dz.addEventListener('drop',e=>{if(e.dataTransfer.files.length){inp.files=e.dataTransfer.files;pfQueueGallery(inp);}});})();
function pfQueueGallery(input){const g=document.getElementById('pf_media_gallery');const n=input.files.length;if(n)g.insertAdjacentHTML('afterbegin',`<div style="grid-column:1/-1;font-size:12px;color:var(--copper)">📎 ${n} фото будет загружено при сохранении</div>`);}

async function submitProductForm(){
  const form=document.getElementById('productForm');const btn=document.getElementById('productSaveBtn');btn.disabled=true;btn.textContent='Сохранение...';
  try{const r=await fetch(API,{method:'POST',body:new FormData(form),headers:AJAX_HEADERS});const d=await r.json();
    if(d.ok){toast('Товар сохранён');if(d.id){document.getElementById('pf_id').value=d.id;document.getElementById('pb_product_id').value=d.id;document.getElementById('productDeleteBtn').style.display='block';document.getElementById('productDeleteBtn').dataset.id=d.id;}
      if(d.image){document.getElementById('pf_old_image').value=d.image;document.getElementById('pf_photo_preview').innerHTML=`<img src="../${d.image}">`;}
      setTimeout(()=>location.reload(),700);
    } else toast(d.error||'Ошибка','err');
  }catch(e){toast('Ошибка: '+e.message,'err');}
  btn.disabled=false;btn.textContent='Сохранить';
}
async function deleteProduct(){const id=document.getElementById('productDeleteBtn').dataset.id;if(!id||!confirm('Удалить товар?'))return;const d=await apiFetch('delete_product',{id});if(d.ok){toast('Удалено');closeProductDrawer();document.querySelector(`#productRows tr[data-id="${id}"]`)?.remove();}else toast('Ошибка','err');}
async function deleteProductRow(id,btn){if(!confirm('Удалить товар?'))return;const d=await apiFetch('delete_product',{id});if(d.ok){toast('Удалено');btn.closest('tr').remove();}else toast('Ошибка','err');}
async function toggleProduct(id,el){const d=await apiFetch('toggle_product',{id});if(!d.ok)el.checked=!el.checked;else toast(d.is_active?'Показан':'Скрыт');}

// product media
async function loadProductMedia(pid){const g=document.getElementById('pf_media_gallery');if(!pid)return;g.innerHTML='<p style="color:var(--muted);font-size:12px">Загрузка...</p>';
  const fd=new FormData();fd.append('action','get_media');fd.append('product_id',pid);const r=await fetch(API,{method:'POST',body:fd,headers:AJAX_HEADERS});const items=await r.json();
  if(!items.length){g.innerHTML='<p style="color:var(--muted);font-size:12px">Фото не добавлены</p>';return;}
  g.innerHTML=items.map(m=>`<div class="mediaItem2" data-id="${m.id}"><img src="../${m.path}"><button class="mediaRemove" onclick="deleteMedia(${m.id},${pid},this)">✕</button></div>`).join('');
}
async function deleteMedia(mid,pid,btn){btn.disabled=true;const d=await apiFetch('delete_media',{media_id:mid,product_id:pid});if(d.ok){toast('Фото удалено');btn.closest('.mediaItem2').remove();}else{toast('Ошибка','err');btn.disabled=false;}}

// product blocks
async function loadProductBlocks(pid){const list=document.getElementById('pf_blocks_list');if(!pid)return;list.innerHTML='<p style="color:var(--muted);font-size:13px">Загрузка...</p>';
  const r=await fetch('/admin/get_product_blocks.php?pid='+pid);const blocks=await r.json();
  if(!blocks.length){list.innerHTML='<p style="color:var(--muted);font-size:13px;text-align:center;padding:14px 0">Блоков нет</p>';return;}
  const labels={included:'Комплектация',how:'Как использовать',features:'Преимущества',lifestyle:'Lifestyle',text_image:'Текст+фото'};
  list.innerHTML=blocks.map(b=>`<div class="sectionCard" data-id="${b.id}"><span class="typePill">${labels[b.type]||b.type}</span><span class="sTitle">${esc(b.title)||'—'}</span><button type="button" class="btn-ghost btn-sm" onclick='editPbBlock(${JSON.stringify(b).replace(/'/g,"&#39;")})'>✏</button><button type="button" class="btn-danger btn-sm" onclick="deletePbBlock(${b.id},this)">✕</button></div>`).join('');
}
function addPbBlock(){const pid=document.getElementById('pf_id').value;if(!pid){toast('Сначала сохраните товар','err');return;}['pb_id','pb_old_image','pb_title','pb_text','pb_extra'].forEach(i=>document.getElementById(i).value='');document.getElementById('pb_product_id').value=pid;document.getElementById('pbBlockEditor').style.display='block';}
function editPbBlock(b){document.getElementById('pb_id').value=b.id;document.getElementById('pb_product_id').value=b.product_id;document.getElementById('pb_old_image').value=b.image||'';document.getElementById('pb_type').value=b.type;document.getElementById('pb_title').value=b.title||'';document.getElementById('pb_text').value=b.text||'';document.getElementById('pb_extra').value=b.extra||'';document.getElementById('pbBlockEditor').style.display='block';}
async function submitPbBlock(){const r=await fetch(API,{method:'POST',body:new FormData(document.getElementById('pbBlockForm')),headers:AJAX_HEADERS});const d=await r.json();if(d.ok){toast('Блок сохранён');document.getElementById('pbBlockEditor').style.display='none';loadProductBlocks(document.getElementById('pf_id').value);}else toast(d.error||'Ошибка','err');}
async function deletePbBlock(id,btn){if(!confirm('Удалить блок?'))return;const d=await apiFetch('delete_product_block',{id});if(d.ok){toast('Удалено');btn.closest('.sectionCard').remove();}else toast('Ошибка','err');}

async function runYandexSEO(){
  const btn=document.getElementById('seoAiBtn'),status=document.getElementById('seoAiStatus');
  const name=document.getElementById('pf_name').value,desc=document.getElementById('pf_description').value,specs=document.getElementById('pf_specs').value;
  const catEl=document.getElementById('pf_category_id');const cat=catEl.options[catEl.selectedIndex]?.textContent||'';
  if(!name){status.textContent='⚠ Заполните название';status.style.color='#f08585';return;}
  btn.disabled=true;btn.textContent='⏳ Генерирую...';status.style.color='var(--muted)';status.textContent='';
  try{const d=await apiFetch('yandex_seo',{name,description:desc,specs,category:cat});
    if(d.error){status.style.color='#f08585';status.textContent='⚠ '+d.error;}
    else{if(d.data?.seo_title){document.getElementById('pf_seo_title').value=d.data.seo_title;ccLimit('pf_seo_title','pf_st_cnt',60);}if(d.data?.seo_description){document.getElementById('pf_seo_description').value=d.data.seo_description;ccLimit('pf_seo_description','pf_sd_cnt',160);}status.style.color='var(--st-done)';status.textContent='✓ Готово'+(d.data.keywords?' · '+d.data.keywords:'');}
  }catch(e){status.style.color='#f08585';status.textContent='⚠ '+e.message;}
  btn.disabled=false;btn.textContent='✨ Сгенерировать SEO (YandexGPT)';
}

// ── CATEGORIES ───────────────────────────────────────────────────────
function openCatModal(c){document.getElementById('catModalTitle').textContent=c?'Редактировать':'Новая категория';const g=id=>document.getElementById(id);g('cat_id').value=c?.id||'';g('cat_name').value=c?.name||'';g('cat_slug').value=c?.slug||'';g('cat_seo_title').value=c?.seo_title||'';g('cat_seo_desc').value=c?.seo_description||'';g('cat_sort').value=c?.sort_order||10;g('cat_active').checked=!c||c.is_active==1;g('cat_parent_id').value=c?.parent_id||'';const pv=g('cat_img_preview');if(c?.image){g('cat_img_preview_img').src='/'+c.image;pv.style.display='block';}else pv.style.display='none';openModal('catModal');}
async function saveCat(){const fd=new FormData(document.getElementById('catForm'));fd.set('is_active',document.getElementById('cat_active').checked?'1':'0');const r=await fetch(API,{method:'POST',body:fd,headers:AJAX_HEADERS});const d=await r.json();if(!d.ok){toast(d.error||'Ошибка','err');return;}toast('Сохранено');closeModal('catModal');location.reload();}
async function deleteCat(id,btn){if(!confirm('Удалить категорию?'))return;const d=await apiFetch('delete_category',{id});if(d.ok){toast('Удалено');btn.closest('.navItemRow').remove();}else toast('Ошибка','err');}
async function toggleCat(id,btn){const d=await apiFetch('toggle_category',{id});if(d.is_active!==undefined){const a=d.is_active===1;btn.className='badge '+(a?'badge-active':'badge-hidden');btn.textContent=a?'Активна':'Скрыта';toast(a?'Показана':'Скрыта');}}

// ── PAGES ────────────────────────────────────────────────────────────
function openPageModal(pg){document.getElementById('pageModalTitle').textContent=pg?'Настройки страницы':'Новая страница';document.getElementById('page_id').value=pg?.id||'';document.getElementById('page_title').value=pg?.title||'';document.getElementById('page_slug').value=pg?.slug||'';document.getElementById('page_active').checked=!pg||pg.is_active==1;openModal('pageModal');}
async function savePage(){const fd=new FormData(document.getElementById('pageForm'));fd.set('is_active',document.getElementById('page_active').checked?'1':'0');const r=await fetch(API,{method:'POST',body:fd,headers:AJAX_HEADERS});const d=await r.json();if(!d.ok){toast(d.error||'Ошибка','err');return;}toast('Сохранено');closeModal('pageModal');if(!document.getElementById('page_id').value&&d.id)location.href='?tab=pages&pid='+d.id;else location.reload();}
async function deletePage(id,btn){if(!confirm('Удалить страницу со всеми секциями?'))return;const d=await apiFetch('delete_page',{id});if(d.ok){toast('Удалено');btn.closest('.navItemRow').remove();}else toast('Ошибка','err');}

// ── PAGE SECTION BUILDER ─────────────────────────────────────────────
const FIELD_DEFS={
  hero_simple:[['eyebrow','Eyebrow','input'],['title','Заголовок (H1)','input'],['text','Текст','textarea'],['cta_text','Текст кнопки','input'],['cta_link','Ссылка кнопки','input']],
  text:[['eyebrow','Eyebrow','input'],['title','Заголовок (H2)','input'],['text','Абзац','textarea'],['cta_text','Текст кнопки','input'],['cta_link','Ссылка кнопки','input']],
  text_image:[['eyebrow','Eyebrow','input'],['title','Заголовок','input'],['text','Текст','textarea'],['cta_text','Текст кнопки','input'],['cta_link','Ссылка кнопки','input'],['image','Фото','file']],
  cards:[['title','Заголовок блока','input'],['text','Подпись','textarea'],['__cards','Карточки','cards']],
  contacts_block:[['title','Заголовок','input'],['__contacts','Контакты','contacts']],
  quote:[['text','Текст цитаты','textarea'],['title','Автор / подпись','input']],
  products_grid:[['eyebrow','Eyebrow','input'],['title','Заголовок','input'],['text','Подпись','textarea']],
  lead_form:[['eyebrow','Eyebrow','input'],['title','Заголовок','input'],['text','Текст','textarea'],['cta_text','Текст кнопки','input']],
};
let curSection={page_id:0};

function openTypePicker(pageId){curSection={page_id:pageId};openModal('typePicker');}
function pickSectionType(type){closeModal('typePicker');renderSectionForm(type,{},curSection.page_id);}
function openSectionEditor(ps,pageId){renderSectionForm(ps.type,ps,pageId);}

function renderSectionForm(type,ps,pageId){
  const meta=SECTION_TYPES[type]||['📄',type,''];
  document.getElementById('sectionModalTitle').innerHTML=meta[0]+' '+esc(meta[1]);
  document.getElementById('ps_id').value=ps.id||'';
  document.getElementById('ps_page_id').value=pageId;
  document.getElementById('ps_type').value=type;
  document.getElementById('ps_old_image').value=ps.image||'';
  const defs=FIELD_DEFS[type]||FIELD_DEFS.text;
  let html='';
  // extra is stored as pipe-separated "label:value" items (compatible with page.php)
  const extraItems=(ps.extra||'').split('|').map(s=>s.trim()).filter(Boolean).map(s=>{const i=s.indexOf(':');return i<0?[s,'']:[s.slice(0,i).trim(),s.slice(i+1).trim()];});
  defs.forEach(([key,label,kind])=>{
    if(kind==='input')html+=`<label class="drawerLabel">${label}<input name="ps_${key}" value="${esc(ps[key])}"></label>`;
    else if(kind==='textarea')html+=`<label class="drawerLabel">${label}<textarea name="ps_${key}" rows="3">${esc(ps[key])}</textarea></label>`;
    else if(kind==='file'){html+=`<label class="drawerLabel">${label}<input type="file" name="ps_image" accept="image/*"></label>`;if(ps.image)html+=`<img src="../${esc(ps.image)}" style="height:70px;border-radius:8px;margin-bottom:10px">`;}
    else if(kind==='cards'){html+=`<div class="drawerLabel" style="margin-bottom:6px">Карточки (заголовок → описание)</div><div id="repCards"></div><button type="button" class="btn-ghost btn-sm" onclick="addRep('cards','','')">+ Добавить карточку</button>`;}
    else if(kind==='contacts'){html+=`<div class="drawerLabel" style="margin-bottom:6px">Контакты (метка → значение)</div><div id="repContacts"></div><button type="button" class="btn-ghost btn-sm" onclick="addRep('contacts','','')">+ Добавить контакт</button>`;}
  });
  document.getElementById('ps_fields').innerHTML=html;
  if(type==='cards'){extraItems.forEach(([a,b])=>addRep('cards',a,b));if(!extraItems.length)addRep('cards','','');}
  if(type==='contacts_block'){extraItems.forEach(([a,b])=>addRep('contacts',a,b));if(!extraItems.length)addRep('contacts','','');}
  openModal('sectionModal');
}
function addRep(kind,a,b){
  const wrap=document.getElementById(kind==='cards'?'repCards':'repContacts');
  const ph=kind==='cards'?['Заголовок','Описание']:['Метка','Значение'];
  const row=document.createElement('div');row.className='repRow';
  row.innerHTML=`<input class="rep-a" placeholder="${ph[0]}" value="${esc(a)}"><input class="rep-b" placeholder="${ph[1]}" value="${esc(b)}"><button type="button" class="repDel" onclick="this.parentNode.remove()">✕</button>`;
  wrap.appendChild(row);
}
async function saveSection(){
  const type=document.getElementById('ps_type').value;
  // serialise repeating rows to pipe-separated "label:value" (page.php format)
  if(type==='cards'||type==='contacts_block'){
    const wrap=document.getElementById(type==='cards'?'repCards':'repContacts');
    const items=[];wrap.querySelectorAll('.repRow').forEach(r=>{const a=r.querySelector('.rep-a').value.trim();const b=r.querySelector('.rep-b').value.trim();if(a||b)items.push(b?a+':'+b:a);});
    document.getElementById('ps_extra').value=items.join('|');
  } else document.getElementById('ps_extra').value='';
  const fd=new FormData(document.getElementById('sectionForm'));
  const r=await fetch(API,{method:'POST',body:fd,headers:AJAX_HEADERS});const d=await r.json();
  if(!d.ok){toast(d.error||'Ошибка','err');return;}toast('Секция сохранена');closeModal('sectionModal');setTimeout(()=>location.reload(),600);
}
async function deleteSection(id,pageId,btn){if(!confirm('Удалить секцию?'))return;const d=await apiFetch('delete_page_section',{id,page_id:pageId});if(d.ok){toast('Удалено');const c=btn.closest('.sectionCard');c.style.opacity='0';setTimeout(()=>c.remove(),250);}else toast('Ошибка','err');}

// ── NAV ──────────────────────────────────────────────────────────────
function openNavModal(ni){document.getElementById('navModalTitle').textContent=ni?'Редактировать':'Новый пункт';document.getElementById('nav_id').value=ni?.id||'';document.getElementById('nav_label').value=ni?.label||'';document.getElementById('nav_url').value=ni?.url||'';document.getElementById('nav_sort').value=ni?.sort_order||10;document.getElementById('nav_active').checked=!ni||ni.is_active==1;document.getElementById('nav_new_tab').checked=ni?.open_new_tab==1;openModal('navModal');}
async function saveNav(){const fd=new FormData(document.getElementById('navForm'));fd.set('is_active',document.getElementById('nav_active').checked?'1':'0');fd.set('open_new_tab',document.getElementById('nav_new_tab').checked?'1':'0');const r=await fetch(API,{method:'POST',body:fd,headers:AJAX_HEADERS});const d=await r.json();if(!d.ok){toast(d.error||'Ошибка','err');return;}toast('Сохранено');closeModal('navModal');location.reload();}
async function deleteNav(id,btn){if(!confirm('Удалить пункт?'))return;const d=await apiFetch('delete_nav',{id});if(d.ok){toast('Удалено');btn.closest('.navItemRow').remove();}else toast('Ошибка','err');}

// ── REVIEWS ──────────────────────────────────────────────────────────
async function approveReview(id,btn){const d=await apiFetch('approve_review',{id});if(d.ok){toast('Опубликован');btn.closest('.reviewCard').querySelector('.pendingBadge')?.remove();btn.remove();}else toast('Ошибка','err');}
async function deleteReview(id,btn){if(!confirm('Удалить отзыв?'))return;const d=await apiFetch('delete_review',{id});if(d.ok){toast('Удалено');btn.closest('.reviewCard').remove();}else toast('Ошибка','err');}

// ── DRAG SORT (generic) ──────────────────────────────────────────────
function makeSortable(container,itemSel,handleSel,action){
  const box=typeof container==='string'?document.getElementById(container):container;if(!box)return;let dragging=null;
  box.querySelectorAll(itemSel).forEach(item=>{
    const h=item.querySelector(handleSel);if(!h)return;h.setAttribute('draggable','true');
    h.addEventListener('dragstart',e=>{dragging=item;item.style.opacity='.4';e.dataTransfer.effectAllowed='move';});
    h.addEventListener('dragend',()=>{item.style.opacity='';dragging=null;box.querySelectorAll(itemSel).forEach(r=>r.classList.remove('dnd-over'));const ids=[...box.querySelectorAll(itemSel)].map(r=>r.dataset.id);apiFetch(action,{ids:JSON.stringify(ids)}).then(()=>{const t=document.getElementById('sortToast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800);});});
    item.addEventListener('dragover',e=>{e.preventDefault();if(!dragging||dragging===item)return;box.querySelectorAll(itemSel).forEach(r=>r.classList.remove('dnd-over'));item.classList.add('dnd-over');const rect=item.getBoundingClientRect();if(e.clientY<rect.top+rect.height/2)box.insertBefore(dragging,item);else box.insertBefore(dragging,item.nextSibling);});
  });
}
makeSortable('productRows','tr','.dragHandle','sort_products');
makeSortable('catList','.navItemRow','.navDragHandle','sort_categories');
makeSortable('navList','.navItemRow','.navDragHandle','sort_nav');
makeSortable('pageSections','.sectionCard','.navDragHandle','sort_page_sections');
</script>
</body>
</html>
