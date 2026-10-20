// Tangkapan Playwright pratinjau BAS & relaas atas REPLIKA halaman SIPP (tanpa menyentuh SIPP/ABT/server sungguhan).
//
// Yang dijalankan SUNGGUHAN di Chromium: ekstensi-sipp/pratinjau-bas-relaas.js + deteksi-sisa-blangko.js, bersama
// potongan alatUnduh/alatNamaUnduhanLayak dari panel-alat.js. Yang ditiru: halaman SIPP (tabel Jadwal Sidang + borang
// cetak popup_form), berkas BAS/relaas (PDF dibuat Chromium sendiri), dan rute konversi-naskah (PDF dari HTML yang
// menirukan isi RTF - soffice tidak ada di laptop ini; di server yang bekerja soffice lewat bot).
// Host sipp.test dipetakan ke 127.0.0.1 supaya halaman BUKAN konteks aman, seperti http://192.168.10.10.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { chromium } = require("playwright");
const keluar = import.meta.dirname;
const EKS = path.join(AKAR, "ekstensi-sipp");
const baca = (b) => fs.readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n");

// ---- potongan panel-alat.js (sama dengan uji) ---------------------------------------------------------------
const ALAT = baca("panel-alat.js");
function potongFungsi(isi, nama) {
  const baris = isi.split("\n");
  return nama
    .map((n) => {
      const i = baris.findIndex((b) => new RegExp(`^(?:async )?function ${n}\\(`).test(b));
      let j = i;
      while (j < baris.length && baris[j] !== "}") j += 1;
      return baris.slice(i, j + 1).join("\n");
    })
    .join("\n\n");
}
const POTONGAN_ALAT = [
  ALAT.match(/const ALAT_AKHIRAN_TIPE = \{[\s\S]*?\n\};/)[0],
  ALAT.match(/const ALAT_POLA_NAMA_GENERIK = .*;/)[0],
  "const ALAT_TAUTAN_ASLI = new WeakSet();",
  potongFungsi(ALAT, ["alatTandaiTautanAsli", "alatLepasTautanAsli", "alatTautanAsli", "alatNamaUnduhanLayak", "alatBlobKeData", "alatUnduhLewatTautan", "alatUnduh"]),
].join("\n");

const TALI_STUB = `
window.__unduhan = [];
window.__tema = new URLSearchParams(location.search).get("tema") === "terang" ? "terang" : "gelap";
window.chrome = {
  runtime: { lastError: undefined, sendMessage(p, balik) { if (p.jenis === "unduh") window.__unduhan.push({ nama: p.nama, awal: String(p.alamat).slice(0, 40) }); balik({ ok: true, id: window.__unduhan.length }); } },
  storage: { onChanged: { addListener() {} }, local: { async get(k) { return Object.fromEntries(k.map((x) => [x, x === "temaPanel" ? window.__tema : undefined])); }, async set(b) { if (b.temaPanel) window.__tema = b.temaPanel; } } },
};
window.alatCatat = () => {};
window.alatAmbil = (alamat, opsi) => fetch(alamat, opsi);
// Chromium Playwright menjawab 204 untuk fetch() atas alamat berakhiran .pdf. Di sini tautan BAS .pdf dialihkan ke
// isi yang sama lewat alamat tanpa akhiran, lalu dibungkus Response bertipe application/pdf seperti jawaban Apache.
const fetchAsli = window.fetch.bind(window);
window.fetch = async (alamat, opsi) => {
  const a = String(alamat);
  if (!/_bas_1_1792347558\.pdf/.test(a)) return fetchAsli(alamat, opsi);
  const r = await fetchAsli("/ext/isi-bas", opsi);
  return new Response(await r.arrayBuffer(), { status: 200, headers: { "content-type": "application/pdf" } });
};
${POTONGAN_ALAT}
`;

