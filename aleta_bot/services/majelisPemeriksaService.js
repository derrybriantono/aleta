"use strict";

/**
 * ============================================================================
 * MAJELIS PEMERIKSA DAN MAJELIS IKRAR TALAK - SATU SUMBER ATURAN
 * ============================================================================
 *
 * Siapa yang MEMERIKSA suatu perkara tidak sama dengan siapa yang
 * penunjukannya aktif sekarang. Tiga pemakai membutuhkan jawaban yang sama:
 *
 *   - rekapPetugasService      kedudukan seseorang pada tiap perkaranya;
 *   - sippStatusPerkaraService bagian "Majelis dan petugas" Status Perkara;
 *   - evidenSkpService         eviden SKP per petugas.
 *
 * Karena itu aturannya hanya ditulis DI SINI. Bila salah satunya menulis
 * ulang, suatu hari rekap menyebut seseorang memeriksa perkara yang di layar
 * Status Perkara tertulis diperiksa orang lain - dan eviden SKP-nya ikut
 * salah alamat.
 *
 * ============================================================================
 * AKTIF SEKARANG BUKAN PEMERIKSA
 * ============================================================================
 *
 * SIPP MENONAKTIFKAN seluruh majelis pemeriksaan (tahapan 10) begitu majelis
 * ikrar talak (tahapan 18) ditetapkan - tanpa tanggal tidak aktif, dan
 * diganti_oleh_id tidak pernah diisi (0 baris). Terukur di sipp_donggala
 * 27 September 2026: 817 dari 829 perkara bermajelis ikrar kehilangan seluruh
 * baris aktif majelis pemeriksanya. Contoh perkara_id 385: Muh. Arasy Latif
 * ketua pemeriksa (tahapan 10, T), Ulfah ketua ikrar (tahapan 18, Y). Layar
 * yang membaca aktif='Y' saja menulis Ulfah sebagai ketua majelis perkara
 * yang tidak pernah ia periksa.
 *
 * Pada data lama majelis ikrar juga dicatat sebagai PENGGANTI di tahapan 10,
 * bertanggal, SESUDAH putusan: perkara_id 1895 putus 16 Agustus 2017, majelis
 * pemeriksanya "diganti" 6 September 2017 oleh majelis yang sama dengan
 * majelis ikrarnya. Sebagian pengganti sesudah putusan itu bahkan masih aktif
 * (perkara_id 2373, 4613). Yang aktif sekarang, maupun yang terakhir
 * ditetapkan, karena itu bukan pemeriksa. Pemeriksa perkara yang sudah putus
 * adalah yang MENJABAT PADA HARI PUTUSAN - lihat menjabatPadaPutusan.
 *
 * Membaca baris aktif saja salah alamat ke dua arah: pemeriksa sesungguhnya
 * terbaca "pernah diganti", dan ketua ikrar dikreditkan sebagai ketua majelis
 * beserta hasil putusan, lama, dan verstek perkara yang tidak pernah ia
 * periksa. Terukur atas seluruh penunjukan sipp_donggala 27 September 2026:
 * aturan aktif-saja kehilangan 346 pasangan hakim-perkara pemeriksa (236
 * perkara) dan mengkreditkan 316 pasangan (226 perkara) kepada hakim yang
 * tidak memeriksanya; pada 142 dari 813 perkara berketua ikrar, ketua ikrarnya
 * bukan ketua pemeriksanya. Panitera: 11 hilang, 18 salah kredit; juru sita:
 * 6 dan 6 - pengganti sesudah putusan dan petugas yang hanya pada ikrar.
 *
 * Pergantian SUNGGUHAN di tengah pemeriksaan tetap tertangkap: yang diganti
 * sebelum hari putusan tidak menjabat pada hari itu (misalnya perkara_id
 * 10035, "Ketua majelis sebelumnya sedang cuti").
 *
 * Aturan yang sama berlaku untuk ketiga tabel penunjukan - majelis hakim,
 * panitera pengganti, dan juru sita.
 *
 * ============================================================================
 * API BAKU
 * ============================================================================
 *
 *   penunjukanPerkaraBanyak(perkaraIds) -> Promise<Map<string perkaraId, {
 *     tanggalPutusan: "yyyy-mm-dd" | null,
 *     pemeriksa: {
 *       hakim:    [{ kedudukan, nama, hakimId, urutan, tahapanId, kode }],
 *       panitera: [{ nama, paniteraId, tahapanId, kode }],
 *       jurusita: [{ nama, jurusitaId, tahapanId, kode }],
 *     },
 *     ikrar: { hakim, panitera, jurusita } | null,          // bentuk tiap daftar sama
 *     penetapanIkrar: { hakim, panitera, jurusita } | null, // borang ikrar SIPP
 *   }>>
 *
 *   ikrarLengkap(entri) -> { hakim, panitera, jurusita } | null   (murni)
 *
 *   - Kuncinya perkara_id sebagai TEKS. Setiap id sah yang diminta mendapat
 *     entri, walau tanpa satu pun penunjukan (daftarnya kosong) - pemakai
 *     tidak perlu membedakan "tidak ada" dari "tidak diminta". Id yang tidak
 *     sah (bukan bilangan bulat positif) dilewati.
 *   - kedudukan hakim: "Hakim Ketua", "Hakim Tunggal", "Hakim Anggota 1",
 *     "Hakim Anggota 2", ... - penamaan yang SAMA dengan majelis_hakim_text
 *     borang ikrar SIPP. Nomor anggota menurut kursi/urutan SIPP, dihitung per
 *     tahapan; jabatan yang tidak dikenali memakai nama jabatan pada barisnya,
 *     atau "Hakim" bila kosong.
 *   - tahapanId 10 = pemeriksaan. Baris aktif tahapan lain selain ikrar talak
 *     (verzet 16, banding 20, kasasi 30, PK 40 - 13 baris pada ketiga tabel
 *     sipp_donggala) ikut dihitung pemeriksa, sama dengan rekap; tahapanId
 *     disertakan supaya layar dapat menyebutnya.
 *   - ikrar: penunjukan AKTIF tahapan 18 - kedudukan "ikrar talak" pada rekap.
 *     null bila tidak satu pun dari ketiga tabel punya baris aktif tahapan 18.
 *   - penetapanIkrar: yang dicatat BORANG penetapan ikrar talak SIPP
 *     (perkara_ikrar_talak: majelis_hakim_id, panitera_pengganti_id,
 *     jurusita_id). null bila perkaranya tanpa borang ikrar, atau SIPP-nya
 *     tidak punya tabel/kolom itu. Lihat "PANITERA DAN JURU SITA IKRAR" di
 *     bawah - tanpa sumber ini blok ikrar hampir selalu tanpa panitera.
 *   - ikrarLengkap: per peran, penunjukan tahapan 18 bila ada, selainnya
 *     borang ikrar; tiap orang membawa `sumber` ("penunjukan" atau
 *     "penetapanIkrar"). Itulah yang ditampilkan Status Perkara.
 *   - Id orang (hakimId, paniteraId, jurusitaId) null bila barisnya tanpa id.
 *     Nama hanya DIBACA untuk ditampilkan - salinan nama SIPP tidak seragam
 *     untuk orang yang sama, jadi pencocokan orang WAJIB lewat id.
 *   - Galat basis data DILEMPAR, tidak ditelan: pemakai yang memutuskan
 *     jatuh ke mana (Status Perkara memakai aman() dan menyebut kegagalannya).
 *
 * ============================================================================
 * PANITERA DAN JURU SITA IKRAR - TABEL PENUNJUKAN HAMPIR TIDAK MENCATATNYA
 * ============================================================================
 *
 * Terukur di sipp_donggala 27 September 2026: dari 814 perkara berpenunjukan
 * aktif tahapan 18, 790 tanpa baris panitera tahapan 18 dan 801 tanpa baris
 * juru sita tahapan 18 - SIPP hanya menulis majelis hakimnya ke tabel
 * penunjukan. Siapa panitera dan juru sita sidang ikrar dicatat pada borang
 * perkara_ikrar_talak: pada 746 perkara yang dapat dibandingkan, panitera
 * borang itu SAMA dengan panitera pemeriksaan pada 708, dan BERBEDA pada
 * sisanya (misalnya perkara_id 796, 1291, 1713: panitera ikrar ditunjuk
 * tersendiri sesudah putusan, dan hanya borang itu yang mencatatnya). Juru
 * sita: 746 dari 768 sama. Karena itu "sama dengan pemeriksaan" TIDAK
 * ditebakkan; yang ditampilkan catatan borangnya.
 *
 * Borang itu juga mencatat majelis ikrar pada 73 perkara yang tidak punya
 * baris aktif tahapan 18 sama sekali - data lama yang seluruh baris
 * penunjukannya T (perkara_id 1, 4, 384), atau majelis ikrar yang barisnya
 * kemudian dinonaktifkan (4613) atau dicatat sebagai hakim tunggal pengganti
 * di tahapan 10 (2373).
 *
 * `ikrar` tetap penunjukan aktif tahapan 18 saja - kedudukan yang dihitung
 * rekap - supaya rekap dan pemakai lain tidak berubah diam-diam;
 * `penetapanIkrar` disediakan terpisah, dan ikrarLengkap menggabungkannya.
 *
 * ============================================================================
 * SELURUHNYA SELECT
 * ============================================================================
 *
 * Kuerinya ditulis harfiah di dalam runQuery - penjaga verify-pemisahan-
 * database dan verify-sipp-baca-saja membaca teksnya untuk memastikan tidak
 * satu pun menulis ke SIPP. Daftar IN (...) dipotong per 500 id supaya satu
 * kueri tidak membawa ribuan tanda tanya. Nama kolom borang ikrar dipilih
 * lewat sippSkemaService dari daftar calon yang tetap - bukan masukan.
 */

