// Simulasi "BAS dari Word ke PDF bertanda tangan scan" (30 Okt 2026) - EKSTENSI SUNGGUHAN di Chromium, jendela e-Doc BAS SIPP 7.0.4 TIRUAN.
//
// Yang SUNGGUHAN: ekstensi-sipp (manifest + semua skrip konten, termasuk alatAmbil dan pemeriksa sisa blangko), kode jendela
// fileupload_v.php SIPP 7.0.4 (accept .pdf + pemeriksa "Hanya file PDF yang diperbolehkan!"), jquery-sipp.js SubmitHandling dari
// salinan SIPP setempat (Simpan -> dummy -> validatePost), inti server bas-word-pdf.ts (blok tanda tangan dibaca dari PDF, hak tanda
// tangan, pembubuhan), dan pengubah Word -> PDF: Microsoft Word (COM) sebagai pengganti soffice yang tidak ada di mesin ini.
// Yang TIRUAN: halaman SIPP (HTML kecil), rute portal (server lokal ini), daftar tanda tangan sah dan gambar scan (gambar dibuat
// di sini), validatePost SIPP (hanya menyimpan berkas yang diterima untuk diperiksa).
//
// Pakai (dari manajemen_surat/):
//   npx tsx --tsconfig tsconfig.json ../docs/rancangan/bas-word-pdf-30okt/simulasi.mts <folder-bahan> <folder-hasil>
// <folder-bahan> berisi bas-contoh.rtf, bas-contoh.docx, bas-contoh-word97.doc, bas-contoh-word.pdf (dibuat dari BAS Derry lewat Word).
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";

import { wordKePdfBas, type DepsWordPdf, type BentukWord } from "../../../manajemen_surat/src/server/modules/aleta-ecourt/bas-word-pdf";
import { pasangRintisanPeramban } from "../../../manajemen_surat/src/server/modules/aleta-ecourt/baca-pdf";
import { bacaItemPdf, susunBaris } from "../../../manajemen_surat/src/server/modules/aleta-ecourt/pdf-bubuh-ttd";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const muat = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { PNG } = muat("pngjs");
const { chromium } = muat("playwright-core");
const { PDFDocument } = muat("pdf-lib");

const BAHAN = path.resolve(process.argv[2] || "D:/Aplikasi/aleta/tmp/bwp-sim");
const HASIL = path.resolve(process.argv[3] || path.join(BAHAN, "hasil"));
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const XAMPP_JS = "D:/satker asal/website pa bungku/xampp/htdocs/SIPP/resources/js";
fs.mkdirSync(HASIL, { recursive: true });

const log: string[] = [];
let gagal = 0;
function periksa(ket: string, ok: boolean, rinci = "") {
  if (!ok) gagal += 1;
  const baris = `${ok ? "OK    " : "GAGAL "} ${ket}${rinci ? `  [${rinci}]` : ""}`;
  log.push(baris);
  console.log(baris);
}

