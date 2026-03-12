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
  CLINICLCT: string | null;
  CLINICNAME: string | null;
  PTTYPENAME: string | null;
  TOTAL_AMOUNT: number;
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

  const vstdateToIso = (v: string | Date | null | undefined): string => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : (v as Date).toISOString?.() ?? String(v);
    return s.slice(0, 10);
  };

  const handleRowClick = async (row: PatientCostRow) => {
    const iso = vstdateToIso(row.VSTDATE);
    if (!iso) return;
    setSelectedVisit({
      hn: row.HN,
      vstdate: iso,
      dspname: row.DSPNAME ?? "",
    });
    setDetailData(null);
    setDetailError(null);
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
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      คลินิก
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      สิทธิ
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      SUM(INCAMT)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, index) => (
                    <tr
                      key={`${row.HN}-${row.VSTDATE}-${row.CLINICLCT ?? ""}`}
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
                        {isoToThaiDisplay(row.VSTDATE?.toString().slice(0, 10))}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.HN}</td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.CARDNO ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.DSPNAME ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.CLINICNAME ?? row.CLINICLCT ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.PTTYPENAME ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-right">
                        {row.TOTAL_AMOUNT.toLocaleString("th-TH", {
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
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100">
                        {detailColumns.map((col) => (
                          <th
                            key={col.key}
                            className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-800"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          {detailColumns.map((col) => {
                            const raw =
                              (row as Record<string, unknown>)[col.key] ??
                              (row as Record<string, unknown>)[col.key.toUpperCase()];
                            const val = raw !== undefined && raw !== null ? raw : null;
                            const isNum =
                              typeof val === "number" ||
                              (typeof val === "string" && val !== "" && !Number.isNaN(Number(val)));
                            return (
                              <td
                                key={col.key}
                                className={`whitespace-nowrap px-2 py-1.5 text-slate-700 ${isNum ? "text-right" : ""}`}
                              >
                                {isNum
                                  ? Number(val).toLocaleString("th-TH", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })
                                  : val != null ? String(val) : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

