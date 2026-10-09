/**
 * ============================================================================
 * HASIL MEDIASI OTOMATIS - PILIHAN MEDIATOR MENJADI NASKAH (7 Okt 2026)
 * ============================================================================
 *
 * Mediator memilih HASIL mediasi dan BUTIR yang disepakati di pop-up Jadwal
 * Mediasi; berkas ini menyusunnya menjadi naskah utuh - urutan dan isinya
 * mengikuti contoh satker sendiri ("371_Pdt.G_2025_PA.Dgl - Laporan Mediasi
 * Berhasil Sebagian.rtf") dan model Lampiran I KMA 108/KMA/SK/VI/2016:
 *
 *   1. Surat pengantar "Hal : Laporan Mediasi" kepada Majelis   (I-16)
 *   2. LAPORAN HASIL MEDIASI + perincian biaya                  (I-16, I-18)
 *   3. PERNYATAAN PARA PIHAK TENTANG HASIL MEDIASI              (I-17)
 *   4. KESEPAKATAN PERDAMAIAN [SEBAGIAN] - pasal bernomor        (I-09, I-11)
 *   5. PERNYATAAN PARA PIHAK YANG DIWAKILI KUASA (bila ada kuasa) (I-12)
 *   6. JADWAL MEDIASI - lembar lanskap                           (I-07)
 *
 * Murni: tanpa peladen, tanpa React. Pop-up, rute, dan uji memakai fungsi
 * yang SAMA, sehingga pratinjau di layar adalah isi berkas yang diunduh.
 *
 * ============================================================================
 * PASAL PERMA 1/2016 YANG DIPAKAI - DIBACA DARI NASKAH PERMA-NYA
 * ============================================================================
 *
 *   Pasal 7 ayat (2)   lima keadaan tidak beriktikad baik (huruf a-e)
 *   Pasal 9 ayat (3)   berhasil: biaya pemanggilan ditanggung bersama atau
 *                      sesuai kesepakatan
 *   Pasal 9 ayat (4)   tidak berhasil / tidak dapat dilaksanakan: dibebankan
 *                      kepada pihak yang kalah, kecuali perceraian di PA
 *   Pasal 27           kesepakatan tertulis; ayat (3) kuasa wajib membawa
 *                      persetujuan tertulis para pihak; ayat (4) akta
 *                      perdamaian; ayat (5) tanpa akta WAJIB memuat
 *                      pencabutan; ayat (6) laporan mediator
 *   Pasal 30           kesepakatan atas sebagian objek/tuntutan - dimuat
 *                      dalam pertimbangan dan amar putusan
 *   Pasal 31           perceraian yang dikumulasi: tidak rukun -> mediasi
 *                      lanjut ke tuntutan lain; ayat (2) Kesepakatan
 *                      Perdamaian Sebagian WAJIB memuat klausula
 *                      keterkaitannya dengan perkara perceraian; ayat (3)-(4)
 *                      baru dapat dilaksanakan bila cerainya BHT, tidak
 *                      berlaku bila gugatan ditolak atau rukun kembali
 *   Pasal 32 ayat (1)  tidak berhasil: (a) lewat 30 hari + perpanjangan,
 *                      (b) tidak beriktikad baik Pasal 7 ayat (2) huruf d, e
 *   Pasal 32 ayat (2)  tidak dapat dilaksanakan: (a) aset/kepentingan pihak
 *                      lain, (b) wewenang kementerian/lembaga/BUMN/BUMD,
 *                      (c) tidak beriktikad baik Pasal 7 ayat (2) huruf a-c
 *
 * ============================================================================
 * PIHAK I = PIHAK PERTAMA SIPP, SELALU
 * ============================================================================
 *
 * "satu" = pihak_ke 1 (Penggugat/Pemohon), "dua" = pihak_ke 2
 * (Tergugat/Termohon). Tidak ada pelaku/lawan di sini - pasangan yang sudah
 * dua kali tertukar di proyek ini. Sebutannya dari sebutanPihakPerkara, satu
 * sumber: cerai talak (346) bersebutan Pemohon/Termohon walau nomornya
 * /Pdt.G/.
 */

import { terbilang } from "@/lib/biaya-perkara";
import { namaCocokSatu } from "@/lib/perkara-sendiri";
import { namaTiapMediator } from "@/lib/sebutan-mediator";
import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";
import { BULAN_PANJANG, HARI_PANJANG } from "@/lib/tanggal-indonesia";

// ============================================================================
// JENIS HASIL
// ============================================================================

export type KunciHasil =
  | "berhasil-seluruhnya"
  | "berhasil-sebagian"
  | "tidak-berhasil"
  | "tidak-dapat-dilaksanakan";

export const HASIL_MEDIASI: ReadonlyArray<{
  kunci: KunciHasil;
  label: string;
  /** Bagian nama berkas: "... - Laporan Mediasi <namaBerkas>.rtf". */
  namaBerkas: string;
  keterangan: string;
}> = [
  {
    kunci: "berhasil-seluruhnya",
    label: "Berhasil seluruhnya",
    namaBerkas: "Berhasil Seluruhnya",
    keterangan:
      "Kesepakatan atas seluruh pokok sengketa. Perceraian: rukun kembali dan gugatan/permohonan dicabut (PERMA 1/2016 Pasal 27 ayat (5)); perkara lain: dicabut atau dikuatkan dalam Akta Perdamaian (ayat (4)).",
  },
  {
    kunci: "berhasil-sebagian",
    label: "Berhasil sebagian",
    namaBerkas: "Berhasil Sebagian",
    keterangan:
      "Kesepakatan atas sebagian tuntutan; sisanya dilanjutkan pemeriksaan. Perceraian: tidak rukun, tetapi sepakat atas tuntutan lain - Pasal 31; perkara lain - Pasal 30.",
  },
  {
    kunci: "tidak-berhasil",
    label: "Tidak berhasil",
    namaBerkas: "Tidak Berhasil",
    keterangan: "Pasal 32 ayat (1): lewat batas waktu, atau tidak beriktikad baik (Pasal 7 ayat (2) huruf d/e).",
  },
  {
    kunci: "tidak-dapat-dilaksanakan",
    label: "Tidak dapat dilaksanakan",
    namaBerkas: "Tidak Dapat Dilaksanakan",
    keterangan:
      "Pasal 32 ayat (2): pihak tidak hadir 2 kali berturut-turut (Pasal 7 ayat (2) huruf a-c), menyangkut pihak lain, atau wewenang kementerian/lembaga.",
  },
];

export function labelHasil(kunci: KunciHasil): string {
  return HASIL_MEDIASI.find((x) => x.kunci === kunci)?.label ?? kunci;
}

export function berhasil(kunci: KunciHasil): boolean {
  return kunci === "berhasil-seluruhnya" || kunci === "berhasil-sebagian";
}

/** Alasan Pasal 32 - ditulis ke laporan apa adanya. */
export const ALASAN_TIDAK_BERHASIL = [
  {
    kunci: "batas-waktu",
    label: "Tidak tercapai kesepakatan sampai batas waktu 30 hari berikut perpanjangannya",
    pasal: "Pasal 32 ayat (1) huruf a",
    iktikad: false,
  },
  {
    kunci: "iktikad-d",
    label: "Menghadiri mediasi, tetapi tidak mengajukan/tidak menanggapi Resume Perkara pihak lain",
    pasal: "Pasal 32 ayat (1) huruf b jo. Pasal 7 ayat (2) huruf d",
    iktikad: true,
  },
  {
    kunci: "iktikad-e",
    label: "Tidak menandatangani konsep Kesepakatan Perdamaian yang telah disepakati tanpa alasan sah",
    pasal: "Pasal 32 ayat (1) huruf b jo. Pasal 7 ayat (2) huruf e",
    iktikad: true,
  },
] as const;

export const ALASAN_TIDAK_DAPAT = [
  {
    kunci: "tidak-hadir-a",
    label: "Tidak hadir setelah dipanggil secara patut 2 (dua) kali berturut-turut tanpa alasan sah",
    pasal: "Pasal 32 ayat (2) huruf c jo. Pasal 7 ayat (2) huruf a",
    iktikad: true,
  },
  {
    kunci: "tidak-hadir-b",
    label:
      "Menghadiri pertemuan pertama, tetapi tidak pernah hadir lagi meskipun telah dipanggil secara patut 2 (dua) kali berturut-turut tanpa alasan sah",
    pasal: "Pasal 32 ayat (2) huruf c jo. Pasal 7 ayat (2) huruf b",
    iktikad: true,
  },
  {
    kunci: "tidak-hadir-c",
    label: "Ketidakhadiran berulang-ulang yang mengganggu jadwal pertemuan mediasi tanpa alasan sah",
    pasal: "Pasal 32 ayat (2) huruf c jo. Pasal 7 ayat (2) huruf c",
    iktikad: true,
  },
  {
    kunci: "pihak-lain",
    label:
      "Melibatkan aset, harta kekayaan, atau kepentingan yang nyata-nyata berkaitan dengan pihak lain yang tidak menjadi pihak dalam proses mediasi",
    pasal: "Pasal 32 ayat (2) huruf a",
    iktikad: false,
  },
  {
    kunci: "kementerian",
    label:
      "Melibatkan wewenang kementerian/lembaga/instansi atau BUMN/BUMD yang tidak menjadi pihak berperkara dan tidak ada persetujuan tertulisnya",
    pasal: "Pasal 32 ayat (2) huruf b",
    iktikad: false,
  },
] as const;

export type KunciAlasanTidakBerhasil = (typeof ALASAN_TIDAK_BERHASIL)[number]["kunci"];
export type KunciAlasanTidakDapat = (typeof ALASAN_TIDAK_DAPAT)[number]["kunci"];

// ============================================================================
// JENIS PERKARA
// ============================================================================

export type KelompokPerkara =
  | "cerai"
  | "anak"
  | "harta-bersama"
  | "waris"
  | "hibah-wakaf"
  | "ekonomi-syariah"
  | "umum";

export const LABEL_KELOMPOK: Record<KelompokPerkara, string> = {
  cerai: "Perceraian",
  anak: "Hak asuh / nafkah anak",
  "harta-bersama": "Harta bersama",
  waris: "Kewarisan",
  "hibah-wakaf": "Hibah / wakaf / wasiat",
  "ekonomi-syariah": "Ekonomi syariah",
  umum: "Perkara lain",
};

/** Cerai talak 346 dan cerai gugat 347 - id SIPP, lihat sebutan-pihak.ts. */
const JENIS_CERAI = [346, 347];

export function kelompokPerkara(bahan: { jenisPerkaraId?: number | null; jenisPerkara?: string | null }): KelompokPerkara {
  const id = Number(bahan.jenisPerkaraId) || 0;
  const nama = String(bahan.jenisPerkara ?? "").toLowerCase();
  // li'an sebagai KATA utuh: "li.?an" tanpa batas kata menangkap "Perwalian"
  // dan menggolongkannya perceraian (9 Okt 2026).
  if (JENIS_CERAI.includes(id) || /cerai|talak|fasakh|khulu|\bli.?an\b/.test(nama)) return "cerai";
  if (/harta bersama|gono/.test(nama)) return "harta-bersama";
  if (/waris|kewarisan/.test(nama)) return "waris";
  if (/hibah|wakaf|wasiat|sedekah|shadaqah|infaq/.test(nama)) return "hibah-wakaf";
  if (/ekonomi syari/.test(nama)) return "ekonomi-syariah";
  if (/hadhanah|hadlanah|asuh|pemeliharaan anak|nafkah anak|perwalian/.test(nama)) return "anak";
  return "umum";
}

export function ceraiTalak(bahan: { jenisPerkaraId?: number | null; jenisPerkara?: string | null }): boolean {
  return Number(bahan.jenisPerkaraId) === 346 || /cerai talak/i.test(String(bahan.jenisPerkara ?? ""));
}

// ============================================================================
// BUTIR KESEPAKATAN - HASIL BRAINSTORMING, PERCERAIAN PALING LENGKAP
// ============================================================================

