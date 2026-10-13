/**
 * ============================================================================
 * STATUS "TARIK DATA E-COURT" UNTUK WIDGET EKSTENSI (12 Okt 2026, butir 12)
 * ============================================================================
 *
 * Baris di popup ekstensi (Super Admin dan Admin saja) menunjukkan apakah
 * penjadwal penarikan e-Court di ALETA Bot sedang menyala - satu saklar yang
 * SAMA dengan "Penjadwal" di Integrasi e-Court (runtime-config `ecourtJadwal`),
 * bukan saklar kedua.
 *
 * Aturan "apa yang dianggap sehat" hidup DI SINI, di server, bukan di berkas
 * ekstensi yang berjalan dalam beberapa versi sekaligus di peramban orang:
 * ekstensi hanya menggambar `keadaan`, `label`, dan `keterangan` yang
 * dikirim portal.
 *
 * Empat keadaan, bukan dua, karena "menyala" tidak sama dengan "menarik":
 *   aktif             menyala dan putaran terakhir (bila ada) selesai baik
 *   perhatian         menyala, tetapi putaran terakhir berhenti (sesi e-Court
 *                     habis, disk menipis, atau gagal) - petugas perlu bertindak
 *   mati              penjadwal dimatikan; klik = aktifkan
 *   tidak-terjangkau  ALETA Bot tidak menjawab; saklar tidak dapat dibaca
 *                     maupun diubah, dan warnanya tidak berpura-pura mati/hidup
 *
 * Kode keluar putaran (aleta_bot/services/ecourtSchedulerService.js):
 * 0 selesai, 1 gagal, 2 sesi e-Court habis, 3 ruang disk menipis, -1 jembatan
 * gagal dijalankan, null belum pernah berjalan sejak bot menyala.
 */

export type KeadaanTarikEcourt = "aktif" | "perhatian" | "mati" | "tidak-terjangkau";

/** Bagian keadaan penjadwal bot yang dibutuhkan (GatewayEcourtJadwal). */
export type JadwalTarikEcourt = {
  pengaturan: {
    aktif: boolean;
    jarakJam: number;
    jamMulai: number;
    jamSelesai: number;
    maksPerkara: number;
    /** 13 Okt 2026: selang acak putaran berkala (menit). */
    selangMinMenit?: number;
    selangMaksMenit?: number;
  };
  sedangJalan?: boolean;
  dalamJamKerja?: boolean;
  terakhirSelesai?: string | null;
  terakhirKode?: number | null;
  terakhirCatatan?: string;
};

export type RingkasTarikEcourt = {
  keadaan: KeadaanTarikEcourt;
  /** Saklar penjadwal (apa adanya), bukan "sedang menarik". Null bila tidak terbaca. */
  aktif: boolean | null;
  label: string;
  keterangan: string;
  sedangJalan: boolean;
  /** ISO waktu putaran terakhir selesai; null bila belum pernah sejak bot menyala. */
  terakhirSelesai: string | null;
};

const TIDAK_TERJANGKAU: RingkasTarikEcourt = {
  keadaan: "tidak-terjangkau",
  aktif: null,
  label: "Tidak terjangkau",
  keterangan: "ALETA Bot tidak menjawab; saklar tidak dapat dibaca maupun diubah sekarang.",
  sedangJalan: false,
  terakhirSelesai: null,
};

function dua(n: number) {
  return String(n).padStart(2, "0");
}

/** Sebab putaran terakhir berhenti, atau "" bila tidak ada yang perlu diperhatikan. */
export function sebabPerhatianTarik(kode: number | null | undefined): string {
  switch (kode) {
    case 2:
      return "Sesi e-Court habis - perlu login ulang dari portal ALETA.";
    case 3:
      return "Ruang disk server menipis - penarikan berhenti.";
    case 1:
    case -1:
      return "Putaran terakhir gagal - lihat Integrasi e-Court.";
    default:
      return "";
  }
}

/**
 * Meringkas keadaan penjadwal bot menjadi satu keadaan berwarna.
 * `null`/`undefined` (bot tidak menjawab) = "tidak-terjangkau".
 */
export function ringkasTarikEcourt(jadwal: JadwalTarikEcourt | null | undefined): RingkasTarikEcourt {
  if (!jadwal || typeof jadwal !== "object" || !jadwal.pengaturan || typeof jadwal.pengaturan !== "object") {
    return { ...TIDAK_TERJANGKAU };
  }
  const p = jadwal.pengaturan;
  const sedangJalan = jadwal.sedangJalan === true;
  const terakhirSelesai =
    typeof jadwal.terakhirSelesai === "string" && !Number.isNaN(Date.parse(jadwal.terakhirSelesai))
      ? jadwal.terakhirSelesai
      : null;

  if (p.aktif !== true) {
    return {
      keadaan: "mati",
      aktif: false,
      label: "Tidak aktif",
      keterangan: "Penarikan berkala berkas e-Court mati. Klik status untuk mengaktifkan.",
      sedangJalan,
      terakhirSelesai,
    };
  }

  const sebab = sedangJalan ? "" : sebabPerhatianTarik(jadwal.terakhirKode);
  if (sebab) {
    return { keadaan: "perhatian", aktif: true, label: "Aktif, perlu perhatian", keterangan: sebab, sedangJalan, terakhirSelesai };
  }

  const rentang = `jam ${dua(p.jamMulai)}.00-${dua(p.jamSelesai)}.00, Senin-Jumat`;
  // Sejak 13 Okt 2026 jadwalnya selang acak (menit); jarakJam hanya turunan.
  const selang =
    typeof p.selangMinMenit === "number" && typeof p.selangMaksMenit === "number"
      ? `tiap ${p.selangMinMenit}-${p.selangMaksMenit} menit (acak)`
      : `tiap ${p.jarakJam} jam`;
  const keterangan = sedangJalan
    ? "Sedang menarik berkas sekarang."
    : jadwal.dalamJamKerja === false
      ? `Menunggu jam kerja (${rentang}); ${selang}.`
      : `Menarik ${selang}, ${rentang}.`;
  return { keadaan: "aktif", aktif: true, label: "Aktif", keterangan, sedangJalan, terakhirSelesai };
}

/**
 * Pengaturan penjadwal lengkap dengan hanya `aktif` yang diganti. Rute simpan
 * bot menuntut kelima ruas; nilai lain DIPERTAHANKAN dari keadaan sekarang,
 * bukan dari kiriman ekstensi. Null bila keadaan sekarang tidak terbaca.
 */
export function pengaturanDenganAktif(
  jadwal: JadwalTarikEcourt | null | undefined,
  aktif: boolean
): { aktif: boolean; jarakJam: number; jamMulai: number; jamSelesai: number; maksPerkara: number } | null {
  const p = jadwal?.pengaturan;
  if (!p) return null;
  const angka = [p.jarakJam, p.jamMulai, p.jamSelesai, p.maksPerkara];
  if (!angka.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return {
    aktif: aktif === true,
    jarakJam: p.jarakJam,
    jamMulai: p.jamMulai,
    jamSelesai: p.jamSelesai,
    maksPerkara: p.maksPerkara,
  };
}
