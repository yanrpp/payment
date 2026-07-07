/**
 * เมนูหลักของแอป — ใช้ร่วมกับ AppSidebar / AppShell
 * เพิ่ม/แก้รายการเมนูที่นี่เพียงจุดเดียว (จัดเป็นกลุ่ม + ไอคอน)
 */
export type MainNavItem = {
  href: string;
  label: string;
  /** ชื่อไอคอน (map ใน components/layout/NavIcon.tsx) */
  icon: string;
  /** ปิดใช้งานชั่วคราว — แสดงในเมนูแต่คลิกไม่ได้ */
  disabled?: boolean;
};

export type MainNavGroup = {
  title: string;
  items: MainNavItem[];
};

/** หน้าเริ่มต้นของแอป */
export const DEFAULT_APP_PATH = "/patient-medication-search";

export const MAIN_NAV_GROUPS: MainNavGroup[] = [
  {
    title: "รายงานต้นทุน",
    items: [
      { href: "/patient-cost", label: "ต้นทุนรายผู้ป่วย", icon: "user", disabled: true },
      {
        href: "/patient-medication-search",
        label: "ข้อมูลการรักษา",
        icon: "search",
      },
      {
        href: "/drug-cost-summary",
        label: "สรุปต้นทุนและกำไรจากยา",
        icon: "pill",
        disabled: true,
      },
      {
        href: "/ipd-patient-cost",
        label: "ต้นทุนรายผู้ป่วย (IPD)",
        icon: "bed",
        disabled: true,
      },
    ],
  },
  {
    title: "MRLI · บริหารรายได้",
    items: [
      {
        href: "/mrli-revenue-worklist",
        label: "รายการรอทำเบิก",
        icon: "clipboard",
        disabled: true,
      },
      { href: "/mrli-preclaim-scrub", label: "ตรวจก่อนเบิก", icon: "shield", disabled: true },
      { href: "/mrli-rule-admin", label: "ตั้งค่ากฎ", icon: "sliders", disabled: true },
    ],
  },
];

/** รายการเมนูแบบ flatten (เพื่อความเข้ากันได้กับโค้ดเดิม) */
export const MAIN_NAV_ITEMS: MainNavItem[] = MAIN_NAV_GROUPS.flatMap((g) => g.items);
