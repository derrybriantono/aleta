"use strict";

/**
 * ============================================================================
 * KEUANGAN PERKARA - SISA BAB 8 KATALOG
 * ============================================================================
 *
 * Sebelas butir dari tiga belas yang tersisa. Dua yang tidak disambungkan
 * diperiksa pada basis datanya, bukan diduga:
 *
 *   KU14 uang titipan pihak ketiga. Konsinyasi tidak punya satu pun tabel
 *        pada SIPP satuan kerja ini - diperiksa dengan mencari tabel bernama
 *        konsinyasi, titipan, dan sejenisnya. Tidak ada.
 *
 *   KU15 uang persediaan kepaniteraan. Juga tidak punya tabel. Uang persediaan
 *        dibukukan pada aplikasi keuangan satuan kerja, bukan pada SIPP.
 *
 * ============================================================================
 * SATU ARAH TRANSAKSI YANG WAJIB DIINGAT
 * ============================================================================
 *
 * perkara_biaya.jenis_transaksi bernilai 1 untuk uang MASUK dan -1 untuk uang
 * KELUAR. Bukan 'D' dan 'K', bukan 'debet' dan 'kredit' - keduanya sempat
 * ditebak dan keduanya salah.
 *
 * Menjumlahkan kolom jumlah tanpa memperhatikan tandanya menghasilkan angka
 * yang selalu terlalu besar dan selalu tampak masuk akal: pada rentang yang
 * diukur, penerimaan Rp655 juta dan pengeluaran Rp605 juta akan menjadi
 * "Rp1,26 miliar" tanpa satu pun galat.
 *
 * ============================================================================
 * YANG DITEMUKAN SAAT MENGUKUR
 * ============================================================================
 *
 * Kolom `sisa` - saldo berjalan yang dicatat SIPP sendiri - hanya terisi pada
 * 3.695 dari 4.948 transaksi. Pada 1.253 transaksi sisanya, buku jurnal tidak
 * punya saldo berjalan sama sekali, sehingga tidak ada yang dapat disandingkan
 * dengan hitungan mana pun.
 *
 * Dua ratus delapan belas transaksi bernilai NOL rupiah. Transaksi nol bukan
 * transaksi; ia baris yang dibuat lalu ditinggalkan.
 *
 * Biaya panggilan pada kecamatan yang sama berbeda-beda - dari nol sampai
 * empat ratus ribu di dalam satu kode kecamatan. Radius ditetapkan dengan
 * surat keputusan ketua, dan besaran yang berbeda di dalam satu radius berarti
 * salah satunya tidak menurut surat itu.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

const BATAS_BARIS = 5000;

/** Uang masuk dan uang keluar pada perkara_biaya. */
const TRANSAKSI_MASUK = 1;
const TRANSAKSI_KELUAR = -1;

/**
 * Berapa hari sesudah tanggal transaksi sebuah baris masih wajar diinput.
 * Buku jurnal keuangan perkara ditutup tiap bulan; baris yang diketik jauh
 * sesudahnya berarti penutupan bulan itu dilakukan atas buku yang belum
 * lengkap.
 */
const HARI_WAJAR_INPUT_TRANSAKSI = 30;

/**
 * Berapa banyak perkara yang dibutuhkan pada satu kecamatan sebelum besaran
 * panggilannya dapat disebut punya "kebiasaan". Di bawah ini, satu perkara
 * saja sudah menjadi seluruh kebiasaannya.
 */
const MINIMAL_PERKARA_KECAMATAN = 5;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, hasil) => {
      if (error) reject(error);
      else resolve(Array.isArray(hasil) ? hasil : []);
    });
  });
}

const teks = (n) => String(n == null ? "" : n).trim();
const angka = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};
const rupiah = (n) => `Rp${Math.round(angka(n)).toLocaleString("id-ID")}`;

function tanggalTerisi(nilai) {
  const t = teks(nilai);
  if (!t) return false;
  if (/^0000-00-00/.test(t)) return false;
  return true;
}

function selisihHari(awal, akhir) {
  if (!tanggalTerisi(awal) || !tanggalTerisi(akhir)) return null;
  const a = new Date(awal);
  const b = new Date(akhir);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

function tanggalIso(nilai) {
  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) {
    const b = String(nilai.getMonth() + 1).padStart(2, "0");
    const h = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${b}-${h}`;
  }
  return teks(nilai).slice(0, 10);
}

function bulanDari(nilai) {
  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) {
    return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}`;
  }
  return teks(nilai).slice(0, 7);
}

async function tabelSiap(daftar) {
  for (const t of daftar) {
    const ada = await sippSkemaService.tabelAda(t).catch(() => false);
    if (!ada) return false;
  }
  return true;
}

/**
 * Seluruh transaksi keuangan atas perkara pada satu rentang, berurutan waktu.
 *
 * Dipakai bersama oleh enam butir. Ditulis satu kali sebab enam tempat yang
 * masing-masing menyusun arah transaksinya sendiri akan menghasilkan enam
 * angka saldo yang berbeda - dan seluruhnya tampak masuk akal.
 */