export type Sisi = "satu" | "dua";
export type SisiAtauKeduanya = Sisi | "keduanya";

/** Isian satu butir. Ruas yang tidak dipakai butirnya dibiarkan kosong. */
export type IsianButir = {
  aktif: boolean;
  /** Yang dibebani / yang memegang / yang menyerahkan. */
  pihak?: SisiAtauKeduanya;
  /** Rupiah, bilangan bulat. 0/kosong = titik-titik untuk diisi tangan. */
  nominal?: number;
  /** Bulan (iddah, madliyah), kali angsuran. */
  jangka?: number;
  /** Nafkah anak: nominal itu untuk tiap anak, bukan seluruhnya. */
  perAnak?: boolean;
  /** Nafkah anak: kenaikan per tahun, persen. */
  kenaikanPersen?: number;
  /** Nafkah anak: sampai usia (tahun). */
  sampaiUsia?: number;
  /** Nafkah anak: di luar biaya pendidikan dan kesehatan. */
  diLuarPendidikan?: boolean;
  /** Hadhanah: pihak lain diberi akses bertemu. */
  akses?: boolean;
  /** Nama anak yang dicakup butir ini. */
  anak?: string[];
  /** Daftar objek - satu baris satu objek. */
  objek?: string;
  /** Bagian pihak I / pihak II (harta bersama), mis. "1/2". */
  bagianSatu?: string;
  bagianDua?: string;
  /** Cara: tunai | transfer | kepaniteraan | natura | jual | kompensasi ... */
  cara?: string;
  /** Tenggat bebas: "paling lambat 31 Desember 2026". */
  tenggat?: string;
  /** Bentuk lain (mut'ah berupa emas, mahar berupa ...). */
  bentuk?: string;
  /** Keterangan bebas; pada kesanggupan-lain/tidak-disepakati: satu baris satu hal. */
  teks?: string;
};

export type JenisMedan =
  | "pihak"
  | "pihak-keduanya"
  | "rupiah"
  | "angka"
  | "teks"
  | "teks-panjang"
  | "pilih"
  | "anak"
  | "centang";

export type MedanButir = {
  ruas: keyof Omit<IsianButir, "aktif">;
  label: string;
  jenis: JenisMedan;
  pilihan?: ReadonlyArray<{ nilai: string; label: string }>;
  petunjuk?: string;
};

export type DefinisiButir = {
  kunci: string;
  label: string;
  /** Untuk kalimat "mengakhiri sengketa terkait ...". */
  ringkas: string;
  untuk: readonly KelompokPerkara[];
  /** Hanya untuk berhasil seluruhnya / sebagian / keduanya. */
  hasil?: "seluruhnya" | "sebagian";
  hanyaCeraiTalak?: boolean;
  medan: readonly MedanButir[];
  petunjuk?: string;
  /** Butir yang menimbulkan kewajiban uang - ikut dirujuk "dibayar sebelum ikrar". */
  uang?: boolean;
};

const CARA_BAYAR = [
  { nilai: "", label: "(tidak disebut)" },
  { nilai: "tunai", label: "tunai" },
  { nilai: "kepaniteraan", label: "dititipkan melalui Kepaniteraan" },
  { nilai: "transfer", label: "transfer ke rekening penerima" },
  { nilai: "angsuran", label: "diangsur" },
] as const;

const MEDAN_PIHAK: MedanButir = { ruas: "pihak", label: "Dibebankan kepada", jenis: "pihak" };
const MEDAN_CARA: MedanButir = { ruas: "cara", label: "Cara bayar", jenis: "pilih", pilihan: CARA_BAYAR };
const MEDAN_TENGGAT: MedanButir = {
  ruas: "tenggat",
  label: "Tenggat",
  jenis: "teks",
  petunjuk: "mis. paling lambat 31 Desember 2026",
};

export const KATALOG_BUTIR: readonly DefinisiButir[] = [
  // --- Perceraian ----------------------------------------------------------
  {
    kunci: "rukun-kembali",
    label: "Rukun kembali (gugatan/permohonan dicabut)",
    ringkas: "rukun kembali",
    untuk: ["cerai"],
    hasil: "seluruhnya",
    medan: [
      {
        ruas: "teks",
        label: "Janji/komitmen tambahan (satu baris satu janji)",
        jenis: "teks-panjang",
        petunjuk: "mis. Tergugat tidak akan mengulangi perbuatannya; tinggal di rumah sendiri",
      },
    ],
    petunjuk: "Berhasil seluruhnya pada perceraian = rukun kembali dan perkara dicabut (Pasal 27 ayat (5)).",
  },
  {
    kunci: "nafkah-iddah",
    label: "Nafkah iddah",
    ringkas: "nafkah iddah",
    untuk: ["cerai"],
    uang: true,
    medan: [
      MEDAN_PIHAK,
      { ruas: "nominal", label: "Jumlah seluruhnya (Rp)", jenis: "rupiah" },
      { ruas: "jangka", label: "Selama (bulan)", jenis: "angka", petunjuk: "lazimnya 3" },
      MEDAN_CARA,
      MEDAN_TENGGAT,
    ],
  },
  {
    kunci: "mutah",
    label: "Mut’ah",
    ringkas: "mut’ah",
    untuk: ["cerai"],
    uang: true,
    medan: [
      MEDAN_PIHAK,
      { ruas: "nominal", label: "Uang (Rp)", jenis: "rupiah" },
      { ruas: "bentuk", label: "Atau/dan berupa barang", jenis: "teks", petunjuk: "mis. cincin emas 5 gram" },
      MEDAN_CARA,
      MEDAN_TENGGAT,
    ],
  },
  {
    kunci: "maskan-kiswah",
    label: "Maskan & kiswah (tempat tinggal dan pakaian selama iddah)",
    ringkas: "maskan dan kiswah",
    untuk: ["cerai"],
    uang: true,
    medan: [MEDAN_PIHAK, { ruas: "nominal", label: "Jumlah (Rp)", jenis: "rupiah" }, MEDAN_CARA, MEDAN_TENGGAT],
  },
  {
    kunci: "nafkah-madliyah",
    label: "Nafkah madliyah (nafkah lampau yang dilalaikan)",
    ringkas: "nafkah madliyah",
    untuk: ["cerai"],
    uang: true,
    medan: [
      MEDAN_PIHAK,
      { ruas: "nominal", label: "Jumlah seluruhnya (Rp)", jenis: "rupiah" },
      { ruas: "jangka", label: "Untuk (bulan)", jenis: "angka" },
      MEDAN_CARA,
      MEDAN_TENGGAT,
    ],
  },
  {
    kunci: "mahar",
    label: "Mahar yang masih terutang",
    ringkas: "mahar terutang",
    untuk: ["cerai"],
    uang: true,
    medan: [
      MEDAN_PIHAK,
      { ruas: "nominal", label: "Uang (Rp)", jenis: "rupiah" },
      { ruas: "bentuk", label: "Atau berupa", jenis: "teks", petunjuk: "mis. emas 10 gram" },
      MEDAN_TENGGAT,
    ],
  },
  {
    kunci: "hadhanah",
    label: "Hak asuh anak (hadhanah) + hak bertemu pihak lain",
    ringkas: "hak asuh anak",
    untuk: ["cerai", "anak"],
    medan: [
      { ruas: "pihak", label: "Pemegang hak asuh", jenis: "pihak" },
      { ruas: "anak", label: "Anak", jenis: "anak" },
      { ruas: "akses", label: "Pihak lain berhak bertemu dan mencurahkan kasih sayang", jenis: "centang" },
      {
        ruas: "teks",
        label: "Ketentuan bertemu (opsional)",
        jenis: "teks",
        petunjuk: "mis. setiap akhir pekan dan hari raya",
      },
    ],
  },
  {
    kunci: "nafkah-anak",
    label: "Nafkah anak per bulan (+ kenaikan tiap tahun)",
    ringkas: "nafkah anak",
    untuk: ["cerai", "anak"],
    uang: true,
    medan: [
      MEDAN_PIHAK,
      { ruas: "anak", label: "Anak", jenis: "anak" },
      { ruas: "nominal", label: "Per bulan (Rp)", jenis: "rupiah" },
      { ruas: "perAnak", label: "Jumlah itu untuk TIAP anak", jenis: "centang" },
      { ruas: "kenaikanPersen", label: "Kenaikan per tahun (%)", jenis: "angka", petunjuk: "lazimnya 10" },
      { ruas: "sampaiUsia", label: "Sampai anak berusia (tahun)", jenis: "angka", petunjuk: "lazimnya 21" },
      { ruas: "diLuarPendidikan", label: "Di luar biaya pendidikan dan kesehatan", jenis: "centang" },
      MEDAN_CARA,
    ],
  },
  {
    kunci: "harta-bersama",
    label: "Harta bersama (daftar objek dan pembagiannya)",
    ringkas: "harta bersama",
    untuk: ["cerai", "harta-bersama"],
    medan: [
      { ruas: "objek", label: "Objek (satu baris satu objek)", jenis: "teks-panjang", petunjuk: "mis. sebidang tanah SHM No. ... seluas ... di Desa ..." },
      { ruas: "bagianSatu", label: "Bagian Pihak I", jenis: "teks", petunjuk: "1/2" },
      { ruas: "bagianDua", label: "Bagian Pihak II", jenis: "teks", petunjuk: "1/2" },
      {
        ruas: "cara",
        label: "Cara pembagian",
        jenis: "pilih",
        pilihan: [
          { nilai: "natura", label: "dibagi secara natura" },
          { nilai: "jual", label: "dijual, hasilnya dibagi" },
          { nilai: "kompensasi", label: "diambil satu pihak, membayar kompensasi" },
        ],
      },
      { ruas: "pihak", label: "Pihak yang mengambil (bila kompensasi)", jenis: "pihak" },
      { ruas: "nominal", label: "Kompensasi (Rp)", jenis: "rupiah" },
      MEDAN_TENGGAT,
    ],
  },
  {
    kunci: "utang-piutang",
    label: "Utang-piutang",
    ringkas: "utang-piutang",
    untuk: ["cerai", "harta-bersama", "ekonomi-syariah", "umum"],
    uang: true,
    medan: [
      MEDAN_PIHAK,
      { ruas: "nominal", label: "Jumlah (Rp)", jenis: "rupiah" },
      { ruas: "bentuk", label: "Kepada (bila pihak ketiga)", jenis: "teks", petunjuk: "kosong = pihak lainnya" },
      { ruas: "jangka", label: "Diangsur (kali)", jenis: "angka", petunjuk: "kosong = sekaligus" },
      MEDAN_TENGGAT,
    ],
  },
  {
    kunci: "tenggat-pembayaran",
    label: "Kewajiban uang dibayar sebelum ikrar talak / sebelum akta cerai diambil",
    ringkas: "waktu pembayaran",
    untuk: ["cerai"],
    hasil: "sebagian",
    medan: [
      {
        ruas: "cara",
        label: "Cara penyerahan",
        jenis: "pilih",
        pilihan: [
          { nilai: "sidang", label: "tunai di depan sidang" },
          { nilai: "kepaniteraan", label: "melalui Kepaniteraan" },
        ],
      },
    ],
    petunjuk: "Merujuk sendiri pasal-pasal uang di atas yang dibebankan kepada suami.",
  },
  // --- Perkara lain --------------------------------------------------------
  {
    kunci: "waris",
    label: "Pembagian harta warisan",
    ringkas: "pembagian harta warisan",
    untuk: ["waris"],
    medan: [
      { ruas: "bentuk", label: "Pewaris (almarhum/almarhumah)", jenis: "teks" },
      { ruas: "objek", label: "Objek harta peninggalan (satu baris satu objek)", jenis: "teks-panjang" },
      {
        ruas: "teks",
        label: "Bagian tiap ahli waris (satu baris: nama - bagian)",
        jenis: "teks-panjang",
        petunjuk: "mis. Ahmad bin Umar - 2/6 bagian",
      },
      {
        ruas: "cara",
        label: "Cara pembagian",
        jenis: "pilih",
        pilihan: [
          { nilai: "natura", label: "dibagi secara natura" },
          { nilai: "jual", label: "dijual, hasilnya dibagi" },
        ],
      },
      MEDAN_TENGGAT,
    ],
  },
  {
    kunci: "hibah-wakaf",
    label: "Objek hibah / wakaf / wasiat",
    ringkas: "objek hibah/wakaf",
    untuk: ["hibah-wakaf"],
    medan: [
      { ruas: "objek", label: "Objek (satu baris satu objek)", jenis: "teks-panjang" },
      { ruas: "teks", label: "Yang disepakati atas objek itu", jenis: "teks-panjang", petunjuk: "mis. hibah tetap sah dan Pihak II menyerahkan sertifikat" },
      { ruas: "pihak", label: "Pihak yang menyerahkan / balik nama", jenis: "pihak" },
      MEDAN_TENGGAT,
    ],
  },
  {
    kunci: "angsuran-syariah",
    label: "Pembayaran kewajiban akad (pokok + margin/ujrah) secara angsuran",
    ringkas: "pembayaran kewajiban",
    untuk: ["ekonomi-syariah"],
    uang: true,
    medan: [
      MEDAN_PIHAK,
      { ruas: "nominal", label: "Jumlah kewajiban (Rp)", jenis: "rupiah" },
      { ruas: "jangka", label: "Diangsur (kali)", jenis: "angka" },
      { ruas: "tenggat", label: "Jatuh tempo tiap angsuran", jenis: "teks", petunjuk: "mis. paling lambat tanggal 10 setiap bulan" },
      { ruas: "teks", label: "Akibat lalai / jaminan", jenis: "teks-panjang", petunjuk: "mis. objek jaminan dapat dijual melalui lelang" },
    ],
  },
  {
    kunci: "pembayaran-uang",
    label: "Pembayaran sejumlah uang",
    ringkas: "pembayaran sejumlah uang",
    untuk: ["harta-bersama", "waris", "hibah-wakaf", "ekonomi-syariah", "umum"],
    uang: true,
    medan: [
      MEDAN_PIHAK,
      { ruas: "nominal", label: "Jumlah (Rp)", jenis: "rupiah" },
      { ruas: "jangka", label: "Diangsur (kali)", jenis: "angka", petunjuk: "kosong = sekaligus" },
      MEDAN_CARA,
      MEDAN_TENGGAT,
    ],
  },
  {
    kunci: "penyerahan-objek",
    label: "Penyerahan objek / pengosongan",
    ringkas: "penyerahan objek",
    untuk: ["harta-bersama", "waris", "hibah-wakaf", "ekonomi-syariah", "umum"],
    medan: [
      { ruas: "pihak", label: "Pihak yang menyerahkan", jenis: "pihak" },
      { ruas: "objek", label: "Objek (satu baris satu objek)", jenis: "teks-panjang" },
      { ruas: "akses", label: "Dalam keadaan kosong", jenis: "centang" },
      MEDAN_TENGGAT,
    ],
  },
  // --- Semua perkara -------------------------------------------------------
  {
    kunci: "kesanggupan-lain",
    label: "Kesanggupan lain (teks bebas)",
    ringkas: "kesanggupan lain",
    untuk: ["cerai", "anak", "harta-bersama", "waris", "hibah-wakaf", "ekonomi-syariah", "umum"],
    medan: [{ ruas: "teks", label: "Satu baris satu pasal", jenis: "teks-panjang" }],
  },
  {
    kunci: "tidak-disepakati",
    label: "Butir yang TIDAK disepakati (dilanjutkan pemeriksaan)",
    ringkas: "",
    untuk: ["cerai", "anak", "harta-bersama", "waris", "hibah-wakaf", "ekonomi-syariah", "umum"],
    hasil: "sebagian",
    medan: [
      {
        ruas: "teks",
        label: "Satu baris satu tuntutan",
        jenis: "teks-panjang",
        petunjuk: "mis. tuntutan perceraian; tuntutan hak asuh anak",
      },
    ],
  },
  {
    kunci: "biaya-perkara",
    label: "Biaya perkara ditanggung oleh",
    ringkas: "",
    untuk: ["cerai", "anak", "harta-bersama", "waris", "hibah-wakaf", "ekonomi-syariah", "umum"],
    medan: [{ ruas: "pihak", label: "Ditanggung oleh", jenis: "pihak-keduanya" }],
  },
];

