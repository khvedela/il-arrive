# Il Arrive — Screen specs (v1)

**Reading guide**: copy ids (`ui.*`) resolve in `copy.md`. Components resolve in
`components.md`. Tokens in `tokens.css`. Wireframes are ASCII at 360px design
width (track + tech); desktop layouts noted per screen.

**Status → visual mapping (global)**

| State machine (ARCH §3) | Track page label | Badge | Where |
|---|---|---|---|
| SCHEDULED, not today | Rendez-vous confirmé | neutral | step 1 current |
| SCHEDULED, today | Intervention prévue | neutral | step 2 current |
| EN_ROUTE | Technicien en route | enroute | step 3 current, pulse |
| EN_ROUTE + delayMinutes | + banner "Retard signalé" | enroute + warning chip | hero shows new ETA |
| ARRIVED | Technicien arrivé | success | step 4 current |
| COMPLETED | Intervention terminée | success | step 5 current |
| CANCELLED | Rendez-vous annulé | error | banner, no map |
| reschedule applied | Rendez-vous déplacé | warning banner | back to SCHEDULED steps |
| link expired/revoked | Ce lien a expiré | — | standalone page |

---

# 1. Customer tracking page (`apps/track` — `/t/:token`)

**Most important screen in the product.** Mobile-first, single column
(`--track-column-max` 480, centered). Desktop: identical column, no side
content. Must be understandable in **5 seconds**: who is coming, when, and did
anything change.

**Data contract**: `GET /public/track/:token` customer-safe projection
(ARCH §4): business identity (name, logoUrl, brandColor, phone), technician
first name + avatar, status, window, address label, ETA (+computedAt),
delay(+reason), approximate position (only while EN_ROUTE and fresh),
contact phone. SSE `GET /public/track/:token/events` for live deltas.
**Never shown**: internal notes, other interventions, position history,
coordinates once not EN_ROUTE.

**Layout anatomy (top → bottom)** — the order below is normative (brief order):

1. **Business identity strip** (h 56, sticky): 2px brandColor rule on top
   (fallback `--color-brand`); logo 28px square (radius `--radius-sm`; if no
   logo: 28px `--color-surface-muted` tile with business initial); business
   name `--text-sm` 600; on the right: phone icon button (44 hit, `tel:`,
   `aria-label` ui.track.call).
2. **Banner zone** (conditional): delayed / rescheduled / cancelled (§states).
3. **ETA hero card** (Card, `--space-6` padding; elevated `--shadow-sm`;
   border `--color-border`): overline label (state-dependent) + hero value +
   meta line. The **only** place `--text-hero` appears.
4. **Technician row**: avatar 48 (`--radius-full`, 2px ring `--color-border`),
   first name `--text-lg` 600, sub-line `--text-xs` muted "Technicien ·
   {business}".
5. **Map card** (only when live position exists): 16:9, radius `--radius-lg`,
   MapLibre lazy-loaded (ARCH §1 budget: no map JS on first load); single
   marker (24px pin, `--color-enroute-solid`); bottom-left caption `--text-xs`
   muted "Position actualisée à HH:MM". No attribution clutter below the
   standard MapLibre control (zoom − +). Marker repositions instantly, no
   tween.
6. **Timeline** (component §16, 5 steps, fixed labels ui.track.timeline.*).
7. **Appointment details card**: address `--text-sm` 500; date + window
   `--text-xs` muted; description `--text-sm` muted if present (max 2 lines,
   "Voir plus" ghost toggle if longer).
8. **Call CTA**: full-width 56px secondary-styled button (ink border,
   phone icon) "Appeler {business}" (`tel:`). Stays in every state except
   expired.
9. **Footer**: "Propulsé par Il Arrive" `--text-xs` muted centered +
   "Confidentialité" link (privacy notice, ARCH §9) — 44px combined hit.

