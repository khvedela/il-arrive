# Il Arrive — Component spec (v1)

Library target: `libs/ui` — Angular standalone components + the tokens from
`tokens.css`. Every value below is a token reference; hex values live only in
`tokens.css`. Copy is French — string ids point to `copy.md` (`ui.<screen>.<key>`).

Global rules:
- All interactive elements: keyboard reachable, `focus-visible` ring (§7 tokens),
  hit area ≥ 44×44 CSS px on mobile (32 px allowed desktop-only), logical DOM order.
- Icon-only buttons always get an `aria-label` (id in copy.md).
- No color-only state: icon glyph and/or text changes with every status.
- Motion: `--motion-fast/base/slow`, transform+opacity only, reduced-motion safe.

---

## 1. Button

**Anatomy**: `border` (1px) · `background` · `label` (`--text-sm` 500, md/lg) ·
optional `icon` (16px, spaced `--space-2`) · `focus ring`.
Heights: sm `--control-h-sm` (32, desktop), md 40, lg 48, **action 56**
(`--control-h-action`, technician screens — full-width inside bottom action bar).
Padding-x: sm/md `--space-3`, lg/action `--space-4`. Radius: sm/md `--radius-md`,
lg/action `--radius-lg`. Min width 64px.

| Variant | bg | border | label | icon | Use |
|---|---|---|---|---|---|
| primary | `--color-ink` | none | `--color-text-inverse` | inverse | main action of a screen, one per view |
| secondary | `--color-surface` | `--color-border-strong` | `--color-text-primary` | primary | alternative actions |
| ghost | transparent (hover `--color-surface-hover`) | none | `--color-text-secondary` (hover primary) | same | low-emphasis inline actions |
| danger | `--color-danger` | none | `#FFFFFF` | white | destructive confirm |
| danger-ghost | transparent (hover `--color-error-bg`) | none | `--color-danger-text` | same | destructive, low emphasis |

States: hover (bg step: primary→`--color-ink-hover`, secondary→`--color-surface-hover`,
danger→`--color-danger-hover`) · active (`--color-ink-active`) · focus-visible (ring)
· disabled (fill `--color-surface-muted`, label `--color-text-muted`, border `--color-border`,
cursor default) · loading (label replaced by 16px spinner in label colour, `aria-busy`,
button stays sized, input locked 300 ms debounce).
**Rules**: one primary per view. On mobile the action button sits in the
bottom bar (fixed, `--space-4` inset, `--shadow-md`, safe-area padding).

a11y: native `<button>`, `type` explicit; loading must announce
`aria-live=polite` ("Envoi…"); icon labels from copy.md.

## 2. Input (text / email / number)

Anatomy: label (`--text-sm` 500, `--color-text-primary`) · field (h `--control-h-md`,
border 1px `--color-border-strong`, radius `--radius-md`, bg `--color-surface`,
padding `--space-3`, text `--text-md`) · helper text (`--text-xs`, `--color-text-muted`)
· error text (`--text-xs`, `--color-danger-text`, id icon 14px) · prefix/suffix
(icon or `+33` for phone, `--color-text-muted`).

States: default · hover (border `--color-border` → `--color-border-strong` is default;
hover unchanged) · **focus** (border `--color-ink` + ring `--focus-color` offset 2,
no border colour clash: border stays strong + ring outside) · disabled
(`--color-surface-muted` bg, `--color-text-muted`, border `--color-border`)
· invalid (border `--color-error-solid`, focus ring `--color-error-solid`,
error text below, icon) · filled (no visual change beyond label).
Character counter (when used): `--text-xs` muted, right-aligned, switches to
`--color-danger-text` over max.

a11y: `<label for>` always (no placeholder-as-label; placeholder is example only,
`--color-text-muted`); error linked via `aria-describedby` + `aria-invalid`;
number inputs `inputmode` + `pattern`; Enter submits the form it lives in.

## 3. Textarea

