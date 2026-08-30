<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Request;

/**
 * Обратная связь тестировщиков MVP. Отправка доступна любому (в т.ч. без входа),
 * чтение — только владельцу через админ-панель.
 */
class FeedbackController extends Controller
{
    public function submit(Request $req): array
    {
        // Необязательная авторизация — прикрепляем пользователя, если вошёл.
        $userType = 'anon'; $userId = null; $userName = null;
        if ($req->bearer) {
            $session = Database::one('SELECT user_type, user_id FROM sessions WHERE token = ?', [$req->bearer]);
            if ($session) {
                $userType = $session['user_type'];
                $userId = (int)$session['user_id'];
                $table = ['specialist' => 'specialists', 'client' => 'clients', 'admin' => 'admins'][$userType] ?? null;
                if ($table) {
                    $u = Database::one("SELECT name FROM {$table} WHERE id = ?", [$userId]);
                    $userName = $u['name'] ?? null;
                }
            }
        }

        $rating = $req->input('rating') !== null ? (int)$req->input('rating') : null;
        if ($rating !== null && ($rating < 1 || $rating > 5)) {
            throw new HttpException('Оценка от 1 до 5', 422);
        }
        // Хотя бы что-то должно быть заполнено.
        $anyText = trim((string)$req->input('liked')) . trim((string)$req->input('unclear'))
                 . trim((string)$req->input('suggest')) . trim((string)$req->input('missing'));
        if ($anyText === '' && $rating === null) {
            throw new HttpException('Заполните хотя бы одно поле или поставьте оценку', 422);
        }

        Database::insert(
            'INSERT INTO feedback (user_type, user_id, user_name, liked, unclear, suggest, missing, rating, page, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $userType, $userId, $userName,
                $req->input('liked'), $req->input('unclear'), $req->input('suggest'), $req->input('missing'),
                $rating, $req->input('page'), gmdate('c'),
            ]
        );
        return ['ok' => true];
    }

    public function adminList(Request $req): array
    {
        Auth::require($req, 'admin');
        $limit = min(200, max(5, (int)($req->query['limit'] ?? 100)));
        $rows = Database::all("SELECT * FROM feedback ORDER BY created_at DESC LIMIT $limit");
        $avg = Database::one('SELECT AVG(rating) a, COUNT(*) c FROM feedback WHERE rating IS NOT NULL');
        return [
            'items' => $rows,
            'total' => (int)($avg['c'] ?? 0),
            'avg_rating' => $avg['a'] !== null ? round((float)$avg['a'], 1) : null,
        ];
    }
}
