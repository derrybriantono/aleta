"use strict";

/**
 * ============================================================================
 * KUMULASI PERKARA - DARI SIPP, ATAU DARI PETITUM BILA SIPP KOSONG
 * ============================================================================
 *
 * Diminta pengguna 12 Oktober 2026: "Apabila ada kumulasi perkara maka taruh
 * namanya dengan kumulasi (contoh Cerai Gugat Kumulasi Hak Asuh Anak), apabila
 * tidak diisi di SIPP maka cek petitumnya (biasanya petugas lupa) terus
 * analisa ke kumulasi perkara apa, tambah juga di rincian."
 *
 * ----------------------------------------------------------------------------
 * TEMPAT SIPP MENCATATNYA
 * ----------------------------------------------------------------------------
 *
 * perkara_kumulasi(perkara_id, jenis_perkara_id) - satu baris per jenis yang
 * dikumulasikan, namanya dari jenis_perkara. Diukur 12 Oktober 2026:
 *
 *   sipp_donggala   86 baris / 86 perkara dari 10.216 perkara
 *                   (Itsbat 51, Penguasaan Anak 32, Lain-Lain 2,
 *                    Pengesahan Anak 1) - SELURUHNYA cerai talak/gugat
 *   sipp (Bungku)   38 baris / 36 perkara dari 5.554
 *
 * perkara_perbaikan_gugatan.petitum kosong (0 baris) di kedua basis data,
 * jadi petitum yang dibaca hanya perkara.petitum (terisi 10.183/10.216).
 *
 * ----------------------------------------------------------------------------
 * PETITUM: HANYA TUNTUTAN YANG SUNGGUH DIMINTA
 * ----------------------------------------------------------------------------
 *
 *   - Hanya bagian PRIMER: semua sesudah "Subsider/Subsidair" dibuang.
 *   - Dipotong per butir (paragraf, titik koma, titik dua, nomor butir,
 *     titik di depan kata kerja petitum). Butir yang memuat "menolak" atau
 *     "tidak dapat diterima" dibuang.
 *   - Tiap jenis punya pola yang menuntut sesuatu, bukan kata lepas: "anak"
 *     saja tidak pernah cukup; hak asuh perlu "hak asuh/hadhanah/di bawah
 *     pemeliharaan", nafkah anak perlu "nafkah/biaya ... anak". Biaya
 *     hadhanah adalah NAFKAH anak, bukan hak asuh.
 *   - Hanya untuk perkara cerai talak (346) dan cerai gugat (347): di sanalah
 *     SIPP mencatat kumulasinya (86/86), dan pada jenis lain tuntutan pokok
 *     itu sendiri (harta bersama, hadhanah) bukan kumulasi.
 *
 * Ketepatannya diukur atas data lokal sebelum dipakai - lihat
 * manajemen_surat/src/test/kumulasi-perkara.test.ts (angka di kepala uji).
 *
 * Seluruh kueri SELECT; tidak ada tulisan ke SIPP.
 */

const { potongAmar } = require("./pembebananIkrarService");

/** Jenis perkara yang petitumnya dianalisa. */
const JENIS_DIANALISA = new Set([346, 347]);

/**
 * Jenis kumulasi yang dikenali. jenisPerkaraId = baris jenis_perkara SIPP
 * yang setara (dipakai menyatukan hasil SIPP dan petitum); null bila SIPP
 * tidak punya jenis tersendiri untuknya.
 */
const JENIS_KUMULASI = [
  { kode: "itsbat-nikah", nama: "Itsbat Nikah", jenisPerkaraId: 360 },
  { kode: "hak-asuh-anak", nama: "Hak Asuh Anak", jenisPerkaraId: 349 },
  { kode: "nafkah-anak", nama: "Nafkah Anak", jenisPerkaraId: null },
  { kode: "nafkah-iddah", nama: "Nafkah Iddah", jenisPerkaraId: null },
  { kode: "mutah", nama: "Mut'ah", jenisPerkaraId: null },
  { kode: "nafkah-madliyah", nama: "Nafkah Madliyah", jenisPerkaraId: null },
  { kode: "harta-bersama", nama: "Harta Bersama", jenisPerkaraId: 348 },
  { kode: "mahar", nama: "Mahar", jenisPerkaraId: null },
  { kode: "pengesahan-anak", nama: "Pengesahan Anak", jenisPerkaraId: 352 },
  { kode: "asal-usul-anak", nama: "Asal Usul Anak", jenisPerkaraId: 358 },
];

