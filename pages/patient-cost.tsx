"use client";

import { useState } from "react";

import Link from "next/link";

import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import { normalizeThaiCardInput } from "@/lib/card/normalize";
import { normalizeHnInput } from "@/lib/hn/normalize";
import { isoToThaiDisplay } from "@/lib/date/thaiDate";
import { siteConfig } from "@/config/site";

type PatientCostRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  VSTDATE: string;
  TOTAL_AMOUNT: number;
  /** รวมค่าใช้จ่าย Lab (incgrp=70 พยาธิวิทยา) */
  LAB_AMOUNT: number;
};

/** รายละเอียดต้นทุนต่อเคส แยกตามหมวดค่าใช้จ่าย — จาก API patient-cost-detail */
type PatientCostDetailRow = {
  FLG: string;
  ICD10: string;
  ICD9CM: string;
  ICD10NAME: string;
  KON: number;
  TOTAL: number;
  [key: string]: string | number;
};

type PatientDrugSummaryRow = {
  CLINIC_LCT: string | null;
  ORDER_DATE: string;
  MEDITEM: string;
  MEDTYPE: string | null;
  ACCNATION: string | null;
  DRUG_NAME: string | null;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
};

/** ค่าใช้จ่ายต่อรายการ Lab (จาก patient-lab-summary) */
type LabCostItemRow = {
  INCOME: string | null;
  INCOMENAME: string | null;
  QTY: number | null;
  PRICE: number | null;
  INCAMT: number;
};

type PatientLabSummaryRow = {
  HN: string;
  VSTDATE: string;
  LAB_COST_ITEMS: LabCostItemRow[];
  TOTAL_LAB_AMOUNT: number;
};

/** สรุป X-ray / Vaccine (จาก patient-xray-summary) */
type PatientXraySummaryRow = {
  HN: string;
  VSTDATE: string;
  HAS_XRAY: number;
  HAS_HPV4: number;
  HAS_HPV9: number;
  HAS_FLU_VACCINE: number;
};

