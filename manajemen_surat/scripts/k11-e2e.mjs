#!/usr/bin/env node
/**
 * ============================================================================
 * K11 - UJI UJUNG KE UJUNG: EKSTENSI SUNGGUHAN DI CHROMIUM, HALAMAN SIPP/ABT TIRUAN
 * ============================================================================
 *
 * Uji jsdom tidak dapat membuktikan dua hal yang justru dipertaruhkan K11: (1) skrip
 * mana yang SUNGGUH disuntikkan Chrome ke tiap jenis halaman (manifest + modul malas),
 * dan (2) bahwa fitur di tiap halaman tetap menggambar hal yang SAMA. Skrip ini memuat
 * folder ekstensi ke Chromium bawaan Playwright, membuka halaman tiruan (HTML kecil
 * yang meniru bentuk SIPP/ABT/portal; API portal ditiru server lokal), lalu mencatat:
 *
 *   - tiap skrip ekstensi yang di-parse (nama + ukuran byte) lewat CDP Debugger;
 *   - rupa DOM tambahan ALETA (panel, pita, lencana) sesudah halaman tenang;
 *   - galat skrip yang tidak tertangkap.
 *
 * Dijalankan terhadap ekstensi SEBELUM dan SESUDAH; k11-bandingkan (di sini juga)
 * menyatakan rupa DOM harus sama dan menghitung selisih byte.
 *
 * Pakai (dari manajemen_surat/):
 *   node scripts/k11-e2e.mjs --ekstensi <folder> --keluar <hasil.json> [--skenario a,b] [--profil <folder>]
 *   node scripts/k11-e2e.mjs --bandingkan <sebelum.json> <sesudah.json>
 *
 * Catatan: halaman tiruan disajikan di 127.0.0.1 (pola cocok manifest: http://127.0.0.1/index.php/*,
 * /aps_badilag/*, /aleta/*; port diabaikan pola). Tidak ada login ke sistem sungguhan.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const JEDA_TENANG_MS = 2500;
const BATAS_TENANG_MS = 20000;

// ----------------------------------------------------------------------------
// Halaman tiruan
// ----------------------------------------------------------------------------
const NOMOR = "556/Pdt.G/2026/PA.Dgl";
const NOMOR_B = "557/Pdt.G/2026/PA.Dgl";
const NOMOR_C = "558/Pdt.P/2026/PA.Dgl";

function rangka(isi, judul = "SIPP") {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${judul}</title></head><body>
<div id="atas"><span>Selamat Datang</span> <a href="#">Munifa</a></div>
<ul id="cssmenu"><li><a href="#">Beranda</a></li><li><a href="#">Perkara</a><ul><li><a href="#">Daftar</a></li></ul></li><li><a href="#">Laporan</a></li></ul>
<div id="konten" class="wrapper">${isi}</div></body></html>`;
}

const halaman = {
  beranda: () => rangka(`<h2>Beranda</h2><p>Statistik perkara tahun ini.</p>`),
  laporan: () => rangka(`<h2>Laporan</h2><table class="cssTable"><tr><td>Jumlah</td><td>12</td></tr></table>`),
  daftar: () =>
    rangka(
      `<table class="cssTable"><thead><tr><th>No</th><th>Nomor Perkara</th><th>Penggugat</th><th>Tergugat</th></tr></thead><tbody>` +
        [NOMOR, NOMOR_B, NOMOR_C].map((n, i) => `<tr><td>${i + 1}</td><td>${n}</td><td>Siti</td><td>Budi</td></tr>`).join("") +
        `</tbody></table>`
    ),
  perkara: () =>
    rangka(
      `<table id="submenus"><tr><td><a class="btn" href="#">Kembali</a></td></tr></table>` +
        `<div id="tabs1"><table class="cssTable" id="tableDetilPerkara">` +
        `<tr><td id="first-child">Nomor Urut</td><td colspan="2">556</td></tr>` +
        `<tr><td id="first-child">Nomor Perkara</td><td colspan="2">\n\t\t\t${NOMOR}\t\t</td></tr>` +
        `<tr><td id="first-child">Jenis Perkara</td><td colspan="2">Cerai Gugat</td></tr>` +
        `<tr><td id="first-child">Posita</td><td colspan="2" class="wrapword">Bahwa Penggugat dan Tergugat telah menikah dan dikaruniai satu anak.</td></tr>` +
        `</table></div>`
    ),
  formPihak: () =>
    rangka(
      `<form id="frm_ref_pihak"><input id="pihak_fullname" name="fullname"><input id="pihak_email" name="email"><input id="pihak_no_tlp" name="tlp">` +
        `<select id="pihak_provinsi"><option value="">-</option></select><button type="button">Simpan</button></form>`
    ),
  formPenetapan: () =>
    rangka(
      `<form id="frm_majelis" action="/index.php/f_validate_input"><input type="hidden" id="action" value="add"><table><tr><td>Nomor Perkara</td><td>${NOMOR}</td></tr>` +
        `<tr><td>Ketua</td><td><select id="hakim_ketua"><option value="">-</option></select></td></tr></table><button type="button">Simpan</button></form>`
    ),
  formSaksi: () =>
    rangka(`<form id="frm_user"><input id="pihak_ke" value="13"><textarea id="keterangan"></textarea><input id="pihak_fullname"></form>`),
  cetak: () => rangka(`<p>Relaas panggilan ${NOMOR}</p>`, "Cetak"),
  abtBeranda: () => rangka(`<h2>ABT</h2><p>Aplikasi Blangko Terpadu</p>`, "ABT"),
  // Beranda ABT sungguhan: #navbar .accordion + .pricing_inner_w3ls (halamanBerandaAbt)
  abtBerandaPenuh: () =>
    rangka(
      `<div id="navbar"><div class="accordion"><a href="#">Cerai Gugat</a></div></div><div class="pricing_inner_w3ls"><div class="pricing-top"><p><a href="#">[01] Putusan.rtf</a></p></div></div>`,
      "ABT"
    ),
  // Halaman daftar variabel blangko: >=5 baris td[id=NNNN] + tautan load_form(...) (halamanBlangko)
  abtBlangko: () =>
    rangka(
      `<h3 class="w3l_header"><span>${NOMOR}</span></h3><div id="wrapper"><table>` +
        ["0001", "0002", "0003", "0004", "0005", "0006"].map((k, i) => `<tr><td id="${k}">${k}</td><td>Isian ${i}</td><td>Nilai ${i}</td><td><a onclick="load_form('${k}','9876','tmpabc')">ubah</a></td></tr>`).join("") +
        `</table></div>`,
      "ABT"
    ),
  portal: () => `<!doctype html><html><head><meta charset="utf-8"><title>Portal</title></head><body><main><h1>Portal</h1></main></body></html>`,
};

const SKENARIO = [
  { nama: "sipp-beranda", jalur: "/index.php/dashboard", html: halaman.beranda },
  { nama: "sipp-laporan", jalur: "/index.php/laporan_umum", html: halaman.laporan },
  { nama: "sipp-daftar-perkara", jalur: "/index.php/perkara_list", html: halaman.daftar },
  { nama: "sipp-perkara", jalur: "/index.php/perkara_detil_agama/abc123", html: halaman.perkara },
  { nama: "sipp-detil-perkara-ui", jalur: "/index.php/detil_perkara_agama", html: halaman.perkara, simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true } },
  { nama: "sipp-perkara-ui", jalur: "/index.php/perkara_detil_agama/abc123", html: halaman.perkara, simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true } },
  { nama: "sipp-daftar-ui", jalur: "/index.php/perkara_list", html: halaman.daftar, simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true } },
  { nama: "sipp-form-pihak", jalur: "/index.php/pihak_list", html: halaman.formPihak },
  { nama: "sipp-form-pihak-ui", jalur: "/index.php/pihak_list_ui", html: halaman.formPihak, simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true } },
  { nama: "sipp-form-penetapan-ui", jalur: "/index.php/perkara_detil_agama/form1", html: halaman.formPenetapan, simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true } },
  { nama: "sipp-form-saksi-ui", jalur: "/index.php/saksi_form", html: halaman.formSaksi, simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true } },
  { nama: "sipp-cetak", jalur: "/index.php/c_template_relaas_agama/popup_relaas/1", html: halaman.cetak },
  { nama: "abt-beranda", jalur: "/aps_badilag/index.php/abt", html: halaman.abtBeranda },
  { nama: "abt-beranda-penuh", jalur: "/aps_badilag/index.php/abt/beranda", html: halaman.abtBerandaPenuh },
  { nama: "abt-blangko", jalur: "/aps_badilag/index.php/abt/daftar_variabel", html: halaman.abtBlangko },
  { nama: "abt-blangko-ui", jalur: "/aps_badilag/index.php/abt/daftar_variabel", html: halaman.abtBlangko, simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true } },
  { nama: "portal", jalur: "/aleta/dashboard", html: halaman.portal },
];

// ----------------------------------------------------------------------------
// API portal tiruan (bentuk jawaban mengikuti uji jsdom ekstensi-halaman-perkara-bukan-daftar)
// ----------------------------------------------------------------------------
function konteksContoh(nomor) {
  return {
    ok: true,
    nomorPerkara: nomor,
    nomorRegister: "PA.DGL-2026-0556",
    identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
    ringkasan: { dokumen: 0 },
    dokumen: [],
    selisih: [],
    nomorPihak: [],
    diperiksaPada: "2026-10-26T01:00:00.000Z",
    ambangMendesakHari: 3,
    hakim: null,
  };
}

function jawabApi(url, peran = "Super Admin") {
  const u = new URL(url, "http://x");
  const p = u.pathname.replace(/^\/aleta/, "");
  const nama = "Munifa, S.H.";
  const ok = (data) => ({ status: 200, isi: { ok: true, data } });
  if (p.includes("/api/aleta-ecourt/ekstensi/tampilan")) return { status: 404, isi: {} };
  if (p.includes("/aleta-ecourt/ekstensi/siapa")) return ok({ nama, peran, kapabilitas: null });
  if (p.includes("/aleta-bot/sipp-konteks/massal")) return ok({ available: true, perkara: {}, identitas: {} });
  if (p.includes("/aleta-bot/sipp-konteks")) {
    const nomor = u.searchParams.get("nomor") || u.searchParams.get("nomorPerkara") || NOMOR;
    return ok({ available: true, konteks: konteksContoh(nomor), pengguna: { nama, peran }, kapabilitas: null });
  }
  if (p.includes("/aleta-ecourt/status-perkara")) {
    return ok({ available: true, status: { majelis: [{ nama }], panitera: [], jurusita: [], ikrar: null, sumberMajelis: "pemeriksa", putusan: { sudahPutus: false }, putusanLengkap: {}, penilaianSk: { rinci: [] }, tahapan: { terbaca: true, tahap: [] } } });
  }
  if (p.includes("/putusan/isian-sipp")) return ok({ ada: false, sebab: "Belum ada draf putusan untuk perkara ini." });
  if (p.endsWith("/api/install")) return { status: 200, isi: { ok: true } };
  return { status: 404, isi: {} };
}

function mulaiServer(peran) {
  const permintaan = [];
  const srv = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url.startsWith("/aleta/api/")) {
      permintaan.push(`${req.method} ${url.split("?")[0]}`);
      const { status, isi } = jawabApi(url, peran);
      res.writeHead(status, { "content-type": "application/json" });
      return res.end(JSON.stringify(isi));
    }
    const s = SKENARIO.find((x) => url.split("?")[0] === x.jalur);
    if (!s) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("tidak ada");
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(s.html());
  });
  return new Promise((selesai) => srv.listen(0, "127.0.0.1", () => selesai({ srv, port: srv.address().port, permintaan })));
}

// ----------------------------------------------------------------------------
// Pencatat
// ----------------------------------------------------------------------------
/** Rupa DOM buatan ALETA, dinormalkan supaya dua jalan dapat dibandingkan. */
function ambilRupaDom() {
  const norm = (t) =>
    String(t || "")
      .replace(/\s+/g, " ")
      .replace(/\d{1,2}[.:]\d{2}(?:[.:]\d{2})?/g, "<jam>")
      .replace(/\b\d+ (?:detik|menit|jam|hari) (?:yang )?lalu\b/gi, "<lalu>")
      .trim();
  const hasil = { panel: [], elemen: {}, teks: "" };
  const semua = Array.from(document.querySelectorAll("[id^='aleta'], [class*='aleta'], [data-aleta-menu], [data-aleta-warna]"));
  for (const el of semua) {
    const kunci = (el.id ? `#${el.id}` : "") + "." + String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || "").split(/\s+/).filter(Boolean).sort().join(".");
    // id acak per muat (aleta-lipat-<acak>-k1) dinormalkan: dua jalan tak pernah mendapat acak yang sama
    const kunciTetap = kunci.replace(/aleta-lipat-[a-z0-9]+-/g, "aleta-lipat-#-");
    hasil.elemen[kunciTetap] = (hasil.elemen[kunciTetap] || 0) + 1;
  }
  const panel = document.querySelector("#aleta-panel-sipp, .aleta-panel-abt");
  if (panel) {
    hasil.panel = Array.from(panel.querySelectorAll(".aleta-bagian[data-kunci]")).map((b) => b.getAttribute("data-kunci"));
    hasil.teks = norm(panel.textContent);
    hasil.mode = panel.dataset.mode || "";
  }
  hasil.judul = document.title;
  return hasil;
}

