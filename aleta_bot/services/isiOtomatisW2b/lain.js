"use strict";

/**
 * ============================================================================
 * ISIAN OTOMATIS KELUARGA LAIN-LAIN (agen W2b-C, 21 Okt 2026): pengangkatan anak, mafqud, permohonan umum
 * ============================================================================
 *
 * Membaca posita + petitum perkara "Lain-Lain" (jenis 369) menjadi usulan isian variabel baru paket W2b-C:
 *
 *   pengangkatan anak  4910 sejak kapan anak diasuh | 4911 alasan penyerahan oleh orang tua kandung | 4912 riwayat perkawinan dan anak kandung
 *                      4913 izin/rekomendasi instansi sosial | 4914 penghasilan | 4915 tujuan pengangkatan
 *   mafqud             4920 umur/pekerjaan/alamat orang hilang | 4921 keluarga ditinggalkan | 4922 harta ditinggalkan | 4923 sebab dan tujuan kepergian
 *   permohonan umum    4930 hal yang dimohonkan | 4931 waktu peristiwa | 4933 keperluan dan instansi | 4934 sebab meninggal dan makam (penetapan kematian)
 *                      isian penilaian hakim (4935-4939) dan bukti surat (4932): "diisi manual" beserta alasannya, tidak pernah ditebak
 *
 * Aturan: SEMUA usulan berkeyakinan "ragu" (saran, kotak samar, tekan Tab) beserta kalimat sumbernya. Kode baru belum terukur; usulan naik
 * tingkat hanya lewat berkas usulan gerbang (abt-paket/w2b-keluarga-lain/untuk-sesi-utama/lain-gerbang.json) setelah sesi utama menggabungkannya.
 * Pembaca MURNI (tanpa basis data, tanpa tulisan). Satu pembacaan yang gagal tidak menggagalkan yang lain.
 */

const B = require("../deteksi/bantuAnak");
const lainLain = require("../deteksi/lainLain");

const NAMA = Object.freeze({
  "4910": "Sejak kapan anak diasuh Pemohon",
  "4911": "Alasan orang tua kandung menyerahkan anak",
  "4912": "Riwayat perkawinan dan anak kandung Pemohon",
  "4913": "Izin atau rekomendasi instansi sosial",
  "4914": "Penghasilan Pemohon",
  "4915": "Tujuan pengangkatan anak",
  "4920": "Umur, pekerjaan, dan alamat terakhir orang yang hilang",
  "4921": "Keluarga yang ditinggalkan orang yang hilang",
  "4922": "Harta yang ditinggalkan orang yang hilang",
  "4923": "Sebab dan tujuan kepergian orang yang hilang",
  "4930": "Hal yang dimohonkan ditetapkan",
  "4931": "Waktu dan tempat peristiwa",
  "4932": "Bukti surat Pemohon",
  "4933": "Keperluan dan instansi tujuan penetapan",
  "4934": "Sebab meninggal dan tempat dimakamkan",
  "4935": "Dasar kewenangan Pengadilan Agama",
  "4936": "Kedudukan dan kepentingan hukum Pemohon",
  "4937": "Fakta yang terbukti",
  "4938": "Amar pokok penetapan",
  "4939": "Alasan penolakan atau tidak dapat diterima",
});

/** Isian penilaian hakim dan fakta persidangan permohonan umum: tidak dapat ditebak. */
const MANUAL_UMUM = Object.freeze({
  "4932": "Bukti surat diajukan di persidangan dan dicatat panitera; tidak ada di SIPP (daftar bukti berkas e-Court bila ada).",
  "4935": "Dasar kewenangan Pengadilan Agama atas permohonan ini adalah penilaian majelis; diisi hakim.",
  "4936": "Kedudukan dan kepentingan hukum Pemohon adalah penilaian majelis atas bukti dan keterangan saksi; diisi hakim.",
  "4937": "Fakta yang terbukti diputus majelis dari bukti surat dan keterangan saksi; diisi hakim.",
  "4938": "Amar pokok (apa yang ditetapkan) adalah keputusan majelis; diisi hakim.",
  "4939": "Alasan penolakan atau tidak dapat diterima adalah penilaian majelis; diisi hakim bila permohonan ditolak.",
});

