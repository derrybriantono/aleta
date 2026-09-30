"use strict";

/**
 * ============================================================================
 * JEJAK APLIKASI DAN KETAATAN PENGINPUTAN - SISA BAB 2 DAN BAB 3
 * ============================================================================
 *
 * Sebelas butir dari dua bab yang berbeda, disatukan dalam satu berkas karena
 * seluruhnya bersandar pada hal yang sama: JEJAK WAKTU dan JEJAK PERUBAHAN
 * yang dicatat SIPP tentang dirinya sendiri - diinput_tanggal,
 * diperbaharui_tanggal, dan tabel sys_audittrail.
 *
 * Memecahnya menjadi dua berkas menurut nomor bab akan memisahkan kode yang
 * membaca kolom yang sama dengan aturan yang sama, dan dua tempat yang
 * membaca kolom yang sama akan lambat laun membacanya berbeda.
 *
 * ============================================================================
 * SELURUHNYA PERTANYAAN, TIDAK SATU PUN TUDUHAN
 * ============================================================================
 *
 * Ini harus dipegang siapa pun yang menyentuh berkas ini, sebab bahannya -
 * siapa mengetik apa dan kapan - adalah bahan yang paling mudah dipakai
 * menyalahkan orang.
 *
 * Relaas yang diinput seminggu setelah dilaksanakan bukan relaas palsu:
 * jurusita yang berangkat ke tiga kecamatan dalam sehari memang baru kembali
 * ke kantor keesokan lusa. Putusan yang diubah setelah berkekuatan hukum tetap
 * bukan pemalsuan: perbaikan salah ketik nama memang boleh dan memang perlu.
 *
 * Yang dikatakan angka-angka ini satu saja - tanggal pada SIPP tidak selalu
 * tanggal peristiwanya, dan berkasnya perlu dibuka sebelum apa pun
 * disimpulkan. Yang menyimpulkan harus manusia yang melihat keadaannya.
 *
 * ============================================================================
 * YANG DITEMUKAN SAAT MENGUKUR
 * ============================================================================
 *
 * Dari 1.298 pelaksanaan relaas, 562 diinput lebih dari tiga hari sesudah
 * dilaksanakan - hampir separuhnya. Seluruh penilaian ketaatan tenggang
 * pemanggilan bersandar pada tanggal relaas, dan tanggal itu diketik dari
 * ingatan pada 562 baris.
 *
 * Empat belas putusan diperbarui SESUDAH berkekuatan hukum tetap.
 *
 * Sebaliknya, jadwal sidang bersih sempurna: tidak satu pun dari 907 jadwal
 * diinput sesudah hari sidangnya. Itu memang yang diharapkan - jadwal dibuat
 * di muka - dan angka bersih itu berguna sebagai pembanding: ia menunjukkan
 * jejak waktu SIPP memang dapat dipercaya ketika perilakunya memang tertib.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

const BATAS_BARIS = 5000;

/** Tenggang wajar antara peristiwa dan pengetikannya, per jenis peristiwa. */
const HARI_WAJAR_INPUT_RELAAS = 3;
const HARI_WAJAR_INPUT_SIDANG = 1;
const HARI_WAJAR_INPUT_MEDIASI = 3;
const HARI_WAJAR_UNGGAH_DIREKTORI = 1;

/** Asas penyelesaian perkara pada peradilan tingkat pertama. */
const HARI_ASAS_PENYELESAIAN = 150;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, hasil) => {
      if (error) reject(error);
      else resolve(Array.isArray(hasil) ? hasil : []);
    });
  });
}

const teks = (n) => String(n == null ? "" : n).trim();
const angka = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};

function tanggalTerisi(nilai) {
  const t = teks(nilai);
  if (!t) return false;
  if (/^0000-00-00/.test(t)) return false;
  return true;
}

