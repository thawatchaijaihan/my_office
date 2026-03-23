const { google } = require("googleapis");
const { Buffer } = require("buffer");

const b64 = process.argv[2];
const spreadsheetId = process.argv[3];

if (!b64 || !spreadsheetId) {
  console.error("Usage: node list-tabs-standalone.js <b64_key> <spreadsheet_id>");
  process.exit(1);
}

try {
  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  const auth = new google.auth.JWT({
    email: json.client_email,
    key: json.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  }).then(res => {
    console.log("Success! Found tabs:");
    res.data.sheets.forEach(s => {
      console.log(`- Title: ${s.properties.title}, GID: ${s.properties.sheetId}`);
    });
  }).catch(err => {
    console.error("API Error:", err.message);
    if (err.response) console.error("Details:", err.response.data);
  });
} catch (err) {
  console.error("Error:", err.message);
}
