"use strict";

/**
 * ============================================================================
 * DETEKSI VARIABEL BLANGKO DISPENSASI KAWIN (PUTUSAN DAN BAS) - butir 15, 13 Okt
 * ============================================================================
 *
 * Blangko Derry DK (putusan [01]-[03], BAS [1]-[2a]) memakai 18 variabel yang
 * diisi tangan (data_teks/data_tanggal). Sampai 1.198.0 panel ABT hanya
 * mengusulkan lima (0606, 0600, 0607, 0601, 5178), dan pada 231/Pdt.P/2026
 * hanya satu: posita menulis anak perempuan para Pemohon "Awliya ... bin
 * Mohtar Syawal", sedangkan pengurai lama (calonMempelai) menentukan jenis
 * kelamin HANYA dari "bin/binti" - tanpa "binti" tidak ada calon wanita, dan
 * umurnya ikut hilang.
 *
 * Modul ini menurunkan variabel DK dari POSITA dengan menentukan PERAN lebih
 * dulu - siapa ANAK para Pemohon dan siapa CALON PASANGANNYA - lalu jenis
 * kelaminnya dari bukti yang tertulis (anotasi "(calon mempelai wanita)",
 * "seorang laki-laki", bin/binti, "anak para Pemohon sedang hamil", "calon
 * isterinya"). Sebutan tidak pernah tertukar dengan Pemohon: nama Pemohon
 * tidak pernah dibaca sebagai calon, sebab yang dicari hanya nama sesudah
 * "anak (para) Pemohon ... bernama" dan sesudah "dengan" di kalimat yang sama.
 *
 *   Variabel    Sumber
 *   0606/0600   posita - kalimat "menikahkan anak para Pemohon ... dengan ..."
 *   0607/0601   posita - "umur/berumur/usia N tahun" milik nama itu, daftar
 *               anak, atau "anak para Pemohon ... masih berumur N tahun"
 *   0349        posita - "lahir di X, tanggal" sesudah nama calon wanita
 *   1666        posita - "saling mengenal / menjalin hubungan / berpacaran selama N"
 *   0999        posita - "sedang hamil N minggu (atau sekitar M bulan)"
 *   0997        posita - "dari/oleh UPTD Puskesmas X"
 *   1551        posita - nama sesudah bin/binti calon PASANGAN anak para Pemohon
 *   0609/0610   posita - blok identitas calon wanita (pendidikan, pekerjaan)
 *   0603/0604   posita - blok identitas calon pria; 6331 = pekerjaan calon pria
 *   2029/2030   posita - "berstatus jejaka/perawan" milik calon itu
 *   0602/0608, 0605/0611, 0340/0344   agama, alamat, tempat lahir (blangko lama)
 *
 * Tidak terdeteksi (tidak ada sumber yang dapat dibaca bot): 1552 (ibu calon
 * pasangan tidak pernah disebut posita), 8812 tanggal ijazah dan 9956 daftar
 * bukti surat (hanya di pindaian bukti; e-Court DK baru 8 perkara), saksi
 * 1197-1208/1241/1242 (data_sql - ABT sendiri menghitungnya dari saksi SIPP,
 * dan rute simpan ABT menolak tulisan ke data_sql).
 *
 * Nilai lazim ("gadis", "Islam") TIDAK PERNAH ditebak: tiap usulan membawa
 * kalimat posita sumbernya. Keyakinan "cukup" (tercentang) hanya untuk variabel
 * yang lulus gerbang ukur (presisi >= 0,9 dan n >= 10 atas isian hakim di ABT);
 * selebihnya "ragu" - tampil TIDAK tercentang. Angka ukurnya di UKUR_DK.
 *
 * Layanan ini tidak menulis apa pun dan tidak membaca aps_badilag.
 */

const usulanService = require("./abtUsulanService");

const JENIS_DK = 362;

/* ============================================================================
 * GERBANG UKUR - diukur 13 Okt 2026 atas 199 perkara DK server (baca-saja),
 * pembanding = isian hakim di aps_badilag.abt_data_teks. Skrip:
 * D:/aleta-dev/kerja/deteksi-dk/ukur.js. n = usulan yang dapat dibandingkan,
 * benar = sama dengan isian hakim. Angka disalin apa adanya dari keluarannya.
 * ========================================================================== */
const GERBANG_DK = Object.freeze({ presisiMinimal: 0.9, nMinimal: 10 });
const UKUR_DK = Object.freeze({
  // modul ini sendiri; banding = pengurai lama (calonMempelai/umurCalon) pada perkara yang sama
  "0606": { n: 46, benar: 46, banding: { n: 46, benar: 46 } },
  "0600": { n: 38, benar: 38, banding: { n: 38, benar: 37 } },
  "0607": { n: 38, benar: 36, banding: { n: 38, benar: 36 } },
  "0601": { n: 11, benar: 11, banding: { n: 11, benar: 11 } },
  "1551": { n: 8, benar: 6 },
  "1666": { n: 9, benar: 5 },
  "0999": { n: 4, benar: 1 },
  "0609": { n: 2, benar: 2 },
  "0603": { n: 2, benar: 2 },
  "0604": { n: 2, benar: 2 },
  "0608": { n: 2, benar: 2 },
  "0602": { n: 2, benar: 2 },
  "0611": { n: 2, benar: 2 },
  "0605": { n: 2, benar: 2 },
});

function yakinTerukur(kode) {
  const u = UKUR_DK[kode];
  if (!u || u.n < GERBANG_DK.nMinimal || u.benar / u.n < GERBANG_DK.presisiMinimal) return "ragu";
  return "cukup";
}

/* ============================================================================
 * PEMBANTU TEKS
 * ========================================================================== */

