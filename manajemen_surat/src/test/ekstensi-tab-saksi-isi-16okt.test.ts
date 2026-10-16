// @vitest-environment node
/**
 * ============================================================================
 * F1.1 (16 Okt 2026) - TAB "SUSUN KETERANGAN SAKSI" DAN "ISI DARI SIPP" TIDAK SALING MEMATIKAN
 * ============================================================================
 *
 * Laporan pengguna: sesudah membuka "Susun keterangan saksi", "Isi dari SIPP &
 * input ke ABT" tidak merespons. Sebabnya: keduanya menggambar ke SATU wadah
 * (wadah usulan). Isi menolak menggambar bila penyunting saksi terbuka (hanya
 * menyisakan satu baris status), dan Susun menghapus kartu usulan Isi tanpa
 * bertanya. Kini penyunting saksi punya wadahnya sendiri (wadah.sdg).
 *
 * Perangkat uji disalin dari ekstensi-abt-2okt (berkas uji tidak saling
 * mengimpor): panel-alat.js dan abt.js dijalankan SUNGGUHAN di jsdom.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
// ALETA_UJI_ABT hanya dipakai skrip pembukti gigitan: cacat dipasang pada SALINAN.
const SUMBER_BASMASSAL = baca("basmassal.js");
const SUMBER_ABT = process.env.ALETA_UJI_ABT ? readFileSync(process.env.ALETA_UJI_ABT, "utf8").replace(/\r\n/g, "\n") : baca("abt.js");

const ASAL = "http://192.168.10.10";
const ASAL_ABT = `${ASAL}/aps_badilag/index.php/abt`;
const NOMOR = "544/Pdt.G/2026/PA.Dgl";
const CETAK = `${ASAL_ABT}/preview?c=10018&b=B&a=A`;
const RTF = "{\\rtf1\\ansi\\pard PUTUSAN\\par Nomor 544/Pdt.G/2026/PA.Dgl\\par MENGADILI\\par }";

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${keterangan}`);
    await tunggu(10);
  }
}

// ----------------------------------------------------------------------------
// Halaman blangko cerai - nama karangan
// ----------------------------------------------------------------------------
const ISI: Record<string, string> = {
  "0001": NOMOR,
  "0048": "Cerai Gugat",
  "0046": "Penggugat",
  "0047": "Tergugat",
  "5125": "Bahwa pada tanggal 14 Maret 2019 Penggugat dan Tergugat menikah;2. Bahwa sejak bulan November 2022 sering terjadi perselisihan;",
  "0033": "10 September 2026",
  "1197": "Rahman bin Ali",
  "1203": "Siti binti Umar",
  "2021": "Saksi kenal dengan kedua pihak.<br>Bahwa sudah cukup;",
  "2022": "Penggugat dan Tergugat menikah tahun 2018.",
  "0222": "DATA_TIDAK_ADA",
  "5227": "DATA_TIDAK_ADA",
  "0246": "DATA_TIDAK_ADA",
  "9944": "DATA_TIDAK_ADA",
  "7035": "DATA_TIDAK_ADA",
  "1268": "DATA_TIDAK_ADA",
  "8503": "F",
  "4020": "TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT",
  "8521": "TIDAK BENAR QUERY NYA",
};
/** Kerangka 4020 sudah lengkap - yang tersisa hanya bunyi error variabel turunan. */
const KERANGKA_LENGKAP: Record<string, string> = {
  "0222": "bulan November 2022",
  "5227": "Tergugat tidak memberi nafkah",
  "0246": "bulan April 2025",
  "9944": "1 tahun",
  "7035": "Tergugat",
  "1268": "pihak keluarga telah berusaha merukunkan",
};
const NAMA: Record<string, string> = {
  "0001": "No Perkara",
  "0048": "Jenis Perkara",
  "5125": "POSITA LENGKAP",
  "0222": "Awal Konflik",
  "5227": "Alasan-Alasan Cerai",
  "8503": "Huruf Alasan",
  "4020": "Kalimat Alasan (OTOMATIS)",
  "8521": "PERTIMBANGAN FAKTA HUKUM",
};