const HURUF = Object.freeze(["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh"]);

function usulan(butir, kode, f) {
  if (!f || !f.nilai) return null;
  const u = butir({ kode, nilai: f.nilai, keyakinan: "ragu", kalimat: f.kalimat, catatan: f.catatan || "", kodePola: f.kodePola, asal: "posita-gugatan" });
  u.nama = NAMA[kode] || u.nama;
  return u;
}

const bersih = (s, maks) => String(s || "").replace(/\s+/g, " ").replace(/^[\s,;:.-]+|[\s,;:]+$/g, "").slice(0, maks || 300);
const kata = (n) => (HURUF[Number(n)] ? `${Number(n)} (${HURUF[Number(n)]})` : String(n));

/* -------------------------------------------------------------------------- */
/* Pengangkatan anak                                                          */
/* -------------------------------------------------------------------------- */

function sejakDiasuh(daftar) {
  for (const k of daftar) {
    if (!/\b(?:ikut|diasuh|dirawat|hidup\s+bersama|tinggal\s+bersama|wali\s+asuh|pengasuhan|diserahkan|menyerahkan)\b/i.test(k)) continue;
    const m = /\bsejak\s+(?:anak\s+(?:tersebut|itu)\s+)?(lahir|tahun\s+\d{4}|bulan\s+[A-Za-z]+\s+(?:tahun\s+)?\d{4}|tanggal\s+\d{1,2}\s+[A-Za-z]+\s+(?:tahun\s+)?\d{4}|berumur\s+\d+\s+(?:tahun|bulan)|usia\s+\d+\s+(?:tahun|bulan)|bayi)/i.exec(k);
    if (m) return B.fakta(bersih(m[1]).toLowerCase(), k, "ragu", "w2b-lain-4910-sejak");
  }
  return null;
}

function alasanSerah(daftar) {
  for (const k of daftar) {
    if (!/orang\s*tua\s+kandung/i.test(k) || !/\b(?:menyerahkan|memberikan|menitipkan|penyerahan)\b/i.test(k)) continue;
    const m = /\b(?:dikarenakan|disebabkan|karena|dengan\s+pertimbangan)\s+(.+?)(?:\s*\((?:Surat|Bukti)[^)]*\)|$)/i.exec(k);
    if (m && bersih(m[1]).length > 8) {
      const isi = bersih(m[1], 300).replace(/^(?:dengan\s+pertimbangan|karena)\s+/i, "").replace(/\bdan\s+dikarenakan\b/gi, "dan");
      return B.fakta(isi, k, "ragu", "w2b-lain-4911-alasan");
    }
  }
  return null;
}

function riwayatPerkawinan(t, daftar) {
  const bagian = [];
  let sumber = "";
  const nikah = /(?:menikah|melangsungkan\s+(?:pernikahan|perkawinan)|pernikahan\s+(?:para\s+)?pemohon\s+telah\s+dilangsungkan)[^.;]{0,60}?(?:pada\s+)?(?:tanggal\s+)?(\d{1,2}\s+[A-Za-z]+\s+(?:tahun\s+)?\d{4})/i.exec(t);
  const nikah2 = nikah ? null : /pada\s+tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+(?:tahun\s+)?\d{4}),?\s+(?:para\s+)?Pemohon\s+telah\s+(?:melangsungkan|menikah)/i.exec(t);
  const tglNikah = nikah ? nikah : nikah2;
  if (tglNikah && B.tanggalPertama(tglNikah[1])) {
    bagian.push(`dilangsungkan pada tanggal ${B.tanggalPertama(tglNikah[1])}`);
    sumber = tglNikah[0];
  } else {
    const cerai = /telah\s+bercerai[^.;]{0,120}?Akta\s+Cerai\s+Nomor\s*:?\s*([0-9A-Za-z/.]+)/i.exec(t);
    if (cerai) {
      bagian.push(`telah berakhir dengan perceraian (Akta Cerai Nomor ${cerai[1].replace(/[.,]$/, "")})`);
      sumber = cerai[0];
    }
  }
  const belum = /belum\s+(?:di)?karunia[ik]\s+k[eu]turunan|belum\s+(?:di)?karunia[ik]\s+anak|belum\s+memiliki\s+(?:keturunan|anak)/i.exec(t);
  const ada = /dikaruniai\s+(\d+|satu|dua|tiga|empat|lima)\s*(?:\(\w+\)\s*)?orang\s+anak/i.exec(t);
  if (belum) {
    bagian.push("belum dikaruniai keturunan");
    sumber = sumber || belum[0];
  } else if (ada) {
    const n = /^\d+$/.test(ada[1]) ? Number(ada[1]) : HURUF.indexOf(ada[1].toLowerCase());
    bagian.push(`telah dikaruniai ${n > 0 ? kata(n) : ada[1]} orang anak`);
    sumber = sumber || ada[0];
  }
  void daftar;
  return bagian.length ? B.fakta(bagian.join(" dan "), sumber, "ragu", "w2b-lain-4912-riwayat") : null;
}

