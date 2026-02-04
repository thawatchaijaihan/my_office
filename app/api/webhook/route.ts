import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { chat, extractSlipFromImage } from "@/lib/gemini";
import { getMessageContentBuffer, replyMessages, replyText } from "@/lib/line";
import { config } from "@/lib/config";
import {
  appendSlipRow,
  readIndexRows,
  readSlipRows,
  writeIndexUpdatesMR,
} from "@/lib/passSheets";
import { allocateSlipToIndex } from "@/lib/paymentAllocation";

/**
 * Verify LINE webhook signature
 */
function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", config.line.channelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}

/**
 * Handle incoming webhook events
 */
type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string; type?: string };
  postback?: { data?: string };
  message?: { id?: string; type: string; text?: string };
};

function isAdminUserId(userId: string | undefined): boolean {
  if (!userId) return false;
  return config.admin.lineUserIds.includes(userId);
}

function isMyIdCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === "myid" ||
    t === "my id" ||
    t === "line_user_id" ||
    t === "line userid" ||
    t === "userid" ||
    t === "user id"
  );
}

function flexIntentMessage(params: { messageId: string }) {
  return {
    type: "flex",
    altText: "เลือกประเภทงานของรูปภาพ",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "ได้รับรูปภาพแล้ว", weight: "bold", size: "lg" },
          {
            type: "text",
            text: "เลือกว่าเป็นรูปประเภทไหน เพื่อให้ระบบทำงานต่อได้ถูกต้อง",
            wrap: true,
            size: "sm",
            color: "#666666",
          },
          {
            type: "button",
            style: "primary",
            action: {
              type: "postback",
              label: "รูปสลิปโอนเงิน",
              data: `intent=slip&messageId=${encodeURIComponent(
                params.messageId
              )}`,
            },
          },
          {
            type: "button",
            style: "secondary",
            action: {
              type: "postback",
              label: "อื่นๆ (ยังไม่ทำ)",
              data: `intent=other&messageId=${encodeURIComponent(
                params.messageId
              )}`,
            },
          },
        ],
      },
    },
  };
}

function flexReviewCarousel(params: {
  rows: Array<{
    rowNumber: number;
    title: string;
    subtitle: string;
    linkUrl: string;
  }>;
}) {
  return {
    type: "flex",
    altText: "รายการรอตรวจ (เลือกสถานะ N)",
    contents: {
      type: "carousel",
      contents: params.rows.map((r) => ({
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "text", text: r.title, weight: "bold", wrap: true },
            r.linkUrl
              ? {
                  type: "text",
                  text: r.subtitle,
                  size: "sm",
                  color: "#0066cc",
                  wrap: true,
                  action: { type: "uri", uri: r.linkUrl },
                  decoration: "underline",
                }
              : { type: "text", text: r.subtitle, size: "sm", color: "#666666", wrap: true },
            { type: "separator", margin: "md" },
            { type: "text", text: `แถว ${r.rowNumber}`, size: "xs", color: "#999999" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#16a34a",
              action: {
                type: "postback",
                label: "รออนุมัติจาก ฝขว.พล.ป.",
                data: `action=review&result=waiting_approval&row=${r.rowNumber}`,
              },
            },
            {
              type: "button",
              style: "primary",
              color: "#16a34a",
              action: {
                type: "postback",
                label: "รอส่ง ฝขว.พล.ป.",
                data: `action=review&result=waiting_send&row=${r.rowNumber}`,
              },
            },
            {
              type: "button",
              style: "primary",
              color: "#16a34a",
              action: {
                type: "postback",
                label: "รอลบข้อมูล",
                data: `action=review&result=waiting_delete&row=${r.rowNumber}`,
              },
            },
            {
              type: "button",
              style: "primary",
              color: "#16a34a",
              action: {
                type: "postback",
                label: "ข้อมูลไม่ถูกต้อง",
                data: `action=review&result=incorrect&row=${r.rowNumber}`,
              },
            },
          ],
        },
      })),
    },
  };
}