/** Menekan tiap tab panel lalu membentangkan semua bagian: memaksa kode tiap tab/bagian (di modul malas) berjalan. */
async function jalankanInteraksi() {
  const norm = (t) =>
    String(t || "")
      .replace(/\s+/g, " ")
      .replace(/\d{1,2}[.:]\d{2}(?:[.:]\d{2})?/g, "<jam>")
      .replace(/\b\d+ (?:detik|menit|jam|hari) (?:yang )?lalu\b/gi, "<lalu>")
      .trim();
  const jeda = (ms) => new Promise((r) => setTimeout(r, ms));
  const panel = () => document.querySelector("#aleta-panel-sipp, .aleta-panel-abt");
  const hasil = { tab: {}, bagianTerbuka: [], teksSesudahBuka: "" };
  for (const t of Array.from(document.querySelectorAll(".aleta-t7-tab"))) {
    t.click();
    await jeda(600);
    const p = panel();
    hasil.tab[t.getAttribute("data-t7-ke") || "?"] = p ? norm(p.textContent) : "";
  }
  for (const k of Array.from(document.querySelectorAll(".aleta-bagian-judul"))) {
    const isi = k.nextElementSibling;
    if (isi && isi.style && isi.style.display === "none") {
      k.click();
      hasil.bagianTerbuka.push(k.textContent.replace(/\s+/g, " ").trim().slice(0, 60));
    }
  }
  await jeda(3500);
  const p = panel();
  hasil.teksSesudahBuka = p ? norm(p.textContent) : "";
  hasil.jumlahTombol = p ? p.querySelectorAll("button").length : 0;
  return hasil;
}