const db = require("../db_config");
const { cleanText } = require("./ecourtTextService");
const sippSkemaService = require("./sippSkemaService");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

const TAHAPAN_PEMERIKSAAN = 10;
const TAHAPAN_IKRAR = 18;
/** Potongan daftar IN (...) per kueri. */
const POTONGAN_IN = 500;

// ============================================================================
// ATURAN - MURNI, TANPA BASIS DATA
// ============================================================================
//
// Satu baris penunjukan berbentuk:
//   { id, perkaraId, tahapan, urutan, orang, jabatan, aktif, tidakAktif,
//     penetapan }   (+ nama, kode, dan jabatanNama bila dibaca untuk ditampilkan)
// Tanggal berupa teks yyyy-mm-dd, sebagaimana DATE_FORMAT pada kuerinya.

function barisAktif(b) {
  return cleanText(b.aktif).toUpperCase() === "Y";
}

/** Tanggal yyyy-mm-dd yang sah, atau "" bila kosong, nol, atau tak terbaca. */
function tanggalSah(nilai) {
  const teks = String(nilai || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) && !teks.startsWith("0000") ? teks : "";
}

function barisBertanggal(b) {
  return tanggalSah(b.tidakAktif) !== "";
}

/**
 * Menjabat pada hari putusan: ditetapkan paling lambat hari itu, dan belum
 * dinonaktifkan sebelum hari itu.
 *
 * Penonaktifan TANPA tanggal (oleh penetapan majelis ikrar) tidak diketahui
 * harinya, jadi tidak menggugurkan - begitulah majelis pemeriksa perkara 385
 * tetap terbaca. Baris yang masih AKTIF dianggap menjabat walau tanggal tidak
 * aktifnya terisi: terukur di sipp_donggala, baris aktif bertanggal tidak
 * aktif ada (ketiga hakim perkara_id 703), dan penanda aktif SIPP lebih
 * dipercaya daripada tanggal yang tertinggal.
 */
