---
name: La Matinale
description: The cover's dawn sky over the sea, extended into a private morning podcast app that follows Geneva's real sunrise.
colors:
  horizon-rose: "#93503f"
  accent-ink: "#ffffff"
  night: "#141a3a"
  dawn-violet: "#3a2a55"
  horizon-copper: "#a8604f"
  sun-gold: "#ffd796"
  glint-gold: "#f6c27e"
  glint-ember: "#e8955a"
  cream: "#fff8ee"
  voice-lea: "#f2b84b"
  voice-lea-ink: "#8a5a00"
  voice-hugo: "#e07a6b"
  voice-hugo-ink: "#a33a2c"
  voice-zoe: "#6fa8e6"
  voice-zoe-ink: "#1f5f9e"
  lavender-mist: "#f1eff5"
  surface: "#ffffff"
  surface-2: "#e9e6ef"
  accent-soft: "#ebe7f1"
  line: "#dfdbe8"
  ink: "#17162a"
  ink-2: "#57536b"
  ink-3: "#67637c"
  good: "#166534"
  good-soft: "#dcf2e3"
  bad: "#b42318"
  bad-soft: "#fde4e1"
typography:
  display:
    fontFamily: "Figtree Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Figtree Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  edition:
    fontFamily: "Figtree Variable, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 300
    letterSpacing: "-0.01em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.45
  meta:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  sky: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "36px"
components:
  button-primary:
    backgroundColor: "{colors.horizon-rose}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 18px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 18px"
    height: "44px"
  button-ghost:
    textColor: "{colors.horizon-rose}"
    rounded: "{rounded.lg}"
    padding: "12px 18px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.accent-soft}"
  button-sky:
    backgroundColor: "{colors.sun-gold}"
    textColor: "#1b1206"
    rounded: "{rounded.lg}"
    padding: "12px 18px"
  play-button:
    backgroundColor: "{colors.night}"
    textColor: "{colors.sun-gold}"
    rounded: "{rounded.pill}"
    size: "64px"
  group:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
  list-item:
    padding: "14px 16px"
    height: "52px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 12px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
    height: "44px"
  chip-pressed-up:
    backgroundColor: "{colors.good-soft}"
    textColor: "{colors.good}"
  tab-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    height: "64px"
  tab-active:
    textColor: "{colors.horizon-rose}"
  sky-band:
    textColor: "{colors.cream}"
    padding: "28px 20px 62px"
  snack:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.lavender-mist}"
    rounded: "{rounded.xl}"
    height: "52px"
---

# Design System: La Matinale

## Overview

**Creative North Star: "The Sky Behind the Train Window"**

La Matinale is the podcast cover come to life. Each tab opens on a band of real sky: the gradient, the stars, and the height of the sun are computed from Geneva's actual sunrise and sunset, minute by minute, so the band at 6:40 on the Geneva–Lausanne train looks like the sky outside. At the bottom of the band, a strip of night sea carries the cover's golden reflections under the sun. Below the band the app is quiet and practical: lavender-tinted panels in light mode, deep night blue in dark mode, grouped rows, thumb-sized controls.

The world has two registers. The sky band is atmosphere: it moves slowly (1s transitions on stars, sun, glints and sea height; the gradient itself switches minute by minute, since CSS cannot animate gradients), it carries the bold Figtree title and the two-weight edition number, and it is the only full-colour surface. The working surfaces underneath borrow from the same night: the canvas is night-tinted, the play button is night with a sun, and the light-mode accent is the horizon's rose, darkened for reading. Three voice hues (Léa gold, Hugo rose, Zoé sky blue) mark who is speaking where it matters. Glints follow the sun's height: full when it sits low on the water, gone when it is high or set; an hour before sunrise a single ember glint and the sun's rim announce the day, with the sunrise time written on Écouter.

Density is mobile and one-thumb: a single 640px column, 44px minimum targets throughout, and a fixed 64px tab bar with a floating mini-player above it. The anti-reference is the grey iOS settings list with an orange accent. The grouped-row structure stays, but it sits on night-tinted ground with a horizon accent.

**Key Characteristics:**
- A real-time sky band heads every tab: night, dawn, day, and evening, following Geneva's actual sunrise and sunset.
- Cover motifs reused as marks: golden reflection lines on the sea and on the active tab.
- Night-tinted neutrals: pale lavender in light mode, night blue in dark mode.
- Heavy, tight Figtree for display; system sans for everything functional.
- One colour per voice, used only where that voice is present.
- Soft, ambient elevation. Only floating layers lift.