function selisihHari(awal, akhir) {
  if (!tanggalTerisi(awal) || !tanggalTerisi(akhir)) return null;
  const a = new Date(awal);
  const b = new Date(akhir);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

function tanggalIso(nilai) {
  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) {
    const b = String(nilai.getMonth() + 1).padStart(2, "0");
    const h = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${b}-${h}`;
  }
  return teks(nilai).slice(0, 10);
}

async function tabelSiap(daftar) {
  for (const t of daftar) {
    const ada = await sippSkemaService.tabelAda(t).catch(() => false);
    if (!ada) return false;
  }
  return true;
}

/**
 * Pembangun butir "peristiwa ini diketik berapa lama sesudah terjadi".
 *
 * Lima butir menanyakan hal yang persis sama atas tabel yang berbeda. Ditulis
 * satu kali sebab lima tempat yang masing-masing menghitung selisih tanggalnya
 * sendiri akan berbeda pada perkara batas - dan perbedaan itu hanya muncul
 * pada satu dua baris, yang tidak akan pernah ditelusuri siapa pun.
 */
function pembangunKetepatanInput(p) {
  return async function baris(rentang) {
    if (!(await tabelSiap(["perkara", p.tabel]))) return [];

    const hasil = await runQuery(
      `SELECT x.${p.kunciBaris}     AS barisId,
              pp.nomor_perkara      AS nomorPerkara,
              pp.jenis_perkara_nama AS jenisPerkara,
              x.${p.ruasPeristiwa}  AS tanggalPeristiwa,
              x.${p.ruasInput}      AS tanggalInput,
              x.${p.ruasPetugas}    AS petugas
         FROM perkara pp
         JOIN ${p.tabel} x ON x.perkara_id = pp.perkara_id
        WHERE pp.tanggal_pendaftaran >= ? AND pp.tanggal_pendaftaran <= ?
          ${p.saring ? `AND ${p.saring}` : ""}
        ORDER BY x.${p.ruasPeristiwa}
        LIMIT ${BATAS_BARIS}`,
      [rentang.mulai, rentang.selesai]
    );

    return hasil
      .filter((x) => tanggalTerisi(x.tanggalPeristiwa))
      .map((x) => {
        const jarak = tanggalTerisi(x.tanggalInput)
          ? selisihHari(x.tanggalPeristiwa, tanggalIso(x.tanggalInput))
          : null;
        const sebab = [];

        if (jarak === null) {
          sebab.push("tidak punya jejak waktu pengetikan - tidak ada yang dapat diperiksa");
        } else if (jarak < 0 && !p.bolehMendahului) {
          sebab.push(
            `diketik ${Math.abs(jarak)} hari SEBELUM peristiwanya - salah satu dari kedua tanggal itu keliru`
          );
        } else if (jarak > p.tenggang) {
          sebab.push(
            `diketik ${jarak} hari sesudah ${p.sebutanPeristiwa}, melampaui tenggang ${p.tenggang} hari. ${p.pembelaan}`
          );
        }

        return {
          kunci: `${p.kode}-${teks(x.barisId)}`,
          nomorPerkara: teks(x.nomorPerkara),
          jenisPerkara: teks(x.jenisPerkara),
          tanggalPeristiwa: tanggalIso(x.tanggalPeristiwa),
          jarakHari: jarak,
          petugas: teks(x.petugas),
          memenuhi: sebab.length === 0,
          sebabTidakMemenuhi: sebab.join("; "),
        };
      });
  };
}

/**
 * ============================================================================
 * IN02 - PUTUSAN DIUBAH SESUDAH BERKEKUATAN HUKUM TETAP
 * ============================================================================
 *
 * Sesudah tenggang upaya hukum lewat, putusan tidak lagi dapat diubah isinya.
 * Perbaikan salah ketik masih boleh - dan memang perlu - tetapi jalannya
 * penetapan perbaikan, bukan pengeditan diam-diam.
 *
 * Yang diperiksa jejak diperbaharui_tanggal terhadap tanggal_bht. Ini
 * PERTANYAAN: pengeditan itu mungkin memang perbaikan nama yang salah ketik,
 * dan mungkin pula bukan. Berkasnya perlu dibuka.
 *
 * Diukur pada SIPP sungguhan: 14 dari 388 putusan diperbarui sesudah
 * berkekuatan hukum tetap.
 */
async function barisPutusanDiubahSesudahBht(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            d.tanggal_bht         AS tanggalBht,
            d.diperbaharui_tanggal AS diperbaharuiTanggal,
            d.diperbaharui_oleh   AS diperbaharuiOleh
       FROM perkara p
       JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND d.tanggal_bht IS NOT NULL AND d.tanggal_bht <> '0000-00-00'
      ORDER BY d.tanggal_bht
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const adaUbah = tanggalTerisi(x.diperbaharuiTanggal);
    const jarak = adaUbah ? selisihHari(x.tanggalBht, tanggalIso(x.diperbaharuiTanggal)) : null;
    const sesudah = jarak !== null && jarak > 0;

    return {
      kunci: `${teks(x.nomorPerkara)}#IN02`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      jarakHari: jarak,
      petugas: teks(x.diperbaharuiOleh),
      memenuhi: !sesudah,
      sebabTidakMemenuhi: sesudah
        ? `barisnya diperbarui ${jarak} hari SESUDAH berkekuatan hukum tetap, oleh ${
            teks(x.diperbaharuiOleh) || "petugas yang tidak tercatat"
          } - mungkin perbaikan salah ketik yang memang perlu, mungkin bukan. Perbaikan sesudah berkekuatan hukum tetap jalannya penetapan perbaikan, bukan pengeditan; berkasnya perlu dibuka sebelum apa pun disimpulkan.`
        : "",
    };
  });
}

/**
 * ============================================================================
 * IN06 - REKAM JEJAK PENGINPUTAN PER APARATUR
 * ============================================================================
 *
 * sys_audittrail mencatat siapa mengubah apa, kapan, dari alamat mana. Yang
 * dinilai di sini apakah catatan itu LENGKAP - baris audit tanpa nama
 * pengguna, tanpa nama tabel, atau tanpa jenis tindakan tidak dapat dipakai
 * menelusuri apa pun.
 *
 * Berbeda dari butir lain di berkas ini, populasinya BUKAN perkara melainkan
 * baris audit itu sendiri, dan disaring menurut waktunya - sebab audit trail
 * tidak punya perkara_id.
 */
