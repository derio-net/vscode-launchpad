## Context

The dashboard uses plain CSS files with hardcoded color values (e.g., `#1976d2`, `#f5f5f5`) scattered across 5 stylesheets. There is no design system — colors, spacing, typography, and transitions are defined inline per-rule. The visual result is a generic light-theme Material Design look (system fonts, white card on gray background) that feels disconnected from the developer-tool context.

## Goals / Non-Goals

**Goals:**
- Establish a CSS custom property design system as the single source of truth for all visual tokens
- Create a dark theme that feels native to developers (terminal/IDE aesthetic)
- Introduce distinctive typography (DM Sans + JetBrains Mono) over generic system fonts
- Improve visual hierarchy through better use of color, weight, and spacing
- Add subtle polish (noise texture, frosted glass, micro-interactions) without performance cost

**Non-Goals:**
- Theme switching (light/dark toggle) — dark-only for now
- Component library or CSS-in-JS migration
- Modifying any React component logic or structure
- Adding new UI features or changing behavior

## Decisions

### 1. CSS Custom Properties as the design system

**Decision**: Define all visual tokens as CSS custom properties in `:root` within `index.css`.

**Rationale**: CSS variables are natively supported, require no build tooling, and work with the existing plain-CSS approach. They provide a centralized location for palette, spacing, typography, and transition tokens that all component stylesheets reference.

**Alternatives considered**:
- CSS-in-JS (styled-components, emotion): Would require refactoring all components. Overkill for a pure visual change.
- Sass/LESS variables: Would add a build dependency. CSS custom properties achieve the same goal natively.
- Tailwind CSS: Would require component markup changes and a build pipeline addition. Too invasive for a styling-only change.

### 2. Google Fonts via CSS @import

**Decision**: Load DM Sans and JetBrains Mono via `@import url(...)` in `index.css`.

**Rationale**: Simplest integration — no build config changes, no npm dependencies. `display=swap` ensures text remains visible during font loading.

**Alternatives considered**:
- Self-hosted fonts: Better performance but adds asset management complexity. Can be done later as an optimization.
- npm font packages: Would require build config changes for font-face declarations.

### 3. Noise texture via inline SVG data URI

**Decision**: Apply a fractal noise texture as a `body::before` pseudo-element using an inline SVG data URI.

**Rationale**: Zero network requests, negligible file size, and creates visual depth without a texture image asset. The `pointer-events: none` and low z-index ensure it's purely decorative.

**Alternatives considered**:
- External PNG/WebP texture: Network request, larger file, harder to tune.
- CSS-only gradient patterns: Limited options for organic noise.

### 4. Translucent surfaces with backdrop-filter

**Decision**: Use `backdrop-filter: blur()` on the main dashboard card and notifications for a frosted-glass effect.

**Rationale**: Creates visual depth and layering. The noise texture behind the card makes this effect visible and purposeful.

**Trade-off**: `backdrop-filter` has a minor performance cost on lower-end hardware. Mitigated by limiting it to only 2 elements (dashboard card, notifications) rather than applying broadly.

### 5. Jewel-tone type badges with borders

**Decision**: Each workspace type (local, remote, SSH, dev-container, etc.) gets a distinct color from a jewel-tone palette, applied as background tint + text color + subtle border.

**Rationale**: The previous implementation used solid pastel backgrounds which lacked contrast on a dark theme. Translucent backgrounds with matching borders maintain readability and visual distinction on the dark surface.

## Risks / Trade-offs

- **Google Fonts dependency** → If Google Fonts CDN is unavailable, the app falls back to the system font stack defined in the `--font-sans` and `--font-mono` variables. Acceptable for a desktop/local tool.
- **backdrop-filter on older browsers** → Not supported in Firefox < 103 or older Safari. Mitigated with `-webkit-` prefix. Graceful degradation: cards simply lack the blur effect but remain fully functional.
- **Font loading flash** → `display=swap` may cause a brief font swap on first load. Acceptable trade-off vs. invisible text during loading.
- **Dark-only theme** → Users who prefer light themes have no toggle. Acceptable for v1 — the audience is developers who overwhelmingly prefer dark themes in their IDEs.