function menjabatPadaPutusan(b, hariPutus) {
  const ditetapkan = tanggalSah(b.penetapan);
  if (!ditetapkan || ditetapkan > hariPutus) return false;
  if (barisAktif(b)) return true;
  const berhenti = tanggalSah(b.tidakAktif);
  return !berhenti || berhenti >= hariPutus;
}

/** a ditetapkan lebih akhir daripada b? Penetapan, lalu id yang lebih besar. */
function lebihAkhirDitetapkan(a, b) {
  const pa = tanggalSah(a.penetapan);
  const pb = tanggalSah(b.penetapan);
  if (pa !== pb) return pa > pb;
  return Number(a.id) > Number(b.id);
}

/**
 * a lebih akhir daripada b, bila hari putusan tidak dapat menjadi penentu?
 *
 * Yang TIDAK bertanggal-tidak-aktif didahulukan: tanggal itu penanda
 * pergantian, sedangkan penonaktifan oleh majelis ikrar tidak bertanggal.
 * Sesudah itu penetapan yang lebih akhir, lalu id yang lebih besar.
 */
function lebihAkhir(a, b) {
  if (barisBertanggal(a) !== barisBertanggal(b)) return !barisBertanggal(a);
  return lebihAkhirDitetapkan(a, b);
}

/** Satu baris per kursi (urutan): yang paling akhir menurut pembanding. */
function terakhirTiapKursi(baris, lebihAkhirDari) {
  const perKursi = new Map();
  for (const b of baris) {
    const kursi = b.urutan === null || b.urutan === undefined ? "?" : String(b.urutan);
    const lama = perKursi.get(kursi);
    if (!lama || lebihAkhirDari(b, lama)) perKursi.set(kursi, b);
  }
  return [...perKursi.values()];
}

/**
 * Id baris penunjukan yang dihitung PEMERIKSA pada satu perkara.
 *
 *   - Tahapan pemeriksaan (10) perkara yang SUDAH PUTUS: tiap kursi, yang
 *     paling akhir ditetapkan di antara yang menjabat pada hari putusan.
 *     Kursi yang tidak berpejabat pada hari itu kosong - terukur: majelis
 *     yang diganti hakim tunggal sebelum putusan (perkara_id 2730).
 *   - Tahapan 10 perkara yang BELUM putus, atau yang tak satu pun barisnya
 *     menjabat pada hari putusan (tanggal penetapan yang tertulis sesudahnya):
 *     baris yang aktif. Bila tak satu pun aktif - SIPP menonaktifkannya saat
 *     majelis ikrar ditetapkan - baris terakhir tiap kursi.
 *   - Tahapan lain selain ikrar talak (verzet dan sebagainya - 13 baris pada
 *     ketiga tabel penunjukan sipp_donggala): baris yang aktif.
 *
 * @param baris SELURUH baris penunjukan SATU perkara pada satu tabel.
 * @param putus tanggal putusan perkara itu (yyyy-mm-dd), kosong bila belum.
 * @returns Set id baris.
 */
