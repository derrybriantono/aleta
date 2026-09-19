"use strict";

/**
 * ============================================================================
 * LAPISAN PETA PERKARA - SEMBILAN PERTANYAAN, SATU BENTUK JAWABAN
 * ============================================================================
 *
 * Tiap lapisan menjawab satu pertanyaan tentang DESA, dan seluruhnya memulangkan
 * bentuk yang sama:
 *
 *     { kode, nilai, keterangan, cukup }
 *
 * `kode` kode wilayah BPS - itulah yang dicocokkan dengan berkas koordinat.
 * `nilai` angka yang diwarnai peta. `cukup` menyatakan apakah barisnya cukup
 * banyak untuk dipersenkan; yang tidak cukup digambar kelabu, bukan diwarnai
 * seperti yang lain - tiga relaas yang dua gagal bukan "67% gagal", itu
 * kebetulan.
 *
 * Satu bentuk untuk sembilan lapisan berarti layar menggambar satu kali dan
 * tidak perlu tahu lapisan mana yang sedang tampil.
 *
 * ============================================================================
 * SETIAP KUERI SUDAH DIJALANKAN ATAS DATA SUNGGUHAN
 * ============================================================================
 *
 * Diukur pada `sipp_donggala` setempat, 19 September 2026. Angka yang dikutip
 * di keterangan tiap lapisan hasil pengukuran itu.
 *
 * ============================================================================
 * SYARAT YANG MEMBUNGKUS KOLOM TANGGAL SENGAJA DIHINDARI
 * ============================================================================
 *
 * `YEAR(tgl) = ?` memaksa MySQL menghitung fungsinya untuk SETIAP baris lebih
 * dahulu - indeksnya tidak terpakai. Terukur pada analisis tambahan: satu kueri
 * turun dari 17.952 ms menjadi 94 ms hanya dengan menggantinya BETWEEN. Yang
 * dipakai di sini karena itu selalu rentang tanggal.
 */

const db = require("../db_config");

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

const bersih = (x) => String(x === null || x === undefined ? "" : x).trim();
const bilangan = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

/**
 * Ambang minimal baris sebelum sebuah desa boleh dipersenkan.
 *
 * Sengaja tidak satu angka untuk semua: sidang jauh lebih banyak daripada
 * panggilan, dan panggilan jauh lebih banyak daripada pihak berulang.
 */
const AMBANG = { kehadiran: 10, biaya: 5, perubahan: 8 };

/* ==========================================================================
 * 1. BIAYA PANGGILAN
 * ==========================================================================
 *
 * Terukur: Alitupu (Napu, Poso) rata Rp 409.800 per panggilan, Sibayu
 * Rp 166.208 - dua setengah kali lipat. Berguna menakar panjar dan menilai
 * kewajaran radius.
 *
 * Dibaca dari `uraian` yang menyebut "panggil", sebab `perkara_biaya` tidak
 * punya kolom nama jenis biaya - hanya `jenis_biaya_id` tanpa tabel rujukan
 * yang dapat dipercaya.
 */
async function biayaPanggilan(dari, sampai) {
  const baris = await kueri(
    `SELECT p.kelurahan AS kode, COUNT(*) AS n, ROUND(AVG(b.jumlah)) AS rata
       FROM perkara_biaya b
       JOIN pihak p ON p.id = b.pihak_id
      WHERE b.uraian LIKE '%anggil%' AND b.jumlah > 0
        AND b.tanggal_transaksi BETWEEN ? AND ?
        AND p.kelurahan IS NOT NULL AND p.kelurahan NOT IN ('', '0')
      GROUP BY p.kelurahan`,
    [dari, sampai]
  );
  return {
    satuan: "rupiah",
    judul: "Biaya panggilan",
    keterangan:
      "Rata-rata biaya satu panggilan di desa itu. Terukur: Alitupu Rp 409.800 lawan Sibayu " +
      "Rp 166.208 - dua setengah kali lipat. Dibaca dari uraian biaya yang menyebut \"panggil\", " +
      "sebab perkara_biaya tidak punya kolom nama jenis biaya.",
    desa: baris.map((b) => ({
      kode: bersih(b.kode),
      nilai: bilangan(b.rata),
      keterangan: `${bilangan(b.n)} panggilan`,
      cukup: bilangan(b.n) >= AMBANG.biaya,
    })),
  };
}