## Colors

The palette is the cover at the instant of sunrise: night blue, dawn violet, a copper horizon, and a pale gold sun. The UI neutrals are tinted from that night.

### Primary
- **Horizon Rose** (horizon-rose): the light-mode accent. Used for primary buttons, links, active tab label, focus rings, current chapter, meters, and picked quiz answers. It is the cover's horizon, darkened until white text reads on it. In dark mode the accent becomes **Sun Gold**, with night-blue ink on it.

### Secondary
- **Night** (night): the cover's sky top and the sea strip. Used as the play button and scrub track/thumb in light mode, the "on" state of switches in light mode, and the status-bar theme colour in both modes. In dark mode the play button inverts to Sun Gold with Night on top.
- **Sun Gold** (sun-gold): the sun disc, the primary button inside the sky band (with near-black `#1b1206` text), the play-button glyph in light mode, and the dark-mode accent.

### Tertiary
- **Dawn Violet** and **Horizon Copper** (dawn-violet, horizon-copper): the middle and horizon stops of the cover-instant sky. The band's live colours are interpolated in `lib/sky.ts` between eleven keyframes (night, late, predawn, cover, morning, forenoon, noon, afternoon, dusk, sunset, evening). They are not tokens, and none of them is ever used outside the band.
- **Glint Gold / Glint Ember** (glint-gold, glint-ember): the seven reflection lines on the sea. They narrow from 84px to 14px, are centred under the sun, and the last line is ember. Glints fade to 0 when the sun is up high or below the sea.
- **Cream** (cream): all text inside the sky band.
- **Voices**: **Léa** (voice-lea) gold, **Hugo** (voice-hugo) rose, **Zoé** (voice-zoe) sky blue. The fill hues mark the quiz letters and voice dots. The `-ink` variants are readable text on the canvas, and they lighten in dark mode (Léa `#f2b84b`, Hugo `#f08a7c`, Zoé `#7db4ee`).

### Neutral
- **Lavender Mist** (lavender-mist): the light-mode canvas. Dark mode uses `#0e1124`.
- **Surface / Surface 2** (surface, surface-2): grouped panels (white / `#171b33`), plus wells, inactive tracks, secondary buttons, and hover fills (`#e9e6ef` / `#22274a`).
- **Accent Soft** (accent-soft): a quiet violet fill for the "Grâce à tes retours" panel, the end-of-episode prompt, the update banner, pills, and picked answers (`#262a52` in dark mode).
- **Line** (line): hairline dividers between rows and around chips (`#2a2f52` in dark mode).
- **Ink / Ink 2 / Ink 3** (ink, ink-2, ink-3): primary text, secondary text and meta, tertiary text such as chevrons, timestamps, and placeholders.
- **Good / Bad** (good, good-soft, bad, bad-soft): states only. Use them for thumbs up/down, saved pills, over-length warnings, and errors.

### Named Rules
**The Real Sky Rule.** The band's colour is never a static gradient. It is computed from Geneva's real sunrise and sunset (NOAA formula, Europe/Zurich time) and recomputed every minute. A new surface that wants the band uses the band component; it never paints its own sky.

**The Night and Sun Rule.** Listening controls wear the cover's two poles. In light mode the play button is night with a gold glyph. In dark mode it is a gold disc with a night glyph. The scrub track and thumb follow the same rule. The accent swaps the same way: Horizon Rose in light mode, Sun Gold in dark mode.

**The Voice Ownership Rule.** Voice hues appear only where a voice is present: the face-à-face letters and names, the "Zoé" tag on the météo chapter. The one exception is the cover's gold-over-rose reflection mark (the active-tab mark and the mini-player's progress line). A voice hue is never a generic accent.

## Typography

**Display Font:** Figtree Variable (self-hosted via @fontsource-variable, falls back to the system sans)
**Body Font:** the system sans stack (-apple-system, SF Pro Text, Segoe UI, Roboto)

**Character:** Figtree at 800 with tight negative tracking carries the cover's heavy masthead. Everything you read while operating the app stays in the native system face at ordinary weights.

