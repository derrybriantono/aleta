"use strict";

/**
 * ============================================================================
 * UJI SATU-SATUNYA JALUR TULIS ALETA KE SIPP
 * ============================================================================
 *
 * Berkas yang diuji di sini menulis ke basis data pengadilan yang sedang
 * dipakai. Karena itu ujinya TIDAK menyentuh SIPP sama sekali: db_config
 * digantikan tiruan yang merekam tiap pernyataan, sehingga yang diperiksa
 * adalah pernyataan apa yang akan dikirim - bukan akibatnya.
 *
 * Yang dijaga di sini bukan "kodenya jalan", melainkan hal-hal yang bila
 * terbalik tidak menimbulkan galat apa pun:
 *
 *   - bawaannya KERING; menulis menuntut permintaan tegas
 *   - yang tercatat sebagai pengisi adalah PEJABAT, bukan operator
 *   - operatornya tetap tercatat, di judul baris audit
 *   - tidak ada tabel di luar daftar putih yang tersentuh
 *   - penetapan yang sudah ada tidak ditimpa diam-diam
 */

const Module = require("module");

let jumlah = 0;
let gagal = 0;

function cek(nama, dapat, harap) {
  jumlah += 1;
  if (JSON.stringify(dapat) !== JSON.stringify(harap)) {
    gagal += 1;
    console.log(`  GAGAL: ${nama}`);
    console.log(`         diharap ${JSON.stringify(harap)}, didapat ${JSON.stringify(dapat)}`);
  }
}

function benar(nama, syarat) {
  cek(nama, Boolean(syarat), true);
}

/**
 * Basis data tiruan.
 *
 * Menjawab kueri baca yang dipakai penyusun rencana, dan MEREKAM tiap
 * pernyataan tulis tanpa menjalankannya.
 */
function buatDb({ perkara = {}, akun = true, hakim = [], petugas = null, ruangan = null } = {}) {
  const direkam = [];
  return {
    direkam,
    query(sql, params, callback) {
      direkam.push({ sql: String(sql), params });

      if (/FROM perkara p/i.test(sql)) {
        return callback(null, perkara ? [perkara] : []);
      }
      if (/FROM sys_users/i.test(sql)) {
        return callback(null, akun ? [{ username: params[0], fullname: `${params[0]} lengkap` }] : []);
      }
      if (/FROM hakim_pn/i.test(sql)) {
        return callback(null, hakim);
      }
      if (/FROM ruangan_sidang/i.test(sql)) {
        return callback(null, ruangan ? [ruangan] : []);
      }
      if (/FROM (panitera_pn|jurusita)\b/i.test(sql)) {
        return callback(null, petugas ? [petugas] : []);
      }
      if (/information_schema/i.test(sql)) {
        // sippSkemaService.tabelAda - seluruh tabel dianggap ada.
        return callback(null, [{ tabel: "perkara_panitera_pn", kolom: "id" }]);
      }
      return callback(null, []);
    },
  };
}

function muat(dbTiruan) {
  const jalurDb = require.resolve("../db_config");
  const jalurTulis = require.resolve("../services/penetapanTulisService");
  const jalurSkema = require.resolve("../services/sippSkemaService");
  for (const jalur of [jalurDb, jalurTulis, jalurSkema]) delete require.cache[jalur];
  require.cache[jalurDb] = new Module(jalurDb, null);
  require.cache[jalurDb].filename = jalurDb;
  require.cache[jalurDb].loaded = true;
  require.cache[jalurDb].exports = dbTiruan;

  const skema = require("../services/sippSkemaService");
  // tabelAda dipaksa benar: yang diuji bentuk pernyataannya, bukan pengenalan
  // skema - itu sudah punya ujinya sendiri.
  skema.tabelAda = async () => true;

  return require("../services/penetapanTulisService");
}

const HAKIM = [
  { hakimId: 26, kode: "C1", nip: "111", nama: "Himawan Tatura Wijaya, S.H.I.,M.H." },
  { hakimId: 28, kode: "C2", nip: "222", nama: "Idris, S.H.I., M.H." },
  { hakimId: 31, kode: "C3", nip: "333", nama: "Derry Briantono, S.H." },
];

