"use strict";

/**
 * ============================================================================
 * FAKTA SKP JABATAN PERKARA - DIBACA DARI SIPP, SELURUHNYA SELECT
 * ============================================================================
 *
 * Rancangan disetujui pengguna 17 Oktober 2026: SKP bulanan/triwulan/tahunan
 * untuk Ketua, Wakil Ketua, Panitera, Panmud, PP, Jurusita, Petugas Meja,
 * Kasir, dan Operator. Bot HANYA mengirim FAKTA per kejadian (kontrak:
 * manajemen_surat/src/lib/skp-jabatan-tipe.ts -> DataSkpJabatan); aturan
 * hitung (lulus/tidak, selisih hari, persen) tinggal di portal
 * (skp-jabatan-hitung.ts) supaya hanya ada satu versi angka.
 *
 * ============================================================================
 * KUNCI FAKTA = KUNCI KATALOG PORTAL
 * ============================================================================
 *
 * Kunci yang dikirim persis KUNCI_FAKTA_SKP_JABATAN di
 * manajemen_surat/src/lib/skp-jabatan-katalog.ts (diuji selaras oleh
 * skp-jabatan-bot-rute.test.ts dan skp-jabatan-katalog.test.ts). Indikator
 * yang memakai `dari` (mis. pmh-kualitas dari pmh-kuantitas) TIDAK dikirim
 * dua kali: portal membaca daftar kuantitasnya. Kunci semacam itu tetap
 * tercatat di KUNCI_FAKTA di bawah dan ditandai "turunan".
 *
 * Kejadian dengan tanggal acuan kosong atau belum jatuh tempo ikut dikirim
 * apa adanya; portal yang mengeluarkannya dari penyebut.
 *
 * ============================================================================
 * "DIKERJAKAN OLEH AKUN INI" - DUA CARA
 * ============================================================================
 *
 *   per akun    tabel yang menyimpan penginputnya (diinput_oleh = username
 *               SIPP): perkara_proses, perkara_penetapan, perkara_biaya,
 *               perkara. Relaas memakai perkara_pelaksanaan_relaas.
 *               jurusita_id = USERID penginput (bukan jurusita.id); jabatan
 *               jurusita/pengganti dibaca lewat user_jurusita -> jurusita.
 *   per unit    pekerjaan yang melekat pada jabatan, bukan pada penginput:
 *               Panmud Gugatan/Permohonan (perkara menurut alur), Panmud
 *               Hukum (BHT -> arsip), Kasir (sisa panjar perkara putus), PP
 *               (sidang perkara yang ditunjuk kepadanya lewat user_panitera
 *               -> perkara_panitera_pn). Fakta per unit hanya melekat pada
 *               akun yang masih AKTIF: akun lama tidak mewarisi pekerjaan
 *               unit yang sekarang.
 *
 * ============================================================================
 * JEBAKAN DATA YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - Minutasi BUKAN ukuran waktu (tanggal_minutasi = tanggal_putusan,
 *     proses 220 selalu 0 hari): fakta minutasi tidak membawa tanggal acuan.
 *   - tanggal_masuk_arsip rata-rata 29 hari SEBELUM BHT: bukan ukuran waktu;
 *     yang dikirim hanya ada/tidaknya arsip. Arsip menyusul BHT, maka perkara
 *     BHT yang dinilai adalah BHT SATU TRIWULAN (bulanan: sebulan) lebih awal
 *     dari periodenya (jendelaBht).
 *   - panitera_pn.jabatan = 0 semua: jabatan hanya dari sys_user_group +
 *     sys_groups (dan jurusita.jabatan).
 *   - username antartabel SIPP berkolasi berbeda (latin1_swedish_ci vs
 *     latin1_general_ci): TIDAK PERNAH digabungkan lewat JOIN, selalu
 *     dibandingkan dengan parameter.
 *   - Pemberitahuan putusan dicatat di perkara_proses 218; kolom
 *     pemberitahuan_putusan di perkara_putusan kosong.
 *   - Tidak terbaca (kolom/tabel hilang, galat SIPP) = terbaca:false beserta
 *     frasa untuk pembaca; TIDAK PERNAH menjadi daftar kosong yang tampak
 *     seperti nol.
 *
 * Kuerinya ditulis harfiah di dalam runQuery - penjaga verify-pemisahan-
 * database dan verify-sipp-baca-saja membaca teksnya. Nama kolom yang
 * disisipkan hanya dari daftar di berkas ini yang sudah dicocokkan dengan
 * information_schema lewat sippSkemaService (CALON "skp*").
 */

const db = require("../db_config");
const sippSkemaService = require("./sippSkemaService");
const { tanggalHariIni } = require("./periodePenilaianService");
const { susunPeriode, KUNCI_PERIODE_SEMUA } = require("./evidenSkpService");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

const POTONGAN_IN = 500;
const SINGGAHAN_MS = 2 * 60 * 1000;
const SINGGAHAN_MAKS = 20;

/** Kunci jabatan (selaras JABATAN_SKP di skp-jabatan-tipe.ts). */
const JABATAN = Object.freeze([
  "ketua",
  "wakil-ketua",
  "panitera",
  "panmud-hukum",
  "panmud-gugatan",
  "panmud-permohonan",
  "pp",
  "jurusita",
  "jurusita-pengganti",
  "petugas-meja",
  "kasir",
  "operator",
  "koordinator-delegasi",
  "informasi",
]);

/**
 * Grup SIPP -> jabatan (selaras GRUP_SIPP_JABATAN di skp-jabatan-tipe.ts).
 * Grup "Meja ..." (1001-1003, 1011-1013, ...) tidak ada di kontrak tetapi
 * dikenali dari NAMA grupnya sebagai dugaan petugas-meja; pemetaan akhir
 * tetap dikonfirmasi di layar Pemetaan.
 */
const GRUP_JABATAN = Object.freeze({
  10: "ketua",
  30: "panitera",
  430: "panmud-hukum",
  1000: "panmud-gugatan",
  1010: "panmud-permohonan",
  500: "pp",
  600: "jurusita",
  702: "kasir",
  650: "koordinator-delegasi",
  802: "informasi",
});

/** perkara.alur_perkara_id: 15 = Perdata Gugatan, 16 = Perdata Permohonan (alur_perkara). */
const ALUR = Object.freeze({ "panmud-gugatan": 15, "panmud-permohonan": 16 });
/** Awalan kunci katalog RHK Panmud per jabatan. */
const AWAL_PANMUD = Object.freeze({ "panmud-gugatan": "gugatan", "panmud-permohonan": "permohonan" });

/** Konfigurasi SIPP yang perlu dibetulkan petugas (bukan galat bacaan): masuk catatanOperator. */
const TAUTAN_PANITERA = "Akun SIPP ini belum ditautkan ke panitera (user_panitera).";

/** Alasan bernada ramah untuk pembaca (tanpa galat MySQL mentah). */
const FRASA = Object.freeze({
  tabel: (nama) => `Bagian SIPP "${nama}" tidak tersedia di server ini.`,
  kolom: (nama) => `Kolom SIPP untuk ${nama} tidak ditemukan di server ini.`,
  bacaGagal: (nama) => `${nama} tidak dapat dibaca dari SIPP saat ini.`,
});

// ============================================================================
// KUNCI FAKTA - SELARAS KUNCI_FAKTA_SKP_JABATAN (skp-jabatan-katalog.ts)
// ============================================================================

const KUNCI_PIMPINAN = Object.freeze([
  "pmh-kuantitas",
  "pmh-kualitas",
  "pmh-waktu",
  "phs-kuantitas",
  "phs-kualitas",
  "phs-waktu",
]);
const KUNCI_JURUSITA = Object.freeze([
  "js-relaas-kuantitas",
  "js-relaas-dokumen",
  "js-relaas-kualitas",
  "js-relaas-waktu",
  "js-input-kuantitas",
  "js-input-kualitas",
  "js-input-waktu",
]);
const KUNCI_PANMUD_GUGATAN = Object.freeze([
  "gugatan-putusan-kuantitas",
  "gugatan-putusan-unggah",
  "gugatan-putusan-kualitas",
  "gugatan-putusan-waktu",
  "gugatan-publikasi-kuantitas",
  "gugatan-publikasi-kualitas",
  "gugatan-akta-kuantitas",
  "gugatan-akta-kualitas",
  "gugatan-akta-waktu",
]);
const KUNCI_PANMUD_PERMOHONAN = Object.freeze([
  "permohonan-putusan-kuantitas",
  "permohonan-putusan-unggah",
  "permohonan-putusan-kualitas",
  "permohonan-putusan-waktu",
  "permohonan-publikasi-kuantitas",
  "permohonan-publikasi-kualitas",
  "permohonan-akta-kuantitas",
  "permohonan-akta-kualitas",
  "permohonan-akta-waktu",
]);

