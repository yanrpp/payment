"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";

import { HOSPITAL_NAME_TH } from "@/config/branding";
import { DEFAULT_APP_PATH } from "@/lib/navigation/mainNav";

const loginInputClassNames = {
  inputWrapper:
    "border border-flow-border bg-white shadow-none hover:bg-white data-[hover=true]:bg-white group-data-[focus=true]:bg-white",
  input: "text-flow-text",
  label: "text-flow-muted",
};

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <Card className="w-full max-w-md border border-flow-border shadow-sm">
        <CardBody className="gap-0 px-6 py-6">
          <div className="mb-6 text-center">
            <p className="text-sm font-semibold tracking-wide text-emerald-700">{HOSPITAL_NAME_TH}</p>
            <h1 className="mt-2 text-xl font-bold leading-snug text-emerald-950">
              ระบบตรวจสอบ<span className="text-brand-600">ข้อมูลผู้ป่วย</span>
            </h1>
            <p className="mt-3 text-sm text-amber-800/80">
              เข้าสู่ระบบด้วยบัญชี Internet ของโรงพยาบาล
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              isRequired
              autoComplete="username"
              classNames={loginInputClassNames}
              label="ชื่อผู้ใช้"
              placeholder="เช่น username "
              value={username}
              variant="bordered"
              onValueChange={setUsername}
            />
            <Input
              isRequired
              autoComplete="current-password"
              classNames={loginInputClassNames}
              label="รหัสผ่าน"
              type="password"
              value={password}
              variant="bordered"
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
