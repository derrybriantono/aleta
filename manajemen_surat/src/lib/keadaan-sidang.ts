import { alasanTerisi, hasilSidangPutusan } from "@/lib/hasil-sidang";
import type { SaatPengadilan } from "@/lib/waktu-pengadilan";

/**
 * ============================================================================
 * ATURAN KEADAAN SIDANG - SATU TEMPAT, DIPAKAI LAYAR DAN PENGUJIANNYA
 * ============================================================================
 *
 * Seluruh aturan di berkas ini MURNI: masuk data, keluar keputusan. Tidak ada
 * satu pun yang menyentuh DOM, jaringan, maupun basis data.
 *
 * Sebelumnya semuanya berada di dalam aleta-ecourt-sidang.tsx - komponen tiga
 * ribu baris yang tidak dapat dirender di lingkungan pengujian ini - dan
 * pengujiannya memakai SALINAN TANGAN dari tiap aturan.
 *
 * Salinan itu bahaya yang berbeda kelas dari uji yang rapuh: uji yang rapuh
 * PECAH ketika kodenya berubah, dan itu menjengkelkan tetapi jujur. Salinan
 * yang menyimpang justru LOLOS - ia menguji aturan yang tidak pernah dikirim
 * ke siapa pun, sementara aturan yang sungguhan boleh saja salah. Uji yang
 * hijau atas kode yang salah lebih buruk daripada tidak ada uji.
 *
 * Karena itu aturannya dipindahkan ke sini apa adanya - beserta seluruh
 * catatan yang menerangkan sebabnya, sebab catatan itulah yang menjaga
 * aturannya tidak "dirapikan" oleh yang belum tahu ukurannya.
 *
 * Yang TIDAK dipindahkan: apa pun yang menggambar. Warna, lencana, dan tata
 * letak tetap di komponennya - itu tampilan, bukan aturan.
 */
/**
 * Pengelompokan alur perkara, sejalan dengan urutan pada kueri jadwal.
 *
 * Nomor alurnya milik SIPP: 15 gugatan, 16 permohonan, 17 gugatan sederhana,
 * 122 jinayah. Alur lain masuk kelompok terakhir - bukan dihilangkan, karena
 * ringkasan yang jumlahnya tidak sama dengan isi tabel akan dianggap keliru.
 */
export const KELOMPOK_ALUR = [
  { kunci: "gugatan", label: "Gugatan", alur: [15] },
  { kunci: "permohonan", label: "Permohonan", alur: [16] },
  { kunci: "gugatan-sederhana", label: "Gugatan Sederhana", alur: [17] },
  { kunci: "jinayah", label: "Jinayah", alur: [122] },
  { kunci: "lainnya", label: "Lainnya", alur: [] },
] as const;

export type KunciAlur = (typeof KELOMPOK_ALUR)[number]["kunci"];

export function kelompokAlur(alurPerkaraId: number): KunciAlur {
  const cocok = KELOMPOK_ALUR.find((k) => k.alur.includes(alurPerkaraId as never));
  return cocok ? cocok.kunci : "lainnya";
}

/** Sebutan kehadiran menurut kode SIPP. */
export const SEBUTAN_HADIR: Record<number, string> = {
  1: "Semua pihak hadir",
  2: "Penggugat/pemohon saja",
  3: "Tergugat/termohon saja",
  4: "Tidak ada yang hadir",
};

/**
 * ============================================================================
 * POTENSI VERSTEK - DIBACA DARI SIDANG SEBELUMNYA, BUKAN DARI SIDANG INI
 * ============================================================================
 *
 * Verstek dijatuhkan ketika tergugat yang sudah dipanggil patut tidak hadir
 * lagi. Aturan lama membaca kehadiran sidang INI saja - "hanya penggugat yang
 * hadir" - dan itu keliru pada sidang pertama: tergugat yang tidak datang
 * pada sidang pertama BELUM membuka jalan verstek; majelis menunda dan
 * memanggilnya sekali lagi. Yang berpotensi verstek justru sidang SESUDAHNYA:
 * penggugat hadir pada sidang sebelumnya, tergugat tidak, dan hari ini
 * tergugat tidak juga datang.
 *
 * Tiga syarat, semuanya dari data yang sudah ada pada tiap baris jadwal:
 *
 *   1. pada sidang SEBELUMNYA hanya penggugat/pemohon yang hadir (kode 2).
 *      Ini sekaligus memastikan ada sidang sebelumnya - sidang pertama tidak
 *      pernah masuk;
 *   2. tergugat/termohon BELUM PERNAH hadir pada sidang mana pun sebelumnya.
 *      Yang pernah hadir lalu absen diputus contradictoir, bukan verstek.
 *      Ladang ini baru dikirim bot sejak 2.19.4; bila tidak terbaca, syarat
 *      ini dilewati dan yang dibaca hanya sidang sebelumnya;
 *   3. pada sidang INI tergugat tidak (atau belum) hadir: kehadirannya belum
 *      dicatat, atau kembali hanya penggugat. Bila tergugat datang (1 atau 3)
 *      jalannya tertutup; bila tidak ada yang datang (4) pun tertutup -
 *      verstek menuntut penggugat hadir.
 *
 * Tetap disebut "potensi", bukan kesimpulan - keputusannya milik majelis.
 */
