"use strict";

/**
 * ============================================================================
 * TARIK DATA SATU PERKARA DARI KEPALA HALAMAN PERKARA SIPP (21 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim: tombol "Tarik data" di kepala SIPP, di sebelah kiri
 * "Selamat datang <pengguna>", hanya di halaman perkara, menarik e-Court HANYA
 * perkara itu - "jangan sampai memberatkan penarikan utama yang dikerjakan
 * admin".
 *
 * ============================================================================
 * PENARIKAN UTAMA DAN TARIKAN SATU PERKARA SATU PINTU, BUKAN DUA SESI
 * ============================================================================
 *
 * Penarikan utama (tarikan pagi, putaran berkala 30-60 menit, penarikan
 * menyeluruh/belum-ada dari portal) dan tarikan ini sama-sama berjalan lewat
 * ecourtSchedulerService.jalankanSatuPutaran: SATU proses jembatan, SATU
 * peramban, SATU sesi e-Court bersama (akun penarik bersama yang sama; tidak
 * ada login baru, tidak ada sesi tambahan yang memicu batas atau CAPTCHA).
 * jalankanSatuPutaran sendiri hanya mengizinkan satu putaran pada satu waktu.
 * Tarikan ini TIDAK membuka jalur kedua; ia hanya MENGANTRE untuk pintu yang
 * sama.
 *
 * ============================================================================
 * ATURAN ANTREAN (urutan prioritas: penarikan utama SELALU lebih dulu)
 * ============================================================================
 *
 *   1. Satu tarikan sekaligus untuk seluruh server, antrean pendek (BATAS_ANTREAN,
 *      bawaan 5) - lalu ditolak dengan sebab, bukan diterima lalu terlupa.
 *   2. Tarikan satu perkara HANYA dimulai di SELA: penjadwal tidak sibuk, tidak
 *      ada penarikan lain (menyeluruh, belum-ada, PuTTY, pemulihan sesi), DAN
 *      putaran utama berikutnya (berkala maupun pagi) masih lebih jauh daripada
 *      BATAS_TARIK_MS + MARGIN_MS (bawaan 4 + 1 menit). Tarikan paling lama
 *      BATAS_TARIK_MS (dimatikan paksa sesudahnya), jadi ia selalu selesai
 *      SEBELUM putaran utama jatuh tempo - dalam keadaan normal putaran utama
 *      tidak terlambat satu detik pun. Bila tabrakan langka terjadi (putaran
 *      utama jatuh tempo tepat setelah keputusan sela), keterlambatannya
 *      dibatasi sisa BATAS_TARIK_MS dan detak penjadwal mengulang sendiri.
 *   3. Menunggu giliran paling lama BATAS_TUNGGU_MS (bawaan 10 menit). Lewat itu
 *      permintaan dihentikan dengan keterangan wajar ("penarikan utama masih
 *      berjalan, coba lagi nanti") - tidak menggantung, tidak menumpuk.
 *   4. Jadwal dan kursor penarikan utama tidak disentuh: tidak mengubah
 *      berkalaBerikutnyaMs, catatan tarikan pagi, maupun cap waktu penarikan
 *      sukses (jalankanSatuPutaran tidak mencatat ketiganya untuk tarikan
 *      per perkara).
 *   5. Gagal masuk sesi / sesi habis: berhenti dan dikatakan apa adanya. Tidak
 *      ada upaya login sendiri.
 *
 * ============================================================================
 * BATAS LAJU PER PERKARA
 * ============================================================================
 *
 * Perkara yang sudah ditarik (oleh tarikan ini ATAU kunjungan penarikan utama,
 * ecourtKunjunganService) kurang dari JEDA_SEGAR_MS (bawaan 10 menit) lalu tidak
 * ditarik lagi: jawabannya "baru ditarik N menit lalu". Hanya Admin / Super
 * Admin (diputuskan portal, bukan tombol) yang boleh memaksa ulang, dan paksa
 * pun tidak lebih cepat daripada JEDA_PAKSA_MIN_MS (1 menit).
 *
 * ============================================================================
 * JEJAK
 * ============================================================================
 *
 * Siapa yang meminta dan kapan dicatat di aleta_bot_ecourt_permintaan (tabel
 * permintaan e-Court yang sudah ada; status sela / sela-jalan / selesai /
 * gagal). Tidak ada tulisan ke SIPP sama sekali; yang dibaca dari SIPP hanya
 * "apakah perkara ini terdaftar lewat e-Court".
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { normalizeCaseNumber, cleanText } = require("./ecourtTextService");
const kemajuanTarik = require("./ecourtKemajuanTarik");

const env = (nama, bawaan) => {
  const n = Number(process.env[nama]);
  return Number.isFinite(n) && n > 0 ? n : bawaan;
};

/** Perkara yang berhasil ditarik kurang dari ini lalu tidak ditarik lagi (kecuali dipaksa Admin). */
const JEDA_SEGAR_MS = env("ALETA_BOT_ECOURT_TARIK_SATU_SEGAR_MS", 10 * 60 * 1000);
/** Sekecil apa pun alasannya, satu perkara tidak ditarik lagi sebelum ini (paksa pun). */
const JEDA_PAKSA_MIN_MS = 60 * 1000;
/** Sesudah gagal / sesi habis: jeda singkat supaya tombol tidak menghantam e-Court berulang. */
const JEDA_GAGAL_MS = 60 * 1000;
/** Satu tarikan dimatikan paksa sesudah ini. */
const BATAS_TARIK_MS = env("ALETA_BOT_ECOURT_TARIK_SATU_BATAS_MS", 4 * 60 * 1000);
/** Cadangan di antara akhir tarikan dan putaran utama yang jatuh tempo. */
const MARGIN_MS = env("ALETA_BOT_ECOURT_TARIK_SATU_MARGIN_MS", 60 * 1000);
/** Paling lama menunggu giliran di sela. */
const BATAS_TUNGGU_MS = env("ALETA_BOT_ECOURT_TARIK_SATU_TUNGGU_MS", 10 * 60 * 1000);
/** Panjang antrean (menunggu giliran) paling banyak. */
const BATAS_ANTREAN = env("ALETA_BOT_ECOURT_TARIK_SATU_ANTREAN", 5);
/** Seberapa sering antrean menimbang sela (hanya hidup selama ada yang mengantre). */
const DETAK_MS = env("ALETA_BOT_ECOURT_TARIK_SATU_DETAK_MS", 10 * 1000);
/** Simpanan tarikan lebih dari sehari tidak berguna. */
const UMUR_SIMPANAN_MS = 24 * 60 * 60 * 1000;

