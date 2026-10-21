"use strict";

/**
 * ============================================================================
 * ANTREAN TULISAN SIPP DI LUAR JAM KERJA (keputusan pengguna 104, 18 Okt 2026)
 * ============================================================================
 *
 * Tulisan OTOMATIS ke basis data SIPP (Kasir otomatis) yang jatuh di luar jam
 * kerja atau pada hari libur tidak ditulis seketika. Ia diantrekan di basis data
 * ALETA dan dikerjakan sendiri pada jam kerja berikutnya. Tulisan MANUAL di luar
 * jam kerja ditanyakan dulu kepada petugas (gerbangManual): Antrekan (bawaan)
 * atau Tulis sekarang - tidak pernah diblok diam-diam.
 *
 * Yang dijaga:
 *   - TAHAN RESTART: antrean di tabel aleta_bot_antrean_tulis_sipp, bukan di
 *     memori proses. Baris yang sedang "jalan" ketika proses mati dikembalikan
 *     ke "menunggu" saat mulai; pelaksananya sendiri menolak menulis dua kali
 *     (Kasir sekaliPerJenis, penetapan *_sudah_ada, tunda sidang_sudah_ditunda).
 *   - TIDAK DOBEL: `kunci` UNIK. Kasir otomatis yang terpicu tiap 10 menit untuk
 *     perkara yang sama tidak menambah baris kedua.
 *   - BERURUTAN: satu baris sekali jalan; baris diambil dengan UPDATE bersyarat
 *     (status='menunggu') sehingga dua pekerja tidak mengambil baris yang sama.
 *   - POLA PETUGAS: baris pertama dikerjakan 5-45 menit sesudah jam kerja
 *     dibuka (petugas tidak mulai tepat 07.30.00); antarbaris berjarak menurut
 *     jenisnya (Kasir 20-150 dtk - terukur 18 Okt 2026, median 76 dtk).
 *   - TANGGAL PERISTIWA tidak berubah: muatan menyimpan permintaan aslinya
 *     (tanggal transaksi, tanggal sidang, tanggal penetapan) apa adanya.
 *
 * Jam: jadwal disimpan dalam jam SATKER (WITA), sama dengan jamKerjaService.
 */

const jamKerja = require("./jamKerjaService");

const TABEL = "aleta_bot_antrean_tulis_sipp";

const SQL_SKEMA = `
  CREATE TABLE IF NOT EXISTS ${TABEL} (
    id BIGINT NOT NULL AUTO_INCREMENT,
    kunci VARCHAR(191) NOT NULL,
    jenis VARCHAR(64) NOT NULL,
    muatan MEDIUMTEXT NOT NULL,
    keterangan VARCHAR(500) NOT NULL DEFAULT '',
    asal VARCHAR(16) NOT NULL DEFAULT 'otomatis',
    dibuat_satker DATETIME NOT NULL,
    jadwal_satker DATETIME NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'menunggu',
    percobaan INT NOT NULL DEFAULT 0,
    mulai_satker DATETIME NULL,
    selesai_satker DATETIME NULL,
    hasil TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_antrean_tulis_kunci (kunci),
    INDEX idx_antrean_tulis_jadwal (status, jadwal_satker, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

/** Jarak antarbaris (detik, log-seragam) menurut jenis - pola petugas. */
const JEDA_ANTARBARIS = Object.freeze({
  "kasir-otomatis": [20, 150],
  "kasir-manual": [20, 150],
  bawaan: [60, 600],
});
/** Baris pertama sesudah jam kerja dibuka: 5-45 menit. */
const SEBARAN_PAGI_DETIK = [5 * 60, 45 * 60];
/**
 * Penetapan: 45-120 menit sesudah 07.30 WITA (08.15-09.30). Petugas 2026
 * menginput PMH paling awal p5 08.54 WITA; mesin jam penetapan juga tidak
 * menyusun rangkaian sebelum 07.00 jam SIPP (08.00 WITA).
 */
const SEBARAN_PAGI_PER_JENIS = Object.freeze({ "penetapan-rantai": [45 * 60, 120 * 60] });
const BATAS_PERCOBAAN = 3;

function logSeragam([min, maks], acak = Math.random) {
  const u = Math.min(Math.max(Number(acak()) || 0, 0), 1);
  return Math.round(min * Math.pow(maks / min, u));
}

function tambahDetik(waktu, detik) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(waktu || ""));
  if (!m) return waktu;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + detik * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(
    d.getUTCMinutes()
  )}:${p(d.getUTCSeconds())}`;
}

