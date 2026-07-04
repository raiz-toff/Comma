# Introduction

## What is Comma?

Comma is a mobile earnings tracker designed for independent gig workers. If you drive for DoorDash, deliver for Uber Eats, shop for Instacart, or fulfill orders for Amazon Flex — Comma is built for you.

It answers the questions that matter at tax time:

- How much did I actually earn last month, after expenses?
- How many miles did I drive, and how many are deductible?
- What do I owe in self-employment taxes?
- Was Tuesday or Friday more profitable per hour?

---

## Who is it for?

Comma is designed for gig workers who:

- Work one or multiple delivery/rideshare platforms simultaneously or across different days
- Want to track mileage automatically without carrying a separate GPS device
- Need to log expenses and understand which ones reduce their tax bill
- Prefer their financial data to stay on their own device rather than on a company's server
- Want a clean, fast app that doesn't require creating an account

---

## Core philosophy

**Local-first.** All data is stored in a SQLite database on your phone. Comma works completely offline. There is no backend server, no user account, no subscription required to use the core features.

**Privacy by design.** Comma cannot see your data. It doesn't send earnings, mileage, or location data anywhere. If you enable Google Drive backup, your data is encrypted on your device before it leaves — only you can decrypt it with your passphrase.

**Tax-accurate, not tax-advice.** Comma gives you numbers to bring to your accountant, not a filing service. It knows the IRS standard mileage rate, the CRA rate, and self-employment tax brackets — but always verify with a professional.

---

## What Comma tracks

| Category | Details |
|---|---|
| **Shifts** | Start/end time, platform, earnings, tips, duration, GPS route |
| **Mileage** | Active delivery miles, dead (commute) miles, deductible total |
| **Expenses** | Fuel, phone, maintenance, gear — categorized with deductibility |
| **Vehicles** | Multiple vehicles, odometer readings, maintenance history |
| **Tax estimates** | Self-employment tax, mileage deduction, quarterly projections |
| **Goals** | Weekly/monthly earnings, hours, or mileage targets |
| **Analytics** | Earnings trends, best days/hours, per-platform breakdown |

---

## Supported platforms

Comma ships with definitions for major gig platforms in North America and the UK. You can also add any custom platform not in the list.

**Delivery & grocery**: DoorDash, Uber Eats, SkipTheDishes, Instacart, Amazon Flex, Gopuff, Shipt, Walmart Spark, Cornershop

**Rideshare**: Uber, Lyft, Via, InDriver

**Courier / tasks**: TaskRabbit, Postmates, HopSkipDrive, Roadie

**Other**: Custom platforms (any label, color, and rate you choose)

---

## Next steps

- [Quick Start](./quick-start.md) — Install and log your first shift in 5 minutes
- [Core Concepts](./core-concepts.md) — Understand the terminology before diving in
