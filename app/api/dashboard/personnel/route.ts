import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { getAllPersonnel } from "@/lib/personnelDb";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await getAllPersonnel();
    return NextResponse.json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Dashboard Personnel API] Error:", err);
    return NextResponse.json(
      { error: "Failed to load personnel", message },
      { status: 500 }
    );
  }
}
