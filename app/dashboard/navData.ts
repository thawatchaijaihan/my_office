/**
 * โครงข้อมูลเมนูแบบ NextAdmin - กำหนด href, label, exact และ icon key
 * แก้เมนูที่เดียวแล้ว DashboardNav จะแสดงตามนี้
 */
export type NavItem = {
  href: string;
  label: string;
  exact: boolean;
  icon: "dashboard" | "review" | "pending-check" | "pending-send" | "pending-approval" | "invalid";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "แดชบอร์ด", exact: true, icon: "dashboard" },
  { href: "/dashboard/review", label: "รายการขอบัตรผ่าน", exact: true, icon: "review" },
  { href: "/dashboard/pending-check", label: "รอการตรวจสอบข้อมูล", exact: true, icon: "pending-check" },
  { href: "/dashboard/pending-send", label: "รอนำเรียนส่ง ฝขว.พล.ป.", exact: true, icon: "pending-send" },
  { href: "/dashboard/pending-approval", label: "รออนุมัติจาก ฝขว.พล.ป.", exact: true, icon: "pending-approval" },
  { href: "/dashboard/invalid", label: "ข้อมูลไม่ถูกต้อง", exact: true, icon: "invalid" },
];
