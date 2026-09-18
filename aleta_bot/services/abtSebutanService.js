"use strict";

/**
 * ============================================================================
 * MENGURAIKAN SEBUTAN #nnnn# MILIK ABT
 * ============================================================================
 *
 * Blangko ABT - relaas, berita acara sidang, dan seluruh produk lainnya -
 * ditulis sebagai naskah biasa yang disela sebutan bernomor: #0001# nomor
 * perkara, #7059# jam sidang, #7109# identitas pihak. Artinya TIDAK ditebak di
 * sini: ABT menyimpan kamusnya sendiri pada tabel `abt_variabel`, dan tiap
 * baris menyebutkan dari mana nilainya datang.
 *
 * Diperiksa pada kamus PA Donggala, 1.271 sebutan; yang dipakai enam blangko
 * relaas dan 25 blangko berita acara sidang berjumlah 225, dan seluruhnya
 * terdefinisi. Cara pengambilannya:
 *
 *   data_sql       158   kuerinya tersimpan di kamus - tinggal dijalankan
 *   data_teks       25   diketik petugas
 *   data_sipp       15   langsung dari satu kolom SIPP
 *   tanya_jawab      6   dari mesin tanya-jawab
 *   multi_sidang     4   nilai yang berbeda tiap sidang
 *   data_tanggal     4   tanggal yang dipilih petugas
 *   terbilang        2   angka menjadi huruf
 *
 * ============================================================================
 * BERSARANG, DAN KARENA ITU HARUS BERPUTAR
 * ============================================================================
 *
 * Nilai sebuah sebutan kerap memuat sebutan lain. #7109# memulangkan satu
 * paragraf identitas pihak yang di dalamnya masih ada #0102#, #0103#, #0024#,
 * #0104#, #0105#. Kuerinya sendiri pun menyebut sebutan: #1258# memilih
 * bunyinya menurut isi #0163#.
 *
 * Karena itu penguraian berputar sampai tidak ada lagi sebutan yang tersisa -
 * dengan dua pagar: kedalaman dibatasi, dan sebutan yang sedang diuraikan
 * tidak boleh menguraikan dirinya sendiri. Blangko yang saling menunjuk akan
 * berhenti dengan sebutannya dibiarkan apa adanya, bukan menggantung selamanya.
 *
 * ============================================================================
 * KUERI ORANG LAIN DIJALANKAN DI BALIK PAGAR
 * ============================================================================
 *
 * Seratus lima puluh delapan kueri itu ditulis di luar ALETA, oleh orang lain,
 * bertahun-tahun yang lalu. Menjalankannya apa adanya berarti menyerahkan
 * sambungan basis data pengadilan kepada teks yang tidak pernah ditinjau
 * siapa pun di sini. Pagarnya karena itu tegas dan diperiksa SEBELUM satu pun
 * kueri dikirim:
 *
 *   - harus dibuka kata SELECT, dan hanya satu pernyataan;
 *   - kata yang mengubah atau memindahkan data ditolak seluruhnya, termasuk
 *     INTO OUTFILE dan LOAD_FILE yang menulis dan membaca berkas peladen;
 *   - #perkara_id# diganti BILANGAN yang sudah diperiksa, bukan teks yang
 *     diteruskan begitu saja;
 *   - hasilnya dipotong, supaya satu kueri yang keliru tidak menarik seluruh
 *     tabel ke dalam nama berkas.
 *
 * Yang ditolak TIDAK diam-diam dikosongkan: sebutannya dibiarkan apa adanya
 * di naskah, sehingga yang membacanya melihat ada yang tidak terisi.
 */

const db = require("../db_config");

/** Kedalaman penguraian - #7109# menuju #0102# menuju #0046# sudah tiga. */
const KEDALAMAN_MAKSIMUM = 8;
/** Panjang nilai satu sebutan. Naskah terpanjang yang terukur 1.900 aksara. */
const PANJANG_NILAI_MAKSIMUM = 8000;
/** Kata yang tidak boleh ada di dalam kueri kamus, apa pun alasannya. */
/**
 * REPLACE disebut sebagai PERNYATAAN, bukan sebagai fungsi.
 *
 * MySQL punya dua REPLACE yang berbeda sama sekali: `REPLACE INTO` yang
 * menimpa baris, dan `REPLACE(teks, cari, ganti)` yang mengganti aksara.
 * Pagar yang menolak kata "replace" begitu saja menutup keduanya - dan
 * terukur pada kamus PA Donggala, satu-satunya yang tersandung justru yang
 * tidak berbahaya: #8011# Kota/Kabupaten Satker, yang memotong kata "Kab."
 * dari nama satker dengan REPLACE(). Yang ditolak karena itu `REPLACE INTO`
 * saja.
 */
