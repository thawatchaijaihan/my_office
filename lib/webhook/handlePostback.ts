import { extractSlipFromImage } from "@/lib/gemini";
import { getMessageContentBuffer, replyText } from "@/lib/line";
import {
  appendSlipRow,
  readIndexRows,
  readSlipRows,
  writeIndexUpdatesMR,
} from "@/lib/passSheets";
import { allocateSlipToIndex } from "@/lib/paymentAllocation";
import { formatDateTime } from "./utils";

const APPROVAL_MAP: Record<string, { n: string; m?: string }> = {
  waiting_approval: { n: "รออนุมัติจาก ฝขว.พล.ป." },
  waiting_send: { n: "รอส่ง ฝขว.พล.ป." },
  waiting_delete: { n: "รอลบข้อมูล", m: "ลบข้อมูล" },
  incorrect: { n: "ข้อมูลไม่ถูกต้อง", m: "ลบข้อมูล" },
};

export async function handlePostbackReview(params: {
  replyToken: string;
  row: number;
  result: string | null;
}): Promise<boolean> {
  const { replyToken, row, result } = params;
  if (!Number.isFinite(row) || !row) {
    await replyText(replyToken, "รูปแบบข้อมูลไม่ถูกต้อง (row)");
    return true;
  }

  const indexRows = await readIndexRows();
  const target = indexRows.find((r) => r.rowNumber === row);
  if (!target) {
    await replyText(replyToken, `ไม่พบรายการแถว ${row}`);
    return true;
  }

  const mapping = APPROVAL_MAP[result ?? ""];
  if (!mapping) {
    await replyText(replyToken, "ผลการตรวจไม่ถูกต้อง");
    return true;
  }

  const now = formatDateTime(new Date());
  await writeIndexUpdatesMR([
    {
      rowNumber: row,
      paymentStatus: mapping.m ?? target.paymentStatus,
      approvalStatus: mapping.n,
      checkedAt: now,
    },
  ]);
  await replyText(
    replyToken,
    `บันทึกแล้ว: แถว ${row}\nN = ${mapping.n}${mapping.m ? `\nM = ${mapping.m}` : ""}`
  );

  const [indexRows2, slipRows2] = await Promise.all([
    readIndexRows(),
    readSlipRows(),
  ]);
  const alloc = allocateSlipToIndex({
    indexRows: indexRows2,
    slipRows: slipRows2,
    checkedAtValue: (slip) =>
      slip.transferDate || slip.timestamp || formatDateTime(new Date()),
  });
  await writeIndexUpdatesMR(alloc.updates);
  return true;
}

export async function handlePostbackSlipIntent(params: {
  replyToken: string;
  messageId: string;
}): Promise<boolean> {
  const { replyToken, messageId } = params;

  const { buffer, contentType } = await getMessageContentBuffer(messageId);
  const mimeType = contentType.startsWith("image/")
    ? contentType
    : "image/jpeg";

  const { data: extracted } = await extractSlipFromImage({
    imageBytes: buffer,
    mimeType,
  });

  if (!extracted || !extracted.amount) {
    await replyText(
      replyToken,
      "อ่านสลิปไม่สำเร็จ (ไม่พบยอดเงิน) ลองส่งรูปที่ชัดขึ้นอีกครั้งนะครับ"
    );
    return true;
  }

  const amount = extracted.amount;
  const k = amount % 30 === 0 ? amount / 30 : null;

  if (k === null) {
    await replyText(
      replyToken,
      [
        "อ่านสลิปได้ แต่ยอดไม่ลงตัวกับ 30 บาท/รายการ",
        `- ชื่อ: ${extracted.payer_first_name ?? "-"} ${extracted.payer_last_name ?? "-"}`,
        `- ยอด: ${amount} บาท`,
        `- วันเวลาโอน: ${extracted.transfer_datetime ?? "-"}`,
        "",
        "กรุณาตรวจมือ แล้วค่อยบันทึก/แก้ไขในแท็บ slip",
      ].join("\n")
    );
    return true;
  }

  const now = new Date();
  const timestamp = formatDateTime(now);
  const transferDate =
    extracted.transfer_datetime ?? timestamp;

  await appendSlipRow({
    timestamp,
    rankName: extracted.payer_first_name ?? "-",
    surname: extracted.payer_last_name ?? "-",
    amount,
    transferDate,
  });

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

  const doneText = [
    "บันทึกสลิปและอัปเดตสถานะเรียบร้อย",
    `- ผู้โอน: ${extracted.payer_first_name ?? "-"} ${extracted.payer_last_name ?? "-"}`,
    `- ยอด: ${amount} บาท (${k} รายการ)`,
    `- ปิดรายการได้: ${result.summary.allocatedRequests} รายการ`,
    `- รายการต้องตรวจมือ: ${result.summary.needsReview}`,
  ].join("\n");

  await replyText(replyToken, doneText);
  return true;
}

export async function handlePostbackOtherIntent(params: {
  replyToken: string;
}): Promise<boolean> {
  await replyText(
    params.replyToken,
    "รับทราบ ไม่ได้บันทึกเป็นสลิปครับ"
  );
  return true;
}
