/**
 * อ่านข้อมูลจาก Google Sheets สำหรับฐานข้อมูลกำลังพล
 * แท็บ: รายชื่อกำลังพล (หลัก), index (เบอร์), bank (ธนาคาร+เลขบัญชี)
 */
import { listSpreadsheetTabs, readValues } from "./googleSheets";
import { config } from "./config";
import type { PersonnelDoc } from "./personnelDb";
import { personnelKey } from "./personnelDb";

const PERSONNEL_TAB = "รายชื่อกำลังพล";
const INDEX_TAB = "index";
const BANK_TAB = "bank";

function getCell(row: string[], idx: number): string {
  return (row[idx] ?? "").trim();
}

/**
 * อ่านรายชื่อหลักจากแท็บ "รายชื่อกำลังพล": คอลัมน์ A=ยศ, B=ชื่อ, C=สกุล
 * ถ้าแถวแรกเป็นหัวตาราง (มีคำว่า ยศ/ชื่อ/สกุล) จะข้ามแถวแรก
 */
async function readPersonnelList(spreadsheetId: string): Promise<{ rank: string; firstName: string; lastName: string }[]> {
  const values = await readValues({ spreadsheetId, range: `'${PERSONNEL_TAB}'!A:C` });
  const rows: { rank: string; firstName: string; lastName: string }[] = [];
  const headerLike = /^(ยศ|ชื่อ|สกุล|rank|name)$/i;
  let start = 0;
  if (
    values.length > 0 &&
    (headerLike.test(getCell(values[0]!, 0)) || headerLike.test(getCell(values[0]!, 1)))
  ) {
    start = 1;
  }
  for (let i = start; i < values.length; i++) {
    const r = values[i]!;
    const rank = getCell(r, 0);
    const firstName = getCell(r, 1);
    const lastName = getCell(r, 2);
    if (!rank && !firstName && !lastName) continue;
    rows.push({ rank, firstName, lastName });
  }
  return rows;
}

/**
 * อ่านเบอร์จากแท็บ "index": โครงสร้างเดียวกับ passSheets — B=ยศ, C=ชื่อ, D=สกุล, K=เบอร์ (A=วันที่ลงทะเบียน ฯลฯ)
 */
async function readIndexPhones(spreadsheetId: string): Promise<Map<string, string>> {
  const values = await readValues({ spreadsheetId, range: `'${INDEX_TAB}'!A2:O` });
  const map = new Map<string, string>();
  for (const r of values) {
    const rank = getCell(r, 1);
    const firstName = getCell(r, 2);
    const lastName = getCell(r, 3);
    const phone = getCell(r, 10);
    if (!rank && !firstName && !lastName) continue;
    const key = personnelKey(rank, firstName, lastName);
    if (phone) map.set(key, phone);
  }
  return map;
}

/**
 * อ่านธนาคาร+เลขบัญชีจากแท็บ "bank": A=ยศ, B=ชื่อ, C=สกุล, D=ธนาคาร, E=เลขที่บัญชี
 * ถ้าโครงต่าง (เช่น A=ชื่อเต็ม) สามารถปรับ range/คอลัมน์ในฟังก์ชันนี้
 */
async function readBankInfo(spreadsheetId: string): Promise<Map<string, { bank: string; accountNumber: string }>> {
  const values = await readValues({ spreadsheetId, range: `'${BANK_TAB}'!A:E` });
  const map = new Map<string, { bank: string; accountNumber: string }>();
  const headerLike = /^(ยศ|ชื่อ|สกุล|ธนาคาร|บัญชี|bank|account)$/i;
  let start = 0;
  if (values.length > 0) {
    const first = values[0]!;
    if (headerLike.test(getCell(first, 0)) || headerLike.test(getCell(first, 3))) start = 1;
  }
  for (let i = start; i < values.length; i++) {
    const r = values[i]!;
    const rank = getCell(r, 0);
    const firstName = getCell(r, 1);
    const lastName = getCell(r, 2);
    const bank = getCell(r, 3);
    const accountNumber = getCell(r, 4);
    if (!rank && !firstName && !lastName) continue;
    const key = personnelKey(rank, firstName, lastName);
    if (bank || accountNumber) map.set(key, { bank, accountNumber });
  }
  return map;
}

export type SyncPersonnelResult = {
  read: number;
  written: number;
  errors: string[];
};

/**
 * อ่าน 3 แท็บจากชีตฐานข้อมูลกำลังพล แล้วรวมเป็น PersonnelDoc[] พร้อมส่งลง Firestore
 */
export async function loadAndMergePersonnel(): Promise<PersonnelDoc[]> {
  const spreadsheetId = config.google.personnelSheetsId;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID or GOOGLE_SHEETS_ID_PERSONNEL is not set");

  const tabs = await listSpreadsheetTabs({ spreadsheetId });
  const hasPersonnel = tabs.some((t) => t.title.trim() === PERSONNEL_TAB);
  const hasIndex = tabs.some((t) => t.title.trim() === INDEX_TAB);
  const hasBank = tabs.some((t) => t.title.trim() === BANK_TAB);
  if (!hasPersonnel) throw new Error(`ไม่พบแท็บ "${PERSONNEL_TAB}" ในชีต`);
  if (!hasIndex) throw new Error(`ไม่พบแท็บ "${INDEX_TAB}" ในชีต`);
  if (!hasBank) throw new Error(`ไม่พบแท็บ "${BANK_TAB}" ในชีต`);

  const [list, phoneMap, bankMap] = await Promise.all([
    readPersonnelList(spreadsheetId),
    readIndexPhones(spreadsheetId),
    readBankInfo(spreadsheetId),
  ]);

  const docs: PersonnelDoc[] = list.map(({ rank, firstName, lastName }) => {
    const key = personnelKey(rank, firstName, lastName);
    const phone = phoneMap.get(key) ?? "";
    const bankInfo = bankMap.get(key) ?? { bank: "", accountNumber: "" };
    return {
      rank,
      firstName,
      lastName,
      phone,
      bank: bankInfo.bank,
      accountNumber: bankInfo.accountNumber,
      updatedAt: "",
    };
  });

  return docs;
}

/**
 * ซิงก์ฐานข้อมูลกำลังพลจาก Sheets → Firestore (เรียกจาก API หรือ script)
 */
export async function syncPersonnelToFirestore(): Promise<SyncPersonnelResult> {
  const errors: string[] = [];
  const docs = await loadAndMergePersonnel();
  const { setPersonnelBatch } = await import("./personnelDb");
  let written = 0;
  try {
    const result = await setPersonnelBatch(docs);
    written = result.written;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
  }
  return { read: docs.length, written, errors };
}
