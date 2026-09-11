"use strict";

/**
 * ============================================================================
 * KIRIM SAAT DATA LENGKAP
 * ============================================================================
 *
 * Pemberitahuan lama berangkat karena datanya BARU: perkara terdaftar hari
 * ini, akta cerai terbit hari ini. Yang belum pernah ada: pemberitahuan yang
 * berangkat karena datanya LENGKAP.
 *
 * Bedanya nyata bagi yang menerimanya. Perkara yang baru terdaftar belum
 * punya majelis dan belum punya hari sidang. Diberitahukan pada hari itu,
 * pihak menerima nomor perkara tanpa tahu kapan harus datang - dan ia akan
 * bertanya, lewat WhatsApp yang sama, kepada bot yang belum punya jawabannya.
 * Diberitahukan SETELAH PMH, PHS, dan jadwal sidang pertama terisi, satu
 * pesan memuat seluruh yang perlu ia ketahui.
 *
 * ============================================================================
 * SEKALI, DAN HANYA SEKALI
 * ============================================================================
 *
 * Pemantau ini berjalan berulang, dan setiap putaran menemukan perkara yang
 * SAMA lengkapnya dengan putaran sebelumnya. Yang menahannya mengirim ulang
 * adalah kunci idempoten per perkara per penerima: antrean menolak kunci
 * yang sudah pernah masuk, dan catatan pengiriman menolak kunci yang sudah
 * pernah terkirim. Keduanya diperiksa - antrean dapat dibersihkan, catatan
 * pengiriman lebih awet.
 *
 * ============================================================================
 * LEWAT ANTREAN, BUKAN KIRIM LANGSUNG
 * ============================================================================
 *
 * Sama seperti pekerja e-Court: seluruh pengaman anti-blokir - irama kirim,
 * jendela jam kerja, jeda per penerima, penghentian saat akun ditandai,
 * saklar pegawai/pihak, saklar per pesan - hidup di antrean dan di
 * messageService. Jalur kedua yang melewati semuanya adalah jalur yang akan
 * membuat nomor pengadilan diblokir.
 *
 * SIPP hanya DIBACA. Tidak ada satu pun tulisan ke sana.
 */

const {
  readRuntimeConfig,
  normalizeEmployeeRecipients,
  pesanDimatikan,
} = require("../config/runtime-config");
const db = require("../db_config");
const logService = require("./logService");
const messageQueueService = require("./messageQueueService");
const sippSkemaService = require("./sippSkemaService");
const { cleanText } = require("./ecourtTextService");
const { validateWhatsappNumber } = require("../utils/phoneFormatter");

/** Tahapan penunjukan tingkat pertama pada tabel petugas SIPP. */
const TAHAPAN_TINGKAT_PERTAMA = 10;

/** Berapa perkara paling banyak ditelaah sekali jalan. */
const BATAS_PERKARA = 200;

/** Zona waktu satuan kerja. Donggala berada di WITA. */
const ZONA_WAKTU = "Asia/Makassar";

const SUMBER_FITUR = "kirim_saat_lengkap";

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/**
 * Definisi pemantau. Satu definisi = satu jenis pesan = satu kunci
 * pemberitahuan yang dapat dimatikan sendiri dari saklar per pesan.
 */
const DEFINISI = [
  {
    key: "pihak-baru-lengkap",
    saluran: "pihak",
    kategori: "party",
    nama: "Perkara baru kepada para pihak",
    keterangan:
      "Dikirim sekali kepada penggugat/pemohon, tergugat/termohon, dan kuasanya " +
      "begitu perkara yang baru terdaftar sudah lengkap: majelis ditetapkan (PMH), " +
      "hari sidang ditetapkan (PHS), dan sidang pertama terjadwal.",
    syarat: [
      "Terdaftar dalam jendela hari yang disetel",
      "Penetapan Majelis Hakim (PMH) terisi",
      "Penetapan Hari Sidang (PHS) terisi",
      "Jadwal sidang pertama terisi dan belum lewat",
      "Nomor telepon pihak sah untuk WhatsApp",
    ],
  },
  {
    key: "pegawai-penugasan-lengkap",
    saluran: "pegawai",
    kategori: "employee",
    nama: "Penugasan perkara kepada majelis, PP, dan JS",
    keterangan:
      "Dikirim sekali kepada hakim majelis, panitera pengganti, dan juru sita " +
      "yang ditunjuk, begitu PMH, PPP, PJS, PHS, dan jadwal sidang pertama " +
      "seluruhnya terisi.",
    syarat: [
      "Terdaftar dalam jendela hari yang disetel",
      "PMH, PPP, PJS, dan PHS seluruhnya terisi",
      "Jadwal sidang pertama terisi dan belum lewat",
      "Nama petugas di SIPP cocok dengan pegawai bernomor WhatsApp di portal",
    ],
  },
];

