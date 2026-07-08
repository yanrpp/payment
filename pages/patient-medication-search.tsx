"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, FileText, Printer } from "lucide-react";

import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import {
  OpdscanExplorerModal,
  type OpdscanFileEntry,
} from "@/components/opdscan/OpdscanExplorerModal";
import { isoToThaiDisplay, isoToThaiInput } from "@/lib/date/thaiDate";
import {
  DIAG_TYPE_LEGEND,
  formatDiagTypeLabel,
  parseCnopdcardDiag,
} from "@/lib/db/cnopdcardDiag";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { normalizeHnInput } from "@/lib/hn/normalize";
import { buildOpdscanUncPath } from "@/lib/opdscan/path";
import { parsePatientSearchQuery, scanHnFromSearchQuery } from "@/lib/patient/parseSearchQuery";
import {
  buildPatientDrugRepeatPrintHtml,
  formatPrescriptionNo,
  type PatientDrugRepeatPrintPayload,
} from "@/lib/print/patientDrugRepeat";
import type { PatientRegistrationData } from "@/pages/api/db/patient-registration";

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
  DRUG_GENERIC_NAME: string | null;
  DRUG_STRENGTH: string | null;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
  PTTYPE_NAME: string | null;
  DRUG_USAGE: string | null;
  DRUG_DOSE: string | null;
  MEDUSETYPE_NAME: string | null;
  MEDUSEQTY_NAME: string | null;
  MEDUSETIME_NAME: string | null;
  MEDSYMPTOM_NAME: string | null;
  MEDUSEUNIT_NAME: string | null;
  MEDLBLHLP1: string | null;
  MEDLBLHLP_NAME: string | null;
  MEDLBLHLP2_NAME: string | null;
  MEDNOTE: string | null;
  PRSCDTEXT_MEDUSAGE: string | null;
  TPUCODE: string | null;
  PRSCNO: string | null;
  DOCTOR_NAME: string | null;
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
  ICD10_NAME_EN: string | null;
  DIAGTYPE: string | null;
  VISIT_REF: string | null;
  DIAG_AID: string | null;
  DOCTOR_NAME: string | null;
  CNOPDCARD_DIAG: string | null;
  CNOPDCARD_DIAG1: string | null;
  CNOPDCARD_DIAG2: string | null;
};