Same as Input but min-height 3 lines (96px), auto-grow to 8 lines then scroll,
no resize handle on mobile (desktop `resize: vertical`). Error/helper identical.
`aria-describedby` for counter + error. Use: description, notes, delay reason.

## 4. Select (single, native-backed)

Anatomy: label · field styled like Input with 16px chevron (`--color-text-muted`)
· value text `--text-md` (placeholder: `--color-text-muted`).
Implementation: native `<select>` (mobile UX + a11y for free); long lists
(> 12 options, e.g. technicians) become a **listbox popover** with
`role=combobox`/`listbox`, typeahead, arrow keys, Home/End, Esc closes.
States: default/focus (ring)/disabled identical to Input; selected value in
`--color-text-primary`. Invalid state per Input.
a11y: `aria-expanded`, `aria-activedescendant` on listbox; keyboard complete;
visible label above (never placeholder-only).

## 5. Phone input

Input variant with `+33` prefix segment (fixed for MVP; international numbers
accepted but prefix locked to `+33` per ARCHITECTURE.md §7 default FR).
`inputmode=tel`, `type=tel`. As-you-type formatting: `06 12 34 56 78`
(libphonenumber-js, national display). Validation on blur: E.164
`+33XXXXXXXXX`; invalid → error "Numéro de téléphone invalide"
(ui.form.phone.invalid). Suffix: live validity check icon (green check) when
valid. Mobile: numeric keyboard, never letter keyboard.

## 6. Address autocomplete