const USULAN_SIPP = { ok: true, jumlahKuasa: 0, prodeo: false, usulan: [] };
const USULAN_SAKSI = {
  butir: { saksi1: 2, saksi2: 2 },
  selisih: [],
  ciri: ["perselisihan terus-menerus"],
  ciriSepihak: [{ nama: "tidak memberi nafkah", saksi: 2 }],
  tandaSepihak: [{ ciri: "tidak memberi nafkah", saksi: 2, label: "hanya saksi 2", kalimat: "Tergugat tidak memberi nafkah sejak 2023" }],
  ciriDiluarGugatan: [],
  ciriBelumTerbukti: ["tidak memberi nafkah"],
  gugatanTerbaca: true,
  intiCiri: [
    {
      ciri: "perselisihan terus-menerus",
      saksi1: "Penggugat dan Tergugat sering bertengkar sejak November 2022",
      saksi2: "Saksi melihat sendiri keduanya bertengkar",
      posita: "Bahwa sejak bulan November 2022 sering terjadi perselisihan",
    },
  ],
  huruf: [
    { huruf: "F", pemicu: ["perselisihan terus-menerus"], syarat: "", dasar: [{ sumber: { nama: "Pasal 19 huruf f PP 9/1975" }, bunyi: "antara suami dan isteri terus-menerus terjadi perselisihan" }] },
    { huruf: "B", pemicu: ["tidak memberi nafkah"], syarat: "", dasar: [], centangOtomatis: false },
  ],
  hurufTidakDiusulkan: [],
  hurufBelumSiap: [],
  usulan: [{ kode: "0222", nama: "Awal Konflik", nilai: "November 2022", keyakinan: "pasti", sumber: [{ saksi: 1, kalimat: "sejak November 2022" }] }],
};
const SAKSI_SDG = {
  ok: true,
  alasan: ["perselisihan terus-menerus"],
  asalAlasan: "posita",
  saksi: [
    {
      ke: 1,
      pihak: "P",
      jawaban: [
        { no: "1", tanya: "Apakah saksi kenal?", jawab: "Kenal sebagai paman Penggugat" },
        { no: "2", tanya: "Sejak kapan tidak rukun?", jawab: "Sejak bulan November 2022 sering bertengkar", varian: { indeks: 0, n: 1, habis: true } },
      ],
    },
    {
      ke: 2,
      pihak: "P",
      jawaban: [
        { no: "1", tanya: "Apakah saksi kenal?", jawab: "Kenal sebagai tetangga Penggugat" },
        { no: "2", tanya: "Sejak kapan tidak rukun?", jawab: "Sejak bulan November 2022 sering bertengkar", varian: { indeks: 0, n: 1, habis: true } },
      ],
    },
  ],
};
/** Baris tanya-jawab ABT untuk 2021 (ada kalimat penutup) dan 2022. */
const TANYA_JAWAB: Record<string, unknown[]> = {
  "2021": [
    { urutan_pertanyaan: "1", pertanyaan: "Apakah saksi kenal?", jawaban: "Saksi kenal dengan kedua pihak." },
    { urutan_pertanyaan: "2", pertanyaan: "Ada lagi?", jawaban: "Bahwa sudah cukup;" },
  ],
  "2022": [{ urutan_pertanyaan: "1", pertanyaan: "Kapan menikah?", jawaban: "Penggugat dan Tergugat menikah tahun 2018." }],
};
const POSITA_RAPI = "1. Bahwa pada tanggal 14 Maret 2019 Penggugat dan Tergugat menikah;\n2. Bahwa sejak bulan November 2022 sering terjadi perselisihan;";

type Minta = { url: string; cara: string; badan: string; tubuh: unknown };
type Jawab = { status?: number; isi?: unknown; mentah?: string; jenis?: string };
type Pengganti = (url: string, cara: string, badan: string) => Jawab | undefined;

