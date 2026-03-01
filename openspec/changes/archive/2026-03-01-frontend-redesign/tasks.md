## 1. Design System Foundation

- [x] 1.1 Add Google Fonts `@import` for DM Sans and JetBrains Mono to `index.css`
- [x] 1.2 Define all CSS custom properties in `:root` — palette (bg, surface, text, accent, semantic, type badge), typography (font stacks), spacing (radii), borders, shadows, and transitions
- [x] 1.3 Apply global styles: dark body background, font-family, line-height, font-smoothing, custom scrollbars, `::selection`, and `:focus-visible` defaults
- [x] 1.4 Add noise texture overlay via `body::before` pseudo-element with inline SVG data URI

## 2. App-Level States

- [x] 2.1 Restyle loading spinner with teal accent color and glow shadow in `App.css`
- [x] 2.2 Restyle loading text with mono font and muted subtext
- [x] 2.3 Restyle error state with danger color and gradient accent retry button

## 3. Dashboard Container

- [x] 3.1 Restyle dashboard card with translucent surface, frosted-glass backdrop-filter, and glow shadow in `Dashboard.css`
- [x] 3.2 Restyle header with accent dot, tighter heading, mono workspace count
- [x] 3.3 Restyle info banner with accent-subtle background and muted border
- [x] 3.4 Restyle delete button as ghost/outline style with danger color hover effect
- [x] 3.5 Restyle notifications with translucent semantic backgrounds and backdrop-filter

## 4. Search & Filter Bar

- [x] 4.1 Restyle search filter container with dark tertiary background and border in `SearchFilter.css`
- [x] 4.2 Restyle inputs with dark primary background, border transitions, and teal focus ring glow
- [x] 4.3 Restyle labels as uppercase mono text
- [x] 4.4 Restyle clear button as ghost style with danger hover

## 5. Workspace Table

- [x] 5.1 Restyle table headers with secondary background, uppercase mono text, and sticky positioning in `WorkspaceTable.css`
- [x] 5.2 Restyle table rows with translucent hover and subtle border-bottom
- [x] 5.3 Restyle workspace links with teal color and animated external icon on hover
- [x] 5.4 Restyle type badges with jewel-tone translucent backgrounds, colored text, and subtle matching borders
- [x] 5.5 Restyle path/host cells with mono font and secondary text color
- [x] 5.6 Restyle column visibility dropdown and menu with dark theme
- [x] 5.7 Restyle checkboxes with teal accent-color
- [x] 5.8 Restyle invalid workspace rows with danger-muted background

## 6. Cross-Browser & Cleanup

- [x] 6.1 Add `-webkit-backdrop-filter` prefix wherever `backdrop-filter` is used
- [x] 6.2 Add `-webkit-sticky` prefix for `position: sticky`
- [x] 6.3 Add `-webkit-user-select` prefix for `user-select: none`
- [x] 6.4 Clean up `public/index.html` — remove duplicate script/stylesheet tags, update `theme-color` meta to dark palette
- [x] 6.5 Verify build compiles cleanly with `npm run build`
