import { config } from "@/lib/config";
import { extractSlipFromImage } from "@/lib/gemini";
import { allocateSlipToIndex } from "@/lib/paymentAllocation";
import {
  appendSlipRow,
  readIndexRows,
  readSlipRows,
  writeIndexUpdatesMR,
} from "@/lib/passSheets";
import {
  answerTelegramCallback,
  buildTelegramInlineKeyboard,
  getLargestPhoto,
  getTelegramFileBuffer,
  sendTelegramMessage,
} from "@/lib/telegram";
import { formatDateTime } from "@/lib/webhook/utils";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number };
    text?: string;
    photo?: Array<{
      file_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
    from: { id: number };
  };
};

function isAdminTelegramUser(userId?: number): boolean {
  if (!userId) return false;
  return config.telegram.adminUserIds.includes(String(userId));
}

async function handleTelegramText(params: {
  chatId: number;
  messageId: number;
  userId?: number;
  text: string;
}) {
  const t = params.text.trim();
  if (t === "help" || t === "เมนู") {
    await sendTelegramMessage({
      chatId: params.chatId,
      text: [
        "คำสั่งแอดมิน",
        "- เมนู / help",
        "- myid (ดู Telegram userId ของตัวเอง)",
        "- sync (ซิงก์และคำนวณสถานะชำระเงินจากแท็บ slip → index)",
        "- review (รายการรอตรวจ M)",
        "- summary (สรุปภาพรวม)",
      ].join("\n"),
      replyToMessageId: params.messageId,
    });
    return;
  }

  if (t === "myid") {
    await sendTelegramMessage({
      chatId: params.chatId,
      text: `Telegram userId ของคุณคือ\n${params.userId ?? "-"}`,
      replyToMessageId: params.messageId,
    });
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
    await sendTelegramMessage({
      chatId: params.chatId,
      text: [
        "ซิงก์เสร็จแล้ว",
        `- slip ที่ประมวลผล: ${result.summary.processedSlips}`,
        `- ปิดรายการชำระ: ${result.summary.allocatedRequests}`,
        `- รายการที่ต้องตรวจมือ: ${result.summary.needsReview}`,
      ].join("\n"),
      replyToMessageId: params.messageId,
    });
    return;
  }

  if (t === "summary" || t === "สรุป" || t === "สรุปวันนี้") {
    const indexRows = await readIndexRows();
    const total = indexRows.length;
    const pending = indexRows.filter((r) => !r.paymentStatus).length;
    const paid = indexRows.filter((r) => r.paymentStatus === "ชำระเงินแล้ว").length;
    const outstanding = indexRows.filter(
      (r) => r.paymentStatus === "ค้างชำระเงิน" || r.paymentStatus.includes("ค้าง")
    ).length;
    const deleted = indexRows.filter((r) => r.paymentStatus === "ลบข้อมูล").length;
    const dataIncorrect = indexRows.filter((r) =>
      r.approvalStatus?.includes("ข้อมูลไม่ถูกต้อง")
    ).length;

    await sendTelegramMessage({
      chatId: params.chatId,
      text: [
        "สรุปภาพรวม (แท็บ index)",
        `- ทั้งหมด: ${total} รายการ`,
        `- M: รอกำหนด: ${pending} | ชำระแล้ว: ${paid} | ค้างชำระ: ${outstanding} | ลบข้อมูล: ${deleted}`,
        `- N: ข้อมูลไม่ถูกต้อง: ${dataIncorrect}`,
      ].join("\n"),
      replyToMessageId: params.messageId,
    });
    return;
  }

  if (t === "review") {
    const indexRows = await readIndexRows();
    const pending = indexRows.filter((r) => !r.approvalStatus).slice(0, 20);
    if (pending.length === 0) {
      await sendTelegramMessage({
        chatId: params.chatId,
        text: "ไม่มีรายการรอตรวจ (N ว่าง)",
        replyToMessageId: params.messageId,
      });
      return;
    }
    for (const r of pending) {
      const text = [
        `${r.rank}${r.firstName} ${r.lastName}`,
        `ทะเบียน: ${r.plate || "-"}`,
        `M: ${r.paymentStatus || "(ว่าง)"}`,
        `แถว ${r.rowNumber}`,
      ].join("\n");
      const keyboard = buildTelegramInlineKeyboard([
        [
          {
            text: "รออนุมัติจาก ฝขว.พล.ป.",
            data: `review:${r.rowNumber}:waiting_approval`,
          },
          {
            text: "รอส่ง ฝขว.พล.ป.",
            data: `review:${r.rowNumber}:waiting_send`,
          },
        ],
        [
          { text: "รอลบข้อมูล", data: `review:${r.rowNumber}:waiting_delete` },
          { text: "ข้อมูลไม่ถูกต้อง", data: `review:${r.rowNumber}:incorrect` },
        ],
      ]);
      await sendTelegramMessage({ chatId: params.chatId, text, inlineKeyboard: keyboard });
    }
    return;
  }

  await sendTelegramMessage({
    chatId: params.chatId,
    text: "คำสั่งนี้ยังไม่รองรับ",
    replyToMessageId: params.messageId,
  });
}

