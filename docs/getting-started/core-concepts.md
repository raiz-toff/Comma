# Core Concepts

The vocabulary Comma uses, and what each term actually means.

<ShiftStrip accent="teal" blocks={[{ label: "dead", pct: 18, kind: "idle" }, { label: "active — order on", pct: 34 }, { label: "dead", pct: 22, kind: "idle" }, { label: "active", pct: 26 }]} caption="A 40% dead ratio means four kilometres in ten burn fuel for free. Movement below 5 km/h does not count as driving." />

---

## Shift

One work session: from the moment you start tracking to the moment you end. A shift carries a date, a duration, one vehicle, one or more platforms, the money you made, and the distance you covered.

If you work two apps at once, the shift records each platform's own online time, earnings, and trips as sub-records, so you can compare them honestly.

The app may call a shift a **session**, a **block**, or a **batch** depending on the platform you're working — Amazon Flex drivers don't say "shift", they say "block". Comma follows the platform's language rather than imposing its own.

---

## Active vs dead distance

The distinction that most drivers never get from the delivery apps:

**Active** — distance driven while you're on a delivery: order accepted, food in the car, heading to the customer.

**Dead** — distance driven while you're not: driving to a hotspot, circling while you wait, going home at the end.

Both are legitimate business kilometres and both are deductible. But only one of them is being paid for, and the ratio between them is one of the few levers a driver actually controls. A 40% dead-mile ratio means you are burning fuel and brake pads for free four kilometres in ten.

Comma splits them in two ways. On a live shift, you tap **Got First Order** — before that tap, distance is dead; after it, active. The GPS engine also classifies by speed, treating movement below 5 km/h as not-driving.

---

## Reconciliation

A GPS-tracked shift knows how long you were out and how far you went. It does not know what you were paid — only you know that.

So a shift that ends from GPS is saved as **pending reconciliation**: real, complete, and sitting in your history with a zero next to it until you fill in the earnings. The dashboard nags you about these, and the bottom bar's main button turns into **Reconcile** while any exist.

| Status | Meaning |
|---|---|
| `tracking` | Running right now |
| `pending_reconciliation` | GPS finished; earnings not entered yet |
| `reconciled` | Complete — money and distance both confirmed |

---

## Gross, take-home, and the write-off

Three numbers that are constantly confused, including by the apps themselves.

**Gross** — everything the platform paid: base pay, tips, bonuses. The number in the app's screenshot.

**Take-home** — gross, minus the tax you should be setting aside, minus what you actually spent. This is money you can spend.

**Mileage write-off** — a *tax deduction*, not cash. Driving 47 km doesn't put $34 in your pocket; it reduces the income you'll be taxed on by $34.

This distinction is load-bearing in Comma's design: **the write-off is never subtracted from your earnings and never added to them.** It's shown separately, everywhere, so it can't be mistaken for money you have.

---

## Deductibility, and business use

Every expense carries a **business-use percentage**. A tank of fuel used entirely for deliveries is 100%. A phone bill where half your usage is personal is 50% — and only half of it reduces your taxable income.

Comma stores the percentage rather than a yes/no flag because the real world is mixed-use, and an audit asks you to justify the split.

---

## Standard mileage vs actual expenses

Two ways to deduct the cost of your vehicle. You pick one per vehicle, per tax year — you cannot use both.

**Standard mileage** — multiply business kilometres by the CRA rate ($0.73/km for the first 5,000 km, $0.67/km after). Simple, no receipts.

**Actual expenses** — deduct the real cost of fuel, insurance, maintenance and depreciation, pro-rated by business use. More paperwork, sometimes a bigger deduction.

Choosing standard mileage means you **cannot also** write off fuel and maintenance separately — the rate already includes them. Comma will warn you if you log a fuel expense against a vehicle on the standard method; the expense still saves, it just won't be double-counted.

Not every vehicle qualifies for the standard rate. A bicycle or e-scooter isn't an automobile under CRA rules, so it doesn't get the automobile rate — Comma knows this and won't offer you a deduction you can't take.

---

## The reveal

The screen at the end of setup that turns a shift you already drove into your real hourly rate. It's not a marketing gimmick — the shift it's built from is saved as a real record, and it's the first honest number most drivers have ever seen about their own work.

---

## The activation checklist

The **Finish setting up** card on the dashboard. It holds the setup questions Comma deliberately refused to ask up front — your other apps, your real vehicle, your goal, GPS, backup — and puts each one next to the number it sharpens. It disappears when it's done.

---

## Backup vs sync

Precise terms, different things.

**Backup** — a snapshot, taken at a moment, restored on top of whatever is there. One direction. Restoring replaces.

**Sync** — continuous and two-way. Change a shift on the phone, open the browser, it's there. Nothing is wiped; both devices converge. Conflicts resolve last-write-wins, and financial edits that get overwritten are kept in an audit log rather than silently lost.

Both go through **your** Google Drive. Comma has no server in the middle. See [Backup & Sync](../backup-and-sync/overview.md).

---

## How sync is protected

Cloud Sync is always end-to-end encrypted. When you connect Google Drive you set a **backup password**, and your data is encrypted with it before it leaves the device — not even Google can read what lands in your Drive. There is no unencrypted mode and no toggle: the password is part of turning sync on.

You need that password on every device, and Comma cannot recover it. If you forget it, the cloud copy is unreadable — but the data on your device is untouched, so you rebuild the cloud copy from it under a new password. See [Encryption](../backup-and-sync/encryption.md).

---

## XP, badges, streaks

A light layer on top of the real numbers.

**XP** accrues from shifts logged, earnings, distance, targets met, records broken, badges, and challenges. Every 100 XP is a level.

**Badges** — 24 one-time unlocks: first shift, a $100 day, a 7-day streak, a new best hourly rate, and so on.

**Streak** — consecutive days with a logged shift. **Streak freezes** (up to 3) cover the days you don't work, so a planned day off doesn't wipe a month of consistency.

**Challenges** — three, reset every Monday: earn $500 this week, complete 20 deliveries, log 5 days in a row.

---

## Feature flags

Some screens can be switched off in **Settings → You → Optional Features**, so the app is only as big as you need it.

| Flag | Screen | Default |
|---|---|---|
| `analytics_advanced` | Analytics tab | On |
| `tax_workspace` | Tax tab | On |
| `goals` | Goals screen | On |
| `schedule` | Schedule screen | **Off** |
| `pdf_reports` | PDF export in Reports | **Off** |

Turning Goals off also turns off badges and streaks, since they have nowhere to live.