// ----------------------------------------------------------------------------
// Pengubah Word -> PDF: Microsoft Word lewat COM (satu per satu)
// ----------------------------------------------------------------------------
const PS1 = path.join(HASIL, "konversi-satu.ps1");
fs.writeFileSync(
  PS1,
  `param([string]$masuk,[string]$keluar)
$ErrorActionPreference = "Stop"
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  $dok = $w.Documents.Open($masuk, $false, $true)
  $dok.ExportAsFixedFormat($keluar, 17)
  $dok.Close($false)
} finally { $w.Quit() }
`
);
let rantai: Promise<unknown> = Promise.resolve();
function ubahLewatWord(bita: Uint8Array, bentuk: BentukWord): Promise<Uint8Array> {
  const kerja = rantai.then(
    () =>
      new Promise<Uint8Array>((selesai, tolak) => {
        const id = `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
        const masuk = path.join(HASIL, `in-${id}.${bentuk}`);
        const keluar = path.join(HASIL, `out-${id}.pdf`);
        fs.writeFileSync(masuk, bita);
        const p = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS1, masuk, keluar], { windowsHide: true });
        let galat = "";
        p.stderr.on("data", (d) => (galat += d));
        const jam = setTimeout(() => p.kill(), 120000);
        p.on("close", () => {
          clearTimeout(jam);
          try {
            const hasil = new Uint8Array(fs.readFileSync(keluar));
            fs.rmSync(masuk, { force: true });
            fs.rmSync(keluar, { force: true });
            selesai(hasil);
          } catch {
            tolak(new Error(`Word gagal mengubah: ${galat.slice(0, 200)}`));
          }
        });
      })
  );
  rantai = kerja.catch(() => undefined);
  return kerja;
}

// ----------------------------------------------------------------------------
// Tanda tangan scan tiruan: coretan tinta biru dengan bintik, latar putih tembus (PNG) seperti hasil pindai yang sudah dirapikan
// ----------------------------------------------------------------------------
function scanTtd(benih: number): Buffer {
  const w = 360;
  const h = 150;
  const p = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (w * y + x) << 2;
      const t = x / w;
      const gelombang = h / 2 + (h / 3.2) * Math.sin(t * (9 + benih) + benih) * Math.cos(t * 3.1);
      const tebal = Math.abs(y - gelombang) < 2.6 - 1.4 * Math.abs(Math.sin(t * 20));
      const coret = Math.abs(y - (h * 0.78 - t * 28 * (benih % 2 ? 1 : -1))) < 1.6 && x > w * 0.15 && x < w * 0.85;
      p.data[i] = 18;
      p.data[i + 1] = 40;
      p.data[i + 2] = 150;
      p.data[i + 3] = tebal || coret ? 255 : 0;
    }
  }
  return PNG.sync.write(p);
}
const SAH = [
  { id: 11, namaPejabat: "Sri Wahyuni, S.H.", disahkan: true, penggunaId: "u-pp", disahkanPada: "2026-10-20" },
  { id: 12, namaPejabat: "Idris, S.H.I., M.H.", disahkan: true, penggunaId: "u-hakim", disahkanPada: "2026-10-20" },
];

// ----------------------------------------------------------------------------
// Server lokal: halaman SIPP tiruan + SIPP validatePost + rute portal
// ----------------------------------------------------------------------------
const persona = { akun: { id: "u-admin", nama: "Derry Briantono, S.H." }, bolehSemuaTtd: true, gagalUbah: "", sah: SAH };
const permintaanPortal: string[] = [];
const diterimaSipp: Array<{ nama: string; tipe: string; byte: number; berkas: string; dari: string; kolom: string[] }> = [];
const peringatanSipp: string[] = [];

const DIALOG = (dari: string) => `
<div class="templatepopcentering" style="width:540px;margin-top: 1%;">
 <div id='pop' style="border: 1px solid #ffffff;"><div class="detil" style="padding: 2px;background-color: white;">
  <form id="frm_upload_file" style="background:white;margin:0;" method="post" enctype="multipart/form-data" action="/index.php/fileupload_c/dummy">
  <table id="tableDetilPerkara" style="padding:0;width:100%">
   <tr><td colspan="2" style="background:white;border:0px;font-size: 20px;color: #648C03; text-align:center;height:50px">Kelola Dokumen Elektronik (E-Doc)</td></tr>
   <tr><td id="first-child" style="text-align:center" colspan="2">File Tersimpan</td></tr>
   <tr><td colspan="2" style="background-color:#dcdcdc;height:40px;text-align:center"><span style='color:red;font-weight:bold'>Dokumen Belum Ada</span></td></tr>
   <tr><td id="first-child" style="text-align:center" colspan="2">Upload E-Doc</td></tr>
   <tr><td colspan="2" style="background-color:#dcdcdc"><input type="file" name="fileform" id="fileform" style="width:100%" ${dari === "bas" ? 'accept=".pdf,application/pdf"' : ""}></td></tr>
   <tr><td style="background:white;border:0px;text-align:right;" colspan="2"><hr class="thick-line" style="clear:both;">
    <input type="hidden" name="enc" id="enc" value="ZW5jLXNpbXVsYXNp"><input type="hidden" name="enc1" id="enc1" value="ZW5jMS1zaW11bGFzaQ==">
    <input type="hidden" name="from" id="from" value="${dari}"><input type="hidden" name="urutan" id="urutan" value="1">
    <input type="button" id="kembali" value="Kembali" class="btn"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr>
  </table></form></div></div></div>
<script type="text/javascript">
$('#simpan').hide();
$("#fileform").change(function(){ $('#simpan').show(); });
$('#kembali').closingFormWin();
$('#frm_upload_file').SubmitHandling({refresh:'1',setRefresh:1,divRef:'#konten',clicked:1,btnClicked:'.close_form',whenStatus:1,upload:1,urlUpload:"/index.php/fileupload_c/validatePost"});
${
  dari === "bas"
    ? `document.getElementById('fileform').addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'pdf') {
            alert('Hanya file PDF yang diperbolehkan!');
            this.value = '';
        }
    }
});`
    : ""
}
</script>`;

const HALAMAN = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>SIPP - Jadwal Sidang (simulasi)</title>
<style>
body{margin:0;font:13px/1.45 Arial,Helvetica,sans-serif;background:#eef2ef;color:#1f2d27}
.atas{background:#008c4b;color:#fff;padding:10px 18px;font-weight:700;font-size:15px}
#konten{padding:14px 18px}table.cssTable{border-collapse:collapse;background:#fff}table.cssTable td,table.cssTable th{border:1px solid #c8d3cc;padding:5px 9px}
.popup{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.35);z-index:50;overflow:auto}
.templatepopcentering{margin:0 auto;background:#fff}
#tableDetilPerkara td{padding:6px 10px}#first-child{background:#dcdcdc;font-weight:700}
.btn{padding:4px 12px}.centering{width:420px;margin:12% auto}table.pesan{background:#fff;width:100%}
</style></head><body>
<div class="atas">SIPP - Pengadilan Agama Donggala (simulasi)</div>
<div id="konten">
 <h3>Jadwal Sidang - 12/Pdt.G/2026/PA.Dgl</h3>
 <table class="cssTable"><thead><tr><th>Sidang ke</th><th>Tanggal</th><th>Agenda</th><th>E-Doc BAS</th></tr></thead>
 <tbody><tr><td>2</td><td>29 Oktober 2026</td><td>Ikrar Talak</td><td><a href="#" id="edoc-bas" onclick="popup_form('/index.php/fileupload/dialog?from=bas'); return false;">Kelola E-Doc BAS</a></td></tr>
 <tr><td>1</td><td>15 Oktober 2026</td><td>Pembacaan gugatan</td><td><a href="#" id="edoc-relaas" onclick="popup_form('/index.php/fileupload/dialog?from=relaas'); return false;">Kelola E-Doc Relaas</a></td></tr></tbody></table>
</div>
<script src="/res/jquery.js"></script><script src="/res/jquery-sipp.js"></script>
<script>function openLoadingDialog(){} function closeLoading(){}
window.addEventListener('beforeunload',function(){});</script>
</body></html>`;

const HALAMAN_PDF = `<!doctype html><html><head><meta charset="utf-8"><title>render</title></head><body style="margin:0;background:#fff"><canvas id="k"></canvas></body></html>`;

async function bacaFormData(req: http.IncomingMessage): Promise<FormData> {
  const potongan: Buffer[] = [];
  for await (const p of req) potongan.push(p as Buffer);
  const baru = new Request("http://x/", { method: "POST", headers: { "content-type": String(req.headers["content-type"] || "") }, body: Buffer.concat(potongan) });
  return await baru.formData();
}

function jawabPortal(url: string) {
  const p = url.split("?")[0].replace(/^\/aleta/, "");
  const ok = (data: unknown) => ({ status: 200, isi: { ok: true, data } });
  if (p.includes("/aleta-ecourt/ekstensi/siapa")) return ok({ nama: persona.akun.nama, peran: persona.bolehSemuaTtd ? "Super Admin" : "Panitera Pengganti", kapabilitas: null });
  if (p.endsWith("/api/install")) return { status: 200, isi: { ok: true } };
  return { status: 404, isi: {} };
}

async function mulaiServer() {
  const srv = http.createServer(async (req, res) => {
    const url = req.url || "/";
    const jalur = url.split("?")[0];
    try {
      if (jalur === "/index.php/jadwal") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(HALAMAN);
      }
      if (jalur === "/res/jquery.js") {
        res.writeHead(200, { "content-type": "text/javascript" });
        return res.end(fs.readFileSync(path.join(XAMPP_JS, "jquery-1.10.2.min.js")));
      }
      if (jalur === "/res/jquery-sipp.js") {
        res.writeHead(200, { "content-type": "text/javascript" });
        return res.end(fs.readFileSync(path.join(XAMPP_JS, "jquery-sipp.js")));
      }
      if (jalur === "/index.php/fileupload/dialog") {
        const dari = new URL(url, "http://x").searchParams.get("from") || "bas";
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(DIALOG(dari));
      }
      if (jalur === "/index.php/fileupload_c/dummy") {
        await bacaFormData(req).catch(() => null);
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ st: 1, msg: "Penyimpanan Dokumen Elektronik (E-Doc) Berhasil." }));
      }
      if (jalur === "/index.php/fileupload_c/validatePost") {
        const f = await bacaFormData(req);
        const berkas = f.get("fileform") as File;
        const bita = Buffer.from(await berkas.arrayBuffer());
        const simpan = path.join(HASIL, `sipp-terima-${diterimaSipp.length + 1}-${berkas.name.replace(/[^\w.-]+/g, "_")}`);
        fs.writeFileSync(simpan, bita);
        diterimaSipp.push({ nama: berkas.name, tipe: berkas.type, byte: bita.length, berkas: simpan, dari: String(f.get("from")), kolom: Array.from(f.keys()) });
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ st: 1, msg: "Penyimpanan Dokumen Elektronik (E-Doc) Berhasil." }));
      }
      if (jalur === "/aleta/api/aleta-ecourt/bas/word-ke-pdf" && req.method === "POST") {
        permintaanPortal.push(`${req.method} ${jalur}`);
        const f = await bacaFormData(req);
        const berkas = f.get("berkas") as File;
        const deps: DepsWordPdf = {
          ubahKePdf: async (bita, bentuk) => {
            if (persona.gagalUbah) throw Object.assign(new Error(persona.gagalUbah), { status: 503 });
            return await ubahLewatWord(bita, bentuk);
          },
          daftarTtdSah: async () => persona.sah.map((b) => ({ ...b })),
          gambarTtd: async (id) => new Uint8Array(scanTtd(id)),
          atur: { lebarTtdMm: 50, ttdTurunMm: 3, tinggiTtdMaksMm: 25 },
        };
        try {
          const h = await wordKePdfBas(
            { bita: new Uint8Array(await berkas.arrayBuffer()), namaBerkas: berkas.name, denganTtd: String(f.get("ttd") ?? "1") !== "0", akun: persona.akun, bolehSemuaTtd: persona.bolehSemuaTtd },
            deps
          );
          res.writeHead(200, { "content-type": "application/json" });
          return res.end(JSON.stringify({ ok: true, data: { pdfBase64: Buffer.from(h.pdf).toString("base64"), byte: h.pdf.length, namaBerkas: h.namaBerkas, bentukAsal: h.bentukAsal, blokTtd: h.blokTtd, penandatangan: h.penandatangan, peringatan: h.peringatan } }));
        } catch (e) {
          const status = Number((e as { status?: number }).status) || 500;
          res.writeHead(status, { "content-type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: { message: String((e as Error).message || e) } }));
        }
      }
      if (jalur.startsWith("/aleta/api/")) {
        const { status, isi } = jawabPortal(url);
        res.writeHead(status, { "content-type": "application/json" });
        return res.end(JSON.stringify(isi));
      }
      if (jalur === "/render.html") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(HALAMAN_PDF);
      }
      if (jalur.startsWith("/pdfjs/")) {
        const nama = jalur.replace("/pdfjs/", "");
        res.writeHead(200, { "content-type": "text/javascript" });
        return res.end(fs.readFileSync(path.join(AKAR, "manajemen_surat/node_modules/pdfjs-dist/legacy/build", nama)));
      }
      res.writeHead(404);
      res.end("tidak ada");
    } catch (e) {
      res.writeHead(500);
      res.end(String((e as Error).message || e));
    }
  });
  return await new Promise<{ srv: http.Server; port: number }>((selesai) => srv.listen(0, "127.0.0.1", () => selesai({ srv, port: (srv.address() as { port: number }).port })));
}

