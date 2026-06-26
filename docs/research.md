# Comma App — Product Definition and North American Market Strategy

This document outlines the product definition, core value propositions, and localized market strategies for Comma App in Canada and the United States. It details how the product accommodates regulatory differences, how to collect actionable feedback from users in these markets, and strategies to make the product better.

---

## 1. Product Definition & Value Proposition

Comma is a local-first, privacy-focused utility suite designed specifically for multi-platform gig workers (including delivery couriers, rideshare drivers, grocery shoppers, and parcel couriers). 

### The Problem
Gig workers typically juggle multiple apps (e.g., DoorDash, Uber, Instacart) to maximize their income. This creates significant overhead:
- Tracking earnings across multiple platform dashboards.
- Calculating true net income after factoring in expenses and gas.
- Logging active and "dead" (unpaid commuting/waiting) mileage for tax write-offs.
- Managing complex self-employment tax obligations (estimated quarterly payments, CPP, SE tax, sales tax).
- Lack of data-driven insights on which platforms, hours, or days are most profitable.

### Comma's Solution
Comma aggregates these concerns into a single, unified, offline-first dashboard.
- **Privacy-First**: 100% of user data is stored locally in an SQLite database on the device, ensuring sensitive location and financial data is never sold or uploaded.
- **Dynamic Platform Context**: Adapts UI, terminology, and forms based on the active platform (e.g., changing "Driver" to "Dasher" for DoorDash, or enabling cash-payment fields for rideshare bidding apps).
- **Tax and Mileage Automation**: Pre-configured with regional rules, standard write-off rates, and quarterly tax deadlines to prevent audit headaches.
- **Data-Driven Insights**: A premium visual bento-grid dashboard providing real-time pacing relative to goals, hourly efficiency analytics, and trend visualization.

---

## 2. Market Analysis: Canada (CA) vs. United States (US)

To win the North American gig worker market, Comma must feel natively tailored to both jurisdictions. The table below outlines how the product adapts to the distinct environment of each market:

| Feature / Dimension | Canada (CA) Market | United States (US) Market |
| :--- | :--- | :--- |
| **Primary Currency** | CAD ($) | USD ($) |
| **Distance & Speed** | Metric (Kilometers / km / km/h) | Imperial (Miles / mi / mph) |
| **Tax Authority** | Canada Revenue Agency (CRA) | Internal Revenue Service (IRS) |
| **Standard Mileage Write-off** | $0.70 per km (CRA 2026 standard rate) | $0.67 per mile (IRS 2026 standard rate) |
| **Regional Rate Overrides** | Standard across all provinces | California Prop 22 active mileage rate ($0.35/mi) |
| **Self-Employment Taxes** | Canada Pension Plan (CPP) self-employed contribution | Self-Employment Tax (SE Tax: 15.3% on 92.35%) |
| **Sales Tax Obligations** | GST/HST Collected & Input Tax Credits (ITC) | N/A (Self-employed generally exempt from sales tax collection) |
| **Regulatory Form References** | Form T2125 (Statement of Business Activities) | Schedule C (Profit or Loss From Business) |
| **Dominant Gig Platforms** | SkipTheDishes, UberEats, DoorDash, Amazon Flex | DoorDash, UberEats, Uber, Lyft, Instacart, Amazon Flex |

---

## 3. Canadian Market Strategy & Features

Canadian gig workers face strict CRA reporting requirements and a highly consolidated platform ecosystem.

### Key Technical Integrations:
1. **CRA Form T2125 Alignment**:
   - Expense categories must map to lines on the T2125 form (e.g., motor vehicle expenses, phone and internet, insurance, and licensing).
   - Reports must export directly into a formatted CSV/PDF that matches these lines to simplify filing with tax software (like Wealthsimple Tax or TurboTax Canada).
2. **GST/HST and Net Remittance**:
   - Rideshare drivers in Canada must register for a GST/HST number from day one, while delivery couriers must register after crossing $30,000 in gross revenue.
   - Comma provides an HST Collected Tracker and Input Tax Credit (ITC) tracker, allowing users to deduct the GST paid on business expenses from the HST collected on rideshare fares, showing the net amount owed or refundable.
