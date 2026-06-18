"use client";

import Link from "next/link";
import { useRouter } from "next/router";

import { NavIcon } from "@/components/layout/NavIcon";
import { siteConfig } from "@/config/site";
import { MAIN_NAV_GROUPS } from "@/lib/navigation/mainNav";

type AppSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const router = useRouter();
  const pathname = router.pathname;
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* backdrop สำหรับมือถือ */}
      {mobileOpen && (
        <button
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          type="button"
          onClick={onCloseMobile}
        />
      )}

      <aside
        aria-label="เมนูหลัก"
        className={`fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-slate-300 shadow-xl transition-[width,transform] duration-200 ease-out md:static md:translate-x-0 ${
          collapsed ? "w-[76px]" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* แบรนด์ */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-600 text-sm font-bold text-white shadow-lg shadow-brand-500/20">
            RP
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">RPP · MRLI</p>
              <p className="truncate text-[10px] text-slate-400">Revenue Lifecycle Intelligence</p>
            </div>
          )}
        </div>

        {/* เมนู */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {MAIN_NAV_GROUPS.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </p>
              )}
              {collapsed && <div className="mx-2 mb-2 h-px bg-white/10" />}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.href);

                  return (
                    <li key={item.href}>
                      <Link
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          collapsed ? "justify-center" : ""
                        } ${
                          active
                            ? "bg-brand-500/15 text-white ring-1 ring-inset ring-brand-400/30"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
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
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ส่วนล่าง: ปุ่มย่อ + เวอร์ชัน */}
        <div className="border-t border-white/10 p-3">
          <button
            className="hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white md:flex"
            type="button"
            onClick={onToggleCollapse}
          >
            <svg
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
            {!collapsed && <span>ย่อเมนู</span>}
          </button>
          {!collapsed && (
            <p className="mt-2 px-3 text-[10px] text-slate-500">เวอร์ชัน {siteConfig.version}</p>
          )}
        </div>
      </aside>
    </>
  );
}
