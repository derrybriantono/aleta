"use strict";

/**
 * ============================================================================
 * LAPORAN DIPA 04 - DAN KOREKSI ATAS APA YANG SEBELUMNYA SAYA KATAKAN
 * ============================================================================
 *
 * Sebelumnya tertulis di penilaianLaporanService bahwa data LIPA 14, 15, 16,
 * 18, 19, dan 21 "tidak ada di SIPP dan tidak ada di mana pun yang dapat
 * dibaca ALETA". Bagian pertamanya benar; bagian keduanya SALAH.
 *
 * Datanya ada - di aplikasi pendukung yang dipakai satuan kerja untuk menyusun
 * dan mengirim laporan, berdampingan dengan SIPP. Aplikasi itu punya tabelnya
 * sendiri, dan tabel itulah yang menjadi sumber laporan yang dikirim ke
 * Pengadilan Tinggi Agama:
 *
 *   tbl_data_laporan_rk8a   sidang di luar gedung pengadilan   (LIPA 14)
 *   tbl_data_laporan_rk8b   pembebasan biaya perkara/prodeo    (LIPA 15)
 *   tbl_data_laporan_rk8c   pos bantuan hukum                  (LIPA 16)
 *   tbl_data_laporan_yandu  pelayanan terpadu                  (LIPA 21)
 *   tbl_mst_pagu_satker     pagu dan revisinya per satuan kerja
 *
 * ============================================================================
 * TABELNYA DIKENALI, DATANYA BELUM TENTU ADA
 * ============================================================================
 *
 * Basis data aplikasi pendukung itu TIDAK ada di tangan saat berkas ini
 * ditulis - yang terbaca bentuknya, dari kode aplikasinya. Karena itu tiap
 * butir di sini memeriksa tabelnya lebih dahulu dan memulangkan daftar kosong
 * bila tidak ada: ia tidak dinilai nol, dan ia menyala sendiri di satuan kerja
 * yang aplikasinya memang terpasang.
 *
 * Perlakuan yang sama dipakai penyitaan dan konsinyasi pada Bab 5.
 *
 * ============================================================================
 * YANG PALING BERGUNA DI SINI BUKAN ANGKANYA, MELAINKAN SELISIHNYA
 * ============================================================================
 *
 * Prodeo tercatat di DUA tempat: pada SIPP sebagai tanda pada perkaranya, dan
 * pada laporan RK8b sebagai angka bulanan yang dikirim ke atas. Keduanya
 * seharusnya sama, dan tidak ada satu pun yang pernah membandingkannya.
 *
 * Selisih di antara keduanya bukan sekadar kerapian: angka laporan yang lebih
 * besar daripada SIPP berarti pembebasan biaya dilaporkan untuk perkara yang
 * tidak bertanda prodeo, dan itu menyangkut uang negara.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

const BATAS_BARIS = 2000;

/**
 * Tiga laporan DIPA 04 beserta pagunya.
 *
 * ruasPagu   kolom pagu pada tbl_mst_pagu_satker; laporan yang realisasinya
 *            melampaui pagu adalah temuan, bukan kerapian
 */
const DIPA = [
  {
    kode: "LP14",
    kunci: "lipaSidangLuarGedung",
    judul: "LIPA 14 — Sidang di Luar Gedung Pengadilan",
    tabel: "tbl_data_laporan_rk8a",
    ruasPagu: "pagu_sidkel",
    ruasPaguRevisi: "pagu_sidkel_revisi",
    keterangan:
      "Laporan sidang di luar gedung yang dibiayai DIPA 04. Yang dinilai apakah tiap bulan yang dilaporkan menyebutkan jumlah perkara, jumlah biaya, dan kegiatannya - laporan tanpa ketiganya tidak dapat dipertanggungjawabkan.",
    wajib: ["perkara", "jml", "kegiatan"],
  },
  {
    kode: "LP16",
    kunci: "lipaPosBantuanHukum",
    judul: "LIPA 16 — Pos Bantuan Hukum",
    tabel: "tbl_data_laporan_rk8c",
    ruasPagu: "pagu_posbakum",
    ruasPaguRevisi: "pagu_posbakum_revisi",
    keterangan:
      "Laporan Pos Bantuan Hukum yang dibiayai DIPA 04. Jumlah layanan dan besaran biayanya harus tercatat pada tiap bulan yang dilaporkan.",
    wajib: ["layanan", "jml"],
  },
  {
    kode: "LP21",
    kunci: "lipaPelayananTerpadu",
    judul: "LIPA 21 — Pelayanan Terpadu Sidang Keliling",
    tabel: "tbl_data_laporan_yandu",
    ruasPagu: "",
    ruasPaguRevisi: "",
    keterangan:
      "Laporan pelayanan terpadu bersama instansi lain. Yang dinilai kelengkapan baris bulanannya.",
    wajib: ["jml"],
  },
];

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

