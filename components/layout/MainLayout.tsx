import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";

type MainLayoutProps = {
  children: ReactNode;
};

/**
 * เลย์เอาต์หลักของแอป (Pages Router) — ครอบทุกหน้าใน _app.tsx
 * โครงเป็น enterprise shell: sidebar ซ้าย + topbar + พื้นที่เนื้อหา (ดู AppShell)
 */
export default function MainLayout({ children }: MainLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
