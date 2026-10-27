"use strict";

/**
 * ============================================================================
 * SEBAB PERSELISIHAN UNTUK 5227 (ALASAN-ALASAN CERAI) - R2, 14 Okt 2026
 * ============================================================================
 *
 * Pembantu abtUsulanService (BUKAN modul per jenis di deteksi/index.js).
 *
 * Ciri lama (kamus alasan + abtKalimatBaku.frasaCiri) disusun dari perbuatan
 * SUAMI pada cerai gugat: nafkah, KDRT, judi, mabuk, selingkuh. Pada cerai
 * talak pelakunya ISTRI (Termohon), dan sebab yang diterangkan saksi lain
 * sama sekali - keluarga Termohon ikut campur, Termohon merendahkan atau
 * tidak menghargai Pemohon sebagai kepala keluarga, tidak taat, tidak mau
 * mendengar nasihat, keluar rumah tanpa izin, tidak pernah merasa cukup
 * dengan nafkah, tidak mau ikut suami. Akibatnya 5227 cerai talak hanya
 * berbunyi "terus-menerus terjadi perselisihan" tanpa sebab, atau - lebih
 * buruk - "Termohon melalaikan kewajiban nafkah lahir", padahal kewajiban
 * nafkah ada pada suami (Pasal 80 ayat (4) KHI).
 *
 * Pola dan frasanya DATA: kamus-deteksi/awal/sebab-cerai.json (+ lapis
 * database). Berkas ini hanya mesinnya:
 *
 *   1. per kalimat, pola yang berlaku untuk jenisnya (CT/CG/semua);
 *   2. tolak bila didahului penyangkal ("tidak pernah ...") - kecuali pola
 *      yang penyangkalnya bagian dari bunyinya ("tidak taat");
 *   3. SUBJEK KLAUSA: siapa yang berbuat menurut kalimatnya - pelaku (0047),
 *      keluarga pelaku, pelaku dan keluarganya, pihak lawan (0046), atau
 *      keduanya. "Yang biasa menjadi penyebab ... adalah karena Keluarga
 *      Termohon sering ikut campur ... dan sering merendahkan Pemohon"
 *      menjadikan KELUARGA Termohon pelaku keduanya;
 *   4. per sumber (saksi 1, saksi 2, posita) satu temuan per sebab;
 *   5. KEKUATAN: kedua saksi > satu saksi > hanya posita.
 *
 * Murni: tidak menulis, tidak membaca basis data.
 */

const kamus = require("../kamusDeteksi");

const SEBUTAN_PELAKU = new Set(["termohon", "tergugat"]);
const SEBUTAN_LAWAN = new Set(["pemohon", "penggugat"]);
const KELUARGA = "keluarga|orang\\s*tua|orangtua|mertua|ibu|ayah|bapak|saudara|kakak|adik|ipar|tante|paman|bibi";
const RE_KELUARGA = new RegExp(
  `\\b(${KELUARGA})(?:nya)?(?:\\s+kandung)?(?:\\s+(?:dari\\s+)?(pemohon|termohon|penggugat|tergugat))?\\b`,
  "gi"
);
// Pemisah klausa untuk mencari subjek. "dan" SENGAJA tidak memisah:
// "Keluarga Termohon sering ikut campur ... dan sering merendahkan Pemohon"
// - subjek "sering merendahkan" tetap keluarga Termohon.
const RE_PEMISAH =
  /[,;:.()]|\b(?:namun|tetapi|akan\s+tetapi|sedangkan|sehingga|karena|dikarenakan|disebabkan|adalah|yaitu|yakni|bahwa|selain\s+itu|kemudian|lalu|dimana|di\s+mana|bahkan|padahal|apabila|jika|ketika|saat|setelah|sejak|hingga|sampai)\b/gi;
// Pemisah yang menghentikan pencarian subjek ke klausa sebelumnya: sesudahnya
// kalimat berpindah pokok ("penyebab ... adalah karena X" - subjek "antara
// Pemohon dan Termohon" di depannya bukan subjek X).
const RE_PEMISAH_KUAT =
  /^(?:namun|tetapi|akan\s+tetapi|sedangkan|sehingga|karena|dikarenakan|disebabkan|adalah|yaitu|yakni|bahwa|dimana|di\s+mana|padahal|apabila|jika|ketika|saat|setelah|sejak|\.|:|\(|\))$/i;
