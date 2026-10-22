"use strict";

/**
 * Kepatutan panggilan: saluran yang benar, tenggang yang cukup, dan penerimaan.
 *
 * ============================================================================
 * TIGA JALUR, TIGA ATURAN
 * ============================================================================
 *
 * PERKARA e-COURT - SK KMA 363/KMA/SK/XII/2022 Bab III Bagian B:
 *
 *   angka 7 huruf d - panggilan ELEKTRONIK harus dikirim kepada para pihak
 *                     paling lambat 3 (tiga) Hari sebelum jadwal sidang.
 *
 *   angka 8 huruf c - panggilan lewat SURAT TERCATAT harus dikirim kepada
 *                     tergugat paling lambat 6 (enam) Hari sebelum hari sidang
 *                     DAN diterima di alamat tergugat berdasarkan lacak
 *                     kiriman.
 *
 * PERKARA BIASA - Pasal 122 HIR: jarak antara pemanggilan dan hari sidang
 * tidak boleh kurang dari tiga hari KERJA, berlaku untuk seluruh pihak.
 *
 * "Hari" berhuruf besar pada SK KMA adalah hari KALENDER. Pasal 122 HIR
 * menghitung hari KERJA. Keduanya berbeda, dan menyamakannya menggeser
 * hitungan berhari-hari.
 *
 * ============================================================================
 * SALURAN DITENTUKAN KEDUDUKAN DAN PERSETUJUAN
 * ============================================================================
 *
 * Pada perkara e-Court:
 *
 *   Penggugat/Pemohon - SELALU elektronik. Tidak ada pilihan surat tercatat:
 *                       ia sendiri yang mendaftarkan perkaranya lewat e-Court
 *                       dan sudah punya domisili elektronik sejak awal.
 *
 *   Tergugat/Termohon - elektronik bila MENYETUJUI saluran elektronik; bila
 *                       menolak atau belum menjawab, surat tercatat.
 *
 * Pada perkara biasa, seluruh pihak dipanggil jurusita seperti biasa.
 *
 * ============================================================================
 * SURAT TERCATAT MENUNTUT DUA HAL, BUKAN SATU
 * ============================================================================
 *
 * Dikirim tepat waktu saja belum cukup. Angka 8 huruf c menuntut suratnya
 * DITERIMA di alamat tergugat, dibuktikan lacak kiriman. Surat yang dikirim
 * sepuluh hari sebelum sidang tetapi belum sampai belum memenuhi syarat.
 *
 * Karena itu jalur ini punya tiga keadaan, bukan dua: belum dikirim, terkirim
 * tetapi penerimaan belum terbukti, dan diterima.
 *
 * ============================================================================
 * PENILAIAN INI ALAT BANTU
 * ============================================================================
 *
 * Sah tidaknya panggilan ditetapkan majelis. Yang dikerjakan berkas ini hanya
 * menghitung jarak hari dan membandingkannya dengan ambang yang tertulis di
 * aturan - lalu menyebutkan dasarnya supaya dapat diperiksa ulang.
 */

const { readRuntimeConfig, writeRuntimeConfig } = require("../config/runtime-config");
const logService = require("./logService");
// Kepatutan satu relaas (SEMA 1/2023 & Pasal 718 RBg) - berkas murni, tidak melingkar.
const { nilaiRelaas } = require("./kepatutanRelaas");

/**
 * Ambang bawaan beserta dasar hukum dan cara hitungnya.
 *
 * Cara hitung TIDAK dapat diubah dari layar: ia melekat pada dasar hukumnya
 * masing-masing. Yang dapat disesuaikan hanya angkanya, untuk berjaga bila
 * aturannya berubah sebelum aplikasi ini diperbarui.
 */
const JALUR = {
  elektronik: {
    label: "Panggilan elektronik (e-Summons)",
    dasar: "SK KMA 363/KMA/SK/XII/2022 Bab III Bagian B angka 7 huruf d",
    bawaan: 3,
    hariKerja: false,
    perluDiterima: false,
  },
  surat_tercatat: {
    label: "Panggilan surat tercatat",
    // SEMA 1/2023 angka 11: DIKIRIM paling lambat 6 hari kalender sebelum
    // sidang DAN DITERIMA paling lambat 3 hari KERJA sebelum sidang. Ambang
    // terima tidak dapat disetel dari layar - ia melekat pada SEMA-nya.
    dasar: "SEMA 1/2023 angka 11; SK KMA 363/KMA/SK/XII/2022 Bab III Bagian B angka 8 huruf c",
    bawaan: 6,
    hariKerja: false,
    perluDiterima: true,
    terimaHari: 3,
    terimaHariKerja: true,
  },
  biasa: {
    label: "Panggilan biasa oleh jurusita (perkara non-e-Court)",
    // PA Donggala memakai RBg; Pasal 146 RBg sepadan dengan Pasal 122 HIR.
    dasar: "Pasal 146 RBg (Pasal 122 HIR)",
    bawaan: 3,
    hariKerja: true,
    perluDiterima: false,
  },
};

const BAWAAN = {
  hariElektronik: JALUR.elektronik.bawaan,
  hariSuratTercatat: JALUR.surat_tercatat.bawaan,
  hariBiasa: JALUR.biasa.bawaan,
};

function angka(nilai, bawaan, min, maks) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return bawaan;
  return Math.min(Math.max(Math.floor(n), min), maks);
}

function getSettings() {
  const tersimpan = (readRuntimeConfig() || {}).ecourtPanggilan || {};
  return {
    hariElektronik: angka(tersimpan.hariElektronik, BAWAAN.hariElektronik, 0, 60),
    hariSuratTercatat: angka(tersimpan.hariSuratTercatat, BAWAAN.hariSuratTercatat, 0, 60),
    hariBiasa: angka(tersimpan.hariBiasa, BAWAAN.hariBiasa, 0, 60),
  };
}