function barisPemeriksa(baris, putus) {
  const pemeriksa = new Set();
  const bukanIkrar = baris.filter((b) => Number(b.tahapan) !== TAHAPAN_IKRAR);
  for (const b of bukanIkrar) {
    if (Number(b.tahapan) !== TAHAPAN_PEMERIKSAAN && barisAktif(b)) pemeriksa.add(b.id);
  }
  const pemeriksaan = bukanIkrar.filter((b) => Number(b.tahapan) === TAHAPAN_PEMERIKSAAN);
  const hariPutus = tanggalSah(putus);
  const menjabat = hariPutus ? pemeriksaan.filter((b) => menjabatPadaPutusan(b, hariPutus)) : [];
  let terpilih;
  if (menjabat.length > 0) terpilih = terakhirTiapKursi(menjabat, lebihAkhirDitetapkan);
  else if (pemeriksaan.some(barisAktif)) terpilih = pemeriksaan.filter(barisAktif);
  else terpilih = terakhirTiapKursi(pemeriksaan, lebihAkhir);
  for (const b of terpilih) pemeriksa.add(b.id);
  return pemeriksa;
}

/**
 * Baris yang menjadikan seseorang majelis atau petugas IKRAR TALAK: yang
 * AKTIF pada tahapan 18. Kedudukan tersendiri - majelis itu menyaksikan
 * ikrar sesudah putusan dijatuhkan majelis pemeriksa, bukan memeriksa.
 */
function barisIkrar(baris) {
  return baris.filter((b) => Number(b.tahapan) === TAHAPAN_IKRAR && barisAktif(b));
}

// ============================================================================
// SUSUNAN UNTUK DITAMPILKAN
// ============================================================================

const JABATAN_KETUA = 1;
const JABATAN_ANGGOTA = 2;
const JABATAN_TUNGGAL = 3;
/** Ketua dan hakim tunggal di depan, lalu anggota, lalu yang tak dikenali. */
const TINGKAT_TAMPIL = { [JABATAN_KETUA]: 1, [JABATAN_TUNGGAL]: 1, [JABATAN_ANGGOTA]: 2 };

function bilanganAtauNull(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const angka = Number(nilai);
  return Number.isFinite(angka) ? angka : null;
}

/** Id orang pada baris penunjukan, atau null - sama dengan idOrang Jadwal Sidang. */
function idOrang(nilai) {
  const angka = Number(nilai);
  return Number.isSafeInteger(angka) && angka > 0 ? angka : null;
}

/**
 * Urutan tampil: tahapan pemeriksaan dulu lalu tahapan lain menaik, kursi
 * (urutan SIPP), tingkat jabatan, lalu id baris - supaya susunannya tidak
 * berubah-ubah antar pembacaan.
 */
function bandingkanTampil(a, b) {
  const ta = Number(a.tahapan) === TAHAPAN_PEMERIKSAAN ? -1 : Number(a.tahapan) || 0;
  const tb = Number(b.tahapan) === TAHAPAN_PEMERIKSAAN ? -1 : Number(b.tahapan) || 0;
  if (ta !== tb) return ta - tb;
  const ua = bilanganAtauNull(a.urutan);
  const ub = bilanganAtauNull(b.urutan);
  if (ua !== ub) return (ua === null ? Infinity : ua) - (ub === null ? Infinity : ub);
  const ja = TINGKAT_TAMPIL[Number(a.jabatan)] || 3;
  const jb = TINGKAT_TAMPIL[Number(b.jabatan)] || 3;
  if (ja !== jb) return ja - jb;
  return Number(a.id) - Number(b.id);
}

/** Majelis hakim tersusun beserta kedudukannya. Anggota dinomori per tahapan. */
function susunHakim(baris) {
  const anggotaKe = new Map();
  return [...baris].sort(bandingkanTampil).map((b) => {
    const tahapanId = Number(b.tahapan) || null;
    const jabatan = Number(b.jabatan);
    let kedudukan;
    if (jabatan === JABATAN_KETUA) kedudukan = "Hakim Ketua";
    else if (jabatan === JABATAN_TUNGGAL) kedudukan = "Hakim Tunggal";
    else if (jabatan === JABATAN_ANGGOTA) {
      const ke = (anggotaKe.get(tahapanId) || 0) + 1;
      anggotaKe.set(tahapanId, ke);
      kedudukan = `Hakim Anggota ${ke}`;
    } else {
      kedudukan = cleanText(b.jabatanNama) || "Hakim";
    }
    return {
      kedudukan,
      nama: cleanText(b.nama),
      hakimId: idOrang(b.orang),
      urutan: bilanganAtauNull(b.urutan),
      tahapanId,
      kode: cleanText(b.kode),
    };
  });
}

