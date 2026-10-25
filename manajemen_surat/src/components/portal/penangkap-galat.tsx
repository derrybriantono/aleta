"use client";

import { useEffect } from "react";

import { apiPath } from "@/lib/base-path";

/**
 * Penangkap galat peramban (E2, 25 Okt 2026): galat yang tidak tertangkap dan
 * penolakan janji yang tidak ditangani di halaman portal dilaporkan ke
 * Catatan galat (Admin > Pusat kesehatan). Tidak menampilkan apa pun, tidak
 * mengubah perilaku halaman, dan tidak pernah melempar.
 *
 * Dibatasi: satu laporan per detik dan 10 per halaman dibuka; yang sama persis
 * dalam satu menit tidak dikirim ulang. Portal membersihkan isinya (sandi,
 * token, alamat berkueri, NIK) sebelum menyimpan.
 */
const BATAS_PER_HALAMAN = 10;

export function PenangkapGalat() {
  useEffect(() => {
    let terkirim = 0;
    let terakhir = 0;
    const baru = new Map<string, number>();

    const lapor = (jenis: string, pesan: string, stack: string) => {
      try {
        const kini = Date.now();
        if (terkirim >= BATAS_PER_HALAMAN || kini - terakhir < 1000) return;
        const kunci = `${jenis}|${pesan}`;
        const sebelum = baru.get(kunci);
        if (sebelum && kini - sebelum < 60_000) return;
        baru.set(kunci, kini);
        terakhir = kini;
        terkirim += 1;
        void fetch(apiPath("/api/portal/galat"), {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          keepalive: true,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sumber: "peramban",
            jenis: jenis.slice(0, 60),
            pesan: pesan.slice(0, 500),
            stack: stack.slice(0, 1500),
            lokasi: window.location.pathname,
            halaman: window.location.pathname,
          }),
        }).catch(() => {});
      } catch {
        /* melapor gagal: dilewati */
      }
    };

    const saatGalat = (e: ErrorEvent) => {
      // Galat pemuatan sumber (gambar/skrip) tidak membawa pesan: tidak dicatat.
      if (!e.message) return;
      const galat = e.error as { name?: string; stack?: string } | undefined;
      lapor(galat?.name || "Error", e.message, galat?.stack || "");
    };
    const saatPenolakan = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string; stack?: string } | string | undefined;
      if (r && typeof r === "object") lapor(r.name || "UnhandledRejection", r.message || String(r), r.stack || "");
      else lapor("UnhandledRejection", String(r ?? ""), "");
    };

    window.addEventListener("error", saatGalat);
    window.addEventListener("unhandledrejection", saatPenolakan);
    return () => {
      window.removeEventListener("error", saatGalat);
      window.removeEventListener("unhandledrejection", saatPenolakan);
    };
  }, []);

  return null;
}
