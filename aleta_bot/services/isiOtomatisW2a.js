"use strict";

/**
 * ============================================================================
 * PENGISI TAMBAHAN HARTA BERSAMA (348) DAN KEWARISAN (364) - agen W2a, 21 Okt 2026
 * ============================================================================
 *
 * Melengkapi isiOtomatisJenisS6 (objek, akad, rekonvensi, kesepakatan) dengan isian yang dipakai paket ABT abt-paket/w2a-kebendaan.
 * SEMUA usulan di sini berkeyakinan "ragu" (saran): belum ada isian petugas pembanding dalam jumlah yang dituntut gerbang otomatis
 * berdasar (n >= 20, cocok >= 90%) - lihat docs/gelombang2/UKURAN-W2a.json untuk angka dan batasnya. Keputusan hakim (bagian harta
 * bersama, sita, uang paksa, serta merta, objek yang tidak terbukti, sikap Tergugat per objek, denda/jaminan/pembatalan akad)
 * TIDAK PERNAH diisi mesin.
 *
 * Kewarisan (364):
 *   9702 / 9701 / 9718 / 9704 / 9703  susunan ahli waris terstruktur (anak, pasangan, saudara, ibu, ayah) dari daftar ahli waris di
 *                                     petitum - memakai penggolong penetapan ahli waris (isiOtomatisS5/ahliWaris.golongkan); bila
 *                                     terisi, blangko kewarisan menghitung bagian menurut KHI (variabel 4820-4822).
 *   8719                              usulan bagian masing-masing ahli waris dari hitungan KHI (isiOtomatisS5/faraid.js) atas
 *                                     susunan yang terbaca penuh.
 *   4817                              pihak yang menguasai harta peninggalan: kalimat posita "dikuasai/menguasai ... oleh X".
 *   4818                              harta bersama pewaris dengan pasangannya: kalimat posita yang menyebut harta bersama.
 *   4819                              utang, wasiat, biaya pengurusan jenazah pewaris: kalimat posita yang menyebutnya.
 * Harta bersama (348):
 *   4786                              utang bersama: kalimat posita yang menyebut utang/hutang bersama.
 */

const B = require("./isiOtomatisS5/bantu");
const PAW = require("./isiOtomatisS5/ahliWaris");
const PAWL = require("./isiOtomatisS5/ahliWarisLanjut");
const FA = require("./isiOtomatisS5/faraid");

const NAMA = Object.freeze({
  "4786": "Utang bersama para pihak",
  "4817": "Pihak yang menguasai harta peninggalan",
  "4818": "Harta bersama pewaris dengan pasangannya",
  "4819": "Utang, wasiat dan biaya pengurusan jenazah pewaris",
  "8719": "Bagian masing-masing ahli waris (usulan hitungan KHI)",
  "9701": "Ahli waris: pasangan pewaris yang masih hidup",
  "9702": "Ahli waris: anak kandung pewaris",
  "9703": "Ahli waris: ayah kandung pewaris yang masih hidup",
  "9704": "Ahli waris: ibu kandung pewaris yang masih hidup",
  "9718": "Ahli waris: saudara kandung atau seayah pewaris",
});
const KATEGORI = Object.freeze({ "9702": "anak", "9701": "pasangan", "9718": "saudara", "9704": "ibu", "9703": "ayah" });

/** Usulan "ragu" dari kalimat posita. */
function saran(kode, nilai, kalimat, catatan, kodePola) {
  return B.butir({ kode, nama: NAMA[kode], nilai, keyakinan: "ragu", kalimat, asal: "posita-gugatan", catatan, kodePola });
}

const potong = (t, maks) => {
  const s = String(t || "").replace(/\s+/g, " ").trim().replace(/[;:,\s]+$/, "");
  return s.length > maks ? `${s.slice(0, maks - 3).replace(/\s+\S*$/, "")}...` : s;
};

