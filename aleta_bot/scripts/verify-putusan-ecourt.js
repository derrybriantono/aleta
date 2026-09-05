"use strict";

const s = require("../tools/ecourt-bridge/scraper");
const layanan = require("../services/putusanEcourtService");

// --- Keadaan 1: tab Putusan ada, barisnya lengkap (tangkapan layar 5) -------
const lengkap = `
<div class="tab-content">
  <div class="tab-pane fade" id="detil_pendaftaran">Pendaftaran</div>
  <div class="tab-pane fade" id="persidangan">Persidangan</div>
  <div class="tab-pane fade active in" id="detil_putusan">
    <div class="row">
      <div class="panel-heading">INFORMASI PUTUSAN NOMOR : "348/Pdt.G/2026/PA.Dgl"</div>
      <table class="table table-email"><tbody>
        <tr><td width="20%" class="text-right">Tanggal Putusan</td><td style="font-style:italic;">Kamis, 09 Juli 2026</td></tr>
        <tr><td width="20%" class="text-right">Tanggal BHT</td><td style="font-style:italic;">Senin, 03 Agustus 2026</td></tr>
      </tbody></table>
    </div>
    <div class="row">
      <div class="panel-heading">SALINAN PUTUSAN NOMOR : 348/Pdt.G/2026/PA.Dgl</div>
      <table class="table table-email"><tbody>
        <tr>
          <td width="20%" class="text-right">Dokumen Salinan Putusan</td>
          <td style="font-style:italic;">
            <a href="https://ecourt.mahkamahagung.go.id/HalamanPendaftaran/fast_download/N_A2eDEwZDQyVmZkQ0FpO">
              <i class="fa fa-file-pdf-o"></i> Salinan Putusan 348/Pdt.G/2026/PA.Dgl
            </a>
          </td>
        </tr>
        <tr><td width="20%" class="text-right">Diupload Oleh</td><td style="font-style:italic;">arminhidayah86@gmail.com</td></tr>
        <tr><td width="20%" class="text-right">Tanggal Upload</td><td style="font-style:italic;">Kamis, 09 Juli 2026</td></tr>
        <tr><td width="20%" class="text-right">Panitera</td><td style="font-style:italic;">SRI SUSILOWATI, S.H. <span class="pull-right">Telah diperiksa tanggal 2026-07-13 13:38:28</span></td></tr>
      </tbody></table>
    </div>
  </div>
</div>`;

// --- Keadaan 2: tab ada, tetapi tidak ada baris putusan (tangkapan layar 1) -
const kosong = `
<div class="tab-content">
  <div class="tab-pane fade" id="detil_pendaftaran">Pendaftaran</div>
  <div class="tab-pane fade" id="detil_putusan">
    <!-- TAB PUTUSAN AKHIR -->
  </div>
</div>`;

// --- Keadaan 3: sudah ada baris, dokumen salinan BELUM diunggah -------------
const belumUnggah = `
<div class="tab-content">
  <div class="tab-pane fade active in" id="detil_putusan">
    <div class="panel-heading">INFORMASI PUTUSAN NOMOR : "458/Pdt.G/2026/PA.Dgl"</div>
    <table class="table table-email"><tbody>
      <tr><td width="20%" class="text-right">Tanggal Putusan</td><td>Senin, 31 Agustus 2026</td></tr>
      <tr><td width="20%" class="text-right">Tanggal BHT</td><td>-</td></tr>
      <tr><td width="20%" class="text-right">Dokumen Salinan Putusan</td><td><span class="text-muted">Belum ada dokumen</span></td></tr>
      <tr><td width="20%" class="text-right">Panitera</td><td></td></tr>
    </tbody></table>
  </div>
</div>`;

let lulus = 0;
let gagal = 0;
function cek(nama, dapat, harap) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  if (sama) {
    lulus += 1;
    console.log("  OK    " + nama);
  } else {
    gagal += 1;
    console.log("  GAGAL " + nama + "\n        harap " + JSON.stringify(harap) + ", dapat " + JSON.stringify(dapat));
  }
}

