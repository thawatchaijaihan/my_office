# PDF Report Hook - Support Cloud Functions ✅

Status: Files created successfully

## Completed Steps:
1. [x] Create TODO.md
2. [x] Create lib/usePdfReport.ts (reusable React hook prioritizing Cloud Functions: check metadata → generate HTTPS → openPdf support)
3. [x] Update TODO

## Summary:
- New `lib/usePdfReport.ts`: Client hook (`use client`) with `checkStatus()`, `regenerate()` calling CF endpoints.
- Server helper `getServerPdfReport()`.
- Handles Telegram WebApp + fallback open.
- Auto-check on mount/cameras change.

Ready for use: Import `{ usePdfReport } from "@/lib/usePdfReport"` in components.

**Task completed.**

