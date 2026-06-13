import { heroui } from "@heroui/theme";

/** HeroUI theme — โทนสีหลักอ้างอิง FlowAccount (#2D9CDB) */
export default heroui({
  defaultTheme: "light",
  themes: {
    light: {
      colors: {
        primary: {
          50: "#e8f6fc",
          100: "#c5e9f7",
          200: "#9bd8f1",
          300: "#71c7eb",
          400: "#4fb8e3",
          500: "#2d9cdb",
          600: "#268bbf",
          700: "#1f7aa3",
          800: "#186987",
          900: "#11586b",
          DEFAULT: "#2d9cdb",
          foreground: "#ffffff",
        },
        focus: "#2d9cdb",
      },
    },
  },
});
