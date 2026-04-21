"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import { isoToThaiDisplay } from "@/lib/date/thaiDate";
import { normalizeHnInput } from "@/lib/hn/normalize";
import { siteConfig } from "@/config/site";

/** Oracle / JSON อาจส่งค่าเป็นตัวเลข — ใช้ก่อน .toLowerCase() / เปรียบเทียบ */
function normalizeFieldForFilter(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase();
}

/** กรองรายการตัวเลือกหลายค่า (สิทธิ/คลินิก/ฯลฯ) ตามข้อความค้นหา */
function filterStringOptions(options: string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return options;
  const needle = normalizeFieldForFilter(trimmed);
  return options.filter((opt) => normalizeFieldForFilter(opt).includes(needle));
}

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

function matchesHnFilter(hnValue: unknown, filterInput: string): boolean {
  const input = filterInput.trim();
  if (!input) return true;

  const raw = String(hnValue ?? "").trim();
  const rawDigits = raw.replace(/\D/g, "");
  const display = formatHnDisplay(raw).toLowerCase();
  const normalizedInput = normalizeHnInput(input);
  const inputDigits = input.replace(/\D/g, "");
  const inputLower = input.toLowerCase();

  return (
    raw.includes(normalizedInput) ||
    rawDigits.includes(inputDigits) ||
    display.includes(inputLower) ||
    raw.toLowerCase().includes(inputLower)
  );
}

const THAI_MONTH_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function formatPeriodLabelThai(periodValue: string, groupBy: PeriodGroupBy): string {
  const raw = String(periodValue ?? "").trim();
  if (!raw) return "-";

  if (groupBy === "year") {
    const year = Number(raw);
    if (Number.isFinite(year)) return `พ.ศ. ${year + 543}`;
    return raw;
  }

  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return raw;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return raw;

  return `${THAI_MONTH_SHORT[month - 1]} ${year + 543}`;
}

type DrugCostSummaryRow = {
  HN: string | number;
  VISIT_KEY?: string | number | null;
  PTTYPE_NAME: string | null;
  CLINIC_LCT: string | null;
  CLINIC_LCT_NAME: string | null;
  MEDITEM: string | number;
  MEDTYPE: string | null;
  ACCNATION: string | null;
  DRUG_NAME: string | null;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
};

type SummaryTab = "period" | "detail";
type PeriodGroupBy = "month" | "year";

type DrugCostSummaryPeriodRow = {
  PERIOD_KEY: string;
  PERIOD_LABEL: string;
  TOTAL_ITEM_COUNT: number;
  TOTAL_UNIQUE_ITEM_COUNT?: number;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
};

type DrugCostFilterOptions = {
  pttype: string[];
  clinic: string[];
  medtype: string[];
  accnation: string[];
};

type SortKey =
  | "HN"
  | "PTTYPE"
  | "CLINIC"
  | "MEDITEM"
  | "DRUG_NAME"
  | "MEDTYPE"
  | "ACCNATION"
  | "TOTAL_QTY"
  | "TOTAL_COST"
  | "TOTAL_SALE"
  | "TOTAL_PROFIT";

