<?php
declare(strict_types=1);

/**
 * Единая точка входа.
 *
 * Работает и как front-controller для API (/api/v1/*), и как роутер
 * встроенного сервера PHP (php -S ... public/index.php): статику отдаёт
 * сам сервер, всё остальное уходит в приложение.
 */

$root = dirname(__DIR__);

// --- Автозагрузчик (PSR-4-ish): App\Foo\Bar -> src/Foo/Bar.php ---
spl_autoload_register(function (string $class) use ($root) {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $rel = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = $root . '/src/' . $rel . '.php';
    if (is_file($file)) {
        require $file;
    }
});

use App\Auth;
use App\Controllers\AdminController;
use App\Controllers\AuthController;
use App\Controllers\ClientController;
use App\Controllers\ClientPortalController;
use App\Controllers\DishController;
use App\Controllers\FeedbackController;
use App\Controllers\IngredientController;
use App\Controllers\MealLogController;
use App\Controllers\MenuController;
use App\Controllers\MessageController;
use App\Controllers\ProfileController;
use App\Controllers\ReviewController;
use App\Controllers\ShoppingController;
use App\Controllers\UploadController;
use App\Controllers\WeightController;
use App\Database;
use App\Request;
use App\Response;
use App\Router;

$config = require $root . '/config.php';
$GLOBALS['config'] = $config;

$path = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/');

// Shared-hosting fallback: if mod_rewrite is unavailable, the frontend can call
// /index.php?route=/api/v1/... directly. Normalize that route here.
if (isset($_GET['route']) && is_string($_GET['route']) && $_GET['route'] !== '') {
    $path = rtrim(parse_url($_GET['route'], PHP_URL_PATH) ?: '/', '/');
}

// --- Публичная главная (лендинг) на корне — для всех SAPI ---
if ($path === '' || $path === '/') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/landing.html');
    exit;
}

// --- Встроенный сервер: реальные файлы отдаёт сам сервер ---
if (PHP_SAPI === 'cli-server') {
    $file = __DIR__ . $path;
    if ($path !== '' && !str_starts_with($path, '/api') && is_file($file)) {
        return false;
    }
}

// --- SPA-фолбэк: /app/<маршрут> без реального файла -> оболочка приложения ---
// (нужно и для встроенного сервера, и для Apache/nginx)
if (str_starts_with($path, '/app') && !str_starts_with($path, '/api')) {
    $file = __DIR__ . $path;
    if (!is_file($file)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile(__DIR__ . '/app/index.html');
        exit;
    }
    if (PHP_SAPI === 'cli-server') {
        return false; // встроенный сервер отдаст файл сам
    }
    // На Apache реальные файлы уже отданы правилом mod_rewrite; сюда доходим редко.
}

Database::init($config['db_path']);

$req = new Request();
$r = new Router();

// ---------------- API v1 ----------------
$api = '/api/v1';

// health
$r->get("$api/health", fn() => ['ok' => true, 'time' => gmdate('c')]);

// обратная связь тестировщиков (отправка — без обязательной авторизации)
$r->post("$api/feedback", [FeedbackController::class, 'submit']);
$r->get("$api/admin/feedback", [FeedbackController::class, 'adminList']);

// --- Публичный каталог нутрициологов (без авторизации) ---
$r->get("$api/catalog/cities", [ProfileController::class, 'cities']);
$r->get("$api/catalog",        [ProfileController::class, 'catalog']);
$r->get("$api/catalog/{slug}", [ProfileController::class, 'publicProfile']);

// --- Auth ---
$r->post("$api/auth/specialist/register", [AuthController::class, 'registerSpecialist']);
$r->post("$api/auth/specialist/login",    [AuthController::class, 'loginSpecialist']);
$r->post("$api/auth/client/login",        [AuthController::class, 'loginClient']);
$r->get("$api/invite/{token}",            [AuthController::class, 'inviteInfo']);
$r->post("$api/invite/{token}/accept",    [AuthController::class, 'acceptInvite']);
$r->get("$api/me",                        [AuthController::class, 'me']);
$r->post("$api/auth/logout",              [AuthController::class, 'logout']);

// --- Админ-панель владельца ---
$r->post("$api/admin/login",                 [AdminController::class, 'login']);
$r->get("$api/admin/stats",                  [AdminController::class, 'stats']);
$r->get("$api/admin/nutritionists",          [AdminController::class, 'nutritionists']);
$r->get("$api/admin/nutritionists/{id}",     [AdminController::class, 'nutritionist']);
$r->patch("$api/admin/nutritionists/{id}",   [AdminController::class, 'updateNutritionist']);
$r->get("$api/admin/users",                  [AdminController::class, 'users']);
$r->get("$api/admin/clients",                [AdminController::class, 'clients']);
$r->get("$api/admin/subscriptions",          [AdminController::class, 'subscriptions']);
$r->get("$api/admin/plans",                  [AdminController::class, 'plans']);
$r->get("$api/admin/payments/export",        [AdminController::class, 'paymentsExport']);
$r->get("$api/admin/payments",               [AdminController::class, 'payments']);
$r->get("$api/admin/reviews",                [AdminController::class, 'reviews']);
$r->post("$api/admin/reviews/{id}/moderate", [AdminController::class, 'moderateReview']);
$r->get("$api/admin/tickets",                [AdminController::class, 'tickets']);
$r->get("$api/admin/tickets/{id}",           [AdminController::class, 'ticket']);
$r->patch("$api/admin/tickets/{id}",         [AdminController::class, 'updateTicket']);
$r->get("$api/admin/food",                   [AdminController::class, 'foodModeration']);
$r->post("$api/admin/food/{id}/moderate",    [AdminController::class, 'moderateFood']);

