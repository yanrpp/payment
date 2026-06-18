import {
  BedDouble,
  ClipboardList,
  Home,
  LayoutGrid,
  Pill,
  ShieldCheck,
  SlidersHorizontal,
  User,
  type LucideIcon,
} from "lucide-react";

type NavIconProps = {
  name: string;
  className?: string;
};

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  user: User,
  pill: Pill,
  bed: BedDouble,
  clipboard: ClipboardList,
  shield: ShieldCheck,
  sliders: SlidersHorizontal,
};

/** ไอคอนเมนูจาก lucide-react (รับ className สำหรับขนาด/สี) */
export function NavIcon({ name, className }: NavIconProps) {
  const Icon = ICONS[name] ?? LayoutGrid;

  return <Icon aria-hidden="true" className={className} strokeWidth={1.8} />;
}
