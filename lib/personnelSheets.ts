/**
 * อ่านข้อมูลจาก Google Sheets สำหรับฐานข้อมูลกำลังพล
 * แท็บ: ข้อมูลกำลังพล (หลัก), เบอร์โทร (phone)
 */
import { listSpreadsheetTabs, readValues } from "./googleSheets";
import { config } from "./config";
import type { PersonnelDoc } from "./personnelDb";
import { personnelKeyByNameOnly } from "./personnelDb";

const PERSONNEL_TAB = "ข้อมูลกำลังพล";
const PHONE_TAB = "เบอร์โทร";

function getCell(row: string[], idx: number): string {
  return (row[idx] ?? "").trim();
}

/**
 * Get sheet name from gid by fetching spreadsheet metadata
 */
async function getSheetNameByGid(spreadsheetId: string, gid: number): Promise<string | null> {
  const tabs = await listSpreadsheetTabs({ spreadsheetId });
  const tab = tabs.find((t) => t.gid === gid);
  return tab?.title ?? null;
}

/**
 * อ่านข้อมูลกำลังพลจากแท็บ "ข้อมูลกำลังพล": 
 * A=ยศ, B=ชื่อ, C=นามสกุล, D=ธนาคาร, E=เลขบัญชี, F=หมายเลขประจำตัวประชาชน, G=หมายเลขทหาร,
 * H=ปฏิบัติหน้าที่, I=ตำแหน่งบรรจุ, J=เหล่า, K=กำเนิด, L=วันเกิด, M=วันขึ้นทะเบียน,
 * N=วันที่บรรจุ, O=วันที่ครองยศ, P=เงินเดือน(ปัจจุบัน), Q=อายุ, R=ปีเกษียณ
 */
async function readPersonnelList(spreadsheetId: string, personnelGid?: number): Promise<Omit<PersonnelDoc, "phone" | "updatedAt">[]> {
  let sheetName = PERSONNEL_TAB;
  if (personnelGid) {
    const name = await getSheetNameByGid(spreadsheetId, personnelGid);
    if (name) sheetName = name;
  }
  
  const values = await readValues({ spreadsheetId, range: `'${sheetName}'!A:R` });
  const rows: Omit<PersonnelDoc, "phone" | "updatedAt">[] = [];
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
    rows.push({
      rank,
      firstName,
      lastName,
      bank: getCell(r, 3),
      accountNumber: getCell(r, 4),
      citizenId: getCell(r, 5),
      militaryId: getCell(r, 6),
      duty: getCell(r, 7),
      position: getCell(r, 8),
      unit: getCell(r, 9),
      birthplace: getCell(r, 10),
      birthDate: getCell(r, 11),
      registeredDate: getCell(r, 12),
      enlistmentDate: getCell(r, 13),
      rankDate: getCell(r, 14),
      salary: getCell(r, 15),
      age: getCell(r, 16),
      retireYear: getCell(r, 17),
    });
  }
  return rows;
}

/**
 * อ่านเบอร์จากแท็บ "เบอร์โทร" หรือจาก GID ที่กำหนด — จับคู่ด้วย ชื่อ+สกุล
 * คาดว่า columns: A=ชื่อ, B=นามสกุล, C=เบอร์ (หรืออาจมี column อื่นนำหน้า)
 * พยายามหา column ที่มีเบอร์โทรจาก header หรือ pattern
 */
async function readPhoneNumbers(spreadsheetId: string, phoneGid?: number): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  
  // Determine sheet name
  let sheetName = PHONE_TAB;
  if (phoneGid) {
    const name = await getSheetNameByGid(spreadsheetId, phoneGid);
    if (name) sheetName = name;
  }

  // Try to read - first try with header, then without
  let values: string[][] = [];
  try {
    values = await readValues({ spreadsheetId, range: `'${sheetName}'!A:Z` });
  } catch (e) {
    console.log("[personnelSheets] Could not read phone sheet:", e);
    return map;
  }

  if (values.length === 0) return map;

  // Find header row and data start
  const headerRow = values[0]!;
  let startRow = 1;
  
  // Check if first row is header (contains keywords)
  const headerKeywords = /^(ชื่อ|นามสกุล|เบอร์|phone|mobile|name|surname)$/i;
  const hasHeader = headerKeywords.test(headerRow.join(" "));
  if (!hasHeader) {
    startRow = 0;
  }

  // Find column indices - try to find name and phone columns
  let nameCol = -1;
  let surnameCol = -1;
  let phoneCol = -1;

  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i]?.toLowerCase() ?? "";
    if (h.includes("ชื่อ") || h === "name" || h === "firstname") {
      if (nameCol === -1) nameCol = i;
    } else if (h.includes("นามสกุล") || h === "surname" || h === "lastname" || h === "สกุล") {
      surnameCol = i;
    } else if (h.includes("เบอร์") || h.includes("โทร") || h === "phone" || h === "mobile") {
      phoneCol = i;
    }
  }

  // If can't find by header, guess: A=name, B=surname, C=phone
  if (nameCol === -1) nameCol = 0;
  if (surnameCol === -1) surnameCol = 1;
  if (phoneCol === -1) phoneCol = 2;

  for (let i = startRow; i < values.length; i++) {
    const r = values[i]!;
    const firstName = getCell(r, nameCol);
    const lastName = getCell(r, surnameCol);
    const phone = getCell(r, phoneCol);
    
    if (!firstName && !lastName) continue;
    
    const key = personnelKeyByNameOnly(firstName, lastName);
    if (phone) map.set(key, phone);
  }

  return map;
}

export type SyncPersonnelResult = {
  read: number;
  written: number;
  errors: string[];
};

/**
 * อ่านข้อมูลกำลังพลและเบอร์จาก Sheets แล้วรวมเป็น PersonnelDoc[] พร้อมส่งลง Firestore
 */
export async function loadAndMergePersonnel(): Promise<PersonnelDoc[]> {
  const spreadsheetId = config.google.personnelSheetsId;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID or GOOGLE_SHEETS_ID_PERSONNEL is not set");

  const tabs = await listSpreadsheetTabs({ spreadsheetId });
  
  // Use configured GIDs or fall back to sheet names
  const personnelGid = config.google.personnelSheetGid;
  const phoneGid = config.google.phoneSheetGid;
  
  // Read personnel data from gid=908533993 (ข้อมูลบัตรผ่าน พล.ป.)
  // Read phone from gid=1143152346 (บัตรผ่านยานพาหนะ / index)

  const [list, phoneMap] = await Promise.all([
    readPersonnelList(spreadsheetId, personnelGid),
    readPhoneNumbers(spreadsheetId, phoneGid),
  ]);

  const docs: PersonnelDoc[] = list.map((person) => {
    const matchKey = personnelKeyByNameOnly(person.firstName, person.lastName);
    const phone = phoneMap.get(matchKey) ?? "";
    return {
      ...person,
      phone,
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
