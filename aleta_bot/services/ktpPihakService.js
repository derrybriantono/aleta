"use strict";

/**
 * ============================================================================
 * TANGGAL KTP PIHAK DARI BERKAS KTP e-COURT (12 Okt 2026, butir 14 dan 15)
 * ============================================================================
 *
 * Variabel ABT "Tgl. KTP #0046#" (0364, Pemohon/Penggugat I), "Tgl. KTP #0046# II"
 * (0366, Pemohon II), "Tgl. KTP #0047#" (0365, Termohon/Tergugat) dan "Tanggal KTP
 * P / P1" (2222) bertipe data_tanggal: selama ini DIKETIK petugas dari fotokopi
 * KTP. Artinya persis yang tertulis di blangko ("Fotokopi Kartu Tanda Penduduk
 * dengan NIK ... tanggal ... yang dikeluarkan oleh ..."): TANGGAL KTP DIKELUARKAN,
 * blok kanan-bawah kartu - bukan tanggal lahir dan bukan masa berlaku.
 * Diukur atas isian petugas nyata (aps_badilag, 267 perkara): 264 (99%) jatuh
 * pada/sebelum tanggal pendaftaran perkara, 263 (98%) sesudah pihak berumur 17
 * tahun, 266 sejak 2011 (masa KTP-el).
 *
 * Berkas KTP pihak sudah diunggah ke e-Court dan diarsipkan bot
 * (aleta_bot_ecourt_documents/files; judul "KTP"). Layanan ini:
 *
 *   - menyediakan ANTRIAN berkas KTP yang belum dibaca (perkara terbaru dulu),
 *   - menyerahkan isi berkasnya kepada portal (yang MEMBACA: pdfjs + tesseract
 *     hanya ada di citra portal - pola penandaJawabanService),
 *   - menerima hasil bacaan (NIK, nama, tanggal lahir, tanggal KTP) lalu
 *     MENCOCOKKANNYA ke pihak SIPP perkara itu (NIK, lalu nama + tanggal lahir)
 *     dan menyimpannya di aleta_bot_ktp_pihak,
 *   - menjawab "tanggal KTP tiap pihak perkara ini" bagi panel ABT.
 *
 * Variabel ABT 8870-8872 (paket abt-tanggal-ktp) membaca tabel ini LANGSUNG
 * (ABT dan aleta_bot satu MySQL di satker) bila isian petugas kosong.
 *
 * ============================================================================
 * KEJUJURAN
 * ============================================================================
 *
 *   - Yang tidak terbaca DISEBUT (status tidak_terbaca + sebab), bukan ditebak
 *     dan bukan "tidak ada KTP".
 *   - Baris yang tidak dapat dicocokkan ke pihak mana pun (mis. KTP saksi atau
 *     kuasa) tetap disimpan tanpa pihak - tidak pernah dipakai ABT.
 *   - Tanggal yang mustahil (sesudah perkara didaftarkan, sebelum pihak berumur
 *     14 tahun, di masa depan) ditandai "ragu" - tidak dipakai ABT.
 *   - "pasti" HANYA bila terukur >= 95% atas isian petugas (tools/ukur-tanggal-ktp.js)
 *     lalu dinyalakan lewat ALETA_KTP_PIHAK_YAKIN=pasti; sebelum itu yang terbaik
 *     adalah "cukup" (NIK sah + cocok NIK/nama+lahir + tanggal masuk akal).
 *   - Tanpa tanda ALETA di SIPP/ABT/e-Court. SIPP dan ABT tidak ditulis di sini.
 *   - NIK dan nama tidak pernah dicatat ke log.
 *
 * Tabelnya milik basis data bot dan dibuat sendiri (CREATE TABLE IF NOT EXISTS).
 */

const fs = require("fs");
const { catatRiwayat, pemicuSah } = require("./ktpPihakRiwayatService");

/** Naikkan bila aturan baca/cocok membaik: berkas versi lama dibaca ulang. */
const VERSI_KTP_PIHAK = 1;

/** Judul dokumen e-Court yang dianggap KTP. */
const POLA_JUDUL_KTP = /\b(?:e-?ktp|ktp(?:-?el)?|kartu\s+tanda\s+penduduk)\b/i;
const SQL_KANDIDAT = `LOWER(d.judul_dokumen) REGEXP 'ktp|kartu tanda penduduk'`;

/** Foto KTP yang disimpan jembatan sebagai format "gambar". */
const EKSTENSI_GAMBAR = new Set([".jpg", ".jpeg", ".png"]);

const BATAS_PERCOBAAN = 5;
/** Jam jeda sebelum mencoba lagi berkas yang gagal dibaca (dikali jumlah percobaan). */
const JEDA_JAM_PER_PERCOBAAN = 12;
/** OCR belum terpasang bukan salah berkas: coba lagi sehari kemudian, tanpa dihitung. */
const SEBAB_TANPA_OCR = "ocr_belum_tersedia";

