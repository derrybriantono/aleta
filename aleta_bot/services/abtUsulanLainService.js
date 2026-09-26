"use strict";

/**
 * ============================================================================
 * USULAN ISIAN BLANGKO ABT UNTUK PERKARA LAIN - DARI POSITA, BERPAGAR UKUR
 * ============================================================================
 *
 * 89 dari 1.633 putusan PA Donggala 2025-2026 tidak mendapat satu pun usulan
 * dari panel ABT: dispensasi kawin, perwalian, asal usul anak, harta
 * bersama, dan lainnya. Blangko dispensasi kawin saja menuntut 15-18 isian
 * tangan, dan ALETA mengusulkan 1.
 *
 * Berkas ini menurunkan variabel perkara-perkara itu dari POSITA - kalimat
 * yang memang sudah diketik pemohon - dengan satu pagar yang tidak boleh
 * dilewati: TIDAK SATU VARIABEL PUN DIUSULKAN SEBELUM DIUKUR.
 *
 * ============================================================================
 * GERBANG UKUR - SIAP, ATAU BELUM SIAP BESERTA ANGKANYA
 * ============================================================================
 *
 * Tiap aturan dijalankan atas perkara yang variabelnya SUDAH diisi manusia
 * (aps_badilag.abt_data_teks, dibaca baca-saja oleh skrip di folder kerja
 * t1-deteksi-saksi-bot/ukur-lain.js - bukan oleh bot), dengan nilai yang
 * diubah sesudah 1 September 2026 dikeluarkan. Sebuah variabel SIAP hanya bila
 *
 *     presisi >= 0,9  DAN  n >= 10
 *
 * (n = banyaknya usulan yang dapat dibandingkan dengan isian manusia).
 * Selebihnya masuk `belumSiap` beserta presisi dan n-nya, dan TIDAK
 * diusulkan - aturan deteksi hasil tebakan sudah tiga kali salah di repo ini.
 * Daftar SIAP di bawah adalah hasil ukur itu, dicatat apa adanya; mengubahnya
 * tanpa mengukur ulang berarti melewati pagarnya.
 *
 * Yang TIDAK dilakukan: menebak. Nilai lazim ("Islam", "gadis") tidak pernah
 * diusulkan tanpa kalimat posita yang menyebutnya.
 *
 * Urutan jenis mengikuti keputusan pengguna 14: dispensasi kawin, perwalian,
 * asal usul, harta bersama.
 */

const usulanService = require("./abtUsulanService");

/** Jenis yang dilayani, menurut urutan keputusan pengguna 14. */
const JENIS_LAIN = [
  { kunci: "dispensasi-kawin", nama: "Dispensasi Kawin", jenisPerkaraId: 362, pola: /dispensasi/i },
  { kunci: "perwalian", nama: "Perwalian", jenisPerkaraId: 354, pola: /perwalian/i },
  { kunci: "asal-usul", nama: "Asal Usul Anak", jenisPerkaraId: 358, pola: /asal\s*-?\s*usul/i },
  { kunci: "harta-bersama", nama: "Harta Bersama", jenisPerkaraId: 348, pola: /harta\s+bersama|gono\s*-?\s*gini/i },
];

/* ============================================================================
 * PEMBANTU TEKS
 * ========================================================================== */

/** Posita polos satu baris panjang - penanda HTML dan spasi berlebih dibuang. */
function polos(posita) {
  return usulanService.polosPosita(posita).replace(/\s+/g, " ").trim();
}

