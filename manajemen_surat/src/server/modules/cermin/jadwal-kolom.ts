/**
 * Kolom yang dapat dicari pada aleta_cermin_sidang / aleta_cermin_mediasi (0134, 5 Nov 2026).
 *
 * Nilainya SELALU diturunkan dari baris yang disusun bot untuk layar (baris_json) - satu sumber bentuk, tanpa
 * kueri SIPP tambahan. Dipakai penulis (saat upsert) dan pengisi baris lama (isi-kolom.ts), jadi keduanya pasti
 * menghasilkan isi yang sama. Murni: tanpa basis data.
 */
const teks = (v: unknown) => String(v ?? "").trim();
const bulat = (v: unknown) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : 0;
};
const bulatAtauNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : null;
};
const benar = (v: unknown) => (v === true || v === 1 || String(v ?? "").toUpperCase() === "Y" ? 1 : 0);

export type KolomSidang = {
  nomor_perkara: string;
  jenis_perkara: string;
  alasan_tunda: string;
  dihadiri_oleh: number | null;
  urutan_sidang: number;
  sidang_keliling: number;
  sidang_ikrar: number;
  ada_bas: number;
};

export function kolomSidangDariBaris(b: Record<string, unknown> | null | undefined): KolomSidang {
  const x = b ?? {};
  return {
    nomor_perkara: teks(x.nomorPerkara),
    jenis_perkara: teks(x.jenisPerkara),
    alasan_tunda: teks(x.alasanDitunda),
    dihadiri_oleh: bulatAtauNull(x.dihadiriOleh),
    urutan_sidang: bulat(x.urutanSidang),
    sidang_keliling: benar(x.sidangKeliling),
    sidang_ikrar: benar(x.sidangIkrarTalak),
    ada_bas: benar(x.adaBas),
  };
}

export type KolomMediasi = {
  nomor_perkara: string;
  jenis_perkara: string;
  tempat: string;
  ditunda: number;
  dihadiri: string;
  status_mediator: string;
  jenis_mediasi: string;
  nomor_sk: string;
  penetapan_mediator: string;
  laporan_mediator: string;
  hasil: string;
  hasil_teks: string;
};

export function kolomMediasiDariBaris(b: Record<string, unknown> | null | undefined): KolomMediasi {
  const x = b ?? {};
  return {
    nomor_perkara: teks(x.nomorPerkara),
    jenis_perkara: teks(x.jenisPerkara),
    tempat: teks(x.tempat),
    ditunda: benar(x.ditunda),
    dihadiri: teks(x.dihadiri),
    status_mediator: teks(x.statusMediator),
    jenis_mediasi: teks(x.jenisMediasi),
    nomor_sk: teks(x.nomorSk),
    penetapan_mediator: teks(x.penetapanMediator),
    laporan_mediator: teks(x.laporanMediator),
    hasil: teks(x.hasil),
    hasil_teks: teks(x.hasilTeks),
  };
}

/** Urutan kolom (tanpa kunci/baris_json) untuk INSERT ... ON CONFLICT: dipakai penulis agar daftar kolom satu sumber. */
export const NAMA_KOLOM_SIDANG = ["nomor_perkara", "jenis_perkara", "alasan_tunda", "dihadiri_oleh", "urutan_sidang", "sidang_keliling", "sidang_ikrar", "ada_bas"] as const;
export const NAMA_KOLOM_MEDIASI = [
  "nomor_perkara",
  "jenis_perkara",
  "tempat",
  "ditunda",
  "dihadiri",
  "status_mediator",
  "jenis_mediasi",
  "nomor_sk",
  "penetapan_mediator",
  "laporan_mediator",
  "hasil",
  "hasil_teks",
] as const;