const definisiMenurutKunci = new Map(DEFINISI.map((definisi) => [definisi.key, definisi]));

// ============================================================================
// KEADAAN PEMANTAU
// ============================================================================

const keadaan = {
  aktif: false,
  sedangJalan: false,
  terakhirJalan: null,
  terakhirPemicu: "",
  terakhirHasil: null,
  terakhirGalat: "",
};

let pewaktu = null;

// ============================================================================
// FUNGSI MURNI - DIUJI TANPA DATABASE
// ============================================================================

/**
 * Apakah perkara ini LENGKAP untuk definisi tersebut?
 *
 * Pihak cukup PMH + PHS + jadwal sidang pertama. Pegawai menuntut PPP dan
 * PJS juga - pesannya menyebut siapa panitera pengganti dan juru sitanya,
 * dan menyebut "belum ditunjuk" bukan pemberitahuan yang berguna.
 */
function perkaraLengkap(perkara, saluran) {
  if (!perkara) return false;
  const ada = (nilai) => Boolean(nilai);
  const dasar = ada(perkara.pmh) && ada(perkara.phs) && ada(perkara.tanggalSidang);
  if (!dasar) return false;
  if (saluran === "pegawai") return ada(perkara.ppp) && ada(perkara.pjs);
  return true;
}

/**
 * Kunci nama untuk mencocokkan petugas SIPP dengan pegawai portal.
 *
 * SIPP menulis "Drs. H. ABDUL SALAM, M.H." di satu tabel dan "Abdul Salam"
 * di tabel lain; portal menyimpan "ABDUL SALAM, S.HI. MH.". Yang sama dari
 * ketiganya hanya nama pokoknya, huruf demi huruf, tanpa gelar dan tanpa
 * tanda baca. Itulah yang dibandingkan.
 */
function namaKunci(nama) {
  let bersih = cleanText(String(nama || ""))
    .replace(/<[^>]+>/g, " ")
    .split(",")[0]
    .toLowerCase();
  const gelarDepan = /^(?:prof|dr|drs|dra|ir|h|hj|kh|ust|ustadz)\.?\s+/;
  while (gelarDepan.test(bersih)) bersih = bersih.replace(gelarDepan, "");
  return bersih
    .replace(/\b(?:s\.?h\.?i?|m\.?h\.?i?|s\.?ag|s\.?sy|s\.?e|m\.?e|m\.?si|s\.?kom|s\.?sos|lc|ma|m\.?a)\b\.?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pegawai portal yang namanya cocok dengan nama petugas dari SIPP.
 *
 * Kecocokan penuh didahulukan. Bila tidak ada, nama yang satu memuat nama
 * yang lain diterima asal cukup panjang - "abdul salam" memuat "salam"
 * bukan bukti apa-apa, tetapi "muhammad abdul salam" memuat "abdul salam"
 * hampir pasti orang yang sama.
 */
function cocokkanPegawai(namaSipp, recipients) {
  const kunci = namaKunci(namaSipp);
  if (!kunci) return null;
  const daftar = normalizeEmployeeRecipients(recipients);

  const persis = daftar.find((pegawai) => namaKunci(pegawai.name) === kunci);
  if (persis) return persis;

  if (kunci.length < 8) return null;
  return (
    daftar.find((pegawai) => {
      const kunciPegawai = namaKunci(pegawai.name);
      if (kunciPegawai.length < 8) return false;
      return kunciPegawai.includes(kunci) || kunci.includes(kunciPegawai);
    }) || null
  );
}

/** Sebutan pihak menurut kedudukan dan jenis perkaranya. */
function sebutanPihak(pihakKe, jenis, jenisPerkara) {
  const permohonan = /permohonan|itsbat|dispensasi|wali|poligami|asal.?usul|perwalian|pengangkatan/i.test(
    String(jenisPerkara || "")
  );
  const pokok = Number(pihakKe) === 2
    ? permohonan ? "Termohon" : "Tergugat"
    : permohonan ? "Pemohon" : "Penggugat";
  return jenis === "kuasa" ? `Kuasa ${pokok}` : pokok;
}

/** Peran petugas untuk kalimat pesan. */
function sebutanPetugas(peran, urutan) {
  if (peran === "hakim") return Number(urutan) === 1 ? "Ketua Majelis" : "Hakim Anggota";
  if (peran === "panitera") return "Panitera Pengganti";
  if (peran === "jurusita") return "Juru Sita";
  return "Petugas";
}

function tulisTanggalPanjang(nilai) {
  if (!nilai) return "-";
  const tanggal = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return String(nilai);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONA_WAKTU,
  }).format(tanggal);
}