/** Kalimat posita pertama yang cocok; kalimat yang menyangkal ("tidak ada", "tidak mempunyai") dilewati. */
function kalimatCocok(butir, re, kecuali) {
  for (const b of butir) {
    if (!re.test(b)) continue;
    if (kecuali && kecuali.test(b)) continue;
    return b;
  }
  return null;
}

const RE_NAFI = /\btidak\s+(?:ada|mempunyai|memiliki|meninggalkan|punya)\b|\btanpa\b/i;

/** Pihak penguasa: "dikuasai oleh Tergugat I" / "dikuasai Tergugat" / "Tergugat menguasai". */
function penguasa(butir) {
  const k = kalimatCocok(butir, /\b(?:dikuasai|dikuasi|dalam\s+penguasaan|menguasai|menempati)\b/i);
  if (!k) return null;
  const m = /\b(?:dikuasai|dikuasi|dalam\s+penguasaan)\s+(?:secara\s+\w+\s+)?(?:oleh\s+)?((?:Para\s+)?(?:Tergugat|Penggugat)(?:\s+(?:I{1,3}|IV|V|VI{0,3}|\d+))?(?:\s*(?:,|dan|sampai\s+dengan|s\.d\.)\s*(?:Tergugat\s+)?(?:I{1,3}|IV|V|VI{0,3}|\d+))*)/i.exec(k);
  const langsung = /\b((?:Para\s+)?Tergugat(?:\s+(?:I{1,3}|IV|V|VI{0,3}|\d+))?)\s+(?:telah\s+)?menguasai\b/i.exec(k);
  const nilai = (m && m[1]) || (langsung && langsung[1]) || "";
  if (!nilai) return null;
  return { nilai: potong(nilai, 120), kalimat: k };
}

function hartaBersamaPewaris(butir) {
  const k = kalimatCocok(butir, /\bharta\s+bersama\b|\bgono[\s-]?gini\b/i, RE_NAFI);
  return k ? { nilai: potong(k, 300), kalimat: k } : null;
}

function utangWasiat(butir) {
  const k = kalimatCocok(butir, /\b(?:hutang|utang)\b|\bwasiat\b|\bbiaya\s+(?:pengurusan\s+)?jenazah\b|\btajhiz\b/i, RE_NAFI);
  return k ? { nilai: potong(k, 300), kalimat: k } : null;
}

function utangBersama(butir) {
  const k = kalimatCocok(butir, /\b(?:hutang|utang)\s+bersama\b|\b(?:hutang|utang)\b[^.;]{0,80}\b(?:selama|masa)\s+perkawinan\b/i, RE_NAFI);
  return k ? { nilai: potong(k, 300), kalimat: k } : null;
}

/**
 * Usulan kewarisan dari data yang sudah dibaca (murni). `d` = keluaran isiOtomatisJenisS5.bacaData ({perkara:{posita,petitum}, pihak1}).
 * @param {object} d
 * @param {{pewaris?: string}} [opsi]
 */
