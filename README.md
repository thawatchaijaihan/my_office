# Jaihan Office Dashboard 🏛️

A modern administrative dashboard and CCTV monitoring system for office facility management. Built with Next.js 14, Firebase, and Google Sheets integration.

## 🚀 Key Features

*   **Admin Dashboard**: Secure management system with Firebase Authentication.
*   **Personnel Database**: Real-time sync with Google Sheets for personnel records, banking, and contact info.
*   **Gate-Pass Search**: Fast landing page for users to check their vehicle/personnel pass status.
*   **CCTV Map**: Interactive Google Maps integration for monitoring camera locations and status.
*   **Automated Sync**: One-click sync from Google Sheets to Firestore for improved performance.

## 🛠️ Tech Stack

*   **Framework**: Next.js 14 (App Router)
*   **Language**: TypeScript
*   **Database**: Firebase Realtime Database (User preferences) & Firestore (Personnel records)
*   **Auth**: Firebase Auth
*   **Maps**: Google Maps JS API
*   **Styles**: Tailwind CSS + Shadcn UI
*   **API**: Google Sheets API v4

## 📦 Getting Started

### 1. Environment Configuration
Create a `.env` file based on `.env.example`:

| Variable | Description |
|----------|-------------|
| `GOOGLE_SHEETS_ID` | Main Spreadsheet ID |
| `PERSONNEL_SHEET_GID` | GID for the "personnel" tab |
| `INDEX_SHEET_GID` | GID for the "dashboard/index" tab |
| `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` | GCP Service Account JSON key (Base64 encoded) |
| `ADMIN_FIREBASE_EMAILS` | Comma-separated admin emails |

### 2. Installation
```bash
npm install
```

### 3. Running Locally
```bash
npm run dev
```

### 4. Syncing Data
To pull the latest data from Google Sheets into Firestore:
```bash
npm run sync-personnel
```

## 🌐 Deployment

The project is designed to be deployed via **Firebase App Hosting**. 
Pushing to the `main` branch automatically triggers the build and deployment pipeline.

---
*Maintained by Thawatchai Jaihan*
