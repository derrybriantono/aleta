"use strict";

/**
 * ============================================================================
 * RINCIAN ALASAN CERAI (5227) - SEBAB KONKRET DAN RANTAI SEBAB-AKIBAT, 27 Okt 2026
 * ============================================================================
 *
 * Keputusan pengguna:
 *   1. GUGATAN/permohonan = ACUAN UTAMA: hanya alasan yang ada di sana yang diusulkan.
 *   2. Keterangan saksi Penggugat DAN Tergugat = PENGUAT (lencana "dikuatkan saksi" + siapa);
 *      yang disebut saksi tetapi tidak didalilkan TIDAK diusulkan (hanya dicatat).
 *   3. Jawab-menjawab (jawaban/replik/duplik) = MINOR: hanya keterangan "diakui/dibantah";
 *      tidak pernah memunculkan alasan baru.
 *   4. Bunyi keluaran menyebut SEBAB KONKRET beserta rantai sebab-akibatnya seperti di gugatan
 *      ("Tergugat malas bekerja sehingga Tergugat kurang memberikan nafkah kepada Penggugat").
 *      "Perselisihan terus-menerus" hanya penutup bila memang didalilkan - tidak pernah
 *      menggantikan sebab konkret.
 *
 * Pola & bunyi = DATA (kamus-deteksi/awal/alasan-rincian.json + lapis database; ruas tambahan
 * `bunyi`, `peran`, `subjek`, `untuk`, `urut`, `tanpaSubjek`, `kutip`, `hanyaAkibat`). Berkas ini
 * hanya mesinnya. Murni: tidak menulis, tidak membaca basis data, tanpa kueri tambahan.
 *
 * Kinerja: pola diolah SEKALI per (versi lapis kamus, jenis cerai) dan disimpan; satu kalimat
 * diperiksa hanya bila lolos saringan kata kunci gabungan.
 */

const kamus = require("../kamusDeteksi");
const sebab = require("./sebabCerai");

const KELOMPOK = "alasan-rincian";
const BATAS_KALIMAT = 600; // potongan teks per kalimat yang dipindai (hindari regex pada teks raksasa)
const BATAS_KUTIPAN = 140;

// Penghubung antar simpul dalam satu kalimat.
const RE_AKIBAT = /\b(?:sehingga|hingga|akibatnya|sampai[\s-]*sampai|yang\s+(?:me)?nyebabkan|yang\s+mengakibatkan|yang\s+berakibat|menyebabkan|mengakibatkan|berujung|mengakibatkan|maka\s+dari\s+itu)\b/i;
const RE_KONDISI = /\b(?:bila|jika|apabila|kalau|ketika|saat)\b/i;
const RE_SEBAB = /\b(?:karena|dikarenakan|disebabkan|lantaran|akibat\s+dari)\b/i;
// Akhir klausa akibat yang dikutip dari gugatan.
const RE_AKHIR_KLAUSA = /[;.]|,\s+(?:dan|serta|sedangkan|namun|bahkan|selain|tetapi|sementara)\b|\s+dan\s+(?:tergugat|termohon|penggugat|pemohon|keluarga)\b|,\s+(?:tergugat|termohon)\b/i;
// Akibat yang bukan sebab konkret (kesimpulan).
const RE_BUKAN_SEBAB = /\b(?:bercerai|perceraian|gugatan|permohonan|pengadilan|dipertahankan|tidak\s+(?:dapat|bisa|mungkin)\s+(?:lagi\s+)?(?:rukun|bersatu|hidup)|rumah\s+tangga\s+(?:tidak|sudah|telah)|petitum)\b/i;
// Kutipan norma (Pasal 19 PP 9/1975 / Pasal 116 KHI) di gugatan bukan dalil perbuatan pihak: "salah satu pihak berbuat zina
// atau menjadi pemabuk, pemadat, penjudi ..." tidak boleh menyalakan zina/mabuk/narkoba/judi.
const RE_NORMA = /salah\s+satu\s+pihak\s+(?:berbuat|melakukan|mendapat|meninggalkan|menjadi)|menjadi\s+pemabuk,\s*pemadat/i;
const RE_BANTAH = /\b(?:tidak\s+benar|tidak\s+(?:sesuai|betul)|membantah|bantah|menyangkal|menolak\s+(?:dalil|dengan\s+tegas)|bohong|fitnah|mengada[\s-]*ada|dalil\s+(?:yang\s+)?(?:tidak|keliru))\b/i;
const RE_AKUI = /\b(?:membenarkan|mengakui|diakui|benar\s+(?:bahwa|adanya)|memang|betul|tidak\s+membantah)\b/i;

let cache = { versi: -1, jenis: {} };

