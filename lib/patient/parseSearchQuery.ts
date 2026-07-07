import { normalizeThaiCardInput } from "@/lib/card/normalize";
import { normalizeHnInput } from "@/lib/hn/normalize";

export type ParsedPatientSearch =
  | { kind: "empty" }
  | { kind: "hn"; hn: string }
  | { kind: "cardno"; cardno: string }
  | { kind: "name"; name: string };

/** แยกข้อความค้นหาเดียวเป็น HN / เลขบัตร 13 หลัก / ชื่อ-นามสกุล */
export function parsePatientSearchQuery(raw: string): ParsedPatientSearch {
  const trimmed = raw.trim();

  if (!trimmed) return { kind: "empty" };

  const digitsOnly = trimmed.replace(/\D/g, "");

  if (/^\d{1,7}[/-]\d{2}$/.test(trimmed)) {
    return { kind: "hn", hn: normalizeHnInput(trimmed) };
  }

  if (digitsOnly.length === 13) {
    return { kind: "cardno", cardno: normalizeThaiCardInput(trimmed) };
  }

  if (/^\d+$/.test(trimmed)) {
    return { kind: "hn", hn: normalizeHnInput(trimmed) };
  }

  if (/[a-zA-Z\u0E00-\u0E7F]/.test(trimmed) || /\s/.test(trimmed)) {
    return { kind: "name", name: trimmed };
  }

  if (digitsOnly.length > 0) {
    return { kind: "hn", hn: normalizeHnInput(trimmed) };
  }

  return { kind: "name", name: trimmed };
}

/** HN สำหรับเปิดไฟล์สแกน OPD จากช่องค้นหาเดียว */
export function scanHnFromSearchQuery(searchQuery: string, resolvedHn: string): string {
  const parsed = parsePatientSearchQuery(searchQuery);

  if (parsed.kind === "hn") return searchQuery.trim();

  return resolvedHn.trim();
}
