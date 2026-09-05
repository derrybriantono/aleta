"use strict";

/**
 * Siapa yang hadir, dan siapa yang lebih dulu.
 *
 * ============================================================================
 * KENAPA TIDAK DISIMPAN DI TABEL ANTRIAN
 * ============================================================================
 *
 * Tabel aplikasi antrian hanya punya TIGA kolom waktu: pihak_1, pihak_2, dan
 * saksi. Ia tidak dapat membedakan Penggugat I dari Penggugat II, tidak
 * mengenal turut tergugat maupun intervenien, dan tidak tahu apakah yang
 * datang pihaknya sendiri atau kuasanya.
 *
 * Menambah kolom ke sana berarti mengubah skema aplikasi milik orang lain -
 * aplikasi yang sedang dipakai mesin di ruang tunggu, dan yang pembaruannya
 * tidak kita kendalikan. Karena itu rinciannya disimpan di basis data ALETA
 * sendiri, sementara tabel antrian tetap menerima yang dipahaminya: satu
 * waktu untuk sisi penggugat, satu untuk sisi tergugat, satu untuk saksi.
 *
 * Pembagian kerjanya jelas: aplikasi antrian memegang NOMOR, ALETA memegang
 * KETERANGAN. Nomornya tetap satu-satunya yang menentukan giliran.
 *
 * ============================================================================
 * DUA BASIS WAKTU YANG TIDAK BOLEH DIBANDINGKAN
 * ============================================================================
 *
 * ALETA menyimpan waktu dalam UTC (toMysqlDate) dan membacanya kembali sebagai
 * UTC. Aplikasi antrian menulis NOW() - waktu lokal servernya. Keduanya benar
 * di tempatnya masing-masing, tetapi TIDAK sebanding: mengurangkan waktu_hadir
 * ALETA dari pihak_1 aplikasi antrian menghasilkan selisih sebesar zona
 * waktunya, delapan jam di WITA.
 *
 * Karena itu urutan antrian dihitung SEPENUHNYA dari kolom milik aplikasi
 * antrian, dan waktu ALETA hanya dipakai mengurutkan kehadiran di dalam ALETA
 * sendiri. Keduanya tidak pernah bertemu dalam satu perhitungan.
 *
 * ============================================================================
 * WAKTU HADIR TERAWAL TIDAK PERNAH DITIMPA
 * ============================================================================
 *
 * Nomor antrian lahir dari waktu pengambilan terawal. Karena itu kedatangan
 * KEDUA pada sisi yang sama - Penggugat II menyusul Penggugat I - dicatat
 * sebagai kehadiran tersendiri di ALETA, tetapi TIDAK menyentuh kolom waktu di
 * tabel antrian. Menimpanya akan memundurkan perkara itu di antrian hanya
 * karena ada orang kedua yang datang.
 */

const crypto = require("crypto");

const botDb = require("./botDbService");
const externalDbService = require("./externalDbService");
const { cleanText } = require("./ecourtTextService");

/** Sambungan yang sama dengan pembaca antrian. */
const KUNCI_KONEKSI = "antrian_sidang";

/**
 * Peran yang dapat hadir, beserta sisi antriannya.
 *
 * `sisi` menentukan kolom mana di tabel antrian yang diisi. Tabel itu hanya
 * mengenal dua sisi dan saksi, jadi seluruh peran harus jatuh ke salah satunya.
 *
 * Intervenien sengaja diberi sisi penggugat sebagai BAWAAN, bukan sebagai
 * ketentuan: ia masuk atas kehendaknya sendiri dan kerap berdiri di sisi
 * penggugat, tetapi tidak selalu. Petugas dapat menyebutkan sisinya sendiri,
 * dan itulah yang dipakai bila disebutkan.
 */
const PERAN = [
  { kunci: "penggugat", label: "Penggugat", sisi: "pihak_1" },
  { kunci: "pemohon", label: "Pemohon", sisi: "pihak_1" },
  { kunci: "tergugat", label: "Tergugat", sisi: "pihak_2" },
  { kunci: "termohon", label: "Termohon", sisi: "pihak_2" },
  { kunci: "turut-tergugat", label: "Turut Tergugat", sisi: "pihak_2" },
  { kunci: "intervenien", label: "Intervenien", sisi: "pihak_1" },
  { kunci: "saksi", label: "Saksi", sisi: "saksi" },
];

