// Simulasi "Unggah e-Doc dengan seret-lepas" (30 Okt 2026, malam) - EKSTENSI SUNGGUHAN di peramban (Edge/Chromium), halaman perkara SIPP TIRUAN
// dengan tombol e-Doc berbentuk views SIPP 7.0.4 dan jendela unggah SIPP 7.0.4 (fileupload_v.php / fileupload_putusan_v.php) beserta
// jquery-sipp.js (SubmitHandling) dari salinan SIPP setempat.
//
// SUNGGUHAN: ekstensi-sipp (manifest, semua skrip konten termasuk alatAmbil, pemeriksa sisa blangko, bas-word-pdf.js, edoc-seret.js,
//   tampilan-sipp.js dan saklarnya lewat chrome.storage), inti server bas-word-pdf.ts dan edoc-baca-pdf.ts, pengubah Word -> PDF = Microsoft
//   Word (COM) pengganti soffice, relaas = 59 render relaas Derry (folder 98 Relaas) yang dijadikan PDF oleh Word.
// TIRUAN: halaman perkara (HTML kecil), validatePost SIPP (menyimpan berkas untuk diperiksa), daftar tanda tangan sah dan gambar scan.
// Seret-lepas dipicu dengan DragEvent + DataTransfer berisi File di peramban sungguhan (OS tidak dapat digerakkan dari sini).
//
//   npx tsx --tsconfig tsconfig.json ../docs/rancangan/edoc-seret-30okt/simulasi.mts <folder-bahan> <folder-hasil>
//   (PERAMBAN_EXE = jalur msedge.exe/chrome.exe bila Chromium bawaan Playwright tidak dapat dijalankan)
// <folder-bahan> berisi: bas-contoh.rtf, bas-contoh.docx, bas-contoh-word97.doc, bas-contoh-word.pdf, bas-sisa.rtf, relaas-pdf/ (RTF dan PDF relaas).
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";

import { bacaPdfEdoc } from "../../../manajemen_surat/src/server/modules/aleta-ecourt/edoc-baca-pdf";
import { wordKePdfBas, type BentukWord, type DepsWordPdf } from "../../../manajemen_surat/src/server/modules/aleta-ecourt/bas-word-pdf";
import { pasangRintisanPeramban } from "../../../manajemen_surat/src/server/modules/aleta-ecourt/baca-pdf";
import { bacaItemPdf, susunBaris } from "../../../manajemen_surat/src/server/modules/aleta-ecourt/pdf-bubuh-ttd";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const muat = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { PNG } = muat("pngjs");
const { chromium } = muat("playwright-core");

const BAHAN = path.resolve(process.argv[2] || "D:/Aplikasi/aleta/tmp/bwp-sim");
const RELAAS_DIR = path.join(path.resolve(process.argv[2] || "D:/Aplikasi/aleta/tmp/bwp-sim"), "..", "edoc-seret", "relaas-pdf");
const HASIL = path.resolve(process.argv[3] || "D:/Aplikasi/aleta/tmp/edoc-seret/hasil");
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
// Word -> PDF lewat Microsoft Word (COM), satu per satu
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
      p.data[i] = 18;
      p.data[i + 1] = 40;
      p.data[i + 2] = 150;
      p.data[i + 3] = tebal ? 255 : 0;
    }
  }
  return PNG.sync.write(p);
}
const SAH = [
  { id: 11, namaPejabat: "Sri Wahyuni, S.H.", disahkan: true, penggunaId: "u-pp", disahkanPada: "2026-10-20" },
  { id: 12, namaPejabat: "Idris, S.H.I., M.H.", disahkan: true, penggunaId: "u-hakim", disahkanPada: "2026-10-20" },
];

// ----------------------------------------------------------------------------
// Keadaan SIPP tiruan: e-Doc yang tersimpan per tombol
// ----------------------------------------------------------------------------
const ENC = "ZW5jLXNpbXVsYXNp";
const tersimpan = new Map<string, string>(); // kunci "<kode>:<enc1>:<urutan>" -> nama berkas
const diterima: Array<{ kunci: string; kode: string; nama: string; tipe: string; byte: number; berkas: string; kolom: Record<string, string> }> = [];
const permintaanPortal: string[] = [];
let nomorPerkara = "12/Pdt.G/2026/PA.Dgl";

const PDF_SAJA = ["bas", "dokpmh", "dokppp", "dokpjs", "dokphs", "panggil_paksa", "pencegahan_keluar", "bantuan_hukum", "penetapan_persiapan", "penetapan_dismissal_lolos"];
const kunciDari = (kode: string, enc1: string, urutan: string) => `${kode}:${enc1}:${urutan}`;

