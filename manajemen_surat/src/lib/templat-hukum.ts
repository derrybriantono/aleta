/**
 * TEMPLAT PERTIMBANGAN & DASAR HUKUM - aturan murni dan benih DRAF.
 *
 * ============================================================================
 * SEMUA BENIH ADALAH DRAF
 * ============================================================================
 *
 * Keputusan pengguna 29 September 2026: templat dibangun bertanda DRAF dan
 * baru boleh disisipkan ekstensi sesudah DISAHKAN Super Admin atas nama
 * pimpinan. Benih di bawah ini kerangka yang lazim, bukan kalimat yang sudah
 * dibaca pimpinan: tiap penanda {..} dan pilihan [..] harus diganti atau
 * dipilih petugas, dan tidak ada nomor perkara, nama, atau fakta yang
 * dikarang.
 *
 * Pasal-pasal alasan perceraian disalin dari bunyi Pasal 19 PP 9/1975 dan
 * Pasal 116 KHI. KHI Pasal 116 hanya sampai huruf h - kontrak menyediakan
 * kunci a..k, tetapi huruf i..k TIDAK dibenihkan karena tidak ada bunyinya
 * di kedua pasal itu. Super Admin tetap dapat menambahkannya bila satker
 * memakai huruf itu untuk keperluan lain.
 */

export type JenisTemplat = "pertimbangan" | "pasal";

export const JENIS_TEMPLAT: readonly JenisTemplat[] = ["pertimbangan", "pasal"];

/** Kunci pertimbangan yang dikenal ekstensi - status putusan. */
export const KUNCI_PERTIMBANGAN = ["gugur", "dicabut", "verstek", "tidak-diterima"] as const;

/** Kunci pasal - huruf alasan perceraian menurut kontrak. */
export const KUNCI_PASAL = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"] as const;

export const BATAS_JUDUL_TEMPLAT = 200;
export const BATAS_ISI_TEMPLAT = 20_000;

export function jenisTemplatSah(nilai: unknown): nilai is JenisTemplat {
  return nilai === "pertimbangan" || nilai === "pasal";
}

/**
 * Kunci sah menurut jenisnya. Pertimbangan boleh berkunci status lain
 * (mis. "ditolak") selama bentuknya slug - ekstensi hanya MENCARI kunci yang
 * ia kenal, jadi kunci tambahan tidak merusak apa pun. Pasal hanya a..k.
 */
export function kunciTemplatSah(jenis: JenisTemplat, kunci: unknown): kunci is string {
  const k = String(kunci ?? "").trim();
  if (jenis === "pasal") return (KUNCI_PASAL as readonly string[]).includes(k);
  return /^[a-z][a-z0-9-]{1,39}$/.test(k);
}

export type BenihTemplat = { id: string; jenis: JenisTemplat; kunci: string; judul: string; isi: string };

const BIAYA =
  "Menimbang, bahwa oleh karena perkara ini termasuk bidang perkawinan, maka berdasarkan Pasal 89 ayat (1) " +
  "Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang " +
  "Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009, biaya perkara " +
  "dibebankan kepada {pihak_pembayar};";

const PERTIMBANGAN: BenihTemplat[] = [
  {
    id: "th-benih-pertimbangan-gugur",
    jenis: "pertimbangan",
    kunci: "gugur",
    judul: "Gugatan gugur - Penggugat tidak hadir (DRAF)",
    isi: [
      "Menimbang, bahwa pada hari sidang yang telah ditetapkan, yaitu tanggal {tanggal_sidang}, Penggugat tidak " +
        "datang menghadap dan tidak pula menyuruh orang lain sebagai wakil atau kuasanya untuk menghadap, " +
        "meskipun menurut relaas panggilan tanggal {tanggal_relaas} Penggugat telah dipanggil secara resmi dan " +
        "patut, sedangkan tidak ternyata ketidakhadirannya disebabkan oleh suatu alasan yang sah;",
      "Menimbang, bahwa oleh karena itu, berdasarkan Pasal 148 R.Bg. [atau Pasal 124 HIR - pilih sesuai " +
        "wilayah], gugatan Penggugat harus dinyatakan gugur;",
      BIAYA.replace("{pihak_pembayar}", "Penggugat"),
    ].join("\n"),
  },
  {
    id: "th-benih-pertimbangan-dicabut",
    jenis: "pertimbangan",
    kunci: "dicabut",
    judul: "Gugatan dicabut (DRAF)",
    isi: [
      "Menimbang, bahwa Penggugat pada {tanggal_pencabutan} telah mengajukan pencabutan gugatannya dengan " +
        "alasan {alasan_pencabutan};",
      "Menimbang, bahwa pencabutan tersebut diajukan [sebelum Tergugat memberikan jawaban / sesudah jawaban " +
        "dan telah disetujui Tergugat - pilih salah satu], sehingga berdasarkan Pasal 271 dan Pasal 272 Rv " +
        "pencabutan gugatan tersebut patut dikabulkan;",
      BIAYA.replace("{pihak_pembayar}", "Penggugat"),
    ].join("\n"),
  },
  {
    id: "th-benih-pertimbangan-verstek",
    jenis: "pertimbangan",
    kunci: "verstek",
    judul: "Dikabulkan dengan verstek - Tergugat tidak hadir (DRAF)",
    isi: [
      "Menimbang, bahwa Tergugat tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain " +
        "sebagai wakil atau kuasanya untuk menghadap, meskipun telah dipanggil secara resmi dan patut " +
        "sebagaimana relaas panggilan tanggal {tanggal_relaas}, sedangkan tidak ternyata ketidakhadirannya " +
        "disebabkan oleh suatu alasan yang sah, maka Tergugat harus dinyatakan tidak hadir;",
      "Menimbang, bahwa gugatan Penggugat tidak melawan hukum dan beralasan, sehingga berdasarkan Pasal 149 " +
        "ayat (1) R.Bg. [atau Pasal 125 ayat (1) HIR - pilih sesuai wilayah] gugatan Penggugat dapat " +
        "dikabulkan dengan verstek;",
      "Menimbang, bahwa oleh karena perkara ini perkara perceraian, Majelis Hakim tetap membebankan " +
        "pembuktian kepada Penggugat [sesuaikan dengan pembuktian yang sungguh dilakukan dalam perkara ini];",
    ].join("\n"),
  },
  {
    id: "th-benih-pertimbangan-tidak-diterima",
    jenis: "pertimbangan",
    kunci: "tidak-diterima",
    judul: "Gugatan tidak dapat diterima (NO) (DRAF)",
    isi: [
      "Menimbang, bahwa setelah memeriksa gugatan Penggugat, Majelis Hakim menemukan cacat formil berupa " +
        "{cacat_formil} [mis. gugatan kabur (obscuur libel), kurang pihak, atau bukan kewenangan pengadilan ini " +
        "- uraikan dengan fakta perkara ini];",
      "Menimbang, bahwa oleh karena gugatan Penggugat mengandung cacat formil tersebut, gugatan Penggugat " +
        "harus dinyatakan tidak dapat diterima (niet ontvankelijke verklaard) tanpa mempertimbangkan pokok " +
        "perkaranya;",
      BIAYA.replace("{pihak_pembayar}", "Penggugat"),
    ].join("\n"),
  },
];

