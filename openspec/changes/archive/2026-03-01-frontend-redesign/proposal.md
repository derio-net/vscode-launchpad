## Why

The dashboard's visual design uses generic system fonts, Material Design lite colors, and flat light-gray backgrounds — the default look of a vibe-coded prototype. Since the app's audience is developers who live in dark-themed IDEs, a polished dark theme with developer-native typography creates a more cohesive, professional experience.

## What Changes

- Replace the light theme with a dark terminal/dev-console aesthetic (deep charcoal base, teal accent palette)
- Introduce a CSS custom property design system for consistent theming across all components
- Switch typography from system font stack to DM Sans (UI) + JetBrains Mono (data/labels)
- Restyle the data table with translucent hover states, uppercase mono column headers, and jewel-tone type badges
- Restyle the search/filter bar as a command-bar with dark inputs and teal focus rings
- Add visual polish: noise texture overlay, frosted-glass card, custom scrollbars, smooth micro-interactions
- Clean up `public/index.html` which had accumulated ~25 duplicate script/stylesheet tags from repeated builds

## Capabilities

### New Capabilities
- `dark-theme-design-system`: CSS custom property design system defining the app's visual foundation — color palette, typography, spacing, borders, shadows, transitions, and component-level tokens

### Modified Capabilities
_(none — this is a pure visual/CSS change with no behavioral requirement modifications)_

## Impact

- **CSS files**: All 5 CSS files rewritten (`index.css`, `App.css`, `Dashboard.css`, `WorkspaceTable.css`, `SearchFilter.css`)
- **HTML**: `public/index.html` cleaned up (duplicate build artifacts removed, theme-color meta updated)
- **Dependencies**: Google Fonts loaded via CSS `@import` (DM Sans, JetBrains Mono)
- **No JS changes**: Zero component logic modified
- **Cross-browser**: Added `-webkit-` prefixes for `backdrop-filter`, `sticky`, `user-select`
