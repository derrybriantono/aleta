"use strict";

/**
 * Jadwal perkara yang bersidang, beserta seluruh keterangannya.
 *
 * ============================================================================
 * SATU LAYAR UNTUK SATU PERSIAPAN SIDANG
 * ============================================================================
 *
 * Sebelum ini, menyiapkan satu sidang menuntut membuka SIPP untuk majelis dan
 * agenda, e-Court untuk berkas para pihak, dan ALETA untuk keadaan verifikasi.
 * Tiga aplikasi, dan tidak satu pun yang menampilkan ketiganya sekaligus.
 *
 * Layar ini menyatukannya: satu baris per sidang, dan seluruh keterangannya
 * dibuka saat sidang itu dipilih.
 *
 * ============================================================================
 * SIPP HANYA DIBACA
 * ============================================================================
 *
 * Seluruh kueri di berkas ini SELECT. Tidak ada satu pun tulisan ke SIPP, dan
 * nomor perkara maupun tanggal selalu masuk sebagai parameter - tidak pernah
 * disambung ke dalam teks kueri.
 *
 * ============================================================================
 * NAMA TERSIMPAN LANGSUNG DI TABEL PENGHUBUNG
 * ============================================================================
 *
 * perkara_hakim_pn, perkara_panitera_pn, dan perkara_jurusita menyimpan kode
 * dan nama pejabatnya di barisnya sendiri. Karena itu tidak perlu menyambung ke
 * tabel induknya - dan yang lebih penting, keterangan sidang lama tetap
 * menunjukkan siapa yang bertugas SAAT ITU, walau orangnya sudah pindah.
 */

const db = require("../db_config");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");
const sippSkemaService = require("./sippSkemaService");
// Dimuat malas: sippTahapanService juga memuat berkas ini, dan memuat
// keduanya di kepala berkas menghasilkan rujukan berputar.
const sippTahapanService = require("./sippTahapanService");
const arsipBerkasService = require("./arsipBerkasService");
const putusanEcourtService = require("./putusanEcourtService");
// Aturan tenggang panggilan - tiga jalur beserta dasar hukumnya. Tidak
// melingkar: layanan itu hanya memuat runtime-config dan logService.
const ecourtPanggilanService = require("./ecourtPanggilanService");
// Penilaian SK 048/2024 - berkas murni tanpa require, tidak melingkar. Waktu
// putus dan pitanya dihitung DI SANA, bukan di sini.
const penilaianSippService = require("./penilaianSippService");
const { satukanPetugas } = require("./petugasPerkaraUtil");
// Pengurai pembebanan ikrar talak dari amar - berkas murni tanpa require.
const pembebananIkrarService = require("./pembebananIkrarService");
// Butir 4 (6 Okt 2026): eksepsi/rekonvensi dari jawaban & duplik Tergugat -
// singgahan di basis data BOT (bukan SIPP); lihat berkasnya.
const penandaJawabanService = require("./penandaJawabanService");
// 12 Okt 2026 (butir 5): ghaib, prodeo, dan lencana pekerjaan pihak - lihat berkasnya.
const penandaPerkaraPihakService = require("./penandaPerkaraPihakService");
/* === 12OKT-A: kumulasi perkara === */
const kumulasiPerkaraService = require("./kumulasiPerkaraService");
/* === AKHIR 12OKT-A === */
/* === 12OKT-K: sita & eksekusi === */
const sitaEksekusiPerkaraService = require("./sitaEksekusiPerkaraService");
/* === AKHIR 12OKT-K === */

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** Tanggal MySQL (YYYY-MM-DD) dari masukan bebas, atau kosong bila tidak sah. */
function tanggalMysql(nilai) {
  const teks = cleanText(nilai);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return "";
  return teks;
}

function tanggalHariIni() {
  const sekarang = new Date();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");
  return `${sekarang.getFullYear()}-${bulan}-${hari}`;
}

