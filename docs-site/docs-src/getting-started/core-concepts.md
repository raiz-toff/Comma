# Core Concepts

A short glossary of the terms Comma uses throughout the app.

---

## Shift

A shift is one continuous work session — from the moment you open the app and start tracking until you end the session. A shift belongs to one primary **platform** and one **vehicle**.

Shifts have:
- Start and end time
- Gross revenue + tips
- Active mileage + dead mileage
- Duration (total elapsed) and paused seconds
- An optional GPS route
- Notes

A shift can span multiple platforms if you toggle platforms mid-session. Each platform's online time, earnings, and trips are recorded separately in **shift platforms** sub-records.

---

## Platform

A platform is a gig app you work on — DoorDash, Uber Eats, etc. In Comma, a platform is a named entity with a color, optional logo emoji, and per-platform settings like your target hourly rate.

You can:
- Activate/deactivate platforms to control which ones appear in filters and shift creation
- Set a custom hourly rate target per platform
- See per-platform earnings breakdowns in Analytics

---

## Active miles vs. dead miles

Comma distinguishes two kinds of miles driven during a shift:

**Active miles** — miles driven while you are on a delivery (from the moment you accept an order to the moment you drop it off). These are the miles the IRS considers directly attributable to the delivery job.

**Dead miles** — miles driven while waiting for orders or commuting to a hotspot. Dead miles are still deductible as business mileage (the IRS allows all business-purpose miles), but tracking them separately gives you a more accurate picture of your true cost per delivery.

Comma separates these using GPS speed. When you tap **"First Order Received"** at the start of a shift, the app switches from dead-mile mode to active-mile mode. You can toggle this manually at any time during a shift.

---

## Gross revenue vs. net earnings

**Gross revenue** — the total amount deposited by the platform, including base pay and any bonuses.

**Tips revenue** — customer tips (often paid separately, especially on Uber Eats and DoorDash).

**Net earnings** — gross revenue + tips, minus all deductible expenses logged for that period. Comma shows net earnings in the Dashboard header and Analytics charts.

---

## Deductible expense

An expense that reduces your taxable self-employment income. The IRS (and CRA, HMRC equivalents) allow gig workers to deduct ordinary and necessary business expenses.

In Comma, every expense has a **deductibility percentage** (0–100%). Most gig-work expenses are 100% deductible; mixed-use items (like a phone plan used for both work and personal) get a partial percentage.

---

## Standard mileage rate vs. actual expenses

When deducting vehicle costs, you pick one method per vehicle per tax year:

**Standard mileage rate** — Multiply total business miles by the IRS rate (e.g. $0.70/mile for 2025). Simple, no receipts needed.

**Actual expenses** — Deduct the real cost of gas, insurance, maintenance, and depreciation, pro-rated by the business-use percentage of your total miles. More paperwork, potentially higher deduction.

Comma supports both. Set the method in **Tax Center → Vehicle Tax Profile**. The standard rate is pre-filled with the current year's IRS rate.

---

## Reconciliation status

Shifts can be in one of three states:

| Status | Meaning |
|---|---|
| `tracking` | Shift is currently in progress (GPS running) |
| `pending_reconciliation` | GPS session ended but the shift hasn't been reviewed yet (e.g. app crashed, background service stopped) |
| `reconciled` | Shift is complete and earnings/mileage are confirmed |

If a shift shows as `pending_reconciliation`, open it, review the GPS data and earnings, then tap **Confirm** to mark it reconciled.

---

## Sync vs. backup

Comma uses these terms precisely:

**Backup** — A point-in-time snapshot of your entire database, encrypted, and uploaded to Google Drive as a single file. Manual, one-directional. Restoring a backup overwrites your local data.

**Sync** *(coming soon)* — Continuous, automatic, non-destructive. Changes from Phone A and Phone B are merged using a Last-Write-Wins strategy. Neither phone is ever wiped. See [Cloud Sync](../backup-and-sync/cloud-sync.md).

---

## XP and badges

Comma has a lightweight gamification layer:

**XP (experience points)** — Earned by logging shifts and expenses consistently. XP accumulates over time and never resets.

**Badges** — One-time unlocks for milestones like your first 5 shifts, hitting $5,000 in net earnings, or maintaining a 7-day streak. Badges are displayed on your profile.

**Streak** — A counter of consecutive days you logged at least one shift. If you miss a day, the streak resets (frozen days can be set to pause it, e.g. scheduled days off).

---

## Feature flags

Some screens in Comma are gated by feature flags. If a feature isn't visible in your navigation, it may be turned off for your region or toggled off in **Settings → Developer → Feature Overrides**.

| Flag | Feature |
|---|---|
| `tax_workspace` | Tax Center tab |
| `goals` | Goals section and gamification |
| `analytics_advanced` | Advanced Analytics tab |
| `schedule` | Weekly schedule view |
