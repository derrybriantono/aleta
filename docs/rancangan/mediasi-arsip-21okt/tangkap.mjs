// Tangkapan Playwright "Unggah hasil mediasi" atas REPLIKA tab Mediasi SIPP (tanpa menyentuh SIPP/portal/server sungguhan).
// Dijalankan SUNGGUHAN: ekstensi-sipp/mediasi-arsip.js. Ditiru: tab Mediasi SIPP (struktur tab_mediasi_v.php), portal arsip
// (di dalam halaman: alatAmbil), halaman unggah e-Doc SIPP dan fileupload_c/validatePost (server lokal kecil).
// Keluaran ke D:/Aplikasi/aleta/tmp/w37-layar/ (atau argumen pertama).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { chromium } = require("playwright");
const keluar = process.argv[2] || "D:/Aplikasi/aleta/tmp/w37-layar";
fs.mkdirSync(keluar, { recursive: true });
const KODE = fs.readFileSync(path.join(AKAR, "ekstensi-sipp/mediasi-arsip.js"), "utf8");

const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const STUB = `
const P = new URLSearchParams(location.search);
window.__tema = P.get("tema") === "gelap" ? "gelap" : "terang";
window.__sipp = [];
window.__unduhan = [];
window.chrome = { storage: { local: { async get(k) { return Object.fromEntries(k.map((x) => [x, x === "temaPanel" ? window.__tema : undefined])); }, async set() {} } } };
window.cariNomorPerkara = () => ${JSON.stringify(NOMOR)};
let daftar = [
  { id: "mbk-1", nama: "Laporan Mediator.pdf", bentukAsal: "pdf", adaPdf: true, ukuranAsal: 184320, ukuranPdf: 184320, versi: 1, urutanMediasi: 1, diunggahNama: "Hakim Mediator", peran: "hakim", dibuatPada: "2026-10-21T02:10:00.000Z", peringatan: "", bolehHapus: true, keSipp: null },
  { id: "mbk-2", nama: "Kesepakatan Perdamaian.rtf", bentukAsal: "rtf", adaPdf: true, ukuranAsal: 52224, ukuranPdf: 96256, versi: 2, urutanMediasi: 1, diunggahNama: "Panitera Pengganti", peran: "panitera-pengganti", dibuatPada: "2026-10-21T03:40:00.000Z", peringatan: "", bolehHapus: false, keSipp: { pada: "2026-10-21T03:45:00.000Z", oleh: "Panitera Pengganti" } },
];
const j = (status, data) => ({ ok: status < 400, status, json: async () => (status < 400 ? { ok: true, data } : { ok: false, error: { message: data } }), blob: async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }) });
window.alatAmbil = async (alamat, opsi = {}) => {
  const metode = String(opsi.method || "GET").toUpperCase();
  if (metode === "GET" && alamat.startsWith("/aleta/api/aleta-ecourt/mediasi-arsip?")) return j(200, { berkas: daftar, hak: { lihat: true, unggah: true } });
  if (metode === "POST" && alamat === "/aleta/api/aleta-ecourt/mediasi-arsip") {
    const f = opsi.body.get("berkas");
    const baru = { id: "mbk-" + (daftar.length + 3), nama: f.name, bentukAsal: /[.]rtf$/i.test(f.name) ? "rtf" : "pdf", adaPdf: true, ukuranAsal: f.size, ukuranPdf: f.size, versi: 1, urutanMediasi: 1, diunggahNama: "Hakim Mediator", peran: "hakim", dibuatPada: new Date().toISOString(), peringatan: "", bolehHapus: true, keSipp: null };
    daftar = daftar.concat(baru);
    return j(200, { ok: true, berkas: baru, peringatan: [] });
  }
  if (metode === "POST") return j(200, { ok: true });
  return j(200, null);
};
window.alatUnduh = async (b, nama) => (window.__unduhan.push(nama), { ok: true });
const fetchAsli = window.fetch.bind(window);
window.fetch = async (alamat, init = {}) => { window.__sipp.push(String(init.method || "GET") + " " + alamat); return fetchAsli(alamat, init); };
`;

