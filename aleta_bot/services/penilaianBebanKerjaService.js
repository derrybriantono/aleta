"use strict";

/**
 * ============================================================================
 * BEBAN KERJA DAN PEMERATAAN - BAB 6 KATALOG
 * ============================================================================
 *
 * Sepuluh butir. Seluruhnya diukur dari SIPP, dan seluruhnya sudah dijalankan
 * pada satu basis data SIPP sungguhan sebelum ditulis - angka hasil ukurnya
 * disebutkan pada tiap butir supaya penggantinya tahu apa yang wajar.
 *
 * ============================================================================
 * BEBAN KERJA MENILAI PEMBAGIAN, BUKAN ORANGNYA
 * ============================================================================
 *
 * Ini batas yang paling mudah dilanggar di seluruh berkas ini, dan pelanggaran
 * pertamanya tidak akan tampak seperti pelanggaran.
 *
 * Angka "hakim A memegang 157 perkara, hakim B 73" TIDAK berarti hakim B
 * bekerja separuh. Perkara tidak sama besarnya: satu gugatan waris dengan
 * dua belas pihak dan sita jaminan memakan waktu lebih banyak daripada dua
 * puluh cerai gugat verstek. Yang dinilai butir-butir di sini karena itu
 * PEMBAGIANNYA - apakah beban terbagi merata, apakah ruang sidang terpakai
 * merata, apakah bebannya tercatat sehingga dapat dibagi - dan tidak satu pun
 * menyimpulkan siapa yang rajin.
 *
 * Sebuah rapor yang menyebut nama hakim beserta angka tanpa kalimat ini akan
 * dipakai orang untuk menilai orangnya, dan itu tidak dapat ditarik kembali.
 *
 * ============================================================================
 * PENUGASAN DILACAK LEWAT ID, BUKAN LEWAT NAMA
 * ============================================================================
 *
 * Diperiksa pada basis data SIPP yang ada di tangan: satu hakim yang sama
 * tercatat dengan empat ejaan nama sekaligus -
 *
 *   hakim_id 15  "Derry Briantono"        402 baris
 *   hakim_id 15  "Derry Briantono, S.H"   858 baris
 *   hakim_id 15  "Derry Briantono, S.H."  1299 baris
 *   hakim_id 15  "Derry Briantono, SH"    401 baris
 *
 * Mengelompokkan beban menurut hakim_nama akan memecah satu orang menjadi
 * empat orang yang masing-masing tampak ringan bebannya - dan papan yang
 * memuatnya akan terbaca masuk akal. Seluruh pengelompokan di berkas ini
 * memakai kolom _id, dan namanya hanya diambil untuk ditampilkan.
 *
 * ============================================================================
 * DUA BUTIR TERAKHIR MODEL, BUKAN PENGUKURAN
 * ============================================================================
 *
 * BK08 (simulasi) dan BK09 (proyeksi) meminta ALETA menebak masa depan.
 * Tebakan tidak dapat diaudit - yang dapat diaudit hanya BAHAN tebakannya.
 * Karena itu keduanya menilai kesiapan bahannya, dan katalog menyebut
 * keduanya "sebagian" beserta sebabnya. Menyebutnya penuh berarti berjanji
 * ALETA menghitung proyeksi yang tidak pernah dihitungnya.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

const BATAS_BARIS = 5000;

/**
 * Berapa persidangan dalam satu ruang pada satu hari yang sudah pantas
 * ditanyakan. Diukur pada SIPP sungguhan: dari 153 pasangan hari-ruang, enam
 * melampaui lima belas, dan yang tertinggi memuat dua puluh delapan
 * persidangan dalam satu ruang satu hari.
 */
const AMBANG_KEPADATAN_RUANG = 15;

/**
 * Selisih antara ruang tersibuk dan ruang tersepi pada hari yang sama. Di
 * atas ini berarti satu ruang berdesakan sementara ruang sebelahnya lowong.
 */
const AMBANG_SELISIH_RUANG = 5;

/**
 * Seberapa jauh bagian seorang ketua majelis boleh menyimpang dari bagian
 * rata. Dua puluh lima persen dipilih supaya perbedaan yang wajar - cuti,
 * pelantikan di tengah tahun, hakim yang merangkap jabatan - tidak langsung
 * terhitung tidak merata.
 */
const AMBANG_DEVIASI_PEMERATAAN = 0.25;

/**
 * Lonjakan penerimaan antar bulan yang sudah pantas ditanyakan. Tiga kali
 * lipat dalam satu bulan hampir selalu berarti penginputan borongan perkara
 * lama, bukan perkara yang benar-benar masuk pada bulan itu.
 */
const AMBANG_LONJAKAN_BULANAN = 3;

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

/**
 * Tanggal dari MySQL dipulangkan sebagai objek Date oleh penggeraknya, dan
 * String(Date) menghasilkan "Tue Jan 16 2024 ..." - bukan "2024-01-16".
 * Kunci baris yang tersusun dari bentuk itu kehilangan TAHUNNYA, sehingga
 * 16 Januari 2024 dan 16 Januari 2025 menjadi satu baris yang sama.
 *
 * Ini sudah pernah terjadi sekali pada berkas ini dan tertangkap hanya karena
 * hasil ukurnya dibaca; kalimat "Tue Jan 16#Ruang Sidang 1" terbaca cukup
 * masuk akal untuk lolos.
 */
