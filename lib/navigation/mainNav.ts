/**
 * เมนูหลักของแอป — ใช้ร่วมกับ AppSidebar / AppShell
 * เพิ่ม/แก้รายการเมนูที่นี่เพียงจุดเดียว (จัดเป็นกลุ่ม + ไอคอน)
 */
export type MainNavItem = {
  href: string;
  label: string;
  /** ชื่อไอคอน (map ใน components/layout/NavIcon.tsx) */
  icon: string;
};

export type MainNavGroup = {
  title: string;
  items: MainNavItem[];
};

export const MAIN_NAV_GROUPS: MainNavGroup[] = [
  {
    title: "ภาพรวม",
    items: [{ href: "/", label: "หน้าหลัก", icon: "home" }],
  },
  {
    title: "รายงานต้นทุน",
    items: [
      { href: "/patient-cost", label: "ต้นทุนรายผู้ป่วย", icon: "user" },
      { href: "/drug-cost-summary", label: "สรุปต้นทุนและกำไรจากยา", icon: "pill" },
      { href: "/ipd-patient-cost", label: "ต้นทุนรายผู้ป่วย (IPD)", icon: "bed" },
    ],
  },
  {
    title: "MRLI · บริหารรายได้",
    items: [
      { href: "/mrli-revenue-worklist", label: "รายการรอทำเบิก", icon: "clipboard" },
      { href: "/mrli-preclaim-scrub", label: "ตรวจก่อนเบิก", icon: "shield" },
      { href: "/mrli-rule-admin", label: "ตั้งค่ากฎ", icon: "sliders" },
    ],
  },
];

/** รายการเมนูแบบ flatten (เพื่อความเข้ากันได้กับโค้ดเดิม) */
export const MAIN_NAV_ITEMS: MainNavItem[] = MAIN_NAV_GROUPS.flatMap((g) => g.items);
