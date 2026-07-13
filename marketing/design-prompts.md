# Comma — Design Prompt Library

Copy-paste prompts for a design/image agent. One asset per prompt. Every prompt is
self-contained once you paste the **Brand Block** where it says `[BRAND BLOCK]`.

**How to use this file**

1. Pick an asset from the inventory below.
2. Copy the fenced prompt, replace `[BRAND BLOCK]` with the Brand Block text.
3. Attach the reference images listed for that prompt (paths are in this repo).
4. Generate 3–4 variations, run the QA checklist at the bottom, pick one, ship.

> **Generation round 1 — QA results (2026-07-13).** Outputs landed in
> `assets/generated_designs/`, finals in `marketing/final/`. Verdicts:
>
> | Asset | Verdict | Final file |
> |---|---|---|
> | A1 | Square (1024²), unusable for 1024×500 — **rebuilt in HTML** with real assets | `final/store/feature-graphic-1024x500.png` (+ editable `final/src/a1-feature.html`) |
> | B1 | Good, but drew a generic sans wordmark — **rebuilt in HTML** with the real one | `final/web/og-1200x630.png`, deployed as `web/public/og.png` |
> | B2 | ✔ pass — re-composed onto 1280×400 canvas | `final/web/github-banner-1280x400.png`, used in README |
> | B3 | ✔ pass — cropped 16:9 | `docs/images/brand/hero-night.png`, used on docs index |
> | C1 | Rendered the literal hex "#9B9BA4" as text — **repaired** (painted out) | `final/social/C1_us_vs_them_1080.png` |
> | C2–C4, C6 | ✔ pass — resized/reformatted | `final/social/` |
> | C5 | Mangled copy ("earningcomma cenas") — **rebuilt in HTML** | `final/social/C5_founder_message_1080x1350.png` |
> | D2, E1 | ✔ pass | `final/social/` |
> | E3 | ✘ FAIL — drew the transparency checkerboard as pixels; **regenerate** (see prompt note) | — |
> | F1 | ✘ Rendered layout directions ("LEFT", "CENTER TOP") as labels — **rebuilt as HTML/SVG** | `docs/images/brand/privacy-architecture.png`, used on /privacy |
> | F2, F3 | ✔ pass | `final/social/` |
> | G1 | ✔ pass — cropped to A6 ratio; needs ~1.7× upscale for true 300dpi print | `final/print/G1_flyer_a6_724x1024.png` |
>
> **Lessons for round 2 — add to every prompt you send:**
> 1. The generator ignored pixel dimensions and returned 1024×1024 for
>    everything. State the shape in words AND set the tool's aspect-ratio
>    parameter (e.g. `--ar 2:1`, "wide banner, 2:1"). If square is all you can
>    get, keep all content inside a generous centre zone so it can be re-cropped.
> 2. Never put layout directions ("LEFT:", "CENTER TOP:") or hex codes on lines
>    the model might transcribe — it will paint them into the image. Describe
>    positions in prose.
> 3. For transparent assets, ask for a **solid magenta #FF00FF background**
>    (easy to key out) — never "transparent background", which produces a fake
>    checkerboard.

**Tool guidance** (matters more than the prompt):

| Asset type | Best tool | Why |
|---|---|---|
| Anything with words ON the image | Nano Banana Pro (Gemini) or Ideogram | Only models that render text reliably. Keep on-image text ≤ 6 words, always in "quotes" in the prompt. |
| Illustration / mascot / stickers | Nano Banana Pro or Flux | Style consistency with an attached reference image. |
| App store screenshots | **Not an image model.** Real captures + the `app-store-screenshots` editor skill (already installed — ask me to scaffold it) | AI-generated fake UI is the #1 slop tell and can violate store policy. |
| Short video ads | Veo / Kling (image-to-video from an approved still) | Generate the still first, approve it, then animate it. |

---

## Brand Block (paste into every prompt)