function terisi(nilai) {
  const t = teks(nilai);
  if (!t || t === "-") return false;
  if (/^0(\.0+)?$/.test(t)) return false;
  return true;
}

/** Baris bulanan satu laporan DIPA 04. */
function pembangunBaris(d) {
  return async function baris(rentang) {
    const ada = await sippSkemaService.tabelAda(d.tabel).catch(() => false);
    if (!ada) return [];

    const tahunMulai = Number(String(rentang.mulai).slice(0, 4)) || 0;
    const tahunSelesai = Number(String(rentang.selesai).slice(0, 4)) || tahunMulai;

    const hasil = await runQuery(
      `SELECT tahun, bulan, ${d.wajib.join(", ")}, keterangan
         FROM ${d.tabel}
        WHERE tahun >= ? AND tahun <= ?
        ORDER BY tahun, bulan
        LIMIT ${BATAS_BARIS}`,
      [tahunMulai, tahunSelesai]
    );

    return hasil.map((r) => {
      const kosong = d.wajib.filter((k) => !terisi(r[k]));
      const bulan = `${teks(r.tahun)}-${String(teks(r.bulan)).padStart(2, "0")}`;
      return {
        kunci: `${bulan}#${d.kode}`,
        nomorPerkara: bulan,
        jenisPerkara: d.judul,
        ruasKosong: kosong,
        memenuhi: kosong.length === 0,
        sebabTidakMemenuhi: kosong.length === 0 ? "" : `belum terisi: ${kosong.join(", ")}`,
      };
    });
  };
}

/**
 * ============================================================================
 * PENYANDING: ANGKA LAPORAN PRODEO LAWAN ANGKA SIPP
 * ============================================================================
 *
 * Inilah butir yang paling berguna dari seluruh berkas ini, dan satu-satunya
 * yang menjawab pertanyaan yang selama ini tidak pernah ditanyakan: apakah
 * yang dilaporkan ke atas sama dengan yang tercatat di SIPP.
 *
 * Dihitung per bulan, sebab laporannya bulanan. Perkara prodeo pada SIPP
 * dihitung dari tanda prodeo pada perkaranya; angka laporan dibaca dari kolom
 * perkara pada RK8b.
 *
 * Selisih ke ARAH MANA PUN adalah temuan, dan keduanya berbeda artinya:
 *
 *   laporan > SIPP   pembebasan biaya dilaporkan untuk perkara yang tidak
 *                    bertanda prodeo - ini menyangkut uang negara
 *   laporan < SIPP   perkara prodeo yang tidak dilaporkan, sehingga satuan
 *                    kerja tidak menerima penggantian biayanya
 */
async function barisSandingProdeo(rentang) {
  const adaLaporan = await sippSkemaService.tabelAda("tbl_data_laporan_rk8b").catch(() => false);
  if (!adaLaporan) return [];

  const tahunMulai = Number(String(rentang.mulai).slice(0, 4)) || 0;
  const tahunSelesai = Number(String(rentang.selesai).slice(0, 4)) || tahunMulai;

  const laporan = await runQuery(
    `SELECT tahun, bulan, perkara AS jumlahLaporan
       FROM tbl_data_laporan_rk8b
      WHERE tahun >= ? AND tahun <= ?
      ORDER BY tahun, bulan
      LIMIT ${BATAS_BARIS}`,
    [tahunMulai, tahunSelesai]
  );

  const sipp = await runQuery(
    `SELECT YEAR(p.tanggal_pendaftaran) AS tahun,
            MONTH(p.tanggal_pendaftaran) AS bulan,
            COUNT(*) AS jumlahSipp
       FROM perkara p
      WHERE p.prodeo = 1
        AND p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY YEAR(p.tanggal_pendaftaran), MONTH(p.tanggal_pendaftaran)`,
    [rentang.mulai, rentang.selesai]
  );

  const petaSipp = new Map();
  for (const r of sipp) petaSipp.set(`${r.tahun}-${r.bulan}`, angka(r.jumlahSipp));

  return laporan.map((r) => {
    const kunciBulan = `${r.tahun}-${r.bulan}`;
    const dariLaporan = angka(r.jumlahLaporan);
    const dariSipp = petaSipp.get(kunciBulan) || 0;
    const selisih = dariLaporan - dariSipp;
    const bulan = `${teks(r.tahun)}-${String(teks(r.bulan)).padStart(2, "0")}`;

    return {
      kunci: `${bulan}#LP24`,
      nomorPerkara: bulan,
      jenisPerkara: "Prodeo — laporan lawan SIPP",
      jumlahLaporan: dariLaporan,
      jumlahSipp: dariSipp,
      selisih,
      memenuhi: selisih === 0,
      sebabTidakMemenuhi:
        selisih === 0
          ? ""
          : selisih > 0
            ? `laporan menyebut ${dariLaporan}, SIPP hanya ${dariSipp} - ${selisih} perkara dilaporkan tanpa tanda prodeo di SIPP`
            : `SIPP mencatat ${dariSipp}, laporan hanya ${dariLaporan} - ${Math.abs(selisih)} perkara prodeo tidak dilaporkan`,
    };
  });
}

