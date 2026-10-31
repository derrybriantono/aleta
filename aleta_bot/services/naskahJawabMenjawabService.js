"use strict";

/**
 * ============================================================================
 * JAWAB-REPLIK (31 Okt 2026) - NASKAH UTUH JAWAB-MENJAWAB UNTUK ISIAN BLANGKO DERRY
 * ============================================================================
 *
 * Permintaan pengguna 31 Okt: isian Blangko ABT by Derry Briantono untuk jawaban (serta gugatan rekonvensi), replik (serta
 * jawaban rekonvensi), duplik (serta replik rekonvensi), duplik rekonvensi, kesimpulan Penggugat/Pemohon dan kesimpulan
 * Tergugat/Termohon - TERISI OTOMATIS dari dokumen e-Court, dapat disunting, dan bentuknya sudah benar (Enter = paragraf,
 * penomoran dan sub-judul rapi).
 *
 * Berkas ini MURNI (tanpa basis data, jaringan, ABT, SIPP). Masukan = teks dokumen yang dibaca portal dari arsip e-Court
 * (PDF berlapis teks: baris terpotong, "\f" antarhalaman, nomor halaman dan kepala berulang ikut terbaca). Keluaran = teks
 * POLOS satu paragraf per baris, yang dicetak ABT lewat fungsi isian_rtf_butir (inden gantung menurut penanda butir) -
 * lihat paket abt-paket/jawab-replik-31okt.
 *
 * ATURAN BENTUK (diuji jawab-replik-31okt.test.ts):
 *   1. baris PDF yang terpotong disambung jadi paragraf utuh; kata terpenggal "pem-/bayaran" disambung; nomor butir yang
 *      terbaca sendirian ("1." lalu isinya di baris berikut) disatukan (J.barisSurat);
 *   2. kop/kepala surat, salam pembuka ("Dengan hormat", "Yth."), identitas pihak, nomor halaman, kepala berulang, penutup
 *      ("Demikian ...", "Hormat kami"), tempat-tanggal, dan blok tanda tangan dibuang; isi tidak dikarang;
 *   3. penanda butir dipertahankan dan dirapikan: "1 ." -> "1.", "1.Bahwa" -> "1. Bahwa", bulatan/kotak -> "-", satu spasi
 *      sesudah penanda; tingkatan inden dihitung ABT dari penanda (1. -> a. -> 1) -> -);
 *   4. "Dalam Eksepsi" / "Dalam Pokok Perkara" / "Dalam Konvensi" / "Dalam Rekonvensi" / "Dalam Konvensi dan Rekonvensi" /
 *      "Dalam Provisi" / "Primair:" / "Subsidair:" menjadi sub-judul tersendiri dengan ejaan baku;
 *   5. petitum ("Berdasarkan ... mohon ...") - butir amar tanpa nomor diberi nomor 1., 2., ... per sub-judul;
 *   6. titik koma di TENGAH butir (keputusan pengguna 30-31 Okt): "...; bahwa ..." -> butir baru ("- Bahwa ..." di bawah butir
 *      bernomor, "Bahwa ..." pada surat tanpa nomor); rincian sebaris "...: a. X; b. Y" -> satu baris per rincian; titik koma
 *      tengah lainnya -> koma. Titik koma di UJUNG butir tetap;
 *   7. sebutan pihak mengikuti blangko: Penggugat/Pemohon dan Tergugat/Termohon menurut jenis perkara; "Penggugat Rekonvensi" /
 *      "Tergugat Rekonvensi" tetap; "Termohon/Penggugat Rekonvensi" -> "Termohon Konvensi/Penggugat Rekonvensi"; kata ganti
 *      orang pertama (saya/kami) diganti sebutan penulis (kecuali "klien kami"); huruf di luar latin1 (kutip lengkung, garis
 *      panjang) dibakukan;
 *   8. bagian rekonvensi (sub-judul "Dalam Rekonvensi" sebelum petitum) DIPISAH ke isiannya sendiri, sampai akhir surat
 *      (petitum ikut di bagian itu supaya urutan surat tetap bila keduanya dicetak berurutan); bagian konvensi diberi sub-judul
 *      "Dalam Konvensi" bila suratnya tidak menyebutnya.
 */

const T = require("./tuntutanDeteksiService");
const J = require("./jawabMenjawabEcourtService");
const TJ = require("./tanyaJawabEcourtService");

/** Variabel ABT data_teks (blok 12020-12049, paket jawab-replik-31okt). Isinya teks polos berparagraf. */
const KODE = Object.freeze({
  jawaban: "12020",
  gugatanRekonvensi: "12021",
  replik: "12022",
  jawabanRekonvensi: "12023",
  duplik: "12024",
  replikRekonvensi: "12025",
  duplikRekonvensi: "12026",
  kesimpulanLawan: "12027",
  kesimpulanPelaku: "12028",
});
/** Kode isian berparagraf: TIDAK dirapikan menjadi satu baris saat disimpan (ekstensi: isi-sipp-bersama.js KODE_NASKAH_BERBARIS). */
const KODE_BERBARIS = Object.freeze(Object.values(KODE));

