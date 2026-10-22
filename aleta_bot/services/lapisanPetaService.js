"use strict";

const { relaasRetur, sqlRetur } = require("./returRelaas");

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
 * jurusita_id PADA RELAAS BUKAN id JURUSITA - IA userid PENGGUNA SIPP
 * ==========================================================================
 *
 * Tiga sambungan dicoba, dan hanya satu yang benar. Diukur pada 14.495 baris
 * perkara_pelaksanaan_relaas satker, 23 September 2026:
 *
 *     ke perkara_jurusita.jurusita_id        0 dari 14.495  (0%)
 *     ke jurusita.id                     7.101 dari 14.495  (49%)
 *     ke sys_users.userid               14.490 dari 14.495  (99,97%)
 *
 * Dibuktikan pula oleh SIPP sendiri: data_relaas_c.php menulis
 * 'jurusita_id' => $this->session->userdata('userid') - yang disimpan di
 * sana userid orang yang MENGINPUT, bukan id jurusita.
 *
 * Bukti ketiga yang berdiri sendiri: kolom diinput_oleh pada baris yang sama
 * mencocokkan sys_users.username pada 14.490 dari 14.490 - seratus persen.
 *
 * ==========================================================================
 * "SATU ORANG, LIMA EJAAN" ITU KELIRU - MEREKA LIMA ORANG YANG BERBEDA
 * ==========================================================================
 *
 * Catatan lama di sini menyimpulkan bahwa empat ejaan pada tabel `jurusita`
 * adalah satu orang yang sama, dan memutuskan untuk tidak menyatukannya.
 * Kesimpulan itu salah, dan salahnya ke arah yang paling merugikan: nama yang
 * disandingkan memang tidak cocok dengan orangnya.
 *
 *   userid  nama dari tabel jurusita   nama sebenarnya (sys_users)   baris
 *   ------  ------------------------   --------------------------   -----
 *     18    MOH.SYUKRI, S.H            Mohammad Syukri, S.H.        2.727  benar
 *     20    MOH.SAM'AN                 Nurhadi                      2.016  SALAH
 *     21    Mohammad Syukri, SH        Aguslin                      1.041  SALAH
 *     17    Moh.Syukri                 Muh. Sam'an                    478  SALAH
 *     19    MOH SYUKRI                 Fikrianto, S.H.                431  SALAH
 *      1    Fikrianto, S.H.            (akun admin)                   408  SALAH
 *     44    (tidak ada)                Tanty Restianty              3.279  HILANG
 *     68    (tidak ada)                Mustini                      2.429  HILANG
 *
 * Jadi 4.374 dari 7.101 baris yang dinamai (61,6%) menyebut ORANG LAIN, dan
 * dua jurusita tersibuk - Tanty Restianty dan Mustini, bersama 5.708 relaas -
 * tidak pernah muncul sama sekali karena userid mereka tidak ada di tabel
 * `jurusita`.
 *
 * Tabel `jurusita` sendiri memang basi: user_jurusita memetakan userid 17
 * yang fullname-nya "Muh. Sam'an" ke Aguslin, userid 43 "Artia Toha" ke
 * Mohammad Syukri, dan seterusnya. Karena itu ia tidak dipakai untuk nama.
 *
 * Peta ini menyebut siapa yang melayani desa mana. Menyebut nama yang keliru
 * di sana bukan ketidakrapian - ia menuduh orang yang tidak mengerjakannya,
 * dan memuji orang yang tidak mengantarkannya.
 */