function tulisTanggalPendek(nilai) {
  if (!nilai) return "-";
  const tanggal = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return String(nilai);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONA_WAKTU,
  }).format(tanggal);
}

/** "09:00:00" menjadi "09.00" - cara jam ditulis pada surat panggilan. */
function tulisJam(nilai) {
  const teks = String(nilai || "").trim();
  const cocok = teks.match(/^(\d{1,2})[:.](\d{2})/);
  if (!cocok) return teks || "-";
  return `${cocok[1].padStart(2, "0")}.${cocok[2]}`;
}

function namaPengadilan(runtimeConfig) {
  const identitas = (runtimeConfig && runtimeConfig.institutionIdentity) || {};
  return cleanText(identitas.courtName || "") || "Pengadilan Agama Donggala";
}

function kontakPengadilan(runtimeConfig) {
  const identitas = (runtimeConfig && runtimeConfig.institutionIdentity) || {};
  return cleanText(identitas.csWhatsappNumber || identitas.mobilePhone || identitas.phoneNumber || "");
}

function paraPihakRapi(teks) {
  return cleanText(String(teks || "").replace(/<br\s*\/?>/gi, "\n"))
    .split("\n")
    .map((baris) => baris.trim())
    .filter(Boolean)
    .join("\n");
}

/** Pesan kepada pihak. Nada resmi, tanpa basa-basi yang mengundang balasan. */
function susunPesanPihak(perkara, penerima, runtimeConfig) {
  const pengadilan = namaPengadilan(runtimeConfig);
  const kontak = kontakPengadilan(runtimeConfig);
  const kedudukan = sebutanPihak(penerima.pihakKe, penerima.jenis, perkara.jenisPerkara);
  const baris = [
    "Assalamu'alaikum Warahmatullahi Wabarakatuh.",
    "",
    `Yth. Sdr/Sdri *${cleanText(penerima.nama)}*,`,
    "",
    `${pengadilan} memberitahukan bahwa perkara Anda telah terdaftar dan jadwal sidang pertamanya telah ditetapkan.`,
    "",
    `Nomor perkara: *${perkara.nomorPerkara}*`,
    `Jenis perkara: ${perkara.jenisPerkara || "-"}`,
    `Tanggal pendaftaran: ${tulisTanggalPendek(perkara.tanggalDaftar)}`,
    `Kedudukan Anda: ${kedudukan}`,
    "",
    "Para pihak:",
    paraPihakRapi(perkara.paraPihak) || "-",
    "",
    `Majelis Hakim: ${perkara.majelisNama || "-"}`,
    `Panitera Pengganti: ${perkara.paniteraText || "-"}`,
    "",
    "Sidang pertama:",
    `Hari/tanggal: *${tulisTanggalPanjang(perkara.tanggalSidang)}*`,
    `Pukul: *${tulisJam(perkara.jamSidang)} WITA*`,
    `Ruang: ${perkara.ruangan || "-"}`,
    `Agenda: ${perkara.agenda || "-"}`,
    "",
    "Pesan ini adalah pemberitahuan dan tidak perlu dibalas. Panggilan resmi tetap disampaikan oleh Juru Sita sesuai ketentuan.",
    kontak
      ? `Untuk informasi lebih lanjut, ketik "perkara" atau hubungi ${kontak}.`
      : `Untuk informasi lebih lanjut, ketik "perkara".`,
  ];
  return baris.join("\n");
}

/** Pesan kepada pegawai yang ditunjuk. */
function susunPesanPegawai(perkara, petugas, runtimeConfig) {
  const pengadilan = namaPengadilan(runtimeConfig);
  const peran = sebutanPetugas(petugas.peran, petugas.urutan);
  const baris = [
    `Yth. ${cleanText(petugas.namaPortal || petugas.nama)},`,
    "",
    `Anda ditunjuk sebagai *${peran}* pada perkara berikut. Berkasnya telah lengkap sampai penetapan hari sidang.`,
    "",
    `Nomor perkara: *${perkara.nomorPerkara}*`,
    `Jenis perkara: ${perkara.jenisPerkara || "-"}`,
    `Tanggal pendaftaran: ${tulisTanggalPendek(perkara.tanggalDaftar)}`,
    "",
    "Para pihak:",
    paraPihakRapi(perkara.paraPihak) || "-",
    "",
    `Majelis Hakim: ${perkara.majelisNama || "-"}`,
    `Panitera Pengganti: ${perkara.paniteraText || "-"}`,
    `Juru Sita: ${perkara.jurusitaText || "-"}`,
    "",
    `Sidang pertama: *${tulisTanggalPanjang(perkara.tanggalSidang)}*, pukul ${tulisJam(perkara.jamSidang)} WITA, ${perkara.ruangan || "ruang sidang"}.`,
    `Agenda: ${perkara.agenda || "-"}`,
    "",
    `Pesan ini dikirim otomatis oleh ALETA (${pengadilan}).`,
  ];
  return baris.join("\n");
}

