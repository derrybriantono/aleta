"use client";

import { useSyncExternalStore } from "react";

import {
  detikBerjalan,
  jamBerjalan,
  jamDari,
  pitaAntarPanggilan,
  pitaTunggu,
  sebutanDurasiLengkap,
  sebutanDurasiRingkas,
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

/**
 * ============================================================================
 * TIGA PIL DALAM SATU DERET, BUKAN TIGA BARIS BERLABEL
 * ============================================================================
 *
 * Diminta pengguna 28 September 2026: "kolom Tunggu, Dari sebelumnya dan Lama
 * sidang terlalu memakan space makanya kolom antrian/jam jadi lebar". Yang
 * lama tiga baris bertumpuk - label selebar 5,2rem di kiri, lencana di kanan -
 * dan lencana "1 jam 19 menit" yang dapat melipat di dalam dirinya sendiri
 * menjadi bulatan merah tiga baris.
 *
 * Tiga tata letak ditimbang:
 *
 *   (a) tiga pil kecil yang MEMBAWA labelnya sendiri - "Tunggu 1j 19m",
 *       "Dari sblm pertama", "Lama 7m" - dalam satu deret yang boleh
 *       melipat. Kolom selebar pil terlebar (sekitar 90 px), bukan selebar
 *       label ditambah lencana. Warna pita meliputi seluruh pil;
 *   (b) kisi dua kolom berlabel satu huruf (T / S / L) - paling sempit,
 *       tetapi tiga huruf itu harus dihafal, dan legendanya justru diminta
 *       dibuang;
 *   (c) satu baris teks "1j19m · pertama · 7m" berwarna, label hanya di
 *       title - paling ringkas, tetapi tidak dapat dibaca tanpa kursor, dan
 *       "pertama" di tengah tidak menyebut PERTAMA APA.
 *
 * Yang dipakai (a): namanya tetap terbaca tanpa kursor, dan tiap pil tidak
 * pernah melipat (whitespace-nowrap) - yang melipat hanya DERETNYA, di antara
 * pil. Angka selesai memakai bentuk ringkas (sebutanDurasiRingkas); bentuk
 * lengkapnya, arti tiap angka, jam, dan perkara pembandingnya ada di title.
 *
 * Legenda paragraf di atas tabel DIBUANG atas permintaan yang sama; isinya
 * pindah ke title tiap pil (ARTI di bawah), sehingga keterangannya tetap ada
 * tepat di tempat angkanya.
 */
const PIL =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums";
const KEPING = PIL;
const NETRAL = "border-border bg-muted/60 text-foreground";
const REDAM = "border-border/70 bg-transparent font-normal text-muted-foreground";
const JANGGAL =
  "border-dashed border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400/70 dark:bg-amber-500/10 dark:text-amber-100";

type Jenis = "tunggu" | "sebelum" | "sidang";

/** Label pendek di dalam pil - nama lengkapnya di awal title. */
const LABEL: Record<Jenis, { pendek: string; lengkap: string }> = {
  tunggu: { pendek: "Tunggu", lengkap: "Tunggu" },
  sebelum: { pendek: "Dari sblm", lengkap: "Dari sebelumnya" },
  sidang: { pendek: "Lama", lengkap: "Lama sidang" },
};

/** Arti tiap angka - isi legenda lama, kini di title pilnya sendiri. */
function arti(jenis: Jenis, ambangTungguMenit: number): string {
  switch (jenis) {
    case "tunggu":
      return (
        "Tunggu: sejak pihak mengambil nomor antrian sampai perkaranya dipanggil masuk " +
        `(memerah sesudah ${ambangTungguMenit} menit).`
      );
    case "sebelum":
      return (
        "Dari sebelumnya: sejak perkara sebelumnya di ruang yang sama dipanggil sampai perkara ini " +
        'dipanggil; perkara pertama di ruangnya tertulis "pertama".'
      );
    default:
      return "Lama sidang: sejak perkara ini dipanggil sampai perkara berikutnya di ruang itu dipanggil.";
  }
}

function kelasPita(jenis: Jenis, detik: number, ambangTungguMenit: number): string {
  const menit = detik / 60;
  const pita = jenis === "tunggu" ? pitaTunggu(menit, ambangTungguMenit) : pitaAntarPanggilan(menit);
  return pita?.kelas ?? NETRAL;
}

/** Titik "berjalan". Berdenyut hanya bila pembacanya tidak meminta gerak dikurangi. */
function TitikBerjalan() {
  return <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" />;
}

/** Label pendek di dalam pil - lebih ringan dari angkanya. */
function LabelPil({ jenis }: { jenis: Jenis }) {
  return <span className="font-normal opacity-75">{LABEL[jenis].pendek}</span>;
}

/**
 * Angka yang berjalan - komponen kecil yang BERDETAK SENDIRI.
 *
 * Warnanya ikut dihitung di sini, bukan di baris induknya: "Tunggu" yang
 * melewati empat puluh menit harus memerah pada detik itu juga, bukan pada
 * muat ulang berikutnya.
 *
 * Kata "berjalan" tidak lagi berdiri di samping pil - ia memakan lebar yang
 * justru diminta dihemat. Yang menandainya kini titik berdenyut dan detik yang
 * bergerak; katanya tetap ada untuk pembaca layar (sr-only) dan di title.
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
      <span
        className={cn(PIL, JANGGAL)}
        title={`${arti(jenis, ambangTungguMenit)}\nWaktu mulainya sesudah jam aplikasi antrian sekarang - datanya bertentangan.`}
      >
        <LabelPil jenis={jenis} />
        janggal
      </span>
    );
  }
  return (
    <span className={cn(PIL, kelasPita(jenis, detik, ambangTungguMenit))} title={judul}>
      <LabelPil jenis={jenis} />
      <TitikBerjalan />
      {jamBerjalan(detik)}
      <span className="sr-only"> berjalan</span>
    </span>
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


/** Satu pil: label pendek + angka (atau keadaannya), title berisi arti dan rinciannya. */
function PilJarak({
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
  const judul = `${arti(jenis, ambangTungguMenit)}\n${judulJarak(jenis, jarak, tiga, baris, sebutTetangga)}`;
  switch (jarak.keadaan) {
    case "selesai":
      return (
        <span className={cn(PIL, kelasPita(jenis, jarak.detik ?? 0, ambangTungguMenit))} title={judul}>
          <LabelPil jenis={jenis} />
          {sebutanDurasiRingkas(jarak.detik ?? 0)}
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
          className={cn(PIL, REDAM, "italic")}
          title={`${judul} Jam aplikasi antrian tidak terbaca, sehingga lamanya tidak dapat dihitung di sini.`}
        >
          <LabelPil jenis={jenis} />
          berjalan
        </span>
      );
    case "janggal":
      return (
        <span className={cn(PIL, JANGGAL)} title={judul}>
          <LabelPil jenis={jenis} />
          janggal
        </span>
      );
    case "tidak-diketahui":
      return (
        <span className={cn(PIL, REDAM, "border-dashed italic")} title={judul}>
          <LabelPil jenis={jenis} />
          tidak diketahui
        </span>
      );
    default:
      return (
        <span className={cn(PIL, REDAM)} title={judul}>
          <LabelPil jenis={jenis} />
          pertama
        </span>
      );
  }
}

/**
 * Tiga jarak satu sidang, bernama, di bawah nomor antriannya.
 *
 * Pil yang memang tidak punya pertanyaan TIDAK digambar: yang belum dipanggil
 * tidak punya "Dari sebelumnya" dan "Lama sidang", yang belum mengambil nomor
 * tidak punya "Tunggu". Satu pengecualian: perkara PERTAMA di ruangnya tetap
 * menyebut "pertama" pada "Dari sebelumnya" - itu keterangan tentang urutan,
 * bukan kekosongan, dan bukan nol.
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
  const daftar: Array<{ jenis: Jenis; jarak: Jarak }> = [];
  if (tiga.tunggu.keadaan !== "kosong") daftar.push({ jenis: "tunggu", jarak: tiga.tunggu });
  if (tiga.dariSebelumnya.keadaan !== "kosong" || tiga.urutanRuang === 1) {
    daftar.push({ jenis: "sebelum", jarak: tiga.dariSebelumnya });
  }
  if (tiga.lamaSidang.keadaan !== "kosong") daftar.push({ jenis: "sidang", jarak: tiga.lamaSidang });
  if (daftar.length === 0) return null;

  return (
    <div className="mt-1 text-[10px] leading-tight" data-tiga-jarak={tiga.kunci}>
      {typeof nomorRekaman === "number" ? (
        <div
          className="mb-0.5 text-muted-foreground"
          title="Nomor antrian menurut buku waktu ALETA - aplikasi antrian sudah tidak menyimpan baris hari ini."
        >
          antrian {nomorRekaman} · rekaman
        </div>
      ) : null}
      {/* Satu deret yang MELIPAT di antara pil, tidak di dalamnya. */}
      <div className="flex flex-wrap gap-1" data-deret-jarak>
        {daftar.map(({ jenis, jarak }) => (
          <span key={jenis} className="inline-flex" data-jarak={jenis} data-keadaan={jarak.keadaan}>
            <PilJarak
              jenis={jenis}
              jarak={jarak}
              tiga={tiga}
              baris={baris}
              patokan={patokan}
              ambangTungguMenit={ambangTungguMenit}
              sebutTetangga={sebutTetangga}
            />
          </span>
        ))}
      </div>
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
