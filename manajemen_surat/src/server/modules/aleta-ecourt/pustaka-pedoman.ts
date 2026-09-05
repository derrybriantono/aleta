import path from "node:path";

import { bacaPdf, cariDalamPdf, type IsiPdf, type Temuan } from "@/server/modules/aleta-ecourt/baca-pdf";

/**
 * PUSTAKA PEDOMAN BADILAG - naskah resmi yang dapat dicari dan dikutip.
 *
 * ============================================================================
 * DIURAI SEKALI, DIPAKAI BERKALI-KALI
 * ============================================================================
 *
 * Pedoman Penyusunan BAS & Putusan berisi 434 halaman. Menguraikannya pada
 * tiap pencarian menjadikan pemeriksaan sebelum cetak terasa berat tanpa
 * alasan - dan yang terasa berat akan berhenti dipakai.
 *
 * Naskahnya tidak pernah berubah tanpa berkasnya diganti, jadi hasil
 * penguraian disinggahkan selama proses hidup. Bila berkasnya diganti, wadah
 * ini dimulai ulang saat penerapan berikutnya dan singgahannya ikut kosong.
 *
 * ============================================================================
 * YANG DIKEMBALIKAN KUTIPAN, BUKAN KESIMPULAN
 * ============================================================================
 *
 * Pustaka ini TIDAK menafsirkan pedoman dan TIDAK menyatakan sesuatu sesuai
 * atau tidak sesuai. Yang dikembalikannya kutipan beserta halamannya, supaya
 * yang membacanya - panitera atau hakim - menilai sendiri.
 *
 * Menyatakan "sesuai pedoman" menuntut pemahaman atas maksud pedoman, dan
 * pernyataan semacam itu yang keliru jauh lebih berbahaya daripada tidak ada
 * pernyataan sama sekali: yang membacanya berhenti memeriksa.
 */

const AKAR = process.env.ALETA_PEDOMAN_DIR || "/usr/src/app/blangko_abt";

export type Pedoman = {
  id: string;
  nama: string;
  berkas: string;
  keterangan: string;
};

/**
 * Naskah yang dipakai.
 *
 * Ketiganya sudah berada di folder APS Badilag dan dibaca dari sana - bukan
 * salinan. Yang muncul di ALETA sama dengan yang dipegang panitera.
 */
export const PEDOMAN: Pedoman[] = [
  {
    id: "bas-putusan-2017",
    nama: "Pedoman Penyusunan BAS & Putusan",
    berkas: "Pedoman Penyusunan BAS & Putusan Revisi (07 Juni 2017).pdf",
    keterangan: "Direktorat Jenderal Badan Peradilan Agama, revisi 7 Juni 2017.",
  },
  {
    id: "form-kepaniteraan-2018",
    nama: "Form Kepaniteraan PA",
    berkas: "Final Naskah Penyempurnaan Form Kepaniteraan PA (31-12-2018).pdf",
    keterangan: "Naskah penyempurnaan formulir kepaniteraan, 31 Desember 2018.",
  },
  {
    id: "contoh-bas-ecourt",
    nama: "Contoh BAS e-Court",
    berkas: "Contoh BAS e-court.pdf",
    keterangan: "Contoh penyusunan BAS untuk perkara e-Court.",
  },
];

const singgahan = new Map<string, Promise<IsiPdf>>();

/**
 * Membaca satu pedoman, memakai hasil penguraian sebelumnya bila sudah ada.
 *
 * Yang disinggahkan JANJINYA, bukan hasilnya. Dua permintaan yang datang
 * bersamaan dengan begitu berbagi satu penguraian; menyinggahkan hasilnya saja
 * membuat keduanya mengurai 434 halaman masing-masing.
 */