function susunPetugas(baris, kunciId) {
  return [...baris].sort(bandingkanTampil).map((b) => ({
    nama: cleanText(b.nama),
    [kunciId]: idOrang(b.orang),
    tahapanId: Number(b.tahapan) || null,
    kode: cleanText(b.kode),
  }));
}

// ============================================================================
// BORANG PENETAPAN IKRAR TALAK (perkara_ikrar_talak)
// ============================================================================
//
// Bentuk yang terukur di sipp_donggala 27 September 2026 (989 baris):
//   majelis_hakim_id    "9,1,6" - urutan borang: ketua dulu
//   majelis_hakim_text  "Hakim Ketua: Ulfah, S.Ag., M.H.</br>Hakim Anggota 1:
//                       ...</br>Hakim Anggota 2: ..." (899 baris), "Hakim
//                       Tunggal: ..." (3), atau "Majelis Hakim : A<br>B<br>C"
//                       tanpa sebutan per orang (11)
//   panitera_pengganti_text  "Panitera Pengganti: X" (821) atau nama saja (47)
//   jurusita_text       "Juru Sita Pengganti: X" (817), "Jurusita: X" (25),
//                       "Jurusita Pengganti: X" (1), atau nama saja
// Id panitera dapat NULL walau namanya tertulis (perkara_id 385): namanya
// tetap tampil, sebagai teks - tidak dicocokkan ke siapa pun lewat ejaan.

/** Pemisah baris teks SIPP: <br>, <br/>, </br>, juga ganti baris biasa. */
const POLA_BR = /<\s*\/?\s*br\s*\/?\s*>|\r?\n/i;

/** Pecah teks SIPP menjadi baris bersih - tanda HTML lain dibuang, bukan dirender. */
function barisTeksSipp(teks) {
  return String(teks === null || teks === undefined ? "" : teks)
    .split(new RegExp(POLA_BR.source, "gi"))
    .map((x) => cleanText(String(x).replace(/<[^>]*>/g, " ")))
    .filter(Boolean);
}

/** "Hakim Ketua", "Hakim Anggota 2", "Hakim Tunggal" - sebutan yang dikenali pada borang. */
const POLA_KEDUDUKAN_BORANG = /^\s*(hakim\s+ketua|ketua\s+majelis|hakim\s+tunggal|hakim\s+anggota(?:\s+(\d+))?)\s*:\s*(.*)$/i;
/** Sebutan umum tanpa kedudukan per orang - dibuang, kedudukannya tidak ditebak. */
const POLA_AWALAN_UMUM = /^\s*(majelis\s+hakim|majelis|hakim)\s*:\s*(.*)$/i;
const POLA_AWALAN_PANITERA = /^\s*(panitera\s+pengganti|panitera\s+sidang|panitera)\s*:\s*/i;
const POLA_AWALAN_JURUSITA = /^\s*(juru\s*sita\s+pengganti|juru\s*sita)\s*:\s*/i;

function kedudukanBorang(sebutan, nomor) {
  const s = sebutan.toLowerCase().replace(/\s+/g, " ");
  if (s === "hakim ketua" || s === "ketua majelis") return "Hakim Ketua";
  if (s === "hakim tunggal") return "Hakim Tunggal";
  return nomor ? `Hakim Anggota ${Number(nomor)}` : "Hakim Anggota";
}

/** Daftar id ber-koma "9,1,6" menjadi larik; bagian yang bukan id menjadi null. */
function daftarIdBorang(nilai) {
  const teks = String(nilai === null || nilai === undefined ? "" : nilai).trim();
  if (!teks) return [];
  return teks.split(",").map((x) => idOrang(String(x).trim()));
}

/**
 * Majelis dari borang ikrar. Id dipasangkan dengan nama MENURUT POSISI -
 * urutan yang sama yang dipakai SIPP merangkai keduanya - dan HANYA bila
 * jumlahnya sama; bila berbeda, id dibuang (nama tetap tampil sebagai teks),
 * sebab memasangkan id ke nama yang salah membuka rekap orang lain.
 * Kedudukan diambil dari sebutan pada barisnya; tanpa sebutan: "Hakim".
 */
function uraiMajelisBorang(teks, ids) {
  const baris = barisTeksSipp(teks);
  const orang = [];
  for (const satu of baris) {
    const cocok = POLA_KEDUDUKAN_BORANG.exec(satu);
    if (cocok) {
      const nama = cleanText(cocok[3]);
      if (nama) orang.push({ kedudukan: kedudukanBorang(cocok[1], cocok[2]), nama });
      continue;
    }
    const umum = POLA_AWALAN_UMUM.exec(satu);
    const nama = cleanText(umum ? umum[2] : satu);
    if (nama) orang.push({ kedudukan: "Hakim", nama });
  }
  const daftarId = daftarIdBorang(ids);
  const pasang = daftarId.length === orang.length;
  return orang.map((x, i) => ({
    kedudukan: x.kedudukan,
    nama: x.nama,
    hakimId: pasang ? daftarId[i] : null,
    urutan: i + 1,
    tahapanId: TAHAPAN_IKRAR,
    kode: "",
  }));
}

