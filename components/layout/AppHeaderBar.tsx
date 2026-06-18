"use client";

import { useRouter } from "next/router";

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

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-flow-border bg-white/85 px-4 backdrop-blur md:px-6">
      <button
        aria-label="เปิดเมนู"
        className="grid h-9 w-9 place-items-center rounded-lg text-flow-muted hover:bg-flow-input md:hidden"
        type="button"
        onClick={onOpenMobile}
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div className="flex min-w-0 items-center gap-2 text-xs text-flow-muted">
        <span className="hidden font-medium text-accent-700 sm:inline">RPP MRLI</span>
        <span className="hidden text-slate-300 sm:inline">/</span>
        <span className="truncate text-sm font-semibold text-flow-text">{title}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden items-center gap-1.5 rounded-full bg-flow-input px-2.5 py-1 text-[11px] text-flow-muted md:inline-flex">
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
