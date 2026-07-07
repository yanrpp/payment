import { formatHnDisplay, normalizeHnInput } from "@/lib/hn/normalize";

export type OpdscanHnParts = {
  running: string;
  yearSuffix: string;
  buddhistYear: number;
  patientFolder: string;
  relativePath: string;
};

export function parseHnForOpdscan(hnInput: string): OpdscanHnParts | null {
  const trimmed = hnInput.trim();

  if (!trimmed) return null;

  let display = trimmed;

  if (!trimmed.includes("/") && !trimmed.includes("-")) {
    const normalized = normalizeHnInput(trimmed);

    if (!normalized) return null;
    display = formatHnDisplay(normalized);
  }

  const match = /^(\d{1,7})[/-](\d{2})$/.exec(display);

  if (!match) return null;

  const running = match[1];
  const yearSuffix = match[2];
  const buddhistYear = 2500 + Number(yearSuffix);
  const patientFolder = `${running}.${yearSuffix}`;
  const relativePath = `${buddhistYear}\\${patientFolder}`;

  return { running, yearSuffix, buddhistYear, patientFolder, relativePath };
}

export function buildOpdscanUncPath(hnInput: string, uncRoot: string): string | null {
  const parts = parseHnForOpdscan(hnInput);

  if (!parts) return null;

  return `${uncRoot}\\${parts.relativePath}`;
}
