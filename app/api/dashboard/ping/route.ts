import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/ping
 * Lightweight health endpoint for Dashboard.
 * Supports Cloud Scheduler secret auth and dashboard user auth.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.DASHBOARD_PING_CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const headerToken = req.headers.get("x-cron-token")?.trim() ?? "";
  const queryToken = req.nextUrl.searchParams.get("token")?.trim() ?? "";

  const hasValidCronSecret =
    !!cronSecret &&
    (bearerToken === cronSecret || headerToken === cronSecret || queryToken === cronSecret);

  if (!hasValidCronSecret) {
    const authorized = await isDashboardAuthorized(req);
    if (!authorized) {
      return NextResponse.json({ ok: false, error: "??????????? (401)" }, { status: 401 });
    }
  }

  return NextResponse.json({ ok: true, source: hasValidCronSecret ? "cron" : "dashboard" });
}
