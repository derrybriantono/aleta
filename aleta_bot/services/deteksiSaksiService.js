"use strict";

/**
 * ============================================================================
 * DETEKSI IDENTITAS & HUBUNGAN SAKSI + RANGKAIAN KATA KETERANGAN SAKSI
 * (paket "deteksi lengkap", butir P5 dan P6 - 10 Okt 2026)
 * ============================================================================
 *
 * P5  deteksiHubungan / deteksiIdentitas - pola dari kamus `saksi-hubungan` dan
 *     `saksi-identitas` (kamus-deteksi/awal/*.json + lapis database, dibaca
 *     HANYA lewat kamusDeteksi). Tidak ada satu regex hubungan pun di berkas ini.
 *
 *     Hubungan dikenali dua tahap, sebab kalimat jawaban saksi menyebut BANYAK
 *     orang: "Saya kenal dengan Tergugat sebagai suami Penggugat" - kata "suami"
 *     di situ bukan hubungan saksi. Tahap 1 (pola `jangkar`) mengambil FRASA
 *     sesudah "karena saya (adalah) ..." / "saksi mengaku sebagai ..."; tahap 2
 *     (pola `istilah`) mencocokkan frasa itu UTUH (^...$). Frasa bertingkat
 *     ("sepupu paman", "paman anak para Pemohon") sengaja tidak dikenali -
 *     tidak dikenal lebih baik daripada salah sebut di putusan.
 *
 * P6  susunParagrafSaksi / lengkapiSusunan - templat kamus `kalimat-saksi`:
 *     gaya "lengkap" = gaya blangko putusan derry_briantono (identitas lalu
 *     "- Bahwa ..." per jawaban, persis seperti dicetak ABT lewat
 *     replace_ket_saksi); gaya "ringkas" = satu paragraf "Bahwa saksi I ...
 *     di bawah sumpah pada pokoknya menerangkan bahwa ...".
 *
 *     Peringatan (TIDAK menahan apa pun): saksi di bawah umur, saksi bukan
 *     keluarga pada perkara syiqaq (Pasal 76 ayat (1) UU 7/1989), hanya satu
 *     saksi (unus testis nullus testis).
 *
 * Yang diukur dan angkanya: tools/ukur-deteksi-saksi.js dan field `ukur` di benih.
 */

const kamus = require("./kamusDeteksi");

/**
 * Keputusan orkestrator 10 Okt: hanya pola/templat berstatus "aktif" (atau tanpa
 * status) yang dipakai; "draf" (belum terukur) tersimpan untuk ditinjau saja.
 * Disaring di sini juga, supaya berlaku sekalipun pemuat kamus belum menyaringnya.
 */
function dipakai(x) {
  return Boolean(x) && (!x.status || x.status === "aktif");
}

