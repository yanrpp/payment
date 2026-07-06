"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, FileText, Folder } from "lucide-react";

import { normalizeThaiCardInput } from "@/lib/card/normalize";
import { isoToThaiDisplay } from "@/lib/date/thaiDate";
import { normalizeHnInput } from "@/lib/hn/normalize";
import { buildOpdscanUncPath } from "@/lib/opdscan/path";

type PatientMedicationRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  PRSCDATE: string;
  AN: string | null;
  VISIT_TYPE: string;
  CLINIC_LCT: string | null;
  CLINIC_LCT_NAME: string | null;
  MEDITEM: string;
  MEDTYPE: string | null;
  ACCNATION: string | null;
  DRUG_NAME: string | null;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
  PTTYPE_NAME: string | null;
  DRUG_USAGE: string | null;
  DRUG_DOSE: string | null;
};

type PatientLabRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  LAB_DATE: string;
  AN: string | null;
  VISIT_TYPE: string;
  LABEXM: number | null;
  LAB_NAME: string | null;
  RESULT: string | null;
  MIN_NRM: string | null;
  MAX_NRM: string | null;
  NRM_UNIT: string | null;
};

type PatientCandidate = {
  HN: string;
  DSPNAME: string | null;
  CARDNO: string | null;
};

type OpdscanFile = {
  name: string;
  size: number;
  modified: string | null;
  isDirectory: boolean;
};

const OPDSCAN_UNC_ROOT = "\\\\192.168.108.145\\opdscan$";

