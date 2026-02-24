import { config } from "@/lib/config";
import {
  chat,
  chatWithContext,
  chatWithPersonnelContext,
  extractSlipFromImage,
} from "@/lib/gemini";
import { getPersonnelRagContext } from "@/lib/personnelDb";
import { getRagContext } from "@/lib/rag";
import { allocateSlipToIndex } from "@/lib/paymentAllocation";
import {
  appendSlipRow,
  readSlipRows,
  writeIndexUpdatesMR,
} from "@/lib/passSheets";
import { getCachedIndexRows, clearIndexRowsCache } from "@/lib/indexRowsCache";
import {
  answerTelegramCallback,
  buildTelegramInlineKeyboard,
  buildTelegramUrlKeyboard,
  getLargestPhoto,
  getTelegramFileBuffer,
  sendTelegramMessage,
} from "@/lib/telegram";
import { formatDateTime } from "@/lib/formatDateTime";
import { logger } from "@/lib/logger";

// --- In-memory store สำหรับ Telegram file_id ---
// Telegram จำกัด callback_data สูงสุด 64 bytes
// file_id มักยาว 80-100+ ตัวอักษร จึงต้องแมปผ่าน short key แทน
const fileIdStore = new Map<string, string>();

function storeFileId(fileId: string): string {
  const key = Math.random().toString(36).slice(2, 8); // 6-char key
  fileIdStore.set(key, fileId);
  // ล้างค่าเก่าอัตโนมัติหลัง 10 นาที
  setTimeout(() => fileIdStore.delete(key), 10 * 60 * 1000);
  return key;
}

