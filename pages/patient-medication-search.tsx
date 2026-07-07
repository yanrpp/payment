"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, FileText, Folder } from "lucide-react";

import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { isoToThaiDisplay, isoToThaiInput } from "@/lib/date/thaiDate";
import { normalizeHnInput } from "@/lib/hn/normalize";
import { buildOpdscanUncPath } from "@/lib/opdscan/path";
import { parsePatientSearchQuery, scanHnFromSearchQuery } from "@/lib/patient/parseSearchQuery";

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

type PatientXrayRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  XRAY_DATE: string;
  AN: string | null;
  VISIT_TYPE: string;
  RDOEXM: string | null;
  EXAM_NAME: string | null;
};

type PatientHistoryRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  VSTDATE: string;
  VSTTIME: string | null;
  VN: string | null;
  AN: string | null;
  VISIT_TYPE: string;
  OQUEUE: number | null;
  CLINIC_NAME: string | null;
  DOCTOR_NAME: string | null;
  BW: number | null;
  HEIGHT: number | null;
  BMI: number | null;
  PULSE: number | null;
  RR: number | null;
  TEMPERATURE: number | null;
  BPS: number | null;
  BPD: number | null;
  FBS: number | null;
  O2SAT: number | null;
  CC: string | null;
  HPI: string | null;
  PE: string | null;
  NOTE: string | null;
  DIAG_TEXT: string | null;
};

type PatientDiagnosisRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  DIAG_DATE: string;
  AN: string | null;
  VISIT_TYPE: string;
  ICD10: string | null;
  ICD10_NAME: string | null;
  DIAGTYPE: string | null;
  VISIT_REF: string | null;
};

type DiagnosisDayGroup = {
  key: string;
  dateIso: string;
  hn: string;
  visitTypes: string[];
  codes: PatientDiagnosisRow[];
};

type TreatmentDayGroup<T> = {
  key: string;
  dateIso: string;
  hn: string;
  visitTypes: string[];
  items: T[];
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

const OPDSCAN_VIEWER_TARGET = "rpp_opdscan_viewer";

const SEARCH_PROMPT = 'ระบุเงื่อนไขค้นหาแล้วกด "ค้นหา"';

function tabEmptyMessage(hasResults: boolean, filteredMessage: string): string {
  return hasResults ? filteredMessage : SEARCH_PROMPT;
}
type TreatmentTab = "drug" | "lab" | "xray" | "history" | "diag";

const TREATMENT_TABS: { id: TreatmentTab; label: string; dateLabel: string }[] = [
  { id: "drug", label: "ยา", dateLabel: "วันที่มียา" },
  { id: "lab", label: "Lab", dateLabel: "วันที่มี Lab" },
  { id: "xray", label: "X-ray", dateLabel: "วันที่มี X-ray" },
  { id: "history", label: "ซักประวัติ", dateLabel: "วันที่มา" },
  { id: "diag", label: "รหัสวินิจฉัย", dateLabel: "วันที่วินิจฉัย" },
];


function diagDayGroupKey(hn: string, dateIso: string): string {
  return `${hn}|${dateIso}`;
}

function countDiagVisitDays(
  rows: PatientDiagnosisRow[],
  filterVisitType: "all" | "OPD" | "IPD",
  groupByHn: boolean
): number {
  const keys = new Set<string>();
  for (const row of rows) {
    if (!rowMatchesVisitFilter(row.VISIT_TYPE, filterVisitType)) continue;
    const dateIso = apiDateToIsoLocal(row.DIAG_DATE);
    if (!dateIso) continue;
    keys.add(groupByHn ? diagDayGroupKey(String(row.HN), dateIso) : dateIso);
  }
  return keys.size;
}

function groupDiagnosisByDay(
  rows: PatientDiagnosisRow[],
  groupByHn: boolean
): DiagnosisDayGroup[] {
  const map = new Map<string, DiagnosisDayGroup>();
  for (const row of rows) {
    const dateIso = apiDateToIsoLocal(row.DIAG_DATE);
    if (!dateIso) continue;
    const key = groupByHn ? diagDayGroupKey(String(row.HN), dateIso) : dateIso;
    let group = map.get(key);
    if (!group) {
      group = { key, dateIso, hn: String(row.HN), visitTypes: [], codes: [] };
      map.set(key, group);
    }
    if (row.VISIT_TYPE && !group.visitTypes.includes(row.VISIT_TYPE)) {
      group.visitTypes.push(row.VISIT_TYPE);
    }
    group.codes.push(row);
  }
  return Array.from(map.values()).sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}

function formatVisitTypes(types: string[]): string {
  if (types.length === 0) return "—";
  if (types.length === 1) return types[0];
  return types.join("/");
}

function formatVitalValue(value: number | null | undefined, unit?: string): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const text = Number.isInteger(Number(value))
    ? String(value)
    : Number(value).toLocaleString("th-TH", { maximumFractionDigits: 1 });
  return unit ? `${text} ${unit}` : text;
}

function formatBloodPressure(bps: number | null | undefined, bpd: number | null | undefined): string {
  if (bps == null && bpd == null) return "—";
  if (bps != null && bpd != null) return `${bps}/${bpd} mmHg`;
  return String(bps ?? bpd);
}

function formatHistoryText(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  return text || "—";
}