function tanggalIso(nilai) {
  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) {
    const b = String(nilai.getMonth() + 1).padStart(2, "0");
    const h = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${b}-${h}`;
  }
  return teks(nilai).slice(0, 10);
}

/** Tanggal SIPP yang kosong punya beberapa bentuk sekaligus. */
function tanggalTerisi(nilai) {
  const t = teks(nilai);
  if (!t) return false;
  if (/^0000-00-00/.test(t)) return false;
  return true;
}

/** Memastikan seluruh tabel yang dibutuhkan satu butir memang ada. */
async function tabelSiap(daftar) {
  for (const t of daftar) {
    const ada = await sippSkemaService.tabelAda(t).catch(() => false);
    if (!ada) return false;
  }
  return true;
}

/**
 * ============================================================================
 * BK01, BK02 - BEBAN MAJELIS DAN PANITERA PENGGANTI DAPAT DIBEBANKAN
 * ============================================================================
 *
 * Beban kerja hanya dapat dihitung bila tiap perkara dapat ditunjuk pemiliknya
 * dan diketahui SEJAK KAPAN ia menjadi bebannya. Perkara tanpa penetapan
 * majelis bukan beban siapa pun; perkara yang penetapannya tidak bertanggal
 * adalah beban yang tidak dapat diletakkan pada bulan mana pun.
 *
 * Diukur pada SIPP sungguhan: 431 perkara satu tahun, seluruhnya punya tepat
 * satu ketua atau hakim tunggal yang aktif beserta tanggal penetapannya, dan
 * seluruhnya punya tepat satu panitera pengganti aktif. Angka 431/431 itu
 * memang yang diharapkan - butir ini berguna justru ketika ia TIDAK penuh.
 */
function pembangunPenugasan(p) {
  return async function baris(rentang) {
    if (!(await tabelSiap(["perkara", p.tabel]))) return [];

    const hasil = await runQuery(
      `SELECT p.perkara_id     AS perkaraId,
              p.nomor_perkara  AS nomorPerkara,
              p.jenis_perkara_nama AS jenisPerkara,
              COUNT(DISTINCT x.${p.ruasId})                                AS jumlahPetugas,
              MAX(x.${p.ruasNama})                                         AS namaPetugas,
              SUM(x.tanggal_penetapan IS NULL
                  OR x.tanggal_penetapan = '0000-00-00')                   AS tanpaTanggal
         FROM perkara p
         LEFT JOIN ${p.tabel} x
                ON x.perkara_id = p.perkara_id
               AND x.aktif = 'Y'
               ${p.saringPetugas ? `AND ${p.saringPetugas}` : ""}
        WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama
        ORDER BY p.nomor_perkara
        LIMIT ${BATAS_BARIS}`,
      [rentang.mulai, rentang.selesai]
    );

    return hasil.map((x) => {
      const jumlah = angka(x.jumlahPetugas);
      const tanpaTanggal = angka(x.tanpaTanggal);
      const sebab = [];

      if (jumlah === 0) sebab.push(`tidak ada ${p.sebutan} aktif - bebannya tidak dapat dibebankan kepada siapa pun`);
      else if (jumlah > 1) sebab.push(`ada ${jumlah} ${p.sebutan} aktif sekaligus - bebannya terhitung ganda`);
      if (jumlah > 0 && tanpaTanggal > 0) {
        sebab.push("penetapannya tidak bertanggal - bebannya tidak dapat diletakkan pada bulan mana pun");
      }

      return {
        kunci: `${teks(x.nomorPerkara)}#${p.kode}`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: teks(x.jenisPerkara),
        petugas: teks(x.namaPetugas),
        jumlahPetugas: jumlah,
        memenuhi: sebab.length === 0,
        sebabTidakMemenuhi: sebab.join("; "),
      };
    });
  };
}

/**
 * ============================================================================
 * BK03 - BEBAN PEMANGGILAN JURUSITA
 * ============================================================================
 *
 * Beban jurusita bukan jumlah perkaranya melainkan jumlah RELAAS yang
 * dilaksanakannya - satu perkara dengan pihak ghaib dapat menghabiskan enam
 * kali pemanggilan, sedangkan perkara e-Court dengan dua pihak hadir tidak
 * menghabiskan satu pun.
 *
 * Diukur pada SIPP sungguhan: 1.298 pelaksanaan relaas atas perkara satu
 * tahun, 1.293 di antaranya lengkap. Lima yang tidak lengkap adalah relaas
 * tanpa tanggal pelaksanaan - relaas semacam itu tidak dapat dihitung
 * tenggangnya oleh butir mana pun.
 */
