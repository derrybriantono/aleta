"use strict";

/**
 * ============================================================================
 * SITA (DARI PETITUM + SIPP) DAN EKSEKUSI PERKARA - 12 Okt 2026, butir 22-24
 * ============================================================================
 *
 * Diminta pengguna 12 Oktober 2026: "tambahkan penanda dan tag tentang Sita
 * (nama penanda Sita-nya sesuai apakah Sita Jaminan atau Sita Revindikator
 * atau sita lainnya), buat di tab agenda sidang di bawah rekonvensi dan
 * eksepsi (cek dari petitum sumber sitanya)", lalu "tambahkan di rincian dan
 * status perkara mengenai rekonvensi, eksepsi dan sita" dan "tambahkan
 * mengenai eksekusi".
 *
 * ----------------------------------------------------------------------------
 * SUMBER SITA
 * ----------------------------------------------------------------------------
 *
 * 1. perkara.petitum (sumber utama). Diukur 12 Okt 2026 - petitum yang memuat
 *    huruf "sita": 49 di sipp_donggala, 42 di sipp Bungku; dibaca satu per
 *    satu. Lebih dari separuhnya NAMA ORANG ("Rosita", "Masita", "Warsita",
 *    "ma'sita") atau "posita" - karena itu hanya kata "sita" utuh yang
 *    dihitung, dan tidak didahului tanda petik atau "juru". Hasil terukur:
 *
 *                       Jaminan  Marital  Revindikasi  Lainnya   perkara
 *      sipp_donggala       20       8          1      1 (waris)    29
 *      sipp (Bungku)       10      16          0         0         26
 *
 *    Seluruh 91 petitum berhuruf "sita" dibaca; 55 perkara bersita
 *    tertangkap semua, 36 sisanya nama orang/"posita" (tidak ada salah
 *    tangkap tersisa sesudah perbaikan di bawah).
 *    (Sita Eksekusi di petitum: 0 di keduanya.) Angka ini dijaga
 *    manajemen_surat/src/test/penanda-sita.test.ts lewat contoh nyata.
 *
 * 2. SIPP - kolom sita yang ada dan diukur:
 *      perkara_putusan_sela.penetapan_sita_jaminan / pelaksanaan_sita_jaminan
 *        34 dan 32 baris putusan sela, 0 terisi tanggal sita - tetap dibaca
 *        (didaftarkan di sippSkemaService) untuk satker yang mengisinya.
 *      perkara_eksekusi.penetapan_sita_eksekusi / pelaksanaan_sita_eksekusi
 *        2 dari 3 (Donggala), 2 dari 3 (Bungku) - menjadi "Sita Eksekusi".
 *      perkara_penyitaan: 0 baris di keduanya (tabel pidana) - tidak dibaca.
 *
 * Aturan petitum (mengikuti pembacaan petitum kumulasiPerkaraService, Agen A):
 *   - bagian PRIMER saja; butir yang DIAWALI "menolak" / "tidak dapat
 *     diterima" dibuang;
 *   - butir posita "bahwa ..." dibuang, KECUALI "bahwa ... memohon ...
 *     (meletakkan) sita" - permohonan sita yang ditulis petugas sebagai
 *     posita di kotak petitum (terukur 164/Pdt.G/2023/PA.Buk);
 *   - "sah dan berharga sita ..." = ada sita (diletakkan sebelumnya);
 *   - "pengangkatan/mengangkat sita" BUKAN permohonan sita;
 *   - "penyitaan"/"disita" tidak dihitung: satu-satunya temuan
 *     ("akta penyerahan/penyitaan fisik", 602/Pdt.G/2026/PA.Dgl) bukan sita.
 *
 * Jenis (istilah baku; pengguna menulis "Revindikator", yang dipakai "Sita
 * Revindikasi" - revindicatoir beslag):
 *   jaminan      "sita jaminan", conservatoir beslag (ejaan beragam, "(cb)")
 *   revindikasi  revindicatoir / "rivindikatoir berslaag (rb)"
 *   marital      marital / maritaal / maritale beslag, "sita harta bersama";
 *                "sita material" (salah ketik marital, terukur 2 perkara
 *                harta bersama) ikut marital
 *   eksekusi     "sita eksekusi" / executorial beslag
 *   lain         "Sita" + kata aslinya ("Sita Harta Waris")
 *
 * ----------------------------------------------------------------------------
 * EKSEKUSI
 * ----------------------------------------------------------------------------
 *
 * perkara_eksekusi: 3 baris di tiap basis data (1/Pdt.Eks/2022-2024/PA.Dgl,
 * 1/Pdt.Eks/2019-2024/PA.Buk). perkara_id-nya milik perkara ASAL di
 * pengadilan ini - DIUKUR, bukan diandaikan (kolom senama bukan arti sama):
 * 6/6 baris nomor_perkara_pn sama dengan perkara.nomor_perkara lewat
 * perkara_id. Tautan dijaga keduanya: perkara_id DAN nomor_perkara_pn harus
 * cocok; yang tidak cocok tidak ditampilkan. Kolom berbeda antarversi SIPP
 * (terkait_perkara_id tidak ada di Bungku) - kolom dipilih lewat skema.
 *
 * Seluruh kueri SELECT; tidak ada tulisan ke SIPP.
 */

