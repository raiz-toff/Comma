# Introduction

Comma is an earnings tracker for gig drivers. It records what you were paid, how far you drove, and what you spent — then tells you what the work was actually worth, after tax and vehicle costs.

It runs on Android and in the browser. There is no account, no sign-up, and no Comma server. Your data is a database on your device.

---

## The problem it solves

A delivery app reports a number: "$142 today." That number is not your income. It is gross revenue — before the tax you owe as a self-employed contractor, before the fuel you burned, and before the wear on a car you are still paying for.

And two shifts that both paid $142 are not equally good. One took four hours and forty kilometres. The other took seven hours and a hundred and ten. Only one of them was worth doing.

Nobody in the gig economy tells drivers the real figure, because nobody in the gig economy is incentivised to. Comma exists to compute it.

The first thing the app does — before you configure anything — is ask about a shift you have already driven, and show you what it really earned per hour. That is the whole product in one screen. Everything after it is bookkeeping in service of that number.

---

## What it tracks

| | |
|---|---|
| **Shifts** | Start and end time, platform(s), gross, tips, bonuses, trips, and the vehicle you used |
| **Distance** | Split into *active* kilometres (on a delivery) and *dead* kilometres (waiting, repositioning) |
| **Expenses** | 20 categories, each with a business-use percentage that drives how much is deductible |
| **Tax** | Set-aside estimates, CPP, HST/GST, instalment deadlines, and the mileage write-off |
| **Goals** | Earnings, hours, distance, or delivery targets by day, week, or month |
| **Progress** | XP, levels, 24 badges, day streaks, and weekly challenges |

On the phone, distance is recorded by a native background GPS service that keeps running with the screen off. In the browser, tracking runs while the tab is open. Either way, you can also just type the number in.

---

## Where your data lives

On your device. On Android that is a SQLite file in the app's private storage; in the browser it is IndexedDB.

There is no Comma account and no Comma backend — so there is no server to breach, subpoena, sell, or shut down with your records inside it.

The trade-off is real and worth stating plainly: **if you lose the device and have no backup, the data is gone.** Comma cannot email you a recovery link, because Comma does not know who you are. That is why [backup and sync](../backup-and-sync/overview.md) exists, and why it goes to *your* Google Drive rather than ours.

---

## Where it works

Comma ships for **Canada** today. Your country sets your currency, distance unit, tax rules, mileage rate, and which delivery apps you're offered.

Definitions for the United States, the United Kingdom, and Nepal are written and sitting in the codebase, but are deliberately switched off: shipping tax rules nobody has checked would be worse than shipping none. Turning a country on is a single file per platform — see [Contributing](../development/contributing.md).

Delivery platforms available in Canada: **DoorDash, Uber Eats, SkipTheDishes, Foodora, Instacart, Amazon Flex** — plus a catch-all *Other*, and any custom platform you define yourself.

---

## The two apps

Both are Comma. Both keep a local vault. Both can sync through your own Google Drive so they stay in step.

- **Android app** — for driving. Background GPS, a live shift console, a floating overlay that sits on top of your delivery app, and full offline operation.
- **Web app (PWA)** — for the desk. The dashboard, analytics, tax centre, reports, CSV import, and keyboard-speed data entry. Installs to your home screen or desktop.

The honest split: **track on the phone, reckon on the laptop.** [Web App](../features/web-app.md) lists the exact differences.

---

## What it is not

- **Not tax advice.** Comma estimates using standard rates. It does not model your brackets, credits, or personal circumstances. Take the numbers to an accountant at filing time.
- **Not connected to the delivery platforms.** Nothing reads your DoorDash account. You enter what you were paid, or import a CSV. That is deliberate — those integrations mean handing over credentials.
- **Not a paid product.** MIT-licensed, open source. No subscription, no ads, no telemetry.

---

## Next

- [Quick Start](./quick-start.md) — install, and get to your first real number
- [Core Concepts](./core-concepts.md) — the vocabulary the app uses
- [FAQ](./faq.md) — the questions people actually ask