const POLA_NAMA_KATA = /^[A-Z][A-Za-z'’.-]*$/;
const KATA_HENTI_MUNDUR = new Set([
  "bernama", "nama", "anak", "pemohon", "termohon", "dengan", "dan", "yang", "calon", "seorang",
  "laki-laki", "perempuan", "wanita", "pria", "suami", "istri", "isteri", "alm", "almarhum", "almarhumah",
]);

/**
 * Nama lengkap "X bin/binti Y" di sekitar penyambungnya.
 *
 * Mundur dari "bin/binti" mengambil kata berhuruf besar yang bersambung
 * (berhenti pada "bernama", "anak", tanda baca, atau kata huruf kecil), maju
 * memakai namaDiAwal milik usulan itsbat.
 */
function namaDenganPenyambung(teks, indeks, panjangPenyambung) {
  const sebelum = teks.slice(0, indeks).trimEnd();
  const kata = sebelum.split(/\s+/);
  const depan = [];
  for (let i = kata.length - 1; i >= 0; i--) {
    const k = kata[i];
    if (!k || /[,;:()]$/.test(k) || /^[(]/.test(k)) break;
    const polosKata = k.toLowerCase().replace(/[.'’]/g, "");
    if (!POLA_NAMA_KATA.test(k) || KATA_HENTI_MUNDUR.has(polosKata)) break;
    depan.unshift(k);
    if (depan.length >= 6) break;
  }
  if (!depan.length) return "";
  const penyambung = teks.slice(indeks, indeks + panjangPenyambung).toLowerCase();
  const belakang = usulanService.namaDiAwal(teks.slice(indeks + panjangPenyambung));
  if (!belakang) return "";
  return `${depan.join(" ")} ${penyambung} ${belakang}`;
}

/** Seluruh nama "X bin Y" / "X binti Y" di teks, beserta letak dan jenis kelaminnya. */
function namaBerpenyambung(teks) {
  const hasil = [];
  const pola = /\b(binti|bin)\b(?=\s)/gi;
  let m;
  while ((m = pola.exec(teks)) !== null) {
    const nama = namaDenganPenyambung(teks, m.index, m[1].length);
    if (!nama) continue;
    hasil.push({ nama, letak: m.index, perempuan: m[1].toLowerCase() === "binti" });
  }
  return hasil;
}

const normalNama = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* ============================================================================
 * DISPENSASI KAWIN
 * ========================================================================== */

/**
 * Calon mempelai wanita (0606) dan pria (0600) dari kalimat "menikahkan".
 *
 * Posita DK menulis keduanya dalam satu kalimat: "... menikahkan anak para
 * Pemohon yang bernama A binti B (calon mempelai wanita) dengan seorang
 * laki-laki yang bernama C bin D". Jenis kelaminnya dibaca dari penyambung
 * namanya sendiri - "binti" perempuan, "bin" laki-laki - bukan dari urutan,
 * sebab urutannya berbeda antara anak pemohon perempuan dan laki-laki.
 */
function calonMempelai(kalimat) {
  const menikahkan =
    (kalimat || []).find((k) => /menikahkan|dinikahkan|akan menikah/i.test(k) && /\bbinti?\b/i.test(k)) || "";
  if (!menikahkan) return { wanita: null, pria: null, kalimat: "" };
  const baris = menikahkan.replace(/\s+/g, " ");
  const nama = namaBerpenyambung(baris);
  const wanita = nama.find((n) => n.perempuan) || null;
  const pria = nama.find((n) => !n.perempuan) || null;
  return { wanita: wanita && wanita.nama, pria: pria && pria.nama, kalimat: baris.trim() };
}

/**
 * Umur seorang calon: angka "umur/usia/berusia/berumur N tahun" sesudah
 * namanya, sebelum nama berpenyambung berikutnya. Cadangan: kalimat "masih
 * berumur 18 dan 16 tahun" dibagi menurut urutan nama di kalimat menikahkan.
 */
function umurCalon(teks, nama, mempelai) {
  if (!nama) return { nilai: "", kalimat: "" };
  const polaUmur = /\b(?:umur|usia|berusia|berumur)\s+(?:kurang lebih\s+|lebih kurang\s+|±\s*)?(\d{1,2})\s*(?:\([^)]{1,30}\)\s*)?tahun/i;
  const semuaNama = namaBerpenyambung(teks);
  const kunciNama = normalNama(nama);
  for (const n of semuaNama) {
    if (normalNama(n.nama) !== kunciNama) continue;
    const berikut = semuaNama.find((x) => x.letak > n.letak + 3);
    const potong = teks.slice(n.letak, berikut ? berikut.letak : n.letak + 260);
    const u = potong.match(polaUmur);
    // Kutipannya dimulai dari nama orangnya, bukan dari "bin/binti".
    const awalNama = Math.max(0, teks.lastIndexOf(n.nama.split(" ")[0], n.letak));
    if (u) return { nilai: `${Number(u[1])} tahun`, kalimat: teks.slice(awalNama, n.letak + u.index + u[0].length).trim() };
  }
  const berdua = teks.match(/\b(?:umur|usia|berusia|berumur)\s+(\d{1,2})\s*(?:\([^)]*\)\s*)?(?:tahun\s+)?dan\s+(\d{1,2})\s*(?:\([^)]*\)\s*)?tahun/i);
  if (berdua && mempelai && mempelai.wanita && mempelai.pria) {
    const i = mempelai.kalimat.indexOf(nama);
    const lain = nama === mempelai.wanita ? mempelai.pria : mempelai.wanita;
    const j = mempelai.kalimat.indexOf(lain);
    if (i >= 0 && j >= 0) return { nilai: `${Number(i < j ? berdua[1] : berdua[2])} tahun`, kalimat: berdua[0] };
  }
  return { nilai: "", kalimat: "" };
}

/**
 * KUA yang MENOLAK: "Kantor Urusan Agama Kecamatan X, Kabupaten Y" di kalimat
 * yang menyebut pelaporan atau penolakannya.
 *
 * Posita DK menyebut lebih dari satu KUA - tempat orang tua pemohon dahulu
 * menikah, misalnya. Terukur: mengambil yang PERTAMA disebut benar 5 dari 11;
 * yang dicari karena itu kalimat "melapor ... guna mencatatkan ... namun
 * ditolak", bukan kemunculan pertama.
 */
const POLA_KUA =
  /Kantor Urusan Agama\s+(?:\(KUA\)\s+)?Kecamatan\s+([A-Z][A-Za-z'’ -]{1,40}?)\s*,\s*(Kabupaten|Kota)\s+([A-Z][A-Za-z'’ -]{1,40}?)(?=\s*[,;.(]|\s+(?:guna|untuk|namun|dan|Provinsi|Propinsi)\b)/;
function kuaPenolak(kalimat) {
  const calon = (kalimat || []).find((k) => /ditolak|penolakan|melapor|mencatatkan|mendaftarkan/i.test(k) && POLA_KUA.test(k));
  if (!calon) return null;
  const m = calon.replace(/\s+/g, " ").match(POLA_KUA);
  if (!m) return null;
  return { kecamatan: m[1].trim(), kabupaten: `${m[2]} ${m[3].trim()}`, kalimat: m[0] };
}

/** Lama saling mengenal: "saling mengenal (selama) (kurang lebih) N tahun/bulan". */
function lamaMengenal(teks) {
  const m = teks.match(
    /saling mengenal[^.;]{0,60}?selama\s+(?:kurang lebih\s+|lebih kurang\s+|±\s*)?(\d{1,2})\s*(?:\([^)]{1,30}\)\s*)?(tahun|bulan)(?:\s+(\d{1,2})\s*(?:\([^)]{1,30}\)\s*)?bulan)?/i
  );
  if (!m) return { nilai: "", kalimat: "" };
  const nilai = m[3] ? `${Number(m[1])} ${m[2].toLowerCase()} ${Number(m[3])} bulan` : `${Number(m[1])} ${m[2].toLowerCase()}`;
  return { nilai, kalimat: m[0] };
}

