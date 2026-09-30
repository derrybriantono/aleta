import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Letak seluruh berkas sinkron & cadangan di server.
 *
 * Bawaannya <cwd>/reports/sinkron - di container portal itu /app/reports,
 * yang SUDAH di-mount ke /var/www/html/aleta-data/reports (docker-compose.yml).
 * Apa pun di luar mount musnah tiap container dibuat ulang, dan arsip cadangan
 * yang musnah bersama pembaruan bukan cadangan.
 *
 * Pengaturan, riwayat, dan catatan unggahan Drive disimpan sebagai JSON di
 * folder yang sama - bukan tabel baru. Satu folder berarti satu hal untuk
 * dicadangkan dan tanpa migrasi basis data.
 */
export function direktoriSinkron() {
  return process.env.ALETA_SINKRON_DIR || path.join(process.cwd(), "reports", "sinkron");
}

export const jalurSinkron = {
  pengaturan: () => path.join(direktoriSinkron(), "pengaturan.json"),
  riwayat: () => path.join(direktoriSinkron(), "riwayat.json"),
  keadaan: () => path.join(direktoriSinkron(), "keadaan.json"),
  arsip: () => path.join(direktoriSinkron(), "arsip"),
  driveBerkas: () => path.join(direktoriSinkron(), "drive-berkas"),
  sementara: () => path.join(direktoriSinkron(), "sementara"),
};

export async function bacaJson<T>(jalur: string, cadangan: T): Promise<T> {
  try {
    return JSON.parse(await readFile(jalur, "utf8")) as T;
  } catch {
    return cadangan;
  }
}

/**
 * Menulis JSON secara atomik: tulis ke berkas sementara lalu ganti nama.
 * Server yang mati di tengah penulisan meninggalkan berkas lama yang utuh,
 * bukan pengaturan setengah jadi yang membuat jadwal berhenti diam-diam.
 */
export async function tulisJson(jalur: string, isi: unknown) {
  await mkdir(path.dirname(jalur), { recursive: true });
  const sementara = `${jalur}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(sementara, JSON.stringify(isi, null, 2), "utf8");
  await rename(sementara, jalur);
}