/** Pola aktif untuk satu jenis cerai, siap pakai (RegExp global + saringan gabungan). Dibangun sekali per versi lapis. */
function polaUntuk(jenis) {
  const v = kamus.versi();
  if (cache.versi !== v) cache = { versi: v, jenis: {} };
  if (cache.jenis[jenis]) return cache.jenis[jenis];
  const daftar = kamus
    .polaKelompok(KELOMPOK)
    .filter((p) => (p.status || "aktif") === "aktif" && Array.isArray(p.bunyi) && p.bunyi.length && (!p.untuk || p.untuk === "semua" || p.untuk === jenis))
    .map((p) => ({
      ...p,
      reG: new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : `${p.re.flags}g`),
      // Penolak konteks (ruas tambahan `tolakSebelum` / `tolakSesudah`): dikompilasi sekali di sini.
      reTolakSebelum: p.tolakSebelum ? new RegExp(String(p.tolakSebelum), "i") : null,
      reTolakSesudah: p.tolakSesudah ? new RegExp(String(p.tolakSesudah), "i") : null,
    }))
    .sort((a, b) => (a.urut || 0) - (b.urut || 0));
  // Saringan gabungan: satu RegExp "gabungan semua pola" - kalimat yang tidak lolos dilewati sekaligus.
  let gabungan = null;
  try {
    gabungan = daftar.length ? new RegExp(daftar.map((p) => `(?:${p.re.source})`).join("|"), "i") : null;
  } catch (_) {
    gabungan = null;
  }
  // Saringan bergrup: tiap pola satu grup tangkap; pencocokan tahu POLA mana yang kena dalam satu lintasan
  // (dipakai mendata sebab yang disebut saksi tetapi tidak didalilkan, tanpa memindai pola satu per satu).
  const offset = [];
  let gabunganG = null;
  try {
    let n = 0;
    const bagian = daftar.map((p) => {
      offset.push(n + 1);
      n += 1 + (new RegExp(`${p.re.source}|`).exec("").length - 1);
      return `(${p.re.source})`;
    });
    gabunganG = bagian.length ? new RegExp(bagian.join("|"), "gi") : null;
  } catch (_) {
    gabunganG = null;
  }
  const perKunci = new Map();
  for (const p of daftar) {
    if (!perKunci.has(p.kunci)) perKunci.set(p.kunci, []);
    perKunci.get(p.kunci).push(p);
  }
  const hasil = { daftar, gabungan, gabunganG, offset, perKunci };
  cache.jenis[jenis] = hasil;
  return hasil;
}

function pihakDari(pihak) {
  return {
    pelaku: String((pihak && pihak.pelaku) || "").trim() || "Tergugat",
    lawan: String((pihak && pihak.lawan) || "").trim() || "Penggugat",
  };
}

function isiBunyi(teks, ph, jenis) {
  return String(teks || "")
    .split("{pelaku}")
    .join(ph.pelaku)
    .split("{lawan}")
    .join(ph.lawan)
    .split("{lain}")
    .join(jenis === "CT" ? "laki-laki lain" : "perempuan lain");
}

/**
 * Simpul (kemunculan sebab/akibat) dalam satu kalimat. Satu simpul per kunci - kemunculan paling awal;
 * bila sama, varian berurut terkecil (paling rinci).
 * @returns {Array<{kunci, pola, idx, akhir, subjek, kata, tersirat}>}
 */
function simpulKalimat(kalimatAsli, set, opsi) {
  const kalimat = String(kalimatAsli || "").replace(/\s+/g, " ").slice(0, BATAS_KALIMAT);
  if (!kalimat || !set.gabungan) return [];
  if (!(opsi && opsi.kunci) && !set.gabungan.test(kalimat)) return [];
  if (RE_NORMA.test(kalimat)) return [];
  const longgarNegasi = Boolean(opsi && opsi.longgarNegasi);
  const terbaik = new Map();
  const sumberPola = opsi && opsi.kunci ? [...opsi.kunci].flatMap((k) => set.perKunci.get(k) || []) : set.daftar;
  for (const p of sumberPola) {
    const re = p.reG;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(kalimat)) !== null) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      const depan = kalimat.slice(Math.max(0, m.index - 40), m.index);
      const ternegasi = p.negasi !== false && sebab.RE_PENYANGKAL.test(depan);
      if (ternegasi && !longgarNegasi) continue;
      if (p.reTolakSebelum && p.reTolakSebelum.test(depan)) continue;
      if (p.reTolakSesudah && p.reTolakSesudah.test(kalimat.slice(m.index + m[0].length, m.index + m[0].length + 40))) continue;
      let sub = sebab.terimaSubjek(p, kalimat, m.index);
      let tersirat = false;
      if (!sub.s) {
        // Tanpa pelaku yang terbaca sama sekali ("Sering mabuk-mabukan dan memukul Penggugat") dibaca
        // sebagai perbuatan pelaku, bertanda tersirat (keyakinan ragu).
        const jenisSubjek = String(p.subjek || "pelaku");
        if (jenisSubjek === "pelaku" || jenisSubjek === "pelaku/keluarga") {
          if (!sebab.subjekKlausa(kalimat, m.index).s) {
            sub = { s: "P" };
            tersirat = true;
          }
        }
      }
      if (!sub.s) continue;
      const lama = terbaik.get(p.kunci);
      if (!lama || m.index < lama.idx || (m.index === lama.idx && (p.urut || 0) < (lama.pola.urut || 0))) {
        terbaik.set(p.kunci, { kunci: p.kunci, pola: p, teks: m[0], idx: m.index, akhir: m.index + m[0].length, subjek: sub.s, kata: sub.kata || "", tersirat, ternegasi });
      }
      break; // kemunculan pertama yang diterima cukup untuk pola ini
    }
  }
  return [...terbaik.values()].sort((a, b) => a.idx - b.idx);
}

