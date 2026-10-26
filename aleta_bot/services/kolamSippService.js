"use strict";

/**
 * KOLAM SAMBUNGAN SIPP: interaktif (layar) terpisah dari latar (WhatsApp, cron, penilaian).
 *
 * Sebelum ini SEMUA kueri ke database perkara berbagi satu kolam 10 sambungan.
 * Satu putaran kerja latar (penilaian, cron, e-Court) sudah cukup untuk menghabiskan
 * kesepuluhnya, lalu setiap layar Jadwal Sidang menunggu sampai 17 detik dan pemutus
 * arus terbuka: SEMUA layar menampilkan "bot belum dapat dihubungi".
 *
 * Di sini ada empat hal, dan SEMUANYA mati bawaan (perilaku lama persis):
 *
 *   1. TERPISAH       permintaan dari portal (layar) memakai kolam sendiri; kerja latar
 *                     tetap di kolam utama. Kolam kedua dibuat hanya bila dinyalakan.
 *   2. BATAS          ukuran kedua kolam dari pengaturan, diubah SAAT BERJALAN
 *                     (tanpa mulai ulang). Nilai diisi dari hasil ukur max_connections.
 *   3. GAGAL CEPAT    menunggu sambungan paling lama N milidetik dan/atau antrean paling
 *                     banyak M permintaan; selebihnya gagal dengan pesan jelas. Galat ini
 *                     BUKAN tanda SIPP rusak, jadi tidak ikut membuka pemutus arus.
 *   4. PUTUS KUERI    bila batas waktu klien terlampaui, kueri yang masih berjalan di
 *                     server dihentikan dengan KILL QUERY lewat sambungan terpisah, sebab
 *                     MariaDB mengabaikan MAX_EXECUTION_TIME dan kueri itu akan terus
 *                     memakan sambungan walau bot sudah berhenti menunggu.
 *
 * Penentuan "interaktif" memakai AsyncLocalStorage: middleware Express menandai
 * permintaan ke /internal/aleta-bot (kecuali awalan kerja berat di LATAR_PREFIKS).
 * Kode tanpa tanda (cron, WhatsApp, pemulihan) otomatis latar.
 *
 * Tidak ada kata yang dikirim ke SIPP selain kueri yang sudah ada; KILL QUERY hanya
 * memuat nomor utas.
 */

const fs = require("fs");
const path = require("path");
const { AsyncLocalStorage } = require("async_hooks");

const RENTANG = Object.freeze({
  batas: { min: 1, maks: 50 },
  batasInteraktif: { min: 1, maks: 50 },
  antreMaksMs: { min: 0, maks: 60000 },
  antreanMaks: { min: 0, maks: 5000 },
});

/** Awalan jalur (setelah /internal/aleta-bot) yang berat dan sengaja tidak diberi kolam layar. */
const LATAR_PREFIKS = Object.freeze([
  "/sinkron",
  "/kembaran",
  "/ecourt",
  "/ecourt-aksi",
  "/ecourt-pengguna",
  "/sipp/penilaian",
  "/sipp/ringkasan-massal",
  "/sipp/unggah-massal",
  "/sipp/rekap-petugas",
  "/sipp/ukur-tipe",
  "/sipp/ukur-ruas",
  "/sipp/ide-l2",
  "/sipp/ktp-pihak",
  "/sipp/sebaran-jurusita",
  "/config/sync",
  "/queue",
  "/worker",
]);

function batasDasarDariEnv() {
  return Math.max(1, Math.min(50, Number(process.env.ALETA_BOT_DB_CONNECTION_LIMIT || 10) || 10));
}

function bawaan() {
  return {
    terpisah: false,
    batas: batasDasarDariEnv(),
    batasInteraktif: 10,
    antreMaksMs: 0,
    antreanMaks: 0,
    putusKueriLambat: false,
  };
}

function angka(nilai, bawaanNilai, rentang) {
  const n = Number(nilai);
  if (nilai === undefined || nilai === null || nilai === "" || !Number.isFinite(n)) return bawaanNilai;
  return Math.max(rentang.min, Math.min(rentang.maks, Math.round(n)));
}

/** Merapikan masukan apa pun menjadi setelan sah. Yang tidak disebut memakai `dasar`. */
function rapikan(masukan, dasar = bawaan()) {
  const x = masukan && typeof masukan === "object" ? masukan : {};
  return {
    terpisah: typeof x.terpisah === "boolean" ? x.terpisah : Boolean(dasar.terpisah),
    batas: angka(x.batas, dasar.batas, RENTANG.batas),
    batasInteraktif: angka(x.batasInteraktif, dasar.batasInteraktif, RENTANG.batasInteraktif),
    antreMaksMs: angka(x.antreMaksMs, dasar.antreMaksMs, RENTANG.antreMaksMs),
    antreanMaks: angka(x.antreanMaks, dasar.antreanMaks, RENTANG.antreanMaks),
    putusKueriLambat: typeof x.putusKueriLambat === "boolean" ? x.putusKueriLambat : Boolean(dasar.putusKueriLambat),
  };
}

