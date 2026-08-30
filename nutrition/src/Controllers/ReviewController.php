<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Request;

/**
 * Отзывы клиентов о своём нутрициологе. Отзыв может оставить только клиент
 * и только про своего специалиста (upsert — один отзыв на пару).
 */
class ReviewController extends Controller
{
    /** Мой отзыв о своём специалисте (для формы «оставить/изменить»). */
    public function mine(Request $req): array
    {
        $auth = Auth::require($req, 'client');
        $client = Database::one('SELECT specialist_id FROM clients WHERE id = ?', [$auth['id']]);
        $review = Database::one(
            'SELECT rating, body, created_at FROM reviews WHERE specialist_id = ? AND client_id = ?',
            [(int)$client['specialist_id'], $auth['id']]
        );
        $spec = Database::one('SELECT name, slug, photo_url FROM specialists WHERE id = ?', [(int)$client['specialist_id']]);
        return ['review' => $review, 'specialist' => $spec];
    }

    public function upsert(Request $req): array
    {
        $auth = Auth::require($req, 'client');
        $this->require($req->body, ['rating']);
        $rating = (int)$req->input('rating');
        if ($rating < 1 || $rating > 5) {
            throw new HttpException('Оценка от 1 до 5', 422);
        }
        $client = Database::one('SELECT specialist_id FROM clients WHERE id = ?', [$auth['id']]);
        $specId = (int)$client['specialist_id'];
        $body = $req->input('body');

        $existing = Database::one('SELECT id FROM reviews WHERE specialist_id = ? AND client_id = ?', [$specId, $auth['id']]);
        if ($existing) {
            Database::exec('UPDATE reviews SET rating = ?, body = ?, created_at = ? WHERE id = ?',
                [$rating, $body, gmdate('c'), (int)$existing['id']]);
        } else {
            Database::insert('INSERT INTO reviews (specialist_id, client_id, rating, body, created_at) VALUES (?, ?, ?, ?, ?)',
                [$specId, $auth['id'], $rating, $body, gmdate('c')]);
        }
        return ['ok' => true];
    }

    public function delete(Request $req): array
    {
        $auth = Auth::require($req, 'client');
        Database::exec('DELETE FROM reviews WHERE client_id = ?', [$auth['id']]);
        return ['ok' => true];
    }
}