/**
 * Bolehkah definisi ini berjalan pada konfigurasi tersebut?
 *
 * Urutan pemeriksaannya dari yang paling luas: bot, notifikasi, saklar
 * universal fitur, saklar saluran fitur, saklar saluran bot, lalu saklar
 * per pesan. Alasan yang dikembalikan menyebut penjaga PERTAMA yang menahan,
 * supaya layar dapat mengatakan tepat saklar mana yang perlu dinyalakan.
 */
function bolehJalan(runtimeConfig, definisi) {
  const konfig = runtimeConfig || {};
  const fitur = konfig.kirimSaatLengkap || {};
  const kePegawai = definisi.saluran === "pegawai";

  if (konfig.botEnabled === false) return { boleh: false, alasan: "bot_dimatikan" };
  if (konfig.notificationsEnabled === false) return { boleh: false, alasan: "notifikasi_dimatikan" };
  if (fitur.enabled !== true) return { boleh: false, alasan: "fitur_kirim_saat_lengkap_dimatikan" };
  if (kePegawai && fitur.pegawai === false) return { boleh: false, alasan: "fitur_saluran_pegawai_dimatikan" };
  if (!kePegawai && fitur.pihak === false) return { boleh: false, alasan: "fitur_saluran_pihak_dimatikan" };
  if (kePegawai && konfig.kirimPegawaiEnabled === false) return { boleh: false, alasan: "pengiriman_pegawai_dimatikan" };
  if (!kePegawai && konfig.kirimPihakEnabled === false) return { boleh: false, alasan: "pengiriman_pihak_dimatikan" };
  if (pesanDimatikan(konfig, definisi.key, kePegawai)) {
    return { boleh: false, alasan: kePegawai ? "pesan_pegawai_dimatikan" : "pesan_pihak_dimatikan" };
  }
  return { boleh: true, alasan: "" };
}

function kunciIdempoten(definisi, perkara, penerimaId) {
  return `lengkap:${definisi.key}:${perkara.perkaraId}:${penerimaId}`;
}

// ============================================================================
// MEMBACA SIPP
// ============================================================================

/**
 * Perkara yang terdaftar dalam jendela hari dan sudah lengkap.
 *
 * Sidang pertama = jadwal dengan tanggal PALING AWAL pada perkara itu, dan
 * harus masih di depan: perkara yang sidang pertamanya sudah lewat tidak
 * ada gunanya diberitahukan sekarang, dan pemberitahuannya justru
 * membingungkan.
 */
