import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { updateIndexColumnP } from "@/lib/passSheets";
import { clearIndexRowsCache } from "@/lib/indexRowsCache";

export const runtime = "nodejs";

const LOG = (msg: string, ...args: unknown[]) =>
  console.log("[Dashboard Review Card Number API]", msg, ...args);

export async function POST(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rowNumberRaw = body?.rowNumber;
    const columnPRaw = body?.columnP;

    const rowNumber = Number(rowNumberRaw);
    const columnP = typeof columnPRaw === "string" ? columnPRaw.trim() : "";

    if (!Number.isFinite(rowNumber) || rowNumber <= 1) {
      return NextResponse.json({ error: "Invalid rowNumber" }, { status: 400 });
    }

    await updateIndexColumnP([{ rowNumber, columnP }]);
    clearIndexRowsCache();

    LOG("updated P column", rowNumber, "=", columnP || "(empty)");

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    LOG("error", e);
    return NextResponse.json({ ok: false, error: "Failed to update card number" }, { status: 500 });
  }
}

