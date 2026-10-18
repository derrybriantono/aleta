// Tangkap DOM panel SUNGGUHAN (jsdom) lalu ukur di Chromium headless pada banyak lebar layar.
// Dijalankan dari manajemen_surat/: node <skrip> sipp|abt
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const AKAR_MS = process.cwd();
const require = createRequire(path.join(AKAR_MS, "package.json"));
const { JSDOM } = require("jsdom");
const { chromium } = require("playwright-core");
const EKS = path.resolve(AKAR_MS, "../ekstensi-sipp");
const baca = (b) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n");
const KELUAR = process.env.KELUAR || path.resolve(AKAR_MS, "../docs/uiux-v2");
mkdirSync(KELUAR, { recursive: true });

const ASAL = "http://192.168.10.10";
const NOMOR = "450/Pdt.G/2026/PA.Dgl";
const polos = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai(f, ket, batas = 6000) {
  const t = Date.now();
  for (;;) {
    let h;
    try { h = f(); } catch { h = undefined; }
    if (h) return h;
    if (Date.now() - t > batas) throw new Error("tidak tercapai: " + ket);
    await tunggu(15);
  }
}

function chromeTiruan(w, simpanan) {
  const pendengar = [];
  const siarkan = (u) => setTimeout(() => pendengar.forEach((f) => f(polos(u), "local")), 0);
  const local = {
    get: async (k) => {
      const d = k == null ? Object.keys(simpanan) : [k].flat();
      const h = {};
      for (const x of d) if (x in simpanan) h[x] = polos(simpanan[x]);
      return h;
    },
    set: async (isi) => {
      const u = {};
      for (const [k, v] of Object.entries(isi)) { u[k] = { oldValue: simpanan[k], newValue: polos(v) }; simpanan[k] = polos(v); }
      siarkan(u);
    },
    remove: async () => undefined,
  };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.5" }), getURL: (x) => "chrome-extension://aleta-uji/" + x, sendMessage: (p, b) => (b ? b({ ok: true }) : Promise.resolve({})), lastError: undefined },
    storage: { local, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: (f) => pendengar.push(f) } },
  };
}
function tanggap(isi, status = 200, mentah, jenis) {
  if (mentah !== undefined) return new Response(Buffer.from(mentah, "latin1"), { status, headers: { "content-type": jenis || "text/plain" } });
  return new Response(JSON.stringify(isi ?? {}), { status, headers: { "content-type": "application/json" } });
}

