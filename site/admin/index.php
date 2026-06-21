<?php
require __DIR__.'/../includes/db.php'; require __DIR__.'/../includes/auth.php';
$pdo=db();
// Миграция products — новые поля (выполняется всегда при загрузке)
foreach(['cost_price INTEGER DEFAULT 0','weight_g INTEGER DEFAULT 12000','length_cm INTEGER DEFAULT 60','width_cm INTEGER DEFAULT 60','height_cm INTEGER DEFAULT 40','is_popular INTEGER DEFAULT 0'] as $_col){
  try{$pdo->exec("ALTER TABLE products ADD COLUMN $_col");}catch(Exception $e){}
}
if(!is_admin()){
  $err=''; if($_SERVER['REQUEST_METHOD']==='POST'){ $pass=$_POST['password']??''; if(password_verify($pass, ADMIN_PASSWORD_HASH)){$_SESSION['admin']=true; header('Location:/admin'); exit;} else $err='Неверный пароль'; }
  ?><!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход в кабинет LUKA OUTDOOR</title><link rel="stylesheet" href="admin.css"></head><body class="loginPage"><form method="post" class="loginBox"><img src="../assets/images/luka-logo.svg" alt=""><b>LUKA OUTDOOR / ADMIN</b><h1>Вход в кабинет</h1><?php if($err):?><p class="alert"><?=$err?></p><?php endif;?><input type="password" name="password" placeholder="Пароль" required autofocus><button>Войти</button><a href="/">← Вернуться на сайт</a></form></body></html><?php exit;
}
function upload_file($field){
  if(empty($_FILES[$field]['tmp_name'])) return '';
  $ext=strtolower(pathinfo($_FILES[$field]['name'], PATHINFO_EXTENSION));
  if(!in_array($ext,['jpg','jpeg','png','webp','gif','mp4','webm'])) return '';
  $dir=__DIR__.'/../assets/uploads'; if(!is_dir($dir)) mkdir($dir,0775,true);
  $name=date('YmdHis').'-'.bin2hex(random_bytes(4)).'.'.$ext; $path=$dir.'/'.$name;
  if(move_uploaded_file($_FILES[$field]['tmp_name'],$path)) return 'assets/uploads/'.$name;
  return '';
}
function upload_files($field){
  $saved=[];
  if(empty($_FILES[$field]['name']) || !is_array($_FILES[$field]['name'])) return $saved;
  $dir=__DIR__.'/../assets/uploads'; if(!is_dir($dir)) mkdir($dir,0775,true);
  foreach($_FILES[$field]['name'] as $i=>$original){
    if(empty($_FILES[$field]['tmp_name'][$i])) continue;
    $ext=strtolower(pathinfo($original, PATHINFO_EXTENSION));
    if(!in_array($ext,['jpg','jpeg','png','webp','gif'])) continue;
    $name=date('YmdHis').'-'.bin2hex(random_bytes(4)).'.'.$ext;
    $path=$dir.'/'.$name;
    if(move_uploaded_file($_FILES[$field]['tmp_name'][$i],$path)) $saved[]='assets/uploads/'.$name;
  }
  return $saved;
}
if(isset($_GET['export']) && $_GET['export']==='orders'){
  header('Content-Type:text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="volga-orders.csv"');
  $out=fopen('php://output','w'); fputcsv($out,['id','date','status','name','phone','city','total','comment','items','manager_note'],';');
  $orders=$pdo->query("SELECT * FROM orders ORDER BY id DESC")->fetchAll(PDO::FETCH_ASSOC);
  foreach($orders as $o){$it=$pdo->prepare('SELECT product_name,price,qty FROM order_items WHERE order_id=?');$it->execute([$o['id']]);$items=[];foreach($it->fetchAll(PDO::FETCH_ASSOC) as $i){$items[]=$i['product_name'].' x'.$i['qty'].' '.money($i['price']);}fputcsv($out,[$o['id'],$o['created_at'],$o['status'],$o['customer_name'],$o['phone'],$o['address'],$o['total'],$o['comment'],implode(' | ',$items),$o['manager_note']],';');}
  exit;
}
if($_SERVER['REQUEST_METHOD']==='POST'){
  $a=$_POST['action']??'';
  if($a==='save_product'){
    $id=(int)($_POST['id']??0); $img=upload_file('image') ?: ($_POST['old_image']??''); $vid=upload_file('video') ?: ($_POST['old_video']??''); $slug=trim($_POST['slug']??'') ?: slugify($_POST['name']??'product');
    $relIds=implode(',',array_filter(array_map('intval',explode(',',$_POST['related_ids']??''))));$data=[(int)$_POST['category_id'],trim($_POST['name']),$slug,trim($_POST['subtitle']??''),trim($_POST['description']??''),(int)$_POST['price'],(int)($_POST['old_price']??0),$img,$vid,trim($_POST['specs']??''),trim($_POST['dimensions']??''),trim($_POST['materials']??''),trim($_POST['assembly']??''),trim($_POST['badge']??''),trim($_POST['seo_title']??''),trim($_POST['seo_description']??''),isset($_POST['is_active'])?1:0,(int)($_POST['sort_order']??0),$relIds,(int)($_POST['cost_price']??0),(int)($_POST['weight_g']??12000),(int)($_POST['length_cm']??60),(int)($_POST['width_cm']??60),(int)($_POST['height_cm']??40)];
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
          $rel='assets/uploads/'.$name;
          $sort+=10;
          $pdo->prepare('INSERT INTO product_media(product_id,path,type,sort_order) VALUES(?,?,?,?)')->execute([$id,$rel,'image',$sort]);
          if(!$img){ $img=$rel; $pdo->prepare('UPDATE products SET image=? WHERE id=?')->execute([$img,$id]); }
        }
      }
    }
    // AJAX-ответ
    if(!empty($_SERVER['HTTP_X_REQUESTED_WITH'])){
      header('Content-Type: application/json; charset=utf-8');
      echo json_encode(['ok'=>true,'id'=>$id,'image'=>$img]); exit;
    }
  }
  if($a==='delete_media'){$mid=(int)$_POST['media_id'];$pid=(int)$_POST['product_id'];$st=$pdo->prepare('SELECT path FROM product_media WHERE id=?');$st->execute([$mid]);$path=$st->fetchColumn();$pdo->prepare('DELETE FROM product_media WHERE id=?')->execute([$mid]); if($path && is_file(__DIR__.'/../'.$path)) @unlink(__DIR__.'/../'.$path);
    if(!empty($_SERVER['HTTP_X_REQUESTED_WITH'])){header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>true]);exit;}
    header('Location:/admin?tab=products#product-'.$pid); exit;}
  if($a==='get_media'){
    header('Content-Type: application/json; charset=utf-8');
    $pid=(int)($_POST['product_id']??0);
    $st=$pdo->prepare('SELECT * FROM product_media WHERE product_id=? AND type=\'image\' ORDER BY sort_order,id');
    $st->execute([$pid]);
    echo json_encode($st->fetchAll(PDO::FETCH_ASSOC)); exit;
  }
  if($a==='delete_product'){
    $pdo->prepare('DELETE FROM products WHERE id=?')->execute([(int)$_POST['id']]);
    if(!empty($_SERVER['HTTP_X_REQUESTED_WITH'])){header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>true]);exit;}
  }
  if($a==='save_product_block'){
    $pid=(int)$_POST['product_id']; $bid=(int)($_POST['id']??0);
    $img=upload_file('pb_image') ?: ($_POST['old_pb_image']??'');
    $data=[trim($_POST['pb_type']??'how'),trim($_POST['pb_title']??''),trim($_POST['pb_subtitle']??''),trim($_POST['pb_text']??''),$img,trim($_POST['pb_extra']??''),(int)($_POST['pb_sort']??10),isset($_POST['pb_active'])?1:0,$pid];
    if($bid){$data[]=$bid;$pdo->prepare('UPDATE product_blocks SET type=?,title=?,subtitle=?,text=?,image=?,extra=?,sort_order=?,is_active=?,product_id=? WHERE id=?')->execute($data);}
    else{$pdo->prepare('INSERT INTO product_blocks(type,title,subtitle,text,image,extra,sort_order,is_active,product_id) VALUES(?,?,?,?,?,?,?,?,?)')->execute($data);}
    header('Location:/admin?tab=products'); exit;
  }
  if($a==='delete_product_block'){$pdo->prepare('DELETE FROM product_blocks WHERE id=?')->execute([(int)$_POST['id']]);}
  if($a==='sort_product_blocks'){
    $ids=json_decode($_POST['ids']??'[]',true);
    foreach($ids as $i=>$id){$pdo->prepare('UPDATE product_blocks SET sort_order=? WHERE id=?')->execute([($i+1)*10,(int)$id]);}
    http_response_code(200); echo 'ok'; exit;
  }