/* ==========================================================================
 * 2. FAKTOR PERCERAIAN DOMINAN
 * ==========================================================================
 *
 * Terisi pada 4.603 dari 4.607 akta cerai. Yang dipulangkan faktor TERBANYAK
 * di desa itu beserta porsinya - bukan daftar seluruh faktor, sebab peta hanya
 * dapat mewarnai satu hal per titik.
 */
async function faktorDominan(dari, sampai) {
  const baris = await kueri(
    `SELECT p.kelurahan AS kode, ac.faktor_perceraian_id AS faktorId,
            f.nama AS faktor, COUNT(*) AS n
       FROM perkara_akta_cerai ac
       JOIN perkara_pihak1 x ON x.perkara_id = ac.perkara_id
       JOIN pihak p ON p.id = x.pihak_id
       LEFT JOIN faktor_perceraian f ON f.id = ac.faktor_perceraian_id
      WHERE ac.faktor_perceraian_id > 0
        AND ac.tgl_akta_cerai BETWEEN ? AND ?
        AND p.kelurahan IS NOT NULL AND p.kelurahan <> ''
      GROUP BY p.kelurahan, ac.faktor_perceraian_id, f.nama`,
    [dari, sampai]
  );

  // Dikelompokkan di Node: satu lintasan, dan yang dicari hanya yang terbanyak
  // per desa. Memintanya kepada MySQL menuntut tabel turunan berjendela yang
  // jauh lebih mahal daripada seluruh barisnya sendiri.
  const peta = new Map();
  for (const b of baris) {
    const kode = bersih(b.kode);
    const n = bilangan(b.n);
    const isi = peta.get(kode) || { kode, semua: 0, faktorId: 0, faktor: "", puncak: 0 };
    isi.semua += n;
    if (n > isi.puncak) {
      isi.puncak = n;
      isi.faktorId = bilangan(b.faktorId);
      isi.faktor = bersih(b.faktor) || `faktor ${bilangan(b.faktorId)}`;
    }
    peta.set(kode, isi);
  }

  return {
    satuan: "kategori",
    judul: "Faktor perceraian dominan",
    keterangan:
      "Faktor yang paling sering disebut akta cerai desa itu. Terisi pada 4.603 dari 4.607 akta. " +
      "Hanya perkara yang sudah BERAKTA yang terhitung - yang diputus tetapi aktanya belum terbit " +
      "tidak muncul.",
    desa: [...peta.values()].map((x) => ({
      kode: x.kode,
      nilai: x.faktorId,
      label: x.faktor,
      keterangan: `${x.puncak} dari ${x.semua} akta`,
      cukup: x.semua >= 3,
    })),
  };
}

/* ==========================================================================
 * 3. KEHADIRAN PIHAK
 * ==========================================================================
 *
 * BERBEDA dari lapisan panggilan tidak bertemu, dan perbedaannya penting:
 * yang di sini SUDAH dipanggil dan panggilannya sampai - ia tetap tidak datang.
 * Yang satu masalah jurusita, yang ini masalah kepatuhan pihak.
 */
async function kehadiran(dari, sampai) {
  const baris = await kueri(
    `SELECT p.kelurahan AS kode, COUNT(*) AS sidang,
            SUM(j.dihadiri_oleh = 4) AS takHadir
       FROM perkara_jadwal_sidang j
       JOIN perkara_pihak1 x ON x.perkara_id = j.perkara_id
       JOIN pihak p ON p.id = x.pihak_id
      WHERE j.tanggal_sidang BETWEEN ? AND ?
        AND j.dihadiri_oleh IS NOT NULL
        AND p.kelurahan IS NOT NULL AND p.kelurahan <> ''
      GROUP BY p.kelurahan`,
    [dari, sampai]
  );
  return {
    satuan: "persen",
    judul: "Pihak tidak hadir",
    keterangan:
      "Sidang yang tidak dihadiri siapa pun, padahal panggilannya sampai. Berbeda dari lapisan " +
      "panggilan tidak bertemu: yang itu masalah jurusita, yang ini kepatuhan pihak.",
    desa: baris.map((b) => {
      const sidang = bilangan(b.sidang);
      const tak = bilangan(b.takHadir);
      return {
        kode: bersih(b.kode),
        nilai: sidang > 0 ? Math.round((tak / sidang) * 100) : 0,
        keterangan: `${tak} dari ${sidang} sidang`,
        cukup: sidang >= AMBANG.kehadiran,
      };
    }),
  };
}

