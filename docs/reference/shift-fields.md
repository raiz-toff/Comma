# Shift fields

Every field on the shift form, what it means, and which fields depend on the platform you worked.

---

## Core fields

These fields apply to every shift regardless of platform.

| Field | Required | Unit | Notes |
|---|---|---|---|
| Platform(s) | Yes | — | Multi-select. A shift can span more than one platform, and each keeps its own earnings and trips. |
| Vehicle | Yes on phone | — | The vehicle you drove. Determines mileage eligibility and the deduction method. |
| Date | Yes | — | The day the shift took place. |
| Start time | No | Time of day | When you went online. |
| End time | No | Time of day | When you went offline. |
| Online duration | No | Hours and minutes | Total time logged in to the platform. |
| Active duration | No | Hours and minutes | Time spent on an accepted job, as opposed to waiting. |
| Trips completed | No | Count | Deliveries, rides, orders, or packages, depending on the platform. |
| Active distance | No | km | Distance driven while on a job. |
| Dead distance | No | km | Distance driven while waiting or repositioning. Both distances are deductible; only active distance is paid. See [Core concepts](../getting-started/core-concepts.md). |
| Bonus (shift-level) | No | CAD | A bonus that applies to the whole shift rather than to one platform. |
| Notes | No | — | Free text for anything worth remembering. |

---

## Per-platform earnings

Each platform on a shift shows earnings fields that match how that platform pays. The model is set in the platform registry, so the form adapts automatically. See [Platforms](platforms.md).

### Fixed-price delivery (DoorDash, Uber Eats, SkipTheDishes, Foodora)

| Field | Required | Unit | Notes |
|---|---|---|---|
| Gross revenue | Yes | CAD | Total delivery earnings before tips. |
| Tips | No | CAD | Customer tips. |
| Bonus | No | CAD | Peak pay, challenges, and promotional incentives. |

### Metered rideshare (Uber, Lyft)

| Field | Required | Unit | Notes |
|---|---|---|---|
| Gross fares | Yes | CAD | Metered fare earnings. |
| Surge | No | CAD | Additional earnings from surge pricing, when tracked separately. |
| Tips | No | CAD | In-app and cash tips. |
| Bonus | No | CAD | Quest bonuses, streak rewards, and referrals. |

Rideshare platforms are defined in the registry but are not among the enabled Canadian defaults; the fields are listed here for completeness.

### Grocery batch (Instacart)

| Field | Required | Unit | Notes |
|---|---|---|---|
| Batch pay | Yes | CAD | Base pay for completing the batch. |
| Tips | No | CAD | Customer tips on the batch. |
| Peak pay | No | CAD | Extra pay for heavy orders or peak demand. |

### Parcel route (Amazon Flex)

| Field | Required | Unit | Notes |
|---|---|---|---|
| Block pay | Yes | CAD | Fixed earnings for completing the block. Amazon Flex calls a shift a block. |
| Extra pay | No | CAD | Compensation for extra stops or rescheduled blocks. |

---

## Web-only fields

The web app collects a few extra fields that the phone form leaves out.

| Field | Required | Unit | Notes |
|---|---|---|---|
| Weather | No | — | Conditions during the shift, for later analysis. |
| Mood | No | — | How the shift felt, for later analysis. |
| Out-of-pocket order cost | No | CAD | Money you fronted on an order. Recorded as a non-deductible cost. |
| Platform-specific extra fields | No | Varies | Additional inputs that a given platform's model exposes. |

---

## Reconciliation status

A shift carries a status that reflects how complete it is. A GPS-tracked shift knows how long and how far you drove but not what you earned, so it waits for you to fill in the money.

| Status | Meaning |
|---|---|
| `tracking` | The shift is running right now. |
| `pending_reconciliation` | GPS has finished, but earnings have not been entered. |
| `reconciled` | Complete — both money and distance are confirmed. |

See [Core concepts](../getting-started/core-concepts.md) for how reconciliation fits the wider workflow.
