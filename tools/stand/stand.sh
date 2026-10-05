#!/usr/bin/env sh
# Поднимает стенд веба и гоняет проверки.
#   WEB=/путь/к/public_html sh tools/stand/stand.sh
# Каталог сайта в репозиторий не входит — его разворачивают из архива
# поставки, а config/config.php кладут отдельно: в поставке его нет.
set -eu
[ -n "${WEB:-}" ] || { echo "Укажите каталог сайта: WEB=/путь/к/public_html sh $0"; exit 2; }
[ -d "$WEB" ] || { echo "Нет каталога $WEB"; exit 2; }
[ -f "$WEB/config/config.php" ] || { echo "Нет $WEB/config/config.php — без него стенд не поднимется"; exit 2; }
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PORT="${PORT:-8099}"
BASE="http://127.0.0.1:$PORT"

echo "== Проверки поставки (lint + инварианты выпуска) =="
sh "$WEB/qa/preflight.sh"

echo
echo "== Миграции с нуля =="
# Стенд поднимаем на своей базе, боевую не трогаем.
php -r 'require getenv("WEB")."/config/config.php"; printf("таблиц: %d\n", db()->query("SELECT count(*) FROM sqlite_master WHERE type=\"table\"")->fetchColumn());'

echo
echo "== Питание от плана и дневник =="
php "$HERE/plan-test.php"

echo
echo "== API по HTTP =="
cp "$HERE/_router.php" "$WEB/_router.php"
php -S "127.0.0.1:$PORT" -t "$WEB" "$WEB/_router.php" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true; rm -f "$WEB/_router.php"' EXIT INT TERM
sleep 2
BASE="$BASE" php "$HERE/api-test.php"

echo
echo "Проверки пройдены."