export default function DrugCostSummaryPage() {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState<string>(todayIso);
  const [dateTo, setDateTo] = useState<string>(todayIso);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [rows, setRows] = useState<DrugCostSummaryRow[]>([]);
  const [periodRows, setPeriodRows] = useState<DrugCostSummaryPeriodRow[]>([]);
  const [periodUniqueItemCount, setPeriodUniqueItemCount] = useState<number>(0);
  const [periodFilterOptions, setPeriodFilterOptions] = useState<DrugCostFilterOptions>({
    pttype: [],
    clinic: [],
    medtype: [],
    accnation: [],
  });
  const [activeTab, setActiveTab] = useState<SummaryTab>("detail");
  const [periodGroupBy, setPeriodGroupBy] = useState<PeriodGroupBy>("month");
  const [periodHasFetched, setPeriodHasFetched] = useState(false);
  const skipNextPeriodAutoRefreshRef = useRef(false);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [sortKey, setSortKey] = useState<SortKey>("MEDITEM");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  /** ฟิลเตอร์หลังโหลดข้อมูล (กรองฝั่ง client) */
  const [filterMeditem, setFilterMeditem] = useState("");
  const [filterHn, setFilterHn] = useState("");
  const [filterClinic, setFilterClinic] = useState<string[]>([]);
  const [filterPttype, setFilterPttype] = useState<string[]>([]);
  const [filterDrugName, setFilterDrugName] = useState("");
  const [filterMedtype, setFilterMedtype] = useState<string[]>([]);
  const [filterAccnation, setFilterAccnation] = useState<string[]>([]);
  const [filterZeroSaleOnly, setFilterZeroSaleOnly] = useState(false);
  const [filterNegativeProfitOnly, setFilterNegativeProfitOnly] = useState(false);
  const [excludeZeroSale, setExcludeZeroSale] = useState(false);
  const [excludeNegativeProfit, setExcludeNegativeProfit] = useState(false);
  const [includeOpd, setIncludeOpd] = useState(true);
  const [includeIpd, setIncludeIpd] = useState(false);

  const [filterPttypeListQuery, setFilterPttypeListQuery] = useState("");
  const [filterClinicListQuery, setFilterClinicListQuery] = useState("");
  const [filterMedtypeListQuery, setFilterMedtypeListQuery] = useState("");
  const [filterAccnationListQuery, setFilterAccnationListQuery] = useState("");

  const buildPeriodPayload = () => {
    const payload: Record<string, unknown> = {
      d1: dateFrom,
      d2: dateTo,
      groupBy: periodGroupBy,
      opd: includeOpd,
      ipd: includeIpd,
    };
    if (filterPttype.length > 0) payload.pttype = filterPttype;
    if (filterClinic.length > 0) payload.clinic = filterClinic;
    if (filterMedtype.length > 0) payload.medtype = filterMedtype;
    if (filterAccnation.length > 0) payload.accnation = filterAccnation;
    return payload;
  };

  const parseJsonSafe = async (res: Response): Promise<any> => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setDateError(null);

    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T00:00:00`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      setDateError("ช่วงวันที่ไม่ถูกต้อง");
      return;
    }

    if (from > to) {
      setDateError("วันที่เริ่มต้องไม่มากกว่าวันที่สิ้นสุด");
      return;
    }

    if (!includeOpd && !includeIpd) {
      setDateError("กรุณาเลือกอย่างน้อย 1 ประเภทบริการ (OPD หรือ IPD)");
      return;
    }

    if (activeTab === "detail") {
      const diffMs = to.getTime() - from.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 31) {
        setDateError("แท็บรายคนกำหนดช่วงวันที่ได้ไม่เกิน 1 เดือน");
        return;
      }
    } else {
      // แท็บสรุปรายเดือน/ปี จำกัดช่วงค้นหาไม่เกิน 1 ปี (นับตามปฏิทิน)
      const maxTo = new Date(from);
      maxTo.setFullYear(maxTo.getFullYear() + 1);
      if (to > maxTo) {
        setDateError("แท็บสรุปรายเดือน/ปีกำหนดช่วงวันที่ได้ไม่เกิน 1 ปี");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setRows([]);
    setPeriodRows([]);
    setPeriodUniqueItemCount(0);
    setPage(1);

    const query = new URLSearchParams();
    query.set("d1", dateFrom);
    query.set("d2", dateTo);
    query.set("opd", includeOpd ? "1" : "0");
    query.set("ipd", includeIpd ? "1" : "0");

    try {
      if (activeTab === "period") {
        const periodPayload = buildPeriodPayload();
        const [resSummary, resOptions] = await Promise.all([
          fetch("/api/db/drug-cost-summary-period", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(periodPayload),
          }),
          fetch(
            `/api/db/drug-cost-summary-filter-options?d1=${encodeURIComponent(dateFrom)}&d2=${encodeURIComponent(dateTo)}&opd=${includeOpd ? "1" : "0"}&ipd=${includeIpd ? "1" : "0"}`,
            { cache: "no-store" }
          ),
        ]);
        const [jsonSummary, jsonOptions] = await Promise.all([
          parseJsonSafe(resSummary),
          parseJsonSafe(resOptions),
        ]);

        if (!resSummary.ok || !jsonSummary.success) {
          setError(jsonSummary.message ?? "ค้นหาข้อมูลไม่สำเร็จ");
          return;
        }
        if (!resOptions.ok || !jsonOptions.success) {
          setError(jsonOptions.message ?? "ไม่สามารถโหลดตัวเลือกฟิลเตอร์ได้");
          return;
        }

        setPeriodRows(Array.isArray(jsonSummary.data) ? jsonSummary.data : []);
        setPeriodUniqueItemCount(
          Number.isFinite(Number(jsonSummary.uniqueItemCount)) ? Number(jsonSummary.uniqueItemCount) : 0
        );
        setPeriodFilterOptions({
          pttype: Array.isArray(jsonOptions.data?.pttype) ? jsonOptions.data.pttype : [],
          clinic: Array.isArray(jsonOptions.data?.clinic) ? jsonOptions.data.clinic : [],
          medtype: Array.isArray(jsonOptions.data?.medtype) ? jsonOptions.data.medtype : [],
          accnation: Array.isArray(jsonOptions.data?.accnation) ? jsonOptions.data.accnation : [],
        });
        skipNextPeriodAutoRefreshRef.current = true;
        setPeriodHasFetched(true);
      } else {
        const [resDetail, resOptions] = await Promise.all([
          fetch(`/api/db/drug-cost-summary?${query.toString()}`, { cache: "no-store" }),
          fetch(
            `/api/db/drug-cost-summary-filter-options?d1=${encodeURIComponent(dateFrom)}&d2=${encodeURIComponent(dateTo)}&opd=${includeOpd ? "1" : "0"}&ipd=${includeIpd ? "1" : "0"}`,
            { cache: "no-store" }
          ),
        ]);
        const [jsonDetail, jsonOptions] = await Promise.all([
          parseJsonSafe(resDetail),
          parseJsonSafe(resOptions),
        ]);
        if (!resDetail.ok || !jsonDetail.success) {
          setError(jsonDetail.message ?? "ค้นหาข้อมูลไม่สำเร็จ");
          return;
        }
        if (resOptions.ok && jsonOptions.success) {
          setPeriodFilterOptions({
            pttype: Array.isArray(jsonOptions.data?.pttype) ? jsonOptions.data.pttype : [],
            clinic: Array.isArray(jsonOptions.data?.clinic) ? jsonOptions.data.clinic : [],
            medtype: Array.isArray(jsonOptions.data?.medtype) ? jsonOptions.data.medtype : [],
            accnation: Array.isArray(jsonOptions.data?.accnation) ? jsonOptions.data.accnation : [],
          });
        }
        setRows(Array.isArray(jsonDetail.data) ? jsonDetail.data : []);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "period" || !periodHasFetched) return;
    if (skipNextPeriodAutoRefreshRef.current) {
      skipNextPeriodAutoRefreshRef.current = false;
      return;
    }

    const controller = new AbortController();

    const refreshPeriodSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/db/drug-cost-summary-period", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          cache: "no-store",
          body: JSON.stringify(buildPeriodPayload()),
        });
        const json = await parseJsonSafe(res);
        if (!res.ok || !json.success) {
          setError(json.message ?? "ค้นหาข้อมูลไม่สำเร็จ");
          return;
        }
        setPeriodRows(Array.isArray(json.data) ? json.data : []);
        setPeriodUniqueItemCount(Number.isFinite(Number(json.uniqueItemCount)) ? Number(json.uniqueItemCount) : 0);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void refreshPeriodSummary();
    return () => controller.abort();
  }, [
    activeTab,
    periodHasFetched,
    periodGroupBy,
    includeOpd,
    includeIpd,
    filterPttype,
    filterClinic,
    filterMedtype,
    filterAccnation,
  ]);

  const medtypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.MEDTYPE != null && String(r.MEDTYPE).trim() !== "") {
        set.add(String(r.MEDTYPE));
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [rows]);

  const accnationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.ACCNATION != null && String(r.ACCNATION).trim() !== "") {
        set.add(String(r.ACCNATION));
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [rows]);

  const clinicOptionsFromRows = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const clinic = String(r.CLINIC_LCT_NAME ?? r.CLINIC_LCT ?? "").trim();
      if (clinic !== "") {
        set.add(clinic);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [rows]);

  const pttypeOptionsFromRows = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const name = String(r.PTTYPE_NAME ?? "").trim();
      if (name !== "") {
        set.add(name);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [rows]);

  const pttypeOptions = useMemo(() => {
    if (periodFilterOptions.pttype.length > 0) return periodFilterOptions.pttype;
    return pttypeOptionsFromRows;
  }, [periodFilterOptions.pttype, pttypeOptionsFromRows]);
  const clinicOptions = useMemo(
    () => (activeTab === "period" ? periodFilterOptions.clinic : clinicOptionsFromRows),
    [activeTab, periodFilterOptions.clinic, clinicOptionsFromRows]
  );
  const medtypeOptionsForUi = useMemo(
    () => (activeTab === "period" ? periodFilterOptions.medtype : medtypeOptions),
    [activeTab, periodFilterOptions.medtype, medtypeOptions]
  );
  const accnationOptionsForUi = useMemo(
    () => (activeTab === "period" ? periodFilterOptions.accnation : accnationOptions),
    [activeTab, periodFilterOptions.accnation, accnationOptions]
  );

  const pttypeOptionsFiltered = useMemo(
    () => filterStringOptions(pttypeOptions, filterPttypeListQuery),
    [pttypeOptions, filterPttypeListQuery]
  );
  const clinicOptionsFiltered = useMemo(
    () => filterStringOptions(clinicOptions, filterClinicListQuery),
    [clinicOptions, filterClinicListQuery]
  );
  const medtypeOptionsFiltered = useMemo(
    () => filterStringOptions(medtypeOptionsForUi, filterMedtypeListQuery),
    [medtypeOptionsForUi, filterMedtypeListQuery]
  );
  const accnationOptionsFiltered = useMemo(
    () => filterStringOptions(accnationOptionsForUi, filterAccnationListQuery),
    [accnationOptionsForUi, filterAccnationListQuery]
  );

  const filteredRows = useMemo(() => {
    const h = filterHn.trim();
    const c = filterClinic.map((x) => x.toLowerCase());
    const m = filterMeditem.trim().toLowerCase();
    const d = filterDrugName.trim().toLowerCase();

    return rows.filter((r) => {
      if (!matchesHnFilter(r.HN, h)) {
        return false;
      }
      if (
        c.length > 0 &&
        !c.includes(normalizeFieldForFilter(String(r.CLINIC_LCT_NAME ?? r.CLINIC_LCT ?? "")))
      ) {
        return false;
      }
      if (filterPttype.length > 0 && !filterPttype.includes(String(r.PTTYPE_NAME ?? "").trim())) {
        return false;
      }
      if (m && !normalizeFieldForFilter(r.MEDITEM).includes(m)) {
        return false;
      }
      if (d && !normalizeFieldForFilter(r.DRUG_NAME).includes(d)) {
        return false;
      }
      if (filterMedtype.length > 0 && !filterMedtype.includes(String(r.MEDTYPE ?? ""))) {
        return false;
      }
      if (
        filterAccnation.length > 0 &&
        !filterAccnation.includes(String(r.ACCNATION ?? ""))
      ) {
        return false;
      }
      if (filterZeroSaleOnly && Number(r.TOTAL_SALE ?? 0) !== 0) {
        return false;
      }
      if (filterNegativeProfitOnly && Number(r.TOTAL_PROFIT ?? 0) >= 0) {
        return false;
      }
      if (excludeZeroSale && Number(r.TOTAL_SALE ?? 0) === 0) {
        return false;
      }
      if (excludeNegativeProfit && Number(r.TOTAL_PROFIT ?? 0) < 0) {
        return false;
      }
      return true;
    });
  }, [
    rows,
    filterHn,
    filterClinic,
    filterPttype,
    filterMeditem,
    filterDrugName,
    filterMedtype,
    filterAccnation,
    filterZeroSaleOnly,
    filterNegativeProfitOnly,
    excludeZeroSale,
    excludeNegativeProfit,
  ]);

  const sortedRows = useMemo(() => {
    const rowsToSort = [...filteredRows];
    const getText = (value: unknown) => String(value ?? "").toLowerCase();
    const getNum = (value: unknown) => Number(value ?? 0);

    rowsToSort.sort((a, b) => {
      let compareValue = 0;

      switch (sortKey) {
        case "HN":
          compareValue = getText(a.HN).localeCompare(getText(b.HN), "th");
          break;
        case "PTTYPE":
          compareValue = getText(a.PTTYPE_NAME).localeCompare(getText(b.PTTYPE_NAME), "th");
          break;
        case "CLINIC":
          compareValue = getText(a.CLINIC_LCT_NAME ?? a.CLINIC_LCT).localeCompare(
            getText(b.CLINIC_LCT_NAME ?? b.CLINIC_LCT),
            "th"
          );
          break;
        case "MEDITEM":
          compareValue = getText(a.MEDITEM).localeCompare(getText(b.MEDITEM), "th");
          break;
        case "DRUG_NAME":
          compareValue = getText(a.DRUG_NAME).localeCompare(getText(b.DRUG_NAME), "th");
          break;
        case "MEDTYPE":
          compareValue = getText(a.MEDTYPE).localeCompare(getText(b.MEDTYPE), "th");
          break;
        case "ACCNATION":
          compareValue = getText(a.ACCNATION).localeCompare(getText(b.ACCNATION), "th");
          break;
        case "TOTAL_QTY":
          compareValue = getNum(a.TOTAL_QTY) - getNum(b.TOTAL_QTY);
          break;
        case "TOTAL_COST":
          compareValue = getNum(a.TOTAL_COST) - getNum(b.TOTAL_COST);
          break;
        case "TOTAL_SALE":
          compareValue = getNum(a.TOTAL_SALE) - getNum(b.TOTAL_SALE);
          break;
        case "TOTAL_PROFIT":
          compareValue = getNum(a.TOTAL_PROFIT) - getNum(b.TOTAL_PROFIT);
          break;
        default:
          compareValue = 0;
      }

      return sortDirection === "asc" ? compareValue : -compareValue;
    });

    return rowsToSort;
  }, [filteredRows, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize) || 1);
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedRows = sortedRows.slice(startIndex, endIndex);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.qty += r.TOTAL_QTY ?? 0;
        acc.cost += r.TOTAL_COST ?? 0;
        acc.sale += r.TOTAL_SALE ?? 0;
        acc.profit += r.TOTAL_PROFIT ?? 0;
        return acc;
      },
      { qty: 0, cost: 0, sale: 0, profit: 0 }
    );
  }, [filteredRows]);

  const uniqueHnCount = useMemo(() => {
    const hnSet = new Set<string>();
    for (const row of filteredRows) {
      const hn = String(row.HN ?? "").trim();
      if (hn !== "") hnSet.add(hn);
    }
    return hnSet.size;
  }, [filteredRows]);

  const uniqueVisitCount = useMemo(() => {
    const visitSet = new Set<string>();
    for (const row of filteredRows) {
      const key = String(row.VISIT_KEY ?? "").trim();
      if (key !== "") visitSet.add(key);
    }
    return visitSet.size;
  }, [filteredRows]);

  const filteredPeriodRows = useMemo(() => {
    return periodRows.filter((row) => {
      if (filterZeroSaleOnly && Number(row.TOTAL_SALE ?? 0) !== 0) {
        return false;
      }
      if (filterNegativeProfitOnly && Number(row.TOTAL_PROFIT ?? 0) >= 0) {
        return false;
      }
      if (excludeZeroSale && Number(row.TOTAL_SALE ?? 0) === 0) {
        return false;
      }
      if (excludeNegativeProfit && Number(row.TOTAL_PROFIT ?? 0) < 0) {
        return false;
      }
      return true;
    });
  }, [
    periodRows,
    filterZeroSaleOnly,
    filterNegativeProfitOnly,
    excludeZeroSale,
    excludeNegativeProfit,
  ]);

  const periodTotalsFiltered = useMemo(() => {
    return filteredPeriodRows.reduce(
      (acc, r) => {
        acc.qty += r.TOTAL_QTY ?? 0;
        acc.cost += r.TOTAL_COST ?? 0;
        acc.sale += r.TOTAL_SALE ?? 0;
        acc.profit += r.TOTAL_PROFIT ?? 0;
        return acc;
      },
      { qty: 0, cost: 0, sale: 0, profit: 0 }
    );
  }, [filteredPeriodRows]);

  const clearFilters = () => {
    setFilterHn("");
    setFilterClinic([]);
    setFilterPttype([]);
    setFilterMeditem("");
    setFilterDrugName("");
    setFilterMedtype([]);
    setFilterAccnation([]);
    setFilterZeroSaleOnly(false);
    setFilterNegativeProfitOnly(false);
    setExcludeZeroSale(false);
    setExcludeNegativeProfit(false);
    setFilterPttypeListQuery("");
    setFilterClinicListQuery("");
    setFilterMedtypeListQuery("");
    setFilterAccnationListQuery("");
    setPage(1);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
    setPage(1);
  };

  const sortMark = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "▲" : "▼";
  };

  const handleExportExcel = async () => {
    if (sortedRows.length === 0 || exporting) return;

    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const header = [
        "NO",
        "HN",
        "สิทธิการรักษา",
        "คลินิก",
        "รหัสยา",
        "ชื่อยา",
        "ประเภทยา",
        "บัญชียาหลัก",
        "จำนวนรวม",
        "ต้นทุนรวม",
        "มูลค่าขายรวม",
        "กำไรรวม",
      ];

      const dataRows = sortedRows.map((row, index) => [
        index + 1,
        row.HN ?? "",
        row.PTTYPE_NAME ?? "",
        row.CLINIC_LCT_NAME ?? row.CLINIC_LCT ?? "",
        row.MEDITEM ?? "",
        row.DRUG_NAME ?? "",
        row.MEDTYPE ?? "",
        row.ACCNATION ?? "",
        Number(row.TOTAL_QTY ?? 0),
        Number(row.TOTAL_COST ?? 0),
        Number(row.TOTAL_SALE ?? 0),
        Number(row.TOTAL_PROFIT ?? 0),
      ]);

      const totalQty = sortedRows.reduce((acc, r) => acc + Number(r.TOTAL_QTY ?? 0), 0);
      const totalCost = sortedRows.reduce((acc, r) => acc + Number(r.TOTAL_COST ?? 0), 0);
      const totalSale = sortedRows.reduce((acc, r) => acc + Number(r.TOTAL_SALE ?? 0), 0);
      const totalProfit = sortedRows.reduce((acc, r) => acc + Number(r.TOTAL_PROFIT ?? 0), 0);

      const totalRow = [
        "",
        "",
        "",
        "",
        "",
        "รวม",
        "",
        "",
        totalQty,
        totalCost,
        totalSale,
        totalProfit,
      ];
      const sheetData = [header, ...dataRows, totalRow];

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      worksheet["!cols"] = [
        { wch: 6 }, // NO
        { wch: 14 }, // HN
        { wch: 22 }, // สิทธิการรักษา
        { wch: 28 }, // คลินิก
        { wch: 14 }, // รหัสยา
        { wch: 42 }, // ชื่อยา
        { wch: 14 }, // ประเภทยา
        { wch: 24 }, // บัญชียาหลัก
        { wch: 10 }, // จำนวนรวม
        { wch: 14 }, // ต้นทุนรวม
        { wch: 14 }, // มูลค่าขายรวม
        { wch: 12 }, // กำไรรวม
      ];

      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      for (let r = 1; r <= range.e.r; r++) {
        const qtyCell = XLSX.utils.encode_cell({ r, c: 8 });
        const costCell = XLSX.utils.encode_cell({ r, c: 9 });
        const saleCell = XLSX.utils.encode_cell({ r, c: 10 });
        const profitCell = XLSX.utils.encode_cell({ r, c: 11 });
        if (worksheet[qtyCell]) worksheet[qtyCell].z = "#,##0";
        if (worksheet[costCell]) worksheet[costCell].z = "#,##0.00";
        if (worksheet[saleCell]) worksheet[saleCell].z = "#,##0.00";
        if (worksheet[profitCell]) worksheet[profitCell].z = "#,##0.00";
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, "DrugCostSummary");

      const fileDate = `${dateFrom}_to_${dateTo}`;
      XLSX.writeFile(workbook, `drug-cost-summary_${fileDate}.xlsx`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "ไม่สามารถ export Excel ได้");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPeriodExcel = async () => {
    if (filteredPeriodRows.length === 0 || exporting) return;

    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const header = ["NO", periodGroupBy === "month" ? "เดือน ปี " : "ปี (พ.ศ.)", "จำนวนรวม", "ต้นทุนรวม", "มูลค่าขายรวม", "กำไรรวม"];

      const dataRows = filteredPeriodRows.map((row, index) => [
        index + 1,
        formatPeriodLabelThai(String(row.PERIOD_KEY ?? row.PERIOD_LABEL ?? ""), periodGroupBy),
        Number(row.TOTAL_QTY ?? 0),
        Number(row.TOTAL_COST ?? 0),
        Number(row.TOTAL_SALE ?? 0),
        Number(row.TOTAL_PROFIT ?? 0),
      ]);

      const totalRow = [
        "",
        "รวม",
        Number(periodTotalsFiltered.qty ?? 0),
        Number(periodTotalsFiltered.cost ?? 0),
        Number(periodTotalsFiltered.sale ?? 0),
        Number(periodTotalsFiltered.profit ?? 0),
      ];
      const sheetData = [header, ...dataRows, totalRow];

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      worksheet["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      for (let r = 1; r <= range.e.r; r++) {
        const qtyCell = XLSX.utils.encode_cell({ r, c: 2 });
        const costCell = XLSX.utils.encode_cell({ r, c: 3 });
        const saleCell = XLSX.utils.encode_cell({ r, c: 4 });
        const profitCell = XLSX.utils.encode_cell({ r, c: 5 });
        if (worksheet[qtyCell]) worksheet[qtyCell].z = "#,##0";
        if (worksheet[costCell]) worksheet[costCell].z = "#,##0.00";
        if (worksheet[saleCell]) worksheet[saleCell].z = "#,##0.00";
        if (worksheet[profitCell]) worksheet[profitCell].z = "#,##0.00";
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, "DrugCostSummaryPeriod");
      const fileDate = `${dateFrom}_to_${dateTo}`;
      XLSX.writeFile(workbook, `drug-cost-summary-period_${fileDate}.xlsx`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "ไม่สามารถ export Excel ได้");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="w-full px-4 md:px-6 py-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              สรุปต้นทุนและกำไรจากยา (ตามรายการยา)
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              ข้อมูลจาก PRSC / PRSCDT / MEDITEM — สิทธิการรักษาจาก PRSC.PTTYPE → PTTYPE.NAME — รวมตามรหัสยาและช่วงวันที่สั่งยา
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 md:px-6 py-6 md:py-8">
        <section className="mb-4">
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab("detail");
                setPeriodRows([]);
                setPeriodUniqueItemCount(0);
                setError(null);
              }}
              className={`rounded-md px-3 py-1.5 font-medium ${
                activeTab === "detail"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              รายละเอียดรายคน/รายยา
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("period");
                setRows([]);
                setPeriodUniqueItemCount(0);
                setError(null);
              }}
              className={`rounded-md px-3 py-1.5 font-medium ${
                activeTab === "period"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              สรุปรายเดือน/รายปี
            </button>
          </div>
        </section>

        {/* ฟอร์มค้นหา */}
        <section className="mb-6">
          <form
            onSubmit={handleSearch}
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 md:p-5 shadow-sm space-y-4"
          >
            <div className="flex flex-wrap items-start gap-4">
              <ThaiDatePicker
                id="dateFrom"
                label="วันที่เริ่ม (prscdate จาก)"
                value={dateFrom}
                onChange={(iso) => {
                  setDateFrom(iso);
                  setDateError(null);
                }}
              />
              <ThaiDatePicker
                id="dateTo"
                label="วันที่สิ้นสุด (prscdate ถึง)"
                value={dateTo}
                onChange={(iso) => {
                  setDateTo(iso);
                  setDateError(null);
                }}
              />
              <div className="mt-6 inline-flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">
                <span className="font-medium text-slate-700">ประเภทบริการ</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    checked={includeOpd}
                    onChange={(e) => {
                      setIncludeOpd(e.target.checked);
                      setDateError(null);
                    }}
                  />
                  <span>OPD</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    checked={includeIpd}
                    onChange={(e) => {
                      setIncludeIpd(e.target.checked);
                      setDateError(null);
                    }}
                  />
                  <span>IPD</span>
                </label>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-6 inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs md:text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "กำลังค้นหา..." : "ค้นหาข้อมูล"}
              </button>
              {activeTab === "period" && (
                <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">
                  <span>สรุปแบบ</span>
                  <select
                    value={periodGroupBy}
                    onChange={(e) => setPeriodGroupBy(e.target.value as PeriodGroupBy)}
                    className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="month">รายเดือน</option>
                    <option value="year">รายปี</option>
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setDateFrom(today);
                  setDateTo(today);
                  setDateError(null);
                }}
                className="mt-6 inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs md:text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                เคลียร์วันที่
              </button>
            </div>
            {dateError && (
              <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                {dateError}
              </p>
            )}
          </form>
        </section>

        {loading && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
            <div className="pointer-events-auto inline-flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 shadow-[0_12px_40px_rgba(14,116,144,0.18)]">
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"
                aria-hidden="true"
              />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-sky-900">กำลังค้นหาข้อมูล</p>
                <p className="text-[11px] text-sky-700">โปรดรอสักครู่...</p>
              </div>
            </div>
          </div>
        )}

        {/* ฟิลเตอร์หลังมีข้อมูล */}
        {(activeTab === "detail" || activeTab === "period") && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold text-slate-800">กรองผลลัพธ์</h2>
            <div
              className={
                activeTab === "period"
                  ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                  : "grid gap-3 sm:grid-cols-2 lg:grid-cols-7"
              }
            >
              {activeTab === "detail" && (
              <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700" htmlFor="filterHn">
                  HN
                </label>
                <input
                  id="filterHn"
                  type="text"
                  value={filterHn}
                  onChange={(e) => {
                    setFilterHn(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="เช่น 1666/69 หรือ 69001666"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700" htmlFor="filterMeditem">
                  รหัสยา (มีส่วนของข้อความ)
                </label>
                <input
                  id="filterMeditem"
                  type="text"
                  value={filterMeditem}
                  onChange={(e) => {
                    setFilterMeditem(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="เช่น 5010"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700" htmlFor="filterDrugName">
                  ชื่อยา (มีส่วนของข้อความ)
                </label>
                <input
                  id="filterDrugName"
                  type="text"
                  value={filterDrugName}
                  onChange={(e) => {
                    setFilterDrugName(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="ค้นหาชื่อยา"
                />
              </div>
              </>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-700" id="filterPttype-label">
                  สิทธิการรักษา
                </span>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterPttype((prev) => {
                        const next = new Set(prev);
                        for (const o of pttypeOptionsFiltered) next.add(o);
                        return Array.from(next);
                      });
                      setPage(1);
                    }}
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-700 hover:bg-slate-100"
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const visible = new Set(pttypeOptionsFiltered);
                      setFilterPttype((prev) => prev.filter((item) => !visible.has(item)));
                      setPage(1);
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-50"
                  >
                    ไม่เลือกทั้งหมด
                  </button>
                </div>
                <input
                  type="search"
                  value={filterPttypeListQuery}
                  onChange={(e) => setFilterPttypeListQuery(e.target.value)}
                  placeholder="ค้นหาในรายการ..."
                  aria-labelledby="filterPttype-label"
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <div
                  className="max-h-24 overflow-y-auto rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                  role="group"
                  aria-labelledby="filterPttype-label"
                >
                  <div className="space-y-1">
                    {pttypeOptions.length === 0 ? (
                      <p className="text-[10px] text-slate-400">ไม่มีชื่อสิทธิในชุดข้อมูลนี้</p>
                    ) : pttypeOptionsFiltered.length === 0 ? (
                      <p className="text-[10px] text-slate-400">ไม่พบรายการที่ตรงกับการค้นหา</p>
                    ) : (
                      pttypeOptionsFiltered.map((opt) => (
                        <label
                          key={opt}
                          className="inline-flex w-full cursor-pointer items-center gap-2 text-[11px] text-slate-700"
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
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="truncate">{opt}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">เลือกได้หลายรายการ</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700" htmlFor="filterClinic">
                  คลินิก
                </label>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterClinic((prev) => {
                        const next = new Set(prev);
                        for (const o of clinicOptionsFiltered) next.add(o);
                        return Array.from(next);
                      });
                      setPage(1);
                    }}
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-700 hover:bg-slate-100"
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const visible = new Set(clinicOptionsFiltered);
                      setFilterClinic((prev) => prev.filter((item) => !visible.has(item)));
                      setPage(1);
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-50"
                  >
                    ไม่เลือกทั้งหมด
                  </button>
                </div>
                <input
                  type="search"
                  value={filterClinicListQuery}
                  onChange={(e) => setFilterClinicListQuery(e.target.value)}
                  placeholder="ค้นหาในรายการ..."
                  aria-label="ค้นหาคลินิกในรายการ"
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-300 bg-white px-2 py-1.5">
                  <div className="space-y-1">
                    {clinicOptions.length === 0 ? (
                      <p className="text-[10px] text-slate-400">ไม่มีคลินิกในชุดข้อมูลนี้</p>
                    ) : clinicOptionsFiltered.length === 0 ? (
                      <p className="text-[10px] text-slate-400">ไม่พบรายการที่ตรงกับการค้นหา</p>
                    ) : (
                      clinicOptionsFiltered.map((opt) => (
                        <label
                          key={opt}
                          className="inline-flex w-full cursor-pointer items-center gap-2 text-[11px] text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={filterClinic.includes(opt)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilterClinic((prev) => [...prev, opt]);
                              } else {
                                setFilterClinic((prev) => prev.filter((item) => item !== opt));
                              }
                              setPage(1);
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="truncate">{opt}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">เลือกได้หลายรายการ</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700" htmlFor="filterMedtype">
                  ประเภทยา
                </label>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMedtype((prev) => {
                        const next = new Set(prev);
                        for (const o of medtypeOptionsFiltered) next.add(o);
                        return Array.from(next);
                      });
                      setPage(1);
                    }}
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-700 hover:bg-slate-100"
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const visible = new Set(medtypeOptionsFiltered);
                      setFilterMedtype((prev) => prev.filter((item) => !visible.has(item)));
                      setPage(1);
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-50"
                  >
                    ไม่เลือกทั้งหมด
                  </button>
                </div>
                <input
                  type="search"
                  value={filterMedtypeListQuery}
                  onChange={(e) => setFilterMedtypeListQuery(e.target.value)}
                  placeholder="ค้นหาในรายการ..."
                  aria-label="ค้นหาประเภทยาในรายการ"
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-300 bg-white px-2 py-1.5">
                  <div className="space-y-1">
                    {medtypeOptionsForUi.length === 0 ? (
                      <p className="text-[10px] text-slate-400">ไม่มีประเภทยาในชุดข้อมูลนี้</p>
                    ) : medtypeOptionsFiltered.length === 0 ? (
                      <p className="text-[10px] text-slate-400">ไม่พบรายการที่ตรงกับการค้นหา</p>
                    ) : (
                      medtypeOptionsFiltered.map((opt) => (
                        <label
                          key={opt}
                          className="inline-flex w-full cursor-pointer items-center gap-2 text-[11px] text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={filterMedtype.includes(opt)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilterMedtype((prev) => [...prev, opt]);
                              } else {
                                setFilterMedtype((prev) => prev.filter((item) => item !== opt));
                              }
                              setPage(1);
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="truncate">{opt}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">เลือกได้หลายรายการ</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700">
                  บัญชียาหลัก
                </label>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterAccnation((prev) => {
                        const next = new Set(prev);
                        for (const o of accnationOptionsFiltered) next.add(o);
                        return Array.from(next);
                      });
                      setPage(1);
                    }}
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-700 hover:bg-slate-100"
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const visible = new Set(accnationOptionsFiltered);
                      setFilterAccnation((prev) => prev.filter((item) => !visible.has(item)));
                      setPage(1);
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-50"
                  >
                    ไม่เลือกทั้งหมด
                  </button>
                </div>
                <input
                  type="search"
                  value={filterAccnationListQuery}
                  onChange={(e) => setFilterAccnationListQuery(e.target.value)}
                  placeholder="ค้นหาในรายการ..."
                  aria-label="ค้นหาบัญชียาหลักในรายการ"
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-300 bg-white px-2 py-1.5">
                  <div className="space-y-1">
                    {accnationOptionsForUi.length === 0 ? (
                      <p className="text-[10px] text-slate-400">ไม่มีบัญชียาหลักในชุดข้อมูลนี้</p>
                    ) : accnationOptionsFiltered.length === 0 ? (
                      <p className="text-[10px] text-slate-400">ไม่พบรายการที่ตรงกับการค้นหา</p>
                    ) : (
                      accnationOptionsFiltered.map((opt) => (
                        <label
                          key={opt}
                          className="inline-flex w-full cursor-pointer items-center gap-2 text-[11px] text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={filterAccnation.includes(opt)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilterAccnation((prev) => [...prev, opt]);
                              } else {
                                setFilterAccnation((prev) => prev.filter((item) => item !== opt));
                              }
                              setPage(1);
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="truncate">{opt}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">เลือกได้หลายรายการ</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={filterNegativeProfitOnly}
                    onChange={(e) => {
                      setFilterNegativeProfitOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  แสดงเฉพาะรายการที่กำไรรวมติดลบ
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={excludeZeroSale}
                    onChange={(e) => {
                      setExcludeZeroSale(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  ไม่แสดงเฉพาะรายการที่มูลค่าขายรวม = 0
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={excludeNegativeProfit}
                    onChange={(e) => {
                      setExcludeNegativeProfit(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  ไม่แสดงเฉพาะรายการที่กำไรรวมติดลบ
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={filterZeroSaleOnly}
                    onChange={(e) => {
                      setFilterZeroSaleOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  แสดงเฉพาะรายการที่มูลค่าขายรวม = 0
                </label>
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                ล้างฟิลเตอร์
              </button>
            </div>
            {activeTab === "detail" && (filterHn ||
              filterClinic.length > 0 ||
              filterPttype.length > 0 ||
              filterMeditem ||
              filterDrugName ||
              filterMedtype.length > 0 ||
              filterAccnation.length > 0 ||
              filterZeroSaleOnly ||
              filterNegativeProfitOnly ||
              excludeZeroSale ||
              excludeNegativeProfit) && (
              <p className="mt-2 text-[11px] text-slate-500">
                แสดง {filteredRows.length.toLocaleString("th-TH")} จาก {rows.length.toLocaleString("th-TH")}{" "}
                รายการ 
              </p>
            )}
            {activeTab === "period" &&
              (filterZeroSaleOnly ||
                filterNegativeProfitOnly ||
                excludeZeroSale ||
                excludeNegativeProfit) && (
              <p className="mt-2 text-[11px] text-slate-500">
                แสดง {filteredPeriodRows.length.toLocaleString("th-TH")} จาก{" "}
                {periodRows.length.toLocaleString("th-TH")} ช่วงเวลา
              </p>
            )}
          </section>
        )}

        {/* error */}
        {error && (
          <section className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs md:text-sm text-red-800">
            {error}
          </section>
        )}

        {/* SUMMARY CARDS */}
        {activeTab === "detail" && rows.length > 0 && (
          <section className="mb-4 grid gap-3 md:grid-cols-6">
            <div className="rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-teal-50/70 px-3 py-3 shadow-sm ring-1 ring-emerald-100/60">
              <p className="text-[11px] font-medium text-emerald-800">จำนวนรายการยา </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-emerald-950">
                {filteredRows.length.toLocaleString("th-TH")} รายการ
              </p>
            </div>
            <div className="rounded-xl border border-cyan-200/90 bg-gradient-to-br from-cyan-50 to-sky-50/70 px-3 py-3 shadow-sm ring-1 ring-cyan-100/60">
              <p className="text-[11px] font-medium text-cyan-800">จำนวน HN ไม่ซ้ำ </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-cyan-950">
                {uniqueHnCount.toLocaleString("th-TH")} HN
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50 to-violet-50/70 px-3 py-3 shadow-sm ring-1 ring-indigo-100/60">
              <p className="text-[11px] font-medium text-indigo-800">จำนวน Visit ที่มีการจ่ายยา</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-indigo-950">
                {uniqueVisitCount.toLocaleString("th-TH")} visit
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/60 px-3 py-3 shadow-sm ring-1 ring-amber-100/50">
              <p className="text-[11px] font-medium text-amber-900/90">
                ต้นทุนรวม (ยอดจากคอลัมน์ต้นทุนรวม)
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-amber-950">
                {totals.cost.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                บาท
              </p>
            </div>
            <div className="rounded-xl border border-sky-200/90 bg-gradient-to-br from-sky-50 to-blue-50/50 px-3 py-3 shadow-sm ring-1 ring-sky-100/60">
              <p className="text-[11px] font-medium text-sky-900/90">มูลค่าขายรวม</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-sky-950">
                {totals.sale.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                บาท
              </p>
            </div>
            <div
              className={
                totals.profit >= 0
                  ? "rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-green-50/80 to-teal-50/50 px-3 py-3 shadow-sm ring-1 ring-emerald-100/50"
                  : "rounded-xl border border-rose-200/90 bg-gradient-to-br from-rose-50 via-red-50/70 to-orange-50/40 px-3 py-3 shadow-sm ring-1 ring-rose-100/50"
              }
            >
              <p
                className={
                  totals.profit >= 0 ? "text-[11px] font-medium text-emerald-900/90" : "text-[11px] font-medium text-rose-900/90"
                }
              >
                กำไรรวม (sale - cost)
              </p>
              <p
                className={
                  totals.profit >= 0
                    ? "mt-1 text-sm font-semibold tabular-nums text-emerald-950"
                    : "mt-1 text-sm font-semibold tabular-nums text-rose-950"
                }
              >
                {totals.profit.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                บาท
              </p>
            </div>
          </section>
        )}

        {activeTab === "period" && periodRows.length > 0 && (
          <section className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-teal-50/70 px-3 py-3 shadow-sm ring-1 ring-emerald-100/60">
              <p className="text-[11px] font-medium text-emerald-800">จำนวนช่วงเวลา</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-emerald-950">
                {filteredPeriodRows.length.toLocaleString("th-TH")} ช่วง
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/60 px-3 py-3 shadow-sm ring-1 ring-amber-100/50">
              <p className="text-[11px] font-medium text-amber-900/90">ต้นทุนรวม</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-amber-950">
                {periodTotalsFiltered.cost.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                บาท
              </p>
            </div>
            <div className="rounded-xl border border-sky-200/90 bg-gradient-to-br from-sky-50 to-blue-50/50 px-3 py-3 shadow-sm ring-1 ring-sky-100/60">
              <p className="text-[11px] font-medium text-sky-900/90">มูลค่าขายรวม</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-sky-950">
                {periodTotalsFiltered.sale.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                บาท
              </p>
            </div>
            <div
              className={
                periodTotalsFiltered.profit >= 0
                  ? "rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-green-50/80 to-teal-50/50 px-3 py-3 shadow-sm ring-1 ring-emerald-100/50"
                  : "rounded-xl border border-rose-200/90 bg-gradient-to-br from-rose-50 via-red-50/70 to-orange-50/40 px-3 py-3 shadow-sm ring-1 ring-rose-100/50"
              }
            >
              <p
                className={
                  periodTotalsFiltered.profit >= 0
                    ? "text-[11px] font-medium text-emerald-900/90"
                    : "text-[11px] font-medium text-rose-900/90"
                }
              >
                กำไรรวม (sale - cost)
              </p>
              <p
                className={
                  periodTotalsFiltered.profit >= 0
                    ? "mt-1 text-sm font-semibold tabular-nums text-emerald-950"
                    : "mt-1 text-sm font-semibold tabular-nums text-rose-950"
                }
              >
                {periodTotalsFiltered.profit.toLocaleString("th-TH", {
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
              {activeTab === "detail" && rows.length > 0
                ? `(${filteredRows.length} แถว, หน้า ${currentPage}/${totalPages})`
                : activeTab === "period" && periodRows.length > 0
                  ? `(${filteredPeriodRows.length} ช่วงเวลา)`
                  : ""}
            </h2>
            {activeTab === "detail" && rows.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <p>
                  ช่วงวันที่{" "}
                  {isoToThaiDisplay(dateFrom)} – {isoToThaiDisplay(dateTo)}
                </p>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={exporting || sortedRows.length === 0}
                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? "กำลัง Export..." : "Export Excel"}
                </button>
                <div className="flex items-center gap-1">
                  <span>แสดงต่อหน้า:</span>
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      const newSize = Number(event.target.value) || 20;
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={500}>500</option>
                  </select>
                </div>
              </div>
            )}
            {activeTab === "period" && periodRows.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <p>
                  ช่วงวันที่{" "}
                  {isoToThaiDisplay(dateFrom)} – {isoToThaiDisplay(dateTo)}
                </p>
                <button
                  type="button"
                  onClick={handleExportPeriodExcel}
                  disabled={exporting || filteredPeriodRows.length === 0}
                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? "กำลัง Export..." : "Export Excel"}
                </button>
              </div>
            )}
          </div>

          {activeTab === "detail" && rows.length === 0 && !loading && !error && (
            <p className="text-xs md:text-sm text-slate-500">
              ยังไม่มีข้อมูลแสดง กรุณาเลือกช่วงวันที่ แล้วกด &quot;ค้นหาข้อมูล&quot;
            </p>
          )}

          {activeTab === "period" && periodRows.length === 0 && !loading && !error && (
            <p className="text-xs md:text-sm text-slate-500">
              ยังไม่มีข้อมูลสรุปแสดง กรุณาเลือกช่วงวันที่/รูปแบบ (รายเดือนหรือรายปี) แล้วกดค้นหา
            </p>
          )}

          {activeTab === "period" && periodRows.length > 0 && filteredPeriodRows.length === 0 && !loading && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs md:text-sm text-amber-900">
              ไม่มีช่วงเวลาที่ตรงกับฟิลเตอร์ กรุณาปรับเงื่อนไขหรือกด &quot;ล้างฟิลเตอร์&quot;
            </p>
          )}

          {rows.length > 0 && filteredRows.length === 0 && !loading && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs md:text-sm text-amber-900">
              ไม่มีรายการที่ตรงกับฟิลเตอร์ กรุณาปรับเงื่อนไขหรือกด &quot;ล้างฟิลเตอร์&quot;
            </p>
          )}

          {activeTab === "detail" && filteredRows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full border-collapse text-xs md:text-sm text-left">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">NO.</th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("HN")} className="hover:text-emerald-700">
                        HN {sortMark("HN")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("PTTYPE")} className="hover:text-emerald-700">
                        สิทธิการรักษา {sortMark("PTTYPE")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("CLINIC")} className="hover:text-emerald-700">
                        คลินิก {sortMark("CLINIC")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("MEDITEM")} className="hover:text-emerald-700">
                        รหัสยา {sortMark("MEDITEM")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("DRUG_NAME")} className="hover:text-emerald-700">
                        ชื่อยา {sortMark("DRUG_NAME")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("MEDTYPE")} className="hover:text-emerald-700">
                        ประเภทยา {sortMark("MEDTYPE")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort("ACCNATION")} className="hover:text-emerald-700">
                        บัญชียาหลัก {sortMark("ACCNATION")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("TOTAL_QTY")}
                        className="hover:text-emerald-700"
                      >
                        จำนวนรวม {sortMark("TOTAL_QTY")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("TOTAL_COST")}
                        className="hover:text-emerald-700"
                      >
                        ต้นทุนรวม {sortMark("TOTAL_COST")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("TOTAL_SALE")}
                        className="hover:text-emerald-700"
                      >
                        มูลค่าขายรวม {sortMark("TOTAL_SALE")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("TOTAL_PROFIT")}
                        className="hover:text-emerald-700"
                      >
                        กำไรรวม {sortMark("TOTAL_PROFIT")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, index) => (
                    <tr
                      key={`${row.HN}-${row.MEDITEM}-${String(row.PTTYPE_NAME ?? "")}-${startIndex + index}`}
                      className={`border-b border-slate-100 hover:bg-slate-50 ${
                        Number(row.TOTAL_PROFIT ?? 0) < 0 ? "text-emerald-700" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-right">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {formatHnDisplay(row.HN)}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[14rem] truncate" title={row.PTTYPE_NAME ?? undefined}>
                        {row.PTTYPE_NAME ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.CLINIC_LCT_NAME ?? row.CLINIC_LCT ?? "—"}
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

          {filteredRows.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
              <div>
                แสดงแถวที่ {sortedRows.length === 0 ? 0 : startIndex + 1} -{" "}
                {Math.min(endIndex, sortedRows.length)} จากทั้งหมด {sortedRows.length} แถว
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

          {activeTab === "period" && filteredPeriodRows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full border-collapse text-xs md:text-sm text-left">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">NO.</th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                      {periodGroupBy === "month" ? "เดือน ปี " : "ปี (พ.ศ.)"}
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap text-right">
                      จำนวนรวม ({Number(periodUniqueItemCount ?? 0).toLocaleString("th-TH")} รายการยา)
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
                  {filteredPeriodRows.map((row, index) => (
                    <tr key={row.PERIOD_KEY} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-right">{index + 1}</td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {formatPeriodLabelThai(String(row.PERIOD_KEY ?? row.PERIOD_LABEL ?? ""), periodGroupBy)}
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
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                    <td className="px-3 py-2 text-slate-800 whitespace-nowrap text-right" colSpan={2}>
                      รวมทั้งหมด
                    </td>
                    <td className="px-3 py-2 text-slate-800 whitespace-nowrap text-right">
                      {Number(periodTotalsFiltered.qty ?? 0).toLocaleString("th-TH")}
                    </td>
                    <td className="px-3 py-2 text-slate-800 whitespace-nowrap text-right">
                      {Number(periodTotalsFiltered.cost ?? 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-slate-800 whitespace-nowrap text-right">
                      {Number(periodTotalsFiltered.sale ?? 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-slate-800 whitespace-nowrap text-right">
                      {Number(periodTotalsFiltered.profit ?? 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="mt-4 text-[11px] md:text-xs text-slate-500">
          <p>
            เวอร์ชันระบบต้นแบบ: {siteConfig.version} — API:{" "}
            <code>{activeTab === "period" ? "/api/db/drug-cost-summary-period" : "/api/db/drug-cost-summary"}</code>
          </p>
        </section>
      </main>
    </div>
  );
}

