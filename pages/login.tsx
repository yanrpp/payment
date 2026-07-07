"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";

import { DEFAULT_APP_PATH } from "@/lib/navigation/mainNav";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextPath =
    typeof router.query.next === "string" && router.query.next.startsWith("/")
      ? router.query.next
      : DEFAULT_APP_PATH;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const json = (await res.json()) as { authenticated?: boolean };

        if (!cancelled && json.authenticated) {
          await router.replace(nextPath);
        }
      } catch {
        // ยังไม่ login
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };

      if (!res.ok || !json.success) {
        setError(json.message ?? "เข้าสู่ระบบไม่สำเร็จ");

        return;
      }

      await router.replace(nextPath);
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-brand-50 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <Card className="w-full max-w-md border border-flow-border shadow-lg">
        <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">
            RPP Hospital
          </p>
          <h1 className="text-xl font-bold text-flow-text">ระบบวิเคราะห์ต้นทุนและข้อมูลการรักษา</h1>
          <p className="text-sm text-flow-muted">
            เข้าสู่ระบบด้วยบัญชี Active Directory ของโรงพยาบาล
          </p>
        </CardHeader>
        <CardBody className="px-6 pb-6 pt-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              isRequired
              autoComplete="username"
              label="ชื่อผู้ใช้"
              placeholder="เช่น username หรือ username@rpphosp.local"
              value={username}
              onValueChange={setUsername}
            />
            <Input
              isRequired
              autoComplete="current-password"
              label="รหัสผ่าน"
              type="password"
              value={password}
              onValueChange={setPassword}
            />
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <Button className="w-full" color="primary" isLoading={loading} type="submit">
              เข้าสู่ระบบ
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
