# Feature flags

The optional features you can switch on or off, what each one gates, and which parts of the app are always on.

<Chips accent="indigo" items={["analytics_advanced · on", "tax_workspace · on", "goals · on", "schedule · off", "pdf_reports · off"]} caption="Five flags gate whole screens, so the app is only as large as you need. Turn goals off and badges and streaks go with it." />

---

## The toggles

Optional features live in **Settings, You, Optional Features** on the phone app. Each toggle shows or hides a whole screen, so the app is only as large as you need it.

| Flag | Screen or effect | Default |
|---|---|---|
| `analytics_advanced` | Analytics tab | On |
| `tax_workspace` | Tax tab | On |
| `goals` | Goals screen | On |
| `schedule` | Schedule screen | Off |
| `pdf_reports` | PDF export in Reports | Off |

---

## Dependencies

Turning off **Goals** also turns off **badges** and **streaks**. They live inside the Goals screen and have nowhere to appear once it is hidden, so they switch off with it. Turning Goals back on restores all three.

The other flags are independent. Switching one off has no effect on the rest.

---

## Always on

Core features are never presented as toggles because the app depends on them. They are always available.

| Feature | Notes |
|---|---|
| Shift tracking | Recording work sessions, the primary purpose of the app. |
| Expenses | Logging and categorizing costs. |
| Basic analytics | The everyday earnings and distance figures, distinct from the advanced Analytics tab. |
| CSV export | Exporting shifts and expenses to a spreadsheet file. |
| Google Drive backup | Backup and sync through your own Drive. |

---

## Where the flags come from

Defaults are set by the app and can be overridden by the country in effect. The Canadian market ships with the defaults shown above and does not force any flag on or off. See [Settings](settings.md) for the toggle screen and [Core concepts](../getting-started/core-concepts.md) for how the flags shape the app.