```
BRAND CONTEXT — Comma
Product: Comma, a privacy-first earnings tracker for gig-economy drivers in Canada
(DoorDash, Uber Eats, Skip, Instacart, Amazon Flex couriers). It records shifts, GPS
mileage (active vs dead kilometres), expenses, and CRA-aware tax estimates. The core
promise: no account, no server, no data collection — everything lives on the driver's
own device; optional sync goes only to the driver's own Google Drive. Free, on Android
and as a web app.

Audience: gig drivers, mostly working nights, checking their phone in the car between
orders. Practical, money-literate, skeptical of apps that harvest data. Canadian:
kilometres not miles, CAD dollars, CRA not IRS.

Voice: plain, confident, a little streetwise. Never corporate, never hype. We say
"know what you really made", not "optimize your earnings potential".

VISUAL SYSTEM (two modes — never mix them in one asset):
• PRODUCT MODE (default for ads, store assets, web): near-black canvas #0A0A0C on
  true black #000000, card surfaces #16161A with hairline borders #2E2E36, off-white
  text #F6F6F7, secondary text #9B9BA4. Accent: emerald green #22c55e (money, actions).
  Support accents used sparingly: teal #14b8a6 (gross), amber #F5A623 (rate/warnings),
  cyan #06b6d4 (expenses), blue #3B82F6 (net). Typography feel: clean geometric sans
  (DM Sans), tabular numerals for money; serif display (DM Serif Display) only for big
  editorial headlines. Elevation via surface steps and hairlines — never glows or
  drop-shadow blobs.
• MASCOT MODE (social, stickers, community, fun): the Comma mascot — a cartoon gig
  driver with tan skin, olive-green beanie, black wraparound sunglasses, thin goatee,
  orange hoodie, holding a fan of green-and-pink cash bills in each hand; thick black
  outlines, flat 2D sticker style, no gradients inside shapes; sits on an orange
  striped circular badge. Wordmark: "COMMA" in heavy outlined capitals, cream fill
  #F6F6F7 with black counters and a flat emerald-green offset shadow. Match the
  attached mascot reference exactly — same face, same proportions, same line weight.

HARD RULES (violating any of these = rejected):
1. Use ONLY the hex values above. No invented colors, no neon, no purple-blue
   "AI gradient", no lens flares, no glow effects, no bokeh.
2. Never draw a fake app interface. Real screenshots are composited in later; leave a
   clean rectangular placeholder area when the layout needs the app.
3. On-image text: exact strings only, given in "quotes" in the prompt, 6 words max.
   If text renders misspelled or warped, the image is unusable.
4. No photorealistic human faces, no fake testimonials, no invented stats, no star
   ratings or award badges we don't have.
5. Currency is CAD ($187.42 style, realistic amounts), distance is km. Right-side
   driving, Canadian streets if a street is shown (snow is welcome).
6. Flat, confident, print-quality composition. If it looks like a stock "AI image",
   start over.
```

**Reference images to attach** (from this repo):
- `assets/logo-mascot.png` — mascot, for every MASCOT MODE prompt
- `assets/logo-with-text.png` — mascot + wordmark lockup
- Real app captures — take fresh ones before doing the screenshot deck (list in §A2)

---

## Asset inventory

