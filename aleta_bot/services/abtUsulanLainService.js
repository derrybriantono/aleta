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
 * GERBANG UKUR DAN KEPUTUSAN SUMBER
 * ============================================================================
 *
 * Tiap aturan dijalankan atas perkara yang variabelnya SUDAH diisi manusia
 * (aps_badilag.abt_data_teks, dibaca baca-saja oleh skrip di folder kerja -
 * bukan oleh bot), dengan nilai yang diubah sesudah 1 September 2026
 * dikeluarkan. Sebuah variabel diusulkan hanya bila
 *
 *     presisi >= 0,9  DAN  n >= 10  (atas pembanding yang sah)
 *     DAN tidak lebih buruk dari BAWAAN ABT pada perkara yang sama
 *
 * (n = banyaknya usulan yang dapat dibandingkan dengan isian manusia).
 * Selebihnya masuk `bawaanAbt` (ABT menawarkan isian bawaan) atau `belumSiap`
 * beserta presisi dan n-nya, dan TIDAK diusulkan - aturan deteksi hasil
 * tebakan sudah tiga kali salah di repo ini. Angkanya ada di UKUR_SUMBER,
 * dicatat apa adanya; mengubahnya tanpa mengukur ulang berarti melewati
 * pagarnya.
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

/**
 * Ayah calon PASANGAN anak para Pemohon (1551): blangko Derry menulis "orang
 * tua calon suami/istri anak para Pemohon yang bernama #1551# dan #1552#".
 * Yang dapat dibaca dari posita hanya nama sesudah "bin/binti" calon yang
 * BUKAN anak para Pemohon - anak pemohon ialah nama pertama di kalimat
 * "menikahkan anak para Pemohon yang bernama ...". Ibu (1552) tidak pernah
 * disebut posita, jadi tidak ada aturannya.
 */
function ayahCalonPasangan(konteks) {
  const m = konteks.mempelai;
  if (!m || !m.kalimat || !m.wanita || !m.pria) return { nilai: "", kalimat: "" };
  const anakDulu = m.kalimat.indexOf(m.wanita) < m.kalimat.indexOf(m.pria) ? m.wanita : m.pria;
  const pasangan = anakDulu === m.wanita ? m.pria : m.wanita;
  const ayah = pasangan.split(/\s+\b(?:bin|binti)\b\s+/i)[1] || "";
  return ayah ? { nilai: ayah.trim(), kalimat: m.kalimat } : { nilai: "", kalimat: "" };
}

/**
 * Umur kandungan (0999): "sedang hamil 20 Minggu", "hamil 18-19 Minggu",
 * "hamil 25/26 Minggu", "hamil 5 (lima) bulan". Rentang disalin apa adanya -
 * yang memilih satu angka adalah petugas, bukan ALETA.
 */