// --- Профиль специалиста + загрузка изображений ---
$r->get("$api/profile",       [ProfileController::class, 'myProfile']);
$r->patch("$api/profile",     [ProfileController::class, 'updateProfile']);
$r->post("$api/uploads/image", [UploadController::class, 'image']);

// --- Ingredients (специалист) ---
$r->get("$api/ingredients/categories", [IngredientController::class, 'categories']);
$r->get("$api/ingredients",            [IngredientController::class, 'index']);
$r->post("$api/ingredients",           [IngredientController::class, 'create']);
$r->get("$api/ingredients/{id}",       [IngredientController::class, 'show']);
$r->patch("$api/ingredients/{id}",     [IngredientController::class, 'update']);
$r->delete("$api/ingredients/{id}",    [IngredientController::class, 'delete']);

// --- Dishes (специалист) ---
$r->get("$api/dishes",        [DishController::class, 'index']);
$r->post("$api/dishes",       [DishController::class, 'create']);
$r->get("$api/dishes/{id}",   [DishController::class, 'show']);
$r->patch("$api/dishes/{id}", [DishController::class, 'update']);
$r->delete("$api/dishes/{id}",[DishController::class, 'delete']);
$r->post("$api/dishes/{id}/favorite",   [DishController::class, 'favorite']);
$r->delete("$api/dishes/{id}/favorite", [DishController::class, 'unfavorite']);

// --- Clients (специалист) ---
$r->get("$api/clients",              [ClientController::class, 'index']);
$r->post("$api/clients",             [ClientController::class, 'create']);
$r->get("$api/clients/{id}",         [ClientController::class, 'show']);
$r->patch("$api/clients/{id}",       [ClientController::class, 'update']);
$r->delete("$api/clients/{id}",      [ClientController::class, 'delete']);
$r->post("$api/clients/{id}/invite", [ClientController::class, 'invite']);
$r->get("$api/clients/{id}/activity",  [ClientController::class, 'activity']);
$r->get("$api/clients/{id}/messages",  [MessageController::class, 'specialistList']);
$r->post("$api/clients/{id}/messages", [MessageController::class, 'specialistSend']);
$r->get("$api/clients/{id}/weight",    [WeightController::class, 'specialistList']);
$r->post("$api/clients/{id}/weight",   [WeightController::class, 'specialistAdd']);

// --- Menus (специалист-конструктор) ---
$r->get("$api/menus",                 [MenuController::class, 'index']);
$r->post("$api/menus",                [MenuController::class, 'create']);
$r->get("$api/menus/{id}",            [MenuController::class, 'show']);
$r->patch("$api/menus/{id}",          [MenuController::class, 'update']);
$r->delete("$api/menus/{id}",         [MenuController::class, 'delete']);
$r->post("$api/menus/{id}/publish",   [MenuController::class, 'publish']);
$r->post("$api/menus/{id}/duplicate", [MenuController::class, 'duplicate']);
$r->post("$api/menus/{id}/copy-day",  [MenuController::class, 'copyDay']);
$r->post("$api/menus/{id}/copy-meal", [MenuController::class, 'copyMeal']);
$r->get("$api/menus/{id}/shopping-list", [ShoppingController::class, 'list']);
$r->post("$api/menus/{id}/items",              [MenuController::class, 'addItem']);
$r->patch("$api/menus/{id}/items/{item_id}",   [MenuController::class, 'updateItem']);
$r->delete("$api/menus/{id}/items/{item_id}",  [MenuController::class, 'deleteItem']);

// --- Meal logs (клиент отмечает съеденное) ---
$r->post("$api/menu-items/{item_id}/log",   [MealLogController::class, 'log']);
$r->delete("$api/menu-items/{item_id}/log", [MealLogController::class, 'delete']);

// --- Кабинет клиента ---
$r->get("$api/me/intake",   [ClientPortalController::class, 'intake']);
$r->patch("$api/me/intake", [ClientPortalController::class, 'submitIntake']);
$r->get("$api/me/menus",    [ClientPortalController::class, 'menus']);
$r->get("$api/me/menu",     [ClientPortalController::class, 'activeMenu']);
$r->get("$api/me/progress", [ClientPortalController::class, 'progress']);
$r->get("$api/me/review",   [ReviewController::class, 'mine']);
$r->post("$api/me/review",  [ReviewController::class, 'upsert']);
$r->delete("$api/me/review",[ReviewController::class, 'delete']);
$r->get("$api/me/messages", [MessageController::class, 'clientList']);
$r->post("$api/me/messages",[MessageController::class, 'clientSend']);
$r->get("$api/me/weight",   [WeightController::class, 'clientList']);
$r->post("$api/me/weight",  [WeightController::class, 'clientAdd']);

$r->dispatch($req);
