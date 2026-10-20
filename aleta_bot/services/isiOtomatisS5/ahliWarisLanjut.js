"use strict";

/**
 * ============================================================================
 * PENETAPAN AHLI WARIS / P3HP - ISIAN LANJUTAN (variabel ABT 4500-4599, agen U5 20 Okt 2026)
 * ============================================================================
 *
 * Melengkapi ahliWaris.js (9701-9704, 9718, 8608, 8610, 8614, 9700) dengan bacaan posita/petitum untuk isian yang ditambahkan paket
 * ABT u5-ahli-waris:
 *
 *   4500 tujuan permohonan        petitum "untuk keperluan ..." atau posita "bermaksud untuk mengurus/membayar/balik nama ...", hanya bila BUKAN pencairan dana
 *   4502 anak angkat pewaris      kalimat posita yang menyatakan pewaris mempunyai anak angkat (kalimat yang menyangkal tidak dibaca)
 *   4507 wasiat pewaris           kalimat posita "meninggalkan/membuat wasiat ..." (kalimat yang menyangkal tidak dibaca)
 *   4510 kerabat tidak Islam      kalimat posita yang menyebut kerabat pewaris beragama selain Islam
 *   4513 keadaan perkawinan       1 = berpisah tetapi belum bercerai, 2 = sudah bercerai; HANYA saran (pilihan hakim)
 *   4540/4541 pengganti saudara   "Kakak/Adik/Saudara Pewaris yaitu X telah meninggal ... dan meninggalkan anak bernama Y sebagai Ahli waris Pengganti"
 *   8613 kematian pasangan        "Isteri/Suami (Pewaris) ... telah meninggal dunia terlebih dahulu pada tanggal ..."
 *   4515 bagian ahli waris        hitungan KHI (faraid.js) atas susunan yang terbaca penuh; selalu "ragu" dengan rincian hitungan
 *
 * Aturan: yang diambil hanya yang TERTULIS; tidak ada yang disimpulkan. Penilaian hukum tetap milik hakim: semua isian lanjutan berkeyakinan
 * "ragu" (saran): belum ada isian petugas pembanding dalam jumlah yang dituntut gerbang otomatis berdasar; 4540/4541 hanya dicatat bila anak itu ada di petitum.
 * Hanya SELECT-bebas: modul ini murni (data masuk, usulan keluar).
 */

const B = require("./bantu");
const AW = require("./ahliWaris");
const FA = require("./faraid");

const NAMA = Object.freeze({
  "4500": "Tujuan permohonan penetapan ahli waris",
  "4502": "Anak angkat pewaris",
  "4507": "Wasiat pewaris",
  "4510": "Kerabat pewaris yang tidak beragama Islam",
  "4513": "Keadaan perkawinan pewaris saat meninggal (pilihan hakim)",
  "4515": "Bagian masing-masing ahli waris (usulan hitungan)",
  "4540": "Saudara pewaris yang meninggal lebih dahulu (ahli waris pengganti)",
  "4541": "Anak dari saudara pewaris yang meninggal lebih dahulu (ahli waris pengganti)",
  "8613": "Kematian suami/istri pewaris",
});

/** Posita -> butir (kalimat bernomor) polos. */
function butirPosita(posita) {
  const t = B.polos(posita);
  if (!t) return [];
  return t
    .split(/\s+(?=\d{1,2}\s*[.)]\s+(?:Bahwa|Pemohon|Dengan|Atas|Para|Semasa)\b)|;\s+(?=\d{1,2}\s*[.)]\s)/)
    .map((x) => x.replace(/^\s*\d{1,2}\s*[.)]\s*/, "").replace(/^Bahwa\s+/i, "").trim())
    .filter((x) => x.length > 8);
}

/** Kalimat (potongan) yang memuat `re`, sebagai teks pendek; null bila tidak ada. */
function kalimatDengan(butir, re, kecuali) {
  for (const b of butir) {
    if (!re.test(b)) continue;
    if (kecuali && kecuali.test(b)) continue;
    return b;
  }
  return null;
}

const potong = (s, n = 230) => {
  const t = B.rapikanNama(s);
  if (t.length <= n) return t;
  const p = t.slice(0, n);
  return p.slice(0, Math.max(p.lastIndexOf(","), p.lastIndexOf(" "))).trim();
};

