# Tax Center

The Tax Center gives gig workers a running estimate of their self-employment tax liability — the numbers you'd need to file Schedule C (US), T2125 (Canada), or SA103 (UK).

> Comma provides estimates, not tax advice. Always verify your final numbers with a qualified tax professional before filing.

---

## Accessing Tax Center

The Tax Center is available in the main navigation drawer and as a tab (if the `tax_workspace` feature flag is enabled for your region). It is available in: 🇺🇸 US · 🇨🇦 Canada · 🇬🇧 UK · 🇳🇵 Nepal.

---

## What the Tax Center shows

### 1. Income summary

| Line | Calculation |
|---|---|
| Gross earnings | Sum of all shift gross revenue for the period |
| Tips | Sum of all tips |
| Total income | Gross + tips |
| Deductible expenses | Sum of all expenses × their deductible % |
| **Net profit** | Total income − deductible expenses |

### 2. Mileage deduction

Depending on your vehicle tax profile, you'll see either:

**Standard mileage:** `total business miles × current rate = deduction`

**Actual expenses:** The sum of vehicle-specific expenses (fuel, insurance, maintenance) × your business-use percentage.

The mileage deduction is subtracted from net profit to arrive at **adjusted net profit**.

### 3. Self-employment tax estimate

Self-employment tax in the US is 15.3% on the first $168,600 of net self-employment income (2024 threshold), plus Medicare tax above that. Comma calculates:

```
SE income = net profit × 0.9235        (×92.35% per IRS: you deduct half of SE tax)
SE tax    = SE income × 0.153          (up to the SS wage base)
```

For Canada, Comma calculates the CPP contribution rate applied to net self-employment income, plus federal/provincial marginal income tax.

### 4. Quarterly estimates (US)

If you're expected to owe more than $1,000 in taxes, you're required to make quarterly estimated tax payments to the IRS. The Tax Center shows:

- Your estimated annual tax liability
- Suggested quarterly payment (÷4)
- Due dates for Q1–Q4

### 5. 1099-K threshold tracker (US)

Starting 2024, payment processors report earnings above $5,000 to the IRS on Form 1099-K. Comma tracks your year-to-date platform earnings and alerts you when you approach this threshold.

---

## Vehicle Tax Profile

Each vehicle needs a tax profile set for the current year. To configure:

1. Go to **Tax Center → Vehicle Tax Profiles** (or **Vehicles → [Your Vehicle] → Tax Profile**).
2. Set:
   - **Tax year** — defaults to current year
   - **Country** — inherited from your profile
   - **Deduction method** — Standard Mileage Rate or Actual Expenses
   - **Standard rate** — pre-filled with the current IRS/CRA/HMRC rate
   - **Beginning/ending odometer** — for calculating total annual miles driven

### Deduction method comparison

| Method | Best for | Required records |
|---|---|---|
| Standard mileage | Most gig workers with older vehicles | Just mileage logs |
| Actual expenses | High-cost vehicles (new car, high insurance) | All vehicle receipts |

You cannot switch methods mid-year for the same vehicle. If you start the year on standard mileage, you're locked in for that vehicle for that tax year.

---

## Tax rates by country

### United States 🇺🇸
- Standard mileage rate: IRS-published annually (e.g. $0.67/mile for 2024)
- SE tax rate: 15.3% (12.4% Social Security + 2.9% Medicare)
- Additional Medicare tax: 0.9% on income above $200,000
- Quarterly deadlines: April 15, June 15, September 15, January 15

### Canada 🇨🇦
- CRA mileage rate: varies by province (e.g. $0.70/km for first 5,000 km, $0.64 thereafter)
- CPP self-employment rate: 11.9% on net earnings above the basic exemption ($3,500)
- Provincial income tax applied separately based on province

### United Kingdom 🇬🇧
- HMRC mileage rate: £0.45/mile (first 10,000 miles), £0.25/mile after
- National Insurance Class 2 & 4: Class 2 flat rate + Class 4 on profits above threshold
- Self Assessment filing deadline: January 31

### Nepal 🇳🇵
- Vehicle allowance rates per IRD guidelines
- Income tax brackets as published by Inland Revenue Department

---

## Tax history

Comma keeps a log of every time your tax region or rate was changed (in the `taxHistory` table). This audit trail is valuable if you moved provinces/states mid-year or if rates changed.

View the history in **Tax Center → History**.

---

## Exporting for your accountant

From Tax Center, tap **Export → PDF Summary** to generate a one-page summary of:

- Income, expenses, mileage, and net profit for the year
- Vehicle tax profile settings
- Monthly breakdown

You can also export raw shift and expense data as CSV from **Settings → Export**.