export function definisiButir(kunci: string): DefinisiButir | undefined {
  return KATALOG_BUTIR.find((x) => x.kunci === kunci);
}

/** Butir yang ditawarkan untuk satu kelompok perkara dan satu hasil. */
export function butirTersedia(kelompok: KelompokPerkara, hasil: KunciHasil, semuaJenis = false): DefinisiButir[] {
  if (!berhasil(hasil)) return [];
  return KATALOG_BUTIR.filter((b) => {
    if (b.hasil === "seluruhnya" && hasil !== "berhasil-seluruhnya") return false;
    if (b.kunci === "tidak-disepakati" && hasil !== "berhasil-sebagian") return false;
    return semuaJenis || b.untuk.includes(kelompok);
  });
}

// ============================================================================
// BAHAN DARI SIPP DAN DRAF
// ============================================================================

export type PihakSipp = {
  pihakKe: number;
  nama: string;
  kelamin?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  umur?: number | null;
  pekerjaan?: string;
  pendidikan?: string;
  agama?: string;
  alamat?: string;
  wilayah?: string[];
};

export type PertemuanSipp = {
  tanggal: string;
  jam?: string;
  sampaiJam?: string;
  tempat?: string;
  ditunda?: boolean;
  dihadiri?: string;
};

/** Yang dikirim rute: data SIPP perkara ini, hanya dibaca. */
export type BahanHasilMediasi = {
  nomorPerkara: string;
  perkaraId: string;
  mediasiId: string;
  jenisPerkara: string;
  alurPerkaraId?: number | null;
  jenisPerkaraId?: number | null;
  mediator: string;
  penetapanMediator: string;
  pertemuan: PertemuanSipp[];
  pihak: PihakSipp[];
  /** Nama ringkas dari jadwal bila identitas tidak terbaca. */
  namaPenggugat?: string[];
  namaTergugat?: string[];
  /**
   * Kuasa hukum dari SIPP (perkara_pengacara), urut menurut sisi dan urutan
   * SIPP. Tidak ada (bot lama / tidak terbaca) = isian kuasa dibiarkan kosong.
   */
  kuasa?: Array<{ nama: string; pihakKe: number }>;
  /**
   * Sandi hasil mediasi yang SUDAH tercatat di SIPP (perkara_mediasi.
   * hasil_mediasi): Y1 berhasil kesepakatan damai, Y2 berhasil dengan
   * pencabutan, S berhasil sebagian, T tidak berhasil, D tidak dapat
   * dilaksanakan. Kosong = belum dicatat; pop-up memakai bawaannya.
   */
  hasilSipp?: string;
  /**
   * Nama mediator yang cocok dengan akun yang membuka pop-up, bila mediator
   * perkara itu lebih dari satu ("H,H" - 3 perkara di sipp_donggala). Yang
   * menandatangani laporan adalah mediator yang menyusunnya.
   */
  mediatorAkun?: string;
  anak: string[];
  majelis: Array<{ nama: string; jabatan: string }>;
  namaPengadilan: string;
};

export type OrangDraf = { nama: string; keterangan: string };

export type PertemuanDraf = { tanggal: string; jam: string; tempat: string; keterangan: string };

export type DrafHasilMediasi = {
  versi: 1;
  hasil: KunciHasil;
  alasanTidakBerhasil: KunciAlasanTidakBerhasil;
  alasanTidakDapat: KunciAlasanTidakDapat;
  /** Pihak yang dinyatakan tidak beriktikad baik (bila alasannya iktikad). */
  pihakTidakBeriktikad: SisiAtauKeduanya;
  /** Penutup kesepakatan seluruhnya: cabut (Pasal 27 ayat (5)) atau akta (ayat (4)). */
  penutup: "cabut" | "akta";
  butir: Record<string, IsianButir>;
  dokumen: {
    nomorPerkara: string;
    jenisPerkara: string;
    namaPengadilan: string;
    kota: string;
    tempatMediasi: string;
    mediator: string;
    tanggalPenunjukan: string;
    tanggalKesepakatan: string;
    tanggalLaporan: string;
    kehadiran: string;
    sebutanSatu: string;
    sebutanDua: string;
    pihakSatu: OrangDraf[];
    pihakDua: OrangDraf[];
    /**
     * Turut Tergugat/Termohon (pihak_ke 4) - 9 Okt 2026. Sebelumnya dibuang,
     * sehingga laporan perkara waris/harta bersama yang berturut tergugat
     * tidak menyebut mereka sama sekali (273/Pdt.G/2026: tujuh orang).
     */
    pihakTurut: OrangDraf[];
    kuasaSatu: string;
    kuasaDua: string;
    anak: string[];
    pertemuan: PertemuanDraf[];
    biayaJasa: number;
    biayaPanggilanSatu: number;
    biayaPanggilanDua: number;
    biayaLain: number;
    bebanBiayaMediasi: SisiAtauKeduanya;
    sertakanPernyataan: boolean;
    sertakanJadwal: boolean;
  };
};

// ============================================================================
// PEMBANTU TEKS
// ============================================================================

const bersih = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim();

/** "1000000" -> "1.000.000" - tanpa Intl, sama di peladen dan peramban. */
export function angkaRibuan(nilai: number): string {
  const n = Math.round(Math.abs(Number(nilai) || 0));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "Rp1.000.000,00 (satu juta rupiah)"; kosong -> titik-titik untuk diisi tangan. */
export function rupiahTerbilang(nilai: number | undefined | null): string {
  const n = Math.round(Number(nilai) || 0);
  if (n <= 0) return "Rp.................. (.................................... rupiah)";
  return `Rp${angkaRibuan(n)},00 (${terbilang(n)} rupiah)`;
}

/** "3 (tiga)". */
export function angkaTerbilang(nilai: number): string {
  const n = Math.round(Number(nilai) || 0);
  return `${n} (${terbilang(n)})`;
}

function pecahIso(nilai: string): { t: number; b: number; h: number } | null {
  const c = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(nilai ?? "").trim());
  if (!c) return null;
  const t = Number(c[1]);
  const b = Number(c[2]);
  const h = Number(c[3]);
  if (!t || b < 1 || b > 12 || h < 1 || h > 31) return null;
  return { t, b, h };
}

/** "01 Juli 2025" - bentuk naskah satker (contoh 371). Tidak sah -> titik-titik. */
export function tanggalNaskah(iso: string): string {
  const p = pecahIso(iso);
  if (!p) return "....................";
  return `${String(p.h).padStart(2, "0")} ${BULAN_PANJANG[p.b - 1]} ${p.t}`;
}

export function hariNaskah(iso: string): string {
  const p = pecahIso(iso);
  if (!p) return "..........";
  return HARI_PANJANG[new Date(Date.UTC(p.t, p.b - 1, p.h)).getUTCDay()];
}

/** "A", "A dan B", "A, B, dan C". */
export function gabungDan(daftar: string[]): string {
  const x = daftar.map(bersih).filter(Boolean);
  if (x.length <= 1) return x[0] ?? "";
  if (x.length === 2) return `${x[0]} dan ${x[1]}`;
  return `${x.slice(0, -1).join(", ")}, dan ${x[x.length - 1]}`;
}

function baris(teks: string | undefined): string[] {
  return String(teks ?? "")
    .split(/\r?\n/)
    .map(bersih)
    .filter(Boolean);
}

/** "Pengadilan Agama Donggala Kelas II" -> "Donggala". */
export function kotaDariPengadilan(nama: string): string {
  const x = bersih(nama)
    .replace(/^pengadilan\s+(agama|negeri|tinggi agama|tinggi)\s+/i, "")
    .replace(/^(PA|PN|mahkamah syar.?iyah)\s+/i, "")
    .replace(/\s+kelas\s+.*$/i, "")
    .trim();
  return x;
}