console.log("\n== Putusan e-Court lengkap ==");
const a = s.extractPutusanEcourt(lengkap);
cek("tab terbaca", a.adaTab, true);
cek("baris putusan ada", a.adaBaris, true);
cek("nomor putusan terbaca", a.nomorPutusan, "348/Pdt.G/2026/PA.Dgl");
cek("nomor salinan terbaca", a.nomorSalinan, "348/Pdt.G/2026/PA.Dgl");
cek("tanggal putusan terbaca", a.tanggalPutusanTeks, "Kamis, 09 Juli 2026");
cek("tanggal BHT terbaca", a.tanggalBhtTeks, "Senin, 03 Agustus 2026");
cek("dokumen salinan ada", a.dokumenSalinan.ada, true);
cek("judul salinan terbaca", /Salinan Putusan 348/.test(a.dokumenSalinan.judul), true);
cek("pengunggah terbaca", a.diunggahOleh, "arminhidayah86@gmail.com");
cek("tanggal unggah terbaca", a.tanggalUnggahTeks, "Kamis, 09 Juli 2026");
cek("panitera terbaca tanpa kalimat pemeriksaan", a.panitera.nama, "SRI SUSILOWATI, S.H.");
cek("TTE panitera dikenali", a.panitera.sudahTte, true);
cek("tanggal TTE terbaca", a.panitera.tanggalTte, "2026-07-13 13:38:28");

console.log("\n== Tab Putusan ada tetapi kosong ==");
const b = s.extractPutusanEcourt(kosong);
cek("tab terbaca", b.adaTab, true);
cek("baris putusan tidak ada", b.adaBaris, false);
cek("sebabnya disebut", b.alasan, "baris_putusan_kosong");

console.log("\n== Tab Putusan tidak ada sama sekali ==");
const c = s.extractPutusanEcourt('<div class="tab-content"><div class="tab-pane" id="persidangan">x</div></div>');
cek("tab tidak ada", c.adaTab, false);
cek("sebabnya disebut", c.alasan, "tab_putusan_tidak_ada");

console.log("\n== Baris ada, dokumen salinan belum diunggah ==");
const d = s.extractPutusanEcourt(belumUnggah);
cek("baris putusan ada", d.adaBaris, true);
cek("dokumen salinan belum ada", d.dokumenSalinan.ada, false);
cek("panitera belum TTE", d.panitera.sudahTte, false);
cek("BHT bertanda strip dibaca kosong", d.tanggalBhtTeks, "");

console.log("\n== Tab lain tidak ikut terbaca ==");
// Sifat yang dijaga: kata "Putusan" muncul di banyak tempat pada halaman ini.
// Memotong tabnya lebih dulu mencegah nilai dari tab lain ikut terbawa.
const bocor = s.extractPutusanEcourt(`
<div class="tab-content">
  <div class="tab-pane fade active in" id="persidangan">
    <table><tbody><tr><td>Diupload Oleh</td><td>orang-dari-tab-lain@contoh.id</td></tr></tbody></table>
  </div>
  <div class="tab-pane fade" id="detil_putusan">
    <div>INFORMASI PUTUSAN NOMOR : "1/Pdt.G/2026/PA.Dgl"</div>
  </div>
</div>`);
cek("nilai dari tab lain tidak bocor", bocor.diunggahOleh, "");
cek("nomor dari tab yang benar", bocor.nomorPutusan, "1/Pdt.G/2026/PA.Dgl");