async function handleAdminText(params: { replyToken: string; text: string }) {
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
    const [indexRows, slipRows] = await Promise.all([readIndexRows(), readSlipRows()]);
    const result = allocateSlipToIndex({
      indexRows,
      slipRows,
      checkedAtValue: (slip) => slip.transferDate || slip.timestamp || new Date().toLocaleString("th-TH"),
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
    // Show items where N (approvalStatus) is empty - need to determine approval status
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
      subtitle: `ทะเบียน: ${r.plate || "-"} | M: ${r.paymentStatus || "(ว่าง)"}`,
      linkUrl: r.note || "", // Column L - URL
    }));

    await replyMessages(params.replyToken, [flexReviewCarousel({ rows: flexRows }) as any]);
    return;
  }

  if (t === "summary" || t === "สรุป" || t === "สรุปวันนี้") {
    const indexRows = await readIndexRows();

    const total = indexRows.length;
    // M column: paymentStatus (ชำระเงินแล้ว, ค้างชำระเงิน, ลบข้อมูล, empty)
    const pending = indexRows.filter((r) => !r.paymentStatus).length;
    const paid = indexRows.filter((r) => r.paymentStatus === "ชำระเงินแล้ว").length;
    const outstanding = indexRows.filter((r) => r.paymentStatus === "ค้างชำระเงิน" || r.paymentStatus.includes("ค้าง")).length;
    const deleted = indexRows.filter((r) => r.paymentStatus === "ลบข้อมูล").length;

    // N column: approvalStatus (รออนุมัติ..., ข้อมูลไม่ถูกต้อง, etc.)
    const dataIncorrect = indexRows.filter((r) => r.approvalStatus?.includes("ข้อมูลไม่ถูกต้อง")).length;

    // Outstanding by person (ชื่อ-สกุลผู้ขอ) - exclude deleted and data incorrect
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

  // default: AI chat (admin only)
  const aiResponse = await chat(t);
  await replyText(params.replyToken, aiResponse);
}

