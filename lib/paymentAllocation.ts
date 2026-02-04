import { IndexRow, IndexUpdateMR, SlipRow } from "./passSheets";

const FEE_PER_REQUEST = 30;

function normalizeThai(s: string): string {
  return (s || "")
    .replace(/\s+/g, "")
    .replace(/[.·•\-_/()]/g, "")
    .trim()
    .toLowerCase();
}

function extractFirstNameFromRankName(rankName: string): string {
  // Examples: "จ.ส.อ.ฤทธิไกร" , "ส.อ.มานะศักดิ์"
  // We'll remove common rank patterns and keep the rest as "first name"
  const s = rankName || "";
  return s
    .replace(/จ\.?ส\.?อ\.?/g, "")
    .replace(/จ\.?ส\.?ท\.?/g, "")
    .replace(/ส\.?อ\.?/g, "")
    .replace(/ส\.?ท\.?/g, "")
    .replace(/ร\.?ท\.?/g, "")
    .replace(/ร\.?ต\.?/g, "")
    .replace(/พ\.?ท\.?/g, "")
    .replace(/พ\.?ต\.?/g, "")
    .replace(/ร\.?อ\.?/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function isReviewFail(m: string): boolean {
  return normalizeThai(m) === normalizeThai("ไม่ผ่าน");
}

function isPaidStatus(n: string): boolean {
  return normalizeThai(n) === normalizeThai("ชำระเงินเรียบร้อย");
}

function isNoPayStatus(n: string): boolean {
  return normalizeThai(n) === normalizeThai("ไม่ต้องชำระ");
}

function isOutstandingStatus(n: string): boolean {
  const t = normalizeThai(n);
  if (!t) return true;
  if (isPaidStatus(n) || isNoPayStatus(n)) return false;
  // treat any "ค้าง" as outstanding
  return t.includes(normalizeThai("ค้าง"));
}

function parseRegisteredAtSortable(s: string): number {
  // Sheet stores like "27/8/2025, 14:53:00" or similar.
  // We'll attempt dd/mm/yyyy first.
  const m = s.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!m) return Number.POSITIVE_INFINITY;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const HH = Number(m[4] ?? 0);
  const MI = Number(m[5] ?? 0);
  const SS = Number(m[6] ?? 0);
  const dt = new Date(yyyy, mm - 1, dd, HH, MI, SS);
  return dt.getTime();
}

export type AllocationResult = {
  updates: IndexUpdateMR[];
  summary: {
    processedSlips: number;
    allocatedRequests: number;
    needsReview: number;
  };
};

/**
 * Allocate slip payments to index requests.
 *
 * Rules:
 * - Fee per request = 30
 * - Group by requester name (C-D), match slip by (surname == D) and (slip firstName contained in C)
 * - If M == "ไม่ผ่าน": mark N = "ไม่ต้องชำระ" (excluded from outstanding)
 * - If pay not enough, leave latest requests outstanding (pay oldest first)
 * - N format:
 *   - paid rows: "ชำระเงินเรียบร้อย"
 *   - outstanding rows: "ค้างชำระเงิน <x> รายการ" (x = outstanding count for that person)
 *   - M fail rows: "ไม่ต้องชำระ"
 */
export function allocateSlipToIndex(params: {
  indexRows: IndexRow[];
  slipRows: SlipRow[];
  checkedAtValue: (slip: SlipRow) => string;
}): AllocationResult {
  const updatesByRow = new Map<number, IndexUpdateMR>();

  // Pre-mark M fail => no pay
  for (const r of params.indexRows) {
    if (!r.reviewResult) continue;
    if (!isReviewFail(r.reviewResult)) continue;
    if (isNoPayStatus(r.paymentStatus)) continue;
    updatesByRow.set(r.rowNumber, {
      rowNumber: r.rowNumber,
      reviewResult: r.reviewResult,
      paymentStatus: "ไม่ต้องชำระ",
      checkedAt: r.checkedAt,
      slipFirstName: r.slipFirstName,
      slipLastName: r.slipLastName,
      slipAmount: r.slipAmount,
    });
  }

  // Build lookup by requester (first+last)
  const byPersonKey = new Map<string, IndexRow[]>();
  for (const r of params.indexRows) {
    const key = normalizeThai(r.firstName) + "|" + normalizeThai(r.lastName);
    if (!byPersonKey.has(key)) byPersonKey.set(key, []);
    byPersonKey.get(key)!.push(r);
  }
  for (const rows of byPersonKey.values()) {
    rows.sort((a, b) => parseRegisteredAtSortable(a.registeredAt) - parseRegisteredAtSortable(b.registeredAt));
  }

  // Normalize outstanding count display for everyone first
  for (const rows of byPersonKey.values()) {
    const outstanding = rows.filter((r) => {
      if (isReviewFail(r.reviewResult)) return false;
      const existing = updatesByRow.get(r.rowNumber);
      const status = existing?.paymentStatus ?? r.paymentStatus;
      return isOutstandingStatus(status);
    });
    const x = outstanding.length;
    if (x === 0) continue;
    for (const r of outstanding) {
      const existing = updatesByRow.get(r.rowNumber);
      const currentStatus = existing?.paymentStatus ?? r.paymentStatus;
      const desired = `ค้างชำระเงิน ${x} รายการ`;
      if (normalizeThai(currentStatus) === normalizeThai(desired)) continue;
      updatesByRow.set(r.rowNumber, {
        rowNumber: r.rowNumber,
        reviewResult: existing?.reviewResult ?? r.reviewResult,
        paymentStatus: desired,
        checkedAt: existing?.checkedAt ?? r.checkedAt,
        slipFirstName: existing?.slipFirstName ?? r.slipFirstName,
        slipLastName: existing?.slipLastName ?? r.slipLastName,
        slipAmount: existing?.slipAmount ?? r.slipAmount,
      });
    }
  }

  let processedSlips = 0;
  let allocatedRequests = 0;
  let needsReview = 0;

  for (const slip of params.slipRows) {
    if (!slip.amount || slip.amount <= 0) continue;
    // Only process pass fee
    if (slip.type && normalizeThai(slip.type) !== normalizeThai("ค่าบัตรผ่านฯ")) {
      continue;
    }
    const amount = slip.amount;
    if (amount % FEE_PER_REQUEST !== 0) {
      needsReview++;
      continue;
    }

    const k = amount / FEE_PER_REQUEST;
    const slipSurname = normalizeThai(slip.payerSurname);
    const slipFirstName = normalizeThai(extractFirstNameFromRankName(slip.payerRankName));
    if (!slipSurname || !slipFirstName) {
      needsReview++;
      continue;
    }

    // Find matching person keys
    const candidates: { key: string; rows: IndexRow[] }[] = [];
    for (const [key, rows] of byPersonKey.entries()) {
      const [first, last] = key.split("|");
      if (!last || last !== slipSurname) continue;
      if (!first.includes(slipFirstName)) continue;
      candidates.push({ key, rows });
    }

    if (candidates.length !== 1) {
      // ambiguous or none
      needsReview++;
      continue;
    }

    const rows = candidates[0]!.rows;

    // Outstanding rows (exclude M fail)
    const outstanding = rows.filter(
      (r) => !isReviewFail(r.reviewResult) && isOutstandingStatus(r.paymentStatus)
    );

    if (outstanding.length === 0) continue;

    const toPay = outstanding.slice(0, Math.min(k, outstanding.length));
    processedSlips++;

    for (const r of toPay) {
      allocatedRequests++;
      updatesByRow.set(r.rowNumber, {
        rowNumber: r.rowNumber,
        reviewResult: r.reviewResult,
        paymentStatus: "ชำระเงินเรียบร้อย",
        checkedAt: params.checkedAtValue(slip),
        slipFirstName: extractFirstNameFromRankName(slip.payerRankName),
        slipLastName: slip.payerSurname,
        slipAmount: String(amount),
      });
    }

    // Recompute outstanding count after allocation, and set N text for remaining outstanding rows
    const afterOutstanding = rows.filter((r) => {
      if (isReviewFail(r.reviewResult)) return false;
      const existingUpdate = updatesByRow.get(r.rowNumber);
      const status = existingUpdate?.paymentStatus ?? r.paymentStatus;
      return isOutstandingStatus(status);
    });

    const x = afterOutstanding.length;
    for (const r of afterOutstanding) {
      const existingUpdate = updatesByRow.get(r.rowNumber);
      // keep paid/no-pay untouched
      const status = existingUpdate?.paymentStatus ?? r.paymentStatus;
      if (!isOutstandingStatus(status)) continue;
      updatesByRow.set(r.rowNumber, {
        rowNumber: r.rowNumber,
        reviewResult: existingUpdate?.reviewResult ?? r.reviewResult,
        paymentStatus: `ค้างชำระเงิน ${x} รายการ`,
        checkedAt: existingUpdate?.checkedAt ?? r.checkedAt,
        slipFirstName: existingUpdate?.slipFirstName ?? r.slipFirstName,
        slipLastName: existingUpdate?.slipLastName ?? r.slipLastName,
        slipAmount: existingUpdate?.slipAmount ?? r.slipAmount,
      });
    }
  }

  // Final pass: ensure M fail rows are "ไม่ต้องชำระ" even if previously outstanding
  for (const r of params.indexRows) {
    if (!isReviewFail(r.reviewResult)) continue;
    const existing = updatesByRow.get(r.rowNumber);
    const status = existing?.paymentStatus ?? r.paymentStatus;
    if (isNoPayStatus(status)) continue;
    updatesByRow.set(r.rowNumber, {
      rowNumber: r.rowNumber,
      reviewResult: r.reviewResult,
      paymentStatus: "ไม่ต้องชำระ",
      checkedAt: existing?.checkedAt ?? r.checkedAt,
      slipFirstName: existing?.slipFirstName ?? r.slipFirstName,
      slipLastName: existing?.slipLastName ?? r.slipLastName,
      slipAmount: existing?.slipAmount ?? r.slipAmount,
    });
  }

  return {
    updates: [...updatesByRow.values()].sort((a, b) => a.rowNumber - b.rowNumber),
    summary: { processedSlips, allocatedRequests, needsReview },
  };
}