/* ============================================================================
 * PERWALIAN
 * ========================================================================== */

/** Yang meninggal: "Alm. X" / "suami Pemohon ... bernama X ... meninggal". */
function almarhum(teks) {
  const alm = teks.match(/\bAlm(?:arhum(?:ah)?)?\.?\s+(?=[A-Z])/);
  if (alm) {
    const nama = usulanService.namaDiAwal(teks.slice(alm.index + alm[0].length));
    if (nama) return { nilai: nama, kalimat: teks.slice(alm.index, alm.index + 160).trim() };
  }
  return { nilai: "", kalimat: "" };
}

/** Siapa yang meninggal dari sisi anak: suami -> "bapak kandung", istri -> "ibu kandung". */
function orangTuaMeninggal(teks) {
  const suami = /\bsuami\s+Pemohon\b[^.;]{0,160}?meninggal dunia|Alm\.?[^.;]{0,80}?\(\s*Suami Pemohon\s*\)[^.;]{0,40}?meninggal/i.test(teks);
  const istri = /\bistri\s+Pemohon\b[^.;]{0,160}?meninggal dunia|Almh?\.?[^.;]{0,80}?\(\s*Istri Pemohon\s*\)[^.;]{0,40}?meninggal/i.test(teks);
  if (suami === istri) return { nilai: "", kalimat: "" };
  return { nilai: suami ? "bapak kandung" : "ibu kandung", kalimat: "" };
}