const BATAS_MIN = 150;
const BATAS_MAKS = 60000;

// ─── Sub-judul ───────────────────────────────────────────────────────────────

const AWALAN_JUDUL = String.raw`(?:(?:[IVX]{1,4}|[A-H]|\d{1,2})\s*[.)]\s*)?`;
const DAFTAR_JUDUL = [
  [/^(?:dalam\s+)?konvensi\s+(?:dan|&)\s+rekon[pv]ensi$/i, "Dalam Konvensi dan Rekonvensi"],
  [/^(?:dalam\s+)?(?:gugatan\s+)?rekon[pv]ensi$/i, "Dalam Rekonvensi"],
  [/^(?:dalam\s+)?konvensi$/i, "Dalam Konvensi"],
  [/^(?:dalam\s+)?eksepsi$/i, "Dalam Eksepsi"],
  [/^(?:dalam\s+)?pokok\s+perkara$/i, "Dalam Pokok Perkara"],
  [/^(?:dalam\s+)?provisi$/i, "Dalam Provisi"],
  [/^(?:primair|primer)$/i, "Primair:"],
  [/^(?:lebih\s+)?(?:subsidair|subsider)$/i, null],
  [/^petitum$/i, "Petitum:"],
];
const RE_AWALAN_JUDUL = new RegExp(`^${AWALAN_JUDUL}`);

/** Baris/paragraf yang seluruhnya sub-judul -> bentuk bakunya; null bila bukan. */
function judulBaku(teks) {
  const asli = String(teks || "").replace(/\s+/g, " ").trim();
  if (!asli || asli.length > 60) return null;
  const inti = asli.replace(RE_AWALAN_JUDUL, "").replace(/[\s:;.,-]+$/, "").trim();
  if (!inti) return null;
  for (const [re, baku] of DAFTAR_JUDUL) {
    if (!re.test(inti)) continue;
    if (baku) return baku;
    return /^lebih/i.test(inti) ? "Lebih Subsidair:" : "Subsidair:";
  }
  return null;
}

// ─── Penanda butir ───────────────────────────────────────────────────────────