const KATA_TERLARANG =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|replace\s+into|replace\s+delayed|replace\s+low_priority|rename|call|handler|lock|into\s+outfile|into\s+dumpfile|load_file|load\s+data|sleep|benchmark)\b/i;

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

/**
 * Kamus sebutan, dibaca sekali lalu diingat.
 *
 * Kamusnya 1.271 baris dan berubah hanya ketika petugas menyuntingnya di ABT -
 * membacanya ulang tiap sebutan berarti 225 perjalanan ke basis data untuk
 * satu lembar relaas.
 */
let kamusPromise = null;
let kamusSaat = 0;
/** Umur ingatan kamus - satu jam. */
const UMUR_KAMUS_MS = 60 * 60 * 1000;

function lupakanKamus() {
  kamusPromise = null;
  kamusSaat = 0;
}

async function kamus() {
  if (kamusPromise && Date.now() - kamusSaat < UMUR_KAMUS_MS) return kamusPromise;
  kamusSaat = Date.now();
  kamusPromise = kueri(
    `SELECT no_var, nama, data_type, data_tabel, data_kolom, sql_query, default_data
       FROM ${skemaAbt()}.abt_variabel`
  )
    .then((baris) => {
      const peta = new Map();
      for (const b of Array.isArray(baris) ? baris : []) {
        peta.set(String(b.no_var || "").trim(), {
          nama: String(b.nama || ""),
          jenis: String(b.data_type || ""),
          tabel: String(b.data_tabel || ""),
          kolom: String(b.data_kolom || ""),
          sql: bersihkanBarisBaru(b.sql_query),
          bawaan: String(b.default_data || ""),
        });
      }
      return peta;
    })
    .catch((galat) => {
      lupakanKamus();
      throw galat;
    });
  return kamusPromise;
}

/**
 * Skema ABT disebut TEGAS, bukan diwariskan dari sambungan.
 *
 * Sambungan bot menunjuk skema SIPP; kamus sebutan hidup di skema ABT yang
 * berbeda. Membiarkannya ikut sambungan berarti kueri kamus mencari tabel di
 * tempat yang salah - dan tabel yang tidak ada dijawab "tidak ada" tanpa galat
 * yang menjelaskan apa pun.
 */
function skemaAbt() {
  const nama = String(process.env.ALETA_ABT_SKEMA || "aps_badilag").trim();
  if (!/^[A-Za-z0-9_]+$/.test(nama)) throw new Error("nama skema ABT tidak sah");
  return nama;
}

/** Kamus menyimpan baris baru sebagai dua aksara "\" dan "n". */
function bersihkanBarisBaru(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).replace(/\\n/g, "\n");
}

