"use strict";

/**
 * ============================================================================
 * RAPOR KINERJA APARATUR - SISA BAB 7 KATALOG
 * ============================================================================
 *
 * Delapan butir dari sepuluh yang tersisa. Empat rapor pokok (majelis, hakim
 * perorangan, panitera pengganti, jurusita) sudah dikerjakan
 * raporAparaturService; berkas ini melengkapi sisanya.
 *
 * Dua yang tidak disambungkan, diperiksa pada datanya:
 *
 *   AP07 petugas meja informasi. Tidak ada satu pun tabel layanan informasi
 *        atau permohonan salinan pada SIPP satuan kerja ini.
 *
 *   AP12 uji keandalan antar penilai - "dua petugas menilai berkas yang sama,
 *        apakah hasilnya sama". Itu menuntut catatan penilaian MANUAL oleh dua
 *        orang atas berkas yang sama, dan ALETA belum punya tempat mencatatnya.
 *        Tabel aleta_bot_ecourt_verifications yang sempat disangka bahannya
 *        ternyata verifikasi dokumen e-Court oleh SATU hakim, dan kosong.
 *
 * ============================================================================
 * RAPOR MENILAI ORANG - DAN KARENA ITU PALING PERLU BERHATI-HATI
 * ============================================================================
 *
 * Bab lain menilai pembagian, bahan, atau alat ukur. Bab ini menilai APARATUR,
 * dan angkanya akan dibaca oleh orang yang namanya tertulis di situ.
 *
 * Tiga hal dipegang di seluruh berkas ini:
 *
 *   1. Pengenal memakai kolom _id, bukan nama. Satu orang tercatat dengan
 *      beberapa ejaan - "Lely Syahfitri, A.Md." dan "Lely Syahfitri, A.Md"
 *      adalah orang yang sama pada tabel arsip.
 *
 *   2. Pembatas dua puluh perkara dipegang. Rapor atas lima perkara bukan
 *      rapor; ia potret satu bulan yang kebetulan.
 *
 *   3. Yang tidak memenuhi disebut sebabnya, dan sebab itu hampir selalu
 *      BUKAN orangnya: pembagian yang timpang, kolom yang tidak diisi orang
 *      lain, atau akun yang dipakai bersama.
 *
 * ============================================================================
 * YANG DITEMUKAN SAAT MENGUKUR
 * ============================================================================
 *
 * Minutasi selalu HARI YANG SAMA dengan putusan - 388 dari 388, tanpa satu
 * pun jarak lebih dari satu hari. Itu terlalu rapi untuk pekerjaan manusia,
 * dan lebih mungkin berarti tanggal_minutasi terisi otomatis dari tanggal
 * putusan. Rapor penyusun konsep karena itu tidak dapat mengukur apa yang
 * katalog minta - putaran perbaikan - sebab jejaknya tidak ada.
 *
 * Tabel arsip menautkan perkaranya lewat NOMOR, bukan perkara_id: 275 dari
 * 279 baris arsip tahun 2024 ber-perkara_id nol, dan nomornya berekor titik
 * ("521/Pdt.G/2023/PA.Buk.") yang tidak ada pada tabel perkara. Butir arsip
 * di Bab 5 dan Bab 10 yang menautkan lewat perkara_id hanya melihat empat
 * baris - dan menyimpulkan hampir tidak ada yang diarsipkan. Yang benar: 279
 * berkas diarsipkan, 48 di antaranya lebih dari sebulan sesudah minutasi.
 *
 * Akun "kasir3" mencatat 965 tindakan. Akun yang tidak menyebut orang tidak
 * dapat dimintai pertanggungjawaban, dan rapor per aparatur berhenti berarti
 * pada baris itu.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

const BATAS_BARIS = 5000;

/** Pembatas rapor perorangan - di bawah ini rapor tidak disusun. */
const MINIMAL_PERKARA_RAPOR = 20;

/** Mediasi minimal sebelum tingkat keberhasilan seorang mediator berarti. */
const MINIMAL_MEDIASI = 5;

/** Tenggang minutasi sesudah putusan, dan tenggang arsip sesudah minutasi. */
const HARI_TENGGANG_MINUTASI = 14;
const HARI_TENGGANG_ARSIP = 30;

/** Seberapa jauh majelis boleh menyimpang dari nilai tengah pengadilan. */
const AMBANG_DEVIASI_TENGAH = 0.25;

/** Asas penyelesaian tingkat pertama. */
const HARI_ASAS_PENYELESAIAN = 150;

/** Pola akun yang tidak menyebut orang - akun bersama atau akun jabatan. */
const POLA_AKUN_BERSAMA = /^(kasir|admin|administrator|user|operator|petugas|meja|ptsp|root|test|tes)\d*$/i;

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

