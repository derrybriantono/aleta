"use strict";

/**
 * ============================================================================
 * PENILAIAN KETAATAN TAHAPAN - PINDAHAN DARI ANALISIS LAMA
 * ============================================================================
 *
 * Tahap 5 rencana berbunyi "tiga puluh satu analisis yang sekarang hidup
 * dipindahkan ke bentuk baku penilaian, satu per satu". Setelah ketiga puluh
 * satunya diperiksa, ternyata **sebagian besar bukan penilaian**.
 *
 * Penilaian menjawab "apakah tiap hal memenuhi aturannya" dan menghasilkan
 * angka yang punya jawaban benar. Analisis deskriptif menjawab "seperti apa
 * keadaannya" dan tidak punya jawaban benar - sebaran umur pihak, musim
 * perkara, corong perkara, profil upaya hukum. Memaksanya masuk kerangka
 * bernilai berarti mengarang skor atas hal yang tidak dapat benar atau salah,
 * lalu menuduh orang berdasarkan skor itu.
 *
 * Pemilahannya dicatat di scripts/verify-penilaian-ketaatan.js dan pada catatan
 * tahap kerja. Yang dipindahkan ke sini hanya yang memang berupa ketaatan.
 *
 * ============================================================================
 * KUERINYA DISUSUN DARI POLA YANG SUDAH TERBUKTI JALAN
 * ============================================================================
 *
 * Nama tabel dan kolom di bawah TIDAK dikarang. Seluruhnya diambil dari kueri
 * yang sudah berjalan di produksi pada analisaLanjutService dan
 * sippTahapanService - sebab kueri yang ditulis atas tabel yang dikira ada
 * baru gagal di server, sesudah dipasang.
 *
 * ============================================================================
 * SATU PERBEDAAN YANG DISENGAJA DENGAN ANALISIS LAMA
 * ============================================================================
 *
 * Analisis lama menghitung tenggang panggilan dengan DATEDIFF - hari KALENDER.
 * Ambang yang berlaku berbunyi tiga hari KERJA (Pasal 122 HIR). Relaas yang
 * disampaikan Jumat untuk sidang Senin berjarak tiga hari kalender dan lulus
 * menurut hitungan lama, padahal hanya SATU hari kerja - pihak yang menerimanya
 * praktis tidak punya kesempatan menyiapkan diri.
 *
 * Penilaian ini menghitung KEDUANYA. Yang menentukan lulus atau tidak adalah
 * hari kerja, sesuai ambang yang tertulis; hari kalender ikut disimpan pada
 * tiap baris supaya selisih dengan angka lama dapat dijelaskan saat
 * disandingkan - bukan menjadi selisih misterius yang membuat orang menyangka
 * salah satunya rusak.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const periode = require("./periodePenilaianService");
const ambang = require("./ambangPenilaianService");

function runQuery(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => {
      if (galat) gagal(galat);
      else selesai(Array.isArray(hasil) ? hasil : []);
    });
  });
}

function tanggalIso(nilai) {
  if (!nilai) return null;
  if (typeof nilai === "string") {
    const cocok = /^(\d{4}-\d{2}-\d{2})/.exec(nilai.trim());
    return cocok ? cocok[1] : null;
  }
  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) {
    const b = String(nilai.getMonth() + 1).padStart(2, "0");
    const h = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${b}-${h}`;
  }
  return null;
}

function teks(x) {
  return String(x === undefined || x === null ? "" : x).trim();
}

/* ==========================================================================
 * KT01 - Ketaatan tenggang pemanggilan (Pasal 122 HIR / Pasal 146 R.Bg)
 * ========================================================================== */

