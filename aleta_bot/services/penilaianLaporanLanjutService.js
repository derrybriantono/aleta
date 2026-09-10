"use strict";

/**
 * ============================================================================
 * LAPORAN PERKARA LANJUTAN - SISA BAB 4 KATALOG
 * ============================================================================
 *
 * Tujuh butir dari sebelas yang tersisa. Empat yang tidak disambungkan sudah
 * diperiksa pada basis datanya dan dicatat pada penilaianLaporanService:
 * eksaminasi (LP11), meja informasi (LP18), pengaduan (LP19), dan titipan
 * pihak ketiga (LP20) tidak punya satu pun tabel pada SIPP satuan kerja ini.
 *
 * ============================================================================
 * TIGA ASPEK, DAN DUA DI ANTARANYA BERSANDAR PADA CATATAN MANUSIA
 * ============================================================================
 *
 * Kapan sebuah laporan dikirim ke Badilag, dan berapa angka yang ditulis di
 * dalamnya, adalah dua hal yang TIDAK ADA di SIPP. laporanPerkaraService sudah
 * menyimpannya pada tabel aleta_bot_laporan_perkara - dicatat petugas
 * kepaniteraan hukum, bukan ditebak mesin.
 *
 * Akibatnya tiga butir di sini (LP23, LP24, LP25) akan MERAH SELURUHNYA pada
 * satuan kerja yang petugasnya belum pernah mencatat pengiriman. Itu bukan
 * cacat penilaiannya; itu memang keadaannya - dan angka SIPP-nya tetap
 * dihitung supaya begitu catatan pertama masuk, selisihnya langsung terlihat.
 *
 * ============================================================================
 * ANGKA SIPP PER LIPA DIHITUNG MENURUT BULAN PERISTIWANYA
 * ============================================================================
 *
 * Laporan bulanan menghitung yang TERJADI pada bulan itu: perkara yang
 * didaftarkan Maret, banding yang dimohonkan Maret, akta yang terbit Maret.
 * Bukan perkara yang didaftarkan Maret lalu apa pun yang terjadi padanya
 * kemudian. Karena itu tiap kueri di bawah menyaring menurut kolom tanggal
 * peristiwanya sendiri - dan tidak lewat tanggal pendaftaran perkaranya.
 *
 * ============================================================================
 * YANG DITEMUKAN SAAT MENGUKUR
 * ============================================================================
 *
 * Nomor seri blangko akta cerai ditulis dalam TIGA bentuk sekaligus pada satu
 * tahun - "S.24 002701", "S002856", dan "002850" - dan satu di antaranya salah
 * ketik ("S0022909", dua angka 2). Tiga nomor seri hilang dari urutan (2909,
 * 2932, 2958) tanpa satu pun ditandai rusak, sedangkan 20 blangko ditandai
 * rusak. Laporan pemakaian blangko yang disusun dari nomor seri ini tidak
 * akan cocok dengan stok fisiknya, dan tidak ada yang tahu ke arah mana.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");
const laporanPerkara = require("./laporanPerkaraService");

const BATAS_BARIS = 5000;

/** Bentuk baku nomor seri blangko akta cerai: S.YY NNNNNN. */
const POLA_SERI_BAKU = /^S\.\d{2}\s\d{6}$/;

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

function tanggalTerisi(nilai) {
  const t = teks(nilai);
  if (!t) return false;
  if (/^0000-00-00/.test(t)) return false;
  return true;
}

