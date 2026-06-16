<?php
/**
 * add_categories.php — LUKA OUTDOOR
 * Запусти один раз: https://lukaoutdoor.com/add_categories.php
 * После запуска УДАЛИ этот файл с сервера!
 */
require __DIR__.'/includes/db.php';
$pdo = db();

// Миграция
try{$pdo->exec("ALTER TABLE categories ADD COLUMN parent_id INTEGER DEFAULT NULL");}catch(Exception $e){}
try{$pdo->exec("ALTER TABLE categories ADD COLUMN image TEXT DEFAULT ''");}catch(Exception $e){}

// Удаляем старые тестовые категории (Аксессуары, Комплекты — оставляем только если нужны)
// Обновляем существующие или создаём новые

$structure = [
    ['name'=>'Костровые системы', 'slug'=>'fire-systems', 'sort'=>10, 'subs'=>[
        ['name'=>'Костровые чаши', 'slug'=>'fire-bowls', 'sort'=>10],
        ['name'=>'Решётки', 'slug'=>'grill-grates', 'sort'=>20],
        ['name'=>'Подставки', 'slug'=>'stands', 'sort'=>30],
    ]],
    ['name'=>'Одежда', 'slug'=>'odezhda', 'sort'=>20, 'subs'=>[
        ['name'=>'Худи', 'slug'=>'hudi', 'sort'=>10],
        ['name'=>'Футболки', 'slug'=>'futbolki', 'sort'=>20],
        ['name'=>'Шапки', 'slug'=>'shapki', 'sort'=>30],
        ['name'=>'Носки', 'slug'=>'noski', 'sort'=>40],
    ]],
    ['name'=>'Сумки и рюкзаки', 'slug'=>'bags', 'sort'=>30, 'subs'=>[
        ['name'=>'Рюкзаки', 'slug'=>'ryukzaki', 'sort'=>10],
        ['name'=>'Поясные сумки', 'slug'=>'belt-bags', 'sort'=>20],
        ['name'=>'Шоперы', 'slug'=>'shopers', 'sort'=>30],
    ]],
    ['name'=>'Посуда и кухня', 'slug'=>'kitchen', 'sort'=>40, 'subs'=>[
        ['name'=>'Кружки', 'slug'=>'kruzhki', 'sort'=>10],
        ['name'=>'Термосы', 'slug'=>'thermos', 'sort'=>20],
        ['name'=>'Посуда для готовки', 'slug'=>'cookware', 'sort'=>30],
    ]],
    ['name'=>'Инструменты и аксессуары', 'slug'=>'tools', 'sort'=>50, 'subs'=>[
        ['name'=>'Ножи', 'slug'=>'nozhi', 'sort'=>10],
        ['name'=>'Карабины', 'slug'=>'karabiny', 'sort'=>20],
        ['name'=>'Аксессуары', 'slug'=>'accessories', 'sort'=>30],
    ]],
    ['name'=>'Освещение', 'slug'=>'lighting', 'sort'=>60, 'subs'=>[
        ['name'=>'Фонари', 'slug'=>'fonari', 'sort'=>10],
        ['name'=>'Налобные фонари', 'slug'=>'headlamps', 'sort'=>20],
        ['name'=>'Лампы', 'slug'=>'lampy', 'sort'=>30],
    ]],
    ['name'=>'Текстиль и комфорт', 'slug'=>'textile', 'sort'=>70, 'subs'=>[
        ['name'=>'Пледы', 'slug'=>'pledy', 'sort'=>10],
        ['name'=>'Подушки', 'slug'=>'podushki', 'sort'=>20],
        ['name'=>'Полотенца', 'slug'=>'polotentsa', 'sort'=>30],
    ]],
    ['name'=>'Хранение и органайзеры', 'slug'=>'storage', 'sort'=>80, 'subs'=>[
        ['name'=>'Органайзеры', 'slug'=>'organajzery', 'sort'=>10],
        ['name'=>'Гермомешки', 'slug'=>'hermomeshki', 'sort'=>20],
        ['name'=>'Чехлы', 'slug'=>'chekhly', 'sort'=>30],
    ]],
    ['name'=>'Для путешествий', 'slug'=>'travel', 'sort'=>90, 'subs'=>[
        ['name'=>'Дорожные сумки', 'slug'=>'travel-bags', 'sort'=>10],
        ['name'=>'Бутылки', 'slug'=>'butylki', 'sort'=>20],
        ['name'=>'Аксессуары в дорогу', 'slug'=>'travel-accessories', 'sort'=>30],
    ]],
    ['name'=>'Патчи и брендирование', 'slug'=>'patches', 'sort'=>100, 'subs'=>[
        ['name'=>'Патчи', 'slug'=>'patchi', 'sort'=>10],
        ['name'=>'Стикеры', 'slug'=>'stikery', 'sort'=>20],
        ['name'=>'Бирки', 'slug'=>'birki', 'sort'=>30],
    ]],
];

$added = 0;
$updated = 0;

foreach($structure as $cat) {
    // Ищем существующую по slug
    $st = $pdo->prepare("SELECT id FROM categories WHERE slug=?");
    $st->execute([$cat['slug']]);
    $existing = $st->fetchColumn();

    if($existing) {
        $pdo->prepare("UPDATE categories SET name=?,sort_order=?,is_active=1,parent_id=NULL WHERE id=?")
            ->execute([$cat['name'], $cat['sort'], $existing]);
        $parentId = $existing;
        $updated++;
    } else {
        $pdo->prepare("INSERT INTO categories(name,slug,sort_order,is_active,parent_id) VALUES(?,?,?,1,NULL)")
            ->execute([$cat['name'], $cat['slug'], $cat['sort']]);
        $parentId = (int)$pdo->lastInsertId();
        $added++;
    }

    // Подкатегории
    foreach($cat['subs'] as $sub) {
        $st2 = $pdo->prepare("SELECT id FROM categories WHERE slug=?");
        $st2->execute([$sub['slug']]);
        $existingSub = $st2->fetchColumn();

        if($existingSub) {
            $pdo->prepare("UPDATE categories SET name=?,sort_order=?,is_active=1,parent_id=? WHERE id=?")
                ->execute([$sub['name'], $sub['sort'], $parentId, $existingSub]);
            $updated++;
        } else {
            $pdo->prepare("INSERT INTO categories(name,slug,sort_order,is_active,parent_id) VALUES(?,?,?,1,?)")
                ->execute([$sub['name'], $sub['slug'], $sub['sort'], $parentId]);
            $added++;
        }
    }
}

$total = (int)$pdo->query("SELECT COUNT(*) FROM categories")->fetchColumn();

echo "<pre style='font-family:monospace;padding:20px'>";
echo "✓ Готово!\n\n";
echo "Добавлено: $added\n";
echo "Обновлено: $updated\n";
echo "Всего категорий в БД: $total\n\n";
echo "⚠️ УДАЛИ ЭТОТ ФАЙЛ С СЕРВЕРА!\n";
echo "rm /home/v/volgasmoke/public_html/add_categories.php\n";
echo "</pre>";
