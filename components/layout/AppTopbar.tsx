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
      className="sticky top-0 z-40 border-b border-accent-200 bg-accent-50"
      role="banner"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-14 md:h-16 items-center justify-between gap-3">
          <Link
            href="/"
            className="shrink-0 rounded-md font-semibold text-accent-800 hover:text-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-300 focus:ring-offset-2"
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
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-accent-300 focus:ring-offset-1 ${
                    active
                      ? "bg-white text-accent-800 shadow-sm ring-1 ring-accent-200"
                      : "text-accent-700/80 hover:bg-white/70 hover:text-accent-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 flex-1 items-center justify-end md:hidden">
            <label htmlFor="main-nav-mobile" className="sr-only">
              เลือกหน้า
            </label>
            <select
              id="main-nav-mobile"
              className="max-w-[min(100%,12rem)] truncate rounded-lg border border-accent-200 bg-white py-1.5 pl-2 pr-7 text-xs text-accent-800 focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-300/40"
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