async function barisTenggangPanggilan(rentang) {
  const baris = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            r.perkara_id AS perkaraId,
            r.sidang_id AS sidangId,
            r.pihak_id AS pihakId,
            r.tanggal_relaas AS tanggalRelaas,
            sd.tanggal_sidang AS tanggalSidang,
            sd.agenda AS agenda,
            COALESCE(js.jurusita_nama, jm.nama_gelar, jm.nama) AS jurusita
       FROM perkara_pelaksanaan_relaas r
       JOIN perkara_jadwal_sidang sd ON sd.id = r.sidang_id
       JOIN perkara p ON p.perkara_id = r.perkara_id
       LEFT JOIN perkara_jurusita js ON js.jurusita_id = r.jurusita_id AND js.perkara_id = r.perkara_id
       LEFT JOIN jurusita jm ON jm.id = r.jurusita_id
      WHERE sd.tanggal_sidang >= ? AND sd.tanggal_sidang <= ?
        AND r.tanggal_relaas IS NOT NULL
        AND sd.tanggal_sidang IS NOT NULL
      ORDER BY sd.tanggal_sidang ASC, r.perkara_id ASC
      LIMIT 20000`,
    [rentang.mulai, rentang.selesai]
  );

  const batas = ambang.ambangBerlaku("tenggangPanggilan", rentang.selesai);
  const cukupHari = batas.nilai === null ? 3 : batas.nilai;

  return baris
    .map((r) => {
      const relaas = tanggalIso(r.tanggalRelaas);
      const sidang = tanggalIso(r.tanggalSidang);
      if (!relaas || !sidang) return null;

      let hariKerja = null;
      let hariKalender = null;
      try {
        hariKerja = periode.hariKerjaAntara(relaas, sidang);
        hariKalender = periode.hariKalenderAntara(relaas, sidang);
      } catch (_) {
        return null;
      }

      return {
        // Kunci baris harus tetap sama antar penghitungan, sebab catatan
        // tindak lanjut dan hak jawab melekat padanya.
        kunci: `${teks(r.nomorPerkara)}#${teks(r.sidangId)}#${teks(r.pihakId)}`,
        nomorPerkara: teks(r.nomorPerkara),
        jurusita: teks(r.jurusita),
        agenda: teks(r.agenda),
        tanggalRelaas: relaas,
        tanggalSidang: sidang,
        tenggangHariKerja: hariKerja,
        tenggangHariKalender: hariKalender,
        memenuhi: hariKerja >= cukupHari,
        // Baris yang lulus menurut hitungan lama tetapi gagal menurut hitungan
        // hari kerja. Inilah selisih yang akan muncul saat disandingkan, dan
        // ia ditandai supaya tidak perlu dicari-cari.
        bedaDenganHitunganLama: hariKalender >= cukupHari && hariKerja < cukupHari,
      };
    })
    .filter(Boolean);
}

/* ==========================================================================
 * KT02 - Perkara diselesaikan dalam ambang lima bulan (SEMA 2/2014)
 * ========================================================================== */

async function barisAsasPenyelesaian(rentang) {
  const baris = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            p.perkara_id AS perkaraId,
            p.tanggal_pendaftaran AS tanggalDaftar,
            pu.tanggal_putusan AS tanggalPutusan
       FROM perkara p
       JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE pu.tanggal_putusan >= ? AND pu.tanggal_putusan <= ?
        AND p.tanggal_pendaftaran IS NOT NULL
      ORDER BY pu.tanggal_putusan ASC, p.perkara_id ASC
      LIMIT 20000`,
    [rentang.mulai, rentang.selesai]
  );

  const batas = ambang.ambangBerlaku("asasPenyelesaian", rentang.selesai);
  const bulan = batas.nilai === null ? 5 : batas.nilai;
  // Lima bulan dihitung sebagai lima kali tiga puluh hari, sebagaimana lazim
  // dipakai pada laporan. Ditulis di sini supaya angkanya dapat diperiksa,
  // bukan tersembunyi di dalam rumus.
  const ambangHari = bulan * 30;

  return baris
    .map((r) => {
      const daftar = tanggalIso(r.tanggalDaftar);
      const putus = tanggalIso(r.tanggalPutusan);
      if (!daftar || !putus) return null;
      let umur = null;
      try {
        umur = periode.hariKalenderAntara(daftar, putus);
      } catch (_) {
        return null;
      }
      return {
        kunci: teks(r.nomorPerkara),
        nomorPerkara: teks(r.nomorPerkara),
        tanggalDaftar: daftar,
        tanggalPutusan: putus,
        umurHari: umur,
        ambangHari,
        memenuhi: umur <= ambangHari,
      };
    })
    .filter(Boolean);
}

/* ==========================================================================
 * KT03 - Putusan tidak diubah sesudah berkas diminutasi
 * ========================================================================== */

async function barisPerubahanSesudahMinutasi(rentang) {
  const baris = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            pu.perkara_id AS perkaraId,
            pu.tanggal_minutasi AS tanggalMinutasi,
            pu.tanggal_putusan AS tanggalPutusan,
            pu.updated_at AS diubahPada
       FROM perkara_putusan pu
       JOIN perkara p ON p.perkara_id = pu.perkara_id
      WHERE pu.tanggal_minutasi >= ? AND pu.tanggal_minutasi <= ?
        AND pu.tanggal_minutasi IS NOT NULL
      ORDER BY pu.tanggal_minutasi ASC, pu.perkara_id ASC
      LIMIT 20000`,
    [rentang.mulai, rentang.selesai]
  );

  return baris
    .map((r) => {
      const minutasi = tanggalIso(r.tanggalMinutasi);
      const diubah = tanggalIso(r.diubahPada);
      if (!minutasi) return null;
      // Yang tidak punya tanggal ubah dianggap TIDAK diubah - itu jawaban yang
      // benar untuk baris yang memang tidak pernah disunting, dan bukan
      // penyamaran: kolomnya memang kosong.
      const selisih = diubah ? periode.hariKalenderAntara(minutasi, diubah) : 0;
      return {
        kunci: teks(r.nomorPerkara),
        nomorPerkara: teks(r.nomorPerkara),
        tanggalMinutasi: minutasi,
        diubahPada: diubah,
        hariSesudahMinutasi: selisih > 0 ? selisih : 0,
        memenuhi: !(diubah && selisih > 0),
      };
    })
    .filter(Boolean);
}