3. **CPP Self-Employment Engine**:
   - Calculates the double portion of CPP (both employee and employer rates, totaling 11.9% up to the Year's Maximum Pensionable Earnings limit) to ensure users set aside sufficient funds.
4. **SkipTheDishes Integration**:
   - SkipTheDishes is a major Canadian-only delivery player. Comma includes Skip-specific terminology and payout tracking.

---

## 4. United States Market Strategy & Features

The US market is significantly larger and highly fragmented, with intense state-level regulatory variances (e.g., California's Prop 22, Massachusetts' gig worker minimum earnings).

### Key Technical Integrations:
1. **IRS Schedule C & 1040-ES**:
   - Calculates 15.3% SE Tax on 92.35% of net self-employment earnings.
   - Generates estimated quarterly payment reminders based on the IRS dates (April 15, June 15, September 15, January 15).
2. **Prop 22 active mileage tracking**:
   - In California, platforms are mandated to reimburse drivers at a set rate per active mile (currently $0.35/mi).
   - Comma tracks both **active miles** (from order acceptance to drop-off) and **dead miles** (cruising/waiting), enabling California drivers to reconcile platform payouts against actual driving logs.
3. **State & Local Withholding Presets**:
   - With 50 states + DC, tax liabilities vary dramatically. Comma integrates a comprehensive withholding database so a user in Texas (no state income tax) gets a different withholding suggestion than a user in California or New York.

---

## 5. Gathering User Feedback (What Users Want)

To refine the product and prioritize the roadmap, we must implement friction-free methods to capture quantitative and qualitative user data:

### In-App Channels (Passive & Active)
1. **Local-First Feedback Form**:
   - Include a "Submit Feedback" option under the "More" tab that allows users to write their pain points or request features.
   - To respect privacy, the form should compile a localized JSON payload (containing app version, active country, OS, database row counts, but **no** personally identifiable coordinates or transaction details) and prompt the user to email it or submit it via a secure HTTPS API endpoint.
2. **App Store Review Prompts**:
   - Implement target-driven review prompts (using `expo-store-review`) triggered only after a user successfully logs their 10th shift or hits their first weekly goal. Happy users are more likely to leave constructive feedback.

### Community & Social Mining (Targeting Gig Communities)
1. **Gig Worker Subreddits**:
   - Actively monitor and solicit feedback from communities like `r/couriersofreddit`, `r/doordash_drivers`, `r/uberdrivers`, and `r/SkipTheDishes`.
   - Thread topics should focus on tax headaches, mileage logging issues, and dashboard widget requests.
2. **Competitor Gap Analysis**:
   - Monitor reviews of competing apps (e.g., Gridwise, MileIQ, Hurdlr, Solo).
   - Common complaints in these apps include: battery drain from automatic GPS, rising subscription prices, data privacy concerns, and poor multi-platform aggregation. Comma should market itself directly against these gaps.

---

## 6. How to Make the Product Better (Feature Roadmap)

Based on the core needs of North American gig workers, the following features represent the highest-value expansions for Comma:

### A. Intelligent Background Tracking (Battery & Accuracy Balance)
- **Automatic Motion Detection**: Use device sensors (via `expo-sensors`) to detect driving state and automatically toggle GPS tracking on/off, preventing users from forgetting to start a shift.
- **Smart Jitter Filtering**: Implement Kalman filtering on coordinate inputs to ignore GPS jumps, ensuring mileage logs are accurate and audit-proof.

### B. Tax Audit-Ready Mileage Log Exports
- Both the CRA and the IRS require detailed logbooks (date, destination, business purpose, starting/ending odometer readings).
- Comma should generate a dedicated "Audit-Ready Mileage Log" PDF featuring clean tables, standard deduction calculations, and a signature line, which can be printed or emailed directly to accountants.

### C. Multi-Platform Statement Parsing
- Gig workers find manual data entry tedious. 
- Implement a secure, local CSV parser or screenshot reader (using device-native OCR/Vision APIs) that reads DoorDash or Uber weekly statement files/screenshots and imports shift details, tips, and active hours automatically.

### D. Localized Earnings Predictor
- Analyze historical SQLite data to show the user their most profitable zones, times, and platforms.
- Provide a "Shift Recommender" widget: "Based on your last 4 weeks, driving UberEats on Thursday at 6:00 PM yields an average of $28.50/hour compared to DoorDash ($22.00/hour)."

---

