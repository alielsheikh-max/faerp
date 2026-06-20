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
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%233b4bdb'/%3E%3Crect x='4' y='13' width='10' height='10' rx='2' fill='white' opacity='0.95'/%3E%3Crect x='18' y='13' width='10' height='10' rx='2' fill='white' opacity='0.6'/%3E%3Crect x='11' y='5' width='10' height='10' rx='2' fill='white' opacity='0.8'/%3E%3Crect x='6' y='25' width='20' height='3' rx='1.5' fill='white' opacity='0.45'/%3E%3C/svg%3E",
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
