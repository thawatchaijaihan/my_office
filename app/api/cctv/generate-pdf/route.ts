import { NextRequest, NextResponse } from "next/server";
import { get, ref, set } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { database, storage } from "@/app/map-cctv/lib/firebase";
import { generateCctvReport } from "@/app/map-cctv/utils/PdfReportGenerator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Camera = {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  lat: number;
  lng: number;
  lastCheckedAt?: string;
  lastCheckedImage?: string;
  lastCheckedImagePath?: string;
};

export async function POST(request: NextRequest) {
  try {
    const camerasRef = ref(database, "cameras");
    const snapshot = await get(camerasRef);
    
    if (!snapshot.exists()) {
      return NextResponse.json({ error: "No cameras found" }, { status: 404 });
    }

    const data = snapshot.val() as Record<string, Camera>;
    const cameras = Object.entries(data).map(([id, value]) => ({
      ...value,
      id,
    })) as CameraWithCheck[];

    const pdfBlob = await generateCctvReport(cameras);
    
    const pdfPath = `cctv-reports/latest.pdf`;
    const pdfRef = storageRef(storage, pdfPath);
    
    await uploadBytes(pdfRef, pdfBlob);
    const pdfUrl = await getDownloadURL(pdfRef);

    await set(ref(database, "cctvReport"), {
      url: pdfUrl,
      generatedAt: new Date().toISOString(),
      cameraCount: cameras.length,
    });

    return NextResponse.json({
      success: true,
      url: pdfUrl,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