// save_category: handled via AJAX handler below
  if($a==='delete_category'){$pdo->prepare('DELETE FROM categories WHERE id=?')->execute([(int)$_POST['id']]);}
  if($a==='update_order'){$pdo->prepare('UPDATE orders SET status=?, manager_note=? WHERE id=?')->execute([$_POST['status'],trim($_POST['manager_note']??''),(int)$_POST['id']]);}
  if($a==='delete_order'){$pdo->prepare('DELETE FROM orders WHERE id=?')->execute([(int)$_POST['id']]);}
  if($a==='save_page'){
    if(isset($_SERVER['HTTP_X_REQUESTED_WITH'])) goto skip_page_redirect;
    $id=(int)($_POST['id']??0);
    $slug=trim($_POST['slug']??'');
    if(!$slug) $slug=slugify($_POST['title']??'page');
    $data=[trim($_POST['title']),$slug,trim($_POST['seo_title']??''),trim($_POST['seo_description']??''),isset($_POST['is_active'])?1:0,isset($_POST['show_in_nav'])?1:0,trim($_POST['nav_label']??''),(int)($_POST['sort_order']??10)];
    if($id){$data[]=$id;$pdo->prepare('UPDATE pages SET title=?,slug=?,seo_title=?,seo_description=?,is_active=?,show_in_nav=?,nav_label=?,sort_order=? WHERE id=?')->execute($data);}
    else{$pdo->prepare('INSERT INTO pages(title,slug,seo_title,seo_description,is_active,show_in_nav,nav_label,sort_order) VALUES(?,?,?,?,?,?,?,?)')->execute($data); $id=(int)$pdo->lastInsertId();}
    header('Location:/admin?tab=pages&pid='.$id); exit;
    skip_page_redirect:;
  }
  if($a==='delete_page'){$pdo->prepare('DELETE FROM pages WHERE id=?')->execute([(int)$_POST['id']]);header('Location:/admin?tab=pages');exit;}
  if($a==='save_page_section'){
    $id=(int)($_POST['id']??0); $pid=(int)$_POST['page_id'];
    $img=upload_file('ps_image') ?: ($_POST['old_ps_image']??'');
    $data=[trim($_POST['ps_type']??'text'),trim($_POST['ps_eyebrow']??''),trim($_POST['ps_title']??''),trim($_POST['ps_subtitle']??''),trim($_POST['ps_text']??''),$img,trim($_POST['ps_cta_text']??''),trim($_POST['ps_cta_link']??''),trim($_POST['ps_extra']??''),(int)($_POST['ps_sort']??10),(int)(($_POST['ps_active']??1)?1:0),$pid];
    if($id){$data[]=$id;$pdo->prepare('UPDATE page_sections SET type=?,eyebrow=?,title=?,subtitle=?,text=?,image=?,cta_text=?,cta_link=?,extra=?,sort_order=?,is_active=?,page_id=? WHERE id=?')->execute($data);}
    else{$pdo->prepare('INSERT INTO page_sections(type,eyebrow,title,subtitle,text,image,cta_text,cta_link,extra,sort_order,is_active,page_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')->execute($data); $id=(int)$pdo->lastInsertId();}
    if(!empty($_SERVER['HTTP_X_REQUESTED_WITH'])){header('Content-Type: application/json');echo json_encode(['ok'=>true,'id'=>$id]);exit;}
    header('Location:/admin?tab=pages&pid='.$pid); exit;
  }
  if($a==='delete_page_section'){$pid=(int)$_POST['page_id'];$pdo->prepare('DELETE FROM page_sections WHERE id=?')->execute([(int)$_POST['id']]);
    if(!empty($_SERVER['HTTP_X_REQUESTED_WITH'])){header('Content-Type: application/json');echo json_encode(['ok'=>true]);exit;}
    header('Location:/admin?tab=pages&pid='.$pid);exit;
  }
  if($a==='save_nav'){
    $id=(int)($_POST['id']??0);
    $data=[trim($_POST['label']),trim($_POST['url']),(int)($_POST['sort_order']??10),(int)($_POST['is_active']??0),(int)($_POST['open_new_tab']??0)];
    if($id){$data[]=$id;$pdo->prepare('UPDATE nav_items SET label=?,url=?,sort_order=?,is_active=?,open_new_tab=? WHERE id=?')->execute($data);}
    else{$pdo->prepare('INSERT INTO nav_items(label,url,sort_order,is_active,open_new_tab) VALUES(?,?,?,?,?)')->execute($data);}
    if(!isset($_SERVER['HTTP_X_REQUESTED_WITH'])) { header('Location:/admin?tab=nav'); exit; }
    echo json_encode(['ok'=>true]); exit;
  }
  if($a==='delete_nav'){$pdo->prepare('DELETE FROM nav_items WHERE id=?')->execute([(int)$_POST['id']]);
    if(!isset($_SERVER['HTTP_X_REQUESTED_WITH'])) { header('Location:/admin?tab=nav'); exit; }
    echo json_encode(['ok'=>true]); exit;
  }
  if($a==='sort_nav'){
    $ids=json_decode($_POST['ids']??'[]',true);
    foreach($ids as $i=>$id){$pdo->prepare('UPDATE nav_items SET sort_order=? WHERE id=?')->execute([($i+1)*10,(int)$id]);}
    http_response_code(200); echo 'ok'; exit;
  }
  if($a==='save_block'){
    $id=(int)($_POST['id']??0); $img=upload_file('image') ?: ($_POST['old_image']??'');
    $data=[trim($_POST['type']??'text_image'),trim($_POST['label']??''),trim($_POST['eyebrow']??''),trim($_POST['title']??''),trim($_POST['subtitle']??''),trim($_POST['text']??''),$img,trim($_POST['cta_text']??''),trim($_POST['cta_link']??''),trim($_POST['extra']??''),(int)($_POST['sort_order']??10),isset($_POST['is_active'])?1:0];
    if($id){$data[]=$id;$pdo->prepare('UPDATE page_blocks SET type=?,label=?,eyebrow=?,title=?,subtitle=?,text=?,image=?,cta_text=?,cta_link=?,extra=?,sort_order=?,is_active=? WHERE id=?')->execute($data);}
    else {$pdo->prepare('INSERT INTO page_blocks(type,label,eyebrow,title,subtitle,text,image,cta_text,cta_link,extra,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')->execute($data);}
  }
  if($a==='delete_block'){
    $pdo->prepare('DELETE FROM page_blocks WHERE id=?')->execute([(int)$_POST['id']]);
    if(!empty($_SERVER['HTTP_X_REQUESTED_WITH'])){header('Content-Type: application/json');echo json_encode(['ok'=>true]);exit;}
    header('Location:/admin/index.php?tab=blocks');exit;
  }
  if($a==='toggle_block'){
    $pdo->prepare('UPDATE page_blocks SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=?')->execute([(int)$_POST['id']]);
    if(!empty($_SERVER['HTTP_X_REQUESTED_WITH'])){$row=$pdo->prepare('SELECT is_active FROM page_blocks WHERE id=?');$row->execute([(int)$_POST['id']]);header('Content-Type: application/json');echo json_encode(['ok'=>true,'is_active'=>(int)$row->fetchColumn()]);exit;}
    header('Location:/admin/index.php?tab=blocks');exit;
  }
  if($a==='duplicate_block'){
    $id=(int)$_POST['id'];
    $st=$pdo->prepare('SELECT * FROM page_blocks WHERE id=?'); $st->execute([$id]); $b=$st->fetch(PDO::FETCH_ASSOC);
    if($b){$pdo->prepare('INSERT INTO page_blocks(type,label,eyebrow,title,subtitle,text,image,cta_text,cta_link,extra,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$b['type'],$b['label'].' — копия',$b['eyebrow'],$b['title'],$b['subtitle'],$b['text'],$b['image'],$b['cta_text'],$b['cta_link'],$b['extra'],(int)$b['sort_order']+1,0]);}
  }
  if($a==='sort_blocks'){
    $ids=json_decode($_POST['ids']??'[]',true);
    foreach($ids as $i=>$id){$pdo->prepare('UPDATE page_blocks SET sort_order=? WHERE id=?')->execute([($i+1)*10,(int)$id]);}
    http_response_code(200); echo 'ok'; exit;
  }
  if($a==='sort_products'){
    $ids=json_decode($_POST['ids']??'[]',true);
    foreach($ids as $i=>$id){$pdo->prepare('UPDATE products SET sort_order=? WHERE id=?')->execute([($i+1)*10,(int)$id]);}
    http_response_code(200); echo 'ok'; exit;
  }
  if($a==='save_settings'){foreach(['site_title','site_description','phone','telegram','whatsapp','instagram','youtube','og_image','yandex_api_key'] as $k){$pdo->prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')->execute([$k,trim($_POST[$k]??'')]);}}
  if($a==='yandex_seo'){
    header('Content-Type: application/json; charset=utf-8');
    $apiKey = setting('yandex_api_key');
    if(!$apiKey){ echo json_encode(['error'=>'API-ключ не настроен']); exit; }
    $name    = trim($_POST['name'] ?? '');
    $desc    = trim($_POST['description'] ?? '');
    $specs   = trim($_POST['specs'] ?? '');
    $cat     = trim($_POST['category'] ?? '');
    $prompt  = "Ты SEO-специалист для российского интернет-магазина премиального outdoor оборудования LUKA OUTDOOR (костровые системы, сталь, живой огонь).\n\nТовар: {$name}\nКатегория: {$cat}\nОписание: {$desc}\nХарактеристики: {$specs}\n\nСгенерируй SEO-данные для Яндекса. Верни ТОЛЬКО JSON без лишнего текста:\n{\"seo_title\":\"заголовок до 60 символов\",\"seo_description\":\"описание 140-160 символов\",\"keywords\":\"5-7 ключевых слов через запятую\"}";
    $ch = curl_init('https://llm.api.cloud.yandex.net/foundationModels/v1/completion');
    curl_setopt_array($ch,[
      CURLOPT_RETURNTRANSFER=>true,
      CURLOPT_POST=>true,
      CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Api-Key '.$apiKey],
      CURLOPT_POSTFIELDS=>json_encode(['modelUri'=>'gpt://b1g0l7oq8ql0j8vmqt8l/yandexgpt-lite','completionOptions'=>['stream'=>false,'temperature'=>0.3,'maxTokens'=>400],'messages'=>[['role'=>'user','text'=>$prompt]]]),
      CURLOPT_TIMEOUT=>20
    ]);
    $res = curl_exec($ch); $err = curl_error($ch); curl_close($ch);
    if($err){ echo json_encode(['error'=>'Ошибка запроса: '.$err]); exit; }
    $data = json_decode($res, true);
    $text = $data['result']['alternatives'][0]['message']['text'] ?? '';
    $text = preg_replace('/```json|```/','',trim($text));
    $parsed = json_decode($text, true);
    if(!$parsed){ echo json_encode(['error'=>'Не удалось распарсить ответ','raw'=>$text]); exit; }
    echo json_encode(['ok'=>true,'data'=>$parsed]); exit;
  }
  // AJAX JSON responses for all other actions
  if(!empty($_SERVER['HTTP_X_REQUESTED_WITH'])){
    header('Content-Type: application/json; charset=utf-8');
    $out=['ok'=>true];
    if($a==='save_nav'){
      $id=(int)($_POST['id']??0);
      $isActive=(int)($_POST['is_active']??1);
      $data=[trim($_POST['label']),trim($_POST['url']),(int)($_POST['sort_order']??10),$isActive,(int)($_POST['open_new_tab']??0)];
      if($id){$data[]=$id;$pdo->prepare('UPDATE nav_items SET label=?,url=?,sort_order=?,is_active=?,open_new_tab=? WHERE id=?')->execute($data);}
      else{$pdo->prepare('INSERT INTO nav_items(label,url,sort_order,is_active,open_new_tab) VALUES(?,?,?,?,?)')->execute($data);$out['id']=(int)$pdo->lastInsertId();}
      echo json_encode($out); exit;
    }
    if($a==='delete_nav'){$pdo->prepare('DELETE FROM nav_items WHERE id=?')->execute([(int)$_POST['id']]);echo json_encode($out);exit;}
    if($a==='pending_orders'){
      // Возвращаем заказы новее чем last_id
      $lastId=(int)($_POST['last_id']??0);
      $st=$pdo->prepare("SELECT o.*, GROUP_CONCAT(i.product_name||' x'||i.qty,', ') as items_str FROM orders o LEFT JOIN order_items i ON i.order_id=o.id WHERE o.id>? GROUP BY o.id ORDER BY o.id DESC LIMIT 10");
      $st->execute([$lastId]);
      $rows=$st->fetchAll(PDO::FETCH_ASSOC);
      echo json_encode(['orders'=>$rows]);exit;
    }
    if($a==='update_order'){
      $orderId=(int)$_POST['id'];
      $newStatus=trim($_POST['status']??'new');
      $note=trim($_POST['manager_note']??'');
      // Читаем старый статус
      $oldRow=$pdo->prepare('SELECT status,total,ym_uid,customer_name FROM orders WHERE id=?');
      $oldRow->execute([$orderId]);
      $oldOrder=$oldRow->fetch(PDO::FETCH_ASSOC);
      $pdo->prepare('UPDATE orders SET status=?,manager_note=? WHERE id=?')->execute([$newStatus,$note,$orderId]);
      // Офлайн-конверсия в Яндекс.Метрику при переводе в "Готово"
      if($newStatus==='done' && ($oldOrder['status']??'')!=='done' && !empty($oldOrder['ym_uid'])){
        try {
          $ymData = ['id'=>'luka-order-'.$orderId, 'date_time'=>date('Y-m-d\TH:i:s'), 'client_id'=>$oldOrder['ym_uid'], 'target'=>'purchase', 'price'=>(float)($oldOrder['total']??0), 'currency'=>'RUB'];
          $ch=curl_init('https://api-metrika.yandex.net/management/v1/counter/109475188/offline_conversions/upload');
          curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode(['conversions'=>[$ymData]]),CURLOPT_HTTPHEADER=>['Authorization: OAuth y0__wgBEKW57BcYz9BCILD7uNkXkiUmFv4ceEovyav43JHemXdvGIQ','Content-Type: application/json'],CURLOPT_TIMEOUT=>5,CURLOPT_SSL_VERIFYPEER=>false]);
          curl_exec($ch); curl_close($ch);
        } catch(Exception $e){}
      }
      echo json_encode($out);exit;
    }
    if($a==='delete_order'){$pdo->prepare('DELETE FROM orders WHERE id=?')->execute([(int)$_POST['id']]);echo json_encode($out);exit;}
    if($a==='save_category'){
      $id=(int)($_POST['id']??0);
      $slug=trim($_POST['slug']??'')?:slugify($_POST['name']??'cat');
      $parentId=(int)($_POST['parent_id']??0)?:null;
      try{$pdo->exec("ALTER TABLE categories ADD COLUMN parent_id INTEGER DEFAULT NULL");}catch(Exception $e){}
      try{$pdo->exec("ALTER TABLE categories ADD COLUMN image TEXT DEFAULT ''");}catch(Exception $e){}
      $imgPath='';
      if(!empty($_FILES['cat_image']['tmp_name'])){
        $ext=strtolower(pathinfo($_FILES['cat_image']['name'],PATHINFO_EXTENSION));
        if(in_array($ext,['jpg','jpeg','png','webp','gif'])){
          $dir=__DIR__.'/../assets/images/cats/';
          if(!is_dir($dir)) mkdir($dir,0775,true);
          $fname='cat_'.time().'_'.rand(100,999).'.'.$ext;
          move_uploaded_file($_FILES['cat_image']['tmp_name'],$dir.$fname);
          $imgPath='assets/images/cats/'.$fname;
          $out['image']=$imgPath;
        }
      }
      if($id){
        if($imgPath){$pdo->prepare('UPDATE categories SET name=?,slug=?,seo_title=?,seo_description=?,is_active=?,sort_order=?,parent_id=?,image=? WHERE id=?')->execute([trim($_POST['name']),$slug,trim($_POST['seo_title']??''),trim($_POST['seo_description']??''),isset($_POST['is_active'])?1:0,(int)($_POST['sort_order']??10),$parentId,$imgPath,$id]);}
        else{$pdo->prepare('UPDATE categories SET name=?,slug=?,seo_title=?,seo_description=?,is_active=?,sort_order=?,parent_id=? WHERE id=?')->execute([trim($_POST['name']),$slug,trim($_POST['seo_title']??''),trim($_POST['seo_description']??''),isset($_POST['is_active'])?1:0,(int)($_POST['sort_order']??10),$parentId,$id]);}
      } else {
        $pdo->prepare('INSERT INTO categories(name,slug,seo_title,seo_description,is_active,sort_order,parent_id,image) VALUES(?,?,?,?,?,?,?,?)')->execute([trim($_POST['name']),$slug,trim($_POST['seo_title']??''),trim($_POST['seo_description']??''),isset($_POST['is_active'])?1:0,(int)($_POST['sort_order']??10),$parentId,$imgPath]);
        $out['id']=(int)$pdo->lastInsertId();
      }
      echo json_encode($out);exit;
    }
    if($a==='delete_category'){$pdo->prepare('DELETE FROM categories WHERE id=?')->execute([(int)$_POST['id']]);echo json_encode($out);exit;}
    if($a==='toggle_category'){$id=(int)($_POST['id']??0);$pdo->prepare('UPDATE categories SET is_active=CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=?')->execute([$id]);$row=$pdo->prepare('SELECT is_active FROM categories WHERE id=?');$row->execute([$id]);$out['is_active']=(int)$row->fetchColumn();echo json_encode($out);exit;}
    if($a==='toggle_popular'){
  $pid=(int)$_POST['id']; $val=(int)$_POST['val'];
  $pdo->prepare('UPDATE products SET is_popular=? WHERE id=?')->execute([$val,$pid]);
  echo json_encode(['ok'=>true]); exit;
}
    if($a==='get_block'){
      $id=(int)($_POST['id']??0);
      $st=$pdo->prepare('SELECT * FROM page_blocks WHERE id=?');
      $st->execute([$id]);
      $b=$st->fetch(PDO::FETCH_ASSOC);
      echo json_encode($b ?: []); exit;
    }
    if($a==='save_block'){
      $id=(int)($_POST['id']??0);$img=upload_file('image')?:($_POST['old_image']??'');
      $data=[trim($_POST['type']??'text_image'),trim($_POST['label']??''),trim($_POST['eyebrow']??''),trim($_POST['title']??''),trim($_POST['subtitle']??''),trim($_POST['text']??''),$img,trim($_POST['cta_text']??''),trim($_POST['cta_link']??''),trim($_POST['extra']??''),(int)($_POST['sort_order']??10),isset($_POST['is_active'])?1:0];
      if($id){$data[]=$id;$pdo->prepare('UPDATE page_blocks SET type=?,label=?,eyebrow=?,title=?,subtitle=?,text=?,image=?,cta_text=?,cta_link=?,extra=?,sort_order=?,is_active=? WHERE id=?')->execute($data);}
      else{$pdo->prepare('INSERT INTO page_blocks(type,label,eyebrow,title,subtitle,text,image,cta_text,cta_link,extra,sort_order,is_active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')->execute($data);$out['id']=(int)$pdo->lastInsertId();}
      $out['image']=$img;echo json_encode($out);exit;
    }
    if($a==='save_page'){
      $id=(int)($_POST['id']??0);$slug=trim($_POST['slug']??'')?:slugify($_POST['title']??'page');
      $data=[trim($_POST['title']),$slug,trim($_POST['seo_title']??''),trim($_POST['seo_description']??''),isset($_POST['is_active'])?1:0,isset($_POST['show_in_nav'])?1:0,trim($_POST['nav_label']??''),(int)($_POST['sort_order']??10)];
      if($id){$data[]=$id;$pdo->prepare('UPDATE pages SET title=?,slug=?,seo_title=?,seo_description=?,is_active=?,show_in_nav=?,nav_label=?,sort_order=? WHERE id=?')->execute($data);}
      else{$pdo->prepare('INSERT INTO pages(title,slug,seo_title,seo_description,is_active,show_in_nav,nav_label,sort_order) VALUES(?,?,?,?,?,?,?,?)')->execute($data);$out['id']=(int)$pdo->lastInsertId();$out['slug']=$slug;}
      echo json_encode($out);exit;
    }
    if($a==='delete_page'){$pdo->prepare('DELETE FROM page_sections WHERE page_id=?')->execute([(int)$_POST['id']]);$pdo->prepare('DELETE FROM pages WHERE id=?')->execute([(int)$_POST['id']]);echo json_encode($out);exit;}
    if($a==='save_page_section'){
      $id=(int)($_POST['id']??0);$img=upload_file('ps_image')?:($_POST['old_ps_image']??'');
      $data=[trim($_POST['ps_type']??'text'),trim($_POST['ps_eyebrow']??''),trim($_POST['ps_title']??''),trim($_POST['ps_subtitle']??''),trim($_POST['ps_text']??''),$img,trim($_POST['ps_cta_text']??''),trim($_POST['ps_cta_link']??''),trim($_POST['ps_extra']??''),(int)($_POST['ps_sort']??10),isset($_POST['ps_active'])?1:0,(int)$_POST['page_id']];
      if($id){$data[]=$id;$pdo->prepare('UPDATE page_sections SET type=?,eyebrow=?,title=?,subtitle=?,text=?,image=?,cta_text=?,cta_link=?,extra=?,sort_order=?,is_active=?,page_id=? WHERE id=?')->execute($data);}
      else{$pdo->prepare('INSERT INTO page_sections(type,eyebrow,title,subtitle,text,image,cta_text,cta_link,extra,sort_order,is_active,page_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')->execute($data);$out['id']=(int)$pdo->lastInsertId();}
      echo json_encode($out);exit;
    }
    if($a==='delete_page_section'){$pdo->prepare('DELETE FROM page_sections WHERE id=?')->execute([(int)$_POST['id']]);echo json_encode($out);exit;}
    if($a==='get_page_sections'){
      $pid=(int)($_POST['page_id']??0);
      $st=$pdo->prepare('SELECT * FROM page_sections WHERE page_id=? ORDER BY sort_order,id');
      $st->execute([$pid]);
      echo json_encode(['ok'=>true,'sections'=>$st->fetchAll(PDO::FETCH_ASSOC)]);exit;
    }
    if($a==='save_settings'){foreach(['site_title','site_description','phone','telegram','whatsapp','instagram','youtube','og_image','yandex_api_key','cdek_client_id','cdek_client_secret'] as $k){$pdo->prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')->execute([$k,trim($_POST[$k]??'')]);}echo json_encode($out);exit;}
    echo json_encode(['ok'=>false,'error'=>'unknown: '.$a]);exit;
  }
  header('Location:/admin?tab='.urlencode($_GET['tab']??'orders')); exit;
}
// Создаём pages если нет
try {
  $pdo->exec("CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT '', slug TEXT NOT NULL, seo_title TEXT DEFAULT '', seo_description TEXT DEFAULT '', is_active INTEGER DEFAULT 1, show_in_nav INTEGER DEFAULT 0, nav_label TEXT DEFAULT '', sort_order INTEGER DEFAULT 10, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  $pdo->exec("CREATE TABLE IF NOT EXISTS page_sections (id INTEGER PRIMARY KEY AUTOINCREMENT, page_id INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'text', eyebrow TEXT DEFAULT '', title TEXT DEFAULT '', subtitle TEXT DEFAULT '', text TEXT DEFAULT '', image TEXT DEFAULT '', cta_text TEXT DEFAULT '', cta_link TEXT DEFAULT '', extra TEXT DEFAULT '', sort_order INTEGER DEFAULT 10, is_active INTEGER DEFAULT 1)");
} catch(Exception $e){}
// Фикс: обновляем старые записи с одинарным разделителем на двойной ::
try {
  $rows = $pdo->query("SELECT id, extra FROM page_sections WHERE extra LIKE '%:%' AND extra NOT LIKE '%::%'")->fetchAll(PDO::FETCH_ASSOC);
  foreach($rows as $row){
    $fixed = preg_replace('/([^|:]):([^:])/', '$1::$2', $row['extra']);
    if($fixed !== $row['extra']) $pdo->prepare("UPDATE page_sections SET extra=? WHERE id=?")->execute([$fixed, $row['id']]);
  }
} catch(Exception $e){}
// Создаём nav_items если нет
try {
  $pdo->exec("CREATE TABLE IF NOT EXISTS nav_items (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, url TEXT NOT NULL, sort_order INTEGER DEFAULT 10, is_active INTEGER DEFAULT 1, open_new_tab INTEGER DEFAULT 0)");
  if((int)$pdo->query("SELECT COUNT(*) FROM nav_items")->fetchColumn()===0){
    foreach([['Каталог','/catalog.php',10],['Коллекция','/#catalog',20],['Ритуал','/#ritual',30],['Производство','/#craft',40],['Journal','/#journal',50],['Контакт','/#lead',60]] as [$l,$u,$s]){
      $pdo->prepare('INSERT INTO nav_items(label,url,sort_order,is_active) VALUES(?,?,?,1)')->execute([$l,$u,$s]);
    }
  }
} catch(Exception $e){}
$tab=$_GET['tab']??'orders'; $pid=(int)($_GET['pid']??0); try{$pages=$pdo->query('SELECT * FROM pages ORDER BY sort_order,id')->fetchAll(PDO::FETCH_ASSOC);}catch(Exception $e){$pages=[];} $blocks=$pdo->query('SELECT * FROM page_blocks ORDER BY sort_order,id')->fetchAll(PDO::FETCH_ASSOC); $cats=$pdo->query('SELECT * FROM categories ORDER BY sort_order,id')->fetchAll(PDO::FETCH_ASSOC); $products=$pdo->query('SELECT p.*, c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY c.sort_order,p.sort_order,p.id')->fetchAll(PDO::FETCH_ASSOC); $orders=$pdo->query('SELECT * FROM orders ORDER BY id DESC')->fetchAll(PDO::FETCH_ASSOC); $stats=['orders'=>count($orders),'new'=>count(array_filter($orders,fn($o)=>$o['status']==='new')),'products'=>count($products),'cats'=>count($cats)];

// ── Helper functions ──────────────────────────────────────────────────────
function block_type_label($t){
  return ['hero'=>'Главный экран','features'=>'Преимущества','culture'=>'Fire culture',
    'brand_intro'=>'О бренде','catalog'=>'Каталог','accessories'=>'Аксессуары',
    'video'=>'Видео','materials'=>'Производство','how'=>'Как это работает',
    'trust_static'=>'Доверие','sets'=>'Комплекты','config'=>'Конфигуратор',
    'delivery'=>'Доставка','lead'=>'Форма заявки','story'=>'Ритуал / история',
    'text_image'=>'Текст + фото','use_cases'=>'Сценарии','trust'=>'Доверие',
    'fire_cooking'=>'Fire cooking','quote'=>'Манифест / цитата'][$t] ?? $t;
}

function status_label($s){
  return ['new'=>'Новая','processing'=>'В работе','done'=>'Готово','cancelled'=>'Отмена'][$s] ?? $s;
}

function product_media_list($product_id){
  global $pdo;
  $st = $pdo->prepare('SELECT * FROM product_media WHERE product_id=? ORDER BY sort_order,id');
  $st->execute([(int)$product_id]);
  return $st->fetchAll(PDO::FETCH_ASSOC);
}

// ── End helper functions ──────────────────────────────────────────────────

?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LUKA / ADMIN</title>
<script>document.documentElement.setAttribute('data-theme',localStorage.getItem('adminTheme')||'dark')</script>
<link rel="stylesheet" href="admin.css">
</head>
<body>
<?php
$revenue=(int)array_sum(array_column($orders,'total'));
$chartData=[];for($d=6;$d>=0;$d--){$date=date('Y-m-d',strtotime("-$d days"));$label=date('d.m',strtotime("-$d days"));$dayOrders=array_filter($orders,fn($o)=>str_starts_with($o['created_at']??'',$date));$chartData[]=[$label,count($dayOrders),array_sum(array_column(array_values($dayOrders),'total'))];}
try{$navItems=$pdo->query("SELECT * FROM nav_items ORDER BY sort_order,id")->fetchAll(PDO::FETCH_ASSOC);}catch(Exception $e){$navItems=[];}
try{$pages=$pdo->query('SELECT * FROM pages ORDER BY sort_order,id')->fetchAll(PDO::FETCH_ASSOC);}catch(Exception $e){$pages=[];}
$blocks=$pdo->query('SELECT * FROM page_blocks ORDER BY sort_order,id')->fetchAll(PDO::FETCH_ASSOC);
?>
<div class="adminWrap">

<!-- SIDEBAR -->
<aside class="sidebar" id="sidebar">
  <div class="sidebarLogo">
    <div class="sidebarLogoMark">L</div>
    <span>LUKA<br>OUTDOOR<br>ADMIN</span>
  </div>
  <nav class="sidebarNav">
    <a href="crm.php" style="border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:6px;padding-bottom:10px">
      <svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
      CRM / Заявки <?php if($stats['new']>0): ?><span class="navBadge" style="background:var(--accent);color:#fff;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:900;margin-left:auto"><?=$stats['new']?></span><?php endif; ?>
    </a>
    <a data-tab="products" class="<?=$tab==='products'?'active':''?>">
      <svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      Товары
    </a>
    <a data-tab="categories" class="<?=$tab==='categories'?'active':''?>">
      <svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h8M4 18h16"/></svg>
      Категории
    </a>
    <a data-tab="blocks" class="<?=$tab==='blocks'?'active':''?>">
      <svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      Главная
    </a>
    <a data-tab="popular" class="<?=$tab==='popular'?'active':''?>">⭐ Популярное</a>
    <a data-tab="pages" class="<?=$tab==='pages'?'active':''?>">
      <svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
      CMS Страницы
    </a>
    <a data-tab="nav" class="<?=$tab==='nav'?'active':''?>">
      <svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      Навигация
    </a>
    <a data-tab="reviews" class="<?=$tab==='reviews'?'active':''?>"
      ><svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      Отзывы
      <?php try{$pr=(int)$pdo->query("SELECT COUNT(*) FROM reviews WHERE is_active=0")->fetchColumn();if($pr):?><span style="background:#e05;color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;margin-left:auto"><?=$pr?></span><?php endif;}catch(Exception $e){} ?>
    </a>
    <a data-tab="calls" class="<?=$tab==='calls'?'active':''?>">
      <svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.66-.66a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
      Звонки
      <?php try{
        $nc=(int)$pdo->query("SELECT COUNT(*) FROM calls WHERE direction='in' AND DATE(created_at)=DATE('now')")->fetchColumn();
        $nm=(int)$pdo->query("SELECT COUNT(*) FROM calls WHERE direction='in' AND status='missed' AND DATE(created_at)=DATE('now')")->fetchColumn();
        if($nm>0): ?><span id="sideCallsMissed" style="background:rgba(220,50,50,.2);color:#e05050;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:900;margin-left:auto"><?=$nm?> пропущ.</span><?php elseif($nc>0): ?><span id="sideCallsTotal" style="background:rgba(76,175,80,.2);color:#7fd882;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:900;margin-left:auto"><?=$nc?></span><?php endif; }catch(Exception $e){} ?>
    </a>
    <a data-tab="stats" class="<?=$tab==='stats'?'active':''?>">
      <svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      Статистика
    </a>
    <a data-tab="settings" class="<?=$tab==='settings'?'active':''?>">
      <svg class="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
      Настройки
    </a>
  </nav>
  <div class="sidebarBottom">
    <a href="/" target="_blank">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      На сайт
    </a>
    <a href="logout.php" style="margin-top:8px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
      Выйти
    </a>
  </div>
</aside>

<!-- MAIN -->
<div class="adminContent">



<!-- ════════════ TAB: ORDERS (CRM KANBAN) ════════════ -->
<?php
// CRM: миграция полей СДЭК
foreach(['cdek_order_uuid TEXT DEFAULT ""','cdek_track TEXT DEFAULT ""','cdek_status TEXT DEFAULT ""','cdek_pvz_code TEXT DEFAULT ""','delivery_cost INTEGER DEFAULT 0','cdek_raw TEXT DEFAULT ""'] as $col_def){
  $col=explode(' ',$col_def)[0];
  try{$pdo->exec("ALTER TABLE orders ADD COLUMN $col_def");}catch(Exception $e){}
}
// Миграция товаров — новые поля
foreach(['cost_price INTEGER DEFAULT 0','weight_g INTEGER DEFAULT 12000','length_cm INTEGER DEFAULT 60','width_cm INTEGER DEFAULT 60','height_cm INTEGER DEFAULT 40'] as $col_def){
  try{$pdo->exec("ALTER TABLE products ADD COLUMN $col_def");}catch(Exception $e){}
}

function time_ago_crm($dt){
  $diff=time()-strtotime($dt);
  if($diff<60) return 'только что';
  if($diff<3600) return floor($diff/60).' мин назад';
  if($diff<86400) return floor($diff/3600).' ч назад';
  return date('d.m.Y',strtotime($dt));
}

$crm_columns=['new'=>['label'=>'Новые','color'=>'#e8943a'],'processing'=>['label'=>'В работе','color'=>'#3a8ae8'],'done'=>['label'=>'Готово','color'=>'#4caf50'],'cancelled'=>['label'=>'Отмена','color'=>'#666']];
$crm_orders_by_status=['new'=>[],'processing'=>[],'done'=>[],'cancelled'=>[]];
foreach($orders as $o){ $s=$o['status']??'new'; if(isset($crm_orders_by_status[$s])) $crm_orders_by_status[$s][]=$o; }
$crm_stats=['revenue'=>array_sum(array_column(array_filter($orders,fn($o)=>$o['status']!=='cancelled'),'total')),'cdek'=>count(array_filter($orders,fn($o)=>!empty($o['cdek_order_uuid'])))];
?>
<div class="tabContent <?=$tab==='orders'?'active':''?>" id="tab-orders">

<!-- CRM STATS -->
<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:22px">
  <div class="statCard"><span>Всего</span><b><?=$stats['orders']?></b></div>
  <div class="statCard"><span>Новые</span><b style="color:var(--accent)"><?=$stats['new']?></b></div>
  <div class="statCard"><span>В работе</span><b style="color:#3a8ae8"><?=count($crm_orders_by_status['processing'])?></b></div>
  <div class="statCard"><span>Готово</span><b style="color:#4caf50"><?=count($crm_orders_by_status['done'])?></b></div>
  <div class="statCard"><span>Выручка</span><b style="font-size:16px"><?=money($crm_stats['revenue'])?></b></div>
  <div class="statCard"><span>В СДЭК</span><b style="color:#6ab0ff"><?=$crm_stats['cdek']?></b></div>
</div>

<!-- TOOLBAR -->
<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px">
  <input class="searchBar" id="crmSearch" placeholder="Поиск по имени, телефону, товару..." oninput="crmFilter()" style="width:220px">
  <div s<div class="viewToggle">
    <button id="crmBtnKanban" onclick="crmSetView('kanban')">⊞ Канбан</button>
    <button id="crmBtnList" onclick="crmSetView('list')">☰ Список</button>
  </div>
  <a href="?export=orders" class="btn-ghost">↓ CSV</a>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    <button class="filterPill active" data-crmfilter="all" onclick="crmSetFilter(this,'all')">Все</button>
    <button class="filterPill" data-crmfilter="new" onclick="crmSetFilter(this,'new')">Новые</button>
    <button class="filterPill" data-crmfilter="processing" onclick="crmSetFilter(this,'processing')">В работе</button>
    <button class="filterPill" data-crmfilter="done" onclick="crmSetFilter(this,'done')">Готово</button>
    <button class="filterPill" data-crmfilter="cancelled" onclick="crmSetFilter(this,'cancelled')">Отмена</button>
  </div>
</div>

<!-- KANBAN -->
<div id="crmKanban" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start">
<?php foreach($crm_columns as $status=>$col): ?>
<div style="background:var(--panel);border:1px solid var(--line);border-radius:7px" data-crm-col="<?=$status?>">
  <div style="padding:12px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between">
    <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.16em;font-weight:700;color:<?=$col['color']?>"><?=$col['label']?></h3>
    <span id="crmCount-<?=$status?>" style="background:var(--line2);border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900;color:<?=$col['color']?>"><?=count($crm_orders_by_status[$status])?></span>
  </div>
  <div class="crm-col-body" id="crmCol-<?=$status?>" data-status="<?=$status?>" style="padding:8px;display:flex;flex-direction:column;gap:7px;min-height:60px">
    <?php foreach($crm_orders_by_status[$status] as $o): ?>
    <?php
      $it2=$pdo->prepare('SELECT product_name,qty FROM order_items WHERE order_id=? LIMIT 2');
      $it2->execute([$o['id']]);$oit2=$it2->fetchAll(PDO::FETCH_ASSOC);
      $isearch=mb_strtolower($o['customer_name'].' '.$o['phone'].' '.implode(' ',array_column($oit2,'product_name')));
    ?>
    <div class="crm-card" data-id="<?=$o['id']?>" data-status="<?=h($o['status'])?>" data-search="<?=h($isearch)?>" draggable="true" onclick="crmOpenOrder(<?=$o['id']?>)" style="background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:12px;cursor:pointer;transition:.15s">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">
        <span style="font-size:10px;font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">#<?=$o['id']?></span>
        <?php if(!empty($o['cdek_track'])): ?>
          <span style="font-size:10px;font-weight:700;color:#7fd882;background:rgba(76,175,80,.12);border:1px solid rgba(76,175,80,.25);border-radius:5px;padding:2px 6px">🚚 <?=h($o['cdek_track'])?></span>
        <?php elseif(!empty($o['cdek_order_uuid'])): ?>
          <span style="font-size:10px;font-weight:700;color:#6ab0ff;background:rgba(58,138,232,.12);border:1px solid rgba(58,138,232,.25);border-radius:5px;padding:2px 6px">📦 СДЭК</span>
        <?php endif; ?>
      </div>
      <?php if(!empty($o['cdek_status']) && $o['cdek_status'] !== 'created'):
        $cdekStatusMap = [
          'CREATED'=>['🟡','Создан','#f5a623'],
          'ACCEPTED'=>['🔵','Принят','#6ab0ff'],
          'SENT_TO_TRANSIT_CITY'=>['🚚','В транзите','#a78bfa'],
          'SENT_TO_RECIPIENT_CITY'=>['🚚','Едет к вам','#a78bfa'],
          'ACCEPTED_IN_RECIPIENT_CITY'=>['🚚','В городе','#a78bfa'],
          'ACCEPTED_AT_PICK_UP_POINT'=>['🟢','В ПВЗ','#7fd882'],
          'READY_FOR_PICKUP'=>['🟢','Готов к выдаче','#7fd882'],
          'DELIVERING'=>['🚚','Курьер едет','#a78bfa'],
          'DELIVERED'=>['✅','Вручён','#7fd882'],
          'NOT_DELIVERED'=>['❌','Не вручён','#e05252'],
          'INVALID'=>['⚠️','Ошибка','#e05252'],
        ];
        $cs = $cdekStatusMap[$o['cdek_status']] ?? ['📦',$o['cdek_status'],'#6ab0ff'];
      ?>
      <div style="font-size:10px;font-weight:700;color:<?=$cs[2]?>;margin-bottom:5px"><?=$cs[0]?> <?=$cs[1]?></div>
      <?php endif; ?>
      <div style="font-size:13px;font-weight:700;margin-bottom:2px"><?=h($o['customer_name'])?></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:7px"><?=h($o['phone'])?></div>
      <?php if($oit2): ?><div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:7px"><?=h(implode(', ',array_map(fn($i)=>$i['product_name'].' ×'.$i['qty'],$oit2)))?></div><?php endif; ?>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13px;font-weight:900;color:var(--accent)"><?=$o['total']?money($o['total']):'—'?></span>
        <span style="font-size:10px;color:var(--muted)"><?=time_ago_crm($o['created_at']??'')?></span>
      </div>
    </div>
    <?php endforeach; ?>
  </div>
</div>
<?php endforeach; ?>
</div>

<!-- LIST VIEW -->
<div id="crmList" style="display:none">
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr>
        <?php foreach(['#','Клиент','Товары','Адрес','Сумма','Статус','СДЭК','Дата'] as $th): ?>
        <th style="padding:9px 13px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);border-bottom:1px solid var(--line);white-space:nowrap"><?=$th?></th>
        <?php endforeach; ?>
      </tr>
    </thead>
    <tbody>
    <?php foreach($orders as $o):
      $it3=$pdo->prepare('SELECT product_name,qty FROM order_items WHERE order_id=? LIMIT 2');$it3->execute([$o['id']]);$oit3=$it3->fetchAll(PDO::FETCH_ASSOC);
      $isearch3=mb_strtolower($o['customer_name'].' '.$o['phone'].' '.implode(' ',array_column($oit3,'product_name')));
    ?>
    <tr class="crm-list-row" data-id="<?=$o['id']?>" data-status="<?=h($o['status'])?>" data-search="<?=h($isearch3)?>" onclick="crmOpenOrder(<?=$o['id']?>)" style="cursor:pointer;transition:.1s" onmouseover="this.style.background=var(--table-hover)" onmouseout="this.style.background=''">
      <td style="padding:11px 13px;border-bottom:1px solid var(--table-border);font-weight:900;font-size:12px;color:var(--muted)">#<?=$o['id']?></td>
      <td style="padding:11px 13px;border-bottom:1px solid var(--table-border)">
        <div style="font-weight:700;font-size:13px"><?=h($o['customer_name'])?></div>
        <div style="font-size:11px;color:var(--muted)"><?=h($o['phone'])?></div>
      </td>
      <td style="padding:11px 13px;border-bottom:1px solid var(--table-border);font-size:11px;color:var(--muted);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><?=h(implode(', ',array_map(fn($i)=>$i['product_name'].' ×'.$i['qty'],$oit3)))?></td>
      <td style="padding:11px 13px;border-bottom:1px solid var(--table-border);font-size:11px;color:var(--muted);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><?=h($o['address']??'—')?></td>
      <td style="padding:11px 13px;border-bottom:1px solid var(--table-border);font-weight:800;color:var(--accent);white-space:nowrap"><?=$o['total']?money($o['total']):'—'?></td>
      <td style="padding:11px 13px;border-bottom:1px solid var(--table-border)">
        <?php $sc=['new'=>['#e8943a','Новая'],'processing'=>['#3a8ae8','В работе'],'done'=>['#4caf50','Готово'],'cancelled'=>['#666','Отмена']][$o['status']]??['#666',$o['status']]; ?>
        <span style="background:<?=$sc[0]?>22;color:<?=$sc[0]?>;border-radius:6px;padding:3px 9px;font-size:10px;font-weight:800;text-transform:uppercase;border:1px solid <?=$sc[0]?>44"><?=$sc[1]?></span>
      </td>
      <td style="padding:11px 13px;border-bottom:1px solid var(--table-border)">
        <?php if(!empty($o['cdek_track'])): ?><span style="font-size:11px;font-weight:700;color:#7fd882">🚚 <?=h($o['cdek_track'])?></span>
        <?php elseif(!empty($o['cdek_order_uuid'])): ?><span style="font-size:11px;color:#6ab0ff">📦 создан</span>
        <?php else: ?><span style="font-size:11px;color:var(--muted)">—</span><?php endif; ?>
      </td>
      <td style="padding:11px 13px;border-bottom:1px solid var(--table-border);font-size:11px;color:var(--muted);white-space:nowrap"><?=date('d.m.Y H:i',strtotime($o['created_at']??'now'))?></td>
    </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>

</div><!-- /tab-orders -->
<!-- ════════════ TAB: PRODUCTS ════════════ -->
<div class="tabContent <?=$tab==='products'?'active':''?>" id="tab-products">
  <div class="pageHeader">
    <div><h1>Товары</h1><p>Управление каталогом</p></div>
    <button class="btn-primary" onclick="openProductDrawer(null)">+ Добавить товар</button>
  </div>
  <input class="searchBar" id="productSearch" placeholder="Поиск товаров..." style="width:280px;margin-bottom:14px">
  <div class="productGrid2" id="productGrid2">
  <?php foreach($products as $p): ?>
  <div class="productCard2 <?=$p['is_active']?'':'hidden-prod'?>" data-id="<?=$p['id']?>" data-name="<?=h(mb_strtolower($p['name']))?>" onclick='openProductDrawer(<?=json_encode($p,JSON_UNESCAPED_UNICODE)?>)'>
    <?php if($p['image']): ?><img src="../<?=h($p['image'])?>" alt="<?=h($p['name'])?>">
    <?php else: ?><div class="noImg">Нет фото</div><?php endif; ?>
    <div class="cardBody">
      <?php if($p['badge']): ?><div class="cardBadge"><?=h($p['badge'])?></div><?php endif; ?>
      <div class="cardCat"><?=h($p['category_name'])?></div>
      <div class="cardName"><?=h($p['name'])?></div>
      <div class="cardPrice"><?=money($p['price'])?></div>
    </div>
  </div>
  <?php endforeach; ?>
  </div>
</div>

<!-- ════════════ TAB: CATEGORIES ════════════ -->
<div class="tabContent <?=$tab==='categories'?'active':''?>" id="tab-categories">
  <div class="pageHeader">
    <div><h1>Категории</h1><p>Разделы каталога</p></div>
    <button class="btn-primary" onclick="openCatModal()">+ Добавить</button>
  </div>
  <div id="catList">
  <?php
  // Группируем: сначала корневые, под каждой — подкатегории
  $rootCats = array_filter($cats, fn($c)=>empty($c['parent_id']));
  $childCats = [];
  foreach($cats as $cc){ if(!empty($cc['parent_id'])) $childCats[$cc['parent_id']][] = $cc; }
  foreach($rootCats as $c):
  ?>
  <div class="navItemRow no-drag" data-id="<?=$c['id']?>" style="<?=!empty($c['image'])?'border-left:3px solid var(--accent)':''?>">
    <?php if(!empty($c['image'])): ?><img src="/<?=h($c['image'])?>" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0"><?php endif; ?>
    <div>
      <div class="label"><?=h($c['name'])?></div>
      <div class="url">/catalog.php?cat=<?=h($c['slug'])?></div>
    </div>
    <button class="badge <?=$c['is_active']?'badge-active':'badge-hidden'?>" onclick="toggleCat(<?=$c['id']?>,this)" style="cursor:pointer;border:none;font:inherit"><?=$c['is_active']?'Активна':'Скрыта'?></button>
    <button class="btn-ghost btn-sm" onclick='openCatModal(<?=json_encode($c,JSON_UNESCAPED_UNICODE)?>)'>✏ Изменить</button>
    <button class="btn-danger btn-sm" onclick="deleteCat(<?=$c['id']?>,this)">Удалить</button>
  </div>
  <?php foreach($childCats[$c['id']] ?? [] as $sub): ?>
  <div class="navItemRow no-drag" data-id="<?=$sub['id']?>" style="margin-left:24px;border-left:2px solid var(--line2)">
    <div>
      <div class="label" style="font-size:13px">↳ <?=h($sub['name'])?></div>
      <div class="url">/catalog.php?cat=<?=h($sub['slug'])?></div>
    </div>
    <button class="badge <?=$sub['is_active']?'badge-active':'badge-hidden'?>" onclick="toggleCat(<?=$sub['id']?>,this)" style="cursor:pointer;border:none;font:inherit"><?=$sub['is_active']?'Активна':'Скрыта'?></button>
    <button class="btn-ghost btn-sm" onclick='openCatModal(<?=json_encode($sub,JSON_UNESCAPED_UNICODE)?>)'>✏ Изменить</button>
    <button class="btn-danger btn-sm" onclick="deleteCat(<?=$sub['id']?>,this)">Удалить</button>
  </div>
  <?php endforeach; ?>
  <?php endforeach; ?>
  </div>
</div>

<!-- ════════════ TAB: BLOCKS ════════════ -->
<div class="tabContent <?=$tab==='blocks'?'active':''?>" id="tab-blocks">
  <div class="pageHeader">
    <div><h1>Редактор главной</h1><p>Блоки страницы — перетащите для смены порядка</p></div>
    <button class="btn-primary" onclick="openBlockModal(null)">+ Добавить блок</button>
  </div>
  <div id="blocksList">
  <?php foreach($blocks as $b): ?>
  <div class="blockCard <?=$b['is_active']?'':'hidden-block'?>" data-id="<?=$b['id']?>">
    <div class="blockCardHead" onclick="toggleBlockCard(this.closest('.blockCard'))">
      <span class="blockCardDrag" title="Перетащить">⠿</span>
      <div class="blockCardInfo">
        <div class="type"><?=h(block_type_label($b['type']))?></div>
        <div class="title"><?=h($b['label'] ?: $b['title'] ?: '—')?></div>
        <?php if($b['eyebrow']||$b['subtitle']): ?><div class="sub"><?=h($b['eyebrow']?:$b['subtitle'])?></div><?php endif; ?>
      </div>
      <div class="blockCardActions" onclick="event.stopPropagation()">
        <button class="btn-ghost btn-sm" onclick="openBlockById(<?=$b['id']?>)">✏</button>
        <button class="btn-ghost btn-sm" onclick="blockToggle(<?=$b['id']?>,this)"><?=$b['is_active']?'Скрыть':'Показать'?></button>
        <button class="btn-danger btn-sm" onclick="blockDelete(<?=$b['id']?>,this)">✕</button>
      </div>
    </div>
  </div>
  <?php endforeach; ?>
  </div>
</div>

<!-- ════════════ TAB: POPULAR ════════════ -->
<div class="tabContent <?=$tab==='popular'?'active':''?>" id="tab-popular">
  <div class="pageHeader">
    <div><h1>Популярные товары</h1><p>Выберите товары которые показываются на главной странице</p></div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
  <?php foreach($products as $p): ?>
  <div style="background:var(--surface);border:1px solid var(--line2);border-radius:10px;padding:14px;display:flex;gap:12px;align-items:center">
    <?php if($p['image']): ?><img src="/<?=h($p['image'])?>" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0"><?php endif; ?>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><?=h($p['name'])?></div>
      <div style="font-size:12px;color:var(--muted)"><?=money($p['price'])?></div>
    </div>
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0">
      <input type="checkbox" onchange="togglePopular(<?=$p['id']?>,this.checked)" <?=$p['is_popular']?'checked':''?> style="width:18px;height:18px;cursor:pointer;accent-color:var(--copper)">
    </label>
  </div>
  <?php endforeach; ?>
  </div>
</div>

<!-- ════════════ TAB: PAGES ════════════ -->
<div class="tabContent <?=$tab==='pages'?'active':''?>" id="tab-pages">
  <div class="pageHeader">
    <div><h1>CMS Страницы</h1><p>Произвольные страницы сайта</p></div>
    <button class="btn-primary" onclick="openPageModal(null)">+ Новая страница</button>
  </div>
  <div id="pagesList">
  <?php foreach($pages as $pg):
    $secCount=(int)$pdo->query("SELECT COUNT(*) FROM page_sections WHERE page_id=".(int)$pg['id'])->fetchColumn();
  ?>
  <div class="navItemRow no-drag">
    <div>
      <div class="label"><?=h($pg['title'])?></div>
      <div class="url">/page.php?slug=<?=h($pg['slug'])?> · <?=$secCount?> блоков</div>
    </div>
    <span class="badge <?=$pg['is_active']?'badge-active':'badge-hidden'?>"><?=$pg['is_active']?'Активна':'Скрыта'?></span>
    <div style="display:flex;gap:6px">
      <a href="?tab=pages&pid=<?=$pg['id']?>" class="btn-ghost btn-sm">✏ Редактор</a>
      <a href="/page.php?slug=<?=h($pg['slug'])?>" target="_blank" class="btn-ghost btn-sm">↗</a>
      <button class="btn-ghost btn-sm" onclick='openPageModal(<?=json_encode($pg,JSON_UNESCAPED_UNICODE)?>)'>Настройки</button>
      <button class="btn-danger btn-sm" onclick="deletePage(<?=$pg['id']?>,this)">Удалить</button>
    </div>
  </div>
  <?php endforeach; ?>
  <?php if(empty($pages)): ?>
  <div style="text-align:center;padding:40px;color:var(--muted)">Страниц пока нет</div>
  <?php endif; ?>
  </div>
  <?php if(isset($_GET['pid'])&&$_GET['pid']):
    $pid=(int)$_GET['pid'];
    $st=$pdo->prepare('SELECT * FROM pages WHERE id=?');$st->execute([$pid]);$editPage=$st->fetch(PDO::FETCH_ASSOC);
    if($editPage):
      $st2=$pdo->prepare('SELECT * FROM page_sections WHERE page_id=? ORDER BY sort_order,id');$st2->execute([$pid]);$pageSections=$st2->fetchAll(PDO::FETCH_ASSOC);
  ?>
  <script>
    window.PE_SECTIONS = <?=json_encode($pageSections,JSON_UNESCAPED_UNICODE)?>;
    window.PE_PAGE_ID = <?=$pid?>;
    window.PE_PAGE_SLUG = "<?=h($editPage['slug'])?>";
    window.PE_PAGE_TITLE = <?=json_encode($editPage['title'],JSON_UNESCAPED_UNICODE)?>;
    window.PE_PAGE_IS_ACTIVE = <?=$editPage['is_active']?'true':'false'?>;
    window.PE_PAGE_DATA = <?=json_encode($editPage,JSON_UNESCAPED_UNICODE)?>;
  </script>

  <!-- ══════════ PAGE EDITOR SHELL ══════════ -->
  <div class="pe-editor" id="peEditor">

    <!-- TOP BAR -->
    <div class="pe-topbar">
      <a href="?tab=pages" class="pe-back-btn">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Все страницы
      </a>
      <span class="pe-topbar-title" id="pePageTitle"><?=h($editPage['title'])?></span>
      <div class="pe-topbar-actions">
        <button class="pe-undo-btn" id="peUndo" title="Отмена (Ctrl+Z)" disabled>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 7a5 5 0 1 0 1.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3 3v4h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="pe-undo-btn" id="peRedo" title="Повтор (Ctrl+Y)" disabled>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M12 7A5 5 0 1 1 10.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 3v4H8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <label class="pe-toggle-wrap" title="Активность страницы">
          <input type="checkbox" id="peIsActive" <?=$editPage['is_active']?'checked':''?>>
          <span class="pe-toggle"></span>
          <span class="pe-toggle-label" id="peActiveLabel"><?=$editPage['is_active']?'Опубликовано':'Черновик'?></span>
        </label>
        <a href="/page.php?slug=<?=h($editPage['slug'])?>" target="_blank" class="pe-site-link">На сайте ↗</a>
        <span class="pe-autosave" id="peAutosave"></span>
      </div>
    </div>

    <!-- PAGE SETTINGS STRIP (collapsed by default) -->
    <div class="pe-settings-strip" id="peSettingsStrip">
      <button class="pe-settings-toggle" id="peSettingsToggle" onclick="peToggleSettings()">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        Настройки страницы
        <svg class="pe-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="pe-settings-body" id="peSettingsBody" style="display:none">
        <form id="editPageForm" class="pe-settings-form">
          <input type="hidden" name="action" value="save_page">
          <input type="hidden" name="id" value="<?=$editPage['id']?>">
          <div class="pe-settings-row">
            <label class="pe-field-label">Название<input class="pe-input" name="title" value="<?=h($editPage['title'])?>"></label>
            <label class="pe-field-label">URL slug<input class="pe-input" name="slug" value="<?=h($editPage['slug'])?>"></label>
            <label class="pe-field-label">SEO Title<input class="pe-input" name="seo_title" value="<?=h($editPage['seo_title'])?>"></label>
            <label class="pe-field-label">SEO Description<textarea class="pe-input pe-textarea" name="seo_description"><?=h($editPage['seo_description'])?></textarea></label>
            <label class="pe-field-label">Название в меню<input class="pe-input" name="nav_label" value="<?=h($editPage['nav_label'])?>"></label>
            <div class="pe-settings-checks">
              <label class="pe-check-label"><input type="checkbox" name="is_active" <?=$editPage['is_active']?'checked':''?>> Активна</label>
              <label class="pe-check-label"><input type="checkbox" name="show_in_nav" <?=$editPage['show_in_nav']?'checked':''?>> В навигации</label>
            </div>
            <button type="button" class="btn-primary pe-settings-save" onclick="ajaxForm('editPageForm');peShowAutosave('Настройки сохранены')">Сохранить настройки</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 3-COLUMN EDITOR -->
    <div class="pe-columns">

      <!-- LEFT: section list -->
      <div class="pe-left" id="peLeft">
        <div class="pe-left-header">Блоки</div>
        <div class="pe-section-list" id="peSectionList"></div>
        <button class="pe-add-block-btn" id="peAddBlockBtn" onclick="peOpenBlockPicker()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Добавить блок
        </button>
      </div>

      <!-- CENTER: preview -->
      <div class="pe-center" id="peCenter">
        <div class="pe-preview-list" id="pePreviewList"></div>
        <div class="pe-preview-empty" id="pePreviewEmpty" style="display:none">
          <div class="pe-empty-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="12" width="32" height="24" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="M8 18h32" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="23" width="10" height="2" rx="1" fill="currentColor" opacity=".4"/><rect x="14" y="27" width="20" height="1.5" rx=".75" fill="currentColor" opacity=".25"/><rect x="14" y="30" width="14" height="1.5" rx=".75" fill="currentColor" opacity=".25"/></svg>
          </div>
          <div class="pe-empty-text">Нет блоков. Нажмите «Добавить блок».</div>
          <button class="btn-primary" onclick="peOpenBlockPicker()">+ Добавить первый блок</button>
        </div>
      </div>

      <!-- RIGHT: edit panel -->
      <div class="pe-right" id="peRight">
        <div class="pe-right-empty" id="peRightEmpty">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="4" width="24" height="24" rx="3" stroke="currentColor" stroke-width="1.5" opacity=".3"/><path d="M10 11h12M10 15h8M10 19h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".3"/></svg>
          <span>Выберите блок для редактирования</span>
        </div>
          <div class="pe-right-panel" id="peRightPanel" style="display:none">
          <div class="pe-right-header">
            <select id="peRightTypeSelect" class="pe-type-select" onchange="peChangeBlockType(this.value)" title="Тип блока">
              <option value="hero_simple">Заголовок</option>
              <option value="text">Текст</option>
              <option value="text_image">Текст + фото</option>
              <option value="cards">Карточки</option>
              <option value="contacts_block">Контакты</option>
              <option value="lead_form">Форма</option>
              <option value="products_grid">Товары</option>
              <option value="quote">Цитата</option>
            </select>
            <span class="pe-right-title" id="peRightTitle"></span>
            <button class="pe-right-close" onclick="peDeselectBlock()" title="Закрыть">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="pe-right-fields" id="peRightFields"></div>
          <div class="pe-right-footer">
            <button class="btn-primary pe-save-btn" id="peSaveBlock" onclick="peSaveSelectedBlock()">Сохранить</button>
            <button class="pe-visibility-btn" id="peVisibilityBtn" onclick="peToggleVisibility()"></button>
          </div>
        </div>
      </div>

    </div><!-- /pe-columns -->
  </div><!-- /pe-editor -->

  <!-- BLOCK PICKER OVERLAY -->
  <div class="pe-picker-overlay" id="pePickerOverlay" onclick="if(event.target===this)peCloseBlockPicker()">
    <div class="pe-picker-modal">
      <div class="pe-picker-header">
        <span>Выберите тип блока</span>
        <button class="pe-picker-close" onclick="peCloseBlockPicker()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="pe-picker-body" id="pePickerBody"></div>
    </div>
  </div>

  <?php endif; endif; ?>
</div>

<!-- ════════════ TAB: NAV ════════════ -->
<div class="tabContent <?=$tab==='nav'?'active':''?>" id="tab-nav">
  <div class="pageHeader">
    <div><h1>Навигация</h1><p>Пункты меню на всех страницах сайта</p></div>
    <button class="btn-primary" onclick="openNavModal(null)">+ Добавить пункт</button>
  </div>
  <div id="navList">
  <?php foreach($navItems as $ni): ?>
  <div class="navItemRow" data-id="<?=$ni['id']?>">
    <span class="navDragHandle" title="Перетащить">⠿</span>
    <div>
      <div class="label"><?=h($ni['label'])?></div>
      <div class="url"><?=h($ni['url'])?> <?=$ni['open_new_tab']?'· новая вкладка':''?></div>
    </div>
    <span class="badge <?=$ni['is_active']?'badge-active':'badge-hidden'?>"><?=$ni['is_active']?'Активен':'Скрыт'?></span>
    <button class="btn-ghost btn-sm" onclick='openNavModal(<?=json_encode($ni,JSON_UNESCAPED_UNICODE)?>)'>✏ Изменить</button>
    <button class="btn-danger btn-sm" onclick="deleteNav(<?=$ni['id']?>,this)">Удалить</button>
  </div>
  <?php endforeach; ?>
  </div>
</div>

<!-- ════════════ TAB: SETTINGS ════════════ -->
<div class="tabContent <?=$tab==='reviews'?'active':''?>" id="tab-reviews">
<?php try{$pdo->exec("CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, author TEXT NOT NULL, rating INTEGER DEFAULT 5, text TEXT NOT NULL, is_active INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");}catch(Exception $e){} ?>
<?php $allRev=$pdo->query("SELECT r.*,p.name product_name,p.slug product_slug FROM reviews r LEFT JOIN products p ON p.id=r.product_id ORDER BY r.is_active ASC,r.id DESC")->fetchAll(PDO::FETCH_ASSOC); ?>
<div class="pageHeader"><div><h1>Отзывы</h1><p>Модерация отзывов покупателей</p></div></div>
<?php if(empty($allRev)):?><div style="padding:60px;text-align:center;color:var(--muted)">Отзывов пока нет</div>
<?php else:?><div style="display:grid;gap:12px">
<?php foreach($allRev as $rv):?>
<div class="reviewCard" style="background:var(--panel);border:1px solid <?=$rv['is_active']?'var(--line)':'var(--accent)'?>;border-radius:7px;padding:18px;display:flex;gap:14px;align-items:start">
  <div style="flex:1"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
    <b><?=h($rv['author'])?></b>
    <span style="color:#f5a623"><?=str_repeat('★',(int)$rv['rating'])?><?=str_repeat('☆',5-(int)$rv['rating'])?></span>
    <a href="/product.php?slug=<?=h($rv['product_slug'])?>" target="_blank" style="color:var(--accent);font-size:12px"><?=h($rv['product_name'])?></a>
    <span style="font-size:11px;color:var(--muted)"><?=date('d.m.Y',strtotime($rv['created_at']))?></span>
    <?php if(!$rv['is_active']):?><span class="pendingBadge" style="background:rgba(79,127,255,.1);color:var(--accent);border-radius:6px;padding:2px 7px;font-size:11px;font-weight:700">На модерации</span><?php endif;?>
  </div><p style="color:var(--muted);font-size:14px;line-height:1.6;margin:0"><?=nl2br(h($rv['text']))?></p></div>
  <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
    <?php if(!$rv['is_active']):?><button class="btn-primary btn-sm" onclick="approveReview(<?=$rv['id']?>,this)">Опубликовать</button><?php endif;?>
    <button class="btn-danger btn-sm" onclick="deleteReview(<?=$rv['id']?>,this)">Удалить</button>
  </div>
</div>
<?php endforeach;?></div><?php endif;?>
</div>

<div class="tabContent <?=$tab==='settings'?'active':''?>" id="tab-settings">
  <div class="pageHeader">
    <div><h1>Настройки</h1><p>SEO, контакты, API-ключи</p></div>
  </div>

  <!-- ТЕМА ОФОРМЛЕНИЯ -->
  <div class="panel" style="margin-bottom:18px">
    <h3 style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.18em">Оформление админки</h3>
    <p style="color:var(--muted);font-size:12px;margin-bottom:16px">Выбранная тема сохраняется в браузере</p>
    <div class="themeCards">
      <div class="themeCard tp-light" id="themeCardLight" onclick="setAdminTheme('light')">
        <div class="themeCard-preview tp-light">
          <div class="tc-sidebar"></div>
          <div class="tc-content"></div>
        </div>
        <div class="themeCard-name">Светлая</div>
        <div class="themeCard-desc">Холодный серый фон</div>
      </div>
      <div class="themeCard tp-dark" id="themeCardDark" onclick="setAdminTheme('dark')">
        <div class="themeCard-preview tp-dark">
          <div class="tc-sidebar"></div>
          <div class="tc-content"></div>
        </div>
        <div class="themeCard-name" style="color:#e8eaf0">Тёмная</div>
        <div class="themeCard-desc" style="color:rgba(232,234,240,.4)">Тёмно-синий фон</div>
      </div>
    </div>
  </div>

  <form id="settingsForm" class="panel">
    <input type="hidden" name="action" value="save_settings">
    <div class="formGrid">
      <label class="wide">SEO Title сайта<input name="site_title" value="<?=h(setting('site_title'))?>"></label>
      <label class="wide">SEO Description<textarea name="site_description"><?=h(setting('site_description'))?></textarea></label>
      <label>Телефон<input name="phone" value="<?=h(setting('phone'))?>"></label>
      <label>WhatsApp<input name="whatsapp" value="<?=h(setting('whatsapp'))?>"></label>
      <label>Telegram<input name="telegram" value="<?=h(setting('telegram'))?>"></label>
      <label>Instagram<input name="instagram" value="<?=h(setting('instagram'))?>"></label>
      <label>YouTube<input name="youtube" value="<?=h(setting('youtube'))?>"></label>
      <label>OG Image<input name="og_image" value="<?=h(setting('og_image'))?>"></label>
      <label class="wide">Yandex API Key (YandexGPT)
        <input name="yandex_api_key" type="password" placeholder="Вставьте ключ из Yandex AI Studio" value="<?=h(setting('yandex_api_key'))?>">
      </label>
      <label>СДЭК Client ID
        <input name="cdek_client_id" placeholder="Идентификатор из ЛК СДЭК" value="<?=h(setting('cdek_client_id'))?>">
      </label>
      <label>СДЭК Client Secret
        <input name="cdek_client_secret" type="password" placeholder="Пароль из ЛК СДЭК" value="<?=h(setting('cdek_client_secret'))?>">
      </label>
      <label class="wide" style="margin-top:8px;padding-top:16px;border-top:1px solid var(--line)">
        <span style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)">📞 Новофон (АТС)</span>
      </label>
      <label>Новофон API Key
        <input name="novofon_key" placeholder="appid_XXXXXXX" value="<?=h(setting('novofon_key'))?>">
      </label>
      <label>Новофон Secret
        <input name="novofon_secret" type="password" placeholder="Secret из ЛК Новофон" value="<?=h(setting('novofon_secret'))?>">
      </label>
      <label>Внутренний номер (доб.)
        <input name="novofon_ext" placeholder="100" value="<?=h(setting('novofon_ext','100'))?>">
      </label>
      <div class="formActions">
        <button type="button" class="btn-primary" onclick="ajaxForm('settingsForm')">Сохранить настройки</button>
      </div>
    </div>
  </form>
</div>
<!-- ════════════ TAB: CALLS ════════════ -->
<?php
try {
    $callsList = $pdo->query("SELECT * FROM calls ORDER BY id DESC LIMIT 200")->fetchAll(PDO::FETCH_ASSOC);
    $callsToday = array_filter($callsList, fn($c) => str_starts_with($c['created_at'], date('Y-m-d')));
    $callsIn    = array_filter($callsList, fn($c) => $c['direction']==='in');
    $callsOut   = array_filter($callsList, fn($c) => $c['direction']==='out');
} catch(Exception $e){ $callsList=[]; $callsToday=[]; $callsIn=[]; $callsOut=[]; }
?>
<div class="tabContent <?=$tab==='calls'?'active':''?>" id="tab-calls">
<div class="pageHeader">
  <div><h1>Звонки</h1><p>История входящих и исходящих звонков</p></div>
</div>

<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px">
  <div class="statCard"><span>Всего звонков</span><b><?=count($callsList)?></b></div>
  <div class="statCard"><span>Сегодня</span><b style="color:var(--accent)"><?=count($callsToday)?></b></div>
  <div class="statCard"><span>Входящих / Исходящих</span><b><?=count($callsIn)?> / <?=count($callsOut)?></b></div>
</div>

<?php if(empty($callsList)): ?>
<div style="text-align:center;padding:60px;color:var(--muted)">
  <div style="font-size:48px;margin-bottom:16px">📞</div>
  <p>Звонков пока нет. Настройте вебхук в Новофон → Входящие сценарии.</p>
</div>
<?php else: ?>
<div style="background:var(--panel2);border:1px solid var(--line);border-radius:7px;overflow:hidden">
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="border-bottom:1px solid var(--line)">
        <?php foreach(['','Номер','Клиент','Заказ','Направление','Длит.','Дата',''] as $th): ?>
        <th style="padding:12px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);white-space:nowrap"><?=$th?></th>
        <?php endforeach; ?>
      </tr>
    </thead>
    <tbody>
      <?php foreach($callsList as $c): ?>
      <tr style="border-bottom:1px solid var(--table-border)" id="call-row-<?=$c['id']?>">
        <td style="padding:12px 16px;font-size:18px"><?=$c['direction']==='in'?'📞':'📤'?></td>
        <td style="padding:12px 16px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:700;color:var(--accent)"><?=h($c['caller'])?></span>
            <button onclick="crmCall('<?=h($c['caller'])?>',0)" title="Позвонить" style="background:var(--badge-in-bg);border:1px solid rgba(76,175,80,.25);color:var(--badge-in-color);border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.15s" onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'">📞 Позвонить</button>
          </div>
        </td>
        <td style="padding:12px 16px">
          <?php if($c['caller_name']): ?>
          <span style="font-weight:600"><?=h($c['caller_name'])?></span>
          <?php else: ?>
          <span style="color:var(--muted);font-size:13px">Неизвестный</span>
          <?php endif; ?>
        </td>
        <td style="padding:12px 16px">
          <?php if($c['order_id']): ?>
          <a href="#" onclick="crmOpenOrder(<?=$c['order_id']?>);document.querySelector('[data-tab=orders]').click();return false" style="color:#6ab0ff;font-weight:700;text-decoration:none">#<?=$c['order_id']?></a>
          <span style="color:var(--muted);font-size:12px"> · <?=money($c['order_total'])?></span>
          <?php else: ?>
          <span style="color:var(--muted);font-size:13px">—</span>
          <?php endif; ?>
        </td>
        <td style="padding:12px 16px">
          <?php if($c['direction']==='in'): ?>
          <?php if(($c['status']??'') === 'missed'): ?>
          <span style="background:var(--badge-miss-bg);color:var(--badge-miss-color);border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700">Пропущен</span>
          <?php else: ?>
          <span style="background:var(--badge-in-bg);color:var(--badge-in-color);border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700">Входящий</span>
          <?php endif; ?>
          <?php else: ?>
          <span style="background:var(--badge-out-bg);color:var(--badge-out-color);border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700">Исходящий</span>
          <?php endif; ?>
        </td>
        <td style="padding:12px 16px;color:var(--muted);font-size:13px"><?php $dur=(int)($c['duration']??0); echo $dur>0?(floor($dur/60)>0?floor($dur/60).'м '.($dur%60).'с':$dur.'с'):'<span style="opacity:.3">—</span>'; ?></td>
        <td style="padding:12px 16px;color:var(--muted);font-size:13px"><?=date('d.m.Y H:i', strtotime($c['created_at']))?></td>
        <td style="padding:12px 16px">
          <button onclick="deleteCall(<?=$c['id']?>)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;opacity:.5" title="Удалить">×</button>
        </td>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>
</div>

<!-- ════════════ TAB: STATS ════════════ -->
<?php
// Статистика продаж
$statOrders = $pdo->query("SELECT o.id, o.created_at, o.total, o.status, i.product_name, i.product_id, i.price as item_price, i.qty FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.status != 'cancelled' ORDER BY o.created_at DESC")->fetchAll(PDO::FETCH_ASSOC);

// Группируем по товарам
$statByProduct = [];
$totalRevenue = 0; $totalCost = 0; $totalOrders = 0;
$orderIds = [];
foreach($statOrders as $row){
  if(!in_array($row['id'], $orderIds)){ $orderIds[]=$row['id']; $totalOrders++; }
  $pname = $row['product_name'];
  $pid = $row['product_id'];
  $qty = (int)$row['qty'];
  $rev = (int)$row['item_price'] * $qty;
  // Берём себестоимость из товара
  $costPrice = 0;
  if($pid){ try{ $cp=$pdo->prepare("SELECT cost_price FROM products WHERE id=?"); $cp->execute([$pid]); $costPrice=(int)$cp->fetchColumn(); }catch(Exception $e){} }
  $cost = $costPrice * $qty;
  if(!isset($statByProduct[$pname])){ $statByProduct[$pname]=['name'=>$pname,'qty'=>0,'revenue'=>0,'cost'=>0,'profit'=>0,'margin'=>0]; }
  $statByProduct[$pname]['qty'] += $qty;
  $statByProduct[$pname]['revenue'] += $rev;
  $statByProduct[$pname]['cost'] += $cost;
  $totalRevenue += $rev; $totalCost += $cost;
}
foreach($statByProduct as &$sp){
  $sp['profit'] = $sp['revenue'] - $sp['cost'];
  $sp['margin'] = $sp['revenue'] > 0 ? round($sp['profit']/$sp['revenue']*100) : 0;
}
unset($sp);
usort($statByProduct, fn($a,$b)=>$b['revenue']<=>$a['revenue']);
$totalProfit = $totalRevenue - $totalCost;
$totalMargin = $totalRevenue > 0 ? round($totalProfit/$totalRevenue*100) : 0;
?>
<div class="tabContent <?=$tab==='stats'?'active':''?>" id="tab-stats">
<div class="pageHeader"><div><h1>Статистика продаж</h1><p>Выручка, себестоимость и прибыль по позициям</p></div></div>

<!-- Сводные карточки -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px">
  <div class="statCard"><span>Заказов</span><b><?=$totalOrders?></b></div>
  <div class="statCard"><span>Выручка</span><b style="color:var(--accent)"><?=money($totalRevenue)?></b></div>
  <div class="statCard"><span>Себестоимость</span><b style="color:#6ab0ff"><?=money($totalCost)?></b></div>
  <div class="statCard"><span>Прибыль</span><b style="color:<?=$totalProfit>=0?'#7fd882':'#e05252'?>"><?=money($totalProfit)?></b></div>
</div>

<?php if($totalMargin > 0): ?>
<div style="background:var(--panel2);border:1px solid var(--line);border-radius:7px;padding:16px 20px;margin-bottom:28px;display:flex;align-items:center;gap:20px">
  <div style="font-size:12px;color:var(--c-text3,var(--muted))">Средняя маржа</div>
  <div style="font-size:28px;font-weight:900;color:<?=$totalMargin>=30?'#7fd882':($totalMargin>=15?'#f5a623':'#e05252')?>"><?=$totalMargin?>%</div>
  <div style="flex:1;background:var(--line);border-radius:999px;height:8px;overflow:hidden">
    <div style="height:8px;border-radius:999px;width:<?=min($totalMargin,100)?>%;background:<?=$totalMargin>=30?'#7fd882':($totalMargin>=15?'#f5a623':'#e05252')?>"></div>
  </div>
</div>
<?php endif; ?>

<!-- Таблица по товарам -->
<?php if(!empty($statByProduct)): ?>
<div style="background:var(--panel2);border:1px solid var(--line);border-radius:7px;overflow:hidden;margin-bottom:28px">
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="border-bottom:1px solid var(--line)">
        <?php foreach(['Товар','Продано','Выручка','Себестоимость','Прибыль','Маржа'] as $th): ?>
        <th style="padding:12px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);white-space:nowrap"><?=$th?></th>
        <?php endforeach; ?>
      </tr>
    </thead>
    <tbody>
      <?php foreach($statByProduct as $sp): ?>
      <tr style="border-bottom:1px solid var(--table-border)">
        <td style="padding:13px 16px;font-weight:700;font-size:14px"><?=h($sp['name'])?></td>
        <td style="padding:13px 16px;color:var(--muted)"><?=$sp['qty']?> шт</td>
        <td style="padding:13px 16px;font-weight:700;color:var(--accent)"><?=money($sp['revenue'])?></td>
        <td style="padding:13px 16px;color:#6ab0ff"><?=$sp['cost']>0?money($sp['cost']):'<span style="color:var(--muted);font-size:12px">не указана</span>'?></td>
        <td style="padding:13px 16px;font-weight:700;color:<?=$sp['profit']>=0?'#7fd882':'#e05252'?>"><?=$sp['cost']>0?money($sp['profit']):'—'?></td>
        <td style="padding:13px 16px">
          <?php if($sp['cost']>0): ?>
          <span style="font-weight:900;color:<?=$sp['margin']>=30?'#7fd882':($sp['margin']>=15?'#f5a623':'#e05252')?>"><?=$sp['margin']?>%</span>
          <?php else: ?><span style="color:var(--muted);font-size:12px">нет данных</span><?php endif; ?>
        </td>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php else: ?>
<p style="color:var(--muted)">Нет данных о продажах. Добавьте заказы.</p>
<?php endif; ?>

<p style="font-size:12px;color:var(--muted)">💡 Чтобы видеть прибыль — укажите себестоимость в карточке каждого товара (Товары → редактировать → поле «Себестоимость ₽»).</p>
</div>

</div><!-- /adminContent -->
</div><!-- /adminWrap -->

<!-- ══ PRODUCT DRAWER ══ -->
<div class="drawerOverlay" id="productOverlay" onclick="closeProductDrawer()"></div>
<aside class="drawer" id="productDrawer">
  <div class="drawerHead">
    <h2 id="productDrawerTitle">Новый товар</h2>
    <button class="modalClose" onclick="closeProductDrawer()">✕</button>
  </div>
  <div class="drawerBody">
    <form id="productForm" enctype="multipart/form-data">
      <input type="hidden" name="action" value="save_product">
      <input type="hidden" name="id" id="pf_id">
      <input type="hidden" name="old_image" id="pf_old_image">
      <input type="hidden" name="old_video" id="pf_old_video">
      <div class="photoPreview" id="pf_photo_preview"><span>Нет фото</span></div>
      <div class="drawerTabs">
        <button type="button" class="drawerTab active" data-tab="main">Основное</button>
        <button type="button" class="drawerTab" data-tab="specs">Характеристики</button>
        <button type="button" class="drawerTab" data-tab="media">Медиа</button>
        <button type="button" class="drawerTab" data-tab="seo">SEO</button>
        <button type="button" class="drawerTab" data-tab="blocks">Блоки</button>
      </div>
      <!-- Основное -->
      <div class="drawerTabPanel active" data-tab="main">
        <div class="drawerRow" style="margin-bottom:10px">
          <label class="drawerLabel">Раздел
            <select id="pf_parent_cat" onchange="pfFilterSubcats(this.value)">
              <option value="">— Выберите раздел —</option>
              <?php foreach($cats as $c): if(empty($c['parent_id'])): ?>
              <option value="<?=$c['id']?>"><?=h($c['name'])?></option>
              <?php endif; endforeach; ?>
            </select>
          </label>
          <label class="drawerLabel">Подкатегория
            <select name="category_id" id="pf_category_id">
              <option value="">— Выберите —</option>
              <?php foreach($cats as $c): if(!empty($c['parent_id'])): ?>
              <option value="<?=$c['id']?>" data-parent="<?=$c['parent_id']?>"><?=h($c['name'])?></option>
              <?php endif; endforeach; ?>
            </select>
          </label>
        </div>
        <label class="drawerLabel">Название *<input name="name" id="pf_name" required placeholder="VOLGA FIRE BASE PRO"></label>
        <label class="drawerLabel">Slug URL<input name="slug" id="pf_slug" placeholder="volga-fire-base-pro"></label>
        <label class="drawerLabel">Подзаголовок<input name="subtitle" id="pf_subtitle"></label>
        <label class="drawerLabel">Описание<textarea name="description" id="pf_description" rows="4"></textarea></label>
        <div class="drawerRow">
          <label class="drawerLabel">Цена ₽<input name="price" id="pf_price" type="number"></label>
          <label class="drawerLabel">Старая цена ₽<input name="old_price" id="pf_old_price" type="number"></label>
        </div>
        <div class="drawerRow">
          <label class="drawerLabel">Себестоимость ₽<input name="cost_price" id="pf_cost_price" type="number" placeholder="0"></label>
          <label class="drawerLabel">Вес (г)<input name="weight_g" id="pf_weight_g" type="number" placeholder="12000"></label>
        </div>
        <div class="drawerRow" style="grid-template-columns:1fr 1fr 1fr">
          <label class="drawerLabel">Длина (см)<input name="length_cm" id="pf_length_cm" type="number" placeholder="60"></label>
          <label class="drawerLabel">Ширина (см)<input name="width_cm" id="pf_width_cm" type="number" placeholder="60"></label>
          <label class="drawerLabel">Высота (см)<input name="height_cm" id="pf_height_cm" type="number" placeholder="40"></label>
        </div>
        <div class="drawerRow">
          <label class="drawerLabel">Бейдж<input name="badge" id="pf_badge" placeholder="ХИТ / NEW"></label>
          <label class="drawerLabel">Порядок<input name="sort_order" id="pf_sort_order" type="number" value="10"></label>
        </div>
        <label class="drawerCheck"><input type="checkbox" name="is_active" id="pf_is_active" checked> Товар активен</label>
      </div>
      <!-- Характеристики -->
      <div class="drawerTabPanel" data-tab="specs">
        <label class="drawerLabel">Характеристики<input name="specs" id="pf_specs"></label>
        <label class="drawerLabel">Размеры<input name="dimensions" id="pf_dimensions"></label>
        <label class="drawerLabel">Материалы<input name="materials" id="pf_materials"></label>
        <label class="drawerLabel">Сборка<input name="assembly" id="pf_assembly"></label>
        <label class="drawerLabel">Похожие товары (ID через запятую)<input name="related_ids" id="pf_related_ids"></label>
      </div>
      <!-- Медиа -->
      <div class="drawerTabPanel" data-tab="media">
        <div id="pf_media_gallery" class="mediaGrid2" style="margin-bottom:14px"></div>
        <label class="drawerLabel">Главное фото<input type="file" name="image" accept="image/*" onchange="previewImg(this,'pf_photo_preview')"></label>
        <label class="drawerLabel">Дополнительные фото<input type="file" name="gallery[]" accept="image/*" multiple></label>
        <label class="drawerLabel">Видео MP4<input type="file" name="video" accept="video/mp4,video/webm"></label>
      </div>
      <!-- SEO -->
      <div class="drawerTabPanel" data-tab="seo">
        <div class="seoAiBlock">
          <button type="button" id="seoAiBtn" onclick="runYandexSEO()" style="background:rgba(79,127,255,.06);border:1px solid rgba(79,127,255,.25);color:var(--accent);border-radius:6px;padding:8px 14px;font:600 12px/1 inherit;cursor:pointer;display:block;margin-bottom:8px">✨ Сгенерировать SEO через YandexGPT</button>
          <span id="seoAiStatus" style="font-size:12px;color:var(--muted)">Заполните название товара, затем нажмите кнопку</span>
        </div>
        <label class="drawerLabel">SEO Title<input name="seo_title" id="pf_seo_title"></label>
        <label class="drawerLabel">SEO Description<textarea name="seo_description" id="pf_seo_description" rows="3"></textarea></label>
      </div>
      <!-- Блоки -->
      <div class="drawerTabPanel" data-tab="blocks">
        <div id="pf_blocks_list" style="margin-bottom:12px"></div>
        <button type="button" class="btn-ghost" style="width:100%;justify-content:center" onclick="addPbBlock()">+ Добавить блок к товару</button>
        <div id="pbBlockEditor" style="display:none;background:var(--panel);border:1px solid var(--line2);border-radius:7px;padding:16px;margin-top:12px">
          <form id="pbBlockForm" enctype="multipart/form-data">
            <input type="hidden" name="action" value="save_product_block">
            <input type="hidden" name="product_id" id="pb_product_id">
            <input type="hidden" name="id" id="pb_id">
            <input type="hidden" name="old_pb_image" id="pb_old_image">
            <label class="drawerLabel">Тип<select name="pb_type" id="pb_type"><option value="included">Комплектация</option><option value="how">Как использовать</option><option value="features">Преимущества</option><option value="lifestyle">Lifestyle фото</option></select></label>
            <label class="drawerLabel">Заголовок<input name="pb_title" id="pb_title"></label>
            <label class="drawerLabel">Текст<textarea name="pb_text" id="pb_text" rows="2"></textarea></label>
            <label class="drawerLabel">Пункты через |<input name="pb_extra" id="pb_extra" placeholder="Шаг 1|Шаг 2|Шаг 3"></label>
            <label class="drawerLabel">Фото<input type="file" name="pb_image" accept="image/*"></label>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button type="button" class="btn-primary" onclick="submitPbBlock()">Сохранить блок</button>
              <button type="button" class="btn-ghost" onclick="document.getElementById('pbBlockEditor').style.display='none'">Отмена</button>
            </div>
          </form>
        </div>
      </div>
    </form>
  </div>
  <div class="drawerFoot">
    <button class="btn-primary" onclick="submitProductForm()" id="productSaveBtn">Сохранить</button>
    <button class="btn-ghost" onclick="closeProductDrawer()">Отмена</button>
    <button class="btn-danger" id="productDeleteBtn" style="display:none;margin-left:auto" onclick="deleteProduct()">Удалить товар</button>
  </div>
  <div id="productSaveStatus" style="padding:8px 24px;font-size:13px;display:none;border-top:1px solid var(--table-border)"></div>
</aside>

<!-- ══ MODALS ══ -->
<!-- Nav Modal -->
<div class="modalOverlay" id="navModal">
  <div class="modalBox">
    <button class="modalClose" onclick="closeModal('navModal')">✕</button>
    <h2 id="navModalTitle">Пункт меню</h2>
    <form id="navForm" class="formGrid" style="grid-template-columns:1fr">
      <input type="hidden" name="action" value="save_nav">
      <input type="hidden" name="id" id="nav_id">
      <label>Название<input name="label" id="nav_label" required placeholder="Каталог"></label>
      <label>URL<input name="url" id="nav_url" required placeholder="/#catalog или /catalog.php"></label>
      <label>Порядок<input name="sort_order" id="nav_sort" type="number" value="10"></label>
      <label class="checkRow"><input type="checkbox" name="is_active" id="nav_active" value="1" checked> Показывать</label>
      <label class="checkRow"><input type="checkbox" name="open_new_tab" id="nav_new_tab"> Открывать в новой вкладке</label>
      <div class="formActions">
        <button type="button" class="btn-primary" onclick="saveNav()">Сохранить</button>
        <button type="button" class="btn-ghost" onclick="closeModal('navModal')">Отмена</button>
      </div>
    </form>
  </div>
</div>

<!-- Category Modal -->
<div class="modalOverlay" id="catModal">
  <div class="modalBox">
    <button class="modalClose" onclick="closeModal('catModal')">✕</button>
    <h2 id="catModalTitle">Категория</h2>
    <form id="catForm" class="formGrid" style="grid-template-columns:1fr" enctype="multipart/form-data">
      <input type="hidden" name="action" value="save_category">
      <input type="hidden" name="id" id="cat_id">
      <label>Название *<input name="name" id="cat_name" required></label>
      <label>Slug<input name="slug" id="cat_slug" placeholder="fire-bowls"></label>
      <label>Родительская категория
        <select name="parent_id" id="cat_parent_id">
          <option value="">— Корневая (без родителя) —</option>
          <?php foreach($cats as $pc): if(empty($pc['parent_id'])): ?>
          <option value="<?=$pc['id']?>"><?=h($pc['name'])?></option>
          <?php endif; endforeach; ?>
        </select>
      </label>
      <label>Фото категории<input type="file" name="cat_image" accept="image/*"></label>
      <div id="cat_img_preview" style="display:none;margin-top:4px"><img id="cat_img_preview_img" src="" style="height:80px;border-radius:8px;object-fit:cover"></div>
      <label>SEO Title<input name="seo_title" id="cat_seo_title"></label>
      <label>SEO Description<textarea name="seo_description" id="cat_seo_desc"></textarea></label>
      <label>Порядок<input name="sort_order" id="cat_sort" type="number" value="10"></label>
      <label class="checkRow"><input type="checkbox" name="is_active" id="cat_active" checked> Активна</label>
      <div class="formActions">
        <button type="button" class="btn-primary" onclick="saveCat()">Сохранить</button>
        <button type="button" class="btn-ghost" onclick="closeModal('catModal')">Отмена</button>
      </div>
    </form>
  </div>
</div>

<!-- Block Modal -->
<div class="modalOverlay" id="blockModal">
  <div class="modalBox" style="width:min(680px,calc(100vw - 32px))">
    <button class="modalClose" onclick="closeModal('blockModal')">✕</button>
    <h2 id="blockModalTitle">Блок страницы</h2>
    <form id="blockForm" enctype="multipart/form-data" class="formGrid">
      <input type="hidden" name="action" value="save_block">
      <input type="hidden" name="id" id="block_id">
      <input type="hidden" name="old_image" id="block_old_image">
      <label>Тип блока<select name="type" id="block_type">
        <?php foreach(['hero'=>'Главный экран','quote'=>'Манифест / цитата','brand_intro'=>'Интро бренда','story'=>'Ритуал / история','text_image'=>'Текст + фото','materials'=>'Производство','fire_cooking'=>'Fire cooking','use_cases'=>'Сценарии','trust'=>'Доверие','features'=>'Преимущества','how'=>'Как это работает','lead'=>'Форма заявки','video'=>'Видео'] as $tv=>$tl): ?>
        <option value="<?=$tv?>"><?=$tl?></option>
        <?php endforeach; ?>
      </select></label>
      <label>Название в админке<input name="label" id="block_label" placeholder="Ритуал"></label>
      <label>Eyebrow<input name="eyebrow" id="block_eyebrow" placeholder="FIRE RITUAL"></label>
      <label>Заголовок<input name="title" id="block_title" required></label>
      <label class="wide">Текст<textarea name="text" id="block_text"></textarea></label>
      <label>CTA текст<input name="cta_text" id="block_cta_text"></label>
      <label>CTA ссылка<input name="cta_link" id="block_cta_link" placeholder="#catalog"></label>
      <label class="wide">Пункты через |<input name="extra" id="block_extra"></label>
      <label>Порядок<input name="sort_order" id="block_sort" type="number" value="10"></label>
      <label>Фото<input type="file" name="image" accept="image/*"></label>
      <label class="checkRow wide"><input type="checkbox" name="is_active" id="block_active" checked> Показывать на сайте</label>
      <div class="formActions">
        <button type="button" class="btn-primary" onclick="saveBlock()">Сохранить</button>
        <button type="button" class="btn-ghost" onclick="closeModal('blockModal')">Отмена</button>
      </div>
    </form>
  </div>
</div>

<!-- Page Modal -->
<div class="modalOverlay" id="pageModal">
  <div class="modalBox">
    <button class="modalClose" onclick="closeModal('pageModal')">✕</button>
    <h2 id="pageModalTitle">Страница</h2>
    <form id="pageForm" class="formGrid" style="grid-template-columns:1fr">
      <input type="hidden" name="action" value="save_page">
      <input type="hidden" name="id" id="page_id">
      <label>Название *<input name="title" id="page_title" required></label>
      <label>Slug<input name="slug" id="page_slug" placeholder="about"></label>
      <label class="checkRow"><input type="checkbox" name="is_active" id="page_active" checked> Активна</label>
      <div class="formActions">
        <button type="button" class="btn-primary" onclick="savePage()">Сохранить</button>
        <button type="button" class="btn-ghost" onclick="closeModal('pageModal')">Отмена</button>
      </div>
    </form>
  </div>
</div>

<!-- Page Section Modal -->
<div class="modalOverlay" id="sectionModal">
  <div class="modalBox" style="width:min(640px,calc(100vw - 32px))">
    <button class="modalClose" onclick="closeModal('sectionModal')">✕</button>
    <h2 id="sectionModalTitle">Блок страницы</h2>
    <form id="sectionForm" enctype="multipart/form-data" class="formGrid">
      <input type="hidden" name="action" value="save_page_section">
      <input type="hidden" name="id" id="ps_id">
      <input type="hidden" name="page_id" id="ps_page_id">
      <input type="hidden" name="old_ps_image" id="ps_old_image">
      <label>Тип<select name="ps_type" id="ps_type" onchange="updateSectionFields()">
        <option value="hero_simple">Заголовок страницы</option>
        <option value="text">Текст</option>
        <option value="text_image">Текст + фото</option>
        <option value="cards">Карточки</option>
        <option value="contacts_block">Контакты</option>
        <option value="lead_form">Форма заявки</option>
        <option value="products_grid">Сетка товаров</option>
        <option value="quote">Цитата</option>
      </select></label>
      <label data-types="hero_simple lead_form">Eyebrow<input name="ps_eyebrow" id="ps_eyebrow"></label>
      <label class="wide" data-types="hero_simple text text_image cards contacts_block lead_form products_grid">Заголовок<input name="ps_title" id="ps_title"></label>
      <label class="wide" data-types="text text_image lead_form quote">Текст<textarea name="ps_text" id="ps_text"></textarea></label>
      <label data-types="text_image lead_form">CTA текст<input name="ps_cta_text" id="ps_cta_text"></label>
      <label data-types="text_image">CTA ссылка<input name="ps_cta_link" id="ps_cta_link"></label>
      <label class="wide" id="ps_extra_wrap" data-types="contacts_block cards products_grid quote"><span id="ps_extra_label">Доп. данные</span><textarea name="ps_extra" id="ps_extra" rows="4"></textarea></label>
      <label data-types="text_image">Фото<input type="file" name="ps_image" accept="image/*"></label>
      <label>Порядок<input name="ps_sort" id="ps_sort" type="number" value="10"></label>
      <label class="checkRow wide"><input type="checkbox" name="ps_active" id="ps_active" checked> Активен</label>
      <div class="formActions">
        <button type="button" class="btn-primary" onclick="saveSection()">Сохранить</button>
        <button type="button" class="btn-ghost" onclick="closeModal('sectionModal')">Отмена</button>
      </div>
    </form>
  </div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>
<div class="sortToast" id="sortToast">✓ Порядок сохранён</div>

<script>
// ── UTILITIES ────────────────────────────────────────────────────────────
const API = '/admin/index.php';
const AJAX_HEADERS = {'X-Requested-With':'XMLHttpRequest'};

function toast(msg, type='ok'){
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast ' + type + ' show';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 2800);
}

async function apiFetch(action, data={}){
  const fd = new FormData();
  Object.entries({action,...data}).forEach(([k,v])=>fd.append(k,v));
  const r = await fetch(API, {method:'POST', body:fd, headers:AJAX_HEADERS});
  return r.json();
}

async function apiFetchForm(formEl){
  const fd = new FormData(formEl);
  const r = await fetch(API, {method:'POST', body:fd, headers:AJAX_HEADERS});
  return r.json();
}

async function ajaxForm(formId){
  const form = document.getElementById(formId);
  const btn = form.querySelector('[onclick*="ajaxForm"]') || form.querySelector('.btn-primary');
  if(btn){ btn.disabled=true; const orig=btn.textContent; btn.textContent='Сохранение...'; setTimeout(()=>{btn.disabled=false;btn.textContent=orig;},3000); }
  const d = await apiFetchForm(form);
  if(d.ok) toast('Сохранено'); else toast(d.error||'Ошибка','err');
}

// ── TABS ─────────────────────────────────────────────────────────────────
document.querySelectorAll('.sidebarNav a[data-tab]').forEach(a=>{
  a.addEventListener('click', e=>{
    e.preventDefault();
    const tab = a.dataset.tab;
    document.querySelectorAll('.sidebarNav a').forEach(x=>x.classList.remove('active'));
    a.classList.add('active');
    document.querySelectorAll('.tabContent').forEach(c=>c.classList.remove('active'));
    document.getElementById('tab-'+tab)?.classList.add('active');
    history.replaceState(null,'','?tab='+tab);
  });
});

// ── SECTION FIELD VISIBILITY ─────────────────────────────────────────────
const sectionExtraLabels = {
  contacts_block: 'Контакты (Название|Значение, по одному на строку)',
  cards:          'Карточки (Заголовок::Текст, по одной на строку)',
  products_grid:  'Слаги товаров (через запятую или перенос строки)',
  quote:          'Автор / подпись',
};
function updateSectionFields(){
  const type = document.getElementById('ps_type').value;
  document.querySelectorAll('#sectionForm [data-types]').forEach(el=>{
    const types = el.dataset.types.split(' ');
    el.style.display = types.includes(type) ? '' : 'none';
  });
  // Update extra label
  const extraLabel = document.getElementById('ps_extra_label');
  if(extraLabel) extraLabel.textContent = sectionExtraLabels[type] || 'Доп. данные';
}

// ── MODALS ───────────────────────────────────────────────────────────────
function openModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modalOverlay').forEach(o=>{
  o.addEventListener('click', e=>{ if(e.target===o) o.classList.remove('show'); });
});

// ── ORDERS ───────────────────────────────────────────────────────────────
async function updateOrder(id, status, note, el){
  const d = await apiFetch('update_order',{id,status,manager_note:note});
  if(d.ok){
    toast('Статус обновлён');
    const card = el.closest('.orderCard2');
    const badge = card.querySelector('.statusBadge');
    const labels={new:'Новая',processing:'В работе',done:'Завершена',cancelled:'Отмена'};
    if(badge){ badge.className='statusBadge '+status; badge.textContent=labels[status]; }
  } else toast('Ошибка','err');
}
async function deleteOrder(id, btn){
  if(!confirm('Удалить заявку #'+id+'?')) return;
  btn.disabled=true;
  const d = await apiFetch('delete_order',{id});
  if(d.ok){ toast('Заявка удалена'); btn.closest('.orderCard2').remove(); }
  else { toast('Ошибка','err'); btn.disabled=false; }
}

// Order search/filter
const orderSearch = document.getElementById('orderSearch');
if(orderSearch) orderSearch.oninput = filterOrders;
document.querySelectorAll('.filterPill').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.filterPill').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); filterOrders();
});
function filterOrders(){
  const st = document.querySelector('.filterPill.active')?.dataset.status||'all';
  const q = document.getElementById('orderSearch')?.value.toLowerCase()||'';
  document.querySelectorAll('.orderCard2').forEach(c=>{
    c.style.display=(st==='all'||c.dataset.status===st)&&(!q||c.dataset.search.includes(q))?'block':'none';
  });
}

