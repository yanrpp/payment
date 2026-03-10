import { Fira_Code as FontMono, Inter as FontSans, Prompt } from "next/font/google";

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const fontThai = Prompt({
  subsets: ["thai"],
  variable: "--font-thai",
  weight: ["400", "500", "600", "700"],
});
