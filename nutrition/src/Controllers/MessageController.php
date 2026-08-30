<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\Repo;
use App\Request;

/**
 * Чат специалист <-> клиент. Одна нить сообщений на клиента.
 */
class MessageController extends Controller
{
    /** Специалист читает переписку с конкретным клиентом. */
    public function specialistList(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $clientId = (int)$args['id'];
        Repo::clientOwnedBy($clientId, $auth['id']);

        // Пометить сообщения клиента прочитанными.
        Database::exec(
            "UPDATE messages SET read_at = ? WHERE client_id = ? AND author_type = 'client' AND read_at IS NULL",
            [$this->now(), $clientId]
        );
        return $this->thread($clientId);
    }

    public function specialistSend(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $clientId = (int)$args['id'];
        Repo::clientOwnedBy($clientId, $auth['id']);
        return $this->send($clientId, 'specialist', (string)$req->input('body'));
    }

    /** Клиент читает свою переписку. */
    public function clientList(Request $req): array
    {
        $auth = Auth::require($req, 'client');
        Database::exec(
            "UPDATE messages SET read_at = ? WHERE client_id = ? AND author_type = 'specialist' AND read_at IS NULL",
            [$this->now(), $auth['id']]
        );
        return $this->thread($auth['id']);
    }

    public function clientSend(Request $req): array
    {
        $auth = Auth::require($req, 'client');
        return $this->send($auth['id'], 'client', (string)$req->input('body'));
    }

    private function send(int $clientId, string $authorType, string $body): array
    {
        $body = trim($body);
        if ($body === '') {
            throw new \App\HttpException('Пустое сообщение', 422);
        }
        $id = Database::insert(
            'INSERT INTO messages (client_id, author_type, body, created_at) VALUES (?, ?, ?, ?)',
            [$clientId, $authorType, $body, $this->now()]
        );
        return Database::one('SELECT * FROM messages WHERE id = ?', [$id]);
    }

    private function thread(int $clientId): array
    {
        return [
            'items' => Database::all(
                'SELECT id, author_type, body, read_at, created_at FROM messages WHERE client_id = ? ORDER BY created_at, id',
                [$clientId]
            ),
        ];
    }
}