async function tunggu(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function jalankan({ ekstensi, keluar, nama, profil, peran }) {
  const { chromium } = await import("playwright-core");
  const { srv, port, permintaan } = await mulaiServer(peran);
  const dirProfil = profil || path.join(process.env.TEMP || process.env.TMP || "D:/Aplikasi/aleta/tmp", `k11-profil-${Date.now()}`);
  const ctx = await chromium.launchPersistentContext(dirProfil, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${ekstensi}`, `--load-extension=${ekstensi}`],
  });
  const hasil = {};
  try {
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 15000 });
    for (const s of SKENARIO) {
      if (nama && nama.length && !nama.includes(s.nama)) continue;
      await sw.evaluate(async (simpanan) => {
        await chrome.storage.local.clear();
        if (simpanan) await chrome.storage.local.set(simpanan);
      }, s.simpanan || null);
      permintaan.length = 0;
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      const skrip = [];
      const galat = [];
      cdp.on("Debugger.scriptParsed", (e) => {
        if (/^chrome-extension:/.test(e.url)) skrip.push({ berkas: e.url.split("/").pop(), byte: e.length || 0 });
      });
      cdp.on("Runtime.exceptionThrown", (e) => {
        const d = e.exceptionDetails || {};
        galat.push(String((d.exception && d.exception.description) || d.text || "").split("\n")[0].slice(0, 200));
      });
      await cdp.send("Debugger.enable");
      await cdp.send("Runtime.enable");
      await page.goto(`http://127.0.0.1:${port}${s.jalur}`, { waitUntil: "load" });
      // tunggu tenang: tidak ada skrip/DOM ALETA baru selama JEDA_TENANG_MS
      let terakhir = "";
      let sejak = Date.now();
      const mulai = Date.now();
      while (Date.now() - mulai < BATAS_TENANG_MS) {
        await tunggu(500);
        const cap = `${skrip.length}|${await page.evaluate(() => document.querySelectorAll("[id^='aleta'], [class*='aleta']").length)}|${await page.evaluate(() => (document.body ? document.body.textContent.length : 0))}`;
        if (cap !== terakhir) {
          terakhir = cap;
          sejak = Date.now();
        } else if (Date.now() - sejak >= JEDA_TENANG_MS) break;
      }
      const rupa = await page.evaluate(ambilRupaDom);
      rupa.interaksi = await page.evaluate(jalankanInteraksi);
      rupa.sesudahInteraksi = await page.evaluate(ambilRupaDom);
      const ring = {};
      for (const k of skrip) ring[k.berkas] = k.byte;
      hasil[s.nama] = {
        jalur: s.jalur,
        skrip: skrip.map((k) => k.berkas),
        jumlahSkrip: skrip.length,
        byteSkrip: skrip.reduce((a, k) => a + k.byte, 0),
        rinci: ring,
        rupa,
        galat: [...new Set(galat)],
        permintaanPortal: [...new Set(permintaan)].sort(),
      };
      await page.close();
    }
  } finally {
    await ctx.close();
    srv.close();
  }
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(hasil, null, 2));
  return hasil;
}

