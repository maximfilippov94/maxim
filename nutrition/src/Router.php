<?php
namespace App;

/**
 * Минималистичный роутер (~100 строк). Поддерживает параметры в пути
 * вида /clients/{id}. Обработчик — [ControllerClass::class, 'method'].
 */
class Router
{
    /** @var array<int, array{method:string, regex:string, params:array, handler:callable|array}> */
    private array $routes = [];

    public function add(string $method, string $pattern, array|callable $handler): void
    {
        $params = [];
        $regex = preg_replace_callback('/\{(\w+)\}/', function ($m) use (&$params) {
            $params[] = $m[1];
            return '([^/]+)';
        }, $pattern);

        $this->routes[] = [
            'method'  => strtoupper($method),
            'regex'   => '#^' . $regex . '$#',
            'params'  => $params,
            'handler' => $handler,
        ];
    }

    public function get(string $p, array|callable $h): void    { $this->add('GET', $p, $h); }
    public function post(string $p, array|callable $h): void   { $this->add('POST', $p, $h); }
    public function put(string $p, array|callable $h): void    { $this->add('PUT', $p, $h); }
    public function patch(string $p, array|callable $h): void  { $this->add('PATCH', $p, $h); }
    public function delete(string $p, array|callable $h): void { $this->add('DELETE', $p, $h); }

    public function dispatch(Request $req): void
    {
        // CORS preflight — фронт (PWA) и нативное приложение ходят с другого origin.
        if ($req->method === 'OPTIONS') {
            $this->cors();
            http_response_code(204);
            exit;
        }
        $this->cors();

        $pathMatched = false;

        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $req->path, $matches)) {
                continue;
            }
            $pathMatched = true;
            if ($route['method'] !== $req->method) {
                continue;
            }

            array_shift($matches);
            $args = array_combine($route['params'], $matches) ?: [];

            try {
                $handler = $route['handler'];
                if (is_array($handler)) {
                    [$class, $action] = $handler;
                    $controller = new $class();
                    $result = $controller->$action($req, $args);
                } else {
                    $result = $handler($req, $args);
                }
                if ($result !== null) {
                    Response::json($result);
                }
                return;
            } catch (HttpException $e) {
                Response::error($e->getMessage(), $e->status);
            } catch (\Throwable $e) {
                $config = $GLOBALS['config'] ?? ['env' => 'prod'];
                if (($config['env'] ?? 'prod') === 'dev') {
                    Response::error($e->getMessage(), 500, [
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                    ]);
                }
                Response::error('Internal server error', 500);
            }
        }

        if ($pathMatched) {
            Response::error('Method not allowed', 405);
        }
        Response::error('Not found', 404);
    }

    private function cors(): void
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
    }
}