/** Membentuk teks tanggal dari nilai MySQL, tanpa pergeseran zona waktu. */
function isoTanggal(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    const bulan = String(nilai.getMonth() + 1).padStart(2, "0");
    const hari = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${bulan}-${hari}`;
  }
  return cleanText(nilai).slice(0, 10);
}

function jamRingkas(nilai) {
  const teks = cleanText(nilai);
  if (!teks) return "";
  return teks.slice(0, 5);
}

/**
 * Daftar sidang pada rentang tanggal.
 *
 * Majelis, panitera, dan jurusita digabung dengan GROUP_CONCAT agar satu sidang
 * tetap satu baris. Menyambungnya sebagai baris terpisah akan menggandakan
 * sidang sebanyak jumlah hakimnya - tiga baris untuk satu sidang, dan petugas
 * mengira ada tiga sidang.
 */
async function daftarSidang({ dari = "", sampai = "", cari = "", batas = 200 } = {}) {
  const mulai = tanggalMysql(dari) || tanggalHariIni();
  const akhir = tanggalMysql(sampai) || mulai;

  const syarat = ["j.tanggal_sidang BETWEEN ? AND ?"];
  const nilai = [mulai, akhir];

  const kataCari = cleanText(cari);
  if (kataCari) {
    // NAMA PIHAK ikut dicari.
    //
    // Sebelumnya hanya nomor perkara, jenis, dan agenda - sehingga mencari
    // "Dirman" di Jadwal Sidang tidak pernah menemukan apa pun, padahal nama
    // itulah yang diingat orang. Yang datang ke layar sentuh ruang tunggu
    // hampir selalu membawa namanya sendiri, bukan nomor perkaranya; tanpa ini
    // antrian mandiri tidak dapat dipakai sama sekali.
    //
    // EXISTS, bukan JOIN: perkara dengan lima pihak yang semuanya cocok tidak
    // boleh muncul lima kali di jadwal.
    syarat.push(
      `(p.nomor_perkara LIKE ?
        OR p.jenis_perkara_nama LIKE ?
        OR j.agenda LIKE ?
        ${TABEL_PIHAK.map(
          (n) => `OR EXISTS (SELECT 1 FROM perkara_pihak${n} xp
                    WHERE xp.perkara_id = p.perkara_id AND xp.nama LIKE ?)`
        ).join("\n        ")})`
    );
    // EXISTS berkorelasi atas view = view dibentuk ulang untuk TIAP baris
    // jadwal. Dipecah menjadi satu EXISTS per tabel supaya indeks perkara_id
    // terpakai.
    nilai.push(`%${kataCari}%`, `%${kataCari}%`, `%${kataCari}%`);
    for (const _ of TABEL_PIHAK) nilai.push(`%${kataCari}%`);
  }

  const rows = await runQuery(
    `SELECT j.id                  AS sidangId,
            p.perkara_id          AS perkaraId,
            p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.alur_perkara_id     AS alurPerkaraId,
            j.tanggal_sidang      AS tanggalSidang,
            j.jam_sidang          AS jamSidang,
            j.agenda              AS agenda,
            j.ruangan             AS ruangan,
            j.ditunda             AS ditunda,
            -- ==================================================================
            -- SIDANG IKRAR TALAK - BENDERA SIPP SENDIRI, BUKAN TEBAKAN AGENDA
            -- ==================================================================
            --
            -- perkara_jadwal_sidang punya kolom ikrar_talak char(1), dan
            -- itulah yang menandai sidang penyaksian ikrar - bukan tulisan
            -- pada agendanya. Diukur di PA Donggala atas 20.092 baris jadwal:
            --
            --   ikrar_talak = 'Y'   1.024 baris
            --   agenda memuat "ikrar"  ~970 baris
            --
            -- Bedanya bukan sedikit dan bukan searah. Yang berbendera Y
            -- beragenda "Panggil Termohon" (9), "tunda 6 bulan" (4),
            -- "Musyawarah Majelis" (3) - sidang ikrar yang agendanya diketik
            -- menurut apa yang dikerjakan hari itu. Sebaliknya ada 2 baris
            -- beragenda "Sidang Ikrar Talak" yang benderanya T.
            --
            -- Menebak dari agendanya karena itu salah pada dua arah
            -- sekaligus. Ejaan yang benar-benar ada di data pun belasan:
            -- "SIDANG IKRAR TALAK", "Sidank Ikrar Talak", "sidang ikrar ",
            -- "penyaksian ikrar talak", "Pengucapan Ikrar".
            j.ikrar_talak         AS ikrarTalak,
            j.urutan              AS urutanSidang,
            -- 1 semua pihak, 2 penggugat saja, 3 tergugat saja, 4 tidak hadir.
            j.dihadiri_oleh       AS dihadiriOleh,
            j.edoc_bas            AS edocBas,
            j.alasan_ditunda      AS alasanDitunda
       FROM perkara_jadwal_sidang j
       JOIN perkara p ON p.perkara_id = j.perkara_id
      WHERE ${syarat.join(" AND ")}
      -- =================================================================
      -- URUTAN: ALUR PERKARA DULU, LALU URUTAN PENDAFTARAN
      -- =================================================================
      --
      -- Gugatan, permohonan, gugatan sederhana, jinayah, lalu sisanya.
      -- Petugas menyelesaikan satu jenis perkara sekaligus, bukan berpindah
      -- jenis tiap baris.
      --
      -- Di dalam tiap jenis, yang mendaftar lebih dulu tampil lebih dulu.
      -- Nomor perkara diurut sebagai ANGKA: sebagai teks, "1000" jatuh
      -- sebelum "186", dan perkara yang mendaftar belakangan tampil di atas.
      ORDER BY j.tanggal_sidang ASC,
               j.jam_sidang ASC,
               CASE p.alur_perkara_id
                 WHEN 15 THEN 1
                 WHEN 16 THEN 2
                 WHEN 17 THEN 3
                 WHEN 122 THEN 4
                 ELSE 5
               END ASC,
               CAST(SUBSTRING_INDEX(p.nomor_perkara, '/', 1) AS UNSIGNED) ASC,
               p.nomor_perkara ASC
      LIMIT ?`,
    [...nilai, Math.min(Math.max(Number(batas) || 200, 1), 500)]
  );

  // Seluruh keterangan pelengkap diambil SEKALI untuk seluruh daftar, tidak
  // sebagai subkueri per baris. Ketiganya berjalan bersamaan dan gagal
  // sendiri-sendiri: jadwalnya tetap tampil walau salah satu tidak terbaca.
  const idPerkara = rows.map((row) => row.perkaraId);
  // ==========================================================================
  // YANG GAGAL DIBACA DICATAT, BUKAN HANYA DITELAN
  // ==========================================================================
  //
  // aman() tetap memulangkan peta kosong supaya jadwalnya tampil. Tetapi peta
  // putusan yang kosong karena GAGAL tidak sama dengan "tidak ada yang
  // putus": sejak 24 September 2026 portal menandai merah sidang yang lewat
  // pukul 15:00 tanpa hasil tercatat, dan membaca "tidak putus" dari peta
  // yang gagal berarti menuduh - diukur 18 sidang pada 4 September 2026 saja
  // yang hanya tertahan oleh peta putusan. Karena itu tiap baris membawa
  // putusanTerbaca dan ikrarTerbaca, dan portal diam bila salah satunya false.
  const gagal = new Set();
  const aman = async (kerja, nama = "") => {
    try {
      return await kerja();
    } catch {
      if (nama) gagal.add(nama);
      return {};
    }
  };

  /* === I7 17 Okt: bahan pilihan varian blangko putusan (hak asuh: Tergugat ibu; HB: amar rekonvensi) === */
  // Dimulai bersamaan, ditunggu sesudah peta lain. Gagal-terbuka dan dicatat (varianPutusanTerbaca false): tanpa bahan ini portal tetap
  // memilih blangko bawaan ([03] / [01]); varian [03a] / [01a] hanya ditawarkan sebagai pilihan tangan.
  const janjiVarianPutusan = aman(() => bahanVarianPutusan(rows), "varian-putusan");
  /* === AKHIR I7 === */

  /* === 12OKT-B: penanda perkara & pihak (dimulai bersamaan, ditunggu sesudah peta lain) === */
  const janjiBahanPenandaB = penandaPerkaraPihakService.bahanPenanda(idPerkara).catch(() => null);
  /* === AKHIR 12OKT-B === */
  /* === 12OKT-A: kumulasi perkara === */
  // Kumulasi dari SIPP (perkara_kumulasi), atau dari petitum bila SIPP
  // kosong - lihat kumulasiPerkaraService. Dimulai bersamaan dengan
  // keterangan lain; gagal-terbuka dan dicatat (kumulasiTerbaca false).
  const janjiKumulasi = aman(() => kumulasiPerkaraService.kumulasiBanyakPerkara(idPerkara), "kumulasi");
  /* === AKHIR 12OKT-A === */
  /* === 12OKT-K: sita & eksekusi === */
  // Sita dari petitum + SIPP (putusan sela, register eksekusi) dan register
  // eksekusi - lihat sitaEksekusiPerkaraService. Gagal-terbuka dan dicatat
  // (sitaTerbaca false = tidak terbaca, bukan "tidak ada sita").
  const janjiSitaEksekusi = aman(() => sitaEksekusiPerkaraService.sitaEksekusiBanyakPerkara(idPerkara), "sita");
  /* === AKHIR 12OKT-K === */

  const [
    petaPihak,
    petaPetugas,
    petaPutusan,
    petaPanggilan,
    petaBerikut,
    petaKuasa,
    petaSaksi,
    petaEcourt,
    petaDurasi,
    petaIkrar,
    petaPembebanan,
    petaMediasi,
    petaHadirLengkap,
    petaCourtCalendar,
    petaSidangLaporanMediasi,
    petaJawaban,
  ] = await Promise.all([
    aman(() => pihakBanyakPerkara(idPerkara)),
    aman(() => petugasBanyakPerkara(idPerkara)),
    aman(() => putusanBanyakPerkara(idPerkara), "putusan"),
    aman(() =>
      keadaanPanggilanSidang(
        rows.map((row) => ({ sidangId: row.sidangId, perkaraId: row.perkaraId }))
      )
    ),
    aman(() =>
      sidangBerikutnya(
        rows.map((row) => ({ sidangId: row.sidangId, perkaraId: row.perkaraId }))
      )
    ),
    aman(() => kuasaBanyakPerkara(idPerkara)),
    // Saksi yang diajukan tiap sisi. Gagal-terbuka: tabel perkara_pihak5 ada
    // pada SIPP PA, tetapi pemasangan lain dapat berbeda - dan jadwal sidang
    // tetap berguna tanpa angka saksi.
    aman(() => saksiBanyakPerkara(idPerkara)),
    // Pendaftaran e-Court - penanda e-Litigasi yang sesungguhnya. Gagal-TERTUTUP:
    // peta kosong berarti tidak ada perkara yang ditandai e-Litigasi, bukan
    // seluruhnya ditandai. Menandai saat ragu berarti menyalakan penanda pada
    // perkara yang mungkin tidak pernah menyentuh e-Court.
    aman(() => ecourtBanyakPerkara(idPerkara), "ecourt"), // 12OKT-B: dicatat bila gagal (penanda non e-Court)
    // Umur perkara, dengan hari mediasi dikeluarkan sebagaimana PERMA 1/2016
    // Pasal 24. Gagal-terbuka: jadwal sidang tetap berguna tanpa angka umur,
    // dan pemasangan yang tabel mediasinya berbeda tidak boleh menjatuhkannya.
    aman(() => durasiBanyakPerkara(idPerkara)),
    // Tanggal ikrar talak yang tercatat - untuk SELURUH perkara di daftar,
    // bukan hanya yang sidangnya berbendera ikrar: layar juga mengenali sidang
    // ikrar dari agendanya (sidangIkrar), dan sidang beragenda "Sidang Ikrar
    // Talak" berbendera T yang ikrarnya tercatat dahulu tetap tertuduh merah
    // (terukur 2 baris, 2020 dan 2026). Satu kueri IN, bukan per baris.
    //
    // Peta yang tidak terbaca - kuerinya gagal, atau tabel/kolomnya tidak ada -
    // dicatat sebagai GAGAL, bukan sebagai "tidak ada ikrar": lihat catatan
    // pada aman() di atas.
    aman(async () => {
      const peta = await ikrarBanyakPerkara(idPerkara);
      if (peta === null) {
        gagal.add("ikrar");
        return {};
      }
      return peta;
    }, "ikrar"),
    // Pembebanan yang dibayar saat ikrar (mut'ah, nafkah iddah, madliyah,
    // nafkah anak, ...) - HANYA untuk perkara yang sidangnya di daftar ini
    // sidang ikrar, satu kueri IN untuk seluruhnya. Lihat
    // pembebananBanyakPerkara. Gagal-terbuka dan dicatat: jadwal tetap tampil,
    // dan layar tahu pembebanannya tidak terbaca (bukan "tidak ada").
    aman(
      () =>
        pembebananBanyakPerkara(
          rows.filter((row) => barisSidangIkrar(row)).map((row) => row.perkaraId)
        ),
      "pembebanan"
    ),
    // Butir 7-9 (6 Okt 2026): mediasi terakhir tiap perkara (pernah mediasi,
    // hasilnya) dan sidang PERTAMA yang dihadiri kedua belah pihak. Dua kueri
    // IN untuk seluruh daftar; gagal-terbuka dan dicatat - layar diam, bukan
    // menyatakan "tidak pernah mediasi".
    aman(() => mediasiBanyakPerkara(idPerkara), "mediasi"),
    aman(() => hadirLengkapPertamaBanyakPerkara(idPerkara), "hadir-lengkap"),
    // Butir 21 (6 Okt 2026): Court Calendar tiap perkara - penanda "court
    // calendar tidak sinkron" pada perkara e-Litigasi. Gagal-terbuka dan
    // dicatat: layar diam, bukan menuduh tidak sinkron.
    aman(() => courtCalendarBanyakPerkara(idPerkara), "court-calendar"),
    // Sidang beragenda laporan hasil mediasi (paling awal) tiap perkara -
    // Court Calendar baru dibuat sesudah sidang itu ditunda, jadi penanda
    // tidak sinkron hanya menilai sidang SESUDAHNYA (perbaikan 6 Okt 2026).
    aman(() => sidangLaporanMediasiBanyakPerkara(idPerkara), "laporan-mediasi"),
    // Butir 4 (6 Okt 2026): eksepsi/rekonvensi yang terbaca dari jawaban dan
    // duplik Tergugat di arsip e-Court - SATU kueri ke basis data bot untuk
    // seluruh daftar, dari singgahan yang diisi portal (bacaannya tidak
    // diulang tiap muat). Gagal-terbuka dan dicatat: layar diam.
    aman(
      () => penandaJawabanService.petaBanyakPerkara(rows.map((row) => cleanText(row.nomorPerkara))),
      "penanda-jawaban"
    ),
  ]);

  /* === I7 17 Okt === */
  const bahanVarian = (await janjiVarianPutusan) || {};
  const petaTergugatPerempuan = bahanVarian.tergugatPerempuan || {};
  const petaAmarRekonvensi = bahanVarian.amarRekonvensi || {};
  const petaKabulSebagian = bahanVarian.kabulSebagian || {};
  const petaPencairanDana = bahanVarian.pencairanDana || {};
  const petaNafkahIstri = bahanVarian.kumulasiNafkahIstri || {};
  const petaPlusNafkahAnak = bahanVarian.plusNafkahAnak || {};
  /* === AKHIR I7 === */

  /* === 12OKT-B === */
  const bahanPenandaB = (await janjiBahanPenandaB) || {
    ghaib: {},
    prodeo: {},
    pekerjaan: {},
    terbaca: { prodeo: false, pekerjaan: false },
  };
  /* === AKHIR 12OKT-B === */

  // Keadaan putusan di e-Court, sekali untuk seluruh daftar. Bersandar pada
  // petaPutusan di atas: yang diperiksa hanya perkara yang SIPP-nya sudah
  // putus, dan perkara lain tidak perlu ditanyakan sama sekali.
  //
  // Gagal-terbuka: ini keterangan pelengkap. Pemasangan yang belum pernah
  // menjalankan penarikan e-Court belum punya tabelnya, dan jadwal sidang
  // tidak boleh ikut gagal karenanya.
  const petaPutusanEcourt = await (async () => {
    try {
      const daftar = rows
        .map((row) => ({
          nomorPerkara: cleanText(row.nomorPerkara),
          sudahPutus: Boolean((petaPutusan[String(row.perkaraId)] || {}).tanggalPutusan),
        }))
        .filter((x) => x.nomorPerkara && x.sudahPutus);
      if (daftar.length === 0) return {};
      return await putusanEcourtService.keadaanBanyak(daftar);
    } catch {
      return {};
    }
  })();

  /* === 12OKT-A: kumulasi perkara === */
  const petaKumulasi = await janjiKumulasi;
  /* === AKHIR 12OKT-A === */
  /* === 12OKT-K: sita & eksekusi === */
  const petaSitaEksekusi = await janjiSitaEksekusi;
  const petaSita = (petaSitaEksekusi && petaSitaEksekusi.sita) || {};
  const petaEksekusi = (petaSitaEksekusi && petaSitaEksekusi.eksekusi) || {};
  /* === AKHIR 12OKT-K === */

  return {
    dari: mulai,
    sampai: akhir,
    diperiksaPada: new Date().toISOString(),
    sidang: rows.map((row) => ({
      sidangId: String(row.sidangId || ""),
      perkaraId: String(row.perkaraId || ""),
      nomorPerkara: cleanText(row.nomorPerkara),
      jenisPerkara: cleanText(row.jenisPerkara),
      alurPerkaraId: Number(row.alurPerkaraId) || 0,
      tanggalSidang: isoTanggal(row.tanggalSidang),
      jamSidang: jamRingkas(row.jamSidang),
      agenda: cleanText(row.agenda),
      ruangan: cleanText(row.ruangan),
      // SIPP menyimpan 'Y' bila sidangnya ditunda.
      ditunda: cleanText(row.ditunda).toUpperCase() === "Y",
      alasanDitunda: cleanText(row.alasanDitunda),
      // Sidang penyaksian ikrar talak, menurut bendera SIPP sendiri. Lihat
      // catatan panjang di kuerinya - agendanya tidak dapat dipakai menebak.
      sidangIkrarTalak: cleanText(row.ikrarTalak).toUpperCase() === "Y",
      // Sidang yang ikrarnya SUDAH tercatat di perkara_ikrar_talak pada
      // tanggal sidang ini - hasil sidangnya ada walau alasan_ditunda kosong
      // atau "0" (26 dari 33 sidang ikrar beralasan kosong, Jan 2025 - Sep
      // 2026). Lihat ikrarBanyakPerkara.
      //
      // TANPA syarat bendera ikrar_talak sejak tinjauan 24 September 2026:
      // ikrar yang diucapkan pada tanggal sidang ini berarti sidang itulah
      // sidang ikrarnya, apa pun benderanya - dan layar mengenali sidang
      // ikrar dari agendanya juga.
      ikrarTercatat:
        Boolean(petaIkrar[String(row.perkaraId)]) &&
        petaIkrar[String(row.perkaraId)] === isoTanggal(row.tanggalSidang),
      // Terbaca tidaknya kedua peta yang menentukan "hasil sidang sudah
      // dicatat" - lihat catatan pada aman(). false berarti portal TIDAK
      // menandai merah, sebab ketiadaan hasilnya tidak terbukti.
      putusanTerbaca: !gagal.has("putusan"),
      ikrarTerbaca: !gagal.has("ikrar"),
      // ====================================================================
      // PEMBEBANAN SAAT IKRAR TALAK - HANYA PADA SIDANG IKRAR
      // ====================================================================
      //
      // Diurai dari amar putusan (perkara_putusan.amar_putusan) - tabel
      // perkara_nafkah_istri milik SIPP praktis tidak pernah diisi (1 baris
      // di satker). null pada sidang yang bukan ikrar, dan pada sidang
      // ikrar yang putusannya tidak memuat pembebanan apa pun.
      // pembebananTerbaca false = kuerinya gagal; layar lalu diam, bukan
      // menyatakan "tanpa pembebanan".
      pembebanan: barisSidangIkrar(row) ? petaPembebanan[String(row.perkaraId)] || null : null,
      pembebananTerbaca: !gagal.has("pembebanan"),
      // Butir 7-9 (6 Okt 2026). mediasi: mediasi TERAKHIR perkara ini (null =
      // belum pernah); hadirLengkapPertama: tanggal sidang pertama yang
      // dihadiri kedua belah pihak menurut SIPP (dihadiri_oleh = 1), "" bila
      // belum pernah. Terbaca false = kuerinya gagal; layar diam.
      mediasi: petaMediasi[String(row.perkaraId)] || null,
      mediasiTerbaca: !gagal.has("mediasi"),
      hadirLengkapPertama: petaHadirLengkap[String(row.perkaraId)] || "",
      hadirLengkapTerbaca: !gagal.has("hadir-lengkap"),
      // Butir 21: seluruh rencana Court Calendar perkara ini [{tanggal, agenda}]
      // ([] = belum dibuat). Terbaca false = kuerinya gagal.
      courtCalendar: petaCourtCalendar[String(row.perkaraId)] || [],
      courtCalendarTerbaca: !gagal.has("court-calendar"),
      // Tanggal sidang PALING AWAL perkara ini yang beragenda laporan hasil
      // mediasi ("" = tidak ada). Lihat sidangLaporanMediasiBanyakPerkara.
      sidangLaporanMediasi: petaSidangLaporanMediasi[String(row.perkaraId)] || "",
      sidangLaporanMediasiTerbaca: !gagal.has("laporan-mediasi"),
      // Butir 4 (6 Okt 2026): { eksepsi, rekonvensi, dokumen, dibaca,
      // belumDibaca, tidakTerbaca } - null bila perkara ini tidak punya
      // jawaban/duplik Tergugat di arsip. eksepsi/rekonvensi null = tidak satu
      // pun berkasnya terbaca (BUKAN "tidak ada"). Lihat penandaJawabanService.
      penandaJawaban: petaJawaban[cleanText(row.nomorPerkara)] || null,
      penandaJawabanTerbaca: !gagal.has("penanda-jawaban"),
      urutanSidang: Number(row.urutanSidang) || 0,
      dihadiriOleh: row.dihadiriOleh === null || row.dihadiriOleh === undefined ? null : Number(row.dihadiriOleh),
      adaBas: Boolean(cleanText(row.edocBas)),
      pihak: petaPihak[String(row.perkaraId)] || { penggugat: [], tergugat: [] },
      // Sidang berikutnya pada perkara yang sama - inilah "ditunda sampai
      // kapan" yang selalu ditanya orang.
      tanggalSidangBerikut: petaBerikut[String(row.sidangId)] || "",
      panggilan: petaPanggilan[String(row.sidangId)] || {
        hadirSebelumnya: null,
        wajibDipanggil: [],
        belumDipanggil: 0,
        retur: 0,
        aman: true,
      },
      // ====================================================================
      // UMUR PERKARA - DAN HARI MEDIASI TIDAK DIHITUNG
      // ====================================================================
      //
      // Diminta pengguna 23 September 2026. Dasarnya PERMA 1/2016 Pasal 24
      // ayat (2) dan (3): jangka waktu mediasi TIDAK termasuk jangka waktu
      // penyelesaian perkara. Batas penyelesaiannya lima bulan (SEMA 2/2014).
      //
      // null bila tanggal pendaftarannya tidak terbaca - bukan nol. Sejak 24
      // September 2026 hari pendaftaran ikut dihitung (cara SK 048/2024), jadi
      // perkara yang didaftarkan hari ini berumur 1 hari, bukan 0.
      durasi: petaDurasi[String(row.perkaraId)] || null,
      majelisKode: (petaPetugas[String(row.perkaraId)] || {}).majelisKode || "",
      majelisNama: (petaPetugas[String(row.perkaraId)] || {}).majelisNama || "",
      paniteraNama: (petaPetugas[String(row.perkaraId)] || {}).paniteraNama || "",
      jurusitaNama: (petaPetugas[String(row.perkaraId)] || {}).jurusitaNama || "",
      // Ada tidaknya kuasa hukum pada tiap sisi. Mengubah SIAPA yang dipanggil
      // dan siapa yang hadir - dan yang membacakan jadwal perlu tahu sebelum
      // memanggil, bukan sesudah membuka rinciannya satu per satu.
      adaKuasa: Boolean((petaKuasa[String(row.perkaraId)] || {}).adaKuasa),
      kuasaPihak1: Boolean((petaKuasa[String(row.perkaraId)] || {}).kuasaPihak1),
      kuasaPihak2: Boolean((petaKuasa[String(row.perkaraId)] || {}).kuasaPihak2),
      sudahPutus: Boolean((petaPutusan[String(row.perkaraId)] || {}).tanggalPutusan),
      tanggalPutusan: (petaPutusan[String(row.perkaraId)] || {}).tanggalPutusan || "",
      statusPutusan: (petaPutusan[String(row.perkaraId)] || {}).statusPutusan || "",
      tanggalMinutasi: (petaPutusan[String(row.perkaraId)] || {}).tanggalMinutasi || "",
      tanggalBht: (petaPutusan[String(row.perkaraId)] || {}).tanggalBht || "",
      verstekPutusan: Boolean((petaPutusan[String(row.perkaraId)] || {}).verstek),
      // I7 17 Okt: true/false = jenis kelamin Tergugat pertama pada gugatan hak asuh (P = perempuan); null = bukan hak asuh / tidak terbaca.
      tergugatPerempuan: petaTergugatPerempuan[String(row.perkaraId)] === undefined ? null : petaTergugatPerempuan[String(row.perkaraId)],
      // I7 17 Okt: potongan amar putusan HB mulai "Dalam Rekonvensi" ("" = tidak ada / tidak terbaca) - dasar blangko [01a] rekonvensi dikabulkan.
      amarRekonvensi: petaAmarRekonvensi[String(row.perkaraId)] || "",
      // I20 18 Okt: dikabulkan untuk sebagian menurut amar (true/false); null = bukan gugatan anak / amar belum ada / tidak terbaca.
      dikabulkanSebagian: petaKabulSebagian[String(row.perkaraId)] === undefined ? null : petaKabulSebagian[String(row.perkaraId)],
      // I22 18 Okt: petitum memohon pencairan dana (PAW, itsbat kontensius) / nafkah istri (cerai gugat); null = bukan jenis itu / petitum tidak terbaca.
      pencairanDana: petaPencairanDana[String(row.perkaraId)] === undefined ? null : petaPencairanDana[String(row.perkaraId)],
      kumulasiNafkahIstri: petaNafkahIstri[String(row.perkaraId)] === undefined ? null : petaNafkahIstri[String(row.perkaraId)],
      // I23 18 Okt: petitum hak asuh juga memuat nafkah (anak); null = bukan hak asuh / tidak terbaca.
      plusNafkahAnak: petaPlusNafkahAnak[String(row.perkaraId)] === undefined ? null : petaPlusNafkahAnak[String(row.perkaraId)],
      varianPutusanTerbaca: !gagal.has("varian-putusan"),
      // Saksi yang DIAJUKAN tiap sisi - bukan yang sudah diperiksa. Dipakai
      // penanda "Saksi P / Saksi T" di daftar.
      saksiPihak1: Number((petaSaksi[String(row.perkaraId)] || {}).diajukanPihak1) || 0,
      saksiPihak2: Number((petaSaksi[String(row.perkaraId)] || {}).diajukanPihak2) || 0,
      // Namanya ikut supaya layar dapat menyebut SIAPA, bukan hanya berapa.
      saksiNamaPihak1: (petaSaksi[String(row.perkaraId)] || {}).namaPihak1 || [],
      saksiNamaPihak2: (petaSaksi[String(row.perkaraId)] || {}).namaPihak2 || [],
      // Terdaftar lewat e-Court. Syarat PERTAMA penanda e-Litigasi; syarat
      // keduanya - agendanya tahapan yang dipertukarkan elektronik - diperiksa
      // di layar, karena di sanalah daftar agendanya dirawat.
      lewatEcourt: Boolean(petaEcourt[String(row.perkaraId)]),
      /* === 12OKT-B: penanda perkara & pihak === */
      // false = peta e-Court gagal dibaca: portal TIDAK menandai "non e-Court"
      // (peta kosong karena gagal bukan berarti perkaranya non e-Court).
      ecourtTerbaca: !gagal.has("ecourt"),
      // penandaPerkara {ghaib, ghaibSumber, prodeo}; penandaPihak [{sisi, nama, kunci, label, ragu, kalimat}]
      ...penandaPerkaraPihakService.ruasBaris(bahanPenandaB, row.perkaraId),
      /* === AKHIR 12OKT-B === */
      // Naskah sudah diunggah tetapi minutasi belum bertanggal: yang menagih
      // bukan hakimnya lagi, melainkan panitera penggantinya.
      adaBerkasPutusan: Boolean((petaPutusan[String(row.perkaraId)] || {}).adaBerkasPutusan),
      // Terisi hanya pada perkara yang sudah putus. null berarti belum putus,
      // atau keadaan e-Courtnya memang tidak dapat dibaca - dua hal yang
      // sama-sama BUKAN masalah putusan.
      putusanEcourt: petaPutusanEcourt[cleanText(row.nomorPerkara)] || null,
      /* === 12OKT-A: kumulasi perkara === */
      // { daftar: [{kode, nama, sumber: "sipp"|"petitum", kutipan?}], sumber }
      // atau null bila tidak berkumulasi. kumulasiTerbaca false = gagal dibaca.
      kumulasi: petaKumulasi[String(row.perkaraId)] || null,
      kumulasiTerbaca: !gagal.has("kumulasi"),
      /* === AKHIR 12OKT-A === */
      /* === 12OKT-K: sita & eksekusi === */
      // { daftar: [{kode, nama, sumber: "petitum"|"sipp"|"keduanya", kutipan?,
      // catatanSipp?}] } atau null; eksekusi: [] register eksekusi perkara ini.
      sita: petaSita[String(row.perkaraId)] || null,
      eksekusi: petaEksekusi[String(row.perkaraId)] || [],
      sitaTerbaca: !gagal.has("sita"),
      /* === AKHIR 12OKT-K === */
    })),
  };
}

/**
 * Rekap jumlah sidang per hari dalam satu bulan - isi kalender sidang.
 *
 * ============================================================================
 * HITUNGAN SAJA, BUKAN DAFTAR PERKARANYA
 * ============================================================================
 *
 * Kalender hanya perlu tahu hari mana yang ada sidangnya dan berapa banyak.
 * Mengirim seluruh perkara sebulan hanya untuk menggambar angka di kotak
 * tanggal berarti memindahkan ribuan baris yang tidak satu pun ditampilkan -
 * dan memajang nomor perkara sebulan penuh di satu jawaban.
 */
async function rekapBulanSidang(bulanMentah) {
  const bulan = cleanText(bulanMentah);
  if (!/^\d{4}-\d{2}$/.test(bulan)) {
    return { bulan: "", hari: [] };
  }

  const [tahun, nomorBulan] = bulan.split("-").map((bagian) => Number(bagian));
  if (nomorBulan < 1 || nomorBulan > 12) return { bulan: "", hari: [] };

  // Hari terakhir bulan itu: tanggal 0 bulan berikutnya.
  const hariTerakhir = new Date(tahun, nomorBulan, 0).getDate();
  const awal = `${bulan}-01`;
  const akhir = `${bulan}-${String(hariTerakhir).padStart(2, "0")}`;

  const rows = await runQuery(
    `SELECT j.tanggal_sidang AS tanggal,
            COUNT(*) AS jumlah,
            SUM(CASE WHEN j.ditunda = 'Y' THEN 1 ELSE 0 END) AS jumlahDitunda
       FROM perkara_jadwal_sidang j
      WHERE j.tanggal_sidang BETWEEN ? AND ?
      GROUP BY j.tanggal_sidang
      ORDER BY j.tanggal_sidang ASC`,
    [awal, akhir]
  );

  return {
    bulan,
    awal,
    akhir,
    hari: rows.map((row) => ({
      tanggal: isoTanggal(row.tanggal),
      jumlah: Number(row.jumlah) || 0,
      jumlahDitunda: Number(row.jumlahDitunda) || 0,
    })),
  };
}

/**
 * Seluruh jadwal sidang satu perkara - kalender perkara itu sendiri.
 *
 * Menjawab pertanyaan yang berbeda dari kalender bulanan: bukan "hari ini
 * sidang apa saja", melainkan "perkara ini sudah sampai mana". Riwayat agenda
 * dan penundaannya adalah yang dibaca majelis sebelum sidang berikutnya.
 */
async function jadwalPerkara(nomorPerkaraMentah) {
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara) return [];

  const rows = await runQuery(
    `SELECT j.id             AS sidangId,
            j.tanggal_sidang AS tanggalSidang,
            j.jam_sidang     AS jamSidang,
            j.agenda         AS agenda,
            j.ruangan        AS ruangan,
            j.ditunda        AS ditunda,
            j.alasan_ditunda AS alasanDitunda,
            j.dihadiri_oleh  AS dihadiriOleh,
            j.urutan         AS urutanSidang,
            j.edoc_bas       AS edocBas
       FROM perkara_jadwal_sidang j
       JOIN perkara p ON p.perkara_id = j.perkara_id
      WHERE p.nomor_perkara = ?
      ORDER BY j.tanggal_sidang ASC, j.jam_sidang ASC`,
    [nomorPerkara]
  );

  return rows.map((row) => ({
    sidangId: String(row.sidangId || ""),
    tanggalSidang: isoTanggal(row.tanggalSidang),
    jamSidang: jamRingkas(row.jamSidang),
    agenda: cleanText(row.agenda),
    ruangan: cleanText(row.ruangan),
    ditunda: cleanText(row.ditunda).toUpperCase() === "Y",
    alasanDitunda: cleanText(row.alasanDitunda),
    urutanSidang: Number(row.urutanSidang) || 0,
    dihadiriOleh: row.dihadiriOleh === null || row.dihadiriOleh === undefined ? null : Number(row.dihadiriOleh),
    // Berita Acara Sidang tersimpan sebagai berkas pada baris sidangnya.
    adaBas: Boolean(cleanText(row.edocBas)),
  }));
}

/**
 * Apakah perkara ini terdaftar lewat e-Court?
 *
 * ==========================================================================
 * MENENTUKAN ATURAN PANGGILAN MANA YANG BERLAKU
 * ==========================================================================
 *
 * Perkara e-Court tunduk pada SK KMA 363/2022: panggilan elektronik paling
 * lambat 3 Hari, surat tercatat paling lambat 6 Hari - keduanya hari kalender.
 *
 * Perkara BIASA tunduk pada Pasal 122 HIR: paling sedikit tiga hari KERJA,
 * untuk seluruh pihak, tanpa jalur elektronik sama sekali.
 *
 * Memakai aturan e-Court pada perkara biasa akan menandai panggilan yang sah
 * sebagai cacat, dan sebaliknya.
 */
async function perkaraLewatEcourt(perkaraId) {
  const rows = await runQuery(
    `SELECT 1 AS ada FROM perkara_efiling_id k WHERE k.perkara_id = ? LIMIT 1`,
    [perkaraId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Perkara mana saja yang terdaftar lewat e-Court, untuk sekumpulan perkara.
 *
 * ============================================================================
 * KENAPA PENANDA e-LITIGASI TIDAK BOLEH BERSANDAR PADA AGENDA SAJA
 * ============================================================================
 *
 * Tahapan yang dipertukarkan lewat aplikasi pada e-Litigasi - jawaban, replik,
 * duplik, kesimpulan, musyawarah majelis, pembacaan putusan - SEMUANYA juga
 * terjadi pada perkara biasa. Pengukuran agenda 2026 di PA Donggala: 31 sidang
 * beragenda "Musyawarah Majelis" dan 20 "Pembacaan putusan", dan sebagian besar
 * di antaranya perkara yang tidak pernah menyentuh e-Court sama sekali.
 *
 * Menandai perkara e-Litigasi dari agendanya saja karena itu akan menyalakan
 * penanda pada perkara biasa - dan saringan yang memunculkan perkara yang
 * bukan e-Litigasi lebih menyesatkan daripada tidak ada saringan, karena
 * pembacanya menyangka daftar itu sudah lengkap dan tepat.
 *
 * perkara_efiling_id adalah pendaftaran e-Court yang sesungguhnya. Penanda
 * e-Litigasi menuntut KEDUANYA: perkaranya terdaftar lewat e-Court, DAN
 * agendanya salah satu tahapan yang dipertukarkan elektronik.
 */
async function ecourtBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};

  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  const rows = await runQuery(
    `SELECT DISTINCT k.perkara_id AS perkaraId
       FROM perkara_efiling_id k
      WHERE k.perkara_id IN (${isian})`,
    dipakai
  );

  const hasil = {};
  for (const baris of Array.isArray(rows) ? rows : []) hasil[String(baris.perkaraId)] = true;
  return hasil;
}

/**
 * Meringkas amar putusan menjadi teks pendek tanpa tag HTML.
 *
 * Amar disimpan SIPP sebagai HTML dari penyunting kaya - menampilkannya apa
 * adanya akan memunculkan tag di layar. Dipotong pula panjangnya: naskah
 * putusan utuh bukan yang dicari di layar jadwal sidang.
 */
function bersihkanAmar(nilai) {
  const teks = String(nilai || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return teks.length > 600 ? `${teks.slice(0, 600)}...` : teks;
}
/**
 * Keadaan putusan perkara: putusan, minutasi, BHT, akta cerai, upaya hukum.
 *
 * ============================================================================
 * SATU PERKARA BERJALAN TERUS SETELAH DIPUTUS
 * ============================================================================
 *
 * Putusan bukan akhir. Sesudahnya masih ada minutasi berkas, tenggang upaya
 * hukum sampai putusan berkekuatan hukum tetap, lalu produk pengadilan yang
 * diserahkan kepada pihak - pada perkara perceraian, akta cerai.
 *
 * Tiap tahap itu punya tenggatnya sendiri, dan yang terlewat baru ketahuan
 * ketika ada yang menanyakan. Karena itu keempatnya dibaca sekaligus.
 *
 * ============================================================================
 * TIAP BAGIAN GAGAL SENDIRI-SENDIRI
 * ============================================================================
 *
 * Tabel akta cerai dan upaya hukum tidak selalu ada isinya - dan pada sebagian
 * pemasangan SIPP, tabelnya sendiri dapat berbeda. Kegagalan membaca salah
 * satunya tidak boleh menghilangkan putusan yang sudah terbaca.
 */
async function putusanPerkara(perkaraId) {
  const aman = async (kerja, cadangan) => {
    try {
      return await kerja();
    } catch {
      return cadangan;
    }
  };

  const [barisPutusan, barisAkta, banding, kasasi, pk] = await Promise.all([
    aman(
      () =>
        runQuery(
          // ==================================================================
          // NAMA STATUS DIAMBIL DARI TABEL RUJUKAN, BUKAN SALINAN DI BARISNYA
          // ==================================================================
          //
          // perkara_putusan.status_putusan_nama adalah salinan yang SIPP isi
          // hanya kadang-kadang. Pengukuran di PA Donggala: 9.480 dari 9.998
          // baris putusan menyimpan NULL di sana, padahal status_putusan_id-nya
          // terisi. Itulah sebab kolom "Jenis putusan" di layar jadwal berbunyi
          // "belum tercatat" pada hampir seluruh perkara.
          //
          // Salinannya juga dapat USANG: satu baris berstatus id 65 (Digugurkan)
          // menyimpan nama "Dikabulkan" - dua hal yang berlawanan. Karena itu
          // yang dipakai selalu nama dari status_putusan, dan salinannya hanya
          // menjadi cadangan bila id-nya sendiri tidak ada di tabel rujukan.
          `SELECT pu.tanggal_putusan AS tanggalPutusan,
                  COALESCE(sp.nama, pu.status_putusan_nama) AS statusPutusan,
                  pu.putusan_verstek AS verstek,
                  pu.tanggal_cabut AS tanggalCabut,
                  pu.tanggal_gugur AS tanggalGugur,
                  pu.tanggal_minutasi AS tanggalMinutasi,
                  pu.tanggal_bht AS tanggalBht,
                  pu.amar_putusan AS amarPutusan,
                  pu.amar_putusan_dok AS amarDok,
                  pu.amar_putusan_anonimisasi_dok AS amarAnonimDok
             FROM perkara_putusan pu
             LEFT JOIN status_putusan sp ON sp.id = pu.status_putusan_id
            WHERE pu.perkara_id = ?
            ORDER BY pu.tanggal_putusan DESC
            LIMIT 1`,
          [perkaraId]
        ),
      []
    ),
    aman(
      () =>
        runQuery(
          `SELECT ak.nomor_akta_cerai AS nomorAkta,
                  ak.tgl_akta_cerai AS tanggalAkta,
                  ak.no_seri_akta_cerai AS nomorSeri,
                  ak.tgl_penyerahan_akta_cerai AS diserahkanPihak1,
                  ak.tgl_penyerahan_akta_cerai_pihak2 AS diserahkanPihak2,
                  ak.akta_cerai_dok AS berkasAkta
             FROM perkara_akta_cerai ak
            WHERE ak.perkara_id = ?
            ORDER BY ak.tgl_akta_cerai DESC
            LIMIT 1`,
          [perkaraId]
        ),
      []
    ),
    aman(
      () =>
        runQuery(
          `SELECT b.permohonan_banding AS tanggal FROM perkara_banding b
            WHERE b.perkara_id = ? ORDER BY b.permohonan_banding DESC LIMIT 1`,
          [perkaraId]
        ),
      []
    ),
    aman(
      () =>
        runQuery(
          `SELECT k.permohonan_kasasi AS tanggal FROM perkara_kasasi k
            WHERE k.perkara_id = ? ORDER BY k.permohonan_kasasi DESC LIMIT 1`,
          [perkaraId]
        ),
      []
    ),
    aman(
      () =>
        runQuery(
          `SELECT k.permohonan_pk AS tanggal FROM perkara_pk k
            WHERE k.perkara_id = ? ORDER BY k.permohonan_pk DESC LIMIT 1`,
          [perkaraId]
        ),
      []
    ),
  ]);

  const putusan = barisPutusan[0] || null;
  const akta = barisAkta[0] || null;

  const upaya = [];
  if (banding[0] && banding[0].tanggal) upaya.push({ jenis: "Banding", tanggal: isoTanggal(banding[0].tanggal) });
  if (kasasi[0] && kasasi[0].tanggal) upaya.push({ jenis: "Kasasi", tanggal: isoTanggal(kasasi[0].tanggal) });
  if (pk[0] && pk[0].tanggal) upaya.push({ jenis: "Peninjauan Kembali", tanggal: isoTanggal(pk[0].tanggal) });

  return {
    sudahPutus: Boolean(putusan && putusan.tanggalPutusan),
    tanggalPutusan: putusan ? isoTanggal(putusan.tanggalPutusan) : "",
    statusPutusan: putusan ? cleanText(putusan.statusPutusan) : "",
    // SIPP menyimpan 'Y' bila putusannya verstek.
    verstek: putusan ? cleanText(putusan.verstek).toUpperCase() === "Y" : false,
    tanggalCabut: putusan ? isoTanggal(putusan.tanggalCabut) : "",
    tanggalGugur: putusan ? isoTanggal(putusan.tanggalGugur) : "",
    tanggalMinutasi: putusan ? isoTanggal(putusan.tanggalMinutasi) : "",
    tanggalBht: putusan ? isoTanggal(putusan.tanggalBht) : "",
    // Amar dipotong: yang diperlukan di layar jadwal adalah keadaannya, bukan
    // seluruh naskah putusan. Naskah lengkapnya tetap ada di SIPP.
    amarRingkas: putusan ? bersihkanAmar(putusan.amarPutusan) : "",
    // Naskah putusan tersimpan sebagai berkas. Yang anonim adalah yang boleh
    // dipublikasikan; yang asli memuat identitas para pihak.
    adaBerkasPutusan: Boolean(putusan && cleanText(putusan.amarDok)),
    adaBerkasAnonim: Boolean(putusan && cleanText(putusan.amarAnonimDok)),
    aktaCerai: akta
      ? {
          nomor: cleanText(akta.nomorAkta),
          tanggal: isoTanggal(akta.tanggalAkta),
          nomorSeri: cleanText(akta.nomorSeri),
          diserahkanPihak1: isoTanggal(akta.diserahkanPihak1),
          diserahkanPihak2: isoTanggal(akta.diserahkanPihak2),
          adaBerkas: Boolean(cleanText(akta.berkasAkta)),
        }
      : null,
    upayaHukum: upaya,
  };
}

/**
 * Majelis, panitera, dan jurusita untuk sekumpulan perkara sekaligus.
 *
 * ============================================================================
 * SATU KUERI, BUKAN SUBKUERI PER BARIS
 * ============================================================================
 *
 * Sebelumnya keempat keterangan ini diambil sebagai subkueri berkorelasi di
 * dalam kueri jadwal. MySQL menjalankan subkueri semacam itu SEKALI UNTUK TIAP
 * BARIS: jadwal 127 perkara berarti lebih dari lima ratus kali eksekusi, dan
 * layarnya terasa menggantung berdetik-detik.
 *
 * Sekarang seluruhnya diambil sekali dengan GROUP BY, lalu disatukan di Node.
 */
async function petugasBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};

  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  // ==========================================================================
  // BARIS MENTAH, PENYATUANNYA DI NODE
  // ==========================================================================
  //
  // GROUP_CONCAT sebelumnya menyatukan di SQL, dan dua hal lolos karenanya:
  //
  //   1. SIPP menyimpan baris kembar untuk orang yang sama - kadang persis
  //      sama, kadang beda ejaan gelar ("Mohammad Syukri" dan "Mohammad
  //      Syukri, S.H."). Layar lalu berbunyi seolah ada dua jurusita.
  //   2. Pada perkara ikrar talak, baris hakim yang AKTIF justru berkode
  //      NULL, sedangkan kodenya ada di baris yang tidak aktif. Penyaringan
  //      aktif='Y' membuat kolom Majelis berbunyi "—" pada seluruh perkara
  //      ikrar talak.
  //
  // Keduanya menuntut penilaian yang tidak dapat ditulis sebagai GROUP BY.
  // Karena itu SELURUH baris diambil - aktif maupun tidak - lalu disatukan
  // satukanPetugas(), yang diuji tersendiri.
  const [majelis, panitera, jurusita] = await Promise.all([
    runQuery(
      `SELECT hk.perkara_id AS perkaraId, hk.hakim_kode AS kode,
              hk.hakim_nama AS nama, hk.urutan AS urutan, hk.aktif AS aktif
         FROM perkara_hakim_pn hk
        WHERE hk.perkara_id IN (${isian})`,
      dipakai
    ),
    runQuery(
      `SELECT pn.perkara_id AS perkaraId, pn.panitera_nama AS nama,
              pn.urutan AS urutan, pn.aktif AS aktif
         FROM perkara_panitera_pn pn
        WHERE pn.perkara_id IN (${isian})`,
      dipakai
    ),
    runQuery(
      `SELECT js.perkara_id AS perkaraId, js.jurusita_nama AS nama,
              js.urutan AS urutan, js.aktif AS aktif
         FROM perkara_jurusita js
        WHERE js.perkara_id IN (${isian})`,
      dipakai
    ),
  ]);

  const hasil = {};
  const ambil = (kunci) => {
    if (!hasil[kunci]) {
      hasil[kunci] = { majelisKode: "", majelisNama: "", paniteraNama: "", jurusitaNama: "" };
    }
    return hasil[kunci];
  };

  const kelompokkan = (baris) => {
    const peta = new Map();
    for (const b of Array.isArray(baris) ? baris : []) {
      const kunci = String(b.perkaraId);
      if (!peta.has(kunci)) peta.set(kunci, []);
      peta.get(kunci).push(b);
    }
    return peta;
  };

  for (const [kunci, baris] of kelompokkan(majelis)) {
    const satu = satukanPetugas(baris);
    const isi = ambil(kunci);
    isi.majelisKode = cleanText(satu.kode);
    isi.majelisNama = cleanText(satu.nama);
  }
  for (const [kunci, baris] of kelompokkan(panitera)) {
    ambil(kunci).paniteraNama = cleanText(satukanPetugas(baris).nama);
  }
  for (const [kunci, baris] of kelompokkan(jurusita)) {
    ambil(kunci).jurusitaNama = cleanText(satukanPetugas(baris).nama);
  }

  return hasil;
}

/**
 * Ada tidaknya kuasa hukum pada tiap sisi, untuk sekumpulan perkara sekaligus.
 *
 * ============================================================================
 * DIBACA DI DAFTAR, BUKAN HANYA SAAT DIBUKA
 * ============================================================================
 *
 * Ada tidaknya kuasa mengubah SIAPA yang dipanggil dan siapa yang hadir di
 * ruang sidang. Selama ini keterangan itu baru terlihat sesudah satu sidang
 * dibuka satu per satu - padahal yang membacakan jadwal perlu tahu sebelum
 * memanggil, bukan sesudah.
 *
 * Tabel dan kolomnya sama persis dengan yang dipakai sippIdentitasPerkaraService
 * saat membuka satu perkara: perkara_pengacara(perkara_id, nama, pihak_ke,
 * urutan). Menyalin bentuk yang sudah berjalan, bukan menebak yang baru.
 */
async function kuasaBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};

  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  const baris = await runQuery(
    `SELECT a.perkara_id AS perkaraId, a.pihak_ke AS pihakKe
       FROM perkara_pengacara a
      WHERE a.perkara_id IN (${isian})`,
    dipakai
  );

  const hasil = {};
  for (const b of Array.isArray(baris) ? baris : []) {
    const kunci = String(b.perkaraId);
    if (!hasil[kunci]) hasil[kunci] = { adaKuasa: false, kuasaPihak1: false, kuasaPihak2: false };
    hasil[kunci].adaKuasa = true;
    if (Number(b.pihakKe) === 1) hasil[kunci].kuasaPihak1 = true;
    if (Number(b.pihakKe) === 2) hasil[kunci].kuasaPihak2 = true;
  }
  return hasil;
}

/**
 * ============================================================================
 * TANGGAL IKRAR TALAK YANG TERCATAT - UNTUK SIDANG IKRAR YANG ALASANNYA KOSONG
 * ============================================================================
 *
 * Sidang ikrar talak yang ikrarnya sudah terlaksana sering hanya dicatat di
 * perkara_ikrar_talak (tgl_ikrar_talak), sementara alasan_ditunda di jadwalnya
 * dibiarkan kosong atau "0". Layar Antrian Sidang lalu menandainya merah
 * "Belum ditunda" - tuduhan palsu, sebab hasil sidangnya memang tercatat,
 * hanya di tabel lain.
 *
 * Diukur di sipp_donggala 24 September 2026 atas sidang berbendera
 * ikrar_talak = 'Y':
 *
 *   seluruh tahun              1.024 sidang ikrar, 832 ikrarTercatat;
 *                              488 alasan kosong/"0", 394 di antaranya
 *                              ikrarTercatat
 *   1 Jan 2025 - 10 Sep 2026     191 sidang ikrar, 153 ikrarTercatat;
 *                                33 alasan kosong/"0", 26 di antaranya
 *                                ikrarTercatat - 26 dari 33 tanda merah
 *                                palsu tertutup
 *
 * DICOCOKKAN LEWAT TANGGAL, BUKAN perkara_ikrar_talak.sidang_id: kolom itu
 * menunjuk sidang yang lain. Pada rentang yang sama 26 baris bertanggal ikrar
 * sama dengan tanggal sidangnya tetapi sidang_id-nya menunjuk sidang ikrar
 * lain perkara itu (misalnya perkara 8240: sidang 21 Jan 2025, sidang_id
 * menunjuk sidang 10 Des 2024).
 *
 * Satu kueri untuk seluruh daftar, bukan subkueri per baris di kueri jadwal:
 * keterangan pelengkap di berkas ini diambil sekali dan gagal sendiri-sendiri.
 * Menanamkannya di kueri jadwal berarti tabel yang tidak ada menjatuhkan
 * SELURUH jadwal. Tabel dan kolomnya dicek lewat sippSkemaService (tabel
 * terdaftar di TABEL, kolom lewat CALON ikrarTanggal); bila tidak ada,
 * yang dipulangkan null - BUKAN peta kosong. Peta kosong berarti "tidak ada
 * ikrar yang tercatat"; null berarti "tidak diketahui", dan pemanggilnya
 * mencatatnya sebagai gagal dibaca (ikrarTerbaca false) supaya layar tidak
 * menuduh sidang ikrar yang ikrarnya barangkali tercatat.
 *
 * @returns {Promise<Record<string, string> | null>} perkaraId -> tanggal ikrar (YYYY-MM-DD)
 */
async function ikrarBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};
  if (!(await sippSkemaService.tabelAda("perkara_ikrar_talak"))) return null;
  const kolom = await sippSkemaService.kolomTerpilih();
  if (!kolom.ikrarTanggal) return null;

  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  const baris = await runQuery(
    `SELECT it.perkara_id AS perkaraId,
            it.${kolom.ikrarTanggal} AS tanggalIkrar
       FROM perkara_ikrar_talak it
      WHERE it.perkara_id IN (${isian})`,
    dipakai
  );

  const hasil = {};
  for (const b of Array.isArray(baris) ? baris : []) {
    const tanggal = isoTanggal(b.tanggalIkrar);
    // perkara_id kunci utama tabel itu - satu baris per perkara. Bila suatu
    // pemasangan berbeda, yang pertama bertanggal dipakai.
    if (tanggal && !hasil[String(b.perkaraId)]) hasil[String(b.perkaraId)] = tanggal;
  }
  return hasil;
}

/**
 * ============================================================================
 * MEDIASI TERAKHIR TIAP PERKARA (6 Okt 2026, butir 8-9)
 * ============================================================================
 *
 * hasil_mediasi SIPP (keterangan kolomnya di skrip ubah-skema SIPP sendiri,
 * dan pemakaiannya di laporan mediasi SIPP):
 *   Y / Y1  berhasil dengan perdamaian (akta perdamaian)
 *   Y2      berhasil dengan pencabutan
 *   S       berhasil sebagian
 *   T       tidak berhasil
 *   D       tidak dapat dilaksanakan
 * Diukur di server 6 Okt 2026: 762 baris, 758 perkara; Y1 13, Y2 45, S 157,
 * T 459, D 22, kosong 66 (mediasi berjalan).
 *
 * "Pernah mediasi" = ada baris perkara_mediasi (mediator ditunjuk - kolom
 * penetapan_penunjukan_mediator terisi pada 762 dari 762). Bila satu perkara
 * bermediasi lebih dari sekali, yang TERAKHIR (mediasi_id terbesar) dipakai.
 *
 * @returns {Promise<Record<string, {ditunjuk: string, dimulai: string, hasil: string, keputusan: string, mediator: string}>>}
 */
async function mediasiBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};
  if (!(await sippSkemaService.tabelAda("perkara_mediasi"))) return {};
  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");
  // Tanggal laporan mediator kepada majelis (6 Okt 2026, penanda Court
  // Calendar). Diukur di server: terisi pada 698 dari 698 mediasi berhasil-
  // bertanggal, 230 di antaranya LEBIH LAMBAT dari keputusan_mediasi. Kolomnya
  // ditanyakan dulu - pemasangan SIPP lama yang tidak memilikinya tetap
  // mendapat peta mediasi, hanya tanpa tanggal laporan.
  const adaLaporan = await sippSkemaService.kolomAda("perkara_mediasi", "tgl_laporan_mediator").catch(() => false);
  const baris = await runQuery(
    `SELECT m.perkara_id AS perkaraId, m.mediasi_id AS mediasiId,
            m.penetapan_penunjukan_mediator AS ditunjuk, m.dimulai_mediasi AS dimulai,
            m.hasil_mediasi AS hasil, m.keputusan_mediasi AS keputusan, m.mediator_text AS mediator,
            ${adaLaporan ? "m.tgl_laporan_mediator" : "NULL"} AS laporan
       FROM perkara_mediasi m
      WHERE m.perkara_id IN (${isian})
      ORDER BY m.perkara_id, m.mediasi_id`,
    dipakai
  );
  const hasil = {};
  for (const b of Array.isArray(baris) ? baris : []) {
    // Urut naik per perkara: yang terakhir menimpa yang sebelumnya.
    hasil[String(b.perkaraId)] = {
      ditunjuk: isoTanggal(b.ditunjuk),
      dimulai: isoTanggal(b.dimulai),
      hasil: cleanText(b.hasil).toUpperCase(),
      keputusan: isoTanggal(b.keputusan),
      laporan: isoTanggal(b.laporan),
      mediator: cleanText(b.mediator),
    };
  }
  return hasil;
}

/**
 * Agenda "laporan hasil mediasi" - polanya SAMA dengan tahapan
 * "laporan-mediasi" di portal (lib/court-calendar-sinkron.ts). Ditulis sebagai
 * regex POSIX MySQL; [[:space:]] karena MariaDB 5.5 tidak mengenal \s.
 */
const POLA_AGENDA_LAPORAN_MEDIASI = "(laporan|hasil)[[:space:]]+(hasil[[:space:]]+)?medias";

/**
 * Tanggal sidang PALING AWAL tiap perkara yang beragenda laporan hasil
 * mediasi ("Mendengarkan Hasil Mediasi", "mendengarkan laporan mediasi", ...)
 * - perbaikan 6 Okt 2026. Court Calendar e-Litigasi dibuat sesudah sidang itu
 * ditunda; penanda "CC tidak sinkron" menilai sidang sesudahnya saja. Diukur
 * di server 6 Okt 2026: 215 perkara memiliki sidang beragenda itu. Satu kueri IN.
 *
 * @returns {Promise<Record<string, string>>} perkaraId -> "YYYY-MM-DD"
 */
async function sidangLaporanMediasiBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};
  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");
  const baris = await runQuery(
    `SELECT perkara_id AS perkaraId, MIN(tanggal_sidang) AS pertama
       FROM perkara_jadwal_sidang
      WHERE perkara_id IN (${isian}) AND LOWER(agenda) REGEXP ?
      GROUP BY perkara_id`,
    [...dipakai, POLA_AGENDA_LAPORAN_MEDIASI]
  );
  const hasil = {};
  for (const b of Array.isArray(baris) ? baris : []) {
    const t = isoTanggal(b.pertama);
    if (t) hasil[String(b.perkaraId)] = t;
  }
  return hasil;
}

/**
 * Court Calendar (rencana sidang) tiap perkara - butir 21, 6 Okt 2026. Satu
 * kueri IN. Satu perkara rata-rata 2-3 baris (median diukur butir 29), jadi
 * seluruhnya dikirim dan kecocokannya dinilai di portal (lib/court-calendar-sinkron).
 *
 * @returns {Promise<Record<string, Array<{tanggal: string, agenda: string}>>>}
 */
async function courtCalendarBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};
  if (!(await sippSkemaService.tabelAda("perkara_court_calendar"))) return {};
  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");
  const baris = await runQuery(
    `SELECT perkara_id AS perkaraId, rencana_tanggal AS tanggal, rencana_agenda AS agenda
       FROM perkara_court_calendar
      WHERE perkara_id IN (${isian})
      ORDER BY perkara_id, rencana_tanggal`,
    dipakai
  );
  const hasil = {};
  for (const b of Array.isArray(baris) ? baris : []) {
    const k = String(b.perkaraId);
    if (!hasil[k]) hasil[k] = [];
    if (hasil[k].length < 60) hasil[k].push({ tanggal: isoTanggal(b.tanggal), agenda: cleanText(b.agenda) });
  }
  return hasil;
}

/**
 * Tanggal sidang PERTAMA yang dihadiri kedua belah pihak (dihadiri_oleh = 1,
 * "Semua Pihak" di blangko SIPP) - butir 7, 6 Okt 2026. Satu kueri IN.
 *
 * @returns {Promise<Record<string, string>>} perkaraId -> "YYYY-MM-DD"
 */
async function hadirLengkapPertamaBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};
  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");
  const baris = await runQuery(
    `SELECT perkara_id AS perkaraId, MIN(tanggal_sidang) AS pertama
       FROM perkara_jadwal_sidang
      WHERE perkara_id IN (${isian}) AND dihadiri_oleh = 1
      GROUP BY perkara_id`,
    dipakai
  );
  const hasil = {};
  for (const b of Array.isArray(baris) ? baris : []) {
    const t = isoTanggal(b.pertama);
    if (t) hasil[String(b.perkaraId)] = t;
  }
  return hasil;
}

/**
 * Baris jadwal ini sidang ikrar talak? Aturannya SAMA dengan sidangIkrar di
 * portal (lib/keadaan-sidang.ts): bendera ikrar_talak SIPP lebih dulu, lalu
 * kata "ikrar" pada agendanya. Dua tempat yang berbeda aturan akan membuat
 * baris yang bertanda biru "Ikrar Talak" tidak pernah membawa pembebanannya.
 */
function barisSidangIkrar(row) {
  if (cleanText(row && row.ikrarTalak).toUpperCase() === "Y") return true;
  return /\bikrar\b/i.test(cleanText(row && row.agenda));
}

/**
 * ============================================================================
 * PEMBEBANAN SAAT IKRAR TALAK - SATU KUERI UNTUK SELURUH SIDANG IKRAR DI DAFTAR
 * ============================================================================
 *
 * Mut'ah, nafkah iddah, nafkah madliyah, nafkah anak, dan pembebanan lain
 * yang menurut amar dibayar sebelum/saat ikrar diucapkan. Diurai dari
 * perkara_putusan.amar_putusan oleh pembebananIkrarService - sebabnya (tabel
 * perkara_nafkah_istri SIPP hanya 1 baris di satker) dan ukuran
 * keterbacaannya tercatat di berkas itu.
 *
 * Hanya perkara yang sidangnya di daftar ini sidang ikrar yang ditanyakan -
 * amar putusan adalah teks panjang, dan membacanya untuk seluruh sidang hari
 * itu berarti memindahkan ratusan naskah yang tidak satu pun ditampilkan.
 * Putusan TERAKHIR per perkara yang dipakai (tanggal_putusan bagian dari
 * kunci tabelnya).
 *
 * @returns {Promise<Record<string, object>>} perkaraId -> hasil uraiPembebanan,
 *   hanya untuk perkara yang memang punya pembebanan (atau menyebutnya tetapi
 *   tidak terbaca).
 */
async function pembebananBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};

  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  const baris = await runQuery(
    `SELECT pu.perkara_id AS perkaraId,
            pu.tanggal_putusan AS tanggalPutusan,
            pu.amar_putusan AS amarPutusan
       FROM perkara_putusan pu
      WHERE pu.perkara_id IN (${isian})
      ORDER BY pu.perkara_id ASC, pu.tanggal_putusan DESC`,
    dipakai
  );

  const hasil = {};
  const sudah = new Set();
  for (const b of Array.isArray(baris) ? baris : []) {
    const kunci = String(b.perkaraId);
    if (sudah.has(kunci)) continue;
    sudah.add(kunci);
    const urai = pembebananIkrarService.uraiPembebanan(b.amarPutusan);
    if (pembebananIkrarService.adaPembebanan(urai)) {
      hasil[kunci] = { ...urai, tanggalPutusan: isoTanggal(b.tanggalPutusan) };
    }
  }
  return hasil;
}

/** Keadaan putusan untuk sekumpulan perkara sekaligus. */
/**
 * ============================================================================
 * DURASI PERKARA - DAN HARI MEDIASI TIDAK DIHITUNG
 * ============================================================================
 *
 * Pasal 24 ayat (2) dan (3) PERMA 1/2016: jangka waktu mediasi TIDAK termasuk
 * jangka waktu penyelesaian perkara. Menghitungnya begitu saja dari tanggal
 * pendaftaran berarti menuduh majelis atas hari-hari yang menurut peraturan
 * memang bukan miliknya - dan pada perkara yang mediasinya berjalan penuh itu
 * selisih sampai tiga puluh hari.
 *
 * Batasnya lima bulan (SEMA 2/2014), yang di ALETA sudah tertulis sebagai
 * AMBANG_HARI = 150 pada analisaPerkaraService. Angkanya disalin, bukan
 * diambil lewat require - berkas itu sengaja dibuat murni tanpa basis data,
 * dan menukar arah kebergantungannya akan mengotorinya.
 *
 * ============================================================================
 * DIBACA DARI perkara_mediasi, BUKAN DARI VIEW
 * ============================================================================
 *
 * SIPP punya view v_durasi_mediasi, dan sippTahapanService memakainya untuk
 * satu perkara. Di sini tabelnya yang dibaca langsung, karena dua hal:
 *
 *   1. impor dump SIPP memulihkan tabel tetapi TIDAK memulihkan satu pun view
 *      (0 dari 125 terukur), sehingga jalur view mati diam-diam pada
 *      pemasangan hasil impor;
 *   2. yang dibutuhkan di sini BANYAK perkara sekaligus - satu kueri untuk
 *      lima ratus baris jadwal, bukan lima ratus kueri.
 *
 * ============================================================================
 * TIGA KEADAAN DATA YANG SUNGGUH ADA, DAN PENAWARNYA
 * ============================================================================
 *
 *   - keputusan_mediasi lebih awal daripada dimulai_mediasi (terpendek -10
 *     hari di satker ini). Tiap potongan dijepit ke nol; tanggal yang terbalik
 *     tidak boleh MENAMBAH umur perkara.
 *   - mediasi yang belum selesai (67 baris tanpa keputusan). Dihitung sampai
 *     hari ini - ia memang sedang berjalan.
 *   - satu perkara dengan beberapa baris mediasi (2-3). Seluruhnya dijumlah;
 *     mediasi lanjutan sesudah tahap pertama gagal memang menambah waktunya.
 *
 * Sejak 24 September 2026 warnanya mengikuti tangga unsur Waktu Putus Perkara
 * SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024 - hari bersih dan nilainya
 * dihitung penilaianSippService.hitungWaktuPutus, bukan di berkas ini - atas
 * hari berjalan di luar mediasi, dengan kelonggaran perkara khusus SK
 * (ghaib 120 hari) dipotong dari hariBersih, sedangkan sisaHari terhadap
 * batas lima bulan SEMA 2/2014 dihitung dari hariSema, TANPA kelonggaran itu.
 */
const AMBANG_DURASI_HARI = 150;

async function durasiBanyakPerkara(daftarPerkaraId = [], opsi = {}) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};

  // Kueri yang gagal di bawah tetap DITELAN - jadwal sidang tetap berguna
  // tanpa angka umur. Tetapi pemanggil yang harus membedakan "tidak terbaca"
  // dari "tidak ada" (checklist milestone: batas lima bulan yang dihitung
  // tanpa hari mediasi menuduh majelis) mengirim opsi.catatGagal dan diberi
  // tahu bagian mana yang gagal. Pemakai lain tidak mengirimnya, dan bagi
  // mereka tidak ada yang berubah.
  const catatGagal = typeof opsi.catatGagal === "function" ? opsi.catatGagal : () => {};

  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  const adaMediasi = await sippSkemaService.tabelAda("perkara_mediasi");

  const rows = await runQuery(
    `SELECT p.perkara_id       AS perkaraId,
            p.tanggal_pendaftaran AS tanggalDaftar,
            MAX(pu.tanggal_putusan) AS tanggalPutusan
       FROM perkara p
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE p.perkara_id IN (${isian})
      GROUP BY p.perkara_id, p.tanggal_pendaftaran`,
    dipakai
  ).catch((galat) => {
    catatGagal("perkara", galat);
    return [];
  });

  const mediasiRows = adaMediasi
    ? await runQuery(
        `SELECT m.perkara_id        AS perkaraId,
                m.dimulai_mediasi   AS mulai,
                m.keputusan_mediasi AS selesai,
                m.hasil_mediasi     AS hasil,
                m.mediator_text     AS mediator
           FROM perkara_mediasi m
          WHERE m.perkara_id IN (${isian})
            AND m.dimulai_mediasi IS NOT NULL
          ORDER BY m.perkara_id ASC, m.dimulai_mediasi ASC`,
        dipakai
      ).catch((galat) => {
        catatGagal("mediasi", galat);
        return [];
      })
    : [];

  // ==========================================================================
  // KELONGGARAN PERKARA GHAIB - 120 HARI, SK 048/2024 TABEL 2 NOMOR 1
  // ==========================================================================
  //
  // Diminta pengguna 24 September 2026 petang: "perkara ghaib itu dipotong 120
  // hari dari hitungan hari perkara". Perkara ghaib memang berjalan lebih lama
  // karena hukum acaranya sendiri - pemanggilannya lewat pengumuman, bukan
  // relaas biasa - dan menghitungnya sebagai keterlambatan berarti menghukum
  // majelis atas kepatuhan. Diukur di sipp_donggala: dari 66 perkara ghaib
  // 2025-2026, 49 oranye dan 2 merah tanpa kelonggaran ini, dan SELURUHNYA
  // hijau dengannya.
  //
  // YANG TIDAK IKUT DIPOTONG: batas lima bulan SEMA 2/2014. Kelonggaran ini
  // milik PENILAIAN KINERJA SK; SEMA tidak mengenalnya, dan majelis tetap
  // wajib melapor kepada Ketua Pengadilan. Karena itu ruas sisaHari di bawah
  // dihitung dari hariSema - kotor dikurangi mediasi SAJA. Rancangan
  // 24 September pagi memotongnya juga, dan perkara 232/Pdt.G/2026 yang
  // berjalan 163 hari tampil "43 hari, sisa 107": kewajiban lapornya hilang
  // dari layar. Dua kewajiban berbeda, dua angka.
  //
  // Penciri ghaibnya dibaca sippTahapanService - penciri yang SAMA dengan
  // layar Status Perkara, bukan penciri kedua. Sampai hari ini Antrian memakai
  // jarak PHS saja sedangkan Status Perkara memakai empat sumber, dan ketiga
  // perkara yang berselisih antar-layar (65, 76, dan 158/Pdt.G/2025) justru
  // yang berada di celah itu. Gagal-tertutup: kueri yang gagal berarti tidak
  // ghaib, berarti tanpa kelonggaran.
  const petaGhaib = await sippTahapanService.penandaGhaibBanyakPerkara(dipakai).catch(() => ({}));

  const mediasiPerPerkara = {};
  for (const baris of Array.isArray(mediasiRows) ? mediasiRows : []) {
    const kunci = String(baris.perkaraId);
    if (!mediasiPerPerkara[kunci]) mediasiPerPerkara[kunci] = [];
    mediasiPerPerkara[kunci].push({
      mulai: isoTanggal(baris.mulai),
      selesai: isoTanggal(baris.selesai),
      hasil: sebutanHasilMediasi(baris.hasil),
      mediator: cleanText(baris.mediator),
    });
  }

  const hariIni = isoTanggal(new Date());
  const hasil = {};
  for (const baris of Array.isArray(rows) ? rows : []) {
    const kunci = String(baris.perkaraId);
    const tanggalDaftar = isoTanggal(baris.tanggalDaftar);
    const tanggalPutusan = isoTanggal(baris.tanggalPutusan);
    const mediasi = mediasiPerPerkara[kunci] || [];

    const sampai = tanggalPutusan || hariIni;
    const hariTotal = selisihHariKalender(tanggalDaftar, sampai);

    const { hari: hariMediasi, dibatasi: mediasiDibatasi } = hariMediasiBersih(
      mediasi,
      tanggalDaftar,
      sampai
    );

    // ======================================================================
    // TANGGA WAKTU PUTUS DARI PENILAIAN SK, BUKAN DITULIS ULANG DI SINI
    // ======================================================================
    //
    // Hari pendaftaran ikut dihitung dan mediasi dipotong, lalu dinilai
    // dengan TANGGA SK 048/2024 (90/120/150 hari) lewat fungsi yang sama yang
    // menilai unsur waktu putus di layar Status Perkara. hariBersih karena
    // itu satu hari lebih besar daripada sebelum 24 September: dulu hari
    // pendaftaran tidak dihitung, dan perkara "90 hari" di sini bernilai 3
    // di sana.
    //
    // Yang TIDAK sama dengan Status Perkara: hari mediasinya dibaca dari
    // perkara_mediasi (dibatasi 60 hari), bukan dari view v_durasi_mediasi.
    // Terukur 24 September 2026: dari 118 perkara 2025-2026 yang bermediasi,
    // 11 berselisih antara kedua sumber. Penciri ghaibnya kini SAMA, jadi
    // selisih yang tersisa antar-layar hanya itu - bukan lagi seluruh perkara
    // ghaib.
    const ghaib = petaGhaib[kunci] || null;
    const waktuPutus =
      hariTotal === null
        ? null
        : penilaianSippService.hitungWaktuPutus({
            tanggalDaftar,
            tanggalPutus: sampai,
            hariMediasi,
            perkaraGhaib: Boolean(ghaib),
          });
    const hariBersih = waktuPutus ? waktuPutus.bersih : null;
    // Hari yang dihitung terhadap SEMA 2/2014: kotor dikurangi mediasi, TANPA
    // kelonggaran SK. Inilah angka yang menentukan sisaHari - dan satu-satunya
    // penjaga agar potongan ghaib tidak pernah menyembunyikan kewajiban lapor.
    const hariSema = waktuPutus ? waktuPutus.kotor - waktuPutus.mediasi : null;

    hasil[kunci] = {
      tanggalDaftar,
      tanggalPutusan,
      sudahPutus: Boolean(tanggalPutusan),
      hariTotal,
      // hariTotal + 1 - hari pendaftaran ikut dihitung, cara SK.
      hariKotor: waktuPutus ? waktuPutus.kotor : null,
      hariMediasi,
      /**
       * true bila potongan mediasinya dipotong ke batas PERMA (60 hari).
       * Disebutkan supaya angka yang tampak "bulat" dapat ditelusuri - dan
       * supaya tidak ada yang mengira ALETA menyembunyikan selisihnya.
       */
      mediasiDibatasi,
      hariBersih,
      // Kelonggaran perkara khusus yang SUDAH dipotong dari hariBersih - null
      // bila tidak ada. Sumbernya disebutkan supaya panitera dapat menilai
      // sendiri apakah penandanya masuk akal, bukan menerimanya begitu saja.
      kelonggaran:
        waktuPutus && waktuPutus.potongan.hari > 0
          ? {
              hari: waktuPutus.potongan.hari,
              hariMentah: waktuPutus.potongan.hariMentah,
              sebab: waktuPutus.potongan.sebab,
              sumber: ghaib ? ghaib.sumber : [],
              jarakPhsHari: ghaib ? ghaib.jarakPhsHari : null,
            }
          : null,
      hariSema,
      ambangHari: AMBANG_DURASI_HARI,
      // Sisa hari sampai batas lima bulan SEMA 2/2014, dihitung dari hariSema
      // dan BUKAN dari hariBersih: SEMA tidak mengenal kelonggaran SK.
      // Negatif berarti lewat.
      sisaHari: hariSema === null ? null : AMBANG_DURASI_HARI - hariSema,
      // Nilai unsur waktu putus SK 048/2024. Layar hanya menerjemahkan nilai
      // ini ke warna - lihat lib/pita-waktu-putus di portal.
      waktuPutusSk: waktuPutus
        ? {
            nilai: waktuPutus.nilai,
            sebutan: waktuPutus.sebutan,
            dariHari: waktuPutus.dariHari,
            sampaiHari: waktuPutus.sampaiHari,
            sisaDiPita: tanggalPutusan ? null : waktuPutus.sisaDiPita,
          }
        : null,
      mediasi,
    };
  }
  return hasil;
}

/**
 * ============================================================================
 * BATAS MEDIASI MENURUT PERMA, BUKAN MENURUT ISI KOLOMNYA
 * ============================================================================
 *
 * PERMA 1/2016 Pasal 24: mediasi berlangsung paling lama 30 hari, dapat
 * diperpanjang 30 hari atas kesepakatan para pihak. Paling lama 60 hari,
 * karena itu, yang boleh dikeluarkan dari jangka penyelesaian perkara.
 *
 * Batas ini BUKAN kehati-hatian yang berlebihan - ia menjawab keadaan data
 * yang sungguh ada dan sudah terukur di satker ini:
 *
 *   perkara 1495 menghasilkan "mediasi 3.488 hari" atas perkara yang umurnya
 *   87 hari, sebab satu baris mediasinya tidak punya keputusan_mediasi dan
 *   karena itu terbaca seolah masih berjalan sejak 2017.
 */
/**
 * CATATAN: berbeda dari BATAS_MEDIASI_HARI di bawah, yang bernilai 30.
 *
 *   BATAS_MEDIASI_HARI (30)        tenggat mediasi sejak mediator ditetapkan
 *   BATAS_POTONG_MEDIASI_HARI (60) paling banyak yang boleh DIKELUARKAN dari
 *                                  jangka penyelesaian perkara - 30 hari
 *                                  ditambah perpanjangan 30 hari
 *
 * Dua angka, dua pertanyaan. Menyatukannya akan membuat perkara yang
 * mediasinya diperpanjang tampak melewati tenggat, atau perkara yang
 * mediasinya salah catat mendapat potongan dua kali lipat.
 */
const BATAS_POTONG_MEDIASI_HARI = 60;

/**
 * Hari mediasi yang boleh dikeluarkan, sesudah tiga penyaringan.
 *
 * 1. Tiap rentang DIJEPIT ke umur perkaranya sendiri. Mediasi tidak dapat
 *    dimulai sebelum perkaranya didaftarkan, dan tidak berlanjut sesudah
 *    perkaranya diputus - baris yang mengatakan sebaliknya salah catat.
 * 2. Rentang yang BERTINDIHAN disatukan, tidak dijumlah. Satu perkara di
 *    satker ini punya tiga baris mediasi dengan tanggal mulai yang sama
 *    persis; menjumlahkannya menghitung hari yang sama tiga kali.
 * 3. Jumlahnya dibatasi 60 hari - batas PERMA.
 */
function hariMediasiBersih(mediasi, tanggalDaftar, tanggalSampai) {
  const batasAwal = tanggalDaftar || "";
  const batasAkhir = tanggalSampai || "";
  if (!batasAwal || !batasAkhir) return { hari: 0, dibatasi: false };

  // ==========================================================================
  // BARIS KEMBAR: YANG BERUJUNG MENANG ATAS YANG MENGGANTUNG
  // ==========================================================================
  //
  // Beberapa baris mediasi dengan tanggal mulai yang SAMA menerangkan mediasi
  // yang sama - salah satunya belum sempat diisi keputusannya. Terukur di
  // satker ini: perkara 1495 punya dua baris begitu, perkara 2285 punya tiga.
  //
  // Memperlakukan yang menggantung sebagai "masih berjalan" membuat mediasi
  // SATU HARI terbaca 59 hari, dan perkara 87 hari terbaca seolah hanya 28
  // hari yang menjadi tanggung jawab majelis. Angka yang menyenangkan, dan
  // sama sekali tidak benar.
  const perMulai = new Map();
  for (const m of mediasi) {
    if (!m.mulai) continue;
    const kelompok = perMulai.get(m.mulai) || [];
    kelompok.push(m);
    perMulai.set(m.mulai, kelompok);
  }

  const rentang = [];
  for (const [mulaiMentah, kelompok] of perMulai) {
    const berujung = kelompok.filter((m) => m.selesai);
    // Yang menggantung hanya dipakai bila TIDAK SATU PUN baris sekelompoknya
    // punya keputusan - barulah ia sungguh mediasi yang sedang berjalan.
    const selesaiMentah = berujung.length
      ? berujung.map((m) => m.selesai).sort().pop()
      : batasAkhir;

    // Mediasi tidak dapat dimulai sebelum perkaranya didaftarkan, dan tidak
    // berlanjut sesudah perkaranya diputus - baris yang mengatakan sebaliknya
    // salah catat.
    const mulai = mulaiMentah > batasAwal ? mulaiMentah : batasAwal;
    const selesai = selesaiMentah < batasAkhir ? selesaiMentah : batasAkhir;
    if (selesai <= mulai) continue;
    rentang.push({ mulai, selesai });
  }
  if (rentang.length === 0) return { hari: 0, dibatasi: false };

  rentang.sort((a, b) => a.mulai.localeCompare(b.mulai));
  const gabung = [rentang[0]];
  for (let i = 1; i < rentang.length; i += 1) {
    const akhir = gabung[gabung.length - 1];
    if (rentang[i].mulai <= akhir.selesai) {
      if (rentang[i].selesai > akhir.selesai) akhir.selesai = rentang[i].selesai;
    } else {
      gabung.push(rentang[i]);
    }
  }

  let hari = 0;
  for (const r of gabung) {
    const n = selisihHariKalender(r.mulai, r.selesai);
    if (n !== null && n > 0) hari += n;
  }

  if (hari > BATAS_POTONG_MEDIASI_HARI) return { hari: BATAS_POTONG_MEDIASI_HARI, dibatasi: true };
  return { hari, dibatasi: false };
}

/** Selisih hari kalender antara dua tanggal ISO, atau null bila tidak terbaca. */
function selisihHariKalender(dari, sampai) {
  const a = /^\d{4}-\d{2}-\d{2}$/.test(String(dari || "")) ? new Date(`${dari}T00:00:00`) : null;
  const b = /^\d{4}-\d{2}-\d{2}$/.test(String(sampai || "")) ? new Date(`${sampai}T00:00:00`) : null;
  if (!a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Sandi hasil mediasi menurut keterangan kolomnya sendiri di SIPP:
 * Y1 berhasil dengan kesepakatan, Y2 berhasil dengan pencabutan,
 * S berhasil sebagian, T tidak berhasil, D tidak dapat dilaksanakan.
 *
 * Dibaca dari komentar kolom, bukan ditebak - tiga sandi cara relaas pernah
 * ditebak dari teks bebas dan ketiganya salah.
 */
const HASIL_MEDIASI = {
  Y1: "berhasil dengan kesepakatan",
  Y2: "berhasil dengan pencabutan",
  S: "berhasil sebagian",
  T: "tidak berhasil",
  D: "tidak dapat dilaksanakan",
};

function sebutanHasilMediasi(sandi) {
  const kode = cleanText(sandi).toUpperCase();
  if (!kode) return "";
  return HASIL_MEDIASI[kode] || kode;
}

async function putusanBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};

  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  // MAX dipakai untuk mengambil putusan terakhir bila satu perkara punya lebih
  // dari satu baris putusan - tanggalnya bagian dari kunci utama tabel itu.
  //
  // Nama status diambil dari status_putusan, sama seperti putusanPerkara -
  // sebabnya diterangkan panjang di sana. Dua jalur yang menjawab pertanyaan
  // yang sama harus mengambilnya dari tempat yang sama, atau pada suatu hari
  // daftar dan rinciannya berbeda untuk perkara yang sama.
  //
  // Pemisah GROUP_CONCAT diganti '|' - bukan koma. "Tidak Dapat Diterima" tidak
  // memuat koma, tetapi nama status ditentukan operator SIPP dan dapat berubah;
  // koma sebagai pemisah membuat nama bertanda koma terpotong separuh.
  const rows = await runQuery(
    `SELECT pu.perkara_id AS perkaraId,
            MAX(pu.tanggal_putusan) AS tanggalPutusan,
            MAX(pu.tanggal_minutasi) AS tanggalMinutasi,
            MAX(pu.tanggal_bht) AS tanggalBht,
            MAX(pu.putusan_verstek) AS verstek,
            MAX(CASE WHEN pu.amar_putusan_dok IS NOT NULL AND TRIM(pu.amar_putusan_dok) <> '' THEN 1 ELSE 0 END) AS adaBerkasPutusan,
            -- ==================================================================
            -- CONVERT WAJIB - DUA KOLOM INI BEDA COLLATION
            -- ==================================================================
            --
            -- perkara_putusan.status_putusan_nama  latin1_swedish_ci
            -- status_putusan.nama                  latin1_general_ci
            --
            -- COALESCE atas keduanya lolos pada baris tunggal, tetapi
            -- GROUP_CONCAT/SUBSTRING_INDEX menolaknya dengan
            -- ER_CANT_AGGREGATE_2COLLATIONS - dan penolakan itu terjadi saat
            -- kueri dijalankan, bukan saat kode ditulis, sehingga tanpa
            -- CONVERT seluruh kolom putusan di daftar jadwal kosong tanpa
            -- sebab yang terlihat.
            SUBSTRING_INDEX(
              GROUP_CONCAT(
                COALESCE(CONVERT(sp.nama USING utf8), CONVERT(pu.status_putusan_nama USING utf8))
                ORDER BY pu.tanggal_putusan DESC SEPARATOR '|'
              ), '|', 1
            ) AS statusPutusan
       FROM perkara_putusan pu
       LEFT JOIN status_putusan sp ON sp.id = pu.status_putusan_id
      WHERE pu.perkara_id IN (${isian})
      GROUP BY pu.perkara_id`,
    dipakai
  );

  const hasil = {};
  for (const baris of Array.isArray(rows) ? rows : []) {
    hasil[String(baris.perkaraId)] = {
      tanggalPutusan: isoTanggal(baris.tanggalPutusan),
      statusPutusan: cleanText(baris.statusPutusan),
      tanggalMinutasi: isoTanggal(baris.tanggalMinutasi),
      tanggalBht: isoTanggal(baris.tanggalBht),
      verstek: cleanText(baris.verstek).toUpperCase() === "Y",
      // Dipakai menandai perkara yang naskah putusannya sudah diunggah tetapi
      // belum diminutasi - keadaan yang menagih panitera pengganti, dan yang
      // sebelumnya hanya terlihat sesudah membuka rincian satu per satu.
      adaBerkasPutusan: Number(baris.adaBerkasPutusan) === 1,
    };
  }
  return hasil;
}

/**
 * Tanggal sidang BERIKUTNYA untuk tiap sidang yang sedang ditampilkan.
 *
 * ============================================================================
 * "DITUNDA" TANPA TANGGALNYA TIDAK MENJAWAB APA-APA
 * ============================================================================
 *
 * Yang ditanya orang berikutnya selalu sama: ditunda sampai kapan. Tanggalnya
 * sudah ada di SIPP - sidang berikutnya pada perkara yang sama - dan tidak ada
 * alasan menyembunyikannya di balik satu kata.
 *
 * Satu kueri berkelompok untuk seluruh perkara, lalu dipasangkan di Node.
 * Kueri berkorelasi per baris pernah membuat layar ini menembakkan seribu
 * kueri untuk seratus baris.
 */
async function sidangBerikutnya(daftarSidang = []) {
  const sidang = daftarSidang.filter((x) => x && x.sidangId && x.perkaraId);
  if (sidang.length === 0) return {};

  const idPerkara = [...new Set(sidang.map((x) => Number(x.perkaraId)).filter(Boolean))].slice(0, 500);
  if (idPerkara.length === 0) return {};

  const isian = idPerkara.map(() => "?").join(", ");
  const rows = await runQuery(
    `SELECT j.id AS sidangId, j.perkara_id AS perkaraId, j.tanggal_sidang AS tanggalSidang
       FROM perkara_jadwal_sidang j
      WHERE j.perkara_id IN (${isian})
      ORDER BY j.perkara_id ASC, j.tanggal_sidang ASC, j.id ASC`,
    idPerkara
  ).catch(() => []);

  // Dikelompokkan per perkara, lalu tiap sidang menunjuk ke tetangga sesudahnya.
  const perPerkara = {};
  for (const row of rows) {
    const kunci = String(row.perkaraId);
    if (!perPerkara[kunci]) perPerkara[kunci] = [];
    perPerkara[kunci].push({ sidangId: String(row.sidangId), tanggal: isoTanggal(row.tanggalSidang) });
  }

  const hasil = {};
  for (const daftar of Object.values(perPerkara)) {
    for (let i = 0; i < daftar.length - 1; i += 1) {
      hasil[daftar[i].sidangId] = daftar[i + 1].tanggal;
    }
  }
  return hasil;
}
/**
 * PERMA 1/2016 Pasal 24: mediasi paling lama 30 hari sejak mediator ditetapkan.
 */
const BATAS_MEDIASI_HARI = 30;

/** Menggeser tanggal ISO sebanyak n hari, tanpa tergelincir zona waktu. */
function geserHari(tanggalIso, jumlah) {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tanggalIso || ""));
  if (!cocok) return "";
  const titik = new Date(Date.UTC(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3])));
  titik.setUTCDate(titik.getUTCDate() + Number(jumlah || 0));
  return titik.toISOString().slice(0, 10);
}

/**
 * Jadwal pertemuan MEDIASI pada satu rentang tanggal.
 *
 * ============================================================================
 * MEDIASI BUKAN SIDANG, DAN TIDAK MUNCUL DI JADWAL SIDANG
 * ============================================================================
 *
 * Pertemuan mediasi tersimpan di tabelnya sendiri - perkara_jadwal_mediasi -
 * dan tidak pernah ikut pada perkara_jadwal_sidang. Petugas yang membuka layar
 * Jadwal Sidang karena itu tidak melihatnya sama sekali, padahal mediasi
 * berjalan pada jam kerja yang sama, memakai ruangan yang sama, dan tenggatnya
 * justru lebih ketat: PERMA 1/2016 Pasal 24 memberi paling lama 30 hari sejak
 * mediator ditetapkan.
 *
 * Karena itu jadwal mediasi punya layarnya sendiri, bukan diselipkan ke jadwal
 * sidang. Keduanya memang dibaca orang yang sama pada pagi yang sama, tetapi
 * yang ditanyakan berbeda: sidang menanyakan majelis dan relaas, mediasi
 * menanyakan mediator dan sisa tenggang.
 *
 * ============================================================================
 * DIBACA DARI JADWALNYA, LALU DILENGKAPI PERKARANYA
 * ============================================================================
 *
 * Kuncinya perkara_jadwal_mediasi.mediasi_id, yang menunjuk ke
 * perkara_mediasi.mediasi_id - BUKAN ke perkara_id. Salah kunci di sini
 * membuat seluruh bagian mediasi kosong, dan itu pernah terjadi.
 */
async function daftarJadwalMediasi({ dari = "", sampai = "", cari = "", batas = 200 } = {}) {
  const mulai = tanggalMysql(dari) || tanggalHariIni();
  const akhir = tanggalMysql(sampai) || mulai;
  const maksBaris = Math.min(Math.max(Math.floor(Number(batas) || 200), 1), 500);

  const kosong = {
    dari: mulai,
    sampai: akhir,
    diperiksaPada: new Date().toISOString(),
    terbaca: false,
    alasan: "",
    mediasi: [],
  };

  if (!(await sippSkemaService.tabelAda("perkara_jadwal_mediasi"))) {
    return { ...kosong, alasan: "Tabel perkara_jadwal_mediasi tidak ada pada SIPP versi ini." };
  }
  if (!(await sippSkemaService.tabelAda("perkara_mediasi"))) {
    return { ...kosong, alasan: "Tabel perkara_mediasi tidak ada pada SIPP versi ini." };
  }

  const kolom = await sippSkemaService.kolomTerpilih();
  if (!kolom.jadwalMediasiKunci || !kolom.jadwalMediasiTanggal || !kolom.mediasiId) {
    const adaKolom = await sippSkemaService.kolomTabel("perkara_jadwal_mediasi");
    return {
      ...kosong,
      alasan: `Kolom jadwal mediasi belum dikenali. Kolom yang ada: ${adaKolom.join(", ")}.`,
    };
  }

  // Nama kolom - dan HANYA nama kolom - yang disisipkan ke teks kueri, dan
  // seluruhnya berasal dari daftar calon tertutup pada sippSkemaService.
  // Tanggal dan kata pencarian SELALU lewat parameter.
  const pilihan = [
    `j.${kolom.jadwalMediasiKunci} AS mediasiId`,
    `j.${kolom.jadwalMediasiTanggal} AS tanggal`,
    "m.perkara_id AS perkaraId",
    "p.nomor_perkara AS nomorPerkara",
    "p.jenis_perkara_nama AS jenisPerkara",
    // Bahan sebutan Penggugat/Pemohon di layar - NOMOR, bukan kata (lihat
    // sebutanPihakService). Terukur 27 Sep 2026 di sipp_donggala: 268 dari
    // 752 perkara bermediasi beralur GUGATAN (15) tetapi bersebutan
    // Pemohon/Termohon - Cerai Talak 346 (258) dan Izin Poligami 341 (10).
    // Tanpa jenis_perkara_id, sepertiganya tertulis "Penggugat".
    "p.alur_perkara_id AS alurPerkaraId",
    "p.jenis_perkara_id AS jenisPerkaraId",
  ];
  if (kolom.jadwalMediasiJam) pilihan.push(`j.${kolom.jadwalMediasiJam} AS jam`);
  if (kolom.jadwalMediasiSampai) pilihan.push(`j.${kolom.jadwalMediasiSampai} AS sampai`);
  if (kolom.jadwalMediasiTempat) pilihan.push(`j.${kolom.jadwalMediasiTempat} AS tempat`);
  if (kolom.jadwalMediasiHadir) pilihan.push(`j.${kolom.jadwalMediasiHadir} AS hadir`);
  if (kolom.jadwalMediasiDitunda) pilihan.push(`j.${kolom.jadwalMediasiDitunda} AS ditunda`);
  if (kolom.mediasiMediator) pilihan.push(`m.${kolom.mediasiMediator} AS mediator`);
  if (kolom.mediasiStatusMediator) pilihan.push(`m.${kolom.mediasiStatusMediator} AS statusMediator`);
  if (kolom.mediasiJenis) pilihan.push(`m.${kolom.mediasiJenis} AS jenisMediasi`);
  if (kolom.mediasiPenetapan) pilihan.push(`m.${kolom.mediasiPenetapan} AS penetapanMediator`);
  if (kolom.mediasiLaporan) pilihan.push(`m.${kolom.mediasiLaporan} AS laporanMediator`);
  if (kolom.mediasiHasil) pilihan.push(`m.${kolom.mediasiHasil} AS hasil`);
  if (kolom.mediasiNomorSk) pilihan.push(`m.${kolom.mediasiNomorSk} AS nomorSk`);

  const syarat = [`j.${kolom.jadwalMediasiTanggal} BETWEEN ? AND ?`];
  const nilai = [mulai, akhir];

  const kata = String(cari || "").trim();
  if (kata) {
    syarat.push("(p.nomor_perkara LIKE ? OR p.jenis_perkara_nama LIKE ?)");
    nilai.push(`%${kata}%`, `%${kata}%`);
  }

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")}
       FROM perkara_jadwal_mediasi j
       JOIN perkara_mediasi m ON m.${kolom.mediasiId} = j.${kolom.jadwalMediasiKunci}
       JOIN perkara p ON p.perkara_id = m.perkara_id
      WHERE ${syarat.join(" AND ")}
      ORDER BY j.${kolom.jadwalMediasiTanggal} ASC${
        kolom.jadwalMediasiJam ? `, j.${kolom.jadwalMediasiJam} ASC` : ""
      }, p.nomor_perkara ASC
      LIMIT ${maksBaris}`,
    nilai
  ).catch(() => null);

  if (!Array.isArray(rows)) {
    return { ...kosong, alasan: "Jadwal mediasi tidak dapat dibaca dari SIPP." };
  }

  // Para pihak dibaca BERKELOMPOK - satu kueri untuk seluruh daftar, bukan
  // satu per baris. Layar ini memuat puluhan pertemuan pada hari yang padat.
  const idPerkara = [...new Set(rows.map((row) => Number(row.perkaraId)).filter(Boolean))];
  // Turut tergugat dipisah di layar INI saja: layar mediasi menulis tiap sisi
  // dengan sebutannya, dan turut tergugat yang tertulis "Tergugat" menyebut
  // kedudukan yang keliru. 8 dari 752 perkara bermediasi di sipp_donggala
  // (Kewarisan, Harta Bersama) punya turut tergugat.
  const petaPihak = await pihakBanyakPerkara(idPerkara, { pisahkanTurut: true }).catch(() => ({}));
  /* === 12OKT-A: kumulasi perkara === */
  // null = gagal dibaca (kumulasiTerbaca false), bukan "tidak berkumulasi".
  const petaKumulasiMediasi = await kumulasiPerkaraService.kumulasiBanyakPerkara(idPerkara).catch(() => null);
  /* === AKHIR 12OKT-A === */

  // Lama mediasi menurut view SIPP - dipakai menghitung sisa tenggang.
  const petaDurasi = {};
  for (const id of idPerkara.slice(0, 200)) {
    const durasi = await durasiMediasiPerkaraAman(id);
    if (durasi) petaDurasi[String(id)] = durasi;
  }

  const hariIni = tanggalHariIni();

  return {
    dari: mulai,
    sampai: akhir,
    diperiksaPada: new Date().toISOString(),
    terbaca: true,
    alasan: "",
    mediasi: rows.map((row) => {
      const penetapan = isoTanggal(row.penetapanMediator);
      const laporan = isoTanggal(row.laporanMediator);

      // PERMA 1/2016 Pasal 24: paling lama 30 hari sejak mediator ditetapkan.
      // Dihitung dari PENETAPAN, bukan dari pertemuan pertama - itulah yang
      // menjadi patokan, dan pertemuan pertama kerap jauh sesudahnya.
      const tenggat = penetapan ? geserHari(penetapan, BATAS_MEDIASI_HARI) : "";
      const sisaHari = tenggat && !laporan ? sippTahapanService.selisihHari(hariIni, tenggat) : null;

      return {
        mediasiId: String(row.mediasiId || ""),
        perkaraId: String(row.perkaraId || ""),
        nomorPerkara: cleanText(row.nomorPerkara),
        jenisPerkara: cleanText(row.jenisPerkara),
        alurPerkaraId: Number(row.alurPerkaraId) || null,
        jenisPerkaraId: Number(row.jenisPerkaraId) || null,
        tanggal: isoTanggal(row.tanggal),
        jam: jamRingkas(row.jam),
        sampaiJam: jamRingkas(row.sampai),
        tempat: cleanText(row.tempat),
        dihadiri: cleanText(row.hadir),
        // Y berarti YA. Lihat catatan pada jadwalMediasiPerkara - baris ini
        // pernah terbalik, dan akibatnya setiap pertemuan tertandai ditunda.
        ditunda: cleanText(row.ditunda).toUpperCase() === "Y",
        mediator: cleanText(row.mediator),
        statusMediator: cleanText(row.statusMediator),
        jenisMediasi: cleanText(row.jenisMediasi),
        nomorSk: cleanText(row.nomorSk),
        penetapanMediator: penetapan,
        laporanMediator: laporan,
        // Mediasi dianggap SELESAI saat laporan mediator masuk.
        selesai: Boolean(laporan),
        hasil: cleanText(row.hasil),
        hasilTeks: sippTahapanService.artiHasilMediasi(row.hasil),
        lamaHari: petaDurasi[String(row.perkaraId)] || null,
        tenggatPerma: tenggat,
        sisaHariTenggat: sisaHari,
        // Lewat tenggang hanya bila mediasinya BELUM selesai. Mediasi yang
        // laporannya sudah masuk tidak lagi menuntut apa pun, berapa pun
        // lamanya - menandainya merah hanya menyalakan peringatan atas
        // pekerjaan yang sudah beres.
        lewatTenggang: sisaHari !== null && sisaHari < 0,
        pihak: petaPihak[String(row.perkaraId)] || { penggugat: [], tergugat: [] },
        /* === 12OKT-A: kumulasi perkara === */
        kumulasi: (petaKumulasiMediasi || {})[String(row.perkaraId)] || null,
        kumulasiTerbaca: petaKumulasiMediasi !== null,
        /* === AKHIR 12OKT-A === */
      };
    }),
  };
}