function tanggalIso(nilai) {
  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) {
    const b = String(nilai.getMonth() + 1).padStart(2, "0");
    const h = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${b}-${h}`;
  }
  return teks(nilai).slice(0, 10);
}

async function tabelSiap(daftar) {
  for (const t of daftar) {
    const ada = await sippSkemaService.tabelAda(t).catch(() => false);
    if (!ada) return false;
  }
  return true;
}

/** Daftar bulan YYYY-MM yang tercakup satu rentang. */
function bulanDalamRentang(rentang) {
  const keluar = [];
  const [ta, ba] = teks(rentang.mulai).slice(0, 7).split("-").map(Number);
  const [tz, bz] = teks(rentang.selesai).slice(0, 7).split("-").map(Number);
  if (!ta || !ba || !tz || !bz) return keluar;
  let t = ta;
  let b = ba;
  while (t < tz || (t === tz && b <= bz)) {
    keluar.push(`${t}-${String(b).padStart(2, "0")}`);
    b += 1;
    if (b > 12) {
      b = 1;
      t += 1;
    }
  }
  return keluar;
}

/* ==========================================================================
 * ANGKA SIPP PER LIPA PER BULAN
 * ==========================================================================
 *
 * Satu kueri per LIPA, masing-masing menyaring menurut tanggal PERISTIWANYA.
 * LIPA yang tidak ada di sini memang tidak punya angka SIPP, dan butir yang
 * membandingkannya akan berkata demikian - bukan memberi angka nol.
 */
const HITUNG_SIPP = {
  1: {
    tabel: ["perkara"],
    sql: `SELECT DATE_FORMAT(tanggal_pendaftaran, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara WHERE tanggal_pendaftaran >= ? AND tanggal_pendaftaran <= ? GROUP BY bulan`,
  },
  2: {
    tabel: ["perkara_banding"],
    sql: `SELECT DATE_FORMAT(permohonan_banding, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara_banding WHERE permohonan_banding >= ? AND permohonan_banding <= ? GROUP BY bulan`,
  },
  3: {
    tabel: ["perkara_kasasi"],
    sql: `SELECT DATE_FORMAT(permohonan_kasasi, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara_kasasi WHERE permohonan_kasasi >= ? AND permohonan_kasasi <= ? GROUP BY bulan`,
  },
  4: {
    tabel: ["perkara_pk"],
    sql: `SELECT DATE_FORMAT(permohonan_pk, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara_pk WHERE permohonan_pk >= ? AND permohonan_pk <= ? GROUP BY bulan`,
  },
  6: {
    tabel: ["perkara_hakim_pn"],
    sql: `SELECT DATE_FORMAT(tanggal_penetapan, '%Y-%m') AS bulan, COUNT(DISTINCT perkara_id) AS n
            FROM perkara_hakim_pn WHERE tanggal_penetapan >= ? AND tanggal_penetapan <= ? GROUP BY bulan`,
  },
  7: {
    tabel: ["perkara_biaya"],
    sql: `SELECT DATE_FORMAT(tanggal_transaksi, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara_biaya WHERE tanggal_transaksi >= ? AND tanggal_transaksi <= ? GROUP BY bulan`,
  },
  8: {
    tabel: ["perkara_eksekusi", "perkara_biaya"],
    sql: `SELECT DATE_FORMAT(b.tanggal_transaksi, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara_biaya b JOIN perkara_eksekusi e ON e.perkara_id = b.perkara_id
           WHERE b.tanggal_transaksi >= ? AND b.tanggal_transaksi <= ? GROUP BY bulan`,
  },
  9: {
    tabel: ["perkara_biaya", "jenis_biaya", "kategori_biaya"],
    sql: `SELECT DATE_FORMAT(b.tanggal_transaksi, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara_biaya b JOIN jenis_biaya j ON j.id = b.jenis_biaya_id
            JOIN kategori_biaya k ON k.id = j.kategori_id
           WHERE k.nama LIKE '%Kepaniteraan%' AND b.tanggal_transaksi >= ? AND b.tanggal_transaksi <= ? GROUP BY bulan`,
  },
  10: {
    tabel: ["perkara_akta_cerai"],
    sql: `SELECT DATE_FORMAT(tgl_akta_cerai, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara_akta_cerai WHERE tgl_akta_cerai >= ? AND tgl_akta_cerai <= ? GROUP BY bulan`,
  },
  12: {
    tabel: ["perkara_mediasi"],
    sql: `SELECT DATE_FORMAT(dimulai_mediasi, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara_mediasi WHERE dimulai_mediasi >= ? AND dimulai_mediasi <= ? GROUP BY bulan`,
  },
  13: {
    tabel: ["perkara_akta_cerai"],
    sql: `SELECT DATE_FORMAT(tgl_akta_cerai, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara_akta_cerai WHERE tgl_akta_cerai >= ? AND tgl_akta_cerai <= ? GROUP BY bulan`,
  },
  14: {
    tabel: ["perkara_jadwal_sidang"],
    // Gabungan kedua tanda, sama seperti LIPA 14 pada penilaianDipa04Service:
    // di luar ruang sidang bernomor ATAU bertanda sidang keliling.
    sql: `SELECT DATE_FORMAT(tanggal_sidang, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara_jadwal_sidang
           WHERE tanggal_sidang >= ? AND tanggal_sidang <= ?
             AND ((ruangan IS NOT NULL AND TRIM(ruangan) <> ''
                   AND ruangan NOT REGEXP '^[[:space:]]*Ruang[[:space:]]+Sidang[[:space:]]*[0-9]+[[:space:]]*$')
                  OR (sidang_keliling IS NOT NULL AND sidang_keliling NOT IN ('', '0', 'T')))
           GROUP BY bulan`,
  },
  15: {
    tabel: ["perkara"],
    sql: `SELECT DATE_FORMAT(tanggal_pendaftaran, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara WHERE prodeo = 1 AND tanggal_pendaftaran >= ? AND tanggal_pendaftaran <= ? GROUP BY bulan`,
  },
  16: {
    tabel: ["perkara", "perkara_pengacara"],
    // Perkara tanpa kuasa melewati Posbakum - aturan satuan kerja, lihat LP16.
    sql: `SELECT DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara p
           WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
             AND NOT EXISTS (SELECT 1 FROM perkara_pengacara g WHERE g.perkara_id = p.perkara_id)
           GROUP BY bulan`,
  },
  22: {
    tabel: ["perkara"],
    sql: `SELECT DATE_FORMAT(tanggal_pendaftaran, '%Y-%m') AS bulan, COUNT(*) AS n
            FROM perkara WHERE jenis_perkara_nama LIKE '%ispensasi%'
             AND tanggal_pendaftaran >= ? AND tanggal_pendaftaran <= ? GROUP BY bulan`,
  },
};

/** Angka SIPP satu LIPA, dipetakan per bulan. null bila LIPA-nya tidak punya kueri. */
async function angkaSippPerBulan(nomor, rentang) {
  const h = HITUNG_SIPP[nomor];
  if (!h) return null;
  if (!(await tabelSiap(h.tabel))) return null;
  const hasil = await runQuery(h.sql, [rentang.mulai, rentang.selesai]);
  const peta = {};
  hasil.forEach((x) => {
    peta[teks(x.bulan)] = angka(x.n);
  });
  return peta;
}

/** Catatan pengiriman satu LIPA, dipetakan per bulan. */
async function catatanPerBulan(nomor, rentang) {
  const bulan = bulanDalamRentang(rentang);
  if (!bulan.length) return {};
  let baris = [];
  try {
    baris = await laporanPerkara.bacaPengiriman(nomor, bulan[0], bulan[bulan.length - 1]);
  } catch (e) {
    // Basis data bot yang tidak terjangkau tidak boleh menjatuhkan seluruh
    // butir - yang dipulangkan "belum tercatat", dan itu memang keadaannya
    // dari sudut pandang penilaian.
    baris = [];
  }
  const peta = {};
  baris.forEach((c) => {
    peta[teks(c.bulanLaporan)] = {
      tanggalKirim: c.tanggalKirim ? tanggalIso(c.tanggalKirim) : null,
      angkaLaporan: c.angkaLaporan === null || c.angkaLaporan === undefined ? null : Number(c.angkaLaporan),
      dicatatOleh: teks(c.dicatatOleh),
    };
  });
  return peta;
}

/**
 * ============================================================================
 * LP23 - ASPEK 1: KETEPATAN WAKTU PENGIRIMAN LAPORAN
 * ============================================================================
 *
 * Satu baris satu LIPA satu bulan. Batas kirim datang dari
 * laporanPerkaraService.batasKirim - tanggal 5 bulan berikutnya, atau tanggal
 * 10 untuk yang berbiaya DIPA 04 - dan tanggal kirimnya dari catatan petugas.
 *
 * Laporan yang belum dicatat pengirimannya TIDAK memenuhi. Bukan karena ia
 * pasti terlambat, melainkan karena ketepatan waktunya tidak dapat dibuktikan
 * - dan laporan yang tidak dapat dibuktikan tepat waktu, bagi pemeriksa, sama
 * dengan laporan yang terlambat.
 */
async function barisKetepatanKirim(rentang) {
  const bulan = bulanDalamRentang(rentang);
  if (!bulan.length) return [];
  const keluar = [];

  for (const lipa of laporanPerkara.LIPA) {
    const catatan = await catatanPerBulan(lipa.nomor, rentang);
    for (const b of bulan) {
      let batas = null;
      try {
        batas = laporanPerkara.batasKirim(b, lipa.nomor);
      } catch (e) {
        batas = null;
      }
      const c = catatan[b] || {};
      const sebab = [];

      if (!batas) sebab.push("batas kirimnya tidak dapat ditentukan");
      else if (!c.tanggalKirim) {
        sebab.push(
          `pengirimannya belum dicatat - ketepatan waktunya tidak dapat dibuktikan, dan bagi pemeriksa itu sama dengan terlambat`
        );
      } else if (c.tanggalKirim > batas.tanggal) {
        sebab.push(`dikirim ${c.tanggalKirim}, melewati batas ${batas.tanggal}`);
      }

      keluar.push({
        kunci: `kirim-${laporanPerkara.kunciLipa(lipa.nomor)}-${b}`,
        lipa: laporanPerkara.kunciLipa(lipa.nomor),
        namaLaporan: lipa.nama,
        bulan: b,
        batasKirim: batas ? batas.tanggal : null,
        tanggalKirim: c.tanggalKirim || null,
        memenuhi: sebab.length === 0,
        sebabTidakMemenuhi: sebab.join("; "),
      });
    }
  }
  return keluar;
}

/**
 * ============================================================================
 * LP24 - ASPEK 2: VALIDITAS DAN SINKRONISASI DENGAN SIPP
 * ============================================================================
 *
 * Angka yang dilaporkan petugas disandingkan dengan angka hasil hitung SIPP
 * pada bulan yang sama. Hanya LIPA yang punya kueri SIPP yang masuk populasi;
 * yang tidak punya tidak dinilai, bukan dinilai nol.
 *
 * Selisih SATU pun ditandai. Laporan bulanan bukan taksiran - tiap angkanya
 * seharusnya dapat ditelusuri ke baris perkaranya, dan selisih satu berarti
 * satu perkara yang ada di satu tempat dan tidak ada di tempat lain.
 */
async function barisValiditasSipp(rentang) {
  const bulan = bulanDalamRentang(rentang);
  if (!bulan.length) return [];
  const keluar = [];

  for (const lipa of laporanPerkara.LIPA) {
    const sipp = await angkaSippPerBulan(lipa.nomor, rentang);
    if (sipp === null) continue;
    const catatan = await catatanPerBulan(lipa.nomor, rentang);

    for (const b of bulan) {
      const angkaSipp = Object.prototype.hasOwnProperty.call(sipp, b) ? sipp[b] : 0;
      const c = catatan[b] || {};
      const sebab = [];

      if (c.angkaLaporan === null || c.angkaLaporan === undefined) {
        sebab.push(`angka laporannya belum dicatat - SIPP menghitung ${angkaSipp}, dan tidak ada yang dapat disandingkan`);
      } else if (c.angkaLaporan !== angkaSipp) {
        sebab.push(
          `dilaporkan ${c.angkaLaporan} sedangkan SIPP menghitung ${angkaSipp} - selisih ${Math.abs(
            c.angkaLaporan - angkaSipp
          )}, dan tiap satuannya adalah satu perkara yang ada di satu tempat dan tidak ada di tempat lain`
        );
      }

      keluar.push({
        kunci: `valid-${laporanPerkara.kunciLipa(lipa.nomor)}-${b}`,
        lipa: laporanPerkara.kunciLipa(lipa.nomor),
        namaLaporan: lipa.nama,
        bulan: b,
        angkaSipp,
        angkaLaporan: c.angkaLaporan === undefined ? null : c.angkaLaporan,
        memenuhi: sebab.length === 0,
        sebabTidakMemenuhi: sebab.join("; "),
      });
    }
  }
  return keluar;
}

/**
 * ============================================================================
 * LP25 - ASPEK 3: KINERJA PELAKSANAAN DIPA 04
 * ============================================================================
 *
 * Tiga laporan berbiaya DIPA 04 - sidang di luar gedung, pembebasan biaya,
 * Pos Bantuan Hukum. Realisasi FISIKNYA dihitung dari SIPP; PERTANGGUNG-
 * JAWABANNYA dari catatan pengiriman. Keduanya harus ada: kegiatan yang
 * terjadi tetapi tidak dilaporkan tidak dapat dibayar, dan laporan tanpa
 * kegiatan adalah hal yang jauh lebih buruk.
 */
async function barisKinerjaDipa04(rentang) {
  const bulan = bulanDalamRentang(rentang);
  if (!bulan.length) return [];
  const keluar = [];

  for (const lipa of laporanPerkara.LIPA.filter((x) => x.dipa04)) {
    const sipp = await angkaSippPerBulan(lipa.nomor, rentang);
    const catatan = await catatanPerBulan(lipa.nomor, rentang);

    for (const b of bulan) {
      // Kuerinya jalan tetapi bulan itu tidak muncul berarti kegiatannya NOL
      // pada bulan itu - bukan "tidak dapat dihitung". Januari tanpa satu pun
      // sidang di luar gedung sempat ditandai tidak terhitung, padahal
      // jawabannya jelas: tidak ada.
      const realisasi = sipp === null ? null : Object.prototype.hasOwnProperty.call(sipp, b) ? sipp[b] : 0;
      const c = catatan[b] || {};
      const sebab = [];

      if (realisasi === null) sebab.push("realisasi fisiknya tidak dapat dihitung dari SIPP");
      if (!c.tanggalKirim) sebab.push("pertanggungjawabannya belum dicatat");
      else if (c.angkaLaporan !== null && c.angkaLaporan !== undefined && realisasi !== null && c.angkaLaporan > realisasi) {
        sebab.push(
          `dilaporkan ${c.angkaLaporan} kegiatan sedangkan SIPP mencatat ${realisasi} - laporan tanpa kegiatan jauh lebih buruk daripada kegiatan tanpa laporan`
        );
      }

      keluar.push({
        kunci: `dipa04-${laporanPerkara.kunciLipa(lipa.nomor)}-${b}`,
        lipa: laporanPerkara.kunciLipa(lipa.nomor),
        namaLaporan: lipa.nama,
        bulan: b,
        realisasiSipp: realisasi,
        dilaporkan: c.angkaLaporan === undefined ? null : c.angkaLaporan,
        memenuhi: sebab.length === 0,
        sebabTidakMemenuhi: sebab.join("; "),
      });
    }
  }
  return keluar;
}

/**
 * ============================================================================
 * LP00 - PAPAN KENDALI PENGIRIMAN LAPORAN PERKARA
 * ============================================================================
 *
 * Satu baris satu LIPA, atas BULAN TERAKHIR rentang. Yang dijawab satu
 * pertanyaan pimpinan pada awal bulan: laporan mana yang sudah dikirim tepat
 * waktu, angkanya cocok, dan mana yang belum. Dua puluh dua baris, dan
 * seluruhnya harus hijau sebelum tanggal sepuluh.
 */
async function barisPapanKendali(rentang) {
  const bulan = bulanDalamRentang(rentang);
  if (!bulan.length) return [];
  const terakhir = bulan[bulan.length - 1];
  const keluar = [];

  for (const lipa of laporanPerkara.LIPA) {
    const catatan = await catatanPerBulan(lipa.nomor, rentang);
    const sipp = await angkaSippPerBulan(lipa.nomor, rentang);
    const c = catatan[terakhir] || {};
    let batas = null;
    try {
      batas = laporanPerkara.batasKirim(terakhir, lipa.nomor);
    } catch (e) {
      batas = null;
    }
    const angkaSipp = sipp && Object.prototype.hasOwnProperty.call(sipp, terakhir) ? sipp[terakhir] : null;
    const sebab = [];

    if (!c.tanggalKirim) sebab.push("belum dikirim atau belum dicatat");
    else if (batas && c.tanggalKirim > batas.tanggal) sebab.push(`terlambat - batas ${batas.tanggal}`);
    if (sipp !== null && c.angkaLaporan !== null && c.angkaLaporan !== undefined && angkaSipp !== null && c.angkaLaporan !== angkaSipp) {
      sebab.push(`berselisih dengan SIPP (${c.angkaLaporan} dilaporkan, ${angkaSipp} di SIPP)`);
    }

    keluar.push({
      kunci: `papan-${laporanPerkara.kunciLipa(lipa.nomor)}`,
      lipa: laporanPerkara.kunciLipa(lipa.nomor),
      namaLaporan: lipa.nama,
      bulan: terakhir,
      dipa04: Boolean(lipa.dipa04),
      angkaSipp,
      sumberSipp: sipp !== null,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    });
  }
  return keluar;
}

/**
 * ============================================================================
 * LP08 - LIPA 8: KEUANGAN PERKARA EKSEKUSI
 * ============================================================================
 *
 * Satu baris satu permohonan eksekusi. Populasinya kerap KOSONG - satuan kerja
 * kecil dapat setahun tanpa eksekusi - dan kosong berarti tidak ada angka,
 * bukan angka nol.
 */
async function barisKeuanganEksekusiLipa(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_eksekusi", "perkara_biaya"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            e.eksekusi_putusan   AS tanggalEksekusi,
            COUNT(b.id)          AS jumlahTransaksi,
            COALESCE(SUM(CASE WHEN b.jenis_transaksi = 1 THEN b.jumlah ELSE 0 END), 0)  AS masuk,
            COALESCE(SUM(CASE WHEN b.jenis_transaksi = -1 THEN b.jumlah ELSE 0 END), 0) AS keluar
       FROM perkara_eksekusi e
       JOIN perkara p ON p.perkara_id = e.perkara_id
       LEFT JOIN perkara_biaya b ON b.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY p.perkara_id, p.nomor_perkara, e.eksekusi_putusan
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const sebab = [];
    if (angka(x.jumlahTransaksi) === 0) sebab.push("permohonan eksekusi tanpa satu pun baris keuangan");
    if (angka(x.keluar) > angka(x.masuk)) sebab.push("pengeluaran eksekusi melampaui penerimaannya");

    return {
      kunci: `${teks(x.nomorPerkara)}#LP08`,
      nomorPerkara: teks(x.nomorPerkara),
      penerimaan: angka(x.masuk),
      pengeluaran: angka(x.keluar),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * LP09 - LIPA 9: PENERIMAAN HAK-HAK KEPANITERAAN
 * ============================================================================
 *
 * Satu baris satu bulan menurut tanggal TRANSAKSI. Yang dinilai apakah tiap
 * bulan punya penerimaan hak kepaniteraan yang tercatat beserta besarannya -
 * bulan yang perkaranya berjalan tetapi hak kepaniteraannya nol berarti
 * setoran ke kas negara yang tidak tercatat.
 */
async function barisHakKepaniteraan(rentang) {
  if (!(await tabelSiap(["perkara_biaya", "jenis_biaya", "kategori_biaya", "perkara"]))) return [];

  const hasil = await runQuery(
    `SELECT b.bulan, b.jumlahBaris, b.total, m.perkaraBaru
       FROM (
         SELECT DATE_FORMAT(b.tanggal_transaksi, '%Y-%m') AS bulan,
                COUNT(*) AS jumlahBaris, SUM(b.jumlah) AS total
           FROM perkara_biaya b
           JOIN jenis_biaya j ON j.id = b.jenis_biaya_id
           JOIN kategori_biaya k ON k.id = j.kategori_id
          WHERE k.nama LIKE '%Kepaniteraan%'
            AND b.tanggal_transaksi >= ? AND b.tanggal_transaksi <= ?
          GROUP BY bulan
       ) b
       RIGHT JOIN (
         SELECT DATE_FORMAT(tanggal_pendaftaran, '%Y-%m') AS bulan, COUNT(*) AS perkaraBaru
           FROM perkara WHERE tanggal_pendaftaran >= ? AND tanggal_pendaftaran <= ? GROUP BY bulan
       ) m ON m.bulan = b.bulan
      ORDER BY m.bulan`,
    [rentang.mulai, rentang.selesai, rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const bulan = teks(x.bulan);
    const baris = angka(x.jumlahBaris);
    const total = angka(x.total);
    const sebab = [];
    if (baris === 0) sebab.push(`${angka(x.perkaraBaru)} perkara masuk tetapi tidak satu pun hak kepaniteraan tercatat`);
    else if (total <= 0) sebab.push("hak kepaniteraan tercatat tetapi besarannya nol");

    return {
      kunci: `hak-kepaniteraan-${bulan}`,
      bulan,
      jumlahBaris: baris,
      total,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * LP10 - LIPA 10: PENGGUNAAN FORMULIR AKTA CERAI
 * ============================================================================
 *
 * Satu baris satu akta yang terbit pada rentang. Blangko akta cerai adalah
 * formulir bernomor seri yang dipertanggungjawabkan lembar demi lembar -
 * yang rusak dilaporkan, yang hilang dicari. Laporannya hanya dapat disusun
 * bila tiap akta menyebut nomor serinya dalam bentuk yang sama.
 *
 * Diukur pada SIPP sungguhan: 248 akta, nomor seri dalam tiga bentuk
 * sekaligus dan satu salah ketik. Tiga nomor hilang dari urutan tanpa ditandai
 * rusak.
 */
async function barisFormulirAktaCerai(rentang) {
  if (!(await tabelSiap(["perkara_akta_cerai"]))) return [];

  const hasil = await runQuery(
    `SELECT a.perkara_id          AS perkaraId,
            a.nomor_akta_cerai    AS nomorAkta,
            a.no_seri_akta_cerai  AS seri,
            a.tgl_akta_cerai      AS tanggalAkta,
            a.blangko_akta_cerai  AS rusak
       FROM perkara_akta_cerai a
      WHERE a.tgl_akta_cerai >= ? AND a.tgl_akta_cerai <= ?
      ORDER BY a.tgl_akta_cerai, a.no_seri_akta_cerai
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  // Nomor urut dari bentuk apa pun, untuk mencari yang hilang dari urutan.
  const urut = (s) => {
    const m = teks(s).match(/(\d{5,7})\s*$/);
    return m ? Number(m[1]) : null;
  };
  const semuaUrut = hasil.map((x) => urut(x.seri)).filter((n) => n !== null);
  const adaUrut = new Set(semuaUrut);
  const hitungSeri = new Map();
  hasil.forEach((x) => {
    const s = teks(x.seri);
    if (s) hitungSeri.set(s, (hitungSeri.get(s) || 0) + 1);
  });

  return hasil.map((x) => {
    const seri = teks(x.seri);
    const n = urut(seri);
    const sebab = [];

    if (!seri) sebab.push("tanpa nomor seri blangko - lembarnya tidak dapat dipertanggungjawabkan");
    else {
      if (!POLA_SERI_BAKU.test(seri)) {
        sebab.push(`nomor seri "${seri}" tidak berbentuk baku S.YY NNNNNN - laporan pemakaian blangko tidak dapat disusun dari bentuk yang berbeda-beda`);
      }
      if ((hitungSeri.get(seri) || 0) > 1) sebab.push(`nomor seri "${seri}" dipakai ${hitungSeri.get(seri)} akta`);
      // Celah hanya dihitung DI DALAM satu deret: nomor sebelumnya hilang
      // sedangkan dua nomor sebelumnya ada. Tanpa syarat kedua, batas antara
      // dua keluarga penomoran (S.24 0027xx dan S0028xx) ditandai sebagai
      // seratus lebih lembar yang hilang - padahal itu deret yang berbeda.
      if (n !== null && n > 2 && !adaUrut.has(n - 1) && adaUrut.has(n - 2)) {
        sebab.push(`nomor seri sebelumnya (${n - 1}) tidak ada pada akta mana pun dan tidak ditandai rusak - satu lembar yang tidak dipertanggungjawabkan`);
      }
    }

    return {
      kunci: `blangko-${teks(x.perkaraId)}-${seri || "tanpa-seri"}`,
      nomorAkta: teks(x.nomorAkta),
      nomorSeri: seri,
      tanggal: tanggalIso(x.tanggalAkta),
      ditandaiRusak: angka(x.rusak) === 1,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/** Tujuh butir sisa Bab 4. */
const BUTIR = [
  {
    kode: "LP00",
    kunci: "papanKendaliPengirimanLaporan",
    judul: "Papan Kendali Pengiriman Laporan Perkara",
    keterangan:
      "Satu baris satu LIPA atas bulan terakhir rentang - jawaban atas pertanyaan pimpinan pada awal bulan: laporan mana yang sudah dikirim tepat waktu, angkanya cocok dengan SIPP, dan mana yang belum. Tanggal kirim dan angka laporan dicatat petugas kepaniteraan hukum, bukan ditebak mesin; papan ini merah sampai catatan pertamanya masuk.",
    baris: barisPapanKendali,
    pembilang: "LIPA yang bulan terakhirnya tercatat dikirim tepat waktu dan angkanya tidak berselisih dengan SIPP",
    penyebut: "Seluruh dua puluh dua LIPA",
    tabel: "aleta_bot_laporan_perkara (catatan petugas) disandingkan dengan hitungan per LIPA atas tabel SIPP",
    ruas: "lipa_nomor, bulan_laporan, tanggal_kirim, angka_laporan, dan kolom tanggal peristiwa tiap LIPA",
  },
  {
    kode: "LP08",
    kunci: "lipaKeuanganEksekusi",
    judul: "LIPA 8 — Keuangan Perkara Eksekusi",
    keterangan:
      "Keuangan yang melekat pada tiap permohonan eksekusi: ada barisnya, dan pengeluarannya tidak melampaui penerimaan. Populasinya kerap kosong - satuan kerja kecil dapat setahun tanpa eksekusi - dan kosong berarti tidak ada angka, bukan angka nol.",
    baris: barisKeuanganEksekusiLipa,
    pembilang: "Permohonan eksekusi yang punya baris keuangan dan pengeluarannya tidak melampaui penerimaan",
    penyebut: "Seluruh permohonan eksekusi atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara_eksekusi disambung perkara dan perkara_biaya lewat perkara_id",
    ruas: "eksekusi_putusan, jenis_transaksi, jumlah",
  },
  {
    kode: "LP09",
    kunci: "lipaHakKepaniteraan",
    judul: "LIPA 9 — Penerimaan Hak-Hak Kepaniteraan",
    keterangan:
      "Satu baris satu bulan menurut tanggal transaksi. Bulan yang perkaranya berjalan tetapi hak kepaniteraannya tidak tercatat berarti setoran ke kas negara yang tidak tercatat - dan LIPA 9 disusun dari baris-baris itu.",
    baris: barisHakKepaniteraan,
    pembilang: "Bulan yang hak kepaniteraannya tercatat dengan besaran di atas nol",
    penyebut: "Seluruh bulan pada rentang ini yang memuat perkara masuk",
    tabel: "perkara_biaya disambung jenis_biaya dan kategori_biaya, disandingkan dengan perkara per bulan",
    ruas: "tanggal_transaksi, kategori Hak-Hak Kepaniteraan, jumlah",
  },
  {
    kode: "LP10",
    kunci: "lipaFormulirAktaCerai",
    judul: "LIPA 10 — Penggunaan Formulir Akta Cerai",
    keterangan:
      "Blangko akta cerai dipertanggungjawabkan lembar demi lembar lewat nomor serinya. Yang dinilai apakah tiap akta menyebut nomor seri dalam bentuk baku S.YY NNNNNN, tidak ganda, dan tidak melompati nomor yang tidak ditandai rusak. Nomor seri dalam tiga bentuk pada satu tahun membuat laporan pemakaian blangko tidak akan cocok dengan stok fisiknya - dan tidak ada yang tahu ke arah mana.",
    baris: barisFormulirAktaCerai,
    pembilang: "Akta yang nomor serinya baku, tunggal, dan tidak melompati nomor yang tidak dipertanggungjawabkan",
    penyebut: "Seluruh akta cerai yang terbit pada rentang ini",
    tabel: "perkara_akta_cerai, disaring menurut tanggal terbit akta",
    ruas: "no_seri_akta_cerai, tgl_akta_cerai, blangko_akta_cerai",
  },
  {
    kode: "LP23",
    kunci: "ketepatanKirimLaporan",
    judul: "Aspek 1 — Ketepatan Waktu Pengiriman Laporan",
    keterangan:
      "Satu baris satu LIPA satu bulan. Batas kirim tanggal 5 bulan berikutnya, atau tanggal 10 untuk yang berbiaya DIPA 04. Laporan yang belum dicatat pengirimannya TIDAK memenuhi - bukan karena pasti terlambat, melainkan karena ketepatan waktunya tidak dapat dibuktikan, dan bagi pemeriksa itu sama dengan terlambat.",
    baris: barisKetepatanKirim,
    pembilang: "Laporan-bulan yang tercatat dikirim pada atau sebelum batas kirimnya",
    penyebut: "Dua puluh dua LIPA dikalikan jumlah bulan pada rentang",
    tabel: "aleta_bot_laporan_perkara - catatan petugas kepaniteraan hukum",
    ruas: "lipa_nomor, bulan_laporan, tanggal_kirim",
  },
  {
    kode: "LP24",
    kunci: "validitasLaporanSipp",
    judul: "Aspek 2 — Validitas dan Sinkronisasi dengan SIPP",
    keterangan:
      "Angka yang dilaporkan petugas disandingkan dengan hitungan SIPP pada bulan yang sama, menurut tanggal peristiwanya. Hanya LIPA yang punya kueri SIPP yang masuk populasi. Selisih SATU pun ditandai: laporan bulanan bukan taksiran, dan selisih satu berarti satu perkara yang ada di satu tempat dan tidak ada di tempat lain.",
    baris: barisValiditasSipp,
    pembilang: "Laporan-bulan yang angkanya tercatat dan sama persis dengan hitungan SIPP",
    penyebut: "LIPA yang punya kueri SIPP dikalikan jumlah bulan pada rentang",
    tabel: "aleta_bot_laporan_perkara disandingkan dengan hitungan per LIPA atas tabel SIPP",
    ruas: "angka_laporan, dan kolom tanggal peristiwa tiap LIPA",
  },
  {
    kode: "LP25",
    kunci: "kinerjaDipa04",
    judul: "Aspek 3 — Kinerja Pelaksanaan DIPA 04",
    keterangan:
      "Tiga laporan berbiaya DIPA 04 - sidang di luar gedung, pembebasan biaya, Pos Bantuan Hukum - per bulan. Realisasi FISIK dihitung dari SIPP, PERTANGGUNGJAWABAN dari catatan pengiriman, dan keduanya harus ada. Kegiatan yang terjadi tetapi tidak dilaporkan tidak dapat dibayar; laporan tanpa kegiatan jauh lebih buruk.",
    baris: barisKinerjaDipa04,
    pembilang: "Laporan-bulan DIPA 04 yang realisasinya terhitung dan pertanggungjawabannya tercatat tanpa melebihi realisasi",
    penyebut: "Tiga LIPA DIPA 04 dikalikan jumlah bulan pada rentang",
    tabel: "aleta_bot_laporan_perkara disandingkan dengan perkara_jadwal_sidang, perkara, dan perkara_pengacara",
    ruas: "tanggal_kirim, angka_laporan, tanggal_sidang, ruangan, sidang_keliling, prodeo, perkara_id pada perkara_pengacara",
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
      versiRumus: "laporan-lanjut-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: b.pembilang,
        penyebut: b.penyebut,
        dikecualikan:
          "LIPA yang tidak punya kueri SIPP dikeluarkan dari butir validitas dan tidak dinilai nol. Laporan yang belum dicatat pengirimannya TIDAK dikeluarkan melainkan ditandai - ketiadaan catatannya sendiri adalah temuan. Butir yang tabelnya tidak ada pada SIPP satuan kerja ini tidak menghasilkan baris sama sekali.",
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
  HITUNG_SIPP,
  POLA_SERI_BAKU,
  angkaSippPerBulan,
  barisFormulirAktaCerai,
  barisHakKepaniteraan,
  barisKetepatanKirim,
  barisKeuanganEksekusiLipa,
  barisKinerjaDipa04,
  barisPapanKendali,
  barisValiditasSipp,
  bulanDalamRentang,
  daftarkanSemua,
  lupakanSemua,
  sambungan,
};