function dialogHtml(dasar: string, dialog: string, kode: string, sisa: string[]): string {
  const enc1 = sisa[0] || ENC;
  const urutan = sisa[1] || "";
  const kunci = kunciDari(kode, enc1, urutan);
  const lama = tersimpan.get(kunci) || "";
  const ada = lama ? `<span style='color:#708090;font-weight:bold'>${lama}</span>` : `<span style='color:red;font-weight:bold'>${dialog === "fileupload_putusan" ? `E-Doc ${kode} Belum Ada` : "Dokumen Belum Ada"}</span>`;
  if (dialog === "fileupload_putusan") {
    return `
<div class="templatepopcentering" style="width:540px;margin-top:1%;"><div id='pop'><div class="detil" style="padding:2px;background-color:white;">
<form id="frm_upload_file" style="background:white;margin:0;" method="post" enctype="multipart/form-data" action="${dasar}fileupload_c/dummy">
<table id="tableDetilPerkara" style="width:100%"><tr><td colspan="2" style="font-size:20px;color:#648C03;text-align:center;height:50px">Kelola Dokumen Elektronik (E-Doc) Putusan</td></tr>
<tr><td id="first-child">File Tersimpan</td><td>${lama ? `<span style='color:orange;'>${lama}</span>` : ada}</td></tr>
<tr><td id="first-child">Upload E-Doc Putusan</td><td><input type="file" name="fileform" id="fileform" value=""></td></tr>
<tr><td id="first-child">Status Publikasi (Direktori Putusan)</td><td><select id="status_publish" name="status_publish"><option value="1" selected>Publikasi</option><option value="0">Tidak Publikasi</option></select></td></tr>
<tr><td colspan="2" style="text-align:right"><input type="hidden" name="enc" id="enc" value="${ENC}"><input type="hidden" name="form" id="form" value="${kode}">
<input type="button" id="close_form" value="Kembali" class="btn"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr></table></form></div></div></div>
<script type="text/javascript">
$('#simpan').hide();
$("#fileform").change(function(){ $('#simpan').show(); });
$('#frm_upload_file').SubmitHandling({refresh:'1',setRefresh:1,divRef:'#konten',clicked:1,btnClicked:'#close_form',whenStatus:1,upload:1,urlUpload:"${dasar}fileupload_putusan_c/validatePost"});
$('#close_form').closingFormWin();
</script>`;
  }
  const hanyaPdf = PDF_SAJA.includes(kode);
  return `
<div class="templatepopcentering" style="width:540px;margin-top:1%;"><div id='pop'><div class="detil" style="padding:2px;background-color:white;">
<form id="frm_upload_file" style="background:white;margin:0;" method="post" enctype="multipart/form-data" action="${dasar}fileupload_c/dummy">
<table id="tableDetilPerkara" style="width:100%"><tr><td colspan="2" style="font-size:20px;color:#648C03;text-align:center;height:50px">Kelola Dokumen Elektronik (E-Doc)</td></tr>
<tr><td id="first-child" colspan="2">File Tersimpan</td></tr><tr><td colspan="2" style="background-color:#dcdcdc;height:40px;text-align:center">${ada}</td></tr>
<tr><td id="first-child" colspan="2" style="text-align:center">${lama ? "Unggah E-Doc Baru" : "Upload E-Doc"}</td></tr>
<tr><td colspan="2" style="background-color:#dcdcdc"><input type="file" name="fileform" id="fileform" style="width:100%"${hanyaPdf ? ' accept=".pdf,application/pdf"' : ""}></td></tr>
<tr><td colspan="2" style="text-align:right"><input type="hidden" name="enc" id="enc" value="${ENC}"><input type="hidden" name="enc1" id="enc1" value="${enc1}">
<input type="hidden" name="from" id="from" value="${kode}"><input type="hidden" name="urutan" id="urutan" value="${urutan}">
<input type="button" id="kembali" value="Kembali" class="btn"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr></table></form></div></div></div>
<script type="text/javascript">
$('#simpan').hide();
$("#fileform").change(function(){ $('#simpan').show(); });
$('#kembali').closingFormWin();
$('#frm_upload_file').SubmitHandling({refresh:'1',setRefresh:1,divRef:'#konten',clicked:1,btnClicked:'.close_form',whenStatus:1,upload:1,urlUpload:"${dasar}fileupload_c/validatePost"});
${hanyaPdf ? `document.getElementById('fileform').addEventListener('change', function() {
    const file = this.files[0];
    if (file) { const ext = file.name.split('.').pop().toLowerCase(); if (ext !== 'pdf') { alert('Hanya file PDF yang diperbolehkan!'); this.value = ''; } }
});` : ""}
</script>`;
}

