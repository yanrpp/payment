"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import { normalizeThaiCardInput } from "@/lib/card/normalize";
import { formatHnDisplay, normalizeHnInput } from "@/lib/hn/normalize";
import { filterStringOptions } from "@/lib/filter/options";
import { isoToThaiDisplay, localTodayIso } from "@/lib/date/thaiDate";

/** 1 แถว = 1 AN (Admission) พร้อมยอดรวมต้นทุน/ยอดขายยาของ AN นั้น */
type PatientCostRow = {
  AN: string | number;
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  RGTDATE: string;
  PTTYPE_NAME: string | null;
  ITEM_COUNT: number;
  TOTAL_QTY: number;
  TOTAL_SALE: number;
  TOTAL_COST: number;
  TOTAL_PROFIT: number;
};

/** รายการยา/เวชภัณฑ์ของ AN (จาก ipd-patient-drug-by-an) */
type DrugItemRow = {
  MEDITEM: string | number;
  DRUG_NAME: string | null;
  MEDTYPE: string | null;
  ACCNATION: string | null;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
};

function pttypeDisplayName(row: PatientCostRow): string {
  const n = row.PTTYPE_NAME?.trim();

  return n ? n : "(ไม่ระบุ)";
}

/** แปลงค่าวันที่จาก API (อาจเป็น ISO string / Date) เป็น YYYY-MM-DD ตามเวลาเครื่อง */
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