let sudahDidaftar = false;

function daftarkanSemua() {
  if (sudahDidaftar) return kunciSemua();

  DIPA.forEach((d) => {
    if (kerangka.ambil(d.kunci)) return;
    kerangka.daftarkan({
      kunci: d.kunci,
      judul: d.judul,
      keterangan: d.keterangan,
      lantai: "bulanan",
      versiRumus: "dipa04-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: `Bulan laporan yang seluruh kolom wajibnya terisi: ${d.wajib.join(", ")}`,
        penyebut: `Seluruh bulan yang tercatat pada ${d.tabel} dalam tahun rentang ini`,
        dikecualikan:
          "Tidak ada yang dikecualikan dari yang tercatat. Bila tabel aplikasi pendukungnya tidak ada pada satuan kerja ini, butir ini tidak menghasilkan baris sama sekali - ia tidak dinilai nol.",
        tabelSumber: `${d.tabel} milik aplikasi pendukung laporan, berdampingan dengan SIPP`,
        ruasSumber: `tahun, bulan, ${d.wajib.join(", ")}`,
      },
      baris: pembangunBaris(d),
    });
  });

  if (!kerangka.ambil("sandingProdeoLaporanSipp")) {
    kerangka.daftarkan({
      kunci: "sandingProdeoLaporanSipp",
      judul: "LIPA 24 — Selisih Angka Prodeo antara Laporan dan SIPP",
      keterangan:
        "Menyandingkan jumlah perkara prodeo yang DILAPORKAN pada RK8b dengan yang TERCATAT di SIPP, bulan demi bulan. Selisih ke arah mana pun adalah temuan: laporan yang lebih besar berarti pembebasan biaya dilaporkan untuk perkara yang tidak bertanda prodeo, dan laporan yang lebih kecil berarti satuan kerja tidak menerima penggantian biaya yang menjadi haknya.",
      lantai: "bulanan",
      versiRumus: "sanding-prodeo-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: "Bulan yang angka laporannya sama persis dengan hitungan SIPP",
        penyebut: "Seluruh bulan yang tercatat pada laporan RK8b dalam rentang ini",
        dikecualikan:
          "Tidak ada. Bulan yang tidak dilaporkan sama sekali tidak muncul sebagai baris - itu urusan butir ketepatan pengiriman laporan, bukan butir ini.",
        tabelSumber:
          "tbl_data_laporan_rk8b milik aplikasi pendukung laporan, disandingkan dengan tabel perkara milik SIPP",
        ruasSumber: "tahun, bulan, perkara, prodeo, tanggal_pendaftaran",
      },
      baris: barisSandingProdeo,
    });
  }

  sudahDidaftar = true;
  return kunciSemua();
}

function kunciSemua() {
  return [...DIPA.map((d) => d.kunci), "sandingProdeoLaporanSipp"];
}

function lupakanSemua() {
  sudahDidaftar = false;
}

function sambungan() {
  const peta = {};
  DIPA.forEach((d) => {
    peta[d.kode] = d.kunci;
  });
  peta.LP24 = "sandingProdeoLaporanSipp";
  return peta;
}

module.exports = {
  DIPA,
  barisSandingProdeo,
  daftarkanSemua,
  kunciSemua,
  lupakanSemua,
  sambungan,
};
