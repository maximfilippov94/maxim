<?php
namespace App\Controllers;

use App\Auth;
use App\HttpException;
use App\Request;

/**
 * Приём изображений (фото блюд, аватары специалистов).
 * Для MVP: base64 data-URL в JSON, сохранение в public/uploads/.
 * На проде заменяется на S3/облако без изменения контракта API.
 */
class UploadController extends Controller
{
    private const MAX_BYTES = 3_000_000;   // ~3 МБ на исходное изображение
    private const MIME_EXT = [
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif',
    ];

    public function image(Request $req): array
    {
        Auth::require($req, 'specialist');
        $data = (string)$req->input('data', '');

        if (!preg_match('#^data:([\w/+.-]+);base64,(.+)$#s', $data, $m)) {
            throw new HttpException('Ожидается data-URL с base64', 422);
        }
        $mime = strtolower($m[1]);
        if (!isset(self::MIME_EXT[$mime])) {
            throw new HttpException('Поддерживаются JPEG, PNG, WEBP, GIF', 422);
        }
        $bytes = base64_decode($m[2], true);
        if ($bytes === false) {
            throw new HttpException('Некорректный base64', 422);
        }
        if (strlen($bytes) > self::MAX_BYTES) {
            throw new HttpException('Файл больше 3 МБ', 413);
        }

        $dir = dirname(__DIR__, 2) . '/public/uploads';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $name = date('Ym') . '_' . bin2hex(random_bytes(8)) . '.' . self::MIME_EXT[$mime];
        if (file_put_contents($dir . '/' . $name, $bytes) === false) {
            throw new HttpException('Не удалось сохранить файл', 500);
        }
        return ['url' => '/uploads/' . $name];
    }
}
