<?php
namespace App;

/**
 * Разбор входящего HTTP-запроса.
 */
class Request
{
    public string $method;
    public string $path;
    public array $query;
    public array $body;
    public ?string $bearer;

    public function __construct()
    {
        $this->method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $this->query = $_GET ?? [];

        // Shared-hosting fallback: the frontend can call
        // /index.php?route=/api/v1/... when Apache rewrite rules are unavailable.
        // In that case REQUEST_URI is /index.php, so the router must use the
        // explicit route query parameter instead of the script path.
        $route = $this->query['route'] ?? null;
        if (is_string($route) && $route !== '') {
            $this->path = rtrim(parse_url($route, PHP_URL_PATH) ?: '/', '/') ?: '/';
        } else {
            $this->path = rtrim(parse_url($uri, PHP_URL_PATH) ?: '/', '/') ?: '/';
        }

        $raw = file_get_contents('php://input') ?: '';
        $decoded = json_decode($raw, true);
        $this->body = is_array($decoded) ? $decoded : [];

        $this->bearer = self::extractBearer();
    }

    private static function extractBearer(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if ($header === '' && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $header = $headers['Authorization'] ?? '';
        }
        if (preg_match('/Bearer\s+(\S+)/i', $header, $m)) {
            return $m[1];
        }
        return null;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }
}
