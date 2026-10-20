<?php
declare(strict_types=1);
/* Добавленная еда должна появиться в дневнике дня и в итогах «Сегодня».
   Запуск: WEB=/путь BASE=http://127.0.0.1:8099 php foodlog-test.php */
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

$cl=req('POST','/auth/register',['email'=>"fl.$u@stand.local",'name'=>'Анна Дорохова',
  'password'=>'Stand2026x','role'=>'client']);
$cid=(int)($cl['json']['user_id']??0); $tok=(string)($cl['json']['token']??'');
ok('клиент заведён', $cl['code']===201, "код {$cl['code']}");

/* продукт в общей базе */
$pdo->prepare("INSERT INTO ingredients(name,kcal,protein,fat,carbs,created_at)
               VALUES(?,?,?,?,?,?)")->execute(['Творог 5%',121,16.0,5.0,3.0,now()]);
$ing=(int)$pdo->lastInsertId();

$before=req('GET','/client/today',null,$tok);
$k0=(int)round((float)($before['json']['totals']['kcal'] ?? 0));

$add=req('POST','/client/food-log',
  ['meal'=>'breakfast','items'=>[['ingredient_id'=>$ing,'grams'=>200]]],$tok);
ok('еда принята', $add['code']>=200 && $add['code']<300, "код {$add['code']} ".substr($add['raw'],0,200));

$after=req('GET','/client/today',null,$tok);
$food=$after['json']['food'] ?? [];
ok('запись появилась в дневнике дня', count($food)===1, 'записей: '.count($food));
ok('запись в нужном приёме пищи',
   ($food[0]['meal'] ?? '')==='breakfast', (string)($food[0]['meal'] ?? ''));
ok('в записи есть продукт',
   !empty($food[0]['items']), json_encode(array_keys($food[0] ?? []), JSON_UNESCAPED_UNICODE));
ok('у записи посчитаны итоги',
   isset($food[0]['totals']['kcal']), json_encode($food[0]['totals'] ?? null));

$k1=(int)round((float)($after['json']['totals']['kcal'] ?? 0));
ok('итоги дня выросли на 242 ккал', $k1 - $k0 === 242, "было $k0, стало $k1");

$ft=(int)round((float)($after['json']['food_totals']['kcal'] ?? 0));
ok('food_totals отдельно считает дневник', $ft === 242, "food_totals=$ft");

$pdo->prepare('DELETE FROM food_entry_items WHERE entry_id IN (SELECT id FROM food_entries WHERE client_id=?)')->execute([$cid]);
$pdo->prepare('DELETE FROM food_entries WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM clients WHERE id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM ingredients WHERE id=?')->execute([$ing]);

echo "\nПройдено: $pass, не прошло: $fail\n";
if($bad){ echo "Не прошли:\n"; foreach($bad as $b) echo "  - $b\n"; }
exit($fail ? 1 : 0);