async function barisRekamJejakAparatur(rentang) {
  if (!(await tabelSiap(["sys_audittrail"]))) return [];

  const hasil = await runQuery(
    `SELECT a.id        AS auditId,
            a.datetime  AS waktu,
            a.username  AS pengguna,
            a.ipaddress AS alamat,
            a.tablename AS tabel,
            a.action    AS tindakan,
            a.title     AS judul
       FROM sys_audittrail a
      WHERE a.datetime >= ? AND a.datetime <= ?
      ORDER BY a.datetime DESC
      LIMIT ${BATAS_BARIS}`,
    [`${rentang.mulai} 00:00:00`, `${rentang.selesai} 23:59:59`]
  );

  return hasil.map((x) => {
    const sebab = [];
    if (!teks(x.pengguna)) sebab.push("tanpa nama pengguna - perubahannya tidak dapat dipulangkan kepada siapa pun");
    if (!teks(x.tabel)) sebab.push("tanpa nama tabel - tidak diketahui data apa yang berubah");
    if (!teks(x.tindakan)) sebab.push("tanpa jenis tindakan - tidak diketahui ditambah, diubah, atau dihapus");
    if (!teks(x.alamat)) sebab.push("tanpa alamat asal");

    return {
      kunci: `audit-${teks(x.auditId)}`,
      waktu: teks(x.waktu),
      petugas: teks(x.pengguna),
      tabel: teks(x.tabel),
      tindakan: teks(x.tindakan),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * IN10 - PENCOCOKAN SIPP DENGAN ARSIP e-COURT
 * ============================================================================
 *
 * Perkara e-Court hidup di dua tempat: tabel perkara milik SIPP, dan tabel
 * ecourt_* yang disalin dari sistem e-Court pusat. Perkara yang tercatat di
 * satu tempat tetapi hilang di tempat lain berarti penyalinannya gagal - dan
 * kegagalan itu tidak menimbulkan galat apa pun; ia hanya menghasilkan
 * perkara yang tidak ada.
 *
 * Yang diperiksa arah yang berbahaya: perkara yang punya baris e-filing tetapi
 * pihaknya TIDAK tersalin. Perkara e-Court tanpa pihak tidak dapat dipanggil,
 * dan tidak ada yang menyadarinya sampai hari sidang.
 */
async function barisCocokEcourt(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_efiling_id", "perkara_pihak1"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            COUNT(DISTINCT e.efiling_id)  AS jumlahEfiling,
            COUNT(DISTINCT pp.id)         AS jumlahPihak
       FROM perkara p
       JOIN perkara_efiling_id e ON e.perkara_id = p.perkara_id
       LEFT JOIN perkara_pihak1 pp ON pp.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const sebab = [];
    if (angka(x.jumlahPihak) === 0) {
      sebab.push(
        "terdaftar lewat e-Court tetapi tidak punya satu pun baris pihak di SIPP - penyalinannya gagal tanpa menimbulkan error, dan perkara tanpa pihak tidak dapat dipanggil sampai hari sidang tiba"
      );
    }
    if (angka(x.jumlahEfiling) > 1) {
      sebab.push(`punya ${angka(x.jumlahEfiling)} nomor e-filing sekaligus - salah satunya milik perkara lain`);
    }

    return {
      kunci: `${teks(x.nomorPerkara)}#IN10`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * IN14 - JEJAK AUDIT APLIKASI
 * ============================================================================
 *
 * Berbeda dari rekam jejak per aparatur yang menilai kelengkapan tiap BARIS
 * audit, butir ini menilai CAKUPANNYA: tabel tahapan mana yang benar-benar
 * terpantau, dan mana yang berubah tanpa satu pun jejak.
 *
 * Tabel yang tidak pernah muncul pada audit trail adalah tabel yang dapat
 * diubah siapa pun tanpa bekas. Yang paling berbahaya justru tabel yang jarang
 * disentuh - putusan, akta cerai - sebab di sanalah perubahan satu baris
 * paling berarti.
 */
const TABEL_DIPANTAU = [
  "perkara",
  "perkara_putusan",
  "perkara_akta_cerai",
  "perkara_biaya",
  "perkara_jadwal_sidang",
  "perkara_hakim_pn",
  "perkara_panitera_pn",
  "perkara_jurusita",
  "perkara_mediasi",
  "perkara_pelaksanaan_relaas",
];

async function barisJejakAuditAplikasi(rentang) {
  if (!(await tabelSiap(["sys_audittrail"]))) return [];

  const hasil = await runQuery(
    `SELECT a.tablename AS tabel, COUNT(*) AS jumlah
       FROM sys_audittrail a
      WHERE a.datetime >= ? AND a.datetime <= ?
      GROUP BY a.tablename`,
    [`${rentang.mulai} 00:00:00`, `${rentang.selesai} 23:59:59`]
  );

  const hitung = new Map();
  hasil.forEach((x) => {
    hitung.set(teks(x.tabel).toLowerCase(), angka(x.jumlah));
  });

  return TABEL_DIPANTAU.map((t) => {
    const n = hitung.get(t) || 0;

    return {
      kunci: `jejak-${t}`,
      tabel: t,
      jumlahJejak: n,
      memenuhi: n > 0,
      sebabTidakMemenuhi:
        n > 0
          ? ""
          : `tidak ada satu pun jejak audit atas tabel ${t} pada rentang ini - tabel ini dapat diubah siapa pun tanpa bekas, dan justru tabel yang jarang disentuh adalah tempat perubahan satu baris paling berarti`,
    };
  });
}

/**
 * ============================================================================
 * KT13 - PEMBERITAHUAN ISI PUTUSAN
 * ============================================================================
 *
 * Pihak yang TIDAK hadir pada saat putusan diucapkan harus diberitahu isinya -
 * dan tenggang upaya hukumnya baru berjalan sejak pemberitahuan itu. Tanpa
 * pemberitahuan, putusan tidak pernah berkekuatan hukum tetap secara sah,
 * berapa lama pun waktu berlalu.
 *
 * Yang dipakai membaca kehadiran kolom dihadiri_oleh pada sidang terakhir.
 * Sidang yang kehadirannya tidak tercatat tidak dapat dijawab, dan ditandai
 * demikian - bukan dianggap hadir.
 */
async function barisPemberitahuanIsiPutusan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_jadwal_sidang"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            d.tanggal_putusan    AS tanggalPutusan,
            d.tanggal_bht        AS tanggalBht,
            d.pemberitahuan_putusan AS pemberitahuan,
            (SELECT j.dihadiri_oleh FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id
              ORDER BY j.tanggal_sidang DESC, j.id DESC LIMIT 1) AS hadirTerakhir
       FROM perkara p
       JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND d.tanggal_putusan IS NOT NULL AND d.tanggal_putusan <> '0000-00-00'
      ORDER BY d.tanggal_putusan
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const adaCatatanHadir = x.hadirTerakhir !== null && x.hadirTerakhir !== undefined && teks(x.hadirTerakhir) !== "";
    // Hanya nilai 1 yang berarti SEMUA PIHAK hadir; nilai lain berarti ada
    // yang tidak hadir, dan kepada merekalah isi putusan wajib diberitahukan.
    const semuaHadir = adaCatatanHadir && angka(x.hadirTerakhir) === 1;
    const adaPemberitahuan = tanggalTerisi(x.pemberitahuan);
    const sebab = [];

    if (semuaHadir) return {
      kunci: `${teks(x.nomorPerkara)}#KT13`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      memenuhi: true,
      sebabTidakMemenuhi: "",
    };

    if (!adaCatatanHadir) {
      sebab.push(
        "kehadiran pihak pada sidang terakhir tidak tercatat - tidak dapat diketahui apakah pemberitahuan isi putusan wajib atau tidak, dan ketidaktahuan itu bukan berarti hadir"
      );
    } else if (!adaPemberitahuan && !tanggalTerisi(x.tanggalBht)) {
      sebab.push(
        "belum ada tanggal pemberitahuan isi putusan maupun tanggal berkekuatan hukum tetap - tenggang upaya hukum belum berjalan bagi pihak yang tidak hadir"
      );
    }

    return {
      kunci: `${teks(x.nomorPerkara)}#KT13`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * KT17 - PUBLIKASI DIREKTORI PUTUSAN
 * ============================================================================
 *
 * Putusan diunggah ke Direktori Putusan Mahkamah Agung dalam satu hari kerja
 * sejak diucapkan. SIPP mencatat unggahan itu pada tabel dirput_dokumen
 * beserta tanggalnya.
 *
 * Putusan yang tidak punya satu pun baris dirput belum terbit di direktori -
 * dan putusan yang tidak terbit tidak dapat dibaca siapa pun di luar
 * pengadilan, termasuk pihak yang mencarinya sendiri.
 */
async function barisPublikasiDirektori(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "dirput_dokumen"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            d.tanggal_putusan    AS tanggalPutusan,
            MIN(dd.created_date) AS tanggalUnggah,
            COUNT(dd.id)         AS jumlahDokumen
       FROM perkara p
       JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
       LEFT JOIN dirput_dokumen dd ON dd.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND d.tanggal_putusan IS NOT NULL AND d.tanggal_putusan <> '0000-00-00'
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, d.tanggal_putusan
      ORDER BY d.tanggal_putusan
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const adaUnggah = angka(x.jumlahDokumen) > 0 && tanggalTerisi(x.tanggalUnggah);
    const jarak = adaUnggah ? selisihHari(x.tanggalPutusan, x.tanggalUnggah) : null;
    const sebab = [];

    if (!adaUnggah) {
      sebab.push(
        "belum punya satu pun dokumen pada direktori putusan - putusan yang tidak terbit tidak dapat dibaca siapa pun di luar pengadilan, termasuk pihak yang mencarinya sendiri"
      );
    } else if (jarak !== null && jarak > HARI_WAJAR_UNGGAH_DIREKTORI) {
      sebab.push(`diunggah ${jarak} hari sesudah diucapkan, melampaui tenggang ${HARI_WAJAR_UNGGAH_DIREKTORI} hari kerja`);
    }

    return {
      kunci: `${teks(x.nomorPerkara)}#KT17`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      jarakHari: jarak,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * KT19 - KETAATAN SEMA DAN PERMA YANG MELEKAT PADA JENIS PERKARANYA
 * ============================================================================
 *
 * Tiga aturan yang benar-benar dapat diperiksa dari SIPP, masing-masing hanya
 * berlaku pada jenis perkara tertentu:
 *
 *   PERMA 1/2016   perkara yang kedua pihaknya hadir WAJIB melalui mediasi
 *   Pasal 149 KHI  cerai talak yang dikabulkan mempertimbangkan nafkah iddah
 *   Pasal 39 UU 1/1974  perceraian didahului upaya mendamaikan - terbaca dari
 *                       adanya baris mediasi atau agenda sidang mendamaikan
 *
 * Aturan yang TIDAK berlaku pada sebuah perkara tidak dihitung sama sekali -
 * bukan dihitung memenuhi, dan bukan pula gagal. Menghitungnya memenuhi akan
 * menggelembungkan nilai satuan kerja yang perkaranya kebetulan banyak yang
 * dikecualikan.
 *
 * DAFTAR INI TIDAK LENGKAP, dan disebut demikian pada katalog. Menambah aturan
 * ke sini menuntut naskah resminya dibaca lebih dahulu - bukan diingat.
 */
async function barisKetaatanSemaPerma(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const adaMediasi = await sippSkemaService.tabelAda("perkara_mediasi").catch(() => false);

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            d.amar_putusan       AS amar,
            s.nama               AS statusNama,
            ${
              adaMediasi
                ? `(SELECT COUNT(*) FROM perkara_mediasi m WHERE m.perkara_id = p.perkara_id)`
                : "0"
            }                                                     AS jumlahMediasi,
            -- dihadiri_oleh = 1 berarti SEMUA PIHAK hadir. Dibaca dari borang
            -- SIPP sendiri (views/perkara_tab, pilihan "Semua Pihak"), bukan
            -- ditebak. Sempat ditulis ">= 2" dengan sangkaan angka yang lebih
            -- besar berarti lebih banyak pihak - dan kaidah terbalik itu
            -- menuduh 282 perkara melanggar PERMA 1/2016 sebelum tertangkap.
            (SELECT COUNT(*) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id
                AND j.dihadiri_oleh = 1)                           AS sidangKeduaPihak
       FROM perkara p
       JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
       LEFT JOIN status_putusan s ON s.id = d.status_putusan_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND d.tanggal_putusan IS NOT NULL AND d.tanggal_putusan <> '0000-00-00'
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  const KATA_NAFKAH = /(nafkah|iddah|'iddah|idah|mut'?ah|mutah|madliyah|madhiyah|kiswah|maskan)/i;
  const polos = (h) =>
    teks(h)
      .replace(/<[^>]*>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  return hasil
    .map((x) => {
      const jenis = teks(x.jenisPerkara);
      const status = teks(x.statusNama);
      const berlaku = [];
      const langgar = [];

      // PERMA 1/2016 - mediasi wajib bila kedua pihak hadir.
      if (angka(x.sidangKeduaPihak) > 0) {
        berlaku.push("PERMA 1/2016 mediasi wajib");
        if (angka(x.jumlahMediasi) === 0) {
          langgar.push("kedua pihak pernah hadir bersama tetapi tidak ada satu pun baris mediasi");
        }
      }

      // Pasal 149 KHI - nafkah iddah dan mut'ah pada cerai talak yang dikabulkan.
      if (/talak/i.test(jenis) && /kabul/i.test(status)) {
        berlaku.push("Pasal 149 KHI nafkah iddah dan mut'ah");
        if (!KATA_NAFKAH.test(polos(x.amar))) {
          langgar.push("cerai talak dikabulkan tetapi amarnya belum menyebut nafkah, iddah, atau mut'ah");
        }
      }

      // Pasal 39 UU 1/1974 - perceraian didahului upaya mendamaikan.
      if (/erai/i.test(jenis)) {
        berlaku.push("Pasal 39 UU 1/1974 upaya mendamaikan");
        if (angka(x.jumlahMediasi) === 0 && angka(x.sidangKeduaPihak) === 0) {
          berlaku.pop();
        }
      }

      if (berlaku.length === 0) return null;

      return {
        kunci: `${teks(x.nomorPerkara)}#KT19`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: jenis,
        aturanBerlaku: berlaku.join("; "),
        memenuhi: langgar.length === 0,
        sebabTidakMemenuhi: langgar.length
          ? `${langgar.join(
              "; "
            )}. Dihitung dari data SIPP dan pencarian kata pada amar - pantas ditanyakan, bukan terbukti melanggar.`
          : "",
      };
    })
    .filter(Boolean);
}

/**
 * ============================================================================
 * KT20 - NILAI GABUNGAN KETAATAN SK DIRJEN BADILAG 048/2024
 * ============================================================================
 *
 * Satu baris satu perkara, menggabungkan empat ketaatan penginputan yang
 * masing-masing sudah dinilai butir tersendiri. Gunanya bukan menambah
 * keterangan baru melainkan menjawab satu pertanyaan yang tidak dapat dijawab
 * butir mana pun sendirian: berapa perkara yang SELURUH tahapannya tertib.
 *
 * SK Dirjen menyebut dua puluh sembilan butir dan tiga keadaan - tepat,
 * terlambat, dan tidak diinput. Yang dibangun di sini baru empat butir, dan
 * hanya dua keadaan. Katalog menyebutnya demikian, dan angkanya tidak boleh
 * dilaporkan sebagai nilai SK Dirjen yang utuh.
 */
async function barisGabunganKetaatan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_jadwal_sidang"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            (SELECT COUNT(*) FROM perkara_pelaksanaan_relaas r
              WHERE r.perkara_id = p.perkara_id
                AND r.tanggal_relaas IS NOT NULL
                AND r.diinput_tanggal IS NOT NULL
                AND DATEDIFF(DATE(r.diinput_tanggal), r.tanggal_relaas) > ${HARI_WAJAR_INPUT_RELAAS})
                                                                        AS relaasTerlambat,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id
                AND j.diinput_tanggal IS NOT NULL
                AND DATEDIFF(DATE(j.diinput_tanggal), j.tanggal_sidang) > ${HARI_WAJAR_INPUT_SIDANG})
                                                                        AS sidangTerlambat,
            (SELECT COUNT(*) FROM perkara_mediasi m
              WHERE m.perkara_id = p.perkara_id
                AND m.keputusan_mediasi IS NOT NULL
                AND m.diinput_tanggal IS NOT NULL
                AND DATEDIFF(DATE(m.diinput_tanggal), m.keputusan_mediasi) > ${HARI_WAJAR_INPUT_MEDIASI})
                                                                        AS mediasiTerlambat,
            (SELECT COUNT(*) FROM perkara_putusan d
              WHERE d.perkara_id = p.perkara_id
                AND d.tanggal_putusan IS NOT NULL
                AND d.tanggal_minutasi IS NULL)                          AS minutasiBelum
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const sebab = [];
    if (angka(x.relaasTerlambat) > 0) sebab.push(`${angka(x.relaasTerlambat)} relaas diinput terlambat`);
    if (angka(x.sidangTerlambat) > 0) sebab.push(`${angka(x.sidangTerlambat)} jadwal sidang diinput terlambat`);
    if (angka(x.mediasiTerlambat) > 0) sebab.push(`${angka(x.mediasiTerlambat)} keputusan mediasi diinput terlambat`);
    if (angka(x.minutasiBelum) > 0) sebab.push("sudah diputus tetapi belum diminutasi");

    return {
      kunci: `${teks(x.nomorPerkara)}#KT20`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.length
        ? `${sebab.join(
            "; "
          )}. Gabungan EMPAT butir dari dua puluh sembilan yang disebut SK Dirjen - angkanya tidak boleh dilaporkan sebagai nilai SK Dirjen yang utuh.`
        : "",
    };
  });
}

/** Sebelas butir: empat dari Bab 2, tujuh dari Bab 3. */
const BUTIR = [
  {
    kode: "IN02",
    kunci: "putusanDiubahSesudahBht",
    judul: "Perubahan Putusan Setelah Berkekuatan Hukum Tetap",
    keterangan:
      "Sesudah tenggang upaya hukum lewat, putusan tidak lagi dapat diubah isinya - perbaikan salah ketik masih boleh dan memang perlu, tetapi jalannya penetapan perbaikan, bukan pengeditan diam-diam. Ini PERTANYAAN: pengeditannya mungkin memang perbaikan nama yang salah ketik, dan mungkin pula bukan; berkasnya perlu dibuka.",
    baris: barisPutusanDiubahSesudahBht,
    pembilang: "Putusan berkekuatan hukum tetap yang barisnya tidak diperbarui sesudah tanggal itu",
    penyebut: "Seluruh putusan berkekuatan hukum tetap atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_putusan - jejak perubahan milik SIPP sendiri",
    ruas: "tanggal_bht, diperbaharui_tanggal, diperbaharui_oleh",
  },
  {
    kode: "IN06",
    kunci: "rekamJejakPenginputanAparatur",
    judul: "Rekam Jejak Penginputan per Aparatur",
    keterangan:
      "sys_audittrail mencatat siapa mengubah apa, kapan, dari alamat mana. Yang dinilai apakah catatan itu LENGKAP - baris audit tanpa nama pengguna, tanpa nama tabel, atau tanpa jenis tindakan tidak dapat dipakai menelusuri apa pun. Populasinya BUKAN perkara melainkan baris audit itu sendiri, disaring menurut waktunya, sebab audit trail tidak punya perkara_id.",
    baris: barisRekamJejakAparatur,
    pembilang: "Baris audit yang menyebut pengguna, tabel, tindakan, dan alamat asalnya",
    penyebut: "Seluruh baris audit yang tercatat pada rentang ini",
    tabel: "sys_audittrail - berdiri sendiri, tidak disambung ke tabel perkara",
    ruas: "datetime, username, ipaddress, tablename, action",
  },
  {
    kode: "IN10",
    kunci: "cocokSippArsipEcourt",
    judul: "Pencocokan SIPP dengan Arsip e-Court",
    keterangan:
      "Perkara e-Court hidup di dua tempat: tabel perkara milik SIPP dan tabel salinan dari e-Court pusat. Yang diperiksa arah yang berbahaya - perkara yang punya baris e-filing tetapi pihaknya tidak tersalin. Penyalinan yang gagal tidak menimbulkan error apa pun; ia hanya menghasilkan perkara yang tidak dapat dipanggil, dan tidak ada yang menyadarinya sampai hari sidang.",
    baris: barisCocokEcourt,
    pembilang: "Perkara e-Court yang pihaknya tersalin dan nomor e-filingnya tunggal",
    penyebut: "Seluruh perkara e-Court yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_efiling_id dan perkara_pihak1",
    ruas: "efiling_id, perkara_id pada perkara_pihak1",
  },
  {
    kode: "IN14",
    kunci: "jejakAuditAplikasi",
    judul: "Jejak Audit Aplikasi",
    keterangan:
      "Berbeda dari rekam jejak per aparatur yang menilai kelengkapan tiap BARIS audit, butir ini menilai CAKUPANNYA: tabel tahapan mana yang benar-benar terpantau. Tabel yang tidak pernah muncul pada audit trail dapat diubah siapa pun tanpa bekas - dan yang paling berbahaya justru tabel yang jarang disentuh seperti putusan dan akta cerai, sebab di sanalah perubahan satu baris paling berarti.",
    baris: barisJejakAuditAplikasi,
    pembilang: "Tabel tahapan yang punya sekurangnya satu jejak audit pada rentang ini",
    penyebut: "Sepuluh tabel tahapan yang ditetapkan wajib terpantau",
    tabel: "sys_audittrail, dikelompokkan menurut tablename",
    ruas: "datetime, tablename",
  },
  {
    kode: "KT07",
    kunci: "ketaatanInputRelaas",
    judul: "Ketaatan Penginputan Relaas Panggilan",
    keterangan: `Jarak antara pelaksanaan panggilan dan penginputan relaasnya, dengan tenggang ${HARI_WAJAR_INPUT_RELAAS} hari. Ini PERTANYAAN, bukan tuduhan: jurusita yang berangkat ke tiga kecamatan dalam sehari memang baru kembali ke kantor keesokan lusa. Yang dikatakan angkanya satu - seluruh penilaian ketaatan tenggang pemanggilan bersandar pada tanggal relaas, dan tanggal itu diketik dari ingatan pada baris yang terlambat.`,
    baris: null,
    pembilang: `Pelaksanaan relaas yang diketik dalam ${HARI_WAJAR_INPUT_RELAAS} hari sesudah dilaksanakan`,
    penyebut: "Seluruh pelaksanaan relaas bertanggal atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_pelaksanaan_relaas lewat perkara_id",
    ruas: "tanggal_relaas, diinput_tanggal, diinput_oleh",
  },
  {
    kode: "KT08",
    kunci: "ketaatanInputMediasi",
    judul: "Ketaatan Penginputan Data Mediasi",
    keterangan: `Jarak antara keputusan mediasi dan penginputannya, dengan tenggang ${HARI_WAJAR_INPUT_MEDIASI} hari. Perkara yang TIDAK wajib mediasi tidak masuk populasi sama sekali - ia tidak punya keputusan mediasi untuk diinput, dan menghitungnya memenuhi akan menggelembungkan nilai satuan kerja yang perkaranya kebetulan banyak yang dikecualikan.`,
    baris: null,
    pembilang: `Keputusan mediasi yang diketik dalam ${HARI_WAJAR_INPUT_MEDIASI} hari sesudah diputuskan`,
    penyebut: "Seluruh baris mediasi berkeputusan atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_mediasi lewat perkara_id",
    ruas: "keputusan_mediasi, diinput_tanggal, diinput_oleh",
  },
  {
    kode: "KT09",
    kunci: "ketaatanInputJadwalSidang",
    judul: "Ketaatan Penginputan Jadwal dan Penundaan Sidang",
    keterangan: `Jarak antara hari sidang dan penginputan jadwalnya, dengan tenggang ${HARI_WAJAR_INPUT_SIDANG} hari. Diukur pada SIPP sungguhan: tidak satu pun dari 907 jadwal diinput sesudah hari sidangnya - dan angka bersih itu berguna sebagai pembanding, sebab ia menunjukkan jejak waktu SIPP memang dapat dipercaya ketika perilakunya memang tertib.`,
    baris: null,
    pembilang: `Jadwal sidang yang diketik selambatnya ${HARI_WAJAR_INPUT_SIDANG} hari sesudah hari sidangnya`,
    penyebut: "Seluruh jadwal sidang atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_jadwal_sidang lewat perkara_id",
    ruas: "tanggal_sidang, diinput_tanggal, diinput_oleh",
  },
  {
    kode: "KT13",
    kunci: "ketaatanPemberitahuanIsiPutusan",
    judul: "Ketaatan Pemberitahuan Isi Putusan",
    keterangan:
      "Pihak yang TIDAK hadir saat putusan diucapkan harus diberitahu isinya, dan tenggang upaya hukumnya baru berjalan sejak pemberitahuan itu - tanpa pemberitahuan, putusan tidak pernah berkekuatan hukum tetap secara sah berapa lama pun waktu berlalu. Kehadiran dibaca dari sidang terakhir; sidang yang kehadirannya tidak tercatat ditandai demikian, BUKAN dianggap hadir.",
    baris: barisPemberitahuanIsiPutusan,
    pembilang: "Putusan yang kehadiran pihaknya tercatat dan pemberitahuannya atau tanggal tetapnya ada",
    penyebut: "Seluruh putusan atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_putusan dan perkara_jadwal_sidang",
    ruas: "tanggal_putusan, tanggal_bht, pemberitahuan_putusan, dihadiri_oleh",
  },
  {
    kode: "KT17",
    kunci: "ketaatanPublikasiDirektori",
    judul: "Ketaatan Publikasi Direktori Putusan",
    keterangan: `Putusan diunggah ke Direktori Putusan dalam ${HARI_WAJAR_UNGGAH_DIREKTORI} hari kerja sejak diucapkan. Putusan tanpa satu pun baris dirput belum terbit - dan putusan yang tidak terbit tidak dapat dibaca siapa pun di luar pengadilan, termasuk pihak yang mencarinya sendiri.`,
    baris: barisPublikasiDirektori,
    pembilang: `Putusan yang terunggah ke direktori dalam ${HARI_WAJAR_UNGGAH_DIREKTORI} hari sejak diucapkan`,
    penyebut: "Seluruh putusan atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_putusan dan dirput_dokumen lewat perkara_id",
    ruas: "tanggal_putusan, created_date pada dirput_dokumen",
  },
  {
    kode: "KT19",
    kunci: "ketaatanSemaPerma",
    judul: "Ketaatan Terhadap SEMA dan PERMA yang Berlaku",
    keterangan:
      "Tiga aturan yang benar-benar dapat diperiksa dari SIPP: PERMA 1/2016 mediasi wajib bila kedua pihak hadir, Pasal 149 KHI nafkah iddah dan mut'ah pada cerai talak yang dikabulkan, dan Pasal 39 UU 1/1974 upaya mendamaikan. Aturan yang TIDAK berlaku pada sebuah perkara tidak dihitung sama sekali - bukan memenuhi, bukan pula gagal. DAFTAR INI TIDAK LENGKAP, dan menambahnya menuntut naskah resminya dibaca lebih dahulu, bukan diingat.",
    baris: barisKetaatanSemaPerma,
    pembilang: "Perkara yang tidak melanggar satu pun aturan yang berlaku padanya",
    penyebut: "Putusan pada rentang ini yang sekurangnya satu aturan berlaku padanya",
    tabel: "perkara disambung perkara_putusan, status_putusan, perkara_mediasi, dan perkara_jadwal_sidang",
    ruas: "jenis_perkara_nama, status_putusan_id, amar_putusan, dihadiri_oleh, perkara_id pada perkara_mediasi",
  },
  {
    kode: "KT20",
    kunci: "gabunganKetaatanSkDirjen",
    judul: "Nilai Gabungan Ketaatan SK Dirjen Badilag 048/2024",
    keterangan:
      "Satu baris satu perkara, menggabungkan empat ketaatan penginputan yang masing-masing sudah dinilai butir tersendiri. Gunanya menjawab pertanyaan yang tidak dapat dijawab butir mana pun sendirian: berapa perkara yang SELURUH tahapannya tertib. SK Dirjen menyebut dua puluh sembilan butir dan tiga keadaan; yang dibangun baru empat butir dan dua keadaan, dan angkanya TIDAK BOLEH dilaporkan sebagai nilai SK Dirjen yang utuh.",
    baris: barisGabunganKetaatan,
    pembilang: "Perkara yang keempat tahapan penginputannya tertib seluruhnya",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_pelaksanaan_relaas, perkara_jadwal_sidang, perkara_mediasi, dan perkara_putusan",
    ruas: "tanggal_relaas, tanggal_sidang, keputusan_mediasi, tanggal_minutasi, diinput_tanggal",
  },
];

/*
 * Tiga butir ketepatan input dibangun dari satu pembangun yang sama, dan
 * dipasang di sini - SESUDAH daftar butir tersusun - supaya tidak ada
 * pemakaian sebelum deklarasi. Alias const yang dipakai di dalam daftar
 * literal sebelum barisnya sendiri dijalankan sudah pernah menjatuhkan berkas
 * lain di aplikasi ini dengan ReferenceError yang tidak menyebut sebabnya.
 */
const PEMBANGUN_KETEPATAN = {
  KT07: {
    kode: "relaas",
    tabel: "perkara_pelaksanaan_relaas",
    kunciBaris: "id",
    ruasPeristiwa: "tanggal_relaas",
    ruasInput: "diinput_tanggal",
    ruasPetugas: "diinput_oleh",
    tenggang: HARI_WAJAR_INPUT_RELAAS,
    sebutanPeristiwa: "relaasnya dilaksanakan",
    pembelaan:
      "Jurusita yang berangkat ke tiga kecamatan dalam sehari memang baru kembali ke kantor keesokan lusa - ini pertanyaan, bukan tuduhan.",
  },
  KT08: {
    kode: "mediasi",
    tabel: "perkara_mediasi",
    kunciBaris: "mediasi_id",
    ruasPeristiwa: "keputusan_mediasi",
    ruasInput: "diinput_tanggal",
    ruasPetugas: "diinput_oleh",
    tenggang: HARI_WAJAR_INPUT_MEDIASI,
    sebutanPeristiwa: "mediasinya diputuskan",
    pembelaan: "Laporan mediator kadang baru sampai ke kepaniteraan beberapa hari kemudian.",
  },
  KT09: {
    kode: "jadwal",
    tabel: "perkara_jadwal_sidang",
    kunciBaris: "id",
    ruasPeristiwa: "tanggal_sidang",
    ruasInput: "diinput_tanggal",
    ruasPetugas: "diinput_oleh",
    tenggang: HARI_WAJAR_INPUT_SIDANG,
    sebutanPeristiwa: "hari sidangnya",
    // Jadwal sidang MEMANG diketik sebelum harinya tiba - itu justru yang
    // benar. Tanpa penanda ini, 901 dari 907 jadwal ditandai "diketik sebelum
    // peristiwanya", dan butirnya memulangkan 6 dari 907 seolah-olah
    // penjadwalan satuan kerja ini kacau. Yang kacau kaidahnya.
    bolehMendahului: true,
    pembelaan: "Jadwal semestinya dibuat di muka, jadi keterlambatan di sini lebih jarang punya pembenaran.",
  },
};

BUTIR.forEach((b) => {
  if (b.baris === null && PEMBANGUN_KETEPATAN[b.kode]) {
    b.baris = pembangunKetepatanInput(PEMBANGUN_KETEPATAN[b.kode]);
  }
});

let sudahDidaftar = false;

function daftarkanSemua() {
  if (sudahDidaftar) return BUTIR.map((b) => b.kunci);

  BUTIR.forEach((b) => {
    if (kerangka.ambil(b.kunci)) return;
    kerangka.daftarkan({
      kunci: b.kunci,
      judul: b.judul,
      keterangan: b.keterangan,
      lantai: "bulanan",
      versiRumus: "jejak-ketaatan-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: b.pembilang,
        penyebut: b.penyebut,
        dikecualikan:
          "Peristiwa yang tidak punya jejak waktu pengetikan tetap masuk populasi dan ditandai - ketiadaan jejaknya sendiri adalah temuan, bukan alasan mengeluarkannya. Aturan SEMA dan PERMA yang TIDAK berlaku pada sebuah perkara tidak dihitung sama sekali: bukan memenuhi, bukan pula gagal. Butir yang tabelnya tidak ada pada SIPP satuan kerja ini tidak menghasilkan baris sama sekali.",
        tabelSumber: b.tabel,
        ruasSumber: b.ruas,
      },
      baris: b.baris,
    });
  });

  sudahDidaftar = true;
  return BUTIR.map((b) => b.kunci);
}

function lupakanSemua() {
  sudahDidaftar = false;
}

function sambungan() {
  const peta = {};
  BUTIR.forEach((b) => {
    peta[b.kode] = b.kunci;
  });
  return peta;
}

module.exports = {
  BUTIR,
  HARI_ASAS_PENYELESAIAN,
  HARI_WAJAR_INPUT_MEDIASI,
  HARI_WAJAR_INPUT_RELAAS,
  HARI_WAJAR_INPUT_SIDANG,
  HARI_WAJAR_UNGGAH_DIREKTORI,
  PEMBANGUN_KETEPATAN,
  TABEL_DIPANTAU,
  barisCocokEcourt,
  barisGabunganKetaatan,
  barisJejakAuditAplikasi,
  barisKetaatanSemaPerma,
  barisPemberitahuanIsiPutusan,
  barisPublikasiDirektori,
  barisPutusanDiubahSesudahBht,
  barisRekamJejakAparatur,
  daftarkanSemua,
  lupakanSemua,
  pembangunKetepatanInput,
  sambungan,
};
