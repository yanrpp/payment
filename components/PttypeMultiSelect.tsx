"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  loading?: boolean;
};

/** ตัวกรอง "สิทธิการรักษา" แบบ multi-select (dropdown + ค้นหา) ใช้ร่วมในหน้า MRLI */
export function PttypeMultiSelect({ options, selected, onChange, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", onDown);

    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);

  return (
    <div ref={ref} className="relative w-full">
      <button
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-flow-border bg-white px-3 py-2 text-left text-[11px] text-flow-text shadow-sm hover:bg-flow-input disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading || options.length === 0}
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="min-w-0 truncate">
          {loading
            ? "กำลังโหลดสิทธิ..."
            : options.length === 0
              ? "ไม่มีรายการสิทธิ"
              : selected.length === 0
                ? `ทุกสิทธิ — แตะเพื่อเลือกกรอง (${options.length} รายการ)`
                : `เลือกแล้ว ${selected.length} สิทธิ — แตะเพื่อเปลี่ยน`}
        </span>
        <span aria-hidden className="shrink-0 text-slate-400">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && options.length > 0 && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-flow-border bg-white p-2 shadow-lg ring-1 ring-black/5">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-[10px]">
            <button
              className="rounded border border-flow-border bg-flow-input px-2 py-0.5 text-flow-text hover:bg-brand-50"
              type="button"
              onClick={() => onChange([...filtered])}
            >
              เลือกทั้งหมด (ตามที่ค้นเห็น)
            </button>
            <button
              className="rounded border border-flow-border bg-white px-2 py-0.5 text-flow-text hover:bg-flow-input"
              type="button"
              onClick={() => onChange([])}
            >
              ล้างที่เลือก
            </button>
          </div>
          <input
            autoComplete="off"
            className="ui-input-sm mt-2 text-[11px] py-1.5"
            placeholder="พิมพ์เพื่อค้นหาชื่อสิทธิ..."
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-flow-border bg-flow-input/60 px-1 py-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-2 text-[10px] text-slate-400">ไม่พบรายการที่ตรงกับการค้นหา</p>
            ) : (
              filtered.map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-[11px] text-flow-text hover:bg-white"
                >
                  <input
                    checked={selected.includes(opt)}
                    className="ui-checkbox mt-0.5 shrink-0"
                    type="checkbox"
                    onChange={() => toggle(opt)}
                  />
                  <span className="min-w-0 flex-1 leading-snug" title={opt}>
                    {opt}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
