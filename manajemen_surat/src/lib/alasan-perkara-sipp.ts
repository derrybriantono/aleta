import {
  hormatiTerpilih,
  usulkanMedanPutusan,
  type MedanPilihan,
  type OpsiUsulanMedan,
  type PilihanMedan,
  type UsulanMedan,
} from "@/lib/usulan-medan-putusan";

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
 * ============================================================================
 * ALASAN ISBAT NIKAH: BAWAANNYA "NIKAH DIBAWAH TANGAN"
 * ============================================================================
 *
 * Diukur atas 403 permohonan isbat 2025-2026 PA Donggala yang alasannya
 * SUDAH dipilih petugas: 396 "Nikah dibawah tangan", 7 "Kelengkapan
 * administrasi", 0 "Akta nikah hilang", 0 "Perceraian". Pencocok kata biasa
 * menjawab benar 2 dari 403 - hampir semuanya menjadi "Akta nikah hilang",
 * sebab posita isbat selalu menulis "tidak mempunyai kutipan AKTA NIKAH" dan
 * kata "akta" memenangkan label itu.
 *
 * Karena itu:
 *   - "Akta nikah hilang" hanya bila akta/buku nikah disebut HILANG, RUSAK,
 *     atau TERBAKAR pada kalimat yang sama;
 *   - "Perceraian" hanya pada kumulasi cerai - petitumnya meminta talak
 *     dijatuhkan atau perkawinan diputus. Kata "cerai" pada posita isbat
 *     hampir selalu keterangan status ("Janda, Akta Cerai Nomor ...");
 *   - selain itu "Nikah dibawah tangan", berkeyakinan "cukup".
 *
 * Tujuh "Kelengkapan administrasi" tidak punya pola yang membedakannya dari
 * posita dibawah tangan ("membutuhkan Akta Nikah untuk mengurus ...") dan
 * dibiarkan salah - ukurannya dilaporkan, bukan disembunyikan.
 */
const POLA_MEDAN_ISBAT = /isbat|itsbat|istbat|pengesahan\s+(?:nikah|perkawinan)/i;
const POLA_AKTA_HILANG =
  /(?:akta\s+nikah|buku\s+nikah|kutipan\s+akta)[^.;]{0,60}\b(?:hilang|rusak|terbakar)\b|\b(?:hilang|rusak|terbakar)\b[^.;]{0,40}(?:akta\s+nikah|buku\s+nikah|kutipan\s+akta)/i;
const POLA_KUMULASI_CERAI =
  /menjatuhkan\s+talak|ikrar\s+talak|mengikrarkan\s+talak|menceraikan|memutuskan\s+perkawinan|putus\s+karena\s+perceraian/i;
const POLA_DIBAWAH_TANGAN_TEGAS = /di\s*bawah\s*tangan|nikah\s+sirr?i/i;

function kalimatDari(teks: string): string[] {
  return String(teks ?? "")
    .split(/(?<=[.;:])\s+|\n+/)
    .map((satu) => satu.trim())
    .filter(Boolean);
}

function pangkasKutipan(kalimat: string): string {
  return kalimat.length > 300 ? `${kalimat.slice(0, 300)}…` : kalimat;
}

function pilihanBerbunyi(medan: MedanPilihan, pola: RegExp): PilihanMedan | undefined {
  return (medan.pilihan ?? []).find(
    (x) =>
      String(x.nilai ?? "").trim() !== "" &&
      String(x.nilai) !== "0" &&
      String(x.nilai) !== "-1" &&
      pola.test(String(x.label ?? ""))
  );
}