/** Lama mediasi satu perkara, atau null bila tidak terbaca. */
async function durasiMediasiPerkaraAman(perkaraId) {
  try {
    const hasil = await sippTahapanService.durasiMediasiPerkara(perkaraId);
    return hasil && hasil.terbaca ? Number(hasil.hari) || 0 : null;
  } catch {
    return null;
  }
}

/**
 * Keadaan panggilan tiap sidang: siapa yang wajib dipanggil, dan bagaimana
 * hasilnya.
 *
 * ============================================================================
 * PANGGILAN TIDAK SELALU WAJIB
 * ============================================================================
 *
 * Pihak yang HADIR pada sidang sebelumnya sudah diberitahu hari sidang
 * berikutnya di ruang sidang - ia tidak perlu dipanggil lagi. Menandai
 * perkaranya "belum dipanggil" hanya karena tidak ada relaas akan menyalakan
 * peringatan pada hampir seluruh jadwal, dan peringatan yang selalu menyala
 * berhenti dibaca.
 *
 * Karena itu kewajiban memanggil dibaca dari KEHADIRAN pada sidang sebelumnya:
 *
 *   sebelumnya semua hadir      - tidak ada yang wajib dipanggil
 *   sebelumnya penggugat saja   - tergugat wajib dipanggil
 *   sebelumnya tergugat saja    - penggugat wajib dipanggil
 *   sebelumnya tidak ada hadir  - keduanya wajib dipanggil
 *   belum ada sidang sebelumnya - keduanya wajib dipanggil (sidang pertama)
 *
 * Daftar itu lalu DISARING menurut pihak yang benar-benar ada pada perkaranya.
 * Permohonan kerap hanya punya pemohon; menuntut panggilan untuk termohon yang
 * memang tidak ada membuat hampir seluruh Pdt.P tertandai belum dipanggil.
 *
 * ============================================================================
 * PANGGILAN ELEKTRONIK KERAP TIDAK MEMBAWA KEDUDUKAN PIHAK
 * ============================================================================
 *
 * Kedudukan pihak (penggugat atau tergugat) dibaca lewat sambungan ke
 * v_pihak_perkara. Pada panggilan elektronik sambungan itu kerap kosong,
 * sehingga relaas yang JELAS ada - tanggalnya terisi, dokumennya terunggah -
 * tidak terhitung menutup sisi mana pun, dan perkaranya tertandai belum
 * dipanggil padahal di SIPP tercatat sudah.
 *
 * Karena itu relaas tanpa kedudukan tetap dihitung: satu relaas menutup satu
 * sisi yang tersisa. Itu perkiraan, bukan pembacaan pasti - tetapi perkiraan
 * yang berpihak pada kenyataan bahwa panggilannya memang ada, dan penanda ini
 * alat bantu, bukan penetapan sah tidaknya panggilan.
 *
 * ============================================================================
 * RETUR BERBEDA DARI BELUM DIPANGGIL
 * ============================================================================
 *
 * Belum dipanggil berarti jurusita belum mengerjakannya. Retur berarti sudah
 * dikerjakan tetapi suratnya kembali - alamatnya keliru, orangnya pindah, atau
 * tidak ada yang menerima. Tindak lanjutnya berbeda: yang satu menagih
 * jurusita, yang lain menelusuri alamat.
 *
 * status_pos pada SIPP: 1 berhasil, 2 tidak berhasil (dikembalikan).
 */
