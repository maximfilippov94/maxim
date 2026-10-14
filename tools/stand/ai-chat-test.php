<?php
declare(strict_types=1);
/* Ответ EQUA AI приходит тем же запросом, в поле `reply`.
   Запуск: WEB=/путь BASE=http://127.0.0.1:8099 php ai-chat-test.php */
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
    CURLOPT_HTTPHEADER=>$h,CURLOPT_TIMEOUT=>60]);
  $raw=curl_exec($ch); $code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
  return ['code'=>$code,'json'=>json_decode((string)$raw,true),'raw'=>(string)$raw];
}
function ok(string $n, bool $c, string $d=''): void {
  global $pass,$fail,$bad;
  if($c){$pass++; echo "[OK]   $n\n";} else {$fail++; $bad[]=$n; echo "[FAIL] $n".($d!==''?" — $d":'')."\n";}
}
$cwd=getcwd(); chdir($web); require 'config/config.php'; chdir($cwd);
$pdo=db();

$aiIds=aiSpecialistIds();
ok('AI-специалист заведён', !empty($aiIds), json_encode($aiIds));
if(empty($aiIds)){ echo "\nПройдено: $pass, не прошло: $fail\n"; exit(1); }
$aiId=(int)$aiIds[0];

$u=bin2hex(random_bytes(4));
$cl=req('POST','/auth/register',['email'=>"ai.$u@stand.local",'name'=>'Клиент AI',
  'password'=>'Stand2026x','role'=>'client']);
ok('клиент заведён', $cl['code']===201, "код {$cl['code']} {$cl['raw']}");
$tok=(string)($cl['json']['token']??''); $cid=(int)($cl['json']['user_id']??0);

/* без подписки чат закрыт — это не поломка, а граница платной части */
$no=req('POST','/client/messages',['specialist_id'=>$aiId,'body'=>'Привет'],$tok);
ok('без подписки чат отвечает 403', $no['code']===403, "код {$no['code']} {$no['raw']}");

/* выдаём доступ так же, как это делает сервер при оплате */
$pdo->prepare("INSERT INTO ai_subscriptions(client_id,plan,price_kop,period_days,status,paid,paid_at,
                 started_at,expires_at,credited_kop,discount_kop,created_at)
               VALUES(?,'both',0,30,'active',1,?,?,?,0,0,?)")
    ->execute([$cid,now(),now(),gmdate('Y-m-d H:i:s',time()+30*86400),now()]);
ok('подписка выдана', (bool)aiSubCurrent($cid), '');

$r=req('POST','/client/messages',['specialist_id'=>$aiId,'body'=>'Что съесть на ужин?'],$tok);
ok('сообщение принято', $r['code']===201, "код {$r['code']} ".substr($r['raw'],0,200));
ok('своё сообщение вернулось в message', !empty($r['json']['message']['id']), substr($r['raw'],0,200));
ok('ответ AI пришёл в reply, а не в message',
   !empty($r['json']['reply']['body']), substr($r['raw'],0,300));
ok('ответ помечен как AI',
   isset($r['json']['reply']['is_ai']) && (int)$r['json']['reply']['is_ai']===1,
   json_encode($r['json']['reply']['is_ai'] ?? null));
ok('автор ответа — специалист',
   ($r['json']['reply']['author_type'] ?? '')==='specialist',
   (string)($r['json']['reply']['author_type'] ?? ''));

/* и тот же ответ лежит в ленте — значит экран, который перечитывает
   ленту, его тоже увидит */
$feed=req('GET',"/client/messages?specialist_id=$aiId",null,$tok);
$found=false;
foreach(($feed['json']['messages']??[]) as $m)
  if((int)($m['id']??0)===(int)($r['json']['reply']['id']??-1)) $found=true;
ok('ответ есть и в ленте', $found, substr($feed['raw'],0,200));

/* убираем за собой */
$pdo->prepare('DELETE FROM messages WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM ai_subscriptions WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM clients WHERE id=?')->execute([$cid]);

echo "\nПройдено: $pass, не прошло: $fail\n";
if($bad){ echo "Не прошли:\n"; foreach($bad as $b) echo "  - $b\n"; }
exit($fail ? 1 : 0);