// ---------------------------------------------------------------------------
// Pembantu teks
// ---------------------------------------------------------------------------

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai)
    .replace(/﻿/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const KATA_SEBUTAN = /^(?:penggugat|tergugat|pemohon|termohon|para|pihak|p|p[1-4]|pi{1,3}|piv|t|t[1-4])$/;
const KATA_SAMBUNG = new Set(["dari", "dengan", "dan", "sebagai", "untuk", "kepada", "/", "&", "atau", "adalah", "yaitu"]);

/** Ragam angka saksi/pihak: i, ii, 1, 2, satu, dua. */
function angkaKe(token) {
  const peta = { i: 1, ii: 2, iii: 3, iv: 4, 1: 1, 2: 2, 3: 3, 4: 4, satu: 1, dua: 2, tiga: 3, empat: 4 };
  return peta[String(token || "").toLowerCase()] || null;
}

/**
 * Label hubungan (kolom Keterangan saksi SIPP / pilihan dropdown) -> frasa dasar
 * dan ekor sebutan pihaknya. "Sepupu 1x Penggugat." -> { frasa: "sepupu 1x",
 * ekor: ["penggugat"] }.
 */
function uraiLabel(teks) {
  let t = bersih(teks)
    .toLowerCase()
    .replace(/[;.,()"'`:]+/g, " ")
    .replace(/\//g, " / ")
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/^(?:saksi\s+(?:ke\s*)?(?:\d+|i{1,3}|iv)?\s*|sebagai\s+)+(?=\S)/, (awal, i, utuh) => (utuh.length > awal.length ? "" : awal));
  let kata = t.split(" ").filter(Boolean);
  // Sebutan di depan ("penggugat anak kandung") dipindah ke belakang.
  if (kata.length > 1 && /^(?:penggugat|tergugat|pemohon|termohon)$/.test(kata[0])) {
    let j = 1;
    if (angkaKe(kata[j])) j += 1;
    if (j < kata.length) kata = [...kata.slice(j), ...kata.slice(0, j)];
  }
  let i = kata.findIndex((k) => KATA_SEBUTAN.test(k));
  if (i < 0) i = kata.length;
  const depan = kata.slice(0, i);
  // "tetangga / pegawai syara" -> bagian pertama saja yang dikenali.
  const garis = depan.indexOf("/");
  const inti = garis > 0 ? depan.slice(0, garis) : depan;
  while (inti.length && KATA_SAMBUNG.has(inti[inti.length - 1])) inti.pop();
  while (inti.length && KATA_SAMBUNG.has(inti[0])) inti.shift();
  return { frasa: inti.join(" "), ekor: kata.slice(i) };
}

// ---------------------------------------------------------------------------
// P5 - hubungan
// ---------------------------------------------------------------------------

function polaHubungan() {
  const semua = kamus.polaKelompok("saksi-hubungan").filter(dipakai);
  /* === KDL2 11 Okt === */
  // jenis "ejaan" = pembetul ejaan petugas ("kanduing" -> "kandung") yang dijalankan SEBELUM istilah
  // dicocokkan - bukan istilah hubungan.
  const ejaan = (p) => p.jenis === "ejaan" || p.kunci === "ejaan";
  return {
    jangkar: semua.filter((p) => p.jenis === "jangkar" || p.kunci === "jangkar"),
    istilah: semua.filter((p) => !(p.jenis === "jangkar" || p.kunci === "jangkar") && !ejaan(p)),
    ejaan: semua.filter(ejaan),
  };
  /* === AKHIR KDL2 === */
}

/* === KDL2 11 Okt === */
/** Ejaan petugas dibetulkan menurut pola "ejaan" kamus (huruf kecil). */
function rapikanEjaan(teks) {
  let t = String(teks || "").toLowerCase();
  for (const p of polaHubungan().ejaan) {
    if (typeof p.ganti !== "string") continue;
    t = t.replace(new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : `${p.re.flags}g`), p.ganti);
  }
  return t;
}

/** Hasil klasifikasi untuk satu dasar (kunci) - dipakai jangkar terbalik ("Tergugat adalah menantu saya" -> Mertua). */
function klasifikasiKunci(kunci, dari) {
  const p = polaHubungan().istilah.find((x) => x.kunci === kunci);
  if (!p) return null;
  const g = p.ukur && p.ukur.golongan;
  return {
    kunci: p.kunci,
    golongan: p.golongan || "lain",
    jk: p.jk || "",
    kode: p.kode,
    kodePola: p.kode,
    kodeAsal: dari ? dari.kode : "",
    yakin: "ragu",
    yakinGolongan: g && g.n >= 30 && g.tepat / g.n >= 0.95 ? "pasti" : "ragu",
    frasa: dari ? dari.frasa : "",
  };
}
/* === AKHIR KDL2 === */

/** Frasa dasar -> istilah kamus yang cocok UTUH, atau null. */
function klasifikasiFrasa(frasa) {
  const f = bersih(frasa).toLowerCase();
  if (!f) return null;
  for (const p of polaHubungan().istilah) {
    if (p.re.test(f)) {
      // Golongan (keluarga/dekat/lain) diukur terpisah dari dasarnya: "Paman"
      // lawan "Keponakan" salah dasar tetapi sama-sama keluarga.
      const g = p.ukur && p.ukur.golongan;
      const yakinGolongan = g && g.n >= 30 && g.tepat / g.n >= 0.95 ? "pasti" : "ragu";
      return {
        kunci: p.kunci,
        golongan: p.golongan || "lain",
        jk: p.jk || "",
        kode: p.kode,
        kodePola: p.kode,
        yakin: p.yakin || "ragu",
        yakinGolongan,
        frasa: f,
      };
    }
  }
  return null;
}

/** Frasa hubungan yang diambil pola jangkar dari sebuah kalimat (urutan kamus). */
function frasaDariKalimat(teks) {
  const t = bersih(teks).toLowerCase();
  const hasil = [];
  for (const p of polaHubungan().jangkar) {
    const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : `${p.re.flags}g`);
    let m;
    while ((m = re.exec(t))) {
      const frasa = m.groups && m.groups.frasa ? m.groups.frasa.trim() : "";
      /* === KDL2 11 Okt === */
      if (frasa) {
        hasil.push({
          frasa,
          jangkar: p.kode,
          ...(p.kebalikan && typeof p.kebalikan === "object" ? { kebalikan: p.kebalikan } : {}),
          // Pihak yang disebut jangkar ("Tergugat adalah menantu saya" -> tergugat) = ekor hubungan.
          ...(m.groups && m.groups.pihak ? { ekor: [m.groups.pihak.toLowerCase()] } : {}),
        });
      }
      /* === AKHIR KDL2 === */
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  return hasil;
}

/**
 * Hubungan saksi dari teks.
 *   bentuk "label"    teks pendek - kolom Keterangan SIPP / pilihan dropdown
 *   bentuk "kalimat"  jawaban saksi / baris identitas - lewat pola jangkar
 *   bentuk "otomatis" (bawaan) kalimat bila jangkarnya ada, label bila teksnya pendek
 * Hasil: { kunci, golongan, jk, kode, yakin, frasa, asal, jangkar? } atau null.
 */
function deteksiHubungan(teks, opsi = {}) {
  /* === KDL2 11 Okt === */
  const t = rapikanEjaan(bersih(teks));
  /* === AKHIR KDL2 === */
  if (!t) return null;
  const bentuk = opsi.bentuk || "otomatis";
  if (bentuk !== "label") {
    for (const c of frasaDariKalimat(t)) {
      const k = klasifikasiFrasa(c.frasa);
      /* === KDL2 11 Okt === */
      // Jangkar terbalik: yang disebut hubungan PIHAK terhadap saksi - dibalik lewat peta `kebalikan`
      // pola jangkarnya; istilah yang tidak berkebalikan pasti (keponakan, cucu) dilewati.
      if (k && c.kebalikan) {
        const kb = klasifikasiKunci(c.kebalikan[k.kunci], k);
        if (kb) return { ...kb, asal: "kalimat", jangkar: c.jangkar, ...(c.ekor ? { ekor: c.ekor } : {}) };
        continue;
      }
      /* === AKHIR KDL2 === */
      if (k) return { ...k, asal: "kalimat", jangkar: c.jangkar };
    }
    if (bentuk === "kalimat") return null;
  }
  if (bentuk === "label" || t.split(/\s+/).length <= 7) {
    const u = uraiLabel(t);
    const k = klasifikasiFrasa(u.frasa);
    if (k) return { ...k, asal: "label", ekor: u.ekor };
  }
  return null;
}

/**
 * Kesetaraan dua dasar hubungan untuk mengukur: sama persis, atau salah satunya
 * PAYUNG yang lain ("Saudara Kandung" memayungi "Kakak Kandung"). Payung tidak
 * menyalahkan yang lebih rinci; dua rincian yang berbeda tetap salah.
 */
const PAYUNG = {
  "Saudara Kandung": ["Kakak Kandung", "Adik Kandung"],
  Saudara: ["Kakak Kandung", "Adik Kandung", "Saudara Kandung", "Saudara Seibu", "Saudara Tiri", "Saudara Sepupu", "Saudara Ipar"],
  Sepupu: ["Sepupu Satu Kali", "Sepupu Dua Kali", "Sepupu Tiga Kali", "Kakak Sepupu", "Adik Sepupu", "Saudara Sepupu"],
  "Saudara Sepupu": ["Sepupu", "Sepupu Satu Kali", "Sepupu Dua Kali", "Sepupu Tiga Kali", "Kakak Sepupu", "Adik Sepupu"],
  Ipar: ["Kakak Ipar", "Adik Ipar", "Saudara Ipar"],
  "Saudara Ipar": ["Kakak Ipar", "Adik Ipar", "Ipar"],
  "Orang Tua Kandung": ["Ibu Kandung", "Ayah Kandung"],
  Tante: ["Bibi"],
  Bibi: ["Tante"],
  Teman: ["Sahabat", "Teman Kerja", "Rekan Kerja"],
  "Teman Kerja": ["Rekan Kerja"],
  "Rekan Kerja": ["Teman Kerja"],
};
function hubunganSetara(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if ((PAYUNG[a] || []).includes(b) || (PAYUNG[b] || []).includes(a)) return true;
  // "Keluarga"/"Kerabat" memayungi seluruh golongan keluarga.
  const keluarga = (x) => {
    const k = klasifikasiFrasa(x.toLowerCase());
    return k && k.golongan === "keluarga";
  };
  if ((a === "Keluarga" || a === "Kerabat") && keluarga(b)) return true;
  if ((b === "Keluarga" || b === "Kerabat") && keluarga(a)) return true;
  return false;
}

/** Daftar ringkas untuk ekstensi (tebakan jenis kelamin & keluarga di blangko saksi SIPP). */
function kamusHubunganRingkas() {
  const lihat = new Map();
  for (const p of polaHubungan().istilah) {
    if (!lihat.has(p.kunci)) lihat.set(p.kunci, { kode: p.kode, kodePola: p.kode, dasar: p.kunci, golongan: p.golongan || "lain", jk: p.jk || "", regex: p.regex, flags: p.flags || "i" });
  }
  return [...lihat.values()];
}

// ---------------------------------------------------------------------------
// P5 - identitas
// ---------------------------------------------------------------------------

/**
 * Medan identitas dari satu baris identitas saksi (gaya putusan/BAS atau
 * ketikan petugas). Medan yang tidak terbaca = "" / null. `kode` menyebut pola
 * yang menemukannya - supaya hasilnya dapat diperiksa dan diukur.
 */
function deteksiIdentitas(teks) {
  const t = String(teks === null || teks === undefined ? "" : teks).replace(/﻿/g, "").replace(/\r\n/g, "\n");
  const hasil = { nama: "", umur: null, agama: "", pendidikan: "", pekerjaan: "", alamat: "", hubungan: null, disumpah: null, bawahUmur: null, kode: {} };
  if (!t.trim()) return hasil;
  const ambil = (kunci) => {
    for (const p of kamus.polaKelompok("saksi-identitas").filter((x) => dipakai(x) && x.kunci === kunci)) {
      const m = p.re.exec(t);
      if (m) return { nilai: m.groups && m.groups.nilai !== undefined ? m.groups.nilai : m[0], kode: p.kode };
    }
    return null;
  };
  const rapikan = (s) => bersih(s).replace(/[\s;,.]+$/, "");
  for (const medan of ["nama", "agama", "pendidikan", "pekerjaan", "alamat"]) {
    const a = ambil(medan);
    if (a) {
      hasil[medan] = rapikan(a.nilai);
      hasil.kode[medan] = a.kode;
    }
  }
  const umur = ambil("umur");
  if (umur && Number.isFinite(Number(umur.nilai))) {
    hasil.umur = Number(umur.nilai);
    hasil.kode.umur = umur.kode;
  }
  const hub = ambil("hubungan");
  if (hub) {
    const teksHub = rapikan(hub.nilai);
    hasil.hubungan = { teks: teksHub, ...(deteksiHubungan(teksHub, { bentuk: "label" }) || {}) };
    hasil.kode.hubungan = hub.kode;
  }
  const tidak = ambil("tidak-disumpah");
  const ya = ambil("disumpah");
  if (tidak) {
    hasil.disumpah = false;
    hasil.kode.disumpah = tidak.kode;
  } else if (ya) {
    hasil.disumpah = true;
    hasil.kode.disumpah = ya.kode;
  }
  const kata = ambil("bawah-umur");
  if (kata) {
    hasil.bawahUmur = true;
    hasil.kode.bawahUmur = kata.kode;
  } else if (hasil.umur !== null) {
    hasil.bawahUmur = hasil.umur < 18;
  }
  return hasil;
}

/** Tiruan fungsi get_umur SIPP: tahun penuh pada tanggal hitung. */
function umurPada(tanggalLahir, tanggalHitung) {
  const iso = (x) => {
    if (!x) return "";
    if (x instanceof Date) return Number.isNaN(x.getTime()) ? "" : x.toISOString().slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x));
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  };
  const a = iso(tanggalLahir);
  const b = iso(tanggalHitung) || iso(new Date());
  if (!a || a <= "1900-01-01" || !b) return null;
  const n = Number(b.slice(0, 4)) - Number(a.slice(0, 4)) - (b.slice(5) < a.slice(5) ? 1 : 0);
  return n >= 0 && n < 130 ? n : null;
}

/** Variabel ABT 2041-2044: Protestan/Katolik berjanji, selain itu bersumpah. */
function bentukSumpah(agama) {
  const janji = /^(?:protestan|katolik|katholik|kristen)/i.test(bersih(agama));
  return janji ? { kata: "janji", kataNya: "janjinya", kerja: "berjanji" } : { kata: "sumpah", kataNya: "sumpahnya", kerja: "bersumpah" };
}

// ---------------------------------------------------------------------------
// P6 - templat
// ---------------------------------------------------------------------------

/** Cadangan bila kamus tidak memuat / menonaktifkan templat - penyusun tidak pernah patah. */
const TEMPLAT_CADANGAN = {
  "saksi-pembuka-lengkap":
    "{nomor}. {nama}[, umur {umur} tahun][, agama {agama}][, pendidikan {pendidikan}][, pekerjaan {pekerjaan}][, bertempat tinggal di {alamat}][, saksi mengaku sebagai {hubungan}], di bawah {sumpahnya} telah memberikan keterangan di muka persidangan yang pada pokoknya sebagai berikut:",
  "saksi-butir-lengkap": "- {isi};",
  "saksi-pembuka-ringkas":
    "Bahwa saksi {urut} {sebutanPihak}[, {nama}][, umur {umur} tahun][, {hubungan}], di bawah {sumpah} pada pokoknya menerangkan bahwa {isi};",
  "saksi-kenal": "saksi kenal dengan {lawan}[ dan {pelaku}][ karena saksi adalah {hubungan}]",
  "saksi-fakta-umum": "{pelaku} {frasa}",
  "saksi-fakta-pisah":
    "{lawan} dan {pelaku} sudah berpisah tempat tinggal[ sejak {pisahSejak}][ selama {lamaPisah}][ dan yang pergi meninggalkan tempat kediaman bersama adalah {yangPergi}]",
  "saksi-upaya-damai": "{lawan} dan {pelaku} sudah diupayakan rukun kembali[ oleh {oleh}], namun tidak berhasil",
  "saksi-penutup-tanggapan": "Bahwa atas keterangan saksi tersebut, {lawan} menyatakan membenarkan dan tidak keberatan;",
};

function templat(kode) {
  const ada = kamus.templatKelompok("kalimat-saksi").filter(dipakai).find((t) => t.kode === kode);
  return ada ? { teks: ada.teks, kode, asal: ada.asal || "benih", syarat: ada.syarat || {} } : { teks: TEMPLAT_CADANGAN[kode] || "", kode, asal: "cadangan", syarat: {} };
}

/** Templat kalimat-saksi untuk satu alasan (syarat.alasan), atau null. */
function templatAlasan(kunciAlasan) {
  const ada = kamus.templatKelompok("kalimat-saksi").filter(dipakai).find((t) => t.syarat && t.syarat.alasan === kunciAlasan);
  return ada ? { teks: ada.teks, kode: ada.kode } : null;
}

/**
 * Isi templat. "[ ... ]" dibuang UTUH bila salah satu {isian} di dalamnya
 * kosong; isian di luar kurung yang kosong menjadi "" lalu spasi dirapikan.
 */
function isiTemplat(teks, nilai) {
  const v = (k) => {
    const x = nilai && Object.prototype.hasOwnProperty.call(nilai, k) ? nilai[k] : "";
    return x === null || x === undefined ? "" : String(x).trim();
  };
  let t = String(teks || "").replace(/\[([^[\]]*)\]/g, (_, isi) => {
    const kunci = [...isi.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    return kunci.every((k) => v(k)) ? isi : "";
  });
  t = t.replace(/\{(\w+)\}/g, (_, k) => v(k));
  return t
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,;:.])/g, "$1")
    .replace(/,\s*,/g, ",")
    .trim();
}

