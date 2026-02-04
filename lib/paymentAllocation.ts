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

// M column values (payment status)
const PAID = "ชำระเงินแล้ว";
const OUTSTANDING = "ค้างชำระเงิน";
const DELETED = "ลบข้อมูล";

// N column values (approval status) - we check for "ข้อมูลไม่ถูกต้อง" to exclude
const DATA_INCORRECT = "ข้อมูลไม่ถูกต้อง";

function isPaid(m: string): boolean {
  return normalizeThai(m) === normalizeThai(PAID);
}

function isDeleted(m: string): boolean {
  return normalizeThai(m) === normalizeThai(DELETED);
}

function isDataIncorrect(n: string): boolean {
  return normalizeThai(n).includes(normalizeThai(DATA_INCORRECT));
}

function isExcluded(r: IndexRow): boolean {
  // Excluded from payment: M = ลบข้อมูล OR N = ข้อมูลไม่ถูกต้อง
  return isDeleted(r.paymentStatus) || isDataIncorrect(r.approvalStatus);
}

function isOutstanding(r: IndexRow): boolean {
  // Outstanding: M is empty or contains "ค้าง", and not excluded
  if (isExcluded(r)) return false;
  if (isPaid(r.paymentStatus)) return false;
  const m = normalizeThai(r.paymentStatus);
  return !m || m.includes(normalizeThai("ค้าง"));
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
 * - If M == "ลบข้อมูล" or N contains "ข้อมูลไม่ถูกต้อง": excluded from payment
 * - If pay not enough, leave latest requests outstanding (pay oldest first)
 * - M values:
 *   - paid rows: "ชำระเงินแล้ว"
 *   - outstanding rows: "ค้างชำระเงิน"
 *   - deleted rows: "ลบข้อมูล" (keep as-is)
 */
export function allocateSlipToIndex(params: {
  indexRows: IndexRow[];
  slipRows: SlipRow[];
  checkedAtValue: (slip: SlipRow) => string;
}): AllocationResult {
  const updatesByRow = new Map<number, IndexUpdateMR>();

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

    // Outstanding rows (exclude deleted/incorrect)
    const outstandingRows = rows.filter((r) => isOutstanding(r));

    if (outstandingRows.length === 0) continue;

    const toPay = outstandingRows.slice(0, Math.min(k, outstandingRows.length));
    processedSlips++;

    for (const r of toPay) {
      allocatedRequests++;
      updatesByRow.set(r.rowNumber, {
        rowNumber: r.rowNumber,
        paymentStatus: PAID,
        approvalStatus: r.approvalStatus, // keep N unchanged
        checkedAt: params.checkedAtValue(slip),
        slipFirstName: extractFirstNameFromRankName(slip.payerRankName),
        slipLastName: slip.payerSurname,
        slipAmount: String(amount),
      });
    }

    // Mark remaining outstanding rows
    for (const r of outstandingRows) {
      if (updatesByRow.has(r.rowNumber)) continue; // already marked as paid
      updatesByRow.set(r.rowNumber, {
        rowNumber: r.rowNumber,
        paymentStatus: OUTSTANDING,
        approvalStatus: r.approvalStatus, // keep N unchanged
        checkedAt: r.checkedAt,
        slipFirstName: r.slipFirstName,
        slipLastName: r.slipLastName,
        slipAmount: r.slipAmount,
      });
    }
  }

  // Mark any remaining outstanding rows that weren't touched
  for (const r of params.indexRows) {
    if (updatesByRow.has(r.rowNumber)) continue;
    if (!isOutstanding(r)) continue;
    // Mark as outstanding if M is empty
    if (!r.paymentStatus) {
      updatesByRow.set(r.rowNumber, {
        rowNumber: r.rowNumber,
        paymentStatus: OUTSTANDING,
        approvalStatus: r.approvalStatus,
        checkedAt: r.checkedAt,
        slipFirstName: r.slipFirstName,
        slipLastName: r.slipLastName,
        slipAmount: r.slipAmount,
      });
    }
  }

  return {
    updates: [...updatesByRow.values()].sort((a, b) => a.rowNumber - b.rowNumber),
    summary: { processedSlips, allocatedRequests, needsReview },
  };
}
