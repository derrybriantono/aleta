"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";
import { authClient } from "@/lib/auth-client";

/**
 * Layar dan pita Mode pemeliharaan (E3, 25 Okt 2026).
 *
 *   HalamanPemeliharaan  menggantikan seluruh portal bagi pengguna yang tidak
 *                        dikecualikan; menanyakan keadaan tiap 15 detik dan
 *                        MEMUAT ULANG SENDIRI begitu pemeliharaan selesai.
 *                        Tetap bertanya walau server sedang dimulai ulang
 *                        (jawaban gagal = coba lagi).
 *   PitaPemeliharaan     pita kuning: jadwal akan mulai (sejak 60 menit
 *                        sebelumnya) atau - bagi yang dikecualikan - mode
 *                        sedang aktif. Bertanya tiap 2 menit; tidak muncul
 *                        apa pun bila tidak ada pemeliharaan.
 */
export type KeadaanPublik = {
  aktif: boolean;
  sebab: "manual" | "jadwal" | null;
  pesan: string;
  selesaiPerkiraan: string;
  mulaiDijadwalkan: string;
  menitSampaiMulai: number | null;
};

async function tanyaKeadaan(): Promise<KeadaanPublik | null> {
  try {
    const r = await fetch(apiPath("/api/public/pemeliharaan"), { cache: "no-store" });
    const j = (await r.json()) as { ok?: boolean; data?: KeadaanPublik };
    return r.ok && j.ok && j.data ? j.data : null;
  } catch {
    return null;
  }
}

function jamWita(iso: string) {
  if (!iso) return "";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "" : t.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
}

export function HalamanPemeliharaan({ awal }: { awal: KeadaanPublik }) {
  const [keadaan, setKeadaan] = useState<KeadaanPublik>(awal);

  useEffect(() => {
    const jam = setInterval(() => {
      void tanyaKeadaan().then((k) => {
        if (k && !k.aktif) window.location.reload();
        else if (k) setKeadaan(k);
      });
    }, 15_000);
    return () => clearInterval(jam);
  }, []);

  const selesai = jamWita(keadaan.selesaiPerkiraan);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6" data-halaman-pemeliharaan>
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <Wrench className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">ALETA sedang dalam pemeliharaan</h1>
        <p className="text-base text-foreground">{keadaan.pesan}</p>
        {selesai && <p className="text-sm text-muted-foreground">Perkiraan selesai pukul {selesai} WITA.</p>}
        <p className="text-sm text-muted-foreground">Halaman ini memeriksa sendiri dan terbuka kembali begitu pemeliharaan selesai.</p>
        <Button
          variant="outline"
          onClick={() => {
            void authClient.signOut().finally(() => window.location.reload());
          }}
        >
          Keluar dari akun
        </Button>
      </div>
    </main>
  );
}

export function PitaPemeliharaan({ awal, dikecualikan }: { awal: KeadaanPublik | null; dikecualikan: boolean }) {
  const [keadaan, setKeadaan] = useState<KeadaanPublik | null>(awal);

  useEffect(() => {
    const jam = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void tanyaKeadaan().then((k) => {
        if (k) setKeadaan(k);
      });
    }, 120_000);
    return () => clearInterval(jam);
  }, []);

  if (!keadaan) return null;
  const akanMulai = !keadaan.aktif && keadaan.menitSampaiMulai !== null;
  if (!(keadaan.aktif && dikecualikan) && !akanMulai) return null;

  return (
    <div className="border-b border-amber-300/70 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/80 dark:text-amber-200" role="status" data-pita-pemeliharaan>
      {akanMulai ? (
        <>
          Pemeliharaan ALETA dimulai pukul {jamWita(keadaan.mulaiDijadwalkan)} WITA ({keadaan.menitSampaiMulai} menit lagi)
          {keadaan.selesaiPerkiraan ? `, perkiraan selesai ${jamWita(keadaan.selesaiPerkiraan)} WITA` : ""}. Simpan pekerjaan Anda sebelum itu: selama pemeliharaan perubahan data dihentikan.
        </>
      ) : (
        <>Mode pemeliharaan sedang aktif. Pengguna lain melihat layar pemeliharaan dan tidak dapat menyimpan perubahan; Anda dikecualikan.</>
      )}
    </div>
  );
}