const { diktumPetitum } = require("./kumulasiPerkaraService");

// ---------------------------------------------------------------------------
// Petitum -> sita
// ---------------------------------------------------------------------------

const JENIS_SITA = {
  jaminan: "Sita Jaminan",
  revindikasi: "Sita Revindikasi",
  marital: "Sita Marital",
  eksekusi: "Sita Eksekusi",
};
const URUTAN = ["jaminan", "revindikasi", "marital", "eksekusi", "lain"];

/** Kata "sita" utuh - bukan Rosita/Masita/posita/ma'sita, bukan "juru sita". */
const POLA_KATA_SITA = /(?<![\w'’`])(?<!juru\s)sita\b/g;
/** "... beslag" tanpa kata sita (ejaan terukur: beslag, beslaag, baslag, berslaag). */
const POLA_BESLAG = /\b(?:be?r?sla+g|baslag|beslah)\b/;

const POLA_TOLAK = /^(?:\d{1,2}[.)]\s*)?menolak\b|tidak\s+dapat\s+diterima|niet\s+ontvankelijk/;
const POLA_POSITA = /^(?:[a-z0-9]{1,2}[.)]\s*)?bahwa\b/;
const POLA_POSITA_MOHON_SITA = /\bmemohon\b[^;]{0,200}?(?<![\w'’`])sita\b/;
const POLA_ANGKAT = /\b(?:mengangkat|pengangkatan|diangkat|angkat)\s+(?:\S+\s+){0,1}$/;

/** Kata sesudah "sita" yang bukan nama jenisnya. */
const KATA_HENTI = new Set(
  "yang atas terhadap tersebut dalam oleh di diatas pada adalah sah dan ini itu untuk dengan sebagaimana dari ke berupa serta atau telah agar bagi seluruh semua".split(
    " "
  )
);

/**
 * Istilah jenis yang TERSURAT; yang paling dekat ke kata "sita" menang,
 * kecuali "jaminan" yang diikuti istilah khusus ("sita jaminan marital
 * (maritale beslag)", terukur 506/Pdt.G/2026/PA.Dgl = marital). "harta
 * bersama" hanya cadangan bila tidak
 * ada istilah tersurat: "sita jaminan ... atas objek harta bersama" (terukur
 * 8/Pdt.G/2023/PA.Buk) tetap Sita Jaminan.
 */
const ISTILAH_JENIS = [
  ["revindikasi", /revindi|rivindi|revindic/],
  ["marital", /marit|materi[ae]l\b/],
  ["eksekusi", /eksekusi|executori|eksekutori/],
  ["jaminan", /jaminan|cons?erv|coserv|consev|\(cb\)/],
];

function jenisDariJendela(jendela) {
  let terbaik = "";
  let posisi = Infinity;
  for (const [kode, pola] of ISTILAH_JENIS) {
    const m = pola.exec(jendela);
    if (m && m.index < posisi) {
      terbaik = kode;
      posisi = m.index;
    }
  }
  // "sita jaminan marital" / "sita jaminan (cb) ... marital": jaminan adalah
  // nama umum; istilah khusus di jendela yang sama lebih tepat.
  if (terbaik === "jaminan") {
    for (const [kode, pola] of ISTILAH_JENIS.slice(0, 2)) if (pola.test(jendela.slice(0, 40))) return kode;
  }
  if (terbaik) return terbaik;
  if (/harta\s+bersama|gono/.test(jendela)) return "marital";
  return "";
}

function hurufAwalKapital(teks) {
  return teks.replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase());
}

/** Kutipan sekitar kata sitanya; diktum pendek utuh. */
function kutipanSekitar(diktum, indeks) {
  if (diktum.length <= 220) return diktum;
  const awal = Math.max(0, indeks - 80);
  const akhir = Math.min(diktum.length, indeks + 140);
  return `${awal > 0 ? "..." : ""}${diktum.slice(awal, akhir).trim()}${akhir < diktum.length ? "..." : ""}`;
}

/**
 * "SUBSIDER: PRIMER: ..." (terukur 253/Pdt.G/2024/PA.Buk): kepala subsider
 * yang tertulis SEBELUM kata primer membuat seluruh petitum terbuang oleh
 * pemotong subsider. Kepala subsider di depan "primer" dibuang lebih dulu.
 */
function rapikanKepalaPrimer(html) {
  const teks = String(html || "");
  const i = teks.search(/\bprim(?:ai|e)r\b/i);
  if (i <= 0) return teks;
  return teks.slice(0, i).replace(/\bsubsid\w*/gi, " ") + teks.slice(i);
}

/**
 * Sita yang diminta / dinyatakan sah di petitum.
 *
 * @param {string} petitumHtml perkara.petitum (HTML)
 * @returns {{kode: string, nama: string, kutipan: string}[]} urut jaminan,
 *   revindikasi, marital, eksekusi, lain; satu entri per jenis.
 */
function sitaDariPetitum(petitumHtml) {
  const hasil = new Map();
  const tambah = (kode, nama, diktum, indeks) => {
    const kunci = kode === "lain" ? `lain:${nama}` : kode;
    if (hasil.has(kunci)) return;
    hasil.set(kunci, { kode, nama, kutipan: kutipanSekitar(diktum, indeks) });
  };

  for (const diktum of diktumPetitum(rapikanKepalaPrimer(petitumHtml))) {
    if (POLA_TOLAK.test(diktum)) continue;
    if (POLA_POSITA.test(diktum) && !POLA_POSITA_MOHON_SITA.test(diktum)) continue;

    const temuan = [...diktum.matchAll(POLA_KATA_SITA)];
    if (temuan.length === 0) {
      // "conservatoir beslag" tanpa kata sita.
      const b = POLA_BESLAG.exec(diktum);
      if (!b) continue;
      const jendela = diktum.slice(Math.max(0, b.index - 40), b.index + b[0].length);
      const kode = jenisDariJendela(jendela);
      if (kode) tambah(kode, JENIS_SITA[kode], diktum, b.index);
      continue;
    }

    temuan.forEach((m, k) => {
      const mulai = m.index + m[0].length;
      if (POLA_ANGKAT.test(diktum.slice(Math.max(0, m.index - 30), m.index))) return;
      // Jendela: sampai kata sita berikutnya ("sita jaminan (cb) dan sita
      // rivindikatoir") atau 60 huruf.
      const berikut = temuan[k + 1] ? temuan[k + 1].index : diktum.length;
      const jendela = diktum.slice(mulai, Math.min(berikut, mulai + 60));
      const kode = jenisDariJendela(jendela);
      if (kode) {
        tambah(kode, JENIS_SITA[kode], diktum, m.index);
        return;
      }
      // Sita lain: "Sita" + kata aslinya, berhenti pada kata sambung.
      const kata = [];
      for (const w of jendela.replace(/[^a-z\s-]/g, " ").split(/\s+/).filter(Boolean)) {
        if (KATA_HENTI.has(w) || kata.length >= 2) break;
        kata.push(w);
      }
      const nama = kata.length > 0 ? `Sita ${hurufAwalKapital(kata.join(" "))}` : "Sita";
      tambah("lain", nama, diktum, m.index);
    });
  }
  return [...hasil.values()].sort((a, b) => URUTAN.indexOf(a.kode) - URUTAN.indexOf(b.kode));
}

// ---------------------------------------------------------------------------
// Eksekusi
// ---------------------------------------------------------------------------

/** Tanggal SIPP sah -> "YYYY-MM-DD"; "0000-00-00"/NULL -> "". */
function tanggalSah(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const y = nilai.getFullYear();
    if (y < 1900) return "";
    return `${y}-${String(nilai.getMonth() + 1).padStart(2, "0")}-${String(nilai.getDate()).padStart(2, "0")}`;
  }
  const t = String(nilai).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || t.startsWith("0000") || t.slice(0, 4) < "1900") return "";
  return t;
}