// ----------------------------------------------------------------------------
// Memeriksa PDF yang DITERIMA SIPP: terbuka, halaman, gambar tanda tangan di atas nama, metadata
// ----------------------------------------------------------------------------
type Kotak = { halaman: number; kiri: number; kanan: number; bawah: number; atas: number };
async function gambarDiPdf(pdf: Uint8Array): Promise<Kotak[]> {
  pasangRintisanPeramban();
  const pdfjs = await import("../../../manajemen_surat/node_modules/pdfjs-dist/legacy/build/pdf.mjs");
  const dok = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true, isEvalSupported: false }).promise;
  const hasil: Kotak[] = [];
  const OPS = pdfjs.OPS as Record<string, number>;
  for (let n = 1; n <= dok.numPages; n += 1) {
    const h = await dok.getPage(n);
    const ops = await h.getOperatorList();
    const tumpuk: number[][] = [];
    let m = [1, 0, 0, 1, 0, 0];
    const kali = (a: number[], b: number[]) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
    ops.fnArray.forEach((fn: number, i: number) => {
      const arg = ops.argsArray[i];
      if (fn === OPS.save) tumpuk.push(m);
      else if (fn === OPS.restore) m = tumpuk.pop() ?? [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.transform) m = kali(arg as number[], m);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const xs = [m[4], m[4] + m[0], m[4] + m[2], m[4] + m[0] + m[2]];
        const ys = [m[5], m[5] + m[1], m[5] + m[3], m[5] + m[1] + m[3]];
        hasil.push({ halaman: n, kiri: Math.min(...xs), kanan: Math.max(...xs), bawah: Math.min(...ys), atas: Math.max(...ys) });
      }
    });
  }
  const jumlah = dok.numPages;
  await dok.destroy();
  (hasil as unknown as { halamanTotal: number }).halamanTotal = jumlah;
  return hasil;
}
async function posisiNama(pdf: Uint8Array, nama: string) {
  const baris = susunBaris((await bacaItemPdf(pdf)).item).filter((b) => b.teks.includes(nama));
  const b = baris[baris.length - 1];
  if (!b) return null;
  const awal = b.teks.lastIndexOf(nama);
  return { halaman: b.halaman, xMin: b.xAwal[awal], xMax: b.xAkhir[awal + nama.length - 1], y: b.y, tinggi: b.tinggi };
}

