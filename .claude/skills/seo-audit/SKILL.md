# SEO Audit Agent

Source: coreyhaines31/marketingskills · skills/seo-audit

## When to Use
Activate when: "SEO audit", ranking issues, traffic drop, indexation problems, technical SEO, sitemap, robots.txt, canonical, Core Web Vitals, meta tags, schema markup.

## Audit Priority Order
1. **Crawlability & Indexation** — Can search engines find and index your content?
2. **Technical Foundations** — Is the site fast and functional?
3. **On-Page Optimization** — Is content properly optimized?
4. **Content Quality** — Does it merit ranking?
5. **Authority & Links** — Does it have credibility?

## Critical Technical Checklist

### Crawlability
- [ ] robots.txt — не блокирует важные страницы
- [ ] XML sitemap существует и валиден (`/sitemap.xml`)
- [ ] Нет orphan pages (страницы без внутренних ссылок)
- [ ] Crawl budget не тратится на дубли/параметры

### Indexation
- [ ] Google Search Console — нет Coverage Errors
- [ ] `noindex` только на нужных страницах (checkout, admin)
- [ ] Canonical tags на всех страницах (self-referencing на уникальных)
- [ ] Нет redirect chains длиннее 1 хопа

### Core Web Vitals
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] INP (Interaction to Next Paint) < 200ms
- [ ] CLS (Cumulative Layout Shift) < 0.1

### On-Page
- [ ] `<title>` уникальный, 50-60 символов, содержит ключевое слово
- [ ] `<meta description>` уникальный, 150-160 символов
- [ ] H1 один на страницу, содержит главный запрос
- [ ] Структура заголовков H1→H2→H3 логична
- [ ] Alt-тексты на всех значимых изображениях
- [ ] Internal linking между связанными страницами

### Schema / Structured Data
- [ ] `Product` schema на страницах товаров (name, price, availability, rating)
- [ ] `BreadcrumbList` schema
- [ ] `Organization` schema на главной
- [ ] Проверка: Google Rich Results Test

### Canonicalization
- [ ] Все страницы имеют canonical
- [ ] HTTP → HTTPS redirect (301)
- [ ] www → non-www (или наоборот) redirect
- [ ] Trailing slash консистентный

### Mobile & Security
- [ ] Mobile-friendly (Google Mobile Test)
- [ ] HTTPS везде (HSTS header)
- [ ] Нет смешанного контента (HTTP ресурсы на HTTPS странице)

## E-Commerce Specific
- [ ] Canonical на страницах с фильтрами/сортировкой (`?sort=price_asc` → canonical на базовую)
- [ ] Pagination правильно обработана
- [ ] Страницы категорий оптимизированы (не только товарные)
- [ ] Out-of-stock товары: 301 на категорию или оставить с `availability: OutOfStock`

## Audit Workflow
1. Crawl сайт (Screaming Frog или Google Search Console)
2. Проверить Coverage report в GSC
3. Запустить PageSpeed Insights на ключевых страницах
4. Проверить Rich Results Test для schema
5. Проверить Mobile-Friendly Test
6. Анализ внутренней перелинковки
7. Составить приоритизированный roadmap

## ⚠️ Ограничения
JavaScript-инжектированный schema не всегда виден через fetch. Используй Google Rich Results Test или DevTools для точной проверки.