/**
 * Panitera atau juru sita dari borang: sebutan di depan nama dibuang. Id
 * dipasangkan menurut posisi hanya bila jumlahnya sama dengan jumlah nama -
 * aturan yang sama dengan majelis (di sipp_donggala selalu satu nama, tetapi
 * SIPP satker lain tidak dijamin). Id tanpa nama dilewati: layar tidak
 * menampilkan angka sebagai nama orang.
 */
function uraiPetugasBorang(teks, id, pola, kunciId) {
  const nama = barisTeksSipp(teks)
    .map((x) => cleanText(x.replace(pola, "")))
    .filter(Boolean);
  const daftarId = daftarIdBorang(id);
  const pasang = daftarId.length === nama.length;
  return nama.map((n, i) => ({ nama: n, [kunciId]: pasang ? daftarId[i] : null, tahapanId: TAHAPAN_IKRAR, kode: "" }));
}

/**
 * Isi borang ikrar satu perkara, atau null bila borangnya kosong.
 *
 * @param b { majelisId, majelisTeks, paniteraId, paniteraTeks, jurusitaId,
 *   jurusitaTeks } - satu baris perkara_ikrar_talak.
 */
function uraiBorangIkrar(b) {
  if (!b) return null;
  const hakim = uraiMajelisBorang(b.majelisTeks, b.majelisId);
  const panitera = uraiPetugasBorang(b.paniteraTeks, b.paniteraId, POLA_AWALAN_PANITERA, "paniteraId");
  const jurusita = uraiPetugasBorang(b.jurusitaTeks, b.jurusitaId, POLA_AWALAN_JURUSITA, "jurusitaId");
  if (hakim.length + panitera.length + jurusita.length === 0) return null;
  return { hakim, panitera, jurusita };
}

/**
 * Majelis dan petugas ikrar talak yang DITAMPILKAN: per peran, penunjukan
 * aktif tahapan 18 bila ada, selainnya borang ikrar. Tiap orang membawa
 * `sumber` supaya layar dapat menyebut asal catatannya.
 *
 * Per peran, bukan sekaligus: pada 790 perkara hakim ikrarnya ada di tabel
 * penunjukan tetapi paniteranya hanya di borang - memilih satu sumber untuk
 * seluruh blok membuang salah satunya.
 *
 * @param entri satu nilai Map penunjukanPerkaraBanyak.
 * @returns { hakim, panitera, jurusita } atau null bila keduanya kosong.
 */
function ikrarLengkap(entri) {
  const ikrar = entri && entri.ikrar ? entri.ikrar : null;
  const borang = entri && entri.penetapanIkrar ? entri.penetapanIkrar : null;
  if (!ikrar && !borang) return null;
  const pilih = (peran) => {
    const dariPenunjukan = ikrar && Array.isArray(ikrar[peran]) ? ikrar[peran] : [];
    if (dariPenunjukan.length > 0) return dariPenunjukan.map((x) => ({ ...x, sumber: "penunjukan" }));
    const dariBorang = borang && Array.isArray(borang[peran]) ? borang[peran] : [];
    return dariBorang.map((x) => ({ ...x, sumber: "penetapanIkrar" }));
  };
  const hasil = { hakim: pilih("hakim"), panitera: pilih("panitera"), jurusita: pilih("jurusita") };
  return hasil.hakim.length + hasil.panitera.length + hasil.jurusita.length > 0 ? hasil : null;
}

/**
 * Susunan satu perkara dari SELURUH baris penunjukannya. Murni - dipakai
 * penunjukanPerkaraBanyak dan diuji langsung tanpa basis data.
 *
 * @param baris { hakim: [...], panitera: [...], jurusita: [...] } baris
 *   penunjukan SATU perkara per tabel.
 * @param putus tanggal putusan (yyyy-mm-dd), kosong/null bila belum putus.
 * @param borang baris borang ikrar perkara itu (lihat uraiBorangIkrar), atau
 *   null bila tidak ada.
 */
function susunPenunjukanPerkara(baris, putus, borang = null) {
  const hakim = Array.isArray(baris && baris.hakim) ? baris.hakim : [];
  const panitera = Array.isArray(baris && baris.panitera) ? baris.panitera : [];
  const jurusita = Array.isArray(baris && baris.jurusita) ? baris.jurusita : [];
  const tanggalPutusan = tanggalSah(putus) || null;

  const pilihPemeriksa = (daftar) => {
    const ids = barisPemeriksa(daftar, tanggalPutusan || "");
    return daftar.filter((b) => ids.has(b.id));
  };

  const ikrarHakim = barisIkrar(hakim);
  const ikrarPanitera = barisIkrar(panitera);
  const ikrarJurusita = barisIkrar(jurusita);
  const adaIkrar = ikrarHakim.length + ikrarPanitera.length + ikrarJurusita.length > 0;

  return {
    tanggalPutusan,
    pemeriksa: {
      hakim: susunHakim(pilihPemeriksa(hakim)),
      panitera: susunPetugas(pilihPemeriksa(panitera), "paniteraId"),
      jurusita: susunPetugas(pilihPemeriksa(jurusita), "jurusitaId"),
    },
    ikrar: adaIkrar
      ? {
          hakim: susunHakim(ikrarHakim),
          panitera: susunPetugas(ikrarPanitera, "paniteraId"),
          jurusita: susunPetugas(ikrarJurusita, "jurusitaId"),
        }
      : null,
    penetapanIkrar: uraiBorangIkrar(borang),
  };
}

