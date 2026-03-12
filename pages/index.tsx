"use client";

import Link from "next/link";

import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <div
      className="min-h-screen flex flex-col bg-white text-slate-800"
      style={{ fontFamily: "var(--font-thai), sans-serif" }}
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{siteConfig.name}</h1>
                <p className="text-sm text-slate-500 mt-1">{siteConfig.description}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* HERO DASHBOARD */}
        <section className="mb-10">
          <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] items-start">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-slate-900 mb-3">
                แดชบอร์ดภาพรวมต้นทุน &amp; เงินเข้า-ออกโรงพยาบาล
              </h2>
              <p className="text-sm md:text-base text-slate-700 leading-relaxed">
                หน้านี้เป็นจุดเริ่มต้นสำหรับผู้บริหารและฝ่ายการเงิน
                ในการเข้าถึงข้อมูลต้นทุน-รายได้แบบ Real-time หรือ Near Real-time
                สามารถค้นหาระดับผู้ป่วย คลินิก แผนก หรือสิทธิการรักษา
                และเชื่อมต่อไปยังรายงานละเอียดและแดชบอร์ดเชิงวิเคราะห์ได้จากเมนูด้านล่าง
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                โฟลว์การใช้งานหลัก
              </h3>
              <ol className="space-y-2 text-xs md:text-sm text-slate-700">
                <li>1. เลือกช่วงเวลาและมุมมองที่ต้องการ (รายคน / คลินิก / แผนก)</li>
                <li>2. ดูสรุป KPI หลัก: ต้นทุน, รายได้, Margin, อัตราเก็บเงิน</li>
                <li>3. Drill-down ไปยังรายงานรายละเอียดหรือผู้ป่วยรายคน</li>
                <li>4. ส่งออกข้อมูล/เชื่อมต่อ BI Tool เพื่อวิเคราะห์เชิงลึกเพิ่มเติม</li>
              </ol>
              <p className="mt-3 text-[11px] md:text-xs text-slate-500">
                หมายเหตุ: หน้านี้เป็นโครง UI สำหรับระบบตรวจสอบและวิเคราะห์
                โดยสามารถเชื่อมต่อกับ API/ฐานข้อมูลจริงได้ในขั้นตอนพัฒนาต่อไป
              </p>
            </div>
          </div>
        </section>

        {/* แถวเมนูหลัก */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            เมนูหลักของระบบวิเคราะห์
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/patient-cost"
              className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-500 hover:shadow-md transition-colors"
            >
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                ตรวจสอบต้นทุนรายผู้ป่วย
              </h3>
              <p className="text-xs text-slate-600 mb-2">
                ค้นหาเคสผู้ป่วย ดูต้นทุนจริง เงินเรียกเก็บ และเงินที่จ่ายได้จริง
                พร้อม Drill-down รายการค่าใช้จ่าย
              </p>
              <span className="text-[11px] font-medium text-emerald-700 group-hover:underline">
                เข้าใช้งาน &rarr;
              </span>
            </Link>

            <Link
              href="/clinic-dashboard"
              className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-500 hover:shadow-md transition-colors"
            >
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                แดชบอร์ดรายคลินิก/แผนก
              </h3>
              <p className="text-xs text-slate-600 mb-2">
                เปรียบเทียบต้นทุน รายได้ และ Margin ของแต่ละคลินิก/แผนก
                พร้อมตัวกรองวันที่ สิทธิประกัน และกลุ่มโรค
              </p>
              <span className="text-[11px] font-medium text-emerald-700 group-hover:underline">
                เข้าใช้งาน &rarr;
              </span>
            </Link>

            <Link
              href="/kpi-dashboard"
              className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-500 hover:shadow-md transition-colors"
            >
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                KPI การเงิน &amp; การเก็บเงิน
              </h3>
              <p className="text-xs text-slate-600 mb-2">
                ติดตาม Collection Rate, AR Days, Claim Denial Rate
                และตัวชี้วัดสำคัญอื่น ๆ ของโรงพยาบาล
              </p>
              <span className="text-[11px] font-medium text-emerald-700 group-hover:underline">
                เข้าใช้งาน &rarr;
              </span>
            </Link>

            <Link
              href="/system-overview"
              className="group rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm hover:border-emerald-500 hover:shadow-md transition-colors"
            >
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                เอกสารอธิบายโครงสร้างระบบ
              </h3>
              <p className="text-xs text-slate-600 mb-2">
                อ่านรายละเอียดโมเดลข้อมูล ขอบเขตข้อมูล ETL
                และมาตรฐานความปลอดภัยของโปรแกรมนี้
              </p>
              <span className="text-[11px] font-medium text-emerald-700 group-hover:underline">
                ไปยังหน้าคำอธิบาย &rarr;
              </span>
            </Link>
          </div>
        </section>

        {/* ส่วน KPI SUMMARY MOCK */}
        <section id="kpi" className="mb-8">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            สรุป KPI หลัก (ตัวอย่าง UI)
          </h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">ต้นทุนเฉลี่ยต่อผู้ป่วย</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">-</p>
              <p className="mt-1 text-[11px] text-slate-500">
                ดึงจาก Fact_PatientExpense (Actual Cost ÷ จำนวนเคส)
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">รายได้เฉลี่ยต่อผู้ป่วย</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">-</p>
              <p className="mt-1 text-[11px] text-slate-500">
                ดึงจากยอดเรียกเก็บ/รับชำระจริง หารด้วยจำนวนผู้ป่วย
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Operating Margin</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">-</p>
              <p className="mt-1 text-[11px] text-slate-500">
                (รายได้รวม - ต้นทุนรวม) ÷ รายได้รวม × 100%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Collection Rate</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">-</p>
              <p className="mt-1 text-[11px] text-slate-500">
                ยอดเงินได้รับชำระจริง ÷ ยอดเรียกเก็บรวม × 100%
              </p>
            </div>
          </div>
        </section>

        {/* ส่วนรายงาน & ฟิลเตอร์ (โครง) */}
        <section id="reports" className="mb-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="md:w-2/5">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">
                ฟิลเตอร์การตรวจสอบ (โครง UI)
              </h2>
              <div className="space-y-3 text-xs text-slate-700">
                <p>
                  ส่วนนี้สามารถเชื่อมกับคอมโพเนนต์ตัวกรองจริง เช่น Date Range, Clinic,
                  Doctor, Insurance, ICD/DRG เพื่อดึงข้อมูลจาก Data Warehouse หรือ API
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>ช่วงวันที่ให้บริการ / วันที่ออกบิล</li>
                  <li>คลินิก / แผนก / แหล่งทุน</li>
                  <li>สิทธิการรักษา / ประกัน / DRG group</li>
                  <li>ระดับมุมมอง (ผู้ป่วย / คลินิก / แผนก / โครงการ)</li>
                </ul>
              </div>
            </div>
            <div className="md:w-3/5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                พื้นที่สำหรับตาราง/กราฟสรุป (Mock Layout)
              </h3>
              <div className="h-40 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-xs text-slate-500">
                ตาราง/กราฟสรุปรวม เช่น ต้นทุนรวม รายได้รวม จำแนกตามมิติที่เลือก
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                สามารถเชื่อมต่อไปยังเครื่องมือ BI เช่น Power BI, Tableau หรือสร้างกราฟด้วย
                React Chart Library ตามความเหมาะสม
              </p>
            </div>
          </div>
        </section>

        <section className="text-sm text-slate-600">
          <p>เวอร์ชัน: {siteConfig.version}</p>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {siteConfig.name} — ระบบต้นแบบ
        </div>
      </footer>
    </div>
  );
}