function selisihHari(awal, akhir) {
  if (!tanggalTerisi(awal) || !tanggalTerisi(akhir)) return null;
  const a = new Date(awal);
  const b = new Date(akhir);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

function bulanDari(nilai) {
  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) {
    return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}`;
  }
  return teks(nilai).slice(0, 7);
}

function nilaiTengah(daftar) {
  if (!daftar.length) return null;
  const urut = [...daftar].sort((a, b) => a - b);
  const t = Math.floor(urut.length / 2);
  return urut.length % 2 ? urut[t] : (urut[t - 1] + urut[t]) / 2;
}

async function tabelSiap(daftar) {
  for (const t of daftar) {
    const ada = await sippSkemaService.tabelAda(t).catch(() => false);
    if (!ada) return false;
  }
  return true;
}

/**
 * Perkara yang diputus beserta majelis, PP, dan ukuran-ukurannya.
 *
 * Dipakai bersama oleh lima butir. Satu definisi "lama penyelesaian" untuk
 * seluruh rapor - dua definisi yang sedikit berbeda menghasilkan dua rapor
 * yang tidak dapat disandingkan, dan orang yang namanya ada di situ akan
 * menanyakan mana yang benar.
 */
async function muatPutusan(rentang) {
  return runQuery(
    `SELECT p.perkara_id          AS perkaraId,
            p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar,
            d.tanggal_putusan     AS tanggalPutusan,
            d.tanggal_minutasi    AS tanggalMinutasi,
            d.amar_putusan        AS amar,
            h.hakim_id            AS hakimId,
            h.hakim_nama          AS hakimNama,
            x.panitera_id         AS paniteraId,
            x.panitera_nama       AS paniteraNama,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id)                    AS jumlahSidang,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id AND j.ditunda = 'Y') AS jumlahTunda
       FROM perkara p
       JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
       LEFT JOIN perkara_hakim_pn h
              ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
             AND (h.jabatan_hakim_nama LIKE '%etua%' OR h.jabatan_hakim_nama LIKE '%unggal%')
       LEFT JOIN perkara_panitera_pn x
              ON x.perkara_id = p.perkara_id AND x.aktif = 'Y'
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND d.tanggal_putusan IS NOT NULL AND d.tanggal_putusan <> '0000-00-00'
      GROUP BY p.perkara_id
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );
}

function lamaPenyelesaian(x) {
  const n = selisihHari(x.tanggalDaftar, x.tanggalPutusan);
  return n === null || n < 0 ? null : n;
}

/**
 * ============================================================================
 * AP05 - RAPOR PENYUSUN KONSEP PUTUSAN
 * ============================================================================
 *
 * Katalog meminta rentang putus ke konsep, koreksi, dan minutasi, beserta
 * putaran perbaikannya. SIPP satuan kerja ini tidak menyimpan konsep maupun
 * koreksi - tabel perkara_dokumen kosong untuk seluruh perkara tahun 2024,
 * dan tidak ada tabel putaran perbaikan.
 *
 * Yang tersisa dan dapat diukur: jarak putus ke minutasi per panitera
 * pengganti. Dan hasil ukurnya sendiri sebuah temuan - 388 dari 388 minutasi
 * pada HARI YANG SAMA dengan putusannya. Terlalu rapi untuk pekerjaan manusia;
 * lebih mungkin tanggal_minutasi terisi otomatis. Butir ini karena itu
 * menandai PP yang seluruh minutasinya sehari dengan putusan sebagai "perlu
 * dilihat", bukan sebagai sempurna.
 */
