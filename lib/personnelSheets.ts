/**
 * อ่านข้อมูลจาก Google Sheets สำหรับฐานข้อมูลกำลังพล
 * แท็บ: ข้อมูลกำลังพล (หลัก), เบอร์โทร (phone)
 */
import { listSpreadsheetTabs, readValues } from "./googleSheets";
import { config } from "./config";
import type { PersonnelDoc } from "./personnelDb";
import { personnelKeyByNameOnly } from "./personnelDb";

const PERSONNEL_TAB = "personnel";
const PHONE_TAB = "dashboard";

function getCell(row: string[], idx: number): string {
  return (row[idx] ?? "").trim();
}

/**
 * Get sheet name from gid by fetching spreadsheet metadata
 */
async function getSheetNameByGid(spreadsheetId: string, gid: number): Promise<string | null> {
  try {
    const tabs = await listSpreadsheetTabs({ spreadsheetId });
    const tab = tabs.find((t) => t.gid === gid);
    if (!tab) {
      console.warn(`[personnelSheets] GID ${gid} not found in spreadsheet ${spreadsheetId}`);
      return null;
    }
    console.log(`[personnelSheets] Resolved GID ${gid} to tab name: "${tab.title}"`);
    return tab.title;
  } catch (e) {
    console.error(`[personnelSheets] Error fetching tab name for GID ${gid}:`, e);
    return null;
  }
}

/**
 * อ่านข้อมูลกำลังพลจากแท็บ "ข้อมูลกำลังพล": 
 * A=ยศ, B=ชื่อ, C=นามสกุล, D=ธนาคาร, E=เลขบัญชี, F=หมายเลขประจำตัวประชาชน, G=หมายเลขทหาร,
 * H=ปฏิบัติหน้าที่, I=ตำแหน่งบรรจุ, J=เหล่า, K=กำเนิด, L=วันเกิด, M=วันขึ้นทะเบียน,
 * N=วันที่บรรจุ, O=วันที่ครองยศ, P=เงินเดือน(ปัจจุบัน), Q=อายุ, R=ปีเกษียณ
 */
async function readPersonnelList(spreadsheetId: string, personnelGid?: number): Promise<Omit<PersonnelDoc, "updatedAt">[]> {
  let sheetName = PERSONNEL_TAB;
  if (personnelGid) {
    const name = await getSheetNameByGid(spreadsheetId, personnelGid);
    if (name) sheetName = name;
  }
  
  const values = await readValues({ spreadsheetId, range: `'${sheetName}'!A:R` });
  console.log(`[personnelSheets] Read ${values.length} rows from tab: "${sheetName}"`);
  const rows: Omit<PersonnelDoc, "updatedAt">[] = [];
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
      phone: getCell(r, 3),            // [3] เบอร์โทร
      bank: getCell(r, 4),             // [4] ธนาคาร
      accountNumber: getCell(r, 5),    // [5] เลขบัญชี
      citizenId: getCell(r, 6),        // [6] เลขประชาชน
      militaryId: getCell(r, 7),       // [7] เลขทหาร
      duty: getCell(r, 8),             // [8] ปฏิบัติหน้าที่
      position: getCell(r, 9),         // [9] ตำแหน่งบรรจุ
      unit: getCell(r, 10),            // [10] เหล่า
      birthplace: getCell(r, 11),      // [11] กำเนิด
      birthDate: getCell(r, 12),       // [12] วันเกิด
      registeredDate: getCell(r, 13),  // [13] วันขึ้นทะเบียน
      enlistmentDate: getCell(r, 14),  // [14] วันบรรจุ
      rankDate: getCell(r, 15),        // [15] วันครองยศ
      salary: getCell(r, 16),          // [16] เงินเดือน
      age: getCell(r, 17),             // [17] อายุ
      retireYear: getCell(r, 18),      // [18] ปีเกษียณ
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
  
  // Find column indices - try to find name and phone columns
  let nameCol = -1;
  let surnameCol = -1;
  let phoneCol = -1;

  for (let i = 0; i < headerRow.length; i++) {
    const h = (headerRow[i] ?? "").toLowerCase().trim();
    if (!h) continue;

    if (h === "ชื่อ" || h === "name" || h === "firstname") {
      if (nameCol === -1) nameCol = i;
    } else if (h.includes("นามสกุล") || h.includes("สกุล") || h === "surname" || h === "lastname") {
      if (surnameCol === -1) surnameCol = i;
    } else if (h.includes("เบอร์") || h.includes("โทร") || h === "phone" || h === "mobile") {
      if (phoneCol === -1) phoneCol = i;
    }
  }

  // Fallback map specifically for 'dashboard' tab structure if headers are weird
  if (sheetName === "dashboard") {
    if (nameCol === -1) nameCol = 2;    // C
    if (surnameCol === -1) surnameCol = 3; // D
    if (phoneCol === -1) phoneCol = 10;   // K
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
    // Prefer phone from personnel list, fallback to phone tab map
    const phone = person.phone || phoneMap.get(matchKey) || "";
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
