import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { getOpdscanUncRoot, opdscanConfig } from "@/config/opdscan";
import { parseHnForOpdscan, type OpdscanHnParts } from "@/lib/opdscan/path";

const execFileAsync = promisify(execFile);

export class OpdscanNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpdscanNotFoundError";
  }
}

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

  async function deleteShareMapping(): Promise<void> {
    try {
      await execFileAsync("net", ["use", uncRoot, "/delete", "/y"], {
        windowsHide: true,
      });
    } catch {
      // ไม่มี mapping เดิม — ข้ามได้
    }
  }

  async function mapShare(): Promise<void> {
    await execFileAsync("net", ["use", uncRoot, password, `/user:${username}`], {
      windowsHide: true,
    });
  }

  try {
    await mapShare();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Windows 1219: มีการเชื่อมต่อเดิมด้วย user อื่น — ลบแล้ว map ใหม่
    if (/1219|multiple connections/i.test(message)) {
      await deleteShareMapping();
      await mapShare();
    } else if (!/already|already connected/i.test(message)) {
      throw new Error(`เชื่อมต่อโฟลเดอร์สแกน OPD ไม่สำเร็จ: ${message}`);
    }
  }

  try {
    await fs.readdir(uncRoot);
  } catch {
    await deleteShareMapping();
    await mapShare();
    await fs.readdir(uncRoot);
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

function resetShareConnection(): void {
  shareConnectPromise = null;
}

async function disconnectShare(): Promise<void> {
  resetShareConnection();

  if (process.platform !== "win32") return;

  const uncRoot = getOpdscanUncRoot();

  try {
    await execFileAsync("net", ["use", uncRoot, "/delete", "/y"], {
      windowsHide: true,
    });
  } catch {
    // ไม่มี mapping — ข้ามได้
  }
}

async function isAccessibleDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);

    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function findPatientFolderAcrossYears(
  patientFolder: string,
  preferredYear: number
): Promise<{ uncPath: string; relativePath: string } | null> {
  const uncRoot = getOpdscanUncRoot();

  let entries;

  try {
    entries = await fs.readdir(uncRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const yearDirs = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => {
      if (a === String(preferredYear)) return -1;
      if (b === String(preferredYear)) return 1;

      return b.localeCompare(a);
    });

  for (const year of yearDirs) {
    const candidate = path.win32.join(uncRoot, year, patientFolder);

    if (await isAccessibleDirectory(candidate)) {
      return {
        uncPath: candidate,
        relativePath: `${year}\\${patientFolder}`,
      };
    }
  }

  return null;
}

async function resolveOpdscanPatientRoot(
  hnInput: string
): Promise<{ uncPath: string; relativePath: string; parts: OpdscanHnParts }> {
  const parts = parseHnForOpdscan(hnInput);

  if (!parts) {
    throw new Error("รูปแบบ HN ไม่ถูกต้อง (ใช้เช่น 19999/99)");
  }

  await ensureShare();

  const uncRoot = getOpdscanUncRoot();
  const canonicalPath = path.win32.join(uncRoot, String(parts.buddhistYear), parts.patientFolder);

  if (await isAccessibleDirectory(canonicalPath)) {
    return {
      uncPath: canonicalPath,
      relativePath: parts.relativePath,
      parts,
    };
  }

  const fallback = await findPatientFolderAcrossYears(parts.patientFolder, parts.buddhistYear);

  if (fallback) {
    return {
      uncPath: fallback.uncPath,
      relativePath: fallback.relativePath,
      parts,
    };
  }

  throw new OpdscanNotFoundError(`ไม่พบโฟลเดอร์สแกน: ${canonicalPath}`);
}

async function readdirOpdscanDir(dirPath: string) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "UNKNOWN") {
      await disconnectShare();
      await ensureShare();

      try {
        return await fs.readdir(dirPath, { withFileTypes: true });
      } catch (retryError) {
        const retryCode = (retryError as NodeJS.ErrnoException).code;

        if (retryCode === "ENOENT" || retryCode === "UNKNOWN") {
          throw new OpdscanNotFoundError(`ไม่พบโฟลเดอร์สแกน: ${dirPath}`);
        }
        if (retryCode === "ENOTDIR") {
          throw new OpdscanNotFoundError(`พาธไม่ใช่โฟลเดอร์: ${dirPath}`);
        }

        throw retryError;
      }
    }

    if (code === "ENOENT") {
      throw new OpdscanNotFoundError(`ไม่พบโฟลเดอร์สแกน: ${dirPath}`);
    }
    if (code === "ENOTDIR") {
      throw new OpdscanNotFoundError(`พาธไม่ใช่โฟลเดอร์: ${dirPath}`);
    }

    throw new Error(
      `เปิดโฟลเดอร์สแกนไม่ได้: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function resolvePatientDir(
  hnInput: string,
  subPath = ""
): Promise<{ uncPath: string; relativePath: string; patientRoot: string }> {
  const { uncPath: patientRoot, relativePath: patientRelativePath } =
    await resolveOpdscanPatientRoot(hnInput);
  const subSegments = normalizeSubPathSegments(subPath);
  const uncPath =
    subSegments.length > 0 ? path.win32.join(patientRoot, ...subSegments) : patientRoot;
  const relativePath =
    subSegments.length > 0
      ? `${patientRelativePath}\\${subSegments.join("\\")}`
      : patientRelativePath;

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
  const { uncPath, relativePath } = await resolvePatientDir(hnInput, subPath);

  const entries = await readdirOpdscanDir(uncPath);

  const files: OpdscanFileEntry[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (!entry.isDirectory() && isIgnoredOpdscanFile(entry.name)) continue;

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

/** ไฟล์ระบบ Windows (เช่น Thumbs.db) — ไม่แสดงใน explorer และไม่นับเป็นผล lab วันนี้ */
function isIgnoredOpdscanFile(name: string): boolean {
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
    if (!entry.isDirectory() && isIgnoredOpdscanFile(entry.name)) continue;

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
  try {
    const { uncPath } = await resolveOpdscanPatientRoot(hnInput);
    const entries = await readdirOpdscanDir(uncPath);

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
  } catch {
    return { hasTodayLabFiles: false, labFolderName: null, todayFileCount: 0 };
  }
}

/** ตรวจว่าโฟลเดอร์สแกนของ HN มีไฟล์/โฟลเดอร์อย่างน้อย 1 รายการ (ไม่ throw ถ้าไม่มีโฟลเดอร์) */
export async function checkOpdscanHasContent(hnInput: string): Promise<{
  hasContent: boolean;
  uncPath: string | null;
  entryCount: number;
}> {
  if (!parseHnForOpdscan(hnInput)) {
    return { hasContent: false, uncPath: null, entryCount: 0 };
  }

  try {
    const { uncPath } = await resolveOpdscanPatientRoot(hnInput);
    const entries = await readdirOpdscanDir(uncPath);
    const visible = entries.filter(
      (entry) =>
        !entry.name.startsWith(".") && (entry.isDirectory() || !isIgnoredOpdscanFile(entry.name))
    );

    return {
      hasContent: visible.length > 0,
      uncPath,
      entryCount: visible.length,
    };
  } catch (error) {
    if (error instanceof OpdscanNotFoundError) {
      return { hasContent: false, uncPath: null, entryCount: 0 };
    }

    throw error;
  }
}

export async function resolveOpdscanFilePath(
  hnInput: string,
  relativeFile: string
): Promise<{ uncPath: string; filePath: string }> {
  const segments = normalizeSubPathSegments(relativeFile.replace(/\\/g, "/"));

  if (segments.length === 0) {
    throw new Error("ชื่อไฟล์ไม่ถูกต้อง");
  }

  const fileName = segments[segments.length - 1]!;

  assertSafeFileName(fileName);

  const { patientRoot } = await resolvePatientDir(hnInput);
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