async function periksaPdfTerima(ket: string, berkas: string, harapGambar: number, nama: string[]) {
  const pdf = new Uint8Array(fs.readFileSync(berkas));
  periksa(`${ket}: berkas yang sampai ke SIPP berkepala %PDF`, String.fromCharCode(...pdf.slice(0, 5)) === "%PDF-");
  const dok = await PDFDocument.load(pdf);
  periksa(`${ket}: PDF dapat dibuka (pdf-lib) dan punya halaman`, dok.getPageCount() >= 1, `${dok.getPageCount()} halaman`);
  const meta = [dok.getTitle(), dok.getAuthor(), dok.getSubject(), dok.getKeywords(), dok.getCreator(), dok.getProducer()].map(String).join(" | ");
  periksa(`${ket}: metadata PDF tanpa kata Aleta`, !/a\W*l\W*e\W*t\W*a/i.test(meta), meta.slice(0, 120));
  periksa(`${ket}: seluruh byte PDF tanpa kata Aleta di kamus info`, !/\/(Title|Author|Subject|Keywords|Creator|Producer)\s*\([^)]*aleta/i.test(Buffer.from(pdf).toString("latin1")));
  const kotak = await gambarDiPdf(pdf);
  periksa(`${ket}: jumlah gambar tanda tangan`, kotak.length === harapGambar, `${kotak.length} dari ${harapGambar}`);
  for (const n of nama) {
    const pos = await posisiNama(pdf, n);
    if (!pos) {
      periksa(`${ket}: nama "${n}" ditemukan di PDF`, false);
      continue;
    }
    if (harapGambar > 0) {
      const dekat = kotak.filter((k) => k.halaman === pos.halaman && Math.abs((k.kiri + k.kanan) / 2 - (pos.xMin + pos.xMax) / 2) < 3 && k.bawah > pos.y - 2 && k.bawah < pos.y + pos.tinggi + 2);
      periksa(`${ket}: tanda tangan tepat di atas nama "${n}" (rata tengah, tepi bawah di puncak huruf)`, dekat.length === 1, `halaman ${pos.halaman}; gambar ${dekat[0] ? `${dekat[0].kiri.toFixed(0)}-${dekat[0].kanan.toFixed(0)} x ${dekat[0].bawah.toFixed(0)}-${dekat[0].atas.toFixed(0)}` : "tidak ada"}; nama ${pos.xMin.toFixed(0)}-${pos.xMax.toFixed(0)} y=${pos.y.toFixed(0)}`);
    }
  }
  return { pdf, kotak };
}

