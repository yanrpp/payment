"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import { formatHnDisplay } from "@/lib/hn/normalize";
import { isoToThaiDisplay, localTodayIso } from "@/lib/date/thaiDate";

type ScrubFinding = { code: string; severity: "error" | "warning" | "info"; message: string };

type ScrubRow = {
  AN: string | number;
  HN: string;
  RGTDATE: string;
  DSPNAME: string | null;
  CARDNO: string | null;
  PTTYPE_NAME: string | null;
  TOTAL_CHARGE: number;
  DRUG_ORDER_COUNT: number;
  DX_COUNT: number | null;
  NON_FORMULARY_COUNT: number;
  findings: ScrubFinding[];
};

type Summary = { total: number; withFindings: number; error: number; warning: number };
type Meta = { dxAvailable: boolean; rulesFromStore: boolean };

function apiDateToIsoLocal(value: unknown): string {
  if (value == null) return "";
  const d =
    typeof value === "string"
      ? new Date(value)
      : value instanceof Date
        ? value
        : new Date(String(value));

  if (Number.isNaN(d.getTime())) return "";

  return `${d.getFullYear().toString().padStart(4, "0")}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function formatBaht(value: unknown): string {
  return Number(value ?? 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function severityClass(sev: ScrubFinding["severity"]): string {
  if (sev === "error") return "bg-red-100 text-red-800";
  if (sev === "warning") return "bg-amber-100 text-amber-900";

  return "bg-slate-100 text-slate-700";
}

export default function MrliPreclaimScrubPage() {
  const [dateFrom, setDateFrom] = useState<string>(() => localTodayIso());
  const [dateTo, setDateTo] = useState<string>(() => localTodayIso());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ScrubRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    withFindings: 0,
    error: 0,
    warning: 0,
  });
  const [meta, setMeta] = useState<Meta>({ dxAvailable: false, rulesFromStore: false });
  const [onlyFindings, setOnlyFindings] = useState(true);
  const [mode, setMode] = useState<"ipd" | "opd">("ipd");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const idLabel = mode === "opd" ? "อ้างอิง (HN/วัน)" : "AN";
  const dateLabel = mode === "opd" ? "วันที่รับบริการ" : "วันที่รับเข้า";

  const [pttypeOptions, setPttypeOptions] = useState<string[]>([]);
  const [pttypeLoading, setPttypeLoading] = useState(true);
  const [selectedPttype, setSelectedPttype] = useState<string[]>([]);
  const [clinicOptions, setClinicOptions] = useState<string[]>([]);
  const [clinicLoading, setClinicLoading] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const runSearch = async (d1: string, d2: string, m: "ipd" | "opd" = mode) => {
    abortRef.current?.abort();
    const controller = new AbortController();

    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setRows([]);
    setPage(1);
    setHasSearched(true);

    const pttypeQuery =
      selectedPttype.length > 0 ? `&pttype=${encodeURIComponent(selectedPttype.join("|"))}` : "";
    const clinicQuery =
      selectedClinic.length > 0 ? `&clinic=${encodeURIComponent(selectedClinic.join("|"))}` : "";

    try {
      const res = await fetch(
        `/api/db/mrli-preclaim-scrub?d1=${encodeURIComponent(d1)}&d2=${encodeURIComponent(d2)}&mode=${m}${pttypeQuery}${clinicQuery}`,
        { signal: controller.signal }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        const base = json.message ?? "ค้นหาข้อมูลไม่สำเร็จ";

        setError(json.error ? `${base} — ${json.error}` : base);

        return;
      }

      setRows(Array.isArray(json.data) ? json.data : []);
      setSummary(json.summary ?? { total: 0, withFindings: 0, error: 0, warning: 0 });
      setMeta(json.meta ?? { dxAvailable: false, rulesFromStore: false });
    } catch (fetchError) {
      if (controller.signal.aborted) return;
      setError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await runSearch(dateFrom, dateTo, mode);
  };

  // เปิดหน้า: โหลดเฉพาะรายการสิทธิ/คลินิก (เบา) ยังไม่ตรวจจนกว่าจะกดค้นหา
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/db/mrli-pttype-options");
        const json = await res.json();

        if (res.ok && json.success)
          setPttypeOptions(Array.isArray(json.options) ? json.options : []);
      } catch {
        // ไม่เป็นไร — ตัวกรองสิทธิจะว่าง
      } finally {
        setPttypeLoading(false);
      }
    })();
    void (async () => {
      try {
        const res = await fetch("/api/db/mrli-clinic-options");
        const json = await res.json();

        if (res.ok && json.success)
          setClinicOptions(Array.isArray(json.options) ? json.options : []);
      } catch {
        // ไม่เป็นไร — ตัวกรองคลินิกจะว่าง
      } finally {
        setClinicLoading(false);
      }
    })();
  }, []);

  const visibleRows = useMemo(
    () => (onlyFindings ? rows.filter((r) => r.findings.length > 0) : rows),
    [rows, onlyFindings]
  );

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize) || 1);
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedRows = visibleRows.slice(startIndex, startIndex + pageSize);

  return (
    <div className="flex w-full flex-1 flex-col">
      {loading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-flow-border bg-white px-7 py-6 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            <p className="text-xs font-medium text-flow-text">กำลังตรวจสอบข้อมูล...</p>
          </div>
        </div>
      )}
      <header className="border-b border-accent-border bg-neutral-50">
        <div className="w-full px-4 py-4 md:px-6">
          <h1 className="text-xl md:text-2xl font-bold text-flow-text">
            MRLI · Pre-Claim Scrubbing (ตรวจก่อนส่งเบิก)
          </h1>
          <p className="mt-1 text-xs md:text-sm text-flow-muted">
            ตรวจความถูกต้องของ{mode === "opd" ? "ผู้ป่วยนอก (OPD)" : "ผู้ป่วยใน (IPD)"}{" "}
            ก่อนส่งเบิกตามกฎที่ตั้งไว้ — ลดอัตราการถูกปฏิเสธ (Claim Denial)
          </p>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-6 md:px-6 md:py-8">
        <section className="mb-6">
          <form
            className="rounded-xl border border-accent-border bg-white p-4 shadow-sm space-y-4"
            onSubmit={handleSearch}
          >
            <div className="inline-flex rounded-lg border border-flow-border bg-white p-1 text-xs">
              {(["ipd", "opd"] as const).map((m) => (
                <button
                  key={m}
                  className={`rounded-md px-3 py-1.5 font-medium ${
                    mode === m ? "bg-brand-500 text-white" : "text-flow-text hover:bg-flow-input"
                  }`}
                  type="button"
                  onClick={() => {
                    if (mode === m) return;
                    setMode(m);
                    setPage(1);
                    setRows([]);
                    setHasSearched(false);
                    setSelectedClinic([]);
                  }}
                >
                  {m === "ipd" ? "ผู้ป่วยใน (IPD)" : "ผู้ป่วยนอก (OPD)"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ThaiDatePicker
                id="dateFrom"
                label={`${dateLabel} (จาก)`}
                value={dateFrom}
                onChange={(iso) => setDateFrom(iso)}
              />
              <ThaiDatePicker
                id="dateTo"
                label={`${dateLabel} (ถึง)`}
                value={dateTo}
                onChange={(iso) => setDateTo(iso)}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] md:text-xs text-flow-text">
                <input
                  checked={onlyFindings}
                  className="ui-checkbox"
                  type="checkbox"
                  onChange={(e) => {
                    setOnlyFindings(e.target.checked);
                    setPage(1);
                  }}
                />
                แสดงเฉพาะรายการที่พบปัญหา
              </label>
              <button
                className="ui-btn-primary text-xs md:text-sm"
                disabled={loading}
                type="submit"
              >
                {loading ? "กำลังตรวจ..." : "ตรวจสอบ (Scrub)"}
              </button>
            </div>
            <div className={`grid gap-4 ${mode === "opd" ? "md:grid-cols-2" : ""}`}>
              <div>
                <p className="mb-1 text-[11px] font-medium text-flow-text">กรองตามสิทธิการรักษา</p>
                <MultiSelectFilter
                  label="สิทธิ"
                  loading={pttypeLoading}
                  options={pttypeOptions}
                  selected={selectedPttype}
                  onChange={setSelectedPttype}
                />
              </div>
              {mode === "opd" && (
                <div>
                  <p className="mb-1 text-[11px] font-medium text-flow-text">กรองตามคลินิก</p>
                  <MultiSelectFilter
                    label="คลินิก"
                    loading={clinicLoading}
                    options={clinicOptions}
                    selected={selectedClinic}
                    onChange={setSelectedClinic}
                  />
                </div>
              )}
            </div>
            <p className="text-[10px] text-flow-muted">
              ไม่เลือก = ทั้งหมด · เลือกแล้วระบบจะกรองตอนตรวจ (ช่วยให้โหลดเร็วขึ้น)
            </p>
            {rows.length > 0 && (!meta.dxAvailable || !meta.rulesFromStore) && (
              <p className="text-[10px] text-amber-700">
                หมายเหตุ:{" "}
                {!meta.dxAvailable && "ไม่พบตารางวินิจฉัย (กฎ 'ไม่มีรหัสวินิจฉัย' ถูกข้าม) "}
                {!meta.rulesFromStore &&
                  "MySQL ไม่พร้อม — ใช้กฎค่าเริ่มต้น (แก้กฎไม่ได้จนกว่าจะตั้งค่า store)"}
              </p>
            )}
          </form>
        </section>

        {error && (
          <section className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs md:text-sm text-red-800">
            {error}
          </section>
        )}

        {rows.length > 0 && (
          <section className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">ตรวจทั้งหมด</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-flow-text">
                {summary.total.toLocaleString("th-TH")} {idLabel}
              </p>
            </div>
            <div className="rounded-xl border border-green-300 bg-green-50 px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-green-700">ผ่าน (ไม่พบปัญหา)</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-green-900">
                {(summary.total - summary.withFindings).toLocaleString("th-TH")} {idLabel}
              </p>
            </div>
            <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-red-700">มีข้อผิดพลาด (error)</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-red-900">
                {summary.error.toLocaleString("th-TH")} {idLabel}
              </p>
            </div>
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-amber-700">เตือน (warning)</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-amber-900">
                {summary.warning.toLocaleString("th-TH")} {idLabel}
              </p>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-flow-text">
            {rows.length > 0
              ? `ผลตรวจ (${visibleRows.length.toLocaleString("th-TH")} ${idLabel}, หน้า ${currentPage}/${totalPages})`
              : "ผลตรวจ"}
          </h2>

          {!hasSearched && !loading && (
            <p className="text-xs md:text-sm text-flow-muted">
              เลือกช่วงวันที่และสิทธิการรักษา (ถ้าต้องการกรอง) แล้วกด &quot;ตรวจสอบ (Scrub)&quot;
              เพื่อแสดงผล
            </p>
          )}

          {visibleRows.length === 0 && rows.length > 0 && !loading && (
            <p className="text-xs md:text-sm text-flow-muted">
              ไม่พบรายการที่มีปัญหาในช่วงวันที่นี้ 🎉
            </p>
          )}

          {visibleRows.length > 0 && (
            <div className="mb-4 w-full overflow-x-auto rounded-xl border border-flow-border bg-white shadow-sm">
              <table className="w-full min-w-full border-separate border-spacing-0 text-xs md:text-sm text-left">
                <thead>
                  <tr className="bg-black">
                    {[
                      "NO.",
                      dateLabel,
                      idLabel,
                      "HN",
                      "ชื่อผู้ป่วย",
                      "สิทธิการรักษา",
                      "ค่าใช้จ่ายรวม",
                      "ผลการตรวจ",
                    ].map((h) => (
                      <th
                        key={h}
                        className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, index) => (
                    <tr
                      key={`${row.AN}-${index}`}
                      className={`border-b border-slate-100 ${
                        row.findings.some((f) => f.severity === "error") ? "bg-red-50/50" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-right text-flow-text whitespace-nowrap">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap">
                        {isoToThaiDisplay(apiDateToIsoLocal(row.RGTDATE))}
                      </td>
                      <td className="px-3 py-2 font-medium text-flow-text whitespace-nowrap">
                        {row.AN}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap">
                        {formatHnDisplay(row.HN)}
                      </td>
                      <td className="px-3 py-2 text-flow-text">{row.DSPNAME ?? "—"}</td>
                      <td className="px-3 py-2 text-flow-text">{row.PTTYPE_NAME ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-flow-text whitespace-nowrap">
                        {formatBaht(row.TOTAL_CHARGE)}
                      </td>
                      <td className="px-3 py-2">
                        {row.findings.length === 0 ? (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
                            ผ่าน
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {row.findings.map((f) => (
                              <span
                                key={f.code}
                                className={`inline-block w-fit rounded px-1.5 py-0.5 text-[10px] font-medium ${severityClass(
                                  f.severity
                                )}`}
                              >
                                {f.message}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {visibleRows.length > 0 && (
            <div className="flex items-center justify-end gap-2 text-[11px] text-flow-muted">
              <button
                className="rounded border border-flow-border bg-white px-2 py-0.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-flow-input"
                disabled={currentPage <= 1}
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ก่อนหน้า
              </button>
              <span>
                หน้า {currentPage} / {totalPages}
              </span>
              <button
                className="rounded border border-flow-border bg-white px-2 py-0.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-flow-input"
                disabled={currentPage >= totalPages}
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ถัดไป
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