// ---------------------------------------------------------------------------
// P6 - paragraf keterangan saksi
// ---------------------------------------------------------------------------

const ROMAWI = ["", "I", "II", "III", "IV", "V", "VI"];

/** Penutup pemeriksaan - sama dengan POLA_PENUTUP ekstensi (1.189.0), juga bentuk berawalan "saksi". */
const POLA_PENUTUP_JAWAB_BAKU = /^(?:bahwa\s+)?(?:saksi\s+|saya\s+)?(?:sudah\s+)?(?:cukup|tidak\s+ada\s+lagi(?:\s+keterangan)?)\b[\s;.,]*$/i;
// 16 Okt (F1.3): bentuk lentur - lihat penutupSaksi.js. Antarmukanya tetap .test(jawab).
const { adalahKalimatPenutupSaksi } = require("./penutupSaksi");
// 17 Okt: argumen kedua = pertanyaan (menentukan "tidak sanggup lagi": jawaban perkara atau penutup).
const POLA_PENUTUP_JAWAB = { test: (jawab, tanya) => POLA_PENUTUP_JAWAB_BAKU.test(jawab) || adalahKalimatPenutupSaksi(jawab, tanya) };
const KELOMPOK_RINGKAS_DIBUANG = new Set(["maksud", "penutup", "sumpah", "keberatan"]);