### Hierarchy
- **Display** (Figtree 800, 2rem, 1.08, -0.03em): the tab title in the sky band (Mon avis, Thèmes, Réglages). On Écouter the band is taller and the episode title, longer, drops to 1.75rem.
- **Headline** (Figtree 800, 1.75rem, 1.2, -0.025em): page `h1` outside the band. The login title is 2rem.
- **Edition** (Figtree 1.0625rem, "N°" at 300 and the number at 800): the edition number in the sky meta line.
- **Title** (system 650, 1.25rem, -0.01em): section headings ("Le face-à-face", chapters). `h3` is 1rem at 600.
- **Body** (system 400, 1rem, 1.5): running text. The episode summary uses line-height 1.6 and a 65ch maximum. The sky meta line uses 0.9375rem at 1.45 with a 56ch maximum.
- **Label** (system 500, 0.875rem): form labels, chips, small buttons, hints.
- **Meta** (system 400, 0.8125rem): row meta, field hints, update and offline banners. Tab labels and the time readouts are 0.75rem.

### Named Rules
**The Two-Weight Edition Rule.** The edition number repeats the cover's thin/black contrast: "N°" at 300, the number at 800, both in Figtree. No other element uses the thin weight.

**The Figtree-Is-the-Masthead Rule.** Figtree is reserved for `h1`, the sky title, and the edition number. Buttons, rows, labels, and section titles stay in the system sans.

**The Tabular Time Rule.** Every time, duration, cue, and count (`time`, `.num`, stepper output) uses tabular figures.

## Layout

There is one centred column, 640px wide. The page wrapper pads 24px on top and 16px on the sides. Its bottom padding clears the tab bar, the mini-player, and the safe area (tab bar + 112px). Sections are separated by 36px. Within a section the rhythm is 4/8/12/16px, and 12px is the default gap between stacked groups.

The sky band runs full-bleed on phones. It uses negative margins to cancel the wrapper padding, and it extends under the status bar (`viewport-fit: cover`, safe-area top padding). Above 641px, the band sits inside the column and rounds its bottom corners. Band content keeps 72px clear on the right so the sun can rise beside the title. The tall variant (Écouter) adds 8px above and 6px below.

Fixed and sticky layers stack in a set order. From the bottom: the tab bar (64px + safe area), then the mini-player 8px above it, then the snack 12px above the tab bar (moved up to 80px when the mini-player is present, and 76px when the send bar is), and the send bar. The update and offline banners stick to the top. Layers never overlap; each one offsets for the others with `body:has()`.

## Elevation & Depth

The elevation is mostly flat and tonal. Grouped panels lift only slightly with an ambient double shadow. Wells and secondary fills use Surface 2 instead of shadow. Floating layers (mini-player, snack, send bar, dragged theme) get a deeper, wider shadow, because they sit over content. The sky band has no shadow. Its depth comes from the sun's radial glow and the sea strip that occludes it.

### Shadow Vocabulary
- **Panel** (`0 1px 2px rgba(23,22,42,.06), 0 4px 16px rgba(23,22,42,.06)`, dark mode `0 1px 2px rgba(0,0,0,.45)`): grouped rows, the "prochaine rédaction" card.
- **Float** (`0 8px 28px rgba(0,0,0,.18), 0 0 0 1px var(--line)`): the mini-player and the send-bar play button (`0 8px 24px rgba(0,0,0,.16)`).
- **Snack / Drag** (`0 10px 30px rgba(0,0,0,.25)` / `0 10px 30px rgba(0,0,0,.22)`): the bottom message, and a theme row being dragged.
- **Play** (`0 8px 22px rgba(20,26,58,.28)`; dark mode `0 6px 18px rgba(0,0,0,.45)`): the night play button.
- **Sun glow** (radial gradient `rgba(255,210,140,.42)` falling to transparent at 70%, 46px beyond the disc): only on the sun.

### Named Rules
**The Stars Stay Clear Rule.** Stars are masked to the right third of the band (transparent to 66%, solid from 82%), so they never sit behind text where they would read as accents.

## Shapes

Corners are soft and rounded, and the radius steps up with the container: 8px for skeletons, domain chips, and the cover thumbnail; 10px for inputs, small buttons, tab hit areas, and the speed toggle; 12px for buttons, flashes, quiz choices, and the stepper; 14px for grouped panels, the mini-player, and the snack. The band's bottom corners are 24px on wide screens. Chips, pills, meters, and the switch are fully round (999px), and the play, skip, and mini buttons are circles. Borders are 1px hairlines in Line. The editor uses a dashed top border, and "add" chips use dashed borders. The cover's reflection line (3px high, 3px radius, stacked in narrowing widths) is the system's one signature mark.

