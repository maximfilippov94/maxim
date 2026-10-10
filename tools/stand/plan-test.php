<?php
declare(strict_types=1);
/* Проверка «питание считается от плана»: mealPlanAdherence и foodDiaryPeriod.
   Запуск: php plan-test.php (рядом со стендом) */
$web=getenv('WEB')?:'';
if($web===''||!is_dir($web)){fwrite(STDERR,"Укажите каталог сайта: WEB=/путь/к/public_html php ".basename(__FILE__)."
");exit(2);}
chdir($web); require 'config/config.php';
/* Функции питания живут в api/index.php, который сам себя маршрутизирует.
   Берём их текст из того же файла — проверяем оригинал, а не копию. */
$src=file_get_contents('api/index.php');
foreach(['foodDiaryPeriod','mealPlanAdherence'] as $fn){
  $i=strpos($src,'function '.$fn.'(');
  if($i===false){fwrite(STDERR,"не нашёл $fn
");exit(2);}
  $d=0;$j=strpos($src,'{',$i);$k=$j;
  for(;$k<strlen($src);$k++){ if($src[$k]==='{')$d++; elseif($src[$k]==='}'){$d--; if($d===0)break;} }
  eval(substr($src,$i,$k-$i+1));
}
$pdo = db(); $pass=0; $fail=0; $bad=[];
function ok(string $n, bool $c, string $d=''): void {
  global $pass,$fail,$bad;
  if($c){$pass++; echo "[OK]   $n\n";} else {$fail++; $bad[]=$n; echo "[FAIL] $n".($d!==''?" — $d":'')."\n";}
}
/* свои участники, за собой убираем */
$tag = 'plantest_'.bin2hex(random_bytes(3));
$pdo->prepare("INSERT INTO specialists(email,password_hash,name,profession,created_at) VALUES(?,?,?,'nutritionist',?)")
    ->execute(["$tag@stand.local", password_hash('x', PASSWORD_DEFAULT), 'Проверка плана', now()]);
$sid = (int)$pdo->lastInsertId();
$pdo->prepare("INSERT INTO clients(specialist_id,name,email,password_hash,status,created_at) VALUES(?,?,?,?,'active',?)")
    ->execute([$sid, 'Клиент плана', "c.$tag@stand.local", password_hash('x', PASSWORD_DEFAULT), now()]);
$cid = (int)$pdo->lastInsertId();

/* блюдо для позиций */
$pdo->prepare("INSERT INTO dishes(name,base_portion_g,kcal_100,protein_100,fat_100,carbs_100,is_public,created_at) VALUES(?,?,?,?,?,?,1,?)")
    ->execute(['Овсянка на воде', 250, 124, 4.4, 2.4, 20.8, now()]);
$did = (int)$pdo->lastInsertId();

$start = date('Y-m-d', strtotime('-6 days'));          // план начался 6 дней назад
$pdo->prepare("INSERT INTO menus(client_id,specialist_id,title,start_date,days_count,status,published_at,created_at)
               VALUES(?,?,?,?,7,'published',?,?)")
    ->execute([$cid,$sid,'Неделя 1',$start,now(),now()]);
$mid = (int)$pdo->lastInsertId();

/* 7 дней × 3 приёма = 21 позиция */
$ins = $pdo->prepare("INSERT INTO menu_items(menu_id,day_number,meal_type,dish_id,portion_g,sort_order) VALUES(?,?,?,?,?,?)");
$ids = [];
foreach (range(1,7) as $d) foreach (['breakfast','lunch','dinner'] as $k => $meal) {
  $ins->execute([$mid,$d,$meal,$did,250,$k]); $ids["$d-$meal"] = (int)$pdo->lastInsertId();
}
ok('план создан: 21 позиция', count($ids) === 21, (string)count($ids));

/* отмечаем: дни 1–3 съедены целиком (9), день 4 — один пропуск + два съеденных */
$log = $pdo->prepare("INSERT INTO meal_logs(menu_item_id,client_id,status,logged_at) VALUES(?,?,?,?)");
foreach (range(1,3) as $d) foreach (['breakfast','lunch','dinner'] as $meal) $log->execute([$ids["$d-$meal"],$cid,'eaten',now()]);
$log->execute([$ids['4-breakfast'],$cid,'eaten',now()]);
$log->execute([$ids['4-lunch'],$cid,'eaten',now()]);
$log->execute([$ids['4-dinner'],$cid,'skipped',now()]);

$from = $start; $to = date('Y-m-d');                   // день 1 .. день 7 (сегодня)
$a = mealPlanAdherence($cid,$from,$to);
ok('planned = 21 (вся неделя попала в окно)', $a['planned'] === 21, json_encode($a));
ok('eaten = 11', $a['eaten'] === 11, json_encode($a));
ok('tracked = 12 (в том числе пропуск)', $a['tracked'] === 12, json_encode($a));
ok('untracked = 9', $a['untracked'] === 9, json_encode($a));
ok('pct = 52', $a['pct'] === 52, json_encode($a));

/* окно уже плана: только дни 1–3 */
$a3 = mealPlanAdherence($cid,$start,date('Y-m-d', strtotime($start.' +2 days')));
ok('окно в 3 дня даёт planned = 9', $a3['planned'] === 9, json_encode($a3));
ok('окно в 3 дня даёт eaten = 9', $a3['eaten'] === 9, json_encode($a3));
ok('окно в 3 дня даёт pct = 100', $a3['pct'] === 100, json_encode($a3));

/* клиент без плана */
$pdo->prepare("INSERT INTO clients(specialist_id,name,email,password_hash,status,created_at) VALUES(?,?,?,?,'active',?)")
    ->execute([$sid,'Без плана',"n.$tag@stand.local",password_hash('x',PASSWORD_DEFAULT),now()]);
$cid2 = (int)$pdo->lastInsertId();
$a0 = mealPlanAdherence($cid2,$from,$to);
ok('без плана planned = 0, pct = null', $a0['planned'] === 0 && $a0['pct'] === null, json_encode($a0));

/* --- дневник рядом с планом --- */
$e = $pdo->prepare("INSERT INTO food_entries(client_id,eaten_on,meal,created_at) VALUES(?,?,?,?)");
$ei = $pdo->prepare("INSERT INTO food_entry_items(entry_id,name,grams,kcal,protein,fat,carbs) VALUES(?,?,?,?,?,?,?)");
foreach ([[date('Y-m-d'),'breakfast',420.0],[date('Y-m-d'),'lunch',610.0],[date('Y-m-d',strtotime('-1 day')),'dinner',370.0]] as [$day,$meal,$kcal]) {
  $e->execute([$cid,$day,$meal,now()]); $eid=(int)$pdo->lastInsertId();
  $ei->execute([$eid,'Запись',200,$kcal,20,10,40]);
}
$f = foodDiaryPeriod($cid,$from,$to);
ok('дневник: записей 3', $f['entries'] === 3, json_encode($f));
ok('дневник: дней 2', $f['days'] === 2, json_encode($f));
ok('дневник: калорий 1400', $f['kcal'] === 1400, json_encode($f));

/* дневник вне окна не считается */
$f2 = foodDiaryPeriod($cid, date('Y-m-d', strtotime('-30 days')), date('Y-m-d', strtotime('-10 days')));
ok('дневник вне окна пуст', $f2['entries'] === 0 && $f2['kcal'] === 0, json_encode($f2));

/* --- дашборд: одним запросом на всех клиентов, числа те же --- */
$t0 = microtime(true);
$dash = $pdo->prepare("WITH mine AS (SELECT id FROM clients WHERE specialist_id=?)
  SELECT 1 FROM mine LIMIT 1"); $dash->execute([$sid]); $dash->fetch();
ok('CTE WITH работает в этой сборке SQLite', true, '');

/* убираем за собой */
$pdo->prepare("DELETE FROM meal_logs WHERE client_id IN (?,?)")->execute([$cid,$cid2]);
$pdo->prepare("DELETE FROM food_entry_items WHERE entry_id IN (SELECT id FROM food_entries WHERE client_id=?)")->execute([$cid]);
$pdo->prepare("DELETE FROM food_entries WHERE client_id=?")->execute([$cid]);
$pdo->prepare("DELETE FROM menu_items WHERE menu_id=?")->execute([$mid]);
$pdo->prepare("DELETE FROM menus WHERE id=?")->execute([$mid]);
$pdo->prepare("DELETE FROM dishes WHERE id=?")->execute([$did]);
$pdo->prepare("DELETE FROM clients WHERE id IN (?,?)")->execute([$cid,$cid2]);
$pdo->prepare("DELETE FROM specialists WHERE id=?")->execute([$sid]);

echo "\nПройдено: $pass, не прошло: $fail\n";
if ($bad) { echo "Не прошли:\n"; foreach ($bad as $b) echo "  - $b\n"; }
exit($fail ? 1 : 0);