const halaman = (hasil) => `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>SIPP - Perkara ${NOMOR}</title>
<style>
body{margin:0;font:13px/1.45 Arial,Helvetica,sans-serif;background:#eef2ef;color:#1f2d27}
.atas{background:#008c4b;color:#fff;padding:10px 18px;font-weight:700;font-size:15px}
.isi{padding:16px 18px;max-width:1100px} h3{margin:0 0 4px;font-size:16px}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #c1cfc7}td{border-top:1px solid #dbe5df;padding:8px;vertical-align:top}
td.divider{background:#008c4b;color:#fff;font-weight:700}#first-child{width:190px;font-weight:700;background:#f4f8f5}
.btn{display:inline-block;padding:3px 9px;border-radius:3px;border:1px solid #adb5bd;background:#f8f9fa;color:#212529;font:12px Arial;cursor:pointer;text-decoration:none}
.btn-danger{background:#d9534f;border-color:#d43f3a;color:#fff}
</style></head><body>
<div class="atas">SIPP &middot; Pengadilan Agama Donggala</div>
<div class="isi"><h3>Perkara ${NOMOR}</h3><div style="color:#4b5b54;margin-bottom:10px">Cerai Gugat &middot; Mediasi</div>
<table><tbody>
<tr><td colspan="3" class="divider">Data Jadwal Mediasi</td></tr>
<tr><td id="first-child">Jadwal Mediasi</td><td colspan="2">13 Oktober 2026 - 20 Oktober 2026 (2 pertemuan)</td></tr>
<tr><td colspan="3" class="divider">Data Hasil Mediasi</td></tr>
<tr><td id="first-child">Tgl. Hasil Mediasi</td><td>Selasa, 20 Oktober 2026 (Sesuai Tanggal Jadwal Mediasi Terakhir)</td>
<td style="text-align:right;width:260px">[ <a href="#" onClick="popup_form('/SIPP/edit_hasil_mediasi/ENCperkara/ENCmediasi/ENCmed/1')">Edit Hasil Mediasi</a> ]</td></tr>
<tr><td id="first-child">Tgl. Laporan Mediator</td><td colspan="2">Selasa, 20 Oktober 2026</td></tr>
<tr><td id="first-child">Hasil Mediasi</td><td colspan="2"><b>${hasil}</b></td></tr>
<tr><td id="first-child">Keterangan</td><td colspan="2">-</td></tr>
</tbody></table></div>
<script src="/ext/stub.js"></script><script src="/ext/mediasi-arsip.js"></script>
</body></html>`;

const POPUP = (namaLama) => `<form id="frm_upload_file"><table><tr><td colspan="2">${namaLama ? `<span style='color:#708090;font-weight:bold'>${namaLama}</span>` : "<span style='color:red;font-weight:bold'>Dokumen Belum Ada</span>"}</td></tr></table>
<input type="hidden" name="enc" id="enc" value="ENCmediasi"><input type="hidden" name="enc1" id="enc1" value="ENCmediasi"><input type="hidden" name="from" id="from" value="mediasi"><input type="hidden" name="urutan" id="urutan" value=""></form>`;

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const kirim = (tipe, isi) => (res.writeHead(200, { "content-type": tipe }), res.end(isi));
  if (u.pathname === "/SIPP/detil_perkara_agama") return kirim("text/html; charset=utf-8", halaman(u.searchParams.get("hasil") || "Tidak Berhasil"));
  if (u.pathname === "/ext/stub.js") return kirim("text/javascript", STUB);
  if (u.pathname === "/ext/mediasi-arsip.js") return kirim("text/javascript", KODE);
  if (u.pathname.startsWith("/SIPP/fileupload/")) return kirim("text/html", POPUP(u.searchParams.get("lama") || ""));
  if (u.pathname === "/SIPP/fileupload_c/validatePost") return kirim("application/json", JSON.stringify({ st: 1, msg: "Penyimpanan Dokumen Elektronik (E-Doc) Berhasil." }));
  res.writeHead(404);
  res.end("tidak ada");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const peramban = await chromium.launch({ channel: "chromium" });
const hasil = [];
const periksa = (nama, benar) => {
  hasil.push([nama, benar]);
  console.log(`${benar ? "OK   " : "GAGAL"} ${nama}`);
};
const dalam = (p, sel) => p.locator(`#aleta-mediasi-dialog ${sel}`);
const simpan = (p, nama) => p.screenshot({ path: path.join(keluar, nama) });
const pdfTmp = path.join(keluar, "contoh-laporan.pdf");
fs.writeFileSync(pdfTmp, "%PDF-1.4\n% contoh laporan mediasi\n%%EOF");

async function buka(lebar, tinggi, kueri) {
  const konteks = await peramban.newContext({ viewport: { width: lebar, height: tinggi } });
  const p = await konteks.newPage();
  p.on("pageerror", (g) => console.log("galat halaman:", String(g).slice(0, 200)));
  await p.goto(`http://127.0.0.1:${port}/SIPP/detil_perkara_agama?${kueri}`);
  await p.waitForFunction(() => Boolean(window.aletaMediasiArsip));
  await p.getByRole("button", { name: "Unggah hasil mediasi" }).waitFor();
  return { konteks, p };
}