const bersih = (x) => String(x == null ? "" : x).replace(/\s+/g, " ").trim();

/** eksekusi_putusan: putusan tingkat mana yang dieksekusi (terukur 10 & 20). */
const TINGKAT_PUTUSAN = { 10: "tingkat pertama", 20: "banding", 30: "kasasi", 40: "peninjauan kembali" };

/** Tahapan eksekusi berurutan: [kolom, sebutan]. Hanya yang bertanggal yang ditampilkan. */
const TAHAP_EKSEKUSI = [
  ["permohonan_eksekusi", "Permohonan eksekusi"],
  ["penetapan_teguran_eksekusi", "Penetapan teguran (aanmaning)"],
  ["pelaksanaan_teguran_eksekusi", "Pelaksanaan teguran (aanmaning)"],
  ["pelaksanaan_teguran_eksekusi_kedua", "Pelaksanaan teguran kedua"],
  ["konstatering_pelaksanaan", "Pelaksanaan konstatering"],
  ["penetapan_sita_eksekusi", "Penetapan sita eksekusi"],
  ["pelaksanaan_sita_eksekusi", "Pelaksanaan sita eksekusi"],
  ["penetapan_perintah_eksekusi_lelang", "Penetapan perintah lelang"],
  ["pelaksanaan_eksekusi_lelang", "Pelaksanaan lelang"],
  ["penyerahan_hasil_lelang", "Penyerahan hasil lelang"],
  ["penetapan_perintah_eksekusi_rill", "Penetapan perintah eksekusi riil"],
  ["pelaksanaan_eksekusi_rill", "Pelaksanaan eksekusi riil"],
  ["penetapan_noneksekusi", "Penetapan non-eksekutabel"],
  ["tanggal_cabut_eks", "Permohonan eksekusi dicabut"],
];