/** Pemohon dari sisi anak: kebalikan orangTuaMeninggal. */
function orangTuaPemohon(teks) {
  const m = orangTuaMeninggal(teks);
  if (!m.nilai) return m;
  return { nilai: m.nilai === "bapak kandung" ? "ibu kandung" : "bapak kandung", kalimat: "" };
}

/** Nama anak yang dimohonkan perwaliannya. */
function namaAnakPerwalian(teks) {
  const m = teks.match(/wali\s+(?:atas|bagi|dari)\s+anak[^.;]{0,80}?\b(?:bernama|yaitu|atas nama)\s+/i);
  if (!m) return { nilai: "", kalimat: "" };
  const sisa = teks.slice(m.index + m[0].length);
  const nama = usulanService.namaDiAwal(sisa);
  if (!nama) return { nilai: "", kalimat: "" };
  const lengkap = /^\s*(?:bin|binti)\b/i.test(sisa.slice(nama.length)) ? namaBerpenyambung(sisa)[0] : null;
  return { nilai: lengkap ? lengkap.nama : nama, kalimat: m[0] + nama };
}

/** Keperluan perwalian: "untuk/guna/ingin mengurus ..." sampai "maka"/titik koma. */
function keperluanPerwalian(teks) {
  const m = teks.match(/\b(?:ingin|hendak|bermaksud|untuk|guna)\s+(mengurus[^.;]{3,200}?|pengurusan[^.;]{3,200}?)(?=\s+maka\b|\s*[;.]|\s*,\s*(?:maka|sehingga)\b)/i);
  if (!m) return { nilai: "", kalimat: "" };
  return { nilai: m[1].replace(/\s+/g, " ").trim(), kalimat: m[0] };
}

/* ============================================================================
 * ASAL USUL ANAK - FAKTA PERNIKAHAN, DENGAN PENGURAI ITSBAT
 * ========================================================================== */

function dariItsbat(kode) {
  return (teks) => {
    const u = usulanService.dariPositaItsbat(teks, {}).usulan.find((x) => x.kode === kode);
    return { nilai: u ? u.nilai : "", kalimat: u && u.sumber[0] ? u.sumber[0].kalimat : "" };
  };
}

/* ============================================================================
 * ATURAN PER JENIS - dipakai dariPositaLain DAN skrip gerbang ukur
 * ========================================================================== */

/**
 * Tiap aturan: (teksPolos, konteks) -> {nilai, kalimat}.
 * `banding` memberi tahu skrip ukur cara membandingkan dengan isian manusia:
 *   nama    huruf kecil, selain huruf/angka jadi spasi
 *   angka   angka pertama sama
 *   rapat   seperti nama, tanpa spasi sama sekali
 *   waktu   angka + satuan (tahun/bulan) sama
 */
