"use client";

import { useMemo, useState } from "react";

import {
  THAI_MONTH_SHORT,
  formatMonthsIsoThaiDisplay,
  localCurrentMonthIso,
  sortMonthIsos,
} from "@/lib/date/thaiDate";

type MonthPickerProps = {
  id: string;
  label: string;
  value: string[];
  onChange: (monthIsos: string[]) => void;
};

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function MonthPicker({ id, label, value, onChange }: MonthPickerProps) {
  const selected = useMemo(() => sortMonthIsos(value), [value]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const [viewYear, setViewYear] = useState(() => {
    const current = localCurrentMonthIso();
    const year = Number(current.split("-")[0]);

    return Number.isFinite(year) ? year : new Date().getFullYear();
  });

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];

    for (let y = currentYear - 5; y <= currentYear + 1; y += 1) {
      years.push(y);
    }

    return years;
  }, []);

  const toggleMonth = (month: number) => {
    const key = monthKey(viewYear, month);
    const next = selectedSet.has(key)
      ? selected.filter((item) => item !== key)
      : sortMonthIsos([...selected, key]);

    onChange(next);
  };

  const selectAllInYear = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const keys: string[] = [];

    for (let m = 1; m <= 12; m += 1) {
      if (viewYear > currentYear) continue;
      if (viewYear === currentYear && m > currentMonth) continue;
      keys.push(monthKey(viewYear, m));
    }
    onChange(sortMonthIsos([...selected, ...keys]));
  };

  const clearYear = () => {
    onChange(selected.filter((item) => !item.startsWith(`${viewYear}-`)));
  };

  const selectedInViewYear = useMemo(
    () => selected.filter((item) => item.startsWith(`${viewYear}-`)).length,
    [selected, viewYear]
  );

  return (
    <div className="flex w-full min-w-[18rem] max-w-2xl flex-col gap-2">
      <label className="text-xs font-medium text-flow-text" htmlFor={`${id}-year`}>
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="ui-select text-xs py-1.5 min-w-[7rem]"
          id={`${id}-year`}
          value={viewYear}
          onChange={(event) => setViewYear(Number(event.target.value))}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y + 543}
            </option>
          ))}
        </select>
        <button
          className="rounded border border-flow-border bg-white px-2 py-1 text-[11px] text-flow-text hover:bg-flow-input"
          type="button"
          onClick={selectAllInYear}
        >
          เลือกทั้งปี
        </button>
        <button
          className="rounded border border-flow-border bg-white px-2 py-1 text-[11px] text-flow-text hover:bg-flow-input disabled:opacity-50"
          disabled={selectedInViewYear === 0}
          type="button"
          onClick={clearYear}
        >
          ล้างปีนี้
        </button>
      </div>
      <div
        aria-label={`เลือกเดือน ปี ${viewYear + 543}`}
        className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6"
        role="group"
      >
        {THAI_MONTH_SHORT.map((name, index) => {
          const month = index + 1;
          const key = monthKey(viewYear, month);
          const isSelected = selectedSet.has(key);
          const today = new Date();
          const isFuture =
            viewYear > today.getFullYear() ||
            (viewYear === today.getFullYear() && month > today.getMonth() + 1);

          return (
            <button
              key={key}
              className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                isSelected
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-flow-border bg-white text-flow-text hover:bg-flow-input"
              } disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={isFuture}
              type="button"
              onClick={() => toggleMonth(month)}
            >
              {name}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-flow-muted">
        {selected.length > 0
          ? `เลือก ${selected.length} เดือน: ${formatMonthsIsoThaiDisplay(selected)}`
          : "ยังไม่ได้เลือกเดือน (เลือกได้หลายเดือน)"}
      </p>
    </div>
  );
}
