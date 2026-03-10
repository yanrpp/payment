/**
 * หน้าแรก — ระบบต้นแบบ (Template)
 * คงการเชื่อมต่อ Oracle + MySQL ไว้ สำหรับนำไปสร้างระบบอื่น
 */

"use client";

import { useState } from "react";
import Link from "next/link";

import { siteConfig } from "@/config/site";

type TableRow = Record<string, unknown>;

export default function HomePage() {
  const [stdtestData, setStdtestData] = useState<TableRow[] | null>(null);
  const [stdtestLoading, setStdtestLoading] = useState(false);
  const [stdtestError, setStdtestError] = useState<string | null>(null);

  const [usertypeData, setUsertypeData] = useState<TableRow[] | null>(null);
  const [usertypeLoading, setUsertypeLoading] = useState(false);
  const [usertypeError, setUsertypeError] = useState<string | null>(null);

  const [ldapMembers, setLdapMembers] = useState<{ cn: string; samAccountName: string; department: string }[] | null>(null);
  const [ldapLoading, setLdapLoading] = useState(false);
  const [ldapError, setLdapError] = useState<string | null>(null);

  const handleLoadStdtest = async () => {
    setStdtestLoading(true);
    setStdtestError(null);
    setStdtestData(null);
    try {
      const res = await fetch("/api/db/stdtest");
      const json = await res.json();
      if (!res.ok) {
        setStdtestError(json.error ?? json.message ?? "โหลดข้อมูลไม่สำเร็จ");
        return;
      }
      setStdtestData(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setStdtestError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setStdtestLoading(false);
    }
  };

  const handleLoadUsertype = async () => {
    setUsertypeLoading(true);
    setUsertypeError(null);
    setUsertypeData(null);
    try {
      const res = await fetch("/api/db/oracle-usertype");
      const json = await res.json();
      if (!res.ok) {
        setUsertypeError(json.error ?? json.message ?? "โหลดข้อมูลไม่สำเร็จ");
        return;
      }
      setUsertypeData(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setUsertypeError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setUsertypeLoading(false);
    }
  };

  const handleLoadLdapMembers = async () => {
    setLdapLoading(true);
    setLdapError(null);
    setLdapMembers(null);
    try {
      const res = await fetch("/api/db/ldap-adit-members");
      const json = await res.json();
      if (!res.ok) {
        setLdapError(json.error ?? json.message ?? "โหลดข้อมูลไม่สำเร็จ");
        return;
      }
      setLdapMembers(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setLdapError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLdapLoading(false);
    }
  };

  const columns = stdtestData?.length
    ? (Object.keys(stdtestData[0] ?? {}) as string[])
    : [];
  const usertypeColumns = usertypeData?.length
    ? (Object.keys(usertypeData[0] ?? {}) as string[])
    : [];

  return (
    <div
      className="min-h-screen flex flex-col bg-white text-slate-800"
      style={{ fontFamily: "var(--font-thai), sans-serif" }}
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-slate-800">{siteConfig.name}</h1>
          <p className="text-sm text-slate-500 mt-1">{siteConfig.description}</p>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            ทดสอบการเชื่อมต่อฐานข้อมูล / บริการ
          </h2>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={handleLoadStdtest}
              disabled={stdtestLoading}
              className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stdtestLoading ? "กำลังโหลด…" : "ทดสอบ MySQL (แสดง stdtest)"}
            </button>
            <button
              type="button"
              onClick={handleLoadUsertype}
              disabled={usertypeLoading}
              className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {usertypeLoading ? "กำลังโหลด…" : "ทดสอบ Oracle (แสดง USERTYPE)"}
            </button>
            <button
              type="button"
              onClick={handleLoadLdapMembers}
              disabled={ldapLoading}
              className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ldapLoading ? "กำลังโหลด…" : "ทดสอบ LDAP (สมาชิก Ad_it)"}
            </button>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            ตั้งค่าตัวแปรใน .env.local ตาม .env.example แล้วรัน npm run dev
          </p>
        </section>

        {/* แสดงข้อมูลตาราง stdtest เมื่อกดทดสอบ MySQL */}
        {(stdtestError || usertypeError || ldapError) && (
          <section className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {stdtestError && <p>MySQL: {stdtestError}</p>}
            {usertypeError && <p>Oracle: {usertypeError}</p>}
            {ldapError && <p>LDAP: {ldapError}</p>}
          </section>
        )}
        {stdtestData && (
          <section className="mb-8">
            <h3 className="text-base font-semibold text-slate-800 mb-2">
              ข้อมูลจาก rpptest_db ตาราง stdtest ({stdtestData.length} แถว)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stdtestData.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      {columns.map((col) => (
                        <td key={col} className="px-3 py-2 text-slate-600">
                          {row[col] != null ? String(row[col]) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* แสดงข้อมูลตาราง USERTYPE เมื่อกดทดสอบ Oracle */}
        {usertypeData && (
          <section className="mb-8">
            <h3 className="text-base font-semibold text-slate-800 mb-2">
              ข้อมูลจาก Oracle ตาราง USERTYPE ({usertypeData.length} แถว)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    {usertypeColumns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usertypeData.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      {usertypeColumns.map((col) => (
                        <td key={col} className="px-3 py-2 text-slate-600">
                          {row[col] != null ? String(row[col]) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* สมาชิกกลุ่ม LDAP Ad_it (rpphosp.local/Users-RPP/manage Ad_it) */}
        {ldapMembers && (
          <section className="mb-8">
            <h3 className="text-base font-semibold text-slate-800 mb-2">
              สมาชิกกลุ่ม Ad_it — rpphosp.local/Users-RPP/manage Ad_it ({ldapMembers.length} คน)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">cn</th>
                    <th className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">user</th>
                    <th className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">department</th>
                  </tr>
                </thead>
                <tbody>
                  {ldapMembers.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600">{row.cn || "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{row.samAccountName || "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{row.department || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="text-sm text-slate-600">
          <p>เวอร์ชัน: {siteConfig.version}</p>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {siteConfig.name} — ระบบต้นแบบ
        </div>
      </footer>
    </div>
  );
}
