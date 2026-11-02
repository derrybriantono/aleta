"use strict";

/**
 * ============================================================================
 * LAMA TIDAK DINAFKAHI DARI POSITA (keputusan Derry 116 butir 15, 2 Nov 2026)
 * ============================================================================
 *
 * SEMA Nomor 1 Tahun 2022, Rumusan Hukum Kamar Agama angka 1 huruf b poin 1: perkara perceraian dengan alasan suami/istri
 * tidak melaksanakan kewajiban nafkah lahir dan/atau batin hanya dapat dikabulkan jika terbukti suami/istri tidak melaksanakan
 * kewajibannya setelah minimal 12 (dua belas) bulan.
 *
 * Membaca dari butir posita (gugatan) kalimat "Tergugat tidak lagi memberi nafkah ... sejak bulan Maret 2024" / "selama 2 tahun":
 *   { ada, sejak: "bulan Maret 2024" | "tahun 2023" | null, lama: "1 tahun 8 bulan" | null, bulan: angka | null,
 *     taksiran, dihitung, kalimat }
 * Hasil HANYA bahan: fakta saksi (bertanda berasal dari gugatan, keputusan 61) dan catatan penilai bukti. Tidak ada yang
 * menolak/mengabulkan sendiri - itu pertimbangan hakim.
 *
 * Murni, satu lintasan regex per butir (tanpa jaringan/DB).
 */

const NAMA_BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const BULAN = "(?:Januari|Februari|Pebruari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Nopember|Desember)";
const ANGKA = { satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, "dua belas": 12 };

/** Kalimat yang MENEGASKAN nafkah tidak diberikan (bukan "masih memberi nafkah"). */
const RE_TIDAK_NAFKAH =
  /\b(?:tidak|tak|tidak\s+pernah|tidak\s+lagi|sudah\s+tidak|jarang|enggan|lalai|berhenti|menolak)\s+(?:\S+\s+){0,3}?(?:memberi(?:kan)?\s+(?:nafkah|uang\s+belanja|biaya\s+hidup|belanja)|menafkahi|mengirim(?:kan)?\s+(?:nafkah|uang|biaya)|menanggung\s+(?:nafkah|kebutuhan|biaya)|memenuhi\s+(?:nafkah|kebutuhan)|mencukupi\s+kebutuhan|melaksanakan\s+kewajiban(?:nya)?\s+(?:sebagai\s+suami|memberi\s+nafkah))|\btanpa\s+(?:pernah\s+)?(?:memberi(?:kan)?\s+)?nafkah\b|\bnafkah\s+(?:\S+\s+){0,3}?(?:tidak|tak)\s+(?:pernah\s+|lagi\s+)?(?:diberikan|dipenuhi|dikirim|ditunaikan)/i;
const RE_MASIH = /\b(?:masih|selalu|tetap|rutin)\s+(?:\S+\s+){0,2}?(?:memberi(?:kan)?|menafkahi|mengirim(?:kan)?)\b/i;

// "sejak bulan Maret 2024", "sejak pisah dari bulan Desember 2012", "sejak awal tahun 2024", "sejak 2013"
const RE_SEJAK = new RegExp(
  `\\b(?:sejak|semenjak|mulai)\\s+(?:(?:pisah|berpisah|itu|saat|waktu|dari|kepergian|ditinggal)\\s+){0,3}(?:(?:tanggal\\s+)?(\\d{1,2})\\s+)?(?:(awal|akhir|pertengahan)\\s+)?(?:bulan\\s+)?(${BULAN})\\s+(?:tahun\\s+)?((?:19|20)\\d{2})|\\b(?:sejak|semenjak|mulai)\\s+(?:(?:pisah|berpisah|dari)\\s+){0,2}(?:(awal|akhir|pertengahan)\\s+)?(?:tahun\\s+)?((?:19|20)\\d{2})(?![\\d/])`,
  "i",
);
const RE_LAMA = /(?:\b(?:selama|sudah|telah|kurang\s+lebih|lebih\s+kurang|sekitar)\s+|±\s*|\+\/-\s*)(?:(?:kurang\s+lebih|lebih\s+kurang|sekitar|±)\s*)?(\d{1,2}|satu|dua belas|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)\s*(?:\(\s*[a-z ]+\s*\)\s*)?(tahun|bulan)(?:\s+(?:dan\s+)?(\d{1,2}|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)\s*(?:\(\s*[a-z ]+\s*\)\s*)?bulan)?/i;
/** Nafkah ANAK saja ("tidak memberi nafkah terhadap anak") bukan kewajiban nafkah kepada istri/suami. */
const RE_HANYA_ANAK = /^\s*(?:lahir\s+(?:dan|maupun)\s+batin\s+)?(?:terhadap|kepada|untuk|bagi)\s+(?:anak|ke\s*\d|kedua\s+anak)/i;

const angka = (t) => (/^\d+$/.test(t) ? Number(t) : ANGKA[String(t).toLowerCase()] || 0);
const awalBulan = (nama) => {
  const n = String(nama || "").toLowerCase().replace("pebruari", "februari").replace("nopember", "november");
  return NAMA_BULAN.indexOf(n);
};