/** Seperti replace_ket_saksi ABT (Abt_model.php:855) - dicerminkan abtUsulanService.tiruanReplaceKetSaksi. */
function cetakanAbt(jawab) {
  let t = String(jawab || "");
  t = t.charAt(0).toLowerCase() + t.slice(1);
  t = t
    .replace(/saya/gi, "saksi")
    .replace(/ya, /gi, "")
    .replace(/penggugat/gi, "Penggugat")
    .replace(/pemohon/gi, "Pemohon")
    .replace(/tergugat/gi, "Tergugat")
    .replace(/termohon/gi, "Termohon");
  return `Bahwa ${t}`;
}

function tanpaAkhir(teks) {
  return bersih(teks).replace(/[\s;,.]+$/, "");
}

/**
 * Hubungan untuk ditulis di paragraf: dasar kamus + sebutan MENURUT JENIS
 * PERKARA (lawan = 0046 Penggugat/Pemohon, pelaku = 0047 Tergugat/Termohon).
 * Label SIPP yang tidak dikenali ditulis apa adanya (seperti ABT mencetak #1241#).
 */
function hubunganTampil(label, hasilDeteksi, pihakSaksi, lawan, pelaku) {
  const L = lawan || "Penggugat";
  const P = pelaku || "Tergugat";
  if (!hasilDeteksi) return tanpaAkhir(label);
  const ekor = (hasilDeteksi.ekor || []).join(" ");
  let sebutan;
  const satu = /\b(?:penggugat|pemohon|p\d?|pi{1,3})\b/.test(ekor);
  const dua = /\b(?:tergugat|termohon)\b/.test(ekor);
  const ke = (ekor.match(/\b(?:penggugat|pemohon)\s+(i{1,3}|iv|[1-4])\b/) || ekor.match(/\bp(i{1,3}|[1-4])\b/) || [])[1];
  if (/\bpara\b/.test(ekor)) sebutan = `para ${L}`;
  else if (satu && dua) sebutan = `${L} dan ${P}`;
  else if (dua) sebutan = P;
  else if (satu && ke) sebutan = `${L} ${ROMAWI[angkaKe(ke)] || ""}`.trim();
  else if (satu) sebutan = L;
  else sebutan = pihakSaksi === "T" ? P : L;
  return `${hasilDeteksi.kunci} ${sebutan}`;
}