function izinSosial(daftar) {
  const kal = daftar.filter((k) => /Dinas\s+Sosial/i.test(k) && /\b(?:izin|rekomendasi|mengizinkan|pengasuhan|pengangkatan)\b/i.test(k));
  if (!kal.length) return null;
  const nama = [];
  const nomor = [];
  for (const k of kal) {
    for (const m of k.matchAll(/Dinas\s+Sosial\s+(?:Provinsi|Kabupaten|Kota)\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?/g)) if (!nama.includes(m[0])) nama.push(m[0]);
    for (const m of k.matchAll(/(?:No\.?|Nomor)\s*:?\s*([0-9][0-9A-Za-z./-]{3,40})/gi)) if (!nomor.includes(m[1])) nomor.push(m[1].replace(/[.,;]$/, ""));
  }
  if (!nama.length) return null;
  const per = nama.slice(0, 2).map((n, i) => (nomor[i] ? `${n} Nomor ${nomor[i]}` : n));
  return B.fakta(`izin pengasuhan dari ${per.join(" dan dari ")}`, kal[0], "ragu", "w2b-lain-4913-izin");
}

function penghasilan(t) {
  const hasil = [];
  for (const m of t.matchAll(/penghasilan(?:nya)?\s*(?:\([^)]{0,60}\)\s*)?(?:sebesar|sekitar|rata-rata|kurang\s+lebih|sejumlah)?\s*(Rp\.?\s*[0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2}|,-)?)/gi)) {
    const sesudah = t.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const per = /(?:^|\s|\))(?:per\s*|setiap\s+|tiap\s+|\/\s*)(bulan|tahun)\b/i.exec(sesudah);
    const rp = m[1].replace(/Rp\.?\s*/i, "Rp").replace(/[.,]$/, "");
    hasil.push({ nilai: `${rp}${per ? ` per ${per[1].toLowerCase()}` : ""}`, sumber: m[0] });
    if (hasil.length >= 2) break;
  }
  if (!hasil.length) return null;
  const nilai = hasil.length === 1 ? `sebesar ${hasil[0].nilai}` : `Pemohon I sebesar ${hasil[0].nilai} dan Pemohon II sebesar ${hasil[1].nilai}`;
  return B.fakta(nilai, hasil[0].sumber, "ragu", "w2b-lain-4914-penghasilan");
}

function tujuan(daftar) {
  for (const k of daftar) {
    if (!/pengangkatan\s+anak|mengangkat/i.test(k)) continue;
    const m = /dalam\s+rangka\s+(.+)$/i.exec(k) || /\bbertujuan\s+(?:untuk\s+)?(.+)$/i.exec(k);
    if (m && bersih(m[1]).length > 8) return B.fakta(bersih(m[1], 250), k, "ragu", "w2b-lain-4915-tujuan");
  }
  return null;
}

function pengangkatanAnak(posita) {
  const t = B.polos(posita);
  const daftar = B.kalimat(posita);
  const peta = {};
  B.taruh(peta, "4910", sejakDiasuh(daftar));
  B.taruh(peta, "4911", alasanSerah(daftar));
  B.taruh(peta, "4912", riwayatPerkawinan(t, daftar));
  B.taruh(peta, "4913", izinSosial(daftar));
  B.taruh(peta, "4914", penghasilan(t));
  B.taruh(peta, "4915", tujuan(daftar));
  return peta;
}

