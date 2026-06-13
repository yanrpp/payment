"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import { normalizeThaiCardInput } from "@/lib/card/normalize";
import { normalizeHnInput } from "@/lib/hn/normalize";
import { isoToThaiDisplay, localTodayIso } from "@/lib/date/thaiDate";
import { siteConfig } from "@/config/site";

function normalizeFieldForFilter(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase();
}

function filterStringOptions(options: string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return options;
  const needle = normalizeFieldForFilter(trimmed);
  return options.filter((opt) => normalizeFieldForFilter(opt).includes(needle));
}

type PatientCostRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  VSTDATE: string;
  PTTYPE: string | null;
  PTTYPE_NAME: string | null;
  TOTAL_AMOUNT: number;
};

function pttypeDisplayName(row: PatientCostRow): string {
  const n = row.PTTYPE_NAME?.trim();
  return n ? n : "(ไม่ระบุ)";
}

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
  CLINIC_LCT_NAME: string | null;
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
  SALE_PRICE: number | null;
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

/** สรุปยอดตาม INCGRP — ชื่อจากตาราง INCGRP (patient-cost-incgrp-breakdown) */
type PatientCostIncgrpBreakdownRow = {
  INCGRP: number;
  INCGRP_NAME: string | null;
  AMOUNT: number;
};

type PatientCostItemRow = {
  INCOME: string | null;
  INCOMENAME: string | null;
  INCGRP: number | null;
  QTY: number | null;
  PRICE: number | null;
  SALE_PRICE: number | null;
  INCAMT: number;
};

function formatHnDisplay(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.includes("/") || raw.includes("-")) return raw;

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 3) return raw;

  const yearSuffix = digits.slice(0, 2);
  const runningRaw = digits.slice(2);
  const running = runningRaw.replace(/^0+/, "") || "0";
  return `${running}/${yearSuffix}`;
}

function isDrugRelatedIncgrp(incgrp: number): boolean {
  return [31, 32, 33, 34, 40, 50].includes(incgrp);
}

function filterDrugSummaryByIncgrp(
  rows: PatientDrugSummaryRow[] | null,
  incgrp: number | null,
  options?: {
    zeroSaleOnly?: boolean;
    negativeProfitOnly?: boolean;
    excludeZeroSale?: boolean;
    excludeNegativeProfit?: boolean;
  }
): PatientDrugSummaryRow[] {
  if (!rows || rows.length === 0 || incgrp == null) return [];

  const {
    zeroSaleOnly = false,
    negativeProfitOnly = false,
    excludeZeroSale = false,
    excludeNegativeProfit = false,
  } = options ?? {};

  const applyCommonFilters = (input: PatientDrugSummaryRow[]) =>
    input.filter((r) => {
      const sale = Number(r.TOTAL_SALE ?? 0);
      const profit = Number(r.TOTAL_PROFIT ?? 0);
      if (zeroSaleOnly && sale !== 0) return false;
      if (negativeProfitOnly && profit >= 0) return false;
      if (excludeZeroSale && sale === 0) return false;
      if (excludeNegativeProfit && profit < 0) return false;
      return true;
    });

  if (incgrp === 50) {
    return applyCommonFilters(rows.filter((r) => (r.MEDTYPE ?? "").includes("เวชภัณฑ์")));
  }

  if (incgrp === 31) {
    return applyCommonFilters(rows.filter((r) => !(r.MEDTYPE ?? "").includes("เวชภัณฑ์")));
  }

  return applyCommonFilters(rows);
}

function filterCostItemsByIncgrp(
  rows: PatientCostItemRow[] | null,
  incgrp: number | null
): PatientCostItemRow[] {
  if (!rows || rows.length === 0 || incgrp == null) return [];

  return rows.filter((r) => Number(r.INCGRP ?? 0) === incgrp);
}

const SPECIAL_SECTION_XRAY = -9001;
const SPECIAL_SECTION_LAB = -9002;

