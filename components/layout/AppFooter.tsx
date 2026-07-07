import { siteConfig } from "@/config/site";

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-flow-border bg-white py-4" role="contentinfo">
      <div className="container mx-auto px-4 text-center text-xs text-flow-muted">
        © {year} {siteConfig.name} — ระบบตรวจสอบค่าบริการ · v{siteConfig.version}
      </div>
    </footer>
  );
}
