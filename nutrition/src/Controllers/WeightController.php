<?php
namespace App\Controllers;

use App\Auth;
use App\Database;
use App\HttpException;
use App\Repo;
use App\Request;

/**
 * Замеры веса. Клиент вводит свои, специалист видит график клиента.
 */
class WeightController extends Controller
{
    public function clientList(Request $req): array
    {
        $auth = Auth::require($req, 'client');
        return $this->series($auth['id']);
    }

    public function clientAdd(Request $req): array
    {
        $auth = Auth::require($req, 'client');
        $this->require($req->body, ['weight_kg']);
        $weight = $this->num($req->input('weight_kg'));
        if ($weight <= 0 || $weight > 500) {
            throw new HttpException('Некорректный вес', 422);
        }
        $date = $req->input('measured_on') ?: date('Y-m-d');

        // Upsert по (client, date) — один замер в день.
        Database::exec(
            'INSERT INTO weight_logs (client_id, weight_kg, measured_on) VALUES (?, ?, ?)
             ON CONFLICT(client_id, measured_on) DO UPDATE SET weight_kg = excluded.weight_kg',
            [$auth['id'], $weight, (string)$date]
        );
        return $this->series($auth['id']);
    }

    /** Специалист смотрит график веса клиента. */
    public function specialistList(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $clientId = (int)$args['id'];
        Repo::clientOwnedBy($clientId, $auth['id']);
        return $this->series($clientId);
    }

    /** Специалист вносит замер веса клиента (например, со слов клиента на встрече). */
    public function specialistAdd(Request $req, array $args): array
    {
        $auth = Auth::require($req, 'specialist');
        $clientId = (int)$args['id'];
        Repo::clientOwnedBy($clientId, $auth['id']);
        $this->require($req->body, ['weight_kg']);
        $weight = $this->num($req->input('weight_kg'));
        if ($weight <= 0 || $weight > 500) {
            throw new HttpException('Некорректный вес', 422);
        }
        $date = $req->input('measured_on') ?: date('Y-m-d');
        Database::exec(
            'INSERT INTO weight_logs (client_id, weight_kg, measured_on) VALUES (?, ?, ?)
             ON CONFLICT(client_id, measured_on) DO UPDATE SET weight_kg = excluded.weight_kg',
            [$clientId, $weight, (string)$date]
        );
        return $this->series($clientId);
    }

    private function series(int $clientId): array
    {
        return [
            'items' => Database::all(
                'SELECT weight_kg, measured_on FROM weight_logs WHERE client_id = ? ORDER BY measured_on',
                [$clientId]
            ),
        ];
    }
}
