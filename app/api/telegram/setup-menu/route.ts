import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { setTelegramMenuButtonToCommands, setTelegramCommands } from "@/lib/telegram";

/**
 * POST /api/telegram/setup-menu
 * ตั้งค่า Menu button เป็นรายการคำสั่ง + รายการคำสั่งของ Telegram Bot
 * (ไม่ใช้ Web App เพื่อไม่ให้ปุ่มเปิด Mini App — เปิดแดชบอร์ดผ่าน /dashboard แล้วกดปุ่มลิงก์)
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
    await setTelegramMenuButtonToCommands();
    await setTelegramCommands();
    return NextResponse.json({
      ok: true,
      message: "Menu button (commands) and commands updated",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