async function bacaPerkaraLengkap(jendelaHari) {
  const tabelPerlu = ["perkara", "perkara_penetapan", "perkara_jadwal_sidang"];
  for (const tabel of tabelPerlu) {
    if (!(await sippSkemaService.tabelAda(tabel))) {
      return { terbaca: false, alasan: `tabel_${tabel}_tidak_ada`, perkara: [] };
    }
  }

  const rows = await runQuery(
    `SELECT p.perkara_id                    AS perkaraId,
            p.nomor_perkara                 AS nomorPerkara,
            p.jenis_perkara_nama            AS jenisPerkara,
            p.tanggal_pendaftaran           AS tanggalDaftar,
            p.para_pihak                    AS paraPihak,
            pp.penetapan_majelis_hakim      AS pmh,
            pp.penetapan_panitera_pengganti AS ppp,
            pp.penetapan_jurusita           AS pjs,
            pp.penetapan_hari_sidang        AS phs,
            pp.majelis_hakim_nama           AS majelisNama,
            pp.panitera_pengganti_text      AS paniteraText,
            pp.jurusita_text                AS jurusitaText,
            j.tanggal_sidang                AS tanggalSidang,
            j.jam_sidang                    AS jamSidang,
            j.ruangan                       AS ruangan,
            j.agenda                        AS agenda
       FROM perkara p
       JOIN perkara_penetapan pp ON pp.perkara_id = p.perkara_id
       JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
        AND j.id = (SELECT j2.id
                      FROM perkara_jadwal_sidang j2
                     WHERE j2.perkara_id = p.perkara_id
                       AND j2.tanggal_sidang IS NOT NULL
                     ORDER BY j2.tanggal_sidang ASC, j2.id ASC
                     LIMIT 1)
      WHERE p.tanggal_pendaftaran >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND pp.penetapan_majelis_hakim IS NOT NULL
        AND pp.penetapan_hari_sidang IS NOT NULL
        AND j.tanggal_sidang IS NOT NULL
        AND DATE(j.tanggal_sidang) >= CURDATE()
      -- YANG TERBARU LEBIH DULU, dan itu bukan selera.
      --
      -- Batas ${BATAS_PERKARA} perkara sekali jalan diambil dari ujung mana
      -- pun, dan ujung yang salah membuat pemantau ini MACET tanpa suara:
      -- perkara yang sudah pernah dikirimi tetap lengkap dan tetap berada di
      -- dalam jendela hari, sehingga dengan urutan menaik ia terus memenuhi
      -- jatah batas sampai jendelanya lewat - dan perkara yang benar-benar
      -- baru tidak pernah terlihat sama sekali.
      --
      -- Menurun membalik keadaannya: yang baru selalu masuk batch, dan yang
      -- lama sudah dikirim pada putaran ketika ia masih baru.
      ORDER BY p.perkara_id DESC
      LIMIT ${BATAS_PERKARA}`,
    [Math.max(1, Number(jendelaHari) || 14)]
  );

  const perkara = rows.map((row) => ({
    perkaraId: Number(row.perkaraId) || 0,
    nomorPerkara: cleanText(row.nomorPerkara),
    jenisPerkara: cleanText(row.jenisPerkara),
    tanggalDaftar: row.tanggalDaftar,
    paraPihak: String(row.paraPihak || ""),
    pmh: row.pmh,
    ppp: row.ppp,
    pjs: row.pjs,
    phs: row.phs,
    majelisNama: cleanText(String(row.majelisNama || "").replace(/<br\s*\/?>/gi, ", ")),
    paniteraText: cleanText(String(row.paniteraText || "").replace(/<br\s*\/?>/gi, ", ")),
    jurusitaText: cleanText(String(row.jurusitaText || "").replace(/<br\s*\/?>/gi, ", ")),
    tanggalSidang: row.tanggalSidang,
    jamSidang: row.jamSidang,
    ruangan: cleanText(row.ruangan),
    agenda: cleanText(row.agenda),
  }));

  return { terbaca: true, alasan: "", perkara };
}

function isian(jumlah) {
  return Array.from({ length: jumlah }, () => "?").join(", ");
}

/** Pihak dan kuasanya untuk sekumpulan perkara, beserta nomor teleponnya. */
async function bacaPihak(perkaraIds) {
  if (perkaraIds.length === 0) return [];
  const daftar = isian(perkaraIds.length);

  const pihak = await runQuery(
    `SELECT a.perkara_id AS perkaraId, a.pihak_id AS pihakId, a.nama AS nama,
            a.pihak_ke AS pihakKe, 'pihak' AS jenis, b.telepon AS telepon
       FROM v_pihak_perkara a
       JOIN pihak b ON b.id = a.pihak_id
      WHERE a.perkara_id IN (${daftar})`,
    perkaraIds
  );

  // Kuasa hukum dibaca terpisah dan kegagalannya tidak menggagalkan pihak:
  // tabel pengacara tidak ada pada semua pemasangan SIPP.
  //
  // aktif = 'Y' bukan kerapian belaka. Kuasa yang dicabut tetap tercatat di
  // tabel ini dengan barisnya sendiri; mengirimkan perkara kliennya kepada
  // orang yang sudah tidak lagi mewakilinya adalah kebocoran data, dan tidak
  // dapat ditarik kembali setelah terbaca.
  const kuasa = await runQuery(
    `SELECT a.perkara_id AS perkaraId, a.pengacara_id AS pihakId, a.nama AS nama,
            a.pihak_ke AS pihakKe, 'kuasa' AS jenis, b.telepon AS telepon
       FROM perkara_pengacara a
       LEFT JOIN pihak b ON b.id = a.pengacara_id
      WHERE a.perkara_id IN (${daftar}) AND a.aktif = 'Y'`,
    perkaraIds
  ).catch(() => []);

  return [...pihak, ...kuasa].map((row) => ({
    perkaraId: Number(row.perkaraId) || 0,
    pihakId: Number(row.pihakId) || 0,
    nama: cleanText(row.nama),
    pihakKe: Number(row.pihakKe) || 1,
    jenis: row.jenis === "kuasa" ? "kuasa" : "pihak",
    telepon: String(row.telepon || ""),
  }));
}

