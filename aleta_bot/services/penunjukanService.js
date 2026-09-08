"use strict";

/**
 * Usulan penunjukan PMH, PPP, PJS, dan PHS.
 *
 * ============================================================================
 * MENGUSULKAN, BUKAN MENETAPKAN
 * ============================================================================
 *
 * Seluruh kueri di berkas ini SELECT. Yang dihasilkan usulan - siapa majelisnya,
 * siapa panitera penggantinya, juru sita siapa gilirannya, dan sidang
 * pertamanya kapan - untuk ditampilkan di papan penunjukan, diperiksa orang,
 * lalu diisikan ke borang SIPP oleh ekstensi bila disetujui.
 *
 * Tidak ada satu pun tulisan ke SIPP dari sini, dan tidak akan pernah ada.
 * Penetapan tetap perbuatan pejabat yang menandatanganinya.
 *
 * ============================================================================
 * KEEMPATNYA SATU TANGGAL
 * ============================================================================
 *
 * PMH, PPP, PJS, dan PHS ditetapkan pada hari yang sama. Itu bukan dugaan:
 * Riwayat Perkara menunjukkan keempatnya dikerjakan berturut-turut dalam tiga
 * puluh tiga menit - PMH 09:21, PPP 09:41:38, PJS 09:41:44, PHS 09:54.
 *
 * Karena itu PHS tidak menunggu siapa pun. Begitu majelisnya diketahui,
 * ketua majelisnya pasti, harinya sudah ditentukan SK, dan tanggal sidang
 * pertamanya dapat dihitung.
 *
 * Yang TIDAK dapat dilangkahi urutannya. SIPP menolak penetapan panitera
 * pengganti dan juru sita selama majelisnya belum ditetapkan, sehingga
 * pengisiannya harus berurutan: PMH, PPP, PJS, lalu PHS.
 *
 * ============================================================================
 * ATURANNYA DATANG DARI PEMANGGIL
 * ============================================================================
 *
 * Berkas ini tidak menyimpan setelan apa pun. Hari sidang tiap majelis, kode
 * panitera penggantinya, jeda minimal, dan ambang nilai sengketa seluruhnya
 * diterima sebagai argumen dari portal - yang menyimpannya di basis datanya
 * sendiri dan menyediakan menu penyuntingnya.
 *
 * Kalau berkas ini ikut menyimpan salinan, ada dua tempat yang harus disunting
 * tiap SK berganti, dan yang kedua pasti terlupa.
 */

const db = require("../db_config");
const { cleanText } = require("./ecourtTextService");
const sippSkemaService = require("./sippSkemaService");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/**
 * Tahapan penunjukan tingkat pertama.
 *
 * Ketiga tabel petugas memakai kolom tahapan_id yang sama. Tahapan 10 penunjukan
 * tingkat pertama; 18, 20, 30, dan 40 dipakai upaya hukum. Menghitung giliran
 * tanpa menyaringnya akan menghitung penunjukan banding sebagai giliran baru -
 * dan juru sita yang kebetulan banyak menangani banding akan tampak sudah
 * kebagian padahal belum.
 */
const TAHAPAN_TINGKAT_PERTAMA = 10;

/**
 * Berapa perkara tertinggal sebelum juru sita patut ditanya berhalangan.
 *
 * Dalam giliran yang berjalan wajar, jarak antara dua penunjukan bagi orang
 * yang sama kira-kira sebanyak juru sita yang aktif. Cuti tampak sebagai jarak
 * yang jauh lebih lebar - empat sampai sepuluh perkara atau lebih.
 *
 * Ambangnya dua kali jumlah juru sita aktif: cukup lebar untuk tidak menuduh
 * orang yang hanya kebetulan lewat satu putaran, cukup sempit untuk tertangkap
 * sebelum gilirannya menumpuk.
 *
 * Ini PENANDA, bukan keputusan. ALETA tidak tahu siapa sedang cuti, dan tidak
 * berpura-pura tahu - yang ditampilkan hanya "sudah sekian perkara tidak
 * menerima panggilan", supaya yang membaca dapat memutuskan sendiri.
 */
const KELIPATAN_DUGAAN_BERHALANGAN = 2;

/** Nama hari, untuk menyebut tanggal usulan tanpa menuntut yang membaca menghitung. */
const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function isoTanggal(nilai) {
  if (!nilai) return "";
  const tanggal = nilai instanceof Date ? nilai : new Date(String(nilai));
  if (Number.isNaN(tanggal.getTime())) return "";
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  const hari = String(tanggal.getDate()).padStart(2, "0");
  return `${tanggal.getFullYear()}-${bulan}-${hari}`;
}

/** Menambah sekian hari pada tanggal ISO, tetap sebagai tanggal ISO. */
function geserHari(iso, jumlah) {
  const tanggal = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(tanggal.getTime())) return "";
  tanggal.setDate(tanggal.getDate() + jumlah);
  return isoTanggal(tanggal);
}

/** Selisih hari antara dua tanggal ISO, tidak pernah kurang dari nol. */
function jarakHari(dariIso, sampaiIso) {
  const dari = new Date(`${dariIso}T00:00:00`);
  const sampai = new Date(`${sampaiIso}T00:00:00`);
  if (Number.isNaN(dari.getTime()) || Number.isNaN(sampai.getTime())) return 0;
  return Math.max(0, Math.round((sampai - dari) / 86400000));
}

/**
 * BAGIAN YANG SEMESTINYA - keadilan bagi pegawai yang baru dilantik.
 *
 * ============================================================================
 * MASALAH YANG DIPECAHKAN
 * ============================================================================
 *
 * Giliran memilih yang paling SEDIKIT perkaranya tahun ini. Bagi pegawai yang
 * baru dilantik, angka itu mulai dari nol - sehingga ia terpilih terus-menerus
 * sampai menyusul rekannya. Pada data yang berjalan, seorang panitera
 * pengganti yang dilantik akhir Agustus memegang 9 perkara sementara rekannya
 * 46 sampai 111. Menyuruhnya menyusul berarti puluhan penunjukan beruntun
 * dalam hitungan hari - dan itu bukan giliran, itu hukuman karena datang
 * terlambat.
 *
 * Yang dibandingkan karena itu bukan JUMLAH, melainkan SELISIH dari bagian
 * yang semestinya ia terima selama ia benar-benar bertugas.
 *
 * ============================================================================
 * CARA MENGHITUNGNYA
 * ============================================================================
 *
 * Untuk tiap orang p:
 *
 *   masaKerja  = sejak ia mulai bertugas (paling awal awal tahun) sampai hari ini
 *   total      = SELURUH penetapan yang terjadi dalam masa itu, milik siapa pun
 *   kepala     = berapa orang yang juga bertugas dalam masa itu, dihitung
 *                menurut lamanya masing-masing ikut serta - bukan sekadar
 *                dicacah. Yang baru masuk tiga hari tidak dihitung sebagai satu
 *                orang penuh untuk masa sembilan bulan.
 *   semestinya = total / kepala
 *   selisih    = jumlah yang benar-benar diterima - semestinya
 *
 * Yang paling KURANG dari bagiannya didahulukan. Pegawai baru dengan sembilan
 * perkara dalam tiga hari akan tampak LEBIH dari bagiannya - dan memang
 * demikian adanya - sehingga ia beristirahat sampai rekannya menyusul.
 *
 * Satuannya tetap "perkara", bukan angka tanpa nama, supaya dapat diperiksa:
 * "kurang 39 perkara dari bagiannya" dapat dibantah; skor 0,73 tidak.
 */
function bagianSemestinya({ orang, tanggalPenetapan, sekarang, awalTahun }) {
  const hasil = new Map();
  if (!Array.isArray(orang) || orang.length === 0) return hasil;

  const kini = isoTanggal(sekarang) || isoTanggal(new Date());
  const awal = isoTanggal(awalTahun) || `${kini.slice(0, 4)}-01-01`;

  // Mulai bertugas TIDAK PERNAH lebih awal dari awal tahun - hitungan ini
  // memang tentang beban tahun berjalan, dan pegawai lama tidak perlu dihitung
  // sejak ia diangkat bertahun-tahun lalu.
  const mulaiEfektif = new Map();
  for (const o of orang) {
    const mulai = isoTanggal(o.mulai);
    mulaiEfektif.set(o.id, !mulai || mulai < awal ? awal : mulai > kini ? kini : mulai);
  }

  const tanggal = (Array.isArray(tanggalPenetapan) ? tanggalPenetapan : [])
    .map((x) => isoTanggal(x))
    .filter((x) => x !== "");

  for (const o of orang) {
    const mulai = mulaiEfektif.get(o.id) || awal;
    const panjang = Math.max(1, jarakHari(mulai, kini));

    const total = tanggal.filter((x) => x >= mulai && x <= kini).length;

    // ======================================================================
    // KEPALA EFEKTIF, DIBOBOT MENURUT RASIONYA
    // ======================================================================
    //
    // Tiap orang ikut sebanyak bagian masa yang benar-benar ia jalani di dalam
    // masa orang ini. Seluruh masa berakhir hari ini, jadi tumpangannya cukup
    // dihitung dari yang paling belakangan mulai.
    //
    // Rasio dikalikan ke tiap kepala. Orang berasio 50 menghitung sebagai
    // SETENGAH kepala, sehingga bagian semestinya-nya jatuh menjadi separuh
    // orang berasio 100 - dan yang lain otomatis naik, sebab penyebutnya
    // mengecil. Tidak ada angka yang perlu disetel dua kali.
    //
    // Rasionya bukan karangan: untuk hakim ia dibaca dari ref_majelis_tetap
    // milik SIPP sendiri - kolom yang dipakai Smart Majelis - dan untuk
    // panitera pengganti dari aturan pengadilan. Yang tidak punya rasio
    // dianggap 100, yaitu bagian penuh.
    let kepala = 0;
    for (const q of orang) {
      const mulaiQ = mulaiEfektif.get(q.id) || awal;
      const bersama = jarakHari(mulaiQ > mulai ? mulaiQ : mulai, kini);
      const rasioQ = Number.isFinite(Number(q.rasio)) && Number(q.rasio) > 0 ? Number(q.rasio) : 100;
      kepala += (Math.max(0, bersama) / panjang) * (rasioQ / 100);
    }
    if (kepala <= 0) kepala = 1;

    const rasioIni = Number.isFinite(Number(o.rasio)) && Number(o.rasio) > 0 ? Number(o.rasio) : 100;
    const semestinya = (total / kepala) * (rasioIni / 100);
    hasil.set(o.id, {
      mulaiEfektif: mulai,
      hariBertugas: panjang,
      semestinya,
      selisih: Number(o.jumlah || 0) - semestinya,
      // Pegawai baru ditandai supaya panel dapat menyebutkannya, bukan supaya
      // diperlakukan berbeda - perhitungannya sudah adil dengan sendirinya.
      baruBertugas: mulai > awal,
    });
  }

  return hasil;
}

function hariDari(iso) {
  const tanggal = new Date(`${iso}T00:00:00`);
  return Number.isNaN(tanggal.getTime()) ? -1 : tanggal.getDay();
}

