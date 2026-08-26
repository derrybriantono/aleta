#!/usr/bin/env node
"use strict";

/**
 * Memeriksa Jembatan e-Court Tahap 1-3.
 *
 *   node scripts/verify-ecourt-bridge.js
 *
 * Yang diuji paling keras di sini ada tiga, dan semuanya soal KESALAHAN YANG
 * TIDAK BISA DITARIK KEMBALI:
 *
 *   1. Dokumen yang BELUM diverifikasi majelis tidak boleh memicu pesan.
 *      Verifikasi di e-Court bisa dibatalkan; memberitahu pihak lebih dulu
 *      berarti menyampaikan sesuatu yang mungkin dicabut.
 *
 *   2. Pengunggah tidak boleh diberitahu tentang berkasnya sendiri, dan pesan
 *      tidak boleh nyasar ke pihak yang salah. Peran yang tidak dikenali harus
 *      menghasilkan TIDAK MENGIRIM, bukan mengirim ke semua orang.
 *
 *   3. Berkas di luar folder unduhan tidak boleh bisa dilampirkan, sekalipun
 *      namanya mengandung "..".
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

// Folder unduhan diarahkan ke folder sementara SEBELUM layanan dimuat, karena
// nilainya dibaca sekali saat modul pertama kali di-require.
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), "aleta-ecourt-"));
process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT = SANDBOX;

// db_config diganti tiruan agar pembacaan SIPP dapat diuji tanpa database
// sungguhan. Tiruan ini memakai bentuk CALLBACK yang sama dengan driver mysql
// asli - dan itulah yang sebenarnya diuji: bentuk pemanggilan yang keliru
// hanya akan ketahuan saat berjalan di produksi, terlalu terlambat.
const dbPath = require.resolve("../db_config");
require("../db_config");
const sippState = { rows: [], gagal: false, sqlTerakhir: "", paramsTerakhir: [] };
require.cache[dbPath].exports = {
  query(sql, params, callback) {
    sippState.sqlTerakhir = String(sql);
    sippState.paramsTerakhir = Array.isArray(params) ? params : [];
    const selesai = typeof params === "function" ? params : callback;
    if (typeof selesai !== "function") return;
    if (sippState.gagal) selesai(new Error("SIPP tidak dapat dijangkau"));
    else selesai(null, sippState.rows);
  },
};

const scraper = require("../tools/ecourt-bridge/scraper");
const teks = require("../services/ecourtTextService");
const klasifikasi = require("../services/ecourtEventClassifierService");
const dokumenService = require("../services/ecourtDocumentService");
const worker = require("../services/ecourtNotificationWorker");

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

/**
 * Potongan HTML yang meniru bentuk NYATA halaman e-Court PA Donggala,
 * disalin dari tangkapan layar perkara 620/Pdt.G/2025/PA.Dgl.
 */
const HTML_PERSIDANGAN = `
<div class="timeline">
  <p>Agenda Sidang : <b>Jawaban Tergugat</b> Silahkan Mengupload Berkas Persidangan Sebelum : Selasa, 09 Desember 2025 Pukul : 15:00:00 WIB</p>
  <p>Alasan di Tunda : <b>Replik Penggugat</b></p>
  <p>Dokumen Persidangan :</p>
  <ol>
    <li>
      Dokumen diupload oleh : <b>Tergugat - rusman.rusli73@gmail.com</b><br />
      Upload pada : Selasa, 09 Desember 2025 Jam : 11:30 WIB<br />
      Status Dokumen: Sudah diverifikasi Majelis/Hakim (Dokumen Valid)<br />
      Jenis : Jawaban<br />
      Judul Dokumen : Jawaban Tergugat Sri Astuti Ningsih<br />
      Dokumen : <a href="download/abc">Lihat Dokumen</a>
    </li>
  </ol>
  <p>Agenda Sidang : <b>Replik Penggugat</b> Silahkan Mengupload Berkas Persidangan Sebelum : Selasa, 16 Desember 2025 Pukul : 15:00:00 WIB</p>
  <ol>
    <li>
      Dokumen diupload oleh : <b>Penggugat - vebrylawoffice@gmail.com</b><br />
      Upload pada : Selasa, 16 Desember 2025 Jam : 09:32 WIB<br />
      Status Dokumen: Sudah diverifikasi Majelis/Hakim (Dokumen Valid)<br />
      Jenis : Replik<br />
      Judul Dokumen : replik<br />
      Dokumen : <a href="download/def">Lihat Dokumen</a>
    </li>
  </ol>
</div>
`;

