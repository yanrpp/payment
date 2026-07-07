import { HospitalLogo } from "@/components/branding/HospitalLogo";
import { HOSPITAL_NAME_TH } from "@/config/branding";
import { siteConfig } from "@/config/site";

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-flow-border bg-white py-4" role="contentinfo">
      <div className="container mx-auto flex flex-col items-center justify-center gap-2 px-4 text-center text-xs text-flow-muted sm:flex-row">
        <HospitalLogo className="h-8 w-8 object-contain" size={32} />
        <span>
          © {year} {HOSPITAL_NAME_TH} — {siteConfig.name} · v{siteConfig.version}
        </span>
      </div>
    </footer>
  );
}