function berkasSetelan() {
  const dasar = process.env.ALETA_BOT_DATA_DIR || path.join(__dirname, "..", "data");
  return path.join(dasar, "kolam-sipp.json");
}

function muatDariBerkas() {
  try {
    const mentah = fs.readFileSync(berkasSetelan(), "utf8");
    return JSON.parse(mentah);
  } catch {
    return null;
  }
}

let setelan = rapikan(muatDariBerkas());
const hitung = {
  interaktif: 0,
  latar: 0,
  antreHabis: 0,
  antrePenuh: 0,
  dimatikan: 0,
  matikanGagal: 0,
};

const als = new AsyncLocalStorage();

function jalurLatar(jalur) {
  const j = String(jalur || "");
  return LATAR_PREFIKS.some((p) => j === p || j.startsWith(`${p}/`));
}

/** Middleware Express: menandai permintaan portal sebagai interaktif atau latar. */
function middlewareExpress() {
  return function tandaiKolam(req, _res, next) {
    const jalur = req.path || req.url || "";
    als.run({ jenis: jalurLatar(jalur) ? "latar" : "interaktif" }, next);
  };
}

/** Menjalankan `fn` sebagai kerja layar. */
function interaktif(fn) {
  return als.run({ jenis: "interaktif" }, fn);
}

/** Menjalankan `fn` sebagai kerja latar (menimpa tanda interaktif di sekitarnya). */
function latar(fn) {
  return als.run({ jenis: "latar" }, fn);
}

function jenisSaatIni() {
  const s = als.getStore();
  return s && s.jenis === "interaktif" ? "interaktif" : "latar";
}

function galat(kode, pesan) {
  const e = new Error(pesan);
  e.code = kode;
  return e;
}

/** Nilai pengaturan yang berlaku pada objek kolam mysql (dapat diubah saat berjalan). */
function terapkanPadaKolam(kolam, batas) {
  if (!kolam || !kolam.config) return;
  kolam.config.connectionLimit = batas;
  kolam.config.queueLimit = setelan.antreanMaks;
}

function matikanBawaan(kolam, threadId) {
  // Sambungan terpisah dan sekali pakai: kolam yang sama mungkin sedang penuh.
  // Hanya nomor utas yang dikirim; tidak ada teks lain.
  let mysql;
  try {
    mysql = require("mysql");
  } catch {
    return;
  }
  const cfg = (kolam && kolam.config && kolam.config.connectionConfig) || {};
  const k = mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectTimeout: 3000,
  });
  k.on("error", () => {});
  k.connect((err) => {
    if (err) {
      hitung.matikanGagal += 1;
      try {
        k.destroy();
      } catch {
        /* sudah putus */
      }
      return;
    }
    k.query(`KILL QUERY ${Number(threadId)}`, (e) => {
      if (e) hitung.matikanGagal += 1;
      else hitung.dimatikan += 1;
      try {
        k.end(() => {});
      } catch {
        /* sudah putus */
      }
    });
  });
}

/**
 * Membuat pelaksana kueri di atas kolam utama.
 *
 * @param {object} p
 * @param {object} p.utama           kolam utama (mysql.createPool), juga kolam latar
 * @param {Function} p.queryAsli     query kolam utama sebelum dibungkus
 * @param {Function} p.buatKolamKedua  () => kolam interaktif (dipanggil malas)
 * @param {Function} [p.matikan]     (kolam, threadId) => void  (uji menyuntikkan tiruan)
 * @param {Function} [p.setTimer]    setTimeout (uji)
 */
