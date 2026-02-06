import { describe, it, expect } from "vitest";
import { allocateSlipToIndex } from "./paymentAllocation";
import type { IndexRow, SlipRow } from "./passSheets";

const emptyRow = (overrides: Partial<IndexRow> & { rowNumber: number }): IndexRow => ({
  rowNumber: overrides.rowNumber,
  registeredAt: "",
  rank: "",
  firstName: "",
  lastName: "",
  requestFor: "",
  vehicleOwner: "",
  vehicleType: "",
  vehicleModel: "",
  vehicleColor: "",
  plate: "",
  phone: "",
  note: "",
  paymentStatus: "",
  approvalStatus: "",
  checkedAt: "",
  ...overrides,
});

const slipRow = (overrides: Partial<SlipRow> & { rowNumber: number }): SlipRow => ({
  rowNumber: overrides.rowNumber,
  timestamp: "",
  payerRankName: "",
  payerSurname: "",
  amount: null,
  type: "ค่าบัตรผ่านฯ",
  transferDate: "",
  ...overrides,
});

const checkedAt = "01/01/2025 12:00:00";

describe("allocateSlipToIndex", () => {
  it("allocates one slip (30) to one matching index row", () => {
    const indexRows: IndexRow[] = [
      emptyRow({
        rowNumber: 2,
        registeredAt: "27/8/2025, 14:53:00",
        rank: "จ.ส.อ.",
        firstName: "ฤทธิไกร",
        lastName: "ใจมั่น",
        paymentStatus: "",
        approvalStatus: "",
        checkedAt: "",
      }),
    ];
    const slipRows: SlipRow[] = [
      slipRow({
        rowNumber: 2,
        payerRankName: "จ.ส.อ.ฤทธิไกร",
        payerSurname: "ใจมั่น",
        amount: 30,
        transferDate: "2025-08-27 15:00:00",
      }),
    ];
    const result = allocateSlipToIndex({
      indexRows,
      slipRows,
      checkedAtValue: () => checkedAt,
    });
    expect(result.summary.processedSlips).toBe(1);
    expect(result.summary.allocatedRequests).toBe(1);
    expect(result.summary.needsReview).toBe(0);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({
      rowNumber: 2,
      paymentStatus: "ชำระเงินแล้ว",
      checkedAt,
    });
  });

  it("allocates 60 to two matching index rows (oldest first)", () => {
    const indexRows: IndexRow[] = [
      emptyRow({
        rowNumber: 2,
        registeredAt: "26/8/2025, 10:00:00",
        firstName: "มานะ",
        lastName: "ศักดิ์ดี",
        paymentStatus: "",
        approvalStatus: "",
        checkedAt: "",
      }),
      emptyRow({
        rowNumber: 3,
        registeredAt: "27/8/2025, 11:00:00",
        firstName: "มานะ",
        lastName: "ศักดิ์ดี",
        paymentStatus: "",
        approvalStatus: "",
        checkedAt: "",
      }),
    ];
    const slipRows: SlipRow[] = [
      slipRow({
        rowNumber: 2,
        payerRankName: "ส.อ.มานะ",
        payerSurname: "ศักดิ์ดี",
        amount: 60,
        transferDate: "2025-08-27 12:00:00",
      }),
    ];
    const result = allocateSlipToIndex({
      indexRows,
      slipRows,
      checkedAtValue: (s) => s.transferDate,
    });
    expect(result.summary.allocatedRequests).toBe(2);
    expect(result.updates).toHaveLength(2);
    const paid = result.updates.filter((u) => u.paymentStatus === "ชำระเงินแล้ว");
    expect(paid).toHaveLength(2);
    expect(paid.map((u) => u.rowNumber).sort()).toEqual([2, 3]);
  });

  it("counts needsReview when slip amount not divisible by 30", () => {
    const indexRows: IndexRow[] = [
      emptyRow({
        rowNumber: 2,
        firstName: "ทดสอบ",
        lastName: "หนึ่ง",
        paymentStatus: "",
        approvalStatus: "",
        checkedAt: "",
      }),
    ];
    const slipRows: SlipRow[] = [
      slipRow({
        rowNumber: 2,
        payerRankName: "ทดสอบ",
        payerSurname: "หนึ่ง",
        amount: 50,
        transferDate: "2025-08-27 12:00:00",
      }),
    ];
    const result = allocateSlipToIndex({
      indexRows,
      slipRows,
      checkedAtValue: () => checkedAt,
    });
    expect(result.summary.processedSlips).toBe(0);
    expect(result.summary.allocatedRequests).toBe(0);
    expect(result.summary.needsReview).toBe(1);
    // Row may still be marked as ค้างชำระเงิน by "remaining outstanding" pass
    const paid = result.updates.filter((u) => u.paymentStatus === "ชำระเงินแล้ว");
    expect(paid).toHaveLength(0);
  });

  it("excludes rows with M = ลบข้อมูล from allocation", () => {
    const indexRows: IndexRow[] = [
      emptyRow({
        rowNumber: 2,
        registeredAt: "26/8/2025, 10:00:00",
        firstName: "ลบ",
        lastName: "ข้อมูล",
        paymentStatus: "ลบข้อมูล",
        approvalStatus: "",
        checkedAt: "",
      }),
    ];
    const slipRows: SlipRow[] = [
      slipRow({
        rowNumber: 2,
        payerRankName: "ลบ",
        payerSurname: "ข้อมูล",
        amount: 30,
        transferDate: "2025-08-27 12:00:00",
      }),
    ];
    const result = allocateSlipToIndex({
      indexRows,
      slipRows,
      checkedAtValue: () => checkedAt,
    });
    expect(result.summary.allocatedRequests).toBe(0);
    expect(result.updates).toHaveLength(0);
  });

  it("excludes rows with N containing ข้อมูลไม่ถูกต้อง", () => {
    const indexRows: IndexRow[] = [
      emptyRow({
        rowNumber: 2,
        registeredAt: "26/8/2025, 10:00:00",
        firstName: "ผิด",
        lastName: "พลาด",
        paymentStatus: "",
        approvalStatus: "ข้อมูลไม่ถูกต้อง",
        checkedAt: "",
      }),
    ];
    const slipRows: SlipRow[] = [
      slipRow({
        rowNumber: 2,
        payerRankName: "ผิด",
        payerSurname: "พลาด",
        amount: 30,
        transferDate: "2025-08-27 12:00:00",
      }),
    ];
    const result = allocateSlipToIndex({
      indexRows,
      slipRows,
      checkedAtValue: () => checkedAt,
    });
    expect(result.summary.allocatedRequests).toBe(0);
    expect(result.updates).toHaveLength(0);
  });

  it("marks remaining outstanding rows as ค้างชำระเงิน when some are paid", () => {
    const indexRows: IndexRow[] = [
      emptyRow({
        rowNumber: 2,
        registeredAt: "26/8/2025, 10:00:00",
        firstName: "สาม",
        lastName: "คน",
        paymentStatus: "",
        approvalStatus: "",
        checkedAt: "",
      }),
      emptyRow({
        rowNumber: 3,
        registeredAt: "27/8/2025, 10:00:00",
        firstName: "สาม",
        lastName: "คน",
        paymentStatus: "",
        approvalStatus: "",
        checkedAt: "",
      }),
      emptyRow({
        rowNumber: 4,
        registeredAt: "28/8/2025, 10:00:00",
        firstName: "สาม",
        lastName: "คน",
        paymentStatus: "",
        approvalStatus: "",
        checkedAt: "",
      }),
    ];
    const slipRows: SlipRow[] = [
      slipRow({
        rowNumber: 2,
        payerRankName: "สาม",
        payerSurname: "คน",
        amount: 30,
        transferDate: "2025-08-28 12:00:00",
      }),
    ];
    const result = allocateSlipToIndex({
      indexRows,
      slipRows,
      checkedAtValue: () => checkedAt,
    });
    expect(result.summary.allocatedRequests).toBe(1);
    const paid = result.updates.find((u) => u.paymentStatus === "ชำระเงินแล้ว");
    expect(paid?.rowNumber).toBe(2);
    const outstanding = result.updates.filter((u) => u.paymentStatus === "ค้างชำระเงิน");
    expect(outstanding.map((u) => u.rowNumber).sort()).toEqual([3, 4]);
  });

  it("ignores slip with type other than ค่าบัตรผ่านฯ", () => {
    const indexRows: IndexRow[] = [
      emptyRow({
        rowNumber: 2,
        firstName: "อื่น",
        lastName: "ประเภท",
        paymentStatus: "",
        approvalStatus: "",
        checkedAt: "",
      }),
    ];
    const slipRows: SlipRow[] = [
      slipRow({
        rowNumber: 2,
        payerRankName: "อื่น",
        payerSurname: "ประเภท",
        amount: 30,
        type: "ค่าอื่น",
        transferDate: "2025-08-27 12:00:00",
      }),
    ];
    const result = allocateSlipToIndex({
      indexRows,
      slipRows,
      checkedAtValue: () => checkedAt,
    });
    expect(result.summary.processedSlips).toBe(0);
    expect(result.summary.allocatedRequests).toBe(0);
    // Slip is not used; row may still be marked as ค้างชำระเงิน
    const paid = result.updates.filter((u) => u.paymentStatus === "ชำระเงินแล้ว");
    expect(paid).toHaveLength(0);
  });
});
