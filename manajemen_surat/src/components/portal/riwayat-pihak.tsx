"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ExternalLink, X } from "lucide-react";

import { badgeVariants } from "@/components/ui/badge";
import { apiPath, withBasePath } from "@/lib/base-path";
import { alamatStatusPerkara } from "@/lib/rekap-petugas";
import { tanggalDMY } from "@/lib/tanggal-indonesia";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * PENANDA RIWAYAT DI SAMPING NAMA PIHAK
 * ============================================================================
 *
 * Permintaan pengguna 27 September 2026: pada bagian Para pihak di Status
 * Perkara, tandai pihak yang sudah bercerai LEBIH DARI SEKALI, dan pihak yang
 * perkaranya berkaitan dengan perkara lain - cerai dikabulkan, lalu ia
 * mendaftar harta bersama. Menekan angkanya memunculkan nomor perkaranya.
 *
 * Dua penanda, dan ambangnya disengaja:
 *
 *   cerai N×           warna perhatian, HANYA bila N >= 2. Satu kali cerai
 *                      berakta adalah keadaan lazim di pengadilan agama dan
 *                      tidak perlu ditandai - yang ditanyakan pengguna adalah
 *                      yang berulang. Dihitung dari perkara yang AKTA CERAINYA
 *                      SUDAH TERBIT saja, termasuk perkara ini sendiri.
 *   N perkara terkait  netral, bila ada perkara lain orang yang sama.
 *
 * Tiap perkara di daftarnya menyebut DASAR pencocokannya - data pihak SIPP
 * yang sama, NIK, nama dan tanggal lahir, atau pasangan nama - sebab
 * penanda "pernah cerai" yang keliru merugikan orang, dan yang membacanya
 * harus tahu seberapa jauh boleh percaya. Nama saja tidak pernah dipakai;
 * aturannya diukur dan diterangkan di kepala aleta_bot/services/
 * riwayatPihakService.js.
 *
 * ============================================================================
 * DIBACA HANYA KETIKA BAGIAN PARA PIHAK DIBUKA
 * ============================================================================
 *
 * Bagian Para pihak terciut sebagai bawaan, dan isinya baru digambar ketika
 * dibuka. PenyediaRiwayatPihak hidup DI DALAM isi itu - jadi pembacaannya
 * baru berjalan ketika bagian itu dibuka, dan muatan Status Perkara sendiri
 * tidak bertambah satu kueri pun. Hasilnya disimpan per perkara di luar
 * komponen: menutup lalu membuka bagian itu lagi tidak membaca SIPP ulang.
 *
 * ============================================================================
 * DAFTARNYA DI DALAM ALUR, BUKAN MELAYANG
 * ============================================================================
 *
 * Daftar kecil itu muncul tepat di bawah nama, mendorong isi di bawahnya -
 * tidak melayang di atasnya. Bagian Para pihak menempati separuh layar lebar
 * dan seluruh layar sempit; kotak melayang yang dijangkarkan pada penanda
 * yang letaknya di tengah baris terpotong tepi layar ponsel. Latarnya
 * bg-card, bukan bg-popover: token popover tidak ada di tema ini, dan kotak
 * berlatar kosong tembus pandang di atas nama orang lain.
 */

export type DasarCocok = {
  tingkat: "perkara_ini" | "pihak_id" | "nik" | "nama_lahir" | "pasangan" | string;
  label: string;
  catatan: string;
};

export type PerkaraRiwayat = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  pihakKe: number;
  kedudukan: string;
  tanggalDaftar: string;
  tanggalPutusan: string;
  keadaan: string;
  aktaCerai: { nomor: string; tanggal: string } | null;
  arah: "perkara ini" | "sebelumnya" | "sesudahnya" | string;
  dasar: DasarCocok;
};

export type RiwayatSatuPihak = {
  pihakId: number;
  pihakKe: number;
  nama: string;
  kedudukan: string;
  ceraiBerakta: number;
  cerai: PerkaraRiwayat[];
  jumlahTerkait: number;
  terkait: PerkaraRiwayat[];
};

