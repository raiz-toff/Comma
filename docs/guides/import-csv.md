# Import shifts and expenses from a spreadsheet

Bring existing records into Comma from a CSV file.

<StepFlow accent="cyan" steps={[{ title: "Choose what to import", body: "Shifts, expenses, or platform incomes." }, { title: "Map your columns", body: "Point your spreadsheet headers at Comma fields." }, { title: "Preview, then commit", body: "Nothing is written until the preview looks right." }]} caption="The web importer takes any CSV with a header row. Amount and date are the only required columns." />

---

Comma's full CSV importer is a **web-app feature**. The phone has a simpler CSV import under **Settings → Data**, covered at the end of this page.

---

## On the web

### 1. Open the importer

Go to **Import**, or **Settings → Data**.

### 2. Choose what you're importing

Pick one: **Shifts**, **Expenses**, or **Platform incomes**.

### 3. Upload your CSV

The file needs a header row — the importer reads your column names from it.

### 4. Map your columns

Across a few steps, you match each column in your file to a field in Comma. What's required depends on what you're importing.

For **Shifts**:

| Column | Required |
|---|---|
| Gross revenue | Yes |
| Date | Yes |
| Start time | Optional |
| End time | Optional |
| Platform | Optional |
| Orders | Optional |
| Distance (km) | Optional |
| Dead mileage | Optional |
| Out-of-pocket | Optional |
| Notes | Optional |

For **Expenses**:

| Column | Required |
|---|---|
| Amount | Yes |
| Date | Yes |
| Category | Optional |
| Platform | Optional |
| Business use % | Optional |
| Recurring | Optional |
| Notes | Optional |

### 5. Preview, then commit

Before anything is saved, a preview shows the parsed rows and flags any conflicts with shifts you already have. Review it, then commit.

---

## An example header row

A minimal shift file needs only Gross revenue and Date. A fuller one might look like this:

```
Date,Start time,End time,Platform,Gross revenue,Orders,Distance (km),Dead mileage,Out-of-pocket,Notes
2026-06-14,17:30,22:10,DoorDash,142.00,11,47,8,6.50,Friday dinner rush
```

---

## On the phone

The phone's CSV wizard is simpler. It maps these columns:

| Column | Required |
|---|---|
| Platform | Yes |
| Start | Yes |
| End | Yes |
| Gross | Optional |
| Tips | Optional |
| Active mileage | Optional |
| Dead mileage | Optional |

Find it under **Settings → Data**.

---

## Related

- [Shift Tracking](../features/shift-tracking.md) — what a shift record holds
- [Expenses](../features/expenses.md) — categories and business-use percentages