async function barisBebanJurusita(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_pelaksanaan_relaas"]))) return [];

  const hasil = await runQuery(
    `SELECT r.id                AS relaasId,
            p.nomor_perkara     AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            r.jurusita_id       AS jurusitaId,
            r.tanggal_relaas    AS tanggalRelaas,
            r.ket_temu          AS ketTemu,
            r.pihak_id          AS pihakId
       FROM perkara p
       JOIN perkara_pelaksanaan_relaas r ON r.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY r.tanggal_relaas
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const sebab = [];
    if (!angka(x.jurusitaId)) sebab.push("tidak menyebut jurusita pelaksananya");
    if (!tanggalTerisi(x.tanggalRelaas)) sebab.push("tidak bertanggal pelaksanaan");
    if (!teks(x.ketTemu)) sebab.push("tidak menyebut pihaknya bertemu atau tidak");
    if (!angka(x.pihakId)) sebab.push("tidak menyebut pihak yang dipanggil");

    return {
      kunci: `relaas-${teks(x.relaasId)}`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      tanggal: teks(x.tanggalRelaas),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * BK04 - PEMERATAAN PEMBAGIAN PERKARA
 * ============================================================================
 *
 * Satu baris satu ketua majelis, dan yang dinilai selisih bagiannya terhadap
 * bagian rata. Koefisien Gini ikut dihitung dan diletakkan pada tiap baris
 * sebagai keterangan, sebab satu angka Gini tidak dapat menunjukkan SIAPA yang
 * menanggung ketidakrataannya.
 *
 * Diukur pada SIPP sungguhan: empat ketua membagi 431 perkara menjadi 157,
 * 111, 90, dan 73. Bagian ratanya 107,75 - dua di antaranya menyimpang lebih
 * dari seperempat, dan Gini-nya 0,17.
 *
 * Perlu dipegang: baris yang tidak memenuhi di sini BUKAN hakim yang bersalah.
 * Yang tidak memenuhi adalah PEMBAGIANNYA, dan yang membagi perkara bukan
 * hakim yang menerimanya.
 */
async function barisPemerataan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_hakim_pn"]))) return [];

  const hasil = await runQuery(
    `SELECT h.hakim_id            AS hakimId,
            MAX(h.hakim_nama)     AS hakimNama,
            COUNT(DISTINCT p.perkara_id) AS jumlah
       FROM perkara p
       JOIN perkara_hakim_pn h
              ON h.perkara_id = p.perkara_id
             AND h.aktif = 'Y'
             AND (h.jabatan_hakim_nama LIKE '%etua%'
                  OR h.jabatan_hakim_nama LIKE '%unggal%')
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY h.hakim_id
      ORDER BY jumlah DESC
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  if (hasil.length === 0) return [];

  const nilai = hasil.map((x) => angka(x.jumlah));
  const total = nilai.reduce((a, b) => a + b, 0);
  const rata = total / nilai.length;
  const gini = koefisienGini(nilai);

  return hasil.map((x) => {
    const jumlah = angka(x.jumlah);
    const deviasi = rata > 0 ? (jumlah - rata) / rata : 0;
    const lewat = Math.abs(deviasi) > AMBANG_DEVIASI_PEMERATAAN;
    const persen = (deviasi * 100).toFixed(1);

    return {
      kunci: `hakim-${teks(x.hakimId)}`,
      petugas: teks(x.hakimNama),
      jumlahPerkara: jumlah,
      bagianRata: Number(rata.toFixed(2)),
      gini: Number(gini.toFixed(4)),
      memenuhi: !lewat,
      sebabTidakMemenuhi: lewat
        ? `bagiannya ${jumlah} perkara, menyimpang ${persen}% dari bagian rata ${rata.toFixed(
            1
          )} - yang dinilai pembagiannya, bukan hakimnya`
        : "",
    };
  });
}

/**
 * Koefisien Gini atas satu daftar beban.
 *
 * Nol berarti terbagi persis rata, satu berarti seluruhnya ditanggung satu
 * orang. Dihitung dengan rumus selisih rerata mutlak - bukan dengan luas di
 * bawah kurva Lorenz - sebab jumlah orangnya selalu sedikit dan pendekatan
 * kurva pada empat titik menghasilkan angka yang menyesatkan.
 */
function koefisienGini(nilai) {
  const n = nilai.length;
  if (n === 0) return 0;
  const total = nilai.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  let jumlahSelisih = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      jumlahSelisih += Math.abs(nilai[i] - nilai[j]);
    }
  }
  return jumlahSelisih / (2 * n * n * (total / n));
}

/**
 * ============================================================================
 * BK05 - KEPADATAN JADWAL SIDANG HARIAN
 * ============================================================================
 *
 * Satu baris satu pasangan hari-ruang. Gunanya terlihat sebelum harinya tiba:
 * hari yang sudah melampaui kapasitas dapat dipindahkan sebagiannya selagi
 * pemanggilannya belum keluar.
 *
 * Diukur pada SIPP sungguhan: 153 pasangan hari-ruang, enam melampaui lima
 * belas persidangan, dan yang tertinggi memuat dua puluh delapan.
 */
