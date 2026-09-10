"use strict";

/**
 * ============================================================================
 * INTEGRITAS WAKTU PENGINPUTAN - APA YANG JEJAK WAKTU KATAKAN
 * ============================================================================
 *
 * SIPP menyimpan diinput_tanggal pada hampir seluruh tabelnya: kapan barisnya
 * benar-benar diketik. Kolom itu tidak pernah dibaca siapa pun, dan di dalamnya
 * ada tiga keterangan yang tidak dapat diperoleh dari tempat lain.
 *
 * ============================================================================
 * KETIGANYA PERTANYAAN, BUKAN TUDUHAN
 * ============================================================================
 *
 * Ini yang paling perlu dipegang oleh siapa pun yang menyentuh berkas ini.
 * Penginputan malam hari bukan pelanggaran - petugas yang menyelesaikan
 * pekerjaannya di rumah karena sidang seharian bukan orang yang berbuat salah.
 * Puluhan perkara yang diinput dalam satu waktu duduk juga bukan: pendaftaran
 * serentak memang terjadi, dan penyusulan input setelah SIPP mati seharian
 * adalah hal yang benar untuk dilakukan.
 *
 * Yang dikatakan angka-angka ini hanya satu: tanggal pada SIPP tidak selalu
 * tanggal peristiwanya. Itu penting karena SELURUH penilaian ketaatan tenggang
 * waktu bersandar pada tanggal-tanggal itu, dan sebuah pengadilan yang
 * seluruhnya menginput susulan akan tampak patuh sempurna pada tiap butir.
 *
 * Karena itu tiap butir di sini menyebut sebabnya apa adanya, dan tidak satu
 * pun menyimpulkan niat. Yang menyimpulkan niat harus manusia yang melihat
 * keadaannya - bukan kueri.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

const BATAS_BARIS = 5000;

/** Jam kerja kantor pengadilan. Di luar ini bukan pelanggaran - hanya ditandai. */
const JAM_MULAI = 7;
const JAM_SELESAI = 17;

/** Berapa baris dalam satu jam yang sudah pantas ditanyakan. */
const AMBANG_SATU_DUDUK = 20;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, hasil) => {
      if (error) reject(error);
      else resolve(Array.isArray(hasil) ? hasil : []);
    });
  });
}

const teks = (n) => String(n == null ? "" : n).trim();

/**
 * IN04 - penginputan di luar jam kerja dan hari libur.
 *
 * Dihitung dari jam pada diinput_tanggal, bukan dari tanggal pendaftarannya.
 * Diukur pada satu basis data SIPP: dari 431 perkara satu tahun, 29 diinput di
 * luar jam kerja - tidak satu pun dari itu berarti sesuatu tanpa dilihat
 * keadaannya, dan justru itulah sebabnya angkanya perlu ada.
 */
async function barisLuarJamKerja(rentang) {
  const ada = await sippSkemaService.kolomAda("perkara", "diinput_tanggal").catch(() => false);
  if (!ada) return [];

  const hasil = await runQuery(
    `SELECT p.perkara_id AS perkaraId,
            p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.diinput_oleh AS olehSiapa,
            p.diinput_tanggal AS diinput,
            HOUR(p.diinput_tanggal) AS jam,
            DAYOFWEEK(p.diinput_tanggal) AS hari
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND p.diinput_tanggal IS NOT NULL
      ORDER BY p.diinput_tanggal
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((r) => {
    const jam = Number(r.jam);
    const hari = Number(r.hari); // 1 = Minggu, 7 = Sabtu menurut MySQL
    const akhirPekan = hari === 1 || hari === 7;
    const luarJam = jam < JAM_MULAI || jam >= JAM_SELESAI;

    const sebab = [];
    if (akhirPekan) sebab.push(hari === 1 ? "hari Minggu" : "hari Sabtu");
    if (luarJam) sebab.push(`pukul ${String(jam).padStart(2, "0")}`);

    return {
      kunci: `${teks(r.nomorPerkara)}#IN04`,
      nomorPerkara: teks(r.nomorPerkara),
      jenisPerkara: teks(r.jenisPerkara),
      olehSiapa: teks(r.olehSiapa),
      diinput: teks(r.diinput),
      memenuhi: !akhirPekan && !luarJam,
      sebabTidakMemenuhi: sebab.length ? `diinput ${sebab.join(", ")}` : "",
    };
  });
}

