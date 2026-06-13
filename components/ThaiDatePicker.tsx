"use client";

import { useEffect, useState } from "react";

import {
  THAI_MONTH_SHORT,
  getDaysInMonth,
  isoToThaiDisplay,
  isoToThaiInput,
  localTodayIso,
  thaiInputToIso,
} from "@/lib/date/thaiDate";

type ThaiDatePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
};

function parseIsoLocal(iso: string): Date {
  const [yearStr, monthStr, dayStr] = iso.split("-");
  return new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
}

export function ThaiDatePicker({ id, label, value, onChange }: ThaiDatePickerProps) {
  const today = value || localTodayIso();
  const [inputValue, setInputValue] = useState<string>(isoToThaiInput(today));

  const baseDate = value ? parseIsoLocal(value) : new Date();
  const [viewYear, setViewYear] = useState<number>(baseDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(baseDate.getMonth());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!value) return;
    setInputValue(isoToThaiInput(value));
    const d = parseIsoLocal(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  const handleInputChange = (raw: string) => {
    let nextValue = raw;

    // ถ้าผู้ใช้กรอกเป็นตัวเลขล้วน 8 หลัก เช่น 01012569 ให้จัดรูปแบบเป็น 01/01/2569 อัตโนมัติ
    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly.length === 8) {
      const day = digitsOnly.slice(0, 2);
      const month = digitsOnly.slice(2, 4);
      const year = digitsOnly.slice(4, 8);
      nextValue = `${day}/${month}/${year}`;
    }

    setInputValue(nextValue);
    const iso = thaiInputToIso(nextValue);
    if (iso) {
      onChange(iso);
    }
  };

  const handleSelectDay = (day: number) => {
    const iso = `${viewYear.toString().padStart(4, "0")}-${(viewMonth + 1)
      .toString()
      .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    onChange(iso);
    setInputValue(isoToThaiInput(iso));
    setOpen(false);
  };

  const goMonth = (delta: number) => {
    let newMonth = viewMonth + delta;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0-6 (Sun-Sat)
  const buddhistYear = viewYear + 543;

  const selectedLabel = isoToThaiDisplay(value);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i += 1) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(d);
  }

  return (
    <div className="relative flex w-full min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-flow-text">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          className="ui-input w-full pr-9"
          value={inputValue}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
            }
          }}
          placeholder="เช่น 10/03/2569"
        />
        <button
          type="button"
          aria-label="เปิดปฏิทินเลือกวันที่"
          className="absolute inset-y-0 right-0 flex items-center justify-center px-2 text-flow-muted hover:text-brand-600"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-[10px]">
            📅
          </span>
        </button>
      </div>
      <p className="text-[11px] text-flow-muted">
        {selectedLabel ? `วันที่เลือก: ${selectedLabel}` : "ยังไม่ได้เลือกวันที่"}
      </p>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-64 rounded-xl border border-flow-border bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => goMonth(-1)}
            >
              ‹
            </button>
            <div className="text-xs font-medium text-slate-800">
              {THAI_MONTH_SHORT[viewMonth]} {buddhistYear}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const d = parseIsoLocal(localTodayIso());
                  setViewYear(d.getFullYear());
                  setViewMonth(d.getMonth());
                }}
              >
                วันนี้
              </button>
              <button
                type="button"
                aria-label="ปิดปฏิทิน"
                className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[10px] text-center text-slate-500 mb-1">
            <span>อา</span>
            <span>จ</span>
            <span>อ</span>
            <span>พ</span>
            <span>พฤ</span>
            <span>ศ</span>
            <span>ส</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[11px] text-center">
            {cells.map((day, index) =>
              day ? (
                <button
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  type="button"
                  className="h-7 rounded-md border border-transparent text-flow-text hover:border-brand-500 hover:bg-brand-50"
                  onClick={() => handleSelectDay(day)}
                >
                  {day}
                </button>
              ) : (
                // eslint-disable-next-line react/no-array-index-key
                <span key={index} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