Input + listbox (combobox pattern, §4). Source: BAN geocoding
(api-adresse.data.gouv.fr) debounced 300 ms, min 3 chars, top 6 results,
French labels: `12 rue de la Paix, 75002 Paris` + secondary line
`--text-xs` muted with city + postcode. States: idle · loading (suffix spinner,
"Recherche…") · no result ("Aucune adresse trouvée" empty list + "Rajouter
manuellement" ghost button → free-text fallback flagged for review) ·
selected (value locked, geocoded lat/lng stored on the form).
Keyboard: standard combobox (arrows select, Enter picks, Esc clears highlight).
a11y: `aria-activedescendant`, `role=option`, announced via `aria-relevant=add text`.
Only the typed/selected address label is stored; coordinates are internal.

## 7. Date + time-window picker

Two fields in one group, used in intervention create/edit:
- **Date**: native `<input type=date>` (calendar UI is OS-native, consistent).
  Constraint: today or later (reschedule allows past? no — always future).
- **Window**: start time + end time, native `<input type=time>`, step 30 min.
  Quick chips under the field: `8h–12h`, `13h–18h`, `8h–18h`, `4h`
  (chips set both times, `--space-2` gap, pill shape `--radius-full`,
  secondary style, selected = primary text + `--color-enroute-bg` fill).
Validation: end > start; window 1h–8h; date in the past → error
"La date est passée". Display format everywhere: `12 nov. 2026, 8h–12h`.
a11y: labels "Date" / "Créneau (début–fin)"; chips are real buttons with
`aria-pressed`.

## 8. StatusBadge

Anatomy: icon dot (8px `--radius-full`, status `-solid`) · label (`--text-sm` 500,
status `-fg`) · optional meta line (`--text-xs`, same `-fg`). Fill `status-bg`, border 1px `status-border`,
radius `--radius-full` (pill), padding 4/8 (`--space-1`/`--space-2`).
Sizes: sm (meta rows, h 20) · md (list rows, h 24).
States are the 7 labels (copy.md `ui.status.*`): en-route, arrived, completed,
delayed (badge shows "Retardé" — overlays on en-route/scheduled), cancelled,
rescheduled, scheduled/inactive. Delayed is an **overlay**: base badge keeps its
status, amber chip appended next to it (never replaces).
a11y: text label is always real text (no icon-only badges); badge is
`aria-hidden` when an adjacent visible text already states the status.

## 9. Card / Panel

Anatomy: border 1px `--color-border` · bg `--color-surface` · radius `--radius-lg`
· padding `--space-4` (compact: `--space-3`) · shadow `--shadow-sm` only when the
card is interactive or elevated (track page hero = elevated; dashboard list rows
= border only, no shadow — restraint).
Variants: plain · interactive (hover: border `--color-border-strong`, shadow
`--shadow-sm`; cursor pointer; focusable when it is a link/row) ·
tinted (bg = status `-bg`, border = status `-border` — banners).
Header pattern: overline label (`--text-overline`, `--color-text-muted`) or
title (`--text-xl`), then content with `--space-4` rhythm.

## 10. List row

Anatomy (dashboard/tech lists): left time block (window `--text-sm` 500 primary,
date `--text-xs` muted) · main column (customer name `--text-sm` 500, secondary
line: address `--text-xs` muted, truncated) · right column (StatusBadge sm +
technician avatar 24px) · optional delay chip (amber, "+30 min").
Height: mobile 72px, desktop 56px; divider `--color-border` (1px, inset 16px);
hover `--color-surface-hover`; selected `--color-enroute-bg` (only when a detail
panel is open). Radius `--radius-md` on hover/selected fill.
a11y: rows are `role=option` in a `role=listbox` or plain buttons; arrow-key
navigation within a list; Enter opens; `aria-current` on selected.

## 11. Drawer / side panel

Desktop: right-anchored panel `--drawer-w` (480px), full height, border-left
1px `--color-border`, bg `--color-surface`, shadow `--shadow-lg`, slides in
`--motion-base` `--ease-out`. Mobile: full-screen sheet (or 90% height, top
radius `--radius-xl`) — bottom sheet variant `--shadow-lg`, grab handle
(32×4px `--color-border-strong` centered).
Header: title `--text-xl` + close button (44px hit, `aria-label`
"Fermer le panneau"). Body scrolls independently; sticky footer for actions.
Close: Esc, close button, or tap on scrim (desktop) / swipe down (mobile sheet).
Focus: traps inside while open, restores to trigger on close.
`role=dialog` + `aria-modal=true` + `aria-label` from the screen's copy.

## 12. Modal

Centered dialog, max-width 420px (forms 480px), radius `--radius-xl`,
`--shadow-lg`, scrim `rgba(37,35,30,0.4)` (dark: `rgba(0,0,0,0.6)`).
Header: title `--text-xl` + close. Body `--space-6`. Footer: actions right-aligned,
secondary → primary order (danger primary last: "Annuler" secondary, "Supprimer"
danger). Enter submits, Esc cancels, focus trap, focus restore, `aria-modal`,
`role=dialog`. Used for: cancel-intervention confirm, regenerate-link confirm,
remove-member confirm. **Never** for the delay flow (that's a sheet, thumb reach).

## 13. Toast

Stack top-right (desktop) / top-center (mobile), max 3 visible. Anatomy:
icon 16px (status solid) · message `--text-sm` · optional action link
(`--color-enroute-fg` underlined) · close 24px. Bg `--color-surface`,
border `--color-border`, radius `--radius-md`, `--shadow-md`, padding 12/16.
Variants: success (green), error (red), info (ink dot), warning (amber).
Auto-dismiss: success/info 4s, error/warning 8s (error stays if it has an
action). Enter on dismiss: `--motion-base` translateY(−8px)+opacity.
a11y: container `role=status` `aria-live=polite`; error toasts `role=alert`.
Never block input; never put a toast where a field error belongs.

## 14. Empty / Loading / Error states

**Empty** (per list): centered block, 40px line icon (`--color-text-muted`),
title `--text-lg` 500, body `--text-sm` muted (max 2 lines), optional single
secondary button. No decorative illustration.
**Loading**: list → skeleton rows (shimmer-free: static `--color-surface-muted`
blocks, 3 rows, `--motion` none — calm); field → field-level spinner (§1);
track page first fetch → the page shell with ETA block in `--color-surface-muted`
("Chargement…").
**Error**: icon 24px red + title `--text-lg` + body + retry secondary button
("Réessayer"). Network vs server: generic "Impossible de charger les
données" + retry; auth loss → redirect to login, no error block.
All three share the layout so screens stay predictable.

## 15. Avatar

Sizes 24 (list) / 32 (row) / 48 (track page technician) / 56 (tech profile).
Source: `avatarUrl`; fallback: initials (first name initial, `--text-sm` 600,
`--color-text-secondary`) on `--color-surface-muted`, circle `--radius-full`.
No border ring (track page only: 2px ring `--color-border` on photo).
Alt text: "Photo de {firstname}" or empty + adjacent visible name (name is
always rendered next to the avatar — avatar never carries identity alone).

## 16. Timeline

Vertical, single column, used on track page (5 steps) and intervention detail.
Anatomy per step: node (16px circle: done = status solid fill + 12px check in
inverse; current = 8px solid dot + 4px ring `--color-surface` (pulse allowed
once, `--motion-slow`, only while EN_ROUTE live; reduced-motion: static) ·
upcoming = 16px `--color-border` ring only) · connector 2px
(`--color-border`, above done segments `--color-success-solid`) · label
(`--text-sm`, done/current `--color-text-primary` 500, upcoming `--color-text-muted`)
· meta (`--text-xs` `--color-text-muted`, e.g. "à 9h12") · optional detail line.
Step order is fixed (5 steps, copy.md `ui.track.timeline.*`); a cancelled
intervention renders steps up to the last reached as done, the step it was
interrupted at as neutral, remaining hidden — plus a red banner above (§screens).
a11y: steps are a list (`<ol>`), current step `aria-current=step`, timestamps
as real text. Never animate the connector length (instant state swap).

## 17. Tabs

Two variants:
- **Underline tabs** (dashboard: Liste / Calendrier; PWA top): track `--color-border`
  1px; tab h 44px, label `--text-sm` 500 (`--color-text-muted` inactive →
  `--color-text-primary` active), active indicator 2px `--color-ink` under label.
- **Segmented control** (view toggles): container `--color-surface-muted`
  radius `--radius-md` p 2px; selected segment `--color-surface` + `--shadow-xs`.
Keyboard: roving tabindex, Left/Right moves + selects (auto-activate), Home/End.
`role=tablist/tab/tabpanel`, `aria-selected`, panels `aria-labelledby`.
Tab change = client-side, instant (no spinner if < 300 ms, else skeleton).

## 18. Menu (context / overflow)

Trigger: icon 40px hit (kebab `…` `--color-text-muted`) or text ghost button.
Panel: min-width 180px, bg `--color-surface`, border `--color-border`,
radius `--radius-md`, `--shadow-md`, padding `--space-1`. Items: h 36px desktop /
44px mobile, icon 16 + label `--text-sm`, hover `--color-surface-hover`,
divider `--color-border`, danger items `--color-danger-text`.
Open on click; close: Esc, outside click, item action, scroll (desktop).
Focus trap while open; Esc/Down returns to trigger. `role=menu`/`menuitem`,
`aria-haspopup=menu`. Use for: row actions (copy link, resend SMS,
regenerate, cancel) — never for primary screens actions (they get real buttons).

## 19. Form (composition, not a visual primitive)

Stacked fields, one column (mobile & desktop), max width 480px, field gap
`--space-6`, group gap `--space-10`. Order = tab order. Validation: on blur
first, on submit all; errors per field (§2) + top error summary link list when
> 2 errors (anchor to field, focus it). Submit area: sticky bottom bar on
mobile (primary full-width 56px + secondary), right-aligned on desktop.
Dirty-guard: leaving with unsaved changes → confirm modal ("Quitter sans
enregistrer ?" / "Annuler" / "Quitter").

---

## Sizing / density summary

| Screen family | Base font | Primary control | Card padding |
|---|---|---|---|
| Track page (customer) | 16 | tel: button 56px full-width | 16 (hero 20) |
| Technician PWA | 16 | action buttons 56px | 16 |
| Dashboard | 14 (body 16) | md 40 | 12–16 |