const PETA_PERAN = new Map(PERAN.map((x) => [x.kunci, x]));

/** Kolom waktu di tabel antrian, menurut sisi. */
const KOLOM_SISI = { pihak_1: "pihak_1", pihak_2: "pihak_2", saksi: "saksi" };

let skemaSiap = false;

async function ensureSchema() {
  if (skemaSiap) return true;

  await botDb.query(`
    CREATE TABLE IF NOT EXISTS aleta_bot_antrian_kehadiran (
      id VARCHAR(64) PRIMARY KEY,
      perkara_id VARCHAR(32) NOT NULL,
      nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
      tanggal DATE NOT NULL,
      peran VARCHAR(32) NOT NULL,
      urutan_pihak VARCHAR(16) NOT NULL DEFAULT '',
      sebagai_kuasa TINYINT(1) NOT NULL DEFAULT 0,
      nama VARCHAR(191) NOT NULL DEFAULT '',
      sisi VARCHAR(16) NOT NULL DEFAULT '',
      waktu_hadir DATETIME NOT NULL,
      sumber VARCHAR(16) NOT NULL DEFAULT 'aleta',
      wa_chat_id VARCHAR(64) NOT NULL DEFAULT '',
      dicatat_oleh VARCHAR(191) NOT NULL DEFAULT '',
      diberitahu_pada DATETIME NULL,
      INDEX idx_kehadiran_perkara (perkara_id, tanggal),
      INDEX idx_kehadiran_tanggal (tanggal)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  skemaSiap = true;
  return true;
}

/** Dipakai pengujian supaya skema tidak dianggap sudah terpasang. */
function lupakan() {
  skemaSiap = false;
}

function hariIni() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function tanggalSah(nilai) {
  const teks = String(nilai || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) ? teks : "";
}

/**
 * Sebutan lengkap satu kehadiran - "Kuasa Penggugat II", "Turut Tergugat I".
 *
 * Disusun di sini, bukan di layar, supaya WhatsApp, layar antrian, dan layar
 * petugas menyebutnya dengan kalimat yang sama persis. Sebutan yang berbeda
 * untuk orang yang sama membuat petugas mengira ada dua orang.
 */
function sebutan({ peran, urutanPihak = "", sebagaiKuasa = false }) {
  const acuan = PETA_PERAN.get(String(peran || ""));
  const dasar = acuan ? acuan.label : cleanText(peran);
  const nomor = cleanText(urutanPihak);
  const inti = nomor ? `${dasar} ${nomor}` : dasar;
  return sebagaiKuasa ? `Kuasa ${inti}` : inti;
}

/**
 * Mencatat satu kehadiran.
 *
 * Dua hal terjadi, dan keduanya harus dipahami terpisah:
 *
 *   1. Rinciannya disimpan di ALETA - selalu, tiap orang yang datang.
 *   2. Kolom waktu di tabel antrian diisi HANYA bila masih kosong. Itulah yang
 *      menentukan nomor, dan nomor tidak boleh berubah karena orang kedua
 *      dari sisi yang sama ikut datang.
 */
async function catatHadir({
  perkaraId,
  nomorPerkara = "",
  tanggal = "",
  peran,
  urutanPihak = "",
  sebagaiKuasa = false,
  nama = "",
  sisi = "",
  sumber = "aleta",
  waChatId = "",
  dicatatOleh = "",
} = {}) {
  const id = String(perkaraId || "").trim();
  if (!id) return { ok: false, alasan: "perkara_id_kosong" };

  const acuan = PETA_PERAN.get(String(peran || ""));
  if (!acuan) return { ok: false, alasan: "peran_tidak_dikenali" };

  // Sisi boleh disebutkan pemanggil - dipakai untuk intervenien, yang tidak
  // selalu berdiri di sisi penggugat. Yang tidak dikenali jatuh ke bawaan.
  const sisiDipakai = KOLOM_SISI[String(sisi || "")] ? String(sisi) : acuan.sisi;
  const hari = tanggalSah(tanggal) || hariIni();

  await ensureSchema();
  const sekarang = new Date();

  await botDb.query(
    `INSERT INTO aleta_bot_antrian_kehadiran
       (id, perkara_id, nomor_perkara, tanggal, peran, urutan_pihak, sebagai_kuasa,
        nama, sisi, waktu_hadir, sumber, wa_chat_id, dicatat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      // Kunci dari waktu SAJA dapat bentrok: dua tekanan yang jatuh pada
      // milidetik yang sama menghasilkan kunci yang sama persis, dan yang
      // kedua ditolak sebagai baris kembar. Ekor acak menutupnya - kunci ini
      // tidak dipakai mencocokkan apa pun, hanya membedakan baris.
      `kh-${id}-${sekarang.getTime()}-${crypto.randomBytes(4).toString("hex")}`,
      id,
      cleanText(nomorPerkara).slice(0, 191),
      hari,
      acuan.kunci,
      cleanText(urutanPihak).slice(0, 16),
      sebagaiKuasa ? 1 : 0,
      cleanText(nama).slice(0, 191),
      sisiDipakai,
      botDb.toMysqlDate(sekarang),
      ["aleta", "whatsapp", "mesin"].includes(String(sumber)) ? String(sumber) : "aleta",
      cleanText(waChatId).slice(0, 64),
      cleanText(dicatatOleh).slice(0, 191),
    ]
  );

  // Kolom waktu di tabel antrian diisi hanya bila masih kosong - COALESCE
  // menjaga waktu terawal, sama seperti jalur WhatsApp.
  //
  // Disaring tanggal_sidang = CURDATE() sebab tabel itu menyimpan satu baris
  // untuk tiap tanggal sidang. Tanpa saringan, kehadiran hari ini akan mengisi
  // waktu pengambilan pada baris sidang perkara ini yang sudah lewat, dan
  // baris lama itu ikut terbawa ke penomoran - satu orang datang, dua nomor
  // antrian terbit.
  const kolom = KOLOM_SISI[sisiDipakai];
  let antrianDiisi = false;
  try {
    const hasil = await externalDbService.query(
      KUNCI_KONEKSI,
      `UPDATE sipp_turunan_antrian.antrian_sidang
          SET ${kolom} = COALESCE(${kolom}, NOW())
        WHERE perkara_id = ? AND tanggal_sidang = CURDATE() AND ${kolom} IS NULL`,
      [id]
    );
    antrianDiisi = Number(hasil && hasil.affectedRows) > 0;
  } catch (galat) {
    // Kehadirannya tetap tercatat di ALETA. Yang gagal hanya pengisian waktu
    // di aplikasi antrian, dan itu disebutkan - bukan didiamkan, sebab
    // akibatnya perkara ini tidak mendapat nomor.
    return {
      ok: true,
      antrianDiisi: false,
      alasanAntrian: String((galat && galat.message) || galat).slice(0, 200),
      sebutan: sebutan({ peran: acuan.kunci, urutanPihak, sebagaiKuasa }),
      sisi: sisiDipakai,
    };
  }

  return {
    ok: true,
    antrianDiisi,
    alasanAntrian: "",
    sebutan: sebutan({ peran: acuan.kunci, urutanPihak, sebagaiKuasa }),
    sisi: sisiDipakai,
  };
}

