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

const JENIS_PANGGILAN = new Set([12, 13, 14, 15]);
const JENIS_PNBP_PERTAMA = new Set([236, 237, 253, 388]);
const KATEGORI_JURUSITA = new Set([4, 5, 6]);
const STATUS_CABUT = new Set([7, 67]);
const STATUS_DIKABULKAN = 62;
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
  // Longgar: baris yang tidak menunjuk pihak LAIN sekedudukan. Kasir kadang
  // memilih pihak keliru (458/2026: Biaya Pemberitahuan atas nama Penggugat)
  // - baris itu tetap menutup peristiwanya, bukan memancing usulan ganda.
  const cariAda = (saring, p) => {
    const calon = jurnal.filter((b) => !terpakai.has(b.id) && saring(b));
    const tepat = p ? calon.find((b) => Number(b.pihakId) === Number(p.pihakId)) : null;
    const lainSekedudukan = p ? new Set(pihak.filter((x) => x.ke === p.ke && x !== p).map((x) => Number(x.pihakId))) : new Set();
    const longgar = p ? calon.find((b) => !lainSekedudukan.has(Number(b.pihakId))) : calon[0];
    const hasil = tepat || longgar || null;
    if (hasil) terpakai.add(hasil.id);
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
      hasil.push({ sidang: s, relaas: r || null, ket, resi: r ? resiPos(r.resi) : "", ikrar, yakin, pilih, dasar });
    });
    return hasil;
  };

  for (const ke of kedudukanDipanggil) {
    for (const p of pihakKe(ke)) {
      const biasa = deretPanggilan(p, sidangBiasa, false);
      const ikrar = ke === 2 ? deretPanggilan(p, sidangIkrar, true) : [];
      peristiwaPanggil.set(Number(p.pihakId), { biasa, ikrar });
    }
  }

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
        const ada = cariAda((b) => jenisSendiri.includes(Number(b.jenisBiayaId)), p);
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
          }
        }
        for (const ev of deret) {
          if (tertutup.has(ev)) continue;
          const b = adaLama.find((x) => !terpakai.has(x.id));
          if (b) {
            terpakai.add(b.id);
            tertutup.add(ev);
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
      if (cariAda((b) => Number(b.jenisBiayaId) === jb, null)) return;
      tambah({ jenisBiayaId: jb, pihakKe: 1, pihakId: Number(pembayar.pihakId), uraian, jumlah: lazim(jb), tanggal: tPut, peristiwa, dasar, kelompok });
    };
    satu(JB.REDAKSI, 50, "Putusan", `putusan ${tPut}`, "Redaksi");
    satu(JB.METERAI, 51, "Putusan", `putusan ${tPut}`, "Meterai");
    if (cabut) satu(JB.PNBP_CABUT, 52, "Pencabutan perkara", `putusan ${tPut} berstatus dicabut`, "PNBP Surat Permohonan Pencabutan Perkara");

    if (!cabut && (hadirPutus === 3 || hadirPutus === 4) && pembayar) {
      if (!cariAda((b) => Number(b.jenisBiayaId) === JB.PNBP_PBT_P, null)) {
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
          pilih: hadirPutus === 3,
          kelompok: 53,
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
        const pilihPbt = berbiaya && (verstek || ket === "S" || ket === "P" || (tanpaStatus && hadirPutus === 2));
        const yakin = pilihPbt ? "tinggi" : "sedang";
        const dasar = verstek
          ? `putusan verstek ${tPut}`
          : tanpaStatus
            ? `${sebutan.dua} tidak hadir pada sidang putusan ${tPut} (status putusan belum tertulis)`
            : `${sebutan.dua} tidak hadir pada sidang putusan ${tPut} (bukan verstek)`;
        if (!["W", "M", "R"].includes(ket)) {
          if (!cariAda((b) => Number(b.jenisBiayaId) === JB.PEMBERITAHUAN, p)) {
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
            });
          }
        }
        if (!cariAda((b) => Number(b.jenisBiayaId) === JB.PNBP_PBT_T, p)) {
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
          });
        }
      });
    }

    // Sisa panjar - selalu terakhir, selalu menghabiskan saldo.
    const sudahSisa = jurnal.some((b) => Number(b.jenisBiayaId) === JB.SISA);
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
  const saldoAkhir = hitungSisaOtomatis(usulan, saldo);
  if (sisa && !(sisa.jumlah > 0)) {
    sisa.pilih = false;
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
  return { usulan, catatan, saldo, saldoAkhir };
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
      : (kerja) =>
          new Promise((selesai, gagal) => {
            const kolam = require("../db_config");
            if (typeof kolam.getConnection !== "function") {
              gagal(new Error("kolam sambungan SIPP tidak mendukung transaksi"));
              return;
            }
            kolam.getConnection(async (galatSambung, sambungan) => {
              if (galatSambung) {
                gagal(galatSambung);
                return;
              }
              const lewat = (sql, params = []) =>
                new Promise((ok, no) => sambungan.query(sql, params, (g, r) => (g ? no(g) : ok(r))));
              try {
                await lewat("START TRANSACTION");
                const hasil = await kerja(lewat);
                await lewat("COMMIT");
                selesai({ hasil, dipulihkan: null });
              } catch (galat) {
                const dipulihkan = await lewat("ROLLBACK").then(
                  () => true,
                  () => false
                );
                galat.dipulihkan = dipulihkan;
                gagal(galat);
              } finally {
                try {
                  sambungan.release();
                } catch {
                  // sambungan yang sudah putus tidak perlu dilepas
                }
              }
            });
          }));
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

    const [hari, jurnal, pihakMentah, jurusitaMentah, sidangMentah, relaasMentah, putusanMentah, pbtMentah, ikrarMentah, jenisMentah] =
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
    return {
      ok: true,
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

    const baca = await bacaKeadaan(minta.perkaraId);
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
      // Penekan kedua / tab SIPP yang menambah baris yang sama di sela itu
      // tidak melahirkan baris ganda.
      const kembar = await satu(
        `SELECT id FROM perkara_biaya WHERE perkara_id = ? AND tahapan_id = ? AND jenis_biaya_id = ? AND pihak_id = ?
            AND tanggal_transaksi = ? AND jumlah = ? AND uraian = ? LIMIT 1`,
        [perkaraId, TAHAPAN, l.nilai.jenisBiayaId, l.nilai.pihakId, l.nilai.tanggal, l.nilai.jumlah, l.nilai.uraian]
      ).catch(() => null);
      if (kembar) {
        hasil.push({ ke: l.ke, id: Number(kembar.id), keadaan: "sudah-ada", pesan: "baris yang sama persis sudah ada di jurnal SIPP - tidak dikirim lagi" });
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
      },
    };
  }

  return { cariPerkara, bacaJurnal, bacaKeadaan, muatTarif, usulanPerkara, akunPetugas, susunRencana, jalankanRencana, langkahDatar };
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
  buatLayanan,
  susunUsulan,
  hitungSisaOtomatis,
  tanggalPatut,
  teksLatin1,
  keteranganAudit,
  judulAudit,
  cariPerkara: (teks) => layananBawaan().cariPerkara(teks),
  usulanPerkara: (perkaraId) => layananBawaan().usulanPerkara(perkaraId),
  susunRencana: (minta) => layananBawaan().susunRencana(minta),
  jalankanRencana: (rencana, opsi) => layananBawaan().jalankanRencana(rencana, opsi),
  langkahDatar: (rencana) => layananBawaan().langkahDatar(rencana),
};