// ============================================================================
// PEMBACAAN SIPP
// ============================================================================

/**
 * Id perkara yang sah dan unik, menurut urutan kemunculan pertamanya.
 * "12abc", "1.5", "-3", dan "0" dilewati, bukan dibaca sebagian.
 */
function idPerkaraSah(perkaraIds) {
  const lihat = new Set();
  const keluar = [];
  for (const nilai of Array.isArray(perkaraIds) ? perkaraIds : []) {
    const teks = String(nilai === null || nilai === undefined ? "" : nilai).trim();
    if (!/^[1-9]\d{0,19}$/.test(teks)) continue;
    if (lihat.has(teks)) continue;
    lihat.add(teks);
    keluar.push(teks);
  }
  return keluar;
}

/**
 * Kolom borang ikrar yang ada pada SIPP ini, dari daftar calon yang tetap.
 *
 * null bila tabelnya tidak ada (SIPP peradilan umum) atau tidak satu pun
 * kolom id-nya dikenali - borang lalu tidak dibaca, dan penetapanIkrar null.
 * Nama kolom yang kembali selalu salah satu calon di bawah, jadi aman
 * disisipkan ke teks kueri.
 */
async function kolomBorangIkrar() {
  if (!(await sippSkemaService.tabelAda("perkara_ikrar_talak"))) return null;
  const pilih = (calon) => sippSkemaService.pilihKolom("perkara_ikrar_talak", calon);
  const [majelisId, majelisTeks, paniteraId, paniteraTeks, jurusitaId, jurusitaTeks] = await Promise.all([
    pilih(["majelis_hakim_id"]),
    pilih(["majelis_hakim_text", "majelis_hakim_nama"]),
    pilih(["panitera_pengganti_id"]),
    pilih(["panitera_pengganti_text", "panitera_pengganti_nama"]),
    pilih(["jurusita_id"]),
    pilih(["jurusita_text", "jurusita_nama"]),
  ]);
  if (!majelisTeks && !paniteraTeks && !jurusitaTeks) return null;
  return { majelisId, majelisTeks, paniteraId, paniteraTeks, jurusitaId, jurusitaTeks };
}

/** Borang ikrar untuk satu potongan id, atau [] bila SIPP ini tidak memilikinya. */
async function bacaBorangIkrar(potong, isian) {
  const kolom = await kolomBorangIkrar();
  if (!kolom) return [];
  const pilih = (nama, alias) => (nama ? `t.${nama} AS ${alias}` : `NULL AS ${alias}`);
  return runQuery(
    `SELECT t.perkara_id AS perkaraId,
            ${pilih(kolom.majelisId, "majelisId")}, ${pilih(kolom.majelisTeks, "majelisTeks")},
            ${pilih(kolom.paniteraId, "paniteraId")}, ${pilih(kolom.paniteraTeks, "paniteraTeks")},
            ${pilih(kolom.jurusitaId, "jurusitaId")}, ${pilih(kolom.jurusitaTeks, "jurusitaTeks")}
       FROM perkara_ikrar_talak t
      WHERE t.perkara_id IN (${isian})`,
    potong
  );
}

/**
 * Seluruh baris penunjukan, tanggal putusan, dan borang ikrar untuk satu
 * potongan id.
 *
 * SELURUH baris, bukan hanya yang aktif: pemeriksa baru dapat ditentukan
 * dengan melihat siapa yang menjabat tiap kursi pada hari putusan. Putusan
 * terakhir menang bila kunci (perkara_id, tanggal_putusan) menyimpan dua
 * baris - sama dengan rekap petugas.
 */