const RE_PENGISI =
  /^(?:dan|serta|juga|ya|lalu|pun|karena|bahwa|seringkali|sering\s+kali|sering|selalu|kerap(?:\s+kali)?|terkadang|kadang(?:-kadang)?|yang\s+saya\s+(?:tahu|ketahui)|sepengetahuan\s+saya|setahu\s+saya|menurut\s+saya)\b[\s,]*/i;
const RE_PENYANGKAL = /\b(?:tidak|tak|bukan|belum|tanpa|jangan)\s+(?:pernah\s+)?(?:sampai\s+)?(?:\S+\s+)?$/i;

/** Jenis cerai dari sebutan pihak: CT bila pelaku Termohon dan lawan Pemohon. */
function jenisCerai(pihak) {
  const pelaku = String((pihak && pihak.pelaku) || "").trim().toLowerCase();
  const lawan = String((pihak && pihak.lawan) || "").trim().toLowerCase();
  return pelaku === "termohon" && lawan === "pemohon" ? "CT" : "CG";
}

function polaBerlaku(jenis) {
  return kamus
    .polaKelompok("sebab-cerai")
    .filter((p) => (p.status || "aktif") === "aktif" && (p.untuk === "semua" || p.untuk === jenis || !p.untuk))
    .sort((a, b) => (a.urutan || 0) - (b.urutan || 0) || (a.urut || 0) - (b.urut || 0));
}

/** Segmen klausa sebelum indeks `i`: [{teks, pemisah}] dari awal kalimat. */
function segmenSebelum(kalimat, i) {
  const depan = kalimat.slice(0, i);
  const hasil = [];
  let awal = 0;
  let pemisah = "";
  RE_PEMISAH.lastIndex = 0;
  for (const m of depan.matchAll(RE_PEMISAH)) {
    hasil.push({ teks: depan.slice(awal, m.index), pemisah });
    pemisah = m[0].trim();
    awal = m.index + m[0].length;
  }
  hasil.push({ teks: depan.slice(awal), pemisah });
  return hasil;
}

/**
 * Subjek di awal satu segmen klausa.
 * @returns {{s: "P"|"K"|"PK"|"L"|"KL"|"B"|"", kata?: string}}
 */
function subjekAwal(teks) {
  let t = String(teks || "").trim();
  for (let n = 0; n < 4; n++) {
    const sesudah = t.replace(RE_PENGISI, "");
    if (sesudah === t) break;
    t = sesudah.trim();
  }
  const kecil = t.toLowerCase();
  if (/^(?:antara\s+)?(?:pemohon|penggugat|termohon|tergugat)\s+(?:dan|dengan)\s+(?:pemohon|penggugat|termohon|tergugat)\b/.test(kecil)) {
    return { s: "B" };
  }
  const pk = /^(termohon|tergugat)\s+(?:dan|beserta|bersama)\s+(?:keluarga|orang\s*tua|orangtua)/.exec(kecil);
  if (pk) return { s: "PK" };
  const kel = new RegExp(`^(${KELUARGA})(?:nya)?(?:\\s+kandung)?(?:\\s+(?:dari\\s+)?(pemohon|termohon|penggugat|tergugat))?\\b`).exec(kecil);
  if (kel) return pemilikKeluarga(kel[1], kel[2]);
  const s = /^(pemohon|termohon|penggugat|tergugat)\b/.exec(kecil);
  if (s) return { s: SEBUTAN_PELAKU.has(s[1]) ? "P" : "L" };
  return { s: "" };
}

