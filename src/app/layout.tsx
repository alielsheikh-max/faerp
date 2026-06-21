import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";
import { I18nProvider } from "@/lib/i18n-context";

export const metadata: Metadata = {
  title: `${APP_NAME} | On-prem ERP`,
  description: "Local ERP for monthly supplier pricing, analysis, and resale control.",
  icons: {
    icon: [
      {
        url: "/faerp logo.svg",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        {/* Preload Readex Pro Variable — prevents FOUT by fetching fonts before first paint */}
        <link rel="preload" href="/fonts/readex-pro-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/readex-pro-arabic-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
                  else document.documentElement.setAttribute('data-theme', 'light');
                  var locale = localStorage.getItem('faerp-locale');
                  // Set Readex Pro Variable for all locales — handles Arabic + Latin equally
                  document.documentElement.style.setProperty('--font-sans', "'Readex Pro Variable', -apple-system, sans-serif");
                  if (locale === 'ar') {
                    document.documentElement.setAttribute('dir', 'rtl');
                    document.documentElement.setAttribute('lang', 'ar');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