function subjekTeks(simpul, ph) {
  const p = simpul.pola;
  if (p.tanpaSubjek || simpul.subjek === "B") return "";
  if (simpul.subjek === "K") return `${simpul.kata || "keluarga"} ${ph.pelaku}`;
  if (simpul.subjek === "PK") return `${ph.pelaku} dan keluarganya`;
  return ph.pelaku;
}

function bersihkanKutipan(teks) {
  let t = String(teks || "").replace(/^[\s,:;-]+/, "").replace(/^(?:bahwa|yaitu|yakni)\s+/i, "").replace(/[\s,;:.]+$/, "").trim();
  t = t.split(RE_AKHIR_KLAUSA)[0].replace(/[\s,;:.]+$/, "").trim();
  return t;
}

/** Klausa akibat yang dikutip: teks sesudah penghubung sampai akhir klausa. */
const RE_KUTIPAN_WAKTU = /^(?:sekarang|saat\s+(?:ini|itu)|sejak|kini|pada|hingga|sampai|namun|tetapi|dan|serta|yang|di|ke|dengan|oleh|hal|akhirnya)\b/i;
const RE_KUTIPAN_PUTUS = /\b(?:namun|tetapi|akan\s+tetapi|padahal)\b/i;
const RE_PIHAK = /\b(penggugat|tergugat|pemohon|termohon)\b/gi;
function kutipanSesudah(kalimat, dari) {
  let t = bersihkanKutipan(kalimat.slice(dari, dari + BATAS_KUTIPAN + 60));
  t = t.split(RE_KUTIPAN_PUTUS)[0].replace(/[\s,;:.]+$/, "").trim();
  if (t.length < 12 || t.length > BATAS_KUTIPAN) return "";
  if (RE_BUKAN_SEBAB.test(t) || RE_KUTIPAN_WAKTU.test(t)) return "";
  if (!/^[a-z]/i.test(t) || t.split(/\s+/).length < 3) return "";
  // Sebutan pihak ditulis baku (Penggugat/Tergugat/Pemohon/Termohon).
  return t.replace(RE_PIHAK, (x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase());
}

/** Penghubung antara dua simpul bersebelahan: {jenis: "akibat"|"kondisi"|"sebab", dari, sampai} atau null. */
function hubungan(kalimat, a, b) {
  const antara = kalimat.slice(a.akhir, b.idx);
  if (antara.length > 160) return null;
  let m = RE_AKIBAT.exec(antara);
  if (m) return { jenis: "akibat", sampai: a.akhir + m.index + m[0].length };
  m = RE_SEBAB.exec(antara);
  if (m) return { jenis: "sebab", sampai: a.akhir + m.index + m[0].length };
  m = RE_KONDISI.exec(antara);
  // "bila mabuk memukul": akibat harus perbuatan berpelaku (bukan keadaan/penutup), antaranya pendek.
  if (m && !/[;.]/.test(antara) && antara.length <= 60 && (b.pola.peran || "sebab") === "sebab" && !b.pola.tanpaSubjek && !b.pola.hanyaAkibat) {
    return { jenis: "kondisi", sampai: a.akhir + m.index + m[0].length };
  }
  return null;
}

/** Penghubung akibat sesudah simpul `a` yang tidak diikuti simpul lain (akibat bebas, dikutip). */
function akibatBebas(kalimat, a, berikut) {
  const batas = berikut ? berikut.idx : kalimat.length;
  const antara = kalimat.slice(a.akhir, batas);
  const m = RE_AKIBAT.exec(antara);
  if (!m) return null;
  const mulai = a.akhir + m.index + m[0].length;
  const teks = kutipanSesudah(kalimat, mulai);
  return teks ? { teks } : null;
}

function klausa(simpul, ph, jenis, varian, kutipan) {
  const p = simpul.pola;
  if (kutipan) return kutipan;
  const bunyi = p.bunyi[Math.min(varian, p.bunyi.length - 1)];
  const isi = isiBunyi(bunyi, ph, jenis);
  const sub = subjekTeks(simpul, ph);
  return sub ? `${sub} ${isi}` : isi;
}

/**
 * Item rincian dari satu kalimat gugatan: simpul-simpul yang berkait menjadi RANTAI, sisanya TUNGGAL.
 * @returns {Array<{jenis, simpul: object[], hubungan: string[], kutipan: string[], kalimat: string}>}
 */
function itemKalimat(kalimatAsli, set) {
  const kalimat = String(kalimatAsli || "").replace(/\s+/g, " ").slice(0, BATAS_KALIMAT);
  const simpul = simpulKalimat(kalimat, set);
  if (!simpul.length) return [];
  // Sambungan sebab -> akibat antar simpul berurutan; orientasi dinormalkan (cause -> effect).
  const berikut = new Map(); // idx simpul sebab -> {ke, jenis}
  const punyaMasuk = new Set();
  for (let i = 0; i + 1 < simpul.length; i++) {
    const h = hubungan(kalimat, simpul[i], simpul[i + 1]);
    if (!h) continue;
    const [sebabIdx, akibatIdx] = h.jenis === "sebab" ? [i + 1, i] : [i, i + 1];
    if (berikut.has(sebabIdx) || punyaMasuk.has(akibatIdx)) continue;
    // "hanyaAkibat"/"penutup" tidak boleh menjadi sebab.
    const peranSebab = simpul[sebabIdx].pola.peran || "sebab";
    if (peranSebab !== "sebab") continue;
    // Kutipan akibat hanya bermakna bila akibatnya MENYUSUL penghubung (arah maju).
    const tambahan = [];
    // "A sehingga B dan C": C juga akibat A (bukan rantai B -> C) bila hanya "dan/serta" yang menyambungnya.
    const c = simpul[akibatIdx + 1];
    if (h.jenis === "akibat" && c && !punyaMasuk.has(akibatIdx + 1) && (c.pola.peran || "sebab") === "sebab" && /^(?:\s+[^\s,;.]+){0,2}[\s,]*(?:dan|serta)\s+(?:juga\s+)?$/i.test(kalimat.slice(simpul[akibatIdx].akhir, c.idx))) {
      tambahan.push(akibatIdx + 1);
      punyaMasuk.add(akibatIdx + 1);
    }
    berikut.set(sebabIdx, { ke: akibatIdx, tambahan, jenis: h.jenis === "sebab" ? "akibat" : h.jenis, sampai: h.jenis === "sebab" ? -1 : h.sampai });
    punyaMasuk.add(akibatIdx);
  }
  const dipakai = new Set();
  const hasil = [];
  for (let i = 0; i < simpul.length; i++) {
    if (punyaMasuk.has(i) || !berikut.has(i)) continue;
    const rantai = [i];
    const hub = [];
    const kutip = [];
    let kini = i;
    while (berikut.has(kini)) {
      const e = berikut.get(kini);
      hub.push(e.jenis);
      const s = simpul[e.ke];
      // Simpul akibat berkutip: klausanya dikutip dari gugatan (lebih tepat daripada bunyi umum).
      kutip.push(s.pola.kutip && e.sampai >= 0 ? kutipanSesudah(kalimat, e.sampai) : "");
      rantai.push(e.ke);
      for (const x of e.tambahan || []) {
        hub.push("dan");
        kutip.push("");
        rantai.push(x);
      }
      kini = e.ke;
    }
    rantai.forEach((x) => dipakai.add(x));
    // Akibat bebas di ujung rantai: "... sehingga uang belanja habis" yang bukan simpul kamus.
    hasil.push({ jenis: "rantai", simpul: rantai.map((x) => simpul[x]), hubungan: hub, kutipan: kutip, kalimat: kalimatAsli });
  }
  for (let i = 0; i < simpul.length; i++) {
    if (dipakai.has(i)) continue;
    const s = simpul[i];
    const peran = s.pola.peran || "sebab";
    if (s.pola.hanyaAkibat || peran === "akibat") continue;
    const bebas = peran === "sebab" ? akibatBebas(kalimat, s, simpul[i + 1] && !dipakai.has(i + 1) ? simpul[i + 1] : null) : null;
    if (bebas) {
      hasil.push({ jenis: "rantai", simpul: [s], hubungan: ["akibat"], kutipan: [bebas.teks], kalimat: kalimatAsli, akibatBebas: true });
    } else {
      hasil.push({ jenis: "tunggal", simpul: [s], hubungan: [], kutipan: [], kalimat: kalimatAsli });
    }
  }
  return hasil;
}

const SAMBUNG = { akibat: "sehingga", kondisi: "dan apabila dalam keadaan demikian", sebab: "sehingga", dan: "dan" };

/** Satu klausa item pada varian bunyi tertentu. */
function bunyiItem(item, ph, jenis, varian) {
  const bagian = [];
  item.simpul.forEach((s, i) => {
    if (i === 0) {
      bagian.push(klausa(s, ph, jenis, varian, ""));
      return;
    }
    bagian.push(SAMBUNG[item.hubungan[i - 1]] || "sehingga");
    const kutipan = item.kutipan[i - 1] || "";
    bagian.push(klausa(s, ph, jenis, varian, kutipan));
  });
  // Akibat bebas (bukan simpul kamus): klausa kutipan ditempel di ujung.
  if (item.akibatBebas) {
    bagian.push(SAMBUNG.akibat);
    bagian.push(item.kutipan[0]);
  }
  return bagian.join(" ");
}

/** Bunyi tanpa hubungan sebab-akibat (ringkas): perbuatan sebab saja. */
function bunyiRingkas(item, ph, jenis) {
  const sebabSaja = item.simpul.filter((s) => (s.pola.peran || "sebab") === "sebab");
  const pakai = sebabSaja.length ? sebabSaja : item.simpul;
  return pakai.map((s) => klausa(s, ph, jenis, 0, "")).join(" serta ");
}

/** Klausa penutup (perselisihan) di ujung rantai pada varian k, bila simpul terakhirnya penutup. */
function penutupAkhir(item, ph, jenis, k) {
  const akhir = item.simpul[item.simpul.length - 1];
  if (item.simpul.length < 2 || (akhir.pola.peran || "sebab") !== "penutup" || item.hubungan[item.hubungan.length - 1] === "dan") return null;
  const inti = { ...item, simpul: item.simpul.slice(0, -1), hubungan: item.hubungan.slice(0, -1), kutipan: item.kutipan.slice(0, -1) };
  return { inti: bunyiItem(inti, ph, jenis, k), penutup: klausa(akhir, ph, jenis, k, "") };
}

function daftarBunyi(item, ph, jenis) {
  const maks = Math.max(...item.simpul.map((s) => s.pola.bunyi.length));
  const hasil = [];
  const lihat = new Set();
  for (let k = 0; k < Math.min(maks, 3); k++) {
    const nilai = bunyiItem(item, ph, jenis, k);
    if (!nilai || lihat.has(nilai)) continue;
    lihat.add(nilai);
    hasil.push({ keadaan: k === 0 ? "baku" : `alternatif ${k}`, nilai });
  }
  if (item.jenis === "rantai") {
    const ringkas = bunyiRingkas(item, ph, jenis);
    if (ringkas && !lihat.has(ringkas)) hasil.push({ keadaan: "tanpa hubungan sebab-akibat", nilai: ringkas });
  }
  return hasil;
}

/** Per varian: [{inti, penutup}] bila rantai berakhir pada penutup (untuk menggabung beberapa rantai). */
function daftarPenutup(item, ph, jenis) {
  const hasil = [];
  for (let k = 0; k < 3; k++) hasil.push(penutupAkhir(item, ph, jenis, k));
  return hasil.some(Boolean) ? hasil : null;
}

function kunciItem(item) {
  return item.simpul.map((s) => `${s.kunci}|${s.subjek}${s.kata ? `:${s.kata}` : ""}`).join(">");
}

/**
 * Kunci saksi: kunci sebab yang disebut tiap saksi (dengan subjek yang diterima).
 * @returns {Map<number, Set<string>>}
 */
function kunciSaksi(saksi, set, kunciGugatan) {
  const peta = new Map();
  for (const s of saksi || []) {
    const him = new Set();
    for (const b of s.butir || []) for (const sm of simpulKalimat(b, set, { kunci: kunciGugatan })) him.add(sm.kunci);
    peta.set(s.no, him);
  }
  return peta;
}

/** Kunci sebab yang DISEBUT saksi (satu lintasan, tanpa uji subjek) - hanya untuk catatan "tidak didalilkan". */
function kunciDisebut(saksi, set) {
  const hasil = new Map(); // kunci -> Set nomor saksi
  const g = set.gabunganG;
  if (!g) return hasil;
  for (const s of saksi || []) {
    for (const b of s.butir || []) {
      const kal = String(b || "").slice(0, BATAS_KALIMAT);
      if (!kal) continue;
      g.lastIndex = 0;
      let m;
      while ((m = g.exec(kal)) !== null) {
        if (m[0] === "") {
          g.lastIndex++;
          continue;
        }
        let i = set.offset.length - 1;
        while (i > 0 && m[set.offset[i]] === undefined) i--;
        const p = set.daftar[i];
        if (sebab.RE_PENYANGKAL.test(kal.slice(Math.max(0, m.index - 40), m.index)) && !/^(?:tidak|tak|belum)\b/i.test(m[0])) continue;
        if (!hasil.has(p.kunci)) hasil.set(p.kunci, new Set());
        hasil.get(p.kunci).add(s.no);
      }
    }
  }
  return hasil;
}

function namaSaksi(s, ph) {
  if (s.pihak === "penggugat") return `saksi ${ph.lawan}`;
  if (s.pihak === "tergugat") return `saksi ${ph.pelaku}`;
  return `saksi ${s.no}`;
}

/** Keadaan dukungan saksi untuk satu item. */
function dukungan(item, saksi, petaSaksi, ph) {
  const inti = item.simpul.filter((s) => (s.pola.peran || "sebab") === "sebab");
  const nilai = inti.length ? inti : item.simpul;
  const periksa = saksi.filter((s) => (s.butir || []).length);
  const mendukung = periksa.filter((s) => nilai.every((n) => petaSaksi.get(s.no) && petaSaksi.get(s.no).has(n.kunci)));
  // Rantai: simpul inti saja yang diperiksa; satu saksi yang menyebut sebabnya tanpa akibat tetap menguatkan sebabnya.
  return { diperiksa: periksa.length, mendukung: mendukung.map((s) => ({ no: s.no, pihak: s.pihak || "", nama: namaSaksi(s, ph) })) };
}

function lencana(d, jawab) {
  let teks;
  let yakin;
  if (!d.diperiksa) {
    teks = "dari gugatan - saksi belum diperiksa";
    yakin = "ragu";
  } else if (d.mendukung.length >= 2) {
    teks = `dikuatkan kedua saksi (${d.mendukung.map((x) => x.nama).join(" dan ")})`;
    yakin = "cukup";
  } else if (d.mendukung.length === 1) {
    teks = `dikuatkan satu saksi (${d.mendukung[0].nama})`;
    yakin = "ragu";
  } else {
    teks = "dari gugatan - belum dikuatkan saksi";
    yakin = "ragu";
  }
  if (jawab) teks += `; ${jawab.status === "dibantah" ? "dibantah dalam" : jawab.status === "diakui" ? "diakui dalam" : "disebut dalam"} ${jawab.jenis}`;
  return { teks, yakin };
}

/** Jawab-menjawab: hanya keterangan atas item yang SUDAH ada dari gugatan. */
function keteranganJawab(items, jawab, set) {
  const hasil = new Map();
  for (const doc of jawab || []) {
    for (const b of doc.butir || []) {
      const sm = simpulKalimat(b, set, { longgarNegasi: true });
      if (!sm.length) continue;
      const kunci = new Set(sm.map((x) => x.kunci));
      for (const it of items) {
        const ada = it.simpul.some((s) => kunci.has(s.kunci));
        if (!ada) continue;
        const bantah = RE_BANTAH.test(b) || sm.some((x) => x.ternegasi && !/^(?:tidak|tak|belum)\b/i.test(x.pola.re.exec(b) ? x.pola.re.exec(b)[0] : ""));
        const status = bantah ? "dibantah" : RE_AKUI.test(b) ? "diakui" : "disebut";
        const lama = hasil.get(it.id);
        const bobot = { disebut: 0, diakui: 1, dibantah: 2 };
        if (!lama || bobot[status] > bobot[lama.status]) hasil.set(it.id, { status, jenis: doc.jenis || "jawaban", kalimat: String(b).slice(0, 300) });
      }
    }
  }
  return hasil;
}

/**
 * @param o.gugatan {string[]}  butir gugatan/posita (acuan utama)
 * @param o.saksi   {Array<{no:number, pihak?:"penggugat"|"tergugat"|"", butir:string[]}>}
 * @param o.jawab   {Array<{jenis:string, butir:string[]}>} jawaban/replik/duplik (minor)
 * @param o.pihak   {{pelaku:string, lawan:string}}
 */
function deteksiRincian(o) {
  const ph = pihakDari(o && o.pihak);
  const jenis = sebab.jenisCerai(ph);
  const set = polaUntuk(jenis);
  const saksi = (o && o.saksi) || [];
  const gugatan = (o && o.gugatan) || [];
  const hasil = { jenis, butir: [], diLuarGugatan: [], bacaGugatan: gugatan.length > 0 };
  if (!set.daftar.length || !gugatan.length) return hasil;

  const peta = new Map();
  for (const k of gugatan) {
    for (const it of itemKalimat(k, set)) {
      const id = kunciItem(it);
      const lama = peta.get(id);
      if (!lama) {
        it.id = id;
        peta.set(id, it);
      } else if (it.kutipan.some(Boolean) && !lama.kutipan.some(Boolean)) {
        it.id = id;
        peta.set(id, it);
      }
    }
  }
  let items = [...peta.values()];
  // Tunggal yang sudah menjadi bagian rantai tidak ditampilkan lagi.
  const dalamRantai = new Set();
  for (const it of items) if (it.jenis === "rantai") for (const s of it.simpul) dalamRantai.add(`${s.kunci}|${s.subjek}${s.kata ? `:${s.kata}` : ""}`);
  items = items.filter((it) => it.jenis === "rantai" || !dalamRantai.has(kunciItem(it)));
  // Penutup (perselisihan) hanya satu dan paling akhir.
  const penutup = items.filter((it) => it.simpul.length === 1 && (it.simpul[0].pola.peran || "sebab") === "penutup");
  const badan = items.filter((it) => !penutup.includes(it));
  const rantaiBerakhirPenutup = badan.some((it) => it.jenis === "rantai" && (it.simpul[it.simpul.length - 1].pola.peran || "sebab") === "penutup");
  const penutupSatu = penutup.length && !rantaiBerakhirPenutup ? [penutup[0]] : [];
  items = [...badan, ...penutupSatu];

  const kunciGugatan = new Set(items.flatMap((it) => it.simpul.map((s) => s.kunci)));
  const petaSaksi = kunciSaksi(saksi, set, kunciGugatan);
  const jawabPer = keteranganJawab(items, o.jawab, set);
  hasil.butir = items.map((it, n) => {
    const d = dukungan(it, saksi, petaSaksi, ph);
    const j = jawabPer.get(it.id) || null;
    const l = lencana(d, j);
    const tersirat = it.simpul.some((s) => s.tersirat);
    const kutip = it.kutipan.some(Boolean) || Boolean(it.akibatBebas);
    return {
      id: n + 1,
      jenis: it.jenis,
      penutup: penutupSatu.includes(it),
      sebab: it.simpul.map((s) => s.kunci),
      label: it.simpul.map((s) => s.pola.label.replace(/\s*\([^)]*\)$/, "")).join(" -> "),
      huruf: [...new Set(it.simpul.map((s) => s.pola.huruf).filter(Boolean))],
      bunyi: daftarBunyi(it, ph, jenis),
      penutupAkhir: daftarPenutup(it, ph, jenis),
      kalimatGugatan: String(it.kalimat).slice(0, 400),
      dukungan: d.mendukung,
      saksiDiperiksa: d.diperiksa,
      lencana: l.teks,
      yakin: tersirat || kutip ? "ragu" : l.yakin,
      catatan: [tersirat ? "pelakunya tidak disebut di kalimat gugatan (dianggap " + ph.pelaku + ")" : "", kutip ? "akibatnya dikutip dari gugatan - periksa" : ""].filter(Boolean).join("; "),
      jawab: j,
      kodePola: it.simpul.map((s) => s.pola.kode),
    };
  });

  // Yang disebut saksi tetapi tidak didalilkan: dicatat, TIDAK diusulkan.
  for (const [k, nomor] of kunciDisebut(saksi, set)) {
    const pola = set.perKunci.get(k)[0];
    if (kunciGugatan.has(k) || (pola.peran || "sebab") !== "sebab" || pola.hanyaAkibat) continue;
    hasil.diLuarGugatan.push({ kunci: k, label: pola.label.replace(/\s*\([^)]*\)$/, ""), saksi: [...nomor] });
  }
  return hasil;
}

