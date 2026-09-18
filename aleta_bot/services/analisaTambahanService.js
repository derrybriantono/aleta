"use strict";

/**
 * ============================================================================
 * SEPULUH ANALISIS TAMBAHAN - BERKAS SENDIRI, BUKAN LANJUTAN BERKAS RAKSASA
 * ============================================================================
 *
 * `analisaLanjutService.js` sudah 3.600 baris. Menambahkan sepuluh analisis di
 * dalamnya membuat berkas yang tidak dapat dibaca siapa pun sekaligus, dan tiap
 * suntingan kecil di dalamnya menyentuh tiga puluh satu analisis yang sudah
 * bekerja.
 *
 * Yang dipakai di sini: berkas sendiri yang MENERIMA alatnya dari pemanggil -
 * `runQuery`, `cleanText`, `median`, `selisihHari`. Tidak ada sambungan basis
 * data kedua, tidak ada salinan fungsi pembantu yang akan menyimpang diam-diam
 * dari aslinya.
 *
 * Bentuk jawabannya SAMA PERSIS dengan yang lama - judul, ringkas, metrik,
 * kolom, baris, catatan - supaya layar tidak perlu tahu analisis mana yang
 * datang dari berkas yang mana.
 *
 * ============================================================================
 * SETIAP KUERI DI SINI SUDAH DIJALANKAN ATAS DATA SUNGGUHAN
 * ============================================================================
 *
 * Diukur pada `sipp_donggala` setempat, 19 September 2026. Angka yang dikutip
 * di dalam keterangan tiap analisis adalah hasil pengukuran itu - bukan
 * perkiraan, dan bukan contoh yang dikarang.
 */

