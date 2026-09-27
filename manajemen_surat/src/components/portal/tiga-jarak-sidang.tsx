"use client";

import { useSyncExternalStore } from "react";

import {
  detikBerjalan,
  jamBerjalan,
  jamDari,
  pitaAntarPanggilan,
  pitaTunggu,
  sebutanDurasi,
  sebutanDurasiLengkap,
  type BarisWaktuAntrian,
  type Jarak,
  type TetanggaJarak,
  type TigaJarak,
} from "@/lib/tiga-jarak-sidang";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * TIGA JARAK WAKTU DI KOLOM ANTRIAN - DAN YANG BERDETAK
 * ============================================================================
 *
 * Hitungannya di lib/tiga-jarak-sidang.ts; berkas ini hanya menggambarnya.
 *
 * ============================================================================
 * SATU PENGATUR WAKTU UNTUK SELURUH LAYAR, DAN HANYA ANGKANYA YANG DILUKIS ULANG
 * ============================================================================
 *
 * Diminta "secara real time". Jadwal sidang adalah tabel puluhan baris yang
 * berat - menyimpan detik di state halaman berarti melukis ulang seluruh
 * tabel tiap detik untuk mengubah dua-tiga angka.
 *
 * Yang dipakai: satu setInterval bersama (useSyncExternalStore) yang hanya
 * didengar oleh angka-angka yang SEDANG berjalan. Tiap detik hanya komponen
 * kecil itu yang dilukis ulang; tabelnya tidak. Pengatur waktunya berhenti
 * sendiri begitu tidak ada lagi yang mendengar - misalnya saat hari lampau
 * yang dibuka, yang tidak punya satu pun angka berjalan.
 *
 * ============================================================================
 * JAM KOMPUTER PETUGAS TIDAK DIPERCAYA
 * ============================================================================
 *
 * "Sekarang" datang dari basis data antrian bersama datanya (NOW() yang sama
 * dengan yang menulis waktu ambil dan waktu panggil). Dari komputer petugas
 * hanya diambil BEDA Date.now() sejak data itu diterima: jam komputer yang
 * salah setel dua puluh menit tetap memberi beda yang benar, dan laptop yang
 * ditutup sepanjang siang tetap terhitung - yang tidak dijamin
 * performance.now().
 */

export type PatokanWaktu = {
  /** "sekarang" basis antrian saat data diterima, dibaca bacaWaktu. */
  sekarangMs: number;
  /** Date.now() peramban saat data itu diterima. */
  diterimaMs: number;
};

const pendengar = new Set<() => void>();
let detak = 0;
let pewaktu: ReturnType<typeof setInterval> | null = null;

function langgan(beritahu: () => void) {
  pendengar.add(beritahu);
  if (pewaktu === null) {
    pewaktu = setInterval(() => {
      detak += 1;
      for (const f of pendengar) f();
    }, 1000);
  }
  return () => {
    pendengar.delete(beritahu);
    if (pendengar.size === 0 && pewaktu !== null) {
      clearInterval(pewaktu);
      pewaktu = null;
    }
  };
}

/** Berapa pendengar detak yang sedang hidup - untuk pengujian. */
export function jumlahPendengarDetak(): number {
  return pendengar.size;
}

function useDetak(): number {
  return useSyncExternalStore(langgan, () => detak, () => 0);
}

/** "Sekarang" menurut jam aplikasi antrian: patokan + waktu yang berlalu di peramban. */
export function sekarangAntrianMs(patokan: PatokanWaktu, kiniMs: number = Date.now()): number {
  return patokan.sekarangMs + (kiniMs - patokan.diterimaMs);
}

const KEPING =
  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums";
const NETRAL = "border-border bg-muted/60 text-foreground";
const JANGGAL =
  "border-dashed border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400/70 dark:bg-amber-500/10 dark:text-amber-100";

type Jenis = "tunggu" | "sebelum" | "sidang";