/* ==========================================================================
 * 4. PIHAK BERULANG
 * ==========================================================================
 *
 * Terukur: 295 orang di seluruh basis data berperkara lebih dari sekali, dan
 * mereka mengelompok - Kalukubula 8 orang, satu desa di Sigi Biromaru 12 orang.
 *
 * Dicocokkan lewat NIK, bukan nama. Nama berulang jauh lebih sering daripada
 * yang dikira, dan "Muhammad" yang sama di dua desa bukan orang yang sama.
 */
async function pihakBerulang(dari, sampai) {
  const baris = await kueri(
    `SELECT kode, COUNT(*) AS orang, SUM(jml) AS perkara FROM (
       SELECT p.kelurahan AS kode, p.nomor_indentitas AS nik,
              COUNT(DISTINCT x.perkara_id) AS jml
         FROM pihak p
         JOIN perkara_pihak1 x ON x.pihak_id = p.id
         JOIN perkara pk ON pk.perkara_id = x.perkara_id
        WHERE p.nomor_indentitas <> ''
          AND p.kelurahan IS NOT NULL AND p.kelurahan <> ''
          AND pk.tanggal_pendaftaran BETWEEN ? AND ?
        GROUP BY p.kelurahan, p.nomor_indentitas
       HAVING COUNT(DISTINCT x.perkara_id) > 1
     ) t GROUP BY kode`,
    [dari, sampai]
  );
  return {
    satuan: "orang",
    judul: "Pihak berulang",
    keterangan:
      "Orang yang berperkara lebih dari sekali, dicocokkan lewat NIK - bukan nama. Terukur 295 " +
      "orang di seluruh basis data. NIK hanya terisi pada 35% pihak, jadi angka ini BATAS BAWAH.",
    desa: baris.map((b) => ({
      kode: bersih(b.kode),
      nilai: bilangan(b.orang),
      keterangan: `${bilangan(b.perkara)} perkara`,
      cukup: true,
    })),
  };
}

/* ==========================================================================
 * 5. PERUBAHAN ANTAR TAHUN
 * ==========================================================================
 *
 * Desa yang perkaranya MELONJAK lebih menarik daripada desa yang memang selalu
 * banyak. Terukur: Labuan Toposo 8 perkara (2025) menjadi 46 (2026), dan satu
 * desa di Sigi Biromaru dari 0 menjadi 33.
 */
async function perubahanTahun(dari, sampai) {
  const tahunIni = Number(String(sampai).slice(0, 4)) || new Date().getFullYear();
  const tahunLalu = tahunIni - 1;
  const baris = await kueri(
    `SELECT p.kelurahan AS kode,
            SUM(pp.tanggal_putusan BETWEEN ? AND ?) AS kini,
            SUM(pp.tanggal_putusan BETWEEN ? AND ?) AS lalu
       FROM perkara_putusan pp
       JOIN perkara_pihak1 x ON x.perkara_id = pp.perkara_id
       JOIN pihak p ON p.id = x.pihak_id
      WHERE pp.tanggal_putusan BETWEEN ? AND ?
        AND p.kelurahan IS NOT NULL AND p.kelurahan <> ''
      GROUP BY p.kelurahan`,
    [
      `${tahunIni}-01-01`,
      `${tahunIni}-12-31`,
      `${tahunLalu}-01-01`,
      `${tahunLalu}-12-31`,
      `${tahunLalu}-01-01`,
      `${tahunIni}-12-31`,
    ]
  );
  return {
    satuan: "selisih",
    judul: `Perubahan ${tahunLalu} ke ${tahunIni}`,
    keterangan:
      `Selisih perkara ${tahunLalu} ke ${tahunIni}. Terukur: Labuan Toposo 8 menjadi 46, dan satu ` +
      "desa Sigi Biromaru dari nol menjadi 33. Desa yang melonjak lebih menarik daripada desa yang " +
      "memang selalu banyak.",
    desa: baris.map((b) => {
      const kini = bilangan(b.kini);
      const lalu = bilangan(b.lalu);
      return {
        kode: bersih(b.kode),
        nilai: kini - lalu,
        keterangan: `${lalu} → ${kini}`,
        cukup: kini + lalu >= AMBANG.perubahan,
      };
    }),
  };
}