// ---- berkas tiruan -----------------------------------------------------------------------------------------
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const bagianBas = (merah) => `<h2 style="text-align:center;margin:0">BERITA ACARA SIDANG</h2>
<p style="text-align:center;margin:0 0 18px">Perkara Nomor ${NOMOR}</p>
<p>Pada hari ini, Selasa tanggal 20 Oktober 2026, bertempat di ruang sidang Pengadilan Agama Donggala, telah dilangsungkan sidang perkara cerai gugat antara <b>Penggugat</b> melawan <b>Tergugat</b>, dengan susunan majelis hakim yang terdiri dari Hakim Ketua dan dua Hakim Anggota, dibantu Panitera Pengganti.</p>
<p>Pada hari sidang yang telah ditetapkan, Penggugat hadir menghadap sendiri di persidangan, sedangkan Tergugat tidak hadir dan tidak pula menyuruh orang lain untuk hadir sebagai wakil atau kuasanya, meskipun telah dipanggil secara resmi dan patut berdasarkan relaas panggilan.</p>
<p>Majelis hakim memerintahkan Penggugat untuk menghadirkan saksi pada sidang berikutnya, ${merah ? '<span style="color:#c00000">[NAMA SAKSI]</span>' : "yaitu dua orang saksi dari keluarga"} dan menetapkan sidang ditunda sampai dengan hari Selasa tanggal 3 November 2026 pukul 09.00 WITA.</p>
<p>Demikian berita acara ini dibuat dan ditandatangani oleh Ketua Majelis dan Panitera Pengganti.</p>
<table style="width:100%;margin-top:40px"><tr><td style="text-align:center">Hakim Ketua,<br><br><br><br>.....................</td><td style="text-align:center">Panitera Pengganti,<br><br><br><br>.....................</td></tr></table>`;
const htmlPdf = (merah) => `<!doctype html><meta charset="utf-8"><body style="font:13pt/1.55 'Times New Roman',serif;margin:2.2cm">${bagianBas(merah)}`;
const RTF_BAS = `{\\rtf1\\ansi{\\colortbl;\\red192\\green0\\blue0;}\\qc\\b BERITA ACARA SIDANG\\b0\\par Perkara Nomor ${NOMOR}\\par\\pard Pada hari ini, Selasa tanggal 20 Oktober 2026, telah dilangsungkan sidang perkara cerai gugat antara Penggugat melawan Tergugat.\\par Majelis hakim memerintahkan Penggugat untuk menghadirkan saksi pada sidang berikutnya, \\cf1 [NAMA SAKSI]\\cf0  dan menetapkan sidang ditunda sampai Selasa 3 November 2026.\\par}`;