const ATURAN_LAIN = {
  "dispensasi-kawin": [
    { kode: "0606", nama: "Nama calon mempelai wanita", banding: "nama", ambil: (t, k) => ({ nilai: k.mempelai.wanita || "", kalimat: k.mempelai.kalimat }) },
    { kode: "0600", nama: "Nama calon mempelai pria", banding: "nama", ambil: (t, k) => ({ nilai: k.mempelai.pria || "", kalimat: k.mempelai.kalimat }) },
    { kode: "0607", nama: "Umur calon mempelai wanita", banding: "angka", ambil: (t, k) => umurCalon(t, k.mempelai.wanita, k.mempelai) },
    { kode: "0601", nama: "Umur calon mempelai pria", banding: "angka", ambil: (t, k) => umurCalon(t, k.mempelai.pria, k.mempelai) },
    {
      kode: "3333",
      nama: "KUA kecamatan yang menolak",
      banding: "rapat",
      ambil: (t, konteks) => {
        const k = kuaPenolak(konteks.kalimat);
        return k ? { nilai: `${k.kecamatan}, ${k.kabupaten}`, kalimat: k.kalimat } : { nilai: "", kalimat: "" };
      },
    },
    {
      kode: "5178",
      nama: "KUA kecamatan (lengkap)",
      banding: "rapat",
      ambil: (t, konteks) => {
        const k = kuaPenolak(konteks.kalimat);
        return k ? { nilai: `Kantor Urusan Agama Kecamatan ${k.kecamatan}, ${k.kabupaten}`, kalimat: k.kalimat } : { nilai: "", kalimat: "" };
      },
    },
    { kode: "1666", nama: "Lama saling mengenal", banding: "waktu", ambil: (t) => lamaMengenal(t) },
  ],
  perwalian: [
    { kode: "1025", nama: "Nama almarhum/almarhumah", banding: "nama", ambil: (t) => almarhum(t) },
    { kode: "0712", nama: "Orang tua yang meninggal (dari sisi anak)", banding: "nama", ambil: (t) => orangTuaMeninggal(t) },
    { kode: "0709", nama: "Pemohon (dari sisi anak)", banding: "nama", ambil: (t) => orangTuaPemohon(t) },
    { kode: "5110", nama: "Nama anak", banding: "nama", ambil: (t) => namaAnakPerwalian(t) },
    { kode: "8171", nama: "Keperluan permohonan", banding: "nama", ambil: (t) => keperluanPerwalian(t) },
  ],
  "asal-usul": [
    { kode: "5197", nama: "Tanggal nikah", banding: "nama", ambil: dariItsbat("5197") },
    { kode: "5105", nama: "Alamat tempat menikah", banding: "nama", ambil: dariItsbat("5105") },
    { kode: "8087", nama: "Yang menikahkan", banding: "nama", ambil: dariItsbat("8087") },
    { kode: "1217", nama: "Nama wali nikah", banding: "nama", ambil: dariItsbat("1217") },
    { kode: "0650", nama: "Saksi nikah 1", banding: "nama", ambil: dariItsbat("0650") },
    { kode: "0651", nama: "Saksi nikah 2", banding: "nama", ambil: dariItsbat("0651") },
    { kode: "1001", nama: "Mas kawin", banding: "nama", ambil: dariItsbat("1001") },
  ],
  // Harta bersama: 13 perkara di sipp_donggala, hanya 2 yang punya isian ABT,
  // dan isian itu (alat bukti, kantor kuasa, alasan cabut) tidak berasal dari
  // posita. Tidak ada aturan yang dapat diukur, jadi tidak ada yang dibuat -
  // dan itu disebut pada hasilnya, bukan disembunyikan.
  "harta-bersama": [],
};

