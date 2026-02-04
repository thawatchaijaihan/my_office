import { google } from "googleapis";
import { config } from "./config";

type ServiceAccountKey = {
  client_email?: string;
  private_key?: string;
};

function loadServiceAccountKey(): ServiceAccountKey {
  const b64 = config.google.serviceAccountKeyBase64;
  if (!b64) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not set");
  }

  let raw: string;
  try {
    raw = Buffer.from(b64, "base64").toString("utf8");
  } catch {
    throw new Error("Invalid base64 in GOOGLE_SERVICE_ACCOUNT_KEY_BASE64");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not valid JSON");
  }

  return parsed as ServiceAccountKey;
}

function getSheetsClient(params?: { readOnly?: boolean }) {
  const key = loadServiceAccountKey();
  if (!key.client_email || !key.private_key) {
    throw new Error("Service account key is missing client_email/private_key");
  }

  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [
      params?.readOnly === false
        ? "https://www.googleapis.com/auth/spreadsheets"
        : "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  });

  return google.sheets({ version: "v4", auth });
}

export type GoogleSheetTab = {
  title: string;
  gid: number;
  index?: number;
  hidden?: boolean;
};

/**
 * List all tabs/sheets in a spreadsheet.
 * - `gid` in URL == `sheetId` from API
 */
export async function listSpreadsheetTabs(params?: {
  spreadsheetId?: string;
}): Promise<GoogleSheetTab[]> {
  const spreadsheetId = params?.spreadsheetId || config.google.sheetsId;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not set");

  const sheets = getSheetsClient({ readOnly: true });
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,index,hidden))",
  });

  const tabs: GoogleSheetTab[] = [];
  for (const s of res.data.sheets ?? []) {
    const p = s.properties;
    if (!p?.sheetId || !p.title) continue;
    tabs.push({
      title: p.title,
      gid: p.sheetId,
      index: p.index ?? undefined,
      hidden: p.hidden ?? undefined,
    });
  }

  return tabs;
}

/**
 * Helper: extract spreadsheetId from full Google Sheets URL.
 */
export function parseSpreadsheetId(input: string): string | null {
  const m = input.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m?.[1] ?? null;
}

export async function readValues(params: {
  range: string;
  spreadsheetId?: string;
}): Promise<string[][]> {
  const spreadsheetId = params.spreadsheetId || config.google.sheetsId;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not set");

  const sheets = getSheetsClient({ readOnly: true });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: params.range,
  });
  const values = (res.data.values ?? []) as unknown[][];
  return values.map((r) => r.map((c) => String(c ?? "")));
}

export async function batchUpdateValues(params: {
  spreadsheetId?: string;
  updates: Array<{ range: string; values: (string | number | null)[][] }>;
  valueInputOption?: "RAW" | "USER_ENTERED";
}): Promise<void> {
  const spreadsheetId = params.spreadsheetId || config.google.sheetsId;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not set");
  if (params.updates.length === 0) return;

  const sheets = getSheetsClient({ readOnly: false });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: params.valueInputOption ?? "USER_ENTERED",
      data: params.updates.map((u) => ({
        range: u.range,
        values: u.values,
      })),
    },
  });
}

export async function appendValues(params: {
  spreadsheetId?: string;
  range: string;
  values: (string | number | null)[][];
  valueInputOption?: "RAW" | "USER_ENTERED";
}): Promise<void> {
  const spreadsheetId = params.spreadsheetId || config.google.sheetsId;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not set");
  if (params.values.length === 0) return;

  const sheets = getSheetsClient({ readOnly: false });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: params.range,
    valueInputOption: params.valueInputOption ?? "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: params.values },
  });
}

