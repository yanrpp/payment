"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import { isoToThaiDisplay } from "@/lib/date/thaiDate";
import { siteConfig } from "@/config/site";

type DrugCostSummaryRow = {
  MEDITEM: string;
  MEDTYPE: string | null;
  ACCNATION: string | null;
  DRUG_NAME: string | null;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
};

export default function DrugCostSummaryPage() {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState<string>(todayIso);
  const [dateTo, setDateTo] = useState<string>(todayIso);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DrugCostSummaryRow[]>([]);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoading(true);
    setError(null);
    setRows([]);
    setPage(1);

    const query = new URLSearchParams();
    query.set("d1", dateFrom);
    query.set("d2", dateTo);

    try {
      const res = await fetch(`/api/db/drug-cost-summary?${query.toString()}`);
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

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.qty += r.TOTAL_QTY ?? 0;
        acc.cost += r.TOTAL_COST ?? 0;
        acc.sale += r.TOTAL_SALE ?? 0;
        acc.profit += r.TOTAL_PROFIT ?? 0;
        return acc;
      },
      { qty: 0, cost: 0, sale: 0, profit: 0 }
    );
  }, [rows]);

  return (
    <div
      className="min-h-screen flex flex-col bg-white text-slate-800"
      style={{ fontFamily: "var(--font-thai), sans-serif" }}
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              สรุปต้นทุนและกำไรจากยา (ตามรายการยา)
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              ข้อมูลจาก PRSC / PRSCDT / MEDITEM — รวมตามรหัสยาและช่วงวันที่สั่งยา
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
        {/* ฟอร์มค้นหา */}
        <section className="mb-6">
          <form
            onSubmit={handleSearch}
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 md:p-5 shadow-sm space-y-4"
          >
            <div className="flex flex-wrap gap-4">
              <ThaiDatePicker
                id="dateFrom"
                label="วันที่เริ่ม (prscdate จาก)"
                value={dateFrom}
                onChange={(iso) => setDateFrom(iso)}
              />
              <ThaiDatePicker
                id="dateTo"
                label="วันที่สิ้นสุด (prscdate ถึง)"
                value={dateTo}
                onChange={(iso) => setDateTo(iso)}
              />
            </div>
            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="text-[11px] md:text-xs text-slate-500">
                ดึงข้อมูลจากใบสั่งยา (PRSC / PRSCDT) ตามช่วงวันที่ prscdate ที่ระบุ แล้วรวมตามรหัสยา
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

        {/* error */}
        {error && (
          <section className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs md:text-sm text-red-800">
            {error}
          </section>
        )}

        {/* SUMMARY CARDS */}
        {rows.length > 0 && (
          <section className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
              <p className="text-[11px] font-medium text-emerald-800">จำนวนรายการยา</p>
              <p className="mt-1 text-base font-semibold text-emerald-900">
                {rows.length.toLocaleString("th-TH")} รายการ
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-medium text-slate-700">จำนวนรวม (เม็ดยา/หน่วย)</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {totals.qty.toLocaleString("th-TH")} หน่วย
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-medium text-slate-700">ต้นทุนรวม</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {totals.cost.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                บาท
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-medium text-slate-700">กำไรรวม (sale - cost)</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {totals.profit.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                บาท
              </p>
            </div>
          </section>
        )}

        {/* ตารางผลลัพธ์ */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-900">
              ผลลัพธ์การค้นหา{" "}
              {rows.length > 0 ? `(${rows.length} แถว, หน้า ${currentPage}/${totalPages})` : ""}
            </h2>
            {rows.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <p>
                  ช่วงวันที่{" "}
                  {isoToThaiDisplay(dateFrom)} – {isoToThaiDisplay(dateTo)}
                </p>
                <div className="flex items-center gap-1">
                  <span>แสดงต่อหน้า:</span>
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      const newSize = Number(event.target.value) || 50;
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={500}>500</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {rows.length === 0 && !loading && !error && (
            <p className="text-xs md:text-sm text-slate-500">
              ยังไม่มีข้อมูลแสดง กรุณาเลือกช่วงวันที่ แล้วกด &quot;ค้นหาข้อมูล&quot;
            </p>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full border-collapse text-xs md:text-sm text-left">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">NO.</th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      รหัสยา
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      ชื่อยา
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      ประเภทยา
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      บัญชียาหลัก
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      จำนวนรวม
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      ต้นทุนรวม
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      มูลค่าขายรวม
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      กำไรรวม
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, index) => (
                    <tr
                      key={`${row.MEDITEM}-${index}`}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-right">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.MEDITEM}</td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.DRUG_NAME ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.MEDTYPE ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.ACCNATION ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-right">
                        {Number(row.TOTAL_QTY ?? 0).toLocaleString("th-TH")}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-right">
                        {Number(row.TOTAL_COST ?? 0).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-right">
                        {Number(row.TOTAL_SALE ?? 0).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-right">
                        {Number(row.TOTAL_PROFIT ?? 0).toLocaleString("th-TH", {
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
            เวอร์ชันระบบต้นแบบ: {siteConfig.version} — API:{" "}
            <code>/api/db/drug-cost-summary</code>
          </p>
        </section>
      </main>
    </div>
  );
}

