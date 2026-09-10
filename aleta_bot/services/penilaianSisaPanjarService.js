"use strict";

/**
 * ============================================================================
 * SISA PANJAR YANG BELUM DIKEMBALIKAN
 * ============================================================================
 *
 * Panjar biaya perkara adalah uang pihak, bukan uang pengadilan. Bila perkara
 * sudah selesai dan panjarnya masih bersisa, sisa itu wajib dikembalikan.
 * Sisa yang mengendap bukan sekadar catatan yang belum rapi - ia uang orang
 * yang belum kembali kepada pemiliknya.
 *
 * ============================================================================
 * MENGAPA PENILAIAN INI BERBEDA DARI KU02
 * ============================================================================
 *
 * KU02 - pengeluaran tidak melebihi penerimaan - menjaga agar perkara tidak
 * dibelanjakan melebihi panjarnya. Butir ini menjaga arah sebaliknya: panjar
 * yang tersisa harus kembali.
 *
 * Keduanya perlu, dan keduanya menemukan hal yang berbeda. Perkara dapat lulus
 * KU02 dengan sempurna - tidak sekali pun melebihi - sambil menahan sisa
 * panjar bertahun-tahun.
 *
 * ============================================================================
 * HANYA PERKARA YANG SUDAH SELESAI
 * ============================================================================
 *
 * Perkara yang masih berjalan memang seharusnya menyimpan sisa panjar - itu
 * bekal untuk tahapan berikutnya. Menilainya bersama perkara yang sudah
 * selesai akan menuduh kasir atas uang yang justru belum boleh dikeluarkan.
 *
 * Karena itu penyebutnya hanya perkara yang sudah DIMINUTASI. Yang belum
 * dikeluarkan dari penyebut, bukan dihitung gagal.
 *
 * ============================================================================
 * URAIAN TRANSAKSI TIDAK DIPAKAI SAMA SEKALI
 * ============================================================================
 *
 * `perkara_biaya.uraian` diketik bebas kasir - pengukuran menemukan 8.554
 * tulisan berbeda pada 100.108 baris. Penilaian yang dibangun di atasnya akan
 * menghitung ejaan, bukan jenis transaksi. Yang dipakai hanya ruas berkode:
 * jenis_transaksi, jumlah, dan tanggalnya.
 */

const db = require("../db_config");

/** Pembungkus baca, sebentuk dengan layanan penilaian lain. */
function runQuery(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => {
      if (galat) gagal(galat);
      else selesai(Array.isArray(hasil) ? hasil : []);
    });
  });
}

const kerangka = require("./kerangkaPenilaianService");

const BATAS_BARIS = 20000;

/**
 * Ambang rupiah di bawah mana sisa dianggap nol.
 *
 * Pembulatan sen pada penjumlahan dapat menyisakan angka sangat kecil yang
 * bukan sisa sungguhan. Seribu rupiah dipilih sebagai batas yang jelas di
 * bawah nilai transaksi terkecil mana pun, dan ditulis terbuka di sini supaya
 * dapat dibantah - bukan disembunyikan di dalam perbandingan.
 */
const AMBANG_SISA_RUPIAH = 1000;

function teks(v) {
  return v === null || v === undefined ? "" : String(v);
}

