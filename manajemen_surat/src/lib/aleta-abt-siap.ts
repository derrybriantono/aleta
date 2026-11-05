import type { GolonganPeran } from "@/lib/matriks-peran";
import { masukanRekomendasiDariBaris, type Rekomendasi } from "@/lib/rekomendasi-blangko";
import { saranBlangkoLengkap } from "@/lib/saran-blangko-semua";

/**
 * ============================================================================
 * "SIAP DIPERIKSA": PEKERJAAN PER PERAN DARI JADWAL SIDANG (5 Nov 2026, Tahap 6) - aturan murni, tanpa SQL, tanpa jaringan
 * ============================================================================
 *
 * Satu baris jadwal sidang menjadi pekerjaan bagi peran yang mengerjakannya:
 *   hakim    - putusan (perkara gugatan) dan penetapan (perkara permohonan);
 *   pp       - berita acara sidang (BAS);
 *   panitera - minutasi (sudah diputus, belum diminutasi), BHT (sudah diminutasi, belum BHT), akta cerai (sudah BHT, perkara cerai);
 *   jurusita - relaas panggilan dan pemberitahuan.
 * Blangko yang disarankan memakai aturan saran yang SUDAH ADA (rekomendasi-blangko, saran-blangko-semua); tidak ada aturan saran baru.
 * Panitera tidak punya saran blangko di pustaka ALETA (blangko akta cerai ada di ABT, bukan di pustaka Derry): daftarnya hanya
 * menunjukkan perkara yang menunggu, tanpa blangko.
 */

export const PERAN_ALUR = ["hakim", "pp", "panitera", "jurusita"] as const;
export type PeranAlur = (typeof PERAN_ALUR)[number];

export const LABEL_PERAN_ALUR: Record<PeranAlur, string> = { hakim: "Hakim", pp: "Panitera Pengganti", panitera: "Panitera", jurusita: "Juru sita" };

export function peranAlurDari(x: unknown): PeranAlur | null {
  const s = String(x ?? "").trim();
  return (PERAN_ALUR as readonly string[]).includes(s) ? (s as PeranAlur) : null;
}

/** Golongan ALETA yang boleh dipilih Super Admin sebagai "lihat sebagai". */
export const GOLONGAN_ALUR: Record<PeranAlur, GolonganPeran> = { hakim: "hakim", pp: "pp", panitera: "panitera", jurusita: "jurusita" };

export type JenisPekerjaan = "putusan" | "penetapan" | "bas" | "relaas" | "minutasi" | "bht" | "akta";

export const NAMA_PEKERJAAN: Record<JenisPekerjaan, string> = {
  putusan: "Putusan",
  penetapan: "Penetapan",
  bas: "Berita acara sidang",
  relaas: "Relaas",
  minutasi: "Minutasi",
  bht: "BHT",
  akta: "Akta cerai",
};

export type BlangkoSaran = {
  folder: string;
  berkas: string;
  label: string;
  alasan: string;
  utama: boolean;
  perkiraan: boolean;
  keyakinan: "pasti" | "cukup" | "perkiraan";
};

export type ButirSiap = {
  /** Kunci tetap per perkara + jenis pekerjaan + sidang. */
  kunci: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalSidang: string;
  sidangId: string;
  jenis: JenisPekerjaan;
  judul: string;
  /** Keadaan yang perlu diketahui petugas (kalimat sehari-hari). */
  keterangan: string;
  saran: BlangkoSaran[];
  /** Keadaan perkara untuk memeriksa tahapan folder (bila terkirim di baris jadwal). */
  keadaan: { prosesId: number | null; jenisPerkaraId: number | null; alurPerkaraId: number | null };
};

const teks = (x: unknown) => String(x ?? "").trim();
const angka = (x: unknown): number | null => (x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));

function keSaran(r: Rekomendasi): BlangkoSaran {
  const keyakinan = r.keyakinan ?? (r.perkiraan ? "perkiraan" : "pasti");
  return { folder: r.folder, berkas: r.berkas, label: r.label, alasan: r.alasan, utama: r.utama === true, perkiraan: r.perkiraan === true, keyakinan };
}

/** Saran diurutkan: utama dulu, lalu yang lebih pasti; paling banyak 4 per butir supaya daftar tetap terbaca. */
function urutkan(daftar: Rekomendasi[]): BlangkoSaran[] {
  const bobot = (s: BlangkoSaran) => (s.utama ? 0 : 10) + (s.keyakinan === "pasti" ? 0 : s.keyakinan === "cukup" ? 1 : 2);
  return daftar.map(keSaran).sort((a, b) => bobot(a) - bobot(b)).slice(0, 4);
}