function jawabBaku(peran: string, nama: string, url: string, cara: string, badan: string): Jawab {
  if (url.includes("/aleta-bot/abt/usulan")) {
    const muatan = JSON.parse(badan || "{}");
    if (muatan.sumber === "siapa") return { isi: { data: { available: true, pengguna: { nama, peran }, kapabilitas: {} } } };
    if (muatan.sumber === "sipp") return { isi: { data: { available: true, sipp: USULAN_SIPP } } };
    if (muatan.sumber === "saksi") return { isi: { data: { available: true, saksi: USULAN_SAKSI } } };
    if (muatan.sumber === "saksi-sdg") return { isi: { data: { available: true, saksiSdg: SAKSI_SDG } } };
    return { isi: { data: { available: true } } };
  }
  if (url.includes("/aleta-bot/sipp/posita")) {
    const b = JSON.parse(badan || "{}");
    return { isi: { data: { available: true, berubah: true, sebelum: ISI["5125"], sesudah: POSITA_RAPI, disambung: 0, ragu: [], ujiKering: b.ujiKering } } };
  }
  if (url.includes("/aleta-ecourt/bas-komentar")) {
    return { isi: { ok: true, data: { komentar: [], saya: { id: "pp", nama: "Panitera Pengganti", bolehMenulis: false, bolehMenyelesaikanSemua: true } } } };
  }
  if (url.includes("/aleta-ecourt/abt-wajib")) return { isi: { ok: true, data: { jenis: "Cerai Gugat", variabel: [], catatan: "" } } };
  if (url.includes("/aleta-ecourt/abt-riwayat")) return { isi: { ok: true, data: { daftar: [] } } };
  if (url.includes("/aleta-ecourt/templat-hukum")) {
    return { isi: { ok: true, data: { butir: [{ jenis: "pasal", kunci: "F", judul: "Huruf f", isi: "Pasal 19 huruf f ...", disahkan: true }], bolehMenyunting: false } } };
  }
  if (url.includes("/edit_data?")) {
    if (cara === "POST") return { mentah: "<b>DATA DISIMPAN</b>", jenis: "text/html" };
    return { mentah: '<input type="hidden" name="var_type" value="data_teks">', jenis: "text/html" };
  }
  if (url.includes("/tanyajawab_perkara_edit?")) {
    const q = new URLSearchParams(url.split("?")[1]);
    if (cara === "POST" && q.get("aksi") === "simpan") return { mentah: "<b>Tanya Jawab Disimpan</b>", jenis: "text/html" };
    if (badan.includes("load_template")) {
      const t = { "0": { urutan_pertanyaan: "1", pertanyaan: "Apakah saksi kenal?", jawaban: "Ya kenal;" } };
      return { mentah: `<script>\n var ajax_data = ${JSON.stringify(t)} \n</script>`, jenis: "text/html" };
    }
    const baris = TANYA_JAWAB[q.get("no_var") || ""] || [];
    return {
      mentah: `<select><option value=''>--> Load Template <--</option><option value='04'>(04) Pertanyaan Saksi CG</option></select><script>\n var ajax_data = ${JSON.stringify(baris)} \n</script>`,
      jenis: "text/html",
    };
  }
  if (url.includes("/tanyajawab_template_edit?")) return { mentah: "<script>\n var ajax_data = [] \n</script>", jenis: "text/html" };
  if (url.includes("/abt/preview?") || url.includes("/preview?")) return { mentah: RTF, jenis: "application/rtf" };
  if (url.includes("/main/anonim")) return { mentah: RTF, jenis: "application/rtf" };
  if (url.includes("/putusan/unggah-naskah")) return { isi: { ok: true, data: { ok: true, versi: 2 } } };
  if (url.includes("/putusan/unggah-sipp")) return { isi: { ok: true, data: { ok: true } } };
  if (url.includes("/aps_badilag/") && cara === "GET") return { mentah: "<html><body></body></html>", jenis: "text/html" };
  return { status: 404, isi: { ok: false, error: { message: "tidak ada" } } };
}

function tanggapan(j: Jawab) {
  const status = j.status ?? 200;
  if (j.mentah !== undefined) return new Response(Buffer.from(j.mentah, "latin1"), { status, headers: { "content-type": j.jenis || "text/plain" } });
  return new Response(JSON.stringify(j.isi ?? {}), { status, headers: { "content-type": "application/json" } });
}