function umurKandungan(teks) {
  const m = teks.match(/\bhamil\s+(?:kurang lebih\s+|lebih kurang\s+|±\s*)?(\d{1,2}(?:\s*[-/]\s*\d{1,2})?)\s*(?:\([^)]{1,30}\)\s*)?(minggu|bulan)\b/i);
  if (!m) return { nilai: "", kalimat: "" };
  return { nilai: `${m[1].replace(/\s+/g, "")} ${m[2].toLowerCase()}`, kalimat: m[0] };
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
    // 3333 ("KUA Kecamatan ...", bentuk "X, Kabupaten Y") TIDAK diusulkan: tidak
    // ada di satu pun dari 908 RTF _blangko_abt - blangko DK kini memakai 5178.
    // Isian 3333 lama (2022-2025) tetap dipakai, sebagai BUKTI pengurai yang
    // sama untuk 5178 (UKUR_SUMBER, `gabung`), karena maknanya terbukti sama.
    {
      kode: "5178",
      nama: "KUA kecamatan yang menolak",
      banding: "rapat",
      ambil: (t, konteks) => {
        const k = kuaPenolak(konteks.kalimat);
        return k ? { nilai: `Kantor Urusan Agama Kecamatan ${k.kecamatan}, ${k.kabupaten}`, kalimat: k.kalimat } : { nilai: "", kalimat: "" };
      },
    },
    { kode: "1666", nama: "Lama saling mengenal", banding: "waktu", ambil: (t) => lamaMengenal(t) },
    { kode: "1551", nama: "Nama ayah calon pasangan", banding: "nama", ambil: (t, k) => ayahCalonPasangan(k) },
    { kode: "0999", nama: "Umur kandungan", banding: "waktu", ambil: (t) => umurKandungan(t) },
  ],
  perwalian: [
    { kode: "1025", nama: "Nama almarhum/almarhumah", banding: "nama", ambil: (t) => almarhum(t) },
    { kode: "0712", nama: "Orang tua yang meninggal (dari sisi anak)", banding: "nama", ambil: (t) => orangTuaMeninggal(t) },
    { kode: "0709", nama: "Pemohon (dari sisi anak)", banding: "nama", ambil: (t) => orangTuaPemohon(t) },
    { kode: "5110", nama: "Nama anak", banding: "nama", ambil: (t) => namaAnakPerwalian(t) },
    { kode: "8171", nama: "Keperluan permohonan", banding: "nama", ambil: (t) => keperluanPerwalian(t) },
  ],
  // Asal usul: ketujuhnya punya bawaan ABT (#10101#-#10112#, #1177#). Diusulkan
  // hanya bila sumberUsulanTerukur memilih ALETA - 26 Sep 2026 belum (n=2).
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
 * KEPUTUSAN SUMBER TERUKUR - ALETA, BAWAAN ABT, ATAU BELUM ADA
 * ============================================================================
 *
 * Satu variabel blangko dapat mendapat isian dari dua sumber:
 *
 *   ALETA        aturan di atas, dibaca dari posita (atau pengurai itsbat).
 *   bawaan ABT   default_data variabel data_teks yang menunjuk kueri data_sql
 *                buatan pengguna (#10101#-#10112#, #1177#, #8492#). Ini BUKAN
 *                isian otomatis: ABT menaruh jawaban kuerinya sebagai ISIAN
 *                BAWAAN di kotak popup (popup_data.php), yang baru tersimpan
 *                bila petugas membuka kotak itu lalu menyimpan (Abt_model.php);
 *                kotak yang tidak dibuka tercetak "..." (abt_helper.php).
 *
 * Prinsip lama - "jangan usulkan yang ditangani ABT" - mengunci sumber yang
 * belum tentu lebih benar. DK 5178: bawaan #10103# membawa sisa kalimat
 * posita ("..., guna mencatatkan ..., namun ditolak dengan alasan ...") ke
 * dalam kalimat blangko yang sudah menyebut penolakannya, sedangkan aturan
 * ALETA sama dengan isian petugas. Penggantinya diukur per (jalur, jenis,
 * variabel) - sumberUsulanTerukur():
 *
 *   'aleta'          aturan ALETA LULUS GERBANG (presisi >= 0,9 DAN n >= 10
 *                    atas pembanding yang sah) DAN TIDAK LEBIH BURUK dari
 *                    bawaan ABT pada perkara yang sama. Hanya ini diusulkan.
 *   'abt'            ada bawaan ABT, dan ALETA tidak memenuhi syarat di atas:
 *                    ALETA diam, dan panel berkata jujur bahwa ABT MENAWARKAN
 *                    isian bawaan dari kuerinya - bukan "diisi otomatis".
 *   'belum-terukur'  tidak ada bawaan ABT dan aturan ALETA belum lulus
 *                    gerbang (atau belum diukur sama sekali).
 *
 * Pembanding yang sah:
 *   - isian manusia yang tidak kosong dan tidak diubah sesudah 1 September
 *     2026 (sesudahnya ALETA sudah mengusulkan - bukan lagi bukti bebas);
 *   - bila variabel punya bawaan ABT: hanya isian SESUDAH bawaan itu dipasang
 *     (abt_variabel.modified), pada perkara yang sama untuk kedua sumber
 *     (`pasang`) - satu-satunya masa ketika pilihan dua sumber itu nyata.
 *     Itsbat 1217 menunjukkan mengapa: 0,907 sepanjang masa, 0,871 di masa
 *     bawaan ABT;
 *   - isian yang SAMA PERSIS dengan bawaan ABT dikeluarkan bila bawaan itu
 *     TERBUKTI SAMPAH (`sampah` menyebut buktinya): menyimpan bawaan tanpa
 *     membacanya bukan bukti bahwa bawaan itu benar;
 *   - bukti variabel lain boleh digabung (`gabung`) HANYA bila maknanya
 *     terbukti sama dari data, dengan dasarnya ditulis.
 *
 * Kolom tabel:
 *   aleta   {n, benar, ketat?}  aturan ALETA atas SEMUA isian sah; dasar
 *                               gerbang bila tidak ada bawaan ABT. ketat =
 *                               tanpa kelonggaran bin/binti (jalur posita-lain).
 *   abt     {acuan, n, benar, kosong, nMentah, benarMentah, dipangkas}
 *                               bawaan ABT atas isian sesudah dipasang; mentah
 *                               = sebelum isian-sama-sampah dikeluarkan;
 *                               dipangkas = petugas menyimpan awalannya saja.
 *   pasang  {n, aleta, abt}     perkara yang sama di kedua pembanding, benar
 *                               masing-masing: dasar gerbang DAN pembanding
 *                               bila ada bawaan ABT.
 *   gabung  {n, benar, dasar}   bukti tambahan yang maknanya terbukti sama.
 *
 * Diukur 26 September 2026 oleh D:/aleta-dev/kerja/pembetul-perkara-lain/
 * ukur-sumber.js (baca-saja; sipp_donggala + aps_badilag; kueri bawaan
 * dijalankan persis seperti ABT, #NNNN# bersarang diganti lebih dulu). Angka
 * disalin APA ADANYA dari tabel-ukur-sumber.txt keluaran skrip itu; gabung
 * dan sampah dari keluaran "makna" dan "blangko DK" skrip yang sama.
 * Pembanding: nama = huruf kecil, selain huruf/angka jadi spasi, isian manusia
 * tanpa bin/binti dihitung sama; rapat = seperti nama tanpa spasi; angka =
 * angka pertama; waktu = angka + satuan; jalur itsbat = nama atau rapat (sama
 * dengan banding-itsbat.js pembangun). Perwalian tidak punya variabel siap
 * karena n tidak pernah mencapai 10, dan gerbangnya TIDAK diturunkan untuk itu.
 */
const GERBANG = { presisiMinimal: 0.9, nMinimal: 10 };

/**
 * ============================================================================
 * GERBANG JALUR ITSBAT - MEMILIH SUMBER, BUKAN MEMBUKA USULAN BARU
 * ============================================================================
 *
 * Gerbang 0,9 di atas menjaga usulan BARU (perkara lain): yang belum terbukti
 * tidak ditawarkan sama sekali. Jalur itsbat lain soal - pengurainya sudah
 * dipakai petugas sejak lama, dan ke-14 variabelnya punya bawaan ABT. Yang
 * diputuskan di sini hanya SUMBER MANA yang lebih tepat pada perkara yang
 * sama. Dengan gerbang 0,9 tidak satu pun dari ke-14 lolos, padahal ALETA
 * jauh lebih tepat untuk 5197 (0,785 lawan 0,158), 0650, 0651, dan 1217 -
 * menghentikan semuanya merusak yang sudah berjalan.
 *
 * Maka, diputuskan 26 September 2026: ALETA mengusulkan bila (a) n pasangan
 * >= 10, (b) ketepatannya >= 0,5, dan (c) tidak kalah dari bawaan ABT lebih
 * dari 0,02 pada perkara yang sama (1003 0,973 lawan 0,983 dan 7211 0,794
 * lawan 0,803 dianggap setara). Hasilnya: 5178, 5105, 1046, 1002, dan 0007
 * diserahkan ke bawaan ABT; sembilan lainnya tetap diusulkan ALETA.
 *
 * Asal usul, perwalian, dan harta bersama memakai pengurai yang SAMA (tombol
 * itsbat tampil karena blangkonya memuat #5197#), tetapi n-nya 0-2. Selama
 * begitu, keputusannya dipinjam dari ukuran itsbat nikah - bukti terbaik atas
 * pengurai yang sama - dan alasannya menyebut peminjaman itu.
 *
 * DIUKUR ULANG 13 Oktober 2026 (butir 14, 228/Pdt.P/2026): "bawaan ABT" ternyata
 * hanya tampil di jendela sembul dan TIDAK PERNAH tersimpan - baris 1002, 1046,
 * 5105, 5178 tetap DATA_TIDAK_ADA, dan panel berkata "tidak ada data baru".
 * Pengurainya diperbaiki (deteksi/itsbat.js) dan baris itsbat-nikah di bawah
 * diukur ulang (D:/aleta-dev/kerja/agen-v-itsbat/ukur-itsbat.js, sipp_donggala
 * lokal 9 Okt, isian manusia sebelum 1 Sep 2026) dengan PEMBANDING MAKNA per
 * variabel, sama untuk ALETA dan bawaan ABT:
 *   5105 tempat   ruas wilayah (desa/kecamatan/kabupaten) yang ada di keduanya
 *                 sama, dan desa atau kecamatan bertemu - ALETA tidak menambah
 *                 desa yang tidak tertulis di posita;
 *   5178 KUA      kecamatan sama (+ kabupaten bila manusia menyebutnya);
 *   1002/1003     golongan status sama (jejaka=perjaka=bujang=lajang; perawan=gadis; duda; janda);
 *   1046 wali     hubungan sama (ayah=bapak; kakak=adik=saudara; paman; kakek; sepupu; hakim);
 *   0007 anak     jumlah anak sama (belum = 0);
 *   lainnya       nama/rapat seperti sebelumnya.
 * Hasilnya ke-14 variabel lulus: 5105 ALETA 300/321 lawan ABT 274/321, 5178 255
 * lawan 257 (setara, selisih 0,008), 1046 279 lawan 180, 1002 305 lawan 309 (setara),
 * 0007 254 lawan 39. dipangkas tidak diukur ulang (0).
 */
const GERBANG_ITSBAT = { presisiMinimal: 0.5, nMinimal: 10, selisihAbtMaks: 0.02, jenisWakil: "itsbat-nikah" };

const UKUR_SUMBER = {
  "posita-lain": {
    "dispensasi-kawin": {
      "0606": { aleta: { n: 44, benar: 43, ketat: 39 } },
      "0600": { aleta: { n: 36, benar: 33, ketat: 31 } },
      "0607": { aleta: { n: 36, benar: 34, ketat: 34 } },
      "0601": { aleta: { n: 11, benar: 10, ketat: 10 } },
      "5178": {
        aleta: { n: 7, benar: 6, ketat: 6 },
        abt: { acuan: "10103", n: 7, benar: 0, kosong: 0, nMentah: 8, benarMentah: 1, dipangkas: 6 },
        pasang: { n: 7, aleta: 6, abt: 0 },
        sampah:
          "Kalimat blangko DK sendiri sudah menyebut penolakannya di sekitar #5178# (30 kemunculan di 5 blangko: " +
          "'ditolak oleh #5178#', 'Pegawai Pencatat Nikah #5178# menolak dengan alasan'), sedangkan bawaan #10103# " +
          "membawa sisa kalimat posita '..., guna mencatatkan ..., namun ditolak dengan alasan ...'. Tersimpan utuh, " +
          "penolakannya tercetak dua kali. Petugas memangkasnya 6 dari 8 kali; 1 isian yang sama persis dengan bawaan " +
          "dikeluarkan dari pembanding (1 lagi diubah sesudah 1 September 2026).",
        gabung: {
          n: 11,
          benar: 11,
          dasar:
            "3333 'KUA Kecamatan ...' - blangko lama, diisi 2022-12-01 s.d. 2025-06-10, tidak ada lagi di 908 RTF " +
            "_blangko_abt. Maknanya sama dengan 5178: pada 6 posita yang menyebut dua KUA atau lebih, isian 3333 selalu " +
            "KUA yang MENOLAK (6/6) dan tidak pernah KUA yang disebut pertama (0/6); isian 5178 sama (4/4, 0/4). " +
            "Pengurai kuaPenolak cocok 11/11 setelah awalan 'Kantor Urusan Agama Kecamatan' dibuang.",
        },
      },
      "1666": { aleta: { n: 8, benar: 4, ketat: 4 } },
      "1551": { aleta: { n: 7, benar: 2, ketat: 2 } }, // manusia menulis "X bin Y", posita hanya "X"
      "0999": { aleta: { n: 3, benar: 1, ketat: 1 } }, // manusia memilih satu angka dari rentang
    },
    perwalian: {
      "1025": { aleta: { n: 5, benar: 2, ketat: 2 } },
      "0712": { aleta: { n: 5, benar: 5, ketat: 5 } },
      "0709": { aleta: { n: 5, benar: 5, ketat: 5 } },
      "5110": { aleta: { n: 1, benar: 1, ketat: 1 } },
      "8171": { aleta: { n: 5, benar: 0, ketat: 0 } },
    },
    "asal-usul": {
      "5197": { aleta: { n: 2, benar: 1, ketat: 1 }, abt: { acuan: "10101", n: 2, benar: 1, kosong: 0, nMentah: 2, benarMentah: 1, dipangkas: 0 }, pasang: { n: 2, aleta: 1, abt: 1 } },
      "5105": { aleta: { n: 0, benar: 0, ketat: 0 }, abt: { acuan: "10102", n: 2, benar: 2, kosong: 0, nMentah: 2, benarMentah: 2, dipangkas: 0 }, pasang: { n: 0, aleta: 0, abt: 0 } },
      "8087": { aleta: { n: 2, benar: 2, ketat: 2 }, abt: { acuan: "10109", n: 2, benar: 0, kosong: 0, nMentah: 2, benarMentah: 0, dipangkas: 2 }, pasang: { n: 2, aleta: 2, abt: 0 } },
      "1217": { aleta: { n: 2, benar: 2, ketat: 2 }, abt: { acuan: "1177", n: 2, benar: 2, kosong: 0, nMentah: 2, benarMentah: 2, dipangkas: 0 }, pasang: { n: 2, aleta: 2, abt: 2 } },
      "0650": { aleta: { n: 2, benar: 2, ketat: 2 }, abt: { acuan: "10110", n: 2, benar: 2, kosong: 0, nMentah: 2, benarMentah: 2, dipangkas: 0 }, pasang: { n: 2, aleta: 2, abt: 2 } },
      "0651": { aleta: { n: 2, benar: 2, ketat: 2 }, abt: { acuan: "10111", n: 2, benar: 2, kosong: 0, nMentah: 2, benarMentah: 2, dipangkas: 0 }, pasang: { n: 2, aleta: 2, abt: 2 } },
      "1001": { aleta: { n: 2, benar: 2, ketat: 2 }, abt: { acuan: "10112", n: 2, benar: 2, kosong: 0, nMentah: 2, benarMentah: 2, dipangkas: 0 }, pasang: { n: 2, aleta: 2, abt: 2 } },
    },
    "harta-bersama": {},
  },
  // Jalur itsbat (abtUsulanService.dariPositaItsbat, tombol "Isi dari posita
  // permohonan" pada blangko bermuat #5197#/#8087#) - dipakai jalur itu, bukan
  // oleh dariPositaLain. Blangko asal usul, perwalian, dan harta bersama juga
  // memuat #5197#, jadi tombol itsbat tampil di sana dan perkaranya diukur.
  itsbat: {
    "itsbat-nikah": {
      "1001": { aleta: { n: 643, benar: 285 }, abt: { acuan: "10112", n: 307, benar: 207, kosong: 0, nMentah: 307, benarMentah: 207, dipangkas: 0 }, pasang: { n: 282, aleta: 213, abt: 206 } },
      "1002": { aleta: { n: 670, benar: 655 }, abt: { acuan: "10106", n: 311, benar: 309, kosong: 1, nMentah: 311, benarMentah: 309, dipangkas: 0 }, pasang: { n: 310, aleta: 305, abt: 309 } },
      "1003": { aleta: { n: 670, benar: 654 }, abt: { acuan: "10107", n: 311, benar: 309, kosong: 1, nMentah: 311, benarMentah: 309, dipangkas: 0 }, pasang: { n: 310, aleta: 305, abt: 309 } },
      "1046": { aleta: { n: 631, benar: 614 }, abt: { acuan: "10108", n: 309, benar: 191, kosong: 78, nMentah: 309, benarMentah: 191, dipangkas: 0 }, pasang: { n: 290, aleta: 279, abt: 180 } },
      "1217": { aleta: { n: 637, benar: 578 }, abt: { acuan: "1177", n: 285, benar: 196, kosong: 9, nMentah: 285, benarMentah: 196, dipangkas: 0 }, pasang: { n: 280, aleta: 244, abt: 193 } },
      "5105": { aleta: { n: 675, benar: 627 }, abt: { acuan: "10102", n: 322, benar: 274, kosong: 0, nMentah: 322, benarMentah: 274, dipangkas: 0 }, pasang: { n: 321, aleta: 300, abt: 274 } },
      "5178": { aleta: { n: 269, benar: 260 }, abt: { acuan: "10103", n: 263, benar: 257, kosong: 0, nMentah: 263, benarMentah: 257, dipangkas: 0 }, pasang: { n: 263, aleta: 255, abt: 257 } },
      "5197": { aleta: { n: 296, benar: 232 }, abt: { acuan: "10101", n: 337, benar: 62, kosong: 0, nMentah: 337, benarMentah: 62, dipangkas: 0 }, pasang: { n: 296, aleta: 232, abt: 47 } },
      "7211": { aleta: { n: 230, benar: 183 }, abt: { acuan: "10104", n: 264, benar: 205, kosong: 0, nMentah: 264, benarMentah: 205, dipangkas: 0 }, pasang: { n: 224, aleta: 181, abt: 178 } },
      "7212": { aleta: { n: 231, benar: 180 }, abt: { acuan: "10105", n: 264, benar: 202, kosong: 0, nMentah: 264, benarMentah: 202, dipangkas: 0 }, pasang: { n: 225, aleta: 179, abt: 176 } },
      "8087": { aleta: { n: 517, benar: 266 }, abt: { acuan: "10109", n: 310, benar: 192, kosong: 0, nMentah: 310, benarMentah: 192, dipangkas: 0 }, pasang: { n: 298, aleta: 196, abt: 189 } },
      "0007": { aleta: { n: 560, benar: 511 }, abt: { acuan: "8492", n: 333, benar: 50, kosong: 0, nMentah: 333, benarMentah: 50, dipangkas: 0 }, pasang: { n: 284, aleta: 254, abt: 39 } },
      "0650": { aleta: { n: 569, benar: 509 }, abt: { acuan: "10110", n: 307, benar: 133, kosong: 0, nMentah: 307, benarMentah: 133, dipangkas: 0 }, pasang: { n: 302, aleta: 265, abt: 133 } },
      "0651": { aleta: { n: 543, benar: 476 }, abt: { acuan: "10111", n: 306, benar: 96, kosong: 0, nMentah: 306, benarMentah: 96, dipangkas: 0 }, pasang: { n: 286, aleta: 248, abt: 92 } },
    },
    "asal-usul": {
      "1001": { aleta: { n: 2, benar: 2 }, abt: { acuan: "10112", n: 2, benar: 2, kosong: 0, nMentah: 2, benarMentah: 2, dipangkas: 0 }, pasang: { n: 2, aleta: 2, abt: 2 } },
      "1002": { aleta: { n: 2, benar: 0 }, abt: { acuan: "10106", n: 2, benar: 1, kosong: 1, nMentah: 2, benarMentah: 1, dipangkas: 0 }, pasang: { n: 2, aleta: 0, abt: 1 } },
      "1003": { aleta: { n: 2, benar: 2 }, abt: { acuan: "10107", n: 2, benar: 2, kosong: 0, nMentah: 2, benarMentah: 2, dipangkas: 0 }, pasang: { n: 2, aleta: 2, abt: 2 } },
      "1046": { aleta: { n: 2, benar: 0 }, abt: { acuan: "10108", n: 2, benar: 2, kosong: 0, nMentah: 2, benarMentah: 2, dipangkas: 0 }, pasang: { n: 2, aleta: 0, abt: 2 } },
      "1217": { aleta: { n: 2, benar: 2 }, abt: { acuan: "1177", n: 2, benar: 2, kosong: 0, nMentah: 2, benarMentah: 2, dipangkas: 0 }, pasang: { n: 2, aleta: 2, abt: 2 } },
      "5178": { aleta: { n: 1, benar: 0 }, abt: { acuan: "10103", n: 1, benar: 1, kosong: 0, nMentah: 1, benarMentah: 1, dipangkas: 0 }, pasang: { n: 1, aleta: 0, abt: 1 } },
      "5197": { aleta: { n: 2, benar: 1 }, abt: { acuan: "10101", n: 2, benar: 1, kosong: 0, nMentah: 2, benarMentah: 1, dipangkas: 0 }, pasang: { n: 2, aleta: 1, abt: 1 } },
      "7211": { aleta: { n: 1, benar: 1 }, abt: { acuan: "10104", n: 1, benar: 1, kosong: 0, nMentah: 1, benarMentah: 1, dipangkas: 0 }, pasang: { n: 1, aleta: 1, abt: 1 } },
      "7212": { aleta: { n: 1, benar: 1 }, abt: { acuan: "10105", n: 1, benar: 1, kosong: 0, nMentah: 1, benarMentah: 1, dipangkas: 0 }, pasang: { n: 1, aleta: 1, abt: 1 } },
      "8087": { aleta: { n: 2, benar: 2 }, abt: { acuan: "10109", n: 2, benar: 0, kosong: 0, nMentah: 2, benarMentah: 0, dipangkas: 2 }, pasang: { n: 2, aleta: 2, abt: 0 } },
      "0007": { aleta: { n: 1, benar: 0 }, abt: { acuan: "8492", n: 1, benar: 0, kosong: 0, nMentah: 1, benarMentah: 0, dipangkas: 0 }, pasang: { n: 1, aleta: 0, abt: 0 } },
      "0650": { aleta: { n: 2, benar: 2 }, abt: { acuan: "10110", n: 2, benar: 2, kosong: 0, nMentah: 2, benarMentah: 2, dipangkas: 0 }, pasang: { n: 2, aleta: 2, abt: 2 } },
      "0651": { aleta: { n: 2, benar: 2 }, abt: { acuan: "10111", n: 2, benar: 2, kosong: 0, nMentah: 2, benarMentah: 2, dipangkas: 0 }, pasang: { n: 2, aleta: 2, abt: 2 } },
    },
    perwalian: {
      "1046": { aleta: { n: 0, benar: 0 }, abt: { acuan: "10108", n: 0, benar: 0, kosong: 0, nMentah: 0, benarMentah: 0, dipangkas: 0 }, pasang: { n: 0, aleta: 0, abt: 0 } },
      "1217": { aleta: { n: 0, benar: 0 }, abt: { acuan: "1177", n: 0, benar: 0, kosong: 0, nMentah: 0, benarMentah: 0, dipangkas: 0 }, pasang: { n: 0, aleta: 0, abt: 0 } },
      "5105": { aleta: { n: 0, benar: 0 }, abt: { acuan: "10102", n: 3, benar: 0, kosong: 0, nMentah: 3, benarMentah: 0, dipangkas: 0 }, pasang: { n: 0, aleta: 0, abt: 0 } },
      "5178": { aleta: { n: 0, benar: 0 }, abt: { acuan: "10103", n: 3, benar: 1, kosong: 0, nMentah: 3, benarMentah: 1, dipangkas: 2 }, pasang: { n: 0, aleta: 0, abt: 0 } },
      "5197": { aleta: { n: 0, benar: 0 }, abt: { acuan: "10101", n: 3, benar: 0, kosong: 0, nMentah: 3, benarMentah: 0, dipangkas: 0 }, pasang: { n: 0, aleta: 0, abt: 0 } },
      "0007": { aleta: { n: 0, benar: 0 }, abt: { acuan: "8492", n: 3, benar: 0, kosong: 0, nMentah: 3, benarMentah: 0, dipangkas: 0 }, pasang: { n: 0, aleta: 0, abt: 0 } },
    },
    "harta-bersama": {
      "5178": { aleta: { n: 0, benar: 0 }, abt: { acuan: "10103", n: 0, benar: 0, kosong: 0, nMentah: 0, benarMentah: 0, dipangkas: 0 }, pasang: { n: 0, aleta: 0, abt: 0 } },
      "5197": { aleta: { n: 0, benar: 0 }, abt: { acuan: "10101", n: 0, benar: 0, kosong: 0, nMentah: 0, benarMentah: 0, dipangkas: 0 }, pasang: { n: 0, aleta: 0, abt: 0 } },
      "0007": { aleta: { n: 0, benar: 0 }, abt: { acuan: "8492", n: 0, benar: 0, kosong: 0, nMentah: 0, benarMentah: 0, dipangkas: 0 }, pasang: { n: 0, aleta: 0, abt: 0 } },
    },
  },
};

/**
 * Jenis yang dikenal keputusan sumber: empat jenis perkara lain, ditambah
 * itsbat nikah untuk jalur itsbat. dariPositaLain TIDAK melayani itsbat -
 * kenaliJenis tetap hanya JENIS_LAIN.
 */
const JENIS_TERUKUR = Object.freeze([
  ...JENIS_LAIN,
  // SIPP menulis "Istbat"; "Pengesahan Perkawinan/Istbat Nikah" = 360.
  { kunci: "itsbat-nikah", nama: "Itsbat Nikah", jenisPerkaraId: 360, pola: /\bi[st]{1,2}bat\b|pengesahan\s+perkawinan/i },
]);

/** Jenis dari id SIPP, kunci, atau nama, dicari di `daftar`. */
function cariJenis(daftar, jenisPerkara) {
  const teks = String(jenisPerkara === undefined || jenisPerkara === null ? "" : jenisPerkara).trim();
  if (!teks) return null;
  const angka = Number(teks);
  return (
    daftar.find((j) => j.kunci === teks) ||
    (Number.isFinite(angka) ? daftar.find((j) => j.jenisPerkaraId === angka) : null) ||
    daftar.find((j) => j.pola.test(teks)) ||
    null
  );
}

/** Kunci jenis dari masukan: id jenis perkara SIPP, nama, atau kunci. */
function kenaliJenis(jenisPerkara, alur) {
  void alur;
  return cariJenis(JENIS_LAIN, jenisPerkara);
}

/** Seperti kenaliJenis, ditambah itsbat nikah - untuk keputusan sumber. */
function kenaliJenisTerukur(jenisPerkara) {
  return cariJenis(JENIS_TERUKUR, jenisPerkara);
}

/** Nomor variabel ABT 4 digit ("5178", 5178, "#5178#"); 5 digit apa adanya. */
function kodeVariabel(kode) {
  const d = String(kode === undefined || kode === null ? "" : kode).replace(/\D/g, "");
  return d && d.length < 4 ? d.padStart(4, "0") : d;
}

/** Satu baris UKUR_SUMBER, atau null. */
function barisUkur(jalur, kunciJenis, kode) {
  return ((UKUR_SUMBER[jalur] || {})[kunciJenis] || {})[kodeVariabel(kode)] || null;
}

const bulat3 = (x) => Number(x.toFixed(3));

/**
 * Dasar gerbang satu baris: `pasang` bila ada bawaan ABT (perkara yang sama,
 * masa bawaan), selainnya semua isian sah (`aleta`); ditambah `gabung`.
 */
function dasarGerbang(u) {
  const g = u.gabung || { n: 0, benar: 0 };
  const inti = u.abt ? { n: u.pasang.n, benar: u.pasang.aleta } : { n: u.aleta.n, benar: u.aleta.benar };
  return { n: inti.n + g.n, benar: inti.benar + g.benar };
}

/**
 * Baris ukur yang berlaku. Jalur itsbat meminjam baris itsbat nikah bila baris
 * jenisnya sendiri belum mencapai n minimal (lihat GERBANG_ITSBAT); `wakil`
 * menyebut peminjaman itu, null bila barisnya milik jenis itu sendiri.
 */
function barisBerlaku(jalur, kunciJenis, kode) {
  const u = barisUkur(jalur, kunciJenis, kode);
  if (jalur !== "itsbat" || kunciJenis === GERBANG_ITSBAT.jenisWakil) return { u, wakil: null };
  const nSendiri = u ? dasarGerbang(u).n : 0;
  if (nSendiri >= GERBANG_ITSBAT.nMinimal) return { u, wakil: null };
  const w = barisUkur(jalur, GERBANG_ITSBAT.jenisWakil, kode);
  return w ? { u: w, wakil: { jenis: GERBANG_ITSBAT.jenisWakil, nSendiri } } : { u, wakil: null };
}

/** Siap atau belum menurut dasar gerbang (jalur bawaan: posita-lain). */
function keadaanGerbang(jenis, kode, jalur) {
  const j = jalur || "posita-lain";
  const { u } = barisBerlaku(j, jenis, kode);
  if (!u) return { siap: false, alasan: "belum diukur", presisi: null, n: 0 };
  const g = j === "itsbat" ? GERBANG_ITSBAT : GERBANG;
  const d = dasarGerbang(u);
  const presisi = d.n ? bulat3(d.benar / d.n) : null;
  if (d.n < g.nMinimal) return { siap: false, alasan: `n<${g.nMinimal}`, presisi, n: d.n };
  if (d.benar / d.n < g.presisiMinimal) return { siap: false, alasan: `presisi<${g.presisiMinimal}`, presisi, n: d.n };
  return { siap: true, alasan: "", presisi, n: d.n };
}

/**
 * KEPUTUSAN SUMBER TERUKUR untuk satu variabel - dipakai dariPositaLain, dan
 * disediakan untuk jalur itsbat (abtUsulanService) dengan opsi.jalur 'itsbat'.
 *
 * @param {string|number} jenisPerkara id jenis perkara SIPP (362, 360, ...), nama, atau kunci
 * @param {string|number} kode nomor variabel ABT ("5178")
 * @param {{jalur?: 'posita-lain'|'itsbat'}} [opsi] jalur aturan ALETA; bawaan 'posita-lain'
 * @returns {{
 *   sumber: 'aleta'|'abt'|'belum-terukur',
 *   jalur: string, jenis: string|null, kode: string,
 *   presisiAleta: number|null, n: number,
 *   ketepatanAbt: number|null, nAbt: number, acuan: string|null,
 *   gerbang: {siap: boolean, alasan: string, presisi: number|null, n: number},
 *   alasan: string
 * }}
 *   presisiAleta/n   atas dasar gerbang (pembanding yang sah)
 *   ketepatanAbt/nAbt bawaan ABT atas perkara yang sama dengan ALETA (pasang)
 *   acuan            kueri bawaan ABT ("10103"), null bila tidak ada
 *   jenisUkur        jenis yang barisnya dipakai - itsbat nikah bila jalur
 *                    itsbat meminjamnya (GERBANG_ITSBAT)
 * Hanya sumber 'aleta' yang boleh diusulkan ALETA. 'abt' berarti ABT
 * MENAWARKAN isian bawaan dari kueri #acuan# yang wajib diperiksa petugas.
 * Jalur itsbat memakai GERBANG_ITSBAT; jalur posita-lain memakai GERBANG.
 */
function sumberUsulanTerukur(jenisPerkara, kode, opsi) {
  const jalur = (opsi && opsi.jalur) || "posita-lain";
  const jenis = kenaliJenisTerukur(jenisPerkara);
  const k = kodeVariabel(kode);
  const hasil = {
    sumber: "belum-terukur",
    jalur,
    jenis: jenis ? jenis.kunci : null,
    kode: k,
    presisiAleta: null,
    n: 0,
    ketepatanAbt: null,
    nAbt: 0,
    acuan: null,
    jenisUkur: null,
    gerbang: { siap: false, alasan: "belum diukur", presisi: null, n: 0 },
    alasan: "",
  };
  if (!jenis) return { ...hasil, gerbang: { ...hasil.gerbang, alasan: "jenis tidak dikenal" }, alasan: "jenis perkara tidak dikenal" };
  const { u, wakil } = barisBerlaku(jalur, jenis.kunci, k);
  if (!u) return { ...hasil, alasan: "belum diukur" };
  const gerbang = keadaanGerbang(jenis.kunci, k, jalur);
  Object.assign(hasil, { gerbang, presisiAleta: gerbang.presisi, n: gerbang.n, jenisUkur: wakil ? wakil.jenis : jenis.kunci });
  if (u.abt) {
    Object.assign(hasil, {
      acuan: u.abt.acuan,
      nAbt: u.pasang.n,
      ketepatanAbt: u.pasang.n ? bulat3(u.pasang.abt / u.pasang.n) : null,
    });
  }
  const kueri = u.abt ? `#${u.abt.acuan}#` : "";
  const pinjam = wakil ? `diukur pada ${wakil.jenis} - pengurai yang sama, ${jenis.kunci} baru n ${wakil.nSendiri}; ` : "";
  if (!gerbang.siap) {
    return u.abt
      ? { ...hasil, sumber: "abt", alasan: `${pinjam}aturan ALETA belum lulus gerbang (${gerbang.alasan}); ABT menawarkan isian bawaan dari kueri ${kueri}` }
      : { ...hasil, sumber: "belum-terukur", alasan: `${pinjam}aturan ALETA belum lulus gerbang (${gerbang.alasan})` };
  }
  if (!u.abt) return { ...hasil, sumber: "aleta", alasan: `${pinjam}lulus gerbang (presisi ${gerbang.presisi}, n ${gerbang.n}); tidak ada bawaan ABT` };
  if (!u.pasang.n) return { ...hasil, sumber: "abt", alasan: `${pinjam}bawaan ABT ${kueri} belum dapat dibandingkan pada perkara yang sama` };
  const banding = `ALETA ${u.pasang.aleta}/${u.pasang.n}, ABT ${u.pasang.abt}/${u.pasang.n} pada perkara yang sama`;
  if (u.pasang.aleta >= u.pasang.abt) {
    return { ...hasil, sumber: "aleta", alasan: `${pinjam}lulus gerbang dan tidak lebih buruk dari bawaan ABT ${kueri} (${banding})` };
  }
  // Jalur itsbat: kalah tipis dari bawaan ABT masih dianggap setara.
  if (jalur === "itsbat" && u.pasang.aleta / u.pasang.n >= u.pasang.abt / u.pasang.n - GERBANG_ITSBAT.selisihAbtMaks) {
    return {
      ...hasil,
      sumber: "aleta",
      alasan: `${pinjam}lulus gerbang dan setara dengan bawaan ABT ${kueri} (selisih paling banyak ${GERBANG_ITSBAT.selisihAbtMaks}; ${banding})`,
    };
  }
  return { ...hasil, sumber: "abt", alasan: `${pinjam}bawaan ABT ${kueri} terukur lebih tepat (${banding})` };
}

/**
 * Variabel yang boleh diusulkan dariPositaLain, per jenis: sumber terukurnya
 * 'aleta'. Diturunkan dari ATURAN_LAIN dan UKUR_SUMBER, bukan ditulis tangan.
 * Hasil 26 September 2026: DK 0606, 0600, 0607, 0601, 5178; jenis lain kosong.
 */
function susunVariabelSiap() {
  return Object.fromEntries(
    Object.entries(ATURAN_LAIN).map(([jenis, aturan]) => [
      jenis,
      aturan.filter((a) => sumberUsulanTerukur(jenis, a.kode).sumber === "aleta").map((a) => a.kode),
    ])
  );
}

const VARIABEL_SIAP = Object.freeze(
  Object.fromEntries(Object.entries(susunVariabelSiap()).map(([jenis, daftar]) => [jenis, Object.freeze(daftar)]))
);

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
 * @returns {{ok: boolean, jenis: string, usulan: object[], belumSiap: object[], bawaanAbt: object[], alasan?: string, catatan?: string}}
 *
 * Tiap aturan jenis itu masuk TEPAT SATU daftar, menurut sumberUsulanTerukur:
 *   usulan     sumber 'aleta' - {kode, nama, nilai, keyakinan, sumber, siap}
 *   bawaanAbt  sumber 'abt' - {kode, acuan, alasan}: ALETA tidak mengusulkan;
 *              ABT menawarkan isian bawaan dari kueri #acuan# di kotak
 *              popupnya, dan petugas wajib memeriksanya sebelum menyimpan
 *   belumSiap  sumber 'belum-terukur' - {kode, alasan, presisi, n}
 * Ketiga daftar selalu ada, juga pada ok:false (kosong).
 *
 * `sebutan` dan `tipeKeluaran` diterima sesuai kontrak; belum ada daftar tipe
 * keluaran untuk perkara lain, dan sebutan pihak tidak dipakai aturan mana pun
 * di bawah - keduanya tidak mengubah hasil.
 */
function dariPositaLain(posita, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const jenis = kenaliJenis(o.jenisPerkara, o.alur);
  if (!jenis) {
    return { ok: false, jenis: "", usulan: [], belumSiap: [], bawaanAbt: [], alasan: "jenis_perkara_tidak_dilayani" };
  }
  const teks = polos(posita);
  if (!teks) {
    return { ok: false, jenis: jenis.kunci, usulan: [], belumSiap: [], bawaanAbt: [], alasan: "posita_kosong" };
  }
  const konteks = konteksAturan(posita);
  const usulan = [];
  const belumSiap = [];
  const bawaanAbt = [];
  for (const aturan of ATURAN_LAIN[jenis.kunci] || []) {
    const keputusan = sumberUsulanTerukur(jenis.kunci, aturan.kode);
    // Bawaan ABT lebih tepat, atau ALETA belum lulus padahal ABT punya
    // bawaan: disebut beserta kuerinya - bukan hilang diam-diam.
    if (keputusan.sumber === "abt") {
      bawaanAbt.push({ kode: aturan.kode, acuan: keputusan.acuan, alasan: keputusan.alasan });
      continue;
    }
    if (keputusan.sumber !== "aleta") {
      const g = keputusan.gerbang;
      belumSiap.push({ kode: aturan.kode, alasan: g.alasan, presisi: g.presisi, n: g.n });
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
  const jawaban = { ok: true, jenis: jenis.kunci, usulan, belumSiap, bawaanAbt };
  if (!(ATURAN_LAIN[jenis.kunci] || []).length) {
    jawaban.catatan = `Belum ada aturan ${jenis.nama} yang dapat diukur: isian ABT manusianya terlalu sedikit dan tidak berasal dari posita.`;
  }
  return jawaban;
}

/**
 * ============================================================================
 * JALUR ITSBAT - USULAN PENGURAI DISARING MENURUT SUMBER TERUKUR
 * ============================================================================
 *
 * dariPositaItsbat (abtUsulanService) tetap mengurai ke-14 variabel: aturan
 * perkara lain meminjam hasilnya (lihat pemakaiannya di ATURAN_LAIN), dan uji
 * pengurainya membaca semuanya. Yang disaring hanya yang DIKIRIM ke panel
 * lewat rute /abt/usulan sumber 'itsbat', dengan GERBANG_ITSBAT:
 *   'aleta'          tetap di `usulan`;
 *   'abt'            pindah ke `bawaanAbt` - panel menyebut kuerinya sebagai
 *                    tawaran ABT yang wajib diperiksa (kabarPositaLain);
 *   'belum-terukur'  pindah ke `belumSiap`.
 * Bentuknya sama dengan dariPositaLain, sehingga panel memakai satu kabar.
 *
 * @param {object} hasil keluaran dariPositaItsbat
 * @param {string|number} [jenisPerkara] kosong/tidak dikenal = itsbat nikah
 */
function saringUsulanItsbat(hasil, jenisPerkara) {
  if (!hasil || hasil.ok === false || !Array.isArray(hasil.usulan)) return hasil;
  const jenis = kenaliJenisTerukur(jenisPerkara) ? jenisPerkara : GERBANG_ITSBAT.jenisWakil;
  const usulan = [];
  const bawaanAbt = [];
  const belumSiap = [];
  for (const u of hasil.usulan) {
    const k = sumberUsulanTerukur(jenis, u.kode, { jalur: "itsbat" });
    if (k.sumber === "aleta") usulan.push(u);
    else if (k.sumber === "abt") bawaanAbt.push({ kode: u.kode, nama: u.nama, acuan: k.acuan, alasan: k.alasan });
    else belumSiap.push({ kode: u.kode, nama: u.nama, alasan: k.gerbang.alasan, presisi: k.gerbang.presisi, n: k.gerbang.n });
  }
  const ditemukan = usulan.filter((u) => u.nilai).length;
  // Posita yang sama sekali tidak berpola itsbat tetap memakai kabar pengurai.
  if (!hasil.ditemukan) return { ...hasil, ditemukan, usulan, bawaanAbt, belumSiap };
  const diserahkan = bawaanAbt.length
    ? ` ${bawaanAbt.length} variabel diserahkan ke isian bawaan ABT yang terukur lebih tepat.`
    : "";
  const catatan = `${ditemukan} dari ${usulan.length} variabel usulan ALETA terbaca dari posita; sisanya dikosongkan, bukan ditebak.${diserahkan}`;
  return { ...hasil, ditemukan, usulan, bawaanAbt, belumSiap, catatan };
}

module.exports = {
  JENIS_LAIN,
  ATURAN_LAIN,
  GERBANG,
  GERBANG_ITSBAT,
  UKUR_SUMBER,
  VARIABEL_SIAP,
  kenaliJenis,
  kenaliJenisTerukur,
  keadaanGerbang,
  sumberUsulanTerukur,
  susunVariabelSiap,
  konteksAturan,
  calonMempelai,
  namaBerpenyambung,
  dariPositaLain,
  saringUsulanItsbat,
};
