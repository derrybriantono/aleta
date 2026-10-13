"use strict";

/**
 * ============================================================================
 * DETEKSI GUGATAN HARTA BERSAMA (jenis_perkara_id 348) - butir 16, 13 Okt 2026
 * ============================================================================
 *
 * Blangko Derry "4a Harta Bersama" (menu 920): [02a] Kabul memuat 8730 (objek
 * harta bersama, "2.1 ...;<br>2.2 ...") dan [97] Akta Perdamaian memuat 8706
 * (dasar putusnya perkawinan, dipakai kueri 8707: "telah diputus cerai oleh
 * #8706#"). Sumbernya:
 *
 *   8730  daftar benda sesudah "memperoleh harta (bersama) berupa/sebagai
 *         berikut:" di posita; bila posita tidak mendaftarnya, daftar di
 *         petitum ("Menyatakan harta ... berupa: ... adalah harta bersama").
 *         Benda yang DITETAPKAN hakim bisa lebih sedikit dari yang didalilkan
 *         (amar 19/2017: rumah BTN NO) - selalu "ragu".
 *   8706  "putus karena perceraian berdasarkan putusan Pengadilan Agama X
 *         Nomor N" -> "Pengadilan Agama X berdasarkan Putusan Nomor N".
 *
 * Nilai/harga benda (dalam posita sebagian ditaksir) ikut tersalin bila
 * tertulis di butir bendanya; tidak dihitung ALETA.
 */

const P = require("./pembantuKebendaan");

const variabel = Object.freeze([
  { kode: "8730", nama: "Objek harta bersama", sumber: "posita+petitum", blangko: ["putusan"] },
  { kode: "8706", nama: "Dasar putusnya perkawinan para pihak", sumber: "posita", blangko: ["putusan"] },
]);

const UKUR = Object.freeze({});

const PEMBUKA_HB =
  /(?:memperoleh|mendapatkan|memiliki|mempunyai|telah\s+(?:mendapat|memperoleh))\s+(?:harta|barang)(?:[-\s]+(?:bersama|gono[-\s]*gini|benda))?[^:;]{0,60}?(?:berupa|sebagai\s+berikut|yaitu|antara\s+lain|:)|harta\s+bersama(?:\s*\([^)]*\))?\s+(?:Penggugat\s+dan\s+Tergugat\s+)?(?:berupa|sebagai\s+berikut|yaitu|adalah)\s*:?/i;
const PEMBUKA_HB_PETITUM =
  /(?:Menyatakan|Menetapkan)[^:;]{0,80}?harta[^:;]{0,80}?(?:berupa|sebagai\s+berikut|yaitu|masing-masing|:)/i;

function dasarPutus(satu) {
  const m =
    /(?:putus(?:nya)?|bercerai|perceraian|cerai|suami\s+ist?e?ri)[^;]{0,80}?(?:berdasarkan|sesuai(?:\s+dengan)?|dengan)\s+putusan\s+(Pengadilan\s+Agama\s+(?:Kabupaten\s+|Kota\s+)?[A-Z][A-Za-z]+)[^;]{0,20}?(?:Nomor|No\.?)\s*:?\s*([0-9]{1,5}\/Pdt\.G\/[0-9]{4}\/PA\.?\s*[A-Za-z]+)/i.exec(
      satu
    );
  if (m) {
    const pa = m[1].replace(/\s+Kabupaten\s+/i, " ").replace(/\s+/g, " ");
    return { nilai: `${pa} berdasarkan Putusan Nomor ${m[2].replace(/PA\.?\s*/i, "PA.").replace(/\s+/g, "")}`, kalimat: P.kalimatDi(satu, m.index, m[0].length) };
  }
  const a = /akta\s+cerai\s+(?:Nomor|No\.?)\s*:?\s*([0-9]{1,5}\/AC\/[0-9]{4}\/PA\.?\s*[A-Za-z]+)/i.exec(satu);
  if (a) {
    const pa = /PA\.?\s*Dgl/i.test(a[1]) ? "Pengadilan Agama Donggala" : "Pengadilan Agama";
    return { nilai: `${pa} sebagaimana Akta Cerai Nomor ${a[1].replace(/\s+/g, "")}`, kalimat: P.kalimatDi(satu, a.index, a[0].length) };
  }
  return null;
}

function deteksi(posita, opsi = {}) {
  const daftar = P.baris(posita);
  const satu = daftar.join("; ");
  const hasil = {};
  let d = P.daftarSesudah(daftar, PEMBUKA_HB);
  let asal = "posita";
  if (!d.benda.length) {
    d = P.daftarSesudah(P.baris(opsi.petitum || ""), PEMBUKA_HB_PETITUM, { polaPenutup: /^(?:adalah|merupakan|sebagai)\b/i });
    asal = "petitum";
  }
  if (!d.benda.length) {
    d = P.bendaBerletak(daftar);
    asal = "posita";
  }
  // Rujukan tanpa benda ("sebagaimana tersebut dalam posita poin 5") bukan benda.
  const benda = d.benda.filter((b) => !/^(?:sebagaimana|tersebut|seperti)\b/i.test(b));
  if (benda.length) {
    hasil["8730"] = {
      nilai: P.isianBernomor(benda, "2"),
      kalimat: d.kalimat,
      asal,
      yakin: "ragu",
      catatan: "Benda yang DIDALILKAN - hapus yang tidak terbukti/tidak ditetapkan sebelum dipakai di amar.",
      kodePola: `harta-bersama-objek-${asal}`,
    };
  }
  const putus = dasarPutus(satu);
  if (putus) hasil["8706"] = { nilai: putus.nilai, kalimat: putus.kalimat, yakin: "ragu", kodePola: "harta-bersama-dasar-putus" };
  return hasil;
}

module.exports = {
  kunci: "harta-bersama",
  jenisPerkaraId: [348],
  variabel,
  UKUR,
  deteksi,
  dasarPutus,
};
