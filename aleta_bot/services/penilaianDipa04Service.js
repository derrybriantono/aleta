"use strict";

/**
 * ============================================================================
 * LAPORAN DIPA 04 - DIUKUR DARI SIPP, BUKAN DARI ANGKA YANG DILAPORKAN
 * ============================================================================
 *
 * Berkas ini sudah dua kali salah, dan keduanya pantas dicatat supaya tidak
 * terulang:
 *
 *   Pertama  - dinyatakan bahwa data LIPA 14, 15, 16, dan 21 "tidak ada di
 *              mana pun yang dapat dibaca ALETA". Itu keliru: saya memeriksa
 *              SIPP lalu menyimpulkan tentang seluruh dunia.
 *   Kedua    - lalu dianggap datanya hanya ada di aplikasi pendukung laporan,
 *              sehingga keempat butir dibangun atas tabel yang tidak ada di
 *              tangan. Itu juga keliru, dan lebih halus: butir yang bersandar
 *              pada tabel yang tak pernah dapat diperiksa akan selalu tampak
 *              "belum ada datanya", dan tidak pernah ketahuan salahnya.
 *
 * Yang benar disampaikan pengguna, dan seluruhnya dapat diukur dari SIPP:
 *
 *   LIPA 14  sidang yang DI LUAR Ruang Sidang 1 dan 2 - dibaca dari nama
 *            ruangan pada jadwal sidang, bukan dari penanda sidang_keliling
 *   LIPA 15  perkara yang panjarnya nol - atau positanya menyebut surat
 *            keterangan tidak mampu
 *   LIPA 16  perkara yang mendaftar TANPA kuasa hukum; merekalah yang
 *            melewati Pos Bantuan Hukum
 *   LIPA 21  sidang di KUA atas perkara pengesahan perkawinan
 *
 * ============================================================================
 * PENANDA sidang_keliling MILIK SIPP TIDAK DIPAKAI - DAN SEBABNYA TERUKUR
 * ============================================================================
 *
 * Diukur pada satu tahun basis data SIPP: 907 sidang, 97 di antaranya di luar
 * Ruang Sidang 1 dan 2, tetapi HANYA 39 yang bertanda sidang_keliling.
 *
 * Penandanya melewatkan 58 sidang. Memakai penanda itu berarti melaporkan
 * kurang dari separuh sidang di luar gedung yang benar-benar berlangsung - dan
 * laporan yang kurang berarti satuan kerja tidak menerima penggantian biaya
 * yang menjadi haknya.
 *
 * Selisih itu sendiri dipulangkan sebagai keterangan pada tiap baris, supaya
 * yang membacanya tahu penandanya tidak dapat dipercaya sendirian.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

const BATAS_BARIS = 5000;

/**
 * Ruang sidang di dalam gedung.
 *
 * Dicocokkan dengan pola, bukan dengan daftar id: nomor ruangan berbeda antar
 * satuan kerja, sedangkan penamaannya seragam - "Ruang Sidang 1" dan "Ruang
 * Sidang 2". Ruang Sidang 3 dan seterusnya juga di dalam gedung, tetapi
 * keduanya tidak aktif pada satuan kerja yang diperiksa; polanya dibuat memuat
 * seluruh "Ruang Sidang <angka>" supaya tidak keliru pada satuan kerja lain.
 */
const POLA_RUANG_DALAM = "^[[:space:]]*Ruang[[:space:]]+Sidang[[:space:]]*[0-9]+[[:space:]]*$";

