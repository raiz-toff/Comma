# Goals and Gamification

Goals turn a vague intention into a number you can watch fill. A light gamification layer sits on top for the drivers who want it — and stays out of the way for those who don't.

<StatRow accent="indigo" items={[{ value: "100 XP", label: "one level" }, { value: "24", label: "badges" }, { value: "3", label: "streak freezes, max held" }, { value: "$500", label: "default weekly goal" }]} caption="Three challenges reset every Monday. Turn the Goals flag off and the whole layer — badges, streaks, XP — goes with it." />

---

## Goals

A goal tracks progress toward a target over a period. You choose the type and the period:

| Type | Measures |
|---|---|
| Earnings | Money made. |
| Hours worked | Time on shift. |
| Shifts completed | Number of shifts. |
| Active distance | Kilometres driven on a delivery. |

| Period |
|---|
| Daily |
| Weekly |
| Monthly |
| Yearly |

Setup seeds a **default $500 weekly earnings goal** so the dashboard has something to show from day one. It's a placeholder, not a recommendation — change the number, type, or period whenever you like. **Set a weekly goal** is also an item on the dashboard activation checklist, so you're reminded to make it your own.

---

## Gamification

The rest of this page applies only when the **Goals feature flag is on**. Turn Goals off and XP, badges, streaks, and challenges go with it, since they have nowhere to live.

---

## XP and levels

XP accrues from the work you log:

| Source | XP |
|---|---|
| Each shift | +10 |
| Earnings | Scales with the amount |
| Distance | Scales with the distance |
| Meeting a duration target | +15 |
| Breaking a record | +30 each |
| Unlocking a badge | +40 |
| Completing a challenge | +60 |
| Goals currently met | +20 |

Every **100 XP** is one level. Leveling up grants a **streak freeze**, capped at three held at once.

---

## Streaks and streak freezes

Your **streak** is the number of consecutive days with a logged shift. A **streak freeze** covers a day off, so a planned break doesn't reset the count. You earn freezes by leveling up and can bank up to three — enough to protect a weekend or a short holiday without losing your run.

---

## Weekly challenges

Three challenges run each week and reset on Mondays:

| Challenge | Target |
|---|---|
| Earn $500 this week | $500 in earnings |
| 20 deliveries | 20 completed deliveries |
| 5-day streak | Log a shift five days running |

---

## Badges

There are 24 badges in total — one-time unlocks for milestones large and small. A representative sample:

| Badge | Unlocked by |
|---|---|
| First shift | Logging your first shift. |
| $100 day | Earning $100 in a single day. |
| Marathon shift | A single long shift. |
| Early bird | Working an early-morning shift. |
| Night owl | Working a late-night shift. |
| 7-day streak | Seven consecutive days with a shift. |
| 30-day streak | Thirty consecutive days. |
| 100-day streak | One hundred consecutive days. |
| Tip champion | A standout tips total. |
| Mileage master | Covering serious distance. |
| Road warrior | Sustained driving volume. |
| Record breaker | Setting a new personal best. |
| Efficiency expert | A strong active-to-dead ratio. |

When a shift unlocks a new badge, a **celebration** appears once the shift is saved.

---

## The Progress tab

Everything gamified lives in one place: the **Progress** tab shows your XP and level, your streak shields, the current weekly challenges, and the full badge grid.