/* -------------------------------------------------------------------------- */
/* Mafqud                                                                     */
/* -------------------------------------------------------------------------- */

const POLA_MAFQUD = /mafqud|orang\s+(?:yang\s+)?hilang|menghilang|tidak\s+diketahui\s+(?:keberadaan|kabar|tempat)/i;

function mafqud(posita) {
  const t = B.polos(posita);
  const daftar = B.kalimat(posita);
  const peta = {};
  const bagian = [];
  let sumber = "";
  const umur = /(?:berumur|umur|usia)\s+(\d{1,3})\s+tahun/i.exec(t);
  if (umur) {
    bagian.push(`berumur ${umur[1]} tahun`);
    sumber = umur[0];
  }
  const kerja = /\b(?:bekerja\s+sebagai|pekerjaan(?:nya)?(?:\s+adalah)?)\s+([A-Za-z][A-Za-z ]{2,40}?)(?=[,.;]|\s+(?:dan|dengan|yang)\b)/i.exec(t);
  if (kerja) {
    bagian.push(`bekerja sebagai ${bersih(kerja[1])}`);
    sumber = sumber || kerja[0];
  }
  const alamat = /(?:beralamat\s+terakhir|alamat\s+terakhir|terakhir\s+bertempat\s+tinggal)\s+(?:di\s+)?([A-Z][^.;]{4,120})/.exec(t);
  if (alamat) {
    bagian.push(`beralamat terakhir di ${bersih(alamat[1], 120)}`);
    sumber = sumber || alamat[0];
  }
  B.taruh(peta, "4920", bagian.length ? B.fakta(bagian.join(", "), sumber, "ragu", "w2b-lain-4920-identitas") : null);

  const keluarga = daftar.map((k) => /meninggalkan\s+((?:seorang|\d+\s*(?:\(\w+\)\s*)?orang)?\s*(?:istri|isteri|suami|anak)[^;.]{0,140})/i.exec(k)).find(Boolean);
  if (keluarga) B.taruh(peta, "4921", B.fakta(bersih(keluarga[1], 160), keluarga[0], "ragu", "w2b-lain-4921-keluarga"));
  const harta = daftar.map((k) => /meninggalkan\s+((?:harta|rumah|tanah|kebun|sawah|tabungan)[^;.]{0,140})/i.exec(k)).find(Boolean);
  if (harta) B.taruh(peta, "4922", B.fakta(bersih(harta[1], 160), harta[0], "ragu", "w2b-lain-4922-harta"));
  const pergi = daftar.map((k) => /\b(?:pergi|berangkat|merantau|meninggalkan\s+rumah)\b[^;.]{0,160}?\b(?:untuk|dengan\s+tujuan|karena)\s+[^;.]{3,160}/i.exec(k)).find(Boolean);
  if (pergi) B.taruh(peta, "4923", B.fakta(bersih(pergi[0], 240), pergi[0], "ragu", "w2b-lain-4923-pergi"));
  return peta;
}

/* -------------------------------------------------------------------------- */
/* Permohonan umum (penetapan kematian)                                       */
/* -------------------------------------------------------------------------- */

const POLA_KEMATIAN = /Penetapan\s+Akta\s+Kematian|telah\s+meninggal\s+dunia\s+pada\s+tanggal|meninggal\s+dunia\s+pada\s+tanggal/i;