/** Keterangan identitas tanpa nama dan tanpa "sebagai ..." - contoh 371. */
export function keteranganIdentitas(p: PihakSipp): string {
  const potong: string[] = [];
  // Tanda kosong SIPP ("-", ".") bukan isi: "pendidikan -" tidak boleh tercetak.
  const isi = (x: unknown) => {
    const t = bersih(x);
    return /^[-.–—]*$/.test(t) ? "" : t;
  };
  if (p.umur !== null && p.umur !== undefined && Number.isFinite(p.umur)) potong.push(`umur ${p.umur} tahun`);
  if (isi(p.agama)) potong.push(`agama ${isi(p.agama)}`);
  if (isi(p.pendidikan)) potong.push(`pendidikan ${isi(p.pendidikan)}`);
  if (isi(p.pekerjaan)) potong.push(`pekerjaan ${isi(p.pekerjaan)}`);
  const alamat = [isi(p.alamat), ...(p.wilayah ?? []).map(isi)].filter(Boolean);
  // Wilayah yang sudah tertulis di alamat tidak diulang.
  const unik: string[] = [];
  for (const a of alamat) {
    if (!unik.some((u) => u.toLowerCase().includes(a.toLowerCase()))) unik.push(a);
  }
  if (unik.length) potong.push(`bertempat tinggal di ${unik.join(", ")}`);
  return potong.join(", ");
}

// ============================================================================
// DRAF AWAL DARI BAHAN SIPP
// ============================================================================

function hariIniIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** Sisi suami: dari jenis kelamin SIPP, lalu dari jenis perkara. */
export function sisiSuami(bahan: Pick<BahanHasilMediasi, "pihak" | "jenisPerkaraId" | "jenisPerkara">): Sisi {
  const laki = (bahan.pihak ?? []).find((p) => /laki/i.test(String(p.kelamin ?? "")) && (p.pihakKe === 1 || p.pihakKe === 2));
  if (laki) return laki.pihakKe === 1 ? "satu" : "dua";
  return ceraiTalak(bahan) ? "satu" : "dua";
}

export function lawan(sisi: Sisi): Sisi {
  return sisi === "satu" ? "dua" : "satu";
}

/** Nama kuasa satu sisi dari SIPP: "A", "A dan B", "A, B, dan C". */
export function namaKuasa(bahan: Pick<BahanHasilMediasi, "kuasa">, pihakKe: 1 | 2): string {
  const nama = (Array.isArray(bahan.kuasa) ? bahan.kuasa : [])
    .filter((k) => Number(k?.pihakKe) === pihakKe)
    .map((k) => bersih(k?.nama))
    .filter(Boolean);
  return gabungDan([...new Set(nama)]);
}

/** Hasil dari sandi SIPP; null = belum tercatat (bawaan pop-up berlaku). */
export function hasilDariSipp(sandi: unknown): KunciHasil | null {
  switch (bersih(sandi).toUpperCase()) {
    case "Y1":
    case "Y2":
      return "berhasil-seluruhnya";
    case "S":
      return "berhasil-sebagian";
    case "T":
      return "tidak-berhasil";
    case "D":
      return "tidak-dapat-dilaksanakan";
    default:
      return null;
  }
}

export function drafAwal(bahan: BahanHasilMediasi, sekarang = hariIniIso()): DrafHasilMediasi {
  const sebutan = sebutanPihakPerkara({
    alurPerkaraId: bahan.alurPerkaraId,
    jenisPerkaraId: bahan.jenisPerkaraId,
    jenisPerkaraNama: bahan.jenisPerkara,
    nomorPerkara: bahan.nomorPerkara,
  });
  const orang = (ke: number, cadangan: string[] = []): OrangDraf[] => {
    const dariSipp = (bahan.pihak ?? []).filter((p) => p.pihakKe === ke);
    if (dariSipp.length) return dariSipp.map((p) => ({ nama: bersih(p.nama), keterangan: keteranganIdentitas(p) }));
    return cadangan.map((nama) => ({ nama: bersih(nama), keterangan: "" })).filter((x) => x.nama);
  };
  const pertemuan = [...(bahan.pertemuan ?? [])]
    .filter((x) => pecahIso(x.tanggal))
    .sort((a, b) => `${a.tanggal} ${a.jam ?? ""}`.localeCompare(`${b.tanggal} ${b.jam ?? ""}`))
    .map((x) => ({
      tanggal: x.tanggal.slice(0, 10),
      jam: [bersih(x.jam), bersih(x.sampaiJam)].filter(Boolean).join(" - "),
      tempat: bersih(x.tempat),
      keterangan: x.ditunda ? "ditunda" : "",
    }));
  const kota = kotaDariPengadilan(bahan.namaPengadilan) || "....................";
  const namaPengadilan = bersih(bahan.namaPengadilan).replace(/\s+kelas\s+.*$/i, "") || "Pengadilan Agama ....................";
  const kelompok = kelompokPerkara(bahan);
  const suami = sisiSuami(bahan);

  const butir: Record<string, IsianButir> = {};
  for (const b of KATALOG_BUTIR) {
    const isian: IsianButir = { aktif: false };
    if (b.medan.some((m) => m.ruas === "pihak")) {
      isian.pihak = b.kunci === "hadhanah" ? lawan(suami) : kelompok === "cerai" || kelompok === "anak" ? suami : "dua";
    }
    if (b.kunci === "nafkah-iddah") isian.jangka = 3;
    if (b.kunci === "nafkah-anak") {
      isian.kenaikanPersen = 10;
      isian.sampaiUsia = 21;
      isian.diLuarPendidikan = true;
    }
    if (b.kunci === "hadhanah" || b.kunci === "penyerahan-objek") isian.akses = true;
    if (b.kunci === "hadhanah" || b.kunci === "nafkah-anak") isian.anak = [...(bahan.anak ?? [])];
    if (b.kunci === "harta-bersama") {
      isian.bagianSatu = "1/2";
      isian.bagianDua = "1/2";
      isian.cara = "natura";
    }
    if (b.kunci === "tenggat-pembayaran") isian.cara = "sidang";
    if (b.kunci === "biaya-perkara") isian.pihak = "satu";
    butir[b.kunci] = isian;
  }

  // Hasil yang sudah dicatat di SIPP dipilih lebih dulu (9 Okt 2026); bila
  // belum, bawaannya tetap "berhasil sebagian". Pilihan bawaan diperlakukan
  // SAMA dengan pilihan tangan di pop-up: sebagian menyalakan butir "yang
  // tidak disepakati", seluruhnya pada perceraian menyalakan rukun kembali.
  const hasilAwal: KunciHasil = hasilDariSipp(bahan.hasilSipp) ?? "berhasil-sebagian";
  if (hasilAwal === "berhasil-sebagian") butir["tidak-disepakati"] = { ...butir["tidak-disepakati"], aktif: true };
  if (hasilAwal === "berhasil-seluruhnya" && kelompok === "cerai") butir["rukun-kembali"] = { ...butir["rukun-kembali"], aktif: true };
  const sandiSipp = bersih(bahan.hasilSipp).toUpperCase();
  const penutupAwal: DrafHasilMediasi["penutup"] =
    kelompok === "cerai" || sandiSipp === "Y2" ? "cabut" : "akta";

  return {
    versi: 1,
    hasil: hasilAwal,
    alasanTidakBerhasil: "batas-waktu",
    alasanTidakDapat: "tidak-hadir-a",
    pihakTidakBeriktikad: "dua",
    penutup: penutupAwal,
    butir,
    dokumen: {
      nomorPerkara: bersih(bahan.nomorPerkara),
      jenisPerkara: bersih(bahan.jenisPerkara),
      namaPengadilan,
      kota,
      tempatMediasi: `ruang mediasi ${namaPengadilan}`,
      mediator: bersih(bahan.mediatorAkun) || namaTiapMediator(bahan.mediator).join("; ") || bersih(bahan.mediator),
      tanggalPenunjukan: (bahan.penetapanMediator || "").slice(0, 10),
      tanggalKesepakatan: pertemuan.length ? pertemuan[pertemuan.length - 1].tanggal : sekarang,
      tanggalLaporan: sekarang,
      kehadiran: "kedua belah pihak",
      sebutanSatu: sebutan.satu,
      sebutanDua: sebutan.dua,
      pihakSatu: orang(1, bahan.namaPenggugat),
      pihakDua: orang(2, bahan.namaTergugat),
      pihakTurut: orang(4),
      // Kuasa dari SIPP - sebelumnya selalu kosong, sehingga persetujuan
      // tertulis pihak berkuasa (Pasal 27 ayat (3)) tidak pernah tersusun
      // kecuali mediator mengetik sendiri nama kuasanya.
      kuasaSatu: namaKuasa(bahan, 1),
      kuasaDua: namaKuasa(bahan, 2),
      anak: [...(bahan.anak ?? [])],
      pertemuan,
      biayaJasa: 0,
      biayaPanggilanSatu: 0,
      biayaPanggilanDua: 0,
      biayaLain: 0,
      bebanBiayaMediasi: "satu",
      sertakanPernyataan: true,
      sertakanJadwal: true,
    },
  };
}

/**
 * Draf tersimpan dipadukan ke draf awal - ruas yang hilang (versi lama, butir
 * baru di katalog) memakai bawaan, ruas asing dibuang.
 */
export function paduDraf(awal: DrafHasilMediasi, tersimpan: unknown): DrafHasilMediasi {
  if (!tersimpan || typeof tersimpan !== "object") return awal;
  const t = tersimpan as Partial<DrafHasilMediasi>;
  const kunciHasil = HASIL_MEDIASI.map((x) => x.kunci) as string[];
  const butir: Record<string, IsianButir> = { ...awal.butir };
  for (const b of KATALOG_BUTIR) {
    const isi = t.butir?.[b.kunci];
    if (isi && typeof isi === "object") butir[b.kunci] = { ...awal.butir[b.kunci], ...isi, aktif: isi.aktif === true };
  }
  return {
    ...awal,
    hasil: kunciHasil.includes(String(t.hasil)) ? (t.hasil as KunciHasil) : awal.hasil,
    alasanTidakBerhasil: ALASAN_TIDAK_BERHASIL.some((x) => x.kunci === t.alasanTidakBerhasil)
      ? (t.alasanTidakBerhasil as KunciAlasanTidakBerhasil)
      : awal.alasanTidakBerhasil,
    alasanTidakDapat: ALASAN_TIDAK_DAPAT.some((x) => x.kunci === t.alasanTidakDapat)
      ? (t.alasanTidakDapat as KunciAlasanTidakDapat)
      : awal.alasanTidakDapat,
    pihakTidakBeriktikad: ["satu", "dua", "keduanya"].includes(String(t.pihakTidakBeriktikad))
      ? (t.pihakTidakBeriktikad as SisiAtauKeduanya)
      : awal.pihakTidakBeriktikad,
    penutup: t.penutup === "akta" || t.penutup === "cabut" ? t.penutup : awal.penutup,
    butir,
    dokumen: { ...awal.dokumen, ...(t.dokumen && typeof t.dokumen === "object" ? t.dokumen : {}) },
  };
}

// ============================================================================
// PASAL-PASAL KESEPAKATAN
// ============================================================================

export type Pasal = {
  /** Paragraf pertama kalimat pasalnya; sisanya butir daftar ("1. ...") atau lanjutan. */
  isi: string[];
  /** Kunci butir asal - untuk pratinjau dan uji. */
  asal: string;
};

type Konteks = {
  draf: DrafHasilMediasi;
  kelompok: KelompokPerkara;
  talak: boolean;
};

function rujuk(k: Konteks, sisi: SisiAtauKeduanya | undefined): string {
  const d = k.draf.dokumen;
  if (sisi === "keduanya") return "Para Pihak";
  if (sisi === "satu") return `Pihak I (${d.sebutanSatu})`;
  return `Pihak II (${d.sebutanDua})`;
}