/** Posita polos satu baris; pergantian baris jadi "; " supaya ruas tidak menyambung. */
function polos(posita) {
  return usulanService
    .polosPosita(posita)
    .replace(/\n+/g, "; ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const nrm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function terbilang(n) {
  const SEBUT = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  const x = Number(n);
  if (!Number.isInteger(x) || x < 0 || x > 99) return "";
  if (x < 12) return SEBUT[x];
  if (x < 20) return `${SEBUT[x - 10]} belas`;
  return `${SEBUT[Math.floor(x / 10)]} puluh${x % 10 ? ` ${SEBUT[x % 10]}` : ""}`;
}

/** "7 (tujuh) bulan" - bentuk isian bawaan blangko ("_ (_) tahun"). */
function waktuBerbilang(angka, satuan) {
  const t = terbilang(angka);
  return t ? `${Number(angka)} (${t}) ${satuan}` : `${angka} ${satuan}`;
}

/** Kalimat (ruas di antara titik koma / titik akhir kalimat) yang memuat indeks i. */
function kalimatDi(teks, i, panjang) {
  const awal = Math.max(teks.lastIndexOf(";", i), teks.lastIndexOf(". ", i)) + 1;
  let akhir = teks.indexOf(";", i + (panjang || 0));
  if (akhir < 0) akhir = teks.length;
  return teks.slice(awal, akhir).trim().slice(0, 400);
}

/* ============================================================================
 * PERAN: ANAK PARA PEMOHON DAN CALON PASANGANNYA
 * ========================================================================== */

const POLA_ANAK = /\b(?:anak(?:-anak)?|adik|keponakan|cucu)\s+(?:kandung\s+)?(?:dari\s+)?(?:para\s+)?Pemohon(?:\s+I{1,2}\b)?(?:\s+(?:I|II)\s+dan\s+(?:I|II))?\s*(?:tersebut\s+)?(?:,\s*)?(?:yang\s+)?(?:masing-masing\s+)?(?:bernama|atas\s+nama)\s*:?\s*/i;
const POLA_NIKAH = /menikahkan|dinikahkan|akan\s+menikah|untuk\s+menikah\s+dengan|melangsungkan\s+(?:pernikahan|perkawinan)|mengawinkan|dikawinkan/i;
const POLA_PASANGAN =
  /^[^;]{0,200}?\bdengan\s+(?:(?:seorang|calon)\s+)?(?:(laki-laki|laki\s+laki|pria|pemuda|perempuan|wanita|gadis|suami(?:nya)?|istri(?:nya)?|isteri(?:nya)?)\s+)?(?:(?:calon\s+)?(?:suami|istri|isteri)(?:nya)?\s+)?(?:anak\s+(?:para\s+)?Pemohon(?:\s+I{1,2})?\s+)?(?:yang\s+)?(?:bernama|atas\s+nama)?\s*:?\s*/i;

const JK_KATA = (kata) => {
  const k = String(kata || "").toLowerCase();
  if (/laki|pria|pemuda|suami/.test(k)) return "L";
  if (/perempuan|wanita|gadis|istri|isteri/.test(k)) return "P";
  return "";
};

function penyambung(nama) {
  const m = String(nama || "").match(/\s(bin|binti)\s/i);
  return m ? (m[1].toLowerCase() === "binti" ? "P" : "L") : "";
}

/** Anotasi "(calon mempelai wanita/pria)" tepat sesudah nama. */
function anotasiSesudah(teks) {
  const m = String(teks || "").match(/^\s*,?\s*(?:[^();]{0,60}?)\(\s*calon\s+mempelai\s+(wanita|perempuan|pria|laki-laki|laki\s+laki)\s*\)/i);
  return m ? JK_KATA(m[1]) : "";
}

function namaDari(teks) {
  return usulanService.namaDiAwal(String(teks || "").replace(/^[\s:]+/, "")).replace(/\s+alias\s*$/i, "").trim();
}

/** Ganti "bin"<->"binti" supaya sesuai jenis kelamin; "" bila tidak ada penyambung. */
function sesuaikanPenyambung(nama, jk) {
  if (!jk) return nama;
  return String(nama).replace(/\s(bin|binti)\s/i, () => (jk === "P" ? " binti " : " bin "));
}

/**
 * Peran dari kalimat menikahkan.
 * @returns {{anak, pasangan, wanita, pria, kalimat, bukti: string[], jkPasti: boolean} | null}
 *   anak/pasangan = {nama, namaTertulis, jk, letak}
 */
function uraiCalon(teks) {
  const t = String(teks || "");
  const kandidat = [];
  const pola = new RegExp(POLA_ANAK.source, "gi");
  let m;
  while ((m = pola.exec(t)) !== null) {
    const kal = kalimatDi(t, m.index, m[0].length);
    if (!POLA_NIKAH.test(kal) && !/syarat\s+perkawinan/i.test(kal)) continue;
    const sisa = t.slice(m.index + m[0].length);
    const namaA = namaDari(sisa);
    if (!namaA || namaA.split(" ").length > 12) continue;
    const sesudahA = sisa.slice(sisa.indexOf(namaA) + namaA.length);
    let d = sesudahA.match(POLA_PASANGAN);
    // Nama pasangan harus diawali huruf besar - "dengan calon Istri anak ..." bukan nama.
    if (!d || !/^[A-Z]/.test(sesudahA.slice(d[0].length))) d = null;
    if (!d) {
      // Pasangan di kalimat berikutnya: "... segera menikah dengan calon istrinya bernama X" (3/2019).
      const jauh = sesudahA.slice(0, 600).match(/\bdengan\s+calon\s+(suami|istri|isteri)(?:nya)?\s+(?:yang\s+)?(?:bernama|atas\s+nama)?\s*:?\s*(?=[A-Z])/);
      if (!jauh) continue;
      d = jauh;
    }
    const awalB = d.index + d[0].length;
    const letakDengan = d.index + Math.max(0, d[0].search(/dengan/i));
    const namaB = namaDari(sesudahA.slice(awalB));
    if (!namaB || nrm(namaB) === nrm(namaA) || /^(?:istri|isteri|suami|calon|pemohon|anak)$/i.test(namaB)) continue;
    kandidat.push({
      nikah: POLA_NIKAH.test(kal) ? 1 : 0,
      letakA: m.index + m[0].length,
      namaA,
      namaB,
      anotA: anotasiSesudah(sesudahA.slice(0, letakDengan)),
      kataB: d[1] || "",
      anotB: anotasiSesudah(sesudahA.slice(awalB + sesudahA.slice(awalB).indexOf(namaB) + namaB.length)),
      kalimat: kal,
    });
  }
  if (!kandidat.length) return null;
  // Kalimat "menikahkan" didahulukan dari "syarat perkawinan".
  kandidat.sort((a, b) => b.nikah - a.nikah || a.letakA - b.letakA);
  const k = kandidat[0];
  const bukti = [];
  const suara = { A: { L: 0, P: 0 }, B: { L: 0, P: 0 } };
  const tambah = (siapa, jk, bobot, sebab) => {
    if (!jk) return;
    suara[siapa][jk] += bobot;
    suara[siapa === "A" ? "B" : "A"][jk === "L" ? "P" : "L"] += bobot;
    bukti.push(sebab);
  };
  tambah("A", k.anotA, 3, `anotasi calon mempelai pada ${k.namaA}`);
  tambah("B", k.anotB, 3, `anotasi calon mempelai pada ${k.namaB}`);
  tambah("B", JK_KATA(k.kataB), 3, `"dengan ${k.kataB}"`);
  // Penyambung keduanya berlawanan (bin + binti) = bukti kuat; sama (bin + bin) tidak membedakan.
  const pA = penyambung(k.namaA);
  const pB = penyambung(k.namaB);
  const bobotPenyambung = pA && pB && pA !== pB ? 2 : 1;
  tambah("A", pA, bobotPenyambung, `penyambung nama ${k.namaA}`);
  tambah("B", pB, bobotPenyambung, `penyambung nama ${k.namaB}`);
  // Isyarat di seluruh posita - penentu HANYA bila penyambung tidak membedakan:
  // kalimat baku "anak para Pemohon sekarang sedang hamil" tersalin juga ke
  // posita yang anaknya laki-laki (141/2024, 20/2025, 33/2025).
  const umum = (jk, sebab) => {
    if (bobotPenyambung < 2) tambah("A", jk, 1, sebab);
  };
  if (/\banak\s+(?:para\s+)?Pemohon(?:\s+I{1,2})?(?:\s+tersebut)?\s+(?:sekarang\s+|saat\s+ini\s+|telah\s+|sudah\s+)*(?:sedang\s+)?hamil\b/i.test(t)) umum("P", "anak para Pemohon sedang hamil");
  if (/\bcalon\s+(?:istri|isteri)(?:nya)?\b/i.test(t) && !/\bcalon\s+suami(?:nya)?\b/i.test(t)) umum("L", "posita menyebut calon isterinya");
  if (/\bcalon\s+suami(?:nya)?\b/i.test(t) && !/\bcalon\s+(?:istri|isteri)(?:nya)?\b/i.test(t)) umum("P", "posita menyebut calon suaminya");
  const jkA = suara.A.P > suara.A.L ? "P" : suara.A.L > suara.A.P ? "L" : "";
  if (!jkA) return { anak: { nama: k.namaA, namaTertulis: k.namaA, jk: "" }, pasangan: { nama: k.namaB, namaTertulis: k.namaB, jk: "" }, wanita: null, pria: null, kalimat: k.kalimat, bukti, jkPasti: false };
  const jkB = jkA === "P" ? "L" : "P";
  // Pasti: penyambung keduanya cocok dengan peran dan tidak ada suara yang berlawanan.
  const lawan = jkA === "P" ? suara.A.L : suara.A.P;
  const cocokPenyambung = penyambung(k.namaA) === jkA && penyambung(k.namaB) === jkB;
  const anak = { nama: sesuaikanPenyambung(k.namaA, jkA), namaTertulis: k.namaA, jk: jkA };
  const pasangan = { nama: sesuaikanPenyambung(k.namaB, jkB), namaTertulis: k.namaB, jk: jkB };
  return {
    anak,
    pasangan,
    wanita: jkA === "P" ? anak : pasangan,
    pria: jkA === "L" ? anak : pasangan,
    kalimat: k.kalimat,
    bukti,
    jkPasti: lawan === 0 && cocokPenyambung,
  };
}

/* ============================================================================
 * FAKTA PER ORANG - UMUR, LAHIR, BLOK IDENTITAS
 * ========================================================================== */

/** Letak tiap kemunculan nama (dicocokkan dua kata pertamanya, huruf kecil). */
function letakNama(teks, nama) {
  // Kata nama DIRI (sebelum bin/binti/alias): dua kata pertama; nama satu kata
  // harus diikuti penyambung, koma, atau kurung supaya "Tasya" tidak cocok di mana saja.
  const semua = String(nama || "").split(/\s+/);
  const ujung = semua.findIndex((k) => /^(bin|binti|alias)$/i.test(k));
  const kata = (ujung < 0 ? semua : semua.slice(0, ujung)).filter(Boolean);
  if (!kata.length) return [];
  const kepala = kata.slice(0, Math.min(2, kata.length)).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const ekor = kepala.length === 1 ? "(?=\\s+(?:bin|binti|alias)\\b|\\s*[,(])" : "\\b";
  const re = new RegExp(`\\b${kepala.join("\\s+")}${ekor}`, "gi");
  const hasil = [];
  let m;
  while ((m = re.exec(teks)) !== null) hasil.push(m.index);
  return hasil;
}

/** Ruas sesudah nama: berhenti pada titik koma, nama berpenyambung lain, atau "dengan". */
function ruasSesudah(teks, i, nama) {
  const awal = i;
  let ruas = teks.slice(awal, awal + 360);
  const ujung = ruas.indexOf(";");
  if (ujung > 0) ruas = ruas.slice(0, ujung);
  // Lewati nama itu sendiri (sampai sesudah ayahnya), lalu potong di "dengan" / nama berikut.
  const n = namaDari(ruas);
  const sisa = ruas.slice(n ? ruas.indexOf(n) + n.length : 0);
  const henti = sisa.search(/\bdengan\s+(?:seorang|calon|yang|[A-Z])|\b(?:bin|binti)\b/);
  void nama;
  return { kepala: ruas.slice(0, n ? ruas.indexOf(n) + n.length : 0), isi: henti >= 0 ? sisa.slice(0, henti) : sisa };
}

const POLA_UMUR = /(?:\bumur|\busia|\bberumur|\bberusia)\s*:?\s*(?:kurang\s+lebih\s+|lebih\s+kurang\s+|±\s*|sekitar\s+)?(\d{1,2})\s*(?:\([^)]{1,30}\)\s*)?tahun(?:\s*,?\s*(\d{1,2})\s*(?:\([^)]{1,30}\)\s*)?bulan)?/i;

