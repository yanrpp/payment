"use client";

import { useEffect, useState } from "react";

type RuleAdmin = {
  code: string;
  label: string;
  description: string;
  severity: "error" | "warning" | "info";
  active: boolean;
  inRegistry: boolean;
};

const SEVERITY_OPTIONS = ["error", "warning", "info"] as const;
const SEVERITY_LABELS: Record<string, string> = {
  error: "ข้อผิดพลาด (error)",
  warning: "เตือน (warning)",
  info: "ข้อมูล (info)",
};

export default function MrliRuleAdminPage() {
  const [rules, setRules] = useState<RuleAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeUnavailable, setStoreUnavailable] = useState(false);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [actor, setActor] = useState<string>("");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("mrli_actor") : null;

    if (saved) setActor(saved);
  }, []);

  const handleActorChange = (v: string) => {
    setActor(v);
    if (typeof window !== "undefined") window.localStorage.setItem("mrli_actor", v);
  };

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/db/mrli-rules");
      const json = await res.json();

      if (res.ok && json.success) {
        setRules(Array.isArray(json.rules) ? json.rules : []);
        setStoreUnavailable(false);
      } else {
        setStoreUnavailable(Boolean(json.storeUnavailable));
      }
    } catch {
      setStoreUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRules();
  }, []);

  const saveRule = async (code: string, patch: Partial<Pick<RuleAdmin, "active" | "severity">>) => {
    // optimistic
    setRules((prev) => prev.map((r) => (r.code === code ? { ...r, ...patch } : r)));
    setSavingCode(code);

    try {
      const res = await fetch("/api/db/mrli-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...patch, actor }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setRules((prev) => prev.map((r) => (r.code === code ? json.rule : r)));
        setStoreUnavailable(false);
      } else {
        setStoreUnavailable(Boolean(json.storeUnavailable));
      }
    } catch {
      setStoreUnavailable(true);
    } finally {
      setSavingCode(null);
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="border-b border-accent-border bg-neutral-50">
        <div className="w-full px-4 py-4 md:px-6">
          <h1 className="text-xl md:text-2xl font-bold text-flow-text">
            MRLI · ตั้งค่ากฎตรวจสอบ (Rule Admin)
          </h1>
          <p className="mt-1 text-xs md:text-sm text-flow-muted">
            เปิด/ปิด และกำหนดความรุนแรงของกฎ Pre-Claim Scrubbing — มีผลทันทีกับหน้า
            &quot;ตรวจก่อนเบิก&quot; (บันทึกการแก้ไขลง audit log)
          </p>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-6 md:px-6 md:py-8">
        <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-[11px] md:text-xs text-flow-text">
            ผู้ดำเนินการ
            <input
              className="ui-input text-xs py-1 px-2"
              placeholder="ชื่อผู้แก้ไข (สำหรับ audit)"
              type="text"
              value={actor}
              onChange={(e) => handleActorChange(e.target.value)}
            />
          </label>
          <button
            className="ui-btn-secondary text-xs md:text-sm"
            disabled={loading}
            type="button"
            onClick={() => void loadRules()}
          >
            {loading ? "กำลังโหลด..." : "รีเฟรช"}
          </button>
        </section>

        {storeUnavailable && (
          <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            MRLI store (MySQL) ยังไม่พร้อมใช้งาน — แก้ไขกฎไม่ได้ ตรวจสอบการตั้งค่า
            DB_HOST/DB_USER/DB_PASSWORD/DB_NAME ใน .env.local (หน้า &quot;ตรวจก่อนเบิก&quot;
            จะใช้กฎค่าเริ่มต้นไปก่อน)
          </section>
        )}

        {!loading && rules.length === 0 && !storeUnavailable && (
          <p className="text-xs md:text-sm text-flow-muted">ยังไม่มีกฎในระบบ</p>
        )}

        {rules.length > 0 && (
          <div className="w-full overflow-x-auto rounded-xl border border-flow-border bg-white shadow-sm">
            <table className="w-full min-w-full border-separate border-spacing-0 text-xs md:text-sm text-left">
              <thead>
                <tr className="bg-black">
                  {["รหัสกฎ", "ชื่อกฎ", "คำอธิบาย", "ความรุนแรง", "เปิดใช้งาน"].map((h) => (
                    <th
                      key={h}
                      className="border-b border-neutral-800 bg-black px-3 py-2 font-semibold text-white whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.code} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-[11px] text-flow-text whitespace-nowrap">
                      {rule.code}
                      {savingCode === rule.code && (
                        <span className="ml-1 text-[10px] text-brand-600">กำลังบันทึก…</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-flow-text whitespace-nowrap">{rule.label}</td>
                    <td className="px-3 py-2 text-flow-muted">{rule.description}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <select
                        className="rounded border border-flow-border bg-white px-1 py-0.5 text-[11px] text-flow-text focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50"
                        disabled={storeUnavailable}
                        value={rule.severity}
                        onChange={(e) =>
                          void saveRule(rule.code, {
                            severity: e.target.value as RuleAdmin["severity"],
                          })
                        }
                      >
                        {SEVERITY_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {SEVERITY_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          checked={rule.active}
                          className="ui-checkbox"
                          disabled={storeUnavailable}
                          type="checkbox"
                          onChange={(e) => void saveRule(rule.code, { active: e.target.checked })}
                        />
                        <span className="text-[11px] text-flow-text">
                          {rule.active ? "เปิด" : "ปิด"}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[10px] text-flow-muted">
          หมายเหตุ: logic ของแต่ละกฎกำหนดในโค้ด (registry) —
          หน้านี้ปรับได้เฉพาะการเปิด/ปิดและความรุนแรง การเพิ่มกฎใหม่แบบ no-code และ Master Catalog
          (DRG/Fee Schedule/OCPA) จะตามมาในเฟสถัดไป
        </p>
      </main>
    </div>
  );
}
