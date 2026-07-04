# Goals & Gamification

Comma includes a lightweight gamification layer to keep you motivated and help you track progress toward meaningful targets.

---

## Weekly Goals

Set one or more goals to track your progress each week. Goals appear as a progress ring on the Dashboard.

### Creating a goal

Go to **Goals** in the navigation drawer and tap **+ New Goal**.

Configure:
| Field | Options |
|---|---|
| **Label** | Custom name (e.g. "Hit $1,000 this week") |
| **Target value** | A number |
| **Unit** | Currency · Hours · Shifts · Mileage |
| **Period** | Daily · Weekly · Monthly · Yearly |

You can have multiple goals active simultaneously. The Dashboard shows the most relevant active goal, and the Goals screen shows all of them with individual progress rings.

### Goal progress

Progress is calculated in real time from your logged shifts and (for currency goals) net earnings. As you log shifts, the ring fills. A celebration animation plays when you hit 100%.

---

## XP (Experience Points)

XP accumulates over your lifetime of using Comma. It's a long-running measure of how consistently you've used the app.

### Earning XP

| Action | XP |
|---|---|
| Completing a shift | +10 XP |
| Logging an expense | +5 XP |
| Hitting a weekly goal | +25 XP |
| Unlocking a badge | +50 XP |
| Maintaining a 7-day streak | +100 XP bonus |

XP never resets. It accumulates as your permanent record.

### XP levels

XP maps to a level displayed on your profile. Levels increase logarithmically — early levels are fast to reach, later ones take sustained effort. Current level thresholds:

| Level | XP required |
|---|---|
| 1 | 0 |
| 2 | 100 |
| 3 | 300 |
| 5 | 750 |
| 10 | 2,500 |
| 20 | 10,000 |

---

## Badges

Badges are one-time achievements unlocked by hitting milestones. When you unlock a badge, a celebration animation plays and you receive a push notification.

### Badge list

| Badge | Unlock condition |
|---|---|
| **First Trip** | Complete your first shift |
| **Road Warrior** | Complete 5 shifts |
| **Frequent Driver** | Complete 25 shifts |
| **Century Club** | Complete 100 shifts |
| **Early Bird** | Log a shift before 7am |
| **Night Owl** | Log a shift after 11pm |
| **Weekend Warrior** | Log shifts on both Saturday and Sunday |
| **First Dollar** | Earn your first $1 in tips |
| **$1K Club** | Earn $1,000 cumulative net |
| **$5K Club** | Earn $5,000 cumulative net |
| **Expense Tracker** | Log your first expense |
| **Tax Ready** | Complete your vehicle tax profile |
| **7-Day Streak** | Work 7 consecutive days |
| **30-Day Streak** | Work 30 consecutive days |
| **Goal Crusher** | Hit a weekly goal for the first time |
| **Streak Master** | Maintain a 30-day streak |

Badges appear on your profile screen. Tap any badge to see the unlock conditions and your current progress.

---

## Streaks

A streak counts consecutive days you logged at least one shift.

- The streak increments at midnight if you logged a shift that day.
- Missing a day resets the streak to 0.
- You can designate **rest days** (e.g. every Sunday) in Settings. Rest days don't break the streak.

The current streak and your all-time best streak are shown on the Dashboard.

---

## Personal Records

Comma tracks your personal bests automatically:

| Record | Description |
|---|---|
| **Best shift gross** | Highest single-shift gross revenue |
| **Best hourly rate** | Highest earnings per active hour in one shift |
| **Best mileage shift** | Highest miles in one shift |
| **Best day** | Highest net earnings in a single day |
| **Best week** | Highest net earnings in any 7-day period |
| **Best hour of the day** | Which clock hour you earn most per hour on average |
| **Best day of the week** | Which day (Mon–Sun) averages highest earnings |

Personal records appear in Dashboard widgets and on the Profile screen. When you beat a record, you get a subtle celebration notification.

---

## Challenges

In addition to goals, Comma can surface time-limited **challenges** — for example:

- "Log 3 shifts this week"
- "Earn $300 in the next 3 days"
- "Log an expense every day this week"

Challenges appear as cards on the Goals screen. Completing a challenge grants bonus XP and sometimes a badge. Challenges reset on their defined cadence (weekly, monthly).

---

## Notifications

Comma uses local push notifications (not server-sent) for gamification events:

- Badge unlocked
- Personal record beaten
- Weekly goal hit
- Streak at risk (if you haven't logged a shift by 8pm on a work day)
- Recurring expense reminder

All notifications are generated on-device. No account or internet connection is needed. Manage which notifications fire in **Settings → Notifications**.