function bandingkan(a, b) {
  const baris = [];
  let beda = false;
  for (const nama of Object.keys(a)) {
    const x = a[nama];
    const y = b[nama];
    if (!y) {
      baris.push(`${nama}: tidak ada di sesudah`);
      beda = true;
      continue;
    }
    const samaRupa = JSON.stringify(x.rupa) === JSON.stringify(y.rupa);
    const samaGalat = JSON.stringify(x.galat) === JSON.stringify(y.galat);
    const samaMinta = JSON.stringify(x.permintaanPortal) === JSON.stringify(y.permintaanPortal);
    baris.push(
      `${nama.padEnd(22)} skrip ${String(x.jumlahSkrip).padStart(3)} -> ${String(y.jumlahSkrip).padStart(3)}  byte ${String(x.byteSkrip).padStart(8)} -> ${String(y.byteSkrip).padStart(8)} (${((y.byteSkrip - x.byteSkrip) / 1024).toFixed(0)} KB)  rupa ${samaRupa ? "SAMA" : "BEDA"}  galat ${samaGalat ? "sama" : "BEDA"}  permintaan ${samaMinta ? "sama" : "BEDA"}`
    );
    if (!samaRupa || !samaGalat || !samaMinta) beda = true;
  }
  return { baris, beda };
}

