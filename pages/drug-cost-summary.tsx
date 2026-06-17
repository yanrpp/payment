"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MonthPicker } from "@/components/MonthPicker";
import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import {
  formatMonthsIsoThaiDisplay,
  isoToThaiDisplay,
  isValidMonthIso,
  localCurrentMonthIso,
  localTodayIso,
  monthsIsoToDateRange,
  sortMonthIsos,
} from "@/lib/date/thaiDate";
import { formatHnDisplay, matchesHnFilter } from "@/lib/hn/normalize";
import { filterStringOptions, normalizeFieldForFilter } from "@/lib/filter/options";
import { siteConfig } from "@/config/site";

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
  AN?: string | number | null;
  WARD_NAME?: string | null;
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
type VisitType = "opd" | "ipd";
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

function normalizeFilterOptionList(values: unknown[]): string[] {
  const set = new Set<string>();

  for (const value of values) {
    const text = String(value ?? "").trim();

    if (text) set.add(text);
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
}

function parseFilterOptionsData(data: unknown): DrugCostFilterOptions {
  const source = data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  return {
    pttype: normalizeFilterOptionList(Array.isArray(source.pttype) ? source.pttype : []),
    clinic: normalizeFilterOptionList(Array.isArray(source.clinic) ? source.clinic : []),
    medtype: normalizeFilterOptionList(Array.isArray(source.medtype) ? source.medtype : []),
    accnation: normalizeFilterOptionList(Array.isArray(source.accnation) ? source.accnation : []),
  };
}

function extractFilterOptionsFromRows(rows: DrugCostSummaryRow[]): DrugCostFilterOptions {
  const pttype = new Set<string>();
  const clinic = new Set<string>();
  const medtype = new Set<string>();
  const accnation = new Set<string>();

  for (const row of rows) {
    const pttypeName = String(row.PTTYPE_NAME ?? "").trim();

    if (pttypeName) pttype.add(pttypeName);

    const clinicName = String(row.CLINIC_LCT_NAME ?? row.CLINIC_LCT ?? "").trim();

    if (clinicName) clinic.add(clinicName);

    const medtypeName = String(row.MEDTYPE ?? "").trim();

    if (medtypeName) medtype.add(medtypeName);

    const accnationName = String(row.ACCNATION ?? "").trim();

    if (accnationName) accnation.add(accnationName);
  }

  return {
    pttype: Array.from(pttype).sort((a, b) => a.localeCompare(b, "th")),
    clinic: Array.from(clinic).sort((a, b) => a.localeCompare(b, "th")),
    medtype: Array.from(medtype).sort((a, b) => a.localeCompare(b, "th")),
    accnation: Array.from(accnation).sort((a, b) => a.localeCompare(b, "th")),
  };
}

function resolveUiFilterOptions(
  apiOptions: DrugCostFilterOptions,
  rows: DrugCostSummaryRow[],
  tab: SummaryTab
): DrugCostFilterOptions {
  const fromRows = extractFilterOptionsFromRows(rows);

  if (tab === "period") return apiOptions;

  return {
    pttype: apiOptions.pttype.length > 0 ? apiOptions.pttype : fromRows.pttype,
    clinic: fromRows.clinic,
    medtype: fromRows.medtype,
    accnation: fromRows.accnation,
  };
}

function isAllOptionsSelected(selected: string[], allOptions: string[]): boolean {
  if (allOptions.length === 0) return true;
  const selectedSet = new Set(selected);

  return allOptions.every((option) => selectedSet.has(option));
}

function isMultiSelectCleared(selected: string[], allOptions: string[]): boolean {
  return allOptions.length > 0 && selected.length === 0;
}

function hasClearedMultiSelectFilters(
  filters: Array<{ selected: string[]; options: string[] }>
): boolean {
  return filters.some(({ selected, options }) => isMultiSelectCleared(selected, options));
}

function shouldApplyMultiSelectFilter(selected: string[], allOptions: string[]): boolean {
  if (allOptions.length === 0) return false;
  if (isAllOptionsSelected(selected, allOptions)) return false;

  return selected.length > 0;
}

function matchesMultiSelectFilter(
  rawValue: unknown,
  selected: string[],
  allOptions: string[],
  normalizeValue: (value: string) => string = (value) => value
): boolean {
  if (allOptions.length === 0) return true;
  if (isAllOptionsSelected(selected, allOptions)) return true;
  if (selected.length === 0) return false;
  const value = normalizeValue(String(rawValue ?? "").trim());

  return selected.some((item) => normalizeValue(item) === value);
}

type SortKey =
  | "HN"
  | "AN"
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
  const [dateFrom, setDateFrom] = useState<string>(() => localTodayIso());
  const [dateTo, setDateTo] = useState<string>(() => localTodayIso());
  const [periodMonths, setPeriodMonths] = useState<string[]>(() => [localCurrentMonthIso()]);

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
  const [visitType, setVisitType] = useState<VisitType>("opd");
  const [periodHasFetched, setPeriodHasFetched] = useState(false);
  const skipNextPeriodAutoRefreshRef = useRef(false);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [sortKey, setSortKey] = useState<SortKey>("MEDITEM");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  /** ฟิลเตอร์หลังโหลดข้อมูล (กรองฝั่ง client) */
  const [filterMeditem, setFilterMeditem] = useState("");
  const [filterHn, setFilterHn] = useState("");
  const [filterAn, setFilterAn] = useState("");
  const [filterClinic, setFilterClinic] = useState<string[]>([]);
  const [filterPttype, setFilterPttype] = useState<string[]>([]);
  const [filterDrugName, setFilterDrugName] = useState("");
  const [filterMedtype, setFilterMedtype] = useState<string[]>([]);
  const [filterAccnation, setFilterAccnation] = useState<string[]>([]);
  const [filterZeroSaleOnly, setFilterZeroSaleOnly] = useState(false);
  const [filterNegativeProfitOnly, setFilterNegativeProfitOnly] = useState(false);
  const [excludeZeroSale, setExcludeZeroSale] = useState(false);
  const [excludeNegativeProfit, setExcludeNegativeProfit] = useState(false);

  const includeOpd = visitType === "opd";
  const includeIpd = visitType === "ipd";
  const showAnColumn = visitType === "ipd";

  const [filterPttypeListQuery, setFilterPttypeListQuery] = useState("");
  const [filterClinicListQuery, setFilterClinicListQuery] = useState("");
  const [filterMedtypeListQuery, setFilterMedtypeListQuery] = useState("");
  const [filterAccnationListQuery, setFilterAccnationListQuery] = useState("");

  type ApiEnvelope<TData = unknown> = {
    success?: boolean;
    message?: string;
    count?: number;
    uniqueItemCount?: number;
    uniqueVisitCount?: number;
    groupBy?: string;
    data?: TData;
  };

  const parseJsonSafe = async <T extends object = ApiEnvelope>(res: Response): Promise<T> => {
    const text = await res.text();

    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return {} as T;
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await performSearch();
  };

  const performSearch = async () => {
    setDateError(null);

    const searchRange =
      activeTab === "period" ? monthsIsoToDateRange(periodMonths) : { d1: dateFrom, d2: dateTo };
    const { d1: searchD1, d2: searchD2 } = searchRange;

    if (activeTab === "period") {
      if (periodMonths.length === 0) {
        setDateError("กรุณาเลือกอย่างน้อย 1 เดือน");

        return;
      }
      if (periodMonths.some((monthIso) => !isValidMonthIso(monthIso))) {
        setDateError("กรุณาเลือกเดือนที่ถูกต้อง");

        return;
      }
      if (periodMonths.length > 12) {
        setDateError("เลือกได้ไม่เกิน 12 เดือน");

        return;
      }
    } else {
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

      const diffMs = to.getTime() - from.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays > 31) {
        setDateError("แท็บรายคนกำหนดช่วงวันที่ได้ไม่เกิน 1 เดือน");

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

    query.set("d1", searchD1);
    query.set("d2", searchD2);
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
            `/api/db/drug-cost-summary-filter-options?d1=${encodeURIComponent(searchD1)}&d2=${encodeURIComponent(searchD2)}&opd=${includeOpd ? "1" : "0"}&ipd=${includeIpd ? "1" : "0"}`,
            { cache: "no-store" }
          ),
        ]);
        const [jsonSummary, jsonOptions] = await Promise.all([
          parseJsonSafe<ApiEnvelope<DrugCostSummaryPeriodRow[]>>(resSummary),
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
          Number.isFinite(Number(jsonSummary.uniqueItemCount))
            ? Number(jsonSummary.uniqueItemCount)
            : 0
        );
        const filterOptions = parseFilterOptionsData(jsonOptions.data);

        setPeriodFilterOptions(filterOptions);
        setFilterPttype([...filterOptions.pttype]);
        setFilterClinic([...filterOptions.clinic]);
        setFilterMedtype([...filterOptions.medtype]);
        setFilterAccnation([...filterOptions.accnation]);
        skipNextPeriodAutoRefreshRef.current = true;
        setPeriodHasFetched(true);
      } else {
        const [resDetail, resOptions] = await Promise.all([
          fetch(`/api/db/drug-cost-summary?${query.toString()}`, { cache: "no-store" }),
          fetch(
            `/api/db/drug-cost-summary-filter-options?d1=${encodeURIComponent(searchD1)}&d2=${encodeURIComponent(searchD2)}&opd=${includeOpd ? "1" : "0"}&ipd=${includeIpd ? "1" : "0"}`,
            { cache: "no-store" }
          ),
        ]);
        const [jsonDetail, jsonOptions] = await Promise.all([
          parseJsonSafe<ApiEnvelope<DrugCostSummaryRow[]>>(resDetail),
          parseJsonSafe(resOptions),
        ]);

        if (!resDetail.ok || !jsonDetail.success) {
          setError(jsonDetail.message ?? "ค้นหาข้อมูลไม่สำเร็จ");

          return;
        }
        const detailRows = Array.isArray(jsonDetail.data) ? jsonDetail.data : [];
        const apiFilterOptions =
          resOptions.ok && jsonOptions.success
            ? parseFilterOptionsData(jsonOptions.data)
            : { pttype: [], clinic: [], medtype: [], accnation: [] };
        const uiFilterOptions = resolveUiFilterOptions(apiFilterOptions, detailRows, "detail");

        setPeriodFilterOptions(apiFilterOptions);
        setRows(detailRows);
        setFilterPttype([...uiFilterOptions.pttype]);
        setFilterClinic([...uiFilterOptions.clinic]);
        setFilterMedtype([...uiFilterOptions.medtype]);
        setFilterAccnation([...uiFilterOptions.accnation]);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void performSearch();
  }, [activeTab, visitType]);

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
        const json = await parseJsonSafe<ApiEnvelope<DrugCostSummaryPeriodRow[]>>(res);

        if (!res.ok || !json.success) {
          setError(json.message ?? "ค้นหาข้อมูลไม่สำเร็จ");

          return;
        }
        setPeriodRows(Array.isArray(json.data) ? json.data : []);
        setPeriodUniqueItemCount(
          Number.isFinite(Number(json.uniqueItemCount)) ? Number(json.uniqueItemCount) : 0
        );
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
    visitType,
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

  const buildPeriodPayload = () => {
    const { d1, d2 } = monthsIsoToDateRange(periodMonths);
    const payload: Record<string, unknown> = {
      d1,
      d2,
      groupBy: "month",
      opd: includeOpd,
      ipd: includeIpd,
    };

    if (shouldApplyMultiSelectFilter(filterPttype, pttypeOptions)) {
      payload.pttype = filterPttype;
    }
    if (shouldApplyMultiSelectFilter(filterClinic, clinicOptions)) {
      payload.clinic = filterClinic;
    }
    if (shouldApplyMultiSelectFilter(filterMedtype, medtypeOptionsForUi)) {
      payload.medtype = filterMedtype;
    }
    if (shouldApplyMultiSelectFilter(filterAccnation, accnationOptionsForUi)) {
      payload.accnation = filterAccnation;
    }

    return payload;
  };

  const filteredRows = useMemo(() => {
    const h = filterHn.trim();
    const an = filterAn.trim().toLowerCase();
    const m = filterMeditem.trim().toLowerCase();
    const d = filterDrugName.trim().toLowerCase();

    return rows.filter((r) => {
      if (!matchesHnFilter(r.HN, h)) {
        return false;
      }
      if (an) {
        const rawAn = String(r.AN ?? "").toLowerCase();
        const dispAn = formatHnDisplay(r.AN).toLowerCase();

        if (!rawAn.includes(an) && !dispAn.includes(an)) {
          return false;
        }
      }
      if (
        !matchesMultiSelectFilter(
          r.CLINIC_LCT_NAME ?? r.CLINIC_LCT ?? "",
          filterClinic,
          clinicOptions,
          normalizeFieldForFilter
        )
      ) {
        return false;
      }
      if (!matchesMultiSelectFilter(r.PTTYPE_NAME, filterPttype, pttypeOptions, (value) => value)) {
        return false;
      }
      if (m && !normalizeFieldForFilter(r.MEDITEM).includes(m)) {
        return false;
      }
      if (d && !normalizeFieldForFilter(r.DRUG_NAME).includes(d)) {
        return false;
      }
      if (
        !matchesMultiSelectFilter(r.MEDTYPE, filterMedtype, medtypeOptionsForUi, (value) => value)
      ) {
        return false;
      }
      if (
        !matchesMultiSelectFilter(
          r.ACCNATION,
          filterAccnation,
          accnationOptionsForUi,
          (value) => value
        )
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
    filterAn,
    filterClinic,
    filterPttype,
    filterMeditem,
    filterDrugName,
    filterMedtype,
    filterAccnation,
    clinicOptions,
    pttypeOptions,
    medtypeOptionsForUi,
    accnationOptionsForUi,
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
        case "AN":
          compareValue = getText(a.AN).localeCompare(getText(b.AN), "th");
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

  // IPD: นับจำนวน AN (Admission) ไม่ซ้ำ แทนการนับ HN
  const uniqueAnCount = useMemo(() => {
    const anSet = new Set<string>();

    for (const row of filteredRows) {
      const an = String(row.AN ?? "").trim();

      if (an !== "") anSet.add(an);
    }

    return anSet.size;
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
    if (
      hasClearedMultiSelectFilters([
        { selected: filterPttype, options: pttypeOptions },
        { selected: filterClinic, options: clinicOptions },
        { selected: filterMedtype, options: medtypeOptionsForUi },
        { selected: filterAccnation, options: accnationOptionsForUi },
      ])
    ) {
      return [];
    }

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
    filterPttype,
    filterClinic,
    filterMedtype,
    filterAccnation,
    pttypeOptions,
    clinicOptions,
    medtypeOptionsForUi,
    accnationOptionsForUi,
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
    setFilterAn("");
    setFilterPttype([...pttypeOptions]);
    setFilterClinic([...clinicOptions]);
    setFilterMeditem("");
    setFilterDrugName("");
    setFilterMedtype([...medtypeOptionsForUi]);
    setFilterAccnation([...accnationOptionsForUi]);
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
        ...(showAnColumn ? ["AN"] : []),
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
        ...(showAnColumn ? [formatHnDisplay(row.AN) || ""] : []),
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
        ...(showAnColumn ? [""] : []),
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
        { wch: 6 },
        { wch: 14 },
        ...(showAnColumn ? [{ wch: 14 }] : []),
        { wch: 22 },
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
      const qtyCol = showAnColumn ? 9 : 8;
      const costCol = qtyCol + 1;
      const saleCol = qtyCol + 2;
      const profitCol = qtyCol + 3;

      for (let r = 1; r <= range.e.r; r++) {
        const qtyCell = XLSX.utils.encode_cell({ r, c: qtyCol });
        const costCell = XLSX.utils.encode_cell({ r, c: costCol });
        const saleCell = XLSX.utils.encode_cell({ r, c: saleCol });
        const profitCell = XLSX.utils.encode_cell({ r, c: profitCol });

        if (worksheet[qtyCell]) worksheet[qtyCell].z = "#,##0";
        if (worksheet[costCell]) worksheet[costCell].z = "#,##0.00";
        if (worksheet[saleCell]) worksheet[saleCell].z = "#,##0.00";
        if (worksheet[profitCell]) worksheet[profitCell].z = "#,##0.00";
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, "DrugCostSummary");

      const fileDate = `${dateFrom}_to_${dateTo}`;

      XLSX.writeFile(workbook, `drug-cost-summary_${visitType}_${fileDate}.xlsx`);
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
      const header = ["NO", "เดือน ปี ", "จำนวนรวม", "ต้นทุนรวม", "มูลค่าขายรวม", "กำไรรวม"];

      const dataRows = filteredPeriodRows.map((row, index) => [
        index + 1,
        formatPeriodLabelThai(String(row.PERIOD_KEY ?? row.PERIOD_LABEL ?? ""), "month"),
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

      worksheet["!cols"] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
      ];

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
      XLSX.writeFile(
        workbook,
        `drug-cost-summary-period_${visitType}_${sortMonthIsos(periodMonths).join("_")}.xlsx`
      );
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "ไม่สามารถ export Excel ได้");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="border-b border-flow-border bg-white">
        <div className="w-full px-4 md:px-6 py-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-flow-text">
              สรุปต้นทุนและกำไรจากยา (ตามรายการยา)
            </h1>
            <p className="text-xs md:text-sm text-flow-muted mt-1">
              ข้อมูลจาก PRSC / PRSCDT / MEDITEM — สิทธิการรักษาจาก PRSC.PTTYPE → PTTYPE.NAME —
              รวมตามรหัสยาและช่วงวันที่สั่งยา
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 md:px-6 py-6 md:py-8">
        <section className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-flow-border bg-white p-1 text-xs">
            <button
              className={`rounded-md px-3 py-1.5 font-medium ${
                activeTab === "detail"
                  ? "bg-brand-500 text-white"
                  : "text-flow-text hover:bg-flow-input"
              }`}
              type="button"
              onClick={() => {
                setActiveTab("detail");
                setPeriodRows([]);
                setPeriodUniqueItemCount(0);
                setError(null);
              }}
            >
              รายละเอียดรายคน/รายยา
            </button>
            <button
              className={`rounded-md px-3 py-1.5 font-medium ${
                activeTab === "period"
                  ? "bg-brand-500 text-white"
                  : "text-flow-text hover:bg-flow-input"
              }`}
              type="button"
              onClick={() => {
                setActiveTab("period");
                setRows([]);
                setPeriodRows([]);
                setPeriodHasFetched(false);
                setPeriodUniqueItemCount(0);
                setError(null);
              }}
            >
              สรุปรายเดือน/รายปี
            </button>
          </div>

          {/* สลับประเภทบริการ OPD / IPD (หน้าเดียวรองรับทั้งสองแบบ) */}
          <div className="inline-flex rounded-lg border border-flow-border bg-white p-1 text-xs">
            <button
              className={`rounded-md px-3 py-1.5 font-medium ${
                visitType === "opd"
                  ? "bg-brand-500 text-white"
                  : "text-flow-text hover:bg-flow-input"
              }`}
              type="button"
              onClick={() => {
                if (visitType === "opd") return;
                setVisitType("opd");
                setFilterAn("");
                setRows([]);
                setPeriodRows([]);
                setPeriodUniqueItemCount(0);
                setError(null);
              }}
            >
              OPD
            </button>
            <button
              className={`rounded-md px-3 py-1.5 font-medium ${
                visitType === "ipd"
                  ? "bg-brand-500 text-white"
                  : "text-flow-text hover:bg-flow-input"
              }`}
              type="button"
              onClick={() => {
                if (visitType === "ipd") return;
                setVisitType("ipd");
                setRows([]);
                setPeriodRows([]);
                setPeriodUniqueItemCount(0);
                setError(null);
              }}
            >
              IPD
            </button>
          </div>
        </section>

        {/* ฟอร์มค้นหา */}
        <section className="mb-6">
          <form className="ui-panel-muted space-y-4" onSubmit={handleSearch}>
            <div className="flex flex-wrap items-start gap-4">
              {activeTab === "detail" ? (
                <div className="grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4">
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
                </div>
              ) : (
                <MonthPicker
                  id="periodMonth"
                  label="เลือกเดือน (prscdate) — เลือกได้หลายเดือน"
                  value={periodMonths}
                  onChange={(monthIsos) => {
                    setPeriodMonths(monthIsos);
                    setDateError(null);
                  }}
                />
              )}
              <button
                className="ui-btn-primary mt-6 h-9 text-xs md:text-sm"
                disabled={loading}
                type="submit"
              >
                {loading ? "กำลังค้นหา..." : "ค้นหาข้อมูล"}
              </button>
              <button
                className="ui-btn-secondary mt-6 h-9 text-xs md:text-sm"
                type="button"
                onClick={() => {
                  if (activeTab === "period") {
                    setPeriodMonths([localCurrentMonthIso()]);
                  } else {
                    const today = localTodayIso();

                    setDateFrom(today);
                    setDateTo(today);
                  }
                  setDateError(null);
                }}
              >
                {activeTab === "period" ? "เคลียร์เดือน" : "เคลียร์วันที่"}
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
            <div className="pointer-events-auto inline-flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-3 shadow-[0_12px_40px_rgba(45,156,219,0.18)]">
              <span
                aria-hidden="true"
                className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
              />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-brand-900">กำลังค้นหาข้อมูล</p>
                <p className="text-[11px] text-brand-700">โปรดรอสักครู่...</p>
              </div>
            </div>
          </div>
        )}

        {/* ฟิลเตอร์หลังมีข้อมูล */}
        {(activeTab === "detail" || activeTab === "period") && (
          <section className="ui-panel mb-6">
            <h2 className="mb-3 text-xs font-semibold text-flow-text">กรองผลลัพธ์</h2>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
                <div className="flex h-full flex-col gap-1">
                  <span className="text-[11px] font-medium text-flow-text" id="filterPttype-label">
                    สิทธิการรักษา
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      className="rounded border border-flow-border bg-slate-50 px-2 py-0.5 text-flow-text hover:bg-brand-50"
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
                      เลือกทั้งหมด
                    </button>
                    <button
                      className="rounded border border-flow-border bg-white px-2 py-0.5 text-flow-text hover:bg-flow-input"
                      type="button"
                      onClick={() => {
                        setFilterPttype([]);
                        setPage(1);
                      }}
                    >
                      ไม่เลือกทั้งหมด
                    </button>
                  </div>
                  <input
                    aria-labelledby="filterPttype-label"
                    className="ui-input-sm"
                    placeholder="ค้นหาในรายการ..."
                    type="search"
                    value={filterPttypeListQuery}
                    onChange={(e) => setFilterPttypeListQuery(e.target.value)}
                  />
                  <div
                    aria-labelledby="filterPttype-label"
                    className="h-24 overflow-y-auto rounded-lg border border-flow-border bg-white px-2 py-1.5"
                    role="group"
                  >
                    <div className="space-y-1">
                      {pttypeOptions.length === 0 ? (
                        <p className="text-[10px] text-neutral-400">ไม่มีชื่อสิทธิในชุดข้อมูลนี้</p>
                      ) : pttypeOptionsFiltered.length === 0 ? (
                        <p className="text-[10px] text-neutral-400">ไม่พบรายการที่ตรงกับการค้นหา</p>
                      ) : (
                        pttypeOptionsFiltered.map((opt) => (
                          <label
                            key={opt}
                            className="inline-flex w-full cursor-pointer items-center gap-2 text-[11px] text-flow-text"
                          >
                            <input
                              checked={filterPttype.includes(opt)}
                              className="ui-checkbox"
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterPttype((prev) => [...prev, opt]);
                                } else {
                                  setFilterPttype((prev) => prev.filter((item) => item !== opt));
                                }
                                setPage(1);
                              }}
                            />
                            <span className="truncate">{opt}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-flow-muted">เลือกได้หลายรายการ</p>
                </div>
                <div className="flex h-full flex-col gap-1">
                  <label className="text-[11px] font-medium text-flow-text" htmlFor="filterClinic">
                    คลินิก
                  </label>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      className="rounded border border-flow-border bg-slate-50 px-2 py-0.5 text-flow-text hover:bg-brand-50"
                      type="button"
                      onClick={() => {
                        setFilterClinic((prev) => {
                          const next = new Set(prev);

                          for (const o of clinicOptionsFiltered) next.add(o);

                          return Array.from(next);
                        });
                        setPage(1);
                      }}
                    >
                      เลือกทั้งหมด
                    </button>
                    <button
                      className="rounded border border-flow-border bg-white px-2 py-0.5 text-flow-text hover:bg-flow-input"
                      type="button"
                      onClick={() => {
                        setFilterClinic([]);
                        setPage(1);
                      }}
                    >
                      ไม่เลือกทั้งหมด
                    </button>
                  </div>
                  <input
                    aria-label="ค้นหาคลินิกในรายการ"
                    className="ui-input-sm"
                    placeholder="ค้นหาในรายการ..."
                    type="search"
                    value={filterClinicListQuery}
                    onChange={(e) => setFilterClinicListQuery(e.target.value)}
                  />
                  <div className="h-24 overflow-y-auto rounded-lg border border-flow-border bg-white px-2 py-1.5">
                    <div className="space-y-1">
                      {clinicOptions.length === 0 ? (
                        <p className="text-[10px] text-neutral-400">ไม่มีคลินิกในชุดข้อมูลนี้</p>
                      ) : clinicOptionsFiltered.length === 0 ? (
                        <p className="text-[10px] text-neutral-400">ไม่พบรายการที่ตรงกับการค้นหา</p>
                      ) : (
                        clinicOptionsFiltered.map((opt) => (
                          <label
                            key={opt}
                            className="inline-flex w-full cursor-pointer items-center gap-2 text-[11px] text-flow-text"
                          >
                            <input
                              checked={filterClinic.includes(opt)}
                              className="ui-checkbox"
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterClinic((prev) => [...prev, opt]);
                                } else {
                                  setFilterClinic((prev) => prev.filter((item) => item !== opt));
                                }
                                setPage(1);
                              }}
                            />
                            <span className="truncate">{opt}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-flow-muted">เลือกได้หลายรายการ</p>
                </div>
                <div className="flex h-full flex-col gap-1">
                  <label className="text-[11px] font-medium text-flow-text" htmlFor="filterMedtype">
                    ประเภทยา
                  </label>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      className="rounded border border-flow-border bg-slate-50 px-2 py-0.5 text-flow-text hover:bg-brand-50"
                      type="button"
                      onClick={() => {
                        setFilterMedtype((prev) => {
                          const next = new Set(prev);

                          for (const o of medtypeOptionsFiltered) next.add(o);

                          return Array.from(next);
                        });
                        setPage(1);
                      }}
                    >
                      เลือกทั้งหมด
                    </button>
                    <button
                      className="rounded border border-flow-border bg-white px-2 py-0.5 text-flow-text hover:bg-flow-input"
                      type="button"
                      onClick={() => {
                        setFilterMedtype([]);
                        setPage(1);
                      }}
                    >
                      ไม่เลือกทั้งหมด
                    </button>
                  </div>
                  <input
                    aria-label="ค้นหาประเภทยาในรายการ"
                    className="ui-input-sm"
                    placeholder="ค้นหาในรายการ..."
                    type="search"
                    value={filterMedtypeListQuery}
                    onChange={(e) => setFilterMedtypeListQuery(e.target.value)}
                  />
                  <div className="h-24 overflow-y-auto rounded-lg border border-flow-border bg-white px-2 py-1.5">
                    <div className="space-y-1">
                      {medtypeOptionsForUi.length === 0 ? (
                        <p className="text-[10px] text-neutral-400">ไม่มีประเภทยาในชุดข้อมูลนี้</p>
                      ) : medtypeOptionsFiltered.length === 0 ? (
                        <p className="text-[10px] text-neutral-400">ไม่พบรายการที่ตรงกับการค้นหา</p>
                      ) : (
                        medtypeOptionsFiltered.map((opt) => (
                          <label
                            key={opt}
                            className="inline-flex w-full cursor-pointer items-center gap-2 text-[11px] text-flow-text"
                          >
                            <input
                              checked={filterMedtype.includes(opt)}
                              className="ui-checkbox"
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterMedtype((prev) => [...prev, opt]);
                                } else {
                                  setFilterMedtype((prev) => prev.filter((item) => item !== opt));
                                }
                                setPage(1);
                              }}
                            />
                            <span className="truncate">{opt}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-flow-muted">เลือกได้หลายรายการ</p>
                </div>
                <div className="flex h-full flex-col gap-1">
                  <label className="text-[11px] font-medium text-flow-text">บัญชียาหลัก</label>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      className="rounded border border-flow-border bg-slate-50 px-2 py-0.5 text-flow-text hover:bg-brand-50"
                      type="button"
                      onClick={() => {
                        setFilterAccnation((prev) => {
                          const next = new Set(prev);

                          for (const o of accnationOptionsFiltered) next.add(o);

                          return Array.from(next);
                        });
                        setPage(1);
                      }}
                    >
                      เลือกทั้งหมด
                    </button>
                    <button
                      className="rounded border border-flow-border bg-white px-2 py-0.5 text-flow-text hover:bg-flow-input"
                      type="button"
                      onClick={() => {
                        setFilterAccnation([]);
                        setPage(1);
                      }}
                    >
                      ไม่เลือกทั้งหมด
                    </button>
                  </div>
                  <input
                    aria-label="ค้นหาบัญชียาหลักในรายการ"
                    className="ui-input-sm"
                    placeholder="ค้นหาในรายการ..."
                    type="search"
                    value={filterAccnationListQuery}
                    onChange={(e) => setFilterAccnationListQuery(e.target.value)}
                  />
                  <div className="h-24 overflow-y-auto rounded-lg border border-flow-border bg-white px-2 py-1.5">
                    <div className="space-y-1">
                      {accnationOptionsForUi.length === 0 ? (
                        <p className="text-[10px] text-neutral-400">
                          ไม่มีบัญชียาหลักในชุดข้อมูลนี้
                        </p>
                      ) : accnationOptionsFiltered.length === 0 ? (
                        <p className="text-[10px] text-neutral-400">ไม่พบรายการที่ตรงกับการค้นหา</p>
                      ) : (
                        accnationOptionsFiltered.map((opt) => (
                          <label
                            key={opt}
                            className="inline-flex w-full cursor-pointer items-center gap-2 text-[11px] text-flow-text"
                          >
                            <input
                              checked={filterAccnation.includes(opt)}
                              className="ui-checkbox"
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterAccnation((prev) => [...prev, opt]);
                                } else {
                                  setFilterAccnation((prev) => prev.filter((item) => item !== opt));
                                }
                                setPage(1);
                              }}
                            />
                            <span className="truncate">{opt}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-flow-muted">เลือกได้หลายรายการ</p>
                </div>
              </div>

              {activeTab === "detail" && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-flow-text" htmlFor="filterHn">
                      HN
                    </label>
                    <input
                      className="ui-input text-xs py-1.5 px-2"
                      id="filterHn"
                      placeholder="เช่น 1666/69 หรือ 69001666"
                      type="text"
                      value={filterHn}
                      onChange={(e) => {
                        setFilterHn(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  {visitType === "ipd" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-flow-text" htmlFor="filterAn">
                        AN (มีส่วนของข้อความ)
                      </label>
                      <input
                        className="ui-input text-xs py-1.5 px-2"
                        id="filterAn"
                        placeholder="เช่น 2947/69 หรือ เลข AN"
                        type="text"
                        value={filterAn}
                        onChange={(e) => {
                          setFilterAn(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-[11px] font-medium text-flow-text"
                      htmlFor="filterMeditem"
                    >
                      รหัสยา (มีส่วนของข้อความ)
                    </label>
                    <input
                      className="ui-input text-xs py-1.5 px-2"
                      id="filterMeditem"
                      placeholder="เช่น 5010"
                      type="text"
                      value={filterMeditem}
                      onChange={(e) => {
                        setFilterMeditem(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-[11px] font-medium text-flow-text"
                      htmlFor="filterDrugName"
                    >
                      ชื่อยา (มีส่วนของข้อความ)
                    </label>
                    <input
                      className="ui-input text-xs py-1.5 px-2"
                      id="filterDrugName"
                      placeholder="ค้นหาชื่อยา"
                      type="text"
                      value={filterDrugName}
                      onChange={(e) => {
                        setFilterDrugName(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-flow-text">
                  <input
                    checked={filterNegativeProfitOnly}
                    className="ui-checkbox"
                    type="checkbox"
                    onChange={(e) => {
                      setFilterNegativeProfitOnly(e.target.checked);
                      setPage(1);
                    }}
                  />
                  แสดงเฉพาะรายการที่กำไรรวมติดลบ
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-flow-text">
                  <input
                    checked={excludeZeroSale}
                    className="ui-checkbox"
                    type="checkbox"
                    onChange={(e) => {
                      setExcludeZeroSale(e.target.checked);
                      setPage(1);
                    }}
                  />
                  ไม่แสดงเฉพาะรายการที่มูลค่าขายรวม = 0
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-flow-text">
                  <input
                    checked={excludeNegativeProfit}
                    className="ui-checkbox"
                    type="checkbox"
                    onChange={(e) => {
                      setExcludeNegativeProfit(e.target.checked);
                      setPage(1);
                    }}
                  />
                  ไม่แสดงเฉพาะรายการที่กำไรรวมติดลบ
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-flow-text">
                  <input
                    checked={filterZeroSaleOnly}
                    className="ui-checkbox"
                    type="checkbox"
                    onChange={(e) => {
                      setFilterZeroSaleOnly(e.target.checked);
                      setPage(1);
                    }}
                  />
                  แสดงเฉพาะรายการที่มูลค่าขายรวม = 0
                </label>
              </div>
              <button
                className="rounded-lg border border-flow-border bg-flow-input px-3 py-1.5 text-xs font-medium text-flow-text hover:bg-brand-50"
                type="button"
                onClick={clearFilters}
              >
                ล้างฟิลเตอร์
              </button>
            </div>
            {activeTab === "detail" &&
              (filterHn ||
                filterAn ||
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
                <p className="mt-2 text-[11px] text-flow-muted">
                  แสดง {filteredRows.length.toLocaleString("th-TH")} จาก{" "}
                  {rows.length.toLocaleString("th-TH")} รายการ
                </p>
              )}
            {activeTab === "period" &&
              (filterZeroSaleOnly ||
                filterNegativeProfitOnly ||
                excludeZeroSale ||
                excludeNegativeProfit) && (
                <p className="mt-2 text-[11px] text-flow-muted">
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
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">จำนวนรายการยา </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-flow-text">
                {filteredRows.length.toLocaleString("th-TH")} รายการ
              </p>
            </div>
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">
                {visitType === "ipd" ? "จำนวน AN ไม่ซ้ำ" : "จำนวน HN ไม่ซ้ำ"}{" "}
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-flow-text">
                {visitType === "ipd"
                  ? `${uniqueAnCount.toLocaleString("th-TH")} AN`
                  : `${uniqueHnCount.toLocaleString("th-TH")} HN`}
              </p>
            </div>
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">จำนวน Visit ที่มีการจ่ายยา</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-flow-text">
                {uniqueVisitCount.toLocaleString("th-TH")} visit
              </p>
            </div>
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">
                ต้นทุนรวม (ยอดจากคอลัมน์ต้นทุนรวม)
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-flow-text">
                {totals.cost.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                บาท
              </p>
            </div>
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">มูลค่าขายรวม</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-flow-text">
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
                  ? "rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm"
                  : "rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 shadow-sm"
              }
            >
              <p
                className={
                  totals.profit >= 0
                    ? "text-[11px] font-medium text-brand-600"
                    : "text-[11px] font-medium text-rose-700"
                }
              >
                กำไรรวม (sale - cost)
              </p>
              <p
                className={
                  totals.profit >= 0
                    ? "mt-1 text-sm font-semibold tabular-nums text-flow-text"
                    : "mt-1 text-sm font-semibold tabular-nums text-rose-800"
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
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">จำนวนช่วงเวลา</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-flow-text">
                {filteredPeriodRows.length.toLocaleString("th-TH")} ช่วง
              </p>
            </div>
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">ต้นทุนรวม</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-flow-text">
                {periodTotalsFiltered.cost.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                บาท
              </p>
            </div>
            <div className="rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-medium text-brand-600">มูลค่าขายรวม</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-flow-text">
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
                  ? "rounded-xl border border-flow-border bg-white px-3 py-3 shadow-sm"
                  : "rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 shadow-sm"
              }
            >
              <p
                className={
                  periodTotalsFiltered.profit >= 0
                    ? "text-[11px] font-medium text-brand-600"
                    : "text-[11px] font-medium text-rose-700"
                }
              >
                กำไรรวม (sale - cost)
              </p>
              <p
                className={
                  periodTotalsFiltered.profit >= 0
                    ? "mt-1 text-sm font-semibold tabular-nums text-flow-text"
                    : "mt-1 text-sm font-semibold tabular-nums text-rose-800"
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
            <h2 className="text-sm font-semibold text-flow-text">
              ผลลัพธ์การค้นหา{" "}
              <span className="font-normal text-flow-muted">
                ({visitType === "opd" ? "OPD" : "IPD"})
              </span>{" "}
              {activeTab === "detail" && rows.length > 0
                ? `(${filteredRows.length} แถว, หน้า ${currentPage}/${totalPages})`
                : activeTab === "period" && periodRows.length > 0
                  ? `(${filteredPeriodRows.length} ช่วงเวลา)`
                  : ""}
            </h2>
            {activeTab === "detail" && rows.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] text-flow-muted">
                <p>
                  ช่วงวันที่ {isoToThaiDisplay(dateFrom)} – {isoToThaiDisplay(dateTo)}
                </p>
                <button
                  className="rounded border border-brand-300 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={exporting || sortedRows.length === 0}
                  type="button"
                  onClick={handleExportExcel}
                >
                  {exporting ? "กำลัง Export..." : "Export Excel"}
                </button>
                <div className="flex items-center gap-1">
                  <span>แสดงต่อหน้า:</span>
                  <select
                    className="rounded border border-flow-border bg-white px-1 py-0.5 text-[11px] text-flow-text focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                    value={pageSize}
                    onChange={(event) => {
                      const newSize = Number(event.target.value) || 20;

                      setPageSize(newSize);
                      setPage(1);
                    }}
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
              <div className="flex items-center gap-3 text-[11px] text-flow-muted">
                <p>
                  {formatMonthsIsoThaiDisplay(periodMonths)} (
                  {isoToThaiDisplay(monthsIsoToDateRange(periodMonths).d1)} –{" "}
                  {isoToThaiDisplay(monthsIsoToDateRange(periodMonths).d2)})
                </p>
                <button
                  className="rounded border border-brand-300 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={exporting || filteredPeriodRows.length === 0}
                  type="button"
                  onClick={handleExportPeriodExcel}
                >
                  {exporting ? "กำลัง Export..." : "Export Excel"}
                </button>
              </div>
            )}
          </div>

          {activeTab === "detail" && rows.length === 0 && !loading && !error && (
            <p className="text-xs md:text-sm text-flow-muted">
              ยังไม่มีข้อมูลแสดง กรุณาเลือกช่วงวันที่ แล้วกด &quot;ค้นหาข้อมูล&quot;
            </p>
          )}

          {activeTab === "period" && periodRows.length === 0 && !loading && !error && (
            <p className="text-xs md:text-sm text-flow-muted">
              ยังไม่มีข้อมูลสรุปแสดง กรุณาเลือกเดือน (เลือกได้หลายเดือน) แล้วกด
              &quot;ค้นหาข้อมูล&quot;
            </p>
          )}

          {activeTab === "period" &&
            periodRows.length > 0 &&
            filteredPeriodRows.length === 0 &&
            !loading && (
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
            <div className="overflow-x-auto rounded-xl border border-flow-border bg-white shadow-sm">
              <table className="min-w-full border-collapse text-xs md:text-sm text-left">
                <thead>
                  <tr className="bg-black">
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      NO.
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      <button
                        className="text-white hover:text-brand-200"
                        type="button"
                        onClick={() => toggleSort("HN")}
                      >
                        HN {sortMark("HN")}
                      </button>
                    </th>
                    {showAnColumn && (
                      <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                        <button
                          className="text-white hover:text-brand-200"
                          type="button"
                          onClick={() => toggleSort("AN")}
                        >
                          AN {sortMark("AN")}
                        </button>
                      </th>
                    )}
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      <button
                        className="text-white hover:text-brand-200"
                        type="button"
                        onClick={() => toggleSort("PTTYPE")}
                      >
                        สิทธิการรักษา {sortMark("PTTYPE")}
                      </button>
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      <button
                        className="text-white hover:text-brand-200"
                        type="button"
                        onClick={() => toggleSort("CLINIC")}
                      >
                        คลินิก {sortMark("CLINIC")}
                      </button>
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      <button
                        className="text-white hover:text-brand-200"
                        type="button"
                        onClick={() => toggleSort("MEDITEM")}
                      >
                        รหัสยา {sortMark("MEDITEM")}
                      </button>
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      <button
                        className="text-white hover:text-brand-200"
                        type="button"
                        onClick={() => toggleSort("DRUG_NAME")}
                      >
                        ชื่อยา {sortMark("DRUG_NAME")}
                      </button>
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      <button
                        className="text-white hover:text-brand-200"
                        type="button"
                        onClick={() => toggleSort("MEDTYPE")}
                      >
                        ประเภทยา {sortMark("MEDTYPE")}
                      </button>
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      <button
                        className="text-white hover:text-brand-200"
                        type="button"
                        onClick={() => toggleSort("ACCNATION")}
                      >
                        บัญชียาหลัก {sortMark("ACCNATION")}
                      </button>
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      <button
                        className="text-white hover:text-brand-200"
                        type="button"
                        onClick={() => toggleSort("TOTAL_QTY")}
                      >
                        จำนวนรวม {sortMark("TOTAL_QTY")}
                      </button>
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      <button
                        className="text-white hover:text-brand-200"
                        type="button"
                        onClick={() => toggleSort("TOTAL_COST")}
                      >
                        ต้นทุนรวม {sortMark("TOTAL_COST")}
                      </button>
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      <button
                        className="text-white hover:text-brand-200"
                        type="button"
                        onClick={() => toggleSort("TOTAL_SALE")}
                      >
                        มูลค่าขายรวม {sortMark("TOTAL_SALE")}
                      </button>
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      <button
                        className="text-white hover:text-brand-200"
                        type="button"
                        onClick={() => toggleSort("TOTAL_PROFIT")}
                      >
                        กำไรรวม {sortMark("TOTAL_PROFIT")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, index) => (
                    <tr
                      key={`${row.HN}-${String(row.AN ?? "")}-${row.MEDITEM}-${String(row.PTTYPE_NAME ?? "")}-${startIndex + index}`}
                      className={`border-b border-slate-100 hover:bg-flow-input ${
                        Number(row.TOTAL_PROFIT ?? 0) < 0 ? "text-brand-700" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap">
                        {formatHnDisplay(row.HN)}
                      </td>
                      {showAnColumn && (
                        <td
                          className="px-3 py-2 text-flow-text whitespace-nowrap"
                          title={row.WARD_NAME ? `หอผู้ป่วย: ${row.WARD_NAME}` : undefined}
                        >
                          {row.AN ? formatHnDisplay(row.AN) : "—"}
                        </td>
                      )}
                      <td
                        className="px-3 py-2 text-flow-text whitespace-nowrap max-w-[14rem] truncate"
                        title={row.PTTYPE_NAME ?? undefined}
                      >
                        {row.PTTYPE_NAME ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap">
                        {row.CLINIC_LCT_NAME ?? row.CLINIC_LCT ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap">{row.MEDITEM}</td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap">
                        {row.DRUG_NAME ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap">
                        {row.MEDTYPE ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap">
                        {row.ACCNATION ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                        {Number(row.TOTAL_QTY ?? 0).toLocaleString("th-TH")}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                        {Number(row.TOTAL_COST ?? 0).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                        {Number(row.TOTAL_SALE ?? 0).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
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
            <div className="mt-3 flex items-center justify-between text-[11px] text-flow-muted">
              <div>
                แสดงแถวที่ {sortedRows.length === 0 ? 0 : startIndex + 1} -{" "}
                {Math.min(endIndex, sortedRows.length)} จากทั้งหมด {sortedRows.length} แถว
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

          {activeTab === "period" && filteredPeriodRows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-flow-border bg-white shadow-sm">
              <table className="min-w-full border-collapse text-xs md:text-sm text-left">
                <thead>
                  <tr className="bg-black">
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      NO.
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap">
                      เดือน ปี
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      จำนวนรวม ({Number(periodUniqueItemCount ?? 0).toLocaleString("th-TH")}{" "}
                      รายการยา)
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      ต้นทุนรวม
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      มูลค่าขายรวม
                    </th>
                    <th className="border-b border-neutral-800 bg-black px-3 py-2 text-right font-semibold text-white whitespace-nowrap">
                      กำไรรวม
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeriodRows.map((row, index) => (
                    <tr
                      key={row.PERIOD_KEY}
                      className="border-b border-slate-100 hover:bg-flow-input"
                    >
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap">
                        {formatPeriodLabelThai(
                          String(row.PERIOD_KEY ?? row.PERIOD_LABEL ?? ""),
                          "month"
                        )}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                        {Number(row.TOTAL_QTY ?? 0).toLocaleString("th-TH")}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                        {Number(row.TOTAL_COST ?? 0).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                        {Number(row.TOTAL_SALE ?? 0).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                        {Number(row.TOTAL_PROFIT ?? 0).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-flow-border bg-slate-50 font-semibold">
                    <td
                      className="px-3 py-2 text-flow-text whitespace-nowrap text-right"
                      colSpan={2}
                    >
                      รวมทั้งหมด
                    </td>
                    <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                      {Number(periodTotalsFiltered.qty ?? 0).toLocaleString("th-TH")}
                    </td>
                    <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                      {Number(periodTotalsFiltered.cost ?? 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
                      {Number(periodTotalsFiltered.sale ?? 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-flow-text whitespace-nowrap text-right">
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

        <section className="mt-4 text-[11px] md:text-xs text-flow-muted">
          <p>
            เวอร์ชันระบบต้นแบบ: {siteConfig.version} — API:{" "}
            <code>
              {activeTab === "period"
                ? "/api/db/drug-cost-summary-period"
                : "/api/db/drug-cost-summary"}
            </code>
          </p>
        </section>
      </main>
    </div>
  );
}