type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; konfirmasi: string[]; navigasi: string[] };

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  basmassal?: boolean;
  simpanan?: Record<string, unknown>;
  peran?: string;
  nama?: string;
  ganti?: Pengganti;
  isi?: Record<string, string>;
  beranda?: boolean;
  tanpaJudul?: boolean;
  konfirmasi?: boolean;
};

function buka(p: Opsi = {}): Halaman {
  const isiHalaman: Record<string, string> = { ...ISI, ...(p.isi || {}) };
  const baris = Object.keys(isiHalaman)
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>${NAMA[k] || `Variabel ${k}`}</td>` +
        `<td>${isiHalaman[k]}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`
    )
    .join("");
  const badan = p.beranda
    ? `<div id="wrapper"><div id="cssmenu"></div><div id="navbar"><button class="accordion">Putusan &amp; Penetapan</button></div>` +
      `<div id="content"><div class="pricing_inner_w3ls"><div class="pricing-top"><h3>Putusan</h3></div><div class="pricing-bottom-bottom"></div></div></div></div>`
    : `<div id="wrapper"><div id="cssmenu"></div><div id="content"><h3 class="w3l_header"><span>${p.tanpaJudul ? "Blangko Kabul Verstek" : NOMOR}</span></h3>` +
      `<p class="cetak"><a id="cetak" href="${CETAK}">CETAK</a></p><table>${baris}</table></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, {
    url: p.beranda ? `${ASAL_ABT}/` : `${ASAL_ABT}/main/view?a=A&b=B&c=10018&d=3`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      const ubah: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(isi)) {
        ubah[k] = { oldValue: polos(simpanan[k]), newValue: polos(v) };
        simpanan[k] = polos(v);
      }
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async () => undefined,
  };
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.177.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }),
      lastError: undefined,
    },
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Minta[] = [];
  const peran = p.peran ?? "Super Admin";
  const nama = p.nama ?? "Uji Peran";
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const b = typeof opsi?.body === "string" ? opsi.body : opsi?.body ? String(opsi.body) : "";
    minta.push({ url, cara, badan: b, tubuh: opsi?.body });
    const j = (p.ganti && p.ganti(url, cara, b)) || jawabBaku(peran, nama, url, cara, b);
    return tanggapan(j);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  const konfirmasi: string[] = [];
  w.confirm = (pesan: string) => {
    konfirmasi.push(pesan);
    return p.konfirmasi === true;
  };
  const navigasi: string[] = [];
  w.document.addEventListener("click", (e: any) => {
    const a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    if (!e.defaultPrevented && !String(a.getAttribute("href")).startsWith("#")) navigasi.push(a.href);
    e.preventDefault();
  });
  // Disesuaikan 2 Okt (agen A, butir 14): tulisan ke ABT kini didahului
  // alatJedaManusia (0,9-3,5 detik). Uji ini memeriksa ISI tulisan, bukan
  // jedanya (jeda diuji di ekstensi-abt-2okt) - jeda dinolkan DI DALAM skrip
  // yang sama (panel-alat.js "use strict": fungsinya tidak menjadi milik window).
  w.eval(
    `${SUMBER_ALAT}\n;\n${p.basmassal ? SUMBER_BASMASSAL : ""}\n;\n${SUMBER_ABT}\n;\nwindow.__a1 = typeof t6VarianKalimat === "function" ? { t6VarianKalimat, ` +
      `a1KetuaMajelis: typeof a1KetuaMajelis === "function" ? a1KetuaMajelis : null, a1PutusanLayak: typeof a1PutusanLayak === "function" ? a1PutusanLayak : null } : null;` +
      `\n;\n/* 2 Okt (agen A, butir 14): jeda manusia dinolkan - lihat catatan di buka() */ if (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0); window.__a2 = (() => { const asli = alatJedaManusia; return { setelJeda: (n) => alatSetelJedaSkala(n), jedaAsli: asli, gantiJeda: (f) => { alatJedaManusia = f; } }; })();`
  );
  return { dom, w, simpanan, minta, konfirmasi, navigasi };
}