console.log("\n== Halaman e-Court yang sesungguhnya (361/Pdt.G/2026/PA.Dgl) ==");
// Disalin dari halaman yang dibuka petugas, bukan dikarang. Yang membedakannya
// dari contoh lama: bagian INFORMASI PUTUSAN memuat AMAR putusan bertele-tele,
// dan sesudah baris Panitera masih ada SATU baris keterangan lagi - sehingga
// baris Panitera bukan baris terakhir tabel.
const halamanAsli = `
<div class="tab-content">
  <div class="tab-pane fade" id="detil_pendaftaran">Pendaftaran</div>
  <div class="tab-pane fade" id="persidangan">Persidangan</div>
  <div class="tab-pane fade active in" id="detil_putusan">
    <div class="panel-heading">INFORMASI PUTUSAN NOMOR : "361/Pdt.G/2026/PA.Dgl"</div>
    <table class="table table-email"><tbody>
      <tr><td width="20%" class="text-right">Tanggal Putusan</td><td style="font-style:italic;">Kamis, 09 Juli 2026</td></tr>
      <tr><td width="20%" class="text-right">Tanggal BHT</td><td style="font-style:italic;">Senin, 03 Agustus 2026</td></tr>
      <tr><td width="20%" class="text-right">Amar putusan</td><td><ol>
        <li>Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;</li>
        <li>Mengabulkan gugatan Penggugat secara verstek;</li>
        <li>Menjatuhkan talak satu ba'in sughra Tergugat (<b>Fahmil bin Aspar</b>) kepada Penggugat (<b>Fahimah alias Fahima binti Suaib</b>);</li>
        <li>Membebankan kepada Penggugat untuk membayar biaya perkara yang hingga kini sejumlah Rp<b>229000,00</b> ( dua ratus dua puluh sembilan ribu ).</li>
      </ol></td></tr>
    </tbody></table>
    <div class="panel-heading">SALINAN PUTUSAN NOMOR : 361/Pdt.G/2026/PA.Dgl</div>
    <table class="table table-email"><tbody>
      <tr><td width="20%" class="text-right">Dokumen Salinan Putusan</td><td style="font-style:italic;">
        <a href="https://ecourt.mahkamahagung.go.id/HalamanPendaftaran/fast_download/N_A2eDEwZDQyVmZkQ0FpO"><i class="fa fa-file-pdf-o"></i> Salinan Putusan 361/Pdt.G/2026/PA.Dgl</a>
        <button class="btn btn-warning pull-right">Edit Dokumen Salinan Putusan</button></td></tr>
      <tr><td width="20%" class="text-right">Diupload Oleh</td><td style="font-style:italic;">arminhidayah86@gmail.com</td></tr>
      <tr><td width="20%" class="text-right">Tanggal Upload</td><td style="font-style:italic;">Kamis, 09 Juli 2026</td></tr>
      <tr><td width="20%" class="text-right">Panitera</td><td style="font-style:italic;">SRI SUSILOWATI, S.H.
        <span class="pull-right"><i class="fa fa-check-circle text-success"></i> Telah diperiksa tanggal 2026-07-13 13:51:37</span></td></tr>
      <tr><td width="20%" class="text-right">Salinan Putusan</td><td style="font-style:italic;">Untuk Pengadilan hanya dapat melihatnya menggunakan User Panitera</td></tr>
    </tbody></table>
  </div>
</div>`;
const asli = s.extractPutusanEcourt(halamanAsli);
cek("nomor putusan terbaca", asli.nomorPutusan, "361/Pdt.G/2026/PA.Dgl");
cek("nomor salinan terbaca tanpa tanda kutip", asli.nomorSalinan, "361/Pdt.G/2026/PA.Dgl");
cek("tanggal putusan terbaca", asli.tanggalPutusanTeks, "Kamis, 09 Juli 2026");
cek("tanggal BHT terbaca", asli.tanggalBhtTeks, "Senin, 03 Agustus 2026");
cek("baris putusan ada", asli.adaBaris, true);
// Pengunggah salinan adalah HAKIM - baris ke-4 dari bawah.
cek("pengunggah hakim terbaca", asli.diunggahOleh, "arminhidayah86@gmail.com");
cek("tanggal unggah terbaca", asli.tanggalUnggahTeks, "Kamis, 09 Juli 2026");
// TTE Panitera menempel pada baris Panitera - baris ke-2 dari bawah, BUKAN
// baris terakhir. Di bawahnya masih ada baris "Salinan Putusan".
cek("nama panitera bersih dari kalimat pemeriksaan", asli.panitera.nama, "SRI SUSILOWATI, S.H.");
cek("TTE panitera dikenali", asli.panitera.sudahTte, true);
cek("tanggal TTE terbaca", asli.panitera.tanggalTte, "2026-07-13 13:51:37");
cek("dokumen salinan ada", asli.dokumenSalinan.ada, true);
cek("tautan salinan terbaca", /fast_download/.test(asli.dokumenSalinan.url), true);
{
  const K = layanan.KEADAAN;
  const keadaan = layanan.simpulkan({ sudahPutus: true }, {
    adaBaris: asli.adaBaris,
    dokumenAda: asli.dokumenSalinan.ada,
    paniteraTte: asli.panitera.sudahTte,
    paniteraNama: asli.panitera.nama,
    paniteraTanggalTte: asli.panitera.tanggalTte,
  });
  cek("kesimpulannya lengkap", keadaan.keadaan, K.LENGKAP);
  cek("dan tidak menuntut tindakan", keadaan.perluTindakan, false);
}