/**
 * Tanggal sidang pertama: hari majelisnya, sesudah jeda minimal terpenuhi.
 *
 * Jeda dihitung dari tanggal pendaftaran, bukan dari tanggal penetapan. Kalau
 * penetapannya terlambat beberapa hari, jeda sepuluh harinya sudah termakan
 * keterlambatan itu - menghitung dari penetapan akan memundurkan sidang tanpa
 * alasan, dan yang menanggung mundurnya para pihak.
 */
function tanggalSidangPertama(tanggalDaftar, hariMajelis, jedaMinimal) {
  if (!tanggalDaftar || hariMajelis < 0 || hariMajelis > 6) return "";

  const paling = geserHari(tanggalDaftar, Math.max(0, jedaMinimal));
  if (!paling) return "";

  const hariPaling = hariDari(paling);
  if (hariPaling < 0) return "";

  // Hari yang sama dengan batas terawal sudah memenuhi jeda, jadi dipakai apa
  // adanya - bukan digeser satu pekan penuh.
  const maju = (hariMajelis - hariPaling + 7) % 7;
  return geserHari(paling, maju);
}

function sebutTanggal(iso) {
  const hari = hariDari(iso);
  return hari < 0 ? iso : `${NAMA_HARI[hari]}, ${iso}`;
}

