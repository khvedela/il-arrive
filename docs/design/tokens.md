# Il Arrive — Design tokens (v1)

**Owner**: designer · **Contract**: `tokens.css` (same directory) is normative.
Light mode is the priority; the dark set is complete but lower priority per the brief.

## 1. Identity

Il Arrive is a calm, premium productivity tool. The visual system is deliberately
**monochrome on top of a warm canvas** — the interface itself (chrome, buttons,
typography) is warm white + charcoal, and **color is reserved for status meaning**:

| Meaning | Colour |
|---|---|
| en route / live tracking | blue |
| arrived / completed | green |
| delayed / needs attention | amber |
| cancelled / failed | red |
| scheduled / inactive / unavailable | gray |

Consequences:
- **Primary buttons are ink** (`--color-ink`), not blue. A blue primary button
  would read as "this intervention is en route" and pollute the status system.
  This is the core of the identity: warm paper, ink actions, color only for
  state. (If stakeholders demand a coloured primary, the only safe candidate
  is `--color-enroute-solid` — but that conflation is exactly what we avoid.)
- No gradients, no decorative fills. Elevation is one step (cards), and
  shadows are warm-tinted (charcoal alpha, never pure black) and restrained.
- Tenant identity (business `brandColor`) may appear **only** as a thin accent
  (3px top rule of the tracking page header, logo container) — never as a
  button or background. Fallback when unset: `--color-brand` (ink).
- Motion is minimal and functional: state reveals, sheet/drawer in-out,
  progress fills. No decorative animation. Live map markers **jump** to the
  new position (no tween) — interpolating a position we do not have would be
  dishonest (see ARCHITECTURE.md §5, never extrapolate).

## 2. Color

### 2.1 Base & text

| Token | Light | Dark | Contrast (light) |
|---|---|---|---|
| `--color-bg` | `#FAF9F6` | `#191815` | — |
| `--color-surface` | `#FFFFFF` | `#211F1C` | — |
| `--color-surface-muted` | `#F4F3EF` | `#2A2824` | — |
| `--color-surface-hover` | `#EFEDE7` | `#2E2C28` | — |
| `--color-text-primary` | `#25231E` | `#F1EFE9` | **14.91:1** on bg · 15.70:1 on surface |
| `--color-text-secondary` | `#5B5748` | `#B8B4A9` | **6.87:1** on bg · 7.24:1 on surface |
| `--color-text-muted` | `#6C6759` | `#949088` | **5.36:1** on bg · 5.64:1 on surface |
| `--color-text-inverse` | `#FFFFFF` | `#191815` | **15.50:1** on ink |
| `--color-border` | `#E6E3DC` | `#35332D` | decorative (≥1.28:1 vs bg, not text) |
| `--color-border-strong` | `#D6D2C8` | `#454238` | decorative |
| `--color-ink` (primary btn) | `#26241F` | `#F1EFE9` | white text **15.50:1** |
| `--color-brand` | `#26241F` | `#F1EFE9` | wordmark |
| `--color-danger` (btn) | `#C0392B` | `#E06A5F` | white text **5.44:1** |
| `--color-danger-text` | `#B3362C` | `#F09A93` | **5.73:1** on bg |

All text tokens pass **≥ 4.5:1 on every surface they may sit on**
(bg, surface, surface-muted). Worst cases, verified:
`text-muted` on bg 5.36:1 (light) / 5.58:1 (dark); `text-secondary` on
surface-muted 6.52:1 / 7.10:1; `text-primary` on surface-muted 14.14:1 / 12.79:1.

### 2.2 Status tokens

Each status has 4 roles:
- `-fg` — text inside the tinted badge/chip (must read on `-bg`)
- `-bg` — tinted fill (badges, banners, selected states)
- `-border` — 1px border on the tinted element
- `-solid` — non-text UI: dots, timeline node fill, map marker, live indicators
  (must meet **≥ 3:1** against adjacent surface per WCAG 1.4.11)