const PERKARA_KOSONG = {
  perkaraId: 9909,
  nomorPerkara: "399/Pdt.G/2026/PA.Dgl",
  adaPenetapan: null,
  pmh: null,
  ppp: null,
  pjs: null,
};

async function utama() {
  console.log("");
  console.log("Uji jalur tulis penetapan ke SIPP");
  console.log("");

  // -------------------------------------------------------------------------
  console.log("PMH - bentuk pernyataannya");

  const db1 = buatDb({ perkara: PERKARA_KOSONG, hakim: HAKIM });
  const tulis = muat(db1);
  const rencana = await tulis.susunRencanaTulis({
    jenis: "pmh",
    perkaraId: 9909,
    tanggalPenetapan: "2026-09-08",
    hakimId: [26, 28, 31],
    olehUsername: "fahri",
    operator: "meja1g",
    ip: "192.168.9.66",
  });

  cek("rencana tersusun", rencana.ok, true);
  cek("atas nama pejabatnya", rencana.atasNama.username, "fahri");
  cek("operatornya tercatat", rencana.operator, "meja1g");

  const tabel = rencana.langkah.map((x) => `${x.tabel}:${x.aksi}`);
  cek("penetapan disisipkan", tabel.includes("perkara_penetapan:INSERT"), true);
  cek("tiga baris hakim", tabel.filter((x) => x === "perkara_hakim_pn:INSERT").length, 3);
  cek("tabel perkara diperbarui", tabel.includes("perkara:UPDATE"), true);
  cek(
    "audit satu per langkah",
    tabel.filter((x) => x === "sys_audittrail:INSERT").length,
    5
  );

  const barisPenetapan = rencana.langkah.find((x) => x.tabel === "perkara_penetapan");
  benar("id majelis dipisah koma", barisPenetapan.params.includes("26,28,31"));
  benar("kode majelis dipisah garis tegak", barisPenetapan.params.includes("C1|C2|C3"));
  benar(
    "teks majelis menyebut jabatannya",
    barisPenetapan.params.some((x) => String(x).startsWith("Hakim Ketua: Himawan"))
  );

  const ketua = rencana.langkah.find(
    (x) => x.tabel === "perkara_hakim_pn" && x.params.includes("Hakim Ketua")
  );
  benar("ketua ber-jabatan_hakim_id 1", ketua.params.includes(1));
  benar("NIP ikut ditulis", ketua.params.includes("111"));
  benar("barisnya aktif", ketua.params.includes("Y"));

  const audit = rencana.langkah.filter((x) => x.tabel === "sys_audittrail");
  benar(
    "audit atas nama pejabat",
    audit.every((x) => x.params[2] === "fahri")
  );
  benar(
    "audit menandai ALETA",
    audit.every((x) => String(x.params[6]).startsWith("[ALETA]"))
  );
  benar(
    "audit menyebut operatornya",
    audit.every((x) => String(x.params[6]).includes("meja1g"))
  );
  benar(
    "keterangan audit berbentuk tabel SIPP",
    audit.every((x) => String(x.params[7]).includes("<th>Nama Kolom</th>"))
  );

  // -------------------------------------------------------------------------
  console.log("Kering - tidak menulis apa pun kecuali diminta");

  const sebelum = db1.direkam.length;
  const kering = await tulis.jalankanRencana(rencana);
  cek("bawaannya kering", kering.kering, true);
  cek("tidak ada pernyataan baru", db1.direkam.length, sebelum);
  cek("jumlah langkah dilaporkan", kering.jumlahLangkah, rencana.langkah.length);

  const basah = await tulis.jalankanRencana(rencana, { kering: false });
  cek("menulis ketika diminta tegas", basah.kering, false);
  cek("seluruh langkah dijalankan", basah.jumlahLangkah, rencana.langkah.length);
  benar("pernyataan benar-benar dikirim", db1.direkam.length > sebelum);

  // -------------------------------------------------------------------------
  console.log("Penolakan - yang tidak boleh dikerjakan");

  const tolak = async (nama, minta, alasan) => {
    const db = buatDb({ perkara: PERKARA_KOSONG, hakim: HAKIM, ...(minta._db || {}) });
    const t = muat(db);
    const hasil = await t.susunRencanaTulis({
      jenis: "pmh",
      perkaraId: 9909,
      tanggalPenetapan: "2026-09-08",
      hakimId: [26, 28, 31],
      olehUsername: "fahri",
      operator: "meja1g",
      ...minta,
    });
    cek(nama, hasil.alasan, alasan);
  };

  await tolak("jenis tak dikenal ditolak", { jenis: "xyz" }, "jenis_tidak_didukung");
  await tolak("tanggal ngawur ditolak", { tanggalPenetapan: "kemarin" }, "tanggal_penetapan_tidak_sah");
  await tolak("operator wajib disebut", { operator: "" }, "operator_tidak_disebut");
  await tolak(
    "akun pejabat harus ada di SIPP",
    { _db: { akun: false } },
    "akun_pejabat_tidak_ketemu"
  );
  // Sebabnya disebut dengan namanya sendiri: "hakim kembar" dapat dibetulkan
  // petugas, sedangkan "sebagian tidak ketemu" mengirimnya mencari kesalahan
  // pada daftar hakim yang sebenarnya tidak apa-apa.
  await tolak("hakim kembar ditolak", { hakimId: [26, 26, 31] }, "hakim_kembar");
  await tolak(
    "PMH yang sudah ada tidak ditimpa",
    { _db: { perkara: { ...PERKARA_KOSONG, pmh: "2026-07-07" } } },
    "pmh_sudah_ada"
  );

  // -------------------------------------------------------------------------
  console.log("PHS - empat tabel, dan satu yang menunggu id");

  const PERKARA_ADA_PMH = { ...PERKARA_KOSONG, adaPenetapan: 9909, pmh: "2026-09-01" };
  const dbPhs = buatDb({ perkara: PERKARA_ADA_PMH, ruangan: { id: 1, nama: "Ruang Sidang 1 Dalam Gedung", keliling: 0 } });
  const tulisPhs = muat(dbPhs);
  const rencanaPhs = await tulisPhs.susunRencanaTulis({
    jenis: "phs",
    perkaraId: 9909,
    tanggalPenetapan: "2026-09-01",
    tanggalSidang: "2026-09-22",
    ruanganId: 1,
    olehUsername: "sudarmin",
    operator: "meja1g",
    ip: "192.168.9.66",
  });

  cek("rencana PHS tersusun", rencanaPhs.ok, true);
  const tabelPhs = rencanaPhs.langkah.map((x) => `${x.tabel}:${x.aksi}`);
  cek("jadwal sidang disisipkan", tabelPhs.includes("perkara_jadwal_sidang:INSERT"), true);
  cek(
    "penetapan hari sidang disisipkan",
    tabelPhs.includes("perkara_penetapan_hari_sidang:INSERT"),
    true
  );
  cek("penetapan diperbarui", tabelPhs.includes("perkara_penetapan:UPDATE"), true);
  cek("tabel perkara diperbarui", tabelPhs.includes("perkara:UPDATE"), true);

  const barisPhs = rencanaPhs.langkah.find((x) => x.tabel === "perkara_penetapan_hari_sidang");
  benar("menunggu id jadwal sidang", Boolean(barisPhs.isiDariLangkah));
  cek("id-nya diisi di tempat yang benar", barisPhs.params[barisPhs.isiDariLangkah.posisiParam], null);
  benar(
    "langkah rujukannya memang jadwal sidang",
    rencanaPhs.langkah[barisPhs.isiDariLangkah.indeks].tabel === "perkara_jadwal_sidang"
  );

  const jadwal = rencanaPhs.langkah.find((x) => x.tabel === "perkara_jadwal_sidang");
  benar("ruangnya dibaca dari acuannya", jadwal.params.includes("Ruang Sidang 1 Dalam Gedung"));
  benar("bukan sidang keliling", jadwal.params.filter((x) => x === "T").length >= 4);

  // Langkah yang menunggu id BERHENTI bila id itu tidak ada - tidak menulis
  // null. Baris penetapan hari sidang yang tidak menunjuk jadwal sidang mana
  // pun lebih buruk daripada tidak ada baris sama sekali.
  const rencanaPincang = {
    ok: true,
    langkah: [
      {
        tabel: "perkara_penetapan_hari_sidang",
        aksi: "INSERT",
        sql: "INSERT INTO perkara_penetapan_hari_sidang (perkara_id) VALUES (?)",
        params: [1, 2, null],
        isiDariLangkah: { indeks: 99, posisiParam: 2 },
      },
    ],
  };
  const pincang = await tulisPhs.jalankanRencana(rencanaPincang, { kering: false });
  cek("berhenti bila id rujukannya tidak ada", pincang.alasan, "id_langkah_sebelumnya_tidak_ada");

  const tolakPhs = async (nama, minta, alasan) => {
    const db = buatDb({
      perkara: PERKARA_ADA_PMH,
      ruangan: { id: 1, nama: "Ruang Sidang 1", keliling: 0 },
      ...(minta._db || {}),
    });
    const t = muat(db);
    const hasil = await t.susunRencanaTulis({
      jenis: "phs",
      perkaraId: 9909,
      tanggalPenetapan: "2026-09-01",
      tanggalSidang: "2026-09-22",
      ruanganId: 1,
      olehUsername: "sudarmin",
      operator: "meja1g",
      ...minta,
    });
    cek(nama, hasil.alasan, alasan);
  };

  // Hari sidang ditetapkan ketua majelis - selama majelisnya belum ada, tidak
  // ada yang berwenang menetapkannya.
  await tolakPhs(
    "PHS ditolak sebelum PMH ada",
    { _db: { perkara: PERKARA_KOSONG } },
    "pmh_belum_ada"
  );
  await tolakPhs(
    "sidang tidak boleh mendahului penetapannya",
    { tanggalSidang: "2026-08-01" },
    "sidang_mendahului_penetapan"
  );
  await tolakPhs("ruang harus ada", { _db: { ruangan: null } }, "ruangan_tidak_ketemu");
  await tolakPhs(
    "PHS yang sudah ada tidak ditimpa",
    { _db: { perkara: { ...PERKARA_ADA_PMH, phs: "2026-09-01" } } },
    "phs_sudah_ada"
  );

  // -------------------------------------------------------------------------
  console.log("Jam - diambil dari basis data, bukan dari container");

  // Tertangkap pada hasil kering pertama atas perkara sungguhan: pernyataan
  // bertanggal 04:54 sedangkan jam dinding pengadilan 12:54. Container memuat
  // /etc/localtime dan `date` di dalamnya benar, tetapi Node jatuh ke UTC
  // karena env TZ tidak diset - tanpa satu pun galat.
  const dbJam = buatDb({ perkara: PERKARA_KOSONG, hakim: HAKIM });
  const tulisJam = muat(dbJam);
  await tulisJam.susunRencanaTulis({
    jenis: "pmh",
    perkaraId: 9909,
    tanggalPenetapan: "2026-09-08",
    hakimId: [26, 28, 31],
    olehUsername: "fahri",
    operator: "meja1g",
  });
  benar(
    "jamnya ditanyakan ke basis data",
    dbJam.direkam.some((x) => /DATE_FORMAT\(NOW\(\)/i.test(x.sql))
  );

  // -------------------------------------------------------------------------
  console.log("Daftar putih tabel");

  const diluar = rencana.langkah.filter((x) => !tulis.DAFTAR_TABEL.has(x.tabel));
  cek("tidak ada tabel di luar daftar", diluar.length, 0);

  const palsu = { ok: true, langkah: [{ tabel: "sys_users", aksi: "UPDATE", sql: "x", params: [] }] };
  const ditolak = await tulis.jalankanRencana(palsu, { kering: false });
  cek("tabel liar ditolak saat dijalankan", ditolak.alasan, "tabel_di_luar_daftar");

  // -------------------------------------------------------------------------
  console.log("");
  if (gagal > 0) {
    console.log(`Hasil: ${jumlah - gagal} lulus, ${gagal} GAGAL`);
    process.exit(1);
  }
  console.log(`Hasil: ${jumlah} lulus, 0 gagal`);
}

utama().catch((galat) => {
  console.error("GALAT:", galat.message);
  process.exit(1);
});