/**
 * Siapa saja yang hadir pada sekumpulan perkara, terurut menurut kedatangan.
 *
 * Yang PERTAMA hadir disebutkan tersendiri: itulah yang menentukan nomor
 * antrian perkara tersebut, dan itu pula yang paling sering ditanya petugas -
 * "yang datang duluan siapa, penggugat atau tergugat".
 */
async function daftarKehadiran(daftarPerkaraId = [], tanggal = "") {
  await ensureSchema();
  const hari = tanggalSah(tanggal) || hariIni();

  const id = [...new Set(daftarPerkaraId.map((x) => String(x || "")).filter(Boolean))];
  if (id.length === 0) return {};

  const peta = {};
  for (let mulai = 0; mulai < id.length; mulai += 500) {
    const bagian = id.slice(mulai, mulai + 500);
    const isian = bagian.map(() => "?").join(", ");
    const rows = await botDb.query(
      `SELECT perkara_id AS perkaraId, peran, urutan_pihak AS urutanPihak,
              sebagai_kuasa AS sebagaiKuasa, nama, sisi, waktu_hadir AS waktuHadir,
              sumber, wa_chat_id AS waChatId
         FROM aleta_bot_antrian_kehadiran
        WHERE tanggal = ? AND perkara_id IN (${isian})
        ORDER BY waktu_hadir ASC`,
      [hari, ...bagian]
    );

    for (const row of Array.isArray(rows) ? rows : []) {
      const kunci = String(row.perkaraId || "");
      if (!peta[kunci]) peta[kunci] = { hadir: [], pertama: null };

      const waktu = botDb.fromMysqlDate(row.waktuHadir);
      const satu = {
        peran: String(row.peran || ""),
        urutanPihak: String(row.urutanPihak || ""),
        sebagaiKuasa: Number(row.sebagaiKuasa) === 1,
        nama: String(row.nama || ""),
        sisi: String(row.sisi || ""),
        sumber: String(row.sumber || ""),
        waktuHadir: waktu ? waktu.toISOString() : "",
        jam: waktu
          ? `${String(waktu.getHours()).padStart(2, "0")}:${String(waktu.getMinutes()).padStart(2, "0")}`
          : "",
        sebutan: sebutan({
          peran: row.peran,
          urutanPihak: row.urutanPihak,
          sebagaiKuasa: Number(row.sebagaiKuasa) === 1,
        }),
      };

      peta[kunci].hadir.push(satu);
      if (!peta[kunci].pertama) peta[kunci].pertama = satu;
    }
  }

  return peta;
}

