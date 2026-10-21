// Tangkapan Playwright pratinjau SEMUA dokumen SIPP atas REPLIKA halaman SIPP (tanpa menyentuh SIPP/ABT/server sungguhan).
// Dijalankan SUNGGUHAN: ekstensi-sipp/pratinjau-bas-relaas.js + unduh-halaman.js (+ deteksi-sisa-blangko.js) dengan potongan
// alatUnduh dari panel-alat.js. Yang ditiru: halaman SIPP (Data Umum dan Putusan), berkas (PDF buatan Chromium),
// pekerja latar (pesan ambil-berkas-sipp), rute konversi, dan keadaan "kosong" (pengelola unduhan merebut fetch).
// Keluaran ke D:/Aplikasi/aleta/tmp/w27-layar/ (atau argumen pertama).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { chromium } = require("playwright");
const keluar = process.argv[2] || "D:/Aplikasi/aleta/tmp/w27-layar";
fs.mkdirSync(keluar, { recursive: true });
const EKS = path.join(AKAR, "ekstensi-sipp");
const baca = (b) => fs.readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n");

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
window.__latar = [];
window.__fetchHalaman = [];
const P = new URLSearchParams(location.search);
window.__tema = P.get("tema") === "terang" ? "terang" : "gelap";
const KOSONG = P.get("kosong") === "1";
const fetchAsli = window.fetch.bind(window);
async function isiReplika(alamat) {
  const r = await fetchAsli("/ext/isi?u=" + encodeURIComponent(alamat));
  return new Uint8Array(await r.arrayBuffer());
}
window.chrome = {
  runtime: { lastError: undefined, sendMessage(p, balik) {
    if (p.jenis === "unduh") { window.__unduhan.push({ nama: p.nama, awal: String(p.alamat).slice(0, 40) }); balik({ ok: true, id: window.__unduhan.length }); }
    else if (p.jenis === "ambil-berkas-sipp") {
      window.__latar.push(p.alamat);
      if (KOSONG) return balik({ ok: false, kosong: true });
      isiReplika(p.alamat).then((b) => { let s = ""; for (const x of b) s += String.fromCharCode(x); balik({ ok: true, base64: btoa(s), tipe: "application/pdf", disposisi: "" }); });
    } else balik(undefined);
  } },
  storage: { onChanged: { addListener() {} }, local: { async get(k) { return Object.fromEntries(k.map((x) => [x, x === "temaPanel" ? window.__tema : undefined])); }, async set(b) { if (b.temaPanel) window.__tema = b.temaPanel; } } },
};
window.alatCatat = () => {};
window.alatAmbil = (alamat, opsi) => fetchAsli(alamat, opsi);
// Chromium Playwright menjawab 204 untuk fetch() atas .pdf; replika dialihkan ke /ext/isi dan dibungkus tipe application/pdf.
window.fetch = async (alamat, opsi) => {
  const a = String(alamat);
  if (/[.](pdf|docx)([?]|$)/.test(a)) {
    window.__fetchHalaman.push(a);
    if (KOSONG) return new Response(new Uint8Array(0), { status: 200, headers: { "content-type": "application/pdf" } });
    return new Response(await isiReplika(a), { status: 200, headers: { "content-type": "application/pdf" } });
  }
  return fetchAsli(alamat, opsi);
};
${POTONGAN_ALAT}
`;

const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const htmlIsi = (judul) => `<!doctype html><meta charset="utf-8"><body style="font:13pt/1.55 'Times New Roman',serif;margin:2.2cm"><h2 style="text-align:center;margin:0">${judul}</h2>
<p style="text-align:center;margin:0 0 18px">Perkara Nomor ${NOMOR}</p>
<p>Demi keadilan berdasarkan Ketuhanan Yang Maha Esa. Pengadilan Agama Donggala yang memeriksa dan mengadili perkara cerai gugat pada tingkat pertama telah menjatuhkan penetapan atau putusan sebagai berikut dalam perkara antara Penggugat melawan Tergugat.</p>
<p>Menimbang bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana tersebut di atas. Demikian ditetapkan dalam rapat permusyawaratan Majelis Hakim pada hari Selasa tanggal 20 Oktober 2026.</p>`;
const RTF_PUTUSAN = `{\\rtf1\\ansi\\qc\\b PUTUSAN\\b0\\par Perkara Nomor ${NOMOR}\\par\\pard Demi keadilan berdasarkan Ketuhanan Yang Maha Esa, Pengadilan Agama Donggala telah menjatuhkan putusan.\\par}`;

const HALAMAN = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>SIPP - Perkara ${NOMOR}</title><base href="/SIPP/">
<style>
body{margin:0;font:13px/1.45 Arial,Helvetica,sans-serif;background:#eef2ef;color:#1f2d27}
.atas{background:#008c4b;color:#fff;padding:10px 18px;font-weight:700;font-size:15px}
.isi{padding:16px 18px} h3{margin:0 0 4px;font-size:16px} .sub{color:#4b5b54;margin-bottom:12px}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #c1cfc7;margin-bottom:10px}th{background:#008c4b;color:#fff;text-align:left;padding:7px}td{border-top:1px solid #dbe5df;padding:8px;vertical-align:top}
.btn{display:inline-block;padding:3px 9px;border-radius:3px;color:#fff;text-decoration:none;font-size:12px;background:#337ab7}
</style></head><body>
<div class="atas">SIPP &middot; Pengadilan Agama Donggala</div>
<div class="isi"><h3>Perkara ${NOMOR}</h3><div class="sub">Cerai Gugat</div>
<table><tr><th colspan="2">Data Umum</th></tr>
<tr><td style="width:180px">E-Doc Gugatan</td><td><a id="gugatan" target='_self' href='resources/file/doc/2026/10/PADgl_2026_PdtG_684_petitum_1792468893.docx'>Unduh Dokumen</a></td></tr>
<tr><td>Penetapan Majelis Hakim (PMH)</td><td><a id="pmh" target="_blank" href="resources/file/doc/2026/10/684_PdtG_2026_PADgl/684_PdtG_2026_PADgl_Dokumen_PMH_1792438718.pdf">Unduh Dokumen</a></td></tr>
<tr><td>Penetapan Hari Sidang (PHS)</td><td><a id="phs" target="_blank" href="resources/file/doc/2026/10/684_PdtG_2026_PADgl/684_PdtG_2026_PADgl_Dokumen_PHS_1792438719.pdf">Unduh Dokumen</a></td></tr>
<tr><td>Putusan</td><td><a id="putusan" target="_blank" href="resources/file/doc/2026/10/PADgl_2026_PdtG_684_putusan_akhir_1792500000.pdf">Unduh Dokumen</a>
  &nbsp; <a class="btn" id="cetak-putusan" href="#" onclick="window.open('/SIPP/c_template_putusan_agama/cetak_putusan_gugur/ENC1','_self');return false">Cetak Putusan</a></td></tr>
<tr><td>Rekap Excel</td><td><a id="excel" href="resources/file/doc/2026/10/rekap.xlsx">Unduh Rekap</a></td></tr>
</table></div>
<script src="/ext/stub.js"></script><script src="/ext/deteksi-sisa-blangko.js"></script><script src="/ext/pratinjau-bas-relaas.js"></script><script src="/ext/unduh-halaman.js"></script>
</body></html>`;