async function utama(argv) {
  if (argv[0] === "--bandingkan") {
    const a = JSON.parse(fs.readFileSync(argv[1], "utf8"));
    const b = JSON.parse(fs.readFileSync(argv[2], "utf8"));
    const { baris, beda } = bandingkan(a, b);
    console.log(baris.join("\n"));
    return beda ? 1 : 0;
  }
  const ambil = (k) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const ekstensi = ambil("--ekstensi");
  if (!ekstensi) {
    console.error("pakai: --ekstensi <folder> --keluar <hasil.json> [--skenario a,b] [--profil <folder>] [--peran <nama>]");
    return 2;
  }
  const nama = ambil("--skenario") ? ambil("--skenario").split(",") : [];
  const hasil = await jalankan({ ekstensi: path.resolve(ekstensi), keluar: ambil("--keluar"), nama, profil: ambil("--profil"), peran: ambil("--peran") || "Super Admin" });
  for (const [k, v] of Object.entries(hasil)) {
    console.log(`${k.padEnd(22)} skrip ${String(v.jumlahSkrip).padStart(3)}  ${(v.byteSkrip / 1024).toFixed(0).padStart(6)} KB  bagian-panel ${v.rupa.panel.length}  galat ${v.galat.length}`);
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("k11-e2e.mjs")) {
  utama(process.argv.slice(2)).then(
    (kode) => process.exit(kode),
    (e) => {
      console.error(e);
      process.exit(1);
    }
  );
}

export { SKENARIO, bandingkan, jalankan };
