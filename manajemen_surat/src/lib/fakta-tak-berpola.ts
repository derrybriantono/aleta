/**
 * MENARIK FAKTA TAK BERPOLA (I1).
 *
 * ============================================================================
 * INILAH SATU PEKERJAAN YANG MEMANG MENUNTUT MODEL
 * ============================================================================
 *
 * Gugatan tulisan tangan yang dipindai, berkas yang urutannya berantakan,
 * surat yang bentuknya berbeda tiap desa - tidak ada pola yang dapat ditulis
 * untuk membacanya. Di sinilah model benar-benar mengerjakan sesuatu yang
 * tidak dapat dikerjakan aturan pasti.
 *
 * Yang TIDAK dikerjakan di sini: menilai. Modul ini menarik apa yang tertulis,
 * bukan menyimpulkan apa artinya. "Tergugat tidak pernah memberi nafkah sejak
 * 2024" ditarik sebagai dalil yang TERTULIS, bukan sebagai fakta yang terbukti.
 *
 * ============================================================================
 * TIAP FAKTA WAJIB MEMBAWA KUTIPANNYA
 * ============================================================================
 *
 * Fakta tanpa kutipan tidak dapat diperiksa, dan fakta yang tidak dapat
 * diperiksa tidak boleh masuk berkas. Model yang menarik "tanggal nikah 12
 * Maret 2015" tanpa menunjukkan kalimat asalnya mungkin membacanya, mungkin
 * mengarangnya - dan keduanya menghasilkan tanggal yang bentuknya sama-sama
 * benar.
 *
 * Maka fakta yang kutipannya tidak ditemukan di dalam naskah sumber DIBUANG,
 * bukan ditandai ragu. Menandainya ragu berarti ia tetap muncul di layar, dan
 * yang muncul di layar akhirnya dipakai.
 *
 * ============================================================================
 * "TIDAK TAHU" ADALAH JAWABAN YANG SAH
 * ============================================================================
 *
 * Ruas yang tidak tertulis di naskah dikembalikan kosong beserta sebabnya.
 * Model yang dituntut mengisi semua ruas akan mengisi semua ruas - dan yang
 * diisinya untuk ruas yang tidak ada di naskah adalah karangan yang
 * bentuknya persis seperti bacaan.
 */

export type JenisFakta =
  | "identitas"
  | "tanggal"
  | "tempat"
  | "dalil"
  | "petitum"
  | "bukti"
  | "lainnya";

export type FaktaTertarik = {
  /** Nama ruas, misalnya "tanggalNikah" atau "alasanPerceraian". */
  nama: string;
  jenis: JenisFakta;
  nilai: string;
  /**
   * Kalimat asal, disalin apa adanya dari naskah sumber.
   *
   * Wajib. Inilah yang membuat fakta ini dapat diperiksa tanpa membuka
   * berkas aslinya.
   */
  kutipan: string;
  /** Halaman tempat kutipannya berada; 0 bila tidak diketahui. */
  halaman: number;
};

export type HasilTarik = {
  fakta: FaktaTertarik[];
  /** Fakta yang dibuang karena kutipannya tidak ada di naskah sumber. */
  dibuang: Array<{ nama: string; nilai: string; sebab: string }>;
  /** Ruas yang diminta tetapi tidak tertulis di naskah. */
  tidakTertulis: string[];
  peringatan: string[];
};