/** Sebutan untuk jenis_perkara SIPP yang namanya panjang/kaku. */
const SEBUTAN_JENIS_SIPP = {
  360: { kode: "itsbat-nikah", nama: "Itsbat Nikah" },
  349: { kode: "hak-asuh-anak", nama: "Hak Asuh Anak" },
  348: { kode: "harta-bersama", nama: "Harta Bersama" },
  352: { kode: "pengesahan-anak", nama: "Pengesahan Anak" },
  358: { kode: "asal-usul-anak", nama: "Asal Usul Anak" },
  351: { kode: "hak-bekas-istri", nama: "Hak Bekas Istri" },
  369: { kode: "lain-lain", nama: "Lain-lain" },
};

const HADHANAH = "had[hl]?[ao]nah";
const ANAK = "(?:anak|anak-anak)";

/**
 * Pola per jenis. Dicocokkan pada butir yang sudah dikecilkan hurufnya dan
 * entitasnya diurai (mut&#39;ah -> mut'ah).
 */
const POLA = {
  "itsbat-nikah": [
    // "Menetapkan sah pernikahan", "mengesahkan perkawinan", "itsbat nikah".
    // Celahnya tidak boleh memuat "akta/kutipan/buku": "menyatakan sah akta
    // nikah nomor ..." (terukur 2) menguji akta, bukan mengesahkan nikah.
    /\b(?:sah(?:nya)?|mengesahkan|pengesahan|i[st]{1,2}bat|isbat)\s+(?:(?!akta\b|kutipan\b|buku\b)\S+\s+){0,3}?(?:perkawinan|pernikahan|nikah)\b/,
    // "perkawinan Penggugat dengan Tergugat ... adalah sah"
    // Celah 400: tempat, tanggal, dan desa di antaranya (terukur 2 di Bungku
    // lewat pada celah 200).
    /\b(?:perkawinan|pernikahan)\b[^;]{0,400}\b(?:adalah|dinyatakan|dianggap)\s+sah\b/,
  ],
  "hak-asuh-anak": [
    new RegExp(`\\bhak\\s+(?:asuh|${HADHANAH}|pemeliharaan|pengasuhan|perwalian)\\b`),
    /\bpemegang\s+hak\b/,
    // "Menetapkan [nama anak]. dengan tetap memberikan hak akses kepada
    // Tergugat untuk mengunjungi anak" - kata "hak asuh"-nya terhapus petugas
    // (terukur 336/Pdt.G/2026, kumulasi Penguasaan Anak di SIPP).
    /\bhak\s+akses\b[^;]{0,80}\banak\b/,
    // "Menetapkan anak ... bernama: a. ...; b. ...; Tetap berada pada
    // Penggugat" (terukur 33/Pdt.G/2024/PA.Buk) - diktum utuh, lihat
    // diktumPetitum. Diktum nafkah/biaya anak tidak ikut.
    /^(?:\d{1,2}[.)]\s*)?(?:menetapkan|menyatakan)\b(?:(?!nafkah|biaya).){0,80}\banak\b.*\b(?:berada|tinggal|ikut)\s+(?:\S+\s+){0,2}?(?:penggugat|pemohon|tergugat|termohon|ibu\w*|ayah\w*)\b/,
    new RegExp(`\\b(?:di\\s*bawah|dalam|berada\\s+(?:pada|di))\\s+(?:asuhan|pemeliharaan|pengasuhan|perawatan|${HADHANAH})\\b`),
    /\b(?:mengasuh|diasuh|memelihara|dipelihara)\b[^;]{0,80}\banak\b|\banak\b[^;]{0,120}\b(?:diasuh|dipelihara)\b/,
    // "hadhanah" yang BUKAN biaya/nafkah hadhanah
    new RegExp(`(?<!biaya\\s)(?<!nafkah\\s)(?<!ongkos\\s)\\b${HADHANAH}\\b`),
  ],
  "nafkah-anak": [
    new RegExp(`\\bnafkah\\s+(?:\\S+\\s+){0,4}?${ANAK}\\b`),
    new RegExp(`\\b(?:biaya|nafkah)\\s+(?:hidup\\s+|pemeliharaan\\s+|pendidikan\\s+|kesehatan\\s+|kebutuhan\\s+)?(?:${HADHANAH})\\b`),
    new RegExp(`\\bbiaya\\s+(?:hidup|pemeliharaan|pendidikan|kebutuhan|nafkah|perawatan|sekolah)\\s+(?:\\S+\\s+){0,4}?${ANAK}\\b`),
    // 16 Okt (F1.4): "biaya kebutuhan, perkembangan dan pendidikan [anak-anak]
    // minimal sebesar Rp ... sampai dengan anak tersebut dewasa" (terukur 5
    // dari 1.030 petitum cerai Donggala: 9711, 9718, 9839, 10091 lolos pola di
    // atas karena koma menempel pada kata pertama dan celah daftar melebihi
    // empat kata). Tanpa "istri", mut'ah, atau iddah di celahnya: nafkah istri
    // yang kebetulan menyebut anak bukan nafkah anak.
    new RegExp(
      `\\b(?:biaya|nafkah)\\s+(?:hidup|pemeliharaan|pendidikan|kebutuhan|perawatan|sekolah)\\b(?:(?!\\bistri\\b|\\bmut'?ah\\b|\\bidd?ah\\b)[^;]){0,200}?\\b${ANAK}\\b`
    ),
  ],
  // "Idah" sering NAMA ("Idah binti Lukaudju", terukur): ejaan satu-d hanya
  // dihitung bila didahului nafkah/uang/biaya/masa. Nama dalam kurung
  // ber-bin/binti sudah dibuang lebih dulu (tanpaNama).
  "nafkah-iddah": [/\bidd(?:ah|ha|h)\b|\bid'dah\b/, /\b(?:nafkah|uang|biaya|masa)\s+(?:\S+\s+){0,2}?i?d'?d?ah\b/],
  mutah: [/\bmut'?\s?ah\b/],
  "nafkah-madliyah": [
    // \b di depan: "Pramadhika" (nama) memuat "madhi" - terukur.
    /\bma(?:d|hd)[hl]?iy+ah\b|\bmadl[iy]/,
    // "nafkah lampau ANAK" adalah nafkah anak, bukan madliyah (terukur 3).
    /\bnafkah\b(?:(?!\banak)[^;]){0,80}\b(?:lampau|terutang|terhutang|yang\s+(?:telah\s+)?(?:lalu|lewat|dilalaikan|tidak\s+diberikan))\b(?!\s+(?:\S+\s+){0,2}?anak\b)/,
  ],
  "harta-bersama": [/\bharta\s+(?:bersama|gono|gana)|\bgono[- ]?gini\b/],
  mahar: [/\bmahar\b[^;]{0,200}\b(?:membayar|melunasi|menyerahkan|hutang|utang|belum\s+(?:dibayar|dilunasi|diserahkan)|kewajiban)\b|\b(?:membayar|melunasi|menyerahkan|hutang|utang|kewajiban)\b[^;]{0,120}\bmahar\b/],
  "pengesahan-anak": [/\bpengesahan\s+anak\b|\banak\b[^;]{0,120}\badalah\s+anak\s+(?:sah|kandung)\b/],
  "asal-usul-anak": [/\basal[- ]usul\s+anak\b/],
};

