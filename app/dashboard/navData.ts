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
  { href: "/dashboard", label: "บัตรผ่านยานพาหนะ", exact: false, icon: "review" },
  { href: "/dashboard/personnel", label: "ข้อมูลรายชื่อกำลังพล", exact: true, icon: "personnel" },
  { href: "/dashboard/access", label: "อนุมัติการเข้าถึง", exact: true, icon: "access" },
  { href: "/dashboard/cctv-map", label: "ข้อมูลกล้องวงจรปิด", exact: true, icon: "cctv" },
];