function usulanKewarisan(d, opsi = {}) {
  const posita = String((d.perkara && d.perkara.posita) || "");
  const petitum = String((d.perkara && d.perkara.petitum) || "");
  const butir = PAWL.butirPosita(posita);
  const hasil = [];
  const g = PAW.golongkan({ petitum, posita, pewaris: opsi.pewaris, pihak1: d.pihak1 });
  if (g.pewaris && g.semua.length) {
    const kalimatDaftar = `Ahli waris ${g.pewaris} menurut petitum: ${g.semua.join("; ")}`;
    for (const [kode, golongan] of Object.entries(KATEGORI)) {
      const isi = g[golongan] || [];
      if (!isi.length) continue;
      hasil.push(
        saran(
          kode,
          isi.join("; "),
          kalimatDaftar,
          "Hubungan dibaca dari keterangan dalam kurung dan pola nama (anak memakai nama pewaris sesudah bin/binti, saudara memakai nama ayah pewaris); penetapan ahli waris adalah penilaian hakim - periksa dengan kartu keluarga, akta kematian dan silsilah.",
          `w2a-waris-${kode}-${golongan}`
        )
      );
    }
    const susunan = PAWL.susunanUntukHitung(g, opsi.pewaris);
    if (susunan) {
      const h = FA.hitung(susunan);
      if (h.bagian.length && h.jumlah === "1/1") {
        hasil.push(
          saran(
            "8719",
            FA.teksBagian(h),
            kalimatDaftar,
            `Hitungan KHI (${h.kasus}): ${h.rincian.join("; ")}. Hanya usulan; penentuan bagian adalah keputusan hakim.`,
            "w2a-waris-8719-bagian"
          )
        );
      }
    }
  }
  const pg = penguasa(butir);
  if (pg) hasil.push(saran("4817", pg.nilai, pg.kalimat, "Pihak yang menguasai harta peninggalan menurut kalimat posita; periksa dengan jawaban dan keterangan saksi.", "w2a-waris-4817-penguasa"));
  const hb = hartaBersamaPewaris(butir);
  if (hb) hasil.push(saran("4818", hb.nilai, hb.kalimat, "Kalimat posita menyebut harta bersama pewaris dengan pasangannya (separuh menjadi hak pasangan yang hidup lebih lama, Pasal 96 ayat (1) KHI); tulis objeknya.", "w2a-waris-4818-hartabersama"));
  const uw = utangWasiat(butir);
  if (uw) hasil.push(saran("4819", uw.nilai, uw.kalimat, "Kalimat posita menyebut utang, wasiat atau biaya jenazah pewaris (Pasal 171 huruf e dan 175 KHI); ringkas menjadi isian.", "w2a-waris-4819-utang"));
  return hasil;
}

/** Usulan harta bersama dari data yang sudah dibaca (murni). */
function usulanHartaBersama(d) {
  const posita = String((d.perkara && d.perkara.posita) || "");
  const butir = PAWL.butirPosita(posita);
  const hasil = [];
  const ut = utangBersama(butir);
  if (ut) hasil.push(saran("4786", ut.nilai, ut.kalimat, "Kalimat posita menyebut utang bersama para pihak (Pasal 93 ayat (2) KHI: utang untuk kepentingan keluarga dibebankan kepada harta bersama); tulis kreditur dan jumlahnya.", "w2a-hb-4786-utang"));
  return hasil;
}

function usulanDariData(d) {
  if (!d || !d.perkara) return [];
  if (d.perkara.jenisId === 364) {
    let pewaris = "";
    try {
      const f = require("./deteksi/waris").deteksi(d.perkara.posita, { petitum: d.perkara.petitum, jenisPerkara: 364 }) || {};
      pewaris = f["1025"] && f["1025"].nilai ? String(f["1025"].nilai) : "";
    } catch {
      pewaris = "";
    }
    return usulanKewarisan(d, { pewaris });
  }
  if (d.perkara.jenisId === 348) return usulanHartaBersama(d);
  return [];
}

/** Pintu masuk dari abtUsulanService.dariSipp: satu pembacaan kecil bagi jenis di luar 348/364. */
async function usulanW2a(perkaraId, runQuery) {
  const S5 = require("./isiOtomatisJenisS5");
  let jenis;
  try {
    const r = await runQuery("SELECT jenis_perkara_id AS j FROM perkara WHERE perkara_id = ? LIMIT 1", [Number(perkaraId)]);
    jenis = Number(Array.isArray(r) && r[0] ? r[0].j : 0);
  } catch {
    return [];
  }
  if (jenis !== 348 && jenis !== 364) return [];
  const data = await S5.bacaData(perkaraId, runQuery);
  return usulanDariData(data);
}

module.exports = { NAMA, KATEGORI, usulanW2a, usulanDariData, usulanKewarisan, usulanHartaBersama, penguasa, hartaBersamaPewaris, utangWasiat, utangBersama };