function kelasPita(jenis: Jenis, detik: number, ambangTungguMenit: number): string {
  const menit = detik / 60;
  const pita = jenis === "tunggu" ? pitaTunggu(menit, ambangTungguMenit) : pitaAntarPanggilan(menit);
  return pita?.kelas ?? NETRAL;
}

/** Titik "berjalan". Berdenyut hanya bila pembacanya tidak meminta gerak dikurangi. */
function TitikBerjalan() {
  return <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" />;
}

/**
 * Angka yang berjalan - komponen kecil yang BERDETAK SENDIRI.
 *
 * Warnanya ikut dihitung di sini, bukan di baris induknya: "Tunggu" yang
 * melewati empat puluh menit harus memerah pada detik itu juga, bukan pada
 * muat ulang berikutnya.
 */
function DurasiBerjalan({
  jarak,
  patokan,
  jenis,
  ambangTungguMenit,
  judul,
}: {
  jarak: Jarak;
  patokan: PatokanWaktu;
  jenis: Jenis;
  ambangTungguMenit: number;
  judul: string;
}) {
  useDetak();
  const detik = detikBerjalan(jarak, sekarangAntrianMs(patokan));
  if (detik === null) {
    // Mulainya SESUDAH "sekarang" menurut jam antrian - datanya bertentangan.
    // Tidak ditampilkan sebagai 00:00: nol berarti "baru saja", dan itu
    // keterangan yang berbeda sama sekali.
    return (
      <span className={cn(KEPING, JANGGAL)} title="Waktu mulainya sesudah jam aplikasi antrian sekarang - datanya bertentangan.">
        janggal
      </span>
    );
  }
  return (
    <>
      <span className={cn(KEPING, kelasPita(jenis, detik, ambangTungguMenit))} title={judul}>
        <TitikBerjalan />
        {jamBerjalan(detik)}
      </span>
      <span className="text-[10px] text-muted-foreground">berjalan</span>
    </>
  );
}

function catatanPanggilUlang(baris: BarisWaktuAntrian | undefined): string {
  if (!baris || !(baris.jumlahPanggil > 1)) return "";
  return (
    ` Dipanggil ${baris.jumlahPanggil} kali; yang dipakai panggilan TERAKHIR.` +
    (baris.panggilPertama ? ` Panggilan pertama yang tercatat pukul ${jamDari(baris.panggilPertama)}.` : "")
  );
}

function judulJarak(
  jenis: Jenis,
  jarak: Jarak,
  tiga: TigaJarak,
  baris: BarisWaktuAntrian | undefined,
  sebutTetangga: (t: TetanggaJarak) => string
): string {
  const lengkap = (d: number | null) => sebutanDurasiLengkap(d ?? 0);
  if (jarak.keadaan === "selesai") {
    if (jenis === "tunggu") {
      return (
        `Mengambil nomor antrian ${jamDari(jarak.dari)}, dipanggil masuk ${jamDari(jarak.sampai)} - ` +
        `menunggu ${lengkap(jarak.detik)}.${catatanPanggilUlang(baris)}`
      );
    }
    const t = jarak.tetangga ? sebutTetangga(jarak.tetangga) : "perkara lain";
    if (jenis === "sebelum") {
      return (
        `Dipanggil ${jamDari(jarak.sampai)}, ${lengkap(jarak.detik)} sesudah ${t} dipanggil ${jamDari(jarak.dari)} ` +
        `di ${tiga.ruang}. Pembandingnya perkara yang dipanggil TEPAT SEBELUMNYA di ruang yang sama menurut jam ` +
        `panggil - bukan baris di atasnya pada tabel, yang dapat sedang tersaring atau terurut lain.`
      );
    }
    return (
      `Dipanggil ${jamDari(jarak.dari)}; perkara berikutnya di ${tiga.ruang} - ${t} - dipanggil ` +
      `${jamDari(jarak.sampai)}. Lama sidang ${lengkap(jarak.detik)}.${catatanPanggilUlang(baris)}`
    );
  }
  if (jarak.keadaan === "berjalan") {
    return jenis === "tunggu"
      ? `Mengambil nomor antrian ${jamDari(jarak.dari)} dan belum dipanggil masuk - masih menunggu. ` +
          "Dihitung menurut jam aplikasi antrian, bukan jam komputer ini."
      : `Dipanggil ${jamDari(jarak.dari)} dan belum ada perkara berikutnya yang dipanggil di ${tiga.ruang} - ` +
          "sidangnya dianggap masih berjalan. Dihitung menurut jam aplikasi antrian, bukan jam komputer ini.";
  }
  return jarak.sebab;
}