type DiagnosisVisitGroup = {
  vn: string;
  rows: PatientDiagnosisRow[];
  clinicalLeft: string | null;
  clinicalRight: string | null;
  diagnosisNote: string | null;
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

/** วันที่ visit — ใช้ YYYY-MM-DD จาก API โดยตรง กันคลาดเคลื่อนจาก timezone */
function historyDateIso(value: unknown): string {
  if (value == null) return "";
  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoMatch) return isoMatch[1];

  return apiDateToIsoLocal(value);
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

const DRUG_USAGE_DETAIL_FIELDS: {
  key: keyof Pick<
    PatientMedicationRow,
    "MEDUSETYPE_NAME" | "MEDUSEQTY_NAME" | "MEDUSETIME_NAME" | "MEDSYMPTOM_NAME" | "MEDNOTE"
  >;
  label: string;
}[] = [
  { key: "MEDUSETYPE_NAME", label: "ประเภทการใช้" },
  { key: "MEDUSEQTY_NAME", label: "ปริมาณต่อครั้ง" },
  { key: "MEDUSETIME_NAME", label: "ความถี่" },
  { key: "MEDSYMPTOM_NAME", label: "เงื่อนไข/เวลา" },
  { key: "MEDNOTE", label: "หมายเหตุ" },
];

function appendLabelHelpText(base: string, row: PatientMedicationRow): string {
  let text = base;

  for (const part of [row.MEDLBLHLP_NAME, row.MEDLBLHLP2_NAME]) {
    const help = part?.trim();

    if (!help || text.includes(help)) continue;
    text = text ? `${text} ${help}` : help;
  }

  return text;
}

function formatMedusageText(row: PatientMedicationRow): string {
  const fromPrscdtext = row.PRSCDTEXT_MEDUSAGE?.trim();

  if (fromPrscdtext) return appendLabelHelpText(fromPrscdtext, row);
  const fromMaster = row.DRUG_USAGE?.trim();

  if (fromMaster) return fromMaster;
  const fromHelp = [row.MEDLBLHLP_NAME, row.MEDLBLHLP2_NAME]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return fromHelp || "—";
}

function formatDrugUsageBreakdown(row: PatientMedicationRow, compact = false): ReactNode {
  const lines = DRUG_USAGE_DETAIL_FIELDS.map(({ key, label }) => {
    const value = String(row[key] ?? "").trim();

    if (!value) return null;

    return { label, value };
  }).filter((line): line is { label: string; value: string } => line != null);

  if (lines.length === 0) {
    const fallback = row.DRUG_USAGE?.trim();

    return fallback || "—";
  }

  if (compact) {
    return (
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0">
        {lines.map(({ label, value }) => (
          <div key={label} className="min-w-0 leading-tight">
            <dt className="inline text-[9px] text-flow-muted">{label} </dt>
            <dd className="inline text-[11px] text-flow-text">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="space-y-0.5">
      {lines.map(({ label, value }) => (
        <div key={label} className="flex gap-1.5">
          <dt className="shrink-0 text-[10px] text-flow-muted">{label}</dt>
          <dd className="min-w-0 text-xs text-flow-text">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatQty(value: unknown): string {
  const n = Number(value ?? 0);

  return Number.isInteger(n) ? String(n) : n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function buildDrugRowKey(
  dayKey: string,
  row: PatientMedicationRow,
  index: number
): string {
  return `${dayKey}-${row.MEDITEM}-${row.CLINIC_LCT}-${row.AN ?? ""}-${row.DRUG_USAGE ?? ""}-${index}`;
}

function formatLabReference(row: PatientLabRow): string {
  const min = row.MIN_NRM?.trim();
  const max = row.MAX_NRM?.trim();
  const unit = row.NRM_UNIT?.trim();

  if (!min && !max) return "—";
  const range = min && max ? `${min} - ${max}` : (min ?? max ?? "");

  return unit ? `${range} ${unit}` : range;
}

const OPDSCAN_VIEWER_TARGET = "rpp_opdscan_viewer";

const SEARCH_PROMPT = 'ระบุเงื่อนไขค้นหาแล้วกด "ค้นหา"';
const NO_TREATMENT_DATA_MESSAGE =
  "ไม่พบข้อมูลการรักษา (คาดว่ายังไม่ได้บันทึกในระบบ e-Phis)";

function tabEmptyMessage(hasResults: boolean, filteredMessage: string): string {
  return hasResults ? filteredMessage : SEARCH_PROMPT;
}
type TreatmentTab = "register" | "drug" | "lab" | "history" | "diag";

const TREATMENT_TABS: { id: TreatmentTab; label: string; dateLabel: string }[] = [
  { id: "register", label: "ทะเบียน", dateLabel: "" },
  { id: "drug", label: "ยา", dateLabel: "วันที่มียา" },
  { id: "lab", label: "Lab", dateLabel: "วันที่มี Lab" },
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

function groupDiagnosisByDay(rows: PatientDiagnosisRow[], groupByHn: boolean): DiagnosisDayGroup[] {
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

function VisitTypeBadge({ visitType, an }: { visitType: string; an?: string | null }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
        visitType === "IPD" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"
      }`}
    >
      {visitType}
      {an ? ` · ${an}` : ""}
    </span>
  );
}

function isNonFormularyDrug(accnation: string | null | undefined): boolean {
  const name = String(accnation ?? "").trim();

  return name.startsWith("ยานอก");
}

function normalizeDrugLabel(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("th-TH");
}

function shouldShowGenericName(
  tradeName: string | null | undefined,
  genericName: string | null | undefined
): boolean {
  const generic = String(genericName ?? "").trim();

  if (!generic) return false;

  return normalizeDrugLabel(generic) !== normalizeDrugLabel(tradeName);
}

function shouldShowDrugStrength(
  tradeName: string | null | undefined,
  genericName: string | null | undefined,
  strength: string | null | undefined
): boolean {
  const value = String(strength ?? "").trim();

  if (!value) return false;

  const normalizedStrength = normalizeDrugLabel(value);
  const trade = normalizeDrugLabel(tradeName);
  const generic = normalizeDrugLabel(genericName);

  if (trade.includes(normalizedStrength) || generic.includes(normalizedStrength)) {
    return false;
  }

  return true;
}

function DrugNameDisplay({
  row,
  tradeClassName = "text-flow-text",
  genericClassName = "text-[11px] text-flow-muted",
}: {
  row: Pick<
    PatientMedicationRow,
    "DRUG_NAME" | "DRUG_GENERIC_NAME" | "DRUG_STRENGTH" | "ACCNATION"
  >;
  tradeClassName?: string;
  genericClassName?: string;
}) {
  const nonFormulary = isNonFormularyDrug(row.ACCNATION);
  const tradeTextClass = nonFormulary ? "text-sky-600" : tradeClassName;
  const genericTextClass = nonFormulary ? "text-sky-600" : genericClassName;
  const showGeneric = shouldShowGenericName(row.DRUG_NAME, row.DRUG_GENERIC_NAME);
  const showStrength = shouldShowDrugStrength(
    row.DRUG_NAME,
    row.DRUG_GENERIC_NAME,
    row.DRUG_STRENGTH
  );
  const strengthBadgeClass = nonFormulary
    ? "bg-sky-50 text-sky-700 ring-sky-200"
    : "bg-slate-100 text-flow-text ring-slate-200";

  return (
    <div className="space-y-0.5">
      <div className={`flex flex-wrap items-center gap-1.5 ${tradeTextClass}`}>
        <span>{row.DRUG_NAME?.trim() ? row.DRUG_NAME : "—"}</span>
        {showStrength ? (
          <span
            className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${strengthBadgeClass}`}
          >
            {row.DRUG_STRENGTH}
          </span>
        ) : null}
      </div>
      {showGeneric ? (
        <div className={`leading-snug ${genericTextClass}`}>{row.DRUG_GENERIC_NAME}</div>
      ) : null}
    </div>
  );
}

function MobileBackBar({
  label,
  onBack,
  show,
}: {
  label: string;
  onBack: () => void;
  show: boolean;
}) {
  if (!show) return null;

  return (
    <button
      className="flex w-full items-center gap-1 border-b border-flow-border bg-white px-3 py-2.5 text-left text-xs font-medium text-brand-700 touch-manipulation active:bg-slate-50 md:hidden"
      type="button"
      onClick={onBack}
    >
      <ChevronLeft className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

function TreatmentDayButton({
  selected,
  isMobile,
  dateIso,
  metaLine,
  onSelect,
}: {
  selected: boolean;
  isMobile: boolean;
  dateIso: string;
  metaLine: string;
  onSelect: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors touch-manipulation ${
        selected
          ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200"
          : "text-flow-text hover:bg-slate-50 active:bg-slate-100"
      }`}
      type="button"
      onClick={onSelect}
    >
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{isoToThaiDisplay(dateIso)}</span>
        <span className="text-flow-muted"> · {metaLine}</span>
      </span>
      {isMobile ? <ChevronRight className="h-4 w-4 shrink-0 text-flow-muted" /> : null}
    </button>
  );
}

function DrugItemCard({ row, showPatient }: { row: PatientMedicationRow; showPatient: boolean }) {
  const medusageText = formatMedusageText(row);

  return (
    <article className="space-y-1.5 px-3 py-2">
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <DrugNameDisplay
            row={row}
            tradeClassName="text-xs font-semibold leading-tight text-flow-text"
            genericClassName="text-[11px] leading-snug text-flow-muted"
          />
          {row.DRUG_DOSE?.trim() ? (
            <p className="mt-0.5 text-[11px] text-flow-muted">โดสยา {row.DRUG_DOSE}</p>
          ) : null}
          {showPatient ? (
            <p className="mt-0.5 truncate text-[10px] text-flow-muted">
              HN {formatHnDisplay(row.HN)}
              {row.DSPNAME ? ` · ${row.DSPNAME}` : ""}
            </p>
          ) : null}
        </div>
        <VisitTypeBadge an={row.AN} visitType={row.VISIT_TYPE} />
      </div>

      <div className="rounded bg-slate-50 px-2 py-1">
        <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-flow-muted">
          วิธีกินยา
        </p>
        {formatDrugUsageBreakdown(row, true)}
      </div>

      {medusageText !== "—" ? (
        <p className="text-[11px] leading-snug text-flow-muted">
          <span className="font-medium text-flow-text">วิธีใช้:</span> {medusageText}
        </p>
      ) : null}

      <p className="flex flex-wrap gap-x-2 gap-y-0 text-[10px] leading-tight text-flow-muted">
        <span>
          <span className="font-medium text-flow-text">สิทธิ</span>{" "}
          {row.PTTYPE_NAME?.trim() ? row.PTTYPE_NAME : "—"}
        </span>
        <span className="text-slate-300">·</span>
        <span>
          <span className="font-medium text-flow-text">จำนวน</span> {formatQty(row.TOTAL_QTY)}
        </span>
        <span className="text-slate-300">·</span>
        <span>
          <span className="font-medium text-flow-text">หมวด</span> {row.MEDTYPE ?? "—"}
        </span>
        <span className="text-slate-300">·</span>
        <span className="min-w-0">
          <span className="font-medium text-flow-text">คลินิก</span>{" "}
          {row.CLINIC_LCT_NAME ?? row.CLINIC_LCT ?? "—"}
        </span>
      </p>
    </article>
  );
}

function LabItemCard({
  row,
  showPatient,
}: {
  row: PatientLabRow;
  showPatient: boolean;
}) {
  const reference = formatLabReference(row);

  return (
    <article className="space-y-2 border-b border-flow-border px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-flow-text">
          {row.LAB_NAME ?? "—"}
        </h3>
        <VisitTypeBadge an={row.AN} visitType={row.VISIT_TYPE} />
      </div>

      {showPatient ? (
        <p className="text-xs text-flow-muted">
          HN {formatHnDisplay(row.HN)}
          {row.DSPNAME ? ` · ${row.DSPNAME}` : ""}
        </p>
      ) : null}

      <p className="text-sm font-medium text-flow-text">
        <span className="text-xs font-medium text-flow-muted">ผล:</span>{" "}
        {row.RESULT?.trim() ? row.RESULT : "—"}
      </p>

      {reference !== "—" ? (
        <p className="text-xs text-flow-muted">
          <span className="font-medium text-flow-text">ค่าอ้างอิง:</span> {reference}
        </p>
      ) : null}
    </article>
  );
}

function joinUniqueClinicalTexts(parts: (string | null | undefined)[]): string | null {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const part of parts) {
    const text = part?.trim();

    if (!text || seen.has(text)) continue;
    seen.add(text);
    items.push(text);
  }

  return items.length > 0 ? items.join("\n\n—\n\n") : null;
}

function mergeDiagnosisVisits(visits: DiagnosisVisitGroup[]): DiagnosisVisitGroup {
  if (visits.length === 0) {
    return { vn: "—", rows: [], clinicalLeft: null, clinicalRight: null, diagnosisNote: null };
  }

  if (visits.length === 1) return visits[0];

  return {
    vn: visits.map((visit) => visit.vn).join(", "),
    rows: visits.flatMap((visit) => visit.rows),
    clinicalLeft: joinUniqueClinicalTexts(visits.map((visit) => visit.clinicalLeft)),
    clinicalRight: joinUniqueClinicalTexts(visits.map((visit) => visit.clinicalRight)),
    diagnosisNote: joinUniqueClinicalTexts(visits.map((visit) => visit.diagnosisNote)),
  };
}

function buildDiagnosisDayPanel(rows: PatientDiagnosisRow[]): DiagnosisVisitGroup {
  return mergeDiagnosisVisits(groupDiagnosisByVisit(rows));
}

function groupDiagnosisByVisit(rows: PatientDiagnosisRow[]): DiagnosisVisitGroup[] {
  const map = new Map<string, PatientDiagnosisRow[]>();

  for (const row of rows) {
    const vn = String(row.VISIT_REF ?? row.AN ?? "—");
    const bucket = map.get(vn);

    if (bucket) bucket.push(row);
    else map.set(vn, [row]);
  }

  return Array.from(map.entries()).map(([vn, visitRows]) => {
    const primary = visitRows[0];
    const parsed = parseCnopdcardDiag(primary?.CNOPDCARD_DIAG);

    return {
      vn,
      rows: visitRows,
      clinicalLeft: primary?.CNOPDCARD_DIAG1?.trim() || null,
      clinicalRight:
        parsed.clinicalData ||
        primary?.CNOPDCARD_DIAG2?.trim() ||
        null,
      diagnosisNote: parsed.diagnosisText,
    };
  });
}

const TABLE_HEAD_CLASS =
  "bg-slate-700 text-[11px] font-semibold uppercase tracking-wide text-white";

function ClinicalDataBox({ text }: { text: string | null }) {
  return (
    <div className="min-h-[7rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className={`${TABLE_HEAD_CLASS} border-b border-white/10 px-3 py-2`}>
        Clinical Data
      </div>
      <div className="max-h-48 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-xs leading-relaxed text-flow-text">
        {text?.trim() ? text : "—"}
      </div>
    </div>
  );
}

function resolveClinicalDataText(visit: DiagnosisVisitGroup): string | null {
  return joinUniqueClinicalTexts([visit.clinicalLeft, visit.clinicalRight]);
}

function FieldLine({
  label,
  value,
  className = "",
}: {
  label: string;
  value?: string | number | null;
  className?: string;
}) {
  const text = value == null || String(value).trim() === "" ? "—" : String(value);

  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-flow-muted">{label}</p>
      <p className="mt-0.5 break-words text-sm text-flow-text">{text}</p>
    </div>
  );
}

function RegistrationPanel({ data }: { data: PatientRegistrationData }) {
  const allergyOptions = [
    { code: 1, label: "ไม่ทราบประวัติการแพ้ยา" },
    { code: 2, label: "ไม่มีประวัติการแพ้ยา" },
    { code: 3, label: "มีประวัติแพ้ยา" },
  ] as const;

  return (
    <div className="space-y-4 p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-flow-text">
        <span>
          <span className="text-flow-muted">HN</span>{" "}
          <span className="font-semibold">{formatHnDisplay(data.HN)}</span>
        </span>
        <span className="font-semibold text-brand-700">{data.DSPNAME ?? "—"}</span>
        <span>
          <span className="text-flow-muted">เพศ</span> {data.SEX_NAME ?? "—"}
        </span>
        <span>
          <span className="text-flow-muted">อายุ [y-m-d]</span> {data.AGE_YMD ?? "—"}
        </span>
        {data.VIP_NAME ? <span className="text-flow-muted">{data.VIP_NAME}</span> : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className={`${TABLE_HEAD_CLASS} px-3 py-2`}>ชื่อ-นามสกุล</header>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <FieldLine label="ชื่อ" value={data.FNAME} />
            <FieldLine label="นามสกุล" value={data.LNAME} />
            <FieldLine label="คำนำหน้า" value={data.PREFIX_NAME} />
            <FieldLine label="เพศ" value={data.SEX_NAME} />
            <FieldLine label="ชื่อเล่น" value={data.NICKNAME} />
            <FieldLine label="สังกัด" value={data.BELONG_NAME} />
            <FieldLine label="ชื่อ (อังกฤษ)" value={data.EFNAME} />
            <FieldLine label="นามสกุล (อังกฤษ)" value={data.ELNAME} />
            <FieldLine label="ชื่อกลาง" value={data.MIDDLENAME} />
            <FieldLine label="VIP / กลุ่มพิเศษ" value={data.VIP_NAME} />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className={`${TABLE_HEAD_CLASS} px-3 py-2`}>ข้อมูลจำเพาะ</header>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <FieldLine
              label="วัน/เดือน/ปี เกิด"
              value={data.BRTHDATE ? isoToThaiInput(data.BRTHDATE) : null}
            />
            <FieldLine label="อายุ [y-m-d]" value={data.AGE_YMD} />
            <FieldLine label="เชื้อชาติ" value={data.NTNLTY_NAME} />
            <FieldLine label="สัญชาติ" value={data.CTZSHP_NAME} />
            <FieldLine label="ศาสนา" value={data.RLGN_NAME} />
            <FieldLine label="สถานภาพ" value={data.MRTLST_NAME} />
            <FieldLine label="หมู่เลือด" value={data.BLOODGRP_NAME} />
            <FieldLine label="อาชีพ" value={data.OCCPTN_NAME} />
            <FieldLine className="sm:col-span-2" label="รูปพรรณสัณฐาน" value={data.PTMORPHOLOGY} />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className={`${TABLE_HEAD_CLASS} px-3 py-2`}>
            เลขบัตรประชาชน / ต่างด้าว / หนังสือเดินทาง
          </header>
          <div className="space-y-3 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLine label="ประเภทบัตร" value={data.NOTYPE_NAME} />
              <FieldLine label="เลขที่บัตร" value={data.CARDNO} />
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-flow-muted">
                ประวัติการแพ้ยา
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-flow-text">
                {allergyOptions.map((option) => {
                  const checked = data.ALLERGYST === option.code;

                  return (
                    <span
                      key={option.code}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                        checked
                          ? "bg-brand-100 font-semibold text-brand-800 ring-1 ring-inset ring-brand-200"
                          : "bg-slate-50 text-flow-muted ring-1 ring-inset ring-slate-200"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`h-2 w-2 rounded-full ${checked ? "bg-brand-600" : "bg-slate-300"}`}
                      />
                      {option.label}
                    </span>
                  );
                })}
              </div>
              {data.ALLERGY?.trim() ? (
                <p className="mt-2 text-xs text-flow-muted">รายละเอียด: {data.ALLERGY}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className={`${TABLE_HEAD_CLASS} px-3 py-2`}>ที่อยู่ปัจจุบัน</header>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <FieldLine className="sm:col-span-2" label="ที่อยู่" value={data.ADDRESS} />
            <FieldLine label="ซอย" value={data.SOI} />
            <FieldLine label="ถนน" value={data.STREET} />
            <FieldLine
              className="sm:col-span-2"
              label="ตำบล / อำเภอ / จังหวัด"
              value={data.DISTRICT_TEXT}
            />
            <FieldLine label="รหัสไปรษณีย์" value={data.ZIPCODE} />
            <FieldLine label="ประเทศ" value={data.COUNTRY_NAME} />
            <FieldLine label="โทรศัพท์มือถือ" value={data.MOBILE_PHONE ?? data.PHONE} />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className={`${TABLE_HEAD_CLASS} px-3 py-2`}>บุคคลอ้างอิง</header>
        {data.INFORMERS.length === 0 ? (
          <p className="px-3 py-4 text-xs text-flow-muted">ไม่มีข้อมูลบุคคลอ้างอิง</p>
        ) : (
          <div className="divide-y divide-flow-border">
            {data.INFORMERS.map((person, index) => (
              <div
                key={`${person.ITEMNO ?? index}-${person.FIRST_NAME}-${person.LAST_NAME}`}
                className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <FieldLine
                  label="ชื่อ-นามสกุล"
                  value={[person.PREFIX_NAME, person.FIRST_NAME, person.LAST_NAME]
                    .filter(Boolean)
                    .join(" ")}
                />
                <FieldLine label="ความสัมพันธ์" value={person.RELATION_NAME} />
                <FieldLine label="ที่อยู่" value={person.ADDRESS} />
                <FieldLine label="โทรศัพท์" value={person.MOBILE_PHONE ?? person.PHONE} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DiagnosisTypeLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-flow-muted">
      {DIAG_TYPE_LEGEND.map((item) => (
        <span key={item.code}>
          <span className="font-semibold text-flow-text">{item.code}</span> = {item.label}
        </span>
      ))}
    </div>
  );
}

function DiagnosisEphisTable({ rows }: { rows: PatientDiagnosisRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
      <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className={TABLE_HEAD_CLASS}>
          <tr>
            <th className="w-10 border-r border-white/10 px-2 py-2.5 text-center">No.</th>
            <th className="w-20 border-r border-white/10 px-2 py-2.5">ICD10</th>
            <th className="border-r border-white/10 px-2 py-2.5">Diagnosis (ICD10)</th>
            <th className="border-r border-white/10 px-2 py-2.5">ชื่อภาษาไทย</th>
            <th className="w-16 border-r border-white/10 px-2 py-2.5">DiagType</th>
            <th className="min-w-[10rem] border-r border-white/10 px-2 py-2.5">
              แพทย์ผู้วินิจฉัย
            </th>
            <th className="w-28 px-2 py-2.5">VN</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.VISIT_REF}-${row.ICD10}-${row.DIAGTYPE}-${index}`}
              className="border-t border-slate-200 bg-white hover:bg-slate-50/80"
            >
              <td className="px-2 py-1.5 text-center align-top text-flow-muted">
                {index + 1}
              </td>
              <td className="px-2 py-1.5 align-top font-mono text-flow-text">
                {row.ICD10 ?? "—"}
              </td>
              <td className="px-2 py-1.5 align-top text-flow-text">
                {row.ICD10_NAME_EN ?? row.ICD10_NAME ?? "—"}
              </td>
              <td className="px-2 py-1.5 align-top text-flow-muted">
                {row.ICD10_NAME ?? "—"}
              </td>
              <td className="px-2 py-1.5 text-center align-top font-medium text-flow-text">
                {row.DIAGTYPE ?? "—"}
              </td>
              <td className="px-2 py-1.5 align-top text-flow-text">
                {row.DOCTOR_NAME ?? "—"}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 align-top font-mono text-flow-text">
                {row.VISIT_REF ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function DiagnosisVisitPanel({ visit }: { visit: DiagnosisVisitGroup }) {
  return (
    <div className="space-y-3">
      <ClinicalDataBox text={resolveClinicalDataText(visit)} />
      <DiagnosisTypeLegend />
      <DiagnosisEphisTable rows={visit.rows} />
    </div>
  );
}

function DiagnosisItemCard({ row }: { row: PatientDiagnosisRow }) {
  return (
    <article className="space-y-2 border-b border-flow-border px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-sm font-semibold text-flow-text">{row.ICD10 ?? "—"}</p>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-flow-muted">
          {formatDiagTypeLabel(row.DIAGTYPE)}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug text-flow-text">
        {row.ICD10_NAME_EN ?? row.ICD10_NAME ?? "—"}
      </p>
      {row.ICD10_NAME_EN && row.ICD10_NAME ? (
        <p className="text-xs text-flow-muted">{row.ICD10_NAME}</p>
      ) : null}
      <div className="grid gap-1 text-xs text-flow-muted sm:grid-cols-2">
        <span>
          <span className="font-medium text-flow-text">คำช่วย:</span> {row.DIAG_AID ?? "—"}
        </span>
        <span>
          <span className="font-medium text-flow-text">แพทย์:</span> {row.DOCTOR_NAME ?? "—"}
        </span>
        <span>
          <span className="font-medium text-flow-text">VN/AN:</span>{" "}
          <span className="font-mono">{row.VISIT_REF ?? "—"}</span>
        </span>
        {row.VISIT_TYPE ? (
          <span>
            <VisitTypeBadge an={row.AN} visitType={row.VISIT_TYPE} />
          </span>
        ) : null}
      </div>
    </article>
  );
}

function formatVitalValue(value: number | null | undefined, unit?: string): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const text = Number.isInteger(Number(value))
    ? String(value)
    : Number(value).toLocaleString("th-TH", { maximumFractionDigits: 1 });

  return unit ? `${text} ${unit}` : text;
}

function formatBloodPressure(
  bps: number | null | undefined,
  bpd: number | null | undefined
): string {
  if (bps == null && bpd == null) return "—";
  if (bps != null && bpd != null) return `${bps}/${bpd} mmHg`;

  return String(bps ?? bpd);
}

function formatHistoryText(value: string | null | undefined): string {
  const text = String(value ?? "").trim();

  return text || "—";
}

function HistoryVisitCard({ row }: { row: PatientHistoryRow }) {
  const dateIso = historyDateIso(row.VSTDATE);

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
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-flow-muted">
          Vital Signs
        </p>
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
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-flow-muted">
            HPI
          </p>
          <p className="min-h-[4rem] whitespace-pre-wrap rounded-lg border border-flow-border/70 bg-white p-3 text-xs leading-relaxed text-flow-text">
            {formatHistoryText(row.HPI)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-flow-muted">
            Doctor Note
          </p>
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

function groupHistoryByDay(
  rows: PatientHistoryRow[],
  groupByHn: boolean
): TreatmentDayGroup<PatientHistoryRow>[] {
  const map = new Map<string, TreatmentDayGroup<PatientHistoryRow>>();

  for (const row of rows) {
    const dateIso = historyDateIso(row.VSTDATE);

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

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      items: group.items.filter((row) => historyDateIso(row.VSTDATE) === group.dateIso),
    }))
    .filter((group) => group.items.length > 0)
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}

function pickInitialTreatmentTab(counts: Record<TreatmentTab, number>): TreatmentTab {
  for (const tab of TREATMENT_TABS) {
    if (tab.id === "register") continue;
    if (counts[tab.id] > 0) return tab.id;
  }

  return counts.register > 0 ? "register" : "drug";
}

function treatmentRowDateIso(tab: TreatmentTab, row: Record<string, unknown>): string {
  switch (tab) {
    case "register":
      return "";
    case "drug":
      return apiDateToIsoLocal(row.PRSCDATE);
    case "lab":
      return apiDateToIsoLocal(row.LAB_DATE);
    case "history":
      return historyDateIso(row.VSTDATE);
    case "diag":
      return apiDateToIsoLocal(row.DIAG_DATE);
    default:
      return "";
  }
}

function rowMatchesVisitFilter(
  visitType: string | null | undefined,
  filter: "all" | "OPD" | "IPD"
) {
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

function matchesDateFilters(
  iso: string,
  selectedYears: string[],
  selectedDates: string[]
): boolean {
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
  const [historyRows, setHistoryRows] = useState<PatientHistoryRow[]>([]);
  const [diagRows, setDiagRows] = useState<PatientDiagnosisRow[]>([]);
  const [registration, setRegistration] = useState<PatientRegistrationData | null>(null);
  const [selectedDiagDayKey, setSelectedDiagDayKey] = useState<string | null>(null);
  const [selectedDrugDayKey, setSelectedDrugDayKey] = useState<string | null>(null);
  const [selectedDrugPrintKeys, setSelectedDrugPrintKeys] = useState<Set<string>>(() => new Set());
  const [drugRepeatPreview, setDrugRepeatPreview] = useState<PatientDrugRepeatPrintPayload | null>(
    null
  );
  const [mobileDrugPanel, setMobileDrugPanel] = useState<"days" | "items">("days");
  const [mobileLabPanel, setMobileLabPanel] = useState<"days" | "items">("days");
  const [mobileHistoryPanel, setMobileHistoryPanel] = useState<"days" | "items">("days");
  const [mobileDiagPanel, setMobileDiagPanel] = useState<"days" | "items">("days");
  const isMobile = useMediaQuery("(max-width: 767px)");
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
  const [scanFiles, setScanFiles] = useState<OpdscanFileEntry[]>([]);
  const [scanHnQuery, setScanHnQuery] = useState("");
  const [scanSubPath, setScanSubPath] = useState("");
  const [scanFolderCache, setScanFolderCache] = useState<Record<string, string[]>>({});
  const [scanDirLoading, setScanDirLoading] = useState(false);
  const [opdscanNotice, setOpdscanNotice] = useState<string | null>(null);
  const [labResultTodayNotice, setLabResultTodayNotice] = useState(false);
  const [labScanSubPath, setLabScanSubPath] = useState<string | null>(null);
  const scanOpenLockRef = useRef(false);
  const scanFileLinkRef = useRef<HTMLAnchorElement>(null);
  const drugRepeatPreviewFrameRef = useRef<HTMLIFrameElement>(null);

  const resetResults = () => {
    setRows([]);
    setLabRows([]);
    setHistoryRows([]);
    setDiagRows([]);
    setRegistration(null);
    setSelectedDiagDayKey(null);
    setSelectedDrugDayKey(null);
    setSelectedDrugPrintKeys(new Set());
    setMobileDrugPanel("days");
    setMobileLabPanel("days");
    setMobileHistoryPanel("days");
    setMobileDiagPanel("days");
    setSelectedLabDayKey(null);
    setSelectedHistoryDayKey(null);
    setSelectedDates([]);
    setSelectedYears([]);
    setFilterVisitType("all");
    setContentTab("drug");
    setResolvedHn("");
    setOpdscanNotice(null);
    setLabResultTodayNotice(false);
    setLabScanSubPath(null);
    setDrugRepeatPreview(null);
  };

  const fetchPatientDetails = async (params: {
    hn?: string;
    cardno?: string;
    name?: string;
  }): Promise<{
    medCount: number;
    labCount: number;
    historyCount: number;
    diagCount: number;
    registerCount: number;
    totalCount: number;
    errors: string[];
    patientHn: string | null;
  }> => {
    const query = new URLSearchParams();

    if (params.hn) query.set("hn", params.hn);
    if (params.cardno) query.set("cardno", params.cardno);
    if (params.name) query.set("name", params.name);

    const qs = query.toString();
    const regQuery = new URLSearchParams();

    if (params.hn) regQuery.set("hn", params.hn);
    if (params.cardno) regQuery.set("cardno", params.cardno);

    const [medRes, labRes, historyRes, diagRes, regRes] = await Promise.all([
      fetch(`/api/db/patient-medication-search?${qs}`),
      fetch(`/api/db/patient-lab-search?${qs}`),
      fetch(`/api/db/patient-history-search?${qs}`),
      fetch(`/api/db/patient-diagnosis-search?${qs}`),
      params.hn || params.cardno
        ? fetch(`/api/db/patient-registration?${regQuery.toString()}`)
        : Promise.resolve(null),
    ]);
    const [medJson, labJson, historyJson, diagJson, regJson] = await Promise.all([
      medRes.json(),
      labRes.json(),
      historyRes.json(),
      diagRes.json(),
      regRes ? regRes.json() : Promise.resolve(null),
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

    const medData = readData(medRes, medJson, setRows, "ค้นหารายการยาไม่สำเร็จ");
    const labData = readData(labRes, labJson, setLabRows, "ค้นหารายการ Lab ไม่สำเร็จ");
    const historyData = readData(
      historyRes,
      historyJson,
      setHistoryRows,
      "ค้นหาการซักประวัติไม่สำเร็จ"
    );
    const diagData = readData(diagRes, diagJson, setDiagRows, "ค้นหารหัสวินิจฉัยไม่สำเร็จ");

    let registrationData: PatientRegistrationData | null = null;

    if (regRes && regJson) {
      if (!regRes.ok || !regJson.success) {
        errors.push(regJson.message ?? "โหลดข้อมูลทะเบียนไม่สำเร็จ");
        setRegistration(null);
      } else {
        registrationData =
          regJson.data && typeof regJson.data === "object"
            ? (regJson.data as PatientRegistrationData)
            : null;
        setRegistration(registrationData);
      }
    } else {
      setRegistration(null);
    }

    const counts: Record<TreatmentTab, number> = {
      register: registrationData ? 1 : 0,
      drug: medData.length,
      lab: labData.length,
      history: historyData.length,
      diag: countDiagVisitDays(diagData, "all", new Set(diagData.map((row) => row.HN)).size > 1),
    };

    setContentTab(pickInitialTreatmentTab(counts));

    let patientHn =
      registrationData?.HN ??
      medData[0]?.HN ??
      labData[0]?.HN ??
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

      if (!registrationData) {
        try {
          const lateRegRes = await fetch(
            `/api/db/patient-registration?hn=${encodeURIComponent(normalizeHnInput(String(patientHn)))}`
          );
          const lateRegJson = await lateRegRes.json();

          if (lateRegRes.ok && lateRegJson.success && lateRegJson.data) {
            registrationData = lateRegJson.data as PatientRegistrationData;
            setRegistration(registrationData);
            counts.register = 1;
          }
        } catch {
          // ไม่บล็อกแท็บอื่นถ้าโหลดทะเบียนไม่ได้
        }
      }
    }

    const totalCount =
      counts.drug + counts.lab + counts.history + counts.diag + counts.register;

    return {
      medCount: counts.drug,
      labCount: counts.lab,
      historyCount: counts.history,
      diagCount: counts.diag,
      registerCount: counts.register,
      totalCount,
      errors,
      patientHn: patientHn ? String(patientHn) : null,
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
      }).then(async (result) => {
        if (result.totalCount === 0) {
          if (result.errors.length > 0) {
            setError(result.errors.join(" · "));
          } else {
            setError(NO_TREATMENT_DATA_MESSAGE);
          }

          await probeOpdscanNotice(resolveHnForOpdscanCheck(parsed, result.patientHn));
        } else {
          setOpdscanNotice(null);
          await probeLabResultToday(resolveHnForOpdscanCheck(parsed, result.patientHn));
          if (result.errors.length > 0) {
            setError(`โหลดบางส่วนไม่สำเร็จ: ${result.errors.join(" · ")}`);
          }
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
        const hnDisplay = formatHnDisplay(patient.HN);
        let notice =
          result.errors.length > 0
            ? result.errors.join(" · ")
            : `${displayName} · HN ${hnDisplay} — ${NO_TREATMENT_DATA_MESSAGE}`;

        const hasScan = await probeOpdscanNotice(hnDisplay);

        if (hasScan) {
          notice += " · พบไฟล์สแกน OPD (ผลแลป/เอกสาร)";
        }

        setPatientPickerNotice(notice);

        return;
      }

      setOpdscanNotice(null);
      await probeLabResultToday(formatHnDisplay(patient.HN));

      if (result.errors.length > 0) {
        setError(`โหลดบางส่วนไม่สำเร็จ: ${result.errors.join(" · ")}`);
      }

      closePatientModal();
    } catch (fetchError) {
      setPatientPickerNotice(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
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

  useEffect(() => {
    if (!drugRepeatPreview) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrugRepeatPreview();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drugRepeatPreview]);

  const closeScanModal = () => {
    setShowScanModal(false);
    setScanFiles([]);
    setScanHnQuery("");
    setScanSubPath("");
    setScanFolderCache({});
    setScanDirLoading(false);
    setScanError(null);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setError(null);
    setOpdscanNotice(null);
    setLabResultTodayNotice(false);
    setLabScanSubPath(null);
    resetResults();
    closePatientModal();
    closeScanModal();
  };

  const resolveHnForOpdscanCheck = (
    parsed: ReturnType<typeof parsePatientSearchQuery>,
    patientHn: string | null
  ): string | null => {
    if (parsed.kind === "hn") return searchQuery.trim();
    if (patientHn) return formatHnDisplay(patientHn);

    return null;
  };

  const probeLabResultToday = async (hnValue: string | null): Promise<void> => {
    if (!hnValue?.trim()) {
      setLabResultTodayNotice(false);
      setLabScanSubPath(null);

      return;
    }

    if (!buildOpdscanUncPath(hnValue, OPDSCAN_UNC_ROOT)) {
      setLabResultTodayNotice(false);
      setLabScanSubPath(null);

      return;
    }

    try {
      const res = await fetch(`/api/opdscan/lab-today?hn=${encodeURIComponent(hnValue)}`);
      const json = (await res.json()) as {
        success?: boolean;
        hasTodayLabFiles?: boolean;
        labFolderName?: string | null;
      };

      if (res.ok && json.success && json.hasTodayLabFiles) {
        setLabResultTodayNotice(true);
        setLabScanSubPath(json.labFolderName ?? "lab");

        return;
      }
    } catch {
      // ignore probe errors
    }

    setLabResultTodayNotice(false);
    setLabScanSubPath(null);
  };

  const probeOpdscanNotice = async (hnValue: string | null): Promise<boolean> => {
    if (!hnValue?.trim()) {
      setOpdscanNotice(null);

      return false;
    }

    if (!buildOpdscanUncPath(hnValue, OPDSCAN_UNC_ROOT)) {
      setOpdscanNotice(null);

      return false;
    }

    try {
      const res = await fetch(`/api/opdscan/check?hn=${encodeURIComponent(hnValue)}`);
      const json = (await res.json()) as {
        success?: boolean;
        hasFiles?: boolean;
      };

      if (res.ok && json.success && json.hasFiles) {
        setOpdscanNotice(
          `${NO_TREATMENT_DATA_MESSAGE} แต่พบไฟล์สแกน OPD (ผลแลป/เอกสาร) ของ HN ${formatHnDisplay(normalizeHnInput(hnValue) || hnValue)} — กด «เปิดไฟล์สแกน» เพื่อดู`
        );

        return true;
      }

      setOpdscanNotice(null);

      return false;
    } catch {
      setOpdscanNotice(null);

      return false;
    }
  };

  const loadScanDirectory = async (hnValue: string, subPath: string) => {
    const params = new URLSearchParams({ hn: hnValue });

    if (subPath) params.set("sub", subPath);

    const res = await fetch(`/api/opdscan/list?${params}`);
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message ?? "เปิดโฟลเดอร์สแกน OPD ไม่สำเร็จ");
    }

    const files: OpdscanFileEntry[] = Array.isArray(json.files) ? json.files : [];

    setScanFiles(files);
    setScanSubPath(json.subPath ?? subPath);
    setScanHnQuery(hnValue);
    setScanFolderCache((prev) => ({
      ...prev,
      [subPath || ""]: files.filter((file) => file.isDirectory).map((file) => file.name),
    }));
    setShowScanModal(true);
  };

  const openOpdscan = async (initialSubPath = "") => {
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
      await loadScanDirectory(hnValue, initialSubPath);
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

  const openScanFile = (relativePath: string) => {
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
      register: registration ? 1 : 0,
      drug: countWithVisit(rows),
      lab: countWithVisit(labRows),
      history: countWithVisit(historyRows),
      diag: countDiagVisitDays(
        diagRows,
        filterVisitType,
        new Set(diagRows.map((row) => row.HN)).size > 1
      ),
    };
  }, [registration, rows, labRows, historyRows, diagRows, filterVisitType]);

  const activeSourceRows = useMemo(() => {
    switch (contentTab) {
      case "register":
        return [];
      case "drug":
        return rows;
      case "lab":
        return labRows;
      case "history":
        return historyRows;
      case "diag":
        return diagRows;
      default:
        return [];
    }
  }, [contentTab, rows, labRows, historyRows, diagRows]);

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
    setMobileDrugPanel("days");
    setMobileLabPanel("days");
    setMobileHistoryPanel("days");
    setMobileDiagPanel("days");
    setSelectedLabDayKey(null);
    setSelectedHistoryDayKey(null);
  };

  const handleVisitTypeChange = (type: "all" | "OPD" | "IPD") => {
    setFilterVisitType(type);
    setSelectedDates([]);
    setSelectedYears([]);

    setSelectedDiagDayKey(null);
    setSelectedDrugDayKey(null);
    setMobileDrugPanel("days");
    setMobileLabPanel("days");
    setMobileHistoryPanel("days");
    setMobileDiagPanel("days");
    setSelectedLabDayKey(null);
    setSelectedHistoryDayKey(null);

    const nextCounts: Record<TreatmentTab, number> = {
      register: registration ? 1 : 0,
      drug: rows.filter((row) => rowMatchesVisitFilter(row.VISIT_TYPE, type)).length,
      lab: labRows.filter((row) => rowMatchesVisitFilter(row.VISIT_TYPE, type)).length,
      history: historyRows.filter((row) => rowMatchesVisitFilter(row.VISIT_TYPE, type)).length,
      diag: countDiagVisitDays(diagRows, type, new Set(diagRows.map((row) => row.HN)).size > 1),
    };

    if (contentTab !== "register" && nextCounts[contentTab] === 0) {
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

  const filteredHistoryRows = useMemo(() => {
    return historyRows.filter((row) => {
      if (!rowMatchesVisitFilter(row.VISIT_TYPE, filterVisitType)) return false;
      const iso = historyDateIso(row.VSTDATE);

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
      setMobileDiagPanel("days");

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

  const selectedDiagPanel = useMemo(
    () => (selectedDiagDay ? buildDiagnosisDayPanel(selectedDiagDay.codes) : null),
    [selectedDiagDay]
  );

  const drugGroupByHn = useMemo(
    () => new Set(filteredRows.map((row) => row.HN)).size > 1,
    [filteredRows]
  );

  const groupedDrugDays = useMemo(
    () =>
      groupTreatmentByDay(filteredRows, (row) => apiDateToIsoLocal(row.PRSCDATE), drugGroupByHn),
    [filteredRows, drugGroupByHn]
  );

  useEffect(() => {
    if (groupedDrugDays.length === 0) {
      setSelectedDrugDayKey(null);
      setMobileDrugPanel("days");

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

  useEffect(() => {
    if (!selectedDrugDay) {
      setSelectedDrugPrintKeys(new Set());

      return;
    }

    setSelectedDrugPrintKeys(
      new Set(
        selectedDrugDay.items.map((row, index) => buildDrugRowKey(selectedDrugDay.key, row, index))
      )
    );
  }, [selectedDrugDay]);

  const selectedDrugPrintItems = useMemo(() => {
    if (!selectedDrugDay) return [];

    return selectedDrugDay.items.filter((row, index) =>
      selectedDrugPrintKeys.has(buildDrugRowKey(selectedDrugDay.key, row, index))
    );
  }, [selectedDrugDay, selectedDrugPrintKeys]);

  const allDrugPrintSelected =
    selectedDrugDay != null &&
    selectedDrugDay.items.length > 0 &&
    selectedDrugPrintItems.length === selectedDrugDay.items.length;

  const toggleDrugPrintRow = (rowKey: string, checked: boolean) => {
    setSelectedDrugPrintKeys((prev) => {
      const next = new Set(prev);

      if (checked) next.add(rowKey);
      else next.delete(rowKey);

      return next;
    });
  };

  const toggleAllDrugPrintRows = (checked: boolean) => {
    if (!selectedDrugDay) return;

    setSelectedDrugPrintKeys(
      checked
        ? new Set(
            selectedDrugDay.items.map((row, index) =>
              buildDrugRowKey(selectedDrugDay.key, row, index)
            )
          )
        : new Set()
    );
  };

  const handlePrintDrugRepeat = () => {
    if (!selectedDrugDay || selectedDrugPrintItems.length === 0) {
      window.alert("กรุณาเลือกรายการยาที่ต้องการพิมพ์");

      return;
    }

    const first = selectedDrugPrintItems[0];
    const prscDateIso = apiDateToIsoLocal(first.PRSCDATE) || selectedDrugDay.dateIso;

    setDrugRepeatPreview({
      hn: formatHnDisplay(first.HN),
      patientName: first.DSPNAME,
      pttypeName: first.PTTYPE_NAME,
      prscDateIso,
      prescriptionNo: formatPrescriptionNo(first.PRSCNO, prscDateIso),
      doctorName: first.DOCTOR_NAME,
      clinicName: first.CLINIC_LCT_NAME ?? first.CLINIC_LCT,
      items: selectedDrugPrintItems,
      logoUrl: `${window.location.origin}/images/ratchaphiphat_logo.png`,
    });
  };

  const closeDrugRepeatPreview = () => {
    setDrugRepeatPreview(null);
  };

  const handleDrugRepeatPreviewPrint = () => {
    const frameWindow = drugRepeatPreviewFrameRef.current?.contentWindow;

    if (!frameWindow) return;

    frameWindow.focus();
    frameWindow.print();
  };

  const drugRepeatPreviewHtml = useMemo(
    () =>
      drugRepeatPreview
        ? buildPatientDrugRepeatPrintHtml(drugRepeatPreview, {
            autoPrint: false,
            preview: true,
          })
        : null,
    [drugRepeatPreview]
  );

  useEffect(() => {
    if (!drugRepeatPreviewHtml) return;

    const iframe = drugRepeatPreviewFrameRef.current;

    if (!iframe) return;

    const syncPreviewHeight = () => {
      const doc = iframe.contentDocument;

      if (!doc?.body) return;

      const sheet = doc.querySelector(".sheet") as HTMLElement | null;
      const contentHeight = sheet?.scrollHeight ?? doc.body.scrollHeight;
      const width = iframe.clientWidth || iframe.getBoundingClientRect().width;

      if (width <= 0) return;

      const maxA4Height = width * (297 / 210);

      iframe.style.height = `${Math.min(contentHeight, maxA4Height)}px`;
    };

    const handleLoad = () => {
      syncPreviewHeight();
      window.setTimeout(syncPreviewHeight, 50);
    };

    iframe.addEventListener("load", handleLoad);
    handleLoad();

    return () => iframe.removeEventListener("load", handleLoad);
  }, [drugRepeatPreviewHtml]);

  const showDrugDayList = !isMobile || mobileDrugPanel === "days";
  const showDrugItems = !isMobile || mobileDrugPanel === "items";

  const handleDrugDaySelect = (key: string) => {
    setSelectedDrugDayKey(key);
    if (isMobile) setMobileDrugPanel("items");
  };

  const showLabDayList = !isMobile || mobileLabPanel === "days";
  const showLabItems = !isMobile || mobileLabPanel === "items";

  const handleLabDaySelect = (key: string) => {
    setSelectedLabDayKey(key);
    if (isMobile) setMobileLabPanel("items");
  };

  const showHistoryDayList = !isMobile || mobileHistoryPanel === "days";
  const showHistoryItems = !isMobile || mobileHistoryPanel === "items";

  const handleHistoryDaySelect = (key: string) => {
    setSelectedHistoryDayKey(key);
    if (isMobile) setMobileHistoryPanel("items");
  };

  const showDiagDayList = !isMobile || mobileDiagPanel === "days";
  const showDiagItems = !isMobile || mobileDiagPanel === "items";

  const handleDiagDaySelect = (key: string) => {
    setSelectedDiagDayKey(key);
    if (isMobile) setMobileDiagPanel("items");
  };

  const labGroupByHn = useMemo(
    () => new Set(filteredLabRows.map((row) => row.HN)).size > 1,
    [filteredLabRows]
  );

  const groupedLabDays = useMemo(
    () =>
      groupTreatmentByDay(filteredLabRows, (row) => apiDateToIsoLocal(row.LAB_DATE), labGroupByHn),
    [filteredLabRows, labGroupByHn]
  );

  useEffect(() => {
    if (groupedLabDays.length === 0) {
      setSelectedLabDayKey(null);
      setMobileLabPanel("days");

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
    () => groupHistoryByDay(filteredHistoryRows, historyGroupByHn),
    [filteredHistoryRows, historyGroupByHn]
  );

  useEffect(() => {
    if (groupedHistoryDays.length === 0) {
      setSelectedHistoryDayKey(null);
      setMobileHistoryPanel("days");

      return;
    }
    if (
      !selectedHistoryDayKey ||
      !groupedHistoryDays.some((g) => g.key === selectedHistoryDayKey)
    ) {
      setSelectedHistoryDayKey(groupedHistoryDays[0].key);
    }
  }, [groupedHistoryDays, selectedHistoryDayKey, selectedDates, selectedYears]);

  const selectedHistoryDay = useMemo(
    () => groupedHistoryDays.find((group) => group.key === selectedHistoryDayKey) ?? null,
    [groupedHistoryDays, selectedHistoryDayKey]
  );

  const selectedHistoryVisits = useMemo(() => {
    if (!selectedHistoryDay) return [];

    return filteredHistoryRows.filter(
      (row) => historyDateIso(row.VSTDATE) === selectedHistoryDay.dateIso
    );
  }, [filteredHistoryRows, selectedHistoryDay]);

  const patientHeader = useMemo(() => {
    if (registration) {
      return {
        multiple: false,
        hn: registration.HN,
        dspname: registration.DSPNAME,
        cardno: registration.CARDNO,
        patientCount: 1,
      };
    }

    const source = [...rows, ...labRows, ...historyRows, ...diagRows];

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
  }, [registration, rows, labRows, historyRows, diagRows]);

  const hasResults =
    Boolean(registration) ||
    rows.length > 0 ||
    labRows.length > 0 ||
    historyRows.length > 0 ||
    diagRows.length > 0;
  const scanHnValue = scanHnFromSearchQuery(searchQuery, resolvedHn);

  return (
    <>
      <main className="min-h-0 flex-1 w-full overflow-y-auto px-4 py-3 md:px-6 md:py-4">
        <header className="-mx-4 mb-3 border-b border-flow-border bg-white px-4 py-2.5 md:-mx-6 md:px-6">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-lg font-bold text-flow-text md:text-xl">ข้อมูลการรักษา</h1>
            {patientHeader && !patientHeader.multiple ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-brand-700 md:text-base dark:text-brand-300">
                  {patientHeader.dspname ?? "(ไม่ระบุชื่อ)"}
                </span>
                <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">
                  HN {formatHnDisplay(patientHeader.hn)}
                </span>
                {patientHeader.cardno ? (
                  <span className="text-xs text-flow-muted">บัตร {patientHeader.cardno}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          {patientHeader?.multiple ? (
            <p className="mt-1 text-xs text-flow-muted">
              พบผู้ป่วย {patientHeader.patientCount} ราย — แสดงข้อมูลการรักษาที่ตรงเงื่อนไข
            </p>
          ) : !patientHeader ? (
            <p className="mt-0.5 text-xs text-flow-muted">
              ค้นหาด้วย HN, เลขบัตร 13 หลัก หรือชื่อ-นามสกุล — ดูข้อมูลยา, Lab, ซักประวัติ,
              รหัสวินิจฉัย
            </p>
          ) : null}
        </header>

        <section className="mb-3">
          <form
            className="rounded-xl border border-accent-border bg-white p-3 shadow-sm"
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
              {!opdscanNotice ? (
                <button
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-500 bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={scanLoading || !scanHnValue}
                  title="ไฟล์สแกน OPD"
                  type="button"
                  onClick={() => void openOpdscan()}
                >
                  <FileText aria-hidden className="h-4 w-4 shrink-0" />
                  {scanLoading ? "กำลังเปิด..." : "เปิดไฟล์สแกน"}
                </button>
              ) : null}
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

        {opdscanNotice ? (
          <div className="mb-4 flex flex-col gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950 sm:flex-row sm:items-center sm:justify-between">
            <p>{opdscanNotice}</p>
            <button
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-sky-500 bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={scanLoading || !scanHnValue}
              title="ไฟล์สแกน OPD"
              type="button"
              onClick={() => void openOpdscan()}
            >
              <FileText aria-hidden className="h-4 w-4 shrink-0" />
              {scanLoading ? "กำลังเปิด..." : "เปิดไฟล์สแกน"}
            </button>
          </div>
        ) : null}

        <section className="mb-3 rounded-xl border border-flow-border bg-white p-3 shadow-sm">
          {contentTab !== "register" ? (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-flow-text">
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
          ) : null}

          {hasResults && contentTab !== "register" && activeDates.length === 0 ? (
            <p className="mb-3 text-xs text-flow-muted">
              ไม่พบข้อมูลในหมวด {activeTabMeta.label} ตามตัวกรองที่เลือก
            </p>
          ) : null}

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x snap-mandatory scrollbar-thin">
            {TREATMENT_TABS.map((tab) => (
              <Fragment key={tab.id}>
                <button
                  className={`shrink-0 snap-start rounded-lg px-3 py-2 text-xs font-medium touch-manipulation ${
                    contentTab === tab.id
                      ? "bg-brand-600 text-white"
                      : "border border-flow-border bg-white text-flow-text hover:bg-slate-50"
                  }`}
                  type="button"
                  onClick={() => handleContentTabChange(tab.id)}
                >
                  {tab.id === "register"
                    ? tab.label
                    : `${tab.label} (${tabCounts[tab.id]})`}
                </button>
                {tab.id === "diag" && labResultTodayNotice && hasResults ? (
                  <button
                    className="inline-flex shrink-0 snap-start animate-pulse items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm ring-2 ring-emerald-300/60 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation"
                    disabled={scanLoading || !scanHnValue}
                    title="เปิดไฟล์ lab ที่อัปโหลดวันนี้"
                    type="button"
                    onClick={() => void openOpdscan(labScanSubPath ?? "lab")}
                  >
                    <FileText aria-hidden className="h-3.5 w-3.5 shrink-0" />
                    {scanLoading ? "กำลังเปิด..." : "ผลแลปออกแล้ว"}
                  </button>
                ) : null}
              </Fragment>
            ))}
          </div>
        </section>

        {contentTab === "register" && (
          <section className="overflow-hidden rounded-xl border border-flow-border bg-white shadow-sm">
            {registration ? (
              <RegistrationPanel data={registration} />
            ) : (
              <p className="px-4 py-6 text-center text-xs text-flow-muted">
                {tabEmptyMessage(hasResults, "ไม่พบข้อมูลทะเบียนผู้ป่วย")}
              </p>
            )}
          </section>
        )}

        {contentTab === "drug" && (
          <section className="overflow-hidden rounded-xl border border-flow-border bg-white shadow-sm">
            {groupedDrugDays.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-flow-muted">
                {tabEmptyMessage(hasResults, "ไม่มีรายการยาในวันที่เลือก")}
              </p>
            ) : (
              <div className="flex min-h-[16rem] flex-col md:flex-row">
                <div
                  className={`border-b border-flow-border md:w-72 md:shrink-0 md:border-b-0 md:border-r ${
                    showDrugDayList ? "block" : "hidden md:block"
                  }`}
                >
                  <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                    วันสั่งยา
                    <span className="ml-2 font-normal normal-case text-flow-muted">
                      ({groupedDrugDays.length} วัน)
                    </span>
                  </p>
                  <ul className="max-h-[28rem] divide-y divide-flow-border overflow-y-auto border-t border-flow-border">
                    {groupedDrugDays.map((group) => (
                      <li key={group.key}>
                        <TreatmentDayButton
                          dateIso={group.dateIso}
                          isMobile={isMobile}
                          metaLine={`${group.items.length} รายการ · ${formatVisitTypes(group.visitTypes)}${
                            patientHeader?.multiple ? ` · HN ${formatHnDisplay(group.hn)}` : ""
                          }`}
                          selected={selectedDrugDayKey === group.key}
                          onSelect={() => handleDrugDaySelect(group.key)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`min-w-0 flex-1 ${showDrugItems ? "block" : "hidden md:block"}`}>
                  <MobileBackBar
                    label="กลับไปวันสั่งยา"
                    show={isMobile && mobileDrugPanel === "items"}
                    onBack={() => setMobileDrugPanel("days")}
                  />
                  <div className="flex flex-col gap-2 border-b border-flow-border bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                      รายการยา
                      {selectedDrugDay ? (
                        <span className="ml-2 font-normal normal-case text-flow-text">
                          — {isoToThaiDisplay(selectedDrugDay.dateIso)}
                          <span className="text-flow-muted">
                            {" "}
                            ({selectedDrugDay.items.length} รายการ)
                          </span>
                        </span>
                      ) : null}
                    </p>
                    {selectedDrugDay ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 text-xs text-flow-text">
                          <input
                            checked={allDrugPrintSelected}
                            className="h-3.5 w-3.5 rounded border-flow-border text-brand-600"
                            type="checkbox"
                            onChange={(event) => toggleAllDrugPrintRows(event.target.checked)}
                          />
                          เลือกทั้งหมด
                        </label>
                        <button
                          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md ring-2 ring-brand-500/30 transition hover:bg-brand-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:ring-0"
                          disabled={selectedDrugPrintItems.length === 0}
                          type="button"
                          onClick={handlePrintDrugRepeat}
                        >
                          <Printer aria-hidden className="h-4 w-4" />
                          พิมพ์ใบยาเดิม ({selectedDrugPrintItems.length})
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {selectedDrugDay ? (
                    <>
                      <div className="hidden overflow-x-auto md:block">
                        <table className="min-w-full text-left text-xs">
                          <thead className={TABLE_HEAD_CLASS}>
                            <tr>
                              <th className="w-10 px-3 py-2.5">
                                <span className="sr-only">เลือกพิมพ์</span>
                              </th>
                              {patientHeader?.multiple ? <th className="px-3 py-2.5">HN</th> : null}
                              {patientHeader?.multiple ? <th className="px-3 py-2.5">ชื่อ</th> : null}
                              <th className="px-3 py-2.5">ประเภท</th>
                              <th className="px-3 py-2.5">ชื่อยา</th>
                              <th className="px-3 py-2.5 text-right">จำนวน</th>
                              <th className="min-w-[14rem] px-3 py-2.5">วิธีกินยา</th>
                              <th className="min-w-[10rem] px-3 py-2.5">ข้อความวิธีใช้</th>
                              <th className="px-3 py-2.5">โดสยา</th>
                              <th className="px-3 py-2.5">สิทธิการรักษา</th>
                              <th className="px-3 py-2.5">หมวด</th>
                              <th className="px-3 py-2.5">คลินิก</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-flow-border">
                            {selectedDrugDay.items.map((row, index) => {
                              const rowKey = buildDrugRowKey(selectedDrugDay.key, row, index);
                              const checked = selectedDrugPrintKeys.has(rowKey);

                              return (
                                <tr key={rowKey} className="hover:bg-slate-50/80">
                                  <td className="px-3 py-2">
                                    <input
                                      aria-label={`เลือกพิมพ์ ${row.DRUG_NAME ?? "รายการยา"}`}
                                      checked={checked}
                                      className="h-3.5 w-3.5 rounded border-flow-border text-brand-600"
                                      type="checkbox"
                                      onChange={(event) =>
                                        toggleDrugPrintRow(rowKey, event.target.checked)
                                      }
                                    />
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
                                    <VisitTypeBadge an={row.AN} visitType={row.VISIT_TYPE} />
                                  </td>
                                  <td className="min-w-[12rem] px-3 py-2">
                                    <DrugNameDisplay row={row} />
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 text-right">
                                    {formatQty(row.TOTAL_QTY)}
                                  </td>
                                  <td className="min-w-[14rem] px-3 py-2 align-top">
                                    {formatDrugUsageBreakdown(row)}
                                  </td>
                                  <td className="min-w-[10rem] px-3 py-2 align-top text-flow-muted">
                                    {formatMedusageText(row)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 text-flow-text">
                                    {row.DRUG_DOSE?.trim() ? row.DRUG_DOSE : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-flow-muted">
                                    {row.PTTYPE_NAME?.trim() ? row.PTTYPE_NAME : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-flow-muted">
                                    {row.MEDTYPE ?? "—"}
                                  </td>
                                  <td className="px-3 py-2 text-flow-muted">
                                    {row.CLINIC_LCT_NAME ?? row.CLINIC_LCT ?? "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="divide-y divide-flow-border md:hidden">
                        {selectedDrugDay.items.map((row, index) => {
                          const rowKey = buildDrugRowKey(selectedDrugDay.key, row, index);
                          const checked = selectedDrugPrintKeys.has(rowKey);

                          return (
                            <div key={rowKey} className="flex gap-2 px-3 py-2">
                              <input
                                aria-label={`เลือกพิมพ์ ${row.DRUG_NAME ?? "รายการยา"}`}
                                checked={checked}
                                className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-flow-border text-brand-600"
                                type="checkbox"
                                onChange={(event) =>
                                  toggleDrugPrintRow(rowKey, event.target.checked)
                                }
                              />
                              <div className="min-w-0 flex-1">
                                <DrugItemCard
                                  row={row}
                                  showPatient={Boolean(patientHeader?.multiple)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="px-4 py-6 text-center text-xs text-flow-muted">
                      {isMobile ? "แตะวันที่เพื่อดูรายการยา" : "เลือกวันที่จากรายการด้านซ้าย"}
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
                <div
                  className={`border-b border-flow-border md:w-72 md:shrink-0 md:border-b-0 md:border-r ${
                    showLabDayList ? "block" : "hidden md:block"
                  }`}
                >
                  <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                    วันที่ตรวจ
                    <span className="ml-2 font-normal normal-case text-flow-muted">
                      ({groupedLabDays.length} วัน)
                    </span>
                  </p>
                  <ul className="max-h-[28rem] divide-y divide-flow-border overflow-y-auto border-t border-flow-border">
                    {groupedLabDays.map((group) => (
                      <li key={group.key}>
                        <TreatmentDayButton
                          dateIso={group.dateIso}
                          isMobile={isMobile}
                          metaLine={`${group.items.length} รายการ · ${formatVisitTypes(group.visitTypes)}${
                            patientHeader?.multiple ? ` · HN ${formatHnDisplay(group.hn)}` : ""
                          }`}
                          selected={selectedLabDayKey === group.key}
                          onSelect={() => handleLabDaySelect(group.key)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`min-w-0 flex-1 ${showLabItems ? "block" : "hidden md:block"}`}>
                  <MobileBackBar
                    label="กลับไปวันที่ตรวจ"
                    show={isMobile && mobileLabPanel === "items"}
                    onBack={() => setMobileLabPanel("days")}
                  />
                  <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                    ผล Lab
                    {selectedLabDay ? (
                      <span className="ml-2 font-normal normal-case text-flow-text">
                        — {isoToThaiDisplay(selectedLabDay.dateIso)}
                        <span className="text-flow-muted">
                          {" "}
                          ({selectedLabDay.items.length} รายการ)
                        </span>
                      </span>
                    ) : null}
                  </p>
                  {selectedLabDay ? (
                    <>
                      <div className="hidden overflow-x-auto md:block">
                        <table className="min-w-full text-left text-xs">
                          <thead className={TABLE_HEAD_CLASS}>
                            <tr>
                              {patientHeader?.multiple ? <th className="px-3 py-2.5">HN</th> : null}
                              {patientHeader?.multiple ? <th className="px-3 py-2.5">ชื่อ</th> : null}
                              <th className="px-3 py-2.5">ประเภท</th>
                              <th className="px-3 py-2.5">ชื่อการตรวจ</th>
                              <th className="px-3 py-2.5">ผล</th>
                              <th className="px-3 py-2.5">ค่าอ้างอิง</th>
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
                                    <VisitTypeBadge an={row.AN} visitType={row.VISIT_TYPE} />
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
                      <div className="divide-y divide-flow-border md:hidden">
                        {selectedLabDay.items.map((row, index) => {
                          const rowKey = `${selectedLabDay.key}-${row.LABEXM}-${row.AN ?? ""}-${index}`;

                          return (
                            <LabItemCard
                              key={rowKey}
                              row={row}
                              showPatient={Boolean(patientHeader?.multiple)}
                            />
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="px-4 py-6 text-center text-xs text-flow-muted">
                      {isMobile ? "แตะวันที่เพื่อดูผล Lab" : "เลือกวันที่จากรายการด้านซ้าย"}
                    </p>
                  )}
                </div>
              </div>
            )}
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
                <div
                  className={`border-b border-flow-border md:w-72 md:shrink-0 md:border-b-0 md:border-r ${
                    showHistoryDayList ? "block" : "hidden md:block"
                  }`}
                >
                  <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                    วันที่มา
                    <span className="ml-2 font-normal normal-case text-flow-muted">
                      ({groupedHistoryDays.length} วัน)
                    </span>
                  </p>
                  <ul className="max-h-[28rem] divide-y divide-flow-border overflow-y-auto border-t border-flow-border">
                    {groupedHistoryDays.map((group) => (
                      <li key={group.key}>
                        <TreatmentDayButton
                          dateIso={group.dateIso}
                          isMobile={isMobile}
                          metaLine={`${group.items.length} ครั้ง · ${formatVisitTypes(group.visitTypes)}${
                            patientHeader?.multiple ? ` · HN ${formatHnDisplay(group.hn)}` : ""
                          }`}
                          selected={selectedHistoryDayKey === group.key}
                          onSelect={() => handleHistoryDaySelect(group.key)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`min-w-0 flex-1 ${showHistoryItems ? "block" : "hidden md:block"}`}>
                  <MobileBackBar
                    label="กลับไปวันที่มา"
                    show={isMobile && mobileHistoryPanel === "items"}
                    onBack={() => setMobileHistoryPanel("days")}
                  />
                  <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                    การซักประวัติ
                    {selectedHistoryDay ? (
                      <span className="ml-2 font-normal normal-case text-flow-text">
                        — {isoToThaiDisplay(selectedHistoryDay.dateIso)}
                        <span className="text-flow-muted">
                          {" "}
                          ({selectedHistoryVisits.length} ครั้ง)
                        </span>
                      </span>
                    ) : null}
                  </p>
                  {selectedHistoryDay ? (
                    <div className="max-h-[32rem] overflow-y-auto">
                      {selectedHistoryVisits.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-flow-muted">
                          ไม่มี visit ในวันที่เลือก
                        </p>
                      ) : (
                        selectedHistoryVisits.map((row, index) => (
                          <HistoryVisitCard
                            key={`${selectedHistoryDay.key}-${row.VN ?? "na"}-${index}`}
                            row={row}
                          />
                        ))
                      )}
                    </div>
                  ) : (
                    <p className="px-4 py-6 text-center text-xs text-flow-muted">
                      {isMobile ? "แตะวันที่เพื่อดูการซักประวัติ" : "เลือกวันที่จากรายการด้านซ้าย"}
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
                <div
                  className={`border-b border-flow-border md:w-72 md:shrink-0 md:border-b-0 md:border-r ${
                    showDiagDayList ? "block" : "hidden md:block"
                  }`}
                >
                  <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                    วันที่รับบริการ
                    <span className="ml-2 font-normal normal-case text-flow-muted">
                      ({groupedDiagDays.length} วัน)
                    </span>
                  </p>
                  <ul className="max-h-[28rem] divide-y divide-flow-border overflow-y-auto border-t border-flow-border">
                    {groupedDiagDays.map((group) => (
                      <li key={group.key}>
                        <TreatmentDayButton
                          dateIso={group.dateIso}
                          isMobile={isMobile}
                          metaLine={`${group.codes.length} รหัส · ${formatVisitTypes(group.visitTypes)}${
                            patientHeader?.multiple ? ` · HN ${formatHnDisplay(group.hn)}` : ""
                          }`}
                          selected={selectedDiagDayKey === group.key}
                          onSelect={() => handleDiagDaySelect(group.key)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`min-w-0 flex-1 ${showDiagItems ? "block" : "hidden md:block"}`}>
                  <MobileBackBar
                    label="กลับไปวันที่รับบริการ"
                    show={isMobile && mobileDiagPanel === "items"}
                    onBack={() => setMobileDiagPanel("days")}
                  />
                  <p className="border-b border-flow-border bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-flow-muted">
                    รหัสวินิจฉัย
                    {selectedDiagDay ? (
                      <span className="ml-2 font-normal normal-case text-flow-text">
                        — {isoToThaiDisplay(selectedDiagDay.dateIso)}
                        <span className="text-flow-muted">
                          {" "}
                          ({selectedDiagDay.codes.length} รหัส)
                        </span>
                      </span>
                    ) : null}
                  </p>
                  {selectedDiagDay ? (
                    <>
                      <div className="hidden md:block">
                        <div className="p-3">
                          {selectedDiagPanel ? <DiagnosisVisitPanel visit={selectedDiagPanel} /> : null}
                        </div>
                      </div>
                      <div className="space-y-3 p-3 md:hidden">
                        {selectedDiagPanel ? (
                          <>
                            <ClinicalDataBox text={resolveClinicalDataText(selectedDiagPanel)} />
                            <DiagnosisTypeLegend />
                            {selectedDiagPanel.rows.map((row, index) => (
                              <DiagnosisItemCard
                                key={`${row.VISIT_REF}-${row.ICD10}-${row.DIAGTYPE}-${index}`}
                                row={row}
                              />
                            ))}
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="px-4 py-6 text-center text-xs text-flow-muted">
                      {isMobile ? "แตะวันที่เพื่อดูรหัสวินิจฉัย" : "เลือกวันที่จากรายการด้านซ้าย"}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {drugRepeatPreview ? (
        <div
          aria-labelledby="drug-repeat-preview-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-4"
          role="dialog"
          onClick={closeDrugRepeatPreview}
        >
          <div
            className="flex max-h-[94vh] w-[min(210mm,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-flow-border bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-flow-border bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <h2
                  className="flex items-center gap-2 text-sm font-semibold text-flow-text"
                  id="drug-repeat-preview-title"
                >
                  <Printer aria-hidden className="h-4 w-4 shrink-0 text-brand-600" />
                  ตัวอย่างใบรายการยาเดิม
                </h2>
                <p className="mt-0.5 truncate text-xs text-flow-muted">
                  HN {drugRepeatPreview.hn}
                  {drugRepeatPreview.patientName ? ` · ${drugRepeatPreview.patientName}` : ""}
                  {" · "}
                  {drugRepeatPreview.items.length} รายการ
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="rounded-lg border border-flow-border bg-white px-3 py-1.5 text-sm font-medium text-flow-text hover:bg-slate-50"
                  type="button"
                  onClick={closeDrugRepeatPreview}
                >
                  ปิด
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                  type="button"
                  onClick={handleDrugRepeatPreviewPrint}
                >
                  <Printer aria-hidden className="h-4 w-4" />
                  พิมพ์
                </button>
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto overflow-x-hidden bg-white">
              <iframe
                ref={drugRepeatPreviewFrameRef}
                className="block w-full border-0 bg-white"
                scrolling="no"
                srcDoc={drugRepeatPreviewHtml ?? undefined}
                title="ตัวอย่างใบรายการยาเดิมของผู้ป่วย"
              />
            </div>
          </div>
        </div>
      ) : null}

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
                <thead className={`sticky top-0 ${TABLE_HEAD_CLASS}`}>
                  <tr>
                    <th className="px-4 py-2.5">ชื่อ-นามสกุล</th>
                    <th className="px-4 py-2.5">HN</th>
                    <th className="px-4 py-2.5">เลขบัตรประชาชน</th>
                    <th className="px-4 py-2.5 text-right" />
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
        <OpdscanExplorerModal
          files={scanFiles}
          folderCache={scanFolderCache}
          hnDisplay={formatHnDisplay(normalizeHnInput(scanHnQuery) || scanHnQuery)}
          hnQuery={scanHnQuery}
          loading={scanDirLoading}
          subPath={scanSubPath}
          onClose={closeScanModal}
          onNavigate={(subPath) => void navigateScanFolder(subPath)}
          onOpenFile={openScanFile}
        />
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