// Penanda di awal paragraf: 1. 1) (1) a. a) (a) I. A. - • * (bulatan sudah diganti "- " oleh J.rapikanBarisHalaman).
const RE_PENANDA = /^(?:\(\d{1,2}\)|\([a-z]\)|\d{1,2}(?:\.\d{1,2})*\s*[.)]|[a-z]\s*[.)]|[IVX]{1,4}\s*\.|[A-H]\s*[.)]|[-•–—*])(?=\s|[A-Z(])/;
function adaPenanda(t) {
  return RE_PENANDA.test(String(t || ""));
}
/** "1 ." -> "1.", "1.Bahwa" -> "1. Bahwa", "a )" -> "a)", "•"/"–"/"*" -> "-". */
function rapikanPenanda(t) {
  const s = String(t || "");
  const m = RE_PENANDA.exec(s);
  if (!m) return s;
  let p = m[0].replace(/\s+/g, "");
  if (/^[-•–—*]$/.test(p)) p = "-";
  const sisa = s.slice(m[0].length).replace(/^\s+/, "");
  return sisa ? `${p} ${sisa}` : p;
}
/** Penanda dan isi: { penanda, isi } ("" bila tanpa penanda). */
function pisahPenanda(t) {
  const s = String(t || "");
  const m = RE_PENANDA.exec(s);
  if (!m) return { penanda: "", isi: s };
  return { penanda: rapikanPenanda(m[0]).trim(), isi: s.slice(m[0].length).replace(/^\s+/, "") };
}

// ─── Baris -> paragraf ───────────────────────────────────────────────────────

const RE_PEMBUKA = /^(?:Berdasarkan|Demikian|Hormat|Wassalam|Wabillah|Billahi|Oleh\s+karena|Dengan\s+demikian|Maka\b|Mohon|Memohon|Selanjutnya|Sehubungan|Untuk\s+itu|Atau\b|Apabila\b|Jika\b|Tertanda|Atas\s+(?:perhatian|kebijaksanaan)|Terima\s+kasih)/;
const RE_BAHWA = /^(?:bahwa|BAHWA|Bahwa)\b/;

/**
 * Baris (sudah tanpa nomor halaman / kepala berulang) -> paragraf. Paragraf baru dimulai pada: baris kosong asli, sub-judul,
 * penanda butir, "Bahwa", atau baris berhuruf besar sesudah baris yang berakhir tanda baca dan pendek (atau sesudah ";"/":").
 */
function susunParagraf(baris) {
  const hasil = [];
  let kini = null;
  let barisAkhir = "";
  const tutup = () => {
    if (kini && kini.teks.trim()) hasil.push({ teks: kini.teks.replace(/\s+/g, " ").trim(), judul: kini.judul || null });
    kini = null;
  };
  const panjang = baris.filter((x) => x && x.length > 40).map((x) => x.length).sort((a, b) => a - b);
  const lebar = panjang.length >= 4 ? panjang[Math.floor(panjang.length * 0.9)] : 0;
  for (const l0 of baris) {
    const l = String(l0 || "").trim();
    if (!l) {
      tutup();
      continue;
    }
    const jd = judulBaku(l);
    if (jd) {
      tutup();
      hasil.push({ teks: jd, judul: jd });
      barisAkhir = l;
      continue;
    }
    let baru = !kini || adaPenanda(l) || RE_BAHWA.test(l);
    if (!baru && /[.;:!?)]$/.test(barisAkhir) && /^[A-Z"(]/.test(l)) {
      const pendek = lebar > 0 && barisAkhir.length < lebar * 0.8;
      if (pendek || RE_PEMBUKA.test(l) || /[;:]$/.test(barisAkhir)) baru = true;
    }
    if (baru) {
      tutup();
      kini = { teks: l, judul: null };
    } else if (/[a-z]-$/.test(kini.teks) && /^[a-z]/.test(l)) {
      // Kata terpenggal di batas halaman ("ke-" / "butuhan"); kata ulang ("anak-" / "anak") tetap bertanda hubung.
      const depan = ((/([A-Za-z]+)-$/.exec(kini.teks) || [])[1] || "").toLowerCase();
      const belakang = (/^([a-z]+)/.exec(l) || [])[1] || "";
      const ulang = depan.length >= 2 && (belakang.startsWith(depan) || depan.startsWith(belakang));
      kini.teks = ulang ? `${kini.teks}${l}` : `${kini.teks.slice(0, -1)}${l}`;
    } else {
      kini.teks += ` ${l}`;
    }
    barisAkhir = l;
  }
  tutup();
  return hasil;
}

// ─── Awal dan akhir isi ──────────────────────────────────────────────────────

const RE_PENUTUP = /^(?:demikian\b|hormat\s+(?:kami|saya)\b|wassalam|wabillah|billahi|dibuat\s+(?:di|oleh)\b|tertanda\b|atas\s+(?:perhatian|kebijaksanaan)|terima\s+kasih|tembusan\b)/i;
/**
 * Arahan pengguna 31 Okt: yang diambil HANYA dalil (posita/uraian + sub-judulnya) dan petitum. Kalimat identitas pihak/kuasa dan kalimat
 * pengantar dibuang di mana pun letaknya (juga sesudah sub-judul pertama).
 */
const RE_IDENTITAS_KALIMAT = /^(?:(?:kami|saya)\s+)?yang\s+bertanda\s+tangan\b|\bdalam\s+hal\s+ini\s+(?:memberi(?:kan)?\s+kuasa|diwakili|bertindak)\b|\bberdasarkan\s+surat\s+kuasa\s+khusus\b[^.]{0,200}\b(?:bertindak|mewakili|untuk\s+dan\s+atas\s+nama)\b|^selanjutnya\s+disebut\s+(?:sebagai\s+)?(?:penggugat|tergugat|pemohon|termohon)\b/i;
const RE_PENGANTAR = /^(?:dengan\s+ini|bersama\s+ini|perkenankanlah|izinkanlah|perkenankan|melalui\s+surat\s+ini|pada\s+kesempatan\s+ini)\b[^.]{0,260}\b(?:mengajukan|menyampaikan|memberikan)\b[^.]{0,200}(?:sebagai\s+berikut|berikut\s+ini|sebagaimana\s+berikut)\s*[:.]?$|^(?:adapun\s+)?(?:jawaban|replik|duplik|kesimpulan)\b[^.]{0,160}(?:adalah\s+)?sebagai\s+berikut\s*:?$/i;
const RE_ORANG = /\b(?:advokat|pengacara|konsultan\s+hukum|berkantor|beralamat|kewarganegaraan|warga\s+negara|umur\s+\d+\s+tahun|NIK\b|NIP\b|pekerjaan\s*:)/i;
const RE_AMAR = /^(?:Mengabulkan|Menolak|Menyatakan|Menetapkan|Menghukum|Membebankan|Memberi(?:kan)?\s+izin|Menjatuhkan|Memerintahkan|Mengizinkan|Menerima|Menceraikan|Memutuskan|Mewajibkan|Menyerahkan|Membagi|Memutus|Mengesahkan|Membatalkan|Meletakkan|Mengangkat)\b/;
const RE_PEMBUKA_PETITUM = /^(?:\(?\d{1,2}[.)]\s*)?(?:bahwa\s+)?(?:(?:berdasarkan|maka|oleh\s+karena|dengan\s+demikian|untuk\s+itu|sehubungan|atas\s+dasar)\b[^.]{0,260}\b(?:mohon|memohon)\b|(?:mohon|memohon)\b)/i;

function bukanIsi(teks) {
  const t = J.tanpaNomor(teks);
  if (J.RE_IDENTITAS.test(t) || J.RE_SALAM.test(t) || (J.RE_KONTAK.test(teks) && teks.length < 120) || J.RE_TANGGAL_TEMPAT.test(t)) return true;
  // Kalimat identitas/kuasa dan pengantar: hanya bila bukan dalil "Bahwa ..." (dalil boleh menyebut "dalam hal ini bertindak").
  return !/^bahwa\b/i.test(t) && (RE_IDENTITAS_KALIMAT.test(t) || RE_PENGANTAR.test(t));
}

/** Paragraf -> { isi, yakin, dibuang } (kop sebelum isi dan penutup sesudahnya dilepas). */
function potongIsi(par) {
  const dibuang = { kop: 0, penutup: 0, identitas: 0 };
  let awal = par.findIndex((p) => {
    if (p.judul) return /^Dalam\b/.test(p.judul);
    if (bukanIsi(p.teks)) return false;
    const { penanda, isi } = pisahPenanda(p.teks);
    if (/^bahwa\b/i.test(isi) && p.teks.length >= 30) return true;
    // Identitas kuasa/pihak bernomor ("1. Andi, S.H., Advokat, berkantor di ...") bukan awal isi.
    return Boolean(penanda) && p.teks.length >= 40 && !/^(?:yang\s+bertanda|selanjutnya\s+disebut)/i.test(isi) && !RE_ORANG.test(isi);
  });
  let yakin = true;
  if (awal < 0) {
    awal = 0;
    yakin = false;
  }
  dibuang.kop = awal;
  let akhir = par.length;
  for (let i = awal + 1; i < par.length; i += 1) {
    const t = par[i].teks;
    if (!RE_PENUTUP.test(t) && !J.RE_TANGGAL_TEMPAT.test(t)) continue;
    // "Demikian ..., mohon Majelis Hakim memutus: 1. ..." - petitum sesudah kata penutup tetap isi.
    if (/^demikian\b/i.test(t) && /\b(?:mohon|memohon)\b/i.test(t) && par.slice(i + 1, i + 3).some((x) => RE_AMAR.test(pisahPenanda(x.teks).isi))) {
      let j = i + 1;
      while (j < par.length && (par[j].judul || RE_AMAR.test(pisahPenanda(par[j].teks).isi) || /^atau\b|apabila\s+majelis|ex\s+aequo/i.test(par[j].teks))) j += 1;
      akhir = j;
      break;
    }
    akhir = i;
    break;
  }
  dibuang.penutup = par.length - akhir;
  const isi = [];
  for (const p of par.slice(awal, akhir)) {
    if (!p.judul && bukanIsi(p.teks)) {
      dibuang.identitas += 1;
      continue;
    }
    if (!p.judul && p.teks.replace(/[^A-Za-z]/g, "").length < 4) continue;
    isi.push(p);
  }
  // Blok tanda tangan tanpa kata penutup di depannya.
  while (isi.length > 1) {
    const u = isi[isi.length - 1];
    if (u.judul || u.teks.length > 140 || !J.RE_BLOK_TTD.test(u.teks)) break;
    isi.pop();
    dibuang.penutup += 1;
  }
  return { isi, yakin, dibuang };
}

// ─── Sebutan pihak ───────────────────────────────────────────────────────────

/**
 * Sebutan surat -> sebutan blangko. lawan/pelaku = sebutan konvensi perkara ini (Penggugat/Tergugat atau Pemohon/Termohon).
 * Kata pihak yang diikuti "Rekonvensi" tidak diubah (dalam rekonvensi sebutannya selalu Penggugat/Tergugat Rekonvensi).
 */
function samakanPihak(teks, sebutan) {
  const lawan = (sebutan && sebutan.lawan) || "Penggugat";
  const pelaku = (sebutan && sebutan.pelaku) || "Tergugat";
  let s = String(teks || "");
  s = s.replace(/\bRekonpensi\b/g, "Rekonvensi").replace(/\bREKONPENSI\b/g, "REKONVENSI").replace(/\brekonpensi\b/g, "rekonvensi").replace(/\bKonpensi\b/g, "Konvensi");
  // "Penggugat/Pemohon" -> sebutan perkara ini.
  s = s.replace(/\b(?:Penggugat|Pemohon)\s*\/\s*(?:Penggugat|Pemohon)\b(?!\s+Rekonvensi)/g, lawan).replace(/\b(?:Tergugat|Termohon)\s*\/\s*(?:Tergugat|Termohon)\b(?!\s+Rekonvensi)/g, pelaku);
  // "Termohon/Penggugat Rekonvensi" -> "Termohon Konvensi/Penggugat Rekonvensi".
  s = s.replace(/\b(Penggugat|Pemohon|Tergugat|Termohon)(\s+Konvensi)?\s*\/\s*(Penggugat|Tergugat)\s+Rekonvensi\b/g, (_m, a, _k, b) => `${a} Konvensi/${b} Rekonvensi`);
  // Kata pihak konvensi tunggal (bukan "... Rekonvensi"): sistem kata Pemohon/Termohon vs Penggugat/Tergugat menurut blangko.
  const keLawan = (w) => (/^[A-Z]+$/.test(w) ? lawan.toUpperCase() : lawan);
  const kePelaku = (w) => (/^[A-Z]+$/.test(w) ? pelaku.toUpperCase() : pelaku);
  s = s.replace(/\b(Penggugat|Pemohon|PENGGUGAT|PEMOHON)\b(?!\s+(?:Rekonvensi|REKONVENSI|rekonvensi))/g, (w) => (lawan === "Penggugat" || lawan === "Pemohon" ? keLawan(w) : w));
  s = s.replace(/\b(Tergugat|Termohon|TERGUGAT|TERMOHON)\b(?!\s+(?:Rekonvensi|REKONVENSI|rekonvensi))/g, (w) => (pelaku === "Tergugat" || pelaku === "Termohon" ? kePelaku(w) : w));
  return s;
}

/** Kata ganti orang pertama -> sebutan penulis ("saya" -> "Tergugat"), kecuali surat kuasa ("klien kami"). */
function gantiOrangPertama(teks, penulis) {
  if (!penulis) return { teks, diganti: false };
  // Surat kuasa: "klien kami" / "prinsipal kami" = pihak yang diwakili; "kami" lainnya = kuasa, dibiarkan.
  if (/\b(?:klien|prinsipal|pemberi\s+kuasa)\s+kami\b|\bkuasa\s+hukum\s+kami\b|\bkami\s+selaku\s+kuasa\b/i.test(teks)) {
    const t = teks.replace(/\b(?:klien|prinsipal|pemberi\s+kuasa)\s+kami\b/gi, penulis);
    return { teks: t, diganti: t !== teks };
  }
  if (!/\b(?:saya|kami|aku)\b/i.test(teks)) return { teks, diganti: false };
  const t = teks.replace(/\b(?:saya|kami|aku)\b/gi, penulis);
  return { teks: t, diganti: true };
}

// ─── Titik koma di tengah butir ──────────────────────────────────────────────

/**
 * Satu paragraf -> beberapa paragraf (keputusan pengguna: tanpa ";" di tengah butir).
 *   "...; bahwa ..." -> butir baru; rincian sebaris "...: a. X; b. Y" / "1) X; 2) Y" -> satu baris per rincian; ";" lainnya -> ",".
 */
function pecahTitikKoma(teks, opsi) {
  const o = opsi || {};
  const { penanda } = pisahPenanda(teks);
  // 1. Rincian sebaris berurutan sesudah ":" lalu ";" (": a. X; b. Y" / ": 1) X; 2) Y" / ": (a) X; (b) Y") - dipecah di depan tiap penanda.
  const re = /([:;])\s+(\(?)([a-z]|\d{1,2})([.)])\s+(?=\S)/g;
  const calon = [];
  let m;
  while ((m = re.exec(teks))) {
    const p = m[3];
    calon.push({ potong: m.index + 1, tanda: m[1], nilai: /^\d+$/.test(p) ? Number(p) : p.charCodeAt(0) - 96, gaya: `${m[2]}${/\d/.test(p) ? "1" : "a"}${m[4]}` });
  }
  const potong = [];
  let rantai = [];
  const tutupRantai = () => {
    if (rantai.length >= 2) potong.push(...rantai.map((x) => x.potong));
    rantai = [];
  };
  for (const x of calon) {
    const akhir = rantai[rantai.length - 1];
    if (akhir && x.tanda === ";" && x.gaya === akhir.gaya && x.nilai === akhir.nilai + 1) {
      rantai.push(x);
      continue;
    }
    tutupRantai();
    if (x.tanda === ":" && x.nilai === 1) rantai = [x];
  }
  tutupRantai();
  if (!potong.length) return pecahBahwa(teks, penanda, o);
  const bagian = [];
  let dari = 0;
  for (const i of potong) {
    bagian.push(teks.slice(dari, i).trim());
    dari = i;
  }
  bagian.push(teks.slice(dari).trim());
  return bagian.filter(Boolean).flatMap((x) => pecahBahwa(x, penanda, o));
}

function pecahBahwa(teks, penandaInduk, o) {
  const bagian = String(teks).split(/;\s+(?=bahwa\b)/i);
  const keluar = [];
  bagian.forEach((b, i) => {
    let t = b.trim();
    if (i < bagian.length - 1) t = `${t};`;
    if (i > 0) {
      t = t.replace(/^bahwa\b/i, "Bahwa");
      // Di bawah butir bernomor: butir "-"; pada surat tanpa nomor: paragraf "Bahwa" baru seperti paragraf lainnya.
      if (penandaInduk || o.bernomor) t = `- ${t}`;
    }
    keluar.push(koma(t));
  });
  return keluar;
}

/** ";" yang tersisa di tengah paragraf (diikuti teks lain) -> ","; ";" di ujung tetap. */
function koma(t) {
  return String(t).replace(/;(?=\s*\S)/g, ",").replace(/,\s*,/g, ",");
}

// ─── Petitum ─────────────────────────────────────────────────────────────────

/** Butir amar petitum tanpa nomor diberi nomor 1., 2., ... per sub-judul; yang sudah bernomor dibiarkan. */
function nomoriPetitum(par) {
  const awal = par.findIndex((p, i) => i > 0 && !p.judul && RE_PEMBUKA_PETITUM.test(p.teks));
  if (awal < 0) return { par, awalPetitum: -1 };
  const keluar = par.slice(0, awal + 1);
  let n = 0;
  for (const p of par.slice(awal + 1)) {
    if (p.judul) {
      n = 0;
      keluar.push(p);
      continue;
    }
    const { penanda, isi } = pisahPenanda(p.teks);
    if (!penanda && RE_AMAR.test(isi)) {
      n += 1;
      keluar.push({ ...p, teks: `${n}. ${isi}` });
      continue;
    }
    if (/^\d{1,2}[.)]$/.test(penanda)) n = Number(penanda.replace(/\D/g, "")) || n;
    keluar.push(p);
  }
  return { par: keluar, awalPetitum: awal };
}