/**
 * Bunyi Pasal 19 PP 9/1975 (huruf a-f) dan Pasal 116 KHI (huruf a-h).
 * Huruf a-f di kedua pasal bermakna sama; g dan h hanya di KHI.
 */
const BUNYI_ALASAN: Array<{ huruf: string; ringkas: string; bunyi: string; hanyaKhi?: boolean }> = [
  {
    huruf: "a",
    ringkas: "zina, pemabuk, pemadat, penjudi",
    bunyi:
      "salah satu pihak berbuat zina atau menjadi pemabuk, pemadat, penjudi, dan lain sebagainya yang sukar disembuhkan",
  },
  {
    huruf: "b",
    ringkas: "meninggalkan 2 tahun berturut-turut",
    bunyi:
      "salah satu pihak meninggalkan pihak lain selama 2 (dua) tahun berturut-turut tanpa izin pihak lain dan tanpa " +
      "alasan yang sah atau karena hal lain di luar kemampuannya",
  },
  {
    huruf: "c",
    ringkas: "hukuman penjara 5 tahun atau lebih",
    bunyi:
      "salah satu pihak mendapat hukuman penjara 5 (lima) tahun atau hukuman yang lebih berat setelah perkawinan berlangsung",
  },
  {
    huruf: "d",
    ringkas: "kekejaman atau penganiayaan berat",
    bunyi: "salah satu pihak melakukan kekejaman atau penganiayaan berat yang membahayakan pihak lain",
  },
  {
    huruf: "e",
    ringkas: "cacat badan atau penyakit",
    bunyi:
      "salah satu pihak mendapat cacat badan atau penyakit dengan akibat tidak dapat menjalankan kewajibannya sebagai suami atau isteri",
  },
  {
    huruf: "f",
    ringkas: "perselisihan dan pertengkaran terus-menerus",
    bunyi:
      "antara suami dan isteri terus-menerus terjadi perselisihan dan pertengkaran dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga",
  },
  { huruf: "g", ringkas: "suami melanggar taklik talak", bunyi: "suami melanggar taklik talak", hanyaKhi: true },
  {
    huruf: "h",
    ringkas: "peralihan agama atau murtad",
    bunyi: "peralihan agama atau murtad yang menyebabkan terjadinya ketidakrukunan dalam rumah tangga",
    hanyaKhi: true,
  },
];

const PASAL: BenihTemplat[] = BUNYI_ALASAN.map((a) => ({
  id: `th-benih-pasal-${a.huruf}`,
  jenis: "pasal" as const,
  kunci: a.huruf,
  judul: `Huruf ${a.huruf} - ${a.ringkas} (DRAF)`,
  isi: a.hanyaKhi
    ? `Pasal 116 huruf ${a.huruf} Kompilasi Hukum Islam: perceraian dapat terjadi karena ${a.bunyi};`
    : `Pasal 19 huruf ${a.huruf} Peraturan Pemerintah Nomor 9 Tahun 1975 jo. Pasal 116 huruf ${a.huruf} ` +
      `Kompilasi Hukum Islam: perceraian dapat terjadi karena ${a.bunyi};`,
}));

/** Benih yang ditanam sekali. Id tetap - benih yang dihapus Super Admin tidak tumbuh lagi. */
export const BENIH_TEMPLAT: readonly BenihTemplat[] = [...PERTIMBANGAN, ...PASAL];

/** Tulisan tanda DRAF yang dipakai portal dan dicontoh ekstensi. */
export const TANDA_DRAF = "DRAF - belum disahkan pimpinan";
