import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { setTelegramMenuButtonToDefault, setTelegramCommands } from "@/lib/telegram";

/**
 * POST /api/telegram/setup-menu
 * ลบเมนูปุ่ม custom + ตั้งค่ารายการคำสั่งของ Telegram Bot
 * (ไม่มีปุ่มแดชบอร์ดข้างคลิป — เปิดแดชบอร์ดผ่าน /dashboard แล้วกดปุ่มลิงก์ในแชท)
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

  try {
    await setTelegramMenuButtonToDefault();
    await setTelegramCommands();
    return NextResponse.json({
      ok: true,
      message: "Menu button removed (default), commands updated",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
