# UI/UX Pro Max - Design Intelligence

This is a comprehensive design guide containing over 50 styles, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, and 25 chart types across 10 technology stacks.

## Key Usage Scenarios

The skill applies to **UI structure, visual design decisions, interaction patterns, and user experience quality control**. Use it when tasks involve designing pages, creating components, selecting typography/colors, reviewing UI code, or implementing navigation and responsive behavior.

## Critical Priority Rules (Must Have)

1. **Accessibility** — Maintain 4.5:1 contrast ratio, include alt text, ensure keyboard navigation, use ARIA labels
2. **Touch & Interaction** — Meet 44×44px minimum touch targets with 8px+ spacing; provide clear loading feedback
3. **Performance** — Use WebP/AVIF images, lazy load assets, maintain CLS < 0.1, virtualize long lists
4. **Style Selection** — Match style to product type, maintain consistency, use SVG icons (not emoji)
5. **Layout & Responsive** — Design mobile-first, use systematic breakpoints, prevent horizontal scroll

## Quick Search Command

Generate a complete design system with recommendations:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<product_type> <keywords>" --design-system
```

For domain-specific details, use:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain>
```

Available domains include `product`, `style`, `color`, `typography`, `chart`, `ux`, `react-native`, and others.

## Common Professional Standards

- Avoid emoji as structural icons; use vector-based alternatives
- Provide pressed-state feedback within 80-150ms without layout shifts
- Respect safe areas for notches, status bars, and gesture regions
- Use consistent 4/8dp spacing rhythm throughout
- Maintain semantic theme tokens instead of hardcoded colors
- Test contrast independently in both light and dark modes

Refer to the **Pre-Delivery Checklist** section for a comprehensive verification guide before implementation.
