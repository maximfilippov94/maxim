<?php
/* Роутер встроенного сервера PHP: повторяет правила .htaccess.
   Только для локальной разработки, в поставку не идёт. */
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$root = __DIR__;

if (preg_match('~^/(?:config|migrations|tools|cron|storage|vendor)(?:/|$)~', $uri)) {
  http_response_code(403); echo 'Forbidden'; return true;
}
if (preg_match('~^/api/v1/(.*)$~', $uri, $m)) {
  $_SERVER['PATH_INFO'] = '/'.$m[1];
  $_SERVER['SCRIPT_NAME'] = '/api/index.php';
  require $root.'/api/index.php'; return true;
}
if ($uri === '/sitemap.xml') { require $root.'/sitemap.php'; return true; }
if (preg_match('~^/privacy/?$~', $uri)) { $_GET['d']='privacy'; require $root.'/legal.php'; return true; }
if (preg_match('~^/terms/?$~', $uri))   { $_GET['d']='terms';   require $root.'/legal.php'; return true; }
if (preg_match('~^/s/([a-z0-9-]+)/?$~i', $uri, $m)) { $_GET['slug']=$m[1]; require $root.'/specialist.php'; return true; }

$file = $root.$uri;
if ($uri !== '/' && is_file($file)) return false;
if (is_dir($file) && is_file($file.'/index.php')) { require $file.'/index.php'; return true; }
if ($uri === '/' ) { require $root.'/index.php'; return true; }
require $root.'/app/index.php'; return true;