export default function IpdPatientCostPage() {
  const [dateFrom, setDateFrom] = useState<string>(() => localTodayIso());
  const [dateTo, setDateTo] = useState<string>(() => localTodayIso());
  const [hn, setHn] = useState<string>("");
  const [cardno, setCardno] = useState<string>("");
  const [filterPttype, setFilterPttype] = useState<string[]>([]);
  const [filterPttypeListQuery, setFilterPttypeListQuery] = useState("");
  const [pttypeDropdownOpen, setPttypeDropdownOpen] = useState(false);
  const pttypeDropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PatientCostRow[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // modal: รายการยาของ AN ที่เลือก
  const [selectedAn, setSelectedAn] = useState<{
    an: string;
    hn: string;
    dspname: string;
    rgtdate: string;
  } | null>(null);
  const [drugItems, setDrugItems] = useState<DrugItemRow[] | null>(null);
  const [drugLoading, setDrugLoading] = useState(false);
  const [drugError, setDrugError] = useState<string | null>(null);

  // กัน race condition: ยกเลิก request เก่าเมื่อเริ่มค้นหา/คลิกแถวใหม่
  const searchAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);

  const runSearch = async (params: {
    d1: string;
    d2: string;
    hnValue: string;
    cardnoValue: string;
  }) => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();

    searchAbortRef.current = controller;
    setLoading(true);
    setError(null);
    setRows([]);
    setPage(1);
    setFilterPttype([]);
    setFilterPttypeListQuery("");
    setPttypeDropdownOpen(false);

    const query = new URLSearchParams();

    query.set("d1", params.d1);
    query.set("d2", params.d2);
    if (params.hnValue.trim()) {
      const normalizedHn = normalizeHnInput(params.hnValue);

      if (normalizedHn) {
        query.set("hn", normalizedHn);
      }
    }
    if (params.cardnoValue.trim()) {
      const normalizedCard = normalizeThaiCardInput(params.cardnoValue);

      if (normalizedCard) {
        query.set("cardno", normalizedCard);
      }
    }

    try {
      const res = await fetch(`/api/db/ipd-patient-cost?${query.toString()}`, {
        signal: controller.signal,
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message ?? "ค้นหาข้อมูลไม่สำเร็จ");

        return;
      }

      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (fetchError) {
      if (controller.signal.aborted) return;
      setError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await runSearch({ d1: dateFrom, d2: dateTo, hnValue: hn, cardnoValue: cardno });
  };

  useEffect(() => {
    const today = localTodayIso();

    void runSearch({ d1: today, d2: today, hnValue: "", cardnoValue: "" });
  }, []);

  const pttypeOptions = useMemo(() => {
    const set = new Set<string>();

    for (const r of rows) {
      set.add(pttypeDisplayName(r));
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [rows]);

  const pttypeOptionsFiltered = useMemo(
    () => filterStringOptions(pttypeOptions, filterPttypeListQuery),
    [pttypeOptions, filterPttypeListQuery]
  );

  const filteredRows = useMemo(() => {
    if (filterPttype.length === 0) return rows;

    return rows.filter((r) => filterPttype.includes(pttypeDisplayName(r)));
  }, [rows, filterPttype]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize) || 1);
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedRows = filteredRows.slice(startIndex, endIndex);

  // ยอดรวมหน้าปัจจุบัน (ตามที่กรองแล้ว) — ต้นทุน/ยอดขายทุก AN
  const grandTotals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, r) => {
          acc.cost += Number(r.TOTAL_COST ?? 0);
          acc.sale += Number(r.TOTAL_SALE ?? 0);
          acc.profit += Number(r.TOTAL_PROFIT ?? 0);

          return acc;
        },
        { cost: 0, sale: 0, profit: 0 }
      ),
    [filteredRows]
  );

  // ยอดรวมรายการยาใน modal
  const drugTotals = useMemo(() => {
    const items = drugItems ?? [];

    return items.reduce(
      (acc, r) => {
        acc.qty += Number(r.TOTAL_QTY ?? 0);
        acc.cost += Number(r.TOTAL_COST ?? 0);
        acc.sale += Number(r.TOTAL_SALE ?? 0);
        acc.profit += Number(r.TOTAL_PROFIT ?? 0);

        return acc;
      },
      { qty: 0, cost: 0, sale: 0, profit: 0 }
    );
  }, [drugItems]);

  useEffect(() => {
    if (!pttypeDropdownOpen) return;
    const closeOnOutside = (e: MouseEvent) => {
      const el = pttypeDropdownRef.current;

      if (el && !el.contains(e.target as Node)) {
        setPttypeDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutside);

    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [pttypeDropdownOpen]);

  const closeModal = () => {
    detailAbortRef.current?.abort();
    setSelectedAn(null);
    setDrugItems(null);
    setDrugError(null);
    setDrugLoading(false);
  };

  // ปิด modal ด้วยปุ่ม Escape
  useEffect(() => {
    if (!selectedAn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [selectedAn]);

  const handleRowClick = async (row: PatientCostRow) => {
    const an = String(row.AN ?? "").trim();

    if (!an) return;
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    const signal = controller.signal;

    detailAbortRef.current = controller;
    setSelectedAn({
      an,
      hn: String(row.HN),
      dspname: row.DSPNAME ?? "",
      rgtdate: row.RGTDATE,
    });
    setDrugItems(null);
    setDrugError(null);
    setDrugLoading(true);

    try {
      const res = await fetch(`/api/db/ipd-patient-drug-by-an?an=${encodeURIComponent(an)}`, {
        signal,
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setDrugError(json.message ?? "โหลดรายการยาไม่สำเร็จ");
      } else {
        setDrugItems(Array.isArray(json.data) ? json.data : []);
      }
    } catch (err) {
      if (signal.aborted) return;
      setDrugError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดรายการยา");
    } finally {
      if (!signal.aborted) setDrugLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="border-b border-accent-border bg-neutral-50">
        <div className="w-full px-4 py-4 md:px-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-flow-text">
              ตรวจสอบต้นทุนรายผู้ป่วย (IPD)
            </h1>
            <p className="mt-1 text-xs md:text-sm text-flow-muted">
              แสดง 1 Admission (AN) ต่อ 1 แถว — คลิกแถวเพื่อดูรายการยา/เวชภัณฑ์ที่ใช้กับ AN นั้น
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-6 md:px-6 md:py-8">
        <section className="mb-6">
          <form
            className="rounded-xl border border-accent-border bg-white p-4 shadow-sm space-y-4"
            onSubmit={handleSearch}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              <div className="flex min-w-0 flex-col gap-1">
                <label className="text-xs font-medium text-flow-text" htmlFor="hn">
                  HN
                </label>
                <input
                  className="ui-input w-full text-sm py-1.5 px-3"
                  id="hn"
                  placeholder="เช่น 1666/69 หรือ 69001666"
                  type="text"
                  value={hn}
                  onChange={(event) => setHn(event.target.value)}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <label className="text-xs font-medium text-flow-text" htmlFor="cardno">
                  เลขบัตร
                </label>
                <input
                  className="ui-input w-full text-sm py-1.5 px-3"
                  id="cardno"
                  inputMode="numeric"
                  pattern="\d*"
                  placeholder="เลขบัตรประชาชน 13 หลัก"
                  type="text"
                  value={cardno}
                  onChange={(event) => {
                    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 13);

                    setCardno(digitsOnly);
                  }}
                />
              </div>
            </div>

            {rows.length > 0 && (
              <div className="border-t border-flow-border pt-4">
                <p
                  className="mb-2 text-[11px] font-semibold text-flow-text"
                  id="patient-cost-pttype-filter-label"
                >
                  กรองตามสิทธิการรักษา
                </p>
                <div ref={pttypeDropdownRef} className="relative w-full">
                  <button
                    aria-controls="patient-cost-pttype-listbox"
                    aria-expanded={pttypeDropdownOpen}
                    aria-haspopup="listbox"
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-flow-border bg-white px-3 py-2 text-left text-[11px] text-flow-text shadow-sm hover:bg-flow-input focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={pttypeOptions.length === 0}
                    type="button"
                    onClick={() => {
                      if (pttypeOptions.length === 0) return;
                      setPttypeDropdownOpen((o) => !o);
                    }}
                  >
                    <span className="min-w-0 truncate">
                      {pttypeOptions.length === 0
                        ? "ไม่มีรายการสิทธิในผลลัพธ์"
                        : filterPttype.length === 0
                          ? "ทุกสิทธิ — แตะเพื่อเลือกกรอง (มีทั้งหมด " +
                            pttypeOptions.length +
                            " รายการ)"
                          : `เลือกแล้ว ${filterPttype.length} สิทธิ — แตะเพื่อเปลี่ยน`}
                    </span>
                    <span aria-hidden className="shrink-0 text-slate-400">
                      {pttypeDropdownOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {pttypeDropdownOpen && pttypeOptions.length > 0 && (
                    <div
                      aria-labelledby="patient-cost-pttype-filter-label"
                      aria-multiselectable="true"
                      className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-flow-border bg-white p-2 shadow-lg ring-1 ring-black/5"
                      id="patient-cost-pttype-listbox"
                      role="listbox"
                    >
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-[10px]">
                        <button
                          className="rounded border border-flow-border bg-flow-input px-2 py-0.5 text-flow-text hover:bg-brand-50"
                          type="button"
                          onClick={() => {
                            setFilterPttype((prev) => {
                              const next = new Set(prev);

                              for (const o of pttypeOptionsFiltered) next.add(o);

                              return Array.from(next);
                            });
                            setPage(1);
                          }}
                        >
                          เลือกทั้งหมด (ตามที่ค้นเห็น)
                        </button>
                        <button
                          className="rounded border border-flow-border bg-white px-2 py-0.5 text-flow-text hover:bg-flow-input"
                          type="button"
                          onClick={() => {
                            const visible = new Set(pttypeOptionsFiltered);

                            setFilterPttype((prev) => prev.filter((item) => !visible.has(item)));
                            setPage(1);
                          }}
                        >
                          ไม่เลือกทั้งหมด (ตามที่ค้นเห็น)
                        </button>
                        <button
                          className="rounded border border-flow-border bg-white px-2 py-0.5 text-flow-text hover:bg-flow-input"
                          type="button"
                          onClick={() => {
                            setFilterPttype([]);
                            setFilterPttypeListQuery("");
                            setPage(1);
                          }}
                        >
                          ล้างฟิลเตอร์สิทธิ
                        </button>
                      </div>
                      <input
                        autoComplete="off"
                        className="ui-input-sm mt-2 text-[11px] py-1.5"
                        placeholder="พิมพ์เพื่อค้นหาชื่อสิทธิ..."
                        type="search"
                        value={filterPttypeListQuery}
                        onChange={(e) => setFilterPttypeListQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setPttypeDropdownOpen(false);
                        }}
                      />
                      <div
                        className="mt-2 max-h-60 overflow-y-auto rounded-md border border-flow-border bg-flow-input/90 px-1 py-1"
                        role="group"
                      >
                        <div className="flex flex-col gap-0.5">
                          {pttypeOptionsFiltered.length === 0 ? (
                            <p className="px-2 py-2 text-[10px] text-slate-400">
                              ไม่พบรายการที่ตรงกับการค้นหา
                            </p>
                          ) : (
                            pttypeOptionsFiltered.map((opt) => (
                              <label
                                key={opt}
                                className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-[11px] text-flow-text hover:bg-white"
                              >
                                <input
                                  checked={filterPttype.includes(opt)}
                                  className="ui-checkbox mt-0.5 shrink-0"
                                  type="checkbox"
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFilterPttype((prev) => [...prev, opt]);
                                    } else {
                                      setFilterPttype((prev) =>
                                        prev.filter((item) => item !== opt)
                                      );
                                    }
                                    setPage(1);
                                  }}
                                />
                                <span className="min-w-0 flex-1 leading-snug" title={opt}>
                                  {opt}
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[10px] text-flow-muted">
                  ไม่เลือก = แสดงทุกสิทธิ · เลือกอย่างน้อยหนึ่งรายการ =
                  แสดงเฉพาะแถวที่ตรงสิทธิที่เลือก
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="text-[11px] md:text-xs text-flow-muted">
                ข้อมูลจากผู้ป่วยที่ admit จริง (ตาราง IPT) — ต้นทุน/ราคาขายอ้างเรตล่าสุดจาก
                MEDITEMSALEHST เช่นเดียวกับหน้าสรุปต้นทุนและกำไรจากยา
              </p>
              <button
                className="ui-btn-primary text-xs md:text-sm"
                disabled={loading}
                type="submit"
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
          <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-sm font-semibold text-flow-text">
              ผลลัพธ์การค้นหา{" "}
              {rows.length > 0
                ? `(${filteredRows.length} AN${filterPttype.length > 0 ? " ตามสิทธิ" : ""}, หน้า ${currentPage}/${totalPages})`
                : ""}
            </h2>
            {rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-flow-muted lg:justify-end">
                <p>
                  รวมต้นทุน {formatBaht(grandTotals.cost)} · รวมยอดขาย{" "}
                  {formatBaht(grandTotals.sale)} · กำไร {formatBaht(grandTotals.profit)}
                </p>
                <div className="flex items-center gap-1">
                  <span>แสดงต่อหน้า:</span>
                  <select
                    className="rounded border border-flow-border bg-white px-1 py-0.5 text-[11px] text-flow-text focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                    value={pageSize}
                    onChange={(event) => {
                      const newSize = Number(event.target.value) || 15;

                      setPageSize(newSize);
                      setPage(1);
                    }}
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
            <p className="text-xs md:text-sm text-flow-muted">
              ยังไม่มีข้อมูลแสดง กรุณาเลือกช่วงวันที่ และเงื่อนไข แล้วกด &quot;ค้นหาข้อมูล&quot;
            </p>
          )}

          {rows.length > 0 && (
            <div className="mb-4 w-full overflow-x-auto rounded-xl border border-flow-border bg-white shadow-sm">
              <table className="w-full min-w-full table-fixed border-separate border-spacing-0 text-xs md:text-sm text-left">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[8%]" />
                  <col className="w-[12%]" />
                  <col className="w-[15%]" />
                  <col className="w-[12%]" />
                  <col className="w-[6%]" />
                  <col className="w-[7%]" />
                  <col className="w-[7%]" />
                  <col className="w-[7%]" />
                </colgroup>
                <thead>
                  <tr className="bg-black">
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      NO.
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      วันที่รับบริการ
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      AN
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      HN
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      เลขบัตรประชาชน
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      ชื่อผู้ป่วย
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      สิทธิการรักษา
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      จำนวนรายการ
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      ต้นทุนรวม
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      ยอดขายรวม
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      กำไรรวม
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-xs text-amber-900 md:text-sm"
                        colSpan={11}
                      >
                        ไม่มีแถวที่ตรงกับสิทธิที่เลือก กรุณาเลือกสิทธิเพิ่มหรือกด
                        &quot;ล้างฟิลเตอร์สิทธิ&quot;
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row, index) => (
                      <tr
                        key={`${row.AN}-${index}`}
                        className="cursor-pointer border-b border-slate-100 hover:bg-brand-50"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleRowClick(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleRowClick(row);
                          }
                        }}
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
                        <td className="px-3 py-2 text-flow-text whitespace-nowrap">
                          {row.CARDNO ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-flow-text">
                          <span
                            className="line-clamp-2 break-words"
                            title={row.DSPNAME ?? undefined}
                          >
                            {row.DSPNAME ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-flow-text">
                          <span className="line-clamp-2 break-words" title={pttypeDisplayName(row)}>
                            {pttypeDisplayName(row)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-flow-text whitespace-nowrap">
                          {Number(row.ITEM_COUNT ?? 0).toLocaleString("th-TH")}
                        </td>
                        <td className="px-3 py-2 text-right text-flow-text whitespace-nowrap">
                          {formatBaht(row.TOTAL_COST)}
                        </td>
                        <td className="px-3 py-2 text-right text-flow-text whitespace-nowrap">
                          {formatBaht(row.TOTAL_SALE)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right whitespace-nowrap ${
                            Number(row.TOTAL_PROFIT ?? 0) < 0 ? "text-red-600" : "text-flow-text"
                          }`}
                        >
                          {formatBaht(row.TOTAL_PROFIT)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex flex-col gap-2 text-[11px] text-flow-muted sm:flex-row sm:items-center sm:justify-between">
              <div>
                แสดงแถวที่ {filteredRows.length === 0 ? 0 : startIndex + 1} -{" "}
                {Math.min(endIndex, filteredRows.length)} จากทั้งหมด {filteredRows.length} AN
                {filterPttype.length > 0 && rows.length !== filteredRows.length
                  ? ` (จากทั้งหมด ${rows.length} AN ก่อนกรองสิทธิ)`
                  : ""}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded border border-flow-border bg-white px-2 py-0.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-flow-input"
                  disabled={currentPage <= 1}
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
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
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modal: รายการยา/เวชภัณฑ์ของ AN ที่เลือก */}
      {selectedAn && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:p-8">
          <button
            aria-label="ปิดหน้าต่าง"
            className="absolute inset-0 h-full w-full cursor-default"
            type="button"
            onClick={closeModal}
          />
          <div
            aria-labelledby="ipd-drug-modal-title"
            aria-modal="true"
            className="relative z-10 w-full max-w-5xl rounded-xl border border-flow-border bg-white shadow-xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-flow-border px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-flow-text" id="ipd-drug-modal-title">
                  รายการยา/เวชภัณฑ์ของ AN {selectedAn.an}
                </h3>
                <p className="mt-0.5 text-[11px] text-flow-muted">
                  HN {formatHnDisplay(selectedAn.hn)}
                  {selectedAn.dspname ? ` · ${selectedAn.dspname}` : ""} · วันที่รับบริการ{" "}
                  {isoToThaiDisplay(apiDateToIsoLocal(selectedAn.rgtdate))}
                </p>
              </div>
              <button
                className="shrink-0 rounded border border-flow-border bg-white px-3 py-1 text-xs text-flow-text hover:bg-flow-input"
                type="button"
                onClick={closeModal}
              >
                ปิด
              </button>
            </div>

            <div className="px-4 py-3">
              {drugLoading && (
                <p className="py-4 text-center text-xs text-flow-muted">กำลังโหลดรายการยา...</p>
              )}
              {drugError && (
                <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
                  {drugError}
                </p>
              )}
              {!drugLoading && !drugError && (drugItems?.length ?? 0) === 0 && (
                <p className="py-4 text-center text-xs text-flow-muted">
                  ไม่พบรายการยา/เวชภัณฑ์สำหรับ AN นี้
                </p>
              )}
              {!drugLoading && !drugError && (drugItems?.length ?? 0) > 0 && (
                <div className="overflow-x-auto rounded border border-flow-border">
                  <table className="min-w-full border-collapse text-[11px] md:text-xs text-left">
                    <thead>
                      <tr className="border-b border-flow-border bg-slate-100">
                        <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap">
                          รหัสยา
                        </th>
                        <th className="px-2 py-1.5 font-semibold text-flow-text">
                          ชื่อยา/เวชภัณฑ์
                        </th>
                        <th className="px-2 py-1.5 font-semibold text-flow-text">ประเภทยา</th>
                        <th className="px-2 py-1.5 font-semibold text-flow-text">บัญชียาหลัก</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-flow-text whitespace-nowrap">
                          จำนวน
                        </th>
                        <th className="px-2 py-1.5 text-right font-semibold text-flow-text whitespace-nowrap">
                          ต้นทุนรวม
                        </th>
                        <th className="px-2 py-1.5 text-right font-semibold text-flow-text whitespace-nowrap">
                          ยอดขายรวม
                        </th>
                        <th className="px-2 py-1.5 text-right font-semibold text-flow-text whitespace-nowrap">
                          กำไรรวม
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(drugItems ?? []).map((drug, idx) => (
                        <tr
                          key={`${drug.MEDITEM}-${idx}`}
                          className="border-b border-slate-100 hover:bg-flow-input"
                        >
                          <td className="px-2 py-1.5 text-flow-text whitespace-nowrap">
                            {drug.MEDITEM}
                          </td>
                          <td className="px-2 py-1.5 text-flow-text">{drug.DRUG_NAME ?? "—"}</td>
                          <td className="px-2 py-1.5 text-flow-text">{drug.MEDTYPE ?? "—"}</td>
                          <td className="px-2 py-1.5 text-flow-text">{drug.ACCNATION ?? "—"}</td>
                          <td className="px-2 py-1.5 text-right text-flow-text whitespace-nowrap">
                            {Number(drug.TOTAL_QTY ?? 0).toLocaleString("th-TH")}
                          </td>
                          <td className="px-2 py-1.5 text-right text-flow-text whitespace-nowrap">
                            {formatBaht(drug.TOTAL_COST)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-flow-text whitespace-nowrap">
                            {formatBaht(drug.TOTAL_SALE)}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right whitespace-nowrap ${
                              Number(drug.TOTAL_PROFIT ?? 0) < 0 ? "text-red-600" : "text-flow-text"
                            }`}
                          >
                            {formatBaht(drug.TOTAL_PROFIT)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-flow-input font-semibold text-flow-text">
                        <td className="px-2 py-1.5 whitespace-nowrap" colSpan={4}>
                          รวม
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {drugTotals.qty.toLocaleString("th-TH")}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {formatBaht(drugTotals.cost)}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {formatBaht(drugTotals.sale)}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {formatBaht(drugTotals.profit)}
                        </td>
                      </tr>
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