/**
 * IN03 - kewajaran waktu penginputan.
 *
 * Puluhan perkara yang diinput dalam satu jam berarti tanggal-tanggal pada
 * perkara itu diketik sekaligus, bukan diikuti seiring peristiwanya. Sekali
 * lagi: itu wajar terjadi, dan bukan pelanggaran. Yang tidak wajar adalah
 * memakai tanggal-tanggal itu untuk menilai ketaatan tenggang waktu seolah ia
 * dicatat saat peristiwanya.
 *
 * Dihitung per JAM, bukan per hari: satu hari sibuk yang wajar dapat memuat
 * lima puluh pendaftaran, sedangkan lima puluh baris dalam satu jam berarti
 * kurang dari satu setengah menit per perkara.
 */
async function barisSatuDuduk(rentang) {
  const ada = await sippSkemaService.kolomAda("perkara", "diinput_tanggal").catch(() => false);
  if (!ada) return [];

  const hasil = await runQuery(
    `SELECT p.perkara_id AS perkaraId,
            p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.diinput_oleh AS olehSiapa,
            DATE_FORMAT(p.diinput_tanggal, '%Y-%m-%d %H') AS jamInput
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND p.diinput_tanggal IS NOT NULL
      ORDER BY p.diinput_tanggal
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  // Dihitung di sini, bukan lewat subkueri berkorelasi: jumlahnya kecil dan
  // menghitungnya di JavaScript membuat aturannya terbaca oleh yang membaca
  // berkas ini, bukan tersembunyi di dalam SQL bertingkat.
  const hitungan = new Map();
  for (const r of hasil) {
    const k = `${teks(r.olehSiapa)}|${teks(r.jamInput)}`;
    hitungan.set(k, (hitungan.get(k) || 0) + 1);
  }

  return hasil.map((r) => {
    const k = `${teks(r.olehSiapa)}|${teks(r.jamInput)}`;
    const seJam = hitungan.get(k) || 1;
    const wajar = seJam < AMBANG_SATU_DUDUK;
    return {
      kunci: `${teks(r.nomorPerkara)}#IN03`,
      nomorPerkara: teks(r.nomorPerkara),
      jenisPerkara: teks(r.jenisPerkara),
      olehSiapa: teks(r.olehSiapa),
      jamInput: teks(r.jamInput),
      seJam,
      memenuhi: wajar,
      sebabTidakMemenuhi: wajar
        ? ""
        : `${seJam} perkara diinput ${teks(r.olehSiapa) || "petugas yang sama"} dalam satu jam yang sama`,
    };
  });
}

/**
 * IN05 - kesesuaian urutan tahapan perkara.
 *
 * Tanggal yang tidak mungkin terjadi menurut hukum acara. Ketiganya diperiksa
 * sebagai URUTAN, bukan sebagai tenggang: yang dicari bukan terlambat berapa
 * hari, melainkan peristiwa yang tercatat mendahului peristiwa yang seharusnya
 * lebih dulu.
 *
 * Urutan yang terbalik hampir selalu berarti salah ketik tahun atau bulan -
 * dan salah ketik semacam itu tidak pernah menampakkan dirinya sendiri, sebab
 * tanggalnya tetap tanggal yang sah.
 */