try {
  {
    const { konteks, p } = await buka(1366, 760, "hasil=Tidak%20Berhasil");
    await p.locator("[data-am-berkas]").first().waitFor();
    await simpan(p, "1-tab-mediasi-tombol-dan-daftar.png");
    const kotak = await p.locator("td:has(> a[onclick*='edit_hasil_mediasi'])").boundingBox();
    const tombol = await p.getByRole("button", { name: "Unggah hasil mediasi" }).boundingBox();
    const tautan = await p.locator("a[onclick*='edit_hasil_mediasi']").boundingBox();
    periksa("tombol tepat di bawah tautan Edit Hasil Mediasi (sel yang sama)", tombol.y > tautan.y + tautan.height - 2 && tombol.y < tautan.y + tautan.height + 20 && tombol.y + tombol.height <= kotak.y + kotak.height + 1);
    periksa("daftar menampilkan dua berkas", (await p.locator("[data-am-berkas]").count()) === 2);

    await p.getByRole("button", { name: "Unggah hasil mediasi" }).click();
    await dalam(p, "h2").waitFor();
    await simpan(p, "2-dialog-pilih-berkas.png");
    await dalam(p, 'input[type="file"]').setInputFiles(pdfTmp);
    await dalam(p, ".berkas").waitFor();
    await dalam(p, "button:has-text('Lanjut')").click();
    await simpan(p, "3-dialog-konfirmasi.png");
    periksa("konfirmasi sebelum unggah", (await dalam(p, "h2").textContent()) === "Yakin mengunggah berkas ini?");
    await dalam(p, "button:has-text('Ya, unggah')").click();
    await dalam(p, "h2:has-text('Selesai')").waitFor();
    await simpan(p, "4-dialog-selesai.png");
    await dalam(p, "button:has-text('Tutup')").click();
    await p.waitForFunction(() => document.querySelectorAll("[data-am-berkas]").length === 3);
    periksa("daftar menyegar sesudah unggah (3 berkas)", true);
    periksa("bukan Y1: SIPP tidak disentuh sama sekali", (await p.evaluate(() => window.__sipp.length)) === 0);
    await konteks.close();
  }
  {
    const { konteks, p } = await buka(1366, 760, "hasil=Berhasil%20Dengan%20Akta%20Perdamaian");
    await p.getByRole("button", { name: "Unggah hasil mediasi" }).click();
    await dalam(p, 'input[type="file"]').setInputFiles(pdfTmp);
    await dalam(p, "label.pilihan").click();
    await simpan(p, "5-y1-pilihan-akta-perdamaian-sipp.png");
    await dalam(p, "button:has-text('Lanjut')").click();
    await simpan(p, "6-y1-konfirmasi-ke-sipp.png");
    await dalam(p, "button:has-text('Ya, unggah')").click();
    await dalam(p, "h2:has-text('Selesai')").waitFor();
    await simpan(p, "7-y1-terkirim-ke-sipp.png");
    const sipp = await p.evaluate(() => window.__sipp);
    periksa("Y1: halaman unggah e-Doc SIPP dibuka lalu validatePost dikirim", sipp.some((x) => x.includes("/SIPP/fileupload/ENCmediasi/mediasi")) && sipp.some((x) => x.startsWith("POST") && x.endsWith("/SIPP/fileupload_c/validatePost")));
    await konteks.close();
  }
  {
    const { konteks, p } = await buka(1366, 760, "hasil=Berhasil%20Dengan%20Akta%20Perdamaian");
    // e-Doc di SIPP sudah ada: halaman unggah memberi nama lama
    await p.route("**/SIPP/fileupload/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: POPUP("PADgl_2026_PdtG_684_akta_perdamaian_1792000000.pdf") }));
    await p.getByRole("button", { name: "Unggah hasil mediasi" }).click();
    await dalam(p, 'input[type="file"]').setInputFiles(pdfTmp);
    await dalam(p, "label.pilihan").click();
    await dalam(p, "button:has-text('Lanjut')").click();
    await dalam(p, "button:has-text('Ya, unggah')").click();
    await dalam(p, "h2:has-text('Di SIPP sudah ada e-Doc')").waitFor();
    await simpan(p, "8-y1-konfirmasi-timpa-sipp.png");
    periksa("menimpa e-Doc SIPP butuh konfirmasi tegas (belum ada tulisan ke SIPP)", !(await p.evaluate(() => window.__sipp)).some((x) => x.startsWith("POST")));
    await konteks.close();
  }
  {
    const { konteks, p } = await buka(390, 800, "hasil=Berhasil%20Dengan%20Akta%20Perdamaian&tema=gelap");
    await p.getByRole("button", { name: "Unggah hasil mediasi" }).click();
    await dalam(p, 'input[type="file"]').setInputFiles(pdfTmp);
    await p.waitForTimeout(300);
    await simpan(p, "9-dialog-hp-gelap.png");
    await konteks.close();
  }
} finally {
  await peramban.close();
  server.close();
}
const gagal = hasil.filter((x) => !x[1]);
console.log(gagal.length ? `GAGAL: ${gagal.map((x) => x[0]).join("; ")}` : "semua pemeriksaan hijau");
process.exit(gagal.length ? 1 : 0);