function angka(v) {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const KUERI = `SELECT p.nomor_perkara AS nomorPerkara,
                      p.perkara_id AS perkaraId,
                      p.jenis_perkara_nama AS jenisPerkara,
                      (SELECT MIN(m.tanggal_minutasi) FROM perkara_putusan m WHERE m.perkara_id = p.perkara_id) AS tanggalMinutasi,
                      SUM(CASE WHEN b.jenis_transaksi = 1 THEN b.jumlah ELSE 0 END) AS totalPenerimaan,
                      SUM(CASE WHEN b.jenis_transaksi <> 1 THEN b.jumlah ELSE 0 END) AS totalPengeluaran,
                      COUNT(b.id) AS jumlahTransaksi
                 FROM perkara p
                 LEFT JOIN perkara_biaya b ON b.perkara_id = p.perkara_id
                WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
                GROUP BY p.nomor_perkara, p.perkara_id, p.jenis_perkara_nama
                ORDER BY p.nomor_perkara ASC
                LIMIT ${BATAS_BARIS}`;

async function barisSisaPanjar(rentang) {
  const hasil = await runQuery(KUERI, [rentang.mulai, rentang.selesai]);

  return hasil
    .map((r) => {
      // Perkara yang belum diminutasi memang seharusnya menyimpan sisa -
      // itu bekal tahapan berikutnya. Dikeluarkan dari penyebut.
      if (!r.tanggalMinutasi) return null;

      const masuk = angka(r.totalPenerimaan) || 0;
      const keluar = angka(r.totalPengeluaran) || 0;
      const jumlahTransaksi = angka(r.jumlahTransaksi) || 0;

      // Perkara tanpa satu pun transaksi bukan "sisa nol" - ia perkara yang
      // keuangannya belum tercatat sama sekali, dan itu urusan butir lain
      // (panjar tercatat pada setiap perkara). Dikeluarkan dari sini supaya
      // tidak dihitung dua kali sebagai temuan yang sama.
      if (jumlahTransaksi === 0) return null;

      const sisa = masuk - keluar;
      const bersisa = sisa > AMBANG_SISA_RUPIAH;
      const minus = sisa < -AMBANG_SISA_RUPIAH;

      return {
        kunci: `${teks(r.nomorPerkara)}#KU03`,
        nomorPerkara: teks(r.nomorPerkara),
        jenisPerkara: teks(r.jenisPerkara),
        tanggalMinutasi: teks(r.tanggalMinutasi).slice(0, 10),
        totalPenerimaan: masuk,
        totalPengeluaran: keluar,
        sisaPanjar: sisa,
        jumlahTransaksi,
        memenuhi: !bersisa && !minus,
        sebabTidakMemenuhi: bersisa
          ? `sisa ${sisa.toLocaleString("id-ID")} rupiah belum dikembalikan`
          : minus
            ? `pengeluaran melebihi penerimaan sebesar ${Math.abs(sisa).toLocaleString("id-ID")} rupiah`
            : "",
      };
    })
    .filter(Boolean);
}

/**
 * Penjaga pendaftaran ganda.
 *
 * Rute gerbang memanggil daftarkanSemua() pada TIAP permintaan, dan
 * kerangka menolak kunci yang sudah terdaftar - dengan sengaja, sebab dua
 * penilaian berkunci sama akan saling menimpa riwayatnya.
 *
 * Tanpa penjaga ini, permintaan KEDUA dan seterusnya selalu gagal dengan
 * pesan "sudah terdaftar", dan permintaan pertama sesudah bot dinyalakan
 * selalu berhasil. Bentuk kegagalan seperti itu hampir mustahil ditemukan
 * dari laporan pengguna: yang mencobanya sekali akan melihatnya jalan.
 */
let sudahDidaftar = false;
function daftarkanSemua() {
  if (sudahDidaftar) return;
  kerangka.daftarkan({
    kunci: "sisaPanjarSudahDikembalikan",
    judul: "Sisa Panjar Sudah Dikembalikan",
    keterangan:
      "Perkara yang sudah diminutasi tidak lagi menyimpan sisa panjar. Panjar adalah uang pihak, dan sisa yang mengendap berarti uang orang yang belum kembali kepada pemiliknya.",
    lantai: "bulanan",
    versiRumus: "sisaPanjar-v1",
    caraHitung: {
      pembilang: `Perkara yang selisih penerimaan dan pengeluarannya tidak lebih dari ${AMBANG_SISA_RUPIAH} rupiah ke arah mana pun`,
      penyebut:
        "Perkara yang sudah diminutasi DAN punya sekurangnya satu transaksi keuangan tercatat",
      dikecualikan:
        "Perkara yang belum diminutasi - ia memang seharusnya menyimpan sisa sebagai bekal tahapan berikutnya. Juga perkara tanpa satu pun transaksi, sebab itu temuan butir lain dan menghitungnya di sini berarti satu keadaan dihitung dua kali",
      tabelSumber: "perkara sebagai induk, perkara_biaya untuk transaksinya, perkara_putusan untuk tanggal minutasinya",
      ruasSumber: "jenis_transaksi, jumlah, tanggal_minutasi - seluruhnya berkode; uraian yang diketik bebas tidak dipakai sama sekali",
    },
    baris: barisSisaPanjar,
  });
  sudahDidaftar = true;
}

function namaSippDipakai() {
  return {
    tabel: ["perkara", "perkara_biaya", "perkara_putusan"],
    ruas: [
      "jenis_perkara_nama",
      "jenis_transaksi",
      "jumlah",
      "nomor_perkara",
      "perkara_id",
      "tanggal_minutasi",
      "tanggal_pendaftaran",
    ],
  };
}

module.exports = { AMBANG_SISA_RUPIAH, KUERI, daftarkanSemua, barisSisaPanjar, namaSippDipakai };
