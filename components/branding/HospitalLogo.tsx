import { HOSPITAL_LOGO, HOSPITAL_NAME_TH } from "@/config/branding";

type HospitalLogoProps = {
  className?: string;
  size?: number;
};

export function HospitalLogo({ className = "", size = 40 }: HospitalLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={HOSPITAL_NAME_TH}
      className={className}
      decoding="async"
      height={size}
      src={HOSPITAL_LOGO}
      width={size}
    />
  );
}
