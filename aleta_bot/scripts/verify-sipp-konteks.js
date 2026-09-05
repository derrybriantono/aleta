#!/usr/bin/env node
"use strict";

/**
 * Memeriksa konteks ALETA untuk halaman SIPP — Tahap 1 ekstensi.
 *
 *   node scripts/verify-sipp-konteks.js
 *
 * ============================================================================
 * DUA SIFAT YANG PALING PENTING
 * ============================================================================
 *
 *   1. TIDAK MENYENTUH SIPP. Ekstensi hanya menambah elemen ke halaman.
 *      Begitu ia mulai mengisi formulir SIPP, seluruh keunggulan rancangan
 *      ini hilang - dan kesalahannya akan tampak seperti kesalahan petugas.
 *
 *   2. DIAM KETIKA TIDAK TAHU. Keterangan yang salah di layar SIPP lebih
 *      berbahaya daripada tidak ada keterangan, karena petugas mempercayai
 *      apa yang tampil di aplikasi resminya.
 */

const fs = require("fs");
const path = require("path");

// --- Tiruan database ---
const botDbPath = require.resolve("../services/botDbService");
const botDbAsli = require("../services/botDbService");
const dokumen = [];
const nomorTersimpan = [];
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  toMysqlDate: (v) => new Date(v).toISOString().slice(0, 19).replace("T", " "),
  fromMysqlDate: botDbAsli.fromMysqlDate,
  query: async (sql, params = []) => {
    if (/^\s*CREATE TABLE/i.test(sql)) return [];
    if (/FROM aleta_bot_ecourt_documents/i.test(sql) && /nomor_perkara = \?/.test(sql)) {
      return dokumen.filter((d) => d.nomor_perkara === params[0]);
    }
    if (/FROM aleta_bot_nomor_terverifikasi/i.test(sql) && /nama_kunci = \?/.test(sql)) {
      return nomorTersimpan.filter((n) => n.nomor === params[0] && n.nama_kunci === params[1]);
    }
    return [];
  },
};

// --- Tiruan SIPP ---
const dbPath = require.resolve("../db_config");
require("../db_config");
const sippPihak = [];
require.cache[dbPath].exports = {
  query(sql, params, callback) {
    const selesai = typeof params === "function" ? params : callback;
    if (typeof selesai !== "function") return;
    selesai(null, sippPihak);
  },
};

const konteksService = require("../services/sippKonteksService");

let lulus = 0;
let gagal = 0;