// ---------------------------------------------------------------- SIPP
function konteksContoh() {
  return {
    ok: true, nomorPerkara: NOMOR, nomorRegister: "PA.DGL-2026-0450",
    identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
    ringkasan: { dokumen: 1 },
    dokumen: [{ judulDokumen: "Jawaban", agenda: "Jawaban", sisaHari: 2, batasUnggahTeks: "Batas unggah 2 hari lagi", statusVerifikasi: "menunggu", adaPdf: true, adaWord: false, documentKey: "k1" }],
    selisih: [], nomorPihak: [], diperiksaPada: new Date().toISOString(), ambangMendesakHari: 3, hakim: null,
  };
}
function statusContoh() {
  return {
    tahapan: { terbaca: true, tahap: [{ kunci: "daftar", label: "Pendaftaran", terbaca: true, tanggal: "2026-09-01", hariSampaiInput: 0 }, { kunci: "pmh", label: "Penetapan Majelis", terbaca: true, tanggal: "" }] },
    relaas: [], jadwal: [], petitum: { ada: true },
    putusan: { sudahPutus: true, tanggalPutusan: "2026-09-27", tanggalMinutasi: "", tanggalBht: "" },
    putusanLengkap: { tanggalPutusan: "2026-09-27" }, upayaHukum: [], putusanEcourt: null,
    penilaianSk: { rinci: [
      { kunci: "waktuMinutasi", label: "Waktu minutasi berkas perkara", terbaca: true, poin: 0, poinMaksimal: 5, poinMinimal: 0, catatan: "Berkas belum diminutasi." },
      { kunci: "waktuPublikasi", label: "Waktu publikasi putusan", terbaca: true, poin: 0, poinMaksimal: 5, poinMinimal: 0, catatan: "Putusan belum diunggah." },
    ] },
  };
}
function jawabSipp(url) {
  if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) return { status: 404, isi: {} };
  if (url.includes("/aleta-bot/sipp-konteks?")) return { isi: { ok: true, data: { available: true, konteks: konteksContoh(), pengguna: { nama: "Pengguna Contoh", peran: "Super Admin" }, kapabilitas: null } } };
  if (url.includes("/aleta-ecourt/status-perkara?")) return { isi: { ok: true, data: { available: true, status: statusContoh() } } };
  if (url.includes("/aleta-ecourt/templat-hukum")) return { isi: { ok: true, data: { butir: [] } } };
  if (url.includes("/aleta-ecourt/bas-komentar")) return { status: 404, isi: {} };
  return { isi: { ok: true, data: {} } };
}
async function bukaSipp(simpananAwal) {
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>Nomor Perkara ${NOMOR}</h3></div></body></html>`,
    { url: `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
  const simpanan = polos(simpananAwal);
  chromeTiruan(w, simpanan);
  w.fetch = async (alamat) => { const h = jawabSipp(String(alamat)); return Object.assign(tanggap(h.isi, h.status ?? 200), {}); };
  w.Response = Response;
  const pmAsli = w.postMessage.bind(w);
  w.postMessage = (data, asal) => {
    if (data && data.sumber === "aleta-jembatan") {
      const { id, ...isi } = data;
      const balas = isi.jenis === "baca" ? { ok: true, medan: [] } : isi.jenis === "nilai" ? { ok: true, nilai: "", tampak: true } : { ok: true };
      setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan-jawab", id, ...balas }, source: w })), 0);
      return;
    }
    return pmAsli(data, asal);
  };
  const ctx = dom.getInternalVMContext();
  vm.runInContext(baca("panel-alat.js"), ctx, { filename: "panel-alat.js" });
  vm.runInContext(baca("konten.js"), ctx, { filename: "konten.js" });
  return { dom, w, d: w.document, simpanan };
}

const SEMUA_SIPP = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`sipp-${i + 1}`, true]));
const hasil = { sipp: [], abt: [] };

function ambil(h, id) {
  const d = h.d;
  const p = d.getElementById(id);
  const attrs = Array.from(d.documentElement.attributes).map((a) => `${a.name}="${a.value.replace(/"/g, "&quot;")}"`).join(" ");
  const gaya = Array.from(d.head.querySelectorAll("style")).map((s) => s.outerHTML).join("\n");
  const lain = Array.from(d.body.children).filter((e) => e.id && e.id.startsWith("aleta-") && e.id !== id).map((e) => e.outerHTML).join("\n");
  return { attrs, gaya, panel: p.outerHTML, lain };
}

const GAYA_PALSU = `
body{margin:0;font:13px Arial,sans-serif;background:#f4f4f4;color:#222}
#nav{height:56px;background:#1a5276;color:#fff;padding:18px 20px;box-sizing:border-box}
#isi{padding:16px 20px}
table.f{width:100%;border-collapse:collapse;background:#fff}
table.f td{border:1px solid #ccc;padding:8px}
table.f td:first-child{width:200px;background:#eee}
.simpan{margin:14px 0}
.simpan button{padding:8px 26px;background:#2e7d32;color:#fff;border:0;font-size:14px}
`;
function badanPalsu() {
  let baris = "";
  for (let i = 1; i <= 14; i++) baris += `<tr><td>Isian ${i}</td><td><input style="width:60%" value="contoh ${i}"> <input type="date"></td></tr>`;
  return `<div id="nav">SIPP - Pengadilan Agama (replika statis)</div><div id="isi"><h3>Putusan Akhir ${NOMOR}</h3><table class="f">${baris}</table><div class="simpan"><button id="simpan-palsu">Simpan</button> <button>Batal</button></div></div>`;
}


