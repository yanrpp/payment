"use client";

import type { ReactNode } from "react";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { AppFooter } from "@/components/layout/AppFooter";
import { AppHeaderBar } from "@/components/layout/AppHeaderBar";
import { AppSidebar } from "@/components/layout/AppSidebar";

type AppShellProps = {
  children: ReactNode;
};

/**
 * โครงหลักของแอป (enterprise shell): sidebar ซ้าย + topbar + พื้นที่เนื้อหา
 * - ย่อ/ขยาย sidebar (จำค่าใน localStorage)
 * - มือถือเป็น drawer (เปิดจาก hamburger, ปิดเมื่อเปลี่ยนหน้า)
 */
export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem("nav_collapsed") : null;

    if (saved === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    const close = () => setMobileOpen(false);

    router.events.on("routeChangeComplete", close);

    return () => router.events.off("routeChangeComplete", close);
  }, [router.events]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;

      if (typeof window !== "undefined") {
        window.localStorage.setItem("nav_collapsed", next ? "1" : "0");
      }

      return next;
    });
  };

  return (
    <div
      className="flex h-screen overflow-hidden bg-slate-50 text-flow-text"
      style={{ fontFamily: "var(--font-thai), sans-serif" }}
    >
      <AppSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapse={toggleCollapse}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeaderBar onOpenMobile={() => setMobileOpen(true)} />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <AppFooter />
      </div>
    </div>
  );
}