export function potensiVerstek(baris: {
  dihadiriOleh: number | null;
  panggilan?: { hadirSebelumnya: number | null; tergugatPernahHadir?: boolean } | null;
}): boolean {
  const sebelumnya = baris.panggilan ? baris.panggilan.hadirSebelumnya : null;
  if (sebelumnya !== 2) return false;
  if (baris.panggilan && baris.panggilan.tergugatPernahHadir === true) return false;
  const hariIni = baris.dihadiriOleh;
  return hariIni === null || hariIni === undefined || hariIni === 2;
}

/**
 * ============================================================================
 * KELOMPOK KOTAK KEADAAN - MENURUT MAKSUDNYA, BUKAN MENURUT SEJARAHNYA
 * ============================================================================
 *
 * Kotak keadaan ditambahkan satu demi satu sepanjang sebulan, dan deretannya
 * mengikuti urutan penambahannya: Retur, Belum dipanggil, Ditunda, Belum ada
 * BAS, Sidang pertama, Hari Putusan, Ikrar Talak, e-Litigasi, Sudah putus,
 * Belum putus, Tidak perlu dipanggil, lalu tiga kotak antrian. Yang membaca
 * tidak tahu sejarahnya; ia melihat "Tidak perlu dipanggil" sembilan kotak
 * jauhnya dari "Belum dipanggil" dan menyangka keduanya soal yang berbeda.
 *
 * Kini tiap kotak punya kelompok, dan tiap kelompok menjawab satu pertanyaan:
 *
 *   panggilan   sudahkah pihaknya dipanggil, dan sampaikah panggilannya
 *   sidang      bagaimana sidang ini berjalan - pertama, verstek, ditunda
 *   putusan     berdirikah perkaranya di hadapan putusannya hari ini
 *   antrian     sudahkah pihaknya mengambil nomor di ruang tunggu
 *
 * Di dalam kelompok, yang menuntut tindakan lebih dulu - urutannya di
 * URUTAN_NADA, dari merah ke netral. Kotak gabungan "Perlu diperiksa" tetap
 * paling depan, di luar kelompok mana pun: ia daftar pekerjaan, bukan
 * saringan.
 *
 * Definisinya di sini, bukan di komponen, supaya ujinya dapat memeriksa
 * urutan yang sungguh digambar tanpa merender komponen tiga ribu baris itu.
 */
export const KELOMPOK_KEADAAN = [
  { kunci: "panggilan", label: "Panggilan" },
  { kunci: "sidang", label: "Jalannya sidang" },
  { kunci: "putusan", label: "Putusan" },
  { kunci: "antrian", label: "Antrian" },
] as const;

export type KunciKelompokKeadaan = (typeof KELOMPOK_KEADAAN)[number]["kunci"];

/** Dari yang menuntut tindakan ke yang sekadar keterangan. */
export const URUTAN_NADA: readonly string[] = ["bahaya", "awas", "sejuk", "aman", "netral"];

/**
 * Apakah agenda sidang ini termasuk tahapan e-Litigasi.
 *
 * ============================================================================
 * DARI AGENDANYA, BUKAN DARI PENANDA PERKARA
 * ============================================================================
 *
 * Perkara yang didaftarkan lewat e-Court belum tentu disidangkan secara
 * e-Litigasi: persetujuan tergugat menentukan, dan persetujuan itu baru
 * diketahui pada sidang pertama. Yang menandai e-Litigasi justru AGENDANYA -
 * jawaban, replik, duplik, dan kesimpulan adalah tahapan yang pada
 * e-Litigasi dipertukarkan lewat aplikasi, bukan dibacakan di ruang sidang.
 *
 * Karena itu penentuannya di sini dan bukan di SIPP: yang ditanya bukan
 * "perkara ini e-Court atau bukan", melainkan "hari ini tahapannya
 * dipertukarkan lewat aplikasi atau tidak" - dan itu menentukan siapa yang
 * perlu hadir.
 */
export const AGENDA_ELITIGASI = [
  /\bjawaban\b/i,
  /\breplik\b/i,
  /\bduplik\b/i,
  /duplik\s+rekonvensi/i,
  /\bkesimpulan\b/i,
  /musyawarah\s+majelis/i,
  // "Pembacaan putusan" dan "Pembacaan Penetapan" - keduanya benar-benar
  // ada di SIPP dengan ejaan berbeda, sehingga yang dicocokkan kata intinya.
  /pembacaan\s+(putusan|penetapan)/i,
  /putusan\s+sela/i,
];

/**
 * Agendanya saja. TIDAK dipakai sendirian - lihat sidangElitigasi di bawah.
 * Dipisah sebagai fungsi supaya dapat diuji tanpa merender apa pun.
 */
export function agendaElitigasi(agenda: string): boolean {
  const teks = String(agenda || "");
  if (!teks) return false;
  return AGENDA_ELITIGASI.some((pola) => pola.test(teks));
}