/** Sebutan yang salah untuk jenis perkara di label SIPP ("Penggugat" pada cerai talak). */
function sebutanLabelSalah(label, lawan, pelaku) {
  const kata = (bersih(label).toLowerCase().match(/\b(?:penggugat|tergugat|pemohon|termohon)\b/g) || []);
  const boleh = new Set([String(lawan || "").toLowerCase(), String(pelaku || "").toLowerCase()].filter(Boolean));
  if (!boleh.size) return "";
  return kata.find((k) => !boleh.has(k)) || "";
}

/**
 * Satu paragraf saksi dalam dua gaya.
 *   saksi     { ke, pihak 'P'|'T', urutPihak, jawaban:[{tanya, jawab, belumTerisi?}] }
 *   identitas { nama, umur, agama, pendidikan, pekerjaan, alamat, keterangan } (SIPP) atau null
 *   opsi      { lawan, pelaku, kelompokTanya(fn), fakta, penutup:"tanggapan", tandaBelumTerisi }
 */
function susunParagrafSaksi(saksi, identitas, opsi = {}) {
  const lawan = opsi.lawan || "Penggugat";
  const pelaku = opsi.pelaku || "Tergugat";
  const pihak = saksi && saksi.pihak === "T" ? "T" : "P";
  const urutPihak = Number(saksi && saksi.urutPihak) || 1;
  const id = identitas && typeof identitas === "object" ? identitas : {};
  const jawaban = Array.isArray(saksi && saksi.jawaban) ? saksi.jawaban : [];
  const kelompokTanya = typeof opsi.kelompokTanya === "function" ? opsi.kelompokTanya : () => ({ kelompok: "" });
  const tanda = opsi.tandaBelumTerisi || "[BELUM TERISI";

  // Hubungan: kolom Keterangan SIPP dulu, lalu jawaban "kenal" saksi sendiri.
  let hubungan = null;
  const label = bersih(id.keterangan);
  if (label) {
    const d = deteksiHubungan(label, { bentuk: "label" });
    hubungan = { teks: hubunganTampil(label, d, pihak, lawan, pelaku), deteksi: d, asal: "sipp", sebutanSalah: sebutanLabelSalah(label, lawan, pelaku) };
  }
  if (!hubungan) {
    for (const b of jawaban) {
      if (b && b.belumTerisi) continue;
      const d = deteksiHubungan(b && b.jawab, { bentuk: "kalimat" });
      if (d) {
        hubungan = { teks: hubunganTampil("", { ...d, ekor: [] }, pihak, lawan, pelaku), deteksi: d, asal: "jawaban" };
        break;
      }
    }
  }

  const sumpah = bentukSumpah(id.agama);
  const nilaiId = {
    nama: bersih(id.nama),
    umur: id.umur === null || id.umur === undefined || id.umur === "" ? "" : String(id.umur),
    agama: bersih(id.agama),
    pendidikan: bersih(id.pendidikan),
    pekerjaan: bersih(id.pekerjaan),
    alamat: tanpaAkhir(id.alamat),
    hubungan: hubungan ? hubungan.teks : "",
    sumpah: sumpah.kata,
    sumpahnya: sumpah.kataNya,
    nomor: String(urutPihak),
    urut: ROMAWI[urutPihak] || String(urutPihak),
    sebutanPihak: pihak === "T" ? pelaku : lawan,
    lawan,
    pelaku,
  };
  if (!nilaiId.nama) nilaiId.nama = `Saksi ${ROMAWI[urutPihak] || urutPihak} ${nilaiId.sebutanPihak}`;

  // Butir jawaban: penutup pemeriksaan dibuang (pembersih 1.189.0).
  const butir = [];
  let dibuangPenutup = 0;
  for (const b of jawaban) {
    const jawab = bersih(b && b.jawab);
    if (!jawab) continue;
    if (POLA_PENUTUP_JAWAB.test(jawab, bersih(b.tanya))) {
      dibuangPenutup++;
      continue;
    }
    const kel = kelompokTanya(bersih(b.tanya)).kelompok || "";
    butir.push({ jawab, kelompok: kel, belum: Boolean(b.belumTerisi) || jawab.startsWith(tanda) });
  }

  // ---- lengkap ------------------------------------------------------------
  const tBut = templat("saksi-butir-lengkap");
  const barisLengkap = butir.map((b) => isiTemplat(tBut.teks, { isi: b.belum ? b.jawab : tanpaAkhir(cetakanAbt(b.jawab)) }));
  const lengkap = [isiTemplat(templat("saksi-pembuka-lengkap").teks, nilaiId), ...barisLengkap].join("\n");

  // ---- ringkas ------------------------------------------------------------
  const potong = (s) => {
    const t = tanpaAkhir(cetakanAbt(s)).replace(/^Bahwa\s+/, "");
    return t.charAt(0).toLowerCase() + t.slice(1);
  };
  const isiRingkas = [];
  const adaKenal = butir.some((b) => b.kelompok === "kenal");
  if (!adaKenal) isiRingkas.push(isiTemplat(templat("saksi-kenal").teks, { lawan, pelaku, hubungan: hubungan && hubungan.deteksi ? hubungan.teks : "" }));
  const pakai = butir.filter((b) => !b.belum && !KELOMPOK_RINGKAS_DIBUANG.has(b.kelompok));
  for (const b of pakai) isiRingkas.push(potong(b.jawab));
  // Fakta masukan (hasil deteksi alasan/waktu/pelaku) HANYA bila saksi belum
  // punya jawaban pokok sama sekali - keterangan saksi tidak pernah ditambah
  // dari gugatan.
  let dariFakta = false;
  if (pakai.length === 0 && opsi.fakta && typeof opsi.fakta === "object") {
    const f = opsi.fakta;
    for (const a of Array.isArray(f.alasan) ? f.alasan : []) {
      const kunci = typeof a === "string" ? a : a && a.kunci;
      const t = templatAlasan(kunci);
      const frasa = a && typeof a === "object" ? a.frasa : "";
      const kal = t ? isiTemplat(t.teks, { ...f, lawan, pelaku }) : frasa ? isiTemplat(templat("saksi-fakta-umum").teks, { pelaku, frasa }) : "";
      if (kal) isiRingkas.push(kal);
    }
    if (f.pisahSejak || f.lamaPisah) isiRingkas.push(isiTemplat(templat("saksi-fakta-pisah").teks, { ...f, lawan, pelaku }));
    if (f.upaya) isiRingkas.push(isiTemplat(templat("saksi-upaya-damai").teks, { lawan, pelaku, oleh: f.upayaOleh || "" }));
    dariFakta = isiRingkas.length > (adaKenal ? 0 : 1);
  }
  const gabung = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")}, dan ${xs[xs.length - 1]}`);
  const ringkas = isiTemplat(templat("saksi-pembuka-ringkas").teks, { ...nilaiId, isi: gabung(isiRingkas.filter(Boolean)) });

  const penutup = opsi.penutup === "tanggapan" ? isiTemplat(templat("saksi-penutup-tanggapan").teks, { lawan, pelaku }) : "";

  return {
    ke: Number(saksi && saksi.ke) || null,
    pihak,
    urutPihak,
    label: `Saksi ${urutPihak} ${pihak}`,
    identitas: {
      nama: bersih(id.nama),
      umur: nilaiId.umur === "" ? null : Number(nilaiId.umur),
      agama: nilaiId.agama,
      pendidikan: nilaiId.pendidikan,
      pekerjaan: nilaiId.pekerjaan,
      alamat: nilaiId.alamat,
      sumpah: sumpah.kerja,
    },
    hubungan: hubungan
      ? {
          teks: hubungan.teks,
          asal: hubungan.asal,
          kunci: hubungan.deteksi ? hubungan.deteksi.kunci : "",
          golongan: hubungan.deteksi ? hubungan.deteksi.golongan : "",
          yakin: hubungan.deteksi ? hubungan.deteksi.yakin : "ragu",
          kode: hubungan.deteksi ? hubungan.deteksi.kode : "",
          kodePola: hubungan.deteksi ? hubungan.deteksi.kode : "",
          ...(hubungan.sebutanSalah ? { sebutanSalah: hubungan.sebutanSalah } : {}),
        }
      : null,
    // Jejak koreksi (agen 4): templat kamus yang menyusun paragraf ini.
    kodePola: "saksi-pembuka-lengkap",
    kodePolaGaya: { lengkap: "saksi-pembuka-lengkap", ringkas: "saksi-pembuka-ringkas" },
    lengkap: penutup ? `${lengkap}\n${penutup}` : lengkap,
    ringkas: penutup ? `${ringkas}\n${penutup}` : ringkas,
    dibuangPenutup,
    belumTerisi: butir.filter((b) => b.belum).length,
    ...(dariFakta ? { dariFakta: true } : {}),
  };
}