| # | Asset | Size | Mode | Priority |
|---|---|---|---|---|
| A1 | Play Store feature graphic | 1024×500 | Mascot+Product | ★★★ |
| A2 | Play Store screenshot deck (8) | 1080×1920 ea. | Product | ★★★ |
| A3 | App icon check | 512×512 | Mascot | ★ |
| B1 | OG / social share image | 1200×630 | Product | ★★★ |
| B2 | GitHub README hero banner | 1280×400 | Product | ★★ |
| B3 | Docs site hero illustration | 1600×900 | Product | ★ |
| C1–C5 | Paid static ads (5 concepts) | 1080×1350 + 1080×1080 | Product | ★★★ |
| C6 | Story/Reels static | 1080×1920 | Product | ★★ |
| D1 | 20–30s motion video ad | 1080×1920 | Product | ★★ |
| D2 | Mascot bumper (3–5s end card) | 1080×1920 | Mascot | ★★ |
| E1 | Feature-announcement template | 1080×1350 | Product | ★★ |
| E2 | Educational carousel (5 frames) | 1080×1350 | Product | ★★ |
| E3 | Mascot sticker pack (6 poses) | 1024×1024 ea. | Mascot | ★ |
| F1 | Privacy architecture diagram | 1600×1200 | Product | ★★ |
| F2 | Active vs dead km explainer | 1080×1350 | Product | ★★ |
| F3 | Tax set-aside explainer | 1080×1350 | Product | ★ |
| G1 | Driver-hub print flyer + QR | A6, 300dpi | Mascot+Product | ★ |
| G2 | Press/brand sheet | A4 landscape | Both | ★ |

---

# A. App store

## A1 — Play Store feature graphic (1024×500)

The banner at the top of the store listing. One idea: *private money tracker, with
personality*. Tool: Nano Banana Pro / Ideogram (it has text). Attach both logo refs.

```
[BRAND BLOCK]

TASK: Google Play feature graphic, exactly 1024×500, PNG.

Composition: true black #000000 background. Left 60%: the "COMMA" wordmark large
(cream outlined caps with emerald offset shadow, matching the attached lockup), and
below it one line in off-white #F6F6F7 clean sans: "Know what you really made."
Below that, smaller, in #9B9BA4: "Private. No account. Free."
Right 40%: the mascot from the attached reference, cropped from the waist up, breaking
slightly out of his orange striped circle badge, cash fans up. He should overlap the
midline a little so the two halves feel like one piece.

Keep 48px of clear margin on all sides — Google crops edges on some surfaces.
Flat colors, thick outlines on the mascot, no gradients, no glow. The black background
must be pure #000000 so it merges with the store's dark theme.

Produce 3 variations: (a) as described, (b) mascot on the left instead, (c) wordmark
only, centered, no mascot — for A/B testing.
```

## A2 — Play Store screenshot deck (8 slides, 1080×1920)

**Do not send this to an image model.** Screenshots are ads built from *real* captures.
Workflow:

