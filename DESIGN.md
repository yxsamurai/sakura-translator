# Sakura Translator Design System

This project follows an Open Design-inspired design system: local-first, artifact-first, restrained, token-driven, and utility-focused. The goal is not to copy the `nexu-io/open-design` runtime, but to apply its design-system workflow to this Chrome extension.

## Source and Direction

- Source reference: `https://github.com/nexu-io/open-design`
- Applied direction: Modern Minimal + Soft Warm
- Product context: compact browser extension utility for fast translation
- Primary surfaces:
  - Browser-action popup: `popup/popup.css`
  - In-page floating translation popup: `content/content.css`
  - Critical fallback popup CSS: `content/content.js`

## Principles

1. Artifact-first, not decoration-first
   - The UI must prioritize the translation result, input, settings, and shortcut hints.
   - Avoid marketing-page layouts, fake metrics, or decorative sections.

2. Minimal single-column interaction
   - Popup flows should stay compact, predictable, and keyboard-friendly.
   - Settings are secondary and should not compete with the translation task.

3. Warm restrained visual language
   - Use paper-like warm surfaces instead of generic blue SaaS panels.
   - Use a single restrained gold accent for primary actions and state.
   - Shadows should create subtle depth, not heavy floating cards.

4. Token-first implementation
   - Colors, borders, radii, shadows, and typography are expressed as CSS variables.
   - Component rules consume tokens instead of hard-coded random values.

5. Anti-slop rules
   - Do not use generic purple gradients.
   - Do not use emoji as primary UI icons.
   - Do not invent metrics or claims.
   - Do not add over-rounded card stacks with random accent borders.
   - Do not use decorative illustrations unless there is a product reason.

## Design Tokens

The active token prefix is `--od-*`.

### Light Mode

```css
--od-bg: #fffaf2;
--od-surface: #ffffff;
--od-surface-soft: #f6efe3;
--od-surface-strong: #171717;
--od-text: #171717;
--od-muted: #62594c;
--od-subtle: #8b8174;
--od-border: #e8ddcc;
--od-border-strong: #d8c8ae;
--od-accent: #b7791f;
--od-accent-strong: #8a520f;
--od-accent-soft: #fff1d6;
--od-danger: #b42318;
```

### Dark Mode

```css
--od-bg: #1c1917;
--od-surface: #292524;
--od-surface-soft: #211d1b;
--od-surface-strong: #f8f1e6;
--od-text: #f8f1e6;
--od-muted: #c5b8a5;
--od-subtle: #9f907d;
--od-border: #403832;
--od-border-strong: #5c5045;
--od-accent: #d4af37;
--od-accent-strong: #f2c94c;
--od-accent-soft: rgba(212, 175, 55, 0.14);
--od-danger: #ffb4a8;
```

### Shape, Depth, and Type

```css
--od-radius-lg: 18px;
--od-radius-md: 12px;
--od-radius-sm: 9px;
--od-shadow: 0 18px 48px rgba(41, 27, 8, 0.14), 0 2px 8px rgba(41, 27, 8, 0.08);
--od-font: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Nunito Sans', Roboto, 'Helvetica Neue', Arial, 'Noto Sans SC', sans-serif;
```

## Component Rules

### Extension Popup

- Width may stay compact, but the surface should feel intentional and calm.
- The primary translate button uses `--od-surface-strong` in light mode and warm inverted contrast in dark mode.
- Inputs use warm paper surfaces, visible focus rings, and no harsh blue borders.
- Settings use a glass/paper panel with restrained depth.

### In-page Translation Popup

- Must remain isolated inside Shadow DOM.
- Must keep high `z-index` and fixed positioning behavior.
- Must remain readable on arbitrary host pages.
- Light mode background must be `#fffaf2`; dark mode background must be `#1c1917`.
- Critical fallback CSS in `content/content.js` must stay visually aligned with `content/content.css`.

### Motion and Accessibility

- Use short transitions only: roughly 150-220ms.
- Respect `prefers-reduced-motion`.
- Keep visible focus states for keyboard navigation.
- Do not rely on color alone for interaction state.
- Maintain text contrast at WCAG AA level where practical.

## Maintenance Checklist

Before changing UI styling:

- Check this `DESIGN.md` first.
- Keep `popup/popup.css`, `content/content.css`, and `CRITICAL_POPUP_CSS` aligned.
- Update E2E visual assertions if intentional colors change.
- Run targeted tests after CSS or JS changes:
  - `npx playwright test --project=extension tests/content-script.spec.js --reporter=line`
  - `npx playwright test --project=extension tests/popup-ui.spec.js --reporter=line`
