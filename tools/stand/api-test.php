<?php
declare(strict_types=1);
/* Проверки API по HTTP на поднятом стенде.
   Запуск: BASE=http://127.0.0.1:8099 php api-test.php */
$BASE = rtrim((string)(getenv('BASE') ?: 'http://127.0.0.1:8099'), '/');
$pass = 0; $fail = 0; $failed = [];

function req(string $m, string $p, array $body = null, string $token = ''): array {
  global $BASE;
  $ch = curl_init($BASE.'/api/v1'.$p);
  $h = ['Accept: application/json'];
  if ($token !== '') $h[] = 'Authorization: Bearer '.$token;
  if ($body !== null) { $h[] = 'Content-Type: application/json';
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE)); }
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_CUSTOMREQUEST=>$m,
    CURLOPT_HTTPHEADER=>$h, CURLOPT_TIMEOUT=>20]);
  $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  return ['code'=>$code, 'json'=>json_decode((string)$raw, true), 'raw'=>(string)$raw];
}
function ok(string $name, bool $cond, string $detail = ''): void {
  global $pass, $fail, $failed;
  if ($cond) { $pass++; echo "[OK]   $name\n"; }
  else { $fail++; $failed[] = $name; echo "[FAIL] $name".($detail!==''?" — $detail":"")."\n"; }
}
$u = bin2hex(random_bytes(4));

/* --- участники --- */
$sp = req('POST','/auth/register',['email'=>"sp.$u@stand.local",'name'=>'Ирина Ковалёва',
  'password'=>'Stand2026x','profession'=>'nutritionist']);
ok('регистрация специалиста', $sp['code']===201 && !empty($sp['json']['token']), "код {$sp['code']} {$sp['raw']}");
$spTok = (string)($sp['json']['token'] ?? ''); $spId = (int)($sp['json']['user_id'] ?? 0);

$cl = req('POST','/auth/register',['email'=>"cl.$u@stand.local",'name'=>'Анна Дорохова',
  'password'=>'Stand2026x','role'=>'client',
  'profile'=>['sex'=>'f','age'=>31,'height_cm'=>168,'weight_kg'=>64,'activity_level'=>'medium','goal'=>'Снижение веса']]);
ok('регистрация клиента', $cl['code']===201 && !empty($cl['json']['token']), "код {$cl['code']} {$cl['raw']}");
$clTok = (string)($cl['json']['token'] ?? ''); $clId = (int)($cl['json']['user_id'] ?? 0);

$con = req('POST','/client/connect',['specialist_id'=>$spId], $clTok);
ok('клиент подключил нутрициолога', $con['code']>=200 && $con['code']<300, "код {$con['code']} {$con['raw']}");

/* --- цели из анкеты посчитаны --- */
$me = req('GET','/me', null, $clTok);
$kc = (int)($me['json']['target_kcal'] ?? ($me['json']['client']['target_kcal'] ?? ($me['json']['user']['target_kcal'] ?? 0)));
ok('цели рассчитаны при регистрации', $kc >= 1000 && $kc <= 3000, "target_kcal=$kc");

/* --- лекарства: taken_today и frequency_per_day --- */
$add = req('POST','/client/health/meds',['title'=>'Магний B6','dosage'=>'1 таб',
  'frequency_per_day'=>3,'started_on'=>date('Y-m-d')], $clTok);
ok('лекарство добавлено', $add['code']>=200 && $add['code']<300, "код {$add['code']} {$add['raw']}");

$h = req('GET','/client/health', null, $clTok);
$med = null;
foreach (($h['json']['meds'] ?? []) as $m) if (($m['title'] ?? '') === 'Магний B6') $med = $m;
ok('/client/health отдаёт лекарство', $med !== null, $h['raw']);
ok('есть frequency_per_day', $med !== null && array_key_exists('frequency_per_day', $med),
   $med ? implode(',', array_keys($med)) : '');
ok('есть taken_today', $med !== null && array_key_exists('taken_today', $med),
   $med ? implode(',', array_keys($med)) : '');
ok('taken_today на старте = 0', $med !== null && (int)($med['taken_today'] ?? -1) === 0,
   $med ? (string)($med['taken_today'] ?? 'нет') : '');

if ($med) {
  $mid = (int)$med['id'];
  req('POST', "/client/health/meds/$mid/intake", ['taken_count'=>1], $clTok);
  $h2 = req('GET','/client/health', null, $clTok); $m2 = null;
  foreach (($h2['json']['meds'] ?? []) as $m) if ((int)($m['id'] ?? 0) === $mid) $m2 = $m;
  ok('после первой отметки taken_today = 1', $m2 && (int)$m2['taken_today'] === 1,
     $m2 ? (string)$m2['taken_today'] : 'не нашёл');
  req('POST', "/client/health/meds/$mid/intake", ['taken_count'=>2], $clTok);
  $h3 = req('GET','/client/health', null, $clTok); $m3 = null;
  foreach (($h3['json']['meds'] ?? []) as $m) if ((int)($m['id'] ?? 0) === $mid) $m3 = $m;
  ok('после второй отметки taken_today = 2', $m3 && (int)$m3['taken_today'] === 2,
     $m3 ? (string)$m3['taken_today'] : 'не нашёл');
}

/* --- специалист видит здоровье клиента --- */
$sh = req('GET', "/specialist/clients/$clId/health", null, $spTok);
ok('специалист видит здоровье клиента', $sh['code']===200, "код {$sh['code']} ".substr($sh['raw'],0,120));

/* --- дашборд специалиста --- */
$d = req('GET','/specialist/dashboard', null, $spTok);
ok('дашборд отвечает', $d['code']===200, "код {$d['code']} ".substr($d['raw'],0,160));

/* --- список клиентов --- */
$lc = req('GET','/specialist/clients', null, $spTok);
$found = false;
foreach ((is_array($lc['json']) ? ($lc['json']['clients'] ?? $lc['json']) : []) as $c)
  if ((int)($c['id'] ?? 0) === $clId) $found = true;
ok('клиент виден у специалиста', $found, substr($lc['raw'], 0, 200));

echo "\nПройдено: $pass, не прошло: $fail\n";
if ($failed) { echo "Не прошли:\n"; foreach ($failed as $f) echo "  - $f\n"; }
exit($fail ? 1 : 0);