// ── NAV ──────────────────────────────────────────────────────────────────
function openNavModal(ni){
  document.getElementById('navModalTitle').textContent = ni ? 'Редактировать пункт' : 'Новый пункт меню';
  document.getElementById('nav_id').value     = ni?.id||'';
  document.getElementById('nav_label').value  = ni?.label||'';
  document.getElementById('nav_url').value    = ni?.url||'';
  document.getElementById('nav_sort').value   = ni?.sort_order||10;
  document.getElementById('nav_active').checked   = !ni || ni.is_active==1;
  document.getElementById('nav_new_tab').checked  = ni?.open_new_tab==1;
  openModal('navModal');
}
async function saveNav(){
  const form = document.getElementById('navForm');
  const id = document.getElementById('nav_id').value;
  const fd = new FormData(form);
  // Явно передаём is_active как 1/0
  fd.set('is_active', document.getElementById('nav_active').checked ? '1' : '0');
  fd.set('open_new_tab', document.getElementById('nav_new_tab').checked ? '1' : '0');
  const r = await fetch(API, {method:'POST', body:fd, headers:AJAX_HEADERS});
  const d = await r.json();
  if(!d.ok){ toast(d.error||'Ошибка','err'); return; }
  toast('Навигация сохранена');
  closeModal('navModal');
  // Обновляем список
  const label = document.getElementById('nav_label').value;
  const url   = document.getElementById('nav_url').value;
  const active = document.getElementById('nav_active').checked;
  const newTab = document.getElementById('nav_new_tab').checked;
  const nid = id || d.id;
  if(id){
    const row = document.querySelector(`#navList [data-id="${id}"]`);
    if(row){
      row.querySelector('.label').textContent=label;
      row.querySelector('.url').textContent=url+(newTab?' · новая вкладка':'');
      const badge = row.querySelector('.badge');
      badge.className='badge '+(active?'badge-active':'badge-hidden');
      badge.textContent=active?'Активен':'Скрыт';
    }
  } else {
    const row = document.createElement('div');
    row.className='navItemRow'; row.dataset.id=nid;
    row.innerHTML=`<div><div class="label">${label}</div><div class="url">${url}</div></div>
      <span class="badge badge-active">Активен</span>
      <button class="btn-ghost btn-sm" onclick='openNavModal({"id":${nid},"label":"${label}","url":"${url}","sort_order":10,"is_active":1,"open_new_tab":0})'>✏ Изменить</button>
      <button class="btn-danger btn-sm" onclick="deleteNav(${nid},this)">Удалить</button>`;
    document.getElementById('navList').appendChild(row);
  }
}
async function deleteNav(id,btn){
  if(!confirm('Удалить пункт меню?'))return;
  const d=await apiFetch('delete_nav',{id});
  if(d.ok){toast('Удалено');btn.closest('.navItemRow').remove();}
  else toast('Ошибка','err');
}

