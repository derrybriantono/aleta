import type { Metadata } from "next";
import Script from "next/script";

import "@/app/globals.css";
import { DEFAULT_INSTITUTION_LOGO_PATH } from "@/lib/institution-logo";
import { InstallGate } from "@/components/install/install-gate";
import { PortalProvider } from "@/lib/app-state";
import { withBasePath } from "@/lib/base-path";
import { GlobalLoadingProvider } from "@/lib/global-loading";

export const metadata: Metadata = {
  title: "ALETA | Akses Layanan Elektronik Terpadu Aksesibel",
  description: "ALETA adalah induk aplikasi layanan elektronik terpadu, dengan Manajemen Surat sebagai sub-modul utama untuk surat, disposisi, monitoring, dan kontrol akses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className="dark" data-scroll-behavior="smooth" style={{ scrollBehavior: 'smooth' }}>
      <head>
        <link rel="icon" href={withBasePath(DEFAULT_INSTITUTION_LOGO_PATH)} />
      </head>
      <body className="font-sans bg-background text-foreground transition-colors duration-300">
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              var storageKey = "portal-terpadu-pa-v2";
              var legacyStorageKey = "portal-terpadu-pa-v1";
              var darkDefaultMarker = "aleta:theme-default-dark-v1";
              var raw = window.localStorage.getItem(storageKey) || window.localStorage.getItem(legacyStorageKey);
              var hasDarkDefault = window.localStorage.getItem(darkDefaultMarker) === "1";
              var parsed = raw ? JSON.parse(raw) : {};

              if (!hasDarkDefault) {
                var nextState = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
                nextState.theme = "dark";
                window.localStorage.setItem(storageKey, JSON.stringify(nextState));
                window.localStorage.setItem(darkDefaultMarker, "1");
                document.documentElement.classList.add("dark");
              } else if (raw) {
                if (parsed && parsed.theme === "light") {
                  document.documentElement.classList.remove("dark");
                } else {
                  document.documentElement.classList.add("dark");
                }
              } else {
                document.documentElement.classList.add("dark");
              }
            } catch (error) {
              document.documentElement.classList.add("dark");
            }
          `}
        </Script>
        <GlobalLoadingProvider>
          <PortalProvider>
            <InstallGate />
            {children}
          </PortalProvider>
        </GlobalLoadingProvider>
      </body>
    </html>
  );
}