const panelDari = (h: Halaman) => h.w.document.getElementById("aleta-panel-abt") as any;
const massalDari = (h: Halaman) => h.w.document.getElementById("aleta-panel-abt-massal") as any;
const q = (h: Halaman, pemilih: string) => panelDari(h)?.querySelector(pemilih) as any;
const qs = (h: Halaman, pemilih: string) => Array.from(panelDari(h)?.querySelectorAll(pemilih) || []) as any[];
const tombol = (h: Halaman, teks: string | RegExp) => qs(h, "button").find((b) => (typeof teks === "string" ? b.textContent === teks : teks.test(b.textContent)));
const fitur = (kode: string[]) => Object.fromEntries(kode.map((k) => [k, true]));
const ui = (kode: string[], lain: Record<string, unknown> = {}) => ({ ujiTampilan: "ui", ujiFitur: fitur(kode), ...lain });
const baru = (kode: string[], lain: Record<string, unknown> = {}) => ({ ujiTampilan: "baru", ujiFitur: fitur(kode), ...lain });
const nyata = { ujiIzinkanNyata: true };

/** Tampak menurut CSS: data-sore-tampak="tidak" atau hidden pada unsur/leluhurnya di dalam panel. */
function tampak(el: any): boolean {
  for (let x = el; x && x.nodeType === 1; x = x.parentElement) {
    if (x.getAttribute("data-sore-tampak") === "tidak" || x.hidden) return false;
    if (x.id === "aleta-panel-abt" || x.id === "aleta-panel-abt-massal") return true;
  }
  return true;
}
const siapPeran = (h: Halaman) => sampai(() => panelDari(h)?.getAttribute("data-sore-golongan"), "peran lapisan sore");
const selesaiIsi = (h: Halaman) => sampai(() => (q(h, ".aleta-sore-input") ? q(h, ".aleta-sore-input") : null), "Input ke ABT tergambar");
const nonGetAbt = (h: Halaman) => h.minta.filter((m) => m.cara !== "GET" && m.url.includes("/aps_badilag/"));
const positaPost = (h: Halaman) => h.minta.filter((m) => m.cara === "POST" && m.url.includes("/sipp/posita")).map((m) => JSON.parse(m.badan));
const kabarInput = (h: Halaman) => q(h, ".aleta-sore-tindakan + .aleta-abt-kabar");

// ============================================================================
// Alat uji 2 Okt
// ============================================================================
/**
 * Terlihat menurut aturan panel: data-sore-tampak, hidden, data-a2-terlipat
 * (butir 5), anak lipatan kartu yang tertutup, isi alatLipat yang hidden,
 * dan isi <details> yang tertutup.
 */
function terlihat(el: any): boolean {
  for (let x = el; x && x.nodeType === 1; x = x.parentElement) {
    if (x.getAttribute("data-sore-tampak") === "tidak" || x.hidden || x.getAttribute("data-a2-terlipat") === "ya") return false;
    const induk = x.parentElement;
    if (induk && induk.classList.contains("aleta-lipatan") && induk.getAttribute("data-lipat-asal") === "kartu" && induk.getAttribute("data-terbuka") === "tidak" && !x.classList.contains("aleta-lipat-kepala")) return false;
    if (induk && induk.tagName === "DETAILS" && !induk.open && x.tagName !== "SUMMARY") return false;
    if (x.id === "aleta-panel-abt" || x.id === "aleta-panel-abt-massal") return true;
  }
  return true;
}
/** Tersembunyi oleh CSS SUNGGUHAN (panel.css dimuat ke dokumen): unsur atau leluhurnya display:none. */
function tersembunyiCss(h: Halaman, el: any): boolean {
  for (let x = el; x && x.nodeType === 1; x = x.parentElement) {
    if (h.w.getComputedStyle(x).display === "none") return true;
    if (x.id === "aleta-panel-abt") return false;
  }
  return false;
}
/** Untuk pesan uji: leluhur pertama yang display:none (kelas + atributnya). */
function sebabTersembunyi(h: Halaman, el: any): string {
  for (let x = el; x && x.nodeType === 1; x = x.parentElement) {
    if (h.w.getComputedStyle(x).display === "none") return `${x.tagName}.${x.className} ${Array.from(x.attributes).map((a: any) => `${a.name}=${a.value}`).join(" ")}`.slice(0, 300);
    if (x.id === "aleta-panel-abt") return "";
  }
  return "";
}
function muatCss(h: Halaman) {
  const gaya = h.w.document.createElement("style");
  gaya.textContent = baca("panel.css");
  h.w.document.head.appendChild(gaya);
  h.w.document.documentElement.setAttribute("data-aleta-kulit", "modern");
}
const kerja = (h: Halaman, jenis: "isi" | "susun") => q(h, `[data-sore-kerja="${jenis}"]`);
const kepalaKerja = (h: Halaman, jenis: "isi" | "susun") => kerja(h, jenis).querySelector(":scope > .aleta-lipat-kepala");
const siapLipat = (h: Halaman) => sampai(() => kerja(h, "isi")?.classList.contains("aleta-lipatan") && kerja(h, "susun")?.classList.contains("aleta-lipatan"), "bagian kerja dilipat");
const kosongSaksi = { "2021": "DATA_TIDAK_ADA", "2022": "DATA_TIDAK_ADA" };

