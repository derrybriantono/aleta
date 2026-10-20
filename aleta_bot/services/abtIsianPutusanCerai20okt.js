"use strict";

/**
 * ============================================================================
 * ISIAN PUTUSAN CERAI YANG DAPAT TERISI OTOMATIS DARI TAB ANAK SIPP (agen U2, 20 Okt 2026)
 * ============================================================================
 *
 * Melengkapi abtIsianLengkap20okt.js lewat kanal "Isi dari SIPP" yang sama. HANYA SELECT, tidak menulis apa pun. Tiap usulan membawa
 * keyakinan (cukup / ragu), kalimat sumber dan catatan bahasa pengguna; jagaIsianLama: ketikan petugas tidak pernah ditimpa.
 *
 *   4106   Keadaan anak (belum mumayyiz / mumayyiz)   tab Anak SIPP: tanggal lahir semua anak bernama, umur penuh pada hari ini
 *                                                      (12 tahun penuh = mumayyiz, Pasal 105 KHI). Campuran umur = tidak ditebak.
 *   2004   Kini anak diasuh oleh                       tab Anak SIPP: diasuh_oleh 1 = Penggugat/Pemohon, 2 = Tergugat/Termohon
 *                                                      (pemetaan yang sama dengan isiJawabanSaksiFakta.js); campuran = tidak ditebak.
 *                                                      HANYA SARAN (ragu): diukur 77,5% (31/40) cocok dengan pemegang asuhan di amar hakim.
 *
 * KEPUTUSAN majelis (isian 4100-4105: dikabulkan / sebagian / ditolak / tidak dapat diterima / ex officio) SENGAJA tidak diisi mesin:
 * itu putusan hakim. Mesin hanya mengenali TUNTUTAN di petitum (variabel ABT 4140-4146) dan menyusun kalimat dari pilihan hakim.
 *
 * Tidak ada nilai yang memuat nama aplikasi ini; semua teks pengguna berbahasa Indonesia.
 */

const { isoKeTampil } = require("./abtIsianSippLanjutan");
const { umurTahun } = require("./abtIsianLengkap20okt");

const diam = (kerja) => {
  try {
    return Promise.resolve(kerja()).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
};
const satu = (r) => (Array.isArray(r) && r[0]) || null;

const BELUM_MUMAYYIZ = "belum mumayyiz (belum berumur 12 tahun)";
const SUDAH_MUMAYYIZ = "mumayyiz (berumur 12 tahun atau lebih)";
const BATAS_MUMAYYIZ = 12;

function butir(kode, nama, nilai, keyakinan, o) {
  const x = o || {};
  const kalimat = x.kalimat ? String(x.kalimat).slice(0, 400) : "";
  return {
    kode,
    nama,
    nilai,
    keyakinan,
    bentrok: "",
    sumber: kalimat ? [{ saksi: 0, asal: x.asal || "sipp", kalimat }] : [],
    catatan: x.catatan || "",
    dihitung: false,
    jagaIsianLama: true,
    kodePola: x.kodePola || "",
  };
}

/** Hari ini sebagai YYYY-MM-DD (waktu setempat); bisa disuntik lewat opsi `pada` untuk uji. */
function hariIni(pada) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(pada || ""))) return String(pada);
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 4106: keadaan anak menurut tanggal lahir di tab Anak SIPP.
 * rows: [{nama, lahir:'YYYY-MM-DD'}]. Hanya anak bernama yang dihitung. Anak tanpa tanggal lahir yang sah = tidak ditebak (hasil kosong).
 */