// ─── Rakit ───────────────────────────────────────────────────────────────────

/**
 * Teks dokumen -> naskah rapi.
 * @param {string} teks
 * @param {{peran?:string, sebutan?:{lawan:string, pelaku:string}, penulis?:string, pisahRekonvensi?:boolean}} opsi
 * @returns {{konvensi:string, rekonvensi:string, yakin:boolean, alasan:string[], catatan:string[], dibuang:object, butir:number}}
 */
function naskahDariSurat(teks, opsi) {
  const o = opsi || {};
  const sebutan = o.sebutan || { lawan: "Penggugat", pelaku: "Tergugat" };
  const { baris, dibuang: dibuangBaris } = J.barisSurat(T.rapikanTeks(teks));
  const par = susunParagraf(baris);
  const potong = potongIsi(par);
  const alasan = [];
  const catatan = [];
  if (!potong.yakin) alasan.push("awal isi surat tidak terpisah jelas dari kop");
  // Normalisasi tiap paragraf.
  let diganti = false;
  let hurufBesar = 0;
  const bersih = [];
  const bernomor = potong.isi.filter((p) => !p.judul && /^\d{1,2}[.)]/.test(rapikanPenanda(p.teks))).length >= 2;
  for (const p of potong.isi) {
    if (p.judul) {
      bersih.push(p);
      continue;
    }
    let t = TJ.amankan(rapikanPenanda(p.teks));
    t = samakanPihak(t, sebutan);
    const g = gantiOrangPertama(t, o.penulis);
    if (g.diganti) diganti = true;
    t = g.teks;
    if (J.bagianHuruf(t) >= 0.8 && t.replace(/[^A-Za-z]/g, "").length >= 20) hurufBesar += 1;
    for (const x of pecahTitikKoma(t, { bernomor })) bersih.push({ teks: x.replace(/\s+/g, " ").trim(), judul: null });
  }
  if (diganti) catatan.push("kata ganti orang pertama (saya/kami) diganti sebutan pihak");
  if (hurufBesar >= 2) alasan.push("surat diketik huruf besar semua - ejaan nama perlu diperiksa");
  const { par: berNomor, awalPetitum } = nomoriPetitum(bersih);
  // Pisah rekonvensi: sub-judul "Dalam Rekonvensi" SEBELUM petitum.
  let konv = berNomor;
  let rekon = [];
  if (o.pisahRekonvensi !== false) {
    const batas = awalPetitum >= 0 ? awalPetitum : berNomor.length;
    const r = berNomor.findIndex((p, i) => i < batas && p.judul === "Dalam Rekonvensi");
    if (r >= 0) {
      konv = berNomor.slice(0, r);
      rekon = berNomor.slice(r);
      if (!konv.some((p) => p.judul === "Dalam Konvensi")) konv = [{ teks: "Dalam Konvensi", judul: "Dalam Konvensi" }, ...konv];
    } else if (berNomor.some((p) => p.judul === "Dalam Rekonvensi")) {
      catatan.push("bagian rekonvensi hanya ada di petitum - tidak dipisah");
    }
  }
  const gabung = (xs) => xs.map((p) => p.teks).filter(Boolean).join("\n");
  const konvensi = gabung(konv);
  const rekonvensi = gabung(rekon);
  const isiSaja = [...konv, ...rekon].filter((p) => !p.judul);
  const total = isiSaja.reduce((n, p) => n + p.teks.length, 0);
  if (isiSaja.length < 2) alasan.push("isi surat terlalu sedikit");
  if (total < BATAS_MIN) alasan.push("isi surat terlalu pendek");
  if (total > BATAS_MAKS) alasan.push("isi surat terlalu panjang");
  alasan.push(...TJ.cacatKarakter(isiSaja.map((p) => p.teks).join(" ")));
  const sisa = TJ.sisaKop(isiSaja.slice(-2).map((p) => p.teks), true).filter((a) => !/kop, penutup|nama kuasa/.test(a) || isiSaja.length < 3);
  alasan.push(...sisa);
  return {
    konvensi,
    rekonvensi,
    yakin: alasan.length === 0,
    alasan: [...new Set(alasan)],
    catatan,
    dibuang: { ...dibuangBaris, ...potong.dibuang },
    butir: isiSaja.length,
  };
}

