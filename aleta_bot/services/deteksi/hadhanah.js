"use strict";

/**
 * ============================================================================
 * DETEKSI HADHANAH / HAK ASUH ANAK (gugatan berdiri sendiri; jenis 349
 * "Penguasaan Anak", di PA Donggala didaftar "Lain-Lain" 369 Pdt.G - lewat
 * lainLain.js; 6 perkara 2020-2023, tanpa satu pun isian ABT)
 * ============================================================================
 *
 * Blangko: putusan_penetapan/(C3) 6, Hadhanah (Hak Asuh Anak), BAS (C3) 5
 * Verstek Hadhanah. Isian yang terbaca dari posita:
 *
 *   0709  Penggugat dari sisi anak: "ibu kandung" / "bapak kandung"
 *   0711  Tergugat dari sisi anak (lawannya)
 *   2004  anak kini diasuh oleh: "#0046#" / "#0047#" (isian bawaan ABT memakai
 *         sebutan, bukan nama - ABT mengganti #0046# saat mencetak)
 *   8603  nama anak (8602 memakainya bila SIPP perkara_anak_pihak kosong)
 *
 * Semuanya "ragu": belum ada satu pun isian manusia untuk diukur.
 * Tidak dideteksi: 0708 (Tergugat menjenguk - keterangan saksi), 0710
 * (kepentingan - kalimat bebas), 5121 (tanggal cerai - tipe variabelnya tidak
 * terdaftar di abt_variabel salinan lokal), 5171 (penghasilan), 0007 (bentuk
 * kalimatnya milik jalur cerai). Nafkah anak dan pencabutan kekuasaan orang
 * tua: 0 perkara di SIPP PA Donggala - tidak dibangun tanpa data ukur.
 */

const B = require("./bantuAnak");

const variabel = Object.freeze([
  { kode: "0709", nama: "Penggugat dari sisi anak", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "0711", nama: "Tergugat dari sisi anak", sumber: "posita", blangko: ["putusan"] },
  { kode: "2004", nama: "Anak kini diasuh oleh", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "8603", nama: "Nama anak", sumber: "posita", blangko: ["putusan"] },
  // 18 Okt 2026 (keputusan 14): saklar "petitum meminta penyerahan anak" - 1/0 dari PETITUM surat gugatan
  // (isiGugatanService.saklarPenyerahanAnak, bukan dari posita di modul ini); 0 = amar+pertimbangan penyerahan
  // tidak tercetak (anti ultra petita).
  { kode: "9720", nama: "Petitum meminta penyerahan anak (saklar)", sumber: "petitum", blangko: ["putusan"] },
  { kode: "0708", nama: "Tergugat menjenguk anak", sumber: "saksi-sipp", blangko: ["putusan", "bas"] },
  { kode: "0710", nama: "Kepentingan Penggugat", sumber: "posita", blangko: ["putusan"], deteksi: false },
  { kode: "5171", nama: "Penghasilan Penggugat", sumber: "posita", blangko: ["putusan"], deteksi: false },
]);

function deteksi(posita) {
  const t = B.polos(posita);
  const peta = {};
  if (!t) return peta;
  // Penggugat ibu: "mantan suami Penggugat", "selaku Ibu kandungnya", "belaian seorang ibu".
  const ibu = /mantan\s+suami\s+Penggugat|Penggugat\s+selaku\s+ibu|belaian\s+seorang\s+ibu|Penggugat\s+(?:adalah|sebagai)\s+ibu\s+kandung/i.exec(t);
  const bapak = /mantan\s+ist(?:e)?ri\s+Penggugat|Penggugat\s+selaku\s+(?:ayah|bapak)|Penggugat\s+(?:adalah|sebagai)\s+(?:ayah|bapak)\s+kandung/i.exec(t);
  if (ibu && !bapak) {
    B.taruh(peta, "0709", B.fakta("ibu kandung", ibu[0], "ragu", "hadhanah-0709-ibu"));
    B.taruh(peta, "0711", B.fakta("bapak kandung", ibu[0], "ragu", "hadhanah-0711-bapak"));
  } else if (bapak && !ibu) {
    B.taruh(peta, "0709", B.fakta("bapak kandung", bapak[0], "ragu", "hadhanah-0709-bapak"));
    B.taruh(peta, "0711", B.fakta("ibu kandung", bapak[0], "ragu", "hadhanah-0711-ibu"));
  }
  // 2004 - keadaan TERAKHIR yang disebut: "anak ... (hidup|tinggal|berada|diasuh) bersama/oleh (Penggugat|Tergugat)",
  // "Tergugat mengambilnya" (anak dibawa Tergugat).
  const re = /(?:hidup|tinggal|berada|diasuh|dipelihara|ikut)\s+(?:bersama|oleh|dengan)\s+(Penggugat|Tergugat)\b|\b(Tergugat|Penggugat)\s+mengambil(?:nya|\s+anak)/gi;
  let m;
  let akhir = null;
  while ((m = re.exec(t)) !== null) akhir = m;
  if (akhir) {
    const siapa = (akhir[1] || akhir[2]).toLowerCase() === "penggugat" ? "#0046#" : "#0047#";
    B.taruh(peta, "2004", B.fakta(siapa, t.slice(Math.max(0, akhir.index - 80), akhir.index + 60), "ragu", "hadhanah-2004-pengasuh"));
  }
  // 8603 - anak: "dikaruniai ... anak ... bernama: A, umur 6 tahun B, umur 4 tahun".
  const anak = /di\s*karuni(?:a|ai)\w*\s+[^;]{0,60}?anak\b[^;:]{0,40}?\bbe?r?nama\s*:?\s*/i.exec(t);
  if (anak) {
    let isi = t.slice(anak.index + anak[0].length);
    const b = isi.search(/\s(?:\d{1,2}\s*\.\s*)?Bahwa\b|;/);
    if (b >= 0) isi = isi.slice(0, b);
    const daftar = B.daftarNama(isi);
    if (daftar.length) B.taruh(peta, "8603", B.fakta(daftar.map((d) => d.nama).join(", "), anak[0] + isi.slice(0, 200), "ragu", "hadhanah-8603-anak"));
  }
  return peta;
}

/** Gugatan hak asuh anak? (dipakai lainLain.js) */
function cocokTeks(teks) {
  return /\bhak\s+asuh|hadh?[ao]nah|pemeliharaan\s+(?:dan\s+pengasuhan\s+)?anak|penguasaan\s+anak/i.test(String(teks || ""));
}

module.exports = { kunci: "hadhanah", jenisPerkaraId: [349], variabel, deteksi, cocokTeks };