/**
 * Agenda yang menandai perkara sedang MENUJU PUTUSAN hari itu.
 *
 * ============================================================================
 * KENAPA MERAH, DAN KENAPA TERPISAH DARI e-LITIGASI
 * ============================================================================
 *
 * Musyawarah majelis, pembacaan putusan, pembacaan penetapan, dan putusan sela
 * adalah hari yang menentukan: majelis harus lengkap, naskahnya harus siap,
 * dan tidak ada yang dapat ditunda tanpa penetapan. Merah di layar ini berarti
 * "menuntut perhatian hari ini", dan agenda-agenda ini memang begitu.
 *
 * Daftar polanya SAMA dengan yang dipakai penanda e-Litigasi - tetapi hanya
 * sebagian, dan syaratnya berbeda:
 *
 *   e-Litigasi  menuntut perkaranya terdaftar e-Court. Yang ditanya "hari ini
 *               tahapannya dipertukarkan lewat aplikasi atau tidak".
 *   Musyawarah  TIDAK menuntut apa pun selain agendanya. Perkara biasa maupun
 *               e-Court sama-sama bermusyawarah dan sama-sama membacakan
 *               putusan, dan keduanya sama-sama menuntut kesiapan.
 *
 * Karena itu keduanya berdiri sendiri-sendiri meski polanya beririsan. Satu
 * sidang dapat tertandai keduanya sekaligus, dan itu memang benar.
 */
export const AGENDA_MUSYAWARAH = [
  /musyawarah/i,
  /pembacaan\s+(putusan|penetapan)/i,
  // "Pembacaan putusan" sudah tertangkap pola di atas; yang ini menangkap
  // penulisan lain yang benar-benar ada di SIPP - "Putusan", "Penetapan",
  // dan "Putusan Sela" tanpa kata pembacaan di depannya.
  /\bputusan\b/i,
  /\bpenetapan\b/i,
];

// Sidang ikrar talak SENGAJA tidak masuk. Ia memang hari yang menentukan -
// talak diucapkan dan perceraian berlaku sejak saat itu - tetapi ia bukan
// musyawarah dan bukan pembacaan putusan; putusannya sudah dijatuhkan jauh
// sebelumnya. Memasukkannya menambah 57 sidang merah pada 2026 saja, dan
// penanda merah yang menyala di mana-mana berhenti menuntut perhatian.
//
// Sejak penanda "Ikrar Talak" ada, pengecualian ini bukan lagi sekadar
// penghematan warna: ikrar talak punya kotaknya sendiri yang biru, dan
// hariPutusan di bawah memotongnya secara tegas - lihat catatan di sana.

export function agendaMusyawarah(agenda: string): boolean {
  const teks = String(agenda || "");
  if (!teks) return false;
  return AGENDA_MUSYAWARAH.some((pola) => pola.test(teks));
}

/**
 * Sidang penyaksian ikrar talak.
 *
 * ============================================================================
 * BENDERA SIPP LEBIH DULU, TULISAN AGENDA HANYA PELENGKAP
 * ============================================================================
 *
 * perkara_jadwal_sidang punya kolom `ikrar_talak` char(1) - itulah yang
 * menandai sidang ikrar, dan ia dibaca lebih dulu. Tulisan agendanya diperiksa
 * belakangan, hanya untuk menangkap baris yang benderanya lupa dicentang.
 *
 * Diukur atas 20.092 baris jadwal di PA Donggala:
 *
 *   bendera 'Y'                         1.024 baris
 *   agenda memuat "ikrar", bendera 'T'      2 baris
 *
 * Ejaan agendanya sendiri belasan macam - "SIDANG IKRAR TALAK", "Sidank Ikrar
 * Talak", "sidang ikrar ", "penyaksian ikrar talak", "Pengucapan Ikrar" -
 * sehingga polanya cukup kata "ikrar" saja. Ia tidak muncul di luar perkara
 * cerai talak.
 */
export function sidangIkrar(baris: { agenda?: string; sidangIkrarTalak?: boolean }): boolean {
  if (baris.sidangIkrarTalak) return true;
  return /\bikrar\b/i.test(String(baris.agenda || ""));
}