/** "1 tahun 8 bulan" dari jumlah bulan. */
function teksLama(total) {
  const th = Math.floor(total / 12);
  const bl = total % 12;
  return [th ? `${th} tahun` : "", bl ? `${bl} bulan` : ""].filter(Boolean).join(" ");
}

/**
 * @param {string[]} butir butir posita
 * @param {{acuan?: Date}} o acuan = tanggal sidang/penilaian (bawaan: hari ini)
 */
function nafkahDariPosita(butir, o = {}) {
  const acuan = o.acuan instanceof Date && !Number.isNaN(o.acuan.getTime()) ? o.acuan : new Date();
  let ada = null;
  for (const b of Array.isArray(butir) ? butir : []) {
    const m = RE_TIDAK_NAFKAH.exec(b);
    if (!m || RE_MASIH.test(b.slice(Math.max(0, m.index - 40), m.index + m[0].length))) continue;
    if (RE_HANYA_ANAK.test(b.slice(m.index + m[0].length, m.index + m[0].length + 40))) continue;
    // sejak/lama dicari di sekitar kalimat tidak dinafkahi (dalam satu butir), bukan di kalimat lain
    const jendela = b.slice(Math.max(0, m.index - 160), m.index + m[0].length + 160);
    const hasil = { ada: true, sejak: null, lama: null, bulan: null, taksiran: false, dihitung: false, kalimat: b.slice(0, 400) };
    const s = RE_SEJAK.exec(jendela);
    if (s) {
      let tahun;
      let bulan;
      if (s[3]) {
        tahun = Number(s[4]);
        bulan = awalBulan(s[3]);
        hasil.sejak = `bulan ${s[3].charAt(0).toUpperCase()}${s[3].slice(1).toLowerCase()} ${s[4]}`;
        if (s[1]) hasil.sejak = `tanggal ${Number(s[1])} ${s[3].charAt(0).toUpperCase()}${s[3].slice(1).toLowerCase()} ${s[4]}`;
        else if (s[2]) {
          hasil.sejak = `${s[2].toLowerCase()} bulan ${s[3].charAt(0).toUpperCase()}${s[3].slice(1).toLowerCase()} ${s[4]}`;
          hasil.taksiran = true;
        }
      } else {
        tahun = Number(s[6]);
        bulan = s[5] ? { awal: 0, pertengahan: 5, akhir: 10 }[s[5].toLowerCase()] : 0;
        hasil.sejak = s[5] ? `${s[5].toLowerCase()} tahun ${s[6]}` : `tahun ${s[6]}`;
        hasil.taksiran = true;
      }
      const total = (acuan.getFullYear() - tahun) * 12 + (acuan.getMonth() - bulan);
      if (total >= 0 && total < 900) {
        hasil.bulan = total;
        hasil.dihitung = true;
        if (total >= 1) hasil.lama = teksLama(total);
      }
    }
    // lama tertulis hanya di dekat kalimat nafkahnya, dan bukan lama menikah/umur ("telah menikah selama 5 tahun")
    const dekat = b.slice(Math.max(0, m.index - 70), m.index + m[0].length + 90);
    const l = RE_LAMA.exec(dekat);
    const sekitarLama = l ? dekat.slice(Math.max(0, l.index - 30), l.index + l[0].length + 30) : "";
    if (l && !hasil.dihitung && !/menikah|berumah\s*tangga|hidup\s+bersama|dikaruniai|usia|umur/i.test(sekitarLama)) {
      const n = angka(l[1]);
      const total = (l[2].toLowerCase() === "tahun" ? n * 12 : n) + (l[3] ? angka(l[3]) : 0);
      if (total > 0 && total < 900) {
        hasil.bulan = total;
        hasil.lama = teksLama(total);
        hasil.taksiran = /kurang\s+lebih|lebih\s+kurang|±|sekitar|\+\/-/i.test(l[0]);
      }
    }
    if (hasil.bulan !== null) return hasil;
    if (!ada) ada = hasil; // tidak dinafkahi tanpa waktu: tetap dicatat (lamanya tidak disebut)
  }
  return ada || { ada: false, sejak: null, lama: null, bulan: null, taksiran: false, dihitung: false, kalimat: "" };
}

/** Fakta saksi (kunci isiJawabanSaksiFakta) dari posita cerai: nafkahSejak, lamaNafkah. */
function faktaNafkah(butir, o) {
  const n = nafkahDariPosita(butir, o);
  if (!n.ada) return [];
  const hasil = [];
  const ket = "Dari kalimat tidak dinafkahi pada gugatan (bukan ucapan saksi); pastikan saksi sendiri menyebutnya. SEMA 1/2022: minimal 12 bulan.";
  if (n.sejak) hasil.push({ kunci: "nafkahSejak", nilai: n.sejak, yakin: n.taksiran ? "ragu" : "cukup", ket });
  if (n.lama) hasil.push({ kunci: "lamaNafkah", nilai: n.lama, yakin: n.taksiran ? "ragu" : "cukup", ket: n.dihitung ? `${ket} Lamanya dihitung sampai hari ini.` : ket });
  return hasil;
}

module.exports = { nafkahDariPosita, faktaNafkah, RE_TIDAK_NAFKAH, teksLama };
