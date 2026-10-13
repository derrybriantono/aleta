"use strict";

/**
 * ============================================================================
 * KASIR - JURNAL KEUANGAN PERKARA DARI JADWAL SIDANG (6 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: "buatkan tombol baru kasir yaitu mode menginput pada
 * jurnal perkara (nanti keluar pop up) yaitu otomatis mengisi uraiannya serta
 * komponen tabel lainnya secara otomatis melihat tiap keadaan perkara, coba
 * kamu pelajari kebiasaannya".
 *
 * Berkas ini memuat tiga hal:
 *
 *   1. bacaKeadaan  - membaca perkara, jurnal (perkara_biaya tahapan 10),
 *                     para pihak, jadwal sidang, relaas, putusan, pemberitahuan
 *                     putusan, ikrar talak. Hanya SELECT.
 *   2. susunUsulan  - fungsi MURNI: membandingkan keadaan perkara dengan jurnal
 *                     yang sudah ada, lalu mengusulkan baris yang BELUM ada.
 *   3. susunRencana / jalankanRencana - menulis baris jurnal PERSIS seperti
 *                     blangko "Tambah" Buku Jurnal Keuangan Perkara SIPP.
 *
 * ============================================================================
 * KEBIASAAN KASIR YANG DIUKUR (sipp_donggala, perkara didaftar 2026, ditambah
 * pembacaan baca-saja peladen untuk 580/Pdt.G/2026/PA.Dgl)
 * ============================================================================
 *
 * Baris "Tambah" (urutan 0) 5.682 baris, 5.681 di antaranya oleh akun kasir:
 *
 *   panggilan pertama (sidang urutan 1) - 458 kali berurutan 236 > 14 > 237
 *     PNBP Relaas Panggilan Pertama Kepada Penggugat   10.000  pihak 1 (461x)
 *       ("...Kepada Pemohon" pada cerai talak, 69x)
 *     Biaya Panggilan Tergugat/<nomor resi Pos>          tarif  pihak 2 (986x)
 *       ("Termohon/" 126x, "Turut Tergugat/" 21x, "/RRI" 200.000 56x)
 *     PNBP Relaas Panggilan Pertama Kepada Tergugat     10.000  pihak 2 (458x)
 *   Pdt.P: PNBP Relaas Panggilan Pertama Pemohon I / II (253, satu per pemohon)
 *   Penggugat dipanggil ELEKTRONIK (relaas E 504/519) - PNBP saja, tanpa biaya
 *   panggilan (jenis 12 hanya 1 baris di 2026). Tergugat surat tercatat (S):
 *   PNBP + biaya, 521/531. RRI (R): 17-18/18.
 *
 *   panggilan ulang Tergugat - mengikuti kehadiran sidang SEBELUMNYA
 *     dihadiri_oleh 2 (pihak pertama saja)  330/355 dipanggil ulang
 *     dihadiri_oleh 4 (tidak ada)            41/43
 *     dihadiri_oleh 1 (semua pihak)           6/40  - tidak dipanggil
 *   PNBP relaas hanya sekali (yang PERTAMA); panggilan berikutnya biaya saja.
 *   Sidang ikrar talak (perkara_jadwal_sidang.ikrar_talak = 'Y'):
 *     "Biaya Panggilan Ikrar Talak/<resi>" untuk Termohon.
 *
 *   hari putusan - tanggal transaksi = tanggal putusan (656/669)
 *     157 Redaksi 10.000 > 152 Meterai 10.000 > [404 PNBP Surat Permohonan
 *     Pencabutan Perkara bila dicabut] > [260 PNBP Relaas Pemberitahuan
 *     Putusan Kepada Penggugat bila Penggugat tidak hadir] > [29 Biaya
 *     Pemberitahuan/<resi|P> + 389 PNBP Relaas Pemberitahuan Putusan Kepada
 *     Tergugat bila verstek (337/362)] > 151 Pengembalian Sisa Panjar.
 *   Sisa panjar SELALU baris terakhir dan SELALU menghabiskan saldo (647/647
 *   berakhir tepat nol); tanggalnya tanggal putusan (588/647), pada cerai talak
 *   dikabulkan tanggal ikrar talak (137/140).
 *
 *   tarif panggilan/pemberitahuan: pihak yang sama, tarif yang sama (459/472);
 *   pihak baru - tarif terbanyak di kecamatannya (tepat 502/508 diuji atas
 *   2026 dengan kecamatan 2025). Donggala 14.500, Sigi & Palu 29.500.
 *   Tarif yang tidak diketahui TIDAK diisi nol - barisnya meminta jumlah.
 *
 *   uraian = nama jenis biaya yang dirapikan kasir (".../Pelawan/Pembantah"
 *   dibuang), pihak = pihak 1 kecuali panggilan/pemberitahuan pihak 2,
 *   keterangan = '' (5.682/5.682), juru sita = juru sita AKTIF pertama perkara
 *   (1.644/1.644) hanya pada kategori 4/5/6, tanggal transaksi = hari diketik
 *   pada 5.636/5.684 - tetapi untuk peristiwa yang sudah lewat, usulan memakai
 *   tanggal peristiwanya (putusan, ikrar, penyerahan surat ke Pos).
 *
 * ============================================================================
 * BENTUK TULISANNYA DIBACA DARI KODE SIPP
 * ============================================================================
 *
 * controllers/detil_biaya.php validateInput() + models/biaya_perkara/
 * biaya_perkara_m.php add_perkara_biaya(), set_jurusita(), add_audittrail():
 *
 *   perkara_biaya         id = MAX(id)+1 (bukan auto_increment), urutan 0,
 *                         sisa 0 (saldo dihitung layar, bukan disimpan),
 *                         general_id 0, diinput_tanggal date("Y-m-d H:i:s")
 *                         - 24 jam sejak 31 Jul 2026 (sebelumnya 12 jam)
 *   sys_audittrail        formname 'Add Mediasi' (memang begitu di SIPP),
 *                         judul "Tambah Data Biaya <br />Tambah table
 *                         <b>Perkara_Biaya</b> dari halaman <b>Tambah Biaya</b>
 *                         dengan Primary Key [ID=..]", detik sama dengan
 *                         diinput_tanggal (terukur 6.422 baris)
 *   perkara_biaya_jurusita  DELETE lalu REPLACE bila kategori 4/5/6 - tanpa audit
 *
 * Atas akun SIPP PETUGAS yang menekan (bukan pejabat perkara), jam NOW()
 * basis data SESUDAH jeda manusia, tanpa satu kata pun tentang ALETA di SIPP;
 * jejak jujur ditulis rute ke aleta_bot_jejak_penetapan (jenis kasir-jurnal).
 *
 * Kering sebagai bawaan: jalankanRencana tidak menulis apa pun kecuali
 * { kering: false } disebut tegas. Daftar putih tabel sendiri.
 */

const DAFTAR_TABEL_KASIR = new Set(["perkara_biaya", "perkara_biaya_jurusita", "sys_audittrail"]);

/** formname yang ditulis add_audittrail() biaya_perkara_m - ditiru apa adanya. */
const NAMA_BORANG_AUDIT = "Add Mediasi";

/** Tahapan tingkat pertama - satu-satunya yang dilayani tombol ini. */
const TAHAPAN = 10;

const JB = Object.freeze({
  PANJAR: 1,
  PANGGIL_PENGGUGAT: 12,
  PANGGIL_PEMOHON: 13,
  PANGGIL_TERGUGAT: 14,
  PANGGIL_TERMOHON: 15,
  PEMBERITAHUAN: 29,
  SISA: 151,
  METERAI: 152,
  REDAKSI: 157,
  PNBP_PERTAMA_P: 236,
  PNBP_PERTAMA_T: 237,
  PNBP_PERTAMA_PEMOHON: 253,
  PNBP_PBT_P: 260,
  PNBP_PERTAMA_TERMOHON: 388,
  PNBP_PBT_T: 389,
  PNBP_CABUT: 404,
});

/* === K-KEJADIAN 11 Okt === */
const JB_TAMBAH_PANJAR = 224;
const TAMBAH_PANJAR_MINIMUM = 10000;
const JB_PANGGIL_MEDIASI = 381;
/* === AKHIR K-KEJADIAN === */
/** Kasir otomatis 13 Okt: jenis hari putus yang sekali PER PIHAK (pemberitahuan), bukan sekali per perkara. */
const JENIS_PER_PIHAK_OTOMATIS = new Set([29, 389]);
const JENIS_PANGGILAN = new Set([12, 13, 14, 15]);
const JENIS_PNBP_PERTAMA = new Set([236, 237, 253, 388]);
const KATEGORI_JURUSITA = new Set([4, 5, 6]);
const STATUS_CABUT = new Set([7, 67]);
const STATUS_DIKABULKAN = 62;
/** Digugurkan (65, 93) dan tidak dapat diterima (64): pemberitahuan kepada Penggugat yang tidak hadir. */
const STATUS_PBT_PENGGUGAT = new Set([64, 65, 93]);
/** Dikabulkan, ditolak, perdamaian - Tergugat tidak hadir pada sidang putusan (dihadiri_oleh 2). */
const STATUS_PBT_TERGUGAT_HADIR2 = new Set([62, 63, 85]);
const JENIS_CERAI_TALAK = 346;
/** jenis_perkara_id yang dikecualikan SIPP dari larangan Sabtu/Minggu. */
const JENIS_BEBAS_AKHIR_PEKAN = 746;
const ALUR_PERMOHONAN = 16;
const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** Cara panggilan pada relaas (ket_temu). */
const KET_BERBIAYA = new Set(["S", "P", "M", "Y", "T"]);
const KET_TANPA_BIAYA = new Set(["E", "W", "N"]);

const PESAN = {
  melebihiHariIni: (hari) => `Tanggal Transaksi Tidak Boleh Melebihi Hari Ini. Hari ini Tanggal ${hari}`,
  sebelumDaftar: "Tanggal transaksi tidak boleh kurang dari tanggal pendaftaran",
  libur: "Tidak Dapat Memilih Tanggal Transaksi Dihari Libur, Sabtu dan Minggu.",
  melebihiPanjar: "Jumlah biaya melebihi sisa panjar, biaya tidak bisa disimpan",
  uraian: "Uraian wajib diisi.",
  jumlah: "Jumlah wajib diisi.",
  jenis: "Jenis Biaya wajib dipilih.",
  pihak: "Pihak yang membayar wajib dipilih.",
  jurusita: "Jurusita wajib dipilih.",
  tanggal: "Tanggal Transaksi wajib diisi (tgl/bln/tahun).",
};

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function angka(nilai) {
  const n = Number(nilai);
  return Number.isFinite(n) ? n : 0;
}

function tanggalSah(nilai) {
  const teks = bersih(nilai).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return "";
  const [t, b, h] = teks.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h));
  return d.getUTCFullYear() === t && d.getUTCMonth() === b - 1 && d.getUTCDate() === h ? teks : "";
}

function hariDalamPekan(iso) {
  const [t, b, h] = iso.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1, h)).getUTCDay();
}

function geserHari(iso, n) {
  const [t, b, h] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h + n));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function akhirPekan(iso) {
  const h = hariDalamPekan(iso);
  return h === 0 || h === 6;
}

function liburNasional(iso) {
  try {
    return Boolean(require("./hariLiburService").hariLibur(iso));
  } catch {
    return false;
  }
}

/**
 * Tanggal usulan yang lolos pagar blangko SIPP: tidak sebelum pendaftaran,
 * tidak sesudah hari ini, bukan Sabtu/Minggu. Akhir pekan MAJU ke Senin -
 * biaya tidak dibayar sebelum peristiwanya (surat diserahkan ke Pos hari
 * Sabtu dicatat kasir hari kerja berikutnya); mundur ke Jumat hanya bila
 * Senin itu belum tiba.
 */
function tanggalPatut(iso, { min, maks, bebasAkhirPekan = false }) {
  let t = tanggalSah(iso) || maks;
  if (min && t < min) t = min;
  if (maks && t > maks) t = maks;
  if (bebasAkhirPekan) return t;
  // Libur nasional (hariLiburService) ikut dilompati saat MAJU: kasir tidak
  // bekerja 17 Agustus - perkara 510/2026 dicatat 18 Agustus. SIPP sendiri
  // hanya menolak Sabtu/Minggu, jadi yang mundur cukup menghindari keduanya.
  let maju = t;
  for (let i = 0; i < 14 && (akhirPekan(maju) || liburNasional(maju)); i += 1) maju = geserHari(maju, 1);
  if (!maks || maju <= maks) return maju;
  let mundur = t;
  while (akhirPekan(mundur)) mundur = geserHari(mundur, -1);
  return !min || mundur >= min ? mundur : t;
}

/**
 * Teks yang aman untuk kolom latin1 SIPP. Tanda baca Unicode umum diganti
 * padanannya; huruf di luar latin1 dibuang (bukan menjadi '?' di SIPP).
 */
function teksLatin1(nilai, panjang = 500) {
  return bersih(nilai)
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "")
    .slice(0, panjang);
}

/** Sebutan para pihak - aturan bersama sebutanPihakService. */
function sebutanPerkara(perkara) {
  try {
    const { sebutanPihakPerkara } = require("./sebutanPihakService");
    const s = sebutanPihakPerkara({
      alurPerkaraId: perkara.alurPerkaraId,
      jenisPerkaraId: perkara.jenisPerkaraId,
      jenisPerkaraNama: perkara.jenisPerkaraNama,
      nomorPerkara: perkara.nomorPerkara,
    });
    return { satu: s.satu, dua: s.dua };
  } catch {
    return Number(perkara.alurPerkaraId) === ALUR_PERMOHONAN ? { satu: "Pemohon", dua: "Termohon" } : { satu: "Penggugat", dua: "Tergugat" };
  }
}

function sebutKe(ke, sebutan) {
  if (ke === 1) return sebutan.satu;
  if (ke === 2) return sebutan.dua;
  if (ke === 3) return "Intervensi";
  return `Turut ${sebutan.dua}`;
}

/** Akhiran nomor pihak bila sekedudukannya lebih dari satu: " I", " II", ... */
function akhiranUrut(i, n) {
  return n > 1 ? ` ${ROMAWI[i] || String(i + 1)}` : "";
}

/** Nilai terbanyak dari peta nilai -> hitungan. */
function terbanyak(peta) {
  let hasil = null;
  let n = 0;
  for (const [nilai, jumlah] of Object.entries(peta || {})) {
    if (jumlah > n) {
      hasil = Number(nilai);
      n = jumlah;
    }
  }
  return hasil;
}

/**
 * Jumlah terbanyak per kelompok dari baris {jumlah, n} - hanya bila jelas:
 * sekurangnya 3 contoh dan 60% sama. Kelompok yang ragu tidak diberi tarif
 * (barisnya meminta jumlah), bukan ditebak.
 */
function petaModal(baris, kunciDari) {
  const hitung = {};
  for (const b of baris || []) {
    const kunci = kunciDari(b);
    if (!kunci) continue;
    hitung[kunci] = hitung[kunci] || {};
    hitung[kunci][angka(b.jumlah)] = (hitung[kunci][angka(b.jumlah)] || 0) + (Number(b.n) || 0);
  }
  const hasil = {};
  for (const [nama, sebaran] of Object.entries(hitung)) {
    const total = Object.values(sebaran).reduce((s, x) => s + x, 0);
    const modal = terbanyak(sebaran);
    if (modal && total >= 3 && sebaran[modal] / total >= 0.6) hasil[nama] = modal;
  }
  return hasil;
}

/** Uraian panggilan/pemberitahuan yang bukan pos biasa - tarifnya tidak mewakili pihak. */
function uraianKhusus(uraian) {
  return /RRI|PEMDA|radio|iklan|pengumuman/i.test(bersih(uraian));
}

/**
 * ============================================================================
 * PUTUSAN YANG BARU TERBACA DARI HASIL SIDANG
 * ============================================================================
 *
 * Kasir mencatat biaya hari putusan PADA HARI SIDANG, sering sebelum panitera
 * pengganti menginput putusannya: di salinan sipp_donggala perkara 510, 508,
 * dan 471/2026 sudah ber-Redaksi, Meterai, dan Sisa Panjar tanggal 8-9 Sep,
 * sedangkan perkara_putusan-nya belum ada. Yang sudah ada hasil sidangnya -
 * perkara_jadwal_sidang.alasan_ditunda pada sidang yang tidak ditunda:
 *
 *   putus dikabulkan (verstek) 290   putus dikabulkan 73   putus dicabut 44
 *   telah ikrar talak 32   putus digugurkan 18   putus tidak diterima 11
 *
 * Karena itu, bila perkara_putusan kosong, putusannya dibaca dari sana.
 */
