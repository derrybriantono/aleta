/**
 * Kesegaran cermin: boleh dipercaya layar atau harus kembali ke SIPP?
 *
 * Layar yang saklarnya menyala membaca cermin HANYA bila cermin segar; bila
 * tertinggal (pembaruan macet, bot mati, pemindaian awal belum selesai), layar
 * membaca SIPP seperti sebelum ada cermin - tanpa galat dan tanpa menunggu.
 *
 * Segar berarti SEMUA ini benar:
 *   * pemindaian awal SELESAI;
 *   * pembaruan berkala berputar baru-baru ini: putaran terakhir tidak lebih
 *     tua dari max(5 menit, 4 x selang) dan galat beruntunnya < 3;
 *   * jendela panas dihitung ulang baru-baru ini: tidak lebih tua dari
 *     max(10 menit, 4 x panasMenit). `diperbaruiPada` (tanda "Cermin ·
 *     diperbarui hh:mm" di layar) adalah saat itu.
 *
 * Hasil disinggahkan 3 detik per proses (100 perangkat tidak membaca jejak
 * 100 kali). Gagal membaca jejak = tidak segar.
 */
import type { PengaturanCermin } from "@/lib/cermin";
import type { AletaDatabase } from "@/server/db/client";
import { muatKeadaanPembaruan } from "@/server/modules/cermin/pembaruan";
import { muatKeadaanPemindai } from "@/server/modules/cermin/pemindai";

export const BATAS_GALAT_BERUNTUN = 3;
const UMUR_SINGGAH_MS = 3_000;

export type Kesegaran = {
  segar: boolean;
  /** Sebab tidak segar (untuk tooltip/log); kosong bila segar. */
  alasan: string;
  /** ISO UTC: saat jendela panas terakhir dihitung ulang; null bila belum pernah. */
  diperbaruiPada: string | null;
  /** Umur pembaruan terakhir, detik. */
  umurDetik: number | null;
};

let singgah: { nilai: Kesegaran; sampai: number; kunci: string } | null = null;

/** Hanya untuk uji dan saat pengaturan/keadaan berubah. */
export function buangSinggahKesegaran() {
  singgah = null;
}

export async function kesegaranCermin(db: AletaDatabase, p: PengaturanCermin, sekarang: Date, opsi: { tanpaSinggah?: boolean } = {}): Promise<Kesegaran> {
  const kunci = `${p.selangPembaruanDetik}|${p.panasMenit}`;
  if (!opsi.tanpaSinggah && singgah && singgah.kunci === kunci && singgah.sampai > Date.now()) return singgah.nilai;
  let nilai: Kesegaran;
  try {
    const [pemindai, pembaruan] = await Promise.all([muatKeadaanPemindai(db), muatKeadaanPembaruan(db)]);
    const sekarangMs = sekarang.getTime();
    const putaranMs = Date.parse(pembaruan.putaranTerakhir);
    const panasMs = Date.parse(pembaruan.panasTerakhir);
    const umurDetik = Number.isFinite(putaranMs) ? Math.max(0, Math.round((sekarangMs - putaranMs) / 1000)) : null;
    const batasPutaranDetik = Math.max(300, 4 * p.selangPembaruanDetik);
    const batasPanasDetik = Math.max(600, 4 * p.panasMenit * 60);
    let alasan = "";
    if (pemindai.status !== "selesai") alasan = "pemindaian awal belum selesai";
    else if (!Number.isFinite(putaranMs)) alasan = "pembaruan berkala belum pernah berputar";
    else if (pembaruan.galat.beruntun >= BATAS_GALAT_BERUNTUN) alasan = `pembaruan gagal ${pembaruan.galat.beruntun}x beruntun`;
    else if ((umurDetik as number) > batasPutaranDetik) alasan = `pembaruan terakhir ${umurDetik} detik lalu`;
    else if (!Number.isFinite(panasMs)) alasan = "jendela panas belum pernah dihitung";
    else if ((sekarangMs - panasMs) / 1000 > batasPanasDetik) alasan = `jendela panas terakhir dihitung ${Math.round((sekarangMs - panasMs) / 1000)} detik lalu`;
    nilai = { segar: alasan === "", alasan, diperbaruiPada: Number.isFinite(panasMs) ? new Date(panasMs).toISOString() : null, umurDetik };
  } catch {
    nilai = { segar: false, alasan: "keadaan cermin tidak terbaca", diperbaruiPada: null, umurDetik: null };
  }
  if (!opsi.tanpaSinggah) singgah = { nilai, sampai: Date.now() + UMUR_SINGGAH_MS, kunci };
  return nilai;
}