/**
 * ============================================================================
 * HARI PUTUSAN - SATU PENANDA UNTUK HARI YANG MENJATUHKAN PUTUSAN
 * ============================================================================
 *
 * Dua keadaan, satu hari yang sama:
 *
 *   AKAN DIPUTUS   agendanya musyawarah majelis, pembacaan putusan,
 *                  pembacaan penetapan, atau putusan sela.
 *   SUDAH DIPUTUS  hasil sidangnya sudah tercatat - "putus DIKABULKAN
 *                  (verstek)", "putus DICABUT", "putus DIGUGURKAN".
 *
 * Keduanya menjawab pertanyaan yang sama: hari ini perkaranya berdiri di
 * hadapan putusannya. Yang pertama menuntut kesiapan naskah dan kelengkapan
 * majelis; yang kedua menyatakan hasilnya sudah ada.
 *
 * ============================================================================
 * KENAPA NAMANYA "HARI PUTUSAN"
 * ============================================================================
 *
 * Yang dipertimbangkan:
 *
 *   "Sidang Putusan"    tertukar dengan nama agenda di SIPP - orang akan
 *                       menyangka ia menyaring agenda bertuliskan itu saja.
 *   "Tahap Putusan"     benar untuk yang akan diputus, terlalu longgar untuk
 *                       yang sudah - "tahap" terbaca sebagai masih berjalan.
 *   "Menuju Putusan"    hanya menampung setengahnya; yang sudah putus tidak
 *                       sedang menuju ke mana pun.
 *   "Putus Hari Ini"    keliru pada yang agendanya musyawarah - hari itu
 *                       majelis dapat memutuskan menunda.
 *   "Hari Putusan"      DIPILIH. Menyebut HARINYA, bukan keadaan perkaranya,
 *                       dan hari itu sama benarnya bagi yang naskahnya
 *                       sedang disiapkan maupun yang hasilnya sudah tercatat.
 *
 * ============================================================================
 * KUNING, DAN MENGGANTIKAN "MUSYAWARAH MAJELIS" YANG MERAH
 * ============================================================================
 *
 * Penanda "Musyawarah Majelis" yang dulu merah TIDAK dibiarkan berdiri di
 * sebelahnya: cakupannya termuat seluruhnya di sini, dan dua kotak yang
 * menyaring hal yang hampir sama membuat pembacanya menduga ada bedanya, lalu
 * mencari beda yang tidak ada. Aturan itu sudah ditulis di berkas ini ketika
 * "Agenda putusan" dilebur menjadi "Musyawarah Majelis"; ia berlaku lagi
 * sekarang.
 *
 * Kuning, bukan merah, karena separuh isinya perkara yang sudah selesai -
 * merah pada perkara yang hasilnya sudah tercatat menuntut perhatian yang
 * tidak diperlukan lagi. Kuning berarti "hari ini menentukan", dan itu benar
 * untuk keduanya.
 *
 * ============================================================================
 * IKRAR TALAK DIKECUALIKAN
 * ============================================================================
 *
 * Sidang ikrar talak bukan hari putusan: putusannya - izin mengucapkan talak
 * - sudah dijatuhkan jauh sebelumnya, dan yang terjadi hari itu penyaksian
 * ikrarnya. Ia punya penandanya sendiri, biru.
 *
 * Diukur: dari 1.024 baris berbendera ikrar, TIDAK SATU pun yang hasil
 * sidangnya memuat kata "putus", dan hanya 4 yang agendanya menyebut
 * musyawarah/putusan/penetapan. Keempatnya jatuh ke penanda biru, dan itu
 * memang tempatnya - sidang berbendera ikrar adalah sidang ikrar.
 */
export function hariPutusan(baris: {
  agenda?: string;
  ditunda?: boolean;
  alasanDitunda?: string;
  sidangIkrarTalak?: boolean;
}): boolean {
  if (sidangIkrar(baris)) return false;
  if (agendaMusyawarah(baris.agenda || "")) return true;
  return Boolean(hasilSidangPutusan(Boolean(baris.ditunda), baris.alasanDitunda || ""));
}

/**
 * ============================================================================
 * DIPUTUS PADA SIDANG HARI ITU - BUKAN SEKADAR "PERKARANYA PUNYA PUTUSAN"
 * ============================================================================
 *
 * Layar ini layar JADWAL SIDANG: tiap barisnya satu sidang pada satu tanggal.
 * "Sudah putus" karena itu harus menjawab "diputus pada sidang INI", bukan
 * "perkara ini pernah diputus" - yang kedua benar bagi setiap sidang lanjutan
 * sesudah putusan, dan mengucapkannya pada baris hari ini menyesatkan.
 *
 * Menyesatkannya bukan dugaan. 9 September 2026 di PA Donggala menampilkan
 * "2 Sudah putus", dan keduanya sidang ikrar talak - 274 dan 404/Pdt.G/2026 -
 * yang putusannya dijatuhkan berbulan-bulan sebelumnya. Perkara yang
 * benar-benar diputus hari itu, 510/Pdt.G/2026 dengan hasil sidang "putus
 * DIKABULKAN (verstek)", justru tidak terhitung di antaranya karena
 * putusannya belum tercatat di SIPP.
 *
 * ============================================================================
 * TANGGALNYA YANG MEMISAHKAN, DAN ITU DIUKUR
 * ============================================================================
 *
 * Syaratnya tanggal putusan SAMA dengan tanggal sidang. Diukur atas jadwal
 * 25 Agustus - 9 September 2026:
 *
 *   tanggal      sidang  punya putusan  putus hari itu  ikrar talak
 *   2026-09-01     19        11              10             0
 *   2026-09-03     21        20               1             0
 *   2026-09-04     19        19              19             0
 *   2026-09-07     21        13              10             2
 *   2026-09-09     17         2               0             2
 *
 * 3 September memperlihatkan bedanya paling terang: dua puluh perkara punya
 * putusan, satu di antaranya diputus hari itu. Sembilan belas sisanya sedang
 * mengerjakan hal lain.
 *
 * Baris ikrar_talak = 'Y' yang putusannya bertanggal sama dengan sidangnya:
 * NOL, di seluruh rentang itu. Pemeriksaan sidangIkrar di bawah karena itu
 * sudah tidak diperlukan oleh data - ia tetap ditulis supaya maksudnya
 * terbaca dari kodenya, dan supaya baris yang kelak salah dicatat operator
 * tetap tidak lolos.
 *
 * ============================================================================
 * KENAPA BUKAN "NASKAHNYA SUDAH DIUNGGAH"
 * ============================================================================
 *
 * Keduanya berjalan bersamaan di sini - dari seluruh perkara yang diputus
 * pada tanggal sidangnya, SEMUANYA sudah punya amar_putusan_dok. Yang dipilih
 * tanggalnya, bukan unggahannya, karena keduanya baru berpisah pada keadaan
 * yang justru paling perlu terlihat: putusan yang sudah dijatuhkan tetapi
 * naskahnya belum diunggah. Kalau unggahan yang jadi syarat, kotaknya padam
 * persis pada hari itu.
 */
