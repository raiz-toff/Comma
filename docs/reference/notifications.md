# Notifications

What Comma can notify you about, where the toggles live, and how the phone and web apps differ.

<Chips accent="cyan" items={["Badge unlocked", "Level up", "Streak at risk", "Tax instalment due", "Shift reminder · 30 min before", "Backup complete"]} caption="Seven toggles under Settings → Alerts. Only the phone can deliver these in the background; the web shows them in the page while a tab is open." />

---

## Where the toggles live

Notification toggles are in **Settings, Alerts**. See [Settings](settings.md) for the full list of the seven switches and their defaults. Turning a category off silences both its in-app entries and its phone notifications.

---

## Notification types

Comma raises two kinds of notification: entries in the in-app list, and, on the phone app, notifications delivered by the operating system. Most events appear in both places.

| Notification | Trigger |
|---|---|
| New badge unlocked | You earn one of the one-time achievement badges. |
| Challenge complete | You finish one of the weekly challenges. |
| Level up | Your accumulated XP crosses a level boundary. |
| Streak-freeze granted | You are awarded a streak freeze to protect a day off. |
| Day-streak at risk | Your consecutive-day streak will lapse unless you log a shift. |
| Tax instalment due soon | A CRA quarterly instalment date is approaching. |
| Scheduled-shift reminder | 30 minutes before a scheduled shift. On the phone this reminder carries Start shift and Remind in 10m actions. |
| Backup or sync overdue | Your Google Drive backup has not run recently. |
| Backup complete | A backup finishes successfully. |
| Backup failed | A backup does not complete. |
| Export complete | A CSV export finishes. |
| Import complete | A CSV import finishes. |
| Data cleared | A reset from the Danger Zone completes. |

The first group are the gamification and reminder notifications. The last group are operational confirmations that tell you a background task has finished.

---

## Phone versus web

The phone app can deliver notifications while the app is closed, because it runs a background service. During a live shift it also shows a persistent ongoing notification so you always know tracking is running.

The web app has no true background push. It shows the same reminders as in-page messages while a tab is open, and cannot notify you once the tab is closed. See [Web app](../features/web-app.md).
