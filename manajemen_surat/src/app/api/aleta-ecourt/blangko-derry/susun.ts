/**
 * ============================================================================
 * SUSUNAN ISIAN SATU BLANGKO DERRY (TAHAP F "PERLU DIISI") - MURNI
 * ============================================================================
 *
 * Masukan: penanda #NNNN# yang ada di berkas RTF blangko (dibaca bot lewat
 * blangko.baca) dan katalog variabel ABT (abt_variabel: nama, data_type,
 * sql_query, default_data). Keluaran: isian TANGAN SUNGGUHAN blangko itu -
 * data_teks / data_tanggal / tanya_jawab - termasuk yang tidak tertulis
 * langsung di RTF tetapi dibaca variabel lain (mis. #4001# AMAR membaca #8503#
 * alasan perceraian lewat kueri), isian berpemicu (#11111# kuasa, #11112#
 * prodeo, #11116# alasan C, #11117# alasan H), label bahasa mudah, pilihan
 * dan saran, serta pasangan tanya jawab per saksi.
 *
 * Tidak ada jaringan di sini; rute yang memanggilnya menyediakan katalog dari
 * bot (abt.semuaVariabel) atau salinan kamus ALETA.
 */

import { ISIAN_MANUAL, ISIAN_OPSIONAL } from "./isian-metadata";
import { ISIAN_MANUAL_W3B, ISIAN_OPSIONAL_W3B, RAMAH_W3B } from "./ramah-w3b";
import { gabungRamahW104 } from "./ramah-w104";

// W3b 21 Okt: isian manual / opsional blangko Derry baru gelombang 3 (dibangkitkan ke ramah-w3b.ts) digabung ke tabel metadata bersama.
Object.assign(ISIAN_MANUAL, ISIAN_MANUAL_W3B);
Object.assign(ISIAN_OPSIONAL, ISIAN_OPSIONAL_W3B);

export type Definisi = { kode: string; nama: string; jenis: string; sql: string; bawaan: string };
export type JenisIsian = "teks" | "tanggal" | "tj";
export type ButirIsian = {
  kode: string;
  /** Label bahasa mudah untuk layar; nama ABT tidak diubah (namaAsli). */
  nama: string;
  namaAsli: string;
  jenis: JenisIsian;
  /** Kode pemicu (11111 ...) bila isian hanya berlaku ketika pemicunya menyala; "" bila selalu. */
  pemicu: string;
  /** false = isian pilihan ("kosong = dari SIPP", penanda teknis) - tidak dihitung "perlu diisi". */
  wajib: boolean;
  /** Tertulis langsung di RTF (true) atau hanya dibaca variabel lain (false). */
  langsung: boolean;
  bawaan: string;
  pilihan: string[];
  saran: string;
  /** Variabel otomatis yang membaca isian ini - "ikut mengubah N bagian". */
  dipakaiOleh: string[];
  khusus: "" | "bukti";
  pihak: "" | "P" | "T";
  /**
   * Keadaan perkara yang membuat isian ini berlaku ("" = selalu). Kuasa/prodeo/alasan C-H dinilai lewat pemicu
   * ABT (#11111# dst.); ghaib dan e-Court dari data perkara SIPP di ekstensi; kuasa insidentil hanya bila
   * isiannya tertulis langsung di blangko atau sudah terisi.
   */
  keadaan: Keadaan;
  /** "penting" = masuk naskah/amar/pertimbangan; "tambahan" = berbawaan atau keterangan tambahan (pengingat cetak). */
  tingkat: "penting" | "tambahan";
  /** Pilihan bernilai (mis. 7139: "1"/"2") - layar menampilkan label, ABT menyimpan nilai. */
  opsi: Array<{ nilai: string; label: string }>;
  tj: null | { kunci: string; sebutan: string; peran: "tanyajawab" | "keterangan"; kodeSunting: string };
  /**
   * 20 Okt (S3): isian tambahan "bila ada" (mis. #9134# petunjuk perbaikan permohonan) - layar memindahkannya ke bagian tertutup
   * "Isian tambahan (bila ada)" dengan labelPengguna. Hanya ada pada isian yang opsional.
   */
  opsional?: boolean;
  labelPengguna?: string;
  /**
   * 20 Okt (S3): isian yang tidak mungkin terisi otomatis (penilaian majelis / fakta persidangan yang tidak dicatat SIPP):
   * ditandai "diisi manual" dengan alasannya (ikon ⓘ). Pengisi otomatis tetap menang bila menemukan nilai.
   */
  manual?: boolean;
  alasanManual?: string;
  /**
   * 21 Okt (tuntutan sinkron): kode pemicu petitum (4140-4145) tuntutan yang dilayani isian ini. Isian yang TIDAK tertulis
   * langsung di blangko (hanya dibaca bagian otomatis, mis. #4119#/#4138#) hanya tampil bila tuntutan itu diminta petitum,
   * ditetapkan hakim karena jabatan, keputusan majelisnya sudah dipilih, atau isiannya sudah ada isinya.
   */
  tuntutan?: string[];
  /**
   * 21 Okt: isian CADANGAN tuntutan untuk jenis perkara ini ("cg" cerai gugat / "ct" cerai talak): kueri paket u2 membaca
   * COALESCE(isian cerai talak, isian cerai gugat) - satu besaran punya dua kotak. Kotak cadangan tidak tampil di daftar utama
   * kecuali sudah berisi (masuk bagian tertutup), supaya petugas tidak mengisi dua kotak untuk satu besaran.
   */
  cadangan?: Array<"cg" | "ct">;
};
export type Keadaan = "" | "kuasaP" | "kuasaT" | "prodeo" | "alasanC" | "alasanH" | "ghaib" | "ecourt" | "insidentil";
/** Satu tuntutan akibat perceraian yang isiannya ada (lewat bagian otomatis) di blangko ini. */
export type TuntutanBlangko = { pemicu: string; label: string; keputusan: string; isian: string[] };
export type Susunan = {
  penanda: string[];
  isian: ButirIsian[];
  pemicu: Array<{ kode: string; nama: string; keterangan: string }>;
  otomatis: Array<{ kode: string; nama: string; jenis: string; langsung: boolean }>;
  takDikenal: string[];
  /** 21 Okt: tuntutan yang dikenal blangko ini (urut pemicu); kosong bila blangko tidak memuat isian tuntutan. */
  tuntutan?: TuntutanBlangko[];
  /** 21 Okt: kode variabel keadaan + kutipan petitum per tuntutan (paket x3, #3400#) - dinilai bot bila ada tuntutan. */
  kutipanTuntutan?: string;
  /** 21 Okt (x8): kode variabel keadaan + kutipan petitum untuk pemicu tuntutan LAIN (34xx, kebendaan 4788-4791/4845-4847; #3450#). */
  kutipanLain?: string;
};
/** Variabel ABT keadaan dan kutipan tuntutan (paket x3-tuntutan-sinkron-21okt; tidak dicetak di blangko). */
export const KODE_KUTIPAN_TUNTUTAN = "3400";
/** Variabel ABT keadaan dan kutipan tuntutan lain (paket x8-sisa-tuntutan-21okt; bendera = nilai pemicu itu sendiri; tidak dicetak). */
export const KODE_KUTIPAN_LAIN = "3450";