function rujukLawan(k: Konteks, sisi: SisiAtauKeduanya | undefined): string {
  if (sisi === "keduanya") return "Para Pihak";
  return rujuk(k, sisi === "satu" ? "dua" : "satu");
}

function akhiranCara(isi: IsianButir): string {
  const potong: string[] = [];
  switch (isi.cara) {
    case "tunai":
      potong.push("secara tunai");
      break;
    case "kepaniteraan":
      potong.push("melalui Kepaniteraan pengadilan");
      break;
    case "transfer":
      potong.push("melalui transfer ke rekening penerima");
      break;
    case "angsuran":
      potong.push(isi.jangka ? `dengan cara diangsur sebanyak ${angkaTerbilang(isi.jangka)} kali` : "dengan cara diangsur");
      break;
    default:
      break;
  }
  if (bersih(isi.tenggat)) potong.push(bersih(isi.tenggat));
  return potong.length ? `, ${potong.join(", ")}` : "";
}

function daftarAnak(isi: IsianButir): { kata: string; nama: string } {
  const anak = (isi.anak ?? []).map(bersih).filter(Boolean);
  if (anak.length === 0) return { kata: "anak", nama: ".................................." };
  return { kata: anak.length > 1 ? "anak-anak" : "anak", nama: gabungDan(anak) };
}

function listObjek(teks: string | undefined): string[] {
  const x = baris(teks);
  if (x.length === 0) return ["1. .................................................."];
  return x.map((o, i) => `${i + 1}. ${o.replace(/[;.]\s*$/, "")};`);
}

/** Kalimat satu butir aktif - kosong bila butirnya menghasilkan beberapa pasal sendiri. */
function pasalButir(kunci: string, isi: IsianButir, k: Konteks): Pasal[] {
  const B = rujuk(k, isi.pihak);
  const L = rujukLawan(k, isi.pihak);
  const rp = rupiahTerbilang(isi.nominal);
  const satu = (teks: string, ...lanjut: string[]): Pasal[] => [{ isi: [teks, ...lanjut], asal: kunci }];

  switch (kunci) {
    case "rukun-kembali": {
      const janji = baris(isi.teks);
      return satu(
        "Para Pihak sepakat untuk hidup rukun kembali sebagai suami istri dan membina rumah tangga yang sakinah, mawaddah, dan rahmah" +
          (janji.length ? `, dengan ketentuan: ${janji.map((j) => j.replace(/[;.]\s*$/, "")).join("; ")}.` : ".")
      );
    }
    case "nafkah-iddah":
      return satu(
        `${B} sepakat untuk membayar nafkah iddah kepada ${L}${isi.jangka ? ` selama ${angkaTerbilang(isi.jangka)} bulan` : ""} sejumlah ${rp}${akhiranCara(isi)}.`
      );
    case "mutah": {
      const bentuk = bersih(isi.bentuk);
      const wujud =
        (Number(isi.nominal) || 0) > 0 && bentuk
          ? `uang sejumlah ${rp} dan ${bentuk}`
          : bentuk && !(Number(isi.nominal) > 0)
            ? bentuk
            : `uang sejumlah ${rp}`;
      return satu(`${B} sepakat untuk memberikan mut’ah kepada ${L} berupa ${wujud}${akhiranCara(isi)}.`);
    }
    case "maskan-kiswah":
      return satu(
        `${B} sepakat untuk memberikan maskan (tempat tinggal) dan kiswah (pakaian) selama masa iddah kepada ${L} sejumlah ${rp}${akhiranCara(isi)}.`
      );
    case "nafkah-madliyah":
      return satu(
        `${B} sepakat untuk membayar nafkah lampau (madliyah) yang dilalaikan kepada ${L}${isi.jangka ? ` untuk ${angkaTerbilang(isi.jangka)} bulan` : ""} sejumlah ${rp}${akhiranCara(isi)}.`
      );
    case "mahar": {
      const bentuk = bersih(isi.bentuk);
      const wujud = bentuk && !(Number(isi.nominal) > 0) ? bentuk : `uang sejumlah ${rp}`;
      return satu(`${B} sepakat untuk melunasi mahar yang masih terutang kepada ${L} berupa ${wujud}${akhiranCara(isi)}.`);
    }
    case "hadhanah": {
      const a = daftarAnak(isi);
      let teks = `Para Pihak sepakat bahwa ${a.kata} bernama ${a.nama} berada di bawah pemeliharaan (hadhanah) ${B}`;
      if (isi.akses) {
        teks += `, dengan kewajiban ${B} memberi akses seluas-luasnya kepada ${L} untuk bertemu, mencurahkan kasih sayang, dan turut mengasuh ${a.kata} tersebut`;
        if (bersih(isi.teks)) teks += ` (${bersih(isi.teks)})`;
      }
      return satu(`${teks}.`);
    }
    case "nafkah-anak": {
      const a = daftarAnak(isi);
      let teks = `${B} sepakat untuk memberikan nafkah ${a.kata} bernama ${a.nama} sejumlah ${rp} setiap bulan${
        isi.perAnak && (isi.anak ?? []).length > 1 ? " untuk tiap anak" : ""
      }`;
      if (isi.diLuarPendidikan) teks += ", di luar biaya pendidikan dan kesehatan";
      if (Number(isi.kenaikanPersen) > 0) {
        teks += `, dengan kenaikan ${angkaTerbilang(Number(isi.kenaikanPersen))} persen setiap tahun`;
      }
      teks += `, sampai ${a.kata} tersebut berusia ${angkaTerbilang(Number(isi.sampaiUsia) || 21)} tahun atau telah dewasa dan mandiri`;
      teks += `, yang diserahkan melalui ${L}${akhiranCara({ ...isi, tenggat: "" })}.`;
      return satu(teks);
    }
    case "harta-bersama": {
      const objek = listObjek(isi.objek);
      const b1 = bersih(isi.bagianSatu) || "....";
      const b2 = bersih(isi.bagianDua) || "....";
      let akhir: string;
      if (isi.cara === "kompensasi") {
        akhir = `menjadi milik ${B}, dan ${B} membayar kompensasi bagian ${L} sejumlah ${rp}`;
      } else if (isi.cara === "jual") {
        akhir = `dijual, dan hasil penjualannya dibagi dengan ketentuan Pihak I memperoleh ${b1} bagian dan Pihak II memperoleh ${b2} bagian`;
      } else {
        akhir = `dibagi secara natura dengan ketentuan Pihak I memperoleh ${b1} bagian dan Pihak II memperoleh ${b2} bagian`;
      }
      const tenggat = bersih(isi.tenggat) ? `, ${bersih(isi.tenggat)}` : "";
      return satu("Para Pihak sepakat bahwa harta bersama berupa:", ...objek, `${akhir}${tenggat}.`);
    }
    case "utang-piutang": {
      const kepada = bersih(isi.bentuk) || L;
      const angsur = isi.jangka ? `, dengan cara diangsur sebanyak ${angkaTerbilang(isi.jangka)} kali` : "";
      const tenggat = bersih(isi.tenggat) ? `, ${bersih(isi.tenggat)}` : "";
      return satu(`${B} sepakat untuk membayar utang kepada ${kepada} sejumlah ${rp}${angsur}${tenggat}.`);
    }
    case "waris": {
      const pewaris = bersih(isi.bentuk) || "..............................";
      const bagian = baris(isi.teks);
      const cara = isi.cara === "jual" ? "dijual, dan hasil penjualannya dibagi" : "dibagi secara natura";
      const tenggat = bersih(isi.tenggat) ? `, ${bersih(isi.tenggat)}` : "";
      return satu(
        `Para Pihak sepakat bahwa harta peninggalan almarhum/almarhumah ${pewaris} berupa:`,
        ...listObjek(isi.objek),
        `${cara} kepada para ahli waris dengan bagian sebagai berikut${tenggat}:`,
        ...(bagian.length ? bagian : [".................................................."]).map(
          (x, i) => `${i + 1}. ${x.replace(/[;.]\s*$/, "")};`
        )
      );
    }
    case "hibah-wakaf": {
      const ket = baris(isi.teks).join("; ") || "..................................................";
      const tenggat = bersih(isi.tenggat) ? `, ${bersih(isi.tenggat)}` : "";
      return satu(
        "Para Pihak sepakat mengenai objek berupa:",
        ...listObjek(isi.objek),
        `dengan ketentuan: ${ket.replace(/[;.]\s*$/, "")}, dan ${B} menyerahkan dokumen serta melaksanakan balik nama yang diperlukan${tenggat}.`
      );
    }
    case "angsuran-syariah": {
      const kali = Number(isi.jangka) || 0;
      const per = kali > 0 && Number(isi.nominal) > 0 ? Math.ceil(Number(isi.nominal) / kali) : 0;
      const hasil: Pasal[] = [
        {
          isi: [
            `${B} sepakat untuk membayar seluruh kewajibannya kepada ${L} sejumlah ${rp}${
              kali > 0 ? `, dengan cara diangsur sebanyak ${angkaTerbilang(kali)} kali${per ? ` masing-masing sejumlah ${rupiahTerbilang(per)}` : ""}` : ""
            }${bersih(isi.tenggat) ? `, ${bersih(isi.tenggat)}` : ""}.`,
          ],
          asal: kunci,
        },
      ];
      const akibat = baris(isi.teks);
      if (akibat.length) {
        hasil.push({
          isi: [`Apabila ${B} lalai memenuhi kewajiban sebagaimana tersebut di atas, ${akibat.join("; ").replace(/[;.]\s*$/, "")}.`],
          asal: kunci,
        });
      }
      return hasil;
    }
    case "pembayaran-uang": {
      const angsur = isi.jangka ? `, dengan cara diangsur sebanyak ${angkaTerbilang(isi.jangka)} kali` : "";
      return satu(`${B} sepakat untuk membayar kepada ${L} sejumlah ${rp}${angsur}${akhiranCara({ ...isi, cara: isi.cara === "angsuran" ? "" : isi.cara })}.`);
    }
    case "penyerahan-objek": {
      const tenggat = bersih(isi.tenggat) ? `, ${bersih(isi.tenggat)}` : "";
      return satu(
        `${B} sepakat untuk menyerahkan kepada ${L} objek berupa:`,
        ...listObjek(isi.objek),
        `${isi.akses ? "dalam keadaan kosong" : "sebagaimana keadaannya"}${tenggat}.`
      );
    }
    case "kesanggupan-lain":
      return baris(isi.teks).map((x) => ({ isi: [/[.;]$/.test(x) ? x : `${x}.`], asal: kunci }));
    default:
      return [];
  }
}

