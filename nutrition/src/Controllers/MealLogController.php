<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Request;

class MealLogController extends Controller
{
    private const STATUS = ['eaten', 'skipped', 'replaced'];

    /** Клиент отмечает пункт меню. Upsert по menu_item_id. */
    public function log(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'client');
        $this->require($req->body, ['status']);
        $this->inList($req->input('status'), self::STATUS, 'status');

        $itemId = (int)$args['item_id'];
        // Пункт должен принадлежать опубликованному меню этого клиента.
        $item = Database::one(
            'SELECT mi.id, m.client_id, m.status
             FROM menu_items mi JOIN menus m ON m.id = mi.menu_id
             WHERE mi.id = ?',
            [$itemId]
        );
        if (!$item || (int)$item['client_id'] !== $auth['id']) {
            throw new HttpException('Пункт меню не найден', 404);
        }
        if ($item['status'] !== 'published') {
            throw new HttpException('Меню недоступно', 403);
        }

        $existing = Database::one('SELECT id FROM meal_logs WHERE menu_item_id = ?', [$itemId]);
        if ($existing) {
            Database::exec(
                'UPDATE meal_logs SET status = ?, comment = ?, logged_at = ? WHERE menu_item_id = ?',
                [$req->input('status'), $req->input('comment'), $this->now(), $itemId]
            );
        } else {
            Database::insert(
                'INSERT INTO meal_logs (menu_item_id, client_id, status, comment, logged_at) VALUES (?, ?, ?, ?, ?)',
                [$itemId, $auth['id'], $req->input('status'), $req->input('comment'), $this->now()]
            );
        }
        return ['ok' => true, 'menu_item_id' => $itemId, 'status' => $req->input('status')];
    }

    public function delete(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'client');
        $itemId = (int)$args['item_id'];
        Database::exec('DELETE FROM meal_logs WHERE menu_item_id = ? AND client_id = ?', [$itemId, $auth['id']]);
        return ['ok' => true];
    }
}
