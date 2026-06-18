type NavIconProps = {
  name: string;
  className?: string;
};

/**
 * ชุดไอคอนเส้น (stroke) สำหรับเมนู — ใช้ currentColor เพื่อรับสีจาก parent
 */
const PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5",
  user: "M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6",
  pill: "M10.6 20.4 3.6 13.4a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7ZM7.1 9.9l7 7",
  bed: "M3 7v13M3 13h18M21 20v-5a2 2 0 0 0-2-2H9V9a2 2 0 0 1 2-2h2.5a2 2 0 0 1 2 2v0",
  clipboard:
    "M9 4.5h6M9 4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1M9 4.5H7.5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-12a2 2 0 0 0-2-2H15M8.5 13l2 2 4.5-4.5",
  shield: "M12 3 5 6v5.2c0 4 2.9 7 7 8 4.1-1 7-4 7-8V6l-7-3ZM9.3 12l1.9 1.9L15 9.9",
  sliders: "M4 7h9M16 7h4M4 12h4M11 12h9M4 17h7M14 17h6",
};

const CIRCLES: Record<string, { cx: number; cy: number }[]> = {
  sliders: [
    { cx: 14, cy: 7 },
    { cx: 9, cy: 12 },
    { cx: 12, cy: 17 },
  ],
};

export function NavIcon({ name, className }: NavIconProps) {
  const d = PATHS[name] ?? PATHS.home;

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
    >
      <path d={d} />
      {(CIRCLES[name] ?? []).map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} fill="currentColor" r={1.6} stroke="none" />
      ))}
    </svg>
  );
}
