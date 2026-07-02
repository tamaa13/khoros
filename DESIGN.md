# Design

Visual system as implemented in `desktop/tailwind.config.js` + `desktop/src/renderer/index.css`. All colors resolve to RGB-triplet CSS variables; the `.light` class on `<html>` swaps the theme.

## Theme

Dark-first (stadium at night); light theme is warm cream daylight. Backdrop is a fixed multi-radial "floodlight" gradient (`.app-backdrop`); surfaces sit on it, some as translucent `.glass`.

## Color

| Role | Dark | Light |
|---|---|---|
| bg-base | `#08090C` | `#EFECE3` |
| surface-0/1/2/3 | `#0E0F13` → `#26282F` | `#FBFAF6` → `#DDD8CC` |
| border subtle/default/strong | `#23252D` / `#2F323B` / `#3C404A` | `#E2DFD6` / `#D8D4C8` / `#C8C3B5` |
| content / muted / faint | `#F1F2F5` / `#A2A6AF` / `#6C707A` | `#1A1C20` / `#5A5E66` / `#8A8E96` |
| gold (accent) / bright / deep / fg-on-gold | `#F4C44C` / `#EFCC7C` / `#C49A33` / `#1A1404` | `#C99A2E` / `#D8AD45` / `#A87E1F` / `#FFF7E4` |
| live (red) | `#D14150` (+bright `#DC6471`) | same |
| cast (commentator blue) | `#6E93CC` | same |
| host accents | mex `#3DA968` · can `#D14150` · usa `#6E93CC` | same |

Strategy: restrained — tinted charcoal neutrals + gold accent; live-red and cast-blue are semantic, not decorative.

## Typography

- **Archivo** (variable; `wdth` 110–125, wght 900) — display: scores, wordmark, big numerals. Helpers `.display` / `.display-tight`.
- **Anton** (`font-condensed`) — condensed uppercase section labels ("MATCH FEED", "TODAY").
- **Inter** — body/UI, 12–14px in-app.
- Hierarchy via weight + width contrast; uppercase + tracking for labels (10.5–11px, `.06em–.1em`).

## Components

- **Bubbles**: user = right-aligned `#22242B` rounded 16/5; agent = glyph + surface bubble; told-you-so = gold-tinted callback card; system = centered faint italic.
- **Composer**: rounded-18 input bar, gold border when recording/slash-active; 34px square action buttons (attach, mic, send-gold).
- **Badges/pills**: rounded-full, 10.5px bold tracked uppercase (LIVE red pulse-dot, UPCOMING gold, REPLAY neutral, on-device gold).
- **Popover** (settings): 262px, rounded-14, `shadow-pop`, `animate-rise`.
- **Scoreboard**: Archivo 46px score digits, flags 28px, goal = `animate-goal-glow` + confetti spans.

## Motion

Keyframes in tailwind config as `animate-*`: `rise` (enter, .35s cubic-bezier(.16,1,.3,1)), `pulse-dot`, `ring`, `wave` (mic bars), `goal-glow`, `confetti`, `shine`, `shimmer` (skeleton). Ease-out only; celebratory motion reserved for match moments. Honor `prefers-reduced-motion`.

## Layout

460×760 fixed window, `titleBarStyle: hiddenInset` (traffic lights inset, KHOROS centered 11px tracked wordmark). Vertical budget is scarce: header (logo row + name chip + tabs) then content; persistent bars must justify their height. Radii: 9–18px (buttons 9–11, cards 12–16, composer 18). Scrollbars styled thin (`.kh-scroll`).