export default function PatientCostPage() {
  const [dateFrom, setDateFrom] = useState<string>(() => localTodayIso());
  const [dateTo, setDateTo] = useState<string>(() => localTodayIso());
  const [hn, setHn] = useState<string>("");
  const [cardno, setCardno] = useState<string>("");
  const [filterPttype, setFilterPttype] = useState<string[]>([]);
  const [filterPttypeListQuery, setFilterPttypeListQuery] = useState("");
  const [pttypeDropdownOpen, setPttypeDropdownOpen] = useState(false);
  const pttypeDropdownRef = useRef<HTMLDivElement>(null);
  const [filterZeroSaleOnly, setFilterZeroSaleOnly] = useState(false);
  const [filterNegativeProfitOnly, setFilterNegativeProfitOnly] = useState(false);
  const [excludeZeroSale, setExcludeZeroSale] = useState(false);
  const [excludeNegativeProfit, setExcludeNegativeProfit] = useState(false);

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

  const [incgrpBreakdown, setIncgrpBreakdown] = useState<PatientCostIncgrpBreakdownRow[] | null>(
    null
  );
  const [incgrpBreakdownLoading, setIncgrpBreakdownLoading] = useState(false);
  const [incgrpBreakdownError, setIncgrpBreakdownError] = useState<string | null>(null);
  const [costItems, setCostItems] = useState<PatientCostItemRow[] | null>(null);
  const [costItemsLoading, setCostItemsLoading] = useState(false);
  const [costItemsError, setCostItemsError] = useState<string | null>(null);
  const [expandedIncgrp, setExpandedIncgrp] = useState<number | null>(null);

  const runSearch = async (params: { d1: string; d2: string; hnValue: string; cardnoValue: string }) => {
    setLoading(true);
    setError(null);
    setRows([]);
    setPage(1);
    setFilterPttype([]);
    setFilterPttypeListQuery("");
    setPttypeDropdownOpen(false);
    setFilterZeroSaleOnly(false);
    setFilterNegativeProfitOnly(false);
    setExcludeZeroSale(false);
    setExcludeNegativeProfit(false);

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

  const filteredDrugRowsForExpanded = useMemo(
    () =>
      filterDrugSummaryByIncgrp(drugSummary, expandedIncgrp, {
        zeroSaleOnly: filterZeroSaleOnly,
        negativeProfitOnly: filterNegativeProfitOnly,
        excludeZeroSale,
        excludeNegativeProfit,
      }),
    [
      drugSummary,
      expandedIncgrp,
      filterZeroSaleOnly,
      filterNegativeProfitOnly,
      excludeZeroSale,
      excludeNegativeProfit,
    ]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize) || 1);
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedRows = filteredRows.slice(startIndex, endIndex);

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
    setIncgrpBreakdown(null);
    setIncgrpBreakdownError(null);
    setCostItems(null);
    setCostItemsError(null);
    setExpandedIncgrp(null);
    setDetailLoading(true);
    setIncgrpBreakdownLoading(true);
    try {
      const [resDetail, resIncgrp] = await Promise.all([
        fetch(
          `/api/db/patient-cost-detail?hn=${encodeURIComponent(row.HN)}&vstdate=${encodeURIComponent(iso)}`
        ),
        fetch(
          `/api/db/patient-cost-incgrp-breakdown?hn=${encodeURIComponent(row.HN)}&vstdate=${encodeURIComponent(iso)}`
        ),
      ]);
      const [jsonDetail, jsonIncgrp] = await Promise.all([
        resDetail.json() as Promise<{
          success?: boolean;
          message?: string;
          data?: PatientCostDetailRow[];
        }>,
        resIncgrp.json() as Promise<{
          success?: boolean;
          message?: string;
          data?: PatientCostIncgrpBreakdownRow[];
        }>,
      ]);

      if (!resDetail.ok || !jsonDetail.success) {
        setDetailError(jsonDetail.message ?? "โหลดรายละเอียดไม่สำเร็จ");
      } else {
        setDetailData(Array.isArray(jsonDetail.data) ? jsonDetail.data : []);
      }

      if (!resIncgrp.ok || !jsonIncgrp.success) {
        setIncgrpBreakdownError(jsonIncgrp.message ?? "โหลดสรุปหมวด INCGRP ไม่สำเร็จ");
      } else {
        setIncgrpBreakdown(Array.isArray(jsonIncgrp.data) ? jsonIncgrp.data : []);
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setIncgrpBreakdownError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setDetailLoading(false);
      setIncgrpBreakdownLoading(false);
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

    // โหลดรายการค่าใช้จ่าย (INCOME/INCOMENAME) ต่อเคส เพื่อใช้เจาะรายละเอียดตามหมวด
    try {
      setCostItemsLoading(true);
      const resCostItems = await fetch(
        `/api/db/patient-cost-items?hn=${encodeURIComponent(row.HN)}&vstdate=${encodeURIComponent(iso)}`
      );
      const jsonCostItems = await resCostItems.json();

      if (!resCostItems.ok || !jsonCostItems.success) {
        setCostItemsError(jsonCostItems.message ?? "โหลดรายการค่าใช้จ่ายไม่สำเร็จ");
      } else {
        setCostItems(Array.isArray(jsonCostItems.data) ? jsonCostItems.data : []);
      }
    } catch (err) {
      setCostItemsError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดรายการค่าใช้จ่าย");
    } finally {
      setCostItemsLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="border-b border-accent-border bg-neutral-50">
        <div className="w-full px-4 py-4 md:px-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-flow-text">
              ตรวจสอบต้นทุนรายผู้ป่วย (OPD)
            </h1>
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
                    type="button"
                    disabled={pttypeOptions.length === 0}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-flow-border bg-white px-3 py-2 text-left text-[11px] text-flow-text shadow-sm hover:bg-flow-input focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-expanded={pttypeDropdownOpen}
                    aria-haspopup="listbox"
                    aria-controls="patient-cost-pttype-listbox"
                    onClick={() => {
                      if (pttypeOptions.length === 0) return;
                      setPttypeDropdownOpen((o) => !o);
                    }}
                  >
                    <span className="min-w-0 truncate">
                      {pttypeOptions.length === 0
                        ? "ไม่มีรายการสิทธิในผลลัพธ์"
                        : filterPttype.length === 0
                          ? "ทุกสิทธิ — แตะเพื่อเลือกกรอง (มีทั้งหมด " + pttypeOptions.length + " รายการ)"
                          : `เลือกแล้ว ${filterPttype.length} สิทธิ — แตะเพื่อเปลี่ยน`}
                    </span>
                    <span className="shrink-0 text-slate-400" aria-hidden>
                      {pttypeDropdownOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {pttypeDropdownOpen && pttypeOptions.length > 0 && (
                    <div
                      id="patient-cost-pttype-listbox"
                      className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-flow-border bg-white p-2 shadow-lg ring-1 ring-black/5"
                      role="listbox"
                      aria-multiselectable="true"
                      aria-labelledby="patient-cost-pttype-filter-label"
                    >
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-[10px]">
                        <button
                          type="button"
                          className="rounded border border-flow-border bg-flow-input px-2 py-0.5 text-flow-text hover:bg-brand-50"
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
                          type="button"
                          className="rounded border border-flow-border bg-white px-2 py-0.5 text-flow-text hover:bg-flow-input"
                          onClick={() => {
                            const visible = new Set(pttypeOptionsFiltered);
                            setFilterPttype((prev) => prev.filter((item) => !visible.has(item)));
                            setPage(1);
                          }}
                        >
                          ไม่เลือกทั้งหมด (ตามที่ค้นเห็น)
                        </button>
                        <button
                          type="button"
                          className="rounded border border-flow-border bg-white px-2 py-0.5 text-flow-text hover:bg-flow-input"
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
                        type="search"
                        value={filterPttypeListQuery}
                        onChange={(e) => setFilterPttypeListQuery(e.target.value)}
                        placeholder="พิมพ์เพื่อค้นหาชื่อสิทธิ..."
                        className="ui-input-sm mt-2 text-[11px] py-1.5"
                        autoComplete="off"
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
                                  type="checkbox"
                                  checked={filterPttype.includes(opt)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFilterPttype((prev) => [...prev, opt]);
                                    } else {
                                      setFilterPttype((prev) => prev.filter((item) => item !== opt));
                                    }
                                    setPage(1);
                                  }}
                                  className="ui-checkbox mt-0.5 shrink-0"
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
                  ไม่เลือก = แสดงทุกสิทธิ · เลือกอย่างน้อยหนึ่งรายการ = แสดงเฉพาะแถวที่ตรงสิทธิที่เลือก
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="text-[11px] md:text-xs text-flow-muted">
                เงื่อนไขอื่นตาม SQL: OPD เท่านั้น (AN เป็นค่าว่าง, ไม่ถูกยกเลิก)
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
                ? `(${filteredRows.length} แถว${filterPttype.length > 0 ? " สิทธิ" : ""}, หน้า ${currentPage}/${totalPages})`
                : ""}
            </h2>
            {rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-flow-muted lg:justify-end">
                <p>รวมยอดจากฟิลด์ INCPT.INCAMT ตามเงื่อนไขที่กำหนด</p>
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
                  <col className="w-[11%]" />
                  <col className="w-[8%]" />
                  <col className="w-[13%]" />
                  <col className="w-[20%]" />
                  <col className="w-[33%]" />
                  <col className="w-[10%]" />
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
                      SUM(INCAMT)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-xs text-amber-900 md:text-sm"
                        colSpan={7}
                      >
                        ไม่มีแถวที่ตรงกับสิทธิที่เลือก กรุณาเลือกสิทธิเพิ่มหรือกด &quot;ล้างฟิลเตอร์สิทธิ&quot;
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row, index) => (
                      <tr
                        key={`${row.HN}-${row.VSTDATE}`}
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
                          {isoToThaiDisplay(apiDateToIsoLocal(row.VSTDATE))}
                        </td>
                        <td className="px-3 py-2 text-flow-text whitespace-nowrap">
                          {formatHnDisplay(row.HN)}
                        </td>
                        <td className="px-3 py-2 text-flow-text whitespace-nowrap">
                          {row.CARDNO ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-flow-text">
                          <span className="line-clamp-2 break-words" title={row.DSPNAME ?? undefined}>
                            {row.DSPNAME ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-flow-text">
                          <span className="line-clamp-2 break-words" title={pttypeDisplayName(row)}>
                            {pttypeDisplayName(row)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-flow-text whitespace-nowrap">
                          {row.TOTAL_AMOUNT.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && filteredRows.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-[11px] text-flow-muted">
              <div>
                แสดงแถวที่ {filteredRows.length === 0 ? 0 : startIndex + 1} -{" "}
                {Math.min(endIndex, filteredRows.length)} จากทั้งหมด {filteredRows.length} แถว
                {filterPttype.length > 0 && rows.length !== filteredRows.length
                  ? ` (จากทั้งหมด ${rows.length} แถวก่อนกรองสิทธิ)`
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

        <section className="mt-4 text-[11px] md:text-xs text-flow-muted">
          <p>
            เวอร์ชันระบบต้นแบบ: {siteConfig.version} — API: <code>/api/db/patient-cost</code>
          </p>
        </section>
      </main>

      {/* โมดัลรายละเอียดต้นทุนต่อเคส */}
      {selectedVisit && (
        <div
          aria-labelledby="detail-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
        >
          <div className="relative h-[90vh] w-[95vw] max-w-[1400px] overflow-hidden rounded-xl border border-flow-border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-flow-border bg-flow-input px-4 py-3">
              <h2 className="text-sm font-semibold text-flow-text" id="detail-modal-title">
                รายละเอียดต้นทุนต่อเคส (แยกตามหมวดค่าใช้จ่าย) — HN{" "}
                {formatHnDisplay(selectedVisit.hn)}
                {selectedVisit.dspname ? ` — ${selectedVisit.dspname}` : ""} — วันที่{" "}
                {isoToThaiDisplay(selectedVisit.vstdate)}
              </h2>
              <button
                className="rounded-lg border border-flow-border bg-white px-3 py-1 text-xs font-medium text-flow-text hover:bg-brand-50"
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
                  setIncgrpBreakdown(null);
                  setIncgrpBreakdownError(null);
                  setCostItems(null);
                  setCostItemsError(null);
                  setExpandedIncgrp(null);
                }}
              >
                ปิด
              </button>
            </div>
            <div className="overflow-auto p-4 max-h-[calc(90vh-4rem)]">
              {detailLoading && (
                <p className="py-8 text-center text-sm text-flow-muted">กำลังโหลด...</p>
              )}
              {detailError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {detailError}
                </p>
              )}
              {!detailLoading && !detailError && detailData && detailData.length === 0 && (
                <p className="py-8 text-center text-sm text-flow-muted">
                  ไม่มีข้อมูลรายละเอียดต้นทุนสำหรับเคสนี้
                </p>
              )}
              {!detailLoading && !detailError && detailData && detailData.length > 0 && (
                <>
                  {(() => {
                    const row = detailData[0] as unknown as Record<string, unknown>;
                    const getNum = (key: string) => {
                      const raw = row[key] ?? row[key.toUpperCase()];
                      const n = raw !== undefined && raw !== null && raw !== "" ? Number(raw) : 0;

                      return Number.isNaN(n) ? 0 : n;
                    };

                    const total = getNum("TOTAL");

                    return (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-3">
                          <p className="text-[11px] font-medium text-brand-800">ยอดรวมทั้งหมด</p>
                          <p className="mt-1 text-base font-semibold text-brand-900">
                            {total.toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            บาท
                          </p>
                        </div>

                        {/* หมวด INCGRP จากตาราง INCGRP (เชื่อม INCPT → INCOME → INCGRP) */}
                        <div className="rounded-lg border border-flow-border bg-white p-3">
                          <h3 className="mb-2 text-xs font-semibold text-flow-text">
                            รายละเอียดตามหมวดค่าใช้จ่าย (INCGRP.NAME จากฐานข้อมูล)
                          </h3>
                          <p className="mb-2 text-[10px] text-flow-muted">
                            สรุปจาก{" "}
                            <code className="rounded bg-slate-100 px-1">
                              /api/db/patient-cost-incgrp-breakdown
                            </code>{" "}
                            — incpt.income → income.incgrp → incgrp.name
                          </p>
                          {incgrpBreakdownLoading && (
                            <p className="py-2 text-[11px] text-flow-muted">
                              กำลังโหลดหมวด INCGRP...
                            </p>
                          )}
                          {incgrpBreakdownError && (
                            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                              {incgrpBreakdownError}
                            </p>
                          )}
                          {!incgrpBreakdownLoading &&
                            !incgrpBreakdownError &&
                            incgrpBreakdown &&
                            incgrpBreakdown.length > 0 && (
                              <div className="grid gap-x-6 gap-y-1 text-[11px] md:grid-cols-2">
                                {incgrpBreakdown.map((igr) => (
                                  <div
                                    key={igr.INCGRP}
                                    className="border-b border-dashed border-slate-100 py-1"
                                  >
                                    <button
                                      type="button"
                                      className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-flow-input"
                                      onClick={() =>
                                        setExpandedIncgrp((prev) =>
                                          prev === igr.INCGRP ? null : igr.INCGRP
                                        )
                                      }
                                    >
                                      <span className="text-flow-text shrink min-w-0">
                                        <span className="font-medium">
                                          {igr.INCGRP_NAME?.trim()
                                            ? igr.INCGRP_NAME
                                            : `หมวดรหัส ${igr.INCGRP}`}
                                        </span>
                                        <span className="ml-1 text-slate-400">
                                          (incgrp {igr.INCGRP})
                                        </span>
                                      </span>
                                      <span className="flex items-center gap-2 whitespace-nowrap">
                                        <span className="font-semibold text-flow-text">
                                          {Number(igr.AMOUNT ?? 0).toLocaleString("th-TH", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}{" "}
                                          บาท
                                        </span>
                                        <span className="text-slate-400">
                                          {expandedIncgrp === igr.INCGRP ? "▲" : "▼"}
                                        </span>
                                      </span>
                                    </button>
                                  </div>
                                ))}

                              </div>
                            )}
                          {!incgrpBreakdownLoading &&
                            !incgrpBreakdownError &&
                            incgrpBreakdown &&
                            incgrpBreakdown.length === 0 && (
                              <p className="mt-2 text-[11px] text-flow-muted">
                                ไม่มียอดแยกตามหมวด INCGRP ในข้อมูลนี้
                              </p>
                            )}

                          {/* แสดงรายละเอียดเมื่อเลือกหมวด เพื่อลดข้อมูลที่แสดงพร้อมกัน */}
                          {expandedIncgrp != null && (
                            <div className="mt-3 rounded-lg border border-flow-border bg-flow-input p-2">
                              <p className="mb-2 text-[11px] font-semibold text-flow-text">
                                {expandedIncgrp === SPECIAL_SECTION_XRAY
                                  ? "รายละเอียด: สรุป X-ray / Vaccine"
                                  : expandedIncgrp === SPECIAL_SECTION_LAB
                                    ? "รายละเอียด: ค่าใช้จ่าย Lab"
                                    : `รายละเอียดหมวด incgrp ${expandedIncgrp}`}
                              </p>

                              {expandedIncgrp === SPECIAL_SECTION_XRAY && (
                                <>
                                  {xraySummaryLoading && (
                                    <p className="py-2 text-[11px] text-flow-muted">
                                      กำลังโหลดข้อมูล X-ray / Vaccine...
                                    </p>
                                  )}
                                  {xraySummaryError && (
                                    <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
                                      {xraySummaryError}
                                    </p>
                                  )}
                                  {!xraySummaryLoading && !xraySummaryError && xraySummary && (
                                    <div className="rounded border border-flow-border bg-white p-3 text-[11px]">
                                      <div className="grid gap-2 md:grid-cols-2">
                                        <div>
                                          <p className="font-semibold text-flow-text mb-1">X-ray</p>
                                          <p className="text-flow-text">
                                            {xraySummary.HAS_XRAY
                                              ? "ทำการ X-ray แล้ว"
                                              : "ยังไม่มี X-ray"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-flow-text mb-1">
                                            Vaccine ที่เกี่ยวข้อง
                                          </p>
                                          <ul className="space-y-0.5 text-flow-text">
                                            {xraySummary.HAS_HPV4 ? <li>• HPV4 vaccine</li> : null}
                                            {xraySummary.HAS_HPV9 ? <li>• HPV9 vaccine</li> : null}
                                            {xraySummary.HAS_FLU_VACCINE ? (
                                              <li>• Influenza vaccine</li>
                                            ) : null}
                                          </ul>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {!xraySummaryLoading && !xraySummaryError && !xraySummary && (
                                    <p className="text-[11px] text-flow-muted">
                                      ไม่มีข้อมูล X-ray / Vaccine สำหรับเคสนี้ในวันดังกล่าว
                                    </p>
                                  )}
                                </>
                              )}

                              {expandedIncgrp === SPECIAL_SECTION_LAB && (
                                <>
                                  {labSummaryLoading && (
                                    <p className="py-2 text-[11px] text-flow-muted">
                                      กำลังโหลดข้อมูล Lab...
                                    </p>
                                  )}
                                  {labSummaryError && (
                                    <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
                                      {labSummaryError}
                                    </p>
                                  )}
                                  {!labSummaryLoading && !labSummaryError && labSummary && (
                                    <div className="rounded border border-flow-border bg-white p-3 text-[11px]">
                                      <p className="font-semibold text-flow-text mb-1.5">
                                        ค่าใช้จ่ายในการตรวจแต่ละรายการ Lab (
                                        {labSummary.LAB_COST_ITEMS?.length ?? 0} รายการ)
                                        {labSummary.TOTAL_LAB_AMOUNT != null && (
                                          <span className="ml-2 font-semibold text-flow-text">
                                            รวม{" "}
                                            {Number(labSummary.TOTAL_LAB_AMOUNT).toLocaleString(
                                              "th-TH",
                                              {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              }
                                            )}{" "}
                                            บาท
                                          </span>
                                        )}
                                      </p>
                                      {labSummary.LAB_COST_ITEMS &&
                                      labSummary.LAB_COST_ITEMS.length > 0 ? (
                                        <div className="overflow-x-auto rounded-lg border border-flow-border">
                                          <table className="min-w-full border-collapse text-[11px] text-left">
                                            <thead>
                                              <tr className="border-b border-flow-border bg-slate-100">
                                                <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap">
                                                  รหัสรายการ
                                                </th>
                                                <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap">
                                                  ชื่อรายการ
                                                </th>
                                                <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                  จำนวน
                                                </th>
                                                <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                  ต้นทุน
                                                </th>
                                                <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                  ราคาขาย
                                                </th>
                                                <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                  ค่าใช้จ่าย (บาท)
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {labSummary.LAB_COST_ITEMS.map((item, idx) => (
                                                <tr
                                                  key={`${item.INCOME ?? ""}-${idx}`}
                                                  className="border-b border-slate-100 hover:bg-flow-input"
                                                >
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap">
                                                    {item.INCOME ?? "—"}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap">
                                                    {item.INCOMENAME ?? "—"}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
                                                    {item.QTY != null
                                                      ? Number(item.QTY).toLocaleString("th-TH")
                                                      : "—"}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
                                                    {item.PRICE != null
                                                      ? Number(item.PRICE).toLocaleString("th-TH", {
                                                          minimumFractionDigits: 2,
                                                          maximumFractionDigits: 2,
                                                        })
                                                      : "—"}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
                                                    {item.SALE_PRICE != null
                                                      ? Number(item.SALE_PRICE).toLocaleString("th-TH", {
                                                          minimumFractionDigits: 2,
                                                          maximumFractionDigits: 2,
                                                        })
                                                      : "—"}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
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
                                        <p className="text-flow-muted">ไม่มีรายการค่าใช้จ่าย Lab ในวันนี้</p>
                                      )}
                                    </div>
                                  )}
                                  {!labSummaryLoading && !labSummaryError && !labSummary && (
                                    <p className="text-[11px] text-flow-muted">
                                      ไม่มีข้อมูลค่าใช้จ่าย Lab สำหรับเคสนี้ในวันดังกล่าว
                                    </p>
                                  )}
                                </>
                              )}

                              {expandedIncgrp !== SPECIAL_SECTION_XRAY &&
                                expandedIncgrp !== SPECIAL_SECTION_LAB &&
                                !isDrugRelatedIncgrp(expandedIncgrp) && (
                                <>
                                  {costItemsLoading && (
                                    <p className="py-2 text-[11px] text-flow-muted">
                                      กำลังโหลดรายการค่าใช้จ่าย...
                                    </p>
                                  )}
                                  {costItemsError && (
                                    <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
                                      {costItemsError}
                                    </p>
                                  )}
                                  {!costItemsLoading &&
                                    !costItemsError &&
                                    filterCostItemsByIncgrp(costItems, expandedIncgrp).length ===
                                      0 && (
                                      <p className="text-[11px] text-flow-muted">
                                        ไม่พบรายการค่าใช้จ่ายย่อยในหมวดนี้สำหรับเคสดังกล่าว
                                      </p>
                                    )}
                                  {!costItemsLoading &&
                                    !costItemsError &&
                                    filterCostItemsByIncgrp(costItems, expandedIncgrp).length >
                                      0 && (
                                      <div className="overflow-x-auto rounded border border-flow-border bg-white">
                                        <table className="min-w-full border-collapse text-[11px] text-left">
                                          <thead>
                                            <tr className="border-b border-flow-border bg-slate-100">
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap">
                                                รหัสรายการ
                                              </th>
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap">
                                                ชื่อรายการ
                                              </th>
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                จำนวน
                                              </th>
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                ต้นทุน
                                              </th>
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                ราคาขาย
                                              </th>
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                ค่าใช้จ่าย (บาท)
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {filterCostItemsByIncgrp(costItems, expandedIncgrp).map(
                                              (item, idx) => (
                                                <tr
                                                  key={`cost-item-${expandedIncgrp}-${item.INCOME ?? ""}-${idx}`}
                                                  className="border-b border-slate-100 hover:bg-flow-input"
                                                >
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap">
                                                    {item.INCOME ?? "—"}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap">
                                                    {item.INCOMENAME ?? "—"}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
                                                    {item.QTY != null
                                                      ? Number(item.QTY).toLocaleString("th-TH")
                                                      : "—"}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
                                                    {item.PRICE != null
                                                      ? Number(item.PRICE).toLocaleString("th-TH", {
                                                          minimumFractionDigits: 2,
                                                          maximumFractionDigits: 2,
                                                        })
                                                      : "—"}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
                                                    {item.SALE_PRICE != null
                                                      ? Number(item.SALE_PRICE).toLocaleString("th-TH", {
                                                          minimumFractionDigits: 2,
                                                          maximumFractionDigits: 2,
                                                        })
                                                      : "—"}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
                                                    {Number(item.INCAMT ?? 0).toLocaleString("th-TH", {
                                                      minimumFractionDigits: 2,
                                                      maximumFractionDigits: 2,
                                                    })}
                                                  </td>
                                                </tr>
                                              )
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                </>
                                )}

                              {expandedIncgrp !== SPECIAL_SECTION_XRAY &&
                                expandedIncgrp !== SPECIAL_SECTION_LAB &&
                                isDrugRelatedIncgrp(expandedIncgrp) && (
                                <>
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded border border-flow-border bg-flow-input px-2 py-1.5 text-[11px]">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-flow-text">
                                        <input
                                          type="checkbox"
                                          className="ui-checkbox"
                                          checked={filterNegativeProfitOnly}
                                          onChange={(event) => setFilterNegativeProfitOnly(event.target.checked)}
                                        />
                                        แสดงเฉพาะรายการที่กำไรรวมติดลบ
                                      </label>
                                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-flow-text">
                                        <input
                                          type="checkbox"
                                          className="ui-checkbox"
                                          checked={excludeZeroSale}
                                          onChange={(event) => setExcludeZeroSale(event.target.checked)}
                                        />
                                        ไม่แสดงเฉพาะรายการที่มูลค่าขายรวม = 0
                                      </label>
                                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-flow-text">
                                        <input
                                          type="checkbox"
                                          className="ui-checkbox"
                                          checked={excludeNegativeProfit}
                                          onChange={(event) => setExcludeNegativeProfit(event.target.checked)}
                                        />
                                        ไม่แสดงเฉพาะรายการที่กำไรรวมติดลบ
                                      </label>
                                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-flow-text">
                                        <input
                                          type="checkbox"
                                          className="ui-checkbox"
                                          checked={filterZeroSaleOnly}
                                          onChange={(event) => setFilterZeroSaleOnly(event.target.checked)}
                                        />
                                        แสดงเฉพาะรายการที่มูลค่าขายรวม = 0
                                      </label>
                                    </div>
                                    <button
                                      type="button"
                                      className="rounded border border-flow-border bg-white px-2 py-0.5 text-[11px] text-flow-text hover:bg-flow-input"
                                      onClick={() => {
                                        setFilterZeroSaleOnly(false);
                                        setFilterNegativeProfitOnly(false);
                                        setExcludeZeroSale(false);
                                        setExcludeNegativeProfit(false);
                                      }}
                                    >
                                      ล้างฟิลเตอร์
                                    </button>
                                  </div>
                                  {drugSummaryLoading && (
                                    <p className="py-2 text-[11px] text-flow-muted">
                                      กำลังโหลดข้อมูลค่ายา...
                                    </p>
                                  )}
                                  {drugSummaryError && (
                                    <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
                                      {drugSummaryError}
                                    </p>
                                  )}
                                  {!drugSummaryLoading &&
                                    !drugSummaryError &&
                                    drugSummary &&
                                    filteredDrugRowsForExpanded.length ===
                                      0 && (
                                      <p className="py-2 text-[11px] text-flow-muted">
                                        ไม่มีข้อมูลรายการยาสำหรับหมวดที่เลือก
                                      </p>
                                    )}
                                  {!drugSummaryLoading &&
                                    !drugSummaryError &&
                                    drugSummary &&
                                    filteredDrugRowsForExpanded.length >
                                      0 && (
                                      <div className="overflow-x-auto rounded border border-flow-border bg-white">
                                        <table className="min-w-full border-collapse text-[11px] text-left">
                                          <thead>
                                            <tr className="border-b border-flow-border bg-slate-100">
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap">
                                                คลินิก
                                              </th>
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap">
                                                รหัสยา
                                              </th>
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap">
                                                ชื่อยา
                                              </th>
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                จำนวนรวม
                                              </th>
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                ต้นทุนรวม (ต้นทุน/หน่วย)
                                              </th>
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                มูลค่าขายรวม
                                              </th>
                                              <th className="px-2 py-1.5 font-semibold text-flow-text whitespace-nowrap text-right">
                                                กำไรรวม
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {filteredDrugRowsForExpanded.map(
                                              (drug, idx) => (
                                              <tr
                                                key={`compact-${drug.MEDITEM}-${idx}`}
                                                className="border-b border-slate-100 hover:bg-flow-input"
                                              >
                                                <td className="px-2 py-1.5 text-flow-text whitespace-nowrap">
                                                  {drug.CLINIC_LCT_NAME ?? drug.CLINIC_LCT ?? "—"}
                                                </td>
                                                <td className="px-2 py-1.5 text-flow-text whitespace-nowrap">
                                                  {drug.MEDITEM}
                                                </td>
                                                <td className="px-2 py-1.5 text-flow-text whitespace-nowrap">
                                                  {drug.DRUG_NAME ?? "—"}
                                                </td>
                                                <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
                                                  {Number(drug.TOTAL_QTY ?? 0).toLocaleString("th-TH")}
                                                </td>
                                                <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
                                                  {(() => {
                                                    const totalCost = Number(drug.TOTAL_COST ?? 0);
                                                    const totalQty = Number(drug.TOTAL_QTY ?? 0);
                                                    const unitCost =
                                                      totalQty > 0 ? totalCost / totalQty : 0;

                                                    return `${totalCost.toLocaleString("th-TH", {
                                                      minimumFractionDigits: 2,
                                                      maximumFractionDigits: 2,
                                                    })} (${unitCost.toLocaleString("th-TH", {
                                                      minimumFractionDigits: 1,
                                                      maximumFractionDigits: 2,
                                                    })})`;
                                                  })()}
                                                </td>
                                                <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
                                                  {Number(drug.TOTAL_SALE ?? 0).toLocaleString("th-TH", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  })}
                                                </td>
                                                <td className="px-2 py-1.5 text-flow-text whitespace-nowrap text-right">
                                                  {Number(drug.TOTAL_PROFIT ?? 0).toLocaleString("th-TH", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  })}
                                                </td>
                                              </tr>
                                            )
                                            )}
                                            <tr className="bg-flow-input font-semibold text-flow-text">
                                              <td className="px-2 py-1.5 whitespace-nowrap">รวม</td>
                                              <td className="px-2 py-1.5 whitespace-nowrap">—</td>
                                              <td className="px-2 py-1.5 whitespace-nowrap">—</td>
                                              <td className="px-2 py-1.5 whitespace-nowrap text-right">
                                                {filteredDrugRowsForExpanded
                                                  .reduce(
                                                    (acc, r) => acc + Number(r.TOTAL_QTY ?? 0),
                                                    0
                                                  )
                                                  .toLocaleString("th-TH")}
                                              </td>
                                              <td className="px-2 py-1.5 whitespace-nowrap text-right">
                                                {(() => {
                                                  const rows = filteredDrugRowsForExpanded;
                                                  const totalCost = rows.reduce(
                                                    (acc, r) => acc + Number(r.TOTAL_COST ?? 0),
                                                    0
                                                  );

                                                  return totalCost.toLocaleString("th-TH", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  });
                                                })()}
                                              </td>
                                              <td className="px-2 py-1.5 whitespace-nowrap text-right">
                                                {filteredDrugRowsForExpanded
                                                  .reduce(
                                                    (acc, r) => acc + Number(r.TOTAL_SALE ?? 0),
                                                    0
                                                  )
                                                  .toLocaleString("th-TH", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  })}
                                              </td>
                                              <td className="px-2 py-1.5 whitespace-nowrap text-right">
                                                {filteredDrugRowsForExpanded
                                                  .reduce(
                                                    (acc, r) => acc + Number(r.TOTAL_PROFIT ?? 0),
                                                    0
                                                  )
                                                  .toLocaleString("th-TH", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  })}
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