function teks(nilai) {
  if (nilai instanceof Date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${nilai.getFullYear()}-${p(nilai.getMonth() + 1)}-${p(nilai.getDate())} ${p(nilai.getHours())}:${p(
      nilai.getMinutes()
    )}:${p(nilai.getSeconds())}`;
  }
  return String(nilai === null || nilai === undefined ? "" : nilai);
}

/**
 * Antrean jam kerja menyala? ALETA_ANTREAN_TULIS_SIPP_AKTIF=0 mematikannya.
 * Di bawah vitest bawaannya MATI (uji lain berjalan pada jam dinding malam
 * dan tidak boleh tersasar ke antrean) kecuali disetel "1".
 */
function aktif() {
  const env = String(process.env.ALETA_ANTREAN_TULIS_SIPP_AKTIF || "");
  if (env === "0") return false;
  if (process.env.VITEST && env !== "1") return false;
  return true;
}

function buatLayanan({ db, sekarang = () => jamKerja.sekarangSatker(), acak = Math.random, libur, aktif: aktifFn = aktif } = {}) {
  const basis = db || require("./botDbService");
  const q = (sql, params = []) => basis.query(sql, params);
  const opsiLibur = libur ? { libur } : {};
  let skemaSiap = false;
  const pelaksana = new Map();

  async function pastikanSkema() {
    if (skemaSiap) return;
    await q(SQL_SKEMA);
    skemaSiap = true;
  }

  /**
   * Jadwal kerja untuk tulisan yang diantrekan sekarang: awal jam kerja
   * berikutnya + sebaran pagi, dan tidak pernah sebelum `sekarang`.
   */
  function jadwalUntuk(waktu = sekarang(), jenis = "") {
    const awal = jamKerja.jamKerjaBerikutnya(waktu, opsiLibur);
    if (!awal) return "";
    return tambahDetik(awal, logSeragam(SEBARAN_PAGI_PER_JENIS[jenis] || SEBARAN_PAGI_DETIK, acak));
  }

  /** Antrekan satu tulisan. Kunci yang sama tidak menambah baris kedua. */
  async function antrekan({ jenis, kunci, muatan, keterangan = "", asal = "otomatis" }) {
    if (!jenis || !kunci) return { ok: false, alasan: "antrean_tanpa_kunci" };
    await pastikanSkema();
    const kini = sekarang();
    const jadwal = jadwalUntuk(kini, jenis);
    if (!jadwal) return { ok: false, alasan: "jam_kerja_berikutnya_tidak_terhitung" };
    const hasil = await q(
      `INSERT INTO ${TABEL} (kunci, jenis, muatan, keterangan, asal, dibuat_satker, jadwal_satker)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [String(kunci).slice(0, 191), String(jenis).slice(0, 64), JSON.stringify(muatan || {}), String(keterangan).slice(0, 500), asal, kini, jadwal]
    );
    const baru = Number(hasil && hasil.affectedRows) === 1;
    const id = Number(hasil && hasil.insertId) || 0;
    let jadwalBerlaku = jadwal;
    if (!baru && id) {
      const ada = await q(`SELECT DATE_FORMAT(jadwal_satker, '%Y-%m-%d %H:%i:%s') AS jadwal, status FROM ${TABEL} WHERE id = ? LIMIT 1`, [id]);
      if (Array.isArray(ada) && ada[0]) jadwalBerlaku = teks(ada[0].jadwal);
    }
    return { ok: true, diantrekan: true, baru, id, dikerjakanPada: jadwalBerlaku, kalimat: jamKerja.kalimatDiantrekan(jadwalBerlaku) };
  }

  /** Baris yang masih menunggu, terdekat dulu - untuk layar. */
  async function daftarMenunggu({ batas = 50 } = {}) {
    await pastikanSkema();
    const baris = await q(
      `SELECT id, kunci, jenis, keterangan, asal, status, percobaan,
              DATE_FORMAT(jadwal_satker, '%Y-%m-%d %H:%i:%s') AS jadwal
         FROM ${TABEL} WHERE status IN ('menunggu','jalan') ORDER BY jadwal_satker, id LIMIT ${Math.min(Math.max(Number(batas) || 50, 1), 200)}`
    );
    return (Array.isArray(baris) ? baris : []).map((b) => ({ ...b, jadwal: teks(b.jadwal), kalimat: jamKerja.kalimatDiantrekan(teks(b.jadwal)) }));
  }

  /**
   * Baris berawalan kunci tertentu (mis. "sidang-tunda:otomatis:") yang dibuat
   * sejak `sejak` (WITA) - untuk daftar hasil tunda otomatis. Hanya membaca.
   */
  async function daftarMenurutAwalan({ awalan, sejak = "", batas = 200 } = {}) {
    const pola = String(awalan || "");
    if (!pola) return [];
    await pastikanSkema();
    const baris = await q(
      `SELECT id, kunci, jenis, asal, status, percobaan, hasil,
              DATE_FORMAT(jadwal_satker, '%Y-%m-%d %H:%i:%s') AS jadwal,
              DATE_FORMAT(dibuat_satker, '%Y-%m-%d %H:%i:%s') AS dibuat,
              DATE_FORMAT(selesai_satker, '%Y-%m-%d %H:%i:%s') AS selesai
         FROM ${TABEL}
        WHERE kunci LIKE ? AND dibuat_satker >= ?
        ORDER BY id DESC LIMIT ${Math.min(Math.max(Number(batas) || 200, 1), 500)}`,
      [`${pola.replace(/[\\%_]/g, (h) => `\\${h}`)}%`, String(sejak || "1970-01-01 00:00:00")]
    );
    return (Array.isArray(baris) ? baris : []).map((b) => ({
      ...b,
      jadwal: teks(b.jadwal),
      dibuat: teks(b.dibuat),
      selesai: teks(b.selesai),
      kalimat: b.status === "menunggu" ? jamKerja.kalimatDiantrekan(teks(b.jadwal)) : "",
    }));
  }

  /**
   * Membatalkan baris OTOMATIS yang masih menunggu (tombol "jangan tunda
   * otomatis" sesudah daftar diantrekan). Baris manual tidak pernah disentuh;
   * yang sedang jalan/selesai tidak dapat dibatalkan.
   */
  async function batalkanOtomatis(kunci) {
    if (!kunci) return { ok: false, alasan: "antrean_tanpa_kunci" };
    await pastikanSkema();
    const r = await q(
      `UPDATE ${TABEL} SET status = 'batal', selesai_satker = ?, hasil = ?
        WHERE kunci = ? AND asal = 'otomatis' AND status = 'menunggu'`,
      [sekarang(), JSON.stringify({ ok: false, alasan: "dibatalkan_petugas" }), String(kunci).slice(0, 191)]
    );
    const n = Number(r && r.affectedRows) || 0;
    return { ok: n === 1, dibatalkan: n === 1, alasan: n === 1 ? "" : "tidak_ada_yang_menunggu" };
  }

  /** Sesudah restart: baris yang tertinggal "jalan" kembali menunggu. */
  async function pulihkan() {
    await pastikanSkema();
    const r = await q(`UPDATE ${TABEL} SET status = 'menunggu' WHERE status = 'jalan'`);
    return Number(r && r.affectedRows) || 0;
  }

  function daftarkanPelaksana(jenis, fungsi) {
    if (typeof fungsi === "function") pelaksana.set(String(jenis), fungsi);
  }

  /**
   * Mengerjakan SATU baris yang jatuh tempo. Di luar jam kerja tidak ada yang
   * dikerjakan. Pulang { dikerjakan, id, jenis, ok } atau { dikerjakan:false }.
   */
  async function kerjakanSatu() {
    await pastikanSkema();
    const kini = sekarang();
    if (!jamKerja.dalamJamKerja(kini, opsiLibur)) return { dikerjakan: false, sebab: "di_luar_jam_kerja" };
    const calon = await q(
      `SELECT id, jenis, muatan FROM ${TABEL}
        WHERE status = 'menunggu' AND jadwal_satker <= ?
        ORDER BY jadwal_satker, id LIMIT 1`,
      [kini]
    );
    const satu = Array.isArray(calon) && calon[0];
    if (!satu) return { dikerjakan: false, sebab: "kosong" };
    const ambil = await q(
      `UPDATE ${TABEL} SET status = 'jalan', percobaan = percobaan + 1, mulai_satker = ?
        WHERE id = ? AND status = 'menunggu'`,
      [kini, satu.id]
    );
    if (Number(ambil && ambil.affectedRows) !== 1) return { dikerjakan: false, sebab: "diambil_pekerja_lain" };
    const fungsi = pelaksana.get(String(satu.jenis));
    let hasil;
    try {
      if (!fungsi) throw new Error(`pelaksana_tidak_ada:${satu.jenis}`);
      hasil = await fungsi(JSON.parse(String(satu.muatan || "{}")));
    } catch (galat) {
      hasil = { ok: false, alasan: String((galat && galat.message) || galat).slice(0, 300) };
    }
    const ok = Boolean(hasil && hasil.ok !== false);
    const percobaan = await q(`SELECT percobaan FROM ${TABEL} WHERE id = ? LIMIT 1`, [satu.id]);
    const ke = Number((Array.isArray(percobaan) && percobaan[0] && percobaan[0].percobaan) || 1);
    const statusAkhir = ok ? "selesai" : ke >= BATAS_PERCOBAAN ? "gagal" : "menunggu";
    await q(
      `UPDATE ${TABEL} SET status = ?, selesai_satker = ?, hasil = ?,
              jadwal_satker = CASE WHEN ? = 'menunggu' THEN ? ELSE jadwal_satker END
        WHERE id = ?`,
      [statusAkhir, sekarang(), JSON.stringify(hasil || {}).slice(0, 4000), statusAkhir, tambahDetik(kini, 30 * 60), satu.id]
    );
    return { dikerjakan: true, id: Number(satu.id), jenis: String(satu.jenis), ok, status: statusAkhir };
  }

  /** Lama jeda sesudah satu baris jenis itu, milidetik. */
  function jedaSesudah(jenis) {
    return logSeragam(JEDA_ANTARBARIS[jenis] || JEDA_ANTARBARIS.bawaan, acak) * 1000;
  }

  let pewaktu = null;
  let sibuk = false;
  let bolehSesudah = 0;

  /** Pekerja latar: tiap 60 detik memeriksa; satu baris sekali jalan. */
  function mulai({ selangMs = 60 * 1000 } = {}) {
    if (pewaktu) return;
    if (!aktifFn()) return;
    void pulihkan().catch(() => 0);
    pewaktu = setInterval(async () => {
      if (sibuk || Date.now() < bolehSesudah) return;
      sibuk = true;
      try {
        const r = await kerjakanSatu();
        if (r.dikerjakan) bolehSesudah = Date.now() + jedaSesudah(r.jenis);
      } catch {
        // basis data ALETA tidak menjawab - dicoba lagi pada detak berikutnya
      } finally {
        sibuk = false;
      }
    }, selangMs);
    if (pewaktu.unref) pewaktu.unref();
  }

  function berhenti() {
    if (pewaktu) clearInterval(pewaktu);
    pewaktu = null;
  }

  /**
   * GERBANG TULISAN MANUAL. null = lanjut menulis sekarang. Selain itu jawaban
   * rute yang siap dikirim.
   *
   *   - dalam jam kerja, mode kering, atau jamKerja "sekarang"  -> null
   *   - jamKerja "antrekan"                                       -> diantrekan
   *   - klien yang menyatakan tanyaJamKerja:true tanpa pilihan     -> 200 ok:false dengan
   *     pertanyaan (bawaan Antrekan)
   *   - klien lama tanpa tanda itu                                 -> null (perilaku lama;
   *     tidak diblok diam-diam)
   */
  async function gerbangManual({ badan = {}, jenis, kunci, muatan, keterangan = "" }) {
    if (badan.kering !== false || !aktifFn()) return null;
    const kini = sekarang();
    if (jamKerja.dalamJamKerja(kini, opsiLibur)) return null;
    const pilihan = String(badan.jamKerja || "").toLowerCase();
    if (pilihan === "sekarang") return null;
    if (pilihan === "antrekan") {
      // Tunda otomatis 16.30 (22 Okt 2026) tercatat sebagai tulisan OTOMATIS di antrean.
      const asal = badan.otomatis === true ? "otomatis" : "manual";
      const r = await antrekan({ jenis, kunci, muatan: { ...muatan, jamKerja: "sekarang" }, keterangan, asal });
      return { status: r.ok ? 200 : 500, body: { ...r, pesan: r.kalimat || r.alasan } };
    }
    if (badan.tanyaJamKerja === true) {
      // Yang disebut awal jam kerjanya, bukan menit acak antreannya.
      const jadwal = jamKerja.jamKerjaBerikutnya(kini, opsiLibur);
      const kalimatTanya = `Sekarang di luar jam kerja. Bila diantrekan, tulisan ini dikerjakan pada jam kerja berikutnya, ${jamKerja
        .sebutWaktu(jadwal)
        .replace(" pukul ", " mulai pukul ")} WITA. Pilih Antrekan atau Tulis sekarang.`;
      // 200, bukan 409: penghubung portal membuang badan jawaban non-2xx, padahal
      // pilihannya justru ada di badan itu.
      return {
        status: 200,
        body: {
          ok: false,
          alasan: "di_luar_jam_kerja",
          // Penghubung portal (gatewayFetch) meneruskan ok:false sebagai
          // { alasan: error, kode } - kalimat dan kodenya karena itu juga di sini.
          kode: "di_luar_jam_kerja",
          perluPilihan: true,
          dikerjakanPada: jadwal,
          pesan: kalimatTanya,
          error: kalimatTanya,
          pilihan: [
            { nilai: "antrekan", label: "Antrekan", bawaan: true },
            { nilai: "sekarang", label: "Tulis sekarang" },
          ],
        },
      };
    }
    return null;
  }

  return {
    pastikanSkema,
    jadwalUntuk,
    antrekan,
    daftarMenunggu,
    daftarMenurutAwalan,
    batalkanOtomatis,
    pulihkan,
    daftarkanPelaksana,
    kerjakanSatu,
    jedaSesudah,
    mulai,
    berhenti,
    gerbangManual,
  };
}

