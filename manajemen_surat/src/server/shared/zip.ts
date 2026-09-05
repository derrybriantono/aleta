import { crc32 as zlibCrc32 } from "node:zlib";

/**
 * Penyusun berkas ZIP sederhana, tanpa dependensi.
 *
 * ============================================================================
 * KENAPA MENULIS SENDIRI
 * ============================================================================
 *
 * Yang dibutuhkan hanya satu hal: membungkus beberapa berkas teks kecil - isi
 * ekstensi peramban - menjadi satu berkas yang dapat diunduh dan dibuka
 * Windows tanpa alat tambahan.
 *
 * Menambah pustaka pihak ketiga untuk itu berarti menambah dependensi baru ke
 * aplikasi pengadilan, yang harus ikut diperbarui dan ditinjau keamanannya
 * selamanya. Bentuk ZIP tanpa pemampatan cukup sederhana untuk ditulis
 * langsung: sebuah kepala per berkas, sebuah daftar isi, dan sebuah penutup.
 *
 * ============================================================================
 * TANPA PEMAMPATAN, DAN ITU DISENGAJA
 * ============================================================================
 *
 * Seluruh isinya disimpan apa adanya (metode "store"). Berkas ekstensi hanya
 * beberapa puluh kilobyte, sehingga pemampatan tidak menghemat apa pun yang
 * berarti - sementara menambahkannya berarti menambah bagian yang bisa salah.
 */

/** Berkas yang akan dimasukkan ke dalam arsip. */
export type BerkasZip = {
  /** Jalur di dalam arsip, memakai garis miring maju. */
  nama: string;
  isi: Buffer;
};

/**
 * CRC-32 untuk satu potongan data.
 *
 * zlib.crc32 tersedia sejak Node 20.15. Cadangan bertabel disediakan supaya
 * berkas ini tetap berjalan pada Node yang lebih lama - kegagalan mengunduh
 * ekstensi karena versi Node bukan kegagalan yang pantas terjadi.
 */
let tabelCrc: Uint32Array | null = null;

function crc32(isi: Buffer): number {
  if (typeof zlibCrc32 === "function") return zlibCrc32(isi) >>> 0;

  if (!tabelCrc) {
    tabelCrc = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let nilai = i;
      for (let j = 0; j < 8; j += 1) {
        nilai = nilai & 1 ? 0xedb88320 ^ (nilai >>> 1) : nilai >>> 1;
      }
      tabelCrc[i] = nilai >>> 0;
    }
  }

  let hasil = 0xffffffff;
  for (const byte of isi) {
    hasil = (tabelCrc[(hasil ^ byte) & 0xff] as number) ^ (hasil >>> 8);
  }
  return (hasil ^ 0xffffffff) >>> 0;
}

/**
 * Waktu tetap untuk seluruh isi arsip.
 *
 * Memakai waktu sekarang membuat setiap unduhan menghasilkan berkas yang
 * berbeda isinya walau isinya sama. Waktu tetap membuat arsip yang sama selalu
 * menghasilkan berkas yang sama persis, sehingga sidik jarinya dapat
 * dibandingkan bila perlu.
 */
const WAKTU_DOS = 0; // 00:00:00
const TANGGAL_DOS = ((2026 - 1980) << 9) | (1 << 5) | 1; // 1 Januari 2026

function kepalaLokal(berkas: BerkasZip, crc: number): Buffer {
  const nama = Buffer.from(berkas.nama, "utf8");
  const kepala = Buffer.alloc(30);

  kepala.writeUInt32LE(0x04034b50, 0); // tanda kepala lokal
  kepala.writeUInt16LE(20, 4); // versi minimal
  kepala.writeUInt16LE(0, 6); // tanpa penanda khusus
  kepala.writeUInt16LE(0, 8); // metode: simpan apa adanya
  kepala.writeUInt16LE(WAKTU_DOS, 10);
  kepala.writeUInt16LE(TANGGAL_DOS, 12);
  kepala.writeUInt32LE(crc, 14);
  kepala.writeUInt32LE(berkas.isi.length, 18); // ukuran termampat
  kepala.writeUInt32LE(berkas.isi.length, 22); // ukuran asli
  kepala.writeUInt16LE(nama.length, 26);
  kepala.writeUInt16LE(0, 28); // tanpa tambahan

  return Buffer.concat([kepala, nama]);
}