/** Keluarga milik siapa. "mertua Pemohon" = orang tua Termohon. */
function pemilikKeluarga(kata, pemilik) {
  const k = String(kata || "").toLowerCase().replace(/\s+/g, " ");
  const orangTua = /^(?:orang ?tua|orangtua|ibu|ayah|bapak)$/.test(k);
  if (!pemilik) return { s: "K", kata: orangTua ? "orang tua" : "keluarga" };
  const milikPelaku = SEBUTAN_PELAKU.has(pemilik);
  const sisiPelaku = k === "mertua" ? !milikPelaku : milikPelaku;
  return { s: sisiPelaku ? "K" : "KL", kata: k === "mertua" || orangTua ? "orang tua" : "keluarga" };
}

/**
 * Subjek perbuatan yang dimulai di indeks `i` kalimat: segmen klausa tepat
 * di depannya; bila segmen itu tanpa subjek, mundur ke segmen sebelumnya
 * sampai bertemu pemisah kuat (karena/adalah/namun ...).
 */
function subjekKlausa(kalimat, i) {
  const seg = segmenSebelum(kalimat, i);
  for (let n = seg.length - 1; n >= 0; n--) {
    const s = subjekSegmen(seg[n].teks);
    if (s.s) return s;
    if (RE_PEMISAH_KUAT.test(seg[n].pemisah)) break;
  }
  return subjekTerdekat(kalimat.slice(0, i));
}

/**
 * Cadangan: klausa perbuatannya tanpa subjek dan pemisah kuat menghentikan
 * pencarian ("Tergugat kurang memberi nafkah karena mengutamakan kepentingan
 * pribadinya, serta sering mengusir Penggugat"). Yang dipakai sebutan pihak
 * TERAKHIR di depan perbuatan yang bukan objek ("kepada Pemohon", "oleh
 * Termohon", "keluarga Pemohon") - dan bukan bagian "Pemohon dan Termohon".
 */
const RE_SEBUTAN = /\b(pemohon|termohon|penggugat|tergugat)\b/gi;
const RE_SEBELUM_OBJEK =
  /\b(?:kepada|terhadap|dengan|oleh|untuk|dari|pada|bagi|milik|antara|me\w+|di\w+|keluarga\w*|orang\s*tua\w*|ibu|ayah|bapak|anak|saudara|adik|kakak|ipar|mertua|teman)\s*$/i;
function subjekTerdekat(depan) {
  const semua = [...String(depan || "").matchAll(RE_SEBUTAN)];
  for (let n = semua.length - 1; n >= 0; n--) {
    const m = semua[n];
    const sebelum = depan.slice(0, m.index);
    const sesudah = depan.slice(m.index + m[0].length);
    if (/^\s*(?:dan|dengan|&)\s+(?:pemohon|termohon|penggugat|tergugat)\b/i.test(sesudah)) return { s: "B" };
    if (/\b(?:pemohon|termohon|penggugat|tergugat)\s+(?:dan|dengan|&)\s*$/i.test(sebelum)) return { s: "B" };
    if (RE_SEBELUM_OBJEK.test(sebelum)) continue;
    return { s: SEBUTAN_PELAKU.has(m[1].toLowerCase()) ? "P" : "L" };
  }
  return { s: "" };
}

/**
 * Subjek satu segmen. Anak kalimat bersambung "dan/serta" yang membuka
 * subjek baru ("... tidak dipatuhi dan Termohon sering marah ...") dibaca
 * dari belakang - tetapi sebutan TUNGGAL di antara dua "dan" adalah bagian
 * frasa benda ("urusan rumah tangga Pemohon dan Termohon dan sering
 * merendahkan"), bukan subjek baru.
 */
function subjekSegmen(teks) {
  const bagian = String(teks || "").split(/\b(?:dan|serta)\b/i);
  const kata = (x) => x.trim().split(/\s+/).filter(Boolean).length;
  for (let n = bagian.length - 1; n >= 1; n--) {
    const b = bagian[n].trim();
    // "Termohon dan keluarganya ..." - bagian sesudah sebutan tunggal adalah
    // lanjutan subjek majemuk itu, bukan subjek baru.
    if (kata(b) < 2 || kata(bagian[n - 1]) < 2) continue;
    const s = subjekAwal(b);
    if (s.s) return s;
  }
  return subjekAwal(teks);
}

