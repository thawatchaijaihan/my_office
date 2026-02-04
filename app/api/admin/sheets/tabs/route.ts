import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { listSpreadsheetTabs, parseSpreadsheetId } from "@/lib/googleSheets";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const expected = config.admin.apiKey;
  if (!expected) return false;
  const provided = req.headers.get("x-admin-key") ?? "";
  return provided === expected;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const spreadsheetIdParam = url.searchParams.get("spreadsheetId");
    const spreadsheetUrlParam = url.searchParams.get("spreadsheetUrl");

    const spreadsheetId =
      spreadsheetIdParam ||
      (spreadsheetUrlParam ? parseSpreadsheetId(spreadsheetUrlParam) : null) ||
      undefined;

    const tabs = await listSpreadsheetTabs({ spreadsheetId });

    return NextResponse.json({
      spreadsheetId: spreadsheetId ?? config.google.sheetsId ?? null,
      tabs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Admin Tabs] Error:", err);
    return NextResponse.json(
      { error: "Google Sheets API error", message },
      { status: 500 }
    );
  }
}