// Amar putusan yang panjang tidak boleh mengacaukan pembacaan, dan baris
// keterangan di bawah Panitera tidak boleh menggeser jendela TTE.
{
  const tambahBaris = halamanAsli.replace(
    "</tbody></table>\n  </div>\n</div>",
    `<tr><td width="20%" class="text-right">Keterangan</td><td>Baris tambahan yang disisipkan e-Court kemudian</td></tr>
    </tbody></table></div></div>`
  );
  const geser = s.extractPutusanEcourt(tambahBaris);
  cek("baris tambahan di bawahnya tidak menghilangkan TTE", geser.panitera.sudahTte, true);
}

console.log("\n== TTE Panitera pada BARIS TERSENDIRI di bawah namanya ==");
// Susunan yang dibacakan petugas dari halaman e-Court yang sesungguhnya:
//
//   baris ke-4 dari bawah : Diupload Oleh   <- hakim yang mengunggah
//   baris ke-3 dari bawah : Tanggal Upload
//   baris ke-2 dari bawah : Panitera
//   baris ke-1 dari bawah : tanda tangannya <- bukti TTE Panitera
//
// Kalimatnya karena itu TIDAK selalu menempel di dalam sel Panitera. Mencarinya
// hanya di sel itu membuat TTE yang sungguhan tidak pernah terbaca, dan seluruh
// perkara dilaporkan "belum TTE" - daftar yang penuh peringatan palsu berhenti
// dibaca orang.
const tteBarisSendiri = s.extractPutusanEcourt(`
<div class="tab-content">
  <div class="tab-pane fade active in" id="detil_putusan">
    <div class="panel-heading">SALINAN PUTUSAN NOMOR : "348/Pdt.G/2026/PA.Dgl"</div>
    <table class="table table-email"><tbody>
      <tr><td class="text-right">Tanggal Putusan</td><td>Kamis, 09 Juli 2026</td></tr>
      <tr><td class="text-right">Diupload Oleh</td><td>hakim.himawan@pa.go.id</td></tr>
      <tr><td class="text-right">Tanggal Upload</td><td>Kamis, 09 Juli 2026</td></tr>
      <tr><td class="text-right">Panitera</td><td>SRI SUSILOWATI, S.H.</td></tr>
      <tr><td class="text-right">Tanda Tangan Elektronik</td><td>Telah diperiksa tanggal 2026-07-13 13:38:28</td></tr>
    </tbody></table>
  </div>
</div>`);
cek("TTE pada baris tersendiri tetap terbaca", tteBarisSendiri.panitera.sudahTte, true);
cek("tanggalnya terbaca", tteBarisSendiri.panitera.tanggalTte, "2026-07-13 13:38:28");
cek("nama panitera dari barisnya sendiri", tteBarisSendiri.panitera.nama, "SRI SUSILOWATI, S.H.");
cek("pengunggahnya hakim, bukan panitera", tteBarisSendiri.diunggahOleh, "hakim.himawan@pa.go.id");

