"use strict";

/**
 * ============================================================================
 * RENCANA PENETAPAN DIBANDINGKAN DENGAN BENTUK SIPP YANG TERUKUR
 * ============================================================================
 *
 * Penjaga teks memastikan kodenya berbunyi benar. Skrip ini memastikan
 * RENCANANYA benar - daftar langkah yang sungguh tersusun, disandingkan dengan
 * bentuk yang diukur dari sys_audittrail satker atas pekerjaan tangan:
 *
 *   TAMBAH PENETAPAN HAKIM/MAJELIS HAKIM   1.072 penetapan
 *     perkara_penetapan INSERT, perkara_hakim_pn INSERT xN, perkara UPDATE
 *
 *   TAMBAH PENUNJUKAN PANITERA/JURUSITA      802 / 805
 *     perkara_penetapan UPDATE, <petugas> INSERT, perkara UPDATE
 *
 *   Tambah Penetapan Sidang Pertama          818 penetapan
 *     perkara_penetapan UPDATE, perkara_jadwal_sidang INSERT,
 *     perkara_penetapan_hari_sidang INSERT, perkara UPDATE, perkara UPDATE
 *
 * Yang TIDAK pernah muncul di sana, nol baris sejak 2016: perkara_proses dan
 * perkara_smartmajelis. Keduanya ditulis - riwayatnya memang harus ada - tetapi
 * tidak dicatat di sys_audittrail, sebab SIPP pun tidak mencatatnya.
 *
 * Berjalan tanpa jaringan dan tanpa basis data - db_config diganti penadah.
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, tambahan = "") {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${tambahan ? ` - ${tambahan}` : ""}`);
  }
}

// ---------------------------------------------------------------- penadah
const idBerikutnya = { perkara_jurusita: 10274, perkara_jadwal_sidang: 20099 };
/** Keadaan penetapan perkara yang dijawab penadah - diubah tiap bagian. */
let keadaan = { pmh: "2026-09-15", ppp: null, pjs: null, phs: null };
/** ref_majelis_tetap dijawab kosong - untuk menguji jalur "di luar rekomendasi". */
let refKosong = false;

const { jawabPejabat } = require("./_penadah-pejabat");

