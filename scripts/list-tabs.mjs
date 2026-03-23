import { listSpreadsheetTabs } from "./lib/googleSheets.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  try {
    console.log("Fetching tabs for spreadsheet:", process.env.GOOGLE_SHEETS_ID);
    const tabs = await listSpreadsheetTabs();
    console.log("Found tabs:");
    tabs.forEach(t => {
      console.log(`- Title: ${t.title}, GID: ${t.gid}`);
    });
  } catch (err) {
    console.error("Error fetching tabs:", err);
  }
}

main();