function kematian(posita, petitum) {
  const pet = B.polos(petitum);
  const t = B.polos(posita);
  const peta = {};
  const m = /Menetapkan\s+bahwa\s+(.+?)\s+telah\s+meninggal\s+dunia\s+pada\s+tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})(?:\s+(karena[^.;]{3,80}?))?(?:\s+dan\s+(dikebumikan\s+di\s+[^.;]{3,120}))?(?:\.|;|$)/i.exec(pet) || null;
  if (m) {
    B.taruh(peta, "4930", B.fakta(`penetapan kematian ${bersih(m[1], 100)}`, m[0], "ragu", "w2b-lain-4930-kematian"));
    const tgl = B.tanggalPertama(m[2]);
    if (tgl) B.taruh(peta, "4931", B.fakta(`pada tanggal ${tgl}`, m[0], "ragu", "w2b-lain-4931-tanggal"));
    const sebab = [m[3], m[4]].filter(Boolean).join(" dan ");
    if (sebab) B.taruh(peta, "4934", B.fakta(bersih(sebab, 200), m[0], "ragu", "w2b-lain-4934-sebab"));
  } else {
    const p = /(?:bahwa\s+)?(.{5,80}?)\s+telah\s+meninggal\s+dunia\s+pada\s+tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(t);
    if (p) {
      const tgl = B.tanggalPertama(p[2]);
      if (tgl) B.taruh(peta, "4931", B.fakta(`pada tanggal ${tgl}`, p[0], "ragu", "w2b-lain-4931-tanggal"));
    }
  }
  if (/Kantor\s+Catatan\s+Sipil|Dinas\s+Kependudukan|Disdukcapil/i.test(t) && /akta\s+kematian/i.test(`${t} ${pet}`)) {
    const sumber = (B.kalimat(posita).find((k) => /Catatan\s+Sipil|Kependudukan/i.test(k)) || "").slice(0, 300);
    B.taruh(peta, "4933", B.fakta("mengurus akta kematian pada Kantor Catatan Sipil", sumber, "ragu", "w2b-lain-4933-keperluan"));
  }
  return peta;
}

/* -------------------------------------------------------------------------- */
/* Pintu masuk                                                                */
/* -------------------------------------------------------------------------- */

/** "pengangkatan-anak" | "mafqud" | "permohonan-umum" | "" (bukan keluarga ini: hak asuh, perwalian, ahli waris). */
function subJenis(posita, petitum, alur) {
  const isi = lainLain.pilahIsi(posita, { petitum, alur });
  if (isi === "pengangkatan-anak") return "pengangkatan-anak";
  if (isi) return "";
  const gabung = `${B.polos(posita)} ${B.polos(petitum)}`;
  if (POLA_MAFQUD.test(gabung) && /mafqud|orang\s+(?:yang\s+)?hilang|(?:ditetapkan|dinyatakan)\s+(?:telah\s+)?meninggal/i.test(B.polos(petitum) + " " + B.polos(posita).slice(0, 600))) return "mafqud";
  return "permohonan-umum";
}

/**
 * @param {object} k konteks perkara (isiOtomatisJenisS6): { jenisPerkaraId, posita, petitum, alur }
 * @param {Function} butir pembuat usulan milik isiOtomatisJenisS6
 * @returns {object[]} usulan (semua keyakinan "ragu" atau diisi manual)
 */
function usulanLain(k, butir) {
  if (!k || Number(k.jenisPerkaraId) !== 369 || typeof butir !== "function") return [];
  const sub = subJenis(k.posita || "", k.petitum || "", k.alur);
  if (!sub) return [];
  let peta = {};
  try {
    if (sub === "pengangkatan-anak") peta = pengangkatanAnak(k.posita || "");
    else if (sub === "mafqud") peta = mafqud(k.posita || "");
    else if (POLA_KEMATIAN.test(`${B.polos(k.posita)} ${B.polos(k.petitum)}`)) peta = kematian(k.posita || "", k.petitum || "");
  } catch {
    peta = {};
  }
  const keluar = [];
  for (const [kode, f] of Object.entries(peta)) {
    const u = usulan(butir, kode, f);
    if (u) keluar.push(u);
  }
  if (sub === "permohonan-umum") {
    for (const [kode, alasan] of Object.entries(MANUAL_UMUM)) {
      const u = butir({ kode, nilai: "", keyakinan: "tidak_ada_sumber", kalimat: "", catatan: alasan, kodePola: `w2b-lain-manual-${kode}`, manual: true });
      u.nama = NAMA[kode] || u.nama;
      keluar.push(u);
    }
  }
  return keluar;
}

module.exports = { NAMA, MANUAL_UMUM, subJenis, pengangkatanAnak, mafqud, kematian, usulanLain };