// ---------------------------------------------------------------- ABT
const ASAL_ABT = `${ASAL}/aps_badilag/index.php/abt`;
const ISI_ABT = {
  "0001": NOMOR, "0048": "Cerai Gugat", "0046": "Penggugat", "0047": "Tergugat",
  "7047": "Penggugat contoh binti Ayah contoh, umur 29 tahun, agama Islam, tempat kediaman di Desa Contoh, sebagai Penggugat;",
  "7048": "Tergugat contoh bin Ayah contoh, umur 33 tahun, sebagai Tergugat;",
  "5125": "Bahwa pada tanggal 14 Maret 2019 Penggugat dan Tergugat melangsungkan pernikahan;<br>Bahwa sejak bulan November 2022 sering terjadi perselisihan;",
  "4001": "Menjatuhkan talak satu ba'in shughra Tergugat terhadap Penggugat;",
  "8503": "G", "0222": "DATA_TIDAK_ADA", "9944": "DATA_TIDAK_ADA", "7035": "DATA_TIDAK_ADA", "0132": "DATA_TIDAK_ADA", "0156": "DATA_TIDAK_ADA",
};
const NAMA_ABT = { "0001": "No Perkara", "0048": "Jenis Perkara", "7047": "IDENTITAS Nama Penggugat", "7048": "IDENTITAS Nama Tergugat", "5125": "POSITA LENGKAP", "4001": "AMAR PUTUSAN", "8503": "Huruf Alasan", "0222": "Awal Konflik" };
const USULAN_SIPP = { ok: true, jumlahKuasa: 0, prodeo: false, usulan: [
  { kode: "0132", nama: "Tgl. Kuasa Penggugat", nilai: "", keyakinan: "kosong", sumber: [] },
  { kode: "0222", nama: "Awal Konflik", nilai: "bulan November 2022", keyakinan: "ragu", sumber: [{ asal: "posita", kalimat: "Bahwa sejak bulan November 2022 sering terjadi perselisihan yang berkepanjangan antara Penggugat dan Tergugat sehingga rumah tangga tidak harmonis" }] },
  { kode: "0156", nama: "Kantor Kuasa Penggugat", nilai: "", keyakinan: "kosong", sumber: [] },
  { kode: "0227", nama: "Tanggal Fasakh", nilai: "", keyakinan: "tidak_ada_sumber", sumber: [] },
  { kode: "0661", nama: "No. SK Prodeo", nilai: "", keyakinan: "tidak_ada_sumber", sumber: [] },
] };
const USULAN_SAKSI = { butir: { saksi1: 1, saksi2: 1 }, selisih: [{ hal: "Tahun menikah", saksi1: "2019", saksi2: "2018" }], ciri: ["perselisihan terus-menerus"], ciriSepihak: [], ciriDiluarGugatan: [], ciriBelumTerbukti: ["tidak memberi nafkah"], gugatanTerbaca: true,
  huruf: [{ huruf: "F", pemicu: ["perselisihan"], syarat: "", dasar: [] }], hurufBelumSiap: [],
  usulan: [
    { kode: "0222", nama: "Awal Konflik", nilai: "November 2022", keyakinan: "pasti", sumber: [{ saksi: 1, kalimat: "sejak November 2022" }] },
    { kode: "9944", nama: "Lama Pisah", nilai: "1 tahun", keyakinan: "cukup", sumber: [] },
    { kode: "7035", nama: "Yang Meninggalkan", nilai: "Tergugat", keyakinan: "bentrok", bentrok: "Penggugat", sumber: [] } ] };