/** Nama orang di dalam teks pendek: "Fulan bin Fulan" (dengan bin/binti) pertama. */
function namaDi(t) {
  const m = /([A-Z][A-Za-z.'`-]*(?:\s+[A-Z][A-Za-z.'`-]*){0,5}?\s+(?:bin|binti)\s+[A-Z][A-Za-z.'`-]*(?:\s+[A-Z][A-Za-z.'`-]*){0,2})/.exec(String(t || ""));
  return m ? B.rapikanNama(m[1]).replace(/\s*\((?:Alm[a-z]*|Pewaris|Pemohon[^)]*)\.?\)\s*$/i, "") : "";
}

// ---------------------------------------------------------------------------
// 4502 anak angkat
// ---------------------------------------------------------------------------
function anakAngkat(butir) {
  const re = /\b(?:mempunyai|memiliki|punya|meninggalkan|mengangkat|serta|dan)\s+(?:seorang\s+|\d+\s*(?:\(\w+\)\s*)?orang\s+)?anak\s+angkat\b/i;
  for (const b of butir) {
    const m = re.exec(b);
    if (!m) continue;
    const sebelum = b.slice(Math.max(0, m.index - 30), m.index);
    if (/\b(?:tidak|belum|bukan|tanpa)\b/i.test(sebelum + m[0])) continue;
    const dari = b.slice(m.index);
    const nama = namaDi(dari);
    return { nilai: nama || "anak angkat Pewaris (lengkapi nama lengkapnya)", kalimat: b, berNama: Boolean(nama) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4507 wasiat
// ---------------------------------------------------------------------------
function wasiat(butir) {
  for (const b of butir) {
    const m = /\b(?:meninggalkan|membuat|menulis|membuat\s+dan\s+meninggalkan|mempunyai|memberikan)\s+(?:sebuah\s+|surat\s+|suatu\s+)?wasiat\b/i.exec(b);
    if (!m) continue;
    if (/\b(?:tidak|belum|bukan|tanpa)\s+(?:ada\s+)?(?:\w+\s+){0,2}$/i.test(b.slice(Math.max(0, m.index - 24), m.index + m[0].length - 6))) continue;
    if (/\bwasiat\b[^.;]{0,6}\b(?:b\.\s*waris|d\.\s*hibah)\b/i.test(b)) continue; // kutipan Pasal 49 ("c. wasiat, d. hibah")
    return { nilai: potong(b.slice(m.index), 200), kalimat: b };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4510 kerabat tidak beragama Islam
// ---------------------------------------------------------------------------
function kerabatTakIslam(butir) {
  const re = /\b(?:beragama|memeluk|menganut)\s+(?:non\s*[- ]?muslim|Kristen|Nasrani|Katolik|Katholik|Protestan|Hindu|Budha|Buddha|Konghucu)\b|\bnon[- ]?muslim\b/i;
  for (const b of butir) {
    const m = re.exec(b);
    if (!m) continue;
    // pewaris sendiri yang mualaf bukan kerabat; kerabat disebut "keluarga/orang tua/saudara/anak ... masih beragama ..."
    const lingkup = /\b(?:keluarga|orang\s*tua|ayah|ibu|saudara|kakak|adik|anak|cucu|isteri|istri|suami)\b/i.exec(b.slice(Math.max(0, m.index - 140), m.index + 20));
    if (!lingkup) continue;
    return { nilai: potong(b, 200), kalimat: b };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4513 keadaan perkawinan pewaris
// ---------------------------------------------------------------------------
function keadaanPerkawinan(butir) {
  const pasangan = /\b(?:isteri|istri|suami|pasangan|menikah|pernikahan|perkawinan)\b/i;
  const pewaris = /\b(?:Pewaris|Almarhum(?:ah)?|Alm\.?|Almh\.?)/i;
  const jendela = (b, m, kiri = 160, kanan = 160) => b.slice(Math.max(0, m.index - kiri), m.index + m[0].length + kanan);
  const bukanOrangTua = (w, m, b) => !/\b(?:ayah|ibu|bapak|orang\s*tua|kedua\s+orang|Kakak|Adik|Saudara)\b[^.;]{0,50}$/i.test(b.slice(Math.max(0, m.index - 70), m.index));
  for (const b of butir) {
    const re = /\b(?:telah\s+)?berpisah\b|\bpisah\s+(?:rumah|ranjang|tempat)\b/gi;
    let m;
    while ((m = re.exec(b)) !== null) {
      const w = jendela(b, m);
      if (!pewaris.test(w) || !bukanOrangTua(w, m, b)) continue;
      if (/\btidak\s+(?:pernah\s+)?berpisah\b/i.test(w)) continue;
      return { nilai: "1", kalimat: potong(w, 300), ket: "berpisah" };
    }
  }
  for (const b of butir) {
    const re = /\b(?:telah|sudah|pernah)\s+(?:menikah\s+dan\s+)?(?:bercerai|cerai)\b|\bakta\s+cerai\b|\bbercerai\s+(?:dengan|dari)\b|\bkeduanya\s+telah\s+bercerai\b/gi;
    let m;
    while ((m = re.exec(b)) !== null) {
      const w = jendela(b, m);
      if (!pasangan.test(w) || !pewaris.test(w) || !bukanOrangTua(w, m, b)) continue;
      if (/\b(?:tidak|belum)\s+(?:pernah\s+)?bercerai\b/i.test(w)) continue;
      return { nilai: "2", kalimat: potong(w, 300), ket: "bercerai" };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4540 / 4541 pengganti saudara (keponakan)
// ---------------------------------------------------------------------------
function penggantiSaudara(butir, petitum) {
  for (const b of butir) {
    const m = /\b(?:Kakak|Adik|Saudara(?:\s+(?:kandung|laki-laki|perempuan))?)\s+(?:dari\s+)?Pewaris\s+(?:yaitu|bernama)\s+(.{3,90}?)\s+(?:telah\s+)?meninggal(?:\s+dunia)?\s+(?:lebih\s+(?:dulu|dahulu)|terlebih\s+dahulu)/i.exec(b);
    if (!m) continue;
    const sisa = b.slice(m.index + m[0].length);
    const a = /meninggalkan\s+(?:seorang\s+|\d+\s*(?:\(\w+\)\s*)?orang\s+)?anak\s+(?:yang\s+)?(?:bernama\s+)?(.{3,120}?)\s+sebagai\s+Ahli\s+waris\s+Pengganti/i.exec(sisa);
    if (!a) continue;
    const saudara = namaDi(m[1]) || B.rapikanNama(m[1]).replace(/\s*\((?:Alm[a-z]*\.?)\)\s*/gi, "").trim();
    const anak = a[1]
      .split(/\s+dan\s+|\s*,\s*|\s*;\s*/)
      .map((x) => namaDi(x) || B.rapikanNama(x).replace(/\s*\([^)]*\)\s*/g, "").trim())
      .filter(Boolean);
    if (!saudara || !anak.length) continue;
    const dalamPetitum = anak.every((x) => B.rapat(petitum).includes(B.rapat(x.split(/\s+(?:bin|binti)\s+/i)[0])));
    return { saudara, anak, kalimat: b, dalamPetitum };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 8613 kematian suami/istri pewaris lebih dahulu
// ---------------------------------------------------------------------------
function kematianPasangan(butir) {
  for (const b of butir) {
    const m = /\b(?:Isteri|Istri|Suami)\s+(?:dari\s+)?(?:Alm[a-z]*\.?\s+)?(?:Pewaris\b|[A-Z][^()]{2,60}?)[^.;]{0,90}?\btelah\s+meninggal(?:\s+dunia)?\s+(?:lebih\s+(?:dulu|dahulu)|terlebih\s+dahulu)\s+(?:pada\s+)?(?:tanggal\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})(?:\s+di\s+([A-Z][^,;.]{2,50}?))?(?:\s+(?:karena|dikarenakan|disebabkan)\s+([^,;.]{3,60}?))?(?=\s+(?:sesuai|berdasarkan|yang|,|;|\.|$)|$)/i.exec(b);
    if (!m) continue;
    const iso = B.indonesiaKeIso(m[1]);
    if (!iso) continue;
    const tgl = B.isoKeIndonesia(iso);
    const nilai = `pada tanggal ${tgl}${m[2] ? ` di ${B.rapikanNama(m[2])}` : ""}${m[3] ? ` karena ${B.rapikanNama(m[3])}` : ""}`;
    return { nilai, kalimat: b };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4500 tujuan permohonan bukan pencairan dana
// ---------------------------------------------------------------------------
/** Huruf pertama kecil (frasa dipakai sesudah kata "untuk"), kecuali singkatan. */
const huruf = (t) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);

function tujuanLain(posita, petitum, butir) {
  const p = B.polos(petitum);
  let m = /\buntuk\s+keperluan\s+(?:hukum\s+)?(?:seperti\s+)?(.{8,260}?)(?=\s+(?:sebagai\s+berikut|yang\s+(?:terletak|berada))|\s*[:;]|\s+\d{1,2}\s*\.\s*(?:Menetapkan|Membebankan)|\s+(?:Menetapkan|Membebankan)\b|\s+SUBSID|$)/i.exec(p);
  if (m) return { nilai: huruf(B.rapikanNama(m[1]).replace(/[\s,;.]+$/, "")), kalimat: m[0], dari: "petitum" };
  for (const b of butir) {
    m = /\b(?:bermaksud|berkehendak|memerlukan|diperlukan|bertujuan)\b[^.;]{0,90}?\buntuk\s+((?:membayar|mengurus|menjual|melakukan|balik\s+nama|menyelesaikan|memproses)[^.;]{3,140})/i.exec(b);
    if (m) return { nilai: huruf(B.rapikanNama(m[1]).replace(/[\s,;.]+$/, "")), kalimat: b, dari: "posita" };
  }
  return null;
}

/**
 * Susunan untuk hitungan bagian dari penggolongan petitum (ahliWaris.golongkan). null bila belum terbaca penuh.
 */
function susunanUntukHitung(g, pewaris) {
  if (!g || !g.pewaris || !g.semua.length) return null;
  if (g.sisa.length) return null; // ada ahli waris yang belum tergolong: hitungan tidak dibuat
  const nm = pewaris || g.pewaris;
  if (!/\s(?:bin|binti)\s/i.test(` ${nm} `)) return null; // jenis kelamin pewaris tidak pasti
  const jelek = (n) => !/\s(?:bin|binti)\s/i.test(` ${n} `) || /\b(?:digantikan|sebagai|pengganti|alm|almarhum\w*|ahli\s+waris|yakni)\b/i.test(n);
  // jenis kelamin anak dan saudara menentukan bagian: nama tanpa bin/binti atau bertuliskan penjelasan tidak dihitung
  if ([...g.anak, ...g.saudara].some(jelek)) return null;
  if ([...g.pasangan, ...g.ayah, ...g.ibu].some((n) => /\b(?:digantikan|pengganti|yakni)\b/i.test(n))) return null;
  return {
    pewarisPerempuan: /\sbinti\s/i.test(` ${nm} `),
    pasangan: g.pasangan,
    anak: g.anak,
    ayah: g.ayah[0] || "",
    ibu: g.ibu[0] || "",
    saudara: g.saudara,
  };
}

/**
 * @param {{perkara: {posita: string, petitum: string}, pihak1?: object[]}} d  keluaran bacaData
 * @param {{pewaris?: string}} [opsi]
 * @returns {object[]} usulan (bentuk B.butir)
 */
function usulanLanjut(d, opsi = {}) {
  const posita = String((d.perkara && d.perkara.posita) || "");
  const petitum = String((d.perkara && d.perkara.petitum) || "");
  const butir = butirPosita(posita);
  const hasil = [];
  const ada = (kode, nilai, yakin, kalimat, catatan, kodePola) =>
    hasil.push(B.butir({ kode, nama: NAMA[kode], nilai, keyakinan: yakin, kalimat, asal: "posita-gugatan", catatan, kodePola }));

  const dana = AW.pencairanDana(petitum);
  if (!dana) {
    const t = tujuanLain(posita, petitum, butir);
    if (t) {
      ada("4500", t.nilai, "ragu", t.kalimat, t.dari === "petitum" ? "Frasa 'untuk keperluan ...' pada petitum; dipakai sesudah kata 'untuk' pada naskah." : "Tujuan dari kalimat posita; periksa dan ringkas menjadi satu frasa sesudah kata 'untuk'.", "u5-paw-4500-tujuan");
    }
  }
  const aa = anakAngkat(butir);
  if (aa) ada("4502", aa.nilai, "ragu", aa.kalimat, `Kalimat posita menyebut anak angkat pewaris${aa.berNama ? "" : " (nama belum terbaca)"}; anak angkat bukan ahli waris (Pasal 171 huruf c KHI) tetapi dapat memperoleh wasiat wajibah (Pasal 209 ayat (2)); periksa dan pilih sikap di isian 4505.`, "u5-paw-4502-angkat");
  const ws = wasiat(butir);
  if (ws) ada("4507", ws.nilai, "ragu", ws.kalimat, "Kalimat posita menyebut wasiat pewaris; periksa penerima dan bendanya (Pasal 195 KHI: sepertiga harta warisan kecuali semua ahli waris menyetujui).", "u5-paw-4507-wasiat");
  const ka = kerabatTakIslam(butir);
  if (ka) ada("4510", ka.nilai, "ragu", ka.kalimat, "Kalimat posita menyebut kerabat pewaris yang tidak beragama Islam; ahli waris harus beragama Islam (Pasal 171 huruf c KHI). Tulis nama dan hubungannya.", "u5-paw-4510-takislam");
  const kp = keadaanPerkawinan(butir);
  if (kp) {
    ada("4513", kp.nilai, "ragu", kp.kalimat, kp.nilai === "1" ? "Posita menyebut pewaris dan pasangannya berpisah. 1 = tetap ahli waris selama belum bercerai; pilihan hakim." : "Posita menyebut pewaris pernah bercerai. 2 = pasangan itu bukan ahli waris; pilihan hakim (periksa akta cerai dan masa iddah).", "u5-paw-4513-perkawinan");
  }
  const ps = penggantiSaudara(butir, petitum);
  if (ps) {
    // semua usulan lanjutan "ragu": belum ada pembanding isian petugas dalam jumlah memadai (gerbang otomatis berdasar, U6); silang dengan petitum dicatat
    const yakin = "ragu";
    const cat = "Posita menyebut saudara pewaris yang meninggal lebih dahulu dengan anak sebagai ahli waris pengganti (Pasal 185 KHI)" + (ps.dalamPetitum ? "; anak itu ada pada daftar ahli waris petitum (cocok dengan amar pada satu-satunya perkara 2025-2026 yang memuatnya)." : "; anak itu tidak ditemukan pada daftar ahli waris petitum - periksa.");
    ada("4540", ps.saudara, yakin, ps.kalimat, cat, "u5-paw-4540-saudara");
    ada("4541", ps.anak.join("; "), yakin, ps.kalimat, cat, "u5-paw-4541-keponakan");
  }
  const kpas = kematianPasangan(butir);
  if (kpas) ada("8613", kpas.nilai, "ragu", kpas.kalimat, "Kematian suami/istri pewaris terbaca dari posita (tanggal, tempat dan sebab bila disebut); lengkapi dari akta kematian.", "u5-paw-8613-pasangan");

  // bagian: hitungan KHI atas susunan yang terbaca penuh, tanpa pengganti saudara (tidak diatur otomatis)
  if (!ps) {
    const g = AW.golongkan({ petitum, posita, pewaris: opsi.pewaris, pihak1: d.pihak1 });
    const susunan = susunanUntukHitung(g, opsi.pewaris);
    if (susunan) {
      const h = FA.hitung(susunan);
      if (h.bagian.length && h.jumlah === "1/1") {
        const ket = `Hitungan KHI (${h.kasus}): ${h.rincian.join("; ")}. Hanya usulan; penentuan bagian adalah keputusan hakim.`;
        ada("4515", FA.teksBagian(h), "ragu", `Ahli waris menurut petitum: ${g.semua.join("; ")}`, ket, "u5-paw-4515-bagian");
      }
    }
  }
  return hasil;
}

module.exports = { usulanLanjut, butirPosita, anakAngkat, wasiat, kerabatTakIslam, keadaanPerkawinan, penggantiSaudara, kematianPasangan, tujuanLain, susunanUntukHitung, NAMA };