function lookupFileId(key: string): string | undefined {
  return fileIdStore.get(key);
}

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
  const t = params.text.trim().replace(/^\//, "");
  if (t === "help" || t === "เมนู") {
    const lines = [
      "คำสั่งแอดมิน",
      "- เมนู / help",
      "- dashboard (แดชบอร์ด)",
      "- myid (ดู Telegram userId ของตัวเอง)",
      "- sync (ซิงก์และคำนวณสถานะชำระเงินจากแท็บ slip → index)",
      "- outstanding (รายการค้างชำระ)",
      "- review (รายการรอตรวจ M)",
      "- invalid (รายการ N = ข้อมูลไม่ถูกต้อง)",
      "- summary (สรุปภาพรวม)",
    ];
    const dashboardUrl = config.telegram.dashboardUrl;
    await sendTelegramMessage({
      chatId: params.chatId,
      text: lines.join("\n"),
      replyToMessageId: params.messageId,
      inlineKeyboard:
        dashboardUrl ? buildTelegramUrlKeyboard("📊 แดชบอร์ด", dashboardUrl) : undefined,
    });
    return;
  }

  if (t === "dashboard") {
    const dashboardUrl = config.telegram.dashboardUrl;
    if (!dashboardUrl) {
      await sendTelegramMessage({
        chatId: params.chatId,
        text: "ยังไม่ได้ตั้งค่า TELEGRAM_DASHBOARD_URL",
        replyToMessageId: params.messageId,
      });
      return;
    }
    await sendTelegramMessage({
      chatId: params.chatId,
      text: "กดปุ่มด้านล่างเพื่อเปิดแดชบอร์ด\n(ถ้าต้องการล็อกอินด้วย Google: กดค้างปุ่ม แล้วเลือก \"เปิดในเบราว์เซอร์\")",
      replyToMessageId: params.messageId,
      inlineKeyboard: buildTelegramUrlKeyboard("📊 แดชบอร์ด", dashboardUrl),
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
      getCachedIndexRows(),
      readSlipRows(),
    ]);
    const result = allocateSlipToIndex({
      indexRows,
      slipRows,
      checkedAtValue: (slip) =>
        slip.transferDate || slip.timestamp || formatDateTime(new Date()),
    });
    await writeIndexUpdatesMR(result.updates);
    clearIndexRowsCache();
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
    const indexRows = await getCachedIndexRows();
    const total = indexRows.length;
    const paid = indexRows.filter((r) => r.paymentStatus === "ชำระเงินแล้ว").length;
    const outstanding = indexRows.filter(
      (r) =>
        !r.paymentStatus ||
        r.paymentStatus === "ค้างชำระเงิน" ||
        r.paymentStatus.includes("ค้าง")
    ).length;
    const deleted = indexRows.filter((r) => r.paymentStatus === "ลบข้อมูล").length;
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

    await sendTelegramMessage({
      chatId: params.chatId,
      text: [
        "สรุปข้อมูลการขอบัตรผ่าน",
        `- ทั้งหมด: ${total} รายการ`,
        `- ชำระแล้ว: ${paid} รายการ (${paid * 30} บาท)`,
        `- ค้างชำระ: ${outstanding} รายการ (${outstanding * 30} บาท)`,
        `- ลบข้อมูล: ${deleted} รายการ`,
        `- ข้อมูลไม่ถูกต้อง: ${dataIncorrect} รายการ`,
        ...approvalLines,
      ].join("\n"),
      replyToMessageId: params.messageId,
    });
    return;
  }

  if (t === "review") {
    const indexRows = await getCachedIndexRows();
    const pending = indexRows.filter((r) => !r.approvalStatus);
    if (pending.length === 0) {
      await sendTelegramMessage({
        chatId: params.chatId,
        text: "ไม่มีรายการรอตรวจ (N ว่าง)",
        replyToMessageId: params.messageId,
      });
      return;
    }
    for (const r of pending) {
      const fallbackOwner = `${r.rank}${r.firstName} ${r.lastName}`.trim();
      const registeredAt = r.registeredAt || "-";
      const statusEmoji = r.paymentStatus.includes("ค้าง")
        ? "🔴"
        : r.paymentStatus.includes("ชำระเงินแล้ว")
          ? "🟢"
          : "";
      const statusText = `${statusEmoji ? `${statusEmoji} ` : ""}${
        r.paymentStatus || "(ว่าง)"
      }`;
      const text = [
        `${r.rank}${r.firstName} ${r.lastName}`,
        r.note
          ? `ทะเบียน: <a href="${r.note}">${r.plate || "-"}</a>`
          : `ทะเบียน: ${r.plate || "-"}`,
        `ขอบัตรให้: ${r.requestFor || "-"}`,
        `เจ้าของรถ: ${r.vehicleOwner || fallbackOwner || "-"}`,
        statusText,
        registeredAt,
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
      await sendTelegramMessage({
        chatId: params.chatId,
        text,
        inlineKeyboard: keyboard,
        parseMode: "HTML",
      });
    }
    return;
  }

  if (t === "invalid") {
    const indexRows = await getCachedIndexRows();
    const incorrect = indexRows.filter((r) =>
      r.approvalStatus?.includes("ข้อมูลไม่ถูกต้อง")
    );
    if (incorrect.length === 0) {
      await sendTelegramMessage({
        chatId: params.chatId,
        text: "ไม่มีรายการที่ N = ข้อมูลไม่ถูกต้อง",
        replyToMessageId: params.messageId,
      });
      return;
    }
    const byName = new Map<string, typeof incorrect>();
    for (const r of incorrect) {
      const name = `${r.rank}${r.firstName} ${r.lastName}`.trim() || "-";
      const list = byName.get(name) ?? [];
      list.push(r);
      byName.set(name, list);
    }
    for (const [name, rows] of byName) {
      const fallbackOwner = name;
      const lines: string[] = ["<b><u>ข้อมูลไม่ถูกต้อง</u></b>", name];
      for (const r of rows) {
        lines.push(
          r.note
            ? `ทะเบียน: <a href="${r.note}">${r.plate || "-"}</a>`
            : `ทะเบียน: ${r.plate || "-"}`,
          `ขอบัตรให้: ${r.requestFor || "-"}`,
          `เจ้าของรถ: ${r.vehicleOwner || fallbackOwner || "-"}`,
          r.registeredAt || "-"
        );
      }
      await sendTelegramMessage({
        chatId: params.chatId,
        text: lines.join("\n"),
        parseMode: "HTML",
      });
    }
    return;
  }

  if (t === "outstanding") {
    const indexRows = await getCachedIndexRows();
    // Filter only M = "ค้างชำระเงิน"
    const outstanding = indexRows.filter(
      (r) => r.paymentStatus === "ค้างชำระเงิน"
    );
    if (outstanding.length === 0) {
      await sendTelegramMessage({
        chatId: params.chatId,
        text: "ไม่มีรายการค้างชำระครับ",
        replyToMessageId: params.messageId,
      });
      return;
    }

    // Send summary first
    const totalAmount = outstanding.length * 30;
    await sendTelegramMessage({
      chatId: params.chatId,
      text: [
        `<b>รายการค้างชำระเงิน (M=ค้างชำระเงิน)</b>`,
        `- จำนวน: ${outstanding.length} รายการ`,
        `- ยอดรวม: ${totalAmount} บาท (${outstanding.length} × 30)`,
      ].join("\n"),
      parseMode: "HTML",
      replyToMessageId: params.messageId,
    });

    // Send each item separately with button
    for (const r of outstanding.slice(0, 20)) {
      const plateText = r.note
        ? `<a href="${r.note}">${r.plate || "-"}</a>`
        : r.plate || "-";
      const name = `${r.rank}${r.firstName} ${r.lastName}`.trim();

      const keyboard = buildTelegramInlineKeyboard([
        [
          { text: "✅ ชำระเงินแล้ว", data: `markpaid:${r.rowNumber}` },
        ],
      ]);

      await sendTelegramMessage({
        chatId: params.chatId,
        text: [
          `<b>${name}</b>`,
          `ทะเบียน: ${plateText}`,
          `ขอบัตรให้: ${r.requestFor || "-"}`,
          `เจ้าของรถ: ${r.vehicleOwner || "-"}`,
        ].join("\n"),
        parseMode: "HTML",
        inlineKeyboard: keyboard,
      });
    }

    if (outstanding.length > 20) {
      await sendTelegramMessage({
        chatId: params.chatId,
        text: `... และอีก ${outstanding.length - 20} รายการ`,
      });
    }
    return;
  }

  const MAX_QUESTION_LENGTH = 1000;
  if (t.length > MAX_QUESTION_LENGTH) {
    await sendTelegramMessage({
      chatId: params.chatId,
      text: `ข้อความยาวเกิน ${MAX_QUESTION_LENGTH} ตัวอักษรครับ กรุณาสั้นลง`,
      replyToMessageId: params.messageId,
    });
    return;
  }

  try {
    const personnelKeywords =
      /กำลังพล|รายชื่อ|เบอร์|โทร|ธนาคาร|บัญชี|พ\.?(ท|ต|อ|ท|ต)\.?|ร\.?(อ|ท|ต)\.?|จ\.?ส\.?(อ|ท|ต)\.?|ส\.?อ\.?/i;
    const isPersonnelQuestion = personnelKeywords.test(t);
    if (isPersonnelQuestion) {
      const personnelContext = await getPersonnelRagContext(t, { maxDocs: 40 });
      if (personnelContext) {
        const aiResponse = await chatWithPersonnelContext(t, personnelContext);
        await sendTelegramMessage({
          chatId: params.chatId,
          text: aiResponse,
          replyToMessageId: params.messageId,
        });
        return;
      }
    }

    const ragContext = await getRagContext(t, 5);
    const aiResponse = ragContext
      ? await chatWithContext(t, ragContext)
      : await chat(t);
    await sendTelegramMessage({
      chatId: params.chatId,
      text: aiResponse,
      replyToMessageId: params.messageId,
    });
  } catch (err) {
    logger.error({
      message: "Telegram RAG/chat error",
      error: err instanceof Error ? err.message : String(err),
    });
    await sendTelegramMessage({
      chatId: params.chatId,
      text: "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว ลองใหม่อีกครั้งหรือติดต่อแอดมินครับ",
      replyToMessageId: params.messageId,
    });
  }
}

async function handleTelegramPhoto(params: {
  chatId: number;
  messageId: number;
  photos: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
}) {
  const largest = getLargestPhoto(params.photos);
  if (!largest) return;
  // เก็บ file_id ใน in-memory store แล้วใช้ short key ใน callback_data
  // เพื่อไม่ให้เกินขีดจำกัด 64 bytes ของ Telegram
  const fileKey = storeFileId(largest.file_id);
  const keyboard = buildTelegramInlineKeyboard([
    [
      { text: "รูปสลิปโอนเงิน", data: `intent:slip:${fileKey}` },
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
  const APPROVAL_MAP: Record<string, { n: string }> = {
    waiting_approval: { n: "รออนุมัติจาก ฝขว.พล.ป." },
    waiting_send: { n: "รอส่ง ฝขว.พล.ป." },
    waiting_delete: { n: "รอลบข้อมูล" },
    incorrect: { n: "ข้อมูลไม่ถูกต้อง" },
  };

  const indexRows = await getCachedIndexRows();
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
      paymentStatus: target.paymentStatus,
      approvalStatus: mapping.n,
      checkedAt: now,
    },
  ]);
  clearIndexRowsCache();
  await sendTelegramMessage({
    chatId: params.chatId,
    text: `บันทึกแล้ว: แถว ${params.row}\nN = ${mapping.n}`,
  });
}

async function handlePaidStatus(params: {
  chatId: number;
  row: number;
  firstName: string;
  lastName: string;
}) {
  const AMOUNT = 30;
  const now = new Date();
  const timestamp = formatDateTime(now);

  // Add slip row
  await appendSlipRow({
    timestamp,
    rankName: params.firstName || "-",
    surname: params.lastName || "-",
    amount: AMOUNT,
    transferDate: timestamp,
  });

  // Update index row to mark as paid
  await writeIndexUpdatesMR([
    {
      rowNumber: params.row,
      paymentStatus: "ชำระเงินแล้ว",
      approvalStatus: "",
      checkedAt: timestamp,
    },
  ]);

  clearIndexRowsCache();

  await sendTelegramMessage({
    chatId: params.chatId,
    text: [
      `✅ บันทึกการชำระเงินเรียบร้อย`,
      `- แถว: ${params.row}`,
      `- ยอด: ${AMOUNT} บาท`,
      `- สถานะ: ชำระเงินแล้ว`,
    ].join("\n"),
  });
}

async function handleMarkPaid(params: {
  chatId: number;
  row: number;
}) {
  const now = new Date();
  const timestamp = formatDateTime(now);

  // Update index row M to "ชำระเงินแล้ว" only
  await writeIndexUpdatesMR([
    {
      rowNumber: params.row,
      paymentStatus: "ชำระเงินแล้ว",
      approvalStatus: "",
      checkedAt: timestamp,
    },
  ]);

  clearIndexRowsCache();

  await sendTelegramMessage({
    chatId: params.chatId,
    text: [
      `✅ บันทึกสำเร็จ`,
      `- แถว: ${params.row}`,
      `- สถานะ M: ชำระเงินแล้ว`,
    ].join("\n"),
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
    getCachedIndexRows(),
    readSlipRows(),
  ]);
  const result = allocateSlipToIndex({
    indexRows,
    slipRows,
    checkedAtValue: (slip) =>
      slip.transferDate || slip.timestamp || formatDateTime(new Date()),
  });
  await writeIndexUpdatesMR(result.updates);
  clearIndexRowsCache();

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
    logger.info({
      message: "Telegram message received",
      eventType: "telegram_message",
      userId: userId ? String(userId) : undefined,
    });
    if (!isAdminTelegramUser(userId)) {
      logger.warn({
        message: "Telegram user not in admin list",
        eventType: "telegram_message",
        userId: userId ? String(userId) : undefined,
      });
      return;
    }
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
      await sendTelegramMessage({
        chatId,
        text: "ขออภัย ระบบอ่านสลิปจากรูปภาพถูกปิดชั่วคราว กรุณาบันทึกสลิปด้วยตนเองในแท็บ slip ของ Google Sheets นะครับ",
        replyToMessageId: message.message_id,
      });
      return;
    }
    return;
  }

  if (callback) {
    const data = callback.data || "";
    const chatId = callback.message?.chat.id;
    if (!chatId) return;
    logger.info({
      message: "Telegram callback received",
      eventType: "telegram_callback",
      userId: callback.from?.id ? String(callback.from.id) : undefined,
    });
    await answerTelegramCallback({ callbackQueryId: callback.id });

    if (data.startsWith("review:")) {
      const [, rowStr, result] = data.split(":");
      const row = Number(rowStr || "");
      if (!Number.isFinite(row) || !result) return;
      await handleTelegramReview({ chatId, row, result });
      return;
    }

    if (data.startsWith("markpaid:")) {
      const rowStr = data.replace("markpaid:", "");
      const row = Number(rowStr || "");
      if (!Number.isFinite(row)) return;

      await handleMarkPaid({ chatId, row });
      return;
    }

    if (data.startsWith("intent:slip:")) {
      const key = data.replace("intent:slip:", "");
      const fileId = lookupFileId(key);
      if (!fileId) {
        await sendTelegramMessage({
          chatId,
          text: "ลิงก์รูปหมดอายุแล้วครับ (เกิน 10 นาที) กรุณาส่งรูปใหม่อีกครั้ง",
        });
        return;
      }
      await handleTelegramSlipIntent({ chatId, fileId });
      return;
    }
    if (data === "intent:other") {
      await sendTelegramMessage({ chatId, text: "รับทราบ ไม่ได้บันทึกเป็นสลิปครับ" });
      return;
    }
  }
}
