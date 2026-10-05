<?php
declare(strict_types=1);
/* Оценка блюда: только за съеденное, ответ несёт новую среднюю.
   Запуск: WEB=/путь BASE=http://127.0.0.1:8099 php dish-rating-test.php */
$web = getenv('WEB') ?: '';
if ($web === '' || !is_dir($web)) { fwrite(STDERR, "Укажите каталог сайта: WEB=/путь\n"); exit(2); }
$BASE = rtrim((string)(getenv('BASE') ?: 'http://127.0.0.1:8099'), '/');
$pass=0; $fail=0; $bad=[];
function req(string $m, string $p, array $body=null, string $token=''): array {
  global $BASE;
  $ch=curl_init($BASE.'/api/v1'.$p); $h=['Accept: application/json'];
  if($token!=='')$h[]='Authorization: Bearer '.$token;
  if($body!==null){$h[]='Content-Type: application/json';
    curl_setopt($ch,CURLOPT_POSTFIELDS,json_encode($body,JSON_UNESCAPED_UNICODE));}
  curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>$m,
    CURLOPT_HTTPHEADER=>$h,CURLOPT_TIMEOUT=>30]);
  $raw=curl_exec($ch); $code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
  return ['code'=>$code,'json'=>json_decode((string)$raw,true),'raw'=>(string)$raw];
}
function ok(string $n, bool $c, string $d=''): void {
  global $pass,$fail,$bad;
  if($c){$pass++; echo "[OK]   $n\n";} else {$fail++; $bad[]=$n; echo "[FAIL] $n".($d!==''?" — $d":'')."\n";}
}
$cwd=getcwd(); chdir($web); require 'config/config.php'; chdir($cwd);
$pdo=db(); $u=bin2hex(random_bytes(4));

$sp=req('POST','/auth/register',['email'=>"rsp.$u@stand.local",'name'=>'Ирина Ковалёва',
  'password'=>'Stand2026x','profession'=>'nutritionist']);
$cl=req('POST','/auth/register',['email'=>"rcl.$u@stand.local",'name'=>'Анна Дорохова',
  'password'=>'Stand2026x','role'=>'client']);
$spId=(int)($sp['json']['user_id']??0); $cid=(int)($cl['json']['user_id']??0);
$tok=(string)($cl['json']['token']??'');
req('POST','/client/connect',['specialist_id'=>$spId],$tok);

/* блюдо, меню на сегодня и одна позиция */
$pdo->prepare("INSERT INTO dishes(name,base_portion_g,kcal_100,protein_100,fat_100,carbs_100,is_public,created_at)
               VALUES(?,?,?,?,?,?,1,?)")->execute(['Овсянка на воде',250,124,4.4,2.4,20.8,now()]);
$did=(int)$pdo->lastInsertId();
$pdo->prepare("INSERT INTO menus(client_id,specialist_id,title,start_date,days_count,status,published_at,created_at)
               VALUES(?,?,?,?,1,'published',?,?)")
    ->execute([$cid,$spId,'Неделя 1',date('Y-m-d'),now(),now()]);
$mid=(int)$pdo->lastInsertId();
$pdo->prepare("INSERT INTO menu_items(menu_id,day_number,meal_type,dish_id,portion_g,sort_order)
               VALUES(?,1,'breakfast',?,250,0)")->execute([$mid,$did]);
$iid=(int)$pdo->lastInsertId();

$no=req('POST',"/client/dishes/$did/rating",['rating'=>5],$tok);
ok('неотмеченное блюдо оценить нельзя', $no['code']===403, "код {$no['code']} {$no['raw']}");

req('POST',"/client/meals/$iid/log",['status'=>'eaten'],$tok);
$r=req('POST',"/client/dishes/$did/rating",['rating'=>4],$tok);
ok('съеденное блюдо оценивается', $r['code']===200, "код {$r['code']} ".substr($r['raw'],0,160));
ok('ответ несёт среднюю оценку', ($r['json']['rating'] ?? null) == 4.0, json_encode($r['json']));
ok('ответ несёт число оценивших', ($r['json']['rating_count'] ?? null) === 1, json_encode($r['json']));

$it=req('GET',"/client/menu-items/$iid",null,$tok);
ok('в блюде видна своя оценка', (int)($it['json']['item']['my_rating'] ?? 0) === 4,
   json_encode($it['json']['item']['my_rating'] ?? null));
ok('в блюде видна средняя', (float)($it['json']['item']['dish_rating'] ?? 0) == 4.0,
   json_encode($it['json']['item']['dish_rating'] ?? null));

/* повторная оценка заменяет прежнюю, а не добавляет вторую */
$r2=req('POST',"/client/dishes/$did/rating",['rating'=>2],$tok);
ok('повторная оценка заменяет прежнюю',
   ($r2['json']['rating'] ?? null) == 2.0 && ($r2['json']['rating_count'] ?? null) === 1,
   json_encode($r2['json']));

$pdo->prepare('DELETE FROM dish_ratings WHERE dish_id=?')->execute([$did]);
$pdo->prepare('DELETE FROM meal_logs WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM menu_items WHERE menu_id=?')->execute([$mid]);
$pdo->prepare('DELETE FROM menus WHERE id=?')->execute([$mid]);
$pdo->prepare('DELETE FROM dishes WHERE id=?')->execute([$did]);
$pdo->prepare('DELETE FROM client_specialists WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM clients WHERE id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM specialists WHERE id=?')->execute([$spId]);

echo "\nПройдено: $pass, не прошло: $fail\n";
if($bad){ echo "Не прошли:\n"; foreach($bad as $b) echo "  - $b\n"; }
exit($fail ? 1 : 0);