/** Seluruh pasal kesepakatan, bernomor menurut urutannya. */
export function susunPasal(draf: DrafHasilMediasi, bahan?: Pick<BahanHasilMediasi, "jenisPerkaraId" | "jenisPerkara">): Pasal[] {
  if (!berhasil(draf.hasil)) return [];
  const sumber = bahan ?? { jenisPerkara: draf.dokumen.jenisPerkara, jenisPerkaraId: null };
  const k: Konteks = { draf, kelompok: kelompokPerkara(sumber), talak: ceraiTalak(sumber) };
  const sebagian = draf.hasil === "berhasil-sebagian";
  const d = draf.dokumen;
  const aktif = (kunci: string) => {
    const def = definisiButir(kunci);
    const isi = draf.butir[kunci];
    if (!def || !isi?.aktif) return false;
    if (def.hasil === "seluruhnya" && sebagian) return false;
    if (def.hasil === "sebagian" && !sebagian && kunci !== "tenggat-pembayaran") return false;
    return true;
  };

  const inti: Pasal[] = [];
  for (const def of KATALOG_BUTIR) {
    if (["tenggat-pembayaran", "tidak-disepakati", "biaya-perkara"].includes(def.kunci)) continue;
    if (!aktif(def.kunci)) continue;
    inti.push(...pasalButir(def.kunci, draf.butir[def.kunci], k));
  }

  const hasil: Pasal[] = [];
  // Pasal 1 contoh 371: "mengakhiri konflik terkait ... dengan musyawarah mufakat".
  if (sebagian) {
    const pokok = KATALOG_BUTIR.filter((b) => b.ringkas && aktif(b.kunci) && b.kunci !== "tenggat-pembayaran").map((b) => b.ringkas);
    hasil.push({
      isi: [`Para Pihak sepakat untuk mengakhiri sengketa terkait ${gabungDan(pokok) || ".................."} dengan musyawarah mufakat.`],
      asal: "pengantar",
    });
  }
  const awalInti = hasil.length;
  hasil.push(...inti);

  // Kewajiban uang dibayar sebelum ikrar talak / sebelum akta cerai diambil.
  if (k.kelompok === "cerai" && aktif("tenggat-pembayaran")) {
    const suami: Sisi = d.sebutanSatu === "Pemohon" || k.talak ? "satu" : "dua";
    const nomor: number[] = [];
    inti.forEach((p, i) => {
      const def = definisiButir(p.asal);
      const isi = draf.butir[p.asal];
      if (def?.uang && isi?.pihak === suami) nomor.push(awalInti + i + 1);
    });
    const daftar = nomor.length ? `Pasal ${gabungDan(nomor.map(String))}` : "pasal-pasal tersebut di atas";
    const cara = draf.butir["tenggat-pembayaran"]?.cara === "kepaniteraan" ? "melalui Kepaniteraan" : "secara tunai di depan sidang";
    const S = rujuk(k, suami);
    hasil.push({
      isi: [
        k.talak
          ? `Kewajiban ${S} sebagaimana tersebut dalam ${daftar} dibayar ${cara} sesaat sebelum ${S} mengucapkan ikrar talak di depan sidang ${d.namaPengadilan}.`
          : `Kewajiban ${S} sebagaimana tersebut dalam ${daftar} dibayar ${cara} sebelum ${S} mengambil akta cerai pada ${d.namaPengadilan}.`,
      ],
      asal: "tenggat-pembayaran",
    });
  }

  // PERMA 1/2016 Pasal 31 ayat (2)-(4): klausula keterkaitan dengan perceraian.
  if (sebagian && k.kelompok === "cerai") {
    hasil.push({
      isi: [
        `Kesepakatan Perdamaian Sebagian ini berkaitan dengan perkara perceraian Nomor ${d.nomorPerkara}, hanya dapat dilaksanakan apabila Pihak I dan Pihak II benar-benar telah bercerai berdasarkan putusan yang telah berkekuatan hukum tetap, dan tidak berlaku apabila Majelis Hakim menolak ${k.talak ? "permohonan" : "gugatan"} atau Para Pihak bersedia rukun kembali selama proses pemeriksaan perkara.`,
      ],
      asal: "keterkaitan-cerai",
    });
  }

  if (sebagian) {
    const tidak = baris(draf.butir["tidak-disepakati"]?.aktif ? draf.butir["tidak-disepakati"]?.teks : "");
    // Cerai talak dan perkara bersebutan Pemohon diajukan dengan PERMOHONAN,
    // bukan gugatan - sama dengan kata pada pasal penutup di bawah.
    const pokok = d.sebutanSatu === "Pemohon" ? "pokok permohonan" : "pokok gugatan";
    hasil.push({
      isi: tidak.length
        ? [
            `Tentang ${pokok} yang tidak tertuang dalam Kesepakatan Perdamaian ini, yaitu:`,
            ...tidak.map((x, i) => `${i + 1}. ${x.replace(/[;.]\s*$/, "")};`),
            "Para Pihak menyerahkannya kepada Majelis Hakim untuk diperiksa dan diadili.",
          ]
        : [`Tentang ${pokok} yang tidak tertuang dalam Kesepakatan Perdamaian ini akan dilanjutkan pada proses persidangan.`],
      asal: "tidak-disepakati",
    });
    hasil.push({
      isi: [
        `Para Pihak sepakat mohon kepada Majelis Hakim yang memeriksa dan mengadili perkara Nomor ${d.nomorPerkara} untuk memuat Kesepakatan Perdamaian ini ke dalam pertimbangan dan amar putusan.`,
      ],
      asal: "penutup",
    });
  } else if (draf.penutup === "akta" && k.kelompok !== "cerai") {
    hasil.push({
      isi: [
        `Para Pihak mohon kepada Majelis Hakim yang memeriksa dan mengadili perkara Nomor ${d.nomorPerkara} untuk menguatkan Kesepakatan Perdamaian ini dalam Akta Perdamaian.`,
      ],
      asal: "penutup",
    });
  } else {
    const surat = d.sebutanSatu === "Pemohon" ? "permohonan" : "gugatan";
    hasil.push({
      isi: [
        `${rujuk(k, "satu")} sepakat untuk mencabut ${surat} perkara Nomor ${d.nomorPerkara}, dan Para Pihak menyatakan perkara tersebut telah selesai.`,
      ],
      asal: "penutup",
    });
  }

  if (aktif("biaya-perkara")) {
    const p = draf.butir["biaya-perkara"].pihak;
    hasil.push({
      isi: [
        p === "keduanya"
          ? "Bahwa semua biaya yang timbul dalam perkara ini ditanggung oleh Para Pihak secara bersama-sama dengan bagian yang sama."
          : `Bahwa semua biaya yang timbul dalam perkara ini ditanggung oleh ${rujuk(k, p)}.`,
      ],
      asal: "biaya-perkara",
    });
  }
  return hasil;
}

// ============================================================================
// KEKURANGAN - DITAMPILKAN SEBELUM UNDUH, TIDAK MENAHAN
// ============================================================================

export function kekuranganDraf(draf: DrafHasilMediasi): string[] {
  const hasil: string[] = [];
  const d = draf.dokumen;
  if (!bersih(d.mediator)) hasil.push("Nama mediator kosong.");
  if (d.pihakSatu.length === 0) hasil.push(`Nama ${d.sebutanSatu} kosong.`);
  if (d.pihakDua.length === 0) hasil.push(`Nama ${d.sebutanDua} kosong.`);
  if (d.pertemuan.length === 0) hasil.push("Belum ada tanggal pertemuan mediasi.");
  if (berhasil(draf.hasil)) {
    const butirAktif = KATALOG_BUTIR.filter(
      (b) => draf.butir[b.kunci]?.aktif && !["biaya-perkara", "tidak-disepakati", "tenggat-pembayaran"].includes(b.kunci)
    );
    if (butirAktif.length === 0) hasil.push("Belum ada butir yang disepakati.");
    for (const b of butirAktif) {
      const isi = draf.butir[b.kunci];
      const pakaiNominal = b.medan.some((m) => m.ruas === "nominal");
      const bolehTanpaNominal =
        (b.kunci === "mutah" || b.kunci === "mahar") && bersih(isi.bentuk)
          ? true
          : b.kunci === "harta-bersama" && isi.cara !== "kompensasi";
      if (pakaiNominal && !bolehTanpaNominal && !(Number(isi.nominal) > 0)) {
        hasil.push(`${b.label}: nominal belum diisi (akan tercetak titik-titik).`);
      }
      if (b.medan.some((m) => m.jenis === "anak") && (isi.anak ?? []).length === 0) hasil.push(`${b.label}: anak belum dipilih.`);
      if (b.medan.some((m) => m.ruas === "objek") && baris(isi.objek).length === 0) hasil.push(`${b.label}: objek belum diisi.`);
    }
    if (draf.hasil === "berhasil-sebagian" && !(draf.butir["tidak-disepakati"]?.aktif && baris(draf.butir["tidak-disepakati"].teks).length)) {
      hasil.push("Berhasil sebagian: tuntutan yang TIDAK disepakati belum disebut.");
    }
  }
  return hasil;
}

// ============================================================================
// NASKAH - BLOK YANG DIGAMBAR PRATINJAU DAN DITULIS RTF
// ============================================================================

export type Blok =
  | { jenis: "judul"; teks: string; halamanBaru?: boolean; garisBawah?: boolean }
  | { jenis: "paragraf"; teks: string; rata?: "kiri" | "tengah" | "kanan" | "penuh"; menjorok?: boolean; tebal?: boolean }
  | { jenis: "butir"; nomor: string; teks: string; lekuk?: number }
  | { jenis: "kosong" }
  | { jenis: "ttd"; kiri: string[]; kanan: string[] }
  | { jenis: "seksi-lanskap" }
  | { jenis: "tabel"; kepala: string[]; lebar: number[]; baris: string[][] };

/** 1 -> "I", 14 -> "XIV". Perkara waris satker berpihak sampai belasan orang. */
export function romawi(n: number): string {
  let sisa = Math.floor(Number(n) || 0);
  if (sisa <= 0 || sisa >= 4000) return String(n);
  const lambang: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let hasil = "";
  for (const [nilai, huruf] of lambang) {
    while (sisa >= nilai) {
      hasil += huruf;
      sisa -= nilai;
    }
  }
  return hasil;
}

/**
 * "Tergugat" bila seorang, "Tergugat III" bila beberapa. Dulu daftar romawi
 * berhenti di VI, sehingga Penggugat ketujuh dst. tertulis "Penggugat 7"
 * (273/Pdt.G/2026: empat belas penggugat).
 */
function sebutanKe(sebutan: string, i: number, jumlah: number): string {
  return jumlah > 1 ? `${sebutan} ${romawi(i + 1)}` : sebutan;
}

function turutSebutan(d: DrafHasilMediasi["dokumen"]): string {
  return `Turut ${d.sebutanDua}`;
}

function sebutSisi(d: DrafHasilMediasi["dokumen"], sisi: SisiAtauKeduanya): string {
  if (sisi === "keduanya") return `${d.sebutanSatu} dan ${d.sebutanDua}`;
  return sisi === "satu" ? d.sebutanSatu : d.sebutanDua;
}

function namaSisi(d: DrafHasilMediasi["dokumen"], sisi: Sisi): string {
  const x = (sisi === "satu" ? d.pihakSatu : d.pihakDua).map((o) => o.nama).filter(Boolean);
  return x.length ? gabungDan(x) : "..............................";
}

function kalimatOrang(o: OrangDraf, sebagai: string): string {
  const ket = bersih(o.keterangan);
  return `${bersih(o.nama) || ".............................."}${ket ? `, ${ket}` : ""}, sebagai ${sebagai};`;
}

/** Blok identitas para pihak ("A ..., sebagai Penggugat; melawan B ..., sebagai Tergugat;"). */
function blokPara(d: DrafHasilMediasi["dokumen"], gaya: "laporan" | "kesepakatan"): Blok[] {
  const sisiBlok = (sisi: Sisi): Blok[] => {
    const orang = sisi === "satu" ? d.pihakSatu : d.pihakDua;
    const sebutan = sisi === "satu" ? d.sebutanSatu : d.sebutanDua;
    const kuasa = bersih(sisi === "satu" ? d.kuasaSatu : d.kuasaDua);
    const daftar = orang.length ? orang : [{ nama: "", keterangan: "" }];
    return daftar.map((o, i) => {
      const nama = sebutanKe(sebutan, i, daftar.length);
      const sebagai = gaya === "kesepakatan" ? `${nama}, selanjutnya disebut Pihak ${sisi === "satu" ? "I" : "II"}` : nama;
      let teks = kalimatOrang(o, sebagai);
      if (kuasa && i === daftar.length - 1) teks = teks.replace(/;$/, `, dalam hal ini diwakili oleh kuasanya, ${kuasa};`);
      return { jenis: "paragraf", teks, menjorok: false } as Blok;
    });
  };
  const turut = Array.isArray(d.pihakTurut) ? d.pihakTurut : [];
  return [
    ...sisiBlok("satu"),
    { jenis: "paragraf", teks: gaya === "kesepakatan" ? "d a n" : "melawan", rata: "tengah" },
    ...sisiBlok("dua"),
    ...turut.map(
      (o, i): Blok => ({ jenis: "paragraf", teks: kalimatOrang(o, sebutanKe(turutSebutan(d), i, turut.length)), menjorok: false })
    ),
  ];
}