async function jurusitaDesa(dari, sampai) {
  const baris = await kueri(
    `SELECT p.kelurahan AS kode,
            COALESCE(NULLIF(u.fullname, ''), NULLIF(r.diinput_oleh, '')) AS jurusita,
            COUNT(*) AS n
       FROM perkara_pelaksanaan_relaas r
       JOIN pihak p ON p.id = r.pihak_id
       LEFT JOIN sys_users u ON u.userid = r.jurusita_id
      WHERE r.tanggal_relaas BETWEEN ? AND ?
        AND p.kelurahan IS NOT NULL AND p.kelurahan NOT IN ('', '0')
      GROUP BY p.kelurahan, jurusita`,
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
      "Jurusita yang paling sering mengantar relaas ke desa itu. Namanya dibaca dari akun " +
      "penggunanya di SIPP - terbaca pada 14.490 dari 14.495 relaas (99,97%). Sampai 2.33.0 " +
      "nama itu dicari di tabel jurusita lewat id yang bukan miliknya, dan 61,6% baris yang " +
      "bernama menyebut ORANG LAIN sementara dua jurusita tersibuk tidak pernah muncul.",
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

/**
 * Keadaan ikrar talak per desa (permintaan hakim 19 Okt 2026). Hitungannya
 * milik petaPerkaraService - satu aturan keadaan untuk halaman dan peta - dan
 * dibaca LAZY di sini: petaPerkaraService tidak boleh tergantung balik pada
 * berkas ini.
 */
function keadaanIkrarTalak(dari, sampai) {
  return require("./petaPerkaraService").lapisanIkrar(dari, sampai);
}

const LAPISAN = Object.assign(Object.create(null), {
  ikrar: keadaanIkrarTalak,
  biaya: biayaPanggilan,
  faktor: faktorDominan,
  kehadiran,
  berulang: pihakBerulang,
  perubahan: perubahanTahun,
  jurusita: jurusitaDesa,
});

/**
 * ============================================================================
 * SEBARAN RELAAS PER JURUSITA - PERTANYAAN YANG BERLAWANAN ARAH
 * ============================================================================
 *
 * Lapisan "Jurusita yang melayani" menjawab "siapa yang paling sering ke desa
 * ini". Yang ditanyakan di sini kebalikannya, dan ia dibaca orang yang
 * berbeda: ketua atau panitera yang hendak membagi beban, bukan yang sedang
 * melihat peta.
 *
 *     desa mana saja yang dikerjakan orang ini
 *     berapa relaas, berapa desa, berapa yang KEMBALI
 *
 * Diminta pengguna 22 September 2026.
 *
 * ============================================================================
 * BERDIRI DI ATAS SAMBUNGAN NAMA YANG BARU DIBETULKAN
 * ============================================================================
 *
 * Sampai 2.33.0 nama jurusita dicari di tabel `jurusita` lewat id yang bukan
 * miliknya - jurusita_id pada relaas adalah sys_users.userid, bukan
 * jurusita.id. Akibatnya 61,6% baris yang bernama menyebut ORANG LAIN, dan
 * dua jurusita tersibuk (Tanty Restianty 3.279 relaas, Mustini 2.429) tidak
 * pernah muncul sama sekali.
 *
 * Daftar beban yang disusun di atas sambungan itu bukan sekadar tidak
 * berguna - ia menuduh orang yang salah, dengan angka yang tampak pasti.
 *
 * ============================================================================
 * RETUR DIBACA DARI status_pos, DAN HANYA ITU
 * ============================================================================
 *
 * status_pos = 2 berarti surat kembali. Panggilan yang gagal karena jurusita
 * tidak bertemu pihaknya TIDAK dihitung di sini - itu sandi ket_temu, dan
 * keduanya persoalan yang berbeda: yang satu alamatnya, yang lain orangnya.
 */
async function sebaranJurusita(dari, sampai) {
  const baris = await kueri(
    `SELECT COALESCE(NULLIF(u.fullname, ''), NULLIF(r.diinput_oleh, '')) AS jurusita,
            p.kelurahan AS desa,
            COUNT(*) AS n,
            SUM(CASE WHEN ${sqlRetur("r")} THEN 1 ELSE 0 END) AS retur
       FROM perkara_pelaksanaan_relaas r
       LEFT JOIN pihak p ON p.id = r.pihak_id
       LEFT JOIN sys_users u ON u.userid = r.jurusita_id
      WHERE r.tanggal_relaas BETWEEN ? AND ?
      GROUP BY jurusita, p.kelurahan`,
    [dari, sampai]
  );

  const orang = new Map();
  for (const b of baris) {
    // Yang namanya tidak terbaca dikumpulkan sendiri, bukan dibuang. Nol
    // relaas tanpa nama akan terbaca sebagai "seluruhnya sudah bernama" -
    // dan justru ketidaklengkapannya yang perlu diketahui.
    // "0" diperlakukan sama dengan kosong: itu nilai bawaan kolom
    // diinput_oleh yang tidak pernah diisi, bukan nama seseorang.
    const namaMentah = bersih(b.jurusita);
    const nama = !namaMentah || namaMentah === "0" ? "tidak tercatat" : namaMentah;
    const isi = orang.get(nama) || { nama, relaas: 0, retur: 0, desa: new Map() };
    const n = bilangan(b.n);
    const kembali = bilangan(b.retur);
    isi.relaas += n;
    isi.retur += kembali;
    const kodeDesa = bersih(b.desa);
    if (kodeDesa && kodeDesa !== "0") {
      const lama = isi.desa.get(kodeDesa) || { kode: kodeDesa, relaas: 0, retur: 0 };
      lama.relaas += n;
      lama.retur += kembali;
      isi.desa.set(kodeDesa, lama);
    }
    orang.set(nama, isi);
  }

  const daftar = [...orang.values()]
    .map((x) => ({
      nama: x.nama,
      relaas: x.relaas,
      retur: x.retur,
      // Persen retur disusun di sini, bukan di layar: dua layar yang
      // menghitungnya sendiri-sendiri akan berselisih pada pembulatan.
      persenRetur: x.relaas > 0 ? Math.round((x.retur / x.relaas) * 1000) / 10 : 0,
      jumlahDesa: x.desa.size,
      desa: [...x.desa.values()].sort((a, b) => b.relaas - a.relaas).slice(0, 25),
    }))
    .sort((a, b) => b.relaas - a.relaas);

  const total = daftar.reduce((n, x) => n + x.relaas, 0);
  const tanpaNama = daftar.find((x) => x.nama === "tidak tercatat");

  return {
    dari,
    sampai,
    total,
    // Disebutkan apa adanya supaya angkanya dapat ditimbang. Daftar beban
    // yang menyembunyikan bagian tak bernamanya akan dibaca sebagai lengkap.
    tanpaNama: tanpaNama ? tanpaNama.relaas : 0,
    jurusita: daftar.filter((x) => x.nama !== "tidak tercatat"),
  };
}

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
  sebaranJurusita,
};