1. Capture these screens on a real device, dark theme, with believable demo data
   (a driver's Friday night: `$187.42 · 5h 12m · $36.04/hr · 84.3 km`):
   - Home with tonight's total and per-platform breakdown
   - Shift in progress (live timer + GPS running)
   - Analytics charts (weekly earnings, hourly rate)
   - Mileage view showing active vs dead km
   - Expenses list with a write-off amount
   - Tax estimate screen
   - Backup screen showing Google Drive + the E2E encryption toggle
   - Vehicles / multi-platform selector
2. Ask me to scaffold the `app-store-screenshots` editor (installed skill) — it frames
   captures in device bezels, handles export sizes, and does the Play feature graphic too.
3. Use these headlines, one idea per slide, in this order (narrative arc:
   hero → differentiator → features → trust → closer):

| Slide | Headline | Emphasis word (emerald #22c55e) | Shows |
|---|---|---|---|
| 1 | Know what you **really** made | really | Home, tonight's total |
| 2 | No account. **Ever.** | Ever. | Privacy: data-stays-here visual |
| 3 | Every kilometre **counted** | counted | Mileage, active vs dead |
| 4 | Tax set aside, **automatically** | automatically | Tax estimate |
| 5 | Never lose a **write-off** | write-off | Expenses |
| 6 | Every app. **One total.** | One total. | Multi-platform breakdown |
| 7 | Syncs to **your own** Drive | your own | Backup + E2E toggle |
| 8 | Feature wall (closer) | — | Big type list: Shifts · Mileage · Expenses · Goals · Tax · Backup |

Slide style: background #0A0A0C, headline in the top 35% of the canvas, off-white,
one emerald emphasis word per slide, device frame below with the real capture. Slide 2
inverted (emerald background, black text) for rhythm. One tasteful cross-screen moment:
let the tilted phone on slide 3 bleed ~15% into slide 4.

## A3 — App icon (512×512) — check, don't redo

The current icon exists (`assets/icon.png`). Only regenerate if it fails the 48px test
(shrink to 48×48 — is the mascot still readable?). If it fails:

```
[BRAND BLOCK]

TASK: Android app icon, 512×512, PNG. Simplify the attached mascot for small sizes:
head-and-sunglasses only, centered on the orange striped circle badge, thick black
outlines, flat colors, no text, no cash bills (too small to read at 48px). Must stay
recognizable at 48×48. Provide normal + monochrome (single-color silhouette for
Android themed icons) versions.
```

---

# B. Web, docs, GitHub

## B1 — OG / social share image (1200×630)

Shown every time comma-psi.vercel.app or the docs site is pasted into a chat or feed.

```
[BRAND BLOCK]

TASK: Open Graph share image, exactly 1200×630, PNG. PRODUCT MODE.

Background: near-black #0A0A0C with a very subtle 1px hairline grid in #1E1E23 (barely
visible, like graph paper in the dark). Left side: "COMMA" wordmark (attached lockup
style) at moderate size, and below it in off-white #F6F6F7, serif display type, the
line: "The private earnings tracker for gig drivers." Under it in #9B9BA4 sans:
"No account. No server. Canada-ready."
Right side: an angled dark phone silhouette (blank screen — leave it as a clean
#16161A rectangle with a #2E2E36 hairline; real screenshot composited later).
One emerald #22c55e accent only: a thin underline under the word "private".

No glow, no gradient, no 3D. Must read at 400px wide in a chat preview.
```

## B2 — GitHub README hero banner (1280×400)

```
[BRAND BLOCK]

TASK: GitHub README banner, 1280×400, PNG, PRODUCT MODE with one mascot touch.

Pure #000000 background (GitHub dark blends in; light mode shows it as a clean dark
card). Centered: "COMMA" wordmark, below it in #9B9BA4: "Track every shift. Keep every
byte." The mascot's head peeks over the top edge of the wordmark from behind, hands
gripping the letter tops — playful, like he owns the name. Flat sticker style for the
mascot, thick outlines. 60px clear margin left/right.
```

## B3 — Docs site hero illustration (1600×900)

```
[BRAND BLOCK]

TASK: Documentation site hero illustration, 1600×900, PNG, PRODUCT MODE, no text at all.

A flat, monoline-style night scene: a small car on an empty Canadian street at night
(right-side driving), light snowfall, one warm streetlight. Above the car, a simple
dashed GPS trail in emerald #22c55e curving back through the streets it came from.
The scene is drawn in dark surface tones (#0A0A0C, #16161A, #26262C) with off-white
#F6F6F7 line work — calm, quiet, end-of-shift feeling. The only saturated color is the
emerald trail. Flat shapes, no gradients, no glow, generous negative space at the top
(a headline gets set over it in HTML later).
```

---

# C. Paid static ads (Meta / Instagram)

Five concepts from five different angles — run all, keep what performs. Sizes: build at
1080×1350 (feed), crop-safe center for 1080×1080. Every concept lists the paired ad
copy (fits Meta limits: primary ≤125 chars visible, headline ≤40, description ≤30).

**Grounding rule: no invented numbers.** `$187.42`-style amounts are fine as *scenario*
data inside a visual; "10,000 drivers use Comma" is not, until it's true.

## C1 — "Us vs. Them" (privacy comparison)

```
[BRAND BLOCK]

TASK: Instagram feed ad, 1080×1350, PNG, PRODUCT MODE. Split-panel comparison.

Top headline area (top 25%), off-white on #0A0A0C: "Where does your money data live?"
Below, two vertical panels:
LEFT panel, surface #16161A, labeled "Other trackers" in #9B9BA4: a simple flat diagram
of a phone with an arrow leaving it toward a server rack and a dollar-tagged database,
drawn in muted grey #65656E line work.
RIGHT panel, hairline-bordered in emerald #22c55e, labeled "Comma" in #F6F6F7: the same
phone, but the arrow loops back into the phone itself; a small padlock sits on the
phone. Emerald line work.
Bottom strip: "No account. No server. Free." in #9B9BA4.
Flat monoline diagrams, equal visual weight, no glow, no gradients.
```

Paired copy — Primary: `Your earnings are nobody's business. Comma keeps every shift on
your phone — no account, no server, no data collection.` · Headline: `The private
earnings tracker` · Description: `Free on Android & web`

## C2 — Stat callout ("the real hourly")

```
[BRAND BLOCK]

TASK: Instagram feed ad, 1080×1350, PNG, PRODUCT MODE. Big-number stat card.

Background #0A0A0C. Centered card (#16161A, hairline #2E2E36, radius 16): one giant
money figure in tabular numerals, off-white: "$36.04/hr" with a small emerald ▲ beside
it. Under it, small #9B9BA4 rows exactly as written: "after gas", "after dead km",
"after tax set-aside" — each with a tiny emerald check. Above the card, the headline in
serif display, off-white: "Your real hourly." Below the card: "Comma" wordmark small,
bottom-center. Nothing else. Huge negative space. Numbers must render crisply.
```

Paired copy — Primary: `The app says $24/hr. After gas, dead km, and taxes? Comma shows
what you actually kept.` · Headline: `Know what you really made` · Description:
`Free. No account.`

## C3 — Before/After (end-of-shift moment)

```
[BRAND BLOCK]

TASK: Instagram feed ad, 1080×1350, PNG, PRODUCT MODE. Two stacked panels.

TOP panel ("before"): flat illustration, muted greys (#65656E line work on #0A0A0C) —
a driver's dashboard at night, phone showing a chaotic scatter of question marks and
crumpled receipt shapes floating around it. Label top-left in #9B9BA4: "2 a.m., four
apps, no idea".
BOTTOM panel ("after"): same dashboard, calm; the phone area is a clean blank #16161A
rectangle (real screenshot composited later) with one emerald hairline. Label:
"2 a.m., one number". Divider between panels: thin emerald line.
No text other than the two labels. Flat, no gradients.
```

Paired copy — Primary: `Four apps, a gas receipt in the door, and no idea what tonight
paid. Comma turns a shift into one honest number.` · Headline: `One shift. One number.`
· Description: `Android & web`

## C4 — FAQ card (objection: "another app that sells my data?")

```
[BRAND BLOCK]

TASK: Instagram feed ad, 1080×1350, PNG, PRODUCT MODE. Q&A card layout.

Background #0A0A0C. Top: a chat-style question bubble (surface #26262C, radius 16),
off-white text: "So which server does my data go to?" Below it, a larger answer card
(#16161A, emerald hairline): the single word "None." set huge in off-white serif
display. Under it in #9B9BA4: "SQLite on your phone. IndexedDB in your browser.
Yours." Bottom-center: small "COMMA" wordmark. Massive negative space around "None."
```

Paired copy — Primary: `No account to make. No server to trust. Comma is an earnings
tracker that never phones home.` · Headline: `Which server? None.` · Description:
`Open source`

## C5 — Founder message (works organically + Reddit)

```
[BRAND BLOCK]

TASK: Static ad, 1080×1350, PNG. Plain-text letter style, PRODUCT MODE.

Background #0A0A0C, generous margins. Monospace type (DM Mono feel), off-white, set
like a short plain note:

"I built Comma because every
earnings tracker wanted my
data on their server.

This one has no server.

— the developer"

Small emerald cursor block at the end of the last line. "COMMA" wordmark small at
bottom. Nothing else — no phone, no mascot, no decoration. The restraint IS the design.
```

Reddit note: post as plain text + one real app screenshot in gig-driver subreddits.
Native honesty outperforms designed ads there; keep the mascot out of Reddit.

## C6 — Story/Reels static (1080×1920)

```
[BRAND BLOCK]

TASK: Instagram Story static, 1080×1920, PNG, PRODUCT MODE.

Vertical layout, safe zones: keep top 250px and bottom 300px free of text (platform UI
overlaps). Center: tilted dark phone frame with blank #16161A screen (screenshot
composited later), soft flat shadow (one solid #0A0A0C offset shape, not a blur).
Above the phone: "Tonight, after everything:" in #9B9BA4. Below the phone, huge
off-white tabular numerals: "$187.42" with the small line "you'll know too" in #9B9BA4
beneath. One emerald hairline framing the phone. Flat, calm, no gradient.
```

---

# D. Video

## D1 — 20–30s motion ad (1080×1920, Reels/Shorts/TikTok)

Flat-vector explainer pipeline: generate each scene as a STILL first (approve them),
then animate each still with an image-to-video model, then TTS + word-timed captions.

Brand slots for every scene: FIELD `#0A0A0C` · INK `#F6F6F7` · ACCENT `#22c55e` ·
TYPE FEEL clean geometric sans, tabular numerals.

```
[BRAND BLOCK]

TASK: Six stills for a 25-second vertical explainer, 1080×1920 each, flat 2D vector
style, consistent across all six. FIELD #0A0A0C, INK #F6F6F7 line work, ACCENT #22c55e
used once per scene. No gradients, no glow, no photorealism, no faces.

SCENE 1 (hook, 0–4s): a phone lock screen showing a gig-app notification shape and a
big "$240" — with a hairline question mark carved into the zero. Caption slot bottom
third. On-image text only: "$240".
SCENE 2 (problem, 4–9s): the $240 bill-shape being nibbled away by three flat icons —
a fuel pump, a looping dead-km road, a tax document. Each bite leaves a notch.
SCENE 3 (turn, 9–13s): the Comma home card (clean #16161A rectangle, emerald hairline)
sliding in over the mess, one emerald dot pulsing (GPS).
SCENE 4 (payoff, 13–18s): one huge tabular number "$36.04/hr" on FIELD, tiny emerald
checks stacking under it.
SCENE 5 (privacy, 18–22s): a phone outline with a padlock inside; a crossed-out cloud
above it. On-image text: "no account".
SCENE 6 (end card, 22–25s): the attached "COMMA" wordmark lockup centered, line
beneath: "Free on Android & web."

MOTION NOTES (for the image-to-video pass, per scene): slow parallax drift only,
elements settle with a small overshoot; scene 2 notches appear one per beat; scene 4
number counts up; nothing morphs, nothing warps. Last 2 seconds of each clip must hold
still (drift ruins loop points).
```

Narration (TTS, calm, dry): *"Tonight said two-forty. Then gas. Dead kilometres.
Taxes. Comma tracks the whole shift — and shows the number that's actually yours.
No account. Nothing leaves your phone. Comma. Free on Android and web."*

## D2 — Mascot bumper (3–5s end card)

```
[BRAND BLOCK]

TASK: One still for a 4-second end-card animation, 1080×1920, MASCOT MODE.

The attached mascot centered on true black #000000, cash fans up, orange striped badge
behind him. "COMMA" wordmark above, "Free on Android & web" in #9B9BA4 below.
Motion note for image-to-video: mascot does one small confident nod; the cash fans give
a single flick; wordmark's green shadow slides in from the left. Nothing else moves.
```

---

# E. Organic social templates

## E1 — Feature announcement template (reusable)

For every CHANGELOG feature. Generate once, reuse forever by swapping text + screenshot.

```
[BRAND BLOCK]

TASK: Reusable announcement template, 1080×1350, PNG, PRODUCT MODE.

Layout: top-left small emerald pill reading "NEW"; headline zone (top 30%) for a 3–5
word feature name in off-white serif display — set placeholder "Vehicle filters";
center: blank device-frame area (#16161A, hairline) for a real screenshot; bottom
strip: "COMMA" wordmark left, "changelog →" in #9B9BA4 right. Deliver the empty frame
version too (no placeholder text) for reuse.
```

## E2 — Educational carousel: "What did you really make?" (5 frames)

```
[BRAND BLOCK]

TASK: Five-frame Instagram carousel, 1080×1350 each, PRODUCT MODE, consistent grid.
Each frame: one short line of off-white type (given exactly below) + one flat monoline
illustration in #65656E with a single emerald accent. Background #0A0A0C. A thin
emerald progress bar along the bottom grows one fifth per frame.

FRAME 1: "You made $240 tonight." — phone with gig-app total.
FRAME 2: "Minus gas." — fuel pump icon taking a notch out of a bill shape.
FRAME 3: "Minus the kilometres between orders." — dashed road loop, half grey (dead),
half emerald (active).
FRAME 4: "Minus what the CRA will want." — a slice of the bill set aside into a
labeled jar shape.
FRAME 5: "Comma does this math every shift." — the wordmark + "Free. Private. Canadian."
```

## E3 — Mascot sticker pack (6 poses)

For replies, community posts, WhatsApp/Telegram driver groups.

```
[BRAND BLOCK]

TASK: Six stickers, 1024×1024 each, MASCOT MODE, drawn on a SOLID MAGENTA #FF00FF
background (never a transparency checkerboard — the flat magenta gets keyed out
afterwards). Same character as the attached reference in every frame — same face,
beanie, sunglasses, hoodie, line weight. Thick white sticker border + thin black
keyline around each. No text.

1. Thumbs up, grinning.
2. Counting a fan of bills, smug.
3. Facepalm at a fuel pump.
4. Asleep in a car seat, beanie over eyes, "zzz" as flat shapes.
5. Celebrating — confetti of tiny green commas.
6. Waving hello, other hand holding a coffee cup with a maple leaf on it.
```

---

# F. Explainers / infographics

## F1 — Privacy architecture diagram (1600×1200)

For the docs, the README, and the Play listing's long description area.

```
[BRAND BLOCK]

TASK: Architecture diagram, 1600×1200, PNG, PRODUCT MODE, monoline flat style.

Three columns on #0A0A0C:
LEFT: a phone labeled "Your phone" containing a small database cylinder labeled
"SQLite".
RIGHT: a browser window labeled "Your browser" containing a cylinder labeled
"IndexedDB".
CENTER TOP: a folder shape labeled "Your Google Drive" with a small padlock and the
caption "optional, encrypted".
Emerald #22c55e arrows: phone ⇄ Drive ⇄ browser.
CENTER BOTTOM: a server rack drawn in #45454C with a clean emerald ✕ over it, labeled
"Comma's servers (there are none)".
All labels exactly as quoted, off-white/#9B9BA4, clean sans. Hairline #2E2E36 borders,
no glow, no isometric 3D — flat front-on shapes only.
```

## F2 — Active vs dead km explainer (1080×1350)

```
[BRAND BLOCK]

TASK: Explainer graphic, 1080×1350, PNG, PRODUCT MODE.

A single continuous road line snaking top to bottom on #0A0A0C, drawn as a rounded
path. Segments where an order was active: solid emerald #22c55e with small package
icons. Segments driving empty between orders: dashed grey #65656E. Legend card
(#16161A, hairline) bottom: emerald swatch "active km — earning", grey swatch
"dead km — costing you". Headline top, off-white: "Your car doesn't know the
difference. Comma does." Flat, map-like, no real map data, no gradients.
```

## F3 — Tax set-aside explainer (1080×1350)

```
[BRAND BLOCK]

TASK: Explainer graphic, 1080×1350, PNG, PRODUCT MODE.

A bill shape labeled "$187.42 tonight" at top. An emerald bracket carves off a slice
that drops into a jar shape labeled "set aside for CRA". A second slice, amber
#F5A623, peels toward a receipt shape labeled "write-offs you logged". Remaining bill
labeled "actually yours", off-white, biggest type on the page. Footnote #9B9BA4:
"Estimates, not tax advice." Flat shapes, hairlines, no gradients.
```

---

# G. Print & press

## G1 — Driver-hub flyer (A6, 300dpi, print)

For windshields, driver lounges, restaurant pickup counters.

```
[BRAND BLOCK]

TASK: A6 flyer, 300dpi with 3mm bleed, CMYK-safe. Front only.

Top half: MASCOT MODE — mascot on the orange badge, "COMMA" wordmark. Middle, off-white
on black: "Know what you really made." Three tight lines in #9B9BA4 with emerald
checks: "Tracks shifts & km", "CRA-aware tax math", "No account, ever". Bottom: white
rounded square placeholder (exactly square, 30mm) for a QR code — leave it EMPTY, we
overlay the real QR — with caption "Free · Android & web". True black background;
confirm the black is rich but text stays crisp at print size.
```

## G2 — Press / brand sheet (A4 landscape)

> **✔ DONE — produced in-house, no image model needed.** Files live in
> `marketing/press-kit/`: `brand-sheet.png` (2×), `brand-sheet.pdf` (A4
> landscape), and `brand-sheet.html` (the editable source — change it and
> re-render). Bonus asset extracted along the way: `comma-wordmark.png`, the
> COMMA wordmark on a transparent background (works on black *and* white) —
> use it anywhere the prompts here reference the wordmark.
> The prompt below is kept for reference only.

```
[BRAND BLOCK]

TASK: One-page brand sheet, A4 landscape, PNG + PDF, for press and collaborators.

Grid layout on white #FFFFFF (this one asset is light): the mascot lockup and the
wordmark each shown on a black chip and a white chip; clear-space rule shown as an
outline (one "M"-width margin around the lockup); the palette as labeled swatches with
hex codes exactly: #000000, #0A0A0C, #16161A, #F6F6F7, #9B9BA4, #22c55e, #F5A623,
#3B82F6; type samples: serif display line "Know what you really made." and sans body
line. Footer: "Comma — the private earnings tracker. comma-psi.vercel.app".
Clean, Swiss, hairline dividers.
```

---

# QA checklist (run on every generated asset)

- [ ] **Thumbnail test** — shrink to ~160px wide. Headline readable? Subject clear?
- [ ] **Spell check every rendered word** — one warped letter kills the asset.
- [ ] **Palette audit** — eyedropper 3 random spots; all within the token list?
- [ ] **Slop scan** — any gradient blob, glow, lens flare, bokeh, extra fingers,
      warped cash, melted sunglasses? Reject.
- [ ] **Mascot consistency** — same face/line weight as `assets/logo-mascot.png`?
- [ ] **No fake UI** — every app screen is a real capture or a blank composite frame.
- [ ] **Claims audit** — nothing invented: no user counts, ratings, awards, quotes.
- [ ] **Canadian check** — km, CAD, CRA; no miles, no IRS, no left-side driving.
- [ ] **Safe zones** — store crops (A1: 48px), story UI (C6: top 250 / bottom 300px).

# Suggested production order

1. **A2 screenshots** (blocks the Play listing; needs real captures first)
2. **A1 feature graphic** + **B1 OG image** (the two most-seen assets)
3. **C1–C5 statics** (launch the ad test: privacy vs. real-hourly vs. write-offs)
4. **F1 privacy diagram** (reused in docs, README, listing)
5. Everything else as needed.
