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

const NAV_HIDDEN_KEY = "nav_hidden";

/**
 * โครงหลักของแอป (enterprise shell): sidebar ซ้าย + topbar + พื้นที่เนื้อหา
 * - ซ่อน sidebar เต็มรูปแบบ (จำค่าใน localStorage)
 * - มือถือเป็น drawer (เปิดจาก hamburger, ปิดเมื่อเปลี่ยนหน้า)
 */
export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedHidden = window.localStorage.getItem(NAV_HIDDEN_KEY);

    if (savedHidden === "1") setSidebarHidden(true);
  }, []);

  useEffect(() => {
    const close = () => setMobileOpen(false);

    router.events.on("routeChangeComplete", close);

    return () => router.events.off("routeChangeComplete", close);
  }, [router.events]);

  const hideSidebar = () => {
    setSidebarHidden(true);
    setMobileOpen(false);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(NAV_HIDDEN_KEY, "1");
    }
  };

  const openSidebar = () => {
    if (sidebarHidden) {
      setSidebarHidden(false);
      setMobileOpen(false);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(NAV_HIDDEN_KEY, "0");
      }
      return;
    }

    setMobileOpen(true);
  };

  return (
    <div
      className="flex h-screen overflow-hidden bg-slate-50 text-flow-text"
      style={{ fontFamily: "var(--font-thai), sans-serif" }}
    >
      <AppSidebar
        hidden={sidebarHidden}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onHide={hideSidebar}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeaderBar sidebarHidden={sidebarHidden} onOpenSidebar={openSidebar} />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <AppFooter />
      </div>
    </div>
  );
}
