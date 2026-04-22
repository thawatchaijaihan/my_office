export type CameraType =
  | "ป.71 พัน.713"
  | "ป.71 พัน.713 ร้อย.1"
  | "ป.71 พัน.713 ร้อย.2"
  | "ป.71 พัน.713 ร้อย.3"
  | "ร้อย.บก.ป.71 พัน.713"
  | "ร้อย.บร.ป.71 พัน.713";

export type CameraStatus = "online" | "offline" | "maintenance";
export type MarkerMode =
  | "all"
  | "ok"
  | "pending"
  | "has-image"
  | "no-image"
  | "offline"
  | "none";

export type Camera = {
  id: string;
  name: string;
  description: string;
  type: CameraType;
  status: CameraStatus;
  lat: number;
  lng: number;
};

export type CameraWithCheck = Camera & {
  lastCheckedAt?: string;
  lastCheckedImage?: string;
  lastCheckedImagePath?: string;
};