/** "A", "A; serta B", "A; B; serta C". */
function gabungKalimat(bagian) {
  const b = bagian.filter(Boolean);
  if (b.length <= 1) return b.join("");
  return `${b.slice(0, -1).join("; ")}; serta ${b[b.length - 1]}`;
}

/** Kalimat 5227 pada varian ke-k dari semua butir; "ringkas" = perbuatan sebab saja. */
function susunVarian(rincian, k, ringkas) {
  // Beberapa rantai yang sama-sama berujung perselisihan: perselisihan ditulis SEKALI di akhir.
  const berujung = ringkas ? [] : rincian.butir.filter((b) => b.penutupAkhir && b.penutupAkhir[Math.min(k, 2)]);
  const gabung = berujung.length >= 2;
  if (gabung) {
    const bagian2 = rincian.butir.map((b) => (berujung.includes(b) ? b.penutupAkhir[Math.min(k, 2)].inti : (b.bunyi[Math.min(k, b.bunyi.length - 1)] || {}).nilai || ""));
    const pen = berujung[0].penutupAkhir[Math.min(k, 2)].penutup;
    return `${gabungKalimat(bagian2)}; dan hal-hal tersebut mengakibatkan ${pen}`;
  }
  const bagian = rincian.butir.map((b) => {
    if (ringkas) {
      const r = b.bunyi.find((x) => x.keadaan === "tanpa hubungan sebab-akibat");
      return (r || b.bunyi[0] || {}).nilai || "";
    }
    return (b.bunyi[Math.min(k, b.bunyi.length - 1)] || {}).nilai || "";
  });
  return gabungKalimat(bagian);
}

