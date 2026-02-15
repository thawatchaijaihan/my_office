export type CameraType =
  | "ป.71 พัน.713"
  | "ป.71 พัน.713 ร้อย.1"
  | "ป.71 พัน.713 ร้อย.2"
  | "ป.71 พัน.713 ร้อย.3"
  | "ร้อย.บก.ป.71 พัน.713"
  | "ร้อย.บร.ป.71 พัน.713";

export type CameraStatus = "online" | "offline" | "maintenance";

export type Camera = {
  id: string;
  name: string;
  description: string;
  type: CameraType;
  status: CameraStatus;
  lat: number;
  lng: number;
};