function halamanPerkara(dasar: string, nomor: string): string {
  const b = (kode: string, dialog = "fileupload", sisa = "") => `${dasar}${dialog}/${ENC}/${kode}${sisa}`;
  const tombol = (id: string, url: string, teks: string, kelas = "btn btn-default btn-sm") =>
    `<a href="#" id="${id}" onClick="popup_form('${url}')" class="${kelas}" style="color:#333"><i class="fa fa-file-word-o"></i> ${teks}</a>`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>SIPP - Perkara ${nomor}</title>
<style>
body{margin:0;font:13px/1.45 Arial,Helvetica,sans-serif;background:#eef2ef;color:#1f2d27}
.atas{background:#008c4b;color:#fff;padding:10px 18px;font-weight:700;font-size:15px}
#konten{padding:14px 18px}table.cssTable{border-collapse:collapse;background:#fff;margin-bottom:14px}table.cssTable td,table.cssTable th{border:1px solid #c8d3cc;padding:5px 9px;vertical-align:top}
.btn{display:inline-block;padding:4px 10px;border:1px solid #bbb;border-radius:4px;background:#f4f4f4;text-decoration:none;margin:2px}
.btn-warning{background:#f0ad4e;border-color:#eea236;color:#fff!important}
.popup{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.35);z-index:50;overflow:auto}
.templatepopcentering{margin:0 auto;background:#fff}#tableDetilPerkara td{padding:6px 10px}#first-child{background:#dcdcdc;font-weight:700}
.centering{width:420px;margin:12% auto}table.pesan{background:#fff;width:100%}
h4{margin:10px 0 4px}
</style></head><body><div class="atas">SIPP - Pengadilan Agama Donggala (simulasi)</div>
<div id="konten">
 <table class="cssTable" id="tableDetilPerkara"><tr><td id="first-child">Nomor Perkara</td><td colspan="2">\n\t\t\t${nomor}\t\t</td></tr><tr><td id="first-child">Jenis Perkara</td><td colspan="2">Cerai Talak</td></tr></table>
 <h4>Jadwal Sidang</h4>
 <table class="cssTable"><thead><tr><th>No</th><th>Tanggal</th><th>Agenda</th><th>E-Doc BAS</th></tr></thead><tbody>
  <tr id="sidang1"><td>1</td><td>Kamis, 15 Oktober 2026</td><td>Pembacaan permohonan</td><td><span id="s-bas-1" style="color:red;font-weight:bold">Dokumen Belum Ada</span><br>${tombol("t-bas-1", b("bas", "fileupload", `/${ENC}1/1`), "Unggah BAS")}</td></tr>
  <tr id="sidang2"><td>2</td><td>Kamis, 29 Oktober 2026</td><td>Ikrar Talak</td><td><span id="s-bas-2" style="color:red;font-weight:bold">Dokumen Belum Ada</span><br>${tombol("t-bas-2", b("bas", "fileupload", `/${ENC}2/2`), "Unggah BAS")}</td></tr>
 </tbody></table>
 <h4>Pelaksanaan Relaas</h4>
 <table class="cssTable"><tr><td>Pemohon</td><td><span id="s-relaas-p" style="color:red;font-weight:bold">Dokumen Belum Ada</span> ${tombol("t-relaas-p", b("relaas", "fileupload", `/${ENC}2/${ENC}P`), "Upload Relaas")}</td></tr>
 <tr><td>Termohon</td><td><span id="s-relaas-t" style="color:red;font-weight:bold">Dokumen Belum Ada</span> ${tombol("t-relaas-t", b("relaas", "fileupload", `/${ENC}2/${ENC}T`), "Upload Relaas")}</td></tr></table>
 <h4>Penetapan</h4>
 <table class="cssTable"><tr><td>PMH</td><td><span id="s-pmh" style="color:red;font-weight:bold">Dokumen Belum Ada</span> ${tombol("t-pmh", b("dokpmh", "fileupload", `/${ENC}7`), "Unggah", "btn btn-default btn-sm")}</td></tr>
 <tr><td>PHS</td><td>${tombol("t-phs", b("dokphs", "fileupload", `/${ENC}8`), "Unggah", "btn btn-default btn-sm")}</td></tr></table>
 <h4>Putusan Akhir</h4>
 <table class="cssTable"><tr><td>E-Doc putusan</td><td><span id="s-putusan" style="color:red;font-weight:bold">Dokumen Belum Ada</span> ${tombol("t-putusan", b("putusan", "fileupload_putusan"), "Unggah E-Doc", "btn btn-warning btn-sm")}</td></tr>
 <tr><td>E-Doc anonimisasi</td><td>${tombol("t-anonim", b("anonimisasi", "fileupload_putusan"), "Unggah E-Doc", "btn btn-warning btn-sm")}</td></tr></table>
 <h4>Data Umum</h4>
 <table class="cssTable"><tr><td>Permohonan (e-Doc)</td><td><span id="s-datum" style="color:red;font-weight:bold">Dokumen Belum Ada</span> ${tombol("t-datum", b("datum", "fileupload"), "Unggah E-Doc", "btn btn-warning btn-sm")}</td></tr></table>
 <p><a href="#" id="t-lain" onClick="popup_form('${dasar}data_relaas_panggilan/${ENC}/${ENC}1')" class="btn">Data relaas panggilan (bukan e-Doc)</a></p>
</div>
<script src="/res/jquery.js"></script><script src="/res/jquery-sipp.js"></script>
<script>
function openLoadingDialog(){} function closeLoading(){}
// Seperti halaman SIPP: wadah #konten memuat ulang bagian halaman bila menerima change (SubmitHandling: $(divRef).val(1).trigger("change")).
$('#konten').on('change', function () {
  $.getJSON('${dasar}status', function (s) {
    const peta = { 's-bas-1': 'bas::${ENC}1:1', 's-bas-2': 'bas::${ENC}2:2' };
    const isi = function (id, v) { const e = document.getElementById(id); if (!e) return; if (v) { e.style.color = '#259FD3'; e.innerHTML = '<b>Unduh Dokumen</b> (' + v + ')'; } else { e.style.color = 'red'; e.innerText = 'Dokumen Belum Ada'; } };
    isi('s-bas-1', s['bas:${ENC}1:1']); isi('s-bas-2', s['bas:${ENC}2:2']);
    isi('s-relaas-p', s['relaas:${ENC}2:${ENC}P']); isi('s-relaas-t', s['relaas:${ENC}2:${ENC}T']);
    isi('s-pmh', s['dokpmh:${ENC}7:']); isi('s-putusan', s['putusan:::']); isi('s-datum', s['datum:::']);
  });
});
</script></body></html>`;
}

async function bacaFormData(req: http.IncomingMessage): Promise<FormData> {
  const potongan: Buffer[] = [];
  for await (const p of req) potongan.push(p as Buffer);
  const baru = new Request("http://x/", { method: "POST", headers: { "content-type": String(req.headers["content-type"] || "") }, body: Buffer.concat(potongan) });
  return await baru.formData();
}

const persona = { akun: { id: "u-admin", nama: "Derry Briantono, S.H." }, bolehSemuaTtd: true, gagalUbah: "", sah: SAH };

async function mulaiServer() {
  let port = 0;
  const srv = http.createServer(async (req, res) => {
    const url = req.url || "/";
    const u = new URL(url, "http://x");
    const jalur = u.pathname;
    const dasar = `http://127.0.0.1:${port}/index.php/`;
    try {
      if (jalur.startsWith("/index.php/perkara_detil_agama/")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(halamanPerkara(dasar, u.searchParams.get("nomor") || nomorPerkara));
      }
      if (jalur === "/res/jquery.js" || jalur === "/res/jquery-sipp.js") {
        res.writeHead(200, { "content-type": "text/javascript" });
        return res.end(fs.readFileSync(path.join(XAMPP_JS, jalur.endsWith("sipp.js") ? "jquery-sipp.js" : "jquery-1.10.2.min.js")));
      }
      const dlg = /^\/index\.php\/(fileupload|fileupload_putusan)\/([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(jalur);
      if (dlg) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(dialogHtml(dasar, dlg[1], dlg[3], dlg[4] ? dlg[4].split("/") : []));
      }
      if (jalur === "/index.php/status") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify(Object.fromEntries(tersimpan)));
      }
      if (jalur === "/index.php/fileupload_c/dummy" || jalur === "/index.php/fileupload_putusan_c/dummy") {
        await bacaFormData(req).catch(() => null);
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ st: 1, msg: "Penyimpanan Dokumen Elektronik (E-Doc) Berhasil." }));
      }
      if (jalur === "/index.php/fileupload_c/validatePost" || jalur === "/index.php/fileupload_putusan_c/validatePost") {
        const f = await bacaFormData(req);
        const berkas = f.get("fileform") as File;
        const bita = Buffer.from(await berkas.arrayBuffer());
        const kolom: Record<string, string> = {};
        for (const [k, v] of f.entries()) if (typeof v === "string") kolom[k] = v;
        const kode = kolom.from || kolom.form || "";
        const kunci = jalur.includes("putusan_c") ? `${kode}:::` : kunciDari(kode, kolom.enc1 || "", kolom.urutan || "");
        const simpan = path.join(HASIL, `sipp-terima-${diterima.length + 1}-${berkas.name.replace(/[^\w.-]+/g, "_")}`);
        fs.writeFileSync(simpan, bita);
        diterima.push({ kunci, kode, nama: berkas.name, tipe: berkas.type, byte: bita.length, berkas: simpan, kolom });
        tersimpan.set(kunci === "anonimisasi:::" ? "anonimisasi:::" : kunci, berkas.name);
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ st: 1, msg: "Penyimpanan Dokumen Elektronik (E-Doc) Berhasil." }));
      }
      if (jalur === "/aleta/api/aleta-ecourt/bas/word-ke-pdf" && req.method === "POST") {
        permintaanPortal.push("word-ke-pdf");
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
          const h = await wordKePdfBas({ bita: new Uint8Array(await berkas.arrayBuffer()), namaBerkas: berkas.name, denganTtd: String(f.get("ttd") ?? "1") !== "0", akun: persona.akun, bolehSemuaTtd: persona.bolehSemuaTtd }, deps);
          res.writeHead(200, { "content-type": "application/json" });
          return res.end(JSON.stringify({ ok: true, data: { pdfBase64: Buffer.from(h.pdf).toString("base64"), byte: h.pdf.length, namaBerkas: h.namaBerkas, bentukAsal: h.bentukAsal, blokTtd: h.blokTtd, penandatangan: h.penandatangan, peringatan: h.peringatan } }));
        } catch (e) {
          res.writeHead(Number((e as { status?: number }).status) || 500, { "content-type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: { message: String((e as Error).message || e) } }));
        }
      }
      if (jalur === "/aleta/api/aleta-ecourt/edoc/baca-pdf" && req.method === "POST") {
        permintaanPortal.push("baca-pdf");
        const f = await bacaFormData(req);
        const berkas = f.get("berkas") as File;
        const hasil = await bacaPdfEdoc(new Uint8Array(await berkas.arrayBuffer()), berkas.name);
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ ok: true, data: hasil }));
      }
      if (jalur.startsWith("/aleta/api/")) {
        const nama = persona.akun.nama;
        if (jalur.includes("/ekstensi/siapa")) {
          res.writeHead(200, { "content-type": "application/json" });
          return res.end(JSON.stringify({ ok: true, data: { nama, peran: "Super Admin", kapabilitas: null } }));
        }
        res.writeHead(404, { "content-type": "application/json" });
        return res.end("{}");
      }
      res.writeHead(404);
      res.end("tidak ada");
    } catch (e) {
      res.writeHead(500);
      res.end(String((e as Error).message || e));
    }
  });
  return await new Promise<{ srv: http.Server; port: number }>((selesai) =>
    srv.listen(0, "127.0.0.1", () => {
      port = (srv.address() as { port: number }).port;
      selesai({ srv, port });
    })
  );
}