const SAKSI_SDG = { ok: true, alasan: ["perselisihan terus-menerus"], asalAlasan: "posita", saksi: [1, 2].map((ke) => ({ ke, pihak: "P", jawaban: [
  { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Kenal, saksi adalah paman Penggugat" },
  { no: "2", tanya: "Kapan Penggugat dan Tergugat menikah?", jawab: "Tahun 2019" },
  { no: "3", tanya: "Sejak kapan tidak rukun?", jawab: "Sejak bulan November 2022 sering bertengkar", varian: { n: 1, habis: true } } ] })) };
function jawabAbt(url, cara, badan) {
  if (url.includes("/aleta-bot/abt/usulan")) {
    const m = JSON.parse(badan || "{}");
    if (m.sumber === "siapa") return { isi: { data: { available: true, pengguna: { nama: "Pengguna Contoh", peran: "Super Admin" }, kapabilitas: {} } } };
    if (m.sumber === "sipp") return { isi: { data: { available: true, sipp: USULAN_SIPP } } };
    if (m.sumber === "saksi") return { isi: { data: { available: true, saksi: USULAN_SAKSI } } };
    if (m.sumber === "saksi-sdg") return { isi: { data: { available: true, saksiSdg: SAKSI_SDG } } };
    return { isi: { data: { available: true } } };
  }
  if (url.includes("/aleta-ecourt/bas-komentar")) return { isi: { ok: true, data: { komentar: [], saya: { id: "pp", nama: "PP", bolehMenulis: false, bolehMenyelesaikanSemua: true } } } };
  if (url.includes("/aleta-ecourt/templat-hukum")) return { isi: { ok: true, data: { butir: [], bolehMenyunting: false } } };
  if (url.includes("/aleta-ecourt/abt-wajib")) return { isi: { ok: true, data: { jenis: "Cerai Gugat", variabel: [], diukurPada: "2026-09-29T00:00:00+08:00", catatan: "" } } };
  if (url.includes("/aleta-ecourt/riwayat-pihak")) return { isi: { ok: true, data: { available: true, ok: true, pihak: [] } } };
  if (url.includes("/aleta-ecourt/abt-riwayat")) return { isi: { ok: true, data: { daftar: [] } } };
  if (url.includes("/edit_data?")) return { mentah: '<input type="hidden" name="var_type" value="data_teks">', jenis: "text/html" };
  if (url.includes("/tanyajawab_perkara_edit?")) return { mentah: `<select><option value=''>--> Load Template <--</option></select><script>\n var ajax_data = [] \n</script>`, jenis: "text/html" };
  if (url.includes("/tanyajawab_template_edit?")) return { mentah: "<script>\n var ajax_data = [] \n</script>", jenis: "text/html" };
  return { status: 404, isi: { ok: false, error: { message: "tidak ada" } } };
}
async function bukaAbt(simpananAwal) {
  const baris = Object.keys(ISI_ABT).map((k) => `<tr valign="top"><td align=center id="${k}">${k}</td><td>${NAMA_ABT[k] || "Variabel " + k}</td><td>${ISI_ABT[k]}</td><td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`).join("");
  const dom = new JSDOM(`<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="cssmenu"></div><div id="content"><h3 class="w3l_header"><span>${NOMOR}</span></h3><p class="cetak"><a id="cetak" href="${ASAL_ABT}/preview?c=10018&b=B&a=A">CETAK</a></p><table>${baris}</table></div></div></body></html>`,
    { url: `${ASAL_ABT}/main/view?a=A&b=B&c=10018&d=3`, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const simpanan = polos(simpananAwal);
  chromeTiruan(w, simpanan);
  w.fetch = async (alamat, opsi) => { const j = jawabAbt(String(alamat), String((opsi && opsi.method) || "GET").toUpperCase(), typeof (opsi && opsi.body) === "string" ? opsi.body : ""); return tanggap(j.isi, j.status ?? 200, j.mentah, j.jenis); };
  w.Response = Response; w.TextDecoder = TextDecoder; w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", { configurable: true, get() { return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""); } });
  w.confirm = () => false;
  w.eval(`${baca("panel-alat.js")}\n;\n${baca("abt.js")}\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`);
  return { dom, w, d: w.document, simpanan };
}
const SEMUA_ABT = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`abt-${i + 1}`, true]));