function usulkanAlasanIsbat(teks: TeksPerkara, medan: MedanPilihan): UsulanMedan | null {
  const posita = teksDariHtml(teks.posita ?? "");
  const petitum = teksDariHtml(teks.petitum ?? "");
  const kalimat = kalimatDari(`${posita}\n${petitum}`);
  const hilang = pilihanBerbunyi(medan, /hilang/i);
  const cerai = pilihanBerbunyi(medan, /cerai/i);
  const bawahTangan = pilihanBerbunyi(medan, /bawah\s*tangan/i);
  if (!bawahTangan) return null;

  const dasar: UsulanMedan = {
    kunci: medan.kunci,
    label: medan.label,
    nilai: "",
    nilaiLabel: "",
    keyakinan: "kosong",
    kutipan: "",
    saingan: [],
    alasan: "",
    sumberUsulan: "pertimbangan",
  };

  const kalimatHilang = kalimat.find((x) => POLA_AKTA_HILANG.test(x));
  const kalimatBawahTangan = kalimat.find((x) => POLA_DIBAWAH_TANGAN_TEGAS.test(x));
  if (kalimatHilang && hilang) {
    // Keduanya disebut tegas: yang menentukan petugas.
    if (kalimatBawahTangan) {
      return {
        ...dasar,
        nilai: String(hilang.nilai),
        nilaiLabel: hilang.label,
        keyakinan: "bentrok",
        kutipan: pangkasKutipan(kalimatHilang),
        saingan: [{ nilai: String(bawahTangan.nilai), label: bawahTangan.label, nilai_skor: 0 }],
        alasan: `Posita menyebut lebih dari satu kemungkinan (${hilang.label} dan ${bawahTangan.label}). Periksa sendiri mana yang menjadi alasannya.`,
      };
    }
    return {
      ...dasar,
      nilai: String(hilang.nilai),
      nilaiLabel: hilang.label,
      keyakinan: "cukup",
      kutipan: pangkasKutipan(kalimatHilang),
      saingan: [{ nilai: String(bawahTangan.nilai), label: bawahTangan.label, nilai_skor: 0 }],
      alasan: "Posita menyebut akta/buku nikah hilang, rusak, atau terbakar. Periksa sendiri.",
    };
  }

  const kalimatCerai = kalimatDari(petitum).find((x) => POLA_KUMULASI_CERAI.test(x));
  if (kalimatCerai && cerai) {
    return {
      ...dasar,
      nilai: String(cerai.nilai),
      nilaiLabel: cerai.label,
      keyakinan: "cukup",
      kutipan: pangkasKutipan(kalimatCerai),
      saingan: [{ nilai: String(bawahTangan.nilai), label: bawahTangan.label, nilai_skor: 0 }],
      alasan: "Petitum meminta perceraian bersama pengesahan nikah - kumulasi cerai. Periksa sendiri.",
    };
  }

  return {
    ...dasar,
    nilai: String(bawahTangan.nilai),
    nilaiLabel: bawahTangan.label,
    keyakinan: "cukup",
    kutipan: kalimatBawahTangan ? pangkasKutipan(kalimatBawahTangan) : "",
    alasan:
      "Posita tidak menyebut akta nikah yang hilang, rusak, atau terbakar, dan petitum tidak meminta perceraian. " +
      "Pada 396 dari 403 isbat 2025-2026 alasannya Nikah dibawah tangan. Periksa sendiri.",
  };
}

/**
 * Usulan untuk medan alasan pada layar Data Umum.
 *
 * Pencocokannya memakai mesin yang sama dengan borang Putusan Akhir - satu
 * mesin, satu perilaku, satu tempat diperbaiki. Yang berbeda hanya SUMBER
 * TEKSNYA: di sini posita, di sana pertimbangan dan duduk perkara. Alasan
 * isbat punya aturannya sendiri - lihat usulkanAlasanIsbat.
 *
 * Asal usul anak (7 perkara 2025-2026, ketujuhnya "Kepastian hukum /
 * kelengkapan administrasi") TIDAK diberi aturan: posita ketujuhnya tidak
 * memuat satu pun kata yang membedakan alasan itu dari "Pengingkaran anak",
 * jadi usulannya tetap kosong sampai ada pola yang dapat diukur.
 */
export function usulkanAlasanPerkara(
  teks: TeksPerkara,
  medan: MedanPilihan[],
  opsi: OpsiUsulanMedan = {}
): UsulanMedan[] {
  const dasar = susunTeksAlasan(teks);
  if (!dasar) return [];
  // Posita bukan pertimbangan: kalimat rujukan tidak dibuang di sini - lihat
  // OpsiUsulanMedan.saringRujukan.
  const umum = usulkanMedanPutusan(dasar, medan, { saringRujukan: false, ...opsi });
  return umum.map((usul, indeks) => {
    const satu = medan[indeks];
    if (!satu || !POLA_MEDAN_ISBAT.test(String(satu.label ?? ""))) return usul;
    const isbat = usulkanAlasanIsbat(teks, satu);
    return isbat ? hormatiTerpilih(satu, isbat) : usul;
  });
}