/** Untuk subjek "keluarga": kata keluarga terakhir di klausa sebelum perbuatan ("membiarkan orang tuanya ikut campur"). */
function keluargaDiKlausa(kalimat, i) {
  const seg = segmenSebelum(kalimat, i);
  const teks = seg[seg.length - 1].teks;
  let akhir = null;
  RE_KELUARGA.lastIndex = 0;
  for (const m of teks.matchAll(RE_KELUARGA)) akhir = m;
  if (!akhir) return null;
  const kata = akhir[1].toLowerCase();
  // "keluarganya" - milik subjek klausanya.
  if (!akhir[2] && /nya\b/i.test(akhir[0])) {
    const sub = subjekAwal(teks);
    if (sub.s === "L") return pemilikKeluarga(kata, "pemohon");
    return pemilikKeluarga(kata, "termohon");
  }
  return pemilikKeluarga(kata, akhir[2] ? akhir[2].toLowerCase() : "");
}

/** Subjek yang diterima pola, atau "" bila ditolak. */
function terimaSubjek(pola, kalimat, i) {
  const jenis = String(pola.subjek || "pelaku");
  if (jenis === "bersama") return { s: "B" };
  if (jenis === "keluarga") {
    const kel = keluargaDiKlausa(kalimat, i);
    if (kel) return kel.s === "K" ? kel : { s: "" };
    const s = subjekKlausa(kalimat, i);
    return s.s === "K" || s.s === "PK" ? { s: "K", kata: s.kata || "keluarga" } : { s: "" };
  }
  const s = subjekKlausa(kalimat, i);
  if (jenis === "lawan-pasif") return s.s === "L" ? { s: "P" } : { s: "" };
  if (jenis === "pelaku/keluarga") return ["P", "K", "PK"].includes(s.s) ? s : { s: "" };
  return s.s === "P" || s.s === "PK" ? { s: "P" } : { s: "" };
}

/**
 * Temuan sebab dalam sekumpulan kalimat: Map kunci -> {pola, subjek, kalimat}.
 * Satu temuan per kunci - varian dengan `urut` terkecil (paling rinci) menang.
 */
function temuanSumber(butir, pihak) {
  const jenis = jenisCerai(pihak);
  const daftar = polaBerlaku(jenis);
  const hasil = new Map();
  for (const kalimatAsli of butir || []) {
    const kalimat = String(kalimatAsli || "").replace(/\s+/g, " ");
    if (!kalimat) continue;
    for (const p of daftar) {
      const lama = hasil.get(p.kunci);
      if (lama && (lama.pola.urut || 0) <= (p.urut || 0)) continue;
      const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : `${p.re.flags}g`);
      for (const m of kalimat.matchAll(re)) {
        const depan = kalimat.slice(0, m.index);
        if (p.negasi !== false && RE_PENYANGKAL.test(depan.slice(-40))) continue;
        if (p.tolakSebelum && new RegExp(p.tolakSebelum, "i").test(depan.slice(-30))) continue;
        if (p.tolakSesudah && new RegExp(p.tolakSesudah, "i").test(kalimat.slice(m.index + m[0].length))) continue;
        const sub = terimaSubjek(p, kalimat, m.index);
        if (!sub.s) continue;
        hasil.set(p.kunci, { pola: p, subjek: sub.s, kataKeluarga: sub.kata || "", kalimat: kalimatAsli });
        break;
      }
    }
  }
  return hasil;
}

/** Subjek gabungan dua saksi: irisan; bila tidak beririsan, milik yang lebih dulu. */
function subjekGabung(daftar) {
  const himpunan = (s) => (s === "PK" ? ["P", "K"] : [s]);
  const ada = daftar.filter(Boolean);
  if (!ada.length) return "P";
  let irisan = himpunan(ada[0]);
  for (const s of ada.slice(1)) irisan = irisan.filter((x) => himpunan(s).includes(x));
  if (irisan.length === 2) return "PK";
  if (irisan.length === 1) return irisan[0];
  return ada[0];
}

function isi(teks, pihak) {
  return String(teks || "")
    .split("{pelaku}")
    .join(pihak.pelaku)
    .split("{lawan}")
    .join(pihak.lawan);
}

