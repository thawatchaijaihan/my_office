import {
  appendValues,
  batchUpdateValues,
  readValues,
  listSpreadsheetTabs,
} from "./googleSheets";
import { config } from "./config";

export const INDEX_SHEET_NAME = "index";
export const SLIP_SHEET_NAME = "slip";

// Cache for sheet names resolved from gids
let _sheetNameCache: Map<number, string> | null = null;

/**
 * Get sheet name from gid by fetching spreadsheet metadata
 */
async function getSheetNameByGid(gid: number): Promise<string | null> {
  if (!_sheetNameCache) {
    const tabs = await listSpreadsheetTabs();
    _sheetNameCache = new Map(tabs.map((t) => [t.gid, t.title]));
  }
  return _sheetNameCache.get(gid) ?? null;
}

/**
 * Resolve sheet name: use gid if configured, otherwise use default name
 */
async function resolveSheetName(params: {
  defaultName: string;
  gid?: number;
}): Promise<string> {
  if (params.gid !== undefined) {
    const name = await getSheetNameByGid(params.gid);
    if (!name) {
      throw new Error(`Sheet with gid=${params.gid} not found`);
    }
    return name;
  }
  return params.defaultName;
}

export type IndexRow = {
  rowNumber: number; // actual row number in sheet
  registeredAt: string;
  rank: string;
  firstName: string;
  lastName: string;
  requestFor: string;
  vehicleOwner: string;
  vehicleType: string;
  vehicleModel: string;
  vehicleColor: string;
  plate: string;
  phone: string;
  note: string;
  paymentStatus: string; // M - ชำระเงินแล้ว, ค้างชำระเงิน, ลบข้อมูล
  approvalStatus: string; // N - รออนุมัติจาก..., ข้อมูลไม่ถูกต้อง, etc.
  checkedAt: string; // O
};

export type SlipRow = {
  rowNumber: number;
  timestamp: string;
  payerRankName: string;
  payerSurname: string;
  amount: number | null;
  type: string;
  transferDate: string;
};

function getCell(row: string[], idx: number): string {
  return (row[idx] ?? "").trim();
}

const LOG = (msg: string, ...args: unknown[]) => console.log("[passSheets]", msg, ...args);

export async function readIndexRows(): Promise<IndexRow[]> {
  const t0 = Date.now();
  LOG("readIndexRows เริ่ม");
  const sheetName = await resolveSheetName({
    defaultName: INDEX_SHEET_NAME,
    gid: config.google.indexSheetGid,
  });
  LOG("resolveSheetName เสร็จ แท็บ:", sheetName, "ใช้เวลา", Date.now() - t0, "ms");
  const t1 = Date.now();
  const values = await readValues({ range: `${sheetName}!A2:O` });
  LOG("readValues เสร็จ ได้", values.length, "แถว ใช้เวลา", Date.now() - t1, "ms");
  const rows: IndexRow[] = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i]!;
    const rowNumber = i + 2;
    // Skip blank rows
    if (r.every((c) => !String(c ?? "").trim())) continue;
    rows.push({
      rowNumber,
      registeredAt: getCell(r, 0),
      rank: getCell(r, 1),
      firstName: getCell(r, 2),
      lastName: getCell(r, 3),
      requestFor: getCell(r, 4),
      vehicleOwner: getCell(r, 5),
      vehicleType: getCell(r, 6),
      vehicleModel: getCell(r, 7),
      vehicleColor: getCell(r, 8),
      plate: getCell(r, 9),
      phone: getCell(r, 10),
      note: getCell(r, 11),
      paymentStatus: getCell(r, 12), // M
      approvalStatus: getCell(r, 13), // N
      checkedAt: getCell(r, 14), // O
    });
  }
  return rows;
}

export async function readSlipRows(): Promise<SlipRow[]> {
  const sheetName = await resolveSheetName({
    defaultName: SLIP_SHEET_NAME,
    gid: config.google.slipSheetGid,
  });
  const values = await readValues({ range: `${sheetName}!A2:F` });
  const rows: SlipRow[] = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i]!;
    const rowNumber = i + 2;
    if (r.every((c) => !String(c ?? "").trim())) continue;
    const amountRaw = getCell(r, 3);
    const amount = amountRaw ? Number(amountRaw.replace(/,/g, "")) : null;
    rows.push({
      rowNumber,
      timestamp: getCell(r, 0),
      payerRankName: getCell(r, 1),
      payerSurname: getCell(r, 2),
      amount: Number.isFinite(amount as number) ? (amount as number) : null,
      type: getCell(r, 4),
      transferDate: getCell(r, 5),
    });
  }
  return rows;
}

export type IndexUpdateMR = {
  rowNumber: number;
  paymentStatus: string; // M - ชำระเงินแล้ว, ค้างชำระเงิน, ลบข้อมูล
  approvalStatus: string; // N - keep existing value
  checkedAt: string; // O
};

export async function writeIndexUpdatesMR(updates: IndexUpdateMR[]) {
  const sheetName = await resolveSheetName({
    defaultName: INDEX_SHEET_NAME,
    gid: config.google.indexSheetGid,
  });
  await batchUpdateValues({
    updates: updates.map((u) => ({
      range: `${sheetName}!M${u.rowNumber}:O${u.rowNumber}`,
      values: [[u.paymentStatus, u.approvalStatus, u.checkedAt]],
    })),
  });
}

export async function appendSlipRow(params: {
  timestamp: string;
  rankName: string;
  surname: string;
  amount: number;
  type?: string;
  transferDate: string;
}) {
  const sheetName = await resolveSheetName({
    defaultName: SLIP_SHEET_NAME,
    gid: config.google.slipSheetGid,
  });
  await appendValues({
    range: `${sheetName}!A:F`,
    values: [
      [
        params.timestamp,
        params.rankName,
        params.surname,
        params.amount,
        params.type ?? "ค่าบัตรผ่านฯ",
        params.transferDate,
      ],
    ],
  });
}