export function putusHariIni(baris: {
  sudahPutus?: boolean;
  tanggalPutusan?: string;
  tanggalSidang?: string;
  agenda?: string;
  sidangIkrarTalak?: boolean;
}): boolean {
  if (!baris.sudahPutus) return false;
  if (sidangIkrar(baris)) return false;
  // Salah satu tanggal yang kosong berarti tidak dapat dibandingkan, dan yang
  // tidak dapat dibandingkan tidak dihitung - gagal-tertutup, sama seperti
  // jalur penilaian lain di ALETA.
  if (!baris.tanggalPutusan || !baris.tanggalSidang) return false;
  return baris.tanggalPutusan === baris.tanggalSidang;
}

/**
 * Penanda e-Litigasi yang sesungguhnya: perkara e-Court DAN agenda elektronik.
 *
 * ============================================================================
 * KENAPA AGENDA SAJA TIDAK LAGI CUKUP
 * ============================================================================
 *
 * Selama daftar agendanya hanya jawaban, replik, duplik, dan kesimpulan,
 * agenda saja memang menandai - keempatnya jarang muncul di luar e-Litigasi.
 * Begitu daftarnya diperluas sampai musyawarah majelis dan pembacaan putusan,
 * ia berhenti menandai: pengukuran agenda 2026 di PA Donggala mencatat 31
 * sidang "Musyawarah Majelis" dan 20 "Pembacaan putusan", dan sebagian besar
 * perkara yang tidak pernah menyentuh e-Court sama sekali.
 *
 * Saringan yang memunculkan perkara biasa lebih menyesatkan daripada tidak ada
 * saringan - pembacanya menyangka daftar itu sudah tepat.
 *
 * lewatEcourt yang tidak terbaca dianggap BUKAN e-Court: gagal-tertutup, sama
 * seperti jalur penilaian lain di ALETA.
 */
/**
 * ============================================================================
 * SUDAH PUTUS HARI INI - DUA SUMBER, SATU JAWABAN
 * ============================================================================
 *
 * SIPP menyimpan "sudah diputus" di DUA tempat yang tidak saling tahu:
 *
 *   perkara_putusan              baris resmi putusannya - dibaca putusHariIni
 *   perkara_jadwal_sidang        kolom alasan_ditunda, tempat panitera
 *                                mengetik hasil sidang - dibaca hasilSidangPutusan
 *
 * Tidak ada satu pun yang lengkap sendirian, dan itu terukur pada data satker:
 *
 *     2026-09-08   layar menghitung 1 sudah putus, hasil sidang menyebut 6
 *                  (lima di antaranya tanpa satu baris pun di perkara_putusan)
 *     2026-09-04   layar menghitung 18, hasil sidang menyebut 0
 *                  (putusannya diisi di SIPP tanpa hasil sidang pernah diketik)
 *
 * Sepanjang sejarah 3.905 baris hasil-putus: 3.890 bertanggal sama, 4 berbeda,
 * 11 tanpa baris putusan sama sekali. Perpecahannya kecil - tetapi ia SELALU
 * jatuh pada hari yang sedang berjalan, yaitu hari yang justru sedang dilihat
 * orang. Itulah sebabnya layar tampak berbohong pada dirinya sendiri: kotak
 * hijau "Hasil sidang - putus DIKABULKAN (verstek)" berdiri di baris yang
 * kolom putusannya berbunyi merah "putusan belum tercatat".
 *
 * Keduanya sah dan tidak boleh disatukan di basis data - yang satu catatan
 * resmi, yang lain catatan ruang sidang. Yang disatukan PEMBACAANNYA, di sini.
 */
export function sudahPutusHariIni(baris: {
  sudahPutus?: boolean;
  tanggalPutusan?: string;
  tanggalSidang?: string;
  agenda?: string;
  sidangIkrarTalak?: boolean;
  ditunda?: boolean;
  alasanDitunda?: string;
}): boolean {
  if (putusHariIni(baris)) return true;
  // SIDANG IKRAR TALAK DIKECUALIKAN DI KEDUA JALUR, bukan hanya di
  // putusHariIni. Putusannya dijatuhkan berbulan-bulan sebelumnya; yang
  // dikerjakan hari ini pengucapan ikrarnya. Menghitungnya "diputus hari ini"
  // membuat kotak Sudah putus menyebut perkara yang sudah lama selesai - dan
  // itulah persis cacat yang dahulu sudah diperbaiki, yang tidak boleh kembali
  // lewat pintu yang baru dibuka ini.
  if (sidangIkrar(baris)) return false;
  // hasilSidangPutusan sudah menolak baris yang bendera ditundanya menyala -
  // yang ditunda bukan yang diputus.
  return Boolean(hasilSidangPutusan(Boolean(baris.ditunda), String(baris.alasanDitunda || "")));
}

/**
 * Sidangnya sudah selesai hari ini - ditunda ATAU diputus.
 *
 * Dipakai penanda baris pada daftar antrian. Ditunda ikut dihitung selesai:
 * yang ditunda sudah dibuka, dibacakan, dan ditutup - ruangnya kosong lagi,
 * dan itulah yang ditanyakan orang yang melihat daftar antrian.
 */