function buatPelaksana({ utama, queryAsli, buatKolamKedua, matikan = matikanBawaan, setTimer = setTimeout, hapusTimer = clearTimeout }) {
  let kedua = null;

  function selarasKolam() {
    terapkanPadaKolam(utama, setelan.batas);
    if (setelan.terpisah) {
      if (kedua) terapkanPadaKolam(kedua, setelan.batasInteraktif);
    } else if (kedua) {
      const lama = kedua;
      kedua = null;
      // Biarkan kueri yang masih berjalan selesai sebelum ditutup.
      const t = setTimer(() => {
        try {
          lama.end(() => {});
        } catch {
          /* sudah tertutup */
        }
      }, 60000);
      if (t && typeof t.unref === "function") t.unref();
    }
  }

  function kolamKedua() {
    if (!kedua) {
      kedua = buatKolamKedua();
      terapkanPadaKolam(kedua, setelan.batasInteraktif);
    }
    return kedua;
  }

  function pilih() {
    if (setelan.terpisah && jenisSaatIni() === "interaktif") {
      hitung.interaktif += 1;
      return kolamKedua();
    }
    hitung.latar += 1;
    return utama;
  }

  function kirimLangsung(kolam, options, rest) {
    if (kolam === utama) return queryAsli(options, ...rest);
    return kolam.query(options, ...rest);
  }

  function jalankan(options, rest) {
    const khusus = setelan.terpisah || setelan.antreMaksMs > 0 || setelan.antreanMaks > 0 || setelan.putusKueriLambat;
    if (!khusus) return queryAsli(options, ...rest);

    const kolam = pilih();
    const idx = rest.length - 1;
    const cb = idx >= 0 && typeof rest[idx] === "function" ? rest[idx] : null;
    const manual = setelan.antreMaksMs > 0 || setelan.antreanMaks > 0 || setelan.putusKueriLambat;
    if (!cb || !manual) return kirimLangsung(kolam, options, rest);

    const antreMs = setelan.antreMaksMs;
    const putus = setelan.putusKueriLambat;
    let abaikan = false;
    let timer = null;
    if (antreMs > 0) {
      timer = setTimer(() => {
        abaikan = true;
        hitung.antreHabis += 1;
        cb(
          galat(
            "KOLAM_ANTRE_HABIS",
            `Sambungan ke SIPP sedang penuh; menunggu lebih dari ${Math.round(antreMs / 1000)} detik. Coba lagi sebentar lagi.`
          ),
          undefined,
          undefined
        );
      }, antreMs);
    }

    kolam.getConnection((err, conn) => {
      if (timer) hapusTimer(timer);
      if (abaikan) {
        if (conn) {
          try {
            conn.release();
          } catch {
            /* sudah dilepas */
          }
        }
        return;
      }
      if (err) {
        if (err.code === "POOL_ENQUEUELIMIT") {
          hitung.antrePenuh += 1;
          return cb(galat("KOLAM_PENUH", "Antrean sambungan ke SIPP penuh. Coba lagi sebentar lagi."), undefined, undefined);
        }
        return cb(err, undefined, undefined);
      }

      const threadId = conn.threadId;
      let dilepas = false;
      const lepas = () => {
        if (dilepas) return;
        dilepas = true;
        try {
          conn.release();
        } catch {
          /* sudah dilepas */
        }
      };
      let lepasManual = false;
      let sudahCb = false;
      const aslinya = rest.slice(0, idx);
      const cbKueri = (e, r, f) => {
        sudahCb = true;
        if (e && putus && e.code === "PROTOCOL_SEQUENCE_TIMEOUT" && threadId) {
          try {
            matikan(kolam, threadId);
          } catch {
            hitung.matikanGagal += 1;
          }
        }
        if (lepasManual) lepas();
        return cb(e, r, f);
      };
      let q;
      try {
        q = conn.query(options, ...aslinya, cbKueri);
      } catch (e) {
        lepas();
        return cb(e, undefined, undefined);
      }
      if (q && typeof q.once === "function") {
        q.once("end", lepas);
      } else {
        lepasManual = true;
        if (sudahCb) lepas();
      }
      return undefined;
    });
    return undefined;
  }

  function statusKolam(k) {
    if (!k) return null;
    return {
      semua: Array.isArray(k._allConnections) ? k._allConnections.length : 0,
      bebas: Array.isArray(k._freeConnections) ? k._freeConnections.length : 0,
      antre: Array.isArray(k._connectionQueue) ? k._connectionQueue.length : 0,
      batas: k.config ? k.config.connectionLimit : null,
    };
  }

  return {
    jalankan,
    selarasKolam,
    status: () => ({ utama: statusKolam(utama), interaktif: statusKolam(kedua) }),
    _kedua: () => kedua,
  };
}

let pelaksanaAktif = null;

/** Dipanggil db_config.js sekali, sesudah kolam utama dibuat. */
function pasangPelaksana(parameter) {
  pelaksanaAktif = buatPelaksana(parameter);
  pelaksanaAktif.selarasKolam();
  return pelaksanaAktif;
}

/** Menerapkan setelan baru (dari portal) saat berjalan, lalu menyimpannya di folder data. */
function terapkan(masukan, { simpan = true } = {}) {
  setelan = rapikan(masukan, bawaan());
  if (pelaksanaAktif) pelaksanaAktif.selarasKolam();
  if (simpan) {
    try {
      fs.mkdirSync(path.dirname(berkasSetelan()), { recursive: true });
      fs.writeFileSync(berkasSetelan(), `${JSON.stringify(setelan, null, 2)}\n`, "utf8");
    } catch {
      /* folder data tidak dapat ditulis: setelan tetap berlaku sampai mulai ulang */
    }
  }
  return { ...setelan };
}

function status() {
  return {
    setelan: { ...setelan },
    kolam: pelaksanaAktif ? pelaksanaAktif.status() : null,
    hitung: { ...hitung },
  };
}

module.exports = {
  RENTANG,
  LATAR_PREFIKS,
  bawaan,
  rapikan,
  setelan: () => ({ ...setelan }),
  terapkan,
  status,
  middlewareExpress,
  interaktif,
  latar,
  jenisSaatIni,
  jalurLatar,
  buatPelaksana,
  pasangPelaksana,
  // untuk uji
  _setSetelan(x) {
    setelan = rapikan(x, bawaan());
  },
  _hitung: hitung,
};