/**
 * Sebab dari kedua saksi dan posita, berperingkat.
 *
 * @returns {{butir: Array<{kunci, frasa, subjek, subjekTeks, urutan, saksi1, saksi2, posita,
 *            tingkat: "kedua"|"satu"|"posita", kalimat: {saksi1, saksi2, posita}, kodePola,
 *            menutupiCiri: string[]}>, jenis: "CT"|"CG"}}
 */
function deteksi({ b1, b2, butirPosita, pihak }) {
  const ph = { pelaku: String((pihak && pihak.pelaku) || "Tergugat"), lawan: String((pihak && pihak.lawan) || "Penggugat") };
  const jenis = jenisCerai(ph);
  const t1 = temuanSumber(b1, ph);
  const t2 = temuanSumber(b2, ph);
  const tp = temuanSumber(butirPosita, ph);
  const kunci = [...new Set([...t1.keys(), ...t2.keys(), ...tp.keys()])];
  const butir = kunci.map((k) => {
    const a = t1.get(k);
    const b = t2.get(k);
    const c = tp.get(k);
    const ada = [a, b, c].filter(Boolean);
    // Varian paling rinci di antara sumber yang menyebutnya ("... sebagai kepala keluarga").
    const pilih = ada.reduce((x, y) => ((y.pola.urut || 0) < (x.pola.urut || 0) ? y : x));
    const saksi = [a, b].filter(Boolean);
    const subjek = subjekGabung((saksi.length ? saksi : [c]).map((x) => x.subjek));
    // "orang tua" hanya bila semua sumbernya berkata begitu; selain itu "keluarga" yang mencakupnya.
    const kataSemua = [...new Set((saksi.length ? saksi : [c]).map((x) => x.kataKeluarga).filter(Boolean))];
    const kataKeluarga = kataSemua.length === 1 ? kataSemua[0] : "keluarga";
    const p = pilih.pola;
    const subjekTeks = p.subjekTeks
      ? isi(p.subjekTeks, ph)
      : subjek === "K"
        ? `${kataKeluarga} ${ph.pelaku}`
        : subjek === "PK"
          ? `${ph.pelaku} dan keluarganya`
          : ph.pelaku;
    return {
      kunci: k,
      frasa: isi(p.frasa, ph),
      subjek: p.subjekTeks ? "B" : subjek,
      subjekTeks,
      urutan: Number(p.urutan) || 0,
      saksi1: Boolean(a),
      saksi2: Boolean(b),
      posita: Boolean(c),
      tingkat: a && b ? "kedua" : a || b ? "satu" : "posita",
      kalimat: { saksi1: a ? a.kalimat : "", saksi2: b ? b.kalimat : "", posita: c ? c.kalimat : "" },
      kodePola: p.kode,
      menutupiCiri: Array.isArray(p.menutupiCiri) ? p.menutupiCiri : [],
      pendamping: Boolean(p.pendamping),
    };
  });
  const bobot = { kedua: 0, satu: 1, posita: 2 };
  butir.sort((x, y) => bobot[x.tingkat] - bobot[y.tingkat] || Number(y.posita) - Number(x.posita) || x.urutan - y.urutan);
  return { butir, jenis };
}

/** "A", "A dan B", "A, B, dan C". */
function daftarDan(x) {
  if (x.length <= 1) return x.join("");
  if (x.length === 2) return `${x[0]} dan ${x[1]}`;
  return `${x.slice(0, -1).join(", ")}, dan ${x[x.length - 1]}`;
}

/**
 * Kalimat sebab (yang ditulis sesudah "... yang disebabkan"): butir sesubjek
 * digabung tanpa mengulang subjeknya, kelompok subjek berurutan menurut
 * butir terkuatnya, disambung ", serta".
 *
 *   keluarga Termohon sering ikut campur dalam urusan rumah tangga Pemohon
 *   dan Termohon dan sering merendahkan Pemohon sebagai kepala keluarga
 *
 * @param butir [{subjekTeks, frasa}] - sudah berurutan
 */
