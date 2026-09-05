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
const putusanEcourtService = require("./putusanEcourtService");

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
        OR EXISTS (SELECT 1 FROM v_pihak_perkara vp
                    WHERE vp.perkara_id = p.perkara_id AND vp.nama LIKE ?))`
    );
    nilai.push(`%${kataCari}%`, `%${kataCari}%`, `%${kataCari}%`, `%${kataCari}%`);
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
  const aman = async (kerja) => {
    try {
      return await kerja();
    } catch {
      return {};
    }
  };

  const [petaPihak, petaPetugas, petaPutusan, petaPanggilan, petaBerikut] = await Promise.all([
    aman(() => pihakBanyakPerkara(idPerkara)),
    aman(() => petugasBanyakPerkara(idPerkara)),
    aman(() => putusanBanyakPerkara(idPerkara)),
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
  ]);

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
      majelisKode: (petaPetugas[String(row.perkaraId)] || {}).majelisKode || "",
      majelisNama: (petaPetugas[String(row.perkaraId)] || {}).majelisNama || "",
      paniteraNama: (petaPetugas[String(row.perkaraId)] || {}).paniteraNama || "",
      jurusitaNama: (petaPetugas[String(row.perkaraId)] || {}).jurusitaNama || "",
      sudahPutus: Boolean((petaPutusan[String(row.perkaraId)] || {}).tanggalPutusan),
      tanggalPutusan: (petaPutusan[String(row.perkaraId)] || {}).tanggalPutusan || "",
      statusPutusan: (petaPutusan[String(row.perkaraId)] || {}).statusPutusan || "",
      tanggalMinutasi: (petaPutusan[String(row.perkaraId)] || {}).tanggalMinutasi || "",
      tanggalBht: (petaPutusan[String(row.perkaraId)] || {}).tanggalBht || "",
      // Terisi hanya pada perkara yang sudah putus. null berarti belum putus,
      // atau keadaan e-Courtnya memang tidak dapat dibaca - dua hal yang
      // sama-sama BUKAN masalah putusan.
      putusanEcourt: petaPutusanEcourt[cleanText(row.nomorPerkara)] || null,
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
          `SELECT pu.tanggal_putusan AS tanggalPutusan,
                  pu.status_putusan_nama AS statusPutusan,
                  pu.putusan_verstek AS verstek,
                  pu.tanggal_cabut AS tanggalCabut,
                  pu.tanggal_gugur AS tanggalGugur,
                  pu.tanggal_minutasi AS tanggalMinutasi,
                  pu.tanggal_bht AS tanggalBht,
                  pu.amar_putusan AS amarPutusan,
                  pu.amar_putusan_dok AS amarDok,
                  pu.amar_putusan_anonimisasi_dok AS amarAnonimDok
             FROM perkara_putusan pu
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

  const [majelis, panitera, jurusita] = await Promise.all([
    runQuery(
      `SELECT hk.perkara_id AS perkaraId,
              GROUP_CONCAT(hk.hakim_kode ORDER BY hk.urutan ASC SEPARATOR '-') AS kode,
              GROUP_CONCAT(hk.hakim_nama ORDER BY hk.urutan ASC SEPARATOR ', ') AS nama
         FROM perkara_hakim_pn hk
        WHERE hk.perkara_id IN (${isian}) AND hk.aktif = 'Y'
        GROUP BY hk.perkara_id`,
      dipakai
    ),
    runQuery(
      `SELECT pn.perkara_id AS perkaraId,
              GROUP_CONCAT(pn.panitera_nama ORDER BY pn.urutan ASC SEPARATOR ', ') AS nama
         FROM perkara_panitera_pn pn
        WHERE pn.perkara_id IN (${isian}) AND pn.aktif = 'Y'
        GROUP BY pn.perkara_id`,
      dipakai
    ),
    runQuery(
      `SELECT js.perkara_id AS perkaraId,
              GROUP_CONCAT(js.jurusita_nama ORDER BY js.urutan ASC SEPARATOR ', ') AS nama
         FROM perkara_jurusita js
        WHERE js.perkara_id IN (${isian}) AND js.aktif = 'Y'
        GROUP BY js.perkara_id`,
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

  for (const baris of Array.isArray(majelis) ? majelis : []) {
    const isi = ambil(String(baris.perkaraId));
    isi.majelisKode = cleanText(baris.kode);
    isi.majelisNama = cleanText(baris.nama);
  }
  for (const baris of Array.isArray(panitera) ? panitera : []) {
    ambil(String(baris.perkaraId)).paniteraNama = cleanText(baris.nama);
  }
  for (const baris of Array.isArray(jurusita) ? jurusita : []) {
    ambil(String(baris.perkaraId)).jurusitaNama = cleanText(baris.nama);
  }

  return hasil;
}

/** Keadaan putusan untuk sekumpulan perkara sekaligus. */
async function putusanBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};

  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  // MAX dipakai untuk mengambil putusan terakhir bila satu perkara punya lebih
  // dari satu baris putusan - tanggalnya bagian dari kunci utama tabel itu.
  const rows = await runQuery(
    `SELECT pu.perkara_id AS perkaraId,
            MAX(pu.tanggal_putusan) AS tanggalPutusan,
            MAX(pu.tanggal_minutasi) AS tanggalMinutasi,
            MAX(pu.tanggal_bht) AS tanggalBht,
            SUBSTRING_INDEX(GROUP_CONCAT(pu.status_putusan_nama ORDER BY pu.tanggal_putusan DESC), ',', 1) AS statusPutusan
       FROM perkara_putusan pu
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
  const petaPihak = await pihakBanyakPerkara(idPerkara).catch(() => ({}));

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
      `SELECT r.sidang_id AS sidangId,
              r.status_pos AS statusPos,
              r.tanggal_relaas AS tanggalRelaas,
              r.no_resi_pos AS noResiPos,
              vp.pihak_ke AS pihakKe
         FROM perkara_pelaksanaan_relaas r
         LEFT JOIN v_pihak_perkara vp
                ON vp.pihak_id = r.pihak_id AND vp.perkara_id = r.perkara_id
        WHERE r.sidang_id IN (${isianSidang})`,
      idSidang
    ),
    // Sisi pihak yang BENAR-BENAR ada pada tiap perkara. Permohonan kerap
    // hanya punya pemohon - menuntut adanya panggilan untuk termohon yang
    // memang tidak ada membuat hampir seluruh Pdt.P tertandai belum dipanggil.
    runQuery(
      `SELECT vp.perkara_id AS perkaraId, vp.pihak_ke AS pihakKe
         FROM v_pihak_perkara vp
        WHERE vp.perkara_id IN (${isianPerkara})
        GROUP BY vp.perkara_id, vp.pihak_ke`,
      idPerkara
    ),
  ]);

  // --- Kehadiran pada sidang SEBELUMNYA, per sidang -------------------------
  const sebelumnya = {};
  let perkaraTerakhir = null;
  let hadirTerakhir = null;
  for (const baris of Array.isArray(semuaSidang) ? semuaSidang : []) {
    const perkara = String(baris.perkaraId);
    if (perkara !== perkaraTerakhir) {
      perkaraTerakhir = perkara;
      hadirTerakhir = null;
    }
    sebelumnya[String(baris.sidangId)] = hadirTerakhir;
    hadirTerakhir =
      baris.dihadiriOleh === null || baris.dihadiriOleh === undefined
        ? null
        : Number(baris.dihadiriOleh);
  }

  // --- Relaas per sidang, dikelompokkan menurut sisi pihak ------------------
  const relaasPerSidang = {};
  for (const baris of Array.isArray(semuaRelaas) ? semuaRelaas : []) {
    const kunci = String(baris.sidangId);
    if (!relaasPerSidang[kunci]) relaasPerSidang[kunci] = [];
    relaasPerSidang[kunci].push({
      pihakKe: baris.pihakKe === null || baris.pihakKe === undefined ? null : Number(baris.pihakKe),
      statusPos: baris.statusPos === null || baris.statusPos === undefined ? null : Number(baris.statusPos),
      adaRelaas: Boolean(baris.tanggalRelaas) || Boolean(cleanText(baris.noResiPos)),
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

  const hasil = {};
  for (const item of sidang) {
    const kunci = String(item.sidangId);
    const hadirSebelumnya = sebelumnya[kunci];
    const relaas = relaasPerSidang[kunci] || [];

    // Sisi yang wajib dipanggil menurut kehadiran sidang sebelumnya - lihat
    // catatan di kepala fungsi.
    let wajibMenurutHadir = [];
    if (hadirSebelumnya === 1) wajibMenurutHadir = [];
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

    hasil[kunci] = {
      hadirSebelumnya,
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
 */
async function pihakBanyakPerkara(daftarPerkaraId = []) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};

  // Nomor perkara masuk sebagai parameter satu per satu, bukan disambung ke
  // teks kueri. Daftar dibatasi supaya tidak menyusun kueri raksasa.
  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  const rows = await runQuery(
    `SELECT vp.perkara_id AS perkaraId, vp.nama AS nama, vp.pihak_ke AS pihakKe
       FROM v_pihak_perkara vp
      WHERE vp.perkara_id IN (${isian})
      ORDER BY vp.perkara_id ASC, vp.pihak_ke ASC`,
    dipakai
  );

  const hasil = {};
  for (const baris of Array.isArray(rows) ? rows : []) {
    const kunci = String(baris.perkaraId);
    if (!hasil[kunci]) hasil[kunci] = { penggugat: [], tergugat: [] };
    const nama = cleanText(baris.nama);
    if (!nama) continue;
    if (Number(baris.pihakKe) === 2) hasil[kunci].tergugat.push(nama);
    else hasil[kunci].penggugat.push(nama);
  }
  return hasil;
}

/** Majelis hakim yang bertugas, berurut sesuai kedudukannya. */
async function majelisPerkara(perkaraId) {
  const rows = await runQuery(
    `SELECT hk.hakim_kode AS kode,
            hk.hakim_nama AS nama,
            hk.jabatan_hakim_nama AS jabatan,
            hk.urutan AS urutan
       FROM perkara_hakim_pn hk
      WHERE hk.perkara_id = ? AND hk.aktif = 'Y'
      ORDER BY hk.urutan ASC`,
    [perkaraId]
  );
  return rows.map((row) => ({
    kode: cleanText(row.kode),
    nama: cleanText(row.nama),
    jabatan: cleanText(row.jabatan),
  }));
}

/** Panitera sidang dan jurusita yang bertugas. */
async function petugasPerkara(perkaraId) {
  const [panitera, jurusita] = await Promise.all([
    runQuery(
      `SELECT pn.panitera_kode AS kode, pn.panitera_nama AS nama
         FROM perkara_panitera_pn pn
        WHERE pn.perkara_id = ? AND pn.aktif = 'Y'
        ORDER BY pn.urutan ASC`,
      [perkaraId]
    ),
    runQuery(
      `SELECT js.jurusita_kode AS kode, js.jurusita_nama AS nama
         FROM perkara_jurusita js
        WHERE js.perkara_id = ? AND js.aktif = 'Y'
        ORDER BY js.urutan ASC`,
      [perkaraId]
    ),
  ]);

  const rapikan = (rows) =>
    rows.map((row) => ({ kode: cleanText(row.kode), nama: cleanText(row.nama) })).filter((x) => x.nama);

  return { panitera: rapikan(panitera), jurusita: rapikan(jurusita) };
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
       LEFT JOIN v_pihak_perkara vp
              ON vp.pihak_id = r.pihak_id AND vp.perkara_id = r.perkara_id
      WHERE r.perkara_id = ?${nomorSidang ? " AND r.sidang_id = ?" : ""}
      ORDER BY sd.tanggal_sidang ASC, r.tanggal_relaas ASC, r.id ASC
      LIMIT 200`,
    nomorSidang ? [perkaraId, nomorSidang] : [perkaraId]
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
    bertemu: cleanText(row.ketTemu).toUpperCase() === "Y",
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
    adaDokumen: Boolean(cleanText(row.docRelaas)),
    adaResi: Boolean(cleanText(row.docResi)),
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
  const rows = await runQuery(
    `SELECT COUNT(DISTINCT s.saksi_id) AS jumlahSaksi,
            COUNT(*) AS jumlahKeterangan,
            MAX(s.sidang_id) AS sidangTerakhir
       FROM perkara_keterangan_saksi s
      WHERE s.perkara_id = ?`,
    [perkaraId]
  );

  const baris = rows[0] || {};
  const jumlahSaksi = Number(baris.jumlahSaksi) || 0;
  return {
    ada: jumlahSaksi > 0,
    jumlahSaksi,
    jumlahKeterangan: Number(baris.jumlahKeterangan) || 0,
  };
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

  if (jenis === "arsip") {
    const kolom = await sippSkemaService.kolomTerpilih();
    if (!kolom.arsipBerkas) return null;
    const rows = await runQuery(
      `SELECT a.${kolom.arsipBerkas} AS berkas FROM arsip a WHERE a.id = ? LIMIT 1`,
      [nomor]
    ).catch(() => []);
    const berkas = cleanText(rows[0] && rows[0].berkas);
    if (!berkas) return null;
    return { jalur: berkas, judul: berkas.split("/").pop() };
  }

  if (jenis === "ikrar-talak") {
    const kolom = await sippSkemaService.kolomTerpilih();
    if (!kolom.ikrarDokumen) return null;
    const rows = await runQuery(
      `SELECT t.${kolom.ikrarDokumen} AS berkas FROM perkara_ikrar_talak t WHERE t.id = ? LIMIT 1`,
      [nomor]
    ).catch(() => []);
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
    `SELECT p.perkara_id AS perkaraId, p.jenis_perkara_nama AS jenisPerkara
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

  const [majelis, petugas, saksi, relaas, dokumen, jadwal, lewatEcourt, putusan, petitum] =
    await Promise.all([
    aman(() => majelisPerkara(perkara.perkaraId), []),
    aman(() => petugasPerkara(perkara.perkaraId), { panitera: [], jurusita: [] }),
    aman(() => saksiPerkara(perkara.perkaraId), { ada: false, jumlahSaksi: 0, jumlahKeterangan: 0 }),
    // Dipanggil SELALU. Tanpa nomor sidang ia membaca seluruh relaas perkara -
    // itulah yang diperlukan layar status perkara, dan sebelumnya di sini
    // dijawab daftar kosong.
    aman(() => relaasSidang(perkara.perkaraId, sidangId), []),
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
  };
}

module.exports = {
  daftarSidang,
  daftarJadwalMediasi,
  BATAS_MEDIASI_HARI,
  geserHari,
  sidangBerikutnya,
  jadwalPerkara,
  perkaraFinal,
  perkaraLewatEcourt,
  keadaanPanggilanSidang,
  petugasBanyakPerkara,
  pihakBanyakPerkara,
  putusanBanyakPerkara,
  putusanPerkara,
  rekapBulanSidang,
  dokumenSipp,
  jalurDokumenSipp,
  majelisPerkara,
  petugasPerkara,
  relaasSidang,
  rincianSidang,
  saksiPerkara,
};