const SIAP_SEMENTARA = new Set(["menunggu-giliran", "berjalan"]);

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

/**
 * Boleh dimulai SEKARANG? - fungsi murni, inti kebijakan "tidak memberatkan".
 *
 * @param {object} o
 * @param {number} o.sekarangMs
 * @param {object} o.penjadwal  keluaran ecourtSchedulerService.keadaanGiliran()
 * @param {number} [o.batasTarikMs]
 * @param {number} [o.marginMs]
 * @returns {{mulai: boolean, alasan: string, keterangan: string}}
 */
function putuskanGiliran({ sekarangMs, penjadwal, batasTarikMs = BATAS_TARIK_MS, marginMs = MARGIN_MS }) {
  const p = penjadwal || {};
  const tahan = (alasan, keterangan) => ({ mulai: false, alasan, keterangan });
  if (p.sibuk) return tahan("putaran_utama_berjalan", "Penarikan utama sedang berjalan.");
  if (p.penarikanLain) return tahan("penarikan_server_berjalan", "Ada penarikan lain yang sedang berjalan di server.");
  if (p.memulihkan) return tahan("pemulihan_sesi", "Sesi e-Court sedang dipulihkan.");

  const jendela = Math.max(0, Number(batasTarikMs) || 0) + Math.max(0, Number(marginMs) || 0);
  // Putaran utama hanya dihitung bila penjadwalnya menyala; yang sudah jatuh
  // tempo (waktu <= sekarang) juga menahan: ia akan berjalan pada detak berikutnya.
  if (p.aktif) {
    for (const waktu of [p.pagiBerikutnyaMs, p.berkalaBerikutnyaMs]) {
      if (!Number.isFinite(waktu)) continue;
      if (waktu - sekarangMs < jendela) {
        return tahan("putaran_utama_segera", "Putaran penarikan utama hampir tiba; tarikan satu perkara memberi jalan.");
      }
    }
  }
  return { mulai: true, alasan: "", keterangan: "" };
}

