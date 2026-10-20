<?php
declare(strict_types=1);
/* Рекомендации: специалист выдаёт и закрывает, клиент отвечает.
   Запуск: WEB=/путь BASE=http://127.0.0.1:8099 php recs-test.php */
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

$sp=req('POST','/auth/register',['email'=>"qsp.$u@stand.local",'name'=>'Ирина Ковалёва',
  'password'=>'Stand2026x','profession'=>'nutritionist']);
$cl=req('POST','/auth/register',['email'=>"qcl.$u@stand.local",'name'=>'Анна Дорохова',
  'password'=>'Stand2026x','role'=>'client']);
$spId=(int)($sp['json']['user_id']??0); $cid=(int)($cl['json']['user_id']??0);
$spTok=(string)($sp['json']['token']??''); $clTok=(string)($cl['json']['token']??'');
req('POST','/client/connect',['specialist_id'=>$spId],$clTok);

$add=req('POST',"/specialist/clients/$cid/recommendations",
  ['body'=>'Пить воду равномерно в течение дня','title'=>'Питьевой режим',
   'category'=>'nutrition','valid_until'=>date('Y-m-d', time()+14*86400)],$spTok);
ok('специалист выдал рекомендацию', $add['code']===201, "код {$add['code']} ".substr($add['raw'],0,160));
$rid=(int)($add['json']['id']??0);

$h=req('GET','/client/health',null,$clTok);
$rec=null; foreach(($h['json']['recommendations']??[]) as $x) if((int)$x['id']===$rid) $rec=$x;
ok('клиент видит рекомендацию', $rec!==null, substr($h['raw'],0,200));
ok('пришёл заголовок', ($rec['title']??'')==='Питьевой режим', json_encode($rec['title']??null, JSON_UNESCAPED_UNICODE));
ok('пришёл вид', ($rec['category']??'')==='nutrition', (string)($rec['category']??''));
ok('пришёл срок', !empty($rec['valid_until']), (string)($rec['valid_until']??''));
ok('пришёл автор', ($rec['author_name']??'')==='Ирина Ковалёва', (string)($rec['author_name']??''));
ok('статус active', ($rec['status']??'')==='active', (string)($rec['status']??''));
ok('ответ клиента пока new', ($rec['client_status']??'')==='new', (string)($rec['client_status']??''));

$st=req('PATCH',"/client/health/recommendations/$rid/status",['status'=>'in_progress'],$clTok);
ok('клиент отмечает «выполняю»', $st['code']===200, "код {$st['code']} {$st['raw']}");
$h2=req('GET','/client/health',null,$clTok); $rec2=null;
foreach(($h2['json']['recommendations']??[]) as $x) if((int)$x['id']===$rid) $rec2=$x;
ok('ответ клиента сохранён', ($rec2['client_status']??'')==='in_progress',
   (string)($rec2['client_status']??''));

$done=req('PATCH',"/specialist/recommendations/$rid",['status'=>'done'],$spTok);
ok('специалист закрывает рекомендацию', $done['code']===200, "код {$done['code']} {$done['raw']}");
$h3=req('GET','/client/health',null,$clTok); $rec3=null;
foreach(($h3['json']['recommendations']??[]) as $x) if((int)$x['id']===$rid) $rec3=$x;
ok('статус стал done', ($rec3['status']??'')==='done', (string)($rec3['status']??''));

/* Закрытую клиент уже не меняет: сервер правит только active */
$late=req('PATCH',"/client/health/recommendations/$rid/status",['status'=>'done'],$clTok);
ok('закрытую клиент не меняет', $late['code']===404, "код {$late['code']} {$late['raw']}");

/* Чужую рекомендацию не закрыть */
$sp2=req('POST','/auth/register',['email'=>"qsp2.$u@stand.local",'name'=>'Пётр Смирнов',
  'password'=>'Stand2026x','profession'=>'nutritionist']);
$alien=req('PATCH',"/specialist/recommendations/$rid",['status'=>'cancelled'],
  (string)($sp2['json']['token']??''));
ok('чужую рекомендацию не закрыть', $alien['code']===403 || $alien['code']===404,
   "код {$alien['code']} {$alien['raw']}");

$pdo->prepare('DELETE FROM client_recommendations WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM client_specialists WHERE client_id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM clients WHERE id=?')->execute([$cid]);
$pdo->prepare('DELETE FROM specialists WHERE id IN (?,?)')
    ->execute([$spId,(int)($sp2['json']['user_id']??0)]);

echo "\nПройдено: $pass, не прошло: $fail\n";
if($bad){ echo "Не прошли:\n"; foreach($bad as $b) echo "  - $b\n"; }
exit($fail ? 1 : 0);