/** Sebutan yang ada di dalam satu teks - tanpa ganda. */
function sebutanDi(teks) {
  return [...new Set(String(teks || "").match(/#\d{3,4}#/g) || [])];
}

/**
 * ============================================================================
 * YANG DI DALAM TANDA KUTIP ITU NASKAH, BUKAN PERNYATAAN
 * ============================================================================
 *
 * Pagar pertama membaca titik koma di mana pun ia berdiri. Diukur atas 225
 * sebutan yang dipakai korpus relaas dan BAS, perkara 567/Pdt.G/2026/PA.Dgl:
 * DUA PULUH TIGA kueri ditolak, dan hampir seluruhnya dengan sebab yang sama -
 * "lebih dari satu pernyataan".
 *
 * Tidak satu pun benar. Kueri ABT memulangkan PARAGRAF, dan paragraf hukum
 * penuh titik koma:
 *
 *   '<li>Bahwa terhadap putusan tersebut ... Pasal 153 ayat (1) RBg;
 *    <li>Pemberitahuan isi putusan ini saya laksanakan ...;'
 *
 * Titik koma itu ada DI DALAM tanda kutip - ia bagian naskah, bukan pemisah
 * pernyataan. Pagar yang menolaknya menutup 23 dari 225 sebutan, termasuk
 * #7108# dan #7109# yang menyusun identitas pihak pada tiap relaas.
 *
 * Karena itu isi tanda kutip dibuang LEBIH DAHULU, baru sisanya diperiksa.
 * Yang dibuang bukan diabaikan: ia memang data, dan data tidak pernah menjadi
 * pernyataan kedua. Yang tersisa - kerangka kuerinya sendiri - diperiksa
 * seketat sebelumnya.
 */
function tanpaTeksBerkutip(sql) {
  // Kutip tunggal, ganda, dan pelolosnya. Tiga hal yang harus ikut termuat di
  // dalam kutip, dan yang ketiga pernah tertinggal: aksara biasa. Tanpa
  // [^'\\] pola ini hanya cocok pada kutip yang isinya melulu pelolos -
  // artinya hampir tidak pernah - sehingga "…ruang sidang; <br>…" tidak
  // terbaca sebagai naskah dan titik komanya dihitung sebagai pernyataan
  // kedua. Terukur: ke-23 kueri yang ditolak tetap ditolak setelah pola
  // pertama dipasang, dan barulah lolos sesudah aksara biasa ikut disebut.
  //
  // Backslash di dalam kutip MySQL meloloskan aksara berikutnya, termasuk
  // kutip penutupnya; '' dan "" adalah kutip yang digandakan.
  return String(sql).replace(/'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.|"")*"/g, "''");
}

/**
 * Memeriksa satu kueri kamus sebelum ia dikirim ke basis data.
 *
 * @returns {string} alasan penolakan, atau "" bila lolos.
 */
function alasanTolakKueri(sql) {
  const teks = String(sql || "").trim();
  if (!teks) return "kueri kosong";
  if (!/^select\b/i.test(teks)) return "bukan dibuka SELECT";
  // Diperiksa atas KERANGKANYA - isi tanda kutip dibuang lebih dahulu.
  const kerangka = tanpaTeksBerkutip(teks).replace(/;\s*$/, "");
  // Titik koma pada kerangka berarti pernyataan kedua: jalan paling tua untuk
  // menyelipkan perintah lain.
  if (kerangka.includes(";")) return "lebih dari satu pernyataan";
  const terlarang = kerangka.match(KATA_TERLARANG);
  if (terlarang) return `memuat kata terlarang "${terlarang[0]}"`;
  return "";
}

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * ============================================================================
 * TANGGAL DITULIS DALAM BAHASA INDONESIA, BUKAN BAHASA PENGGERAK
 * ============================================================================
 *
 * Penggerak mysql memulangkan kolom DATE sebagai obyek Date JavaScript.
 * String() atasnya menghasilkan "Mon Sep 14 2026 00:00:00 GMT+0000
 * (Coordinated Universal Time)" - dan itulah yang terbaca pada #0017# ketika
 * penguraian diukur atas perkara 567. Kalimat Inggris berikut zona waktu, di
 * tengah relaas berbahasa Indonesia yang dibacakan kepada pihak.
 */
function bentukNilai(nilai) {
  if (nilai === null || nilai === undefined) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    return `${nilai.getDate()} ${BULAN[nilai.getMonth()]} ${nilai.getFullYear()}`;
  }
  return String(nilai);
}

/** Nilai satu sebutan yang diambil langsung dari satu kolom SIPP. */
async function dariKolomSipp(def, perkaraId) {
  if (!/^[A-Za-z0-9_]+$/.test(def.tabel) || !/^[A-Za-z0-9_]+$/.test(def.kolom)) return "";
  const baris = await kueri(
    `SELECT \`${def.kolom}\` AS data FROM \`${def.tabel}\` WHERE perkara_id = ? LIMIT 1`,
    [perkaraId]
  ).catch(() => []);
  return bentukNilai(Array.isArray(baris) && baris[0] ? baris[0].data : "");
}

/** Nilai satu sebutan yang datang dari kueri kamus. */
async function dariKueriKamus(sqlTerurai, perkaraId) {
  const alasan = alasanTolakKueri(sqlTerurai);
  if (alasan) return { nilai: "", ditolak: alasan };
  const sql = sqlTerurai.replace(/;\s*$/, "").replace(/#perkara_id#/gi, String(perkaraId));
  const baris = await kueri(sql).catch((galat) => {
    return { galat: String((galat && galat.message) || galat).slice(0, 160) };
  });
  if (baris && baris.galat) return { nilai: "", ditolak: `kueri gagal: ${baris.galat}` };
  const satu = Array.isArray(baris) && baris[0] ? baris[0] : null;
  if (!satu) return { nilai: "", ditolak: "" };
  const nilai = satu.data !== undefined ? satu.data : Object.values(satu)[0];
  return { nilai: bentukNilai(nilai).slice(0, PANJANG_NILAI_MAKSIMUM), ditolak: "" };
}

/**
 * Nilai satu sebutan - sebelum sebutan di dalamnya ikut diuraikan.
 *
 * `isian` memuat yang memang milik petugas: data_teks, data_tanggal, dan
 * tanya_jawab. Yang tidak diisi dibiarkan kosong, bukan dikarang.
 */
async function nilaiMentah(kode, def, perkaraId, isian) {
  if (Object.prototype.hasOwnProperty.call(isian, kode)) return { nilai: String(isian[kode] ?? ""), ditolak: "" };

  switch (def.jenis) {
    case "data_sipp":
      return { nilai: await dariKolomSipp(def, perkaraId), ditolak: "" };
    case "data_sql":
      return dariKueriKamus(def.sql, perkaraId);
    case "data_teks":
    case "data_tanggal":
    case "tanya_jawab":
    case "multi_sidang":
      // Milik petugas atau milik sidangnya - bukan milik basis data. Yang
      // belum diisi tetap kosong; blangko yang mengarang tanggal jauh lebih
      // berbahaya daripada blangko yang terlihat belum lengkap.
      return { nilai: String(def.bawaan || ""), ditolak: "" };
    default:
      return { nilai: String(def.bawaan || ""), ditolak: "" };
  }
}

/**
 * Menguraikan seluruh sebutan di dalam satu naskah.
 *
 * @param {string} naskah      teks blangko
 * @param {number} perkaraId
 * @param {object} pilihan     { isian, batasKedalaman }
 * @returns {Promise<{ naskah: string, terurai: number, tersisa: string[], ditolak: object[] }>}
 */
async function uraikan(naskah, perkaraId, pilihan = {}) {
  const id = Number(perkaraId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("perkara_id harus bilangan bulat positif");

  const isian = (pilihan && pilihan.isian) || {};
  const batas = Math.max(1, Math.min(KEDALAMAN_MAKSIMUM, Number(pilihan.batasKedalaman) || KEDALAMAN_MAKSIMUM));
  const peta = await kamus();

  const sudah = new Map();
  const ditolak = [];
  let teks = String(naskah || "");

  for (let putaran = 0; putaran < batas; putaran += 1) {
    const kode = sebutanDi(teks).filter((k) => !sudah.has(k));
    if (kode.length === 0) break;

    for (const tanda of kode) {
      const nomor = tanda.replace(/#/g, "");
      const def = peta.get(nomor);
      if (!def) {
        // Tidak ada di kamus: dibiarkan apa adanya supaya terlihat, dan
        // ditandai supaya dapat ditelusuri.
        sudah.set(tanda, null);
        ditolak.push({ kode: tanda, alasan: "tidak ada di kamus" });
        continue;
      }
      let hasil;
      try {
        hasil = await nilaiMentah(nomor, def, id, isian);
      } catch (galat) {
        hasil = { nilai: "", ditolak: String((galat && galat.message) || galat).slice(0, 160) };
      }
      if (hasil.ditolak) ditolak.push({ kode: tanda, nama: def.nama, alasan: hasil.ditolak });
      sudah.set(tanda, hasil.nilai);
    }

    let berubah = false;
    for (const [tanda, nilai] of sudah) {
      if (nilai === null || !teks.includes(tanda)) continue;
      teks = teks.split(tanda).join(nilai);
      berubah = true;
    }
    if (!berubah) break;
  }

  return {
    naskah: teks,
    terurai: [...sudah.values()].filter((x) => x !== null).length,
    tersisa: sebutanDi(teks),
    ditolak,
  };
}

module.exports = {
  uraikan,
  kamus,
  lupakanKamus,
  sebutanDi,
  alasanTolakKueri,
  tanpaTeksBerkutip,
  bentukNilai,
  skemaAbt,
  KEDALAMAN_MAKSIMUM,
  PANJANG_NILAI_MAKSIMUM,
};
