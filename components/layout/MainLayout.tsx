import type { ReactNode } from "react";

import { AppFooter } from "@/components/layout/AppFooter";
import { AppTopbar } from "@/components/layout/AppTopbar";

type MainLayoutProps = {
  children: ReactNode;
};

/**
 * เลย์เอาต์หลักของแอป (Pages Router)
 * ใช้ใน _app.tsx เพื่อครอบทุกหน้า — หน้าใหม่ไม่ต้องซ้ำ topbar/footer
 */
export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div
      className="flex min-h-screen flex-col bg-white text-slate-800"
      style={{ fontFamily: "var(--font-thai), sans-serif" }}
    >
      <AppTopbar />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <AppFooter />
    </div>
  );
}
