<?php
namespace App\Controllers;

use App\HttpException;

/**
 * База для контроллеров: валидация и мелкие хелперы.
 */
abstract class Controller
{
    protected function require(array $data, array $fields): void
    {
        foreach ($fields as $f) {
            if (!isset($data[$f]) || $data[$f] === '' || $data[$f] === null) {
                throw new HttpException("Поле '{$f}' обязательно", 422);
            }
        }
    }

    protected function inList(mixed $value, array $allowed, string $field): void
    {
        if ($value !== null && !in_array($value, $allowed, true)) {
            throw new HttpException("Недопустимое значение '{$field}'", 422);
        }
    }

    protected function num(mixed $v, float $default = 0.0): float
    {
        return is_numeric($v) ? (float)$v : $default;
    }

    protected function now(): string
    {
        return gmdate('c');
    }
}