function periksa(label, kondisi) {
  if (kondisi) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}`);
  }
}

const NOMOR = "620/Pdt.G/2025/PA.Dgl";
const EKSTENSI = path.resolve(__dirname, "..", "..", "ekstensi-sipp");

function bacaEkstensi(nama) {
  return fs.readFileSync(path.join(EKSTENSI, nama), "utf8");
}

function bacaLayanan(nama) {
  return fs.readFileSync(path.resolve(__dirname, "..", "services", nama), "utf8");
}

function bacaLayananKonteks() {
  return bacaLayanan("sippKonteksService.js");
}

/** Hanya bagian ringkasanMassal, bukan seluruh berkas layanan. */
function potongMassal(teks) {
  const awal = teks.indexOf("async function ringkasanMassal");
  const akhir = teks.indexOf("async function getKonteks");
  return awal >= 0 && akhir > awal ? teks.slice(awal, akhir) : "";
}

async function utama() {
  console.log("\n== Konteks perkara terkumpul ==");
  {
    dokumen.length = 0;
    sippPihak.length = 0;
    nomorTersimpan.length = 0;

    const besok = new Date(Date.now() + 24 * 60 * 60 * 1000);
    dokumen.push({
      document_key: "k1",
      nomor_perkara: NOMOR,
      judul_dokumen: "Jawaban Tergugat",
      jenis_dokumen: "Jawaban",
      peran_pengunggah: "Tergugat",
      status_verifikasi: "belum",
      agenda: "Jawaban Tergugat",
      diunggah_pada: "2025-12-09 11:30:00",
      batas_unggah: botDbAsli.toMysqlDate(besok),
      batas_unggah_teks: "Selasa, 09 Desember 2025 Pukul : 15:00 WIB",
      berkas_pdf: "/arsip/jawaban.pdf",
      berkas_word: "/arsip/jawaban.docx",
      diberitahukan_pada: null,
      alasan_tidak_diberitahukan: "",
    });
    sippPihak.push({ nama: "Sulastri binti Djanggola", pihak_ke: 1, jenis: "pihak", telepon: "085242120977" });

    const hasil = await konteksService.getKonteks(NOMOR);
    periksa("konteks terbaca", hasil.ok === true);
    periksa("nomor perkara dinormalkan", hasil.nomorPerkara === NOMOR);
    periksa("dokumen terkumpul", hasil.dokumen.length === 1);
    periksa("kedua format terlihat", hasil.dokumen[0].adaPdf && hasil.dokumen[0].adaWord);
    periksa("tenggat terbaca", /15:00 WIB/.test(hasil.dokumen[0].batasUnggahTeks));
    periksa("sisa hari dihitung", hasil.dokumen[0].sisaHari === 1);
    periksa("pihak terkumpul", hasil.nomorPihak.length === 1);
  }

  console.log("\n== ATURAN POKOK: nomor pihak tidak dipajang utuh ==");
  {
    const hasil = await konteksService.getKonteks(NOMOR);
    const pihak = hasil.nomorPihak[0];
    periksa("nomor disamarkan", /\*\*\*\*/.test(pihak.nomorSamar));
    periksa("nomor utuh tidak dikirim", !JSON.stringify(hasil).includes("085242120977"));
    periksa("masih dapat dikenali petugas", pihak.nomorSamar.startsWith("0852"));
  }

  console.log("\n== Nomor perkara kosong ditolak ==");
  {
    const kosong = await konteksService.getKonteks("");
    periksa("ditolak", kosong.ok === false);
    periksa("alasannya jelas", kosong.alasan === "nomor_perkara_kosong");
  }

  console.log("\n== SIPP bermasalah tidak merusak seluruh konteks ==");
  {
    const aslinya = require.cache[dbPath].exports.query;
    require.cache[dbPath].exports.query = (sql, params, callback) => {
      const selesai = typeof params === "function" ? params : callback;
      selesai(new Error("SIPP tidak dapat dijangkau"));
    };

    const hasil = await konteksService.getKonteks(NOMOR);
    require.cache[dbPath].exports.query = aslinya;

    // Bagian yang gagal dikosongkan; bagian lain tetap benar.
    periksa("tetap mengembalikan konteks", hasil.ok === true);
    periksa("dokumen tetap terbaca", hasil.dokumen.length === 1);
    periksa("pihak dikosongkan, bukan ditebak", hasil.nomorPihak.length === 0);
  }

  console.log("\n== EKSTENSI: tidak pernah menulis ke SIPP ==");
  {
    const konten = bacaEkstensi("konten.js");

    // Semua cara mengubah halaman SIPP yang tidak boleh dipakai.
    periksa("tidak mengisi formulir", !/\.value\s*=/.test(konten));
    periksa("tidak mengirim formulir", !/\.submit\(\)/.test(konten));

    // Aturan di sini sengaja BERUBAH sejak fitur "tandai halaman SIPP".
    //
    // Sebelumnya ekstensi dilarang memilih elemen milik SIPP sama sekali,
    // karena ia hanya menggambar panel melayang dan tidak punya alasan
    // menyentuh apa pun. Sekarang ia memang perlu MEMBACA halaman SIPP untuk
    // menempelkan tenggat dan keadaan nomor pihak di sebelah nama orangnya.
    //
    // Yang dilonggarkan HANYA membaca. Batas yang sebenarnya penting justru
    // dipertegas di bawah ini: apa pun yang ditambahkan harus dapat dicabut
    // seutuhnya, dan tidak ada satu pun milik SIPP yang boleh diubah.

    // Satu-satunya kelas yang boleh ditambahkan ke elemen SIPP adalah sorotan
    // baris, dan ia harus dilepas kembali di tempat lain.
    // Setiap kelas yang ditambahkan harus MILIK ALETA. Aturan ini lebih
    // ketat daripada daftar nama tetap: nama baru apa pun tetap harus
    // berawalan aleta-, sehingga kelas milik SIPP tidak akan pernah
    // tersentuh walau kode ekstensi bertambah.
    const kelasDitambah = [...konten.matchAll(/classList\.add\(([^)]*)\)/g)].map((m) => m[1].trim());
    const kelasAsing = kelasDitambah.filter((x) => x !== "SOROT" && !/^["'`]aleta-/.test(x));
    periksa(
      `kelas yang ditambahkan milik ALETA${kelasAsing.length ? ` (${kelasAsing.join(", ")})` : ""}`,
      kelasAsing.length === 0
    );
    periksa("sorotan dilepas kembali", /classList\.remove\(SOROT\)/.test(konten));

    // Atribut yang ditempelkan hanya penanda milik ALETA - itulah yang membuat
    // seluruh sisipan dapat ditemukan lagi dan dicabut.
    const atribut = [...konten.matchAll(/setAttribute\(\s*([^,]+),/g)].map((m) => m[1].trim());
    // Selain penanda ALETA, hanya atribut aria-* yang diizinkan: ia
    // menerangkan keadaan elemen kepada pembaca layar dan tidak
    // mengubah perilaku maupun data apa pun.
    const atributAsing = atribut.filter((x) => x !== "TANDA" && !/^["'`]aria-/.test(x));
    periksa(
      `atribut yang ditempel aman${atributAsing.length ? ` (${atributAsing.join(", ")})` : ""}`,
      atributAsing.length === 0
    );

    periksa("ada fungsi pembersih", /function bersihkanTanda\(\)/.test(konten));
    // Jendelanya dilebarkan dari 200 menjadi 600 aksara: badan pembersih kini
    // dibungkus tanpaPengamat beserta catatan sebabnya, sehingga penyapuan
    // berdasarkan penanda berada lebih jauh dari nama fungsinya. Yang dijaga
    // tetap sama - pembersih menyapu berdasarkan PENANDA, bukan menebak simpul.
    periksa("pembersih menyapu berdasarkan penanda", /bersihkanTanda\(\)[\s\S]{0,600}\[\$\{TANDA\}\]/.test(konten));
    periksa("tanda dicabut saat ekstensi dimatikan", /sedangAktif\(\)[\s\S]{0,260}bersihkanTanda\(\)/.test(konten));

    // Penandaan halaman kerja orang harus dinyalakan sendiri, bukan menyala
    // diam-diam setelah pembaruan.
    periksa("penandaan bawaannya mati", /simpan\.tandaiHalaman === true/.test(konten));

    // Tidak boleh ada penulisan ke elemen SIPP.
    periksa("tidak menghapus atribut SIPP", !/removeAttribute\(/.test(konten));
    // Menukar simpul dan menyuntik potongan HTML tidak pernah dibenarkan:
    // yang pertama membuang elemen SIPP, yang kedua menjalankan penanda dari
    // teks yang belum tentu milik kita.
    periksa(
      "tidak menukar simpul atau menyuntik HTML",
      !/(replaceChild|insertAdjacentHTML)\(/.test(konten)
    );

    // insertBefore SENDIRI tidak berbahaya - yang berbahaya memakainya pada
    // elemen SIPP. Dulu pemeriksaan ini melarangnya di mana pun, lalu gagal
    // begitu pemberitahuan versi baru disisipkan ke kepala panel ALETA
    // SENDIRI. Larangan yang terlalu lebar berakhir dimatikan orang, bukan
    // dipatuhi; yang dijaga sekarang PENERIMANYA.
    const penerimaSisip = [...konten.matchAll(/([A-Za-z_$][\w$]*)\.insertBefore\(/g)].map(
      (m) => m[1]
    );
    const penerimaAsing = [...new Set(penerimaSisip)].filter((x) => x !== "isi");
    periksa(
      `menyisip hanya ke elemen ALETA sendiri${
        penerimaAsing.length ? ` (${penerimaAsing.join(", ")})` : ""
      }`,
      penerimaAsing.length === 0
    );

    const denganId = [...konten.matchAll(/getElementById\(([^)]+)\)/g)].map((m) => m[1].trim());
    const idAsing = denganId.filter((x) => x !== "PENANDA");
    periksa(
      `hanya mencari id sendiri${idAsing.length ? ` (${idAsing.join(", ")})` : ""}`,
      idAsing.length === 0
    );

    // Elemen yang disentuh harus yang dibuat sendiri lewat createElement.
    const disentuh = [...konten.matchAll(/(\w+)\.(click|remove)\(\)/g)].map((m) => m[1]);
    // Daftar nama tetap diganti pemeriksaan yang sesungguhnya: setiap
    // variabel yang diklik atau dicabut harus BENAR-BENAR dibuat ekstensi
    // ini, dibuktikan dari deklarasinya di berkas yang sama. Daftar nama
    // hanya menghafal; ini memeriksa.
    //
    // "el" tetap dikecualikan dengan alasan yang jelas: ia hasil sapuan
    // [data-aleta-tanda], dan penanda itu hanya dipasang pada elemen buatan
    // sendiri - jadi yang dicabut tidak mungkin milik SIPP.
    const asing = disentuh.filter((nama) => {
      if (nama === "el") return false;
      // Tanpa regex: pola yang dicari sederhana, dan menyusunnya sebagai
      // teks jauh lebih mudah dibaca daripada pelolosan berlapis.
      return !["const", "let", "var"].some((kata) =>
        // getElementById juga dihitung membuat sendiri, TETAPI hanya karena
        // pemeriksaan "hanya mencari id sendiri" di atas sudah memastikan ia
        // tidak pernah dipanggil dengan id selain PENANDA - yaitu panel milik
        // ALETA. Tanpa pemeriksaan itu, baris ini akan menjadi celah.
        ["buatElemen(", "document.createElement(", "document.getElementById("].some((pembuat) =>
          konten.includes(`${kata} ${nama} = ${pembuat}`)
        )
      );
    });
    periksa(
      `hanya menyentuh elemen buatan sendiri${asing.length ? ` (${asing.join(", ")})` : ""}`,
      asing.length === 0
    );
    periksa("tidak menimpa innerHTML", !/innerHTML\s*=/.test(konten));
    // textContent dipakai, bukan innerHTML: isi dari server tidak pernah
    // ditafsirkan sebagai HTML di halaman aplikasi resmi.
    periksa("memakai textContent", /textContent = teks/.test(konten));
  }


  console.log("\n== EKSTENSI: halaman daftar bukan halaman perkara ==");
  {
    const konten = bacaEkstensi("konten.js");
    // Sudah terjadi di server: di halaman Daftar Perkara, panel memuat perkara
    // baris teratas seolah petugas sedang membukanya - lengkap dengan keadaan
    // verifikasi dan tombol hakim untuk perkara yang keliru.
    periksa("nomor perkara dikumpulkan, bukan diambil yang pertama", konten.includes("new Set()"));
    periksa("lebih dari satu nomor berarti daftar", konten.includes("semua.size > 1"));
    periksa("alamat halaman hanya penguat, bukan syarat", konten.includes("alamatHalamanPerkara"));
  }

  console.log("\n== EKSTENSI: bagian dapat dilipat dan diingat ==");
  {
    const konten = bacaEkstensi("konten.js");
    periksa("keadaan lipatan disimpan", konten.includes("lipatanBagian"));
    // Kunci lipatan TIDAK boleh diambil dari judul: judul memuat angka yang
    // berubah - "Dokumen e-Court (3)" - sehingga lipatannya akan terlupa setiap
    // jumlah dokumennya berubah.
    periksa("kunci lipatan tetap, bukan judul", konten.includes('"nomorPihak"') && konten.includes('"dokumen"'));
    periksa("panah menunjukkan keadaan", konten.includes("aleta-bagian-panah"));
  }

  console.log("\n== EKSTENSI: kepala panel ==");
  {
    const konten = bacaEkstensi("konten.js");
    // Panel menampilkan keadaan menurut ALETA, dan ALETA hanya setahu penarikan
    // terakhirnya. Tanpa umur data, "0 dokumen" pada data basi terbaca sebagai
    // "pihak belum mengunggah" - dan itu dasar keputusan yang keliru.
    periksa("umur data ditampilkan", konten.includes("Data ALETA diperiksa"));
    periksa("data basi ditandai", konten.includes("aleta-usia-basi"));
    periksa("nomor register ditampilkan", konten.includes("barisNomorRegister"));
    periksa("nomor register dapat disalin", konten.includes("salinTeks"));
    periksa("ringkasan dipakai", konten.includes("barisRingkasan"));
  }

  console.log("\n== EKSTENSI: panel dapat digeser ==");
  {
    const konten = bacaEkstensi("konten.js");
    periksa("posisi panel diingat", konten.includes("posisiPanel"));
    // Panel yang tergeser keluar layar sama saja dengan panel yang hilang.
    periksa("dijaga tetap terlihat", konten.includes("jepitKeLayar"));
    // Tanpa ini, menekan tombol lipat tertangkap sebagai awal geseran.
    periksa("tombol di kepala tidak memulai geseran", konten.includes('closest("button")'));
  }

  console.log("\n== EKSTENSI: menyerah diam-diam ==");
  {
    const konten = bacaEkstensi("konten.js");
    // Yang dijaga adalah SIFATNYA, bukan bentuk tulisannya: tanpa nomor
    // perkara, panel tidak boleh muncul. Sejak halaman daftar ditandai per
    // baris, cabang ini tidak lagi berupa satu baris return - tetapi ia tetap
    // harus keluar tanpa menggambar panel.
    {
      const cabang = konten.slice(
        konten.indexOf("if (!nomor) {"),
        konten.indexOf("if (nomor === nomorTerakhir")
      );
      periksa("tanpa nomor perkara -> keluar", cabang.includes("return;"));
      periksa("tanpa nomor perkara -> panel tidak digambar", !cabang.includes("susunPanel"));
      periksa("tanpa nomor perkara -> tidak memanggil konteks", !cabang.includes("ALETA_API}?nomor"));
    }
    periksa("jawaban bukan ok -> diam", /if \(!respons\.ok\) return;/.test(konten));
    periksa("galat ditelan tanpa merusak halaman", /catch \{[\s\S]{0,300}\} finally/.test(konten));
    periksa("401 menampilkan ajakan masuk", /respons\.status === 401/.test(konten));
  }


  console.log("\n== EKSTENSI: penanda baris halaman daftar ==");
  {
    const konten = bacaEkstensi("konten.js");
    // Lima puluh permintaan sekaligus dari satu halaman membebani bot dan SIPP
    // tanpa alasan. Ringkasannya diminta SEKALI untuk seluruh baris.
    periksa("ringkasan diminta sekali untuk semua baris", konten.includes("ALETA_API_MASSAL"));
    periksa("hanya dijalankan bila penandaan menyala", konten.includes("await sedangMenandai()"));
    periksa("halaman dengan satu perkara bukan daftar", konten.includes("baris.length < 2"));
    periksa("halaman sama tidak diminta ulang", konten.includes("nomorDaftarTerakhir"));
    // Perkara yang belum pernah ditarik berbeda dari perkara tanpa dokumen.
    periksa("belum ditarik dibedakan", konten.includes("belum ditarik ALETA"));

    const layanan = bacaLayananKonteks();
    periksa("bot membatasi jumlah nomor", layanan.includes("batas = 60"));
    // Halaman daftar terlihat siapa saja yang lewat di belakang layar.
    periksa("ringkasan massal tanpa nomor telepon", !/telepon|nomorSamar/.test(potongMassal(layanan)));
  }

  console.log("\n== EKSTENSI: permintaan penarikan ==");
  {
    const konten = bacaEkstensi("konten.js");
    periksa("tombol tarik tersedia", konten.includes("Tarik dari e-Court"));
    // Tombol yang selalu ada mengundang penekanan tanpa alasan.
    periksa("hanya ditawarkan bila dokumen kosong", konten.includes("dokumen || []).length === 0"));
    periksa("keadaan dibaca sebelum tombol ditawarkan", konten.includes("sisipkanPermintaan"));
    periksa("penolakan disampaikan apa adanya", konten.includes("ALASAN_PERMINTAAN"));

    const antrean = bacaLayanan("ecourtPermintaanService.js");
    // Tombol yang dapat ditekan siapa saja, sesering apa pun, mengarah ke satu
    // tempat: bot yang menghantam sistem Mahkamah Agung berulang kali.
    periksa("satu permintaan tertunda per perkara", antrean.includes("sudah_diantrekan"));
    periksa("ada jeda setelah selesai", antrean.includes("baru_saja_ditarik"));
    periksa("antrean punya batas", antrean.includes("antrean_penuh"));
    periksa("permintaan ditandai selesai apa pun hasilnya", antrean.includes("tandaiSelesai"));
  }

  console.log("\n== EKSTENSI: saklar mati di kepala panel ==");
  {
    const konten = bacaEkstensi("konten.js");
    periksa("saklar mati ada di panel", konten.includes("aleta-matikan"));
    periksa("mematikan lewat penyimpanan bersama", konten.includes("chrome.storage.local.set({ aktif: false })"));
    periksa("dijelaskan cara menyalakannya lagi", konten.includes("dapat dinyalakan lagi dari ikon ekstensi"));
  }


  console.log("\n== EKSTENSI: dokumen resmi tidak boleh memuat ALETA ==");
  {
    const konten = bacaEkstensi("konten.js");
    const css = bacaEkstensi("panel.css");

    // Cetak Relas membuka halaman tersendiri yang alamatnya TETAP di bawah
    // /SIPP/, sehingga ekstensi ikut berjalan di sana. Halaman itu memuat tepat
    // satu nomor perkara, jadi pemeriksaan "lebih dari satu berarti daftar" pun
    // meloloskannya - panel muncul, lalu ikut tercetak di relas panggilan yang
    // disampaikan jurusita kepada pihak berperkara.
    periksa("halaman cetak dikenali", konten.includes("POLA_HALAMAN_CETAK"));
    periksa("templat relas ditahan", konten.includes("/c_template"));
    periksa("halaman popup ditahan", konten.includes("/popup_"));

    // Diperiksa PALING AWAL: petugas yang menyalakan penandaan tidak sedang
    // menyetujui keterangan ALETA tercetak di dokumen resmi.
    const awal = konten.slice(konten.indexOf("async function segarkan()"), konten.indexOf("async function segarkan()") + 500);
    periksa("diperiksa sebelum saklar apa pun", awal.includes("halamanCetakAtauTemplat()"));

    // Lapisan kedua: apa pun yang sudah tergambar tidak ikut tercetak ketika
    // petugas menekan Ctrl+P pada halaman SIPP biasa.
    periksa("ada aturan sembunyi saat cetak", css.includes("@media print"));
    const cetak = css.slice(css.indexOf("@media print"));
    periksa("panel disembunyikan saat cetak", cetak.includes("#aleta-panel-sipp"));
    periksa("sisipan disembunyikan saat cetak", cetak.includes(".aleta-sisip"));
    periksa("seluruh penanda disembunyikan saat cetak", cetak.includes("[data-aleta-tanda]"));
    periksa("sorotan baris ikut dihilangkan", cetak.includes("aleta-baris-disorot"));
  }

  console.log("\n== EKSTENSI: sisipan ke Jadwal Sidang ==");
  {
    const konten = bacaEkstensi("konten.js");

    // Agenda adalah teks bebas: SIPP menulis "penyampaian perbaikan gugatan"
    // sementara e-Court menulis "Perbaikan Gugatan". Dokumen yang muncul di
    // baris agenda yang keliru berarti hakim membuka berkas yang salah - dan
    // letaknya tampak masuk akal, sehingga tidak ada yang menyadarinya.
    const sisip = konten.slice(konten.indexOf("function sisipkanKeJadwalSidang"), konten.indexOf("async function terapkanTanda"));
    periksa("dicocokkan dengan tanggal sidang", sisip.includes("tanggalDokumen"));
    periksa("TIDAK menebak dari nama agenda", !/agenda/i.test(sisip));
    periksa("baris tanpa tanggal dilewati", sisip.includes("if (!tanggal) continue;"));
    periksa("dokumen tanpa tanggal tidak dicocokkan", sisip.includes("if (!tanggal) continue; // tanpa tanggal sidang"));

    // Sel yang disisipi memuat tombol Unggah BAS - tombol yang mengunggah
    // dokumen resmi. Sisipan selalu ditambahkan di AKHIR sel.
    periksa("hanya menambah di akhir sel", sisip.includes("sel.appendChild(kotakSisipan"));
    periksa("tidak menyisip di depan", !sisip.includes("insertBefore") && !sisip.includes("prepend"));
    periksa("tidak disisipi dua kali", sisip.includes("sudah disisipi"));

    // Tanpa penanda, berkas ALETA terbaca sebagai berkas SIPP.
    periksa("sisipan bertanda ALETA terlihat", konten.includes("ALETA · e-Court"));
    periksa("sisipan dapat dicabut", konten.includes("kotak.setAttribute(TANDA"));

    const layanan = bacaLayananKonteks();
    periksa("bot mengirim tanggal sidang", layanan.includes("tanggalSidang:"));
  }

  console.log("\n== EKSTENSI: saklar sisipan berdiri sendiri ==");
  {
    const konten = bacaEkstensi("konten.js");
    periksa("punya saklar sendiri", konten.includes("sedangMenyisipkan"));
    periksa("bawaannya mati", konten.includes("simpan.sisipJadwal === true"));
    // Memaksa yang satu menuntut yang lain membuat salah satunya tidak terpakai.
    periksa("tidak menuntut saklar penandaan", konten.includes("if (!menandai && !menyisipkan) return;"));
    periksa("berlaku seketika", konten.includes("perubahan.sisipJadwal"));

    const popup = bacaEkstensi("popup.html");
    periksa("saklar ada di popup", popup.includes("sisipJadwal"));
    periksa("dijelaskan tidak ikut tercetak", popup.includes("Tidak pernah ikut tercetak"));
  }


  console.log("\n== EKSTENSI: panel DAN sisipan berjalan bersamaan ==");
  {
    const konten = bacaEkstensi("konten.js");
    const popup = bacaEkstensi("popup.html");

    // Menyalakan sisipan ke Jadwal Sidang TIDAK boleh menghilangkan panel.
    // Keduanya menjawab kebutuhan berbeda: panel memuat ringkasan, nomor pihak,
    // dan tombol verifikasi; sisipan menaruh berkas di baris sidangnya.
    const mulai = konten.indexOf("const panel = susunPanel");
    const alur = konten.slice(mulai, konten.indexOf("} catch", mulai));
    periksa("panel digambar tanpa syarat saklar sisipan", !alur.includes("sedangMenyisipkan"));
    periksa("sisipan diterapkan setelah panel", alur.indexOf("tampilkan(panel)") < alur.indexOf("terapkanTanda"));
    periksa("keduanya dipanggil pada alur yang sama", alur.includes("tampilkan(panel)") && alur.includes("terapkanTanda"));

    // Label saklar induk harus jujur: ia mematikan SEMUANYA, bukan panel saja.
    periksa("saklar induk dinamai apa adanya", popup.includes("Nyalakan ALETA di SIPP"));
    periksa("dijelaskan bahwa ia mematikan semuanya", popup.includes("panel maupun sisipan tidak muncul"));

    periksa("tiga saklar tersedia", ["aktif", "tandaiHalaman", "sisipJadwal"].every((x) => popup.includes(x)));
  }


  console.log("\n== Berkas pendaftaran TIDAK mengenal verifikasi ==");
  {
    // Berkas pendaftaran - dokumen bukti, gugatan, surat kuasa - tidak punya
    // tombol verifikasi di e-Court dan tidak ada majelis yang menunggunya.
    // Menyamakannya dengan "belum" membuat angka menunggu majelis membesar
    // oleh dokumen yang tidak pernah menunggu apa pun, DAN memunculkan tombol
    // verifikasi untuk dokumen yang tidak dapat diverifikasi.
    const store = bacaLayanan("ecourtStoreService.js");
    periksa("status tidak_perlu dikenali", store.includes('"tidak_perlu"'));
    periksa("penanda perluVerifikasi diterima", store.includes("perluVerifikasi = true"));

    const run = fs.readFileSync(path.resolve(__dirname, "..", "tools", "ecourt-bridge", "run.js"), "utf8");
    periksa("berkas pendaftaran ditandai tidak perlu", run.includes("perluVerifikasi: false"));
    periksa("dokumen persidangan tetap perlu", run.includes('sumber: "persidangan", perluVerifikasi: true'));

    const konten = bacaEkstensi("konten.js");
    periksa("tombol hakim tidak muncul untuk tidak_perlu", konten.includes('d.statusVerifikasi !== "tidak_perlu"'));
    periksa("labelnya bukan menunggu majelis", konten.includes('"berkas pendaftaran"'));

    // Menyembunyikan tombol BUKAN penjagaan: permintaan yang disusun sendiri
    // tetap sampai ke bot.
    const verif = bacaLayanan("ecourtVerificationService.js");
    periksa("bot menolak verifikasi berkas pendaftaran", verif.includes("dokumen_tidak_mengenal_verifikasi"));
    const rekam = verif.slice(verif.indexOf("async function recordDecision"));
    periksa(
      "ditolak sebelum menyentuh database",
      rekam.indexOf("tidak_mengenal_verifikasi") < rekam.indexOf("await ensureSchema()")
    );
  }

  console.log("\n== EKSTENSI: menunggu tab AJAX ==");
  {
    const konten = bacaEkstensi("konten.js");
    // SIPP memuat isi tabnya lewat AJAX. Menyisipkan saat halaman siap saja
    // tidak cukup - inilah sebab paling umum lapisan semacam ini "kadang
    // muncul kadang tidak".
    periksa("memakai MutationObserver", /new MutationObserver/.test(konten));
    periksa("permintaan dijeda", /clearTimeout\(jeda\)/.test(konten));
    periksa("tidak meminta ulang untuk perkara sama", /nomor === nomorTerakhir/.test(konten));
  }

  console.log("\n== EKSTENSI: izin sesempit mungkin ==");
  {
    const manifest = JSON.parse(bacaEkstensi("manifest.json"));

    periksa("hanya izin storage", JSON.stringify(manifest.permissions) === JSON.stringify(["storage"]));
    // Izin "tabs" memberi kemampuan membaca alamat SELURUH tab peramban -
    // jauh lebih luas daripada yang dibutuhkan saklar tampil/sembunyi.
    periksa("TIDAK meminta izin tabs", !JSON.stringify(manifest).includes("\"tabs\""));
    periksa(
      "host dibatasi ke server satker",
      Array.isArray(manifest.host_permissions) &&
        manifest.host_permissions.every((h) => h.startsWith("http://192.168.10.10/"))
    );
    periksa(
      "skrip hanya berjalan di halaman SIPP",
      manifest.content_scripts[0].matches.every((m) => m.includes("/SIPP/"))
    );
    periksa("manifest v3", manifest.manifest_version === 3);
  }

  console.log("\n== EKSTENSI: gaya tidak menabrak SIPP ==");
  {
    const css = bacaEkstensi("panel.css");
    const pemilih = css.match(/^\s*[.#][a-zA-Z][^{]*\{/gm) || [];
    const bukanAleta = pemilih.filter((p) => !p.includes(".aleta-"));
    periksa(`seluruh pemilih diawali .aleta-${bukanAleta.length ? ` (${bukanAleta.join(", ")})` : ""}`, bukanAleta.length === 0);
    // position:fixed supaya tidak menggeser satu pun elemen SIPP.
    periksa("panel tidak menggeser tata letak SIPP", /position:\s*fixed/.test(css));
  }

  console.log("\n== TAHAP 3: berkas hanya dari dalam folder arsip ==");
  {
    const dokService = require("../services/ecourtDocumentService");

    // Jalur tersimpan dipakai membaca berkas dari disk. Bila baris database
    // sempat berubah, jalur menaik akan menyerahkan berkas apa pun di server.
    for (const jahat of ["/etc/passwd", "../../../etc/passwd", "C:/Windows/win.ini"]) {
      const hasil = dokService.describeEcourtDocument(jahat);
      periksa(`"${jahat}" ditolak`, hasil.ok === false);
    }

    const kosong = await konteksService.getBerkas("", "pdf");
    periksa("document_key kosong ditolak", kosong.ok === false && kosong.alasan === "document_key_kosong");

    const tidakAda = await konteksService.getBerkas("kunci-entah", "pdf");
    periksa("dokumen tidak ada ditolak", tidakAda.ok === false);
  }

  console.log("\n== TAHAP 3: ekstensi mengunduh lewat portal, bukan tautan biasa ==");
  {
    const konten = bacaEkstensi("konten.js");
    periksa("ada tombol unduh", /function tombolUnduh/.test(konten));
    // Tautan biasa berpindah halaman atau membuka tab tanpa membawa sesi -
    // petugas menerima halaman login di tengah halaman perkara.
    periksa("memakai fetch dengan sesi", /credentials: "include"/.test(konten));
    periksa("menyimpan lewat blob", /URL\.createObjectURL/.test(konten));
    periksa("membersihkan alamat blob", /URL\.revokeObjectURL/.test(konten));
    periksa("401 dijelaskan, bukan diam", /masuk dulu/.test(konten));
    // Nama berkas dari server dipakai bila ada; nama cadangan dibersihkan
    // dari karakter yang tidak sah di nama berkas Windows.
    periksa("nama berkas dibersihkan", /replace\(\/\[/.test(konten));
  }

  console.log("\n== TAHAP 4: penjadwal berhenti ketika sesi habis ==");
  {
    const penjadwal = require("../services/ecourtSchedulerService");

    // Bawaan MATI: menarik dari sistem Mahkamah Agung tanpa diminta bukan
    // perilaku yang pantas dinyalakan sendiri oleh pembaruan.
    periksa("bawaan dimatikan", penjadwal.getSettings({}).aktif === false);

    // Akhir pekan selalu dilewati.
    periksa("Sabtu dilewati", penjadwal.dalamJamKerja(new Date(2026, 7, 29, 10, 0)) === false);
    periksa("Minggu dilewati", penjadwal.dalamJamKerja(new Date(2026, 7, 30, 10, 0)) === false);
    periksa("Rabu siang dikerjakan", penjadwal.dalamJamKerja(new Date(2026, 7, 26, 10, 0)) === true);
    periksa("Rabu malam dilewati", penjadwal.dalamJamKerja(new Date(2026, 7, 26, 22, 0)) === false);

    // Nilai di luar akal ditolak, bukan dipaksa masuk.
    const kasus = [
      ["jarak nol", { jarakJam: 0, jamMulai: 7, jamSelesai: 17, maksPerkara: 25 }],
      ["jarak setahun", { jarakJam: 999, jamMulai: 7, jamSelesai: 17, maksPerkara: 25 }],
      ["selesai sebelum mulai", { jarakJam: 2, jamMulai: 17, jamSelesai: 7, maksPerkara: 25 }],
      ["perkara nol", { jarakJam: 2, jamMulai: 7, jamSelesai: 17, maksPerkara: 0 }],
      ["perkara ribuan", { jarakJam: 2, jamMulai: 7, jamSelesai: 17, maksPerkara: 5000 }],
    ];
    for (const [nama, nilai] of kasus) {
      periksa(`${nama} ditolak`, penjadwal.saveSettings(nilai).ok === false);
    }
  }

  console.log("\n== TAHAP 4: jembatan tidak menunggu manusia saat terjadwal ==");
  {
    const fsx = require("fs");
    const pathx = require("path");
    const run = fsx.readFileSync(pathx.resolve(__dirname, "..", "tools", "ecourt-bridge", "run.js"), "utf8");

    periksa("ada mode terjadwal", /--terjadwal/.test(run));
    periksa("terjadwal berarti tanpa jendela", /args\.terjadwal = true;[\s\S]{0,60}args\.headless = true/.test(run));
    // Tidak ada manusia di depan layar saat penjadwal berjalan.
    periksa("tidak menunggu login manual", /if \(args\.terjadwal\)[\s\S]{0,600}waitForManualLogin/.test(run) === false || /args\.terjadwal[\s\S]{0,400}sesi_habis/.test(run));
    periksa("sesi habis memakai kode keluar sendiri", /KODE_KELUAR = 2/.test(run));

    const layanan = fsx.readFileSync(pathx.resolve(__dirname, "..", "services", "ecourtSchedulerService.js"), "utf8");
    periksa("penjadwal membedakan kode 2", /kode === 2/.test(layanan));
    periksa("tidak dua putaran sekaligus", /keadaan\.sedangJalan/.test(layanan));
    // Memanggil jembatan, bukan menyalin alurnya.
    periksa("memanggil run.js sebagai proses", /spawn\(/.test(layanan) && /run\.js/.test(layanan));
  }

  console.log("\n== TAHAP 5: tombol verifikasi hanya untuk hakim majelis ==");
  {
    const konten = bacaEkstensi("konten.js");

    // Ekstensi tidak menebak sendiri siapa yang boleh memverifikasi -
    // jawabannya datang dari server.
    // Diperiksa sebagai KEBERADAAN kedua syarat pada kondisi yang sama, bukan
    // sebagai satu baris utuh. Kondisi ini tumbuh - kini juga menolak berkas
    // pendaftaran - dan uji yang menuntut bentuk satu baris akan gagal setiap
    // kali syaratnya bertambah, padahal sifat yang dijaga tetap sama.
    {
      const kondisi = konten.slice(
        konten.indexOf("konteks.hakim &&"),
        konten.indexOf("kotakVerifikasi(d)")
      );
      periksa(
        "izin datang dari server",
        kondisi.includes("konteks.hakim.bolehVerifikasi") && !kondisi.includes("nama ===")
      );
    }
    periksa("dokumen sudah valid tidak diberi tombol", /d\.statusVerifikasi !== "valid"/.test(konten));

    // Dua langkah: tombol pertama tidak menyentuh jaringan sama sekali.
    periksa("ada langkah konfirmasi", /tampilkanKonfirmasi/.test(konten));
    periksa("konfirmasi selalu tegas true", /konfirmasi: true/.test(konten));
    periksa("penolakan majelis dijelaskan", /tidak tercatat sebagai majelis/.test(konten));
  }

  console.log("\n== TAHAP 5: izin diperiksa di bot, bukan dipercayakan ekstensi ==");
  {
    const fsx = require("fs");
    const pathx = require("path");
    const layanan = fsx.readFileSync(pathx.resolve(__dirname, "..", "services", "sippKonteksService.js"), "utf8");

    periksa("ada pemeriksa hakim", /function periksaHakim/.test(layanan));
    periksa("memeriksa terdaftar sebagai hakim", /identifyJudgeByName/.test(layanan));
    periksa("memeriksa keanggotaan majelis", /isOnPanel/.test(layanan));
    // GAGAL-TERTUTUP: apa pun yang tidak pasti berakhir tidak boleh.
    periksa("nama kosong ditolak", /nama_pembuka_kosong/.test(layanan));
    periksa("bukan hakim ditolak", /bukan_hakim_terdaftar/.test(layanan));

    const rutePortal = fsx.readFileSync(
      pathx.resolve(__dirname, "..", "..", "manajemen_surat", "src", "app", "api", "aleta-bot", "sipp-konteks", "route.ts"),
      "utf8"
    );
    // Nama dari akun login, tidak pernah dari badan permintaan.
    periksa("nama dari akun login", /nama: actor\.name/.test(rutePortal));
    periksa("nama tidak dibaca dari badan permintaan", !/nama: String\(body/.test(rutePortal));
  }

  console.log("\n== TAHAP 6: masa simpan bawaan tidak menghapus apa pun ==");
  {
    const arsip = require("../services/ecourtArsipService");

    // Berapa lama pengadilan menyimpan salinan berkas pihak bukan keputusan
    // yang pantas diambil kode.
    periksa("bawaan masa simpan nol", arsip.getSettings({}).simpanBulan === 0);
    const kosong = await arsip.bersihkan({ hapus: false });
    periksa("tanpa ketetapan, tidak ada yang dihapus", kosong.aktif === false);
    periksa("alasannya jelas", kosong.alasan === "masa_simpan_belum_ditetapkan");
  }

  console.log("\n== TAHAP 6: nilai di luar akal ditolak ==");
  {
    const arsip = require("../services/ecourtArsipService");
    const kasus = [
      ["ruang nol", { minRuangGb: 0, maksBerkasMb: 50, simpanBulan: 12 }],
      ["ruang ribuan", { minRuangGb: 9999, maksBerkasMb: 50, simpanBulan: 12 }],
      ["berkas nol", { minRuangGb: 5, maksBerkasMb: 0, simpanBulan: 12 }],
      ["simpan minus", { minRuangGb: 5, maksBerkasMb: 50, simpanBulan: -1 }],
      ["simpan seabad", { minRuangGb: 5, maksBerkasMb: 50, simpanBulan: 999 }],
    ];
    for (const [nama, nilai] of kasus) {
      periksa(`${nama} ditolak`, arsip.saveSettings(nilai).ok === false);
    }
  }

  console.log("\n== TAHAP 6: penjagaan sebelum menghapus dan menarik ==");
  {
    const fsx = require("fs");
    const pathx = require("path");
    const layanan = fsx.readFileSync(pathx.resolve(__dirname, "..", "services", "ecourtArsipService.js"), "utf8");

    // Melihat adalah perilaku bawaan; menghapus harus dinyatakan tegas.
    periksa("hapus harus tegas true", /hapus = false/.test(layanan));
    periksa("jalur diperiksa sebelum dihapus", /describeEcourtDocument\(row\.jalur_berkas\)/.test(layanan));
    // Hanya dokumen yang sudah selesai perjalanannya.
    periksa("hanya yang sudah diverifikasi", /status_verifikasi = .valid./.test(layanan));
    periksa("hanya yang sudah diberitahukan", /diberitahukan_pada IS NOT NULL/.test(layanan));
    // Catatan dokumennya tidak ikut terhapus.
    periksa("catatan dokumen tidak dihapus", !/DELETE FROM aleta_bot_ecourt_documents/.test(layanan));
    // Ruang tidak terbaca diperlakukan sebagai tidak boleh, bukan cukup.
    periksa("ruang tidak terbaca -> berhenti", /ruang_disk_tidak_terbaca/.test(layanan));

    const run = fsx.readFileSync(pathx.resolve(__dirname, "..", "tools", "ecourt-bridge", "run.js"), "utf8");
    periksa("jembatan memeriksa ruang lebih dulu", /bolehMenarik\(\)/.test(run));
    periksa("ruang menipis punya kode keluar sendiri", /KODE_KELUAR = 3/.test(run));
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama().catch((error) => {
  console.error("Gagal menjalankan pengujian:", error);
  process.exit(1);
});
