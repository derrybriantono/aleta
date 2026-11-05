import type { PotongBeda } from "@/lib/aleta-abt-beda";
import type { BagianTeks, BagianTetap, Rata } from "@/lib/aleta-abt-rtf";

/**
 * Bentuk data penyunting blangko ALETA ABT yang dipakai bersama server dan layar (hanya tipe, tanpa kode).
 */

export type RingkasVersi = {
  nomor: number;
  jenis: "asal" | "sunting" | "pulih";
  status: "draf" | "terbit" | "lama";
  dariNomor: number;
  catatan: string;
  ringkas: string;
  dibuatNama: string;
  dibuatAt: string;
  terbitNama: string;
  terbitAt: string;
  ukuran: number;
  md5: string;
};

export type BlangkoDaftar = {
  id: string;
  nama: string;
  rtf: boolean;
  arsip: boolean;
  hilang: boolean;
  ukuran: number;
  disunting: boolean;
  versi: number;
  terbit: number;
  adaDraf: boolean;
};

export type FolderDaftar = { folder: string; label: string; blangko: BlangkoDaftar[] };

export type ParagrafLayar = {
  i: number;
  bagian: BagianTeks[];
  rata: Rata;
  li: number;
  fi: number;
  tabel: boolean;
  awalan: string;
  terkunci: string;
};

export type TetapLayar = { jenis: BagianTetap["jenis"]; baris: BagianTeks[][] };

export type BlangkoBuka = {
  id: string;
  nama: string;
  folder: string;
  versi: RingkasVersi;
  terakhir: number;
  terbit: number;
  dapatDisunting: boolean;
  sebabTerkunci: string;
  paragraf: ParagrafLayar[];
  tetap: TetapLayar[];
  isian: Record<string, { nama: string; bersyarat: boolean }>;
  jumlahTerkunci: number;
  /** Berkas belum punya riwayat tersimpan (masih salinan ABT). */
  belumDisimpan: boolean;
};

export type BarisBeda =
  | { k: "sama"; a: BagianTeks[] }
  | { k: "ubah"; a: PotongBeda[]; b: PotongBeda[] }
  | { k: "tambah"; b: PotongBeda[] }
  | { k: "hapus"; a: PotongBeda[] }
  | { k: "lipat"; n: number };

export type HasilBeda = {
  a: { nomor: number; md5: string; ukuran: number };
  b: { nomor: number; md5: string; ukuran: number };
  samaBita: boolean;
  samaTeks: boolean;
  kepalaKakiBeda: boolean;
  ringkas: { tambah: number; hapus: number; ubah: number };
  baris: BarisBeda[];
  terpotong: boolean;
};

export type HasilCoba = {
  perkara: string;
  versi: number;
  paragraf: Array<{ i: number; bagian: BagianTeks[]; rata: Rata; li: number; fi: number; tabel: boolean; awalan: string }>;
  terisi: number;
  takBerContoh: number;
  /** Berkas RTF contoh (base64) untuk dibuka di aplikasi pengolah kata; null bila tidak dapat dibuat aman. */
  rtfBase64: string | null;
  sebabTanpaBerkas: string;
};

export type HasilSimpan = { nomor: number; md5: string; ukuran: number; ringkas: string; diubah: number; dihapus: number; dipecah: number };

export type ItemIsian = { no: string; nama: string; bersyarat: boolean; dipakai: number };
