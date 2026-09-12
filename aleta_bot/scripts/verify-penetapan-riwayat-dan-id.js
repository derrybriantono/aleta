"use strict";

/**
 * ============================================================================
 * PENETAPAN YANG BERHENTI DI TENGAH JALAN, DAN RIWAYAT YANG TIDAK PERNAH ADA
 * ============================================================================
 *
 * Tiga kekeliruan yang ditemukan pada perkara 561 dan 562 PA Donggala,
 * 12 September 2026. Ketiganya tidak pernah berbunyi - yang terlihat petugas
 * hanya "ditolak" tanpa sebab yang menunjuk ke mana pun.
 *
 *   1. perkara_jurusita TIDAK memakai auto_increment. INSERT tanpa id
 *      menghasilkan id=0. Perkara PERTAMA berhasil; perkara KEDUA bertabrakan
 *      pada kunci utama yang sama dan seluruh langkahnya berhenti - sesudah
 *      perkara_penetapan telanjur diperbarui. Perkara 561 tertinggal separuh
 *      tertulis: penetapan_jurusita terisi, perkara_jurusita kosong.
 *
 *   2. perkara_jadwal_sidang juga tanpa auto_increment, dan akibatnya lebih
 *      halus: insertId yang dipulangkan ikut 0, langkah berikutnya membacanya
 *      sebagai "belum ada" lalu berhenti. Perkara 562 tertinggal dengan jadwal
 *      sidang berid 0 tanpa satu pun baris penetapan hari sidang.
 *
 *   3. perkara_proses tidak pernah ditulis sama sekali. Itulah tabel yang
 *      dibaca tab "Riwayat Perkara", dan itulah sebabnya kedua perkara hanya
 *      menampilkan "Pendaftaran Perkara" tanpa nama pejabat yang menunjuk.
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
const kueri = [];
/** MAX(id)+1 yang dijawab penadah, per tabel. */
const idBerikutnya = { perkara_jurusita: 10274, perkara_jadwal_sidang: 20099 };

const dbPath = require.resolve("../db_config");
require("../db_config");
require.cache[dbPath].exports = {
  query: (sql, params, selesai) => {
    const teks = String(sql);
    kueri.push({ sql: teks.replace(/\s+/g, " ").trim(), params: Array.isArray(params) ? params : [] });

    if (/COALESCE\(MAX\(id\), 0\) \+ 1/.test(teks)) {
      const tabel = (/FROM (\w+)/.exec(teks) || [])[1];
      return selesai(null, [{ berikutnya: idBerikutnya[tabel] || 1 }]);
    }
    if (/FROM perkara p\b/.test(teks)) {
      return selesai(null, [{ perkaraId: 10113, nomorPerkara: "561/Pdt.G/2026/PA.Dgl", adaPenetapan: 10113, pmh: "2026-09-12", ppp: null, pjs: null, phs: null }]);
    }
    if (/FROM sys_users/.test(teks)) return selesai(null, [{ username: "Sri Susilowati", fullname: "Sri Susilowati, S.H." }]);
    if (/FROM jurusita/.test(teks)) return selesai(null, [{ id: 30, kode: "JS30", nip: "1987", namaGelar: "Mustini", nama: "Mustini" }]);
    if (/FROM panitera_pn/.test(teks)) return selesai(null, [{ id: 30, kode: "PP30", nip: "1988", namaGelar: "Fikrianto, S.H.", nama: "Fikrianto" }]);
    if (/FROM ruangan_sidang/.test(teks)) return selesai(null, [{ id: 1, nama: "Ruang Sidang 1", keliling: "T" }]);
    if (/information_schema/.test(teks)) {
      // Layanan skema: seluruh tabel yang ditanyakan dianggap ada.
      return selesai(null, [{ TABLE_NAME: "x", COLUMN_NAME: "y" }]);
    }
    if (/NOW\(\)|CURRENT_TIMESTAMP/i.test(teks)) return selesai(null, [{ saat: "2026-09-12 12:00:00" }]);
    return selesai(null, []);
  },
};

// Layanan skema dijawab "ada" untuk seluruh tabel - yang diuji di sini bukan
// pendaftarannya melainkan bentuk pernyataannya.
const skemaPath = require.resolve("../services/sippSkemaService");
const skemaAsli = require("../services/sippSkemaService");
require.cache[skemaPath].exports = {
  ...skemaAsli,
  tabelAda: async () => true,
  muat: async () => ({}),
};