/** Batas panjar yang masih dianggap nol - hanya PNBP, bukan panjar sungguhan. */
const BATAS_PANJAR_NOL = 10000;

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
  const x = Number(String(n ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
};

/**
 * LIPA 14 - sidang di luar gedung pengadilan.
 *
 * Satu baris per SIDANG, bukan per perkara: satu perkara dapat bersidang
 * beberapa kali di luar gedung, dan laporannya menghitung pelaksanaan sidang.
 *
 * Yang dinilai memenuhi: sidang di luar gedung yang penandanya sekalian
 * tercatat. Yang tidak memenuhi bukan sidangnya yang salah - melainkan
 * pencatatannya yang tidak lengkap, sehingga laporan yang disusun dari penanda
 * itu akan kurang.
 */
async function barisSidangLuarGedung(rentang) {
  const ada = await sippSkemaService.tabelAda("perkara_jadwal_sidang").catch(() => false);
  if (!ada) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            j.tanggal_sidang AS tanggalSidang,
            j.ruangan AS ruangan,
            j.sidang_keliling AS penanda
       FROM perkara p
       JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND j.ruangan IS NOT NULL
        AND TRIM(j.ruangan) <> ''
        AND j.ruangan NOT REGEXP ?
      ORDER BY j.tanggal_sidang
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai, POLA_RUANG_DALAM]
  );

  return hasil.map((r, i) => {
    const penanda = teks(r.penanda);
    const bertanda = penanda !== "" && penanda !== "0" && penanda.toUpperCase() !== "T";
    return {
      kunci: `${teks(r.nomorPerkara)}#LP14#${i}`,
      nomorPerkara: teks(r.nomorPerkara),
      jenisPerkara: teks(r.jenisPerkara),
      tanggalSidang: teks(r.tanggalSidang),
      ruangan: teks(r.ruangan),
      memenuhi: bertanda,
      sebabTidakMemenuhi: bertanda
        ? ""
        : `sidang di ${teks(r.ruangan)} tidak bertanda sidang keliling - laporan yang disusun dari penanda ini akan melewatkannya`,
    };
  });
}

/**
 * LIPA 15 - pembebasan biaya perkara, diperiksa dari TIGA arah.
 *
 * Ketiganya seharusnya menunjuk perkara yang sama:
 *
 *   penanda prodeo pada perkara
 *   panjar masuk nol - hanya PNBP, atau tidak ada sama sekali
 *   posita menyebut surat keterangan tidak mampu atau miskin
 *
 * Diukur pada satu tahun: penanda 30, panjar nol 30, posita 31. Yang satu itu
 * justru temuannya - perkara yang menyatakan dirinya tidak mampu, tetapi tetap
 * membayar dan tidak pernah ditandai prodeo.
 *
 * Karena itu yang dinilai KESESUAIAN ketiganya, bukan jumlahnya. Jumlah yang
 * benar tidak berarti apa-apa bila ketiga penandanya menunjuk perkara yang
 * berbeda-beda.
 */
async function barisPembebasanBiaya(rentang) {
  const adaPosita = await sippSkemaService.kolomAda("perkara", "posita").catch(() => false);

  const hasil = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.prodeo AS prodeo,
            ${adaPosita
              ? `CASE WHEN p.posita LIKE '%tidak mampu%' OR p.posita LIKE '%keterangan miskin%' THEN 1 ELSE 0 END`
              : "0"} AS positaMiskin,
            COALESCE((SELECT SUM(b.jumlah) FROM perkara_biaya b
                       WHERE b.perkara_id = p.perkara_id AND b.jenis_transaksi = 1), 0) AS panjarMasuk
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil
    .map((r) => {
      const bertanda = angka(r.prodeo) === 1;
      const panjarNol = angka(r.panjarMasuk) <= BATAS_PANJAR_NOL;
      const positaMiskin = angka(r.positaMiskin) === 1;

      // Hanya perkara yang MENYENTUH pembebasan biaya yang dinilai. Perkara
      // yang membayar penuh dan tidak menyebut ketidakmampuan bukan urusan
      // butir ini - memasukkannya ke penyebut akan membuat angkanya selalu
      // hampir sempurna dan berhenti berarti.
      if (!bertanda && !panjarNol && !positaMiskin) return null;

      const selisih = [];
      if (bertanda && !panjarNol) selisih.push("bertanda prodeo tetapi panjarnya terbayar");
      if (!bertanda && panjarNol) selisih.push("panjarnya nol tetapi tidak bertanda prodeo");
      if (positaMiskin && !bertanda)
        selisih.push("positanya menyebut tidak mampu tetapi tidak bertanda prodeo");

      return {
        kunci: `${teks(r.nomorPerkara)}#LP15`,
        nomorPerkara: teks(r.nomorPerkara),
        jenisPerkara: teks(r.jenisPerkara),
        bertandaProdeo: bertanda,
        panjarMasuk: angka(r.panjarMasuk),
        positaMenyebutTidakMampu: positaMiskin,
        memenuhi: selisih.length === 0,
        sebabTidakMemenuhi: selisih.join("; "),
      };
    })
    .filter(Boolean);
}