/** "baru saja" / "N menit lalu" / "N jam lalu" - dari selisih detik. */
function umurTeks(detik) {
  const d = Math.max(0, Math.round(Number(detik) || 0));
  if (d < 45) return "baru saja";
  if (d < 90 * 60) return `${Math.max(1, Math.round(d / 60))} menit lalu`;
  return `${Math.round(d / 3600)} jam lalu`;
}

function buatLayanan(deps = {}) {
  const sekarang = deps.sekarang || (() => new Date());
  const kueriSipp =
    deps.kueriSipp ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  const kueriBot = deps.kueriBot || ((sql, params = []) => require("./botDbService").query(sql, params));
  const penjadwal = deps.penjadwal || {
    keadaanGiliran: () => require("./ecourtSchedulerService").keadaanGiliran(),
    jalankan: (opsi) => require("./ecourtSchedulerService").jalankanSatuPutaran(opsi),
  };
  const akunSiap = deps.akunSiap || (() => require("./ecourtAkunService").pilihAkunSiap().ok === true);
  const adaPewaktu = deps.tanpaPewaktu !== true;
  const batasTarikMs = Number(deps.batasTarikMs) || BATAS_TARIK_MS;
  const marginMs = deps.marginMs !== undefined ? Number(deps.marginMs) : MARGIN_MS;
  const batasTungguMs = Number(deps.batasTungguMs) || BATAS_TUNGGU_MS;
  const batasAntrean = Number(deps.batasAntrean) || BATAS_ANTREAN;
  const jedaSegarMs = Number(deps.jedaSegarMs) || JEDA_SEGAR_MS;
  const detakMs = Number(deps.detakMs) || DETAK_MS;

  /** Kunjungan terakhir penarikan APA PUN ke perkara ini (ms epoch), 0 bila belum pernah. */
  const kunjunganTerakhir =
    deps.kunjunganTerakhir ||
    (async (nomorNormal) => {
      try {
        const kunjungan = require("./ecourtKunjunganService");
        await kunjungan.ensureSchema();
        const baris = await kueriBot(`SELECT dikunjungi_pada AS waktu FROM ${kunjungan.TABEL} WHERE nomor_perkara = ? LIMIT 1`, [nomorNormal]);
        const w = baris && baris[0] ? require("./botDbService").fromMysqlDate(baris[0].waktu) : null;
        return w ? w.getTime() : 0;
      } catch {
        return 0;
      }
    });

  const berkasSimpanan =
    "berkasSimpanan" in deps
      ? deps.berkasSimpanan
      : path.join(
          process.env.ALETA_BOT_DATA_DIR ? path.resolve(process.env.ALETA_BOT_DATA_DIR) : path.resolve(__dirname, "..", "data"),
          "ecourt-tarik-satu.json"
        );

  /** nomor dinormalkan -> tarikan terakhir (menunggu / berjalan / selesai / ...). */
  const tarikan = new Map();
  /** Urutan menunggu giliran (kunci nomor dinormalkan). */
  const antrean = [];
  let kunciBerjalan = "";
  let pewaktu = null;
  let sedangMenimbang = false;

  // ------------------------------------------------------------------------
  // Simpanan (hanya penolong sesudah bot mulai ulang; gagal menulis = diam)
  // ------------------------------------------------------------------------

  function ringkas(t) {
    if (!t) return null;
    const { _janji, ...isi } = t;
    return { ...isi };
  }

  /** Ringkasan untuk layar: ditambah berapa detik sejak tarikan itu berakhir (null bila belum). */
  function tampil(t) {
    const r = ringkas(t);
    if (!r) return null;
    r.selesaiDetik = r.selesai ? Math.max(0, Math.round((sekarang().getTime() - r.selesai) / 1000)) : null;
    return r;
  }

  function simpan() {
    if (!berkasSimpanan) return;
    try {
      const isi = {};
      for (const [k, t] of tarikan) isi[k] = ringkas(t);
      fs.mkdirSync(path.dirname(berkasSimpanan), { recursive: true });
      const sementara = `${berkasSimpanan}.${process.pid}.tmp`;
      fs.writeFileSync(sementara, JSON.stringify({ versi: 1, tarikan: isi }));
      fs.renameSync(sementara, berkasSimpanan);
    } catch {
      /* simpanan hanya penolong */
    }
  }

  (function muat() {
    if (!berkasSimpanan) return;
    let isi = null;
    try {
      isi = JSON.parse(fs.readFileSync(berkasSimpanan, "utf8"));
    } catch {
      return;
    }
    const kini = sekarang().getTime();
    for (const [k, t] of Object.entries((isi && isi.tarikan) || {})) {
      if (!t || typeof t !== "object") continue;
      const waktu = Number(t.selesaiMs) || Number(t.mulaiMs) || Number(t.dimintaMs) || 0;
      if (!waktu || kini - waktu > UMUR_SIMPANAN_MS) continue;
      const baru = { ...t };
      if (SIAP_SEMENTARA.has(baru.status)) {
        // Prosesnya anak bot yang sudah mati / antreannya hilang bersama bot.
        baru.status = "terputus";
        baru.selesaiMs = 0;
        baru.pesan = "Bot dinyalakan ulang saat penarikan berlangsung - tekan Tarik data lagi.";
        baru.kemajuan = { ...(baru.kemajuan || kemajuanTarik.hitungKemajuan({ tahap: "mulai" })), tahap: "terputus", teks: "Terputus" };
      }
      tarikan.set(k, baru);
    }
  })();

  // ------------------------------------------------------------------------
  // Jejak di tabel permintaan e-Court (siapa & kapan). Gagal = diam.
  // ------------------------------------------------------------------------

  let skemaJejak = false;
  async function pastikanJejak() {
    if (skemaJejak) return true;
    if (deps.jejak) return true;
    try {
      const siap = await require("./ecourtPermintaanService").ensureSchema();
      if (siap) skemaJejak = true;
      return skemaJejak;
    } catch {
      return false;
    }
  }

  const botDbTulis = (sql, params) => kueriBot(sql, params);
  const mysqlWaktu = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

  const jejak =
    deps.jejak ||
    {
      async sisip(t) {
        if (!(await pastikanJejak())) return;
        await botDbTulis(
          `INSERT INTO aleta_bot_ecourt_permintaan (id, nomor_perkara, diminta_oleh, diminta_pada, status)
           VALUES (?, ?, ?, ?, 'sela')`,
          [t.id, normalizeCaseNumber(t.nomorPerkara).slice(0, 191), cleanText(t.olehSiapa).slice(0, 191), mysqlWaktu(t.dimintaMs)]
        );
      },
      async mulai(t) {
        if (!(await pastikanJejak())) return;
        await botDbTulis("UPDATE aleta_bot_ecourt_permintaan SET status = 'sela-jalan', dikerjakan_pada = ? WHERE id = ?", [
          mysqlWaktu(t.mulaiMs),
          t.id,
        ]);
      },
      async akhir(t, berhasil, catatan) {
        if (!(await pastikanJejak())) return;
        await botDbTulis("UPDATE aleta_bot_ecourt_permintaan SET status = ?, selesai_pada = ?, catatan = ? WHERE id = ?", [
          berhasil ? "selesai" : "gagal",
          mysqlWaktu(t.selesaiMs || sekarang().getTime()),
          cleanText(catatan).slice(0, 2000),
          t.id,
        ]);
      },
    };
  const jejakDiam = (janji) => Promise.resolve(janji).catch(() => {});

  // ------------------------------------------------------------------------
  // SIPP: hanya "terdaftar lewat e-Court?" (SELECT)
  // ------------------------------------------------------------------------

  /** @returns {Promise<{ada: boolean, ecourt: boolean, nomorPerkara: string}>} */
  async function periksaSipp(nomorNormal) {
    const baris = await kueriSipp(
      `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
              EXISTS (SELECT 1 FROM perkara_efiling_id k
                        JOIN perkara_efiling e ON e.efiling_id = k.efiling_id
                       WHERE k.perkara_id = p.perkara_id) AS ecourt
         FROM perkara p
        WHERE p.nomor_perkara = ?
        LIMIT 1`,
      [nomorNormal]
    );
    const r = Array.isArray(baris) ? baris[0] : null;
    if (!r) return { ada: false, ecourt: false, nomorPerkara: nomorNormal };
    return { ada: true, ecourt: Number(r.ecourt) === 1, nomorPerkara: cleanText(r.nomorPerkara) || nomorNormal };
  }

  // ------------------------------------------------------------------------
  // Potret dokumen/berkas sebelum-sesudah, untuk laporan "N dokumen baru"
  // ------------------------------------------------------------------------

  const potret =
    deps.potret ||
    (async (nomorNormal) => {
      const dok = await kueriBot(
        `SELECT document_key AS documentKey, judul_dokumen AS judulDokumen, peran_pengunggah AS peranPengunggah,
                diunggah_pada AS diunggahPada
           FROM aleta_bot_ecourt_documents WHERE nomor_perkara = ?`,
        [nomorNormal]
      );
      let berkas = [];
      try {
        berkas = await kueriBot(
          `SELECT document_key AS documentKey, COUNT(*) AS jumlah
             FROM aleta_bot_ecourt_files
            WHERE nomor_perkara = ? AND dihapus_retensi IS NULL
            GROUP BY document_key`,
          [nomorNormal]
        );
      } catch {
        berkas = [];
      }
      const jumlahBerkas = new Map();
      for (const b of Array.isArray(berkas) ? berkas : []) jumlahBerkas.set(bersih(b.documentKey), Number(b.jumlah) || 0);
      return { dokumen: Array.isArray(dok) ? dok : [], jumlahBerkas };
    });

  // ------------------------------------------------------------------------
  // Antrean
  // ------------------------------------------------------------------------

  function hentikanPewaktuBilaKosong() {
    if (antrean.length === 0 && !kunciBerjalan && pewaktu) {
      clearInterval(pewaktu);
      pewaktu = null;
    }
  }

  function nyalakanPewaktu() {
    if (!adaPewaktu || pewaktu) return;
    pewaktu = setInterval(() => void timbang().catch(() => {}), detakMs);
    if (typeof pewaktu.unref === "function") pewaktu.unref();
  }

  function akhiri(t, status, pesan, { berhasil = false, jeda = false } = {}) {
    const akhir = sekarang().getTime();
    t.status = status;
    t.pesan = pesan;
    t.selesaiMs = jeda ? akhir : 0;
    t.selesai = akhir;
    t.kemajuan = { ...(t.kemajuan || {}), tahap: status, teks: pesan };
    if (berhasil) t.berhasilMs = akhir;
    simpan();
  }

  /**
   * Satu pertimbangan antrean: buang yang kedaluwarsa, lalu mulai kepala
   * antrean bila sedang sela. Dipanggil saat permintaan masuk, tiap DETAK_MS
   * selama ada antrean, dan sesudah satu tarikan selesai.
   */
  async function timbang() {
    if (sedangMenimbang) return;
    sedangMenimbang = true;
    try {
      const kini = sekarang().getTime();
      for (let i = antrean.length - 1; i >= 0; i -= 1) {
        const t = tarikan.get(antrean[i]);
        if (!t || t.status !== "menunggu-giliran") {
          antrean.splice(i, 1);
          continue;
        }
        if (kini - t.dimintaMs > batasTungguMs) {
          antrean.splice(i, 1);
          akhiri(t, "ditunda", "Penarikan utama masih berjalan, jadi tarikan perkara ini tidak sempat dimulai. Coba lagi beberapa menit lagi.");
          t.alasan = "menunggu_terlalu_lama";
          t.selesaiMs = 0;
          void jejakDiam(jejak.akhir(t, false, "ditunda: menunggu giliran melewati batas"));
        }
      }
      if (kunciBerjalan || antrean.length === 0) return;

      const keputusan = putuskanGiliran({
        sekarangMs: kini,
        penjadwal: await Promise.resolve(penjadwal.keadaanGiliran()),
        batasTarikMs,
        marginMs,
      });
      const kepala = tarikan.get(antrean[0]);
      if (!kepala) return;
      if (!keputusan.mulai) {
        kepala.menungguKarena = keputusan.alasan;
        kepala.pesan = keputusan.keterangan;
        return;
      }
      // Akun bersama harus bersesi; tidak ada upaya login dari sini.
      if (!akunSiap()) {
        antrean.shift();
        akhiri(kepala, "ditolak", "Tidak ada akun e-Court yang sesinya siap. Minta admin masuk ulang di menu Integrasi e-Court.");
        kepala.alasan = "akun_tidak_siap";
        void jejakDiam(jejak.akhir(kepala, false, "ditolak: akun e-Court tidak siap"));
        return;
      }
      antrean.shift();
      void mulaiKerja(kepala);
    } finally {
      sedangMenimbang = false;
      hentikanPewaktuBilaKosong();
    }
  }

  async function mulaiKerja(t) {
    const k = normalizeCaseNumber(t.nomorPerkara);
    const kini = sekarang().getTime();
    kunciBerjalan = k;
    t.status = "berjalan";
    t.mulaiMs = kini;
    t.menungguKarena = "";
    t.pesan = "Menarik dari e-Court...";
    t.kemajuan = kemajuanTarik.hitungKemajuan({ tahap: "mulai" });
    simpan();
    void jejakDiam(jejak.mulai(t));

    t._janji = (async () => {
      const sebelum = await Promise.resolve(potret(k)).catch(() => ({ dokumen: [], jumlahBerkas: new Map() }));
      const padaKemajuan = (laporan) => {
        if (t.status !== "berjalan") return;
        t.kemajuan = kemajuanTarik.majukan(t.kemajuan, laporan);
        t.pesan = `${t.kemajuan.teks}...`;
      };
      const hasil =
        (await Promise.resolve()
          .then(() =>
            penjadwal.jalankan({
              nomorPerkara: t.nomorPerkara,
              maksPerkara: 0,
              sumber: "tarik-satu-sipp",
              batasMs: batasTarikMs,
              padaKemajuan,
            })
          )
          .catch((e) => ({ kode: -1, catatan: String((e && e.message) || e) }))) || {};

      if (hasil.dilewati) {
        // Kalah balapan dengan penarikan lain yang baru mulai: kembali ke
        // kepala antrean, tidak ada yang ditarik dan tidak ada jeda.
        t.status = "menunggu-giliran";
        t.pesan = "Penarikan lain baru saja dimulai; menunggu giliran.";
        t.mulaiMs = 0;
        t.menungguKarena = "putaran_utama_berjalan";
        antrean.unshift(k);
        return;
      }
      if (hasil.kode === 2) {
        akhiri(t, "sesi-habis", "Sesi e-Court habis. Minta admin masuk ulang di menu Integrasi e-Court, lalu tekan lagi.", { jeda: true });
        void jejakDiam(jejak.akhir(t, false, "sesi e-Court habis"));
        return;
      }
      if (hasil.kode !== 0) {
        akhiri(t, "gagal", `Penarikan gagal: ${bersih(hasil.catatan) || "tanpa keterangan"}`.slice(0, 220), { jeda: true });
        void jejakDiam(jejak.akhir(t, false, `gagal: ${bersih(hasil.catatan)}`));
        return;
      }

      t.kemajuan = kemajuanTarik.majukan(t.kemajuan, { tahap: "simpan" });
      const sesudah = await Promise.resolve(potret(k)).catch(() => ({ dokumen: [], jumlahBerkas: new Map() }));
      const kunciLama = new Set(sebelum.dokumen.map((d) => bersih(d.documentKey)));
      t.dokumenBaru = sesudah.dokumen
        .filter((d) => !kunciLama.has(bersih(d.documentKey)))
        .map((d) => ({ judul: cleanText(d.judulDokumen) || "(tanpa judul)", peran: cleanText(d.peranPengunggah) }));
      let berkasBaru = 0;
      for (const [kunci, n] of sesudah.jumlahBerkas) berkasBaru += Math.max(0, n - (sebelum.jumlahBerkas.get(kunci) || 0));
      t.berkasBaru = berkasBaru;
      t.jumlahDokumen = sesudah.dokumen.length;
      const jumlah = t.dokumenBaru.length;
      akhiri(
        t,
        "selesai",
        jumlah > 0 ? `Ditarik ${jumlah} dokumen baru` : "Tidak ada dokumen baru",
        { berhasil: true, jeda: true }
      );
      t.kemajuan = kemajuanTarik.hitungKemajuan({ tahap: "selesai" });
      void jejakDiam(jejak.akhir(t, true, `selesai: ${jumlah} dokumen baru, ${berkasBaru} berkas baru`));
    })()
      .catch((e) => {
        akhiri(t, "gagal", `Penarikan gagal: ${String((e && e.message) || e).slice(0, 200)}`, { jeda: true });
        void jejakDiam(jejak.akhir(t, false, `galat: ${String((e && e.message) || e).slice(0, 200)}`));
      })
      .then(() => {
        kunciBerjalan = "";
        simpan();
        // Antrean berikutnya ditimbang segera, tidak menunggu detak.
        if (antrean.length > 0) void timbang().catch(() => {});
        hentikanPewaktuBilaKosong();
      });
  }

  // ------------------------------------------------------------------------
  // Pintu masuk
  // ------------------------------------------------------------------------

  /** Detik sejak tarikan terakhir BERHASIL (oleh pintu ini ATAU kunjungan penarikan utama); null bila belum pernah. */
  async function umurTerakhirTarik(k) {
    const t = tarikan.get(k);
    const kini = sekarang().getTime();
    const dariKunjungan = await Promise.resolve(kunjunganTerakhir(k)).catch(() => 0);
    const terakhir = Math.max(Number(t && t.berhasilMs) || 0, Number(dariKunjungan) || 0);
    return terakhir > 0 ? { terakhirMs: terakhir, detik: Math.max(0, Math.round((kini - terakhir) / 1000)) } : null;
  }

  /**
   * Meminta tarikan satu perkara.
   *
   * @param {{nomorPerkara: string, olehSiapa?: string, paksa?: boolean}} masukan
   *   `paksa` hanya DIKIRIM portal untuk Admin/Super Admin; bot tidak menilai peran.
   * @returns {Promise<object>} { ok, hasil, alasan?, pesan, tarikan, terakhirDetik? }
   *   hasil: dimulai | diantrekan | bergabung | segar | bukan_ecourt
   */
  async function minta({ nomorPerkara = "", olehSiapa = "", paksa = false } = {}) {
    const nomor = cleanText(nomorPerkara);
    const k = normalizeCaseNumber(nomor);
    if (!k) return { ok: false, alasan: "nomor_perkara_kosong", pesan: "Nomor perkara tidak terbaca." };
    const kini = sekarang().getTime();

    // 1. Sudah menunggu atau berjalan -> bergabung, bukan tarikan kedua.
    const lama = tarikan.get(k);
    if (lama && SIAP_SEMENTARA.has(lama.status)) {
      return { ok: true, hasil: "bergabung", pesan: lama.pesan, tarikan: tampil(lama) };
    }

    // 2. Hanya perkara yang terdaftar lewat e-Court.
    let sipp;
    try {
      sipp = await periksaSipp(k);
    } catch (e) {
      return { ok: false, alasan: "sipp_tidak_terbaca", pesan: "Data perkara di SIPP belum terbaca; coba lagi sebentar." };
    }
    if (!sipp.ada) return { ok: false, alasan: "perkara_tidak_ditemukan", pesan: "Perkara ini tidak ditemukan di SIPP." };
    if (!sipp.ecourt) {
      return {
        ok: true,
        hasil: "bukan_ecourt",
        pesan: "Perkara ini tidak didaftarkan lewat e-Court, jadi tidak ada data e-Court yang bisa ditarik.",
        tarikan: null,
      };
    }

    // Dua permintaan hampir bersamaan: yang kedua melihat yang pertama.
    const lama2 = tarikan.get(k);
    if (lama2 && SIAP_SEMENTARA.has(lama2.status)) {
      return { ok: true, hasil: "bergabung", pesan: lama2.pesan, tarikan: tampil(lama2) };
    }

    // 3. Batas laju per perkara.
    const umur = await umurTerakhirTarik(k);
    if (umur && umur.detik * 1000 < (paksa ? JEDA_PAKSA_MIN_MS : jedaSegarMs)) {
      return {
        ok: true,
        hasil: "segar",
        pesan: `Baru ditarik ${umurTeks(umur.detik)}.`,
        terakhirDetik: umur.detik,
        sisaSegarDetik: Math.max(0, Math.ceil((jedaSegarMs - umur.detik * 1000) / 1000)),
        tarikan: tampil(tarikan.get(k) || null),
      };
    }
    // Jeda singkat sesudah tarikan yang GAGAL (tidak dihitung segar).
    const g = tarikan.get(k);
    if (g && g.selesaiMs && kini - g.selesaiMs < JEDA_GAGAL_MS && g.status !== "selesai") {
      return {
        ok: true,
        hasil: "segar",
        pesan: g.pesan || "Baru dicoba; tunggu sebentar sebelum menekan lagi.",
        terakhirDetik: umur ? umur.detik : null,
        sisaSegarDetik: Math.ceil((JEDA_GAGAL_MS - (kini - g.selesaiMs)) / 1000),
        tarikan: tampil(g),
      };
    }

    // 4. Antrean pendek, satu pintu.
    if (antrean.length >= batasAntrean) {
      return { ok: false, alasan: "antrean_penuh", pesan: "Antrean tarikan satu perkara sedang penuh. Coba lagi beberapa menit lagi." };
    }

    // 5. Akun bersama harus bersesi; tidak ada login dari sini.
    if (!akunSiap()) {
      return {
        ok: false,
        alasan: "akun_tidak_siap",
        pesan: "Tidak ada akun e-Court yang sesinya siap. Minta admin masuk ulang di menu Integrasi e-Court.",
      };
    }

    // Tempat dipesan SEKARANG (sebelum await berikutnya).
    const t = {
      id: crypto.randomUUID(),
      nomorPerkara: sipp.nomorPerkara,
      status: "menunggu-giliran",
      olehSiapa: bersih(olehSiapa).slice(0, 120),
      paksa: Boolean(paksa),
      dimintaMs: kini,
      mulaiMs: 0,
      selesaiMs: 0,
      berhasilMs: Number(lama && lama.berhasilMs) || 0,
      menungguKarena: "",
      pesan: "Menunggu giliran...",
      dokumenBaru: [],
      berkasBaru: 0,
      kemajuan: kemajuanTarik.hitungKemajuan({ tahap: "mulai" }),
    };
    tarikan.set(k, t);
    antrean.push(k);
    simpan();
    void jejakDiam(jejak.sisip(t));
    nyalakanPewaktu();

    // Sela kosong -> mulai seketika (tanpa menunggu detak).
    await timbang().catch(() => {});
    return {
      ok: true,
      hasil: t.status === "berjalan" ? "dimulai" : t.status === "menunggu-giliran" ? "diantrekan" : "ditolak",
      pesan: t.pesan,
      alasan: t.alasan || undefined,
      tarikan: tampil(t),
      ...(t.status === "ditolak" ? { ok: false } : {}),
    };
  }

  /** Keadaan tarikan satu perkara untuk layar (dibaca berkala). */
  async function keadaan(nomorPerkara = "") {
    const k = normalizeCaseNumber(cleanText(nomorPerkara));
    if (!k) return { ok: false, alasan: "nomor_perkara_kosong" };
    const t = tarikan.get(k) || null;
    const umur = await umurTerakhirTarik(k);
    const kini = sekarang().getTime();
    let segarSisa = 0;
    if (umur) segarSisa = Math.max(0, Math.ceil((jedaSegarMs - umur.detik * 1000) / 1000));
    return {
      ok: true,
      ada: Boolean(t),
      tarikan: tampil(t),
      terakhirDetik: umur ? umur.detik : null,
      terakhirTeks: umur ? umurTeks(umur.detik) : "",
      sisaSegarDetik: segarSisa,
      antrean: antrean.length,
      menungguDetik: t && t.status === "menunggu-giliran" ? Math.round((kini - t.dimintaMs) / 1000) : 0,
    };
  }

  /** Untuk uji: menunggu tarikan yang sedang berjalan selesai. */
  async function tungguSelesai(nomorPerkara = "") {
    const t = tarikan.get(normalizeCaseNumber(cleanText(nomorPerkara)));
    if (t && t._janji) await t._janji;
  }

  return {
    minta,
    keadaan,
    timbang,
    tungguSelesai,
    /** Untuk uji. */
    _antrean: () => antrean.slice(),
    _berjalan: () => kunciBerjalan,
  };
}

let bawaan = null;
function layanan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  BATAS_ANTREAN,
  BATAS_TARIK_MS,
  BATAS_TUNGGU_MS,
  JEDA_PAKSA_MIN_MS,
  JEDA_SEGAR_MS,
  MARGIN_MS,
  buatLayanan,
  putuskanGiliran,
  umurTeks,
  minta: (isi) => layanan().minta(isi),
  keadaan: (nomor) => layanan().keadaan(nomor),
};