// ── CATEGORIES ───────────────────────────────────────────────────────────
function openCatModal(c){
  document.getElementById('catModalTitle').textContent = c?'Редактировать категорию':'Новая категория';
  document.getElementById('cat_id').value = c?.id||'';
  document.getElementById('cat_name').value = c?.name||'';
  document.getElementById('cat_slug').value = c?.slug||'';
  document.getElementById('cat_seo_title').value = c?.seo_title||'';
  document.getElementById('cat_seo_desc').value = c?.seo_description||'';
  document.getElementById('cat_sort').value = c?.sort_order||10;
  document.getElementById('cat_active').checked = !c||c.is_active==1;
  // parent_id
  const parentSel = document.getElementById('cat_parent_id');
  if(parentSel) parentSel.value = c?.parent_id||'';
  // image preview
  const preview = document.getElementById('cat_img_preview');
  const previewImg = document.getElementById('cat_img_preview_img');
  if(c?.image && preview && previewImg){
    previewImg.src = '/' + c.image;
    preview.style.display = 'block';
  } else if(preview){
    preview.style.display = 'none';
  }
  openModal('catModal');
}
async function saveCat(){
  const form=document.getElementById('catForm');
  const fd=new FormData(form);
  fd.set('is_active',document.getElementById('cat_active').checked?'1':'0');
  // Без X-Requested-With для multipart/file upload
  const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});
  const d=await r.json();
  if(!d.ok){toast(d.error||'Ошибка','err');return;}
  toast('Категория сохранена'); closeModal('catModal'); location.reload();
}
async function deleteCat(id,btn){
  if(!confirm('Удалить категорию?'))return;
  const d=await apiFetch('delete_category',{id});
  if(d.ok){toast('Удалено');btn.closest('.navItemRow').remove();}
  else toast('Ошибка','err');
}