/* ============================================================================
 * HASIL GERBANG UKUR - 26 September 2026
 * ============================================================================
 *
 * Diukur ukur-lain.js (folder kerja t1-deteksi-saksi-bot) atas
 * dataset-lain.json: 55 perkara DK, 33 perwalian, 7 asal usul, dan 2 harta
 * bersama PA Donggala yang punya isian ABT manusia (sipp_donggala +
 * aps_badilag, baca-saja; nilai yang diubah sesudah 1 September 2026
 * dikeluarkan). Angkanya disalin APA ADANYA dari hasil-ukur-lain.json.
 *
 *   n        usulan yang dapat dibandingkan (aturan menghasilkan nilai DAN
 *            manusia mengisi variabelnya)
 *   benar    sama dengan isian manusia. Untuk nama: huruf kecil, selain
 *            huruf/angka jadi spasi; isian manusia yang MENGHILANGKAN
 *            bin/binti ("Yusnaeni" untuk "Yusnaeni binti Jufri") dihitung sama
 *            - orangnya sama dan usulannya lebih lengkap. Angka tanpa
 *            kelonggaran itu dicatat sebagai presisiKetat.
 *
 * Yang GAGAL gerbang tetap dicatat di sini, supaya belumSiap menyebut
 * angkanya - bukan sekadar "belum".
 *
 * Perwalian tidak punya satu pun variabel siap, dan bukan karena aturannya
 * buruk: variabel yang diisi manusia paling banyak 5-7 perkara, jadi n tidak
 * pernah mencapai 10. Gerbangnya TIDAK diturunkan untuk itu.
 */
const GERBANG = { presisiMinimal: 0.9, nMinimal: 10 };

const HASIL_UKUR = {
  "dispensasi-kawin": {
    "0606": { n: 44, benar: 43, presisi: 0.977, presisiKetat: 0.886 }, // SIAP
    "0600": { n: 36, benar: 33, presisi: 0.917, presisiKetat: 0.861 }, // SIAP
    "0607": { n: 36, benar: 34, presisi: 0.944, presisiKetat: 0.944 }, // SIAP
    "0601": { n: 11, benar: 10, presisi: 0.909, presisiKetat: 0.909 }, // SIAP (cakupan 11 dari 25)
    "3333": { n: 11, benar: 11, presisi: 1, presisiKetat: 1 }, // SIAP
    "5178": { n: 8, benar: 6, presisi: 0.75, presisiKetat: 0.75 }, // n<10
    "1666": { n: 8, benar: 4, presisi: 0.5, presisiKetat: 0.5 }, // n<10, presisi<0,9
  },
  perwalian: {
    "1025": { n: 5, benar: 2, presisi: 0.4, presisiKetat: 0.4 },
    "0712": { n: 5, benar: 5, presisi: 1, presisiKetat: 1 },
    "0709": { n: 5, benar: 5, presisi: 1, presisiKetat: 1 },
    "5110": { n: 1, benar: 1, presisi: 1, presisiKetat: 1 },
    "8171": { n: 5, benar: 0, presisi: 0, presisiKetat: 0 },
  },
  "asal-usul": {
    "5197": { n: 2, benar: 1, presisi: 0.5, presisiKetat: 0.5 },
    "5105": { n: 0, benar: 0, presisi: null, presisiKetat: null },
    "8087": { n: 2, benar: 2, presisi: 1, presisiKetat: 1 },
    "1217": { n: 2, benar: 2, presisi: 1, presisiKetat: 1 },
    "0650": { n: 2, benar: 2, presisi: 1, presisiKetat: 1 },
    "0651": { n: 2, benar: 2, presisi: 1, presisiKetat: 1 },
    "1001": { n: 2, benar: 2, presisi: 1, presisiKetat: 1 },
  },
  "harta-bersama": {},
};

/**
 * Variabel yang lulus gerbang, per jenis - diturunkan dari HASIL_UKUR di atas,
 * bukan ditulis tangan, supaya keduanya tidak dapat berselisih.
 * Hasil 26 September 2026: DK 0606, 0600, 0607, 0601, 3333; jenis lain kosong.
 */
const VARIABEL_SIAP = Object.freeze(
  Object.fromEntries(
    Object.entries(ATURAN_LAIN).map(([jenis, aturan]) => [
      jenis,
      Object.freeze(aturan.filter((a) => keadaanGerbang(jenis, a.kode).siap).map((a) => a.kode)),
    ])
  )
);