console.log("\n== TTE pejabat lain di atas bagian salinan tidak ikut terhitung ==");
// Kalimat yang sama dapat muncul pada bagian putusan di atasnya. Yang dibaca
// hanya dua baris terbawah - tempat tanda tangan Panitera - sehingga tanda
// tangan pejabat lain tidak menutupi kenyataan bahwa Panitera belum
// menandatangani, dan para pihak masih belum dapat mengambil salinannya.
const tteOrangLain = s.extractPutusanEcourt(`
<div class="tab-content">
  <div class="tab-pane fade active in" id="detil_putusan">
    <div class="panel-heading">INFORMASI PUTUSAN NOMOR : "458/Pdt.G/2026/PA.Dgl"</div>
    <table class="table table-email"><tbody>
      <tr><td class="text-right">Ketua Majelis</td><td>H. FAHRI <span>Telah diperiksa tanggal 2026-08-31 09:00:00</span></td></tr>
      <tr><td class="text-right">Diupload Oleh</td><td>hakim.fahri@pa.go.id</td></tr>
      <tr><td class="text-right">Tanggal Upload</td><td>Senin, 31 Agustus 2026</td></tr>
      <tr><td class="text-right">Panitera</td><td>SRI SUSILOWATI, S.H.</td></tr>
    </tbody></table>
  </div>
</div>`);
cek("TTE pejabat lain tidak dihitung sebagai TTE Panitera", tteOrangLain.panitera.sudahTte, false);
cek("dan tanggalnya tidak ikut terbawa", tteOrangLain.panitera.tanggalTte, "");
cek("nama panitera tetap terbaca", tteOrangLain.panitera.nama, "SRI SUSILOWATI, S.H.");

console.log("\n== Sudah diunggah walau tautannya belum muncul ==");
// Tautan unduh pada sebagian halaman baru muncul sesudah ditandatangani.
// Bertumpu pada tautan saja membuat perkara yang menunggu TTE Panitera
// dilaporkan "salinan belum diunggah" - menagih pengunggahnya, padahal yang
// ditunggu tanda tangan.
cek("keterangan unggah sudah cukup membuktikan salinannya ada", tteOrangLain.dokumenSalinan.ada, true);
cek("tautannya memang belum ada", tteOrangLain.dokumenSalinan.url, "");
{
  const K = layanan.KEADAAN;
  const keadaan = layanan.simpulkan({ sudahPutus: true }, {
    adaBaris: true,
    dokumenAda: tteOrangLain.dokumenSalinan.ada,
    paniteraTte: tteOrangLain.panitera.sudahTte,
    paniteraNama: tteOrangLain.panitera.nama,
    paniteraTanggalTte: "",
  });
  cek("kesimpulannya menunggu TTE, bukan menunggu unggahan", keadaan.keadaan, K.BELUM_TTE);
}

console.log("\n== Kolom bertanda hubung bukan nilai ==");
// e-Court menulis "-" pada kolom yang belum terisi. Memperlakukannya sebagai
// nilai membuat baris putusan yang kosong tampak sudah terbentuk, lalu
// perkaranya digolongkan "salinan belum diunggah" - padahal yang benar
// barisnya memang belum ada, dan itu keluhan "Menu Putusan E-Court Error".
const strip = s.extractPutusanEcourt(`
<div class="tab-content">
  <div class="tab-pane fade active in" id="detil_putusan">
    <table class="table table-email"><tbody>
      <tr><td class="text-right">Tanggal Putusan</td><td>-</td></tr>
      <tr><td class="text-right">Tanggal BHT</td><td>-</td></tr>
    </tbody></table>
  </div>
</div>`);
cek("tanggal putusan bertanda hubung dibaca kosong", strip.tanggalPutusanTeks, "");
cek("baris putusan dinyatakan belum ada", strip.adaBaris, false);
cek("sebabnya disebut", strip.alasan, "baris_putusan_kosong");