const KOLOM_EKSEKUSI = [
  "id",
  "perkara_id",
  "nomor_perkara_pn",
  "eksekusi_nomor_perkara",
  "nomor_register_eksekusi",
  "eksekusi_putusan",
  "permohonan",
  "status_eksekusi_text",
  "nomor_penetapan_sita_eksekusi",
  ...TAHAP_EKSEKUSI.map((t) => t[0]),
];

/**
 * Satu baris perkara_eksekusi -> keterangan untuk layar.
 *
 * jenis: "riil" bila ada perintah/pelaksanaan eksekusi riil; "pembayaran
 * sejumlah uang (lelang)" bila ada perintah/pelaksanaan lelang; keduanya
 * bila keduanya; "" bila belum sampai ke sana (SIPP tidak punya kolom jenis
 * yang terisi - jenis_pelaksanaan_id NULL 3/3).
 */
function ringkasEksekusi(b) {
  const tahap = [];
  for (const [kolom, nama] of TAHAP_EKSEKUSI) {
    const t = tanggalSah(b[kolom]);
    if (t) tahap.push({ nama, tanggal: t });
  }
  // permohonan_eksekusi kosong pada SIPP lama: pakai kolom permohonan.
  const permohonan = tanggalSah(b.permohonan_eksekusi) || tanggalSah(b.permohonan);
  if (permohonan && !tahap.some((x) => x.nama === "Permohonan eksekusi")) {
    tahap.unshift({ nama: "Permohonan eksekusi", tanggal: permohonan });
  }
  const jenis = [];
  if (tanggalSah(b.penetapan_perintah_eksekusi_rill) || tanggalSah(b.pelaksanaan_eksekusi_rill)) jenis.push("riil");
  if (
    tanggalSah(b.penetapan_perintah_eksekusi_lelang) ||
    tanggalSah(b.pelaksanaan_eksekusi_lelang) ||
    tanggalSah(b.penyerahan_hasil_lelang)
  ) {
    jenis.push("pembayaran sejumlah uang (lelang)");
  }
  const urutTanggal = [...tahap].sort((x, y) => (x.tanggal < y.tanggal ? -1 : x.tanggal > y.tanggal ? 1 : 0));
  return {
    nomorRegister: bersih(b.nomor_register_eksekusi),
    nomorPutusanDieksekusi: bersih(b.eksekusi_nomor_perkara),
    tingkatPutusan: TINGKAT_PUTUSAN[Number(b.eksekusi_putusan)] || "",
    tanggalPermohonan: permohonan,
    jenis: jenis.join(" dan "),
    statusTerakhir: bersih(b.status_eksekusi_text),
    tahapTerakhir: urutTanggal.length > 0 ? urutTanggal[urutTanggal.length - 1] : null,
    tahap,
    dicabut: tanggalSah(b.tanggal_cabut_eks),
    nomorPenetapanSita: bersih(b.nomor_penetapan_sita_eksekusi),
    penetapanSita: tanggalSah(b.penetapan_sita_eksekusi),
    pelaksanaanSita: tanggalSah(b.pelaksanaan_sita_eksekusi),
  };
}