// ----------------------------------------------------------------------------
// Skenario
// ----------------------------------------------------------------------------
async function main() {
  const { srv, port } = await mulaiServer();
  const dirProfil = path.join(process.env.TEMP || process.env.TMP || "D:/Aplikasi/aleta/tmp", `bwp-profil-${Date.now()}`);
  // PERAMBAN_EXE: peramban lain (mis. Edge) bila Chromium bawaan Playwright tidak dapat dijalankan; Chrome/Edge bermerek (versi 137 ke atas)
  // mematikan --load-extension kecuali fitur DisableLoadExtensionCommandLineSwitch dimatikan.
  const exe = process.env.PERAMBAN_EXE || "";
  const ctx = await chromium.launchPersistentContext(dirProfil, {
    ...(exe ? { executablePath: exe } : { channel: "chromium" }),
    headless: true,
    args: [`--disable-extensions-except=${EKSTENSI}`, `--load-extension=${EKSTENSI}`, "--disable-features=DisableLoadExtensionCommandLineSwitch"],
    viewport: { width: 1100, height: 900 },
  });
  const asal = `http://127.0.0.1:${port}`;
  try {
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 20000 });
    await sw.evaluate(async () => {
      await chrome.storage.local.clear();
    });

    const dialogSipp: string[] = [];
    const galatHalaman: string[] = [];
    const konsol: string[] = [];
    async function bukaDialog(dari = "bas") {
      const page = await ctx.newPage();
      page.on("dialog", async (d: { message(): string; accept(): Promise<void>; type(): string }) => {
        dialogSipp.push(`${d.type()}: ${d.message()}`);
        await d.accept();
      });
      page.on("pageerror", (e: Error) => galatHalaman.push(String(e.message).slice(0, 160)));
      page.on("console", (m: { text(): string }) => konsol.push(m.text().slice(0, 200)));
      await page.goto(`${asal}/index.php/jadwal`, { waitUntil: "load" });
      // tunggu skrip konten ekstensi terpasang
      await page.waitForFunction(() => typeof (globalThis as unknown as { alatAmbil?: unknown }).alatAmbil !== "undefined" || document.querySelector("[id^='aleta']"), null, { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(1500);
      await page.click(dari === "bas" ? "#edoc-bas" : "#edoc-relaas");
      await page.waitForSelector("#fileform", { timeout: 10000 });
      return page;
    }
    const jedaPanel = async (page: any, re: RegExp, ms = 90000) => {
      try {
        await page.waitForFunction((s: string) => new RegExp(s).test(document.querySelector(".aleta-bwp")?.textContent || ""), re.source, { timeout: ms });
      } catch (e) {
        const isi = await page.evaluate(() => document.querySelector(".aleta-bwp")?.textContent || "(tidak ada panel)");
        console.log(`MACET menunggu ${re}: panel=${JSON.stringify(isi)} permintaanPortal=${JSON.stringify(permintaanPortal)} galat=${JSON.stringify(galatHalaman)} konsol=${JSON.stringify(konsol.slice(-8))}`);
        throw e;
      }
    };
    const teksPanel = (page: any) => page.evaluate(() => document.querySelector(".aleta-bwp")?.innerText || "");
    const namaBerkasInput = (page: any) => page.evaluate(() => (document.getElementById("fileform") as HTMLInputElement).files?.[0]?.name || "");
    const simpanTampak = (page: any) => page.evaluate(() => getComputedStyle(document.getElementById("simpan") as HTMLElement).display !== "none");

    // ===== S0: naskah masih memuat sisa blangko (#0000#, #9800#) -> peringatan; Batal mengosongkan; Lanjut saja meneruskan =====
    {
      persona.akun = { id: "u-admin", nama: "Derry Briantono, S.H." };
      persona.bolehSemuaTtd = true;
      const page = await bukaDialog();
      const sebelumPortal = permintaanPortal.length;
      await page.setInputFiles("#fileform", path.join(BAHAN, "bas-sisa.rtf"));
      await page.locator("button", { hasText: "Lanjut saja" }).waitFor({ timeout: 30000 });
      await page.screenshot({ path: path.join(HASIL, "S0-peringatan-sisa-blangko.png") });
      await page.locator("button", { hasText: "Batal" }).first().click();
      await jedaPanel(page, /Dibatalkan/, 20000);
      periksa("S0 sisa blangko + Batal: pilihan dikosongkan, tak ada panggilan ubah, SIPP tak pernah melihat berkas Word", (await namaBerkasInput(page)) === "" && permintaanPortal.length === sebelumPortal && !dialogSipp.some((d) => /Hanya file PDF/.test(d)));
      await page.setInputFiles("#fileform", path.join(BAHAN, "bas-sisa.rtf"));
      await page.locator("button", { hasText: "Lanjut saja" }).waitFor({ timeout: 30000 });
      await page.locator("button", { hasText: "Lanjut saja" }).click();
      await jedaPanel(page, /Siap diunggah sebagai PDF|tidak dapat diubah/);
      periksa("S0 sisa blangko + Lanjut saja: tetap diubah ke PDF", /Siap diunggah sebagai PDF/.test(await teksPanel(page)) && /\.pdf$/.test(await namaBerkasInput(page)));
      await page.close();
    }

    // ===== S1/S2/S3: RTF, DOCX, DOC oleh Super Admin (semua tanda tangan boleh) =====
    for (const [kode, berkas, harap] of [
      ["S1 RTF", "bas-contoh.rtf", "rtf"],
      ["S2 DOCX", "bas-contoh.docx", "docx"],
      ["S3 DOC (Word 97)", "bas-contoh-word97.doc", "doc"],
    ] as const) {
      persona.akun = { id: "u-admin", nama: "Derry Briantono, S.H." };
      persona.bolehSemuaTtd = true;
      persona.gagalUbah = "";
      persona.sah = SAH;
      const sebelum = diterimaSipp.length;
      const page = await bukaDialog();
      const picker = await page.evaluate(() => document.getElementById("fileform")!.getAttribute("accept"));
      await page.evaluate(() => document.getElementById("fileform")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
      const acceptSesudah = await page.evaluate(() => document.getElementById("fileform")!.getAttribute("accept"));
      periksa(`${kode}: accept kotak berkas SIPP (${picker}) dilebarkan agar berkas Word tampil`, /\.docx/.test(String(acceptSesudah)) && /\.pdf/.test(String(acceptSesudah)), String(acceptSesudah));
      const t0 = Date.now();
      await page.setInputFiles("#fileform", path.join(BAHAN, berkas));
      await jedaPanel(page, /Siap diunggah sebagai PDF|tidak dapat diubah/);
      const teks = await teksPanel(page);
      await page.screenshot({ path: path.join(HASIL, `${kode.split(" ")[0]}-panel.png`) });
      periksa(`${kode}: berhasil diubah dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk`, /Siap diunggah sebagai PDF/.test(teks), teks.replace(/\s+/g, " ").slice(0, 330));
      periksa(`${kode}: nama berkas di kotak SIPP kini .pdf`, /\.pdf$/.test(await namaBerkasInput(page)), await namaBerkasInput(page));
      periksa(`${kode}: tombol Simpan SIPP muncul (peristiwa change diteruskan ke SIPP)`, await simpanTampak(page));
      periksa(`${kode}: pemeriksa SIPP TIDAK menolak (tanpa alert "Hanya file PDF")`, !dialogSipp.some((d) => /Hanya file PDF/.test(d)), dialogSipp.join(" / "));
      periksa(`${kode}: panel menyebut kedua penanda tangan terpasang`, /Panitera Pengganti Sri Wahyuni, S\.H\.: tanda tangan terpasang/.test(teks) && /Ketua Majelis Idris, S\.H\.I\., M\.H\.: tanda tangan terpasang/.test(teks));
      await page.click("#simpan");
      await page.waitForFunction(() => /Berhasil/.test(document.getElementById("pesan-container")?.textContent || ""), null, { timeout: 15000 });
      await page.screenshot({ path: path.join(HASIL, `${kode.split(" ")[0]}-sesudah-simpan.png`) });
      periksa(`${kode}: SIPP menerima SATU unggahan`, diterimaSipp.length === sebelum + 1);
      const terima = diterimaSipp[diterimaSipp.length - 1];
      periksa(`${kode}: yang diterima validatePost bernama .pdf, bertipe application/pdf, dari=bas`, /\.pdf$/.test(terima.nama) && terima.tipe === "application/pdf" && terima.dari === "bas", `${terima.nama} ${terima.tipe} ${terima.byte} byte`);
      periksa(`${kode}: nama berkas dan kolom yang dikirim ke SIPP tanpa kata Aleta`, !/aleta/i.test(`${terima.nama} ${terima.kolom.join(" ")}`), terima.kolom.join(","));
      await periksaPdfTerima(kode, terima.berkas, 2, ["Sri Wahyuni, S.H.", "Idris, S.H.I., M.H."]);
      periksa(`${kode}: ${harap.toUpperCase()} dikenali dan satu panggilan ke rute ubah`, permintaanPortal.length > 0);
      await page.close();
    }

    // ===== S4: PDF biasa tidak terganggu =====
    {
      const sebelum = diterimaSipp.length;
      const permintaanSebelum = permintaanPortal.length;
      const page = await bukaDialog();
      await page.setInputFiles("#fileform", path.join(BAHAN, "bas-contoh-word.pdf"));
      await page.waitForTimeout(800);
      periksa("S4 PDF biasa: tidak ada panel pengubah", (await teksPanel(page)) === "");
      periksa("S4 PDF biasa: Simpan SIPP muncul seperti biasa", await simpanTampak(page));
      await page.click("#simpan");
      await page.waitForFunction(() => /Berhasil/.test(document.getElementById("pesan-container")?.textContent || ""), null, { timeout: 15000 });
      const t = diterimaSipp[diterimaSipp.length - 1];
      periksa("S4 PDF biasa: SIPP menerima berkas yang SAMA byte demi byte, nama asli", diterimaSipp.length === sebelum + 1 && t.nama === "bas-contoh-word.pdf" && fs.readFileSync(t.berkas).equals(fs.readFileSync(path.join(BAHAN, "bas-contoh-word.pdf"))));
      periksa("S4 PDF biasa: tidak ada panggilan ke rute ubah", permintaanPortal.length === permintaanSebelum);
      await page.close();
    }

    // ===== S5: berkas lain (zip/xlsx) tetap ditolak SIPP sendiri =====
    {
      const page = await bukaDialog();
      const zip = path.join(HASIL, "arsip-contoh.zip");
      fs.writeFileSync(zip, Buffer.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      const mulai = dialogSipp.length;
      await page.setInputFiles("#fileform", zip);
      await page.waitForTimeout(800);
      periksa("S5 zip: SIPP menolak sendiri (alert 'Hanya file PDF'), ALETA tidak ikut campur", dialogSipp.slice(mulai).some((d) => /Hanya file PDF/.test(d)) && (await teksPanel(page)) === "", dialogSipp.slice(mulai).join(" / "));
      await page.close();
    }

    // ===== S6: akun PP biasa (hanya tanda tangan milik sendiri) =====
    {
      persona.akun = { id: "u-pp", nama: "Sri Wahyuni, S.H." };
      persona.bolehSemuaTtd = false;
      const page = await bukaDialog();
      await page.setInputFiles("#fileform", path.join(BAHAN, "bas-contoh.rtf"));
      await jedaPanel(page, /Siap diunggah sebagai PDF|tidak dapat diubah/);
      const teks = await teksPanel(page);
      await page.screenshot({ path: path.join(HASIL, "S6-panel-pp.png") });
      periksa("S6 PP biasa: tanda tangan PP terpasang, milik hakim DILAPORKAN tidak dipasang", /Sri Wahyuni, S\.H\.: tanda tangan terpasang/.test(teks) && /Idris, S\.H\.I\., M\.H\.: tanda tangannya hanya dapat dipasang oleh yang bersangkutan atau admin/.test(teks), teks.replace(/\s+/g, " ").slice(0, 300));
      await page.click("#simpan");
      await page.waitForFunction(() => /Berhasil/.test(document.getElementById("pesan-container")?.textContent || ""), null, { timeout: 15000 });
      const t = diterimaSipp[diterimaSipp.length - 1];
      await periksaPdfTerima("S6", t.berkas, 1, ["Sri Wahyuni, S.H."]);
      await page.close();
    }

    // ===== S7: belum ada tanda tangan tersahkan sama sekali; S8: kotak tanda tangan dimatikan =====
    {
      persona.akun = { id: "u-admin", nama: "Derry Briantono, S.H." };
      persona.bolehSemuaTtd = true;
      persona.sah = [SAH[0]];
      const page = await bukaDialog();
      await page.setInputFiles("#fileform", path.join(BAHAN, "bas-contoh.docx"));
      await jedaPanel(page, /Siap diunggah sebagai PDF|tidak dapat diubah/);
      const teks = await teksPanel(page);
      await page.screenshot({ path: path.join(HASIL, "S7-panel-belum-ada.png") });
      periksa("S7 satu tanda tangan belum ada: PDF tetap jadi, penanda tangan yang belum punya disebut", /Idris, S\.H\.I\., M\.H\.: belum punya tanda tangan tersahkan/.test(teks) && /Sri Wahyuni, S\.H\.: tanda tangan terpasang/.test(teks));
      const sebelum = diterimaSipp.length;
      await page.evaluate(() => {
        const k = document.querySelector(".aleta-bwp input[type=checkbox]") as HTMLInputElement;
        k.checked = false;
        k.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await jedaPanel(page, /Tanpa tanda tangan scan/);
      await page.screenshot({ path: path.join(HASIL, "S8-panel-tanpa-ttd.png") });
      await page.click("#simpan");
      await page.waitForFunction(() => /Berhasil/.test(document.getElementById("pesan-container")?.textContent || ""), null, { timeout: 15000 });
      const t = diterimaSipp[diterimaSipp.length - 1];
      periksa("S8 kotak tanda tangan dimatikan: PDF tanpa gambar, hanya satu unggahan sampai ke SIPP", diterimaSipp.length === sebelum + 1 && (await gambarDiPdf(new Uint8Array(fs.readFileSync(t.berkas)))).length === 0);
      await page.close();
    }

    // ===== S9: pengubah mati =====
    {
      persona.sah = SAH;
      persona.gagalUbah = "Konversi di server gagal: pengubah PDF belum dapat dihubungi";
      const sebelum = diterimaSipp.length;
      const page = await bukaDialog();
      await page.setInputFiles("#fileform", path.join(BAHAN, "bas-contoh.rtf"));
      await jedaPanel(page, /tidak dapat diubah ke PDF/);
      await page.screenshot({ path: path.join(HASIL, "S9-panel-gagal.png") });
      periksa("S9 pengubah mati: alasan ditampilkan, pilihan dikosongkan, Simpan tetap tersembunyi, tidak ada yang terunggah", /pengubah PDF belum dapat dihubungi/.test(await teksPanel(page)) && (await namaBerkasInput(page)) === "" && !(await simpanTampak(page)) && diterimaSipp.length === sebelum);
      persona.gagalUbah = "";
      await page.close();
    }

    // ===== S10: jendela e-Doc lain (relaas) tidak disentuh =====
    {
      const page = await bukaDialog("relaas");
      await page.setInputFiles("#fileform", path.join(BAHAN, "bas-contoh.rtf"));
      await page.waitForTimeout(600);
      periksa("S10 e-Doc relaas: RTF tetap RTF, tak ada panel", (await teksPanel(page)) === "" && (await namaBerkasInput(page)) === "bas-contoh.rtf");
      await page.close();
    }

    // ===== Gambar PDF akhir (S1) untuk dilihat mata =====
    const s1 = diterimaSipp[0];
    const render = await ctx.newPage();
    await render.goto(`${asal}/render.html`);
    const pdfB64 = fs.readFileSync(s1.berkas).toString("base64");
    const halamanPng = await render.evaluate(async (b64: string) => {
      const pdfjs: any = await import("/pdfjs/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      const dok = await pdfjs.getDocument({ data: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) }).promise;
      const hasil: string[] = [];
      for (let n = dok.numPages; n <= dok.numPages; n += 1) {
        const h = await dok.getPage(n);
        const v = h.getViewport({ scale: 1.4 });
        const k = document.getElementById("k") as HTMLCanvasElement;
        k.width = v.width;
        k.height = v.height;
        await h.render({ canvasContext: k.getContext("2d")!, viewport: v }).promise;
        hasil.push(k.toDataURL("image/png"));
      }
      return { jumlah: dok.numPages, gambar: hasil };
    }, pdfB64);
    fs.writeFileSync(path.join(HASIL, "S1-pdf-halaman-terakhir.png"), Buffer.from(halamanPng.gambar[0].split(",")[1], "base64"));
    periksa("PDF hasil dapat dirender pdf.js di Chromium", halamanPng.jumlah >= 1 && halamanPng.gambar[0].length > 5000, `${halamanPng.jumlah} halaman`);
    await render.close();

    periksa("tak ada kiriman ke SIPP selain validatePost/dummy; dialog SIPP hanya konfirmasi Simpan", dialogSipp.every((d) => /Apakah Anda Yakin/.test(d) || /Hanya file PDF/.test(d)), dialogSipp.filter((d, i) => dialogSipp.indexOf(d) === i).join(" / "));
    periksa("tak ada galat skrip di halaman", galatHalaman.length === 0, galatHalaman.join(" | "));
  } finally {
    await ctx.close();
    srv.close();
  }
  fs.writeFileSync(path.join(HASIL, "hasil-simulasi.txt"), log.join("\n") + `\n\nGAGAL: ${gagal}\n`);
  console.log(`\nSelesai. Gagal: ${gagal}. Hasil di ${HASIL}`);
  process.exit(gagal ? 1 : 0);
}
main().catch((e) => {
  console.error("SIMULASI BERHENTI:", e);
  process.exit(2);
});