/**
 * Pilihan bunyi 5227 [{keadaan, nilai}] dari rincian - tanpa duplikat.
 */
function pilihanBunyi(rincian) {
  const hasil = [];
  const lihat = new Set();
  const tambah = (keadaan, nilai) => {
    if (nilai && !lihat.has(nilai)) {
      lihat.add(nilai);
      hasil.push({ keadaan, nilai });
    }
  };
  tambah("sesuai gugatan (sebab dan akibat)", susunVarian(rincian, 0, false));
  tambah("sesuai gugatan, redaksi lain", susunVarian(rincian, 1, false));
  tambah("sesuai gugatan, redaksi lain 2", susunVarian(rincian, 2, false));
  tambah("perbuatannya saja (tanpa hubungan sebab-akibat)", susunVarian(rincian, 0, true));
  return hasil;
}


/** Ringkasan butir untuk layar (tanpa kalimat mentah panjang). */
function ringkasButir(b) {
  return {
    id: b.id,
    jenis: b.jenis,
    penutup: b.penutup,
    sebab: b.sebab,
    label: b.label,
    huruf: b.huruf,
    bunyi: b.bunyi,
    lencana: b.lencana,
    yakin: b.yakin,
    dukungan: b.dukungan.map((x) => x.nama),
    jawab: b.jawab ? { status: b.jawab.status, jenis: b.jawab.jenis } : null,
    catatan: b.catatan,
    kalimatGugatan: b.kalimatGugatan,
  };
}