async function barisUrutanTahapan(rentang) {
  const adaPutusan = await sippSkemaService.tabelAda("perkara_putusan").catch(() => false);
  if (!adaPutusan) return [];

  const hasil = await runQuery(
    `SELECT p.perkara_id AS perkaraId,
            p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.tanggal_pendaftaran AS daftar,
            d.tanggal_putusan AS putusan,
            d.tanggal_minutasi AS minutasi,
            d.tanggal_bht AS bht
       FROM perkara p
       JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  const tgl = (v) => {
    const t = teks(v);
    if (!t || /^0000-00-00/.test(t)) return "";
    return t.slice(0, 10);
  };

  return hasil.map((r) => {
    const daftar = tgl(r.daftar);
    const putusan = tgl(r.putusan);
    const minutasi = tgl(r.minutasi);
    const bht = tgl(r.bht);

    const salah = [];
    if (putusan && daftar && putusan < daftar) salah.push("putusan mendahului pendaftaran");
    if (minutasi && putusan && minutasi < putusan) salah.push("minutasi mendahului putusan");
    if (bht && putusan && bht < putusan) salah.push("berkekuatan hukum tetap mendahului putusan");

    return {
      kunci: `${teks(r.nomorPerkara)}#IN05`,
      nomorPerkara: teks(r.nomorPerkara),
      jenisPerkara: teks(r.jenisPerkara),
      tanggalDaftar: daftar,
      tanggalPutusan: putusan,
      tanggalMinutasi: minutasi,
      tanggalBht: bht,
      memenuhi: salah.length === 0,
      sebabTidakMemenuhi: salah.join("; "),
    };
  });
}

const BUTIR = [
  {
    kode: "IN04",
    kunci: "penginputanLuarJamKerja",
    judul: "Penginputan di Luar Jam Kerja dan Hari Libur",
    keterangan:
      "Perkara yang barisnya diketik ke SIPP di luar pukul 07 sampai 17, atau pada Sabtu dan Minggu. Ini PERTANYAAN, bukan tuduhan - petugas yang menyusul pekerjaannya di rumah bukan orang yang berbuat salah. Yang dikatakan angkanya: tanggal pada SIPP tidak selalu tanggal peristiwanya.",
    baris: barisLuarJamKerja,
    pembilang: "Perkara yang diinput pada hari kerja dalam jam kerja",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini dan punya jejak waktu input",
    ruas: "diinput_tanggal, diinput_oleh",
  },
  {
    kode: "IN03",
    kunci: "kewajaranWaktuPenginputan",
    judul: "Kewajaran Waktu Penginputan Data",
    keterangan:
      "Perkara yang diinput bersama puluhan perkara lain oleh petugas yang sama dalam satu jam. Dihitung per jam, bukan per hari: satu hari sibuk yang wajar dapat memuat lima puluh pendaftaran, sedangkan lima puluh baris dalam satu jam berarti kurang dari satu setengah menit per perkara.",
    baris: barisSatuDuduk,
    pembilang: `Perkara yang pada jam penginputannya bersama kurang dari ${AMBANG_SATU_DUDUK} perkara lain oleh petugas yang sama`,
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini dan punya jejak waktu input",
    ruas: "diinput_tanggal, diinput_oleh",
  },
  {
    kode: "IN05",
    kunci: "urutanTahapanPerkara",
    judul: "Kesesuaian Urutan Tahapan Perkara",
    keterangan:
      "Tanggal yang tidak mungkin terjadi menurut hukum acara: putusan mendahului pendaftaran, minutasi mendahului putusan, atau berkekuatan hukum tetap mendahului putusan. Hampir selalu salah ketik tahun atau bulan - dan salah ketik semacam itu tidak pernah menampakkan dirinya sendiri, sebab tanggalnya tetap tanggal yang sah.",
    baris: barisUrutanTahapan,
    pembilang: "Perkara yang urutan tanggal tahapannya mungkin terjadi",
    penyebut: "Seluruh perkara yang sudah diputus pada rentang ini",
    ruas: "tanggal_pendaftaran, tanggal_putusan, tanggal_minutasi, tanggal_bht",
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
      versiRumus: "integritas-waktu-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: b.pembilang,
        penyebut: b.penyebut,
        dikecualikan:
          "Perkara yang tidak punya jejak waktu input tidak dapat dinilai kewajaran waktunya - ia dikeluarkan, bukan dihitung gagal. Ketiadaan jejaknya sendiri diperiksa butir lain.",
        tabelSumber: "perkara, perkara_putusan - jejak waktu milik SIPP sendiri",
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
  AMBANG_SATU_DUDUK,
  BUTIR,
  JAM_MULAI,
  JAM_SELESAI,
  barisLuarJamKerja,
  barisSatuDuduk,
  barisUrutanTahapan,
  daftarkanSemua,
  lupakanSemua,
  sambungan,
};