async function muatTransaksi(rentang) {
  return runQuery(
    `SELECT b.id                  AS transaksiId,
            p.perkara_id          AS perkaraId,
            p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            b.tanggal_transaksi   AS tanggalTransaksi,
            b.jenis_transaksi     AS arah,
            b.jumlah              AS jumlah,
            b.sisa                AS sisaTercatat,
            b.uraian              AS uraian,
            b.jenis_biaya_id      AS jenisBiayaId,
            j.nama                AS jenisBiaya,
            j.kategori_id         AS kategoriId,
            k.nama                AS kategori,
            b.diinput_tanggal     AS diinputTanggal
       FROM perkara p
       JOIN perkara_biaya b ON b.perkara_id = p.perkara_id
       LEFT JOIN jenis_biaya j ON j.id = b.jenis_biaya_id
       LEFT JOIN kategori_biaya k ON k.id = j.kategori_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY b.tanggal_transaksi, b.id
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );
}

/** Tanda hitung: +jumlah untuk masuk, -jumlah untuk keluar. */
function bertanda(baris) {
  const n = angka(baris.jumlah);
  return angka(baris.arah) === TRANSAKSI_KELUAR ? -n : n;
}

/**
 * ============================================================================
 * KU04 - KEKURANGAN PANJAR, DAN SISA YANG TIDAK DIKEMBALIKAN
 * ============================================================================
 *
 * Dua keadaan yang sama-sama salah, dan keduanya diperiksa di sini:
 *
 *   saldo NEGATIF   panjarnya habis sebelum perkaranya selesai, dan sisanya
 *                   ditalangi entah oleh siapa
 *   saldo POSITIF pada perkara yang SUDAH DIPUTUS   sisa panjar yang belum
 *                   dikembalikan kepada pihak
 *
 * Yang kedua lebih sering terjadi dan lebih jarang ketahuan: uangnya tetap
 * ada, tercatat rapi, dan tidak ada yang menagihnya kecuali pihaknya sendiri
 * datang bertanya.
 *
 * Diukur pada SIPP sungguhan: tidak satu pun dari 431 perkara bersaldo
 * negatif, dan 372 berakhir tepat nol.
 */
async function barisKecukupanPanjar(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_biaya", "perkara_putusan"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            d.tanggal_putusan    AS tanggalPutusan,
            COALESCE(SUM(CASE WHEN b.jenis_transaksi = ${TRANSAKSI_MASUK}
                              THEN b.jumlah ELSE -b.jumlah END), 0)  AS saldo,
            SUM(CASE WHEN k.nama LIKE '%Sisa Panjar%' THEN 1 ELSE 0 END) AS adaPengembalian
       FROM perkara p
       LEFT JOIN perkara_biaya b ON b.perkara_id = p.perkara_id
       LEFT JOIN jenis_biaya j ON j.id = b.jenis_biaya_id
       LEFT JOIN kategori_biaya k ON k.id = j.kategori_id
       LEFT JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, d.tanggal_putusan
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const saldo = angka(x.saldo);
    const diputus = tanggalTerisi(x.tanggalPutusan);
    const adaKembali = angka(x.adaPengembalian) > 0;
    const sebab = [];

    if (saldo < 0) {
      sebab.push(
        `panjarnya kurang ${rupiah(-saldo)} - pengeluaran melampaui penerimaan, dan kekurangannya ditalangi entah oleh siapa`
      );
    } else if (diputus && saldo > 0 && !adaKembali) {
      sebab.push(
        `sudah diputus tetapi masih bersisa ${rupiah(
          saldo
        )} tanpa satu pun transaksi pengembalian sisa panjar - uangnya tetap ada dan tidak ada yang menagihnya kecuali pihaknya datang bertanya`
      );
    }

    return {
      kunci: `${teks(x.nomorPerkara)}#KU04`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      saldo,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * KU05 - PENERIMAAN NEGARA BUKAN PAJAK
 * ============================================================================
 *
 * Tiap perkara yang didaftarkan menimbulkan PNBP pendaftaran. Perkara tanpa
 * baris PNBP berarti penerimaan negara yang tidak tercatat - dan angka setoran
 * ke kas negara disusun dari baris-baris itu.
 *
 * Perkara PRODEO dikecualikan: pembebasan biaya memang meniadakan PNBP-nya,
 * dan menghitungnya gagal berarti menuduh pengadilan lalai atas sesuatu yang
 * justru benar.
 *
 * Diukur pada SIPP sungguhan: 30 perkara tanpa PNBP pendaftaran, dan 30 pula
 * yang bertanda prodeo - keduanya cocok.
 */
async function barisPnbp(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_biaya", "jenis_biaya", "kategori_biaya"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.prodeo             AS prodeo,
            COALESCE(SUM(CASE WHEN k.nama LIKE '%PNBP%' OR j.nama LIKE '%PNBP%'
                              THEN b.jumlah ELSE 0 END), 0)          AS jumlahPnbp,
            SUM(CASE WHEN j.nama LIKE '%Pendaftaran%' THEN 1 ELSE 0 END) AS adaPendaftaran
       FROM perkara p
       LEFT JOIN perkara_biaya b ON b.perkara_id = p.perkara_id
       LEFT JOIN jenis_biaya j ON j.id = b.jenis_biaya_id
       LEFT JOIN kategori_biaya k ON k.id = j.kategori_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, p.prodeo
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil
    .filter((x) => angka(x.prodeo) !== 1)
    .map((x) => {
      const adaPendaftaran = angka(x.adaPendaftaran) > 0;

      return {
        kunci: `${teks(x.nomorPerkara)}#KU05`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: teks(x.jenisPerkara),
        jumlahPnbp: angka(x.jumlahPnbp),
        memenuhi: adaPendaftaran,
        sebabTidakMemenuhi: adaPendaftaran
          ? ""
          : "tidak punya baris PNBP pendaftaran dan bukan perkara prodeo - penerimaan negara yang tidak tercatat, sedangkan angka setoran ke kas negara disusun dari baris itu",
      };
    });
}

/**
 * ============================================================================
 * KU06 - BIAYA PEMANGGILAN MENURUT RADIUS
 * ============================================================================
 *
 * Radius ditetapkan dengan surat keputusan ketua pengadilan, dan SIPP tidak
 * menyimpan surat itu. Yang dapat diperiksa tanpa suratnya: apakah besaran
 * panggilan KONSISTEN di dalam satu kecamatan.
 *
 * Dua perkara dari kecamatan yang sama semestinya dikenakan panggilan yang
 * sama. Kalau berbeda, salah satunya tidak menurut surat keputusan - dan
 * selisihnya ditanggung atau diterima pihak tanpa dasar.
 *
 * BATASNYA HARUS IKUT TERBACA: satu kecamatan dapat memuat desa yang jauh
 * berbeda jaraknya, dan sebagian surat keputusan memang menetapkan radius per
 * desa. Yang tidak memenuhi di sini berarti PANTAS DIPERIKSA, bukan terbukti
 * keliru.
 *
 * Diukur pada SIPP sungguhan: di dalam satu kode kecamatan, besaran panggilan
 * berkisar dari nol sampai empat ratus ribu.
 */
async function barisRadiusPanggilan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_biaya", "jenis_biaya", "kategori_biaya", "perkara_pihak1", "pihak"]))) {
    return [];
  }

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            h.kecamatan          AS kecamatan,
            MAX(b.jumlah)        AS panggilanTertinggi
       FROM perkara p
       JOIN perkara_biaya b ON b.perkara_id = p.perkara_id
       JOIN jenis_biaya j ON j.id = b.jenis_biaya_id
       JOIN kategori_biaya k ON k.id = j.kategori_id
       JOIN perkara_pihak1 pp ON pp.perkara_id = p.perkara_id
       JOIN pihak h ON h.id = pp.pihak_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND k.nama LIKE '%Panggilan%'
        AND b.jumlah > 0
        AND h.kecamatan IS NOT NULL AND TRIM(h.kecamatan) <> ''
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, h.kecamatan
      ORDER BY h.kecamatan
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  // Besaran yang paling sering muncul pada tiap kecamatan - itulah yang
  // dianggap menurut surat keputusan. Modus, bukan rerata: rerata akan
  // bergeser mengikuti satu perkara yang keliru, sedangkan modus tidak.
  const perKecamatan = new Map();
  hasil.forEach((x) => {
    const kec = teks(x.kecamatan);
    if (!perKecamatan.has(kec)) perKecamatan.set(kec, new Map());
    const hitung = perKecamatan.get(kec);
    const n = angka(x.panggilanTertinggi);
    hitung.set(n, (hitung.get(n) || 0) + 1);
  });

  const modus = new Map();
  perKecamatan.forEach((hitung, kec) => {
    let terbanyak = null;
    let jumlah = 0;
    let total = 0;
    hitung.forEach((n, nilai) => {
      total += n;
      if (n > jumlah) {
        jumlah = n;
        terbanyak = nilai;
      }
    });
    modus.set(kec, { nilai: terbanyak, total });
  });

  return hasil
    .filter((x) => {
      const m = modus.get(teks(x.kecamatan));
      return m && m.total >= MINIMAL_PERKARA_KECAMATAN;
    })
    .map((x) => {
      const kec = teks(x.kecamatan);
      const m = modus.get(kec);
      const nilai = angka(x.panggilanTertinggi);
      const sama = nilai === m.nilai;

      return {
        kunci: `${teks(x.nomorPerkara)}#KU06`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: teks(x.jenisPerkara),
        kecamatan: kec,
        biayaPanggilan: nilai,
        biayaLazim: m.nilai,
        memenuhi: sama,
        sebabTidakMemenuhi: sama
          ? ""
          : `panggilan ${rupiah(nilai)} sedangkan kecamatan ${kec} lazimnya ${rupiah(
              m.nilai
            )} - pantas diperiksa, bukan terbukti keliru: satu kecamatan dapat memuat desa yang jauh berbeda jaraknya`,
      };
    });
}