/**
 * ============================================================================
 * v_pihak_perkara TIDAK DAPAT DISARING DARI LUAR
 * ============================================================================
 *
 * View itu UNION (bukan UNION ALL) dari perkara_pihak1..5, masing-masing
 * di-join ke perkara dan membawa subkueri berkorelasi untuk status_perkara.
 * UNION berpembeda memaksa MariaDB memakai algoritma TEMPTABLE: SELURUH view
 * dibentuk dan disaring-ganda lebih dahulu, baru "WHERE perkara_id IN (...)"
 * di luar dapat berlaku. Saringan kita tidak pernah sampai ke tabelnya.
 *
 * Terukur 14 September 2026 atas sipp_donggala (20.099 baris jadwal), mencari
 * pihak untuk 20 perkara:
 *
 *   lewat v_pihak_perkara                    8.563 ms
 *   langsung ke perkara_pihak1..5 (UNION ALL)  413 ms
 *
 * Dua puluh kali, dan jumlah barisnya sama persis - 40 lawan 40. Inilah sebab
 * panel putusan massal menulis "aleta_bot tidak merespons dalam 8000ms":
 * botnya sehat, jawabannya memang 13 detik.
 *
 * UNION ALL setara di sini: kolom `id` view berbentuk concat('pihakN_', id)
 * sehingga unik per baris, jadi pembeda UNION tidak pernah membuang apa pun.
 *
 * Yang diganti HANYA jalur jadwal sidang. notifikasi.js dan query.js memakai
 * view yang sama di puluhan tempat dengan kolom yang jauh lebih banyak;
 * menyentuhnya sekaligus menukar satu kelambatan yang terukur dengan risiko
 * yang tidak terukur.
 */