/**
 * Butir yang menggugurkan satu jenis walau polanya cocok.
 * "menyatakan sah menurut hukum perkawinan ... putus karena perceraian"
 * (terukur 93/Pdt.G/2026) memutus perkawinan, bukan mengesahkannya.
 */
const POLA_BUKAN = {
  "itsbat-nikah": /\bputus\b|\bperceraian\b|\btalak\b/,
};

/** Butir petitum yang menolak/menyatakan tidak dapat diterima - bukan tuntutan. */
const POLA_TOLAK = /\bmenolak\b|tidak\s+dapat\s+diterima|niet\s+ontvankelijk/;

/**
 * Butir yang diawali "bahwa" adalah posita yang ikut tersalin ke kotak
 * petitum ("bahwa setelah menikah ... anak tersebut berada dalam pengasuhan
 * Tergugat", terukur 407/Pdt.G/2024) - keadaan, bukan tuntutan.
 */
const POLA_POSITA = /^(?:[a-z0-9]{1,2}[.)]\s*)?bahwa\b/;

/** Nama dalam kurung ber-bin/binti/alias dibuang: "(Idah binti ...)". */
function tanpaNama(teks) {
  return teks.replace(/\([^()]*\b(?:bin|binti|alias)\b[^()]*\)/gi, " ");
}