const STATUS_DARI_HASIL = [
  [/cabut/i, 67, "Dicabut"],
  [/gugur/i, 65, "Digugurkan"],
  [/tidak\s+(dapat\s+)?diterima/i, 64, "Tidak Dapat Diterima"],
  [/tolak/i, 63, "Ditolak"],
  [/coret/i, 66, "Dicoret dari Register"],
  [/damai/i, 85, "Perdamaian"],
  [/kabul/i, 62, "Dikabulkan"],
];

//
// Hasil "0" pada sidang TERAKHIR yang tidak ditunda pun putusan: 232 dari 232
// sidang begitu (2026) diputus pada hari itu - statusnya saja yang belum
// tertulis. Hasil kosong (NULL) TIDAK dibaca sebagai putusan: itulah bentuk
// sidang yang belum dikerjakan hari ini.
function putusanDariSidang(sidangBiasa, hariIni = "") {
  const akhir = (sidangBiasa || []).filter((s) => tanggalSah(s.tanggal)).slice(-1)[0];
  if (!akhir || akhir.ditunda) return null;
  const teks = bersih(akhir.hasil);
  if (!teks || (hariIni && akhir.tanggal > hariIni)) return null;
  const tanpaStatus = teks === "0";
  if (!tanpaStatus && !/^\s*putus\b/i.test(teks)) return null;
  const cocok = tanpaStatus ? null : STATUS_DARI_HASIL.find(([pola]) => pola.test(teks));
  return {
    tanggal: tanggalSah(akhir.tanggal),
    statusId: cocok ? cocok[1] : 0,
    statusNama: tanpaStatus ? "diputus (status belum tertulis)" : teks,
    verstek: tanpaStatus ? "" : /verstek/i.test(teks) ? "Y" : "T",
    dariSidang: true,
  };
}

function ikrarDariSidang(sidangIkrar) {
  const s = (sidangIkrar || []).find(
    (x) => !x.ditunda && tanggalSah(x.tanggal) && (/ikrar/i.test(bersih(x.hasil)) || bersih(x.hasil) === "0")
  );
  return s ? tanggalSah(s.tanggal) : "";
}

/**
 * ============================================================================
 * KEADAAN PERKARA UNTUK KASIR OTOMATIS (1.189.x, 10 Okt 2026)
 * ============================================================================
 *
 * Nama keadaan yang dilihat kasir di atas usulannya, dan daftar biaya yang
 * LAZIM pada keadaan itu. Daftar lazim diukur atas jurnal satker
 * (sipp_donggala, putusan Jul 2025 - Sep 2026, scripts/ukur-kasir-keadaan.js):
 * jenis biaya yang ditulis kasir pada hari putusan di sekurangnya separuh
 * perkara berkeadaan itu. Mesin usulan (susunUsulan) yang menentukan baris
 * sesungguhnya - daftar ini penjelasannya, bukan aturannya.
 */
const KEADAAN_KASIR = Object.freeze({
  baru: { nama: "Baru didaftar - menunggu panggilan sidang pertama", lazim: ["PNBP Relaas Panggilan Pertama Penggugat/Pemohon", "Biaya Panggilan Tergugat/Termohon", "PNBP Relaas Panggilan Pertama Tergugat/Termohon"] },
  persidangan: { nama: "Dalam persidangan", lazim: ["Biaya Panggilan ulang pihak yang tidak hadir"] },
  verstek: { nama: "Putus verstek", lazim: ["Redaksi", "Meterai", "Biaya Pemberitahuan", "PNBP Relaas Pemberitahuan Putusan Kepada Tergugat", "Pengembalian Sisa Panjar"] },
  contradictoir: { nama: "Putus contradictoir (dikabulkan)", lazim: ["Redaksi", "Meterai", "Pengembalian Sisa Panjar"] },
  cabut: { nama: "Dicabut", lazim: ["Redaksi", "Meterai", "PNBP Surat Permohonan Pencabutan Perkara", "Pengembalian Sisa Panjar"] },
  gugur: { nama: "Digugurkan", lazim: ["Redaksi", "Meterai", "PNBP Relaas Pemberitahuan Putusan Kepada Penggugat", "Pengembalian Sisa Panjar"] },
  damai: { nama: "Perdamaian", lazim: ["Redaksi", "Meterai", "Pengembalian Sisa Panjar"] },
  tolak: { nama: "Ditolak", lazim: ["Redaksi", "Meterai", "Pengembalian Sisa Panjar"] },
  "tidak-diterima": { nama: "Tidak dapat diterima", lazim: ["Redaksi", "Meterai", "Pengembalian Sisa Panjar"] },
  coret: { nama: "Dicoret dari register", lazim: ["Redaksi", "Meterai", "Pengembalian Sisa Panjar"] },
  permohonan: { nama: "Permohonan dikabulkan", lazim: ["Redaksi", "Meterai", "Pengembalian Sisa Panjar"] },
  "menunggu-ikrar": { nama: "Cerai talak dikabulkan - menunggu ikrar talak", lazim: ["Redaksi", "Meterai", "Biaya Pemberitahuan bila verstek", "PNBP Relaas Pemberitahuan Putusan Kepada Termohon bila verstek"] },
  ikrar: { nama: "Ikrar talak sudah diucapkan", lazim: ["Biaya Panggilan Ikrar Talak", "Pengembalian Sisa Panjar (tanggal ikrar)"] },
  putus: { nama: "Diputus (status putusan belum tertulis)", lazim: ["Redaksi", "Meterai", "Pengembalian Sisa Panjar"] },
  prodeo: { nama: "Prodeo - jurnal diisi di SIPP", lazim: [] },
});

/**
 * Keadaan perkara untuk Kasir - fungsi MURNI atas bentuk bacaKeadaan.
 * Putusan dibaca dari perkara_putusan, atau dari hasil sidang bila belum
 * diinput (aturan yang sama dengan mesin usulan).
 */
function keadaanPerkara(k) {
  const perkara = (k && k.perkara) || {};
  const pilih = (kunci) => ({ kunci, nama: KEADAAN_KASIR[kunci].nama, lazim: KEADAAN_KASIR[kunci].lazim.slice() });
  if (Number((k && k.pembiayaan) || 1) !== 1) return pilih("prodeo");
  const sidang = (Array.isArray(k && k.sidang) ? k.sidang : [])
    .slice()
    .sort((a, b) => angka(a.urutan) - angka(b.urutan) || bersih(a.tanggal).localeCompare(bersih(b.tanggal)));
  const sidangBiasa = sidang.filter((s) => !s.ikrar);
  const putusan = k && k.putusan && tanggalSah(k.putusan.tanggal) ? k.putusan : putusanDariSidang(sidangBiasa, tanggalSah(k && k.hariIni));
  if (!putusan) return sidangBiasa.length > 1 || (sidangBiasa[0] && sidangBiasa[0].dihadiriOleh !== null && sidangBiasa[0].dihadiriOleh !== undefined) ? pilih("persidangan") : pilih("baru");
  const statusId = Number(putusan.statusId) || 0;
  if (STATUS_CABUT.has(statusId) || /cabut/i.test(bersih(putusan.statusNama))) return pilih("cabut");
  if (statusId === 65 || statusId === 93 || /gugur/i.test(bersih(putusan.statusNama))) return pilih("gugur");
  if (statusId === 85 || /damai/i.test(bersih(putusan.statusNama))) return pilih("damai");
  if (statusId === 63) return pilih("tolak");
  if (statusId === 64) return pilih("tidak-diterima");
  if (statusId === 66) return pilih("coret");
  if (!statusId && putusan.dariSidang) return pilih("putus");
  if (Number(perkara.alurPerkaraId) === ALUR_PERMOHONAN) return pilih("permohonan");
  if (Number(perkara.jenisPerkaraId) === JENIS_CERAI_TALAK && statusId === STATUS_DIKABULKAN) {
    const tIkrar = (k.ikrar && tanggalSah(k.ikrar.tanggal)) || ikrarDariSidang(sidang.filter((s) => s.ikrar));
    return pilih(tIkrar ? "ikrar" : "menunggu-ikrar");
  }
  if (bersih(putusan.verstek).toUpperCase() === "Y") return pilih("verstek");
  return pilih("contradictoir");
}

/**
 * Nomor resi Pos dari kolom no_resi_pos - atau "" bila isinya bukan resi.
 * Juru sita kadang mengisi kolom itu dengan keterangan penerima ("diterima
 * oleh ... aparat kelurahan", nama orang); ditemukan pada uji balik 200
 * perkara. Teks begitu tidak pantas menjadi uraian jurnal.
 */
function resiPos(nilai) {
  const t = bersih(nilai).replace(/\s+/g, "");
  return /^[A-Z]{0,4}\d{8,20}[A-Z]{0,3}$/i.test(t) ? t : "";
}

/** Hari kerja sesudah tanggal itu (Sabtu/Minggu dilompati). */
function hariKerjaBerikut(iso) {
  if (!tanggalSah(iso)) return "";
  let t = geserHari(iso, 1);
  while (akhirPekan(t)) t = geserHari(t, 1);
  return t;
}

/**
 * ============================================================================
 * MESIN USULAN - FUNGSI MURNI
 * ============================================================================
 *
 * @param {object} k keadaan perkara (bentuk bacaKeadaan)
 * @returns {{ usulan: object[], catatan: string[], saldo: number, saldoAkhir: number }}
 */
