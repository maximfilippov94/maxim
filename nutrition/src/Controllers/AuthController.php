<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Request;

class AuthController extends Controller
{
    // ---------- Специалист ----------

    public function registerSpecialist(Request $req): array
    {
        $this->require($req->body, ['email', 'password', 'name']);
        $email = strtolower(trim((string)$req->input('email')));
        $password = (string)$req->input('password');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpException('Некорректный email', 422);
        }
        if (strlen($password) < 6) {
            throw new HttpException('Пароль минимум 6 символов', 422);
        }

        $exists = Database::one('SELECT id FROM specialists WHERE email = ?', [$email]);
        if ($exists) {
            throw new HttpException('Email уже зарегистрирован', 409);
        }

        // Пробный период 14 дней.
        $trialExpires = gmdate('c', time() + 60 * 60 * 24 * 14);
        $id = Database::insert(
            'INSERT INTO specialists (email, password_hash, name, phone, plan, plan_expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                $email,
                password_hash($password, PASSWORD_DEFAULT),
                trim((string)$req->input('name')),
                $req->input('phone'),
                'trial',
                $trialExpires,
                $this->now(),
            ]
        );

        return $this->issue('specialist', $id);
    }

    public function loginSpecialist(Request $req): array
    {
        $this->require($req->body, ['email', 'password']);
        $email = strtolower(trim((string)$req->input('email')));

        $spec = Database::one('SELECT * FROM specialists WHERE email = ?', [$email]);
        if (!$spec || !password_verify((string)$req->input('password'), $spec['password_hash'])) {
            throw new HttpException('Неверный email или пароль', 401);
        }
        return $this->issue('specialist', (int)$spec['id']);
    }

    // ---------- Клиент ----------

    /** Клиент открывает инвайт-ссылку — узнаёт, нужно ли задать пароль, и видит своего специалиста. */
    public function inviteInfo(Request $req, array $args): array
    {
        $client = Database::one('SELECT id, name, password_hash, specialist_id FROM clients WHERE invite_token = ?', [$args['token']]);
        if (!$client) {
            throw new HttpException('Приглашение не найдено', 404);
        }
        $spec = Database::one(
            'SELECT name, photo_url, specialization, slug FROM specialists WHERE id = ?',
            [(int)$client['specialist_id']]
        );
        return [
            'name'          => $client['name'],
            'needs_password' => empty($client['password_hash']),
            'specialist'    => $spec ? [
                'name' => $spec['name'],
                'photo_url' => $spec['photo_url'],
                'specialization' => $spec['specialization'],
                'slug' => $spec['slug'],
            ] : null,
        ];
    }

    /** Первый вход по инвайту: клиент задаёт пароль. */
    public function acceptInvite(Request $req, array $args): array
    {
        $this->require($req->body, ['password']);
        $password = (string)$req->input('password');
        if (strlen($password) < 6) {
            throw new HttpException('Пароль минимум 6 символов', 422);
        }

        $client = Database::one('SELECT * FROM clients WHERE invite_token = ?', [$args['token']]);
        if (!$client) {
            throw new HttpException('Приглашение не найдено', 404);
        }
        if (!empty($client['password_hash'])) {
            throw new HttpException('Пароль уже задан, войдите обычным способом', 409);
        }

        Database::exec(
            'UPDATE clients SET password_hash = ? WHERE id = ?',
            [password_hash($password, PASSWORD_DEFAULT), (int)$client['id']]
        );
        return $this->issue('client', (int)$client['id']);
    }

    public function loginClient(Request $req): array
    {
        $this->require($req->body, ['email', 'password']);
        $email = strtolower(trim((string)$req->input('email')));

        $client = Database::one('SELECT * FROM clients WHERE email = ?', [$email]);
        if (!$client || empty($client['password_hash'])
            || !password_verify((string)$req->input('password'), $client['password_hash'])) {
            throw new HttpException('Неверный email или пароль', 401);
        }
        return $this->issue('client', (int)$client['id']);
    }

    // ---------- Общее ----------

    public function me(Request $req): array
    {
        $auth = Auth::require($req);
        return ['type' => $auth['type'], 'user' => $auth['user']];
    }

    public function logout(Request $req): array
    {
        $auth = Auth::require($req);
        Auth::revoke($auth['token']);
        return ['ok' => true];
    }

    private function issue(string $type, int $id): array
    {
        $ttl = $GLOBALS['config']['session_ttl'];
        $token = Auth::issueToken($type, $id, $ttl);

        $table = $type === 'specialist' ? 'specialists' : 'clients';
        $user = Database::one("SELECT * FROM {$table} WHERE id = ?", [$id]);
        unset($user['password_hash']);

        return ['token' => $token, 'type' => $type, 'user' => $user];
    }
}