/** Perkara syiqaq / perselisihan terus-menerus (Pasal 76 UU 7/1989) dari daftar alasan susunan. */
function perkaraSyiqaq(alasan) {
  return (Array.isArray(alasan) ? alasan : []).some((a) => /perselisihan|syiqaq|pertengkaran/i.test(String(a)));
}

/**
 * Peringatan RINGAN - disebut, tidak menahan penyimpanan.
 *   paragraf  hasil susunParagrafSaksi untuk tiap saksi
 *   opsi      { alasan: [...], lawan, pelaku }
 */
function peringatanSaksi(paragraf, opsi = {}) {
  const daftar = Array.isArray(paragraf) ? paragraf : [];
  const hasil = [];
  const tambah = (kode, tingkat, pesan, saksi, kodePola) =>
    hasil.push({ kode, tingkat, pesan, ...(saksi ? { saksi } : {}), ...(kodePola ? { kodePola } : {}) });
  const lawan = opsi.lawan || "Penggugat";
  const pelaku = opsi.pelaku || "Tergugat";

  for (const pihak of ["P", "T"]) {
    const n = daftar.filter((p) => p.pihak === pihak).length;
    if (n === 1) {
      tambah(
        "satu-saksi",
        "ringan",
        `Hanya satu saksi ${pihak === "T" ? pelaku : lawan}. Satu saksi saja bukan saksi (unus testis nullus testis, Pasal 306 RBg / 169 HIR) - perlu saksi kedua atau alat bukti lain.`
      );
    }
  }

  const syiqaq = perkaraSyiqaq(opsi.alasan);
  let adaKeluarga = false;
  for (const p of daftar) {
    const umur = p.identitas ? p.identitas.umur : null;
    if (umur !== null && umur !== undefined && Number.isFinite(umur)) {
      if (umur < 15) {
        tambah("bawah-umur", "ringan", `${p.label} berumur ${umur} tahun - anak di bawah 15 tahun tidak dapat didengar sebagai saksi di bawah sumpah (Pasal 172 RBg / 145 HIR); keterangannya hanya penjelasan.`, p.label);
      } else if (umur < 18) {
        tambah("belum-dewasa", "ringan", `${p.label} berumur ${umur} tahun (belum dewasa) - periksa kecakapannya sebagai saksi.`, p.label);
      }
    } else if (p.identitas && p.identitas.nama) {
      tambah("umur-kosong", "info", `Umur ${p.label} belum terisi di SIPP (tanggal lahir kosong).`, p.label);
    }
    const gol = p.hubungan && p.hubungan.golongan;
    if (gol === "keluarga") adaKeluarga = true;
    if (!p.hubungan) {
      tambah("hubungan-kosong", "info", `Hubungan ${p.label} dengan para pihak belum tercatat (kolom Keterangan saksi SIPP kosong dan jawaban kenal tidak menyebutnya).`, p.label);
    } else if (p.hubungan.sebutanSalah) {
      tambah(
        "sebutan-salah",
        "info",
        `Keterangan saksi di SIPP memakai "${p.hubungan.sebutanSalah}" yang bukan sebutan pihak perkara ini - di paragraf ditulis "${p.hubungan.teks}".`,
        p.label
      );
    }
    if (syiqaq && p.hubungan && gol && gol !== "keluarga") {
      tambah(
        "syiqaq-bukan-keluarga",
        "ringan",
        gol === "dekat"
          ? `${p.label} (${p.hubungan.kunci}) bukan keluarga. Perkara perselisihan/syiqaq: Pasal 76 ayat (1) UU 7/1989 meminta saksi dari keluarga atau orang dekat suami-istri - catat kedekatannya.`
          : `${p.label} (${p.hubungan.kunci || p.hubungan.teks}) bukan keluarga dan bukan orang dekat. Perkara perselisihan/syiqaq: Pasal 76 ayat (1) UU 7/1989 meminta saksi dari keluarga atau orang dekat suami-istri.`,
        p.label,
        p.hubungan.kode // pola kamus yang menentukan golongannya
      );
    }
  }
  if (syiqaq && daftar.length && !adaKeluarga && daftar.every((p) => p.hubungan && p.hubungan.golongan)) {
    tambah("syiqaq-tanpa-keluarga", "ringan", "Tidak ada satu pun saksi dari keluarga - Pasal 76 ayat (1) UU 7/1989 (syiqaq) mendahulukan keluarga para pihak.");
  }
  return hasil;
}

