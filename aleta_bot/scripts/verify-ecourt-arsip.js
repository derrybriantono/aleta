#!/usr/bin/env node
"use strict";

/**
 * Memeriksa arsip berkas e-Court — Tahap A dan B.
 *
 *   node scripts/verify-ecourt-arsip.js
 *
 * ============================================================================
 * DUA CELAH YANG DITUTUP DI SINI
 * ============================================================================
 *
 *   A. Dokumen persidangan tidak pernah punya alamat unduh sama sekali.
 *      Pembaca halaman memisahkan dokumen dari teks yang SUDAH dibuang
 *      tagnya, sehingga seluruh <a href> ikut terhapus. Akibatnya Jawaban,
 *      Replik, dan Duplik - dokumen yang menjadi alasan fitur ini ada -
 *      tidak pernah terunduh, dan pemberitahuan terkirim tanpa lampiran
 *      dengan alasan "berkas belum tersedia".
 *
 *   B. Dokumen yang diganti tidak pernah ditarik ulang. Pemeriksaan "sudah
 *      pernah diunduh" memakai document_key saja, sehingga perbaikan yang
 *      diunggah ulang dengan judul sama dilewati diam-diam - dan hakim
 *      memverifikasi berkas yang bukan versi terakhir.
 */

const crypto = require("crypto");

// --- Tiruan database ---
const botDbPath = require.resolve("../services/botDbService");
const aslinya = require("../services/botDbService");
const berkas = [];
const dokumen = [];
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  addIndexIfMissing: async () => true,
  toMysqlDate: (v) => new Date(v).toISOString().slice(0, 19).replace("T", " "),
  fromMysqlDate: aslinya.fromMysqlDate,
  query: async (sql, params = []) => {
    if (/^\s*CREATE TABLE/i.test(sql)) return [];

    if (/SELECT id FROM aleta_bot_ecourt_files/i.test(sql)) {
      return berkas.filter((b) => b.document_key === params[0] && b.sidik_jari === params[1]);
    }
    if (/UPDATE aleta_bot_ecourt_files/i.test(sql)) {
      const b = berkas.find((x) => x.id === params[1]);
      if (b) b.terakhir_diperiksa = params[0];
      return { affectedRows: 1 };
    }
    if (/INSERT INTO aleta_bot_ecourt_files/i.test(sql)) {
      berkas.push({
        id: params[0], document_key: params[1], nomor_perkara: params[2],
        format: params[3], jalur_berkas: params[4], sidik_jari: params[5],
        ukuran_byte: params[6], tipe_isi: params[7], sumber_url: params[8],
        diunduh_pada: params[9], terakhir_diperiksa: params[10],
      });
      return { affectedRows: 1 };
    }
    if (/MAX\(terakhir_diperiksa\)/i.test(sql)) {
      const milik = berkas.filter((b) => b.document_key === params[0]);
      if (milik.length === 0) return [{ terakhir: null }];
      return [{ terakhir: milik.map((b) => b.terakhir_diperiksa).sort().pop() }];
    }
    if (/SELECT format, jalur_berkas/i.test(sql)) {
      return berkas.filter((b) => b.document_key === params[0]);
    }
    // --- karantina dokumen yang berulang gagal diambil ---
    if (/SET gagal_beruntun = gagal_beruntun \+ 1/i.test(sql)) {
      const d = dokumen.find((x) => x.document_key === params[2]);
      if (d) {
        d.gagal_beruntun = (d.gagal_beruntun || 0) + 1;
        d.gagal_sebab = params[0];
        d.gagal_terakhir = params[1];
      }
      return { affectedRows: 1 };
    }
    if (/SET gagal_beruntun = 0/i.test(sql)) {
      const d = dokumen.find((x) => x.document_key === params[0]);
      if (d) {
        d.gagal_beruntun = 0;
        d.gagal_sebab = "";
        d.gagal_terakhir = null;
      }
      return { affectedRows: 1 };
    }
    if (/SELECT gagal_beruntun AS gagal/i.test(sql)) {
      const d = dokumen.find((x) => x.document_key === params[0]);
      if (!d) return [];
      return [{ gagal: d.gagal_beruntun || 0, sebab: d.gagal_sebab || "", terakhir: d.gagal_terakhir || null }];
    }
    if (/WHERE gagal_beruntun >=/i.test(sql)) {
      return dokumen
        .filter((x) => (x.gagal_beruntun || 0) >= 3)
        .map((x) => ({
          documentKey: x.document_key,
          nomorPerkara: x.nomor_perkara || "",
          judulDokumen: x.judul_dokumen || "",
          gagal: x.gagal_beruntun,
          sebab: x.gagal_sebab || "",
          terakhir: x.gagal_terakhir || null,
        }));
    }

    if (/UPDATE aleta_bot_ecourt_documents SET berkas_/i.test(sql)) {
      const kolom = /berkas_word/.test(sql) ? "berkas_word" : "berkas_pdf";
      const d = dokumen.find((x) => x.document_key === params[2]);
      if (d) d[kolom] = params[0];
      return { affectedRows: 1 };
    }
    return [];
  },
};

