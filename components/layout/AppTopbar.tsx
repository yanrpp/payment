"use client";

import Link from "next/link";
import { useRouter } from "next/router";

import { siteConfig } from "@/config/site";
import { MAIN_NAV_ITEMS } from "@/lib/navigation/mainNav";

/**
 * แถบเมนูด้านบน — ใช้ร่วมกับ MainLayout (_app.tsx)
 */
export function AppTopbar() {
  const router = useRouter();
  const pathname = router.pathname;
  const mobileSelectValue = MAIN_NAV_ITEMS.some((item) => item.href === pathname)
    ? pathname
    : "/";

  return (
    <header
      className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
      role="banner"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-14 md:h-16 items-center justify-between gap-3">
          <Link
            href="/"
            className="shrink-0 font-semibold text-slate-900 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-md"
          >
            <span className="text-sm md:text-base">{siteConfig.name}</span>
          </Link>

          <nav
            className="hidden min-w-0 flex-1 justify-end md:flex md:items-center md:gap-1"
            aria-label="เมนูหลัก"
          >
            {MAIN_NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
                    active
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile: เลือกเมนูจาก <select> เพื่อไม่ให้ topbar ยาวเกิน */}
          <div className="flex min-w-0 flex-1 items-center justify-end md:hidden">
            <label htmlFor="main-nav-mobile" className="sr-only">
              เลือกหน้า
            </label>
            <select
              id="main-nav-mobile"
              className="max-w-[min(100%,12rem)] truncate rounded-lg border border-slate-300 bg-white py-1.5 pl-2 pr-7 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={mobileSelectValue}
              onChange={(e) => {
                void router.push(e.target.value);
              }}
            >
              {MAIN_NAV_ITEMS.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