async function bacaPotongan(potong) {
  const isian = potong.map(() => "?").join(", ");
  const [hakim, panitera, jurusita, putusan, borang] = await Promise.all([
    runQuery(
      `SELECT h.perkara_id AS perkaraId, h.tahapan_id AS tahapan, h.urutan AS urutan, h.hakim_id AS orang,
              h.hakim_nama AS nama, h.hakim_kode AS kode, h.jabatan_hakim_id AS jabatan,
              h.jabatan_hakim_nama AS jabatanNama, h.aktif AS aktif,
              DATE_FORMAT(h.tanggal_tidak_aktif, '%Y-%m-%d') AS tidakAktif,
              DATE_FORMAT(h.tanggal_penetapan, '%Y-%m-%d') AS penetapan, h.id AS id
         FROM perkara_hakim_pn h
        WHERE h.perkara_id IN (${isian})`,
      potong
    ),
    runQuery(
      `SELECT h.perkara_id AS perkaraId, h.tahapan_id AS tahapan, h.urutan AS urutan, h.panitera_id AS orang,
              h.panitera_nama AS nama, h.panitera_kode AS kode, NULL AS jabatan, h.aktif AS aktif,
              DATE_FORMAT(h.tanggal_tidak_aktif, '%Y-%m-%d') AS tidakAktif,
              DATE_FORMAT(h.tanggal_penetapan, '%Y-%m-%d') AS penetapan, h.id AS id
         FROM perkara_panitera_pn h
        WHERE h.perkara_id IN (${isian})`,
      potong
    ),
    runQuery(
      `SELECT h.perkara_id AS perkaraId, h.tahapan_id AS tahapan, h.urutan AS urutan, h.jurusita_id AS orang,
              h.jurusita_nama AS nama, h.jurusita_kode AS kode, NULL AS jabatan, h.aktif AS aktif,
              DATE_FORMAT(h.tanggal_tidak_aktif, '%Y-%m-%d') AS tidakAktif,
              DATE_FORMAT(h.tanggal_penetapan, '%Y-%m-%d') AS penetapan, h.id AS id
         FROM perkara_jurusita h
        WHERE h.perkara_id IN (${isian})`,
      potong
    ),
    runQuery(
      `SELECT pu.perkara_id AS perkaraId, DATE_FORMAT(MAX(pu.tanggal_putusan), '%Y-%m-%d') AS putus
         FROM perkara_putusan pu
        WHERE pu.perkara_id IN (${isian})
        GROUP BY pu.perkara_id`,
      potong
    ),
    bacaBorangIkrar(potong, isian),
  ]);
  return { hakim, panitera, jurusita, putusan, borang };
}

function kelompokkanPerPerkara(baris) {
  const himpun = new Map();
  for (const b of Array.isArray(baris) ? baris : []) {
    const kunci = String(b.perkaraId);
    if (!himpun.has(kunci)) himpun.set(kunci, []);
    himpun.get(kunci).push(b);
  }
  return himpun;
}

/**
 * Majelis pemeriksa dan majelis ikrar talak untuk banyak perkara sekaligus.
 * Lihat "API BAKU" di kepala berkas.
 *
 * @param perkaraIds daftar perkara_id (angka atau teks).
 * @returns Promise<Map<string, {...}>>
 */
async function penunjukanPerkaraBanyak(perkaraIds) {
  const daftar = idPerkaraSah(perkaraIds);
  const hasil = new Map();
  for (let i = 0; i < daftar.length; i += POTONGAN_IN) {
    const potong = daftar.slice(i, i + POTONGAN_IN);
    const baca = await bacaPotongan(potong);
    const hakim = kelompokkanPerPerkara(baca.hakim);
    const panitera = kelompokkanPerPerkara(baca.panitera);
    const jurusita = kelompokkanPerPerkara(baca.jurusita);
    const putus = new Map(baca.putusan.map((r) => [String(r.perkaraId), r.putus]));
    // perkara_id kunci utama perkara_ikrar_talak pada SIPP 6.x - satu borang
    // per perkara.
    const borang = new Map(baca.borang.map((r) => [String(r.perkaraId), r]));
    for (const id of potong) {
      hasil.set(
        id,
        susunPenunjukanPerkara(
          { hakim: hakim.get(id) || [], panitera: panitera.get(id) || [], jurusita: jurusita.get(id) || [] },
          putus.get(id) || null,
          borang.get(id) || null
        )
      );
    }
  }
  return hasil;
}

module.exports = {
  TAHAPAN_PEMERIKSAAN,
  TAHAPAN_IKRAR,
  POTONGAN_IN,
  // Aturan murni - dipakai rekapPetugasService untuk kedudukan seseorang.
  barisAktif,
  tanggalSah,
  barisBertanggal,
  menjabatPadaPutusan,
  lebihAkhirDitetapkan,
  lebihAkhir,
  terakhirTiapKursi,
  barisPemeriksa,
  barisIkrar,
  // Susunan satu perkara dan borang ikrar, murni.
  susunPenunjukanPerkara,
  uraiBorangIkrar,
  barisTeksSipp,
  ikrarLengkap,
  idPerkaraSah,
  // API baku.
  penunjukanPerkaraBanyak,
  // Pembaca borang ikrar satu potongan id (kolom dipilih kolomBorangIkrar).
  // Dipakai rekapPetugasService, yang hanya membutuhkan borang dan SATU tabel
  // penunjukan: penunjukanPerkaraBanyak membaca ketiga tabel dan putusan untuk
  // tiap perkara - terukur +1,0 detik pada rekap juru sita 22 (154 perkara).
  bacaBorangIkrar,
};