function usulanKeadaanAnak(rows, pada) {
  const hari = hariIni(pada);
  const anak = (Array.isArray(rows) ? rows : []).filter((r) => r && String(r.nama || "").replace(/\s+/g, "").length > 1);
  if (!anak.length) return [];
  const umur = anak.map((r) => umurTahun(r.lahir, hari));
  if (umur.some((u) => u === null)) return [];
  const sudah = umur.filter((u) => u >= BATAS_MUMAYYIZ).length;
  const daftar = anak.map((r, i) => `${String(r.nama).replace(/\s+/g, " ").trim()} (lahir ${isoKeTampil(r.lahir)}, ${umur[i]} tahun)`).join("; ");
  const dasar = `SIPP tab Anak: ${daftar}; dihitung pada ${isoKeTampil(hari)}`;
  if (sudah === 0) {
    return [
      butir("4106", "Keadaan anak", BELUM_MUMAYYIZ, "cukup", {
        kalimat: dasar,
        catatan: "Semua anak di tab Anak SIPP belum berumur 12 tahun pada hari ini (belum mumayyiz, Pasal 105 huruf a dan Pasal 156 huruf a KHI). Diukur 20 dari 21 putusan (95%) sama dengan umur yang disebut hakim di amar; selisihnya anak yang tepat 12 tahun. Periksa bila umur anak menjelang 12 tahun.",
        kodePola: "sipp-anak-belum-mumayyiz",
      }),
    ];
  }
  if (sudah === anak.length) {
    return [
      butir("4106", "Keadaan anak", SUDAH_MUMAYYIZ, "cukup", {
        kalimat: dasar,
        catatan: "Semua anak di tab Anak SIPP sudah berumur 12 tahun atau lebih (mumayyiz, anak memilih; Pasal 105 huruf b dan Pasal 156 huruf b KHI). Isi juga pendapat anak yang didengar di persidangan.",
        kodePola: "sipp-anak-mumayyiz",
      }),
    ];
  }
  // Campuran: tidak ditebak, hanya diberi tahu terang-terangan (layar menampilkan "diisi manual" + alasan).
  return [
    butir("4106", "Keadaan anak", "", "tidak_ada_sumber", {
      kalimat: dasar,
      catatan: `Anak berbeda umur: ${sudah} dari ${anak.length} anak sudah mumayyiz (12 tahun atau lebih) dan sisanya belum. Pilih sesuai anak yang dimohonkan, atau pisahkan penetapan per anak.`,
    }),
  ];
}

/** 2004: yang kini mengasuh anak menurut tab Anak SIPP (diasuh_oleh 1 = Penggugat/Pemohon, 2 = Tergugat/Termohon). */
function usulanDiasuhOleh(rows, jenis) {
  const anak = (Array.isArray(rows) ? rows : []).filter((r) => r && String(r.nama || "").replace(/\s+/g, "").length > 1);
  if (!anak.length) return [];
  const kode = anak.map((r) => String(r.diasuh == null ? "" : r.diasuh).trim());
  if (!kode.every((k) => k === "1" || k === "2") || new Set(kode).size !== 1) return [];
  const ct = Number(jenis) === 346;
  const nilai = kode[0] === "1" ? (ct ? "Pemohon" : "Penggugat") : ct ? "Termohon" : "Tergugat";
  return [
    butir("2004", "Kini anak tersebut diasuh oleh", nilai, "ragu", {
      kalimat: `SIPP tab Anak: diasuh oleh ${nilai} (${anak.length} anak)`,
      catatan: "Yang kini mengasuh anak menurut tab Anak di SIPP. Atas 40 putusan cerai 2023+ yang amarnya menyebut pemegang asuhan, hanya 31 (77,5%) sama dengan isian tab Anak, jadi ini saran: kuatkan dengan keterangan saksi di sidang.",
      kodePola: "sipp-anak-diasuh-oleh",
    }),
  ];
}

const KODE_DIISI = Object.freeze(["4106", "2004"]);
const JENIS_CERAI = Object.freeze([346, 347]);

/** Semua usulan satu perkara cerai. `runQuery(sql, params)` = pembaca SIPP baca-saja milik abtUsulanService. */
async function usulanPutusanCerai(perkaraId, runQuery, opsi) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0 || typeof runQuery !== "function") return [];
  const perkara = satu(await diam(() => runQuery("SELECT jenis_perkara_id AS jenis FROM perkara WHERE perkara_id = ? LIMIT 1", [id])));
  if (!perkara || !JENIS_CERAI.includes(Number(perkara.jenis))) return [];
  const rows = await diam(() =>
    runQuery(
      "SELECT nama_anak AS nama, DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') AS lahir, diasuh_oleh AS diasuh FROM perkara_anak_pihak WHERE perkara_id = ? AND nama_anak IS NOT NULL AND TRIM(nama_anak) <> '' ORDER BY anak_ke, id LIMIT 12",
      [id]
    )
  );
  const data = Array.isArray(rows) ? rows : [];
  const hasil = [];
  for (const u of [...usulanDiasuhOleh(data, perkara.jenis), ...usulanKeadaanAnak(data, opsi && opsi.pada)]) {
    if (!hasil.some((x) => x.kode === u.kode)) hasil.push(u);
  }
  return hasil;
}

module.exports = { KODE_DIISI, BELUM_MUMAYYIZ, SUDAH_MUMAYYIZ, usulanKeadaanAnak, usulanDiasuhOleh, usulanPutusanCerai };