// ---------------------------------------------------------------- WIDGET + PORTAL
function butirContoh() {
  const hari = (n) => { const t = new Date(); t.setDate(t.getDate() + n); t.setHours(16, 0, 0, 0); return t.toISOString(); };
  const mk = (id, jenis, judul, no, n, kel, ket) => ({ id, jenis, judul, perkara: { id: 100 + Number(no), nomor: `${no}/Pdt.G/2026/PA.Dgl` }, tenggat: hari(n), kelompok: kel, keterangan: ket, kerjakan: { tujuan: "sipp", halaman: "penetapan" } });
  return [mk("l1", "pmh", "PMH belum ditetapkan", 385, -2, "lewat", "didaftarkan 20 Sep"), mk("l2", "minutasi", "Minutasi belum dikerjakan", 386, -1, "lewat", "putus 10 Sep"),
    mk("h1", "sidang", "Sidang hari ini", 387, 0, "hari-ini", "Ruang 1"), mk("h3", "bas", "BAS belum diunggah", 389, 0, "hari-ini", ""), mk("m1", "phs", "PHS mendekati tenggat", 390, 3, "minggu-ini", "")];
}
const CHECK = { ok: true, data: { pengguna: { nama: "Pengguna Contoh", peran: ["hakim", "ketua"] }, peranTersedia: [{ kunci: "hakim", label: "Hakim" }, { kunci: "ketua", label: "Ketua" }], peranAktif: "hakim", dibuat: new Date().toISOString(),
  ringkas: { lewat: 2, hariIni: 2, mingguIni: 1, selesaiHariIni: 1, totalHariIni: 4 }, butir: butirContoh(), jenisTidakTersedia: [], galat: [] } };
const SIAPA = { ok: true, data: { nama: "Pengguna Contoh", peran: "Super Admin", roleId: "super-admin", peranTambahan: ["hakim"], kapabilitas: { panel: true, berkas: true, kerjakan: false }, keterangan: {},
  menu: [{ href: "/admin/aleta-ecourt", label: "Integrasi e-Court", keterangan: "kewenangan ekstensi" }, { href: "/aleta-sipp", label: "ALETA x SIPP", keterangan: "penetapan dan penunjukan" }], bolehMengatur: true, versiEkstensi: "1.205.5", dirilis: "2026-10-17T10:00:00+08:00", versiTipe: null } };
