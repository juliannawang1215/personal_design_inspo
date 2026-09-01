# Chrome Web Store Metadata — Inspo

## Basic Information

- **Name**: Inspo — Visual Reference Collector
- **Short Name**: Inspo
- **Version**: 1.0.0
- **Summary**: Lightweight 1-click visual reference collector and inspiration library for designers and creatives.
- **Category**: Photos & Graphics / Productivity
- **Primary Language**: English

## Description

Inspo is the fastest, most lightweight way to collect visual references while browsing the web.

Capture inspiration with zero interruption:
• Hover over any image on the web
• Click "Save" in a single click
• Optionally add a quick note
• Continue browsing seamlessly

All your visual references are stored locally on your device with complete data ownership and offline resilience.

### Features
• ⚡ **1-Click Capture**: Hover over any image and save it immediately without opening tabs, selecting folders, or filling forms.
• 🔒 **Local-First & Private**: Works completely offline. No accounts, no external tracking, no cloud servers. User data stays strictly on your computer.
• 🖼️ **Visual Masonry Library**: A dedicated library view designed with a clean Pinterest/Cosmos aesthetic to showcase your collected references.
• 🔍 **Instant Search**: Real-time filtering across notes, source websites, and titles as you type.
• 📦 **Complete Library Export**: Download your entire reference archive at any time as a `.zip` package containing high-resolution images, `metadata.json`, and `metadata.csv`.
• 🛡️ **Isolated Shadow DOM**: Clean, non-intrusive UI that never interferes with host webpage layout or styles.

## Permissions Justification

| Permission | Justification |
|---|---|
| `storage` | Required to store user preferences and lightweight extension settings. |
| `unlimitedStorage` | Required to store high-resolution image references and blobs inside local IndexedDB without browser quota constraints. |
| `tabs` | Required to open the full Visual Library page and focus the tab when the extension icon is clicked. |
| `host_permissions: ["<all_urls>"]` | Required to download image binaries from remote origins so references remain preserved locally even if the host website removes them. |

## Privacy Policy & Data Collection

- **Remote Servers**: None. Inspo does not send your data to any external server or third-party service.
- **Personal Data**: No personal data, browsing history, or analytics are collected or tracked.
- **Data Storage**: All images and metadata are stored solely inside your browser's local IndexedDB.

## Version History

- **1.0.0 (2026-08-31)**: Initial release of Inspo — 1-click hover save, Shadow DOM overlay, IndexedDB storage, Masonry Library, real-time search, note editor, and ZIP export.
