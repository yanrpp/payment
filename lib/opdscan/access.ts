import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { getOpdscanUncRoot, opdscanConfig } from "@/config/opdscan";
import { parseHnForOpdscan } from "@/lib/opdscan/path";

const execFileAsync = promisify(execFile);

export type OpdscanFileEntry = {
  name: string;
  size: number;
  modified: string | null;
  isDirectory: boolean;
};

let shareConnectPromise: Promise<void> | null = null;

async function connectShare(): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("การเปิดไฟล์สแกน OPD รองรับเฉพาะเซิร์ฟเวอร์ Windows");
  }

  const uncRoot = getOpdscanUncRoot();
  const { username, password } = opdscanConfig;

  try {
    await execFileAsync("net", ["use", uncRoot, password, `/user:${username}`], {
      windowsHide: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!/already|1219|multiple connections/i.test(message)) {
      throw new Error(`เชื่อมต่อโฟลเดอร์สแกน OPD ไม่สำเร็จ: ${message}`);
    }
  }
}

async function ensureShare(): Promise<void> {
  if (!shareConnectPromise) {
    shareConnectPromise = connectShare().catch((error) => {
      shareConnectPromise = null;
      throw error;
    });
  }
  await shareConnectPromise;
}

function normalizeSubPathSegments(subPath?: string): string[] {
  if (!subPath?.trim()) return [];

  const normalized = subPath.replace(/\\/g, "/").trim();
  const segments = normalized.split("/").filter(Boolean);

  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new Error("พาธไม่ถูกต้อง");
    }
    if (/[<>:"|?*]/.test(segment)) {
      throw new Error("พาธไม่ถูกต้อง");
    }
  }

  return segments;
}

function resolvePatientDir(
  hnInput: string,
  subPath = ""
): { uncPath: string; relativePath: string; patientRoot: string } {
  const parts = parseHnForOpdscan(hnInput);

  if (!parts) {
    throw new Error("รูปแบบ HN ไม่ถูกต้อง (ใช้เช่น 19999/99)");
  }

  const uncRoot = getOpdscanUncRoot();
  const patientRoot = path.win32.join(uncRoot, String(parts.buddhistYear), parts.patientFolder);
  const subSegments = normalizeSubPathSegments(subPath);
  const uncPath =
    subSegments.length > 0 ? path.win32.join(patientRoot, ...subSegments) : patientRoot;
  const relativePath =
    subSegments.length > 0
      ? `${parts.relativePath}\\${subSegments.join("\\")}`
      : parts.relativePath;

  return { uncPath, relativePath, patientRoot };
}

function assertSafeFileName(fileName: string): void {
  const base = path.win32.basename(fileName);

  if (!base || base !== fileName || base === "." || base === "..") {
    throw new Error("ชื่อไฟล์ไม่ถูกต้อง");
  }
}