**5-second test mapping**: seconds 0–1 business strip (who), 1–2 hero (when),
2–3 technician row + status (who's coming / what changed), 3–5 timeline
(confirms understanding). Nothing above the hero other than the business
strip.

---

## 1.1 State: scheduled — not today (SCHEDULED, date ≠ today)

Hero: label ui.track.hero.scheduled ("RENDEZ-VOUS CONFIRMÉ"), value
**"Mar. 12 nov."** (text-2xl→3xl, 600 — not hero size; future appointments do
not use `--text-hero`, keep it for live ETAs), meta "entre 8h et 12h".
No map. Timeline: step 1 current (gray), rest upcoming. Banner: none.
Call CTA: present. Footer note (below details): "Le lien de suivi sera actif
le jour de l'intervention." (ui.track.note.link-day).

```
┌──────────────────────────────────┐
│ ┈┈┈┈┈┈ (brand color 2px)        │
│ ⊞ Plomberie Martin        [tel] │
│                                  │
│ RENDEZ-VOUS CONFIRMÉ             │
│ Mar. 12 nov.                     │
│ entre 8h et 12h                  │
│                                  │
│ ⊙ Marc                           │
│ Technicien · Plomberie Martin    │
│                                  │
│ ● Rendez-vous confirmé   ◀ now   │
│ │                                │
│ ○ Intervention prévue            │
│ │                                │
│ ○ Technicien en route            │
│ │                                │
│ ○ Technicien arrivé              │
│ │                                │
│ ○ Intervention terminée          │
│                                  │
│ 12 rue de la Paix, 75002 Paris   │
│ Mercredi 12 nov. · 8h–12h        │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ ☎ Appeler Plomberie Martin   │ │
│ └──────────────────────────────┘ │
│   Propulsé par Il Arrive · Confidentialité │
└──────────────────────────────────┘
```

## 1.2 State: scheduled — today (SCHEDULED, today)

Same as above, but: hero label ui.track.hero.todays ("INTERVENTION PRÉVUE
AUJOURD'HUI"), value **"8h–12h"** (text-3xl 600), meta "aujourd'hui,
mercredi 12 nov."; timeline step 2 current. No map, no ETA (none exists).
This is the "the day has started, nothing yet" state.

## 1.3 State: en route — live (EN_ROUTE, fresh fix)

Hero: label ui.track.hero.enroute ("ARRIVÉE ESTIMÉE"), value **"10h42"**
(`--text-hero`, tabular-nums), meta "dans ~18 min · estimée à 10h31"
(`--text-sm` muted, tabular). ETA updates via SSE: instant text swap.
Map card: visible, marker, caption "Position actualisée à 10h31".
Timeline: step 3 current, pulse dot (reduced-motion: static).
Status line under hero is implicit in the overline — do **not** add a
redundant badge next to it (the overline IS the status here).

```
┌──────────────────────────────────┐
│ ┈┈┈┈┈┈ (brand color)            │
│ ⊞ Plomberie Martin        [tel] │
│                                  │
│ ARRIVÉE ESTIMÉE                  │
│ 10h42                            │
│ dans ~18 min · estimée à 10h31   │
│                                  │
│ ⊙ Marc                           │
│ Technicien · Plomberie Martin    │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  [ map — one marker ● ]      │ │
│ │  Position actualisée à 10h31 │ │
│ └──────────────────────────────┘ │
│                                  │
│ ● Rendez-vous confirmé    9h02   │
│ │                                │
│ ● Intervention prévue     9h12   │
│ │                                │
│ ◉ Technicien en route    9h58 ◀  │
│ │                                │
│ ○ Technicien arrivé              │
│ │                                │
│ ○ Intervention terminée          │
│                                  │
│ 12 rue de la Paix, 75002 Paris   │
│ Aujourd'hui · 8h–12h             │
│ Fuite sous évier                 │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ ☎ Appeler Plomberie Martin   │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**Delayed overlay** (delayMinutes set, SCHEDULED or EN_ROUTE): amber banner
above the hero (tinted Card `--color-warning-bg/border`, warning icon,
`--text-sm` warning-fg): "Retard signalé — nouvelle arrivée estimée vers
11h05" + optional reason line `--text-xs` (only if the business/tech
provided a customer-visible reason). Warning chip "+30 min" appended to the
hero meta line. Hero value switches to the **new** ETA (single source of
truth: server-delayed ETA). When delay clears (tech resumes / arrives),
banner disappears via SSE.

## 1.4 State: en route — stale location (fix > 120 s old)

Normative copy (ARCH §5): **"Position non disponible depuis HH:MM"** — no
marker, **map card hidden entirely** (an empty map reads as broken).
Hero keeps the **last known ETA** with explicit timestamp: value "10h42",
meta "dernière estimation à 09h58 · position indisponible depuis 09h42"
(muted). Neutral info card replaces the map position: icon (location-off,
`--color-neutral-solid`), title `--text-sm` 500 "Position non disponible
depuis 09h42", body `--text-xs` muted "Le technicien est peut-être dans une
zone à réception limitée. Statut toujours à jour."
**Never** extrapolate position or ETA (no countdown, no "à proximité").
Status/overline unchanged ("Technicien en route"). Everything else identical
to 1.3.

## 1.5 State: arrived (ARRIVED)

Hero card becomes **success tinted** (bg `--color-success-bg`, border
`--color-success-border`): overline "TECHNICIEN ARRIVÉ" (`--color-success-fg`),
value **"Arrivé"** (text-3xl 600 `--color-success-fg`), meta "Marc est sur
place · 10h41". No map (position no longer returned — ARCH §4/§5). Timeline:
steps 1–4 done (success connector), step 5 upcoming. Call CTA stays
(the customer may want to call). Banner: none.

## 1.6 State: completed (COMPLETED)

Success tinted hero: overline "INTERVENTION TERMINÉE", value **"Terminé"**,
meta "Intervention terminée à 11h20". Timeline: all 5 done. Map: none.
Call CTA: stays (business phone). Footer gains: "Ce lien n'est plus actif."
(Link content lives 24 h per ARCH §4, then 410.)

## 1.7 State: cancelled (CANCELLED)

Error banner (tinted `--color-error-bg/border`, icon, `--text-sm`
`--color-error-fg`): "Rendez-vous annulé" + "Le professionnel vous
contactera au besoin." (ui.track.cancelled). **No reason shown**
(cancelledReason is internal, ARCH §2 — do not surface). Hero becomes
neutral: overline "RENDEZ-VOUS ANNULÉ", value "Annulé" (text-3xl,
`--color-error-fg`), meta original date/window "prévu le 12 nov., 8h–12h".
Timeline: steps up to last reached rendered done, the interrupted step
neutral-filled, remaining steps hidden. No map. Call CTA stays (this is the
main recourse for the customer).

## 1.8 State: rescheduled (RESCHEDULED)

Warning banner: "Rendez-vous déplacé — nouveau créneau : jeudi 14 nov.,
8h–12h" (ui.track.rescheduled). Hero back to the **scheduled-today/not-today
variant** of the new date (label "RENDEZ-VOUS CONFIRMÉ" / "INTERVENTION
PRÉVUE AUJOURD'HUI"). Timeline resets to step 1/2 current. No map.

## 1.9 State: expired / invalid link (410 / 404)

**Standalone full-screen page** (no business strip, no column cards):
centered block: 40px icon (link-off, `--color-text-muted`), title `--text-2xl`
600 "Ce lien a expiré" (410) or "Lien introuvable" (404 — uniform timing per
ARCH §4), body `--text-sm` muted 2–3 lines, then full-width 56px primary
"Appeler {business}" (`tel:`) + ghost "Recevoir un nouveau lien" is **not
available** (no auth on this page) — instead body says to contact the
business. Business name only if the token still resolves to a
business-safe projection (410 after expiry still knows the business per
ARCH §4 — show name + phone; 404: generic, no business data).
410 body: "Pour connaître la situation de votre intervention, contactez
Plomberie Martin au 01 23 45 67 89." 404 body: "Ce lien est invalide ou a
été révoqué. Vérifiez le message reçu par SMS."
Footer: "Propulsé par Il Arrive" + privacy link (only 410 variant).

## 1.10 Loading & error (initial fetch)

Loading: page shell (business strip skeleton + hero card with `--color-
surface-muted` blocks); text "Chargement…" `--text-sm` muted centered in
hero card. No spinner (calm).
Error (initial fetch fails after 2 tries): error state (component §14) in
the hero card position: "Impossible de charger les informations" +
secondary "Réessayer".
SSE: silent reconnect with `Last-Event-ID` + full refetch (ARCH §6) — **no
visible reconnect UI** for customers; if SSE is down the page remains valid
at last known state (no staleness claim added).

**Edge cases (track)**:
- ETA exists but position stale → 1.4. Position fresh but ETA null (routing
  failed) → hero meta "arrivant" without time, map shown; copy
  ui.track.hero.noeta.
- `etaSource=fake` (dev only): dev badge "estimation de démonstration"
  `--text-xs` — never in production config (ARCH §5).
- Business without logo/brandColor → initial tile + ink top rule.
- Very long address → 2-line clamp + expand.
- Window 8h–12h vs ETA 13h (outside window) → server still sends; show ETA
  as-is, meta "après le créneau prévu" if ETA > windowEnd (ui.track.hero.late).
- Phone missing → hide call CTA + tel icon; footer keeps product note.
- Reduced motion: no pulse, instant updates.
- 3G budget: no map JS before first live fix (ARCH §1).

---

# 2. Technician PWA (`apps/web` — `/tech`)

**User**: field professional, phone, gloves, sunlight, moving. One thumb,
zero training. Column `--tech-column-max` 480. PWA shell + service worker
(ARCH §1). Dark mode optional; light default.

**Golden path**: open → today list → tap intervention → "Je suis en route"
(grant location) → "Je suis arrivé" → "Intervention terminée". Every action
is a **single tap** on a 56px button in a **bottom-fixed action bar**
(`--shadow-md`, safe-area, `--space-4` inset, `--space-3` gap between buttons).

**Button grammar per state** (one primary max; imperative, short — copy.md):

| Detail state | Primary (56px) | Secondary (56px) | Note |
|---|---|---|---|
| SCHEDULED (today or future) | "Je suis en route" | "Prévenir d'un retard" | primary stays "Je suis en route" even for future dates (early start is normal in field work) |
| EN_ROUTE | "Je suis arrivé" | "Prévenir d'un retard" | + location card |
| ARRIVED | "Intervention terminée" | — | |
| COMPLETED | — | — | read-only + success banner |
| CANCELLED | — | — | error banner "Rendez-vous annulé" |

## 2.1 Login

Auth is shared with the dashboard (email + password, ARCH §8). Centered
card 420 on mobile: wordmark "Il Arrive" (ink), title "Connexion",
Input email, Input password (show/hide 44px), primary 56px "Se connecter",
ghost "Mot de passe oublié ?" (ui.tech.login.*). Error: inline field error
"Identifiants incorrects". Rate limit: "Trop de tentatives, réessayez dans
quelques minutes." On success → `/tech/today`.
Technician session: 30-day sliding (ARCH §8) — no logout needed in MVP, but
the avatar menu (top-right, 44px) has "Déconnexion" (ghost danger-ghost).

```
┌──────────────────────────────────┐
│                                  │
│              Il Arrive           │
│           Il arrive quand ?      │
│                                  │
│   Email                          │
│ ┌──────────────────────────────┐ │
│ │                             │ │
│ └──────────────────────────────┘ │
│   Mot de passe                   │
│ ┌──────────────────────────────┐ │
│ │                       [ show]│ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │          Se connecter        │ │
│ └──────────────────────────────┘ │
│        Mot de passe oublié ?     │
└──────────────────────────────────┘
```

## 2.2 Today list

Header: "Aujourd'hui" `--text-2xl` 600 + date `--text-sm` muted
("Lundi 10 novembre") + right: avatar (44 hit → menu). Sub-count line:
"5 interventions · 1 en cours" `--text-xs` muted.
Groups (order fixed): **En cours** (EN_ROUTE + ARRIVED) · **À venir**
(SCHEDULED, today, sorted by windowStart) · **Terminées** (COMPLETED,
sorted desc) · **Annulées** (only if any, collapsed by default).
Group label: overline + count. Rows = component §10 (time block, customer
+ address, StatusBadge sm + technician avatar). Tap → detail.
Active row (en route): `--color-enroute-bg` fill + 3px left rule
`--color-enroute-solid` + delay chip if delayed ("+30 min", warning).

```
┌──────────────────────────────────┐
│ Aujourd'hui                    ⊙ │
│ Lundi 10 novembre                │
│ 5 interventions · 1 en cours     │
├──────────────────────────────────┤
│ EN COURS                         │
│ ┃┌──────────────────────────────┐│
│ ┃│ 8h–12h  DUPONT, Marie   [badge]│
│ ┃│ 12 rue de la Paix, 75002     ││
│ ┃│ [Retard +30 min]             ││
│ ┃└──────────────────────────────┘│
│ À VENIR                          │
│ ┌──────────────────────────────┐ │
│ │ 13h–14h  BERNARD, Paul   ⊙   │ │
│ │ 4 av. Victor Hugo, 69003     │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ 15h–16h  MOREAU, Julie  ⊙    │ │
│ │ 22 r. des Lilas, 69008       │ │
│ └──────────────────────────────┘ │
│ TERMINÉES                        │
│ ✓ 10h–11h  MARTIN, Luc · 9h48    │
└──────────────────────────────────┘
```

**States**:
- **Empty**: block (component §14): icon calendar, "Aucune intervention
  aujourd'hui", sub "Les rendez-vous créés apparaîtront ici." No CTA
  (techs don't create).
- **Offline**: full-width neutral banner top (under header): "Hors ligne —
  liste du {date}, certaines informations peuvent être anciennes." Actions
  still tappable; a failed POST → error toast "Non envoyé. Vérifiez votre
  connexion." + retry via tapping the action again. No offline queue (MVP
  honesty, ARCH §5 foreground-only).
- **Loading**: 3 skeleton rows. **Error**: error state + "Réessayer".
- Future-day list (tech opens next day from a future intervention's
  window?): out of MVP — list is always **today**; interventions tomorrow
  appear in the detail's schedule line only.

## 2.3 Intervention detail

Top bar: back (44) + title = customer surname + "Intervention" context
(`--text-sm` muted sub-line) + overflow menu (kebab: "Copier l'adresse",
"Voir le créneau").

Body sections (Card spacing `--space-6`):
1. **Customer card**: name `--text-xl` 600, phone row (icon + national
   format `--text-sm` 500, tap = `tel:`) — phone is the **customer's** number.
2. **Address card**: address `--text-md` 500 (2 lines max), then button row:
   primary-secondary "Itinéraire" (48px, 60% width, icon) → navigate sheet
   (§2.6) + ghost "Copier" (40px, 40%).
3. **Description** (if present) card: `--text-sm`.
4. **Notes internes** (if present): muted card, `--text-sm`, label
   "NOTES INTERNES" overline.
5. **Schedule line**: "Mer. 12 nov. · 8h–12h" `--text-sm` muted (+ delay
   chip if delayed: "+30 min · nouvelle ETA 11h05", warning).
6. **Location card** (EN_ROUTE only):
   - **Sharing**: enroute tint: pulsing dot (`--motion-slow`, reduced-motion
     static) + "Position partagée avec le client" `--text-sm` 500
     `--color-enroute-fg` + meta "ETA estimé 10h42" + ghost button
     "Arrêter" (ui.tech.stop).
   - **Stopped**: neutral tint: "Position non partagée" + "Le client ne voit
     plus votre position." + secondary "Reprendre le partage".
   - **Permission denied** (was never granted or revoked): warning tint:
     icon, "Position non partagée", body "Activez la localisation du
     navigateur pour partager votre position en direct." + secondary
     "Activer la localisation" (re-triggers `watchPosition` prompt) + meta
     "Le suivi reste possible sans carte : le client voit le statut."
   Stop → confirm sheet (§2.7). Stop also happens automatically: background,
   3 h timeout, or ARRIVED (ARCH §5) — the card reflects the server state
   on next poll/SSE.
7. **Delayed banner** (delayMinutes set): warning tint, "Retard signalé —
   +30 min (vers 11h05)" + reason if the tech gave one.

**Action bar** (bottom-fixed, per §2 table): primary 56 full-width +
secondary 56 full-width stacked (gap `--space-3`), above the bar a 1px
`--color-border` hairline. Tap transitions → optimistic UI + toast
"Statut envoyé" (success) or error toast (409/401/network) — on 409 the
screen refetches and re-renders the correct state (e.g. dispatcher cancelled
in the meantime).

```
┌──────────────────────────────────┐
│ ←  DUPONT, Marie        [⋮]      │
│ 12 nov. · 8h–12h                 │
│ ┌──────────────────────────────┐ │
│ │ Marie Dupont   ☎ 06 12 34 56 │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ 12 rue de la Paix            │ │
│ │ 75002 Paris                  │ │
│ │ ┌────────────┐ ┌───────────┐ │ │
│ │ │ ⌖ Itinéraire│ │   Copier │ │ │
│ │ └────────────┘ └───────────┘ │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ Fuite sous évier, urgent     │ │
│ └──────────────────────────────┘ │
│ ──────────────────────────────── │
│ ┌──────────────────────────────┐ │
│ │ ◉ Position partagée avec le  │ │
│ │   client · ETA 10h42  [Stop] │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │       Je suis arrivé         │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │     Prévenir d'un retard     │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**States** (action bar per §2 table): SCHEDULED shows "Je suis en route" +
delay; EN_ROUTE per wireframe; ARRIVED: primary "Intervention terminée",
location card gone, green success banner "Vous êtes arrivé — 10h41" in the
body top; COMPLETED: no action bar, success banner "Intervention terminée à
11h20", read-only; CANCELLED: error banner "Rendez-vous annulé" + "Le
planificateur peut vous contacter.", read-only.

**Edge cases (detail)**:
- Transition rejected 409 (session expired / wrong assignee) → refetch,
  error toast "Action refusée. Actualisation…".
- Offline during action → error toast, state unchanged.
- GPS fix accuracy > 200 m → client drops fix (ARCH §5); location card add
  meta "Localisation imprécise" (neutral, no alarm).
- Screen backgrounded → stream stops (tech PWA is foreground-only, ARCH
  §5); on foreground return, auto-resume `watchPosition` if EN_ROUTE and
  permission still granted; location card re-syncs from server.
- Multiple interventions same window (conflict): dispatcher's problem; tech
  sees both in À venir, no visual conflict warning in MVP (ARCH: "at least
  surface scheduling conflicts" = dashboard side, §4.4).

## 2.4 Delay sheet (bottom sheet, `--radius-xl` top)

Trigger: "Prévenir d'un retard" (SCHEDULED or EN_ROUTE).
Content: title `--text-xl` 600 "Prévenir d'un retard"; sub `--text-sm`
muted "Le client sera informé par SMS." (only if DELAY pref on — otherwise
sub "Le client sera informé sur sa page de suivi.")
1. **Preset chips** (56px height, `--radius-lg`, 3-across grid,
   `--space-2` gap): "+15 min" / "+30 min" / "+60 min" (radio behaviour,
   selected = primary ink fill white text; unselected = secondary).
2. **Raison** (optional): Textarea 2 lines, placeholder "Ex. : accident sur
   l'autoroute" — optional, `aria-hidden` false, label "Raison (optionnel)".
3. Preview line (live, `--text-sm`): "Nouvelle arrivée estimée vers **11h12**"
   (current ETA or window end + delay, tabular).
4. Footer: primary 56 "Envoyer le retard" + ghost "Annuler" (44).
On confirm: POST delay (sets delayMinutes + reason, intervention keeps its
state — overlay per ARCH §3), success toast "Retard signalé au client",
sheet closes, detail re-renders (delay banner + chip). If already delayed:
preset replaces previous (one active delay), preview computes from original
ETA, not cumulative.
Keyboard (desktop access): chips are radio buttons, Enter confirms.

## 2.5 Geolocation-denied state (full-screen variant)

When the tech is on the **en-route screen** but has no permission and has
never granted: replace the location card with the warning variant (§2.3.6)
**and** add a blocking-style neutral card above the action bar (not a modal
— techs must be able to proceed): title "Position non partagée", body
"Le client ne verra pas votre position sur la carte. Vous pouvez continuer
sans localisation." + secondary "Activer la localisation".
"Je suis en route" still works (session starts; customer sees status without
map → stale-neutral card on their side, same copy as 1.4 minus the ETA
timestamp nuance).

## 2.6 Navigate sheet

Title "Itinéraire". Three 56px rows (icon + label + chevron):
- "Apple Maps" (`maps-apple://` / `http://maps.apple.com/?daddr=lat,lng`)
- "Google Maps" (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`)
- "Waze" (`waze://?ll=lat,lng&navigate=yes`)
Ghost footer: "Copier l'adresse". Meta line: "L'adresse est géocodée — le
parcours utilise votre position actuelle." (device geolocation for route
start is handled by the nav app, not us).
If a scheme fails to open (no app), the row falls back to the web URL
(Google) or shows toast "Application non trouvée" (Apple/Waze).

## 2.7 Stop-sharing sheet (confirm)

Title "Arrêter le partage de position?". Body: "Le client ne verra plus
votre position et gardera la dernière estimation. Le rendez-vous et le
statut « en route » sont conservés." Footer: secondary "Reprendre" +
primary "Arrêter" (danger-ghost? no — this is not destructive, use
secondary ink border). On confirm: POST stop (session keeps EN_ROUTE,
location stream ends client-side), location card → Stopped variant, toast
"Partage de position arrêté".

## 2.8 Offline state (global)

`navigator.onLine` false → neutral banner under app header on **all**
/tech screens: "Hors ligne — les changements ne seront pas envoyés."
No skeleton, no fake data. On reconnect: banner clears + full refetch of
list/detail.

**Edge cases (PWA)**: app installed vs browser — identical (PWA shell
optional). iOS Safari PWA: no background location — never claim it (copy
never says "en arrière-plan"). Deep link `/tech/i/:id` (from dashboard
"voir chez le technicien") → detail directly.

---

# 3. Business dashboard (`apps/web` — `/app`)

**User**: owner/dispatcher, desktop-first, keyboard-heavy, coffee. Roles:
OWNER everything; DISPATCHER interventions + technicians view (ARCH §8);
TECHNICIAN role never sees /app (redirects to /tech).

**Shell**: left sidebar 240px (`--app-sidebar-w`): business logo 28 + name
(top, 56px), nav (icon + label, active = `--color-enroute-bg`? no — active
fill `--color-surface-muted` + label `--color-text-primary` 500 + 3px left
rule ink): **Aujourd'hui** · **Interventions** (all/history) · **Équipe** ·
**Paramètres**; bottom: plan badge ("Essai jusqu'au 26/11" `--text-xs`
muted or "Solo · 9 €" post-MVP). Content area: `--app-content-max` 1280
centered, page padding `--space-8`. Top-right global action: primary
"New intervention" button (label "Nouvelle intervention") present on
Aujourd'hui + Interventions pages.
Below `--bp-lg`: sidebar collapses to top bar with horizontal nav.

## 3.1 Login / register

Same card layout as tech login (420 centered) — one auth for both.
Title: "Se connecter". Fields: email, password. Primary "Se connecter".
Divider "ou". Secondary (ghost) "Créer un compte" → register view (same
page, no reload): business name, email, password, checkbox-free (no terms
in MVP; privacy link in footer), primary "Créer mon compte".
Register success → onboarding (§3.2). Login error inline per components §2.
Footer: "Confidentialité · CGV?" — no CGV in MVP, privacy only.

## 3.2 Onboarding (3 steps)

One page, left progress rail (desktop) / top steps (mobile):
**1 Entreprise → 2 Technicien → 3 Première intervention**. Progress:
completed = success dot, current = ink ring, upcoming = border dot; labels
`--text-sm`. Back/Continue buttons; steps are skippable except step 3
(step 2 explicitly skippable via "Je travaille seul").

**Step 1 — Business profile**: name (prefilled from register), phone
(Phone input component), logo upload (drop zone 96px: "Glissez votre logo
(PNG/JPG, 512×512 max)" + "Choisir un fichier"; preview + "Retirer" ghost),
brand color (8 swatches: ink, blue `#2E6BE6`, green `#2E9E5B`, amber
`#D97706`, red `#D14338`, purple `#7C5CBF`, teal `#2A9D8F`, "Aucune"
default = ink ring). Continue (primary, disabled until name + valid phone).

**Step 2 — First technician**: intro line "Qui réalisera les interventions ?"
Two large option cards (radio, 56px min, stacked):
- **A** "J'invite un technicien" — email input + role select (Technicien
  default, locked to Technicien in MVP) + "Inviter" secondary button →
  creates Invitation (7 days, ARCH §8) + toast "Invitation envoyée à {email}".
- **B** "Je travaille seul" (primary option card, recommended ring when no
  techs yet) → sets OWNER membership `isTechnician=true`.
Both selectable; if invite sent, tech card shows pending chip "En attente —
{email}". Continue enabled when: invite sent **or** "seul" selected.

**Step 3 — First intervention**: compact create form (same fields as §3.5
but no notes; technician select = the invitee (disabled, "en attente") or
"Vous" when solo). CTA "Créer la première intervention".
On success → **success screen**: success icon, "C'est prêt !" `--text-3xl`,
body "Le lien de suivi de votre premier rendez-vous est prêt.", Card with
the tracking link (truncated, `--text-sm`, copy button "Copier le lien" +
secondary "Envoyer par SMS" (sends CONFIRMATION — this is the one manual
CONFIRMATION the pref system anticipates)) + explanation line "Quand le
technicien partira, le client recevra automatiquement le lien avec
l'heure d'arrivée estimée." CTA "Ouvrir le tableau de bord" → /app.

```
┌──────────────────────────────────────────────────────────┐
│  ●──○──○   1 Entreprise · 2 Technicien · 3 Intervention │
│                                                          │
│  Qui réalisera les interventions ?                       │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ⊙ J'invite un technicien                             │ │
│ │   [email input              ] [Technicien ▾] [Inviter]│ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ○ Je travaille seul                                  │ │
│ │   Je serai le technicien de mes interventions        │ │
│ └──────────────────────────────────────────────────────┘ │
│                          [Retour]  [Continuer →]         │
└──────────────────────────────────────────────────────────┘
```

**States**: all three steps have a skeleton (first data load), error
(retry), and "already configured" short-circuit: a business that completes
onboarding but creates interventions later gets no forced onboarding —
step 3 is the only one that can be re-entered from /app via the today-view
empty state CTA.

## 3.3 Today view (`/app` — default landing)

Header: "Aujourd'hui" `--text-3xl` 600 + date `--text-sm` muted + count
"7 interventions" · right: segmented **Liste | Calendrier** (component §17
segmented) + primary "Nouvelle intervention".
**Liste** (default): sections (order fixed, empty sections hidden):
**En retard** (SCHEDULED/EN_ROUTE with delayMinutes) · **En route**
(EN_ROUTE without delay) · **À venir** (SCHEDULED, by windowStart) ·
**Terminées** (COMPLETED, desc) · **Annulées** (if any). Section header:
label `--text-overline` + count + (for En retard: average? no — just count).
Rows = component §10 desktop (56px, time block 96px, customer, address
truncated, technician avatar+initials, StatusBadge md + delay chip).
Row click → drawer (§3.4). Row hover actions appear (kebab → menu §18:
Copier le lien, Renvoyer par SMS, Régénérer le lien, Annuler,
Reprogrammer).
**Empty state** (no interventions today): block §14: icon calendar,
"Aucune intervention aujourd'hui", body "Créez un rendez-vous pour
générer son lien de suivi." + primary "Nouvelle intervention" (the
onboarding step-3 shortcut).
**States**: loading = 4 skeleton rows; error = error block + retry; SSE
live: row swaps section on status change with 200ms fade (no scroll jump —
keep position until user interacts; new arrival to "En route" gets a
one-time `--color-enroute-bg` flash 800ms).

```
┌────────────────────────────────────────────────────────────────┐
│ Aujourd'hui · Jeudi 12 nov.        [Liste|Calendrier] [+Nouvelle]│
├────────────────────────────────────────────────────────────────┤
│ EN RETARD (1)                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 08h–12h  DUPONT, Marie    12 rue de la Paix    ⊙ [En route][+30] │
│ └────────────────────────────────────────────────────────────┘ │
│ EN ROUTE (2)                                                   │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 13h–14h  BERNARD, Paul    4 av. Victor Hugo     ⊙ [En route] │
│ │ 14h–15h  GARCIA, Ana      8 r. Pasteur          ⊙ [En route] │
│ └────────────────────────────────────────────────────────────┘ │
│ À VENIR (3)                                                    │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 15h–16h  MOREAU, Julie    22 r. des Lilas     ⊙ [Prévu]     │
│ │ …                                                          │ │
│ └────────────────────────────────────────────────────────────┘ │
│ TERMINÉES (1)                                                  │
│ ✓ 10h–11h  MARTIN, Luc     5 pl. de la Rep     ⊙ [Terminée]     │
└────────────────────────────────────────────────────────────────┘
```

**Calendrier** (tab): week grid, 7 columns (Lun–Dim), header row with day
+ date, today column: `--color-surface` fill + 2px top rule `--color-ink` +
"Aujourd'hui" overline. Cells: hour-free blocks per day (not a busy grid —
windows): each intervention chip (h 40: window start `--text-xs` 500 +
customer `--text-xs` truncated + status dot + tech avatar 20) stacked,
`--space-1` gap; > 4 → "+3 autres" ghost (click → day list overlay? keep:
chips scroll within column, column min-height 320). Chip click → drawer.
Click empty day area → create form prefilled with that date.
Below `--bp-md`: calendar tab hidden (list only).

## 3.4 Intervention drawer (side panel, 480px)

Opens from any row/chip. Sections top→bottom (sticky header + scroll body):
- Header: customer name `--text-xl` 600 + StatusBadge md (+ delay chip) +
  close (44).
- **Contact card**: phone (icon + number + "Appeler" ghost 40), email if set
  (mailto ghost).
- **Address card**: address + ghost "Copier".
- **Statut & actions** (per current state, one line): SCHEDULED → [Annuler
  (danger-ghost 40)] [Reprogrammer (secondary)]; EN_ROUTE → "En route depuis
  9h58 · ETA 10h42" + [Annuler (danger-ghost)]; ARRIVED → "Arrivé à 10h41" +
  [Marquer terminée (primary 40) — dispatcher can complete? No: completion
  is the technician's action (ARCH state machine actor). Dispatcher gets
  [Annuler (danger-ghost)] only]; COMPLETED → "Terminée à 11h20" (read-only);
  CANCELLED → "Annulée" (read-only).
  - **Annuler** → modal (§12): "Annuler l'intervention ?" + reason textarea
    (optional, internal) + "Le client sera notifié par SMS (préférence :
    activée)." + [Annuler] [Confirmer l'annulation] (danger).
  - **Reprogrammer** → inline in drawer: Date + time-window picker (§7) +
    [Enregistrer] [Fermer]. On save: RESCHEDULED SMS per prefs, drawer
    refreshes, toast "Intervention déplacée au 14 nov., 8h–12h".
- **Lien de suivi card**: overline "LIEN DE SUIVI", truncated URL
  `--text-sm` mono-ish (tabular), actions row: [Copier] [Renvoyer par SMS]
  [Régénérer] (all 40px secondary; Régénérer → confirm modal "Le lien
  actuel cessera de fonctionner immédiatement. Le client devra recevoir le
  nouveau lien." [Annuler] [Régénérer]). Copied → toast "Lien copié".
  Regenerated → new link + toast + audit log (ARCH §9).
- **Description** + **Notes internes** cards (edit pencil ghost 40 → inline
  Textarea + save, SCHEDULED only).
- **Timeline** (component §16, all events incl. actor: "Marque en route —
  Marc" + timestamps).
- Footer meta: "Créée le 10/11 à 18h22 par Vous" `--text-xs` muted.

## 3.5 Create / edit form (`/app/interventions/new`, edit: `/app/interventions/:id/edit`)

Full page, centered column 480. Header "Nouvelle intervention" /
"Modifier l'intervention" + ghost "Annuler" (dirty-guard §19).
Fields (order = tab order; **defaults** for the <30 s target):
1. Nom du client (Input, required) — placeholder "Ex. : Marie Dupont"
2. Téléphone (Phone input, required)
3. Adresse (Address autocomplete, required) — "Ex. : 12 rue de la Paix, Paris"
4. Date (Date input, default **today**) + Créneau (time-window, default
   **next standard window**: 8h–12h before 12:00, else 13h–18h; chips §7)
5. Technicien (Select; default = last-used technician; options =
   isTechnician memberships; none available → inline prompt "Invitez un
   technicien ou travaillez seul" + link to team page / solo toggle)
6. Description (Textarea, optional)
7. Notes internes (Textarea, optional, muted card "Ne sera jamais visible
   par le client.")
Footer bar: [Annuler (secondary)] [Créer l'intervention (primary, 56)] —
Enter in any field submits (single-column form).
**< 30 s evidence**: 3 of 7 fields prefilled (date, window, tech); 4 taps +
typing name/phone/address (autocomplete = 2 taps); no modal on success.
Success (create): navigate to today view + toast "Intervention créée —
lien de suivi prêt" + the new row's drawer opens (link card visible) with
"Renvoyer par SMS" highlighted (focus moves there).
Edit: same form prefilled; SCHEDULED → all editable; EN_ROUTE → only
reschedule/cancel (form shows read-only notice + those two actions);
ARRIVED/COMPLETED/CANCELLED → edit form unavailable (drawer actions only).
**Keyboard**: Tab order as listed; Esc closes with dirty-guard; arrow keys
in selects/autocomplete per components §4/§6.

## 3.6 Team page (`/app/team`)

Header "Équipe" + primary "Inviter un membre".
**Invite card**: email Input + role Select (Propriétaire/Coordinateur/
Technicien) + "Envoyer l'invitation" secondary → creates Invitation
(7-day, single use, ARCH §8), toast "Invitation envoyée à {email}".
Pending invites list: email + role + "Réenvoyer" ghost + "Retirer"
danger-ghost.
**Members table**: columns: Membre (avatar + name + "vous" chip if self) ·
Email · Rôle (Select, disabled for self in MVP — role transfer post-MVP) ·
Technicien (toggle: "Peut réaliser des interventions") · Actions (kebab:
"Révoquer l'accès" → confirm modal "X ne pourra plus accéder aux
interventions." [Annuler] [Révoquer] danger).
Rules (ARCH §8): OWNER full incl. settings; DISPATCHER interventions +
team view (no settings, no invite? — dispatcher invites: allow, roles
Technician only); TECHNICIAN no /app access. Solo business: owner row with
Technicien toggle ON by default post onboarding.
**States**: empty team (solo) → card "Vous travaillez seul — ajoutez un
technicien quand vous êtes prêt."

## 3.7 Settings (`/app/settings`)

Single column 640, sections (Card + section title `--text-2xl`):
1. **Profil de l'entreprise**: name, phone, logo upload, brand color
   (same controls as onboarding step 1) + "Enregistrer" primary (success
   toast) + "Voir la page client" ghost (opens last generated link in new
   tab — live preview of branding).
2. **Notifications SMS**: per-kind toggle rows (Switch component: 44px hit,
   on = ink):
   - Confirmation (default **off** — manual send at creation)
   - Départ / en route (**on**) · Retard (**on**) · Mise à jour d'heure
     (**on**) · Arrivée (**off**) · Annulation (**on**) · Remise à plus tard
     (**on**)
   Each row: label `--text-sm` 500 + description `--text-xs` muted (1 line,
   copy.md) + Switch. Save = immediate per toggle (toast "Préférences
   enregistrées").
3. **Quota SMS**: usage bar (track-style progress: fill `--color-ink`,
   amber > 80%, red 100%) "142 / 250 SMS ce mois" + note `--text-xs` muted
   "Au-delà du quota, les SMS ne sont plus envoyés. Le partage manuel du
   lien reste possible." + (when over) amber banner top of page: "Limite de
   SMS atteinte pour ce mois — les clients ne reçoivent plus de SMS."
4. **Plan** (read-only in MVP): "Essai — se termine le 26 nov. 2026" +
   plan name; no billing UI (out of scope).
**States**: loading skeletons per section; error retry.

## 3.8 Global dashboard states

- **SSE disconnected** (dashboard `/app/events`): header right gets a small
  neutral dot + tooltip "Reconnexion…" — silent, content stays last-known;
  reconnect = full refetch (ARCH §6). No banner.
- **Trial banner** (trial business, top of content, dismissible per
  session): neutral tint "Essai gratuit jusqu'au 26 nov." — no upsell copy
  (billing out of scope).
- **Empty dashboard brand-new** (no interventions ever): today view empty
  state doubles as onboarding CTA (point to "Nouvelle intervention").

---

# 4. Cross-screen rules

1. **Single source of status**: every screen derives labels/colors from the
   §status mapping — no screen-local color or copy.
2. **Copies are final** in `copy.md`; screens reference ids, do not restate
   wording. Changing wording = change copy.md, not screens.md.
3. **Time formatting**: `HH:MM` 24 h (French norm), dates
   `ddd. D MMM.` (abbreviated French month, lowercase), windows
   `8h–12h`. All times tabular-nums.
4. **Never** show position outside EN_ROUTE+fresh (track), never show
   internal notes outside dashboard, never claim background tracking
   anywhere.
5. **Reduced motion**: pulse off, section flash off, drawers/sheets still
   fade (opacity only, 120ms).
6. **Touch targets**: 44 min mobile, 56 action buttons; icon-only 32 only
   desktop dashboard (with 8px padding = 48 effective).
7. **Empty ≠ error**: empty states invite (CTA where the actor owns the
   action), errors always get a retry.