const DDL_KTP_PIHAK = `CREATE TABLE IF NOT EXISTS aleta_bot_ktp_pihak (
  file_id VARCHAR(64) NOT NULL,
  urut TINYINT NOT NULL DEFAULT 1,
  document_key VARCHAR(191) NOT NULL DEFAULT '',
  nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
  perkara_id BIGINT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'tidak_terbaca',
  sebab VARCHAR(255) NOT NULL DEFAULT '',
  nik VARCHAR(20) NOT NULL DEFAULT '',
  nik_sah TINYINT(1) NOT NULL DEFAULT 0,
  nama VARCHAR(255) NOT NULL DEFAULT '',
  tanggal_lahir DATE NULL,
  tanggal_ktp DATE NULL,
  kota_ktp VARCHAR(100) NOT NULL DEFAULT '',
  cabang TINYINT NULL,
  urutan INT NULL,
  pihak_id BIGINT NULL,
  peran VARCHAR(64) NOT NULL DEFAULT '',
  cocok VARCHAR(16) NOT NULL DEFAULT '',
  yakin VARCHAR(8) NOT NULL DEFAULT '',
  sumber_baca VARCHAR(16) NOT NULL DEFAULT '',
  percobaan INT NOT NULL DEFAULT 0,
  versi INT NOT NULL DEFAULT 0,
  dibaca_pada DATETIME NOT NULL,
  PRIMARY KEY (file_id, urut),
  INDEX idx_abkp_pihak (perkara_id, cabang, urutan),
  INDEX idx_abkp_nomor (nomor_perkara),
  INDEX idx_abkp_status (status, dibaca_pada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

let skemaJanji = null;

function botDb() {
  return require("./botDbService");
}

function sippQuery(sql, params) {
  const db = require("../db_config");
  return new Promise((ok, gagal) => db.query(sql, params || [], (e, r) => (e ? gagal(e) : ok(r))));
}

async function pastikanSkema() {
  if (!skemaJanji) {
    skemaJanji = (async () => {
      const db = botDb();
      const siap = await db.ensureSchema();
      if (!siap) throw new Error("Basis data bot belum siap.");
      await db.query(DDL_KTP_PIHAK);
      return true;
    })().catch((galat) => {
      skemaJanji = null;
      throw galat;
    });
  }
  return skemaJanji;
}

function bersih(x, batas = 255) {
  return String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, batas);
}

function daftarNomor(nomor) {
  return [...new Set((Array.isArray(nomor) ? nomor : []).map((x) => bersih(x, 191)).filter(Boolean))].slice(0, 500);
}

// ---------------------------------------------------------------------------
// Fungsi murni
// ---------------------------------------------------------------------------

/** "dd/mm/yyyy" (bentuk pembaca KTP) -> "yyyy-mm-dd"; tanggal yang tidak nyata -> "". */
function isoDariDmy(teks) {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(bersih(teks, 20));
  if (!m) return "";
  const [h, b, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(t, b - 1, h));
  if (d.getUTCFullYear() !== t || d.getUTCMonth() !== b - 1 || d.getUTCDate() !== h) return "";
  return `${String(t).padStart(4, "0")}-${String(b).padStart(2, "0")}-${String(h).padStart(2, "0")}`;
}

function isoKeDmy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function tanggalIso(x) {
  if (!x) return "";
  if (x instanceof Date) {
    if (Number.isNaN(x.getTime())) return "";
    // Driver mysql memberi Date lokal untuk kolom DATE: ambil bagian tanggal lokalnya.
    return `${String(x.getFullYear()).padStart(4, "0")}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }
  const s = String(x).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && s !== "0000-00-00" ? s : "";
}

/**
 * Nama untuk perbandingan: huruf kecil, tanpa gelar/bin/binti/alias dan tanda baca.
 * "BUDI SANTOSO Bin HASAN, S.Pd" -> "budi santoso"; "Siti binti Ali" -> "siti".
 */