const dbPath = require.resolve("../db_config");
require("../db_config");
require.cache[dbPath].exports = {
  query: (sql, params, selesai) => {
    const teks = String(sql);
    // Butir 17 (13 Okt 2026): akun pejabat, majelis, dan jam SIPP.
    const pejabat = jawabPejabat(teks, { username: "sudarmin", punyaMajelis: () => Boolean(keadaan.pmh) });
    if (pejabat !== undefined) return selesai(null, pejabat);
    if (/COALESCE\(MAX\(id\), 0\) \+ 1/.test(teks)) {
      const tabel = (/FROM (\w+)/.exec(teks) || [])[1];
      return selesai(null, [{ berikutnya: idBerikutnya[tabel] || 1 }]);
    }
    if (/FROM perkara p\b/.test(teks)) {
      return selesai(null, [
        {
          perkaraId: 10119,
          nomorPerkara: "567/Pdt.G/2026/PA.Dgl",
          // Baris perkara_penetapan lahir bersama PMH - sebelum itu ia
          // memang belum ada, dan PMH pertama menyisipkannya.
          adaPenetapan: keadaan.pmh ? 10119 : 0,
          adaSmartMajelis: 0,
          jenisPerkaraId: 347,
          ...keadaan,
        },
      ]);
    }
    if (/FROM sys_users/.test(teks)) return selesai(null, [{ username: "sudarmin", fullname: "Sudarmin, S.H." }]);
    if (/FROM jurusita/.test(teks)) return selesai(null, [{ id: 30, kode: "JS30", nip: "1987", namaGelar: "Mustini", nama: "Mustini" }]);
    if (/FROM panitera_pn/.test(teks)) return selesai(null, [{ id: 30, kode: "PP30", nip: "1988", namaGelar: "Fikrianto, S.H.", nama: "Fikrianto" }]);
    if (/FROM hakim_pn/.test(teks)) {
      return selesai(null, [
        { hakimId: 11, kode: "H11", nip: "1", nama: "Hakim Satu" },
        { hakimId: 12, kode: "H12", nip: "2", nama: "Hakim Dua" },
        { hakimId: 13, kode: "H13", nip: "3", nama: "Hakim Tiga" },
      ]);
    }
    if (/FROM ruangan_sidang/.test(teks)) return selesai(null, [{ id: 1, nama: "Ruang Sidang 1", keliling: "T" }]);
    if (/information_schema/.test(teks)) return selesai(null, [{ TABLE_NAME: "x", COLUMN_NAME: "y" }]);
    if (/NOW\(\)|CURRENT_TIMESTAMP/i.test(teks)) return selesai(null, [{ saat: "2026-09-15 11:02:46" }]);
    if (/FROM perkara_penetapan_hari_sidang/.test(teks)) return selesai(null, [{ id: 20099 }]);
    // Susunan tetap SIPP: trio yang sama pada dua kompetensi, seperti PA
    // Donggala (39 Perdata Agama, 40 Permohonan). Dikosongkan bila refKosong.
    if (/FROM ref_majelis_tetap/.test(teks)) {
      return selesai(
        null,
        refKosong
          ? []
          : [
              { majelisId: 40, kompetensiId: 27, skId: 3, hakim: "11,12,13" },
              { majelisId: 39, kompetensiId: 22, skId: 3, hakim: "11,12,13" },
              { majelisId: 35, kompetensiId: 22, skId: 2, hakim: "11,12,13" },
            ]
      );
    }
    return selesai(null, []);
  },
};

const skemaPath = require.resolve("../services/sippSkemaService");
const skemaAsli = require("../services/sippSkemaService");
require.cache[skemaPath].exports = { ...skemaAsli, tabelAda: async () => true, muat: async () => ({}) };

const layanan = require("../services/penetapanTulisService");

const dasar = {
  perkaraId: 10119,
  tanggalPenetapan: "2026-09-15",
  olehUsername: "sudarmin",
  // Butir 17: akun pejabat yang dicatat SIPP; akun yang masuk hanya jejak ALETA.
  pejabatUsername: "sudarmin",
  akunSippMasuk: "sudarmin",
  operator: "SUPER ADMIN DERRY",
  ip: "192.168.9.121",
};

/** Daftar tabel yang diaudit, menurut urutan langkahnya. */
const tabelDiaudit = (rencana) =>
  rencana.langkah
    .filter((x) => x.tabel === "sys_audittrail")
    .map((x) => `${x.params[5]}:${x.params[3]}`);

const langkahData = (rencana) =>
  rencana.langkah.filter((x) => x.tabel !== "sys_audittrail").map((x) => `${x.aksi}:${x.tabel}`);