export type MuatanRiwayatPihak = {
  ok: boolean;
  alasan?: string;
  /**
   * Sebab penolakan dari rute portal: perkara_tidak_ada, masukan_tidak_sah,
   * gagal_membaca_sipp, atau bot_tak_terjangkau. Tidak ada = sebab lain
   * (mis. kewenangan ditolak).
   */
  kode?: string;
  aktaTerbaca?: boolean;
  pihak?: RiwayatSatuPihak[];
};

/** Ambang penanda cerai - yang ditandai hanya yang BERULANG. */
export const AMBANG_CERAI = 2;

/**
 * Siapa yang boleh diberi penanda: pihak pertama/kedua saja. Kuasa hukum
 * hadir UNTUK seseorang, bukan pihak yang riwayat perkawinannya ditanyakan;
 * saksi bukan pihak sama sekali.
 */
export function bolehBertanda(orang: { jenis?: string; pihakKe: number | null }) {
  return orang.jenis !== "kuasa" && (orang.pihakKe === 1 || orang.pihakKe === 2);
}

/** Nama dibandingkan tanpa beda huruf besar dan spasi - sama dengan kartu identitas. */
function bakuTampil(nama: string) {
  return String(nama ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Riwayat satu orang di daftar pihak - menurut kedudukan DAN namanya. */
export function cariRiwayat(
  daftar: RiwayatSatuPihak[] | undefined,
  nama: string,
  pihakKe: number | null
): RiwayatSatuPihak | null {
  if (!Array.isArray(daftar)) return null;
  const baku = bakuTampil(nama);
  return daftar.find((x) => x.pihakKe === pihakKe && bakuTampil(x.nama) === baku) ?? null;
}

// ============================================================================
// PEMBACAAN - SEKALI PER PERKARA
// ============================================================================

/**
 * Umur simpanan di peramban (telaah gabungan 2.40.0).
 *
 * Dulu simpanan hidup sepanjang sesi: akta yang terbit atau perkara yang baru
 * didaftarkan sesudah bagian ini pertama dibuka tidak pernah tampil sampai
 * halamannya dimuat ulang. Lima menit cukup untuk membuka-tutup bagian ini
 * berkali-kali tanpa membaca SIPP ulang, dan cukup pendek supaya yang dibaca
 * tidak basi seharian. Yang sudah lewat umurnya dibaca ulang saat bagiannya
 * dibuka kembali.
 */
export const UMUR_SIMPANAN_MS = 5 * 60_000;

const simpanan = new Map<string, { muatan: MuatanRiwayatPihak; pada: number }>();
const sedangDibaca = new Map<string, Promise<MuatanRiwayatPihak>>();

/** Muatan yang masih berumur - yang sudah lewat lima menit dianggap tidak ada. */
function ambilSimpanan(kunci: string): MuatanRiwayatPihak | null {
  const isi = simpanan.get(kunci);
  if (!isi) return null;
  return Date.now() - isi.pada < UMUR_SIMPANAN_MS ? isi.muatan : null;
}

/** Dipakai uji - simpanan hidup sepanjang modul. */
export function lupakanRiwayatPihak() {
  simpanan.clear();
  sedangDibaca.clear();
}

function kunciPerkara(perkaraId: string, nomorPerkara: string) {
  return perkaraId ? `id:${perkaraId}` : `nomor:${nomorPerkara}`;
}

async function bacaRiwayat(perkaraId: string, nomorPerkara: string): Promise<MuatanRiwayatPihak> {
  const kueri = new URLSearchParams();
  if (perkaraId) kueri.set("perkaraId", perkaraId);
  else kueri.set("nomorPerkara", nomorPerkara);
  const balasan = await fetch(apiPath(`/api/aleta-ecourt/riwayat-pihak?${kueri.toString()}`), {
    cache: "no-store",
  });
  // Bungkus { ok, data } dibuka lebih dulu - membacanya langsung selalu
  // keliru dan tidak berbunyi. Galat rute berbentuk { ok:false, error:{ message } }
  // - pesannya yang disampaikan, bukan "[object Object]" (mis. 403: peran
  // yang tidak diberi akses panel).
  const bungkus = (await balasan.json().catch(() => null)) as {
    data?: MuatanRiwayatPihak;
    error?: string | { message?: string };
  } | null;
  if (!balasan.ok || !bungkus?.data) {
    const galat = bungkus?.error;
    const pesan = typeof galat === "string" ? galat : galat?.message;
    return { ok: false, alasan: pesan || `Riwayat pihak tidak dapat dibaca (HTTP ${balasan.status}).` };
  }
  return bungkus.data;
}

/**
 * Kalimat penolakan menurut SEBABNYA (telaah gabungan 2.40.0). Tindakan tiap
 * sebab berbeda: bot yang tidak terjangkau diperiksa layanannya, SIPP yang
 * galat diperiksa basis datanya, perkara yang tidak ada tidak perlu diperiksa
 * siapa pun. Satu kalimat untuk semuanya menyuruh orang memeriksa hal yang
 * salah.
 */
export function kalimatGalat(kode: string, alasan: string) {
  switch (kode) {
    case "perkara_tidak_ada":
      return "Perkara ini tidak ditemukan di SIPP — riwayat para pihak tidak dapat disusun.";
    case "masukan_tidak_sah":
      return "Nomor atau ID perkara tidak sah — riwayat para pihak tidak dapat dibaca.";
    case "gagal_membaca_sipp":
      return `SIPP tidak dapat dibaca — riwayat para pihak belum dapat disusun: ${alasan}`;
    case "bot_tak_terjangkau":
      return `ALETA Bot tidak dapat dihubungi — riwayat para pihak belum dapat dibaca. ${alasan}`;
    default:
      return `Riwayat para pihak tidak dapat dibaca: ${alasan}`;
  }
}

type NilaiRiwayat = {
  memuat: boolean;
  galat: string;
  muatan: MuatanRiwayatPihak | null;
  ulangi: () => void;
  /** Daftar yang sedang terbuka: `${pihakKe}|${nama baku}|cerai` atau `...|terkait`; "" bila tidak ada. */
  terbuka: string;
  buka: (kunci: string) => void;
  /** Fokus dipindahkan ke daftar HANYA sesudah pengguna membukanya - bukan tiap kali digambar ulang. */
  mintaFokus: boolean;
  lepasFokus: () => void;
};

const KonteksRiwayat = createContext<NilaiRiwayat | null>(null);

/**
 * Pembaca riwayat para pihak - dipasang DI DALAM isi bagian Para pihak,
 * sehingga baru membaca ketika bagian itu dibuka.
 */
export function PenyediaRiwayatPihak({
  perkaraId,
  nomorPerkara,
  children,
}: {
  perkaraId: string;
  nomorPerkara: string;
  children: ReactNode;
}) {
  const id = String(perkaraId ?? "").trim();
  const nomor = String(nomorPerkara ?? "").trim();
  const kunci = kunciPerkara(id, nomor);

  /**
   * Hasil pembacaan TERAKHIR beserta kuncinya. Yang tampil diturunkan saat
   * menggambar - simpanan lebih dulu, lalu hasil milik kunci ini - bukan
   * disalin ke keadaan dari dalam efek: setState sinkron di dalam efek
   * menggambar ulang dua kali untuk satu jawaban (react-hooks/set-state-in-effect).
   */
  const [hasil, setHasil] = useState<{
    kunci: string;
    muatan: MuatanRiwayatPihak | null;
    galat: string;
    kodeGalat: string;
  } | null>(null);
  const [putaran, setPutaran] = useState(0);

  const milikIni = hasil && hasil.kunci === kunci ? hasil : null;
  // Simpanan yang sudah lewat umurnya tidak dipakai - bagian yang dibuka
  // kembali sesudahnya membaca ulang (efek di bawah).
  const muatan = ambilSimpanan(kunci) ?? milikIni?.muatan ?? null;
  const galat = muatan ? "" : milikIni?.galat ?? "";
  const kodeGalat = muatan ? "" : milikIni?.kodeGalat ?? "";
  const memuat = Boolean(id || nomor) && !muatan && !galat;

  useEffect(() => {
    if (!id && !nomor) return;
    if (ambilSimpanan(kunci)) return;
    let hidup = true;
    let janji = sedangDibaca.get(kunci);
    if (!janji) {
      janji = bacaRiwayat(id, nomor);
      sedangDibaca.set(kunci, janji);
    }
    janji
      .then((isi) => {
        sedangDibaca.delete(kunci);
        // Yang gagal TIDAK disimpan - membuka bagian itu lagi mencoba lagi.
        if (isi.ok) simpanan.set(kunci, { muatan: isi, pada: Date.now() });
        if (!hidup) return;
        setHasil(
          isi.ok
            ? { kunci, muatan: isi, galat: "", kodeGalat: "" }
            : { kunci, muatan: null, galat: isi.alasan || "Riwayat pihak tidak dapat dibaca.", kodeGalat: isi.kode || "" }
        );
      })
      .catch((e: unknown) => {
        sedangDibaca.delete(kunci);
        if (hidup) {
          setHasil({
            kunci,
            muatan: null,
            galat: e instanceof Error ? e.message : "Riwayat pihak tidak dapat dibaca.",
            kodeGalat: "",
          });
        }
      });
    return () => {
      hidup = false;
    };
  }, [kunci, id, nomor, putaran]);

  const ulangi = useCallback(() => {
    simpanan.delete(kunci);
    setHasil(null);
    setPutaran((x) => x + 1);
  }, [kunci, setHasil, setPutaran]);

  /**
   * Daftar mana yang terbuka disimpan DI SINI, bukan di penandanya.
   *
   * Nama pihak di Status Perkara digambar oleh komponen yang disusun ulang
   * tiap kali layarnya digambar ulang - mengetuk nama untuk membuka
   * identitasnya sudah cukup. Keadaan yang hidup di penanda ikut hilang
   * bersamanya, dan daftar yang sedang dibaca menutup sendiri.
   */
  const [terbuka, setTerbuka] = useState("");
  const [mintaFokus, setMintaFokus] = useState(false);
  const buka = useCallback((k: string) => {
    setTerbuka(k);
    setMintaFokus(Boolean(k));
  }, []);
  const lepasFokus = useCallback(() => setMintaFokus(false), []);

  const nilai = useMemo(
    () => ({ memuat, galat, muatan, ulangi, terbuka, buka, mintaFokus, lepasFokus }),
    [memuat, galat, muatan, ulangi, terbuka, buka, mintaFokus, lepasFokus]
  );

  return (
    <KonteksRiwayat.Provider value={nilai}>
      {memuat ? (
        <p role="status" className="mb-2 text-xs text-muted-foreground">
          Memeriksa riwayat para pihak — perceraian berakta dan perkara lain orang yang sama…
        </p>
      ) : galat ? (
        <p role="status" className="mb-2 flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
          <span>{kalimatGalat(kodeGalat, galat)}</span>
          {/* Mencoba lagi hanya berguna bila sebabnya dapat berlalu - bot
              yang sedang tidak terjangkau, SIPP yang sedang galat. Perkara
              yang tidak ada tetap tidak ada. */}
          {kodeGalat === "perkara_tidak_ada" || kodeGalat === "masukan_tidak_sah" ? null : (
            <button
              type="button"
              onClick={ulangi}
              className="rounded-md border border-border px-2 py-0.5 text-foreground transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Coba lagi
            </button>
          )}
        </p>
      ) : muatan && muatan.aktaTerbaca === false ? (
        // Tabel akta cerai tidak ada di SIPP ini: hitungan cerai TIDAK dapat
        // disusun, dan itu disebut - bukan ditampilkan sebagai nol.
        <p role="status" className="mb-2 text-xs text-amber-700 dark:text-amber-300">
          Tabel akta cerai tidak terbaca pada SIPP ini — penanda cerai tidak dapat disusun.
        </p>
      ) : null}
      {children}
    </KonteksRiwayat.Provider>
  );
}

// ============================================================================
// PENANDA DAN DAFTARNYA
// ============================================================================

const KELAS_ARAH: Record<string, string> = {
  "perkara ini": "border-primary/30 bg-primary/10 text-primary",
  sebelumnya: "border-border bg-muted/60 text-muted-foreground",
  sesudahnya: "border-sky-300/70 bg-sky-100 text-sky-800 dark:border-sky-700/50 dark:bg-sky-950/70 dark:text-sky-300",
};

function DaftarPerkara({
  id,
  judul,
  daftar,
  sisa,
  onTutup,
  mintaFokus,
  lepasFokus,
}: {
  id: string;
  judul: string;
  daftar: PerkaraRiwayat[];
  sisa: number;
  onTutup: () => void;
  mintaFokus: boolean;
  lepasFokus: () => void;
}) {
  const kotak = useRef<HTMLDivElement | null>(null);

  // Fokus berpindah ke daftarnya begitu DIBUKA pengguna - pengguna papan
  // ketik dan pembaca layar langsung berada di tempat yang baru muncul. Bila
  // daftar digambar ulang karena sebab lain, fokus tidak direbut.
  useEffect(() => {
    if (!mintaFokus) return;
    kotak.current?.focus();
    lepasFokus();
  }, [mintaFokus, lepasFokus]);

  return (
    <div
      id={id}
      ref={kotak}
      role="dialog"
      aria-label={judul}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onTutup();
        }
      }}
      className="mt-1.5 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-card p-2 text-card-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:max-h-none print:shadow-none"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="text-xs font-semibold">{judul}</p>
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup daftar"
          className="rounded-md p-0.5 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <ol className="space-y-1.5">
        {daftar.map((x) => {
          const alamat = x.arah === "perkara ini" ? "" : alamatStatusPerkara(x.nomorPerkara);
          return (
            <li key={`${x.perkaraId}-${x.arah}`} className="rounded-md border border-border/70 px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {alamat ? (
                  <a
                    href={withBasePath(alamat)}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 rounded-sm text-sm font-medium underline decoration-dotted underline-offset-2 hover:text-primary hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:no-underline"
                  >
                    {x.nomorPerkara}
                    <ExternalLink className="h-3 w-3 shrink-0 print:hidden" aria-hidden />
                    <span className="sr-only"> (Status Perkara dibuka di tab baru)</span>
                  </a>
                ) : (
                  <span className="text-sm font-medium">{x.nomorPerkara}</span>
                )}
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-px text-[0.68rem] font-medium",
                    KELAS_ARAH[x.arah] ?? KELAS_ARAH.sebelumnya
                  )}
                >
                  {x.arah}
                </span>
              </div>
              <p className="text-xs">
                {x.jenisPerkara || "jenis perkara tidak tercatat"} · {x.kedudukan || "kedudukan tidak tercatat"}
              </p>
              <p className="text-xs text-muted-foreground">
                didaftarkan {tanggalDMY(x.tanggalDaftar, "—")} · {x.keadaan}
                {x.tanggalPutusan ? ` ${tanggalDMY(x.tanggalPutusan)}` : ""}
              </p>
              {x.aktaCerai ? (
                <p className="text-xs">
                  Akta cerai {x.aktaCerai.nomor}, {tanggalDMY(x.aktaCerai.tanggal, x.aktaCerai.tanggal)}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">Dasar: {x.dasar?.label || "—"}</p>
              {x.dasar?.catatan ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">{x.dasar.catatan}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {sisa > 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          dan {sisa} perkara lain yang tidak ditampilkan di sini.
        </p>
      ) : null}
    </div>
  );
}