function susunUsulan(k) {
  const catatan = [];
  const perkara = k.perkara || {};
  const hariIni = tanggalSah(k.hariIni);
  const tanggalDaftar = tanggalSah(perkara.tanggalDaftar);
  const alur = Number(perkara.alurPerkaraId) || 0;
  const permohonan = alur === ALUR_PERMOHONAN;
  const sebutan = sebutanPerkara(perkara);
  const jurnal = Array.isArray(k.jurnal) ? k.jurnal : [];
  const jenisBiaya = k.jenisBiaya || {};
  const tarif = k.tarif || {};
  const bebasAkhirPekan = Number(perkara.jenisPerkaraId) === JENIS_BEBAS_AKHIR_PEKAN;
  const patut = (iso) => tanggalPatut(iso, { min: tanggalDaftar, maks: hariIni, bebasAkhirPekan });

  const saldo = jurnal.reduce((s, b) => s + angka(b.jenisTransaksi) * angka(b.jumlah), 0);

  if (Number(k.pembiayaan || 1) !== 1) {
    catatan.push("Perkara prodeo - jurnalnya diisi di SIPP; ALETA tidak menyusun usulan untuk biaya prodeo.");
    return { usulan: [], catatan, saldo, saldoAkhir: saldo };
  }
  if (!jurnal.some((b) => angka(b.jenisTransaksi) === 1)) {
    catatan.push("Belum ada Panjar Biaya Perkara di jurnal - panjar dicatat kasir saat pendaftaran, bukan dari sini.");
  }

  const pihak = (Array.isArray(k.pihak) ? k.pihak : [])
    .filter((p) => Number(p.pihakId) > 0)
    .sort((a, b) => a.ke - b.ke || angka(a.urutan) - angka(b.urutan) || angka(a.id) - angka(b.id));
  const pihakKe = (ke) => pihak.filter((p) => p.ke === ke);
  const pembayar = pihakKe(1)[0] || null;
  const jurusita = (Array.isArray(k.jurusita) ? k.jurusita : [])[0] || null;
  const sidangSemua = (Array.isArray(k.sidang) ? k.sidang : []).slice().sort((a, b) => angka(a.urutan) - angka(b.urutan) || bersih(a.tanggal).localeCompare(bersih(b.tanggal)));
  const sidangBiasa = sidangSemua.filter((s) => !s.ikrar);
  const sidangIkrar = sidangSemua.filter((s) => s.ikrar);
  const relaas = Array.isArray(k.relaas) ? k.relaas : [];

  const lazim = (jb) => {
    const dariRiwayat = tarif.lazim && Number(tarif.lazim[jb]) > 0 ? Number(tarif.lazim[jb]) : 0;
    if (dariRiwayat) return dariRiwayat;
    const bawaan = jenisBiaya[jb] ? Number(jenisBiaya[jb].jumlahBawaan) : 0;
    return bawaan > 0 ? bawaan : null;
  };

  /** Tarif pos untuk satu pihak: pihak itu sendiri > kecamatan > kabupaten. */
  const tarifPihak = (p) => {
    const sendiri = {};
    for (const b of jurnal) {
      if (Number(b.pihakId) !== Number(p.pihakId)) continue;
      if (!JENIS_PANGGILAN.has(Number(b.jenisBiayaId)) && Number(b.jenisBiayaId) !== JB.PEMBERITAHUAN) continue;
      if (uraianKhusus(b.uraian) || !(angka(b.jumlah) > 0)) continue;
      sendiri[angka(b.jumlah)] = (sendiri[angka(b.jumlah)] || 0) + 1;
    }
    const n = terbanyak(sendiri);
    if (n) return { jumlah: n, asal: "tarif panggilan pihak ini sebelumnya" };
    const kec = tarif.kecamatan && p.kecamatan ? Number(tarif.kecamatan[p.kecamatan]) : 0;
    if (kec > 0) return { jumlah: kec, asal: "tarif terbanyak di kecamatan pihak" };
    const kab = tarif.kabupaten && p.kabupaten ? Number(tarif.kabupaten[p.kabupaten]) : 0;
    // Kabupaten hanya perkiraan: uji balik 388/2026 - kabupaten 14.500,
    // pihaknya 29.500. Keyakinan barisnya diturunkan.
    if (kab > 0) return { jumlah: kab, asal: "tarif terbanyak di kabupaten pihak (perkiraan - periksa)", kira: true };
    return { jumlah: null, asal: "tarif belum diketahui - isi jumlahnya" };
  };

  const usulan = [];
  let nomor = 0;
  const tambah = (u) => {
    nomor += 1;
    const jb = jenisBiaya[u.jenisBiayaId] || {};
    usulan.push({
      kunci: `u${nomor}`,
      jenisBiayaId: u.jenisBiayaId,
      kategoriId: Number(jb.kategoriId) || u.kategoriId || 0,
      jenisTransaksi: Number(jb.jenisTransaksi) || -1,
      pihakKe: u.pihakKe,
      pihakId: u.pihakId,
      uraian: teksLatin1(u.uraian),
      jumlah: u.jumlah === null || u.jumlah === undefined ? null : Number(u.jumlah),
      tanggal: patut(u.tanggal),
      keterangan: "",
      jurusitaId: KATEGORI_JURUSITA.has(Number(jb.kategoriId) || u.kategoriId || 0) && jurusita ? Number(jurusita.jurusitaId) : 0,
      peristiwa: u.peristiwa,
      dasar: u.dasar,
      yakin: u.yakin || "tinggi",
      pilih: u.pilih !== false,
      perluResi: Boolean(u.perluResi),
      sisaOtomatis: Boolean(u.sisaOtomatis),
      kelompok: u.kelompok,
      tersedia: Boolean(jenisBiaya[u.jenisBiayaId]),
      /* === K-KEJADIAN 11 Okt === kejadian perkara yang melahirkan baris ini (susunKejadian) */
      kejadian: u.kejadian || "lain",
      /* === AKHIR K-KEJADIAN === */
    });
  };

  // ==========================================================================
  // PEMBANDING DENGAN JURNAL YANG SUDAH ADA
  // ==========================================================================
  //
  // Baris yang sudah ada "dihabiskan" oleh peristiwa yang dicocokkannya:
  // lebih dahulu menurut pihak_id, sisanya menurut pihak_ke, sisanya lagi
  // menurut urutan. Satu baris lama tidak pernah menutup dua peristiwa.
  const terpakai = new Set();
  /* === K-KEJADIAN 11 Okt === baris jurnal lama -> kejadian yang ditutupnya */
  const tutup = new Map();
  /* === AKHIR K-KEJADIAN === */
  // Longgar: baris yang tidak menunjuk pihak LAIN sekedudukan. Kasir kadang
  // memilih pihak keliru (458/2026: Biaya Pemberitahuan atas nama Penggugat)
  // - baris itu tetap menutup peristiwanya, bukan memancing usulan ganda.
  const cariAda = (saring, p, kejadian) => {
    const calon = jurnal.filter((b) => !terpakai.has(b.id) && saring(b));
    const tepat = p ? calon.find((b) => Number(b.pihakId) === Number(p.pihakId)) : null;
    const lainSekedudukan = p ? new Set(pihak.filter((x) => x.ke === p.ke && x !== p).map((x) => Number(x.pihakId))) : new Set();
    const longgar = p ? calon.find((b) => !lainSekedudukan.has(Number(b.pihakId))) : calon[0];
    const hasil = tepat || longgar || null;
    if (hasil) terpakai.add(hasil.id);
    if (hasil && kejadian) tutup.set(hasil.id, kejadian);
    return hasil;
  };

  // ==========================================================================
  // 1. PANGGILAN
  // ==========================================================================
  const adaSidangPertama = sidangBiasa.length > 0;
  const peristiwaPanggil = new Map(); // pihakId -> [{sidang, relaas, ikrar, ...}]
  const kedudukanDipanggil = permohonan ? [] : [2, 4];

  /** Panggilan untuk satu deret sidang (biasa atau ikrar) bagi satu pihak. */
  const deretPanggilan = (p, deret, ikrar) => {
    const hasil = [];
    deret.forEach((s, i) => {
      const r = relaas.find((x) => Number(x.sidangId) === Number(s.id) && Number(x.pihakId) === Number(p.pihakId));
      const ket = r ? bersih(r.ket).toUpperCase() : "";
      if (r && KET_TANPA_BIAYA.has(ket)) return;
      const sebelum = i > 0 ? deret[i - 1] : null;
      const hadirSebelum = sebelum && sebelum.dihadiriOleh !== null && sebelum.dihadiriOleh !== undefined ? Number(sebelum.dihadiriOleh) : null;
      let yakin = "tinggi";
      let pilih = true;
      let dasar;
      if (r) {
        dasar = `relaas sidang ke-${s.urutan} (${s.tanggal}) tercatat ${ket === "S" ? "surat tercatat Pos" : ket === "R" ? "lewat RRI" : `kode ${ket || "-"}`}`;
      } else if (i === 0) {
        dasar = `sidang ${ikrar ? "ikrar talak" : "pertama"} ${s.tanggal} - relaas belum tercatat di SIPP`;
        yakin = "sedang";
        pilih = !hariIni || bersih(s.tanggal) >= hariIni;
      } else if (hadirSebelum === 2 || hadirSebelum === 4) {
        dasar = `sidang ${s.tanggal}: sidang sebelumnya ${p.ke === 2 || p.ke === 4 ? sebutan.dua : "pihak"} tidak hadir - relaas belum tercatat`;
        yakin = "sedang";
        pilih = !hariIni || bersih(s.tanggal) >= hariIni;
      } else if (hadirSebelum === null) {
        dasar = `sidang ${s.tanggal}: kehadiran sidang sebelumnya belum diisi`;
        yakin = "rendah";
        pilih = false;
      } else {
        return;
      }
      // K-KEJADIAN 11 Okt: panggilan sidang ke-n lahir dari sidang ke-(n-1) yang ditunda.
      const kejadian = ikrar ? "ikrar" : i === 0 ? "pertama" : `tunda:${deret[i - 1].id}`;
      hasil.push({ sidang: s, relaas: r || null, ket, resi: r ? resiPos(r.resi) : "", ikrar, yakin, pilih, dasar, kejadian });
    });
    return hasil;
  };

  /* === K-KEJADIAN 11 Okt === SATU PANGGILAN IKRAR UNTUK SERANGKAIAN SIDANG IKRAR
   * Diukur atas 98 perkara ikrar (Jul 2025 - Okt 2026, skrip ikrar-pola): sidang
   * ikrar yang ditunda (dua sidang ikrar) dijurnal SATU "Biaya Panggilan Ikrar
   * Talak" 13 dari 16 kali dan TIDAK PERNAH dua - juga bila kedua sidang ber-
   * relaas Pos (486/2025). Sidang ikrar pertama yang dipanggil elektronik/
   * langsung (E/W/N) tanpa relaas berbiaya lain: 0 baris 4 dari 5. Keputusan
   * pengguna 11 Okt: satu panggilan untuk rangkaian sidang ikrar. */
  const satuPanggilanIkrar = (p, deret) => {
    if (!deret.length) return [];
    const berbiaya = deret.find((e) => e.relaas);
    const e = berbiaya || deret[0];
    if (!berbiaya) {
      const r0 = relaas.find((x) => sidangIkrar[0] && Number(x.sidangId) === Number(sidangIkrar[0].id) && Number(x.pihakId) === Number(p.pihakId));
      const akhir = sidangIkrar[sidangIkrar.length - 1];
      if (r0 && KET_TANPA_BIAYA.has(bersih(r0.ket).toUpperCase())) {
        e.pilih = false;
        e.yakin = "rendah";
        e.dasar = `${e.dasar}; sidang ikrar pertama dipanggil tanpa biaya (kode ${bersih(r0.ket).toUpperCase()})`;
      } else {
        // Belum ada relaas: dicentang selama rangkaian sidang ikrarnya belum lewat.
        e.pilih = !hariIni || bersih(akhir && akhir.tanggal) >= hariIni;
        e.yakin = "sedang";
      }
    }
    if (sidangIkrar.length > 1) e.dasar = `${e.dasar}; satu panggilan untuk ${sidangIkrar.length} sidang ikrar (kebiasaan kasir)`;
    return [e];
  };
  /* === AKHIR K-KEJADIAN === */

  for (const ke of kedudukanDipanggil) {
    for (const p of pihakKe(ke)) {
      const biasa = deretPanggilan(p, sidangBiasa, false);
      const ikrar = ke === 2 ? satuPanggilanIkrar(p, deretPanggilan(p, sidangIkrar, true)) : [];
      peristiwaPanggil.set(Number(p.pihakId), { biasa, ikrar });
    }
  }
  /* === K-KEJADIAN 11 Okt === SATU AMPLOP
   * Beberapa Tergugat serumah dipanggil dengan SATU surat tercatat (resi Pos
   * sama pada sidang yang sama): kasir menulis satu Biaya Panggilan dan satu
   * PNBP relaas (542/2026: tiga Tergugat, satu resi, satu baris). Pihak kedua
   * dst. ditawarkan tanpa dicentang, bukan dibuang. */
  const resiTerpakai = new Set();
  for (const ke of kedudukanDipanggil) {
    for (const p of pihakKe(ke)) {
      const e = peristiwaPanggil.get(Number(p.pihakId));
      for (const ev of e ? [...e.biasa, ...e.ikrar] : []) {
        if (!ev.resi) continue;
        const kunci = `${ev.sidang.id}|${ev.resi}`;
        if (resiTerpakai.has(kunci)) {
          ev.pilih = false;
          ev.yakin = "rendah";
          ev.dasar = `${ev.dasar}; resi Pos sama dengan pihak lain pada sidang ini - satu amplop, lazimnya satu baris`;
        } else {
          resiTerpakai.add(kunci);
        }
      }
    }
  }
  // Pihak sekedudukan TANPA relaas padahal pihak lain pada sidang yang sama
  // sudah tercatat relaasnya: lazimnya tidak dipanggil tersendiri (380/2026:
  // empat Tergugat, satu yang dipanggil lewat Pos, satu baris biaya).
  const sidangBerelaas = new Set(
    relaas.filter((r) => pihak.some((p) => kedudukanDipanggil.includes(p.ke) && Number(p.pihakId) === Number(r.pihakId))).map((r) => Number(r.sidangId))
  );
  for (const e of peristiwaPanggil.values()) {
    for (const ev of [...e.biasa, ...e.ikrar]) {
      if (ev.relaas || !sidangBerelaas.has(Number(ev.sidang.id))) continue;
      ev.pilih = false;
      ev.yakin = "rendah";
      ev.dasar = `${ev.dasar}; pihak lain pada sidang ini sudah tercatat relaasnya, pihak ini belum`;
    }
  }
  /* === AKHIR K-KEJADIAN === */

  /**
   * Tanggal satu peristiwa panggilan: hari kerja SESUDAH surat diserahkan ke
   * Pos (terbanyak +1; uji balik 60 perkara: 31 dari 52 selisih tepat +1) >
   * tanggal relaas > hari ini.
   */
  const tanggalPanggil = (e) =>
    (e.relaas && (hariKerjaBerikut(e.relaas.tanggalJursitPos) || tanggalSah(e.relaas.tanggalRelaas))) || hariIni;

  // Tanggal kelompok panggilan pertama - hari kasir mencatat tergugat pertama.
  const pertamaTergugat = (() => {
    for (const p of pihakKe(2)) {
      const e = peristiwaPanggil.get(Number(p.pihakId));
      if (e && e.biasa.length && Number(e.biasa[0].sidang.id) === Number(sidangBiasa[0] && sidangBiasa[0].id)) return tanggalPanggil(e.biasa[0]);
    }
    return "";
  })();

  // 1a. PNBP relaas panggilan PERTAMA - sekali per pihak yang dipanggil.
  if (adaSidangPertama) {
    const kedudukanPnbp = permohonan ? [1] : [1, 2, 4];
    for (const ke of kedudukanPnbp) {
      const daftar = pihakKe(ke);
      daftar.forEach((p, i) => {
        const jb = permohonan ? JB.PNBP_PERTAMA_PEMOHON : ke === 1 ? JB.PNBP_PERTAMA_P : JB.PNBP_PERTAMA_T;
        // Pihak pertama dan kedua punya jenisnya sendiri - 237 milik Tergugat
        // tidak boleh menutup PNBP Penggugat.
        const jenisSendiri = ke === 1 ? [JB.PNBP_PERTAMA_P, JB.PNBP_PERTAMA_PEMOHON] : [JB.PNBP_PERTAMA_T, JB.PNBP_PERTAMA_TERMOHON, 254];
        const ada = cariAda((b) => jenisSendiri.includes(Number(b.jenisBiayaId)), p, "pertama");
        if (ada) return;
        const r1 = relaas.find((x) => Number(x.sidangId) === Number(sidangBiasa[0].id) && Number(x.pihakId) === Number(p.pihakId));
        // Tergugat yang tidak dipanggil berbiaya pada sidang pertama (relaas
        // elektronik, atau tergugat lain yang dipanggil) - PNBP-nya mengikuti
        // keyakinan panggilannya. Perkara 380/2026 berTergugat empat, PNBP-nya
        // satu: hanya yang dipanggil lewat Pos.
        let yakin = "tinggi";
        let pilih = true;
        let tanggal = pertamaTergugat;
        if (ke !== 1) {
          const e = peristiwaPanggil.get(Number(p.pihakId));
          const pertama = e && e.biasa[0] && Number(e.biasa[0].sidang.id) === Number(sidangBiasa[0].id) ? e.biasa[0] : null;
          if (!pertama) {
            yakin = "rendah";
            pilih = false;
          } else {
            yakin = pertama.yakin;
            pilih = pertama.pilih;
            tanggal = tanggalPanggil(pertama);
          }
        }
        if (!tanggal && permohonan && tanggalSah(perkara.penetapanHariSidang)) {
          // Pdt.P: sehari kerja sesudah penetapan hari sidang (184 dari 478).
          tanggal = hariKerjaBerikut(perkara.penetapanHariSidang);
        }
        if (!tanggal) tanggal = (r1 && tanggalSah(r1.tanggalRelaas)) || hariIni;
        const nomori = !permohonan || tarif.nomorPemohon !== false;
        const uraian = permohonan
          ? `PNBP Relaas Panggilan Pertama Pemohon${nomori ? akhiranUrut(i, daftar.length) : ""}`
          : `PNBP Relaas Panggilan Pertama Kepada ${sebutKe(ke, sebutan)}${akhiranUrut(i, daftar.length)}`;
        tambah({
          jenisBiayaId: jb,
          pihakKe: ke,
          pihakId: Number(p.pihakId),
          uraian,
          jumlah: lazim(jb),
          tanggal,
          peristiwa: `Panggilan pertama ${sebutKe(ke, sebutan)}${akhiranUrut(i, daftar.length)}`,
          dasar: r1
            ? `relaas sidang pertama tercatat (${bersih(r1.ket) === "E" ? "panggilan elektronik" : `kode ${bersih(r1.ket) || "-"}`})`
            : `sidang pertama ${sidangBiasa[0].tanggal} sudah ditetapkan${ke !== 1 && !pilih ? " - pihak ini belum tercatat dipanggil berbiaya" : ""}`,
          yakin,
          pilih,
          kelompok: ke === 1 ? 10 : 30 + ke,
          kejadian: "pertama",
        });
      });
    }
  } else if (!permohonan || pihakKe(1).length) {
    catatan.push("Sidang pertama belum ditetapkan - belum ada biaya panggilan yang diusulkan.");
  }

  // 1b. Biaya panggilan tiap pemanggilan berbiaya - per pihak, dicocokkan resi
  // lebih dahulu, lalu menurut banyaknya.
  for (const ke of kedudukanDipanggil) {
    for (const p of pihakKe(ke)) {
      const e = peristiwaPanggil.get(Number(p.pihakId)) || { biasa: [], ikrar: [] };
      const sebut = sebutKe(ke, sebutan);
      for (const jenisDeret of ["biasa", "ikrar"]) {
        const deret = e[jenisDeret];
        if (!deret.length) continue;
        const adaLama = jurnal.filter(
          (b) =>
            !terpakai.has(b.id) &&
            JENIS_PANGGILAN.has(Number(b.jenisBiayaId)) &&
            /ikrar/i.test(bersih(b.uraian)) === (jenisDeret === "ikrar") &&
            (Number(b.pihakId) === Number(p.pihakId) || (Number(b.pihakKe) === ke && !pihak.some((x) => Number(x.pihakId) === Number(b.pihakId))))
        );
        const tertutup = new Set();
        for (const ev of deret) {
          if (!ev.resi) continue;
          const b = adaLama.find((x) => !terpakai.has(x.id) && bersih(x.uraian).includes(ev.resi));
          if (b) {
            terpakai.add(b.id);
            tertutup.add(ev);
            tutup.set(b.id, ev.kejadian);
          }
        }
        for (const ev of deret) {
          if (tertutup.has(ev)) continue;
          const b = adaLama.find((x) => !terpakai.has(x.id));
          if (b) {
            terpakai.add(b.id);
            tertutup.add(ev);
            tutup.set(b.id, ev.kejadian);
          }
        }
        deret.forEach((ev, i) => {
          if (tertutup.has(ev)) return;
          const t = tarifPihak(p);
          let uraian;
          let jumlah = t.jumlah;
          let asalTarif = t.asal;
          if (ev.ikrar) {
            uraian = `Biaya Panggilan Ikrar Talak${ev.resi ? `/${ev.resi}` : "/"}`;
          } else if (ev.ket === "R") {
            uraian = `Biaya Panggilan ${sebut}/RRI`;
            jumlah = Number(tarif.rri) > 0 ? Number(tarif.rri) : null;
            asalTarif = jumlah ? "tarif panggilan lewat RRI" : "tarif RRI belum diketahui - isi jumlahnya";
          } else if (ev.ket === "P") {
            uraian = `Biaya Panggilan ${sebut}/PEMDA/${ev.resi}`;
          } else {
            uraian = `Biaya Panggilan ${sebut}/${ev.resi}`;
          }
          tambah({
            jenisBiayaId: JB.PANGGIL_TERGUGAT,
            pihakKe: ke,
            pihakId: Number(p.pihakId),
            uraian,
            jumlah,
            tanggal: tanggalPanggil(ev),
            peristiwa: `${ev.ikrar ? "Panggilan ikrar talak" : i === 0 ? "Panggilan pertama" : `Panggilan ke-${i + 1}`} ${sebut} (sidang ${ev.sidang.tanggal})`,
            dasar: `${ev.dasar}; ${asalTarif}`,
            yakin: jumlah && !(t.kira && ev.ket !== "R") ? ev.yakin : ev.yakin === "tinggi" ? "sedang" : ev.yakin,
            pilih: ev.pilih,
            perluResi: !ev.resi && ev.ket !== "R" && KET_BERBIAYA.has(ev.ket || "S") && ev.ket !== "Y" && ev.ket !== "T",
            kelompok: ev.ikrar ? 40 : 20 + i,
            kejadian: ev.kejadian,
          });
        });
      }
    }
  }

  // ==========================================================================
  // 2. HARI PUTUSAN
  // ==========================================================================
  const putusan = k.putusan && tanggalSah(k.putusan.tanggal) ? k.putusan : putusanDariSidang(sidangBiasa, hariIni);
  if (putusan && putusan.dariSidang) {
    catatan.push(`Putusan ${putusan.tanggal} dibaca dari hasil sidang ("${putusan.statusNama}") - data putusan belum diinput di SIPP.`);
  }
  if (putusan) {
    const tPut = tanggalSah(putusan.tanggal);
    const statusId = Number(putusan.statusId) || 0;
    const cabut = STATUS_CABUT.has(statusId) || /cabut/i.test(bersih(putusan.statusNama));
    const verstek = bersih(putusan.verstek).toUpperCase() === "Y";
    const sidangPutus = sidangBiasa.filter((s) => tanggalSah(s.tanggal) && s.tanggal <= tPut).slice(-1)[0] || null;
    const hadirPutus = sidangPutus && sidangPutus.dihadiriOleh !== null && sidangPutus.dihadiriOleh !== undefined ? Number(sidangPutus.dihadiriOleh) : null;
    const satu = (jb, kelompok, peristiwa, dasar, uraian) => {
      if (!pembayar) return;
      if (cariAda((b) => Number(b.jenisBiayaId) === jb, null, "putusan")) return;
      tambah({ jenisBiayaId: jb, pihakKe: 1, pihakId: Number(pembayar.pihakId), uraian, jumlah: lazim(jb), tanggal: tPut, peristiwa, dasar, kelompok, kejadian: "putusan" });
    };
    satu(JB.REDAKSI, 50, "Putusan", `putusan ${tPut}`, "Redaksi");
    satu(JB.METERAI, 51, "Putusan", `putusan ${tPut}`, "Meterai");
    if (cabut) satu(JB.PNBP_CABUT, 52, "Pencabutan perkara", `putusan ${tPut} berstatus dicabut`, "PNBP Surat Permohonan Pencabutan Perkara");

    if (!cabut && (hadirPutus === 3 || hadirPutus === 4) && pembayar) {
      if (!cariAda((b) => Number(b.jenisBiayaId) === JB.PNBP_PBT_P, null, "putusan")) {
        tambah({
          jenisBiayaId: JB.PNBP_PBT_P,
          pihakKe: 1,
          pihakId: Number(pembayar.pihakId),
          uraian: `PNBP Relaas Pemberitahuan Putusan Kepada ${sebutan.satu}`,
          jumlah: lazim(JB.PNBP_PBT_P),
          tanggal: tPut,
          peristiwa: `Pemberitahuan putusan kepada ${sebutan.satu}`,
          dasar: `${sebutan.satu} tidak hadir pada sidang putusan ${tPut}`,
          yakin: "sedang",
          // Uji balik: tepat 3/3 bila hanya pihak kedua yang hadir, 18/26 bila
          // tidak ada yang hadir - yang kedua ditawarkan tanpa dicentang.
          // 1.189.x (ukur-kasir-keadaan, Jul 2025-Sep 2026): gugatan yang
          // DIGUGURKAN / TIDAK DAPAT DITERIMA tanpa seorang pun hadir ditulis
          // kasir 27 dari 38 kali - dicentang. Permohonan begitu 3/12 - tidak.
          pilih: hadirPutus === 3 || (hadirPutus === 4 && !permohonan && STATUS_PBT_PENGGUGAT.has(statusId)),
          kelompok: 53,
          kejadian: "putusan",
        });
      }
    }

    const tergugatAbsen = verstek || hadirPutus === 2 || hadirPutus === 4;
    if (!cabut && !permohonan && tergugatAbsen) {
      const daftar = pihakKe(2);
      const pemberitahuan = Array.isArray(k.pemberitahuan) ? k.pemberitahuan : [];
      daftar.forEach((p, i) => {
        const pb = pemberitahuan.find((x) => Number(x.pihakKe) === 2 && (Number(x.pihakRowId) === Number(p.id) || Number(x.pihakId) === Number(p.pihakId)));
        const ket = pb ? bersih(pb.ket).toUpperCase() : "";
        if (ket === "E") return;
        // Dicentang bila verstek (337/362), bila pemberitahuannya sudah tercatat
        // lewat Pos, atau bila status putusan belum tertulis tetapi Tergugat
        // tidak hadir (349 dari 397 putusan begitu verstek). Tergugat yang
        // tidak pernah dipanggil berbiaya - satu dari beberapa - tidak.
        const berbiaya =
          daftar.length === 1 ||
          jurnal.some((b) => JENIS_PANGGILAN.has(Number(b.jenisBiayaId)) && Number(b.pihakId) === Number(p.pihakId)) ||
          (peristiwaPanggil.get(Number(p.pihakId)) || { biasa: [] }).biasa.some((e) => e.relaas);
        const tanpaStatus = Boolean(putusan.dariSidang) && !statusId;
        // 1.189.x: putusan contradictoir/ditolak/damai yang dihadiri Penggugat
        // saja (dihadiri_oleh 2) - kasir menulis pemberitahuan kepada Tergugat
        // 28 dari 31 kali (ukur-kasir-keadaan) - dicentang.
        const hadirPihakPertama = hadirPutus === 2 && STATUS_PBT_TERGUGAT_HADIR2.has(statusId);
        const pilihPbt = berbiaya && (verstek || ket === "S" || ket === "P" || (tanpaStatus && hadirPutus === 2) || hadirPihakPertama);
        const yakin = pilihPbt ? "tinggi" : "sedang";
        const dasar = verstek
          ? `putusan verstek ${tPut}`
          : tanpaStatus
            ? `${sebutan.dua} tidak hadir pada sidang putusan ${tPut} (status putusan belum tertulis)`
            : `${sebutan.dua} tidak hadir pada sidang putusan ${tPut} (bukan verstek)`;
        if (!["W", "M", "R"].includes(ket)) {
          if (!cariAda((b) => Number(b.jenisBiayaId) === JB.PEMBERITAHUAN, p, "putusan")) {
            const t = tarifPihak(p);
            const resi = pb ? resiPos(pb.resi) : "";
            tambah({
              jenisBiayaId: JB.PEMBERITAHUAN,
              pihakKe: 2,
              pihakId: Number(p.pihakId),
              uraian: `Biaya Pemberitahuan/${resi || "P"}`,
              jumlah: t.jumlah,
              tanggal: tPut,
              peristiwa: `Pemberitahuan putusan kepada ${sebutan.dua}${akhiranUrut(i, daftar.length)}`,
              dasar: `${dasar}; ${t.asal}`,
              yakin: t.jumlah && !t.kira ? yakin : "sedang",
              pilih: pilihPbt,
              // "/P" memang kebiasaan hari putusan - resinya baru lahir sesudahnya.
              perluResi: false,
              kelompok: 54 + i * 2,
              kejadian: "putusan",
            });
          }
        }
        if (!cariAda((b) => Number(b.jenisBiayaId) === JB.PNBP_PBT_T, p, "putusan")) {
          tambah({
            jenisBiayaId: JB.PNBP_PBT_T,
            pihakKe: 2,
            pihakId: Number(p.pihakId),
            uraian: `PNBP Relaas Pemberitahuan Putusan Kepada ${sebutan.dua}${akhiranUrut(i, daftar.length)}`,
            jumlah: lazim(JB.PNBP_PBT_T),
            tanggal: tPut,
            peristiwa: `Pemberitahuan putusan kepada ${sebutan.dua}${akhiranUrut(i, daftar.length)}`,
            dasar,
            yakin,
            pilih: pilihPbt,
            kelompok: 55 + i * 2,
            kejadian: "putusan",
          });
        }
      });
    }

    // Sisa panjar - selalu terakhir, selalu menghabiskan saldo.
    const sudahSisa = jurnal.some((b) => Number(b.jenisBiayaId) === JB.SISA);
    /* === K-KEJADIAN 11 Okt === sisa panjar yang sudah ada menutup putusan, atau ikrar pada cerai talak dikabulkan */
    for (const b of jurnal) {
      if (Number(b.jenisBiayaId) !== JB.SISA || tutup.has(b.id)) continue;
      const talakKabul = Number(perkara.jenisPerkaraId) === JENIS_CERAI_TALAK && statusId === STATUS_DIKABULKAN;
      tutup.set(b.id, talakKabul ? "ikrar" : "putusan");
    }
    /* === AKHIR K-KEJADIAN === */
    if (!sudahSisa && pembayar) {
      const ikrarPerlu = Number(perkara.jenisPerkaraId) === JENIS_CERAI_TALAK && statusId === STATUS_DIKABULKAN;
      const tIkrar = (k.ikrar && tanggalSah(k.ikrar.tanggal)) || ikrarDariSidang(sidangIkrar);
      if (ikrarPerlu && !tIkrar) {
        catatan.push("Cerai talak dikabulkan, ikrar talak belum diucapkan - Pengembalian Sisa Panjar menunggu ikrar (kasir mencatatnya pada hari ikrar).");
      } else {
        tambah({
          jenisBiayaId: JB.SISA,
          pihakKe: 1,
          pihakId: Number(pembayar.pihakId),
          uraian: "Pengembalian Sisa Panjar",
          jumlah: 0,
          tanggal: ikrarPerlu ? tIkrar : tPut,
          peristiwa: ikrarPerlu ? "Ikrar talak" : "Putusan",
          dasar: ikrarPerlu ? `ikrar talak ${tIkrar}` : `putusan ${tPut}`,
          sisaOtomatis: true,
          kelompok: 90,
          kejadian: ikrarPerlu ? "ikrar" : "putusan",
        });
      }
    }
  }

  // Sisa panjar SELALU terakhir (647/647), apa pun tanggal usulan lainnya.
  usulan.sort((a, b) => Number(a.sisaOtomatis) - Number(b.sisaOtomatis) || a.tanggal.localeCompare(b.tanggal) || a.kelompok - b.kelompok);
  for (const u of usulan) {
    if (!u.tersedia) {
      u.pilih = false;
      catatan.push(`Jenis biaya ${u.jenisBiayaId} tidak tersedia untuk alur perkara ini di SIPP - "${u.uraian}" tidak dicentang.`);
    }
  }
  const sisa = usulan.find((u) => u.sisaOtomatis);
  if (sisa) {
    // Tanggalnya tidak boleh mendahului baris lain - SIPP mengurut menurut
    // tanggal, dan sisa yang terurut di tengah membuat saldo sesudahnya minus.
    const terakhir = [...usulan.filter((u) => u !== sisa).map((u) => u.tanggal), ...jurnal.map((b) => b.tanggal)].filter(Boolean).sort().pop();
    if (terakhir && terakhir > sisa.tanggal) sisa.tanggal = patut(terakhir);
  }
  /* === K-KEJADIAN 11 Okt === TAMBAHAN PANJAR BILA SALDO KURANG
   *
   * Bila saldo panjar tidak cukup untuk biaya suatu kejadian, kasir menulis
   * "Tambahan Panjar Biaya Perkara" (jenis 224, pemasukan, pihak pertama)
   * SEBELUM baris pertama kejadian itu, bertanggal sama (224>157>152>...,
   * 224>14>151 pada ikrar). Blangko SIPP sendiri hanya membandingkan tiap
   * biaya dengan JUMLAH pemasukan (get_panjar_biaya), jadi saldo minus tidak
   * dicegahnya - kebiasaan kasirlah yang menjaga saldo tidak minus.
   * Diukur atas 48 tambahan panjar biasa 2024-2026 (aleta_bot/tools/
   * ukur-kasir-kejadian.js): jumlahnya = kekurangan seluruh pengeluaran
   * kejadian itu, sekurangnya Rp10.000 - 41 dari 48 (85%); bertanggal sama
   * dengan pengeluaran sesudahnya 44 dari 48. Uang ini dibayar pihak, maka
   * DITAWARKAN TANPA CENTANG (keputusan pengguna 11 Okt): kasir sendiri yang
   * mencentangnya sesudah pihak membayar - sisa panjar dihitung ulang layar.
   */
  // Jurnal yang sudah ditutup (sisa panjar dikembalikan) tidak dibuka lagi dengan tambahan panjar.
  if (jenisBiaya[JB_TAMBAH_PANJAR] && pembayar && !jurnal.some((b) => Number(b.jenisBiayaId) === JB.SISA)) {
    let jalan = saldo;
    let titik = -1;
    for (let i = 0; i < usulan.length; i += 1) {
      const u = usulan[i];
      if (u.sisaOtomatis || !u.pilih) continue;
      jalan += (Number(u.jenisTransaksi) || -1) * (Number(u.jumlah) || 0);
      if (jalan < 0 && titik < 0) titik = i;
    }
    if (titik >= 0) {
      // Ditaruh sebelum baris PERTAMA kejadian yang kekurangan itu.
      for (let j = 0; j < titik; j += 1) {
        const u = usulan[j];
        if (u.pilih && !u.sisaOtomatis && u.kejadian === usulan[titik].kejadian) {
          titik = j;
          break;
        }
      }
      const pemicu = usulan[titik];
      const kurang = -jalan;
      const jb = jenisBiaya[JB_TAMBAH_PANJAR];
      nomor += 1;
      usulan.splice(titik, 0, {
        kunci: `u${nomor}`,
        jenisBiayaId: JB_TAMBAH_PANJAR,
        kategoriId: Number(jb.kategoriId) || 1,
        jenisTransaksi: Number(jb.jenisTransaksi) || 1,
        pihakKe: 1,
        pihakId: Number(pembayar.pihakId),
        uraian: "Tambahan Panjar Biaya Perkara",
        jumlah: Math.max(kurang, TAMBAH_PANJAR_MINIMUM),
        tanggal: pemicu.tanggal,
        keterangan: "",
        jurusitaId: 0,
        peristiwa: "Tambahan panjar",
        dasar: `saldo panjar Rp${saldo.toLocaleString("id-ID")} kurang Rp${kurang.toLocaleString("id-ID")} untuk biaya yang diusulkan - pastikan pihak sudah membayar tambahan panjar`,
        yakin: "sedang",
        pilih: false,
        perluResi: false,
        sisaOtomatis: false,
        kelompok: pemicu.kelompok - 0.5,
        tersedia: true,
        kejadian: pemicu.kejadian,
        tambahPanjar: true,
      });
    }
  }
  /* === AKHIR K-KEJADIAN === */
  const saldoAkhir = hitungSisaOtomatis(usulan, saldo);
  if (sisa && !(sisa.jumlah > 0)) {
    // K-KEJADIAN 11 Okt: bila tambahan panjar ditawarkan, sisa tetap tercentang - jumlahnya
    // dihitung ulang layar saat kasir mencentang tambahan panjar; selama <= 0 tidak dikirim.
    sisa.pilih = usulan.some((u) => u.tambahPanjar);
    catatan.push(
      sisa.jumlah < 0
        ? `Saldo panjar KURANG Rp${Math.abs(sisa.jumlah).toLocaleString("id-ID")} - perlu Tambahan Panjar Biaya Perkara, bukan pengembalian.`
        : "Saldo panjar habis - tidak ada sisa yang dikembalikan."
    );
  }
  if (usulan.some((u) => u.perluResi && u.pilih)) {
    catatan.push("Sebagian baris belum memuat nomor resi Pos (relaas belum tercatat) - lengkapi uraiannya sebelum disimpan.");
  }
  if (usulan.some((u) => u.pilih && u.jumlah === null)) {
    catatan.push("Sebagian tarif belum diketahui - jumlahnya harus diisi sebelum disimpan.");
  }
  /* === K-KEJADIAN 11 Okt === */
  if (usulan.some((u) => u.tambahPanjar)) {
    catatan.push("Saldo panjar kurang - Tambahan Panjar Biaya Perkara ditawarkan (belum dicentang) sebelum biaya yang kekurangan. Centang sesudah pihak membayarnya; tanpa tambahan panjar saldo jurnal menjadi minus.");
  }
  return { usulan, catatan, saldo, saldoAkhir, tutup: [...tutup].map(([jurnalId, kejadian]) => ({ jurnalId, kejadian })) };
  /* === AKHIR K-KEJADIAN === */
}