export function sidangSelesaiHariIni(baris: {
  sudahPutus?: boolean;
  tanggalPutusan?: string;
  tanggalSidang?: string;
  agenda?: string;
  sidangIkrarTalak?: boolean;
  ikrarTercatat?: boolean;
  ditunda?: boolean;
  alasanDitunda?: string;
}): boolean {
  return Boolean(baris.ditunda) || sudahPutusHariIni(baris) || ikrarSelesai(baris);
}

/**
 * ============================================================================
 * SIDANG IKRAR TALAK YANG SUDAH DILAKSANAKAN - SELESAI
 * ============================================================================
 *
 * Perbaikan 30 September 2026 (butir 27). 314/Pdt.G/2026/PA.Dgl sidang ke-12
 * "SIDANG IKRAR TALAK": antrian SIPP menulis "Hasil Sidang: TELAH IKRAR
 * TALAK", tetapi ALETA masih memberi keping tunda|putus - sidangSelesaiHariIni
 * hanya mengenal "ditunda" dan "putus", dan sidang ikrar SENGAJA dikecualikan
 * dari "putus" (putusannya dijatuhkan jauh sebelumnya).
 *
 * Dua sumber kebenaran, diukur atas 1.024 sidang berbendera ikrar_talak = 'Y'
 * di sipp_donggala (30 Sep 2026):
 *
 *   perkara_ikrar_talak.tgl_ikrar_talak = tanggal sidang ini   832 sidang
 *     (ikrarTercatat dari bot - sippJadwalSidangService)
 *       di antaranya alasan_ditunda "telah ikrar talak"          436
 *                    alasan_ditunda "0" atau NULL                394
 *   alasan_ditunda menyebut ikrar, ditunda = 'T', tanggal ikrar
 *     belum/beda tercatat                                           5
 *
 * Hasil sidang yang menyebut ikrar pada sidang TIDAK ditunda (465 baris):
 * "telah ikrar talak" 440, "ikrar talak" 21, "ikrar" 2, "Pengucapan Ikrar
 * Talak" 1, "SIDANG IKRAR TALAK" 1. Pada sidang DITUNDA (45 baris) kalimatnya
 * lain: "Belum Ikrar", "Pemohon tidak hadir ikrar", "tunda 6 bulan",
 * "menunggu Pemohon ikrar", "Panggil Ikrar".
 *
 * Kolom hasil sidangnya saja TIDAK cukup (394 dari 832 dibiarkan "0"/NULL),
 * dan tanggal ikrarnya saja pun tidak (petugas kadang mengisinya belakangan).
 * Karena itu keduanya dibaca: tanggal ikrar yang sama dengan tanggal sidang,
 * ATAU hasil sidang yang menyebut ikrar tanpa kata penunda (belum, tidak,
 * tunda, menunggu, panggil) pada sidang yang tidak ditunda. Bendera ditunda
 * menyingkirkan sidang ikrar yang ditunda lebih dulu.
 */
const POLA_IKRAR = /\bikrar\b/i;
const POLA_IKRAR_TERTUNDA = /\b(belum|tidak|tunda|ditunda|menunggu|panggil)\b/i;

export function ikrarSelesai(baris: {
  agenda?: string;
  sidangIkrarTalak?: boolean;
  ikrarTercatat?: boolean;
  ditunda?: boolean;
  alasanDitunda?: string;
}): boolean {
  if (!sidangIkrar(baris)) return false;
  if (baris.ditunda) return false;
  if (baris.ikrarTercatat) return true;
  const hasil = String(baris.alasanDitunda || "");
  return POLA_IKRAR.test(hasil) && !POLA_IKRAR_TERTUNDA.test(hasil);
}

/**
 * ============================================================================
 * HASIL SIDANG BELUM DICATAT - SATU ATURAN UNTUK KOTAK, KOTAK GABUNGAN, TANDA
 * ============================================================================
 *
 * Belum ditunda, belum diputus hari ini, DAN kolom hasilnya di SIPP masih
 * kosong. Syarat ketiga itu yang baru (24 September 2026). Tanpanya, sidang
 * ikrar talak yang sudah dicatat "telah ikrar talak" ikut tertagih -
 * sudahPutusHariIni sengaja menolak sidang ikrar, dan ikrar yang terlaksana
 * tetap ditunda = T. Diukur 1 Agustus - 11 September 2026 pada SIPP satker:
 * rumus lama menagih 11 sidang, rumus ini 2.
 *
 * Satu pengecualian lagi datang dari bot: sidang ikrar yang ikrarnya sudah
 * tercatat di perkara_ikrar_talak pada tanggal sidang yang sama
 * (ikrarTercatat), walau kolom hasilnya dibiarkan kosong - panitera mencatat
 * ikrarnya di tabel ikrar, bukan di kolom hasil sidang.
 *
 * Selama kotaknya kuning kekeliruan itu kecil. Sejak pukul 15:00 WITA ia ikut
 * kotak merah "Perlu diperiksa", dan menagih merah pekerjaan yang sudah
 * dikerjakan adalah cara tercepat membuat kotak itu tidak dipercaya.
 *
 * "belum ditunda atau belum ada keterangan sidangnya" - kata pengguna -
 * dibaca sebagai SATU keadaan: hasil sidangnya belum dicatat. Dibaca sebagai
 * "atau" harfiah, setiap sidang yang diputus ikut tertagih, sebab sidang yang
 * diputus bertanda ditunda = T.
 */