| Status | `-fg` / `-bg` (light) | fg on bg | `-solid` on bg (≥3:1) | `-fg` / `-bg` (dark) | fg on bg | `-solid` on surface (≥3:1) |
|---|---|---|---|---|---|---|
| **enroute** (blue) | `#1B4FCC` / `#EAF1FD` | 6.09:1 | `#2E6BE6` — 4.57:1 | `#93B8F5` / `#1E2A44` | 7.09:1 | `#7BA4EC` — 6.55:1 |
| **success** (green) | `#176B35` / `#E9F6EE` | 5.92:1 | `#2E9E5B` — 3.24:1 | `#7ED098` / `#1B3324` | 7.35:1 | `#5FBF83` — 7.25:1 |
| **warning** (amber) | `#8A5300` / `#FDF4E3` | 5.79:1 | `#D97706` — 3.03:1 | `#E8B45C` / `#3A2E14` | 7.03:1 | `#DEA04C` — 7.23:1 |
| **error** (red) | `#B3362C` / `#FCEEED` | 5.34:1 | `#D14338` — 4.36:1 | `#F09A93` / `#3D211E` | 6.79:1 | `#E37C73` — 5.79:1 |
| **neutral** (gray) | `#57534A` / `#F1F0EC` | 6.72:1 | `#8A857A` — 3.49:1 | `#B8B4A9` / `#2E2C28` | 6.73:1 | `#949088` — 5.17:1 |

Solid-vs-surface (light, ≥3:1, also required on `--color-surface`):
enroute 4.81:1 · success 3.41:1 · warning 3.19:1 · error 4.59:1 · neutral 3.67:1.

### 2.3 Usage rules (non-negotiable)

1. **Never hard-code a colour** in components — tokens only.
2. Never use color alone to convey state: every status also changes an icon
   (dot shape identical, icon glyph differs) and the text label.
3. Status `-bg` fills are for badges/chips/banners only — never page backgrounds.
4. `-solid` is for non-text elements only; text on top of `-solid` must use
   `--color-text-inverse` and meet 4.5:1 (only defined for error/danger btns).
5. Business `brandColor`: max 2 uses on the tracking page (thin top rule +
   logo ring), any other use is out of spec.
6. Disabled controls: `--color-surface-muted` fill + `--color-text-muted` label,
   1px `--color-border`; never gray-out a status badge.

## 3. Spacing

4px base scale. Use the nearest token; no ad-hoc values.

| Token | px | Typical use |
|---|---|---|
| `--space-1` | 4 | icon↔label gap, chip padding-y |
| `--space-2` | 8 | inline gaps, badge padding-x |
| `--space-3` | 12 | compact card padding |
| `--space-4` | 16 | card padding, field gap |
| `--space-5` | 20 | section inner gap |
| `--space-6` | 24 | section padding, form groups |
| `--space-8` | 32 | section gap (track page blocks) |
| `--space-10` | 40 | page section gap (dashboard) |
| `--space-12` | 48 | screen padding-x (mobile) |
| `--space-16` | 64 | screen padding-y (empty states) |
| `--space-20` | 80 | hero padding-y (track page ETA) |

## 4. Radii

| Token | px | Use |
|---|---|---|
| `--radius-sm` | 4 | chips, status dots containers |
| `--radius-md` | 8 | buttons (sm/md), inputs |
| `--radius-lg` | 12 | cards, sheets, action (56px) buttons |
| `--radius-xl` | 16 | modals, drawer top corners (bottom sheets) |
| `--radius-full` | ∞ | avatars, dots, pills, sliders |

## 5. Shadows (restrained)

| Token | Value | Use |
|---|---|---|
| `--shadow-xs` | 0 1px 2px, 5% charcoal | raised chips, avatar ring |
| `--shadow-sm` | 0 1px 2px + 0 2px 6px, ≤6% | cards on bg |
| `--shadow-md` | 0 2px 4px + 0 4px 12px, ≤8% | dropdowns, menus, sticky bars |
| `--shadow-lg` | 0 4px 8px + 0 12px 32px, ≤12% | modals, drawers, bottom sheets |

Never stack two shadows on the same element. In dark mode shadows are black
alpha (see `tokens.css`); the scale maps 1:1 so layout does not change.

## 6. Typography

Single family: **Inter** (variable; ship 400–700). French is the source locale
(`@angular/localize`). Times and ETAs always use tabular figures:
`font-variant-numeric: tabular-nums` — a live-updating ETA must not shift
neighbouring pixels.

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `--text-overline` | 11 / 1 | 600 | +0.08em, UPPERCASE | section labels ("ARRIVÉE ESTIMÉE") |
| `--text-xs` | 12 / 16 | 400–500 | 0 | meta: timestamps, helper text |
| `--text-sm` | 14 / 20 | 400–500 | 0 | list rows, badges, compact UI |
| `--text-md` | 16 / 24 | 400 | 0 | base body |
| `--text-lg` | 18 / 28 | 500 | 0 | sub-headings |
| `--text-xl` | 20 / 28 | 600 | 0 | card titles |
| `--text-2xl` | 24 / 32 | 600 | −0.01em | section titles |
| `--text-3xl` | 30 / 40 | 600 | −0.01em | page titles |
| `--text-hero` | 44 / 48 | 600 | −0.02em | **ETA display (track page only)** |