function bentukUmur(m) {
  return m[2] ? `${Number(m[1])} tahun ${Number(m[2])} bulan` : `${Number(m[1])} tahun`;
}

const BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const POLA_LAHIR = /\blahir\s+(?:di\s+([A-Z][A-Za-z'. -]{1,40}?)\s*,?\s*)?(?:pada\s+)?(?:tanggal\s+|tgl\.?\s+)?(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s-]+(\d{4})/;

function tanggalLahir(m) {
  const b = BULAN.findIndex((x) => x.startsWith(m[3].toLowerCase().slice(0, 3)));
  if (b < 0) return "";
  return `${Number(m[2])} ${BULAN[b].charAt(0).toUpperCase()}${BULAN[b].slice(1)} ${m[4]}`;
}

/** Nilai satu ruas identitas: "pendidikan terakhir SLTP," -> "SLTP". */
function ruasIdentitas(isi, label) {
  const re = new RegExp(`\\b${label}\\b\\s*:?\\s*([^,;()]{2,80}?)\\s*(?=,|;|\\(|$|\\s+(?:agama|pendidikan|pekerjaan|berstatus|status|tempat|bertempat|beralamat|alamat|kewarganegaraan)\\b)`, "i");
  const m = isi.match(re);
  return m ? m[1].trim().replace(/\.$/, "") : "";
}

const POLA_STATUS = /\b(?:berstatus|status(?:\s+perkawinan)?\s*:?)\s+(jejaka|perjaka|bujang|gadis|perawan|janda(?:\s+(?:cerai|mati))?|duda(?:\s+(?:cerai|mati))?|belum\s+(?:pernah\s+)?(?:menikah|kawin))\b/i;
const POLA_ALAMAT = /\b(?:tempat\s+(?:tinggal|kediaman(?:an)?)|bertempat\s+(?:tinggal|kediaman)|beralamat|alamat)\b\s*(?:di\s*)?:?\s*([^;]{6,200})/i;

/** Alamat berhenti sebelum "selanjutnya disebut ..." / "sebagai ..." / "dalam hal ini ...". */
function rapikanAlamat(a) {
  return String(a || "")
    .split(/\s*,?\s*\b(?:selanjutnya|yang\s+selanjutnya|sebagai|dalam\s+hal\s+ini|untuk\s+selanjutnya)\b/i)[0]
    .trim()
    .replace(/[,.\s]+$/, "");
}

/** Fakta milik satu orang dari seluruh kemunculan namanya. */
function faktaOrang(teks, orang) {
  const hasil = {};
  if (!orang || !orang.namaTertulis) return hasil;
  const catat = (kunci, nilai, kalimat) => {
    if (nilai && !hasil[kunci]) hasil[kunci] = { nilai, kalimat: String(kalimat || "").trim().slice(0, 400) };
  };
  for (const i of letakNama(teks, orang.namaTertulis)) {
    const { kepala, isi } = ruasSesudah(teks, i, orang.namaTertulis);
    const kutip = `${kepala}${isi}`;
    const u = isi.match(POLA_UMUR);
    if (u) catat("umur", bentukUmur(u), kutip);
    const l = isi.match(POLA_LAHIR);
    if (l) {
      catat("lahir", tanggalLahir(l), kutip);
      if (l[1]) catat("tempatLahir", l[1].trim(), kutip);
    }
    const tl = isi.match(/^\s*,?\s*([A-Z][A-Za-z'. -]{1,40}?)\s*,\s*(?:tanggal\s+)?\d{1,2}[\s-]+[A-Za-z]{3,9}[\s-]+\d{4}/);
    if (tl) catat("tempatLahir", tl[1].trim(), kutip);
    catat("pendidikan", ruasIdentitas(isi, "pendidikan(?:\\s+terakhir)?"), kutip);
    catat("pekerjaan", ruasIdentitas(isi, "pekerjaan"), kutip);
    catat("agama", (isi.match(/\bagama\s*:?\s*(Islam|Kristen(?:\s+Protestan)?|Katolik|Hindu|Budha|Buddha|Konghucu)\b/i) || [])[1], kutip);
    const s = isi.match(POLA_STATUS);
    if (s) catat("status", s[1].toLowerCase(), kutip);
    const a = isi.match(POLA_ALAMAT);
    if (a && rapikanAlamat(a[1]).length >= 6) catat("alamat", rapikanAlamat(a[1]), kutip);
  }
  return hasil;
}

/** Umur anak dari kalimat "anak para Pemohon ... masih berumur N tahun" (tanpa nama lain di antaranya). */
function umurAnakUmum(teks, anak, pasangan) {
  const re = /\banak\s+(?:para\s+)?Pemohon\b[^;]{0,220}?\b(?:masih\s+)?(?:berumur|berusia|umur|usia)\s+(?:kurang\s+lebih\s+)?(\d{1,2})\s*(?:\([^)]{1,30}\)\s*)?tahun(?:\s*(\d{1,2})\s*(?:\([^)]{1,30}\)\s*)?bulan)?/gi;
  let m;
  while ((m = re.exec(teks)) !== null) {
    const potong = m[0];
    // Tidak boleh memuat nama pasangan - umur itu bisa miliknya.
    if (pasangan && letakNama(potong, pasangan.namaTertulis).length) continue;
    if (/\bdan\s+\d{1,2}\s*(?:\([^)]*\)\s*)?tahun/i.test(teks.slice(m.index + m[0].length, m.index + m[0].length + 30))) continue;
    void anak;
    return { nilai: bentukUmur(m), kalimat: potong };
  }
  return null;
}

/**
 * "... anak para Pemohon bernama A dan B ... masih berumur 18 dan 16 tahun":
 * angka pertama milik nama yang disebut lebih dulu di kalimat itu.
 */
function umurBerdua(teks, calon) {
  const re = /\b(?:berumur|berusia|umur|usia)\s+(\d{1,2})\s*(?:\([^)]*\)\s*)?(?:tahun\s+)?dan\s+(\d{1,2})\s*(?:\([^)]*\)\s*)?tahun/i;
  const m = teks.match(re);
  if (!m) return null;
  const kal = kalimatDi(teks, m.index, m[0].length);
  if (!/syarat|di\s+bawah\s+umur|belum\s+(?:cukup|memenuhi|terpenuhi)|saat\s+ini|sekarang/i.test(kal)) return null;
  const iA = letakNama(kal, calon.anak.namaTertulis)[0];
  const iB = letakNama(kal, calon.pasangan.namaTertulis)[0];
  // Tanpa nama di kalimat itu: urutan kalimat menikahkan - anak para Pemohon disebut lebih dulu (17/2025).
  const [uA, uB] = iA === undefined || iB === undefined || iA < iB ? [m[1], m[2]] : [m[2], m[1]];
  return { anak: { nilai: `${Number(uA)} tahun`, kalimat: kal }, pasangan: { nilai: `${Number(uB)} tahun`, kalimat: kal } };
}

/** Status anak/pasangan dari kalimat umum "anak Pemohon berstatus Perjaka". */
function statusUmum(teks, siapa) {
  const re =
    siapa === "anak"
      ? /\banak\s+(?:para\s+)?Pemohon(?:\s+tersebut)?\s+(?:ber(?:s|se)tatus|status)\s+(jejaka|perjaka|bujang|gadis|perawan)\b/i
      : /\bcalon\s+(?:suami|istri|isteri)(?:nya)?(?:\s+anak\s+(?:para\s+)?Pemohon)?(?:\s+tersebut)?\s+(?:ber(?:s|se)tatus|status)\s+(jejaka|perjaka|bujang|gadis|perawan|duda|janda)\b/i;
  const m = teks.match(re);
  return m ? { nilai: m[1].toLowerCase(), kalimat: kalimatDi(teks, m.index, m[0].length) } : null;
}

/** Pekerjaan calon pria dari "calon suami ... bekerja sebagai X (dengan penghasilan ...)". */
function pekerjaanCalonSuami(teks, pria, anakPria) {
  const subjek = anakPria
    ? "anak\\s+(?:para\\s+)?Pemohon(?:\\s+tersebut)?"
    : "calon\\s+suami(?:nya)?(?:\\s+anak\\s+(?:para\\s+)?Pemohon)?(?:\\s+tersebut)?";
  const re = new RegExp(`\\b(?:${subjek}|${(pria && pria.namaTertulis ? pria.namaTertulis.split(" ")[0] : "\\u0000").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})[^;]{0,80}?\\b(?:telah\\s+|sudah\\s+)?bekerja\\s+sebagai\\s+([^;,.]{2,60}?)(?=\\s*(?:[;,.]|dengan\\s+penghasilan|yang\\s+|dan\\s+|$))((?:\\s*,?\\s*dengan\\s+penghasilan[^;]{3,120}))?`, "i");
  const m = teks.match(re);
  if (!m) return null;
  return { nilai: m[1].trim(), penghasilan: m[2] ? m[2].replace(/^\s*,?\s*/, "").trim() : "", kalimat: kalimatDi(teks, m.index, m[0].length) };
}

/* ============================================================================
 * FAKTA KEHAMILAN, PERKENALAN, PUSKESMAS
 * ========================================================================== */

function lamaMengenal(teks) {
  const m = teks.match(
    /\b(?:saling\s+(?:mengenal|kenal)|berkenalan|menjalin\s+hubungan(?:\s+(?:asmara|cinta|pacaran|kasih))?|berpacaran|pacaran)\b[^.;]{0,80}?\b(?:selama|sejak)\s+(?:kurang\s+lebih\s+|lebih\s+kurang\s+|±\s*|sekitar\s+|kira-kira\s+)?(\d{1,2})\s*(?:\([^)]{1,30}\)\s*)?(tahun|bulan)(?:\s+(\d{1,2})\s*(?:\([^)]{1,30}\)\s*)?bulan)?/i
  );
  if (!m) return null;
  const nilai = m[3] ? `${waktuBerbilang(m[1], m[2].toLowerCase())} ${waktuBerbilang(m[3], "bulan")}` : waktuBerbilang(m[1], m[2].toLowerCase());
  return { nilai, kalimat: kalimatDi(teks, m.index, m[0].length) };
}