function namaBaku(nama) {
  let s = bersih(nama, 500).toLowerCase();
  s = s.replace(/\b(?:alias|als|a\.?\s?k\.?\s?a)\b.*$/, " ");
  s = s.replace(/\b(?:bin|binti|bte|bt|b\.)\b.*$/, " ");
  s = s.replace(/,.*$/, " ");
  s = s.replace(/\b(?:drs?|dra|h|hj|hajah|haji|ir|s\.?\s?(?:pd|h|e|ag|sos|kom|t)|m\.?\s?(?:pd|h|si|ag|kom)|alm|almarhum|almarhumah)\b\.?/g, " ");
  s = s.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

function jarakSunting(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let sebelum = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const kini = [i];
    for (let j = 1; j <= b.length; j += 1) {
      kini[j] = Math.min(sebelum[j] + 1, kini[j - 1] + 1, sebelum[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    sebelum = kini;
  }
  return sebelum[b.length];
}

/** Nama sama, atau beda <= 1 huruf pada nama sepanjang >= 6 (galat OCR), atau beda urutan kata. */
function namaSerupa(a, b) {
  const x = namaBaku(a);
  const y = namaBaku(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const urut = (s) => s.split(" ").sort().join(" ");
  if (urut(x) === urut(y)) return true;
  return Math.min(x.length, y.length) >= 6 && jarakSunting(x, y) <= 1;
}

function nikBersih(nik) {
  return String(nik == null ? "" : nik).replace(/\D/g, "");
}

/** Jumlah angka yang berbeda antara dua NIK 16 digit (galat baca OCR). */
function bedaNik(a, b) {
  const x = nikBersih(a);
  const y = nikBersih(b);
  if (x.length !== 16 || y.length !== 16) return 99;
  let n = 0;
  for (let i = 0; i < 16; i += 1) if (x[i] !== y[i]) n += 1;
  return n;
}

const ROMAWI = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/**
 * Sebutan peran satu pihak. cabang 1 = Penggugat/Pemohon, 2 = Tergugat/Termohon,
 * 3 = Turut (Tergugat/Termohon), 4 = pihak intervensi. Beberapa pihak dalam
 * satu cabang diberi angka Romawi ("Pemohon II"); satu pihak tanpa angka.
 */
function peranPihak(cabang, urutan, jumlahDiCabang, sebutan) {
  const s = sebutan || { satu: "Penggugat", dua: "Tergugat" };
  const pokok = cabang === 1 ? s.satu : cabang === 2 ? s.dua : cabang === 3 ? `Turut ${s.dua}` : "Pihak intervensi";
  return jumlahDiCabang > 1 && ROMAWI[urutan] ? `${pokok} ${ROMAWI[urutan]}` : pokok;
}

/**
 * Cocokkan satu KTP ke pihak-pihak SIPP perkara itu.
 *
 *   ktp:   { nik, nama, tanggalLahirIso }
 *   pihak: [{ cabang, urutan, pihakId, nama, nik, tanggalLahirIso }]
 *
 * Berjenjang (yang lebih kuat menang):
 *   nik        NIK sama persis                                  -> kuat
 *   nama_lahir nama serupa DAN tanggal lahir sama               -> kuat
 *   nama_nik   nama serupa DAN NIK beda <= 2 angka (galat OCR)  -> kuat
 *   nama       nama serupa saja (satu-satunya)                  -> lemah
 * Dua pihak sama kuat (mis. dua nama kembar) = ambigu: tidak ada yang dipilih.
 */
function cocokkanKtp(ktp, pihak) {
  const daftar = Array.isArray(pihak) ? pihak : [];
  const nik = nikBersih(ktp && ktp.nik);
  const lahir = (ktp && ktp.tanggalLahirIso) || "";
  const nama = (ktp && ktp.nama) || "";
  const nilai = (p) => {
    const nikSama = nik.length === 16 && nikBersih(p.nik) === nik;
    if (nikSama) return { cocok: "nik", kuat: true, skor: 4 };
    const namaOk = namaSerupa(nama, p.nama);
    if (namaOk && lahir && p.tanggalLahirIso && lahir === p.tanggalLahirIso) return { cocok: "nama_lahir", kuat: true, skor: 3 };
    if (namaOk && nik.length === 16 && bedaNik(nik, p.nik) <= 2) return { cocok: "nama_nik", kuat: true, skor: 3 };
    if (namaOk) return { cocok: "nama", kuat: false, skor: 1 };
    return null;
  };
  const hasil = daftar.map((p) => ({ p, n: nilai(p) })).filter((x) => x.n);
  if (!hasil.length) return { pihak: null, cocok: "", kuat: false, ambigu: false };
  const tertinggi = Math.max(...hasil.map((x) => x.n.skor));
  const juara = hasil.filter((x) => x.n.skor === tertinggi);
  if (juara.length > 1) return { pihak: null, cocok: "", kuat: false, ambigu: true };
  return { pihak: juara[0].p, cocok: juara[0].n.cocok, kuat: juara[0].n.kuat, ambigu: false };
}

/**
 * Tanggal KTP masuk akal? KTP harus terbit sebelum perkara didaftarkan (di data
 * petugas 99%), tidak di masa depan, dan sesudah pihak berumur 14 tahun.
 */
function tanggalMasukAkal({ tanggalKtpIso, tanggalLahirIso, tanggalDaftarIso, hariIniIso }) {
  const t = tanggalKtpIso;
  if (!t) return { ok: false, sebab: "tanggal_kosong" };
  const hariIni = hariIniIso || tanggalIso(new Date());
  if (t < "1990-01-01") return { ok: false, sebab: "tanggal_terlalu_lama" };
  if (t > hariIni) return { ok: false, sebab: "tanggal_di_masa_depan" };
  if (tanggalDaftarIso && t > tanggalDaftarIso) return { ok: false, sebab: "sesudah_perkara_didaftarkan" };
  if (tanggalLahirIso) {
    const [y, m, d] = tanggalLahirIso.split("-").map(Number);
    const min = `${String(y + 14).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (t < min) return { ok: false, sebab: "sebelum_umur_14" };
  }
  return { ok: true, sebab: "" };
}

/** Keyakinan tertinggi yang boleh diberikan - "pasti" hanya bila dinyalakan setelah diukur. */
function yakinTertinggi() {
  return String(process.env.ALETA_KTP_PIHAK_YAKIN || "").trim().toLowerCase() === "pasti" ? "pasti" : "cukup";
}

/**
 * Susun SATU baris tabel dari satu KTP terbaca + hasil pencocokan + konteks perkara.
 * Murni - diuji tanpa basis data.
 */
function susunBaris({ ktp, cocok, pihakDiCabang, sebutan, perkara, fileId, urut, documentKey, nomorPerkara, sumberBaca, versi, hariIniIso }) {
  const tanggalKtpIso = isoDariDmy(ktp.tanggalTerbit);
  const tanggalLahirIso = isoDariDmy(ktp.tanggalLahir);
  const nik = nikBersih(ktp.nik);
  const p = cocok && cocok.pihak;
  const akal = tanggalMasukAkal({
    tanggalKtpIso,
    tanggalLahirIso: p ? p.tanggalLahirIso || tanggalLahirIso : tanggalLahirIso,
    tanggalDaftarIso: perkara && perkara.tanggalDaftarIso,
    hariIniIso,
  });
  let yakin = "ragu";
  let sebab = "";
  if (!tanggalKtpIso) sebab = "tanggal_ktp_tidak_terbaca";
  else if (!p) sebab = cocok && cocok.ambigu ? "pihak_ambigu" : "tidak_cocok_pihak";
  else if (!akal.ok) sebab = akal.sebab;
  else if (!cocok.kuat) sebab = "hanya_nama_cocok";
  else if (!ktp.nikSah && cocok.cocok !== "nik") sebab = "nik_tidak_sah";
  else yakin = yakinTertinggi();
  return {
    fileId,
    urut,
    documentKey,
    nomorPerkara,
    perkaraId: perkara ? perkara.perkaraId : null,
    status: tanggalKtpIso || nik ? "terbaca" : "tidak_terbaca",
    sebab,
    nik,
    nikSah: ktp.nikSah ? 1 : 0,
    nama: bersih(ktp.nama, 255),
    tanggalLahirIso,
    tanggalKtpIso,
    kotaKtp: bersih(ktp.kotaTerbit, 100),
    cabang: p ? p.cabang : null,
    urutan: p ? p.urutan : null,
    pihakId: p ? p.pihakId : null,
    peran: p ? peranPihak(p.cabang, p.urutan, pihakDiCabang[p.cabang] || 1, sebutan) : "",
    cocok: p ? cocok.cocok : "",
    yakin,
    sumberBaca: ["teks-pdf", "ocr", "ocr-pdf"].includes(ktp.sumber) ? ktp.sumber : "",
    versi,
  };
}

// ---------------------------------------------------------------------------
// Konteks SIPP satu perkara
// ---------------------------------------------------------------------------

async function cariPerkara({ nomorPerkara, perkaraId }) {
  const kolom = "p.perkara_id, p.nomor_perkara, p.tanggal_pendaftaran, p.alur_perkara_id, p.jenis_perkara_id, p.jenis_perkara_nama";
  let r;
  if (perkaraId) r = await sippQuery(`SELECT ${kolom} FROM perkara p WHERE p.perkara_id = ? LIMIT 1`, [perkaraId]);
  else if (bersih(nomorPerkara, 191)) r = await sippQuery(`SELECT ${kolom} FROM perkara p WHERE p.nomor_perkara = ? LIMIT 1`, [bersih(nomorPerkara, 191)]);
  const b = Array.isArray(r) ? r[0] : null;
  if (!b) return null;
  return {
    perkaraId: Number(b.perkara_id),
    nomorPerkara: String(b.nomor_perkara),
    tanggalDaftarIso: tanggalIso(b.tanggal_pendaftaran),
    alurPerkaraId: b.alur_perkara_id,
    jenisPerkaraId: b.jenis_perkara_id,
    jenisPerkaraNama: b.jenis_perkara_nama,
  };
}

/** Pihak SIPP perkara: cabang 1-4 (pihak5 = saksi, tidak diikutkan). Hanya SELECT. */
async function pihakPerkara(perkaraId) {
  const hasil = [];
  for (const cabang of [1, 2, 3, 4]) {
    const rows = await sippQuery(
      `SELECT pp.urutan, pp.pihak_id, pp.nama, p.nomor_indentitas AS nik, p.tanggal_lahir
         FROM perkara_pihak${cabang} pp LEFT JOIN pihak p ON p.id = pp.pihak_id
        WHERE pp.perkara_id = ? ORDER BY pp.urutan`,
      [perkaraId]
    ).catch(() => []);
    for (const r of Array.isArray(rows) ? rows : []) {
      hasil.push({
        cabang,
        urutan: Number(r.urutan) || 1,
        pihakId: r.pihak_id == null ? null : Number(r.pihak_id),
        nama: bersih(r.nama, 500),
        nik: nikBersih(r.nik),
        tanggalLahirIso: tanggalIso(r.tanggal_lahir),
      });
    }
  }
  return hasil;
}

function hitungPerCabang(pihak) {
  const n = {};
  for (const p of pihak) n[p.cabang] = (n[p.cabang] || 0) + 1;
  return n;
}

function sebutanPerkara(perkara) {
  const { sebutanPihakPerkara } = require("./sebutanPihakService");
  return sebutanPihakPerkara({
    alurPerkaraId: perkara.alurPerkaraId,
    jenisPerkaraId: perkara.jenisPerkaraId,
    jenisPerkaraNama: perkara.jenisPerkaraNama,
    nomorPerkara: perkara.nomorPerkara,
  });
}

// ---------------------------------------------------------------------------
// Antrian, berkas, simpan
// ---------------------------------------------------------------------------

/**
 * Berkas KTP yang perlu dibaca: belum pernah, versi aturan lebih lama, atau gagal
 * dan sudah waktunya dicoba lagi. Perkara ?nomor= dulu, lalu yang terbaru.
 * Satu isi (sidik_jari) yang sama pada banyak perkara cukup dibaca SEKALI -
 * antrian hanya membawa wakilnya; yang lain disalin tanpa OCR (salinKembaran).
 */
async function antrian({ nomor = [], batas = 6, versi = VERSI_KTP_PIHAK } = {}) {
  await pastikanSkema();
  await salinKembaran().catch(() => undefined);
  const utama = daftarNomor(nomor);
  const rows = await botDb().query(
    `SELECT f.id AS fileId, f.document_key AS documentKey, f.format, f.ukuran_byte AS ukuran, f.sidik_jari AS sidikJari,
            d.nomor_perkara AS nomorPerkara, d.judul_dokumen AS judul
       FROM aleta_bot_ecourt_documents d
       JOIN aleta_bot_ecourt_files f ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
       LEFT JOIN aleta_bot_ktp_pihak k ON k.file_id = f.id AND k.urut = 1
      WHERE ${SQL_KANDIDAT}
        AND (k.file_id IS NULL
             OR (k.status = 'tidak_terbaca' AND k.sebab = ? AND k.dibaca_pada < UTC_TIMESTAMP() - INTERVAL 1 DAY)
             OR (k.status = 'tidak_terbaca' AND k.sebab <> ? AND k.percobaan < ?
                 AND k.dibaca_pada < UTC_TIMESTAMP() - INTERVAL (k.percobaan * ?) HOUR)
             OR (k.status <> 'tidak_terbaca' AND k.versi < ?))
      ORDER BY (d.nomor_perkara IN (?)) DESC, d.perkara_id DESC, f.document_key, f.format
      LIMIT 300`,
    [SEBAB_TANPA_OCR, SEBAB_TANPA_OCR, BATAS_PERCOBAAN, JEDA_JAM_PER_PERCOBAAN, Number(versi) || VERSI_KTP_PIHAK, utama.length ? utama : [""]]
  );
  const batasAkhir = Math.min(Math.max(Number(batas) || 6, 1), 30);
  const dilihat = new Set();
  const hasil = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const kunci = String(r.sidikJari || r.fileId);
    if (dilihat.has(kunci)) continue;
    dilihat.add(kunci);
    hasil.push({
      fileId: String(r.fileId),
      documentKey: String(r.documentKey),
      format: String(r.format || ""),
      ukuran: Number(r.ukuran) || 0,
      nomorPerkara: bersih(r.nomorPerkara, 191),
      judul: bersih(r.judul, 255),
    });
    if (hasil.length >= batasAkhir) break;
  }
  return hasil;
}

/** Isi satu berkas KTP, menurut id baris aleta_bot_ecourt_files - hanya berkas berjudul KTP. */
async function berkas(fileId) {
  const id = bersih(fileId, 64);
  if (!id) return { ok: false, alasan: "file_id_kosong" };
  const rows = await botDb().query(
    `SELECT f.jalur_berkas AS jalur
       FROM aleta_bot_ecourt_files f
       JOIN aleta_bot_ecourt_documents d ON d.document_key = f.document_key
      WHERE f.id = ? AND f.dihapus_retensi IS NULL AND ${SQL_KANDIDAT}
      LIMIT 1`,
    [id]
  );
  const baris = Array.isArray(rows) ? rows[0] : null;
  if (!baris || !baris.jalur) return { ok: false, alasan: "berkas_tidak_ada" };
  const hasil = require("./ecourtDocumentService").describeEcourtDocument(baris.jalur, { ekstensiTambahan: EKSTENSI_GAMBAR });
  if (!hasil.ok) return { ok: false, alasan: bersih(hasil.reason, 200) };
  try {
    return { ok: true, isi: fs.readFileSync(hasil.absolutePath) };
  } catch (galat) {
    return { ok: false, alasan: `berkas_tidak_terbaca: ${bersih(galat.message, 150)}` };
  }
}

const KOLOM_TULIS = [
  "file_id", "urut", "document_key", "nomor_perkara", "perkara_id", "status", "sebab", "nik", "nik_sah", "nama",
  "tanggal_lahir", "tanggal_ktp", "kota_ktp", "cabang", "urutan", "pihak_id", "peran", "cocok", "yakin", "sumber_baca",
  "percobaan", "versi",
];

async function tulisBaris(b, percobaan) {
  await botDb().query(
    `REPLACE INTO aleta_bot_ktp_pihak (${KOLOM_TULIS.join(", ")}, dibaca_pada)
     VALUES (${KOLOM_TULIS.map(() => "?").join(", ")}, UTC_TIMESTAMP())`,
    [
      b.fileId, b.urut, b.documentKey, b.nomorPerkara, b.perkaraId, b.status, b.sebab, b.nik, b.nikSah, b.nama,
      b.tanggalLahirIso || null, b.tanggalKtpIso || null, b.kotaKtp, b.cabang, b.urutan, b.pihakId, b.peran, b.cocok,
      b.yakin, b.sumberBaca, percobaan, b.versi,
    ]
  );
}

/** Berkas -> konteks (dokumen + perkara) untuk satu id berkas. */
async function asalBerkas(fileId) {
  const rows = await botDb().query(
    `SELECT f.document_key AS documentKey, f.sidik_jari AS sidikJari, d.nomor_perkara AS nomorPerkara, d.perkara_id AS perkaraId
       FROM aleta_bot_ecourt_files f JOIN aleta_bot_ecourt_documents d ON d.document_key = f.document_key
      WHERE f.id = ? AND ${SQL_KANDIDAT} LIMIT 1`,
    [fileId]
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

/**
 * Cocokkan & simpan sekumpulan KTP terbaca untuk SATU berkas (satu perkara).
 * Dipakai simpan() (hasil portal) dan salinKembaran() (berkas berisi sama).
 */
async function simpanKtpBerkas({ fileId, asal, ktp, sumberBaca, versi, hariIniIso, pemicu }) {
  const perkara = await cariPerkara({ perkaraId: asal.perkaraId || null, nomorPerkara: asal.nomorPerkara }).catch(() => null);
  const pihak = perkara ? await pihakPerkara(perkara.perkaraId).catch(() => []) : [];
  const sebutan = perkara ? sebutanPerkara(perkara) : null;
  const perCabang = hitungPerCabang(pihak);
  const dipakai = new Set();
  const baris = [];
  ktp.slice(0, 5).forEach((k, i) => {
    const pihakBelum = pihak.filter((p) => !dipakai.has(`${p.cabang}.${p.urutan}`));
    const cocok = cocokkanKtp(
      { nik: k.nik, nama: k.nama, tanggalLahirIso: isoDariDmy(k.tanggalLahir) },
      pihakBelum
    );
    if (cocok.pihak) dipakai.add(`${cocok.pihak.cabang}.${cocok.pihak.urutan}`);
    baris.push(
      susunBaris({
        ktp: { ...k, sumber: k.sumber || sumberBaca },
        cocok,
        pihakDiCabang: perCabang,
        sebutan,
        perkara,
        fileId,
        urut: i + 1,
        documentKey: asal.documentKey,
        nomorPerkara: perkara ? perkara.nomorPerkara : asal.nomorPerkara,
        sumberBaca,
        versi,
        hariIniIso,
      })
    );
  });
  await botDb().query("DELETE FROM aleta_bot_ktp_pihak WHERE file_id = ?", [fileId]);
  for (const b of baris) await tulisBaris(b, 0);
  /* === KTP-RIWAYAT 12 Okt === histori per nomor perkara (butir 11); tidak pernah menggagalkan simpan. */
  await catatRiwayat({
    fileId,
    documentKey: asal.documentKey,
    nomorPerkara: perkara ? perkara.nomorPerkara : asal.nomorPerkara,
    perkaraId: perkara ? perkara.perkaraId : asal.perkaraId,
    pemicu,
    status: baris.some((b) => b.status === "terbaca") ? "terbaca" : "tidak_terbaca",
    sebab: "",
    percobaan: 0,
    sumberBaca,
    baris,
  });
  /* === AKHIR KTP-RIWAYAT === */
  return baris.length;
}

/**
 * Hasil pembacaan portal, per berkas:
 *   { fileId, status: "terbaca" | "tidak_terbaca" | "bukan_ktp", sebab, sumber, versi,
 *     ktp: [{ nik, nikSah, nama, tanggalLahir, tanggalTerbit, kotaTerbit }] }
 * Nilai di luar daftar dibuang, bukan disimpan. Berkas berisi sama (sidik jari) ikut terisi.
 */
async function simpan(daftar = []) {
  await pastikanSkema();
  let tersimpan = 0;
  let kembaran = 0;
  for (const h of (Array.isArray(daftar) ? daftar : []).slice(0, 50)) {
    const fileId = bersih(h && h.fileId, 64);
    if (!fileId) continue;
    const asal = await asalBerkas(fileId);
    if (!asal) continue;
    const versi = Math.max(0, Number(h.versi) || VERSI_KTP_PIHAK);
    const status = ["terbaca", "tidak_terbaca", "bukan_ktp"].includes(h.status) ? h.status : "tidak_terbaca";
    const ktp = (Array.isArray(h.ktp) ? h.ktp : []).filter((k) => k && (k.nik || k.tanggalTerbit || k.nama));
    const sumberBaca = ["teks-pdf", "ocr", "ocr-pdf"].includes(h.sumber) ? h.sumber : "";
    const pemicuAsal = pemicuSah(h.pemicu);
    // Semua berkas dengan isi yang sama (KTP orang yang sama di banyak perkara).
    const semua = asal.sidikJari
      ? await botDb().query(
          `SELECT f.id AS fileId, f.document_key AS documentKey, d.nomor_perkara AS nomorPerkara, d.perkara_id AS perkaraId
             FROM aleta_bot_ecourt_files f JOIN aleta_bot_ecourt_documents d ON d.document_key = f.document_key
            WHERE f.sidik_jari = ? AND f.dihapus_retensi IS NULL AND ${SQL_KANDIDAT} LIMIT 200`,
          [asal.sidikJari]
        )
      : [{ fileId, ...asal }];
    for (const s of Array.isArray(semua) ? semua : []) {
      const sId = String(s.fileId);
      const pemicu = sId !== fileId ? "salinan" : pemicuAsal;
      if (status === "terbaca" && ktp.length) {
        await simpanKtpBerkas({ fileId: sId, asal: s, ktp, sumberBaca, versi, pemicu });
      } else {
        const lama = await botDb().query("SELECT percobaan, status FROM aleta_bot_ktp_pihak WHERE file_id = ? AND urut = 1", [sId]);
        const sebab = bersih(status === "bukan_ktp" ? "bukan_berkas_ktp" : h.sebab || "tidak_terbaca", 255);
        const percobaan = sebab === SEBAB_TANPA_OCR ? 0 : ((Array.isArray(lama) && lama[0] && Number(lama[0].percobaan)) || 0) + 1;
        /* === KTP-RIWAYAT 12 Okt === bacaan ulang yang GAGAL tidak boleh menghapus bacaan lama yang sudah
           terbaca: tanggal lama dipertahankan, berkas ditandai sudah diperiksa (agar tidak diantre tiap
           putaran), dan kegagalannya dicatat di riwayat. */
        if (Array.isArray(lama) && lama[0] && lama[0].status === "terbaca") {
          await botDb().query("UPDATE aleta_bot_ktp_pihak SET versi = ?, percobaan = 0, dibaca_pada = UTC_TIMESTAMP() WHERE file_id = ?", [
            versi,
            sId,
          ]);
          await catatRiwayat({
            fileId: sId, documentKey: s.documentKey, nomorPerkara: s.nomorPerkara, perkaraId: s.perkaraId, pemicu,
            status: "tidak_terbaca", sebab: `bacaan_ulang_gagal: ${sebab}`, percobaan, sumberBaca, baris: [],
          });
          if (sId !== fileId) kembaran += 1;
          continue;
        }
        /* === AKHIR KTP-RIWAYAT === */
        await botDb().query("DELETE FROM aleta_bot_ktp_pihak WHERE file_id = ?", [sId]);
        await tulisBaris(
          {
            fileId: sId, urut: 1, documentKey: String(s.documentKey || ""), nomorPerkara: bersih(s.nomorPerkara, 191),
            perkaraId: s.perkaraId == null ? null : Number(s.perkaraId), status: "tidak_terbaca", sebab, nik: "", nikSah: 0,
            nama: "", tanggalLahirIso: "", tanggalKtpIso: "", kotaKtp: "", cabang: null, urutan: null, pihakId: null,
            peran: "", cocok: "", yakin: "", sumberBaca, versi,
          },
          percobaan
        );
        await catatRiwayat({
          fileId: sId, documentKey: s.documentKey, nomorPerkara: s.nomorPerkara, perkaraId: s.perkaraId, pemicu,
          status: "tidak_terbaca", sebab, percobaan, sumberBaca, baris: [],
        });
      }
      if (sId !== fileId) kembaran += 1;
    }
    tersimpan += 1;
  }
  return { tersimpan, kembaran };
}

/**
 * Berkas yang belum dibaca tetapi isinya (sidik jari) sama dengan berkas yang SUDAH
 * terbaca di perkara lain: salin bacaannya, cocokkan ke pihak perkara ini. Tanpa OCR.
 */
async function salinKembaran(batas = 50) {
  const rows = await botDb().query(
    `SELECT f.id AS fileId, f.document_key AS documentKey, d.nomor_perkara AS nomorPerkara, d.perkara_id AS perkaraId,
            (SELECT k2.file_id FROM aleta_bot_ecourt_files f2 JOIN aleta_bot_ktp_pihak k2 ON k2.file_id = f2.id AND k2.urut = 1
              WHERE f2.sidik_jari = f.sidik_jari AND f2.id <> f.id AND k2.status = 'terbaca' AND k2.versi >= ? LIMIT 1) AS sumberId
       FROM aleta_bot_ecourt_documents d
       JOIN aleta_bot_ecourt_files f ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL AND f.sidik_jari <> ''
       LEFT JOIN aleta_bot_ktp_pihak k ON k.file_id = f.id AND k.urut = 1
      WHERE ${SQL_KANDIDAT} AND k.file_id IS NULL
      HAVING sumberId IS NOT NULL
      LIMIT ?`,
    [VERSI_KTP_PIHAK, Math.min(Math.max(Number(batas) || 50, 1), 200)]
  );
  let salinan = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    const bacaan = await botDb().query(
      "SELECT nik, nik_sah, nama, tanggal_lahir, tanggal_ktp, kota_ktp, sumber_baca, versi FROM aleta_bot_ktp_pihak WHERE file_id = ? ORDER BY urut",
      [r.sumberId]
    );
    const ktp = (Array.isArray(bacaan) ? bacaan : []).map((b) => ({
      nik: b.nik, nikSah: Boolean(b.nik_sah), nama: b.nama, tanggalLahir: isoKeDmy(tanggalIso(b.tanggal_lahir)),
      tanggalTerbit: isoKeDmy(tanggalIso(b.tanggal_ktp)), kotaTerbit: b.kota_ktp, sumber: b.sumber_baca,
    }));
    if (!ktp.length) continue;
    await simpanKtpBerkas({
      fileId: String(r.fileId),
      asal: { documentKey: r.documentKey, nomorPerkara: r.nomorPerkara, perkaraId: r.perkaraId },
      ktp,
      sumberBaca: (bacaan[0] && bacaan[0].sumber_baca) || "",
      versi: VERSI_KTP_PIHAK,
      pemicu: "salinan",
    });
    salinan += 1;
  }
  return salinan;
}

/** Cocokkan ulang baris perkara ini yang belum bertuan (pihak SIPP baru ditambahkan / diperbaiki). */
async function cocokkanUlangPerkara(perkara) {
  const rows = await botDb().query(
    `SELECT file_id, urut, document_key, nomor_perkara, nik, nik_sah, nama, tanggal_lahir, tanggal_ktp, kota_ktp, sumber_baca, versi
       FROM aleta_bot_ktp_pihak
      WHERE (perkara_id = ? OR nomor_perkara = ?) AND status = 'terbaca' AND cabang IS NULL`,
    [perkara.perkaraId, perkara.nomorPerkara]
  );
  const belum = Array.isArray(rows) ? rows : [];
  if (!belum.length) return 0;
  const pihak = await pihakPerkara(perkara.perkaraId).catch(() => []);
  if (!pihak.length) return 0;
  const sebutan = sebutanPerkara(perkara);
  const perCabang = hitungPerCabang(pihak);
  let diperbarui = 0;
  for (const r of belum) {
    const ktp = {
      nik: r.nik, nikSah: Boolean(r.nik_sah), nama: r.nama, tanggalLahir: isoKeDmy(tanggalIso(r.tanggal_lahir)),
      tanggalTerbit: isoKeDmy(tanggalIso(r.tanggal_ktp)), kotaTerbit: r.kota_ktp, sumber: r.sumber_baca,
    };
    const cocok = cocokkanKtp({ nik: r.nik, nama: r.nama, tanggalLahirIso: tanggalIso(r.tanggal_lahir) }, pihak);
    if (!cocok.pihak) continue;
    const b = susunBaris({
      ktp, cocok, pihakDiCabang: perCabang, sebutan, perkara, fileId: String(r.file_id), urut: Number(r.urut),
      documentKey: r.document_key, nomorPerkara: perkara.nomorPerkara, sumberBaca: r.sumber_baca, versi: Number(r.versi) || VERSI_KTP_PIHAK,
    });
    await tulisBaris(b, 0);
    diperbarui += 1;
  }
  return diperbarui;
}

const PERINGKAT_YAKIN = { pasti: 3, cukup: 2, ragu: 1, "": 0 };

/**
 * Tanggal KTP tiap pihak satu perkara (untuk panel ABT dan portal):
 *   { ok, ada, perkaraId, nomorPerkara, pihak: [{ cabang, urutan, peran, nama, tanggalKtp "dd/mm/yyyy",
 *     tanggalKtpIso, yakin, cocok, kota, sumberBaca, fileId }], belumDibaca, tidakTerbaca, takBertuan }
 * Per pihak dipilih bacaan terbaik: keyakinan tertinggi, lalu yang terbaru.
 */
async function perkaraKtp({ nomorPerkara, perkaraId } = {}) {
  await pastikanSkema();
  const perkara = await cariPerkara({ nomorPerkara, perkaraId }).catch(() => null);
  const nomor = perkara ? perkara.nomorPerkara : bersih(nomorPerkara, 191);
  if (perkara) await cocokkanUlangPerkara(perkara).catch(() => 0);
  const rows = await botDb().query(
    `SELECT file_id, urut, status, sebab, nik, nama, tanggal_ktp, kota_ktp, cabang, urutan, peran, cocok, yakin, sumber_baca, dibaca_pada
       FROM aleta_bot_ktp_pihak WHERE ${perkara ? "(perkara_id = ? OR nomor_perkara = ?)" : "nomor_perkara = ?"}`,
    perkara ? [perkara.perkaraId, nomor] : [nomor]
  );
  const semua = Array.isArray(rows) ? rows : [];
  const terbaik = new Map();
  for (const r of semua) {
    if (r.status !== "terbaca" || r.cabang == null || !r.tanggal_ktp) continue;
    const kunci = `${r.cabang}.${r.urutan}`;
    const lama = terbaik.get(kunci);
    const nilai = (x) => PERINGKAT_YAKIN[x.yakin] || 0;
    if (!lama || nilai(r) > nilai(lama) || (nilai(r) === nilai(lama) && String(r.dibaca_pada) > String(lama.dibaca_pada))) terbaik.set(kunci, r);
  }
  /* === KTP-RIWAYAT 12 Okt === nama pihak di SIPP (bukan nama pada KTP) agar layar Status Perkara mencocokkan
     dengan pasti per pihak, bukan menebak dari urutan. Gagal membaca = tanpa namaSipp, bukan galat. */
  const namaSipp = new Map();
  if (perkara) {
    for (const p of await pihakPerkara(perkara.perkaraId).catch(() => [])) namaSipp.set(`${p.cabang}.${p.urutan}`, p.nama);
  }
  /* === AKHIR KTP-RIWAYAT === */
  const pihak = [...terbaik.values()]
    .map((r) => ({
      cabang: Number(r.cabang),
      urutan: Number(r.urutan),
      peran: r.peran,
      nama: r.nama,
      namaSipp: namaSipp.get(`${r.cabang}.${r.urutan}`) || "",
      tanggalKtp: isoKeDmy(tanggalIso(r.tanggal_ktp)),
      tanggalKtpIso: tanggalIso(r.tanggal_ktp),
      kota: r.kota_ktp,
      yakin: r.yakin,
      cocok: r.cocok,
      sebab: r.sebab || "",
      sumberBaca: r.sumber_baca,
      fileId: r.file_id,
    }))
    .sort((a, b) => a.cabang - b.cabang || a.urutan - b.urutan);
  const belumDibaca = await botDb()
    .query(
      `SELECT COUNT(*) AS n FROM aleta_bot_ecourt_documents d
         JOIN aleta_bot_ecourt_files f ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
         LEFT JOIN aleta_bot_ktp_pihak k ON k.file_id = f.id AND k.urut = 1
        WHERE ${SQL_KANDIDAT} AND d.nomor_perkara = ? AND k.file_id IS NULL`,
      [nomor]
    )
    .then((x) => Number((x && x[0] && x[0].n) || 0))
    .catch(() => 0);
  const dokumenKtp = await botDb()
    .query(`SELECT COUNT(*) AS n FROM aleta_bot_ecourt_documents d WHERE ${SQL_KANDIDAT} AND d.nomor_perkara = ?`, [nomor])
    .then((x) => Number((x && x[0] && x[0].n) || 0))
    .catch(() => 0);
  return {
    ok: true,
    ada: pihak.length > 0,
    perkaraId: perkara ? perkara.perkaraId : null,
    nomorPerkara: nomor,
    pihak,
    dokumenKtp,
    belumDibaca,
    tidakTerbaca: semua.filter((r) => r.status === "tidak_terbaca").length,
    takBertuan: semua.filter((r) => r.status === "terbaca" && r.cabang == null).length,
  };
}

/** Ringkasan seluruh tabel - dipakai alat ukur dan layar admin. */
async function ringkasan() {
  await pastikanSkema();
  const [kandidat, baca] = await Promise.all([
    botDb().query(
      `SELECT COUNT(DISTINCT d.document_key) AS dokumen, COUNT(DISTINCT f.id) AS berkas
         FROM aleta_bot_ecourt_documents d LEFT JOIN aleta_bot_ecourt_files f ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
        WHERE ${SQL_KANDIDAT}`
    ),
    botDb().query("SELECT status, yakin, COUNT(*) AS n FROM aleta_bot_ktp_pihak GROUP BY status, yakin"),
  ]);
  return { kandidat: (kandidat && kandidat[0]) || {}, tabel: Array.isArray(baca) ? baca : [] };
}

module.exports = {
  VERSI_KTP_PIHAK,
  POLA_JUDUL_KTP,
  SQL_KANDIDAT,
  DDL_KTP_PIHAK,
  pastikanSkema,
  isoDariDmy,
  isoKeDmy,
  namaBaku,
  namaSerupa,
  bedaNik,
  peranPihak,
  cocokkanKtp,
  tanggalMasukAkal,
  yakinTertinggi,
  susunBaris,
  antrian,
  berkas,
  simpan,
  salinKembaran,
  perkaraKtp,
  ringkasan,
};
