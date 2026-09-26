"use strict";

/**
 * SIPP sebagai acuan perkara e-Court.
 *
 * Sebelumnya jembatan mengambil perkara dari tautan apa pun yang kebetulan ada
 * di halaman setelah login. Tidak ada yang tahu apa yang SEHARUSNYA ditemukan,
 * sehingga perkara yang terlewat hilang diam-diam - tidak ada satu pun angka
 * yang berubah, tidak ada pesan apa pun.
 *
 * Sekarang SIPP yang menyatakan perkara mana saja terdaftar lewat e-Court,
 * lengkap dengan nomor registernya, dan hasil kikisan dicocokkan ke daftar itu.
 *
 * Seluruh pemeriksaan di sini berjalan tanpa jaringan dan tanpa database.
 */

const fs = require("fs");
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

const baca = (...bagian) => fs.readFileSync(pathx.resolve(__dirname, "..", ...bagian), "utf8");
const jembatan = baca("services", "sippReadOnlyBridgeService.js");
const runJs = baca("tools", "ecourt-bridge", "run.js");
const store = baca("services", "ecourtStoreService.js");

const daftar = jembatan.slice(
  jembatan.indexOf("async function listEcourtCases"),
  jembatan.indexOf("async function introspectSchema")
);

console.log("\n== Langkah 3: daftar perkara berasal dari SIPP ==");
{
  periksa("operasi ecourt.caseList terdaftar", /"ecourt\.caseList": listEcourtCases/.test(jembatan));
  periksa("menempuh rantai perkara -> efiling_id -> efiling", /perkara_efiling_id/.test(daftar) && /perkara_efiling\b/.test(daftar));
  periksa("membaca nomor_register", /nomor_register/.test(daftar));
  periksa("hanya SELECT", !/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i.test(daftar));
  periksa("jembatan memuat acuan sebelum menarik", /muatAcuanSipp\(/.test(runJs));
}

console.log("\n== Pendaftaran ganda: dipakai yang TERBARU ==");
{
  // Satu perkara dapat punya lebih dari satu pendaftaran e-Court. Pada
  // database PA Donggala, perkara_id 4227 memetakan ke efiling_id 9168 dan
  // 13739. Mengambil yang salah berarti menarik dokumen dari pendaftaran yang
  // bukan urusannya.
  periksa("diurutkan terbaru lebih dulu", /tanggal_pendaftaran DESC/.test(daftar) && /efiling_id DESC/.test(daftar));
  periksa("yang lama dihitung, bukan dibuang diam-diam", /pendaftaranGanda/.test(daftar));

  // Menyalin aturan penyaringnya untuk diuji langsung.
  const barisSipp = [
    { perkaraId: "4227", efilingId: "13739", nomorRegister: "BARU" },
    { perkaraId: "4227", efilingId: "9168", nomorRegister: "LAMA" },
    { perkaraId: "4228", efilingId: "13782", nomorRegister: "LAIN" },
  ];
  const terpilih = new Map();
  let ganda = 0;
  for (const row of barisSipp) {
    if (terpilih.has(row.perkaraId)) {
      ganda += 1;
      continue;
    }
    terpilih.set(row.perkaraId, row);
  }
  periksa("perkara ganda menyisakan satu", terpilih.size === 2);
  periksa("yang dipakai adalah yang terbaru", terpilih.get("4227").nomorRegister === "BARU");
  periksa("pendaftaran lama terhitung", ganda === 1);
}

console.log("\n== Langkah 4: identitas SIPP tersimpan pada dokumen ==");
{
  periksa("kolom perkara_id ditambahkan", /"perkara_id"/.test(store));
  periksa("kolom nomor_register ditambahkan", /"nomor_register"/.test(store));
  periksa("ditulis saat dokumen baru", /perkara_id, nomor_register/.test(store));
  periksa("diteruskan dari jembatan", /perkaraId: identitas\.perkaraId/.test(runJs));

  // Padanan yang gagal TIDAK boleh menghapus padanan yang sudah benar.
  periksa("pembaruan tidak mengosongkan perkara_id", /perkara_id = COALESCE\(\?, perkara_id\)/.test(store));
  periksa(
    "pembaruan tidak mengosongkan nomor_register",
    /nomor_register = CASE WHEN \? = '' THEN nomor_register ELSE \? END/.test(store)
  );
}

console.log("\n== Langkah 5: selisih dilaporkan, bukan disembunyikan ==");
{
  periksa("perkara SIPP yang tidak ketemu dicatat", /tidakDitemukanDiEcourt/.test(runJs));
  periksa("perkara e-Court di luar SIPP dicatat", /tidakAdaDiSipp/.test(runJs));
  periksa("beda nomor register dicatat", /registerBerbeda/.test(runJs));
  periksa("selisih ikut tersimpan di catatan putaran", /ringkasSelisih\(hasil\)/.test(store));
  periksa("tanpa selisih tidak menulis catatan", /return null;/.test(store.slice(store.indexOf("function ringkasSelisih"))));
}

console.log("\n== Gagal-terbuka: SIPP mati tidak menghentikan penarikan ==");
{
  // Menolak menarik dokumen hanya karena SIPP sedang tidak terjangkau berarti
  // dokumen yang tenggatnya besok tidak sampai ke pihak. Kerugian itu jauh
  // lebih besar daripada kehilangan pelaporan selisih untuk satu putaran.
  const acuan = runJs.slice(runJs.indexOf("async function muatAcuanSipp"), runJs.indexOf("function padankan"));
  periksa("kegagalan ditangkap, tidak dilempar", /catch \(error\)/.test(acuan) && !/throw/.test(acuan));
  periksa("mengembalikan acuan tidak aktif", /aktif: false/.test(acuan));
  periksa("padankan menyerah aman bila acuan mati", /if \(!acuan\.aktif\) return \{ perkaraId: null, nomorRegister: "" \};/.test(runJs));
}

console.log("\n== Acuan bukan jatah putaran ==");
{
  // ------------------------------------------------------------------
  // YANG DIJAGA ADALAH PEMISAHANNYA, BUKAN ANGKANYA
  // ------------------------------------------------------------------
  //
  // Sampai 25 Sep 2026 acuannya Math.max(maksPerkara, 200), dan "penarikan
  // menyeluruh" memanggil dengan maksPerkara = 0 - jadi acuannya SELALU 200
  // perkara setahun terakhir. Terukur di sipp_donggala: 2.527 perkara e-Court,
  // 988 di antaranya terdaftar dalam 365 hari. Perkara ke-201 tidak pernah
  // tersentuh, dan "Tarik perkara ini" untuk perkara lama selalu menjawab
  // "tidak ada pada acuan SIPP".
  periksa(
    "acuan tidak lagi dibatasi jatah putaran",
    !/limit: Math\.max\(Number\(maksPerkara\)/.test(runJs)
  );
  periksa(
    "jendela lebar hanya pada mode belum-ada dan tarik-satu-perkara",
    /limit: seluruhArsip \? 5000 :/.test(runJs) &&
      /sejakHari: seluruhArsip \? 3650 : undefined/.test(runJs)
  );
  periksa(
    "penarikan satu perkara memakai acuan lebar",
    /seluruhArsip: args\.hanyaBelumAda \|\| Boolean\(args\.perkara\)/.test(runJs)
  );
  // Jatah putaran TETAP membatasi berapa halaman yang benar-benar dibuka -
  // itulah yang membebani server Mahkamah Agung, bukan besarnya acuan.
  periksa(
    "jatah putaran tetap memotong daftar tautan",
    /if \(args\.maksPerkara > 0\) tautan = tautan\.slice\(0, args\.maksPerkara\)/.test(runJs)
  );
  periksa(
    "urutan tetap mendahulukan 200 terbaru",
    /BATAS_TERBARU/.test(runJs) && /lapis\(a\) - lapis\(b\)/.test(runJs)
  );
  // Ukurannya ikut ditulis di kode supaya yang menurunkannya lagi tahu apa yang
  // hilang karenanya.
  periksa("ukuran yang hilang tercatat di kode", /2\.527 perkara e-Court/.test(runJs));

  const jembatanSipp = baca("services", "sippReadOnlyBridgeService.js");
  periksa(
    "batas atas listEcourtCases menampung seluruh arsip",
    /Math\.min\(Math\.max\(Number\(params\.limit\) \|\| 200, 1\), 5000\)/.test(jembatanSipp)
  );
}

console.log("\n== Mode belum-ada: yang sudah ada tidak dibuka ==");
{
  periksa("ada saklarnya", /args\.hanyaBelumAda/.test(runJs));
  periksa("dibaca dari baris perintah", /--hanya-belum-ada/.test(runJs));

  // Satu kueri untuk seluruh daftar. Pemanggilan per perkara TIDAK boleh
  // kembali: pada acuan penuh itu 2.527 kueri berurutan sebelum satu halaman
  // pun dibuka.
  periksa(
    "keadaan berkas dibaca sekali untuk seluruh daftar",
    /ecourtStoreService\.ringkasKekuranganBerkas\(nomorSemua\)/.test(runJs)
  );
  const awalGelung = runJs.indexOf("const perluDiperiksa = [];");
  const gelung = awalGelung > -1 ? runJs.slice(awalGelung, runJs.indexOf("tautan = perluDiperiksa;")) : "";
  periksa("gelung penyaring ketemu", gelung.length > 200);
  periksa(
    "tidak ada lagi satu kueri per perkara di dalam gelung",
    !/await ecourtStoreService\.perkaraSudahLengkap\(/.test(gelung)
  );

  // Dua ukuran lengkap, dan yang dipakai bergantung pertanyaannya. Putaran
  // biasa TETAP membuka perkara yang dokumennya menunggu verifikasi majelis.
  const iLengkap = runJs.indexOf("const lengkap = args.hanyaBelumAda");
  periksa("dua ukuran lengkap ketemu", iLengkap > -1);
  const blokLengkap = iLengkap > -1 ? runJs.slice(iLengkap, iLengkap + 220) : "";
  periksa("mode belum-ada memakai ukuran berkas saja", /k\.tanpaBerkas === 0$/m.test(blokLengkap));
  periksa(
    "putaran biasa tetap memakai ukuran lama",
    /k\.tanpaBerkas === 0 && k\.menunggu === 0/.test(blokLengkap)
  );

  // Lapis 0 hanya hidup pada mode belum-ada; aturan 200 terbaru tidak dicabut.
  //
  // Yang dipaku BERGESER 25 Sep 2026, bukan dilonggarkan: pengurutan giliran
  // dipindahkan dari dalam utama() ke fungsi susunGiliran() supaya dapat
  // dijalankan pengujian - cacat "lapis 0 tidak dapat pensiun" hanya muncul
  // pada penekanan KEDUA, dan tidak ada penyisiran teks yang dapat melihatnya.
  // Karena itu `args.hanyaBelumAda` menjadi parameter `hanyaBelumAda` dan
  // BATAS_TERBARU menjadi parameter `batasTerbaru` yang bawaannya BATAS_TERBARU.
  // Perilaku yang dijaga tetap sama, dan kini dijaga juga oleh uji perilaku
  // pada manajemen_surat/src/test/penarikan-belum-ada.test.ts.
  periksa("lapis kosong hanya pada mode belum-ada", /hanyaBelumAda && belumPernah\(url\)/.test(runJs));
  const iLapis = runJs.indexOf("const lapis = (url) =>");
  periksa("aturan 200 terbaru tetap ada di dalam lapis", /< batasTerbaru/.test(runJs.slice(iLapis, iLapis + 320)));
  periksa(
    "bawaan batasTerbaru tetap BATAS_TERBARU",
    /batasTerbaru = BATAS_TERBARU/.test(runJs)
  );
  // Catatan kunjungan: tanpanya lapis 0 tidak dapat pensiun sama sekali.
  periksa("kunjungan dicatat untuk setiap halaman yang terbaca", /dokumenTerlihat: semua\.length/.test(runJs));
  periksa("giliran membaca catatan kunjungan", /ecourtKunjunganService\.kunjunganTerakhir\(\)/.test(runJs));

  // Sopan santun: daftar yang padat berarti lebih banyak permintaan per jam
  // walau jedanya tidak berubah. Jeda manusiawinya TIDAK boleh disentuh.
  periksa("ada istirahat berkala", /const ISTIRAHAT_TIAP_PERKARA =/.test(runJs));
  periksa(
    "istirahatnya hanya pada mode belum-ada",
    /args\.hanyaBelumAda &&\s*\n?\s*ringkasan\.perkaraDiperiksa > 1/.test(runJs)
  );
  periksa("panjang istirahatnya tidak seragam", /1 \+ Math\.random\(\) \* 2/.test(runJs));
  periksa(
    "jeda manusiawi tidak diubah menjadi angka tetap",
    /const condong = Math\.random\(\) \* Math\.random\(\)/.test(runJs)
  );
}

console.log("\n== Uji kering tidak menyentuh e-Court ==");
{
  const sasaran = baca("services", "ecourtSasaranService.js");
  periksa("tidak memuat peramban", !/puppeteer/.test(sasaran));
  periksa("tidak memuat layanan login e-Court", !/ecourtLoginService/.test(sasaran));
  periksa(
    "hanya membaca acuan SIPP",
    /safeHandleBridgeOperation\("ecourt\.caseList"/.test(sasaran)
  );
  periksa("acuannya seluruh arsip", /limit: 5000/.test(sasaran) && /sejakHari: 3650/.test(sasaran));
  // Ketiga golongan harus berjumlah persis total; selisihnya disebut, bukan
  // didiamkan.
  periksa("selisih golongan dilaporkan", /selisihGolongan/.test(sasaran));
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