const scraper = require("../tools/ecourt-bridge/scraper");
const store = require("../services/ecourtStoreService");

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

/** Potongan HTML yang meniru bentuk nyata halaman e-Court. */
const HTML = `
<ol>
  <li>
    Dokumen diupload oleh : <b>Tergugat - rusman.rusli73@gmail.com</b><br />
    Upload pada : Selasa, 09 Desember 2025 Jam : 11:30 WIB<br />
    Status Dokumen: Sudah diverifikasi Majelis/Hakim (Dokumen Valid)<br />
    Jenis : Jawaban<br />
    Judul Dokumen : Jawaban Tergugat Sri Astuti Ningsih<br />
    Dokumen : <a href="#" onclick="view_doc(9,1385073286)"><img src="ico/pdf.png">Lihat Dokumen</a>
              <a href="https://ecourt.mahkamahagung.go.id/ViewDoc/tampil_word/9/1385073286" target="_blank"><img src="ico/word.png">Lihat Dokumen</a>
  </li>
  <li>
    Dokumen diupload oleh : <b>Penggugat - vebrylawoffice@gmail.com</b><br />
    Upload pada : Selasa, 16 Desember 2025 Jam : 09:32 WIB<br />
    Status Dokumen: Belum diverifikasi<br />
    Jenis : Replik<br />
    Judul Dokumen : replik<br />
    Dokumen : <a href="#" onclick="view_doc(13,1385402263)">Lihat Dokumen</a>
  </li>
</ol>
`;

function sidikJari(teks) {
  return crypto.createHash("sha256").update(teks).digest("hex");
}

