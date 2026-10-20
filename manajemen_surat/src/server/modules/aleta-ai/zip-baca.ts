import { inflateRawSync } from "node:zlib";

import { ApiError } from "@/server/shared/errors";

/**
 * Pembaca ZIP minimal untuk unggahan proyek ALETA Ai (hanya membaca).
 *
 * Isi unggahan tidak dipercaya: tidak ada yang ditulis ke disk (nama berkas
 * tak pernah dipakai sebagai jalur), jumlah entri dan ukuran hasil
 * dekompresi dibatasi (penangkal zip bomb), dan hanya entri yang diminta
 * pemanggil yang dibuka.
 */

export type EntriZip = {
  nama: string;
  ukuranAsli: number;
  ukuranKompres: number;
  metode: number;
  direktori: boolean;
  /** Baca isi; melempar ApiError bila melampaui batas atau rusak. */
  baca(batasBita: number): Buffer;
};

export const BATAS_ENTRI_ZIP = 1000;

function cariAkhirDirektori(b: Buffer): number {
  const awal = Math.max(0, b.length - 0xffff - 22);
  for (let i = b.length - 22; i >= awal; i -= 1) {
    if (b.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new ApiError(400, "Berkas bukan ZIP yang sah.");
}

export function bacaDaftarZip(b: Buffer): EntriZip[] {
  if (b.length < 22) throw new ApiError(400, "Berkas bukan ZIP yang sah.");
  const akhir = cariAkhirDirektori(b);
  const jumlah = b.readUInt16LE(akhir + 10);
  let o = b.readUInt32LE(akhir + 16);
  if (jumlah === 0xffff || o === 0xffffffff) throw new ApiError(400, "ZIP64 belum didukung.");
  if (jumlah > BATAS_ENTRI_ZIP) throw new ApiError(400, `ZIP memuat terlalu banyak berkas (maksimal ${BATAS_ENTRI_ZIP}).`);

  const hasil: EntriZip[] = [];
  for (let n = 0; n < jumlah; n += 1) {
    if (o + 46 > b.length || b.readUInt32LE(o) !== 0x02014b50) throw new ApiError(400, "Daftar isi ZIP rusak.");
    const bendera = b.readUInt16LE(o + 8);
    const metode = b.readUInt16LE(o + 10);
    const ukuranKompres = b.readUInt32LE(o + 20);
    const ukuranAsli = b.readUInt32LE(o + 24);
    const panjangNama = b.readUInt16LE(o + 28);
    const panjangEkstra = b.readUInt16LE(o + 30);
    const panjangKomentar = b.readUInt16LE(o + 32);
    const lokal = b.readUInt32LE(o + 42);
    const namaBita = b.subarray(o + 46, o + 46 + panjangNama);
    // Bit 11 = UTF-8; tanpa itu CP437, yang untuk nama ASCII identik.
    const nama = namaBita.toString(bendera & 0x800 ? "utf8" : "latin1").replace(/\\/g, "/");
    o += 46 + panjangNama + panjangEkstra + panjangKomentar;

    hasil.push({
      nama,
      ukuranAsli,
      ukuranKompres,
      metode,
      direktori: nama.endsWith("/"),
      baca(batasBita: number) {
        if (ukuranAsli > batasBita) throw new ApiError(400, `Berkas "${nama.slice(0, 80)}" di dalam ZIP terlalu besar.`);
        if (lokal + 30 > b.length || b.readUInt32LE(lokal) !== 0x04034b50) throw new ApiError(400, "Berkas di dalam ZIP rusak.");
        const awalData = lokal + 30 + b.readUInt16LE(lokal + 26) + b.readUInt16LE(lokal + 28);
        const data = b.subarray(awalData, awalData + ukuranKompres);
        if (metode === 0) return Buffer.from(data);
        if (metode === 8) {
          try {
            return inflateRawSync(data, { maxOutputLength: batasBita + 1 });
          } catch {
            throw new ApiError(400, `Berkas "${nama.slice(0, 80)}" di dalam ZIP tidak dapat dibuka atau terlalu besar.`);
          }
        }
        throw new ApiError(400, `Cara pemampatan berkas "${nama.slice(0, 80)}" tidak didukung.`);
      },
    });
  }
  return hasil;
}