/**
 * Menerapkan rincian pada hasil dariKeteranganSaksi (mengubah `hasil` di tempat). Sebab konkret dari
 * gugatan menggantikan kalimat lama; kalimat lama tetap tersedia sebagai pilihan. Bila gugatan hanya
 * menyebut perselisihan (penutup), kalimat lama yang sudah ada tidak diganti.
 * @returns {boolean} true bila kartu 5227 disentuh
 */
function terapkan(hasil, rincian) {
  const u = (hasil.usulan || []).find((x) => x && x.kode === "5227");
  if (!u || !rincian || !rincian.butir.length) return false;
  const konkret = rincian.butir.filter((b) => !b.penutup);
  const pil = pilihanBunyi(rincian);
  const lama = String(u.nilai || "").trim();
  const baru = pil.length ? pil[0].nilai : "";
  if (!baru) return false;
  hasil.rincianAlasan = { jenis: rincian.jenis, butir: rincian.butir.map(ringkasButir), diLuarGugatan: rincian.diLuarGugatan };
  u.rincian = hasil.rincianAlasan.butir;
  const catatan = [];
  if (konkret.length || !lama) {
    if (lama && lama !== baru) {
      pil.push({ keadaan: "cara lama (ciri dari keterangan saksi)", nilai: lama });
      u.nilaiLama = lama;
    }
    u.nilai = baru;
    u.keyakinan = rincian.butir.every((b) => b.yakin === "cukup") ? "cukup" : "ragu";
    u.dariPosita = true;
    u.dariGugatan = true;
    const sumberGugatan = [];
    for (const b of rincian.butir) if (b.kalimatGugatan && !sumberGugatan.some((x) => x.kalimat === b.kalimatGugatan)) sumberGugatan.push({ saksi: 0, asal: "posita", kalimat: b.kalimatGugatan });
    u.sumber = [...sumberGugatan.slice(0, 6), ...(Array.isArray(u.sumber) ? u.sumber.filter((x) => x && x.saksi > 0).slice(0, 4) : [])];
    u.kesepakatan = "gugatan";
    u.tingkat = u.keyakinan === "cukup" ? "cukup" : "ragu";
    u.dasarTingkat = "gugatan";
    catatan.push("Sebab disusun dari gugatan (acuan utama), berikut rantai sebab-akibatnya; saksi menguatkan, lihat lencana tiap alasan. Periksa sebelum diinput.");
  } else {
    catatan.push("Gugatan hanya menyebut perselisihan; kalimat yang sudah ada dipertahankan.");
  }
  if (rincian.diLuarGugatan.length) {
    catatan.push(`Disebut saksi tetapi tidak didalilkan di gugatan (tidak diusulkan): ${rincian.diLuarGugatan.map((x) => x.label).join(", ")}.`);
  }
  u.pilihan = pil;
  u.catatan = [u.catatan, ...catatan].filter(Boolean).join(" ");
  if (konkret.length && rincian.butir.some((b) => b.kodePola && b.kodePola.length)) u.kodePola = rincian.butir.find((b) => !b.penutup).kodePola[0];
  return true;
}