function saveSettings({ hariElektronik, hariSuratTercatat, hariBiasa, olehSiapa = "" }) {
  const isi = {
    hariElektronik: angka(hariElektronik, BAWAAN.hariElektronik, 0, 60),
    hariSuratTercatat: angka(hariSuratTercatat, BAWAAN.hariSuratTercatat, 0, 60),
    hariBiasa: angka(hariBiasa, BAWAAN.hariBiasa, 0, 60),
  };

  const sekarang = readRuntimeConfig();
  writeRuntimeConfig({ ...sekarang, ecourtPanggilan: isi });

  void logService.logSecurityEvent({
    eventType: "ecourt_panggilan_pengaturan_disunting",
    severity: "warning",
    message: "Tenggang waktu kepatutan panggilan diubah.",
    metadata: { ...isi, olehSiapa: String(olehSiapa || "") },
  });

  return { ok: true, alasan: "", pengaturan: isi };
}

/** Ambang yang berlaku untuk satu jalur, beserta keterangannya. */
/**
 * ============================================================================
 * DUA KOSAKATA JALUR YANG BERBEDA, DAN SALAH SATUNYA DIAM-DIAM JATUH KE BIASA
 * ============================================================================
 *
 * bacaRelaas() memulangkan jalur menurut sandi relaas:
 *     "langsung" | "pos" | "elektronik" | "pengumuman"
 *
 * ambangJalur() hanya mengenal kunci ATURAN:
 *     "biasa" | "surat_tercatat" | "elektronik"
 *
 * Yang tidak dikenali jatuh ke JALUR.biasa TANPA BERBUNYI. Akibatnya
 * "pos" - surat tercatat - dinilai dengan Pasal 122 HIR (3 hari KERJA,
 * penerimaan tidak perlu dibuktikan) alih-alih SK KMA 363 (6 hari kalender
 * DAN wajib terbukti diterima). Diukur di sipp_donggala: sandi S dipakai pada
 * 3.104 dari 14.495 relaas (21%), seluruhnya ber-nomor resi.
 *
 * Terjemahannya sudah ada dan benar di susunKeadaanPanggilan, tetapi terkubur
 * di dalam satu ungkapan bersyarat. Di sini ia berdiri sendiri supaya tidak
 * ada pemanggil baru yang lupa memakainya.
 */
const JALUR_ATURAN = {
  pos: "surat_tercatat",
  elektronik: "elektronik",
  pengumuman: "pengumuman",
  langsung: "biasa",
};

function jalurAturan(jalurRelaas) {
  const kunci = String(jalurRelaas || "").trim().toLowerCase();
  if (!kunci) return "biasa";
  // Kunci aturan yang memang sudah benar dibiarkan apa adanya.
  if (JALUR[kunci]) return kunci;
  return JALUR_ATURAN[kunci] || "biasa";
}

function ambangJalur(jalur) {
  const pengaturan = getSettings();
  const acuan = JALUR[jalur] || JALUR.biasa;
  const hari =
    jalur === "elektronik"
      ? pengaturan.hariElektronik
      : jalur === "surat_tercatat"
        ? pengaturan.hariSuratTercatat
        : pengaturan.hariBiasa;

  return {
    jalur: JALUR[jalur] ? jalur : "biasa",
    label: acuan.label,
    dasar: acuan.dasar,
    hari,
    hariKerja: acuan.hariKerja,
    perluDiterima: acuan.perluDiterima,
    // Hanya surat tercatat: ambang hari antara DITERIMA dan sidang (SEMA 1/2023 angka 11).
    terimaHari: acuan.terimaHari === undefined ? null : acuan.terimaHari,
    terimaHariKerja: Boolean(acuan.terimaHariKerja),
  };
}

/**
 * Tanggal murni (tanpa jam), atau null.
 *
 * Teks YYYY-MM-DD diurai komponen per komponen. new Date("2026-08-26") dibaca
 * sebagai tengah malam UTC, yang pada zona waktu bernilai negatif jatuh ke
 * tanggal sebelumnya - dan tanggal sidang yang meleset sehari menggeser seluruh
 * hitungan.
 */
function tanggalSaja(nilai) {
  if (!nilai) return null;

  if (typeof nilai === "string") {
    const cocok = nilai.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (cocok) return new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]));
  }

  const waktu = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(waktu.getTime())) return null;
  return new Date(waktu.getFullYear(), waktu.getMonth(), waktu.getDate());
}

/** Bentuk YYYY-MM-DD dari waktu setempat - aman diserialkan ke JSON. */
function teksTanggal(nilai) {
  const waktu = tanggalSaja(nilai);
  if (!waktu) return null;
  const bulan = String(waktu.getMonth() + 1).padStart(2, "0");
  const hari = String(waktu.getDate()).padStart(2, "0");
  return `${waktu.getFullYear()}-${bulan}-${hari}`;
}

/**
 * Selisih hari antara dua tanggal.
 *
 * Hari kerja: Sabtu dan Minggu tidak dihitung. Hari pertama tidak ikut -
 * yang dihitung adalah hari-hari SETELAH panggilan dan SEBELUM sidang.
 */
function selisihHari(dari, sampai, { hariKerja = false } = {}) {
  const awal = tanggalSaja(dari);
  const akhir = tanggalSaja(sampai);
  if (!awal || !akhir) return null;

  const arah = akhir >= awal ? 1 : -1;
  let jumlah = 0;
  const jalan = new Date(awal);

  while (jalan.getTime() !== akhir.getTime()) {
    jalan.setDate(jalan.getDate() + arah);
    const hari = jalan.getDay();
    if (hariKerja && (hari === 0 || hari === 6)) continue;
    jumlah += arah;
  }

  return jumlah;
}

/**
 * Jalur panggilan yang SEHARUSNYA dipakai untuk satu pihak.
 *
 * @param {{ peran?: string, persetujuan?: string, lewatEcourt?: boolean }} pihak
 */