/**
 * ============================================================================
 * PEMBERITAHUAN "TINGGAL SATU LAGI"
 * ============================================================================
 *
 * Yang paling berguna bagi orang yang menunggu bukan nomornya - itu sudah ia
 * pegang sejak mengambil - melainkan tahu KAPAN harus bersiap. Ruang tunggu
 * pengadilan tidak selalu terdengar sampai kantin dan halaman parkir, dan
 * orang yang melewatkan panggilannya harus menunggu satu putaran penuh.
 *
 * Yang dihitung: berapa banyak yang MASIH MENUNGGU di depannya. Bukan selisih
 * nomor - nomor yang sudah dipanggil tidak lagi menghalangi siapa pun, dan
 * menghitung dari selisih nomor akan menahan pemberitahuan yang seharusnya
 * sudah dikirim.
 *
 * Hanya yang mengambil lewat WhatsApp yang dapat diberitahu; yang mengambil di
 * mesin tidak meninggalkan nomor kontak, dan menebaknya dari data perkara
 * berarti mengirim pesan kepada orang yang tidak pernah meminta.
 */
function hitungHampirGiliran(peta, { jarak = 2 } = {}) {
  const semua = Object.entries(peta || {})
    .map(([perkaraId, baris]) => ({ perkaraId, ...baris }))
    .filter((x) => Number.isFinite(Number(x.nomor)) && x.nomor !== null);

  const menunggu = semua
    .filter((x) => x.keadaan === "menunggu")
    .sort((a, b) => Number(a.nomor) - Number(b.nomor));

  // ==========================================================================
  // DIHITUNG PER RUANG, BUKAN SATU DERET UNTUK SELURUH PENGADILAN
  // ==========================================================================
  //
  // Nomor antriannya memang satu deret, tetapi PEMANGGILANNYA berjalan
  // bersamaan di beberapa ruang. Menghitung "berapa yang di depan" atas
  // seluruh pengadilan membuat orang yang sebenarnya berikutnya di ruangannya
  // tampak masih enam antrian lagi - dan pemberitahuannya baru terkirim
  // sesudah ia dipanggil. Terlambat memberitahu lebih merugikan daripada tidak
  // memberitahu sama sekali: yang tidak diberitahu setidaknya tetap menunggu
  // di dekat ruangan.
  //
  // Perkara yang ruangnya belum diketahui jatuh ke satu kelompok bersama, dan
  // di situ perilakunya kembali seperti satu deret - yang benar, sebab tidak
  // ada dasar untuk memisahkannya.
  const perRuang = new Map();
  for (const baris of menunggu) {
    const kunci = baris.noRuang === null || baris.noRuang === undefined ? "tanpa-ruang" : String(baris.noRuang);
    if (!perRuang.has(kunci)) perRuang.set(kunci, []);
    perRuang.get(kunci).push(baris);
  }

  const batas = Math.max(0, Number(jarak) || 0);
  const hasil = [];
  for (const daftar of perRuang.values()) {
    daftar.forEach((baris, urutan) => {
      if (urutan <= batas) hasil.push({ ...baris, didepan: urutan });
    });
  }

  return hasil.sort((a, b) => Number(a.nomor) - Number(b.nomor));
}

