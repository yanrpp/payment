"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import { formatHnDisplay } from "@/lib/hn/normalize";
import { isoToThaiDisplay, localTodayIso } from "@/lib/date/thaiDate";

type WorklistRow = {
  AN: string | number;
  HN: string;
  RGTDATE: string;
  DSPNAME: string | null;
  CARDNO: string | null;
  PTTYPE_NAME: string | null;
  TOTAL_CHARGE: number;
  CHARGE_ITEM_COUNT: number;
  DRUG_ORDER_COUNT: number;
  DX_COUNT: number | null;
  DCH_DATE: string | null;
};

type Meta = { dxAvailable: boolean; dischargeAvailable: boolean };

type ClaimStatusRow = {
  status: string;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
};

const STATUS_OPTIONS = ["pending", "reviewed", "submitted", "rejected", "no_claim"] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: "รอดำเนินการ",
  reviewed: "ตรวจแล้ว",
  submitted: "ส่งเบิกแล้ว",
  rejected: "ถูกปฏิเสธ",
  no_claim: "ไม่เบิก",
};

function apiDateToIsoLocal(value: unknown): string {
  if (value == null) return "";
  const d =
    typeof value === "string"
      ? new Date(value)
      : value instanceof Date
        ? value
        : new Date(String(value));

  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function formatBaht(value: unknown): string {
  return Number(value ?? 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** รายการ "รอตรวจสอบ/ทำเบิก" = ไม่มีค่าใช้จ่าย หรือ (รู้ Dx แล้วแต่ไม่มี Dx) */
function isIncomplete(row: WorklistRow): boolean {
  if (Number(row.TOTAL_CHARGE ?? 0) <= 0) return true;
  if (row.DX_COUNT !== null && Number(row.DX_COUNT) <= 0) return true;

  return false;
}

export default function MrliRevenueWorklistPage() {
  const [dateFrom, setDateFrom] = useState<string>(() => localTodayIso());
  const [dateTo, setDateTo] = useState<string>(() => localTodayIso());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<WorklistRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ dxAvailable: false, dischargeAvailable: false });
  const [onlyIncomplete, setOnlyIncomplete] = useState(true);
  const [mode, setMode] = useState<"ipd" | "opd">("ipd");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const idLabel = mode === "opd" ? "อ้างอิง (HN/วัน)" : "AN";
  const dateLabel = mode === "opd" ? "วันที่รับบริการ" : "วันที่รับเข้า";

  const [statuses, setStatuses] = useState<Record<string, ClaimStatusRow>>({});
  const [storeUnavailable, setStoreUnavailable] = useState(false);
  const [actor, setActor] = useState<string>("");

  const [pttypeOptions, setPttypeOptions] = useState<string[]>([]);
  const [pttypeLoading, setPttypeLoading] = useState(true);
  const [selectedPttype, setSelectedPttype] = useState<string[]>([]);
  const [clinicOptions, setClinicOptions] = useState<string[]>([]);
  const [clinicLoading, setClinicLoading] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("mrli_actor") : null;

    if (saved) setActor(saved);
  }, []);

  const handleActorChange = (v: string) => {
    setActor(v);
    if (typeof window !== "undefined") window.localStorage.setItem("mrli_actor", v);
  };

  // โหลดสถานะการเบิกทั้งหมด (ตารางมีเฉพาะ AN ที่เคยบันทึก) เมื่อผลลัพธ์เปลี่ยน
  useEffect(() => {
    if (rows.length === 0) {
      setStatuses({});

      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/db/mrli-claim-status");
        const json = await res.json();

        if (cancelled) return;
        if (res.ok && json.success) {
          setStatuses(json.statuses ?? {});
          setStoreUnavailable(false);
        } else {
          setStoreUnavailable(Boolean(json.storeUnavailable));
        }
      } catch {
        if (!cancelled) setStoreUnavailable(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rows]);

  const updateStatus = async (an: string, status: string) => {
    setStatuses((prev) => ({
      ...prev,
      [an]: {
        status,
        note: prev[an]?.note ?? null,
        updated_by: actor || null,
        updated_at: prev[an]?.updated_at ?? "",
      },
    }));

    try {
      const res = await fetch("/api/db/mrli-claim-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ an, status, actor }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setStatuses((prev) => ({ ...prev, [an]: json.status }));
        setStoreUnavailable(false);
      } else {
        setStoreUnavailable(Boolean(json.storeUnavailable));
      }
    } catch {
      setStoreUnavailable(true);
    }
  };

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
        `/api/db/mrli-revenue-worklist?d1=${encodeURIComponent(d1)}&d2=${encodeURIComponent(d2)}&mode=${m}${pttypeQuery}${clinicQuery}`,
        { signal: controller.signal }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message ?? "ค้นหาข้อมูลไม่สำเร็จ");

        return;
      }

      setRows(Array.isArray(json.data) ? json.data : []);
      setMeta(json.meta ?? { dxAvailable: false, dischargeAvailable: false });
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

  // เปิดหน้า: โหลดเฉพาะรายการสิทธิ/คลินิก (เบา) ยังไม่ดึงข้อมูลหลักจนกว่าจะกดค้นหา
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

  const summary = useMemo(() => {
    let incomplete = 0;
    let noCharge = 0;
    let noDx = 0;
    let totalCharge = 0;

    for (const r of rows) {
      totalCharge += Number(r.TOTAL_CHARGE ?? 0);
      if (Number(r.TOTAL_CHARGE ?? 0) <= 0) noCharge += 1;
      if (r.DX_COUNT !== null && Number(r.DX_COUNT) <= 0) noDx += 1;
      if (isIncomplete(r)) incomplete += 1;
    }

    return { total: rows.length, incomplete, noCharge, noDx, totalCharge };
  }, [rows]);

  const visibleRows = useMemo(
    () => (onlyIncomplete ? rows.filter(isIncomplete) : rows),
    [rows, onlyIncomplete]
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
            <p className="text-xs font-medium text-flow-text">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      )}
      <header className="border-b border-accent-border bg-neutral-50">
        <div className="w-full px-4 py-4 md:px-6">
          <h1 className="text-xl md:text-2xl font-bold text-flow-text">
            MRLI · Revenue Integrity Worklist (รายการรอทำเบิก/ตรวจสอบ)
          </h1>
          <p className="mt-1 text-xs md:text-sm text-flow-muted">
            {mode === "opd" ? "ผู้ป่วยนอก (OPD)" : "ผู้ป่วยใน (IPT)"} ที่ข้อมูลเบิกอาจไม่ครบ —
            ยังไม่ลงค่าใช้จ่าย หรือไม่มีรหัสวินิจฉัย (ICD-10) เพื่อลด Lost Revenue
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
              ไม่เลือก = ทั้งหมด · เลือกแล้วระบบจะกรองตอนค้นหา (ช่วยให้โหลดเร็วขึ้น)
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] md:text-xs text-flow-text">
                  <input
                    checked={onlyIncomplete}
                    className="ui-checkbox"
                    type="checkbox"
                    onChange={(e) => {
                      setOnlyIncomplete(e.target.checked);
                      setPage(1);
                    }}
                  />
                  แสดงเฉพาะรายการที่ต้องตรวจสอบ
                </label>
                <label className="inline-flex items-center gap-2 text-[11px] md:text-xs text-flow-text">
                  ผู้ดำเนินการ
                  <input
                    className="ui-input text-xs py-1 px-2"
                    placeholder="ชื่อผู้ตรวจ (สำหรับ audit)"
                    type="text"
                    value={actor}
                    onChange={(e) => handleActorChange(e.target.value)}
                  />
                </label>
              </div>
              <button
                className="ui-btn-primary text-xs md:text-sm"
                disabled={loading}
                type="submit"
              >
                {loading ? "กำลังค้นหา..." : "ค้นหาข้อมูล"}
              </button>
            </div>
            {rows.length > 0 &&
              (!meta.dxAvailable || (mode === "ipd" && !meta.dischargeAvailable)) && (
                <p className="text-[10px] text-amber-700">
                  หมายเหตุ: {!meta.dxAvailable && "ไม่พบตารางวินิจฉัย (คอลัมน์ Dx แสดงเป็น —) "}
                  {mode === "ipd" &&
                    !meta.dischargeAvailable &&
                    "ไม่พบคอลัมน์ ipt.dchdate (วันจำหน่ายแสดงเป็น —)"}
                </p>
              )}
          </form>
        </section>

        {error && (
          <section className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs md:text-sm text-red-800">
            {error}
          </section>
        )}

        {storeUnavailable && (
          <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            MRLI store (MySQL) ยังไม่พร้อมใช้งาน — บันทึกสถานะเบิกไม่ได้ ตรวจสอบการตั้งค่า
            DB_HOST/DB_USER/DB_PASSWORD/DB_NAME ใน .env.local (ส่วนรายงานอื่นยังทำงานปกติ)
          </section>
        )}

        {rows.length > 0 && (
          <section className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">
                {mode === "opd" ? "Visit (OPD) ทั้งหมด" : "Admission (IPD) ทั้งหมด"}
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-flow-text">
                {summary.total.toLocaleString("th-TH")} {idLabel}
              </p>
            </div>
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-amber-700">ต้องตรวจสอบ</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-amber-900">
                {summary.incomplete.toLocaleString("th-TH")} {idLabel}
              </p>
            </div>
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">ยังไม่ลงค่าใช้จ่าย</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-flow-text">
                {summary.noCharge.toLocaleString("th-TH")} {idLabel}
              </p>
            </div>
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">
                ค่าใช้จ่ายรวม (ทุก {idLabel})
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-flow-text">
                {formatBaht(summary.totalCharge)} บาท
              </p>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-flow-text">
            {rows.length > 0
              ? `รายการ (${visibleRows.length.toLocaleString("th-TH")} ${idLabel}, หน้า ${currentPage}/${totalPages})`
              : "รายการ"}
          </h2>

          {!hasSearched && !loading && (
            <p className="text-xs md:text-sm text-flow-muted">
              เลือกช่วงวันที่และสิทธิการรักษา (ถ้าต้องการกรอง) แล้วกด &quot;ค้นหาข้อมูล&quot;
              เพื่อแสดงผล
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
                      "รายการ",
                      "ใบสั่งยา",
                      "Dx",
                      "สถานะ",
                      "สถานะเบิก",
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
                        isIncomplete(row) ? "bg-amber-50/60" : ""
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
                      <td className="px-3 py-2 text-right text-flow-text whitespace-nowrap">
                        {Number(row.CHARGE_ITEM_COUNT ?? 0).toLocaleString("th-TH")}
                      </td>
                      <td className="px-3 py-2 text-right text-flow-text whitespace-nowrap">
                        {Number(row.DRUG_ORDER_COUNT ?? 0).toLocaleString("th-TH")}
                      </td>
                      <td className="px-3 py-2 text-right text-flow-text whitespace-nowrap">
                        {row.DX_COUNT === null ? "—" : Number(row.DX_COUNT).toLocaleString("th-TH")}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {Number(row.TOTAL_CHARGE ?? 0) <= 0 && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800">
                              ไม่มีค่าใช้จ่าย
                            </span>
                          )}
                          {row.DX_COUNT !== null && Number(row.DX_COUNT) <= 0 && (
                            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-800">
                              ไม่มี Dx
                            </span>
                          )}
                          {meta.dischargeAvailable && row.DCH_DATE && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                              จำหน่ายแล้ว
                            </span>
                          )}
                          {!isIncomplete(row) && (
                            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
                              ครบ
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <select
                          className="rounded border border-flow-border bg-white px-1 py-0.5 text-[11px] text-flow-text focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={storeUnavailable}
                          title={
                            statuses[String(row.AN)]?.updated_by
                              ? `แก้ไขล่าสุดโดย ${statuses[String(row.AN)]?.updated_by}`
                              : "ยังไม่บันทึกสถานะ"
                          }
                          value={statuses[String(row.AN)]?.status ?? "pending"}
                          onChange={(e) => updateStatus(String(row.AN), e.target.value)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {visibleRows.length === 0 && rows.length > 0 && !loading && (
            <p className="text-xs md:text-sm text-flow-muted">
              ไม่มีรายการที่ต้องตรวจสอบในช่วงวันที่นี้ 🎉
            </p>
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
