/**
 * ============================================================================
 * "SEDANG BERJALAN" SEKETIKA - KEADAAN `disidang` HARI INI (6 Okt 2026)
 * ============================================================================
 *
 * Keluhan pengguna: perkara sudah dipanggil/di-PROSES di aplikasi antrian
 * sidang, tetapi Jadwal Sidang ALETA belum berubah.
 *
 * JALUR LAMA. `disidang` (NULL menunggu, 1..9 sedang disidang di ruang itu,
 * 10 selesai) hanya terbaca lewat:
 *   1. waktuAntrian.baris[].disidang - ikut GET jadwal PENUH yang dimuat ulang
 *      tiap 45 detik (JEDA_MUAT_ULANG_MS), dan
 *   2. berjalan.proses dari GET /sidang/selesai - yang baru diminta SESUDAH
 *      jadwal itu tiba (useSelesaiSidang dipicu daftar sidang yang berganti).
 * Jadi perubahan di aplikasi antrian tampil rata-rata 22,5 detik dan paling
 * lama 45 detik + dua kali muat kemudian; tab yang baru kembali terlihat
 * menunggu sampai putaran berikutnya.
 *
 * JALUR BARU. Layar menanyakan keadaan `disidang` saja tiap SELANG_MS (5
 * detik) - satu kueri kecil di bot (17 baris, 4-14 ms diukur 6 Okt 2026),
 * dibagi seluruh tab - HANYA untuk hari ini dan HANYA saat tab terlihat
 * (berhenti saat tersembunyi, langsung bertanya lagi saat terlihat). Hasilnya
 * DITIMPAKAN ke bahan petaSidangBerjalan yang sudah ada:
 *   - disidang baris waktu antrian hari ini diganti nilai terbarunya;
 *   - "proses" dari bacaan /selesai yang sudah tidak berproses (selesai,
 *     batal, skors di mesin) dibuang.
 * Perkara yang di-PROSES tetapi belum punya baris waktu antrian sama sekali
 * (antrian diambil sesudah jadwal dimuat) memicu muat ulang jadwal penuh -
 * perluMuatPenuh - sekali per perubahan, bukan tiap tanya.
 */

import type { DataBerjalan } from "@/lib/jadwal-sidang-2okt";
import { kunciWaktu, ruangDisidang, type WaktuAntrian } from "@/lib/tiga-jarak-sidang";

/** Selang tanya keadaan disidang (hari ini, tab terlihat). */
export const SELANG_DISIDANG_MS = 5_000;

export type BarisDisidangLangsung = {
  perkaraId: string;
  tanggalSidang: string;
  disidang: number | null;
  ruanganId: number | null;
  jamSidang: string;
};

export type DisidangLangsung = {
  terbaca: boolean;
  hariIni: string;
  sekarang: string;
  baris: BarisDisidangLangsung[];
};

export const DISIDANG_LANGSUNG_KOSONG: DisidangLangsung = { terbaca: false, hariIni: "", sekarang: "", baris: [] };

const rapi = (x: unknown) => (x === null || x === undefined ? "" : String(x).trim());
const angka = (x: unknown): number | null => {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isInteger(n) ? n : null;
};

/** Jawaban rute /api/aleta-ecourt/sidang/disidang -> DisidangLangsung (bentuk tak dikenal = tidak terbaca). */
export function bacaDisidangLangsung(data: unknown): DisidangLangsung {
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.available === false || d.terbaca !== true || !Array.isArray(d.baris)) return DISIDANG_LANGSUNG_KOSONG;
  const hariIni = rapi(d.hariIni);
  return {
    terbaca: true,
    hariIni,
    sekarang: rapi(d.sekarang),
    baris: (d.baris as Array<Record<string, unknown>>)
      .map((b) => ({
        perkaraId: rapi(b.perkaraId),
        tanggalSidang: rapi(b.tanggalSidang) || hariIni,
        disidang: angka(b.disidang),
        ruanganId: angka(b.ruanganId),
        jamSidang: rapi(b.jamSidang),
      }))
      .filter((b) => b.perkaraId && b.tanggalSidang),
  };
}

/** Peta kunciWaktu -> disidang, hanya bila bacaannya terbaca dan untuk hari yang sama. */
function petaLangsung(langsung: DisidangLangsung, hariIni: string): Map<string, number | null> | null {
  if (!langsung.terbaca || !langsung.hariIni || (hariIni && langsung.hariIni !== hariIni)) return null;
  const peta = new Map<string, number | null>();
  for (const b of langsung.baris) if (b.tanggalSidang === langsung.hariIni) peta.set(kunciWaktu(b.tanggalSidang, b.perkaraId), b.disidang);
  return peta;
}

/**
 * waktuAntrian dengan `disidang` hari ini diganti nilai terbaru. Obyek yang
 * SAMA dipulangkan bila tidak ada yang berubah - useMemo di layar tidak
 * menghitung ulang petaSidangBerjalan tiap tanya.
 */
export function terapkanDisidangLangsung(waktu: WaktuAntrian, langsung: DisidangLangsung): WaktuAntrian {
  const peta = petaLangsung(langsung, waktu.hariIni);
  if (!peta || peta.size === 0) return waktu;
  let berubah = false;
  const baris = waktu.baris.map((b) => {
    const k = kunciWaktu(b.tanggalSidang, b.perkaraId);
    if (!peta.has(k)) return b;
    const kini = peta.get(k) ?? null;
    if (b.disidang === kini) return b;
    berubah = true;
    return { ...b, disidang: kini };
  });
  return berubah ? { ...waktu, baris } : waktu;
}

/**
 * Bacaan /selesai dengan "proses" hari ini yang menurut keadaan terbaru sudah
 * TIDAK berproses (selesai 10, batal/skors NULL) dibuang. Obyek yang sama bila
 * tidak ada yang berubah. Tanda manual tidak disentuh - itu keputusan petugas.
 */
export function saringProsesLangsung(berjalan: DataBerjalan, langsung: DisidangLangsung): DataBerjalan {
  const peta = petaLangsung(langsung, "");
  if (!peta || berjalan.proses.length === 0) return berjalan;
  const proses = berjalan.proses.filter((p) => {
    const k = kunciWaktu(p.tanggalSidang, p.perkaraId);
    if (!peta.has(k)) return true;
    return ruangDisidang(peta.get(k) ?? null) !== null;
  });
  return proses.length === berjalan.proses.length ? berjalan : { ...berjalan, proses };
}

/**
 * Perkara yang SEDANG disidang menurut keadaan terbaru tetapi tidak punya baris
 * waktu antrian sama sekali - layar tidak dapat menempatkannya tanpa jadwal
 * penuh. Dipulangkan sebagai tanda tangan (kosong = tidak perlu), supaya muat
 * penuh dipicu sekali per perubahan.
 */
export function perluMuatPenuh(waktu: WaktuAntrian, langsung: DisidangLangsung): string {
  // Jadwal penuh yang tidak membawa waktu antrian (bot lama, gagal dibaca)
  // tidak akan pernah memuat barisnya - memuat ulang hanya berputar sia-sia.
  if (!waktu.terbaca || !waktu.hariIni) return "";
  const peta = petaLangsung(langsung, waktu.hariIni);
  if (!peta) return "";
  const ada = new Set(waktu.baris.map((b) => kunciWaktu(b.tanggalSidang, b.perkaraId)));
  const kurang: string[] = [];
  for (const [k, d] of peta) if (ruangDisidang(d) !== null && !ada.has(k)) kurang.push(`${k}=${d}`);
  return kurang.sort().join(",");
}
