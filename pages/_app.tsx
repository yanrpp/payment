"use client";

import type { AppProps } from "next/app";

import { useRouter } from "next/router";
import { HeroUIProvider } from "@heroui/system";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { MainLayout } from "@/components/layout";
import { fontSans, fontMono, fontThai } from "@/config/fonts";
import "@/styles/globals.css";

function AppBody({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isLoginPage = router.pathname === "/login";

  if (isLoginPage) {
    return <Component {...pageProps} />;
  }

  return (
    <MainLayout>
      <Component {...pageProps} />
    </MainLayout>
  );
}

export default function App(props: AppProps) {
  return (
    <HeroUIProvider>
      <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <AuthProvider>
          <AppBody {...props} />
        </AuthProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}

export const fonts = {
  sans: fontSans.style.fontFamily,
  mono: fontMono.style.fontFamily,
  thai: fontThai.style.fontFamily,
};