const kelasTombol =
  "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 print:hidden";

/**
 * Penanda di samping nama satu pihak (pihak pertama/kedua - BUKAN kuasa,
 * BUKAN saksi; pemanggilnya yang menyaring). Tidak menggambar apa pun di luar
 * PenyediaRiwayatPihak, selama memuat, atau bila tidak ada yang perlu
 * ditandai.
 */
export function PenandaRiwayatPihak({ nama, pihakKe }: { nama: string; pihakKe: number | null }) {
  const konteks = useContext(KonteksRiwayat);
  const tombolCerai = useRef<HTMLButtonElement | null>(null);
  const tombolTerkait = useRef<HTMLButtonElement | null>(null);
  const dasarId = useId();

  const riwayat = konteks?.muatan?.ok ? cariRiwayat(konteks.muatan.pihak, nama, pihakKe) : null;
  if (!konteks || !riwayat) return null;

  const tampilCerai = konteks.muatan?.aktaTerbaca !== false && riwayat.ceraiBerakta >= AMBANG_CERAI;
  const tampilTerkait = riwayat.jumlahTerkait > 0;
  if (!tampilCerai && !tampilTerkait) return null;

  const awalan = `${pihakKe}|${bakuTampil(nama)}|`;
  const terbuka = konteks.terbuka.startsWith(awalan) ? konteks.terbuka.slice(awalan.length) : "";
  const alih = (jenis: "cerai" | "terkait") => konteks.buka(terbuka === jenis ? "" : `${awalan}${jenis}`);

  const tutup = (asal: "cerai" | "terkait") => {
    konteks.buka("");
    // Fokus kembali ke tombol yang membukanya - bukan hilang ke awal halaman.
    (asal === "cerai" ? tombolCerai : tombolTerkait).current?.focus();
  };

  const idCerai = `${dasarId}-cerai`;
  const idTerkait = `${dasarId}-terkait`;

  return (
    <>
      <span className="ml-1.5 inline-flex flex-wrap items-center gap-1 align-middle">
        {tampilCerai ? (
          <button
            ref={tombolCerai}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={terbuka === "cerai"}
            aria-controls={terbuka === "cerai" ? idCerai : undefined}
            aria-label={`Pernah bercerai dengan akta ${riwayat.ceraiBerakta} kali — lihat nomor perkaranya`}
            title="Perceraian yang akta cerainya sudah terbit, termasuk perkara ini bila sudah berakta"
            onClick={() => alih("cerai")}
            className={cn(badgeVariants({ variant: "warning" }), "px-2 py-0.5", kelasTombol)}
          >
            cerai {riwayat.ceraiBerakta}×
          </button>
        ) : null}
        {tampilTerkait ? (
          <button
            ref={tombolTerkait}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={terbuka === "terkait"}
            aria-controls={terbuka === "terkait" ? idTerkait : undefined}
            aria-label={`${riwayat.jumlahTerkait} perkara lain orang yang sama — lihat daftarnya`}
            title="Perkara lain yang melibatkan orang yang sama, sebelum maupun sesudah perkara ini"
            onClick={() => alih("terkait")}
            className={cn(badgeVariants({ variant: "muted" }), "px-2 py-0.5", kelasTombol)}
          >
            {riwayat.jumlahTerkait} perkara terkait
          </button>
        ) : null}
      </span>
      {terbuka === "cerai" && tampilCerai ? (
        <DaftarPerkara
          id={idCerai}
          judul={`Cerai berakta — ${riwayat.nama}: ${riwayat.ceraiBerakta} perkara`}
          daftar={riwayat.cerai}
          sisa={0}
          onTutup={() => tutup("cerai")}
          mintaFokus={konteks.mintaFokus}
          lepasFokus={konteks.lepasFokus}
        />
      ) : null}
      {terbuka === "terkait" && tampilTerkait ? (
        <DaftarPerkara
          id={idTerkait}
          judul={`Perkara terkait — ${riwayat.nama}: ${riwayat.jumlahTerkait} perkara`}
          daftar={riwayat.terkait}
          sisa={Math.max(0, riwayat.jumlahTerkait - riwayat.terkait.length)}
          onTutup={() => tutup("terkait")}
          mintaFokus={konteks.mintaFokus}
          lepasFokus={konteks.lepasFokus}
        />
      ) : null}
    </>
  );
}
