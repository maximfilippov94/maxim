<?php
declare(strict_types=1);
/* Список переписок клиента: нутрициолог, тренер и EQUA AI — каждый
   отдельной строкой. Запуск: WEB=/путь BASE=http://127.0.0.1:8099 php chats-test.php */
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
$u=bin2hex(random_bytes(4));

/* нутрициолог, тренер и клиент */
$nu=req('POST','/auth/register',['email'=>"nu.$u@stand.local",'name'=>'Ирина Ковалёва',
  'password'=>'Stand2026x','profession'=>'nutritionist']);
$tr=req('POST','/auth/register',['email'=>"tr.$u@stand.local",'name'=>'Артём Гурьев',
  'password'=>'Stand2026x','profession'=>'trainer']);
$cl=req('POST','/auth/register',['email'=>"cl.$u@stand.local",'name'=>'Анна Дорохова',
  'password'=>'Stand2026x','role'=>'client']);
ok('участники заведены',
   $nu['code']===201 && $tr['code']===201 && $cl['code']===201,
   "{$nu['code']}/{$tr['code']}/{$cl['code']}");
$tok=(string)($cl['json']['token']??''); $cid=(int)($cl['json']['user_id']??0);
$nuId=(int)($nu['json']['user_id']??0); $trId=(int)($tr['json']['user_id']??0);

ok('нутрициолог подключён',
   ($r=req('POST','/client/connect',['specialist_id'=>$nuId],$tok))['code']<300, $r['raw']);
ok('тренер подключён',
   ($r=req('POST','/client/connect',['specialist_id'=>$trId],$tok))['code']<300, $r['raw']);

/* обоим по сообщению, чтобы в списке было что показывать */
req('POST','/client/messages',['specialist_id'=>$nuId,'body'=>'Здравствуйте!'],$tok);
req('POST','/client/messages',['specialist_id'=>$trId,'body'=>'Готова начать'],$tok);

$ch=req('GET','/client/chats',null,$tok);
ok('список переписок отвечает', $ch['code']===200, "код {$ch['code']} ".substr($ch['raw'],0,160));
$chats = $ch['json']['chats'] ?? [];
ok('в списке двое: нутрициолог и тренер', count($chats)===2, 'строк: '.count($chats));

$byId = [];
foreach ($chats as $c) $byId[(int)$c['id']] = $c;
ok('нутрициолог в списке', isset($byId[$nuId]), implode(',', array_keys($byId)));
ok('тренер в списке', isset($byId[$trId]), implode(',', array_keys($byId)));
ok('у нутрициолога роль nutritionist',
   ($byId[$nuId]['role'] ?? '')==='nutritionist', (string)($byId[$nuId]['role'] ?? ''));
ok('у тренера роль trainer',
   ($byId[$trId]['role'] ?? '')==='trainer', (string)($byId[$trId]['role'] ?? ''));
ok('у каждого своё последнее сообщение',
   ($byId[$nuId]['last'] ?? '')==='Здравствуйте!' && ($byId[$trId]['last'] ?? '')==='Готова начать',
   json_encode([$byId[$nuId]['last'] ?? null, $byId[$trId]['last'] ?? null], JSON_UNESCAPED_UNICODE));

/* ленты собеседников не смешиваются */
$fNu=req('GET',"/client/messages?specialist_id=$nuId",null,$tok);
$bodies=array_column($fNu['json']['messages'] ?? [], 'body');
ok('лента нутрициолога без чужих сообщений',
   in_array('Здравствуйте!',$bodies,true) && !in_array('Готова начать',$bodies,true),
   json_encode($bodies, JSON_UNESCAPED_UNICODE));

/* EQUA AI появляется в списке только с подпиской */
ok('без подписки AI в списке нет',
   !array_filter($chats, fn($c) => (int)($c['is_ai'] ?? 0) === 1), '');
$pdo->prepare("INSERT INTO ai_subscriptions(client_id,plan,price_kop,period_days,status,paid,paid_at,
                 started_at,expires_at,credited_kop,discount_kop,created_at)
               VALUES(?,'both',0,30,'active',1,?,?,?,0,0,?)")
    ->execute([$cid,now(),now(),gmdate('Y-m-d H:i:s',time()+30*86400),now()]);
$ch2=req('GET','/client/chats',null,$tok);
$ai=array_values(array_filter($ch2['json']['chats'] ?? [], fn($c) => (int)($c['is_ai'] ?? 0) === 1));
ok('с подпиской AI появляется отдельной строкой', count($ai)>0, substr($ch2['raw'],0,220));

/* убираем за собой */
$pdo->prepare('DELETE FROM messages WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM ai_subscriptions WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM client_specialists WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM clients WHERE id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM specialists WHERE id IN (?,?)')->execute([$nuId,$trId]);

echo "\nПройдено: $pass, не прошло: $fail\n";
if($bad){ echo "Не прошли:\n"; foreach($bad as $b) echo "  - $b\n"; }
exit($fail ? 1 : 0);
