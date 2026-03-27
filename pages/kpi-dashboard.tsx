"use client";

import { siteConfig } from "@/config/site";

/**
 * KPI การเงิน & การเก็บเงิน — หน้าต้นแบบ
 */
export default function KpiDashboardPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            KPI การเงิน &amp; การเก็บเงิน
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Collection Rate, AR Days, Claim Denial Rate และตัวชี้วัดอื่น ๆ (โครงหน้า)
          </p>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
          <p className="text-sm text-slate-600 mb-4">
            หน้านี้เป็นพื้นที่สำหรับแดชบอร์ด KPI — ยังไม่ได้เชื่อมข้อมูลจริง
          </p>
          <p className="text-xs text-slate-500">
            สามารถเพิ่มการ์ด KPI, กราฟแนวโน้ม และตารางเปรียบเทียบได้ในขั้นตอนถัดไป
          </p>
        </div>

        <section className="mt-4 text-[11px] md:text-xs text-slate-500">
          <p>เวอร์ชัน: {siteConfig.version}</p>
        </section>
      </main>
    </div>
  );
}
