export type LabResultFlag = "high" | "low" | "normal" | "unknown";

export type LabTrendSourceRow = {
  LAB_DATE: string;
  LABEXM: number | null;
  LAB_NAME: string | null;
  LABGRP_NAME: string | null;
  RESULT: string | null;
  MIN_NRM: string | null;
  MAX_NRM: string | null;
  NRM_UNIT: string | null;
};

export type LabTrendTestRow = {
  key: string;
  labName: string;
  labGrpKey: string;
  labGrpLabel: string;
  reference: string;
  minNrm: number | null;
  maxNrm: number | null;
  resultsByDate: Map<string, LabTrendSourceRow>;
};

export type LabTrendGroup = {
  key: string;
  label: string;
  tests: LabTrendTestRow[];
};

export type LabTrendMatrix = {
  dates: string[];
  groups: LabTrendGroup[];
};

const UNKNOWN_LAB_GRP_KEY = "__unknown__";

export function labTestKey(row: Pick<LabTrendSourceRow, "LABEXM" | "LAB_NAME">): string {
  if (row.LABEXM != null) return `exm:${row.LABEXM}`;

  return `name:${String(row.LAB_NAME ?? "").trim()}`;
}

export function labGrpKeyFromName(name: string | null | undefined): string {
  const label = String(name ?? "").trim();

  return label || UNKNOWN_LAB_GRP_KEY;
}

export function labGrpLabelFromKey(key: string): string {
  return key === UNKNOWN_LAB_GRP_KEY ? "ไม่ระบุกลุ่ม" : key;
}

export function parseLabNumeric(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;

  const cleaned = value.trim().replace(/,/g, "");
  const match = /^([<>≤≥]?\s*)?(-?\d+(?:\.\d+)?)/.exec(cleaned);

  if (!match) return null;

  const n = Number(match[2]);

  return Number.isFinite(n) ? n : null;
}

export function formatLabReference(row: LabTrendSourceRow): string {
  const min = row.MIN_NRM?.trim();
  const max = row.MAX_NRM?.trim();
  const unit = row.NRM_UNIT?.trim();

  if (!min && !max) return "—";

  const range = min && max ? `${min} - ${max}` : (min ?? max ?? "");

  return unit ? `${range} ${unit}` : range;
}

export function classifyLabResult(
  row: Pick<LabTrendSourceRow, "RESULT" | "MIN_NRM" | "MAX_NRM">,
  value?: string | null
): LabResultFlag {
  const result = value ?? row.RESULT;
  const num = parseLabNumeric(result);

  if (num == null) return "unknown";

  const min = parseLabNumeric(row.MIN_NRM);
  const max = parseLabNumeric(row.MAX_NRM);

  if (min != null && num < min) return "low";
  if (max != null && num > max) return "high";
  if (min != null || max != null) return "normal";

  return "unknown";
}

function mergeSameDayResult(
  existing: LabTrendSourceRow | undefined,
  next: LabTrendSourceRow
): LabTrendSourceRow {
  if (!existing) return next;

  const left = existing.RESULT?.trim() ?? "";
  const right = next.RESULT?.trim() ?? "";

  if (!right || left === right) return existing;
  if (!left) return next;

  return { ...existing, RESULT: `${left} / ${right}` };
}

function sortLabGrpKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === UNKNOWN_LAB_GRP_KEY) return 1;
    if (b === UNKNOWN_LAB_GRP_KEY) return -1;

    return labGrpLabelFromKey(a).localeCompare(labGrpLabelFromKey(b), "th");
  });
}

