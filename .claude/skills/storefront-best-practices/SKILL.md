# Ecommerce Storefront Best Practices

Source: medusajs/medusa-agent-skills · plugins/ecommerce-storefront
Frameworks: Next.js, SvelteKit, React, Vue + Medusa backend

## When to Apply
Use this skill when working on:
- Checkout flow implementation
- Cart functionality (add, update, remove, totals)
- Product listing pages (PLP) and product detail pages (PDP)
- Navigation / mobile menu
- Medusa.js backend integration
- Storefront performance, SEO, or accessibility

---

## Critical: Backend SDK Verification (mandatory before coding)
1. **Pause** before writing any backend/API integration code
2. **Query** the MedusaJS docs or MCP server for the correct SDK method
3. **Verify** findings with the user before proceeding
4. **Write** code only using verified methods
5. **Check** for TypeScript errors after implementation

---

## Essential Patterns

### Accessibility
- `aria-live="polite"` on cart count/total — required for screen readers
- 44×44px minimum touch targets on all interactive elements
- `aria-label` on icon-only buttons (cart, menu, close)
- Keyboard-navigable modals with focus trap

### Mobile Optimization
- `padding-bottom: env(safe-area-inset-bottom)` on sticky bars (iOS notch)
- Horizontal scroll on chip filters with `scrollbar-width: none`
- Sticky checkout CTA — fixed bottom bar, not floating button
- Touch ripple feedback within 80–150ms

### Performance
- Lazy-load product images with `loading="lazy"` + IntersectionObserver fade
- Optimize images: WebP/AVIF, correct `sizes` attribute
- Virtualize long product lists (100+ items)
- Avoid layout shift (CLS < 0.1) — reserve image dimensions

### SEO
- JSON-LD schema (`Product`, `BreadcrumbList`, `Organization`) on PDP
- `<title>` and `<meta description>` unique per page
- Canonical URLs on all pages
- Core Web Vitals: LCP < 2.5s, CLS < 0.1, FID < 100ms

---

## Routing Patterns
- **Always** use dynamic routes for products: `/product/[slug]` not `/product-name.html`
- **Always** use dynamic routes for categories: `/category/[slug]`
- Static files only for actual static content (about, contact)

---

## Medusa-Specific Rules
- Prices come from API **already formatted** — do NOT divide by 100
- Always pass `region_id` to product/price queries
- Initialize SDK with `publishable_key` (not secret key) on frontend
- Cart ID stored in cookie/localStorage, not memory (survives refresh)
- Use `medusa.carts.addLineItem()` not custom fetch for cart ops

---

## Common Mistakes (Top 20)

### Cart
- Missing `aria-live` on cart badge count
- Not persisting cart ID across sessions
- Not handling "out of stock" state on add-to-cart
- Dividing Medusa prices by 100 (already correct)
- Missing region_id in product queries

### Product Browsing
- Hardcoding product names/prices instead of fetching from API
- Static product routes instead of dynamic `[slug]`
- No loading skeleton on filter/sort (layout jump)
- Missing pagination or infinite scroll on large catalogs

### Checkout
- Not validating required fields before submit
- No CSRF token on form submissions
- Exposing internal error messages to user
- Missing order confirmation redirect after success
- Not clearing cart after successful order

### Design
- Inconsistent spacing — not using 4/8px grid
- Emoji as structural icons (use SVG)
- Hardcoded colors instead of CSS custom properties
- Missing dark/hover/active states on interactive elements

### Mobile
- Touch targets under 44×44px
- No safe-area padding on iOS sticky bars
- Horizontal overflow from fixed-width elements
- Missing `prefers-reduced-motion` for animations

### Performance
- Images without `width`/`height` causing CLS
- Not lazy-loading below-fold images
- Blocking JS in `<head>` without `defer`/`async`

---

## Minimum Viable Storefront Features

### Must Have
- [ ] Sticky navbar with logo, cart count, mobile menu
- [ ] Product listing with filter/sort
- [ ] Product detail page with gallery, price, add-to-cart
- [ ] Cart drawer/panel with quantities and totals
- [ ] Checkout form (name, phone, address, delivery, payment)
- [ ] Order confirmation page
- [ ] Mobile-responsive layout at 320px+

### Nice to Have
- [ ] Search with autocomplete
- [ ] Category mega-menu
- [ ] Reviews section with star rating
- [ ] Recently viewed products
- [ ] Wishlist
- [ ] One-click / quick order form