console.log("\n== Kesimpulan: SIPP versus e-Court ==");
{
  const K = layanan.KEADAAN;

  // Belum putus: tidak ada yang perlu diperiksa, dan tidak boleh ditandai.
  const belumPutus = layanan.simpulkan({ sudahPutus: false }, null);
  cek("belum putus tidak menuntut tindakan", belumPutus.perluTindakan, false);
  cek("belum putus keadaannya sendiri", belumPutus.keadaan, K.BELUM_PUTUS);

  // Sifat yang dijaga: TIDAK TAHU bukan tidak ada masalah, dan juga bukan
  // error. Perkara yang belum pernah ditarik tidak boleh dinyatakan lengkap
  // - itu menyembunyikan pekerjaan - maupun dituduhkan kepada e-Court.
  const belumTarik = layanan.simpulkan({ sudahPutus: true }, null);
  cek("belum ditarik bukan lengkap", belumTarik.keadaan === K.LENGKAP, false);
  cek("belum ditarik bukan error", belumTarik.keadaan === K.ERROR_ECOURT, false);
  cek("belum ditarik keadaannya sendiri", belumTarik.keadaan, K.BELUM_DITARIK);

  // Inilah yang diminta: sudah putus di SIPP, e-Court tidak punya barisnya.
  const error1 = layanan.simpulkan(
    { sudahPutus: true },
    { adaTab: true, adaBaris: false, alasan: "baris_putusan_kosong" }
  );
  cek("sudah putus tanpa baris e-Court = error", error1.keadaan, K.ERROR_ECOURT);
  cek("sebutannya persis seperti diminta", error1.sebutan, "Menu Putusan E-Court Error");
  cek("error menuntut tindakan", error1.perluTindakan, true);

  const error2 = layanan.simpulkan(
    { sudahPutus: true },
    { adaTab: false, adaBaris: false, alasan: "tab_putusan_tidak_ada" }
  );
  cek("tab yang tidak ada juga error", error2.keadaan, K.ERROR_ECOURT);
  cek("sebabnya dibedakan pada keterangannya", /tidak punya tab Putusan/.test(error2.keterangan), true);

  // Baris ada, dokumen belum diunggah.
  const belumUnggah = layanan.simpulkan(
    { sudahPutus: true },
    { adaTab: true, adaBaris: true, dokumenAda: false, paniteraTte: false }
  );
  cek("dokumen belum diunggah dikenali", belumUnggah.keadaan, K.BELUM_UNGGAH);
  cek("belum diunggah menuntut tindakan", belumUnggah.perluTindakan, true);

  // Dokumen ada, Panitera belum menandatangani.
  const belumTte = layanan.simpulkan(
    { sudahPutus: true },
    { adaTab: true, adaBaris: true, dokumenAda: true, paniteraTte: false }
  );
  cek("belum TTE dikenali", belumTte.keadaan, K.BELUM_TTE);
  cek("sebutan belum TTE persis seperti diminta", belumTte.sebutan, "Belum TTE oleh Panitera");
  cek("belum TTE menuntut tindakan", belumTte.perluTindakan, true);
  // Sifat yang dijaga: salinan tanpa tanda tangan TIDAK dapat diambil para
  // pihak - keterangannya harus menyebutkan akibatnya, bukan hanya keadaannya.
  cek("akibatnya disebutkan", /belum dapat mengambilnya/.test(belumTte.keterangan), true);

  // Lengkap.
  const lengkapKeadaan = layanan.simpulkan(
    { sudahPutus: true },
    {
      adaTab: true,
      adaBaris: true,
      dokumenAda: true,
      paniteraTte: true,
      paniteraNama: "SRI SUSILOWATI, S.H.",
      paniteraTanggalTte: "2026-07-13 13:38:28",
    }
  );
  cek("lengkap dikenali", lengkapKeadaan.keadaan, K.LENGKAP);
  cek("sebutan lengkap persis seperti diminta", lengkapKeadaan.sebutan, "Sudah di-TTE oleh Panitera");
  cek("lengkap tidak menuntut tindakan", lengkapKeadaan.perluTindakan, false);
  cek("nama panitera disebut", /SRI SUSILOWATI/.test(lengkapKeadaan.keterangan), true);

  // Urutannya berjenjang: kekurangan yang lebih awal menutupi yang sesudahnya.
  // Dokumen yang belum ada tidak boleh dilaporkan sebagai "belum TTE" - yang
  // ditagih akan menjadi orang yang salah.
  const berjenjang = layanan.simpulkan(
    { sudahPutus: true },
    { adaTab: true, adaBaris: false, dokumenAda: false, paniteraTte: false }
  );
  cek("kekurangan paling awal yang dilaporkan", berjenjang.keadaan, K.ERROR_ECOURT);
}

console.log("\nHasil: " + lulus + " lulus, " + gagal + " gagal\n");
process.exit(gagal === 0 ? 0 : 1);
