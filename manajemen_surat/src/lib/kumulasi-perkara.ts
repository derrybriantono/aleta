/**
 * ============================================================================
 * KUMULASI PERKARA - SEBUTAN DI LAYAR
 * ============================================================================
 *
 * Diminta pengguna 12 Oktober 2026 (antrian sidang butir 1): "Apabila ada
 * kumulasi perkara maka taruh namanya dengan kumulasi (contoh Cerai Gugat
 * Kumulasi Hak Asuh Anak), apabila tidak diisi di SIPP maka cek petitumnya
 * ... tambah juga di rincian."
 *
 * Yang MENENTUKAN kumulasinya bot (aleta_bot/services/kumulasiPerkaraService.js):
 * perkara_kumulasi SIPP lebih dulu, dan bila kosong, petitum perkara cerai
 * talak/gugat dianalisa. Berkas ini hanya menyusun sebutannya - satu aturan
 * untuk Jadwal Sidang, Jadwal Mediasi, dan Status Perkara.
 *
 * Hasil petitum SELALU ditandai "dari petitum": itu bacaan ALETA, bukan
 * catatan petugas, dan yang membacanya harus tahu bedanya.
 */

export type SumberKumulasi = "sipp" | "petitum";

export type KumulasiButir = {
  kode: string;
  nama: string;
  sumber: SumberKumulasi;
  /** Butir petitum yang memuat tuntutannya - hanya pada sumber "petitum". */
  kutipan?: string;
};

export type KumulasiPerkara = {
  daftar: KumulasiButir[];
  sumber: SumberKumulasi | "campuran";
};

/** Saklar Tampilan Jadwal Sidang yang mengatur seluruh tampilan kumulasi. */
export const KUNCI_SAKLAR_KUMULASI = "kumulasi-perkara";

/** Daftar yang aman dipakai: bentuk rusak/bot lama -> []. */
export function butirKumulasi(kumulasi: KumulasiPerkara | null | undefined): KumulasiButir[] {
  if (!kumulasi || !Array.isArray(kumulasi.daftar)) return [];
  return kumulasi.daftar.filter(
    (x): x is KumulasiButir => Boolean(x) && typeof x.nama === "string" && x.nama.trim() !== ""
  );
}

/** "A", "A dan B", "A, B, dan C". */
export function gabungSebutan(nama: string[]): string {
  const bersih = nama.map((x) => x.trim()).filter(Boolean);
  if (bersih.length <= 1) return bersih[0] ?? "";
  if (bersih.length === 2) return `${bersih[0]} dan ${bersih[1]}`;
  return `${bersih.slice(0, -1).join(", ")}, dan ${bersih[bersih.length - 1]}`;
}

/**
 * "Cerai Gugat Kumulasi Hak Asuh Anak". Tanpa kumulasi: jenisnya apa adanya.
 * Jenis kosong: "Kumulasi ..." saja tidak bermakna, jadi "—" bila keduanya
 * kosong.
 */
export function namaJenisDenganKumulasi(
  jenisPerkara: string | null | undefined,
  kumulasi: KumulasiPerkara | null | undefined
): string {
  const jenis = String(jenisPerkara ?? "").trim();
  const butir = butirKumulasi(kumulasi);
  if (butir.length === 0) return jenis || "—";
  const ekor = `Kumulasi ${gabungSebutan(butir.map((x) => x.nama))}`;
  return jenis ? `${jenis} ${ekor}` : ekor;
}

/** Ada butir yang hanya terbaca dari petitum (bukan dari SIPP). */
export function adaDariPetitum(kumulasi: KumulasiPerkara | null | undefined): boolean {
  return butirKumulasi(kumulasi).some((x) => x.sumber === "petitum");
}

/**
 * Kalimat keterangan (title/tooltip): sumber tiap butir, dan bila dari
 * petitum, kutipan tuntutannya.
 */
export function keteranganKumulasi(kumulasi: KumulasiPerkara | null | undefined): string {
  const butir = butirKumulasi(kumulasi);
  if (butir.length === 0) return "";
  const baris = butir.map((x) =>
    x.sumber === "petitum"
      ? `${x.nama} - dari petitum, belum dicatat di SIPP${x.kutipan ? `: "${x.kutipan}"` : ""}`
      : `${x.nama} - tercatat di SIPP`
  );
  const catatan = adaDariPetitum(kumulasi)
    ? "\nKumulasi dari petitum dibaca ALETA dari tuntutan primer; periksa dan lengkapi data kumulasi di SIPP."
    : "";
  return `Kumulasi perkara:\n${baris.join("\n")}${catatan}`;
}
