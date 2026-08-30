<?php
namespace App;

/**
 * Авторизация по Bearer-токену. Токены живут в таблице sessions,
 * а не в PHP-сессиях — нативное приложение с cookie-сессиями не подружится.
 */
class Auth
{
    /** Текущий аутентифицированный пользователь для запроса. */
    private static ?array $current = null;

    /** Выдать новый токен пользователю. */
    public static function issueToken(string $userType, int $userId, int $ttl): string
    {
        $token = bin2hex(random_bytes(32));
        $now = gmdate('c');
        $expires = gmdate('c', time() + $ttl);

        Database::insert(
            'INSERT INTO sessions (token, user_type, user_id, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?)',
            [$token, $userType, $userId, $expires, $now]
        );
        return $token;
    }

    /** Разлогинить (удалить токен). */
    public static function revoke(string $token): void
    {
        Database::exec('DELETE FROM sessions WHERE token = ?', [$token]);
    }

    /**
     * Требует валидный токен. Возвращает ['type' => ..., 'id' => ..., 'user' => [...]].
     * Бросает HttpException(401) если токена нет/протух.
     */
    public static function require(Request $req, ?string $type = null): array
    {
        if (self::$current !== null) {
            self::enforceType(self::$current, $type);
            return self::$current;
        }

        $token = $req->bearer;
        if (!$token) {
            throw new HttpException('Требуется авторизация', 401);
        }

        $session = Database::one('SELECT * FROM sessions WHERE token = ?', [$token]);
        if (!$session) {
            throw new HttpException('Недействительный токен', 401);
        }
        if (strtotime($session['expires_at']) < time()) {
            Database::exec('DELETE FROM sessions WHERE token = ?', [$token]);
            throw new HttpException('Сессия истекла', 401);
        }

        $table = ['specialist' => 'specialists', 'client' => 'clients', 'admin' => 'admins'][$session['user_type']] ?? 'clients';
        $user = Database::one("SELECT * FROM {$table} WHERE id = ?", [(int)$session['user_id']]);
        if (!$user) {
            throw new HttpException('Пользователь не найден', 401);
        }
        unset($user['password_hash']);

        self::$current = [
            'type'  => $session['user_type'],
            'id'    => (int)$session['user_id'],
            'user'  => $user,
            'token' => $token,
        ];

        self::enforceType(self::$current, $type);
        return self::$current;
    }

    private static function enforceType(array $current, ?string $type): void
    {
        if ($type !== null && $current['type'] !== $type) {
            throw new HttpException('Недостаточно прав', 403);
        }
    }
}