export async function bacaPedoman(id: string): Promise<IsiPdf> {
  const pedoman = PEDOMAN.find((item) => item.id === id);
  if (!pedoman) {
    return { ada: false, sebab: "Pedoman tidak dikenali.", berkas: "", jumlahHalaman: 0, halamanKosong: [], halaman: [] };
  }

  const tersinggah = singgahan.get(pedoman.id);
  if (tersinggah) return tersinggah;

  const janji = bacaPdf(path.join(AKAR, pedoman.berkas));
  singgahan.set(pedoman.id, janji);

  // Penguraian yang gagal TIDAK disinggahkan. Berkas yang belum terpasang saat
  // wadah baru menyala akan terbaca pada permintaan berikutnya; menyinggahkan
  // kegagalannya berarti ia tetap dianggap tidak ada sampai wadahnya dimulai
  // ulang, dan sebabnya sudah lama hilang.
  const hasil = await janji;
  if (!hasil.ada) singgahan.delete(pedoman.id);

  return hasil;
}

export type TemuanPedoman = Temuan & {
  pedomanId: string;
  pedoman: string;
};

/** Mencari kata di seluruh pedoman, atau di satu pedoman bila disebut. */
export async function cariPedoman(kata: string, pedomanId = "", batasPerPedoman = 5): Promise<TemuanPedoman[]> {
  const dicari = String(kata ?? "").trim();
  if (!dicari) return [];

  const daftar = pedomanId ? PEDOMAN.filter((item) => item.id === pedomanId) : PEDOMAN;
  const hasil: TemuanPedoman[] = [];

  for (const pedoman of daftar) {
    const isi = await bacaPedoman(pedoman.id);
    if (!isi.ada) continue;
    for (const temuan of cariDalamPdf(isi, dicari, batasPerPedoman)) {
      hasil.push({ ...temuan, pedomanId: pedoman.id, pedoman: pedoman.nama });
    }
  }

  return hasil;
}

/**
 * Kata kunci pencarian pedoman untuk satu blangko.
 *
 * Diambil dari nama berkas blangkonya sendiri - "BAS 2 P Hadir & T Tidak Hadir
 * - Putusan Verstek" menjadi "BAS Lanjutan Putus Verstek" di daftar isi
 * pedoman. Pencocokannya tidak dapat sempurna karena keduanya ditulis orang
 * yang berbeda pada tahun yang berbeda; karena itu yang dikembalikan KUTIPAN
 * untuk dinilai, bukan pernyataan sesuai atau tidak.
 */
export function kataKunciBlangko(namaBlangko: string): string[] {
  const bersih = String(namaBlangko ?? "")
    .replace(/\.(rtf|doc|docx|odt)$/i, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\(e-?court\)/i, "")
    .trim();

  const kata: string[] = [];
  if (/verstek/i.test(bersih)) kata.push("Putus Verstek");
  if (/mediasi/i.test(bersih)) kata.push("Mediasi");
  if (/saksi/i.test(bersih)) kata.push("Pemeriksaan Saksi");
  if (/cabut/i.test(bersih)) kata.push("Cabut");
  if (/gugur/i.test(bersih)) kata.push("Putus Gugur");
  if (/jawaban/i.test(bersih)) kata.push("Jawaban");
  if (/replik/i.test(bersih)) kata.push("Replik");
  if (/duplik/i.test(bersih)) kata.push("Duplik");
  if (/pembuktian/i.test(bersih)) kata.push("Pembuktian");
  if (/kesimpulan/i.test(bersih)) kata.push("Kesimpulan");
  if (/tunda/i.test(bersih)) kata.push("Tunda");

  // Bila tidak satu pun kata khusus dikenali, dicari bentuk umumnya - lebih
  // baik menampilkan bagian pedoman yang terlalu umum daripada tidak
  // menampilkan apa pun dan membiarkan yang memakainya mengira pedomannya
  // tidak memuat dokumen ini.
  if (kata.length === 0) kata.push(/^BAS|BAS\s/i.test(bersih) ? "Berita Acara Sidang" : "Putusan");

  return kata;
}
