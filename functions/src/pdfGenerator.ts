interface Camera {
  id: string;
  name: string;
  type: string;
  description?: string;
  lastCheckedImage?: string;
  lastCheckedAt?: string;
}

const toThaiNumerals = (text: string) => {
  const thaiNumerals = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
  return text.replace(/[0-9]/g, (digit) => thaiNumerals[parseInt(digit)]);
};

const isCameraCheckedInCurrentHalf = (camera: Camera): boolean => {
  if (!camera.lastCheckedAt) return false;

  const now = new Date();
  const checkedDate = new Date(camera.lastCheckedAt);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const checkedMonth = checkedDate.getMonth();
  const checkedYear = checkedDate.getFullYear();

  if (currentYear !== checkedYear || currentMonth !== checkedMonth) {
    return false;
  }

  const currentDay = now.getDate();
  const checkedDay = checkedDate.getDate();

  if (currentDay <= 15) {
    return checkedDay <= 15;
  } else {
    return checkedDay > 15;
  }
};

export async function generatePdfWithPuppeteer(
  cameras: Camera[]
): Promise<Buffer> {
  // Dynamic import to speed up cold starts for other functions
  const { default: puppeteer } = await import("puppeteer-core");
  const { default: chromium } = await import("@sparticuz/chromium");

  console.log("[PDF Puppeteer] Starting PDF generation...");
  console.log("[PDF Puppeteer] Total cameras:", cameras.length);
  
  // ... rest of the filter logic ...

  const camerasWithImages = cameras.filter(
    (c) => c.lastCheckedImage && isCameraCheckedInCurrentHalf(c)
  );

  console.log("[PDF Puppeteer] Cameras with images:", camerasWithImages.length);

  if (camerasWithImages.length === 0) {
    throw new Error("No cameras with images found");
  }

  // Group by type
  const grouped: Record<string, Camera[]> = {};
  camerasWithImages.forEach((camera) => {
    if (!grouped[camera.type]) grouped[camera.type] = [];
    grouped[camera.type].push(camera);
  });

  console.log("[PDF Puppeteer] Groups:", Object.keys(grouped));

  const browser = await puppeteer.launch({
    args: [...(chromium as any).args, "--hide-scrollbars", "--disable-web-security"],
    defaultViewport: (chromium as any).defaultViewport || { width: 794, height: 1123 },
    executablePath: await (chromium as any).executablePath(),
    headless: (chromium as any).headless === "shell" ? "shell" : true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 }); // A4 size in pixels at 96 DPI

    const imagesPerPage = 12;
    const pdfPages: string[] = [];

    for (const [type, groupCameras] of Object.entries(grouped)) {
      console.log(`[PDF Puppeteer] Processing type: ${type}`);

      for (let i = 0; i < groupCameras.length; i += imagesPerPage) {
        const pageCameras = groupCameras.slice(i, i + imagesPerPage);
        console.log(`[PDF Puppeteer] Page with ${pageCameras.length} cameras`);

        const displayType = type.replace(/ร้อย\.(\d+)/, "ร้อย.ป.ที่ $1");

        const html = generatePageHtml(pageCameras, displayType);
        pdfPages.push(html);
      }
    }

    // Generate PDF from all pages
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          /* Use system fonts to avoid network delays */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Sarabun', 'TH Sarabun New', 'Helvetica', 'Arial', sans-serif;
            background: white;
            -webkit-print-color-adjust: exact;
          }
          
          .page {
            width: 210mm;
            height: 297mm;
            padding: 10mm;
            page-break-after: always;
            position: relative;
            background: white;
          }
          
          .page:last-child {
            page-break-after: auto;
          }
          
          .header {
            text-align: center;
            margin-bottom: 8mm;
            font-weight: bold;
            font-size: 20pt;
            line-height: 1.1;
          }
          
          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(4, 1fr);
            gap: 5mm;
            width: 100%;
            height: 195mm;
          }
          
          .cell {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            border: 1px solid #ccc;
            overflow: hidden;
            background: #eee;
          }
          
          .cell img {
            width: 100%;
            height: 50mm;
            object-fit: cover;
            display: block;
          }
          
          .label {
            position: absolute;
            bottom: 12px;
            left: 0;
            right: 0;
            font-size: 12pt;
            font-weight: bold;
            text-align: center;
            color: white;
            text-shadow: 0 0 3px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.6);
            line-height: 1;
            z-index: 10;
          }
          
          .footer {
            margin-top: 8mm;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            font-size: 16pt;
            line-height: 1.2;
            padding-right: 28mm;
          }
          
          .sig-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1mm;
          }
          
          .invisible {
            color: transparent;
          }
        </style>
      </head>
      <body>
        ${pdfPages.join("\n")}
      </body>
      </html>
    `;

    console.log("[PDF Puppeteer] Setting page content...");
    await page.setContent(fullHtml, { 
      waitUntil: "domcontentloaded",
      timeout: 60000 // 60s timeout for setting content
    });

    // Give images a bit of time to load even if network isn't fully idle
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log("[PDF Puppeteer] Generating PDF buffer...");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    });

    console.log("[PDF Puppeteer] PDF generated, size:", pdfBuffer.length);
    return Buffer.from(pdfBuffer);
  } finally {
    console.log("[PDF Puppeteer] Closing browser");
    await browser.close();
  }
}

function generatePageHtml(cameras: Camera[], displayType: string): string {
  const cells = cameras
    .map((camera) => {
      const nameThai = toThaiNumerals(camera.name);
      const descThai = camera.description
        ? toThaiNumerals(camera.description)
        : "";
      const label = `${nameThai}${descThai ? ` : ${descThai}` : ""}`;

      return `
      <div class="cell">
        <img src="${camera.lastCheckedImage}" alt="${camera.name}" />
        <div class="label">${label}</div>
      </div>
    `;
    })
    .join("\n");

  return `
    <div class="page">
      <div class="header">
        <div>ภาพจากระบบกล้องวงจรปิดภายในเขตรับผิดชอบ</div>
        <div>${toThaiNumerals(`หน่วย ${displayType}`)}</div>
      </div>
      
      <div class="grid">
        ${cells}
      </div>
      
      <div class="footer">
        <div class="sig-container">
          <div>ตรวจถูกต้อง<span class="invisible">-------------------------------------</span></div>
          <div>ร.ต.<span class="invisible">-------------------------</span></div>
          <div>( ชัยชนะ  ศรีเชื้อ )</div>
          <div>นชง.ป.๗๑ พัน.๗๑๓ ปฏิบัติหน้าที่</div>
          <div>ฝอ.๒ ป.๗๑ พัน.๗๑๓</div>
        </div>
      </div>
    </div>
  `;
}