/** Petugas yang ditunjuk pada sekumpulan perkara: hakim, PP, dan JS. */
async function bacaPetugas(perkaraIds) {
  if (perkaraIds.length === 0) return [];
  const daftar = isian(perkaraIds.length);
  const hasil = [];

  if (await sippSkemaService.tabelAda("perkara_hakim_pn")) {
    const hakim = await runQuery(
      `SELECT hp.perkara_id AS perkaraId, hp.hakim_nama AS nama, hp.urutan AS urutan
         FROM perkara_hakim_pn hp
        WHERE hp.perkara_id IN (${daftar}) AND hp.aktif = 'Y' AND hp.tahapan_id = ?
        ORDER BY hp.perkara_id ASC, hp.urutan ASC`,
      [...perkaraIds, TAHAPAN_TINGKAT_PERTAMA]
    ).catch(() => []);
    hakim.forEach((row) => hasil.push({ peran: "hakim", perkaraId: Number(row.perkaraId) || 0, nama: cleanText(row.nama), urutan: Number(row.urutan) || 0 }));
  }

  if ((await sippSkemaService.tabelAda("perkara_panitera_pn")) && (await sippSkemaService.tabelAda("panitera_pn"))) {
    const panitera = await runQuery(
      `SELECT pp.perkara_id AS perkaraId, pn.nama AS nama
         FROM perkara_panitera_pn pp
         JOIN panitera_pn pn ON pn.id = pp.panitera_id
        WHERE pp.perkara_id IN (${daftar}) AND pp.aktif = 'Y' AND pp.tahapan_id = ?`,
      [...perkaraIds, TAHAPAN_TINGKAT_PERTAMA]
    ).catch(() => []);
    panitera.forEach((row) => hasil.push({ peran: "panitera", perkaraId: Number(row.perkaraId) || 0, nama: cleanText(row.nama), urutan: 0 }));
  }

  if ((await sippSkemaService.tabelAda("perkara_jurusita")) && (await sippSkemaService.tabelAda("jurusita"))) {
    const jurusita = await runQuery(
      `SELECT pj.perkara_id AS perkaraId, js.nama AS nama
         FROM perkara_jurusita pj
         JOIN jurusita js ON js.id = pj.jurusita_id
        WHERE pj.perkara_id IN (${daftar}) AND pj.aktif = 'Y' AND pj.tahapan_id = ?`,
      [...perkaraIds, TAHAPAN_TINGKAT_PERTAMA]
    ).catch(() => []);
    jurusita.forEach((row) => hasil.push({ peran: "jurusita", perkaraId: Number(row.perkaraId) || 0, nama: cleanText(row.nama), urutan: 0 }));
  }

  return hasil;
}

// ============================================================================
// MENYUSUN DAFTAR KIRIM
// ============================================================================

/**
 * Daftar pesan yang akan dikirim untuk satu definisi. Belum ada yang
 * diantrekan - fungsi ini hanya MENYUSUN, supaya pratinjau dan pengiriman
 * sungguhan membaca daftar yang persis sama.
 */
async function susunDaftar(definisi, perkaraSemua, runtimeConfig) {
  const perkara = perkaraSemua.filter((satu) => perkaraLengkap(satu, definisi.saluran));
  const ids = perkara.map((satu) => satu.perkaraId);
  const daftar = [];
  const dilewati = { tanpaNomor: 0, tidakCocok: 0 };

  if (definisi.saluran === "pihak") {
    const pihak = await bacaPihak(ids);
    for (const satu of perkara) {
      const terlihat = new Set();
      for (const orang of pihak.filter((x) => x.perkaraId === satu.perkaraId)) {
        const validasi = validateWhatsappNumber(orang.telepon);
        if (!validasi.valid) {
          dilewati.tanpaNomor += 1;
          continue;
        }
        const nomor = validasi.chatId || validasi.normalized;
        if (terlihat.has(nomor)) continue;
        terlihat.add(nomor);
        daftar.push({
          definisi: definisi.key,
          kategori: definisi.kategori,
          perkaraId: satu.perkaraId,
          nomorPerkara: satu.nomorPerkara,
          nomor,
          nama: orang.nama,
          peran: sebutanPihak(orang.pihakKe, orang.jenis, satu.jenisPerkara),
          kunci: kunciIdempoten(definisi, satu, `${orang.jenis}-${orang.pihakId || nomor}`),
          pesan: susunPesanPihak(satu, orang, runtimeConfig),
        });
      }
    }
    return { daftar, perkara: perkara.length, dilewati };
  }

  const petugas = await bacaPetugas(ids);
  const recipients = runtimeConfig.employeeRecipients || [];
  for (const satu of perkara) {
    const terlihat = new Set();
    for (const orang of petugas.filter((x) => x.perkaraId === satu.perkaraId)) {
      const pegawai = cocokkanPegawai(orang.nama, recipients);
      if (!pegawai) {
        dilewati.tidakCocok += 1;
        continue;
      }
      if (terlihat.has(pegawai.whatsappChatId)) continue;
      terlihat.add(pegawai.whatsappChatId);
      daftar.push({
        definisi: definisi.key,
        kategori: definisi.kategori,
        perkaraId: satu.perkaraId,
        nomorPerkara: satu.nomorPerkara,
        nomor: pegawai.whatsappChatId,
        nama: pegawai.name,
        peran: sebutanPetugas(orang.peran, orang.urutan),
        kunci: kunciIdempoten(definisi, satu, pegawai.id || pegawai.whatsappChatId),
        pesan: susunPesanPegawai(satu, { ...orang, namaPortal: pegawai.name }, runtimeConfig),
      });
    }
  }
  return { daftar, perkara: perkara.length, dilewati };
}