function umurKandungan(teks) {
  const re = /\bhamil\s+(?:kurang\s+lebih\s+|lebih\s+kurang\s+|±\s*|sekitar\s+|kira-kira\s+)?(\d{1,2}(?:\s*[-/]\s*\d{1,2})?)\s*(?:\([^)]{1,30}\)\s*)?(minggu|bulan)(?:\s+\d{1,2}\s+hari)?(?:\s+atau\s+(?:sekitar\s+|kurang\s+lebih\s+|±\s*)?(\d{1,2})\s*(?:\([^)]{1,30}\)\s*)?bulan)?/gi;
  let m;
  while ((m = re.exec(teks)) !== null) {
    const depan = teks.slice(Math.max(0, m.index - 30), m.index);
    if (/\b(?:tidak|belum|bukan)\s+(?:sedang\s+|dalam\s+keadaan\s+)?$/i.test(depan)) continue;
    const kalimat = kalimatDi(teks, m.index, m[0].length);
    if (m[3]) return { nilai: waktuBerbilang(m[3], "bulan"), kalimat };
    const angka = m[1].replace(/\s+/g, "");
    if (/^\d+$/.test(angka)) return { nilai: waktuBerbilang(angka, m[2].toLowerCase()), kalimat };
    return { nilai: `${angka} ${m[2].toLowerCase()}`, kalimat };
  }
  return null;
}