async function barisKepadatanSidang(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_jadwal_sidang"]))) return [];

  const hasil = await runQuery(
    `SELECT DATE(j.tanggal_sidang) AS hari,
            COALESCE(NULLIF(TRIM(j.ruangan), ''), '(tanpa ruang)') AS ruang,
            COUNT(*) AS jumlah
       FROM perkara p
       JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND j.tanggal_sidang IS NOT NULL
      GROUP BY hari, ruang
      ORDER BY hari
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const jumlah = angka(x.jumlah);
    const hari = tanggalIso(x.hari);
    const lewat = jumlah > AMBANG_KEPADATAN_RUANG;

    return {
      kunci: `${hari}#${teks(x.ruang)}`,
      tanggal: hari,
      ruang: teks(x.ruang),
      jumlahSidang: jumlah,
      memenuhi: !lewat,
      sebabTidakMemenuhi: lewat
        ? `${jumlah} persidangan dalam satu ruang satu hari, melampaui ambang ${AMBANG_KEPADATAN_RUANG}`
        : "",
    };
  });
}

/**
 * ============================================================================
 * BK06 - PEMANFAATAN RUANG SIDANG
 * ============================================================================
 *
 * Yang dicari bukan ruang yang kosong sepanjang tahun - ruang cadangan memang
 * ada dan memang seharusnya kosong. Yang dicari ruang yang menganggur PADA
 * HARI YANG SAMA saat ruang sebelahnya berdesakan, sebab hanya keadaan itu
 * yang dapat diperbaiki dengan memindahkan jadwal.
 *
 * Karena itu populasinya hanya hari yang memakai lebih dari satu ruang -
 * pada hari yang memakai satu ruang saja tidak ada yang dapat dibandingkan.
 * Diukur pada SIPP sungguhan: dari 135 hari sidang, 15 memakai lebih dari
 * satu ruang, dan selisih tersibuk-tersepi terbesarnya tiga belas.
 */