function susun(butir) {
  const kelompok = [];
  for (const b of butir || []) {
    if (!b || !b.frasa) continue;
    let k = kelompok.find((x) => x.subjek === b.subjekTeks);
    if (!k) {
      k = { subjek: b.subjekTeks, frasa: [] };
      kelompok.push(k);
    }
    if (!k.frasa.includes(b.frasa)) k.frasa.push(b.frasa);
  }
  const bagian = kelompok.map((k) => `${k.subjek} ${daftarDan(k.frasa)}`);
  if (bagian.length <= 1) return bagian.join("");
  return `${bagian.slice(0, -1).join(", ")}, serta ${bagian[bagian.length - 1]}`;
}

const NAMA_TINGKAT = { kedua: "kedua saksi", satu: "satu saksi", posita: "posita" };

function sumberButir(daftar) {
  const hasil = [];
  for (const b of daftar) {
    const k = b.kalimat || {};
    if (k.saksi1) hasil.push({ saksi: 1, kalimat: k.saksi1 });
    if (k.saksi2) hasil.push({ saksi: 2, kalimat: k.saksi2 });
    if (!k.saksi1 && !k.saksi2 && k.posita) hasil.push({ saksi: 0, asal: "posita", kalimat: k.posita });
    if (hasil.length >= 12) break;
  }
  return hasil;
}

/**
 * Memperluas 5227 dengan sebab dari deteksi() - dipanggil dariKeteranganSaksi
 * SESUDAH kalimat lama tersusun. Mengembalikan null bila kalimat lama tetap
 * dipakai (tidak ada sebab baru yang lebih kuat), atau usulan pengganti.
 *
 * Aturannya:
 *   1. Ada sebab baru yang diterangkan KEDUA saksi -> kalimat disusun dari
 *      sebab itu ditambah ciri lama yang sudah lolos (kedua saksi +
 *      didalilkan), keyakinan seperti kalimat lama dari kedua saksi.
 *   2. Tidak ada, dan kalimat lama kosong / hanya "terus-menerus terjadi
 *      perselisihan" / disusun dari posita -> sebab yang DIDALILKAN posita,
 *      yang dikuatkan satu saksi lebih dulu, berkeyakinan "ragu".
 *   3. Selain itu kalimat lama tetap - perilaku cerai gugat yang sudah
 *      diukur tidak berubah.
 * Sebab yang hanya diterangkan satu saksi dan tidak didalilkan tidak pernah
 * masuk kalimat (unus testis nullus testis) - disebut di catatan.
 *
 * @param o {ciri, ciriPositaPelaku, b1, b2, butirPosita, pihak, peta (frasa ciri),
 *           lama: {nilai, dariPosita, hanyaPerselisihan}}
 */
