<div align="center">
  <img src="public/icons/icon-512.svg" alt="Macadam Logo" width="128" />
  <h1>Macadam</h1>
  <p><strong>A fast, local-first earnings tracker built exclusively for gig economy delivery drivers.</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Build](https://img.shields.io/badge/build-esbuild-brightgreen)](https://esbuild.github.io/)
  [![PWA](https://img.shields.io/badge/PWA-Ready-blue)](#)
</div>

> [!WARNING]  
> **Currently in Active Development**  
> Macadam's core engine is fully functional, but currently **only Ontario (Canada) is officially added** to the market registry. Other provinces, states, and countries are not yet added. We highly encourage and thank you for any contributions to add your local region's tax rules and platforms! (See the docs below on how to add a country/province).

---

## What is Macadam?

Macadam is an advanced, offline-first dashboard for multi-apping delivery drivers (DoorDash, Uber Eats, Skip, Instacart, etc.). It helps you track your true net hourly rate, vehicle expenses, tax obligations, and goal streaks—all without your data ever leaving your device.

By treating gig work like a real business, Macadam gives you the same analytics an office worker takes for granted, tailored to the realities of delivery logistics.

---

## 📱 App Interface

Experience a state-of-the-art interface designed for speed and clarity.

### Dashboard & Analytics
The heart of Macadam. A high-fidelity Bento-style dashboard providing real-time insights into your earnings, expenses, and goal progress.

![Dashboard Overview](docs/images/image.png)

<table width="100%">
  <tr>
    <td width="50%" align="center">
      <strong>Platform Switcher</strong><br/>
      <img src="docs/images/image-2.png" alt="Platform Switcher" /><br/>
      <em>Seamlessly switch with a touch-optimized sliding pill.</em>
    </td>
    <td width="50%" align="center">
      <strong>Visual Goals</strong><br/>
      <img src="docs/images/image-3.png" alt="Visual Goals" /><br/>
      <em>Track targets with interactive SVG progress rings.</em>
    </td>
  </tr>
</table>

### Expenses & Settings
Manage your business costs with region-specific tax categories and fine-tune your experience with modular settings.

<table width="100%">
  <tr>
    <td width="50%" align="center">
      <strong>Expense Tracking</strong><br/>
      <img src="docs/images/image-1.png" alt="Expense Tracking" /><br/>
      <em>Detailed management with tax set-aside hints.</em>
    </td>
    <td width="50%" align="center">
      <strong>Modular Settings</strong><br/>
      <img src="docs/images/image-4.png" alt="Settings" /><br/>
      <em>A tabbed, organized interface for personalization.</em>
    </td>
  </tr>
</table>

---

## ⚡️ Features

* **Multi-App Intelligence**: Define which platforms you run. Macadam understands their unique terms (Peak Pay vs. Surge) and provides platform-specific form fields.
* **True Net Earnings**: Auto-calculates your real hourly rate after fuel, maintenance, and vehicle depreciation.
* **Tax Peace of Mind**: Computes suggested tax set-asides based on your region, handles Canadian HST tracking, and isolates deductible business expenses.
* **Gamification & Goals**: Set weekly earnings targets, maintain streaks, and unlock achievement badges.
* **100% Offline & Private**: Built on IndexedDB and a custom Service Worker. It works in dead zones, and your financial data never hits a cloud server.
* **Blazing Fast**: Vanilla JavaScript and CSS. Zero framework overhead.

---

## 🚀 Quick Start

Requires [Node.js](https://nodejs.org/) (v18+) solely for the local build server.

```bash
# 1. Clone the repository
git clone https://github.com/raiz-toff/macadam.git
cd macadam

# 2. Install dev dependencies (esbuild)
npm install

# 3. Start the dev server in watch mode
npm run dev
```

Open `http://localhost:3000` (or whatever port `serve` assigns) in your browser.

> **Tip:** You can install Macadam as a standalone app on your phone or desktop directly from your browser (PWA).

---

## 🏗 Tech Stack

Macadam is an exercise in stripping away modern web bloat:

* **No Frameworks**: 100% Vanilla JS (ES2022) and Vanilla CSS.
* **Database**: `Dexie.js` wrapping IndexedDB for powerful client-side querying.
* **Bundler**: `esbuild` for instant builds.
* **Charts**: `Chart.js` (vendored).
* **Routing**: Simple hash-based router.
* **PWA**: Custom, hand-written Service Worker (no Workbox black boxes).

---

## 📖 Documentation

Macadam is built on a highly modular **Registry Architecture** that separates core engine logic from market/platform specifics. Check out the `docs/` folder to understand how it works or how to extend it.

* [**Architecture Overview**](docs/Registry_arch.md)
* [**Feature Modularity**](docs/feature_modularity.md)
* [**How to Add a Platform**](docs/adding-a-platform.md)
* [**How to Add a Country**](docs/adding-a-country.md)
* [**How to Add a Province/State**](docs/adding-a-province.md)

---

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) to learn how to set up your environment, follow our architectural patterns, and submit pull requests.

We ask all contributors to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📄 License

Macadam is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for more details.
