import type { Metadata } from "next";
import Script from "next/script";

import "@/app/globals.css";
import { PortalProvider } from "@/lib/app-state";

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
        <link rel="icon" href="/favicon.png" />
      </head>
      <body className="font-sans bg-background text-foreground transition-colors duration-300">
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              var raw = window.localStorage.getItem("portal-terpadu-pa-v2") || window.localStorage.getItem("portal-terpadu-pa-v1");
              if (!raw) {
                document.documentElement.classList.add("dark");
              } else {
                var parsed = JSON.parse(raw);
                if (parsed && parsed.theme === "light") {
                  document.documentElement.classList.remove("dark");
                } else {
                  document.documentElement.classList.add("dark");
                }
              }
            } catch (error) {
              document.documentElement.classList.add("dark");
            }
          `}
        </Script>
        <PortalProvider>{children}</PortalProvider>
      </body>
    </html>
  );
}