## Components

### Buttons
- **Shape:** gently rounded (12px). Small buttons are 10px. Every button is at least 44px tall.
- **Primary:** Horizon Rose fill with white text in light mode, Sun Gold with Night text in dark mode, 600 weight at 0.9375rem, padded 12px 18px. On hover the fill mixes 12% toward black. Disabled primary buttons fall back to Surface 2 with Ink 3 text.
- **Secondary (default):** Surface 2 fill with Ink text. Hover tints it 8% toward Ink.
- **Ghost:** a transparent button with accent text; hover fills it with Accent Soft. **Danger** is ghost-style with Bad text and a Bad Soft hover.
- **In the sky:** the band's button is Sun Gold with near-black text.
- **Press:** scale 0.98 over 100ms.

### Play Button (signature)
A 64px disc in Night with a Sun Gold glyph, inverted in dark mode. The 48px skip buttons on either side show their seconds in tiny 700-weight figures, and the speed toggle is a 10px-radius Surface 2 pill. The scrub is a 5px track filled with Night (light) or Sun Gold (dark), with a 16px thumb.

### Chips
- **Style:** pill (999px), Surface fill, Line border, Ink 2 text at 0.875rem/500, 44px tall. Dashed borders mark "add more".
- **State:** when pressed in the thumbs-up group, Good Soft with Good text; in the thumbs-down group, Bad Soft with Bad text. Pressed chips drop the border.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** Surface on the night-tinted canvas. Feedback panels ("Grâce à tes retours", end of episode) use Accent Soft instead.
- **Shadow Strategy:** the Panel shadow (see Elevation).
- **Border:** none outside. Hairline Line dividers between rows.
- **Internal Padding:** rows are 14px 16px with a 52px minimum height (64px for setting and theme rows). Padded cards use 16px.

### Inputs / Fields
- **Style:** Surface fill, 1px Line border, 10px radius, 11px 12px padding. Inside a group, the input switches to a Surface 2 fill with no border.
- **Focus:** the border turns to the accent, with a 3px accent halo at 22% (`color-mix`).
- **Error:** a Bad border with Bad 0.8125rem text below. Switches are 51×31px, Surface 2 when off and Night (dark mode: Léa gold) when on.

### Navigation
A fixed bottom tab bar (64px plus safe area) on Surface with a top hairline. It holds four tabs (Écouter, Mon avis, Thèmes, Réglages), each a 24px stroke icon over a 0.75rem/500 label in Ink 2. The active tab turns its label to the accent and draws the cover's reflection mark centred above it: a 22×3px Léa-gold line over a 12×2px Hugo-rose line.

### Sky Band (signature)
A header on every tab, with Cream text. The gradient runs top → mid (60%) → horizon. Stars come from 46 fixed radial-gradient points, masked right. The 56px Sun Gold sun sits 22px from the right edge and rises out of a 40px Night sea according to Geneva's real solar height, sinking below the water after sunset. Seven glint lines narrow under it. Écouter uses the tall variant with the episode title, edition, date, and duration. The other tabs carry their title and "Prochaine rédaction dans …".

## Do's and Don'ts

### Do:
- **Do** open every tab with the sky band component and let `lib/sky.ts` decide its colours from the real Geneva sun.
- **Do** keep Figtree 800 with negative tracking for titles, and keep everything you operate in the system sans.
- **Do** dress listening controls in Night and Sun Gold, inverted between light and dark mode.
- **Do** keep every tap target at least 44px, with 52–64px rows.
- **Do** use the cover's reflection line (gold over rose) as the app's mark for "current" and "progress".
- **Do** offset each fixed layer (mini-player, snack, send bar) so that none ever covers another.

### Don't:
- **Don't** return to the grey iOS settings list with an orange accent. The canvas is night-tinted and the accent is the horizon.
- **Don't** use Léa, Hugo, or Zoé colours as a general accent or decoration away from their voice or the reflection mark.
- **Don't** let stars or glints sit behind text.
- **Don't** paint sky colours (dawn violet, horizon copper, keyframe values) outside the band.
- **Don't** use Figtree's thin weight anywhere but the "N°" of the edition number.