function HistoryVisitCard({ row }: { row: PatientHistoryRow }) {
  const dateIso = apiDateToIsoLocal(row.VSTDATE);

  return (
    <article className="space-y-4 border-b border-flow-border/70 p-4 last:border-b-0">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-flow-muted">วัน-เวลาซักประวัติ</p>
          <p className="text-xs font-medium text-flow-text">
            {isoToThaiDisplay(dateIso)}
            {row.VSTTIME ? ` ${row.VSTTIME}` : ""}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-flow-muted">หน่วยตรวจ</p>
          <p className="text-xs text-flow-text">{formatHistoryText(row.CLINIC_NAME)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-flow-muted">VN</p>
          <p className="font-mono text-xs text-flow-text">{formatHistoryText(row.VN)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-flow-muted">คิวห้องตรวจ</p>
          <p className="text-xs text-flow-text">{row.OQUEUE ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-flow-muted">แพทย์</p>
          <p className="text-xs text-flow-text">{formatHistoryText(row.DOCTOR_NAME)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-flow-muted">ประเภท</p>
          <p className="text-xs text-flow-text">
            {row.VISIT_TYPE}
            {row.AN ? ` · ${row.AN}` : ""}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-flow-muted">Vital Signs</p>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-flow-border/70 bg-slate-50/60 p-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <p className="text-[10px] text-flow-muted">Weight</p>
            <p className="text-xs font-medium">{formatVitalValue(row.BW, "Kg")}</p>
          </div>
          <div>
            <p className="text-[10px] text-flow-muted">Height</p>
            <p className="text-xs font-medium">{formatVitalValue(row.HEIGHT, "cm")}</p>
          </div>
          <div>
            <p className="text-[10px] text-flow-muted">BMI</p>
            <p className="text-xs font-medium">{formatVitalValue(row.BMI)}</p>
          </div>
          <div>
            <p className="text-[10px] text-flow-muted">PR</p>
            <p className="text-xs font-medium">{formatVitalValue(row.PULSE, "/min")}</p>
          </div>
          <div>
            <p className="text-[10px] text-flow-muted">RR</p>
            <p className="text-xs font-medium">{formatVitalValue(row.RR, "/min")}</p>
          </div>
          <div>
            <p className="text-[10px] text-flow-muted">Temp</p>
            <p className="text-xs font-medium">{formatVitalValue(row.TEMPERATURE, "°C")}</p>
          </div>
          <div>
            <p className="text-[10px] text-flow-muted">BP</p>
            <p className="text-xs font-medium">{formatBloodPressure(row.BPS, row.BPD)}</p>
          </div>
          <div>
            <p className="text-[10px] text-flow-muted">FBS/DTX</p>
            <p className="text-xs font-medium">{formatVitalValue(row.FBS)}</p>
          </div>
          <div>
            <p className="text-[10px] text-flow-muted">O2sat</p>
            <p className="text-xs font-medium">{formatVitalValue(row.O2SAT, "%")}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-flow-muted">
            Chief Complaint
          </p>
          <p className="min-h-[4rem] whitespace-pre-wrap rounded-lg border border-flow-border/70 bg-white p-3 text-xs leading-relaxed text-flow-text">
            {formatHistoryText(row.CC)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-flow-muted">
            Clinical Data
          </p>
          <p className="min-h-[4rem] whitespace-pre-wrap rounded-lg border border-flow-border/70 bg-white p-3 text-xs leading-relaxed text-flow-text">
            {formatHistoryText(row.PE || row.DIAG_TEXT)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-flow-muted">HPI</p>
          <p className="min-h-[4rem] whitespace-pre-wrap rounded-lg border border-flow-border/70 bg-white p-3 text-xs leading-relaxed text-flow-text">
            {formatHistoryText(row.HPI)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-flow-muted">Doctor Note</p>
          <p className="min-h-[4rem] whitespace-pre-wrap rounded-lg border border-flow-border/70 bg-white p-3 text-xs leading-relaxed text-flow-text">
            {formatHistoryText(row.NOTE)}
          </p>
        </div>
      </div>
    </article>
  );
}

function groupTreatmentByDay<T extends { HN: string; VISIT_TYPE: string }>(
  rows: T[],
  getDateIso: (row: T) => string,
  groupByHn: boolean
): TreatmentDayGroup<T>[] {
  const map = new Map<string, TreatmentDayGroup<T>>();
  for (const row of rows) {
    const dateIso = getDateIso(row);
    if (!dateIso) continue;
    const key = groupByHn ? diagDayGroupKey(String(row.HN), dateIso) : dateIso;
    let group = map.get(key);
    if (!group) {
      group = { key, dateIso, hn: String(row.HN), visitTypes: [], items: [] };
      map.set(key, group);
    }
    if (row.VISIT_TYPE && !group.visitTypes.includes(row.VISIT_TYPE)) {
      group.visitTypes.push(row.VISIT_TYPE);
    }
    group.items.push(row);
  }
  return Array.from(map.values()).sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}

function pickInitialTreatmentTab(counts: Record<TreatmentTab, number>): TreatmentTab {
  for (const tab of TREATMENT_TABS) {
    if (counts[tab.id] > 0) return tab.id;
  }
  return "drug";
}

function treatmentRowDateIso(tab: TreatmentTab, row: Record<string, unknown>): string {
  switch (tab) {
    case "drug":
      return apiDateToIsoLocal(row.PRSCDATE);
    case "lab":
      return apiDateToIsoLocal(row.LAB_DATE);
    case "xray":
      return apiDateToIsoLocal(row.XRAY_DATE);
    case "history":
      return apiDateToIsoLocal(row.VSTDATE);
    case "diag":
      return apiDateToIsoLocal(row.DIAG_DATE);
    default:
      return "";
  }
}

function rowMatchesVisitFilter(visitType: string | null | undefined, filter: "all" | "OPD" | "IPD") {
  if (filter === "all") return true;
  if (!visitType) return true;
  return visitType === filter;
}

function isoToBuddhistYear(iso: string): number {
  return Number(iso.slice(0, 4)) + 543;
}

function matchesSelectedYears(iso: string, selectedYears: string[]): boolean {
  if (selectedYears.length === 0) return true;
  return selectedYears.includes(String(isoToBuddhistYear(iso)));
}

function matchesSelectedDates(iso: string, selectedDates: string[]): boolean {
  if (selectedDates.length === 0) return true;
  return selectedDates.includes(iso);
}

function matchesDateFilters(iso: string, selectedYears: string[], selectedDates: string[]): boolean {
  if (!iso) return false;
  if (!matchesSelectedYears(iso, selectedYears)) return false;
  return matchesSelectedDates(iso, selectedDates);
}

export default function PatientMedicationSearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvedHn, setResolvedHn] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PatientMedicationRow[]>([]);
  const [labRows, setLabRows] = useState<PatientLabRow[]>([]);
  const [xrayRows, setXrayRows] = useState<PatientXrayRow[]>([]);
  const [historyRows, setHistoryRows] = useState<PatientHistoryRow[]>([]);
  const [diagRows, setDiagRows] = useState<PatientDiagnosisRow[]>([]);
  const [selectedDiagDayKey, setSelectedDiagDayKey] = useState<string | null>(null);
  const [selectedDrugDayKey, setSelectedDrugDayKey] = useState<string | null>(null);
  const [selectedLabDayKey, setSelectedLabDayKey] = useState<string | null>(null);
  const [selectedHistoryDayKey, setSelectedHistoryDayKey] = useState<string | null>(null);
  const [contentTab, setContentTab] = useState<TreatmentTab>("drug");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [filterVisitType, setFilterVisitType] = useState<"all" | "OPD" | "IPD">("all");
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patientCandidates, setPatientCandidates] = useState<PatientCandidate[]>([]);
  const [nameSearchQuery, setNameSearchQuery] = useState("");
  const [patientPickerLoading, setPatientPickerLoading] = useState(false);
  const [patientPickerNotice, setPatientPickerNotice] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanFiles, setScanFiles] = useState<OpdscanFile[]>([]);
  const [scanHnQuery, setScanHnQuery] = useState("");
  const [scanSubPath, setScanSubPath] = useState("");
  const [scanDirLoading, setScanDirLoading] = useState(false);
  const scanOpenLockRef = useRef(false);
  const scanFileLinkRef = useRef<HTMLAnchorElement>(null);

  const resetResults = () => {
    setRows([]);
    setLabRows([]);
    setXrayRows([]);
    setHistoryRows([]);
    setDiagRows([]);
    setSelectedDiagDayKey(null);
    setSelectedDrugDayKey(null);
    setSelectedLabDayKey(null);
    setSelectedHistoryDayKey(null);
    setSelectedDates([]);
    setSelectedYears([]);
    setFilterVisitType("all");
    setContentTab("drug");
    setResolvedHn("");
  };

  const fetchPatientDetails = async (params: {
    hn?: string;
    cardno?: string;
    name?: string;
  }): Promise<{
    medCount: number;
    labCount: number;
    xrayCount: number;
    historyCount: number;
    diagCount: number;
    totalCount: number;
    errors: string[];
    patientHn: string | null;
  }> => {
    const query = new URLSearchParams();
    if (params.hn) query.set("hn", params.hn);
    if (params.cardno) query.set("cardno", params.cardno);
    if (params.name) query.set("name", params.name);

    const qs = query.toString();
    const [medRes, labRes, xrayRes, historyRes, diagRes] = await Promise.all([
      fetch(`/api/db/patient-medication-search?${qs}`),
      fetch(`/api/db/patient-lab-search?${qs}`),
      fetch(`/api/db/patient-xray-search?${qs}`),
      fetch(`/api/db/patient-history-search?${qs}`),
      fetch(`/api/db/patient-diagnosis-search?${qs}`),
    ]);
    const [medJson, labJson, xrayJson, historyJson, diagJson] = await Promise.all([
      medRes.json(),
      labRes.json(),
      xrayRes.json(),
      historyRes.json(),
      diagRes.json(),
    ]);

    const errors: string[] = [];

    const readData = <T,>(
      res: Response,
      json: { success?: boolean; message?: string; data?: T[] },
      setter: (rows: T[]) => void,
      fallbackMessage: string
    ): T[] => {
      if (!res.ok || !json.success) {
        errors.push(json.message ?? fallbackMessage);
        setter([]);
        return [];
      }
      const data = Array.isArray(json.data) ? json.data : [];
      setter(data);
      return data;
    };

    const medData = readData(
      medRes,
      medJson,
      setRows,
      "ค้นหารายการยาไม่สำเร็จ"
    );
    const labData = readData(labRes, labJson, setLabRows, "ค้นหารายการ Lab ไม่สำเร็จ");
    const xrayData = readData(
      xrayRes,
      xrayJson,
      setXrayRows,
      "ค้นหารายการ X-ray ไม่สำเร็จ"
    );
    const historyData = readData(
      historyRes,
      historyJson,
      setHistoryRows,
      "ค้นหาการซักประวัติไม่สำเร็จ"
    );
    const diagData = readData(
      diagRes,
      diagJson,
      setDiagRows,
      "ค้นหารหัสวินิจฉัยไม่สำเร็จ"
    );
        const counts: Record<TreatmentTab, number> = {
      drug: medData.length,
      lab: labData.length,
      xray: xrayData.length,
      history: historyData.length,
      diag: countDiagVisitDays(diagData, "all", new Set(diagData.map((row) => row.HN)).size > 1),
    };

    setContentTab(pickInitialTreatmentTab(counts));

    const patientHn =
      medData[0]?.HN ??
      labData[0]?.HN ??
      xrayData[0]?.HN ??
      historyData[0]?.HN ??
      diagData[0]?.HN ??
      params.hn ??
      null;

    if (patientHn) {
      setResolvedHn(formatHnDisplay(patientHn));
      if (!params.hn) {
        setSearchQuery(formatHnDisplay(patientHn));
      }
      setScanError(null);
    }

    const totalCount = Object.values(counts).reduce((sum, n) => sum + n, 0);

    return {
      medCount: counts.drug,
      labCount: counts.lab,
      xrayCount: counts.xray,
      historyCount: counts.history,
      diagCount: counts.diag,
      totalCount,
      errors,
      patientHn,
    };
  };

  const closePatientModal = () => {
    setShowPatientModal(false);
    setPatientCandidates([]);
    setNameSearchQuery("");
    setPatientPickerLoading(false);
    setPatientPickerNotice(null);
  };

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    resetResults();
    closePatientModal();

    const parsed = parsePatientSearchQuery(searchQuery);

    if (parsed.kind === "empty") {
      setLoading(false);
      setError("กรุณาระบุ HN, เลขบัตรประชาชน หรือชื่อ-นามสกุล");
      return;
    }

    const needsPatientPicker = parsed.kind === "name";

    try {
      if (needsPatientPicker) {
        const res = await fetch(
          `/api/db/patient-search-by-name?name=${encodeURIComponent(parsed.name)}`
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
        setNameSearchQuery(parsed.name);
        setPatientPickerNotice(null);
        setShowPatientModal(true);
        return;
      }

      await fetchPatientDetails({
        hn: parsed.kind === "hn" ? parsed.hn : undefined,
        cardno: parsed.kind === "cardno" ? parsed.cardno : undefined,
      }).then((result) => {
        if (result.totalCount === 0) {
          if (result.errors.length > 0) {
            setError(result.errors.join(" · "));
          } else {
            setError("ไม่พบข้อมูลการรักษา");
          }
        } else if (result.errors.length > 0) {
          setError(`โหลดบางส่วนไม่สำเร็จ: ${result.errors.join(" · ")}`);
        }
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = async (patient: PatientCandidate) => {
    setPatientPickerLoading(true);
    setPatientPickerNotice(null);
    setError(null);
    resetResults();

    try {
      const result = await fetchPatientDetails({ hn: patient.HN });

      if (result.totalCount === 0) {
        const displayName = patient.DSPNAME ?? "(ไม่ระบุชื่อ)";
        setPatientPickerNotice(
          result.errors.length > 0
            ? result.errors.join(" · ")
            : `${displayName} · HN ${formatHnDisplay(patient.HN)} — ไม่พบข้อมูลการรักษา`
        );
        return;
      }

      if (result.errors.length > 0) {
        setError(`โหลดบางส่วนไม่สำเร็จ: ${result.errors.join(" · ")}`);
      }

      closePatientModal();
    } catch (fetchError) {
      setPatientPickerNotice(
        fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด"
      );
    } finally {
      setPatientPickerLoading(false);
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
    setScanHnQuery("");
    setScanSubPath("");
    setScanDirLoading(false);
    setScanError(null);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setError(null);
    resetResults();
    closePatientModal();
    closeScanModal();
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
    setScanSubPath(json.subPath ?? subPath);
    setScanHnQuery(hnValue);
    setShowScanModal(true);
  };

  const openOpdscan = async () => {
    const hnValue = scanHnFromSearchQuery(searchQuery, resolvedHn);
    if (!hnValue) return;

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

    if (scanOpenLockRef.current) return;
    scanOpenLockRef.current = true;
    window.setTimeout(() => {
      scanOpenLockRef.current = false;
    }, 1200);

    const link = scanFileLinkRef.current;
    if (!link) return;
    link.href = url;
    link.click();
  };

  const scanBreadcrumbs = useMemo(() => {
    if (!scanSubPath) return [];
    return scanSubPath.split("\\").filter(Boolean);
  }, [scanSubPath]);

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

  const tabCounts = useMemo(() => {
    const countWithVisit = <T extends { VISIT_TYPE?: string }>(items: T[]) =>
      items.filter((row) => rowMatchesVisitFilter(row.VISIT_TYPE, filterVisitType)).length;

    return {
      drug: countWithVisit(rows),
      lab: countWithVisit(labRows),
      xray: countWithVisit(xrayRows),
      history: countWithVisit(historyRows),
      diag: countDiagVisitDays(
        diagRows,
        filterVisitType,
        new Set(diagRows.map((row) => row.HN)).size > 1
      ),
    };
  }, [rows, labRows, xrayRows, historyRows, diagRows, filterVisitType]);

  const activeSourceRows = useMemo(() => {
    switch (contentTab) {
      case "drug":
        return rows;
      case "lab":
        return labRows;
      case "xray":
        return xrayRows;
      case "history":
        return historyRows;
      case "diag":
        return diagRows;
      default:
        return [];
    }
  }, [contentTab, rows, labRows, xrayRows, historyRows, diagRows]);

  const activeDates = useMemo(() => {
    const set = new Set<string>();
    for (const row of activeSourceRows) {
      const visitType = "VISIT_TYPE" in row ? row.VISIT_TYPE : null;
      if (!rowMatchesVisitFilter(visitType, filterVisitType)) continue;
      const iso = treatmentRowDateIso(contentTab, row as unknown as Record<string, unknown>);
      if (iso) set.add(iso);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [activeSourceRows, contentTab, filterVisitType]);

  const activeYears = useMemo(() => {
    const years = new Set<number>();
    for (const iso of activeDates) {
      years.add(isoToBuddhistYear(iso));
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [activeDates]);

  const datesInSelectedYears = useMemo(() => {
    return activeDates.filter((iso) => matchesSelectedYears(iso, selectedYears));
  }, [activeDates, selectedYears]);

  useEffect(() => {
    setSelectedDates((prev) => {
      const allowed = new Set(datesInSelectedYears);
      const next = prev.filter((d) => allowed.has(d));
      return next.length === prev.length ? prev : next;
    });
  }, [datesInSelectedYears]);

  const activeTabMeta = TREATMENT_TABS.find((tab) => tab.id === contentTab) ?? TREATMENT_TABS[0];

  const handleContentTabChange = (tab: TreatmentTab) => {
    setContentTab(tab);
    setSelectedDates([]);
    setSelectedYears([]);
    setSelectedDiagDayKey(null);
    setSelectedDrugDayKey(null);
    setSelectedLabDayKey(null);
    setSelectedHistoryDayKey(null);
  };

  const handleVisitTypeChange = (type: "all" | "OPD" | "IPD") => {
    setFilterVisitType(type);
    setSelectedDates([]);
    setSelectedYears([]);

    setSelectedDiagDayKey(null);
    setSelectedDrugDayKey(null);
    setSelectedLabDayKey(null);
    setSelectedHistoryDayKey(null);

    const nextCounts: Record<TreatmentTab, number> = {
      drug: rows.filter((row) => rowMatchesVisitFilter(row.VISIT_TYPE, type)).length,
      lab: labRows.filter((row) => rowMatchesVisitFilter(row.VISIT_TYPE, type)).length,
      xray: xrayRows.filter((row) => rowMatchesVisitFilter(row.VISIT_TYPE, type)).length,
      history: historyRows.filter((row) => rowMatchesVisitFilter(row.VISIT_TYPE, type)).length,
      diag: countDiagVisitDays(diagRows, type, new Set(diagRows.map((row) => row.HN)).size > 1),
    };

    if (nextCounts[contentTab] === 0) {
      setContentTab(pickInitialTreatmentTab(nextCounts));
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!rowMatchesVisitFilter(row.VISIT_TYPE, filterVisitType)) return false;
      const iso = apiDateToIsoLocal(row.PRSCDATE);
      return matchesDateFilters(iso, selectedYears, selectedDates);
    });
  }, [rows, selectedDates, selectedYears, filterVisitType]);

  const filteredLabRows = useMemo(() => {
    return labRows.filter((row) => {
      if (!rowMatchesVisitFilter(row.VISIT_TYPE, filterVisitType)) return false;
      const iso = apiDateToIsoLocal(row.LAB_DATE);
      return matchesDateFilters(iso, selectedYears, selectedDates);
    });
  }, [labRows, selectedDates, selectedYears, filterVisitType]);

  const filteredXrayRows = useMemo(() => {
    return xrayRows.filter((row) => {
      if (!rowMatchesVisitFilter(row.VISIT_TYPE, filterVisitType)) return false;
      const iso = apiDateToIsoLocal(row.XRAY_DATE);
      return matchesDateFilters(iso, selectedYears, selectedDates);
    });
  }, [xrayRows, selectedDates, selectedYears, filterVisitType]);

  const filteredHistoryRows = useMemo(() => {
    return historyRows.filter((row) => {
      if (!rowMatchesVisitFilter(row.VISIT_TYPE, filterVisitType)) return false;
      const iso = apiDateToIsoLocal(row.VSTDATE);
      return matchesDateFilters(iso, selectedYears, selectedDates);
    });
  }, [historyRows, selectedDates, selectedYears, filterVisitType]);

  const filteredDiagRows = useMemo(() => {
    return diagRows.filter((row) => {
      if (!rowMatchesVisitFilter(row.VISIT_TYPE, filterVisitType)) return false;
      const iso = apiDateToIsoLocal(row.DIAG_DATE);
      return matchesDateFilters(iso, selectedYears, selectedDates);
    });
  }, [diagRows, selectedDates, selectedYears, filterVisitType]);

  const groupedDiagDays = useMemo(
    () =>
      groupDiagnosisByDay(
        filteredDiagRows,
        new Set(filteredDiagRows.map((row) => row.HN)).size > 1
      ),
    [filteredDiagRows]
  );

  useEffect(() => {
    if (groupedDiagDays.length === 0) {
      setSelectedDiagDayKey(null);
    setSelectedDrugDayKey(null);
    setSelectedLabDayKey(null);
    setSelectedHistoryDayKey(null);
      return;
    }
    if (!selectedDiagDayKey || !groupedDiagDays.some((g) => g.key === selectedDiagDayKey)) {
      setSelectedDiagDayKey(groupedDiagDays[0].key);
    }
  }, [groupedDiagDays, selectedDiagDayKey]);

  const selectedDiagDay = useMemo(
    () => groupedDiagDays.find((group) => group.key === selectedDiagDayKey) ?? null,
    [groupedDiagDays, selectedDiagDayKey]
  );

  const drugGroupByHn = useMemo(
    () => new Set(filteredRows.map((row) => row.HN)).size > 1,
    [filteredRows]
  );

  const groupedDrugDays = useMemo(
    () => groupTreatmentByDay(filteredRows, (row) => apiDateToIsoLocal(row.PRSCDATE), drugGroupByHn),
    [filteredRows, drugGroupByHn]
  );

  useEffect(() => {
    if (groupedDrugDays.length === 0) {
      setSelectedDrugDayKey(null);
      return;
    }
    if (!selectedDrugDayKey || !groupedDrugDays.some((g) => g.key === selectedDrugDayKey)) {
      setSelectedDrugDayKey(groupedDrugDays[0].key);
    }
  }, [groupedDrugDays, selectedDrugDayKey]);

  const selectedDrugDay = useMemo(
    () => groupedDrugDays.find((group) => group.key === selectedDrugDayKey) ?? null,
    [groupedDrugDays, selectedDrugDayKey]
  );

  const labGroupByHn = useMemo(
    () => new Set(filteredLabRows.map((row) => row.HN)).size > 1,
    [filteredLabRows]
  );

  const groupedLabDays = useMemo(
    () => groupTreatmentByDay(filteredLabRows, (row) => apiDateToIsoLocal(row.LAB_DATE), labGroupByHn),
    [filteredLabRows, labGroupByHn]
  );

  useEffect(() => {
    if (groupedLabDays.length === 0) {
      setSelectedLabDayKey(null);
    setSelectedHistoryDayKey(null);
      return;
    }
    if (!selectedLabDayKey || !groupedLabDays.some((g) => g.key === selectedLabDayKey)) {
      setSelectedLabDayKey(groupedLabDays[0].key);
    }
  }, [groupedLabDays, selectedLabDayKey]);

  const selectedLabDay = useMemo(
    () => groupedLabDays.find((group) => group.key === selectedLabDayKey) ?? null,
    [groupedLabDays, selectedLabDayKey]
  );

  const historyGroupByHn = useMemo(
    () => new Set(filteredHistoryRows.map((row) => row.HN)).size > 1,
    [filteredHistoryRows]
  );

  const groupedHistoryDays = useMemo(
    () =>
      groupTreatmentByDay(filteredHistoryRows, (row) => apiDateToIsoLocal(row.VSTDATE), historyGroupByHn),
    [filteredHistoryRows, historyGroupByHn]
  );

  useEffect(() => {
    if (groupedHistoryDays.length === 0) {
      setSelectedHistoryDayKey(null);
      return;
    }
    if (!selectedHistoryDayKey || !groupedHistoryDays.some((g) => g.key === selectedHistoryDayKey)) {
      setSelectedHistoryDayKey(groupedHistoryDays[0].key);
    }
  }, [groupedHistoryDays, selectedHistoryDayKey]);

  const selectedHistoryDay = useMemo(
    () => groupedHistoryDays.find((group) => group.key === selectedHistoryDayKey) ?? null,
    [groupedHistoryDays, selectedHistoryDayKey]
  );

  const patientHeader = useMemo(() => {
    const source = [
      ...rows,
      ...labRows,
      ...xrayRows,
      ...historyRows,
      ...diagRows,
    ];
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
  }, [rows, labRows, xrayRows, historyRows, diagRows]);

  const hasResults =
    rows.length > 0 ||
    labRows.length > 0 ||
    xrayRows.length > 0 ||
    historyRows.length > 0 ||
    diagRows.length > 0;
  const scanHnValue = scanHnFromSearchQuery(searchQuery, resolvedHn);

  return (
    <>
      <main className="min-h-0 flex-1 w-full overflow-y-auto px-4 py-6 md:px-6 md:py-8">
        <header className="-mx-4 mb-6 border-b border-flow-border bg-white px-4 py-4 md:-mx-6 md:px-6">
          <h1 className="text-xl font-bold text-flow-text md:text-2xl">ข้อมูลการรักษา</h1>
          <p className="mt-1 text-xs text-flow-muted md:text-sm">
            ค้นหาด้วย HN, เลขบัตร 13 หลัก หรือชื่อ-นามสกุล — ดูข้อมูลยา, Lab, X-ray, ซักประวัติ, รหัสวินิจฉัย
          </p>
        </header>

        <section className="mb-6">
          <form
            className="space-y-4 rounded-xl border border-accent-border bg-white p-4 shadow-sm"
            onSubmit={handleSearch}
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-flow-text" htmlFor="med-search">
                  ค้นหาผู้ป่วย
                </label>
                <input
                  className="ui-input w-full px-3 py-1.5 text-sm"
                  id="med-search"
                  placeholder="HN, เลขบัตร 13 หลัก หรือชื่อ-นามสกุล"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setScanError(null);
                  }}
                />
              </div>
              <button
                className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
                type="submit"
              >
                {loading ? "กำลังค้นหา..." : "ค้นหา"}
              </button>
              <button
                className="shrink-0 rounded-lg border border-flow-border bg-white px-4 py-2 text-sm font-medium text-flow-text hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading || scanLoading}
                type="button"
                onClick={handleClearSearch}
              >
                ล้างค่าค้นหา
              </button>
              <button
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-500 bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={scanLoading || !scanHnValue}
                title="ไฟล์สแกน OPD"
                type="button"
                onClick={() => void openOpdscan()}
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                {scanLoading ? "กำลังเปิด..." : "เปิดไฟล์สแกน"}
              </button>
              {scanError ? (
                <p className="w-full basis-full text-xs text-red-600">{scanError}</p>
              ) : null}
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

        <section className="mb-4 rounded-xl border border-flow-border bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-flow-text">
              {patientHeader && !patientHeader.multiple ? (
                <>
                  <span className="font-semibold">{patientHeader.dspname ?? "(ไม่ระบุชื่อ)"}</span>
                  <span className="text-flow-muted">·</span>
                  <span>HN {formatHnDisplay(patientHeader.hn)}</span>
                  {patientHeader.cardno ? (
                    <>
                      <span className="text-flow-muted">·</span>
                      <span>บัตร {patientHeader.cardno}</span>
                    </>
                  ) : null}
                </>
              ) : patientHeader?.multiple ? (
                <span className="text-flow-muted">
                  พบผู้ป่วย {patientHeader.patientCount} ราย — แสดงข้อมูลการรักษาที่ตรงเงื่อนไข
                </span>
              ) : (
                <span className="text-flow-muted">ค้นหาผู้ป่วยเพื่อแสดงข้อมูล</span>
              )}
              <span className="mx-1 hidden h-5 w-px bg-flow-border sm:block" />
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

            <div className="flex w-full flex-wrap items-end gap-2 sm:ml-auto sm:w-auto sm:justify-end">
              <div className="min-w-[10rem] flex-1 sm:w-44 sm:flex-none">
                <p className="mb-1 text-[11px] text-flow-muted">ปี (พ.ศ.)</p>
                <MultiSelectFilter
                  formatOption={(year) => {
                    const count = activeDates.filter(
                      (iso) => isoToBuddhistYear(iso) === Number(year)
                    ).length;
                    return `${year} (${count} วัน)`;
                  }}
                  label="ปี (พ.ศ.)"
                  options={activeYears.map(String)}
                  selected={selectedYears}
                  onChange={setSelectedYears}
                />
              </div>
              <div className="min-w-[10rem] flex-1 sm:w-44 sm:flex-none">
                <p className="mb-1 text-[11px] text-flow-muted">วันที่</p>
                <MultiSelectFilter
                  formatOption={isoToThaiInput}
                  label="วันที่"
                  options={datesInSelectedYears}
                  selected={selectedDates}
                  onChange={setSelectedDates}
                />
              </div>
            </div>
          </div>

          {hasResults && activeDates.length === 0 ? (
            <p className="mb-3 text-xs text-flow-muted">
              ไม่พบข้อมูลในหมวด {activeTabMeta.label} ตามตัวกรองที่เลือก
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {TREATMENT_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  contentTab === tab.id
                    ? "bg-brand-600 text-white"
                    : "border border-flow-border bg-white text-flow-text hover:bg-slate-50"
                }`}
                type="button"
                onClick={() => handleContentTabChange(tab.id)}
              >
                {tab.label} ({tabCounts[tab.id]})
              </button>
            ))}
          </div>
        </section>

        {contentTab === "drug" && (
            <section className="overflow-hidden rounded-xl border border-flow-border bg-white shadow-sm">
              {groupedDrugDays.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-flow-muted">
                  {tabEmptyMessage(hasResults, "ไม่มีรายการยาในวันที่เลือก")}
                </p>
              ) : (
                <div className="flex min-h-[16rem] flex-col md:flex-row">
                  <div className="border-b border-flow-border md:w-72 md:shrink-0 md:border-b-0 md:border-r">
                    <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                      วันสั่งยา
                    </p>
                    <ul className="max-h-[28rem] overflow-y-auto">
                      {groupedDrugDays.map((group) => {
                        const selected = selectedDrugDayKey === group.key;

                        return (
                          <li key={group.key}>
                            <button
                              className={`w-full truncate border-b border-flow-border/60 px-3 py-2 text-left text-xs transition-colors last:border-b-0 ${
                                selected
                                  ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200"
                                  : "text-flow-text hover:bg-slate-50"
                              }`}
                              type="button"
                              onClick={() => setSelectedDrugDayKey(group.key)}
                            >
                              <span className="font-medium">{isoToThaiDisplay(group.dateIso)}</span>
                              {patientHeader?.multiple ? (
                                <span className="text-flow-muted"> · HN {formatHnDisplay(group.hn)}</span>
                              ) : null}
                              <span className="text-flow-muted">
                                {" "}
                                · {group.items.length} รายการ · {formatVisitTypes(group.visitTypes)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                      รายการยา
                      {selectedDrugDay ? (
                        <span className="ml-2 font-normal normal-case text-flow-text">
                          — {isoToThaiDisplay(selectedDrugDay.dateIso)}
                        </span>
                      ) : null}
                    </p>
                    {selectedDrugDay ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-flow-muted">
                            <tr>
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
                            {selectedDrugDay.items.map((row, index) => {
                              const rowKey = `${selectedDrugDay.key}-${row.MEDITEM}-${row.CLINIC_LCT}-${row.AN ?? ""}-${row.DRUG_USAGE ?? ""}-${index}`;

                              return (
                                <tr key={rowKey} className="hover:bg-slate-50/80">
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
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="px-4 py-6 text-center text-xs text-flow-muted">
                        เลือกวันที่จากรายการด้านซ้าย
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>
            )}

            {contentTab === "lab" && (
            <section className="overflow-hidden rounded-xl border border-flow-border bg-white shadow-sm">
              {groupedLabDays.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-flow-muted">
                  {tabEmptyMessage(hasResults, "ไม่มีรายการ Lab ในวันที่เลือก")}
                </p>
              ) : (
                <div className="flex min-h-[16rem] flex-col md:flex-row">
                  <div className="border-b border-flow-border md:w-72 md:shrink-0 md:border-b-0 md:border-r">
                    <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                      วันที่ตรวจ
                    </p>
                    <ul className="max-h-[28rem] overflow-y-auto">
                      {groupedLabDays.map((group) => {
                        const selected = selectedLabDayKey === group.key;

                        return (
                          <li key={group.key}>
                            <button
                              className={`w-full truncate border-b border-flow-border/60 px-3 py-2 text-left text-xs transition-colors last:border-b-0 ${
                                selected
                                  ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200"
                                  : "text-flow-text hover:bg-slate-50"
                              }`}
                              type="button"
                              onClick={() => setSelectedLabDayKey(group.key)}
                            >
                              <span className="font-medium">{isoToThaiDisplay(group.dateIso)}</span>
                              {patientHeader?.multiple ? (
                                <span className="text-flow-muted"> · HN {formatHnDisplay(group.hn)}</span>
                              ) : null}
                              <span className="text-flow-muted">
                                {" "}
                                · {group.items.length} รายการ · {formatVisitTypes(group.visitTypes)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                      ผล Lab
                      {selectedLabDay ? (
                        <span className="ml-2 font-normal normal-case text-flow-text">
                          — {isoToThaiDisplay(selectedLabDay.dateIso)}
                        </span>
                      ) : null}
                    </p>
                    {selectedLabDay ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-flow-muted">
                            <tr>
                              {patientHeader?.multiple ? <th className="px-3 py-2">HN</th> : null}
                              {patientHeader?.multiple ? <th className="px-3 py-2">ชื่อ</th> : null}
                              <th className="px-3 py-2">ประเภท</th>
                              <th className="px-3 py-2">ชื่อการตรวจ</th>
                              <th className="px-3 py-2">ผล</th>
                              <th className="px-3 py-2">ค่าอ้างอิง</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-flow-border">
                            {selectedLabDay.items.map((row, index) => {
                              const rowKey = `${selectedLabDay.key}-${row.LABEXM}-${row.AN ?? ""}-${index}`;

                              return (
                                <tr key={rowKey} className="hover:bg-slate-50/80">
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
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="px-4 py-6 text-center text-xs text-flow-muted">
                        เลือกวันที่จากรายการด้านซ้าย
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>
            )}

            {contentTab === "xray" && (
            <section className="overflow-hidden rounded-xl border border-flow-border bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-flow-muted">
                    <tr>
                      <th className="px-3 py-2">วันที่</th>
                      {patientHeader?.multiple ? <th className="px-3 py-2">HN</th> : null}
                      <th className="px-3 py-2">ประเภท</th>
                      <th className="px-3 py-2">รหัส</th>
                      <th className="px-3 py-2">รายการ X-ray</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-flow-border">
                    {filteredXrayRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-flow-muted" colSpan={patientHeader?.multiple ? 5 : 4}>
                          {tabEmptyMessage(hasResults, "ไม่มีรายการ X-ray ในวันที่เลือก")}
                        </td>
                      </tr>
                    ) : (
                      filteredXrayRows.map((row, index) => {
                        const dateIso = apiDateToIsoLocal(row.XRAY_DATE);
                        return (
                          <tr key={`${row.HN}-${dateIso}-${row.RDOEXM}-${index}`} className="hover:bg-slate-50/80">
                            <td className="whitespace-nowrap px-3 py-2">{isoToThaiDisplay(dateIso)}</td>
                            {patientHeader?.multiple ? (
                              <td className="whitespace-nowrap px-3 py-2">{formatHnDisplay(row.HN)}</td>
                            ) : null}
                            <td className="whitespace-nowrap px-3 py-2">
                              {row.VISIT_TYPE}{row.AN ? ` · ${row.AN}` : ""}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono">{row.RDOEXM ?? "—"}</td>
                            <td className="min-w-[14rem] px-3 py-2">{row.EXAM_NAME ?? row.RDOEXM ?? "—"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            )}

            {contentTab === "history" && (
            <section className="overflow-hidden rounded-xl border border-flow-border bg-white shadow-sm">
              {groupedHistoryDays.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-flow-muted">
                  {tabEmptyMessage(hasResults, "ไม่มีข้อมูลการซักประวัติในวันที่เลือก")}
                </p>
              ) : (
                <div className="flex min-h-[16rem] flex-col md:flex-row">
                  <div className="border-b border-flow-border md:w-72 md:shrink-0 md:border-b-0 md:border-r">
                    <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                      วันที่มา
                    </p>
                    <ul className="max-h-[28rem] overflow-y-auto">
                      {groupedHistoryDays.map((group) => {
                        const selected = selectedHistoryDayKey === group.key;

                        return (
                          <li key={group.key}>
                            <button
                              className={`w-full truncate border-b border-flow-border/60 px-3 py-2 text-left text-xs transition-colors last:border-b-0 ${
                                selected
                                  ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200"
                                  : "text-flow-text hover:bg-slate-50"
                              }`}
                              type="button"
                              onClick={() => setSelectedHistoryDayKey(group.key)}
                            >
                              <span className="font-medium">{isoToThaiDisplay(group.dateIso)}</span>
                              {patientHeader?.multiple ? (
                                <span className="text-flow-muted"> · HN {formatHnDisplay(group.hn)}</span>
                              ) : null}
                              <span className="text-flow-muted">
                                {" "}
                                · {group.items.length} ครั้ง · {formatVisitTypes(group.visitTypes)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                      การซักประวัติ
                      {selectedHistoryDay ? (
                        <span className="ml-2 font-normal normal-case text-flow-text">
                          — {isoToThaiDisplay(selectedHistoryDay.dateIso)}
                        </span>
                      ) : null}
                    </p>
                    {selectedHistoryDay ? (
                      <div className="max-h-[32rem] overflow-y-auto">
                        {selectedHistoryDay.items.map((row, index) => (
                          <HistoryVisitCard key={`${selectedHistoryDay.key}-${row.VN ?? index}`} row={row} />
                        ))}
                      </div>
                    ) : (
                      <p className="px-4 py-6 text-center text-xs text-flow-muted">
                        เลือกวันที่จากรายการด้านซ้าย
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>
            )}

            {contentTab === "diag" && (
            <section className="overflow-hidden rounded-xl border border-flow-border bg-white shadow-sm">
              {groupedDiagDays.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-flow-muted">
                  {tabEmptyMessage(hasResults, "ไม่มีรหัสวินิจฉัยในวันที่เลือก")}
                </p>
              ) : (
                <div className="flex min-h-[16rem] flex-col md:flex-row">
                  <div className="border-b border-flow-border md:w-72 md:shrink-0 md:border-b-0 md:border-r">
                    <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                      วันที่ visit
                    </p>
                    <ul className="max-h-[28rem] overflow-y-auto">
                      {groupedDiagDays.map((group) => {
                        const selected = selectedDiagDayKey === group.key;

                        return (
                          <li key={group.key}>
                            <button
                              className={`w-full truncate border-b border-flow-border/60 px-3 py-2 text-left text-xs transition-colors last:border-b-0 ${
                                selected
                                  ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200"
                                  : "text-flow-text hover:bg-slate-50"
                              }`}
                              type="button"
                              onClick={() => setSelectedDiagDayKey(group.key)}
                            >
                              <span className="font-medium">{isoToThaiDisplay(group.dateIso)}</span>
                              {patientHeader?.multiple ? (
                                <span className="text-flow-muted"> · HN {formatHnDisplay(group.hn)}</span>
                              ) : null}
                              <span className="text-flow-muted">
                                {" "}
                                · {group.codes.length} รหัส · {formatVisitTypes(group.visitTypes)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                      รหัสวินิจฉัย
                      {selectedDiagDay ? (
                        <span className="ml-2 font-normal normal-case text-flow-text">
                          — {isoToThaiDisplay(selectedDiagDay.dateIso)}
                        </span>
                      ) : null}
                    </p>
                    {selectedDiagDay ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-flow-muted">
                            <tr>
                              <th className="px-3 py-2">ICD-10</th>
                              <th className="px-3 py-2">ชื่อโรค</th>
                              <th className="px-3 py-2">Diag type</th>
                              <th className="px-3 py-2">VN/AN</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-flow-border">
                            {selectedDiagDay.codes.map((row, index) => (
                              <tr
                                key={`${selectedDiagDay.key}-${row.ICD10}-${row.VISIT_REF}-${index}`}
                                className="hover:bg-slate-50/80"
                              >
                                <td className="whitespace-nowrap px-3 py-2 font-mono">{row.ICD10 ?? "—"}</td>
                                <td className="min-w-[14rem] px-3 py-2">{row.ICD10_NAME ?? "—"}</td>
                                <td className="whitespace-nowrap px-3 py-2">{row.DIAGTYPE ?? "—"}</td>
                                <td className="whitespace-nowrap px-3 py-2 font-mono">{row.VISIT_REF ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="px-4 py-6 text-center text-xs text-flow-muted">
                        เลือกวันที่จากรายการด้านซ้าย
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>
            )}
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
            {patientPickerNotice ? (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                {patientPickerNotice}
              </div>
            ) : null}
            <div className="relative max-h-[calc(85vh-4rem)] overflow-auto">
              {patientPickerLoading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                  <p className="text-sm text-flow-muted">กำลังโหลด...</p>
                </div>
              ) : null}
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
                      className={`cursor-pointer hover:bg-brand-50/60 ${patientPickerLoading ? "pointer-events-none opacity-60" : ""}`}
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
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={patientPickerLoading}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handlePatientSelect(patient);
                          }}
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
                            : "cursor-pointer hover:bg-slate-50/80"
                        }
                        title={
                          file.isDirectory
                            ? "ดับเบิลคลิกเพื่อเปิดโฟลเดอร์"
                            : "ดับเบิลคลิกเพื่อเปิดไฟล์"
                        }
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (file.isDirectory) {
                            openScanFolder(file.name);
                          } else {
                            openScanFile(file.name);
                          }
                        }}
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
                                event.preventDefault();
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

      <a
        ref={scanFileLinkRef}
        className="hidden"
        href="#"
        tabIndex={-1}
        target={OPDSCAN_VIEWER_TARGET}
      />
    </>
  );
}