(async () => {
  console.log("rencana penetapan dibandingkan dengan bentuk SIPP");

  // ======================================================================
  // 1. PMH - smart majelis ditulis, tetapi tidak diaudit
  // ======================================================================
  keadaan = { pmh: null, ppp: null, pjs: null, phs: null };
  const pmh = await layanan.susunRencanaTulis({ ...dasar, jenis: "pmh", hakimId: [11, 12, 13] });
  periksa("rencana PMH tersusun", pmh.ok === true, pmh.alasan || "");
  if (pmh.ok) {
    const audit = tabelDiaudit(pmh);
    console.log(`        data  : ${langkahData(pmh).join(", ")}`);
    console.log(`        audit : ${audit.join(", ")}`);
    periksa("PMH tetap MENULIS baris smart majelis", langkahData(pmh).some((x) => x.endsWith("perkara_smartmajelis")));
    periksa("PMH tetap MENULIS baris riwayat", langkahData(pmh).some((x) => x.endsWith("perkara_proses")));
    periksa("audit PMH TIDAK menyebut perkara_smartmajelis", !audit.some((x) => x.includes("perkara_smartmajelis")));
    periksa("audit PMH TIDAK menyebut perkara_proses", !audit.some((x) => x.includes("perkara_proses")));
    periksa(
      "bentuk audit PMH sama dengan SIPP",
      audit.join(", ") ===
        "INSERT:perkara_penetapan, INSERT:perkara_hakim_pn, INSERT:perkara_hakim_pn, INSERT:perkara_hakim_pn, UPDATE:perkara",
      audit.join(", ")
    );
  }

  // ======================================================================
  // 1b. SMART MAJELIS - PADA JUDUL hakim_pn, DAN STATUS 1 BILA MAJELIS SK
  // ======================================================================
  //
  // Diukur pada perkara 468/Pdt.G/2026 (tangan, 28 Juli 2026 09:21:09):
  // ketiga baris perkara_hakim_pn berjudul "dari halaman <b> Smart Majelis
  // TAMBAH PENETAPAN HAKIM/MAJELIS HAKIM</b>", formname tetap tanpa kata
  // itu, dan baris perkara_penetapan serta perkara tidak menyebutnya.
  // perkara_smartmajelis-nya: majelis_id 39, hakim_id "33,28,31", hakim_id2
  // NULL, status 1, keterangan NULL.
  keadaan = { pmh: null, ppp: null, pjs: null, phs: null };
  const pmhSmart = await layanan.susunRencanaTulis({ ...dasar, jenis: "pmh", hakimId: [11, 12, 13] });
  periksa("rencana PMH (smart) tersusun", pmhSmart.ok === true, pmhSmart.alasan || "");
  if (pmhSmart.ok) {
    const auditHakim = pmhSmart.langkah.filter((x) => x.tabel === "sys_audittrail" && x.params[3] === "perkara_hakim_pn");
    const auditLain = pmhSmart.langkah.filter((x) => x.tabel === "sys_audittrail" && x.params[3] !== "perkara_hakim_pn");
    periksa("tiga baris audit hakim_pn", auditHakim.length === 3, String(auditHakim.length));
    periksa(
      "judul hakim_pn menyebut Smart Majelis persis bentuk SIPP",
      auditHakim.every((x) => x.params[6].includes("dari halaman <b> Smart Majelis TAMBAH PENETAPAN HAKIM/MAJELIS HAKIM</b>")),
      auditHakim[0] && auditHakim[0].params[6]
    );
    periksa(
      "formname hakim_pn TETAP tanpa kata Smart Majelis",
      auditHakim.every((x) => x.params[4] === "TAMBAH PENETAPAN HAKIM/MAJELIS HAKIM"),
      auditHakim[0] && auditHakim[0].params[4]
    );
    periksa(
      "baris perkara_penetapan dan perkara TIDAK menyebut Smart Majelis",
      auditLain.length === 2 && auditLain.every((x) => !x.params[6].includes("Smart Majelis"))
    );
    const smart = pmhSmart.langkah.find((x) => x.tabel === "perkara_smartmajelis");
    periksa("baris smart majelis ada", Boolean(smart));
    if (smart) {
      periksa("status 1 - sesuai rekomendasi", smart.params.includes("1") && !smart.params.includes(2));
      periksa("majelis_id kompetensi Perdata Agama (39) untuk Pdt.G, bukan 40 Permohonan atau 35 SK lama", smart.params[1] === 39, String(smart.params[1]));
      periksa("hakim_id menurut urutan ref", smart.params[2] === "11,12,13", String(smart.params[2]));
      periksa("hakim_id2 dan keterangan NULL", /hakim_id2, status, tanggal, keterangan\)\s+VALUES \(\?,\?,\?,NULL,\?,\?,NULL\)/.test(smart.sql));
    }
  }
  {
    refKosong = true;
    keadaan = { pmh: null, ppp: null, pjs: null, phs: null };
    const pmhLuar = await layanan.susunRencanaTulis({ ...dasar, jenis: "pmh", hakimId: [11, 12, 13] });
    refKosong = false;
    const smart = pmhLuar.ok && pmhLuar.langkah.find((x) => x.tabel === "perkara_smartmajelis");
    periksa("tanpa susunan tetap yang cocok: kembali ke status 2 beserta sebabnya", Boolean(smart) && smart.params.includes(2));
    const auditHakim = pmhLuar.ok ? pmhLuar.langkah.filter((x) => x.tabel === "sys_audittrail" && x.params[3] === "perkara_hakim_pn") : [];
    // Diganti 5 Okt 2026 (butir 39): status 2 adalah jalur borang
    // addMajelis_c -> insert_penetapan_majelis, yang judul hakim_pn-nya TANPA
    // "Smart Majelis" - terbaca pada baris 505502-505504 perkara 10186
    // (status 2, keterangan "Perkara sidkel"). Judul Smart Majelis hanya milik
    // jalur rekomendasi (status 1).
    periksa(
      "susunan di luar ref: judul hakim_pn TANPA Smart Majelis, keterangan = sebabnya",
      auditHakim.length === 3 &&
        auditHakim.every((x) => !x.params[6].includes("Smart Majelis") && x.params[7].includes("<td>keterangan</td><td>Ditetapkan menurut giliran"))
    );
  }

  // ======================================================================
  // 1c. SATU PENETAPAN, SATU KALI AUDIT - TIDAK ADA BARIS KEMBAR
  // ======================================================================
  //
  // Keluhan perkara 567: audit trail dipenuhi baris berulang. Yang dijaga:
  // dalam satu rencana, tidak ada dua baris audit yang tabel, aksi, judul,
  // DAN description-nya sama. Judul saja tidak cukup membedakan: ketiga baris
  // hakim_pn SIPP berjudul identik (diukur pada 468) dan berbeda hanya pada
  // description-nya (nama hakimnya); begitu pula dua UPDATE perkara pada PHS.
  // Bentuk tiap langkah dicocokkan dengan SIPP: PMH 5, PPP 3, PJS 3, PHS 5.
  {
    const kunciAudit = (rencana) =>
      rencana.langkah.filter((x) => x.tabel === "sys_audittrail").map((x) => `${x.params[3]}|${x.params[5]}|${x.params[6]}|${x.params[7]}`);
    const kembar = (daftar) => daftar.length - new Set(daftar).size;

    keadaan = { pmh: null, ppp: null, pjs: null, phs: null };
    const rPmh = await layanan.susunRencanaTulis({ ...dasar, jenis: "pmh", hakimId: [11, 12, 13] });
    keadaan = { pmh: "2026-09-15", ppp: null, pjs: null, phs: null };
    const rPpp = await layanan.susunRencanaTulis({ ...dasar, jenis: "ppp", petugasId: 30 });
    keadaan = { pmh: "2026-09-15", ppp: "2026-09-15", pjs: null, phs: null };
    const rPjs = await layanan.susunRencanaTulis({ ...dasar, jenis: "pjs", petugasId: 30 });
    keadaan = { pmh: "2026-09-15", ppp: "2026-09-15", pjs: "2026-09-15", phs: null };
    const rPhs = await layanan.susunRencanaTulis({ ...dasar, jenis: "phs", tanggalSidang: "2026-09-23" });

    for (const [nama, r, jumlah] of [["PMH", rPmh, 5], ["PPP", rPpp, 3], ["PJS", rPjs, 3], ["PHS", rPhs, 5]]) {
      periksa(`rencana ${nama} tersusun`, r.ok === true, r.alasan || "");
      if (!r.ok) continue;
      const k = kunciAudit(r);
      periksa(`${nama}: ${jumlah} baris audit, persis SIPP`, k.length === jumlah, String(k.length));
      periksa(`${nama}: tidak ada baris audit kembar`, kembar(k) === 0, `${kembar(k)} kembar`);
      if (nama === "PHS") {
        periksa("PHS: dua UPDATE perkara berjudul sama, berbeda isinya - bentuk SIPP sendiri", k.filter((x) => x.startsWith("perkara|UPDATE|")).length === 2);
      }
    }
    const semua = [rPmh, rPpp, rPjs, rPhs].filter((r) => r.ok).flatMap(kunciAudit);
    periksa("seluruh rantai: 16 baris audit, tidak satu pun kembar", semua.length === 16 && kembar(semua) === 0, `${semua.length} baris, ${kembar(semua)} kembar`);
  }

  // ======================================================================
  // 2. PHS - dua baris riwayat, dua kali UPDATE perkara
  // ======================================================================
  keadaan = { pmh: "2026-09-15", ppp: "2026-09-15", pjs: "2026-09-15", phs: null };
  const phs = await layanan.susunRencanaTulis({
    ...dasar,
    jenis: "phs",
    tanggalSidang: "2026-09-30",
    ruanganId: 1,
    rantaiSebelum: ["pmh", "ppp", "pjs"],
  });
  periksa("rencana PHS tersusun", phs.ok === true, phs.alasan || "");
  if (phs.ok) {
    const audit = tabelDiaudit(phs);
    console.log(`        data  : ${langkahData(phs).join(", ")}`);
    console.log(`        audit : ${audit.join(", ")}`);

    const riwayat = phs.langkah.filter((x) => x.tabel === "perkara_proses");
    periksa("PHS menulis DUA baris riwayat", riwayat.length === 2, String(riwayat.length));
    periksa("baris pertama proses 80", riwayat[0] && riwayat[0].params[3] === 80, riwayat[0] && String(riwayat[0].params[3]));
    periksa("baris kedua proses 81", riwayat[1] && riwayat[1].params[3] === 81, riwayat[1] && String(riwayat[1].params[3]));
    periksa(
      "baris kedua bernama Sidang pertama",
      riwayat[1] && riwayat[1].params[4] === "Sidang pertama",
      riwayat[1] && String(riwayat[1].params[4])
    );
    periksa(
      "baris kedua bertanggal tanggal SIDANG",
      riwayat[1] && riwayat[1].params[5] === "2026-09-30",
      riwayat[1] && String(riwayat[1].params[5])
    );
    periksa(
      "keduanya atas nama pejabat yang sama, pada detik yang sama",
      riwayat[0] && riwayat[1] && riwayat[0].params[6] === riwayat[1].params[6] && riwayat[0].params[7] === riwayat[1].params[7]
    );

    const perkaraUpdate = phs.langkah.filter((x) => x.tabel === "perkara" && x.aksi === "UPDATE");
    periksa("tabel perkara diperbarui DUA kali", perkaraUpdate.length === 2, String(perkaraUpdate.length));
    periksa(
      "keadaan AKHIR berbunyi Sidang pertama",
      perkaraUpdate.length === 2 && perkaraUpdate[1].params[3] === "Sidang pertama",
      perkaraUpdate.length === 2 ? String(perkaraUpdate[1].params[3]) : ""
    );
    periksa(
      "keadaan akhir proses_terakhir_id 81",
      perkaraUpdate.length === 2 && perkaraUpdate[1].params[2] === 81
    );
    periksa("audit PHS TIDAK menyebut perkara_proses", !audit.some((x) => x.includes("perkara_proses")));
    periksa(
      "audit perkara UPDATE muncul dua kali, seperti SIPP",
      audit.filter((x) => x === "UPDATE:perkara").length === 2,
      audit.join(", ")
    );

    const auditJadwal = phs.langkah.find((x) => x.tabel === "sys_audittrail" && x.params[3] === "perkara_jadwal_sidang");
    periksa(
      "kunci audit jadwal sidang memakai id barisnya sendiri",
      Boolean(auditJadwal) && /Primary Key \[id=#ID#\]/.test(String(auditJadwal.params[6])),
      auditJadwal ? String(auditJadwal.params[6]).slice(-40) : ""
    );
    periksa(
      "penandanya tahu langkah mana yang melahirkan id-nya",
      Boolean(auditJadwal && auditJadwal.kunciDariLangkah && typeof auditJadwal.kunciDariLangkah["#ID#"] === "number")
    );
  }

  // ======================================================================
  // 3. Bongkar - kembali ke Pendaftaran, dua baris riwayat ikut terbongkar
  // ======================================================================
  keadaan = { pmh: "2026-09-15", ppp: null, pjs: null, phs: "2026-09-15" };
  const bongkarPhs = await layanan.susunRencanaHapus({ ...dasar, jenis: "phs" });
  periksa("rencana bongkar PHS tersusun", bongkarPhs.ok === true, bongkarPhs.alasan || "");
  if (bongkarPhs.ok) {
    const riwayat = bongkarPhs.langkah.filter((x) => x.tabel === "perkara_proses");
    periksa("bongkar PHS membuang DUA baris riwayat", riwayat.length === 2, String(riwayat.length));
    periksa(
      "keduanya proses 80 dan 81",
      riwayat.length === 2 && riwayat[0].params[2] === 80 && riwayat[1].params[2] === 81
    );
    const audit = tabelDiaudit(bongkarPhs);
    periksa("audit bongkar TIDAK menyebut perkara_proses", !audit.some((x) => x.includes("perkara_proses")));
  }

  // Seluruh penetapan dibongkar - tidak ada yang tersisa.
  keadaan = { pmh: "2026-09-15", ppp: null, pjs: null, phs: null };
  const bongkarPmh = await layanan.susunRencanaHapus({ ...dasar, jenis: "pmh" });
  periksa("rencana bongkar PMH tersusun", bongkarPmh.ok === true, bongkarPmh.alasan || "");
  if (bongkarPmh.ok) {
    const kembali = bongkarPmh.langkah.filter((x) => x.tabel === "perkara" && x.aksi === "UPDATE").pop();
    console.log(`        kembali ke: tahapan="${kembali.params[1]}" status="${kembali.params[3]}"`);
    periksa("tahapannya Pendaftaran", kembali.params[1] === "Pendaftaran", String(kembali.params[1]));
    periksa("statusnya Pendaftaran Perkara", kembali.params[3] === "Pendaftaran Perkara", String(kembali.params[3]));
    periksa("keduanya BERBEDA", kembali.params[1] !== kembali.params[3]);
  }

  // PHS masih ada sesudah PPP dibongkar - keadaannya kembali ke Sidang pertama.
  keadaan = { pmh: "2026-09-15", ppp: "2026-09-15", pjs: "2026-09-15", phs: "2026-09-15" };
  const bongkarPpp = await layanan.susunRencanaHapus({ ...dasar, jenis: "ppp" });
  if (bongkarPpp.ok) {
    const kembali = bongkarPpp.langkah.filter((x) => x.tabel === "perkara" && x.aksi === "UPDATE").pop();
    periksa(
      "PHS yang tersisa mengembalikan status ke Sidang pertama",
      kembali.params[3] === "Sidang pertama",
      String(kembali.params[3])
    );
  }

  // ======================================================================
  // 4. Alamat audit datang dari pemanggil, bukan dikarang
  // ======================================================================
  if (pmh.ok) {
    const satu = pmh.langkah.find((x) => x.tabel === "sys_audittrail");
    periksa("alamat pada baris audit diteruskan apa adanya", satu && satu.params[1] === "192.168.9.121", satu && String(satu.params[1]));
  }

  console.log(`\nlulus ${lulus}, gagal ${gagal}`);
  process.exit(gagal === 0 ? 0 : 1);
})().catch((galat) => {
  console.error("GAGAL TOTAL", galat);
  process.exit(1);
});