/**
 * Jumlah baris Pengembalian Sisa Panjar = saldo jurnal + seluruh usulan yang
 * dicentang SEBELUM baris sisa. Dipakai mesin dan layar (kembarannya di
 * @/lib/kasir-jurnal). Pulang saldo akhir.
 */
function hitungSisaOtomatis(usulan, saldoAwal) {
  let saldo = Number(saldoAwal) || 0;
  for (const u of usulan) {
    if (u.sisaOtomatis) {
      u.jumlah = saldo;
      if (u.pilih && saldo > 0) saldo = 0;
      continue;
    }
    if (!u.pilih) continue;
    saldo += (Number(u.jenisTransaksi) || -1) * (Number(u.jumlah) || 0);
  }
  return saldo;
}

/* === K-KEJADIAN 11 Okt === */
/**
 * ============================================================================
 * KASIR PER KEJADIAN (11 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: "tambahkan otomatis isi data kasir tiap kejadian tiap
 * perkara ... komponen dikeluarkan berbeda-beda (seperti saat putus ...
 * berikut juga beda kalau di daftar atau ditunda perkara)".
 *
 * susunKejadian - fungsi MURNI atas keadaan (bacaKeadaan) + hasil susunUsulan.
 * Tiap kejadian perkara (pendaftaran, panggilan sidang pertama, tiap sidang
 * yang ditunda, mediasi, putusan, ikrar talak) dengan tanggalnya, berisi:
 *   - baris jurnal yang SUDAH ada (yang menutup kejadian itu menurut
 *     pembanding mesin usulan - satu baris tidak pernah menutup dua kejadian)
 *   - usulan yang BELUM ada (baris susunUsulan yang sama - urutan, bentuk, dan
 *     sisa panjar terakhir tidak berubah; kasir tetap yang menekan Simpan).
 * Kejadian tanpa usulan tercentang = selesai.
 *
 * Kebiasaan per kejadian diukur atas jurnal satker (sipp_donggala, putusan
 * Jul 2025 - Okt 2026; aleta_bot/tools/ukur-kasir-kejadian.js, ringkasan di
 * catatan kerja kasir-11okt/hasil-agen-k.md):
 *   pendaftaran  Panjar (urutan 1) > Biaya Pendaftaran/PNBP 30.000 (2) >
 *                Biaya Pemberkasan/ATK 100.000 (3) - ditulis SIPP sendiri
 *                (new_perdata add_data) pada detik yang sama dengan perkaranya
 *                1.375 dari 1.375; BUKAN lewat Tambah, maka tidak diusulkan.
 *   mediasi      lazimnya tanpa biaya - Biaya Panggilan Mediasi hanya pada 3
 *                dari 103 mediasi; tidak diusulkan.
 *   tambahan panjar  lihat susunUsulan (jenis 224).
 */