const TABEL_PIHAK = [1, 2, 3, 4, 5];

/**
 * Pengganti v_pihak_perkara untuk empat kolom yang benar-benar dipakai di
 * berkas ini. `syarat` disisipkan ke DALAM tiap cabang - di situlah letak
 * seluruh manfaatnya, sebab indeks perkara_id baru terpakai bila saringannya
 * berada di dalam.
 *
 * Pemanggil WAJIB mengulang nilai isiannya sebanyak TABEL_PIHAK.length,
 * berurutan sebelum isian lain yang muncul sesudahnya pada teks SQL.
 */
function pihakDariTabel(syarat = "") {
  const saring = syarat ? ` WHERE ${syarat}` : "";
  return TABEL_PIHAK.map(
    (n) =>
      `SELECT perkara_id, pihak_id, nama, urutan, ${n} AS pihak_ke FROM perkara_pihak${n}${saring}`
  ).join(" UNION ALL ");
}

/** Nilai isian yang diulang untuk tiap cabang pihakDariTabel. */
function isianPihakBerulang(nilai) {
  const hasil = [];
  for (let i = 0; i < TABEL_PIHAK.length; i += 1) hasil.push(...nilai);
  return hasil;
}

/**
 * ============================================================================
 * KEHADIRAN SEBELUM TIAP SIDANG - DUA HAL DARI SATU PENYUSURAN
 * ============================================================================
 *
 * Daftar sidang datang terurut per perkara lalu per tanggal. Sekali susur
 * menghasilkan, untuk TIAP sidang:
 *
 *   sebelumnya            kode kehadiran pada sidang tepat sebelumnya (null
 *                         bila ini sidang pertama atau kehadirannya belum
 *                         dicatat) - menentukan siapa yang wajib dipanggil;
 *   tergugatPernahHadir   benar bila tergugat/termohon pernah hadir pada
 *                         sidang MANA PUN sebelumnya (kode 1 atau 3) -
 *                         menentukan potensi verstek. Tergugat yang pernah
 *                         hadir lalu absen diputus contradictoir, bukan
 *                         verstek; layar tidak boleh menyebutnya potensi
 *                         verstek hanya karena pada sidang terakhir ia tidak
 *                         datang.
 *
 * Dihitung di sini, bukan di layar: layar hanya memegang sidang yang sedang
 * ditampilkan, sedangkan yang ditanya seluruh riwayat sidang perkaranya.
 */
/**
 * ============================================================================
 * CARA PENYAMPAIAN RELAAS - SEMBILAN SANDI, BUKAN YA/TIDAK
 * ============================================================================
 *
 * perkara_pelaksanaan_relaas.ket_temu menyimpan CARA penyampaiannya, bukan
 * berhasil atau tidaknya. Diukur pada SIPP satker, 14.495 baris:
 *
 *     Y  5.084  Bertemu
 *     E  3.532  Panggilan Elektronik
 *     S  3.104  Diterima orang serumah
 *     T  2.667  Tidak Bertemu
 *     R     45  Radiogram
 *     W     21  Pengumuman website/papan pengumuman
 *     N     14  Tidak Dapat Dilaksanakan
 *     P      6  Pengumuman lewat Bupati/email
 *     M      3  Radiogram RRI
 *
 * Sebelum ini ALETA membacanya sebagai boolean - `ketTemu === "Y"` - sehingga
 * SEGALA yang bukan Y jatuh menjadi "tidak bertemu". 6.725 dari 14.495 baris,
 * 46,4%, salah dilabeli.
 *
 * Yang paling merugikan bukan E melainkan S: "diterima orang serumah" adalah
 * penyampaian yang SAH menurut HIR - relaasnya patut dan sidangnya boleh
 * berjalan. Menampilkannya "tidak bertemu" membuat yang membacanya menunda
 * sidang yang sebenarnya sudah boleh jalan.
 *
 * ASAL ARTINYA, dan keduanya dibedakan:
 *
 * ============================================================================
 * SUMBERNYA KOMENTAR KOLOM SIPP, BUKAN TEBAKAN DARI TEKS BEBASNYA
 * ============================================================================
 *
 * Definisi resminya HANYA hidup di satu tempat - komentar kolom
 * perkara_pelaksanaan_relaas.ket_temu pada skema SIPP:
 *
 *   'Y / T, E=Elektonik, S=surat tercatat, W=Web/Papan Pengumuman Pengadilan,
 *    P=papan pengumuman pemda, M=media massa cetak/elektornik, R=radio'
 *
 * (Salah ketik "Elektonik" dan "elektornik" ada pada aslinya.) Tidak ada tabel
 * master jenis_relaas maupun cara_panggilan di basis data mana pun - dicari,
 * tidak ada.
 *
 * Dikuatkan dua sumber lain yang berdiri sendiri:
 *   - edit_pelaksanaan.php:32-33 - E dan S adalah DUA pilihan terpisah pada
 *     satu dropdown: "Panggilan Elektronik" dan "Surat Tercatat POS".
 *   - Ukuran atas 14.495 baris relaas satker: seluruh 3.532 baris 'E'
 *     nomor resi posnya KOSONG, sementara seluruh 3.104 baris 'S' resinya
 *     TERISI - 100% pada keduanya.
 *
 * ============================================================================
 * DUA DI ANTARANYA PERNAH SAYA ARTIKAN KELIRU - DAN SEBABNYA PATUT DICATAT
 * ============================================================================
 *
 * Pada 22 September 2026 sandi 'S' saya artikan "Diterima orang serumah" dan
 * 'M' saya artikan "Radiogram RRI". Keduanya salah, dan keduanya salah karena
 * sebab yang sama: artinya saya baca dari TEKS BEBAS ket_hasil_relaas - yang
 * memang sering berbunyi "diterima oleh ... yang tinggal serumah" pada baris
 * 'S' - bukan dari definisinya.
 *
 * Teks bebas menerangkan apa yang TERJADI pada satu relaas; sandinya
 * menyatakan CARA panggilan itu ditempuh. Yang satu tidak menentukan yang
 * lain: surat tercatat memang lazim diterima orang serumah, dan itu tidak
 * membuat "diterima orang serumah" menjadi arti sandinya.
 *
 * Sandi yang tidak dikenali dipulangkan apa adanya, bukan ditebak.
 */
const SANDI_CARA_RELAAS = {
  Y: { cara: "Bertemu langsung", sampai: true, terbaca: true },
  T: { cara: "Tidak bertemu", sampai: false, terbaca: true },
  E: { cara: "Panggilan elektronik", sampai: true, terbaca: true },
  N: { cara: "Tidak dapat dilaksanakan", sampai: false, terbaca: true },
  // sampai: null - BUKAN true. Surat tercatat yang dikirim belum tentu
  // sampai; yang menentukan status posnya, bukan sandinya. Menuliskan true
  // di sini menyatakan panggilan patut atas dasar yang belum diperiksa.
  S: { cara: "Surat tercatat (POS)", sampai: null, terbaca: true },
  R: { cara: "Radio (radiogram RRI)", sampai: true, terbaca: true },
  M: { cara: "Media massa cetak/elektronik", sampai: true, terbaca: true },
  W: { cara: "Pengumuman web/papan pengumuman pengadilan", sampai: true, terbaca: true },
  P: { cara: "Pengumuman papan pengumuman Pemda", sampai: true, terbaca: true },
};

/**
 * Cara penyampaian satu relaas.
 *
 * Sandi asing dipulangkan apa adanya beserta terbaca:false - menebaknya
 * "berhasil" akan menyatakan panggilan patut atas dasar yang tidak diketahui,
 * dan menebaknya "gagal" mengulang cacat yang justru sedang diperbaiki.
 */
function caraRelaas(ketTemu) {
  const sandi = cleanText(ketTemu).toUpperCase();
  if (!sandi) return { sandi: "", cara: "", sampai: null, terbaca: false };
  const kenal = SANDI_CARA_RELAAS[sandi];
  if (kenal) return { sandi, ...kenal };
  return { sandi, cara: `Sandi SIPP "${sandi}"`, sampai: null, terbaca: false };
}

/**
 * I7 17 Okt (paket abt-varian-17okt-derry): bahan memilih varian blangko putusan, hanya untuk perkara yang membutuhkannya.
 *
 *   tergugatPerempuan  gugatan hak asuh (jenis "Penguasaan Anak" / "Lain-Lain" bernomor Pdt.G): benar bila Tergugat pertama berjenis
 *                      kelamin P di tabel pihak. Dasar blangko tolak [03a] "Hadhanah ditetapkan kepada T (ibu)".
 *   amarRekonvensi     harta bersama: potongan amar putusan (maks. 3000 huruf) mulai "Dalam Rekonvensi". SIPP tidak menyimpan amar
 *                      rekonvensi sebagai ruas tersendiri; portal menimbang "Mengabulkan" di potongan itu (lib/keadaan-putusan.ts).
 *   kabulSebagian      gugatan hak asuh / penguasaan anak / nafkah anak: true bila amar putusan memuat "untuk sebagian" atau "selebihnya" (I20 18 Okt: dikabulkan
 *                      untuk sebagian - SIPP tidak menyimpannya sebagai status); false bila amar terbaca tanpa kata itu; tidak ada bila amar kosong / belum putus.
 *   pencairanDana      penetapan ahli waris dan itsbat nikah kontensius: true bila petitum memuat BPJS / Taspen / bank / tabungan / pencairan (I22 18 Okt, ketepatan sedang).
 *   plusNafkahAnak     gugatan hak asuh / penguasaan anak / Lain-Lain Pdt.G: true bila petitum memuat kata nafkah (I23 18 Okt: hak asuh + nafkah anak -> blangko 6a [02]/[02a]/[02b]).
 *   kumulasiNafkahIstri cerai gugat: true bila petitum memuat nafkah madliyah / iddah / mut'ah (I22 18 Okt, ketepatan sedang). Kolom perkara.petitum kosong = false.
 * Lima kueri baca-saja berparameter, masing-masing hanya bila ada perkaranya; gagal salah satunya tidak menjatuhkan yang lain.
 *
 * @returns {Promise<{tergugatPerempuan: Record<string, boolean>, amarRekonvensi: Record<string, string>, kabulSebagian: Record<string, boolean>, pencairanDana: Record<string, boolean>, kumulasiNafkahIstri: Record<string, boolean>, plusNafkahAnak: Record<string, boolean>}>}
 */