function IsiJarak({
  jenis,
  jarak,
  tiga,
  baris,
  patokan,
  ambangTungguMenit,
  sebutTetangga,
}: {
  jenis: Jenis;
  jarak: Jarak;
  tiga: TigaJarak;
  baris: BarisWaktuAntrian | undefined;
  patokan: PatokanWaktu | null;
  ambangTungguMenit: number;
  sebutTetangga: (t: TetanggaJarak) => string;
}) {
  const judul = judulJarak(jenis, jarak, tiga, baris, sebutTetangga);
  switch (jarak.keadaan) {
    case "selesai":
      return (
        <span className={cn(KEPING, kelasPita(jenis, jarak.detik ?? 0, ambangTungguMenit))} title={judul}>
          {sebutanDurasi(jarak.detik ?? 0)}
        </span>
      );
    case "berjalan":
      return patokan ? (
        <DurasiBerjalan
          jarak={jarak}
          patokan={patokan}
          jenis={jenis}
          ambangTungguMenit={ambangTungguMenit}
          judul={judul}
        />
      ) : (
        <span
          className="text-[10px] italic text-muted-foreground"
          title={`${judul} Jam aplikasi antrian tidak terbaca, sehingga lamanya tidak dapat dihitung di sini.`}
        >
          berjalan
        </span>
      );
    case "janggal":
      return (
        <span className={cn(KEPING, JANGGAL)} title={judul}>
          janggal
        </span>
      );
    case "tidak-diketahui":
      return (
        <span className="text-[10px] italic text-muted-foreground" title={judul}>
          tidak diketahui
        </span>
      );
    default:
      return (
        <span className="text-[10px] text-muted-foreground" title={judul}>
          pertama
        </span>
      );
  }
}

/**
 * Tiga jarak satu sidang, bernama, di bawah nomor antriannya.
 *
 * Baris yang memang tidak punya pertanyaan TIDAK digambar: yang belum
 * dipanggil tidak punya "Dari sebelumnya" dan "Lama sidang", yang belum
 * mengambil nomor tidak punya "Tunggu". Satu pengecualian: perkara PERTAMA di
 * ruangnya tetap menyebut "pertama" pada "Dari sebelumnya" - itu keterangan
 * tentang urutan, bukan kekosongan, dan bukan nol.
 */