let bawaan = null;
function layanan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

/**
 * Menjalankan penangan rute express tanpa HTTP - untuk pelaksana antrean.
 * Penangan tulis ALETA membaca alamat audit dari badan (ip), jadi badan
 * permintaan aslinya cukup.
 */
function jalankanPenangan(penangan, badan) {
  return new Promise((selesai) => {
    let kode = 200;
    const res = {
      status(n) {
        kode = n;
        return res;
      },
      json(isi) {
        selesai({ status: kode, ...(isi && typeof isi === "object" ? isi : { isi }), ok: Boolean(isi && isi.ok !== false && kode < 400) });
        return res;
      },
    };
    Promise.resolve(penangan({ body: badan, headers: {}, query: {} }, res)).catch((galat) =>
      selesai({ ok: false, status: 500, alasan: String((galat && galat.message) || galat).slice(0, 300) })
    );
  });
}

/**
 * Membungkus penangan rute TULIS manual dengan gerbang jam kerja, dan
 * mendaftarkan pelaksana antreannya (badan asli + jamKerja "sekarang").
 *
 * @param {string} jenis
 * @param {(badan: object) => string} kunciDari  kunci unik antrean
 * @param {Function} penangan  (req, res) express
 * @param {(badan: object) => string} [keteranganDari]
 */
function manualJamKerja(jenis, kunciDari, penangan, keteranganDari = () => "") {
  layanan().daftarkanPelaksana(jenis, (muatan) => jalankanPenangan(penangan, muatan.badan || {}));
  return async (req, res, next) => {
    const badan = req.body || {};
    let gerbang = null;
    try {
      gerbang = await layanan().gerbangManual({
        badan,
        jenis,
        kunci: `${jenis}:${kunciDari(badan)}`,
        muatan: { badan: { ...badan, jamKerja: "sekarang" } },
        keterangan: keteranganDari(badan),
      });
    } catch (galat) {
      res.status(500).json({ ok: false, alasan: "antrean_jam_kerja_gagal", pesan: String((galat && galat.message) || galat).slice(0, 300) });
      return;
    }
    if (gerbang) {
      res.status(gerbang.status).json(gerbang.body);
      return;
    }
    return penangan(req, res, next);
  };
}

module.exports = {
  aktif,
  TABEL,
  SQL_SKEMA,
  JEDA_ANTARBARIS,
  SEBARAN_PAGI_DETIK,
  buatLayanan,
  layanan,
  jalankanPenangan,
  manualJamKerja,
};