function ttdPara(d: DrafHasilMediasi["dokumen"]): Blok[] {
  const kolom = (sisi: Sisi): string[] => {
    const orang = sisi === "satu" ? d.pihakSatu : d.pihakDua;
    const sebutan = sisi === "satu" ? d.sebutanSatu : d.sebutanDua;
    const kuasa = bersih(sisi === "satu" ? d.kuasaSatu : d.kuasaDua);
    const isi: string[] = [];
    (orang.length ? orang : [{ nama: "", keterangan: "" }]).forEach((o, i, semua) => {
      if (i > 0) isi.push("");
      isi.push(`${sebutanKe(sebutan, i, semua.length)},`, "", "", "", bersih(o.nama) || "..............................");
    });
    if (kuasa) isi.push("", `Kuasa ${sebutan},`, "", "", "", kuasa);
    return isi;
  };
  // Turut tergugat bertanda tangan pada baris sendiri, bergantian kiri-kanan.
  const turut = Array.isArray(d.pihakTurut) ? d.pihakTurut : [];
  const kolomTurut = (genap: boolean): string[] => {
    const isi: string[] = [];
    turut.forEach((o, i) => {
      if ((i % 2 === 0) !== genap) return;
      if (isi.length) isi.push("");
      isi.push(`${sebutanKe(turutSebutan(d), i, turut.length)},`, "", "", "", bersih(o.nama) || "..............................");
    });
    return isi;
  };
  return [
    { jenis: "ttd", kiri: kolom("satu"), kanan: kolom("dua") },
    ...(turut.length ? ([{ jenis: "kosong" }, { jenis: "ttd", kiri: kolomTurut(true), kanan: kolomTurut(false) }] as Blok[]) : []),
    { jenis: "kosong" },
    { jenis: "paragraf", teks: "Mediator,", rata: "tengah" },
    { jenis: "kosong" },
    { jenis: "kosong" },
    { jenis: "kosong" },
    { jenis: "paragraf", teks: bersih(d.mediator) || "..............................", rata: "tengah", tebal: true },
  ];
}

function ttdMediator(d: DrafHasilMediasi["dokumen"], tanggal: string): Blok[] {
  return [
    { jenis: "kosong" },
    { jenis: "ttd", kiri: [], kanan: [`${d.kota}, ${tanggalNaskah(tanggal)}`, "Mediator,", "", "", "", bersih(d.mediator) || ".............................."] },
  ];
}

function tanggalPertemuanTeks(d: DrafHasilMediasi["dokumen"]): string {
  const t = d.pertemuan.filter((p) => !/tunda/i.test(p.keterangan)).map((p) => tanggalNaskah(p.tanggal));
  const semua = t.length ? t : d.pertemuan.map((p) => tanggalNaskah(p.tanggal));
  return semua.length ? gabungDan([...new Set(semua)]) : "....................";
}

function totalBiaya(d: DrafHasilMediasi["dokumen"]): number {
  return [d.biayaJasa, d.biayaPanggilanSatu, d.biayaPanggilanDua, d.biayaLain].reduce((n, x) => n + (Number(x) || 0), 0);
}

function rpPendek(n: number): string {
  return `Rp${angkaRibuan(n)},00`;
}