/** Sudahkah kunci ini pernah masuk antrean atau terkirim? */
async function sudahPernah(kunci) {
  if (await logService.hasSentIdempotencyKey(kunci)) return true;
  const antrean = await messageQueueService.findByIdempotencyKey(kunci).catch(() => null);
  return Boolean(antrean);
}

// ============================================================================
// MENJALANKAN
// ============================================================================

/**
 * Satu putaran pemantau.
 *
 * @param {object} opsi
 * @param {boolean} opsi.pratinjau  hanya menyusun daftar, tidak mengantrekan
 * @param {string}  opsi.pemicu     "jadwal" | "portal" | "uji"
 */
async function jalankan({ pratinjau = false, pemicu = "jadwal" } = {}) {
  if (keadaan.sedangJalan) {
    return { ok: false, alasan: "sedang_berjalan", pratinjau, definisi: [] };
  }
  keadaan.sedangJalan = true;
  const mulai = Date.now();
  const runtimeConfig = readRuntimeConfig();
  const fitur = runtimeConfig.kirimSaatLengkap || {};

  try {
    const hasilDefinisi = [];
    let sumberPerkara = null;

    for (const definisi of DEFINISI) {
      const izin = bolehJalan(runtimeConfig, definisi);
      const ringkas = {
        key: definisi.key,
        nama: definisi.nama,
        saluran: definisi.saluran,
        boleh: izin.boleh,
        alasan: izin.alasan,
        perkaraLengkap: 0,
        calon: 0,
        sudahPernah: 0,
        diantrekan: 0,
        dilewati: { tanpaNomor: 0, tidakCocok: 0 },
        contoh: [],
      };

      // Pratinjau tetap menyusun daftarnya walau saklarnya mati: gunanya
      // justru memperlihatkan apa yang AKAN terkirim bila dinyalakan.
      if (!izin.boleh && !pratinjau) {
        hasilDefinisi.push(ringkas);
        continue;
      }

      if (!sumberPerkara) {
        sumberPerkara = await bacaPerkaraLengkap(fitur.jendelaHari);
        if (!sumberPerkara.terbaca) {
          keadaan.terakhirGalat = sumberPerkara.alasan;
        }
      }

      const { daftar, perkara, dilewati } = await susunDaftar(definisi, sumberPerkara.perkara, runtimeConfig);
      ringkas.perkaraLengkap = perkara;
      ringkas.calon = daftar.length;
      ringkas.dilewati = dilewati;

      for (const butir of daftar) {
        const pernah = await sudahPernah(butir.kunci);
        if (pernah) {
          ringkas.sudahPernah += 1;
          continue;
        }
        if (ringkas.contoh.length < 25) {
          ringkas.contoh.push({
            nomorPerkara: butir.nomorPerkara,
            nama: butir.nama,
            nomor: butir.nomor.replace(/@.*$/, ""),
            peran: butir.peran,
            pesan: butir.pesan,
          });
        }
        if (pratinjau) continue;

        await messageQueueService.enqueueMessage({
          idempotencyKey: butir.kunci,
          category: butir.kategori,
          notificationKey: butir.definisi,
          recipientNumber: butir.nomor,
          recipientName: butir.nama,
          message: butir.pesan,
          attachment: null,
          sourceApp: "aleta_bot",
          sourceFeature: SUMBER_FITUR,
          entityType: "perkara",
          entityId: butir.nomorPerkara,
          metadata: {
            nomorPerkara: butir.nomorPerkara,
            perkaraId: butir.perkaraId,
            definisi: butir.definisi,
            peran: butir.peran,
            pemicu,
            dryRun: Boolean(runtimeConfig.dryRunEnabled),
          },
        });
        ringkas.diantrekan += 1;
      }

      hasilDefinisi.push(ringkas);
    }

    const hasil = {
      ok: true,
      pratinjau,
      pemicu,
      dijalankanPada: new Date().toISOString(),
      lamaMs: Date.now() - mulai,
      jendelaHari: fitur.jendelaHari,
      sippTerbaca: sumberPerkara ? sumberPerkara.terbaca : null,
      alasanSipp: sumberPerkara ? sumberPerkara.alasan : "",
      definisi: hasilDefinisi,
    };

    if (!pratinjau) {
      keadaan.terakhirJalan = hasil.dijalankanPada;
      keadaan.terakhirPemicu = pemicu;
      keadaan.terakhirHasil = hasil;
      keadaan.terakhirGalat = sumberPerkara && !sumberPerkara.terbaca ? sumberPerkara.alasan : "";

      const totalAntre = hasilDefinisi.reduce((jumlah, satu) => jumlah + satu.diantrekan, 0);
      if (totalAntre > 0) {
        void logService.logSystemEvent({
          eventType: "kirim_saat_lengkap_diantrekan",
          severity: "info",
          message: `Pemantau kelengkapan mengantrekan ${totalAntre} pesan.`,
          metadata: {
            pemicu,
            definisi: hasilDefinisi.map((satu) => ({ key: satu.key, diantrekan: satu.diantrekan, sudahPernah: satu.sudahPernah })),
          },
        });
      }
    }

    return hasil;
  } catch (error) {
    const pesan = String((error && error.message) || error).slice(0, 300);
    if (!pratinjau) {
      keadaan.terakhirJalan = new Date().toISOString();
      keadaan.terakhirPemicu = pemicu;
      keadaan.terakhirGalat = pesan;
    }
    void logService.logSystemEvent({
      eventType: "kirim_saat_lengkap_gagal",
      severity: "warning",
      message: "Pemantau kelengkapan gagal berjalan; akan dicoba lagi pada putaran berikutnya.",
      metadata: { pemicu, pratinjau, errorMessage: pesan },
    });
    return { ok: false, alasan: pesan, pratinjau, pemicu, definisi: [] };
  } finally {
    keadaan.sedangJalan = false;
  }
}