/** Seluruh kunci fakta tiap jabatan (tanpa indikator isian) - cermin katalog portal. */
const KUNCI_FAKTA = Object.freeze({
  ketua: KUNCI_PIMPINAN,
  "wakil-ketua": KUNCI_PIMPINAN,
  panitera: Object.freeze(["pn-penunjukan-kuantitas", "pn-penunjukan-kualitas", "pn-penunjukan-waktu"]),
  "panmud-hukum": Object.freeze(["ph-arsip-kuantitas", "ph-arsip-kualitas", "ph-arsip-bht"]),
  "panmud-gugatan": KUNCI_PANMUD_GUGATAN,
  "panmud-permohonan": KUNCI_PANMUD_PERMOHONAN,
  pp: Object.freeze(["pp-sidang-kuantitas", "pp-sidang-bas", "pp-sidang-kualitas", "pp-sidang-waktu"]),
  jurusita: KUNCI_JURUSITA,
  "jurusita-pengganti": KUNCI_JURUSITA,
  "petugas-meja": Object.freeze(["mj-minutasi-kuantitas", "mj-akta-kuantitas", "mj-akta-waktu"]),
  kasir: Object.freeze([
    "ks-penerimaan-kuantitas",
    "ks-penerimaan-kualitas",
    "ks-penerimaan-waktu",
    "ks-biaya-kuantitas",
    "ks-biaya-kualitas",
    "ks-biaya-sisa-kembali",
    "ks-biaya-sisa",
    "ks-pendaftaran-kuantitas",
  ]),
  // Sumbernya bukan SIPP (jejak ALETA di portal): bot tidak mengirim apa pun.
  operator: Object.freeze(["op-layanan-kuantitas"]),
  "koordinator-delegasi": Object.freeze([]),
  informasi: Object.freeze([]),
});

/**
 * Kunci turunan: portal memakainya lewat `dari` (atau rasio) dari daftar yang
 * sudah dikirim, jadi bot tidak mengirimnya dua kali.
 */
const KUNCI_TURUNAN = Object.freeze([
  "pmh-kualitas",
  "pmh-waktu",
  "phs-kualitas",
  "phs-waktu",
  "pn-penunjukan-waktu",
  "ph-arsip-kualitas",
  "gugatan-putusan-kualitas",
  "gugatan-publikasi-kualitas",
  "gugatan-akta-waktu",
  "permohonan-putusan-kualitas",
  "permohonan-publikasi-kualitas",
  "permohonan-akta-waktu",
  "pp-sidang-kualitas",
  "js-relaas-kualitas",
  "js-input-kuantitas",
  "js-input-waktu",
  "ks-penerimaan-waktu",
  "ks-biaya-kualitas",
  "op-layanan-kuantitas",
]);

/** Kunci tambahan (awalan x-) hanya dikirim bila diminta (tambahan=1): pembanding angka emas. */
const KUNCI_TAMBAHAN = Object.freeze({
  pp: Object.freeze(["x-pp-penunjukan", "x-pp-input-sendiri", "x-pp-putus"]),
  jurusita: Object.freeze(["x-js-pemberitahuan-putusan"]),
  "jurusita-pengganti": Object.freeze(["x-js-pemberitahuan-putusan"]),
  "panmud-hukum": Object.freeze(["x-ph-arsip-input"]),
});

// ============================================================================
// FUNGSI MURNI
// ============================================================================

function bersih(nilai) {
  return String(nilai ?? "").trim();
}

/** "YYYY-MM-DD" yang sah, atau null (tanggal nol SIPP = null). */
function tanggalSah(nilai) {
  const teks = bersih(nilai).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) && !teks.startsWith("0000") ? teks : null;
}