const URUT_KEJADIAN = { daftar: 0, pertama: 1, mediasi: 2, tunda: 3, putusan: 4, ikrar: 5, lain: 9 };
const JENIS_DAFTAR = new Set([1, 61, 155]);
const JENIS_HARI_PUTUSAN_SAJA = new Set([157, 152, 404, 260, 29, 389, 252]);

function tanggalLayar(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "-";
}

function teksKehadiran(d, sebutan, permohonan) {
  if (d === null || d === undefined) return "Kehadiran sidang belum diisi di SIPP.";
  if (permohonan) return Number(d) === 1 ? "Pemohon hadir." : "Pemohon tidak lengkap hadir.";
  if (Number(d) === 1) return "Semua pihak hadir - tidak ada panggilan ulang.";
  if (Number(d) === 2) return `Hanya ${sebutan.satu} hadir - ${sebutan.dua} dipanggil ulang.`;
  if (Number(d) === 3) return `Hanya ${sebutan.dua} hadir.`;
  if (Number(d) === 4) return `Tidak ada pihak hadir - ${sebutan.dua} dipanggil ulang.`;
  return "";
}

/**
 * @param {object} k keadaan (bentuk bacaKeadaan)
 * @param {object} [hasil] hasil susunUsulan(k) - disusun sendiri bila tidak diberikan
 * @returns {{ kejadian: object[], ringkas: { usulan: number, kejadian: number, keadaan: string, kunciKeadaan: string, saldo: number } }}
 */
function susunKejadian(k, hasil) {
  const h = hasil || susunUsulan(k);
  const perkara = (k && k.perkara) || {};
  const permohonan = Number(perkara.alurPerkaraId) === ALUR_PERMOHONAN;
  const sebutan = sebutanPerkara(perkara);
  const hariIni = tanggalSah(k && k.hariIni);
  const tanggalDaftar = tanggalSah(perkara.tanggalDaftar);
  const jurnal = (Array.isArray(k && k.jurnal) ? k.jurnal : []).slice().sort((a, b) => angka(a.id) - angka(b.id));
  const usulan = Array.isArray(h.usulan) ? h.usulan : [];
  const tutup = new Map((Array.isArray(h.tutup) ? h.tutup : []).map((x) => [Number(x.jurnalId), x.kejadian]));
  const sidang = (Array.isArray(k && k.sidang) ? k.sidang : [])
    .slice()
    .sort((a, b) => angka(a.urutan) - angka(b.urutan) || bersih(a.tanggal).localeCompare(bersih(b.tanggal)));
  const sidangBiasa = sidang.filter((s) => !s.ikrar);
  const sidangIkrar = sidang.filter((s) => s.ikrar);
  const keadaan = keadaanPerkara(k);
  const putusan = k && k.putusan && tanggalSah(k.putusan.tanggal) ? k.putusan : putusanDariSidang(sidangBiasa, hariIni);
  const statusId = putusan ? Number(putusan.statusId) || 0 : 0;
  const talakKabul = Number(perkara.jenisPerkaraId) === JENIS_CERAI_TALAK && statusId === STATUS_DIKABULKAN;
  const tIkrar = (k && k.ikrar && tanggalSah(k.ikrar.tanggal)) || ikrarDariSidang(sidangIkrar);

  const peta = new Map();
  const buat = (kunci, jenis, tanggal, judul, keterangan, lazim) => {
    if (!peta.has(kunci)) peta.set(kunci, { kunci, jenis, tanggal: tanggalSah(tanggal), judul, keterangan: keterangan || "", lazim: lazim || [], komponen: [] });
    return peta.get(kunci);
  };

  buat(
    "daftar",
    "daftar",
    tanggalDaftar,
    "Pendaftaran",
    "Panjar, PNBP pendaftaran, dan ATK/pemberkasan ditulis SIPP sendiri saat perkara didaftar - bukan lewat Tambah.",
    ["Panjar Biaya Perkara", "Biaya Pendaftaran/PNBP", "Biaya Pemberkasan/ATK"]
  );
  if (sidangBiasa[0]) {
    buat(
      "pertama",
      "pertama",
      tanggalSah(perkara.penetapanHariSidang) || sidangBiasa[0].tanggal,
      `Penetapan hari sidang - panggilan sidang pertama ${tanggalLayar(sidangBiasa[0].tanggal)}`,
      permohonan ? "PNBP relaas panggilan pertama tiap pemohon." : `${sebutan.dua} lewat Pos/RRI berbiaya; panggilan elektronik tanpa biaya, PNBP-nya tetap.`,
      permohonan
        ? ["PNBP Relaas Panggilan Pertama Pemohon"]
        : [`PNBP Relaas Panggilan Pertama Kepada ${sebutan.satu}`, `Biaya Panggilan ${sebutan.dua}`, `PNBP Relaas Panggilan Pertama Kepada ${sebutan.dua}`]
    );
  } else if (Number((k && k.pembiayaan) || 1) === 1) {
    // Kejadian berikutnya yang DITUNGGU - tampil agar kasir tahu biaya apa yang menyusul.
    buat(
      "pertama",
      "pertama",
      "",
      "Penetapan hari sidang - panggilan sidang pertama",
      "Sidang pertama belum ditetapkan - biaya panggilan pertama diusulkan sesudah PHS.",
      permohonan ? ["PNBP Relaas Panggilan Pertama Pemohon"] : [`PNBP Relaas Panggilan Pertama Kepada ${sebutan.satu}`, `Biaya Panggilan ${sebutan.dua}`, `PNBP Relaas Panggilan Pertama Kepada ${sebutan.dua}`]
    ).menunggu = true;
  }
  for (const m of Array.isArray(k && k.mediasi) ? k.mediasi : []) {
    if (!tanggalSah(m.tanggal)) continue;
    buat(`mediasi:${m.id}`, "mediasi", m.tanggal, `Mediasi${m.selesai ? ` (selesai ${tanggalLayar(m.selesai)})` : ""}`, "Lazimnya tanpa biaya (Biaya Panggilan Mediasi hanya 3 dari 103 mediasi).", []);
  }
  const relaasSemua = Array.isArray(k && k.relaas) ? k.relaas : [];
  const pihakDua = new Set((Array.isArray(k && k.pihak) ? k.pihak : []).filter((p) => p.ke === 2 || p.ke === 4).map((p) => Number(p.pihakId)));
  sidangBiasa.forEach((s, i) => {
    const berikut = sidangBiasa[i + 1];
    if (!berikut) return;
    const rBerikut = relaasSemua.filter((r) => Number(r.sidangId) === Number(berikut.id) && pihakDua.has(Number(r.pihakId)));
    const elektronik = rBerikut.length > 0 && rBerikut.every((r) => KET_TANPA_BIAYA.has(bersih(r.ket).toUpperCase()));
    buat(
      `tunda:${s.id}`,
      "tunda",
      s.tanggal,
      `Sidang ${tanggalLayar(s.tanggal)} ditunda ke ${tanggalLayar(berikut.tanggal)}`,
      `${teksKehadiran(s.dihadiriOleh, sebutan, permohonan)}${elektronik ? " Panggilan elektronik/tanpa biaya." : ""}`,
      permohonan ? [] : [`Biaya Panggilan ${sebutan.dua} (bila tidak hadir)`]
    );
  });
  if (putusan) {
    const kunciLazim = keadaan.kunci === "ikrar" ? "menunggu-ikrar" : keadaan.kunci;
    buat(
      "putusan",
      "putusan",
      putusan.tanggal,
      `Putusan ${tanggalLayar(putusan.tanggal)}`,
      putusan.dariSidang ? `Dibaca dari hasil sidang ("${bersih(putusan.statusNama)}") - data putusan belum diinput.` : keadaan.nama,
      KEADAAN_KASIR[kunciLazim] ? KEADAAN_KASIR[kunciLazim].lazim.slice() : []
    );
  }
  if (sidangIkrar.length || tIkrar || talakKabul) {
    buat(
      "ikrar",
      "ikrar",
      tIkrar || (sidangIkrar[0] && sidangIkrar[0].tanggal) || "",
      `Ikrar talak${tIkrar ? ` ${tanggalLayar(tIkrar)}` : sidangIkrar[0] ? ` (sidang ${tanggalLayar(sidangIkrar[0].tanggal)})` : ""}`,
      tIkrar ? "Sisa panjar dikembalikan pada hari ikrar." : "Ikrar belum diucapkan - sisa panjar menunggu hari ikrar.",
      KEADAAN_KASIR.ikrar.lazim.slice()
    ).menunggu = !tIkrar;
  }

  // Kejadian baris jurnal yang tidak ditutup pembanding: menurut jenis dan tanggalnya.
  const kunciPanggilPada = (tanggal) => {
    let hasilKunci = peta.has("pertama") ? "pertama" : "";
    sidangBiasa.forEach((s, i) => {
      if (sidangBiasa[i + 1] && peta.has(`tunda:${s.id}`) && s.tanggal && tanggal > s.tanggal) hasilKunci = `tunda:${s.id}`;
    });
    return hasilKunci;
  };
  const golong = (b, i) => {
    if (tutup.has(b.id)) return tutup.get(b.id);
    const jb = Number(b.jenisBiayaId);
    if (JENIS_DAFTAR.has(jb) && (Number(b.urutan) > 0 || b.tanggal === tanggalDaftar)) return "daftar";
    if (jb === JB_TAMBAH_PANJAR) {
      // Tambahan panjar membiayai baris sesudahnya.
      for (let x = i + 1; x < jurnal.length; x += 1) {
        if (Number(jurnal[x].jenisTransaksi) > 0) continue;
        return golong(jurnal[x], x);
      }
      return "lain";
    }
    if (jb === JB_PANGGIL_MEDIASI) {
      const m = [...peta.values()].filter((e) => e.jenis === "mediasi" && e.tanggal && e.tanggal <= b.tanggal).pop();
      return m ? m.kunci : "lain";
    }
    if (JENIS_PANGGILAN.has(jb) && /ikrar/i.test(bersih(b.uraian)) && peta.has("ikrar")) return "ikrar";
    if (JENIS_HARI_PUTUSAN_SAJA.has(jb) && peta.has("putusan")) return "putusan";
    if (jb === JB.SISA) return talakKabul && peta.has("ikrar") ? "ikrar" : peta.has("putusan") ? "putusan" : "lain";
    if (JENIS_PANGGILAN.has(jb) || JENIS_PNBP_PERTAMA.has(jb) || jb === 254) return kunciPanggilPada(b.tanggal) || "lain";
    return "lain";
  };
  const ambilKejadian = (kunci) =>
    peta.get(kunci) || buat("lain", "lain", "", "Baris jurnal lain", "Tidak terkait kejadian yang dikenali (mis. pemeriksaan setempat, verzet).", []);
  jurnal.forEach((b, i) => {
    ambilKejadian(golong(b, i)).komponen.push({
      sumber: "jurnal",
      jurnalId: b.id,
      jenisBiayaId: Number(b.jenisBiayaId) || 0,
      uraian: bersih(b.uraian),
      jumlah: angka(b.jumlah),
      tanggal: tanggalSah(b.tanggal),
      masuk: angka(b.jenisTransaksi) > 0,
    });
  });
  for (const u of usulan) {
    ambilKejadian(u.kejadian).komponen.push({
      sumber: "usulan",
      kunci: u.kunci,
      jenisBiayaId: u.jenisBiayaId,
      uraian: u.uraian,
      jumlah: u.jumlah,
      tanggal: u.tanggal,
      pilih: Boolean(u.pilih),
      yakin: u.yakin,
      sisaOtomatis: Boolean(u.sisaOtomatis),
      tambahPanjar: Boolean(u.tambahPanjar),
    });
  }

  const dipilih = (c) => c.sumber === "usulan" && c.pilih && (!c.sisaOtomatis || Number(c.jumlah) > 0);
  const kejadian = [...peta.values()]
    .map((e) => {
      const sudah = e.komponen.filter((c) => c.sumber === "jurnal").length;
      const usul = e.komponen.filter(dipilih).length;
      const tawaran = e.komponen.filter((c) => c.sumber === "usulan" && !dipilih(c)).length;
      let status = usul ? "terbuka" : "selesai";
      if (e.jenis === "daftar" && !sudah) status = "periksa";
      // Kejadian yang belum terjadi dan belum berbaris apa pun: ditunggu, bukan selesai.
      if (status === "selesai" && e.menunggu && !e.komponen.length) status = "menunggu";
      return { ...e, sudah, usulan: usul, ditawarkan: tawaran, status, tanpaBiaya: !e.komponen.length && status === "selesai" };
    })
    .filter((e) => e.jenis !== "lain" || e.komponen.length)
    .sort(
      (a, b) =>
        (a.tanggal || "9999").localeCompare(b.tanggal || "9999") ||
        (URUT_KEJADIAN[a.jenis] ?? 9) - (URUT_KEJADIAN[b.jenis] ?? 9)
    );
  return {
    kejadian,
    ringkas: {
      usulan: usulan.filter((u) => u.pilih && (!u.sisaOtomatis || Number(u.jumlah) > 0)).length,
      kejadian: kejadian.filter((e) => e.status === "terbuka").length,
      keadaan: keadaan.nama,
      kunciKeadaan: keadaan.kunci,
      saldo: Number(h.saldo) || 0,
    },
  };
}
/* === AKHIR K-KEJADIAN === */

/** Tabel deskripsi audit persis fetch_description() SIPP. */
function keteranganAudit(nilai) {
  const baris = Object.entries(nilai)
    .map(([kolom, isi]) => `<tr><td>${kolom}</td><td>${isi === null || isi === undefined ? "" : String(isi)}</td></tr>`)
    .join("");
  return `<br><table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1"><tr><th>Nama Kolom</th><th>Nilai</th></tr>${baris}</table>`;
}

