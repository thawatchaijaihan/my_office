import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { setTelegramMenuButton, setTelegramCommands } from "@/lib/telegram";

/**
 * POST /api/telegram/setup-menu
 * ตั้งค่า Menu button + รายการคำสั่งของ Telegram Bot
 * เรียกครั้งเดียวหลัง deploy (ส่ง x-admin-key หรือ ?key=)
 */
export async function POST(req: NextRequest) {
  const expected = config.admin.apiKey;
  if (expected) {
    const provided =
      req.headers.get("x-admin-key") ?? req.nextUrl.searchParams.get("key") ?? "";
    if (provided !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const dashboardUrl = config.telegram.dashboardUrl;
  if (!dashboardUrl) {
    return NextResponse.json(
      { error: "TELEGRAM_DASHBOARD_URL is not set" },
      { status: 400 }
    );
  }

  try {
    await setTelegramMenuButton(dashboardUrl);
    await setTelegramCommands();
    return NextResponse.json({
      ok: true,
      message: "Menu button and commands updated",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
