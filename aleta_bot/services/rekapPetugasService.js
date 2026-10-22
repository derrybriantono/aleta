"use strict";

const { relaasRetur, sqlRetur } = require("./returRelaas");

/**
 * ============================================================================
 * REKAP PETUGAS - SATU ORANG, SELURUH PERKARANYA
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026 (butir 6 dan 9): nama hakim, panitera
 * pengganti, juru sita, dan mediator pada layar Status Perkara dapat diklik,
 * lalu membuka halaman baru berisi rekap perkara orang itu beserta rincian,
 * statistik, dan persentasenya.
 *
 * ============================================================================
 * ORANGNYA DIKENALI LEWAT ID SIPP, TIDAK PERNAH LEWAT NAMA
 * ============================================================================
 *
 * SIPP menyalin nama petugas ke tiap baris penunjukan, dan salinannya tidak
 * seragam. Terukur di sipp_donggala 27 September 2026:
 *
 *   - tabel jurusita menyimpan enam belas baris berbeda untuk nama "Syukri"
 *     ("MOH.SYUKRI", "Moh.Syukri", "Mohammad Syukri, SH", ...), masing-masing
 *     dengan id sendiri;
 *   - jurusita_id 22 tertulis "Mohammad Syukri" pada satu penunjukan dan
 *     "Mohammad Syukri, S.H." pada penunjukan lain;
 *   - hakim_pn memuat "Mazidah" dua kali (id 3 dan 21), mediator memuat
 *     "Nurbaya" dua kali (id 18 dan 19).
 *
 * Mencocokkan lewat nama akan menyatukan orang yang berbeda atau memecah
 * orang yang sama - dan angka yang salah alamat di halaman ini bukan
 * ketidakrapian, melainkan tuduhan kepada orang yang tidak mengerjakannya.
 * Karena itu SELURUH kueri di sini disaring dengan id: hakim_id, panitera_id,
 * jurusita_id, atau mediator_id. Nama hanya DIBACA untuk ditampilkan.
 *
 * Satu-satunya penyatuan yang dilakukan juga lewat id: mediator hakim yang
 * tercatat dua kali di tabel mediator (Derry Briantono: mediator_id 32 dan 33,
 * keduanya hakim_id 31) disatukan lewat mediator.hakim_id - sambungan yang
 * dicatat SIPP sendiri, bukan kemiripan tulisan. Penyatuannya disebutkan di
 * halaman, beserta id yang tercakup.
 *
 * ============================================================================
 * YANG SENGAJA TIDAK DIHITUNG, DAN SEBABNYA
 * ============================================================================
 *
 *   - Tanggal minutasi. Terukur di sipp_donggala: 6.612 dari 9.993 putusan
 *     bertanggal minutasi SAMA PERSIS dengan tanggal putusannya - kolom itu
 *     terisi otomatis, dan kecepatan minutasi yang dihitung darinya tidak
 *     mengukur apa pun.
 *   - Relaas yang "dikerjakan" juru sita. jurusita_id pada baris relaas
 *     adalah akun PENGINPUT (sys_users.userid), bukan id juru sita - lihat
 *     lapisanPetaService. Yang dihitung di sini relaas pada perkara yang
 *     DITUGASKAN kepadanya, dan disebut begitu.
 *   - Sidang yang "didampingi" panitera. perkara_jadwal_sidang tidak punya
 *     kolom panitera sama sekali. Yang dihitung sidang pada perkara
 *     tugasannya, dan disebut begitu.
 *   - v_pihak_perkara dan view lain. Lambat, urutannya tidak stabil, dan
 *     tidak ikut terimpor pada pemasangan hasil dump. Seluruhnya dari tabel.
 *
 * ============================================================================
 * WAKTU TEMPUH - YANG MAHAL ADALAH MEMBACA BARIS TABEL perkara
 * ============================================================================
 *
 * Terukur atas sipp_donggala lokal (XAMPP, innodb_buffer_pool_size 16 MB,
 * tabel perkara 60 MB), 27 September 2026: menyambung 1.749 perkara satu juru
 * sita ke tabel perkara lewat kunci utamanya memakan 0,7 detik pada mesin yang
 * lengang dan 9,6 detik saat mesinnya sibuk, sedangkan membaca penunjukannya
 * sendiri 7 milidetik. Tiap baris perkara dibaca dari cakram karena tidak muat
 * di buffer. Sesudah penawar di bawah, hitungan pertama: hakim 0,1-0,9 detik,
 * panitera 0,1-1,4, juru sita 0,9-1,3, mediator di bawah 0,15; dari singgahan
 * di bawah 10 milidetik. Karena itu:
 *
 *   - tanggal daftar, nomor, dan jenis dibaca dari INDEKS tabel perkara
 *     (FORCE INDEX), bukan dari barisnya - lihat dasarPerkaraLewatIndeks;
 *   - tabel perkara dibaca SATU kali untuk seluruh kedudukan orang itu;
 *   - penunjukan dibaca SATU kali - seluruh baris penunjukan perkara yang
 *     pernah memuat orang itu, dari tabel penunjukan saja - lalu kedudukan
 *     dan "pernah diganti" dipilah di sini (kedudukanPadaPerkara), bukan
 *     lewat NOT EXISTS berkorelasi yang menyentuh tiap baris;
 *   - kueri yang tidak saling menunggu dijalankan bersamaan;
 *   - hasilnya disinggahkan dua menit: menyaring dan membalik halaman daftar
 *     tidak menghitung ulang seluruhnya.
 *
 * ============================================================================
 * SELURUHNYA SELECT
 * ============================================================================
 *
 * Kuerinya ditulis harfiah di dalam runQuery - penjaga verify-pemisahan-
 * database dan verify-sipp-baca-saja membaca teksnya untuk memastikan tidak
 * satu pun menulis ke SIPP.
 */

const db = require("../db_config");
const { cleanText } = require("./ecourtTextService");
const sippSkemaService = require("./sippSkemaService");
const { tanggalHariIni } = require("./periodePenilaianService");
// Hitungan hari yang SAMA dengan penilaian SK dan layar Jadwal Sidang - berkas
// murni tanpa basis data, jadi tidak ada kebergantungan yang melingkar.
const { hitungWaktuPutus } = require("./penilaianSippService");
// Siapa PEMERIKSA suatu perkara - yang menjabat pada hari putusan, bukan yang
// aktif sekarang - diputuskan majelisPemeriksaService, satu sumber untuk rekap,
// Status Perkara, dan eviden SKP. Berkas murni pada bagian aturannya; tidak ada
// kebergantungan yang melingkar. Majelis dan petugas IKRAR juga diputuskan di
// sana (ikrarLengkap: penunjukan tahapan 18, selainnya borang ikrar).
const majelisPemeriksaService = require("./majelisPemeriksaService");
const { tanggalSah, barisPemeriksa, barisIkrar } = majelisPemeriksaService;
// Ambang dan aturan potongan mediasi DIPINJAM dari layar Jadwal Sidang, tidak
// ditulis ulang: batas lima bulan pada dua layar harus satu angka dari satu
// sumber, atau pada suatu hari rekap ini menyebut "lewat" perkara yang di
// layar jadwal masih hijau.
const {
  AMBANG_DURASI_HARI,
  BATAS_MEDIASI_HARI,
  BATAS_POTONG_MEDIASI_HARI,
  caraRelaas,
  hariMediasiBersih,
  selisihHariKalender,
} = require("./sippJadwalSidangService");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** Peran yang dapat direkap - sama dengan kunci ?peran= pada halaman portal. */
const PERAN_REKAP = Object.freeze(["hakim", "panitera", "jurusita", "mediator"]);

/**
 * Kedudukan seseorang pada SATU perkara.
 *
 * Hakim tunggal dipisah dari ketua majelis. Keduanya memimpin sidang, tetapi
 * perkara hakim tunggal (jabatan_hakim_id 3) diperiksa tanpa anggota - dan
 * menggabungkannya membuat "berapa majelis yang ia ketuai" tidak dapat
 * dijawab lagi.
 */
const KEDUDUKAN = Object.freeze({
  ketua: "Ketua majelis",
  tunggal: "Hakim tunggal",
  anggota: "Hakim anggota",
  hakimLain: "Hakim (jabatan tidak tercatat)",
  ikrar: "Majelis ikrar talak",
  panitera: "Panitera pengganti",
  paniteraIkrar: "Panitera sidang ikrar talak",
  jurusita: "Juru sita",
  jurusitaIkrar: "Juru sita ikrar talak",
  mediator: "Mediator",
});

/**
 * Kedudukan yang dapat dipakai menyaring daftar pada tiap halaman.
 *
 * Halaman hakim ikut memuat "mediator": hakim yang juga mediator tercatat di
 * tabel mediator dengan hakim_id-nya, dan perkara yang ia mediasi termasuk
 * perkara yang berhubungan dengannya. Kedudukan ikrar talak (tahapan 18, atau
 * borang ikrar bila penunjukannya tidak tercatat) disebut sendiri - lihat
 * kedudukanPadaPerkara dan ikrarDariBorang.
 */
const KEDUDUKAN_PER_PERAN = Object.freeze({
  hakim: Object.freeze(["ketua", "tunggal", "anggota", "hakimLain", "ikrar", "mediator"]),
  panitera: Object.freeze(["panitera", "paniteraIkrar"]),
  jurusita: Object.freeze(["jurusita", "jurusitaIkrar"]),
  mediator: Object.freeze(["mediator"]),
});

/**
 * Kelompok utama tiap halaman - yang dihitung pada ringkasan paling atas.
 *
 * Perkara yang dimediasi seorang hakim TIDAK ikut ringkasan hakimnya: hasil
 * putusan perkara yang hanya ia mediasi bukan putusan yang ia jatuhkan.
 * Perkara itu tetap tampil di tabel per peran dan di daftar.
 *
 * Majelis ikrar talak juga TIDAK ikut, dengan alasan yang sama: majelis itu
 * menyaksikan ikrar sesudah putusan dijatuhkan majelis pemeriksa. Terukur di
 * sipp_donggala 27 September 2026: pada 142 dari 813 perkara berketua ikrar,
 * ketua ikrarnya bukan ketua majelis pemeriksanya.
 */
const KEDUDUKAN_UTAMA = Object.freeze({
  hakim: Object.freeze(["ketua", "tunggal", "anggota", "hakimLain"]),
  panitera: Object.freeze(["panitera"]),
  jurusita: Object.freeze(["jurusita"]),
  mediator: Object.freeze(["mediator"]),
});

/** Saringan keadaan pada daftar perkara. */
const KEADAAN_SARING = Object.freeze(["proses", "putus", "belum_bht", "bht"]);

/**
 * Pagu baris. Hakim tersibuk di sipp_donggala memegang 2.056 perkara aktif;
 * pagu ini sepuluh kali lipatnya, jadi yang terpotong hanya basis data yang
 * jauh lebih besar - dan bila itu terjadi, halaman menyebutnya.
 */
const BATAS_PERKARA = 20000;
/** Seluruh baris penunjukan perkara-perkara satu orang: hakim tersibuk 7.561. */
const BATAS_PENUNJUKAN = 200000;
const BATAS_MEDIASI = 5000;
const BATAS_RELAAS = 50000;
/** Potongan daftar IN (...) supaya satu kueri tidak membawa ribuan tanda tanya. */
const POTONGAN_IN = 1000;
const BATAS_DAFTAR_BAWAAN = 100;
const BATAS_DAFTAR_MAKS = 200;

