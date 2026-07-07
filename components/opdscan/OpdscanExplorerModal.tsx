"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";

import { isoToThaiDisplay } from "@/lib/date/thaiDate";

export type OpdscanFileEntry = {
  name: string;
  size: number;
  modified: string | null;
  isDirectory: boolean;
};

type OpdscanExplorerModalProps = {
  hnDisplay: string;
  hnQuery: string;
  subPath: string;
  files: OpdscanFileEntry[];
  folderCache: Record<string, string[]>;
  loading: boolean;
  onClose: () => void;
  onNavigate: (subPath: string) => void;
  onOpenFile: (relativePath: string) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function joinSubPath(parent: string, name: string): string {
  return parent ? `${parent}\\${name}` : name;
}

function scanFileUrl(hnQuery: string, relativePath: string): string {
  return `/api/opdscan/file?hn=${encodeURIComponent(hnQuery)}&name=${encodeURIComponent(relativePath)}`;
}

function isImageFile(name: string): boolean {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(name);
}

function isPdfFile(name: string): boolean {
  return /\.pdf$/i.test(name);
}

function fileTypeLabel(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()?.toUpperCase() : "";

  if (!ext) return "ไฟล์";
  if (isPdfFile(name)) return "PDF";
  if (isImageFile(name)) return `${ext} รูปภาพ`;

  return `${ext} ไฟล์`;
}

function ScanFolderTree({
  currentSubPath,
  folderCache,
  depth,
  parentSubPath,
  onNavigate,
}: {
  currentSubPath: string;
  folderCache: Record<string, string[]>;
  depth: number;
  parentSubPath: string;
  onNavigate: (subPath: string) => void;
}) {
  const folders = folderCache[parentSubPath] ?? [];
  const isAncestorOfCurrent =
    currentSubPath === parentSubPath || currentSubPath.startsWith(`${parentSubPath}\\`);

  if (depth === 0) {
    return (
      <ul className="space-y-0.5">
        <li>
          <button
            className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs ${
              currentSubPath === ""
                ? "bg-brand-50 font-medium text-brand-800"
                : "text-flow-text hover:bg-slate-100"
            }`}
            type="button"
            onClick={() => onNavigate("")}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="truncate">โฟลเดอร์หลัก</span>
          </button>
          {folders.length > 0 ? (
            <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-flow-border pl-2">
              {folders.map((folderName) => (
                <ScanFolderTree
                  key={folderName}
                  currentSubPath={currentSubPath}
                  depth={depth + 1}
                  folderCache={folderCache}
                  parentSubPath={joinSubPath(parentSubPath, folderName)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          ) : null}
        </li>
      </ul>
    );
  }

  const folderName = parentSubPath.split("\\").pop() ?? parentSubPath;
  const isCurrent = currentSubPath === parentSubPath;
  const childFolders = isAncestorOfCurrent ? (folderCache[parentSubPath] ?? []) : [];

  return (
    <li>
      <button
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs ${
          isCurrent ? "bg-brand-50 font-medium text-brand-800" : "text-flow-text hover:bg-slate-100"
        }`}
        type="button"
        onClick={() => onNavigate(parentSubPath)}
      >
        {isCurrent ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        )}
        <span className="truncate">{folderName}</span>
      </button>
      {childFolders.length > 0 ? (
        <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-flow-border pl-2">
          {childFolders.map((childName) => (
            <ScanFolderTree
              key={childName}
              currentSubPath={currentSubPath}
              depth={depth + 1}
              folderCache={folderCache}
              parentSubPath={joinSubPath(parentSubPath, childName)}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OpdscanExplorerModal({
  hnDisplay,
  hnQuery,
  subPath,
  files,
  folderCache,
  loading,
  onClose,
  onNavigate,
  onOpenFile,
}: OpdscanExplorerModalProps) {
  const [selected, setSelected] = useState<OpdscanFileEntry | null>(null);

  const breadcrumbs = useMemo(
    () => (subPath ? subPath.split("\\").filter(Boolean) : []),
    [subPath]
  );

  const selectedRelativePath = selected
    ? joinSubPath(subPath, selected.name)
    : null;

  const handleNavigate = (nextSubPath: string) => {
    setSelected(null);
    onNavigate(nextSubPath);
  };

  const handleItemActivate = (file: OpdscanFileEntry) => {
    if (file.isDirectory) {
      handleNavigate(joinSubPath(subPath, file.name));
      return;
    }

    onOpenFile(joinSubPath(subPath, file.name));
  };

  const handleItemKeyDown = (event: KeyboardEvent, file: OpdscanFileEntry) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleItemActivate(file);
    }
  };

  const goUp = () => {
    if (!subPath) return;
    const parts = subPath.split("\\").filter(Boolean);

    parts.pop();
    handleNavigate(parts.join("\\"));
  };

  return (
    <div
      aria-labelledby="opdscan-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] w-[min(98vw,1400px)] flex-col overflow-hidden rounded-xl border border-flow-border bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-flow-border bg-slate-50 px-3 py-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-flow-text" id="opdscan-modal-title">
              ไฟล์สแกน OPD — HN {hnDisplay}
            </h2>
          </div>
          <button
            className="shrink-0 rounded-lg border border-flow-border bg-white px-3 py-1.5 text-xs font-medium text-flow-text hover:bg-slate-50"
            type="button"
            onClick={onClose}
          >
            ปิด
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-flow-border bg-white px-3 py-1.5">
          <button
            className="inline-flex items-center gap-1 rounded-md border border-flow-border bg-white px-2 py-1 text-xs text-flow-text hover:bg-slate-50 disabled:opacity-40"
            disabled={loading || !subPath}
            type="button"
            onClick={goUp}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            ขึ้นระดับ
          </button>
          <div className="mx-1 hidden h-5 w-px bg-flow-border sm:block" />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-xs">
            <button
              className={`rounded px-2 py-1 ${subPath ? "text-brand-700 hover:bg-brand-50" : "font-medium text-flow-text"}`}
              disabled={loading}
              type="button"
              onClick={() => handleNavigate("")}
            >
              โฟลเดอร์หลัก
            </button>
            {breadcrumbs.map((segment, index) => {
              const path = breadcrumbs.slice(0, index + 1).join("\\");
              const isLast = index === breadcrumbs.length - 1;

              return (
                <span key={path} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-flow-muted" />
                  <button
                    className={`max-w-[10rem] truncate rounded px-2 py-1 sm:max-w-none ${
                      isLast ? "font-medium text-flow-text" : "text-brand-700 hover:bg-brand-50"
                    }`}
                    disabled={loading || isLast}
                    type="button"
                    onClick={() => handleNavigate(path)}
                  >
                    {segment}
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-52 shrink-0 overflow-y-auto border-r border-flow-border bg-slate-50/80 p-2 md:block lg:w-56">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-flow-muted">
              โฟลเดอร์
            </p>
            <ScanFolderTree
              currentSubPath={subPath}
              depth={0}
              folderCache={folderCache}
              parentSubPath=""
              onNavigate={handleNavigate}
            />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {loading ? (
                <p className="py-12 text-center text-sm text-flow-muted">กำลังโหลด...</p>
              ) : files.length === 0 ? (
                <p className="py-12 text-center text-sm text-flow-muted">ไม่พบไฟล์ในโฟลเดอร์นี้</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
                  {files.map((file) => {
                    const isSelected = selected?.name === file.name;
                    const relativePath = joinSubPath(subPath, file.name);
                    const previewUrl = scanFileUrl(hnQuery, relativePath);

                    return (
                      <button
                        key={file.name}
                        className={`flex flex-col items-center rounded-lg border p-2 text-center transition-colors ${
                          isSelected
                            ? "border-brand-400 bg-brand-50 ring-1 ring-brand-300"
                            : "border-transparent hover:border-flow-border hover:bg-slate-50"
                        }`}
                        title={
                          file.isDirectory
                            ? "ดับเบิลคลิกเพื่อเปิดโฟลเดอร์"
                            : "คลิกเพื่อดูรายละเอียด · ดับเบิลคลิกเพื่อเปิด"
                        }
                        type="button"
                        onClick={() => setSelected(file)}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          handleItemActivate(file);
                        }}
                        onKeyDown={(event) => handleItemKeyDown(event, file)}
                      >
                        <div className="mb-1.5 flex h-20 w-full items-center justify-center overflow-hidden rounded-md bg-white">
                          {file.isDirectory ? (
                            <Folder className="h-12 w-12 text-amber-400" />
                          ) : isImageFile(file.name) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt=""
                              className="max-h-20 max-w-full object-contain"
                              loading="lazy"
                              src={previewUrl}
                            />
                          ) : (
                            <FileText className="h-10 w-10 text-slate-400" />
                          )}
                        </div>
                        <span className="line-clamp-2 w-full text-[11px] leading-tight text-flow-text">
                          {file.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="hidden w-64 shrink-0 flex-col border-l border-flow-border bg-slate-50/50 lg:flex xl:w-72">
            {selected ? (
              <>
                <div className="flex min-h-[10rem] flex-1 items-center justify-center overflow-hidden border-b border-flow-border bg-white p-3">
                  {selected.isDirectory ? (
                    <Folder className="h-20 w-20 text-amber-400" />
                  ) : isImageFile(selected.name) && selectedRelativePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={selected.name}
                      className="max-h-56 max-w-full object-contain"
                      src={scanFileUrl(hnQuery, selectedRelativePath)}
                    />
                  ) : isPdfFile(selected.name) && selectedRelativePath ? (
                    <iframe
                      className="h-56 w-full rounded border border-flow-border bg-white"
                      src={scanFileUrl(hnQuery, selectedRelativePath)}
                      title={selected.name}
                    />
                  ) : (
                    <FileText className="h-16 w-16 text-slate-300" />
                  )}
                </div>
                <div className="space-y-3 p-3 text-xs">
                  <p className="break-all font-semibold text-flow-text">{selected.name}</p>
                  <dl className="space-y-1.5 text-flow-muted">
                    <div>
                      <dt className="font-medium text-flow-text">ประเภท</dt>
                      <dd>{selected.isDirectory ? "โฟลเดอร์" : fileTypeLabel(selected.name)}</dd>
                    </div>
                    {!selected.isDirectory ? (
                      <div>
                        <dt className="font-medium text-flow-text">ขนาด</dt>
                        <dd>{formatFileSize(selected.size)}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="font-medium text-flow-text">แก้ไขล่าสุด</dt>
                      <dd>
                        {selected.modified
                          ? isoToThaiDisplay(selected.modified.slice(0, 10))
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <button
                    className="w-full rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700"
                    type="button"
                    onClick={() => handleItemActivate(selected)}
                  >
                    {selected.isDirectory ? "เปิดโฟลเดอร์" : "เปิดไฟล์"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-flow-muted">
                เลือกไฟล์หรือโฟลเดอร์เพื่อดูตัวอย่าง
              </div>
            )}
          </aside>
        </div>

        {selected && !loading ? (
          <div className="border-t border-flow-border bg-white p-3 lg:hidden">
            <p className="mb-2 truncate text-xs font-semibold text-flow-text">{selected.name}</p>
            <button
              className="w-full rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700"
              type="button"
              onClick={() => handleItemActivate(selected)}
            >
              {selected.isDirectory ? "เปิดโฟลเดอร์" : "เปิดไฟล์"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
