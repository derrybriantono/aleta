"use strict";

/**
 * ============================================================================
 * SAMBUNGAN RUTE /abt/usulan (sumber "itsbat") - ISTRI SEBELUMNYA PEMOHON I
 * (#1021#, #5015#, #5016#) - 14 Okt 2026, agen T2
 * ============================================================================
 *
 * Blangko "2 Itsbat Nikah/[99aa] Pertimbangan - Cerai Hidup/Mati P1 P2
 * Pasangan Sebelumnya". Ketiga variabel itu dahulu TANPA data_type di katalog
 * (tidak dapat diisi siapa pun); paket ABT abt-hb-kebendaan menjadikannya isian
 * teks. ALETA mengusulkan isinya, petugas tetap dapat menyuntingnya di ABT.
 *
 * Sumber:
 *   1. posita (deteksi/itsbat.js istriSebelumnyaP1 - murni): nama, tanggal
 *      dan sebab meninggal dari kurung butir status "Pemohon I berstatus Duda
 *      (isteri sebelumnya bernama X telah meninggal dunia pada tanggal ...)".
 *   2. SIPP (HANYA SELECT, 2,5 detik): posita cerai hidup hanya menyebut
 *      nomor akta ("Duda (Akta Cerai Nomor 344/AC/2019/PA.Dgl)"). Akta milik
 *      PA Donggala dicari di perkara_akta_cerai; bila pihak SUAMI perkara cerai
 *      itu bernama sama dengan Pemohon I, pihak ISTRInya = #1021#.
 *
 * Ukuran (posita itsbat server 14 Okt, 3.108 perkara, lihat UKUR):
 *   - posita: 1021 5/5 benar, 5015 10/10 benar, 5016 tidak pernah tertulis;
 *     0 temuan pada 3.089 posita yang tidak menyebut istri sebelumnya.
 *   - mekanisme SIPP: 12 nomor akta PA.Dgl yang disebut posita itsbat - 12/12
 *     milik salah satu pemohon (nama sama, ejaan/alias dibandingkan longgar).
 * Keyakinan "cukup" (terisi otomatis) hanya bila ukurannya n >= 10 dan tepat
 * >= 90% (seperti gerbang itsbat); selain itu "ragu" - tampil tidak tercentang.
 */

const itsbat = require("./itsbat");

const UKUR = Object.freeze({
  posita: itsbat.UKUR_ISTRI_SEBELUMNYA,
  sipp: { 1021: { n: 12, tepat: 12, pembanding: "pihak perkara cerai = salah satu pemohon itsbat (nama longgar)" } },
});

function yakin(u) {
  return u && u.n >= 10 && u.tepat / u.n >= 0.9 ? "cukup" : "ragu";
}

const GELAR = /\b(?:hj?|hajjah|haji|dr|drs|ir|s\.?\s?(?:pd|h|e|sos|kom|ag|hi|t|ip)|a\.?\s?md|m\.?\s?(?:pd|h|si|ag))\b\.?/gi;

/** Nama inti (sebelum bin/binti), tiap bagian alias - huruf kecil tanpa tanda baca. */
function intiNama(nama) {
  return String(nama || "")
    .split(/\s+alias\s+/i)
    .map((x) =>
      x
        .split(/\s+bin(?:ti)?\b/i)[0]
        .replace(GELAR, " ")
        .toLowerCase()
        .replace(/[^a-z]/g, "")
    )
    .filter((x) => x.length >= 3);
}

/**
 * Dua nama menunjuk orang yang sama (longgar: tanda baca/spasi, gelar, alias, SATU huruf akhiran pada nama >= 6
 * huruf - "Suarti"/"Suartin", "Irot"/"Iroth"). "Ahmad"/"Ahmadi" tetap berbeda.
 */
function namaSama(a, b) {
  const A = intiNama(a);
  const B = intiNama(b);
  const dekat = (x, y) => Math.min(x.length, y.length) >= 6 && Math.abs(x.length - y.length) === 1 && (x.startsWith(y) || y.startsWith(x));
  return A.some((x) => B.some((y) => x === y || dekat(x, y)));
}

function runQuery(sql, params) {
  const db = require("../../db_config");
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (e, r) => (e ? reject(e) : resolve(r)));
  });
}

/**
 * Pihak perkara cerai PA Donggala dari nomor akta, dan nama Pemohon itsbat - HANYA SELECT.
 * @returns {Promise<null|{jenisPerkaraId: number, pihak1: string[], pihak2: string[], pemohon: string[]}>}
 */
async function bacaAktaCerai(nomorPerkara, akta, kueri = runQuery) {
  if (!akta || !/^dgl$/i.test(String(akta.kodePa || ""))) return null;
  const kerja = (async () => {
    const baris = await kueri(
      "SELECT a.perkara_id, a.nomor_akta_cerai, p.jenis_perkara_id FROM perkara_akta_cerai a JOIN perkara p ON p.perkara_id = a.perkara_id WHERE a.nomor_akta_cerai LIKE ?",
      [`%/AC/${Number(akta.tahun)}/%`]
    );
    // nomor_urut_akta_cerai tidak dapat dipegang untuk tahun lama (2017-2021: 0..61) - nomor dibaca dari teksnya.
    const r = (baris || []).find((x) => Number(String(x.nomor_akta_cerai || "").split("/")[0]) === Number(akta.urut));
    if (!r) return null;
    const [p1, p2, pemohon] = await Promise.all([
      kueri("SELECT nama FROM perkara_pihak1 WHERE perkara_id = ? ORDER BY urutan", [r.perkara_id]),
      kueri("SELECT nama FROM perkara_pihak2 WHERE perkara_id = ? ORDER BY urutan", [r.perkara_id]),
      nomorPerkara
        ? kueri("SELECT p1.nama FROM perkara p JOIN perkara_pihak1 p1 ON p1.perkara_id = p.perkara_id WHERE p.nomor_perkara = ? ORDER BY p1.urutan", [nomorPerkara])
        : Promise.resolve([]),
    ]);
    const nama = (x) => (Array.isArray(x) ? x.map((y) => String(y.nama || "").trim()).filter(Boolean) : []);
    return { jenisPerkaraId: Number(r.jenis_perkara_id) || 0, nomorAkta: r.nomor_akta_cerai, pihak1: nama(p1), pihak2: nama(p2), pemohon: nama(pemohon) };
  })().catch(() => null);
  const batas = new Promise((selesai) => setTimeout(() => selesai(null), 2500));
  return Promise.race([kerja, batas]);
}

