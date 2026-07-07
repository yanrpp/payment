"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { PanelLeftClose } from "lucide-react";

import { NavIcon } from "@/components/layout/NavIcon";
import { siteConfig } from "@/config/site";
import { MAIN_NAV_GROUPS } from "@/lib/navigation/mainNav";

type AppSidebarProps = {
  hidden: boolean;
  onHide: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function AppSidebar({ hidden, onHide, mobileOpen, onCloseMobile }: AppSidebarProps) {
  const router = useRouter();
  const pathname = router.pathname;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const showMobileDrawer = !hidden && mobileOpen;

  return (
    <>
      {/* backdrop สำหรับมือถือ */}
      {showMobileDrawer && (
        <button
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          type="button"
          onClick={onCloseMobile}
        />
      )}

      <aside
        aria-hidden={hidden}
        aria-label="เมนูหลัก"
        className={`flex h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-slate-300 shadow-xl transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          hidden
            ? "hidden"
            : `fixed inset-y-0 left-0 z-50 max-md:transition-transform ${
                mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
              }`
        }`}
      >
        {/* แบรนด์ */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-600 text-sm font-bold text-white shadow-lg shadow-brand-500/20">
            RP
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">RPP · MRLI</p>
            <p className="truncate text-[10px] text-slate-400">Revenue Lifecycle Intelligence</p>
          </div>
        </div>

        {/* เมนู */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <div className="border-b border-white/10 pb-2">
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              title="ซ่อนเมนู"
              type="button"
              onClick={onHide}
            >
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span>ซ่อนเมนู</span>
            </button>
          </div>

          {MAIN_NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = !item.disabled && isActive(item.href);

                  if (item.disabled) {
                    return (
                      <li key={item.href}>
                        <span
                          aria-disabled="true"
                          className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 opacity-50"
                          title="ปิดใช้งานชั่วคราว"
                        >
                          <NavIcon
                            className="h-[18px] w-[18px] shrink-0 text-slate-600"
                            name={item.icon}
                          />
                          <span className="truncate">{item.label}</span>
                        </span>
                      </li>
                    );
                  }

                  return (
                    <li key={item.href}>
                      <Link
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? "bg-brand-500/15 text-white ring-1 ring-inset ring-brand-400/30"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                        href={item.href}
                        onClick={onCloseMobile}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-brand-400" />
                        )}
                        <NavIcon
                          className={`h-[18px] w-[18px] shrink-0 ${
                            active ? "text-brand-300" : "text-slate-400 group-hover:text-slate-200"
                          }`}
                          name={item.icon}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ส่วนล่าง: เวอร์ชัน */}
        <div className="border-t border-white/10 p-3">
          <p className="px-3 text-[10px] text-slate-500">เวอร์ชัน {siteConfig.version}</p>
        </div>
      </aside>
    </>
  );
}