/** Singgahan hasil hitung: dua menit, paling banyak tiga puluh orang. */
const SINGGAHAN_MS = 2 * 60 * 1000;
const SINGGAHAN_MAKS = 30;

/** Kalimat dasar hitung - dikirim ke layar supaya hanya ditulis di satu tempat. */
const DASAR = Object.freeze({
  lama:
    `Hari kalender sejak pendaftaran sampai putusan, hari pendaftaran ikut dihitung, ` +
    `dikurangi masa mediasi (paling banyak ${BATAS_POTONG_MEDIASI_HARI} hari, PERMA 1/2016 Pasal 24) - ` +
    `hitungan yang sama dengan batas lima bulan pada layar Jadwal Sidang. Batasnya ` +
    `${AMBANG_DURASI_HARI} hari (SEMA 2/2014). Kelonggaran perkara ghaib tidak dipotong: ` +
    `kelonggaran itu milik penilaian SK, bukan SEMA.`,
  keadaan:
    "Masih proses = belum ada tanggal putusan. Putus = ada tanggal putusan, termasuk dicabut, " +
    "gugur, dan dicoret. BHT = tanggal berkekuatan hukum tetap terisi.",
  hasil:
    "Nama status dibaca lewat tabel status_putusan atas id-nya. Persentasenya atas perkara yang sudah putus.",
  minutasi:
    "Tanggal minutasi tidak dipakai sebagai ukuran: di SIPP satuan kerja ini sebagian besar terisi " +
    "sama persis dengan tanggal putusannya, sehingga tidak mengukur kecepatan siapa pun.",
  penugasan:
    "Dihitung atas penunjukan PEMERIKSAAN (tahapan 10). Perkara yang sudah putus: yang menjabat pada " +
    "hari putusan - bukan yang aktif sekarang, sebab SIPP menonaktifkan majelis pemeriksaan saat majelis " +
    "ikrar talak ditetapkan, dan pada data lama majelis ikrar dicatat sebagai pengganti sesudah putusan. " +
    "Perkara yang belum putus: penunjukan yang aktif. Majelis dan petugas ikrar talak disebut sebagai " +
    "kedudukan tersendiri dan tidak ikut ringkasan; sumbernya penunjukan aktif tahapan 18, dan bila " +
    "tabel penunjukan tidak mencatat majelis/petugas ikrar perkara itu, blangko penetapan ikrar talak " +
    "SIPP (perkara_ikrar_talak) - aturan yang sama dengan Status Perkara dan eviden SKP. ID pada blangko " +
    "yang tidak dapat dipasangkan dengan namanya tidak dihitung. Yang diganti sebelum putusan, atau " +
    "ditetapkan sesudahnya tanpa kedudukan ikrar, disebut terpisah dan tidak ikut dihitung.",
  mediasi:
    `Lama mediasi = hari sejak penetapan mediator sampai laporan mediator, sama dengan bagian Mediasi ` +
    `pada Status Perkara. Batasnya ${BATAS_MEDIASI_HARI} hari sejak penetapan (PERMA 1/2016 Pasal 24).`,
  relaas:
    "Relaas pada perkara yang DITUGASKAN kepadanya sebagai juru sita pemeriksaan - perkara yang hanya " +
    "ia layani pada ikrar talak tidak ikut. SIPP menyimpan akun penginput pada tiap baris relaas, bukan " +
    "juru sitanya - jadi siapa yang mengantar tiap relaas tidak dapat dipastikan dan tidak dihitung.",
  sidang:
    "Sidang pada perkara yang DITUGASKAN kepadanya sebagai panitera pengganti pemeriksaan - perkara " +
    "yang hanya ia dampingi pada ikrar talak tidak ikut. SIPP tidak mencatat panitera pada tiap sidang, " +
    "jadi yang mendampingi tiap sidang tidak dapat dipastikan dan tidak dihitung. BAS terhitung " +
    "terunggah bila berkasnya tercatat pada sidang itu.",
});

// ============================================================================
// PEMERIKSA MASUKAN
// ============================================================================

/**
 * Id SIPP yang sah: bilangan bulat positif, tanpa tanda, tanpa pecahan.
 *
 * Kolom id petugas di SIPP int(11) unsigned - batas atasnya 4.294.967.295.
 * "12abc", "1.5", "-3", dan "0" DITOLAK, bukan dibaca sebagian: Number("12abc")
 * memang NaN, tetapi parseInt("12abc") memberi 12 - dan halaman orang lain
 * akan terbuka tanpa ada yang menyadari ketikannya salah.
 */
function bacaId(nilai) {
  const teks = String(nilai === null || nilai === undefined ? "" : nilai).trim();
  if (!/^[1-9]\d{0,9}$/.test(teks)) return null;
  const angka = Number(teks);
  return Number.isSafeInteger(angka) && angka <= 4294967295 ? angka : null;
}

/**
 * Memeriksa seluruh masukan sekaligus.
 *
 * Nilai yang tidak dikenali DITOLAK dengan alasannya, bukan diganti bawaan
 * diam-diam: saringan "tahun 20255" yang diam-diam menjadi "semua tahun"
 * menampilkan daftar yang bukan jawaban pertanyaannya.
 */
function periksaPilihan(masukan = {}) {
  const tolak = (alasan, pesan) => ({ ok: false, alasan, pesan });

  const peran = cleanText(masukan.peran).toLowerCase();
  if (!PERAN_REKAP.includes(peran)) {
    return tolak("peran_tidak_dikenal", "Peran harus salah satu dari hakim, panitera, jurusita, atau mediator.");
  }

  const id = bacaId(masukan.id);
  if (id === null) return tolak("id_tidak_sah", "ID SIPP petugas harus bilangan bulat positif.");

  const tahunTeks = cleanText(masukan.tahun);
  let tahun = null;
  if (tahunTeks) {
    const angka = /^\d{4}$/.test(tahunTeks) ? Number(tahunTeks) : NaN;
    if (!(angka >= 1900 && angka <= 2100)) return tolak("tahun_tidak_sah", "Tahun harus empat angka.");
    tahun = angka;
  }

  const keadaan = cleanText(masukan.keadaan).toLowerCase();
  if (keadaan && !KEADAAN_SARING.includes(keadaan)) {
    return tolak("keadaan_tidak_dikenal", "Keadaan harus proses, putus, belum_bht, atau bht.");
  }

  const kedudukan = cleanText(masukan.kedudukan);
  if (kedudukan && !KEDUDUKAN_PER_PERAN[peran].includes(kedudukan)) {
    return tolak("kedudukan_tidak_dikenal", `Kedudukan "${kedudukan}" tidak dikenal untuk peran ${peran}.`);
  }

  const lewatiTeks = cleanText(masukan.lewati);
  if (lewatiTeks && !/^\d{1,7}$/.test(lewatiTeks)) return tolak("lewati_tidak_sah", "Lewati harus bilangan bulat.");
  const batasTeks = cleanText(masukan.batas);
  if (batasTeks && !/^\d{1,4}$/.test(batasTeks)) return tolak("batas_tidak_sah", "Batas harus bilangan bulat.");
  const batasAngka = batasTeks ? Number(batasTeks) : BATAS_DAFTAR_BAWAAN;
  if (batasAngka < 1) return tolak("batas_tidak_sah", "Batas paling sedikit satu baris.");

  return {
    ok: true,
    pilihan: {
      peran,
      id,
      tahun,
      keadaan,
      kedudukan,
      lewati: lewatiTeks ? Number(lewatiTeks) : 0,
      // Dijepit, bukan ditolak: yang meminta lebih banyak tetap mendapat
      // jawaban, hanya tidak lebih dari pagunya.
      batas: Math.min(BATAS_DAFTAR_MAKS, batasAngka),
    },
  };
}

// ============================================================================
// HITUNGAN MURNI - TANPA BASIS DATA, DIUJI LANGSUNG
// ============================================================================

/**
 * Satu persentase BESERTA pembilang dan penyebutnya.
 *
 * Persen saja tidak dapat dibantah: "50%" dari 2 perkara dan dari 400 perkara
 * dibaca sama. Penyebut nol menghasilkan persen null - bukan 0, sebab "0%
 * verstek" atas nol putusan menyatakan sesuatu yang tidak pernah diukur.
 */
function bagian(pembilang, penyebut) {
  const atas = Math.max(0, Number(pembilang) || 0);
  const bawah = Math.max(0, Number(penyebut) || 0);
  return {
    pembilang: atas,
    penyebut: bawah,
    persen: bawah > 0 ? Math.round((atas / bawah) * 1000) / 10 : null,
  };
}

