/**
 * LINE Flex Message builders for webhook replies
 */

export function flexIntentMessage(params: { messageId: string }) {
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

/** แถวต่อคน (ไม่แสดง M) - ใช้สำหรับรวมกลุ่มตามชื่อ-สกุล (invalid) */
export type ReviewRow = {
  rowNumber: number;
  subtitle: string;
  requestFor: string;
  vehicleOwner: string;
  registeredAt: string;
  linkUrl: string;
};

export type ReviewGroup = { name: string; rows: ReviewRow[] };

/** รายการรอตรวจแบบเดิม: หนึ่ง bubble ต่อแถว, แสดง M, มีปุ่ม */
export function flexReviewCarousel(params: {
  rows: Array<{
    rowNumber: number;
    title: string;
    subtitle: string;
    requestFor: string;
    vehicleOwner: string;
    registeredAt: string;
    paymentStatus: string;
    linkUrl: string;
  }>;
}) {
  return {
    type: "flex",
    altText: "รายการรอตรวจ (เลือกสถานะ N)",
    contents: {
      type: "carousel",
      contents: params.rows.map((r) => {
        const paymentColor = r.paymentStatus.includes("ค้าง")
          ? "#dc2626"
          : r.paymentStatus.includes("ชำระเงินแล้ว")
            ? "#16a34a"
            : "#666666";
        return {
          type: "bubble",
          header: {
            type: "box",
            layout: "horizontal",
            backgroundColor: "#16a34a",
            paddingAll: "12px",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "รายการรอตรวจ",
                weight: "bold",
                color: "#ffffff",
                size: "md",
                wrap: true,
                flex: 1,
              },
              {
                type: "text",
                text: r.registeredAt || "-",
                size: "sm",
                color: "#ffffff",
                align: "end",
              },
            ],
          },
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
              {
                type: "text",
                text: `ขอบัตรให้: ${r.requestFor || "-"}`,
                size: "sm",
                color: "#666666",
                wrap: true,
              },
              {
                type: "text",
                text: `เจ้าของรถ: ${r.vehicleOwner || r.title || "-"}`,
                size: "sm",
                color: "#666666",
                wrap: true,
              },
              {
                type: "text",
                text: r.paymentStatus,
                size: "md",
                weight: "bold",
                color: paymentColor,
                wrap: true,
              },
              { type: "separator", margin: "md" },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "vertical",
                    spacing: "xs",
                    contents: [
                      {
                        type: "button",
                        style: "primary",
                        color: "#16a34a",
                        height: "sm",
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
                        height: "sm",
                        action: {
                          type: "postback",
                          label: "รอส่ง ฝขว.พล.ป.",
                          data: `action=review&result=waiting_send&row=${r.rowNumber}`,
                        },
                      },
                    ],
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    spacing: "xs",
                    contents: [
                      {
                        type: "button",
                        style: "primary",
                        color: "#16a34a",
                        height: "sm",
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
                        height: "sm",
                        action: {
                          type: "postback",
                          label: "ข้อมูลไม่ถูกต้อง",
                          data: `action=review&result=incorrect&row=${r.rowNumber}`,
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        };
      }),
    },
  };
}

/** Carousel แสดงรายการแบบอ่านอย่างเดียว (ไม่มีปุ่ม, ไม่แสดง M) - ใช้กับรายการ N = ข้อมูลไม่ถูกต้อง, รวมกลุ่มตามชื่อ-สกุล */
export function flexReviewCarouselReadOnly(params: {
  groups: ReviewGroup[];
  headerLabel?: string;
}) {
  const headerLabel = params.headerLabel ?? "รายการข้อมูลไม่ถูกต้อง";
  return {
    type: "flex",
    altText: headerLabel,
    contents: {
      type: "carousel",
      contents: params.groups.map((group) => {
        const bodyContents: unknown[] = [
          {
            type: "text",
            text: "ข้อมูลไม่ถูกต้อง",
            weight: "bold",
            decoration: "underline",
            size: "md",
            color: "#b45309",
            wrap: true,
          },
        ];
        for (let i = 0; i < group.rows.length; i++) {
          const r = group.rows[i];
          bodyContents.push({ type: "separator", margin: "md" });
          bodyContents.push(
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
            {
              type: "text",
              text: `ขอบัตรให้: ${r.requestFor || "-"}`,
              size: "sm",
              color: "#666666",
              wrap: true,
            },
            {
              type: "text",
              text: `เจ้าของรถ: ${r.vehicleOwner || group.name || "-"}`,
              size: "sm",
              color: "#666666",
              wrap: true,
            },
            { type: "text", text: r.registeredAt || "-", size: "sm", color: "#666666", wrap: true }
          );
        }
        return {
          type: "bubble",
          header: {
            type: "box",
            layout: "horizontal",
            backgroundColor: "#b45309",
            paddingAll: "12px",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: group.name || headerLabel,
                weight: "bold",
                color: "#ffffff",
                size: "md",
                wrap: true,
                flex: 1,
              },
            ],
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: bodyContents,
          },
        };
      }),
    },
  };
}
