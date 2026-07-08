import { HospitalLogo } from "@/components/branding/HospitalLogo";
import { HOSPITAL_NAME_TH } from "@/config/branding";
import { siteConfig } from "@/config/site";

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-900 py-2" role="contentinfo">
      <div className="container mx-auto flex flex-col items-center justify-center gap-1.5 px-4 text-center text-[11px] leading-tight text-slate-300 sm:flex-row">
        <HospitalLogo className="h-6 w-6 object-contain" size={24} />
        <span>
          © {year} {HOSPITAL_NAME_TH} — {siteConfig.name} · v{siteConfig.version}
        </span>
      </div>
    </footer>
  );
}
