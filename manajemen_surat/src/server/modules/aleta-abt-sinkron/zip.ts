import { deflateRawSync } from "node:zlib";

/**
 * ZIP sederhana untuk paket ubahan (Tahap 9): satu lapis, tanpa enkripsi, tanpa ZIP64 (paket kecil). Nama berkas UTF-8.
 * Ditulis sendiri karena portal tidak punya pustaka ZIP; dibaca kembali oleh uji dengan pembaca terpisah.
 */

const TABEL_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i += 1) c = TABEL_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type EntriZip = { jalur: string; isi: Buffer };

export function buatZip(entri: EntriZip[], waktu: Date = new Date()): Buffer {
  if (entri.length > 0xfffe) throw new Error("Terlalu banyak berkas untuk satu ZIP.");
  const tahun = Math.max(1980, waktu.getUTCFullYear());
  const tanggalDos = ((tahun - 1980) << 9) | ((waktu.getUTCMonth() + 1) << 5) | waktu.getUTCDate();
  const jamDos = (waktu.getUTCHours() << 11) | (waktu.getUTCMinutes() << 5) | Math.floor(waktu.getUTCSeconds() / 2);
  const bagian: Buffer[] = [];
  const pusat: Buffer[] = [];
  let posisi = 0;
  for (const e of entri) {
    const nama = Buffer.from(e.jalur, "utf8");
    const mentah = e.isi;
    const padat = deflateRawSync(mentah);
    const pakaiPadat = padat.length < mentah.length;
    const data = pakaiPadat ? padat : mentah;
    const metode = pakaiPadat ? 8 : 0;
    const crc = crc32(mentah);
    const kepala = Buffer.alloc(30);
    kepala.writeUInt32LE(0x04034b50, 0);
    kepala.writeUInt16LE(20, 4);
    kepala.writeUInt16LE(0x0800, 6);
    kepala.writeUInt16LE(metode, 8);
    kepala.writeUInt16LE(jamDos, 10);
    kepala.writeUInt16LE(tanggalDos, 12);
    kepala.writeUInt32LE(crc, 14);
    kepala.writeUInt32LE(data.length, 18);
    kepala.writeUInt32LE(mentah.length, 22);
    kepala.writeUInt16LE(nama.length, 26);
    kepala.writeUInt16LE(0, 28);
    bagian.push(kepala, nama, data);
    const p = Buffer.alloc(46);
    p.writeUInt32LE(0x02014b50, 0);
    p.writeUInt16LE((3 << 8) | 20, 4);
    p.writeUInt16LE(20, 6);
    p.writeUInt16LE(0x0800, 8);
    p.writeUInt16LE(metode, 10);
    p.writeUInt16LE(jamDos, 12);
    p.writeUInt16LE(tanggalDos, 14);
    p.writeUInt32LE(crc, 16);
    p.writeUInt32LE(data.length, 20);
    p.writeUInt32LE(mentah.length, 24);
    p.writeUInt16LE(nama.length, 28);
    p.writeUInt16LE(0, 30);
    p.writeUInt16LE(0, 32);
    p.writeUInt16LE(0, 34);
    p.writeUInt16LE(0, 36);
    p.writeUInt32LE(((0o100644 << 16) >>> 0), 38);
    p.writeUInt32LE(posisi, 42);
    pusat.push(p, nama);
    posisi += kepala.length + nama.length + data.length;
  }
  const ukuranPusat = pusat.reduce((s, b) => s + b.length, 0);
  const akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0);
  akhir.writeUInt16LE(0, 4);
  akhir.writeUInt16LE(0, 6);
  akhir.writeUInt16LE(entri.length, 8);
  akhir.writeUInt16LE(entri.length, 10);
  akhir.writeUInt32LE(ukuranPusat, 12);
  akhir.writeUInt32LE(posisi, 16);
  akhir.writeUInt16LE(0, 20);
  return Buffer.concat([...bagian, ...pusat, akhir]);
}
