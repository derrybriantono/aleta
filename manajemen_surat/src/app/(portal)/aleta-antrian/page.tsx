"use client";

import { AletaAntrianLayar } from "@/components/portal/aleta-antrian-layar";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";

/**
 * Layar antrian sidang - untuk televisi ruang tunggu.
 *
 * Halamannya sendiri, bukan tab di dalam panel e-Court: layar ini dibuka
 * sekali lalu dibiarkan menyala sepanjang hari pada perangkat yang tidak
 * disentuh siapa pun. Menaruhnya sebagai tab berarti sekali salah klik ia
 * berpindah dan tidak ada yang menyadarinya sampai ada yang bertanya kenapa
 * layarnya menampilkan daftar berkas.
 *
 * ============================================================================
 * PETA LAYAR ANTRIAN
 * ============================================================================
 *
 * Seluruh layar antrian sudah berjalan, tetapi sebelum ini tidak ada satu pun
 * tautan menuju ke sana - alamatnya hanya disebut di catatan rilis, dan
 * catatan rilis bukan tempat orang mencari cara membuka sebuah layar.
 *
 * Petanya diletakkan di atas, kecil, dan hanya di halaman portal ini -
 * televisi ruang tunggu memakai /antrian-layar yang bersih tanpa apa pun.
 * Alamatnya ditulis apa adanya, bukan disembunyikan di balik tautan: yang
 * membuka televisi harus MENGETIKKAN alamat itu di peramban perangkat lain.
 */
export default function AletaAntrianPage() {
  const { accessiblePortalApps } = usePortal();
  // Antrian sekarang punya menunya sendiri, tetapi kewenangannya tetap
  // menumpang e-Court: petugas yang sudah boleh membuka jadwal sidang boleh
  // pula memanggil antriannya. Keduanya diterima supaya pemberian akses
  // terpisah - bila suatu saat diperlukan - tidak menutup layar ini bagi yang
  // sudah memakainya.
  const boleh = accessiblePortalApps.some(
    (app) => app.id === "aleta-ecourt" || app.id === "aleta-antrian"
  );

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="space-y-4">
      <PetaLayar />
      <AletaAntrianLayar />
    </div>
  );
}

/** Satu layar, satu baris: untuk siapa, di mana, dan perlu login atau tidak. */
const LAYAR = [
  {
    href: "/aleta-antrian/ambil",
    label: "Ambil antrian",
    untuk: "Petugas",
    login: true,
    keterangan:
      "Mencatat siapa yang hadir; nomor antrian terbit dari kehadiran pertama pada satu perkara.",
  },
  {
    href: "/aleta-antrian/panggil",
    label: "Papan panggil",
    untuk: "Petugas ruang sidang",
    login: true,
    keterangan: "Memanggil nomor berikutnya, dengan hitungan panggilan sampai batas tiga kali.",
  },
  {
    href: "/antrian",
    label: "Kios pihak",
    untuk: "Para pihak",
    login: false,
    keterangan:
      "Layar sentuh ruang tunggu. Pihak mencari perkaranya sendiri lewat nama atau nomor, lalu mengambil nomornya.",
  },
  {
    href: "/antrian-layar",
    label: "Layar televisi",
    untuk: "Ruang tunggu",
    login: false,
    keterangan:
      "Nomor yang sedang dipanggil, besar, beserta panggilan suara. Dibuka sekali lalu dibiarkan menyala.",
  },
  {
    // Papan pintu ruang sidang. Berbeda dari layar ruang tunggu: yang ini
    // menghadap SATU pintu, dan orang yang berdiri di depannya sudah tahu
    // nomornya - yang ia perlukan kepastian bahwa ini benar ruangannya.
    href: "/sidang-ruang?ruang=1",
    label: "Papan pintu ruang sidang",
    untuk: "Depan ruang sidang",
    login: false,
    keterangan:
      "Perkara yang sedang bersidang beserta nama para pihak, dan yang berikutnya. Ganti ?ruang=1 sesuai ruangannya.",
  },
  {
    href: "/antrian-ruang",
    label: "Halaman cepat per ruang",
    untuk: "Petugas sidang",
    login: false,
    keterangan: "Hanya nomor, ruang, dan keadaannya - cukup untuk melihat giliran dari ponsel.",
  },
];

function PetaLayar() {
  return (
    <details className="rounded-xl border bg-card p-3" open>
      <summary className="cursor-pointer text-sm font-semibold">
        Layar antrian lainnya
        <span className="ml-2 font-normal text-muted-foreground">
          ambil nomor, papan panggil, kios pihak, televisi
        </span>
      </summary>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {LAYAR.map((satu) => (
          <a
            key={satu.href}
            href={apiPath(satu.href)}
            className="rounded-lg border bg-muted/20 p-3 transition hover:border-primary/50 hover:bg-muted/40"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{satu.label}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {satu.untuk}
              </span>
              {satu.login ? null : (
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                  tanpa login
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{satu.keterangan}</p>
            {/* Alamatnya ditulis apa adanya: yang memasang televisi ruang
                tunggu harus mengetikkannya di peramban perangkat lain, dan
                alamat yang hanya ada di balik tautan tidak dapat disalin ke
                sana. */}
            <p className="mt-1 font-mono text-xs text-muted-foreground">{satu.href}</p>
          </a>
        ))}
      </div>

      <p className="mt-3 border-t pt-2 text-sm text-muted-foreground">
        Pihak yang belum berangkat dapat mengambil nomornya lewat WhatsApp ALETA - jalur itu dan
        kios ruang tunggu masuk ke deret antrian yang sama, diurut menurut waktu pengambilannya.
      </p>
    </details>
  );
}
