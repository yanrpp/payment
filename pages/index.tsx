"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  FileWarning,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { NavIcon } from "@/components/layout/NavIcon";
import { siteConfig } from "@/config/site";
import { isoToThaiDisplay, localTodayIso } from "@/lib/date/thaiDate";
import { MAIN_NAV_GROUPS } from "@/lib/navigation/mainNav";

type WorklistRow = {
  TOTAL_CHARGE: number;
  DX_COUNT: number | null;
};

type Kpi = {
  total: number;
  incomplete: number;
  noCharge: number;
  totalCharge: number;
};

function formatBaht(value: number): string {
  return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-flow-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-flow-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-flow-text">
            {loading ? <span className="text-flow-muted">—</span> : value}
          </p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [loading, setLoading] = useState(true);
  const today = isoToThaiDisplay(localTodayIso());

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const d = localTodayIso();
        const res = await fetch(
          `/api/db/mrli-revenue-worklist?d1=${encodeURIComponent(d)}&d2=${encodeURIComponent(d)}`
        );
        const json = await res.json();

        if (cancelled) return;
        if (res.ok && json.success && Array.isArray(json.data)) {
          const rows = json.data as WorklistRow[];
          const incomplete = rows.filter(
            (r) =>
              Number(r.TOTAL_CHARGE ?? 0) <= 0 || (r.DX_COUNT !== null && Number(r.DX_COUNT) <= 0)
          ).length;
          const noCharge = rows.filter((r) => Number(r.TOTAL_CHARGE ?? 0) <= 0).length;
          const totalCharge = rows.reduce((s, r) => s + Number(r.TOTAL_CHARGE ?? 0), 0);

          setKpi({ total: rows.length, incomplete, noCharge, totalCharge });
        } else {
          setKpi(null);
        }
      } catch {
        if (!cancelled) setKpi(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const moduleGroups = MAIN_NAV_GROUPS.filter((g) => g.title !== "ภาพรวม");

  return (
    <div className="w-full px-4 py-6 md:px-6 md:py-8">
      <section className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-flow-text">แดชบอร์ดภาพรวม</h1>
        <p className="mt-1 text-xs md:text-sm text-flow-muted">
          {siteConfig.name} · ข้อมูล ณ วันที่ {today}
        </p>
      </section>

      {/* KPI */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          accent="bg-brand-50 text-brand-600"
          icon={BedDouble}
          label="รับเข้าผู้ป่วยใน (วันนี้)"
          loading={loading}
          value={kpi ? `${kpi.total.toLocaleString("th-TH")} AN` : "—"}
        />
        <KpiCard
          accent="bg-amber-100 text-amber-700"
          icon={AlertTriangle}
          label="ต้องตรวจสอบก่อนเบิก"
          loading={loading}
          value={kpi ? `${kpi.incomplete.toLocaleString("th-TH")} AN` : "—"}
        />
        <KpiCard
          accent="bg-red-100 text-red-700"
          icon={FileWarning}
          label="ยังไม่ลงค่าใช้จ่าย"
          loading={loading}
          value={kpi ? `${kpi.noCharge.toLocaleString("th-TH")} AN` : "—"}
        />
        <KpiCard
          accent="bg-emerald-100 text-emerald-700"
          icon={Wallet}
          label="ค่าใช้จ่ายรวม (วันนี้)"
          loading={loading}
          value={kpi ? `${formatBaht(kpi.totalCharge)} ฿` : "—"}
        />
      </section>

      {!loading && !kpi && (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          ไม่สามารถโหลดตัวเลข KPI ได้ในขณะนี้ (ตรวจสอบการเชื่อมต่อฐานข้อมูล) —
          เมนูด้านล่างยังใช้งานได้
        </p>
      )}

      {/* โมดูล */}
      {moduleGroups.map((group) => (
        <section key={group.title} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-flow-text">{group.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <Link
                key={item.href}
                className="group flex items-center gap-4 rounded-2xl border border-flow-border bg-white p-4 shadow-sm transition-all hover:border-brand-400 hover:shadow-md"
                href={item.href}
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400/15 to-accent-600/15 text-brand-600 ring-1 ring-inset ring-brand-400/20 dark:text-brand-300">
                  <NavIcon className="h-5 w-5" name={item.icon} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-flow-text">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-flow-muted">เปิดรายงาน</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-flow-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="text-xs text-flow-muted">เวอร์ชัน {siteConfig.version}</section>
    </div>
  );
}
