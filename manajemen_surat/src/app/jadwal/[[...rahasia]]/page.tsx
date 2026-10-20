"use client";

/**
 * ============================================================================
 * JADWAL SIDANG LEWAT TAUTAN  -  /aleta/jadwal/<rahasia>   (20 Oktober 2026)
 * ============================================================================
 *
 * Diminta pengguna: tampilan yang tinggal diberi alamatnya untuk menampilkan
 * jadwal sidang, dengan tombol terbatas, TANPA masuk akun.
 *
 *     /aleta/jadwal/<rahasia>
 *     /aleta/jadwal/<rahasia>?tanggal=2026-10-21&ruang=1&majelis=A
 *
 * Rahasianya dibuat Super Admin/Admin (Akses Publik > Tautan Jadwal Sidang),
 * hanya berlaku dari jaringan kantor, dan dapat dicabut. Halaman ini hanya
 * MEMASANG komponen Jadwal Sidang yang sama (tanpa menu samping dan kepala
 * portal) dalam mode alamat; semua penjagaan ada di server
 * (@/server/modules/tautan-jadwal). Tanpa rahasia yang sah halaman ini
 * menolak dengan kalimat biasa dan tidak menampilkan jadwal apa pun.
 */

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { KonteksPenggunaTautan, usePortal } from "@/lib/app-state";
import { apiPath, getBasePath } from "@/lib/base-path";
import {
  HEADER_TAUTAN_JADWAL,
  bacaParameterJadwal,
  pasangRahasiaTautanPadaFetch,
  type ParameterJadwalTampil,
} from "@/lib/jadwal-tampil-url";
import type { RoleId } from "@/lib/types";

const AletaEcourtSidang = dynamic(
  () => import("@/components/portal/aleta-ecourt-sidang").then((m) => m.AletaEcourtSidang),
  { ssr: false, loading: () => <div className="min-h-[28rem] animate-pulse rounded-[1.4rem] border border-border bg-muted/30" /> }
);

type Pengguna = { id: string; name: string; roleId: RoleId; positionId: string; additionalRoleIds?: string[] };
type Keadaan =
  | { tahap: "memeriksa" }
  | { tahap: "ditolak"; pesan: string }
  | { tahap: "siap"; nama: string; pengguna: Pengguna };

function Kartu({ judul, pesan }: { judul: string; pesan: string }) {
  return (
    <div
      role="alert"
      data-tautan-ditolak=""
      className="mx-auto mt-10 max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-sm"
    >
      <p className="text-base font-semibold">{judul}</p>
      <p className="mt-2 text-sm text-muted-foreground">{pesan}</p>
    </div>
  );
}

export default function HalamanJadwalTautan() {
  const { institutionIdentity } = usePortal();
  const params = useParams<{ rahasia?: string | string[] }>();
  const mentah = params?.rahasia;
  const rahasia = (Array.isArray(mentah) ? mentah[0] : mentah) ?? "";
  const [parameter, setParameter] = useState<ParameterJadwalTampil | null>(null);
  const [keadaan, setKeadaan] = useState<Keadaan>({ tahap: "memeriksa" });

  useEffect(() => {
    document.title = "Jadwal Sidang | ALETA";
    // Dibaca sesudah terpasang: halaman ini digambar di peladen lebih dulu, dan
    // nilai awal yang berbeda melahirkan salah hidrasi.
    const pengatur = window.setTimeout(() => setParameter(bacaParameterJadwal(window.location.search)), 0);
    return () => window.clearTimeout(pengatur);
  }, []);

  // Memeriksa rahasia di server, lalu (bila sah) memasangnya pada setiap
  // permintaan komponen jadwal. Dilepas lagi saat halaman ditinggalkan.
  useEffect(() => {
    if (!rahasia) {
      const pengatur = window.setTimeout(
        () => setKeadaan({ tahap: "ditolak", pesan: "Alamat tautan tidak lengkap. Minta admin ALETA menyediakan tautan jadwal sidang." }),
        0
      );
      return () => window.clearTimeout(pengatur);
    }
    let batal = false;
    let lepas: (() => void) | null = null;
    void (async () => {
      try {
        const jawaban = await fetch(apiPath("/api/jadwal-tautan/sesi"), {
          cache: "no-store",
          headers: { [HEADER_TAUTAN_JADWAL]: rahasia },
        });
        const isi = (await jawaban.json().catch(() => ({}))) as {
          data?: { nama?: string; pengguna?: Pengguna };
          error?: { message?: string };
        };
        if (batal) return;
        if (!jawaban.ok || !isi?.data?.pengguna) {
          setKeadaan({ tahap: "ditolak", pesan: isi?.error?.message || "Tautan ini tidak dapat dibuka." });
          return;
        }
        lepas = pasangRahasiaTautanPadaFetch(rahasia, getBasePath());
        setKeadaan({ tahap: "siap", nama: String(isi.data.nama || ""), pengguna: isi.data.pengguna });
      } catch {
        if (!batal) setKeadaan({ tahap: "ditolak", pesan: "Server ALETA belum dapat dihubungi. Muat ulang halaman ini beberapa saat lagi." });
      }
    })();
    return () => {
      batal = true;
      lepas?.();
    };
  }, [rahasia]);

  return (
    <main className="min-h-screen bg-background text-foreground" data-halaman-jadwal-tautan="">
      <div className="mx-auto w-full max-w-[2400px] space-y-3 px-3 py-3 sm:px-5 sm:py-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <AletaLogo size="sm" title="ALETA" subtitle={institutionIdentity?.courtName || undefined} />
          <ThemeToggle />
        </header>

        {keadaan.tahap === "memeriksa" ? (
          <div aria-busy="true" data-jadwal-menunggu="" className="min-h-[28rem] animate-pulse rounded-[1.4rem] border border-border bg-muted/30" />
        ) : null}

        {keadaan.tahap === "ditolak" ? <Kartu judul="Jadwal sidang tidak dapat dibuka" pesan={keadaan.pesan} /> : null}

        {keadaan.tahap === "siap" && parameter ? (
          <KonteksPenggunaTautan pengguna={keadaan.pengguna}>
            <AletaEcourtSidang
              modeUrl
              awal={parameter}
              namaTautan={keadaan.nama}
              // Cetak relaas menuntut juru sita/ekstensi di komputer petugas -
              // tidak ada lewat tautan. Nomor perkara dan tombol Status membuka
              // halaman portal yang menuntut masuk akun, jadi jalannya tidak
              // disediakan di sini (nomor tampil sebagai teks biasa).
              bolehCetakRelaas={false}
            />
          </KonteksPenggunaTautan>
        ) : null}
      </div>
    </main>
  );
}
