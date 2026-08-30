<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Request;

/**
 * Профиль нутрициолога: редактирование своей страницы + публичный каталог.
 */
class ProfileController extends Controller
{
    private const TRANSLIT = [
        'а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh','з'=>'z','и'=>'i',
        'й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t',
        'у'=>'u','ф'=>'f','х'=>'h','ц'=>'ts','ч'=>'ch','ш'=>'sh','щ'=>'sch','ъ'=>'','ы'=>'y','ь'=>'',
        'э'=>'e','ю'=>'yu','я'=>'ya',' '=>'-',
    ];

    /** Свой профиль (для редактора) + краткая статистика. */
    public function myProfile(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $spec = Database::one('SELECT * FROM specialists WHERE id = ?', [$auth['id']]);
        unset($spec['password_hash']);
        $spec['rating'] = $this->rating($auth['id']);
        $spec['clients_count'] = (int)(Database::one('SELECT COUNT(*) n FROM clients WHERE specialist_id = ? AND status != ?', [$auth['id'], 'archived'])['n'] ?? 0);
        return $spec;
    }

    public function updateProfile(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $fields = ['name', 'phone', 'bio', 'specialization', 'credentials', 'photo_url', 'city'];
        $set = [];
        $params = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $req->body)) { $set[] = "$f = ?"; $params[] = $req->input($f); }
        }
        foreach (['experience_years', 'price_from'] as $f) {
            if (array_key_exists($f, $req->body)) {
                $set[] = "$f = ?"; $params[] = $req->input($f) !== null && $req->input($f) !== '' ? (int)$req->input($f) : null;
            }
        }
        if (array_key_exists('is_listed', $req->body)) {
            $listed = $req->input('is_listed') ? 1 : 0;
            $set[] = 'is_listed = ?'; $params[] = $listed;
            // При включении витрины гарантируем slug.
            if ($listed) {
                $current = Database::one('SELECT slug, name FROM specialists WHERE id = ?', [$auth['id']]);
                if (empty($current['slug'])) {
                    $set[] = 'slug = ?'; $params[] = $this->uniqueSlug($current['name'], $auth['id']);
                }
            }
        }
        if ($set) {
            $params[] = $auth['id'];
            Database::exec('UPDATE specialists SET ' . implode(', ', $set) . ' WHERE id = ?', $params);
        }
        return $this->myProfile($req);
    }

    /** Публичный каталог: только согласившиеся (is_listed=1). Без авторизации. */
    public function catalog(Request $req): array
    {
        $q = trim((string)($req->query['q'] ?? ''));
        $city = trim((string)($req->query['city'] ?? ''));

        $sql = 'SELECT s.id, s.name, s.slug, s.photo_url, s.specialization, s.city,
                       s.experience_years, s.price_from, s.bio,
                       (SELECT AVG(rating) FROM reviews r WHERE r.specialist_id = s.id) AS avg_rating,
                       (SELECT COUNT(*) FROM reviews r WHERE r.specialist_id = s.id) AS reviews_count
                FROM specialists s
                WHERE s.is_listed = 1 AND s.slug IS NOT NULL';
        $params = [];
        if ($q !== '') { $sql .= ' AND (s.name LIKE ? OR s.specialization LIKE ?)'; $params[] = "%$q%"; $params[] = "%$q%"; }
        if ($city !== '') { $sql .= ' AND s.city = ?'; $params[] = $city; }
        // Сортировка: сперва с рейтингом, по убыванию (портативно для SQLite и PG).
        $sql .= ' ORDER BY (avg_rating IS NULL), avg_rating DESC, reviews_count DESC, s.name LIMIT 100';

        $rows = Database::all($sql, $params);
        foreach ($rows as &$r) {
            $r['avg_rating'] = $r['avg_rating'] !== null ? round((float)$r['avg_rating'], 1) : null;
            $r['reviews_count'] = (int)$r['reviews_count'];
            $r['bio'] = $r['bio'] ? mb_substr($r['bio'], 0, 140) : null;
        }
        return ['items' => $rows];
    }

    /** Публичная страница специалиста по slug. Без авторизации. */
    public function publicProfile(Request $req, array $args): array
    {
        $spec = Database::one(
            'SELECT id, name, slug, photo_url, bio, specialization, credentials, city, experience_years, price_from
             FROM specialists WHERE slug = ? AND is_listed = 1',
            [$args['slug']]
        );
        if (!$spec) {
            throw new HttpException('Специалист не найден', 404);
        }
        $spec['rating'] = $this->rating((int)$spec['id']);
        $spec['reviews'] = Database::all(
            'SELECT r.rating, r.body, r.created_at, c.name AS client_name
             FROM reviews r JOIN clients c ON c.id = r.client_id
             WHERE r.specialist_id = ? ORDER BY r.created_at DESC LIMIT 50',
            [(int)$spec['id']]
        );
        // Скрываем фамилию клиента в публичных отзывах — только имя + инициал.
        foreach ($spec['reviews'] as &$rv) {
            $rv['client_name'] = $this->shortName($rv['client_name']);
        }
        unset($spec['id']);
        return $spec;
    }

    public function cities(Request $req): array
    {
        $rows = Database::all("SELECT DISTINCT city FROM specialists WHERE is_listed = 1 AND city IS NOT NULL AND city != '' ORDER BY city");
        return ['cities' => array_column($rows, 'city')];
    }

    // ---------- helpers ----------

    private function rating(int $specialistId): array
    {
        $row = Database::one('SELECT AVG(rating) avg, COUNT(*) cnt FROM reviews WHERE specialist_id = ?', [$specialistId]);
        return [
            'average' => $row['avg'] !== null ? round((float)$row['avg'], 1) : null,
            'count'   => (int)($row['cnt'] ?? 0),
        ];
    }

    private function shortName(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        if (count($parts) > 1) {
            return $parts[0] . ' ' . mb_substr($parts[1], 0, 1) . '.';
        }
        return $parts[0] ?? '';
    }

    private function uniqueSlug(string $name, int $specialistId): string
    {
        $base = $this->slugify($name) ?: 'nutri';
        $slug = $base;
        $i = 1;
        while (true) {
            $exists = Database::one('SELECT id FROM specialists WHERE slug = ? AND id != ?', [$slug, $specialistId]);
            if (!$exists) return $slug;
            $slug = $base . '-' . (++$i);
        }
    }

    private function slugify(string $name): string
    {
        $name = mb_strtolower(trim($name));
        $out = '';
        $len = mb_strlen($name);
        for ($i = 0; $i < $len; $i++) {
            $ch = mb_substr($name, $i, 1);
            if (isset(self::TRANSLIT[$ch])) $out .= self::TRANSLIT[$ch];
            elseif (preg_match('/[a-z0-9]/', $ch)) $out .= $ch;
            elseif ($ch === '-' || $ch === '_') $out .= '-';
        }
        $out = preg_replace('/-+/', '-', trim($out, '-'));
        return $out;
    }
}