async function barisPenyusunKonsep(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_panitera_pn"]))) return [];
  const hasil = await muatPutusan(rentang);

  const perPp = new Map();
  hasil.forEach((x) => {
    const id = teks(x.paniteraId);
    if (!id) return;
    if (!perPp.has(id)) perPp.set(id, { nama: teks(x.paniteraNama), jarak: [], belum: 0 });
    const r = perPp.get(id);
    if (!tanggalTerisi(x.tanggalMinutasi)) {
      r.belum += 1;
      return;
    }
    const j = selisihHari(x.tanggalPutusan, x.tanggalMinutasi);
    if (j !== null) r.jarak.push(j);
  });

  return [...perPp.entries()].map(([id, r]) => {
    const n = r.jarak.length + r.belum;
    const lewat = r.jarak.filter((j) => j > HARI_TENGGANG_MINUTASI).length;
    const rerata = r.jarak.length ? r.jarak.reduce((a, b) => a + b, 0) / r.jarak.length : null;
    const semuaSehari = r.jarak.length >= MINIMAL_PERKARA_RAPOR && r.jarak.every((j) => j <= 1);
    const sebab = [];

    if (n < MINIMAL_PERKARA_RAPOR) {
      sebab.push(`hanya ${n} perkara - rapor tidak disusun di bawah ${MINIMAL_PERKARA_RAPOR}`);
    }
    if (r.belum > 0) sebab.push(`${r.belum} putusan belum diminutasi`);
    if (lewat > 0) sebab.push(`${lewat} minutasi melampaui ${HARI_TENGGANG_MINUTASI} hari`);
    if (semuaSehari) {
      sebab.push(
        `seluruh ${r.jarak.length} minutasi tercatat pada hari yang sama dengan putusannya - terlalu rapi untuk pekerjaan manusia, lebih mungkin tanggalnya terisi otomatis; rapor ini tidak mengukur apa pun sampai tanggal minutasi yang sesungguhnya dicatat`
      );
    }

    return {
      kunci: `konsep-pp-${id}`,
      petugas: r.nama,
      jumlahPerkara: n,
      rerataHariMinutasi: rerata === null ? null : Number(rerata.toFixed(1)),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * AP06 - RAPOR MEDIATOR
 * ============================================================================
 *
 * Tingkat keberhasilan per mediator, dikelompokkan menurut mediator_id - bukan
 * nama, sebab "Derry Briantono" dan "Derry Briantono, S.H." adalah orang yang
 * sama dengan mediator_id 14.
 *
 * Kode hasil dibaca dari borang SIPP sendiri: Y1 berhasil dengan akta
 * perdamaian, Y2 berhasil dengan pencabutan, S berhasil sebagian, T tidak
 * berhasil, D tidak dapat dilaksanakan.
 *
 * Tingkat keberhasilan mediasi perceraian memang rendah di mana-mana - dan
 * mediator yang seluruh perkaranya perceraian akan tampak lebih buruk daripada
 * mediator yang kebagian sengketa waris. Karena itu yang dinilai bukan tinggi
 * rendahnya angka, melainkan apakah rapornya SAH: cukup banyak mediasi, dan
 * seluruh hasilnya tercatat.
 */
async function barisRaporMediator(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_mediasi"]))) return [];

  const hasil = await runQuery(
    `SELECT m.mediator_id            AS mediatorId,
            MAX(m.mediator_text)     AS mediatorNama,
            COUNT(*)                 AS jumlah,
            SUM(m.hasil_mediasi IN ('Y1','Y2','S'))         AS berhasil,
            SUM(m.hasil_mediasi = 'T')                       AS gagal,
            SUM(m.hasil_mediasi = 'D')                       AS takLaksana,
            SUM(m.hasil_mediasi IS NULL OR m.hasil_mediasi = '') AS tanpaHasil
       FROM perkara p
       JOIN perkara_mediasi m ON m.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY m.mediator_id
      ORDER BY jumlah DESC
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const n = angka(x.jumlah);
    const berhasil = angka(x.berhasil);
    const tanpaHasil = angka(x.tanpaHasil);
    const sebab = [];

    if (!teks(x.mediatorId)) sebab.push("mediator tidak beridentitas - baris mediasinya tanpa mediator_id");
    if (n < MINIMAL_MEDIASI) {
      sebab.push(`hanya ${n} mediasi - tingkat keberhasilan dari sesedikit ini bukan ukuran`);
    }
    if (tanpaHasil > 0) sebab.push(`${tanpaHasil} mediasi tanpa hasil tercatat`);

    return {
      kunci: `mediator-${teks(x.mediatorId) || "tanpa-id"}`,
      petugas: teks(x.mediatorNama),
      jumlahMediasi: n,
      berhasil,
      tingkatKeberhasilanPersen: n ? Number(((berhasil / n) * 100).toFixed(1)) : null,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * AP08 - RAPOR PETUGAS PENGARSIPAN
 * ============================================================================
 *
 * Populasinya baris ARSIP yang masuk pada rentang - peristiwa, bukan perkara
 * yang didaftarkan pada rentang. Berkas yang diarsipkan Maret 2024 hampir
 * seluruhnya perkara 2023, dan menghitungnya menurut tahun pendaftaran
 * menghasilkan tiga baris dari 279.
 *
 * Tautannya lewat NOMOR PERKARA dengan titik di ujung dibuang. Tabel arsip
 * satuan kerja ini menulis "521/Pdt.G/2023/PA.Buk." sedangkan tabel perkara
 * menulis "521/Pdt.G/2023/PA.Buk", dan perkara_id pada arsip nol pada 275
 * dari 279 baris. Butir lain yang menautkan lewat perkara_id hanya melihat
 * empat baris dan menyimpulkan hampir tidak ada yang diarsipkan.
 *
 * Diukur pada SIPP sungguhan: 279 berkas masuk arsip tahun 2024, 230 dalam
 * tiga puluh hari sesudah minutasi, 48 lebih lama - yang terlama 211 hari -
 * dan satu SEBELUM minutasi.
 */
async function barisPetugasArsip(rentang) {
  if (!(await tabelSiap(["arsip", "perkara", "perkara_putusan"]))) return [];

  const hasil = await runQuery(
    `SELECT a.id                    AS arsipId,
            a.nomor_perkara         AS nomorArsip,
            a.nama_penerima         AS penerima,
            a.nama_penyerah         AS penyerah,
            a.tanggal_masuk_arsip   AS tanggalArsip,
            a.no_ruang              AS ruang,
            a.no_lemari             AS lemari,
            a.no_rak                AS rak,
            p.nomor_perkara         AS nomorPerkara,
            d.tanggal_minutasi      AS tanggalMinutasi
       FROM arsip a
       LEFT JOIN perkara p
              ON p.nomor_perkara = TRIM(TRAILING '.' FROM TRIM(a.nomor_perkara))
       LEFT JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE a.tanggal_masuk_arsip >= ? AND a.tanggal_masuk_arsip <= ?
      ORDER BY a.tanggal_masuk_arsip
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const sebab = [];
    if (!teks(x.penerima)) sebab.push("tanpa nama petugas penerima");
    if (!teks(x.ruang) || !teks(x.lemari) || !teks(x.rak)) sebab.push("letak simpannya tidak lengkap");
    if (!teks(x.nomorPerkara)) {
      sebab.push("nomor perkaranya tidak ditemukan pada tabel perkara - ketepatan waktunya tidak dapat dihitung");
    } else if (!tanggalTerisi(x.tanggalMinutasi)) {
      sebab.push("perkaranya belum bertanggal minutasi - berkas masuk arsip sebelum minutasinya tercatat");
    } else {
      const jarak = selisihHari(x.tanggalMinutasi, x.tanggalArsip);
      if (jarak !== null && jarak < 0) {
        sebab.push(`masuk arsip ${Math.abs(jarak)} hari SEBELUM minutasi - urutannya mustahil`);
      } else if (jarak !== null && jarak > HARI_TENGGANG_ARSIP) {
        sebab.push(`masuk arsip ${jarak} hari sesudah minutasi, melampaui ${HARI_TENGGANG_ARSIP} hari`);
      }
    }

    return {
      kunci: `arsip-${teks(x.arsipId)}`,
      nomorPerkara: teks(x.nomorPerkara) || teks(x.nomorArsip),
      petugas: teks(x.penerima),
      tanggal: teks(x.tanggalArsip),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * AP09 - PERBANDINGAN MAJELIS TERHADAP NILAI TENGAH
 * ============================================================================
 *
 * Nilai tengah, bukan rerata: satu perkara yang berlarut dua tahun menggeser
 * rerata seluruh pengadilan, sedangkan nilai tengah tidak bergeser oleh satu
 * perkara mana pun.
 *
 * Yang dibandingkan nilai tengah lama penyelesaian tiap majelis terhadap
 * nilai tengah pengadilan. Yang menyimpang BUKAN majelis yang salah -
 * pembagian perkara yang tidak memperhitungkan bobot akan membuat majelis
 * yang kebagian perkara berat selalu tampak lambat.
 */
async function barisMajelisNilaiTengah(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_hakim_pn"]))) return [];
  const hasil = await muatPutusan(rentang);

  const semua = [];
  const perHakim = new Map();
  hasil.forEach((x) => {
    const lama = lamaPenyelesaian(x);
    if (lama === null) return;
    semua.push(lama);
    const id = teks(x.hakimId);
    if (!id) return;
    if (!perHakim.has(id)) perHakim.set(id, { nama: teks(x.hakimNama), lama: [] });
    perHakim.get(id).lama.push(lama);
  });

  const tengahPengadilan = nilaiTengah(semua);
  if (tengahPengadilan === null) return [];

  return [...perHakim.entries()].map(([id, h]) => {
    const tengah = nilaiTengah(h.lama);
    const deviasi = tengahPengadilan > 0 ? (tengah - tengahPengadilan) / tengahPengadilan : 0;
    const sebab = [];

    if (h.lama.length < MINIMAL_PERKARA_RAPOR) {
      sebab.push(`hanya ${h.lama.length} putusan - di bawah pembatas ${MINIMAL_PERKARA_RAPOR}`);
    } else if (Math.abs(deviasi) > AMBANG_DEVIASI_TENGAH) {
      sebab.push(
        `nilai tengah ${tengah} hari, menyimpang ${(deviasi * 100).toFixed(
          0
        )}% dari nilai tengah pengadilan ${tengahPengadilan} hari - yang menyimpang mungkin pembagiannya, bukan majelisnya`
      );
    }

    return {
      kunci: `tengah-hakim-${id}`,
      petugas: h.nama,
      jumlahPutusan: h.lama.length,
      nilaiTengahHari: tengah,
      nilaiTengahPengadilan: tengahPengadilan,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * Nilai gabungan seorang aparatur atas perkara-perkaranya.
 *
 * Bobotnya ditulis terbuka di sini dan dipakai bersama oleh AP10, AP11, dan
 * AP14 - satu rumus untuk tiga butir, supaya tiga papan tidak saling
 * berselisih tentang orang yang sama.
 */
const BOBOT_DASAR = { lama: 40, tunda: 30, minutasi: 30 };

function nilaiPerkara(x, bobot) {
  const lama = lamaPenyelesaian(x);
  const sidang = angka(x.jumlahSidang);
  const tunda = angka(x.jumlahTunda);
  const jarakMinutasi = selisihHari(x.tanggalPutusan, x.tanggalMinutasi);

  const bagianLama = lama === null ? 0 : Math.max(0, 1 - lama / HARI_ASAS_PENYELESAIAN);
  const bagianTunda = sidang === 0 ? 0 : Math.max(0, 1 - tunda / sidang);
  const bagianMinutasi =
    jarakMinutasi !== null && jarakMinutasi >= 0 && jarakMinutasi <= HARI_TENGGANG_MINUTASI ? 1 : 0;

  return bagianLama * bobot.lama + bagianTunda * bobot.tunda + bagianMinutasi * bobot.minutasi;
}

function nilaiPerHakim(hasil, bobot) {
  const peta = new Map();
  hasil.forEach((x) => {
    const id = teks(x.hakimId);
    if (!id || lamaPenyelesaian(x) === null) return;
    if (!peta.has(id)) peta.set(id, { nama: teks(x.hakimNama), nilai: [] });
    peta.get(id).nilai.push(nilaiPerkara(x, bobot));
  });
  const keluar = new Map();
  peta.forEach((v, id) => {
    keluar.set(id, { nama: v.nama, n: v.nilai.length, rerata: v.nilai.reduce((a, b) => a + b, 0) / v.nilai.length });
  });
  return keluar;
}

/**
 * ============================================================================
 * AP10 - RAPOR KINERJA PERORANGAN GABUNGAN
 * ============================================================================
 *
 * Satu baris satu ketua majelis, dengan nilai gabungan tiga hal: lama
 * penyelesaian (40), penundaan (30), ketepatan minutasi (30). Pembatas dua
 * puluh perkara dipegang keras: rapor atas lima perkara bukan rapor.
 *
 * Yang dinilai di sini KESAHIHAN rapornya - cukup perkara atau tidak. Nilai
 * gabungannya ikut dilaporkan, tetapi bukan itu yang menentukan memenuhi.
 * Menjadikan nilai gabungan sebagai penentu berarti papan ini memerahkan nama
 * orang atas bobot yang belum disahkan pimpinan.
 */
async function barisRaporGabungan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_hakim_pn"]))) return [];
  const hasil = await muatPutusan(rentang);
  const peta = nilaiPerHakim(hasil, BOBOT_DASAR);

  return [...peta.entries()].map(([id, h]) => {
    const cukup = h.n >= MINIMAL_PERKARA_RAPOR;
    return {
      kunci: `gabungan-hakim-${id}`,
      petugas: h.nama,
      jumlahPerkara: h.n,
      nilaiGabungan: Number(h.rerata.toFixed(1)),
      memenuhi: cukup,
      sebabTidakMemenuhi: cukup
        ? ""
        : `hanya ${h.n} perkara - rapor gabungan tidak disusun di bawah pembatas ${MINIMAL_PERKARA_RAPOR}; nilai yang tampil hanya keterangan`,
    };
  });
}

/**
 * ============================================================================
 * AP11 - RIWAYAT NILAI APARATUR ANTAR PERIODE
 * ============================================================================
 *
 * Rentang dibelah dua menurut bulan pendaftaran, dan nilai gabungan tiap
 * majelis dihitung pada kedua paruh. Riwayat hanya dapat dibaca bila kedua
 * paruhnya cukup berisi - nilai yang "naik" dari tiga perkara ke tiga puluh
 * perkara bukan kenaikan, melainkan dua angka yang tidak sebanding.
 */
async function barisRiwayatAntarPeriode(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_hakim_pn"]))) return [];
  const hasil = await muatPutusan(rentang);
  if (hasil.length === 0) return [];

  const bulan = [...new Set(hasil.map((x) => bulanDari(x.tanggalDaftar)))].sort();
  if (bulan.length < 2) return [];
  const pemisah = bulan[Math.floor(bulan.length / 2)];

  const awal = nilaiPerHakim(hasil.filter((x) => bulanDari(x.tanggalDaftar) < pemisah), BOBOT_DASAR);
  const akhir = nilaiPerHakim(hasil.filter((x) => bulanDari(x.tanggalDaftar) >= pemisah), BOBOT_DASAR);
  const semuaId = new Set([...awal.keys(), ...akhir.keys()]);
  const minimalParuh = Math.ceil(MINIMAL_PERKARA_RAPOR / 2);

  return [...semuaId].map((id) => {
    const a = awal.get(id);
    const b = akhir.get(id);
    const nama = (a && a.nama) || (b && b.nama) || "";
    const nA = a ? a.n : 0;
    const nB = b ? b.n : 0;
    const cukup = nA >= minimalParuh && nB >= minimalParuh;

    return {
      kunci: `riwayat-hakim-${id}`,
      petugas: nama,
      periodeAwal: { sampai: pemisah, jumlah: nA, nilai: a ? Number(a.rerata.toFixed(1)) : null },
      periodeAkhir: { sejak: pemisah, jumlah: nB, nilai: b ? Number(b.rerata.toFixed(1)) : null },
      memenuhi: cukup,
      sebabTidakMemenuhi: cukup
        ? ""
        : `paruh pertama ${nA} perkara dan paruh kedua ${nB} - riwayat menuntut sekurangnya ${minimalParuh} pada masing-masing; dua angka dari dasar yang tidak sebanding bukan riwayat`,
    };
  });
}

/**
 * ============================================================================
 * AP13 - CATATAN AKSES DAN AKTIVITAS PENGGUNA
 * ============================================================================
 *
 * Satu baris satu akun pengguna SIPP. Yang dinilai apakah akun itu DAPAT
 * DIMINTAI PERTANGGUNGJAWABAN: menyebut orang, bukan jabatan; seluruh
 * tindakannya beralamat asal.
 *
 * Akun bersama seperti "kasir3" mematahkan seluruh rapor per aparatur pada
 * baris itu: 965 tindakan yang tidak dapat dipulangkan kepada siapa pun.
 * Diukur pada SIPP sungguhan tahun 2024.
 */
async function barisCatatanAkses(rentang) {
  if (!(await tabelSiap(["sys_audittrail"]))) return [];

  const hasil = await runQuery(
    `SELECT a.username                        AS pengguna,
            COUNT(*)                          AS jumlahTindakan,
            COUNT(DISTINCT a.ipaddress)       AS jumlahAlamat,
            SUM(a.ipaddress IS NULL OR a.ipaddress = '') AS tanpaAlamat,
            COUNT(DISTINCT DATE(a.datetime))  AS hariAktif,
            MIN(a.datetime)                   AS pertama,
            MAX(a.datetime)                   AS terakhir
       FROM sys_audittrail a
      WHERE a.datetime >= ? AND a.datetime <= ?
      GROUP BY a.username
      ORDER BY jumlahTindakan DESC
      LIMIT ${BATAS_BARIS}`,
    [`${rentang.mulai} 00:00:00`, `${rentang.selesai} 23:59:59`]
  );

  return hasil.map((x) => {
    const nama = teks(x.pengguna);
    const sebab = [];
    if (!nama) sebab.push("tindakan tanpa nama pengguna - tidak dapat dipulangkan kepada siapa pun");
    else if (POLA_AKUN_BERSAMA.test(nama)) {
      sebab.push(
        `akun "${nama}" menyebut jabatan atau nomor, bukan orang - ${angka(
          x.jumlahTindakan
        )} tindakan yang tidak dapat dimintai pertanggungjawaban kepada siapa pun`
      );
    }
    if (angka(x.tanpaAlamat) > 0) sebab.push(`${angka(x.tanpaAlamat)} tindakan tanpa alamat asal`);

    return {
      kunci: `akses-${nama || "tanpa-nama"}`,
      petugas: nama,
      jumlahTindakan: angka(x.jumlahTindakan),
      jumlahAlamat: angka(x.jumlahAlamat),
      hariAktif: angka(x.hariAktif),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * AP14 - UJI KEPEKAAN BOBOT PENILAIAN APARATUR
 * ============================================================================
 *
 * Peringkat majelis dihitung dengan bobot dasar, lalu dihitung ulang dengan
 * tiga bobot lain yang masing-masing menggeser sepuluh poin. Majelis yang
 * peringkatnya berubah pada salah satu pergeseran itu berarti peringkatnya
 * bergantung pada pilihan bobot - dan bobot itu belum disahkan pimpinan.
 *
 * Yang TIDAK memenuhi di sini bukan majelisnya, melainkan KEPEKAAN
 * peringkatnya: jangan dipakai memutuskan apa pun tentang orang itu sampai
 * bobotnya ditetapkan.
 */
const RAGAM_BOBOT = [
  { nama: "dasar", bobot: BOBOT_DASAR },
  { nama: "lama +10", bobot: { lama: 50, tunda: 25, minutasi: 25 } },
  { nama: "tunda +10", bobot: { lama: 35, tunda: 40, minutasi: 25 } },
  { nama: "minutasi +10", bobot: { lama: 35, tunda: 25, minutasi: 40 } },
];

function peringkatDari(peta) {
  const urut = [...peta.entries()]
    .filter(([, v]) => v.n >= MINIMAL_PERKARA_RAPOR)
    .sort((a, b) => b[1].rerata - a[1].rerata);
  const keluar = new Map();
  urut.forEach(([id], i) => keluar.set(id, i + 1));
  return keluar;
}

async function barisKepekaanBobot(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_hakim_pn"]))) return [];
  const hasil = await muatPutusan(rentang);

  const peringkat = RAGAM_BOBOT.map((r) => ({ nama: r.nama, peringkat: peringkatDari(nilaiPerHakim(hasil, r.bobot)) }));
  const dasar = peringkat[0].peringkat;
  const namaHakim = nilaiPerHakim(hasil, BOBOT_DASAR);

  return [...dasar.entries()].map(([id, urutDasar]) => {
    const berubah = peringkat
      .slice(1)
      .filter((r) => r.peringkat.get(id) !== undefined && r.peringkat.get(id) !== urutDasar)
      .map((r) => `${r.nama} → peringkat ${r.peringkat.get(id)}`);

    return {
      kunci: `kepekaan-hakim-${id}`,
      petugas: namaHakim.get(id) ? namaHakim.get(id).nama : "",
      peringkatDasar: urutDasar,
      memenuhi: berubah.length === 0,
      sebabTidakMemenuhi: berubah.length
        ? `peringkat ${urutDasar} berubah ketika bobot digeser sepuluh poin: ${berubah.join(
            "; "
          )} - peringkat ini bergantung pada pilihan bobot yang belum disahkan pimpinan, dan tidak boleh dipakai memutuskan apa pun tentang orangnya`
        : "",
    };
  });
}

/** Delapan butir sisa Bab 7. */
const BUTIR = [
  {
    kode: "AP05",
    kunci: "raporPenyusunKonsepPutusan",
    judul: "Rapor Penyusun Konsep Putusan",
    keterangan: `Jarak putus ke minutasi per panitera pengganti, dengan tenggang ${HARI_TENGGANG_MINUTASI} hari dan pembatas ${MINIMAL_PERKARA_RAPOR} perkara. Konsep, koreksi, dan putaran perbaikan yang katalog minta TIDAK tersimpan pada SIPP satuan kerja ini. Dan minutasi yang seluruhnya tercatat sehari dengan putusannya ditandai perlu dilihat - terlalu rapi untuk pekerjaan manusia, lebih mungkin tanggalnya terisi otomatis.`,
    baris: barisPenyusunKonsep,
    pembilang: "Panitera pengganti yang rapornya sah: cukup perkara, seluruhnya diminutasi dalam tenggang, dan tanggalnya tampak dicatat sungguhan",
    penyebut: "Seluruh panitera pengganti yang memegang putusan pada rentang ini",
    tabel: "perkara disambung perkara_putusan dan perkara_panitera_pn, dikelompokkan menurut panitera_id",
    ruas: "tanggal_putusan, tanggal_minutasi, panitera_id",
  },
  {
    kode: "AP06",
    kunci: "raporMediator",
    judul: "Rapor Mediator",
    keterangan: `Tingkat keberhasilan per mediator menurut mediator_id, dengan kode hasil dibaca dari blangko SIPP sendiri. Yang dinilai bukan tinggi rendahnya angka melainkan KESAHIHAN rapornya: sekurangnya ${MINIMAL_MEDIASI} mediasi dan seluruh hasilnya tercatat. Mediator yang seluruh perkaranya perceraian akan selalu tampak lebih buruk daripada yang kebagian sengketa waris, dan itu bukan ukuran mediatornya.`,
    baris: barisRaporMediator,
    pembilang: `Mediator beridentitas dengan sekurangnya ${MINIMAL_MEDIASI} mediasi yang seluruh hasilnya tercatat`,
    penyebut: "Seluruh mediator yang menangani mediasi atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_mediasi, dikelompokkan menurut mediator_id",
    ruas: "mediator_id, mediator_text, hasil_mediasi",
  },
  {
    kode: "AP08",
    kunci: "raporPetugasPengarsipan",
    judul: "Rapor Petugas Pengarsipan",
    keterangan: `Berkas yang masuk arsip pada rentang - peristiwa, bukan perkara yang didaftarkan pada rentang - beserta petugas, letak simpan, dan ketepatan waktunya terhadap minutasi dengan tenggang ${HARI_TENGGANG_ARSIP} hari. Tautannya lewat NOMOR PERKARA dengan titik di ujung dibuang, sebab perkara_id pada tabel arsip nol pada hampir seluruh barisnya.`,
    baris: barisPetugasArsip,
    pembilang: `Berkas arsip yang berpetugas, berletak lengkap, dan masuk dalam ${HARI_TENGGANG_ARSIP} hari sesudah minutasi`,
    penyebut: "Seluruh berkas yang masuk arsip pada rentang ini",
    tabel: "arsip disambung perkara lewat nomor perkara (titik di ujung dibuang), lalu perkara_putusan",
    ruas: "tanggal_masuk_arsip, nama_penerima, no_ruang, no_lemari, no_rak, tanggal_minutasi",
  },
  {
    kode: "AP09",
    kunci: "majelisTerhadapNilaiTengah",
    judul: "Perbandingan Majelis terhadap Nilai Tengah",
    keterangan: `Nilai tengah lama penyelesaian tiap majelis dibanding nilai tengah pengadilan, dengan ambang ${(
      AMBANG_DEVIASI_TENGAH * 100
    ).toFixed(0)}% dan pembatas ${MINIMAL_PERKARA_RAPOR} putusan. Nilai tengah, bukan rerata: satu perkara yang berlarut dua tahun menggeser rerata, tidak menggeser nilai tengah. Yang menyimpang mungkin PEMBAGIANNYA, bukan majelisnya.`,
    baris: barisMajelisNilaiTengah,
    pembilang: "Majelis bercukup putusan yang nilai tengahnya di dalam ambang terhadap nilai tengah pengadilan",
    penyebut: "Seluruh ketua majelis dan hakim tunggal yang punya putusan pada rentang ini",
    tabel: "perkara disambung perkara_putusan dan perkara_hakim_pn, dikelompokkan menurut hakim_id",
    ruas: "tanggal_pendaftaran, tanggal_putusan, hakim_id",
  },
  {
    kode: "AP10",
    kunci: "raporPeroranganGabungan",
    judul: "Rapor Kinerja Perorangan Gabungan",
    keterangan: `Nilai gabungan per ketua majelis dari lama penyelesaian (${BOBOT_DASAR.lama}), penundaan (${BOBOT_DASAR.tunda}), dan ketepatan minutasi (${BOBOT_DASAR.minutasi}), dengan pembatas ${MINIMAL_PERKARA_RAPOR} perkara. Yang menentukan memenuhi adalah KESAHIHAN rapornya - cukup perkara - bukan nilainya. Menjadikan nilai sebagai penentu berarti memerahkan nama orang atas bobot yang belum disahkan pimpinan.`,
    baris: barisRaporGabungan,
    pembilang: `Ketua majelis dengan sekurangnya ${MINIMAL_PERKARA_RAPOR} putusan sehingga rapor gabungannya sah`,
    penyebut: "Seluruh ketua majelis dan hakim tunggal yang punya putusan pada rentang ini",
    tabel: "perkara disambung perkara_putusan, perkara_hakim_pn, dan perkara_jadwal_sidang",
    ruas: "tanggal_pendaftaran, tanggal_putusan, tanggal_minutasi, jumlah sidang, jumlah penundaan, hakim_id",
  },
  {
    kode: "AP11",
    kunci: "riwayatNilaiAntarPeriode",
    judul: "Riwayat Nilai Aparatur Antar Periode",
    keterangan: `Rentang dibelah dua menurut bulan pendaftaran dan nilai gabungan tiap majelis dihitung pada kedua paruh. Riwayat hanya dapat dibaca bila kedua paruhnya cukup berisi - nilai yang naik dari tiga perkara ke tiga puluh bukan kenaikan, melainkan dua angka dari dasar yang tidak sebanding.`,
    baris: barisRiwayatAntarPeriode,
    pembilang: "Majelis yang kedua paruh rentangnya cukup berisi untuk dibaca riwayatnya",
    penyebut: "Seluruh ketua majelis dan hakim tunggal yang punya putusan pada rentang ini",
    tabel: "perkara disambung perkara_putusan, perkara_hakim_pn, dan perkara_jadwal_sidang, dibelah menurut paruh waktu",
    ruas: "tanggal_pendaftaran, tanggal_putusan, tanggal_minutasi, hakim_id",
  },
  {
    kode: "AP13",
    kunci: "catatanAksesPengguna",
    judul: "Catatan Akses dan Aktivitas Pengguna",
    keterangan:
      "Satu baris satu akun SIPP: jumlah tindakan, jumlah alamat asal, hari aktif. Yang dinilai apakah akun itu DAPAT DIMINTAI PERTANGGUNGJAWABAN - menyebut orang, bukan jabatan atau nomor, dan seluruh tindakannya beralamat. Akun bersama mematahkan seluruh rapor per aparatur pada baris itu.",
    baris: barisCatatanAkses,
    pembilang: "Akun yang menyebut orang dan seluruh tindakannya beralamat asal",
    penyebut: "Seluruh akun yang tercatat bertindak pada sys_audittrail dalam rentang ini",
    tabel: "sys_audittrail, dikelompokkan menurut username",
    ruas: "username, ipaddress, datetime",
  },
  {
    kode: "AP14",
    kunci: "kepekaanBobotPenilaian",
    judul: "Uji Kepekaan Bobot Penilaian Aparatur",
    keterangan:
      "Peringkat majelis dihitung dengan bobot dasar lalu dihitung ulang dengan tiga bobot lain yang masing-masing menggeser sepuluh poin. Majelis yang peringkatnya berubah berarti peringkatnya bergantung pada pilihan bobot - dan bobot itu belum disahkan pimpinan. Yang TIDAK memenuhi bukan majelisnya melainkan kepekaan peringkatnya: jangan dipakai memutuskan apa pun tentang orang itu.",
    baris: barisKepekaanBobot,
    pembilang: "Majelis yang peringkatnya tidak berubah pada ketiga pergeseran bobot",
    penyebut: `Seluruh majelis bercukup putusan (sekurangnya ${MINIMAL_PERKARA_RAPOR}) yang masuk peringkat`,
    tabel: "perkara disambung perkara_putusan, perkara_hakim_pn, dan perkara_jadwal_sidang, dihitung empat kali dengan bobot berbeda",
    ruas: "tanggal_pendaftaran, tanggal_putusan, tanggal_minutasi, jumlah sidang, jumlah penundaan, hakim_id",
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
      versiRumus: "rapor-lanjut-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: b.pembilang,
        penyebut: b.penyebut,
        dikecualikan:
          "Aparatur yang perkaranya di bawah pembatas dua puluh TIDAK dikeluarkan melainkan ditandai tidak memenuhi - mengeluarkannya berarti menyembunyikan bahwa rapornya tidak dapat disusun. Perkara yang belum diputus dikeluarkan dari seluruh hitungan lama penyelesaian. Butir yang tabelnya tidak ada pada SIPP satuan kerja ini tidak menghasilkan baris sama sekali.",
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
  AMBANG_DEVIASI_TENGAH,
  BOBOT_DASAR,
  BUTIR,
  HARI_TENGGANG_ARSIP,
  HARI_TENGGANG_MINUTASI,
  MINIMAL_MEDIASI,
  MINIMAL_PERKARA_RAPOR,
  POLA_AKUN_BERSAMA,
  RAGAM_BOBOT,
  barisCatatanAkses,
  barisKepekaanBobot,
  barisMajelisNilaiTengah,
  barisPenyusunKonsep,
  barisPetugasArsip,
  barisRaporGabungan,
  barisRaporMediator,
  barisRiwayatAntarPeriode,
  daftarkanSemua,
  lupakanSemua,
  nilaiPerkara,
  nilaiTengah,
  sambungan,
};