// ---------------------------------------------------------------------------
// Penyatuan
// ---------------------------------------------------------------------------

/**
 * Sita dari petitum + catatan SIPP menjadi satu daftar.
 *
 * @param {{petitum?: string, putusanSela?: {penetapan: string, pelaksanaan: string}[], eksekusi?: ReturnType<typeof ringkasEksekusi>[]}} masukan
 * @returns {null | {daftar: {kode: string, nama: string, sumber: "petitum"|"sipp"|"keduanya", kutipan?: string, catatanSipp?: string}[]}}
 */
function satukanSita({ petitum = "", putusanSela = [], eksekusi = [] } = {}) {
  const daftar = sitaDariPetitum(petitum).map((x) => ({ ...x, sumber: "petitum" }));
  const catat = (kode, catatan) => {
    const ada = daftar.find((x) => x.kode === kode);
    if (ada) {
      ada.sumber = ada.sumber === "petitum" ? "keduanya" : ada.sumber;
      ada.catatanSipp = ada.catatanSipp ? `${ada.catatanSipp}; ${catatan}` : catatan;
    } else {
      daftar.push({ kode, nama: JENIS_SITA[kode], sumber: "sipp", catatanSipp: catatan });
    }
  };
  for (const s of putusanSela) {
    if (!s.penetapan && !s.pelaksanaan) continue;
    catat(
      "jaminan",
      `Putusan sela: penetapan sita jaminan ${s.penetapan || "-"}${s.pelaksanaan ? `, dilaksanakan ${s.pelaksanaan}` : ""}`
    );
  }
  for (const e of eksekusi) {
    if (!e.penetapanSita && !e.pelaksanaanSita) continue;
    catat(
      "eksekusi",
      `Register eksekusi ${e.nomorRegister || "-"}: penetapan sita eksekusi ${e.nomorPenetapanSita ? `${e.nomorPenetapanSita} ` : ""}${
        e.penetapanSita || "-"
      }${e.pelaksanaanSita ? `, dilaksanakan ${e.pelaksanaanSita}` : ""}`
    );
  }
  if (daftar.length === 0) return null;
  daftar.sort((a, b) => URUTAN.indexOf(a.kode) - URUTAN.indexOf(b.kode));
  return { daftar };
}

