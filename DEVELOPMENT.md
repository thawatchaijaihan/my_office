# Development Guide 🛠️

Project status and developer-only instructions for the Office Dashboard.

## 📌 Project Status

*   **Version**: 1.0.0 (Post-Refactor, Next.js 15)
*   **Status**: Stable. Telegram and Gemini AI components have been permanently removed.
*   **Main Focus**: Administrative dashboard for gate-pass management and CCTV map visualization.

## 🧩 Key Components

### 1. Dashboard Authentication
Access to `/dashboard/*` is protected by `lib/dashboardAuth.ts`. 
Admins are defined in:
1.  Firebase Realtime Database (path: `dashboardAdmins/`)
2.  Environment variables: `ADMIN_FIREBASE_EMAILS` or `ADMIN_FIREBASE_UIDS`.

### 2. Personnel Sync
The system pulls data from Google Sheets and caches it in memory. 
-   **Sheet Source**: Defined by `GOOGLE_SHEETS_ID` and `PERSONNEL_SHEET_GID`.
-   **Logic**: Located in `lib/personnelSheets.ts` and `lib/personnelDb.ts`.

### 3. CCTV Map
Interactive map for monitoring cameras.
-   **API**: Uses Google Maps JavaScript API with markers and clusters.
-   **Features**: Filter by camera status, view live/static streams (if configured).

## 🗃️ Firebase Structure

### 1. Firestore
-   **`personnel/`**: Stores synced personnel records (Full name, bank, phone).

### 2. Realtime Database
-   **`dashboardAdmins/`**: Allowed admin accounts.
-   **`cctvConfig/`**: Global configuration for maps.

## 🧪 Testing

Run vitest suits:
```bash
npm run test
```

## 🏗️ Deployment (Production)

Deployment is via **Firebase App Hosting**.
-   **Build Profile**: Uses `npm run build`.
-   **Secrets**: All sensitive variables are stored in Google Cloud Secret Manager and mapped via `apphosting.yaml`.

---
*Last Updated: 2026-04-20*