async function utama() {
  console.log("\n== A: dokumen persidangan akhirnya punya alamat unduh ==");
  {
    const hasil = scraper.extractHearingDocuments(HTML);
    periksa(`dua dokumen terbaca (${hasil.length})`, hasil.length === 2);

    const jawaban = hasil[0];
    periksa("judulnya benar", jawaban.judul === "Jawaban Tergugat Sri Astuti Ningsih");
    periksa("punya tautan", Array.isArray(jawaban.tautan) && jawaban.tautan.length === 2);
    // PDF hanya membawa PENANDA - alamatnya baru didapat setelah ditukar
    // lewat POST /ViewDoc/index/<tipe>/<id>. Word membawa alamatnya sendiri.
    periksa(
      "PDF dikenali lewat penandanya",
      jawaban.tautan.some(
        (t) => t.format === "pdf" && t.url === "" && t.penanda && t.penanda.id === "1385073286"
      )
    );
    periksa(
      "Word dikenali dengan alamat langsung",
      jawaban.tautan.some((t) => t.format === "word" && /tampil_word\/9\/1385073286$/.test(t.url))
    );
    periksa(
      "alamat Word menjadi alamat penuh",
      jawaban.tautan.some((t) => t.url.startsWith("https://ecourt.mahkamahagung.go.id/"))
    );

    // Bidang .url lama tidak boleh berisi alamat kosong milik PDF: yang
    // membacanya akan mengira dokumen ini tidak punya berkas sama sekali.
    periksa("url lama berisi alamat yang memang ada", /tampil_word\/9\/1385073286$/.test(jawaban.url));
  }

  console.log("\n== Tautan tidak bocor ke dokumen tetangga ==");
  {
    const hasil = scraper.extractHearingDocuments(HTML);
    // Replik hanya punya satu tautan; tautan Jawaban tidak boleh ikut terhitung.
    periksa("replik hanya punya satu tautan", hasil[1].tautan.length === 1);
    periksa(
      "penanda replik benar",
      hasil[1].tautan[0].penanda && hasil[1].tautan[0].penanda.id === "1385402263"
    );
  }

  console.log("\n== Halaman tanpa tautan tidak membuat galat ==");
  {
    const tanpa = scraper.extractHearingDocuments(
      "<li>Dokumen diupload oleh : <b>Tergugat - a@b.com</b><br />Judul Dokumen : Tanpa Berkas<br /></li>"
    );
    periksa("tetap terbaca", tanpa.length === 1);
    periksa("tautannya kosong, bukan galat", Array.isArray(tanpa[0].tautan) && tanpa[0].tautan.length === 0);
    periksa("url kosong", tanpa[0].url === "");
  }

  console.log("\n== B: berkas dicatat dengan sidik jari ==");
  {
    berkas.length = 0;
    dokumen.length = 0;
    dokumen.push({ document_key: "kunci-1", berkas_pdf: null, berkas_word: null });

    const pertama = await store.recordFile({
      documentKey: "kunci-1",
      nomorPerkara: "620/Pdt.G/2025/PA.Dgl",
      format: "pdf",
      jalurBerkas: "/arsip/jawaban__aaa.pdf",
      sidikJari: sidikJari("isi versi satu"),
      ukuranByte: 1024,
      tipeIsi: "application/pdf",
      sumberUrl: "https://ecourt/unduh/jawaban.pdf",
    });
    periksa("berkas pertama tercatat baru", pertama.baru === true);
    periksa("kolom lama ikut terisi", dokumen[0].berkas_pdf === "/arsip/jawaban__aaa.pdf");
  }

  console.log("\n== Isi yang sama tidak tersimpan dua kali ==");
  {
    const ulang = await store.recordFile({
      documentKey: "kunci-1",
      nomorPerkara: "620/Pdt.G/2025/PA.Dgl",
      format: "pdf",
      jalurBerkas: "/arsip/jawaban__aaa.pdf",
      sidikJari: sidikJari("isi versi satu"),
      ukuranByte: 1024,
    });
    periksa("dikenali sudah ada", ulang.sudahAda === true && ulang.baru === false);
    periksa("tidak menambah baris", berkas.length === 1);
  }

  console.log("\n== ATURAN POKOK: dokumen pengganti terdeteksi ==");
  {
    // Pihak mengunggah ulang perbaikan dengan judul yang sama. Isinya berbeda,
    // jadi sidik jarinya berbeda - dan inilah yang dulu terlewat diam-diam.
    const pengganti = await store.recordFile({
      documentKey: "kunci-1",
      nomorPerkara: "620/Pdt.G/2025/PA.Dgl",
      format: "pdf",
      jalurBerkas: "/arsip/jawaban__bbb.pdf",
      sidikJari: sidikJari("isi versi DUA yang sudah diperbaiki"),
      ukuranByte: 2048,
    });
    periksa("versi baru tercatat", pengganti.baru === true);
    periksa("kedua versi tersimpan", berkas.length === 2);
    periksa("versi lama TIDAK tertimpa", berkas.some((b) => b.jalur_berkas === "/arsip/jawaban__aaa.pdf"));
    periksa("kolom lama menunjuk versi terbaru", dokumen[0].berkas_pdf === "/arsip/jawaban__bbb.pdf");
  }

  console.log("\n== Kedua format tercatat terpisah ==");
  {
    await store.recordFile({
      documentKey: "kunci-1",
      nomorPerkara: "620/Pdt.G/2025/PA.Dgl",
      format: "word",
      jalurBerkas: "/arsip/jawaban__ccc.docx",
      sidikJari: sidikJari("isi word"),
      ukuranByte: 3072,
    });
    periksa("berkas word tercatat", berkas.some((b) => b.format === "word"));
    periksa("kolom berkas_word akhirnya terisi", dokumen[0].berkas_word === "/arsip/jawaban__ccc.docx");
    periksa("kolom pdf tidak ikut berubah", dokumen[0].berkas_pdf === "/arsip/jawaban__bbb.pdf");

    const daftar = await store.listFiles("kunci-1");
    periksa(`seluruh berkas terdaftar (${daftar.length})`, daftar.length === 3);
  }

  console.log("\n== Pemeriksaan ulang menargetkan yang paling mungkin diganti ==");
  {
    berkas.length = 0;
    periksa("belum punya berkas -> wajib periksa", (await store.needsRecheck("kunci-baru", "belum")) === true);

    // Baru saja diperiksa.
    const barusan = new Date().toISOString().slice(0, 19).replace("T", " ");
    berkas.push({ id: "x", document_key: "kunci-2", sidik_jari: "a", terakhir_diperiksa: barusan });
    periksa("baru diperiksa -> belum perlu", (await store.needsRecheck("kunci-2", "belum")) === false);

    // Dokumen BELUM diverifikasi, diperiksa 8 jam lalu (ambang 6 jam).
    berkas.length = 0;
    const delapanJam = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
    berkas.push({ id: "y", document_key: "kunci-3", sidik_jari: "b", terakhir_diperiksa: delapanJam });
    periksa("belum diverifikasi + 8 jam -> periksa lagi", (await store.needsRecheck("kunci-3", "belum")) === true);

    // Dokumen SUDAH diverifikasi jarang berubah; ambangnya 168 jam.
    periksa("sudah valid + 8 jam -> belum perlu", (await store.needsRecheck("kunci-3", "valid")) === false);
  }

  console.log("\n== Dokumen yang berulang gagal diistirahatkan ==");
  {
    // Sebagian dokumen memang tidak akan pernah dapat diunduh - tautannya
    // berbentuk yang belum dikenali, atau berkasnya sudah hilang di sisi
    // e-Court. Mencobanya tiap putaran memakan jatah, membebani server
    // Mahkamah Agung dengan permintaan yang pasti gagal, dan menenggelamkan
    // kegagalan BARU di antara kegagalan yang sama berulang-ulang.
    dokumen.length = 0;
    dokumen.push({ document_key: "kunci-gagal", nomor_perkara: "1/Pdt.G/2026/PA.Dgl", judul_dokumen: "Bukti" });

    const keadaan = async () => store.berkasDikarantina("kunci-gagal");

    periksa("belum pernah gagal -> tidak dikarantina", (await keadaan()).karantina === false);

    await store.catatGagalBerkas("kunci-gagal", "bukan_berkas (text/html)");
    periksa("gagal sekali belum dikarantina", (await keadaan()).karantina === false);
    await store.catatGagalBerkas("kunci-gagal", "bukan_berkas (text/html)");
    periksa("gagal dua kali belum dikarantina", (await keadaan()).karantina === false);

    await store.catatGagalBerkas("kunci-gagal", "bukan_berkas (text/html)");
    const ketiga = await keadaan();
    periksa("gagal tiga kali -> diistirahatkan", ketiga.karantina === true);
    periksa("sebabnya tersimpan apa adanya", ketiga.sebab === "bukan_berkas (text/html)");
    periksa("sisa waktunya disebutkan", ketiga.jamLagi > 0 && ketiga.jamLagi <= 24);

    // Sesudah jedanya lewat, dicoba LAGI - e-Court dapat memperbaiki berkasnya
    // kapan saja tanpa memberi tahu siapa pun.
    const dulu = new Date(Date.now() - 25 * 60 * 60 * 1000);
    dokumen[0].gagal_terakhir = dulu.toISOString().slice(0, 19).replace("T", " ");
    periksa("sesudah jeda 24 jam dicoba lagi", (await keadaan()).karantina === false);

    // Satu keberhasilan menghapus seluruh riwayatnya.
    await store.resetGagalBerkas("kunci-gagal");
    periksa("satu keberhasilan mengembalikan ke nol", dokumen[0].gagal_beruntun === 0);
    periksa("dan sebabnya ikut bersih", dokumen[0].gagal_sebab === "");

    // Yang diistirahatkan harus TETAP TERLIHAT. Yang diistirahatkan diam-diam
    // sama saja dengan yang hilang diam-diam.
    dokumen[0].gagal_beruntun = 4;
    dokumen[0].gagal_sebab = "alamat berkas pdf tidak diketahui";
    const daftar = await store.daftarBerkasBermasalah({ limit: 10 });
    periksa("dilaporkan pada daftar bermasalah", daftar.length === 1);
    periksa("beserta sebab dan jumlah gagalnya", daftar[0].gagal === 4 && /alamat berkas/.test(daftar[0].sebab));

    // Dokumen yang tidak dikenal tidak boleh menjatuhkan apa pun.
    periksa(
      "dokumen tak dikenal dijawab tidak dikarantina",
      (await store.berkasDikarantina("kunci-entah")).karantina === false
    );

    dokumen.length = 0;
  }

  console.log("\n== Pengunduh menghitung sidik jari sebelum menulis ==");
  {
    const fs = require("fs");
    const path = require("path");
    const sumber = fs.readFileSync(path.resolve(__dirname, "..", "tools", "ecourt-bridge", "run.js"), "utf8");

    periksa("memakai sha256", /createHash\("sha256"\)/.test(sumber));
    // Nama berkas memuat sidik jari supaya versi lama tidak tertimpa.
    periksa("nama berkas memuat sidik jari", /sidikJari\.slice\(0, 8\)/.test(sumber));
    // Isi hanya ditulis bila memang baru.
    // Yang dijaga SIFATNYA, bukan bunyi barisnya.
    //
    // Dulu pemeriksaan ini menuntut bentuk `catatan.baru && !fs.existsSync`,
    // dan bentuk itulah sumber keluhan "statusnya terunduh tetapi berkasnya
    // tidak ada": catatan disimpan lebih dulu, penulisannya gagal, lalu
    // penarikan berikutnya menjawab "bukan baru" dan melewatkan penulisannya
    // selamanya. Yang benar dijaga adalah tiga hal berikut.
    const simpanBerkasSrc = sumber.slice(
      sumber.indexOf("async function simpanBerkas"),
      sumber.indexOf("/** Menebak ekstensi")
    );
    // Yang dibandingkan PEMANGGILANNYA, bukan katanya - kata "recordFile"
    // juga muncul di dalam komentar yang menerangkan kekeliruan lama.
    periksa(
      "berkas ditulis lebih dulu, dicatat sesudah berhasil",
      simpanBerkasSrc.indexOf("fs.writeFileSync(") <
        simpanBerkasSrc.indexOf("ecourtStoreService.recordFile(")
    );
    periksa(
      "berkas yang sudah ada di disk tidak ditulis ulang",
      /if \(!fs\.existsSync\(target\)\)/.test(simpanBerkasSrc)
    );
    periksa(
      "yang dihapus masa simpan tidak ditulis kembali",
      /dihapusKarenaRetensi/.test(simpanBerkasSrc)
    );
    // Berkas yang HILANG berbeda dari yang dihapus masa simpan: yang hilang
    // harus ditarik ulang sekarang juga, tidak menunggu jeda pemeriksaan.
    periksa("berkas hilang memaksa pemeriksaan ulang", /jalurBerkasTercatat\(/.test(sumber));
    // Dua dokumen e-Court yang berbeda dapat berbagi satu kunci - berkas
    // pendaftaran berjudul sama, atau unggahan pihak yang sama dalam menit
    // yang sama. Yang kedua dulu ditolak pemeriksa ulang lalu dilewati
    // seluruhnya, dan berkasnya tidak pernah sampai ke server.
    periksa(
      "dokumen yang berbagi kunci tetap diunduh",
      /kunciTerpakai/.test(sumber) && /kunciBerulang/.test(sumber)
    );
    // Batas per putaran harus jatuh pada perkara yang MEMANG perlu diperiksa.
    // Membatasi daftar mentah lebih dulu membuat jatahnya habis untuk melewati
    // perkara yang sudah lengkap - dan perkara di urutan bawah, yang justru
    // paling mungkin baru menerima dokumen, tidak pernah tersentuh penjadwal.
    periksa(
      "yang sudah lengkap disingkirkan SEBELUM batas per putaran",
      sumber.indexOf("perkaraSudahLengkap(") <
        sumber.indexOf("tautan.slice(0, args.maksPerkara)")
    );
    // Menyaring yang lengkap saja belum cukup: perkara yang tidak pernah dapat
    // dilengkapi akan menempati barisan depan selamanya. Gilirannya diputar
    // menurut kapan perkaranya terakhir dibuka.
    periksa("giliran diputar, bukan urutan pendaftaran", /terakhirDiperiksaPerkara\(/.test(sumber));
    // Karantina hanya berguna bila penariknya benar-benar memakainya - ketiga
    // sisinya: memeriksa sebelum mencoba, mencatat saat gagal, dan
    // mengembalikan ke nol saat berhasil.
    periksa(
      "penarik menghormati karantina",
      /berkasDikarantina\(/.test(sumber) &&
        /catatGagalBerkas\(/.test(sumber) &&
        /resetGagalBerkas\(/.test(sumber)
    );
    // Bila hanya satu bentuk yang dapat diambil, yang tersimpan harus Word.
    periksa(
      "Word dicoba lebih dulu daripada PDF",
      /a\.format === "word" \? 0 : 1/.test(sumber)
    );
    // Dokumen yang terlihat tetapi tidak punya tautan apa pun dulu dilewati
    // tanpa suara, dan ringkasan penarikan tetap tampak bersih.
    periksa(
      "dokumen tanpa tautan dihitung sebagai galat",
      /tautan\.length === 0/.test(sumber) && /tautan berkas tidak ditemukan/.test(sumber)
    );
    periksa("kedua tautan diunduh", /for \(const item of tautan\)/.test(sumber));
    periksa("pemeriksaan ulang dipakai", /needsRecheck\(/.test(sumber));
    // recordDocument tidak boleh lagi mengirim jalur berkas: mengirim null
    // akan MENGHAPUS jalur yang baru saja diisi recordFile.
    periksa("recordDocument tidak lagi menimpa jalur berkas", !/^\s*berkasPdf,\s*$/m.test(sumber));
    // Me-require alat ini tidak boleh membuka peramban dan menyentuh e-Court.
    // Dua alat lain di folder yang sama sudah dijaga; berkas ini terlewat
    // sampai sebuah perintah require tidak sengaja menjalankannya.
    periksa("run.js tidak berjalan saat sekadar di-require", /require\.main === module/.test(sumber));
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
