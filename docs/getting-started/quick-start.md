# Quick Start

Install Comma, answer two questions, and see what your last shift was really worth. About five minutes, most of it install time.

---

## 1. Install

### Android

[Download the latest APK](https://github.com/raiz-toff/Comma/releases/latest) from GitHub Releases and open it. Android will ask you to allow installs from unknown sources — that's the standard prompt for any app not delivered by the Play Store. Comma is also on Play in testing.

### Web

Open [comma-psi.vercel.app](https://comma-psi.vercel.app) in any modern browser. Nothing to install, but you should install it anyway so it runs in its own window and works offline:

- **Chrome / Edge (desktop)** — the install icon in the address bar, or menu → *Install Comma*
- **Chrome (Android)** — menu → *Install app*
- **Safari (iOS)** — Share → *Add to Home Screen*

You can also trigger it from **Settings → About → Install COMMA**.

---

## 2. The welcome screen

The first screen gives you three ways in:

| Choice | What happens |
|---|---|
| **Get started** | The two-question setup below. This is the one you want. |
| **Try with demo data** | Loads two months of realistic sample shifts, expenses, routes, and badges so you can explore a full app. Nothing you do in demo mode touches real data, and you can leave any time. |
| **Restore or sync existing data** | Already used Comma? Pull your vault down from Google Drive, or import a backup file. Skips setup entirely. See [Moving between devices](../backup-and-sync/moving-devices.md). |

---

## 3. Setup: two questions

That's the whole wizard. Everything else Comma either derives, defaults, or asks for later — none of it is an input to the number you're about to see, and all of it used to sit in front of the value.

### Where you drive

Pick your country and province. This sets your currency, your distance unit, your tax rates, your mileage rate, and which delivery apps you'll be offered.

Canada is the only country available right now — see [Introduction](./introduction.md#where-it-works).

### Your last shift

Think of the last shift you drove and enter four things:

| Field | Example | Required |
|---|---|---|
| Which app you drove for | DoorDash | Yes |
| Roughly how many hours | 6.5 | Yes |
| How much you made | 142 | Yes |
| How far you drove | 47 | Optional, but it's where the write-off comes from |

Haven't driven yet? Tap **I haven't worked a shift yet** and Comma takes you straight to the dashboard.

---

## 4. The reveal

Comma does the arithmetic the platform never shows you:

```
  Gross                      $142.00
  − tax to set aside (28%)  − $39.76
  ─────────────────────────────────
  Yours to keep              $102.24
  + mileage write-off · 47km  $34.31   (a tax deduction, not cash)

  The app said     $21.85/hr
  Actually         $15.73/hr
```

That gap is the entire reason Comma exists. Tap through and the shift you just described is **saved as your first real shift** — you start with data, not an empty app.

---

## 5. Finish setting up (when you're ready)

The dashboard shows a small **Finish setting up** checklist. It holds everything setup deliberately skipped, sitting next to the numbers each item sharpens rather than in front of them:

| Item | Why it matters |
|---|---|
| **Add your other apps** | Setup captured one platform. Add the rest to compare them. |
| **Tell us your real vehicle** | Comma assumed a petrol car. Your actual vehicle decides whether the mileage write-off applies at all — a bike doesn't qualify for the CRA automobile rate. |
| **Set a weekly goal** | Defaults to $500. Make it yours. |
| **Turn on GPS tracking** | Lets the phone record distance for you instead of you guessing it. |
| **Back up your data** | It's on one device until you do. |

The checklist removes itself once it's done. Nothing on it is urgent, and the app works fully without any of it.

Comma also quietly assumed a few things so it could get out of your way: your name is "Driver", your goal is $500/week, your vehicle is a petrol car called "My Car", and the theme is dark. All of it is editable in Settings.

---

## 6. Track a shift

### Live, with GPS (phone)

1. Tap **Start Shift** in the bottom bar.
2. Pick the app (or apps) you're working. Pick a vehicle, if you have more than one. Optionally set a duration target.
3. Comma starts the timer and the GPS service, and drops a floating overlay on top of your delivery app so you can see time and distance without switching back.

While you're out:

- Tap **Got First Order** when you pick up your first delivery. Everything before it is **dead** distance; everything after is **active**. This split matters for knowing your true cost per delivery.
- **Pause** while you take a break — paused time doesn't drag down your hourly rate.
- **Swipe to end** when you're done. Comma saves the route and asks you to add earnings.

The web app can do this too — the timer and GPS run while the tab is open — but it has no background service, so the phone is the right tool for a real shift.

### Log a shift you already drove

Tap **Log Shift** and fill in the form: platform and vehicle, date and times, earnings, distance, notes. Use this when you forgot to hit start — most people do at first.

---

## Next

- [Shift Tracking](../features/shift-tracking.md) — the live console in detail
- [Expenses](../features/expenses.md) — log your first fill-up
- [Tax Center](../features/tax-center.md) — what you'll owe, and what you can write off
- [Backup & Sync](../backup-and-sync/overview.md) — before you trust it with a year of records