async function bukaGenerik(url, html, simpananAwal, skrip, jawab) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, { url, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const simpanan = polos(simpananAwal);
  chromeTiruan(w, simpanan);
  w.fetch = async (alamat, opsi) => { const j = jawab(String(alamat), String((opsi && opsi.method) || "GET").toUpperCase()); return Object.assign(tanggap(j.isi, j.status ?? 200), {}); };
  w.Response = Response;
  w.Element.prototype.scrollIntoView = function () {};
  w.document.addEventListener("click", (e) => e.preventDefault(), true);
  const ctx = dom.getInternalVMContext();
  for (const b of skrip) vm.runInContext(baca(b), ctx, { filename: b });
  return { dom, w, d: w.document, simpanan };
}
function jawabPortal(url) {
  if (url.includes("/ekstensi/siapa")) return { isi: SIAPA };
  if (url.includes("/aleta-ecourt/checklist")) return { isi: CHECK };
  if (url.includes("/ekstensi-panel/catatan")) return { isi: { ok: true, data: { versiPortal: "2.40.1", versiEkstensi: "1.205.5", catatan: [{ versi: "1.205.5", dirilis: "2026-10-17T16:10:00+08:00", judul: "Penetapan ikrar dan e-Doc" }] } } };
  if (url.includes("/ekstensi-panel/sambungan")) return { isi: { ok: true, data: { versiPortal: "2.40.1", bot: { hidup: true, ms: 40 }, whatsapp: { keadaan: "tersambung", sebab: "" }, ecourt: { keadaan: "hidup", sebab: "" } } } };
  return { isi: { ok: true, data: {} } };
}
async function rakitWidget(browser, rek, lebar, tinggi) {
  rek = { ...rek, attrs: selaraskanSkala(rek.attrs, lebar) };
  const css = baca("panel.css");
  const ctx = await browser.newContext({ viewport: { width: lebar, height: tinggi }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const html = `<!doctype html><html ${rek.attrs}><head><meta charset="utf-8"><style>${css}</style><style>${GAYA_PALSU}</style></head><body>${badanPalsu()}</body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(({ gaya, dalam, hostAttrs }) => {
    const a = document.createElement("aleta-cm-widget");
    a.id = "aleta-cm-akar";
    for (const [k, v] of hostAttrs) a.setAttribute(k, v);
    a.attachShadow({ mode: "open" }).innerHTML = dalam;
    document.documentElement.appendChild(a);
  }, { gaya: "", dalam: rek.dalam, hostAttrs: rek.hostAttrs });
  return { page, ctx };
}

export async function ukur(nama, rekaman, lebarLayar, tinggi = 800) {
  return rekaman;
}

// jsdom berlebar 1024: di layar >= 2200px panel-alat.js sungguhan memasang ekspresi calc() dengan
// pengali layar; replika menirunya di sini supaya tangkapan 2560/3840 sama dengan peramban.
function selaraskanSkala(attrs, lebar) {
  return lebar >= 2200 ? attrs.replace("--aleta-skala-huruf: 1;", "--aleta-skala-huruf: calc(1 * var(--aleta-v2-oto, 1));") : attrs;
}
async function rakitHalaman(browser, rek, lebar, tinggi, opsi = {}) {
  rek = { ...rek, attrs: selaraskanSkala(rek.attrs, lebar) };
  const css = baca("panel.css");
  const ctx = await browser.newContext({ viewport: { width: lebar, height: tinggi }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const html = `<!doctype html><html ${rek.attrs}><head><meta charset="utf-8"><style>${css}</style><style>${GAYA_PALSU}</style>${rek.gaya}</head><body>${opsi.tanpaLatar ? "" : badanPalsu()}${rek.panel}${rek.lain}</body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  return { page, ctx };
}

const LEBAR = [1280, 1366, 1920, 2560, 3840];
const TINGGI = { 1280: 720, 1366: 768, 1920: 1080, 2560: 1440, 3840: 2160 };


async function ukurSemua(browser, rek, idPanel, nama, laporan) {
  for (const l of LEBAR) {
    const { page, ctx } = await rakitHalaman(browser, rek, l, TINGGI[l]);
    const r = await page.evaluate((idp) => {
      const p = document.getElementById(idp);
      const b = p.getBoundingClientRect();
      const simpan = document.getElementById("simpan-palsu").getBoundingClientRect();
      const meluap = [...p.querySelectorAll("*")].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === "visible" && e.clientWidth > 0).slice(0, 6).map((e) => (e.className && e.className.baseVal === undefined ? e.className : e.tagName).toString().slice(0, 50));
      return { panel: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }, tutupSimpan: !(b.right <= simpan.left || b.left >= simpan.right || b.bottom <= simpan.top || b.top >= simpan.bottom), fs: getComputedStyle(p).fontSize, bodyMr: getComputedStyle(document.body).marginRight, meluap, sw: document.documentElement.scrollWidth };
    }, idPanel);
    laporan.push({ nama, lebar: l, ...r });
    if (process.env.FOTO) await page.screenshot({ path: path.join(KELUAR, `${nama}-${l}.png`) });
    await ctx.close();
  }
}