export async function listOpdscanFiles(
  hnInput: string,
  subPath = ""
): Promise<{
  uncPath: string;
  relativePath: string;
  subPath: string;
  files: OpdscanFileEntry[];
}> {
  await ensureShare();

  const { uncPath, relativePath } = resolvePatientDir(hnInput, subPath);

  let entries;

  try {
    entries = await fs.readdir(uncPath, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      throw new Error(`ไม่พบโฟลเดอร์สแกน: ${uncPath}`);
    }
    if (code === "ENOTDIR") {
      throw new Error(`พาธไม่ใช่โฟลเดอร์: ${uncPath}`);
    }
    throw new Error(
      `เปิดโฟลเดอร์สแกนไม่ได้: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const files: OpdscanFileEntry[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.win32.join(uncPath, entry.name);
    let size = 0;
    let modified: string | null = null;

    try {
      const stat = await fs.stat(fullPath);

      size = stat.size;
      modified = stat.mtime.toISOString();
    } catch {
      // skip unreadable entries
    }

    files.push({
      name: entry.name,
      size,
      modified,
      isDirectory: entry.isDirectory(),
    });
  }

  files.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;

    return a.name.localeCompare(b.name, "th");
  });

  return {
    uncPath,
    relativePath,
    subPath: normalizeSubPathSegments(subPath).join("\\"),
    files,
  };
}

const LAB_FOLDER_NAME_PATTERN = /^lab$/i;

function isLocalCalendarToday(date: Date, reference = new Date()): boolean {
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

/** ไฟล์ระบบ/ค้างหลังลบผล lab — ไม่นับเป็นผล lab อัปโหลดวันนี้ */
function isIgnoredLabTodayFile(name: string): boolean {
  return /\.db$/i.test(name);
}

async function countFilesModifiedTodayInDir(dirPath: string): Promise<number> {
  let entries;

  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }

  let count = 0;

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (!entry.isDirectory() && isIgnoredLabTodayFile(entry.name)) continue;

    const fullPath = path.win32.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      count += await countFilesModifiedTodayInDir(fullPath);
      continue;
    }

    try {
      const stat = await fs.stat(fullPath);

      if (isLocalCalendarToday(stat.mtime)) {
        count += 1;
      }
    } catch {
      // skip unreadable files
    }
  }

  return count;
}

/** ตรวจว่าโฟลเดอร์ lab ของ HN มีไฟล์ที่แก้ไข/อัปโหลดวันนี้ (ตามเวลาเครื่องเซิร์ฟร์) */
export async function checkOpdscanLabUpdatedToday(hnInput: string): Promise<{
  hasTodayLabFiles: boolean;
  labFolderName: string | null;
  todayFileCount: number;
}> {
  const parts = parseHnForOpdscan(hnInput);

  if (!parts) {
    return { hasTodayLabFiles: false, labFolderName: null, todayFileCount: 0 };
  }

  try {
    await ensureShare();
  } catch {
    return { hasTodayLabFiles: false, labFolderName: null, todayFileCount: 0 };
  }

  const { uncPath } = resolvePatientDir(hnInput);

  let entries;

  try {
    entries = await fs.readdir(uncPath, { withFileTypes: true });
  } catch {
    return { hasTodayLabFiles: false, labFolderName: null, todayFileCount: 0 };
  }

  const labDir = entries.find(
    (entry) => entry.isDirectory() && LAB_FOLDER_NAME_PATTERN.test(entry.name)
  );

  if (!labDir) {
    return { hasTodayLabFiles: false, labFolderName: null, todayFileCount: 0 };
  }

  const labPath = path.win32.join(uncPath, labDir.name);
  const todayFileCount = await countFilesModifiedTodayInDir(labPath);

  return {
    hasTodayLabFiles: todayFileCount > 0,
    labFolderName: labDir.name,
    todayFileCount,
  };
}

/** ตรวจว่าโฟลเดอร์สแกนของ HN มีไฟล์/โฟลเดอร์อย่างน้อย 1 รายการ (ไม่ throw ถ้าไม่มีโฟลเดอร์) */
export async function checkOpdscanHasContent(hnInput: string): Promise<{
  hasContent: boolean;
  uncPath: string | null;
  entryCount: number;
}> {
  const parts = parseHnForOpdscan(hnInput);

  if (!parts) {
    return { hasContent: false, uncPath: null, entryCount: 0 };
  }

  try {
    await ensureShare();
  } catch {
    return { hasContent: false, uncPath: null, entryCount: 0 };
  }

  const { uncPath } = resolvePatientDir(hnInput);

  try {
    const entries = await fs.readdir(uncPath, { withFileTypes: true });
    const visible = entries.filter((entry) => !entry.name.startsWith("."));

    return {
      hasContent: visible.length > 0,
      uncPath,
      entryCount: visible.length,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT" || code === "ENOTDIR") {
      return { hasContent: false, uncPath, entryCount: 0 };
    }

    throw error;
  }
}

export async function resolveOpdscanFilePath(
  hnInput: string,
  relativeFile: string
): Promise<{ uncPath: string; filePath: string }> {
  await ensureShare();

  const segments = normalizeSubPathSegments(relativeFile.replace(/\\/g, "/"));

  if (segments.length === 0) {
    throw new Error("ชื่อไฟล์ไม่ถูกต้อง");
  }

  const fileName = segments[segments.length - 1]!;

  assertSafeFileName(fileName);

  const { patientRoot } = resolvePatientDir(hnInput);
  const filePath = path.win32.join(patientRoot, ...segments);

  try {
    const stat = await fs.stat(filePath);

    if (!stat.isFile()) {
      throw new Error("ไม่พบไฟล์ที่ต้องการ");
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      throw new Error("ไม่พบไฟล์ที่ต้องการ");
    }
    throw error;
  }

  return { uncPath: patientRoot, filePath };
}

export function guessContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();

  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    case ".bmp":
      return "image/bmp";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