export function hasilSidangBelumDicatat(baris: {
  sudahPutus?: boolean;
  tanggalPutusan?: string;
  tanggalSidang?: string;
  agenda?: string;
  sidangIkrarTalak?: boolean;
  ikrarTercatat?: boolean;
  ditunda?: boolean;
  alasanDitunda?: string;
  tanggalSidangBerikut?: string;
}): boolean {
  if (baris.ditunda) return false;
  if (sudahPutusHariIni(baris)) return false;
  if (baris.ikrarTercatat) return false;
  // Sidang BERIKUTNYA pada perkara yang sama sudah ada di jadwal: lanjutannya
  // terbukti terbentuk, walau bendera tundanya tidak disetel. Menagihnya
  // "agenda sidang berikutnya tidak terbentuk" menyatakan hal yang tidak
  // benar (tinjauan 24 September 2026; terukur beberapa baris lampau).
  if (baris.tanggalSidangBerikut) return false;
  return !alasanTerisi(baris.alasanDitunda);
}

/**
 * Pukul 15:00 WITA pada HARI SIDANGNYA sudah lewat.
 *
 * Tanggal lampau: selalu lewat - sidang kemarin yang belum dicatat lebih
 * tertunggak daripada sidang hari ini, bukan kurang. Tanggal depan: tidak
 * pernah. Jam yang belum terbaca (tanggal kosong): tidak pernah.
 */
export function lewatBatasHariSidang(
  tanggalSidang: string | undefined,
  saat: SaatPengadilan
): boolean {
  if (!tanggalSidang || !saat.tanggal) return false;
  if (tanggalSidang < saat.tanggal) return true;
  if (tanggalSidang > saat.tanggal) return false;
  return saat.lewatBatas;
}

/**
 * Anggota berjam kotak "Perlu diperiksa", dan syarat tanda merah di baris.
 *
 * ============================================================================
 * GAGAL-TERTUTUP: MERAH HANYA BILA KETIADAAN HASILNYA TERBUKTI
 * ============================================================================
 *
 * "Belum diputus" dibaca dari peta putusan bot, dan "ikrarnya belum tercatat"
 * dari peta ikrar. Bila salah satunya GAGAL dibaca, peta itu kosong - dan
 * peta kosong terbaca "tidak ada yang putus". Tinjauan 24 September 2026
 * mengukurnya: pada 4 September 2026 saja 18 sidang yang sudah diputus hanya
 * tertahan oleh peta putusan.
 *
 * Karena itu bot mengirim putusanTerbaca dan ikrarTerbaca tiap baris, dan
 * tanda merah menyala hanya bila keduanya terbukti terbaca (ikrar hanya
 * dituntut pada sidang ikrar). Yang tidak mengirimnya - bot lama - dianggap
 * tidak terbaca: tanda merahnya diam, kotak kuning Belum tunda tetap ada.
 */
export function belumTundaLewatBatas(
  baris: Parameters<typeof hasilSidangBelumDicatat>[0] & {
    putusanTerbaca?: boolean;
    ikrarTerbaca?: boolean;
  },
  saat: SaatPengadilan
): boolean {
  if (baris.putusanTerbaca !== true) return false;
  if (sidangIkrar(baris) && baris.ikrarTerbaca !== true) return false;
  return lewatBatasHariSidang(baris.tanggalSidang, saat) && hasilSidangBelumDicatat(baris);
}

/**
 * ============================================================================
 * SIDANG PERTAMA TIDAK PERNAH e-LITIGASI
 * ============================================================================
 *
 * Persetujuan tergugat untuk bersidang secara elektronik baru diketahui PADA
 * sidang pertama (lihat AGENDA_ELITIGASI di atas) - sidang itu sendiri selalu
 * dihadiri di ruang sidang. Diukur di SIPP satker: 58 dari 311 sidang yang
 * dahulu tertandai e-Litigasi sepanjang 2026 (19%) adalah sidang pertama,
 * hampir semuanya permohonan sidang-sehari yang agendanya ditulis
 * "Pemeriksaan Identitas, Penasihatan, Pemeriksaan Pokok Perkara, Kesimpulan"
 * - tertandai hanya karena kata "kesimpulan".
 *
 * Sejak 24 September 2026 tulisan agenda e-Litigasi dimerahkan di Antrian
 * Sidang, dan kekeliruan itu menjadi mencolok: sidang yang wajib dihadiri
 * tampak "lewat aplikasi". Dipotong di SINI, bukan di layar, supaya kotak
 * e-Litigasi dan warna agendanya berubah bersama - kotak yang menghitung 4
 * harus menunjuk 4 baris yang merah.
 *
 * `=== 1`, bukan `<= 1`: di layar urutanSidang 0 berarti TIDAK TERBACA, dan
 * yang tidak terbaca tidak dikecualikan diam-diam.
 */
export function sidangElitigasi(baris: {
  agenda?: string;
  lewatEcourt?: boolean;
  urutanSidang?: number;
}): boolean {
  if (!baris.lewatEcourt) return false;
  if (baris.urutanSidang === 1) return false;
  return agendaElitigasi(baris.agenda || "");
}