/**
 * Menyebut saksi menurut pihaknya ("saksi 1" -> "saksi Penggugat") SESUDAH rincian tersusun - dipakai saat pihak
 * saksi baru diketahui dari konteks perkara yang sudah dibaca layanan (tanpa kueri tambahan).
 * @param sisi {{saksi1?: string, saksi2?: string}} "penggugat" | "tergugat"
 */
function terapkanSisiSaksi(hasil, sisi, pihak) {
  const ph = pihakDari(pihak);
  const nama = (k) => (k === "penggugat" ? `saksi ${ph.lawan}` : k === "tergugat" ? `saksi ${ph.pelaku}` : "");
  const tukar = (t) => String(t || "").replace(/saksi ([12])\b/g, (m, n) => nama(sisi && sisi[`saksi${n}`]) || m);
  const garap = (daftar) => {
    for (const b of daftar || []) {
      b.lencana = tukar(b.lencana);
      if (Array.isArray(b.dukungan)) b.dukungan = b.dukungan.map(tukar);
    }
  };
  if (hasil.rincianAlasan) garap(hasil.rincianAlasan.butir);
  const u = (hasil.usulan || []).find((x) => x && x.kode === "5227");
  if (u && u.rincian && u.rincian !== (hasil.rincianAlasan && hasil.rincianAlasan.butir)) garap(u.rincian);
  return true;
}

module.exports = { terapkanSisiSaksi, terapkan, ringkasButir, deteksiRincian, pilihanBunyi, susunVarian, gabungKalimat, polaUntuk, simpulKalimat, itemKalimat, KELOMPOK };
