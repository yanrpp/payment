"use client";

import Link from "next/link";

import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <main className="flex w-full flex-1 flex-col container mx-auto px-4 py-8">
      <header className="mb-8 border-b border-flow-border pb-6">
        <p className="text-sm text-flow-muted">{siteConfig.description}</p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-flow-text md:text-2xl">
          แดชบอร์ดภาพรวมต้นทุน &amp; เงินเข้า-ออกโรงพยาบาล
        </h2>
        <p className="text-sm leading-relaxed text-flow-muted md:text-base">
          หน้านี้เป็นจุดเริ่มต้นสำหรับผู้บริหารและฝ่ายการเงิน ในการเข้าถึงข้อมูลต้นทุน-รายได้แบบ
          Real-time หรือ Near Real-time สามารถค้นหาระดับผู้ป่วย คลินิก แผนก หรือสิทธิการรักษา
          และเชื่อมต่อไปยังรายงานละเอียดได้จากเมนูด้านล่าง
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-flow-text">เมนูหลักของระบบวิเคราะห์</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/patient-cost"
            className="group ui-panel transition-colors hover:border-brand-400 hover:shadow-md"
          >
            <h3 className="mb-1 text-sm font-semibold text-flow-text">ตรวจสอบต้นทุนรายผู้ป่วย</h3>
            <p className="mb-2 text-xs text-flow-muted">
              ค้นหาเคสผู้ป่วย ดูต้นทุนจริง เงินเรียกเก็บ และเงินที่จ่ายได้จริง พร้อม Drill-down
              รายการค่าใช้จ่าย
            </p>
            <span className="text-[11px] font-medium text-brand-600 group-hover:underline">
              เข้าใช้งาน &rarr;
            </span>
          </Link>

          <Link
            href="/drug-cost-summary"
            className="group ui-panel transition-colors hover:border-brand-400 hover:shadow-md"
          >
            <h3 className="mb-1 text-sm font-semibold text-flow-text">สรุปต้นทุนและกำไรจากยา</h3>
            <p className="mb-2 text-xs text-flow-muted">
              ดูปริมาณใช้ยา ต้นทุน มูลค่าขาย และกำไรรวม แยกตามรหัสยาและบัญชียาหลัก (สลับ OPD/IPD
              ได้ในหน้าเดียว)
            </p>
            <span className="text-[11px] font-medium text-brand-600 group-hover:underline">
              เข้าใช้งาน &rarr;
            </span>
          </Link>

          <Link
            href="/ipd-patient-cost"
            className="group ui-panel transition-colors hover:border-brand-400 hover:shadow-md"
          >
            <h3 className="mb-1 text-sm font-semibold text-flow-text">
              ตรวจสอบต้นทุนผู้ป่วย (IPD)
            </h3>
            <p className="mb-2 text-xs text-flow-muted">
              ค้นหาเคสผู้ป่วยใน ดูต้นทุนจริง เงินเรียกเก็บ และเงินที่จ่ายได้จริง พร้อม Drill-down
              รายการค่าใช้จ่าย
            </p>
            <span className="text-[11px] font-medium text-brand-600 group-hover:underline">
              เข้าใช้งาน &rarr;
            </span>
          </Link>
        </div>
      </section>

      <section className="text-sm text-flow-muted">
        <p>เวอร์ชัน: {siteConfig.version}</p>
      </section>
    </main>
  );
}
