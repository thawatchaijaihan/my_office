import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Camera } from "../data/types";

type CameraWithCheck = Camera & {
  lastCheckedAt?: string;
  lastCheckedImage?: string;
};

// Simple type for image cache - only needs image URL
type ImageCacheKey = {
  lastCheckedImage?: string;
};

const toThaiNumerals = (text: string) => {
  const thaiNumerals = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
  return text.replace(/[0-9]/g, (digit) => thaiNumerals[parseInt(digit)]);
};

// Cache keys
const IMAGE_CACHE_PREFIX = 'pdf_img_cache_';
const PDF_CACHE_KEY = 'pdf_full_cache';

interface PdfCacheData {
  url: string;
  timestamp: number;
}

interface ImageCacheItem {
  base64: string;
  timestamp: number;
}

interface PdfCacheItem {
  pdfUrl: string;
  imageSignatures: Record<string, string>; // cameraId -> image signature (URL + lastCheckedAt)
  timestamp: number;
}

// Get image signature for caching (URL + lastCheckedAt)
const getImageSignature = (camera: CameraWithCheck): string => {
  return `${camera.lastCheckedImage}_${camera.lastCheckedAt || ''}`;
};

// Get all image signatures as a unique key
const getPdfSignature = (cameras: CameraWithCheck[]): string => {
  const signatures = cameras
    .filter(c => c.lastCheckedImage)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(c => getImageSignature(c))
    .join('|');
  return signatures;
};

// Get cached PDF - no expiry, only invalidates when images change
const getCachedPdf = (): string | null => {
  try {
    const cached = localStorage.getItem(PDF_CACHE_KEY);
    if (!cached) return null;

    const cacheData: PdfCacheItem = JSON.parse(cached);
    console.log('[PDF Cache] Found cached PDF');
    return cacheData.pdfUrl;
  } catch (e) {
    console.error('[PDF Cache] Error reading PDF cache:', e);
    return null;
  }
};

// Save PDF to cache
const savePdfToCache = (pdfUrl: string, cameras: CameraWithCheck[]) => {
  try {
    const signatures = cameras
      .filter(c => c.lastCheckedImage)
      .reduce((acc, c) => {
        acc[c.id] = getImageSignature(c);
        return acc;
      }, {} as Record<string, string>);

    const cacheData: PdfCacheItem = {
      pdfUrl,
      imageSignatures: signatures,
      timestamp: Date.now()
    };
    localStorage.setItem(PDF_CACHE_KEY, JSON.stringify(cacheData));
    console.log('[PDF Cache] Saved PDF to cache');
  } catch (e) {
    console.error('[PDF Cache] Error saving PDF cache:', e);
  }
};

// Check if all images are the same as cached
const checkImagesUnchanged = (cameras: CameraWithCheck[]): boolean => {
  try {
    const cached = localStorage.getItem(PDF_CACHE_KEY);
    if (!cached) return false;

    const cacheData: PdfCacheItem = JSON.parse(cached);

    // Check each camera's image signature
    for (const camera of cameras) {
      if (camera.lastCheckedImage) {
        const currentSig = getImageSignature(camera);
        const cachedSig = cacheData.imageSignatures[camera.id];

        if (!cachedSig || currentSig !== cachedSig) {
          console.log('[PDF Cache] Image changed:', camera.id);
          return false;
        }
      }
    }

    console.log('[PDF Cache] All images unchanged');
    return true;
  } catch (e) {
    console.error('[PDF Cache] Error checking images:', e);
    return false;
  }
};

// Get cached image base64 - no expiry, only invalidates when image URL changes
const getCachedImage = (camera: ImageCacheKey): string | null => {
  try {
    // ใช้ string replacement ง่ายๆ แทน btoa เพื่อป้องกันปัญหาตัวอักษรพิเศษและ collision
    const safeUrl = (camera.lastCheckedImage || '').replace(/[^a-zA-Z0-9]/g, '').slice(-60);
    const cacheKey = IMAGE_CACHE_PREFIX + safeUrl;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const cacheData: ImageCacheItem = JSON.parse(cached);
    return cacheData.base64;
  } catch (e) {
    return null;
  }
};

