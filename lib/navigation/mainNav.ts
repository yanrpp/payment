/**
 * เมนูหลักของแอป — ใช้ร่วมกับ AppTopbar / MainLayout
 * เพิ่มรายการเมนูใหม่ที่นี่เพียงจุดเดียว
 */
export type MainNavItem = {
  href: string;
  label: string;
};

export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/patient-cost", label: "ต้นทุนรายผู้ป่วย" },
  { href: "/drug-cost-summary", label: "สรุปต้นทุนและกำไรจากยา" },
  { href: "/clinic-dashboard", label: "แดชบอร์ดคลินิก/แผนก" },
  { href: "/kpi-dashboard", label: "KPI การเงิน" },
  { href: "/system-overview", label: "ภาพรวมระบบ" },
];