/** Susunan saksi dengan dua jawaban yang BELUM terdeteksi ("..." dan "_"). */
const SDG_BELUM = {
  ok: true,
  alasan: ["perselisihan terus-menerus"],
  asalAlasan: "posita",
  saksi: [
    {
      ke: 1,
      pihak: "P",
      jawaban: [
        { no: "1", tanya: "Apakah saksi kenal?", jawab: "Kenal sebagai paman Penggugat" },
        { no: "2", tanya: "Sejak kapan tidak rukun?", jawab: "Sejak bulan ... sering bertengkar;" },
      ],
    },
    {
      ke: 2,
      pihak: "P",
      jawaban: [
        { no: "1", tanya: "Apakah saksi kenal?", jawab: "_" },
        { no: "2", tanya: "Sejak kapan tidak rukun?", jawab: "Sejak bulan November 2022 sering bertengkar;" },
      ],
    },
  ],
};
const sdgBelum: Pengganti = (url, _c, badan) =>
  url.includes("/abt/usulan") && JSON.parse(badan || "{}").sumber === "saksi-sdg" ? { isi: { data: { available: true, saksiSdg: SDG_BELUM } } } : undefined;
const hasilSdg = (h: Halaman) => q(h, ".aleta-sdg-hasil");
const barisSdg = (h: Halaman, kolom: number, i: number) => hasilSdg(h).querySelectorAll(".aleta-sdg-dua > .aleta-sdg-kolom")[kolom].querySelectorAll(".aleta-sdg-baris")[i];


const tombolKepala = (h: Halaman, jenis: "isi" | "susun") => kerja(h, jenis).querySelector(".aleta-sore-jalankan") as any;
const kartuUsulan = (h: Halaman) => qs(h, ".aleta-abt-kartu");

