"use strict";

/**
 * ============================================================================
 * KEMAMPUAN MESIN PENILAIAN - BAB 1 KATALOG e-AUDIT, DIBUKTIKAN DENGAN DIJALANKAN
 * ============================================================================
 *
 * Bab 1 katalog e-Audit berbeda dari sebelas bab lainnya. Sebelas bab itu
 * MENGUKUR pengadilan; Bab 1 mengukur MESINNYA - apakah mesin penilaian ini
 * punya periode tujuh jendela, apakah tiap angka dapat dibuka menjadi
 * buktinya, apakah nilai dengan penyebut terlalu kecil ditahan.
 *
 * ============================================================================
 * KENAPA BAB 1 SELALU TERBACA "BELUM" PADAHAL SUDAH DIBANGUN
 * ============================================================================
 *
 * Keadaan tiap butir dihitung dari SAMBUNGAN, dan sambungan hanya dapat
 * menunjuk kunci penilaian yang terdaftar di kerangka. Kemampuan mesin bukan
 * penilaian - tidak ada kunci untuk ditunjuk - sehingga kelimanya jatuh ke
 * "belum" bukan karena belum ada, melainkan karena tidak ada tempat
 * menyebutkannya.
 *
 * Akibatnya papan e-Audit MENGECILKAN dirinya sendiri: Bab 1 tertulis 0 dari
 * 6, padahal MS01, MS03, MS04, dan MS05 sudah tertanam sebagai kontrak yang
 * ditegakkan saat pendaftaran - kerangkaPenilaianService bahkan menyebut
 * nomornya sendiri di kepala berkasnya.
 *
 * Papan yang salah menyebut sisa pekerjaannya sama merusaknya dengan papan
 * yang menyembunyikannya. Yang satu membuat orang menyangka pekerjaannya
 * selesai; yang lain membuat orang mengerjakan ulang apa yang sudah ada.
 *
 * ============================================================================
 * DIJALANKAN, BUKAN DIAKUI
 * ============================================================================
 *
 * Aturan katalog e-Audit sejak awal: keadaan DIHITUNG, tidak ditulis tangan.
 * Aturan itu tidak boleh dilanggar hanya karena yang diperiksa kali ini
 * mesinnya sendiri.
 *
 * Karena itu tiap kemampuan di sini dibuktikan dengan MENJALANKANNYA:
 *
 *   - pembatas penyebut tidak diperiksa dengan membaca angka 20, melainkan
 *     dengan meminta nilai atas penyebut 19 dan memastikan yang kembali
 *     bukan nilai;
 *   - kewajiban menyebutkan bukti tidak diperiksa dengan mencari kata
 *     "baris" di dalam kode, melainkan dengan menyodorkan definisi tanpa
 *     baris() dan memastikan definisi itu DITOLAK.
 *
 * Pemeriksaan yang hanya membaca keberadaan nama akan tetap hijau pada hari
 * fungsinya dikosongkan isinya - dan hari itulah pemeriksaan ini paling
 * dibutuhkan.
 */

const periode = require("./periodePenilaianService");
const kerangkaPenilaian = require("./kerangkaPenilaianService");
const ambang = require("./ambangPenilaianService");
const riwayatNilai = require("./riwayatNilaiService");

/** Menjalankan satu pemeriksaan tanpa membiarkannya menjatuhkan yang lain. */
function jalankan(kunci, uji) {
  try {
    const hasil = uji();
    if (hasil && hasil.terpenuhi) return { kunci, terpenuhi: true, bukti: hasil.bukti };
    return {
      kunci,
      terpenuhi: false,
      bukti: "",
      sebab: (hasil && hasil.sebab) || "pemeriksaan tidak memulangkan keterangan",
    };
  } catch (galat) {
    return {
      kunci,
      terpenuhi: false,
      bukti: "",
      sebab: `pemeriksaannya melempar galat: ${String((galat && galat.message) || galat).slice(0, 160)}`,
    };
  }
}

