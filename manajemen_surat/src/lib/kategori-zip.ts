/* === STATUS-ZIP 12 Okt === */

/**
 * Kategori isi ZIP "Unduh seluruh berkas" yang dapat dipilih (butir 11).
 *
 * Berkas ini bebas dari bot, basis data, dan Node - dipakai DUA pihak sekaligus:
 * penyusun ZIP di peladen (susun-arsip-perkara.ts) dan dialog pilihan di
 * peramban (tombol-unduh-zip.tsx). Daftarnya satu, supaya kategori yang
 * ditawarkan layar dan kategori yang dipahami penyusun tidak menyimpang.
 *
 * Kuncinya dipakai di alamat (?kategori=bas,relaas); folder ZIP-nya tidak
 * diberi nomor baru - penomoran 01-08 sudah terpasang sejak 23 September 2026
 * dan petugas sudah punya ZIP bernomor itu.
 */
export const KATEGORI_ARSIP = [
  "data",
  "gugatan",
  "relaas",
  "bas",
  "putusan",
  "penetapan",
  "ecourt",
  "lainnya",
  "arsip",
] as const;
export type KategoriArsip = (typeof KATEGORI_ARSIP)[number];

export const LABEL_KATEGORI_ARSIP: Record<KategoriArsip, string> = {
  data: "Data SIPP (JSON + CSV)",
  gugatan: "Gugatan / permohonan",
  relaas: "Relaas (dan resi pos)",
  bas: "BAS (berita acara sidang)",
  putusan: "Putusan",
  penetapan: "Penetapan (PMH, PPP, PJS, PHS, ikrar talak)",
  ecourt: "e-Court (jawaban, replik, duplik, kesimpulan, alat bukti)",
  lainnya: "Lainnya (lampiran SIPP)",
  arsip: "Arsip fisik (pindaian, 2-28 MB sebuah)",
};

/** Folder ZIP tiap kategori - satu tempat, dipakai penyusun dan penjaga uji. */
export const FOLDER_KATEGORI_ARSIP: Record<KategoriArsip, string> = {
  data: "00 Data SIPP",
  gugatan: "01 Gugatan",
  relaas: "02 Relaas",
  bas: "03 BAS",
  putusan: "04 Putusan",
  lainnya: "05 Lampiran",
  ecourt: "06 e-Court",
  penetapan: "07 Penetapan",
  arsip: "08 Arsip fisik",
};

/** Kategori yang ikut bila petugas memilih "Semua" - arsip fisik (berat) menunggu dicentang sendiri. */
export const KATEGORI_SEMUA: readonly KategoriArsip[] = KATEGORI_ARSIP.filter((k) => k !== "arsip");

/**
 * Menguraikan ?kategori=a,b,c. null = tidak menyebut apa pun (perilaku lama:
 * seluruhnya). "semua" = seluruh kategori KECUALI arsip fisik, yang berat dan
 * hanya ikut bila disebut sendiri. Kunci yang tidak dikenal dibuang; bila tidak
 * satu pun dikenal hasilnya larik kosong - pemanggil menjawab 400, bukan ZIP
 * kosong yang tampak berhasil.
 */
export function uraiKategoriArsip(mentah: string | null | undefined): KategoriArsip[] | null {
  const teks = String(mentah ?? "").trim().toLowerCase();
  if (!teks) return null;
  const kunci = teks.split(/[,;\s]+/).filter(Boolean);
  const hasil = new Set<KategoriArsip>();
  for (const k of kunci) {
    if (k === "semua") {
      for (const x of KATEGORI_SEMUA) hasil.add(x);
    } else if ((KATEGORI_ARSIP as readonly string[]).includes(k)) {
      hasil.add(k as KategoriArsip);
    }
  }
  return KATEGORI_ARSIP.filter((x) => hasil.has(x));
}

/** Kategori sebuah entri dari awal namanya - satu tempat, bukan dua tabel yang menyimpang. */
export function kategoriDariNama(nama: string): KategoriArsip | "umum" {
  for (const k of KATEGORI_ARSIP) {
    if (nama.startsWith(`${FOLDER_KATEGORI_ARSIP[k]}/`)) return k;
  }
  if (nama === "RINGKASAN.txt") return "data";
  return "umum";
}

/* === AKHIR STATUS-ZIP === */