async function barisPemanfaatanRuang(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_jadwal_sidang"]))) return [];

  const hasil = await runQuery(
    `SELECT hari,
            COUNT(*)   AS jumlahRuang,
            MAX(jumlah) AS tersibuk,
            MIN(jumlah) AS tersepi,
            SUM(jumlah) AS totalSidang
       FROM (
         SELECT DATE(j.tanggal_sidang) AS hari,
                COALESCE(NULLIF(TRIM(j.ruangan), ''), '(tanpa ruang)') AS ruang,
                COUNT(*) AS jumlah
           FROM perkara p
           JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
          WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
            AND j.tanggal_sidang IS NOT NULL
          GROUP BY hari, ruang
       ) t
      GROUP BY hari
     HAVING COUNT(*) > 1
      ORDER BY hari
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const hari = tanggalIso(x.hari);
    const tersibuk = angka(x.tersibuk);
    const tersepi = angka(x.tersepi);
    const selisih = tersibuk - tersepi;
    const lewat = selisih > AMBANG_SELISIH_RUANG;

    return {
      kunci: `ruang-${hari}`,
      tanggal: hari,
      jumlahRuang: angka(x.jumlahRuang),
      tersibuk,
      tersepi,
      memenuhi: !lewat,
      sebabTidakMemenuhi: lewat
        ? `ruang tersibuk memuat ${tersibuk} persidangan sedangkan tersepi hanya ${tersepi} - selisih ${selisih} melampaui ambang ${AMBANG_SELISIH_RUANG}`
        : "",
    };
  });
}

/**
 * ============================================================================
 * BK07 - BEBAN YANG TIDAK MENAMBAH ANGKA STATISTIK
 * ============================================================================
 *
 * Delegasi adalah pekerjaan penuh - jurusita berangkat, relaas disusun, biaya
 * dibukukan - tetapi ia tidak menambah satu pun angka pada laporan keadaan
 * perkara, sebab perkaranya milik pengadilan lain. Satuan kerja yang banyak
 * menerima delegasi akan tampak ringan bebannya pada tiap laporan.
 *
 * Butir ini tidak menghitung berapa banyak delegasinya - itu bukan sesuatu
 * yang dapat dinilai baik atau buruk. Yang dinilai apakah beban itu TERCATAT
 * cukup lengkap untuk dapat diperhitungkan ketika beban satuan kerja dihitung.
 *
 * Diukur pada SIPP sungguhan: 194 delegasi masuk dan 55 delegasi keluar satu
 * tahun, seluruhnya lengkap.
 */
async function barisBebanTidakTercatat(rentang) {
  const baris = [];

  for (const sisi of [
    { tabel: "delegasi_masuk", label: "masuk", ruasLawan: "pn_asal_text", sebutanLawan: "pengadilan pengirim" },
    { tabel: "delegasi_keluar", label: "keluar", ruasLawan: "pn_tujuan_text", sebutanLawan: "pengadilan tujuan" },
  ]) {
    if (!(await tabelSiap([sisi.tabel]))) continue;

    const hasil = await runQuery(
      `SELECT d.id                  AS delegasiId,
              d.nomor_perkara       AS nomorPerkara,
              d.tgl_delegasi        AS tanggalDelegasi,
              d.jenis_delegasi_text AS jenisDelegasi,
              d.${sisi.ruasLawan}   AS lawan,
              d.tgl_sidang          AS tanggalSidang
         FROM ${sisi.tabel} d
        WHERE d.tgl_delegasi >= ? AND d.tgl_delegasi <= ?
        ORDER BY d.tgl_delegasi
        LIMIT ${BATAS_BARIS}`,
      [rentang.mulai, rentang.selesai]
    );

    hasil.forEach((x) => {
      const sebab = [];
      if (!teks(x.nomorPerkara)) sebab.push("tidak menyebut nomor perkaranya");
      if (!tanggalTerisi(x.tanggalDelegasi)) sebab.push("tidak bertanggal delegasi");
      if (!teks(x.jenisDelegasi)) sebab.push("tidak menyebut jenis delegasinya");
      if (!teks(x.lawan)) sebab.push(`tidak menyebut ${sisi.sebutanLawan}`);
      if (!tanggalTerisi(x.tanggalSidang)) sebab.push("tidak menyebut tanggal sidang yang dilayaninya");

      baris.push({
        kunci: `delegasi-${sisi.label}-${teks(x.delegasiId)}`,
        nomorPerkara: teks(x.nomorPerkara),
        arah: sisi.label,
        tanggal: teks(x.tanggalDelegasi),
        memenuhi: sebab.length === 0,
        sebabTidakMemenuhi: sebab.join("; "),
      });
    });
  }

  return baris;
}

/**
 * Penerimaan dan penyelesaian per bulan pada satu rentang.
 *
 * Dipakai bersama oleh BK08 dan BK10. Ditulis satu kali sebab dua tempat yang
 * menghitung bulan dengan cara yang sedikit berbeda akan menghasilkan dua
 * papan yang tidak dapat disandingkan, dan tidak ada yang tahu mana yang benar.
 */
async function rekapBulanan(rentang) {
  const masuk = await runQuery(
    `SELECT DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m') AS bulan, COUNT(*) AS jumlah
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY bulan
      ORDER BY bulan`,
    [rentang.mulai, rentang.selesai]
  );

  const putus = (await sippSkemaService.tabelAda("perkara_putusan").catch(() => false))
    ? await runQuery(
        `SELECT DATE_FORMAT(d.tanggal_putusan, '%Y-%m') AS bulan, COUNT(*) AS jumlah
           FROM perkara_putusan d
          WHERE d.tanggal_putusan >= ? AND d.tanggal_putusan <= ?
          GROUP BY bulan
          ORDER BY bulan`,
        [rentang.mulai, rentang.selesai]
      )
    : [];

  const peta = new Map();
  masuk.forEach((x) => {
    peta.set(teks(x.bulan), { bulan: teks(x.bulan), masuk: angka(x.jumlah), putus: 0 });
  });
  putus.forEach((x) => {
    const b = teks(x.bulan);
    if (!peta.has(b)) peta.set(b, { bulan: b, masuk: 0, putus: 0 });
    peta.get(b).putus = angka(x.jumlah);
  });

  return [...peta.values()].sort((a, b) => a.bulan.localeCompare(b.bulan));
}

/**
 * ============================================================================
 * BK08 - KESIAPAN BAHAN SIMULASI BEBAN KERJA
 * ============================================================================
 *
 * Katalog menyebut butir ini "model, bukan pengukuran", dan kalimat itu harus
 * dipegang. ALETA tidak menyimpulkan apa yang akan terjadi bila beban berubah;
 * yang dinilai di sini apakah dua laju yang dibutuhkan model antrean paling
 * sederhana pun benar-benar dapat dihitung dari bulan itu:
 *
 *   laju penerimaan   berapa perkara masuk pada bulan itu
 *   laju penyelesaian berapa perkara diputus pada bulan itu
 *
 * Bulan yang laju penyelesaiannya nol membuat model antrean apa pun menyebar
 * tak terhingga - antrean yang hanya bertambah dan tidak pernah berkurang.
 * Angka simulasi yang keluar dari bulan semacam itu akan terbaca dramatis dan
 * tidak berarti apa-apa.
 *
 * Diukur pada SIPP sungguhan: delapan bulan, seluruhnya punya kedua laju,
 * penerimaan 25 sampai 77 dan penyelesaian 23 sampai 71 per bulan.
 */
async function barisKesiapanSimulasi(rentang) {
  if (!(await tabelSiap(["perkara"]))) return [];
  const rekap = await rekapBulanan(rentang);

  return rekap.map((x) => {
    const sebab = [];
    if (x.masuk === 0) sebab.push("tidak ada penerimaan tercatat - laju masuknya tidak dapat dihitung");
    if (x.putus === 0) {
      sebab.push(
        "tidak ada penyelesaian tercatat - laju keluarnya nol, dan model antrean apa pun akan menyebar tak terhingga"
      );
    }

    return {
      kunci: `simulasi-${x.bulan}`,
      bulan: x.bulan,
      lajuMasuk: x.masuk,
      lajuPutus: x.putus,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * BK09 - SISA PERKARA YANG MASIH BERGERAK
 * ============================================================================
 *
 * Proyeksi sisa akhir periode adalah tebakan, dan tebakan tidak dapat diaudit.
 * Yang dapat diaudit keadaan sisanya sekarang: perkara yang belum diputus dan
 * TIDAK punya jadwal sidang adalah perkara yang tidak akan bergerak sendiri.
 * Perkara semacam itu akan tetap menjadi sisa pada tiap proyeksi, dan tidak
 * ada rumus yang dapat memperbaikinya - yang memperbaikinya penetapan hari
 * sidang berikutnya.
 *
 * Diukur pada SIPP sungguhan: 43 perkara belum putus, seluruhnya masih punya
 * jadwal sidang.
 */
async function barisSisaBergerak(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_jadwal_sidang"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar,
            MAX(j.tanggal_sidang) AS sidangTerakhir,
            COUNT(j.id)           AS jumlahSidang
       FROM perkara p
       LEFT JOIN perkara_putusan d
              ON d.perkara_id = p.perkara_id
             AND d.tanggal_putusan IS NOT NULL
             AND d.tanggal_putusan <> '0000-00-00'
       LEFT JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND d.perkara_id IS NULL
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, p.tanggal_pendaftaran
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const punyaSidang = angka(x.jumlahSidang) > 0 && tanggalTerisi(x.sidangTerakhir);

    return {
      kunci: `sisa-${teks(x.nomorPerkara)}`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      tanggal: teks(x.tanggalDaftar),
      sidangTerakhir: teks(x.sidangTerakhir),
      memenuhi: punyaSidang,
      sebabTidakMemenuhi: punyaSidang
        ? ""
        : "belum diputus dan tidak punya jadwal sidang sama sekali - perkara ini tidak akan bergerak sendiri",
    };
  });
}

/**
 * ============================================================================
 * BK10 - KEWAJARAN PERUBAHAN BEBAN ANTAR BULAN
 * ============================================================================
 *
 * Perbandingan antar periode berguna hanya bila kedua periodenya menggambarkan
 * hal yang sama. Bulan yang penerimaannya melonjak berkali lipat hampir selalu
 * berarti penginputan borongan perkara lama - dan bulan semacam itu akan
 * membuat SELURUH perbandingan sesudahnya salah, sebab bulan berikutnya akan
 * tampak anjlok padahal tidak terjadi apa-apa.
 *
 * Bulan pertama pada rentang tidak punya pembanding, dan karena itu tidak ikut
 * dinilai - ia dikeluarkan dari populasi, bukan dihitung gagal.
 *
 * Diukur pada SIPP sungguhan: delapan bulan berturut-turut, dan satu di
 * antaranya tertangkap: April 25 perkara lalu Mei 77 perkara - tiga kali
 * lipat lebih. Enam dari tujuh perbandingan wajar.
 */
async function barisPerubahanAntarBulan(rentang) {
  if (!(await tabelSiap(["perkara"]))) return [];
  const rekap = await rekapBulanan(rentang);
  if (rekap.length < 2) return [];

  const baris = [];
  for (let i = 1; i < rekap.length; i += 1) {
    const kini = rekap[i];
    const lalu = rekap[i - 1];
    const sebab = [];

    if (lalu.masuk === 0 && kini.masuk > 0) {
      sebab.push("bulan sebelumnya tidak mencatat penerimaan sama sekali - perbandingannya tidak berarti");
    } else if (lalu.masuk > 0 && kini.masuk / lalu.masuk >= AMBANG_LONJAKAN_BULANAN) {
      sebab.push(
        `penerimaan melonjak dari ${lalu.masuk} menjadi ${kini.masuk} - lebih dari ${AMBANG_LONJAKAN_BULANAN} kali lipat, biasanya penginputan borongan perkara lama`
      );
    } else if (kini.masuk > 0 && lalu.masuk / Math.max(kini.masuk, 1) >= AMBANG_LONJAKAN_BULANAN) {
      sebab.push(
        `penerimaan anjlok dari ${lalu.masuk} menjadi ${kini.masuk} - lebih dari ${AMBANG_LONJAKAN_BULANAN} kali lipat, biasanya akibat lonjakan bulan sebelumnya`
      );
    }

    baris.push({
      kunci: `banding-${kini.bulan}`,
      bulan: kini.bulan,
      bulanPembanding: lalu.bulan,
      masuk: kini.masuk,
      masukSebelumnya: lalu.masuk,
      putus: kini.putus,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    });
  }

  return baris;
}

/** Sepuluh butir Bab 6, beserta kalimat cara hitungnya. */
const BUTIR = [
  {
    kode: "BK01",
    kunci: "bebanMajelisHakim",
    judul: "Beban Perkara Majelis Hakim",
    keterangan:
      "Apakah tiap perkara dapat dibebankan kepada satu ketua majelis atau hakim tunggal, beserta tanggal sejak kapan ia menjadi bebannya. Perkara tanpa penetapan bukan beban siapa pun, dan penetapan tanpa tanggal adalah beban yang tidak dapat diletakkan pada bulan mana pun.",
    baris: pembangunPenugasan({
      kode: "BK01",
      tabel: "perkara_hakim_pn",
      ruasId: "hakim_id",
      ruasNama: "hakim_nama",
      sebutan: "ketua majelis atau hakim tunggal",
      saringPetugas: "(x.jabatan_hakim_nama LIKE '%etua%' OR x.jabatan_hakim_nama LIKE '%unggal%')",
    }),
    pembilang: "Perkara yang punya tepat satu ketua majelis atau hakim tunggal aktif beserta tanggal penetapannya",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_hakim_pn lewat perkara_id, disaring jabatan ketua atau tunggal dan aktif = Y",
    ruas: "hakim_id, jabatan_hakim_nama, tanggal_penetapan, aktif",
  },
  {
    kode: "BK02",
    kunci: "bebanPaniteraPengganti",
    judul: "Beban Perkara Panitera Pengganti",
    keterangan:
      "Apakah tiap perkara dapat dibebankan kepada satu panitera pengganti beserta tanggal penetapannya. Dihitung menurut panitera_id, bukan menurut namanya - satu orang yang sama tercatat dengan beberapa ejaan nama pada SIPP, dan mengelompokkan menurut nama akan memecah satu orang menjadi beberapa orang yang masing-masing tampak ringan.",
    baris: pembangunPenugasan({
      kode: "BK02",
      tabel: "perkara_panitera_pn",
      ruasId: "panitera_id",
      ruasNama: "panitera_nama",
      sebutan: "panitera pengganti",
    }),
    pembilang: "Perkara yang punya tepat satu panitera pengganti aktif beserta tanggal penetapannya",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_panitera_pn lewat perkara_id, disaring aktif = Y",
    ruas: "panitera_id, tanggal_penetapan, aktif",
  },
  {
    kode: "BK03",
    kunci: "bebanPemanggilanJurusita",
    judul: "Beban Pemanggilan Jurusita",
    keterangan:
      "Beban jurusita bukan jumlah perkaranya melainkan jumlah relaas yang dilaksanakannya - satu perkara dengan pihak ghaib menghabiskan berkali pemanggilan sedangkan perkara e-Court dengan kedua pihak hadir tidak menghabiskan satu pun. Yang dinilai apakah tiap pelaksanaan relaas menyebut pelaksananya, tanggalnya, pihak yang dipanggil, dan hasil bertemunya.",
    baris: barisBebanJurusita,
    pembilang: "Pelaksanaan relaas yang menyebut jurusita, tanggal, pihak, dan hasil bertemunya",
    penyebut: "Seluruh pelaksanaan relaas atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_pelaksanaan_relaas lewat perkara_id",
    ruas: "jurusita_id, tanggal_relaas, pihak_id, ket_temu",
  },
  {
    kode: "BK04",
    kunci: "pemerataanPembagianPerkara",
    judul: "Indeks Pemerataan Pembagian Perkara",
    keterangan:
      "Selisih bagian tiap ketua majelis terhadap bagian rata, beserta koefisien Gini seluruh pembagiannya. Yang dinilai PEMBAGIANNYA, bukan hakimnya - yang membagi perkara bukan hakim yang menerimanya, dan perkara tidak sama besarnya satu sama lain.",
    baris: barisPemerataan,
    pembilang: `Ketua majelis yang bagiannya menyimpang tidak lebih dari ${(
      AMBANG_DEVIASI_PEMERATAAN * 100
    ).toFixed(0)}% dari bagian rata`,
    penyebut: "Seluruh ketua majelis dan hakim tunggal yang memegang perkara pada rentang ini",
    tabel: "perkara disambung perkara_hakim_pn lewat perkara_id, dikelompokkan menurut hakim_id",
    ruas: "hakim_id, hakim_nama, jabatan_hakim_nama, aktif",
  },
  {
    kode: "BK05",
    kunci: "kepadatanJadwalSidang",
    judul: "Kepadatan Jadwal Sidang Harian",
    keterangan: `Pasangan hari dan ruang yang memuat lebih dari ${AMBANG_KEPADATAN_RUANG} persidangan. Gunanya terlihat sebelum harinya tiba - selagi pemanggilannya belum keluar, sebagian jadwalnya masih dapat dipindahkan.`,
    baris: barisKepadatanSidang,
    pembilang: `Pasangan hari-ruang yang memuat tidak lebih dari ${AMBANG_KEPADATAN_RUANG} persidangan`,
    penyebut: "Seluruh pasangan hari-ruang yang memuat persidangan perkara pada rentang ini",
    tabel: "perkara disambung perkara_jadwal_sidang lewat perkara_id, dikelompokkan menurut tanggal dan ruangan",
    ruas: "tanggal_sidang, ruangan",
  },
  {
    kode: "BK06",
    kunci: "pemanfaatanRuangSidang",
    judul: "Pemanfaatan Ruang Sidang",
    keterangan:
      "Hari yang salah satu ruangnya berdesakan sementara ruang lain pada hari yang sama lowong. Hanya hari yang memakai lebih dari satu ruang yang dinilai - pada hari yang memakai satu ruang saja tidak ada yang dapat dibandingkan, dan ruang cadangan yang kosong sepanjang tahun memang seharusnya kosong.",
    baris: barisPemanfaatanRuang,
    pembilang: `Hari yang selisih antara ruang tersibuk dan tersepinya tidak lebih dari ${AMBANG_SELISIH_RUANG} persidangan`,
    penyebut: "Hari sidang pada rentang ini yang memakai lebih dari satu ruang",
    tabel: "perkara disambung perkara_jadwal_sidang lewat perkara_id, dikelompokkan dua tingkat menurut tanggal lalu ruangan",
    ruas: "tanggal_sidang, ruangan",
  },
  {
    kode: "BK07",
    kunci: "bebanTidakTercatatStatistik",
    judul: "Beban Perkara yang Tidak Tercatat",
    keterangan:
      "Delegasi adalah pekerjaan penuh - jurusita berangkat, relaas disusun, biaya dibukukan - tetapi ia tidak menambah satu pun angka pada laporan keadaan perkara sebab perkaranya milik pengadilan lain. Yang dinilai bukan banyaknya, melainkan apakah beban itu tercatat cukup lengkap untuk dapat diperhitungkan.",
    baris: barisBebanTidakTercatat,
    pembilang: "Delegasi yang menyebut nomor perkara, tanggal, jenis, pengadilan lawan, dan tanggal sidang yang dilayaninya",
    penyebut: "Seluruh delegasi masuk dan delegasi keluar yang bertanggal pada rentang ini",
    tabel: "delegasi_masuk dan delegasi_keluar - keduanya berdiri sendiri, tidak disambung ke tabel perkara",
    ruas: "nomor_perkara, tgl_delegasi, jenis_delegasi_text, pn_asal_text, pn_tujuan_text, tgl_sidang",
  },
  {
    kode: "BK08",
    kunci: "kesiapanBahanSimulasiBeban",
    judul: "Simulasi Dampak Perubahan Beban Kerja",
    keterangan:
      "Katalog menyebut butir ini model, bukan pengukuran - dan tebakan tidak dapat diaudit. Yang dinilai kesiapan BAHANNYA: apakah laju penerimaan dan laju penyelesaian bulan itu keduanya dapat dihitung. Bulan yang laju penyelesaiannya nol membuat model antrean apa pun menyebar tak terhingga, dan angka yang keluar darinya terbaca dramatis tanpa berarti apa-apa.",
    baris: barisKesiapanSimulasi,
    pembilang: "Bulan yang punya laju penerimaan dan laju penyelesaian sekaligus, keduanya di atas nol",
    penyebut: "Seluruh bulan pada rentang ini yang memuat penerimaan atau penyelesaian",
    tabel: "perkara dan perkara_putusan, dikelompokkan menurut bulan",
    ruas: "tanggal_pendaftaran, tanggal_putusan",
  },
  {
    kode: "BK09",
    kunci: "sisaPerkaraMasihBergerak",
    judul: "Proyeksi Sisa Perkara Akhir Periode",
    keterangan:
      "Perkara yang belum diputus dan tidak punya jadwal sidang sama sekali. Perkara semacam itu akan tetap menjadi sisa pada tiap proyeksi, dan tidak ada rumus yang dapat memperbaikinya - yang memperbaikinya penetapan hari sidang berikutnya.",
    baris: barisSisaBergerak,
    pembilang: "Perkara sisa yang masih punya jadwal sidang tercatat",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini dan belum punya tanggal putusan",
    tabel: "perkara disambung perkara_putusan dan perkara_jadwal_sidang lewat perkara_id",
    ruas: "tanggal_pendaftaran, tanggal_putusan, tanggal_sidang",
  },
  {
    kode: "BK10",
    kunci: "kewajaranPerubahanBebanBulanan",
    judul: "Perbandingan Beban Antar Periode",
    keterangan: `Bulan yang penerimaannya berubah lebih dari ${AMBANG_LONJAKAN_BULANAN} kali lipat terhadap bulan sebelumnya. Lonjakan sebesar itu hampir selalu berarti penginputan borongan perkara lama, dan bulan semacam itu membuat seluruh perbandingan sesudahnya salah - bulan berikutnya akan tampak anjlok padahal tidak terjadi apa-apa.`,
    baris: barisPerubahanAntarBulan,
    pembilang: `Bulan yang penerimaannya berubah kurang dari ${AMBANG_LONJAKAN_BULANAN} kali lipat terhadap bulan sebelumnya`,
    penyebut: "Seluruh bulan pada rentang ini kecuali bulan pertama, yang tidak punya pembanding",
    tabel: "perkara dan perkara_putusan, dikelompokkan menurut bulan lalu disandingkan berpasangan",
    ruas: "tanggal_pendaftaran, tanggal_putusan",
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
      versiRumus: "beban-kerja-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: b.pembilang,
        penyebut: b.penyebut,
        dikecualikan:
          "Butir yang TABELNYA tidak ada pada SIPP satuan kerja ini tidak menghasilkan baris sama sekali - ia tidak dinilai nol, sebab nol berarti menuduh pengadilan tidak mencatat sesuatu yang memang tidak punya tempat penyimpanan. Bulan pertama pada perbandingan antar periode juga dikeluarkan: ia tidak punya pembanding.",
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
  AMBANG_DEVIASI_PEMERATAAN,
  AMBANG_KEPADATAN_RUANG,
  AMBANG_LONJAKAN_BULANAN,
  AMBANG_SELISIH_RUANG,
  BUTIR,
  barisBebanJurusita,
  barisBebanTidakTercatat,
  barisKepadatanSidang,
  barisPemanfaatanRuang,
  barisPemerataan,
  barisPerubahanAntarBulan,
  barisKesiapanSimulasi,
  barisSisaBergerak,
  daftarkanSemua,
  koefisienGini,
  lupakanSemua,
  rekapBulanan,
  sambungan,
};
