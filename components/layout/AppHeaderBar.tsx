"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useTheme } from "next-themes";
import { LogOut, Menu, Moon, Sun } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { isoToThaiDisplay, localTodayIso } from "@/lib/date/thaiDate";
import { MAIN_NAV_ITEMS } from "@/lib/navigation/mainNav";

type AppHeaderBarProps = {
  onOpenSidebar: () => void;
  sidebarHidden?: boolean;
};

export function AppHeaderBar({ onOpenSidebar, sidebarHidden = false }: AppHeaderBarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const pathname = router.pathname;
  const active = MAIN_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  const title = active?.label ?? "ข้อมูลการรักษา";
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
        {user ? (
          <div className="hidden max-w-[12rem] flex-col text-right leading-tight sm:flex">
            <span className="truncate text-xs font-semibold text-flow-text">
              {user.displayName}
              {user.isAdmin ? (
                <span className="ml-1 rounded bg-brand-100 px-1 py-0.5 text-[9px] font-medium text-brand-800">
                  Admin
                </span>
              ) : null}
            </span>
            <span className="truncate text-[10px] text-flow-muted">{user.username}</span>
          </div>
        ) : null}
        <button
          aria-label="ออกจากระบบ"
          className="grid h-9 w-9 place-items-center rounded-lg text-flow-muted hover:bg-flow-input"
          title="ออกจากระบบ"
          type="button"
          onClick={() => void logout()}
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-accent-600 text-[11px] font-semibold text-white shadow-sm">
          {user?.displayName?.slice(0, 1) ?? "รพ"}
        </div>
      </div>
    </header>
  );
}
