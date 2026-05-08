# News Article Page — Editorial Redesign

**Date:** 2026-05-08
**Scope:** `news-article.component.html` + `news-article.component.scss` only

## Direction

Clean editorial (Option A). Inspired by GOV.UK and quality newspaper sites:
generous whitespace, strong typographic hierarchy, understated. No serif body
font — system sans-serif at larger size with wider line-height (GOV.UK approach).

---

## Typography & Spacing

- **Body font:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Body size:** 17px, line-height 1.85
- **Article column max-width:** ~68ch to keep line lengths comfortable
- **Article title:** 2.4rem, weight 800, line-height 1.2
- **Content h2:** 1.25rem, weight 700, 3px left border in accent colour, margin-top 2.5rem
- **Page top padding:** 48px (up from 24px)

## Colour Palette

| Token | Value | Replaces |
|---|---|---|
| Accent | `#5c6bc0` (muted slate indigo) | `#7c6af7` everywhere |
| Body text | `#1f2937` (warm near-black) | `#333` |
| Meta / muted | `#6b7280` (warm grey) | `#888` |
| Border | `#e5e7eb` | `#e0e0e0` |
| Category: valuations | `#43a047` | `#4caf50` |
| Category: plates | `#5c6bc0` | `#7c6af7` |
| Category: cars | `#1e88e5` | `#2196f3` |

## Article Header

- Thin `1px solid #e5e7eb` bottom border below breadcrumb row (quiet section divider)
- Meta row: `•` separator between read-time and date (replaces raw gap spacing)

## Sidebar

- Widget card: white background, `1px solid #e5e7eb` border, `6px` border-radius, no shadow
- CTA widget header: icon + heading in a flex row (icon no longer stacked above)
- "Get free valuation" button: filled primary (existing behaviour)
- "List your plate" button: outlined/stroked (existing behaviour)
- Sticky offset: `top: 32px` (up from `top: 16px`)

## Related Articles Widget

- Heading label: all-caps `RELATED ARTICLES`, 11px, tracked — replaces plain `h3`
- Each link: `→` prefix replaces the colour dot
- Hover colour: `#5c6bc0`

## Files Changed

- `src/app/core/news-article/news-article.component.scss` — all style changes
- `src/app/core/news-article/news-article.component.html` — meta row separator markup, sidebar icon/heading restructure, related widget heading label
