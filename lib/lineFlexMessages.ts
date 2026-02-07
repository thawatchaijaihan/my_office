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

export function flexReviewCarousel(params: {
  rows: Array<{
    rowNumber: number;
    title: string;
    subtitle: string;
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
              text: `แถว ${r.rowNumber}`,
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
