# Inspo — Lightweight Visual Reference Collector

A fast, local-first Chrome extension (Manifest V3) for collecting visual inspiration directly from any webpage.

> **See an image → hover → click Save → optionally add a note → continue browsing.**

---

## ✨ Features

- **One-Click Instant Capture**: Hover over any image on the web and click **Save**. No required folders, tags, or page redirects.
- **Optional Contextual Notes**: Add notes immediately via an unobtrusive popover, or edit them anytime later in the library.
- **Shadow DOM Overlay**: 100% style-isolated floating save button that never pollutes or gets affected by host webpage styles.
- **Local-First & Offline Preserved**: Image binaries and metadata are stored in your browser's IndexedDB. No login, no accounts, no cloud sync, no tracking.
- **Masonry Visual Library**: A dedicated full-page visual archive with responsive columns, Cosmos/Pinterest aesthetics, and keyboard navigation.
- **Real-Time Search**: Instant search filtering across notes, source titles, and website domains.
- **Complete ZIP Export**: Download your entire archive as a portable `.zip` file containing high-resolution images, `metadata.json`, and `metadata.csv`.

---

## 🚀 How to Install in Chrome

1. Clone or open this folder (`/Users/julianna/Inspo`).
2. Build the extension:
   ```bash
   npm install
   npm run build
   ```
3. Open Google Chrome and navigate to `chrome://extensions/`.
4. Turn ON **"Developer mode"** in the top-right corner.
5. Click **"Load unpacked"** and select the `/Users/julianna/Inspo/dist` directory.
6. The Inspo extension is now installed! Pin it to your toolbar for quick access to your Visual Library.

---

## 💻 Development

- `npm run dev`: Start Vite development server for testing library UI.
- `npm run build`: Type-checks with `tsc` and bundles the Chrome extension into `dist/`.
- `npm run generate-icons`: Re-generates PNG icons for Chrome extension sizes (16, 32, 48, 128px).

---

## 📁 Architecture

```text
Inspo/
├── dist/                    # Compiled extension ready for "Load unpacked"
├── public/
│   └── icons/               # 16, 32, 48, 128px PNG icons
├── src/
│   ├── background/
│   │   └── service-worker.ts# Extension lifecycle, tab manager, CORS fetcher
│   ├── content/
│   │   ├── image-detector.ts# Image filtering (>= 150x150), srcset/currentSrc
│   │   ├── overlay.ts       # Shadow DOM overlay, hover button & note popover
│   │   ├── overlay.css      # Scoped styles for Shadow DOM
│   │   └── index.ts         # Content script entry
│   ├── storage/
│   │   ├── db.ts            # Dexie.js IndexedDB storage & duplicate checks
│   │   ├── exporter.ts      # ZIP exporter (images + json + csv)
│   │   └── types.ts         # Data models & message contracts
│   └── library/
│       ├── App.tsx          # Main Visual Library app
│       ├── components/      # Header, Masonry Grid, Card, Detail Modal, Empty State
│       └── main.tsx         # React root
├── manifest.json            # Chrome Manifest V3 configuration
├── package.json
└── vite.config.ts
```
