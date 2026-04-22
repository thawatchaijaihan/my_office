/**
 * Environment configuration
 * ค่าจะถูก validate ตอน runtime ใน webhook
 */

function getEnv(key: string): string {
  return (process.env[key] ?? "").trim();
}

const DEFAULT_MY_OFFICE_GOOGLE_SHEETS_ID =
  "19PDcY3p7ouSpnU9Fgp9qoW-LBN39AgQYgUUizDXUbVo";
const DEFAULT_MY_OFFICE_INDEX_SHEET_GID = 1143152346;
const DEFAULT_MY_OFFICE_PHONE_SHEET_GID = 1143152346;
const DEFAULT_MY_OFFICE_PERSONNEL_SHEET_GID = 908533993;

export const config = {
// Telegram settings removed
  admin: {
    apiKey: getEnv("ADMIN_API_KEY"),
    /** โฮสต์ที่เข้าแดชบอร์ดได้โดยไม่ต้องใส่ key (คั่นด้วย comma) เช่น โฮสต์จาก app hosting */
    allowedDashboardHosts: (process.env.ALLOWED_DASHBOARD_HOSTS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    /** อีเมลหรือ UID ที่เข้าแดชบอร์ดได้ผ่าน Firebase Auth (คั่นด้วย comma) */
    firebaseEmails: (process.env.ADMIN_FIREBASE_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    firebaseUids: (process.env.ADMIN_FIREBASE_UIDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    /** อีเมลคนเดียวที่เห็นเมนู "อนุมัติการเข้าถึง" และมีสิทธิ์อนุมัติ (ใช้ NEXT_PUBLIC_DASHBOARD_APPROVER_EMAIL) */
    dashboardApproverEmail: (process.env.NEXT_PUBLIC_DASHBOARD_APPROVER_EMAIL ?? "").trim().toLowerCase(),
  },
  google: {
    serviceAccountKeyBase64: getEnv("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64"),
    sheetsId: getEnv("GOOGLE_SHEETS_ID") || DEFAULT_MY_OFFICE_GOOGLE_SHEETS_ID,
    /** ชีต "ฐานข้อมูลกำลังพล" (index + รายชื่อกำลังพล + bank). ถ้าไม่ตั้ง ใช้ GOOGLE_SHEETS_ID */
    personnelSheetsId:
      getEnv("GOOGLE_SHEETS_ID_PERSONNEL") ||
      getEnv("GOOGLE_SHEETS_ID") ||
      DEFAULT_MY_OFFICE_GOOGLE_SHEETS_ID,
    indexSheetGid: process.env.INDEX_SHEET_GID
      ? Number(process.env.INDEX_SHEET_GID.trim())
      : DEFAULT_MY_OFFICE_INDEX_SHEET_GID,
    slipSheetGid: process.env.SLIP_SHEET_GID
      ? Number(process.env.SLIP_SHEET_GID.trim())
      : undefined,
    /** GID สำหรับแท็บเบอร์โทรศัพท์ (ถ้ามี) */
    phoneSheetGid: process.env.PHONE_SHEET_GID
      ? Number(process.env.PHONE_SHEET_GID.trim())
      : DEFAULT_MY_OFFICE_PHONE_SHEET_GID,
    /** GID สำหรับแท็บข้อมูลกำลังพล */
    personnelSheetGid: process.env.PERSONNEL_SHEET_GID
      ? Number(process.env.PERSONNEL_SHEET_GID.trim())
      : DEFAULT_MY_OFFICE_PERSONNEL_SHEET_GID,
  },
// Gemini settings removed
  rag: {
    /** path เทียบกับ project root เช่น content/knowledge.md ถ้าว่างหรือ "inline" ใช้เนื้อหาใน code */
    knowledgePath: getEnv("RAG_KNOWLEDGE_PATH") || "content/knowledge.md",
  },
} as const;
