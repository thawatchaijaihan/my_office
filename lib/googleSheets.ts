import { google } from "googleapis";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { config } from "./config";
import { withRetry } from "./retry";
import { logger } from "./logger";

type ServiceAccountKey = {
  client_email?: string;
  private_key?: string;
};

function formatGoogleApiError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }
  const anyErr = err as Error & {
    code?: number;
    response?: { status?: number; data?: unknown };
  };
  const status = anyErr.response?.status ?? anyErr.code;
  const payload =
    typeof anyErr.response?.data === "string"
      ? anyErr.response?.data
      : JSON.stringify(anyErr.response?.data ?? "");
  return status
    ? `${anyErr.message} (status=${status}) ${payload}`
    : `${anyErr.message} ${payload}`;
}

function logSheetsError(params: {
  operation: string;
  spreadsheetId?: string;
  range?: string;
  error: unknown;
}) {
  const meta = [
    params.spreadsheetId ? `spreadsheetId=${params.spreadsheetId}` : undefined,
    params.range ? `range=${params.range}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  logger.error({
    message: `Google Sheets API error: ${params.operation}${
      meta ? ` (${meta})` : ""
    }`,
    error: formatGoogleApiError(params.error),
    stack: params.error instanceof Error ? params.error.stack : undefined,
  });
}

function loadServiceAccountKey(): ServiceAccountKey {
  const b64 = config.google.serviceAccountKeyBase64;
  if (b64) {
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

  const serviceAccountPath = join(process.cwd(), "service-account.json");
  if (!existsSync(serviceAccountPath)) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not set and service-account.json was not found"
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  } catch {
    throw new Error("service-account.json is not valid JSON");
  }

  return parsed as ServiceAccountKey;
}

// Module-level cache for the auth clients
let cachedReadOnlyClient: ReturnType<typeof google.sheets> | null = null;
let cachedReadWriteClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient(params?: { readOnly?: boolean }) {
  const isReadOnly = params?.readOnly !== false;

  // Return cached client if available
  if (isReadOnly && cachedReadOnlyClient) return cachedReadOnlyClient;
  if (!isReadOnly && cachedReadWriteClient) return cachedReadWriteClient;

  const key = loadServiceAccountKey();
  if (!key.client_email || !key.private_key) {
    throw new Error("Service account key is missing client_email/private_key");
  }

  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [
      isReadOnly
        ? "https://www.googleapis.com/auth/spreadsheets.readonly"
        : "https://www.googleapis.com/auth/spreadsheets",
    ],
  });

  const client = google.sheets({ version: "v4", auth });
  if (isReadOnly) {
    cachedReadOnlyClient = client;
  } else {
    cachedReadWriteClient = client;
  }
  return client;
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
  let res;
  try {
    res = await withRetry(() =>
      sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets(properties(sheetId,title,index,hidden))",
      })
    );
  } catch (err) {
    logSheetsError({ operation: "spreadsheets.get", spreadsheetId, error: err });
    throw err;
  }

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
  let res;
  try {
    res = await withRetry(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: params.range,
      })
    );
  } catch (err) {
    logSheetsError({
      operation: "spreadsheets.values.get",
      spreadsheetId,
      range: params.range,
      error: err,
    });
    throw err;
  }
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
  try {
    await withRetry(() =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: params.valueInputOption ?? "USER_ENTERED",
          data: params.updates.map((u) => ({
            range: u.range,
            values: u.values,
          })),
        },
      })
    );
  } catch (err) {
    logSheetsError({
      operation: "spreadsheets.values.batchUpdate",
      spreadsheetId,
      range: params.updates[0]?.range,
      error: err,
    });
    throw err;
  }
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
  try {
    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId,
        range: params.range,
        valueInputOption: params.valueInputOption ?? "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: params.values },
      })
    );
  } catch (err) {
    logSheetsError({
      operation: "spreadsheets.values.append",
      spreadsheetId,
      range: params.range,
      error: err,
    });
    throw err;
  }
}