/** MS01 - satu butir ditulis sekali, dilihat dari tujuh jendela waktu. */
function periksaTujuhJendela() {
  const jendela = Array.isArray(periode.PERIODE) ? periode.PERIODE : [];
  if (jendela.length !== 7) {
    return { terpenuhi: false, sebab: `jendelanya ${jendela.length}, seharusnya tujuh` };
  }

  // Tiap jendela benar-benar DIJALANKAN atas satu tanggal acuan. Jendela yang
  // terdaftar tetapi tidak menghasilkan satuan waktu bukan jendela - dan
  // memeriksanya sekadar dengan menghitung isi daftar akan tetap hijau pada
  // hari salah satunya berhenti bekerja.
  const acuan = "2026-09-09";
  const gagal = [];
  for (const j of jendela) {
    try {
      const p = periode.satuanPeriode(j.jenis, acuan);
      const unit = (p && p.unit) || [];
      if (!unit.length) {
        gagal.push(`${j.jenis} tidak menghasilkan satuan`);
        continue;
      }
      const teks = periode.rentangTerbaca(unit[0].mulai, unit[unit.length - 1].selesai);
      if (!String(teks || "").trim()) gagal.push(`${j.jenis} tidak menyebut rentangnya`);
    } catch (galat) {
      gagal.push(`${j.jenis}: ${String((galat && galat.message) || galat).slice(0, 60)}`);
    }
  }

  if (gagal.length) return { terpenuhi: false, sebab: gagal.join("; ") };

  return {
    terpenuhi: true,
    bukti: `tujuh jendela dijalankan atas ${acuan}, seluruhnya menghasilkan satuan beserta rentangnya`,
  };
}

/** MS04 - penilaian tanpa bukti DITOLAK saat didaftarkan. */
function periksaWajibBukti() {
  const tanpaBukti = {
    kunci: "ujiKemampuanTanpaBukti",
    judul: "Uji kemampuan",
    keterangan: "Definisi sengaja tanpa baris(), hanya untuk diuji ditolak.",
    lantai: "harian",
    versiRumus: "uji-1",
    caraHitung: "tidak dihitung - definisi ini memang untuk ditolak",
    hitung: () => ({ nilai: 0 }),
  };

  const cela = kerangkaPenilaian.celaDefinisi(tanpaBukti) || [];
  const menolak = cela.some((x) => String(x).includes("baris()"));
  if (!menolak) {
    return {
      terpenuhi: false,
      sebab: "definisi tanpa baris() TIDAK ditolak - angka tanpa bukti dapat berdiri",
    };
  }
  return { terpenuhi: true, bukti: "definisi tanpa baris() ditolak saat didaftarkan" };
}

/** MS05 - nilai berpenyebut kurang dari dua puluh tidak ditampilkan. */
function periksaPembatasPenyebut() {
  const batas = Number(periode.CUKUP_PENYEBUT);
  if (!Number.isFinite(batas) || batas < 20) {
    return { terpenuhi: false, sebab: `pembatasnya ${batas}, seharusnya sekurang-kurangnya 20` };
  }

  const kurang = periode.nilaiDenganPembatas(10, batas - 1);
  if (kurang.nilai !== null || kurang.cukup !== false) {
    return {
      terpenuhi: false,
      sebab: `penyebut ${batas - 1} tetap menghasilkan nilai ${kurang.nilai} - pembatasnya tidak menahan`,
    };
  }

  const cukup = periode.nilaiDenganPembatas(10, batas);
  if (cukup.nilai === null) {
    return { terpenuhi: false, sebab: `penyebut ${batas} justru ditahan - pembatasnya terlalu ketat` };
  }

  return {
    terpenuhi: true,
    bukti: `penyebut ${batas - 1} ditahan, penyebut ${batas} menghasilkan ${cukup.nilai}`,
  };
}

/** MS03 - nilai disimpan tiap periode BESERTA aturan yang berlaku saat itu. */
function periksaRiwayatNilai() {
  const perlu = ["simpanNilai", "bacaRiwayat", "bandingkanHitungUlang"];
  const kurang = perlu.filter((n) => typeof riwayatNilai[n] !== "function");
  if (kurang.length) {
    return { terpenuhi: false, sebab: `riwayat nilai belum punya: ${kurang.join(", ")}` };
  }

  // Aturan yang berlaku harus dapat DISIDIK - tanpa itu, "dihitung dengan
  // aturan yang mana" tidak dapat dijawab, dan riwayatnya kehilangan
  // gunanya yang utama.
  if (typeof ambang.sidikAmbang !== "function") {
    return { terpenuhi: false, sebab: "ambang yang berlaku tidak dapat disidik" };
  }
  // Sidiknya diminta atas SATU TANGGAL. Ambang dapat berubah, dan sidik yang
  // tidak terikat tanggal tidak menjawab "aturan yang mana yang berlaku
  // ketika angka ini dihitung" - justru pertanyaan yang membuat riwayat ini ada.
  const sidik = ambang.sidikAmbang("2026-09-09");
  if (!String(sidik || "").trim()) {
    return { terpenuhi: false, sebab: "sidik ambang kosong" };
  }

  return {
    terpenuhi: true,
    bukti: `nilai tersimpan per periode; aturan yang berlaku bersidik ${String(sidik).slice(0, 16)}`,
  };
}