function puskesmas(teks) {
  const m = teks.match(/\b(UPTD?\.?\s+|UPT\.?\s+)?Puskesmas\s+((?:[A-Z][A-Za-z'.-]*\s*){1,5}?)(?=\s*(?:[,;.)(]|Nomor|No\b|Kecamatan|Kabupaten|tanggal|tertanggal|yang|$))(\s*,?\s*Kecamatan\s+[A-Z][A-Za-z' -]{1,30}?(?=\s*[,;.)(]|\s+Kabupaten|$))?/);
  if (!m) return null;
  const nama = m[2].trim().replace(/[.,]$/, "");
  if (!nama || /^(Nomor|No)$/i.test(nama)) return null;
  const upt = m[1] ? `${m[1].replace(/\./g, "").trim().toUpperCase()} ` : "";
  const kec = m[3] ? `, ${m[3].replace(/^\s*,?\s*/, "").trim()}` : "";
  return { nilai: `${upt}Puskesmas ${nama}${kec}`, kalimat: kalimatDi(teks, m.index, m[0].length) };
}

/* ============================================================================
 * SUSUNAN USULAN
 * ========================================================================== */

const NAMA_VARIABEL = Object.freeze({
  "0606": "Nama calon mempelai wanita",
  "0600": "Nama calon mempelai pria",
  "0607": "Umur calon mempelai wanita",
  "0601": "Umur calon mempelai pria",
  "0349": "Tanggal lahir calon mempelai wanita",
  "0344": "Tempat lahir calon mempelai wanita",
  "0340": "Tempat lahir calon mempelai pria",
  "0608": "Agama calon mempelai wanita",
  "0602": "Agama calon mempelai pria",
  "0609": "Pendidikan calon mempelai wanita",
  "0603": "Pendidikan calon mempelai pria",
  "0610": "Pekerjaan calon mempelai wanita",
  "0604": "Pekerjaan calon mempelai pria",
  "6331": "Pekerjaan calon suami",
  "0611": "Alamat calon mempelai wanita",
  "0605": "Alamat calon mempelai pria",
  "2030": "Status calon mempelai wanita",
  "2029": "Status calon mempelai pria",
  "1666": "Lama saling mengenal",
  "0999": "Umur kandungan",
  "0997": "Puskesmas yang menerangkan kehamilan",
  "1551": "Nama ayah calon pasangan anak para Pemohon",
});

/** Variabel yang memang tidak dapat dideteksi bot - disebut, bukan disembunyikan. */
const TIDAK_TERDETEKSI = Object.freeze({
  "1552": "ibu calon pasangan tidak pernah disebut posita",
  "8812": "tanggal ijazah hanya ada di pindaian bukti",
  "9956": "daftar bukti surat disusun dari pindaian bukti, bukan posita",
});

/**
 * PETA VARIABEL -> SUMBER blangko Derry DK: putusan [01]-[03] (+ Cabut/NO) dan
 * BAS ALUR 12 [1]-[2a]. Daftar variabel dibaca dari RTF _blangko_abt (13 Okt
 * 2026); BAS memakai bagian dari variabel putusan yang sama. Bentuk sama dengan
 * kerangka aleta_bot/services/deteksi/index.js.
 */
const PB = ["putusan", "bas"];
const PETA_SUMBER = Object.freeze([
  { kode: "0606", nama: NAMA_VARIABEL["0606"], sumber: "posita", blangko: PB },
  { kode: "0600", nama: NAMA_VARIABEL["0600"], sumber: "posita", blangko: PB },
  { kode: "0607", nama: NAMA_VARIABEL["0607"], sumber: "posita", blangko: PB },
  { kode: "0601", nama: NAMA_VARIABEL["0601"], sumber: "posita", blangko: PB },
  { kode: "5178", nama: "KUA kecamatan yang menolak", sumber: "posita", blangko: PB, catatan: "abtUsulanLainService (kuaPenolak)" },
  { kode: "1666", nama: NAMA_VARIABEL["1666"], sumber: "posita", blangko: PB },
  { kode: "0999", nama: NAMA_VARIABEL["0999"], sumber: "posita", blangko: PB },
  { kode: "1551", nama: NAMA_VARIABEL["1551"], sumber: "posita", blangko: PB },
  { kode: "2029", nama: NAMA_VARIABEL["2029"], sumber: "posita", blangko: PB },
  { kode: "2030", nama: NAMA_VARIABEL["2030"], sumber: "posita", blangko: PB },
  { kode: "0609", nama: NAMA_VARIABEL["0609"], sumber: "posita", blangko: PB },
  { kode: "6331", nama: NAMA_VARIABEL["6331"], sumber: "posita", blangko: PB },
  { kode: "0610", nama: NAMA_VARIABEL["0610"], sumber: "posita", blangko: ["putusan"] },
  { kode: "0997", nama: NAMA_VARIABEL["0997"], sumber: "posita", blangko: ["putusan"] },
  { kode: "0349", nama: NAMA_VARIABEL["0349"], sumber: "posita", blangko: ["putusan"] },
  { kode: "1552", nama: "Nama orang tua kedua calon pasangan", sumber: "tidak-ada", blangko: PB, catatan: TIDAK_TERDETEKSI["1552"] },
  { kode: "8812", nama: "Tanggal ijazah", sumber: "berkas-ecourt", blangko: ["putusan"], catatan: TIDAK_TERDETEKSI["8812"] },
  { kode: "9956", nama: "Klasifikasi bukti surat", sumber: "berkas-ecourt", blangko: PB, catatan: TIDAK_TERDETEKSI["9956"] },
  ...["1197", "1198", "1199", "1200", "1201", "1202", "1203", "1204", "1205", "1206", "1207", "1208", "1241", "1242"].map((kode) => ({
    kode,
    nama: "Identitas saksi Pemohon",
    sumber: "dihitung-abt",
    blangko: ["putusan"],
    catatan: "data_sql dari perkara_pihak5 SIPP - ABT menghitungnya sendiri; ALETA tidak menulis",
  })),
  // Blangko DK lama/pengguna lain - ikut terbaca dari blok identitas posita.
  ...["0344", "0340", "0608", "0602", "0604", "0611", "0605"].map((kode) => ({ kode, nama: NAMA_VARIABEL[kode], sumber: "posita", blangko: ["lama"] })),
  // 18 Okt (paket abt-dk-lama-perbaikan-derry): putusan [01]/[02] (Anak P Cowok) memakai 0603 (pendidikan calon suami) menggantikan 0609 (pendidikan calon istri).
  { kode: "0603", nama: NAMA_VARIABEL["0603"], sumber: "posita", blangko: ["putusan", "lama"] },
]);

/**
 * Seluruh fakta DK dari posita.
 * @param {string} posita posita apa adanya (boleh HTML)
 * @returns {{calon: object|null, nilai: Object<string,{nilai,kalimat,keyakinan,catatan?}>}}
 */
function deteksiDk(posita) {
  const teks = polos(posita);
  const nilai = {};
  if (!teks) return { calon: null, nilai };
  const pasang = (kode, isi, opsi = {}) => {
    if (!isi || !isi.nilai || nilai[kode]) return;
    nilai[kode] = { nilai: String(isi.nilai), kalimat: isi.kalimat || "", keyakinan: opsi.ragu ? "ragu" : yakinTerukur(kode), ...(opsi.catatan ? { catatan: opsi.catatan } : {}) };
  };
  const calon = uraiCalon(teks);
  if (calon && calon.wanita && calon.pria) {
    const ragu = !calon.jkPasti;
    const catatanNama = (o) =>
      o.nama !== o.namaTertulis ? `posita menulis "${o.namaTertulis}"; penyambung disesuaikan karena ${calon.bukti.filter((b) => !/penyambung/.test(b)).join(", ") || "peran"}` : "";
    pasang("0606", { nilai: calon.wanita.nama, kalimat: calon.kalimat }, { ragu, catatan: catatanNama(calon.wanita) });
    pasang("0600", { nilai: calon.pria.nama, kalimat: calon.kalimat }, { ragu, catatan: catatanNama(calon.pria) });
    const fw = faktaOrang(teks, calon.wanita);
    const fp = faktaOrang(teks, calon.pria);
    const berdua = umurBerdua(teks, calon);
    // Umur anak: kalimat "sampai saat ini masih berusia N tahun" mendahului daftar
    // anak di awal posita (4/2026: daftar 15, kalimat syarat 16 - hakim 16).
    const umum = umurAnakUmum(teks, calon.anak, calon.pasangan);
    const kini = umum && /\b(?:masih|saat\s+ini|sekarang|baru)\b/i.test(umum.kalimat) ? umum : null;
    const umurPasangan = berdua && berdua.pasangan;
    const anakW = calon.anak.jk === "P";
    const fAnak = anakW ? fw : fp;
    const umurAnak = kini || fAnak.umur || umum || (berdua && berdua.anak);
    // Posita yang menyebut dua umur berbeda untuk anak yang sama (daftar anak 15,
    // kalimat syarat 17 - 227/2020) diusulkan "ragu" dengan keduanya disebut.
    const beda = [...new Set([kini, fAnak.umur, umum, berdua && berdua.anak].filter(Boolean).map((u) => u.nilai))];
    const opsiAnak = beda.length > 1 ? { ragu: true, catatan: `posita menyebut umur berbeda: ${beda.join(" / ")}` } : { ragu };
    pasang("0607", anakW ? umurAnak : fw.umur || umurPasangan, anakW ? opsiAnak : { ragu });
    pasang("0601", anakW ? fp.umur || umurPasangan : umurAnak, anakW ? { ragu } : opsiAnak);
    pasang("0349", fw.lahir, { ragu });
    pasang("0344", fw.tempatLahir, { ragu });
    pasang("0340", fp.tempatLahir, { ragu });
    pasang("0608", fw.agama, { ragu });
    pasang("0602", fp.agama, { ragu });
    pasang("0609", fw.pendidikan, { ragu });
    pasang("0603", fp.pendidikan, { ragu });
    pasang("0610", fw.pekerjaan, { ragu });
    pasang("0604", fp.pekerjaan, { ragu });
    pasang("0611", fw.alamat, { ragu });
    pasang("0605", fp.alamat, { ragu });
    const sAnak = statusUmum(teks, "anak");
    const sPasangan = statusUmum(teks, "pasangan");
    pasang("2030", fw.status || (calon.anak.jk === "P" ? sAnak : sPasangan), { ragu });
    pasang("2029", fp.status || (calon.anak.jk === "L" ? sAnak : sPasangan), { ragu });
    const kerja = fp.pekerjaan ? { nilai: fp.pekerjaan.nilai, penghasilan: "", kalimat: fp.pekerjaan.kalimat } : pekerjaanCalonSuami(teks, calon.pria, calon.anak.jk === "L");
    if (kerja) {
      pasang("6331", { nilai: kerja.penghasilan ? `${kerja.nilai} ${kerja.penghasilan}` : kerja.nilai, kalimat: kerja.kalimat }, { ragu });
      pasang("0604", { nilai: kerja.nilai, kalimat: kerja.kalimat }, { ragu });
    }
    const ayah = (calon.pasangan.namaTertulis.split(/\s+\b(?:bin|binti)\b\s+/i)[1] || "").trim();
    pasang("1551", ayah ? { nilai: ayah, kalimat: calon.kalimat } : null, { ragu });
  }
  pasang("1666", lamaMengenal(teks));
  pasang("0999", umurKandungan(teks));
  pasang("0997", puskesmas(teks));
  return { calon, nilai };
}

/* ============================================================================
 * PENYAMBUNG RUTE /abt/usulan (sumber 'posita-lain')
 * ========================================================================== */

function jenisDk(jenisPerkara) {
  const t = String(jenisPerkara === undefined || jenisPerkara === null ? "" : jenisPerkara).trim();
  return Number(t) === JENIS_DK || /dispensasi/i.test(t) || t === "dispensasi-kawin";
}

/**
 * Posita untuk rute posita-lain: blangko BAS DK tidak memuat 5125, jadi
 * ekstensi mengirim posita kosong - posita dibaca dari SIPP (HANYA SELECT,
 * 2,5 detik; konteksPerkaraSaksi). Posita kiriman yang terbaca tidak diganti.
 */
async function positaCadanganSipp(body) {
  const masuk = String((body && body.posita) || "");
  if (masuk.replace(/<[^>]*>/g, " ").trim().length >= 50) return masuk;
  const nomor = String((body && body.nomorPerkara) || "").trim();
  if (!nomor) return masuk;
  const k = await usulanService.konteksPerkaraSaksi(nomor).catch(() => null);
  return k && k.posita && k.posita.replace(/<[^>]*>/g, " ").trim().length >= 50 ? k.posita : masuk;
}

/**
 * Menambah usulan DK ke hasil posita-lain (dariPositaLain + kamus per jenis).
 *
 * Usulan lama yang BERNILAI tidak diganti (keputusan sumber terukurnya tetap);
 * usulan lama yang kosong diganti bila modul ini membacanya; kode yang dahulu
 * "belum lulus gerbang" (1666, 1551, 0999) kini diusulkan "ragu" - tampil tidak
 * tercentang beserta kalimat sumbernya - dan keluar dari belumSiap.
 */
function lengkapiUsulanDk(hasil, posita, opsi = {}) {
  if (!jenisDk(opsi.jenisPerkara)) return hasil;
  const lama = hasil && typeof hasil === "object" ? hasil : null;
  const { nilai } = deteksiDk(posita);
  const kode = Object.keys(nilai);
  if (!kode.length) return hasil;
  const dasar = lama && lama.ok !== false ? lama : { ok: true, jenis: "dispensasi-kawin", usulan: [], belumSiap: [], bawaanAbt: [] };
  const usulan = Array.isArray(dasar.usulan) ? dasar.usulan.slice() : [];
  const ditambah = [];
  const diganti = [];
  for (const k of kode) {
    const n = nilai[k];
    const baru = {
      kode: k,
      nama: NAMA_VARIABEL[k] || k,
      nilai: n.nilai,
      keyakinan: n.keyakinan,
      sumber: n.kalimat ? [{ saksi: 0, asal: "posita", kalimat: n.kalimat }] : [],
      siap: n.keyakinan === "cukup",
      kodePola: `dk-${k}`,
      ...(n.catatan ? { catatan: n.catatan } : {}),
    };
    const i = usulan.findIndex((u) => u && String(u.kode) === k);
    if (i < 0) {
      usulan.push(baru);
      ditambah.push(k);
    } else if (!String(usulan[i].nilai || "").trim()) {
      usulan[i] = baru;
      diganti.push(k);
    } else if (baru.keyakinan === "cukup" && nrm(usulan[i].nilai) !== nrm(baru.nilai)) {
      // Bacaan terukur modul ini (lulus gerbang, peran jelas) tidak lebih buruk dari
      // pengurai lama pada perkara yang sama (UKUR_DK.banding) - menggantikannya.
      usulan[i] = { ...baru, catatan: `menggantikan bacaan lama "${usulan[i].nilai}"` };
      diganti.push(k);
    }
  }
  const belumSiap = (Array.isArray(dasar.belumSiap) ? dasar.belumSiap : []).filter((b) => !nilai[String(b && b.kode)]);
  // Kode TIDAK disebut di catatan: panel menampilkannya apa adanya, dan blangko
  // yang sedang dibuka (Cabut DK, BAS) tidak memuat seluruh variabel itu.
  const catatanDk =
    ditambah.length + diganti.length
      ? `Dispensasi kawin: calon mempelai, umur, dan keterangan lain dibaca dari posita menurut peran anak para Pemohon dan calon pasangannya; yang "ragu" tidak tercentang - periksa kalimat sumbernya.`
      : "";
  return {
    ...dasar,
    ok: true,
    usulan,
    belumSiap,
    tidakTerdeteksiDk: Object.entries(TIDAK_TERDETEKSI).map(([k, sebab]) => ({ kode: k, sebab })),
    catatan: [dasar.catatan || "", catatanDk].filter(Boolean).join(" "),
  };
}

module.exports = {
  GERBANG_DK,
  UKUR_DK,
  NAMA_VARIABEL,
  TIDAK_TERDETEKSI,
  PETA_SUMBER,
  uraiCalon,
  deteksiDk,
  jenisDk,
  positaCadanganSipp,
  lengkapiUsulanDk,
  // diuji langsung
  lamaMengenal,
  umurKandungan,
  puskesmas,
};