// ---- replika halaman SIPP ----------------------------------------------------------------------------------
const HALAMAN = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>SIPP - Perkara ${NOMOR}</title><base href="/SIPP/">
<style>
body{margin:0;font:13px/1.45 Arial,Helvetica,sans-serif;background:#eef2ef;color:#1f2d27}
.atas{background:#008c4b;color:#fff;padding:10px 18px;font-weight:700;font-size:15px}
.isi{padding:16px 18px}
h3{margin:0 0 4px;font-size:16px} .sub{color:#4b5b54;margin-bottom:12px}
.tab{display:flex;gap:2px;margin-bottom:-1px}.tab span{padding:7px 12px;background:#d9e3dd;border:1px solid #c1cfc7;border-bottom:0;border-radius:4px 4px 0 0}.tab .a{background:#fff;font-weight:700}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #c1cfc7}th{background:#008c4b;color:#fff;text-align:left;padding:7px}td{border-top:1px solid #dbe5df;padding:8px;vertical-align:top}
.btn{display:inline-block;padding:3px 9px;border-radius:3px;color:#fff;text-decoration:none;font-size:12px}.b1{background:#f0ad4e}.b2{background:#337ab7}.b3{background:#777}
.popup{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
.pop{background:#fff;border:1px solid #888;width:430px;max-width:96vw}.pop .jdl{background:#008c4b;color:#fff;padding:8px 10px;font-weight:700}.pop table{border:0}.pop td{border:0;padding:6px 10px}
select{width:240px;max-width:60vw}
</style></head><body>
<div class="atas">SIPP &middot; Pengadilan Agama Donggala</div>
<div class="isi"><h3>Perkara ${NOMOR}</h3><div class="sub">Cerai Gugat &middot; Persidangan</div>
<div class="tab"><span>Data Umum</span><span class="a">Jadwal Sidang</span><span>Putusan</span><span>Penetapan</span></div>
<table><thead><tr><th>No</th><th>Tanggal Sidang</th><th>Agenda</th><th>Ruang</th><th>Dokumen</th><th>Cetak Dokumen</th></tr></thead><tbody>
<tr><td>1</td><td>13 Oktober 2026</td><td>Sidang Pertama</td><td>Ruang Sidang 1<br>(Penggugat hadir, Tergugat tidak hadir)<br><br>
 <a href="#" class="btn b1">Data Relaas</a><br><a class="btn b2" href="#">Data Persidangan</a><br>
 <a id="bas-pdf" target='_new' href=resources/file/doc/2026/10/PADgl_2026_PdtG_684_bas_1_1792347558.pdf><b>Unduh Dokumen BAS</b></a><br><a class="btn b3" href="#">Unggah BAS</a></td>
 <td>Relaas Penggugat: <span class="upload_relaas"><a id="relaas-jpg" target="_new" href="resources/file/doc/2026/10/PADgl_2026_PdtG_684_relaas_10260_18823_34395_1776311351.jpg?v=1">Lihat</a></span></td>
 <td><a href="#" id="buka-bas" onclick="document.getElementById('popup_form').style.display='flex';return false">[ BAS Lanjutan ]</a></td></tr>
<tr><td>2</td><td>20 Oktober 2026</td><td>Pembuktian</td><td>Ruang Sidang 1</td><td><span style="color:#c00;font-weight:700">Dokumen Belum Ada</span></td><td></td></tr>
</tbody></table></div>
<div class="popup" id="popup_form" style="display:none"><div class="pop"><div class="jdl">BERITA ACARA SIDANG LANJUTAN</div>
<form id="frm_pen_pp_pdt" method="POST" target="_self" action="/SIPP/c_template_bas_lanjutan_agama/cetak_bas_lanjutan_agama">
<input type="hidden" name="enc" value="ENC1"><input type="hidden" name="encjadwalsidang" value="ENC2">
<table><tr><td>Pilih Blangko</td><td><select name="blangko_bas_lanjutan_agama"><option value="BAS_03">BAS Lanjutan - Penggugat hadir</option></select></td></tr>
<tr><td colspan="2" align="center"><input type="button" value="Kembali" onclick="document.getElementById('popup_form').style.display='none'"> <input type="submit" id="simpan_btn" value="Cetak"></td></tr></table></form></div></div>
<script src="/ext/stub.js"></script><script src="/ext/deteksi-sisa-blangko.js"></script><script src="/ext/pratinjau-bas-relaas.js"></script>
</body></html>`;

// Catatan Chromium bawaan Playwright: fetch() atas jawaban application/pdf dijawab 204 kosong, sedangkan penampil PDF
// butuh ekstensi bawaan Chromium (dimatikan --disable-extensions). Maka penampil dinyalakan, dan berkas PDF replika
// dilayani sebagai application/octet-stream (modul mengenali PDF dari ISI-nya, bukan dari tipe; blob yang dipasang di
// iframe diberi tipe application/pdf oleh modul itu sendiri). Chromium Playwright juga menjawab 204 untuk fetch() atas
// alamat berakhiran .pdf/.bin TANPA query; tautan replika diberi ?v=1 (nama berkas tetap dibaca dari jalurnya).
const peramban = await chromium.launch({
  channel: "chromium",
  args: ["--host-resolver-rules=MAP sipp.test 127.0.0.1"],
  ignoreDefaultArgs: ["--disable-extensions", "--disable-component-extensions-with-background-pages", "--disable-default-apps"],
});
const permintaan = [];
let konversiMati = false;
const pembuat = await peramban.newContext();
async function pdfBas(merah) {
  const p = await pembuat.newPage();
  await p.setContent(htmlPdf(merah));
  const b = await p.pdf({ format: "A4" });
  await p.close();
  return b;
}
async function gambarRelaas() {
  const p = await pembuat.newPage({ viewport: { width: 640, height: 420 } });
  await p.setContent(`<body style="margin:0;font:15px Arial;background:#fff;padding:24px"><h3>RELAAS PANGGILAN</h3><p>Nomor ${NOMOR}</p><p>Pada hari Rabu 7 Oktober 2026 saya, Jurusita Pengganti, telah menyampaikan surat panggilan kepada Penggugat secara langsung di alamat yang tertera dan diterima oleh yang bersangkutan.</p><p style="margin-top:60px">Jurusita Pengganti,<br><br><br>.....................</p>`);
  const b = await p.screenshot({ type: "jpeg", quality: 80 });
  await p.close();
  return b;
}
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  permintaan.push(`${req.method} ${u.pathname}`);
  const kirimBiner = (tipe, isi, tambahan = {}) => {
    res.writeHead(200, { "content-type": tipe, "content-length": isi.length, ...tambahan });
    res.end(isi);
  };
  try {
    if (u.pathname === "/SIPP/index.php/perkara_detil/XYZ") return kirimBiner("text/html; charset=utf-8", Buffer.from(HALAMAN));
    if (u.pathname === "/ext/stub.js") return kirimBiner("text/javascript", Buffer.from(TALI_STUB));
    if (u.pathname === "/ext/deteksi-sisa-blangko.js") return kirimBiner("text/javascript", Buffer.from(baca("deteksi-sisa-blangko.js")));
    if (u.pathname === "/ext/pratinjau-bas-relaas.js") return kirimBiner("text/javascript", Buffer.from(baca("pratinjau-bas-relaas.js")));
    if (u.pathname.endsWith("_bas_1_1792347558.pdf") || u.pathname === "/ext/isi-bas") return kirimBiner("application/octet-stream", await pdfBas(false));
    if (u.pathname.endsWith(".jpg")) return kirimBiner("image/jpeg", await gambarRelaas());
    if (u.pathname === "/SIPP/c_template_bas_lanjutan_agama/cetak_bas_lanjutan_agama" && req.method === "POST") {
      return kirimBiner("application/vnd.ms-word", Buffer.from(RTF_BAS, "latin1"), {
        "content-disposition": 'attachment; filename="BAS_Lanjutan-684_Pdt.G_2026_PA.Dgl-2026-10-20.rtf"',
      });
    }
    if (u.pathname === "/aleta/api/aleta-ecourt/putusan/konversi-naskah" && req.method === "POST") {
      if (konversiMati) {
        res.writeHead(500, { "content-type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: { message: "Pengubah PDF di server sedang tidak tersedia." } }));
      }
      const pdf = await pdfBas(true);
      return kirimBiner("application/json", Buffer.from(JSON.stringify({ ok: true, data: { berkasBase64: pdf.toString("base64"), namaBerkas: "x.pdf", mime: "application/pdf" } })));
    }
    res.writeHead(404);
    res.end("tidak ada");
  } catch (g) {
    res.writeHead(500);
    res.end(String(g));
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const unduhanBrowser = [];
async function buka(tema, lebar, tinggi) {
  const konteks = await peramban.newContext({ viewport: { width: lebar, height: tinggi }, acceptDownloads: true });
  const p = await konteks.newPage();
  p.on("download", (d) => unduhanBrowser.push(d.suggestedFilename()));
  p.on("pageerror", (g) => console.log("galat halaman:", String(g).slice(0, 200)));
  await p.goto(`http://sipp.test:${port}/SIPP/index.php/perkara_detil/XYZ?tema=${tema}`);
  await p.waitForFunction(() => Boolean(window.aletaPratinjauBasRelaas));
  return { konteks, p };
}
const dalam = (p, sel) => p.locator(`#aleta-pratinjau-berkas ${sel}`);
const simpan = (p, nama) => p.screenshot({ path: path.join(keluar, nama) });
const hasil = [];
const periksa = (nama, benar) => {
  hasil.push([nama, benar]);
  console.log(`${benar ? "OK   " : "GAGAL"} ${nama}`);
};

try {
  // 1-4. Halaman SIPP asli, lalu klik tautan BAS (PDF) dan relaas (JPG)
  {
    const { konteks, p } = await buka("gelap", 1366, 760);
    await simpan(p, "1-halaman-sipp.png");
    permintaan.length = 0;
    await p.click("#bas-pdf");
    await p.waitForSelector("#aleta-pratinjau-berkas");
    await dalam(p, "iframe").waitFor();
    await p.waitForTimeout(1800);
    await simpan(p, "2-pratinjau-pdf-gelap.png");
    periksa("klik tautan BAS membuka pratinjau tanpa mengunduh", unduhanBrowser.length === 0 && (await dalam(p, "iframe").count()) === 1);
    periksa("berkas PDF diambil SATU kali dari SIPP", permintaan.filter((x) => x.includes("isi-bas")).length === 1);
    const tinggiIframe = await dalam(p, "iframe").evaluate((e) => e.getBoundingClientRect().height);
    periksa("iframe pratinjau berukuran besar", tinggiIframe > 400);
    await dalam(p, '[data-p="unduh"]').click();
    await p.waitForFunction(() => window.__unduhan.length === 1);
    const u = await p.evaluate(() => window.__unduhan[0]);
    periksa("tombol Unduh memakai nama berkas yang sama", u.nama === "PADgl_2026_PdtG_684_bas_1_1792347558.pdf" && u.awal.startsWith("data:application/pdf"));
    periksa("Unduh tidak meminta berkas kedua kali", permintaan.filter((x) => x.includes("isi-bas")).length === 1);
    await dalam(p, '[data-p="tema"]').click();
    await p.waitForTimeout(300);
    await simpan(p, "3-pratinjau-pdf-terang.png");
    await dalam(p, '[data-p="tutup"]').click();
    periksa("Tutup membuang kotak pratinjau", (await p.locator("#aleta-pratinjau-berkas").count()) === 0);

    await p.click("#relaas-jpg");
    await dalam(p, "img").waitFor();
    await p.waitForTimeout(300);
    await simpan(p, "4-pratinjau-relaas-gambar.png");
    periksa("relaas JPG tampil sebagai gambar", (await dalam(p, '[data-p="jenis"]').textContent()) === "Relaas");
    await p.keyboard.press("Escape");
    periksa("Esc menutup kotak", (await p.locator("#aleta-pratinjau-berkas").count()) === 0);
    await konteks.close();
  }

  // 5-6. Borang Cetak BAS (RTF) -> konversi -> PDF + peringatan sisa blangko
  {
    const { konteks, p } = await buka("gelap", 1366, 760);
    permintaan.length = 0;
    await p.click("#buka-bas");
    await p.waitForTimeout(150);
    await simpan(p, "5-borang-cetak-bas-sipp.png");
    await p.click("#simpan_btn");
    await dalam(p, "iframe").waitFor();
    await p.waitForFunction(() => {
      const r = document.querySelector("#aleta-pratinjau-berkas").shadowRoot;
      const w = r.querySelector('[data-p="peringatan"]');
      return w && !w.hidden;
    });
    await p.waitForTimeout(1800);
    await simpan(p, "6-pratinjau-rtf-sisa-blangko.png");
    periksa("Cetak (RTF) tidak menurunkan berkas, hanya pratinjau", unduhanBrowser.length === 0);
    periksa("borang dikirim SATU kali ke SIPP", permintaan.filter((x) => x.includes("cetak_bas_lanjutan")).length === 1);
    periksa("RTF diubah ke PDF lewat rute konversi", permintaan.filter((x) => x.includes("konversi-naskah")).length === 1);
    periksa("peringatan sisa blangko tampil", /masih memuat 1 sisa blangko/.test(await dalam(p, '[data-p="peringatan"]').textContent()));
    await dalam(p, '[data-p="unduh"]').click();
    await p.waitForFunction(() => window.__unduhan.length === 1);
    const u = await p.evaluate(() => window.__unduhan[0]);
    periksa("Unduh = RTF asli bernama dari SIPP", u.nama === "BAS_Lanjutan-684_Pdt.G_2026_PA.Dgl-2026-10-20.rtf" && u.awal.startsWith("data:"));
    await konteks.close();
  }

  // 7. Server pengubah PDF mati -> teks sederhana (HP, terang)
  {
    konversiMati = true;
    const { konteks, p } = await buka("terang", 390, 800);
    await p.click("#buka-bas");
    await p.click("#simpan_btn");
    await dalam(p, ".teks").waitFor();
    await p.waitForTimeout(300);
    await simpan(p, "7-cadangan-teks-hp-terang.png");
    periksa("server mati: tampil teks sederhana dengan sisa merah", (await dalam(p, ".teks mark").textContent()) === "[NAMA SAKSI]");
    await konteks.close();
    konversiMati = false;
  }
  // 8. PDF di HP (gelap)
  {
    const { konteks, p } = await buka("gelap", 390, 800);
    await p.click("#bas-pdf");
    await dalam(p, "iframe").waitFor();
    await p.waitForTimeout(1800);
    await simpan(p, "8-pratinjau-pdf-hp-gelap.png");
    await konteks.close();
  }
  // Shift-klik = unduh langsung
  {
    const { konteks, p } = await buka("gelap", 1366, 760);
    await p.click("#bas-pdf", { modifiers: ["Shift"] });
    await p.waitForFunction(() => window.__unduhan.length === 1);
    periksa("Shift-klik langsung mengunduh tanpa kotak", (await p.locator("#aleta-pratinjau-berkas").count()) === 0);
    await konteks.close();
  }
} finally {
  await peramban.close();
  server.close();
}
const gagal = hasil.filter((x) => !x[1]);
console.log(gagal.length ? `GAGAL: ${gagal.map((x) => x[0]).join("; ")}` : "semua pemeriksaan hijau");
process.exit(gagal.length ? 1 : 0);