// ── BLOCKS ───────────────────────────────────────────────────────────────
async function openBlockById(id){
  const fd=new FormData(); fd.append('action','get_block'); fd.append('id',id);
  const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});
  const b=await r.json();
  openBlockModal(b);
}
function openBlockModal(b){
  document.getElementById('blockModalTitle').textContent=b?'Редактировать блок':'Новый блок';
  document.getElementById('block_id').value=b?.id||'';
  document.getElementById('block_old_image').value=b?.image||'';
  document.getElementById('block_label').value=b?.label||'';
  document.getElementById('block_type').value=b?.type||'quote';
  document.getElementById('block_eyebrow').value=b?.eyebrow||'';
  document.getElementById('block_title').value=b?.title||'';
  document.getElementById('block_text').value=b?.text||'';
  document.getElementById('block_cta_text').value=b?.cta_text||'';
  document.getElementById('block_cta_link').value=b?.cta_link||'';
  document.getElementById('block_extra').value=b?.extra||'';
  document.getElementById('block_sort').value=b?.sort_order||10;
  document.getElementById('block_active').checked=!b||b.is_active==1;
  openModal('blockModal');
}
async function saveBlock(){
  const form=document.getElementById('blockForm');
  const fd=new FormData(form);
  fd.set('is_active',document.getElementById('block_active').checked?'1':'0');
  const r=await fetch(API,{method:'POST',body:fd,headers:AJAX_HEADERS});
  const d=await r.json();
  if(!d.ok){toast(d.error||'Ошибка','err');return;}
  toast('Блок сохранён'); closeModal('blockModal'); location.reload();
}
function toggleBlockCard(card){ card.classList.toggle('open'); }
async function blockToggle(id,btn){
  btn.disabled=true;
  const d=await fetch(API,{method:'POST',body:new URLSearchParams({action:'toggle_block',id}),headers:AJAX_HEADERS});
  const j=await d.json(); btn.disabled=false;
  if(j.ok){
    const card=btn.closest('.blockCard');
    btn.textContent=j.is_active?'Скрыть':'Показать';
    card.classList.toggle('hidden-block',!j.is_active);
    toast(j.is_active?'Блок показан':'Блок скрыт');
  }
}
async function blockDelete(id,btn){
  if(!confirm('Удалить блок?'))return;
  btn.disabled=true;
  const d=await fetch(API,{method:'POST',body:new URLSearchParams({action:'delete_block',id}),headers:AJAX_HEADERS});
  const j=await d.json();
  if(j.ok){toast('Блок удалён');btn.closest('.blockCard').remove();}
  else{toast('Ошибка','err');btn.disabled=false;}
}
// Drag-and-drop блоков
(function(){
  const board=document.getElementById('blocksList'); if(!board) return;
  let dragging=null;
  board.querySelectorAll('.blockCard').forEach(card=>{
    const h=card.querySelector('.blockCardDrag'); if(!h) return;
    h.setAttribute('draggable','true');
    h.addEventListener('dragstart',e=>{dragging=card;card.style.opacity='.35';e.dataTransfer.effectAllowed='move';});
    h.addEventListener('dragend',()=>{
      card.style.opacity='';dragging=null;
      const ids=Array.from(board.querySelectorAll('.blockCard')).map(c=>c.dataset.id);
      fetch(API,{method:'POST',body:new URLSearchParams({action:'sort_blocks',ids:JSON.stringify(ids)}),headers:AJAX_HEADERS})
      .then(()=>{const t=document.getElementById('sortToast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000);});
    });
    card.addEventListener('dragover',e=>{
      e.preventDefault(); if(!dragging||dragging===card) return;
      const rect=card.getBoundingClientRect();
      if(e.clientY<rect.top+rect.height/2) board.insertBefore(dragging,card);
      else board.insertBefore(dragging,card.nextSibling);
    });
  });
})();

// Drag-and-drop навигации
(function(){
  const list = document.getElementById('navList'); if(!list) return;
  let dragging = null;
  list.querySelectorAll('.navItemRow').forEach(row=>{
    const h = row.querySelector('.navDragHandle'); if(!h) return;
    h.setAttribute('draggable','true');
    h.addEventListener('dragstart', e=>{
      dragging = row; row.style.opacity='.4';
      e.dataTransfer.effectAllowed='move';
    });
    h.addEventListener('dragend', ()=>{
      row.style.opacity=''; dragging=null;
      list.querySelectorAll('.navItemRow').forEach(r=>r.classList.remove('dnd-over'));
      const ids = Array.from(list.querySelectorAll('.navItemRow')).map(r=>r.dataset.id);
      const fd = new FormData();
      fd.append('action','sort_nav'); fd.append('ids', JSON.stringify(ids));
      fetch('/admin/index.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}})
        .then(()=>{ const t=document.getElementById('sortToast'); if(t){t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000);}});
    });
    row.addEventListener('dragover', e=>{
      e.preventDefault(); if(!dragging||dragging===row) return;
      list.querySelectorAll('.navItemRow').forEach(r=>r.classList.remove('dnd-over'));
      row.classList.add('dnd-over');
      const rect=row.getBoundingClientRect();
      if(e.clientY < rect.top+rect.height/2) list.insertBefore(dragging,row);
      else list.insertBefore(dragging,row.nextSibling);
    });
  });
})();

// ── PAGES ────────────────────────────────────────────────────────────────
function openPageModal(pg){
  document.getElementById('pageModalTitle').textContent=pg?'Настройки страницы':'Новая страница';
  document.getElementById('page_id').value=pg?.id||'';
  document.getElementById('page_title').value=pg?.title||'';
  document.getElementById('page_slug').value=pg?.slug||'';
  document.getElementById('page_active').checked=!pg||pg.is_active==1;
  openModal('pageModal');
}
async function savePage(){
  const form=document.getElementById('pageForm');
  const fd=new FormData(form);
  fd.set('is_active',document.getElementById('page_active').checked?'1':'0');
  const r=await fetch(API,{method:'POST',body:fd,headers:AJAX_HEADERS});
  const d=await r.json();
  if(!d.ok){toast(d.error||'Ошибка','err');return;}
  toast('Страница сохранена'); closeModal('pageModal');
  if(!document.getElementById('page_id').value && d.id) location.href='?tab=pages&pid='+d.id;
  else location.reload();
}
async function deletePage(id,btn){
  if(!confirm('Удалить страницу со всеми блоками?'))return;
  const d=await apiFetch('delete_page',{id});
  if(d.ok){toast('Страница удалена');btn.closest('.navItemRow').remove();}
  else toast('Ошибка','err');
}

// Page sections
function openSectionModal(ps,pageId){
  document.getElementById('sectionModalTitle').textContent=ps?'Редактировать блок':'Добавить блок';
  document.getElementById('ps_id').value=ps?.id||'';
  document.getElementById('ps_page_id').value=pageId;
  document.getElementById('ps_old_image').value=ps?.image||'';
  document.getElementById('ps_type').value=ps?.type||'text';
  updateSectionFields();
  document.getElementById('ps_eyebrow').value=ps?.eyebrow||'';
  document.getElementById('ps_title').value=ps?.title||'';
  document.getElementById('ps_text').value=ps?.text||'';
  document.getElementById('ps_cta_text').value=ps?.cta_text||'';
  document.getElementById('ps_cta_link').value=ps?.cta_link||'';
  document.getElementById('ps_extra').value=ps?.extra||'';
  document.getElementById('ps_sort').value=ps?.sort_order||10;
  document.getElementById('ps_active').checked=!ps||ps.is_active==1;
  openModal('sectionModal');
}
async function saveSection(){
  const form=document.getElementById('sectionForm');
  const fd=new FormData(form);
  fd.set('ps_active',document.getElementById('ps_active').checked?'1':'0');
  const r=await fetch(API,{method:'POST',body:fd,headers:AJAX_HEADERS});
  const d=await r.json();
  if(!d.ok){toast(d.error||'Ошибка','err');return;}
  toast('Блок сохранён'); closeModal('sectionModal'); setTimeout(()=>location.reload(), 800);
}
async function deleteSection(id,pageId,btn){
  if(!confirm('Удалить блок?'))return;
  const fd=new FormData();fd.append('action','delete_page_section');fd.append('id',id);fd.append('page_id',pageId);
  const r=await fetch(API,{method:'POST',body:fd,headers:AJAX_HEADERS});
  const d=await r.json();
  if(d.ok){
    toast('Блок удалён');
    const card=btn.closest('.sectionCard');
    if(card){card.style.transition='opacity .3s';card.style.opacity='0';setTimeout(()=>card.remove(),300);}
  } else toast(d.error||'Ошибка','err');
}

// ── PRODUCTS ─────────────────────────────────────────────────────────────
const productSearch=document.getElementById('productSearch');
if(productSearch) productSearch.oninput=function(){
  const q=this.value.toLowerCase();
  document.querySelectorAll('.productCard2').forEach(c=>c.style.display=c.dataset.name.includes(q)?'':'none');
};

function openProductDrawer(p){
  document.getElementById('productDrawerTitle').textContent=p?'Редактировать товар':'Новый товар';
  document.getElementById('productOverlay').classList.add('show');
  document.getElementById('productDrawer').classList.add('open');
  document.body.style.overflow='hidden';
  // Reset tabs
  document.querySelectorAll('.drawerTab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.drawerTabPanel').forEach(t=>t.classList.remove('active'));
  document.querySelector('.drawerTab[data-tab="main"]').classList.add('active');
  document.querySelector('.drawerTabPanel[data-tab="main"]').classList.add('active');
  if(p){
    document.getElementById('pf_id').value=p.id||'';
    document.getElementById('pf_old_image').value=p.image||'';
    document.getElementById('pf_old_video').value=p.video||'';
    document.getElementById('pf_name').value=p.name||'';
    document.getElementById('pf_slug').value=p.slug||'';
    document.getElementById('pf_subtitle').value=p.subtitle||'';
    document.getElementById('pf_description').value=p.description||'';
    document.getElementById('pf_price').value=p.price||'';
    document.getElementById('pf_old_price').value=p.old_price||'';
    document.getElementById('pf_cost_price').value=p.cost_price||'';
    document.getElementById('pf_weight_g').value=p.weight_g||12000;
    document.getElementById('pf_length_cm').value=p.length_cm||60;
    document.getElementById('pf_width_cm').value=p.width_cm||60;
    document.getElementById('pf_height_cm').value=p.height_cm||40;
    document.getElementById('pf_badge').value=p.badge||'';
    document.getElementById('pf_sort_order').value=p.sort_order||10;
    document.getElementById('pf_specs').value=p.specs||'';
    document.getElementById('pf_dimensions').value=p.dimensions||'';
    document.getElementById('pf_materials').value=p.materials||'';
    document.getElementById('pf_assembly').value=p.assembly||'';
    document.getElementById('pf_related_ids').value=p.related_ids||'';
    document.getElementById('pf_seo_title').value=p.seo_title||'';
    document.getElementById('pf_seo_description').value=p.seo_description||'';
    document.getElementById('pf_is_active').checked=p.is_active==1;
    // Photo
    const preview=document.getElementById('pf_photo_preview');
    if(p.image){ preview.innerHTML=`<img src="../${p.image}">`; }
    else preview.innerHTML='<span>Нет фото</span>';
    // Category — двухуровневый выбор
    const subOpt = document.querySelector('#pf_category_id option[value="'+p.category_id+'"]');
    const parentId = subOpt ? subOpt.dataset.parent : '';
    const parentSel = document.getElementById('pf_parent_cat');
    if(parentSel){ parentSel.value = parentId||''; pfFilterSubcats(parentId||'', p.category_id); }
    else { document.getElementById('pf_category_id').value = p.category_id; }
    // Delete btn
    document.getElementById('productDeleteBtn').style.display='block';
    document.getElementById('productDeleteBtn').dataset.id=p.id;
    // Load product blocks and media
    loadProductBlocks(p.id);
    loadProductMedia(p.id);
  } else {
    document.getElementById('productForm').reset();
    document.getElementById('pf_id').value='';
    document.getElementById('pf_photo_preview').innerHTML='<span>Нет фото</span>';
    const ps = document.getElementById('pf_parent_cat');
    if(ps){ ps.value=''; pfFilterSubcats(''); }
    document.getElementById('productDeleteBtn').style.display='none';
    document.getElementById('pf_blocks_list').innerHTML='<p style="color:var(--muted);font-size:13px">Сохраните товар, чтобы добавить блоки</p>';
  }
  document.getElementById('productSaveStatus').style.display='none';
}
function closeProductDrawer(){
  document.getElementById('productOverlay').classList.remove('show');
  document.getElementById('productDrawer').classList.remove('open');
  document.body.style.overflow='';
}
document.getElementById('productOverlay').onclick=closeProductDrawer;

// Drawer tabs
document.querySelectorAll('.drawerTab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const tab=btn.dataset.tab;
    document.querySelectorAll('.drawerTab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.drawerTabPanel').forEach(t=>t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.drawerTabPanel[data-tab="${tab}"]`).classList.add('active');
  });
});

function pfFilterSubcats(parentId, selectVal){
  const sub = document.getElementById('pf_category_id');
  if(!sub) return;
  [...sub.options].forEach(o=>{
    if(!o.value){ o.style.display=''; return; } // пустой вариант всегда виден
    o.style.display = (!parentId || o.dataset.parent==parentId) ? '' : 'none';
  });
  // Сбрасываем или устанавливаем значение
  if(selectVal){ sub.value = selectVal; }
  else {
    // выбираем первый видимый
    const first = [...sub.options].find(o=>o.value && o.style.display!=='none');
    sub.value = first ? first.value : '';
  }
}

function previewImg(input, previewId){
  if(!input.files||!input.files[0]) return;
  const r=new FileReader();
  r.onload=e=>{
    const prev=document.getElementById(previewId);
    prev.innerHTML=`<img src="${e.target.result}">`;
  };
  r.readAsDataURL(input.files[0]);
}

async function submitProductForm(){
  const form=document.getElementById('productForm');
  const btn=document.getElementById('productSaveBtn');
  const status=document.getElementById('productSaveStatus');
  btn.disabled=true; btn.textContent='Сохранение...';
  status.style.display='none';
  try{
    const fd=new FormData(form);
    const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:AJAX_HEADERS});
    const d=await r.json();
    if(d.ok){
      toast('Товар сохранён');
      if(d.id){
        document.getElementById('pf_id').value=d.id;
        document.getElementById('productDeleteBtn').dataset.id=d.id;
        document.getElementById('productDeleteBtn').style.display='block';
        document.getElementById('pb_product_id').value=d.id;
      }
      if(d.image){
        document.getElementById('pf_old_image').value=d.image;
        document.getElementById('pf_photo_preview').innerHTML=`<img src="../${d.image}">`;
      }
      // Перезагружаем галерею
      const _pid=document.getElementById('pf_id').value;
      if(_pid) loadProductMedia(_pid);
      // Update card in grid
      const name=document.getElementById('pf_name').value;
      const price=document.getElementById('pf_price').value;
      const existCard=document.querySelector(`.productCard2[data-id="${d.id||document.getElementById('pf_id').value}"]`);
      if(existCard){
        existCard.querySelector('.cardName').textContent=name;
        existCard.querySelector('.cardPrice').textContent=new Intl.NumberFormat('ru-RU').format(price)+' ₽';
      }
    } else toast(d.error||'Ошибка','err');
  }catch(e){ toast('Ошибка: '+e.message,'err'); }
  btn.disabled=false; btn.textContent='Сохранить';
}

async function deleteProduct(){
  const id=document.getElementById('productDeleteBtn').dataset.id;
  if(!id||!confirm('Удалить товар?'))return;
  const fd=new FormData(); fd.append('action','delete_product'); fd.append('id',id);
  const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:AJAX_HEADERS});
  const d=await r.json();
  if(d.ok){
    toast('Товар удалён'); closeProductDrawer();
    const card=document.querySelector(`.productCard2[data-id="${id}"]`);
    if(card){card.style.transition='opacity .3s';card.style.opacity='0';setTimeout(()=>card.remove(),300);}
  } else toast('Ошибка','err');
}

// Product blocks
async function loadProductMedia(pid){
  const gallery=document.getElementById('pf_media_gallery'); if(!gallery||!pid) return;
  gallery.innerHTML='<p style="color:var(--muted);font-size:12px">Загрузка...</p>';
  try{
    const fd=new FormData(); fd.append('action','get_media'); fd.append('product_id',pid);
    const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});
    const items=await r.json();
    if(!items.length){gallery.innerHTML='<p style="color:var(--muted);font-size:12px">Фото не добавлены</p>';return;}
    gallery.innerHTML=items.map(m=>`
      <div class="mediaItem2" data-id="${m.id}">
        <img src="../${m.path}" alt="">
        <button class="mediaRemove" onclick="deleteMedia(${m.id},${pid},this)" title="Удалить фото">✕</button>
      </div>`).join('');
  }catch(e){gallery.innerHTML='<p style="color:var(--muted);font-size:12px">Ошибка загрузки</p>';}
}

async function deleteMedia(mid, pid, btn){
  btn.disabled=true;
  const fd=new FormData(); fd.append('action','delete_media'); fd.append('media_id',mid); fd.append('product_id',pid);
  const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});
  const d=await r.json();
  if(d.ok){ toast('Фото удалено'); btn.closest('.mediaItem2').remove(); }
  else { toast('Ошибка','err'); btn.disabled=false; }
}

async function loadProductBlocks(pid){
  const list=document.getElementById('pf_blocks_list'); if(!list||!pid) return;
  list.innerHTML='<p style="color:var(--muted);font-size:13px">Загрузка...</p>';
  try{
    const r=await fetch('/admin/get_product_blocks.php?pid='+pid);
    const blocks=await r.json();
    if(!blocks.length){list.innerHTML='<p style="color:var(--muted);font-size:13px;text-align:center;padding:16px 0">Блоков нет</p>';return;}
    const labels={included:'Комплектация',how:'Как использовать',features:'Преимущества',lifestyle:'Lifestyle',text_image:'Текст+фото'};
    list.innerHTML=blocks.map(b=>`
      <div class="sectionCard" data-id="${b.id}">
        <span class="typePill">${labels[b.type]||b.type}</span>
        <span class="sTitle">${b.title||'—'}</span>
        <button type="button" class="btn-ghost btn-sm" onclick='editPbBlock(${JSON.stringify(b).replace(/"/g,"&quot;")})'>✏</button>
        <button type="button" class="btn-danger btn-sm" onclick="deletePbBlock(${b.id},this)">✕</button>
      </div>`).join('');
  }catch(e){list.innerHTML='<p style="color:var(--muted);font-size:12px">Ошибка загрузки</p>';}
}
function addPbBlock(){
  const pid=document.getElementById('pf_id').value;
  if(!pid){toast('Сначала сохраните товар','err');return;}
  document.getElementById('pb_id').value='';
  document.getElementById('pb_product_id').value=pid;
  document.getElementById('pb_old_image').value='';
  document.getElementById('pb_title').value='';
  document.getElementById('pb_text').value='';
  document.getElementById('pb_extra').value='';
  document.getElementById('pbBlockEditor').style.display='block';
}
function editPbBlock(b){
  document.getElementById('pb_id').value=b.id;
  document.getElementById('pb_product_id').value=b.product_id;
  document.getElementById('pb_old_image').value=b.image||'';
  document.getElementById('pb_type').value=b.type;
  document.getElementById('pb_title').value=b.title||'';
  document.getElementById('pb_text').value=b.text||'';
  document.getElementById('pb_extra').value=b.extra||'';
  document.getElementById('pbBlockEditor').style.display='block';
}
async function submitPbBlock(){
  const fd=new FormData(document.getElementById('pbBlockForm'));
  const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:AJAX_HEADERS});
  const d=await r.json();
  if(d.ok){
    toast('Блок сохранён');
    document.getElementById('pbBlockEditor').style.display='none';
    loadProductBlocks(document.getElementById('pf_id').value);
  } else toast(d.error||'Ошибка','err');
}
async function deletePbBlock(id,btn){
  if(!confirm('Удалить блок?'))return;
  const fd=new FormData(); fd.append('action','delete_product_block'); fd.append('id',id);
  const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:AJAX_HEADERS});
  const d=await r.json();
  if(d.ok){toast('Удалено');btn.closest('.sectionCard').remove();}
  else toast('Ошибка','err');
}

// ── SETTINGS ─────────────────────────────────────────────────────────────
// Handled by ajaxForm('settingsForm')

// ── SEO AI ───────────────────────────────────────────────────────────────
async function runYandexSEO(){
  const btn=document.getElementById('seoAiBtn');
  const status=document.getElementById('seoAiStatus');
  const name=document.getElementById('pf_name')?.value||'';
  const desc=document.getElementById('pf_description')?.value||'';
  const specs=document.getElementById('pf_specs')?.value||'';
  const catEl=document.getElementById('pf_category_id');
  const cat=catEl?catEl.options[catEl.selectedIndex]?.textContent:'';
  if(!name){status.textContent='⚠ Заполните название товара';status.style.color='#e05';return;}
  btn.disabled=true;btn.textContent='⏳ Генерирую...';status.textContent='';status.style.color='var(--muted)';
  try{
    const fd=new FormData(); fd.append('action','yandex_seo'); fd.append('name',name); fd.append('description',desc); fd.append('specs',specs); fd.append('category',cat);
    const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:AJAX_HEADERS});
    const d=await r.json();
    if(d.error){status.style.color='#e05';status.textContent='⚠ '+d.error;return;}
    if(d.data?.seo_title) document.getElementById('pf_seo_title').value=d.data.seo_title;
    if(d.data?.seo_description) document.getElementById('pf_seo_description').value=d.data.seo_description;
    status.style.color='#4caf50';
    status.textContent=d.data.keywords?'✓ Готово · '+d.data.keywords:'✓ Готово';
  }catch(e){status.style.color='#e05';status.textContent='⚠ Ошибка: '+e.message;}
  btn.disabled=false;btn.textContent='✨ Сгенерировать через YandexGPT';
}

// ══════════════════════════════════════════════════════
// CRM KANBAN JS
// ══════════════════════════════════════════════════════
let crmCurrentFilter = 'all';
let crmCurrentView = 'kanban';
let crmCurrentOrderId = null;
let crmDragCard = null;
const CRM_STATUS_LABELS = {new:'Новая',processing:'В работе',done:'Готово',cancelled:'Отмена'};

// ── View toggle ────────────────────────────────────────
function crmSetView(v){
  crmCurrentView = v;
  const kanban = document.getElementById('crmKanban');
  const list = document.getElementById('crmList');
  const btnK = document.getElementById('crmBtnKanban');
  const btnL = document.getElementById('crmBtnList');
  if(!kanban||!list) return;
  kanban.style.display = v==='kanban'?'grid':'none';
  list.style.display = v==='list'?'block':'none';
  document.querySelectorAll('.viewToggle button').forEach(b=>b.classList.remove('act'));
  if(v==='kanban' && btnK) btnK.classList.add('act');
  if(v==='list' && btnL) btnL.classList.add('act');
}

// ── Filter ────────────────────────────────────────────
function crmSetFilter(el, f){
  crmCurrentFilter = f;
  document.querySelectorAll('[data-crmfilter]').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  crmFilter();
}

function crmFilter(){
  const q = (document.getElementById('crmSearch')?.value||'').toLowerCase();
  document.querySelectorAll('.crm-card').forEach(card=>{
    const ms = crmCurrentFilter==='all'||card.dataset.status===crmCurrentFilter;
    const mq = !q||card.dataset.search.includes(q);
    card.style.display = ms&&mq?'':'none';
  });
  document.querySelectorAll('.crm-list-row').forEach(row=>{
    const ms = crmCurrentFilter==='all'||row.dataset.status===crmCurrentFilter;
    const mq = !q||row.dataset.search.includes(q);
    row.style.display = ms&&mq?'':'none';
  });
}

// ── Drag & Drop Kanban ─────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  initCrmDnd();
});
function initCrmDnd(){
  document.querySelectorAll('.crm-card').forEach(card=>{
    card.addEventListener('dragstart', e=>{
      crmDragCard = card;
      setTimeout(()=>card.style.opacity='.35',0);
      e.dataTransfer.effectAllowed='move';
    });
    card.addEventListener('dragend', ()=>{
      card.style.opacity='';
      document.querySelectorAll('.crm-col-body').forEach(b=>b.style.background='');
      crmDragCard=null;
    });
  });
  document.querySelectorAll('.crm-col-body').forEach(col=>{
    col.addEventListener('dragover', e=>{
      e.preventDefault();
      col.style.background='rgba(79,127,255,.05)';
    });
    col.addEventListener('dragleave', ()=>col.style.background='');
    col.addEventListener('drop', async e=>{
      e.preventDefault();
      col.style.background='';
      if(!crmDragCard||crmDragCard.dataset.status===col.dataset.status) return;
      const newStatus = col.dataset.status;
      const oldStatus = crmDragCard.dataset.status;
      const id = crmDragCard.dataset.id;
      col.appendChild(crmDragCard);
      crmDragCard.dataset.status = newStatus;
      crmUpdateCount(oldStatus);
      crmUpdateCount(newStatus);
      const fd=new FormData();
      fd.append('action','update_order');fd.append('id',id);fd.append('status',newStatus);fd.append('manager_note','');
      await fetch('/admin/index.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});
      toast('Статус → '+CRM_STATUS_LABELS[newStatus]);
    });
  });
}
function crmUpdateCount(status){
  const el = document.getElementById('crmCount-'+status);
  if(!el) return;
  const col = document.getElementById('crmCol-'+status);
  el.textContent = col?col.querySelectorAll('.crm-card:not([style*="display: none"])').length:0;
}

// ── Order Drawer ───────────────────────────────────────
function crmOpenOrder(id){
  crmCurrentOrderId = id;
  // Создаём drawer если нет
  if(!document.getElementById('crmDrawer')) crmCreateDrawer();
  document.getElementById('crmDrawerTitle').textContent = 'Заявка #'+id;
  document.getElementById('crmDrawerBody').innerHTML = '<div style="text-align:center;padding:60px;color:var(--muted)">Загрузка...</div>';
  document.getElementById('crmDrawerOverlay').classList.add('show');
  document.getElementById('crmDrawer').style.transform='translateX(0)';
  crmLoadOrder(id);
}

function crmCreateDrawer(){
  const overlay = document.createElement('div');
  overlay.id='crmDrawerOverlay';
  overlay.className='drawerOverlay';
  overlay.onclick=crmCloseDrawer;
  document.body.appendChild(overlay);

  const drawer = document.createElement('aside');
  drawer.id='crmDrawer';
  drawer.className='drawer';
  drawer.style.cssText='position:fixed;top:0;right:0;width:min(660px,100vw);height:100vh;background:var(--panel);border-left:1px solid var(--line2);z-index:801;transform:translateX(100%);transition:transform .3s;display:flex;flex-direction:column;overflow:hidden';
  drawer.innerHTML=`
    <div class="drawerHead">
      <h2 id="crmDrawerTitle" style="font-size:18px;text-transform:uppercase;font-weight:900">Заявка</h2>
      <button class="modalClose" onclick="crmCloseDrawer()">✕</button>
    </div>
    <div id="crmDrawerBody" class="drawerBody"></div>
    <div id="crmDrawerFoot" class="drawerFoot"></div>
  `;
  document.body.appendChild(drawer);
}

function crmCloseDrawer(){
  document.getElementById('crmDrawerOverlay')?.classList.remove('show');
  const d=document.getElementById('crmDrawer');
  if(d) d.style.transform='translateX(100%)';
  crmCurrentOrderId=null;
}

async function crmLoadOrder(id){
  const fd=new FormData();
  fd.append('action','get_order');fd.append('order_id',id);
  const r=await fetch('/admin/cdek_order.php',{method:'POST',body:fd});
  const o=await r.json();
  if(o.error){document.getElementById('crmDrawerBody').innerHTML='<p style="color:#e05;padding:20px">'+o.error+'</p>';return;}
  crmRenderOrder(o);
  crmLoadClientHistory(o.phone, o.id);
}

function crmRenderOrder(o){
  const items=o.items||[];
  const sColors={new:'#e8943a',processing:'#3a8ae8',done:'#4caf50',cancelled:'#666'};
  const sc=sColors[o.status]||'#666';

  document.getElementById('crmDrawerBody').innerHTML=`
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:7px;padding:16px;margin-bottom:12px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted);margin-bottom:12px;font-weight:700">Клиент</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><div style="font-size:10px;color:var(--muted);margin-bottom:3px">Имя</div><div style="font-weight:700">${crmEsc(o.customer_name)}</div></div>
        <div><div style="font-size:10px;color:var(--muted);margin-bottom:3px">Телефон</div><div style="display:flex;align-items:center;gap:8px"><a href="tel:${crmEsc(o.phone)}" style="color:var(--accent);font-weight:700;text-decoration:none">${crmEsc(o.phone)}</a><button onclick="crmCall('${crmEsc(o.phone)}',${o.id})" style="background:rgba(76,175,80,.15);border:1px solid rgba(76,175,80,.3);color:#7fd882;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer">📞 Позвонить</button></div></div>
        ${o.email?`<div><div style="font-size:10px;color:var(--muted);margin-bottom:3px">Email</div><a href="mailto:${crmEsc(o.email)}" style="color:var(--accent);font-weight:700;text-decoration:none">${crmEsc(o.email)}</a></div>`:''}
        <div style="grid-column:1/-1"><div style="font-size:10px;color:var(--muted);margin-bottom:3px">Адрес / Город</div><div style="font-size:13px">${crmEsc(o.address||'—')}</div></div>
        <div><div style="font-size:10px;color:var(--muted);margin-bottom:3px">Доставка</div><div style="font-size:13px">${crmEsc(o.delivery_method||'—')}</div></div>
        <div><div style="font-size:10px;color:var(--muted);margin-bottom:3px">Оплата</div><div style="font-size:13px">${crmEsc(o.payment_method||'—')}${(o.payment_method||'').toLowerCase().includes('карт')?' <span style=\"background:rgba(79,127,255,.15);color:var(--accent);border-radius:4px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:4px\">⚡ нужна ссылка</span>':''}${(o.payment_method||'').toLowerCase().includes('счёт')||(o.payment_method||'').toLowerCase().includes('счет')?' <span style=\"background:rgba(224,123,42,.15);color:var(--orange,#e07b2a);border-radius:4px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:4px\">📄 выставить счёт</span>':''}</div></div>
        ${o.comment?`<div style="grid-column:1/-1"><div style="font-size:10px;color:var(--muted);margin-bottom:3px">Комментарий</div><div style="font-size:12px;color:var(--muted);white-space:pre-wrap;background:var(--panel2);border-radius:8px;padding:8px 10px">${crmEsc(o.comment)}</div></div>`:''}
      </div>
    </div>

    <div id="crmClientHistory" style="margin-bottom:12px"></div>

    <div style="background:var(--panel);border:1px solid var(--line);border-radius:7px;padding:16px;margin-bottom:12px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted);margin-bottom:12px;font-weight:700">Состав заказа</div>
      ${items.map(i=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 10px;background:var(--panel2);border-radius:8px;margin-bottom:6px;font-size:13px"><span>${crmEsc(i.product_name)} <span style="color:var(--muted)">× ${i.qty}</span></span><b style="color:var(--accent)">${crmFmt(i.price*i.qty)}</b></div>`).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 10px;background:var(--c-surface2,var(--panel2));border:1px solid var(--c-border,var(--line));border-radius:6px;margin-top:4px">
        <b style="font-weight:800">Итого</b><b style="font-size:16px;color:var(--accent)">${crmFmt(o.total)}</b>
      </div>
    </div>

    <div style="background:var(--panel);border:1px solid var(--line);border-radius:7px;padding:16px;margin-bottom:12px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted);margin-bottom:12px;font-weight:700">Статус и заметка</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div>
          <div style="font-size:10px;color:var(--muted);margin-bottom:5px">Статус заявки</div>
          <select id="crmDStatus" class="drawerLabel" style="background:var(--panel2);border:1px solid var(--line2);border-radius:7px;color:var(--text);padding:9px 12px;font:inherit;font-size:13px;outline:none;width:100%" onchange="crmQuickSave()">
            ${Object.entries(CRM_STATUS_LABELS).map(([v,l])=>`<option value="${v}" ${o.status===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div><div style="font-size:10px;color:var(--muted);margin-bottom:5px">Дата</div><div style="font-size:13px;padding-top:2px">${new Date(o.created_at).toLocaleString('ru-RU')}</div></div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:5px">Заметка менеджера</div>
      <textarea id="crmDNote" style="background:var(--panel2);border:1px solid var(--line2);border-radius:7px;color:var(--text);padding:9px 12px;font:inherit;font-size:13px;outline:none;width:100%;resize:vertical;min-height:60px" placeholder="Внутренняя заметка...">${crmEsc(o.manager_note||'')}</textarea>
    </div>

    ${crmRenderCdekBlock(o)}

    <div style="font-size:10px;color:var(--muted);padding:4px 0">Источник: ${crmEsc(o.source||'—')} · #${o.id}</div>
  `;

  document.getElementById('crmDrawerFoot').innerHTML=`
    <button class="btn-primary" onclick="crmSaveOrder()">💾 Сохранить</button>
    <button class="btn-danger btn-sm" onclick="crmDeleteOrder(${o.id})">Удалить</button>
  `;
}

async function crmLoadClientHistory(phone, currentOrderId){
  const el = document.getElementById('crmClientHistory');
  if(!el || !phone) return;
  const fd = new FormData();
  fd.append('action','client_history');
  fd.append('phone', phone);
  const r = await fetch('/admin/api.php', {method:'POST', body:fd, headers:{'X-Requested-With':'XMLHttpRequest'}});
  const d = await r.json();
  if(!d.orders || d.orders.length <= 1) return; // только текущий — не показываем
  const others = d.orders.filter(o => o.id != currentOrderId);
  if(!others.length) return;
  const sColors = {new:'#e8943a', processing:'#3a8ae8', done:'#4caf50', cancelled:'var(--muted)'};
  const sLabels = {new:'Новая', processing:'В работе', done:'Готово', cancelled:'Отмена'};
  el.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:7px;padding:16px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted);margin-bottom:10px;font-weight:700">
        История клиента <span style="background:var(--panel2);color:var(--accent);border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:6px;border:1px solid var(--line2)">${others.length} заказ${others.length>4?'ов':others.length>1?'а':''}</span>
      </div>
      ${others.map(o=>`
        <div onclick="crmOpenOrder(${o.id})" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;cursor:pointer;transition:.15s;margin-bottom:4px" onmouseover="this.style.background='var(--panel2)'" onmouseout="this.style.background=''">
          <div>
            <span style="font-size:12px;font-weight:700;color:var(--muted)">#${o.id}</span>
            <span style="font-size:12px;margin-left:8px">${crmEsc(o.items_short||'—')}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;font-weight:700;color:${sColors[o.status]||'#888'}">${sLabels[o.status]||o.status}</span>
            <b style="font-size:13px;color:var(--accent)">${crmFmt(o.total)}</b>
          </div>
        </div>`).join('')}
    </div>`;
}

function crmCdekStatusLabel(code){
  const map={
    'CREATED':       ['🟡','Создан','#f5a623'],
    'ACCEPTED':      ['🔵','Принят СДЭК','#6ab0ff'],
    'RECEIVED_AT_SHIPMENT_WAREHOUSE':['🔵','На складе отправки','#6ab0ff'],
    'READY_FOR_SHIPMENT_IN_SENDER_CITY':['🔵','Готов к отправке','#6ab0ff'],
    'RETURNED_TO_SENDER_CITY_WAREHOUSE':['🟠','Возврат на склад','#f5a623'],
    'SENT_TO_TRANSIT_CITY':            ['🚚','Отправлен в транзит','#a78bfa'],
    'ACCEPTED_IN_TRANSIT_CITY':        ['🚚','Принят в транзите','#a78bfa'],
    'SENT_TO_RECIPIENT_CITY':          ['🚚','Отправлен получателю','#a78bfa'],
    'ACCEPTED_IN_RECIPIENT_CITY':      ['🚚','В городе получателя','#a78bfa'],
    'ACCEPTED_AT_PICK_UP_POINT':       ['🟢','В пункте выдачи','#7fd882'],
    'READY_FOR_PICKUP':                ['🟢','Готов к выдаче','#7fd882'],
    'DELIVERING':                      ['🚚','Курьер в пути','#a78bfa'],
    'DELIVERED':                       ['✅','Вручён','#7fd882'],
    'NOT_DELIVERED':                   ['❌','Не вручён','#e05252'],
    'INVALID':                         ['⚠️','Некорректный','#e05252'],
  };
  const s = map[code] || ['📦', code||'Создан', '#6ab0ff'];
  return `<span style="font-size:13px;font-weight:700;color:${s[2]}">${s[0]} ${s[1]}</span>`;
}

function crmRenderCdekBlock(o){
  if(o.cdek_order_uuid){
    const lkUrl = o.cdek_track ? `https://lk.cdek.ru/order-history` : 'https://lk.cdek.ru/order-history';
    return `<div style="background:rgba(58,138,232,.06);border:1px solid rgba(58,138,232,.2);border-radius:7px;padding:16px;margin-bottom:12px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:#6ab0ff;margin-bottom:10px;font-weight:700">📦 СДЭК</div>
      ${o.cdek_track?`<div style="font-size:20px;font-weight:900;margin-bottom:6px;letter-spacing:.04em">${crmEsc(o.cdek_track)}</div>`:''}
      <div style="margin-bottom:12px">${crmCdekStatusLabel(o.cdek_status)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-ghost btn-sm" onclick="crmCdekStatus()">↻ Обновить</button>
        <a href="${lkUrl}" target="_blank" class="btn-ghost btn-sm" style="color:#6ab0ff;border-color:rgba(58,138,232,.3);text-decoration:none;display:inline-flex;align-items:center">🔗 ЛК СДЭК</a>
        <button class="btn-ghost btn-sm" style="color:#7fd882;border-color:rgba(76,175,80,.3)" onclick="crmCdekPrint('label')">🖨 Накладная</button>
        <button class="btn-ghost btn-sm" style="color:#a78bfa;border-color:rgba(167,139,250,.3)" onclick="crmCdekPrint('barcode')">▦ Штрихкод</button>
        <button class="btn-ghost btn-sm" style="color:#f5a623;border-color:rgba(245,166,35,.3)" onclick="crmCdekReset()">↺ Сбросить</button>
        <button class="btn-danger btn-sm" onclick="crmCdekCancel()">✕ Отменить</button>
      </div>
    </div>`;
  }
  return `<div style="background:rgba(58,138,232,.06);border:1px solid rgba(58,138,232,.2);border-radius:7px;padding:16px;margin-bottom:12px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:#6ab0ff;margin-bottom:12px;font-weight:700">📦 СДЭК — Создать заказ</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
      <div>
        <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Тип</div>
        <select id="cdekTariff" style="background:var(--c-surface2,var(--panel2));border:1px solid var(--c-border,var(--line));border-radius:6px;color:var(--text);padding:7px 10px;font:inherit;font-size:12px;outline:none;width:100%">
          <option value="136">До ПВЗ</option><option value="137">Курьер</option>
        </select>
      </div>
      <div><div style="font-size:10px;color:var(--muted);margin-bottom:4px">Код ПВЗ</div><input id="cdekPvzCode" style="background:var(--c-surface2,var(--panel2));border:1px solid var(--c-border,var(--line));border-radius:6px;color:var(--text);padding:7px 10px;font:inherit;font-size:12px;outline:none;width:100%" placeholder="OMS201" value="${crmEsc(o.cdek_pvz_code || crmParsePvzCode(o.address||''))}"></div>
      <div><div style="font-size:10px;color:var(--muted);margin-bottom:4px">Код города</div><input id="cdekCityCode" type="number" style="background:var(--c-surface2,var(--panel2));border:1px solid var(--c-border,var(--line));border-radius:6px;color:var(--text);padding:7px 10px;font:inherit;font-size:12px;outline:none;width:100%" placeholder="270"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      <div><div style="font-size:10px;color:var(--muted);margin-bottom:4px">Вес (г)</div><input id="cdekWeight" type="number" value="12000" style="background:var(--c-surface2,var(--panel2));border:1px solid var(--c-border,var(--line));border-radius:6px;color:var(--text);padding:7px 10px;font:inherit;font-size:12px;outline:none;width:100%"></div>
      <div><div style="font-size:10px;color:var(--muted);margin-bottom:4px">Длина (см)</div><input id="cdekLength" type="number" value="60" style="background:var(--c-surface2,var(--panel2));border:1px solid var(--c-border,var(--line));border-radius:6px;color:var(--text);padding:7px 10px;font:inherit;font-size:12px;outline:none;width:100%"></div>
      <div><div style="font-size:10px;color:var(--muted);margin-bottom:4px">Ширина (см)</div><input id="cdekWidth" type="number" value="60" style="background:var(--c-surface2,var(--panel2));border:1px solid var(--c-border,var(--line));border-radius:6px;color:var(--text);padding:7px 10px;font:inherit;font-size:12px;outline:none;width:100%"></div>
    </div>
    <button class="btn-ghost" id="cdekCreateBtn" onclick="crmCdekCreate()" style="color:#6ab0ff;border-color:rgba(58,138,232,.4)">📦 Создать в СДЭК</button>
    <p style="font-size:10px;color:var(--muted);margin-top:6px">Москва=270, СПб=1, Тольятти=431</p>
  </div>`;
}

async function deleteCall(id){
  if(!confirm('Удалить запись о звонке?')) return;
  const fd=new FormData(); fd.append('action','delete_call'); fd.append('id',id);
  const r=await fetch('/novofon.php',{method:'POST',body:fd});
  const d=await r.json();
  if(d.ok){ document.getElementById('call-row-'+id)?.remove(); toast('Удалено'); }
  else toast('Ошибка','err');
}
async function crmCall(phone, orderId){
  if(!confirm('Позвонить ' + phone + '?\n\nНовофон сначала позвонит вам, затем соединит с клиентом.')) return;
  const fd = new FormData();
  fd.append('action','call');
  fd.append('phone', phone);
  fd.append('order_id', orderId||0);
  const r = await fetch('/novofon.php', {method:'POST', body:fd});
  const d = await r.json();
  if(d.ok) toast('📞 ' + (d.message||'Звонок инициирован'));
  else toast(d.error||'Ошибка звонка','err');
}
function crmParsePvzCode(address){
  const m = String(address||'').match(/ПВЗ\s+([A-Z0-9\-]+)\s*:/);
  return m ? m[1] : '';
}
function crmGetCityCode(city){
  const CDEK={"Абакан":823,"Архангельск":402,"Астрахань":432,"Барнаул":274,"Белгород":337,"Брянск":220,"Владивосток":288,"Владикавказ":1082,"Владимир":94,"Волгоград":426,"Вологда":246,"Воронеж":506,"Екатеринбург":250,"Иваново":164,"Ижевск":224,"Иркутск":281,"Казань":424,"Калининград":152,"Калуга":142,"Кемерово":272,"Киров":415,"Краснодар":435,"Красноярск":278,"Москва":44,"Нижний Новгород":414,"Новосибирск":270,"Омск":268,"Пермь":248,"Ростов-на-Дону":438,"Самара":430,"Санкт-Петербург":137,"Саратов":428,"Тольятти":431,"Тюмень":252,"Уфа":256,"Хабаровск":287,"Челябинск":259};
  if(!city) return '';
  const c = city.trim();
  if(CDEK[c]) return CDEK[c];
  for(const[k,v] of Object.entries(CDEK)){ if(c.toLowerCase().includes(k.toLowerCase())) return v; }
  return '';
}

function crmEsc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function crmFmt(n){return new Intl.NumberFormat('ru-RU').format(Number(n||0))+' ₽';}

async function crmQuickSave(){ await crmSaveOrder(true); }
async function crmSaveOrder(silent=false){
  const fd=new FormData();
  fd.append('action','update_order');fd.append('id',crmCurrentOrderId);
  fd.append('status',document.getElementById('crmDStatus').value);
  fd.append('manager_note',document.getElementById('crmDNote').value);
  const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});
  const d=await r.json();
  if(d.ok){
    if(!silent) toast('Заявка сохранена');
    // Обновляем карточку в канбане
    const card=document.querySelector(`.crm-card[data-id="${crmCurrentOrderId}"]`);
    const newStatus=document.getElementById('crmDStatus').value;
    if(card&&card.dataset.status!==newStatus){
      const old=card.dataset.status;
      const newCol=document.getElementById('crmCol-'+newStatus);
      if(newCol){newCol.appendChild(card);card.dataset.status=newStatus;crmUpdateCount(old);crmUpdateCount(newStatus);}
    }
  } else toast('Ошибка','err');
}

async function crmDeleteOrder(id){
  if(!confirm('Удалить заявку #'+id+'?')) return;
  const fd=new FormData();fd.append('action','delete_order');fd.append('id',id);
  const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});
  const d=await r.json();
  if(d.ok){
    toast('Удалено');crmCloseDrawer();
    document.querySelector(`.crm-card[data-id="${id}"]`)?.remove();
    document.querySelector(`.crm-list-row[data-id="${id}"]`)?.remove();
  } else toast('Ошибка','err');
}

// СДЭК
async function crmCdekCreate(){
  const btn=document.getElementById('cdekCreateBtn');
  btn.disabled=true;btn.textContent='Создаём...';
  const fd=new FormData();
  fd.append('action','create');fd.append('order_id',crmCurrentOrderId);
  fd.append('tariff',document.getElementById('cdekTariff').value);
  fd.append('pvz_code',document.getElementById('cdekPvzCode').value);
  fd.append('city_code',document.getElementById('cdekCityCode').value);
  fd.append('weight',document.getElementById('cdekWeight').value);
  fd.append('length',document.getElementById('cdekLength').value);
  fd.append('width',document.getElementById('cdekWidth').value);
  fd.append('height','40');
  const r=await fetch('/admin/cdek_order.php',{method:'POST',body:fd});
  const d=await r.json();
  if(d.ok){toast('✓ Заказ создан в СДЭК');await crmLoadOrder(crmCurrentOrderId);}
  else{toast(d.error||'Ошибка СДЭК','err');btn.disabled=false;btn.textContent='📦 Создать в СДЭК';}
}
async function crmCdekStatus(){
  const fd=new FormData();fd.append('action','status');fd.append('order_id',crmCurrentOrderId);
  const r=await fetch('/admin/cdek_order.php',{method:'POST',body:fd});
  const d=await r.json();
  if(d.ok){toast(d.track?'🚚 '+d.track+' · '+d.status:'✓ '+d.status);await crmLoadOrder(crmCurrentOrderId);}
  else toast(d.error||'Ошибка','err');
}
async function crmCdekPrint(type){
  const labels={'label':'Накладная','barcode':'Штрихкод'};
  toast('⏳ Готовим '+labels[type]+'...');
  const fd=new FormData();fd.append('action',type);fd.append('order_id',crmCurrentOrderId);
  const r=await fetch('/admin/cdek_order.php',{method:'POST',body:fd});
  const d=await r.json();
  if(d.ok&&d.url){window.open(d.url,'_blank');toast('✓ '+labels[type]+' открыта');}
  else if(d.cdek_url){if(confirm('PDF ещё не готов. Открыть личный кабинет СДЭК?')){window.open(d.cdek_url,'_blank');}}
  else toast(d.error||'Ошибка','err');
}
async function crmCdekReset(){
  if(!confirm('Сбросить статус СДЭК? Это позволит создать новый заказ.')) return;
  const fd=new FormData();fd.append('action','reset');fd.append('order_id',crmCurrentOrderId);
  const r=await fetch('/admin/cdek_order.php',{method:'POST',body:fd});
  const d=await r.json();
  if(d.ok){toast('↺ СДЭК сброшен');await crmLoadOrder(crmCurrentOrderId);}
  else toast(d.error||'Ошибка','err');
}
async function crmCdekCancel(){
  if(!confirm('Отменить заказ в СДЭК?')) return;
  const fd=new FormData();fd.append('action','cancel');fd.append('order_id',crmCurrentOrderId);
  const r=await fetch('/admin/cdek_order.php',{method:'POST',body:fd});
  const d=await r.json();
  if(d.ok){toast('Заказ отменён в СДЭК');await crmLoadOrder(crmCurrentOrderId);}
  else toast(d.error||'Ошибка','err');
}
document.addEventListener('keydown',e=>{if(e.key==='Escape') crmCloseDrawer();});

async function toggleCat(id, btn) {
  const fd = new FormData();
  fd.append('action','toggle_category');
  fd.append('id', id);
  const r = await fetch(API, {method:'POST', body:fd, headers:AJAX_HEADERS});
  const d = await r.json();
  if(d.ok !== undefined || d.is_active !== undefined) {
    const active = d.is_active === 1;
    btn.className = 'badge ' + (active ? 'badge-active' : 'badge-hidden');
    btn.textContent = active ? 'Активна' : 'Скрыта';
    // Обновляем строку визуально
    const row = btn.closest('.navItemRow');
    row.style.opacity = active ? '1' : '0.5';
    toast(active ? 'Категория показана' : 'Категория скрыта');
  }
}

async function approveReview(id, btn){
  const d = await apiFetch('approve_review', {id});
  if(d.ok){ toast('Отзыв опубликован'); btn.closest('.reviewCard').querySelector('.pendingBadge')?.remove(); btn.remove(); }
  else toast('Ошибка','err');
}
async function deleteReview(id, btn){
  if(!confirm('Удалить отзыв?')) return;
  const d = await apiFetch('delete_review', {id});
  if(d.ok){ toast('Отзыв удалён'); btn.closest('.reviewCard').remove(); }
  else toast('Ошибка','err');
}
// ══ END CRM JS ══

// ── THEME SWITCHER ──────────────────────────────────────────────────────
function setAdminTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('adminTheme', theme);
  updateThemeCards(theme);
}
function updateThemeCards(theme) {
  ['light','dark'].forEach(t => {
    const el = document.getElementById('themeCard' + t.charAt(0).toUpperCase() + t.slice(1));
    if(el) el.classList.toggle('active', t === theme);
  });
}
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('adminTheme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeCards(saved);
});
// ── END THEME SWITCHER ──

