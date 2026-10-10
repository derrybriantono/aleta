"use strict";

/**
 * ============================================================================
 * P4 + B2 (10 Okt 2026, agen 3) - TUNTUTAN ACCESSOIR DAN ISI GUGATAN e-COURT
 * ============================================================================
 *
 * Membaca teks gugatan / jawaban / replik / duplik (dari arsip e-Court, dibaca
 * portal) dan menemukan:
 *
 *   - tuntutan tambahan: mut'ah, nafkah iddah, nafkah lampau (madliyah),
 *     nafkah anak, hak asuh (hadhanah), harta bersama, mahar terutang -
 *     berikut NOMINAL (angka dan terbilang), periode (per bulan/hari, dikali
 *     N bulan), PIHAK yang menuntut dan yang dibebani;
 *   - anak (nama, umur, tanggal lahir) - data yang tidak dicatat SIPP;
 *   - sikap jawaban (dalil diakui / dibantah).
 *
 * Polanya DATA (kamus-deteksi/awal/tuntutan.json dan gugatan.json), dibaca
 * hanya lewat kamusDeteksi.polaKelompok - lapis database dari layar Admin
 * berlaku di sini. Yang tertulis di berkas ini hanya cara menimbang hasilnya.
 *
 * Hasilnya USULAN. Nominal yang dituntut bukan nominal yang dikabulkan; amar
 * dan dasar hukum selalu diperiksa hakim. Tidak satu pun usulan di sini
 * berkeyakinan "pasti" (lihat hasil ukur di hasil-agen3.md).
 *
 * Penanda halaman: portal menyambung halaman PDF dengan "\f" (form feed);
 * kutipan menyebut "hal. n" bila ada.
 */

const kamus = require("./kamusDeteksi");

// ─── Perapian teks ───────────────────────────────────────────────────────────

const ENTITAS = { "&#39;": "'", "&apos;": "'", "&quot;": '"', "&amp;": "&", "&nbsp;": " ", "&lt;": "<", "&gt;": ">", "&rsquo;": "'", "&lsquo;": "'" };

/**
 * Teks berkas -> teks yang diuji pola. Petik miring disatukan menjadi ',
 * entitas HTML dibuka, tag dibuang. "\f" (batas halaman) dipertahankan.
 */
