# Web Performance Audit Agent

Source: Cloudflare Team · awesome-agent-skills · web-perf

## When to Use
Activate when: медленная загрузка, плохой PageSpeed score, Core Web Vitals, LCP/CLS/INP проблемы, render-blocking ресурсы, оптимизация изображений, кэширование.

## Core Web Vitals Targets
| Метрика | Хорошо | Нужно улучшить | Плохо |
|---------|--------|----------------|-------|
| LCP (загрузка главного контента) | < 2.5s | 2.5–4s | > 4s |
| INP (отклик на взаимодействие) | < 200ms | 200–500ms | > 500ms |
| CLS (сдвиг макета) | < 0.1 | 0.1–0.25 | > 0.25 |

## Audit Checklist

### Images (самое большое влияние)
- [ ] Формат WebP/AVIF (не JPEG/PNG)
- [ ] `width` и `height` атрибуты на всех `<img>` (предотвращает CLS)
- [ ] `loading="lazy"` на все below-fold изображения
- [ ] Hero image — НЕ lazy, preload: `<link rel="preload" as="image">`
- [ ] Responsive images: `srcset` и `sizes` атрибуты
- [ ] Сжатие изображений (TinyPNG, Squoosh)

### CSS & Fonts
- [ ] Нет render-blocking CSS в `<head>` без `media` атрибута
- [ ] Google Fonts: добавить `&display=swap` к URL
- [ ] `<link rel="preconnect">` для внешних доменов (fonts.googleapis.com)
- [ ] Critical CSS inline в `<head>`, остальное defer
- [ ] Минификация CSS

### JavaScript
- [ ] `defer` или `async` на все внешние скрипты
- [ ] Яндекс.Метрика: async ✅ (уже есть)
- [ ] Нет блокирующих скриптов в `<head>`
- [ ] Минификация JS

### Server & Caching
- [ ] Gzip/Brotli сжатие на сервере
- [ ] Cache-Control заголовки для статики (CSS/JS/images)
- [ ] `Expires` или `max-age` для assets
- [ ] HTTP/2 включён на сервере

### PHP-Specific
- [ ] OPcache включён (кэш PHP байт-кода)
- [ ] SQLite запросы оптимизированы (индексы на is_active, sort_order)
- [ ] Нет N+1 запросов к БД
- [ ] Output buffering включён

### Mobile Performance
- [ ] Нет горизонтальных прокруток (overflow-x)
- [ ] Touch targets ≥ 44×44px
- [ ] Шрифты не слишком мелкие (≥ 16px для основного текста)
- [ ] Viewport meta правильный

## Инструменты для проверки
- **PageSpeed Insights**: pagespeed.web.dev
- **WebPageTest**: webpagetest.org
- **GTmetrix**: gtmetrix.com
- **Chrome DevTools**: Performance tab, Lighthouse

## Быстрые победы для LUKA OUTDOOR

### Уже сделано ✅
- `loading="lazy"` на изображения + IntersectionObserver fade
- `preconnect` для Google Fonts
- WebP формат изображений
- `async` на Яндекс.Метрику

### Нужно проверить ⚠️
- `width`/`height` атрибуты на `<img>` — предотвращает CLS
- Hero image preload (`<link rel="preload">`)
- Gzip на сервере (apache/nginx config)
- Cache-Control заголовки для assets
- OPcache на хостинге
- SQLite индексы: `CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active, sort_order)`

## Workflow
1. Запустить PageSpeed Insights на главной, каталоге и товарной странице
2. Зафиксировать baseline метрики
3. Исправить по приоритету: Images → JS → CSS → Server
4. Повторно проверить, сравнить с baseline