Rules: one weight jump per hierarchy step (400 → 500 → 600). Never bold body
text. Max 2 type sizes per card. Hero size appears exactly once per page.

## 7. Focus ring

`focus-visible` only (never `:focus`), drawn as:
`outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset);`
- Light: ink `#26241F`; dark: light `#F1EFE9` (`--focus-color` flips).
- On tinted status fills the ring still uses `--focus-color` (ink passes 3:1
  against every status `-bg` in light mode — verify before adding new tints).
- Never `outline: none` without a replacement. Interactive controls
  (incl. buttons, inputs, tabs, map controls) are all keyboard-reachable in
  DOM order = visual order.

## 8. Motion (minimal)

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 120ms | hover/press, toggle, badge state swap |
| `--motion-base` | 200ms | drawer/sheet/modal enter-exit, list reorder |
| `--motion-slow` | 320ms | progress fill (timeline), rare page transitions |
| `--ease-out` | cubic-bezier(0.2, 0, 0, 1) | default easing (always out, never bounce) |
| `--ease-linear` | linear | progress bars only |

- Transitions animate **opacity and transform only** — never layout properties.
- `prefers-reduced-motion: reduce` → set all durations to 0ms, keep opacity
  fades (allowed), drop transforms; SSE-driven content changes are instant.
- Live updates (ETA text, status swap): instant text change, no animation.
  Optional 120ms opacity fade-in on the changed value is allowed, nothing else.
- Map marker: instant reposition, no tween (honesty rule, §1).

## 9. Layout tokens

| Token | Value | Use |
|---|---|---|
| `--track-column-max` | 480px | track page column (design width 360) |
| `--tech-column-max` | 480px | technician PWA column |
| `--app-content-max` | 1280px | dashboard content |
| `--app-sidebar-w` | 240px | dashboard nav |
| `--drawer-w` | 480px | intervention side panel |

Breakpoints: `--bp-sm: 360` (design min) · `--bp-md: 640` · `--bp-lg: 1024`
· `--bp-xl: 1280`. Track + tech pages are single-column at all breakpoints
(centered, max-width tokens above). Dashboard: sidebar collapses to top bar
below `--bp-lg`; week calendar falls back to list below `--bp-md`.

## 10. Controls & z-index

`--control-h-sm 32` · `--control-h-md 40` · `--control-h-lg 48` ·
`--control-h-action 56` (technician actions, "large" per brief) ·
`--touch-target-min 44` (WCAG 2.2 2.5.8; every interactive hit area inside
mobile screens meets 44×44, icon-only 32 only on desktop dashboard).

`--z-sticky 200 < --z-dropdown 300 < --z-drawer 400 < --z-modal 500 < --z-toast 600`.

## 11. Contrast summary (acceptance evidence)

All ratios computed with the WCAG 2.2 relative-luminance formula against the
exact token values in `tokens.css`.

**Light — text (need ≥ 4.5:1 on bg / surface / surface-muted):**
text-primary 14.91 / 15.70 / 14.14 · text-secondary 6.87 / 7.24 / 6.52 ·
text-muted 5.36 / 5.64 / 5.08 · text-inverse on ink 15.50 · white on danger
5.44 · danger-text on bg 5.73.

**Light — status badge fg on badge bg:** enroute 6.09 · success 5.92 ·
warning 5.79 · error 5.34 · neutral 6.72.

**Light — solid status vs bg / surface (need ≥ 3:1, non-text UI):**
enroute 4.57 / 4.81 · success 3.24 / 3.41 · warning 3.03 / 3.19 ·
error 4.36 / 4.59 · neutral 3.49 / 3.67.

**Dark — text:** text-primary 15.44 / 14.30 / 12.79 · text-secondary
8.57 / 7.94 / 7.10 · text-muted 5.58 / 5.17 / 4.63 · dark on light primary
15.44. **Dark — status fg on bg:** 7.09 / 7.35 / 7.03 / 6.79 / 6.73.
**Dark — solid vs surface:** 6.55 / 7.25 / 7.23 / 5.79 / 5.17.

Every required pair passes. No exceptions granted; if a new tint is proposed,
re-run the computation before merge.
