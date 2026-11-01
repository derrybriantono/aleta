import { deflateRawSync, inflateRawSync } from "node:zlib";

/**
 * ZIP MINIMAL untuk DOCX (baca entri, ganti sebagian, tulis ulang). Tanpa pustaka luar. Entri yang tidak diubah disalin APA ADANYA
 * (bita terkompresi asli), sehingga gambar, font, dan bagian lain tidak disentuh. Tidak mendukung zip64 / terenkripsi (DOCX wajar tidak
 * memerlukannya).
 */
export type EntriZip = {
  nama: string;
  metode: number;
  crc: number;
  ukuranKompres: number;
  ukuranAsli: number;
  waktu: number;
  tanggal: number;
  flag: number;
  /** Bita terkompresi asli. */
  mentah: Uint8Array;
};

const SIG_LOKAL = 0x04034b50;
const SIG_PUSAT = 0x02014b50;
const SIG_AKHIR = 0x06054b50;

let tabelCrc: Uint32Array | null = null;
export function crc32(bita: Uint8Array): number {
  if (!tabelCrc) {
    tabelCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabelCrc[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bita.length; i += 1) c = tabelCrc[(c ^ bita[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function bacaZip(bita: Uint8Array): EntriZip[] {
  const dv = new DataView(bita.buffer, bita.byteOffset, bita.byteLength);
  let akhir = -1;
  for (let i = bita.length - 22; i >= Math.max(0, bita.length - 22 - 65535); i -= 1) {
    if (dv.getUint32(i, true) === SIG_AKHIR) {
      akhir = i;
      break;
    }
  }
  if (akhir < 0) throw new Error("Bukan berkas zip yang utuh (direktori pusat tidak ditemukan).");
  const jumlah = dv.getUint16(akhir + 10, true);
  let p = dv.getUint32(akhir + 16, true);
  const hasil: EntriZip[] = [];
  for (let n = 0; n < jumlah; n += 1) {
    if (dv.getUint32(p, true) !== SIG_PUSAT) throw new Error("Direktori pusat zip rusak.");
    const flag = dv.getUint16(p + 8, true);
    const metode = dv.getUint16(p + 10, true);
    const waktu = dv.getUint16(p + 12, true);
    const tanggal = dv.getUint16(p + 14, true);
    const crc = dv.getUint32(p + 16, true);
    const ukuranKompres = dv.getUint32(p + 20, true);
    const ukuranAsli = dv.getUint32(p + 24, true);
    const pn = dv.getUint16(p + 28, true);
    const pe = dv.getUint16(p + 30, true);
    const pk = dv.getUint16(p + 32, true);
    const lokal = dv.getUint32(p + 42, true);
    const nama = new TextDecoder("utf-8").decode(bita.subarray(p + 46, p + 46 + pn));
    if (dv.getUint32(lokal, true) !== SIG_LOKAL) throw new Error(`Kepala lokal zip rusak untuk ${nama}.`);
    const ln = dv.getUint16(lokal + 26, true);
    const le = dv.getUint16(lokal + 28, true);
    const mulai = lokal + 30 + ln + le;
    hasil.push({ nama, metode, crc, ukuranKompres, ukuranAsli, waktu, tanggal, flag: flag & ~0x0008, mentah: bita.subarray(mulai, mulai + ukuranKompres) });
    p += 46 + pn + pe + pk;
  }
  return hasil;
}

export function isiEntri(e: EntriZip): Uint8Array {
  if (e.metode === 0) return e.mentah;
  if (e.metode === 8) return new Uint8Array(inflateRawSync(e.mentah));
  throw new Error(`Metode kompresi zip ${e.metode} tidak didukung (${e.nama}).`);
}

export function entriBaru(nama: string, isi: Uint8Array, contoh?: EntriZip): EntriZip {
  const kompres = deflateRawSync(isi);
  return {
    nama,
    metode: 8,
    crc: crc32(isi),
    ukuranKompres: kompres.length,
    ukuranAsli: isi.length,
    waktu: contoh?.waktu ?? 0,
    tanggal: contoh?.tanggal ?? 0x21,
    flag: 0x0800,
    mentah: new Uint8Array(kompres),
  };
}

export function tulisZip(entri: EntriZip[]): Uint8Array {
  const bagian: Uint8Array[] = [];
  const pusat: Uint8Array[] = [];
  let posisi = 0;
  const enc = new TextEncoder();
  for (const e of entri) {
    const nama = enc.encode(e.nama);
    const lokal = new Uint8Array(30 + nama.length);
    const dv = new DataView(lokal.buffer);
    dv.setUint32(0, SIG_LOKAL, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, e.flag | 0x0800, true);
    dv.setUint16(8, e.metode, true);
    dv.setUint16(10, e.waktu, true);
    dv.setUint16(12, e.tanggal, true);
    dv.setUint32(14, e.crc, true);
    dv.setUint32(18, e.ukuranKompres, true);
    dv.setUint32(22, e.ukuranAsli, true);
    dv.setUint16(26, nama.length, true);
    dv.setUint16(28, 0, true);
    lokal.set(nama, 30);
    const p = new Uint8Array(46 + nama.length);
    const dp = new DataView(p.buffer);
    dp.setUint32(0, SIG_PUSAT, true);
    dp.setUint16(4, 20, true);
    dp.setUint16(6, 20, true);
    dp.setUint16(8, e.flag | 0x0800, true);
    dp.setUint16(10, e.metode, true);
    dp.setUint16(12, e.waktu, true);
    dp.setUint16(14, e.tanggal, true);
    dp.setUint32(16, e.crc, true);
    dp.setUint32(20, e.ukuranKompres, true);
    dp.setUint32(24, e.ukuranAsli, true);
    dp.setUint16(28, nama.length, true);
    dp.setUint32(42, posisi, true);
    p.set(nama, 46);
    bagian.push(lokal, e.mentah);
    pusat.push(p);
    posisi += lokal.length + e.mentah.length;
  }
  const ukuranPusat = pusat.reduce((a, b) => a + b.length, 0);
  const akhir = new Uint8Array(22);
  const da = new DataView(akhir.buffer);
  da.setUint32(0, SIG_AKHIR, true);
  da.setUint16(8, entri.length, true);
  da.setUint16(10, entri.length, true);
  da.setUint32(12, ukuranPusat, true);
  da.setUint32(16, posisi, true);
  const semua = [...bagian, ...pusat, akhir];
  const total = semua.reduce((a, b) => a + b.length, 0);
  const hasil = new Uint8Array(total);
  let o = 0;
  for (const b of semua) {
    hasil.set(b, o);
    o += b.length;
  }
  return hasil;
}
