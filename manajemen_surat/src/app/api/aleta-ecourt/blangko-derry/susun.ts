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
};
export type Keadaan = "" | "kuasaP" | "kuasaT" | "prodeo" | "alasanC" | "alasanH" | "ghaib" | "ecourt" | "insidentil";
export type Susunan = {
  penanda: string[];
  isian: ButirIsian[];
  pemicu: Array<{ kode: string; nama: string; keterangan: string }>;
  otomatis: Array<{ kode: string; nama: string; jenis: string; langsung: boolean }>;
  takDikenal: string[];
};

const MANUAL: Record<string, JenisIsian> = { data_teks: "teks", data_tanggal: "tanggal", tanya_jawab: "tj" };
const POLA_REF = /#(\d{4,5})#/g;
const POLA_NO_VAR = /no_var\s*(?:=|in\s*\()\s*['"]?(\d{4,5})/gi;
const POLA_PEMICU = /#(111\d\d)#/;

/** Urutan tampil isian perceraian (dari rancangan v12); yang tidak disebut mengikuti urutan di RTF. */
const URUTAN = [
  "8503", "5227", "0222", "7035", "0246", "9944", "1268", "0007", "1006", "1267", "7139", "8433", "7178", "8436", "8437", "8536", "0227",
  "0156", "8537", "8538", "0184", "0132", "8892", "0157", "0185", "0661", "0663", "8564", "0670", "0182", "8894", "8895", "8896", "9123", "0303",
];

export const PILIHAN_ALASAN = [
  "F · terus-menerus berselisih dan bertengkar",
  "A · zina, mabuk, judi dan F",
  "B · meninggalkan 2 tahun berturut-turut dan F",
  "C · dihukum penjara 5 tahun atau lebih",
  "D · kekejaman atau penganiayaan dan F",
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
    pil: ["pihak keluarga telah berusaha mendamaikan Penggugat dan Tergugat, namun tidak berhasil", "belum pernah didamaikan oleh pihak keluarga"],
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
};

const PEMICU_TEKS: Record<string, string> = {
  "11111": "Penggugat/Pemohon memakai kuasa hukum (terbaca dari SIPP)",
  "11113": "Tergugat/Termohon memakai kuasa hukum (terbaca dari SIPP)",
  "11112": "perkara ini prodeo (terbaca dari SIPP)",
  "11116": "alasan perceraian huruf C dipilih",
  "11117": "alasan perceraian huruf H dipilih",
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
  const u = URUTAN.indexOf(b.kode);
  if (u >= 0) return u;
  return 100 + (urutanRtf.get(b.kode) ?? 400) + (b.langsung ? 0 : 300);
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
    });
  }
  isian.sort((a, b) => urutanKode(a, urutanRtf) - urutanKode(b, urutanRtf) || a.kode.localeCompare(b.kode));

  const pemicu = [...pemicuDipakai.entries()].map(([kode, nama]) => ({
    kode,
    nama: rapikanNama(nama || `Penanda ${kode}`, sebutan),
    keterangan: PEMICU_TEKS[kode] || rapikanNama(nama || "", sebutan).toLowerCase() || `penanda ${kode} menyala`,
  }));
  pemicu.sort((a, b) => a.kode.localeCompare(b.kode));
  otomatis.sort((a, b) => Number(a.langsung) - Number(b.langsung) || (urutanRtf.get(a.kode) ?? 999) - (urutanRtf.get(b.kode) ?? 999));
  return { penanda: [...new Set(penanda)], isian, pemicu, otomatis, takDikenal };
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
export type PeranTiruan = "hakim" | "pp" | "js";

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
  const peran = new Set<PeranTiruan | "ptsp">();
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