/**
 * Nama istri dari perkara cerai: cerai talak (346) suami = pihak 1, cerai gugat (347) suami = pihak 2.
 * null bila pihak suami bukan Pemohon I atau istrinya = Pemohon II (rujuk/menikah lagi dengan orang yang sama).
 */
function istriDariAkta(sipp) {
  if (!sipp || !sipp.pemohon.length) return null;
  const talak = sipp.jenisPerkaraId === 346;
  const gugat = sipp.jenisPerkaraId === 347;
  if (!talak && !gugat) return null;
  const suami = talak ? sipp.pihak1[0] : sipp.pihak2[0];
  const istri = talak ? sipp.pihak2[0] : sipp.pihak1[0];
  if (!suami || !istri || !namaSama(suami, sipp.pemohon[0])) return null;
  return { nama: istri, samaDenganPemohon2: sipp.pemohon.length > 1 && namaSama(istri, sipp.pemohon[1]), nomorAkta: sipp.nomorAkta };
}

const NAMA_VAR = {
  1021: "Nama istri sebelumnya Pemohon I",
  5015: "Tanggal meninggal istri sebelumnya Pemohon I",
  5016: "Sebab meninggal istri sebelumnya Pemohon I",
};

/**
 * Menambah usulan 1021/5015/5016 ke jawaban itsbat (jawaban tidak diubah di tempat).
 * Usulan lama berkode sama yang "cukup" tidak ditimpa bacaan "ragu".
 * @param {object|null} hasil jawaban.itsbat
 * @param {{posita?: string, nomorPerkara?: string, bacaAkta?: Function}} masukan
 */
async function lengkapiIstriSebelumnya(hasil, masukan = {}) {
  if (!hasil || typeof hasil !== "object" || !Array.isArray(hasil.usulan)) return hasil;
  const kalimat = require("../abtUsulanService").kalimatPosita(String(masukan.posita || ""));
  const dulu = itsbat.istriSebelumnyaP1(kalimat);
  if (!dulu) return hasil;
  const baru = [];
  const tambah = (kode, nilai, keyakinan, asal, kalimatSumber, catatan, kodePola) =>
    baru.push({
      kode,
      nama: NAMA_VAR[kode],
      nilai,
      keyakinan,
      bentrok: "",
      catatan,
      dihitung: false,
      sumber: [{ saksi: 0, asal, kalimat: String(kalimatSumber).slice(0, 400) }],
      kodePola,
    });
  if (dulu.nama) {
    tambah("1021", dulu.nama, yakin(UKUR.posita[1021]), "posita", dulu.kalimat, "istri sebelumnya Pemohon I menurut butir status posita", "itsbat-istri-dulu-nama");
  } else if (dulu.aktaCerai) {
    const baca = typeof masukan.bacaAkta === "function" ? masukan.bacaAkta : bacaAktaCerai;
    const sipp = await baca(masukan.nomorPerkara, dulu.aktaCerai);
    const istri = istriDariAkta(sipp);
    if (istri) {
      tambah(
        "1021",
        istri.nama,
        istri.samaDenganPemohon2 ? "ragu" : yakin(UKUR.sipp[1021]),
        "sipp",
        `Akta Cerai ${istri.nomorAkta} (SIPP) disebut di butir status Pemohon I: ${dulu.kalimat}`,
        istri.samaDenganPemohon2
          ? "istri dalam akta cerai itu ialah Pemohon II sendiri - periksa apakah blangko pasangan sebelumnya tepat"
          : "nama istri dari perkara cerai SIPP yang nomor aktanya disebut posita",
        "itsbat-istri-dulu-akta-sipp"
      );
    }
  }
  if (dulu.jenis === "mati" && dulu.tanggal) {
    tambah("5015", dulu.tanggal, yakin(UKUR.posita[5015]), "posita", dulu.kalimat, "tanggal meninggal istri sebelumnya Pemohon I", "itsbat-istri-dulu-tanggal-wafat");
  }
  if (dulu.jenis === "mati" && dulu.sebab) {
    tambah("5016", dulu.sebab, yakin(UKUR.posita[5016]), "posita", dulu.kalimat, "sebab meninggal istri sebelumnya Pemohon I", "itsbat-istri-dulu-sebab-wafat");
  }
  if (!baru.length) return hasil;
  const PANGKAT = { cukup: 2, ragu: 1 };
  const usulan = [...hasil.usulan];
  for (const u of baru) {
    const i = usulan.findIndex((x) => x && String(x.kode) === u.kode);
    if (i < 0) usulan.push(u);
    else if ((PANGKAT[u.keyakinan] || 0) >= (PANGKAT[usulan[i].keyakinan] || 0)) usulan[i] = u;
  }
  return { ...hasil, usulan };
}

module.exports = { UKUR, intiNama, namaSama, bacaAktaCerai, istriDariAkta, lengkapiIstriSebelumnya };