/* ==========================================================================
 * 6. LOKASI SIDANG KELILING YANG SUDAH ADA
 * ==========================================================================
 *
 * Tanpa ini, usulan sidang keliling tidak dapat dinilai siapa pun: yang
 * terlihat hanya desa jauh, bukan desa jauh YANG BELUM TERLAYANI.
 *
 * Terukur: Sidang Keliling Sigi Biromaru 126 sidang, Rio Pakava 40, Terpadu
 * Sindue 39.
 */
async function kelilingAda(dari, sampai) {
  const baris = await kueri(
    `SELECT ruangan AS tempat, COUNT(*) AS sidang,
            COUNT(DISTINCT perkara_id) AS perkara,
            MAX(tanggal_sidang) AS terakhir
       FROM perkara_jadwal_sidang
      WHERE (ruangan LIKE '%eliling%' OR ruangan LIKE '%erpadu%')
        AND tanggal_sidang BETWEEN ? AND ?
      GROUP BY ruangan
      ORDER BY sidang DESC`,
    [dari, sampai]
  );
  return {
    judul: "Sidang keliling yang sudah ada",
    keterangan:
      "Diambil dari nama ruangan sidang. Terukur: Sigi Biromaru 126 sidang, Rio Pakava 40, " +
      "Terpadu Sindue 39.",
    tempat: baris.map((b) => ({
      tempat: bersih(b.tempat),
      sidang: bilangan(b.sidang),
      perkara: bilangan(b.perkara),
      terakhir: b.terakhir instanceof Date ? b.terakhir.toISOString().slice(0, 10) : bersih(b.terakhir).slice(0, 10),
    })),
  };
}

/* ==========================================================================
 * 7. JURUSITA PER DESA
 * ==========================================================================
 *
 * Siapa yang melayani desa mana. Disandingkan dengan lapisan panggilan tidak
 * bertemu, ia menjawab pertanyaan pembagian tugas - bukan menilai orangnya.
 *
 * ==========================================================================
 * DUA KOLOM BERNAMA jurusita_id YANG BUKAN HAL YANG SAMA
 * ==========================================================================
 *
 * Susunan pertama menyambung `perkara_pelaksanaan_relaas.jurusita_id` ke
 * `perkara_jurusita.jurusita_id`. Namanya sama, isinya bukan: dari 14.495
 * relaas, NOL yang menemukan namanya. Tidak ada galat - hanya kolom nama yang
 * kosong seluruhnya, dan peta yang seluruh desanya bertulis "tidak tercatat".
 *
 * Yang benar tabel induk `jurusita` lewat `id`: 7.101 dari 14.495 (49%).
 *
 * ==========================================================================
 * SATU ORANG, LIMA EJAAN
 * ==========================================================================
 *
 * Terukur pada tabel `jurusita`:
 *
 *     MOH.SYUKRI, S.H        2.727 relaas
 *     Mohammad Syukri, SH    1.041
 *     Moh.Syukri               478
 *     MOH SYUKRI               431
 *
 * Empat baris itu satu orang. Dihitung apa adanya, ia tampak sebagai empat
 * jurusita yang masing-masing memikul seperempat beban. Ejaannya TIDAK
 * disatukan di sini - menyamakan nama orang dengan menebak kemiripan adalah
 * cara tercepat menggabungkan dua orang yang berbeda. Yang dikerjakan
 * menyebutkan keadaan itu di layar.
 */