function kepalaDaftarIsi(berkas: BerkasZip, crc: number, posisi: number): Buffer {
  const nama = Buffer.from(berkas.nama, "utf8");
  const kepala = Buffer.alloc(46);

  kepala.writeUInt32LE(0x02014b50, 0); // tanda daftar isi
  kepala.writeUInt16LE(20, 4); // dibuat oleh versi
  kepala.writeUInt16LE(20, 6); // versi minimal
  kepala.writeUInt16LE(0, 8);
  kepala.writeUInt16LE(0, 10); // metode: simpan apa adanya
  kepala.writeUInt16LE(WAKTU_DOS, 12);
  kepala.writeUInt16LE(TANGGAL_DOS, 14);
  kepala.writeUInt32LE(crc, 16);
  kepala.writeUInt32LE(berkas.isi.length, 20);
  kepala.writeUInt32LE(berkas.isi.length, 24);
  kepala.writeUInt16LE(nama.length, 28);
  kepala.writeUInt16LE(0, 30); // tanpa tambahan
  kepala.writeUInt16LE(0, 32); // tanpa keterangan
  kepala.writeUInt16LE(0, 34); // cakram awal
  kepala.writeUInt16LE(0, 36); // sifat internal
  kepala.writeUInt32LE(0, 38); // sifat eksternal
  kepala.writeUInt32LE(posisi, 42); // letak kepala lokalnya

  return Buffer.concat([kepala, nama]);
}

function penutup(jumlah: number, ukuranDaftar: number, posisiDaftar: number): Buffer {
  const akhir = Buffer.alloc(22);

  akhir.writeUInt32LE(0x06054b50, 0); // tanda penutup
  akhir.writeUInt16LE(0, 4); // nomor cakram
  akhir.writeUInt16LE(0, 6); // cakram daftar isi
  akhir.writeUInt16LE(jumlah, 8); // jumlah di cakram ini
  akhir.writeUInt16LE(jumlah, 10); // jumlah seluruhnya
  akhir.writeUInt32LE(ukuranDaftar, 12);
  akhir.writeUInt32LE(posisiDaftar, 16);
  akhir.writeUInt16LE(0, 20); // tanpa keterangan

  return akhir;
}

/**
 * Menyusun beberapa berkas menjadi satu arsip ZIP.
 *
 * Nama berkas dibersihkan dari jalur yang menaik (`..`) dan garis miring
 * mundur. Arsip yang memuat jalur menaik dapat menulis di luar folder tujuan
 * ketika dibuka - dan arsip yang dibagikan ke komputer petugas tidak boleh
 * punya kemampuan itu.
 */
export function susunZip(daftar: BerkasZip[]): Buffer {
  const bagian: Buffer[] = [];
  const daftarIsi: Buffer[] = [];
  let posisi = 0;

  for (const berkas of daftar) {
    const nama = berkas.nama.replace(/\\/g, "/").replace(/\.\.\//g, "").replace(/^\/+/, "");
    if (!nama) continue;

    const bersih: BerkasZip = { nama, isi: berkas.isi };
    const crc = crc32(bersih.isi);

    const kepala = kepalaLokal(bersih, crc);
    bagian.push(kepala, bersih.isi);
    daftarIsi.push(kepalaDaftarIsi(bersih, crc, posisi));
    posisi += kepala.length + bersih.isi.length;
  }

  const isiDaftar = Buffer.concat(daftarIsi);
  return Buffer.concat([
    ...bagian,
    isiDaftar,
    penutup(daftarIsi.length, isiDaftar.length, posisi),
  ]);
}