function status() {
  const runtimeConfig = readRuntimeConfig();
  const fitur = runtimeConfig.kirimSaatLengkap || {};
  return {
    aktif: keadaan.aktif,
    sedangJalan: keadaan.sedangJalan,
    pengaturan: {
      enabled: fitur.enabled === true,
      pegawai: fitur.pegawai !== false,
      pihak: fitur.pihak !== false,
      jendelaHari: fitur.jendelaHari,
      intervalMenit: fitur.intervalMenit,
    },
    terakhirJalan: keadaan.terakhirJalan,
    terakhirPemicu: keadaan.terakhirPemicu,
    terakhirHasil: keadaan.terakhirHasil,
    terakhirGalat: keadaan.terakhirGalat,
    definisi: DEFINISI.map((definisi) => ({
      ...definisi,
      ...bolehJalan(runtimeConfig, definisi),
    })),
  };
}

/**
 * Menyalakan pewaktu. Detaknya tiap menit; yang menentukan kapan benar-benar
 * berjalan adalah intervalMenit pada konfigurasi yang dibaca SAAT ITU -
 * sehingga mengubah jaraknya dari portal berlaku tanpa menyalakan ulang bot.
 */
function mulai() {
  if (pewaktu) return;
  keadaan.aktif = true;

  let terakhirDetak = 0;
  const detak = () => {
    const runtimeConfig = readRuntimeConfig();
    const fitur = runtimeConfig.kirimSaatLengkap || {};
    if (fitur.enabled !== true) return;
    const jarakMs = Math.max(5, Number(fitur.intervalMenit) || 15) * 60 * 1000;
    if (Date.now() - terakhirDetak < jarakMs) return;
    terakhirDetak = Date.now();
    jalankan({ pratinjau: false, pemicu: "jadwal" }).catch(() => {});
  };

  pewaktu = setInterval(detak, 60 * 1000);
  if (pewaktu.unref) pewaktu.unref();

  // Putaran pertama ditunda supaya tidak menambah beban saat bot baru
  // menyala dan sedang menyambung ke WhatsApp.
  const awal = setTimeout(detak, 3 * 60 * 1000);
  if (awal.unref) awal.unref();
}

function hentikan() {
  if (pewaktu) clearInterval(pewaktu);
  pewaktu = null;
  keadaan.aktif = false;
}

module.exports = {
  DEFINISI,
  SUMBER_FITUR,
  bolehJalan,
  cocokkanPegawai,
  definisiMenurutKunci,
  hentikan,
  jalankan,
  kunciIdempoten,
  mulai,
  namaKunci,
  perkaraLengkap,
  sebutanPetugas,
  sebutanPihak,
  status,
  susunPesanPegawai,
  susunPesanPihak,
  tulisJam,
  tulisTanggalPanjang,
};
