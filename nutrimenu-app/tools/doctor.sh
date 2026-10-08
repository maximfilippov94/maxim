#!/bin/sh
# Состояние проекта одной командой.
#
# Нужен потому, что разработка идёт в облаке, а запускается всё на Mac:
# я не вижу ни терминала, ни файлов на машине. Вопросы «а что говорит
# git pull», «а какая версия», «а точно ли доехало» по одному стоили
# целого вечера — здесь всё сразу, одним куском, который можно
# скопировать в переписку.
#
# Запуск из папки nutrimenu-app:
#   sh tools/doctor.sh
#
# Ничего не меняет и никуда не ходит, кроме git fetch.

cd "$(dirname "$0")/.." || exit 1

line() { printf '\n── %s\n' "$1"; }

printf '╔══════════════════════════════════════════╗\n'
printf '║  EQUA — состояние проекта                ║\n'
printf '╚══════════════════════════════════════════╝\n'
printf 'снято: %s\n' "$(date '+%d.%m.%Y %H:%M')"

line "Машина"
printf 'macOS:   %s\n' "$(sw_vers -productVersion 2>/dev/null || echo 'не macOS')"
printf 'node:    %s\n' "$(node -v 2>/dev/null || echo 'НЕТ')"
printf 'npm:     %s\n' "$(npm -v 2>/dev/null || echo 'НЕТ')"
xc=$(xcodebuild -version 2>/dev/null | head -1)
printf 'xcode:   %s\n' "${xc:-нет}"
printf 'папка:   %s\n' "$(pwd)"

line "Код"
printf 'ветка:   %s\n' "$(git branch --show-current 2>/dev/null)"
printf 'коммит:  %s\n' "$(git log --oneline -1 2>/dev/null)"

# Отстаём ли от того, что отправлено. Молча: сеть может быть занята.
br=$(git branch --show-current 2>/dev/null)
if git fetch origin "$br" >/dev/null 2>&1; then
  behind=$(git rev-list --count "HEAD..origin/$br" 2>/dev/null)
  if [ "${behind:-0}" -gt 0 ]; then
    printf 'ОТСТАЁТ на %s коммит(ов) — нужен git pull origin %s\n' "$behind" "$br"
  else
    printf 'свежий:  да\n'
  fi
else
  printf 'свежий:  не проверить (нет сети)\n'
fi

dirty=$(git status --short 2>/dev/null | head -5)
if [ -n "$dirty" ]; then
  printf 'правки на машине (помешают pull):\n%s\n' "$dirty"
fi

line "Зависимости"
if [ -d node_modules ]; then
  printf 'node_modules: есть\n'
  printf 'expo:    %s\n' "$(node -p "require('./node_modules/expo/package.json').version" 2>/dev/null || echo '?')"
  printf 'rn:      %s\n' "$(node -p "require('./node_modules/react-native/package.json').version" 2>/dev/null || echo '?')"
else
  printf 'node_modules: НЕТ — нужен npm install\n'
fi

line "Что отдаст приложение"
printf 'версия:  %s\n' "$(node -p "require('./app.json').expo.version" 2>/dev/null)"
printf 'значок:  %s\n' "$(node -p "require('./app.json').expo.icon" 2>/dev/null)"
printf 'сервер:  %s\n' "$(grep -o "'https://[^']*'" src/api.ts 2>/dev/null | head -1)"

line "Связь с боевым сервером"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 8 https://nutrimenu.ru/api/v1/config 2>/dev/null)
printf 'nutrimenu.ru: %s\n' "${code:-нет ответа}"

line "Кэш"
printf 'metro:   %s папок с кэшем\n' "$(ls -d "${TMPDIR}"metro-* 2>/dev/null | wc -l | tr -d ' ')"
printf 'сборка:  %s\n' "$([ -d dist ] && echo 'dist есть' || echo 'dist нет')"

printf '\n── Что делать, если что-то не так\n'
printf 'отстаёт        → git pull origin %s\n' "$br"
printf 'мешают правки  → git stash, потом pull\n'
printf 'нет модулей    → npm install\n'
printf 'старое на вид  → npx expo start --go --clear\n'
printf '\nСкопируйте всё, что выше, и пришлите в переписку.\n'
