import { appendValues, batchUpdateValues, readValues } from "./googleSheets";

export const INDEX_SHEET_NAME = "index";
export const SLIP_SHEET_NAME = "slip";

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
  slipFirstName: string; // P
  slipLastName: string; // Q
  slipAmount: string; // R
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

export async function readIndexRows(): Promise<IndexRow[]> {
  const values = await readValues({ range: `${INDEX_SHEET_NAME}!A2:R` });
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
      checkedAt: getCell(r, 14),
      slipFirstName: getCell(r, 15),
      slipLastName: getCell(r, 16),
      slipAmount: getCell(r, 17),
    });
  }
  return rows;
}

export async function readSlipRows(): Promise<SlipRow[]> {
  const values = await readValues({ range: `${SLIP_SHEET_NAME}!A2:F` });
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
  slipFirstName: string; // P
  slipLastName: string; // Q
  slipAmount: string; // R
};

export async function writeIndexUpdatesMR(updates: IndexUpdateMR[]) {
  await batchUpdateValues({
    updates: updates.map((u) => ({
      range: `${INDEX_SHEET_NAME}!M${u.rowNumber}:R${u.rowNumber}`,
      values: [
        [
          u.paymentStatus,
          u.approvalStatus,
          u.checkedAt,
          u.slipFirstName,
          u.slipLastName,
          u.slipAmount,
        ],
      ],
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
  await appendValues({
    range: `${SLIP_SHEET_NAME}!A:F`,
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