/** Kepala bagian subsider - semua sesudahnya bukan tuntutan kumulasi. */
const POLA_SUBSIDER = /\bsubsid\w*|\bex\s+aequo\s+et\s+bono\b/i;

/**
 * Petitum HTML -> butir-butir teks kecil.
 *
 * potongAmar memotong paragraf, titik koma, dan titik dua. Petitum yang
 * ditulis dalam satu paragraf tanpa titik koma ("...seluruhnya. Menetapkan
 * sah...") dipotong lagi pada nomor butir dan titik di depan kata kerja.
 */
/**
 * "SUBSIDER: PRIMER: ..." (terukur 253/Pdt.G/2024/PA.Buk, agen K 12 Okt): kepala
 * subsider yang tertulis SEBELUM kata primer membuat seluruh petitum terbuang
 * oleh pemotong subsider. Kepala subsider di depan "primer" dibuang lebih dulu.
 * Dipakai juga pembaca sita (sitaEksekusiPerkaraService).
 */
function rapikanKepalaPrimer(html) {
  const teks = String(html || "");
  const i = teks.search(/\bprim(?:ai|e)r\b/i);
  if (i <= 0) return teks;
  return teks.slice(0, i).replace(/\bsubsid\w*/gi, " ") + teks.slice(i);
}

function butirPetitum(html) {
  const potongan = potongAmar(rapikanKepalaPrimer(html));
  const teksUtuh = potongan.map((p) => p.teks).join(" ;; ");
  // Bagian primer saja.
  const m = POLA_SUBSIDER.exec(teksUtuh);
  const primer = m ? teksUtuh.slice(0, m.index) : teksUtuh;
  return primer
    .split(/\s;;\s|\s(?=\d{1,2}[.)]\s)|\.\s+(?=Me[a-z]+(?:kan|i)\b)/)
    .map((x) => x.replace(/\s+/g, " ").trim().toLowerCase())
    .filter((x) => x && !/^[\s.,;:\-\d)]*$/.test(x));
}

/** Butir yang membuka diktum baru: kata kerja petitum (bernomor atau tidak) atau "bahwa". */
const POLA_AWAL_DIKTUM = /^(?:\d{1,2}[.)]\s*)?(?:me[a-z]*(?:kan|i)|menghukum|menolak|bahwa)\b/;

/**
 * Butir disatukan menjadi diktum: butir yang tidak dibuka kata kerja
 * ("a. nafkah iddah ...", "tetap berada pada Penggugat") ikut diktum di
 * atasnya. Petitum "Menetapkan anak ... bernama: a. ...; b. ...; Tetap
 * berada pada Penggugat" (terukur 33/Pdt.G/2024/PA.Buk) baru utuh terbaca
 * sebagai satu tuntutan hak asuh sesudah disatukan.
 */
function diktumPetitum(html) {
  const hasil = [];
  for (const butir of butirPetitum(html)) {
    if (hasil.length === 0 || POLA_AWAL_DIKTUM.test(butir)) hasil.push(butir);
    else hasil[hasil.length - 1] += ` ${butir}`;
  }
  return hasil;
}

