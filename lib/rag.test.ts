import { describe, it, expect } from "vitest";
import {
  splitIntoChunks,
  scoreChunk,
  getRelevantChunks,
} from "./rag";

describe("splitIntoChunks", () => {
  it("splits by ## headers", () => {
    const doc = `
## บัตรผ่าน
ค่าบัตร 30 บาท

## วิธีส่งสลิป
ส่งรูปใน LINE
`;
    const chunks = splitIntoChunks(doc.trim());
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.title).toBe("บัตรผ่าน");
    expect(chunks[0]!.text).toContain("ค่าบัตร 30 บาท");
    expect(chunks[1]!.title).toBe("วิธีส่งสลิป");
    expect(chunks[1]!.text).toContain("ส่งรูปใน LINE");
  });

  it("returns single chunk when no ##", () => {
    const doc = "ข้อความเดียวไม่มีหัวข้อ";
    const chunks = splitIntoChunks(doc);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.title).toBe("ข้อความเดียวไม่มีหัวข้อ");
    expect(chunks[0]!.text).toBe(doc);
  });

  it("handles empty doc", () => {
    const chunks = splitIntoChunks("");
    expect(chunks).toHaveLength(0);
  });
});

describe("scoreChunk", () => {
  it("scores by keyword overlap", () => {
    const chunk = { title: "บัตรผ่าน", text: "ค่าบัตรผ่าน 30 บาท" };
    expect(scoreChunk("ค่าบัตร", chunk)).toBe(1);
    expect(scoreChunk("ค่าบัตร 30 บาท", chunk)).toBeGreaterThanOrEqual(2);
    expect(scoreChunk("ไม่มีคำนี้", chunk)).toBe(0);
  });

  it("is case insensitive", () => {
    const chunk = { title: "Test", text: "Content" };
    expect(scoreChunk("test", chunk)).toBe(1);
    expect(scoreChunk("content", chunk)).toBe(1);
  });
});

describe("getRelevantChunks", () => {
  const smallDoc = `
## บัตรผ่าน
ค่าบัตรผ่าน 30 บาท ต่อรายการ

## สลิป
ส่งสลิปใน LINE เลือกสลิปการโอน
`.trim();

  it("returns chunks matching query", () => {
    const chunks = getRelevantChunks("ค่าบัตร 30", { maxChunks: 5, doc: smallDoc });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.includes("30 บาท"))).toBe(true);
  });

  it("returns empty when query is empty", () => {
    const chunks = getRelevantChunks("", { maxChunks: 5, doc: smallDoc });
    expect(chunks).toHaveLength(0);
  });

  it("respects maxChunks", () => {
    const chunks = getRelevantChunks("บัตร สลิป LINE", { maxChunks: 1, doc: smallDoc });
    expect(chunks).toHaveLength(1);
  });
});