// ── НОВОФОН: polling входящих звонков ────────────────────────────────────
(function(){
  const wrap = document.createElement('div');
  wrap.id = 'callNotifications';
  wrap.style.cssText = 'position:fixed;top:80px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none';
  document.body.appendChild(wrap);

  function showCallBanner(call){
    const banner = document.createElement('div');
    const isKnown = call.caller_name && call.caller_name !== '';
    banner.style.cssText = 'background:#1a1a1a;border:1px solid rgba(76,175,80,.4);border-left:4px solid #7fd882;border-radius:7px;padding:16px 20px;min-width:300px;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.6);pointer-events:auto;cursor:pointer';
    banner.innerHTML = `<div style="display:flex;align-items:flex-start;gap:12px">
      <span style="font-size:28px;line-height:1;animation:ringAnim 0.5s ease infinite alternate">📞</span>
      <div style="flex:1">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7fd882;font-weight:700;margin-bottom:4px">Входящий звонок</div>
        <div style="font-size:16px;font-weight:800;margin-bottom:2px">${isKnown ? call.caller_name : 'Неизвестный клиент'}</div>
        <div style="font-size:13px;color:var(--accent);font-weight:700">${call.caller}</div>
        ${call.order_id ? `<div style="font-size:12px;color:var(--muted);margin-top:4px">Заказ #${call.order_id} · ${new Intl.NumberFormat('ru-RU').format(call.order_total)} ₽</div>` : '<div style="font-size:12px;color:var(--muted);margin-top:4px">Новый клиент — не в базе</div>'}
      </div>
      <button class="callBannerClose" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;padding:0;line-height:1">×</button>
    </div>`;
    banner.querySelector('.callBannerClose').addEventListener('click', e=>{ e.stopPropagation(); banner.remove(); });
    if(call.order_id){
      banner.addEventListener('click', ()=>{ crmOpenOrder(call.order_id); document.querySelector('[data-tab=orders]')?.click(); banner.remove(); });
    }
    wrap.appendChild(banner);
    // Звук
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      [880,1100,880,1100].forEach((f,i)=>{ const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g);g.connect(ctx.destination); o.frequency.value=f; g.gain.setValueAtTime(0.2,ctx.currentTime+i*0.18); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.18+0.15); o.start(ctx.currentTime+i*0.18); o.stop(ctx.currentTime+i*0.18+0.15); });
    } catch(e){}
    setTimeout(()=>banner.remove(), 30000);
  }

  function addCallRow(call){
    const tbody = document.querySelector('#tab-calls tbody');
    if(!tbody) return;
    const empty = document.querySelector('#tab-calls .callsEmpty');
    if(empty) empty.remove();
    if(document.getElementById('call-row-'+call.id)) return;
    const isKnown = call.caller_name && call.caller_name !== '';
    const dt = new Date(call.created_at.replace(' ','T'));
    const dateStr = dt.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',','');
    const dur = parseInt(call.duration)||0;
    const durStr = dur > 0 ? (Math.floor(dur/60)>0 ? Math.floor(dur/60)+'м '+(dur%60)+'с' : dur+'с') : '<span style="opacity:.3">—</span>';
    const dirBadge = call.status === 'missed'
      ? '<span style="background:rgba(220,50,50,.12);color:#ff7070;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700">Пропущен</span>'
      : '<span style="background:rgba(76,175,80,.12);color:#7fd882;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700">Входящий</span>';
    const tr = document.createElement('tr');
    tr.id = 'call-row-'+call.id;
    tr.style.borderBottom = '1px solid var(--table-border)';
    tr.innerHTML = `
      <td style="padding:12px 16px;font-size:18px">📞</td>
      <td style="padding:12px 16px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:700;color:var(--accent)">${call.caller}</span>
          <button onclick="crmCall('${call.caller}',0)" title="Позвонить" style="background:var(--badge-in-bg);border:1px solid rgba(76,175,80,.25);color:var(--badge-in-color);border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">📞 Позвонить</button>
        </div>
      </td>
      <td style="padding:12px 16px">${isKnown ? `<span style="font-weight:600">${call.caller_name}</span>` : '<span style="color:var(--muted);font-size:13px">Неизвестный</span>'}</td>
      <td style="padding:12px 16px">${call.order_id ? `<a href="#" onclick="crmOpenOrder(${call.order_id});document.querySelector('[data-tab=orders]').click();return false" style="color:#6ab0ff;font-weight:700;text-decoration:none">#${call.order_id}</a>` : '<span style="color:var(--muted);font-size:13px">—</span>'}</td>
      <td style="padding:12px 16px">${dirBadge}</td>
      <td style="padding:12px 16px;color:var(--muted);font-size:13px">${durStr}</td>
      <td style="padding:12px 16px;color:var(--muted);font-size:13px">${dateStr}</td>
      <td style="padding:12px 16px"><button onclick="deleteCall(${call.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;opacity:.5" title="Удалить">×</button></td>`;
    tbody.insertBefore(tr, tbody.firstChild);
    updateCallStats();
  }

  function updateCallStats(){
    const rows = document.querySelectorAll('#tab-calls tbody tr');
    const total = rows.length;
    const today = new Date().toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
    let todayCount = 0, inCount = 0, outCount = 0;
    rows.forEach(r=>{
      const fullDate = r.cells[6]?.textContent||'';
      const todayDMY = new Date().toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
      if(fullDate.startsWith(todayDMY)) todayCount++;
      const dir = r.cells[4]?.textContent?.trim()||'';
      if(dir.includes('Входящий')) inCount++;
      else outCount++;
    });
    const stats = document.querySelectorAll('#tab-calls .statCard b');
    if(stats[0]) stats[0].textContent = total;
    if(stats[1]) stats[1].textContent = todayCount;
    if(stats[2]) stats[2].textContent = inCount+' / '+outCount;
    // Обновляем бейдж в сайдбаре
    // Обновляем бейдж в сайдбаре
    const sideLink = document.querySelector('[data-tab="calls"]');
    if(sideLink) {
      let badge = sideLink.querySelector('span');
      if(!badge){ badge = document.createElement('span'); badge.style.cssText='border-radius:999px;padding:1px 7px;font-size:10px;font-weight:900;margin-left:auto'; sideLink.appendChild(badge); }
      // Считаем пропущенные из DOM
      let missedCount = 0;
      document.querySelectorAll('#tab-calls tbody tr').forEach(r=>{
        if(r.cells[4]?.textContent?.includes('Пропущен')) missedCount++;
      });
      if(missedCount > 0){
        badge.style.background='rgba(220,50,50,.2)'; badge.style.color='#e05050';
        badge.textContent = missedCount+' пропущ.';
      } else if(todayCount > 0){
        badge.style.background='rgba(76,175,80,.2)'; badge.style.color='#7fd882';
        badge.textContent = todayCount;
      } else {
        badge.remove();
      }
    }
  }

  async function pollCalls(){
    try {
      const r = await fetch('/novofon.php?action=pending');
      const calls = await r.json();
      if(Array.isArray(calls) && calls.length > 0){
        calls.forEach(call=>{
          showCallBanner(call);
          addCallRow(call);
        });
      }
    } catch(e){}
  }

  // Polling звонков — всегда активен
  setInterval(pollCalls, 8000);
  setTimeout(pollCalls, 1500);
})();

// ── Polling новых заказов ─────────────────────────────────────────────
(function(){
  // Берём максимальный id из PHP — самый надёжный способ
  let lastOrderId = <?=!empty($orders) ? max(array_column($orders,'id')) : 0?>;

  function makeOrderCard(o){
    const items = o.items_str||'—';
    const dt = new Date(o.created_at);
    const ago = 'только что';
    const price = new Intl.NumberFormat('ru-RU').format(o.total||0)+' ₽';
    return `<div class="crm-card" data-id="${o.id}" data-status="${o.status}" data-search="${(o.customer_name+' '+o.phone+' '+items).toLowerCase()}" draggable="true" onclick="crmOpenOrder(${o.id})" style="background:var(--panel2);border:1px solid var(--c-accent,var(--accent));border-radius:7px;padding:12px;cursor:pointer;transition:.15s;animation:fadeInCard .3s ease">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:10px;font-weight:700;color:var(--muted)">#${o.id}</span>
        <span style="font-size:10px;background:rgba(79,127,255,.12);color:var(--accent);border-radius:3px;padding:1px 6px;font-weight:600">Новая</span>
      </div>
      <div style="font-size:13px;font-weight:600;margin-bottom:3px">${o.customer_name||'—'}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px">${o.phone||''}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${items}</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b style="font-size:13px;font-weight:700;color:var(--accent)">${price}</b>
        <span style="font-size:10px;color:var(--muted)">${ago}</span>
      </div>
    </div>`;
  }

  async function pollOrders(){
    try {
      const fd = new FormData();
      fd.append('action','pending_orders');
      fd.append('last_id', lastOrderId);
      const r = await fetch('/admin/index.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});
      const d = await r.json();
      if(!d.orders||!d.orders.length) return;
      d.orders.forEach(o=>{
        if(parseInt(o.id) > lastOrderId) lastOrderId = parseInt(o.id);
        // Добавляем в канбан если нет
        if(!document.querySelector(`.crm-card[data-id="${o.id}"]`)){
          const col = document.getElementById('crmCol-new');
          if(col){ col.insertAdjacentHTML('afterbegin', makeOrderCard(o)); }
          // Обновляем счётчик колонки
          const cnt = document.getElementById('crmCount-new');
          if(cnt) cnt.textContent = parseInt(cnt.textContent||0)+1;
          // Обновляем статкарточку
          const statNew = document.querySelector('.crmStatsRow .statCard:nth-child(2) b');
          if(statNew) statNew.textContent = parseInt(statNew.textContent||0)+1;
          const statAll = document.querySelector('.crmStatsRow .statCard:first-child b');
          if(statAll) statAll.textContent = parseInt(statAll.textContent||0)+1;
          // Обновляем бейдж в сайдбаре
          const sideOrders = document.querySelector('[data-tab="orders"] .navBadge');
          if(sideOrders) sideOrders.textContent = parseInt(sideOrders.textContent||0)+1;
          // Toast
          toast('Новая заявка #'+o.id+' — '+o.customer_name);
        }
      });
    } catch(e){}
  }

  setInterval(pollOrders, 10000);
  setTimeout(pollOrders, 3000);
})();

/* ══════════════════════════════════════════
   PAGE EDITOR ENGINE
══════════════════════════════════════════ */
(function(){
  if (!window.PE_PAGE_ID) return; // only init on page edit view

  // ── State ──
  var peSections = JSON.parse(JSON.stringify(window.PE_SECTIONS || []));
  var peSelectedId = null;
  var peHistory = [JSON.parse(JSON.stringify(peSections))];
  var peHistoryIdx = 0;
  var peAutosaveTs = null;
  var peAutosaveTimer = null;

  // ── Type meta ──
  var PE_TYPES = {
    hero_simple:    { label: 'Заголовок',   group: 'Герой',    icon: 'H' },
    text:           { label: 'Текст',        group: 'Текст',    icon: 'T' },
    text_image:     { label: 'Текст + фото', group: 'Текст',    icon: 'TI' },
    quote:          { label: 'Цитата',       group: 'Текст',    icon: '"' },
    cards:          { label: 'Карточки',     group: 'Текст',    icon: '▦' },
    products_grid:  { label: 'Товары',       group: 'Каталог',  icon: '⊞' },
    lead_form:      { label: 'Форма',        group: 'Форма',    icon: '✉' },
    contacts_block: { label: 'Контакты',     group: 'Инфо',     icon: '@' },
  };

  var PE_GROUPS = ['Герой','Текст','Каталог','Форма','Инфо'];

  // ── Helpers ──
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function byId(id){ return document.getElementById(id); }

  function peSection(id){
    return peSections.find(function(s){ return s.id == id; });
  }

  function peShowAutosave(msg){
    var el = byId('peAutosave');
    if(!el) return;
    peAutosaveTs = Date.now();
    el.textContent = msg || 'Сохранено только что';
    el.className = 'pe-autosave pe-saved';
    clearTimeout(peAutosaveTimer);
    peAutosaveTimer = setTimeout(function(){ peTickAutosave(); }, 60000);
  }

  function peTickAutosave(){
    var el = byId('peAutosave');
    if(!el || !peAutosaveTs) return;
    var mins = Math.floor((Date.now()-peAutosaveTs)/60000);
    if(mins < 1){ el.textContent = 'Сохранено только что'; }
    else { el.textContent = 'Сохранено ' + mins + ' мин назад'; el.className = 'pe-autosave'; }
    peAutosaveTimer = setTimeout(peTickAutosave, 30000);
  }

  // ── History ──
  function pePushHistory(){
    peHistory = peHistory.slice(0, peHistoryIdx+1);
    peHistory.push(JSON.parse(JSON.stringify(peSections)));
    if(peHistory.length > 31) peHistory.shift();
    peHistoryIdx = peHistory.length-1;
    peUpdateUndoRedo();
  }

  function peUpdateUndoRedo(){
    var u = byId('peUndo'), r = byId('peRedo');
    if(u) u.disabled = peHistoryIdx <= 0;
    if(r) r.disabled = peHistoryIdx >= peHistory.length-1;
  }

  function peUndo(){
    if(peHistoryIdx <= 0) return;
    peHistoryIdx--;
    peSections = JSON.parse(JSON.stringify(peHistory[peHistoryIdx]));
    peRender(); peUpdateUndoRedo();
  }

  function peRedo(){
    if(peHistoryIdx >= peHistory.length-1) return;
    peHistoryIdx++;
    peSections = JSON.parse(JSON.stringify(peHistory[peHistoryIdx]));
    peRender(); peUpdateUndoRedo();
  }

  // ── Render left panel ──
  function peRenderLeft(){
    var list = byId('peSectionList');
    if(!list) return;
    list.innerHTML = '';
    peSections.forEach(function(s){
      var meta = PE_TYPES[s.type] || {label: s.type, icon: '?'};
      var hidden = s.is_active == 0 || s.is_active === false || s.is_active === '0';
      var card = document.createElement('div');
      card.className = 'pe-scard' + (s.id == peSelectedId ? ' active' : '') + (hidden ? ' hidden-block' : '');
      card.dataset.id = s.id;
      card.draggable = true;
      card.innerHTML =
        '<span class="pe-drag-handle" title="Перетащить">&#8942;</span>' +
        '<span class="pe-scard-icon">' + esc(meta.icon) + '</span>' +
        '<span class="pe-scard-info">' +
          '<span class="pe-scard-type">' + esc(meta.label) + '</span>' +
          '<span class="pe-scard-name">' + esc(s.title || '—') + '</span>' +
        '</span>' +
        '<span class="pe-scard-actions">' +
          '<button class="pe-scard-btn" data-act="vis" title="' + (hidden?'Показать':'Скрыть') + '">' +
            (hidden ?
              '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M5.5 5.6A2 2 0 0 0 7.4 7.5M2 3.5C3.2 2.4 4.7 1.8 6.5 1.8c2.7 0 4.8 1.7 6 4.2-.5 1-1.3 1.9-2.2 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M4 10.2C4.8 10.7 5.6 11 6.5 11c2.7 0 4.8-1.7 6-4.2-.3-.6-.7-1.2-1.2-1.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' :
              '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><ellipse cx="6.5" cy="6.5" rx="2" ry="2" stroke="currentColor" stroke-width="1.3"/><path d="M.5 6.5C1.7 4 3.8 2.3 6.5 2.3S11.3 4 12.5 6.5C11.3 9 9.2 10.7 6.5 10.7S1.7 9 .5 6.5z" stroke="currentColor" stroke-width="1.3"/></svg>'
            ) +
          '</button>' +
          '<button class="pe-scard-btn" data-act="dup" title="Дублировать">' +
            '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M9 4V2.5A1.5 1.5 0 0 0 7.5 1H2.5A1.5 1.5 0 0 0 1 2.5v5A1.5 1.5 0 0 0 2.5 9H4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' +
          '</button>' +
          '<button class="pe-scard-btn danger" data-act="del" title="Удалить">' +
            '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
          '</button>' +
        '</span>';

      card.addEventListener('click', function(e){
        var act = e.target.closest('[data-act]');
        if(act){
          e.stopPropagation();
          var a = act.dataset.act;
          if(a==='del') peDeleteSection(s.id);
          else if(a==='vis') peToggleSectionVisibility(s.id);
          else if(a==='dup') peDuplicateSection(s.id);
        } else {
          peSelectBlock(s.id);
        }
      });

      // Drag-and-drop
      card.addEventListener('dragstart', function(e){
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', String(s.id));
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function(){
        card.classList.remove('dragging');
        list.querySelectorAll('.pe-scard').forEach(function(c){ c.classList.remove('drag-over'); });
      });
      card.addEventListener('dragover', function(e){
        e.preventDefault();
        list.querySelectorAll('.pe-scard').forEach(function(c){ c.classList.remove('drag-over'); });
        card.classList.add('drag-over');
      });
      card.addEventListener('drop', function(e){
        e.preventDefault();
        card.classList.remove('drag-over');
        var fromId = parseInt(e.dataTransfer.getData('text/plain'));
        var toId = s.id;
        if(fromId === toId) return;
        var fromIdx = peSections.findIndex(function(x){ return x.id == fromId; });
        var toIdx   = peSections.findIndex(function(x){ return x.id == toId; });
        if(fromIdx < 0 || toIdx < 0) return;
        var moved = peSections.splice(fromIdx, 1)[0];
        peSections.splice(toIdx, 0, moved);
        pePushHistory();
        peRender();
        peSaveSortOrder();
      });

      list.appendChild(card);
    });
  }

  // ── Render center preview ──
  function pePreviewHTML(s){
    var type = s.type;
    var title = esc(s.title || '');
    var body = '';
    if(type === 'hero_simple'){
      body = '<div class="pe-sk-eyebrow"></div>' +
             '<div class="pe-sk-h1 w80"></div>' +
             '<div class="pe-sk-h1 w60"></div>' +
             '<div class="pe-sk-line w75"></div>' +
             '<div class="pe-sk-btn"></div>';
    } else if(type === 'text'){
      body = title ? '<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:6px;opacity:.7">'+title+'</div>' : '';
      body += '<div class="pe-sk-line w100"></div><div class="pe-sk-line w75"></div><div class="pe-sk-line w50"></div>';
    } else if(type === 'text_image'){
      body = '<div class="pe-sk-textimg">' +
               '<div><div class="pe-sk-h1 w80"></div><div class="pe-sk-line w100"></div><div class="pe-sk-line w75"></div></div>' +
               '<div class="pe-sk-img" style="height:70px"></div>' +
             '</div>';
    } else if(type === 'cards'){
      body = title ? '<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:8px;opacity:.7">'+title+'</div>' : '';
      body += '<div class="pe-sk-cards"><div class="pe-sk-card-item"></div><div class="pe-sk-card-item"></div><div class="pe-sk-card-item"></div></div>';
    } else if(type === 'quote'){
      body = '<div class="pe-sk-quote-mark">"</div>' +
             '<div class="pe-sk-line w100"></div><div class="pe-sk-line w75"></div>' +
             '<div style="margin-top:8px"><div class="pe-sk-line w50"></div></div>';
    } else if(type === 'contacts_block'){
      body = title ? '<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:8px;opacity:.7">'+title+'</div>' : '';
      body += '<div class="pe-sk-contacts">' +
                '<div class="pe-sk-contact-row"><div class="pe-sk-contact-icon"></div><div class="pe-sk-line w75" style="margin:0;flex:1"></div></div>' +
                '<div class="pe-sk-contact-row"><div class="pe-sk-contact-icon"></div><div class="pe-sk-line w50" style="margin:0;flex:1"></div></div>' +
                '<div class="pe-sk-contact-row"><div class="pe-sk-contact-icon"></div><div class="pe-sk-line w75" style="margin:0;flex:1"></div></div>' +
              '</div>';
    } else if(type === 'lead_form'){
      body = title ? '<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:8px;opacity:.7">'+title+'</div>' : '';
      body += '<div class="pe-sk-form"><div class="pe-sk-form-field"></div><div class="pe-sk-form-field"></div><div class="pe-sk-btn" style="width:100%"></div></div>';
    } else if(type === 'products_grid'){
      body = title ? '<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:8px;opacity:.7">'+title+'</div>' : '';
      body += '<div class="pe-sk-grid"><div class="pe-sk-product"></div><div class="pe-sk-product"></div><div class="pe-sk-product"></div></div>';
    } else {
      body = '<div class="pe-sk-line w100"></div><div class="pe-sk-line w75"></div>';
    }
    return body;
  }

  function peRenderCenter(){
    var list = byId('pePreviewList');
    var empty = byId('pePreviewEmpty');
    if(!list) return;
    if(peSections.length === 0){
      list.innerHTML = '';
      if(empty){ empty.style.display='flex'; list.style.display='none'; }
      return;
    }
    if(empty){ empty.style.display='none'; list.style.display='flex'; }
    list.innerHTML = '';
    peSections.forEach(function(s){
      var meta = PE_TYPES[s.type] || {label: s.type};
      var hidden = s.is_active == 0 || s.is_active === false || s.is_active === '0';
      var card = document.createElement('div');
      card.className = 'pe-preview-card' + (s.id == peSelectedId ? ' active' : '') + (hidden ? ' hidden-block' : '');
      card.dataset.id = s.id;
      card.innerHTML =
        '<div class="pe-preview-header">' +
          '<div class="pe-preview-type-dot"></div>' +
          '<span>' + esc(meta.label) + '</span>' +
          (s.title ? '<span style="color:var(--text);font-weight:500">— ' + esc(s.title) + '</span>' : '') +
          (hidden ? '<span style="margin-left:auto;font-size:10px;opacity:.5">скрыт</span>' : '') +
        '</div>' +
        '<div class="pe-preview-body">' + pePreviewHTML(s) + '</div>';
      card.addEventListener('click', function(){ peSelectBlock(s.id); });
      list.appendChild(card);
    });
  }

  function peRender(){
    peRenderLeft();
    peRenderCenter();
    peRenderRightIfNeeded();
  }

  // ── Select / deselect block ──
  function peSelectBlock(id){
    peSelectedId = id;
    peRender();
    var s = peSection(id);
    if(!s) return;
    var empty = byId('peRightEmpty');
    var panel = byId('peRightPanel');
    if(empty) empty.style.display = 'none';
    if(panel) panel.style.display = 'flex';
    var titleEl = byId('peRightTitle');
    if(titleEl) titleEl.textContent = s.title || '—';
    var typeSelect = byId('peRightTypeSelect');
    if(typeSelect) typeSelect.value = s.type || 'text';
    var fields = byId('peRightFields');
    if(fields) fields.innerHTML = peFieldsHTML(s);
    peUpdateVisibilityBtn(s);
    // scroll selected into view in left panel
    var scard = document.querySelector('.pe-scard[data-id="'+id+'"]');
    if(scard) scard.scrollIntoView({block:'nearest'});
    var pcard = document.querySelector('.pe-preview-card[data-id="'+id+'"]');
    if(pcard) pcard.scrollIntoView({behavior:'smooth', block:'nearest'});
  }

  window.peDeselectBlock = function(){
    peSelectedId = null;
    var empty = byId('peRightEmpty');
    var panel = byId('peRightPanel');
    if(empty) empty.style.display = 'flex';
    if(panel) panel.style.display = 'none';
    peRender();
  };

  window.peChangeBlockType = function(newType){
    if(!peSelectedId) return;
    var s = peSection(peSelectedId);
    if(!s) return;
    s.type = newType;
    // reset extra so repeaters start fresh
    s.extra = '';
    var fields = byId('peRightFields');
    if(fields) fields.innerHTML = peFieldsHTML(s);
    peRenderLeft();
    peRenderCenter();
  };

  function peRenderRightIfNeeded(){
    if(!peSelectedId) return;
    var s = peSection(peSelectedId);
    if(!s){ peDeselectBlock(); return; }
    // re-update badge/title
    var meta = PE_TYPES[s.type] || {label: s.type};
    var badge = byId('peRightTypeBadge');
    var titleEl = byId('peRightTitle');
    if(badge) badge.textContent = meta.label;
    if(titleEl) titleEl.textContent = s.title || '—';
    peUpdateVisibilityBtn(s);
  }

  function peUpdateVisibilityBtn(s){
    var btn = byId('peVisibilityBtn');
    if(!btn) return;
    var hidden = s.is_active == 0 || s.is_active === false || s.is_active === '0';
    btn.textContent = hidden ? 'Показать' : 'Скрыть';
  }

  // ── Field HTML per block type ──
  function peFieldsHTML(s){
    var type = s.type;
    var extra = s.extra || '';
    var html = '<input type="hidden" id="pefSectionId" value="'+esc(s.id)+'">' +
               '<input type="hidden" id="pefType" value="'+esc(type)+'">';

    function field(id, label, val, req){
      return '<label class="pe-field-label'+(req?' pe-field-required':'')+'">' +
               label +
               '<input class="pe-input" id="'+id+'" value="'+esc(val || '')+'">' +
             '</label>';
    }
    function textarea(id, label, val){
      return '<label class="pe-field-label">' + label +
               '<textarea class="pe-input pe-textarea" id="'+id+'">'+esc(val || '')+'</textarea>' +
             '</label>';
    }
    function sortOrder(val){
      return field('pefSortOrder','Порядок (число)', val || 0, false);
    }

    if(type === 'hero_simple'){
      html += field('pefEyebrow','Надзаголовок', s.eyebrow || peExtraField(extra,'eyebrow')) +
              field('pefTitle','Заголовок *', s.title, true) +
              textarea('pefText','Текст', s.text || peExtraField(extra,'text')) +
              field('pefCtaText','Кнопка (текст)', peExtraField(extra,'cta_text')) +
              field('pefCtaLink','Кнопка (ссылка)', peExtraField(extra,'cta_link')) +
              sortOrder(s.sort_order);
    } else if(type === 'text'){
      html += field('pefEyebrow','Надзаголовок', peExtraField(extra,'eyebrow')) +
              field('pefTitle','Заголовок', s.title) +
              textarea('pefText','Текст', s.text || peExtraField(extra,'text')) +
              field('pefCtaText','Кнопка (текст)', peExtraField(extra,'cta_text')) +
              field('pefCtaLink','Кнопка (ссылка)', peExtraField(extra,'cta_link')) +
              sortOrder(s.sort_order);
    } else if(type === 'text_image'){
      html += field('pefEyebrow','Надзаголовок', peExtraField(extra,'eyebrow')) +
              field('pefTitle','Заголовок', s.title) +
              textarea('pefText','Текст', s.text || peExtraField(extra,'text')) +
              field('pefImageUrl','URL изображения', peExtraField(extra,'image_url')) +
              field('pefCtaText','Кнопка (текст)', peExtraField(extra,'cta_text')) +
              field('pefCtaLink','Кнопка (ссылка)', peExtraField(extra,'cta_link')) +
              sortOrder(s.sort_order);
    } else if(type === 'cards'){
      html += field('pefTitle','Заголовок раздела', s.title) +
              field('pefSubtitle','Подзаголовок', peExtraField(extra,'subtitle')) +
              sortOrder(s.sort_order) +
              '<div class="pe-field-label">Карточки' +
                '<div class="pe-repeater" id="pefCardsRepeater">' + peCardsRepeaterHTML(extra) + '</div>' +
                '<button type="button" class="pe-repeater-add" onclick="peAddCard()">+ Добавить карточку</button>' +
              '</div>';
    } else if(type === 'contacts_block'){
      var rows = extra ? extra : 'Телефон::|Telegram::|WhatsApp::|Email::';
      html += field('pefTitle','Заголовок', s.title) +
              field('pefSubtitle','Подзаголовок', peExtraField(extra,'subtitle')) +
              sortOrder(s.sort_order) +
              '<div class="pe-field-label">Контакты' +
                '<div class="pe-repeater" id="pefContactsRepeater">' + peContactsRepeaterHTML(rows) + '</div>' +
                '<button type="button" class="pe-repeater-add" onclick="peAddContact()">+ Добавить контакт</button>' +
              '</div>';
    } else if(type === 'lead_form'){
      html += field('pefEyebrow','Надзаголовок', peExtraField(extra,'eyebrow')) +
              field('pefTitle','Заголовок формы', s.title) +
              sortOrder(s.sort_order);
    } else if(type === 'products_grid'){
      html += field('pefTitle','Заголовок', s.title) +
              field('pefEyebrow','Надзаголовок', peExtraField(extra,'eyebrow')) +
              field('pefProductIds','ID товаров (через запятую)', peExtraField(extra,'product_ids')) +
              sortOrder(s.sort_order);
    } else if(type === 'quote'){
      html += textarea('pefTitle','Текст цитаты *', s.title) +
              field('pefText','Автор / подпись', s.text || peExtraField(extra,'text')) +
              sortOrder(s.sort_order);
    } else {
      html += field('pefTitle','Заголовок', s.title) +
              textarea('pefText','Текст', s.text) +
              sortOrder(s.sort_order);
    }
    return html;
  }

  function peExtraField(extra, key){
    // extra might be key:value pipe-separated OR JSON object
    if(!extra) return '';
    if(extra.charAt(0) === '{'){
      try{ var o = JSON.parse(extra); return o[key] || ''; } catch(e){}
    }
    // Try key::value format
    var lines = extra.split('|');
    for(var i=0;i<lines.length;i++){
      var idx = lines[i].indexOf('::');
      if(idx > -1){
        var k = lines[i].substring(0,idx).trim().toLowerCase().replace(/ /g,'_');
        if(k === key) return lines[i].substring(idx+2);
      }
    }
    return '';
  }

  function peCardsRepeaterHTML(extra){
    if(!extra) return '';
    var rows = extra.split('|').filter(function(r){ return r.trim(); });
    return rows.map(function(r){
      var idx = r.indexOf('::');
      var t = idx > -1 ? r.substring(0,idx) : r;
      var d = idx > -1 ? r.substring(idx+2) : '';
      return peCardRowHTML(t, d);
    }).join('');
  }

  function peCardRowHTML(t, d){
    return '<div class="pe-repeater-row" draggable="true">' +
             '<span class="pe-repeater-drag">&#8942;</span>' +
             '<div class="pe-repeater-inputs">' +
               '<input class="pe-input pe-card-title" placeholder="Название карточки" value="'+esc(t)+'">' +
               '<input class="pe-input pe-card-text" placeholder="Текст карточки" value="'+esc(d)+'">' +
             '</div>' +
             '<button type="button" class="pe-repeater-del" onclick="this.closest(\'.pe-repeater-row\').remove()">✕</button>' +
           '</div>';
  }

  function peContactsRepeaterHTML(extra){
    if(!extra) return '';
    var rows = extra.split('|').filter(function(r){ return r.trim(); });
    return rows.map(function(r){
      var idx = r.indexOf('::');
      var label = idx > -1 ? r.substring(0,idx) : r;
      var val   = idx > -1 ? r.substring(idx+2) : '';
      return peContactRowHTML(label, val);
    }).join('');
  }

  function peContactRowHTML(label, val){
    return '<div class="pe-repeater-row" draggable="true">' +
             '<span class="pe-repeater-drag">&#8942;</span>' +
             '<div class="pe-repeater-inputs">' +
               '<input class="pe-input pe-contact-label" placeholder="Тип (Телефон, Email…)" value="'+esc(label)+'">' +
               '<input class="pe-input pe-contact-val" placeholder="Значение" value="'+esc(val)+'">' +
             '</div>' +
             '<button type="button" class="pe-repeater-del" onclick="this.closest(\'.pe-repeater-row\').remove()">✕</button>' +
           '</div>';
  }

  window.peAddCard = function(){
    var rep = byId('pefCardsRepeater');
    if(rep){ rep.insertAdjacentHTML('beforeend', peCardRowHTML('','')); }
  };
  window.peAddContact = function(){
    var rep = byId('pefContactsRepeater');
    if(rep){ rep.insertAdjacentHTML('beforeend', peContactRowHTML('','')); }
  };

  // ── Save selected block ──
  window.peSaveSelectedBlock = function(){
    if(!peSelectedId) return;
    var s = peSection(peSelectedId);
    if(!s) return;
    var typeSelect = byId('peRightTypeSelect');
    var type = (typeSelect ? typeSelect.value : null) || s.type;
    s.type = type; // sync local state
    var fd = new FormData();
    fd.append('action','save_page_section');
    fd.append('id', s.id);
    fd.append('page_id', window.PE_PAGE_ID);
    fd.append('ps_type', type);
    fd.append('ps_sort', gv('pefSortOrder') || s.sort_order || 0);

    var extra = {};
    var title = '', text = '';

    if(type === 'hero_simple'){
      extra.eyebrow   = gv('pefEyebrow');
      extra.text      = gv('pefText');
      extra.cta_text  = gv('pefCtaText');
      extra.cta_link  = gv('pefCtaLink');
      title           = gv('pefTitle');
    } else if(type === 'text'){
      extra.eyebrow   = gv('pefEyebrow');
      extra.text      = gv('pefText');
      extra.cta_text  = gv('pefCtaText');
      extra.cta_link  = gv('pefCtaLink');
      title           = gv('pefTitle');
    } else if(type === 'text_image'){
      extra.eyebrow   = gv('pefEyebrow');
      extra.text      = gv('pefText');
      extra.image_url = gv('pefImageUrl');
      extra.cta_text  = gv('pefCtaText');
      extra.cta_link  = gv('pefCtaLink');
      title           = gv('pefTitle');
    } else if(type === 'cards'){
      title = gv('pefTitle');
      extra.subtitle = gv('pefSubtitle');
      // collect card rows
      var cardRows = [];
      var rep = byId('pefCardsRepeater');
      if(rep){
        rep.querySelectorAll('.pe-repeater-row').forEach(function(row){
          var t2 = (row.querySelector('.pe-card-title')||{}).value || '';
          var d2 = (row.querySelector('.pe-card-text')||{}).value || '';
          cardRows.push(t2 + '::' + d2);
        });
      }
      fd.append('ps_extra', cardRows.join('|'));
    } else if(type === 'contacts_block'){
      title = gv('pefTitle');
      extra.subtitle = gv('pefSubtitle');
      var contactRows = [];
      var rep2 = byId('pefContactsRepeater');
      if(rep2){
        rep2.querySelectorAll('.pe-repeater-row').forEach(function(row){
          var lbl = (row.querySelector('.pe-contact-label')||{}).value || '';
          var val = (row.querySelector('.pe-contact-val')||{}).value || '';
          contactRows.push(lbl + '::' + val);
        });
      }
      fd.append('ps_extra', contactRows.join('|'));
    } else if(type === 'lead_form'){
      extra.eyebrow = gv('pefEyebrow');
      title = gv('pefTitle');
    } else if(type === 'products_grid'){
      title = gv('pefTitle');
      extra.eyebrow    = gv('pefEyebrow');
      extra.product_ids = gv('pefProductIds');
    } else if(type === 'quote'){
      title = gv('pefTitle');
      text  = gv('pefText');
    } else {
      title = gv('pefTitle');
      text  = gv('pefText');
    }

    fd.append('ps_title', title);
    fd.append('ps_text', text);
    fd.append('ps_active', s.is_active != null ? s.is_active : 1);

    // serialize extra if not already set as pipe string
    if(!fd.has('ps_extra') || fd.get('ps_extra') === ''){
      var extraStr = Object.keys(extra).map(function(k){ return k+'::'+extra[k]; }).join('|');
      fd.set('ps_extra', extraStr);
    } else if(Object.keys(extra).length){
      // merge subtitle into pipe string if present
      var existingExtra = fd.get('ps_extra');
      Object.keys(extra).forEach(function(k){
        if(extra[k]) existingExtra += '|' + k + '::' + extra[k];
      });
      fd.set('ps_extra', existingExtra);
    }

    var btn = byId('peSaveBlock');
    if(btn){ btn.disabled = true; btn.textContent = 'Сохранение…'; }

    var savedId = peSelectedId;
    fetch('/admin/index.php', {method:'POST', body:fd, headers:{'X-Requested-With':'XMLHttpRequest'}})
      .then(function(r){ return r.json(); })
      .then(function(data){
        if(data.ok || data.id){
          // update local state optimistically
          if(data.id) s.id = data.id;
          s.title = title;
          s.text  = text;
          s.sort_order = fd.get('ps_sort');
          s.extra = fd.get('ps_extra');
          if(type==='hero_simple'||type==='text'||type==='text_image'){
            s.eyebrow = extra.eyebrow;
          }
          pePushHistory();
          peShowAutosave();
          // reload sections from server, then re-select
          peReloadSections(savedId);
        }
        if(btn){ btn.disabled = false; btn.textContent = 'Сохранить'; }
      })
      .catch(function(){
        if(btn){ btn.disabled = false; btn.textContent = 'Сохранить'; }
      });
  };

  function gv(id){
    var el = byId(id);
    return el ? el.value : '';
  }

  // ── Reload sections from server without page refresh ──
  function peReloadSections(reSelectId){
    var fd = new FormData();
    fd.append('action', 'get_page_sections');
    fd.append('page_id', window.PE_PAGE_ID);
    fetch('/admin/index.php', {method:'POST', body:fd, headers:{'X-Requested-With':'XMLHttpRequest'}})
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(d.sections){
          peSections = d.sections;
          peRenderLeft();
          peRenderCenter();
          if(reSelectId){
            peSelectBlock(reSelectId);
          }
        }
      });
  }

  // ── Visibility toggle ──
  window.peToggleVisibility = function(){
    if(!peSelectedId) return;
    var s = peSection(peSelectedId);
    if(!s) return;
    var nowHidden = s.is_active == 0 || s.is_active === false || s.is_active === '0';
    var newActive = nowHidden ? 1 : 0;
    s.is_active = newActive;
    pePushHistory();
    peRender();
    // persist
    var fd = new FormData();
    fd.append('action','save_page_section');
    fd.append('id', s.id);
    fd.append('page_id', window.PE_PAGE_ID);
    fd.append('ps_type', s.type);
    fd.append('ps_title', s.title || '');
    fd.append('ps_text', s.text || '');
    fd.append('ps_extra', s.extra || '');
    fd.append('ps_sort', s.sort_order || 0);
    fd.append('ps_active', newActive);
    fetch('/admin/index.php', {method:'POST', body:fd}).then(function(){ peShowAutosave(); });
  };

  // ── Toggle section visibility from left panel ──
  function peToggleSectionVisibility(id){
    var s = peSection(id);
    if(!s) return;
    var nowHidden = s.is_active == 0 || s.is_active === false || s.is_active === '0';
    s.is_active = nowHidden ? 1 : 0;
    pePushHistory();
    peRender();
    var fd = new FormData();
    fd.append('action','save_page_section');
    fd.append('id', s.id);
    fd.append('page_id', window.PE_PAGE_ID);
    fd.append('ps_type', s.type);
    fd.append('ps_title', s.title || '');
    fd.append('ps_text', s.text || '');
    fd.append('ps_extra', s.extra || '');
    fd.append('ps_sort', s.sort_order || 0);
    fd.append('ps_active', s.is_active);
    fetch('/admin/index.php', {method:'POST', body:fd}).then(function(){ peShowAutosave(); });
  }

  // ── Duplicate section ──
  function peDuplicateSection(id){
    var s = peSection(id);
    if(!s) return;
    var fd = new FormData();
    fd.append('action','save_page_section');
    fd.append('page_id', window.PE_PAGE_ID);
    fd.append('ps_type', s.type);
    fd.append('ps_title', (s.title||'') + ' (копия)');
    fd.append('ps_text', s.text||'');
    fd.append('ps_extra', s.extra||'');
    fd.append('ps_sort', (parseInt(s.sort_order)||0) + 1);
    fd.append('ps_active', 1);
    fetch('/admin/index.php', {method:'POST', body:fd})
      .then(function(r){ return r.json(); })
      .then(function(data){
        if(data.id){
          var newS = JSON.parse(JSON.stringify(s));
          newS.id = data.id;
          newS.title = (s.title||'') + ' (копия)';
          var idx = peSections.findIndex(function(x){ return x.id==id; });
          peSections.splice(idx+1, 0, newS);
          pePushHistory();
          peRender();
          peShowAutosave();
        }
      });
  }

  // ── Delete section ──
  function peDeleteSection(id){
    if(!confirm('Удалить блок?')) return;
    var fd = new FormData();
    fd.append('action','delete_page_section');
    fd.append('id', id);
    fetch('/admin/index.php', {method:'POST', body:fd})
      .then(function(){
        peSections = peSections.filter(function(s){ return s.id != id; });
        if(peSelectedId == id) peDeselectBlock();
        pePushHistory();
        peRender();
        peShowAutosave();
      });
  }

  // ── Save sort order ──
  function peSaveSortOrder(){
    peSections.forEach(function(s, i){
      var fd = new FormData();
      fd.append('action','save_page_section');
      fd.append('id', s.id);
      fd.append('page_id', window.PE_PAGE_ID);
      fd.append('ps_type', s.type);
      fd.append('ps_title', s.title||'');
      fd.append('ps_text', s.text||'');
      fd.append('ps_extra', s.extra||'');
      fd.append('ps_sort', i);
      fd.append('ps_active', s.is_active!=null?s.is_active:1);
      fetch('/admin/index.php', {method:'POST', body:fd});
    });
    peShowAutosave();
  }

  // ── Block Picker ──
  window.peOpenBlockPicker = function(){
    var overlay = byId('pePickerOverlay');
    var body = byId('pePickerBody');
    if(!overlay || !body) return;

    var grouped = {};
    PE_GROUPS.forEach(function(g){ grouped[g] = []; });
    Object.keys(PE_TYPES).forEach(function(key){
      var meta = PE_TYPES[key];
      if(!grouped[meta.group]) grouped[meta.group] = [];
      grouped[meta.group].push(key);
    });

    body.innerHTML = PE_GROUPS.map(function(g){
      if(!grouped[g] || !grouped[g].length) return '';
      return '<div class="pe-picker-category">' +
               '<div class="pe-picker-cat-label">' + esc(g) + '</div>' +
               '<div class="pe-picker-grid">' +
                 grouped[g].map(function(type){
                   var meta = PE_TYPES[type];
                   return '<div class="pe-picker-item" onclick="pePickBlock(\''+type+'\')">' +
                            '<div class="pe-picker-preview">' + pePickerPreviewHTML(type) + '</div>' +
                            '<div class="pe-picker-name">' + esc(meta.label) + '</div>' +
                          '</div>';
                 }).join('') +
               '</div>' +
             '</div>';
    }).join('');

    overlay.classList.add('open');
  };

  window.peCloseBlockPicker = function(){
    var overlay = byId('pePickerOverlay');
    if(overlay) overlay.classList.remove('open');
  };

  function pePickerPreviewHTML(type){
    if(type==='hero_simple'){
      return '<div style="width:100%"><div style="width:60%;height:5px;background:var(--accent);border-radius:3px;opacity:.5;margin-bottom:4px"></div>' +
             '<div style="width:90%;height:7px;background:var(--text);border-radius:3px;opacity:.5;margin-bottom:3px"></div>' +
             '<div style="width:70%;height:5px;background:var(--muted);border-radius:3px;opacity:.3"></div></div>';
    } else if(type==='text'){
      return '<div style="width:100%"><div style="width:80%;height:5px;background:var(--text);border-radius:2px;opacity:.4;margin-bottom:3px"></div>' +
             '<div style="width:100%;height:4px;background:var(--muted);border-radius:2px;opacity:.2;margin-bottom:2px"></div>' +
             '<div style="width:75%;height:4px;background:var(--muted);border-radius:2px;opacity:.2"></div></div>';
    } else if(type==='text_image'){
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;width:100%">' +
             '<div><div style="height:5px;background:var(--text);border-radius:2px;opacity:.4;margin-bottom:2px"></div>' +
             '<div style="height:4px;background:var(--muted);border-radius:2px;opacity:.2"></div></div>' +
             '<div style="height:40px;background:var(--line);border-radius:4px"></div></div>';
    } else if(type==='cards'){
      return '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;width:100%">' +
             '<div style="height:32px;background:var(--line);border-radius:3px"></div>' +
             '<div style="height:32px;background:var(--line);border-radius:3px"></div>' +
             '<div style="height:32px;background:var(--line);border-radius:3px"></div></div>';
    } else if(type==='quote'){
      return '<div style="width:100%"><div style="font-size:18px;color:var(--accent);opacity:.4;line-height:1">"</div>' +
             '<div style="height:4px;background:var(--muted);border-radius:2px;opacity:.3;margin-top:2px"></div></div>';
    } else if(type==='contacts_block'){
      return '<div style="width:100%;display:flex;flex-direction:column;gap:3px">' +
             ['','',''].map(function(){ return '<div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:10px;background:var(--accent);border-radius:2px;opacity:.3"></div><div style="flex:1;height:4px;background:var(--muted);border-radius:2px;opacity:.2"></div></div>'; }).join('') +
             '</div>';
    } else if(type==='lead_form'){
      return '<div style="width:100%;display:flex;flex-direction:column;gap:4px">' +
             '<div style="height:14px;background:var(--line);border-radius:3px"></div>' +
             '<div style="height:14px;background:var(--line);border-radius:3px"></div>' +
             '<div style="height:14px;background:var(--accent);border-radius:3px;opacity:.4"></div></div>';
    } else if(type==='products_grid'){
      return '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;width:100%">' +
             '<div style="height:36px;background:var(--line);border-radius:3px"></div>' +
             '<div style="height:36px;background:var(--line);border-radius:3px"></div>' +
             '<div style="height:36px;background:var(--line);border-radius:3px"></div></div>';
    }
    return '<div style="width:60px;height:30px;background:var(--line);border-radius:4px"></div>';
  }

  window.pePickBlock = function(type){
    peCloseBlockPicker();
    var defaultExtra = '';
    if(type === 'contacts_block'){
      defaultExtra = 'Телефон::|Telegram::|WhatsApp::|Email::';
    }
    var fd = new FormData();
    fd.append('action','save_page_section');
    fd.append('page_id', window.PE_PAGE_ID);
    fd.append('ps_type', type);
    fd.append('ps_title', '');
    fd.append('ps_text', '');
    fd.append('ps_extra', defaultExtra);
    fd.append('ps_sort', peSections.length);
    fd.append('ps_active', 1);
    fetch('/admin/index.php', {method:'POST', body:fd})
      .then(function(r){ return r.json(); })
      .then(function(data){
        if(data.id){
          var meta = PE_TYPES[type] || {label: type};
          var newS = {id:data.id, page_id:window.PE_PAGE_ID, type:type, title:'', text:'', extra:defaultExtra, sort_order:peSections.length, is_active:1};
          peSections.push(newS);
          pePushHistory();
          peRender();
          peSelectBlock(data.id);
          peShowAutosave();
        }
      });
  };

  // ── Page active toggle ──
  var peActiveChk = byId('peIsActive');
  if(peActiveChk){
    peActiveChk.addEventListener('change', function(){
      var lbl = byId('peActiveLabel');
      if(lbl) lbl.textContent = this.checked ? 'Опубликовано' : 'Черновик';
      var fd = new FormData();
      fd.append('action','save_page');
      fd.append('id', window.PE_PAGE_ID);
      fd.append('is_active', this.checked?1:0);
      // copy other fields from settings form
      var f = document.getElementById('editPageForm');
      if(f){
        ['title','slug','seo_title','seo_description','nav_label','show_in_nav'].forEach(function(n){
          var el = f.elements[n];
          if(!el) return;
          if(el.type==='checkbox') fd.append(n, el.checked?1:0);
          else fd.append(n, el.value);
        });
      }
      fetch('/admin/index.php', {method:'POST', body:fd}).then(function(){ peShowAutosave('Статус сохранён'); });
    });
  }

  // ── Settings strip ──
  window.peToggleSettings = function(){
    var body = byId('peSettingsBody');
    var strip = byId('peSettingsStrip');
    if(!body) return;
    var open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if(strip) strip.classList.toggle('open', !open);
  };

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', function(e){
    if(!document.getElementById('peEditor')) return;
    if((e.ctrlKey||e.metaKey) && e.key==='z' && !e.shiftKey){ e.preventDefault(); peUndo(); }
    if((e.ctrlKey||e.metaKey) && (e.key==='y'||(e.key==='z'&&e.shiftKey))){ e.preventDefault(); peRedo(); }
  });
  var undoBtn = byId('peUndo'), redoBtn = byId('peRedo');
  if(undoBtn) undoBtn.addEventListener('click', peUndo);
  if(redoBtn) redoBtn.addEventListener('click', peRedo);

  // ── Init ──
  peRender();
  peUpdateUndoRedo();

  // backward-compat stub so existing openSectionModal references don't crash
  if(typeof window.openSectionModal === 'undefined'){
    window.openSectionModal = function(){ };
  }

})();

async function togglePopular(id, checked){
  const fd=new FormData();fd.append('action','toggle_popular');fd.append('id',id);fd.append('val',checked?1:0);
  const r=await fetch('/admin/index.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});
  const d=await r.json();
  if(d.ok) toast(checked?'Добавлено в популярное':'Убрано из популярного');
  else toast('Ошибка','err');
}
</script>
<style>
@keyframes ringAnim{from{transform:rotate(-15deg)}to{transform:rotate(15deg)}}
</style>
<style>
/* ══════════════════════════════════════════
   PAGE EDITOR  (pe-* prefix)
══════════════════════════════════════════ */

/* When editor is active, hide the normal tab wrapper overflow so editor can be full-width */
/* reset contentInner when editor is open */
.contentInner:has(.pe-editor) {
  padding: 0;
  max-width: none;
  width: 100%;
}
.pe-editor {
  margin: 0;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px);
  background: var(--bg, #0f1117);
  font-size: 13px;
  overflow: hidden;
}

/* ── TOP BAR ── */
.pe-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  height: 52px;
  background: var(--panel, #1a1d27);
  border-bottom: 1px solid var(--line, #2a2d3a);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}
.pe-back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted, #6b7280);
  text-decoration: none;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--line, #2a2d3a);
  transition: all .15s;
  white-space: nowrap;
}
.pe-back-btn:hover { color: var(--text, #e2e8f0); border-color: var(--accent, #6366f1); }
.pe-topbar-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text, #e2e8f0);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pe-topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.pe-undo-btn {
  background: none;
  border: 1px solid var(--line, #2a2d3a);
  border-radius: 6px;
  color: var(--muted, #6b7280);
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .15s;
}
.pe-undo-btn:hover:not(:disabled) { color: var(--text, #e2e8f0); border-color: var(--accent, #6366f1); }
.pe-undo-btn:disabled { opacity: .3; cursor: default; }

/* Toggle switch */
.pe-toggle-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.pe-toggle-wrap input { display: none; }
.pe-toggle {
  width: 36px;
  height: 20px;
  background: var(--line, #2a2d3a);
  border-radius: 10px;
  position: relative;
  transition: background .2s;
  flex-shrink: 0;
}
.pe-toggle::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  top: 3px;
  left: 3px;
  transition: transform .2s;
}
.pe-toggle-wrap input:checked ~ .pe-toggle { background: var(--accent, #6366f1); }
.pe-toggle-wrap input:checked ~ .pe-toggle::after { transform: translateX(16px); }
.pe-toggle-label { font-size: 12px; color: var(--muted, #6b7280); min-width: 80px; }
.pe-toggle-wrap input:checked ~ .pe-toggle ~ .pe-toggle-label { color: var(--accent, #6366f1); }

.pe-site-link {
  color: var(--muted, #6b7280);
  font-size: 12px;
  text-decoration: none;
  padding: 5px 10px;
  border: 1px solid var(--line, #2a2d3a);
  border-radius: 6px;
  transition: all .15s;
  white-space: nowrap;
}
.pe-site-link:hover { color: var(--text, #e2e8f0); border-color: var(--accent, #6366f1); }

.pe-autosave {
  font-size: 11px;
  color: var(--muted, #6b7280);
  min-width: 120px;
  text-align: right;
  transition: color .3s;
}
.pe-autosave.pe-saved { color: #22c55e; }

/* ── SETTINGS STRIP ── */
.pe-settings-strip {
  background: var(--panel, #1a1d27);
  border-bottom: 1px solid var(--line, #2a2d3a);
  flex-shrink: 0;
}
.pe-settings-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: var(--muted, #6b7280);
  cursor: pointer;
  padding: 10px 20px;
  font-size: 12px;
  width: 100%;
  text-align: left;
  transition: color .15s;
}
.pe-settings-toggle:hover { color: var(--text, #e2e8f0); }
.pe-chevron { transition: transform .2s; }
.pe-settings-strip.open .pe-chevron { transform: rotate(180deg); }
.pe-settings-body { padding: 0 20px 16px; }
.pe-settings-form {}
.pe-settings-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}
.pe-settings-row .pe-field-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--muted, #6b7280);
  min-width: 140px;
  flex: 1;
}
.pe-settings-checks {
  display: flex;
  gap: 16px;
  align-items: center;
  padding-bottom: 4px;
}
.pe-check-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text, #e2e8f0);
  cursor: pointer;
}
.pe-settings-save { white-space: nowrap; flex-shrink: 0; }
.pe-input {
  background: #16160f;
  border: 1px solid #2e2e26;
  border-radius: 6px;
  color: #f3f1ec;
  font-size: 12px;
  padding: 6px 10px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color .15s;
  font-family: inherit;
}
.pe-input:focus { outline: none; border-color: #c9792b; }
.pe-textarea { min-height: 80px; resize: vertical; }
.pe-field-label { color: #8a877e; }

/* ── 3 COLUMNS ── */
.pe-columns {
  display: grid;
  grid-template-columns: 220px 1fr 320px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── LEFT PANEL ── */
.pe-left {
  background: var(--panel, #1a1d27);
  border-right: 1px solid var(--line, #2a2d3a);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pe-left-header {
  padding: 12px 16px 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--muted, #6b7280);
  flex-shrink: 0;
}
.pe-section-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}
.pe-section-list::-webkit-scrollbar { width: 4px; }
.pe-section-list::-webkit-scrollbar-track { background: transparent; }
.pe-section-list::-webkit-scrollbar-thumb { background: var(--line, #2a2d3a); border-radius: 2px; }

/* Left section card */
.pe-scard {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 7px;
  cursor: pointer;
  transition: background .12s;
  border: 1px solid transparent;
  margin-bottom: 2px;
  position: relative;
}
.pe-scard:hover { background: rgba(99,102,241,.08); }
.pe-scard.active {
  background: rgba(99,102,241,.15);
  border-color: var(--accent, #6366f1);
}
.pe-scard.hidden-block { opacity: .45; }
.pe-drag-handle {
  color: var(--muted, #6b7280);
  cursor: grab;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
  padding: 2px;
  display: flex;
  align-items: center;
}
.pe-drag-handle:active { cursor: grabbing; }
.pe-scard-icon {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  background: rgba(99,102,241,.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--accent, #6366f1);
}
.pe-scard-info {
  flex: 1;
  min-width: 0;
}
.pe-scard-type {
  font-size: 10px;
  color: var(--muted, #6b7280);
  text-transform: uppercase;
  letter-spacing: .04em;
}
.pe-scard-name {
  font-size: 12px;
  color: var(--text, #e2e8f0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pe-scard-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity .15s;
}
.pe-scard:hover .pe-scard-actions { opacity: 1; }
.pe-scard-btn {
  background: none;
  border: none;
  color: var(--muted, #6b7280);
  cursor: pointer;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .12s;
  padding: 0;
}
.pe-scard-btn:hover { background: var(--line, #2a2d3a); color: var(--text, #e2e8f0); }
.pe-scard-btn.danger:hover { background: rgba(239,68,68,.2); color: #ef4444; }

.pe-add-block-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 8px;
  padding: 8px;
  background: none;
  border: 1px dashed var(--line, #2a2d3a);
  border-radius: 8px;
  color: var(--muted, #6b7280);
  cursor: pointer;
  font-size: 12px;
  transition: all .15s;
  flex-shrink: 0;
}
.pe-add-block-btn:hover {
  border-color: var(--accent, #6366f1);
  color: var(--accent, #6366f1);
  background: rgba(99,102,241,.06);
}

/* ── CENTER PREVIEW ── */
.pe-center {
  overflow-y: auto;
  padding: 20px;
  background: var(--bg, #0f1117);
}
.pe-center::-webkit-scrollbar { width: 6px; }
.pe-center::-webkit-scrollbar-track { background: transparent; }
.pe-center::-webkit-scrollbar-thumb { background: var(--line, #2a2d3a); border-radius: 3px; }

.pe-preview-list { display: flex; flex-direction: column; gap: 12px; }

/* Preview card */
.pe-preview-card {
  background: var(--panel, #1a1d27);
  border: 1px solid var(--line, #2a2d3a);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s;
  position: relative;
}
.pe-preview-card:hover { border-color: rgba(99,102,241,.4); }
.pe-preview-card.active {
  border-color: var(--accent, #6366f1);
  box-shadow: 0 0 0 2px rgba(99,102,241,.2);
}
.pe-preview-card.hidden-block { opacity: .45; }
.pe-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line, #2a2d3a);
  font-size: 11px;
  color: var(--muted, #6b7280);
  background: rgba(0,0,0,.2);
}
.pe-preview-type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent, #6366f1);
  flex-shrink: 0;
}
.pe-preview-body { padding: 16px 20px; min-height: 60px; }

/* Skeleton elements */
.pe-sk-eyebrow {
  width: 60px;
  height: 6px;
  background: var(--accent, #6366f1);
  border-radius: 3px;
  opacity: .5;
  margin-bottom: 8px;
}
.pe-sk-h1 {
  height: 10px;
  background: var(--text, #e2e8f0);
  border-radius: 4px;
  opacity: .6;
  margin-bottom: 6px;
}
.pe-sk-h1.w80 { width: 80%; }
.pe-sk-h1.w60 { width: 60%; }
.pe-sk-line {
  height: 6px;
  background: var(--muted, #6b7280);
  border-radius: 3px;
  opacity: .25;
  margin-bottom: 4px;
}
.pe-sk-line.w100 { width: 100%; }
.pe-sk-line.w75 { width: 75%; }
.pe-sk-line.w50 { width: 50%; }
.pe-sk-btn {
  display: inline-block;
  width: 72px;
  height: 22px;
  background: var(--accent, #6366f1);
  border-radius: 5px;
  opacity: .5;
  margin-top: 8px;
}
.pe-sk-img {
  width: 100%;
  height: 60px;
  background: var(--line, #2a2d3a);
  border-radius: 6px;
  margin-bottom: 8px;
}
.pe-sk-cards {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}
.pe-sk-card-item {
  height: 48px;
  background: var(--line, #2a2d3a);
  border-radius: 6px;
}
.pe-sk-quote-mark {
  font-size: 28px;
  color: var(--accent, #6366f1);
  opacity: .3;
  line-height: 1;
  margin-bottom: 4px;
}
.pe-sk-contacts { display: flex; flex-direction: column; gap: 5px; }
.pe-sk-contact-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pe-sk-contact-icon {
  width: 16px;
  height: 16px;
  background: var(--accent, #6366f1);
  border-radius: 4px;
  opacity: .3;
  flex-shrink: 0;
}
.pe-sk-form { display: flex; flex-direction: column; gap: 6px; }
.pe-sk-form-field {
  height: 22px;
  background: var(--line, #2a2d3a);
  border-radius: 5px;
}
.pe-sk-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}
.pe-sk-product {
  height: 64px;
  background: var(--line, #2a2d3a);
  border-radius: 6px;
}
.pe-sk-textimg { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: center; }

/* Empty state */
.pe-preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;
  color: var(--muted, #6b7280);
}
.pe-empty-icon { opacity: .3; }
.pe-empty-text { font-size: 13px; }

/* ── RIGHT PANEL ── */
.pe-right {
  background: var(--panel, #1a1d27);
  border-left: 1px solid var(--line, #2a2d3a);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pe-right-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted, #6b7280);
  font-size: 12px;
  text-align: center;
  padding: 20px;
}
.pe-right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pe-right-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line, #2a2d3a);
  flex-shrink: 0;
}
.pe-right-type-badge { display: none; }
.pe-type-select {
  background: #16160f;
  border: 1px solid #2e2e26;
  border-radius: 6px;
  color: #c9792b;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  cursor: pointer;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: .04em;
  flex-shrink: 0;
}
.pe-type-select:focus { outline: none; border-color: #c9792b; }
.pe-right-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #e2e8f0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pe-right-close {
  background: none;
  border: none;
  color: var(--muted, #6b7280);
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  transition: all .12s;
}
.pe-right-close:hover { background: var(--line, #2a2d3a); color: var(--text, #e2e8f0); }

.pe-right-fields {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.pe-right-fields::-webkit-scrollbar { width: 4px; }
.pe-right-fields::-webkit-scrollbar-track { background: transparent; }
.pe-right-fields::-webkit-scrollbar-thumb { background: var(--line, #2a2d3a); border-radius: 2px; }

.pe-field-group { display: flex; flex-direction: column; gap: 5px; }
.pe-field-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--muted, #6b7280);
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.pe-field-required::after { content: ' *'; color: #ef4444; }

.pe-right-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--line, #2a2d3a);
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.pe-save-btn { flex: 1; justify-content: center; }
.pe-visibility-btn {
  background: none;
  border: 1px solid var(--line, #2a2d3a);
  border-radius: 8px;
  color: var(--muted, #6b7280);
  cursor: pointer;
  padding: 0 12px;
  font-size: 11px;
  transition: all .15s;
  white-space: nowrap;
}
.pe-visibility-btn:hover { border-color: var(--accent, #6366f1); color: var(--accent, #6366f1); }

/* Repeating rows (contacts, cards) */
.pe-repeater { display: flex; flex-direction: column; gap: 6px; }
.pe-repeater-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg, #0f1117);
  border: 1px solid var(--line, #2a2d3a);
  border-radius: 7px;
  padding: 6px 8px;
}
.pe-repeater-drag {
  color: var(--muted, #6b7280);
  cursor: grab;
  font-size: 14px;
  flex-shrink: 0;
  padding: 2px;
}
.pe-repeater-inputs { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.pe-repeater-inputs .pe-input { background: #0f0f0d; border-color: #22221c; padding: 5px 8px; font-size: 12px; color: #f3f1ec; }
.pe-repeater-inputs .pe-input:focus { border-color: #c9792b; background: #16160f; }
.pe-repeater-del {
  background: none;
  border: none;
  color: var(--muted, #6b7280);
  cursor: pointer;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .12s;
  flex-shrink: 0;
  font-size: 13px;
}
.pe-repeater-del:hover { background: rgba(239,68,68,.15); color: #ef4444; }
.pe-repeater-add {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: 1px dashed var(--line, #2a2d3a);
  border-radius: 6px;
  color: var(--muted, #6b7280);
  cursor: pointer;
  font-size: 11px;
  padding: 5px 10px;
  width: 100%;
  transition: all .15s;
  margin-top: 2px;
}
.pe-repeater-add:hover { border-color: var(--accent, #6366f1); color: var(--accent, #6366f1); }

/* ── BLOCK PICKER ── */
.pe-picker-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.6);
  z-index: 1000;
  align-items: center;
  justify-content: center;
}
.pe-picker-overlay.open { display: flex; }
.pe-picker-modal {
  background: var(--panel, #1a1d27);
  border: 1px solid var(--line, #2a2d3a);
  border-radius: 14px;
  width: 680px;
  max-width: 96vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pe-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line, #2a2d3a);
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #e2e8f0);
  flex-shrink: 0;
}
.pe-picker-close {
  background: none;
  border: none;
  color: var(--muted, #6b7280);
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .12s;
}
.pe-picker-close:hover { background: var(--line, #2a2d3a); color: var(--text, #e2e8f0); }
.pe-picker-body { overflow-y: auto; padding: 20px; }
.pe-picker-category { margin-bottom: 20px; }
.pe-picker-cat-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--muted, #6b7280);
  margin-bottom: 10px;
}
.pe-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.pe-picker-item {
  background: var(--bg, #0f1117);
  border: 1px solid var(--line, #2a2d3a);
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: all .15s;
  text-align: center;
}
.pe-picker-item:hover {
  border-color: var(--accent, #6366f1);
  background: rgba(99,102,241,.08);
  transform: translateY(-1px);
}
.pe-picker-preview {
  width: 100%;
  height: 56px;
  background: var(--panel, #1a1d27);
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  box-sizing: border-box;
}
.pe-picker-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text, #e2e8f0);
}
.pe-picker-desc {
  font-size: 10px;
  color: var(--muted, #6b7280);
  margin-top: 2px;
}

/* Drag-over highlight in section list */
.pe-scard.drag-over { background: rgba(99,102,241,.25); border-color: var(--accent, #6366f1); }
.pe-scard.dragging { opacity: .4; }
</style>
</body>
</html>