export function buildLabTrendMatrix(
  rows: LabTrendSourceRow[],
  dateIso: (row: LabTrendSourceRow) => string
): LabTrendMatrix {
  const dateSet = new Set<string>();
  const groupMap = new Map<
    string,
    { label: string; tests: Map<string, LabTrendTestRow> }
  >();

  for (const row of rows) {
    const iso = dateIso(row);

    if (!iso) continue;

    dateSet.add(iso);

    const grpKey = labGrpKeyFromName(row.LABGRP_NAME);
    let group = groupMap.get(grpKey);

    if (!group) {
      group = { label: labGrpLabelFromKey(grpKey), tests: new Map() };
      groupMap.set(grpKey, group);
    }

    const testKey = labTestKey(row);
    let test = group.tests.get(testKey);

    if (!test) {
      test = {
        key: testKey,
        labName: row.LAB_NAME?.trim() || "—",
        labGrpKey: grpKey,
        labGrpLabel: group.label,
        reference: formatLabReference(row),
        minNrm: parseLabNumeric(row.MIN_NRM),
        maxNrm: parseLabNumeric(row.MAX_NRM),
        resultsByDate: new Map(),
      };
      group.tests.set(testKey, test);
    }

    test.resultsByDate.set(
      iso,
      mergeSameDayResult(test.resultsByDate.get(iso), row)
    );
  }

  const dates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  const groups = sortLabGrpKeys(Array.from(groupMap.keys())).flatMap((key) => {
    const group = groupMap.get(key);

    if (!group) return [];

    const tests = Array.from(group.tests.values()).sort((a, b) =>
      a.labName.localeCompare(b.labName, "th")
    );

    return [{ key, label: group.label, tests }];
  });

  return { dates, groups };
}

export type LabTestTimelineEntry = {
  dateIso: string;
  row: LabTrendSourceRow;
};

export function buildLabTestTimeline(
  history: LabTrendSourceRow[],
  dateIso: (row: LabTrendSourceRow) => string
): LabTestTimelineEntry[] {
  const byDate = new Map<string, LabTrendSourceRow>();

  for (const row of history) {
    const iso = dateIso(row);

    if (!iso) continue;

    byDate.set(iso, mergeSameDayResult(byDate.get(iso), row));
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([iso, row]) => ({ dateIso: iso, row }));
}

export function buildLabHistoryByTest<T extends LabTrendSourceRow>(
  rows: T[],
  dateIso: (row: T) => string
): Map<string, T[]> {
  const map = new Map<string, T[]>();

  for (const row of rows) {
    const key = labTestKey(row);
    const bucket = map.get(key);

    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }

  for (const list of Array.from(map.values())) {
    list.sort((a, b) => dateIso(b).localeCompare(dateIso(a)));
  }

  return map;
}

export function findPriorLabResult(
  history: LabTrendSourceRow[] | undefined,
  currentDateIso: string,
  dateIso: (row: LabTrendSourceRow) => string
): LabTrendSourceRow | null {
  if (!history?.length) return null;

  for (const row of history) {
    const iso = dateIso(row);

    if (iso && iso < currentDateIso) return row;
  }

  return null;
}

export type LabNumericTrend = "up" | "down" | "flat" | "unknown";

export function compareLabNumericTrend(
  previous: string | null | undefined,
  current: string | null | undefined
): LabNumericTrend {
  const prev = parseLabNumeric(previous);
  const curr = parseLabNumeric(current);

  if (prev == null || curr == null) return "unknown";
  if (curr > prev) return "up";
  if (curr < prev) return "down";

  return "flat";
}

export function labTimelineSupportsNumericCompare(timeline: LabTestTimelineEntry[]): boolean {
  for (let index = 0; index < timeline.length - 1; index += 1) {
    const trend = compareLabNumericTrend(
      timeline[index + 1]?.row.RESULT,
      timeline[index]?.row.RESULT
    );

    if (trend !== "unknown") return true;
  }

  return false;
}

export function labTrendDatesForGroup(dates: string[], group: LabTrendGroup): string[] {
  return dates.filter((dateIso) =>
    group.tests.some((test) => Boolean(test.resultsByDate.get(dateIso)?.RESULT?.trim()))
  );
}
