# Expenses

Log and categorize your business expenses in Comma to get an accurate picture of net earnings and to build a tax-ready expense record.

---

## Logging an expense

Tap **+ Expense** on the Dashboard bottom bar, or navigate to the **Expenses** tab and tap the add button.

Fill in:

| Field | Notes |
|---|---|
| **Category** | Choose from the built-in list (see below) |
| **Amount** | The total cost |
| **Date** | Defaults to today |
| **Vehicle** *(optional)* | Associate with a specific vehicle for vehicle-expense reporting |
| **Shift** *(optional)* | Link to a specific shift |
| **Merchant** *(optional)* | Business name (auto-completes from your history) |
| **Deductible %** | How much of this expense is business-related (0–100%) |
| **Notes** *(optional)* | Anything extra you want to remember |
| **Receipt photo** *(optional)* | Attach a photo from your camera roll |

Tap **Save** to add the expense.

---

## Expense categories

Comma ships with the following categories, each pre-configured with IRS/CRA/HMRC guidance on deductibility:

| Category | Typical deductibility | Notes |
|---|---|---|
| **Fuel / Charging** | 100% (if standard mileage: $0) | Not deductible under standard mileage rate — only under actual expenses |
| **Phone & Data** | Partial | Enter your business-use % (e.g. 70% if you use your phone mostly for work) |
| **Vehicle Maintenance** | 100% (actual expenses only) | Oil changes, tires, brakes, etc. |
| **Vehicle Insurance** | Partial (actual expenses only) | Deduct business-use % of your premium |
| **Car Wash** | 100% | Keeping a delivery vehicle clean is a business expense |
| **Hot Bag / Equipment** | 100% | Delivery bags, insulated carriers |
| **Platform Fees** | 100% | Any platform subscription or activation fees |
| **Parking** | 100% | Parking during deliveries |
| **Tolls** | 100% | Tolls during business trips |
| **Health Insurance** | Special | Self-employed health insurance deduction (separate from Schedule C) |
| **Software / Apps** | 100% | Comma, route-planning apps, accounting software |
| **Other** | Varies | Enter custom deductibility % |

> **Note on fuel under standard mileage:** If you claim the IRS standard mileage rate, you cannot also deduct fuel costs — the rate already covers them. Comma tracks both so you can compare methods; the Tax Center will flag double-counting if detected.

---

## Deductibility percentage

Many expenses are partially deductible. The formula is:

```
Deductible amount = Amount × (Deductible % / 100)
```

Common examples:
- Phone plan used 70% for work → 70%
- Car insurance (business use 80% of total miles) → 80%
- Home internet used partly for route planning → 20–30%

Set the percentage when logging the expense. You can edit it anytime.

---

## Recurring expenses

For expenses that happen on a regular schedule — monthly phone bill, yearly insurance renewal — mark them as recurring:

- Toggle **Recurring** on the expense form
- Set the interval: **Weekly**, **Monthly**, or **Yearly**

Comma will remind you when the next occurrence is due (via a push notification). Recurring reminders are suggestions — they don't automatically create duplicate entries.

---

## Receipt photos

Tap the camera icon when logging an expense to attach a photo. Receipts are stored as local file URIs — the photo stays on your device and is not uploaded anywhere (unless you enable Google Drive backup, in which case it's included in the encrypted snapshot).

Keep photos: the IRS recommends keeping receipts for expenses over $75. For audit purposes, a photo attached to a timestamped digital record is generally accepted.

---

## Merchant normalization

Comma automatically normalizes merchant names. "SHELL #1234 TORONTO" and "Shell Gas Station" are both recognized as "Shell" and grouped together in reports. This keeps the Merchant analytics view clean and makes it easy to see your total spend at recurring vendors.

---

## The Expenses tab

The Expenses tab shows a chronological list of all expenses with:
- Category icon and label
- Amount and deductible amount (if partial)
- Merchant (if set)
- Date

Filter by date range, category, or vehicle using the filter bar at the top.

---

## Expense analytics

The Analytics tab includes an expenses breakdown:

- **Total expenses** vs. **total deductible expenses** for any date range
- **By category** — pie chart of where your money goes
- **By month** — trend over time
- **By vehicle** — compare costs across your fleet

---

## Editing and deleting

Tap any expense to open the detail screen. All fields are editable. To delete, tap the trash icon. Deleted expenses are permanently removed (or soft-deleted if cloud sync is enabled, propagating to other devices).

---

## CSV import

If you have historical expenses in a spreadsheet, use **Settings → Import → Expenses CSV** to bulk-import them. Comma accepts a CSV with columns: `date`, `category`, `amount`, `merchant`, `notes`, `deductible_pct`.

---

## Tax integration

Expenses flow directly into the **Tax Center**. The tax estimate on the Tax tab uses your total deductible expenses as a deduction against gross earnings when calculating self-employment tax owed.