const peramban = await chromium.launch({
  channel: "chromium",
  args: ["--host-resolver-rules=MAP sipp.test 127.0.0.1"],
  ignoreDefaultArgs: ["--disable-extensions", "--disable-component-extensions-with-background-pages", "--disable-default-apps"],
});
const permintaan = [];
const pembuat = await peramban.newContext();
const pdfCache = new Map();
async function pdf(judul) {
  if (pdfCache.has(judul)) return pdfCache.get(judul);
  const p = await pembuat.newPage();
  await p.setContent(htmlIsi(judul));
  const b = await p.pdf({ format: "A4" });
  await p.close();
  pdfCache.set(judul, b);
  return b;
}
const judulDari = (u) => (/Dokumen_PMH/.test(u) ? "PENETAPAN MAJELIS HAKIM" : /Dokumen_PHS/.test(u) ? "PENETAPAN HARI SIDANG" : /putusan/.test(u) ? "PUTUSAN" : "GUGATAN");
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  permintaan.push(`${req.method} ${u.pathname}`);
  const kirimBiner = (tipe, isi, tambahan = {}) => {
    res.writeHead(200, { "content-type": tipe, "content-length": isi.length, ...tambahan });
    res.end(isi);
  };
  try {
    if (u.pathname === "/SIPP/detil_perkara_agama") return kirimBiner("text/html; charset=utf-8", Buffer.from(HALAMAN));
    if (u.pathname === "/ext/stub.js") return kirimBiner("text/javascript", Buffer.from(TALI_STUB));
    for (const b of ["deteksi-sisa-blangko.js", "pratinjau-bas-relaas.js", "unduh-halaman.js"]) if (u.pathname === `/ext/${b}`) return kirimBiner("text/javascript", Buffer.from(baca(b)));
    if (u.pathname === "/ext/isi") return kirimBiner("application/octet-stream", await pdf(judulDari(u.searchParams.get("u") || "")));
    if (u.pathname.startsWith("/SIPP/resources/file/")) return kirimBiner("application/octet-stream", await pdf(judulDari(u.pathname)));
    if (u.pathname === "/SIPP/c_template_putusan_agama/cetak_putusan_gugur/ENC1") {
      return kirimBiner("application/vnd.ms-word", Buffer.from(RTF_PUTUSAN, "latin1"), { "content-disposition": 'attachment; filename="Putusan-684_Pdt.G_2026_PA.Dgl.rtf"' });
    }
    if (u.pathname === "/aleta/api/aleta-ecourt/putusan/konversi-naskah" && req.method === "POST") {
      const b = await pdf("PUTUSAN");
      return kirimBiner("application/json", Buffer.from(JSON.stringify({ ok: true, data: { berkasBase64: b.toString("base64"), namaBerkas: "x.pdf", mime: "application/pdf" } })));
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
async function buka(tema, lebar, tinggi, tambahan = "") {
  const konteks = await peramban.newContext({ viewport: { width: lebar, height: tinggi }, acceptDownloads: true });
  const p = await konteks.newPage();
  p.on("download", (d) => unduhanBrowser.push(d.suggestedFilename()));
  p.on("pageerror", (g) => console.log("galat halaman:", String(g).slice(0, 200)));
  await p.goto(`http://sipp.test:${port}/SIPP/detil_perkara_agama?tema=${tema}${tambahan}`);
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
  {
    const { konteks, p } = await buka("gelap", 1366, 760);
    await simpan(p, "1-halaman-sipp-dokumen.png");
    await p.click("#pmh");
    await dalam(p, "iframe").waitFor();
    await p.waitForTimeout(1800);
    await simpan(p, "2-pratinjau-penetapan-pmh.png");
    periksa("PMH: pratinjau tanpa unduhan peramban", unduhanBrowser.length === 0 && (await dalam(p, '[data-p="jenis"]').textContent()) === "Penetapan");
    periksa("PMH: diambil lewat pekerja latar, fetch halaman tidak dipakai", (await p.evaluate(() => window.__latar.length)) === 1 && (await p.evaluate(() => window.__fetchHalaman.length)) === 0);
    await dalam(p, '[data-p="unduh"]').click();
    await p.waitForFunction(() => window.__unduhan.length === 1);
    const u = await p.evaluate(() => window.__unduhan[0]);
    periksa("PMH: Unduh memakai nama berkas yang benar", u.nama === "684_PdtG_2026_PADgl_Dokumen_PMH_1792438718.pdf");
    await p.keyboard.press("Escape");

    await p.click("#gugatan");
    await dalam(p, "iframe").waitFor();
    await p.waitForTimeout(1200);
    await simpan(p, "3-pratinjau-gugatan-docx.png");
    periksa("Gugatan DOCX: jenis Gugatan / Permohonan", (await dalam(p, '[data-p="jenis"]').textContent()) === "Gugatan / Permohonan");
    await p.keyboard.press("Escape");

    permintaan.length = 0;
    await p.click("#cetak-putusan");
    await dalam(p, "iframe").waitFor();
    await p.waitForTimeout(1500);
    await simpan(p, "4-pratinjau-cetak-putusan-window-open.png");
    periksa("window.open(cetak putusan) dicegat: pratinjau, satu GET", (await dalam(p, '[data-p="jenis"]').textContent()) === "Putusan" && permintaan.filter((x) => x.includes("cetak_putusan_gugur")).length === 1);
    await p.keyboard.press("Escape");

    await p.click("#excel").catch(() => {});
    await p.waitForTimeout(400);
    periksa("tautan Excel tidak dicegat: tak ada kotak, peramban mengunduh apa adanya", (await p.locator("#aleta-pratinjau-berkas").count()) === 0 && unduhanBrowser.includes("rekap.xlsx"));
    await p.click("#putusan", { modifiers: ["Shift"] });
    await p.waitForFunction(() => window.__unduhan.length === 2);
    periksa("Shift-klik langsung mengunduh tanpa kotak", (await p.locator("#aleta-pratinjau-berkas").count()) === 0);
    await konteks.close();
  }
  {
    // Keadaan "kosong": pekerja latar tak menjawab dan fetch halaman pulang 0 bait (pengelola unduhan merebut permintaan)
    const { konteks, p } = await buka("terang", 1100, 640, "&kosong=1");
    unduhanBrowser.length = 0; // unduhan Excel di blok sebelumnya SENGAJA tak dicegat
    await p.click("#pmh");
    await dalam(p, ".galat").waitFor();
    await p.waitForTimeout(300);
    await simpan(p, "5-berkas-kosong-penjelasan.png");
    const teksGalat = await dalam(p, ".galat").textContent();
    periksa("kosong: penjelasan jelas, Unduh mati, tak ada unduhan otomatis", /pengelola unduhan/.test(teksGalat) && unduhanBrowser.length === 0 && (await dalam(p, '[data-p="unduh"]').isDisabled()));
    await konteks.close();
  }
  {
    const { konteks, p } = await buka("gelap", 390, 800);
    await p.click("#phs");
    await dalam(p, "iframe").waitFor();
    await p.waitForTimeout(1500);
    await simpan(p, "6-pratinjau-penetapan-hp-gelap.png");
    await konteks.close();
  }
} finally {
  await peramban.close();
  server.close();
}
const gagal = hasil.filter((x) => !x[1]);
console.log(gagal.length ? `GAGAL: ${gagal.map((x) => x[0]).join("; ")}` : "semua pemeriksaan hijau");
process.exit(gagal.length ? 1 : 0);