// Save image to cache
const saveImageToCache = (camera: ImageCacheKey, base64: string) => {
  try {
    const safeUrl = (camera.lastCheckedImage || '').replace(/[^a-zA-Z0-9]/g, '').slice(-60);
    const cacheKey = IMAGE_CACHE_PREFIX + safeUrl;
    const cacheData: ImageCacheItem = {
      base64,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (e) {
    console.error('[PDF Cache] Error saving image cache:', e);
  }
};

export const generateCctvReport = async (
  cameras: CameraWithCheck[],
): Promise<Blob | null> => {
  const imagesPerPage = 12;

  console.log('[PDF] เริ่มสร้าง PDF');
  console.log('[PDF] กล้องทั้งหมด:', cameras.length);

  // Filter cameras that have images
  const camerasWithImages = cameras.filter(c => c.lastCheckedImage);

  console.log('[PDF] กล้องที่มีรูป:', camerasWithImages.length);

  if (camerasWithImages.length === 0) {
    alert("ไม่มีรูปภาพกล้องที่ตรวจสอบแล้วสำหรับออกรายงาน");
    return null;
  }

  // Check if all images are unchanged - if so, we don't need to regenerate
  // But we return null here and let the caller handle using cached PDF URL
  // This is a check function, not the full generation

  const grouped: Record<string, CameraWithCheck[]> = {};
  camerasWithImages.forEach(camera => {
    if (!grouped[camera.type]) grouped[camera.type] = [];
    grouped[camera.type].push(camera);
  });

  console.log('[PDF] จัดกลุ่มตามประเภท:', Object.keys(grouped));
  Object.entries(grouped).forEach(([type, cams]) => {
    console.log(`[PDF]   ${type}: ${cams.length} กล้อง`);
  });

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Create a hidden container
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.backgroundColor = "white";
  container.style.padding = "20mm 20mm 15mm 25mm"; // Margins: Top 20, Right 20, Bottom 15, Left 25 (approx for government style)
  container.style.fontFamily = "'TH Sarabun New', sans-serif";
  container.style.boxSizing = "border-box";
  document.body.appendChild(container);

  // --- Generate Camera Pages ---
  container.style.padding = "10mm"; // Reset padding for grid pages

  let isFirstPage = true;
  let pageCount = 0;

  // Track which images used cache
  let cachedImageCount = 0;
  let totalImages = 0;

  for (const [type, groupCameras] of Object.entries(grouped)) {
    console.log(`[PDF] กำลังสร้างหน้าสำหรับ ${type}...`);

    for (let i = 0; i < groupCameras.length; i += imagesPerPage) {
      pageCount++;
      console.log(`[PDF] หน้าที่ ${pageCount}...`);

      if (!isFirstPage) {
        pdf.addPage();
      }
      isFirstPage = false;

      container.innerHTML = "";
      const pageCameras = groupCameras.slice(i, i + imagesPerPage);

      console.log(`[PDF]   กล้อง ${pageCameras.length} ตัว:`, pageCameras.map(c => c.name).join(', '));

      // Add Header
      const header = document.createElement("div");
      header.style.textAlign = "center";
      header.style.marginBottom = "8mm";
      header.style.fontFamily = "'TH Sarabun New', sans-serif";
      header.style.fontWeight = "bold";
      header.style.fontSize = "20pt";
      header.style.lineHeight = "1.1";

      const line1 = document.createElement("div");
      line1.innerText = "ภาพจากระบบกล้องวงจรปิดภายในเขตรับผิดชอบ";

      const line2 = document.createElement("div");
      const displayType = type.replace(/ร้อย\.(\d+)/, "ร้อย.ป.ที่ $1");
      line2.innerText = toThaiNumerals(`หน่วย ${displayType}`);

      header.appendChild(line1);
      header.appendChild(line2);
      container.appendChild(header);

      const grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(3, 1fr)";
      grid.style.gridTemplateRows = "repeat(4, 1fr)";
      grid.style.gap = "5mm";
      grid.style.width = "100%";
      grid.style.height = "195mm";

      pageCameras.forEach((camera) => {
        const cell = document.createElement("div");
        cell.style.position = "relative";
        cell.style.display = "flex";
        cell.style.flexDirection = "column";
        cell.style.alignItems = "center";
        cell.style.border = "1px solid #ccc";
        cell.style.padding = "0";
        cell.style.boxSizing = "border-box";
        cell.style.overflow = "hidden";

        const img = document.createElement("img");
        img.src = camera.lastCheckedImage!;
        img.style.width = "100%";
        img.style.height = "50mm";
        img.style.objectFit = "cover";
        img.style.display = "block";
        img.setAttribute('data-camera-id', camera.id);
        img.setAttribute('data-image-signature', getImageSignature(camera));

        const label = document.createElement("div");
        label.style.position = "absolute";
        label.style.bottom = "12px";
        label.style.left = "0";
        label.style.right = "0";
        label.style.fontSize = "12pt";
        label.style.fontWeight = "bold";
        label.style.textAlign = "center";
        label.style.color = "white";
        label.style.textShadow = "0 0 3px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.6)";
        label.style.lineHeight = "1";
        const nameThai = toThaiNumerals(camera.name);
        const descThai = camera.description ? toThaiNumerals(camera.description) : "";
        label.innerText = `${nameThai}${descThai ? ` : ${descThai}` : ""}`;

        cell.appendChild(img);
        cell.appendChild(label);
        grid.appendChild(cell);
      });

      container.appendChild(grid);

      // รอให้รูปภาพโหลดเสร็จทั้งหมด
      console.log('[PDF]   รอโหลดรูปภาพ...');
      const images = container.querySelectorAll('img');
      totalImages += images.length;
      console.log('[PDF]   จำนวนรูป:', images.length);

      // แปลงรูปเป็น base64 เพื่อหลีก CORS - with caching
      const loadPromises = Array.from(images).map(async (img, idx) => {
        const htmlImg = img as HTMLImageElement;
        const cameraId = htmlImg.getAttribute('data-camera-id');
        const originalSrc = htmlImg.src;
        const imageSig = htmlImg.getAttribute('data-image-signature');

        try {
          // First check if we have a cached base64 for this exact image signature
          const cachedBase64 = getCachedImage({ lastCheckedImage: originalSrc });

          if (cachedBase64) {
            console.log(`[PDF Cache]     รูปที่ ${idx + 1} (${cameraId}): ใช้ cache`);
            await new Promise<void>((resolve, reject) => {
              htmlImg.onload = () => resolve();
              htmlImg.onerror = reject;
              htmlImg.src = cachedBase64;
            });
            cachedImageCount++;
            return;
          }

          console.log(`[PDF]     รูปที่ ${idx + 1} (${cameraId}): กำลังโหลด...`);

          // Fetch และแปลงเป็น base64
          const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(originalSrc)}`;
          const response = await fetch(proxyUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          // Wait for the image to actually render the new base64 src
          await new Promise<void>((resolve, reject) => {
            htmlImg.onload = () => resolve();
            htmlImg.onerror = reject;
            htmlImg.src = base64;
          });

          // Save to cache
          saveImageToCache({ lastCheckedImage: originalSrc }, base64);
          console.log(`[PDF Cache]     รูปที่ ${idx + 1} (${cameraId}): แปลง base64 สำเร็จ + cache`);
        } catch (error) {
          console.error(`[PDF]     รูปที่ ${idx + 1} (${cameraId}): ERROR`, error);
          throw error;
        }
      });

      try {
        await Promise.all(loadPromises);
        console.log('[PDF]   โหลดรูปเสร็จทั้งหมด รอ render...');
        // รอให้เบราว์เซอร์มีเวลา render base64 ลงจอจริงๆ ก่อนเรียก html2canvas
        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        console.error('[PDF]   มีรูปโหลดไม่สำเร็จ:', error);
        alert('ไม่สามารถโหลดรูปภาพบางรูปได้ กรุณาลองใหม่อีกครั้ง');
        document.body.removeChild(container);
        return null;
      }

      // Add Signature Footer
      const footer = document.createElement("div");
      footer.style.marginTop = "8mm";
      footer.style.display = "flex";
      footer.style.flexDirection = "column";
      footer.style.alignItems = "flex-end";
      footer.style.fontFamily = "'TH Sarabun New', sans-serif";
      footer.style.fontSize = "16pt";
      footer.style.lineHeight = "1.2";
      footer.style.paddingRight = "28mm";

      const sigContainer = document.createElement("div");
      sigContainer.style.display = "flex";
      sigContainer.style.flexDirection = "column";
      sigContainer.style.alignItems = "center";
      sigContainer.style.gap = "1mm";

      const sigLine1 = document.createElement("div");
      sigLine1.innerHTML = 'ตรวจถูกต้อง<span style="color: white">-------------------------------------</span>';
      sigContainer.appendChild(sigLine1);

      const sigLine2 = document.createElement("div");
      sigLine2.innerHTML = 'ร.ต.<span style="color: white">-------------------------</span>';
      sigContainer.appendChild(sigLine2);

      const sigLine3 = document.createElement("div");
      sigLine3.innerText = "( ชัยชนะ  ศรีเชื้อ )";
      sigContainer.appendChild(sigLine3);

      const sigLine4 = document.createElement("div");
      sigLine4.innerText = "นชง.ป.๗๑ พัน.๗๑๓ ปฏิบัติหน้าที่";
      sigContainer.appendChild(sigLine4);

      const sigLine5 = document.createElement("div");
      sigLine5.innerText = "ฝอ.๒ ป.๗๑ พัน.๗๑๓";
      sigContainer.appendChild(sigLine5);

      footer.appendChild(sigContainer);
      container.appendChild(footer);

      console.log('[PDF]   กำลัง render canvas...');
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      console.log('[PDF]   เพิ่มหน้าลง PDF...');
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
      console.log('[PDF]   เสร็จหน้าที่', pageCount);
    }
  }

  console.log('[PDF] ลบ container');
  document.body.removeChild(container);

  console.log(`[PDF Cache] สรุป: ใช้ cache ${cachedImageCount}/${totalImages} รูป`);

  console.log('[PDF] บันทึกไฟล์...');
  const pdfBlob = pdf.output("blob");
  console.log('[PDF] เสร็จสิ้น');
  return pdfBlob;
};

// Export check function for external use
export const checkPdfCacheValid = (cameras: CameraWithCheck[]): string | null => {
  if (checkImagesUnchanged(cameras)) {
    return getCachedPdf();
  }
  return null;
};

// Export save function for external use
export const savePdfCache = (pdfUrl: string, cameras: CameraWithCheck[]) => {
  savePdfToCache(pdfUrl, cameras);
};