/**
 * Menyusun pemberitahuan untuk yang hampir gilirannya.
 *
 * Fungsi murni: peta antrian dan peta kehadiran masuk, daftar pesan keluar.
 * Yang mengirim ada di pemanggilnya - dengan begitu keputusan siapa yang
 * diberitahu dapat diuji tanpa mengirim satu pesan pun.
 */
function susunPesanHampirGiliran(petaAntrian, petaKehadiran, { jarak = 2 } = {}) {
  const hampir = hitungHampirGiliran(petaAntrian, { jarak });
  const pesan = [];

  for (const baris of hampir) {
    const kehadiran = (petaKehadiran || {})[String(baris.perkaraId)];
    if (!kehadiran || !Array.isArray(kehadiran.hadir)) continue;

    // Satu pesan per NOMOR KONTAK, bukan per orang yang hadir: dua kehadiran
    // dari kuasa yang sama tidak boleh menghasilkan dua pesan yang sama.
    const perNomor = new Map();
    for (const orang of kehadiran.hadir) {
      const nomor = cleanText(orang.waChatId);
      if (!nomor || orang.sudahDiberitahu) continue;
      if (!perNomor.has(nomor)) perNomor.set(nomor, orang);
    }

    for (const [nomor, orang] of perNomor) {
      const sisa = baris.didepan;
      pesan.push({
        perkaraId: String(baris.perkaraId),
        waChatId: nomor,
        nama: orang.nama,
        sebutan: orang.sebutan,
        nomorAntrian: Number(baris.nomor),
        didepan: sisa,
        ruang: baris.noRuang,
        teks:
          sisa === 0
            ? `Antrian nomor *${baris.nomor}* — giliran Anda BERIKUTNYA. ` +
              `Mohon bersiap di depan ${baris.noRuang ? `Ruang Sidang ${baris.noRuang}` : "ruang sidang"}.`
            : `Antrian nomor *${baris.nomor}* — tinggal ${sisa} antrian lagi sebelum giliran Anda. ` +
              `Mohon menuju ${baris.noRuang ? `Ruang Sidang ${baris.noRuang}` : "ruang sidang"}.`,
      });
    }
  }

  return pesan;
}

/**
 * ============================================================================
 * "CEK ANTRIAN" - PIHAK BERTANYA SENDIRI, TANPA MENGANTRE DI MEJA PETUGAS
 * ============================================================================
 *
 * Pertanyaan yang paling sering diajukan di ruang tunggu bukan "berapa nomor
 * saya" - itu sudah dipegangnya - melainkan "masih berapa lagi". Selama ini
 * jawabannya hanya ada pada petugas, dan setiap kali ditanya, petugas berhenti
 * mengerjakan yang lain.
 *
 * Jawabannya disusun dari deret yang sama persis dengan yang dipakai layar,
 * dan dihitung PER RUANG - sebab itulah yang menentukan kapan ia benar-benar
 * dipanggil.
 */
