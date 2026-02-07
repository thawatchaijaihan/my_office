import { chat } from "@/lib/gemini";
import { pushMessages, replyMessages, replyText, type LineMessage } from "@/lib/line";
import {
  readIndexRows,
  readSlipRows,
  writeIndexUpdatesMR,
} from "@/lib/passSheets";
import { allocateSlipToIndex } from "@/lib/paymentAllocation";
import {
  flexReviewCarousel,
  flexReviewCarouselReadOnly,
  type ReviewGroup,
  type ReviewRow,
} from "@/lib/lineFlexMessages";
import type { IndexRow } from "@/lib/passSheets";
import { formatDateTime } from "./utils";

function groupIndexByName(rows: IndexRow[]): ReviewGroup[] {
  const byName = new Map<string, ReviewRow[]>();
  for (const r of rows) {
    const name = `${r.rank}${r.firstName} ${r.lastName}`.trim() || "-";
    const row: ReviewRow = {
      rowNumber: r.rowNumber,
      subtitle: `ทะเบียน: ${r.plate || "-"}`,
      requestFor: r.requestFor || "",
      vehicleOwner: r.vehicleOwner || "",
      registeredAt: r.registeredAt || "",
      linkUrl: r.note || "",
    };
    const list = byName.get(name) ?? [];
    list.push(row);
    byName.set(name, list);
  }
  return [...byName.entries()].map(([name, rows]) => ({ name, rows }));
}

export async function handleAdminText(params: {
  replyToken: string;
  text: string;
  userId?: string;
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
        "- invalid (รายการ N = ข้อมูลไม่ถูกต้อง)",
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
    const summaryText = [
      "ซิงก์เสร็จแล้ว",
      `- slip ที่ประมวลผล: ${result.summary.processedSlips}`,
      `- ปิดรายการชำระ: ${result.summary.allocatedRequests}`,
      `- รายการที่ต้องตรวจมือ: ${result.summary.needsReview}`,
    ].join("\n");

    const issues = result.reviewIssues ?? [];
    if (issues.length === 0) {
      await replyText(params.replyToken, summaryText);
      return;
    }

    const maxLines = 20;
    const lines = issues.slice(0, maxLines).map((i) => {
      const name = `${i.payerRankName} ${i.payerSurname}`.trim() || "-";
      const amount = i.amount ?? "-";
      return `- แถวสลิป ${i.slipRowNumber}: ${name} | ยอด ${amount} | ${i.reason}`;
    });
    if (issues.length > maxLines) {
      lines.push(`(และอีก ${issues.length - maxLines} รายการ)`);
    }

    await replyMessages(params.replyToken, [
      { type: "text", text: summaryText },
      {
        type: "text",
        text: ["รายการที่ต้องตรวจมือ:", ...lines].join("\n"),
      },
    ]);
    return;
  }

  if (t === "review") {
    const indexRows = await readIndexRows();
    const pending = indexRows
      .filter((r) => !r.approvalStatus)
      .slice(0, 500);

    if (pending.length === 0) {
      await replyText(params.replyToken, "ไม่มีรายการรอตรวจ (N ว่าง)");
      return;
    }

    const batches: LineMessage[] = [];
    for (let i = 0; i < pending.length; i += 10) {
      const flexRows = pending.slice(i, i + 10).map((r) => ({
        rowNumber: r.rowNumber,
        title: `${r.rank}${r.firstName} ${r.lastName}`,
        subtitle: `ทะเบียน: ${r.plate || "-"}`,
        requestFor: r.requestFor || "",
        vehicleOwner: r.vehicleOwner || "",
        registeredAt: r.registeredAt || "",
        paymentStatus: r.paymentStatus || "(ว่าง)",
        linkUrl: r.note || "",
      }));
      batches.push(flexReviewCarousel({ rows: flexRows }) as LineMessage);
    }

    if (batches.length <= 5) {
      await replyMessages(params.replyToken, batches);
      return;
    }

    if (params.userId) {
      await replyMessages(params.replyToken, batches.slice(0, 5));
      for (let i = 5; i < batches.length; i += 5) {
        await pushMessages(params.userId, batches.slice(i, i + 5));
      }
      return;
    }

    await replyMessages(params.replyToken, [
      ...batches.slice(0, 4),
      {
        type: "text",
        text: `มีรายการรอตรวจเพิ่มเติมอีก ${
          pending.length - 40
        } รายการ (LINE จำกัด reply 5 ข้อความ) กรุณาส่งคำสั่ง review ซ้ำเพื่อดูต่อ`,
      } as LineMessage,
    ]);
    return;
  }

  if (t === "invalid") {
    const indexRows = await readIndexRows();
    const incorrect = indexRows
      .filter((r) => r.approvalStatus?.includes("ข้อมูลไม่ถูกต้อง"))
      .slice(0, 500);

    if (incorrect.length === 0) {
      await replyText(params.replyToken, "ไม่มีรายการที่ N = ข้อมูลไม่ถูกต้อง");
      return;
    }

    const groups = groupIndexByName(incorrect);
    const batches: LineMessage[] = [];
    for (let i = 0; i < groups.length; i += 10) {
      const chunk = groups.slice(i, i + 10);
      batches.push(flexReviewCarouselReadOnly({ groups: chunk }) as LineMessage);
    }

    if (batches.length <= 5) {
      await replyMessages(params.replyToken, batches);
      return;
    }

    if (params.userId) {
      await replyMessages(params.replyToken, batches.slice(0, 5));
      for (let i = 5; i < batches.length; i += 5) {
        await pushMessages(params.userId, batches.slice(i, i + 5));
      }
      return;
    }

    await replyMessages(params.replyToken, [
      ...batches.slice(0, 4),
      {
        type: "text",
        text: `มีรายการข้อมูลไม่ถูกต้องเพิ่มเติมอีก ${
          groups.length - 40
        } กลุ่ม (LINE จำกัด reply 5 ข้อความ) กรุณาส่งคำสั่ง invalid ซ้ำเพื่อดูต่อ`,
      } as LineMessage,
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
        !r.paymentStatus ||
        r.paymentStatus === "ค้างชำระเงิน" ||
        r.paymentStatus.includes("ค้าง")
    ).length;
    const deleted = indexRows.filter(
      (r) => r.paymentStatus === "ลบข้อมูล"
    ).length;
    const dataIncorrect = indexRows.filter((r) =>
      r.approvalStatus?.includes("ข้อมูลไม่ถูกต้อง")
    ).length;

    const approvalCounts = new Map<string, number>();
    for (const r of indexRows) {
      const n = (r.approvalStatus || "").trim();
      if (!n) {
        approvalCounts.set(
          "กรุณาแจ้ง สาย.2",
          (approvalCounts.get("กรุณาแจ้ง สาย.2") ?? 0) + 1
        );
        continue;
      }
      approvalCounts.set(n, (approvalCounts.get(n) ?? 0) + 1);
    }
    const approvalLines = [...approvalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => `- ${label}: ${count} รายการ`);

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
        "สรุปข้อมูลการขอบัตรผ่าน",
        `- ทั้งหมด: ${total} รายการ`,
        `- ชำระแล้ว: ${paid} รายการ (${paid * 30} บาท)`,
        `- ค้างชำระ: ${outstanding} รายการ (${outstanding * 30} บาท)`,
        `- ลบข้อมูล: ${deleted} รายการ`,
        `- ข้อมูลไม่ถูกต้อง: ${dataIncorrect} รายการ`,
        ...approvalLines,
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