function jalurSeharusnya({ peran = "", persetujuan = "belum", lewatEcourt = false } = {}) {
  // Perkara biasa: tidak ada jalur elektronik sama sekali.
  if (!lewatEcourt) return "biasa";

  // Penggugat/pemohon pada perkara e-Court selalu elektronik - lihat catatan
  // di kepala berkas.
  if (/penggugat|pemohon/i.test(String(peran))) return "elektronik";

  return String(persetujuan) === "setuju" ? "elektronik" : "surat_tercatat";
}

/**
 * Menilai kepatutan satu panggilan.
 *
 * @param {{
 *   tanggalPanggilan: any, tanggalSidang: any, jalur: string,
 *   diterima?: boolean|null, tanggalDiterima?: any,
 * }} opsi
 *
 * ============================================================================
 * SURAT TERCATAT DIHITUNG DARI TANGGAL DITERIMA, BUKAN TANGGAL DIKIRIM
 * ============================================================================
 *
 * Sampai 1.205.11 tenggang surat tercatat diukur dari tanggal surat
 * diserahkan ke kantor pos. Perkara 632/Pdt.G/2026/PA.Dgl: dikirim pos
 * 9 Oktober, relaasnya (tanggal diterima) 19 Oktober = hari sidang, tetapi
 * dinilai "patut 10 hari". Panggilan yang baru sampai pada hari sidang tidak
 * patut (keputusan hakim pengguna, 19 Oktober 2026). Bila tanggal diterima
 * diketahui, tenggangnya diukur dari tanggal itu; tanggal kirim tetap
 * dilaporkan sebagai selisihKirim.
 */
function nilaiKepatutan({ tanggalPanggilan, tanggalSidang, jalur = "biasa", diterima = null, tanggalDiterima = null } = {}) {
  const ambang = ambangJalur(jalur);

  const dasar = {
    ambang: ambang.hari,
    hariKerja: ambang.hariKerja,
    dasarHukum: ambang.dasar,
    jalur: ambang.jalur,
    perluDiterima: ambang.perluDiterima,
  };

  if (!tanggalPanggilan) {
    return { ...dasar, dinilai: false, patut: null, selisih: null, alasan: "belum_dikirim" };
  }
  if (!tanggalSidang) {
    return { ...dasar, dinilai: false, patut: null, selisih: null, alasan: "tanggal_sidang_tidak_diketahui" };
  }

  const selisih = selisihHari(tanggalPanggilan, tanggalSidang, { hariKerja: ambang.hariKerja });
  if (selisih === null) {
    return { ...dasar, dinilai: false, patut: null, selisih: null, alasan: "tanggal_tidak_terbaca" };
  }

  if (selisih < 0) {
    return { ...dasar, dinilai: true, patut: false, selisih, alasan: "dikirim_setelah_hari_sidang" };
  }

  const tepatWaktu = selisih >= ambang.hari;

  if (!tepatWaktu) {
    return { ...dasar, dinilai: true, patut: false, selisih, alasan: "tenggang_kurang_dari_ambang" };
  }

  // Surat tercatat yang tanggal diterimanya diketahui: tenggang sungguhan
  // adalah jarak dari tanggal diterima ke hari sidang.
  //
  // SEMA 1/2023 angka 11 (W58, 22 Okt 2026): yang diterima diukur dengan
  // HARI KERJA dan ambangnya 3 - bukan 6 hari kalender seperti ambang kirim.
  // Sampai 1.205.34 tanggal terima diukur dengan ambang kirim, sehingga surat
  // yang dikirim 7 hari sebelum sidang dan diterima 5 hari kalender (3 hari
  // kerja) sebelumnya dinilai tidak patut padahal memenuhi SEMA.
  if (ambang.perluDiterima && diterima === true && tanggalDiterima) {
    const ambangTerima = ambang.terimaHari === null || ambang.terimaHari === undefined ? ambang.hari : ambang.terimaHari;
    const terimaHariKerja = ambang.terimaHari === null || ambang.terimaHari === undefined ? ambang.hariKerja : ambang.terimaHariKerja;
    const selisihTerima = selisihHari(tanggalDiterima, tanggalSidang, { hariKerja: terimaHariKerja });
    if (selisihTerima !== null) {
      const tambahan = {
        selisihKirim: selisih,
        tanggalDiterima: teksTanggal(tanggalDiterima),
        ambangTerima,
        terimaHariKerja,
      };
      if (selisihTerima < 0) {
        return { ...dasar, ...tambahan, dinilai: true, patut: false, selisih: selisihTerima, alasan: "diterima_setelah_hari_sidang" };
      }
      if (selisihTerima < ambangTerima) {
        return { ...dasar, ...tambahan, dinilai: true, patut: false, selisih: selisihTerima, alasan: "diterima_kurang_dari_ambang" };
      }
      return { ...dasar, ...tambahan, dinilai: true, patut: true, selisih: selisihTerima, alasan: "" };
    }
  }

  // Tenggangnya cukup. Untuk surat tercatat masih ada syarat kedua.
  if (ambang.perluDiterima && diterima !== true) {
    // BUKAN "tidak patut": tenggangnya sudah benar, yang belum adalah
    // buktinya. Menyamakannya dengan panggilan yang terlambat akan mengaburkan
    // tindak lanjutnya - yang satu perlu dipanggil ulang, yang lain cukup
    // ditelusuri kirimannya.
    return {
      ...dasar,
      dinilai: true,
      patut: null,
      selisih,
      alasan: diterima === false ? "belum_diterima" : "penerimaan_belum_terbukti",
    };
  }

  return { ...dasar, dinilai: true, patut: true, selisih, alasan: "" };
}

