## ADDED Requirements

### Requirement: CSS custom property design system
The application SHALL define all visual tokens as CSS custom properties in `:root` within `index.css`, covering color palette, typography, spacing, borders, shadows, radii, and transitions.

#### Scenario: Design tokens are centralized
- **WHEN** any component stylesheet references a visual value (color, font, spacing, shadow, radius, or transition)
- **THEN** it SHALL use a CSS custom property defined in `:root` rather than a hardcoded value

#### Scenario: Palette categories are defined
- **WHEN** the design system is loaded
- **THEN** it SHALL provide tokens for: base backgrounds (`--bg-*`), surfaces (`--surface-*`), text hierarchy (`--text-*`), accent colors (`--accent-*`), semantic colors (`--danger`, `--success`, `--warning` with muted variants), type badge colors (`--type-*`), borders (`--border-*`), and shadows (`--shadow-*`)

### Requirement: Dark theme color palette
The application SHALL use a dark color palette with a deep charcoal base and teal accent.

#### Scenario: Base background is dark
- **WHEN** the application loads
- **THEN** the `body` background SHALL be a dark charcoal color (`--bg-primary`)

#### Scenario: Accent color is teal
- **WHEN** interactive elements (links, focus rings, loading spinners, active indicators) are rendered
- **THEN** they SHALL use the teal accent color (`--accent`) or its variants

#### Scenario: Text uses a light-on-dark hierarchy
- **WHEN** text is rendered
- **THEN** primary text SHALL be light (`--text-primary`), secondary text SHALL be muted (`--text-secondary`), and de-emphasized text SHALL use `--text-muted`

### Requirement: Typography system
The application SHALL use DM Sans for UI text and JetBrains Mono for data, paths, labels, and code.

#### Scenario: Fonts are loaded
- **WHEN** the application loads
- **THEN** DM Sans and JetBrains Mono SHALL be loaded via Google Fonts with `display=swap`

#### Scenario: UI text uses DM Sans
- **WHEN** headings, body text, buttons, and navigation elements are rendered
- **THEN** they SHALL use the `--font-sans` stack (DM Sans with system font fallbacks)

#### Scenario: Data and labels use JetBrains Mono
- **WHEN** table column headers, workspace paths, SSH hosts, type badges, filter labels, loading text, or the workspace count are rendered
- **THEN** they SHALL use the `--font-mono` stack (JetBrains Mono with monospace fallbacks)

### Requirement: Workspace type badge styling
Each workspace type SHALL have a distinct jewel-tone color with translucent background, matching text color, and subtle border.

#### Scenario: Type badges are visually distinct
- **WHEN** workspace type badges are rendered
- **THEN** each type (local, remote, dev-container, attached-container, ssh-remote, unknown) SHALL use its own color from the `--type-*` token set

#### Scenario: Badges use translucent backgrounds
- **WHEN** a type badge is rendered
- **THEN** it SHALL have a translucent background (`--type-*-bg`), colored text (`--type-*`), and a subtle matching border

### Requirement: Interactive element styling
Interactive elements SHALL provide visual feedback through transitions and state changes.

#### Scenario: Links show hover state
- **WHEN** a user hovers over a workspace link
- **THEN** the link color SHALL transition to the accent color and the external icon SHALL fade in with an upward shift

#### Scenario: Focus is visible
- **WHEN** an interactive element receives focus via keyboard
- **THEN** it SHALL display a 2px accent-colored outline with offset

#### Scenario: Table rows highlight on hover
- **WHEN** a user hovers over a table row
- **THEN** the row background SHALL transition to a subtle highlight color (`--bg-hover`)

#### Scenario: Buttons show state transitions
- **WHEN** a button is hovered or active
- **THEN** it SHALL provide a smooth visual transition (color, shadow, or transform) using the design system's transition tokens

### Requirement: Visual depth and texture
The application SHALL use visual techniques to create depth and atmosphere.

#### Scenario: Noise texture overlay
- **WHEN** the application loads
- **THEN** a subtle noise texture SHALL be rendered as a fixed `body::before` pseudo-element using an inline SVG, with `pointer-events: none` and low z-index

#### Scenario: Dashboard card uses frosted glass
- **WHEN** the main dashboard container is rendered
- **THEN** it SHALL use `backdrop-filter: blur()` with a translucent background to create a frosted-glass effect against the noise texture

#### Scenario: Custom scrollbars
- **WHEN** scrollable content is displayed
- **THEN** scrollbars SHALL be styled to match the dark theme using `::-webkit-scrollbar` pseudo-elements

### Requirement: Cross-browser compatibility
Visual features SHALL include necessary vendor prefixes for cross-browser support.

#### Scenario: Backdrop filter works in Safari
- **WHEN** `backdrop-filter` is used
- **THEN** the `-webkit-backdrop-filter` prefix SHALL also be included

#### Scenario: Sticky positioning works in Safari
- **WHEN** `position: sticky` is used
- **THEN** the `-webkit-sticky` prefix SHALL also be included

#### Scenario: User-select works in Safari
- **WHEN** `user-select: none` is used
- **THEN** the `-webkit-user-select` prefix SHALL also be included
