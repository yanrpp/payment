/** แยกข้อความใน cnopdcard.diag ตามรูปแบบ e-PHIS/BMA */
export function parseCnopdcardDiag(raw: string | null | undefined): {
  clinicalData: string | null;
  diagnosisText: string | null;
} {
  const text = String(raw ?? "").trim();

  if (!text) return { clinicalData: null, diagnosisText: null };

  const normalized = text.replace(/\r\n/g, "\n");
  const clinicalMatch = /Clinical Data\s*:\s*([\s\S]*?)(?:\n-{3,}|\nDiagnosis\s*:|$)/i.exec(
    normalized
  );
  const diagnosisMatch = /Diagnosis\s*:\s*([\s\S]*)$/i.exec(normalized);

  if (clinicalMatch || diagnosisMatch) {
    return {
      clinicalData: clinicalMatch?.[1]?.trim() || null,
      diagnosisText: diagnosisMatch?.[1]?.trim() || null,
    };
  }

  return { clinicalData: text, diagnosisText: null };
}

export const DIAG_TYPE_LEGEND: { code: string; label: string }[] = [
  { code: "1", label: "Principle Diag" },
  { code: "2", label: "Comorbidity" },
  { code: "3", label: "Complication" },
  { code: "4", label: "Other" },
  { code: "5", label: "External Cause" },
  { code: "6", label: "Morphology of Neoplasms" },
];

export function formatDiagTypeLabel(value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === "") return "—";

  const code = String(value).trim();
  const item = DIAG_TYPE_LEGEND.find((entry) => entry.code === code);

  return item ? `${code} — ${item.label}` : code;
}