/**
 * Apakah ini perkara verzet - perlawanan terhadap putusan verstek.
 *
 * SIPP tidak menyimpan penanda tersendiri untuknya; yang ada hanya nama jenis
 * perkaranya. "Perlawanan" adalah sebutan resmi di SIPP, "verzet" yang dipakai
 * sehari-hari - keduanya dikenali.
 *
 * Satu fungsi dipakai daftar maupun rincian. Dua salinan aturan yang sama akan
 * sama-sama bekerja, lalu pada suatu hari satu layar menandai perkara yang
 * tidak ditandai layar lain - untuk perkara yang persis sama.
 */
export function perkaraVerzetDari(...teks: Array<string | undefined | null>): boolean {
  return /verzet|perlawanan/i.test(teks.filter(Boolean).join(" "));
}

/**
 * ============================================================================
 * SATU KOTAK YANG MENJAWAB PERTANYAAN PERTAMA TIAP PAGI
 * ============================================================================
 *
 * Pertanyaan pertama panitera pagi hari bukan "retur berapa", melainkan "hari
 * ini yang mana yang perlu saya urus". Deretan kotak keadaan menjawab
 * pertanyaan yang lain: tiap kotak menjawab satu keadaan, sehingga pertanyaan
 * pertama itu menuntut membaca belasan kotak lalu menjumlahkannya di kepala -
 * dan sesudah Hari Putusan dan Ikrar Talak ditambahkan, deretannya memang
 * selalu penuh.
 *
 * ============================================================================
 * HANYA MERAH, PADAHAL RENCANANYA MERAH DAN KUNING
 * ============================================================================
 *
 * Rencana awalnya menggabungkan keduanya. Itu ditinggalkan sesudah arti tiap
 * penanda kuning diperiksa satu per satu:
 *
 *   belum-bas    tidak ada berita acara sidang. Berita acara ditulis SESUDAH
 *                sidangnya berlangsung - jadi pada jadwal HARI INI, yang
 *                merupakan tampilan bawaan layar ini, hampir setiap baris
 *                memenuhinya. Bukan karena ada yang salah, melainkan karena
 *                sidangnya memang belum terjadi.
 *   ditunda      sidang ditunda ke tanggal lain. Itu jalannya perkara, bukan
 *                kekeliruan; sebagian besar sidang memang ditunda.
 *   belum-antri  pihaknya belum mengambil nomor. Pagi hari, sebelum orangnya
 *                datang, itu keadaan yang wajar.
 *
 * Kotak yang menyala pada hampir seluruh baris tidak menyaring apa pun.
 * "Perlu diperiksa 47" di atas tabel berisi 47 baris tidak menjawab
 * pertanyaan mana pun - ia hanya menambah satu kotak lagi ke deretan yang
 * sudah terlalu penuh, persis keluhan yang hendak dijawab.
 *
 * Merah sudah punya artinya sendiri di layar ini, dan artinya tepat yang
 * dicari: MENUNTUT TINDAKAN. Retur berarti panggilannya harus diulang;
 * belum-dipanggil berarti ada pihak yang belum dipanggil sama sekali.
 * Keduanya pekerjaan yang harus dikerjakan seseorang hari ini, dan keduanya
 * membatalkan sidangnya bila tidak.
 *
 * Kuning tetap kuning dan tetap terbaca pada kotaknya masing-masing. Yang
 * dihindari hanya menjumlahkannya menjadi satu kotak yang lalu berhenti
 * berarti apa-apa.
 *
 * ============================================================================
 * DIHITUNG DARI NADANYA, BUKAN DITULIS SEBAGAI DAFTAR KUNCI
 * ============================================================================
 *
 * Daftar kunci kedua di tempat lain adalah daftar yang suatu hari lupa
 * diperbarui: penanda merah baru ditambahkan, tidak masuk kelompoknya, dan
 * tidak ada yang gagal - kotaknya hanya diam-diam menghitung kurang. Karena
 * itu keanggotaannya dihitung dari nada masing-masing penanda.
 *
 * ============================================================================
 * SATU ANGGOTA YANG TIDAK DIBACA DARI NADA: BELUM TUNDA SESUDAH 15:00 WITA
 * ============================================================================
 *
 * Diminta pengguna 24 September 2026. "Belum tunda" tetap kuning - alasan
 * belum-bas di atas berlaku juga baginya pada pagi hari. Yang berubah hanya
 * sesudah pukul 15:00 WITA pada hari sidangnya. Nada adalah sifat tetap
 * sebuah kotak, sedangkan ini sifat yang berubah menurut jam, sehingga ia
 * tidak dapat diungkapkan sebagai nada. Kotak merah tersendiri ditolak: dua
 * kotak yang menyaring hal yang hampir sama membuat pembacanya mencari beda
 * yang tidak ada. Karena itu ia disebut SATU kali, dengan namanya, pada
 * cocok() kotak gabungan - lihat belumTundaLewatBatas.
 */
export const NADA_PERLU_DIPERIKSA: readonly string[] = ["bahaya"];

/** Kunci kotak gabungan. Dipakai komponen dan ujinya. */
export const KUNCI_PERLU_DIPERIKSA = "perlu-diperiksa";

/**
 * Bagian angka "Perlu diperiksa" yang datang dari aturan pukul 15:00 - hanya
 * disebut di judulnya, bukan kotak sendiri. Sama dengan kunci saklar
 * Tampilan-nya (wajib) di tampilan-antrian-sidang.
 */
export const KUNCI_BELUM_TUNDA_LEWAT_BATAS = "belum-tunda-lewat-batas";