function bilangan(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

/** Nilai tengah. Jumlah genap: rata-rata dua nilai tengahnya. */
function tengah(daftar) {
  const urut = daftar.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (urut.length === 0) return null;
  const t = Math.floor(urut.length / 2);
  if (urut.length % 2 === 1) return urut[t];
  return Math.round(((urut[t - 1] + urut[t]) / 2) * 10) / 10;
}

function rataRata(daftar) {
  const sah = daftar.filter((x) => Number.isFinite(x));
  if (sah.length === 0) return null;
  return Math.round((sah.reduce((a, b) => a + b, 0) / sah.length) * 10) / 10;
}

function tanggalIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const bulan = String(nilai.getMonth() + 1).padStart(2, "0");
    const hari = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${bulan}-${hari}`;
  }
  const teks = cleanText(nilai).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) && teks !== "0000-00-00" ? teks : "";
}

/** Y = ya, T = tidak, selainnya BELUM TERCATAT - bukan "tidak". */
function yaTidak(nilai) {
  const teks = cleanText(nilai).toUpperCase();
  if (teks === "Y") return true;
  if (teks === "T") return false;
  return null;
}

/** Keadaan satu perkara - tiga kelas yang tidak bertumpuk. */
function keadaanPerkara(baris) {
  if (!baris.tanggalPutusan) return "proses";
  return baris.tanggalBht ? "bht" : "putus";
}

const TANPA_STATUS = "Status putusan tidak tercatat";

/**
 * Ringkasan sekumpulan perkara: keadaan, hasil putusan, lama, verstek,
 * e-Court, dan banding - masing-masing dengan pembilang dan penyebutnya.
 *
 * Tiap penyebut dipilih menurut pertanyaannya, bukan disamakan:
 *
 *   keadaan, e-Court         atas SELURUH perkara
 *   hasil, verstek, banding  atas perkara yang SUDAH PUTUS - perkara yang
 *                            belum putus belum punya hasil maupun verstek
 *   lama                     atas perkara putus yang tanggalnya terbaca
 *
 * Nilai yang tidak terbaca (null) dikeluarkan dari penyebut dan disebut
 * jumlahnya, tidak dihitung sebagai "tidak".
 */
function ringkasPerkara(baris) {
  const daftar = Array.isArray(baris) ? baris : [];
  const putus = daftar.filter((b) => Boolean(b.tanggalPutusan));
  const bht = putus.filter((b) => Boolean(b.tanggalBht));
  const proses = daftar.filter((b) => !b.tanggalPutusan);

  const perStatus = new Map();
  for (const b of putus) {
    const label = cleanText(b.statusPutusan) || TANPA_STATUS;
    perStatus.set(label, (perStatus.get(label) || 0) + 1);
  }
  const hasil = [...perStatus.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"))
    .map(([label, n]) => ({ label, ...bagian(n, putus.length) }));

  const lamaSah = putus.map((b) => b.lamaHari).filter((x) => Number.isFinite(x));
  const umurProses = proses.map((b) => b.umurHari).filter((x) => Number.isFinite(x));

  const verstekTerbaca = putus.filter((b) => b.verstek === true || b.verstek === false);
  const ecourtTerbaca = daftar.filter((b) => b.ecourt === true || b.ecourt === false);
  const bandingTerbaca = putus.filter((b) => b.banding === true || b.banding === false);

  return {
    jumlah: daftar.length,
    keadaan: {
      proses: bagian(proses.length, daftar.length),
      putus: bagian(putus.length, daftar.length),
      putusBelumBht: bagian(putus.length - bht.length, daftar.length),
      bht: bagian(bht.length, daftar.length),
    },
    hasil,
    lama: {
      dihitung: lamaSah.length,
      tanpaTanggal: putus.length - lamaSah.length,
      rataHari: rataRata(lamaSah),
      medianHari: tengah(lamaSah),
      dalamBatas: bagian(lamaSah.filter((x) => x <= AMBANG_DURASI_HARI).length, lamaSah.length),
      // Perkara yang BELUM putus tetapi umurnya sudah melewati batas - yang
      // masih dapat ditindaklanjuti, berbeda dari yang sudah terlanjur lewat.
      prosesLewatBatas: bagian(umurProses.filter((x) => x > AMBANG_DURASI_HARI).length, umurProses.length),
    },
    verstek: {
      ...bagian(verstekTerbaca.filter((b) => b.verstek === true).length, verstekTerbaca.length),
      tidakTercatat: putus.length - verstekTerbaca.length,
    },
    // null = tidak terbaca sama sekali (tabelnya tidak ada) - dibedakan dari
    // "nol dari N", yang berarti terbaca dan memang tidak ada.
    ecourt:
      ecourtTerbaca.length === 0 && daftar.length > 0
        ? null
        : bagian(ecourtTerbaca.filter((b) => b.ecourt === true).length, ecourtTerbaca.length),
    banding:
      bandingTerbaca.length === 0 && putus.length > 0
        ? null
        : bagian(bandingTerbaca.filter((b) => b.banding === true).length, bandingTerbaca.length),
  };
}

/** Kelompok menurut satu kunci, masing-masing dengan ringkasannya sendiri. */
function kelompokkan(baris, ambilKunci, urutkan) {
  const peta = new Map();
  for (const b of baris) {
    const kunci = ambilKunci(b);
    if (kunci === null || kunci === undefined || kunci === "") continue;
    if (!peta.has(kunci)) peta.set(kunci, []);
    peta.get(kunci).push(b);
  }
  const hasil = [...peta.entries()].map(([kunci, isi]) => ({ kunci, ...ringkasPerkara(isi) }));
  return hasil.sort(urutkan || ((a, b) => b.jumlah - a.jumlah || String(a.kunci).localeCompare(String(b.kunci), "id")));
}

/**
 * Golongan hasil mediasi menurut sandi borang SIPP (komentar kolom
 * hasil_mediasi): Y1 berhasil dengan kesepakatan, Y2 berhasil dengan
 * pencabutan, S berhasil sebagian, T tidak berhasil, D tidak dapat
 * dilaksanakan.
 *
 * Mediasi TANPA hasil dibagi dua, dan itu disengaja: yang perkaranya masih
 * berjalan memang belum selesai, sedangkan yang perkaranya SUDAH putus berarti
 * hasilnya tidak pernah dicatat - pekerjaan yang harus dilengkapi di SIPP,
 * bukan mediasi yang sedang berlangsung.
 */
const GOLONGAN_MEDIASI = Object.freeze([
  { kunci: "berhasil", label: "Berhasil", sandi: ["Y1", "Y2"] },
  { kunci: "sebagian", label: "Berhasil sebagian", sandi: ["S"] },
  { kunci: "tidak", label: "Tidak berhasil", sandi: ["T"] },
  { kunci: "takLaksana", label: "Tidak dapat dilaksanakan", sandi: ["D"] },
  { kunci: "berjalan", label: "Belum ada hasil - perkaranya belum putus", sandi: [] },
  { kunci: "tanpaHasil", label: "Hasil tidak tercatat - perkaranya sudah putus", sandi: [] },
  { kunci: "lain", label: "Sandi hasil tidak dikenali", sandi: [] },
]);

function golonganMediasi(sandiMentah, perkaraSudahPutus) {
  const sandi = cleanText(sandiMentah).toUpperCase();
  if (!sandi) return perkaraSudahPutus ? "tanpaHasil" : "berjalan";
  const kenal = GOLONGAN_MEDIASI.find((g) => g.sandi.includes(sandi));
  return kenal ? kenal.kunci : "lain";
}

/**
 * Ringkasan mediasi seorang mediator.
 *
 * @param baris tiap baris perkara_mediasi yang dimediasinya
 * @param perkaraPutus Set perkara_id yang sudah putus
 * @param hariIni tanggal acuan YYYY-MM-DD - disuntikkan supaya dapat diuji
 */
function ringkasMediasi(baris, perkaraPutus, hariIni) {
  const daftar = Array.isArray(baris) ? baris : [];
  const hitung = new Map(GOLONGAN_MEDIASI.map((g) => [g.kunci, 0]));
  let kesepakatan = 0;
  let pencabutan = 0;
  let berjalanLewat = 0;

  for (const b of daftar) {
    const putus = perkaraPutus.has(String(b.perkaraId));
    const golongan = golonganMediasi(b.hasil, putus);
    hitung.set(golongan, hitung.get(golongan) + 1);
    const sandi = cleanText(b.hasil).toUpperCase();
    if (sandi === "Y1") kesepakatan += 1;
    if (sandi === "Y2") pencabutan += 1;
    if (golongan === "berjalan") {
      const umur = selisihHariKalender(b.penetapan, hariIni);
      if (umur !== null && umur > BATAS_MEDIASI_HARI) berjalanLewat += 1;
    }
  }

  // Tanggal yang terbalik (laporan sebelum penetapan) tidak dihitung: lama
  // negatif menurunkan rata-rata dan menyembunyikan mediasi yang lama.
  const lama = daftar.map((b) => b.lamaHari).filter((x) => Number.isFinite(x) && x >= 0);

  return {
    jumlah: daftar.length,
    perkara: new Set(daftar.map((b) => String(b.perkaraId))).size,
    // "Sandi tidak dikenali" hanya disebut bila memang ada - baris nol yang
    // selalu tampil membuat pembaca mencari masalah yang tidak ada.
    hasil: GOLONGAN_MEDIASI.filter((g) => g.kunci !== "lain" || hitung.get("lain") > 0).map((g) => ({
      kunci: g.kunci,
      label: g.label,
      ...bagian(hitung.get(g.kunci), daftar.length),
    })),
    berhasilRinci: {
      kesepakatan: bagian(kesepakatan, daftar.length),
      pencabutan: bagian(pencabutan, daftar.length),
    },
    lama: {
      dihitung: lama.length,
      rataHari: rataRata(lama),
      medianHari: tengah(lama),
      lewatBatas: bagian(lama.filter((x) => x > BATAS_MEDIASI_HARI).length, lama.length),
      berjalanLewatBatas: berjalanLewat,
      batasHari: BATAS_MEDIASI_HARI,
    },
  };
}

/**
 * Ringkasan relaas per sandi cara penyampaian.
 *
 * @param baris satu baris per (perkara, sandi): { perkaraId, sandi, n, sampai, retur }
 */
function ringkasRelaas(baris) {
  const daftar = Array.isArray(baris) ? baris : [];
  const perSandi = new Map();
  const perkara = new Set();
  let jumlah = 0;
  let jumlahSurat = 0;
  let sampai = 0;
  let retur = 0;
  for (const b of daftar) {
    // Sandi disatukan menurut huruf besar: "s" dan "S" satu cara.
    const sandi = cleanText(b.sandi).toUpperCase();
    const n = Number(b.n) || 0;
    jumlah += n;
    if (n > 0) perkara.add(String(b.perkaraId));
    perSandi.set(sandi, (perSandi.get(sandi) || 0) + n);
    if (sandi === "S") {
      jumlahSurat += n;
      sampai += Number(b.sampai) || 0;
      retur += Number(b.retur) || 0;
    }
  }

  return {
    jumlah,
    perkara: perkara.size,
    cara: [...perSandi.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([sandi, n]) => ({
        sandi,
        cara: sandi ? caraRelaas(sandi).cara : "Cara penyampaian tidak tercatat",
        ...bagian(n, jumlah),
      })),
    // Status pos hanya bermakna bagi surat tercatat (sandi S) - terukur di
    // sipp_donggala, status_pos = 2 tidak pernah muncul pada sandi lain.
    pos: {
      jumlah: jumlahSurat,
      sampai: bagian(sampai, jumlahSurat),
      retur: bagian(retur, jumlahSurat),
      belumDilacak: bagian(Math.max(0, jumlahSurat - sampai - retur), jumlahSurat),
    },
  };
}

/** Daftar perkara yang disaring dan dipotong per halaman. */
function saringDaftar(baris, pilihan) {
  const cocok = baris.filter((b) => {
    if (pilihan.tahun && b.tahun !== pilihan.tahun) return false;
    if (pilihan.kedudukan && !b.kedudukan.includes(pilihan.kedudukan)) return false;
    if (pilihan.keadaan === "proses" && b.keadaan !== "proses") return false;
    if (pilihan.keadaan === "putus" && b.keadaan === "proses") return false;
    if (pilihan.keadaan === "belum_bht" && b.keadaan !== "putus") return false;
    if (pilihan.keadaan === "bht" && b.keadaan !== "bht") return false;
    return true;
  });
  const lewati = Math.max(0, pilihan.lewati || 0);
  const batas = Math.max(1, pilihan.batas || BATAS_DAFTAR_BAWAAN);
  return {
    baris: cocok.slice(lewati, lewati + batas),
    jumlah: cocok.length,
    lewati,
    batas,
    adaLagi: lewati + batas < cocok.length,
  };
}

// ============================================================================
// KEDUDUKAN PADA SATU PERKARA - MAJELIS PEMERIKSA, BUKAN MAJELIS IKRAR
// ============================================================================
//
// Siapa PEMERIKSA suatu perkara ditentukan majelisPemeriksaService (barisPemeriksa,
// menjabatPadaPutusan), bukan di sini. Aturan itu dipakai juga oleh Status
// Perkara dan eviden SKP; bila rekap menyimpan salinannya sendiri, suatu hari
// rekap menyebut seseorang memeriksa perkara yang di layar Status Perkara
// tertulis diperiksa orang lain. Latar dan angka terukurnya - SIPP menonaktifkan
// majelis pemeriksaan saat majelis ikrar ditetapkan (perkara_id 385), pengganti
// sesudah putusan (1895, 2373, 4613), baris aktif bertanggal tidak aktif (703),
// pergantian sungguhan (10035) - ada di kepala berkas itu.
//
// Yang tetap di sini hanya yang khas rekap: kedudukan SESEORANG pada satu
// perkara, dan himpunannya atas seluruh perkaranya.

/** Kedudukan tertinggi pada satu perkara: ketua (1) > tunggal (3) > anggota (2). */
const TINGKAT_JABATAN = { 1: 1, 3: 2, 2: 3 };

const KEDUDUKAN_HAKIM = { 1: "ketua", 2: "tunggal", 3: "anggota", 4: "hakimLain" };

/** Kunci kedudukan ikrar talak per peran - "ikrar", "paniteraIkrar", "jurusitaIkrar". */
function kunciIkrar(peran) {
  return peran === "hakim" ? "ikrar" : `${peran}Ikrar`;
}

/**
 * Kedudukan seseorang pada satu perkara, dari SELURUH baris penunjukan
 * perkara itu.
 *
 * @param putus tanggal putusan perkara itu (yyyy-mm-dd), kosong bila belum.
 * @param ikrarBorang true bila borang penetapan ikrar talak menjadikannya
 *   majelis/petugas ikrar perkara ini (lihat ikrarDariBorang) - walau tabel
 *   penunjukan tidak mencatatnya.
 * @returns null bila ia tidak tercatat pada perkara ini; selainnya
 *   { kedudukan: [...], diganti } - diganti bila ia tercatat tetapi tidak
 *   memeriksa dan bukan majelis/petugas ikrar: diganti sebelum putusan, atau
 *   ditetapkan sesudahnya tanpa kedudukan ikrar.
 */
function kedudukanPadaPerkara(baris, orang, peran, putus, ikrarBorang = false) {
  const milik = baris.filter((b) => Number(b.orang) === Number(orang));
  if (milik.length === 0 && !ikrarBorang) return null;
  const pemeriksa = barisPemeriksa(baris, putus);
  const memeriksa = milik.filter((b) => pemeriksa.has(b.id));
  const kedudukan = [];
  if (memeriksa.length > 0) {
    if (peran === "hakim") {
      const tingkat = Math.min(...memeriksa.map((b) => TINGKAT_JABATAN[Number(b.jabatan)] || 4));
      kedudukan.push(KEDUDUKAN_HAKIM[tingkat]);
    } else {
      kedudukan.push(peran);
    }
  }
  const ikrar = barisIkrar(milik).length > 0 || ikrarBorang;
  if (ikrar) kedudukan.push(kunciIkrar(peran));
  return { kedudukan, diganti: kedudukan.length === 0 };
}

/**
 * Himpunan perkara seseorang beserta kedudukannya, dan jumlah perkara tempat
 * ia pernah ditunjuk lalu diganti.
 *
 * @param putusPerPerkara Map perkara_id (teks) -> tanggal putusan.
 * @param ikrarBorang Set perkara_id (teks) yang borang ikrarnya menjadikan
 *   orang ini majelis/petugas ikrar. Perkara yang TIDAK memuatnya pada tabel
 *   penunjukan sama sekali ikut masuk, berkedudukan ikrar saja.
 */
function himpunKedudukan(baris, orang, peran, putusPerPerkara, ikrarBorang = new Set()) {
  const putus = putusPerPerkara instanceof Map ? putusPerPerkara : new Map();
  const dariBorang = ikrarBorang instanceof Set ? ikrarBorang : new Set();
  const perPerkara = new Map();
  for (const b of Array.isArray(baris) ? baris : []) {
    const kunci = String(b.perkaraId);
    if (!perPerkara.has(kunci)) perPerkara.set(kunci, []);
    perPerkara.get(kunci).push(b);
  }
  for (const perkaraId of dariBorang) {
    if (!perPerkara.has(String(perkaraId))) perPerkara.set(String(perkaraId), []);
  }
  const himpunan = [];
  let diganti = 0;
  for (const [perkaraId, isi] of perPerkara) {
    const hasil = kedudukanPadaPerkara(isi, orang, peran, putus.get(perkaraId), dariBorang.has(perkaraId));
    if (!hasil) continue;
    if (hasil.diganti) diganti += 1;
    else himpunan.push({ perkaraId, kedudukan: hasil.kedudukan });
  }
  return { himpunan, diganti };
}

/**
 * Perkara yang BORANG penetapan ikrar talaknya menjadikan orang ini majelis
 * atau petugas ikrar, padahal tabel penunjukan tidak mencatatnya.
 *
 * Diputuskan ikrarLengkap (majelisPemeriksaService) - aturan yang sama dengan
 * Status Perkara dan eviden SKP: per peran, penunjukan aktif tahapan 18 bila
 * ada, selainnya borang. Jadi borang TIDAK dipakai bila tabel penunjukan
 * perkara itu mencatat majelis/petugas ikrar lain, dan id borang yang tidak
 * dapat dipasangkan dengan namanya tidak dikreditkan kepada siapa pun.
 *
 * Masukan ikrarLengkap disusun di sini untuk SATU peran saja - penunjukan
 * aktif tahapan 18 tabel peran itu dan borangnya (uraiBorangIkrar) - bukan
 * lewat penunjukanPerkaraBanyak, yang membaca ketiga tabel penunjukan dan
 * putusan untuk tiap perkara: terukur +1,0 detik pada hitungan pertama rekap
 * juru sita 22 (154 perkara borang). ikrarLengkap memilih per peran, jadi
 * tabel peran lain tidak mengubah jawabannya.
 *
 * @param idBorang perkara_id yang borangnya memuat id orang ini (FIND_IN_SET).
 * @param penunjukan baris penunjukan orang ini: perkara yang sudah ia ikrari
 *   lewat baris aktif tahapan 18 tidak perlu dibaca lagi.
 * @returns Promise<Set<string>>
 */
async function ikrarDariBorang(peran, id, idBorang, penunjukan) {
  const sudah = new Set(barisIkrar((penunjukan || []).filter((b) => Number(b.orang) === id)).map((b) => String(b.perkaraId)));
  const calon = [...new Set((idBorang || []).map((b) => String(b.perkaraId)))].filter((p) => !sudah.has(p));
  const hasil = new Set();
  if (calon.length === 0) return hasil;
  const bacaTabel = peran === "hakim" ? ikrarTabelHakim : peran === "panitera" ? ikrarTabelPanitera : ikrarTabelJurusita;
  const [barisTabel, barisBorang] = await Promise.all([
    perPotongan(calon, bacaTabel),
    perPotongan(calon, (potong, isian) => majelisPemeriksaService.bacaBorangIkrar(potong, isian)),
  ]);
  const kunciId = { hakim: "hakimId", panitera: "paniteraId", jurusita: "jurusitaId" }[peran];
  const tercatat = new Map();
  for (const b of barisIkrar(barisTabel)) {
    const kunci = String(b.perkaraId);
    if (!tercatat.has(kunci)) tercatat.set(kunci, []);
    tercatat.get(kunci).push({ [kunciId]: bacaId(b.orang) });
  }
  const borang = new Map(barisBorang.map((r) => [String(r.perkaraId), r]));
  for (const perkaraId of calon) {
    const entri = {
      ikrar: { hakim: [], panitera: [], jurusita: [], [peran]: tercatat.get(perkaraId) || [] },
      penetapanIkrar: majelisPemeriksaService.uraiBorangIkrar(borang.get(perkaraId) || null),
    };
    const lengkap = majelisPemeriksaService.ikrarLengkap(entri);
    const daftar = lengkap && Array.isArray(lengkap[peran]) ? lengkap[peran] : [];
    if (daftar.some((x) => Number(x[kunciId]) === id)) hasil.add(perkaraId);
  }
  return hasil;
}

// ============================================================================
// PEMBACAAN SIPP
// ============================================================================

/**
 * Syarat baris perkara_mediasi milik sekumpulan mediator_id.
 *
 * perkara_mediasi.mediator_id berupa DAFTAR ber-koma ("15,17" - dua mediator
 * pada satu mediasi), jadi dicocokkan dengan FIND_IN_SET, bukan "=". Baris
 * yang mediator_id-nya kosong (satu di sipp_donggala, perkara 9645) dicari
 * lewat perkara_mediator - tetap lewat ID, tidak lewat mediator_text.
 */
function syaratMediator(ids, adaPerkaraMediator) {
  const isianId = ids.map(() => "?").join(", ");
  const bagianSql = ids.map(() => "FIND_IN_SET(?, REPLACE(m.mediator_id, ' ', '')) > 0");
  const nilai = [...ids];
  if (adaPerkaraMediator) {
    bagianSql.push(
      "((m.mediator_id IS NULL OR m.mediator_id = '') AND EXISTS (SELECT 1 FROM perkara_mediator pm " +
        `WHERE pm.perkara_id = m.perkara_id AND pm.aktif = 'Y' AND pm.mediator_id IN (${isianId})))`
    );
    nilai.push(...ids);
  }
  return { sql: `(${bagianSql.join(" OR ")})`, nilai };
}

// ---- penunjukan: SELURUH baris perkara-perkara seseorang -------------------------
//
// Bukan hanya baris aktif miliknya. Kedudukannya pada satu perkara baru dapat
// ditentukan dengan melihat penunjukan orang lain pada perkara yang sama -
// siapa yang menjabat tiap kursi pada hari putusan, atau yang terakhir bila
// perkaranya belum putus. Lihat kedudukanPadaPerkara.
//
// Terukur di sipp_donggala: hakim tersibuk 7.561 baris, 0,06 detik.

async function penunjukanHakim(id) {
  return runQuery(
    `SELECT h.perkara_id AS perkaraId, h.tahapan_id AS tahapan, h.urutan AS urutan, h.hakim_id AS orang,
            h.jabatan_hakim_id AS jabatan, h.aktif AS aktif, DATE_FORMAT(h.tanggal_tidak_aktif, '%Y-%m-%d') AS tidakAktif,
            DATE_FORMAT(h.tanggal_penetapan, '%Y-%m-%d') AS penetapan, h.id AS id
       FROM perkara_hakim_pn h
      WHERE h.perkara_id IN (SELECT x.perkara_id FROM perkara_hakim_pn x WHERE x.hakim_id = ?)
      LIMIT ${BATAS_PENUNJUKAN}`,
    [id]
  );
}

async function penunjukanPanitera(id) {
  return runQuery(
    `SELECT h.perkara_id AS perkaraId, h.tahapan_id AS tahapan, h.urutan AS urutan, h.panitera_id AS orang,
            NULL AS jabatan, h.aktif AS aktif, DATE_FORMAT(h.tanggal_tidak_aktif, '%Y-%m-%d') AS tidakAktif,
            DATE_FORMAT(h.tanggal_penetapan, '%Y-%m-%d') AS penetapan, h.id AS id
       FROM perkara_panitera_pn h
      WHERE h.perkara_id IN (SELECT x.perkara_id FROM perkara_panitera_pn x WHERE x.panitera_id = ?)
      LIMIT ${BATAS_PENUNJUKAN}`,
    [id]
  );
}

async function penunjukanJurusita(id) {
  return runQuery(
    `SELECT h.perkara_id AS perkaraId, h.tahapan_id AS tahapan, h.urutan AS urutan, h.jurusita_id AS orang,
            NULL AS jabatan, h.aktif AS aktif, DATE_FORMAT(h.tanggal_tidak_aktif, '%Y-%m-%d') AS tidakAktif,
            DATE_FORMAT(h.tanggal_penetapan, '%Y-%m-%d') AS penetapan, h.id AS id
       FROM perkara_jurusita h
      WHERE h.perkara_id IN (SELECT x.perkara_id FROM perkara_jurusita x WHERE x.jurusita_id = ?)
      LIMIT ${BATAS_PENUNJUKAN}`,
    [id]
  );
}

// ---- tanggal putusan perkara-perkara yang sama ----------------------------------
//
// Penentu pemeriksa perkara yang sudah putus (menjabatPadaPutusan). Disaring
// dengan subkueri penunjukan yang sama, jadi dibaca BERSAMAAN dengan
// penunjukannya, bukan menunggunya. Terukur di sipp_donggala: hakim tersibuk
// 2.073 perkara 0,01 detik, juru sita tersibuk 0,16 detik. Putusan terakhir
// menang bila kunci (perkara_id, tanggal_putusan) menyimpan dua baris - sama
// dengan rincianPerkara.

async function putusanPenunjukanHakim(id) {
  return runQuery(
    `SELECT pu.perkara_id AS perkaraId, DATE_FORMAT(MAX(pu.tanggal_putusan), '%Y-%m-%d') AS putus
       FROM perkara_putusan pu
      WHERE pu.perkara_id IN (SELECT x.perkara_id FROM perkara_hakim_pn x WHERE x.hakim_id = ?)
      GROUP BY pu.perkara_id
      LIMIT ${BATAS_PENUNJUKAN}`,
    [id]
  );
}

async function putusanPenunjukanPanitera(id) {
  return runQuery(
    `SELECT pu.perkara_id AS perkaraId, DATE_FORMAT(MAX(pu.tanggal_putusan), '%Y-%m-%d') AS putus
       FROM perkara_putusan pu
      WHERE pu.perkara_id IN (SELECT x.perkara_id FROM perkara_panitera_pn x WHERE x.panitera_id = ?)
      GROUP BY pu.perkara_id
      LIMIT ${BATAS_PENUNJUKAN}`,
    [id]
  );
}

async function putusanPenunjukanJurusita(id) {
  return runQuery(
    `SELECT pu.perkara_id AS perkaraId, DATE_FORMAT(MAX(pu.tanggal_putusan), '%Y-%m-%d') AS putus
       FROM perkara_putusan pu
      WHERE pu.perkara_id IN (SELECT x.perkara_id FROM perkara_jurusita x WHERE x.jurusita_id = ?)
      GROUP BY pu.perkara_id
      LIMIT ${BATAS_PENUNJUKAN}`,
    [id]
  );
}

// ---- borang penetapan ikrar talak yang memuat id orang ini ----------------------
//
// Tabel penunjukan tidak selalu mencatat majelis dan petugas ikrar. Terukur di
// sipp_donggala 27 September 2026, menurut ikrarLengkap: majelis ikrar pada 73
// perkara, panitera ikrar pada 798 perkara, dan juru sita ikrar pada 829
// perkara hanya tercatat pada borang perkara_ikrar_talak - SIPP menulis
// panitera dan juru sita ikrar hampir selalu ke borang saja. Kolom id-nya daftar
// ber-koma ("9,1,6"), dicocokkan dengan FIND_IN_SET - tetap lewat id, tidak
// lewat nama; kedudukannya lalu diputuskan ikrarDariBorang.

/** Kolom id borang ikrar per peran. */
const KOLOM_BORANG_IKRAR = Object.freeze({
  hakim: "majelis_hakim_id",
  panitera: "panitera_pengganti_id",
  jurusita: "jurusita_id",
});

async function borangIkrarHakim(id) {
  return runQuery(
    `SELECT t.perkara_id AS perkaraId
       FROM perkara_ikrar_talak t
      WHERE FIND_IN_SET(?, REPLACE(t.majelis_hakim_id, ' ', '')) > 0
      LIMIT ${BATAS_PENUNJUKAN}`,
    [id]
  );
}

async function borangIkrarPanitera(id) {
  return runQuery(
    `SELECT t.perkara_id AS perkaraId
       FROM perkara_ikrar_talak t
      WHERE FIND_IN_SET(?, REPLACE(t.panitera_pengganti_id, ' ', '')) > 0
      LIMIT ${BATAS_PENUNJUKAN}`,
    [id]
  );
}

async function borangIkrarJurusita(id) {
  return runQuery(
    `SELECT t.perkara_id AS perkaraId
       FROM perkara_ikrar_talak t
      WHERE FIND_IN_SET(?, REPLACE(t.jurusita_id, ' ', '')) > 0
      LIMIT ${BATAS_PENUNJUKAN}`,
    [id]
  );
}

// ---- penunjukan tahapan 18 satu tabel atas perkara borang -----------------------
//
// Untuk ikrarDariBorang: apakah tabel penunjukan peran ini mencatat
// majelis/petugas ikrar pada perkara itu - bila ya, borang tidak dipakai.
// Keaktifannya disaring barisIkrar (majelisPemeriksaService), bukan di sini.

async function ikrarTabelHakim(potong, isian) {
  return runQuery(
    `SELECT h.perkara_id AS perkaraId, h.tahapan_id AS tahapan, h.aktif AS aktif, h.hakim_id AS orang
       FROM perkara_hakim_pn h
      WHERE h.tahapan_id = 18 AND h.perkara_id IN (${isian})`,
    potong
  );
}

async function ikrarTabelPanitera(potong, isian) {
  return runQuery(
    `SELECT h.perkara_id AS perkaraId, h.tahapan_id AS tahapan, h.aktif AS aktif, h.panitera_id AS orang
       FROM perkara_panitera_pn h
      WHERE h.tahapan_id = 18 AND h.perkara_id IN (${isian})`,
    potong
  );
}

async function ikrarTabelJurusita(potong, isian) {
  return runQuery(
    `SELECT h.perkara_id AS perkaraId, h.tahapan_id AS tahapan, h.aktif AS aktif, h.jurusita_id AS orang
       FROM perkara_jurusita h
      WHERE h.tahapan_id = 18 AND h.perkara_id IN (${isian})`,
    potong
  );
}

async function perkaraMediator(ids, ada) {
  const syarat = syaratMediator(ids, ada.perkaraMediator);
  return runQuery(
    `SELECT DISTINCT m.perkara_id AS perkaraId
       FROM perkara_mediasi m
      WHERE ${syarat.sql}
      LIMIT ${BATAS_PERKARA}`,
    syarat.nilai
  );
}

async function barisMediasi(ids, ada) {
  const syarat = syaratMediator(ids, ada.perkaraMediator);
  return runQuery(
    `SELECT m.mediasi_id AS mediasiId,
            m.perkara_id AS perkaraId,
            m.hasil_mediasi AS hasil,
            DATE_FORMAT(m.penetapan_penunjukan_mediator, '%Y-%m-%d') AS penetapan,
            DATE_FORMAT(m.tgl_laporan_mediator, '%Y-%m-%d') AS laporan,
            DATEDIFF(m.tgl_laporan_mediator, m.penetapan_penunjukan_mediator) AS lamaHari
       FROM perkara_mediasi m
      WHERE ${syarat.sql}
      ORDER BY m.penetapan_penunjukan_mediator DESC, m.mediasi_id DESC
      LIMIT ${BATAS_MEDIASI}`,
    syarat.nilai
  );
}

// ---- rincian perkara: lewat indeks, bukan lewat baris tabel perkara ------------

/** Menjalankan kerja atas potongan daftar id, lalu menggabungkan barisnya. */
async function perPotongan(daftarId, kerja) {
  const hasil = [];
  for (let i = 0; i < daftarId.length; i += POTONGAN_IN) {
    const potong = daftarId.slice(i, i + POTONGAN_IN);
    hasil.push(...(await kerja(potong, potong.map(() => "?").join(", "))));
  }
  return hasil;
}

/**
 * ============================================================================
 * TANGGAL DAFTAR, NOMOR, DAN JENIS - DIBACA DARI INDEKS SAJA
 * ============================================================================
 *
 * Tabel perkara SIPP memuat posita, petitum, dan para pihak sebagai teks
 * panjang di baris yang sama; baris sepanjang itu hanya muat beberapa per
 * halaman. Membaca 1.177 perkara seorang juru sita lewat kunci utamanya
 * memakan 1,55 detik atas sipp_donggala lokal (buffer InnoDB 16 MB, tabel
 * 60 MB) - hampir tiap baris diambil dari cakram.
 *
 * Ketiga kolom yang dibutuhkan masing-masing punya indeksnya sendiri, dan
 * indeks InnoDB selalu membawa kunci utama (perkara_id). Membaca ketiga indeks
 * itu (FORCE INDEX, "Using index") untuk perkara yang sama: 0,2 + 0,18 + 0,03
 * detik. Nama jenisnya dari tabel jenis_perkara atas id-nya - salinan nama
 * pada tabel perkara tertinggal pada 89 perkara ("Istbat Nikah" lawan
 * "Pengesahan Perkawinan/Istbat Nikah" untuk id yang sama), dan
 * mengelompokkan menurut salinan itu memecah satu jenis menjadi dua baris.
 *
 * SIPP yang indeksnya bernama lain menolak FORCE INDEX dengan galat; jalurnya
 * lalu jatuh ke pembacaan baris biasa - lebih lambat, jawabannya sama.
 */
async function dasarPerkaraLewatIndeks(daftarId, ada) {
  const [tanggal, nomor, jenis, namaJenis] = await Promise.all([
    perPotongan(daftarId, (potong, isian) =>
      runQuery(
        `SELECT p.perkara_id AS perkaraId, DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar
           FROM perkara p FORCE INDEX (tanggal_pendaftaran)
          WHERE p.perkara_id IN (${isian})`,
        potong
      )
    ),
    perPotongan(daftarId, (potong, isian) =>
      runQuery(
        `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara
           FROM perkara p FORCE INDEX (nomor_perkara)
          WHERE p.perkara_id IN (${isian})`,
        potong
      )
    ),
    perPotongan(daftarId, (potong, isian) =>
      runQuery(
        `SELECT p.perkara_id AS perkaraId, p.jenis_perkara_id AS jenisPerkaraId
           FROM perkara p FORCE INDEX (jenis_perkara_id)
          WHERE p.perkara_id IN (${isian})`,
        potong
      )
    ),
    ada.jenisPerkara
      ? runQuery(`SELECT jp.id AS id, jp.nama AS nama FROM jenis_perkara jp LIMIT 5000`)
      : Promise.resolve([]),
  ]);

  const peta = new Map();
  const ambil = (id) => {
    const kunci = String(id);
    if (!peta.has(kunci)) peta.set(kunci, { perkaraId: kunci });
    return peta.get(kunci);
  };
  for (const b of tanggal) ambil(b.perkaraId).tanggalDaftar = b.tanggalDaftar;
  for (const b of nomor) ambil(b.perkaraId).nomorPerkara = b.nomorPerkara;
  const petaNamaJenis = new Map(namaJenis.map((x) => [String(x.id), cleanText(x.nama)]));
  for (const b of jenis) {
    const baris = ambil(b.perkaraId);
    baris.jenisPerkaraId = bilangan(b.jenisPerkaraId);
    baris.jenisPerkara = petaNamaJenis.get(String(b.jenisPerkaraId)) || "";
  }
  return peta;
}

/**
 * Jalur cadangan: baris tabel perkara, bila FORCE INDEX ditolak. Nama jenisnya
 * tetap dari rujukan jenis_perkara bila tabel itu ada - dua jalur yang
 * mengelompokkan jenis secara berbeda menghasilkan dua rekap yang berbeda
 * untuk orang yang sama.
 */
async function dasarPerkaraLewatBaris(daftarId, ada) {
  const [baris, namaJenis] = await Promise.all([
    perPotongan(daftarId, (potong, isian) =>
      runQuery(
        `SELECT p.perkara_id AS perkaraId,
                p.nomor_perkara AS nomorPerkara,
                DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar,
                p.jenis_perkara_id AS jenisPerkaraId,
                p.jenis_perkara_nama AS jenisPerkara
           FROM perkara p
          WHERE p.perkara_id IN (${isian})`,
        potong
      )
    ),
    ada.jenisPerkara
      ? runQuery(`SELECT jp.id AS id, jp.nama AS nama FROM jenis_perkara jp LIMIT 5000`).catch(() => [])
      : Promise.resolve([]),
  ]);
  const petaNamaJenis = new Map(namaJenis.map((x) => [String(x.id), cleanText(x.nama)]));
  return new Map(
    baris.map((b) => [
      String(b.perkaraId),
      {
        ...b,
        perkaraId: String(b.perkaraId),
        jenisPerkara: petaNamaJenis.get(String(b.jenisPerkaraId)) || cleanText(b.jenisPerkara),
      },
    ])
  );
}

/**
 * Rincian tiap perkara: dasar (tanggal, nomor, jenis), putusan, e-Court,
 * banding, dan rentang mediasinya - tiap bagian satu kueri atas daftar id,
 * seluruhnya bersamaan.
 *
 * status_putusan_nama pada perkara_putusan TIDAK dibaca: terukur kosong pada
 * 9.474 dari 9.993 putusan di sipp_donggala. Namanya hanya ada lewat JOIN
 * status_putusan atas id-nya.
 *
 * Rentang mediasi dibaca untuk SELURUH perkara yang direkap, bukan hanya yang
 * dimediasi orang ini: hakim yang perkaranya dimediasi orang lain tetap
 * berhak atas potongan yang sama.
 */
async function rincianPerkara(daftarId, ada) {
  const [dasar, putusan, efiling, banding, rentang] = await Promise.all([
    ada.jenisPerkara
      ? dasarPerkaraLewatIndeks(daftarId, ada).then(
          (peta) => ({ peta, jalur: "indeks" }),
          () => dasarPerkaraLewatBaris(daftarId, ada).then((peta) => ({ peta, jalur: "baris" }))
        )
      : dasarPerkaraLewatBaris(daftarId, ada).then((peta) => ({ peta, jalur: "baris" })),
    perPotongan(daftarId, (potong, isian) =>
      runQuery(
        `SELECT pu.perkara_id AS perkaraId,
                DATE_FORMAT(pu.tanggal_putusan, '%Y-%m-%d') AS tanggalPutusan,
                DATE_FORMAT(pu.tanggal_bht, '%Y-%m-%d') AS tanggalBht,
                pu.putusan_verstek AS verstek,
                ${ada.statusPutusan ? "sp.nama" : "NULL"} AS statusPutusan
           FROM perkara_putusan pu
           ${ada.statusPutusan ? "LEFT JOIN status_putusan sp ON sp.id = pu.status_putusan_id" : ""}
          WHERE pu.perkara_id IN (${isian})`,
        potong
      )
    ),
    ada.efiling
      ? perPotongan(daftarId, (potong, isian) =>
          runQuery(
            `SELECT e.perkara_id AS perkaraId FROM perkara_efiling_id e
              WHERE e.perkara_id IN (${isian}) GROUP BY e.perkara_id`,
            potong
          )
        )
      : Promise.resolve(null),
    ada.banding
      ? perPotongan(daftarId, (potong, isian) =>
          runQuery(`SELECT b.perkara_id AS perkaraId FROM perkara_banding b WHERE b.perkara_id IN (${isian})`, potong)
        )
      : Promise.resolve(null),
    ada.mediasi
      ? perPotongan(daftarId, (potong, isian) =>
          runQuery(
            `SELECT m.perkara_id AS perkaraId,
                    DATE_FORMAT(m.dimulai_mediasi, '%Y-%m-%d') AS mulai,
                    DATE_FORMAT(m.keputusan_mediasi, '%Y-%m-%d') AS selesai
               FROM perkara_mediasi m
              WHERE m.dimulai_mediasi IS NOT NULL AND m.perkara_id IN (${isian})`,
            potong
          )
        )
      : Promise.resolve([]),
  ]);

  const peta = dasar.peta;
  // Putusan terakhir menang bila kunci (perkara_id, tanggal_putusan) pernah
  // menyimpan dua baris untuk satu perkara.
  for (const p of putusan) {
    const baris = peta.get(String(p.perkaraId));
    if (!baris) continue;
    if (baris.tanggalPutusan && String(p.tanggalPutusan || "") <= String(baris.tanggalPutusan)) continue;
    Object.assign(baris, {
      tanggalPutusan: p.tanggalPutusan,
      tanggalBht: p.tanggalBht,
      verstek: p.verstek,
      statusPutusan: p.statusPutusan,
    });
  }
  const berEfiling = efiling ? new Set(efiling.map((x) => String(x.perkaraId))) : null;
  const berBanding = banding ? new Set(banding.map((x) => String(x.perkaraId))) : null;
  for (const baris of peta.values()) {
    // null = tabelnya tidak ada, BUKAN "tidak": dibedakan sampai ke layar.
    baris.ecourt = berEfiling ? berEfiling.has(baris.perkaraId) : null;
    baris.banding = berBanding ? berBanding.has(baris.perkaraId) : null;
    baris.rentangMediasi = [];
  }
  for (const r of rentang) {
    const baris = peta.get(String(r.perkaraId));
    if (baris) baris.rentangMediasi.push({ mulai: tanggalIso(r.mulai), selesai: tanggalIso(r.selesai) });
  }
  return { peta, jalur: dasar.jalur };
}

/**
 * Relaas pada perkara tugasan (pemeriksaan) seorang juru sita - satu baris per
 * (perkara, sandi). Jumlah perkara berelaas dan jumlah per sandi disusun dari
 * baris yang sama, bukan dua pemindaian tabel relaas.
 *
 * Daftar perkaranya dari himpunKedudukan, bukan subkueri penunjukan aktif:
 * subkueri itu ikut menyeret perkara yang hanya ia layani pada ikrar talak.
 */
async function relaasJurusita(daftarId) {
  const baris = await perPotongan(daftarId, (potong, isian) =>
    runQuery(
      `SELECT r.perkara_id AS perkaraId,
              r.ket_temu AS sandi,
              COUNT(*) AS n,
              SUM(CASE WHEN r.status_pos = 1 THEN 1 ELSE 0 END) AS sampai,
              SUM(CASE WHEN ${sqlRetur("r")} THEN 1 ELSE 0 END) AS retur
         FROM perkara_pelaksanaan_relaas r
        WHERE r.perkara_id IN (${isian})
        GROUP BY r.perkara_id, r.ket_temu
        LIMIT ${BATAS_RELAAS}`,
      potong
    )
  );
  return ringkasRelaas(baris);
}

/**
 * Sidang pada perkara tugasan (pemeriksaan) seorang panitera pengganti.
 *
 * Tanggal acuan lewat tanda tanya, bukan CURDATE(): zona peladen basis data
 * tidak dijamin zona pengadilan. Tiap potongan daftar id menjawab satu baris
 * jumlah; seluruhnya dijumlahkan - perkara_id tidak pernah berada di dua
 * potongan, jadi hitungan perkaranya pun tidak ganda.
 */
async function sidangPanitera(daftarId, hariIni) {
  const baris = await perPotongan(daftarId, (potong, isian) =>
    runQuery(
      `SELECT COUNT(*) AS jumlah,
              COUNT(DISTINCT j.perkara_id) AS perkara,
              SUM(CASE WHEN j.tanggal_sidang < ? THEN 1 ELSE 0 END) AS lewat,
              SUM(CASE WHEN j.tanggal_sidang < ?
                        AND j.edoc_bas IS NOT NULL AND j.edoc_bas NOT IN ('', '0', '-') THEN 1 ELSE 0 END) AS basAda
         FROM perkara_jadwal_sidang j
        WHERE j.perkara_id IN (${isian})`,
      [hariIni, hariIni, ...potong]
    )
  );
  const jumlahkan = (kolom) => baris.reduce((a, b) => a + (Number(b && b[kolom]) || 0), 0);
  const jumlah = jumlahkan("jumlah");
  const lewat = jumlahkan("lewat");
  return {
    jumlah,
    perkara: jumlahkan("perkara"),
    lewat,
    akanDatang: jumlah - lewat,
    bas: bagian(jumlahkan("basAda"), lewat),
  };
}

// ---- identitas ---------------------------------------------------------------

async function identitasHakim(id) {
  const [utama] = await runQuery(
    `SELECT h.id AS id, h.kode AS kode, h.nama AS nama, h.nama_gelar AS namaGelar, h.aktif AS aktif
       FROM hakim_pn h WHERE h.id = ? LIMIT 1`,
    [id]
  );
  if (utama) return { ...utama, sumber: "hakim_pn" };
  const [salinan] = await runQuery(
    `SELECT hk.hakim_nama AS nama, hk.hakim_kode AS kode
       FROM perkara_hakim_pn hk WHERE hk.hakim_id = ? ORDER BY hk.id DESC LIMIT 1`,
    [id]
  );
  return salinan ? { ...salinan, sumber: "perkara_hakim_pn" } : null;
}

async function identitasPanitera(id) {
  const [utama] = await runQuery(
    `SELECT pn.id AS id, pn.kode AS kode, pn.nama AS nama, pn.nama_gelar AS namaGelar, pn.aktif AS aktif
       FROM panitera_pn pn WHERE pn.id = ? LIMIT 1`,
    [id]
  );
  if (utama) return { ...utama, sumber: "panitera_pn" };
  const [salinan] = await runQuery(
    `SELECT pp.panitera_nama AS nama, pp.panitera_kode AS kode
       FROM perkara_panitera_pn pp WHERE pp.panitera_id = ? ORDER BY pp.id DESC LIMIT 1`,
    [id]
  );
  return salinan ? { ...salinan, sumber: "perkara_panitera_pn" } : null;
}

async function identitasJurusita(id) {
  const [utama] = await runQuery(
    `SELECT js.id AS id, js.kode AS kode, js.nama AS nama, js.nama_gelar AS namaGelar,
            js.aktif AS aktif, js.jabatan AS jabatan
       FROM jurusita js WHERE js.id = ? LIMIT 1`,
    [id]
  );
  if (utama) return { ...utama, sumber: "jurusita" };
  const [salinan] = await runQuery(
    `SELECT pj.jurusita_nama AS nama, pj.jurusita_kode AS kode
       FROM perkara_jurusita pj WHERE pj.jurusita_id = ? ORDER BY pj.id DESC LIMIT 1`,
    [id]
  );
  return salinan ? { ...salinan, sumber: "perkara_jurusita" } : null;
}

async function identitasMediator(id, ada) {
  if (ada.mediator) {
    const [utama] = await runQuery(
      `SELECT md.id AS id, md.kode AS kode, md.nama AS nama, md.nama_gelar AS namaGelar,
              md.aktif AS aktif, md.status_mediator AS statusMediator, md.hakim_id AS hakimId,
              md.bersertifikat AS bersertifikat
         FROM mediator md WHERE md.id = ? LIMIT 1`,
      [id]
    );
    if (utama) return { ...utama, sumber: "mediator" };
  }
  if (!ada.perkaraMediator) return null;
  const [salinan] = await runQuery(
    `SELECT pm.nama_mediator AS nama, pm.status_mediator AS statusMediator
       FROM perkara_mediator pm WHERE pm.mediator_id = ? ORDER BY pm.id DESC LIMIT 1`,
    [id]
  );
  return salinan ? { ...salinan, sumber: "perkara_mediator" } : null;
}

/** Seluruh mediator_id yang dicatat SIPP untuk satu hakim_id. */
async function mediatorMilikHakim(hakimId) {
  return runQuery(
    `SELECT md.id AS id, md.status_mediator AS statusMediator
       FROM mediator md WHERE md.hakim_id = ? ORDER BY md.id ASC LIMIT 20`,
    [hakimId]
  );
}

const SEBUTAN_JABATAN_JURUSITA = { 1: "Juru sita", 2: "Juru sita pengganti" };

// ============================================================================
// PENYUSUN
// ============================================================================

/**
 * Satu baris perkara siap pakai - dari rincian SIPP beserta kedudukannya.
 *
 * Lama perkara dihitung PERSIS seperti hariSema pada durasiBanyakPerkara
 * (layar Jadwal Sidang): potongan mediasinya dari hariMediasiBersih, lalu
 * hitungWaktuPutus penilaian SK - hari pendaftaran ikut dihitung, potongan
 * dijepit agar tidak melebihi umur perkaranya - dikurangi mediasinya saja,
 * tanpa kelonggaran ghaib. Dua layar yang menyebut "lewat lima bulan" untuk
 * perkara yang sama harus sampai pada angka yang sama.
 */
function susunBaris(rinci, kedudukan, hariIni) {
  const tanggalDaftar = tanggalIso(rinci.tanggalDaftar);
  const tanggalPutusan = tanggalIso(rinci.tanggalPutusan);
  const tanggalBht = tanggalIso(rinci.tanggalBht);
  const sampai = tanggalPutusan || hariIni;
  const kalender = selisihHariKalender(tanggalDaftar, sampai);
  const potongan = hariMediasiBersih(rinci.rentangMediasi || [], tanggalDaftar, sampai);
  // Tanggal putusan sebelum pendaftaran adalah salah catat (nol baris di
  // sipp_donggala) - lamanya tidak dihitung, bukan dijadikan angka negatif.
  const waktu =
    kalender === null || kalender < 0
      ? null
      : hitungWaktuPutus({ tanggalDaftar, tanggalPutus: sampai, hariMediasi: potongan.hari, perkaraGhaib: false });
  const hariSema = waktu ? waktu.kotor - waktu.mediasi : null;

  const baris = {
    perkaraId: String(rinci.perkaraId),
    nomorPerkara: cleanText(rinci.nomorPerkara),
    tanggalDaftar,
    tahun: tanggalDaftar ? Number(tanggalDaftar.slice(0, 4)) : null,
    jenisPerkara: cleanText(rinci.jenisPerkara) || "Jenis perkara tidak tercatat",
    kedudukan: [kedudukan],
    tanggalPutusan,
    tanggalBht,
    statusPutusan: tanggalPutusan ? cleanText(rinci.statusPutusan) : "",
    verstek: tanggalPutusan ? yaTidak(rinci.verstek) : null,
    ecourt: rinci.ecourt === true || rinci.ecourt === false ? rinci.ecourt : null,
    banding: tanggalPutusan && (rinci.banding === true || rinci.banding === false) ? rinci.banding : null,
    hariMediasi: waktu ? waktu.mediasi : potongan.hari,
    // Lama perkara yang SUDAH putus; perkara berjalan memakai umurHari.
    lamaHari: tanggalPutusan ? hariSema : null,
    umurHari: tanggalPutusan ? null : hariSema,
  };
  baris.keadaan = keadaanPerkara(baris);
  return baris;
}

// ---- singgahan -----------------------------------------------------------------

const singgahan = new Map();

function ambilSinggahan(kunci, sekarang) {
  const isi = singgahan.get(kunci);
  if (!isi) return null;
  if (sekarang - isi.waktu > SINGGAHAN_MS) {
    singgahan.delete(kunci);
    return null;
  }
  return isi.inti;
}

function simpanSinggahan(kunci, inti, sekarang) {
  singgahan.set(kunci, { waktu: sekarang, inti });
  // Yang tertua dibuang lebih dulu - Map mengingat urutan pemasukan.
  while (singgahan.size > SINGGAHAN_MAKS) singgahan.delete(singgahan.keys().next().value);
}

/** Dipakai uji, dan bila SIPP baru saja diperbaiki dan angkanya harus segar. */
function kosongkanSinggahan() {
  singgahan.clear();
}

/**
 * Menghitung seluruh rekap satu orang - tanpa saringan daftar.
 *
 * Dipisah dari rekapPetugas supaya hasilnya dapat disinggahkan: saringan dan
 * halaman daftar hanya memotong hasil ini, tidak menghitung ulang.
 */
async function hitungInti(peran, id, hariIni) {
  const [
    adaStatusPutusan,
    adaEfiling,
    adaBanding,
    adaMediasi,
    adaPerkaraMediator,
    adaMediator,
    adaRelaas,
    adaJadwal,
    adaJenisPerkara,
  ] = await Promise.all([
    sippSkemaService.tabelAda("status_putusan"),
    sippSkemaService.tabelAda("perkara_efiling_id"),
    sippSkemaService.tabelAda("perkara_banding"),
    sippSkemaService.tabelAda("perkara_mediasi"),
    sippSkemaService.tabelAda("perkara_mediator"),
    sippSkemaService.tabelAda("mediator"),
    sippSkemaService.tabelAda("perkara_pelaksanaan_relaas"),
    sippSkemaService.tabelAda("perkara_jadwal_sidang"),
    sippSkemaService.tabelAda("jenis_perkara"),
  ]);
  const ada = {
    statusPutusan: adaStatusPutusan,
    efiling: adaEfiling,
    banding: adaBanding,
    mediasi: adaMediasi,
    perkaraMediator: adaPerkaraMediator,
    mediator: adaMediator,
    jenisPerkara: adaJenisPerkara,
  };
  // Borang ikrar dibaca hanya bila kolom id peran ini ada - SIPP peradilan
  // umum tidak punya tabel perkara_ikrar_talak.
  const adaBorangIkrar =
    peran !== "mediator" && (await sippSkemaService.kolomAda("perkara_ikrar_talak", KOLOM_BORANG_IKRAR[peran]));

  // Bagian yang gagal dibaca DISEBUT, tidak dijadikan nol. Nol yang lahir dari
  // kueri yang gagal terbaca sama persis dengan "memang tidak ada" - dan yang
  // membaca halaman menyimpulkan orangnya tidak mengerjakan apa pun.
  const takTerbaca = [];
  const aman = async (nama, kerja, cadangan) => {
    try {
      return await kerja();
    } catch (galat) {
      takTerbaca.push({ bagian: nama, sebab: String((galat && galat.message) || galat).slice(0, 200) });
      return cadangan;
    }
  };
  const tidakAda = Promise.resolve(null);

  // ---- tahap 1: yang tidak saling menunggu, bersamaan ------------------------
  const [identitasMentah, milikHakim, penunjukan, putusanPenunjukan, borangIkrar] = await Promise.all([
    aman(
      "identitas",
      () =>
        peran === "hakim"
          ? identitasHakim(id)
          : peran === "panitera"
            ? identitasPanitera(id)
            : peran === "jurusita"
              ? identitasJurusita(id)
              : identitasMediator(id, ada),
      null
    ),
    peran === "hakim" && ada.mediator ? aman("mediator", () => mediatorMilikHakim(id), []) : Promise.resolve([]),
    peran === "mediator"
      ? tidakAda
      : aman(
          "perkara",
          () =>
            peran === "hakim" ? penunjukanHakim(id) : peran === "panitera" ? penunjukanPanitera(id) : penunjukanJurusita(id),
          null
        ),
    // Gagal dibaca: kedudukan jatuh ke penanda aktif SIPP - yang salah pada
    // perkara ikrar talak lama - jadi kegagalannya DISEBUT, tidak diam-diam.
    peran === "mediator"
      ? tidakAda
      : aman(
          "tanggalPutusan",
          () =>
            peran === "hakim"
              ? putusanPenunjukanHakim(id)
              : peran === "panitera"
                ? putusanPenunjukanPanitera(id)
                : putusanPenunjukanJurusita(id),
          null
        ),
    // Borang ikrar yang memuat id orang ini - calon kedudukan ikrar yang tidak
    // tercatat di tabel penunjukan. Lihat ikrarDariBorang.
    adaBorangIkrar
      ? aman(
          "borangIkrar",
          () =>
            peran === "hakim" ? borangIkrarHakim(id) : peran === "panitera" ? borangIkrarPanitera(id) : borangIkrarJurusita(id),
          null
        )
      : Promise.resolve([]),
  ]);

  // Kedudukan tiap perkara dari SELURUH penunjukannya - majelis pemeriksa pada
  // hari putusan, bukan majelis ikrar yang kebetulan masih aktif. Lihat
  // kedudukanPadaPerkara. Perkara tugasan (kedudukan utama) tidak bergantung
  // pada borang ikrar - borang hanya menambah kedudukan ikrar - jadi relaas dan
  // sidang atas perkara tugasan pemeriksaan (idTugasan) tidak menunggunya.
  const putusPerPerkara = new Map((putusanPenunjukan || []).map((b) => [String(b.perkaraId), tanggalSah(b.putus)]));
  const tanpaBorang = penunjukan
    ? himpunKedudukan(penunjukan, id, peran, putusPerPerkara)
    : { himpunan: [], diganti: null };
  const utamaKunci = KEDUDUKAN_UTAMA[peran];
  const idTugasan = tanpaBorang.himpunan
    .filter((b) => b.kedudukan.some((k) => utamaKunci.includes(k)))
    .map((b) => String(b.perkaraId));

  // ---- tahap 2: relaas dan sidang atas perkara tugasan; ikrar dari borang ---
  const [relaas, sidang, ikrarBorang] = await Promise.all([
    peran === "jurusita" && adaRelaas && penunjukan ? aman("relaas", () => relaasJurusita(idTugasan), null) : tidakAda,
    peran === "panitera" && adaJadwal && penunjukan ? aman("sidang", () => sidangPanitera(idTugasan, hariIni), null) : tidakAda,
    // Penunjukan yang gagal dibaca sudah disebut; borang tidak dipakai sendirian
    // untuk menyusun kedudukan yang separuhnya tidak terbaca.
    penunjukan && borangIkrar && borangIkrar.length > 0
      ? aman("borangIkrar", () => ikrarDariBorang(peran, id, borangIkrar, penunjukan), new Set())
      : Promise.resolve(new Set()),
  ]);

  // setPenunjukan memuat juga perkara yang hanya ia layani pada ikrar talak -
  // dari tabel penunjukan maupun dari borang.
  const kedudukanPerkara =
    penunjukan && ikrarBorang.size > 0
      ? himpunKedudukan(penunjukan, id, peran, putusPerPerkara, ikrarBorang)
      : tanpaBorang;
  const setPenunjukan = kedudukanPerkara.himpunan;
  const diganti = kedudukanPerkara.diganti;

  // ---- tahap 2b: mediasi, sesudah id mediatornya diketahui --------------------
  //
  // Halaman mediator: seluruh mediator_id yang hakim_id-nya sama (tercatat
  // dua kali di SIPP = satu orang). Halaman hakim: seluruh mediator_id
  // miliknya - perkara yang ia mediasi.
  let idMediator = [];
  let hakimTertaut = null;
  if (peran === "mediator") {
    idMediator = [id];
    const hakimId = identitasMentah ? bacaId(identitasMentah.hakimId) : null;
    if (hakimId && ada.mediator) {
      hakimTertaut = hakimId;
      const saudara = await aman("mediator", () => mediatorMilikHakim(hakimId), []);
      idMediator = [...new Set([id, ...saudara.map((x) => bacaId(x.id)).filter(Boolean)])].sort((a, b) => a - b);
    }
  } else if (peran === "hakim") {
    idMediator = (milikHakim || []).map((x) => bacaId(x.id)).filter(Boolean);
  }
  const bolehMediasi = ada.mediasi && idMediator.length > 0;

  const [setMediator, mediasiMentah] = bolehMediasi
    ? await Promise.all([
        aman("perkaraMediasi", () => perkaraMediator(idMediator, ada), []),
        aman("mediasi", () => barisMediasi(idMediator, ada), []),
      ])
    : [[], []];

  const semuaId = [...new Set([...(setPenunjukan || []), ...setMediator].map((b) => String(b.perkaraId)))];
  if (!identitasMentah && semuaId.length === 0) {
    return { ditemukan: false, takTerbaca };
  }

  // ---- tahap 3: rincian seluruh perkaranya, sekali untuk semua kedudukan ------
  const rinci = semuaId.length
    ? await aman("perkara", () => rincianPerkara(semuaId, ada), { peta: new Map(), jalur: "" })
    : { peta: new Map(), jalur: "" };

  // Satu baris per perkara. Perkara yang sama dapat datang dari dua kedudukan
  // (hakim yang juga memediasi) - kedudukannya digabung, perkaranya sekali.
  const perPerkara = new Map();
  const masukkan = (perkaraId, kedudukan) => {
    const kunci = String(perkaraId);
    const ada1 = perPerkara.get(kunci);
    if (ada1) {
      if (!ada1.kedudukan.includes(kedudukan)) ada1.kedudukan.push(kedudukan);
      return;
    }
    const r = rinci.peta.get(kunci);
    // Perkara yang penunjukannya ada tetapi barisnya tidak terbaca tidak
    // dikarang - ia hilang dari hitungan, dan takTerbaca sudah menyebut sebabnya.
    if (!r) return;
    perPerkara.set(kunci, susunBaris(r, kedudukan, hariIni));
  };
  // Seorang hakim dapat memeriksa DAN menjadi majelis ikrar perkara yang sama:
  // keduanya dicatat pada baris perkara itu.
  for (const b of setPenunjukan) {
    for (const kedudukan of b.kedudukan) masukkan(b.perkaraId, kedudukan);
  }
  for (const b of setMediator) masukkan(b.perkaraId, "mediator");

  const semua = [...perPerkara.values()].sort(
    (a, b) => (b.tanggalDaftar || "").localeCompare(a.tanggalDaftar || "") || Number(b.perkaraId) - Number(a.perkaraId)
  );
  const utama = semua.filter((b) => b.kedudukan.some((k) => utamaKunci.includes(k)));

  // Mediasi terakhir orang ini pada tiap perkara, untuk kolom daftar. Kuerinya
  // sudah urut menurun menurut penetapan, jadi yang pertama terakhir.
  const mediasiTerakhir = new Map();
  for (const m of mediasiMentah) {
    const kunci = String(m.perkaraId);
    if (!mediasiTerakhir.has(kunci)) mediasiTerakhir.set(kunci, m);
  }
  for (const b of semua) {
    const m = mediasiTerakhir.get(b.perkaraId);
    if (!m) continue;
    const sandi = cleanText(m.hasil).toUpperCase();
    b.mediasi = {
      sandiHasil: sandi,
      golongan: golonganMediasi(sandi, Boolean(b.tanggalPutusan)),
      penetapan: tanggalIso(m.penetapan),
      laporan: tanggalIso(m.laporan),
      lamaHari: bilangan(m.lamaHari),
    };
  }

  const perkaraPutus = new Set(semua.filter((b) => b.tanggalPutusan).map((b) => b.perkaraId));
  const mediasiBaris = mediasiMentah.map((m) => ({
    perkaraId: String(m.perkaraId),
    hasil: m.hasil,
    penetapan: tanggalIso(m.penetapan),
    lamaHari: bilangan(m.lamaHari),
  }));

  const identitas = identitasMentah || {};
  const nama = cleanText(identitas.namaGelar) || cleanText(identitas.nama);

  // Kedudukan yang benar-benar dimiliki - pilihan saringan daftar dan tabel
  // per peran. Urutannya menurut KEDUDUKAN_PER_PERAN, bukan menurut jumlah.
  const menurutPeran = KEDUDUKAN_PER_PERAN[peran]
    .map((kunci) => {
      const isi = semua.filter((b) => b.kedudukan.includes(kunci));
      return isi.length > 0 ? { kunci, label: KEDUDUKAN[kunci], ...ringkasPerkara(isi) } : null;
    })
    .filter(Boolean);

  return {
    ditemukan: true,
    takTerbaca,
    // false bila bacaan perkara sendiri gagal. Layar TIDAK boleh menggambar
    // ringkasan "0 perkara" dalam keadaan ini - itu keterangan yang keliru,
    // bukan keterangan yang kosong.
    perkaraTerbaca: !takTerbaca.some((x) => x.bagian === "perkara" || x.bagian === "perkaraMediasi"),
    // "indeks" atau "baris" - jalur baca rincian perkara, untuk menelusuri
    // mengapa satu peladen lebih lambat daripada yang lain.
    jalurBaca: rinci.jalur,
    identitas: {
      id,
      nama: nama || `${peran} ${id}`,
      namaTerbaca: Boolean(nama),
      kode: cleanText(identitas.kode),
      aktif: yaTidak(identitas.aktif),
      // Asal nama: tabel rujukan petugas, atau - bila id itu sudah tidak ada di
      // sana - salinan nama pada penunjukan terakhirnya.
      sumber: identitas.sumber || "",
      jabatan: peran === "jurusita" ? SEBUTAN_JABATAN_JURUSITA[Number(cleanText(identitas.jabatan))] || "" : "",
      // Sandi SIPP apa adanya (H/N/P). Sebutannya - Mediator Hakim atau
      // Mediator Non Hakim - disusun portal lewat lib/sebutan-mediator, satu
      // aturan untuk seluruh layar.
      statusMediator: peran === "mediator" ? cleanText(identitas.statusMediator) : "",
      bersertifikat: peran === "mediator" ? yaTidak(identitas.bersertifikat) : null,
      hakimId: hakimTertaut,
      idMediator,
    },
    ringkas: ringkasPerkara(utama),
    diganti,
    menurutPeran,
    menurutTahun: kelompokkan(utama, (b) => b.tahun, (a, b) => b.kunci - a.kunci),
    menurutJenis: kelompokkan(utama, (b) => b.jenisPerkara),
    mediasi: bolehMediasi ? ringkasMediasi(mediasiBaris, perkaraPutus, hariIni) : null,
    relaas,
    sidang,
    semua,
    pilihanTahun: [...new Set(semua.map((b) => b.tahun).filter(Boolean))].sort((a, b) => b - a),
    pilihanKedudukan: menurutPeran.map((x) => ({ kunci: x.kunci, label: x.label, jumlah: x.jumlah })),
    terpotong:
      (penunjukan || []).length >= BATAS_PENUNJUKAN ||
      (borangIkrar || []).length >= BATAS_PENUNJUKAN ||
      setMediator.length >= BATAS_PERKARA,
  };
}

/**
 * Rekap satu petugas.
 *
 * @param masukan { peran, id, tahun, keadaan, kedudukan, lewati, batas } -
 *   seluruhnya teks dari alamat, diperiksa periksaPilihan.
 * @param opsi.hariIni tanggal acuan YYYY-MM-DD; bawaannya hari ini menurut
 *   zona pengadilan (Asia/Makassar), bukan zona mesin.
 * @param opsi.sekarang milidetik epoch untuk singgahan - disuntikkan uji.
 */
async function rekapPetugas(masukan = {}, opsi = {}) {
  const periksa = periksaPilihan(masukan);
  if (!periksa.ok) {
    return { ok: false, status: 400, alasan: periksa.alasan, error: periksa.pesan };
  }
  const pilihan = periksa.pilihan;
  const hariIni = /^\d{4}-\d{2}-\d{2}$/.test(String(opsi.hariIni || "")) ? opsi.hariIni : tanggalHariIni();
  const sekarang = Number.isFinite(opsi.sekarang) ? opsi.sekarang : Date.now();
  const { peran, id } = pilihan;

  const kunci = `${peran}:${id}:${hariIni}`;
  let inti = ambilSinggahan(kunci, sekarang);
  const dariSinggahan = Boolean(inti);
  if (!inti) {
    inti = await hitungInti(peran, id, hariIni);
    inti.dihitungPada = new Date(sekarang).toISOString();
    // Yang sebagian gagal TIDAK disinggahkan: percobaan berikutnya harus
    // mendapat kesempatan membaca bagian itu lagi, bukan mewarisi lubangnya.
    if (inti.ditemukan && inti.takTerbaca.length === 0) simpanSinggahan(kunci, inti, sekarang);
  }

  if (!inti.ditemukan) {
    // Id yang tidak dikenal sama sekali - bukan petugas tanpa perkara.
    if (inti.takTerbaca.length > 0) {
      return {
        ok: false,
        status: 502,
        alasan: "sipp_tidak_terbaca",
        error: `SIPP tidak dapat dibaca: ${inti.takTerbaca.map((x) => x.sebab).join("; ")}`,
      };
    }
    return {
      ok: false,
      status: 404,
      alasan: "petugas_tidak_ditemukan",
      error: `Tidak ada ${peran} dengan ID SIPP ${id}.`,
    };
  }

  return {
    ok: true,
    alasan: "",
    peran,
    id,
    acuan: hariIni,
    dihitungPada: inti.dihitungPada,
    dariSinggahan,
    perkaraTerbaca: inti.perkaraTerbaca,
    jalurBaca: inti.jalurBaca,
    identitas: inti.identitas,
    dasar: DASAR,
    ambang: { lamaPerkaraHari: AMBANG_DURASI_HARI, mediasiHari: BATAS_MEDIASI_HARI },
    ringkas: inti.ringkas,
    diganti: inti.diganti,
    menurutPeran: inti.menurutPeran,
    menurutTahun: inti.menurutTahun,
    menurutJenis: inti.menurutJenis,
    mediasi: inti.mediasi,
    relaas: inti.relaas,
    sidang: inti.sidang,
    daftar: {
      ...saringDaftar(inti.semua, pilihan),
      saringan: { tahun: pilihan.tahun, keadaan: pilihan.keadaan, kedudukan: pilihan.kedudukan },
      pilihanTahun: inti.pilihanTahun,
      pilihanKedudukan: inti.pilihanKedudukan,
    },
    terpotong: inti.terpotong,
    takTerbaca: inti.takTerbaca,
  };
}

module.exports = {
  PERAN_REKAP,
  KEDUDUKAN,
  KEDUDUKAN_PER_PERAN,
  KEADAAN_SARING,
  GOLONGAN_MEDIASI,
  DASAR,
  BATAS_DAFTAR_MAKS,
  SINGGAHAN_MS,
  bacaId,
  periksaPilihan,
  bagian,
  tengah,
  rataRata,
  ringkasPerkara,
  ringkasMediasi,
  ringkasRelaas,
  saringDaftar,
  golonganMediasi,
  // Dibuka untuk diukur atas seluruh basis data (sebelum/sesudah) dan diuji
  // satuan: aturan kedudukan majelis pemeriksa vs majelis ikrar talak.
  barisPemeriksa,
  kedudukanPadaPerkara,
  himpunKedudukan,
  ikrarDariBorang,
  kosongkanSinggahan,
  rekapPetugas,
};