/**
 * LIPA 16 - Pos Bantuan Hukum.
 *
 * SIPP memang tidak mencatat layanan Posbakum. Yang dicatatnya cukup untuk
 * mengetahui SIAPA yang melewatinya: perkara yang mendaftar tanpa kuasa hukum
 * disusun gugatannya di Pos Bantuan Hukum.
 *
 * Yang dinilai karena itu bukan jumlah layanannya - angka itu ada di aplikasi
 * pendukung laporan - melainkan apakah perkara tanpa kuasa memang tercatat
 * lengkap identitas pemohonnya, sebab itulah yang dipakai Posbakum menyusun
 * surat gugatannya.
 */
async function barisPosBantuanHukum(rentang) {
  const adaKuasa = await sippSkemaService.tabelAda("perkara_pengacara").catch(() => false);
  if (!adaKuasa) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            (SELECT COUNT(*) FROM perkara_pengacara g WHERE g.perkara_id = p.perkara_id) AS jumlahKuasa,
            (SELECT COUNT(*) FROM perkara_pihak1 pp WHERE pp.perkara_id = p.perkara_id) AS jumlahPihak
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil
    .filter((r) => angka(r.jumlahKuasa) === 0)
    .map((r) => {
      const adaPihak = angka(r.jumlahPihak) > 0;
      return {
        kunci: `${teks(r.nomorPerkara)}#LP16`,
        nomorPerkara: teks(r.nomorPerkara),
        jenisPerkara: teks(r.jenisPerkara),
        memenuhi: adaPihak,
        sebabTidakMemenuhi: adaPihak
          ? ""
          : "mendaftar tanpa kuasa tetapi identitas pemohonnya tidak tercatat - Posbakum menyusun gugatan dari identitas itu",
      };
    });
}

/**
 * LIPA 21 - pelayanan terpadu sidang keliling.
 *
 * Dua syarat sekaligus menurut keterangan pengguna: sidangnya di KUA, dan
 * perkaranya pengesahan perkawinan. Sidang di KUA atas perkara lain bukan
 * pelayanan terpadu, dan pengesahan perkawinan yang bersidang di gedung juga
 * bukan.
 */
async function barisPelayananTerpadu(rentang) {
  const ada = await sippSkemaService.tabelAda("perkara_jadwal_sidang").catch(() => false);
  if (!ada) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            j.tanggal_sidang AS tanggalSidang,
            j.ruangan AS ruangan,
            j.sidang_keliling AS penanda
       FROM perkara p
       JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND j.ruangan LIKE '%KUA%'
        AND (p.jenis_perkara_nama LIKE '%engesahan Perkawinan%'
             OR p.jenis_perkara_nama LIKE '%stbat%')
      ORDER BY j.tanggal_sidang
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((r, i) => {
    const penanda = teks(r.penanda);
    const bertanda = penanda !== "" && penanda !== "0" && penanda.toUpperCase() !== "T";
    return {
      kunci: `${teks(r.nomorPerkara)}#LP21#${i}`,
      nomorPerkara: teks(r.nomorPerkara),
      jenisPerkara: teks(r.jenisPerkara),
      tanggalSidang: teks(r.tanggalSidang),
      ruangan: teks(r.ruangan),
      memenuhi: bertanda,
      sebabTidakMemenuhi: bertanda
        ? ""
        : "sidang terpadu di KUA tidak bertanda sidang keliling pada SIPP",
    };
  });
}