const layanan = require("../services/penetapanTulisService");

const dasar = {
  perkaraId: 10113,
  tanggalPenetapan: "2026-09-12",
  olehUsername: "Sri Susilowati",
  operator: "SUPER ADMIN DERRY",
  ip: "127.0.0.1",
};

/** Langkah pertama pada tabel itu. */
const cari = (rencana, tabel, aksi) =>
  rencana.langkah.find((x) => x.tabel === tabel && (!aksi || x.aksi === aksi));

(async () => {
  console.log("penetapan - id yang dihitung sendiri dan riwayat perkara");

  // ======================================================================
  // 1. perkara_jurusita: id ikut ditulis
  // ======================================================================
  const pjs = await layanan.susunRencanaTulis({ ...dasar, jenis: "pjs", petugasId: 30 });
  periksa("rencana PJS tersusun", pjs.ok === true, pjs.alasan || "");

  const langkahJs = cari(pjs, "perkara_jurusita", "INSERT");
  periksa("INSERT perkara_jurusita menyebut kolom id", Boolean(langkahJs) && /\(\s*id,/.test(langkahJs.sql));
  periksa(
    "id-nya ditandai dihitung sendiri, bukan diserahkan ke basis data",
    Boolean(langkahJs && langkahJs.idDihitung) && langkahJs.idDihitung.tabel === "perkara_jurusita"
  );
  periksa(
    "jumlah tanda tanya sama dengan jumlah nilainya",
    Boolean(langkahJs) && (langkahJs.sql.match(/\?/g) || []).length === langkahJs.params.length,
    langkahJs ? `${(langkahJs.sql.match(/\?/g) || []).length} vs ${langkahJs.params.length}` : ""
  );

  // ======================================================================
  // 2. perkara_jadwal_sidang: id ikut ditulis, dan langkah berikutnya memakainya
  // ======================================================================
  const phs = await layanan.susunRencanaTulis({
    ...dasar,
    jenis: "phs",
    tanggalSidang: "2026-09-22",
    kering: true,
    rantaiSebelum: ["pmh"],
  });
  periksa("rencana PHS tersusun", phs.ok === true, phs.alasan || "");

  const langkahJadwal = cari(phs, "perkara_jadwal_sidang", "INSERT");
  periksa("INSERT perkara_jadwal_sidang menyebut kolom id", Boolean(langkahJadwal) && /\(\s*id,/.test(langkahJadwal.sql));
  periksa("id jadwal sidang ditandai dihitung sendiri", Boolean(langkahJadwal && langkahJadwal.idDihitung));
  periksa(
    "jumlah tanda tanya jadwal sidang sama dengan nilainya",
    Boolean(langkahJadwal) && (langkahJadwal.sql.match(/\?/g) || []).length === langkahJadwal.params.length,
    langkahJadwal ? `${(langkahJadwal.sql.match(/\?/g) || []).length} vs ${langkahJadwal.params.length}` : ""
  );

  const langkahPhs = cari(phs, "perkara_penetapan_hari_sidang", "INSERT");
  periksa("penetapan hari sidang masih menunggu id jadwal sidang", Boolean(langkahPhs && langkahPhs.isiDariLangkah));

  // ======================================================================
  // 3. Riwayat Perkara ditulis pada keempat langkah
  // ======================================================================
  const harusnya = {
    pmh: { prosesId: 20, prosesNama: "Penetapan Majelis Hakim/Hakim" },
    ppp: { prosesId: 30, prosesNama: "Penunjukan Panitera Pengganti" },
    pjs: { prosesId: 40, prosesNama: "Penunjukan Jurusita" },
    phs: { prosesId: 80, prosesNama: "Penetapan Hari Sidang Pertama" },
  };

  for (const [jenis, benar] of Object.entries(harusnya)) {
    const rencana =
      jenis === "pmh"
        ? await layanan.susunRencanaTulis({ ...dasar, jenis, hakimId: [1, 2, 3] })
        : jenis === "phs"
          ? phs
          : jenis === "pjs"
            ? pjs
            : await layanan.susunRencanaTulis({ ...dasar, jenis, petugasId: 30 });

    if (!rencana.ok) {
      // PMH ditolak sebab penadah menjawab pmh sudah ada - itu wajar, dan
      // riwayatnya diuji lewat ketiga yang lain.
      if (jenis === "pmh") {
        periksa("PMH ditolak penadah karena sudah ada (wajar)", rencana.alasan === "pmh_sudah_ada", rencana.alasan);
        continue;
      }
      periksa(`rencana ${jenis.toUpperCase()} tersusun`, false, rencana.alasan);
      continue;
    }

    const riwayat = cari(rencana, "perkara_proses");
    periksa(`${jenis.toUpperCase()} menulis baris Riwayat Perkara`, Boolean(riwayat));
    if (!riwayat) continue;

    periksa(
      `${jenis.toUpperCase()} memakai REPLACE, sama seperti SIPP`,
      /^REPLACE INTO perkara_proses/i.test(riwayat.sql.trim())
    );
    periksa(
      `${jenis.toUpperCase()} proses_id ${benar.prosesId}`,
      riwayat.params[3] === benar.prosesId,
      String(riwayat.params[3])
    );
    periksa(
      `${jenis.toUpperCase()} proses_nama sesuai tulisan SIPP`,
      riwayat.params[4] === benar.prosesNama,
      String(riwayat.params[4])
    );
    periksa(
      `${jenis.toUpperCase()} riwayatnya atas nama PEJABAT, bukan operator`,
      riwayat.params[6] === "Sri Susilowati",
      String(riwayat.params[6])
    );
  }

  // ======================================================================
  // 4. Judul audit berbentuk tulisan SIPP
  // ======================================================================
  const audit = pjs.langkah.filter((x) => x.tabel === "sys_audittrail");
  periksa("PJS menulis beberapa baris audit", audit.length >= 3, String(audit.length));

  const judul = audit.map((x) => String(x.params[6]));
  periksa("judul tidak lagi berawalan [ALETA]", judul.every((x) => !x.startsWith("[ALETA]")), judul[0]);
  periksa(
    "judul menyebut Primary Key seperti SIPP",
    judul.every((x) => /dengan Primary Key \[perkara_id=10113\]$/.test(x)),
    judul[0]
  );
  periksa(
    "judul berbentuk AKSI table <b>x</b> dari halaman <b>y</b>",
    judul.every((x) => /^(INSERT|UPDATE|REPLACE) table <b>\w+<\/b> dari halaman <b>[^<]+<\/b>/.test(x)),
    judul[0]
  );

  // Provenansinya pindah SELURUHNYA ke basis data ALETA - lihat
  // services/jejakAletaService.js. Yang tersisa di sys_audittrail hanya
  // tabel nilai seperti yang ditulis SIPP sendiri.
  const keterangan = audit.map((x) => String(x.params[7]));
  periksa("keterangan tidak menyebut operator ALETA", keterangan.every((x) => !x.includes("SUPER ADMIN DERRY")), "");
  periksa("keterangan tidak memuat penanda ALETA", keterangan.every((x) => !x.includes("[ALETA]")), "");
  periksa(
    "tidak ada ruas audit mana pun yang menyebut ALETA",
    audit.every((x) => !x.params.some((n) => /aleta/i.test(String(n)))),
    ""
  );

  // ======================================================================
  // 5. Penjalannya benar-benar mengisi id dari MAX(id)+1
  // ======================================================================
  kueri.length = 0;
  const hasil = await layanan.jalankanRencana(pjs, { kering: false });
  periksa("rencana PJS berjalan sampai selesai", hasil.ok === true, hasil.alasan || "");

  const kueriId = kueri.find((k) => /COALESCE\(MAX\(id\), 0\) \+ 1 .* FROM perkara_jurusita/.test(k.sql));
  periksa("id berikutnya dibaca dari basis data sesaat sebelum menulis", Boolean(kueriId));

  const kueriInsert = kueri.find((k) => /^INSERT INTO perkara_jurusita/.test(k.sql));
  periksa(
    "id yang ditulis adalah MAX(id)+1, bukan 0",
    Boolean(kueriInsert) && kueriInsert.params[0] === 10274,
    kueriInsert ? String(kueriInsert.params[0]) : ""
  );

  const kueriRiwayat = kueri.find((k) => /^REPLACE INTO perkara_proses/.test(k.sql));
  periksa("baris Riwayat Perkara benar-benar dijalankan", Boolean(kueriRiwayat));

  console.log("");
  console.log(`lulus ${lulus}, gagal ${gagal}`);
  process.exit(gagal > 0 ? 1 : 0);
})().catch((galat) => {
  console.error("GALAT:", galat && galat.stack ? galat.stack : galat);
  process.exit(1);
});