function normalkanNama(nilai) {
  return String(nilai || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Membaca keadaan pengiriman dari satu baris relaas SIPP.
 *
 * Untuk surat tercatat, "dikirim" adalah tanggal surat diserahkan ke kantor
 * pos - bukan tanggal pelaksanaan relaas, yang justru tanggal DITERIMANYA.
 * Memakai tanggal pelaksanaan untuk menghitung tenggang akan membuat surat
 * yang lama di jalan tampak dikirim terlambat.
 */
/**
 * ============================================================================
 * SALURANNYA DITENTUKAN SANDI ket_temu, BUKAN ADA-TIDAKNYA RESI POS
 * ============================================================================
 *
 * Sampai 2.32.0 saluran ditebak begini: ada resi pos berarti surat tercatat,
 * tidak ada resi berarti - pada perkara e-Court - panggilan elektronik.
 * Tebakan itu salah pada 69% baris yang mungkin kena label "Elektronik
 * (e-Summons)".
 *
 * Diukur pada 14.495 baris relaas satker, dikelompokkan menurut ket_temu:
 *
 *     sandi  jumlah  resi terisi
 *     Y       5.084       0        bertemu langsung
 *     E       3.532       0        panggilan elektronik
 *     S       3.104   3.104        surat tercatat POS
 *     T       2.667       0        tidak bertemu
 *     R/W/N/P/M  89        0        pengumuman, radio, tidak terlaksana
 *
 * Yang tidak berresi DAN bukan 'E' berjumlah 7.839 baris - termasuk 5.084
 * relaas yang jurusitanya BERTEMU LANGSUNG dengan orangnya. Seluruhnya dulu
 * dapat dilabeli "dipanggil lewat Elektronik (e-Summons)" pada perkara
 * e-Court. Itulah kalimat yang dikeluhkan pengguna.
 *
 * ============================================================================
 * YANG LEBIH BERAT: PANGGILAN GAGAL DIHITUNG SAMPAI
 * ============================================================================
 *
 * 'T' (tidak bertemu, 2.667 baris) dan 'N' (tidak dapat dilaksanakan, 14)
 * TETAP punya tanggal_relaas - jurusita mencatat pelaksanaannya walau tidak
 * bertemu siapa pun. Aturan lama memulangkan diterima:true untuk keduanya,
 * dengan bukti "relaas jurusita".
 *
 * 2.681 panggilan yang justru GAGAL karena itu terbaca sebagai sampai - dan
 * di atas angka itulah kepatutan panggilan dinilai. Sidang yang berjalan atas
 * dasar panggilan yang tidak pernah sampai adalah kerugian pada perkara
 * orang, bukan kerugian tampilan.
 *
 * Sandi yang KOSONG atau tidak dikenali tidak ditebak ke mana pun: jalurnya
 * dipulangkan "" dan penilaiannya diserahkan pada jejak lain. Lebih baik diam
 * daripada menuduh.
 */
const JALUR_SANDI = {
  Y: "langsung",
  T: "langsung",
  N: "langsung",
  E: "elektronik",
  S: "pos",
  R: "pengumuman",
  W: "pengumuman",
  P: "pengumuman",
  M: "pengumuman",
};

/** Sandi yang menyatakan panggilannya TIDAK sampai. */
const SANDI_GAGAL = new Set(["T", "N"]);

function bacaRelaas(relaas) {
  if (!relaas) return { jalur: "", tanggalKirim: null, diterima: null, bukti: "" };

  // Sandi dibaca dari caraRelaas bila ada - itulah yang disiapkan
  // sippJadwalSidangService - dan dari ketTemu mentah sebagai cadangan.
  const sandi = String(
    (relaas.caraRelaas && relaas.caraRelaas.sandi) || relaas.ketTemu || ""
  )
    .trim()
    .toUpperCase();
  const jalurSandi = JALUR_SANDI[sandi] || "";

  // Kepatutan bersama (kepatutanRelaas.js): SEMA 1/2023 untuk surat tercatat,
  // Pasal 718 RBg untuk jurusita. Keterangan hasil dibaca dari ketHasilRelaas.
  const kepatutan = nilaiRelaas({
    ketTemu: sandi,
    statusPos: relaas.statusPos,
    hasil: relaas.ketHasilRelaas !== undefined ? relaas.ketHasilRelaas : relaas.hasil,
    noResiPos: relaas.noResiPos,
    tanggalKirimPos: relaas.tanggalKirimPos,
    namaPihak: relaas.namaPihak,
    pihakKe: relaas.pihakKe,
  });

  // ==========================================================================
  // "TIDAK BERTEMU" YANG DITERUSKAN KE KEPALA DESA ADALAH PANGGILAN YANG SAMPAI
  // ==========================================================================
  //
  // Pasal 718 ayat (1) RBg: bila pihak tidak dijumpai, relaas disampaikan
  // melalui kepala desa/lurah yang wajib meneruskannya - panggilannya sah.
  // Diukur 22 Okt atas 2.668 relaas bersandi T: 1.398 keterangannya menyebut
  // penyampaian melalui kepala desa/lurah/aparat. Sisanya tetap tidak sampai.
  if (sandi === "T" && kepatutan.kunci === "kepala_desa") {
    return {
      jalur: "langsung",
      sandi,
      tanggalKirim: relaas.tanggalRelaas || null,
      diterima: relaas.tanggalRelaas ? true : null,
      bukti: "relaas: melalui kepala desa",
      kepatutan,
    };
  }

  // Panggilan yang sandinya menyatakan GAGAL tidak pernah dihitung sampai,
  // walau jurusita mencatat tanggal pelaksanaannya.
  if (SANDI_GAGAL.has(sandi)) {
    return {
      jalur: "langsung",
      sandi,
      tanggalKirim: relaas.tanggalRelaas || null,
      diterima: false,
      bukti: sandi === "N" ? "relaas: tidak dapat dilaksanakan" : "relaas: tidak bertemu",
      kepatutan,
    };
  }

  const lewatPos = jalurSandi === "pos" || Boolean(relaas.noResiPos) || Boolean(relaas.tanggalKirimPos);

  if (!lewatPos) {
    // Relaas tanpa jejak pos: dilaksanakan langsung atau lewat saluran
    // elektronik. Sandinya yang menentukan yang mana - bukan ada tidaknya
    // pendaftaran e-Court, yang hanya menyatakan pihaknya BOLEH dipanggil
    // elektronik, bukan bahwa panggilan INI ditempuh begitu.
    return {
      jalur: jalurSandi || "langsung",
      sandi,
      tanggalKirim: relaas.tanggalRelaas || null,
      diterima: relaas.tanggalRelaas ? true : null,
      bukti: relaas.tanggalRelaas ? "relaas jurusita" : "",
      kepatutan,
    };
  }

  const statusBerhasil = Number(relaas.statusPos) === 1;
  const adaPelaksanaan = Boolean(relaas.tanggalRelaas);

  // SEMA 1/2023: surat yang dikembalikan (retur) atau keterangannya huruf
  // b/e/f/g TIDAK diterima, walau tanggal pelaksanaannya terisi - tanggal itu
  // tanggal kembalinya surat, bukan tanggal diterima pihak.
  const gagalPos = kepatutan.retur || kepatutan.sah === false;

  return {
    jalur: "pos",
    sandi,
    kepatutan,
    tanggalKirim: relaas.tanggalKirimPos || relaas.tanggalRelaas || null,
    // Diterima bila lacak kiriman berhasil ATAU jurusita sudah mencatat
    // pelaksanaan relaasnya - keduanya bukti penerimaan yang sah.
    diterima: gagalPos ? false : statusBerhasil || adaPelaksanaan ? true : relaas.statusPos === null ? null : false,
    // Tanggal relaas surat tercatat adalah tanggal DITERIMANYA (lihat di
    // atas). Lacak kiriman tanpa relaas tidak membawa tanggal terima.
    tanggalDiterima: adaPelaksanaan && !gagalPos ? relaas.tanggalRelaas : null,
    bukti: gagalPos ? `relaas: ${kepatutan.label.toLowerCase()}` : statusBerhasil ? "lacak kiriman" : adaPelaksanaan ? "relaas jurusita" : "",
  };
}

/**
 * Menyusun keadaan panggilan tiap pihak untuk satu sidang.
 *
 * Menggabungkan tiga sumber: persetujuan dan e-Summons dari e-Court, relaas
 * dari SIPP. Nama menjadi penghubungnya - dicocokkan longgar, karena beda
 * spasi dan huruf besar-kecil tidak boleh membuat satu pihak tampak dua.
 */
/**
 * Sisi pihak menurut kedudukannya: 1 penggugat/pemohon, 2 tergugat/termohon.
 *
 * Kedudukan datang sebagai teks bebas dari dua sumber yang menuliskannya
 * berbeda-beda, jadi yang dicocokkan katanya - bukan kalimat utuhnya. Yang
 * tidak dikenali menghasilkan 0, dan sisi 0 TIDAK PERNAH dikecualikan dari
 * kewajiban dipanggil: menebak kedudukan lalu membebaskannya dari panggilan
 * adalah cara paling sunyi membuat pihak benar-benar tidak terpanggil.
 */
function sisiPihak(peran) {
  const teks = String(peran || "").toLowerCase();
  if (/penggugat|pemohon/.test(teks)) return 1;
  if (/tergugat|termohon/.test(teks)) return 2;
  return 0;
}

function susunKeadaanPanggilan({
  persetujuan = [],
  panggilan = [],
  relaas = [],
  tanggalSidang = null,
  lewatEcourt = false,
  // Sisi yang wajib dipanggil pada sidang ini, dari kehadiran sidang
  // SEBELUMNYA. null berarti tidak diketahui - dan yang tidak diketahui
  // tidak membebaskan siapa pun. Lihat catatan pada penandaan di bawah.
  sisiWajib = null,
  // Sidang yang dinilai. Relaas SIPP membawa sidang_id-nya sendiri; tanpa
  // nomor ini yang dipakai tanggal sidangnya.
  sidangId = null,
} = {}) {
  const tanggalIni = teksTanggal(tanggalSidang);
  const idSidangIni = sidangId ? String(sidangId) : "";

  // ======================================================================
  // HANYA PANGGILAN UNTUK SIDANG INI
  // ======================================================================
  //
  // rincianSidang sengaja memulangkan SELURUH relaas perkara - riwayatnya
  // dibaca layar. Dulu seluruhnya dipetakan per nama dan yang terakhir
  // menang, sehingga relaas sidang LAIN dinilai untuk sidang ini:
  //
  //   - sidang lama dibuka: relaas sidang sesudahnya yang terpakai, lalu
  //     dinilai "dikirim setelah sidang";
  //   - sidang ini belum ada relaasnya: relaas sidang sebelumnya terpakai
  //     dan dinilai "terkirim, patut". Diukur di sipp_donggala, perkara
  //     e-Court Jan 2025 - Sep 2026: 1.372 sidang lanjutan yang tergugatnya
  //     wajib dipanggil; 115 di antaranya tanpa relaas tergugat untuk sidang
  //     itu tetapi punya relaas lama - seluruhnya tampil sudah dipanggil.
  //
  // Daftar jadwal (keadaanPanggilanSidang) sejak awal menyaring per
  // sidang_id; panel rincian kini menjawab hal yang sama.
  //
  // sidang_id pada relaas adalah sidang YANG DIPANGGIL: 14.462 dari 14.462
  // relaas bertanggal jatuh pada atau sebelum tanggal sidangnya. Baris tanpa
  // keterangan sidang sama sekali tidak dapat dipastikan untuk sidang mana
  // dan diikutkan seperti semula (di SIPP satker: nol baris).
  const untukSidangIni = (item) => {
    // Sidang yang dinilai TIDAK diketahui sama sekali (jadwalnya gagal
    // dibaca, atau pemanggil lama): tidak ada yang dapat disaring, dan
    // seluruh relaas dipakai seperti sebelum penyaringan ini ada. Membuang
    // seluruhnya membuat tiap pihak tampil "belum dipanggil" - tuduhan yang
    // lahir dari ketidaktahuan (tinjauan 24 September 2026).
    if (!idSidangIni && !tanggalIni) return true;
    const idItem = item && item.sidangId ? String(item.sidangId) : "";
    const tanggalItem = item ? teksTanggal(item.tanggalSidang) : null;
    if (idSidangIni && idItem) return idItem === idSidangIni;
    if (tanggalIni && tanggalItem) return tanggalItem === tanggalIni;
    return !idItem && !tanggalItem;
  };

  // ======================================================================
  // e-SUMMONS SIDANG LAIN BUKAN PANGGILAN SIDANG INI
  // ======================================================================
  //
  // Tanggal sidang dari aleta_bot_ecourt_panggilan tiba sebagai Date, bukan
  // teks. String(Date) dipotong sepuluh huruf berbunyi "Wed Sep 23" dan TIDAK
  // PERNAH sama dengan "2026-09-23" - pencocokan lama selalu gagal, lalu yang
  // tersimpan e-Summons PERTAMA pihak itu, yaitu yang paling lama.
  const petaPanggilan = new Map();
  for (const item of panggilan) {
    const kunci = normalkanNama(item.namaPihak);
    if (!kunci) continue;
    const tanggalItem = teksTanggal(item.tanggalSidang);
    if (tanggalIni && tanggalItem && tanggalItem !== tanggalIni) continue;
    petaPanggilan.set(kunci, item);
  }

  const petaRelaas = new Map();
  for (const item of relaas) {
    const kunci = normalkanNama(item.namaPihak);
    if (!kunci) continue;
    if (!untukSidangIni(item)) continue;
    petaRelaas.set(kunci, item);
  }

  // ======================================================================
  // DAFTAR PIHAK DIGABUNG DARI KEDUA SUMBER
  // ======================================================================
  //
  // SIPP memegang KEDUDUKAN pihak - penggugat/pemohon atau tergugat/termohon.
  // e-Court memegang PERSETUJUAN salurannya. Keduanya diperlukan: kedudukan
  // menentukan jalur bagi penggugat/pemohon, persetujuan menentukan jalur bagi
  // tergugat.
  //
  // Sebelumnya hanya salah satu yang dipakai, dan akibatnya nyata: perkara
  // yang belum pernah ditarik dari e-Court tidak punya kedudukan pihak sama
  // sekali, sehingga PEMOHON terbaca seolah harus dipanggil lewat surat
  // tercatat - lalu panggilan elektroniknya yang sudah benar ditandai salah
  // saluran.
  const petaPihak = new Map();

  const catatPihak = (nama, isian) => {
    const kunci = normalkanNama(nama);
    if (!kunci) return;
    const sudah = petaPihak.get(kunci) || {
      nama,
      peran: "",
      persetujuan: "belum",
      email: "",
      terbacaEcourt: false,
    };
    petaPihak.set(kunci, {
      nama: sudah.nama || nama,
      // Kedudukan dari mana pun yang menyebutkannya lebih dulu; keduanya
      // menyebut hal yang sama.
      peran: sudah.peran || isian.peran || "",
      persetujuan: isian.persetujuan || sudah.persetujuan || "belum",
      // Email dari tabel persetujuan e-Court - domisili elektronik pihak.
      // Kosong DI SANA berarti e-Summons mustahil terkirim kepadanya.
      email: sudah.email || String(isian.email || "").trim(),
      // Pihak ini terbaca di tabel persetujuan e-Court. Tanpa itu, "tanpa
      // email" hanya berarti "belum ditarik", bukan "tidak punya".
      terbacaEcourt: sudah.terbacaEcourt || isian.terbacaEcourt === true,
    });
  };

  // Daftar pihak tetap dibangun dari SELURUH relaas perkara - kedudukan pihak
  // dibaca dari sana. Yang disaring per sidang hanya jejak panggilannya.
  for (const item of relaas) {
    catatPihak(item.namaPihak, { peran: item.peran || "" });
  }
  for (const item of persetujuan) {
    catatPihak(item.nama, {
      peran: item.peran || "",
      persetujuan: item.persetujuan,
      email: item.email || "",
      terbacaEcourt: true,
    });
  }

  const daftarPihak = [...petaPihak.values()];

  const hasil = [];

  for (const pihak of daftarPihak) {
    const kunci = normalkanNama(pihak.nama);
    const seharusnya = jalurSeharusnya({
      peran: pihak.peran,
      persetujuan: pihak.persetujuan,
      lewatEcourt,
    });

    const panggilanElektronik = petaPanggilan.get(kunci) || null;
    const relaasJurusita = petaRelaas.get(kunci) || null;
    const jejakRelaas = bacaRelaas(relaasJurusita);

    let terlaksana = "";
    let tanggalPanggilan = null;
    let diterima = null;
    let buktiPenerimaan = "";
    let tanggalDiterima = null;

    if (jejakRelaas.tanggalKirim) {
      // ==================================================================
      // SANDINYA YANG MENENTUKAN, BUKAN PENDAFTARAN e-COURT-NYA
      // ==================================================================
      //
      // Aturan lama: tanpa jejak pos, perkara e-Court dilabeli "elektronik".
      // Itu menyamakan dua hal yang berbeda - pihak yang TERDAFTAR e-Court
      // (boleh dipanggil elektronik) dengan panggilan yang MEMANG ditempuh
      // secara elektronik. Terukur salah pada 7.839 baris, termasuk 5.084
      // relaas yang jurusitanya bertemu langsung dengan orangnya.
      //
      // Sandi kosong atau asing tanpa jejak pos tidak ditebak ke mana pun (19
      // baris ket_temu kosong di SIPP satker) - terlaksana dikosongkan, persis
      // janji di kepala JALUR_SANDI.
      //
      // Dulu bacaRelaas memulangkan jalur "langsung" untuk sandi kosong, lalu
      // di sini terbaca "biasa", lalu penggugat e-Court tertuduh salah
      // saluran. Cabang tebakan pendaftaran e-Court di ujung ungkapan lama
      // karena itu kode mati - komentarnya berjanji "tidak ditebak", kodenya
      // menebak "biasa". Jalur pos tetap dikenali dari resi atau tanggal pos
      // walau sandinya kosong: itu jejak nyata, bukan tebakan.
      const sandiDikenal = Boolean(JALUR_SANDI[jejakRelaas.sandi]);
      terlaksana =
        jejakRelaas.jalur === "pos"
          ? "surat_tercatat"
          : !sandiDikenal
            ? ""
            : jejakRelaas.jalur === "elektronik"
              ? "elektronik"
              : jejakRelaas.jalur === "pengumuman"
                ? "pengumuman"
                : "biasa";
      tanggalPanggilan = jejakRelaas.tanggalKirim;
      diterima = jejakRelaas.diterima;
      tanggalDiterima = jejakRelaas.tanggalDiterima || null;
      buktiPenerimaan = jejakRelaas.bukti;
    }

    // ====================================================================
    // SIPP DIDAHULUKAN, e-COURT HANYA MELENGKAPI
    // ====================================================================
    //
    // Relaas SIPP adalah catatan resmi pengadilan atas pelaksanaan panggilan,
    // ditandatangani jurusita. Catatan e-Court berguna ketika SIPP belum diisi
    // - tetapi ia TIDAK menimpa yang sudah dicatat jurusita.
    //
    // Sebelumnya urutannya terbalik, sehingga tanggal dari e-Court menggeser
    // tanggal relaas yang sudah benar.
    if (!tanggalPanggilan && panggilanElektronik && panggilanElektronik.dikirimPada) {
      terlaksana = "elektronik";
      tanggalPanggilan = panggilanElektronik.dikirimPada;
      // Panggilan elektronik tidak menuntut bukti penerimaan.
      diterima = true;
      buktiPenerimaan = "tercatat terkirim di e-Court";
    }

    // ====================================================================
    // SANDI 'E' DI SIPP BUKAN BUKTI e-SUMMONS TERKIRIM
    // ====================================================================
    //
    // ket_temu 'E' dipilih jurusita pada borang relaas SIPP; ia menyatakan apa
    // yang DICATAT, bukan apa yang dikirim e-Court. Yang membuktikan panggilan
    // elektronik sungguh terkirim adalah tabel e-Summons e-Court - dan
    // e-Summons mustahil terkirim kepada pihak yang tidak punya email di sana.
    //
    // Perkara 385/Pdt.G/2026/PA.Dgl: tergugat belum menjawab persetujuan,
    // tidak punya email di e-Court, dipanggil lewat surat tercatat - tetapi
    // relaasnya bersandi 'E'. Relaas 4 September-nya bahkan melampirkan
    // berkas resi pos (resi_19975_35524.pdf) di kolom relaas: satu-satunya
    // baris 'E' berlampiran resi dari 14.495 relaas satker. ALETA menuduhnya
    // "dipanggil lewat Elektronik (e-Summons)", penghambat BERAT.
    //
    // Penjagaan aslinya tetap: e-Summons yang TERCATAT terkirim di e-Court
    // kepada tergugat yang belum setuju tetap salah saluran. Yang dicabut
    // hanya tuduhan yang bersandar pada sandi SIPP saja. Salurannya juga tidak
    // ditebak menjadi surat tercatat - relaasnya tanpa resi - melainkan
    // dikosongkan dan diberi catatan supaya sandinya dibetulkan: tanpa sandi
    // S dan nomor resi, bukti lacak kiriman yang dituntut angka 8 huruf c
    // tidak pernah tercatat di SIPP.
    //
    // pihak.email di SIPP sengaja TIDAK dipakai: 22 relaas 'E' kepada tergugat
    // e-Court tahun 2026 pihaknya tanpa email di SIPP, dan 10 di antaranya
    // berketerangan "panggilan elektronik" - kolom itu tidak lengkap, bukan
    // bukti ketiadaan domisili elektronik.
    const eSummonsTerkirim = Boolean(panggilanElektronik && panggilanElektronik.dikirimPada);
    let catatanSaluran = "";
    if (
      terlaksana === "elektronik" &&
      jejakRelaas.sandi === "E" &&
      seharusnya !== "elektronik" &&
      !eSummonsTerkirim
    ) {
      terlaksana = "";
      // Perkara yang tidak terdaftar e-Court tidak punya apa pun untuk ditarik
      // dari sana - menyuruh menariknya adalah tindak lanjut yang tidak akan
      // pernah menjawab catatannya (sekitar 80 relaas 'E' pada perkara bukan
      // e-Court di SIPP satker, 2020-2024).
      catatanSaluran = !lewatEcourt
        ? "SIPP mencatat Panggilan Elektronik pada perkara yang tidak terdaftar lewat e-Court - periksa sandi relaasnya. Bila dikirim lewat pos, sandinya Surat Tercatat POS beserta nomor resinya; bila disampaikan jurusita, sandinya Bertemu atau Tidak Bertemu."
        : !pihak.terbacaEcourt
        ? "SIPP mencatat Panggilan Elektronik, tetapi persetujuan dan e-Summons pihak ini belum terbaca dari e-Court - tarik perkaranya dari Kendali Berkas untuk memastikan salurannya."
        : !pihak.email
          ? "SIPP mencatat Panggilan Elektronik, tetapi pihak ini tidak punya email di e-Court dan e-Court tidak mencatat e-Summons kepadanya - sandi relaas di SIPP kemungkinan keliru. Bila dikirim lewat pos, sandinya Surat Tercatat POS beserta nomor resinya."
          : "SIPP mencatat Panggilan Elektronik, tetapi e-Court tidak mencatat e-Summons kepada pihak ini untuk sidang ini - periksa sandi relaas di SIPP.";
    }

    tanggalPanggilan = teksTanggal(tanggalPanggilan);

    // ====================================================================
    // YANG HADIR SIDANG LALU TIDAK PERLU DIPANGGIL LAGI
    // ====================================================================
    //
    // Pihak yang hadir pada sidang sebelumnya sudah diberitahu hari sidang
    // berikutnya di ruang sidang. Menghitungnya "belum dipanggil" menyalakan
    // penghambat BERAT pada hampir seluruh sidang lanjutan - dan penghambat
    // yang selalu menyala berhenti dibaca, termasuk saat ia benar.
    //
    // Dibebaskan HANYA bila tiga-tiganya terpenuhi: daftar sisi wajibnya
    // memang diketahui, kedudukan pihaknya terbaca, dan sisinya tidak ada
    // pada daftar itu. Ragu sedikit saja - kedudukan tidak terbaca, daftar
    // tidak diketahui - pihaknya tetap dianggap wajib dipanggil.
    const sisi = sisiPihak(pihak.peran);
    const tidakPerluDipanggil =
      Array.isArray(sisiWajib) && sisi !== 0 && !sisiWajib.includes(sisi);

    const kepatutanDasar = nilaiKepatutan({
      tanggalPanggilan,
      tanggalSidang,
      // Dinilai menurut jalur yang SEHARUSNYA, bukan yang terlanjur dipakai.
      // Panggilan lewat jalur keliru tidak menjadi patut hanya karena jalur
      // kelirunya kebetulan berambang lebih longgar.
      jalur: seharusnya,
      diterima,
      tanggalDiterima,
    });

    // ====================================================================
    // PIHAK YANG TIDAK WAJIB DIPANGGIL TIDAK DINILAI KEPATUTANNYA
    // ====================================================================
    //
    // Sejak relaas dinilai per sidang (24 September 2026), pihak yang hadir
    // pada sidang sebelumnya lazimnya tidak punya relaas untuk sidang ini -
    // memang tidak ada yang perlu dikirim. Tanpa pembeda ini nilaiKepatutan
    // menjawab "belum_dikirim", layar menggambar lencana merah "belum dapat
    // dinilai" di samping "tidak perlu dipanggil", dan Status Perkara
    // menghitungnya tidak patut. Diukur di SIPP satker: 865 dari 1.129 sidang
    // lanjutan 2026 penggugatnya hadir di sidang sebelumnya dan tidak punya
    // relaas untuk sidang itu.
    //
    // Yang tetap dinilai: pihak tidak wajib yang TOH dipanggil - relaasnya
    // ada, dan kepatutannya fakta yang dapat diperiksa.
    const kepatutan =
      tidakPerluDipanggil && !tanggalPanggilan
        ? { ...kepatutanDasar, perluDiterima: false, alasan: "tidak_wajib_dipanggil" }
        : kepatutanDasar;

    const salahSaluran = Boolean(terlaksana) && terlaksana !== seharusnya;

    hasil.push({
      nama: pihak.nama,
      peran: pihak.peran,
      persetujuan: pihak.persetujuan,
      seharusnya,
      terlaksana,
      sudahDikirim: Boolean(tanggalPanggilan),
      tidakPerluDipanggil,
      belumDipanggil: !tanggalPanggilan && !tidakPerluDipanggil,
      salahSaluran,
      // Sandi relaas SIPP yang dinilai, dan apakah e-Court mencatat e-Summons
      // kepada pihak ini untuk sidang ini - supaya catatannya dapat ditelusuri.
      sandiRelaas: jejakRelaas.sandi || "",
      eSummonsTerkirim,
      terbacaEcourt: pihak.terbacaEcourt === true,
      catatanSaluran,
      tanggalPanggilan,
      diterima,
      buktiPenerimaan,
      noResiPos: relaasJurusita ? relaasJurusita.noResiPos || "" : "",
      tanggalPelaksanaanRelaas: relaasJurusita ? relaasJurusita.tanggalRelaas || null : null,
      kepatutan,
    });
  }

  const ringkasan = {
    jumlahPihak: hasil.length,
    belumDipanggil: hasil.filter((x) => x.belumDipanggil).length,
    // Disebut tersendiri supaya terlihat mengapa angkanya kecil - bukan
    // karena penilaiannya melonggar, melainkan karena pihaknya memang sudah
    // diberitahu di ruang sidang.
    tidakPerluDipanggil: hasil.filter((x) => x.tidakPerluDipanggil).length,
    salahSaluran: hasil.filter((x) => x.salahSaluran).length,
    // Sandi E tanpa e-Summons - bukan salah saluran, melainkan catatan SIPP
    // yang bertentangan dengan e-Court. Dihitung tersendiri, bukan disembunyikan.
    saluranBelumPasti: hasil.filter((x) => Boolean(x.catatanSaluran)).length,
    tidakPatut: hasil.filter((x) => x.kepatutan.patut === false).length,
    // Terkirim tepat waktu tetapi penerimaannya belum terbukti - berbeda dari
    // tidak patut, dan tindak lanjutnya pun berbeda.
    penerimaanBelumTerbukti: hasil.filter(
      (x) =>
        x.sudahDikirim &&
        x.kepatutan.patut === null &&
        /penerimaan_belum_terbukti|belum_diterima/.test(x.kepatutan.alasan)
    ).length,
    patut: hasil.filter((x) => x.kepatutan.patut === true).length,
  };

  return {
    pengaturan: getSettings(),
    jalur: JALUR,
    lewatEcourt,
    // Sidang yang dinilai - layar status perkara menyebutkannya.
    sidangId: idSidangIni || null,
    tanggalSidang: tanggalIni,
    pihak: hasil,
    ringkasan,
  };
}

module.exports = {
  BAWAAN,
  JALUR,
  ambangJalur,
  bacaRelaas,
  jalurAturan,
  getSettings,
  jalurSeharusnya,
  nilaiKepatutan,
  saveSettings,
  selisihHari,
  sisiPihak,
  susunKeadaanPanggilan,
  teksTanggal,
};
