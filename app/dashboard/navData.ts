/**
 * โครงข้อมูลเมนูแบบ NextAdmin - กำหนด href, label, exact และ icon key
 * แก้เมนูที่เดียวแล้ว DashboardNav จะแสดงตามนี้
 */
export type NavItem = {
  href: string;
  label: string;
  exact: boolean;
  icon:
    | "dashboard"
    | "personnel"
    | "review"
    | "pending-check"
    | "pending-send"
    | "pending-approval"
    | "invalid"
    | "access"
    | "cctv";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "แดชบอร์ด", exact: true, icon: "dashboard" },
  { href: "/dashboard/personnel", label: "ข้อมูลกำลังพล", exact: true, icon: "personnel" },
  { href: "/dashboard/access", label: "อนุมัติการเข้าถึง", exact: true, icon: "access" },
  { href: "/dashboard/cctv-map", label: "แผนที่ติดตั้งกล้องวงจรปิด", exact: true, icon: "cctv" },
];