// ---------------------------------------------------------------------------
// Pembaca SIPP - satu kueri IN per tabel untuk seluruh daftar
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
 * Sita dan eksekusi sekumpulan perkara.
 *
 * Gagal-terbuka per sumber: tabel yang tidak ada/tidak terdaftar = sumber itu
 * dilewati (bukan galat). Galat kueri dilempar - pemanggil mencatatnya
 * sebagai "tidak terbaca" (sitaTerbaca false), bukan "tidak ada sita".
 *
 * @returns {Promise<{sita: Record<string, ReturnType<typeof satukanSita>>, eksekusi: Record<string, ReturnType<typeof ringkasEksekusi>[]>}>}
 *   perkaraId -> keterangan; perkara tanpa sita/eksekusi tidak punya kunci.
 */
async function sitaEksekusiBanyakPerkara(daftarPerkaraId = [], opsi = {}) {
  const id = [...new Set(daftarPerkaraId.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))].slice(0, 500);
  if (id.length === 0) return { sita: {}, eksekusi: {} };
  const db = opsi.db || require("../db_config");
  const skema = opsi.skema || require("./sippSkemaService");
  const isian = id.map(() => "?").join(", ");

  const [adaPetitum, adaSela, kolomEks] = await Promise.all([
    skema.kolomAda("perkara", "petitum"),
    skema.kolomAda("perkara_putusan_sela", "penetapan_sita_jaminan"),
    skema.kolomTabel("perkara_eksekusi"),
  ]);
  const punyaEks = new Set(kolomEks || []);
  const pilihEks = KOLOM_EKSEKUSI.filter((k) => punyaEks.has(k));
  const bisaEks = punyaEks.has("perkara_id") && punyaEks.has("nomor_perkara_pn");

  const [barisPetitum, barisSela, barisEks] = await Promise.all([
    adaPetitum
      ? runQuery(db, `SELECT p.perkara_id AS perkaraId, p.petitum AS petitum FROM perkara p WHERE p.perkara_id IN (${isian})`, id)
      : Promise.resolve([]),
    adaSela
      ? runQuery(
          db,
          `SELECT s.perkara_id AS perkaraId, s.penetapan_sita_jaminan AS penetapan,
                  ${(await skema.kolomAda("perkara_putusan_sela", "pelaksanaan_sita_jaminan")) ? "s.pelaksanaan_sita_jaminan" : "NULL"} AS pelaksanaan
             FROM perkara_putusan_sela s
            WHERE s.perkara_id IN (${isian})`,
          id
        )
      : Promise.resolve([]),
    bisaEks
      ? runQuery(
          db,
          // perkara_id DAN nomornya harus cocok - lihat kepala berkas.
          `SELECT ${pilihEks.map((k) => `e.${k}`).join(", ")}
             FROM perkara_eksekusi e
             JOIN perkara p ON p.perkara_id = e.perkara_id AND TRIM(p.nomor_perkara) = TRIM(e.nomor_perkara_pn)
            WHERE e.perkara_id IN (${isian})
            ORDER BY e.perkara_id, e.id`,
          id
        )
      : Promise.resolve([]),
  ]);

  const eksekusi = {};
  for (const b of barisEks) {
    const kunci = String(b.perkara_id);
    (eksekusi[kunci] = eksekusi[kunci] || []).push(ringkasEksekusi(b));
  }
  const selaPer = {};
  for (const b of barisSela) {
    const kunci = String(b.perkaraId);
    (selaPer[kunci] = selaPer[kunci] || []).push({ penetapan: tanggalSah(b.penetapan), pelaksanaan: tanggalSah(b.pelaksanaan) });
  }
  const petitumPer = {};
  for (const b of barisPetitum) petitumPer[String(b.perkaraId)] = b.petitum ? String(b.petitum) : "";

  const sita = {};
  for (const n of id) {
    const kunci = String(n);
    const satu = satukanSita({ petitum: petitumPer[kunci] || "", putusanSela: selaPer[kunci] || [], eksekusi: eksekusi[kunci] || [] });
    if (satu) sita[kunci] = satu;
  }
  return { sita, eksekusi };
}

module.exports = {
  JENIS_SITA,
  TAHAP_EKSEKUSI,
  sitaDariPetitum,
  satukanSita,
  ringkasEksekusi,
  rapikanKepalaPrimer,
  tanggalSah,
  sitaEksekusiBanyakPerkara,
};
