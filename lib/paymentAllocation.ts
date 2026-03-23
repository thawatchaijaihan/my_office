import { IndexRow, IndexUpdateMR, SlipRow } from "./passSheets";

const FEE_PER_REQUEST = 30;

function normalizeThai(s: string): string {
  return (s || "")
    .replace(/\s+/g, "")
    .replace(/[.·•\-_/()]/g, "")
    .replace(/[\u200b\u200c\u200d\u2060\uFEFF]/g, "")
    .replace(/์/g, "")
    .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, "")
    .trim()
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j] + 1,
        dp[i]![j - 1] + 1,
        dp[i - 1]![j - 1] + cost
      );
    }
  }
  return dp[a.length]![b.length]!;
}

function isCloseMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const threshold = maxLen >= 8 ? 2 : 1;
  return dist <= threshold;
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
  reviewIssues: Array<{
    slipRowNumber: number;
    payerRankName: string;
    payerSurname: string;
    amount: number | null;
    reason: string;
  }>;
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
  const reviewIssues: AllocationResult["reviewIssues"] = [];

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
    // Only process pass fee and manual identified payments
    const allowedTypes = ["ค่าบัตรผ่านฯ", "ชำระแบบระบุรายการ"];
    if (slip.type && !allowedTypes.map(normalizeThai).includes(normalizeThai(slip.type))) {
      continue;
    }
    const amount = slip.amount;
    if (amount % FEE_PER_REQUEST !== 0) {
      needsReview++;
      reviewIssues.push({
        slipRowNumber: slip.rowNumber,
        payerRankName: slip.payerRankName,
        payerSurname: slip.payerSurname,
        amount: slip.amount,
        reason: "ยอดเงินไม่ลงตัวกับ 30 บาท/รายการ",
      });
      continue;
    }

    const k = amount / FEE_PER_REQUEST;
    const slipSurname = normalizeThai(slip.payerSurname);
    const slipFirstName = normalizeThai(extractFirstNameFromRankName(slip.payerRankName));
    if (!slipSurname || !slipFirstName) {
      needsReview++;
      reviewIssues.push({
        slipRowNumber: slip.rowNumber,
        payerRankName: slip.payerRankName,
        payerSurname: slip.payerSurname,
        amount: slip.amount,
        reason: "ชื่อ/นามสกุลในสลิปไม่ครบ",
      });
      continue;
    }

    // Find matching person keys
    const candidates: { key: string; rows: IndexRow[] }[] = [];

    // [OPTIMIZATION] Step 1: Try Exact Match first (O(1) lookup)
    // We already have byPersonKey keyed by "Normalize(First)|Normalize(Last)"
    // slipFirstName and slipSurname are already normalized.
    const directKey = slipFirstName + "|" + slipSurname;
    if (byPersonKey.has(directKey)) {
        candidates.push({ key: directKey, rows: byPersonKey.get(directKey)! });
    } else {
        // [OPTIMIZATION] Step 2: Fallback to partial/fuzzy match (O(N) search)
        // only if exact match failed.
        for (const [key, rows] of byPersonKey.entries()) {
            // key is "First|Last"
            const [first, last] = key.split("|");
            if (!first || !last) continue;
            
            // Reconstruct full normalized strings for comparison
            const indexFull = first + last;
            const slipFull = slipFirstName + slipSurname;
            
            // Check Last Name match (strict or partial)
            const lastMatch =
                last === slipSurname ||
                last.includes(slipSurname) ||
                slipSurname.includes(last) ||
                isCloseMatch(last, slipSurname);
                
            if (!lastMatch) continue; // Skip quickly if surname doesn't match

            // Check First Name match
            const firstMatch =
                first.includes(slipFirstName) ||
                slipFirstName.includes(first) ||
                isCloseMatch(first, slipFirstName);
            
            // Check Full string match
            const fullMatch =
                indexFull.includes(slipFull) ||
                slipFull.includes(indexFull) ||
                isCloseMatch(indexFull, slipFull);

            if (firstMatch || fullMatch) {
                candidates.push({ key, rows });
            }
        }
    }

    if (candidates.length === 0) {
      needsReview++;
      reviewIssues.push({
        slipRowNumber: slip.rowNumber,
        payerRankName: slip.payerRankName,
        payerSurname: slip.payerSurname,
        amount: slip.amount,
        reason: "ไม่พบชื่อที่ตรงในรายการขอ",
      });
      continue;
    }

    const rows =
      candidates.length === 1
        ? candidates[0]!.rows
        : candidates.flatMap((c) => c.rows);

    // Outstanding rows (exclude deleted/incorrect)
    const outstandingRows = rows
      .filter((r) => isOutstanding(r))
      .sort(
        (a, b) => parseRegisteredAtSortable(a.registeredAt) - parseRegisteredAtSortable(b.registeredAt)
      );

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
      });
    }
  }

  return {
    updates: [...updatesByRow.values()].sort((a, b) => a.rowNumber - b.rowNumber),
    summary: { processedSlips, allocatedRequests, needsReview },
    reviewIssues,
  };
}