/**
 * Kumulasi yang SUNGGUH diminta di petitum.
 *
 * @param {string} petitumHtml perkara.petitum (HTML)
 * @returns {{kode: string, nama: string, jenisPerkaraId: number|null, kutipan: string}[]}
 */
function kumulasiDariPetitum(petitumHtml) {
  const hasil = [];
  const sudah = new Set();
  for (const diktum of diktumPetitum(petitumHtml)) {
    if (POLA_TOLAK.test(diktum) || POLA_POSITA.test(diktum)) continue;
    const dibaca = tanpaNama(diktum);
    for (const jenis of JENIS_KUMULASI) {
      if (sudah.has(jenis.kode)) continue;
      const pola = POLA[jenis.kode] || [];
      if (!pola.some((p) => p.test(dibaca))) continue;
      if (POLA_BUKAN[jenis.kode] && POLA_BUKAN[jenis.kode].test(dibaca)) continue;
      sudah.add(jenis.kode);
      hasil.push({
        kode: jenis.kode,
        nama: jenis.nama,
        jenisPerkaraId: jenis.jenisPerkaraId,
        kutipan: diktum.length > 220 ? `${diktum.slice(0, 217)}...` : diktum,
      });
    }
  }
  // Urutan tetap mengikuti JENIS_KUMULASI, bukan urutan tulisan petitum.
  const urut = JENIS_KUMULASI.map((j) => j.kode);
  return hasil.sort((a, b) => urut.indexOf(a.kode) - urut.indexOf(b.kode));
}

/**
 * Menyatukan catatan SIPP dan hasil petitum menjadi satu keterangan.
 *
 *   - SIPP terisi: daftar SIPP (sumber "sipp"); jenis yang HANYA ada di
 *     petitum ikut, bertanda sumber "petitum".
 *   - SIPP kosong: hasil petitum (sumber "petitum") - hanya untuk jenis
 *     perkara yang dianalisa.
 *   - Tidak ada keduanya: null.
 *
 * @param {{jenisPerkaraId: number, sipp: {jenisPerkaraId: number, nama: string}[], petitum?: string}} masukan
 * @returns {null | {
 *   daftar: {kode: string, nama: string, sumber: "sipp"|"petitum", kutipan?: string}[],
 *   sumber: "sipp"|"petitum"|"campuran",
 * }}
 */
function satukanKumulasi({ jenisPerkaraId, sipp = [], petitum = "" } = {}) {
  const pokok = Number(jenisPerkaraId) || 0;
  const daftar = [];
  const kodeAda = new Set();

  for (const b of Array.isArray(sipp) ? sipp : []) {
    const id = Number(b && b.jenisPerkaraId) || 0;
    if (!id || id === pokok) continue; // jenis pokok bukan kumulasi
    const sebutan = SEBUTAN_JENIS_SIPP[id];
    const nama = sebutan ? sebutan.nama : String((b && b.nama) || "").replace(/\s+/g, " ").trim();
    if (!nama) continue;
    const kode = sebutan ? sebutan.kode : `sipp-${id}`;
    if (kodeAda.has(kode)) continue;
    kodeAda.add(kode);
    daftar.push({ kode, nama, sumber: "sipp" });
  }

  if (JENIS_DIANALISA.has(pokok) && petitum) {
    for (const p of kumulasiDariPetitum(petitum)) {
      if (kodeAda.has(p.kode)) continue;
      kodeAda.add(p.kode);
      daftar.push({ kode: p.kode, nama: p.nama, sumber: "petitum", kutipan: p.kutipan });
    }
  }

  if (daftar.length === 0) return null;
  const adaSipp = daftar.some((d) => d.sumber === "sipp");
  const adaPetitum = daftar.some((d) => d.sumber === "petitum");
  return { daftar, sumber: adaSipp && adaPetitum ? "campuran" : adaSipp ? "sipp" : "petitum" };
}

