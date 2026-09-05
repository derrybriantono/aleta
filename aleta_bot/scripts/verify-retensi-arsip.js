"use strict";

/**
 * Retensi arsip: berkas mana yang boleh dihapus, dan mana yang tidak.
 *
 * ============================================================================
 * INI LOGIKA YANG MENGHAPUS BERKAS PERKARA
 * ============================================================================
 *
 * Salah di sini berarti berkas perkara yang masih dibutuhkan hilang, dan
 * menariknya ulang dari e-Court belum tentu masih mungkin. Karena itu
 * pemeriksaannya menjalankan penyaringan sungguhan dengan database palsu, bukan
 * mencocokkan pola tulisan.
 *
 * Sifat yang dijaga:
 *
 *   - masa simpan dihitung dari SELESAINYA perkara, bukan dari unduhannya,
 *   - perkara yang belum selesai tidak pernah masuk daftar hapus,
 *   - SIPP tidak terbaca berarti TIDAK ADA yang dihapus,
 *   - masa simpan 0 berarti tidak menghapus apa pun.
 */

const pathx = require("path");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}`);
  }
}

// --- Database ALETA palsu ---------------------------------------------------

let barisBerkas = [];
const kueriTercatat = [];

const botDbPath = require.resolve(pathx.resolve(__dirname, "..", "services", "botDbService.js"));
require.cache[botDbPath] = {
  id: botDbPath,
  filename: botDbPath,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      kueriTercatat.push({ sql: String(sql), params: params || [] });
      if (/FROM aleta_bot_ecourt_files f/.test(String(sql))) return barisBerkas;
      return [];
    },
    toMysqlDate: (nilai = new Date()) => {
      const w = nilai instanceof Date ? nilai : new Date(nilai);
      const dua = (x) => String(x).padStart(2, "0");
      return `${w.getFullYear()}-${dua(w.getMonth() + 1)}-${dua(w.getDate())} ${dua(w.getHours())}:${dua(w.getMinutes())}:${dua(w.getSeconds())}`;
    },
    fromMysqlDate: (x) => x,
    addColumnIfMissing: async () => {},
    addIndexIfMissing: async () => {},
  },
};

// --- SIPP palsu -------------------------------------------------------------

let keadaanAkhir = {};
let sippGagal = false;

const sippPath = require.resolve(
  pathx.resolve(__dirname, "..", "services", "sippJadwalSidangService.js")
);
require.cache[sippPath] = {
  id: sippPath,
  filename: sippPath,
  loaded: true,
  exports: {
    perkaraFinal: async () => {
      if (sippGagal) throw new Error("koneksi SIPP putus");
      return keadaanAkhir;
    },
  },
};

// --- Skema ALETA palsu ------------------------------------------------------

const storePath = require.resolve(
  pathx.resolve(__dirname, "..", "services", "ecourtStoreService.js")
);
require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: { ensureSchema: async () => {} },
};

// --- Pengaturan palsu -------------------------------------------------------

let masaSimpanBulan = 24;

const konfigPath = require.resolve(pathx.resolve(__dirname, "..", "config", "runtime-config.js"));
require.cache[konfigPath] = {
  id: konfigPath,
  filename: konfigPath,
  loaded: true,
  exports: {
    readRuntimeConfig: () => ({
      ecourtArsip: { minRuangGb: 5, maksBerkasMb: 50, simpanBulan: masaSimpanBulan },
    }),
    writeRuntimeConfig: () => {},
  },
};

const arsip = require("../services/ecourtArsipService");

/** Tanggal N bulan lalu, dalam bentuk YYYY-MM-DD. */
function bulanLalu(jumlah) {
  const w = new Date();
  w.setMonth(w.getMonth() - jumlah);
  const dua = (x) => String(x).padStart(2, "0");
  return `${w.getFullYear()}-${dua(w.getMonth() + 1)}-${dua(w.getDate())}`;
}

function berkas(nomorPerkara, id = "f1") {
  return {
    id,
    document_key: `dk-${id}`,
    format: "pdf",
    jalur_berkas: `/arsip/${id}.pdf`,
    ukuran_byte: 1024 * 1024,
    diunduh_pada: "2020-01-01 00:00:00",
    nomor_perkara: nomorPerkara,
    judul_dokumen: "Gugatan",
  };
}

async function jalan() {
  console.log("\n== Masa simpan belum ditetapkan ==");
  {
    masaSimpanBulan = 0;
    barisBerkas = [berkas("100/Pdt.G/2020/PA.Dgl")];
    keadaanAkhir = { "100/Pdt.G/2020/PA.Dgl": { tanggalBht: "2020-06-01", tanggalMinutasi: "" } };

    const hasil = await arsip.bersihkan({ hapus: false });
    // Sifat yang dijaga: 0 berarti TIDAK MENGHAPUS APA PUN, walau berkasnya
    // sudah bertahun-tahun dan perkaranya sudah lama selesai.
    periksa("masa simpan 0 tidak menghapus apa pun", hasil.aktif === false);
    periksa("sebabnya disebutkan", hasil.alasan === "masa_simpan_belum_ditetapkan");
    masaSimpanBulan = 24;
  }

  console.log("\n== Dihitung dari selesainya perkara ==");
  {
    // Berkas diunduh 2020, TETAPI perkaranya baru BHT bulan lalu.
    barisBerkas = [berkas("200/Pdt.G/2020/PA.Dgl")];
    keadaanAkhir = { "200/Pdt.G/2020/PA.Dgl": { tanggalBht: bulanLalu(1), tanggalMinutasi: "" } };

    const hasil = await arsip.daftarKedaluwarsa({});
    // Inilah cacat yang diperbaiki: dahulu umurnya dihitung dari tanggal
    // unduh, sehingga berkas perkara yang baru selesai ikut terhapus.
    periksa("perkara yang baru selesai tidak dihapus", hasil.daftar.length === 0);
  }
  {
    barisBerkas = [berkas("201/Pdt.G/2018/PA.Dgl")];
    keadaanAkhir = { "201/Pdt.G/2018/PA.Dgl": { tanggalBht: bulanLalu(36), tanggalMinutasi: "" } };

    const hasil = await arsip.daftarKedaluwarsa({});
    periksa("perkara selesai 36 bulan lalu masuk daftar", hasil.daftar.length === 1);
    periksa("dasarnya BHT", hasil.daftar[0].dasarFinal === "bht");
  }
  {
    // BHT kosong: minutasi dipakai sebagai penggantinya.
    barisBerkas = [berkas("202/Pdt.G/2018/PA.Dgl")];
    keadaanAkhir = { "202/Pdt.G/2018/PA.Dgl": { tanggalBht: "", tanggalMinutasi: bulanLalu(30) } };

    const hasil = await arsip.daftarKedaluwarsa({});
    periksa("minutasi dipakai bila BHT kosong", hasil.daftar.length === 1);
    periksa("dasarnya minutasi", hasil.daftar[0].dasarFinal === "minutasi");
  }

  console.log("\n== Perkara yang belum selesai ==");
  {
    // Sifat yang dijaga: perkara yang MASIH BERJALAN tidak pernah dihapus
    // berkasnya, berapa pun umur unduhannya. Berkas itulah yang dibaca majelis.
    barisBerkas = [berkas("300/Pdt.G/2019/PA.Dgl")];
    keadaanAkhir = {};

    const hasil = await arsip.daftarKedaluwarsa({});
    periksa("perkara tanpa catatan putusan tidak dihapus", hasil.daftar.length === 0);
  }
  {
    barisBerkas = [berkas("301/Pdt.G/2019/PA.Dgl")];
    keadaanAkhir = { "301/Pdt.G/2019/PA.Dgl": { tanggalBht: "", tanggalMinutasi: "" } };

    const hasil = await arsip.daftarKedaluwarsa({});
    periksa("putusan tanpa BHT dan tanpa minutasi tidak dihapus", hasil.daftar.length === 0);
  }

  console.log("\n== SIPP tidak terbaca: gagal-tertutup ==");
  {
    sippGagal = true;
    barisBerkas = [berkas("400/Pdt.G/2015/PA.Dgl")];
    keadaanAkhir = { "400/Pdt.G/2015/PA.Dgl": { tanggalBht: bulanLalu(96), tanggalMinutasi: "" } };

    const daftar = await arsip.daftarKedaluwarsa({});
    // Sifat yang dijaga: tidak dapat dipastikan berarti TIDAK DIHAPUS - bukan
    // "dihapus dengan asumsi sudah selesai". Penghapusan tidak dapat ditarik
    // kembali.
    periksa("SIPP gagal: tidak ada yang masuk daftar", daftar.daftar.length === 0);
    periksa("sebabnya disebutkan", /sipp_tidak_terbaca/.test(daftar.alasan));

    const hasil = await arsip.bersihkan({ hapus: true });
    periksa("pembersihan tidak menghapus apa pun", hasil.terhapus === 0);
    // Pembersihan yang diam-diam tidak menghapus apa pun akan dikira berhasil.
    periksa("dan mengatakan sebabnya", /sipp_tidak_terbaca/.test(hasil.alasan));
    sippGagal = false;
  }

  console.log("\n== Kueri hanya mengambil calon yang sah ==");
  {
    kueriTercatat.length = 0;
    barisBerkas = [];
    keadaanAkhir = {};
    await arsip.daftarKedaluwarsa({});

    const kueri = kueriTercatat.map((k) => k.sql).join(" ");
    // Berkas yang sudah dihapus karena retensi tidak boleh diambil lagi.
    periksa("melewati berkas yang sudah dihapus retensi", /dihapus_retensi IS NULL/.test(kueri));
    // Dua syarat lama tetap berlaku.
    periksa("hanya dokumen terverifikasi", /status_verifikasi = 'valid'/.test(kueri));
    periksa("hanya yang sudah diberitahukan", /diberitahukan_pada IS NOT NULL/.test(kueri));
    periksa("hanya yang jalurnya masih terisi", /jalur_berkas <> ''/.test(kueri));
  }

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal\n`);
  process.exit(gagal === 0 ? 0 : 1);
}

jalan().catch((galat) => {
  console.error("Gagal dijalankan:", galat);
  process.exit(1);
});