/**
 * Dipanggil rute saksi-sdg sesudah susunKeteranganSaksiSdg. Tidak mengubah
 * tanya-jawab yang disusun; hanya MENAMBAH paragrafSaksi + peringatanSaksi.
 *   hasil      jawaban susunKeteranganSaksiSdg (ok:true)
 *   opsi       { identitas: [{pihak, urutPihak, ...}] dari SIPP atau null,
 *                lawan, pelaku, kelompokTanya, penutup }
 */
function lengkapiSusunan(hasil, opsi = {}) {
  if (!hasil || !hasil.ok || !Array.isArray(hasil.saksi)) return {};
  const identitas = Array.isArray(opsi.identitas) ? opsi.identitas : [];
  const hitung = { P: 0, T: 0 };
  const paragraf = hasil.saksi.map((s) => {
    const pihak = s.pihak === "T" ? "T" : "P";
    hitung[pihak] += 1;
    const urutPihak = hitung[pihak];
    const id = identitas.find((x) => x && x.pihak === pihak && Number(x.urutPihak) === urutPihak) || null;
    return susunParagrafSaksi({ ...s, pihak, urutPihak }, id, {
      lawan: opsi.lawan,
      pelaku: opsi.pelaku,
      kelompokTanya: opsi.kelompokTanya,
      penutup: opsi.penutup,
      tandaBelumTerisi: hasil.tandaBelumTerisi,
    });
  });
  return {
    paragrafSaksi: paragraf,
    peringatanSaksi: peringatanSaksi(paragraf, { alasan: hasil.alasan, lawan: opsi.lawan, pelaku: opsi.pelaku }),
    identitasAsal: identitas.length ? "sipp" : "",
  };
}

module.exports = {
  // P5
  deteksiHubungan,
  deteksiIdentitas,
  klasifikasiFrasa,
  frasaDariKalimat,
  uraiLabel,
  hubunganSetara,
  kamusHubunganRingkas,
  umurPada,
  bentukSumpah,
  // P6
  isiTemplat,
  susunParagrafSaksi,
  peringatanSaksi,
  lengkapiSusunan,
  hubunganTampil,
  cetakanAbt,
  POLA_PENUTUP_JAWAB,
};