/* ==========================================================================
 * Pendaftaran
 * ========================================================================== */

const DEFINISI = [
  {
    kunci: "ketaatanTenggangPanggilan",
    judul: "Ketaatan Tenggang Pemanggilan",
    keterangan:
      "Panggilan sah sekurangnya tiga hari kerja sebelum sidang, menurut Pasal 146 RBg.",
    lantai: "harian",
    // Naik dari hariKerja-v1 saat daftar hari libur 2026 disahkan terhadap
    // SKB. Delapan tanggal yang sebelumnya hilang membuat hitungan hari kerja
    // BERBEDA untuk periode yang memuatnya - dan itu perubahan CARA MENGHITUNG,
    // bukan perubahan data. Tanpa menaikkan penanda ini, nilai yang tersimpan
    // dari hitungan lama akan tampak "turun" seolah kinerjanya memburuk.
    versiRumus: "hariKerja-v2-skb2026",
    ambangDipakai: ["tenggangPanggilan"],
    caraHitung: {
      pembilang: "Relaas yang tenggangnya sekurangnya tiga hari kerja sebelum tanggal sidang",
      penyebut: "Seluruh relaas panggilan yang terhubung ke sebuah jadwal sidang pada rentang ini",
      dikecualikan:
        "Relaas yang tanggal relaas atau tanggal sidangnya kosong - keduanya tidak dapat dihitung tenggangnya",
      tabelSumber: "perkara_pelaksanaan_relaas, perkara_jadwal_sidang, perkara, perkara_jurusita, jurusita",
      ruasSumber: "tanggal_relaas, tanggal_sidang, sidang_id, jurusita_id, pihak_id",
    },
    // Penilaian inilah satu-satunya yang menghitung HARI KERJA, sehingga ia
    // bergantung pada daftar hari libur nasional. Selama daftar tahun yang
    // dinilai belum disahkan terhadap SKB, angkanya tetap dihitung tetapi
    // membawa keterangan itu sampai ke layar - juru sita tidak boleh dibina
    // dengan angka yang dasarnya sendiri belum dipastikan.
    pakaiHariKerja: true,
    baris: barisTenggangPanggilan,
  },
  {
    kunci: "asasPenyelesaianLimaBulan",
    judul: "Asas Penyelesaian Perkara Lima Bulan",
    keterangan: "Perkara diselesaikan paling lama lima bulan sejak didaftarkan, menurut SEMA 2 Tahun 2014.",
    lantai: "bulanan",
    versiRumus: "kalender-v1",
    ambangDipakai: ["asasPenyelesaian"],
    caraHitung: {
      pembilang: "Perkara yang umurnya sampai putus tidak melebihi lima bulan (150 hari)",
      penyebut: "Seluruh perkara yang diputus pada rentang ini",
      dikecualikan: "Perkara yang tanggal pendaftaran atau tanggal putusannya kosong",
      tabelSumber: "perkara, perkara_putusan",
      ruasSumber: "tanggal_pendaftaran, tanggal_putusan",
    },
    baris: barisAsasPenyelesaian,
  },
  {
    kunci: "putusanTidakDiubahSesudahMinutasi",
    judul: "Putusan Tidak Diubah Sesudah Minutasi",
    keterangan:
      "Berkas putusan yang sudah diminutasi tidak boleh disunting lagi; suntingan sesudahnya adalah temuan.",
    lantai: "bulanan",
    versiRumus: "v1",
    ambangDipakai: ["minutasiBerkas"],
    caraHitung: {
      pembilang: "Putusan yang tidak disunting sesudah tanggal minutasinya",
      penyebut: "Seluruh putusan yang diminutasi pada rentang ini",
      dikecualikan: "Putusan yang tanggal minutasinya kosong - belum diminutasi, jadi belum dapat dinilai",
      tabelSumber: "perkara_putusan, perkara",
      ruasSumber: "tanggal_minutasi, tanggal_putusan, updated_at",
    },
    baris: barisPerubahanSesudahMinutasi,
  },
];

let sudahDidaftar = false;

/**
 * Mendaftarkan seluruh penilaian pada berkas ini.
 *
 * Dipanggil sekali saat modul dimuat oleh pemuat penilaian. Dibuat dapat
 * dipanggil ulang tanpa akibat, sebab naskah uji memuat modul ini berkali-kali.
 */
function daftarkanSemua() {
  if (sudahDidaftar) return DEFINISI.map((d) => d.kunci);
  DEFINISI.forEach((d) => {
    if (!kerangka.ambil(d.kunci)) kerangka.daftarkan(d);
  });
  sudahDidaftar = true;
  return DEFINISI.map((d) => d.kunci);
}

function lupakan() {
  sudahDidaftar = false;
}

module.exports = {
  DEFINISI,
  daftarkanSemua,
  lupakan,
  // Diekspor untuk diuji satuan.
  barisTenggangPanggilan,
  barisAsasPenyelesaian,
  barisPerubahanSesudahMinutasi,
  tanggalIso,
};