// ─── Usulan isian ────────────────────────────────────────────────────────────

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function tanggalPanjang(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${Number(m[3])} ${NAMA_BULAN[Number(m[2]) - 1]} ${m[1]}` : "";
}

/** Peran naskah satu dokumen yang sudah dikenali (J.kenaliJenis) -> tujuan isiannya, atau null. */
function tujuanDokumen(k) {
  if (!k || k.turut) return null;
  if (k.peran === "jawaban" && k.pihak !== "0046") return { jenis: "jawaban", kode: KODE.jawaban, rekon: KODE.gugatanRekonvensi, pihak: "0047" };
  if (k.peran === "replik" && k.pihak !== "0047") return { jenis: "replik", kode: KODE.replik, rekon: KODE.jawabanRekonvensi, pihak: "0046" };
  // Rereplik (jenis e-Court) atau duplik yang diunggah Penggugat/Pemohon = duplik rekonvensi.
  if (k.peran === "duplik" && (k.rekonvensiDuplik || k.pihak === "0046")) return { jenis: "duplik-rekonvensi", kode: KODE.duplikRekonvensi, rekon: "", pihak: "0046" };
  if (k.peran === "duplik") return { jenis: "duplik", kode: KODE.duplik, rekon: KODE.replikRekonvensi, pihak: "0047" };
  if (k.peran === "kesimpulan" && k.pihak === "0046") return { jenis: "kesimpulan", kode: KODE.kesimpulanLawan, rekon: "", pihak: "0046" };
  if (k.peran === "kesimpulan" && k.pihak === "0047") return { jenis: "kesimpulan", kode: KODE.kesimpulanPelaku, rekon: "", pihak: "0047" };
  return null;
}

const NAMA_JENIS = { jawaban: "Jawaban", replik: "Replik", duplik: "Duplik", "duplik-rekonvensi": "Duplik rekonvensi", kesimpulan: "Kesimpulan" };

/**
 * Dokumen e-Court (bentuk saringDokumen isiGugatanService) -> usulan isian 12020-12028.
 * Keyakinan "cukup" (ditulis sendiri ke isian yang KOSONG) hanya bila: jenis berkas pasti (jenis/judul/isi sepakat),
 * pengunggah dikenali, satu-satunya berkas untuk bagian itu, bukan OCR, dan naskahnya rapi; selain itu "ragu" (saran).
 * @param {{dokumen:Array<object>, sebutan:{lawan:string, pelaku:string}}} m
 */
function usulanNaskah(m) {
  const x = m || {};
  const sebutan = x.sebutan || { lawan: "Penggugat", pelaku: "Tergugat" };
  const per = new Map();
  (Array.isArray(x.dokumen) ? x.dokumen : []).forEach((d, indeks) => {
    if (!d || d.peran === "gugatan" || d.peran === "bukti") return;
    const k = J.kenaliJenis(d);
    const tj = tujuanDokumen(k);
    if (!tj) return;
    const daftar = per.get(tj.kode) || [];
    daftar.push({ d, k, tj, indeks });
    per.set(tj.kode, daftar);
  });
  const usulan = [];
  for (const [, daftar] of per) {
    daftar.sort((a, b) => String(a.d.diunggah || "").localeCompare(String(b.d.diunggah || "")) || a.indeks - b.indeks);
    const pilih = daftar[daftar.length - 1];
    const { d, k, tj } = pilih;
    const penulis = J.sebutanPeran(k.peran === "duplik" && tj.pihak === "0046" ? "replik" : k.peran, tj.pihak, sebutan, false);
    const n = naskahDariSurat(d.teks, { sebutan, penulis, pisahRekonvensi: Boolean(tj.rekon) });
    const ragu = [];
    if (k.ragu) ragu.push(`jenis berkas diragukan${k.catatan && k.catatan[0] ? ` (${k.catatan[0]})` : ""}`);
    if (!k.pihak) ragu.push("pengunggah tidak dikenali");
    if (d.baca === "ocr") ragu.push("dibaca OCR");
    if (daftar.length > 1) ragu.push(`ada ${daftar.length} berkas ${NAMA_JENIS[tj.jenis].toLowerCase()} - dipakai yang terakhir diunggah`);
    ragu.push(...n.alasan);
    const keyakinan = ragu.length ? "ragu" : "cukup";
    const tgl = tanggalPanjang(d.diunggah);
    const siapa = tj.pihak === "0046" ? sebutan.lawan : sebutan.pelaku;
    const asal = `dokumen e-Court "${d.judul}" (${siapa}${tgl ? `, diunggah ${tgl}` : ""})`;
    const ket = `Diisi dari ${asal}. Kop, salam, tanda tangan, dan nomor halaman dibuang; paragraf, penomoran, dan sub-judul dirapikan - periksa sebelum dipakai.${ragu.length ? ` Belum diisi sendiri: ${ragu.join("; ")}.` : ""}${n.catatan.length ? ` Catatan: ${n.catatan.join("; ")}.` : ""}`;
    const sumber = [{ asal: "gugatan-ecourt", kalimat: `e-Court: ${d.judul}${tgl ? ` (diunggah ${tgl})` : ""}${d.baca === "ocr" ? " (dibaca OCR)" : ""}` }];
    const dasar = { bentrok: "", jagaIsianLama: true, sumber, kodePola: `naskah-${tj.jenis}`, dokumen: d.judul, diunggah: String(d.diunggah || "") };
    if (n.konvensi) usulan.push({ ...dasar, kode: tj.kode, nama: `${NAMA_JENIS[tj.jenis]} ${siapa} (uraian lengkap)`, nilai: n.konvensi, keyakinan, catatan: ket });
    // Kesimpulan dalam kalimat blangko ("... yang pada pokoknya <frasa>;", isian 8436/8437): frasa "tetap pada ..." dari surat yang
    // sama ditulis sendiri bila suratnya pasti; bentuk lain tetap saran dari jawabMenjawabEcourtService (keputusan sementara 31 Okt).
    if (tj.jenis === "kesimpulan" && keyakinan === "cukup") {
      const kl = J.klausaKesimpulan(J.bersihkanSurat(d.teks));
      if (kl.pola === "kesimpulan-tetap-pada" && kl.klausa) {
        usulan.push({
          ...dasar,
          kode: tj.pihak === "0046" ? "8436" : "8437",
          nama: `Kesimpulan oleh ${siapa}`,
          nilai: J.lcfirst(samakanPihak(TJ.amankan(kl.klausa), sebutan)),
          keyakinan: "cukup",
          kodePola: "kesimpulan-tetap-pada",
          catatan: `Frasa "tetap pada ..." diambil apa adanya dari ${asal} - dicetak sesudah "yang pada pokoknya".`,
        });
      }
    }
    if (tj.rekon && n.rekonvensi) {
      const namaRekon = tj.jenis === "jawaban" ? "Gugatan rekonvensi" : tj.jenis === "replik" ? "Jawaban rekonvensi" : "Replik rekonvensi";
      usulan.push({ ...dasar, kode: tj.rekon, nama: `${namaRekon} ${siapa} (uraian lengkap)`, nilai: n.rekonvensi, keyakinan, catatan: ket });
    }
  }
  return usulan.sort((a, b) => Number(a.kode) - Number(b.kode));
}

/** Penyimpanan isian berparagraf (dipakai ekstensi saat menyimpan suntingan): tiap baris dirapatkan, baris kosong dibuang. */
function rapikanSimpanan(teks) {
  return String(teks == null ? "" : teks)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

module.exports = {
  KODE,
  KODE_BERBARIS,
  judulBaku,
  rapikanPenanda,
  pisahPenanda,
  susunParagraf,
  potongIsi,
  samakanPihak,
  gantiOrangPertama,
  pecahTitikKoma,
  nomoriPetitum,
  naskahDariSurat,
  tujuanDokumen,
  usulanNaskah,
  rapikanSimpanan,
};