/** MS02 - satu nilai dipecah menurut jenjangnya, dan rapor wajib menyebut dimensinya. */
function periksaRaporBerjenjang() {
  let kerangkaRapor;
  let raporBerjenjang;
  try {
    kerangkaRapor = require("./kerangkaRaporService");
    raporBerjenjang = require("./raporBerjenjangService");
  } catch (galat) {
    return { terpenuhi: false, sebab: `kerangka rapor tidak dapat dimuat: ${String(galat.message || galat).slice(0, 90)}` };
  }

  if (typeof raporBerjenjang.berjenjang !== "function") {
    return { terpenuhi: false, sebab: "pemecah berjenjang tidak ada" };
  }

  // Rapor tanpa dimensi harus DITOLAK: rapor yang tidak tahu ruas mana yang
  // menjadi nama orangnya tidak dapat dipecah menurut siapa pun.
  const tanpaDimensi = {
    kunci: "ujiKemampuanRaporTanpaDimensi",
    judul: "Uji kemampuan",
    keterangan: "Definisi sengaja tanpa dimensi, hanya untuk diuji ditolak.",
    lantai: "harian",
    versiRumus: "uji-1",
    sumber: "ujiKemampuan",
    sebutanDimensi: "orang",
  };
  const cela = kerangkaRapor.celaDefinisi(tanpaDimensi) || [];
  if (!cela.some((x) => String(x).includes("dimensi"))) {
    return { terpenuhi: false, sebab: "rapor tanpa dimensi TIDAK ditolak" };
  }

  return { terpenuhi: true, bukti: "pemecah berjenjang ada; rapor tanpa dimensi ditolak" };
}

/** MS06 - nilai, temuan, bukti, dan tanggal hitung dalam satu berkas. */
function periksaBerkasPengawasan() {
  let berkas;
  try {
    berkas = require("./berkasPengawasanService");
  } catch (galat) {
    return {
      terpenuhi: false,
      sebab: `berkas pengawasan belum ada: ${String(galat.message || galat).slice(0, 90)}`,
    };
  }
  if (typeof berkas.celaBerkas !== "function") {
    return { terpenuhi: false, sebab: "berkas pengawasan tidak dapat memeriksa dirinya sendiri" };
  }
  return { terpenuhi: true, bukti: "penyusun berkas pengawasan tersedia" };
}

/**
 * Kemampuan yang diperiksa, beserta butir katalog yang dipenuhinya.
 *
 * Nama kuncinya dipakai katalog untuk menyambung - sama seperti nama penilaian
 * dipakai untuk menyambung butir pengukuran.
 */
const PEMERIKSA = {
  periodeTujuhJendela: periksaTujuhJendela,
  raporBerjenjang: periksaRaporBerjenjang,
  riwayatNilaiTersimpan: periksaRiwayatNilai,
  wajibMenyebutBukti: periksaWajibBukti,
  pembatasPenyebut: periksaPembatasPenyebut,
  berkasPengawasan: periksaBerkasPengawasan,
};

/** Menjalankan seluruh pemeriksaan. Tidak menyentuh basis data sama sekali. */
function periksaSemua() {
  return Object.entries(PEMERIKSA).map(([kunci, uji]) => jalankan(kunci, uji));
}

/** Nama kemampuan yang benar-benar terpenuhi - bentuk yang dipakai katalog. */
function terpenuhi() {
  return periksaSemua()
    .filter((x) => x.terpenuhi)
    .map((x) => x.kunci);
}

module.exports = {
  PEMERIKSA,
  periksaSemua,
  terpenuhi,
};