function perluas5227(o) {
  const ph = { pelaku: String((o.pihak && o.pihak.pelaku) || "Tergugat"), lawan: String((o.pihak && o.pihak.lawan) || "Penggugat") };
  const det = deteksi({ b1: o.b1, b2: o.b2, butirPosita: o.butirPosita, pihak: ph });
  const ct = det.jenis === "CT";
  const peta = o.peta || {};
  const tertutup = new Set(det.butir.flatMap((b) => b.menutupiCiri));
  const dariCiri = (daftar, tingkat) =>
    (daftar || [])
      .filter((c) => peta[c] && !peta[c].akibat && !tertutup.has(c) && !(ct && c === "tidak memberi nafkah"))
      .map((c) => ({
        kunci: c,
        frasa: isi(peta[c].frasa, ph),
        subjek: "P",
        subjekTeks: ph.pelaku,
        urutan: Number(peta[c].urutan) || 0,
        tingkat,
        posita: true,
        kalimat: {},
        kodePola: "",
      }));
  const bobot = { kedua: 0, satu: 1, posita: 2 };
  const urut = (a, b) => bobot[a.tingkat] - bobot[b.tingkat] || Number(b.posita) - Number(a.posita) || a.urutan - b.urutan;

  const baruKedua = det.butir.filter((b) => b.tingkat === "kedua");
  // W49 22 Okt: sebab PENDAMPING (mengucapkan talak/cerai, merusak barang) adalah
  // wujud pertengkaran, bukan pokok sebabnya. Sendirian ia tidak menggantikan
  // kalimat dari dalil posita; diukur atas 1.060 perkara cerai ber-BAS: tanpa
  // aturan ini 5227 "Tergugat bersikap temperamental serta berkata kasar" (dari
  // posita) berganti menjadi hanya "Tergugat mengucapkan kata talak atau cerai".
  const pokokKedua = baruKedua.filter((b) => !b.pendamping);
  const pendampingKedua = baruKedua.filter((b) => b.pendamping);
  const lamaDariSaksi = Boolean(o.lama && o.lama.nilai && !o.lama.hanyaPerselisihan && !o.lama.dariPosita);
  const sepihakLuar = det.butir.filter((b) => b.tingkat === "satu" && !b.posita);
  let butir;
  let mode;
  const pokokPositaAda =
    det.butir.some((b) => b.posita && b.tingkat !== "kedua" && !b.pendamping) || dariCiri(o.ciriPositaPelaku, "posita").length > 0;
  if (pokokKedua.length || (pendampingKedua.length && (lamaDariSaksi || !pokokPositaAda))) {
    butir = [...dariCiri(o.ciri, "kedua"), ...baruKedua].sort(urut);
    mode = "saksi";
  } else if (!lamaDariSaksi) {
    // Kalimat lama dari posita (dariPosita) hanya disusun ulang bila ada sebab baru;
    // kalimat lama yang kosong / hanya perselisihan juga memakai ciri posita lama.
    const cadangan = det.butir.filter((b) => b.posita && (b.tingkat !== "kedua" || b.pendamping));
    if (!cadangan.length && o.lama && o.lama.dariPosita) return null;
    butir = [...cadangan, ...dariCiri(o.ciriPositaPelaku, "posita")].sort(urut);
    if (!butir.length) return null;
    mode = "posita";
  } else {
    return null;
  }
  // Hanya ciri lama (tanpa sebab baru): bentuk kalimat lama dipertahankan.
  const hanyaCiriLama = butir.every((b) => !b.kodePola);
  const akibatPosita = (o.ciriPositaPelaku || []).filter((c) => peta[c] && peta[c].akibat);
  const nilai =
    hanyaCiriLama && typeof o.susunLama === "function" ? o.susunLama([...butir.map((b) => b.kunci), ...akibatPosita]) : susun(butir);
  if (!nilai) return null;
  const ditulis = (b) => `${b.subjekTeks} ${b.frasa}`;
  const catatan = [];
  if (mode === "posita") {
    catatan.push(
      `Sebab disusun dari dalil posita${butir.some((b) => b.tingkat === "satu") ? " yang dikuatkan satu saksi" : ""} - belum diterangkan kedua saksi; periksa sebelum diinput.`
    );
  }
  const lain = det.butir.filter((b) => !butir.includes(b) && b.tingkat !== "posita");
  if (lain.length) {
    catatan.push(
      `Hanya diterangkan satu saksi (tidak dimasukkan): ${lain
        .map((b) => `${ditulis(b)} (saksi ${b.saksi1 ? 1 : 2}${b.posita ? ", juga didalilkan" : ""})`)
        .join("; ")}.`
    );
  }
  return {
    nilai,
    keyakinan: mode === "saksi" ? "pasti" : "ragu",
    dariPosita: mode === "posita",
    catatan: catatan.join(" "),
    sumber: sumberButir(butir),
    kodePola: (butir.find((b) => b.kodePola) || {}).kodePola || "",
    tertutup: [...tertutup],
    butir: det.butir.map((b) => ({
      sebab: b.kunci,
      kalimat: ditulis(b),
      kekuatan: NAMA_TINGKAT[b.tingkat],
      didalilkan: b.posita,
      dipakai: butir.includes(b),
      kodePola: b.kodePola,
    })),
    sepihakLuar: sepihakLuar.length,
  };
}

module.exports = { deteksi, susun, perluas5227, jenisCerai, temuanSumber, subjekKlausa, terimaSubjek, RE_PENYANGKAL };