/** Memecah kolom varchar berisi id yang dipisah koma. */
function pecahId(nilai) {
  return String(nilai || "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && /^\d+$/.test(x))
    .map((x) => Number(x));
}

// ===========================================================================
// IDENTITAS PERKARA
// ===========================================================================

/**
 * Perkara yang hendak ditetapkan.
 *
 * nilai_sengketa dibaca sebagai TIGA keadaan, bukan dua: terisi, nol, dan
 * belum diisi. Perkara yang nilainya tidak pernah diisi akan terbaca nol lalu
 * disimpulkan hakim tunggal - padahal belum ada yang menyatakannya. Karena itu
 * yang belum diisi dikembalikan sebagai null, dan papan menanyakannya.
 */
async function identitasPerkara(nomorPerkara) {
  const nomor = cleanText(nomorPerkara);
  if (!nomor) return null;

  const kolomNilai = await sippSkemaService.pilihKolom("perkara", ["nilai_sengketa"]);

  const pilihan = [
    "p.perkara_id AS perkaraId",
    "p.nomor_perkara AS nomorPerkara",
    "p.jenis_perkara_nama AS jenisPerkara",
    "p.jenis_perkara_text AS jenisPerkaraLengkap",
    "p.tanggal_pendaftaran AS tanggalDaftar",
  ];
  if (kolomNilai) pilihan.push(`p.${kolomNilai} AS nilaiSengketa`);

  const rows = await runQuery(
    `SELECT ${pilihan.join(", ")}
       FROM perkara p
      WHERE p.nomor_perkara = ?
      ORDER BY p.perkara_id DESC
      LIMIT 1`,
    [nomor]
  );

  const baris = rows[0];
  if (!baris) return null;

  const nilai = baris.nilaiSengketa;
  return {
    perkaraId: Number(baris.perkaraId) || 0,
    nomorPerkara: cleanText(baris.nomorPerkara),
    jenisPerkara: cleanText(baris.jenisPerkara),
    jenisPerkaraLengkap: cleanText(baris.jenisPerkaraLengkap),
    tanggalDaftar: isoTanggal(baris.tanggalDaftar),
    // null berarti "belum pernah diisi", dan itu berbeda dari nol.
    nilaiSengketa: nilai === null || nilai === undefined ? null : Number(nilai) || 0,
    nilaiTerbaca: Boolean(kolomNilai),
  };
}

/** Penetapan yang sudah ada - satu baris per perkara, berkunci perkara_id. */
async function penetapanPerkara(perkaraId) {
  if (!(await sippSkemaService.tabelAda("perkara_penetapan"))) return null;

  const rows = await runQuery(
    `SELECT pp.penetapan_majelis_hakim AS pmh,
            pp.penetapan_panitera_pengganti AS ppp,
            pp.penetapan_jurusita AS pjs,
            pp.penetapan_hari_sidang AS phs,
            pp.sidang_pertama AS sidangPertama,
            pp.majelis_hakim_kode AS majelisKode,
            pp.majelis_hakim_nama AS majelisNama,
            pp.panitera_pengganti_text AS paniteraText,
            pp.jurusita_text AS jurusitaText
       FROM perkara_penetapan pp
      WHERE pp.perkara_id = ?
      LIMIT 1`,
    [perkaraId]
  ).catch(() => []);

  const baris = rows[0];
  if (!baris) return { ada: false, pmh: "", ppp: "", pjs: "", phs: "", sidangPertama: "" };

  return {
    ada: true,
    pmh: isoTanggal(baris.pmh),
    ppp: isoTanggal(baris.ppp),
    pjs: isoTanggal(baris.pjs),
    phs: isoTanggal(baris.phs),
    sidangPertama: isoTanggal(baris.sidangPertama),
    majelisKode: cleanText(baris.majelisKode),
    majelisNama: cleanText(String(baris.majelisNama || "").replace(/<br\s*\/?>/gi, ", ")),
    paniteraText: cleanText(String(baris.paniteraText || "").replace(/<br\s*\/?>/gi, ", ")),
    jurusitaText: cleanText(String(baris.jurusitaText || "").replace(/<br\s*\/?>/gi, ", ")),
  };
}

// ===========================================================================
// SUSUNAN MAJELIS MENURUT SK - DIBACA DARI SIPP
// ===========================================================================

/**
 * Susunan majelis tetap, beserta kompetensinya.
 *
 * SK-nya memang tersimpan di SIPP: ref_sk_majelis_tetap memuat nomor dan
 * tanggalnya, ref_majelis_tetap memuat isinya. Itu sebabnya ALETA tidak
 * menyimpan salinannya - yang disimpan hanya hari sidang dan kode panitera,
 * dua hal yang tidak punya tempat di sana.
 *
 * kompetensi_id inilah yang membedakan majelis yang berwenang memeriksa
 * ekonomi syariah dari yang tidak. Karena itu daftar sertifikat pun tidak perlu
 * diketik ulang di ALETA - cukup dibaca dari sini.
 */
async function susunanMajelisTetap() {
  if (!(await sippSkemaService.tabelAda("ref_majelis_tetap"))) {
    return { terbaca: false, alasan: "tabel_ref_majelis_tetap_tidak_ada", majelis: [] };
  }

  const rows = await runQuery(
    `SELECT rmt.majelis_id AS majelisId,
            rmt.hakim_id AS hakimId,
            rmt.hakim_nama AS hakimNama,
            rmt.urutan AS urutan,
            rmt.kompetensi_id AS kompetensiId,
            rmt.sidang_keliling AS sidangKeliling,
            h.kode AS hakimKode,
            h.nama_gelar AS hakimGelar,
            h.aktif AS hakimAktif,
            k.nama_kompetensi_majelis AS kompetensiNama,
            sk.nomor_sk AS nomorSk,
            sk.tanggal_sk AS tanggalSk
       FROM ref_majelis_tetap rmt
       LEFT JOIN hakim_pn h ON h.id = rmt.hakim_id
       LEFT JOIN ref_kompetensi_majelis k ON k.id = rmt.kompetensi_id
       LEFT JOIN ref_sk_majelis_tetap sk ON sk.id = rmt.sk_majelis_tetap_id
      WHERE rmt.aktif = 'Y'
      ORDER BY rmt.majelis_id ASC, rmt.urutan ASC`
  ).catch(() => []);

  if (rows.length === 0) {
    return { terbaca: false, alasan: "susunan_majelis_kosong", majelis: [] };
  }

  const peta = new Map();
  for (const row of rows) {
    const kunci = String(row.majelisId || "");
    if (!peta.has(kunci)) {
      peta.set(kunci, {
        majelisId: Number(row.majelisId) || 0,
        kompetensiId: Number(row.kompetensiId) || 0,
        kompetensiNama: cleanText(row.kompetensiNama),
        sidangKeliling: String(row.sidangKeliling || "").toUpperCase() === "Y",
        nomorSk: cleanText(row.nomorSk),
        tanggalSk: isoTanggal(row.tanggalSk),
        anggota: [],
      });
    }
    peta.get(kunci).anggota.push({
      hakimId: Number(row.hakimId) || 0,
      kode: cleanText(row.hakimKode),
      nama: cleanText(row.hakimNama) || cleanText(row.hakimGelar),
      urutan: Number(row.urutan) || 0,
      aktif: String(row.hakimAktif || "").toUpperCase() === "Y",
    });
  }

  const majelis = [...peta.values()].map((item) => ({
    ...item,
    // Kode majelisnya kode hakim yang duduk paling atas - itulah ketua
    // majelisnya, dan itulah kode yang dipakai SK menyebut majelisnya.
    kode: item.anggota.length > 0 ? item.anggota[0].kode : "",
  }));

  return { terbaca: true, alasan: "", majelis };
}

/**
 * ============================================================================
 * RASIO HAKIM - DIBACA DARI SMART MAJELIS MILIK SIPP SENDIRI
 * ============================================================================
 *
 * SIPP menyimpan porsi tiap majelis pada ref_majelis_tetap.rasio, dan itulah
 * yang dipakai Smart Majelis membagi perkara. Angkanya bukan tebakan siapa
 * pun - ia disetel pengadilan ini di menu SIPP:
 *
 *   majelis 1-3   50    Abdul, Himawan, Derry
 *   majelis 4-6   75    Akbar, Idris, Derry
 *   majelis 7-9  100    Himawan, Idris, Derry
 *   majelis 10-19      hakim tunggal, mengulang rasio yang sama per orang
 *
 * Terbaca per hakim: Abdul 50, Akbar 75, Himawan 100, Idris 100, Derry 100.
 * Yang berasio 50 memang membawa beban lain di luar persidangan, dan bagian
 * perkaranya separuh.
 *
 * ============================================================================
 * SELURUH BARISNYA aktif = 0, DAN ITU DISEBUTKAN APA ADANYA
 * ============================================================================
 *
 * Seratus enam baris, tidak satu pun aktif. Rasionya tetap dibaca - itu satu-
 * satunya angka porsi yang pernah ditetapkan pengadilan ini, dan mengabaikannya
 * berarti kembali menganggap seluruh hakim berporsi sama, yang justru diketahui
 * tidak benar.
 *
 * Yang TIDAK dilakukan: menganggap barisnya aktif untuk keperluan lain. Susunan
 * majelisnya tetap tidak dipakai - hanya angka rasionya.
 */
async function rasioHakim() {
  if (!(await sippSkemaService.tabelAda("ref_majelis_tetap"))) return new Map();

  const rows = await runQuery(
    `SELECT rmt.hakim_id AS hakimId, MAX(rmt.rasio) AS rasio
       FROM ref_majelis_tetap rmt
      WHERE rmt.rasio IS NOT NULL AND rmt.rasio > 0
      GROUP BY rmt.hakim_id`
  ).catch(() => []);

  const peta = new Map();
  for (const row of rows) {
    const id = Number(row.hakimId) || 0;
    const rasio = Number(row.rasio) || 0;
    if (id && rasio > 0) peta.set(id, rasio);
  }
  return peta;
}

/**
 * ============================================================================
 * PETUGAS YANG AKUN SIPP-NYA DIBLOKIR
 * ============================================================================
 *
 * "Aktif" pada panitera_pn, hakim_pn, dan jurusita menyatakan orangnya masih
 * bertugas di pengadilan ini. Ia TIDAK menyatakan akunnya masih dapat dipakai.
 * Keduanya disimpan di tempat yang berbeda dan tidak pernah disamakan SIPP.
 *
 * Akibatnya nyata dan terlihat di layar: Asrah Rachman diblokir akunnya
 * (sys_users.block = 1) tetapi tetap tercatat aktif sebagai panitera, sehingga
 * ALETA terus mengusulkannya. Diukur pada panitera yang aktif:
 *
 *   Asrah Rachman      1 akun, 0 tidak diblokir
 *   Mannaria           1 akun, 0 tidak diblokir
 *   Nuniek Widriyani   1 akun, 0 tidak diblokir
 *   Sri Wahyuni        1 akun, 0 tidak diblokir
 *
 * Empat dari sebelas. Hakim dan juru sita sejauh ini bersih.
 *
 * ============================================================================
 * DUA HAL YANG MEMBUATNYA TIDAK ASAL MEMBUANG ORANG
 * ============================================================================
 *
 *   1. Tautannya EKSPLISIT, bukan cocok-cocokan nama. SIPP punya user_hakim,
 *      user_panitera, dan user_jurusita yang menghubungkan userid dengan
 *      orangnya. Mencocokkan nama akan salah pada orang yang namanya ditulis
 *      berbeda antar tabel - dan salah membuang orang lebih buruk daripada
 *      salah mengusulkan, sebab yang terbuang tidak kelihatan sama sekali.
 *
 *   2. Yang dibuang hanya yang PUNYA akun dan seluruhnya diblokir. Orang yang
 *      belum punya tautan akun sama sekali TIDAK dibuang: tidak adanya tautan
 *      bukan bukti diblokir, dan Munifa membuktikan mengapa ini penting - ia
 *      punya akun lama yang diblokir dan akun baru yang dipakai hari ini.
 */
async function petugasDiblokir() {
  const kosong = { hakim: new Set(), panitera: new Set(), jurusita: new Set() };

  const baca = async (tabelTaut, kolomOrang) => {
    if (!(await sippSkemaService.tabelAda(tabelTaut))) return new Set();
    if (!(await sippSkemaService.tabelAda("sys_users"))) return new Set();
    const rows = await runQuery(
      `SELECT u.${kolomOrang} AS orangId,
              COUNT(s.userid) AS akun,
              SUM(CASE WHEN s.block = 0 THEN 1 ELSE 0 END) AS bebas
         FROM ${tabelTaut} u
         JOIN sys_users s ON s.userid = u.userid
        GROUP BY u.${kolomOrang}
       HAVING akun > 0 AND bebas = 0`
    ).catch(() => []);
    return new Set((rows || []).map((x) => Number(x.orangId)).filter(Boolean));
  };

  try {
    const [hakim, panitera, jurusita] = await Promise.all([
      baca("user_hakim", "hakim_id"),
      baca("user_panitera", "panitera_id"),
      baca("user_jurusita", "jurusita_id"),
    ]);
    return { hakim, panitera, jurusita };
  } catch (_) {
    // Gagal membaca berarti tidak tahu, dan tidak tahu TIDAK boleh menjadi
    // "buang semuanya". Yang dipulangkan himpunan kosong: seluruh petugas
    // tetap diusulkan, seperti sebelum penjagaan ini ada.
    return kosong;
  }
}

/**
 * ============================================================================
 * BERAPA SIDANG YANG SUDAH ADA PADA TANGGAL ITU
 * ============================================================================
 *
 * Menetapkan hari sidang tanpa mengetahui hari itu sudah seberapa penuh adalah
 * cara paling mudah menumpuk dua puluh perkara pada satu hari sementara hari
 * berikutnya kosong. Petugas yang menetapkan tidak dapat melihatnya - kalender
 * SIPP menunjukkan jadwal satu perkara, bukan beban satu hari.
 *
 * Yang dihitung sidang yang BELUM ditunda pada tanggal itu - sidang yang sudah
 * ditandai ditunda tidak lagi menempati hari itu, dan menghitungnya membuat
 * hari yang sebenarnya lengang tampak penuh.
 *
 * Dihitung sekaligus untuk seluruh tanggal calon dalam satu kueri. Empat kueri
 * terpisah untuk empat tanggal akan berlipat menjadi delapan begitu calonnya
 * ditambah, dan tidak seorang pun akan menyadarinya sampai papan terasa berat.
 */
async function jumlahSidangPerTanggal(daftarTanggal) {
  const tanggal = [...new Set((daftarTanggal || []).filter(Boolean))];
  if (tanggal.length === 0) return new Map();
  if (!(await sippSkemaService.tabelAda("perkara_jadwal_sidang"))) return new Map();

  const isian = tanggal.map(() => "?").join(", ");
  const rows = await runQuery(
    `SELECT DATE(j.tanggal_sidang) AS tanggal,
            COUNT(*) AS jumlah,
            SUM(CASE WHEN j.ruangan_id IS NOT NULL THEN 1 ELSE 0 END) AS berruang
       FROM perkara_jadwal_sidang j
      WHERE DATE(j.tanggal_sidang) IN (${isian})
        AND j.ditunda = 'T'
      GROUP BY DATE(j.tanggal_sidang)`,
    tanggal
  ).catch(() => []);

  const peta = new Map();
  for (const row of rows || []) {
    peta.set(isoTanggal(row.tanggal), Number(row.jumlah) || 0);
  }
  return peta;
}

/** Seluruh hakim yang masih aktif, untuk daftar pilihan manual. */
async function daftarHakimAktif() {
  if (!(await sippSkemaService.tabelAda("hakim_pn"))) return [];

  const rows = await runQuery(
    `SELECT h.id AS hakimId, h.kode AS kode, h.nama AS nama,
            h.nama_gelar AS gelar, h.jabatan AS jabatan, h.mulai AS mulai
       FROM hakim_pn h
      WHERE h.aktif = 'Y'
      ORDER BY h.kode ASC, h.nama ASC`
  ).catch(() => []);

  return rows.map((row) => ({
    hakimId: Number(row.hakimId) || 0,
    mulai: row.mulai,
    kode: cleanText(row.kode),
    nama: cleanText(row.nama),
    gelar: cleanText(row.gelar),
    jabatan: cleanText(row.jabatan),
  }));
}

/** Panitera pengganti yang masih aktif, untuk daftar pilihan manual. */
async function daftarPaniteraAktif() {
  if (!(await sippSkemaService.tabelAda("panitera_pn"))) return [];

  const rows = await runQuery(
    `SELECT pn.id AS paniteraId, pn.kode AS kode, pn.nama AS nama,
            pn.nama_gelar AS gelar, pn.jabatan AS jabatan
       FROM panitera_pn pn
      WHERE pn.aktif = 'Y'
      ORDER BY pn.kode ASC, pn.nama ASC`
  ).catch(() => []);

  return rows.map((row) => ({
    paniteraId: Number(row.paniteraId) || 0,
    kode: cleanText(row.kode),
    nama: cleanText(row.nama),
    gelar: cleanText(row.gelar),
    jabatan: cleanText(row.jabatan),
  }));
}

// ===========================================================================
// PMH
// ===========================================================================

/**
 * Usulan smart majelis milik SIPP sendiri.
 *
 * hakim_id2 berisi penggantinya bila ada, dan yang BERLAKU itu - bukan
 * hakim_id. Membaca hakim_id saja akan mengusulkan majelis yang sudah
 * digantikan, dan itu tampak meyakinkan justru karena ia memang pernah benar.
 */
async function smartMajelisPerkara(perkaraId) {
  if (!(await sippSkemaService.tabelAda("perkara_smartmajelis"))) {
    return { ada: false, alasan: "tabel_smartmajelis_tidak_ada" };
  }

  const rows = await runQuery(
    `SELECT sm.majelis_id AS majelisId,
            sm.hakim_id AS hakimId,
            sm.hakim_id2 AS hakimId2,
            sm.status AS status,
            sm.keterangan AS keterangan
       FROM perkara_smartmajelis sm
      WHERE sm.perkara_id = ?
      LIMIT 1`,
    [perkaraId]
  ).catch(() => []);

  const baris = rows[0];
  if (!baris) return { ada: false, alasan: "belum_ada_usulan_smartmajelis" };

  const berlaku = pecahId(baris.hakimId2);
  const semula = pecahId(baris.hakimId);

  return {
    ada: true,
    alasan: "",
    majelisId: Number(baris.majelisId) || 0,
    hakimId: berlaku.length > 0 ? berlaku : semula,
    diganti: berlaku.length > 0 && semula.length > 0,
    status: cleanText(baris.status),
    keterangan: cleanText(baris.keterangan),
  };
}

/**
 * Berapa perkara berhakim tunggal yang sudah diterima tiap hakim tahun ini.
 *
 * Yang dihitung HANYA perkara yang majelisnya satu orang - itulah yang
 * dimaksud "paling sedikit menerima perkara tersebut". Perkara bermajelis
 * tidak ikut: hakim yang banyak duduk sebagai anggota majelis bukan berarti
 * sudah kebagian perkara hakim tunggal.
 */
/**
 * ============================================================================
 * BEBAN HAKIM PADA PERKARA BERMAJELIS
 * ============================================================================
 *
 * bebanHakimTunggal() sengaja hanya menghitung perkara yang hakimnya SENDIRIAN
 * - HAVING COUNT(*) = 1. Itu benar untuk usulan hakim tunggal, tetapi menjadi
 * angka yang menyesatkan begitu kolam hakim dibuka pada perkara bermajelis:
 * hakim yang setahun ini duduk pada 271 majelis akan tampak berbeban nol.
 *
 * Karena itu bebannya dihitung terpisah, dengan syarat yang persis kebalikan.
 * Keduanya tidak boleh dijumlahkan begitu saja - satu perkara bermajelis
 * membebani tiga orang sekaligus, sedangkan perkara hakim tunggal membebani
 * satu; menjumlahkannya menyamakan dua hal yang tidak sama beratnya.
 */
/**
 * ============================================================================
 * SATU PERKARA TIDAK SAMA BERATNYA DENGAN SATU PERKARA LAIN
 * ============================================================================
 *
 * Pembagian sebelumnya menghitung KEPALA: seorang hakim dengan 40 cerai gugat
 * dianggap sama beratnya dengan hakim yang memegang 40 perkara kewarisan. Itu
 * tidak benar dan semua orang di pengadilan tahu tidak benar - yang pertama
 * sebagian besar verstek satu sampai dua kali sidang, yang kedua menuntut
 * pembuktian, saksi, kadang pemeriksaan setempat.
 *
 * Bobotnya ditetapkan pimpinan pengadilan ini, dan aturannya dua:
 *
 *   1. Perkara KEBENDAAN lebih berat daripada perkara biasa.
 *   2. Perkara SELAIN perceraian dan itsbat nikah lebih berat daripada
 *      perceraian dan itsbat.
 *
 * Ketiga tingkatnya karena itu:
 *
 *   1,0  perceraian dan itsbat - cerai gugat, cerai talak, istbat nikah.
 *        Inilah 94% perkara di sini (1.645 dari 1.744 sejak 2025), dan
 *        justru karena itu ia yang pantas menjadi satuan dasarnya.
 *   1,5  selain keduanya, bukan kebendaan - dispensasi kawin, perwalian,
 *        asal usul anak, wali adhol, izin poligami, dan sejenisnya.
 *   2,0  kebendaan - harta bersama, kewarisan, P3HP/penetapan ahli waris,
 *        wasiat, dan ekonomi syariah.
 *
 * ============================================================================
 * DIKUNCI PADA ID, BUKAN PADA NAMANYA
 * ============================================================================
 *
 * jenis_perkara_id 360 muncul dengan DUA nama di basis data ini -
 * "Pengesahan Perkawinan/Istbat Nikah" (3.964 perkara) dan "Istbat Nikah" (89).
 * Mencocokkan nama berarti 89 perkara jatuh ke tingkat yang salah, tanpa satu
 * pun galat. Id-nya tidak pernah berubah.
 *
 * ============================================================================
 * YANG TIDAK DIKENALI DIANGGAP 1,5 - BUKAN 1,0
 * ============================================================================
 *
 * Perceraian dan itsbat hanya tiga id, dan ketiganya sudah terdaftar. Jenis
 * baru apa pun karena itu menurut definisi "selain perceraian dan itsbat",
 * sehingga 1,5 adalah jawaban yang BENAR untuk yang tidak dikenali - bukan
 * sekadar jawaban yang aman.
 */
const BOBOT_JENIS = {
  // --- perceraian dan itsbat: satuan dasarnya ---
  347: 1.0, // Cerai Gugat
  346: 1.0, // Cerai Talak
  360: 1.0, // Pengesahan Perkawinan / Istbat Nikah

  // --- kebendaan ---
  348: 2.0, // Harta Bersama
  364: 2.0, // Kewarisan
  371: 2.0, // P3HP / Penetapan Ahli Waris
  365: 2.0, // Wasiat
  370: 2.0, // Ekonomi Syariah
};

const BOBOT_BAWAAN = 1.5;

/**
 * Potongan SQL yang menghitung bobot satu baris perkara.
 *
 * Disusun dari BOBOT_JENIS supaya angkanya hidup di SATU tempat. Menuliskannya
 * langsung di tiap kueri berarti empat salinan yang perlahan menyimpang - dan
 * menyimpangnya tidak akan pernah terlihat, sebab keempatnya tetap menghasilkan
 * angka yang masuk akal.
 *
 * Id-nya angka dari daftar di atas, bukan dari pemanggil - tidak ada jalan
 * masuk bagi nilai luar ke dalam potongan SQL ini.
 */
function ekspresiBobot(alias) {
  const cabang = Object.entries(BOBOT_JENIS)
    .map(([id, bobot]) => `WHEN ${Number(id)} THEN ${Number(bobot)}`)
    .join(" ");
  return `CASE ${alias}.jenis_perkara_id ${cabang} ELSE ${BOBOT_BAWAAN} END`;
}

async function bebanHakimMajelis(tahun) {
  if (!(await sippSkemaService.tabelAda("perkara_hakim_pn"))) return new Map();

  const rows = await runQuery(
    `SELECT hp.hakim_id AS hakimId, ROUND(SUM(${ekspresiBobot("p")}), 2) AS jumlah
       FROM perkara_hakim_pn hp
       JOIN (
              SELECT perkara_id
                FROM perkara_hakim_pn
               WHERE aktif = 'Y' AND tahapan_id = ? AND YEAR(tanggal_penetapan) = ?
               GROUP BY perkara_id
              HAVING COUNT(*) > 1
            ) AS bermajelis ON bermajelis.perkara_id = hp.perkara_id
       JOIN perkara p ON p.perkara_id = hp.perkara_id
      WHERE hp.aktif = 'Y' AND hp.tahapan_id = ? AND YEAR(hp.tanggal_penetapan) = ?
      GROUP BY hp.hakim_id`,
    [TAHAPAN_TINGKAT_PERTAMA, tahun, TAHAPAN_TINGKAT_PERTAMA, tahun]
  ).catch(() => []);

  const peta = new Map();
  for (const row of rows) peta.set(Number(row.hakimId) || 0, Number(row.jumlah) || 0);
  return peta;
}

/**
 * ============================================================================
 * SUSUNAN MAJELIS YANG BENAR-BENAR DIPAKAI - BUKAN YANG TERTULIS DI SK
 * ============================================================================
 *
 * ref_majelis_tetap adalah tempat SIPP menyimpan susunan majelis menurut SK.
 * Di PA Donggala tabel itu berisi 106 baris dan TIDAK SATU PUN aktif, sehingga
 * susunanMajelisTetap() memulangkan "susunan_majelis_kosong". Menawarkan
 * pilihan majelis dari sana berarti menawarkan daftar kosong.
 *
 * Yang ada justru kenyataannya: susunan yang dipakai berulang-ulang sepanjang
 * tahun, terbaca dari perkara_hakim_pn. Diukur untuk 2026:
 *
 *   Himawan · Idris · Derry        271 perkara
 *   Sudarmin · Idris · Derry       109
 *   Akbar Ali · Idris · Derry       79
 *   Abdul Salam · Himawan · Derry   51
 *   Fahri · Himawan · Derry         42
 *
 * Itulah yang ditawarkan. Urutannya tetap urutan SIPP (kolom urutan), sebab
 * urutan itulah yang membedakan ketua dari anggota - mengurutkannya menurut
 * nama akan menukar ketua dengan anggota tanpa ada yang menyadarinya.
 *
 * Hanya susunan yang SELURUH anggotanya masih aktif yang ditawarkan. Susunan
 * yang memuat hakim yang sudah pindah tetap terbaca di riwayat, tetapi
 * menawarkannya sebagai pilihan berarti menawarkan penetapan yang pasti
 * ditolak SIPP.
 */
async function susunanMajelisTerpakai(tahun, hakimAktif = [], batas = 12) {
  if (!(await sippSkemaService.tabelAda("perkara_hakim_pn"))) {
    return { terbaca: false, alasan: "tabel_hakim_pn_tidak_ada", susunan: [] };
  }

  const rows = await runQuery(
    `SELECT susunan, anggota, COUNT(*) AS perkara FROM (
        SELECT hp.perkara_id AS perkara_id,
               GROUP_CONCAT(hp.hakim_id ORDER BY hp.urutan ASC SEPARATOR ',') AS susunan,
               COUNT(*) AS anggota
          FROM perkara_hakim_pn hp
         WHERE hp.aktif = 'Y' AND hp.tahapan_id = ? AND YEAR(hp.tanggal_penetapan) = ?
         GROUP BY hp.perkara_id
        HAVING COUNT(*) > 1
      ) AS t
      GROUP BY susunan, anggota
      ORDER BY perkara DESC
      LIMIT 60`,
    [TAHAPAN_TINGKAT_PERTAMA, tahun]
  ).catch(() => []);

  if (rows.length === 0) {
    return { terbaca: false, alasan: "belum_ada_susunan_terpakai", susunan: [] };
  }

  const aktif = new Map(hakimAktif.map((x) => [Number(x.hakimId), x]));
  const susunan = [];

  for (const row of rows) {
    const id = String(row.susunan || "")
      .split(",")
      .map((x) => Number(String(x).trim()))
      .filter((x) => Number.isFinite(x) && x > 0);
    if (id.length < 2) continue;
    // Seluruh anggotanya harus masih aktif - lihat catatan di atas.
    if (!id.every((x) => aktif.has(x))) continue;

    susunan.push({
      kunci: id.join("-"),
      hakimId: id,
      anggota: id.map((x) => {
        const orang = aktif.get(x);
        return { hakimId: x, kode: orang.kode, nama: orang.nama };
      }),
      perkara: Number(row.perkara) || 0,
    });
    if (susunan.length >= batas) break;
  }

  return { terbaca: susunan.length > 0, alasan: "", susunan };
}

async function bebanHakimTunggal(tahun) {
  if (!(await sippSkemaService.tabelAda("perkara_hakim_pn"))) return new Map();

  const rows = await runQuery(
    `SELECT tunggal.hakim_id AS hakimId, ROUND(SUM(${ekspresiBobot("p")}), 2) AS jumlah
       FROM (
              SELECT hp.perkara_id AS perkara_id, MIN(hp.hakim_id) AS hakim_id
                FROM perkara_hakim_pn hp
               WHERE hp.aktif = 'Y'
                 AND hp.tahapan_id = ?
                 AND YEAR(hp.tanggal_penetapan) = ?
               GROUP BY hp.perkara_id
              HAVING COUNT(*) = 1
            ) AS tunggal
       JOIN perkara p ON p.perkara_id = tunggal.perkara_id
      GROUP BY tunggal.hakim_id`,
    [TAHAPAN_TINGKAT_PERTAMA, tahun]
  ).catch(() => []);

  const peta = new Map();
  for (const row of rows) peta.set(Number(row.hakimId) || 0, Number(row.jumlah) || 0);

  // Tanggal tiap penetapan hakim tunggal ikut dibawa - dipakai menghitung
  // bagian yang semestinya bagi hakim yang baru bertugas, sama seperti
  // panitera pengganti dan juru sita.
  const tanggal = await runQuery(
    `SELECT tunggal.tanggal AS tanggal
       FROM (
              SELECT hp.perkara_id AS perkara_id,
                     MIN(hp.tanggal_penetapan) AS tanggal
                FROM perkara_hakim_pn hp
               WHERE hp.aktif = 'Y'
                 AND hp.tahapan_id = ?
                 AND YEAR(hp.tanggal_penetapan) = ?
               GROUP BY hp.perkara_id
              HAVING COUNT(*) = 1
            ) AS tunggal`,
    [TAHAPAN_TINGKAT_PERTAMA, tahun]
  ).catch(() => []);

  peta.tanggal = tanggal.map((x) => x.tanggal);
  return peta;
}

/**
 * Apakah perkara ini berhakim tunggal - dan kenapa.
 *
 * Tiga jalan, diperiksa berurutan:
 *
 *   1. Jenis perkaranya memang selalu tunggal - dispensasi kawin, isbat.
 *      Nilai sengketa tidak berperan.
 *   2. Ekonomi syariah: nilai sengketanya yang menentukan. Sampai ambang
 *      berhakim tunggal, di atasnya bermajelis.
 *   3. Selain itu bermajelis.
 *
 * Ekonomi syariah yang nilainya belum diisi TIDAK disimpulkan apa-apa. Yang
 * dikembalikan "belum dapat ditentukan", dan papan menanyakan nilainya -
 * sebab menebaknya berarti menetapkan susunan majelis dari data kosong.
 */
function tentukanSusunan(identitas, aturan) {
  const jenis = `${identitas.jenisPerkara} ${identitas.jenisPerkaraLengkap}`.toLowerCase();

  const kunciCocok = (aturan.klasifikasiHakimTunggal || []).find((kata) =>
    jenis.includes(String(kata || "").toLowerCase())
  );
  if (kunciCocok) {
    return { bentuk: "tunggal", sebab: `jenis perkara mengandung "${kunciCocok}"` };
  }

  const ekonomiSyariah = jenis.includes("ekonomi syariah") || jenis.includes("ekonomi syari");
  if (ekonomiSyariah) {
    if (identitas.nilaiSengketa === null) {
      return {
        bentuk: "belum-tentu",
        sebab: "ekonomi syariah, tetapi nilai sengketanya belum diisi di SIPP",
        perluNilai: true,
      };
    }
    const ambang = Number(aturan.ambangNilaiSengketa) || 0;
    if (identitas.nilaiSengketa <= ambang) {
      return {
        bentuk: "tunggal",
        sebab: `ekonomi syariah, nilai sengketa tidak melampaui ambang`,
        ekonomiSyariah: true,
      };
    }
    return {
      bentuk: "majelis",
      sebab: "ekonomi syariah, nilai sengketa melampaui ambang",
      ekonomiSyariah: true,
    };
  }

  return { bentuk: "majelis", sebab: "jenis perkara bermajelis" };
}

// ===========================================================================
// PJS - GILIRAN JURU SITA
// ===========================================================================

/**
 * Giliran juru sita: yang tertinggal didahulukan, urutannya menurut perkara_id.
 *
 * ============================================================================
 * KENAPA HITUNGAN, BUKAN RUMUS
 * ============================================================================
 *
 * Urutan penunjukan yang lalu sudah diuji terhadap enam rumus - giliran global,
 * paling sedikit, per majelis, per hari, dan gabungannya - dan tidak satu pun
 * menerka lebih baik daripada tebakan acak. Pembagiannya memang merata 1:1,
 * tetapi urutannya tidak mengikuti pola yang dapat dipulihkan.
 *
 * Karena itu yang ditegakkan giliran ke DEPAN, bukan yang ditebak ke belakang:
 * dihitung siapa yang paling sedikit menerima tahun ini, dan itulah gilirannya.
 * Setahun berjalan, jumlahnya akan sama dengan sendirinya.
 */
async function giliranJurusita(tahun) {
  const punyaJurusita = await sippSkemaService.tabelAda("jurusita");
  const punyaPerkara = await sippSkemaService.tabelAda("perkara_jurusita");
  if (!punyaJurusita || !punyaPerkara) {
    return { terbaca: false, alasan: "tabel_jurusita_tidak_ada", daftar: [] };
  }

  const [aktif, hitungan, tanggalSemua] = await Promise.all([
    runQuery(
      `SELECT js.id AS jurusitaId, js.kode AS kode, js.nama AS nama, js.jabatan AS jabatan,
              js.diinput_tanggal AS mulai
         FROM jurusita js
        WHERE js.aktif = 'Y'
        ORDER BY js.id ASC`
    ).catch(() => []),
    runQuery(
      `SELECT pj.jurusita_id AS jurusitaId,
              ROUND(SUM(${ekspresiBobot("p")}), 2) AS jumlah,
              MAX(pj.perkara_id) AS perkaraTerakhir
         FROM perkara_jurusita pj
         JOIN perkara p ON p.perkara_id = pj.perkara_id
        WHERE pj.aktif = 'Y'
          AND pj.tahapan_id = ?
          AND YEAR(pj.tanggal_penetapan) = ?
        GROUP BY pj.jurusita_id`,
      [TAHAPAN_TINGKAT_PERTAMA, tahun]
    ).catch(() => []),
    runQuery(
      `SELECT pj.tanggal_penetapan AS tanggal
         FROM perkara_jurusita pj
        WHERE pj.aktif = 'Y'
          AND pj.tahapan_id = ?
          AND YEAR(pj.tanggal_penetapan) = ?`,
      [TAHAPAN_TINGKAT_PERTAMA, tahun]
    ).catch(() => []),
  ]);

  if (aktif.length === 0) {
    return { terbaca: false, alasan: "tidak_ada_jurusita_aktif", daftar: [] };
  }

  const peta = new Map();
  let perkaraTerbaru = 0;
  for (const row of hitungan) {
    const id = Number(row.jurusitaId) || 0;
    const terakhir = Number(row.perkaraTerakhir) || 0;
    peta.set(id, { jumlah: Number(row.jumlah) || 0, terakhir });
    if (terakhir > perkaraTerbaru) perkaraTerbaru = terakhir;
  }

  const ambangTertinggal = aktif.length * KELIPATAN_DUGAAN_BERHALANGAN;

  const bagian = bagianSemestinya({
    orang: aktif.map((row) => ({
      id: Number(row.jurusitaId) || 0,
      mulai: row.mulai,
      jumlah: (peta.get(Number(row.jurusitaId) || 0) || { jumlah: 0 }).jumlah,
    })),
    tanggalPenetapan: (tanggalSemua || []).map((x) => x.tanggal),
    sekarang: new Date(),
    awalTahun: `${tahun}-01-01`,
  });

  const daftar = aktif.map((row) => {
    const id = Number(row.jurusitaId) || 0;
    const catatan = peta.get(id) || { jumlah: 0, terakhir: 0 };
    // Yang belum pernah kebagian tahun ini tertinggal sejauh mungkin, bukan
    // nol - kalau dihitung nol ia akan tampak paling baru menerima.
    const tertinggal = catatan.terakhir > 0 ? perkaraTerbaru - catatan.terakhir : perkaraTerbaru;
    const adil = bagian.get(id) || { semestinya: 0, selisih: 0, baruBertugas: false, hariBertugas: 0 };
    return {
      jurusitaId: id,
      kode: cleanText(row.kode),
      nama: cleanText(row.nama),
      jabatan: cleanText(row.jabatan),
      jumlah: catatan.jumlah,
      perkaraTerakhir: catatan.terakhir,
      tertinggal,
      semestinya: Math.round(adil.semestinya),
      selisih: Math.round(adil.selisih),
      baruBertugas: adil.baruBertugas,
      hariBertugas: adil.hariBertugas,
      dugaanBerhalangan: perkaraTerbaru > 0 && tertinggal >= ambangTertinggal,
      _selisih: adil.selisih,
    };
  });

  // Yang paling KURANG dari bagiannya dulu - bukan yang paling sedikit
  // jumlahnya; bila setara, yang paling lama tidak kebagian; bila masih sama,
  // menurut id supaya urutannya tetap sama tiap kali dihitung.
  const urut = [...daftar].sort(
    (a, b) =>
      a._selisih - b._selisih || b.tertinggal - a.tertinggal || a.jurusitaId - b.jurusitaId
  );

  return {
    terbaca: true,
    alasan: "",
    daftar: urut,
    usulan: urut[0] || null,
    ambangTertinggal,
  };
}

/**
 * Giliran panitera pengganti - kembaran giliranJurusita.
 *
 * ============================================================================
 * MENGAPA GILIRAN, BUKAN PER MAJELIS
 * ============================================================================
 *
 * Riwayat PA Donggala menunjukkan panitera pengganti TIDAK tetap per majelis:
 * nama yang sama muncul lintas majelis, dan yang teratas pun cuma seperempat.
 * Menetapkannya per majelis berarti memaksakan aturan yang tidak ada. Yang
 * sungguh berlaku adalah rotasi supaya beban merata - persis juru sita.
 *
 * Karena itu perhitungannya dibuat SAMA dengan giliranJurusita, sampai ke
 * penanganan yang belum pernah kebagian tahun ini dan dugaan berhalangan.
 * Yang berbeda hanya tabelnya: panitera_pn dan perkara_panitera_pn.
 */
/**
 * Giliran panitera pengganti.
 *
 * `rasio` adalah peta nama-huruf-kecil -> angka porsi. Ia harus masuk SEBELUM
 * bagianSemestinya dihitung: bagian yang semestinya bergantung pada porsi tiap
 * orang, dan menempelkannya sesudah hitungan selesai tidak mengubah apa pun.
 */
/**
 * Porsi satu panitera menurut petanya.
 *
 * Dicocokkan dengan awalan nama supaya "Sri Susilowati" tetap ketemu walau
 * tabelnya menuliskannya "Sri Susilowati, S.H.". Yang tidak disebut berporsi
 * penuh - 100.
 */
function porsiPanitera(peta, nama) {
  const bersih = String(nama || "").trim().toLowerCase();
  if (!bersih) return 100;
  for (const [kunci, nilai] of peta) {
    if (bersih === kunci || bersih.startsWith(kunci)) return nilai;
  }
  return 100;
}

async function giliranPanitera(tahun, rasio = new Map()) {
  const punyaPanitera = await sippSkemaService.tabelAda("panitera_pn");
  const punyaPerkara = await sippSkemaService.tabelAda("perkara_panitera_pn");
  if (!punyaPanitera || !punyaPerkara) {
    return { terbaca: false, alasan: "tabel_panitera_tidak_ada", daftar: [] };
  }

  const [aktif, hitungan, tanggalSemua] = await Promise.all([
    runQuery(
      `SELECT pn.id AS paniteraId, pn.kode AS kode, pn.nama AS nama, pn.jabatan AS jabatan,
              pn.diinput_tanggal AS mulai
         FROM panitera_pn pn
        WHERE pn.aktif = 'Y'
        ORDER BY pn.id ASC`
    ).catch(() => []),
    runQuery(
      `SELECT pp.panitera_id AS paniteraId,
              ROUND(SUM(${ekspresiBobot("p")}), 2) AS jumlah,
              MAX(pp.perkara_id) AS perkaraTerakhir
         FROM perkara_panitera_pn pp
         JOIN perkara p ON p.perkara_id = pp.perkara_id
        WHERE pp.aktif = 'Y'
          AND pp.tahapan_id = ?
          AND YEAR(pp.tanggal_penetapan) = ?
        GROUP BY pp.panitera_id`,
      [TAHAPAN_TINGKAT_PERTAMA, tahun]
    ).catch(() => []),
    // Seluruh TANGGAL penetapan tahun ini, milik siapa pun - dipakai menghitung
    // berapa banyak yang terjadi selama masa kerja tiap orang.
    runQuery(
      `SELECT pp.tanggal_penetapan AS tanggal
         FROM perkara_panitera_pn pp
        WHERE pp.aktif = 'Y'
          AND pp.tahapan_id = ?
          AND YEAR(pp.tanggal_penetapan) = ?`,
      [TAHAPAN_TINGKAT_PERTAMA, tahun]
    ).catch(() => []),
  ]);

  if (aktif.length === 0) {
    return { terbaca: false, alasan: "tidak_ada_panitera_aktif", daftar: [] };
  }

  const peta = new Map();
  let perkaraTerbaru = 0;
  for (const row of hitungan) {
    const id = Number(row.paniteraId) || 0;
    const terakhir = Number(row.perkaraTerakhir) || 0;
    peta.set(id, { jumlah: Number(row.jumlah) || 0, terakhir });
    if (terakhir > perkaraTerbaru) perkaraTerbaru = terakhir;
  }

  const ambangTertinggal = aktif.length * KELIPATAN_DUGAAN_BERHALANGAN;

  // Bagian yang semestinya - supaya pegawai yang baru dilantik tidak dikejar
  // menyusul beban setahun penuh dalam hitungan hari.
  const bagian = bagianSemestinya({
    orang: aktif.map((row) => ({
      id: Number(row.paniteraId) || 0,
      mulai: row.mulai,
      rasio: porsiPanitera(rasio, row.nama),
      jumlah: (peta.get(Number(row.paniteraId) || 0) || { jumlah: 0 }).jumlah,
    })),
    tanggalPenetapan: (tanggalSemua || []).map((x) => x.tanggal),
    sekarang: new Date(),
    awalTahun: `${tahun}-01-01`,
  });

  const daftar = aktif.map((row) => {
    const id = Number(row.paniteraId) || 0;
    const catatan = peta.get(id) || { jumlah: 0, terakhir: 0 };
    const tertinggal = catatan.terakhir > 0 ? perkaraTerbaru - catatan.terakhir : perkaraTerbaru;
    const adil = bagian.get(id) || { semestinya: 0, selisih: 0, baruBertugas: false, hariBertugas: 0 };
    return {
      paniteraId: id,
      kode: cleanText(row.kode),
      nama: cleanText(row.nama),
      jabatan: cleanText(row.jabatan),
      jumlah: catatan.jumlah,
      perkaraTerakhir: catatan.terakhir,
      tertinggal,
      // Dibulatkan hanya untuk ditampilkan; pengurutannya memakai angka penuh.
      semestinya: Math.round(adil.semestinya),
      selisih: Math.round(adil.selisih),
      baruBertugas: adil.baruBertugas,
      hariBertugas: adil.hariBertugas,
      dugaanBerhalangan: perkaraTerbaru > 0 && tertinggal >= ambangTertinggal,
      _selisih: adil.selisih,
    };
  });

  // Yang paling KURANG dari bagiannya didahulukan - bukan yang paling sedikit
  // jumlahnya. Bila selisihnya setara, yang paling lama tidak kebagian menang.
  const urut = [...daftar].sort(
    (a, b) =>
      a._selisih - b._selisih || b.tertinggal - a.tertinggal || a.paniteraId - b.paniteraId
  );

  return {
    terbaca: true,
    alasan: "",
    daftar: urut,
    usulan: urut[0] || null,
    ambangTertinggal,
  };
}

// ===========================================================================
// MENYUSUN USULAN LENGKAP
// ===========================================================================

/**
 * Keempat baris papan penunjukan untuk satu perkara.
 *
 * @param {string} nomorPerkara nomor perkara yang sedang dibuka di SIPP
 * @param {object} pengaturan   { aturan, hariSidang, paniteraMajelis } dari portal
 */
async function usulanPenunjukan(nomorPerkara, pengaturan = {}) {
  const aturan = pengaturan.aturan || {};

  // Disusun lebih dahulu: giliranPanitera memakainya di dalam hitungan bagian
  // semestinya, bukan sesudahnya.
  const rasioPanitera = new Map();
  for (const baris of aturan.rasioPanitera || []) {
    const [nama, angka] = String(baris || "").split("=");
    const bersih = String(nama || "").trim().toLowerCase();
    const nilai = Number(angka);
    if (bersih && Number.isFinite(nilai) && nilai > 0) rasioPanitera.set(bersih, nilai);
  }
  const hariSidang = pengaturan.hariSidang || {};
  const paniteraMajelis = pengaturan.paniteraMajelis || {};

  const identitas = await identitasPerkara(nomorPerkara);
  if (!identitas) {
    return { ok: false, alasan: "perkara_tidak_ketemu", nomorPerkara: cleanText(nomorPerkara) };
  }

  const tahun = Number(String(identitas.tanggalDaftar || "").slice(0, 4)) || new Date().getFullYear();

  const [
    penetapan,
    susunan,
    smart,
    hakimAktifSemua,
    paniteraAktifSemua,
    jurusitaSemua,
    paniteraSemua,
    beban,
    bebanMajelis,
    tercatat,
    diblokir,
    rasio,
  ] = await Promise.all([
      penetapanPerkara(identitas.perkaraId),
      susunanMajelisTetap(),
      smartMajelisPerkara(identitas.perkaraId),
      daftarHakimAktif(),
      daftarPaniteraAktif(),
      giliranJurusita(tahun),
      giliranPanitera(tahun, rasioPanitera),
      bebanHakimTunggal(tahun),
      bebanHakimMajelis(tahun),
      majelisTercatat(identitas.perkaraId),
      petugasDiblokir(),
      rasioHakim(),
    ]);

  // ==========================================================================
  // YANG AKUNNYA DIBLOKIR DIKELUARKAN DARI SELURUH KOLAM
  // ==========================================================================
  //
  // Disaring di SATU tempat, sesudah seluruhnya dibaca - bukan di dalam tiap
  // pembacanya. Dengan begitu tidak ada kolam yang tertinggal ketika kelak ada
  // pembaca baru, dan aturannya dapat dibaca sekali saja.
  //
  // Empat dari sebelas panitera aktif berkeadaan begini - lihat catatan pada
  // petugasDiblokir(). Mengusulkan mereka berarti mengusulkan penetapan yang
  // tidak dapat ditandatangani akun mana pun.
  // ==========================================================================
  // RASIO DITEMPELKAN KE TIAP ORANG
  // ==========================================================================
  //
  // Hakim dari Smart Majelis milik SIPP; panitera pengganti dari aturan
  // pengadilan, dicocokkan menurut namanya. Yang tidak punya rasio dianggap
  // 100 - bagian penuh - dan itu ditangani bagianSemestinya, bukan di sini.
  const hakimAktif = hakimAktifSemua
    .filter((x) => !diblokir.hakim.has(Number(x.hakimId)))
    .map((x) => ({ ...x, rasio: rasio.get(Number(x.hakimId)) || 100 }));
  const paniteraAktif = paniteraAktifSemua
    .filter((x) => !diblokir.panitera.has(Number(x.paniteraId)))
    .map((x) => ({ ...x, rasio: porsiPanitera(rasioPanitera, x.nama) }));
  const jurusita = {
    ...jurusitaSemua,
    daftar: (jurusitaSemua.daftar || []).filter((x) => !diblokir.jurusita.has(Number(x.id ?? x.jurusitaId))),
  };
  jurusita.usulan =
    jurusita.daftar.find((x) => x === jurusitaSemua.usulan) || jurusita.daftar[0] || null;
  const panitera = {
    ...paniteraSemua,
    daftar: (paniteraSemua.daftar || [])
      .filter((x) => !diblokir.panitera.has(Number(x.id ?? x.paniteraId)))
      .map((x) => ({ ...x, rasio: porsiPanitera(rasioPanitera, x.nama) })),
  };
  panitera.usulan =
    panitera.daftar.find((x) => x === paniteraSemua.usulan) || panitera.daftar[0] || null;

  // Susunan yang benar-benar dipakai - menuntut daftar hakim aktif, jadi
  // dibaca sesudahnya, bukan bersamaan.
  const terpakai = await susunanMajelisTerpakai(tahun, hakimAktif);

  const bentuk = tentukanSusunan(identitas, aturan);

  // --- PMH ----------------------------------------------------------------
  const namaHakim = new Map(hakimAktif.map((x) => [x.hakimId, x]));
  const pmh = susunPmh({
    bentuk,
    smart,
    susunan,
    hakimAktif,
    namaHakim,
    beban,
    bebanMajelis,
    susunanTerpakai: terpakai.susunan,
    aturan,
  });

  // --- PPP ----------------------------------------------------------------
  //
  // Dua jalan, dan yang berlaku dipilih dari kenyataan pengadilan:
  //
  //   1. Bila SK menautkan panitera pengganti ke majelis ini (kolom
  //      panitera_kode terisi), pakai itu - tautan resmi mengalahkan giliran.
  //
  //   2. Bila tidak - dan di PA Donggala memang tidak, panitera bergilir
  //      seperti juru sita - usulkan yang paling sedikit bebannya. Nama panitera
  //      yang DITAMPILKAN tetap seluruh calon aktif, terurut giliran, supaya
  //      Panitera dapat menimpa bila ada yang berhalangan.
  const kodePp = pmh.majelisKode ? paniteraMajelis[pmh.majelisKode] || [] : [];
  const calonSk = paniteraAktif.filter((x) => x.kode && kodePp.includes(x.kode));
  const ppp =
    calonSk.length > 0
      ? {
          usulan: calonSk[0] || null,
          calon: calonSk,
          sebab: `panitera pengganti Majelis ${pmh.majelisKode} menurut SK`,
          terbaca: true,
        }
      : {
          usulan: panitera.usulan,
          calon: panitera.terbaca ? panitera.daftar : paniteraAktif,
          // Alasan pemilihan SELALU disebut lebih dulu. Sebelumnya peringatan
          // berhalangan menggantikannya sama sekali - dan itu justru menimpa
          // orang yang dipilih KARENA kurang bebannya, sehingga yang terbaca
          // hanya kecurigaan tanpa alasan pilihannya.
          sebab: panitera.terbaca
            ? `giliran panitera pengganti - ${sebutKeadilan(panitera.usulan)}`
            : "seluruh panitera aktif ditampilkan",
          peringatan:
            panitera.usulan && panitera.usulan.dugaanBerhalangan
              ? `${panitera.usulan.nama} sudah lama tidak menerima penunjukan - pastikan tidak sedang berhalangan.`
              : "",
          terbaca: panitera.terbaca,
        };

  // --- PJS ----------------------------------------------------------------
  const pjs = {
    usulan: jurusita.usulan,
    calon: jurusita.daftar,
    sebab: jurusita.terbaca ? `giliran juru sita - ${sebutKeadilan(jurusita.usulan)}` : "",
    peringatan:
      jurusita.usulan && jurusita.usulan.dugaanBerhalangan
        ? `${jurusita.usulan.nama} sudah lama tidak menerima panggilan - pastikan tidak sedang berhalangan.`
        : "",
    terbaca: jurusita.terbaca,
    alasan: jurusita.alasan,
  };

  // --- PHS ----------------------------------------------------------------
  const hariMajelis = pmh.majelisKode !== "" ? hariSidang[pmh.majelisKode] : undefined;
  const jeda = Number(aturan.jedaMinimalHari) || 0;
  const tanggalSidang =
    hariMajelis === undefined
      ? ""
      : tanggalSidangPertama(identitas.tanggalDaftar, Number(hariMajelis), jeda);

  const phs = {
    usulan: tanggalSidang,
    sebut: tanggalSidang ? sebutTanggal(tanggalSidang) : "",
    sebab: tanggalSidang
      ? `hari sidang Majelis ${pmh.majelisKode}, sekurangnya ${jeda} hari sesudah pendaftaran`
      : pmh.majelisKode
        ? `hari sidang Majelis ${pmh.majelisKode} belum diatur di ALETA`
        : "menunggu majelisnya ditentukan lebih dulu",
    jarakHari:
      tanggalSidang && identitas.tanggalDaftar
        ? Math.round(
            (new Date(`${tanggalSidang}T00:00:00`) -
              new Date(`${identitas.tanggalDaftar}T00:00:00`)) /
              86400000
          )
        : 0,
    /**
     * ======================================================================
     * TANGGAL LAIN YANG MASIH SAH - SUPAYA PHS PUN DAPAT DIPILIH
     * ======================================================================
     *
     * Sebelumnya PHS hanya berisi satu tanggal, tanpa alternatif, sehingga
     * papan tidak punya apa pun untuk ditawarkan pada cara manual. Padahal
     * PHS-lah yang paling sering perlu digeser: majelisnya berhalangan, atau
     * hari itu sudah terlalu penuh.
     *
     * Yang ditawarkan hanya hari sidang majelis itu sendiri - pekan ini dan
     * tiga pekan sesudahnya. Menawarkan hari sembarang akan menghasilkan
     * penetapan hari sidang pada hari majelis itu tidak bersidang, dan itu
     * bukan kelonggaran, itu kekeliruan.
     *
     * Yang lebih awal dari usulan TIDAK ditawarkan: usulan sudah merupakan
     * hari sidang terdekat yang memenuhi jeda minimal menurut SK, dan
     * memajukannya berarti melanggar jeda itu.
     */
    calon: tanggalSidang
      ? [0, 7, 14, 21]
          .map((maju) => {
            const iso = geserHari(tanggalSidang, maju);
            if (!iso) return null;
            return {
              tanggal: iso,
              sebut: sebutTanggal(iso),
              usulan: maju === 0,
              pekan: maju / 7,
              // Diisi sesudah seluruh calonnya tersusun - lihat di bawah.
              jumlahSidang: null,
            };
          })
          .filter(Boolean)
      : [],
  };

  // Beban tiap tanggal calon. Dibaca sesudah calonnya tersusun, dalam satu
  // kueri untuk seluruh tanggal - lihat jumlahSidangPerTanggal().
  //
  // Gagal membaca meninggalkan jumlahSidang bernilai null, dan layar
  // menampilkan tanggalnya tanpa angka beban. Itu jawaban yang benar: "tidak
  // tahu" bukan "kosong", dan tanggal yang tampak lengang padahal penuh akan
  // menumpuk sidang justru pada hari yang paling sibuk.
  if (phs.calon.length > 0) {
    const beban = await jumlahSidangPerTanggal(phs.calon.map((x) => x.tanggal));
    for (const satu of phs.calon) {
      const angka = beban.get(satu.tanggal);
      satu.jumlahSidang = angka === undefined ? null : angka;
    }
  }

  /**
   * Tanggal penetapan keempatnya.
   *
   * Kalau PMH sudah pernah ditetapkan, tanggal itu yang dipakai - keempatnya
   * memang setanggal, dan menetapkan PPP hari ini untuk PMH pekan lalu akan
   * menyalahi pola yang selama ini dijalankan. Kalau belum ada sama sekali,
   * hari ini.
   */
  const tanggalPenetapan = penetapan.pmh || isoTanggal(new Date());

  /**
   * Majelis yang SUDAH tercatat, terpisah dari yang diusulkan.
   *
   * Selama PMH belum tersimpan daftarnya kosong, dan itu jawaban yang benar -
   * bukan kekurangan data. Yang membacanya (perakit rencana penetapan) memakai
   * ketua di sini untuk menentukan akun pelaksana PHS; selama belum ada, PHS
   * memang belum dapat dipastikan atas nama siapa.
   */
  const ketuaTercatat = ketuaMajelisTercatat(tercatat);

  return {
    ok: true,
    perkara: identitas,
    penetapan,
    tanggalPenetapan,
    bentuk,
    pmh,
    ppp,
    pjs,
    phs,
    tercatat: {
      ada: tercatat.length > 0,
      ketuaHakimId: ketuaTercatat ? ketuaTercatat.hakimId : 0,
      ketuaNama: ketuaTercatat ? ketuaTercatat.nama : "",
      hakim: tercatat,
    },
    sk: susunan.terbaca
      ? {
          nomor: susunan.majelis.find((x) => x.nomorSk)?.nomorSk || "",
          tanggal: susunan.majelis.find((x) => x.tanggalSk)?.tanggalSk || "",
        }
      : { nomor: "", tanggal: "" },
  };
}

/**
 * Baris PMH: satu nama bila hakim tunggal, tiga bila bermajelis.
 *
 * Hakim tunggal untuk ekonomi syariah tidak memakai hitungan "paling sedikit"
 * sama sekali: yang boleh hanya hakim yang duduk pada majelis berkompetensi
 * ekonomi syariah, dan sejauh ini hanya satu orang. Hitungan atas kolam satu
 * orang bukan hitungan, dan menampilkannya seolah ada pilihan hanya
 * menyesatkan.
 */
/**
 * Menyebut ALASAN pilihan dalam satuan perkara, bukan sebagai skor.
 *
 * "kurang 39 perkara dari bagiannya" dapat dibantah oleh yang membacanya;
 * "skor 0,73" tidak. Bagi yang baru bertugas, masa kerjanya ikut disebut -
 * tanpa itu angka bagiannya yang kecil tampak seperti kekeliruan.
 */
function sebutKeadilan(orang) {
  if (!orang) return "belum ada yang dapat diusulkan";
  const selisih = Number(orang.selisih);
  if (!Number.isFinite(selisih)) return "paling sedikit bebannya tahun ini";

  const masa = orang.baruBertugas ? `, baru bertugas ${orang.hariBertugas} hari` : "";
  const punya = `punya ${orang.jumlah} perkara`;
  const semestinya = `semestinya ${orang.semestinya}`;

  if (selisih < 0) return `${punya}, ${semestinya} - kurang ${Math.abs(selisih)}${masa}`;
  if (selisih > 0) return `${punya}, ${semestinya} - lebih ${selisih}${masa}`;
  return `${punya}, tepat sebanyak bagiannya${masa}`;
}

function susunPmh({
  bentuk,
  smart,
  susunan,
  hakimAktif,
  namaHakim,
  beban,
  bebanMajelis,
  susunanTerpakai,
  aturan,
}) {
  const dasar = {
    bentuk: bentuk.bentuk,
    sebab: bentuk.sebab,
    perluNilai: Boolean(bentuk.perluNilai),
    majelisKode: "",
    anggota: [],
    calon: hakimAktif,
    hitungan: [],
    susunanTerpakai: [],
  };

  if (bentuk.bentuk === "belum-tentu") return dasar;

  // ---- bermajelis: mengikuti usulan smart majelis milik SIPP --------------
  if (bentuk.bentuk === "majelis") {
    /**
     * ======================================================================
     * KOLAMNYA IKUT DIKIRIM, WALAU USULANNYA DARI SMART MAJELIS
     * ======================================================================
     *
     * Sebelumnya cabang ini memulangkan hitungan KOSONG, dan papan hanya
     * menggambar dropdown bila hitungannya lebih dari satu. Akibatnya perkara
     * bermajelis - yaitu hampir seluruh perkara di pengadilan ini - tidak
     * pernah punya pilihan hakim sama sekali, walau cara MANUAL dinyalakan.
     *
     * Yang dikirim di sini bukan usulan tandingan: usulan tetap milik smart
     * majelis SIPP, dan tetap digambar lebih dulu. Yang ditambahkan hanya
     * bahan untuk memilih yang lain - lima hakim aktif beserta beban majelis
     * masing-masing, supaya penyimpangan dari usulan adalah keputusan yang
     * berdasar, bukan tebakan.
     *
     * Bebannya beban MAJELIS, bukan beban hakim tunggal. Hakim yang setahun
     * ini duduk pada 271 majelis akan tampak berbeban nol bila yang dipakai
     * hitungan hakim tunggal.
     */
    const hitunganMajelis = hakimAktif
      .map((orang) => ({
        ...orang,
        jumlah: (bebanMajelis && bebanMajelis.get(orang.hakimId)) || 0,
      }))
      .sort((a, b) => a.jumlah - b.jumlah || a.hakimId - b.hakimId);

    if (!smart.ada) {
      return {
        ...dasar,
        sebab: `${bentuk.sebab} - ${smart.alasan}`,
        hitungan: hitunganMajelis,
        susunanTerpakai,
      };
    }
    const anggota = smart.hakimId.map((id) => {
      const orang = namaHakim.get(id);
      return {
        hakimId: id,
        kode: orang ? orang.kode : "",
        nama: orang ? orang.nama : `hakim_id ${id}`,
        aktif: Boolean(orang),
      };
    });
    return {
      ...dasar,
      majelisKode: anggota.length > 0 ? anggota[0].kode : "",
      anggota,
      hitungan: hitunganMajelis,
      susunanTerpakai,
      sebab: smart.diganti
        ? "usulan smart majelis, memakai penggantinya"
        : "usulan smart majelis",
      keterangan: smart.keterangan,
    };
  }

  // ---- hakim tunggal ------------------------------------------------------
  let kolam = hakimAktif;

  // ==========================================================================
  // EKONOMI SYARIAH: YANG BERSERTIFIKAT LEBIH DAHULU
  // ==========================================================================
  //
  // Dua jalan, dan yang kedua yang sebenarnya berlaku di sini.
  //
  //   1. Kompetensi majelis pada ref_majelis_tetap. Cara yang paling resmi -
  //      tetapi tabel itu KOSONG di pengadilan ini: 106 baris, nol yang aktif.
  //      Jadi cabang ini tidak pernah berjalan, dan itulah sebabnya perkara
  //      ekonomi syariah selama ini diusulkan kepada siapa saja.
  //
  //   2. Daftar kode hakim bersertifikat pada aturan penunjukan. Sejauh ini
  //      satu orang - Himawan Tatura Wijaya, C1. Ditulis sebagai KODE, bukan
  //      nama: nama berubah ejaannya antar tabel, kode tidak.
  //
  // Daftar yang kosong TIDAK mengosongkan usulan. Ia kembali ke seluruh hakim
  // aktif, sebab daftar kosong berarti "belum diisi" - bukan "tidak ada yang
  // bersertifikat". Mengosongkan usulan atas daftar yang belum diisi membuat
  // yang membacanya mengira ALETA rusak.
  //
  // Yang tidak bersertifikat tetap dapat dipilih MANUAL. Yang dibatasi
  // usulannya, bukan haknya - persis seperti Ketua dan Wakil pada kolam hakim
  // tunggal.
  if (bentuk.ekonomiSyariah && susunan.terbaca) {
    const berwenang = new Set();
    for (const majelis of susunan.majelis) {
      if (!/ekonomi\s*syari/i.test(majelis.kompetensiNama)) continue;
      for (const orang of majelis.anggota) berwenang.add(orang.hakimId);
    }
    if (berwenang.size > 0) {
      kolam = hakimAktif.filter((x) => berwenang.has(x.hakimId));
    }
  }

  if (bentuk.ekonomiSyariah) {
    const kode = (aturan.sertifikatEkonomiSyariah || [])
      .map((x) => String(x || "").trim().toUpperCase())
      .filter(Boolean);
    if (kode.length > 0) {
      const bersertifikat = kolam.filter((x) => kode.includes(String(x.kode || "").toUpperCase()));
      if (bersertifikat.length > 0) kolam = bersertifikat;
    }
  }

  // Ketua dan Wakil digugurkan selama saklarnya di kedudukan "hakim". Kode
  // majelisnya yang membedakan: A dan B dipegang Ketua dan Wakil, C dipegang
  // hakim. Keduanya tetap dapat dipilih manual - yang digugurkan usulannya,
  // bukan haknya.
  if (aturan.kolamHakimTunggal !== "ketua-wakil") {
    const tanpaPimpinan = kolam.filter((x) => /^C/i.test(x.kode));
    if (tanpaPimpinan.length > 0) kolam = tanpaPimpinan;
  }

  // Bagian yang semestinya, sama seperti panitera pengganti dan juru sita.
  // Hakim yang baru bertugas tidak dikejar menyusul beban setahun penuh -
  // hakim_pn menyimpan tanggal mulainya sendiri, jadi masa kerjanya terbaca
  // langsung tanpa dikira-kira.
  const bagianTunggal = bagianSemestinya({
    orang: kolam.map((orang) => ({
      id: orang.hakimId,
      mulai: orang.mulai,
      rasio: orang.rasio,
      jumlah: beban.get(orang.hakimId) || 0,
    })),
    tanggalPenetapan: Array.isArray(beban.tanggal) ? beban.tanggal : [],
    sekarang: new Date(),
    awalTahun: `${new Date().getFullYear()}-01-01`,
  });

  const hitungan = kolam
    .map((orang) => {
      const adil = bagianTunggal.get(orang.hakimId) || {
        semestinya: 0,
        selisih: 0,
        baruBertugas: false,
        hariBertugas: 0,
      };
      return {
        ...orang,
        jumlah: beban.get(orang.hakimId) || 0,
        semestinya: Math.round(adil.semestinya),
        selisih: Math.round(adil.selisih),
        baruBertugas: adil.baruBertugas,
        hariBertugas: adil.hariBertugas,
        _selisih: adil.selisih,
      };
    })
    .sort((a, b) => a._selisih - b._selisih || a.hakimId - b.hakimId);

  const terpilih = hitungan[0] || null;

  return {
    ...dasar,
    majelisKode: terpilih ? terpilih.kode : "",
    anggota: terpilih
      ? [{ hakimId: terpilih.hakimId, kode: terpilih.kode, nama: terpilih.nama, aktif: true }]
      : [],
    hitungan,
    sebab:
      hitungan.length === 1
        ? `${bentuk.sebab} - satu-satunya hakim yang berwenang`
        : `${bentuk.sebab} - ${sebutKeadilan(terpilih)}`,
  };
}

/**
 * ============================================================================
 * PEMERIKSAAN BALIK: APAKAH YANG DIISIKAN BENAR-BENAR TERCATAT
 * ============================================================================
 *
 * Mengisi borang tidak sama dengan tercatat. Petugas dapat membatalkan, SIPP
 * dapat menolak, dan sambungan dapat putus di tengah.
 *
 * Tanpa pembacaan ulang, catatan pengisian hanya membuktikan ALETA mengetik -
 * bukan membuktikan pengadilan mencatat. Bedanya bukan soal kerapian: yang
 * pertama tidak dapat dipakai menjawab pertanyaan apa pun tentang perkara,
 * sedangkan yang kedua dapat.
 *
 * Yang dibaca perkara_penetapan, sebab di sanalah keempat tanggal dan
 * ringkasan siapa yang ditunjuk tersimpan pada SATU baris.
 */
/**
 * Majelis yang benar-benar tercatat pada perkara ini.
 *
 * Dibaca dari perkara_hakim_pn yang aktif - bukan dari ringkasan pada
 * perkara_penetapan. Ringkasan itu disusun SIPP dari tabel ini, dan
 * membacanya berarti memeriksa salinan alih-alih aslinya.
 */
async function majelisTercatat(perkaraId) {
  const rows = await runQuery(
    `SELECT hp.hakim_id AS hakimId, hp.hakim_nama AS nama, hp.urutan AS urutan,
            hp.jabatan_hakim_id AS jabatanId
       FROM perkara_hakim_pn hp
      WHERE hp.perkara_id = ? AND hp.aktif = 'Y' AND hp.tahapan_id = ?
      ORDER BY hp.urutan ASC`,
    [perkaraId, TAHAPAN_TINGKAT_PERTAMA]
  ).catch(() => []);

  return rows.map((row) => ({
    hakimId: Number(row.hakimId) || 0,
    nama: cleanText(row.nama),
    jabatanId: Number(row.jabatanId) || 0,
  }));
}

/**
 * Ketua majelis yang TERCATAT pada perkara ini - bukan yang diusulkan.
 *
 * ============================================================================
 * MENGAPA INI TIDAK BOLEH DITEBAK DARI USULAN
 * ============================================================================
 *
 * PHS dikerjakan ketua majelis perkara itu, dengan akun SIPP-nya sendiri.
 * Sampai PMH tersimpan, ketuanya memang belum ada - yang ada baru usulan, dan
 * usulan boleh berubah: majelisnya diganti sebelum ditetapkan, hakimnya
 * berhalangan, isbat terpadu memakai susunan lain. Menebaknya dari usulan
 * berarti PHS dikerjakan atas nama hakim yang tidak pernah ditetapkan.
 *
 * Yang menandai ketua adalah jabatan_hakim_id = 1. Dua keadaan lain
 * disediakan jalannya: perkara hakim tunggal yang barisnya hanya satu, dan
 * pemasangan yang tidak mengisi jabatan_hakim_id sama sekali - di situ
 * urutan pertama yang dipakai, sebab itulah yang ditulis SIPP lebih dulu.
 */
function ketuaMajelisTercatat(tercatat) {
  const daftar = Array.isArray(tercatat) ? tercatat.filter((x) => x.hakimId > 0) : [];
  if (daftar.length === 0) return null;

  // Urutan pertama menjawab kedua keadaan sisa sekaligus: hakim tunggal yang
  // barisnya memang hanya satu, dan pemasangan yang jabatan_hakim_id-nya kosong.
  return daftar.find((x) => x.jabatanId === 1) || daftar[0];
}

/**
 * ============================================================================
 * PMH HARUS SEPAKAT DENGAN SMART MAJELIS
 * ============================================================================
 *
 * SIPP menyusun usulan majelisnya sendiri di perkara_smartmajelis, dan itulah
 * yang menjadi dasar penetapan. Majelis yang tercatat pada perkara_hakim_pn
 * seharusnya sama dengan usulan itu.
 *
 * Bila keduanya berbeda, salah satu dari dua hal terjadi: penetapannya
 * menyimpang dari smart majelis - yang sah, dan memang terjadi pada isbat
 * terpadu, sidang keliling, atau hakim yang berhalangan - atau pengisiannya
 * mengenai hakim yang salah.
 *
 * Keduanya tidak dapat dibedakan dari sini, dan karena itu yang dikembalikan
 * KETERANGAN, bukan vonis. Menyatakannya keliru akan menyalakan peringatan
 * atas penyimpangan yang justru disengaja; mendiamkannya akan melewatkan
 * pengisian yang benar-benar salah.
 */
async function cocokSmartMajelis(perkaraId) {
  const [smart, tercatat, hakim] = await Promise.all([
    smartMajelisPerkara(perkaraId),
    majelisTercatat(perkaraId),
    daftarHakimAktif(),
  ]);

  if (!smart.ada) {
    return { terbaca: false, alasan: smart.alasan, cocok: null };
  }
  if (tercatat.length === 0) {
    return { terbaca: true, alasan: "majelis_belum_ditetapkan", cocok: null, usulan: smart.hakimId };
  }

  const nama = new Map(hakim.map((x) => [x.hakimId, x.nama]));
  const diusulkan = smart.hakimId.slice().sort((a, b) => a - b);
  const dicatat = tercatat.map((x) => x.hakimId).sort((a, b) => a - b);

  const sama =
    diusulkan.length === dicatat.length &&
    diusulkan.every((id, i) => id === dicatat[i]);

  return {
    terbaca: true,
    alasan: "",
    cocok: sama,
    usulan: smart.hakimId.map((id) => nama.get(id) || `hakim_id ${id}`),
    tercatat: tercatat.map((x) => x.nama || `hakim_id ${x.hakimId}`),
    keteranganSmart: smart.keterangan,
    // Penyimpangan yang SAH punya keterangan pada smart majelis - isbat
    // terpadu, sidang keliling, hakim berhalangan. Yang tanpa keterangan
    // lebih patut diperiksa.
    berketerangan: Boolean(smart.keterangan),
  };
}

async function periksaPengisian(nomorPerkara, harapan = {}) {
  const identitas = await identitasPerkara(nomorPerkara);
  if (!identitas) {
    return { ok: false, alasan: "perkara_tidak_ketemu", mendarat: "tidak" };
  }

  const penetapan = await penetapanPerkara(identitas.perkaraId);
  if (!penetapan.ada) {
    return {
      ok: true,
      mendarat: "tidak",
      alasan: "belum ada baris penetapan untuk perkara ini",
      penetapan,
    };
  }

  // Tiap penetapan diperiksa sendiri-sendiri, sebab pengisian dapat berhasil
  // sebagian - PMH tercatat, PPP gagal - dan menyatakannya gagal seluruhnya
  // akan menyembunyikan yang sudah benar.
  const rinci = [];
  for (const jenis of ["pmh", "ppp", "pjs", "phs"]) {
    const diharap = harapan[jenis];
    if (!diharap) continue;
    const tercatat = penetapan[jenis] || "";
    rinci.push({ jenis, diharap: String(diharap), tercatat, cocok: tercatat === String(diharap) });
  }

  const cocok = rinci.filter((x) => x.cocok).length;
  const mendarat =
    rinci.length === 0 ? "tidak" : cocok === rinci.length ? "ya" : cocok > 0 ? "sebagian" : "tidak";

  // Dijalankan hanya ketika PMH termasuk yang diperiksa - membacanya pada
  // pemeriksaan PPP atau PJS hanya menambah dua kueri tanpa menjawab apa pun.
  const smartMajelis = harapan.pmh ? await cocokSmartMajelis(identitas.perkaraId) : null;

  return {
    ok: true,
    mendarat,
    alasan: "",
    rinci,
    penetapan,
    smartMajelis,
    // Ringkasan yang dapat dibaca manusia, disimpan bersama catatannya.
    tercatat: rinci.map((x) => `${x.jenis}=${x.tercatat || "kosong"}`).join(" "),
  };
}

module.exports = {
  KELIPATAN_DUGAAN_BERHALANGAN,
  bagianSemestinya,
  TAHAPAN_TINGKAT_PERTAMA,
  bebanHakimTunggal,
  bebanHakimMajelis,
  susunanMajelisTerpakai,
  daftarHakimAktif,
  daftarPaniteraAktif,
  geserHari,
  giliranJurusita,
  giliranPanitera,
  identitasPerkara,
  penetapanPerkara,
  cocokSmartMajelis,
  ketuaMajelisTercatat,
  majelisTercatat,
  periksaPengisian,
  smartMajelisPerkara,
  susunanMajelisTetap,
  petugasDiblokir,
  rasioHakim,
  jumlahSidangPerTanggal,
  susunPmh,
  tanggalSidangPertama,
  tentukanSusunan,
  usulanPenunjukan,
};
