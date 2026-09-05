"use strict";

/**
 * Penanda perkara: jenis perkara, kumulasi, dan kuasa hukum.
 *
 * ============================================================================
 * MENJALANKAN LOGIKANYA, BUKAN MEMBACA TULISANNYA
 * ============================================================================
 *
 * Pemeriksaan di sini memanggil identitasPerkara sungguhan dengan SIPP palsu,
 * lalu memeriksa jawabannya. Bukan mencocokkan pola tulisan di berkas sumber -
 * pemeriksaan semacam itu gagal setiap kali ada baris disisipkan walau sifat
 * yang dijaga tidak berubah, dan tetap lulus ketika sifatnya rusak asalkan
 * tulisannya masih mirip.
 *
 * Tidak ada jaringan dan tidak ada database: db_config disuntikkan ke cache
 * modul sebelum layanannya dimuat.
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

// --- SIPP palsu -------------------------------------------------------------
//
// Menjawab menurut bentuk kueri, bukan menurut urutan pemanggilan. Layanan
// menembakkan kumulasi dan kuasa bersamaan lewat Promise.all, sehingga urutan
// datangnya tidak dijamin.

let sipp = { perkara: [], kumulasi: [], kuasa: [] };
const kueriTercatat = [];

const dbPath = require.resolve(pathx.resolve(__dirname, "..", "db_config.js"));
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query(sql, params, callback) {
      kueriTercatat.push({ sql, params });
      const teks = String(sql);
      if (teks.includes("FROM perkara p")) return callback(null, sipp.perkara);
      if (teks.includes("perkara_kumulasi")) return callback(null, sipp.kumulasi);
      if (teks.includes("perkara_pengacara")) return callback(null, sipp.kuasa);
      return callback(new Error("kueri tak terduga: " + teks.slice(0, 60)));
    },
  },
};

const layanan = require("../services/sippIdentitasPerkaraService");

const PERKARA = { perkaraId: 620, jenisPerkaraId: 15, jenisPerkaraNama: "Cerai Talak", jenisPerkaraText: "Perdata Gugatan - Cerai Talak" };
const NOMOR = "620/Pdt.G/2025/PA.Dgl";

async function jalan() {
  console.log("\n== Jenis perkara ==");
  {
    sipp = { perkara: [PERKARA], kumulasi: [], kuasa: [] };
    const hasil = await layanan.identitasPerkara(NOMOR);
    periksa("perkara yang ada ditandai ditemukan", hasil.ditemukan === true);
    periksa("jenis perkara terbaca dari SIPP", hasil.jenisPerkara === "Cerai Talak");
    periksa("nama lengkap ikut terbawa", hasil.jenisPerkaraLengkap === "Perdata Gugatan - Cerai Talak");
  }

  console.log("\n== Kumulasi ==");
  {
    sipp = { perkara: [PERKARA], kumulasi: [{ nama: "Harta Bersama" }, { nama: "Hadhanah" }], kuasa: [] };
    const hasil = await layanan.identitasPerkara(NOMOR);
    periksa("kumulasi terbaca seluruhnya", hasil.kumulasi.length === 2);
    periksa("adaKumulasi menyala saat ada kumulasi", hasil.adaKumulasi === true);
  }
  {
    // Sifat yang dijaga: jenis perkara POKOK bukan kumulasi. Bila baris ini
    // ikut terhitung, setiap perkara tampak berkumulasi - penanda yang menyala
    // pada semua perkara tidak memberi tahu apa pun.
    sipp = { perkara: [PERKARA], kumulasi: [{ nama: "Cerai Talak" }], kuasa: [] };
    const hasil = await layanan.identitasPerkara(NOMOR);
    periksa("jenis perkara pokok tidak dihitung sebagai kumulasi", hasil.adaKumulasi === false);
    periksa("daftar kumulasi kosong bila hanya berisi jenis pokok", hasil.kumulasi.length === 0);
  }
  {
    sipp = {
      perkara: [PERKARA],
      kumulasi: [{ nama: "Harta Bersama" }, { nama: "harta bersama" }],
      kuasa: [],
    };
    const hasil = await layanan.identitasPerkara(NOMOR);
    periksa("kumulasi kembar tidak dihitung dua kali", hasil.kumulasi.length === 1);
  }
  {
    sipp = { perkara: [PERKARA], kumulasi: [], kuasa: [] };
    const hasil = await layanan.identitasPerkara(NOMOR);
    periksa("tanpa baris kumulasi berarti tidak berkumulasi", hasil.adaKumulasi === false);
  }

  console.log("\n== Kuasa hukum ==");
  {
    sipp = { perkara: [PERKARA], kumulasi: [], kuasa: [] };
    const hasil = await layanan.identitasPerkara(NOMOR);
    periksa("tanpa kuasa: adaKuasa mati", hasil.adaKuasa === false);
    periksa("tanpa kuasa: kedua sisi mati", hasil.kuasaPenggugat === false && hasil.kuasaTergugat === false);
  }
  {
    sipp = { perkara: [PERKARA], kumulasi: [], kuasa: [{ nama: "Ahmad, S.H.", pihakKe: 1 }] };
    const hasil = await layanan.identitasPerkara(NOMOR);
    periksa("kuasa penggugat dikenali", hasil.kuasaPenggugat === true);
    // Sifat yang dijaga: sisi yang TIDAK berkuasa hukum tidak boleh ikut
    // menyala. Pemberitahuan dialamatkan menurut penanda ini - salah sisi
    // berarti surat dikirim ke orang yang keliru.
    periksa("sisi tanpa kuasa tetap mati", hasil.kuasaTergugat === false);
    periksa("sebutan pihak diterjemahkan", hasil.kuasa[0].pihak === "penggugat");
  }
  {
    sipp = {
      perkara: [PERKARA],
      kumulasi: [],
      kuasa: [{ nama: "Ahmad, S.H.", pihakKe: 1 }, { nama: "Budi, S.H.", pihakKe: 2 }],
    };
    const hasil = await layanan.identitasPerkara(NOMOR);
    periksa("kedua sisi berkuasa hukum dikenali", hasil.kuasaPenggugat === true && hasil.kuasaTergugat === true);
  }
  {
    sipp = { perkara: [PERKARA], kumulasi: [], kuasa: [{ nama: "   ", pihakKe: 1 }] };
    const hasil = await layanan.identitasPerkara(NOMOR);
    periksa("baris kuasa tanpa nama diabaikan", hasil.adaKuasa === false);
  }

  console.log("\n== Perkara tidak ditemukan ==");
  {
    sipp = { perkara: [], kumulasi: [], kuasa: [] };
    const hasil = await layanan.identitasPerkara(NOMOR);
    // Sifat yang dijaga: perkara yang tidak terbaca TIDAK boleh terlihat sama
    // dengan perkara tanpa kuasa. Ekstensi memakai ditemukan untuk memutuskan
    // menggambar penanda atau tidak sama sekali.
    periksa("perkara hilang ditandai tidak ditemukan", hasil.ditemukan === false);
    periksa("nomor perkara tetap dikembalikan", hasil.nomorPerkara === NOMOR);
  }

  console.log("\n== Nomor kosong ==");
  {
    kueriTercatat.length = 0;
    const hasil = await layanan.identitasPerkara("");
    periksa("nomor kosong tidak ditemukan", hasil.ditemukan === false);
    // Sifat yang dijaga: nomor kosong tidak boleh menyentuh SIPP sama sekali.
    periksa("nomor kosong tidak menembak kueri apa pun", kueriTercatat.length === 0);
  }

  console.log("\n== SIPP hanya dibaca ==");
  {
    kueriTercatat.length = 0;
    sipp = { perkara: [PERKARA], kumulasi: [{ nama: "Harta Bersama" }], kuasa: [{ nama: "Ahmad", pihakKe: 1 }] };
    await layanan.identitasPerkara(NOMOR);

    const semuaSelect = kueriTercatat.every((k) => /^\s*SELECT\b/i.test(String(k.sql)));
    periksa("seluruh kueri berupa SELECT", semuaSelect);

    // Sifat yang dijaga: nomor perkara masuk sebagai parameter, tidak pernah
    // disambung ke dalam teks kueri.
    const nomorTidakDisambung = kueriTercatat.every((k) => !String(k.sql).includes(NOMOR));
    periksa("nomor perkara tidak pernah disambung ke teks kueri", nomorTidakDisambung);
    periksa("nomor perkara dikirim sebagai parameter", kueriTercatat.some((k) => (k.params || []).includes(NOMOR)));
  }

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal\n`);
  process.exit(gagal === 0 ? 0 : 1);
}

jalan().catch((galat) => {
  console.error("Gagal dijalankan:", galat);
  process.exit(1);
});