function judulAudit(id) {
  return `Tambah Data Biaya <br />Tambah table <b>Perkara_Biaya</b> dari halaman <b>Tambah Biaya</b> dengan Primary Key [ID=${id}]`;
}

const KOLOM_BIAYA = [
  "id",
  "id_pembiayaan",
  "perkara_id",
  "general_id",
  "tahapan_id",
  "kategori_id",
  "jenis_biaya_id",
  "pihak_id",
  "pihak_ke",
  "jenis_transaksi",
  "urutan",
  "sisa",
  "tanggal_transaksi",
  "uraian",
  "jumlah",
  "keterangan",
  "diinput_oleh",
  "diinput_tanggal",
];

const SQL_SISIP_BIAYA = `INSERT INTO perkara_biaya (${KOLOM_BIAYA.join(", ")}) VALUES (${KOLOM_BIAYA.map(() => "?").join(",")})`;
const SQL_SISIP_AUDIT =
  "INSERT INTO sys_audittrail (datetime, ipaddress, username, tablename, formname, action, title, description) VALUES (?,?,?,?,?,?,?,?)";

const TANDA_ID = "#ID#";
const TANDA_SAAT = "#SAAT#";

function buatLayanan(deps = {}) {
  const kueri =
    deps.kueri ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));
  /**
   * ==========================================================================
   * SATU BARIS JURNAL = SATU TRANSAKSI (uji rilis 9 Okt 2026, pola kasus 273)
   * ==========================================================================
   *
   * Satu baris jurnal menyentuh tiga tabel: perkara_biaya, sys_audittrail,
   * perkara_biaya_jurusita. Sampai 1.188.0 ketiganya ditulis lepas-lepas:
   * audit yang gagal sesudah baris biayanya tertulis meninggalkan baris
   * jurnal TANPA audit, dan penekanan ulang melewatinya sebagai "sudah ada" -
   * auditnya tidak pernah lahir. Kini sekelompok itu satu transaksi (ketiga
   * tabel InnoDB): gagal di langkah mana pun -> ROLLBACK seluruh baris itu.
   *
   * `transaksi(kerja)` memanggil kerja(kueriSambungan) di dalam START
   * TRANSACTION .. COMMIT. Pemanggil yang memberi `deps.kueri` tanpa
   * `deps.transaksi` (uji lama) tetap berjalan tanpa transaksi.
   */
  const transaksi =
    deps.transaksi ||
    (deps.kueri
      ? async (kerja) => ({ hasil: await kerja(kueri), dipulihkan: null })
      : async (kerja) => ({ hasil: await require("./transaksiSipp").denganTransaksi(kerja), dipulihkan: null }));
  const tabelAda = deps.tabelAda || ((tabel) => require("./sippSkemaService").tabelAda(tabel));
  const jeda = deps.jeda || ((jenis, opsi) => require("./jedaManusiaService").jeda(jenis, opsi));
  // Nama lengkap SIPP -> username (pola akunPetugasMasuk penetapan, butir 39).
  const akunLewatNama = deps.akunPetugasMasuk || ((nama, ip) => require("./penetapanTulisService").akunPetugasMasuk(nama, ip));

  async function satu(sql, params) {
    const baris = await kueri(sql, params);
    return (Array.isArray(baris) && baris[0]) || null;
  }

  async function semua(sql, params) {
    const baris = await kueri(sql, params);
    return Array.isArray(baris) ? baris : [];
  }

  async function saatBasisData() {
    const b = await satu("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS saat", []);
    const saat = bersih(b && b.saat);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(saat)) throw new Error("jam_basis_data_tidak_terbaca");
    return saat;
  }

  /** Mencari perkara menurut nomornya (atau bagian depannya). Hanya SELECT. */
  async function cariPerkara(teks) {
    const t = bersih(teks).slice(0, 60);
    if (t.length < 1) return { ok: true, perkara: [] };
    const pola = /^\d+$/.test(t) ? `${t}/%` : `%${t}%`;
    const baris = await semua(
      `SELECT perkara_id AS perkaraId, nomor_perkara AS nomorPerkara, jenis_perkara_nama AS jenisPerkara,
              DATE_FORMAT(tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar
         FROM perkara WHERE nomor_perkara LIKE ? ORDER BY perkara_id DESC LIMIT 15`,
      [pola]
    );
    return {
      ok: true,
      perkara: baris.map((b) => ({
        perkaraId: Number(b.perkaraId),
        nomorPerkara: bersih(b.nomorPerkara),
        jenisPerkara: bersih(b.jenisPerkara),
        tanggalDaftar: tanggalSah(b.tanggalDaftar),
      })),
    };
  }

  async function bacaJurnal(perkaraId) {
    const baris = await semua(
      `SELECT pb.id, pb.id_pembiayaan AS pembiayaan, pb.kategori_id AS kategoriId, pb.jenis_biaya_id AS jenisBiayaId,
              pb.pihak_id AS pihakId, pb.pihak_ke AS pihakKe, pb.urutan, pb.jenis_transaksi AS jenisTransaksi,
              DATE_FORMAT(pb.tanggal_transaksi, '%Y-%m-%d') AS tanggal, pb.uraian, pb.jumlah, pb.keterangan,
              pb.diinput_oleh AS diinputOleh, DATE_FORMAT(pb.diinput_tanggal, '%Y-%m-%d %H:%i:%s') AS diinputTanggal,
              phk.nama AS namaPihak, j.nama_gelar AS jurusita
         FROM perkara_biaya pb
         LEFT JOIN pihak phk ON phk.id = pb.pihak_id
         LEFT JOIN perkara_biaya_jurusita c ON c.perkara_biaya_id = pb.id
         LEFT JOIN jurusita j ON j.id = c.jurusita_id
        WHERE pb.perkara_id = ? AND pb.tahapan_id = ?
        ORDER BY pb.tanggal_transaksi ASC, pb.id ASC, pb.jenis_transaksi DESC`,
      [perkaraId, TAHAPAN]
    );
    return baris.map((b) => ({
      id: Number(b.id),
      pembiayaan: Number(b.pembiayaan) || 1,
      kategoriId: Number(b.kategoriId) || 0,
      jenisBiayaId: Number(b.jenisBiayaId) || 0,
      pihakId: b.pihakId === null || b.pihakId === undefined ? null : Number(b.pihakId),
      pihakKe: b.pihakKe === null || b.pihakKe === undefined ? null : Number(b.pihakKe),
      urutan: Number(b.urutan) || 0,
      jenisTransaksi: Number(b.jenisTransaksi) || 0,
      tanggal: tanggalSah(b.tanggal),
      uraian: bersih(b.uraian),
      jumlah: angka(b.jumlah),
      keterangan: bersih(b.keterangan),
      diinputOleh: bersih(b.diinputOleh),
      diinputTanggal: bersih(b.diinputTanggal),
      namaPihak: bersih(b.namaPihak),
      jurusita: bersih(b.jurusita),
    }));
  }

  /** Seluruh bahan mesin usulan satu perkara. Hanya SELECT. */
  async function bacaKeadaan(perkaraId) {
    const id = Number(perkaraId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, alasan: "Perkara tidak dikenali." };
    if (!(await tabelAda("perkara_biaya"))) return { ok: false, alasan: "Tabel perkara_biaya tidak ada pada SIPP versi ini." };
    const p = await satu(
      `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, p.alur_perkara_id AS alurPerkaraId,
              p.jenis_perkara_id AS jenisPerkaraId, p.jenis_perkara_nama AS jenisPerkaraNama,
              DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar,
              p.tahapan_terakhir_id AS tahapanId, p.proses_terakhir_text AS proses,
              DATE_FORMAT(pen.penetapan_hari_sidang, '%Y-%m-%d') AS penetapanHariSidang
         FROM perkara p LEFT JOIN perkara_penetapan pen ON pen.perkara_id = p.perkara_id
        WHERE p.perkara_id = ? LIMIT 1`,
      [id]
    );
    if (!p) return { ok: false, alasan: "Perkara tidak ditemukan di SIPP." };
    const perkara = {
      perkaraId: Number(p.perkaraId),
      nomorPerkara: bersih(p.nomorPerkara),
      alurPerkaraId: Number(p.alurPerkaraId) || 0,
      jenisPerkaraId: Number(p.jenisPerkaraId) || 0,
      jenisPerkaraNama: bersih(p.jenisPerkaraNama),
      tanggalDaftar: tanggalSah(p.tanggalDaftar),
      tahapanId: Number(p.tahapanId) || 0,
      proses: bersih(p.proses),
      penetapanHariSidang: tanggalSah(p.penetapanHariSidang),
    };

    const [hari, jurnal, pihakMentah, jurusitaMentah, sidangMentah, relaasMentah, putusanMentah, pbtMentah, ikrarMentah, jenisMentah, mediasiMentah] =
      await Promise.all([
        saatBasisData().then((s) => s.slice(0, 10)),
        bacaJurnal(id),
        semua(
          `SELECT a.id, 1 AS ke, a.urutan, a.pihak_id AS pihakId, a.nama, ph.kecamatan, ph.kabupaten FROM perkara_pihak1 a LEFT JOIN pihak ph ON ph.id = a.pihak_id WHERE a.perkara_id = ?
           UNION ALL SELECT a.id, 2, a.urutan, a.pihak_id, a.nama, ph.kecamatan, ph.kabupaten FROM perkara_pihak2 a LEFT JOIN pihak ph ON ph.id = a.pihak_id WHERE a.perkara_id = ?
           UNION ALL SELECT a.id, 3, a.urutan, a.pihak_id, a.nama, ph.kecamatan, ph.kabupaten FROM perkara_pihak3 a LEFT JOIN pihak ph ON ph.id = a.pihak_id WHERE a.perkara_id = ?
           UNION ALL SELECT a.id, 4, a.urutan, a.pihak_id, a.nama, ph.kecamatan, ph.kabupaten FROM perkara_pihak4 a LEFT JOIN pihak ph ON ph.id = a.pihak_id WHERE a.perkara_id = ?`,
          [id, id, id, id]
        ),
        semua(
          `SELECT jurusita_id AS jurusitaId, jurusita_nama AS nama FROM perkara_jurusita
            WHERE perkara_id = ? AND aktif = 'Y' ORDER BY id ASC`,
          [id]
        ),
        semua(
          `SELECT id, urutan, DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggal, dihadiri_oleh AS dihadiriOleh,
                  ikrar_talak AS ikrar, agenda, ditunda, alasan_ditunda AS hasil
             FROM perkara_jadwal_sidang WHERE perkara_id = ? ORDER BY urutan ASC, tanggal_sidang ASC`,
          [id]
        ),
        semua(
          `SELECT id, sidang_id AS sidangId, pihak_id AS pihakId, ket_temu AS ket, no_resi_pos AS resi,
                  DATE_FORMAT(tanggal_relaas, '%Y-%m-%d') AS tanggalRelaas,
                  DATE_FORMAT(tanggal_jursit_pos, '%Y-%m-%d') AS tanggalJursitPos
             FROM perkara_pelaksanaan_relaas WHERE perkara_id = ? ORDER BY id ASC`,
          [id]
        ),
        satu(
          `SELECT DATE_FORMAT(pu.tanggal_putusan, '%Y-%m-%d') AS tanggal, pu.status_putusan_id AS statusId,
                  sp.nama AS statusNama, pu.putusan_verstek AS verstek
             FROM perkara_putusan pu LEFT JOIN status_putusan sp ON sp.id = pu.status_putusan_id
            WHERE pu.perkara_id = ? LIMIT 1`,
          [id]
        ),
        semua(
          `SELECT pihak AS pihakKe, pihak_id AS pihakRowId, ket_ketemu AS ket, no_resi_pos AS resi,
                  DATE_FORMAT(tanggal_jursit_pos, '%Y-%m-%d') AS tanggalJursitPos
             FROM perkara_putusan_pemberitahuan_putusan WHERE perkara_id = ? AND tahapan_id = ? AND putusan_akhir = 2`,
          [id, TAHAPAN]
        ).catch(() => []),
        satu(`SELECT DATE_FORMAT(tgl_ikrar_talak, '%Y-%m-%d') AS tanggal FROM perkara_ikrar_talak WHERE perkara_id = ? LIMIT 1`, [id]).catch(
          () => null
        ),
        semua(
          `SELECT jb.id, jb.nama, jb.kategori_id AS kategoriId, jb.jenis_transaksi AS jenisTransaksi, bp.jumlah AS jumlahBawaan,
                  kb.nama AS kategori
             FROM jenis_biaya jb
             JOIN biaya_perkara bp ON bp.jenis_biaya_id = jb.id AND bp.alur_perkara_id = ?
             LEFT JOIN kategori_biaya kb ON kb.id = jb.kategori_id
            WHERE jb.aktif = 'Y' AND jb.tahapan_id = ?
            ORDER BY jb.kategori_id, jb.id`,
          [perkara.alurPerkaraId, TAHAPAN]
        ),
        /* === K-KEJADIAN 11 Okt === kejadian mediasi (baca saja; tabel terdaftar di sippSkemaService) */
        semua(
          `SELECT mediasi_id AS id, DATE_FORMAT(penetapan_penunjukan_mediator, '%Y-%m-%d') AS tanggal,
                  DATE_FORMAT(keputusan_mediasi, '%Y-%m-%d') AS selesai, hasil_mediasi AS hasil
             FROM perkara_mediasi WHERE perkara_id = ? ORDER BY mediasi_id ASC`,
          [id]
        ).catch(() => []),
        /* === AKHIR K-KEJADIAN === */
      ]);

    const jenisBiaya = {};
    for (const j of jenisMentah) {
      jenisBiaya[Number(j.id)] = {
        id: Number(j.id),
        nama: bersih(j.nama),
        kategoriId: Number(j.kategoriId) || 0,
        kategori: bersih(j.kategori),
        jenisTransaksi: Number(j.jenisTransaksi) || -1,
        jumlahBawaan: angka(j.jumlahBawaan),
      };
    }
    const pihak = pihakMentah.map((x) => ({
      id: Number(x.id),
      ke: Number(x.ke),
      urutan: angka(x.urutan),
      pihakId: Number(x.pihakId) || 0,
      nama: bersih(x.nama),
      kecamatan: bersih(x.kecamatan),
      kabupaten: bersih(x.kabupaten),
    }));
    const pembiayaan = jurnal.length ? jurnal[jurnal.length - 1].pembiayaan : 1;

    const keadaan = {
      perkara,
      hariIni: hari,
      pembiayaan: jurnal.some((b) => b.pembiayaan !== 1) ? jurnal.find((b) => b.pembiayaan !== 1).pembiayaan : pembiayaan,
      jurnal,
      pihak,
      jurusita: jurusitaMentah.map((x) => ({ jurusitaId: Number(x.jurusitaId), nama: bersih(x.nama) })).filter((x) => x.jurusitaId > 0),
      sidang: sidangMentah.map((s) => ({
        id: Number(s.id),
        urutan: angka(s.urutan),
        tanggal: tanggalSah(s.tanggal),
        dihadiriOleh: s.dihadiriOleh === null || s.dihadiriOleh === undefined || s.dihadiriOleh === "" ? null : Number(s.dihadiriOleh),
        ikrar: bersih(s.ikrar).toUpperCase() === "Y",
        agenda: bersih(s.agenda),
        ditunda: bersih(s.ditunda).toUpperCase() === "Y",
        hasil: bersih(s.hasil),
      })),
      relaas: relaasMentah.map((r) => ({
        id: Number(r.id),
        sidangId: Number(r.sidangId) || 0,
        pihakId: Number(r.pihakId) || 0,
        ket: bersih(r.ket).toUpperCase(),
        resi: bersih(r.resi),
        tanggalRelaas: tanggalSah(r.tanggalRelaas),
        tanggalJursitPos: tanggalSah(r.tanggalJursitPos),
      })),
      putusan: putusanMentah && tanggalSah(putusanMentah.tanggal)
        ? {
            tanggal: tanggalSah(putusanMentah.tanggal),
            statusId: Number(putusanMentah.statusId) || 0,
            statusNama: bersih(putusanMentah.statusNama),
            verstek: bersih(putusanMentah.verstek).toUpperCase(),
          }
        : null,
      pemberitahuan: pbtMentah.map((x) => ({
        pihakKe: Number(x.pihakKe) || 0,
        pihakRowId: Number(x.pihakRowId) || 0,
        ket: bersih(x.ket).toUpperCase(),
        resi: bersih(x.resi),
        tanggalJursitPos: tanggalSah(x.tanggalJursitPos),
      })),
      ikrar: ikrarMentah && tanggalSah(ikrarMentah.tanggal) ? { tanggal: tanggalSah(ikrarMentah.tanggal) } : null,
      jenisBiaya,
      /* === K-KEJADIAN 11 Okt === */
      mediasi: (Array.isArray(mediasiMentah) ? mediasiMentah : [])
        .map((m) => ({ id: Number(m.id) || 0, tanggal: tanggalSah(m.tanggal), selesai: tanggalSah(m.selesai), hasil: bersih(m.hasil) }))
        .filter((m) => m.tanggal),
      /* === AKHIR K-KEJADIAN === */
    };
    keadaan.tarif = await muatTarif(keadaan);
    return { ok: true, keadaan };
  }

  /**
   * Tarif yang lazim, dipelajari dari jurnal satker sendiri 18 bulan terakhir:
   * per kecamatan & kabupaten pihak (panggilan/pemberitahuan pos), panggilan
   * RRI, dan jumlah terbanyak per jenis biaya pada alur perkara ini.
   */
  //
  // DUA kueri untuk SELURUH satker, disimpan enam jam - bukan empat kueri per
  // perkara. Diukur di sipp_donggala: bentuk per perkara dengan
  // DATE_SUB(CURDATE()) makan 9-17 detik tiap kali; dengan tanggal tegas dan
  // dikelompokkan sekali jalan 1-2 detik, lalu nol.
  let simpananTarif = null;
  async function petaTarifSatker(hariIni) {
    const sekarang = Date.now();
    if (simpananTarif && simpananTarif.hari === hariIni && sekarang - simpananTarif.saat < 6 * 3600 * 1000) return simpananTarif.isi;
    const [t, b, h] = (tanggalSah(hariIni) || "2026-01-01").split("-").map(Number);
    const dari = new Date(Date.UTC(t, b - 1 - 18, h)).toISOString().slice(0, 10);
    // Kebiasaan menomori pemohon ("Pemohon I/II") pada perkara berpemohon
    // lebih dari satu BERUBAH: Jan-Jul 2026 hampir selalu bernomor, Agustus
    // 2026 43 dari 60 polos. Yang diikuti kebiasaan 90 hari terakhir.
    const dariNomor = new Date(Date.UTC(t, b - 1, h - 90)).toISOString().slice(0, 10);
    const [pos, lazimMentah, nomorMentah] = await Promise.all([
      semua(
        `SELECT ph.kecamatan, ph.kabupaten, pb.jumlah,
                (pb.uraian LIKE '%RRI%') AS rri, (pb.uraian LIKE '%RRI%' OR pb.uraian LIKE '%PEMDA%') AS khusus, COUNT(*) AS n
           FROM perkara_biaya pb JOIN pihak ph ON ph.id = pb.pihak_id
          WHERE pb.tanggal_transaksi >= ? AND pb.jenis_biaya_id IN (12,13,14,15,29) AND pb.jumlah > 0
          GROUP BY ph.kecamatan, ph.kabupaten, pb.jumlah, rri, khusus`,
        [dari]
      ).catch(() => []),
      semua(
        `SELECT p.alur_perkara_id AS alur, pb.jenis_biaya_id AS jb, pb.jumlah, COUNT(*) AS n
           FROM perkara_biaya pb JOIN perkara p ON p.perkara_id = pb.perkara_id
          WHERE pb.tanggal_transaksi >= ? AND pb.urutan = 0 AND pb.tahapan_id = ? AND pb.jumlah > 0
            AND pb.jenis_biaya_id IN (152,157,236,237,253,260,388,389,404)
          GROUP BY p.alur_perkara_id, pb.jenis_biaya_id, pb.jumlah`,
        [dari, TAHAPAN]
      ).catch(() => []),
      semua(
        `SELECT SUM(pb.uraian REGEXP 'Pemohon [IV1-9]') AS bernomor, SUM(pb.uraian NOT REGEXP 'Pemohon [IV1-9]') AS polos
           FROM perkara_biaya pb
          WHERE pb.tanggal_transaksi >= ? AND pb.jenis_biaya_id = 253
            AND (SELECT COUNT(*) FROM perkara_pihak1 a WHERE a.perkara_id = pb.perkara_id) > 1`,
        [dariNomor]
      ).catch(() => []),
    ]);
    const nomor = nomorMentah[0] || {};
    const isi = {
      // null = tidak terukur -> bawaan bernomor (bentuk yang paling lama dipakai).
      nomorPemohon: Number(nomor.bernomor) + Number(nomor.polos) >= 5 ? Number(nomor.bernomor) >= Number(nomor.polos) : null,
      kecamatan: petaModal(pos.filter((x) => !Number(x.khusus)), (x) => bersih(x.kecamatan)),
      kabupaten: petaModal(pos.filter((x) => !Number(x.khusus)), (x) => bersih(x.kabupaten)),
      rri: petaModal(pos.filter((x) => Number(x.rri)), () => "rri").rri || null,
      lazim: petaModal(lazimMentah, (x) => `${Number(x.alur)}|${Number(x.jb)}`),
    };
    simpananTarif = { hari: hariIni, saat: sekarang, isi };
    return isi;
  }

  async function muatTarif(k) {
    const g = await petaTarifSatker(k.hariIni);
    const alur = Number(k.perkara.alurPerkaraId) || 0;
    const lazim = {};
    for (const [kunci, jumlah] of Object.entries(g.lazim)) {
      const [a, jb] = kunci.split("|");
      if (Number(a) === alur) lazim[jb] = jumlah;
    }
    const kecamatan = {};
    const kabupaten = {};
    for (const p of k.pihak) {
      if (p.kecamatan && g.kecamatan[p.kecamatan]) kecamatan[p.kecamatan] = g.kecamatan[p.kecamatan];
      if (p.kabupaten && g.kabupaten[p.kabupaten]) kabupaten[p.kabupaten] = g.kabupaten[p.kabupaten];
    }
    return { kecamatan, kabupaten, rri: g.rri, lazim, nomorPemohon: g.nomorPemohon };
  }

  /** Keadaan + usulan - jawaban GET /kasir. */
  async function usulanPerkara(perkaraId) {
    const baca = await bacaKeadaan(perkaraId);
    if (!baca.ok) return baca;
    const k = baca.keadaan;
    const hasil = susunUsulan(k);
    /* === K-KEJADIAN 11 Okt === usulan tersusun per kejadian + ringkasan lencana tab Kasir */
    const perKejadian = susunKejadian(k, hasil);
    /* === AKHIR K-KEJADIAN === */
    return {
      ok: true,
      kejadian: perKejadian.kejadian,
      ringkas: perKejadian.ringkas,
      perkara: k.perkara,
      hariIni: k.hariIni,
      pembiayaan: k.pembiayaan,
      jurnal: k.jurnal,
      saldo: hasil.saldo,
      pihak: k.pihak.map((p) => ({ id: p.id, ke: p.ke, pihakId: p.pihakId, nama: p.nama, urutan: p.urutan })),
      jurusita: k.jurusita,
      jenisBiaya: Object.values(k.jenisBiaya),
      usulan: hasil.usulan,
      catatan: hasil.catatan,
      sebutan: sebutanPerkara(k.perkara),
      // 1.189.x butir 1: keadaan perkara + biaya yang lazim padanya, untuk
      // kepala usulan di portal dan tab Kasir ekstensi.
      keadaan: keadaanPerkara(k),
    };
  }

  /**
   * ==========================================================================
   * KASIR OTOMATIS MASSAL SATU HARI (1.189.x butir 2) - HANYA SELECT
   * ==========================================================================
   *
   * Perkara yang "bergerak" pada tanggal itu - bersidang, diputus, ikrar talak,
   * penetapan hari sidang, atau suratnya diserahkan ke Pos sehari kerja
   * sebelumnya - dibaca satu per satu dengan mesin usulan yang SAMA dengan
   * Kasir per perkara. Yang usulan tercentangnya kosong disebut "sudah
   * lengkap", bukan dibuang diam-diam. Penulisannya tetap lewat POST /kasir,
   * satu perkara satu permintaan (layar yang mengurutkannya dengan jeda).
   */
  async function daftarHarian(tanggal, opsi = {}) {
    const hari = tanggalSah(tanggal) || (await saatBasisData()).slice(0, 10);
    const batas = Math.max(1, Math.min(150, Number(opsi.batas) || 120));
    let sebelum = geserHari(hari, -1);
    while (akhirPekan(sebelum)) sebelum = geserHari(sebelum, -1);
    const calon = await semua(
      `SELECT x.perkara_id AS perkaraId, GROUP_CONCAT(DISTINCT x.sebab ORDER BY x.sebab SEPARATOR ',') AS sebab
         FROM (
           SELECT perkara_id, 'sidang' AS sebab FROM perkara_jadwal_sidang WHERE tanggal_sidang = ?
           UNION ALL SELECT perkara_id, 'putusan' FROM perkara_putusan WHERE tanggal_putusan = ?
           UNION ALL SELECT perkara_id, 'ikrar' FROM perkara_ikrar_talak WHERE tgl_ikrar_talak = ?
           UNION ALL SELECT perkara_id, 'penetapan-hari-sidang' FROM perkara_penetapan WHERE penetapan_hari_sidang = ?
           UNION ALL SELECT perkara_id, 'surat-ke-pos' FROM perkara_pelaksanaan_relaas WHERE tanggal_jursit_pos = ?
         ) x
        GROUP BY x.perkara_id ORDER BY x.perkara_id ASC LIMIT ?`,
      [hari, hari, hari, hari, sebelum, batas + 1]
    );
    const terpotong = calon.length > batas;
    const daftar = [];
    const lengkap = [];
    const gagal = [];
    const antre = calon.slice(0, batas);
    // Empat sekaligus - tiap perkara sepuluh SELECT kecil; tarif satker disinggahkan.
    let ke = 0;
    const pekerja = async () => {
      while (ke < antre.length) {
        const c = antre[ke];
        ke += 1;
        try {
          const baca = await (deps.bacaKeadaan || bacaKeadaan)(c.perkaraId);
          if (!baca.ok) {
            gagal.push({ perkaraId: Number(c.perkaraId), alasan: baca.alasan });
            continue;
          }
          const k = baca.keadaan;
          const hasil = susunUsulan(k);
          const dipilih = hasil.usulan.filter((u) => u.pilih && (!u.sisaOtomatis || Number(u.jumlah) > 0));
          const ringkas = {
            perkaraId: k.perkara.perkaraId,
            nomorPerkara: k.perkara.nomorPerkara,
            jenisPerkara: k.perkara.jenisPerkaraNama,
            sebab: bersih(c.sebab).split(",").filter(Boolean),
            keadaan: keadaanPerkara(k),
            saldo: hasil.saldo,
          };
          if (!dipilih.length) {
            lengkap.push(ringkas);
            continue;
          }
          const perluPeriksa = dipilih.some((u) => u.perluResi || u.jumlah === null || u.yakin !== "tinggi" || !u.tersedia);
          daftar.push({
            ...ringkas,
            usulan: dipilih,
            ditawarkan: hasil.usulan.filter((u) => !u.pilih).length,
            catatan: hasil.catatan,
            perluPeriksa,
            saldoAkhir: hitungSisaOtomatis(dipilih.map((u) => ({ ...u })), hasil.saldo),
          });
        } catch (galat) {
          gagal.push({ perkaraId: Number(c.perkaraId), alasan: String((galat && galat.message) || galat).slice(0, 200) });
        }
      }
    };
    await Promise.all([pekerja(), pekerja(), pekerja(), pekerja()]);
    const urut = (a, b) => a.perkaraId - b.perkaraId;
    return {
      ok: true,
      tanggal: hari,
      perkara: daftar.sort(urut),
      lengkap: lengkap.sort(urut),
      gagal,
      terpotong,
      jumlahCalon: Math.min(calon.length, batas),
    };
  }

  /** Akun SIPP yang akan tercatat - username persis, atau nama lengkap yang tunggal. */
  async function akunPetugas(nama, ip) {
    const teks = bersih(nama);
    if (!teks || teks.length > 64) return { ok: false, alasan: "akun_sipp_tidak_disebut" };
    let akun = await satu(`SELECT username, fullname, block FROM sys_users WHERE username = ? LIMIT 1`, [teks]);
    if (!akun) {
      try {
        const lewatNama = await akunLewatNama(teks, ip);
        if (lewatNama && lewatNama.ganda) return { ok: false, alasan: "akun_sipp_ganda", calon: lewatNama.calon };
        if (lewatNama && lewatNama.username) {
          akun = await satu(`SELECT username, fullname, block FROM sys_users WHERE username = ? LIMIT 1`, [lewatNama.username]);
        }
      } catch {
        akun = null;
      }
    }
    if (!akun || !bersih(akun.username)) return { ok: false, alasan: "akun_sipp_tidak_ketemu", username: teks };
    if (String(akun.block ?? "0") !== "0") return { ok: false, alasan: "akun_sipp_diblokir", username: bersih(akun.username) };
    return { ok: true, username: bersih(akun.username), namaLengkap: bersih(akun.fullname) };
  }

  /**
   * Menyusun rencana tulis. Pagar blangko SIPP (validateInput) dikerjakan di
   * sini per baris, SEBELUM apa pun ditulis. Baris yang tidak lolos ditolak
   * sendiri-sendiri; yang lolos tetap direncanakan.
   */
  async function susunRencana(minta = {}) {
    const operator = bersih(minta.operator);
    if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };
    const baris = Array.isArray(minta.baris) ? minta.baris : [];
    if (!baris.length) return { ok: false, alasan: "Tidak ada baris jurnal yang dikirim." };
    if (baris.length > 30) return { ok: false, alasan: "Paling banyak 30 baris sekali simpan." };
    const ip = bersih(minta.ip).slice(0, 15);

    const akun = await akunPetugas(minta.akunSipp, ip);
    if (!akun.ok) return { ok: false, alasan: akun.alasan, akunSipp: akun.username || bersih(minta.akunSipp), calon: akun.calon };

    // deps.bacaKeadaan: pola daftarHarian (uji dan kasir otomatis memberi keadaan tiruan).
    const baca = await (deps.bacaKeadaan || bacaKeadaan)(minta.perkaraId);
    if (!baca.ok) return { ok: false, alasan: baca.alasan };
    const k = baca.keadaan;
    if (Number(k.pembiayaan) !== 1) {
      return { ok: false, alasan: "Perkara prodeo - jurnal prodeo diisi di SIPP." };
    }
    const hariIni = k.hariIni;
    const [th, bl, hr] = hariIni.split("-");
    const bebasAkhirPekan = Number(k.perkara.jenisPerkaraId) === JENIS_BEBAS_AKHIR_PEKAN;
    let totalPemasukan = k.jurnal.filter((b) => b.jenisTransaksi === 1).reduce((s, b) => s + b.jumlah, 0);
    const pihakSah = new Map(k.pihak.map((p) => [`${p.ke}|${p.pihakId}`, p]));
    const jurusitaSah = new Set(k.jurusita.map((j) => j.jurusitaId));
    const kunciAda = new Set(k.jurnal.map((b) => `${b.jenisBiayaId}|${b.pihakId}|${b.tanggal}|${b.uraian}|${b.jumlah}`));

    const langkah = [];
    const ditolak = [];
    const dilewati = [];

    baris.forEach((mentah, ke) => {
      const b = mentah && typeof mentah === "object" ? mentah : {};
      const tolak = (pesan) => ditolak.push({ ke, uraian: bersih(b.uraian).slice(0, 120), pesan });
      const tanggal = tanggalSah(b.tanggal);
      if (!tanggal) return tolak(PESAN.tanggal);
      const jbId = Number(b.jenisBiayaId);
      const jb = k.jenisBiaya[jbId];
      if (!jbId || !jb) return tolak(PESAN.jenis);
      if (jbId === JB.PANJAR) return tolak("Panjar Biaya Perkara dicatat saat pendaftaran - tidak dari Kasir ALETA.");
      const uraian = teksLatin1(b.uraian);
      if (!uraian) return tolak(PESAN.uraian);
      const jumlah = Math.round(Number(String(b.jumlah ?? "").replace(/\./g, "")));
      if (!Number.isFinite(jumlah) || jumlah <= 0) return tolak(PESAN.jumlah);
      const pk = Number(b.pihakKe);
      const pid = Number(b.pihakId);
      const p = pihakSah.get(`${pk}|${pid}`);
      if (!p) return tolak(PESAN.pihak);
      // Urutan pagar = urutan validateInput SIPP.
      if (tanggal > hariIni) return tolak(PESAN.melebihiHariIni(`${bl}/${hr}/${th}`));
      if (k.perkara.tanggalDaftar && tanggal < k.perkara.tanggalDaftar) return tolak(PESAN.sebelumDaftar);
      if (!bebasAkhirPekan && akhirPekan(tanggal)) return tolak(PESAN.libur);
      let jurusitaId = 0;
      if (KATEGORI_JURUSITA.has(jb.kategoriId)) {
        jurusitaId = Number(b.jurusitaId) || (k.jurusita[0] ? k.jurusita[0].jurusitaId : 0);
        if (!jurusitaId || !jurusitaSah.has(jurusitaId)) return tolak(PESAN.jurusita);
      }
      if (jb.jenisTransaksi < 0 && totalPemasukan - jumlah < 0) return tolak(PESAN.melebihiPanjar);
      if (jb.jenisTransaksi > 0) totalPemasukan += jumlah;
      const keterangan = teksLatin1(b.keterangan);
      const kunci = `${jbId}|${pid}|${tanggal}|${uraian}|${jumlah}`;
      if (kunciAda.has(kunci)) {
        dilewati.push({ ke, uraian, pesan: "baris yang sama persis sudah ada di jurnal SIPP - tidak dikirim lagi" });
        return;
      }
      kunciAda.add(kunci);

      const nilai = {
        id: TANDA_ID,
        id_pembiayaan: 1,
        perkara_id: k.perkara.perkaraId,
        general_id: 0,
        tahapan_id: TAHAPAN,
        kategori_id: jb.kategoriId,
        jenis_biaya_id: jbId,
        pihak_id: pid,
        pihak_ke: pk,
        jenis_transaksi: jb.jenisTransaksi,
        urutan: 0,
        sisa: 0,
        tanggal_transaksi: tanggal,
        uraian,
        jumlah,
        keterangan,
        diinput_oleh: akun.username.slice(0, 30),
        diinput_tanggal: TANDA_SAAT,
      };
      const kelompok = [
        {
          tabel: "perkara_biaya",
          aksi: "INSERT",
          sql: SQL_SISIP_BIAYA,
          params: KOLOM_BIAYA.map((kolom) => nilai[kolom]),
          keterangan: `jurnal ${tanggal} ${uraian} Rp${jumlah.toLocaleString("id-ID")} (${jb.jenisTransaksi > 0 ? "pemasukan" : "pengeluaran"})`.slice(0, 300),
        },
        {
          tabel: "sys_audittrail",
          aksi: "INSERT",
          sql: SQL_SISIP_AUDIT,
          params: [TANDA_SAAT, ip, akun.username.slice(0, 30), "perkara_biaya", NAMA_BORANG_AUDIT, "INSERT", judulAudit(TANDA_ID), keteranganAudit(nilai)],
          keterangan: `catatan audit Tambah Data Biaya atas nama ${akun.username}`,
        },
        {
          tabel: "perkara_biaya_jurusita",
          aksi: "DELETE",
          sql: "DELETE FROM perkara_biaya_jurusita WHERE perkara_biaya_id = ?",
          params: [TANDA_ID],
          keterangan: "set_jurusita SIPP: bersihkan juru sita baris ini",
        },
      ];
      if (jurusitaId > 0) {
        kelompok.push({
          tabel: "perkara_biaya_jurusita",
          aksi: "REPLACE",
          sql: "REPLACE INTO perkara_biaya_jurusita (perkara_biaya_id, jurusita_id) VALUES (?,?)",
          params: [TANDA_ID, jurusitaId],
          keterangan: `juru sita #${jurusitaId}`,
        });
      }
      langkah.push({ ke, nilai: { tanggal, jenisBiayaId: jbId, uraian, jumlah, pihakKe: pk, pihakId: pid, keterangan, jurusitaId }, kelompok });
    });

    return {
      ok: true,
      perkara: { perkaraId: k.perkara.perkaraId, nomorPerkara: k.perkara.nomorPerkara },
      akunSipp: { username: akun.username, namaLengkap: akun.namaLengkap },
      operator,
      ip,
      langkah,
      ditolak,
      dilewati,
    };
  }

  /** Daftar datar langkah - untuk jejak ALETA dan pratinjau. */
  function langkahDatar(rencana) {
    const hasil = [];
    for (const l of (rencana && rencana.langkah) || []) for (const x of l.kelompok) hasil.push(x);
    return hasil;
  }

  /**
   * Menjalankan rencana. Tiap baris jurnal berdiri sendiri: id = MAX(id)+1 dan
   * jam NOW() diambil SESUDAH jeda manusia, sedekat mungkin dengan tulisannya.
   * "tersimpan" hanya bila barisnya terbaca ulang.
   */
  async function jalankanRencana(rencana, opsi = {}) {
    if (!rencana || rencana.ok !== true) return { ok: false, alasan: (rencana && rencana.alasan) || "rencana_tidak_sah" };
    const kering = opsi.kering !== false;
    const rincian = rencana.langkah.map((l) => ({
      ke: l.ke,
      nilai: l.nilai,
      pernyataan: l.kelompok.map((x) => ({ tabel: x.tabel, aksi: x.aksi, keterangan: x.keterangan, sql: x.sql, nilai: x.params })),
    }));
    if (kering) return { ok: true, kering: true, jumlahBaris: rencana.langkah.length, rencana: rincian, hasil: [] };
    if (!rencana.langkah.length) return { ok: false, kering: false, alasan: "Tidak ada baris yang perlu ditulis.", hasil: [] };
    for (const x of langkahDatar(rencana)) {
      if (!DAFTAR_TABEL_KASIR.has(x.tabel)) return { ok: false, kering: false, alasan: "tabel_di_luar_daftar", tabel: x.tabel, hasil: [] };
    }

    const perkaraId = rencana.perkara.perkaraId;
    const hasil = [];
    const idTulis = [];
    let dikirim = 0;
    for (const l of rencana.langkah) {
      try {
        await jeda(dikirim ? "simpan" : "klik", { kering: false });
      } catch {
        /* jeda gagal - simpanan tetap berjalan */
      }
      dikirim += 1;
      /* === KASIR OTOMATIS 13 Okt === Pengembalian Sisa Panjar (opsi.periksaSisa):
       * ditulis hanya bila seluruh baris sebelumnya pada kiriman ini tercatat
       * (terkirim/sudah ada) DAN saldo jurnal SIPP saat ini persis sama dengan
       * jumlahnya - baris yang ditambah tangan di sela itu tidak membuat
       * pengembalian keliru jumlah. */
      if (opsi.periksaSisa && Number(l.nilai.jenisBiayaId) === JB.SISA) {
        const belum = hasil.filter((h) => h.keadaan !== "terkirim" && h.keadaan !== "sudah-ada");
        if (belum.length) {
          hasil.push({ ke: l.ke, id: 0, keadaan: "dilewati", pesan: "sisa panjar ditahan - baris lain pada kiriman ini belum tercatat" });
          continue;
        }
        const s = await satu(
          "SELECT COALESCE(SUM(jenis_transaksi * jumlah), 0) AS saldo FROM perkara_biaya WHERE perkara_id = ? AND tahapan_id = ?",
          [perkaraId, TAHAPAN]
        ).catch(() => null);
        const saldoKini = s ? Math.round(Number(s.saldo)) : NaN;
        if (saldoKini !== Math.round(Number(l.nilai.jumlah))) {
          hasil.push({
            ke: l.ke,
            id: 0,
            keadaan: "dilewati",
            pesan: Number.isFinite(saldoKini)
              ? `sisa panjar tidak ditulis - saldo jurnal SIPP sekarang Rp${saldoKini.toLocaleString("id-ID")}, bukan Rp${Number(l.nilai.jumlah).toLocaleString("id-ID")}`
              : "sisa panjar tidak ditulis - saldo jurnal SIPP tidak terbaca",
          });
          continue;
        }
      }
      /* === AKHIR KASIR OTOMATIS === */
      // Penekan kedua / tab SIPP yang menambah baris yang sama di sela itu
      // tidak melahirkan baris ganda. Kasir otomatis (opsi.sekaliPerJenis):
      // satu jenis biaya hari putus sekali per perkara (pemberitahuan: sekali
      // per pihak) - apa pun uraian/jumlahnya.
      const perPihak = JENIS_PER_PIHAK_OTOMATIS.has(Number(l.nilai.jenisBiayaId));
      const kembar = await (opsi.sekaliPerJenis
        ? satu(
            `SELECT id FROM perkara_biaya WHERE perkara_id = ? AND tahapan_id = ? AND jenis_biaya_id = ?${perPihak ? " AND pihak_id = ?" : ""} LIMIT 1`,
            perPihak ? [perkaraId, TAHAPAN, l.nilai.jenisBiayaId, l.nilai.pihakId] : [perkaraId, TAHAPAN, l.nilai.jenisBiayaId]
          )
        : satu(
            `SELECT id FROM perkara_biaya WHERE perkara_id = ? AND tahapan_id = ? AND jenis_biaya_id = ? AND pihak_id = ?
            AND tanggal_transaksi = ? AND jumlah = ? AND uraian = ? LIMIT 1`,
            [perkaraId, TAHAPAN, l.nilai.jenisBiayaId, l.nilai.pihakId, l.nilai.tanggal, l.nilai.jumlah, l.nilai.uraian]
          )
      ).catch(() => (opsi.sekaliPerJenis ? { id: -1 } : null));
      if (kembar) {
        hasil.push({
          ke: l.ke,
          id: Number(kembar.id),
          keadaan: "sudah-ada",
          pesan:
            Number(kembar.id) < 0
              ? "jurnal SIPP tidak terbaca - baris ini tidak dikirim (kasir otomatis tidak menebak)"
              : opsi.sekaliPerJenis
                ? "jenis biaya ini sudah tercatat untuk perkara ini - tidak dikirim lagi"
                : "baris yang sama persis sudah ada di jurnal SIPP - tidak dikirim lagi",
        });
        continue;
      }
      let id = 0;
      let saat = "";
      let langkahSelesai = 0;
      try {
        saat = await saatBasisData();
        // Sekelompok tulisan satu baris jurnal = satu transaksi (lihat transaksi()).
        await transaksi(async (lewat) => {
          const satuLewat = async (sql, params) => {
            const baris = await lewat(sql, params);
            return (Array.isArray(baris) && baris[0]) || null;
          };
          for (let coba = 0; coba < 2; coba += 1) {
            const m = await satuLewat("SELECT COALESCE(MAX(id), 0) + 1 AS maxid FROM perkara_biaya", []);
            id = Number(m && m.maxid) || 0;
            if (!id) throw new Error("id_berikutnya_tidak_terbaca");
            const isi = (v) => (v === TANDA_ID ? id : v === TANDA_SAAT ? saat : typeof v === "string" ? v.split(TANDA_ID).join(String(id)).split(TANDA_SAAT).join(saat) : v);
            try {
              await lewat(l.kelompok[0].sql, l.kelompok[0].params.map(isi));
              break;
            } catch (galat) {
              if (coba === 0 && /ER_DUP_ENTRY|Duplicate entry/i.test(String((galat && (galat.code || galat.message)) || ""))) continue;
              throw galat;
            }
          }
          langkahSelesai = 1;
          const isi = (v) => (v === TANDA_ID ? id : v === TANDA_SAAT ? saat : typeof v === "string" ? v.split(TANDA_ID).join(String(id)).split(TANDA_SAAT).join(saat) : v);
          for (const x of l.kelompok.slice(1)) {
            await lewat(x.sql, x.params.map(isi));
            langkahSelesai += 1;
          }
        });
        idTulis.push(id);
        hasil.push({ ke: l.ke, id, saat, keadaan: "terkirim", pesan: "" });
      } catch (galat) {
        const teknis = String((galat && galat.message) || galat).slice(0, 300);
        // dipulihkan true = transaksi dibatalkan utuh: tidak ada yang tertinggal.
        const utuhDibatalkan = galat && galat.dipulihkan === true;
        const tertinggal = langkahSelesai > 0 && !utuhDibatalkan;
        hasil.push({
          ke: l.ke,
          id: tertinggal ? id : 0,
          keadaan: tertinggal ? "sebagian" : "gagal",
          pesan: tertinggal
            ? `baris jurnal #${id} tertulis, langkah sesudahnya gagal: ${teknis}`
            : utuhDibatalkan && langkahSelesai > 0
              ? `tidak tersimpan - seluruh baris ini dibatalkan, tidak ada yang tertinggal di SIPP: ${teknis}`
              : teknis,
        });
        if (tertinggal) idTulis.push(id);
      }
    }

    let jurnalSesudah = null;
    try {
      jurnalSesudah = await bacaJurnal(perkaraId);
    } catch {
      jurnalSesudah = null;
    }
    const username = rencana.akunSipp.username;
    for (const h of hasil) {
      if (h.keadaan !== "terkirim") continue;
      const l = rencana.langkah.find((x) => x.ke === h.ke);
      const b = Array.isArray(jurnalSesudah) ? jurnalSesudah.find((x) => x.id === h.id) : null;
      const cocok = b && l && b.uraian === l.nilai.uraian && b.jumlah === l.nilai.jumlah && b.tanggal === l.nilai.tanggal && b.diinputOleh === username;
      h.keadaan = cocok ? "tersimpan" : "belum-terbaca";
      h.pesan = cocok
        ? "tersimpan dan terbaca ulang di jurnal SIPP"
        : jurnalSesudah
          ? "SIPP menerima, tetapi barisnya TIDAK terbaca ulang - periksa Buku Jurnal Keuangan SIPP"
          : "SIPP menerima; pembacaan ulang gagal";
    }
    const jumlah = (x) => hasil.filter((h) => h.keadaan === x).length;
    return {
      ok: jumlah("tersimpan") > 0 && !jumlah("gagal") && !jumlah("sebagian") && !jumlah("belum-terbaca"),
      kering: false,
      hasil,
      jurnalSesudah,
      ringkas: {
        tersimpan: jumlah("tersimpan"),
        belumTerbaca: jumlah("belum-terbaca"),
        sudahAda: jumlah("sudah-ada"),
        sebagian: jumlah("sebagian"),
        gagal: jumlah("gagal"),
        // Kasir otomatis 13 Okt: sisa panjar yang ditahan (opsi.periksaSisa).
        dilewati: jumlah("dilewati"),
      },
    };
  }

  return { cariPerkara, bacaJurnal, bacaKeadaan, muatTarif, usulanPerkara, daftarHarian, akunPetugas, susunRencana, jalankanRencana, langkahDatar };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  DAFTAR_TABEL_KASIR,
  NAMA_BORANG_AUDIT,
  KOLOM_BIAYA,
  SQL_SISIP_BIAYA,
  SQL_SISIP_AUDIT,
  JB,
  PESAN,
  KEADAAN_KASIR,
  buatLayanan,
  susunUsulan,
  /* === K-KEJADIAN 11 Okt === */
  susunKejadian,
  JB_TAMBAH_PANJAR,
  /* === AKHIR K-KEJADIAN === */
  keadaanPerkara,
  hitungSisaOtomatis,
  tanggalPatut,
  teksLatin1,
  keteranganAudit,
  judulAudit,
  /* === KASIR OTOMATIS 13 Okt === */
  JENIS_PER_PIHAK_OTOMATIS,
  putusanDariSidang,
  tanggalSah,
  layanan: () => layananBawaan(),
  /* === AKHIR KASIR OTOMATIS === */
  cariPerkara: (teks) => layananBawaan().cariPerkara(teks),
  usulanPerkara: (perkaraId) => layananBawaan().usulanPerkara(perkaraId),
  daftarHarian: (tanggal, opsi) => layananBawaan().daftarHarian(tanggal, opsi),
  susunRencana: (minta) => layananBawaan().susunRencana(minta),
  jalankanRencana: (rencana, opsi) => layananBawaan().jalankanRencana(rencana, opsi),
  langkahDatar: (rencana) => layananBawaan().langkahDatar(rencana),
};