async function handleEvents(events: LineEvent[]) {
  for (const event of events) {
    const replyToken = event.replyToken;
    if (!replyToken) continue;

    const userId = event.source?.userId;
    const isAdmin = isAdminUserId(userId);
    const adminConfigured = config.admin.lineUserIds.length > 0;

    try {
      if (event.type === "message" && event.message?.type === "text") {
        const text = (event.message as { text?: string })?.text?.trim();
        if (!text) continue;

        // Allow fetching LINE userId for initial setup
        if (isMyIdCommand(text)) {
          if (adminConfigured && !isAdmin) {
            // After admin list is configured, do not respond to non-admin
            continue;
          }
          if (!userId) {
            await replyText(
              replyToken,
              "ไม่พบ LINE userId ในอีเวนต์นี้ (ลองทักแชท 1:1 กับบอท หรือเช็คการตั้งค่า LINE channel)"
            );
            continue;
          }
          await replyText(
            replyToken,
            ["LINE userId ของคุณคือ", userId].join("\n")
          );
          continue;
        }

        // Setup mode: if admin is not configured yet, guide the user
        if (!adminConfigured) {
          await replyText(
            replyToken,
            [
              "ระบบอยู่ในโหมดตั้งค่า",
              "เพื่อให้บอทคุยกับคุณคนเดียว ให้พิมพ์: myid",
              "แล้วนำ userId ที่ได้ไปใส่ในตัวแปร ADMIN_LINE_USER_IDS (App Hosting env) และ rollout อีกครั้ง",
            ].join("\n")
          );
          continue;
        }

        // Chat admin only for now
        if (!isAdmin) {
          // avoid noisy replies to non-admin
          continue;
        }

        await handleAdminText({ replyToken, text });
        continue;
      }

      // Non-text events are admin-only
      if (!isAdmin) {
        continue;
      }

      if (event.type === "message" && event.message?.type === "image") {
        const messageId = event.message.id;
        if (!messageId) {
          await replyText(replyToken, "ไม่พบ messageId ของรูปภาพ");
          continue;
        }
        await replyMessages(replyToken, [flexIntentMessage({ messageId }) as any]);
        continue;
      }

      if (event.type === "postback") {
        const data = event.postback?.data ?? "";
        const url = new URL("https://dummy.local/?" + data);
        const action = url.searchParams.get("action");
        const intent = url.searchParams.get("intent");
        const messageId = url.searchParams.get("messageId");

        if (action === "review") {
          const row = Number(url.searchParams.get("row") ?? "");
          const result = url.searchParams.get("result");
          if (!Number.isFinite(row) || !row) {
            await replyText(replyToken, "รูปแบบข้อมูลไม่ถูกต้อง (row)");
            continue;
          }

          const now = new Date().toLocaleString("th-TH");
          const indexRows = await readIndexRows();
          const target = indexRows.find((r) => r.rowNumber === row);
          if (!target) {
            await replyText(replyToken, `ไม่พบรายการแถว ${row}`);
            continue;
          }

          // Map result to N (approvalStatus) value
          const approvalMap: Record<string, { n: string; m?: string }> = {
            waiting_approval: { n: "รออนุมัติจาก ฝขว.พล.ป." },
            waiting_send: { n: "รอส่ง ฝขว.พล.ป." },
            waiting_delete: { n: "รอลบข้อมูล", m: "ลบข้อมูล" },
            incorrect: { n: "ข้อมูลไม่ถูกต้อง", m: "ลบข้อมูล" },
          };

          const mapping = approvalMap[result ?? ""];
          if (!mapping) {
            await replyText(replyToken, "ผลการตรวจไม่ถูกต้อง");
            continue;
          }

          await writeIndexUpdatesMR([
            {
              rowNumber: row,
              paymentStatus: mapping.m ?? target.paymentStatus, // keep M or set if specified
              approvalStatus: mapping.n,
              checkedAt: now,
              slipFirstName: mapping.m ? "" : target.slipFirstName,
              slipLastName: mapping.m ? "" : target.slipLastName,
              slipAmount: mapping.m ? "" : target.slipAmount,
            },
          ]);
          await replyText(replyToken, `บันทึกแล้ว: แถว ${row}\nN = ${mapping.n}${mapping.m ? `\nM = ${mapping.m}` : ""}`);

          // Apply slip allocation after review change
          const [indexRows2, slipRows2] = await Promise.all([readIndexRows(), readSlipRows()]);
          const alloc = allocateSlipToIndex({
            indexRows: indexRows2,
            slipRows: slipRows2,
            checkedAtValue: (slip) =>
              slip.transferDate || slip.timestamp || new Date().toLocaleString("th-TH"),
          });
          await writeIndexUpdatesMR(alloc.updates);
          continue;
        }

        if (intent === "slip" && messageId) {
          await replyText(replyToken, "กำลังอ่านสลิป...");
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
            continue;
          }

          const amount = extracted.amount;
          const k = amount % 30 === 0 ? amount / 30 : null;

          // Write to slip sheet, then run allocation immediately
          if (k === null) {
            await replyText(
              replyToken,
              [
                "อ่านสลิปได้ แต่ยอดไม่ลงตัวกับ 30 บาท/รายการ",
                `- ชื่อ: ${extracted.payer_first_name ?? "-"} ${
                  extracted.payer_last_name ?? "-"
                }`,
                `- ยอด: ${amount} บาท`,
                `- วันเวลาโอน: ${extracted.transfer_datetime ?? "-"}`,
                "",
                "กรุณาตรวจมือ แล้วค่อยบันทึก/แก้ไขในแท็บ slip",
              ].join("\n")
            );
            continue;
          }

          const now = new Date();
          const timestamp = now.toLocaleString("th-TH");
          const transferDate = extracted.transfer_datetime ?? timestamp;

          await appendSlipRow({
            timestamp,
            rankName: extracted.payer_first_name ?? "-",
            surname: extracted.payer_last_name ?? "-",
            amount,
            transferDate,
          });

          const [indexRows, slipRows] = await Promise.all([readIndexRows(), readSlipRows()]);
          const result = allocateSlipToIndex({
            indexRows,
            slipRows,
            checkedAtValue: (slip) =>
              slip.transferDate || slip.timestamp || new Date().toLocaleString("th-TH"),
          });
          await writeIndexUpdatesMR(result.updates);

          await replyText(
            replyToken,
            [
              "บันทึกสลิปและอัปเดตสถานะเรียบร้อย",
              `- ผู้โอน: ${extracted.payer_first_name ?? "-"} ${
                extracted.payer_last_name ?? "-"
              }`,
              `- ยอด: ${amount} บาท (${k} รายการ)`,
              `- ปิดรายการได้: ${result.summary.allocatedRequests} รายการ`,
              `- รายการต้องตรวจมือ: ${result.summary.needsReview}`,
            ].join("\n")
          );
          continue;
        }

        await replyText(replyToken, "ฟังก์ชันนี้ยังไม่รองรับ");
        continue;
      }
    } catch (err) {
      console.error("[Webhook] Error:", err);
      await replyText(replyToken, "ขออภัย เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะครับ");
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-line-signature") ?? "";

    if (!verifySignature(body, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body) as { events?: unknown[] };
    const events = payload.events ?? [];

    if (events.length > 0) {
      await handleEvents(events as LineEvent[]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Webhook] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