/** Seluruh naskah sebagai blok - pratinjau dan RTF memakai yang sama. */
export function susunNaskah(
  draf: DrafHasilMediasi,
  bahan?: Pick<BahanHasilMediasi, "jenisPerkaraId" | "jenisPerkara">
): Blok[] {
  const d = draf.dokumen;
  const sumber = bahan ?? { jenisPerkara: d.jenisPerkara, jenisPerkaraId: null };
  const kelompok = kelompokPerkara(sumber);
  const hasil = draf.hasil;
  const hasilKata =
    hasil === "berhasil-seluruhnya"
      ? "berhasil"
      : hasil === "berhasil-sebagian"
        ? "berhasil sebagian"
        : hasil === "tidak-berhasil"
          ? "tidak berhasil mencapai kesepakatan"
          : "tidak dapat dilaksanakan";
  const blok: Blok[] = [];

  // --- 1. Surat pengantar (KMA I-16) ---------------------------------------
  blok.push(
    { jenis: "paragraf", teks: "Hal : Laporan Mediasi", rata: "kiri" },
    { jenis: "kosong" },
    { jenis: "paragraf", teks: "Kepada :", rata: "kiri" },
    { jenis: "paragraf", teks: "Yth. Majelis Hakim yang memeriksa perkara", rata: "kiri" },
    { jenis: "paragraf", teks: `Nomor ${d.nomorPerkara}`, rata: "kiri" },
    { jenis: "paragraf", teks: "di", rata: "kiri" },
    { jenis: "paragraf", teks: d.namaPengadilan, rata: "kiri" },
    { jenis: "kosong" },
    { jenis: "paragraf", teks: "Dengan Hormat,", rata: "kiri" },
    {
      jenis: "paragraf",
      menjorok: true,
      teks: `Bersama ini saya, selaku mediator dalam perkara Nomor ${d.nomorPerkara} melaporkan bahwa proses mediasi yang saya laksanakan dinyatakan ${hasilKata}${
        berhasil(hasil)
          ? ` (Laporan Hasil Mediasi dan Kesepakatan Perdamaian${hasil === "berhasil-sebagian" ? " Sebagian" : ""} terlampir)`
          : " (Laporan Hasil Mediasi terlampir)"
      }.`,
    },
    {
      jenis: "paragraf",
      menjorok: true,
      teks: "Demikian laporan ini saya sampaikan dan atas perhatiannya saya ucapkan terima kasih.",
    },
    ...ttdMediator(d, d.tanggalLaporan)
  );

  // --- 2. Laporan hasil mediasi --------------------------------------------
  blok.push(
    { jenis: "judul", teks: "LAPORAN HASIL MEDIASI", halamanBaru: true },
    { jenis: "paragraf", teks: `Perkara Nomor: ${d.nomorPerkara}`, rata: "tengah" },
    { jenis: "kosong" },
    {
      jenis: "paragraf",
      menjorok: true,
      teks: `Yang bertanda tangan di bawah ini ${bersih(d.mediator) || ".............................."}, yang ditunjuk oleh Majelis Hakim pada tanggal ${tanggalNaskah(
        d.tanggalPenunjukan
      )} sebagai Mediator dalam perkara Nomor ${d.nomorPerkara} yang diajukan oleh:`,
    },
    ...blokPara(d, "laporan"),
    { jenis: "paragraf", menjorok: true, teks: "Sehubungan dengan hal tersebut, maka bersama ini dilaporkan hasil pelaksanaan Mediasi sebagai berikut:" }
  );

  const poin: string[] = [];
  const tanggalTeks = tanggalPertemuanTeks(d);
  const tempat = bersih(d.tempatMediasi) || "..............................";
  const iktikadPihak = sebutSisi(d, draf.pihakTidakBeriktikad);
  if (hasil === "berhasil-seluruhnya") {
    poin.push(
      `Bahwa mediasi telah dilaksanakan pada tanggal ${tanggalTeks} yang bertempat di ${tempat} yang dihadiri oleh ${d.kehadiran || "kedua belah pihak"} dan telah menghasilkan kesepakatan perdamaian atas seluruh pokok sengketa${
        kelompok === "cerai" ? ", yaitu Para Pihak sepakat untuk rukun kembali" : ""
      };`,
      `Bahwa berdasarkan hal-hal tersebut, maka mediasi dinyatakan berhasil sesuai dengan Pasal 27 ayat (6) PERMA Nomor 1 Tahun 2016, dan Kesepakatan Perdamaian terlampir;`
    );
  } else if (hasil === "berhasil-sebagian") {
    poin.push(
      `Bahwa mediasi telah dilaksanakan secara maksimal pada tanggal ${tanggalTeks} yang bertempat di ${tempat} yang dihadiri oleh ${d.kehadiran || "kedua belah pihak"}${
        kelompok === "cerai" ? ", Para Pihak tidak mencapai kesepakatan untuk hidup rukun kembali, namun" : " dan"
      } telah menghasilkan kesepakatan sebagian;`,
      `Bahwa berdasarkan hal-hal tersebut, maka mediasi dinyatakan berhasil sebagian sesuai dengan ${
        kelompok === "cerai" ? "Pasal 31 ayat (2)" : "Pasal 30"
      } PERMA Nomor 1 Tahun 2016, dan Kesepakatan Perdamaian Sebagian terlampir;`
    );
  } else if (hasil === "tidak-berhasil") {
    const alasan = ALASAN_TIDAK_BERHASIL.find((x) => x.kunci === draf.alasanTidakBerhasil) ?? ALASAN_TIDAK_BERHASIL[0];
    poin.push(
      alasan.iktikad
        ? `Bahwa mediasi telah dilaksanakan pada tanggal ${tanggalTeks} yang bertempat di ${tempat}, namun ${iktikadPihak} ${alasan.label.charAt(0).toLowerCase()}${alasan.label.slice(1)}, sehingga dinyatakan tidak beriktikad baik;`
        : `Bahwa mediasi telah dilaksanakan pada tanggal ${tanggalTeks} yang bertempat di ${tempat} yang dihadiri oleh ${d.kehadiran || "kedua belah pihak"}, namun Para Pihak tidak menghasilkan kesepakatan sampai batas waktu paling lama 30 (tiga puluh) hari berikut perpanjangannya;`,
      `Bahwa berdasarkan hal-hal tersebut, maka mediasi dinyatakan tidak berhasil mencapai kesepakatan sesuai dengan ${alasan.pasal} PERMA Nomor 1 Tahun 2016;`
    );
  } else {
    const alasan = ALASAN_TIDAK_DAPAT.find((x) => x.kunci === draf.alasanTidakDapat) ?? ALASAN_TIDAK_DAPAT[0];
    poin.push(
      alasan.iktikad
        ? `Bahwa mediasi dijadwalkan pada tanggal ${tanggalTeks} yang bertempat di ${tempat}, namun ${iktikadPihak} ${alasan.label.charAt(0).toLowerCase()}${alasan.label.slice(1)}, sehingga dinyatakan tidak beriktikad baik;`
        : `Bahwa mediasi tidak dapat dilaksanakan karena sengketa ini ${alasan.label.charAt(0).toLowerCase()}${alasan.label.slice(1)};`,
      `Bahwa berdasarkan hal-hal tersebut, maka mediasi dinyatakan tidak dapat dilaksanakan sesuai dengan ${alasan.pasal} PERMA Nomor 1 Tahun 2016;`
    );
  }
  const total = totalBiaya(d);
  poin.push(
    `Bahwa biaya mediasi yang timbul atas perkara ini sebesar ${total > 0 ? `${rpPendek(total)} (${terbilang(total)} rupiah)` : "Rp.................."} dibebankan kepada ${sebutSisi(
      d,
      d.bebanBiayaMediasi
    )} sesuai ketentuan Pasal 9 ayat (${berhasil(hasil) ? "3" : "4"}) PERMA Nomor 1 Tahun 2016;`
  );
  poin.forEach((p, i) => blok.push({ jenis: "butir", nomor: `${i + 1}.`, teks: p }));
  blok.push(
    { jenis: "paragraf", menjorok: true, teks: "Demikian laporan ini dibuat sebagai bahan pertimbangan Majelis Hakim dalam memeriksa dan memutus perkara ini." },
    ...ttdMediator(d, d.tanggalLaporan),
    { jenis: "kosong" },
    { jenis: "paragraf", teks: "Perincian biaya :", rata: "kiri" },
    { jenis: "butir", nomor: "-", teks: `Jasa : ${rpPendek(d.biayaJasa)}` },
    { jenis: "butir", nomor: "-", teks: `Panggilan ${d.sebutanSatu} : ${rpPendek(d.biayaPanggilanSatu)}` },
    { jenis: "butir", nomor: "-", teks: `Panggilan ${d.sebutanDua} : ${rpPendek(d.biayaPanggilanDua)}` },
    { jenis: "butir", nomor: "-", teks: `Lain-lain : ${rpPendek(d.biayaLain)}` },
    { jenis: "paragraf", teks: `J u m l a h : ${rpPendek(total)}`, tebal: true },
    { jenis: "paragraf", teks: `(${total > 0 ? terbilang(total) : "nol"} rupiah).` }
  );

  // --- 3. Pernyataan para pihak (KMA I-17) ---------------------------------
  if (d.sertakanPernyataan) {
    blok.push(
      { jenis: "judul", teks: "PERNYATAAN PARA PIHAK TENTANG HASIL MEDIASI", halamanBaru: true },
      { jenis: "kosong" },
      {
        jenis: "paragraf",
        menjorok: true,
        teks: `Pada hari ini: ${hariNaskah(d.tanggalKesepakatan)}, tanggal ${tanggalNaskah(d.tanggalKesepakatan)}, Kami Para Pihak dalam perkara ${
          d.jenisPerkara || ".........."
        } di ${d.namaPengadilan} Nomor ${d.nomorPerkara} antara:`,
      },
      ...blokPara(d, "laporan"),
      {
        jenis: "paragraf",
        menjorok: true,
        teks: `dengan ini menyatakan bahwa proses mediasi yang telah kami tempuh tanggal ${tanggalTeks} di ${d.namaPengadilan} ${
          hasil === "berhasil-seluruhnya"
            ? "telah berhasil mencapai perdamaian"
            : hasil === "berhasil-sebagian"
              ? "berhasil sebagian mencapai perdamaian"
              : hasil === "tidak-berhasil"
                ? "tidak berhasil mencapai kesepakatan"
                : "tidak dapat dilaksanakan"
        }.`,
      },
      {
        jenis: "paragraf",
        menjorok: true,
        teks: "Demikian pernyataan ini dibuat dan ditandatangani oleh kami selaku Para Pihak dan diketahui oleh Mediator.",
      },
      { jenis: "paragraf", teks: `${d.kota}, ${tanggalNaskah(d.tanggalKesepakatan)}`, rata: "kanan" },
      { jenis: "kosong" },
      ...ttdPara(d)
    );
  }

  // --- 4. Kesepakatan perdamaian (KMA I-09 / I-11) -------------------------
  if (berhasil(hasil)) {
    const sebagian = hasil === "berhasil-sebagian";
    blok.push(
      { jenis: "judul", teks: sebagian ? "KESEPAKATAN PERDAMAIAN SEBAGIAN" : "KESEPAKATAN PERDAMAIAN", halamanBaru: true },
      { jenis: "kosong" },
      {
        jenis: "paragraf",
        menjorok: true,
        teks: `Pada hari ini, ${hariNaskah(d.tanggalKesepakatan)}, tanggal ${tanggalNaskah(d.tanggalKesepakatan)}, telah terjadi kesepakatan perdamaian di ${
          bersih(d.tempatMediasi) || ".........."
        } yang didampingi seorang mediator (${bersih(d.mediator) || ".........."}) dalam perkara Nomor ${d.nomorPerkara} antara:`,
      },
      ...blokPara(d, "kesepakatan"),
      { jenis: "paragraf", menjorok: true, teks: "Selanjutnya Pihak I dan Pihak II disebut sebagai Para Pihak." },
      { jenis: "kosong" },
      {
        jenis: "paragraf",
        menjorok: true,
        teks: sebagian
          ? "Dalam rangka untuk mengakhiri sengketa, Para Pihak telah mencapai kesepakatan atas sebagian tuntutan hukum atau objek dalam sengketa a quo dengan ketentuan sebagai berikut:"
          : "Dalam rangka mengakhiri sengketa, dengan ini Para Pihak telah mencapai kesepakatan dengan syarat-syarat dan ketentuan-ketentuan sebagai berikut:",
      }
    );
    susunPasal(draf, sumber).forEach((p, i) => {
      blok.push({ jenis: "judul", teks: `Pasal ${i + 1}` });
      p.isi.forEach((teks, j) => {
        const nomor = /^(\d+)\.\s+(.*)$/.exec(teks);
        if (j > 0 && nomor) blok.push({ jenis: "butir", nomor: `${nomor[1]}.`, teks: nomor[2], lekuk: 1 });
        else blok.push({ jenis: "paragraf", teks });
      });
    });
    blok.push(
      { jenis: "kosong" },
      {
        jenis: "paragraf",
        menjorok: true,
        teks: "Demikian Kesepakatan Perdamaian ini dibuat dengan sukarela tanpa tekanan dari pihak mana pun, dan ditandatangani oleh Para Pihak dan Mediator.",
      },
      { jenis: "kosong" },
      { jenis: "paragraf", teks: `${d.kota}, ${tanggalNaskah(d.tanggalKesepakatan)}`, rata: "kanan" },
      { jenis: "kosong" },
      ...ttdPara(d)
    );

    // --- 5. Kuasa: persetujuan tertulis para pihak (Pasal 27 ayat (3), KMA I-12)
    const adaKuasa = bersih(d.kuasaSatu) || bersih(d.kuasaDua);
    if (adaKuasa) {
      for (const sisi of ["satu", "dua"] as Sisi[]) {
        const kuasa = bersih(sisi === "satu" ? d.kuasaSatu : d.kuasaDua);
        if (!kuasa) continue;
        const sebutan = sisi === "satu" ? d.sebutanSatu : d.sebutanDua;
        blok.push(
          { jenis: "judul", teks: "PERNYATAAN PARA PIHAK YANG DIWAKILI OLEH KUASA HUKUM", halamanBaru: true },
          { jenis: "judul", teks: "TENTANG PERSETUJUAN ATAS KESEPAKATAN PERDAMAIAN" },
          { jenis: "kosong" },
          { jenis: "paragraf", teks: "Yang bertanda tangan di bawah ini:" },
          ...(sisi === "satu" ? d.pihakSatu : d.pihakDua).map(
            (o, i, semua): Blok => ({
              jenis: "paragraf",
              teks: kalimatOrang(o, sebutanKe(sebutan, i, semua.length)).replace(/;$/, `, yang memberikan kuasa kepada ${kuasa};`),
            })
          ),
          {
            jenis: "paragraf",
            menjorok: true,
            teks: `dalam perkara Nomor ${d.nomorPerkara} di ${d.namaPengadilan}, dengan ini menyatakan telah membaca dan memahami konsep Kesepakatan Perdamaian serta menyetujui konsep Kesepakatan Perdamaian dalam proses mediasi perkara tersebut, dan memberikan kuasa kepada kuasa hukum sebagaimana tersebut di atas untuk menandatangani Kesepakatan Perdamaian tersebut.`,
          },
          { jenis: "paragraf", menjorok: true, teks: "Demikian pernyataan ini dibuat dan ditandatangani oleh kami selaku pihak berperkara pemberi kuasa." },
          { jenis: "kosong" },
          { jenis: "ttd", kiri: [], kanan: [`${d.kota}, ${tanggalNaskah(d.tanggalKesepakatan)}`, `${sebutan},`, "", "", "", namaSisi(d, sisi)] }
        );
      }
    }
  }

  // --- 6. Jadwal mediasi (KMA I-07) - lanskap -----------------------------
  if (d.sertakanJadwal) {
    const isiBaris = d.pertemuan.map((p, i) => [
      String(i + 1),
      `${hariNaskah(p.tanggal)}, ${tanggalNaskah(p.tanggal)}`,
      p.jam || "",
      p.tempat || bersih(d.tempatMediasi),
      String(i + 1),
      "",
      "",
      "",
      d.pertemuan[i + 1] ? `${hariNaskah(d.pertemuan[i + 1].tanggal)}, ${tanggalNaskah(d.pertemuan[i + 1].tanggal)}` : "",
      p.keterangan || "",
    ]);
    while (isiBaris.length < 4) {
      const n = isiBaris.length + 1;
      isiBaris.push([String(n), "", "", "", String(n), "", "", "", "", ""]);
    }
    blok.push(
      { jenis: "seksi-lanskap" },
      { jenis: "judul", teks: "JADWAL MEDIASI" },
      { jenis: "judul", teks: d.namaPengadilan.toUpperCase() },
      { jenis: "paragraf", teks: `Nomor: ${d.nomorPerkara}`, rata: "tengah" },
      { jenis: "paragraf", teks: `${namaSisi(d, "satu")} sebagai ${d.sebutanSatu} melawan ${namaSisi(d, "dua")} sebagai ${d.sebutanDua}`, rata: "tengah" },
      { jenis: "kosong" },
      {
        jenis: "tabel",
        kepala: [
          "NO.",
          "HARI/TANGGAL",
          "WAKTU",
          "TEMPAT",
          "PERTEMUAN KE",
          `PARAF ${d.sebutanSatu.toUpperCase()}`,
          `PARAF ${d.sebutanDua.toUpperCase()}`,
          "PARAF MEDIATOR",
          "WAKTU PERTEMUAN BERIKUTNYA",
          "KETERANGAN",
        ],
        // Jumlahnya 14570 twip = lebar isi lanskap (16838 - 2 x 1134).
        lebar: [500, 2100, 1100, 2000, 1000, 1300, 1300, 1300, 2270, 1700],
        baris: isiBaris,
      },
      { jenis: "kosong" },
      { jenis: "ttd", kiri: [], kanan: [`${d.kota}, ${tanggalNaskah(d.tanggalLaporan)}`, "Mediator,", "", "", "", bersih(d.mediator) || ".............................."] }
    );
  }
  return blok;
}

/** "371/Pdt.G/2025/PA.Dgl" -> "371_Pdt.G_2025_PA.Dgl - Laporan Mediasi Berhasil Sebagian.rtf". */
export function namaBerkasHasilMediasi(nomorPerkara: string, hasil: KunciHasil): string {
  const nomor = bersih(nomorPerkara).replace(/[\\/]+/g, "_").replace(/[:*?"<>|]+/g, "") || "perkara";
  const label = HASIL_MEDIASI.find((x) => x.kunci === hasil)?.namaBerkas ?? "Hasil";
  return `${nomor} - Laporan Mediasi ${label}.rtf`;
}

/** Teks polos naskah - pratinjau ringkas di pop-up. */
export function teksNaskah(blok: Blok[]): string {
  const keluar: string[] = [];
  for (const b of blok) {
    switch (b.jenis) {
      case "judul":
        if (b.halamanBaru) keluar.push("", "-----");
        keluar.push(b.teks);
        break;
      case "paragraf":
        keluar.push(b.teks);
        break;
      case "butir":
        keluar.push(`${b.nomor} ${b.teks}`);
        break;
      case "kosong":
        keluar.push("");
        break;
      case "ttd":
        keluar.push([...b.kiri, ...b.kanan].filter(Boolean).join(" | "));
        break;
      case "seksi-lanskap":
        keluar.push("", "-----");
        break;
      case "tabel":
        keluar.push(b.kepala.join(" | "), ...b.baris.map((r) => r.join(" | ")));
        break;
    }
  }
  return keluar.join("\n");
}

// ============================================================================
// SIAPA YANG MELIHAT TOMBOLNYA
// ============================================================================

export type PenggunaHasilMediasi = {
  nama: string;
  peran: string;
  peranTambahan?: readonly string[] | null;
};

/**
 * Tombol hanya bagi MEDIATOR perkara itu, dan Super Admin (untuk uji).
 *
 * Mediatornya dikenali dari NAMA (sama dengan "Perkara saya" di Jadwal
 * Sidang - lihat namaCocokSatu: tidak ada NIP yang menghubungkan akun portal
 * dengan pegawai SIPP). Admin biasa TIDAK: naskah ini ditandatangani
 * mediator, dan yang menyusunnya pun harus mediatornya.
 */
export function bolehBuatHasilMediasi(pengguna: PenggunaHasilMediasi | null | undefined, mediatorTeks: string): boolean {
  if (!pengguna) return false;
  const peran = String(pengguna.peran || "").trim().toLowerCase();
  if (peran === "super-admin") return true;
  return namaTiapMediator(mediatorTeks).some((nama) => namaCocokSatu(pengguna.nama, nama));
}
