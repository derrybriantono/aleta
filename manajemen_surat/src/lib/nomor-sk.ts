/**
 * Nomor SK penunjukan untuk blangko ABT - aturan murni (17 Okt 2026).
 *
 * Penetapan majelis hakim (PMH) memuat kalimat "Memperhatikan Surat Keputusan
 * Pengadilan Agama ... Nomor <nomor SK> tentang Susunan Majelis Hakim ...".
 * Dulu nomor itu tertulis tetap di variabel ABT #7044#. Sekarang nomornya
 * variabel sendiri (#9550#, isian teks) yang diisi dari ALETA, sehingga ketika
 * SK berganti cukup diubah di Integrasi e-Court lalu diterapkan ke ABT.
 *
 * Daftar di sini TERTUTUP: tiap SK punya satu variabel ABT. Menambah SK lain
 * (mis. SK mediator) = menambah satu butir di DAFTAR_NOMOR_SK, tanpa migrasi.
 * Nilai yang ditulis ke ABT adalah TEKS LITERAL (nilaiLiteral); bot menyusunnya menjadi
 * kueri baku `SELECT '<nomor>' AS data` (variabel #9550# berjenis data_sql).
 */

import { hurufDiluarLatin1 } from "@/lib/pengaturan-abt";
import { tanggalPanjang, tanggalSah } from "@/lib/tanggal-indonesia";

export type ButirNomorSk = {
  kunci: string;
  /** Variabel ABT yang menampung nilainya. */
  noVar: string;
  label: string;
  keterangan: string;
  bawaanNomor: string;
  /** ISO yyyy-mm-dd; "" = tanpa tanggal. */
  bawaanTanggal: string;
  /**
   * true: variabel ABT memuat "<nomor> tanggal <tanggal panjang>". false (bawaan #9550#):
   * hanya nomornya - tanggal SK tetap tertulis di kalimat blangko, jadi isian tanggal
   * disembunyikan di layar. Dicocokkan dengan paket blangko yang membuat variabelnya.
   */
  sertakanTanggal: boolean;
};

export const DAFTAR_NOMOR_SK: readonly ButirNomorSk[] = [
  {
    kunci: "majelis",
    noVar: "9550",
    label: "SK susunan majelis hakim dan panitera pengganti",
    keterangan: 'Dipakai pada kalimat "Memperhatikan Surat Keputusan ... Nomor ..." di penetapan majelis hakim (PMH).',
    bawaanNomor: "254/KPA.W19-A5/SK.HK2.6/VIII/2026",
    bawaanTanggal: "",
    sertakanTanggal: false,
  },
];

/** Nomor variabel ABT yang boleh ditulis lewat jalur nomor SK. */
export const NOMOR_VAR_SK: ReadonlySet<string> = new Set(DAFTAR_NOMOR_SK.map((b) => b.noVar));

export type NilaiNomorSk = { nomor: string; tanggal: string };
export type PengaturanNomorSk = Record<string, NilaiNomorSk>;

export const BATAS_NOMOR_SK = 120;

export class GalatNomorSk extends Error {}

export const NOMOR_SK_BAWAAN: PengaturanNomorSk = Object.fromEntries(
  DAFTAR_NOMOR_SK.map((b) => [b.kunci, { nomor: b.bawaanNomor, tanggal: b.bawaanTanggal }])
);

export function nomorSkBawaan(): PengaturanNomorSk {
  return Object.fromEntries(Object.entries(NOMOR_SK_BAWAAN).map(([k, v]) => [k, { ...v }]));
}

/** Teks yang ditulis ke variabel ABT untuk satu butir. */
export function nilaiLiteral(butir: ButirNomorSk, nilai: NilaiNomorSk): string {
  const nomor = nilai.nomor.trim();
  if (butir.sertakanTanggal && nilai.tanggal && tanggalSah(nilai.tanggal)) return `${nomor} tanggal ${tanggalPanjang(nilai.tanggal)}`;
  return nomor;
}

/**
 * Isian bersih satu SK. Ditolak (bukan dibersihkan diam-diam): kosong, kepanjangan,
 * huruf yang tidak dapat disimpan ABT (latin1), '#' (ABT mengganti #NNNN#) dan
 * garis miring terbalik, tanggal yang bukan tanggal kalender.
 */
export function bersihkanNilaiNomorSk(butir: ButirNomorSk, masukan: unknown): NilaiNomorSk {
  const m = (masukan && typeof masukan === "object" ? masukan : {}) as Record<string, unknown>;
  const nomor = String(m.nomor ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tanggal = String(m.tanggal ?? "").trim();
  const label = `Nomor ${butir.label}`;
  if (!nomor) throw new GalatNomorSk(`${label} tidak boleh kosong.`);
  if (nomor.length > BATAS_NOMOR_SK) throw new GalatNomorSk(`${label} terlalu panjang (lebih dari ${BATAS_NOMOR_SK} huruf).`);
  if (hurufDiluarLatin1(nomor).length) throw new GalatNomorSk(`${label} memuat huruf yang tidak dapat disimpan ABT.`);
  if (/[\\#"']/.test(nomor)) throw new GalatNomorSk(`${label} tidak boleh memuat tanda #, tanda kutip (" atau '), atau garis miring terbalik.`);
  if (tanggal && !tanggalSah(tanggal)) throw new GalatNomorSk(`Tanggal SK untuk ${butir.label} tidak sah.`);
  return { nomor, tanggal };
}

/** Gabungkan masukan ({kunci: {nomor, tanggal}}) ke dasar; kunci yang tidak dikenal ditolak. */
export function bersihkanPengaturanNomorSk(masukan: unknown, dasar: PengaturanNomorSk): PengaturanNomorSk {
  const m = (masukan && typeof masukan === "object" ? masukan : {}) as Record<string, unknown>;
  for (const k of Object.keys(m)) {
    if (!DAFTAR_NOMOR_SK.some((b) => b.kunci === k)) throw new GalatNomorSk("Ada isian SK yang tidak dikenal - muat ulang halaman.");
  }
  const hasil: PengaturanNomorSk = {};
  for (const b of DAFTAR_NOMOR_SK) {
    hasil[b.kunci] = m[b.kunci] === undefined ? (dasar[b.kunci] ?? { nomor: b.bawaanNomor, tanggal: b.bawaanTanggal }) : bersihkanNilaiNomorSk(b, m[b.kunci]);
  }
  return hasil;
}

/** Pesan awam bila variabel ABT-nya belum ada. */
export const PESAN_NOMOR_SK_BELUM_TERPASANG = "Variabel nomor SK belum terpasang di ABT - pasang paket blangko terbaru dulu.";