export default function PatientCostPage() {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState<string>(todayIso);
  const [dateTo, setDateTo] = useState<string>(todayIso);
  const [hn, setHn] = useState<string>("");
  const [cardno, setCardno] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PatientCostRow[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const [selectedVisit, setSelectedVisit] = useState<{
    hn: string;
    vstdate: string;
    dspname: string;
  } | null>(null);
  const [detailData, setDetailData] = useState<PatientCostDetailRow[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [drugSummary, setDrugSummary] = useState<PatientDrugSummaryRow[] | null>(null);
  const [drugSummaryLoading, setDrugSummaryLoading] = useState(false);
  const [drugSummaryError, setDrugSummaryError] = useState<string | null>(null);
  const [labSummary, setLabSummary] = useState<PatientLabSummaryRow | null>(null);
  const [labSummaryLoading, setLabSummaryLoading] = useState(false);
  const [labSummaryError, setLabSummaryError] = useState<string | null>(null);
  const [xraySummary, setXraySummary] = useState<PatientXraySummaryRow | null>(null);
  const [xraySummaryLoading, setXraySummaryLoading] = useState(false);
  const [xraySummaryError, setXraySummaryError] = useState<string | null>(null);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoading(true);
    setError(null);
    setRows([]);
    setPage(1);

    const query = new URLSearchParams();
    query.set("d1", dateFrom);
    query.set("d2", dateTo);
    if (hn.trim()) {
      const normalizedHn = normalizeHnInput(hn);
      if (normalizedHn) {
        query.set("hn", normalizedHn);
      }
    }
    if (cardno.trim()) {
      const normalizedCard = normalizeThaiCardInput(cardno);
      if (normalizedCard) {
        query.set("cardno", normalizedCard);
      }
    }

    try {
      const res = await fetch(`/api/db/patient-cost?${query.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message ?? "ค้นหาข้อมูลไม่สำเร็จ");
        return;
      }

      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize) || 1);
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedRows = rows.slice(startIndex, endIndex);

  /**
   * แปลงวันที่จาก API (ซึ่งถูก serialize เป็น ISO UTC จาก Oracle)
   * ให้เป็นวันที่ตามเวลาเครื่อง (local) แล้วคืนค่าเป็น YYYY-MM-DD
   */
  const apiDateToIsoLocal = (value: string | Date | null | undefined): string => {
    if (value == null) return "";
    // ถ้าเป็น string จาก JSON (เช่น 2026-03-12T00:00:00.000Z)
    const d =
      typeof value === "string"
        ? new Date(value)
        : value instanceof Date
          ? value
          : new Date(String(value));
    if (Number.isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 0-11
    const day = d.getDate();
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;
  };

  const handleRowClick = async (row: PatientCostRow) => {
    const iso = apiDateToIsoLocal(row.VSTDATE);
    if (!iso) return;
    setSelectedVisit({
      hn: row.HN,
      vstdate: iso,
      dspname: row.DSPNAME ?? "",
    });
    setDetailData(null);
    setDetailError(null);
    setDrugSummary(null);
    setDrugSummaryError(null);
    setLabSummary(null);
    setLabSummaryError(null);
    setXraySummary(null);
    setXraySummaryError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/db/patient-cost-detail?hn=${encodeURIComponent(row.HN)}&vstdate=${encodeURIComponent(iso)}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setDetailError(json.message ?? "โหลดรายละเอียดไม่สำเร็จ");
        return;
      }
      setDetailData(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setDetailLoading(false);
    }

    // โหลดสรุปค่ายาต่อเคส (ตาม HN+วันที่)
    try {
      setDrugSummaryLoading(true);
      const resDrug = await fetch(
        `/api/db/patient-drug-summary?hn=${encodeURIComponent(row.HN)}&vstdate=${encodeURIComponent(iso)}`
      );
      const jsonDrug = await resDrug.json();
      if (!resDrug.ok || !jsonDrug.success) {
        setDrugSummaryError(jsonDrug.message ?? "โหลดรายละเอียดค่ายาไม่สำเร็จ");
      } else {
        setDrugSummary(Array.isArray(jsonDrug.data) ? jsonDrug.data : []);
      }
    } catch (err) {
      setDrugSummaryError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดค่ายา");
    } finally {
      setDrugSummaryLoading(false);
    }

    // โหลดสรุป Lab (ค่าใช้จ่าย) ต่อเคส
    try {
      setLabSummaryLoading(true);
      const resLab = await fetch(
        `/api/db/patient-lab-summary?hn=${encodeURIComponent(row.HN)}&vstdate=${encodeURIComponent(iso)}`
      );
      const jsonLab = await resLab.json();
      if (!resLab.ok || !jsonLab.success) {
        setLabSummaryError(jsonLab.message ?? "โหลดสรุป Lab ไม่สำเร็จ");
      } else {
        const data = Array.isArray(jsonLab.data) ? jsonLab.data : [];
        setLabSummary(data[0] ?? null);
      }
    } catch (err) {
      setLabSummaryError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดสรุป Lab");
    } finally {
      setLabSummaryLoading(false);
    }

    // โหลดสรุป X-ray / Vaccine ต่อเคส
    try {
      setXraySummaryLoading(true);
      const resXray = await fetch(
        `/api/db/patient-xray-summary?hn=${encodeURIComponent(row.HN)}&vstdate=${encodeURIComponent(iso)}`
      );
      const jsonXray = await resXray.json();
      if (!resXray.ok || !jsonXray.success) {
        setXraySummaryError(jsonXray.message ?? "โหลดสรุป X-ray/Vaccine ไม่สำเร็จ");
      } else {
        const data = Array.isArray(jsonXray.data) ? jsonXray.data : [];
        setXraySummary(data[0] ?? null);
      }
    } catch (err) {
      setXraySummaryError(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดสรุป X-ray/Vaccine"
      );
    } finally {
      setXraySummaryLoading(false);
    }
  };

  const detailColumns: { key: string; label: string }[] = [
    { key: "FLG", label: "ลำดับ" },
    { key: "ICD10", label: "กลุ่ม" },
    { key: "ICD9CM", label: "ICD-9" },
    { key: "TOTAL", label: "รวม(บาท)" },
    { key: "ห้อง", label: "ห้อง" },
    { key: "อาหาร", label: "อาหาร" },
    { key: "อวัยวะเทียม", label: "อวัยวะเทียม" },
    { key: "ยาใน", label: "ยาใน" },
    { key: "ยานอก", label: "ยานอก" },
    { key: "ยาเคมี", label: "ยาเคมี" },
    { key: "อาหารทางเส้นเลือด", label: "อาหารทางเส้นเลือด" },
    { key: "ยาที่นำไปใช้ต่อที่บ้าน", label: "ยาที่นำไปใช้ต่อที่บ้าน" },
    { key: "เวชภัณฑ์ที่มิใช่ยา", label: "เวชภัณฑ์ที่มิใช่ยา" },
    { key: "บริการโลหิต", label: "บริการโลหิต" },
    { key: "พยาธิวิทยา", label: "พยาธิวิทยา" },
    { key: "รังสีวิทยา", label: "รังสีวิทยา" },
    { key: "วินิจฉัยโดยวิธีพิเศษ", label: "วินิจฉัยโดยวิธีพิเศษ" },
    { key: "อุปกรณ์ของใช้และเครื่องมือ", label: "อุปกรณ์ของใช้และเครื่องมือ" },
    { key: "หัตถการ", label: "หัตถการ" },
    { key: "ทันตกรรม", label: "ทันตกรรม" },
    { key: "กายภาพบำบัด", label: "กายภาพบำบัด" },
    { key: "บริการทางการพยาบาล", label: "บริการทางการพยาบาล" },
    { key: "บริการทางการแพทย์", label: "บริการทางการแพทย์" },
    { key: "บริการฝังเข็ม", label: "บริการฝังเข็ม" },
  ];

  return (
    <div
      className="min-h-screen flex flex-col bg-white text-slate-800"
      style={{ fontFamily: "var(--font-thai), sans-serif" }}
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              ตรวจสอบต้นทุนรายผู้ป่วย (OPD)
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              อ้างอิงโครงสร้างข้อมูลจากตาราง OVST, INCPT, PT, PTNO, LCT และฟังก์ชัน GET_OPD_PTTYPE / GET_OPD_ICD10
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs md:text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            กลับหน้าแรก
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <section className="mb-6">
          <form
            onSubmit={handleSearch}
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 md:p-5 shadow-sm space-y-4"
          >
            <div className="flex flex-wrap gap-4">
              <ThaiDatePicker
                id="dateFrom"
                label="วันที่เริ่ม"
                value={dateFrom}
                onChange={(iso) => setDateFrom(iso)}
              />
              <ThaiDatePicker
                id="dateTo"
                label="วันที่สิ้นสุด"
                value={dateTo}
                onChange={(iso) => setDateTo(iso)}
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="hn" className="text-xs font-medium text-slate-700">
                  HN 
                </label>
                <input
                  id="hn"
                  type="text"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={hn}
                  onChange={(event) => setHn(event.target.value)}
                  placeholder="เช่น 1666/69 หรือ 69001666"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cardno" className="text-xs font-medium text-slate-700">
                  เลขบัตร 
                </label>
                <input
                  id="cardno"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={cardno}
                  onChange={(event) => {
                    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 13);
                    setCardno(digitsOnly);
                  }}
                  placeholder="เลขบัตรประชาชน 13 หลัก"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="text-[11px] md:text-xs text-slate-500">
                เงื่อนไขอื่นตาม SQL: OPD เท่านั้น (AN เป็นค่าว่าง, ไม่ถูกยกเลิก) และสิทธิรหัส 2110, 100
              </p>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs md:text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "กำลังค้นหา..." : "ค้นหาข้อมูล"}
              </button>
            </div>
          </form>
        </section>

        {error && (
          <section className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs md:text-sm text-red-800">
            {error}
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-900">
              ผลลัพธ์การค้นหา{" "}
              {rows.length > 0 ? `(${rows.length} แถว, หน้า ${currentPage}/${totalPages})` : ""}
            </h2>
            {rows.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <p>รวมยอดจากฟิลด์ INCPT.INCAMT ตามเงื่อนไขที่กำหนด</p>
                <div className="flex items-center gap-1">
                  <span>แสดงต่อหน้า:</span>
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      const newSize = Number(event.target.value) || 15;
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value={15}>15</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={1000}>1000</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {rows.length === 0 && !loading && !error && (
            <p className="text-xs md:text-sm text-slate-500">
              ยังไม่มีข้อมูลแสดง กรุณาเลือกช่วงวันที่ และเงื่อนไข แล้วกด &quot;ค้นหาข้อมูล&quot;
            </p>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full border-collapse text-xs md:text-sm text-left">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      NO.
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      วันที่รับบริการ
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      HN
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      เลขบัตรประชาชน
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      ชื่อผู้ป่วย
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      SUM(INCAMT)
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      ค่า Lab
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, index) => (
                    <tr
                      key={`${row.HN}-${row.VSTDATE}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleRowClick(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleRowClick(row);
                        }
                      }}
                      className="border-b border-slate-100 hover:bg-emerald-50 cursor-pointer"
                    >
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-right">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {isoToThaiDisplay(apiDateToIsoLocal(row.VSTDATE))}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.HN}</td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.CARDNO ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.DSPNAME ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-right">
                        {row.TOTAL_AMOUNT.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-right">
                        {Number(row.LAB_AMOUNT ?? 0).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
              <div>
                แสดงแถวที่ {rows.length === 0 ? 0 : startIndex + 1} -{" "}
                {Math.min(endIndex, rows.length)} จากทั้งหมด {rows.length} แถว
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  ก่อนหน้า
                </button>
                <span>
                  หน้า {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="mt-4 text-[11px] md:text-xs text-slate-500">
          <p>
            เวอร์ชันระบบต้นแบบ: {siteConfig.version} — API: <code>/api/db/patient-cost</code>
          </p>
        </section>
      </main>

      {/* โมดัลรายละเอียดต้นทุนต่อเคส */}
      {selectedVisit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-title"
        >
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 id="detail-modal-title" className="text-sm font-semibold text-slate-900">
                รายละเอียดต้นทุนต่อเคส (แยกตามหมวดค่าใช้จ่าย) — HN {selectedVisit.hn}
                {selectedVisit.dspname ? ` — ${selectedVisit.dspname}` : ""} — วันที่{" "}
                {isoToThaiDisplay(selectedVisit.vstdate)}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSelectedVisit(null);
                  setDetailData(null);
                  setDetailError(null);
                  setDrugSummary(null);
                  setDrugSummaryError(null);
                  setLabSummary(null);
                  setLabSummaryError(null);
                  setXraySummary(null);
                  setXraySummaryError(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                ปิด
              </button>
            </div>
            <div className="overflow-auto p-4 max-h-[calc(90vh-4rem)]">
              {detailLoading && (
                <p className="py-8 text-center text-sm text-slate-500">กำลังโหลด...</p>
              )}
              {detailError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {detailError}
                </p>
              )}
              {!detailLoading && !detailError && detailData && detailData.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">
                  ไม่มีข้อมูลรายละเอียดต้นทุนสำหรับเคสนี้
                </p>
              )}
              {!detailLoading && !detailError && detailData && detailData.length > 0 && (
                <>
                  {(() => {
                    const row = detailData[0] as unknown as Record<string, unknown>;
                    const getNum = (key: string) => {
                      const raw = row[key] ?? row[key.toUpperCase()];
                      const n =
                        raw !== undefined && raw !== null && raw !== ""
                          ? Number(raw)
                          : 0;
                      return Number.isNaN(n) ? 0 : n;
                    };

                    const total = getNum("TOTAL");
                    const room = getNum("ห้อง");
                    const drugIn = getNum("ยาใน");
                    const drugOut = getNum("ยานอก");

                    const summaryFields: { key: string; label: string }[] = [
                      { key: "TOTAL", label: "รวมทั้งหมด" },
                      { key: "ห้อง", label: "ห้อง" },
                      { key: "อาหาร", label: "อาหาร" },
                      { key: "ยาใน", label: "ยาใน" },
                      { key: "ยานอก", label: "ยานอก" },
                      { key: "เวชภัณฑ์ที่มิใช่ยา", label: "เวชภัณฑ์ที่มิใช่ยา" },
                      { key: "หัตถการ", label: "หัตถการ" },
                      { key: "บริการทางการแพทย์", label: "บริการทางการแพทย์" },
                    ];

                    return (
                      <div className="space-y-4">
                        {/* summary cards */}
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                            <p className="text-[11px] font-medium text-emerald-800">
                              ยอดรวมทั้งหมด
                            </p>
                            <p className="mt-1 text-base font-semibold text-emerald-900">
                              {total.toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              บาท
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                            <p className="text-[11px] font-medium text-slate-700">ค่าใช้จ่ายห้อง</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {room.toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              บาท
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                            <p className="text-[11px] font-medium text-slate-700">
                              ยาใน + ยานอก
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {(drugIn + drugOut).toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              บาท
                            </p>
                          </div>
                        </div>

                        {/* vertical key/value list */}
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <h3 className="mb-2 text-xs font-semibold text-slate-800">
                            รายละเอียดตามหมวดค่าใช้จ่าย
                          </h3>
                          <div className="grid gap-x-6 gap-y-1 text-[11px] md:grid-cols-2">
                            {summaryFields.map((field) => {
                              const val = getNum(field.key);
                              if (field.key !== "TOTAL" && val === 0) {
                                return null;
                              }
                              return (
                                <div
                                  key={field.key}
                                  className="flex items-center justify-between border-b border-dashed border-slate-100 py-1"
                                >
                                  <span className="text-slate-700">{field.label}</span>
                                  <span className="font-semibold text-slate-900">
                                    {val.toLocaleString("th-TH", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* สรุปค่ายาต่อเคส */}
              <div className="mt-6 border-t border-slate-200 pt-3">
                <h3 className="mb-2 text-xs font-semibold text-slate-800">
                  สรุปค่ายา (ตามรหัสยา) ในวันเดียวกัน
                </h3>
                {drugSummaryLoading && (
                  <p className="py-3 text-xs text-slate-500">กำลังโหลดข้อมูลค่ายา...</p>
                )}
                {drugSummaryError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {drugSummaryError}
                  </p>
                )}
                {!drugSummaryLoading && !drugSummaryError && drugSummary && drugSummary.length === 0 && (
                  <p className="py-3 text-xs text-slate-500">
                    ไม่มีข้อมูลใบสั่งยาสำหรับเคสนี้ในวันดังกล่าว
                  </p>
                )}
                {!drugSummaryLoading && !drugSummaryError && drugSummary && drugSummary.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-full border-collapse text-[11px] text-left">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100">
                          <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                            คลินิก (sphmlct)
                          </th>
                          <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                            รหัสยา
                          </th>
                          <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                            ชื่อยา
                          </th>
                          <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                            ประเภทยา
                          </th>
                          <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                            บัญชียาหลัก
                          </th>
                          <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap text-right">
                            จำนวนรวม
                          </th>
                          <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap text-right">
                            ต้นทุนรวม
                          </th>
                          <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap text-right">
                            มูลค่าขายรวม
                          </th>
                          <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap text-right">
                            กำไรรวม
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {drugSummary.map((drug, idx) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">
                              {drug.CLINIC_LCT ?? "—"}
                            </td>
                            <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">
                              {drug.MEDITEM}
                            </td>
                            <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">
                              {drug.DRUG_NAME ?? "—"}
                            </td>
                            <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">
                              {drug.MEDTYPE ?? "—"}
                            </td>
                            <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">
                              {drug.ACCNATION ?? "—"}
                            </td>
                            <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap text-right">
                              {Number(drug.TOTAL_QTY ?? 0).toLocaleString("th-TH")}
                            </td>
                            <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap text-right">
                              {Number(drug.TOTAL_COST ?? 0).toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap text-right">
                              {Number(drug.TOTAL_SALE ?? 0).toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap text-right">
                              {Number(drug.TOTAL_PROFIT ?? 0).toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* สรุป X-ray / Vaccine */}
              <div className="mt-6 border-t border-slate-200 pt-3">
                <h3 className="mb-2 text-xs font-semibold text-slate-800">
                  สรุป X-ray / Vaccine ในวันเดียวกัน
                </h3>
                {xraySummaryLoading && (
                  <p className="py-3 text-xs text-slate-500">กำลังโหลดข้อมูล X-ray / Vaccine...</p>
                )}
                {xraySummaryError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {xraySummaryError}
                  </p>
                )}
                {!xraySummaryLoading && !xraySummaryError && xraySummary && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px]">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <p className="font-semibold text-slate-800 mb-1">X-ray</p>
                        <p className="text-slate-700">
                          {xraySummary.HAS_XRAY ? "ทำการ X-ray แล้ว" : "ยังไม่มี X-ray"}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 mb-1">Vaccine ที่เกี่ยวข้อง</p>
                        <ul className="space-y-0.5 text-slate-700">
                          {xraySummary.HAS_HPV4 ? <li>• HPV4 vaccine</li> : null}
                          {xraySummary.HAS_HPV9 ? <li>• HPV9 vaccine</li> : null}
                          {xraySummary.HAS_FLU_VACCINE ? <li>• Influenza vaccine</li> : null}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                {!xraySummaryLoading && !xraySummaryError && !xraySummary && (
                  <p className="py-3 text-xs text-slate-500">
                    ไม่มีข้อมูล X-ray / Vaccine สำหรับเคสนี้ในวันดังกล่าว
                  </p>
                )}
              </div>

              {/* สรุปค่าใช้จ่าย Lab */}
              <div className="mt-6 border-t border-slate-200 pt-3">
                <h3 className="mb-2 text-xs font-semibold text-slate-800">
                  ค่าใช้จ่าย Lab ในวันเดียวกัน
                </h3>
                {labSummaryLoading && (
                  <p className="py-3 text-xs text-slate-500">กำลังโหลดข้อมูล Lab...</p>
                )}
                {labSummaryError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {labSummaryError}
                  </p>
                )}
                {!labSummaryLoading && !labSummaryError && labSummary && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px]">
                    <p className="font-semibold text-slate-800 mb-1.5">
                      ค่าใช้จ่ายในการตรวจแต่ละรายการ Lab ({labSummary.LAB_COST_ITEMS?.length ?? 0} รายการ)
                      {labSummary.TOTAL_LAB_AMOUNT != null && (
                        <span className="ml-2 font-semibold text-slate-900">
                          รวม {Number(labSummary.TOTAL_LAB_AMOUNT).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} บาท
                        </span>
                      )}
                    </p>
                    {labSummary.LAB_COST_ITEMS && labSummary.LAB_COST_ITEMS.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full border-collapse text-[11px] text-left">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-100">
                              <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                                รหัสรายการ
                              </th>
                              <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                                ชื่อรายการ
                              </th>
                              <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap text-right">
                                จำนวน
                              </th>
                              <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap text-right">
                                ราคา
                              </th>
                              <th className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap text-right">
                                ค่าใช้จ่าย (บาท)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {labSummary.LAB_COST_ITEMS.map((item, idx) => (
                              <tr
                                key={`${item.INCOME ?? ""}-${idx}`}
                                className="border-b border-slate-100 hover:bg-slate-50"
                              >
                                <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">
                                  {item.INCOME ?? "—"}
                                </td>
                                <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">
                                  {item.INCOMENAME ?? "—"}
                                </td>
                                <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap text-right">
                                  {item.QTY != null ? Number(item.QTY).toLocaleString("th-TH") : "—"}
                                </td>
                                <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap text-right">
                                  {item.PRICE != null
                                    ? Number(item.PRICE).toLocaleString("th-TH", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })
                                    : "—"}
                                </td>
                                <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap text-right">
                                  {Number(item.INCAMT ?? 0).toLocaleString("th-TH", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500">ไม่มีรายการค่าใช้จ่าย Lab ในวันนี้</p>
                    )}
                  </div>
                )}
                {!labSummaryLoading && !labSummaryError && !labSummary && (
                  <p className="py-3 text-xs text-slate-500">
                    ไม่มีข้อมูลค่าใช้จ่าย Lab สำหรับเคสนี้ในวันดังกล่าว
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