function susunJawabanCekAntrian(petaAntrian, perkaraId) {
  const kunci = String(perkaraId || "");
  const baris = (petaAntrian || {})[kunci];

  if (!baris) {
    return "Perkara ini belum terdaftar pada antrian sidang hari ini. Silakan menghubungi petugas.";
  }

  if (baris.nomor === null) {
    return (
      "Perkara Anda terdaftar pada antrian hari ini, tetapi belum ada yang mengambil nomornya. " +
      "Kirim *ambil antrian* untuk mengambil, atau ambil di mesin antrian ruang tunggu."
    );
  }

  if (baris.keadaan === "dipanggil") {
    return (
      `Nomor antrian Anda *${baris.nomor}* dan SUDAH DIPANGGIL` +
      `${baris.jamPanggil ? ` pukul ${baris.jamPanggil}` : ""}. ` +
      `Mohon segera menuju ${baris.noRuang ? `Ruang Sidang ${baris.noRuang}` : "ruang sidang"}.`
    );
  }

  // Jaraknya dihitung dengan aturan yang sama dengan pemberitahuan otomatis:
  // yang masih menunggu di ruang yang sama, bukan di seluruh pengadilan.
  const sekelompok = Object.values(petaAntrian || {})
    .filter((x) => x.keadaan === "menunggu" && x.nomor !== null)
    .filter((x) =>
      baris.noRuang === null || baris.noRuang === undefined
        ? x.noRuang === null || x.noRuang === undefined
        : Number(x.noRuang) === Number(baris.noRuang)
    )
    .sort((a, b) => Number(a.nomor) - Number(b.nomor));

  const didepan = sekelompok.findIndex((x) => Number(x.nomor) === Number(baris.nomor));
  const ruang = baris.noRuang ? `Ruang Sidang ${baris.noRuang}` : "ruang sidang";

  if (didepan <= 0) {
    return `Nomor antrian Anda *${baris.nomor}* — giliran Anda BERIKUTNYA di ${ruang}. Mohon bersiap.`;
  }

  return (
    `Nomor antrian Anda *${baris.nomor}* di ${ruang}. ` +
    `Masih ada ${didepan} antrian lagi sebelum giliran Anda.`
  );
}

/** Kehadiran yang belum diberitahu, beserta nomor kontaknya. */
async function kehadiranBelumDiberitahu(daftarPerkaraId = [], tanggal = "") {
  await ensureSchema();
  const hari = tanggalSah(tanggal) || hariIni();
  const id = [...new Set(daftarPerkaraId.map((x) => String(x || "")).filter(Boolean))];
  if (id.length === 0) return {};

  const isian = id.map(() => "?").join(", ");
  const rows = await botDb.query(
    `SELECT id, perkara_id AS perkaraId, peran, urutan_pihak AS urutanPihak,
            sebagai_kuasa AS sebagaiKuasa, nama, wa_chat_id AS waChatId
       FROM aleta_bot_antrian_kehadiran
      WHERE tanggal = ? AND wa_chat_id <> '' AND diberitahu_pada IS NULL
        AND perkara_id IN (${isian})`,
    [hari, ...id]
  );

  const peta = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const kunci = String(row.perkaraId || "");
    if (!peta[kunci]) peta[kunci] = { hadir: [] };
    peta[kunci].hadir.push({
      id: String(row.id || ""),
      nama: String(row.nama || ""),
      waChatId: String(row.waChatId || ""),
      sudahDiberitahu: false,
      sebutan: sebutan({
        peran: row.peran,
        urutanPihak: row.urutanPihak,
        sebagaiKuasa: Number(row.sebagaiKuasa) === 1,
      }),
    });
  }
  return peta;
}

/** Menandai bahwa satu nomor kontak sudah diberitahu untuk hari ini. */
async function tandaiDiberitahu(perkaraId, waChatId, tanggal = "") {
  await ensureSchema();
  const hari = tanggalSah(tanggal) || hariIni();
  await botDb.query(
    `UPDATE aleta_bot_antrian_kehadiran
        SET diberitahu_pada = ?
      WHERE tanggal = ? AND perkara_id = ? AND wa_chat_id = ? AND diberitahu_pada IS NULL`,
    [botDb.toMysqlDate(new Date()), hari, String(perkaraId || ""), String(waChatId || "")]
  );
}

module.exports = {
  KOLOM_SISI,
  KUNCI_KONEKSI,
  PERAN,
  catatHadir,
  daftarKehadiran,
  ensureSchema,
  hitungHampirGiliran,
  kehadiranBelumDiberitahu,
  lupakan,
  sebutan,
  susunJawabanCekAntrian,
  susunPesanHampirGiliran,
  tandaiDiberitahu,
};