// ----------------------------------------------------------------------------
// Pemeriksa PDF yang diterima SIPP
// ----------------------------------------------------------------------------
async function jumlahGambar(pdf: Uint8Array): Promise<number> {
  pasangRintisanPeramban();
  const pdfjs = await import("../../../manajemen_surat/node_modules/pdfjs-dist/legacy/build/pdf.mjs");
  const dok = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true, isEvalSupported: false }).promise;
  const OPS = pdfjs.OPS as Record<string, number>;
  let n = 0;
  for (let h = 1; h <= dok.numPages; h += 1) {
    const ops = await (await dok.getPage(h)).getOperatorList();
    for (const fn of ops.fnArray as number[]) if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) n += 1;
  }
  await dok.destroy();
  return n;
}
async function dekatNama(pdf: Uint8Array, nama: string): Promise<boolean> {
  const baris = susunBaris((await bacaItemPdf(pdf)).item).filter((b) => b.teks.includes(nama));
  return baris.length > 0;
}

// ----------------------------------------------------------------------------
// Skenario
// ----------------------------------------------------------------------------
const bytes = (f: string) => fs.readFileSync(f);
const b64 = (f: string) => bytes(f).toString("base64");

async function main() {
  const { srv, port } = await mulaiServer();
  const dirProfil = path.join(process.env.TEMP || process.env.TMP || "D:/Aplikasi/aleta/tmp", `seret-profil-${Date.now()}`);
  const exe = process.env.PERAMBAN_EXE || "";
  const ctx = await chromium.launchPersistentContext(dirProfil, {
    ...(exe ? { executablePath: exe } : { channel: "chromium" }),
    headless: true,
    args: [`--disable-extensions-except=${EKSTENSI}`, `--load-extension=${EKSTENSI}`, "--disable-features=DisableLoadExtensionCommandLineSwitch"],
    viewport: { width: 1100, height: 1000 },
  });
  const asal = `http://127.0.0.1:${port}`;
  // esbuild (tsx) menyisipkan __name pada fungsi bernama di dalam page.evaluate; peramban tidak punya.
  await ctx.addInitScript("window.__name = (f) => f;");
  try {
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 20000 });
    await sw.evaluate(async () => {
      await chrome.storage.local.clear();
    });
    const dialogSipp: string[] = [];
    const galatHalaman: string[] = [];
    async function bukaPerkara(nomor = "12/Pdt.G/2026/PA.Dgl", tema = "") {
      nomorPerkara = nomor;
      const page = await ctx.newPage();
      page.on("dialog", async (d: { message(): string; accept(): Promise<void>; type(): string }) => {
        dialogSipp.push(`${d.type()}: ${d.message()}`);
        await d.accept();
      });
      page.on("pageerror", (e: Error) => galatHalaman.push(String(e.message).slice(0, 160)));
      await page.goto(`${asal}/index.php/perkara_detil_agama/${ENC}?nomor=${encodeURIComponent(nomor)}`, { waitUntil: "load" });
      await page.waitForTimeout(1800); // skrip konten ekstensi terpasang
      if (tema) await page.evaluate((t: string) => document.documentElement.setAttribute("data-aleta-tema", t), tema);
      return page;
    }
    /** Seret berkas ke atas tombol (dragenter/dragover) lalu lepas (drop), di peramban sungguhan lewat DataTransfer. */
    async function seretLepas(page: any, selektor: string, nama: string, base64: string, tipe = "", lepas = true) {
      return await page.evaluate(
        async ({ selektor, nama, base64, tipe, lepas }: { selektor: string; nama: string; base64: string; tipe: string; lepas: boolean }) => {
          const bita = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const dt = new DataTransfer();
          dt.items.add(new File([bita], nama, { type: tipe }));
          const el = document.querySelector(selektor)!;
          const kirim = (jenis: string) => {
            const ev = new DragEvent(jenis, { bubbles: true, cancelable: true, dataTransfer: dt });
            el.dispatchEvent(ev);
            return ev.defaultPrevented;
          };
          const hasil: Record<string, unknown> = {};
          hasil.enter = kirim("dragenter");
          hasil.over = kirim("dragover");
          hasil.sorot = (el.closest("a") || el).classList.contains("aleta-seret-sorot");
          hasil.siap = document.querySelectorAll(".aleta-seret-siap").length;
          hasil.petunjuk = document.querySelector(".aleta-seret-petunjuk")?.textContent || "";
          if (lepas) hasil.drop = kirim("drop");
          return hasil;
        },
        { selektor, nama, base64, tipe, lepas }
      );
    }
    const kartu = (page: any) => page.evaluate(() => Array.from(document.querySelectorAll(".aleta-seret-kartu")).map((k) => (k as HTMLElement).innerText).join(" || "));
    const tunggKartu = async (page: any, re: RegExp, ms = 120000) => {
      try {
        await page.waitForFunction((s: string) => new RegExp(s).test(Array.from(document.querySelectorAll(".aleta-seret-kartu")).map((k) => (k as HTMLElement).innerText).join(" || ")), re.source, { timeout: ms });
      } catch (e) {
        console.log(`MACET menunggu kartu ${re}: ${await kartu(page)} | portal=${JSON.stringify(permintaanPortal.slice(-5))} | galat=${JSON.stringify(galatHalaman)}`);
        throw e;
      }
    };
    const tunggDialog = (page: any, teks: string, ms = 60000) => page.locator("button", { hasText: teks }).first().waitFor({ timeout: ms });

    const PDF_BAS = path.join(BAHAN, "bas-contoh-word.pdf");

    // ===== D1: BAS PDF dilepas di sidang 2 (tanggal cocok) - tanpa dialog, langsung tersimpan; halaman disegarkan =====
    {
      const page = await bukaPerkara();
      const sebelum = diterima.length;
      const r = await seretLepas(page, "#t-bas-2 i", "BAS sidang 2.pdf", b64(PDF_BAS), "application/pdf");
      periksa("D1 seret di atas ikon tombol Unggah BAS: diterima (dragenter/dragover dibatalkan), tombol disorot, petunjuk jenis tampil, tombol e-Doc lain ditandai siap", r.enter === true && r.over === true && r.sorot === true && /unggah BAS/.test(String(r.petunjuk)) && Number(r.siap) >= 8, JSON.stringify(r));
      await page.screenshot({ path: path.join(HASIL, "D1-sorot.png") });
      await tunggKartu(page, /Tersimpan di SIPP|Tidak tersimpan|Gagal menyimpan/);
      const k = await kartu(page);
      periksa("D1 BAS PDF: kartu 'Tersimpan di SIPP: BAS', tanpa dialog konfirmasi", /Tersimpan di SIPP: BAS/.test(k) && (await page.locator(".aleta-sisa-tabir").count()) === 0, k.replace(/\s+/g, " ").slice(0, 160));
      await page.screenshot({ path: path.join(HASIL, "D1-tersimpan.png") });
      const t = diterima[diterima.length - 1];
      periksa("D1 SIPP menerima SATU unggahan lewat validatePost: kode bas, urutan 2, nama .pdf, application/pdf, byte sama dengan berkas", diterima.length === sebelum + 1 && t.kode === "bas" && t.kolom.urutan === "2" && /\.pdf$/.test(t.nama) && t.tipe === "application/pdf" && fs.readFileSync(t.berkas).equals(bytes(PDF_BAS)), `${t.nama} ${t.byte} byte`);
      periksa("D1 tanpa kata Aleta pada nama berkas dan kolom yang dikirim ke SIPP", !/aleta/i.test(`${t.nama} ${Object.keys(t.kolom).join(" ")} ${Object.values(t.kolom).join(" ")}`));
      await page.waitForTimeout(500);
      periksa("D1 halaman SIPP disegarkan seperti penutupan popup (sel e-Doc sidang 2 kini 'Unduh Dokumen', sidang 1 tetap kosong)", /Unduh Dokumen/.test(await page.locator("#s-bas-2").innerText()) && /Belum Ada/.test(await page.locator("#s-bas-1").innerText()));
      periksa("D1 klik biasa tidak dipakai: tidak ada popup SIPP terbuka", (await page.locator("#popup_form").count()) === 0);
      await page.close();
    }

    // ===== D2: BAS RTF (Word) dilepas -> diubah dengan tanda tangan scan Panitera Pengganti dan Ketua Majelis =====
    {
      persona.sah = SAH;
      const page = await bukaPerkara();
      const sebelum = diterima.length;
      tersimpan.delete(`bas:${ENC}2:2`);
      await seretLepas(page, "#t-bas-2", "bas-contoh.rtf", b64(path.join(BAHAN, "bas-contoh.rtf")), "application/rtf");
      await tunggKartu(page, /Tersimpan di SIPP|Tidak tersimpan|Gagal menyimpan/);
      await page.screenshot({ path: path.join(HASIL, "D2-bas-rtf.png") });
      const k = await kartu(page);
      const t = diterima[diterima.length - 1];
      periksa("D2 BAS RTF: tersimpan sebagai .pdf; kartu menyebut kedua penanda tangan terpasang", diterima.length === sebelum + 1 && /\.pdf$/.test(t.nama) && /Panitera Pengganti Sri Wahyuni, S\.H\.: tanda tangan terpasang/.test(k) && /Ketua Majelis Idris, S\.H\.I\., M\.H\.: tanda tangan terpasang/.test(k), k.replace(/\s+/g, " ").slice(0, 260));
      const pdf = new Uint8Array(fs.readFileSync(t.berkas));
      periksa("D2 PDF di SIPP berisi 2 gambar tanda tangan di atas nama PP dan Ketua", (await jumlahGambar(pdf)) === 2 && (await dekatNama(pdf, "Sri Wahyuni, S.H.")) && (await dekatNama(pdf, "Idris, S.H.I., M.H.")));
      await page.close();
    }

    // ===== D3: BAS tanggal sidang tidak cocok (dilepas di sidang 1, isinya sidang 29 Okt) -> dialog; Batal -> tak ada yang terkirim =====
    {
      const page = await bukaPerkara();
      const sebelum = diterima.length;
      await seretLepas(page, "#t-bas-1", "BAS salah baris.pdf", b64(PDF_BAS), "application/pdf");
      await tunggDialog(page, "Tetap unggah");
      await page.screenshot({ path: path.join(HASIL, "D3-dialog-tanggal.png") });
      const teks = await page.locator(".aleta-sisa-tabir").innerText();
      periksa("D3 tanggal sidang BAS tidak sama dengan baris: satu kotak 'Tetap unggah / Batal' menyebut kedua tanggal", /29 Oktober 2026/.test(teks) && /15 Oktober 2026/.test(teks) && /Isi berkas perlu diperiksa dulu/.test(teks), teks.replace(/\s+/g, " ").slice(0, 200));
      await page.locator("button", { hasText: "Batal" }).first().click();
      await tunggKartu(page, /Dibatalkan/);
      periksa("D3 Batal: tidak ada yang terkirim ke SIPP", diterima.length === sebelum);
      await page.close();
    }

    // ===== D4: relaas sungguhan (render Derry -> PDF oleh Word): isian tangan jurusita TIDAK memicu dialog =====
    {
      const nomor = "531/Pdt.G/2026/PA.Dgl";
      const relaas = fs.readdirSync(RELAAS_DIR).filter((f) => f.endsWith(".pdf")).sort();
      const pilih = relaas.filter((f) => /JS_0_Relaas_Panggilan_Sidang_Pertama_P__10077|JS_2_Relaas_Pemberitahuan_Putusan_T__10083|JS_7_Relaas_Panggilan_Ikrar_Talak_e-Cour/.test(f));
      periksa("D4 bahan relaas nyata tersedia", pilih.length >= 2, pilih.join(", "));
      let n = 0;
      for (const f of pilih) {
        // nomor perkara halaman = nomor di berkas relaas itu (perkara yang sama dengan render-nya)
        const teksRelaas = (await bacaPdfEdoc(new Uint8Array(fs.readFileSync(path.join(RELAAS_DIR, f))), f)).paragraf.map((p) => p.teks).join(" ");
        const nomorBerkas = (/(\d+\/Pdt\.[A-Z]\/\d{4}\/PA\.[A-Za-z]+)/.exec(teksRelaas) || [nomor])[1];
        const page = await bukaPerkara(nomorBerkas);
        const sebelum = diterima.length;
        tersimpan.delete(`relaas:${ENC}2:${ENC}P`);
        await seretLepas(page, "#t-relaas-p", f, b64(path.join(RELAAS_DIR, f)), "application/pdf");
        await tunggKartu(page, /Tersimpan di SIPP|Tidak tersimpan|Gagal menyimpan|Dibatalkan/).catch(() => null);
        const dlg = await page.locator(".aleta-sisa-tabir").count();
        const ket = await kartu(page);
        if (n === 0) await page.screenshot({ path: path.join(HASIL, "D4-relaas-tersimpan.png") });
        periksa(`D4 relaas nyata ${f.slice(0, 48)}: tanpa dialog, tersimpan`, dlg === 0 && /Tersimpan di SIPP: relaas/.test(ket) && diterima.length === sebelum + 1, ket.replace(/\s+/g, " ").slice(0, 120));
        if (dlg) await page.screenshot({ path: path.join(HASIL, `D4-dialog-${n}.png`) });
        n += 1;
        await page.close();
      }
    }

    // ===== D5: relaas dengan sisa kode #nnnn# (RTF -> dialog dari ASLINYA); Batal; lalu Tetap unggah =====
    {
      const rtfAsal = fs.readFileSync(path.join(RELAAS_DIR, fs.readdirSync(RELAAS_DIR).find((f) => /JS_0_Relaas_Panggilan_Sidang_Pertama_P__10077.*\.rtf$/.test(f))!), "latin1");
      const rusak = rtfAsal.replace("Randi", "#0046# [ALAMAT]");
      const nama = "relaas-ada-sisa.rtf";
      const b64rusak = Buffer.from(rusak, "latin1").toString("base64");
      const page = await bukaPerkara("531/Pdt.G/2026/PA.Dgl");
      const sebelum = diterima.length;
      await seretLepas(page, "#t-relaas-t", nama, b64rusak, "application/rtf");
      await tunggDialog(page, "Tetap unggah");
      await page.screenshot({ path: path.join(HASIL, "D5-dialog-sisa-relaas.png") });
      const teks = await page.locator(".aleta-sisa-tabir").innerText();
      periksa("D5 relaas dengan #0046# dan [ALAMAT]: dialog menyebut kedua temuan; titik isian tangan jurusita tidak ikut dihitung", /#0046#/.test(teks) && /\[ALAMAT\]/.test(teks) && /Ditemukan 2 hal pada relaas/.test(teks), teks.replace(/\s+/g, " ").slice(0, 200));
      await page.locator("button", { hasText: "Batal" }).first().click();
      await tunggKartu(page, /Dibatalkan/);
      periksa("D5 Batal: tidak ada yang terkirim", diterima.length === sebelum);
      await seretLepas(page, "#t-relaas-t", nama, b64rusak, "application/rtf");
      await tunggDialog(page, "Tetap unggah");
      await page.locator("button", { hasText: "Tetap unggah" }).first().click();
      await tunggKartu(page, /Tersimpan di SIPP: relaas/);
      const t = diterima[diterima.length - 1];
      periksa("D5 Tetap unggah: RTF diubah ke PDF TANPA tanda tangan (bukan BAS) dan tersimpan; petugas diberi tahu", diterima.length === sebelum + 1 && /\.pdf$/.test(t.nama) && (await jumlahGambar(new Uint8Array(fs.readFileSync(t.berkas)))) === 0 && /tidak dibubuhkan untuk relaas/.test(await kartu(page)));
      await page.close();
    }

    // ===== D6: sudah ada e-Doc -> tanya Ganti =====
    {
      tersimpan.set(`relaas:${ENC}2:${ENC}P`, "PADgl_2026_PdtG_531_relaas_lama.pdf");
      const page = await bukaPerkara("531/Pdt.G/2026/PA.Dgl");
      const sebelum = diterima.length;
      const f = fs.readdirSync(RELAAS_DIR).find((x) => /JS_0_Relaas_Panggilan_Sidang_Pertama_P__10077.*\.pdf$/.test(x))!;
      await seretLepas(page, "#t-relaas-p", f, b64(path.join(RELAAS_DIR, f)), "application/pdf");
      await tunggDialog(page, "Ganti");
      await page.screenshot({ path: path.join(HASIL, "D6-ganti.png") });
      const teks = await page.locator(".aleta-seret-kotak").innerText();
      periksa("D6 e-Doc sudah ada: 'Ganti dokumen yang sudah ada?' menyebut nama lama dari halaman SIPP", /Ganti dokumen yang sudah ada\?/.test(teks) && /PADgl_2026_PdtG_531_relaas_lama\.pdf/.test(teks));
      await page.locator("button", { hasText: "Batal" }).first().click();
      await tunggKartu(page, /Dibatalkan/);
      periksa("D6 Batal: tidak terkirim", diterima.length === sebelum);
      await seretLepas(page, "#t-relaas-p", f, b64(path.join(RELAAS_DIR, f)), "application/pdf");
      await tunggDialog(page, "Ganti");
      await page.locator(".aleta-seret-kotak button", { hasText: "Ganti" }).first().click();
      await tunggKartu(page, /Tersimpan di SIPP: relaas/);
      periksa("D6 Ganti: tersimpan dan e-Doc lama digantikan di SIPP", diterima.length === sebelum + 1 && tersimpan.get(`relaas:${ENC}2:${ENC}P`) === f.replace(/\.pdf$/, ".pdf"));
      await page.close();
    }

    // ===== D7: putusan (PDF) dan anonimisasi, penetapan PMH, permohonan (datum) - semua jenis dari tombol =====
    {
      const page = await bukaPerkara();
      for (const [sel, kode, ket] of [
        ["#t-putusan", "putusan", "putusan"],
        ["#t-anonim", "anonimisasi", "putusan anonimisasi"],
        ["#t-pmh", "dokpmh", "penetapan PMH"],
        ["#t-phs", "dokphs", "penetapan PHS"],
      ] as const) {
        const sebelum = diterima.length;
        await seretLepas(page, sel, "berkas-bernama-bebas.pdf", b64(PDF_BAS), "application/pdf");
        await tunggKartu(page, new RegExp(`Tersimpan di SIPP: ${ket}|Tidak tersimpan|Gagal menyimpan`));
        const t = diterima[diterima.length - 1];
        periksa(`D7 tombol ${kode}: tersimpan ke jalur SIPP yang benar (jenis dari TOMBOL, bukan nama berkas)`, diterima.length === sebelum + 1 && t.kode === kode, `${t.kode} ${t.nama} ${JSON.stringify(t.kolom)}`);
        if (kode === "putusan") periksa("D7 putusan: pilihan publikasi bawaan halaman unggah SIPP ikut terkirim (status_publish=1)", t.kolom.status_publish === "1");
        await page.waitForTimeout(300);
        await page.evaluate(() => document.querySelectorAll(".aleta-seret-kartu").forEach((x) => x.remove()));
      }
      // permohonan/gugatan (tanpa pemeriksaan isi), Word -> PDF tanpa TTD dan diberi tahu
      const sebelum = diterima.length;
      await seretLepas(page, "#t-datum", "permohonan.docx", b64(path.join(BAHAN, "bas-contoh.docx")), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      await tunggKartu(page, /Tersimpan di SIPP: gugatan\/permohonan|Tidak tersimpan|Gagal menyimpan/);
      await page.screenshot({ path: path.join(HASIL, "D7-datum-docx.png") });
      const t = diterima[diterima.length - 1];
      periksa("D7 permohonan DOCX: diubah ke PDF TANPA tanda tangan scan dan petugas diberi tahu", diterima.length === sebelum + 1 && t.kode === "datum" && /\.pdf$/.test(t.nama) && (await jumlahGambar(new Uint8Array(fs.readFileSync(t.berkas)))) === 0 && /tidak dibubuhkan untuk gugatan\/permohonan/.test(await kartu(page)));
      await page.close();
    }

    // ===== D8: KLIK biasa tetap membuka popup SIPP lengkap dengan fitur ALETA di dalamnya (BAS Word -> PDF bertanda tangan) =====
    {
      const page = await bukaPerkara();
      tersimpan.delete(`bas:${ENC}2:2`);
      const sebelum = diterima.length;
      await page.click("#t-bas-2");
      await page.waitForSelector("#fileform", { timeout: 15000 });
      periksa("D8 klik biasa membuka popup SIPP (jendela Kelola Dokumen Elektronik)", (await page.locator("#popup_form").count()) === 1 && (await page.locator("#fileform").getAttribute("accept")) !== null);
      await page.setInputFiles("#fileform", path.join(BAHAN, "bas-contoh.docx"));
      await page.waitForFunction(() => /Siap diunggah sebagai PDF|tidak dapat diubah/.test(document.querySelector(".aleta-bwp")?.textContent || ""), null, { timeout: 120000 });
      await page.screenshot({ path: path.join(HASIL, "D8-popup-fitur-aleta.png") });
      periksa("D8 di dalam popup: fitur BAS Word -> PDF bertanda tangan tetap bekerja; tombol Simpan SIPP muncul", /Siap diunggah sebagai PDF/.test(await page.locator(".aleta-bwp").innerText()) && (await page.locator("#simpan").isVisible()));
      await page.click("#simpan");
      await page.waitForFunction(() => /Berhasil/.test(document.getElementById("pesan-container")?.textContent || ""), null, { timeout: 20000 });
      const t = diterima[diterima.length - 1];
      periksa("D8 popup: SIPP sendiri yang mengunggah (PDF bertanda tangan) lewat Simpan", diterima.length === sebelum + 1 && /\.pdf$/.test(t.nama) && (await jumlahGambar(new Uint8Array(fs.readFileSync(t.berkas)))) === 2);
      await page.close();
    }

    // ===== D9: salah bentuk / terlalu banyak =====
    {
      const page = await bukaPerkara();
      const sebelum = diterima.length;
      await seretLepas(page, "#t-bas-2", "rekap.zip", Buffer.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]).toString("base64"), "application/zip");
      await tunggKartu(page, /hanya menerima PDF/);
      periksa("D9 zip di tombol BAS (hanya PDF): ditolak dengan alasan, tidak terkirim", diterima.length === sebelum);
      await page.evaluate(() => document.querySelectorAll(".aleta-seret-kartu").forEach((x) => x.remove()));
      // dua berkas sekaligus
      await page.evaluate(() => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array([37, 80, 68, 70, 45])], "a.pdf", { type: "application/pdf" }));
        dt.items.add(new File([new Uint8Array([37, 80, 68, 70, 45])], "b.pdf", { type: "application/pdf" }));
        document.querySelector("#t-bas-2")!.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      });
      await tunggKartu(page, /satu berkas saja/);
      periksa("D9 dua berkas sekaligus: ditolak, tidak terkirim", diterima.length === sebelum);
      // lepas di luar tombol e-Doc: tidak ada kartu dan perilaku peramban tidak dibatalkan
      const luar = await page.evaluate(() => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array([1])], "x.pdf", { type: "application/pdf" }));
        const ev = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt });
        document.querySelector("#t-lain")!.dispatchEvent(ev);
        return ev.defaultPrevented;
      });
      periksa("D9 lepas di tombol yang BUKAN e-Doc (Data relaas panggilan): tidak ditangani ekstensi", luar === false);
      await page.close();
    }

    // ===== D10: SIPP menolak (st 0) =====
    // (dipicu dengan nomor kolom tak sah: berkas dilepas pada tombol yang halaman unggahnya tidak ada -> sesi/halaman galat)
    {
      const page = await bukaPerkara();
      await page.evaluate(() => {
        const a = document.createElement("a");
        a.id = "t-rusak";
        a.href = "#";
        a.setAttribute("onclick", "popup_form('/index.php/tidak_ada/fileupload/xx/bas/yy')");
        a.textContent = "tombol rusak";
        document.getElementById("konten")!.appendChild(a);
      });
      await page.evaluate(() => {
        const a = document.getElementById("t-rusak")!;
        a.setAttribute("onclick", "popup_form('" + location.origin + "/index.php/fileupload/xx/bas_tak_dikenal/zz')");
      });
      const sebelum = diterima.length;
      await seretLepas(page, "#t-rusak", "x.pdf", b64(PDF_BAS), "application/pdf");
      await tunggKartu(page, /Tersimpan di SIPP|Tidak tersimpan|Gagal menyimpan/);
      periksa("D10 kode e-Doc yang tidak dikenal ekstensi tetap dapat diunggah sebagai 'e-Doc' (halaman unggah SIPP yang menentukan)", diterima.length === sebelum + 1 && /e-Doc/.test(await kartu(page)));
      await page.close();
    }

    // ===== D11: saklar Tampilan SIPP "Unggah e-Doc dengan seret-lepas" =====
    {
      const sebelum = diterima.length;
      await sw.evaluate(async () => {
        await chrome.storage.local.set({ tampilanSippBerlaku: { versi: "uji", sembunyi: [{ kunci: "semua.seret-edoc", pilih: [".aleta-seret-petunjuk"] }], diambilPada: Date.now() } });
      });
      const page = await bukaPerkara();
      const r = await seretLepas(page, "#t-bas-2", "BAS.pdf", b64(PDF_BAS), "application/pdf");
      periksa("D11 saklar MATI: tombol tidak menerima seret (dragover tidak dibatalkan), tanpa sorot/petunjuk, lepas diabaikan", r.enter === false && r.over === false && r.sorot === false && r.drop === false && Number(r.siap) === 0, JSON.stringify(r));
      await page.waitForTimeout(500);
      periksa("D11 saklar mati: tidak ada yang terkirim", diterima.length === sebelum && (await page.locator(".aleta-seret-kartu").count()) === 0);
      await page.click("#t-bas-2");
      await page.waitForSelector("#fileform", { timeout: 15000 });
      periksa("D11 saklar mati: klik tetap membuka popup SIPP", (await page.locator("#popup_form").count()) === 1);
      await page.close();
      await sw.evaluate(async () => {
        await chrome.storage.local.set({ tampilanSippBerlaku: { versi: "uji2", sembunyi: [], diambilPada: Date.now() } });
      });
      const page2 = await bukaPerkara();
      const r2 = await seretLepas(page2, "#t-bas-2", "BAS.pdf", b64(PDF_BAS), "application/pdf", false);
      periksa("D11 saklar dinyalakan lagi (tanpa muat ulang ekstensi): seret diterima kembali", r2.enter === true && r2.over === true && r2.sorot === true);
      await page2.close();
    }

    // ===== D12: tampilan terang dan gelap =====
    {
      for (const tema of ["terang", "gelap"]) {
        const page = await bukaPerkara("12/Pdt.G/2026/PA.Dgl", tema);
        tersimpan.delete(`bas:${ENC}2:2`);
        await seretLepas(page, "#t-bas-1", "BAS.pdf", b64(PDF_BAS), "application/pdf", false);
        await page.screenshot({ path: path.join(HASIL, `D12-sorot-${tema}.png`) });
        await seretLepas(page, "#t-bas-1", "BAS.pdf", b64(PDF_BAS), "application/pdf");
        await tunggDialog(page, "Tetap unggah");
        await page.screenshot({ path: path.join(HASIL, `D12-dialog-${tema}.png`) });
        await page.locator("button", { hasText: "Batal" }).first().click();
        await tunggKartu(page, /Dibatalkan/);
        await page.screenshot({ path: path.join(HASIL, `D12-kartu-${tema}.png`) });
        await page.close();
      }
      periksa("D12 tangkapan layar terang dan gelap dibuat (sorot, dialog, kartu)", true);
    }

    periksa("tak ada galat skrip di halaman", galatHalaman.length === 0, galatHalaman.join(" | "));
    periksa("dialog bawaan SIPP hanya konfirmasi Simpan pada jalur popup (seret-lepas tidak memicu alert/confirm)", dialogSipp.every((d) => /Apakah Anda Yakin/.test(d)), Array.from(new Set(dialogSipp)).join(" / "));
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
