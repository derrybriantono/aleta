import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { bersihkanLaporan, uraiRiwayatPembersihan, type LaporanHost, type RiwayatPembersihan, type SetelanKapasitas } from "@/server/modules/kapasitas/hitung";

/**
 * Letak berkas pertukaran dengan skrip cron di server induk.
 *
 * Bawaannya <cwd>/reports/kapasitas - di container portal itu /app/reports,
 * yang SUDAH dipasang ke /var/www/html/aleta-data/reports (docker-compose.yml).
 * Itulah satu-satunya jembatan: portal TIDAK memegang soket Docker dan tidak
 * menjalankan apa pun di server. Skrip cron yang membaca berkas ini hanya
 * mengambil ANGKA dan benar/salah dari setelan-host.json.
 *
 *   laporan.json          ditulis cron   -> dibaca portal
 *   riwayat-bersih.jsonl  ditulis cron   -> dibaca portal (jejak audit)
 *   setelan-host.json     ditulis portal -> dibaca cron
 *   minta-periksa.json    ditulis portal -> dibaca dan dihapus cron
 */
export function direktoriKapasitas() {
  return process.env.ALETA_KAPASITAS_DIR || path.join(process.cwd(), "reports", "kapasitas");
}

export const jalurKapasitas = {
  laporan: () => path.join(direktoriKapasitas(), "laporan.json"),
  riwayat: () => path.join(direktoriKapasitas(), "riwayat-bersih.jsonl"),
  setelan: () => path.join(direktoriKapasitas(), "setelan-host.json"),
  mintaPeriksa: () => path.join(direktoriKapasitas(), "minta-periksa.json"),
};

async function tulisAtomik(jalur: string, isi: string) {
  await mkdir(path.dirname(jalur), { recursive: true });
  // Folder bersama dengan cron host (root): tetap dapat ditulis container.
  const sementara = `${jalur}.${process.pid}.tmp`;
  await writeFile(sementara, isi, { encoding: "utf8", mode: 0o644 });
  await rename(sementara, jalur);
}

export async function bacaLaporanHost(): Promise<LaporanHost | null> {
  try {
    return bersihkanLaporan(JSON.parse(await readFile(jalurKapasitas.laporan(), "utf8")));
  } catch {
    return null;
  }
}

export async function bacaRiwayatPembersihan(maks = 20): Promise<RiwayatPembersihan[]> {
  try {
    return uraiRiwayatPembersihan(await readFile(jalurKapasitas.riwayat(), "utf8"), maks);
  } catch {
    return [];
  }
}

/**
 * Setelan untuk cron: SATU baris JSON berisi hanya angka dan benar/salah
 * (cron membacanya dengan pola sed, bukan menjalankannya).
 */
export function isiSetelanHost(s: SetelanKapasitas, diubah: string) {
  return `${JSON.stringify({
    versi: 1,
    diubah,
    pembersihanOtomatis: s.pembersihanOtomatis,
    ambangKuning: s.ambangKuning,
    ambangMerah: s.ambangMerah,
    umurCacheJam: s.umurCacheJam,
  })}\n`;
}

export async function tulisSetelanHost(s: SetelanKapasitas, diubah = new Date().toISOString()) {
  await tulisAtomik(jalurKapasitas.setelan(), isiSetelanHost(s, diubah));
}

export async function mintaPeriksaHost(pada = new Date().toISOString()) {
  await tulisAtomik(jalurKapasitas.mintaPeriksa(), `${JSON.stringify({ versi: 1, pada })}\n`);
}

export async function hapusMintaPeriksa() {
  await rm(jalurKapasitas.mintaPeriksa(), { force: true });
}
