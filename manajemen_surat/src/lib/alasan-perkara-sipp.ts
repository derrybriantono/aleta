import { usulkanMedanPutusan, type MedanPilihan, type UsulanMedan } from "@/lib/usulan-medan-putusan";

/**
 * ============================================================================
 * ISIAN ALASAN PADA LAYAR INFO PERKARA AGAMA (DATA UMUM)
 * ============================================================================
 *
 * Layar Data Umum SIPP menuntut satu medan "alasan" yang BERBEDA untuk tiap
 * jenis perkara agama, dan hanya satu di antaranya yang tampak pada satu
 * perkara:
 *
 *   341 Izin Poligami          alasan_poligami
 *   344 Pembatalan Perkawinan  batal_kawin
 *   349 Penguasaan Anak        alasan_kuasa_anak
 *   352 Pengesahan Anak        alasan_sah_anak
 *   358 Asal Usul Anak         alasan_asalusul
 *   360 Itsbat Nikah           alasan_isbat
 *   362 Dispensasi Kawin       alasan_dispen
 *   370 Ekonomi Syariah        bidang_ekonomi_syariah, akad_syariah_primer
 *
 * Seluruhnya tersimpan ke satu tabel - perkara_alasan_nikah - dengan
 * jenis_alasan_id yang membedakannya, dan angka itulah yang kelak menjadi
 * laporan statistik perkara agama. Salah memilih di sini bukan salah ketik
 * yang kelihatan, melainkan satu baris laporan yang keliru selama setahun.
 *
 * ============================================================================
 * DAFTAR PILIHANNYA TIDAK DISIMPAN DI SINI
 * ============================================================================
 *
 * Nomor-nomor pilihan tiap medan hidup di tabel rujukan SIPP - ref_poligami,
 * ref_batal_kawin, ref_dispensasi_kawin, dan seterusnya. Menyalinnya ke sini
 * berarti ALETA menyimpang diam-diam pada hari SIPP menambah satu baris.
 *
 * Karena itu ekstensi mengirimkan daftar pilihan YANG BENAR-BENAR ADA pada
 * borang yang sedang terbuka, dan yang dikerjakan di sini hanya memilih satu
 * di antaranya berdasarkan bunyi posita. Tidak ada satu pun nomor SIPP yang
 * dihafal portal.
 *
 * ============================================================================
 * BUKTINYA POSITA, BUKAN DRAF PUTUSAN
 * ============================================================================
 *
 * Data Umum diisi pada hari perkara didaftarkan. Pada hari itu belum ada draf
 * putusan, belum ada pertimbangan hukum, dan belum ada amar - jadi berbeda
 * dengan borang Putusan Akhir, yang dibaca di sini adalah posita dan petitum
 * yang ada di halaman yang sama. Keduanya sudah ada di layar itu sebagai
 * CKEditor, sehingga tidak ada satu pun pembacaan tambahan ke basis data SIPP.
 */

/** Huruf ganti yang lazim ditemui pada keluaran CKEditor. */
const HURUF_GANTI: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  hellip: "...",
};

/**
 * Isi CKEditor menjadi teks polos.
 *
 * Tag DIBUANG LEBIH DULU, baru huruf gantinya diterjemahkan. Urutan
 * sebaliknya mengubah "&lt;p&gt;" - yang oleh penulis posita dimaksudkan
 * sebagai tulisan biasa - menjadi tag sungguhan, lalu membuangnya. Kalimat
 * yang memuatnya akan hilang tanpa satu pun tanda.
 */
export function teksDariHtml(html: string): string {
  if (!html) return "";

  const dipatahkan = String(html)
    // Yang memisahkan kalimat pada HTML adalah blok, bukan baris baru. Tanpa
    // penggantian ini, akhir satu alinea menempel pada awal alinea berikutnya
    // dan melahirkan kata yang tidak pernah ditulis siapa pun.
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|tr|h[1-6]|blockquote|td|th)\s*>/gi, "\n")
    .replace(/<\s*(li|tr)\b[^>]*>/gi, "\n")
    // Isi <script> dan <style> bukan kalimat perkara; membiarkannya hanya
    // menambah kata yang ikut dinilai.
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ");

  const diterjemahkan = dipatahkan
    .replace(/&#x([0-9a-f]+);/gi, (_cocok, kode: string) => {
      const angka = Number.parseInt(kode, 16);
      return Number.isFinite(angka) && angka > 0 && angka < 0x110000 ? String.fromCodePoint(angka) : " ";
    })
    .replace(/&#(\d+);/g, (_cocok, kode: string) => {
      const angka = Number.parseInt(kode, 10);
      return Number.isFinite(angka) && angka > 0 && angka < 0x110000 ? String.fromCodePoint(angka) : " ";
    })
    .replace(/&([a-z]+);/gi, (cocok, nama: string) => {
      const ganti = HURUF_GANTI[String(nama).toLowerCase()];
      return ganti === undefined ? cocok : ganti;
    });

  return diterjemahkan
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n[ \n]*/g, "\n")
    .trim();
}

export type TeksPerkara = {
  posita?: string | null;
  petitum?: string | null;
};

/**
 * Bukti yang dipakai menilai usulan.
 *
 * Posita lebih dahulu, petitum sesudahnya. Posita menguraikan DUDUK
 * PERKARANYA - "calon istri telah hamil", "suami meninggalkan tanpa kabar" -
 * dan di situlah alasannya tertulis. Petitum hanya menyebut yang dimohonkan,
 * jadi ia dibaca sebagai pelengkap, bukan sebagai sumber utama.
 */
export function susunTeksAlasan(teks: TeksPerkara): string {
  return [teksDariHtml(teks.posita ?? ""), teksDariHtml(teks.petitum ?? "")]
    .filter((satu) => satu.length > 0)
    .join("\n\n");
}

/**
 * Usulan untuk medan alasan pada layar Data Umum.
 *
 * Pencocokannya memakai mesin yang sama dengan borang Putusan Akhir - satu
 * mesin, satu perilaku, satu tempat diperbaiki. Yang berbeda hanya SUMBER
 * TEKSNYA: di sini posita, di sana pertimbangan dan duduk perkara.
 */
export function usulkanAlasanPerkara(teks: TeksPerkara, medan: MedanPilihan[]): UsulanMedan[] {
  const dasar = susunTeksAlasan(teks);
  if (!dasar) return [];
  return usulkanMedanPutusan(dasar, medan);
}
