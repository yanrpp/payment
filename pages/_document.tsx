import { Html, Head, Main, NextScript } from "next/document";
import clsx from "clsx";

import { fontThai } from "@/config/fonts";

export default function Document() {
  return (
    <Html className="light" lang="th">
      <Head>
        <meta charSet="utf-8" />
        <meta content="text/html; charset=utf-8" httpEquiv="Content-Type" />
      </Head>
      <body className={clsx("min-h-screen bg-background font-thai antialiased", fontThai.variable)}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
