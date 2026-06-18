"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTheme } from "next-themes";
import { CornerDownLeft, Menu, Moon, Search, Sun, UserSearch } from "lucide-react";

import { NavIcon } from "@/components/layout/NavIcon";
import { isoToThaiDisplay, localTodayIso } from "@/lib/date/thaiDate";
import { MAIN_NAV_ITEMS } from "@/lib/navigation/mainNav";

type AppHeaderBarProps = {
  onOpenMobile: () => void;
};

export function AppHeaderBar({ onOpenMobile }: AppHeaderBarProps) {
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

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();

    if (!needle) return [];

    return MAIN_NAV_ITEMS.filter((i) => i.label.toLowerCase().includes(needle)).slice(0, 6);
  }, [q]);

  const patientAction = useMemo(() => {
    const v = q.trim();

    if (!v) return null;
    const isAn = /^\d{8,}$/.test(v);

    return {
      param: isAn ? "an" : "hn",
      value: v,
      label: isAn ? `เปิดผู้ป่วยใน (IPD) ด้วย AN: ${v}` : `ค้นหาผู้ป่วยใน (IPD) HN: ${v}`,
    };
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", onDown);

    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    void router.push(href);
  };

  const runPatient = () => {
    if (patientAction) {
      go(`/ipd-patient-cost?${patientAction.param}=${encodeURIComponent(patientAction.value)}`);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) go(results[0].href);
    else if (patientAction) runPatient();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-flow-border bg-white/85 px-4 backdrop-blur dark:bg-slate-900/80 md:px-6">
      <button
        aria-label="เปิดเมนู"
        className="grid h-9 w-9 place-items-center rounded-lg text-flow-muted hover:bg-flow-input md:hidden"
        type="button"
        onClick={onOpenMobile}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 items-center gap-2 text-xs text-flow-muted lg:flex">
        <span className="font-medium text-accent-700 dark:text-accent-300">RPP MRLI</span>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="truncate text-sm font-semibold text-flow-text">{title}</span>
      </div>

      {/* Global search */}
      <div ref={searchRef} className="relative mx-auto w-full max-w-md">
        <form onSubmit={onSubmit}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-flow-muted" />
          <input
            className="w-full rounded-lg border border-flow-border bg-flow-input/60 py-1.5 pl-9 pr-3 text-xs text-flow-text placeholder:text-flow-muted focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:bg-slate-800 dark:focus:bg-slate-800"
            placeholder="ค้นหาเมนู หรือ HN/AN ผู้ป่วยใน…"
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          />
        </form>

        {open && (results.length > 0 || patientAction) && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-flow-border bg-white shadow-lg dark:bg-slate-900">
            {results.length > 0 && (
              <div className="py-1">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-flow-muted">
                  เมนู
                </p>
                {results.map((item) => (
                  <button
                    key={item.href}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-flow-text hover:bg-flow-input"
                    type="button"
                    onClick={() => go(item.href)}
                  >
                    <NavIcon className="h-4 w-4 shrink-0 text-flow-muted" name={item.icon} />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
            {patientAction && (
              <div className="border-t border-flow-border py-1">
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-flow-text hover:bg-flow-input"
                  type="button"
                  onClick={runPatient}
                >
                  <UserSearch className="h-4 w-4 shrink-0 text-brand-500" />
                  <span className="truncate">{patientAction.label}</span>
                  <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0 text-flow-muted" />
                </button>
              </div>
            )}
          </div>
        )}
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