async function bahanVarianPutusan(rows = []) {
  const daftar = Array.isArray(rows) ? rows : [];
  const unik = (saring) => [
    ...new Set(
      daftar
        .filter(saring)
        .map((r) => Number(r.perkaraId))
        .filter((x) => Number.isFinite(x) && x > 0)
    ),
  ].slice(0, 500);
  const hakAsuh = unik((r) => {
    const j = String(r.jenisPerkara || "").toLowerCase();
    return j.includes("penguasaan anak") || j.includes("hak asuh") || (j.includes("lain-lain") && /\/pdt\.g\//i.test(String(r.nomorPerkara || "")));
  });
  const hb = unik((r) => String(r.jenisPerkara || "").toLowerCase().includes("harta bersama"));
  // I20 18 Okt: kabul sebagian dibaca untuk gugatan anak (hak asuh, penguasaan anak, nafkah anak).
  const anak = unik((r) => {
    const j = String(r.jenisPerkara || "").toLowerCase();
    return j.includes("penguasaan anak") || j.includes("hak asuh") || j.includes("nafkah anak") || (j.includes("lain-lain") && /\/pdt\.g\//i.test(String(r.nomorPerkara || "")));
  });
  // I22 18 Okt: petitum pencairan dana (PAW, itsbat kontensius) dan nafkah istri (cerai gugat).
  const dana = unik((r) => {
    const j = String(r.jenisPerkara || "").toLowerCase();
    return j.includes("ahli waris") || j.includes("p3hp") || ((j.includes("istbat") || j.includes("itsbat") || j.includes("pengesahan perkawinan")) && /\/pdt\.g\//i.test(String(r.nomorPerkara || "")));
  });
  const nafkahIstri = unik((r) => String(r.jenisPerkara || "").toLowerCase().includes("cerai gugat"));
  const hasil = { tergugatPerempuan: {}, amarRekonvensi: {}, kabulSebagian: {}, pencairanDana: {}, kumulasiNafkahIstri: {}, plusNafkahAnak: {} };
  const kerja = [];
  if (hakAsuh.length) {
    kerja.push(
      (async () => {
        const isian = hakAsuh.map(() => "?").join(", ");
        const baris = await runQuery(
          `SELECT p2.perkara_id AS perkaraId, ph.jenis_kelamin AS kelamin
             FROM perkara_pihak2 p2
             JOIN pihak ph ON ph.id = p2.pihak_id
            WHERE p2.perkara_id IN (${isian})
            ORDER BY p2.perkara_id ASC, p2.urutan ASC`,
          hakAsuh
        );
        for (const b of Array.isArray(baris) ? baris : []) {
          const k = String(b.perkaraId);
          if (hasil.tergugatPerempuan[k] !== undefined) continue; // Tergugat PERTAMA saja
          const jk = cleanText(b.kelamin).toUpperCase();
          if (jk === "P" || jk === "L") hasil.tergugatPerempuan[k] = jk === "P";
        }
      })()
    );
  }
  if (hb.length) {
    kerja.push(
      (async () => {
        const isian = hb.map(() => "?").join(", ");
        const baris = await runQuery(
          `SELECT pu.perkara_id AS perkaraId,
                  SUBSTRING(pu.amar_putusan, LOCATE('dalam rekonvensi', pu.amar_putusan), 3000) AS amar
             FROM perkara_putusan pu
            WHERE pu.perkara_id IN (${isian}) AND LOCATE('dalam rekonvensi', pu.amar_putusan) > 0`,
          hb
        );
        for (const b of Array.isArray(baris) ? baris : []) {
          const amar = cleanText(b.amar);
          if (amar) hasil.amarRekonvensi[String(b.perkaraId)] = amar;
        }
      })()
    );
  }
  if (anak.length) {
    kerja.push(
      (async () => {
        const isian = anak.map(() => "?").join(", ");
        const baris = await runQuery(
          `SELECT pu.perkara_id AS perkaraId,
                  (LOCATE('untuk sebagian', LOWER(pu.amar_putusan)) > 0 OR LOCATE('selebihnya', LOWER(pu.amar_putusan)) > 0) AS sebagian
             FROM perkara_putusan pu
            WHERE pu.perkara_id IN (${isian}) AND pu.amar_putusan IS NOT NULL AND pu.amar_putusan <> ''`,
          anak
        );
        for (const b of Array.isArray(baris) ? baris : []) hasil.kabulSebagian[String(b.perkaraId)] = Number(b.sebagian) === 1;
      })()
    );
  }
  const petitumBendera = (daftar, pola, simpan) =>
    kerja.push(
      (async () => {
        const isian = daftar.map(() => "?").join(", ");
        const baris = await runQuery(
          `SELECT p.perkara_id AS perkaraId, (LOWER(p.petitum) REGEXP '${pola}') AS ya FROM perkara p WHERE p.perkara_id IN (${isian})`,
          daftar
        );
        for (const b of Array.isArray(baris) ? baris : []) simpan[String(b.perkaraId)] = Number(b.ya) === 1;
      })()
    );
  if (dana.length) petitumBendera(dana, "bpjs|taspen|bank|tabungan|pencairan", hasil.pencairanDana);
  if (nafkahIstri.length) petitumBendera(nafkahIstri, "madliyah|madhiyah|iddah|mut.?ah", hasil.kumulasiNafkahIstri);
  if (hakAsuh.length) petitumBendera(hakAsuh, "nafkah", hasil.plusNafkahAnak);
  const selesai = await Promise.allSettled(kerja);
  if (kerja.length && selesai.every((x) => x.status === "rejected")) throw selesai[0].reason;
  return hasil;
}

/**
 * Kehadiran pada sidang-sidang SEBELUM tiap sidang.
 *
 * penggugatPernahHadir (9 Okt 2026, BAS massal tanpa kehadiran): pihak
 * pertama pernah hadir pada sidang mana pun sebelumnya - true; tidak pernah
 * dan SELURUH sidang sebelumnya tercatat kehadirannya (atau belum ada sidang
 * sebelumnya) - false; tidak pernah tetapi ada sidang sebelumnya yang
 * kehadirannya kosong - null (tidak diketahui). BAS massal hanya mengusulkan
 * "gugur" bila nilainya false: kehadiran yang tidak dicatat bukan bukti tidak
 * hadir.
 */
function kehadiranSebelumnya(semuaSidang = []) {
  const sebelumnya = {};
  const tergugatPernahHadir = {};
  const penggugatPernahHadir = {};
  let perkaraTerakhir = null;
  let hadirTerakhir = null;
  let tergugatHadir = false;
  let penggugatHadir = false;
  let adaKosong = false;
  for (const baris of Array.isArray(semuaSidang) ? semuaSidang : []) {
    const perkara = String(baris.perkaraId);
    if (perkara !== perkaraTerakhir) {
      perkaraTerakhir = perkara;
      hadirTerakhir = null;
      tergugatHadir = false;
      penggugatHadir = false;
      adaKosong = false;
    }
    const kunci = String(baris.sidangId);
    sebelumnya[kunci] = hadirTerakhir;
    tergugatPernahHadir[kunci] = tergugatHadir;
    penggugatPernahHadir[kunci] = penggugatHadir ? true : adaKosong ? null : false;
    hadirTerakhir =
      baris.dihadiriOleh === null || baris.dihadiriOleh === undefined
        ? null
        : Number(baris.dihadiriOleh);
    if (hadirTerakhir === 1 || hadirTerakhir === 3) tergugatHadir = true;
    if (hadirTerakhir === 1 || hadirTerakhir === 2) penggugatHadir = true;
    // Sandi 1-4 saja yang terbaca pasti; kosong dan sandi intervensi (5-15)
    // tidak menyatakan pihak pertama tidak hadir.
    if (!(hadirTerakhir >= 1 && hadirTerakhir <= 4)) adaKosong = true;
  }
  return { sebelumnya, tergugatPernahHadir, penggugatPernahHadir };
}

async function keadaanPanggilanSidang(daftarSidang = []) {
  const sidang = daftarSidang.filter((x) => x && x.sidangId && x.perkaraId);
  if (sidang.length === 0) return {};

  const idPerkara = [...new Set(sidang.map((x) => Number(x.perkaraId)).filter(Boolean))].slice(0, 500);
  const idSidang = [...new Set(sidang.map((x) => Number(x.sidangId)).filter(Boolean))].slice(0, 500);
  if (idPerkara.length === 0 || idSidang.length === 0) return {};

  const isianPerkara = idPerkara.map(() => "?").join(", ");
  const isianSidang = idSidang.map(() => "?").join(", ");

  const [semuaSidang, semuaRelaas, semuaPihak] = await Promise.all([
    runQuery(
      `SELECT j.id AS sidangId, j.perkara_id AS perkaraId,
              j.tanggal_sidang AS tanggalSidang, j.dihadiri_oleh AS dihadiriOleh
         FROM perkara_jadwal_sidang j
        WHERE j.perkara_id IN (${isianPerkara})
        ORDER BY j.perkara_id ASC, j.tanggal_sidang ASC, j.id ASC`,
      idPerkara
    ),
    runQuery(
      // ket_temu dan tanggal_jursit_pos ikut dibaca - keduanya sudah dipakai
      // rincianSidang, jadi tidak ada kolom baru maupun kueri baru di sini.
      // Tanpa keduanya, jalur panggilan harus DITEBAK, dan tebakan itulah yang
      // sebelumnya salah pada 69% baris.
      `SELECT r.sidang_id AS sidangId,
              r.status_pos AS statusPos,
              r.tanggal_relaas AS tanggalRelaas,
              r.tanggal_jursit_pos AS tanggalKirimPos,
              r.ket_temu AS ketTemu,
              r.no_resi_pos AS noResiPos,
              vp.pihak_ke AS pihakKe
         FROM perkara_pelaksanaan_relaas r
         LEFT JOIN (${pihakDariTabel(`perkara_id IN (${isianPerkara})`)}) vp
                ON vp.pihak_id = r.pihak_id AND vp.perkara_id = r.perkara_id
        WHERE r.sidang_id IN (${isianSidang})`,
      [...isianPihakBerulang(idPerkara), ...idSidang]
    ),
    // Sisi pihak yang BENAR-BENAR ada pada tiap perkara. Permohonan kerap
    // hanya punya pemohon - menuntut adanya panggilan untuk termohon yang
    // memang tidak ada membuat hampir seluruh Pdt.P tertandai belum dipanggil.
    runQuery(
      `SELECT vp.perkara_id AS perkaraId, vp.pihak_ke AS pihakKe
         FROM (${pihakDariTabel(`perkara_id IN (${isianPerkara})`)}) vp
        GROUP BY vp.perkara_id, vp.pihak_ke`,
      isianPihakBerulang(idPerkara)
    ),
  ]);

  // --- Kehadiran pada sidang SEBELUMNYA, per sidang -------------------------
  const { sebelumnya, tergugatPernahHadir, penggugatPernahHadir } = kehadiranSebelumnya(semuaSidang);

  // --- Relaas per sidang, dikelompokkan menurut sisi pihak ------------------
  const relaasPerSidang = {};
  for (const baris of Array.isArray(semuaRelaas) ? semuaRelaas : []) {
    const kunci = String(baris.sidangId);
    if (!relaasPerSidang[kunci]) relaasPerSidang[kunci] = [];
    relaasPerSidang[kunci].push({
      pihakKe: baris.pihakKe === null || baris.pihakKe === undefined ? null : Number(baris.pihakKe),
      statusPos: baris.statusPos === null || baris.statusPos === undefined ? null : Number(baris.statusPos),
      adaRelaas: Boolean(baris.tanggalRelaas) || Boolean(cleanText(baris.noResiPos)),
      // Tanggalnya TIDAK dibuang lagi. Tanpa ketiganya, kepatutan tenggang
      // hanya dapat dihitung di panel rincian satu sidang - satu perkara pada
      // satu waktu - sementara yang ditanyakan justru "sidang mana minggu ini
      // yang panggilannya mepet".
      tanggalRelaas: isoTanggal(baris.tanggalRelaas),
      tanggalKirimPos: isoTanggal(baris.tanggalKirimPos),
      ketTemu: cleanText(baris.ketTemu),
      noResiPos: cleanText(baris.noResiPos),
    });
  }

  // --- Sisi pihak yang ada pada tiap perkara --------------------------------
  const sisiPerkara = {};
  for (const baris of Array.isArray(semuaPihak) ? semuaPihak : []) {
    const kunci = String(baris.perkaraId);
    const sisi = Number(baris.pihakKe);
    if (!Number.isFinite(sisi)) continue;
    if (!sisiPerkara[kunci]) sisiPerkara[kunci] = new Set();
    sisiPerkara[kunci].add(sisi);
  }

  // Tanggal tiap sidang, dari kueri yang sudah berjalan di atas. Pemanggil
  // keadaanPanggilanSidang hanya mengirim sidangId dan perkaraId, jadi
  // tanggalnya harus diambil dari sini - bukan diminta ulang.
  const tanggalPerSidang = {};
  for (const baris of Array.isArray(semuaSidang) ? semuaSidang : []) {
    tanggalPerSidang[String(baris.sidangId)] = isoTanggal(baris.tanggalSidang);
  }

  const hasil = {};
  for (const item of sidang) {
    const kunci = String(item.sidangId);
    const hadirSebelumnya = sebelumnya[kunci];
    const relaas = relaasPerSidang[kunci] || [];

    // Sisi yang wajib dipanggil menurut kehadiran sidang sebelumnya - lihat
    // catatan di kepala fungsi.
    let wajibMenurutHadir = [];
    // Sidang ikrar talak yang ditandai pemanggilnya (checklist milestone,
    // wajibSemuaSisi): suami DAN istri dipanggil - Pasal 70 ayat (3) UU
    // 7/1989 - berapa pun kehadiran pada sidang sebelumnya. Pemanggil lain
    // tidak mengirim penanda ini, dan bagi mereka aturannya tidak berubah.
    if (item.wajibSemuaSisi === true) wajibMenurutHadir = [1, 2];
    else if (hadirSebelumnya === 1) wajibMenurutHadir = [];
    else if (hadirSebelumnya === 2) wajibMenurutHadir = [2];
    else if (hadirSebelumnya === 3) wajibMenurutHadir = [1];
    else wajibMenurutHadir = [1, 2];

    // ======================================================================
    // HANYA SISI YANG BENAR-BENAR ADA YANG WAJIB DIPANGGIL
    // ======================================================================
    //
    // Permohonan kerap hanya punya pemohon. Menuntut adanya panggilan untuk
    // termohon yang memang tidak ada membuat hampir seluruh Pdt.P tertandai
    // belum dipanggil - peringatan yang selalu menyala berhenti dibaca.
    //
    // Bila daftar pihaknya sendiri tidak terbaca, yang dipakai daftar menurut
    // kehadiran apa adanya: lebih baik memperingatkan tanpa perlu daripada
    // diam saat panggilan memang belum ada.
    const sisiAda = sisiPerkara[String(item.perkaraId)];
    const wajib =
      sisiAda && sisiAda.size > 0
        ? wajibMenurutHadir.filter((sisi) => sisiAda.has(sisi))
        : wajibMenurutHadir;

    // ======================================================================
    // RELAAS TANPA KEDUDUKAN PIHAK TETAP DIHITUNG
    // ======================================================================
    //
    // Panggilan elektronik kerap tersimpan tanpa pihak_id yang tersambung ke
    // v_pihak_perkara, sehingga kedudukannya tidak terbaca. Mengabaikannya
    // membuat perkara yang JELAS sudah dipanggil - relaasnya ada, tanggalnya
    // ada - tertandai belum dipanggil.
    //
    // Karena itu relaas tanpa kedudukan dihitung menutup sisi yang tersisa,
    // satu relaas satu sisi. Itu perkiraan, tetapi perkiraan yang berpihak
    // pada kenyataan bahwa panggilannya memang ada.
    const sisiTerpanggil = new Set(
      relaas.filter((r) => r.adaRelaas && r.pihakKe !== null).map((r) => r.pihakKe)
    );
    const tanpaKedudukan = relaas.filter((r) => r.adaRelaas && r.pihakKe === null).length;

    const belumTertutup = wajib.filter((sisi) => !sisiTerpanggil.has(sisi));
    const belumDipanggil = belumTertutup.slice(Math.min(tanpaKedudukan, belumTertutup.length));

    // Retur dihitung dari SELURUH relaas sidang ini, bukan hanya sisi yang
    // wajib: surat yang kembali tetap perlu ditindaklanjuti.
    const retur = relaas.filter((r) => r.statusPos === 2).length;

    // ======================================================================
    // HITUNG MUNDUR TENGGANG - ATURANNYA TIDAK DIKARANG DI SINI
    // ======================================================================
    //
    // Seluruh angkanya datang dari ecourtPanggilanService: tiga jalur
    // (elektronik 3 hari kalender, surat tercatat 6 hari kalender dan wajib
    // terbukti diterima, biasa 3 hari KERJA), masing-masing dengan dasar
    // hukumnya, dan seluruhnya dapat disetel tanpa menyentuh kode.
    //
    // Yang dikerjakan di sini hanya memilih relaas TERAKHIR tiap sisi lalu
    // menanyakannya - jalurnya pun tidak ditebak, melainkan diturunkan
    // bacaRelaas dari sandi ket_temu.
    const tenggang = nilaiTenggangSidang(relaas, tanggalPerSidang[kunci] || "", wajib);

    hasil[kunci] = {
      hadirSebelumnya,
      // Berapa hari lagi sidangnya. Negatif berarti sudah lewat.
      sisaHariKeSidang: tenggang.sisaHariKeSidang,
      // Pihak yang paling genting - bukan rata-rata, sebab satu panggilan
      // yang tidak patut sudah cukup membatalkan sidangnya.
      tenggangTersempit: tenggang.tersempit,
      // Menyala bila ada pihak yang tenggangnya kurang dari ambang jalurnya,
      // ATAU sidangnya tinggal kurang dari ambang sementara pihak wajibnya
      // belum punya relaas sama sekali.
      tenggangMepet: tenggang.mepet,
      // Tergugat/termohon pernah hadir pada sidang mana pun sebelumnya. Layar
      // memakainya untuk menutup "potensi verstek" pada perkara yang sudah
      // contradictoir - lihat kehadiranSebelumnya.
      tergugatPernahHadir: Boolean(tergugatPernahHadir[kunci]),
      // Pihak pertama pernah hadir sebelumnya: true / false / null (ada
      // sidang sebelumnya yang kehadirannya kosong). Dipakai BAS massal
      // memilih "gugur" atau "tunda panggil para pihak" (9 Okt 2026).
      penggugatPernahHadir:
        penggugatPernahHadir[kunci] === undefined ? null : penggugatPernahHadir[kunci],
      wajibDipanggil: wajib,
      // Disebutkan supaya dapat ditelusuri bila penandanya terasa keliru.
      sisiPihakAda: sisiAda ? [...sisiAda].sort() : [],
      relaasTanpaKedudukan: tanpaKedudukan,
      belumDipanggil: belumDipanggil.length,
      // Sisi MANA yang belum tertutup - 1 penggugat/pemohon, 2
      // tergugat/termohon. Angka saja tidak menolong juru sita yang membaca
      // penandanya: yang perlu diketahui siapa yang harus dipanggil.
      sisiBelumDipanggil: belumDipanggil,
      retur,
      // Aman berarti tidak ada yang perlu ditindaklanjuti - penandanya tidak
      // usah muncul sama sekali.
      aman: belumDipanggil.length === 0 && retur === 0,
    };
  }

  return hasil;
}

/**
 * Tenggang panggilan satu sidang: seberapa mepet, dan siapa yang paling genting.
 *
 * ============================================================================
 * TERSEMPIT, BUKAN RATA-RATA
 * ============================================================================
 *
 * Satu panggilan yang tidak patut sudah cukup membatalkan sidangnya. Angka
 * rata-rata akan menyembunyikan justru pihak yang bermasalah di balik pihak
 * yang panggilannya sudah lama beres.
 *
 * ============================================================================
 * YANG BELUM DIPANGGIL PUN DIHITUNG
 * ============================================================================
 *
 * Sidang yang tinggal dua hari lagi sementara tergugatnya belum punya relaas
 * sama sekali TIDAK menghasilkan "tenggang kurang" - ia tidak menghasilkan
 * apa-apa, sebab tidak ada tanggal yang dapat dibandingkan. Padahal itulah
 * keadaan yang paling genting. Karena itu ketiadaan relaas pada sisi yang
 * wajib ikut menyalakan penandanya, dengan alasannya sendiri.
 */
function nilaiTenggangSidang(relaas, tanggalSidang, sisiWajib = []) {
  const hariIni = isoTanggal(new Date());
  const sisaHariKeSidang = ecourtPanggilanService.selisihHari(hariIni, tanggalSidang, {
    hariKerja: false,
  });

  if (!tanggalSidang) {
    return { sisaHariKeSidang: null, tersempit: null, mepet: false };
  }

  // Relaas TERAKHIR tiap sisi - panggilan ulang menggantikan yang sebelumnya.
  const terakhirPerSisi = new Map();
  for (const r of relaas) {
    const sisi = r.pihakKe === null || r.pihakKe === undefined ? 0 : Number(r.pihakKe);
    const sebelumnya = terakhirPerSisi.get(sisi);
    const tanggal = r.tanggalKirimPos || r.tanggalRelaas || "";
    const tanggalSebelumnya = sebelumnya
      ? sebelumnya.tanggalKirimPos || sebelumnya.tanggalRelaas || ""
      : "";
    if (!sebelumnya || tanggal > tanggalSebelumnya) terakhirPerSisi.set(sisi, r);
  }

  let tersempit = null;
  let mepet = false;
  for (const [sisi, r] of terakhirPerSisi) {
    const dibaca = ecourtPanggilanService.bacaRelaas(r);
    const nilai = ecourtPanggilanService.nilaiKepatutan({
      tanggalPanggilan: dibaca.tanggalKirim || r.tanggalRelaas || "",
      tanggalSidang,
      // "pos" bukan kunci aturan - ia harus diterjemahkan menjadi
      // "surat_tercatat" dulu, atau ambangJalur diam-diam memakai Pasal 122
      // HIR (3 hari KERJA) untuk surat tercatat yang menuntut 6 hari kalender
      // dan bukti penerimaan. Menyangkut 21% relaas di satker ini.
      jalur: ecourtPanggilanService.jalurAturan(dibaca.jalur),
      diterima: dibaca.diterima,
    });
    if (nilai.dinilai && nilai.patut === false && nilai.alasan === "tenggang_kurang_dari_ambang") {
      mepet = true;
    }
    if (
      nilai.selisih !== null &&
      (tersempit === null || tersempit.selisih === null || nilai.selisih < tersempit.selisih)
    ) {
      tersempit = { sisi, ...nilai };
    }
  }

  // ==========================================================================
  // RELAAS TANPA KEDUDUKAN DIKREDITKAN - SAMA SEPERTI DI ATASNYA
  // ==========================================================================
  //
  // keadaanPanggilanSidang sengaja mengkreditkan relaas ber-pihakKe null ke
  // sisi yang belum tertutup: panggilan elektronik kerap tersimpan tanpa
  // pihak_id yang tersambung, dan mengabaikannya menandai perkara yang JELAS
  // sudah dipanggil sebagai belum.
  //
  // Penghitung ini dulu tidak ikut melakukannya, sehingga dua ruas pada baris
  // yang SAMA saling membantah: belumDipanggil = 0 dan aman = true, sementara
  // tenggangMepet = true dengan alasan "belum dipanggil". Diukur di
  // sipp_donggala: 435 dari 14.496 relaas tidak menemukan kedudukannya (3,0%),
  // dan 60 sidang yang SELURUH relaas bertanggalnya tanpa kedudukan.
  const tanpaKedudukan = terakhirPerSisi.has(0) ? 1 : 0;
  let kreditTersisa = tanpaKedudukan;

  // Sisi wajib yang belum punya relaas sama sekali, sementara sidangnya sudah
  // dekat. Ambangnya diambil dari jalur "biasa" - jalur paling longgar - supaya
  // penandanya tidak menyala pada sidang yang masih jauh.
  if (!mepet && sisaHariKeSidang !== null && sisaHariKeSidang >= 0) {
    const ambangLonggar = ecourtPanggilanService.ambangJalur("biasa").hari;
    for (const sisi of sisiWajib) {
      if (terakhirPerSisi.has(Number(sisi))) continue;
      if (kreditTersisa > 0) {
        kreditTersisa -= 1;
        continue;
      }
      if (sisaHariKeSidang < ambangLonggar) {
        mepet = true;
        if (!tersempit) {
          tersempit = {
            sisi: Number(sisi),
            dinilai: false,
            patut: false,
            selisih: null,
            alasan: "belum_dipanggil_sidang_sudah_dekat",
            ambang: ambangLonggar,
          };
        }
      }
    }
  }

  return { sisaHariKeSidang, tersempit, mepet };
}

/**
 * Keadaan akhir sekumpulan perkara: minutasi dan berkekuatan hukum tetap.
 *
 * ==========================================================================
 * DIPAKAI MENENTUKAN BERKAS MANA YANG BOLEH DIHAPUS
 * ==========================================================================
 *
 * Masa simpan arsip TIDAK dihitung dari kapan berkasnya diunduh, melainkan
 * dari kapan perkaranya selesai. Perkara yang masih berjalan tiga tahun akan
 * kehilangan berkas awalnya bila umur unduhan yang dipakai - padahal justru
 * berkas itulah yang dibaca majelis saat memutus.
 *
 * Yang dijadikan penanda selesai adalah tanggal berkekuatan hukum tetap.
 * Tanggal minutasi dipakai bila BHT belum terisi: berkas yang sudah
 * diminutasi berarti perkaranya sudah dijahit dan disimpan.
 */
async function perkaraFinal(daftarNomorPerkara = []) {
  const nomor = [...new Set(daftarNomorPerkara.map((x) => normalizeCaseNumber(x)).filter(Boolean))];
  if (nomor.length === 0) return {};

  const dipakai = nomor.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  const rows = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            MAX(pu.tanggal_bht) AS tanggalBht,
            MAX(pu.tanggal_minutasi) AS tanggalMinutasi
       FROM perkara p
       JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE p.nomor_perkara IN (${isian})
      GROUP BY p.nomor_perkara`,
    dipakai
  );

  const hasil = {};
  for (const baris of Array.isArray(rows) ? rows : []) {
    hasil[cleanText(baris.nomorPerkara)] = {
      tanggalBht: isoTanggal(baris.tanggalBht),
      tanggalMinutasi: isoTanggal(baris.tanggalMinutasi),
    };
  }
  return hasil;
}

/**
 * Nama para pihak untuk sekumpulan perkara sekaligus.
 *
 * ==========================================================================
 * SATU KUERI UNTUK SELURUH DAFTAR, BUKAN SATU PER PERKARA
 * ==========================================================================
 *
 * Daftar sidang sehari dapat memuat puluhan perkara. Menanyakan pihaknya satu
 * per satu berarti puluhan perjalanan ke SIPP untuk keterangan yang dapat
 * diambil sekali jalan - dan jadwal yang lambat dimuat tidak akan dibuka orang.
 *
 * opsi.pisahkanTurut: turut tergugat (pihak_ke 4) ditaruh di turutTergugat,
 * bukan di tergugat. BAWAANNYA MATI - jadwal sidang, cetak, antrian, dan
 * papan pintu tetap menerima bentuk lama, sebab bagi mereka yang penting
 * sisinya, dan mengubah bentuk itu diam-diam memindahkan nama dari layar
 * yang tidak sedang diperbaiki.
 */
async function pihakBanyakPerkara(daftarPerkaraId = [], opsi = {}) {
  const pisahkanTurut = opsi.pisahkanTurut === true;
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};

  // Nomor perkara masuk sebagai parameter satu per satu, bukan disambung ke
  // teks kueri. Daftar dibatasi supaya tidak menyusun kueri raksasa.
  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  const rows = await runQuery(
    `SELECT vp.perkara_id AS perkaraId, vp.nama AS nama, vp.pihak_ke AS pihakKe
       FROM (${pihakDariTabel(`perkara_id IN (${isian})`)}) vp
      -- ==================================================================
      -- URUTAN SIPP SENDIRI, SEBAB URUTAN LAMA TIDAK PERNAH STABIL
      -- ==================================================================
      --
      -- Mula-mula saya hendak menyamakan persis dengan v_pihak_perkara supaya
      -- perubahan ini murni kecepatan. Pengukuran membatalkan rencana itu:
      -- view lama dijalankan DUA KALI atas data yang sama memulangkan urutan
      -- yang BERBEDA - 542/Pdt.G/2026/PA.Dgl keluar [Indah, Intan, Salbi] lalu
      -- [Salbi, Indah, Intan]. Tabel sementara yang dibentuk UNION berpembeda
      -- tidak menjanjikan urutan apa pun, jadi tidak ada "urutan lama" untuk
      -- disamakan.
      --
      -- Karena urutannya memang harus dipilih, yang dipilih adalah milik SIPP:
      -- kolom urutan pada perkara_pihakN. Untuk 542 itu Salbi(1), Indah(2),
      -- Intan(3) - Tergugat I, II, III. Itulah yang harus tertulis pada
      -- putusan; abjad hanya kebetulan tabel sementara.
      ORDER BY vp.perkara_id ASC, vp.pihak_ke ASC, vp.urutan ASC, vp.nama ASC`,
    isianPihakBerulang(dipakai)
  );

  // ==========================================================================
  // TIAP KEDUDUKAN DISEBUT SENDIRI - TIDAK ADA LAGI "SELAIN TERGUGAT"
  // ==========================================================================
  //
  // Aturan lama: pihak_ke 2 masuk tergugat, SELURUH SISANYA masuk penggugat.
  // Itu keliru pada dua kedudukan sekaligus, dan pengukuran v_pihak_perkara
  // di PA Donggala menunjukkan besarnya:
  //
  //   pihak_ke 1  Pemohon / Penggugat        14.268  benar
  //   pihak_ke 2  Tergugat / Termohon         5.846  benar
  //   pihak_ke 4  TURUT TERGUGAT                 27  tercatat sebagai penggugat
  //   pihak_ke 5  SAKSI                      16.480  tercatat sebagai penggugat
  //
  // Saksi berjumlah lebih banyak daripada penggugatnya sendiri, sehingga
  // hampir setiap perkara tampak berpenggugat tiga orang. Turut tergugat lebih
  // buruk lagi: ia tercatat pada sisi yang BERLAWANAN dengan kedudukannya.
  //
  // Keliru ini tidak pernah terlihat selama layar hanya menggambar nama
  // pertama - dan nama pertama kebetulan selalu penggugat yang benar, karena
  // kuerinya sudah urut menurut pihak_ke. Ia baru muncul ketika jumlahnya
  // ikut disebut.
  //
  // Yang terkena bukan hanya layar jadwal: daftar yang sama dipakai CETAK
  // jadwal sidang, layar antrian ruang tunggu, dan papan pintu ruang - naskah
  // dan layar yang dibaca para pihak sendiri.
  //
  // Kedudukan yang tidak dikenali sengaja TIDAK dibuang ke salah satu sisi.
  // Itulah kekeliruan yang sedang diperbaiki; mengulanginya untuk nilai baru
  // hanya menunda kejadian yang sama.
  const hasil = {};
  for (const baris of Array.isArray(rows) ? rows : []) {
    const kunci = String(baris.perkaraId);
    if (!hasil[kunci]) {
      // 6 Okt 2026 (butir 23): turutTergugat dan intervensi SELALU dikirim
      // tersendiri. Tanpa pisahkanTurut, turut tergugat TETAP juga di
      // tergugat (pemakai lama: cetak, layar antrian, papan ruang) - layar
      // yang menyebutnya "Turut T" menyaringnya dari baris T sendiri.
      hasil[kunci] = { penggugat: [], tergugat: [], saksi: [], lain: [], turutTergugat: [], intervensi: [] };
    }
    const nama = cleanText(baris.nama);
    if (!nama) continue;

    const kedudukan = Number(baris.pihakKe);
    if (kedudukan === 1) hasil[kunci].penggugat.push(nama);
    else if (kedudukan === 4) {
      hasil[kunci].turutTergugat.push(nama);
      // Turut tergugat ada di SISI tergugat - itulah artinya. Menaruhnya di
      // penggugat membalik kedudukannya di naskah yang dibaca para pihak.
      if (!pisahkanTurut) hasil[kunci].tergugat.push(nama);
    } else if (kedudukan === 2) hasil[kunci].tergugat.push(nama);
    // pihak_ke 3 = intervensi (perkara_pihak3: jenis_intervensi_*,
    // tergabung_ke_pihak). Bukan sisi mana pun sampai ia tergabung.
    else if (kedudukan === 3) hasil[kunci].intervensi.push(nama);
    else if (kedudukan === 5) hasil[kunci].saksi.push(nama);
    else hasil[kunci].lain.push(nama);
  }
  return hasil;
}

/**
 * Id orang pada baris penunjukan, atau null.
 *
 * Ikut dikirim supaya nama di layar Status Perkara dapat membuka rekap
 * orangnya LEWAT ID - bukan lewat ejaan namanya, yang pada SIPP berbeda-beda
 * antar penunjukan untuk orang yang sama (lihat rekapPetugasService).
 */
function idOrang(nilai) {
  const angka = Number(nilai);
  return Number.isSafeInteger(angka) && angka > 0 ? angka : null;
}

/** Majelis hakim yang bertugas, berurut sesuai kedudukannya. */
async function majelisPerkara(perkaraId) {
  const rows = await runQuery(
    `SELECT hk.hakim_id AS id,
            hk.hakim_kode AS kode,
            hk.hakim_nama AS nama,
            hk.jabatan_hakim_nama AS jabatan,
            hk.urutan AS urutan
       FROM perkara_hakim_pn hk
      WHERE hk.perkara_id = ? AND hk.aktif = 'Y'
      ORDER BY hk.urutan ASC`,
    [perkaraId]
  );
  return rows.map((row) => ({
    id: idOrang(row.id),
    kode: cleanText(row.kode),
    nama: cleanText(row.nama),
    jabatan: cleanText(row.jabatan),
  }));
}

/** Panitera sidang dan jurusita yang bertugas. */
async function petugasPerkara(perkaraId) {
  const [panitera, jurusita] = await Promise.all([
    runQuery(
      `SELECT pn.panitera_id AS id, pn.panitera_kode AS kode, pn.panitera_nama AS nama
         FROM perkara_panitera_pn pn
        WHERE pn.perkara_id = ? AND pn.aktif = 'Y'
        ORDER BY pn.urutan ASC`,
      [perkaraId]
    ),
    runQuery(
      `SELECT js.jurusita_id AS id, js.jurusita_kode AS kode, js.jurusita_nama AS nama
         FROM perkara_jurusita js
        WHERE js.perkara_id = ? AND js.aktif = 'Y'
        ORDER BY js.urutan ASC`,
      [perkaraId]
    ),
  ]);

  const rapikan = (rows) =>
    rows
      .map((row) => ({ id: idOrang(row.id), kode: cleanText(row.kode), nama: cleanText(row.nama) }))
      .filter((x) => x.nama);

  return { panitera: rapikan(panitera), jurusita: rapikan(jurusita) };
}

/**
 * Nilai kolom berkas SIPP yang benar-benar berupa jalur, bukan penanda "0"/"-".
 *
 * SIPP menyimpan "0" pada kolom dokumen yang kosong - bukan NULL, bukan string
 * kosong - sehingga pemeriksaan kebenaran apa pun atasnya menjawab "ada".
 */
function adaJalurBerkas(nilai) {
  const teks = cleanText(nilai);
  if (!teks || teks === "0" || teks === "-") return false;
  return /\.[A-Za-z0-9]{2,5}$/.test(teks);
}

/**
 * Keadaan relaas panggilan untuk satu sidang.
 *
 * Relaas dicatat per pihak per sidang. Yang dijawab di sini bukan sekadar
 * "sudah ada relaas atau belum", melainkan pihak MANA yang sudah dipanggil dan
 * apakah jurusita bertemu orangnya - dua hal yang menentukan sidang dapat
 * dilanjutkan atau harus ditunda.
 *
 * ============================================================================
 * TANPA NOMOR SIDANG, YANG DIBACA SELURUH PERKARA
 * ============================================================================
 *
 * Layar status perkara membaca satu perkara utuh, bukan satu sidang, dan
 * memanggil fungsi ini tanpa nomor sidang. Sebelumnya keadaan itu dijawab
 * dengan daftar KOSONG - sehingga perkara yang relaasnya lengkap terbaca
 * seolah belum pernah dipanggil sama sekali.
 *
 * Nomor sidang 0 kini berarti "seluruh sidang perkara ini", dan tiap baris
 * membawa tanggal sidangnya supaya tetap jelas relaas itu untuk sidang mana.
 */
async function relaasSidang(perkaraId, sidangId) {
  const nomorSidang = Number(sidangId) || 0;
  const rows = await runQuery(
    `SELECT r.id            AS id,
            r.pihak_id      AS pihakId,
            r.tanggal_relaas AS tanggalRelaas,
            r.tanggal_jursit_pos AS tanggalKirimPos,
            r.status_pos    AS statusPos,
            r.ket_hasil_relaas AS ketHasilRelaas,
            r.ket_temu      AS ketTemu,
            r.no_resi_pos   AS noResiPos,
            r.doc_relaas    AS docRelaas,
            r.doc_resi      AS docResi,
            r.sidang_id     AS sidangId,
            sd.tanggal_sidang AS tanggalSidang,
            js.jurusita_nama AS jurusitaPerkara,
            jm.nama_gelar   AS jurusitaGelar,
            jm.nama         AS jurusitaMaster,
            COALESCE(pk.nama, vp.nama) AS namaPihak,
            vp.pihak_ke     AS pihakKe
       FROM perkara_pelaksanaan_relaas r
       -- Penugasan jurusita PADA PERKARA ini. Kerap kosong: relaas dapat
       -- dilaksanakan jurusita yang tidak tercatat pada penugasan perkara,
       -- atau penugasannya sudah tidak aktif.
       LEFT JOIN perkara_jurusita js
              ON js.jurusita_id = r.jurusita_id AND js.perkara_id = r.perkara_id
       -- Daftar induk jurusita - inilah yang selalu ada. Tanpa sambungan ini,
       -- kolom jurusita kosong padahal namanya jelas tercatat di relaas.
       LEFT JOIN jurusita jm ON jm.id = r.jurusita_id
       LEFT JOIN pihak pk ON pk.id = r.pihak_id
       -- Tanggal sidang yang dipanggil. Tanpa ini, daftar relaas satu perkara
       -- utuh berupa deretan nama tanpa keterangan untuk sidang yang mana.
       LEFT JOIN perkara_jadwal_sidang sd ON sd.id = r.sidang_id
       -- Kedudukan pihak - penggugat/pemohon atau tergugat/termohon. Inilah
       -- yang menentukan jalur panggilan yang seharusnya, dan tanpa ini
       -- pemohon terbaca seolah harus dipanggil lewat surat tercatat.
       LEFT JOIN (${pihakDariTabel("perkara_id = ?")}) vp
              ON vp.pihak_id = r.pihak_id AND vp.perkara_id = r.perkara_id
      WHERE r.perkara_id = ?${nomorSidang ? " AND r.sidang_id = ?" : ""}
      ORDER BY sd.tanggal_sidang ASC, r.tanggal_relaas ASC, r.id ASC
      LIMIT 200`,
    nomorSidang
      ? [...isianPihakBerulang([perkaraId]), perkaraId, nomorSidang]
      : [...isianPihakBerulang([perkaraId]), perkaraId]
  );

  return rows.map((row) => ({
    id: String(row.id || ""),
    sidangId: String(row.sidangId || ""),
    tanggalSidang: isoTanggal(row.tanggalSidang),
    namaPihak: cleanText(row.namaPihak),
    // Tanggal PELAKSANAAN relaas. Untuk surat tercatat ini tanggal
    // penyerahan kepada yang dipanggil, BUKAN tanggal kirimnya ke pos.
    tanggalRelaas: isoTanggal(row.tanggalRelaas),
    // Tanggal surat diserahkan ke kantor pos - inilah "dikirim" yang dihitung
    // pada SK KMA 363/2022 angka 8 huruf c.
    tanggalKirimPos: isoTanggal(row.tanggalKirimPos),
    // Hasil lacak kiriman. SIPP menyimpannya sebagai angka; 1 berarti
    // pengiriman berhasil sampai.
    statusPos: row.statusPos === null || row.statusPos === undefined ? null : Number(row.statusPos),
    // status_pos 2 berarti surat DIKEMBALIKAN. Berbeda dari belum dipanggil:
    // yang ini sudah dikerjakan jurusita, tetapi tidak sampai.
    retur: Number(row.statusPos) === 2,
    ketHasilRelaas: cleanText(row.ketHasilRelaas),
    // 'Y' berarti jurusita bertemu langsung dengan yang dipanggil.
    //
    // TIDAK dibuang walau caranya sekarang dibaca terpisah: empat tempat di
    // portal memakainya, dan artinya tetap tepat - bertemu LANGSUNG. Yang
    // ditambahkan keterangan di sebelahnya, bukan penggantinya.
    bertemu: cleanText(row.ketTemu).toUpperCase() === "Y",
    // Cara penyampaiannya - lihat SANDI_CARA_RELAAS. Sebelum ini segala yang
    // bukan "Y" tampil sebagai "tidak bertemu", termasuk panggilan elektronik
    // dan relaas yang diterima orang serumah; 46,4% baris salah dilabeli.
    caraRelaas: caraRelaas(row.ketTemu),
    noResiPos: cleanText(row.noResiPos),
    // Tiga sumber, dari yang paling khusus: penugasan pada perkara ini, lalu
    // nama bergelar pada daftar induk, lalu namanya saja.
    jurusitaNama:
      cleanText(row.jurusitaPerkara) ||
      cleanText(row.jurusitaGelar) ||
      cleanText(row.jurusitaMaster),
    // pihak_ke SIPP: 1 penggugat/pemohon, 2 tergugat/termohon.
    pihakKe: row.pihakKe === null || row.pihakKe === undefined ? null : Number(row.pihakKe),
    peran:
      Number(row.pihakKe) === 1
        ? "Penggugat/Pemohon"
        : Number(row.pihakKe) === 2
          ? "Tergugat/Termohon"
          : "",
    // ========================================================================
    // "0" BUKAN JALUR BERKAS
    // ========================================================================
    //
    // Diukur pada sipp_donggala 25 September 2026: 5.275 dari 8.351 baris
    // ber-doc_resi menyimpan nilai literal "0", tersebar pada 2.818 perkara;
    // doc_relaas hanya 8 baris. Boolean("0") bernilai TRUE, sehingga layar
    // memasang tombol "Resi" untuk berkas yang tidak pernah ada, dan penyusun
    // ZIP menembak 5.275 permintaan yang pasti dijawab 400 - memakan jatah
    // waktu justru pada perkara yang berkasnya paling banyak.
    //
    // Yang diperiksa keberadaan TITIK: jalur berkas SIPP selalu berekstensi
    // (resources/file/doc/2026/01/....pdf), dan yang tanpa titik tidak pernah
    // dapat dibaca sippDocumentService. Diukur: dari seluruh baris yang bukan
    // kosong dan bukan "0", NOL yang gagal aturan ini pada kedua kolom - jadi
    // yang tersaring hanya penanda palsunya, bukan satu berkas pun yang nyata.
    //
    // Ekstensinya TIDAK ikut dibawa keluar: nama berkas yang sebenarnya sudah
    // dikirim bot pada Content-Disposition tiap unduhan, dan itulah yang
    // dibaca penyusun ZIP maupun tombol unduh satuan. Membawa ruas kedua yang
    // mengatakan hal yang sama berarti dua jawaban yang suatu hari berselisih.
    adaDokumen: adaJalurBerkas(row.docRelaas),
    adaResi: adaJalurBerkas(row.docResi),
  }));
}

/**
 * Apakah keterangan saksi sudah tercatat pada perkara ini?
 *
 * Yang dihitung adalah keterangan saksi di SIPP, bukan daftar saksi yang
 * diajukan. Keduanya berbeda: saksi dapat diajukan tetapi belum diperiksa, dan
 * yang menentukan kesiapan berkas adalah keterangannya - bukan namanya.
 */
async function saksiPerkara(perkaraId) {
  const aman = async (kerja, cadangan) => {
    try {
      return await kerja();
    } catch {
      return cadangan;
    }
  };

  const [rows, daftar] = await Promise.all([
    aman(
      () =>
        runQuery(
          `SELECT COUNT(DISTINCT s.saksi_id) AS jumlahSaksi,
                  COUNT(*) AS jumlahKeterangan,
                  MAX(s.sidang_id) AS sidangTerakhir
             FROM perkara_keterangan_saksi s
            WHERE s.perkara_id = ?`,
          [perkaraId]
        ),
      []
    ),
    // ========================================================================
    // SAKSI YANG DIAJUKAN, DIPISAH MENURUT SISI YANG MENGHADIRKAN
    // ========================================================================
    //
    // Dua pertanyaan yang berbeda, dan sebelum ini hanya satu yang terjawab:
    //
    //   perkara_keterangan_saksi  saksi yang sudah DIPERIKSA - keterangannya
    //                             tercatat, dan itulah yang menentukan berkas
    //                             siap atau belum;
    //   perkara_pihak5            saksi yang DIAJUKAN - namanya terdaftar,
    //                             tetapi mungkin belum pernah diperiksa.
    //
    // Yang ditanyakan di layar jadwal adalah yang kedua: berapa saksi dari
    // pihak penggugat dan berapa dari tergugat, supaya majelis tahu sebelum
    // sidang siapa yang akan hadir.
    //
    // saksi_pihak_ke - BUKAN jenis_pihak_id - yang menyimpan sisinya.
    // jenis_pihak_id bernilai 1 pada seluruh 16.480 baris di PA Donggala,
    // sehingga memakainya membuat setiap saksi terbaca sebagai saksi
    // penggugat. Sebaran saksi_pihak_ke: 16.240 sisi penggugat, 240 sisi
    // tergugat - dan ada perkara yang benar-benar punya saksi dari keduanya.
    aman(
      () =>
        runQuery(
          `SELECT k.saksi_pihak_ke AS sisi, COUNT(*) AS jumlah
             FROM perkara_pihak5 k
            WHERE k.perkara_id = ?
            GROUP BY k.saksi_pihak_ke`,
          [perkaraId]
        ),
      []
    ),
  ]);

  const baris = rows[0] || {};
  const jumlahSaksi = Number(baris.jumlahSaksi) || 0;

  let diajukanPihak1 = 0;
  let diajukanPihak2 = 0;
  for (const x of Array.isArray(daftar) ? daftar : []) {
    if (Number(x.sisi) === 1) diajukanPihak1 = Number(x.jumlah) || 0;
    else if (Number(x.sisi) === 2) diajukanPihak2 = Number(x.jumlah) || 0;
  }

  return {
    ada: jumlahSaksi > 0,
    jumlahSaksi,
    jumlahKeterangan: Number(baris.jumlahKeterangan) || 0,
    // Saksi yang diajukan tiap sisi. Nol berarti benar-benar tidak ada yang
    // diajukan - berbeda dari "diajukan tetapi belum diperiksa", yang
    // terbaca dari selisihnya terhadap jumlahSaksi di atas.
    diajukanPihak1,
    diajukanPihak2,
    adaDiajukan: diajukanPihak1 + diajukanPihak2 > 0,
  };
}

/**
 * Jumlah saksi yang diajukan tiap sisi, untuk sekumpulan perkara sekaligus.
 *
 * Dipakai daftar jadwal supaya penandanya dapat menyebut angka tanpa membuka
 * rincian tiap perkara satu per satu.
 */
async function saksiBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};

  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  // ==========================================================================
  // NAMANYA IKUT, DAN PEMISAHNYA PIPA - BUKAN KOMA
  // ==========================================================================
  //
  // Pengukuran di PA Donggala: 573 nama saksi MEMUAT KOMA - "Idris, S.H.I.",
  // gelar di belakang nama, dan sejenisnya - sedangkan tidak satu pun memuat
  // tanda pipa. Memakai koma sebagai pemisah berarti satu saksi bergelar
  // terpecah menjadi dua saksi pada layar, dan jumlahnya ikut salah.
  //
  // CONVERT USING utf8 dipakai karena alasan yang sama dengan kueri putusan:
  // GROUP_CONCAT menolak campuran collation, dan penolakannya baru terjadi
  // saat kueri dijalankan.
  const rows = await runQuery(
    `SELECT k.perkara_id AS perkaraId,
            SUM(CASE WHEN k.saksi_pihak_ke = 1 THEN 1 ELSE 0 END) AS pihak1,
            SUM(CASE WHEN k.saksi_pihak_ke = 2 THEN 1 ELSE 0 END) AS pihak2,
            GROUP_CONCAT(CASE WHEN k.saksi_pihak_ke = 1 THEN CONVERT(k.nama USING utf8) END
                         ORDER BY k.urutan ASC SEPARATOR '|') AS nama1,
            GROUP_CONCAT(CASE WHEN k.saksi_pihak_ke = 2 THEN CONVERT(k.nama USING utf8) END
                         ORDER BY k.urutan ASC SEPARATOR '|') AS nama2
       FROM perkara_pihak5 k
      WHERE k.perkara_id IN (${isian})
      GROUP BY k.perkara_id`,
    dipakai
  );

  const pecah = (nilai) =>
    String(nilai || "")
      .split("|")
      .map((x) => cleanText(x))
      .filter(Boolean);

  const hasil = {};
  for (const baris of Array.isArray(rows) ? rows : []) {
    hasil[String(baris.perkaraId)] = {
      diajukanPihak1: Number(baris.pihak1) || 0,
      diajukanPihak2: Number(baris.pihak2) || 0,
      namaPihak1: pecah(baris.nama1),
      namaPihak2: pecah(baris.nama2),
    };
  }
  return hasil;
}

/** Dokumen yang tersimpan di SIPP untuk perkara ini. */
async function dokumenSipp(perkaraId) {
  const rows = await runQuery(
    `SELECT d.id            AS id,
            d.nama_dokumen  AS namaDokumen,
            d.nama_file     AS namaFile,
            d.ukuran_file   AS ukuranFile,
            d.keterangan    AS keterangan,
            d.diinput_tanggal AS diinputTanggal
       FROM perkara_dokumen d
      WHERE d.perkara_id = ?
      ORDER BY d.diinput_tanggal DESC, d.id DESC`,
    [perkaraId]
  );

  return rows.map((row) => ({
    id: String(row.id || ""),
    namaDokumen: cleanText(row.namaDokumen) || cleanText(row.namaFile),
    namaFile: cleanText(row.namaFile),
    ukuranByte: Number(row.ukuranFile) || 0,
    keterangan: cleanText(row.keterangan),
  }));
}

/**
 * Jenis berkas SIPP yang dapat diunduh - SATU daftar, dipakai bersama.
 *
 * Gerbang bot memakai daftar ini untuk menolak jenis yang tidak dikenali.
 * Sebelumnya ia punya daftar tulisan tangan sendiri, dan daftar itu tertinggal
 * ketika penetapan, petitum, arsip, dan ikrar talak ditambahkan di bawah -
 * sehingga keempatnya ditolak 400 padahal kodenya sudah ada.
 *
 * Menaruhnya di sebelah cabang-cabangnya membuat keduanya sukar berselisih:
 * yang menambah cabang melihat daftarnya pada layar yang sama.
 */
const JENIS_BERKAS_SIPP = [
  "dokumen",
  "penetapan",
  "petitum",
  "arsip",
  "ikrar-talak",
  "bas",
  "putusan",
  "putusan-anonim",
  "relaas",
  "resi",
];

/**
 * Jalur berkas SIPP untuk satu dokumen, dibaca DARI DATABASE.
 *
 * Jalurnya tidak pernah datang dari peramban. Pemanggil menyebut nomor barisnya,
 * dan jalurnya dicari di sini - sehingga tidak ada cara meminta berkas di luar
 * yang memang tercatat pada perkara.
 */
async function jalurDokumenSipp(jenis, id) {
  const nomor = Number(id);
  if (!Number.isFinite(nomor) || nomor <= 0) return null;

  if (jenis === "dokumen") {
    const rows = await runQuery(
      `SELECT d.lokasi_file AS lokasi, d.nama_file AS nama, d.nama_dokumen AS judul
         FROM perkara_dokumen d WHERE d.id = ? LIMIT 1`,
      [nomor]
    );
    const baris = rows[0];
    if (!baris) return null;
    const lokasi = cleanText(baris.lokasi);
    const nama = cleanText(baris.nama);
    if (!nama) return null;
    return { jalur: lokasi ? `${lokasi}/${nama}` : nama, judul: cleanText(baris.judul) || nama };
  }

  // Berkas pindaian penetapan - PMH, PPP, PJS, atau PHS. Yang disebut
  // pemanggil nomor barisnya, bukan jalurnya: jalur berkas tidak pernah
  // datang dari peramban.
  if (jenis === "penetapan") {
    const rows = await runQuery(
      `SELECT d.dokumen AS berkas, d.nama_dokumen AS judul
         FROM perkara_dokumen_penetapan d WHERE d.id = ? LIMIT 1`,
      [nomor]
    );
    const berkas = cleanText(rows[0] && rows[0].berkas);
    if (!berkas) return null;
    return {
      jalur: berkas,
      judul: cleanText(rows[0].judul) || berkas.split("/").pop(),
    };
  }

  // Berkas penetapan ikrar talak. Nama kolomnya dicari lebih dulu - berbeda
  // antar versi SIPP.
  // Berkas pindaian arsip perkara.
  // Surat gugatan atau permohonan - tersimpan pada tabel perkara sendiri.
  if (jenis === "petitum") {
    const kolom = await sippSkemaService.kolomTerpilih();
    if (!kolom.petitumDok) return null;
    const rows = await runQuery(
      `SELECT p.${kolom.petitumDok} AS berkas FROM perkara p WHERE p.perkara_id = ? LIMIT 1`,
      [nomor]
    ).catch(() => []);
    const berkas = cleanText(rows[0] && rows[0].berkas);
    if (!berkas) return null;
    return { jalur: berkas, judul: berkas.split("/").pop() };
  }

  // ==========================================================================
  // ARSIP - JALURNYA DISUSUN, SEBAB TABELNYA TIDAK MENYIMPANNYA
  // ==========================================================================
  //
  // Semula cabang ini membaca kolom arsipBerkas. Kolom itu TIDAK ADA pada
  // tabel arsip SIPP - tidak satu pun calonnya cocok - sehingga cabangnya
  // selalu memulangkan null dan tombol unduh arsip selalu berujung 404.
  //
  // Yang ada di tabel arsip hanya LETAK FISIKNYA, dan dari letak itulah SIPP
  // menyusun jalur berkasnya. Penyusunannya beserta penelusuran cadangan bila
  // letaknya sudah disunting ada di arsipBerkasService.
  //
  // Yang dikirim pemanggil tetap hanya nomor barisnya - jalurnya disusun di
  // sini dari isi basis data, tidak pernah dari peramban.
  if (jenis === "arsip") {
    const rows = await runQuery(
      `SELECT a.no_ruang AS ruang, a.no_lemari AS lemari, a.no_rak AS rak,
              a.no_berkas AS box, a.nomor_perkara AS nomorPerkara
         FROM arsip a WHERE a.id = ? LIMIT 1`,
      [nomor]
    ).catch(() => []);
    const baris = rows[0];
    if (!baris) return null;

    const berkas = arsipBerkasService.cariBerkas({
      ruang: cleanText(baris.ruang),
      lemari: cleanText(baris.lemari),
      rak: cleanText(baris.rak),
      box: cleanText(baris.box),
      nomorPerkara: cleanText(baris.nomorPerkara),
    });
    if (!berkas.ada) return null;
    return { jalur: berkas.jalur, judul: berkas.jalur.split("/").pop() };
  }

  if (jenis === "ikrar-talak") {
    const kolom = await sippSkemaService.kolomTerpilih();
    if (!kolom.ikrarDokumen) return null;
    // ========================================================================
    // KUNCINYA perkara_id, BUKAN id
    // ========================================================================
    //
    // perkara_ikrar_talak tidak punya kolom "id" sama sekali - diperiksa pada
    // sipp_donggala maupun sipp (PA Bungku), nol kolom bernama itu pada
    // keduanya. Kuerinya karena itu tidak pernah memulangkan satu baris pun,
    // dan .catch(() => []) di bawah membuat kegagalannya tidak berbunyi.
    const rows = await runQuery(
      `SELECT t.${kolom.ikrarDokumen} AS berkas FROM perkara_ikrar_talak t WHERE t.perkara_id = ? LIMIT 1`,
      [nomor]
    ).catch((galat) => {
      // Sebabnya dicatat, bukan ditelan. Kolom atau tabel yang tidak ada
      // menghasilkan gejala yang persis sama dengan berkas yang memang belum
      // diunggah, dan selama keduanya diam tidak ada cara membedakannya.
      console.warn(`[sipp] ikrar-talak tidak terbaca: ${galat && galat.message}`);
      return [];
    });
    const berkas = cleanText(rows[0] && rows[0].berkas);
    if (!berkas) return null;
    return { jalur: berkas, judul: berkas.split("/").pop() };
  }

  if (jenis === "bas") {
    const rows = await runQuery(
      `SELECT j.edoc_bas AS berkas FROM perkara_jadwal_sidang j WHERE j.id = ? LIMIT 1`,
      [nomor]
    );
    const berkas = cleanText(rows[0] && rows[0].berkas);
    if (!berkas) return null;
    return { jalur: berkas, judul: berkas.split("/").pop() };
  }

  if (jenis === "putusan" || jenis === "putusan-anonim") {
    // Dua kueri harfiah, bukan nama kolom disambung - lihat catatan pada
    // relaas di bawah.
    const rows = await runQuery(
      jenis === "putusan"
        ? `SELECT pu.amar_putusan_dok AS berkas FROM perkara_putusan pu
             WHERE pu.perkara_id = ? ORDER BY pu.tanggal_putusan DESC LIMIT 1`
        : `SELECT pu.amar_putusan_anonimisasi_dok AS berkas FROM perkara_putusan pu
             WHERE pu.perkara_id = ? ORDER BY pu.tanggal_putusan DESC LIMIT 1`,
      [nomor]
    );
    const berkas = cleanText(rows[0] && rows[0].berkas);
    if (!berkas) return null;
    return { jalur: berkas, judul: berkas.split("/").pop() };
  }

  if (jenis === "relaas" || jenis === "resi") {
    // Dua kueri harfiah, bukan satu kueri dengan nama kolom disambung.
    // Menyambung nama kolom ke dalam teks kueri - sekalipun dari daftar
    // tertutup - membiasakan pola yang berbahaya di tempat berikutnya.
    const rows = await runQuery(
      jenis === "relaas"
        ? `SELECT r.doc_relaas AS berkas FROM perkara_pelaksanaan_relaas r WHERE r.id = ? LIMIT 1`
        : `SELECT r.doc_resi AS berkas FROM perkara_pelaksanaan_relaas r WHERE r.id = ? LIMIT 1`,
      [nomor]
    );
    const berkas = cleanText(rows[0] && rows[0].berkas);
    if (!berkas) return null;
    return { jalur: berkas, judul: berkas.split("/").pop() };
  }

  return null;
}

/** Seluruh keterangan satu sidang. */
async function rincianSidang(nomorPerkaraMentah, sidangIdMentah) {
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara) return { ok: false, alasan: "nomor_perkara_kosong" };

  const barisPerkara = await runQuery(
    // alur/jenis_perkara_id (9 Okt 2026): sebutan pihak tab Juru Sita dari
    // NOMOR, bukan kata - Izin Poligami (341) bernomor /Pdt.G/ tetapi Pemohon.
    // jumlahPihakPertama (14 Okt 2026): jumlah Pemohon itsbat voluntair - tab
    // Juru Sita memilih pengumuman 1 Pemohon / 2 Pemohon dan mematikan panggilan
    // Pemohon II bila hanya ada satu Pemohon.
    `SELECT p.perkara_id AS perkaraId, p.alur_perkara_id AS alurPerkaraId, p.jenis_perkara_id AS jenisPerkaraId,
            (SELECT COUNT(*) FROM perkara_pihak1 pp WHERE pp.perkara_id = p.perkara_id) AS jumlahPihakPertama,
            p.jenis_perkara_nama AS jenisPerkara
       FROM perkara p WHERE p.nomor_perkara = ? ORDER BY p.perkara_id DESC LIMIT 1`,
    [nomorPerkara]
  );

  const perkara = barisPerkara[0];
  if (!perkara) return { ok: false, alasan: "perkara_tidak_ditemukan" };

  const sidangId = Number(sidangIdMentah) || 0;

  // Tiap bagian dibungkus sendiri: satu bagian yang gagal - misalnya tabel
  // yang tidak ada pada versi SIPP tertentu - tidak boleh menghilangkan
  // bagian lain yang sebenarnya sudah terbaca.
  const aman = async (kerja, cadangan) => {
    try {
      return await kerja();
    } catch {
      return cadangan;
    }
  };

  const [majelis, petugas, saksi, relaas, dokumen, jadwal, lewatEcourt, putusan, petitum, konseptor] =
    await Promise.all([
    aman(() => majelisPerkara(perkara.perkaraId), []),
    aman(() => petugasPerkara(perkara.perkaraId), { panitera: [], jurusita: [] }),
    aman(() => saksiPerkara(perkara.perkaraId), { ada: false, jumlahSaksi: 0, jumlahKeterangan: 0 }),
    // ====================================================================
    // SELURUH RELAAS PERKARA, BUKAN HANYA SIDANG INI
    // ====================================================================
    //
    // Sebelumnya disaring pada sidang yang sedang dibuka. Akibatnya riwayat
    // panggilan sebelumnya tidak pernah terlihat - padahal itulah yang
    // ditanya majelis saat menilai patut tidaknya panggilan: sudah berapa
    // kali dipanggil, dengan cara apa, dan apa hasilnya tiap kali.
    //
    // Tiap baris sudah membawa sidangId dan tanggalSidang-nya sendiri,
    // sehingga yang memisahkan "panggilan sidang ini" dari "riwayat
    // sebelumnya" adalah layarnya - dan pemisahan itu tidak dapat
    // dikembalikan lagi kalau datanya sudah disaring di sini.
    aman(() => relaasSidang(perkara.perkaraId, 0), []),
    aman(() => dokumenSipp(perkara.perkaraId), []),
    aman(() => jadwalPerkara(nomorPerkara), []),
    // Gagal-TERTUTUP: bila tidak dapat dipastikan, perkaranya dianggap BUKAN
    // e-Court sehingga yang berlaku Pasal 122 HIR - aturan yang lebih lama
    // dan berlaku umum. Menganggapnya e-Court saat ragu berarti membolehkan
    // penilaian dengan jalur elektronik yang mungkin tidak pernah dibuka.
    aman(() => perkaraLewatEcourt(perkara.perkaraId), false),
    aman(() => putusanPerkara(perkara.perkaraId), null),
    // Surat gugatan atau permohonan - dibaca dari kolom petitum pada tabel
    // perkara, bukan dari daftar lampiran.
    aman(() => sippTahapanService.petitumPerkara(perkara.perkaraId), { ada: false }),
    // Konseptor putusan - siapa yang menyusun naskahnya. Sudah lama terbaca
    // lewat sippTahapanService, hanya belum pernah sampai ke layar jadwal.
    aman(() => sippTahapanService.konseptorPutusanPerkara(perkara.perkaraId), {
      terbaca: false,
      alasan: "",
      baris: [],
    }),
  ]);

  // ==========================================================================
  // JURUSITA RELAAS: JATUH KE PENUGASAN PERKARA BILA RELAASNYA TIDAK MENYEBUT
  // ==========================================================================
  //
  // Ketiga sumber nama jurusita pada relaasSidang bersandar pada jurusita_id
  // di baris relaas itu sendiri. Pada panggilan elektronik - dan pada relaas
  // yang dicatat menyusul - kolom itu kosong, sehingga kolom jurusita di tabel
  // rincian bergaris padahal nama jurusitanya jelas terbaca di tabel utama:
  // dari penugasan pada perkaranya.
  //
  // Nama itu dipakai sebagai cadangan, TETAPI ditandai asalnya. Jurusita yang
  // ditugaskan pada perkara belum tentu jurusita yang melaksanakan relaas ini,
  // dan menyamarkan perbedaannya berarti menaruh nama orang pada pekerjaan
  // yang mungkin bukan miliknya.
  /* === 12OKT-A: kumulasi perkara === */
  // undefined = gagal dibaca; null = tidak berkumulasi.
  const kumulasi = await kumulasiPerkaraService
    .kumulasiBanyakPerkara([perkara.perkaraId])
    .then((peta) => peta[String(perkara.perkaraId)] || null)
    .catch(() => undefined);
  /* === AKHIR 12OKT-A === */
  /* === 12OKT-K: sita, eksekusi, eksepsi/rekonvensi untuk rincian & Status Perkara === */
  // undefined = gagal dibaca. Eksepsi/rekonvensi dari SUMBER YANG SAMA dengan
  // kolom Agenda (penandaJawabanService.petaBanyakPerkara) - bukan aturan kedua.
  const [sitaEksekusiIni, penandaJawabanIni] = await Promise.all([
    sitaEksekusiPerkaraService
      .sitaEksekusiBanyakPerkara([perkara.perkaraId])
      .then((peta) => ({
        sita: peta.sita[String(perkara.perkaraId)] || null,
        eksekusi: peta.eksekusi[String(perkara.perkaraId)] || [],
      }))
      .catch(() => undefined),
    penandaJawabanService
      .petaBanyakPerkara([nomorPerkara])
      .then((peta) => peta[nomorPerkara] || null)
      .catch(() => undefined),
  ]);
  /* === AKHIR 12OKT-K === */

  const jurusitaPerkara = (petugas.jurusita || []).map((x) => x.nama).filter(Boolean);
  const relaasLengkap = (Array.isArray(relaas) ? relaas : []).map((baris) =>
    baris.jurusitaNama || jurusitaPerkara.length === 0
      ? baris
      : {
          ...baris,
          jurusitaNama: jurusitaPerkara.join(", "),
          jurusitaDariPenugasan: true,
        }
  );

  return {
    ok: true,
    alasan: "",
    nomorPerkara,
    // Dibawa keluar supaya penilai kesiapan dapat menanyakan keadaan
    // panggilan sidang ini tanpa mencari ulang perkaranya dari nomornya.
    perkaraId: perkara.perkaraId,
    jenisPerkara: cleanText(perkara.jenisPerkara),
    // Tambahan ruas (9 Okt 2026) - penentu sebutan Pemohon/Penggugat di
    // jurusita.js (jurusitaSebutan). null bila kolomnya kosong.
    alurPerkaraId: Number(perkara.alurPerkaraId) || null,
    jenisPerkaraId: Number(perkara.jenisPerkaraId) || null,
    // Baris perkara_pihak1 (Penggugat/Pemohon); null bila tak terbaca.
    jumlahPihakPertama: Number(perkara.jumlahPihakPertama) || null,
    majelis,
    panitera: petugas.panitera,
    jurusita: petugas.jurusita,
    saksi,
    relaas: relaasLengkap,
    dokumenSipp: dokumen,
    // Gugatan atau permohonan - berkas yang paling sering dicari, dan
    // tempatnya bukan di perkara_dokumen melainkan pada kolom perkara.
    petitum,
    jadwalPerkara: jadwal,
    lewatEcourt,
    putusan,
    // Siapa yang menyusun naskah putusan. Dipisah dari putusan itu sendiri:
    // konseptornya terbaca dari jejak tahapan, bukan dari tabel putusan, dan
    // dapat kosong pada perkara yang tahapannya tidak pernah dicatat.
    konseptor,
    /* === 12OKT-A: kumulasi perkara === */
    // Sama dengan ruas kumulasi baris jadwal; dipakai Status Perkara.
    kumulasi,
    kumulasiTerbaca: kumulasi !== undefined,
    /* === AKHIR 12OKT-A === */
    /* === 12OKT-K: sita, eksekusi, eksepsi/rekonvensi === */
    // Bentuknya sama dengan ruas baris jadwal; dipakai Status Perkara.
    sita: sitaEksekusiIni ? sitaEksekusiIni.sita : null,
    eksekusi: sitaEksekusiIni ? sitaEksekusiIni.eksekusi : [],
    sitaTerbaca: sitaEksekusiIni !== undefined,
    penandaJawaban: penandaJawabanIni || null,
    penandaJawabanTerbaca: penandaJawabanIni !== undefined,
    /* === AKHIR 12OKT-K === */
  };
}

module.exports = {
  durasiBanyakPerkara,
  ikrarBanyakPerkara,
  pembebananBanyakPerkara,
  mediasiBanyakPerkara,
  bahanVarianPutusan,
  hadirLengkapPertamaBanyakPerkara,
  courtCalendarBanyakPerkara,
  sidangLaporanMediasiBanyakPerkara,
  POLA_AGENDA_LAPORAN_MEDIASI,
  barisSidangIkrar,
  AMBANG_DURASI_HARI,
  BATAS_POTONG_MEDIASI_HARI,
  hariMediasiBersih,
  daftarSidang,
  daftarJadwalMediasi,
  BATAS_MEDIASI_HARI,
  geserHari,
  sidangBerikutnya,
  jadwalPerkara,
  perkaraFinal,
  perkaraLewatEcourt,
  keadaanPanggilanSidang,
  kehadiranSebelumnya,
  petugasBanyakPerkara,
  pihakBanyakPerkara,
  putusanBanyakPerkara,
  putusanPerkara,
  rekapBulanSidang,
  dokumenSipp,
  jalurDokumenSipp,
  JENIS_BERKAS_SIPP,
  majelisPerkara,
  petugasPerkara,
  relaasSidang,
  rincianSidang,
  saksiPerkara,
  saksiBanyakPerkara,
  ecourtBanyakPerkara,
  // Dipinjam rekapPetugasService: arti sandi cara relaas dan selisih hari
  // kalender dipakai APA ADANYA, tidak disalin - sandi yang pernah salah
  // diartikan cukup dibetulkan di satu tempat.
  caraRelaas,
  selisihHariKalender,
};