function bakukan(teks: string): string {
  return String(teks ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

/**
 * Kutipan dianggap ada bila bunyinya benar-benar muncul di naskah.
 *
 * Dibandingkan sesudah spasi dan tanda baca dibakukan, karena model kerap
 * merapikan spasi ganda dan tanda kutip saat menyalin. Yang TIDAK ditoleransi
 * adalah kata yang berbeda - itu bukan penyalinan lagi, melainkan penulisan
 * ulang, dan penulisan ulang tidak dapat dipakai memeriksa apa pun.
 */
export function kutipanAdaDiNaskah(kutipan: string, naskah: string): boolean {
  const cari = bakukan(kutipan);
  if (cari.length < 8) return false;
  return bakukan(naskah).includes(cari);
}

export type MasukanTarik = {
  /** Naskah sumber - hasil OCR atau teks PDF, apa adanya. */
  naskah: string;
  /** Ruas yang diminta. Model tidak boleh menambah ruas di luar ini. */
  ruasDiminta: string[];
  /** Yang dikembalikan model, belum diperiksa. */
  dariModel: Array<{ nama?: string; jenis?: string; nilai?: string; kutipan?: string; halaman?: number }>;
};

const JENIS_SAH = new Set<JenisFakta>([
  "identitas",
  "tanggal",
  "tempat",
  "dalil",
  "petitum",
  "bukti",
  "lainnya",
]);

/**
 * Memeriksa apa yang dikembalikan model terhadap naskah sumbernya.
 *
 * Tiga penolakan, dan ketiganya membuang - bukan menandai:
 *
 *   - ruas yang tidak diminta: model yang boleh menambah ruas akan menambah
 *     ruas, dan yang ditambahkannya tidak pernah diperiksa siapa pun;
 *   - kutipan kosong: tanpa kutipan tidak ada yang dapat diperiksa; dan
 *   - kutipan yang tidak ada di naskah: itu karangan, betapa pun masuk akal
 *     bunyinya.
 */
export function periksaTarikan(masukan: MasukanTarik): HasilTarik {
  const diminta = new Set(masukan.ruasDiminta.map((item) => String(item ?? "").trim()).filter(Boolean));
  const fakta: FaktaTertarik[] = [];
  const dibuang: HasilTarik["dibuang"] = [];
  const terisi = new Set<string>();

  for (const satu of masukan.dariModel ?? []) {
    const nama = String(satu.nama ?? "").trim();
    const nilai = String(satu.nilai ?? "").trim();
    const kutipan = String(satu.kutipan ?? "").trim();

    if (!nama) continue;

    if (!diminta.has(nama)) {
      dibuang.push({ nama, nilai, sebab: "Ruas ini tidak diminta." });
      continue;
    }
    if (!nilai) continue;
    if (!kutipan) {
      dibuang.push({ nama, nilai, sebab: "Tidak menyertakan kutipan asalnya." });
      continue;
    }
    if (!kutipanAdaDiNaskah(kutipan, masukan.naskah)) {
      dibuang.push({
        nama,
        nilai,
        sebab: "Kutipannya tidak ditemukan di naskah sumber - kemungkinan dikarang.",
      });
      continue;
    }

    const jenis = String(satu.jenis ?? "lainnya").trim() as JenisFakta;
    fakta.push({
      nama,
      jenis: JENIS_SAH.has(jenis) ? jenis : "lainnya",
      nilai,
      kutipan,
      halaman: Number(satu.halaman) > 0 ? Number(satu.halaman) : 0,
    });
    terisi.add(nama);
  }

  const tidakTertulis = [...diminta].filter((nama) => !terisi.has(nama)).sort();

  const peringatan: string[] = [];
  if (dibuang.length) {
    peringatan.push(
      `${dibuang.length} tarikan dibuang karena kutipannya tidak dapat ditemukan di naskah sumber.`
    );
  }
  if (tidakTertulis.length) {
    peringatan.push(`Tidak tertulis di naskah: ${tidakTertulis.join(", ")}.`);
  }
  peringatan.push("Seluruh fakta di sini adalah yang TERTULIS, bukan yang terbukti.");

  return { fakta, dibuang, tidakTertulis, peringatan };
}

/**
 * Perintah untuk model.
 *
 * Disusun di sini, bukan di rutenya, supaya bunyinya dapat diuji. Perintah
 * yang hanya ada di dalam pemanggilan tidak pernah diperiksa siapa pun, dan
 * perubahan satu kalimatnya dapat mengubah seluruh perilaku penarikan tanpa
 * satu pun uji bersuara.
 */
export function susunPerintah(ruasDiminta: string[]): string {
  return [
    "Anda membaca naskah hukum dari pengadilan agama Indonesia.",
    "Tarik HANYA ruas berikut, tidak lebih: " + ruasDiminta.join(", ") + ".",
    "Untuk tiap ruas, sertakan kutipan kalimat asalnya DISALIN PERSIS dari naskah.",
    "Bila sebuah ruas tidak tertulis di naskah, JANGAN mengisinya dan jangan menebak - lewati saja.",
    "Jangan menyimpulkan, menilai, atau merapikan. Tarik yang tertulis apa adanya.",
    'Jawab dalam JSON: {"fakta":[{"nama":"","jenis":"","nilai":"","kutipan":"","halaman":0}]}',
  ].join("\n");
}