// ---------------------------------------------------------------------------
// Pembaca SIPP - satu kueri IN untuk seluruh daftar
// ---------------------------------------------------------------------------

function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/**
 * Kumulasi sekumpulan perkara.
 *
 * perkara_kumulasi didaftarkan di sippSkemaService.TABEL - tabel yang tidak
 * terdaftar dijawab "tidak ada" tanpa galat. Bila tabelnya tidak ada, hanya
 * petitum yang dibaca. Bila perkara.petitum tidak ada, hanya catatan SIPP.
 *
 * @returns {Promise<Record<string, ReturnType<typeof satukanKumulasi>>>}
 *   perkaraId -> keterangan; perkara tanpa kumulasi tidak punya kunci.
 */
async function kumulasiBanyakPerkara(daftarPerkaraId = [], opsi = {}) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
  if (id.length === 0) return {};
  const db = opsi.db || require("../db_config");
  const skema = opsi.skema || require("./sippSkemaService");

  const dipakai = id.slice(0, 500);
  const isian = dipakai.map(() => "?").join(", ");

  const [adaTabel, adaPetitum] = await Promise.all([
    skema.tabelAda("perkara_kumulasi"),
    skema.kolomAda("perkara", "petitum"),
  ]);

  const [barisPerkara, barisKumulasi] = await Promise.all([
    runQuery(
      db,
      `SELECT p.perkara_id AS perkaraId, p.jenis_perkara_id AS jenisPerkaraId
              ${adaPetitum ? ", p.petitum AS petitum" : ""}
         FROM perkara p
        WHERE p.perkara_id IN (${isian})`,
      dipakai
    ),
    adaTabel
      ? runQuery(
          db,
          `SELECT k.perkara_id AS perkaraId, k.jenis_perkara_id AS jenisPerkaraId, j.nama AS nama
             FROM perkara_kumulasi k
             LEFT JOIN jenis_perkara j ON j.id = k.jenis_perkara_id
            WHERE k.perkara_id IN (${isian})`,
          dipakai
        )
      : Promise.resolve([]),
  ]);

  const sippPer = {};
  for (const b of barisKumulasi) {
    const kunci = String(b.perkaraId);
    (sippPer[kunci] = sippPer[kunci] || []).push({ jenisPerkaraId: Number(b.jenisPerkaraId) || 0, nama: b.nama || "" });
  }

  const hasil = {};
  for (const p of barisPerkara) {
    const kunci = String(p.perkaraId);
    const satu = satukanKumulasi({
      jenisPerkaraId: Number(p.jenisPerkaraId) || 0,
      sipp: sippPer[kunci] || [],
      petitum: p.petitum ? String(p.petitum) : "",
    });
    if (satu) hasil[kunci] = satu;
  }
  return hasil;
}

/* === T 13 Okt === */
/**
 * Kumulasi SATU perkara menurut nomornya (borang ABT hanya tahu nomor perkara). null = tidak berkumulasi / tidak terbaca.
 * Gagal-terbuka: galat basis data menjawab null, bukan melempar (dipakai usulan set pertanyaan saksi).
 */
async function kumulasiNomorPerkara(nomorPerkara, opsi = {}) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return null;
  try {
    const db = opsi.db || require("../db_config");
    const baris = await runQuery(db, "SELECT perkara_id AS perkaraId FROM perkara WHERE nomor_perkara = ? LIMIT 1", [nomor]);
    const id = baris[0] && Number(baris[0].perkaraId);
    if (!id) return null;
    const peta = await kumulasiBanyakPerkara([id], opsi);
    return peta[String(id)] || null;
  } catch (_) {
    return null;
  }
}
/* === AKHIR T === */

module.exports = {
  kumulasiNomorPerkara,
  rapikanKepalaPrimer,
  JENIS_KUMULASI,
  JENIS_DIANALISA,
  SEBUTAN_JENIS_SIPP,
  butirPetitum,
  diktumPetitum,
  kumulasiDariPetitum,
  satukanKumulasi,
  kumulasiBanyakPerkara,
};