export function TigaJarakSidang({
  tiga,
  baris,
  patokan,
  ambangTungguMenit,
  sebutTetangga,
  nomorRekaman,
}: {
  tiga: TigaJarak | undefined;
  baris: BarisWaktuAntrian | undefined;
  patokan: PatokanWaktu | null;
  ambangTungguMenit: number;
  sebutTetangga: (t: TetanggaJarak) => string;
  /**
   * Nomor antrian dari buku waktu, disebut bila kolomnya sendiri tidak
   * menyebut nomor - hari lampau yang barisnya sudah tidak ada di aplikasi
   * antrian.
   */
  nomorRekaman?: number | null;
}) {
  if (!tiga) return null;
  const daftar: Array<{ jenis: Jenis; label: string; jarak: Jarak }> = [];
  if (tiga.tunggu.keadaan !== "kosong") daftar.push({ jenis: "tunggu", label: "Tunggu", jarak: tiga.tunggu });
  if (tiga.dariSebelumnya.keadaan !== "kosong" || tiga.urutanRuang === 1) {
    daftar.push({ jenis: "sebelum", label: "Dari sebelumnya", jarak: tiga.dariSebelumnya });
  }
  if (tiga.lamaSidang.keadaan !== "kosong") daftar.push({ jenis: "sidang", label: "Lama sidang", jarak: tiga.lamaSidang });
  if (daftar.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5 text-[10px] leading-tight" data-tiga-jarak={tiga.kunci}>
      {typeof nomorRekaman === "number" ? (
        <div
          className="text-muted-foreground"
          title="Nomor antrian menurut buku waktu ALETA - aplikasi antrian sudah tidak menyimpan baris hari ini."
        >
          antrian {nomorRekaman} · rekaman
        </div>
      ) : null}
      {daftar.map(({ jenis, label, jarak }) => (
        <div key={jenis} className="flex items-center gap-1" data-jarak={jenis} data-keadaan={jarak.keadaan}>
          <span className="w-[5.2rem] shrink-0 text-muted-foreground">{label}</span>
          <IsiJarak
            jenis={jenis}
            jarak={jarak}
            tiga={tiga}
            baris={baris}
            patokan={patokan}
            ambangTungguMenit={ambangTungguMenit}
            sebutTetangga={sebutTetangga}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Penanda "menunggu lama" yang berjalan - angka dan warnanya SAMA dengan
 * "Tunggu" di bawahnya, sebab keduanya membaca jarak yang sama dari patokan
 * yang sama. Muncul sendiri pada detik ambangnya terlewati.
 */
export function LencanaMenungguBerjalan({
  jarak,
  patokan,
  ambangMenit,
}: {
  jarak: Jarak;
  patokan: PatokanWaktu;
  ambangMenit: number;
}) {
  useDetak();
  const detik = detikBerjalan(jarak, sekarangAntrianMs(patokan));
  if (detik === null || detik / 60 < ambangMenit) return null;
  return (
    <div className="mt-0.5">
      <span
        className={cn(KEPING, kelasPita("tunggu", detik, ambangMenit))}
        title={`Pihaknya mengambil nomor ${jamDari(jarak.dari)} dan belum dipanggil masuk - sudah ${sebutanDurasiLengkap(
          detik
        )}. Dihitung menurut jam aplikasi antrian.`}
      >
        menunggu {jamBerjalan(detik)}
      </span>
    </div>
  );
}

/**
 * Keterangan singkat ketiga angka, dalam bahasa sehari-hari. Ambangnya
 * dikirim, tidak ditulis di sini - lihat pitaTunggu.
 */
export function LegendaTigaJarak({ ambangTungguMenit }: { ambangTungguMenit: number }) {
  return (
    <p className="mb-2 text-[11px] leading-snug text-muted-foreground" data-legenda-tiga-jarak>
      <span className="font-semibold text-foreground">Tiga angka waktu di kolom Antrian: </span>
      <span className="font-semibold text-foreground">Tunggu</span> - sejak pihak mengambil nomor antrian sampai
      perkaranya dipanggil masuk (memerah sesudah {ambangTungguMenit} menit).{" "}
      <span className="font-semibold text-foreground">Dari sebelumnya</span> - sejak perkara sebelumnya di ruang
      yang sama dipanggil sampai perkara ini dipanggil; perkara pertama di ruangnya tertulis &ldquo;pertama&rdquo;.{" "}
      <span className="font-semibold text-foreground">Lama sidang</span> - sejak perkara ini dipanggil sampai
      perkara berikutnya di ruang itu dipanggil. Angka menit:detik bertanda &ldquo;berjalan&rdquo; masih dihitung
      menurut jam aplikasi antrian, bukan jam komputer ini. Arahkan kursor ke angkanya untuk melihat jam dan
      perkara pembandingnya.
    </p>
  );
}
