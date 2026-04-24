# Theme Rebrand: Amber + Space Grotesk + Texture

## Date
2026-04-24

## Status
Approved

## Problem

Current theme uses purple (#5E6AD2) accent with Inter font on flat dark backgrounds. User wants:
- Amber accent instead of purple
- Space Grotesk font instead of Inter
- Subtle background texture for depth

## Design Decisions

### Colors

| Role | Old | New |
|------|-----|-----|
| Accent | `#5E6AD2` | `#F09040` |
| Accent hover | `#4f5ab8` | `#D87830` |
| Background | `#0D0D0D` | `#0D0D0D` (unchanged) |
| Surface | `#151515` | `#151515` (unchanged) |
| Border | `#2A2A2A` | `#2A2A2A` (unchanged) |
| Text | `#E6E6E6` | `#E6E6E6` (unchanged) |
| Text secondary | `#8A8F98` | `#8A8F98` (unchanged) |

### Font

- **Old:** Inter
- **New:** Space Grotesk (Google Fonts)
- Weight: 400 (regular), 500 for headings
- No font-weight changes needed — Space Grotesk 400 has good presence

### Texture

- SVG noise filter applied as `::before` pseudo-element on `body`
- ~2% opacity, fixed position, pointer-events-none
- Subtle grain effect, barely noticeable but adds depth

## Implementation Approach

1. Update `tailwind.css`:
   - Change `--color-linear-accent` to `#F09040`
   - Change `--font-sans` to Space Grotesk
   - Add noise texture to body

2. Add Space Grotesk to `root.tsx` links

3. Replace all hardcoded color occurrences:
   - `#5E6AD2` → `#F09040` (91+ occurrences)
   - `#4f5ab8` → `#D87830` (17 occurrences)

4. Update test mock workspace colors

## Files Affected

### CSS/Config (2 files)
- `apps/web/app/tailwind.css` — accent color, font, texture
- `apps/web/app/root.tsx` — Space Grotesk font import

### Routes (~15 files)
- `_index.tsx` — landing page accent colors
- `login.tsx` — button, focus ring, link colors
- `onboarding.tsx` — button, focus ring colors
- `_layout.tsx` — workspace color default
- `_layout.dashboard.tsx` — buttons, chart colors
- `_layout.settings.workspace.tsx` — focus ring, button
- `_layout.settings.sources.tsx` — focus ring, button
- `_layout.settings.alerts.tsx` — focus ring, button, tab indicator
- `_layout.settings.account.tsx` — focus ring, button
- `_layout.settings.ingestion.tsx` — button
- `_layout.streams.$streamId.tsx` — (if any accent colors)

### Components (~8 files)
- `search-bar.tsx` — focus border, badge, icon colors
- `log-table.tsx` — spinner, retry link, selected row, trace ID
- `time-range-picker.tsx` — active preset, selected range
- `command-palette.tsx` — selected highlight
- `workspace-guard.tsx` — spinner
- `integrations/nextdns-connect-form.tsx` — radio, button, focus ring
- `integrations/integration-list.tsx` — (if any accent colors)

### Lib (1 file)
- `lib/auth-client.tsx` — spinner

### Tests (~4 files)
- Mock workspace color references

## Out of Scope

- Changing semantic colors (green/red/yellow/blue for status)
- Changing background/surface/border colors
- Changing text colors
- Redesigning any components
