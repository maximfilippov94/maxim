<?php
declare(strict_types=1);
/* Промокод проверяется до оплаты; подключение услуги при действующем
   EQUA AI спрашивает подтверждение, а не отказывает.
   Запуск: WEB=/путь BASE=http://127.0.0.1:8099 php promo-test.php */
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
$pdo=db(); $u=bin2hex(random_bytes(4)); $CODE='STAND'.strtoupper(substr($u,0,5));

$sp=req('POST','/auth/register',['email'=>"psp.$u@stand.local",'name'=>'Ирина Ковалёва',
  'password'=>'Stand2026x','profession'=>'nutritionist']);
$cl=req('POST','/auth/register',['email'=>"pcl.$u@stand.local",'name'=>'Анна Дорохова',
  'password'=>'Stand2026x','role'=>'client']);
$spId=(int)($sp['json']['user_id']??0); $cid=(int)($cl['json']['user_id']??0);
$tok=(string)($cl['json']['token']??'');
req('POST','/client/connect',['specialist_id'=>$spId],$tok);

$pdo->prepare("INSERT INTO specialist_services(specialist_id,title,kind,price_kop,period_days,
                 is_active,sort_order,created_at,service_type)
               VALUES(?,?,'subscription',500000,30,1,0,?,'nutrition')")
    ->execute([$spId,'Ведение питания',now()]);
$svcId=(int)$pdo->lastInsertId();

$pdo->prepare("INSERT INTO promo_codes(code,percent,payer,specialist_id,uses,status,created_at,scope)
               VALUES(?,20,'specialist',?,0,'active',?,'specialist')")
    ->execute([$CODE,$spId,now()]);

$bad1=req('POST','/client/promo/check',['code'=>'НЕТТАКОГО','service_id'=>$svcId],$tok);
ok('несуществующий код отклоняется', $bad1['code']===422, "код {$bad1['code']} {$bad1['raw']}");

$r=req('POST','/client/promo/check',['code'=>$CODE,'service_id'=>$svcId],$tok);
ok('промокод проверяется', $r['code']===200, "код {$r['code']} ".substr($r['raw'],0,160));
ok('процент скидки отдан', ($r['json']['percent'] ?? null) === 20, json_encode($r['json']));
ok('цена без скидки отдана', ($r['json']['price_kop'] ?? null) === 500000, json_encode($r['json']));
ok('к оплате со скидкой 20 %', ($r['json']['total_kop'] ?? null) === 400000, json_encode($r['json']));

/* Регистр и пробелы: человек вводит как придётся */
$r2=req('POST','/client/promo/check',['code'=>strtolower($CODE),'service_id'=>$svcId],$tok);
ok('код принимается в нижнем регистре', $r2['code']===200, substr($r2['raw'],0,140));

/* Действующий EQUA AI: подключение услуги спрашивает подтверждение */
$pdo->prepare("INSERT INTO ai_subscriptions(client_id,plan,price_kop,period_days,status,paid,paid_at,
                 started_at,expires_at,credited_kop,discount_kop,created_at)
               VALUES(?,'both',300000,30,'active',1,?,?,?,0,0,?)")
    ->execute([$cid,now(),now(),gmdate('Y-m-d H:i:s',time()+20*86400),now()]);

$act=req('POST',"/client/services/$svcId/activate",['promo'=>$CODE],$tok);
ok('при действующем AI сервер просит подтверждение',
   !empty($act['json']['need_confirm']), "код {$act['code']} ".substr($act['raw'],0,220));
ok('в ответе есть, что станет с AI',
   isset($act['json']['ai_switch']), substr($act['raw'],0,220));
ok('назван остаток в зачёт',
   isset($act['json']['ai_switch']['credit_kop']),
   json_encode($act['json']['ai_switch'] ?? null, JSON_UNESCAPED_UNICODE));

$act2=req('POST',"/client/services/$svcId/activate",['promo'=>$CODE,'confirm'=>true],$tok);
ok('с подтверждением услуга подключается', $act2['code']>=200 && $act2['code']<300,
   "код {$act2['code']} ".substr($act2['raw'],0,220));

/* убираем за собой */
$pdo->prepare('DELETE FROM client_subscriptions WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM ai_subscriptions WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM balance_entries WHERE specialist_id=?')->execute([$spId]);
$pdo->prepare('DELETE FROM promo_codes WHERE code=?')->execute([$CODE]);
$pdo->prepare('DELETE FROM specialist_services WHERE id=?')->execute([$svcId]);
$pdo->prepare('DELETE FROM client_specialists WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM clients WHERE id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM specialists WHERE id=?')->execute([$spId]);

echo "\nПройдено: $pass, не прошло: $fail\n";
if($bad){ echo "Не прошли:\n"; foreach($bad as $b) echo "  - $b\n"; }
exit($fail ? 1 : 0);
