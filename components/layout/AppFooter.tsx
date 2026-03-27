import { siteConfig } from "@/config/site";

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-4" role="contentinfo">
      <div className="container mx-auto px-4 text-center text-xs text-slate-500">
        © {year} {siteConfig.name} — ระบบต้นแบบ · v{siteConfig.version}
      </div>
    </footer>
  );
}
