<?php
namespace App;

/**
 * Исключение с HTTP-статусом — бросается из контроллеров,
 * ловится роутером и превращается в аккуратный JSON-ответ.
 */
class HttpException extends \RuntimeException
{
    public int $status;

    public function __construct(string $message, int $status = 400)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}
