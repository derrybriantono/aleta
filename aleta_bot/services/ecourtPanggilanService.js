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
    dasar: "SK KMA 363/KMA/SK/XII/2022 Bab III Bagian B angka 8 huruf c",
    bawaan: 6,
    hariKerja: false,
    perluDiterima: true,
  },
  biasa: {
    label: "Panggilan biasa oleh jurusita (perkara non-e-Court)",
    dasar: "Pasal 122 HIR",
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
 *   diterima?: boolean|null,
 * }} opsi
 */
function nilaiKepatutan({ tanggalPanggilan, tanggalSidang, jalur = "biasa", diterima = null } = {}) {
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
function bacaRelaas(relaas) {
  if (!relaas) return { jalur: "", tanggalKirim: null, diterima: null, bukti: "" };

  const lewatPos = Boolean(relaas.noResiPos) || Boolean(relaas.tanggalKirimPos);

  if (!lewatPos) {
    // Relaas tanpa jejak pos: dilaksanakan langsung atau lewat saluran
    // elektronik, dan tanggal pelaksanaannya adalah tanggal panggilannya.
    return {
      jalur: "langsung",
      tanggalKirim: relaas.tanggalRelaas || null,
      diterima: relaas.tanggalRelaas ? true : null,
      bukti: relaas.tanggalRelaas ? "relaas jurusita" : "",
    };
  }

  const statusBerhasil = Number(relaas.statusPos) === 1;
  const adaPelaksanaan = Boolean(relaas.tanggalRelaas);

  return {
    jalur: "pos",
    tanggalKirim: relaas.tanggalKirimPos || relaas.tanggalRelaas || null,
    // Diterima bila lacak kiriman berhasil ATAU jurusita sudah mencatat
    // pelaksanaan relaasnya - keduanya bukti penerimaan yang sah.
    diterima: statusBerhasil || adaPelaksanaan ? true : relaas.statusPos === null ? null : false,
    bukti: statusBerhasil ? "lacak kiriman" : adaPelaksanaan ? "relaas jurusita" : "",
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
} = {}) {
  const petaPanggilan = new Map();
  for (const item of panggilan) {
    const kunci = normalkanNama(item.namaPihak);
    if (!kunci) continue;
    const cocokSidang =
      tanggalSidang && item.tanggalSidang
        ? String(item.tanggalSidang).slice(0, 10) === String(tanggalSidang).slice(0, 10)
        : false;
    if (!petaPanggilan.has(kunci) || cocokSidang) petaPanggilan.set(kunci, item);
  }

  const petaRelaas = new Map();
  for (const item of relaas) {
    const kunci = normalkanNama(item.namaPihak);
    if (!kunci) continue;
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
    const sudah = petaPihak.get(kunci) || { nama, peran: "", persetujuan: "belum" };
    petaPihak.set(kunci, {
      nama: sudah.nama || nama,
      // Kedudukan dari mana pun yang menyebutkannya lebih dulu; keduanya
      // menyebut hal yang sama.
      peran: sudah.peran || isian.peran || "",
      persetujuan: isian.persetujuan || sudah.persetujuan || "belum",
    });
  };

  for (const item of relaas) {
    catatPihak(item.namaPihak, { peran: item.peran || "" });
  }
  for (const item of persetujuan) {
    catatPihak(item.nama, { peran: item.peran || "", persetujuan: item.persetujuan });
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

    if (jejakRelaas.tanggalKirim) {
      // Relaas tanpa jejak pos: pada perkara e-Court itu panggilan elektronik,
      // pada perkara biasa itu panggilan jurusita seperti biasa.
      terlaksana = jejakRelaas.jalur === "pos" ? "surat_tercatat" : lewatEcourt ? "elektronik" : "biasa";
      tanggalPanggilan = jejakRelaas.tanggalKirim;
      diterima = jejakRelaas.diterima;
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

    tanggalPanggilan = teksTanggal(tanggalPanggilan);

    const kepatutan = nilaiKepatutan({
      tanggalPanggilan,
      tanggalSidang,
      // Dinilai menurut jalur yang SEHARUSNYA, bukan yang terlanjur dipakai.
      // Panggilan lewat jalur keliru tidak menjadi patut hanya karena jalur
      // kelirunya kebetulan berambang lebih longgar.
      jalur: seharusnya,
      diterima,
    });

    const salahSaluran = Boolean(terlaksana) && terlaksana !== seharusnya;

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

  return { pengaturan: getSettings(), jalur: JALUR, lewatEcourt, pihak: hasil, ringkasan };
}

module.exports = {
  BAWAAN,
  JALUR,
  ambangJalur,
  bacaRelaas,
  getSettings,
  jalurSeharusnya,
  nilaiKepatutan,
  saveSettings,
  selisihHari,
  sisiPihak,
  susunKeadaanPanggilan,
  teksTanggal,
};