function angkaAtauNull(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

function kejadian({ perkaraId = null, nomorPerkara = null, tanggal = null, tanggalAcuan = null, nilai = null, keterangan = null }) {
  return {
    perkaraId: perkaraId === null || perkaraId === undefined ? null : String(perkaraId),
    nomorPerkara: bersih(nomorPerkara) || null,
    tanggal: tanggalSah(tanggal),
    tanggalAcuan: tanggalSah(tanggalAcuan),
    nilai: angkaAtauNull(nilai),
    keterangan: bersih(keterangan) || null,
  };
}

/** Awal bulan (UTC) n bulan dari tanggal ISO, sebagai "YYYY-MM-01". */
function awalBulanGeser(iso, n) {
  const m = /^(\d{4})-(\d{2})-/.exec(iso);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Rentang BHT yang dinilai pengarsipannya: periode digeser mundur sebesar
 * panjangnya (bulanan 1 bulan, triwulan 3 bulan), tahunan 3 bulan - arsip
 * menyusul BHT, jadi BHT periode ini belum wajar dituntut arsipnya.
 * Contoh: tw3 2026 -> 1 Apr - 30 Jun 2026.
 */
function jendelaBht(periode) {
  const panjang = Number(periode.bulan) || 3;
  const geser = panjang >= 12 ? 3 : panjang;
  const mulai = awalBulanGeser(periode.mulai, -geser);
  const awalSesudah = awalBulanGeser(mulai, panjang);
  const d = new Date(`${awalSesudah}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return { mulai, selesai: d.toISOString().slice(0, 10) };
}

/**
 * Jabatan dugaan sebuah akun dari grup (dan jurusita.jabatan bagi grup 600).
 * @param grup [{groupid, nama}]
 * @param jabatanJurusita "1" | "2" | "" (jurusita.jabatan lewat user_jurusita)
 */
function jabatanDugaan(grup, jabatanJurusita = "") {
  const daftar = Array.isArray(grup) ? grup : [];
  for (const g of daftar) {
    const jabatan = GRUP_JABATAN[Number(g.groupid)];
    if (jabatan === "jurusita") return bersih(jabatanJurusita) === "2" ? "jurusita-pengganti" : "jurusita";
    if (jabatan) return jabatan;
  }
  for (const g of daftar) {
    if (/^meja\b/i.test(bersih(g.nama))) return "petugas-meja";
  }
  return null;
}

/** Apakah sebuah akun termasuk permintaan jabatan tertentu? */
function cocokJabatan(dugaan, diminta) {
  if (!diminta) return true;
  if (dugaan === diminta) return true;
  // Ketua dan Wakil satu grup (10); dibedakan peran ALETA di portal.
  if (diminta === "wakil-ketua" && dugaan === "ketua") return true;
  return false;
}

/**
 * Username SIPP dari kueri: satu teks atau DAFTAR (parameter berulang
 * ?username=a&username=b). TIDAK dipecah dengan koma: username SIPP boleh
 * memuat koma (mis. "munifa,SH."). Hasil: { ok, daftar } atau { ok:false, ... }.
 */
function bacaUsername(nilai) {
  const mentah = Array.isArray(nilai) ? nilai : [nilai];
  const daftar = [];
  for (const x of mentah) {
    const teks = bersih(x);
    if (!teks) continue;
    if (teks.length > 60) return { ok: false, status: 400, alasan: "username_tidak_sah", error: "Username SIPP terlalu panjang." };
    if (!daftar.includes(teks)) daftar.push(teks);
  }
  if (daftar.length > 100) return { ok: false, status: 400, alasan: "username_terlalu_banyak", error: "Terlalu banyak username SIPP dalam satu permintaan (paling banyak 100)." };
  return { ok: true, daftar };
}

/** Memeriksa masukan; yang tidak dikenali DITOLAK dengan alasannya. */
function periksaMasukan(masukan = {}, hariIni = "") {
  const tolak = (alasan, error) => ({ ok: false, status: 400, alasan, error });
  const tahunTeks = bersih(masukan.tahun);
  const tahun = /^\d{4}$/.test(tahunTeks) ? Number(tahunTeks) : NaN;
  if (!(tahun >= 2000 && tahun <= 2100)) return tolak("tahun_tidak_sah", "Tahun harus empat angka (2000-2100).");

  const periode = bersih(masukan.periode).toLowerCase();
  if (!KUNCI_PERIODE_SEMUA.includes(periode)) {
    return tolak("periode_tidak_dikenal", "Periode harus tw1, tw2, tw3, tw4, tahun, atau b01 sampai b12.");
  }
  const susunan = susunPeriode(periode, tahun);
  if (hariIni && susunan.mulai > hariIni) {
    return tolak("periode_belum_mulai", `Periode ${susunan.labelPanjang} belum dimulai.`);
  }

  const jabatan = bersih(masukan.jabatan).toLowerCase();
  if (jabatan && !JABATAN.includes(jabatan)) {
    return tolak("jabatan_tidak_dikenal", `Jabatan "${jabatan}" tidak dikenal.`);
  }

  // Username SIPP: pembanding parameter saja, tetapi tetap dibatasi bentuknya.
  const nama = bacaUsername(masukan.username);
  if (!nama.ok) return nama;
  const usernames = nama.daftar;

  const tambahan = ["1", "true", "ya"].includes(bersih(masukan.tambahan).toLowerCase());
  return { ok: true, pilihan: { tahun, periode, jabatan: jabatan || null, usernames, tambahan } };
}

// ============================================================================
// LAYANAN
// ============================================================================

/** Bagian SIPP yang tidak dapat dibaca (frasa untuk pembaca di pesan). */
class TidakTerbaca extends Error {}

function buatLayanan(deps = {}) {
  const kueri = deps.kueri || runQuery;
  const tabelAda = deps.tabelAda || ((nama) => sippSkemaService.tabelAda(nama));
  const pilihKolom = deps.pilihKolom || ((tabel, calon) => sippSkemaService.pilihKolom(tabel, calon));
  const jam = deps.jam || (() => Date.now());

  const singgahan = new Map();

  function ambilSinggahan(kunci, sekarang) {
    const isi = singgahan.get(kunci);
    if (!isi) return null;
    if (sekarang - isi.waktu > SINGGAHAN_MS) {
      singgahan.delete(kunci);
      return null;
    }
    return isi.data;
  }

  function simpanSinggahan(kunci, data, sekarang) {
    singgahan.set(kunci, { waktu: sekarang, data });
    while (singgahan.size > SINGGAHAN_MAKS) singgahan.delete(singgahan.keys().next().value);
  }

  /** Menjalankan kerja atas potongan daftar id, lalu menggabungkan barisnya. */
  async function perPotongan(daftarId, kerja, ukuran = POTONGAN_IN) {
    const hasil = [];
    for (let i = 0; i < daftarId.length; i += ukuran) {
      const potong = daftarId.slice(i, i + ukuran);
      hasil.push(...(await kerja(potong, potong.map(() => "?").join(", "))));
    }
    return hasil;
  }

  async function wajibTabel(...nama) {
    for (const n of nama) {
      if (!(await tabelAda(n))) throw new TidakTerbaca(FRASA.tabel(n));
    }
  }

  async function wajibKolom(tabel, calon, nama) {
    const kolom = await pilihKolom(tabel, calon);
    if (!kolom) throw new TidakTerbaca(FRASA.kolom(nama));
    return kolom;
  }

  // ---- akun ---------------------------------------------------------------

  async function bacaAkun(pilihan) {
    await wajibTabel("sys_users", "sys_user_group");
    const adaGrupNama = await tabelAda("sys_groups");
    const blokir = await pilihKolom("sys_users", ["block"]);
    const kedaluwarsa = await pilihKolom("sys_users", ["user_expired"]);
    // block dan user_expired hanya disisipkan bila benar-benar ada (CALON skp*).
    const aktifSql = blokir
      ? `IF(u.${blokir} = 0${kedaluwarsa ? ` AND (u.${kedaluwarsa} IS NULL OR u.${kedaluwarsa} > NOW())` : ""}, 1, 0)`
      : "1";
    const daftarNama = Array.isArray(pilihan.usernames) ? pilihan.usernames : [];
    const kondisiNama = daftarNama.length ? `WHERE u.username IN (${daftarNama.map(() => "?").join(", ")})` : "";
    const akunBaris = await kueri(
      `SELECT u.userid AS userid, u.username AS username, u.fullname AS nama, ${aktifSql} AS aktif
         FROM sys_users u
         ${kondisiNama}
        ORDER BY u.userid ASC`,
      daftarNama
    );
    const grupBaris = await kueri(
      adaGrupNama
        ? `SELECT ug.userid AS userid, ug.groupid AS groupid, g.name AS nama
             FROM sys_user_group ug LEFT JOIN sys_groups g ON g.groupid = ug.groupid`
        : `SELECT ug.userid AS userid, ug.groupid AS groupid, '' AS nama FROM sys_user_group ug`
    );
    const jurusitaBaris =
      (await tabelAda("user_jurusita")) && (await tabelAda("jurusita"))
        ? await kueri(
            `SELECT uj.userid AS userid, j.jabatan AS jabatan
               FROM user_jurusita uj JOIN jurusita j ON j.id = uj.jurusita_id`
          )
        : [];
    const paniteraBaris = (await tabelAda("user_panitera"))
      ? await kueri("SELECT up.userid AS userid, up.panitera_id AS paniteraId FROM user_panitera up")
      : [];

    const grupPerUser = new Map();
    for (const b of grupBaris) {
      const daftar = grupPerUser.get(Number(b.userid)) || [];
      daftar.push({ groupid: Number(b.groupid), nama: bersih(b.nama) });
      grupPerUser.set(Number(b.userid), daftar);
    }
    const jabatanJurusita = new Map(jurusitaBaris.map((b) => [Number(b.userid), bersih(b.jabatan)]));
    const idPanitera = new Map(paniteraBaris.map((b) => [Number(b.userid), Number(b.paniteraId)]));

    return akunBaris.map((b) => {
      const userid = Number(b.userid);
      const grup = grupPerUser.get(userid) || [];
      return {
        userid,
        username: bersih(b.username),
        nama: bersih(b.nama),
        aktif: Number(b.aktif) === 1,
        grup: grup.map((g) => g.groupid),
        grupDetail: grup,
        jabatanDugaan: jabatanDugaan(grup, jabatanJurusita.get(userid) || ""),
        paniteraId: idPanitera.has(userid) ? idPanitera.get(userid) : null,
      };
    });
  }

  // ---- bantuan baca perkara -------------------------------------------------

  function buatKonteks(akun, periode, batas, jabatan, bersama) {
    const memo = new Map();
    return {
      akun,
      periode,
      jabatan,
      dari: periode.mulai,
      sampai: batas,
      /** Sekali per permintaan untuk satu kunci (dipakai bersama beberapa paket). */
      sekali(kunci, kerja) {
        if (!memo.has(kunci)) memo.set(kunci, Promise.resolve().then(kerja));
        return memo.get(kunci);
      },
      /** Sekali per PERMINTAAN untuk semua akun (bacaan yang tidak bergantung akun). */
      bersama(kunci, kerja) {
        if (!bersama.memo.has(kunci)) bersama.memo.set(kunci, Promise.resolve().then(kerja));
        return bersama.memo.get(kunci);
      },
      /** Singgahan keterangan perkara; hidup selama SATU permintaan, dipakai semua akun. */
      info: bersama.info,
    };
  }

  /** perkara_id -> { nomor, pendaftaran, alur }; hasilnya fungsi pencari. */
  async function infoPerkara(k, ids) {
    const infoSingkat = k.info;
    const perlu = [...new Set(ids.map((x) => String(x)))].filter((x) => x && !infoSingkat.has(x));
    if (perlu.length) {
      const baris = await perPotongan(perlu, (potong, isian) =>
        kueri(
          `SELECT p.perkara_id AS id, p.nomor_perkara AS nomor,
                  DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS pendaftaran, p.alur_perkara_id AS alur
             FROM perkara p
            WHERE p.perkara_id IN (${isian})`,
          potong
        )
      );
      for (const b of baris) {
        infoSingkat.set(String(b.id), {
          nomor: bersih(b.nomor) || null,
          pendaftaran: tanggalSah(b.pendaftaran),
          alur: angkaAtauNull(b.alur),
        });
      }
      for (const id of perlu) if (!infoSingkat.has(id)) infoSingkat.set(id, { nomor: null, pendaftaran: null, alur: null });
    }
    return (id) => infoSingkat.get(String(id)) || { nomor: null, pendaftaran: null, alur: null };
  }

  /** perkara_id -> tanggal PMH (penetapan_majelis_hakim) pertama. */
  async function tanggalPmh(ids) {
    const peta = new Map();
    const unik = [...new Set(ids.map((x) => String(x)))];
    const baris = await perPotongan(unik, (potong, isian) =>
      kueri(
        `SELECT pn.perkara_id AS id, DATE_FORMAT(MIN(pn.penetapan_majelis_hakim), '%Y-%m-%d') AS tanggal
           FROM perkara_penetapan pn
          WHERE pn.perkara_id IN (${isian}) AND pn.penetapan_majelis_hakim IS NOT NULL
          GROUP BY pn.perkara_id`,
        potong
      )
    );
    for (const b of baris) peta.set(String(b.id), tanggalSah(b.tanggal));
    return peta;
  }

  /** perkara_id -> tanggal paling awal sebuah proses (perkara_proses.proses_id). */
  async function tanggalProses(ids, prosesId) {
    const peta = new Map();
    const unik = [...new Set(ids.map((x) => String(x)))];
    const baris = await perPotongan(unik, (potong, isian) =>
      kueri(
        `SELECT pr.perkara_id AS id, DATE_FORMAT(MIN(pr.tanggal), '%Y-%m-%d') AS tanggal
           FROM perkara_proses pr
          WHERE pr.perkara_id IN (${isian}) AND pr.proses_id = ?
          GROUP BY pr.perkara_id`,
        [...potong, prosesId]
      )
    );
    for (const b of baris) peta.set(String(b.id), tanggalSah(b.tanggal));
    return peta;
  }

  /** Perkara putus dalam rentang menurut alur - dasar paket unit Panmud. */
  function putusDalamRentang(k, alur) {
    return k.sekali(`putus:${alur}`, async () => {
      await wajibTabel("perkara_putusan", "perkara");
      const dokumen = await wajibKolom("perkara_putusan", ["amar_putusan_dok"], "putusan terunggah");
      const anonim = await wajibKolom("perkara_putusan", ["amar_putusan_anonimisasi_dok"], "putusan teranonimisasi");
      return kueri(
        `SELECT pt.perkara_id AS id, p.nomor_perkara AS nomor,
                DATE_FORMAT(pt.tanggal_putusan, '%Y-%m-%d') AS putusan,
                IF(pt.${dokumen} IS NOT NULL AND pt.${dokumen} <> '', 1, 0) AS terunggah,
                IF(pt.${anonim} IS NOT NULL AND pt.${anonim} <> '', 1, 0) AS teranonim
           FROM perkara_putusan pt
           JOIN perkara p ON p.perkara_id = pt.perkara_id
          WHERE pt.tanggal_putusan BETWEEN ? AND ? AND p.alur_perkara_id = ?
          ORDER BY pt.tanggal_putusan ASC, pt.perkara_id ASC`,
        [k.dari, k.sampai, alur]
      );
    });
  }

  // ---- paket sumber: tiap paket menghasilkan {kunci: [kejadian]} -------------------

  /** PMH dan PHS oleh akun pimpinan. */
  async function paketPmh(k) {
    await wajibTabel("perkara_penetapan", "perkara");
    const penginput = await wajibKolom("perkara_penetapan", ["diinput_oleh"], "penginput penetapan");
    const baris = await kueri(
      `SELECT pn.perkara_id AS id, DATE_FORMAT(pn.penetapan_majelis_hakim, '%Y-%m-%d') AS tanggal
         FROM perkara_penetapan pn
        WHERE pn.${penginput} = ? AND pn.penetapan_majelis_hakim BETWEEN ? AND ?
        ORDER BY pn.penetapan_majelis_hakim ASC, pn.perkara_id ASC`,
      [k.akun.username, k.dari, k.sampai]
    );
    const info = await infoPerkara(k, baris.map((b) => b.id));
    return {
      "pmh-kuantitas": baris.map((b) =>
        kejadian({
          perkaraId: b.id,
          nomorPerkara: info(b.id).nomor,
          tanggal: b.tanggal,
          tanggalAcuan: info(b.id).pendaftaran,
          keterangan: "Penetapan majelis hakim",
        })
      ),
    };
  }

  async function paketPhs(k) {
    await wajibTabel("perkara_proses", "perkara", "perkara_penetapan");
    const baris = await kueri(
      `SELECT pr.perkara_id AS id, DATE_FORMAT(MIN(pr.tanggal), '%Y-%m-%d') AS tanggal
         FROM perkara_proses pr
        WHERE pr.proses_id = 80 AND pr.diinput_oleh = ? AND pr.tanggal BETWEEN ? AND ?
        GROUP BY pr.perkara_id
        ORDER BY MIN(pr.tanggal) ASC, pr.perkara_id ASC`,
      [k.akun.username, k.dari, k.sampai]
    );
    const ids = baris.map((b) => b.id);
    const info = await infoPerkara(k, ids);
    const pmh = await tanggalPmh(ids);
    return {
      "phs-kuantitas": baris.map((b) =>
        kejadian({
          perkaraId: b.id,
          nomorPerkara: info(b.id).nomor,
          tanggal: b.tanggal,
          tanggalAcuan: pmh.get(String(b.id)) || null,
          keterangan: "Penetapan hari sidang pertama",
        })
      ),
    };
  }

  /** Penunjukan PP dan jurusita oleh Panitera (PMH biasa dan PMH ikrar talak). */
  async function paketPenunjukanPanitera(k) {
    await wajibTabel("perkara_proses", "perkara_penetapan");
    const baris = await kueri(
      `SELECT pr.perkara_id AS id, pr.proses_id AS proses, pr.proses_nama AS nama,
              DATE_FORMAT(pr.tanggal, '%Y-%m-%d') AS tanggal
         FROM perkara_proses pr
        WHERE pr.proses_id IN (30, 31, 291, 40, 292) AND pr.diinput_oleh = ? AND pr.tanggal BETWEEN ? AND ?
        ORDER BY pr.tanggal ASC, pr.perkara_id ASC`,
      [k.akun.username, k.dari, k.sampai]
    );
    const ids = baris.map((b) => b.id);
    const info = await infoPerkara(k, ids);
    const pmh = await tanggalPmh(ids);
    // Penunjukan ikrar talak (291, 292) berpatokan pada PMH ikrar (proses 290).
    const pmhIkrar = await tanggalProses(
      baris.filter((b) => [291, 292].includes(Number(b.proses))).map((b) => b.id),
      290
    );
    const daftar = baris.map((b) =>
      kejadian({
        perkaraId: b.id,
        nomorPerkara: info(b.id).nomor,
        tanggal: b.tanggal,
        tanggalAcuan: [291, 292].includes(Number(b.proses)) ? pmhIkrar.get(String(b.id)) || null : pmh.get(String(b.id)) || null,
        keterangan: bersih(b.nama) || "Penunjukan",
      })
    );
    // Kualitas tidak punya `dari` di katalog: daftarnya sendiri, sama dengan kuantitas.
    return { "pn-penunjukan-kuantitas": daftar, "pn-penunjukan-kualitas": daftar };
  }

  /** Panmud Hukum: perkara BHT (satu jendela lebih awal) dan arsipnya. */
  async function paketBhtArsip(k) {
    if (!k.akun.aktif) return {};
    await wajibTabel("perkara_putusan", "perkara", "arsip");
    const bht = await wajibKolom("perkara_putusan", ["tanggal_bht"], "tanggal BHT");
    const jendela = jendelaBht(k.periode);
    const baris = await kueri(
      `SELECT pt.perkara_id AS id, p.nomor_perkara AS nomor, DATE_FORMAT(pt.${bht}, '%Y-%m-%d') AS bht,
              (SELECT DATE_FORMAT(MIN(a.diinput_tanggal), '%Y-%m-%d') FROM arsip a WHERE a.perkara_id = pt.perkara_id) AS arsip
         FROM perkara_putusan pt
         JOIN perkara p ON p.perkara_id = pt.perkara_id
        WHERE pt.${bht} BETWEEN ? AND ?
        ORDER BY pt.${bht} ASC, pt.perkara_id ASC`,
      [jendela.mulai, jendela.selesai]
    );
    // Tanggal masuk arsip sengaja TIDAK dipakai sebagai ukuran waktu (29 hari sebelum BHT).
    const semua = baris.map((b) =>
      kejadian({
        perkaraId: b.id,
        nomorPerkara: b.nomor,
        tanggal: b.arsip,
        tanggalAcuan: b.bht,
        nilai: b.arsip ? 1 : 0,
        keterangan: b.arsip ? "BHT sudah masuk arsip" : "BHT belum masuk arsip",
      })
    );
    return { "ph-arsip-bht": semua, "ph-arsip-kuantitas": semua.filter((x) => x.nilai === 1) };
  }

  async function paketArsipInput(k) {
    await wajibTabel("arsip");
    const penginput = await wajibKolom("arsip", ["diinput_oleh"], "penginput arsip");
    const baris = await kueri(
      `SELECT a.perkara_id AS id, a.nomor_perkara AS nomor, DATE_FORMAT(a.diinput_tanggal, '%Y-%m-%d') AS tanggal
         FROM arsip a
        WHERE a.${penginput} = ? AND a.diinput_tanggal >= ? AND a.diinput_tanggal < DATE_ADD(?, INTERVAL 1 DAY)
        ORDER BY a.diinput_tanggal ASC, a.id ASC`,
      [k.akun.username, k.dari, k.sampai]
    );
    return {
      "x-ph-arsip-input": baris.map((b) =>
        kejadian({ perkaraId: Number(b.id) > 0 ? b.id : null, nomorPerkara: b.nomor, tanggal: b.tanggal, keterangan: "Arsip berkas diinput akun" })
      ),
    };
  }

  /** Panmud Gugatan/Permohonan: putusan, unggah, anonimisasi (unit, menurut alur). */
  async function paketPutusanPanmud(k) {
    if (!k.akun.aktif) return {};
    const awal = AWAL_PANMUD[k.jabatan];
    const baris = await putusDalamRentang(k, ALUR[k.jabatan]);
    const semua = baris.map((b) =>
      kejadian({ perkaraId: b.id, nomorPerkara: b.nomor, tanggal: b.putusan, keterangan: "Putusan" })
    );
    const terunggah = baris
      .filter((b) => Number(b.terunggah) === 1)
      .map((b) => kejadian({ perkaraId: b.id, nomorPerkara: b.nomor, tanggal: b.putusan, keterangan: "Putusan terunggah" }));
    const anonim = baris
      .filter((b) => Number(b.teranonim) === 1)
      .map((b) => kejadian({ perkaraId: b.id, nomorPerkara: b.nomor, tanggal: b.putusan, keterangan: "Putusan teranonimisasi" }));
    return {
      [`${awal}-putusan-kuantitas`]: semua,
      [`${awal}-putusan-unggah`]: terunggah,
      [`${awal}-publikasi-kuantitas`]: anonim,
    };
  }

  async function paketPemberitahuanPanmud(k) {
    if (!k.akun.aktif) return {};
    const awal = AWAL_PANMUD[k.jabatan];
    const baris = await putusDalamRentang(k, ALUR[k.jabatan]);
    await wajibTabel("perkara_proses");
    // Pemberitahuan putusan = perkara_proses 218; null = belum dicatat (portal
    // menilai gagal hanya bila tenggatnya sudah lewat).
    const sudah = await tanggalProses(baris.map((b) => b.id), 218);
    return {
      [`${awal}-putusan-waktu`]: baris.map((b) =>
        kejadian({
          perkaraId: b.id,
          nomorPerkara: b.nomor,
          tanggal: sudah.get(String(b.id)) || null,
          tanggalAcuan: b.putusan,
          keterangan: sudah.get(String(b.id)) ? "Pemberitahuan putusan" : "Pemberitahuan putusan belum tercatat",
        })
      ),
    };
  }

  async function paketAktaPanmud(k) {
    if (!k.akun.aktif) return {};
    const awal = AWAL_PANMUD[k.jabatan];
    await wajibTabel("perkara_proses", "perkara_putusan", "perkara");
    const bht = await wajibKolom("perkara_putusan", ["tanggal_bht"], "tanggal BHT");
    const baris = await kueri(
      `SELECT pr.perkara_id AS id, p.nomor_perkara AS nomor, DATE_FORMAT(MIN(pr.tanggal), '%Y-%m-%d') AS tanggal,
              DATE_FORMAT(MAX(pt.${bht}), '%Y-%m-%d') AS bht
         FROM perkara_proses pr
         JOIN perkara p ON p.perkara_id = pr.perkara_id AND p.alur_perkara_id = ?
         LEFT JOIN perkara_putusan pt ON pt.perkara_id = pr.perkara_id
        WHERE pr.proses_id = 296 AND pr.tanggal BETWEEN ? AND ?
        GROUP BY pr.perkara_id, p.nomor_perkara
        ORDER BY MIN(pr.tanggal) ASC, pr.perkara_id ASC`,
      [ALUR[k.jabatan], k.dari, k.sampai]
    );
    const daftar = baris.map((b) =>
      kejadian({ perkaraId: b.id, nomorPerkara: b.nomor, tanggal: b.tanggal, tanggalAcuan: b.bht, keterangan: "Pembuatan akta cerai" })
    );
    // Kualitas tidak punya `dari`: daftarnya sendiri; waktu memakai `dari` kualitas.
    return { [`${awal}-akta-kuantitas`]: daftar, [`${awal}-akta-kualitas`]: daftar };
  }

  /** Sidang perkara yang ditunjuk kepada PP pada tanggal sidangnya. */
  function sidangPp(k) {
    return k.sekali("sidang-pp", async () => {
      if (k.akun.paniteraId === null) throw new TidakTerbaca(TAUTAN_PANITERA);
      await wajibTabel("perkara_jadwal_sidang", "perkara_panitera_pn", "perkara");
      const bas = await wajibKolom("perkara_jadwal_sidang", ["edoc_bas"], "berita acara sidang");
      const diperbarui = await wajibKolom("perkara_jadwal_sidang", ["diperbaharui_tanggal"], "waktu hasil sidang");
      // PP berlaku pada tanggal sidang bila ditetapkan sebelum/pada hari itu dan
      // belum digantikan (aktif = 'Y', atau tanggal_tidak_aktif sesudah sidang).
      return kueri(
        `SELECT DISTINCT js.id AS sidangId, js.perkara_id AS perkaraId, p.nomor_perkara AS nomor,
                DATE_FORMAT(js.tanggal_sidang, '%Y-%m-%d') AS tanggalSidang,
                DATE_FORMAT(js.${diperbarui}, '%Y-%m-%d') AS diperbarui,
                IF(js.${bas} IS NOT NULL AND js.${bas} <> '', 1, 0) AS bas,
                js.diinput_oleh AS penginput, js.agenda AS agenda
           FROM perkara_jadwal_sidang js
           LEFT JOIN perkara p ON p.perkara_id = js.perkara_id
           JOIN perkara_panitera_pn pp ON pp.perkara_id = js.perkara_id AND pp.panitera_id = ?
            AND pp.tanggal_penetapan <= js.tanggal_sidang
            AND (pp.aktif = 'Y' OR pp.tanggal_tidak_aktif > js.tanggal_sidang)
          WHERE js.tanggal_sidang BETWEEN ? AND ?
          ORDER BY js.tanggal_sidang ASC, js.id ASC`,
        [k.akun.paniteraId, k.dari, k.sampai]
      );
    });
  }

  async function paketSidangPp(k) {
    const baris = await sidangPp(k);
    return {
      "pp-sidang-kuantitas": baris.map((b) =>
        kejadian({ perkaraId: b.perkaraId, nomorPerkara: b.nomor, tanggal: b.tanggalSidang, keterangan: b.agenda || "Sidang" })
      ),
      "pp-sidang-bas": baris
        .filter((b) => Number(b.bas) === 1)
        .map((b) => kejadian({ perkaraId: b.perkaraId, nomorPerkara: b.nomor, tanggal: b.tanggalSidang, nilai: 1, keterangan: "BAS terisi" })),
      // Hasil sidang diinput = saat baris sidang diperbarui PP; acuan = tanggal sidang.
      "pp-sidang-waktu": baris.map((b) =>
        kejadian({
          perkaraId: b.perkaraId,
          nomorPerkara: b.nomor,
          tanggal: b.diperbarui,
          tanggalAcuan: b.tanggalSidang,
          keterangan: "Hasil sidang diinput",
        })
      ),
    };
  }

  async function paketPpTambahan(k) {
    if (k.akun.paniteraId === null) throw new TidakTerbaca(TAUTAN_PANITERA);
    await wajibTabel("perkara_panitera_pn", "perkara_putusan", "perkara");
    const sidang = await sidangPp(k);
    const adaStatus = await tabelAda("status_putusan");
    const tunjuk = await kueri(
      `SELECT pp.perkara_id AS id, DATE_FORMAT(MIN(pp.tanggal_penetapan), '%Y-%m-%d') AS tanggal
         FROM perkara_panitera_pn pp
        WHERE pp.panitera_id = ? AND pp.tanggal_penetapan BETWEEN ? AND ?
        GROUP BY pp.perkara_id
        ORDER BY MIN(pp.tanggal_penetapan) ASC, pp.perkara_id ASC`,
      [k.akun.paniteraId, k.dari, k.sampai]
    );
    const ids = tunjuk.map((b) => b.id);
    const info = await infoPerkara(k, ids);
    const pmh = await tanggalPmh(ids);
    const putus = await kueri(
      `SELECT DISTINCT pt.perkara_id AS id, p.nomor_perkara AS nomor,
              DATE_FORMAT(pt.tanggal_putusan, '%Y-%m-%d') AS putusan,
              DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS pendaftaran,
              ${adaStatus ? "(SELECT sp.nama FROM status_putusan sp WHERE sp.id = pt.status_putusan_id LIMIT 1)" : "NULL"} AS status
         FROM perkara_putusan pt
         JOIN perkara p ON p.perkara_id = pt.perkara_id
         JOIN perkara_panitera_pn pp ON pp.perkara_id = pt.perkara_id AND pp.panitera_id = ?
          AND pp.tanggal_penetapan <= pt.tanggal_putusan
          AND (pp.aktif = 'Y' OR pp.tanggal_tidak_aktif > pt.tanggal_putusan)
        WHERE pt.tanggal_putusan BETWEEN ? AND ?
        ORDER BY pt.tanggal_putusan ASC, pt.perkara_id ASC`,
      [k.akun.paniteraId, k.dari, k.sampai]
    );
    return {
      "x-pp-penunjukan": tunjuk.map((b) =>
        kejadian({
          perkaraId: b.id,
          nomorPerkara: info(b.id).nomor,
          tanggal: b.tanggal,
          tanggalAcuan: pmh.get(String(b.id)) || null,
          keterangan: "Ditunjuk sebagai panitera pengganti",
        })
      ),
      "x-pp-input-sendiri": sidang.map((b) => {
        const sendiri = bersih(b.penginput) === k.akun.username;
        return kejadian({
          perkaraId: b.perkaraId,
          nomorPerkara: b.nomor,
          tanggal: b.tanggalSidang,
          nilai: sendiri ? 1 : 0,
          keterangan: sendiri ? "Diinput PP sendiri" : "Diinput petugas lain",
        });
      }),
      "x-pp-putus": putus.map((b) =>
        kejadian({
          perkaraId: b.id,
          nomorPerkara: b.nomor,
          tanggal: b.putusan,
          tanggalAcuan: b.pendaftaran,
          keterangan: b.status ? `Putus: ${b.status}` : "Putus",
        })
      ),
    };
  }

  /**
   * Relaas yang diinput akun jurusita ini (jurusita_id = userid penginput).
   * Dibaca SEKALI untuk semua jurusita pada periode itu lalu disaring per akun:
   * tabelnya tanpa indeks pada jurusita_id, jadi satu pindai lebih murah
   * daripada satu pindai per akun.
   */
  async function relaasJurusita(k) {
    const semua = await k.bersama("relaas-semua", async () => {
      await wajibTabel("perkara_pelaksanaan_relaas", "perkara");
      const tanggal = await wajibKolom("perkara_pelaksanaan_relaas", ["tanggal_relaas"], "tanggal relaas");
      const pengguna = await wajibKolom("perkara_pelaksanaan_relaas", ["jurusita_id"], "penginput relaas");
      const dokumen = await wajibKolom("perkara_pelaksanaan_relaas", ["doc_relaas"], "dokumen relaas");
      const diinput = await wajibKolom("perkara_pelaksanaan_relaas", ["diinput_tanggal"], "waktu input relaas");
      const adaJadwal = await tabelAda("perkara_jadwal_sidang");
      return kueri(
        `SELECT r.id AS id, r.${pengguna} AS pengguna, r.perkara_id AS perkaraId, p.nomor_perkara AS nomor,
                DATE_FORMAT(r.${tanggal}, '%Y-%m-%d') AS tanggal,
                DATE_FORMAT(r.${diinput}, '%Y-%m-%d') AS diinput,
                IF(r.${dokumen} IS NOT NULL AND r.${dokumen} <> '', 1, 0) AS berdokumen,
                ${adaJadwal ? "DATE_FORMAT(js.tanggal_sidang, '%Y-%m-%d')" : "NULL"} AS sidang
           FROM perkara_pelaksanaan_relaas r
           LEFT JOIN perkara p ON p.perkara_id = r.perkara_id
           ${adaJadwal ? "LEFT JOIN perkara_jadwal_sidang js ON js.id = r.sidang_id" : ""}
          WHERE r.${tanggal} BETWEEN ? AND ?
          ORDER BY r.${tanggal} ASC, r.id ASC`,
        [k.dari, k.sampai]
      );
    });
    return semua.filter((b) => Number(b.pengguna) === Number(k.akun.userid));
  }

  async function paketRelaas(k) {
    const baris = await relaasJurusita(k);
    const relaas = baris.map((b) =>
      kejadian({
        perkaraId: b.perkaraId,
        nomorPerkara: b.nomor,
        tanggal: b.tanggal,
        tanggalAcuan: b.sidang,
        keterangan: "Relaas pemanggilan/pemberitahuan",
      })
    );
    return {
      "js-relaas-kuantitas": relaas,
      "js-relaas-dokumen": baris
        .filter((b) => Number(b.berdokumen) === 1)
        .map((b) =>
          kejadian({ perkaraId: b.perkaraId, nomorPerkara: b.nomor, tanggal: b.tanggal, nilai: 1, keterangan: "Relaas berdokumen" })
        ),
      // Tidak punya `dari`: daftar sendiri (tanggal relaas, acuan tanggal sidang).
      "js-relaas-waktu": relaas,
      // tanggal = saat relaas diinput ke SIPP, tanggalAcuan = tanggal relaas.
      "js-input-kualitas": baris.map((b) =>
        kejadian({
          perkaraId: b.perkaraId,
          nomorPerkara: b.nomor,
          tanggal: b.diinput,
          tanggalAcuan: b.tanggal,
          keterangan: "Relaas diinput ke SIPP",
        })
      ),
    };
  }

  async function paketPemberitahuanJs(k) {
    await wajibTabel("perkara_proses", "perkara_putusan");
    const baris = await kueri(
      `SELECT pr.perkara_id AS id, DATE_FORMAT(MIN(pr.tanggal), '%Y-%m-%d') AS tanggal,
              DATE_FORMAT(MAX(pt.tanggal_putusan), '%Y-%m-%d') AS putusan
         FROM perkara_proses pr
         LEFT JOIN perkara_putusan pt ON pt.perkara_id = pr.perkara_id
        WHERE pr.proses_id = 218 AND pr.diinput_oleh = ? AND pr.tanggal BETWEEN ? AND ?
        GROUP BY pr.perkara_id
        ORDER BY MIN(pr.tanggal) ASC, pr.perkara_id ASC`,
      [k.akun.username, k.dari, k.sampai]
    );
    const info = await infoPerkara(k, baris.map((b) => b.id));
    return {
      "x-js-pemberitahuan-putusan": baris.map((b) =>
        kejadian({
          perkaraId: b.id,
          nomorPerkara: info(b.id).nomor,
          tanggal: b.tanggal,
          tanggalAcuan: b.putusan,
          keterangan: "Pemberitahuan putusan",
        })
      ),
    };
  }

  async function paketMinutasi(k) {
    await wajibTabel("perkara_proses");
    const baris = await kueri(
      `SELECT pr.perkara_id AS id, DATE_FORMAT(MIN(pr.tanggal), '%Y-%m-%d') AS tanggal
         FROM perkara_proses pr
        WHERE pr.proses_id = 220 AND pr.diinput_oleh = ? AND pr.tanggal BETWEEN ? AND ?
        GROUP BY pr.perkara_id
        ORDER BY MIN(pr.tanggal) ASC, pr.perkara_id ASC`,
      [k.akun.username, k.dari, k.sampai]
    );
    const info = await infoPerkara(k, baris.map((b) => b.id));
    // Minutasi BUKAN ukuran waktu: tanpa tanggal acuan.
    return {
      "mj-minutasi-kuantitas": baris.map((b) =>
        kejadian({ perkaraId: b.id, nomorPerkara: info(b.id).nomor, tanggal: b.tanggal, keterangan: "Minutasi" })
      ),
    };
  }

  async function paketAktaMeja(k) {
    await wajibTabel("perkara_proses", "perkara_putusan");
    const bht = await wajibKolom("perkara_putusan", ["tanggal_bht"], "tanggal BHT");
    const baris = await kueri(
      `SELECT pr.perkara_id AS id, DATE_FORMAT(MIN(pr.tanggal), '%Y-%m-%d') AS tanggal,
              DATE_FORMAT(MAX(pt.${bht}), '%Y-%m-%d') AS bht
         FROM perkara_proses pr
         LEFT JOIN perkara_putusan pt ON pt.perkara_id = pr.perkara_id
        WHERE pr.proses_id = 296 AND pr.diinput_oleh = ? AND pr.tanggal BETWEEN ? AND ?
        GROUP BY pr.perkara_id
        ORDER BY MIN(pr.tanggal) ASC, pr.perkara_id ASC`,
      [k.akun.username, k.dari, k.sampai]
    );
    const info = await infoPerkara(k, baris.map((b) => b.id));
    const daftar = baris.map((b) =>
      kejadian({ perkaraId: b.id, nomorPerkara: info(b.id).nomor, tanggal: b.tanggal, tanggalAcuan: b.bht, keterangan: "Pembuatan akta cerai" })
    );
    return { "mj-akta-kuantitas": daftar, "mj-akta-waktu": daftar };
  }

  /** Perkara yang didaftarkan akun kasir ini, beserta panjar pertamanya. */
  function pendaftaranKasir(k) {
    return k.sekali("pendaftaran-kasir", async () => {
      await wajibTabel("perkara");
      const adaBiaya = await tabelAda("perkara_biaya");
      return kueri(
        `SELECT p.perkara_id AS id, p.nomor_perkara AS nomor, DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS pendaftaran,
                ${
                  adaBiaya
                    ? "(SELECT DATE_FORMAT(MIN(b.tanggal_transaksi), '%Y-%m-%d') FROM perkara_biaya b WHERE b.perkara_id = p.perkara_id AND b.jenis_transaksi > 0)"
                    : "NULL"
                } AS panjarPertama
           FROM perkara p
          WHERE p.diinput_oleh = ? AND p.tanggal_pendaftaran BETWEEN ? AND ?
          ORDER BY p.tanggal_pendaftaran ASC, p.perkara_id ASC`,
        [k.akun.username, k.dari, k.sampai]
      );
    });
  }

  async function paketPendaftaranKasir(k) {
    const baris = await pendaftaranKasir(k);
    return {
      "ks-pendaftaran-kuantitas": baris.map((b) =>
        kejadian({ perkaraId: b.id, nomorPerkara: b.nomor, tanggal: b.pendaftaran, keterangan: "Pendaftaran perkara" })
      ),
      // Panjar pertama perkara itu terhadap hari pendaftarannya (tanpa `dari`: daftar sendiri).
      "ks-penerimaan-kualitas": baris.map((b) =>
        kejadian({
          perkaraId: b.id,
          nomorPerkara: b.nomor,
          tanggal: b.panjarPertama,
          tanggalAcuan: b.pendaftaran,
          keterangan: b.panjarPertama ? "Panjar diterima" : "Panjar belum tercatat",
        })
      ),
    };
  }

  async function paketPanjarDiterima(k) {
    await wajibTabel("perkara_biaya");
    const penginput = await wajibKolom("perkara_biaya", ["diinput_oleh"], "penginput biaya");
    const baris = await kueri(
      `SELECT b.perkara_id AS id, DATE_FORMAT(b.tanggal_transaksi, '%Y-%m-%d') AS tanggal, b.jumlah AS jumlah
         FROM perkara_biaya b
        WHERE b.${penginput} = ? AND b.jenis_transaksi > 0 AND b.tanggal_transaksi BETWEEN ? AND ?
        ORDER BY b.tanggal_transaksi ASC, b.id ASC`,
      [k.akun.username, k.dari, k.sampai]
    );
    const info = await infoPerkara(k, baris.map((b) => b.id));
    return {
      "ks-penerimaan-kuantitas": baris.map((b) =>
        kejadian({ perkaraId: b.id, nomorPerkara: info(b.id).nomor, tanggal: b.tanggal, nilai: b.jumlah, keterangan: "Panjar diterima" })
      ),
    };
  }

  async function paketBiayaDibebankan(k) {
    await wajibTabel("perkara_biaya");
    const penginput = await wajibKolom("perkara_biaya", ["diinput_oleh"], "penginput biaya");
    // Satu kejadian per PERKARA (bukan per transaksi); jumlah transaksinya di keterangan.
    const baris = await kueri(
      `SELECT b.perkara_id AS id, DATE_FORMAT(MAX(b.tanggal_transaksi), '%Y-%m-%d') AS tanggal,
              SUM(b.jumlah) AS jumlah, COUNT(*) AS transaksi
         FROM perkara_biaya b
        WHERE b.${penginput} = ? AND b.jenis_transaksi < 0 AND b.tanggal_transaksi BETWEEN ? AND ?
        GROUP BY b.perkara_id
        ORDER BY MAX(b.tanggal_transaksi) ASC, b.perkara_id ASC`,
      [k.akun.username, k.dari, k.sampai]
    );
    const info = await infoPerkara(k, baris.map((b) => b.id));
    return {
      "ks-biaya-kuantitas": baris.map((b) =>
        kejadian({
          perkaraId: b.id,
          nomorPerkara: info(b.id).nomor,
          tanggal: b.tanggal,
          nilai: b.jumlah,
          keterangan: `Biaya dibebankan (${Number(b.transaksi)} transaksi)`,
        })
      ),
    };
  }

  async function paketSisaPanjar(k) {
    if (!k.akun.aktif) return {};
    await wajibTabel("perkara_putusan", "perkara_biaya", "perkara");
    // Logika sisa panjar mengikuti kasirRekapService: jenis_biaya_id 151 =
    // pengembalian sisa panjar; jenis_transaksi > 0 = panjar masuk.
    const baris = await kueri(
      `SELECT pt.perkara_id AS id, p.nomor_perkara AS nomor, DATE_FORMAT(pt.tanggal_putusan, '%Y-%m-%d') AS putusan,
              (SELECT DATE_FORMAT(MIN(b.tanggal_transaksi), '%Y-%m-%d') FROM perkara_biaya b
                WHERE b.perkara_id = pt.perkara_id AND b.jenis_biaya_id = 151) AS tanggalSisa,
              (SELECT SUM(b.jumlah) FROM perkara_biaya b
                WHERE b.perkara_id = pt.perkara_id AND b.jenis_biaya_id = 151) AS jumlahSisa,
              (SELECT COUNT(*) FROM perkara_biaya b
                WHERE b.perkara_id = pt.perkara_id AND b.jenis_transaksi > 0) AS adaPanjar
         FROM perkara_putusan pt
         JOIN perkara p ON p.perkara_id = pt.perkara_id
        WHERE pt.tanggal_putusan BETWEEN ? AND ?
        ORDER BY pt.tanggal_putusan ASC, pt.perkara_id ASC`,
      [k.dari, k.sampai]
    );
    // Penyebut = perkara putus yang pernah menerima panjar; yang tanpa panjar
    // (prodeo/tak ada saldo) tidak ditagih pengembalian.
    const bersisa = baris.filter((b) => Number(b.adaPanjar) > 0 || b.tanggalSisa);
    const bentuk = (b, keterangan) =>
      kejadian({
        perkaraId: b.id,
        nomorPerkara: b.nomor,
        tanggal: b.tanggalSisa,
        tanggalAcuan: b.putusan,
        nilai: b.jumlahSisa,
        keterangan,
      });
    return {
      "ks-biaya-sisa": bersisa.map((b) => bentuk(b, b.tanggalSisa ? "Sisa panjar dikembalikan" : "Sisa panjar belum dikembalikan")),
      "ks-biaya-sisa-kembali": bersisa.filter((b) => b.tanggalSisa).map((b) => bentuk(b, "Sisa panjar dikembalikan")),
    };
  }

  /**
   * Paket sumber tiap jabatan. `kunci` = kunci yang dihasilkan (agar bila paket
   * gagal, semua kuncinya ditandai tidak terbaca). `tambahan` = hanya bila diminta.
   */
  function paketJabatan(jabatan) {
    const awal = AWAL_PANMUD[jabatan];
    switch (jabatan) {
      case "ketua":
      case "wakil-ketua":
        return [
          { kunci: ["pmh-kuantitas"], jalan: paketPmh },
          { kunci: ["phs-kuantitas"], jalan: paketPhs },
        ];
      case "panitera":
        return [{ kunci: ["pn-penunjukan-kuantitas", "pn-penunjukan-kualitas"], jalan: paketPenunjukanPanitera }];
      case "panmud-hukum":
        return [
          { kunci: ["ph-arsip-bht", "ph-arsip-kuantitas"], jalan: paketBhtArsip },
          { kunci: ["x-ph-arsip-input"], jalan: paketArsipInput, tambahan: true },
        ];
      case "panmud-gugatan":
      case "panmud-permohonan":
        return [
          { kunci: [`${awal}-putusan-kuantitas`, `${awal}-putusan-unggah`, `${awal}-publikasi-kuantitas`], jalan: paketPutusanPanmud },
          { kunci: [`${awal}-putusan-waktu`], jalan: paketPemberitahuanPanmud },
          { kunci: [`${awal}-akta-kuantitas`, `${awal}-akta-kualitas`], jalan: paketAktaPanmud },
        ];
      case "pp":
        return [
          { kunci: ["pp-sidang-kuantitas", "pp-sidang-bas", "pp-sidang-waktu"], jalan: paketSidangPp },
          { kunci: ["x-pp-penunjukan", "x-pp-input-sendiri", "x-pp-putus"], jalan: paketPpTambahan, tambahan: true },
        ];
      case "jurusita":
      case "jurusita-pengganti":
        return [
          { kunci: ["js-relaas-kuantitas", "js-relaas-dokumen", "js-relaas-waktu", "js-input-kualitas"], jalan: paketRelaas },
          { kunci: ["x-js-pemberitahuan-putusan"], jalan: paketPemberitahuanJs, tambahan: true },
        ];
      case "petugas-meja":
        return [
          { kunci: ["mj-minutasi-kuantitas"], jalan: paketMinutasi },
          { kunci: ["mj-akta-kuantitas", "mj-akta-waktu"], jalan: paketAktaMeja },
        ];
      case "kasir":
        return [
          { kunci: ["ks-pendaftaran-kuantitas", "ks-penerimaan-kualitas"], jalan: paketPendaftaranKasir },
          { kunci: ["ks-penerimaan-kuantitas"], jalan: paketPanjarDiterima },
          { kunci: ["ks-biaya-kuantitas"], jalan: paketBiayaDibebankan },
          { kunci: ["ks-biaya-sisa", "ks-biaya-sisa-kembali"], jalan: paketSisaPanjar },
        ];
      default:
        // operator, koordinator-delegasi, informasi: tidak ada indikator SIPP.
        return [];
    }
  }

  /** Nama paket untuk pembaca (frasa galat), bukan kunci teknis. */
  const NAMA_PAKET = new Map([
    [paketPmh, "Penetapan majelis hakim"],
    [paketPhs, "Penetapan hari sidang pertama"],
    [paketPenunjukanPanitera, "Penunjukan panitera pengganti dan jurusita"],
    [paketBhtArsip, "Perkara berkekuatan hukum tetap dan arsipnya"],
    [paketArsipInput, "Pengarsipan berkas"],
    [paketPutusanPanmud, "Putusan perkara"],
    [paketPemberitahuanPanmud, "Pemberitahuan putusan"],
    [paketAktaPanmud, "Pembuatan akta cerai"],
    [paketSidangPp, "Sidang yang didampingi"],
    [paketPpTambahan, "Penunjukan dan putusan panitera pengganti"],
    [paketRelaas, "Relaas"],
    [paketPemberitahuanJs, "Pemberitahuan putusan"],
    [paketMinutasi, "Minutasi"],
    [paketAktaMeja, "Pembuatan akta cerai"],
    [paketPendaftaranKasir, "Pendaftaran perkara"],
    [paketPanjarDiterima, "Panjar yang diterima"],
    [paketBiayaDibebankan, "Biaya yang dibebankan"],
    [paketSisaPanjar, "Pengembalian sisa panjar"],
  ]);

  // ---- satu akun ------------------------------------------------------------------

  async function faktaAkun(akun, jabatanDinilai, periode, batas, tambahan, catatLog, bersama) {
    const konteks = buatKonteks(akun, periode, batas, jabatanDinilai, bersama);
    const fakta = [];
    for (const paket of paketJabatan(jabatanDinilai)) {
      if (paket.tambahan && !tambahan) continue;
      try {
        const hasil = await paket.jalan(konteks);
        for (const kunci of paket.kunci) {
          if (hasil[kunci] === undefined) continue; // paket unit yang tak berlaku bagi akun ini
          fakta.push({ kunci, terbaca: true, kejadian: hasil[kunci], galat: null });
        }
      } catch (error) {
        if (!(error instanceof TidakTerbaca)) catatLog(`${paket.kunci[0]} (${akun.username})`, error);
        const frasa =
          error instanceof TidakTerbaca ? error.message : FRASA.bacaGagal(NAMA_PAKET.get(paket.jalan) || "Bagian ini");
        for (const kunci of paket.kunci) fakta.push({ kunci, terbaca: false, kejadian: [], galat: frasa });
      }
    }
    return fakta;
  }

  // ---- titik masuk ------------------------------------------------------------------

  async function skpJabatan(masukan = {}, opsi = {}) {
    const hariIni = /^\d{4}-\d{2}-\d{2}$/.test(String(opsi.hariIni || "")) ? opsi.hariIni : tanggalHariIni();
    const sekarang = Number.isFinite(opsi.sekarang) ? opsi.sekarang : jam();
    const periksa = periksaMasukan(masukan, hariIni);
    if (!periksa.ok) return periksa;
    const { tahun, periode: kunciPeriode, jabatan, usernames, tambahan } = periksa.pilihan;
    const username = usernames.length > 0;
    const periode = susunPeriode(kunciPeriode, tahun);

    const kunciSinggahan = `${jabatan || "*"}:${username ? JSON.stringify([...usernames].sort()) : "*"}:${periode.kunci}:${tahun}:${tambahan ? "t" : "-"}:${hariIni}`;
    const tersimpan = ambilSinggahan(kunciSinggahan, sekarang);
    if (tersimpan) return tersimpan;

    // Satu batas keadaan: akhir periode, atau hari ini bila periodenya belum berakhir.
    const batas = hariIni && hariIni < periode.selesai ? hariIni : periode.selesai;
    const catatan = [];
    const catatanOperator = [];
    const galat = [];
    const pesanGalat = (error) => String((error && error.message) || error).slice(0, 500);
    const catatLog = (bagian, error) =>
      console.warn(`[skpJabatan] ${bagian} tidak terbaca (${periode.kunci} ${tahun}): ${pesanGalat(error)}`);

    let akunSemua;
    try {
      akunSemua = await bacaAkun({ usernames });
    } catch (error) {
      if (!(error instanceof TidakTerbaca)) catatLog("daftar akun", error);
      return {
        ok: false,
        status: 502,
        alasan: "sipp_tidak_terbaca",
        error: error instanceof TidakTerbaca ? error.message : FRASA.bacaGagal("Daftar akun SIPP"),
      };
    }
    if (username && akunSemua.length === 0) {
      return { ok: false, status: 404, alasan: "akun_tidak_ditemukan", error: "Akun SIPP itu tidak ditemukan." };
    }
    // Sebagian username tak dikenal: yang ada tetap dihitung, yang hilang dicatat untuk petugas.
    for (const diminta of usernames) {
      if (!akunSemua.some((a) => a.username.toLowerCase() === diminta.toLowerCase())) {
        catatanOperator.push(`Akun SIPP "${diminta}" tidak ditemukan di sys_users: periksa penautan akunnya di Pemetaan.`);
      }
    }

    // Bila username disebut: hanya akun itu (jabatan menurut permintaan, atau
    // dugaannya). Bila tidak: akun yang dugaannya cocok dengan jabatan diminta.
    const terpilih = [];
    for (const a of akunSemua) {
      if (!username) {
        if (!a.jabatanDugaan) continue;
        if (!cocokJabatan(a.jabatanDugaan, jabatan)) continue;
      }
      terpilih.push({ akun: a, jabatanDinilai: jabatan || a.jabatanDugaan });
    }

    const akun = [];
    const bersama = { memo: new Map(), info: new Map() };
    for (const { akun: a, jabatanDinilai } of terpilih) {
      const fakta = await faktaAkun(a, jabatanDinilai, periode, batas, tambahan, catatLog, bersama);
      const adaIsi = fakta.some((f) => f.kejadian.length > 0);
      // Akun lama tanpa satu kejadian pun tidak ikut (kecuali diminta menurut username);
      // galat bacaan akun lama pun tidak ditampilkan - itu bukan pekerjaan yang sedang dinilai.
      if (!username && !a.aktif && !adaIsi) continue;
      for (const f of fakta) {
        if (f.terbaca || !f.galat) continue;
        if (f.galat === TAUTAN_PANITERA) {
          const baris = `Akun SIPP "${a.username}" belum ditautkan ke panitera (user_panitera): sidang dan putusannya tidak dapat dibaca.`;
          if (!catatanOperator.includes(baris)) catatanOperator.push(baris);
        } else if (!galat.includes(f.galat)) {
          galat.push(f.galat);
        }
      }
      akun.push({
        username: a.username,
        userIdSipp: String(a.userid),
        nama: a.nama,
        grup: a.grup,
        jabatanDugaan: a.jabatanDugaan,
        aktif: a.aktif,
        fakta,
      });
    }

    if (!akun.length) {
      catatanOperator.push("Tidak ada akun SIPP yang cocok dengan permintaan ini (periksa grup di sys_user_group).");
    }
    catatan.push(
      `Fakta dibaca dari SIPP untuk ${periode.labelPanjang} (${periode.mulai} s.d. ${periode.selesai}); keadaan dibaca sampai ${batas}.`
    );
    if (jabatan === "panmud-hukum" || (!jabatan && akun.some((a) => a.jabatanDugaan === "panmud-hukum"))) {
      const j = jendelaBht(periode);
      catatan.push(
        `Pengarsipan dinilai atas perkara berkekuatan hukum tetap ${j.mulai} s.d. ${j.selesai}: arsip menyusul putusan berkekuatan hukum tetap.`
      );
    }
    if (jabatan === "wakil-ketua" || jabatan === "ketua") {
      catatanOperator.push("Ketua dan Wakil Ketua satu grup SIPP (10): dibedakan lewat peran di ALETA.");
    }
    if (jabatan === "operator" || jabatan === "koordinator-delegasi" || jabatan === "informasi") {
      catatanOperator.push(
        "SIPP tidak memuat indikator untuk jabatan ini: SKP-nya disusun dari jejak ALETA dan isian manual."
      );
    }

    const data = {
      ok: true,
      periode,
      jabatan,
      akun,
      catatan,
      catatanOperator,
      galat,
      dihitungPada: new Date(sekarang).toISOString(),
    };
    // Yang sebagian gagal TIDAK disinggahkan: percobaan berikutnya mendapat
    // kesempatan membaca bagian itu lagi.
    if (galat.length === 0) simpanSinggahan(kunciSinggahan, data, sekarang);
    return data;
  }

  /**
   * Jembatan Pemetaan: akun SIPP beserta grup (sys_user_group + sys_groups) dan
   * jabatan dugaannya (jurusita.jabatan membedakan Jurusita / Pengganti).
   * Bawaan hanya akun aktif; semua=1 menyertakan akun lama. Hanya SELECT.
   */
  async function daftarAkun(masukan = {}) {
    const nama = bacaUsername(masukan.username);
    if (!nama.ok) return nama;
    const semua = ["1", "true", "ya"].includes(bersih(masukan.semua).toLowerCase());
    let akunSemua;
    try {
      akunSemua = await bacaAkun({ usernames: nama.daftar });
    } catch (error) {
      if (!(error instanceof TidakTerbaca)) console.warn(`[skpJabatan] daftar akun tidak terbaca: ${String((error && error.message) || error).slice(0, 500)}`);
      return {
        ok: false,
        status: 502,
        alasan: "sipp_tidak_terbaca",
        error: error instanceof TidakTerbaca ? error.message : FRASA.bacaGagal("Daftar akun SIPP"),
      };
    }
    const akun = akunSemua
      .filter((a) => semua || a.aktif)
      .map((a) => ({
        username: a.username,
        userIdSipp: String(a.userid),
        nama: a.nama,
        aktif: a.aktif,
        grup: a.grupDetail.map((g) => ({ groupid: g.groupid, nama: g.nama || null })),
        jabatanDugaan: a.jabatanDugaan,
        tautPanitera: a.paniteraId !== null,
      }));
    return { ok: true, akun, dihitungPada: new Date(jam()).toISOString() };
  }

  /** Dipakai uji, dan bila SIPP baru saja diperbaiki dan angkanya harus segar. */
  function kosongkanSinggahan() {
    singgahan.clear();
  }

  return { skpJabatan, daftarAkun, kosongkanSinggahan };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  JABATAN,
  GRUP_JABATAN,
  ALUR,
  KUNCI_FAKTA,
  KUNCI_TURUNAN,
  KUNCI_TAMBAHAN,
  // Murni - diuji langsung.
  tanggalSah,
  kejadian,
  jabatanDugaan,
  cocokJabatan,
  jendelaBht,
  periksaMasukan,
  bacaUsername,
  buatLayanan,
  kosongkanSinggahan: () => layananBawaan().kosongkanSinggahan(),
  skpJabatan: (masukan, opsi) => layananBawaan().skpJabatan(masukan, opsi),
  daftarAkun: (masukan) => layananBawaan().daftarAkun(masukan),
};
