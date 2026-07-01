# Analytics & Reports

Comma turns your shift and expense data into clear, actionable charts and summaries.

---

## Dashboard widgets

The Dashboard is the first screen you see. It shows a personalized feed of widgets:

| Widget | What it shows |
|---|---|
| **Earnings summary** | Today's / this week's net earnings, plus a sparkline trend |
| **Rolling trend** | Your earnings trend over the last 7–30 days |
| **Weekly projection** | Estimated week-end earnings based on current pace |
| **Streak** | Consecutive working days + best streak |
| **Income breakdown** | Earnings split by platform (pie or bar) |
| **Best day** | Your highest-earning day of the week (historical average) |
| **Best hour** | Your highest-earning hour of the day |
| **Dead miles** | Summary of dead (commute) miles this week |
| **Platform activity** | Sessions per platform, online hours, trips |
| **Active goal** | Progress ring for your current active goal |

Widgets update automatically as you log shifts. Pull down on the Dashboard to force a refresh.

---

## Analytics tab

The Analytics tab (`/analytics`) provides deeper charts with date-range filters.

> The Analytics tab is gated by the `analytics_advanced` feature flag. If you don't see it, check **Settings → Developer → Features**.

### Earnings charts

- **By day of week** — which days earn you most on average
- **By hour of day** — heat map of hourly earnings patterns
- **By platform** — earnings split and trend per platform
- **Cumulative YTD** — running total for the calendar year
- **vs. Goal** — actual vs. target for any active goal

### Mileage charts

- **Total mileage by week/month**
- **Active vs. dead miles ratio**
- **Deductible mileage YTD**

### Expense charts

- **By category** — where your money goes
- **By month** — expense trend
- **Net margin** — earnings minus expenses over time

### Hourly rate analysis

- **Effective hourly rate** — net earnings ÷ active hours per shift
- **Best vs. worst shifts** — compare your top and bottom 10% for patterns
- **Time-to-first-order** — average dead time before first delivery

---

## Reports panel

The Reports panel slides in from the right edge of the screen. Open it by tapping **Reports** in the navigation drawer.

Reports are pre-formatted summaries you can use for:
- Weekly review
- Monthly accounting
- Sharing with an accountant

Available reports:

| Report | Content |
|---|---|
| **Weekly Summary** | All shifts, total hours, earnings, mileage, expenses for the week |
| **Monthly Summary** | Same as weekly but for the month, with YTD totals |
| **Expense Report** | All expenses grouped by category with deductible amounts |
| **Mileage Log** | IRS-compliant mileage log (date, purpose, start/end, miles) |
| **Platform Report** | Earnings breakdown per platform with hourly rates |
| **Tax Estimate** | Full tax estimate (same as Tax Center, printable format) |

Each report supports:
- **Date range picker** — any custom range
- **PDF export** — generates a formatted PDF
- **CSV export** — raw data for spreadsheets

---

## Platform filter

The **Global Platform Filter** at the top of every screen lets you narrow all views (Dashboard, Analytics, Shifts, Expenses) to one platform or all platforms. Tap the platform badge in the top header to open the filter.

This is useful for reviewing your DoorDash performance independently of Uber Eats, for example.

---

## Schedule view

The Schedule view (`/schedule`) shows a weekly calendar of your shifts — a visual overview of which days and hours you worked. Useful for identifying patterns and planning your schedule.

> Gated by `schedule` feature flag.

---

## Exporting data

### CSV export

**Settings → Export → CSV**

Exports your data in machine-readable format for use in Excel, Google Sheets, or accounting software.

Available exports:
- Shifts CSV (all fields)
- Expenses CSV
- Mileage log CSV (formatted per IRS Publication 463)

### PDF reports

Generated from the Reports panel. PDFs are saved to your device's downloads folder.

### Sharing

Any report can be shared via the iOS/Android share sheet — email it to your accountant, save to Files, or upload to Drive.
