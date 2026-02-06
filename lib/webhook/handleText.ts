import { chat } from "@/lib/gemini";
import { replyMessages, replyText, type LineMessage } from "@/lib/line";
import {
  readIndexRows,
  readSlipRows,
  writeIndexUpdatesMR,
} from "@/lib/passSheets";
import { allocateSlipToIndex } from "@/lib/paymentAllocation";
import { flexReviewCarousel } from "@/lib/lineFlexMessages";
import { formatDateTime } from "./utils";

export async function handleAdminText(params: {
  replyToken: string;
  text: string;
}): Promise<void> {
  const t = params.text.trim();

  if (t === "help" || t === "เมนู") {
    await replyText(
      params.replyToken,
      [
        "คำสั่งแอดมิน",
        "- เมนู / help",
        "- myid (ดู LINE userId ของตัวเอง)",
        "- sync (ซิงก์และคำนวณสถานะชำระเงินจากแท็บ slip → index)",
        "- review (รายการรอตรวจ M)",
        "- summary (สรุปภาพรวม)",
      ].join("\n")
    );
    return;
  }

  if (t === "sync") {
    const [indexRows, slipRows] = await Promise.all([
      readIndexRows(),
      readSlipRows(),
    ]);
    const result = allocateSlipToIndex({
      indexRows,
      slipRows,
      checkedAtValue: (slip) =>
        slip.transferDate || slip.timestamp || formatDateTime(new Date()),
    });
    await writeIndexUpdatesMR(result.updates);
    await replyText(
      params.replyToken,
      `ซิงก์เสร็จแล้ว\n- slip ที่ประมวลผล: ${result.summary.processedSlips}\n- ปิดรายการชำระ: ${result.summary.allocatedRequests}\n- รายการที่ต้องตรวจมือ: ${result.summary.needsReview}`
    );
    return;
  }

  if (t === "review") {
    const indexRows = await readIndexRows();
    const pending = indexRows
      .filter((r) => !r.approvalStatus)
      .slice(0, 10);

    if (pending.length === 0) {
      await replyText(params.replyToken, "ไม่มีรายการรอตรวจ (N ว่าง)");
      return;
    }

    const flexRows = pending.map((r) => ({
      rowNumber: r.rowNumber,
      title: `${r.rank}${r.firstName} ${r.lastName}`,
      subtitle: `ทะเบียน: ${r.plate || "-"}`,
      paymentStatus: r.paymentStatus || "(ว่าง)",
      linkUrl: r.note || "",
    }));

    await replyMessages(params.replyToken, [
      flexReviewCarousel({ rows: flexRows }) as LineMessage,
    ]);
    return;
  }

  if (t === "summary" || t === "สรุป" || t === "สรุปวันนี้") {
    const indexRows = await readIndexRows();

    const total = indexRows.length;
    const pending = indexRows.filter((r) => !r.paymentStatus).length;
    const paid = indexRows.filter(
      (r) => r.paymentStatus === "ชำระเงินแล้ว"
    ).length;
    const outstanding = indexRows.filter(
      (r) =>
        r.paymentStatus === "ค้างชำระเงิน" ||
        r.paymentStatus.includes("ค้าง")
    ).length;
    const deleted = indexRows.filter(
      (r) => r.paymentStatus === "ลบข้อมูล"
    ).length;
    const dataIncorrect = indexRows.filter((r) =>
      r.approvalStatus?.includes("ข้อมูลไม่ถูกต้อง")
    ).length;

    const byPerson = new Map<string, number>();
    for (const r of indexRows) {
      if (r.paymentStatus === "ชำระเงินแล้ว") continue;
      if (r.paymentStatus === "ลบข้อมูล") continue;
      if (r.approvalStatus?.includes("ข้อมูลไม่ถูกต้อง")) continue;
      const key = `${r.firstName} ${r.lastName}`.trim();
      byPerson.set(key, (byPerson.get(key) ?? 0) + 1);
    }
    const top = [...byPerson.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, cnt]) => `- ${name}: ค้าง ${cnt} รายการ`);

    await replyText(
      params.replyToken,
      [
        "สรุปภาพรวม (แท็บ index)",
        `- ทั้งหมด: ${total} รายการ`,
        `- M: รอกำหนด: ${pending} | ชำระแล้ว: ${paid} | ค้างชำระ: ${outstanding} | ลบข้อมูล: ${deleted}`,
        `- N: ข้อมูลไม่ถูกต้อง: ${dataIncorrect}`,
        top.length ? "" : undefined,
        top.length ? "ค้างชำระมากสุด (Top 5)" : undefined,
        ...top,
      ]
        .filter((x): x is string => Boolean(x))
        .join("\n")
    );
    return;
  }

  const aiResponse = await chat(t);
  await replyText(params.replyToken, aiResponse);
}