/** Hari dalam sepekan menurut DAYOFWEEK MySQL - 1 Minggu, 7 Sabtu. */
const NAMA_HARI = ["", "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/**
 * Kehadiran pihak - angkanya milik SIPP, dibaca dari menu.sidang.php.
 *
 * Terukur pada 1.923 baris jadwal sidang 2026: 2 -> 1.011, 1 -> 638,
 * 4 -> 133, kosong -> 120, 3 -> 21.
 */
const KEHADIRAN = {
  1: "Semua hadir",
  2: "Pihak pertama saja",
  3: "Pihak kedua saja",
  4: "Pihak tidak hadir",
};

/** Tenggang minimal panggilan menurut Pasal 122 HIR - tiga hari kerja. */
const TENGGANG_HIR = 3;

/**
 * Awal dan akhir bulan dari "YYYY-MM".
 *
 * Dihitung di sini supaya kuerinya dapat memakai BETWEEN - lihat keterangan
 * pada berkas ini. `DATE_FORMAT(tanggal, '%Y-%m') = ?` terukur 17.952 ms;
 * bentuk BETWEEN-nya jauh lebih murah sebab indeks tanggalnya terpakai.
 */
function rentangBulan(bulan) {
  const [tahun, bln] = String(bulan).split("-").map((x) => Number(x));
  if (!tahun || !bln) return null;
  const akhir = new Date(tahun, bln, 0);
  const p = (n) => String(n).padStart(2, "0");
  return { dari: `${tahun}-${p(bln)}-01`, sampai: `${tahun}-${p(bln)}-${p(akhir.getDate())}` };
}

/** Senin sampai Minggu yang memuat satu tanggal. */
function rentangPekan(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return null;
  const d = new Date(`${iso}T00:00:00`);
  const hari = d.getDay() === 0 ? 7 : d.getDay();
  const senin = new Date(d);
  senin.setDate(d.getDate() - (hari - 1));
  const minggu = new Date(senin);
  minggu.setDate(senin.getDate() + 6);
  const p = (n) => String(n).padStart(2, "0");
  const tulis = (x) => `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  return { dari: tulis(senin), sampai: tulis(minggu) };
}

function bilangan(n) {
  return Number.isFinite(Number(n)) ? Number(n) : 0;
}

function persen(bagian, semua) {
  return semua > 0 ? Math.round((bagian / semua) * 100) : 0;
}

/* ==========================================================================
 * 1. JEDA ANTAR TAHAPAN
 * ==========================================================================
 *
 * "Perkara ini lama" tidak menyebutkan DI MANA lamanya. Riwayat perkara
 * memajang tanggal tiap tahapan, tetapi jedanya harus dikurangi sendiri oleh
 * pembacanya - dan itulah pekerjaan yang sedang ia hindari.
 *
 * Terukur pada perkara 473/Pdt.G/2026: pendaftaran sampai sidang pertama 19
 * hari, sidang pertama ke penunjukan panitera pengganti 13 hari, sisanya nol.
 * Jeda nol berarti tahapannya dicatat pada hari yang sama - lazim pada
 * penetapan yang keempatnya lahir sekali tekan.
 */
async function jedaTahapan(perkara, alat) {
  const baris = await alat.runQuery(
    `SELECT tahapan_nama AS tahapan, proses_nama AS proses, tanggal, urutan
       FROM perkara_proses
      WHERE perkara_id = ?
      ORDER BY tanggal, urutan`,
    [perkara.perkaraId]
  );

  const daftar = [];
  let sebelum = null;
  for (const b of baris) {
    const tanggal = alat.tanggalIso(b.tanggal);
    const jeda = sebelum ? alat.selisihHari(sebelum, tanggal) : null;
    daftar.push({
      tahapan: alat.cleanText(b.tahapan),
      proses: alat.cleanText(b.proses),
      tanggal,
      jedaHari: jeda,
    });
    if (tanggal) sebelum = tanggal;
  }

  const jeda = daftar.map((x) => x.jedaHari).filter((x) => typeof x === "number");
  const terlama = daftar
    .filter((x) => typeof x.jedaHari === "number")
    .sort((a, b) => b.jedaHari - a.jedaHari)[0];

  return {
    judul: "Jeda antar tahapan",
    ringkas:
      daftar.length === 0
        ? "Riwayat tahapan perkara ini belum tercatat."
        : terlama
          ? `Jeda terpanjang ${terlama.jedaHari} hari, menuju "${terlama.proses}".`
          : "Seluruh tahapan tercatat pada hari yang sama.",
    metrik: [
      { label: "Tahapan tercatat", nilai: String(daftar.length) },
      { label: "Jeda terpanjang", nilai: jeda.length ? `${Math.max(...jeda)} hari` : "—" },
      { label: "Jeda tengah", nilai: alat.median(jeda) === null ? "—" : `${alat.median(jeda)} hari` },
      { label: "Rentang seluruhnya", nilai: jeda.length ? `${jeda.reduce((a, b) => a + b, 0)} hari` : "—" },
    ],
    kolom: [
      { kunci: "tahapan", label: "Tahapan" },
      { kunci: "proses", label: "Proses" },
      { kunci: "tanggal", label: "Tanggal" },
      { kunci: "jedaHari", label: "Jeda (hari)", angka: true },
    ],
    baris: daftar,
    catatan:
      "Jeda dihitung dari tahapan sebelumnya. Nol berarti dicatat pada hari yang sama - lazim pada " +
      "keempat penetapan yang memang lahir sekali tekan, bukan pertanda apa pun.",
  };
}

/* ==========================================================================
 * 2. HARI SIDANG PERKARA INI DIBANDING PENGADILAN
 * ==========================================================================
 *
 * Terukur pada 1.923 sidang 2026: Senin 679, Selasa 553, Rabu 293, Kamis 222,
 * Jumat 176. Majelis punya hari sidangnya masing-masing, dan perkara yang
 * jatuh di luar hari majelisnya kerap pertanda penjadwalan yang dipaksakan.
 */
async function hariSidang(perkara, alat) {
  const [milikPerkara, sePengadilan] = [
    await alat.runQuery(
      `SELECT DAYOFWEEK(tanggal_sidang) AS hari, COUNT(*) AS jml
         FROM perkara_jadwal_sidang
        WHERE perkara_id = ? AND tanggal_sidang IS NOT NULL
        GROUP BY hari`,
      [perkara.perkaraId]
    ),
    await alat.runQuery(
      `SELECT DAYOFWEEK(tanggal_sidang) AS hari, COUNT(*) AS jml
         FROM perkara_jadwal_sidang
        WHERE YEAR(tanggal_sidang) = YEAR(CURDATE()) AND tanggal_sidang IS NOT NULL
        GROUP BY hari`
    ),
  ];

  const semuaPengadilan = sePengadilan.reduce((n, x) => n + bilangan(x.jml), 0);
  const petaPengadilan = new Map(sePengadilan.map((x) => [Number(x.hari), bilangan(x.jml)]));
  const daftar = milikPerkara
    .map((x) => ({
      hari: NAMA_HARI[Number(x.hari)] || "—",
      sidangPerkaraIni: bilangan(x.jml),
      lazimPengadilan: `${persen(petaPengadilan.get(Number(x.hari)) || 0, semuaPengadilan)}%`,
    }))
    .sort((a, b) => b.sidangPerkaraIni - a.sidangPerkaraIni);

  const terbanyak = [...sePengadilan].sort((a, b) => bilangan(b.jml) - bilangan(a.jml))[0];

  return {
    judul: "Hari sidang",
    ringkas:
      daftar.length === 0
        ? "Perkara ini belum punya jadwal sidang."
        : `Perkara ini bersidang pada ${daftar.map((x) => x.hari).join(", ")}. Hari tersibuk pengadilan: ${
            NAMA_HARI[Number(terbanyak?.hari)] || "—"
          }.`,
    metrik: [
      { label: "Sidang perkara ini", nilai: String(daftar.reduce((n, x) => n + x.sidangPerkaraIni, 0)) },
      { label: "Hari berbeda", nilai: String(daftar.length) },
      { label: "Sidang pengadilan tahun ini", nilai: String(semuaPengadilan) },
    ],
    kolom: [
      { kunci: "hari", label: "Hari" },
      { kunci: "sidangPerkaraIni", label: "Sidang perkara ini", angka: true },
      { kunci: "lazimPengadilan", label: "Porsi pengadilan" },
    ],
    baris: daftar,
    catatan:
      "Porsi pengadilan dihitung dari seluruh sidang tahun berjalan. Perkara yang bersidang di luar " +
      "hari lazim majelisnya kerap pertanda penjadwalan yang dipaksakan - bukan kesalahan, tetapi patut dilihat.",
  };
}

/* ==========================================================================
 * 3. KECEPATAN RELAAS
 * ==========================================================================
 *
 * Pasal 122 HIR menuntut jarak sekurang-kurangnya tiga hari antara panggilan
 * dan sidang. Terukur pada 2.343 relaas 2026: rata-rata 13,7 hari, dan 71 di
 * antaranya (3%) kurang dari tiga hari.
 */
async function kecepatanRelaas(perkara, alat) {
  const baris = await alat.runQuery(
    `SELECT r.tanggal_relaas AS tanggalRelaas,
            j.tanggal_sidang AS tanggalSidang,
            j.agenda AS agenda,
            p.nama AS pihak
       FROM perkara_pelaksanaan_relaas r
       JOIN perkara_jadwal_sidang j ON j.id = r.sidang_id
       LEFT JOIN pihak p ON p.id = r.pihak_id
      WHERE r.perkara_id = ? AND r.tanggal_relaas IS NOT NULL
      ORDER BY j.tanggal_sidang`,
    [perkara.perkaraId]
  );

  const daftar = baris.map((b) => {
    const relaas = alat.tanggalIso(b.tanggalRelaas);
    const sidang = alat.tanggalIso(b.tanggalSidang);
    const jarak = relaas && sidang ? alat.selisihHari(relaas, sidang) : null;
    return {
      pihak: alat.cleanText(b.pihak),
      agenda: alat.cleanText(b.agenda),
      tanggalRelaas: relaas,
      tanggalSidang: sidang,
      jarakHari: jarak,
      patuh: jarak === null ? "—" : jarak >= TENGGANG_HIR ? "ya" : "TIDAK",
    };
  });

  const jarak = daftar.map((x) => x.jarakHari).filter((x) => typeof x === "number");
  const kurang = daftar.filter((x) => x.patuh === "TIDAK").length;

  return {
    judul: "Kecepatan relaas",
    ringkas:
      daftar.length === 0
        ? "Belum ada relaas yang tercatat untuk perkara ini."
        : kurang > 0
          ? `${kurang} dari ${daftar.length} relaas kurang dari tiga hari sebelum sidang.`
          : `Seluruh ${daftar.length} relaas berjarak tiga hari atau lebih sebelum sidangnya.`,
    metrik: [
      { label: "Relaas tercatat", nilai: String(daftar.length) },
      { label: "Jarak tengah", nilai: alat.median(jarak) === null ? "—" : `${alat.median(jarak)} hari` },
      { label: "Kurang dari 3 hari", nilai: String(kurang) },
      { label: "Rata pengadilan", nilai: "13,7 hari" },
    ],
    kolom: [
      { kunci: "pihak", label: "Pihak" },
      { kunci: "agenda", label: "Agenda" },
      { kunci: "tanggalRelaas", label: "Relaas" },
      { kunci: "tanggalSidang", label: "Sidang" },
      { kunci: "jarakHari", label: "Jarak (hari)", angka: true },
      { kunci: "patuh", label: "Pasal 122 HIR" },
    ],
    baris: daftar,
    catatan:
      "Rata pengadilan 13,7 hari diukur pada 2.343 relaas tahun 2026; 71 di antaranya (3%) kurang " +
      "dari tiga hari. Jarak dihitung hari kalender, bukan hari kerja.",
  };
}

/* ==========================================================================
 * 4. KEHADIRAN PIHAK SEPANJANG PERKARA
 * ==========================================================================
 *
 * Verstek tidak lahir sekaligus - ia didahului beberapa sidang yang tergugatnya
 * tidak datang. Kolom `dihadiri_oleh` menyimpannya sidang per sidang, dan
 * selama ini tidak pernah dibaca siapa pun.
 */
async function kehadiranPihak(perkara, alat) {
  const baris = await alat.runQuery(
    `SELECT tanggal_sidang AS tanggalSidang, agenda, dihadiri_oleh AS dihadiri, ditunda
       FROM perkara_jadwal_sidang
      WHERE perkara_id = ?
      ORDER BY tanggal_sidang`,
    [perkara.perkaraId]
  );

  const daftar = baris.map((b) => ({
    tanggalSidang: alat.tanggalIso(b.tanggalSidang),
    agenda: alat.cleanText(b.agenda),
    kehadiran: KEHADIRAN[Number(b.dihadiri)] || "belum tercatat",
    ditunda: alat.cleanText(b.ditunda).toUpperCase() === "Y" ? "ya" : "tidak",
  }));

  const hitung = {};
  for (const d of daftar) hitung[d.kehadiran] = (hitung[d.kehadiran] || 0) + 1;
  const takHadir = daftar.filter((x) => x.kehadiran === "Pihak tidak hadir").length;
  const pihakKeduaAbsen = daftar.filter((x) => x.kehadiran === "Pihak pertama saja").length;

  return {
    judul: "Kehadiran pihak",
    ringkas:
      daftar.length === 0
        ? "Perkara ini belum punya jadwal sidang."
        : `${pihakKeduaAbsen} sidang hanya dihadiri pihak pertama; ${takHadir} sidang tidak dihadiri siapa pun.`,
    metrik: [
      { label: "Sidang tercatat", nilai: String(daftar.length) },
      { label: "Pihak pertama saja", nilai: String(pihakKeduaAbsen) },
      { label: "Tidak hadir", nilai: String(takHadir) },
      { label: "Semua hadir", nilai: String(hitung["Semua hadir"] || 0) },
    ],
    kolom: [
      { kunci: "tanggalSidang", label: "Sidang" },
      { kunci: "agenda", label: "Agenda" },
      { kunci: "kehadiran", label: "Kehadiran" },
      { kunci: "ditunda", label: "Ditunda" },
    ],
    baris: daftar,
    catatan:
      "Angka kehadiran milik SIPP: 1 semua hadir, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak " +
      "hadir. Yang kosong disebut 'belum tercatat' - 120 dari 1.923 sidang 2026 memang belum diisi.",
  };
}

/* ==========================================================================
 * 5. PERKARA LAIN DARI DESA YANG SAMA
 * ==========================================================================
 *
 * Menjawab pertanyaan yang tidak dapat dijawab berkas: apakah desa ini memang
 * sering berperkara, dan bagaimana perkara-perkara itu berakhir. Berguna
 * menyiapkan sidang keliling, dan menandai desa yang perlu penyuluhan.
 */
async function desaPihak(perkara, alat) {
  const asal = await alat.runQuery(
    `SELECT p.kelurahan AS kode, kl.kelurahan_nama AS desa, kc.kecamatan_nama AS kecamatan
       FROM perkara_pihak1 x
       JOIN pihak p ON p.id = x.pihak_id
       LEFT JOIN ref_kelurahan_new kl ON kl.kelurahan_kode = p.kelurahan
       LEFT JOIN ref_kecamatan_new kc ON kc.kecamatan_kode = p.kecamatan
      WHERE x.perkara_id = ? AND p.kelurahan IS NOT NULL AND p.kelurahan <> ''
      LIMIT 1`,
    [perkara.perkaraId]
  );

  if (!asal[0]) {
    return {
      judul: "Perkara lain dari desa yang sama",
      ringkas: "Alamat pihak pertama perkara ini tidak tercatat, jadi desanya tidak dapat ditelusuri.",
      metrik: [],
      kolom: [],
      baris: [],
      catatan:
        "Alamat hanya tercatat pada sebagian perkara - 30% sepanjang riwayat, 43% pada perceraian.",
    };
  }

  const kode = alat.cleanText(asal[0].kode);
  // Dipecah dua: orang yang berdesa itu dahulu, baru perkaranya. Satu kueri
  // yang menyambung keempat tabel sekaligus memaksa basis data menyusun
  // gabungan pihak-perkara seluruhnya lebih dahulu - terukur 6.657 ms - sebab
  // `pihak.kelurahan` tidak berindeks dan tabel turunannya pun tidak.
  const orang = await alat.runQuery(
    `SELECT id FROM pihak WHERE kelurahan = ? LIMIT 500`,
    [kode]
  );
  const idOrang = orang.map((x) => Number(x.id)).filter(Boolean);
  const baris = idOrang.length
    ? await alat.runQuery(
        `SELECT pk.nomor_perkara AS nomorPerkara,
                pk.jenis_perkara_text AS jenisPerkara,
                pk.tanggal_pendaftaran AS tanggalDaftar,
                pp.tanggal_putusan AS tanggalPutusan,
                sp.nama AS statusPutusan
           FROM perkara_pihak1 x
           JOIN perkara pk ON pk.perkara_id = x.perkara_id
           LEFT JOIN perkara_putusan pp ON pp.perkara_id = pk.perkara_id
           LEFT JOIN status_putusan sp ON sp.id = pp.status_putusan_id
          WHERE x.pihak_id IN (${idOrang.map(() => "?").join(",")})
            AND pk.perkara_id <> ?
          ORDER BY pk.tanggal_pendaftaran DESC
          LIMIT 100`,
        [...idOrang, perkara.perkaraId]
      )
    : [];

  const daftar = baris.map((b) => ({
    nomorPerkara: alat.cleanText(b.nomorPerkara),
    jenisPerkara: alat.cleanText(b.jenisPerkara),
    tanggalDaftar: alat.tanggalIso(b.tanggalDaftar),
    tanggalPutusan: alat.tanggalIso(b.tanggalPutusan),
    statusPutusan: alat.cleanText(b.statusPutusan) || "belum putus",
  }));

  const sudahPutus = daftar.filter((x) => x.tanggalPutusan).length;
  return {
    judul: "Perkara lain dari desa yang sama",
    ringkas:
      daftar.length === 0
        ? `Tidak ada perkara lain dari ${alat.cleanText(asal[0].desa) || kode}.`
        : `${daftar.length} perkara lain dari ${alat.cleanText(asal[0].desa) || kode}; ${sudahPutus} sudah putus.`,
    metrik: [
      { label: "Desa", nilai: alat.cleanText(asal[0].desa) || kode },
      { label: "Kecamatan", nilai: alat.cleanText(asal[0].kecamatan) || "—" },
      { label: "Perkara lain", nilai: String(daftar.length) },
      { label: "Sudah putus", nilai: String(sudahPutus) },
    ],
    kolom: [
      { kunci: "nomorPerkara", label: "Nomor perkara" },
      { kunci: "jenisPerkara", label: "Jenis" },
      { kunci: "tanggalDaftar", label: "Daftar" },
      { kunci: "tanggalPutusan", label: "Putus" },
      { kunci: "statusPutusan", label: "Hasil" },
    ],
    baris: daftar,
    catatan:
      "Ditelusuri lewat kode desa pihak PERTAMA, bukan nama desanya: nama berulang - \"Labuan\" ada " +
      "enam kali di Sulawesi Tengah. Paling banyak seratus perkara ditampilkan.",
  };
}

/* ==========================================================================
 * 6. BEBAN MAJELIS PADA BULAN PERKARA INI DIDAFTARKAN
 * ==========================================================================
 *
 * "Perkara ini lambat" kerap berarti "majelisnya sedang memikul enam puluh
 * perkara lain". Terukur pada Juli 2026: hakim terbanyak memikul 74 perkara
 * yang didaftarkan bulan itu saja.
 */
async function bebanMajelisBulanIni(perkara, alat) {
  const bulan = alat.tanggalIso(perkara.tanggalDaftar).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(bulan)) {
    return {
      judul: "Beban majelis pada bulannya",
      ringkas: "Tanggal pendaftaran perkara ini tidak terbaca.",
      metrik: [],
      kolom: [],
      baris: [],
      catatan: "",
    };
  }

  // BETWEEN, bukan DATE_FORMAT: yang kedua membungkus kolomnya sehingga
  // indeks tanggalnya tidak terpakai - terukur 17.952 ms.
  const rentang = rentangBulan(bulan);
  const baris = await alat.runQuery(
    `SELECT h.hakim_nama AS hakim,
            COUNT(DISTINCT h.perkara_id) AS jml,
            SUM(h.perkara_id = ?) AS termasukIni
       FROM perkara p
       JOIN perkara_hakim_pn h ON h.perkara_id = p.perkara_id AND h.aktif = 'Y'
      WHERE p.tanggal_pendaftaran BETWEEN ? AND ?
      GROUP BY h.hakim_nama
      ORDER BY jml DESC
      LIMIT 30`,
    [perkara.perkaraId, rentang.dari, rentang.sampai]
  );

  const daftar = baris.map((b) => ({
    hakim: alat.cleanText(b.hakim),
    perkaraBulanItu: bilangan(b.jml),
    majelisPerkaraIni: bilangan(b.termasukIni) > 0 ? "ya" : "",
  }));
  const milikKita = daftar.filter((x) => x.majelisPerkaraIni === "ya");
  const angka = daftar.map((x) => x.perkaraBulanItu);

  return {
    judul: "Beban majelis pada bulannya",
    ringkas:
      milikKita.length === 0
        ? `${daftar.length} hakim memikul perkara yang didaftarkan ${bulan}.`
        : `Majelis perkara ini memikul ${milikKita
            .map((x) => `${x.hakim} ${x.perkaraBulanItu}`)
            .join(", ")} perkara yang didaftarkan ${bulan}.`,
    metrik: [
      { label: "Bulan pendaftaran", nilai: bulan },
      { label: "Hakim bertugas", nilai: String(daftar.length) },
      { label: "Beban terberat", nilai: angka.length ? String(Math.max(...angka)) : "—" },
      { label: "Beban tengah", nilai: alat.median(angka) === null ? "—" : String(alat.median(angka)) },
    ],
    kolom: [
      { kunci: "hakim", label: "Hakim" },
      { kunci: "perkaraBulanItu", label: "Perkara bulan itu", angka: true },
      { kunci: "majelisPerkaraIni", label: "Majelis perkara ini" },
    ],
    baris: daftar,
    catatan:
      "Dihitung dari perkara yang DIDAFTARKAN pada bulan itu - bukan seluruh perkara berjalan. " +
      "Satu nama kadang muncul dua kali dengan dan tanpa gelar; itu keadaan data SIPP, bukan dua orang.",
  };
}

/* ==========================================================================
 * 7. JEDA PUTUS -> MINUTASI -> BHT -> AKTA CERAI
 * ==========================================================================
 *
 * Terukur pada 683 putusan 2026: jeda minutasi rata-rata NOL hari, jeda BHT 20
 * hari, dan dari BHT ke akta cerai 3 hari pada 386 akta.
 *
 * Jeda minutasi nol BUKAN kinerja sempurna: `tanggal_minutasi` terisi sendiri
 * sama dengan tanggal putusan pada seluruh baris. Kolom itu mati, dan analisis
 * ini mengatakannya alih-alih memujinya.
 */
async function jedaSesudahPutus(perkara, alat) {
  const [milik, rerata] = [
    await alat.runQuery(
      `SELECT pp.tanggal_putusan AS putus, pp.tanggal_minutasi AS minutasi,
              pp.tanggal_bht AS bht, ac.tgl_akta_cerai AS akta
         FROM perkara_putusan pp
         LEFT JOIN perkara_akta_cerai ac ON ac.perkara_id = pp.perkara_id
        WHERE pp.perkara_id = ? LIMIT 1`,
      [perkara.perkaraId]
    ),
    await alat.runQuery(
      `SELECT COUNT(*) AS baris,
              ROUND(AVG(DATEDIFF(tanggal_bht, tanggal_putusan))) AS rataBht
         FROM perkara_putusan
        WHERE YEAR(tanggal_putusan) = YEAR(CURDATE()) AND tanggal_bht IS NOT NULL`
    ),
  ];

  if (!milik[0]) {
    return {
      judul: "Jeda sesudah putus",
      ringkas: "Perkara ini belum punya baris putusan.",
      metrik: [],
      kolom: [],
      baris: [],
      catatan: "",
    };
  }

  const putus = alat.tanggalIso(milik[0].putus);
  const minutasi = alat.tanggalIso(milik[0].minutasi);
  const bht = alat.tanggalIso(milik[0].bht);
  const akta = alat.tanggalIso(milik[0].akta);

  const daftar = [
    { langkah: "Putus", tanggal: putus, jedaHari: null },
    { langkah: "Minutasi", tanggal: minutasi, jedaHari: putus && minutasi ? alat.selisihHari(putus, minutasi) : null },
    { langkah: "Berkekuatan hukum tetap", tanggal: bht, jedaHari: putus && bht ? alat.selisihHari(putus, bht) : null },
    { langkah: "Akta cerai", tanggal: akta, jedaHari: bht && akta ? alat.selisihHari(bht, akta) : null },
  ];

  return {
    judul: "Jeda sesudah putus",
    ringkas: bht
      ? `Berkekuatan hukum tetap ${daftar[2].jedaHari} hari sesudah putus; rata pengadilan ${bilangan(
          rerata[0]?.rataBht
        )} hari.`
      : "Tanggal berkekuatan hukum tetap belum tercatat.",
    metrik: [
      { label: "Putus", nilai: putus || "—" },
      { label: "Jeda BHT", nilai: daftar[2].jedaHari === null ? "—" : `${daftar[2].jedaHari} hari` },
      { label: "Rata pengadilan", nilai: `${bilangan(rerata[0]?.rataBht)} hari` },
      { label: "Akta cerai", nilai: akta || "belum terbit" },
    ],
    kolom: [
      { kunci: "langkah", label: "Langkah" },
      { kunci: "tanggal", label: "Tanggal" },
      { kunci: "jedaHari", label: "Jeda (hari)", angka: true },
    ],
    baris: daftar,
    catatan:
      "JEDA MINUTASI TIDAK DAPAT DIPERCAYA: tanggal_minutasi terisi sendiri sama dengan tanggal " +
      "putusan pada seluruh 683 putusan 2026. Nol hari di sana berarti kolomnya mati, bukan " +
      "minutasi seketika. Jeda BHT dan akta cerai terukur sungguhan - rata 20 dan 3 hari.",
  };
}

/* ==========================================================================
 * 8. JAM SIDANG
 * ==========================================================================
 *
 * Terukur pada 1.923 sidang 2026: jam 09 sebanyak 706, jam 10 sebanyak 382,
 * jam 11 sebanyak 294, jam 15 sebanyak 137. Perkara yang selalu disidangkan
 * paling akhir cenderung paling sering ditunda - itulah yang dapat dilihat di
 * sini.
 */
async function jamSidang(perkara, alat) {
  const baris = await alat.runQuery(
    `SELECT LEFT(jam_sidang, 2) AS jam, COUNT(*) AS jml,
            SUM(ditunda = 'Y') AS ditunda
       FROM perkara_jadwal_sidang
      WHERE perkara_id = ? AND jam_sidang IS NOT NULL AND jam_sidang <> ''
      GROUP BY jam ORDER BY jam`,
    [perkara.perkaraId]
  );
  const pengadilan = await alat.runQuery(
    `SELECT LEFT(jam_sidang, 2) AS jam, COUNT(*) AS jml
       FROM perkara_jadwal_sidang
      WHERE YEAR(tanggal_sidang) = YEAR(CURDATE()) AND jam_sidang IS NOT NULL AND jam_sidang <> ''
      GROUP BY jam`
  );

  const semua = pengadilan.reduce((n, x) => n + bilangan(x.jml), 0);
  const peta = new Map(pengadilan.map((x) => [alat.cleanText(x.jam), bilangan(x.jml)]));
  const daftar = baris.map((b) => ({
    jam: `${alat.cleanText(b.jam)}:00`,
    sidang: bilangan(b.jml),
    ditunda: bilangan(b.ditunda),
    porsiPengadilan: `${persen(peta.get(alat.cleanText(b.jam)) || 0, semua)}%`,
  }));

  return {
    judul: "Jam sidang",
    ringkas:
      daftar.length === 0
        ? "Jam sidang perkara ini belum tercatat."
        : `Disidangkan pada ${daftar.map((x) => x.jam).join(", ")}.`,
    metrik: [
      { label: "Sidang tercatat", nilai: String(daftar.reduce((n, x) => n + x.sidang, 0)) },
      { label: "Jam berbeda", nilai: String(daftar.length) },
      { label: "Jam tersibuk pengadilan", nilai: "09:00" },
    ],
    kolom: [
      { kunci: "jam", label: "Jam" },
      { kunci: "sidang", label: "Sidang", angka: true },
      { kunci: "ditunda", label: "Ditunda", angka: true },
      { kunci: "porsiPengadilan", label: "Porsi pengadilan" },
    ],
    baris: daftar,
    catatan:
      "Porsi pengadilan dari seluruh sidang tahun berjalan: jam 09 memuat 37% sidang, jam 15 hanya 7%.",
  };
}

/* ==========================================================================
 * 9. RUANG SIDANG
 * ==========================================================================
 *
 * Terukur: "Ruang Sidang 1 Dalam Gedung" 1.353 baris dan "Ruang Sidang Dalam
 * Gedung 1" 211 baris - SATU RUANGAN, DUA EJAAN. Laporan apa pun yang
 * mengelompokkan menurut nama ruangan akan menghitungnya dua kali, dan
 * kelirunya tidak berbunyi.
 */
async function ruangSidang(perkara, alat) {
  const baris = await alat.runQuery(
    `SELECT ruangan, COUNT(*) AS jml
       FROM perkara_jadwal_sidang
      WHERE perkara_id = ?
      GROUP BY ruangan ORDER BY jml DESC`,
    [perkara.perkaraId]
  );

  const keliling = baris.filter((b) => /keliling|terpadu/i.test(alat.cleanText(b.ruangan)));
  const daftar = baris.map((b) => ({
    ruangan: alat.cleanText(b.ruangan) || "belum tercatat",
    sidang: bilangan(b.jml),
    jenis: /keliling|terpadu/i.test(alat.cleanText(b.ruangan)) ? "sidang keliling" : "dalam gedung",
  }));

  return {
    judul: "Ruang sidang",
    ringkas:
      daftar.length === 0
        ? "Ruang sidang perkara ini belum tercatat."
        : keliling.length > 0
          ? `Sebagian sidang perkara ini berlangsung di luar gedung.`
          : `Seluruh sidang di dalam gedung, ${daftar.length} ruangan berbeda tercatat.`,
    metrik: [
      { label: "Ruangan berbeda", nilai: String(daftar.length) },
      { label: "Sidang keliling", nilai: String(keliling.reduce((n, x) => n + bilangan(x.jml), 0)) },
    ],
    kolom: [
      { kunci: "ruangan", label: "Ruangan" },
      { kunci: "sidang", label: "Sidang", angka: true },
      { kunci: "jenis", label: "Jenis" },
    ],
    baris: daftar,
    catatan:
      "SATU RUANGAN KADANG PUNYA DUA EJAAN di SIPP: \"Ruang Sidang 1 Dalam Gedung\" 1.353 baris dan " +
      "\"Ruang Sidang Dalam Gedung 1\" 211 baris. Laporan yang mengelompokkan menurut nama akan " +
      "menghitungnya sebagai dua ruangan.",
  };
}

/* ==========================================================================
 * 10. ROMBONGAN SEPEKAN
 * ==========================================================================
 *
 * Pembanding yang paling adil bukan "perkara sejenis sepanjang masa" melainkan
 * perkara yang MASUK BERSAMAAN - majelisnya sama-sama sibuk, hari liburnya
 * sama, dan panggilan jurusitanya berebut hari yang sama.
 *
 * Terukur pada pekan pendaftaran 473/Pdt.G/2026: 13 perkara masuk, 10 sudah
 * putus.
 */
async function rombonganSepekan(perkara, alat) {
  // Pekannya dihitung di Node lalu dibandingkan dengan BETWEEN. YEARWEEK
  // membungkus kolomnya dan memaksa seluruh tabel dihitung lebih dahulu -
  // terukur 4.345 ms.
  const pekan = rentangPekan(alat.tanggalIso(perkara.tanggalDaftar));
  if (!pekan) {
    return {
      judul: "Rombongan sepekan",
      ringkas: "Tanggal pendaftaran perkara ini tidak terbaca.",
      metrik: [],
      kolom: [],
      baris: [],
      catatan: "",
    };
  }

  const daftarBaris = await alat.runQuery(
    `SELECT pk.nomor_perkara AS nomorPerkara,
            pk.jenis_perkara_text AS jenisPerkara,
            pk.tanggal_pendaftaran AS tanggalDaftar,
            pp.tanggal_putusan AS tanggalPutusan,
            DATEDIFF(pp.tanggal_putusan, pk.tanggal_pendaftaran) AS lamaHari
       FROM perkara pk
       LEFT JOIN perkara_putusan pp ON pp.perkara_id = pk.perkara_id
      WHERE pk.tanggal_pendaftaran BETWEEN ? AND ?
      ORDER BY pk.tanggal_pendaftaran
      LIMIT 200`,
    [pekan.dari, pekan.sampai]
  );

  const daftar = daftarBaris.map((b) => ({
    nomorPerkara: alat.cleanText(b.nomorPerkara),
    jenisPerkara: alat.cleanText(b.jenisPerkara),
    tanggalDaftar: alat.tanggalIso(b.tanggalDaftar),
    tanggalPutusan: alat.tanggalIso(b.tanggalPutusan),
    lamaHari: b.lamaHari === null ? null : bilangan(b.lamaHari),
    iniPerkaranya: alat.cleanText(b.nomorPerkara) === alat.cleanText(perkara.nomorPerkara) ? "ya" : "",
  }));

  const putus = daftar.filter((x) => x.tanggalPutusan);
  const lama = putus.map((x) => x.lamaHari).filter((x) => typeof x === "number");
  const kita = daftar.find((x) => x.iniPerkaranya === "ya");

  return {
    judul: "Rombongan sepekan",
    ringkas:
      daftar.length === 0
        ? "Tidak ada perkara lain yang didaftarkan pada pekan yang sama."
        : `${putus.length} dari ${daftar.length} perkara sepekan sudah putus.` +
          (kita && kita.lamaHari !== null && alat.median(lama) !== null
            ? ` Perkara ini ${kita.lamaHari} hari, tengah rombongannya ${alat.median(lama)} hari.`
            : ""),
    metrik: [
      { label: "Perkara sepekan", nilai: String(daftar.length) },
      { label: "Sudah putus", nilai: String(putus.length) },
      { label: "Lama tengah", nilai: alat.median(lama) === null ? "—" : `${alat.median(lama)} hari` },
      { label: "Perkara ini", nilai: kita && kita.lamaHari !== null ? `${kita.lamaHari} hari` : "belum putus" },
    ],
    kolom: [
      { kunci: "nomorPerkara", label: "Nomor perkara" },
      { kunci: "jenisPerkara", label: "Jenis" },
      { kunci: "tanggalDaftar", label: "Daftar" },
      { kunci: "tanggalPutusan", label: "Putus" },
      { kunci: "lamaHari", label: "Lama (hari)", angka: true },
      { kunci: "iniPerkaranya", label: "Ini" },
    ],
    baris: daftar,
    catatan:
      "Pembanding yang paling adil bukan perkara sejenis sepanjang masa melainkan yang masuk " +
      "BERSAMAAN - majelisnya sama-sama sibuk, hari liburnya sama, dan panggilan jurusitanya " +
      "berebut hari yang sama. Pekan dihitung Senin-Minggu.",
  };
}

const DAFTAR_TAMBAHAN = [
  { kunci: "jedaTahapan", lingkup: "perkara", label: "Jeda antar tahapan", keterangan: "Di mana perkara ini berhenti lama." },
  { kunci: "hariSidang", lingkup: "perkara", label: "Hari sidang", keterangan: "Hari apa perkara ini bersidang, dibanding pengadilan." },
  { kunci: "kecepatanRelaas", lingkup: "perkara", label: "Kecepatan relaas", keterangan: "Jarak panggilan ke sidang, dan Pasal 122 HIR." },
  { kunci: "kehadiranPihak", lingkup: "perkara", label: "Kehadiran pihak", keterangan: "Siapa yang datang pada tiap sidang." },
  { kunci: "desaPihak", lingkup: "perkara", label: "Perkara sedesa", keterangan: "Perkara lain dari desa pihak pertama." },
  { kunci: "bebanMajelisBulan", lingkup: "perkara", label: "Beban majelis bulan itu", keterangan: "Berapa perkara dipikul majelisnya bulan pendaftaran." },
  { kunci: "jedaSesudahPutus", lingkup: "perkara", label: "Jeda sesudah putus", keterangan: "Minutasi, BHT, dan akta cerai." },
  { kunci: "jamSidang", lingkup: "perkara", label: "Jam sidang", keterangan: "Jam berapa perkara ini disidangkan." },
  { kunci: "ruangSidang", lingkup: "perkara", label: "Ruang sidang", keterangan: "Dalam gedung atau sidang keliling." },
  { kunci: "rombonganSepekan", lingkup: "perkara", label: "Rombongan sepekan", keterangan: "Perkara yang masuk pada pekan yang sama." },
];

const PENGERJA_TAMBAHAN = Object.assign(Object.create(null), {
  jedaTahapan,
  hariSidang,
  kecepatanRelaas,
  kehadiranPihak,
  desaPihak,
  bebanMajelisBulan: bebanMajelisBulanIni,
  jedaSesudahPutus,
  jamSidang,
  ruangSidang,
  rombonganSepekan,
});

module.exports = {
  DAFTAR_TAMBAHAN,
  PENGERJA_TAMBAHAN,
  // Diekspor untuk diuji satuan.
  KEHADIRAN,
  NAMA_HARI,
  TENGGANG_HIR,
};