function rapikanTeks(teks) {
  return String(teks || "")
    .replace(/&#?[a-z0-9]+;/gi, (e) => (Object.prototype.hasOwnProperty.call(ENTITAS, e.toLowerCase()) ? ENTITAS[e.toLowerCase()] : e))
    .replace(/<\/?(?:p|div|br|li|tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00E2\u20AC[\u2122\u02DC]/g, "'")
    .replace(/\u00E2\u20AC[\u0153\u009D\u201D]/g, '"')
    .replace(/[‘’‛`´ʼʻ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, " ")
    .replace(/\r\n?/g, "\n");
}

/** Satu baris tanpa ganti baris (panjang tetap sama - letak tetap berlaku untuk "\f"). */
function datarkan(teks) {
  return teks.replace(/[\n\t\v]/g, " ");
}

function bersihSpasi(s) {
  return String(s || "").replace(/[\f\s]+/g, " ").trim();
}

// ─── Terbilang ───────────────────────────────────────────────────────────────

const SATUAN = {
  nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
  sepuluh: 10, sebelas: 11,
};
const PENGALI = { puluh: 10, belas: 10, ratus: 100, ribu: 1000, juta: 1e6, milyar: 1e9, miliar: 1e9, trilyun: 1e12, triliun: 1e12 };

/** Kata salah ketik yang lazim di berkas pihak -> bentuk baku (jarak satu huruf). */
function bakuKata(k) {
  if (SATUAN[k] !== undefined || PENGALI[k] !== undefined) return k;
  const calon = [...Object.keys(SATUAN), ...Object.keys(PENGALI)].filter((b) => b.length >= 4);
  for (const b of calon) if (jarakSatu(k, b)) return b;
  return k;
}

function jarakSatu(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || a.length < 4) return false;
  let i = 0;
  let j = 0;
  let beda = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    beda += 1;
    if (beda > 1) return false;
    if (a.length > b.length) i += 1;
    else if (a.length < b.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return beda + (a.length - i) + (b.length - j) <= 1;
}

/**
 * "dua puluh satu juta lima ratus ribu" -> 21500000. null bila bukan bilangan.
 * Bentuk se- (seratus, seribu, sejuta, sepuluh) dan salah ketik satu huruf
 * ("jiuta", "jutaa", "tuju") dikenali.
 */
function angkaDariTerbilang(teks) {
  let kata = String(teks || "")
    .toLowerCase()
    .replace(/rupiah|rupaih|rupia|rp\.?/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  // se + pengali yang tertulis sambung: seratus, seribu, sejuta, semilyar
  kata = kata.flatMap((k) => {
    const m = /^se(ratus|ribu|juta|milyar|miliar|puluh|belas)$/.exec(k);
    return m ? ["satu", m[1]] : [k];
  });
  // Kata berulang karena salah ketik ("enam belas ribu ribu", "satu satu ribu") dihitung sekali.
  kata = kata.map(bakuKata).filter((k, i, a) => k !== "dan" && k !== a[i - 1]);
  if (!kata.length) return null;
  let total = 0;
  let kelompok = 0; // nilai di bawah seribu yang sedang disusun
  let kini = null; // satuan terakhir yang belum dikalikan
  for (const k of kata) {
    if (SATUAN[k] !== undefined) {
      if (kini !== null) kelompok += kini;
      kini = SATUAN[k];
      continue;
    }
    if (PENGALI[k] === undefined) return null;
    if (k === "belas") kelompok += (kini === null ? 1 : kini) + 10;
    else if (k === "puluh") kelompok += (kini === null ? 1 : kini) * 10;
    else if (k === "ratus") kelompok += (kini === null ? 1 : kini) * 100;
    else {
      const nilai = kelompok + (kini === null ? 0 : kini);
      total += (nilai === 0 ? 1 : nilai) * PENGALI[k];
      kelompok = 0;
    }
    kini = null;
  }
  return total + kelompok + (kini === null ? 0 : kini);
}

const SEBUT = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

/** 21500000 -> "dua puluh satu juta lima ratus ribu". */
function terbilang(n) {
  const x = Math.floor(Math.abs(Number(n) || 0));
  if (x === 0) return "nol";
  const sub = (v) => {
    if (v < 12) return SEBUT[v];
    if (v < 20) return `${SEBUT[v - 10]} belas`;
    if (v < 100) return `${SEBUT[Math.floor(v / 10)]} puluh${v % 10 ? ` ${SEBUT[v % 10]}` : ""}`;
    if (v < 200) return `seratus${v % 100 ? ` ${sub(v % 100)}` : ""}`;
    if (v < 1000) return `${SEBUT[Math.floor(v / 100)]} ratus${v % 100 ? ` ${sub(v % 100)}` : ""}`;
    if (v < 2000) return `seribu${v % 1000 ? ` ${sub(v % 1000)}` : ""}`;
    if (v < 1e6) return `${sub(Math.floor(v / 1000))} ribu${v % 1000 ? ` ${sub(v % 1000)}` : ""}`;
    if (v < 1e9) return `${sub(Math.floor(v / 1e6))} juta${v % 1e6 ? ` ${sub(v % 1e6)}` : ""}`;
    if (v < 1e12) return `${sub(Math.floor(v / 1e9))} miliar${v % 1e9 ? ` ${sub(v % 1e9)}` : ""}`;
    return `${sub(Math.floor(v / 1e12))} triliun${v % 1e12 ? ` ${sub(v % 1e12)}` : ""}`;
  };
  return sub(x);
}

/** 5000000 -> "Rp5.000.000,00" (bentuk isian ABT satker). */
function formatRupiah(n) {
  const x = Math.round(Number(n) || 0);
  return `Rp${String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},00`;
}

/** "Rp5.000.000,00 (lima juta rupiah)". */
function rupiahTerbilang(n) {
  return `${formatRupiah(n)} (${terbilang(n)} rupiah)`;
}

// ─── Nominal ─────────────────────────────────────────────────────────────────

// Angka rupiah: Rp/Rp./Rp . dengan pemisah titik/koma/spasi ribuan, ekor ,00 / ,- / , -.
// Juga "Rp 5 juta" dan angka tanpa Rp yang diikuti /bulan (petitum SIPP: "2.000.000/ bulan").
const RE_RUPIAH = /\bRp\s*\.?\s*((?:\d{1,3}(?:[.,]\s?\d{3})+|\d+))(?:\s*,\s*(?:\d{2}|-+)|\s*,-|\s*\.-)?(\s*(?:juta|ribu|jt|rb)\b)?/gi;
const RE_TANPA_RP = /(?<![\d.,])(\d{1,3}(?:\.\d{3}){1,3})(?:\s*,\s*(?:\d{2}|-+))?(?=\s*(?:\/\s*(?:bulan|hari)|per\s*bulan|perbulan|setiap\s+bulan|rupiah))/gi;
const RE_TERBILANG_KURUNG = /^\s*[,;:]?\s*\(\s*([a-z][a-z\s-]{2,160}?)\s*(?:rupiah|rupaih|rupia)?\s*\)/i;
const RE_TERBILANG_LEPAS = /^\s*[,;:]?\s*\(?\s*([a-z][a-z\s-]{2,160}?)\s+(?:rupiah|rupaih|rupia)\b\s*\)?/i;

function angkaDariDigit(d, akhiran) {
  const bersih = String(d).replace(/[.,\s]/g, "");
  let n = Number(bersih);
  if (!Number.isFinite(n)) return null;
  const a = String(akhiran || "").trim().toLowerCase();
  if (a === "juta" || a === "jt") n *= 1e6;
  else if (a === "ribu" || a === "rb") n *= 1e3;
  return n;
}

/**
 * Seluruh nominal dalam satu potongan teks, urut letak:
 *   { nilai, teks, mulai, akhir, terbilang, nilaiTerbilang, cocok, tanpaRp }
 * "cocok" = angka dan terbilang di kurungnya sama (null bila tidak ada terbilang).
 * Bila keduanya BERBEDA, `nilai` tetap angka (pihak lebih sering salah ketik
 * terbilang daripada angka - ukur di hasil-agen3.md) dan selisihnya dicatat.
 */
function nominalDari(teks) {
  const s = String(teks || "");
  const hasil = [];
  const sudah = [];
  const tambah = (m, nilai, tanpaRp) => {
    const mulai = m.index;
    const akhir = m.index + m[0].length;
    if (sudah.some(([a, b]) => mulai < b && akhir > a)) return;
    const sisa = s.slice(akhir, akhir + 160);
    const k = RE_TERBILANG_KURUNG.exec(sisa) || RE_TERBILANG_LEPAS.exec(sisa);
    let kata = "";
    let nilaiKata = null;
    let akhirKata = akhir;
    if (k) {
      const n = angkaDariTerbilang(k[1]);
      if (n !== null && n > 0) {
        kata = bersihSpasi(k[1]);
        nilaiKata = n;
        akhirKata = akhir + k[0].length;
      }
    }
    sudah.push([mulai, akhirKata]);
    hasil.push({
      nilai,
      teks: bersihSpasi(s.slice(mulai, akhirKata)),
      mulai,
      akhir: akhirKata,
      terbilang: kata,
      nilaiTerbilang: nilaiKata,
      cocok: nilaiKata === null ? null : nilaiKata === nilai,
      tanpaRp,
    });
  };
  for (const m of s.matchAll(RE_RUPIAH)) {
    const n = angkaDariDigit(m[1], m[2]);
    if (n !== null && n >= 1000) tambah(m, n, false);
  }
  for (const m of s.matchAll(RE_TANPA_RP)) {
    const n = angkaDariDigit(m[1], "");
    if (n !== null && n >= 1000) tambah(m, n, true);
  }
  // Terbilang tanpa angka: "lima juta rupiah"
  for (const m of s.matchAll(/\b((?:(?:se|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)\s*)(?:[a-z]+\s+){0,8}?(?:ratus|ribu|juta|puluh|belas)(?:\s+[a-z]+){0,6}?)\s+rupiah\b/gi)) {
    const n = angkaDariTerbilang(m[1]);
    if (n && n >= 1000) {
      const mulai = m.index;
      const akhir = m.index + m[0].length;
      if (sudah.some(([a, b]) => mulai < b && akhir > a)) continue;
      sudah.push([mulai, akhir]);
      hasil.push({ nilai: n, teks: bersihSpasi(m[0]), mulai, akhir, terbilang: bersihSpasi(m[1]), nilaiTerbilang: n, cocok: null, tanpaRp: true });
    }
  }
  return hasil.sort((a, b) => a.mulai - b.mulai);
}

// ─── Pola kamus ──────────────────────────────────────────────────────────────

function polaPeran(kelompok, peran) {
  return kamus.polaKelompok(kelompok).filter((p) => (p.peran || "") === peran);
}

/** RegExp global baru dari pola kamus (pola kamus tidak ber-g; lastIndex aman). */
function global(p) {
  const f = p.re.flags.includes("g") ? p.re.flags : `${p.re.flags}g`;
  return new RegExp(p.re.source, f);
}

function adaPola(pola, teks) {
  return pola.some((p) => {
    p.re.lastIndex = 0;
    return p.re.test(teks);
  });
}

function cocokPertama(pola, teks) {
  let terbaik = null;
  for (const p of pola) {
    const m = global(p).exec(teks);
    if (m && (!terbaik || m.index < terbaik.m.index)) terbaik = { p, m };
  }
  return terbaik;
}

// ─── Butir ───────────────────────────────────────────────────────────────────

/**
 * Teks datar -> butir: dipotong pada ";", akhir kalimat, dan penomoran
 * ("1.", "a.", "4.1", "•", "-"). Letak butir terhadap teks asal dipertahankan.
 */
function pecahButir(teksAsal) {
  // Ganti baris dipakai sebagai batas HANYA bila baris berikutnya berhuruf besar
  // dan baris sebelumnya tidak berakhir di tengah kalimat (huruf kecil/koma) -
  // PDF memotong kalimat panjang menjadi banyak baris.
  const asal = String(teksAsal || "");
  const datar = datarkan(asal);
  const butir = [];
  const re = /;|:(?=\s+[A-Z])|\.(?=\s+[A-Z0-9"(])(?<!\b(?:Rp|No|Nomor|Jl|Kel|Kec|Kab|Prov|H|Hj|Drs|Dr|S\.H|SH|Tgl|tgl|dkk|dll|dsb|a\.n|Moh|Muh|Hi|M)\.)|(?<=[^a-z,\s(-][ \t]*)\n(?=[ \t]*[A-Z•])|(?<![,(])\s(?=(?:\d{1,2}(?:\.\d{1,2})?[.)]|[a-hA-H][.)]|•|[-–]\s|Bahwa\b|BAHWA\b)\s)|\s(?=\d{1,2}\.[A-Z][a-z])|\f/g;
  let awal = 0;
  let m;
  while ((m = re.exec(asal))) {
    const akhir = m.index + (m[0] === ";" || m[0] === "." || m[0] === ":" ? 1 : 0);
    if (akhir - awal >= 3) butir.push({ teks: datar.slice(awal, akhir), mulai: awal, akhir });
    awal = m.index + m[0].length;
  }
  if (datar.length - awal >= 3) butir.push({ teks: datar.slice(awal), mulai: awal, akhir: datar.length });
  return butir.filter((b) => b.teks.trim().length >= 3);
}

function halamanDi(teks, letak) {
  if (!teks.includes("\f")) return null;
  let n = 1;
  for (let i = 0; i < letak && i < teks.length; i += 1) if (teks.charCodeAt(i) === 12) n += 1;
  return n;
}

// ─── Sebutan dan pembebanan ──────────────────────────────────────────────────

const PERAN_KODE = { penggugat: "0046", pemohon: "0046", tergugat: "0047", termohon: "0047" };

/** "Tergugat Rekonvensi" -> 0046 (yang mengajukan perkara); "Tergugat" -> 0047. */
function kodeSebutan(kata, rekonvensi) {
  const dasar = PERAN_KODE[String(kata || "").toLowerCase()];
  if (!dasar) return "";
  if (!rekonvensi) return dasar;
  // Dalam rekonvensi kedudukannya terbalik: Penggugat Rekonvensi = 0047.
  return dasar === "0046" ? "0047" : "0046";
}

function sebutanUntuk(kode, sebutan, rekonvensi) {
  const s = sebutan || {};
  const dasar = kode === "0046" ? s.lawan || "Penggugat" : s.pelaku || "Tergugat";
  if (!rekonvensi) return dasar;
  const kebalikan = kode === "0046" ? "Tergugat" : "Penggugat";
  return `${dasar} Konvensi/${kebalikan} Rekonvensi`;
}

// ─── Deteksi tuntutan ────────────────────────────────────────────────────────

const LABEL_JENIS = {
  mutah: "Mut'ah",
  iddah: "Nafkah iddah",
  madliyah: "Nafkah lampau (madliyah)",
  "nafkah-anak": "Nafkah anak",
  hadhanah: "Hak asuh anak (hadhanah)",
  "harta-bersama": "Harta bersama",
  mahar: "Mahar terutang",
};
const URUT_JENIS = ["mutah", "iddah", "madliyah", "nafkah-anak", "hadhanah", "harta-bersama", "mahar"];

/** Bagian dokumen: rentang petitum (terakhir sebelum subsidair) dan awal rekonvensi. */
function bagianDokumen(datar) {
  const petitum = polaPeran("tuntutan", "bagian").filter((p) => p.kunci === "petitum");
  const subsidair = polaPeran("tuntutan", "bagian").filter((p) => p.kunci === "subsidair");
  const rekonvensi = polaPeran("tuntutan", "bagian").filter((p) => p.kunci === "rekonvensi");
  const semua = (pola) => {
    const out = [];
    for (const p of pola) for (const m of datar.matchAll(global(p))) out.push(m.index);
    return out.sort((a, b) => a - b);
  };
  const awalP = semua(petitum);
  const awalS = semua(subsidair);
  const awalR = semua(rekonvensi);
  // Petitum: kemunculan terakhir penanda awal yang masih berada sebelum subsidair
  // pertama sesudahnya. Tanpa penanda: tidak ada rentang petitum.
  const rentang = [];
  const titikP = awalP.filter((x) => x > datar.length * 0.25 || awalP.length === 1);
  if (titikP.length) {
    // Rentang petitum bisa dua (konvensi dan rekonvensi pada satu jawaban):
    // dari awal petitum pertama sampai subsidair pertama sesudahnya.
    const a = titikP[0];
    const s = awalS.find((x) => x > a);
    rentang.push([a, s === undefined ? datar.length : s]);
  }
  return { petitum: rentang, rekonvensi: awalR.length ? awalR[0] : -1 };
}

function dalam(rentang, letak) {
  return rentang.some(([a, b]) => letak >= a && letak < b);
}

/**
 * Tuntutan dalam satu dokumen.
 *
 * @param {string} teksMentah  teks dokumen (halaman dipisah "\f")
 * @param {object} opsi
 *   peran      "gugatan" | "jawaban" | "replik" | "duplik" | "kesimpulan" | "amar"
 *   sebutan    { lawan, pelaku } - sebutan 0046/0047 halaman ABT
 *   judul      judul dokumen (untuk kutipan)
 * @returns {{tuntutan: object[], diabaikan: object[]}}
 */
function deteksiTuntutan(teksMentah, opsi) {
  const o = opsi || {};
  const peranDok = String(o.peran || "gugatan");
  const teks = rapikanTeks(teksMentah);
  const datar = datarkan(teks);
  const jenisPola = polaPeran("tuntutan", "jenis");
  const tuntutPola = polaPeran("tuntutan", "tuntut");
  const abaikanPola = polaPeran("tuntutan", "abaikan");
  const periodePola = polaPeran("tuntutan", "periode");
  const kaliPola = polaPeran("tuntutan", "kali");
  const totalPola = polaPeran("tuntutan", "total");
  const bebanPola = polaPeran("tuntutan", "pembebanan");
  const { petitum, rekonvensi } = bagianDokumen(datar);
  const dokJawab = /jawab|replik|duplik|kesimpulan|rekon/i.test(peranDok);
  // Siapa yang menuntut: dari pengunggah dokumen bila portal tahu, selain itu
  // dari jenis dokumennya (replik = pihak yang mengajukan perkara).
  const penuntutDok =
    o.penuntutKode === "0046" || o.penuntutKode === "0047"
      ? o.penuntutKode
      : peranDok === "amar"
        ? ""
        : dokJawab && peranDok !== "replik"
          ? "0047"
          : "0046";

  const temuan = [];
  const diabaikan = [];
  // Pembebanan dibawa ke butir anak diktum: "Menghukum Pemohon membayar ... berupa:
  // Mut'ah ...; Nafkah iddah ..." - butir kedua tidak menyebut siapa yang dihukum.
  let bebanBawaan = null;
  // Pengantar daftar ("saya menuntut hak-hak saya antara lain:") berlaku untuk
  // butir daftar sesudahnya sampai dalil baru ("Bahwa ...") atau 400 huruf.
  let tuntutBawaan = null;
  for (const b of pecahButir(teks)) {
    const t = b.teks;
    const pengantar = /:\s*$/.test(t) || /\b(?:antara\s+lain|sebagai\s+berikut|berupa)\s*:?\s*$/i.test(t);
    if (tuntutBawaan && (b.mulai > tuntutBawaan.sampai || /^\s*(?:\d{1,2}[.)]\s*)?Bahwa\b/i.test(t))) tuntutBawaan = null;
    const adaTuntutSendiri = adaPola(tuntutPola, t);
    if (pengantar && adaTuntutSendiri) tuntutBawaan = { sampai: b.akhir + 400 };
    const bebanSini = cocokPertama(bebanPola, t);
    if (bebanSini) {
      // Di bagian rekonvensi perkara permohonan (Pemohon/Termohon), "Tergugat"/
      // "Penggugat" polos berarti kedudukan rekonvensinya ("Menghukum Tergugat
      // untuk membayar" ditulis Termohon untuk Pemohon).
      const kata = bebanSini.m[1];
      const diRek = rekonvensi >= 0 && b.mulai >= rekonvensi;
      const sebutanPerkara = `${(o.sebutan && o.sebutan.lawan) || ""} ${(o.sebutan && o.sebutan.pelaku) || ""}`.toLowerCase();
      const polosRek = diRek && /^(?:penggugat|tergugat)$/i.test(kata) && /pemohon|termohon/.test(sebutanPerkara);
      bebanBawaan = { kode: kodeSebutan(kata, Boolean(bebanSini.m[2]) || polosRek), sampai: b.akhir + 500 };
    }
    else if (bebanBawaan && (b.mulai > bebanBawaan.sampai || /^\s*(?:\d{1,2}[.)]\s*)?(?:Mengabulkan|Menetapkan|Menyatakan|Memberi\s+izin|Membebankan|Memerintahkan|Menolak|Bahwa)\b/i.test(t))) {
      bebanBawaan = null;
    }
    const jenisDi = [];
    for (const p of jenisPola) {
      for (const m of t.matchAll(global(p))) jenisDi.push({ kunci: p.kunci, kode: p.kode, letak: m.index, kata: m[0] });
    }
    if (!jenisDi.length) continue;
    const diPetitum = dalam(petitum, b.mulai) || peranDok === "amar";
    const adaTuntut = adaTuntutSendiri || Boolean(tuntutBawaan && !pengantar);
    // Butir petitum tidak pernah diabaikan karena kutipan dasar hukum;
    // penolakan ("menolak membayar") dan kesanggupan berlaku di mana pun dan
    // DISEBUT (diabaikan[]), walau kalimatnya tanpa kata kerja menuntut.
    const tolak = abaikanPola.filter((p) => p.kode !== "tuntutan-abaikan-dasar-hukum" || !diPetitum);
    const tolakKena = tolak.find((p) => {
      p.re.lastIndex = 0;
      return p.re.test(t);
    });
    if (!tolakKena && !diPetitum && !adaTuntut) continue;
    // Di luar petitum kata kerja menuntut harus DEKAT kata tuntutannya (100 huruf
    // sebelum - 80 sesudah): "Penggugat meminta izin bekerja ..., Tergugat tidak
    // menafkahi anak" bukan tuntutan (ukur 10 Okt: 4 salah tangkap nafkah anak).
    const dekatTuntut = (letak) => adaPola(tuntutPola, t.slice(Math.max(0, letak - 100), letak + 80).replace(/\bmeminta\s+izin\b/gi, ""));
    if (tolakKena) {
      diabaikan.push({
        sebab: tolakKena.kunci === "sanggup" ? "kesanggupan" : tolakKena.kode === "tuntutan-abaikan-dasar-hukum" ? "dasar-hukum" : "penolakan",
        kutipan: bersihSpasi(t).slice(0, 240),
        jenis: [...new Set(jenisDi.map((j) => j.kunci))],
        halaman: halamanDi(teks, b.mulai),
      });
      continue;
    }
    // Prioritas yang saling menutup: madliyah anak > nafkah anak > hadhanah.
    const jenisSah = diPetitum || tolakKena || (tuntutBawaan && !adaTuntutSendiri) ? jenisDi : jenisDi.filter((j) => dekatTuntut(j.letak));
    if (!jenisSah.length) continue;
    const kunciAda = new Set(jenisSah.map((j) => j.kunci));
    let pakai = jenisSah;
    if (kunciAda.has("madliyah") && kunciAda.has("nafkah-anak")) pakai = pakai.filter((j) => j.kunci !== "nafkah-anak");
    if ((kunciAda.has("nafkah-anak") || kunciAda.has("madliyah")) && kunciAda.has("hadhanah")) {
      // "biaya hadhanah" = nafkah anak; hak asuh yang disebut lepas tetap dihitung
      // hanya bila ada frasa "hak asuh/dalam asuhan" sendiri di butir itu.
      const hakAsuh = /\bhak\s+(?:asuh|hadh?anah|hadlon?ah|pemeliharaan|pengasuhan)|\b(?:di\s*bawah|dalam)\s+(?:asuhan|pengasuhan|pemeliharaan)/i.test(t);
      if (!hakAsuh) pakai = pakai.filter((j) => j.kunci !== "hadhanah");
    }
    const untukAnak = /\banak\b/i.test(t);
    // Satu kemunculan per jenis per butir, urut letak.
    const perJenis = new Map();
    for (const j of pakai.sort((a, b2) => a.letak - b2.letak)) if (!perJenis.has(j.kunci)) perJenis.set(j.kunci, j);
    const daftar = [...perJenis.values()];
    const nominal = nominalDari(t);
    const gabungan = daftar.length > 1 && nominal.length === 1 && daftar.filter((j) => j.letak < nominal[0].mulai).length > 1;
    daftar.forEach((j, idx) => {
      const sesudah = idx + 1 < daftar.length ? daftar[idx + 1].letak : t.length;
      // Nominal milik jenis ini: di antara kata jenisnya dan jenis berikutnya;
      // bila tidak ada, nominal tunggal butir (gabungan "iddah dan mut'ah sebesar").
      let milik = nominal.filter((n) => n.mulai >= j.letak && n.mulai < sesudah);
      if (!milik.length && gabungan) milik = nominal;
      // Nominal SEBELUM kata jenisnya tidak dipakai: ukur 10 Okt (700/Pdt.G/2025)
      // menunjukkan itu nominal butir sebelumnya yang tidak terpotong.
      const pilih = pilihNominal(t, milik, { periodePola, kaliPola, totalPola, kunci: j.kunci });
      // Mut'ah/mahar berupa benda ("cincin emas seberat 2 gram", "1 lempeng emas
      // batangan"): uraian bendanya dibawa, bukan dibuang karena tidak bernominal.
      let benda = "";
      if (!pilih && (j.kunci === "mutah" || j.kunci === "mahar")) {
        const sesudahKata = t.slice(j.letak + j.kata.length, sesudah);
        const mb = /\b(?:berupa|sebesar|sejumlah|yaitu)\s*:?\s*([^;]{3,160})/i.exec(sesudahKata) || /^\s*[/:]?\s*(?:pelipur\s+lara\s+)?((?:\d+|se|satu|dua|tiga)\s*(?:\(\w+\)\s*)?(?:buah|unit|lempeng|gram|ekor|bidang|petak)[^;]{0,120})/i.exec(sesudahKata);
        if (mb) benda = bersihSpasi(mb[1]).replace(/\s*(?:yang\s+(?:harus\s+)?di\s*(?:bayar|serah)|dibayarkan|diserahkan|sebelum\s+ikrar)[\s\S]*$/i, "").slice(0, 140);
      }
      const rek = rekonvensi >= 0 && b.mulai >= rekonvensi;
      let dibebaniKode = bebanBawaan ? bebanBawaan.kode : "";
      const penuntutKode = penuntutDok;
      if (!dibebaniKode && penuntutKode && ["mutah", "iddah", "madliyah", "nafkah-anak", "mahar"].includes(j.kunci)) {
        dibebaniKode = penuntutKode === "0046" ? "0047" : "0046";
      }
      temuan.push({
        jenis: j.kunci,
        label: LABEL_JENIS[j.kunci] || j.kunci,
        kodePola: j.kode,
        kata: j.kata,
        untukAnak: j.kunci === "madliyah" ? untukAnak && /\banak\b/i.test(t.slice(j.letak, j.letak + 80)) : undefined,
        nominal: pilih,
        benda: benda || undefined,
        gabungan: gabungan || undefined,
        penuntutKode,
        dibebaniKode,
        rekonvensi: Boolean(rek),
        diPetitum,
        kutipan: bersihSpasi(t).slice(0, 320),
        halaman: halamanDi(teks, b.mulai),
        letak: b.mulai,
      });
    });
  }
  return { tuntutan: ringkasTuntutan(temuan), diabaikan };
}

/**
 * Dari beberapa nominal satu jenis: jumlah akhir ("= Rp..", "total") bila ada,
 * per bulan beserta kalinya, selain itu yang pertama.
 */
function pilihNominal(t, milik, pola) {
  if (!milik.length) return null;
  const periodeDi = (n) => {
    const sesudah = t.slice(n.akhir, n.akhir + 40);
    for (const p of pola.periodePola) {
      p.re.lastIndex = 0;
      const m = p.re.exec(sesudah);
      if (m && m.index <= 12) return p.kunci;
    }
    // "Rp5.000.000,- x 3 bulan" / "dikali 3 bulan" tepat sesudah nominal = per bulan.
    for (const p of pola.kaliPola) {
      const m = global(p).exec(sesudah);
      if (m && m.index <= 6 && !/^\s*selama/i.test(m[0])) return "bulan";
    }
    return "";
  };
  const totalDi = (n) => {
    const sebelum = t.slice(Math.max(0, n.mulai - 30), n.mulai);
    return pola.totalPola.some((p) => {
      const re = global(p);
      let m;
      let ada = false;
      while ((m = re.exec(sebelum))) if (sebelum.length - (m.index + m[0].length) <= 30) ada = true;
      return ada;
    });
  };
  const kaliDari = (dari) => {
    const s = t.slice(dari, dari + 120);
    for (const p of pola.kaliPola) {
      const m = global(p).exec(s);
      if (m) return Number(m[1]);
    }
    return null;
  };
  const dengan = milik.map((n) => ({ ...n, periode: periodeDi(n), total: totalDi(n) }));
  const total = dengan.filter((n) => n.total && !n.periode).pop() || null;
  const perBulan = dengan.find((n) => n.periode === "bulan") || null;
  const perHari = dengan.find((n) => n.periode === "hari") || null;
  const utama = total || perBulan || dengan[0];
  const kali = perBulan ? kaliDari(perBulan.akhir) : utama.periode === "" ? null : kaliDari(utama.akhir);
  const hasil = {
    nilai: utama.nilai,
    teks: utama.teks,
    terbilang: utama.terbilang,
    cocokTerbilang: utama.cocok,
    nilaiTerbilang: utama.nilaiTerbilang,
    periode: total ? "" : utama.periode,
    perBulan: perBulan ? perBulan.nilai : null,
    perHari: perHari ? perHari.nilai : null,
    kali: kali || null,
    total: total ? total.nilai : perBulan && kali ? perBulan.nilai * kali : null,
    semua: dengan.map((n) => n.nilai),
  };
  // Mut'ah dan iddah: per bulan x kali = total yang tertulis -> selaras.
  if (total && perBulan && kali) hasil.selaras = perBulan.nilai * kali === total.nilai;
  return hasil;
}

/** Satu tuntutan per jenis per pihak: petitum mengalahkan posita, bernominal mengalahkan yang tidak. */
function ringkasTuntutan(temuan) {
  const peta = new Map();
  const bobot = (x) => (x.diPetitum ? 4 : 0) + (x.nominal ? 2 : 0) + (x.nominal && x.nominal.cocokTerbilang ? 1 : 0);
  for (const x of temuan) {
    const k = `${x.jenis}|${x.penuntutKode}|${x.jenis === "madliyah" && x.untukAnak ? "anak" : ""}`;
    const lama = peta.get(k);
    if (!lama) {
      peta.set(k, { ...x, kutipanLain: [] });
      continue;
    }
    const menang = bobot(x) > bobot(lama) || (bobot(x) === bobot(lama) && x.letak > lama.letak && x.diPetitum);
    const kalah = menang ? lama : x;
    const tetap = menang ? { ...x, kutipanLain: lama.kutipanLain } : lama;
    tetap.kutipanLain.push({ kutipan: kalah.kutipan, halaman: kalah.halaman, nilai: kalah.nominal ? kalah.nominal.nilai : null });
    peta.set(k, tetap);
  }
  return [...peta.values()].sort((a, b) => URUT_JENIS.indexOf(a.jenis) - URUT_JENIS.indexOf(b.jenis));
}

// ─── Anak ────────────────────────────────────────────────────────────────────

const KATA_BUKAN_NAMA = /^(?:bernama|yaitu|yakni|anak|anaknya|anak-anak|bin|binti|dan|atau|masing|masing-masing|orang|seorang|lahir|umur|usia|tanggal|perempuan|laki-laki|laki|kelamin|jenis|nama|adalah|ke|ketiga|kedua|pertama|keempat|yang|telah|dikaruniai|dikarunia|karunia|sebagai|berikut|tersebut|bulan|tahun|terhadap|kepada|atas|kandung|hak|asuh|hadhanah|dalam|pengasuhan|asuhan|sekarang|ikut|bersama|tinggal|dibawah|di|umurnya|\d+|[a-h]|i{1,3}|iv|v)$/i;

/**
 * Anak dari kalimat posita/jawaban: [{nama, umur, tanggalLahir, kutipan, halaman}].
 * Nama = kata sebelum bin/binti (paling banyak 6 kata) + "bin/binti" + nama ayah.
 */
function anakDari(teksMentah) {
  const teks = rapikanTeks(teksMentah);
  const datar = datarkan(teks);
  const wilayah = polaPeran("gugatan", "anak");
  const umurPola = polaPeran("gugatan", "anak-umur");
  const lahirPola = polaPeran("gugatan", "anak-lahir");
  const hasil = [];
  const sudah = new Set();
  for (const p of wilayah) {
    for (const m of datar.matchAll(global(p))) {
      const awal = m.index;
      const potong = datar.slice(awal, awal + 700);
      // Potongan berakhir di "Bahwa" berikutnya (dalil baru).
      const henti = potong.slice(20).search(/\bBahwa\b|\bBAHWA\b/);
      const area = henti > 0 ? potong.slice(0, henti + 20) : potong;
      for (const n of area.matchAll(/((?:[A-Za-z'.]+\s+){1,6}?)(bin|binti|Bin|Binti|BIN|BINTI)\s+((?:[A-Za-z'.]+\s?){1,4})/g)) {
        // Nama anak = kata SESUDAH batas terakhir (kata bukan nama, atau tanda baca
        // penutup frasa sebelumnya). Singkatan bertitik pendek ("M.", "Moh.") tetap nama.
        const semuaKata = n[1].trim().split(/\s+/);
        let batas = -1;
        semuaKata.forEach((k, i) => {
          const polos = k.replace(/[.:,;()]/g, "");
          const tutup = /[,:;)]$/.test(k) || (/\.$/.test(k) && polos.length > 3);
          if (KATA_BUKAN_NAMA.test(polos) || !polos) batas = i;
          else if (tutup && i < semuaKata.length - 1) batas = i;
        });
        const kataNama = semuaKata.slice(batas + 1);
        if (!kataNama.length) continue;
        // Nama pihak dalam kurung sesudah sebutannya ("Penggugat Rekonvensi (NURDIAH
        // Binti SUWARNO)") bukan anak.
        const sebelumNama = area.slice(Math.max(0, n.index - 45), n.index + n[1].indexOf(kataNama[0]));
        if (/\b(?:penggugat|tergugat|pemohon|termohon|rekon[pv]ensi|kuasa|advokat)\b[^,;]{0,12}$/i.test(sebelumNama)) continue;
        const ayahKata = n[3].trim().split(/\s+/);
        const potongAyah = [];
        for (const k of ayahKata) {
          if (/^(?:umur|usia|lahir|perempuan|laki|dan|sekarang|yang|tinggal|berumur|berusia|tanggal|kelahiran|saat)$/i.test(k.replace(/[.,;:()]/g, ""))) break;
          potongAyah.push(k.replace(/[,;:()]+$/g, ""));
          if (/[,;]$/.test(k)) break;
        }
        if (!potongAyah.length) continue;
        const nama = `${kataNama.join(" ").replace(/^[,:;.\s]+/, "")} ${n[2].toLowerCase()} ${potongAyah.join(" ")}`.replace(/\s+/g, " ").trim();
        const kunci = kataNama.join("").toLowerCase().replace(/[^a-z]/g, "");
        if (sudah.has(kunci) || kunci.length < 3) continue;
        // Nama pihak sendiri ("Penggugat bernama X binti Y") bukan anak:
        // anak berada sesudah kata wilayah anak, bukan di identitas pihak.
        sudah.add(kunci);
        const sesudah = area.slice(n.index + n[0].length, n.index + n[0].length + 120);
        let umur = "";
        for (const u of umurPola) {
          const mu = global(u).exec(sesudah);
          if (mu && mu.index < 60) {
            umur = `${Number(mu[1])} tahun${mu[2] ? ` ${Number(mu[2])} bulan` : ""}`;
            break;
          }
        }
        let tanggalLahir = "";
        for (const l of lahirPola) {
          const ml = global(l).exec(sesudah);
          if (ml && ml.index < 60) {
            tanggalLahir = ml[1];
            break;
          }
        }
        hasil.push({ nama: rapikanNama(nama), umur, tanggalLahir, kutipan: bersihSpasi(area.slice(Math.max(0, n.index - 40), n.index + n[0].length + 60)), halaman: halamanDi(teks, awal + n.index) });
      }
    }
  }
  return hasil.slice(0, 12);
}

/** "NUR KHAFIZAH binti ANJAS" -> "Nur Khafizah binti Anjas" (huruf besar semua dirapikan; campuran dibiarkan). */
function rapikanNama(nama) {
  return nama
    .split(" ")
    .map((k) => (k === "bin" || k === "binti" ? k : /^[A-Z'.]+$/.test(k) && k.length > 2 ? k[0] + k.slice(1).toLowerCase() : k))
    .join(" ");
}

// ─── Jawaban ─────────────────────────────────────────────────────────────────

/** Sikap jawaban per butir "Bahwa ...": diakui / dibantah (untuk klasifikasi jawaban hakim). */
function sikapJawaban(teksMentah) {
  const teks = rapikanTeks(teksMentah);
  const diakui = polaPeran("gugatan", "jawab").filter((p) => p.kunci === "diakui");
  const dibantah = polaPeran("gugatan", "jawab").filter((p) => p.kunci === "dibantah");
  const hasil = { diakui: [], dibantah: [] };
  for (const b of pecahButir(teks)) {
    const t = bersihSpasi(b.teks);
    if (t.length < 25) continue;
    const bantah = adaPola(dibantah, t);
    const aku = !bantah && adaPola(diakui, t);
    if (bantah && hasil.dibantah.length < 12) hasil.dibantah.push(t.slice(0, 260));
    else if (aku && hasil.diakui.length < 12) hasil.diakui.push(t.slice(0, 260));
  }
  return hasil;
}

module.exports = {
  rapikanTeks,
  datarkan,
  angkaDariTerbilang,
  terbilang,
  formatRupiah,
  rupiahTerbilang,
  nominalDari,
  pecahButir,
  bagianDokumen,
  deteksiTuntutan,
  anakDari,
  sikapJawaban,
  kodeSebutan,
  sebutanUntuk,
  LABEL_JENIS,
  URUT_JENIS,
};