/** Kunci jenis dari masukan: id jenis perkara SIPP, nama, atau kunci. */
function kenaliJenis(jenisPerkara, alur) {
  void alur;
  const teks = String(jenisPerkara === undefined || jenisPerkara === null ? "" : jenisPerkara).trim();
  if (!teks) return null;
  const angka = Number(teks);
  return (
    JENIS_LAIN.find((j) => j.kunci === teks) ||
    (Number.isFinite(angka) ? JENIS_LAIN.find((j) => j.jenisPerkaraId === angka) : null) ||
    JENIS_LAIN.find((j) => j.pola.test(teks)) ||
    null
  );
}

/** Siap atau belum menurut hasil ukur yang tercatat. */
function keadaanGerbang(jenis, kode) {
  const u = (HASIL_UKUR[jenis] || {})[kode];
  if (!u) return { siap: false, alasan: "belum diukur", presisi: null, n: 0 };
  if (u.n < GERBANG.nMinimal) return { siap: false, alasan: `n<${GERBANG.nMinimal}`, presisi: u.presisi, n: u.n };
  if (u.presisi === null || u.presisi < GERBANG.presisiMinimal) {
    return { siap: false, alasan: `presisi<${GERBANG.presisiMinimal}`, presisi: u.presisi, n: u.n };
  }
  return { siap: true, alasan: "", presisi: u.presisi, n: u.n };
}

/** Konteks yang dipakai bersama beberapa aturan satu jenis. */
function konteksAturan(posita) {
  const kalimat = usulanService.kalimatPosita(posita);
  return { kalimat, mempelai: calonMempelai(kalimat) };
}

/**
 * Menurunkan variabel blangko perkara lain dari posita (kontrak K6).
 *
 * @param {string} posita posita apa adanya (boleh HTML)
 * @param {{jenisPerkara?: string|number, alur?: string|number, sebutan?: object, tipeKeluaran?: object}} opsi
 * @returns {{ok: boolean, jenis: string, usulan: object[], belumSiap: object[], alasan?: string, catatan?: string}}
 *
 * `sebutan` dan `tipeKeluaran` diterima sesuai kontrak; belum ada daftar tipe
 * keluaran untuk perkara lain, dan sebutan pihak tidak dipakai aturan mana pun
 * di bawah - keduanya tidak mengubah hasil.
 */
function dariPositaLain(posita, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const jenis = kenaliJenis(o.jenisPerkara, o.alur);
  if (!jenis) {
    return { ok: false, jenis: "", usulan: [], belumSiap: [], alasan: "jenis_perkara_tidak_dilayani" };
  }
  const teks = polos(posita);
  if (!teks) {
    return { ok: false, jenis: jenis.kunci, usulan: [], belumSiap: [], alasan: "posita_kosong" };
  }
  const konteks = konteksAturan(posita);
  const usulan = [];
  const belumSiap = [];
  for (const aturan of ATURAN_LAIN[jenis.kunci] || []) {
    const gerbang = keadaanGerbang(jenis.kunci, aturan.kode);
    if (!gerbang.siap) {
      belumSiap.push({ kode: aturan.kode, alasan: gerbang.alasan, presisi: gerbang.presisi, n: gerbang.n });
      continue;
    }
    const hasil = aturan.ambil(teks, konteks);
    usulan.push({
      kode: aturan.kode,
      nama: aturan.nama,
      nilai: hasil.nilai || "",
      keyakinan: hasil.nilai ? "cukup" : "kosong",
      sumber: hasil.kalimat ? [{ saksi: 0, asal: "posita", kalimat: hasil.kalimat }] : [],
      siap: true,
    });
  }
  const jawaban = { ok: true, jenis: jenis.kunci, usulan, belumSiap };
  if (!(ATURAN_LAIN[jenis.kunci] || []).length) {
    jawaban.catatan = `Belum ada aturan ${jenis.nama} yang dapat diukur: isian ABT manusianya terlalu sedikit dan tidak berasal dari posita.`;
  }
  return jawaban;
}

module.exports = {
  JENIS_LAIN,
  ATURAN_LAIN,
  GERBANG,
  HASIL_UKUR,
  VARIABEL_SIAP,
  kenaliJenis,
  keadaanGerbang,
  konteksAturan,
  calonMempelai,
  namaBerpenyambung,
  dariPositaLain,
};