// ============================================================================
describe("F1.1: Susun keterangan saksi dibuka, lalu Isi dari SIPP - keduanya tetap hidup", () => {
  it("Super Admin: penyunting saksi terbuka, 'Baca ulang' (Isi) menggambar usulannya TANPA menutup penyunting", async () => {
    const h = buka({ simpanan: ui([]), isi: kosongSaksi });
    await selesaiIsi(h);
    await siapLipat(h);
    // 1. buka Susun
    tombolKepala(h, "susun").click();
    const baris = await sampai(() => q(h, ".aleta-sdg-hasil .aleta-sdg-baris"), "penyunting saksi tersusun");
    expect(baris).toBeTruthy();
    // 2. Isi dari SIPP - Baca ulang
    const sebelum = h.minta.filter((m) => m.url.includes("/abt/usulan")).length;
    tombolKepala(h, "isi").click();
    await sampai(() => h.minta.filter((m) => m.url.includes("/abt/usulan")).length > sebelum, "Isi membaca ulang");
    await sampai(() => !/Membaca SIPP/.test(kerja(h, "isi").querySelector(".aleta-sore-status")?.textContent || "Membaca SIPP"), "Isi selesai membaca");
    // Penyunting masih ada dan tidak digantikan.
    expect(q(h, ".aleta-sdg-hasil .aleta-sdg-baris")).toBe(baris);
    // Isi tidak lagi berhenti dengan "penyunting sedang terbuka".
    expect(kerja(h, "isi").textContent).not.toMatch(/sedang terbuka/);
    // Hasil Isi tergambar: tombol Input ke ABT dan kartu usulan ada, dan di luar penyunting.
    expect(q(h, ".aleta-sore-input")).toBeTruthy();
    expect(kartuUsulan(h).length).toBeGreaterThan(0);
    expect(kartuUsulan(h).every((k) => !k.closest(".aleta-sdg-hasil"))).toBe(true);
    // Kedua bagian terlihat bersama (tidak saling menutup).
    expect(terlihat(baris)).toBe(true);
    expect(terlihat(q(h, ".aleta-sore-input"))).toBe(true);
  });

  it("urutan terbalik: usulan Isi sudah tergambar, lalu Susun - kartu Isi TIDAK terhapus", async () => {
    const h = buka({ simpanan: ui([]), isi: kosongSaksi });
    await selesaiIsi(h);
    await siapLipat(h);
    const kartuAwal = kartuUsulan(h).length;
    const namaAwal = kartuUsulan(h).map((k) => (k.querySelector(".aleta-abt-nama") || k).textContent.trim().slice(0, 30));
    expect(kartuAwal).toBeGreaterThan(0);
    tombolKepala(h, "susun").click();
    await sampai(() => q(h, ".aleta-sdg-hasil .aleta-sdg-baris"), "penyunting saksi tersusun");
    const namaAkhir = kartuUsulan(h).map((k) => (k.querySelector(".aleta-abt-nama") || k).textContent.trim().slice(0, 30));
    expect(namaAkhir).toEqual(namaAwal);
    expect(q(h, ".aleta-sore-input")).toBeTruthy();
  });

  it("menutup Susun menyembunyikan penyuntingnya saja; menutup Isi menyembunyikan usulannya saja (CSS sungguhan)", async () => {
    const h = buka({ simpanan: ui([]), isi: kosongSaksi });
    muatCss(h);
    await selesaiIsi(h);
    await siapLipat(h);
    tombolKepala(h, "susun").click();
    const baris = await sampai(() => q(h, ".aleta-sdg-hasil .aleta-sdg-baris"), "penyunting saksi tersusun");
    const input = q(h, ".aleta-sore-input");
    kepalaKerja(h, "susun").click();
    await tunggu(30);
    expect(tersembunyiCss(h, baris)).toBe(true);
    expect(tersembunyiCss(h, input), sebabTersembunyi(h, input)).toBe(false);
    kepalaKerja(h, "susun").click();
    kepalaKerja(h, "isi").click();
    await tunggu(30);
    expect(tersembunyiCss(h, baris), sebabTersembunyi(h, baris)).toBe(false);
    expect(tersembunyiCss(h, input)).toBe(true);
  });

  it("Susun dua kali: penyunting yang sudah terbuka tidak digambar ulang (kata-kata pesan tetap)", async () => {
    const h = buka({ simpanan: ui([]), isi: kosongSaksi });
    await selesaiIsi(h);
    await siapLipat(h);
    tombolKepala(h, "susun").click();
    const baris = await sampai(() => q(h, ".aleta-sdg-hasil .aleta-sdg-baris"), "penyunting saksi tersusun");
    await sampai(() => /Pratinjau keterangan saksi siap/.test(kerja(h, "susun").querySelector(".aleta-sore-status")?.textContent || ""), "Susun selesai");
    tombolKepala(h, "susun").click();
    await sampai(() => /sudah terbuka/.test(kerja(h, "susun").querySelector(".aleta-sore-status")?.textContent || ""), "pesan sudah terbuka");
    expect(q(h, ".aleta-sdg-hasil .aleta-sdg-baris")).toBe(baris);
  });
});
