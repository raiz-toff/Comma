# Platforms

The gig platforms Comma supports in Canada, the earnings model each one uses, and how to add your own.

---

## Built-in platforms

These platforms are enabled by default in the Canadian market. Each one drives the earnings fields on the shift form through its operational model. See [Shift fields](shift-fields.md) for the fields each model shows.

| Platform | Earnings model | Notes |
|---|---|---|
| DoorDash | Fixed-price delivery | Drivers are called Dashers. |
| Uber Eats | Fixed-price delivery | Couriers deliver food. |
| SkipTheDishes | Fixed-price delivery | Canadian food delivery. |
| Foodora | Fixed-price delivery | Canadian food delivery. |
| Instacart | Grocery batch | Shoppers complete batched grocery orders; pay is batch pay plus peak pay. |
| Amazon Flex | Parcel route | Fixed pay per block; drivers deliver packages. |
| Other | Fixed-price delivery | A generic catch-all for work not covered by the named platforms. |

---

## Earnings models

The earnings model decides which money fields a platform shows and what they are called.

| Model | Primary field | Additional fields | Trip term |
|---|---|---|---|
| Fixed-price delivery | Gross revenue | Tips, bonus | Order |
| Grocery batch | Batch pay | Tips, peak pay | Order |
| Parcel route | Block pay | Extra pay | Package |

---

## Per-platform terminology

Comma follows each platform's own language rather than imposing a single vocabulary. Amazon Flex drivers work a block, not a shift; Instacart shoppers complete a batch. The labels on the shift form change to match the platform you selected.

---

## Custom platforms

If you drive for a platform that is not built in, create your own from **Settings, Platforms**. A custom platform takes a name, a color, and a logo, and behaves exactly like a built-in one across the shift form, filters, and analytics.

---

## Per-platform settings

Each enabled platform carries its own defaults, configured in **Settings, Platforms**. See [Settings](settings.md).

| Setting | Purpose |
|---|---|
| Hourly target | Your goal hourly rate, used in hourly-rate widgets. |
| Per-km rate | The per-kilometre mileage rate for this platform, overriding the country default when set. |
| Priority | The platform's position in the picker. |

---

## Other markets

The platform registry also contains definitions for platforms in markets that are not enabled, such as the United Kingdom, the United States, and Nepal. Those platforms do not appear in the app while Canada is the active market. See [Countries](countries.md).