async function jurusitaDesa(dari, sampai) {
  const baris = await kueri(
    `SELECT p.kelurahan AS kode, js.nama AS jurusita, COUNT(*) AS n
       FROM perkara_pelaksanaan_relaas r
       JOIN pihak p ON p.id = r.pihak_id
       LEFT JOIN jurusita js ON js.id = r.jurusita_id
      WHERE r.tanggal_relaas BETWEEN ? AND ?
        AND p.kelurahan IS NOT NULL AND p.kelurahan NOT IN ('', '0')
      GROUP BY p.kelurahan, js.nama`,
    [dari, sampai]
  );

  const peta = new Map();
  for (const b of baris) {
    const kode = bersih(b.kode);
    const n = bilangan(b.n);
    const isi = peta.get(kode) || { kode, semua: 0, nama: "", puncak: 0, orang: 0 };
    isi.semua += n;
    isi.orang += 1;
    if (n > isi.puncak) {
      isi.puncak = n;
      isi.nama = bersih(b.jurusita) || "tidak tercatat";
    }
    peta.set(kode, isi);
  }

  return {
    satuan: "kategori",
    judul: "Jurusita yang melayani",
    keterangan:
      "Jurusita yang paling sering mengantar relaas ke desa itu. Nama terbaca pada 7.101 dari " +
      "14.495 relaas (49%). SATU ORANG KADANG PUNYA BEBERAPA EJAAN di tabel jurusita - " +
      "\"MOH.SYUKRI, S.H\" 2.727 relaas dan \"Mohammad Syukri, SH\" 1.041 adalah orang yang sama - " +
      "dan ejaannya sengaja tidak disatukan: menebak kemiripan nama adalah cara tercepat " +
      "menggabungkan dua orang yang berbeda.",
    desa: [...peta.values()].map((x) => ({
      kode: x.kode,
      nilai: x.orang,
      label: x.nama,
      keterangan: `${x.puncak} dari ${x.semua} relaas`,
      cukup: x.semua >= 3,
    })),
  };
}

/* ==========================================================================
 * 8. DESA YANG TIDAK PERNAH BERPERKARA
 * ==========================================================================
 *
 * TERUKUR, DAN HASILNYA MENGEJUTKAN: dari seluruh desa Kabupaten Donggala,
 * hanya 13 yang tidak pernah muncul sama sekali. Lapisan ini karena itu jauh
 * lebih kecil daripada yang dibayangkan - dan itu sendiri jawaban: hampir tiap
 * desa di wilayah hukum ini pernah berperkara.
 */
async function desaKosong(indukKabupaten) {
  const induk = bersih(indukKabupaten).replace(/[^0-9.]/g, "");
  if (!induk) return { judul: "Desa tanpa perkara", desa: [], keterangan: "" };
  const baris = await kueri(
    `SELECT kl.kelurahan_kode AS kode, kl.kelurahan_nama AS nama, kc.kecamatan_nama AS kecamatan
       FROM ref_kelurahan_new kl
       LEFT JOIN ref_kecamatan_new kc ON kc.kecamatan_kode = kl.kecamatan_kode
      WHERE kl.kelurahan_kode LIKE ?
        AND NOT EXISTS (SELECT 1 FROM pihak p WHERE p.kelurahan = kl.kelurahan_kode)
      ORDER BY kc.kecamatan_nama, kl.kelurahan_nama
      LIMIT 500`,
    [`${induk}.%`]
  );
  return {
    judul: "Desa tanpa perkara",
    keterangan:
      "Desa yang tidak pernah muncul pada data pihak sama sekali. Terukur di Kabupaten Donggala: " +
      "hanya 13 dari seluruh desanya - hampir tiap desa di wilayah hukum ini pernah berperkara.",
    desa: baris.map((b) => ({
      kode: bersih(b.kode),
      nama: bersih(b.nama),
      kecamatan: bersih(b.kecamatan),
    })),
  };
}

const LAPISAN = Object.assign(Object.create(null), {
  biaya: biayaPanggilan,
  faktor: faktorDominan,
  kehadiran,
  berulang: pihakBerulang,
  perubahan: perubahanTahun,
  jurusita: jurusitaDesa,
});

module.exports = {
  LAPISAN,
  AMBANG,
  kelilingAda,
  desaKosong,
  // Diekspor untuk diuji satuan.
  biayaPanggilan,
  faktorDominan,
  kehadiran,
  pihakBerulang,
  perubahanTahun,
  jurusitaDesa,
};
