"use client";

import { useMemo, useState } from "react";

import { normalizeThaiCardInput } from "@/lib/card/normalize";
import { isoToThaiDisplay } from "@/lib/date/thaiDate";
import { normalizeHnInput } from "@/lib/hn/normalize";

type PatientMedicationRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  PRSCDATE: string;
  AN: string | null;
  VISIT_TYPE: string;
  CLINIC_LCT: string | null;
  CLINIC_LCT_NAME: string | null;
  MEDITEM: string;
  MEDTYPE: string | null;
  ACCNATION: string | null;
  DRUG_NAME: string | null;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
  PTTYPE_NAME: string | null;
};

function apiDateToIsoLocal(value: unknown): string {
  if (value == null) return "";
  const d =
    typeof value === "string"
      ? new Date(value)
      : value instanceof Date
        ? value
        : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatHnDisplay(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.includes("/") || raw.includes("-")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 3) return raw;
  const yearSuffix = digits.slice(0, 2);
  const runningRaw = digits.slice(2);
  const running = runningRaw.replace(/^0+/, "") || "0";
  return `${running}/${yearSuffix}`;
}

function formatBaht(value: unknown): string {
  return Number(value ?? 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQty(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isInteger(n) ? String(n) : n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

const ALL_DATES = "__all__";

export default function PatientMedicationSearchPage() {
  const [hn, setHn] = useState("");
  const [cardno, setCardno] = useState("");
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PatientMedicationRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(ALL_DATES);
  const [filterVisitType, setFilterVisitType] = useState<"all" | "OPD" | "IPD">("all");

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    setRows([]);
    setSelectedDate(ALL_DATES);
    setFilterVisitType("all");

    const query = new URLSearchParams();

    const normalizedHn = normalizeHnInput(hn);
    const normalizedCard = normalizeThaiCardInput(cardno);
    const trimmedName = name.trim();

    if (normalizedHn) query.set("hn", normalizedHn);
    if (normalizedCard) query.set("cardno", normalizedCard);
    if (trimmedName) query.set("name", trimmedName);

    if (!normalizedHn && !normalizedCard && !trimmedName) {
      setLoading(false);
      setError("กรุณาระบุอย่างน้อย 1 เงื่อนไข: HN, เลขบัตรประชาชน หรือชื่อ-นามสกุล");
      return;
    }

    try {
      const res = await fetch(`/api/db/patient-medication-search?${query.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message ?? "ค้นหาข้อมูลไม่สำเร็จ");
        return;
      }

      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await runSearch();
  };

  const medicationDates = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const iso = apiDateToIsoLocal(row.PRSCDATE);
      if (iso) set.add(iso);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filterVisitType !== "all" && row.VISIT_TYPE !== filterVisitType) return false;
      if (selectedDate === ALL_DATES) return true;
      return apiDateToIsoLocal(row.PRSCDATE) === selectedDate;
    });
  }, [rows, selectedDate, filterVisitType]);

  const summary = useMemo(() => {
    let totalQty = 0;
    let totalCost = 0;
    let totalSale = 0;
    for (const row of filteredRows) {
      totalQty += Number(row.TOTAL_QTY ?? 0);
      totalCost += Number(row.TOTAL_COST ?? 0);
      totalSale += Number(row.TOTAL_SALE ?? 0);
    }
    return { totalQty, totalCost, totalSale, lineCount: filteredRows.length };
  }, [filteredRows]);

  const patientHeader = useMemo(() => {
    if (rows.length === 0) return null;
    const first = rows[0];
    const uniqueHn = new Set(rows.map((r) => r.HN));
    return {
      multiple: uniqueHn.size > 1,
      hn: first.HN,
      dspname: first.DSPNAME,
      cardno: first.CARDNO,
      patientCount: uniqueHn.size,
    };
  }, [rows]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-flow-border bg-white px-4 py-4 md:px-6">
        <h1 className="text-xl font-bold text-flow-text md:text-2xl">ค้นหารายการยาตามผู้ป่วย</h1>
        <p className="mt-1 text-xs text-flow-muted md:text-sm">
          ค้นหาด้วย HN, เลขบัตรประชาชน หรือชื่อ-นามสกุล แล้วเลือกดูรายการยาตามวันที่มียาได้
        </p>
      </header>

      <main className="flex-1 w-full px-4 py-6 md:px-6 md:py-8">
        <section className="mb-6">
          <form
            className="space-y-4 rounded-xl border border-accent-border bg-white p-4 shadow-sm"
            onSubmit={handleSearch}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-1">
                <label className="text-xs font-medium text-flow-text" htmlFor="med-hn">
                  HN
                </label>
                <input
                  className="ui-input w-full px-3 py-1.5 text-sm"
                  id="med-hn"
                  placeholder="เช่น 1666/69 หรือ 69001666"
                  type="text"
                  value={hn}
                  onChange={(e) => setHn(e.target.value)}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <label className="text-xs font-medium text-flow-text" htmlFor="med-cardno">
                  เลขบัตรประชาชน
                </label>
                <input
                  className="ui-input w-full px-3 py-1.5 text-sm"
                  id="med-cardno"
                  inputMode="numeric"
                  pattern="\d*"
                  placeholder="13 หลัก"
                  type="text"
                  value={cardno}
                  onChange={(e) => {
                    setCardno(e.target.value.replace(/\D/g, "").slice(0, 13));
                  }}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 xl:col-span-1">
                <label className="text-xs font-medium text-flow-text" htmlFor="med-name">
                  ชื่อ-นามสกุล
                </label>
                <input
                  className="ui-input w-full px-3 py-1.5 text-sm"
                  id="med-name"
                  placeholder="พิมพ์ชื่อหรือนามสกุลบางส่วน"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-flow-border pt-4">
              <button
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
                type="submit"
              >
                {loading ? "กำลังค้นหา..." : "ค้นหารายการยา"}
              </button>
            </div>
          </form>
        </section>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <section className="mb-4 rounded-xl border border-flow-border bg-white p-4 shadow-sm">
              {patientHeader && !patientHeader.multiple ? (
                <div className="mb-3 text-sm text-flow-text">
                  <span className="font-semibold">{patientHeader.dspname ?? "(ไม่ระบุชื่อ)"}</span>
                  <span className="mx-2 text-flow-muted">·</span>
                  <span>HN {formatHnDisplay(patientHeader.hn)}</span>
                  {patientHeader.cardno ? (
                    <>
                      <span className="mx-2 text-flow-muted">·</span>
                      <span>บัตร {patientHeader.cardno}</span>
                    </>
                  ) : null}
                </div>
              ) : patientHeader?.multiple ? (
                <p className="mb-3 text-sm text-flow-muted">
                  พบผู้ป่วย {patientHeader.patientCount} ราย — แสดงรายการยาทั้งหมดที่ตรงเงื่อนไข
                </p>
              ) : null}

              <p className="mb-2 text-xs font-semibold text-flow-text">เลือกวันที่มียา</p>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedDate === ALL_DATES
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-flow-text hover:bg-slate-200"
                  }`}
                  type="button"
                  onClick={() => setSelectedDate(ALL_DATES)}
                >
                  ทุกวัน ({medicationDates.length})
                </button>
                {medicationDates.map((iso) => (
                  <button
                    key={iso}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selectedDate === iso
                        ? "bg-brand-600 text-white"
                        : "bg-slate-100 text-flow-text hover:bg-slate-200"
                    }`}
                    type="button"
                    onClick={() => setSelectedDate(iso)}
                  >
                    {isoToThaiDisplay(iso)}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(["all", "OPD", "IPD"] as const).map((type) => (
                  <button
                    key={type}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      filterVisitType === type
                        ? "bg-slate-800 text-white"
                        : "border border-flow-border bg-white text-flow-text hover:bg-slate-50"
                    }`}
                    type="button"
                    onClick={() => setFilterVisitType(type)}
                  >
                    {type === "all" ? "ทุกประเภท" : type}
                  </button>
                ))}
              </div>
            </section>

            <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-flow-border bg-white p-3">
                <p className="text-[10px] text-flow-muted">รายการยา</p>
                <p className="text-lg font-semibold text-flow-text">{summary.lineCount}</p>
              </div>
              <div className="rounded-lg border border-flow-border bg-white p-3">
                <p className="text-[10px] text-flow-muted">จำนวนรวม</p>
                <p className="text-lg font-semibold text-flow-text">
                  {formatQty(summary.totalQty)}
                </p>
              </div>
              <div className="rounded-lg border border-flow-border bg-white p-3">
                <p className="text-[10px] text-flow-muted">ต้นทุนรวม</p>
                <p className="text-lg font-semibold text-flow-text">
                  {formatBaht(summary.totalCost)}
                </p>
              </div>
              <div className="rounded-lg border border-flow-border bg-white p-3">
                <p className="text-[10px] text-flow-muted">ราคาขายรวม</p>
                <p className="text-lg font-semibold text-flow-text">
                  {formatBaht(summary.totalSale)}
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-flow-border bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-flow-muted">
                    <tr>
                      <th className="px-3 py-2">วันสั่งยา</th>
                      {patientHeader?.multiple ? <th className="px-3 py-2">HN</th> : null}
                      {patientHeader?.multiple ? <th className="px-3 py-2">ชื่อ</th> : null}
                      <th className="px-3 py-2">ประเภท</th>
                      <th className="px-3 py-2">รหัสยา</th>
                      <th className="px-3 py-2">ชื่อยา</th>
                      <th className="px-3 py-2">หมวด</th>
                      <th className="px-3 py-2">คลินิก</th>
                      <th className="px-3 py-2 text-right">จำนวน</th>
                      <th className="px-3 py-2 text-right">ต้นทุน</th>
                      <th className="px-3 py-2 text-right">ราคาขาย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-flow-border">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-flow-muted" colSpan={11}>
                          ไม่มีรายการยาในวันที่เลือก
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, index) => {
                        const dateIso = apiDateToIsoLocal(row.PRSCDATE);
                        const rowKey = `${row.HN}-${dateIso}-${row.MEDITEM}-${row.CLINIC_LCT}-${row.AN ?? ""}-${index}`;

                        return (
                          <tr key={rowKey} className="hover:bg-slate-50/80">
                            <td className="whitespace-nowrap px-3 py-2 text-flow-text">
                              {isoToThaiDisplay(dateIso)}
                            </td>
                            {patientHeader?.multiple ? (
                              <td className="whitespace-nowrap px-3 py-2">
                                {formatHnDisplay(row.HN)}
                              </td>
                            ) : null}
                            {patientHeader?.multiple ? (
                              <td className="px-3 py-2">{row.DSPNAME ?? "—"}</td>
                            ) : null}
                            <td className="whitespace-nowrap px-3 py-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  row.VISIT_TYPE === "IPD"
                                    ? "bg-violet-100 text-violet-800"
                                    : "bg-sky-100 text-sky-800"
                                }`}
                              >
                                {row.VISIT_TYPE}
                                {row.AN ? ` · ${row.AN}` : ""}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">
                              {row.MEDITEM}
                            </td>
                            <td className="min-w-[12rem] px-3 py-2">{row.DRUG_NAME ?? "—"}</td>
                            <td className="px-3 py-2 text-flow-muted">{row.MEDTYPE ?? "—"}</td>
                            <td className="px-3 py-2 text-flow-muted">
                              {row.CLINIC_LCT_NAME ?? row.CLINIC_LCT ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              {formatQty(row.TOTAL_QTY)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              {formatBaht(row.TOTAL_COST)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              {formatBaht(row.TOTAL_SALE)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : !loading && !error ? (
          <p className="text-sm text-flow-muted">
            ระบุเงื่อนไขค้นหาแล้วกด &quot;ค้นหารายการยา&quot;
          </p>
        ) : null}
      </main>
    </div>
  );
}