const HTML_PENDAFTARAN = `
<tr><td>Dokumen Pendaftaran</td><td>
  Surat Kuasa Sri Astuti Ningsih | <a href="unduh/1">Download</a><br />
  Perubahan Gugatan Waris | <a href="unduh/2">Download</a><br />
  bukti surat | <a href="unduh/3">Download</a><br />
  Gugatan Waris | <a href="unduh/4">Download</a><br />
</td></tr>
<tr><td>Nomor Perkara</td><td>620/Pdt.G/2025/PA.Dgl</td></tr>
`;

async function utama() {
  console.log("\n== Teks e-Court: perbaikan penyandian rusak ==");
  {
    periksa("MedÃ¬asi dikenali rusak", teks.looksMojibake("MedÃ¬asi") === true);
    periksa("MedÃ¬asi dipulihkan", teks.repairEncoding("MedÃ¬asi") === "Medìasi");
    periksa("teks sehat tidak disentuh", teks.cleanText("Mediasi") === "Mediasi");
    periksa("nama beraksen sah tidak dirusak", teks.cleanText("Álvarez") === "Álvarez");
    periksa("spasi berlebih dirapikan", teks.cleanText("  Jawaban   Tergugat  ") === "Jawaban Tergugat");
    periksa("null aman", teks.cleanText(null) === "");
  }

  console.log("\n== Nomor perkara dan nama folder ==");
  {
    periksa("nomor dinormalkan", teks.normalizeCaseNumber(" 620 / Pdt.G / 2025 / PA.Dgl ") === "620/Pdt.G/2025/PA.Dgl");
    periksa("folder aman dari garis miring", teks.caseNumberToFolder("620/Pdt.G/2025/PA.Dgl") === "620-Pdt.G-2025-PA.Dgl");
    periksa("nomor kosong tetap punya folder", teks.caseNumberToFolder("") === "tanpa-nomor");
    periksa("nama berkas dibersihkan", teks.safeFileName('Jawaban/Tergugat: "A"', ".pdf") === "JawabanTergugat A.pdf");
  }

  console.log("\n== Pembacaan halaman detail perkara ==");
  {
    const detail = scraper.parseCaseDetail(HTML_PERSIDANGAN + HTML_PENDAFTARAN);
    periksa(`nomor perkara terbaca (${detail.nomorPerkara})`, detail.nomorPerkara === "620/Pdt.G/2025/PA.Dgl");
    periksa(`dua dokumen persidangan terbaca (${detail.dokumenPersidangan.length})`, detail.dokumenPersidangan.length === 2);
    periksa(`empat berkas pendaftaran terbaca (${detail.dokumenPendaftaran.length})`, detail.dokumenPendaftaran.length === 4);

    const jawaban = detail.dokumenPersidangan[0];
    periksa("judul dokumen benar", jawaban.judul === "Jawaban Tergugat Sri Astuti Ningsih");
    periksa("peran pengunggah benar", jawaban.peranPengunggah === "Tergugat");
    periksa("email pengunggah benar", jawaban.emailPengunggah === "rusman.rusli73@gmail.com");
    periksa("jenis dokumen benar", jawaban.jenis === "Jawaban");
    periksa("status terbaca", /Valid/i.test(jawaban.statusMentah));
    periksa(
      `tanggal unggah terurai (${jawaban.diunggahPada && jawaban.diunggahPada.toISOString().slice(0, 10)})`,
      jawaban.diunggahPada instanceof Date && jawaban.diunggahPada.getFullYear() === 2025 && jawaban.diunggahPada.getMonth() === 11
    );

    const replik = detail.dokumenPersidangan[1];
    periksa("dokumen kedua dari penggugat", replik.peranPengunggah === "Penggugat");

    const judulPendaftaran = detail.dokumenPendaftaran.map((item) => item.judul);
    periksa("Surat Kuasa terbaca", judulPendaftaran.includes("Surat Kuasa Sri Astuti Ningsih"));
    periksa("bukti surat terbaca", judulPendaftaran.includes("bukti surat"));
    periksa("tautan unduh menjadi alamat penuh", detail.dokumenPendaftaran[0].url.startsWith("https://ecourt.mahkamahagung.go.id/"));
  }

  console.log("\n== Tanggal Indonesia ==");
  {
    const a = scraper.parseIndonesianDate("Rabu, 19 Agustus 2026, Jam 08:11:02 WIB.");
    periksa("format dengan detik terurai", a instanceof Date && a.getDate() === 19 && a.getMonth() === 7);
    const b = scraper.parseIndonesianDate("Selasa, 09 Desember 2025 Jam : 11:30 WIB");
    periksa("format tanpa detik terurai", b instanceof Date && b.getHours() === 11 && b.getMinutes() === 30);
    periksa("teks ngawur -> null, bukan tebakan", scraper.parseIndonesianDate("entah kapan") === null);
    periksa("kosong -> null", scraper.parseIndonesianDate("") === null);
  }

  console.log("\n== Deteksi halaman login ==");
  {
    periksa("halaman login dikenali belum masuk", scraper.isLoggedInUrl("https://ecourt.mahkamahagung.go.id/Login") === false);
    periksa("halaman pendaftaran dikenali sudah masuk", scraper.isLoggedInUrl("https://ecourt.mahkamahagung.go.id/pendaftaran/abc") === true);
    periksa("halaman detail dikenali sudah masuk", scraper.isLoggedInUrl("https://ecourt.mahkamahagung.go.id/view_detil_pendaftaran/xyz") === true);
    periksa("situs lain ditolak", scraper.isLoggedInUrl("https://contoh.com/pendaftaran") === false);
    periksa("kosong ditolak", scraper.isLoggedInUrl("") === false);
  }

  console.log("\n== ATURAN POKOK: hanya dokumen terverifikasi yang memicu ==");
  {
    const dasar = { judulDokumen: "Jawaban Tergugat Sri Astuti", peranPengunggah: "Tergugat" };
    for (const status of ["belum", "tidak_valid", "", "entah"]) {
      const hasil = klasifikasi.decide({ ...dasar, statusVerifikasi: status }, {});
      periksa(`status "${status}" -> tidak dikirim`, hasil.notify === false);
    }
    const valid = klasifikasi.decide({ ...dasar, statusVerifikasi: "valid" }, {});
    periksa("status valid -> dikirim", valid.notify === true);
  }

  console.log("\n== ATURAN POKOK: yang diberitahu adalah pihak LAWAN ==");
  {
    const jawaban = klasifikasi.decide(
      { judulDokumen: "Jawaban Tergugat", peranPengunggah: "Tergugat", statusVerifikasi: "valid" },
      {}
    );
    periksa("Jawaban dari Tergugat -> beritahu Penggugat", jawaban.targetRole === "penggugat");

    const replik = klasifikasi.decide(
      { judulDokumen: "replik", peranPengunggah: "Penggugat", statusVerifikasi: "valid" },
      {}
    );
    periksa("Replik dari Penggugat -> beritahu Tergugat", replik.targetRole === "tergugat");

    periksa("Pemohon dianggap penggugat", klasifikasi.opposingRole("Pemohon") === "tergugat");
    periksa("Termohon dianggap tergugat", klasifikasi.opposingRole("Termohon") === "penggugat");
  }

  console.log("\n== Peran tidak dikenali -> TIDAK mengirim, bukan kirim ke semua ==");
  {
    for (const peran of ["Turut Tergugat", "", "Pihak Ketiga", null]) {
      const hasil = klasifikasi.decide(
        { judulDokumen: "Jawaban", peranPengunggah: peran, statusVerifikasi: "valid" },
        {}
      );
      periksa(`peran ${JSON.stringify(peran)} -> tidak dikirim`, hasil.notify === false);
    }
    periksa("peran ngawur -> null", klasifikasi.opposingRole("Saksi Ahli") === null);
  }

  console.log("\n== Berkas pendaftaran tidak diberitahukan ==");
  {
    for (const judul of ["Surat Kuasa Sri Astuti", "Gugatan Waris", "Perubahan Gugatan Waris", "SURAT GUGATAN"]) {
      const hasil = klasifikasi.decide({ judulDokumen: judul, peranPengunggah: "Penggugat", statusVerifikasi: "valid" }, {});
      periksa(`"${judul}" dilewati`, hasil.notify === false && hasil.reason === klasifikasi.SKIP_REASONS.BERKAS_PENDAFTARAN);
    }
  }

  console.log("\n== Putusan diserahkan ke jalur SIPP, tidak kembar ==");
  {
    for (const judul of ["Putusan Perkara", "Penetapan Majelis", "Amar Putusan"]) {
      const hasil = klasifikasi.decide({ judulDokumen: judul, peranPengunggah: "Tergugat", statusVerifikasi: "valid" }, {});
      periksa(`"${judul}" dilewati`, hasil.notify === false && hasil.reason === klasifikasi.SKIP_REASONS.DITANGANI_JALUR_LAIN);
    }
  }

  console.log("\n== Judul gabungan: yang MELARANG menang ==");
  {
    // "Jawaban atas Gugatan" cocok dengan kelas jawaban DAN pendaftaran.
    // Yang benar adalah tidak mengirim, karena kita tidak yakin dokumen apa itu.
    const hasil = klasifikasi.decide(
      { judulDokumen: "Jawaban atas Gugatan", peranPengunggah: "Tergugat", statusVerifikasi: "valid" },
      {}
    );
    periksa("tidak dikirim saat ragu", hasil.notify === false);
  }

  console.log("\n== Judul belum dikenali -> diam, bukan menebak ==");
  {
    const hasil = klasifikasi.decide(
      { judulDokumen: "Berkas Anu Yang Belum Pernah Ada", peranPengunggah: "Tergugat", statusVerifikasi: "valid" },
      {}
    );
    periksa("tidak dikirim", hasil.notify === false);
    periksa("alasannya dicatat", hasil.reason === klasifikasi.SKIP_REASONS.TIDAK_DIKENALI);
    periksa("tetap tercatat kelasnya", hasil.classes.includes("lainnya"));
  }

  console.log("\n== Isi pesan tidak menyebut nama pegawai ==");
  {
    const keputusan = klasifikasi.decide(
      { judulDokumen: "Jawaban Tergugat", peranPengunggah: "Tergugat", statusVerifikasi: "valid" },
      {}
    );
    const pesan = klasifikasi.buildMessage(
      { nomorPerkara: "620/Pdt.G/2025/PA.Dgl" },
      keputusan,
      { namaPihak: "Sulastri binti Djanggola" }
    );
    periksa("nomor perkara disebut", pesan.includes("620/Pdt.G/2025/PA.Dgl"));
    periksa("nama penerima disapa", pesan.includes("Sulastri binti Djanggola"));
    periksa("status verifikasi disampaikan", /diverifikasi majelis hakim/i.test(pesan));
    periksa("tidak menyebut nama hakim tertentu", !/hakim\s+[A-Z][a-z]+\s+[A-Z]/.test(pesan));
    periksa("tidak menyebut email pengunggah", !pesan.includes("@"));
    periksa("mengarahkan ke PTSP untuk salinan resmi", /PTSP/.test(pesan));
    periksa("tanpa nama penerima tetap sopan", klasifikasi.buildMessage({ nomorPerkara: "1/X/2026/PA.Dgl" }, keputusan, {}).includes("Sdr/Sdri"));
  }

  console.log("\n== Penjagaan berkas: tidak boleh keluar folder unduhan ==");
  {
    const folderAman = path.join(SANDBOX, "620-Pdt.G-2025-PA.Dgl");
    fs.mkdirSync(folderAman, { recursive: true });
    const berkasAman = path.join(folderAman, "Jawaban.pdf");
    fs.writeFileSync(berkasAman, "%PDF-1.4 isi contoh");

    periksa("berkas di dalam folder diterima", dokumenService.describeEcourtDocument(berkasAman).ok === true);
    periksa("path relatif diterima", dokumenService.describeEcourtDocument("620-Pdt.G-2025-PA.Dgl/Jawaban.pdf").ok === true);

    const berkasLuar = path.join(os.tmpdir(), "di-luar-folder.pdf");
    fs.writeFileSync(berkasLuar, "%PDF-1.4");
    periksa("berkas di luar folder DITOLAK", dokumenService.describeEcourtDocument(berkasLuar).ok === false);
    periksa("jalan pintas .. DITOLAK", dokumenService.describeEcourtDocument("../../etc/passwd").ok === false);
    periksa("path kosong ditolak", dokumenService.describeEcourtDocument("").ok === false);
    periksa("berkas tidak ada ditolak", dokumenService.describeEcourtDocument("620-Pdt.G-2025-PA.Dgl/tidak-ada.pdf").ok === false);

    const berkasAneh = path.join(folderAman, "berkas.exe");
    fs.writeFileSync(berkasAneh, "MZ");
    periksa("ekstensi tidak didukung ditolak", dokumenService.describeEcourtDocument(berkasAneh).ok === false);

    const berkasKosong = path.join(folderAman, "kosong.pdf");
    fs.writeFileSync(berkasKosong, "");
    periksa("berkas 0 byte ditolak", dokumenService.describeEcourtDocument(berkasKosong).ok === false);
  }

  console.log("\n== Pemilihan lampiran: PDF didahulukan ==");
  {
    const folder = path.join(SANDBOX, "620-Pdt.G-2025-PA.Dgl");
    const pdf = path.join(folder, "Jawaban.pdf");
    const word = path.join(folder, "Jawaban.docx");
    fs.writeFileSync(word, "PK isi contoh");

    const keduanya = dokumenService.pickBestAttachment({ berkasPdf: pdf, berkasWord: word });
    periksa("PDF dipilih saat keduanya ada", keduanya.ok === true && keduanya.jenis === "pdf");

    const hanyaWord = dokumenService.pickBestAttachment({ berkasPdf: null, berkasWord: word });
    periksa("Word dipakai bila PDF tidak ada", hanyaWord.ok === true && hanyaWord.jenis === "word");

    const rusak = dokumenService.pickBestAttachment({ berkasPdf: path.join(folder, "hilang.pdf"), berkasWord: word });
    periksa("PDF hilang -> jatuh ke Word", rusak.ok === true && rusak.jenis === "word");

    const kosong = dokumenService.pickBestAttachment({});
    periksa("tanpa berkas -> gagal dengan alasan", kosong.ok === false && kosong.reason.length > 10);
  }

  console.log("\n== Penyaringan penerima menurut peran ==");
  {
    const pihak = [
      { nama: "Sulastri", pihak_ke: 1, telepon: "085242120977" },
      { nama: "Sri Astuti", pihak_ke: 2, telepon: "081245004420" },
      { nama: "Turut Tergugat", pihak_ke: 4, telepon: "085299192118" },
    ];
    periksa("penggugat tersaring", worker.filterByRole(pihak, "penggugat").map((r) => r.nama).join() === "Sulastri");
    periksa("tergugat tersaring", worker.filterByRole(pihak, "tergugat").map((r) => r.nama).join() === "Sri Astuti");
    periksa("peran null -> KOSONG, bukan semua", worker.filterByRole(pihak, null).length === 0);
    periksa("peran ngawur -> KOSONG", worker.filterByRole(pihak, "entah").length === 0);
    periksa("daftar kosong aman", worker.filterByRole([], "penggugat").length === 0);
  }

  console.log("\n== Pembacaan pihak dari SIPP ==");
  {
    sippState.gagal = false;
    sippState.rows = [
      { nama: "Sulastri binti Djanggola", pihak_ke: 1, jenis: "pihak", telepon: "085242120977" },
      { nama: "Sri Astuti Ningsih", pihak_ke: 2, jenis: "pihak", telepon: "081245004420" },
    ];

    const hasil = await worker.fetchCaseParties("620/Pdt.G/2025/PA.Dgl");
    periksa(`pihak terbaca (${hasil.length})`, Array.isArray(hasil) && hasil.length === 2);
    periksa("nomor perkara dikirim sebagai parameter, bukan disambung ke SQL",
      sippState.paramsTerakhir.includes("620/Pdt.G/2025/PA.Dgl") && !sippState.sqlTerakhir.includes("620/Pdt.G"));
    periksa("kueri membaca pihak dan kuasa hukum",
      /v_pihak_perkara/.test(sippState.sqlTerakhir) && /perkara_pengacara/.test(sippState.sqlTerakhir));
    periksa("kueri hanya SELECT", /^\s*SELECT/i.test(sippState.sqlTerakhir.trim()) && !/INSERT|UPDATE|DELETE/i.test(sippState.sqlTerakhir));

    // Galat harus MELEMPAR, bukan mengembalikan daftar kosong. Daftar kosong
    // akan diperlakukan sebagai "tidak ada pihak yang bisa dihubungi" lalu
    // ditandai dilewati permanen - padahal databasenya hanya sedang bermasalah
    // dan dokumennya masih sah untuk diberitahukan nanti.
    sippState.gagal = true;
    let melempar = false;
    try {
      await worker.fetchCaseParties("620/Pdt.G/2025/PA.Dgl");
    } catch {
      melempar = true;
    }
    sippState.gagal = false;
    periksa("SIPP bermasalah -> melempar, bukan daftar kosong", melempar === true);
  }

  console.log("\n== Nomor telepon: hanya yang sah, tanpa kembar ==");
  {
    const hasil = worker.collectValidNumbers([
      { nama: "A", telepon: "085242120977" },
      { nama: "B", telepon: "6285242120977" },
      { nama: "C", telepon: "-" },
      { nama: "D", telepon: "" },
      { nama: "E", telepon: "081245004420" },
    ]);
    periksa(`nomor kembar digabung (${hasil.length} nomor)`, hasil.length === 2);
    periksa("nomor tidak sah dibuang", hasil.every((item) => item.nomor.includes("@c.us")));
  }

  console.log("\n== Kunci identitas dokumen ==");
  {
    const store = require("../services/ecourtStoreService");
    const dasar = {
      nomorPerkara: "620/Pdt.G/2025/PA.Dgl",
      judulDokumen: "Jawaban Tergugat",
      emailPengunggah: "a@b.com",
      diunggahPada: new Date(2025, 11, 9, 11, 30),
    };
    const kunci1 = store.buildDocumentKey(dasar);
    const kunci2 = store.buildDocumentKey({ ...dasar });
    periksa("kunci sama untuk data sama", kunci1 === kunci2);
    periksa("kunci beda untuk judul beda", kunci1 !== store.buildDocumentKey({ ...dasar, judulDokumen: "Replik" }));
    periksa("spasi berlebih tidak mengubah kunci", kunci1 === store.buildDocumentKey({ ...dasar, judulDokumen: "  Jawaban   Tergugat " }));
    periksa("huruf besar-kecil tidak mengubah kunci", kunci1 === store.buildDocumentKey({ ...dasar, judulDokumen: "JAWABAN TERGUGAT" }));

    // Status verifikasi TIDAK boleh jadi bahan kunci: status memang berubah
    // dari belum menjadi valid, dan bila ikut jadi bahan kunci maka dokumen
    // yang sama akan dianggap dokumen baru begitu majelis memverifikasinya.
    const sumber = fs.readFileSync(path.resolve(__dirname, "..", "services", "ecourtStoreService.js"), "utf8");
    const badan = sumber.match(/function buildDocumentKey[\s\S]*?\n}/);
    periksa("status verifikasi bukan bahan kunci", badan && !/status/i.test(badan[0]));
  }

  console.log("\n== Normalisasi status verifikasi ==");
  {
    const store = require("../services/ecourtStoreService");
    periksa("teks e-Court asli -> valid", store.normalizeStatus("Sudah diverifikasi Majelis/Hakim (Dokumen Valid)") === "valid");
    periksa("tidak valid dikenali", store.normalizeStatus("Dokumen Tidak Valid") === "tidak_valid");
    periksa("ditolak dikenali", store.normalizeStatus("Ditolak majelis") === "tidak_valid");
    periksa("kosong -> belum", store.normalizeStatus("") === "belum");
    periksa("tidak dikenali -> belum, bukan valid", store.normalizeStatus("entah apa") === "belum");
  }

  console.log("\n== SIPP tidak pernah ditulis ==");
  {
    for (const berkas of ["ecourtStoreService.js", "ecourtNotificationWorker.js", "ecourtDocumentService.js"]) {
      const sumber = fs.readFileSync(path.resolve(__dirname, "..", "services", berkas), "utf8");
      const menulis = /\b(INSERT INTO|UPDATE|DELETE FROM)\b/gi;
      const semua = sumber.match(menulis) || [];
      // Tulisan hanya boleh ke tabel milik ALETA sendiri.
      const keSipp = semua.length > 0 && /INSERT INTO (?!aleta_bot_)/i.test(sumber);
      periksa(`${berkas}: tidak menulis ke tabel SIPP`, keSipp === false);
    }
    const workerSumber = fs.readFileSync(path.resolve(__dirname, "..", "services", "ecourtNotificationWorker.js"), "utf8");
    periksa("pekerja hanya SELECT dari SIPP", !/db\.query\([^)]*(INSERT|UPDATE|DELETE)/i.test(workerSumber));
  }

  console.log("\n== Jembatan tidak menyentuh captcha ==");
  {
    const runSumber = fs.readFileSync(path.resolve(__dirname, "..", "tools", "ecourt-bridge", "run.js"), "utf8");
    // Captcha hanya boleh disebut di komentar penjelasan, tidak pernah dibaca
    // maupun diisi. Yang dicari di sini adalah TINDAKAN terhadap captcha.
    periksa("tidak mengisi kolom captcha", !/type\(['"][^'"]*captcha/i.test(runSumber));
    periksa("tidak membaca gambar captcha", !/captcha[^\n]*(screenshot|ocr|solve|recognize)/i.test(runSumber));
    periksa("peramban dibuka terlihat", /headless:\s*false/.test(runSumber));
    periksa("menunggu login manual", /waitForManualLogin/.test(runSumber));
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  try {
    fs.rmSync(SANDBOX, { recursive: true, force: true });
  } catch {
    /* folder sementara dibersihkan sistem bila gagal */
  }

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
