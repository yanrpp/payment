"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun } from "lucide-react";

import { isoToThaiDisplay, localTodayIso } from "@/lib/date/thaiDate";
import { MAIN_NAV_ITEMS } from "@/lib/navigation/mainNav";

type AppHeaderBarProps = {
  onOpenSidebar: () => void;
  sidebarHidden?: boolean;
};

export function AppHeaderBar({ onOpenSidebar, sidebarHidden = false }: AppHeaderBarProps) {
  const router = useRouter();
  const pathname = router.pathname;
  const active = MAIN_NAV_ITEMS.find((item) =>
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  const title = active?.label ?? "หน้าหลัก";
  const today = isoToThaiDisplay(localTodayIso());

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-flow-border bg-white/85 px-4 backdrop-blur dark:bg-slate-900/80 md:px-6">
      <button
        aria-label="เปิดเมนู"
        className={`grid h-9 w-9 place-items-center rounded-lg text-flow-muted hover:bg-flow-input ${sidebarHidden ? "" : "md:hidden"}`}
        type="button"
        onClick={onOpenSidebar}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 items-center gap-2 text-xs text-flow-muted lg:flex">
        <span className="font-medium text-accent-700 dark:text-accent-300">RPP MRLI</span>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="truncate text-sm font-semibold text-flow-text">{title}</span>
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <button
          aria-label={isDark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
          className="grid h-9 w-9 place-items-center rounded-lg text-flow-muted hover:bg-flow-input"
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <span className="hidden items-center gap-1.5 rounded-full bg-flow-input px-2.5 py-1 text-[11px] text-flow-muted xl:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {today}
        </span>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-accent-600 text-[11px] font-semibold text-white shadow-sm">
          รพ
        </div>
      </div>
    </header>
  );
}