const ADALAH_CERAI = /cerai/i;

function butirDasar(b: Record<string, unknown>, jenis: JenisPekerjaan, judul: string, keterangan: string, saran: BlangkoSaran[]): ButirSiap {
  const perkaraId = teks(b.perkaraId);
  return {
    kunci: `${perkaraId}|${jenis}|${teks(b.sidangId)}`,
    perkaraId,
    nomorPerkara: teks(b.nomorPerkara),
    jenisPerkara: teks(b.jenisPerkara),
    tanggalSidang: teks(b.tanggalSidang).slice(0, 10),
    sidangId: teks(b.sidangId),
    jenis,
    judul,
    keterangan,
    saran,
    keadaan: { prosesId: angka(b.prosesTerakhirId), jenisPerkaraId: angka(b.jenisPerkaraId), alurPerkaraId: angka(b.alurPerkaraId) },
  };
}

/** Pekerjaan satu baris jadwal bagi satu peran; kosong bila tidak ada pekerjaan untuk peran itu pada baris ini. */
export function butirDariBaris(b: Record<string, unknown>, peran: PeranAlur): ButirSiap[] {
  if (!teks(b.perkaraId) && !teks(b.nomorPerkara)) return [];
  const sudahPutus = b.sudahPutus === true;
  const jenis = teks(b.jenisPerkara);
  if (peran === "panitera") {
    const hasil: ButirSiap[] = [];
    const diminutasi = Boolean(teks(b.tanggalMinutasi));
    const bht = Boolean(teks(b.tanggalBht));
    if (sudahPutus && !diminutasi) hasil.push(butirDasar(b, "minutasi", "Minutasi", `Diputus ${teks(b.tanggalPutusan).slice(0, 10) || "(tanggal belum terbaca)"}, belum diminutasi.`, []));
    else if (sudahPutus && diminutasi && !bht) hasil.push(butirDasar(b, "bht", "BHT", `Sudah diminutasi ${teks(b.tanggalMinutasi).slice(0, 10)}, belum ada tanggal BHT.`, []));
    else if (sudahPutus && bht && ADALAH_CERAI.test(jenis)) hasil.push(butirDasar(b, "akta", "Akta cerai", `BHT ${teks(b.tanggalBht).slice(0, 10)}; akta cerai menunggu diterbitkan.`, []));
    return hasil;
  }
  const rekomendasi = saranBlangkoLengkap(masukanRekomendasiDariBaris(b));
  const voluntair = Number(b.alurPerkaraId) === 16;
  if (peran === "hakim") {
    const saran = urutkan(rekomendasi.putusan);
    if (!saran.length) return [];
    const j: JenisPekerjaan = voluntair ? "penetapan" : "putusan";
    return [butirDasar(b, j, NAMA_PEKERJAAN[j], sudahPutus ? "Perkara ini sudah tercatat diputus." : "Sidang pada tanggal ini dapat memutus.", saran)];
  }
  if (peran === "pp") {
    const saran = urutkan(rekomendasi.bas);
    return saran.length ? [butirDasar(b, "bas", NAMA_PEKERJAAN.bas, `Sidang ke-${Number(b.urutanSidang) || 1}${teks(b.agenda) ? `, agenda ${teks(b.agenda)}` : ""}.`, saran)] : [];
  }
  const saran = urutkan(rekomendasi.relaas);
  return saran.length ? [butirDasar(b, "relaas", NAMA_PEKERJAAN.relaas, b.ditunda === true ? "Sidang ditunda; pihak yang tidak hadir perlu dipanggil." : "Panggilan atau pemberitahuan untuk sidang ini.", saran)] : [];
}

export type DaftarSiap = { peran: PeranAlur; butir: ButirSiap[]; jumlahBaris: number };

/** Satu butir per (perkara, pekerjaan, sidang); urut menurut tanggal sidang lalu nomor perkara. */
export function susunDaftarSiap(baris: Array<Record<string, unknown>>, peran: PeranAlur): DaftarSiap {
  const lihat = new Set<string>();
  const butir: ButirSiap[] = [];
  for (const b of baris) {
    for (const x of butirDariBaris(b, peran)) {
      if (lihat.has(x.kunci)) continue;
      lihat.add(x.kunci);
      butir.push(x);
    }
  }
  butir.sort((a, b) => a.tanggalSidang.localeCompare(b.tanggalSidang) || a.nomorPerkara.localeCompare(b.nomorPerkara, "id", { numeric: true }));
  return { peran, butir, jumlahBaris: baris.length };
}
