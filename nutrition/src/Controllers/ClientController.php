<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Repo;
use App\Request;

class ClientController extends Controller
{
    private const SEX = ['m', 'f'];
    private const ACTIVITY = ['low', 'medium', 'high'];

    /** Список клиентов специалиста: имя, цель, статус меню, непрочитанные. */
    public function index(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $search = trim((string)($req->query['q'] ?? ''));

        $sql = 'SELECT * FROM clients WHERE specialist_id = ?';
        $params = [$auth['id']];
        if ($search !== '') {
            $sql .= ' AND name LIKE ?';
            $params[] = '%' . $search . '%';
        }
        $sql .= ' ORDER BY created_at DESC';
        $clients = Database::all($sql, $params);

        foreach ($clients as &$c) {
            unset($c['password_hash']);
            $c['excluded_ingredients'] = $this->decodeJson($c['excluded_ingredients']);
            $c['unread_messages'] = (int)(Database::one(
                "SELECT COUNT(*) n FROM messages WHERE client_id = ? AND author_type = 'client' AND read_at IS NULL",
                [(int)$c['id']]
            )['n'] ?? 0);
            $lastMenu = Database::one(
                'SELECT status, title FROM menus WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
                [(int)$c['id']]
            );
            $c['menu_status'] = $lastMenu['status'] ?? null;
            $c['has_password'] = false; // не раскрываем хэш, но флаг полезен фронту
        }
        return ['items' => $clients];
    }

    public function show(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $client = Repo::clientOwnedBy((int)$args['id'], $auth['id']);
        unset($client['password_hash']);
        $client['excluded_ingredients'] = $this->decodeJson($client['excluded_ingredients']);
        $client['medical_flags'] = $this->decodeJson($client['medical_flags'] ?? null);
        $client['intake_completed'] = !empty($client['intake_completed_at']);
        $client['menus'] = Database::all(
            'SELECT id, title, start_date, days_count, status, published_at, created_at
             FROM menus WHERE client_id = ? ORDER BY created_at DESC',
            [(int)$client['id']]
        );
        return $client;
    }

    public function create(Request $req): array
    {
        $auth = Auth::require($req, 'specialist');
        $this->require($req->body, ['name']);
        $this->inList($req->input('sex'), self::SEX, 'sex');
        $this->inList($req->input('activity_level'), self::ACTIVITY, 'activity_level');

        $inviteToken = bin2hex(random_bytes(16));
        $id = Database::insert(
            'INSERT INTO clients
             (specialist_id, name, email, phone, invite_token, sex, birth_year, height_cm, weight_kg,
              activity_level, goal, target_kcal, target_protein, target_fat, target_carbs,
              excluded_ingredients, notes, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $auth['id'],
                trim((string)$req->input('name')),
                $this->normEmail($req->input('email')),
                $req->input('phone'),
                $inviteToken,
                $req->input('sex'),
                $req->input('birth_year') !== null ? (int)$req->input('birth_year') : null,
                $req->input('height_cm') !== null ? (int)$req->input('height_cm') : null,
                $req->input('weight_kg') !== null ? $this->num($req->input('weight_kg')) : null,
                $req->input('activity_level'),
                $req->input('goal'),
                $req->input('target_kcal') !== null ? (int)$req->input('target_kcal') : null,
                $req->input('target_protein') !== null ? $this->num($req->input('target_protein')) : null,
                $req->input('target_fat') !== null ? $this->num($req->input('target_fat')) : null,
                $req->input('target_carbs') !== null ? $this->num($req->input('target_carbs')) : null,
                json_encode($req->input('excluded_ingredients', []), JSON_UNESCAPED_UNICODE),
                $req->input('notes'),
                'active',
                $this->now(),
            ]
        );
        return $this->show($req, ['id' => $id]);
    }

    public function update(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        Repo::clientOwnedBy($id, $auth['id']);

        $this->inList($req->input('sex'), self::SEX, 'sex');
        $this->inList($req->input('activity_level'), self::ACTIVITY, 'activity_level');

        $textFields = ['name', 'email', 'phone', 'sex', 'activity_level', 'goal', 'notes', 'status'];
        $intFields = ['birth_year', 'height_cm', 'target_kcal'];
        $floatFields = ['weight_kg', 'target_protein', 'target_fat', 'target_carbs'];

        $set = [];
        $params = [];
        foreach ($textFields as $f) {
            if (array_key_exists($f, $req->body)) {
                $set[] = "$f = ?";
                $params[] = $f === 'email' ? $this->normEmail($req->input($f)) : $req->input($f);
            }
        }
        foreach ($intFields as $f) {
            if (array_key_exists($f, $req->body)) {
                $set[] = "$f = ?";
                $params[] = $req->input($f) !== null ? (int)$req->input($f) : null;
            }
        }
        foreach ($floatFields as $f) {
            if (array_key_exists($f, $req->body)) {
                $set[] = "$f = ?";
                $params[] = $req->input($f) !== null ? $this->num($req->input($f)) : null;
            }
        }
        if (array_key_exists('excluded_ingredients', $req->body)) {
            $set[] = 'excluded_ingredients = ?';
            $params[] = json_encode($req->input('excluded_ingredients', []), JSON_UNESCAPED_UNICODE);
        }
        if ($set) {
            $params[] = $id;
            Database::exec('UPDATE clients SET ' . implode(', ', $set) . ' WHERE id = ?', $params);
        }
        return $this->show($req, ['id' => $id]);
    }

    /** Получить/пересоздать инвайт-ссылку. */
    public function invite(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        $client = Repo::clientOwnedBy($id, $auth['id']);

        $token = $client['invite_token'];
        if (!empty($req->input('regenerate')) || empty($token)) {
            $token = bin2hex(random_bytes(16));
            Database::exec('UPDATE clients SET invite_token = ?, password_hash = NULL WHERE id = ?', [$token, $id]);
        }
        return [
            'invite_token' => $token,
            'invite_path'  => '/app/#/invite/' . $token,
        ];
    }

    public function delete(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $id = (int)$args['id'];
        Repo::clientOwnedBy($id, $auth['id']);
        // Мягкое удаление — статус archived, чтобы не терять историю меню.
        Database::exec("UPDATE clients SET status = 'archived' WHERE id = ?", [$id]);
        return ['ok' => true];
    }

    private function normEmail(mixed $email): ?string
    {
        if (!$email) {
            return null;
        }
        return strtolower(trim((string)$email));
    }

    private function decodeJson(?string $json): array
    {
        $v = json_decode((string)$json, true);
        return is_array($v) ? $v : [];
    }
}