const MANUAL: Record<string, JenisIsian> = { data_teks: "teks", data_tanggal: "tanggal", tanya_jawab: "tj" };
const POLA_REF = /#(\d{4,5})#/g;
const POLA_NO_VAR = /no_var\s*(?:=|in\s*\()\s*['"]?(\d{4,5})/gi;
const POLA_PEMICU = /#(111\d\d|414[0-5])#/;

/**
 * 21 Okt (temuan pengguna): urutan isian = URUTAN PENANDA DI TABEL VARIABEL ABT (urutan kemunculan di RTF). Daftar urutan
 * rancangan v12 yang dulu mendahulukan isian perceraian tertentu dihapus - tabel ABT lama dan panel Blangko Derry harus sama,
 * yang beda hanya tampilan. Isian yang tidak tertulis langsung di RTF menyusul sesudahnya.
 */

/**
 * 21 Okt (tuntutan sinkron posita/petitum): isian akibat perceraian per tuntutan. Kunci = kode pemicu petitum (paket u2, dihitung
 * ABT dari petitum + rekonvensi + kumulasi SIPP: "ya" bila menuntut), keputusan = isian keputusan majelis tuntutan itu.
 * Isian bersama (dasar kemampuan, waktu pembayaran, nama anak) melayani lebih dari satu tuntutan.
 */
export const TUNTUTAN_CERAI: ReadonlyArray<TuntutanBlangko> = [
  { pemicu: "4140", label: "Hak asuh anak (hadhanah)", keputusan: "4100", isian: ["4100", "4106", "4108", "2004"] },
  { pemicu: "4141", label: "Nafkah anak", keputusan: "4101", isian: ["4101", "6071", "6072", "9740", "9741", "9050"] },
  { pemicu: "4142", label: "Nafkah iddah", keputusan: "4102", isian: ["4102", "6054", "9712"] },
  { pemicu: "4143", label: "Mut'ah", keputusan: "4103", isian: ["4103", "6055", "9713"] },
  { pemicu: "4144", label: "Nafkah lampau (madliyah)", keputusan: "4104", isian: ["4104", "7120", "9711"] },
  { pemicu: "4145", label: "Harta bersama", keputusan: "4105", isian: ["4105", "8730"] },
];
const TUNTUTAN_BERSAMA: Record<string, string[]> = {
  "8603": ["4140", "4141"], // nama anak
  "4107": ["4141", "4142", "4143", "4144"], // dasar kemampuan pemberi nafkah
  "9714": ["4142", "4143", "4144"], // dasar kemampuan (cerai gugat kumulasi nafkah istri)
  "4109": ["4142", "4143", "4144"], // waktu pembayaran akibat cerai
  "9715": ["4142", "4143", "4144"], // dibayar sebelum mengambil akta cerai
};
/** Kotak besaran yang menjadi cadangan per jenis cerai (urutan COALESCE paket u2: 6054/9712, 6055/9713, 7120/9711, 9740/6071/6072, 9741/9050). */
const CADANGAN_TUNTUTAN: Record<string, Array<"cg" | "ct">> = {
  "6054": ["cg"], "6055": ["cg"], "7120": ["cg"],
  "9711": ["ct"], "9712": ["ct"], "9713": ["ct"], "9715": ["ct"],
  "6071": ["cg", "ct"], "6072": ["cg", "ct"], "9050": ["cg", "ct"],
};
/** Kode isian -> pemicu tuntutan akibat perceraian yang dilayaninya. */
export function tuntutanIsian(kode: string): string[] {
  if (TUNTUTAN_BERSAMA[kode]) return [...TUNTUTAN_BERSAMA[kode]];
  return TUNTUTAN_CERAI.filter((t) => t.isian.includes(kode)).map((t) => t.pemicu);
}

/**
 * 21 Okt (perluasan x4): tuntutan di luar akibat perceraian. Pemicu = variabel ABT paket x4 (3401-3408 hak bekas istri, 3430-3435
 * tuntutan tambahan perkara anak, 3440 utang bersama, 3441-3448 kelalaian kewajiban suami/istri) atau pemicu kebendaan yang sudah ada (4788-4791, 4845-4847; pola diperbaiki x4).
 * keputusan "" = blangko tidak memakai isian keputusan; isiannya kosong = tidak tercetak (bagian otomatisnya bersyarat isian).
 */
export const TUNTUTAN_LAIN: ReadonlyArray<TuntutanBlangko> = [
  { pemicu: "3401", label: "Nafkah iddah", keputusan: "", isian: ["9712"] },
  { pemicu: "3402", label: "Maskan (tempat tinggal) selama iddah", keputusan: "", isian: ["3751"] },
  { pemicu: "3403", label: "Kiswah (pakaian) selama iddah", keputusan: "", isian: ["3752"] },
  { pemicu: "3404", label: "Mut'ah", keputusan: "", isian: ["9713"] },
  { pemicu: "3405", label: "Nafkah lampau (madliyah)", keputusan: "", isian: ["9711"] },
  { pemicu: "3406", label: "Mahar yang masih terhutang", keputusan: "", isian: ["3753"] },
  { pemicu: "3407", label: "Biaya hadhanah / nafkah anak", keputusan: "", isian: ["9740", "9741", "9746", "9747"] },
  { pemicu: "3408", label: "Sita jaminan biaya hadhanah", keputusan: "", isian: ["3754"] },
  { pemicu: "4788", label: "Sita jaminan", keputusan: "4783", isian: ["4783"] },
  { pemicu: "4789", label: "Bagian selain seperdua", keputusan: "4782", isian: ["4782"] },
  { pemicu: "4790", label: "Uang paksa (dwangsom)", keputusan: "4784", isian: ["4784"] },
  { pemicu: "4791", label: "Putusan serta merta", keputusan: "4785", isian: ["4785"] },
  { pemicu: "3440", label: "Utang bersama", keputusan: "", isian: ["4786"] },
  { pemicu: "4845", label: "Denda / ganti rugi (ta'widh)", keputusan: "4842", isian: ["4842"] },
  { pemicu: "4846", label: "Penyelesaian jaminan / agunan", keputusan: "4843", isian: ["4843"] },
  { pemicu: "4847", label: "Pembatalan akad", keputusan: "4844", isian: ["4844"] },
  { pemicu: "3430", label: "Penyerahan anak", keputusan: "", isian: ["4890"] },
  { pemicu: "3431", label: "Kenaikan nafkah anak setiap tahun", keputusan: "", isian: ["9741", "3931"] },
  { pemicu: "3432", label: "Biaya pendidikan dan kesehatan anak", keputusan: "", isian: ["9742"] },
  { pemicu: "3433", label: "Pemotongan langsung penghasilan", keputusan: "", isian: ["9745"] },
  { pemicu: "3434", label: "Nafkah lampau anak", keputusan: "", isian: ["9746", "9747"] },
  { pemicu: "3435", label: "Sita jaminan nafkah anak", keputusan: "", isian: ["9743"] },
  { pemicu: "3441", label: "Nafkah", keputusan: "", isian: ["3700"] },
  { pemicu: "3442", label: "Nafkah lampau (madliyah)", keputusan: "", isian: ["3701", "3702"] },
  { pemicu: "3443", label: "Kiswah (pakaian)", keputusan: "", isian: ["3703"] },
  { pemicu: "3444", label: "Tempat kediaman", keputusan: "", isian: ["3704"] },
  { pemicu: "3445", label: "Biaya rumah tangga, perawatan, pengobatan", keputusan: "", isian: ["3705"] },
  { pemicu: "3446", label: "Pemotongan langsung penghasilan", keputusan: "", isian: ["3708"] },
  { pemicu: "3447", label: "Sita jaminan", keputusan: "", isian: ["3709"] },
  { pemicu: "3448", label: "Uang paksa (dwangsom)", keputusan: "", isian: ["3710"] },
];
/** Semua tuntutan yang dikenal panel (urut: akibat perceraian dulu). */
export const TUNTUTAN_SEMUA: ReadonlyArray<TuntutanBlangko> = [...TUNTUTAN_CERAI, ...TUNTUTAN_LAIN];
const TUNTUTAN_BERSAMA_LAIN: Record<string, string[]> = {
  "9714": ["3401", "3402", "3403", "3404", "3405"], // dasar kemampuan (hak bekas istri)
  "3756": ["3401", "3402", "3403", "3404", "3405", "3406", "3407"], // waktu pembayaran hak bekas istri
  "3707": ["3441", "3442", "3443", "3444", "3445"], // dasar kemampuan (kelalaian kewajiban)
};
const rentang = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
const HBI_BAGIAN = rentang(3760, 3779);
/**
 * 21 Okt (x4): bagian otomatis yang mencetak tuntutan itu HANYA bila diminta/diputus/diisi. Tuntutan dikenal sebuah blangko (isiannya
 * dapat disembunyikan bila tidak diminta) hanya bila blangko itu - sampai lapis mana pun - memakai salah satu variabel ini dan pemicunya
 * ada di katalog. Blangko cerai (memakai bagian akibat cerai paket u2/x4 atau nafkah istri 9716/9717) mengenal keenam tuntutan akibat
 * cerai - termasuk isian yang tertulis langsung pada varian (Mut'ah Iddah, ex officio): disembunyikan bila tidak diminta dan tampil
 * lewat saklar karena jabatan (aturan w25). Blangko lain TIDAK mengenal tuntutan akibat cerai: hak asuh / nafkah anak sebagai pokok
 * perkara anak, nama anak pada asal usul / pengesahan anak, isi tetap Rekonvensi - isiannya tidak pernah disembunyikan.
 */
const CERAI_BAGIAN = [...rentang(4110, 4119), ...rentang(4130, 4139), "4150", "9716", "9717", ...rentang(3410, 3421)];
const BAGIAN_BERSYARAT: Record<string, string[]> = {
  ...Object.fromEntries(["4140", "4141", "4142", "4143", "4144", "4145"].map((p) => [p, CERAI_BAGIAN])),
  // x8: harta bersama dalam gugatan rekonvensi CT [02] - HANYA harta bersama (isi tetap rekonvensi lain tidak disembunyikan)
  "4145": [...CERAI_BAGIAN, "3451", "3452"],
  ...Object.fromEntries(["3401", "3402", "3403", "3404", "3405", "3406", "3407", "3408"].map((p) => [p, HBI_BAGIAN])),
  // kebendaan: hanya bagian yang MENCETAK tuntutan itu bersyarat petitum/keputusan (blangko Konvensi Rekonvensi Sita Jaminan menetapkan
  // sita sendiri lewat 4804/4814 - tidak termasuk)
  "4788": ["4793", "4799", "4800", "4802", "4824", "4825", "4827", "4835", "4837", "4840"],
  "4789": ["4794", "4800", "4802", "4804", "4813"],
  "4790": ["4797", "4799", "4800", "4802", "4804", "4810", "4824", "4825", "4827", "4835", "4837", "4840"],
  "4791": ["4798", "4799", "4800", "4802", "4804", "4811", "4824", "4825", "4827", "4835", "4837", "4840"],
  "3440": ["4795", "4799", "4812"],
  "4845": ["4835", "4837", "4840"],
  "4846": ["4835", "4837", "4840"],
  "4847": ["4835", "4837", "4840"],
  "3430": ["4891", "4892", "4893", "4894", "4895", "4908"],
  "3431": ["9751", "9752", "3934", "3935"], // + nafkah anak oleh ibu (6h): kenaikan bagian ayah
  "3432": ["9753", "9754"],
  "3433": ["9753", "9754"],
  "3434": ["9757", "9758"],
  "3435": ["9753", "9754", "9755", "9756"],
  // kelalaian kewajiban suami/istri (1e): tiap tuntutan dicetak hanya bila isiannya terisi; kewajiban lain (3706) tidak terbaca mesin
  "3441": ["3720", "3721"],
  "3442": ["3722", "3723"],
  "3443": ["3724", "3725"],
  "3444": ["3724", "3725"],
  "3445": ["3724", "3725"],
  "3446": ["3724", "3725"],
  "3447": ["3724", "3725", "3732", "3733"],
  "3448": ["3728", "3729"],
};
/** Pemicu tuntutan yang bagian bersyaratnya dipakai blangko (closure = semua variabel yang dicapai dari penanda blangko). */
export function tuntutanAktif(closure: ReadonlySet<string>, katalog: ReadonlyMap<string, unknown>): Set<string> {
  return new Set(Object.entries(BAGIAN_BERSYARAT).filter(([p, bag]) => katalog.has(p) && bag.some((v) => closure.has(v))).map(([p]) => p));
}
/**
 * Pemicu tuntutan sebuah isian DI BLANGKO INI: hanya tuntutan yang aktif (bagian bersyaratnya dipakai blangko). Isian bersama
 * (nama anak, dasar kemampuan, waktu bayar) yang tertulis langsung tidak pernah diberi tuntutan - ia juga dipakai isi tetap blangko.
 */
export function tuntutanIsianDi(kode: string, aktif: ReadonlySet<string>, langsung: boolean): string[] {
  const bersama = [...(TUNTUTAN_BERSAMA[kode] || []), ...(TUNTUTAN_BERSAMA_LAIN[kode] || [])];
  if (langsung && bersama.length) return [];
  const semua = [...new Set([...bersama, ...TUNTUTAN_SEMUA.filter((t) => t.isian.includes(kode)).map((t) => t.pemicu)])];
  return semua.filter((p) => aktif.has(p));
}

export const PILIHAN_ALASAN = [
  "F · terus-menerus berselisih dan bertengkar",
  "A · zina, mabuk, judi dan F",
  "B · meninggalkan 2 tahun berturut-turut dan F",
  "C · dihukum penjara 5 tahun atau lebih",
  "D · kekejaman atau penganiayaan dan F",
  // 28 Okt: E dan G sempat tidak ada di menu walau kueri [01] di ABT mengenali keduanya (cabang umum A-H) - perkara 627 (stroke).
  "E · cacat badan atau penyakit sehingga tidak dapat menjalankan kewajiban suami/isteri",
  "G · suami melanggar taklik talak",
  "H · murtad (beralih agama)",
];

/**
 * Label bahasa mudah + pilihan + saran. Nama di ABT tetap; ini hanya tampilan. {P}/{T} diganti sebutan pihak
 * perkara (Penggugat/Pemohon, Tergugat/Termohon). opsi = pilihan bernilai: layar menampilkan label, ABT menyimpan nilai.
 */
const RAMAH: Record<string, { nm: string; pil?: string[]; saran?: string; opsi?: Array<{ nilai: string; label: string }> }> = {
  "8503": { nm: "Alasan perceraian", pil: PILIHAN_ALASAN, saran: PILIHAN_ALASAN[0] },
  "5227": { nm: "Rincian alasan cerai (sesuai gugatan)" },
  "0222": { nm: "Awal perselisihan", pil: ["awal tahun 2024", "tahun 2023", "akhir tahun 2024"] },
  "7035": { nm: "Yang meninggalkan rumah bersama", pil: ["Tergugat", "Penggugat"] },
  "0246": { nm: "Pisah rumah sejak", pil: ["bulan Januari 2025", "awal tahun 2025", "akhir tahun 2024"] },
  "9944": { nm: "Lama pisah rumah" },
  "1268": {
    nm: "Upaya damai oleh keluarga",
    // 27 Okt: empat pilihan pendamai (keluarga / aparat / keduanya / lainnya) - kalimat tetap, hanya pelakunya berganti.
    pil: [
      "pihak keluarga telah berusaha mendamaikan Penggugat dan Tergugat, namun tidak berhasil",
      "aparat pemerintah desa/kelurahan dan tokoh masyarakat setempat telah berusaha mendamaikan Penggugat dan Tergugat, namun tidak berhasil",
      "pihak keluarga serta aparat pemerintah desa/kelurahan dan tokoh masyarakat setempat telah berusaha mendamaikan Penggugat dan Tergugat, namun tidak berhasil",
      "pihak lain telah berusaha mendamaikan Penggugat dan Tergugat, namun tidak berhasil",
      "belum pernah didamaikan oleh pihak keluarga",
    ],
  },
  "0007": { nm: "Anak dari pernikahan ini", saran: "belum dikaruniai anak" },
  "1006": { nm: "Tempat tinggal setelah menikah", saran: "di rumah orang tua Penggugat" },
  "1267": { nm: "Masih berkomunikasi atau tidak", pil: ["sudah tidak berkomunikasi", "masih berkomunikasi"] },
  "7139": {
    nm: "Beracara secara elektronik",
    opsi: [
      { nilai: "1", label: "E-Litigasi penuh (Tergugat ber-email)" },
      { nilai: "2", label: "E-Litigasi hybrid (diunggah Panitera Sidang)" },
    ],
  },
  "8536": { nm: "Putusan pidana {T} (nomor, tanggal, lama hukuman)" },
  "0227": { nm: "Tanggal {T} berpindah agama" },
  "0156": { nm: "Nama kantor advokat {P}" },
  "8537": { nm: "Nama advokat {P}" },
  "8538": { nm: "Alamat kantor advokat {P}" },
  "8539": { nm: "Nomor register surat kuasa {P}" },
  "0132": { nm: "Tanggal register surat kuasa {P} di kepaniteraan" },
  "0184": { nm: "Tanggal surat kuasa {P}" },
  "8892": { nm: "Pengadilan Tinggi tempat advokat {P} disumpah", saran: "Pengadilan Tinggi Sulawesi Tengah" },
  "0157": { nm: "Nama kantor advokat {T}" },
  "0185": { nm: "Tanggal surat kuasa {T}" },
  "0661": { nm: "Nomor penetapan prodeo" },
  "0663": { nm: "Tanggal penetapan prodeo" },
  "8564": { nm: "Tanggal pengumuman panggilan ghaib pertama dan kedua", saran: "22 Januari 2026 dan 24 Februari 2026" },
  "0670": { nm: "Media pengumuman panggilan ghaib", saran: "siaran RRI Pro 1 Palu 90,8 FM" },
  "8436": { nm: "Kesimpulan {P}", saran: "tetap pada gugatan semula untuk bercerai dengan Tergugat" },
  "8437": { nm: "Kesimpulan {T}" },
  "8433": { nm: "Alasan pencabutan perkara" },
  "7178": { nm: "Alasan panggilan dianggap tidak patut" },
  "0182": { nm: "Tanggal izin kuasa insidentil" },
  "0183": { nm: "Tanggal izin kuasa insidentil {T}" },
  "8894": { nm: "Nama penerima kuasa insidentil" },
  "8895": { nm: "Hubungan penerima kuasa dengan {P}" },
  "8896": { nm: "Nomor izin Ketua Pengadilan" },
  "9120": { nm: "Panggilan ulang karena kuasa insidentil tidak sah" },
  "9123": { nm: "Sebab kuasa insidentil tidak sah (huruf a sampai d)" },
  "9125": { nm: "Keadaan kuasa insidentil tidak sah" },
  "0303": { nm: "Tanggal pengumuman" },
  "1214": { nm: "Alat bukti surat {P}" },
  "9911": { nm: "Alat bukti surat {T}" },
  "1154": { nm: "Nomor surat permintaan bantuan panggilan" },
  "1232": { nm: "Tanggal surat" },
  "5230": { nm: "Ongkos panggilan permintaan bantuan" },
  "8712": { nm: "Nomor dan tanggal surat teguran panitera" },
  "9134": { nm: ISIAN_OPSIONAL["9134"] },
  "8713": { nm: "Batas waktu menambah panjar" },
  "8714": { nm: "Nomor dan tanggal laporan panjar tidak ditambah" },
  "8729": { nm: "Penilaian keterangan saksi dan fakta yang tidak terbukti" },
  "8899": { nm: "Pokok kesepakatan perdamaian sebagian" },
  "8901": { nm: "Amar kesepakatan perdamaian sebagian (satu butir per baris)" },
  "8902": { nm: "Isi pasal kesepakatan perdamaian sebagian" },
  /* === F21 17 Okt: isian tangan paket hak asuh anak (9300-9310), pembatalan perkawinan (9320-9331), ekonomi syariah (9340-9355) === */
  // Hak asuh anak: yang lain (9300-9302, 9304, 9306, 9308) otomatis dari SIPP.
  "9303": { nm: "Identitas anak (nama, tempat dan tanggal lahir; satu anak satu baris)" },
  "9305": { nm: "Keadaan pengasuhan anak saat ini (boleh dikosongkan, nanti memakai kalimat bawaan)" },
  "9307": { nm: "Pilihan anak yang sudah mumayyiz di persidangan" },
  "9309": { nm: "Mengapa pemegang hak asuh tidak dapat menjamin keselamatan anak" },
  "9310": { nm: "Pertimbangan penolakan hak asuh" },
  // Pembatalan perkawinan: 9320 mengubah dasar hukum otomatis 9321, 9322 dan 9331.
  "9320": {
    nm: "Alasan pembatalan perkawinan",
    pil: [
      "A · suami berpoligami tanpa izin pengadilan",
      "B · istri masih terikat perkawinan lain atau masih dalam masa iddah",
      "C · pernikahan dilakukan di bawah umur",
      "D · pernikahan tanpa wali atau dengan wali yang tidak berhak",
      "E · pernikahan di bawah paksaan",
      "F · penipuan atau salah sangka mengenai diri suami atau istri",
      "G · melanggar larangan kawin",
    ],
  },
  "9324": { nm: "Kedudukan {P} (mis. ayah kandung {T}, istri pertama, Kepala KUA; kosong = suami atau istri {T})" },
  "9326": { nm: "Waktu dan tempat perkawinan (kosong = dari SIPP)" },
  "9328": { nm: "Akta nikah (nomor, tanggal, KUA penerbit; kosong = dari SIPP)" },
  "9329": { nm: "Fakta alasan pembatalan yang terbukti di persidangan" },
  "9330": { nm: "Pertimbangan penolakan pembatalan perkawinan" },
  // Ekonomi syariah gugatan sederhana: 9341 mengubah 9342-9344 (angka murni, terbilang, angka bertitik).
  "9340": { nm: "Akad yang disengketakan (jenis akad, nomor, tanggal)" },
  "9341": { nm: "Jumlah kewajiban {T} yang dikabulkan (rupiah, angka saja)" },
  "9345": { nm: "Fakta wanprestasi (sejak kapan tidak membayar, somasi, sisa kewajiban)" },
  "9346": { nm: "Pertimbangan penolakan gugatan" },
  "9347": { nm: "Wakil atau kuasa {P} yang berbadan hukum (nama, jabatan, dasar penunjukan)" },
  "9348": { nm: "Wakil atau kuasa {T} yang berbadan hukum (nama, jabatan, dasar penunjukan)" },
  "9352": { nm: "Isi kesepakatan perdamaian di hadapan hakim (pasal demi pasal)" },
  "9353": { nm: "Tanggal kesepakatan perdamaian" },
  "9354": { nm: "Pihak yang menanggung biaya perkara menurut kesepakatan", pil: ["Penggugat", "Tergugat", "kedua belah pihak secara tanggung renteng"] },
  "9355": { nm: "Pokok jawaban {T} (satu kalimat)" },
  /* === AKHIR F21 === */
  /* === I7 17 Okt: paket varian (pembatalan [01]/[01a]/[01b], hak asuh [03a], harta bersama [01a]) === */
  "9432": { nm: "Fakta pengasuhan anak oleh {T} (dari bukti dan saksi; kosong = kalimat bawaan)" },
  "9434": { nm: "Objek rekonvensi yang ditetapkan sebagai harta bersama (satu per baris; kosong = seluruh objek gugatan rekonvensi)" },
  /* === AKHIR I7 === */
  /* === I8 17 Okt: cerai ditolak kontradiktoir [03a] === */
  "9501": { nm: "Penilaian jawaban dan bukti {T} (bantahan apa yang didukung bukti atau saksi, dan mengapa melemahkan dalil {P}; kosong = titik-titik)" },
  /* === AKHIR I8 === */
  /* === I9 17 Okt: putusan sela dan penetapan sita memakai isian yang SAMA dengan BAS sidang insidentil (blangko 97 Sita, @ 2a/@ 2b) === */
  "9162": { nm: "Objek yang dimohonkan untuk disita (satu per baris)" },
  "9163": { nm: "Alasan permohonan sita" },
  "9164": { nm: "Tanggapan {T} atas permohonan sita (dari jawaban atau sidang insidentil)" },
  /* === AKHIR I9 === */
  /* === F22 17 Okt: pencegahan perkawinan (9460-9470), wasiat (9475-9489), ekonomi syariah acara biasa (9490-9493) === */
  // Pencegahan: 9463 (huruf alasan) mengubah dasar hukum dan bunyi norma otomatis (9464, 9465); nama calon suami memakai isian lama 1029.
  "9460": { nm: "Nama calon istri (nama lengkap binti ...; nama calon suami diisi di kolom nama calon suami)" },
  "9461": { nm: 'Wilayah KUA tempat perkawinan akan dilangsungkan (tulis "Kecamatan ..., Kabupaten ...")' },
  "9462": { nm: "Kedudukan {P} terhadap calon mempelai (mis. ayah kandung calon istri, wali nikah, istri sah calon suami, Pegawai Pencatat Nikah KUA ...)" },
  "9463": {
    nm: "Alasan pencegahan perkawinan (pilih satu huruf)",
    pil: [
      "A · calon mempelai masih terikat perkawinan",
      "B · calon mempelai di bawah umur",
      "C · larangan nasab, semenda, atau sepersusuan",
      "D · calon istri masih dalam masa iddah",
      "E · beda agama",
      "F · talak tiga atau li'an",
      "G · tanpa persetujuan atau izin yang disyaratkan",
      "H · calon mempelai di bawah pengampuan",
    ],
  },
  "9466": { nm: "Fakta alasan pencegahan yang terbukti (uraian singkat dari bukti, saksi, dan keterangan calon mempelai)" },
  "9467": { nm: "Pertimbangan mengapa alasan pencegahan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak)" },
  "9468": { nm: "Pokok keterangan calon mempelai di persidangan (satu kalimat)" },
  "9469": { nm: "Waktu dan tempat perkawinan yang ternyata sudah dilangsungkan" },
  "9470": { nm: "Alat bukti surat {P} (daftar bukti P.1 dst.; kosong = tanpa daftar)" },
  // Wasiat: 9475 (huruf pokok tuntutan) mengubah dasar hukum, bunyi norma, dan amar pokok otomatis (9476, 9477, 9484).
  "9475": {
    nm: "Pokok tuntutan wasiat (pilih satu huruf)",
    pil: [
      "A · wasiat melebihi sepertiga harta peninggalan",
      "B · wasiat kepada ahli waris tanpa persetujuan ahli waris lain",
      "C · syarat pewasiat atau bentuk wasiat tidak terpenuhi",
      "D · harta yang diwasiatkan bukan milik pewasiat",
      "E · wasiat batal (Pasal 197 KHI)",
      "F · pengesahan wasiat dan penyerahan objek wasiat",
      "G · wasiat wajibah",
    ],
  },
  "9478": { nm: 'Bentuk dan tanggal wasiat (mis. "secara tertulis tertanggal ... di hadapan 2 (dua) orang saksi" atau "dengan akta Notaris ... Nomor ...")' },
  "9479": { nm: "Objek wasiat (benda atau manfaat yang diwasiatkan: objek, bukti hak, luas, letak, dan batas-batas)" },
  "9480": { nm: "Penerima wasiat (nama atau sebutan; kosong = otomatis)" },
  "9482": { nm: "Fakta pokok tuntutan yang terbukti (uraian singkat dari bukti dan saksi)" },
  "9483": { nm: "Pertimbangan mengapa dalil gugatan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak)" },
  "9485": { nm: "Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak (untuk putusan tidak dapat diterima karena kurang pihak)" },
  "9486": { nm: "Kedudukan {P} (mis. ahli waris dari pewasiat, penerima wasiat, anak angkat pewasiat)" },
  "9487": { nm: "Kedudukan {T} (mis. penerima wasiat, ahli waris lain yang menguasai objek wasiat)" },
  "9488": { nm: "Alat bukti surat {P} (daftar bukti P.1 dst.; kosong = tanpa daftar)" },
  "9489": { nm: "Alat bukti surat {T} (daftar bukti T.1 dst.; kosong = tanpa daftar)" },
  // Ekonomi syariah acara biasa (akad, kewajiban, wanprestasi, pertimbangan tolak memakai isian 9340-9346 paket gugatan sederhana).
  "9490": { nm: "Klausula arbitrase dalam akad (pasal akad dan lembaga arbitrase yang dipilih)" },
  "9491": { nm: "Pokok eksepsi {T} (satu kalimat)" },
  "9492": { nm: "Alat bukti surat {P} (daftar bukti P.1 dst.: akad, jadwal angsuran, somasi, ...)" },
  "9493": { nm: "Alat bukti surat {T} (daftar bukti T.1 dst.)" },
  /* === AKHIR F22 === */
  /* === I15 18 Okt: penguasaan anak (jenis 349; 9591 dan 9593 otomatis) === */
  "9590": { nm: "Keadaan penguasaan anak yang sebenarnya saat ini (penguasaan faktual: siapa yang menguasai anak, sejak kapan, dan di mana; dari bukti dan saksi; kosong = kalimat bawaan)" }, // I20 18 Okt: faktual
  "9592": { nm: 'Tempat tinggal anak senyatanya (satu kalimat, mis. "bertempat tinggal di Desa ..."; kosong = wilayah hukum Pengadilan ini)' },
  /* === AKHIR I15 === */
  /* === I20 18 Okt: penguasaan anak 6b revisi - 9590 kini penguasaan FAKTUAL; saklar penyerahan anak 9720 (1 = diminta, 0 = tidak, 2 = ditetapkan ex officio, keputusan 28); alasan petitum selebihnya ditolak 9726 === */
  "9720": {
    nm: "Apakah gugatan meminta {T} menyerahkan anak?",
    opsi: [
      { nilai: "1", label: "Ya, diminta dalam gugatan" },
      { nilai: "0", label: "Tidak diminta" },
      { nilai: "2", label: "Tidak diminta, tetapi ditetapkan oleh Hakim karena jabatannya (Buku II 2026)" },
    ],
  },
  "9726": { nm: "Alasan sebagian petitum ditolak (untuk putusan dikabulkan sebagian; kosong = kalimat bawaan)" },
  /* === AKHIR I20 === */
  /* === I23 18 Okt: nafkah anak (folder 6c; 9751-9759 otomatis). Kosong = bagian itu tidak dituntut dan tidak tercetak. === */
  "9740": { nm: "Nafkah anak ke depan: jumlah setiap bulan (rupiah, angka saja; kosong = tidak dituntut)" },
  "9741": { nm: "Kenaikan nafkah anak setiap tahun (persen, angka 10 sampai 20 saja; kosong = tidak dituntut)" },
  "9742": { nm: "Biaya pendidikan dan kesehatan anak (rincian; kosong = tidak dituntut)" },
  "9743": { nm: "Sita jaminan: objek yang dirinci (letak, luas, batas, sertifikat) dan nomor serta tanggal berita acara sita (kosong = tanpa sita)" },
  "9744": { nm: "Dasar kemampuan {T} dan standar biaya hidup minimal setempat (pekerjaan, penghasilan, UMK atau garis kemiskinan)" },
  "9745": { nm: "Pemotongan langsung dari penghasilan {T}: nama instansi atau perusahaan tempat bekerja (kosong = tanpa pemotongan)" },
  "9746": { nm: "Nafkah lampau anak: jangka waktu (mis. sejak bulan ... sampai bulan ...)" },
  "9747": { nm: "Nafkah lampau anak: jumlah (rupiah dan terbilang, mis. jumlah bulan x besaran)" },
  "9748": { nm: "Fakta pengasuhan dan kelalaian nafkah (berpisah sejak kapan, anak diasuh siapa, tidak diberi nafkah; kosong = kalimat bawaan)" },
  "9749": { nm: "Kedudukan {P} bila bukan ibu atau ayah kandung anak (kosong = ibu atau ayah kandung)" },
  "9750": { nm: "Alasan petitum ditolak (untuk putusan dikabulkan sebagian atau ditolak; kosong = kalimat bawaan)" },
  /* === AKHIR I23 === */
  /* === I25 18 Okt: BAS verstek Izin Poligami (bukti persetujuan istri; 9761 otomatis) dan surat keterangan KUA di bukti Itsbat (9957) === */
  "9760": { nm: "Bukti persetujuan tertulis {T} (istri) yang diajukan {P} (mis. surat pernyataan persetujuan istri bermeterai tanggal ...; kosong = tidak ada bukti yang diajukan)" },
  "0654": { nm: "Nomor surat keterangan dari KUA (mis. surat keterangan nikah tidak tercatat)" },
  "0655": { nm: "Tanggal surat keterangan dari KUA (mis. surat keterangan nikah tidak tercatat)" },
  /* === AKHIR I25 === */
  /* === I26 18 Okt: PAW susunan lengkap [01c] (9762-9767 isian tangan; 9768-9770 otomatis), DK ditolak alasan lain (9771), cerai kumulasi itsbat ditolak (9772) === */
  "9762": { nm: "Ahli waris pengganti: satu anak Pewaris yang meninggal lebih dahulu (satu nama lengkap dengan bin atau binti; harus berpasangan dengan cucu Pewaris; kosong = tidak ada)" },
  "9763": { nm: "Cucu Pewaris, anak dari ahli waris pengganti (nama lengkap dengan bin atau binti; beberapa nama dipisah titik koma; kosong = tidak ada)" },
  "9764": { nm: "Kakek, ayah dari ayah Pewaris (nama lengkap dengan bin; kosong = tidak ada)" },
  "9765": { nm: "Nenek dari pihak ibu Pewaris (nama lengkap dengan binti; kosong = tidak ada)" },
  "9766": { nm: "Nenek dari pihak ayah Pewaris (nama lengkap dengan binti; kosong = tidak ada)" },
  "9767": { nm: "Saudara seibu Pewaris (nama lengkap dengan bin atau binti; beberapa nama dipisah titik koma; kosong = tidak ada)" },
  "9771": { nm: "Alasan yang dikemukakan {P} untuk mendesaknya perkawinan anak (satu frasa tanpa titik akhir, mis. khawatir terjadi pelanggaran norma agama)" },
  "9772": { nm: "Rukun atau syarat nikah yang tidak terbukti (satu kalimat tanpa titik akhir, mis. wali nikah bukan wali yang berhak)" },
  /* === AKHIR I26 === */
  /* === U5 20 Okt: penetapan ahli waris / P3HP, paket ABT u5-ahli-waris (4500-4543). Kosong = bunyi lama blangko dipakai. === */
  "4500": { nm: "Tujuan permohonan bila bukan pencairan dana (frasa sesudah kata untuk, mis. mengurus balik nama sebidang tanah di Desa ...; kosong = otomatis dari pencairan dana atau mengurus harta peninggalan)" },
  "4502": { nm: "Anak angkat Pewaris (nama lengkap dengan bin atau binti; kosong = tidak ada anak angkat)" },
  "4505": {
    nm: "Sikap terhadap anak angkat Pewaris (hanya bila ada anak angkat)",
    opsi: [
      { nilai: "1", label: "Anak angkat dinyatakan berhak atas wasiat wajibah dalam amar (Pasal 209 ayat (2) KHI)" },
      { nilai: "0", label: "Hanya dipertimbangkan, tidak dimuat dalam amar" },
    ],
  },
  "4507": { nm: "Wasiat Pewaris (penerima dan bendanya; kosong = Pewaris tidak meninggalkan wasiat)" },
  "4510": { nm: "Kerabat Pewaris yang tidak beragama Islam (nama dan hubungannya, mis. Budi bin Ali (anak kandung Pewaris); kosong = semua beragama Islam)" },
  "4513": {
    nm: "Keadaan perkawinan Pewaris saat meninggal (pilihan hakim)",
    opsi: [
      { nilai: "1", label: "Berpisah tempat tinggal tetapi belum bercerai - pasangan tetap ahli waris" },
      { nilai: "2", label: "Sudah bercerai sebelum Pewaris meninggal - pasangan bukan ahli waris" },
      { nilai: "0", label: "Perkawinan berlangsung sampai Pewaris meninggal" },
    ],
  },
  "4515": { nm: "Bagian masing-masing ahli waris (hanya bila hakim menetapkannya dalam amar; usulan hitungan KHI, keputusan hakim; kosong = bagian tidak ditetapkan)" },
  "4520": { nm: "Harta peninggalan yang diperoleh selama perkawinan / harta bersama (uraian; kosong = tidak ada pertimbangan harta bersama)" },
  "4534": {
    nm: "Penetapan hanya boleh dipakai untuk tujuan permohonan?",
    opsi: [
      { nilai: "1", label: "Ya, dibatasi untuk tujuan permohonan (dimuat dalam amar)" },
      { nilai: "0", label: "Tidak dibatasi" },
    ],
  },
  "4540": { nm: "Saudara Pewaris yang meninggal lebih dahulu (nama lengkap dengan bin atau binti; harus berpasangan dengan anaknya di isian berikut; kosong = tidak ada)" },
  "4541": { nm: "Anak dari saudara itu / keponakan Pewaris, ahli waris pengganti (nama lengkap dengan bin atau binti; beberapa dipisah titik koma)" },
  /* === AKHIR U5 === */
  /* === I28 18 Okt: hibah (9790-9810), wakaf (9820-9841), penetapan mafqud (9860-9875). 9791-9792, 9797, 9800, 9821-9822, 9830, 9866-9867, 9874 otomatis. Kosong = bagian itu tampil titik-titik di ABT. === */
  "9790": {
    nm: "Pokok tuntutan hibah (pilih satu huruf)",
    pil: [
      "A · menarik kembali hibah orang tua kepada anak",
      "B · hibah melebihi sepertiga harta penghibah",
      "C · syarat penghibah tidak terpenuhi",
      "D · objek bukan hak penghibah",
      "E · hibah saat sakit tanpa persetujuan ahli waris",
      "F · pengesahan hibah",
      "G · hibah diperhitungkan sebagai warisan",
    ],
  },
  "9793": { nm: 'Penghibah (nama lengkap bin atau binti; bila telah meninggal tulis "almarhum" atau "almarhumah")' },
  "9794": { nm: 'Bentuk dan tanggal hibah (mis. "secara lisan pada tanggal ... di hadapan 2 (dua) orang saksi" atau "dengan akta hibah di hadapan PPAT ... Nomor ...")' },
  "9795": { nm: "Objek hibah (benda yang dihibahkan: bukti hak, luas, letak, dan batas-batas)" },
  "9796": { nm: "Penerima hibah (nama atau sebutan; kosong = otomatis)" },
  "9798": { nm: "Fakta pokok tuntutan yang terbukti (uraian singkat dari bukti dan saksi)" },
  "9799": { nm: "Pertimbangan mengapa dalil gugatan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak)" },
  "9801": { nm: "Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak (untuk putusan tidak dapat diterima karena kurang pihak)" },
  "9802": { nm: "Kedudukan {P} (mis. penghibah, penerima hibah, ahli waris dari penghibah)" },
  "9803": { nm: "Kedudukan {T} (mis. penerima hibah, ahli waris lain yang menguasai objek hibah)" },
  "9804": { nm: "Alat bukti surat {P} (daftar bukti P.1 dst.; kosong = tanpa daftar)" },
  "9805": { nm: "Alat bukti surat {T} (daftar bukti T.1 dst.; kosong = tanpa daftar)" },
  "9806": { nm: "Kedudukan Pemohon hibah (mis. penghibah, penerima hibah, ahli waris penghibah)" },
  "9807": { nm: "Fakta yang terbukti (uraian singkat dari bukti dan saksi: hibah, syarat penghibah, objek milik penghibah)" },
  "9808": { nm: "Pertimbangan mengapa dalil permohonan tidak terbukti atau tidak beralasan hukum (untuk penetapan ditolak)" },
  "9809": { nm: "Sebab permohonan tidak dapat diterima (mis. objek hibah dipersengketakan pihak lain)" },
  "9810": { nm: "Alat bukti surat Pemohon (daftar bukti P.1 dst.; kosong = tanpa daftar)" },
  "9820": {
    nm: "Pokok tuntutan wakaf (pilih satu huruf)",
    pil: [
      "A · pengesahan wakaf dan penyerahan kepada Nazhir",
      "B · wakaf tidak sah",
      "C · pengalihan wakaf yang dilarang",
      "D · perubahan peruntukan tanpa izin",
      "E · wakaf wasiat melebihi sepertiga",
      "F · perintah melaksanakan wakaf wasiat",
    ],
  },
  "9823": { nm: 'Wakif (nama lengkap bin atau binti; bila telah meninggal tulis "almarhum" atau "almarhumah")' },
  "9824": { nm: "Nazhir (nama perseorangan, organisasi, atau badan hukum Nazhir)" },
  "9825": { nm: 'Bentuk dan tanggal ikrar wakaf (mis. "dengan Akta Ikrar Wakaf Nomor ... tanggal ... di hadapan PPAIW ..." atau "dengan ikrar lisan pada tanggal ... di hadapan 2 (dua) orang saksi")' },
  "9826": { nm: "Harta benda wakaf (bukti hak, luas, letak, dan batas-batas)" },
  "9827": { nm: "Peruntukan wakaf (mis. sarana ibadah, sarana pendidikan, pemakaman)" },
  "9828": { nm: "Fakta pokok tuntutan yang terbukti (uraian singkat dari bukti dan saksi)" },
  "9829": { nm: "Pertimbangan mengapa dalil gugatan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak)" },
  "9831": { nm: "Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak (untuk putusan tidak dapat diterima karena kurang pihak)" },
  "9832": { nm: "Kedudukan {P} (mis. Nazhir, ahli waris dari Wakif, penerima wasiat wakaf)" },
  "9833": { nm: "Kedudukan {T} (mis. ahli waris Wakif yang menguasai objek wakaf, pihak yang membeli objek wakaf)" },
  "9834": { nm: "Alat bukti surat {P} (daftar bukti P.1 dst.; mis. Akta Ikrar Wakaf, sertifikat wakaf; kosong = tanpa daftar)" },
  "9835": { nm: "Alat bukti surat {T} (daftar bukti T.1 dst.; kosong = tanpa daftar)" },
  "9836": { nm: "Kedudukan Pemohon wakaf (mis. Nazhir, ahli waris Wakif, penerima wasiat wakaf)" },
  "9837": { nm: "Fakta yang terbukti (wajib: ikrar sebelum 15 Desember 2006, belum terdaftar, dan siapa yang menguasai)" },
  "9838": { nm: "Pertimbangan mengapa dalil permohonan tidak terbukti atau tidak beralasan hukum (untuk penetapan ditolak)" },
  "9839": { nm: "Sebab permohonan tidak dapat diterima (mis. objek wakaf dipersengketakan pihak lain)" },
  "9840": { nm: "Alat bukti surat Pemohon (daftar bukti P.1 dst.; kosong = tanpa daftar)" },
  "9841": { nm: "Pihak yang menguasai harta benda wakaf (mis. ahli waris Wakif, Nazhir)" },
  "9860": { nm: "Nama orang yang hilang (nama lengkap bin atau binti)" },
  "9861": { nm: "Kedudukan Pemohon terhadap orang yang hilang (mis. istri, suami, anak, ahli waris)" },
  "9862": { nm: "Tempat tinggal dan waktu terakhir orang itu diketahui (kapan pergi, ke mana, kabar terakhir)" },
  "9863": { nm: "Upaya pencarian yang telah dilakukan (satu kalimat)" },
  "9864": { nm: "Lama orang yang hilang tidak ada kabar (mis. 5 (lima) tahun, dihitung sampai hari penetapan)" },
  "9865": {
    nm: "Kepentingan Pemohon (pilih satu huruf)",
    pil: ["A · pembagian harta bersama", "B · pewarisan", "C · kepentingan lain"],
  },
  "9868": { nm: "Cara dan jangka waktu pengumuman (mis. papan pengumuman 14 hari; bila ada media massa tulis juga)" },
  "9869": { nm: "Hasil pengumuman (apakah ada yang memberi kabar atau melapor sejak pengumuman)" },
  "9870": { nm: "Fakta yang terbukti (uraian singkat dari bukti dan saksi: kepergian, tidak ada kabar, pencarian)" },
  "9871": { nm: "Pertimbangan mengapa dalil permohonan tidak terbukti atau tidak beralasan hukum (untuk penetapan ditolak)" },
  "9872": { nm: "Sebab permohonan tidak dapat diterima (mis. Pemohon tidak berkepentingan, tempat tinggal terakhir di luar wilayah)" },
  "9873": { nm: "Alat bukti surat Pemohon (daftar bukti P.1 dst.; mis. surat keterangan hilang dari kepolisian atau desa; kosong = tanpa daftar)" },
  "9875": { nm: "Tanggal berlaku mati secara hukum (opsional; kosong = sejak penetapan diucapkan)" },
  /* === AKHIR I28 === */
  // W3b 21 Okt: label dan pilihan isian blangko Derry baru gelombang 3 (3800-3999).
  ...RAMAH_W3B,
  /* === U2 20 Okt: keputusan majelis atas tuntutan akibat perceraian (nafkah anak, hak asuh, iddah, mut'ah, madliyah, harta bersama) === */
  "4100": { nm: "Keputusan atas tuntutan hak asuh anak (hadhanah)", pil: ["dikabulkan seluruhnya", "dikabulkan sebagian", "ditolak", "tidak dapat diterima", "diberikan secara ex officio (tidak dituntut)"] },
  "4101": { nm: "Keputusan atas tuntutan nafkah anak", pil: ["dikabulkan seluruhnya", "dikabulkan sebagian", "ditolak", "tidak dapat diterima", "diberikan secara ex officio (tidak dituntut)"] },
  "4102": { nm: "Keputusan atas nafkah iddah", pil: ["dikabulkan seluruhnya", "dikabulkan sebagian", "ditolak", "tidak dapat diterima", "diberikan secara ex officio (tidak dituntut)"] },
  "4103": { nm: "Keputusan atas mut'ah", pil: ["dikabulkan seluruhnya", "dikabulkan sebagian", "ditolak", "tidak dapat diterima", "diberikan secara ex officio (tidak dituntut)"] },
  "4104": { nm: "Keputusan atas nafkah lampau (madliyah)", pil: ["dikabulkan seluruhnya", "dikabulkan sebagian", "ditolak", "tidak dapat diterima"] },
  "4105": { nm: "Keputusan atas tuntutan harta bersama", pil: ["dikabulkan seluruhnya", "dikabulkan sebagian", "ditolak", "tidak dapat diterima"] },
  "4106": { nm: "Keadaan anak (sudah atau belum mumayyiz)", pil: ["belum mumayyiz (belum berumur 12 tahun)", "mumayyiz (berumur 12 tahun atau lebih)"] },
  "4107": { nm: "Dasar kemampuan pemberi nafkah (pekerjaan atau penghasilan; kosong = pekerjaan di SIPP)" },
  "4108": { nm: "Pendapat anak mumayyiz yang didengar di persidangan" },
  "4109": { nm: "Waktu pembayaran akibat cerai", pil: ["sebelum ikrar talak", "sebelum akta cerai", "tidak disyaratkan (istri tidak keberatan)"] },
  /* === AKHIR U2 === */
  /* === W2a 21 Okt: harta bersama, kewarisan, ekonomi syariah - keputusan majelis per tuntutan (paket abt-paket/w2a-kebendaan) === */
  "4780": { nm: "Keputusan atas tuntutan penetapan dan pembagian harta bersama", pil: ["dikabulkan seluruhnya", "dikabulkan sebagian"] },
  "4781": { nm: "Objek yang tidak terbukti sebagai harta bersama (satu objek per baris; kosong = semua objek terbukti)" },
  "4782": { nm: "Bagian masing-masing pihak atas harta bersama (kosong = seperdua; bila lain tulis bagian, titik dua, lalu alasan penyimpangan)" },
  "4783": { nm: "Keputusan atas permohonan sita jaminan", pil: ["sah dan berharga", "ditolak"] },
  "4784": { nm: "Keputusan atas tuntutan uang paksa (dwangsom)", pil: ["ditolak", "dikabulkan"] },
  "4785": { nm: "Keputusan atas tuntutan putusan serta merta", pil: ["ditolak", "dikabulkan"] },
  "4786": { nm: "Utang bersama para pihak yang timbul selama perkawinan (kosong = tidak ada)" },
  "4787": { nm: "Sikap {T} atas tiap objek (satu objek per baris: objek | nomor posita | diakui / diakui berklausul / dibantah | klausul atau alasan)" },
  "4815": { nm: "Keputusan atas tuntutan penetapan (dikabulkan seluruhnya atau sebagian)", pil: ["dikabulkan seluruhnya", "dikabulkan sebagian"] },
  "4816": { nm: "Objek yang tidak terbukti sebagai harta peninggalan (satu objek per baris; kosong = semua objek terbukti)" },
  "4817": { nm: "Pihak yang menguasai harta peninggalan (tulis tidak ada bila tidak dikuasai pihak mana pun; kosong = Tergugat)" },
  "4818": { nm: "Harta bersama pewaris dengan pasangannya yang separuhnya hak pasangan (kosong = tidak ada)" },
  "4819": { nm: "Utang, wasiat dan biaya pengurusan jenazah pewaris yang diperhitungkan lebih dahulu (kosong = tidak ada)" },
  "4842": { nm: "Keputusan atas tuntutan denda, ganti rugi atau ta'widh (sesudah titik dua: rumusan amar bila dikabulkan, alasan bila ditolak)", pil: ["dikabulkan", "ditolak"] },
  "4843": { nm: "Keputusan atas tuntutan penyelesaian jaminan atau agunan (sesudah titik dua: rumusan amar bila dikabulkan, alasan bila ditolak)", pil: ["dikabulkan", "ditolak"] },
  "4844": { nm: "Keputusan atas tuntutan pembatalan akad (sesudah titik dua: rumusan amar bila dikabulkan, alasan bila ditolak)", pil: ["dikabulkan", "ditolak"] },
  /* === AKHIR W2a === */
  /* === W3a 21 Okt === */
  "3600": { nm: "Calon suami (nama lengkap bin ...; kosong = Pemohon laki-laki dari SIPP)", saran: "Isi hanya bila calon suami bukan Pemohon" },
  "3601": { nm: "Calon istri (nama lengkap binti ...; kosong = Pemohon perempuan dari SIPP)", saran: "Isi hanya bila calon istri bukan Pemohon" },
  "3604": { nm: "Wilayah KUA yang menolak (Kecamatan ..., Kabupaten ...)", saran: "Lihat kop surat penolakan Pegawai Pencatat Nikah" },
  "3605": { nm: "Alasan penolakan menurut surat Pegawai Pencatat Nikah", saran: "Kutip singkat dari surat penolakan" },
  "3606": { nm: "Larangan yang dijadikan alasan penolakan (pilih satu huruf)", pil: ["A · masih terikat perkawinan dengan orang lain", "B · belum mencapai umur perkawinan", "C · hubungan darah, semenda atau susuan", "D · masih dalam masa tunggu (iddah)", "E · beda agama", "F · sudah dua kali cerai satu sama lain, talak tiga atau li'an", "G · tanpa persetujuan calon mempelai atau izin orang tua", "H · syarat administrasi belum lengkap"] },
  "3609": { nm: "Fakta hukum mengapa larangan tidak terbukti (untuk putusan dikabulkan)", saran: "Satu klausa dari bukti dan saksi, mis. calon istri lahir pada ... sehingga telah berumur 19 tahun" },
  "3610": { nm: "Fakta hukum larangan yang terbukti (untuk putusan ditolak)", saran: "Satu klausa dari bukti dan saksi" },
  "3611": { nm: "Keterangan Pegawai Pencatat Nikah yang didengar", saran: "Mis. hadir di persidangan dan menerangkan bahwa ...; atau menyerahkan surat tanggal ...; atau tidak hadir" },
  "3612": { nm: "Pokok keterangan calon mempelai di persidangan", saran: "Satu klausa dari berita acara sidang" },
  "3613": { nm: "Alat bukti surat {P} (daftar bukti P.1 dst.)", saran: "Sertakan surat penolakan Pegawai Pencatat Nikah" },
  "3616": { nm: "Pengadilan Agama yang berwenang menurut wilayah KUA yang menolak (untuk Tidak Dapat Diterima)" },
  "3617": { nm: "Fakta keadaan pemberitahuan dan penolakan di KUA (untuk Tidak Dapat Diterima, belum ada penolakan tertulis)", saran: "Satu klausa, mis. belum ada surat penolakan tertulis dari Pegawai Pencatat Nikah" },
  "3620": { nm: "Calon mempelai WNI (nama lengkap; kosong = Pemohon berwarganegara Indonesia dari SIPP)", saran: "Isi hanya bila calon WNI bukan Pemohon" },
  "3621": { nm: "Calon mempelai WNA (nama sesuai paspor; kosong = Pemohon berwarganegara asing dari SIPP)", saran: "Tulis persis seperti di paspor" },
  "3624": { nm: "Negara asal calon mempelai WNA (mis. Malaysia; kosong = dari SIPP)" },
  "3626": { nm: "Pejabat yang menolak memberikan surat keterangan", saran: "Mis. Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan ..., Kabupaten ..." },
  "3627": { nm: "Alasan penolakan menurut surat pejabat", saran: "Kutip singkat dari surat penolakan" },
  "3629": { nm: "Fakta hukum syarat perkawinan telah terpenuhi (untuk putusan dikabulkan)", saran: "Satu klausa dari bukti dan saksi, mis. calon WNA bebas menikah menurut surat keterangan kedutaan negara asalnya" },
  "3630": { nm: "Fakta hukum syarat perkawinan belum terpenuhi (untuk putusan ditolak)", saran: "Satu klausa dari bukti dan saksi" },
  "3631": { nm: "Syarat yang dijadikan alasan penolakan (pilih satu huruf)", pil: ["A · surat keterangan dari negara asal calon WNA belum ada", "B · calon masih terikat perkawinan", "C · belum mencapai umur perkawinan", "D · perbedaan agama", "E · paspor atau izin tinggal bermasalah", "F · syarat lain menurut hukum masing-masing"] },
  "3634": { nm: "Alat bukti surat {P} (daftar bukti P.1 dst.)", saran: "Sertakan paspor, surat keterangan negara asal dan surat penolakan" },
  "3636": { nm: "Keterangan pejabat yang didengar", saran: "Mis. hadir dan menerangkan ...; menyerahkan surat ...; atau tidak hadir" },
  "3637": { nm: "Pokok keterangan calon mempelai di persidangan", saran: "Satu klausa dari berita acara sidang" },
  "3638": { nm: "Fakta penyebab tidak dapat diterima (untuk Tidak Dapat Diterima)", saran: "Satu klausa sesuai blangko: calon WNA beragama ...; belum ada penolakan tertulis; atau kedua calon berwarganegara Indonesia" },
  "3640": { nm: "Nama calon suami atau calon istri {P} (lengkap, bin atau binti)", saran: "Dibaca dari posita bila tertulis; selain itu ketik dari keterangan Pemohon." },
  "3641": { nm: "Umur calon suami atau calon istri {P} (angka tahun)", saran: "Bila di bawah 19 tahun, calon pasangan juga memerlukan dispensasi kawin." },
  "3644": { nm: "Orang tua, wali atau keluarga yang didengar (pertama): nama lengkap bin atau binti" },
  "3645": { nm: "Hubungan orang yang didengar (pertama) dengan {P}", saran: "Mis. ayah kandung, ibu kandung, kakek, nenek, wali, orang yang memelihara." },
  "3646": { nm: "Orang tua, wali atau keluarga yang didengar (kedua): nama lengkap bin atau binti", saran: "Kosongkan bila hanya satu orang yang didengar." },
  "3647": { nm: "Hubungan orang yang didengar (kedua) dengan {P}", saran: "Mis. ibu kandung." },
  "3649": { nm: "Keadaan orang tua {P} (pilih satu)", pil: ["1 · kedua orang tua masih hidup dan mampu menyatakan kehendak", "2 · salah seorang orang tua meninggal dunia", "3 · salah seorang orang tua tidak mampu menyatakan kehendak", "4 · kedua orang tua meninggal dunia", "5 · kedua orang tua tidak mampu menyatakan kehendak"], saran: "Menentukan siapa yang berhak memberi izin menurut Pasal 6 ayat (2), (3), (4) UU 1/1974." },
  "3650": { nm: "Pokok keterangan orang yang didengar di sidang", saran: "Ketik dari berita acara sidang. Kosongkan bila tidak hadir meskipun dipanggil patut." },
  "3651": { nm: "Alasan tidak memberi izin atau belum menyatakan pendapat (tulis \"karena ...\")" },
  "3654": { nm: "Bukti surat {P} (P.1 dan seterusnya)", saran: "KTP dan KK Pemohon, akta kelahiran Pemohon, identitas calon pasangan dan orang yang didengar." },
  "3656": { nm: "Pertimbangan majelis atas keberatan (isi hakim)", saran: "Kabul: mengapa keberatan tidak beralasan hukum. Tolak: mengapa beralasan atau syarat lain tidak terpenuhi." },
  "3657": { nm: "Kesiapan {P} dan calon pasangan (bila dipertimbangkan)", saran: "Pendidikan, pekerjaan, kemampuan membina rumah tangga. Kosongkan bila tidak dipertimbangkan." },
  "3660": { nm: "Tempat dan tanggal lahir anak (tulis \"di ... pada tanggal ...\")", saran: "Dibaca dari posita bila jelas; selain itu ketik dari surat keterangan lahir." },
  "3662": { nm: "Keadaan pencatatan pernikahan {P} (pilih satu)", pil: ["A · pernikahan baru dicatat Pegawai Pencatat Nikah sesudah anak lahir", "B · pernikahan belum dicatat (nikah menurut agama)", "C · pernikahan telah diitsbatkan Pengadilan"], saran: "Menentukan pertimbangan keabsahan pernikahan para Pemohon." },
  "3664": { nm: "Nomor dan tanggal akta nikah atau penetapan itsbat nikah", saran: "Mis. Akta Nikah Nomor ... tanggal ... KUA Kecamatan ..." },
  "3665": { nm: "Sebab anak belum mempunyai akta kelahiran (satu kalimat tanpa titik akhir)" },
  "3666": { nm: "Bukti hubungan darah anak dengan ayah biologis", saran: "Hanya bila anak lahir sebelum pernikahan: mis. \"dibuktikan dengan hasil tes DNA ...\" atau pengakuan dan keterangan saksi." },
  "3668": { nm: "Status anak yang ditetapkan majelis (pilih satu)", pil: ["anak sah dari #3673# karena dilahirkan dalam perkawinan yang sah menurut hukum Islam", "anak sah dari #3673# karena dilahirkan dalam perkawinan yang sah menurut hukum Islam, meskipun pernikahan tersebut baru dicatat setelah anak dilahirkan", "anak yang dilahirkan di luar perkawinan yang sah, yang mempunyai hubungan nasab dan hubungan perdata dengan ibunya dan keluarga ibunya serta hubungan perdata dengan #0098# sebagai ayah biologisnya"], saran: "Putusan majelis. Pilihan ketiga untuk anak yang lahir sebelum pernikahan para Pemohon (Putusan MK 46/PUU-VIII/2010)." },
  "3669": { nm: "Bukti surat {P} (P.1 dan seterusnya)", saran: "KTP, KK, akta nikah atau penetapan itsbat, surat keterangan lahir anak." },
  "3670": { nm: "Pengakuan ayah atas anak", saran: "Hanya bila anak lahir sebelum pernikahan: mis. \"mengakui anak tersebut sebagai anak kandungnya\"." },
  "3671": { nm: "Pertimbangan majelis atas dalil yang tidak terbukti (isi hakim)", saran: "Dalil atau bukti apa yang kurang (blangko Tolak dan Tidak Dapat Diterima)." },
  "3672": { nm: "Tujuan pengesahan (setelah kata \"untuk\")", saran: "Bawaan: pengurusan akta kelahiran dan dokumen kependudukan anak." },
  "3691": { nm: "Kedudukan {P} (isi hanya bila jenis kelamin {P} di SIPP kosong atau keliru)", pil: ["istri", "suami"], saran: "istri" },
  "3694": { nm: "Kewajiban yang dilalaikan {T} (kosong = kewajiban selaku suami atau istri)", pil: ["kewajiban memberi nafkah lahir dan menyediakan tempat kediaman", "kewajiban mengatur urusan rumah tangga dan berbakti lahir batin", "kewajiban tinggal serumah dan memelihara rumah tangga"], saran: "kewajiban memberi nafkah lahir dan menyediakan tempat kediaman" },
  "3696": { nm: "Fakta hukum kelalaian (siapa melalaikan apa, sejak kapan, serumah atau berpisah; kosong = kalimat bawaan)", saran: "{T} tidak memberikan nafkah lahir kepada {P} sejak bulan Maret 2024 dan keduanya telah berpisah tempat tinggal" },
  "3697": { nm: "Sejak kapan kewajiban dilalaikan (kosong = tidak disebut)", pil: ["sejak bulan Maret 2024", "sejak tahun 2023", "sejak awal tahun 2025"] },
  "3699": { nm: "Dalil {T} atau alasan sah (nusyuz, tidak mampu, dibebaskan; kosong = tidak ada)", pil: ["{P} nusyuz karena pergi dari tempat kediaman bersama tanpa izin {T}", "{T} tidak mampu karena tidak berpenghasilan tetap", "{P} telah membebaskan {T} dari kewajiban tersebut"] },
  "3700": { nm: "Nafkah ke depan: jumlah setiap bulan (rupiah dan terbilang; kosong = tidak dituntut atau tidak dikabulkan)", saran: "Rp1.500.000,00 (satu juta lima ratus ribu rupiah)" },
  "3701": { nm: "Nafkah lampau: jangka waktu (mis. sejak bulan ... sampai bulan ...)", saran: "sejak bulan Maret 2024 sampai dengan bulan Juli 2026 (29 bulan)" },
  "3702": { nm: "Nafkah lampau: jumlah (rupiah dan terbilang, jumlah bulan x besaran; kosong = tidak dikabulkan)", saran: "Rp43.500.000,00 (empat puluh tiga juta lima ratus ribu rupiah)" },
  "3703": { nm: "Kiswah (pakaian) untuk {P}: bentuk atau jumlah (kosong = tidak dituntut)", saran: "pakaian yang layak sesuai kebutuhan" },
  "3704": { nm: "Tempat kediaman untuk {P}: bentuk pemenuhan (kosong = tidak dituntut)", saran: "rumah yang layak di wilayah tempat tinggal bersama" },
  "3705": { nm: "Biaya rumah tangga, perawatan dan pengobatan {P} (kosong = tidak dituntut)", saran: "kebutuhan pokok sehari-hari dan biaya berobat" },
  "3706": { nm: "Kewajiban lain bukan uang yang dituntut (kata kerja untuk amar; kosong = tidak dituntut)", pil: ["kembali tinggal serumah dengan {P} di tempat kediaman bersama", "mengatur urusan rumah tangga sebaik-baiknya"], saran: "kembali tinggal serumah dengan {P} di tempat kediaman bersama" },
  "3707": { nm: "Dasar kemampuan {T} dan kebutuhan dasar {P} (pekerjaan, penghasilan, standar biaya hidup setempat)", saran: "{T} berpenghasilan sekitar Rp5.000.000,00 per bulan" },
  "3708": { nm: "Pemotongan langsung dari penghasilan {T}: nama instansi atau perusahaan (kosong = tanpa pemotongan)" },
  "3709": { nm: "Sita jaminan: objek yang dirinci dan nomor serta tanggal berita acara sita (kosong = tanpa sita)" },
  "3710": { nm: "Uang paksa per hari keterlambatan (hanya bila dituntut dan hanya atas kewajiban bukan uang; kosong = tidak dikabulkan)", saran: "Rp100.000,00 (seratus ribu rupiah)" },
  "3711": { nm: "Alasan petitum selebihnya ditolak (putusan dikabulkan sebagian; kosong = kalimat bawaan)" },
  "3712": { nm: "Alasan gugatan ditolak (putusan ditolak; kosong = kalimat bawaan)", pil: ["alat bukti yang diajukan {P} tidak cukup membuktikan bahwa {T} telah melalaikan kewajibannya tanpa alasan yang sah", "{T} terbukti tidak mampu sehingga tidak memenuhi kewajiban bukan karena kelalaian", "{P} terbukti nusyuz sehingga kewajiban {T} tidak berlaku"] },
  "3730": { nm: "Alat bukti surat {P} (daftar bukti P.1 dst.; kosong = tanpa daftar)" },
  "3731": { nm: "Alat bukti surat {T} (daftar bukti T.1 dst.; kosong = tanpa daftar)" },
  "3740": { nm: "Putusan perceraian dan akta cerai (nomor dan tanggal)", saran: "putusan Pengadilan Agama Donggala Nomor 100/Pdt.G/2025/PA.Dgl tanggal 3 Maret 2025 yang telah berkekuatan hukum tetap dan Akta Cerai Nomor 50/AC/2025/PA.Dgl tanggal 20 Maret 2025" },
  "3741": { nm: "Cara perkawinan putus", pil: ["cerai talak", "cerai gugat"], saran: "cerai talak" },
  "3742": { nm: "Tanggal perkawinan putus (ikrar talak atau putusan cerai berkekuatan hukum tetap)", saran: "20 Maret 2025" },
  "3743": { nm: "Masa iddah {P}", pil: ["3 (tiga) kali suci dengan sekurang-kurangnya 90 (sembilan puluh) hari", "90 (sembilan puluh) hari karena tidak haid", "sampai melahirkan karena dalam keadaan hamil", "tidak ada masa iddah karena qobla al dukhul"] },
  "3744": { nm: "Masa iddah saat gugatan diajukan", pil: ["masih berjalan", "telah berakhir"] },
  "3745": { nm: "Keadaan dukhul {P} dan {T}", pil: ["selama menjadi suami istri #0046# dan #0047# telah bergaul sebagaimana layaknya suami istri (bada al dukhul)", "antara #0046# dan #0047# belum pernah terjadi hubungan sebagaimana layaknya suami istri (qobla al dukhul)"] },
  "3746": { nm: "Nusyuz {P}", pil: ["dalam perkara ini tidak ditemukan bukti bahwa #0046# berbuat nusyuz", "#0046# terbukti berbuat nusyuz sehingga tidak berhak atas nafkah iddah, maskan dan kiswah"] },
  "3747": { nm: "Apakah hak-hak ini sudah diputus dalam perkara cerai", pil: ["hak-hak bekas istri yang dituntut dalam perkara ini belum pernah dituntut dan belum pernah diputus dalam perkara perceraian #0046# dan #0047#", "hak-hak bekas istri yang dituntut dalam perkara ini pernah dituntut dalam perkara perceraian #0046# dan #0047# tetapi tidak dipertimbangkan sehingga belum diputus", "hak-hak bekas istri yang dituntut dalam perkara ini telah diputus dalam perkara perceraian #0046# dan #0047#"] },
  "3748": { nm: "Hak yang sudah diputus dalam perkara cerai (kosong = tidak ada)", saran: "nafkah iddah dan mutah dalam putusan Nomor 100/Pdt.G/2025/PA.Dgl" },
  "3749": { nm: "Fakta kepatutan besaran: lama perkawinan, keadaan {P}, penghasilan {T}", saran: "perkawinan {P} dan {T} berlangsung selama 10 tahun dan {P} tidak bekerja" },
  "3750": { nm: "Bantahan atau eksepsi {T} dan tanggapan majelis (kosong = tidak ada)", saran: "bantahan {T} bahwa tuntutan telah daluwarsa tidak beralasan karena tidak ada ketentuan yang membatasi waktu tuntutan tersebut" },
  "3751": { nm: "Maskan (tempat tinggal) selama iddah: jumlah dan rincian (kosong = tidak dikabulkan)", saran: "Rp1.500.000,00 (3 bulan x Rp500.000,00)" },
  "3752": { nm: "Kiswah (pakaian) selama iddah: jumlah dan rincian (kosong = tidak dikabulkan)", saran: "Rp900.000,00 (3 bulan x Rp300.000,00)" },
  "3753": { nm: "Mahar yang masih terhutang: jumlah atau bentuk (kosong = tidak ada)", saran: "Rp5.000.000,00" },
  "3754": { nm: "Sita jaminan untuk biaya hadhanah anak: objek dirinci dan nomor serta tanggal berita acara sita (kosong = tanpa sita)" },
  "3755": { nm: "Alasan petitum atau gugatan ditolak (kalimat sesudah \"Menimbang, bahwa\")", saran: "{P} terbukti nusyuz sehingga tidak berhak atas nafkah iddah, maskan dan kiswah" },
  "3756": { nm: "Waktu pembayaran (kosong = tidak ditentukan)", pil: ["segera setelah putusan ini berkekuatan hukum tetap", "paling lambat 30 (tiga puluh) hari sejak putusan ini berkekuatan hukum tetap"] },
  "3757": { nm: "Alat bukti surat {P} (daftar bukti P.1 dan seterusnya)" },
  "3758": { nm: "Alat bukti surat {T} (daftar bukti T.1 dan seterusnya)" },
  "3790": { nm: "Pihak yang dipanggil untuk didengar (nama lengkap dan jabatan atau hubungan, mis. Kepala Kantor Urusan Agama Kecamatan ... atau ayah kandung Pemohon bernama ...)" },
  "3791": { nm: "Tempat kediaman atau alamat kantor pihak yang dipanggil untuk didengar" },
  /* === AKHIR W3a === */
};
// 27 Okt (w104): label bahasa mudah + pilihan isian perkara selain cerai (itsbat, DK, waris, perwalian, wali adhal, HB, poligami, ...).
gabungRamahW104(RAMAH);

const PEMICU_TEKS: Record<string, string> = {
  "11111": "Penggugat/Pemohon memakai kuasa hukum (terbaca dari SIPP)",
  "11113": "Tergugat/Termohon memakai kuasa hukum (terbaca dari SIPP)",
  "11112": "perkara ini prodeo (terbaca dari SIPP)",
  "11116": "alasan perceraian huruf C dipilih",
  "11117": "alasan perceraian huruf H dipilih",
  "4140": "petitum menuntut hak asuh anak (terbaca dari SIPP)",
  "4141": "petitum menuntut nafkah anak (terbaca dari SIPP)",
  "4142": "petitum menuntut nafkah iddah (terbaca dari SIPP)",
  "4143": "petitum menuntut mut'ah (terbaca dari SIPP)",
  "4144": "petitum menuntut nafkah lampau (terbaca dari SIPP)",
  "4145": "petitum menuntut harta bersama (terbaca dari SIPP)",
  "4788": "petitum menuntut sita jaminan (terbaca dari SIPP)",
  "4789": "petitum menuntut bagian harta bersama selain seperdua (terbaca dari SIPP)",
  "4790": "petitum menuntut uang paksa (terbaca dari SIPP)",
  "4791": "petitum menuntut putusan serta merta (terbaca dari SIPP)",
  "4845": "petitum menuntut denda, ganti rugi atau ta'widh (terbaca dari SIPP)",
  "4846": "petitum menuntut penyelesaian jaminan atau agunan (terbaca dari SIPP)",
  "4847": "petitum menuntut pembatalan akad (terbaca dari SIPP)",
};

/** Keterangan keadaan untuk layar ("muncul karena ..." dan daftar isian yang disembunyikan). */
export const KEADAAN_TEKS: Record<Exclude<Keadaan, "">, string> = {
  kuasaP: "Penggugat/Pemohon memakai kuasa hukum",
  kuasaT: "Tergugat/Termohon memakai kuasa hukum",
  prodeo: "perkara ini prodeo",
  alasanC: "alasan perceraian huruf C dipilih",
  alasanH: "alasan perceraian huruf H dipilih",
  ghaib: "Tergugat/Termohon dipanggil secara ghaib",
  ecourt: "perkara ini terdaftar lewat e-Court",
  insidentil: "ada kuasa insidentil",
};

const BUKTI_KODE: Record<string, "P" | "T"> = { "1214": "P", "9911": "T" };

/** Pemicu ABT per keadaan - nilainya dihitung mesin variabel ABT untuk perkara itu. */
const PEMICU_KEADAAN: Record<string, Keadaan> = { "11111": "kuasaP", "11113": "kuasaT", "11112": "prodeo", "11116": "alasanC", "11117": "alasanH" };
const KEADAAN_PEMICU: Partial<Record<Keadaan, string>> = Object.fromEntries(Object.entries(PEMICU_KEADAAN).map(([k, v]) => [v, k]));

/**
 * I7 18 Okt (revisi): isian 9430 (KUA tempat perkawinan) dan variabel otomatis 9431 TIDAK dipakai lagi - amar/pertimbangan kirim salinan ke Pegawai Pencatat Nikah dibuang dari
 * blangko pembatalan perkawinan. Bila berkas lama masih memuat penandanya, keduanya tidak ditampilkan (bukan isian, bukan otomatis, bukan tak dikenal).
 */
const TIDAK_DIPAKAI = new Set(["9430", "9431", "5009"]); // I25 18 Okt: 5009 (Tempat menikah) tanpa jenis data, tak terisi; bukti penolakan KUA (9956 P.10) kini memakai 5178

/**
 * Keadaan sebuah isian tangan dari namanya di katalog ABT. Nama ABT memang menuliskan syaratnya:
 * "Tgl. Surat Kuasa #0047# (Isi Apabila #0047# Pakai Kuasa)", "TANGGAL PENGUMUMAN PANGGILAN GHAIB ...",
 * "NO KUASA INSIDENTIL: ...", "SEPAKAT BERACARA SECARA ELEKTRONIK". Penanda #111xx# di nama didahulukan.
 */
export function keadaanIsian(namaPolos: string, kode = ""): Keadaan {
  const n = String(namaPolos || "");
  const pem = (n.match(POLA_PEMICU) || [])[1] || "";
  if (pem && PEMICU_KEADAAN[pem]) return PEMICU_KEADAAN[pem];
  if (/insidentil/i.test(n)) return "insidentil";
  if (/prodeo|pembebasan biaya/i.test(n)) return "prodeo";
  if (/ghaib|gaib/i.test(n)) return "ghaib";
  if (/beracara secara elektronik|e-?litigasi|e-?court/i.test(n)) return "ecourt";
  if (/\b(kuasa|advokat|pengacara)\b/i.test(n)) {
    const pihakT = /#0047#|tergugat|termohon/i.test(n);
    const pihakP = /#0046#|penggugat|pemohon/i.test(n);
    return pihakT && !pihakP ? "kuasaT" : "kuasaP";
  }
  return "";
}

/** Isian yang hanya keterangan tambahan (tidak masuk amar/pertimbangan) - pengingat cetak menyebutnya "tidak wajib". */
const TAMBAHAN = new Set(["8436", "8437"]);
const POLA_BAGIAN_PENTING = /amar|pertimbangan|duduk perkara|petitum|mengadili|menimbang|menetapkan/i;
const POLA_BERBAWAAN = /kosong\s*=|bila sipp tidak memuat|bila ada\b|jika ada\b|opsional/i;

export const SEBUTAN_BAWAAN = { P: "Penggugat/Pemohon", T: "Tergugat/Termohon", gugatan: "gugatan/permohonan" };

function polosHtml(s: string): string {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nama ABT -> bahasa mudah: tag dan #111xx# dibuang, sebutan pihak diganti, keterangan dalam kurung disingkat. */
const SINGKATAN = new Set(["SIPP", "ABT", "KTP", "KTP-EL", "NIK", "KK", "PNS", "PPPK", "TNI", "POLRI", "BUMN", "BUMD", "KUA", "RBG", "SEMA", "PERMA", "PA", "PN", "SK", "HP", "WA", "RT", "RW", "I", "II", "III", "IV"]);
/** Nama yang (hampir) seluruhnya huruf kapital -> huruf biasa; singkatan dan #NNNN# dibiarkan. */
function hurufBiasa(t: string): string {
  const huruf = t.replace(/#\d{4,5}#/g, "").replace(/[^A-Za-z]/g, "");
  if (huruf.length < 6) return t;
  const kapital = huruf.replace(/[^A-Z]/g, "").length;
  if (kapital / huruf.length < 0.7) return t;
  const hasil = t.replace(/[A-Za-z][A-Za-z-]*/g, (w) => (SINGKATAN.has(w.toUpperCase()) ? w.toUpperCase() : w.toLowerCase()));
  return hasil.charAt(0).toUpperCase() + hasil.slice(1);
}

export function rapikanNama(nama: string, sebutan: { P: string; T: string; gugatan?: string } = SEBUTAN_BAWAAN): string {
  let t = hurufBiasa(
    polosHtml(nama)
      .replace(/#111\d\d#/g, "")
      // Contoh, petunjuk bawaan dan syarat pengisian hanya memanjangkan label (syaratnya kini diterapkan sendiri).
      .replace(/\s*\((contoh|mis\.?|misal|kosong\s*=|isi apabila|isi bila|bawaan)[^)]*\)/gi, "")
      .replace(/\s+-\s+isian\b.*$/i, "")
      .replace(/,?\s*contoh\s*:.*$/i, "")
      .replace(/^no kuasa insidentil\s*:\s*/i, "")
  )
    .replace(/#0046#/g, sebutan.P)
    .replace(/#0047#/g, sebutan.T)
    .replace(/#0053#/g, sebutan.gugatan || SEBUTAN_BAWAAN.gugatan)
    .replace(/\s+/g, " ")
    .trim();
  // Petunjuk pengisian sesudah titik dua ("Awal Konflik : bulan _ / tahun _") dan keterangan panjang dalam
  // kurung hanya memanjangkan label.
  const sebelumTitikDua = t.split(/\s*:\s/)[0].trim();
  if (sebelumTitikDua.length >= 8 && sebelumTitikDua.length < t.length) t = sebelumTitikDua;
  if (t.length > 60) {
    const inti = t.split(/\s\(/)[0].trim();
    if (inti.length >= 8) t = inti;
  }
  if (t.length > 1 && t === t.toUpperCase() && /[A-Z]{3}/.test(t)) {
    t = t.charAt(0) + t.slice(1).toLowerCase();
  }
  return t.replace(/[\s:_-]+$/, "").trim();
}

/** Kode yang dirujuk sebuah definisi (lewat #NNNN# di kueri/bawaan dan no_var = 'NNNN' di kueri). */
export function rujukan(d: Definisi): string[] {
  const teks = `${d.sql || ""}\n${d.bawaan || ""}`;
  const out = new Set<string>();
  for (const m of teks.matchAll(POLA_REF)) if (m[1] !== d.kode) out.add(m[1]);
  for (const m of teks.matchAll(POLA_NO_VAR)) if (m[1] !== d.kode) out.add(m[1]);
  return [...out];
}

/**
 * Kunci pasangan tanya jawab: "TanyaJwb Saksi 1 P" dan "Keterangan Saksi 1 P" -> "saksi 1 p".
 * Yang berawalan "Keterangan" = daftar butir (dicetak di putusan); selainnya ("TanyaJwb ...", "Jawaban Lisan
 * Tergugat", "Replik Lisan ...") = penyunting tanya jawab ABT.
 */
export function kunciTanyaJawab(nama: string, sebutan: { P: string; T: string } = { P: "Penggugat", T: "Tergugat" }): { kunci: string; peran: "tanyajawab" | "keterangan"; sebutan: string } {
  const p = polosHtml(nama);
  const keterangan = /^keterangan\b/i.test(p);
  const sisa = p.replace(/^(tanya\s*jwb|tanya\s*jawab|keterangan)\s*/i, "").trim();
  const kunci = sisa.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return { kunci, peran: keterangan ? "keterangan" : "tanyajawab", sebutan: sebutSaksi(sisa, sebutan) };
}

/** "Saksi 1 P" -> "Saksi 1 Pemohon" pada permohonan, "Saksi 1 Penggugat" pada gugatan (sebutan menurut nomor alur/jenis, bukan kata). */
function sebutSaksi(sisa: string, sebutan: { P: string; T: string }): string {
  const m = sisa.match(/^Saksi\s*(\d+)\s*([PT])\b/i);
  if (m) return `Saksi ${m[1]} ${m[2].toUpperCase() === "P" ? sebutan.P : sebutan.T}`;
  return sisa;
}

function pihakBuktiDari(k: string, namaPolos: string): "" | "P" | "T" {
  return BUKTI_KODE[k] || (/^alat-alat bukti/i.test(namaPolos) ? "P" : /pembuktian tergugat/i.test(namaPolos) ? "T" : "");
}

function urutanKode(b: ButirIsian, urutanRtf: Map<string, number>): number {
  if (b.khusus === "bukti") return 9000 + (b.pihak === "T" ? 1 : 0);
  if (b.jenis === "tj") return 9500 + (urutanRtf.get(b.kode) ?? 400);
  // Urutan tabel ABT: penanda langsung menurut kemunculannya; isian yang hanya dibaca bagian otomatis menyusul.
  return b.langsung ? urutanRtf.get(b.kode) ?? 0 : 5000;
}

/**
 * Menyusun isian tangan dari penanda RTF x katalog.
 *
 * @param penanda  kode #NNNN# yang ada di RTF, urutan kemunculan
 * @param katalog  definisi per kode (sebanyak mungkin; yang tidak ada dicatat takDikenal)
 */
export function susunIsian(
  penanda: string[],
  katalog: Map<string, Definisi>,
  sebutan: { P: string; T: string; gugatan?: string } = SEBUTAN_BAWAAN
): Susunan {
  const urutanRtf = new Map<string, number>();
  penanda.forEach((k, i) => {
    if (!urutanRtf.has(k)) urutanRtf.set(k, i);
  });
  const dipakaiOleh = new Map<string, Set<string>>();
  const dilihat = new Set<string>();
  const takDikenal: string[] = [];
  const otomatis: Susunan["otomatis"] = [];
  const manual: string[] = [];
  const tumpuk = [...new Set(penanda)];
  while (tumpuk.length) {
    const k = tumpuk.shift() as string;
    if (dilihat.has(k)) continue;
    dilihat.add(k);
    if (TIDAK_DIPAKAI.has(k)) continue; // I7 18 Okt (revisi): 9430 / 9431 tidak dipakai lagi
    const d = katalog.get(k);
    if (!d) {
      if (!/^111\d\d$/.test(k)) takDikenal.push(k);
      continue;
    }
    if (MANUAL[d.jenis]) {
      manual.push(k);
      continue;
    }
    otomatis.push({ kode: k, nama: rapikanNama(d.nama, sebutan), jenis: d.jenis || "", langsung: urutanRtf.has(k) });
    for (const r of rujukan(d)) {
      if (!dipakaiOleh.has(r)) dipakaiOleh.set(r, new Set());
      dipakaiOleh.get(r)!.add(k);
      if (!dilihat.has(r)) tumpuk.push(r);
    }
  }

  // Penyunting tanya jawab: kode "TanyaJwb ..." untuk tiap kunci saksi/pihak (dicari di seluruh katalog).
  const penyunting = new Map<string, string>();
  for (const d of katalog.values()) {
    if (d.jenis !== "tanya_jawab") continue;
    const t = kunciTanyaJawab(d.nama);
    if (t.peran === "tanyajawab" && t.kunci && !penyunting.has(t.kunci)) penyunting.set(t.kunci, d.kode);
  }

  /** Dibaca (sampai 3 lapis) oleh bagian yang tertulis langsung di naskah atau bagian amar/pertimbangan/duduk perkara? */
  const pemakaiPenting = (kode: string): boolean => {
    let lapis = [kode];
    const lewat = new Set<string>([kode]);
    for (let i = 0; i < 3 && lapis.length; i++) {
      const berikut: string[] = [];
      for (const x of lapis) {
        for (const o of dipakaiOleh.get(x) || []) {
          if (lewat.has(o)) continue;
          lewat.add(o);
          if (urutanRtf.has(o) || POLA_BAGIAN_PENTING.test(katalog.get(o)?.nama || "")) return true;
          berikut.push(o);
        }
      }
      lapis = berikut;
    }
    return false;
  };
  const pemicuDipakai = new Map<string, string>();
  const aktifTuntutan = tuntutanAktif(dilihat, katalog);
  const isian: ButirIsian[] = [];
  const tjAda = new Set<string>();
  for (const k of manual) {
    const d = katalog.get(k) as Definisi;
    const jenis = MANUAL[d.jenis];
    const namaPolos = polosHtml(d.nama);
    const pem = (namaPolos.match(POLA_PEMICU) || [])[1] || "";
    if (pem) pemicuDipakai.set(pem, katalog.get(pem)?.nama || "");
    const teknis = /^penanda\b/i.test(namaPolos);
    const pilihanSipp = /kosong\s*=\s*dari\s*sipp/i.test(namaPolos) || /\(otomatis/i.test(namaPolos);
    // Keadaan dari nama: kuasa/prodeo/alasan C-H memakai pemicu ABT yang sama walau namanya tidak bertanda #111xx#.
    const keadaan = keadaanIsian(namaPolos, k);
    const pemKeadaan = KEADAAN_PEMICU[keadaan] || "";
    let pemicuAkhir = pem;
    if (!pemicuAkhir && pemKeadaan && katalog.has(pemKeadaan)) {
      pemicuAkhir = pemKeadaan;
      pemicuDipakai.set(pemKeadaan, katalog.get(pemKeadaan)?.nama || "");
    }
    const r = RAMAH[k];
    const isiSebutan = (x: string) => x.replace(/\{P\}/g, sebutan.P).replace(/\{T\}/g, sebutan.T);
    const bawaanLiteral = d.bawaan && !/#\d{4,5}#/.test(d.bawaan) ? d.bawaan.trim() : "";
    let tj: ButirIsian["tj"] = null;
    if (jenis === "tj") {
      const t = kunciTanyaJawab(d.nama, sebutan === SEBUTAN_BAWAAN ? undefined : sebutan); // tanpa sebutan dari pemanggil: tetap Penggugat/Tergugat
      const kodeSunting = t.peran === "tanyajawab" ? k : penyunting.get(t.kunci) || "";
      // Satu tombol per saksi: pasangan Keterangan/TanyaJwb saksi yang sama tidak diulang.
      if (tjAda.has(t.kunci)) {
        continue;
      }
      tjAda.add(t.kunci);
      tj = { kunci: t.kunci, sebutan: t.sebutan, peran: t.peran, kodeSunting };
    }
    const pihakBukti = pihakBuktiDari(k, namaPolos);
    // 21 Okt (x4): tuntutan isian ini hanya bila bagian bersyarat tuntutan itu dipakai blangko ini (bukan ditetapkan isi tetap blangko).
    const tuntutanK = tuntutanIsianDi(k, aktifTuntutan, urutanRtf.has(k));
    const pemakai = [...(dipakaiOleh.get(k) || [])];
    // Penting: tertulis langsung di naskah, atau dibaca bagian yang tertulis langsung / amar / pertimbangan / duduk
    // perkara. Tambahan: berbawaan ("kosong = ...", "bila SIPP tidak memuat") atau keterangan tambahan (kesimpulan).
    const tingkat: ButirIsian["tingkat"] =
      jenis === "tj" || pihakBukti
        ? "penting"
        : TAMBAHAN.has(k) || POLA_BERBAWAAN.test(namaPolos)
          ? "tambahan"
          : urutanRtf.has(k) || pemakaiPenting(k)
            ? "penting"
            : "tambahan";
    isian.push({
      kode: k,
      nama: r ? isiSebutan(r.nm) : rapikanNama(d.nama, sebutan),
      namaAsli: namaPolos,
      jenis,
      pemicu: pemicuAkhir,
      wajib: !teknis && !pilihanSipp,
      langsung: urutanRtf.has(k),
      bawaan: d.bawaan || "",
      pilihan: (r && r.pil) || [],
      saran: (r && r.saran) || bawaanLiteral,
      dipakaiOleh: pemakai.sort(),
      khusus: pihakBukti ? "bukti" : "",
      pihak: pihakBukti,
      tj,
      keadaan,
      tingkat,
      opsi: (r && r.opsi) || [],
      ...(ISIAN_OPSIONAL[k] ? { opsional: true, labelPengguna: ISIAN_OPSIONAL[k] } : {}),
      ...(ISIAN_MANUAL[k] ? { manual: true, alasanManual: ISIAN_MANUAL[k] } : {}),
      ...(tuntutanK.length ? { tuntutan: tuntutanK, ...(CADANGAN_TUNTUTAN[k] ? { cadangan: CADANGAN_TUNTUTAN[k] } : {}) } : {}),
    });
  }
  // 21 Okt: tuntutan yang isiannya hanya dibaca bagian otomatis (tidak tertulis langsung) - pemicu petitumnya ikut dinilai bot
  // supaya layar tahu tuntutan mana yang diminta. 21 Okt (w25): isian yang tertulis langsung di blangko ikut dihitung - tuntutan yang
  // tidak diminta tetap disembunyikan walau tertulis langsung ("tidak diminta = tidak ada pertimbangan dan form-nya").
  const tuntutan: TuntutanBlangko[] = [];
  for (const t of TUNTUTAN_SEMUA) {
    const isianT = isian.filter((b) => (b.tuntutan || []).includes(t.pemicu)).map((b) => b.kode);
    if (!isianT.length || !katalog.has(t.pemicu)) continue;
    tuntutan.push({ ...t, isian: isianT });
    if (!pemicuDipakai.has(t.pemicu)) pemicuDipakai.set(t.pemicu, katalog.get(t.pemicu)?.nama || "");
  }
  isian.sort((a, b) => urutanKode(a, urutanRtf) - urutanKode(b, urutanRtf) || a.kode.localeCompare(b.kode));

  const pemicu = [...pemicuDipakai.entries()].map(([kode, nama]) => ({
    kode,
    nama: rapikanNama(nama || `Penanda ${kode}`, sebutan),
    keterangan: PEMICU_TEKS[kode] || rapikanNama(nama || "", sebutan).toLowerCase() || `penanda ${kode} menyala`,
  }));
  pemicu.sort((a, b) => a.kode.localeCompare(b.kode));
  otomatis.sort((a, b) => Number(a.langsung) - Number(b.langsung) || (urutanRtf.get(a.kode) ?? 999) - (urutanRtf.get(b.kode) ?? 999));
  return {
    penanda: [...new Set(penanda)],
    isian,
    pemicu,
    otomatis,
    takDikenal,
    ...(tuntutan.length
      ? {
          tuntutan,
          ...(katalog.has(KODE_KUTIPAN_TUNTUTAN) && tuntutan.some((t) => /^414[0-5]$/.test(t.pemicu)) ? { kutipanTuntutan: KODE_KUTIPAN_TUNTUTAN } : {}),
          ...(katalog.has(KODE_KUTIPAN_LAIN) && tuntutan.some((t) => !/^414[0-5]$/.test(t.pemicu)) ? { kutipanLain: KODE_KUTIPAN_LAIN } : {}),
        }
      : {}),
  };
}

/**
 * Isian KEPUTUSAN HAKIM yang tidak ditulis di BAS (20 Okt 2026, temuan pengguna): BAS sidang putusan verstek memuat
 * #4001# AMAR, dan kueri amar membaca #8503# (huruf alasan perceraian), sehingga kartu "Alasan perceraian" ikut tampil
 * di BAS padahal RTF BAS tidak memuatnya dan huruf alasan diputus hakim di PUTUSAN. Isian ABT tersimpan per perkara,
 * jadi amar di BAS tetap membaca nilai yang diisi hakim di putusan - kartunya saja yang tidak ditawarkan ke PP.
 */
export const KEPUTUSAN_HAKIM_BUKAN_BAS = new Set(["8503"]);

/** Buang isian keputusan hakim dari susunan blangko BAS (tidak tampil, tidak dihitung, tidak ditulis dari BAS). */
export function saringIsianBas(susunan: Susunan, jenis: JenisDokumenDerry | ""): Susunan {
  if (jenis !== "bas") return susunan;
  const isian = susunan.isian.filter((b) => !KEPUTUSAN_HAKIM_BUKAN_BAS.has(b.kode));
  if (isian.length === susunan.isian.length) return susunan;
  return { ...susunan, isian };
}

/** Jenis dokumen sebuah folder Derry menurut namanya: put (hakim), bas (PP), rel (juru sita), ptsp. */
export function jenisFolderDerry(nama: string): "put" | "bas" | "rel" | "ptsp" | "" {
  const n = String(nama || "").trim();
  if (!n) return "";
  // I7 17 Okt: folder "terhapus" (blangko yang dipindah paket ABT) bukan blangko aktif - tidak pernah dianggap putusan.
  if (/(^|[\\/])terhapus([\\/]|$)/i.test(n)) return "";
  // Server 17 Okt: folder bernomor ("98 Relaas", "99 PTSP") dan pasangan BAS bernama "<Jenis> - BAS".
  const polos = n.replace(/^\d+[a-z]?\s+/i, "");
  if (/^relaas/i.test(polos)) return "rel";
  if (/^ptsp/i.test(polos)) return "ptsp";
  if (/^(alur\s*\d|bas\b|-\s*bas)/i.test(n) || /\s-\s*bas\s*$/i.test(n)) return "bas";
  return "put";
}

export type JenisDokumenDerry = "put" | "bas" | "rel" | "ptsp";
export type PeranTiruan = "hakim" | "pp" | "js" | "ptsp";

/** Jenis dokumen sebuah folder dari jalur ("derry_briantono/98 Relaas" atau "98 Relaas"); "" bila tak dikenal. */
export function jenisFolderDariJalur(jalur: string): JenisDokumenDerry | "" {
  const potong = String(jalur || "").replace(/^\/+|\/+$/g, "").split("/");
  const nama = potong[0] === "derry_briantono" ? potong[1] || "" : potong[0] || "";
  return jenisFolderDerry(nama);
}

/**
 * Jenis dokumen yang boleh dibuka akun ini (17 Okt 2026, temuan C6) - cermin jenisDokumenBoleh di ekstensi,
 * tetapi dari SESI (golongan akun), bukan dari klien. Keputusan pengguna 9 & 16 Okt:
 *   putusan = hakim, Ketua/Wakil · BAS = PP, panitera, panmud · relaas = juru sita (dan pengganti) · PTSP = PTSP
 * Super Admin/Admin tanpa "Lihat sebagai" = semuanya; dengan sebagaiPeran = satu peran itu saja.
 * Saklar Pengaturan SIPP & ABT menambah: hakim -> BAS, PP -> putusan (relaas tidak pernah).
 */
export function jenisDokumenAkun(o: {
  admin: boolean;
  golongan: readonly string[];
  sebagaiPeran?: PeranTiruan | null;
  saklar?: { hakimBas?: boolean; ppPutusan?: boolean } | null;
}): JenisDokumenDerry[] {
  if (o.admin && !o.sebagaiPeran) return ["put", "bas", "rel", "ptsp"];
  const peran = new Set<PeranTiruan>();
  if (o.admin && o.sebagaiPeran) peran.add(o.sebagaiPeran);
  else {
    for (const g of o.golongan) {
      if (g === "hakim" || g === "pimpinan") peran.add("hakim");
      else if (g === "pp" || g === "panitera" || g === "panmud" || g === "analis-perkara") peran.add("pp");
      else if (g === "jurusita") peran.add("js");
      else if (g === "ptsp") peran.add("ptsp");
    }
  }
  const boleh = new Set<JenisDokumenDerry>();
  if (peran.has("hakim")) {
    boleh.add("put");
    if (o.saklar?.hakimBas === true) boleh.add("bas");
  }
  if (peran.has("pp")) {
    boleh.add("bas");
    if (o.saklar?.ppPutusan === true) boleh.add("put");
  }
  if (peran.has("js")) boleh.add("rel");
  if (peran.has("ptsp")) boleh.add("ptsp");
  return (["put", "bas", "rel", "ptsp"] as const).filter((j) => boleh.has(j));
}

/** Sebutan pihak dari jenis/nomor perkara: Pdt.P dan cerai talak = Pemohon/Termohon. */
export function sebutanPihak(jenisPerkara: string, nomorPerkara: string): { P: string; T: string; gugatan: string } {
  const j = String(jenisPerkara || "").toLowerCase();
  const permohonan = /pdt\.p/i.test(String(nomorPerkara || "")) || /cerai talak|permohonan|itsbat|dispensasi|perwalian|asal usul|ahli waris|poligami|pengangkatan/.test(j);
  return permohonan ? { P: "Pemohon", T: "Termohon", gugatan: "permohonan" } : { P: "Penggugat", T: "Tergugat", gugatan: "gugatan" };
}

/** Folder Derry yang berkasnya paling cocok dengan daftar berkas satu kelompok ABT. */
export function folderPalingCocok(
  berkasKelompok: string[],
  folder: Array<{ nama: string; berkas: string[] }>
): { nama: string; cocok: number } | null {
  const bersih = (s: string) => String(s || "").replace(/\.(rtf|docx?|odt)$/i, "").trim().toLowerCase();
  const diminta = new Set(berkasKelompok.map(bersih).filter(Boolean));
  if (!diminta.size) return null;
  let terbaik: { nama: string; cocok: number } | null = null;
  for (const f of folder) {
    const ada = new Set(f.berkas.map(bersih));
    let cocok = 0;
    for (const b of diminta) if (ada.has(b)) cocok += 1;
    if (cocok > 0 && (!terbaik || cocok > terbaik.cocok)) terbaik = { nama: f.nama, cocok };
  }
  return terbaik;
}

/**
 * Kode yang nilainya dibaca bot untuk satu blangko. Tanpa `semua`: isian tangan + pemicu (cepat); dengan `semua`:
 * seluruh penanda. Tanya-jawab ikut dibaca (kode penanda dan kode penyuntingnya) supaya tanya-jawab yang SUDAH ada
 * di ABT tidak tampil kosong dan "Penting" di peringatan cetak.
 */
export function kodeUntukNilai(susunan: Susunan, semua: boolean): string[] {
  const tj = [...kodeTanyaJawab(susunan)];
  const dasar = semua
    ? [...susunan.penanda, ...susunan.isian.map((b) => b.kode), ...susunan.otomatis.map((o) => o.kode), ...susunan.pemicu.map((p) => p.kode), ...tj]
    : [...susunan.isian.filter((b) => b.jenis !== "tj").map((b) => b.kode), ...susunan.pemicu.map((p) => p.kode), ...tj];
  if (susunan.kutipanTuntutan) dasar.push(susunan.kutipanTuntutan);
  if (susunan.kutipanLain) dasar.push(susunan.kutipanLain);
  return [...new Set(dasar)];
}

/** Kode tanya-jawab (penanda dan penyuntingnya): nilainya tabel, teks kosongnya bukan tanda belum diisi. */
export function kodeTanyaJawab(susunan: Susunan): Set<string> {
  const k = new Set<string>();
  for (const b of susunan.isian) {
    if (b.jenis !== "tj") continue;
    k.add(b.kode);
    if (b.tj?.kodeSunting) k.add(b.tj.kodeSunting);
  }
  return k;
}

export type NilaiPenanda = { status: string; teks: string; nama: string; sebab: string };

/**
 * Status nilai penanda UNTUK LAYAR Blangko Derry (17 Okt 2026, temuan pemeriksaan 1.203.0).
 *
 * Mesin variabel bot meniru ABT: kueri (data_sql/data_sipp) yang memulangkan baris berisi teks
 * kosong berstatus "terisi" - ABT mencetaknya kosong, dan kueri bersarang memakai nilai kosong itu
 * apa adanya, jadi di MESIN tidak diubah. Di layar itu terbaca "terisi" padahal kosong (#9272#
 * telepon kantor: kuerinya sengaja memulangkan '' untuk PA.Dgl). Di sini statusnya menjadi "kosong"
 * beserta sebabnya. Tanya-jawab (tj) dibiarkan: nilainya berupa tabel, teksnya memang kosong.
 */
export function statusNilaiLayar(v: NilaiPenanda, tanyaJawab: boolean): NilaiPenanda {
  if (tanyaJawab || v.status !== "terisi" || String(v.teks ?? "").trim()) return v;
  return { ...v, status: "kosong", sebab: v.sebab || "Kueri ABT tidak memulangkan isi untuk perkara ini (ABT mencetaknya kosong)." };
}