async function main() {
  const mode = process.argv[2] || "sipp";
  const browser = await chromium.launch();
  const laporan = [];
  if (mode === "sipp") {
    const h = await bukaSipp({ ujiTampilan: "ui", ujiFitur: SEMUA_SIPP, ujiIzinkanNyata: true });
    const panel = await sampai(() => { const p = h.d.getElementById("aleta-panel-sipp"); return p && p.getAttribute("data-t7") === "ui" && p.querySelector(".aleta-kelompok") ? p : null; }, "panel ui");
    await tunggu(1200);
    const tabs = Array.from(panel.querySelectorAll(".aleta-t7-tab")).map((t) => t.getAttribute("data-t7-ke"));
    laporan.push({ tabs });
    if (process.env.DUMP) { const e = panel.querySelector(process.env.DUMP); console.log(e ? e.outerHTML.slice(0, 4000) : "tidak ada"); }
    for (const ke of tabs) {
      panel.querySelector(`.aleta-t7-tab[data-t7-ke="${ke}"]`).click();
      await tunggu(80);
      await ukurSemua(browser, ambil(h, "aleta-panel-sipp"), "aleta-panel-sipp", `sipp-${ke}`, laporan);
    }
  } else if (mode === "abt") {
    const h = await bukaAbt({ ujiTampilan: "ui", ujiFitur: SEMUA_ABT, ujiIzinkanNyata: true });
    const panel = await sampai(() => { const p = h.d.getElementById("aleta-panel-abt"); return p && p.getAttribute("data-t6") === "ui" ? p : null; }, "panel abt ui");
    await tunggu(800);
    await ukurSemua(browser, ambil(h, "aleta-panel-abt"), "aleta-panel-abt", "abt-awal", laporan);
    const tombolTeks = Array.from(panel.querySelectorAll("button")).map((b) => b.textContent.trim()).filter(Boolean);
    laporan.push({ tombol: tombolTeks });
    for (const t of ["Isi blangko dari SIPP", "Input ke ABT"]) {
      const b = Array.from(panel.querySelectorAll("button")).find((x) => x.textContent.trim() === t);
      if (b) { b.click(); await tunggu(400); }
    }
    if (process.env.DUMP) { const e = panel.querySelector(process.env.DUMP); console.log(e ? e.outerHTML.slice(0, 3000) : "tidak ada"); }
    await ukurSemua(browser, ambil(h, "aleta-panel-abt"), "aleta-panel-abt", "abt-kartu", laporan);
  } else if (mode === "widget") {
    for (const [nama, simp] of [["widget-terlipat", { ujiTampilan: "ui", ujiFitur: SEMUA_SIPP }], ["widget-terbuka", { ujiTampilan: "ui", ujiFitur: SEMUA_SIPP, posisiChecklistSipp: { kecil: false } }]]) {
      const h = await bukaGenerik(`${ASAL}/SIPP/detil_perkara_agama`, "<h3>x</h3>", { checklistMilestone: true, ...simp }, ["panel-alat.js", "checklist.js"], jawabPortal);
      await tunggu(1500);
      if (process.env.DEBUGW) { const a = h.d.querySelector("aleta-cm-widget"); console.log("akar?", !!a, a && a.shadowRoot && a.shadowRoot.innerHTML.length, h.d.documentElement.outerHTML.slice(0, 300)); }
      const akar = await sampai(() => { const a = h.d.querySelector("aleta-cm-widget"); return a && a.shadowRoot && a.shadowRoot.querySelector(".aleta-cm-wadah > *") ? a : null; }, "widget");
      await tunggu(500);
      const attrs = Array.from(h.d.documentElement.attributes).map((a) => `${a.name}="${a.value.replace(/"/g, "&quot;")}"`).join(" ");
      const rek = { attrs, dalam: akar.shadowRoot.innerHTML, hostAttrs: Array.from(akar.attributes).map((a) => [a.name, a.value]) };
      for (const l of LEBAR) {
        const { page, ctx } = await rakitWidget(browser, rek, l, TINGGI[l]);
        const r = await page.evaluate(() => {
          const a = document.getElementById("aleta-cm-akar");
          const k = a.shadowRoot.querySelector(".aleta-cm, .aleta-cm-pil, .aleta-cm-wadah > *");
          const b = (k || a).getBoundingClientRect();
          const simpan = document.getElementById("simpan-palsu").getBoundingClientRect();
          return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y), tutupSimpan: !(b.right <= simpan.left || b.left >= simpan.right || b.bottom <= simpan.top || b.top >= simpan.bottom), hostStyle: a.getAttribute("style") };
        });
        laporan.push({ nama, lebar: l, ...r });
        if (process.env.FOTO) await page.screenshot({ path: path.join(KELUAR, `${nama}-${l}.png`) });
        await ctx.close();
      }
    }
  } else if (mode === "portal") {
    const h = await bukaGenerik(`${ASAL}/aleta/aleta-ecourt`, `<main><table><tr><td>isi</td></tr></table></main>`, { ujiTampilan: "ui", ujiFitur: SEMUA_SIPP }, ["panel-alat.js", "aleta.js"], jawabPortal);
    const panel = await sampai(() => { const p = h.d.getElementById("aleta-panel-portal"); return p && p.getAttribute("data-t4") === "ui" ? p : null; }, "panel portal ui");
    await tunggu(1200);
    await ukurSemua(browser, ambil(h, "aleta-panel-portal"), "aleta-panel-portal", "portal", laporan);
  }
  await browser.close();
  writeFileSync(path.join(KELUAR, `laporan-${mode}.json`), JSON.stringify(laporan, null, 1));
  console.log("selesai", mode, laporan.length); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