/**
 * ============================================================================
 * KU07 - TRANSAKSI KEUANGAN HARIAN
 * ============================================================================
 *
 * Tiap baris buku jurnal harus dapat berdiri sendiri: bertanggal, bergolongan,
 * beruraian, dan bernilai. Transaksi bernilai NOL bukan transaksi - ia baris
 * yang dibuat lalu ditinggalkan, dan ia tetap ikut terhitung sebagai "sudah
 * dibukukan" pada tiap pemeriksaan yang hanya menghitung baris.
 *
 * Diukur pada SIPP sungguhan: 218 dari 4.948 transaksi bernilai nol rupiah.
 */
async function barisTransaksiHarian(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_biaya"]))) return [];
  const hasil = await muatTransaksi(rentang);

  return hasil.map((x) => {
    const sebab = [];
    if (!tanggalTerisi(x.tanggalTransaksi)) sebab.push("tanpa tanggal transaksi");
    if (!angka(x.jenisBiayaId)) sebab.push("tanpa jenis biaya");
    else if (!teks(x.jenisBiaya)) {
      sebab.push(`jenis biaya bernomor ${teks(x.jenisBiayaId)} tidak ada pada daftar jenis biaya`);
    }
    if (!teks(x.uraian)) sebab.push("tanpa uraian");
    if (angka(x.jumlah) === 0) {
      sebab.push("bernilai nol rupiah - baris yang dibuat lalu ditinggalkan, dan ia tetap terhitung sudah dibukukan");
    }
    if (![TRANSAKSI_MASUK, TRANSAKSI_KELUAR].includes(angka(x.arah))) {
      sebab.push(`arah transaksinya ${teks(x.arah)} - bukan masuk (1) maupun keluar (-1)`);
    }

    return {
      kunci: `transaksi-${teks(x.transaksiId)}`,
      nomorPerkara: teks(x.nomorPerkara),
      tanggal: tanggalIso(x.tanggalTransaksi),
      kategori: teks(x.kategori),
      jumlah: angka(x.jumlah),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * Saldo berjalan seluruh transaksi, berurutan waktu.
 *
 * Dipakai KU08, KU09, dan KU11. Saldo dihitung atas SELURUH perkara pada
 * rentang, bukan per perkara - itulah bentuk buku jurnal keuangan perkara.
 */
function saldoBerjalan(hasil) {
  let saldo = 0;
  return hasil.map((x) => {
    saldo += bertanda(x);
    return { baris: x, saldo };
  });
}

/**
 * ============================================================================
 * KU08 - SALDO DAN REKAPITULASI KEUANGAN
 * ============================================================================
 *
 * Satu baris satu bulan: penerimaan, pengeluaran, dan saldo akhirnya. Saldo
 * kumulatif yang NEGATIF berarti pengadilan mengeluarkan uang yang belum
 * pernah diterimanya - mustahil pada keuangan perkara, sebab tiap pengeluaran
 * bersumber panjar pihak.
 */
async function barisSaldoRekapitulasi(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_biaya"]))) return [];
  const hasil = await muatTransaksi(rentang);
  if (hasil.length === 0) return [];

  const perBulan = new Map();
  let saldo = 0;
  hasil.forEach((x) => {
    const b = bulanDari(x.tanggalTransaksi);
    if (!perBulan.has(b)) perBulan.set(b, { bulan: b, masuk: 0, keluar: 0, saldoAkhir: 0 });
    const m = perBulan.get(b);
    if (angka(x.arah) === TRANSAKSI_KELUAR) m.keluar += angka(x.jumlah);
    else m.masuk += angka(x.jumlah);
    saldo += bertanda(x);
    m.saldoAkhir = saldo;
  });

  return [...perBulan.values()]
    .sort((a, b) => a.bulan.localeCompare(b.bulan))
    .map((m) => {
      const sebab = [];
      if (m.saldoAkhir < 0) {
        sebab.push(
          `saldo kumulatif akhir bulan ${rupiah(
            m.saldoAkhir
          )} - pengadilan mengeluarkan uang yang belum pernah diterimanya, dan itu mustahil pada keuangan perkara`
        );
      }
      if (m.masuk === 0 && m.keluar > 0) {
        sebab.push("ada pengeluaran tetapi tidak satu pun penerimaan tercatat pada bulan ini");
      }

      return {
        kunci: `saldo-${m.bulan}`,
        bulan: m.bulan,
        penerimaan: m.masuk,
        pengeluaran: m.keluar,
        saldoAkhir: m.saldoAkhir,
        memenuhi: sebab.length === 0,
        sebabTidakMemenuhi: sebab.join("; "),
      };
    });
}

/**
 * ============================================================================
 * KU09 - VALIDASI KEUANGAN HARIAN
 * ============================================================================
 *
 * Pemeriksaan silang yang sama dengan KU08, tetapi per HARI. Bedanya bukan
 * sekadar kehalusan: saldo bulanan dapat berakhir sehat sementara di
 * pertengahan bulan ia sempat negatif, dan pemeriksaan bulanan tidak akan
 * pernah melihatnya.
 */
async function barisValidasiHarian(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_biaya"]))) return [];
  const hasil = await muatTransaksi(rentang);
  if (hasil.length === 0) return [];

  const perHari = new Map();
  let saldo = 0;
  hasil.forEach((x) => {
    const h = tanggalIso(x.tanggalTransaksi);
    if (!perHari.has(h)) perHari.set(h, { hari: h, masuk: 0, keluar: 0, jumlahBaris: 0, saldoAkhir: 0 });
    const d = perHari.get(h);
    d.jumlahBaris += 1;
    if (angka(x.arah) === TRANSAKSI_KELUAR) d.keluar += angka(x.jumlah);
    else d.masuk += angka(x.jumlah);
    saldo += bertanda(x);
    d.saldoAkhir = saldo;
  });

  return [...perHari.values()]
    .sort((a, b) => a.hari.localeCompare(b.hari))
    .map((d) => {
      const kurang = d.saldoAkhir < 0;

      return {
        kunci: `harian-${d.hari}`,
        tanggal: d.hari,
        jumlahTransaksi: d.jumlahBaris,
        penerimaan: d.masuk,
        pengeluaran: d.keluar,
        saldoAkhir: d.saldoAkhir,
        memenuhi: !kurang,
        sebabTidakMemenuhi: kurang
          ? `saldo kumulatif akhir hari ${rupiah(
              d.saldoAkhir
            )} - saldo bulanan dapat berakhir sehat sementara di pertengahan bulan ia sempat negatif, dan pemeriksaan bulanan tidak akan pernah melihatnya`
          : "",
      };
    });
}

/**
 * ============================================================================
 * KU10 - VALIDASI KEUANGAN BULANAN DAN TAHUNAN
 * ============================================================================
 *
 * Buku jurnal keuangan perkara ditutup tiap bulan. Transaksi yang DIKETIK jauh
 * sesudah tanggal transaksinya berarti bulan itu ditutup atas buku yang belum
 * lengkap - dan penutupan yang sudah dilaporkan tidak dapat ditarik kembali.
 *
 * Ini pertanyaan, bukan tuduhan. Penyusulan input yang benar memang terjadi:
 * kuitansi terselip, atau SIPP mati saat transaksinya berlangsung. Yang
 * dikatakan angka ini hanya satu - tanggal pada buku jurnal tidak selalu
 * tanggal ketika barisnya benar-benar ada.
 */
async function barisValidasiBerkala(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_biaya"]))) return [];
  const hasil = await muatTransaksi(rentang);

  return hasil
    .filter((x) => tanggalTerisi(x.diinputTanggal) && tanggalTerisi(x.tanggalTransaksi))
    .map((x) => {
      const jarak = selisihHari(x.tanggalTransaksi, x.diinputTanggal);
      const sebab = [];

      if (jarak !== null && jarak < 0) {
        sebab.push(`diketik ${Math.abs(jarak)} hari SEBELUM tanggal transaksinya - salah satu tanggalnya keliru`);
      } else if (jarak !== null && jarak > HARI_WAJAR_INPUT_TRANSAKSI) {
        sebab.push(
          `diketik ${jarak} hari sesudah tanggal transaksinya - buku bulan itu sudah ditutup dan dilaporkan sebelum baris ini ada`
        );
      }

      return {
        kunci: `berkala-${teks(x.transaksiId)}`,
        nomorPerkara: teks(x.nomorPerkara),
        tanggal: tanggalIso(x.tanggalTransaksi),
        jarakInputHari: jarak,
        memenuhi: sebab.length === 0,
        sebabTidakMemenuhi: sebab.join("; "),
      };
    });
}

/**
 * ============================================================================
 * KU11 SENGAJA TIDAK DISAMBUNGKAN - DAN SEBABNYA DIUKUR, BUKAN DIDUGA
 * ============================================================================
 *
 * Katalog meminta buku jurnal keuangan disandingkan dengan SIPP, dan
 * selisihnya ditelusuri sampai transaksi penyebabnya. Buku jurnalnya sendiri
 * ada di luar SIPP - kertas, atau aplikasi keuangan satuan kerja - dan tidak
 * dapat dibaca dari sini.
 *
 * Sempat dibangun di sini dengan menyandingkan kolom perkara_biaya.sisa -
 * yang disangka saldo berjalan milik SIPP - dengan hitungan atas transaksinya.
 * Hasilnya 502 cocok dari 4.948, dan angka seburuk itu justru yang membuatnya
 * diperiksa ulang.
 *
 * Ternyata kolom `sisa` MATI: pada tiap baris yang mengisinya nilainya
 * 0.00, dan pada 1.253 baris lainnya NULL. Ia bukan saldo berjalan dan tidak
 * pernah menjadi saldo berjalan. Butir yang bersandar padanya hanya akan
 * melaporkan ketidakcocokan dengan kolom yang memang tidak berisi apa-apa.
 *
 * Yang tersisa sebagai pemeriksaan silang sesungguhnya - panjar masuk harus
 * sama dengan seluruh pengeluaran ditambah pengembalian sisanya - PERSIS sama
 * dengan yang sudah diperiksa KU04 lewat saldo akhir perkara. Membuatnya dua
 * butir berarti satu temuan dihitung dua kali, dan papan yang menghitung satu
 * kesalahan dua kali akan membuat orang memperbaikinya dua kali juga.
 *
 * KU11 karena itu tetap BELUM sampai buku jurnal di luar SIPP benar-benar
 * dapat dibaca.
 */

/**
 * ============================================================================
 * KU12 - KEUANGAN PERKARA UPAYA HUKUM
 * ============================================================================
 *
 * Banding, kasasi, dan peninjauan kembali punya panjarnya sendiri, terpisah
 * dari panjar tingkat pertama. Permohonan upaya hukum tanpa panjar berarti
 * berkasnya dikirim ke pengadilan tingkat atas tanpa biaya pengirimannya
 * tercatat - dan biaya itu tetap keluar dari suatu tempat.
 */
async function barisKeuanganUpayaHukum(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_biaya", "jenis_biaya"]))) return [];

  const sisi = [
    { tabel: "perkara_banding", sebutan: "banding", pola: "%Banding%" },
    { tabel: "perkara_kasasi", sebutan: "kasasi", pola: "%Kasasi%" },
    { tabel: "perkara_pk", sebutan: "peninjauan kembali", pola: "%PK%" },
  ];

  const baris = [];
  for (const s of sisi) {
    if (!(await tabelSiap([s.tabel]))) continue;

    const hasil = await runQuery(
      `SELECT p.nomor_perkara      AS nomorPerkara,
              p.jenis_perkara_nama AS jenisPerkara,
              COALESCE(SUM(CASE WHEN j.nama LIKE ? AND b.jenis_transaksi = ${TRANSAKSI_MASUK}
                                THEN b.jumlah ELSE 0 END), 0) AS panjarUpaya
         FROM perkara p
         JOIN ${s.tabel} u ON u.perkara_id = p.perkara_id
         LEFT JOIN perkara_biaya b ON b.perkara_id = p.perkara_id
         LEFT JOIN jenis_biaya j ON j.id = b.jenis_biaya_id
        WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama
        ORDER BY p.nomor_perkara
        LIMIT ${BATAS_BARIS}`,
      [s.pola, rentang.mulai, rentang.selesai]
    );

    hasil.forEach((x) => {
      const panjar = angka(x.panjarUpaya);
      baris.push({
        kunci: `${teks(x.nomorPerkara)}#KU12#${s.sebutan}`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: teks(x.jenisPerkara),
        upayaHukum: s.sebutan,
        panjar,
        memenuhi: panjar > 0,
        sebabTidakMemenuhi:
          panjar > 0
            ? ""
            : `permohonan ${s.sebutan} tanpa panjar tercatat - berkasnya dikirim ke pengadilan tingkat atas tanpa biaya pengirimannya tercatat, dan biaya itu tetap keluar dari suatu tempat`,
      });
    });
  }

  return baris;
}

/**
 * ============================================================================
 * KU13 - KEUANGAN PERKARA EKSEKUSI
 * ============================================================================
 *
 * Eksekusi menimbulkan biaya yang jauh lebih besar daripada perkara biasa -
 * pengamanan, pengangkutan, dan kadang pengosongan. Permohonan eksekusi tanpa
 * satu pun baris biaya berarti seluruh pengeluaran itu tidak dapat
 * dipertanggungjawabkan kepada siapa pun.
 */
async function barisKeuanganEksekusi(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_eksekusi", "perkara_biaya"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            e.eksekusi_putusan   AS eksekusiPutusan,
            COUNT(b.id)          AS jumlahTransaksi,
            COALESCE(SUM(CASE WHEN b.jenis_transaksi = ${TRANSAKSI_MASUK}
                              THEN b.jumlah ELSE 0 END), 0) AS penerimaan
       FROM perkara p
       JOIN perkara_eksekusi e ON e.perkara_id = p.perkara_id
       LEFT JOIN perkara_biaya b ON b.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, e.eksekusi_putusan
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const adaBiaya = angka(x.jumlahTransaksi) > 0;

    return {
      kunci: `${teks(x.nomorPerkara)}#KU13`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      penerimaan: angka(x.penerimaan),
      memenuhi: adaBiaya,
      sebabTidakMemenuhi: adaBiaya
        ? ""
        : "permohonan eksekusi tanpa satu pun baris biaya - pengamanan, pengangkutan, dan pengosongan tetap menimbulkan pengeluaran, dan tanpa barisnya pengeluaran itu tidak dapat dipertanggungjawabkan",
    };
  });
}

/**
 * ============================================================================
 * KU16 - BEBAN BIAYA YANG DITANGGUNG PARA PIHAK
 * ============================================================================
 *
 * Yang benar-benar dikeluarkan pihak bukan panjar yang disetorkannya,
 * melainkan panjar DIKURANGI sisa yang dikembalikan. Kedua angka itu berjauhan:
 * pada rentang yang diukur, panjar Rp633 juta sementara pengembalian sisa
 * Rp166 juta - seperempatnya kembali.
 *
 * Menyebut panjar sebagai "biaya perkara" kepada pencari keadilan karena itu
 * melebih-lebihkan seperempat, dan angka itulah yang paling sering dikutip.
 */
async function barisBebanPihak(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_biaya", "jenis_biaya", "kategori_biaya"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.prodeo             AS prodeo,
            COALESCE(SUM(CASE WHEN b.jenis_transaksi = ${TRANSAKSI_MASUK}
                              THEN b.jumlah ELSE 0 END), 0)                AS disetor,
            COALESCE(SUM(CASE WHEN k.nama LIKE '%Sisa Panjar%'
                              THEN b.jumlah ELSE 0 END), 0)                AS dikembalikan
       FROM perkara p
       LEFT JOIN perkara_biaya b ON b.perkara_id = p.perkara_id
       LEFT JOIN jenis_biaya j ON j.id = b.jenis_biaya_id
       LEFT JOIN kategori_biaya k ON k.id = j.kategori_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, p.prodeo
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const disetor = angka(x.disetor);
    const kembali = angka(x.dikembalikan);
    const beban = disetor - kembali;
    const prodeo = angka(x.prodeo) === 1;
    const sebab = [];

    if (!prodeo && disetor === 0) {
      sebab.push("tidak ada satu pun setoran tercatat dan bukan perkara prodeo - beban pihaknya tidak dapat dihitung");
    }
    if (beban < 0) {
      sebab.push(
        `pengembalian ${rupiah(kembali)} melampaui setoran ${rupiah(disetor)} - pihaknya menerima lebih daripada yang pernah disetorkannya`
      );
    }

    return {
      kunci: `${teks(x.nomorPerkara)}#KU16`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      disetor,
      dikembalikan: kembali,
      bebanBersih: beban,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/** Sebelas butir sisa Bab 8. */
const BUTIR = [
  {
    kode: "KU04",
    kunci: "kecukupanPanjarPerkara",
    judul: "Kekurangan Panjar Biaya Perkara",
    keterangan:
      "Dua keadaan yang sama-sama salah: saldo NEGATIF berarti panjarnya habis sebelum perkaranya selesai dan kekurangannya ditalangi entah oleh siapa; saldo POSITIF pada perkara yang sudah diputus tanpa transaksi pengembalian berarti sisa panjar yang belum kembali kepada pihak. Yang kedua lebih sering terjadi dan lebih jarang ketahuan - uangnya tetap ada, tercatat rapi, dan tidak ada yang menagihnya.",
    baris: barisKecukupanPanjar,
    pembilang: "Perkara yang saldonya tidak negatif dan sisanya tidak tertinggal tanpa pengembalian",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_biaya, jenis_biaya, kategori_biaya, dan perkara_putusan",
    ruas: "jenis_transaksi, jumlah, tanggal_putusan, kategori biaya Sisa Panjar",
  },
  {
    kode: "KU05",
    kunci: "penerimaanNegaraBukanPajak",
    judul: "Penerimaan Negara Bukan Pajak",
    keterangan:
      "Tiap perkara yang didaftarkan menimbulkan PNBP pendaftaran, dan angka setoran ke kas negara disusun dari baris-baris itu. Perkara PRODEO dikecualikan: pembebasan biaya memang meniadakan PNBP-nya, dan menghitungnya gagal berarti menuduh pengadilan lalai atas sesuatu yang justru benar.",
    baris: barisPnbp,
    pembilang: "Perkara bukan prodeo yang punya baris PNBP pendaftaran",
    penyebut: "Seluruh perkara bukan prodeo yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_biaya, jenis_biaya, dan kategori_biaya",
    ruas: "prodeo, jenis_biaya_id, kategori PNBP, jumlah",
  },
  {
    kode: "KU06",
    kunci: "kelazimanBiayaPanggilanRadius",
    judul: "Biaya Pemanggilan Menurut Radius",
    keterangan: `Radius ditetapkan dengan surat keputusan ketua pengadilan, dan SIPP tidak menyimpan surat itu. Yang dapat diperiksa tanpa suratnya: apakah besaran panggilan KONSISTEN di dalam satu kecamatan. BATASNYA harus ikut terbaca - satu kecamatan dapat memuat desa yang jauh berbeda jaraknya, dan sebagian surat keputusan memang menetapkan radius per desa. Yang tidak memenuhi berarti pantas diperiksa, bukan terbukti keliru. Hanya kecamatan dengan sekurangnya ${MINIMAL_PERKARA_KECAMATAN} perkara yang dinilai.`,
    baris: barisRadiusPanggilan,
    pembilang: "Perkara yang biaya panggilannya sama dengan besaran terbanyak pada kecamatannya",
    penyebut: `Perkara berbiaya panggilan pada kecamatan yang punya sekurangnya ${MINIMAL_PERKARA_KECAMATAN} perkara pada rentang ini`,
    tabel: "perkara disambung perkara_biaya, jenis_biaya, kategori_biaya, perkara_pihak1, dan pihak",
    ruas: "kategori Panggilan, jumlah, kecamatan",
  },
  {
    kode: "KU07",
    kunci: "transaksiKeuanganHarian",
    judul: "Transaksi Keuangan Harian",
    keterangan:
      "Tiap baris buku jurnal harus dapat berdiri sendiri: bertanggal, bergolongan, beruraian, dan bernilai. Transaksi bernilai NOL bukan transaksi - ia baris yang dibuat lalu ditinggalkan, dan ia tetap ikut terhitung sebagai sudah dibukukan pada tiap pemeriksaan yang hanya menghitung baris.",
    baris: barisTransaksiHarian,
    pembilang: "Transaksi yang bertanggal, bergolongan, beruraian, bernilai di atas nol, dan berarah jelas",
    penyebut: "Seluruh transaksi keuangan atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_biaya, jenis_biaya, dan kategori_biaya",
    ruas: "tanggal_transaksi, jenis_transaksi, jenis_biaya_id, uraian, jumlah",
  },
  {
    kode: "KU08",
    kunci: "saldoRekapitulasiKeuangan",
    judul: "Saldo dan Rekapitulasi Keuangan",
    keterangan:
      "Satu baris satu bulan: penerimaan, pengeluaran, dan saldo akhirnya. Saldo kumulatif yang NEGATIF berarti pengadilan mengeluarkan uang yang belum pernah diterimanya - mustahil pada keuangan perkara, sebab tiap pengeluaran bersumber panjar pihak.",
    baris: barisSaldoRekapitulasi,
    pembilang: "Bulan yang saldo kumulatifnya tidak negatif dan penerimaannya tercatat",
    penyebut: "Seluruh bulan pada rentang ini yang memuat transaksi keuangan perkara",
    tabel: "perkara disambung perkara_biaya, dikelompokkan menurut bulan transaksi",
    ruas: "tanggal_transaksi, jenis_transaksi, jumlah",
  },
  {
    kode: "KU09",
    kunci: "validasiKeuanganHarian",
    judul: "Validasi Keuangan Harian",
    keterangan:
      "Pemeriksaan silang yang sama dengan rekapitulasi bulanan, tetapi per HARI. Bedanya bukan sekadar kehalusan: saldo bulanan dapat berakhir sehat sementara di pertengahan bulan ia sempat negatif, dan pemeriksaan bulanan tidak akan pernah melihatnya.",
    baris: barisValidasiHarian,
    pembilang: "Hari yang saldo kumulatif akhirnya tidak negatif",
    penyebut: "Seluruh hari pada rentang ini yang memuat transaksi keuangan perkara",
    tabel: "perkara disambung perkara_biaya, dikelompokkan menurut tanggal transaksi",
    ruas: "tanggal_transaksi, jenis_transaksi, jumlah",
  },
  {
    kode: "KU10",
    kunci: "validasiKeuanganBerkala",
    judul: "Validasi Keuangan Bulanan dan Tahunan",
    keterangan: `Buku jurnal keuangan perkara ditutup tiap bulan. Transaksi yang DIKETIK lebih dari ${HARI_WAJAR_INPUT_TRANSAKSI} hari sesudah tanggal transaksinya berarti bulan itu ditutup atas buku yang belum lengkap - dan penutupan yang sudah dilaporkan tidak dapat ditarik kembali. Ini PERTANYAAN, bukan tuduhan: penyusulan input yang benar memang terjadi ketika kuitansi terselip atau SIPP mati.`,
    baris: barisValidasiBerkala,
    pembilang: `Transaksi yang diketik dalam ${HARI_WAJAR_INPUT_TRANSAKSI} hari sesudah tanggal transaksinya`,
    penyebut: "Seluruh transaksi pada rentang ini yang punya jejak waktu input",
    tabel: "perkara disambung perkara_biaya - jejak waktu milik SIPP sendiri",
    ruas: "tanggal_transaksi, diinput_tanggal",
  },
  {
    kode: "KU12",
    kunci: "keuanganUpayaHukum",
    judul: "Keuangan Perkara Upaya Hukum",
    keterangan:
      "Banding, kasasi, dan peninjauan kembali punya panjarnya sendiri, terpisah dari panjar tingkat pertama. Permohonan upaya hukum tanpa panjar berarti berkasnya dikirim ke pengadilan tingkat atas tanpa biaya pengirimannya tercatat - dan biaya itu tetap keluar dari suatu tempat.",
    baris: barisKeuanganUpayaHukum,
    pembilang: "Permohonan upaya hukum yang punya panjar tercatat",
    penyebut: "Seluruh permohonan banding, kasasi, dan peninjauan kembali atas perkara pada rentang ini",
    tabel: "perkara disambung perkara_banding, perkara_kasasi, perkara_pk, perkara_biaya, dan jenis_biaya",
    ruas: "jenis_biaya nama, jenis_transaksi, jumlah",
  },
  {
    kode: "KU13",
    kunci: "keuanganPerkaraEksekusi",
    judul: "Keuangan Perkara Eksekusi",
    keterangan:
      "Eksekusi menimbulkan biaya yang jauh lebih besar daripada perkara biasa - pengamanan, pengangkutan, dan kadang pengosongan. Permohonan eksekusi tanpa satu pun baris biaya berarti seluruh pengeluaran itu tidak dapat dipertanggungjawabkan kepada siapa pun.",
    baris: barisKeuanganEksekusi,
    pembilang: "Permohonan eksekusi yang punya sekurangnya satu baris biaya",
    penyebut: "Seluruh permohonan eksekusi atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_eksekusi dan perkara_biaya lewat perkara_id",
    ruas: "eksekusi_putusan, jenis_transaksi, jumlah",
  },
  {
    kode: "KU16",
    kunci: "bebanBiayaDitanggungPihak",
    judul: "Beban Biaya yang Ditanggung Para Pihak",
    keterangan:
      "Yang benar-benar dikeluarkan pihak bukan panjar yang disetorkannya melainkan panjar DIKURANGI sisa yang dikembalikan. Kedua angka itu berjauhan - pada rentang yang diukur, panjar Rp633 juta sementara pengembalian sisa Rp166 juta, seperempatnya kembali. Menyebut panjar sebagai biaya perkara kepada pencari keadilan karena itu melebih-lebihkan seperempat, dan angka itulah yang paling sering dikutip.",
    baris: barisBebanPihak,
    pembilang: "Perkara yang beban bersih pihaknya terhitung dan tidak negatif",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_biaya, jenis_biaya, dan kategori_biaya",
    ruas: "prodeo, jenis_transaksi, jumlah, kategori Sisa Panjar",
  },
];

let sudahDidaftar = false;

function daftarkanSemua() {
  if (sudahDidaftar) return BUTIR.map((b) => b.kunci);

  BUTIR.forEach((b) => {
    if (kerangka.ambil(b.kunci)) return;
    kerangka.daftarkan({
      kunci: b.kunci,
      judul: b.judul,
      keterangan: b.keterangan,
      lantai: "bulanan",
      versiRumus: "keuangan-perkara-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: b.pembilang,
        penyebut: b.penyebut,
        dikecualikan:
          "Perkara prodeo dikeluarkan dari butir PNBP - pembebasan biaya memang meniadakannya. Kecamatan yang perkaranya terlalu sedikit dikeluarkan dari butir radius: pada satu perkara, besaran mana pun menjadi seluruh kebiasaannya. Transaksi tanpa jejak waktu input dikeluarkan dari butir validasi berkala - ketiadaan jejaknya sendiri diperiksa butir lain. Butir yang tabelnya tidak ada pada SIPP satuan kerja ini tidak menghasilkan baris sama sekali.",
        tabelSumber: b.tabel,
        ruasSumber: b.ruas,
      },
      baris: b.baris,
    });
  });

  sudahDidaftar = true;
  return BUTIR.map((b) => b.kunci);
}

function lupakanSemua() {
  sudahDidaftar = false;
}

function sambungan() {
  const peta = {};
  BUTIR.forEach((b) => {
    peta[b.kode] = b.kunci;
  });
  return peta;
}

module.exports = {
  BUTIR,
  HARI_WAJAR_INPUT_TRANSAKSI,
  MINIMAL_PERKARA_KECAMATAN,
  TRANSAKSI_KELUAR,
  TRANSAKSI_MASUK,
  barisBebanPihak,
  barisKecukupanPanjar,
  barisKeuanganEksekusi,
  barisKeuanganUpayaHukum,
  barisPnbp,
  barisRadiusPanggilan,
  barisSaldoRekapitulasi,
  barisTransaksiHarian,
  barisValidasiBerkala,
  barisValidasiHarian,
  bertanda,
  daftarkanSemua,
  lupakanSemua,
  sambungan,
  saldoBerjalan,
};