async function handleTelegramPhoto(params: {
  chatId: number;
  messageId: number;
  photos: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
}) {
  const largest = getLargestPhoto(params.photos);
  if (!largest) return;
  const keyboard = buildTelegramInlineKeyboard([
    [
      { text: "รูปสลิปโอนเงิน", data: `intent:slip:${largest.file_id}` },
      { text: "อื่นๆ (ยังไม่ทำ)", data: "intent:other" },
    ],
  ]);
  await sendTelegramMessage({
    chatId: params.chatId,
    text: "ได้รับรูปภาพแล้ว\nเลือกว่ารูปเป็นประเภทไหน เพื่อให้ระบบทำงานต่อได้ถูกต้อง",
    inlineKeyboard: keyboard,
    replyToMessageId: params.messageId,
  });
}

async function handleTelegramReview(params: {
  chatId: number;
  row: number;
  result: string;
}) {
  const APPROVAL_MAP: Record<string, { n: string; m?: string }> = {
    waiting_approval: { n: "รออนุมัติจาก ฝขว.พล.ป." },
    waiting_send: { n: "รอส่ง ฝขว.พล.ป." },
    waiting_delete: { n: "รอลบข้อมูล", m: "ลบข้อมูล" },
    incorrect: { n: "ข้อมูลไม่ถูกต้อง", m: "ลบข้อมูล" },
  };

  const indexRows = await readIndexRows();
  const target = indexRows.find((r) => r.rowNumber === params.row);
  if (!target) {
    await sendTelegramMessage({
      chatId: params.chatId,
      text: `ไม่พบรายการแถว ${params.row}`,
    });
    return;
  }
  const mapping = APPROVAL_MAP[params.result];
  if (!mapping) {
    await sendTelegramMessage({
      chatId: params.chatId,
      text: "ผลการตรวจไม่ถูกต้อง",
    });
    return;
  }
  const now = formatDateTime(new Date());
  await writeIndexUpdatesMR([
    {
      rowNumber: params.row,
      paymentStatus: mapping.m ?? target.paymentStatus,
      approvalStatus: mapping.n,
      checkedAt: now,
    },
  ]);
  await sendTelegramMessage({
    chatId: params.chatId,
    text: `บันทึกแล้ว: แถว ${params.row}\nN = ${mapping.n}${
      mapping.m ? `\nM = ${mapping.m}` : ""
    }`,
  });
}

async function handleTelegramSlipIntent(params: { chatId: number; fileId: string }) {
  const { buffer, contentType } = await getTelegramFileBuffer({ fileId: params.fileId });
  const mimeType = contentType.startsWith("image/") ? contentType : "image/jpeg";
  const { data: extracted } = await extractSlipFromImage({
    imageBytes: buffer,
    mimeType,
  });
  if (!extracted || !extracted.amount) {
    await sendTelegramMessage({
      chatId: params.chatId,
      text: "อ่านสลิปไม่สำเร็จ (ไม่พบยอดเงิน) ลองส่งรูปที่ชัดขึ้นอีกครั้งนะครับ",
    });
    return;
  }
  const amount = extracted.amount;
  const k = amount % 30 === 0 ? amount / 30 : null;
  if (k === null) {
    await sendTelegramMessage({
      chatId: params.chatId,
      text: [
        "อ่านสลิปได้ แต่ยอดไม่ลงตัวกับ 30 บาท/รายการ",
        `- ชื่อ: ${extracted.payer_first_name ?? "-"} ${extracted.payer_last_name ?? "-"}`,
        `- ยอด: ${amount} บาท`,
        `- วันเวลาโอน: ${extracted.transfer_datetime ?? "-"}`,
        "",
        "กรุณาตรวจมือ แล้วค่อยบันทึก/แก้ไขในแท็บ slip",
      ].join("\n"),
    });
    return;
  }

  const now = new Date();
  const timestamp = formatDateTime(now);
  const transferDate = extracted.transfer_datetime ?? timestamp;
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

  await sendTelegramMessage({
    chatId: params.chatId,
    text: [
      "บันทึกสลิปและอัปเดตสถานะเรียบร้อย",
      `- ผู้โอน: ${extracted.payer_first_name ?? "-"} ${extracted.payer_last_name ?? "-"}`,
      `- ยอด: ${amount} บาท (${k} รายการ)`,
      `- ปิดรายการได้: ${result.summary.allocatedRequests} รายการ`,
      `- รายการต้องตรวจมือ: ${result.summary.needsReview}`,
    ].join("\n"),
  });
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  const callback = update.callback_query;

  if (message) {
    const chatId = message.chat.id;
    const userId = message.from?.id;
    if (!isAdminTelegramUser(userId)) return;
    if (message.text) {
      await handleTelegramText({
        chatId,
        messageId: message.message_id,
        userId,
        text: message.text,
      });
      return;
    }
    if (message.photo) {
      await handleTelegramPhoto({
        chatId,
        messageId: message.message_id,
        photos: message.photo,
      });
    }
    return;
  }

  if (callback) {
    const data = callback.data || "";
    const chatId = callback.message?.chat.id;
    if (!chatId) return;
    await answerTelegramCallback({ callbackQueryId: callback.id });

    if (data.startsWith("review:")) {
      const [, rowStr, result] = data.split(":");
      const row = Number(rowStr || "");
      if (!Number.isFinite(row) || !result) return;
      await handleTelegramReview({ chatId, row, result });
      return;
    }

    if (data.startsWith("intent:slip:")) {
      const fileId = data.replace("intent:slip:", "");
      await handleTelegramSlipIntent({ chatId, fileId });
      return;
    }
    if (data === "intent:other") {
      await sendTelegramMessage({ chatId, text: "รับทราบ ไม่ได้บันทึกเป็นสลิปครับ" });
      return;
    }
  }
}
