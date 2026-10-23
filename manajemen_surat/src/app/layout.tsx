import type { Metadata, Viewport } from "next";

import "@/app/globals.css";
import { DEFAULT_INSTITUTION_LOGO_PATH } from "@/lib/institution-logo";
import { InstallGate } from "@/components/install/install-gate";
import { PendengarPasangAplikasi } from "@/components/layout/pasang-aplikasi";
import { PortalProvider } from "@/lib/app-state";
import { withBasePath } from "@/lib/base-path";
import { GlobalLoadingProvider } from "@/lib/global-loading";
import { SKRIP_TEMA_AWAL } from "@/lib/tema-skrip-awal";

export const metadata: Metadata = {
  title: "ALETA | Akses Layanan Elektronik Terpadu Aksesibel",
  description: "ALETA adalah induk aplikasi layanan elektronik terpadu, dengan Manajemen Surat sebagai sub-modul utama untuk surat, disposisi, monitoring, dan kontrol akses.",
  // 23 Okt 2026: dapat dipasang ke layar utama HP (lihat src/lib/pasang-aplikasi.ts).
  applicationName: "ALETA",
  appleWebApp: { capable: true, title: "ALETA", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6eef5" },
    { media: "(prefers-color-scheme: dark)", color: "#0b141e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning data-scroll-behavior="smooth" style={{ scrollBehavior: 'smooth' }}>
      <head>
        <link rel="icon" href={withBasePath(DEFAULT_INSTITUTION_LOGO_PATH)} />
        <link rel="apple-touch-icon" href={withBasePath("/ikon-aplikasi/180")} />
        {/*
          Tema (terang | gelap | ikuti sistem) dipasang SINKRON di sini, sebelum lukis pertama dan sebelum
          React. Kelas `dark` TIDAK lagi ditulis di <html> oleh layout: satu penulis saja (skrip ini lalu
          tema-pilihan.ts), supaya React tidak pernah menulis ulang kelas yang sudah diputuskan skrip.
          Lihat tema-pilihan.ts untuk sebab kedip dan aturannya.
        */}
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA_AWAL }} />
      </head>
      <body className="font-sans bg-background text-foreground transition-colors duration-300">
        <GlobalLoadingProvider>
          <PortalProvider>
            <InstallGate />
            <PendengarPasangAplikasi />
            {children}
          </PortalProvider>
        </GlobalLoadingProvider>
      </body>
    </html>
  );
}