const BUTIR = [
  {
    kode: "LP14",
    kunci: "lipaSidangLuarGedung",
    judul: "LIPA 14 — Sidang di Luar Gedung Pengadilan",
    keterangan:
      "Sidang yang berlangsung di luar Ruang Sidang 1 dan 2 - kantor KUA, kantor desa, kantor camat. Dibaca dari nama ruangan pada jadwal sidang, BUKAN dari penanda sidang keliling: diukur pada satu tahun, 97 sidang di luar gedung tetapi hanya 39 yang bertanda, sehingga laporan yang disusun dari penanda itu melewatkan 58 di antaranya.",
    baris: barisSidangLuarGedung,
    pembilang: "Sidang di luar gedung yang penanda sidang kelilingnya ikut tercatat",
    penyebut: "Seluruh sidang di luar Ruang Sidang 1 dan 2 pada rentang ini",
    tabelSumber: "perkara disambung perkara_jadwal_sidang, dicocokkan dengan nama ruangan",
    ruasSumber: "tanggal_pendaftaran, tanggal_sidang, ruangan, sidang_keliling",
  },
  {
    kode: "LP15",
    kunci: "lipaPembebasanBiaya",
    judul: "LIPA 15 — Pembebasan Biaya Perkara (Prodeo)",
    keterangan:
      "Diperiksa dari TIGA arah yang seharusnya menunjuk perkara yang sama: penanda prodeo, panjar masuk yang nol, dan posita yang menyebut surat keterangan tidak mampu. Yang dinilai kesesuaian ketiganya - jumlah yang benar tidak berarti apa-apa bila ketiga penandanya menunjuk perkara yang berbeda.",
    baris: barisPembebasanBiaya,
    pembilang: "Perkara yang ketiga penandanya sesuai satu sama lain",
    penyebut:
      "Perkara yang menyentuh pembebasan biaya - bertanda prodeo, atau panjarnya nol, atau positanya menyebut ketidakmampuan",
    tabelSumber: "perkara disambung perkara_biaya, beserta ruas posita pada perkara",
    ruasSumber: "prodeo, posita, jenis_transaksi, jumlah",
  },
  {
    kode: "LP16",
    kunci: "lipaPosBantuanHukum",
    judul: "LIPA 16 — Pos Bantuan Hukum",
    keterangan:
      "SIPP tidak mencatat layanan Posbakum, tetapi mencatat siapa yang melewatinya: perkara yang mendaftar TANPA kuasa hukum disusun gugatannya di Pos Bantuan Hukum. Yang dinilai apakah identitas pemohonnya tercatat - itulah yang dipakai Posbakum menyusun surat gugatannya.",
    baris: barisPosBantuanHukum,
    pembilang: "Perkara tanpa kuasa yang identitas pemohonnya tercatat",
    penyebut: "Seluruh perkara yang mendaftar tanpa kuasa hukum pada rentang ini",
    tabelSumber: "perkara disambung perkara_pengacara dan perkara_pihak1",
    ruasSumber: "tanggal_pendaftaran, perkara_id pada perkara_pengacara",
  },
  {
    kode: "LP21",
    kunci: "lipaPelayananTerpadu",
    judul: "LIPA 21 — Pelayanan Terpadu Sidang Keliling",
    keterangan:
      "Dua syarat sekaligus: sidangnya di KUA, dan perkaranya pengesahan perkawinan. Sidang di KUA atas perkara lain bukan pelayanan terpadu, dan pengesahan perkawinan yang bersidang di gedung juga bukan.",
    baris: barisPelayananTerpadu,
    pembilang: "Sidang terpadu di KUA yang penanda sidang kelilingnya ikut tercatat",
    penyebut: "Seluruh sidang di KUA atas perkara pengesahan perkawinan pada rentang ini",
    tabelSumber: "perkara disambung perkara_jadwal_sidang, disaring nama ruangan dan jenis perkara",
    ruasSumber: "jenis_perkara_nama, ruangan, sidang_keliling",
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
      versiRumus: "dipa04-v2",
      ambangDipakai: [],
      caraHitung: {
        pembilang: b.pembilang,
        penyebut: b.penyebut,
        dikecualikan:
          "Perkara dan sidang yang tidak menyentuh butir ini tidak masuk penyebut. Memasukkan seluruh perkara akan membuat angkanya hampir selalu sempurna dan berhenti berarti.",
        tabelSumber: b.tabelSumber,
        ruasSumber: b.ruasSumber,
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
  BATAS_PANJAR_NOL,
  BUTIR,
  POLA_RUANG_DALAM,
  barisPelayananTerpadu,
  barisPembebasanBiaya,
  barisPosBantuanHukum,
  barisSidangLuarGedung,
  daftarkanSemua,
  lupakanSemua,
  sambungan,
};