function apiDateToIsoLocal(value: unknown): string {
  if (value == null) return "";
  const d =
    typeof value === "string"
      ? new Date(value)
      : value instanceof Date
        ? value
        : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
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

function formatQty(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isInteger(n) ? String(n) : n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function formatLabReference(row: PatientLabRow): string {
  const min = row.MIN_NRM?.trim();
  const max = row.MAX_NRM?.trim();
  const unit = row.NRM_UNIT?.trim();
  if (!min && !max) return "—";
  const range = min && max ? `${min} - ${max}` : (min ?? max ?? "");
  return unit ? `${range} ${unit}` : range;
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ALL_DATES = "__all__";
type ContentTab = "drug" | "lab";

export default function PatientMedicationSearchPage() {
  const [hn, setHn] = useState("");
  const [cardno, setCardno] = useState("");
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PatientMedicationRow[]>([]);
  const [labRows, setLabRows] = useState<PatientLabRow[]>([]);
  const [contentTab, setContentTab] = useState<ContentTab>("drug");
  const [selectedDate, setSelectedDate] = useState<string>(ALL_DATES);
  const [filterVisitType, setFilterVisitType] = useState<"all" | "OPD" | "IPD">("all");
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patientCandidates, setPatientCandidates] = useState<PatientCandidate[]>([]);
  const [nameSearchQuery, setNameSearchQuery] = useState("");
  const [scanHn, setScanHn] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanFiles, setScanFiles] = useState<OpdscanFile[]>([]);
  const [scanUncPath, setScanUncPath] = useState("");
  const [scanHnQuery, setScanHnQuery] = useState("");
  const [scanSubPath, setScanSubPath] = useState("");
  const [scanDirLoading, setScanDirLoading] = useState(false);

  const resetResults = () => {
    setRows([]);
    setLabRows([]);
    setSelectedDate(ALL_DATES);
    setFilterVisitType("all");
    setContentTab("drug");
  };

  const fetchPatientDetails = async (params: {
    hn?: string;
    cardno?: string;
    name?: string;
  }) => {
    const query = new URLSearchParams();
    if (params.hn) query.set("hn", params.hn);
    if (params.cardno) query.set("cardno", params.cardno);
    if (params.name) query.set("name", params.name);

    const qs = query.toString();
    const [medRes, labRes] = await Promise.all([
      fetch(`/api/db/patient-medication-search?${qs}`),
      fetch(`/api/db/patient-lab-search?${qs}`),
    ]);
    const [medJson, labJson] = await Promise.all([medRes.json(), labRes.json()]);

    const errors: string[] = [];
    if (!medRes.ok || !medJson.success) {
      errors.push(medJson.message ?? "ค้นหารายการยาไม่สำเร็จ");
    } else {
      setRows(Array.isArray(medJson.data) ? medJson.data : []);
    }
    if (!labRes.ok || !labJson.success) {
      errors.push(labJson.message ?? "ค้นหารายการ Lab ไม่สำเร็จ");
    } else {
      setLabRows(Array.isArray(labJson.data) ? labJson.data : []);
    }

    if (errors.length === 2) {
      setError(errors.join(" · "));
    } else if (errors.length === 1) {
      setError(errors[0]);
    }

    if (medRes.ok && medJson.success && (medJson.data?.length ?? 0) === 0) {
      if (labRes.ok && labJson.success && (labJson.data?.length ?? 0) > 0) {
        setContentTab("lab");
      }
    }

    const medData = medRes.ok && medJson.success && Array.isArray(medJson.data) ? medJson.data : [];
    const labData = labRes.ok && labJson.success && Array.isArray(labJson.data) ? labJson.data : [];
    const patientHn =
      (medData[0] as PatientMedicationRow | undefined)?.HN ??
      (labData[0] as PatientLabRow | undefined)?.HN ??
      params.hn;

    if (patientHn) {
      setScanHn(formatHnDisplay(patientHn));
    }
  };

  const closePatientModal = () => {
    setShowPatientModal(false);
    setPatientCandidates([]);
    setNameSearchQuery("");
  };

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    resetResults();
    closePatientModal();

    const normalizedHn = normalizeHnInput(hn);
    const normalizedCard = normalizeThaiCardInput(cardno);
    const trimmedName = name.trim();

    if (!normalizedHn && !normalizedCard && !trimmedName) {
      setLoading(false);
      setError("กรุณาระบุอย่างน้อย 1 เงื่อนไข: HN, เลขบัตรประชาชน หรือชื่อ-นามสกุล");
      return;
    }

    const needsPatientPicker = Boolean(trimmedName) && !normalizedHn && !normalizedCard;

    try {
      if (needsPatientPicker) {
        const res = await fetch(
          `/api/db/patient-search-by-name?name=${encodeURIComponent(trimmedName)}`
        );
        const json = await res.json();

        if (!res.ok || !json.success) {
          setError(json.message ?? "ค้นหารายชื่อผู้ป่วยไม่สำเร็จ");
          return;
        }

        const candidates: PatientCandidate[] = Array.isArray(json.data) ? json.data : [];

        if (candidates.length === 0) {
          setError("ไม่พบผู้ป่วยที่ตรงกับชื่อที่ค้นหา");
          return;
        }

        setPatientCandidates(candidates);
        setNameSearchQuery(trimmedName);
        setShowPatientModal(true);
        return;
      }

      await fetchPatientDetails({
        hn: normalizedHn || undefined,
        cardno: normalizedCard || undefined,
        name: trimmedName || undefined,
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = async (patient: PatientCandidate) => {
    closePatientModal();
    setLoading(true);
    setError(null);
    resetResults();

    try {
      await fetchPatientDetails({ hn: patient.HN });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showPatientModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePatientModal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPatientModal]);

  const closeScanModal = () => {
    setShowScanModal(false);
    setScanFiles([]);
    setScanUncPath("");
    setScanHnQuery("");
    setScanSubPath("");
    setScanDirLoading(false);
    setScanError(null);
  };

  const loadScanDirectory = async (hnValue: string, subPath: string) => {
    const params = new URLSearchParams({ hn: hnValue });
    if (subPath) params.set("sub", subPath);

    const res = await fetch(`/api/opdscan/list?${params}`);
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message ?? "เปิดโฟลเดอร์สแกน OPD ไม่สำเร็จ");
    }

    setScanFiles(Array.isArray(json.files) ? json.files : []);
    setScanUncPath(json.uncPath ?? "");
    setScanSubPath(json.subPath ?? subPath);
    setScanHnQuery(hnValue);
    setShowScanModal(true);
  };

  const openOpdscan = async () => {
    const hnValue = scanHn.trim() || hn.trim();
    if (!hnValue) {
      setScanError("กรุณาระบุ HN สำหรับเปิดไฟล์สแกน (เช่น 19999/99)");
      return;
    }

    const previewPath = buildOpdscanUncPath(hnValue, OPDSCAN_UNC_ROOT);
    if (!previewPath) {
      setScanError("รูปแบบ HN ไม่ถูกต้อง (ใช้เช่น 19999/99)");
      return;
    }

    setScanLoading(true);
    setScanError(null);
    closeScanModal();

    try {
      await loadScanDirectory(hnValue, "");
    } catch (fetchError) {
      setScanError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
    } finally {
      setScanLoading(false);
    }
  };

  const navigateScanFolder = async (subPath: string) => {
    if (!scanHnQuery) return;

    setScanDirLoading(true);
    setScanError(null);

    try {
      await loadScanDirectory(scanHnQuery, subPath);
    } catch (fetchError) {
      setScanError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
    } finally {
      setScanDirLoading(false);
    }
  };

  const openScanFolder = (folderName: string) => {
    const nextSubPath = scanSubPath ? `${scanSubPath}\\${folderName}` : folderName;
    void navigateScanFolder(nextSubPath);
  };

  const goBackScanFolder = () => {
    if (!scanSubPath) return;
    const parts = scanSubPath.split("\\").filter(Boolean);
    parts.pop();
    void navigateScanFolder(parts.join("\\"));
  };

  const openScanFile = (fileName: string) => {
    const relativePath = scanSubPath ? `${scanSubPath}\\${fileName}` : fileName;
    const url = `/api/opdscan/file?hn=${encodeURIComponent(scanHnQuery)}&name=${encodeURIComponent(relativePath)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const scanBreadcrumbs = useMemo(() => {
    if (!scanSubPath) return [];
    return scanSubPath.split("\\").filter(Boolean);
  }, [scanSubPath]);

  const copyScanPath = async () => {
    if (!scanUncPath) return;
    try {
      await navigator.clipboard.writeText(scanUncPath);
    } catch {
      // clipboard may be blocked
    }
  };

  useEffect(() => {
    if (!showScanModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeScanModal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showScanModal]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await runSearch();
  };

  const drugTabCount = useMemo(() => {
    return rows.filter((row) => filterVisitType === "all" || row.VISIT_TYPE === filterVisitType)
      .length;
  }, [rows, filterVisitType]);

  const labTabCount = useMemo(() => {
    return labRows.filter((row) => filterVisitType === "all" || row.VISIT_TYPE === filterVisitType)
      .length;
  }, [labRows, filterVisitType]);

  const drugDates = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (filterVisitType !== "all" && row.VISIT_TYPE !== filterVisitType) continue;
      const iso = apiDateToIsoLocal(row.PRSCDATE);
      if (iso) set.add(iso);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows, filterVisitType]);

  const labDates = useMemo(() => {
    const set = new Set<string>();
    for (const row of labRows) {
      if (filterVisitType !== "all" && row.VISIT_TYPE !== filterVisitType) continue;
      const iso = apiDateToIsoLocal(row.LAB_DATE);
      if (iso) set.add(iso);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [labRows, filterVisitType]);

  const activeDates = contentTab === "drug" ? drugDates : labDates;

  const handleContentTabChange = (tab: ContentTab) => {
    setContentTab(tab);
    setSelectedDate(ALL_DATES);
  };

  const handleVisitTypeChange = (type: "all" | "OPD" | "IPD") => {
    setFilterVisitType(type);
    setSelectedDate(ALL_DATES);

    const nextDrugCount = rows.filter((row) => type === "all" || row.VISIT_TYPE === type).length;
    const nextLabCount = labRows.filter((row) => type === "all" || row.VISIT_TYPE === type).length;

    if (contentTab === "drug" && nextDrugCount === 0 && nextLabCount > 0) {
      setContentTab("lab");
    } else if (contentTab === "lab" && nextLabCount === 0 && nextDrugCount > 0) {
      setContentTab("drug");
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filterVisitType !== "all" && row.VISIT_TYPE !== filterVisitType) return false;
      if (selectedDate === ALL_DATES) return true;
      return apiDateToIsoLocal(row.PRSCDATE) === selectedDate;
    });
  }, [rows, selectedDate, filterVisitType]);

  const filteredLabRows = useMemo(() => {
    return labRows.filter((row) => {
      if (filterVisitType !== "all" && row.VISIT_TYPE !== filterVisitType) return false;
      if (selectedDate === ALL_DATES) return true;
      return apiDateToIsoLocal(row.LAB_DATE) === selectedDate;
    });
  }, [labRows, selectedDate, filterVisitType]);

  const patientHeader = useMemo(() => {
    const source = rows.length > 0 ? rows : labRows;
    if (source.length === 0) return null;
    const first = source[0];
    const uniqueHn = new Set(source.map((r) => r.HN));
    return {
      multiple: uniqueHn.size > 1,
      hn: first.HN,
      dspname: first.DSPNAME,
      cardno: first.CARDNO,
      patientCount: uniqueHn.size,
    };
  }, [rows, labRows]);

  const hasResults = rows.length > 0 || labRows.length > 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-flow-border bg-white px-4 py-4 md:px-6">
        <h1 className="text-xl font-bold text-flow-text md:text-2xl">รายการยา + lab ผู้ป่วย</h1>
        <p className="mt-1 text-xs text-flow-muted md:text-sm">
          ค้นหาด้วย HN หรือเลขบัตรประชาชนเพื่อดูข้อมูลทันที หรือค้นหาด้วยชื่อ-นามสกุลแล้วเลือกผู้ป่วยจากรายการ
        </p>
      </header>

      <main className="flex-1 w-full px-4 py-6 md:px-6 md:py-8">
        <section className="mb-6">
          <form
            className="space-y-4 rounded-xl border border-accent-border bg-white p-4 shadow-sm"
            onSubmit={handleSearch}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-1">
                <label className="text-xs font-medium text-flow-text" htmlFor="med-hn">
                  HN
                </label>
                <input
                  className="ui-input w-full px-3 py-1.5 text-sm"
                  id="med-hn"
                  placeholder="เช่น 1666/69 หรือ 69001666"
                  type="text"
                  value={hn}
                  onChange={(e) => setHn(e.target.value)}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <label className="text-xs font-medium text-flow-text" htmlFor="med-cardno">
                  เลขบัตรประชาชน
                </label>
                <input
                  className="ui-input w-full px-3 py-1.5 text-sm"
                  id="med-cardno"
                  inputMode="numeric"
                  pattern="\d*"
                  placeholder="13 หลัก"
                  type="text"
                  value={cardno}
                  onChange={(e) => {
                    setCardno(e.target.value.replace(/\D/g, "").slice(0, 13));
                  }}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 xl:col-span-1">
                <label className="text-xs font-medium text-flow-text" htmlFor="med-name">
                  ชื่อ-นามสกุล
                </label>
                <input
                  className="ui-input w-full px-3 py-1.5 text-sm"
                  id="med-name"
                  placeholder="พิมพ์ชื่อหรือนามสกุลบางส่วน"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-flow-border pt-4">
              <button
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
                type="submit"
              >
                {loading ? "กำลังค้นหา..." : "ค้นหา"}
              </button>
            </div>

            <div className="space-y-3 border-t border-flow-border pt-4">
              <div>
                <p className="text-xs font-semibold text-flow-text">ไฟล์สแกน OPD</p>
                <p className="mt-0.5 text-[11px] text-flow-muted">
              
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:max-w-xs">
                  <label className="text-xs font-medium text-flow-text" htmlFor="scan-hn">
                    HN สำหรับเปิดไฟล์สแกน
                  </label>
                  <input
                    className="ui-input w-full px-3 py-1.5 text-sm"
                    id="scan-hn"
                    placeholder="เช่น  "
                    type="text"
                    value={scanHn}
                    onChange={(e) => setScanHn(e.target.value)}
                  />
                </div>
                <button
                  className="rounded-lg border border-flow-border bg-white px-4 py-2 text-sm font-medium text-flow-text hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={scanLoading}
                  type="button"
                  onClick={() => void openOpdscan()}
                >
                  {scanLoading ? "กำลังเปิด..." : "เปิดไฟล์สแกน"}
                </button>
              </div>
              {scanError ? <p className="text-xs text-red-600">{scanError}</p> : null}
            </div>
          </form>
        </section>

        {error ? (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              hasResults
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {error}
          </div>
        ) : null}

        {hasResults ? (
          <>
            <section className="mb-4 rounded-xl border border-flow-border bg-white p-4 shadow-sm">
              {patientHeader && !patientHeader.multiple ? (
                <div className="mb-3 text-sm text-flow-text">
                  <span className="font-semibold">{patientHeader.dspname ?? "(ไม่ระบุชื่อ)"}</span>
                  <span className="mx-2 text-flow-muted">·</span>
                  <span>HN {formatHnDisplay(patientHeader.hn)}</span>
                  {patientHeader.cardno ? (
                    <>
                      <span className="mx-2 text-flow-muted">·</span>
                      <span>บัตร {patientHeader.cardno}</span>
                    </>
                  ) : null}
                </div>
              ) : patientHeader?.multiple ? (
                <p className="mb-3 text-sm text-flow-muted">
                  พบผู้ป่วย {patientHeader.patientCount} ราย — แสดงรายการยาและ Lab ที่ตรงเงื่อนไข
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["drug", `รายการยา (${drugTabCount})`],
                    ["lab", `Lab (${labTabCount})`],
                  ] as const
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      contentTab === tab
                        ? "bg-brand-600 text-white"
                        : "border border-flow-border bg-white text-flow-text hover:bg-slate-50"
                    }`}
                    type="button"
                    onClick={() => handleContentTabChange(tab)}
                  >
                    {label}
                  </button>
                ))}
                <span className="mx-1 hidden h-6 w-px bg-flow-border sm:block" />
                {(["all", "OPD", "IPD"] as const).map((type) => (
                  <button
                    key={type}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      filterVisitType === type
                        ? "bg-slate-800 text-white"
                        : "border border-flow-border bg-white text-flow-text hover:bg-slate-50"
                    }`}
                    type="button"
                    onClick={() => handleVisitTypeChange(type)}
                  >
                    {type === "all" ? "ทุกประเภท" : type}
                  </button>
                ))}
              </div>

              {activeDates.length > 0 ? (
                <>
                  <p className="mb-2 mt-4 text-xs font-semibold text-flow-text">
                    {contentTab === "drug" ? "เลือกวันที่มียา" : "เลือกวันที่มี Lab"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selectedDate === ALL_DATES
                          ? "bg-brand-600 text-white"
                          : "bg-slate-100 text-flow-text hover:bg-slate-200"
                      }`}
                      type="button"
                      onClick={() => setSelectedDate(ALL_DATES)}
                    >
                      ทุกวัน ({activeDates.length})
                    </button>
                    {activeDates.map((iso) => (
                      <button
                        key={iso}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          selectedDate === iso
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-flow-text hover:bg-slate-200"
                        }`}
                        type="button"
                        onClick={() => setSelectedDate(iso)}
                      >
                        {isoToThaiDisplay(iso)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-xs text-flow-muted">
                  {contentTab === "drug"
                    ? "ไม่พบรายการยาในประเภทที่เลือก"
                    : "ไม่พบรายการ Lab ในประเภทที่เลือก"}
                </p>
              )}
            </section>

            {contentTab === "drug" ? (
            <section className="overflow-hidden rounded-xl border border-flow-border bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-flow-muted">
                    <tr>
                      <th className="px-3 py-2">วันสั่งยา</th>
                      {patientHeader?.multiple ? <th className="px-3 py-2">HN</th> : null}
                      {patientHeader?.multiple ? <th className="px-3 py-2">ชื่อ</th> : null}
                      <th className="px-3 py-2">ประเภท</th>
                      <th className="px-3 py-2">ชื่อยา</th>
                      <th className="px-3 py-2">โดสยา</th>
                      <th className="px-3 py-2">วิธีกินยา</th>
                      <th className="px-3 py-2">สิทธิการรักษา</th>
                      <th className="px-3 py-2">หมวด</th>
                      <th className="px-3 py-2">คลินิก</th>
                      <th className="px-3 py-2 text-right">จำนวน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-flow-border">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          className="px-3 py-6 text-center text-flow-muted"
                          colSpan={patientHeader?.multiple ? 12 : 10}
                        >
                          ไม่มีรายการยาในวันที่เลือก
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, index) => {
                        const dateIso = apiDateToIsoLocal(row.PRSCDATE);
                        const rowKey = `${row.HN}-${dateIso}-${row.MEDITEM}-${row.CLINIC_LCT}-${row.AN ?? ""}-${row.DRUG_USAGE ?? ""}-${index}`;

                        return (
                          <tr key={rowKey} className="hover:bg-slate-50/80">
                            <td className="whitespace-nowrap px-3 py-2 text-flow-text">
                              {isoToThaiDisplay(dateIso)}
                            </td>
                            {patientHeader?.multiple ? (
                              <td className="whitespace-nowrap px-3 py-2">
                                {formatHnDisplay(row.HN)}
                              </td>
                            ) : null}
                            {patientHeader?.multiple ? (
                              <td className="px-3 py-2">{row.DSPNAME ?? "—"}</td>
                            ) : null}
                            <td className="whitespace-nowrap px-3 py-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  row.VISIT_TYPE === "IPD"
                                    ? "bg-violet-100 text-violet-800"
                                    : "bg-sky-100 text-sky-800"
                                }`}
                              >
                                {row.VISIT_TYPE}
                                {row.AN ? ` · ${row.AN}` : ""}
                              </span>
                            </td>
                            <td className="min-w-[12rem] px-3 py-2">{row.DRUG_NAME ?? "—"}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-flow-text">
                              {row.DRUG_DOSE?.trim() ? row.DRUG_DOSE : "—"}
                            </td>
                            <td className="min-w-[10rem] px-3 py-2 text-flow-muted">
                              {row.DRUG_USAGE?.trim() ? row.DRUG_USAGE : "—"}
                            </td>
                            <td className="px-3 py-2 text-flow-muted">
                              {row.PTTYPE_NAME?.trim() ? row.PTTYPE_NAME : "—"}
                            </td>
                            <td className="px-3 py-2 text-flow-muted">{row.MEDTYPE ?? "—"}</td>
                            <td className="px-3 py-2 text-flow-muted">
                              {row.CLINIC_LCT_NAME ?? row.CLINIC_LCT ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              {formatQty(row.TOTAL_QTY)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            ) : (
            <section className="overflow-hidden rounded-xl border border-flow-border bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-flow-muted">
                    <tr>
                      <th className="px-3 py-2">วันที่ตรวจ</th>
                      {patientHeader?.multiple ? <th className="px-3 py-2">HN</th> : null}
                      {patientHeader?.multiple ? <th className="px-3 py-2">ชื่อ</th> : null}
                      <th className="px-3 py-2">ประเภท</th>
                      <th className="px-3 py-2">ชื่อการตรวจ</th>
                      <th className="px-3 py-2">ผล</th>
                      <th className="px-3 py-2">ค่าอ้างอิง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-flow-border">
                    {filteredLabRows.length === 0 ? (
                      <tr>
                        <td
                          className="px-3 py-6 text-center text-flow-muted"
                          colSpan={patientHeader?.multiple ? 7 : 5}
                        >
                          ไม่มีรายการ Lab ในวันที่เลือก
                        </td>
                      </tr>
                    ) : (
                      filteredLabRows.map((row, index) => {
                        const dateIso = apiDateToIsoLocal(row.LAB_DATE);
                        const rowKey = `${row.HN}-${dateIso}-${row.LABEXM}-${row.AN ?? ""}-${index}`;

                        return (
                          <tr key={rowKey} className="hover:bg-slate-50/80">
                            <td className="whitespace-nowrap px-3 py-2 text-flow-text">
                              {isoToThaiDisplay(dateIso)}
                            </td>
                            {patientHeader?.multiple ? (
                              <td className="whitespace-nowrap px-3 py-2">
                                {formatHnDisplay(row.HN)}
                              </td>
                            ) : null}
                            {patientHeader?.multiple ? (
                              <td className="px-3 py-2">{row.DSPNAME ?? "—"}</td>
                            ) : null}
                            <td className="whitespace-nowrap px-3 py-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  row.VISIT_TYPE === "IPD"
                                    ? "bg-violet-100 text-violet-800"
                                    : "bg-sky-100 text-sky-800"
                                }`}
                              >
                                {row.VISIT_TYPE}
                                {row.AN ? ` · ${row.AN}` : ""}
                              </span>
                            </td>
                            <td className="min-w-[14rem] px-3 py-2">{row.LAB_NAME ?? "—"}</td>
                            <td className="min-w-[8rem] px-3 py-2 font-medium text-flow-text">
                              {row.RESULT?.trim() ? row.RESULT : "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-flow-muted">
                              {formatLabReference(row)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            )}
          </>
        ) : !loading && !hasResults ? (
          <p className="text-sm text-flow-muted">ระบุเงื่อนไขค้นหาแล้วกด &quot;ค้นหา&quot;</p>
        ) : null}
      </main>

      {showPatientModal ? (
        <div
          aria-labelledby="patient-picker-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          onClick={closePatientModal}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-flow-border bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-flow-border bg-flow-input px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-flow-text" id="patient-picker-title">
                  เลือกผู้ป่วย
                </h2>
                <p className="mt-0.5 text-xs text-flow-muted">
                  พบ {patientCandidates.length} รายการที่ตรงกับ &quot;{nameSearchQuery}&quot;
                  {patientCandidates.length >= 50 ? " (แสดงสูงสุด 50 รายการ)" : ""}
                </p>
              </div>
              <button
                className="rounded-lg border border-flow-border bg-white px-3 py-1 text-xs font-medium text-flow-text hover:bg-brand-50"
                type="button"
                onClick={closePatientModal}
              >
                ปิด
              </button>
            </div>
            <div className="max-h-[calc(85vh-4rem)] overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-flow-muted">
                  <tr>
                    <th className="px-4 py-2">ชื่อ-นามสกุล</th>
                    <th className="px-4 py-2">HN</th>
                    <th className="px-4 py-2">เลขบัตรประชาชน</th>
                    <th className="px-4 py-2 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-flow-border">
                  {patientCandidates.map((patient) => (
                    <tr
                      key={patient.HN}
                      className="cursor-pointer hover:bg-brand-50/60"
                      onClick={() => void handlePatientSelect(patient)}
                    >
                      <td className="px-4 py-3 font-medium text-flow-text">
                        {patient.DSPNAME ?? "(ไม่ระบุชื่อ)"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatHnDisplay(patient.HN)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-flow-muted">
                        {patient.CARDNO ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                          type="button"
                          onClick={() => void handlePatientSelect(patient)}
                        >
                          เลือก
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {showScanModal ? (
        <div
          aria-labelledby="opdscan-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          onClick={closeScanModal}
        >
          <div
            className="relative flex h-[92vh] w-[min(96vw,1280px)] flex-col overflow-hidden rounded-xl border border-flow-border bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-flow-border bg-flow-input px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-flow-text" id="opdscan-modal-title">
                  ไฟล์สแกน OPD — HN {formatHnDisplay(normalizeHnInput(scanHnQuery) || scanHnQuery)}
                </h2>
                <p className="mt-1 break-all font-mono text-[11px] text-flow-muted">{scanUncPath}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {scanSubPath ? (
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-flow-border bg-white px-3 py-1 text-xs font-medium text-flow-text hover:bg-brand-50 disabled:opacity-60"
                    disabled={scanDirLoading}
                    type="button"
                    onClick={goBackScanFolder}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    กลับ
                  </button>
                ) : null}
                <button
                  className="rounded-lg border border-flow-border bg-white px-3 py-1 text-xs font-medium text-flow-text hover:bg-brand-50"
                  type="button"
                  onClick={() => void copyScanPath()}
                >
                  คัดลอกพาธ
                </button>
                <button
                  className="rounded-lg border border-flow-border bg-white px-3 py-1 text-xs font-medium text-flow-text hover:bg-brand-50"
                  type="button"
                  onClick={closeScanModal}
                >
                  ปิด
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 border-b border-flow-border bg-white px-4 py-2 text-xs">
              <button
                className={`rounded px-2 py-1 ${scanSubPath ? "text-brand-700 hover:bg-brand-50" : "font-medium text-flow-text"}`}
                disabled={scanDirLoading}
                type="button"
                onClick={() => void navigateScanFolder("")}
              >
                โฟลเดอร์หลัก
              </button>
              {scanBreadcrumbs.map((segment, index) => {
                const subPath = scanBreadcrumbs.slice(0, index + 1).join("\\");
                const isLast = index === scanBreadcrumbs.length - 1;

                return (
                  <span key={subPath} className="flex items-center gap-1">
                    <span className="text-flow-muted">/</span>
                    <button
                      className={`rounded px-2 py-1 ${isLast ? "font-medium text-flow-text" : "text-brand-700 hover:bg-brand-50"}`}
                      disabled={scanDirLoading || isLast}
                      type="button"
                      onClick={() => void navigateScanFolder(subPath)}
                    >
                      {segment}
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {scanDirLoading ? (
                <p className="px-4 py-8 text-center text-sm text-flow-muted">กำลังโหลด...</p>
              ) : scanFiles.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-flow-muted">ไม่พบไฟล์ในโฟลเดอร์นี้</p>
              ) : (
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-flow-muted">
                    <tr>
                      <th className="px-4 py-2">ชื่อ</th>
                      <th className="px-4 py-2">ขนาด</th>
                      <th className="px-4 py-2">แก้ไขล่าสุด</th>
                      <th className="px-4 py-2 text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-flow-border">
                    {scanFiles.map((file) => (
                      <tr
                        key={file.name}
                        className={
                          file.isDirectory
                            ? "cursor-pointer hover:bg-brand-50/50"
                            : "hover:bg-slate-50/80"
                        }
                        title={file.isDirectory ? "ดับเบิลคลิกเพื่อเปิดโฟลเดอร์" : undefined}
                        onDoubleClick={
                          file.isDirectory
                            ? () => {
                                openScanFolder(file.name);
                              }
                            : undefined
                        }
                      >
                        <td className="px-4 py-2 font-medium text-flow-text">
                          <span className="inline-flex items-center gap-2">
                            {file.isDirectory ? (
                              <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                            ) : (
                              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                            )}
                            <span>{file.name}</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-flow-muted">
                          {file.isDirectory ? "—" : formatFileSize(file.size)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-flow-muted">
                          {file.modified ? isoToThaiDisplay(file.modified.slice(0, 10)) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          {file.isDirectory ? (
                            <button
                              className="rounded-lg border border-flow-border bg-white px-3 py-1.5 text-xs font-medium text-flow-text hover:bg-slate-50"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openScanFolder(file.name);
                              }}
                            >
                              เปิด
                            </button>
                          ) : (
                            <button
                              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openScanFile(file.name);
                              }}
                            >
                              เปิด
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
