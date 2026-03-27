"use client";

import { siteConfig } from "@/config/site";

export default function SystemOverviewPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                ภาพรวมการออกแบบระบบวิเคราะห์ค่าใช้จ่ายผู้ป่วย
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                เอกสารอธิบายโครงสร้างข้อมูล โมเดลต้นทุน และแดชบอร์ดสำหรับผู้บริหาร
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-100">
                System Design Overview
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* HERO / EXECUTIVE SUMMARY */}
        <section className="mb-12">
          <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1.25fr)] items-start">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-slate-900 mb-4">
                บทสรุปผู้บริหาร — ระบบวิเคราะห์ค่าใช้จ่ายผู้ป่วย &amp; เงินเข้า-ออก
              </h2>
              <p className="text-sm md:text-base text-slate-700 leading-relaxed">
                รายงานฉบับนี้เสนอแนวทางออกแบบระบบตรวจสอบและวิเคราะห์ค่าใช้จ่ายผู้ป่วย
                เพื่อนำเสนอข้อมูล &quot;เงินเข้า-ออก&quot; ในระดับรายคน รายคลินิก และรายแผนก
                โดยเชื่อมโยงข้อมูลจากระบบคลินิก (HIS/EMR) เข้ากับข้อมูลการเงินและบัญชี
                เพื่อให้โรงพยาบาลสามารถติดตามต้นทุนต่อเนื่อง (cost per episode) ได้อย่างครบถ้วน
                รองรับการวิเคราะห์ต้นทุน-รายได้เชิงกลยุทธ์ และช่วยปรับปรุงประสิทธิภาพการใช้ทรัพยากรในภาพรวม
              </p>
              <p className="mt-4 text-sm md:text-base text-slate-700 leading-relaxed">
                ผลลัพธ์จากระบบจะถูกนำเสนอผ่านชุดแดชบอร์ดและรายงานเชิงมิติ
                ที่ช่วยให้ผู้บริหาร ฝ่ายการเงิน และหัวหน้าหน่วยงาน
                มองเห็นจุดที่มีต้นทุนสูงกว่ามาตรฐาน ตรวจจับค่าใช้จ่ายที่ไม่จำเป็น
                และสนับสนุนการตัดสินใจด้านงบประมาณ การจัดสรรทรัพยากร และการยกระดับคุณภาพบริการอย่างยั่งยืน
              </p>
            </div>
            <aside className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                แผนผังเนื้อหา
              </h3>
              <ol className="space-y-2 text-xs md:text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span>วัตถุประสงค์ระบบ &amp; กลุ่มผู้ใช้งานเป้าหมาย</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    2
                  </span>
                  <span>ขอบเขตข้อมูลทางคลินิก &amp; การเงินที่ต้องเก็บ</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    3
                  </span>
                  <span>โมเดลข้อมูล (Star Schema) &amp; โครงสร้างฐานข้อมูล</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    4
                  </span>
                  <span>KPI ทางการเงิน &amp; การดำเนินงานที่ควรติดตาม</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    5
                  </span>
                  <span>ตัวอย่างรายงาน &amp; แดชบอร์ดวิเคราะห์</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    6
                  </span>
                  <span>กระบวนการ ETL &amp; การเชื่อมต่อ HIS/EMR/บัญชี</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    7
                  </span>
                  <span>การจัดการสิทธิ์ &amp; ความเป็นส่วนตัว (PDPA)</span>
                </li>
              </ol>
            </aside>
          </div>
        </section>

        {/* 1) วัตถุประสงค์ & ผู้ใช้งาน */}
        <section id="objectives" className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold">
              1
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-slate-900">
              วัตถุประสงค์ระบบ &amp; กลุ่มผู้ใช้งานเป้าหมาย
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                วัตถุประสงค์หลักของระบบ
              </h3>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1.5">
                <li>
                  เก็บรวมรวมและวิเคราะห์ข้อมูลค่าใช้จ่ายรักษาพยาบาลของผู้ป่วย
                  ทั้งต้นทุนจริง เงินที่เรียกเก็บ และเงินที่จ่ายได้จริง
                </li>
                <li>
                  รองรับการวิเคราะห์หลายมิติ เช่น รายคน รายคลินิก รายแผนก
                  รายโครงการ และราย DRG/กลุ่มโรค
                </li>
                <li>
                  ตรวจสอบความคุ้มค่าและประสิทธิภาพการใช้ทรัพยากรทางการแพทย์อย่างต่อเนื่อง
                </li>
                <li>สนับสนุนการปรับปรุงคุณภาพบริการและลดค่าใช้จ่ายที่ไม่จำเป็น</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                กลุ่มผู้ใช้งานเป้าหมาย
              </h3>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1.5">
                <li>
                  ผู้บริหารระดับสูงและระดับกลาง ที่ต้องการภาพรวมต้นทุน-รายได้ของโรงพยาบาล
                </li>
                <li>
                  ฝ่ายการเงิน / บัญชี และฝ่ายวางแผนงบประมาณ
                  ที่ต้องการวิเคราะห์ประสิทธิภาพการใช้จ่ายและการเก็บเงิน
                </li>
                <li>
                  หัวหน้าคลินิก/แผนก
                  ที่ต้องการเห็นผลการดำเนินงานของหน่วยงานตนเองเทียบกับเป้าหมาย
                </li>
                <li>
                  หน่วยควบคุมคุณภาพและทีมวิเคราะห์ข้อมูล
                  ที่สนับสนุนการตัดสินใจเชิงกลยุทธ์ของโรงพยาบาล
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 2) ขอบเขตข้อมูล */}
        <section id="data-scope" className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-slate-900">
              ขอบเขตข้อมูลที่ต้องเก็บในระบบ
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 text-sm text-slate-700">
              <h3 className="text-sm font-semibold text-slate-900">
                ข้อมูลหลักที่เกี่ยวข้องกับผู้ป่วย &amp; รายการค่าใช้จ่าย
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  รายการค่าใช้จ่าย (Charges/Billing): ค่ารักษา ค่าห้อง
                  ค่ายา/เวชภัณฑ์ วัสดุสิ้นเปลือง ค่าแพทย์-พยาบาล และค่าบริการอื่น ๆ
                </li>
                <li>
                  ข้อมูลผู้ป่วย: รหัสผู้ป่วย (PatientID) ชื่อ อายุ เพศ
                  และประวัติการรักษา (ICD, หัตถการ, episode การรักษา)
                </li>
                <li>
                  ข้อมูลการชำระเงิน: รายการชำระจริงของผู้ป่วย
                  สถานะการชำระ และบัญชีลูกหนี้
                </li>
                <li>
                  สิทธิการรักษา/ประกัน: แหล่งเงินทุน วงเงิน เงื่อนไขการชดเชย
                  และอัตราค่าบริการตามสิทธิ
                </li>
              </ul>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <h3 className="text-sm font-semibold text-slate-900">
                ข้อมูลหน่วยงาน บุคลากร &amp; มิติเวลา
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  ข้อมูลคลินิก/หน่วยงาน: ClinicID, Clinic Name, Department
                  และอัตราค่าบริการประจำหน่วย
                </li>
                <li>
                  ข้อมูลบุคลากร: DoctorID, NurseID, แพทย์/พยาบาลผู้รับผิดชอบในแต่ละเคส
                </li>
                <li>
                  รหัสเวชระเบียนและมาตรฐานรหัส: ICD-10, Procedure Code
                  สำหรับการจัดกลุ่มวิเคราะห์ (เช่น DRG)
                </li>
                <li>
                  ต้นทุนจริง (Actual Cost) และต้นทุนมาตรฐาน (Standard Cost)
                  พร้อมเวลาที่ให้บริการ (Time Dimension)
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-xs md:text-sm text-slate-600">
            ทุกข้อมูลจะถูกเชื่อมโยงด้วยรหัสอ้างอิงสำคัญ เช่น PatientID, VisitID,
            ServiceID, ClinicID, DoctorID, InsuranceID เพื่อสร้างมุมมองข้อมูลแบบรวมศูนย์
            และรองรับการวิเคราะห์เชิงมิติในระดับ Data Warehouse
          </p>
        </section>

        {/* 3) โมเดลข้อมูล */}
        <section id="data-model" className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold">
              3
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-slate-900">
              โมเดลข้อมูล &amp; โครงสร้างฐานข้อมูล (Dimensional / Star Schema)
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)]">
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                โครงสร้างระดับ Entity หลัก
              </h3>
              <p className="text-sm text-slate-700 mb-3">
                ระบบใช้แนวคิด Dimensional Modeling (Star Schema)
                โดยมีตาราง Fact สำหรับรายการค่าใช้จ่ายต่อ Visit/Transaction
                และตาราง Dimension สำหรับมิติการวิเคราะห์ต่าง ๆ
              </p>
              <div className="grid gap-3 text-xs md:text-sm text-slate-700 md:grid-cols-2">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <h4 className="font-semibold text-slate-900 mb-1">
                    FACT: TRANSACTION / VISIT
                  </h4>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>trans_id (PK)</li>
                    <li>visit_id (FK)</li>
                    <li>charge_item</li>
                    <li>charge_amount / payment_amount</li>
                    <li>cost_actual / cost_standard</li>
                  </ul>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <h4 className="font-semibold text-slate-900 mb-1">
                    DIMENSIONS สำคัญ
                  </h4>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>PATIENT (patient_id, demographics)</li>
                    <li>CLINIC / DEPARTMENT</li>
                    <li>DOCTOR / NURSE</li>
                    <li>INSURANCE / FINANCIAL PLAN</li>
                    <li>TIME_DIM (date_id, year, month, day, weekday)</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5 shadow-inner">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                ตรรกะ Fact Table ตามมิติการวิเคราะห์
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                        มิติการวิเคราะห์
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                        Grain หลัก
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                        Fact ที่เกี่ยวข้อง
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        รายคน (Patient-level)
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        ค่าใช้จ่ายต่อผู้ป่วยต่อเคส (Visit)
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        Fact_PatientExpense (PatientID, VisitID, Charge, Paid, Cost)
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        รายคลินิก (Clinic-level)
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        ค่าใช้จ่ายรวมต่อคลินิกต่อช่วงเวลา
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        Fact_ClinicExpense (ClinicID, DateID, TotalCharge, TotalCost)
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        รายแผนก (Department)
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        ค่าใช้จ่ายรวมต่อแผนก (รวมหลายคลินิก)
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        Fact_DeptExpense (DeptID, DateID, TotalCharge, TotalCost)
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        รายโครงการ / แหล่งทุน
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        ค่าใช้จ่ายตามโครงการหรือแหล่งทุน
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        Fact_ProjectExpense (ProjectID, DateID, ClinicID, TotalCharge, TotalCost)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-600">
                การออกแบบแยก Fact ตาม Grain ทำให้สามารถสร้างรายงานและแดชบอร์ดเฉพาะมุมมอง
                ได้โดยไม่ซ้ำซ้อน และยังคงใช้ Dimension ร่วมกันเพื่อวิเคราะห์ข้ามมิติได้
              </p>
            </div>
          </div>
        </section>

        {/* 4) KPIs */}
        <section id="kpis" className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold">
              4
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-slate-900">
              ดัชนีวัดผล (KPIs) ทางการเงิน &amp; การดำเนินงาน
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                ตัวชี้วัดด้านต้นทุน &amp; รายได้
              </h3>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1.5">
                <li>ต้นทุนเฉลี่ยต่อผู้ป่วย / ต่อเคส (Average Cost per Patient / Episode)</li>
                <li>รายได้เฉลี่ยต่อผู้ป่วย (Average Revenue per Patient)</li>
                <li>กำไรสุทธิต่อรายได้ (Operating Margin)</li>
                <li>อัตราต้นทุนต่อรายได้ (Cost-to-Charge Ratio)</li>
                <li>ต้นทุนเฉลี่ยต่อกลุ่มโรค (Cost per ICD/DRG)</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                ตัวชี้วัดด้านการเก็บเงิน &amp; คุณภาพบริการ
              </h3>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1.5">
                <li>อัตราการเก็บเงิน (Collection Rate)</li>
                <li>วันลูกหนี้ (Accounts Receivable Days)</li>
                <li>อัตราการปฏิเสธเคลม (Claim Denial Rate)</li>
                <li>สัดส่วนต้นทุนตามหมวด (ยา, เวชภัณฑ์, ห้องปฏิบัติการ, หัตถการ ฯลฯ)</li>
                <li>ตัวชี้วัดเสริม เช่น รายได้ต่อแพทย์ อัตราการครอบครองเตียง ฯลฯ</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 5) รายงาน & แดชบอร์ด */}
        <section id="dashboards" className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold">
              5
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-slate-900">
              รายงาน &amp; แดชบอร์ดวิเคราะห์ที่แนะนำ
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                แดชบอร์ดสรุปต้นทุน &amp; รายได้
              </h3>
              <p className="text-sm text-slate-700 mb-2">
                แสดงแนวโน้มต้นทุนและรายได้รวมของโรงพยาบาลแบบรายวัน/เดือน
                เทียบเป้าหมายและเทียบย้อนหลัง
              </p>
              <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                <li>กราฟเส้น Trend ต้นทุน/รายได้</li>
                <li>สรุป Operating Margin รายเดือน</li>
                <li>ตัวกรองช่วงเวลา &amp; แหล่งทุน</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                แดชบอร์ดเปรียบเทียบตามคลินิก/แผนก
              </h3>
              <p className="text-sm text-slate-700 mb-2">
                ใช้สำหรับหัวหน้าคลินิกและผู้บริหาร
                ในการเปรียบเทียบผลการดำเนินงานของแต่ละหน่วยงาน
              </p>
              <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                <li>กราฟแท่งเปรียบเทียบต้นทุน &amp; รายได้ต่อคลินิก</li>
                <li>กราฟวงกลมสัดส่วนต้นทุนตามหมวด</li>
                <li>ฟิลเตอร์คลินิก, แผนก, ICD group, สิทธิประกัน</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                รายงานต้นทุนต่อผู้ป่วย &amp; เคส
              </h3>
              <p className="text-sm text-slate-700 mb-2">
                ตาราง Drill-down แสดงรายละเอียดต้นทุนต่อผู้ป่วย
                พร้อมรายการค่าใช้จ่ายที่ประกอบกันเป็นต้นทุนรวม
              </p>
              <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                <li>รายชื่อผู้ป่วย/Visit พร้อม Cost &amp; Charge</li>
                <li>Drill-down ไปยังระดับรายการค่าใช้จ่าย (Item Level)</li>
                <li>ส่งออกข้อมูลไป BI Tool (Power BI / Tableau ฯลฯ)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 6) ETL & Integration */}
        <section id="etl" className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold">
              6
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-slate-900">
              กระบวนการ ETL &amp; การเชื่อมต่อ HIS/EMR/บัญชี
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)]">
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                ขั้นตอนหลักของ ETL
              </h3>
              <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1.5">
                <li>
                  <span className="font-semibold">Extract:</span>{" "}
                  ดึงข้อมูลจาก HIS/EMR, ระบบบัญชี, ระบบประกันสุขภาพ/บัตรทอง
                  ผ่านมาตรฐาน HL7/FHIR, API หรือไฟล์ส่งออก
                </li>
                <li>
                  <span className="font-semibold">Transform:</span>{" "}
                  ทำความสะอาดและแปลงข้อมูลให้เป็นมาตรฐานเดียวกัน
                  ลบข้อมูลซ้ำ แก้ความไม่สอดคล้อง และปรับรหัสให้เป็นมาตรฐาน (ICD-10,
                  SNOMED CT ฯลฯ)
                </li>
                <li>
                  <span className="font-semibold">Load:</span>{" "}
                  บันทึกข้อมูลเข้าสู่ Data Warehouse
                  ทั้งแบบ Batch (รายวัน/รายคืน) และแบบใกล้เคียง Real-time
                  สำหรับเหตุการณ์สำคัญ
                </li>
              </ol>
              <p className="mt-3 text-xs text-slate-600">
                ผลลัพธ์คือ Single Source of Truth สำหรับข้อมูลต้นทุน-รายได้ของโรงพยาบาล
                เหมาะสำหรับระบบ BI และ Dashboard ต่อยอด
              </p>
            </div>
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4 md:p-5">
              <h3 className="text-sm font-semibold text-emerald-900 mb-2">
                มุมมองการไหลของข้อมูลสู่แดชบอร์ด
              </h3>
              <p className="text-xs md:text-sm text-emerald-900 mb-3">
                ข้อมูลจากคลังข้อมูล (Data Warehouse) จะถูกส่งต่อไปยังแดชบอร์ดหลายชุด
                สำหรับกลุ่มผู้ใช้ต่างกัน เช่น ศูนย์บัญชีและหัวหน้าคลินิก
              </p>
              <div className="text-[11px] md:text-xs font-mono text-emerald-900 whitespace-pre-wrap leading-relaxed">
                ระบบต้นทาง (HIS / EMR / Billing / Insurance)
                {"\n"}        ↓  ETL (Extract / Transform / Load)
                {"\n"}        Data Warehouse (Fact &amp; Dimension)
                {"\n"}
                {"n"}        ├─ Dashboard ศูนย์บัญชี
                {"\n"}        │    ├─ Trend ต้นทุนรายเดือน
                {"\n"}        │    └─ ตารางต้นทุนต่อเคส
                {"\n"}        └─ Dashboard รายงานคลินิก
                {"\n"}             ├─ กราฟเปรียบเทียบต้นทุนตามคลินิก
                {"\n"}             └─ กราฟสัดส่วนต้นทุนตามหมวด
              </div>
            </div>
          </div>
        </section>

        {/* 7) PDPA & Security */}
        <section id="security" className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold">
              7
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-slate-900">
              การจัดการสิทธิ์ &amp; ความเป็นส่วนตัว (PDPA / มาตรฐานความปลอดภัย)
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                หลักการออกแบบด้าน Privacy &amp; Security
              </h3>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1.5">
                <li>
                  ใช้ Role-based Access Control จำกัดการเข้าถึงข้อมูลตามบทบาทหน้าที่
                </li>
                <li>
                  บังคับใช้การยืนยันตัวตนที่รัดกุม (เช่น Multi-factor Authentication)
                </li>
                <li>
                  เข้ารหัสข้อมูลทั้งระหว่างส่ง (TLS/SSL) และระหว่างจัดเก็บ
                </li>
                <li>
                  เก็บ Audit Log กิจกรรมสำคัญเพื่อรองรับการตรวจสอบย้อนหลัง
                </li>
                <li>
                  ยึดหลัก Privacy by Design และ Data Minimization
                  โดยเก็บเฉพาะข้อมูลเท่าที่จำเป็น
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                การปฏิบัติตาม PDPA &amp; มาตรฐานสากล
              </h3>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1.5">
                <li>ปฏิบัติตาม PDPA พ.ศ. 2562 สำหรับข้อมูลสุขภาพซึ่งเป็น Sensitive Data</li>
                <li>
                  สามารถออกแบบให้สอดคล้องกับมาตรฐาน ISO/IEC 27001 และ 27799
                  รวมถึงแนวทาง HIPAA/GDPR ในกรณีใช้โครงสร้างพื้นฐานคลาวด์
                </li>
                <li>
                  รองรับการทำ Pseudonymization / De-identification
                  เมื่อใช้ข้อมูลเพื่อวิเคราะห์ในมุมมองเชิงสถิติ
                </li>
                <li>
                  กำหนดบทบาท DPO หรือเจ้าหน้าที่คุ้มครองข้อมูล
                  สำหรับกำกับและตรวจสอบการใช้งานระบบเป็นระยะ
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="text-sm text-slate-600">
          <p>เวอร์ชันระบบต้นแบบ: {siteConfig.version}</p>
        </section>
      </main>
    </div>
  );
}

