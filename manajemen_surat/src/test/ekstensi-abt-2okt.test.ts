// @vitest-environment node
/**
 * ============================================================================
 * PERBAIKAN 2 OKT 2026 - PANEL ABT (AGEN A)
 * ============================================================================
 *
 * panel-alat.js dan abt.js dijalankan SUNGGUHAN di jsdom beralamat halaman
 * blangko ABT (dan beranda ABT) - perangkat uji yang SAMA dengan
 * ekstensi-abt-1okt (disalin, bukan diimpor: berkas uji tidak saling
 * mengimpor). Beberapa uji memuat panel.css ke dokumen supaya "tersembunyi"
 * diukur dengan CSS sungguhan (getComputedStyle), bukan dengan atribut saja.
 *
 * Yang dijaga - tampilan HANYA di UI Baru, Baru dibandingkan tiap kelompok:
 *   butir 5   menutup bagian kerja benar-benar menyembunyikan isinya
 *   butir 6   Susun keterangan saksi hanya panitera / PP (+ Admin)
 *   butir 7   tag peran di kepala lipatan
 *   butir 8   jawaban saksi belum terdeteksi: tanda, jumlah, jalan mengisi
 *   butir 9   kartu "Dirapikan otomatis" tidak tampil, tetap ditulis saat Input
 *   butir 3   putusan massal: blangko utama + "Blangko berbeda…"
 *   butir 14  tulisan ABT/posita berjeda (GLOBAL), tanpa kata ALETA di isian
 *   butir 19  bawaan buka/tutup per peran
 *
 * ALETA_UJI_ABT (salinan abt.js bercacat) dipakai skrip pembukti gigitan.
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

// ============================================================================
describe("butir 5: accordion panel ABT benar-benar menyembunyikan isinya", () => {
  it("UI Baru (Super Admin): menutup 'Isi dari SIPP & input ke ABT' menyembunyikan Input ke ABT, usulan, dan alasan - CSS sungguhan; membuka mengembalikannya", async () => {
    const h = buka({ simpanan: ui([]) });
    muatCss(h);
    const input = await selesaiIsi(h);
    await siapLipat(h);
    const alasan = q(h, ".aleta-sore-alasan");
    expect(kerja(h, "isi").getAttribute("data-terbuka")).toBe("ya");
    expect(terlihat(input)).toBe(true);
    expect(tersembunyiCss(h, input)).toBe(false);
    kepalaKerja(h, "isi").click();
    expect(kerja(h, "isi").getAttribute("data-terbuka")).toBe("tidak");
    // Seketika (peristiwa aleta-lipat-berubah), bukan menunggu penataan berikutnya.
    for (const el of [input, alasan]) {
      expect(terlihat(el)).toBe(false);
      expect(tersembunyiCss(h, el)).toBe(true);
    }
    // Kepala tetap tampak - dapat dibuka lagi.
    expect(tersembunyiCss(h, kepalaKerja(h, "isi"))).toBe(false);
    kepalaKerja(h, "isi").click();
    expect(terlihat(input)).toBe(true);
    expect(tersembunyiCss(h, input)).toBe(false);
    expect(tersembunyiCss(h, alasan)).toBe(false);
  });

  it("UI Baru (Panitera Pengganti): menutup 'Susun keterangan saksi' menyembunyikan penyunting saksi (wadah usulan sesaudara)", async () => {
    const h = buka({ simpanan: ui([]), peran: "Panitera Pengganti", isi: kosongSaksi });
    muatCss(h);
    const baris = await sampai(() => q(h, ".aleta-sdg-hasil .aleta-sdg-baris"), "penyunting saksi tersusun");
    await siapLipat(h);
    expect(kerja(h, "susun").getAttribute("data-terbuka")).toBe("ya");
    expect(tersembunyiCss(h, baris), sebabTersembunyi(h, baris)).toBe(false);
    kepalaKerja(h, "susun").click();
    expect(terlihat(baris)).toBe(false);
    expect(tersembunyiCss(h, baris)).toBe(true);
    expect(tersembunyiCss(h, q(h, ".aleta-sdg-form"))).toBe(true);
    kepalaKerja(h, "susun").click();
    expect(terlihat(baris)).toBe(true);
    expect(tersembunyiCss(h, baris), sebabTersembunyi(h, baris)).toBe(false);
  });

  it("wadah usulan berganti pemilik: penyunting saksi milik Susun, bukan Isi - menutup Isi tidak menyembunyikannya (Super Admin)", async () => {
    const h = buka({ simpanan: ui([]), isi: kosongSaksi });
    await selesaiIsi(h);
    await siapLipat(h);
    // Susun dibuka lewat tombolnya di kepala - bagiannya ikut terbuka.
    expect(kerja(h, "susun").getAttribute("data-terbuka")).toBe("tidak");
    kerja(h, "susun").querySelector(".aleta-sore-jalankan").click();
    expect(kerja(h, "susun").getAttribute("data-terbuka")).toBe("ya");
    const baris = await sampai(() => q(h, ".aleta-sdg-hasil .aleta-sdg-baris"), "penyunting saksi");
    kepalaKerja(h, "isi").click();
    await sampai(() => kerja(h, "isi").getAttribute("data-terbuka") === "tidak", "isi tertutup");
    await tunggu(100);
    expect(terlihat(baris)).toBe(true);
    kepalaKerja(h, "susun").click();
    expect(terlihat(baris)).toBe(false);
  });

  it("ingatan buka/tutup (lipatTerbuka) dipulihkan sesudah panel lahir: isinya ikut tersembunyi", async () => {
    const h = buka({ simpanan: ui([], { lipatTerbuka: { "abt:isi-input": false } }), peran: "Hakim" });
    const input = await selesaiIsi(h);
    await sampai(() => kerja(h, "isi")?.getAttribute("data-terbuka") === "tidak", "isi tertutup dari ingatan");
    await sampai(() => !terlihat(input), "Input ke ABT tersembunyi");
  });

  it("Baru: tidak ada lipatan dan tidak ada data-a2-terlipat (perilaku 1.177.0)", async () => {
    const h = buka({ simpanan: baru([]) });
    await selesaiIsi(h);
    await tunggu(150);
    expect(q(h, ".aleta-lipatan")).toBeNull();
    expect(q(h, "[data-a2-terlipat]")).toBeNull();
  });
});

// ============================================================================
describe("butir 6: Susun keterangan saksi hanya untuk panitera / PP (Admin tetap boleh)", () => {
  it("UI Baru: tampak bagi Panitera Pengganti, Panitera, Panitera Sidang, Admin, Super Admin; tidak bagi Hakim, Ketua, Jurusita, operator", async () => {
    const boleh = ["Panitera Pengganti", "Panitera", "Panitera Sidang", "Admin", "Super Admin"];
    const tidak = ["Hakim", "Wakil Ketua", "Jurusita", "Operator"];
    for (const peran of [...boleh, ...tidak]) {
      const h = buka({ simpanan: ui([]), peran });
      await siapPeran(h);
      await sampai(() => kerja(h, "susun")?.hasAttribute("data-sore-tampak") === !boleh.includes(peran), `${peran}: susun ${boleh.includes(peran) ? "tampak" : "tersembunyi"}`);
      await tunggu(30);
      expect(tampak(kerja(h, "susun")), peran).toBe(boleh.includes(peran));
    }
  });

  it("UI Baru (Hakim) lewat ⋯ → Bagian peran lain: menekan Susun menyebut sebabnya, tidak membuka blangko susun", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim" });
    await selesaiIsi(h);
    q(h, ".aleta-sore-menu-tombol").click();
    const peranLain = await sampai(() => q(h, '[data-sore-butir="peran"]'), "butir Bagian peran lain");
    peranLain.click();
    await sampai(() => tampak(kerja(h, "susun")), "susun tampak lewat ⋯");
    kerja(h, "susun").querySelector(".aleta-sore-jalankan").click();
    await sampai(() => /hanya untuk panitera, panitera pengganti, dan Admin/.test(kerja(h, "susun").querySelector(".aleta-sore-status").textContent), "kalimat peran");
    expect(q(h, ".aleta-sdg-form")).toBeNull();
  });
});

// ============================================================================
describe("butir 7 dan 19: tag peran di kepala; bawaan buka/tutup menurut peran", () => {
  const peranTag = (el: any) => el.querySelector(":scope > .aleta-lipat-kepala > .aleta-lipat-peran")?.textContent || "";

  it("UI Baru (Super Admin): tag Hakim / Panitera / Hakim di KIRI judul; Isi terbuka, Susun dan Unggah tertutup", async () => {
    const h = buka({ simpanan: ui([]) });
    await selesaiIsi(h);
    await siapLipat(h);
    const unggah = await sampai(() => (q(h, ".aleta-abt-bagian.aleta-lipatan") ? q(h, ".aleta-abt-bagian") : null), "unggah dilipat");
    expect(peranTag(kerja(h, "isi"))).toBe("Hakim");
    expect(peranTag(kerja(h, "susun"))).toBe("Panitera");
    expect(peranTag(unggah)).toBe("Hakim");
    const judul = kerja(h, "susun").querySelector(".aleta-sore-kerja-judul");
    // Butir 5 (2 Okt sore, permintaan pengguna): label peran SELALU di kiri judul, sama dengan
    // panel-alat.js dan konten.js - dulu tepat SESUDAH judul.
    expect(judul.previousElementSibling.classList.contains("aleta-lipat-peran")).toBe(true);
    expect(kerja(h, "isi").getAttribute("data-terbuka")).toBe("ya");
    expect(kerja(h, "susun").getAttribute("data-terbuka")).toBe("tidak");
    expect(unggah.getAttribute("data-terbuka")).toBe("tidak");
  });

  it("UI Baru (Panitera Pengganti): Susun terbuka; (Hakim): Isi terbuka, Unggah tertutup", async () => {
    const pp = buka({ simpanan: ui([]), peran: "Panitera Pengganti" });
    await siapPeran(pp);
    await sampai(() => kerja(pp, "susun")?.getAttribute("data-terbuka") === "ya", "susun terbuka bagi PP");
    const hakim = buka({ simpanan: ui([]), peran: "Hakim" });
    await selesaiIsi(hakim);
    await siapLipat(hakim);
    const unggah = await sampai(() => (q(hakim, ".aleta-abt-bagian.aleta-lipatan") ? q(hakim, ".aleta-abt-bagian") : null), "unggah dilipat");
    expect(kerja(hakim, "isi").getAttribute("data-terbuka")).toBe("ya");
    expect(unggah.getAttribute("data-terbuka")).toBe("tidak");
  });

  it("ingatan orang menang atas bawaan peran", async () => {
    const h = buka({ simpanan: ui([], { lipatTerbuka: { "abt:susun-saksi": true, "abt:isi-input": false } }) });
    await siapPeran(h);
    await sampai(() => kerja(h, "susun")?.getAttribute("data-terbuka") === "ya" && kerja(h, "isi")?.getAttribute("data-terbuka") === "tidak", "ingatan dipakai");
  });

  it("beranda ABT (UI Baru): Putusan massal terbuka, Pemetaan blangko tertutup", async () => {
    const h = buka({ beranda: true, simpanan: ui([]) });
    await sampai(() => massalDari(h)?.querySelectorAll(".aleta-isi > .aleta-bagian.aleta-lipatan").length === 2, "dua bagian beranda dilipat");
    const [pemetaan, putusan] = Array.from(massalDari(h).querySelectorAll(".aleta-isi > .aleta-bagian")) as any[];
    expect(pemetaan.getAttribute("data-terbuka")).toBe("tidak");
    expect(putusan.getAttribute("data-terbuka")).toBe("ya");
  });

  it("Baru: tanpa tag peran dan tanpa lipatan", async () => {
    const h = buka({ simpanan: baru([]) });
    await selesaiIsi(h);
    await tunggu(100);
    expect(q(h, ".aleta-lipat-peran")).toBeNull();
  });
});

// ============================================================================
describe("butir 8: jawaban saksi yang belum terdeteksi - ditandai, dijumlah, ada jalan mengisinya", () => {
  it("UI Baru: ringkasan di atas penyunting, ✎ Sunting, isian dari usulan Isi dari SIPP dan saksi lain, tanda 'diisi di sidang', saring - tanpa satu tulisan pun", async () => {
    const h = buka({ simpanan: ui([], nyata), isi: kosongSaksi, ganti: sdgBelum });
    await selesaiIsi(h);
    await siapLipat(h);
    h.minta.length = 0;
    kerja(h, "susun").querySelector(".aleta-sore-jalankan").click();
    const ringkas = await sampai(() => q(h, ".aleta-sdg-hasil .aleta-a2-belum-ringkas"), "ringkasan belum terdeteksi");
    await sampai(() => ringkas.getAttribute("data-a2-belum") === "2", "dua belum");
    expect(ringkas.querySelector(".aleta-a2-belum-teks").textContent).toBe("2 dari 4 jawaban belum terdeteksi");
    // Di atas kolom saksi, bukan di bawah.
    const urutan = Array.from(hasilSdg(h).children) as any[];
    expect(urutan.indexOf(ringkas)).toBeLessThan(urutan.indexOf(hasilSdg(h).querySelector(":scope > .aleta-sdg-dua")));

    const b = barisSdg(h, 0, 1);
    expect(b.getAttribute("data-t6-belum")).toBe("ya");
    const jawab = b.querySelector("textarea.aleta-sdg-jawab");
    // ✎ Sunting: titik-titiknya terpilih.
    b.querySelector(".aleta-a2-sunting").click();
    expect(h.w.document.activeElement).toBe(jawab);
    expect(jawab.value.slice(jawab.selectionStart, jawab.selectionEnd)).toBe("...");
    // Sumber yang ada: usulan 0222 hasil bacaan Isi dari SIPP + jawaban saksi lain.
    const tawaran = Array.from(b.querySelectorAll(".aleta-t6-tawaran")).map((x: any) => x.textContent);
    expect(tawaran).toContain("0222 Awal Konflik (usulan)");
    expect(tawaran).toContain("Saksi 2 P no. 2");
    (Array.from(b.querySelectorAll(".aleta-t6-tawaran")) as any[]).find((x) => x.textContent === "0222 Awal Konflik (usulan)").click();
    expect(jawab.value).toBe("Sejak bulan November 2022 sering bertengkar;");
    await sampai(() => ringkas.getAttribute("data-a2-belum") === "1", "tinggal satu");

    // Tanda "diisi di sidang": pratinjau, dihitung terpisah.
    const b2 = barisSdg(h, 1, 0);
    b2.querySelector(".aleta-a2-sidang").click();
    expect(b2.getAttribute("data-a2-sidang")).toBe("ya");
    expect(b2.querySelector(".aleta-t6-lencana-belum").textContent).toBe("diisi di sidang");
    expect(ringkas.querySelector(".aleta-a2-belum-teks").textContent).toBe("3 dari 4 jawaban terisi · 1 ditandai diisi di sidang");
    b2.querySelector(".aleta-a2-sidang").click();
    expect(ringkas.querySelector(".aleta-a2-belum-teks").textContent).toBe("1 dari 4 jawaban belum terdeteksi");

    // Ke berikutnya + Hanya yang belum.
    ringkas.querySelector(".aleta-a2-ke-belum").click();
    expect(h.w.document.activeElement).toBe(b2.querySelector("textarea.aleta-sdg-jawab"));
    ringkas.querySelector(".aleta-a2-saring-belum").click();
    expect(hasilSdg(h).getAttribute("data-a2-saring")).toBe("belum");
    // Semua masih pratinjau: tidak ada tulisan ke ABT (POST load_template hanya membaca templat).
    await tunggu(50);
    expect(nonGetAbt(h).filter((m) => /aksi=simpan|edit_data/.test(m.url))).toEqual([]);
  });

  it("CSS: 'Hanya yang belum' menyembunyikan baris yang sudah terisi (CSS sungguhan)", async () => {
    const h = buka({ simpanan: ui([]), peran: "Panitera Pengganti", isi: kosongSaksi, ganti: sdgBelum });
    muatCss(h);
    const ringkas = await sampai(() => q(h, ".aleta-sdg-hasil .aleta-a2-belum-ringkas"), "ringkasan");
    ringkas.querySelector(".aleta-a2-saring-belum").click();
    expect(tersembunyiCss(h, barisSdg(h, 0, 0))).toBe(true);
    expect(tersembunyiCss(h, barisSdg(h, 0, 1)), sebabTersembunyi(h, barisSdg(h, 0, 1))).toBe(false);
  });

  it("Baru: tidak ada ringkasan, ✎ Sunting, maupun tanda sidang 2 Okt", async () => {
    const h = buka({ simpanan: baru(["abt-7"]), peran: "Panitera Pengganti", isi: kosongSaksi, ganti: sdgBelum });
    await sampai(() => q(h, ".aleta-sdg-hasil .aleta-sdg-baris"), "penyunting");
    await tunggu(150);
    expect(q(h, ".aleta-a2-belum-ringkas, .aleta-a2-sunting, .aleta-a2-sidang")).toBeNull();
  });
});

// ============================================================================
describe("butir 9: kartu 'Dirapikan otomatis' tidak tampil, perapian tetap tersimpan saat Input", () => {
  it("UI Baru (hakim): kartu tersembunyi tetapi tercentang; status tidak menyebutnya; Input menulis posita dan keterangan saksi rapi", async () => {
    const h = buka({ simpanan: ui([], nyata), peran: "Hakim" });
    const input = await selesaiIsi(h);
    const rapi = await sampai(() => (qs(h, ".aleta-a1-rapi").length === 2 ? qs(h, ".aleta-a1-rapi") : null), "dua kartu rapi");
    for (const k of rapi) {
      expect(terlihat(k)).toBe(false);
      expect(k.querySelector("input").checked).toBe(true);
    }
    expect(terlihat(q(h, ".aleta-a1-rapi-judul"))).toBe(false);
    expect(kerja(h, "isi").querySelector(".aleta-sore-status").textContent).not.toMatch(/dirapikan/);
    expect(input.textContent).toBe("Input ke ABT (2)");
    expect(input.title).toContain("dirapikan (2) ikut tersimpan");
    await tunggu(80);
    expect(nonGetAbt(h)).toEqual([]);
    input.click();
    await sampai(() => /dirapikan/.test(kabarInput(h)?.textContent || "") && !input.disabled, "kabar input");
    expect(positaPost(h).filter((b) => b.ujiKering === false)).toEqual([{ perkaraId: "10018", ujiKering: false }]);
    expect(nonGetAbt(h).filter((m) => /tanyajawab_perkara_edit\?aksi=simpan&no_var=2021/.test(m.url))).toHaveLength(1);
  });

  it("⋯ → Lihat yang dirapikan menampilkan kartunya (dan angkanya ikut di tombol); ⋯ lagi menyembunyikan", async () => {
    const h = buka({ simpanan: ui([], nyata), peran: "Hakim" });
    const input = await selesaiIsi(h);
    await sampai(() => qs(h, ".aleta-a1-rapi").length === 2, "dua kartu rapi");
    q(h, ".aleta-sore-menu-tombol").click();
    const lihat = await sampai(() => q(h, ".aleta-a2-menu-rapi"), "butir Lihat yang dirapikan");
    expect(lihat.textContent).toBe("Lihat yang dirapikan");
    lihat.click();
    expect(qs(h, ".aleta-a1-rapi").every((k) => terlihat(k))).toBe(true);
    expect(input.textContent).toBe("Input ke ABT (4)");
    const sembunyi = await sampai(() => (q(h, ".aleta-a2-menu-rapi")?.textContent === "Sembunyikan yang dirapikan" ? q(h, ".aleta-a2-menu-rapi") : null), "butir berganti");
    sembunyi.click();
    expect(qs(h, ".aleta-a1-rapi").some((k) => terlihat(k))).toBe(false);
    expect(input.textContent).toBe("Input ke ABT (2)");
  });
});

// ============================================================================
describe("butir 3: putusan massal ABT - blangko utama di atas, 'Blangko berbeda…' per perkara", () => {
  const SIDANG = [
    { nomorPerkara: "501/Pdt.G/2026/PA.Dgl", perkaraId: "501", jenisPerkara: "Cerai Gugat", agenda: "Pembacaan putusan", alasanDitunda: "Putus", majelisNama: "Dra. Munifa, S.H." },
    { nomorPerkara: "502/Pdt.G/2026/PA.Dgl", perkaraId: "502", jenisPerkara: "Cerai Talak", agenda: "Pembacaan putusan", alasanDitunda: "Putus", majelisNama: "Dra. Munifa, S.H." },
  ].map((s) => ({ ...s, sudahPutus: false, ditunda: true, sidangIkrarTalak: false }));
  const sidang: Pengganti = (url) => (url.includes("/aleta-ecourt/sidang?") ? { isi: { data: { available: true, sidang: SIDANG } } } : undefined);
  const PETA = {
    petaBlangkoPutusan: {
      "cerai gugat": { blangko: "Putusan Cerai Gugat", berkas: "[01] Kabul Verstek CG", a: "tokenAAAA1", b: "tokenBBBB1", d: "" },
      "cerai talak": { blangko: "Putusan Cerai Talak", berkas: "[02] Kabul CT", a: "tokenCCCC2", b: "tokenDDDD2", d: "" },
    },
  };
  const baris = (h: Halaman, nomor: string) =>
    (Array.from(massalDari(h).querySelectorAll(".aleta-massal-daftar .aleta-massal-baris")) as any[]).find((l) => l.querySelector(".aleta-massal-nomor")?.textContent === nomor);
  const tanda = (l: any) => (Array.from(l.querySelectorAll(".aleta-massal-keadaan")) as any[]).pop().textContent;

  it("UI Baru: bilah Blangko utama di atas daftar; memilihnya berlaku untuk semua; 'Blangko berbeda…' memilih blangko satu perkara", async () => {
    const h = buka({ beranda: true, simpanan: ui([], PETA), peran: "Hakim", nama: "Dra. Munifa, S.H.", ganti: sidang });
    const b501 = await sampai(() => baris(h, "501/Pdt.G/2026/PA.Dgl"), "baris 501");
    const utama = massalDari(h).querySelector(".aleta-a2-utama");
    expect(utama.nextElementSibling.classList.contains("aleta-massal-daftar")).toBe(true);
    // Bawaan = pemetaan jenis (1.177.0): tiap perkara blangko jenisnya.
    expect(tanda(b501)).toBe("blangko: [01] Kabul Verstek CG");
    expect(tanda(baris(h, "502/Pdt.G/2026/PA.Dgl"))).toBe("blangko: [02] Kabul CT");
    // Pilihan per perkara tersembunyi di balik tombolnya.
    const pilihBaris = b501.querySelector(".aleta-massal-pilih-berkas");
    expect(pilihBaris.hidden).toBe(true);
    expect(b501.querySelector(".aleta-a2-berbeda").textContent).toBe("Blangko berbeda…");

    const pilihUtama = utama.querySelector("select");
    pilihUtama.value = (Array.from(pilihUtama.options) as any[]).find((o) => /Kabul CT/.test(o.textContent)).value;
    pilihUtama.dispatchEvent(new h.w.Event("change"));
    expect(tanda(baris(h, "501/Pdt.G/2026/PA.Dgl"))).toBe("blangko: [02] Kabul CT");
    expect(tanda(baris(h, "502/Pdt.G/2026/PA.Dgl"))).toBe("blangko: [02] Kabul CT");

    const b = baris(h, "501/Pdt.G/2026/PA.Dgl");
    b.querySelector(".aleta-a2-berbeda").click();
    const pilih = b.querySelector(".aleta-massal-pilih-berkas");
    expect(pilih.hidden).toBe(false);
    expect(b.querySelector("input.aleta-massal-centang").checked).toBe(false);
    pilih.value = (Array.from(pilih.options) as any[]).find((o) => /Verstek CG/.test(o.textContent)).value;
    pilih.dispatchEvent(new h.w.Event("change"));
    expect(tanda(b)).toBe("blangko: [01] Kabul Verstek CG");
    expect(tanda(baris(h, "502/Pdt.G/2026/PA.Dgl"))).toBe("blangko: [02] Kabul CT");
  });

  it("UI Baru: blangko yang dipilih di panel SIPP (blangkoPutusanMassal, agen S) dipakai - pengecualian per perkara dan utama; disebut di kabar", async () => {
    const dariSipp = {
      blangkoPutusanMassal: {
        utama: "[02] kabul ct",
        perkara: { "501/Pdt.G/2026/PA.Dgl": { kunci: "[01] kabul verstek cg", blangko: "Putusan Cerai Gugat", berkas: "[01] Kabul Verstek CG", a: "tokenAAAA1", b: "tokenBBBB1", d: "" } },
      },
    };
    const h = buka({ beranda: true, simpanan: ui([], { ...PETA, ...dariSipp }), peran: "Hakim", nama: "Dra. Munifa, S.H.", ganti: sidang });
    const b501 = await sampai(() => baris(h, "501/Pdt.G/2026/PA.Dgl"), "baris 501");
    expect(massalDari(h).querySelector(".aleta-a2-utama select").value).toBe("[02] kabul ct");
    expect(tanda(b501)).toBe("blangko: [01] Kabul Verstek CG");
    expect(b501.querySelector(".aleta-massal-pilih-berkas").hidden).toBe(false);
    expect(tanda(baris(h, "502/Pdt.G/2026/PA.Dgl"))).toBe("blangko: [02] Kabul CT");
    expect(massalDari(h).querySelector(".aleta-a2-dari-sipp").textContent).toBe("Dari pilihan di panel SIPP: blangko utama dan 1 pengecualian per perkara. Ubah di sini bila perlu.");
  });

  it("UI Baru + basmassal.js (agen R): baris aletaMassalBarisBlangko dipakai; pilihannya diteruskan ke pilihan per perkara yang sama", async () => {
    const h = buka({ beranda: true, basmassal: true, simpanan: ui([], PETA), peran: "Hakim", nama: "Dra. Munifa, S.H.", ganti: sidang });
    const b = await sampai(() => baris(h, "501/Pdt.G/2026/PA.Dgl")?.querySelector(".aleta-massal-blangko-baris") ? baris(h, "501/Pdt.G/2026/PA.Dgl") : null, "baris blangko agen R");
    const r = b.querySelector(".aleta-massal-blangko-baris");
    expect(r.querySelector(".aleta-massal-blangko-teks").textContent).toBe("Blangko utama: [01] Kabul Verstek CG");
    expect(b.querySelector(".aleta-massal-pilih-berkas").hidden).toBe(true);
    r.querySelector(".aleta-massal-blangko-beda").click();
    expect(b.querySelector("input.aleta-massal-centang").checked).toBe(false);
    const ps = r.querySelector(".aleta-massal-blangko-pilih");
    ps.value = String(Array.from(ps.options).findIndex((o: any) => /Kabul CT/.test(o.textContent)) - 1);
    ps.dispatchEvent(new h.w.Event("change"));
    // Digambar ulang (lupakanPemeriksaan + pilihanPer) - tandanya mengikuti, keadaan "berbeda" dipulihkan.
    const b2 = await sampai(() => (/Kabul CT/.test(tanda(baris(h, "501/Pdt.G/2026/PA.Dgl"))) ? baris(h, "501/Pdt.G/2026/PA.Dgl") : null), "tanda 501 berganti");
    expect(tanda(b2)).toBe("blangko: [02] Kabul CT");
    expect(b2.querySelector(".aleta-massal-blangko-baris").getAttribute("data-keadaan")).toBe("beda");
    expect(tanda(baris(h, "502/Pdt.G/2026/PA.Dgl"))).toBe("blangko: [02] Kabul CT");
  });

  it("UI Baru (Super Admin): kelompok per hakim bertag 'Hakim'; hanya kelompok pertama terbuka (butir 19)", async () => {
    const dua: Pengganti = (url) =>
      url.includes("/aleta-ecourt/sidang?")
        ? { isi: { data: { available: true, sidang: [SIDANG[0], { ...SIDANG[1], majelisNama: "Mohammad Syukri, S.H." }] } } }
        : undefined;
    const h = buka({ beranda: true, simpanan: ui([], PETA), ganti: dua });
    const kelompok = await sampai(() => (massalDari(h)?.querySelectorAll(".aleta-a1-kelompok").length === 2 ? (Array.from(massalDari(h).querySelectorAll(".aleta-a1-kelompok")) as any[]) : null), "dua kelompok");
    expect(kelompok.map((g) => g.getAttribute("data-terbuka"))).toEqual(["ya", "tidak"]);
    for (const g of kelompok) expect(g.querySelector(".aleta-lipat-peran").textContent).toBe("Hakim");
  });

  it("Baru: tanpa bilah blangko utama; pilihan blangko per baris tetap tampil seperti 1.177.0", async () => {
    const h = buka({ beranda: true, simpanan: baru([], PETA), ganti: sidang });
    const b501 = await sampai(() => baris(h, "501/Pdt.G/2026/PA.Dgl"), "baris 501");
    expect(massalDari(h).querySelector(".aleta-a2-utama, .aleta-a2-berbeda")).toBeNull();
    expect(b501.querySelector(".aleta-massal-pilih-berkas").hidden).toBe(false);
    expect(b501.querySelector('.aleta-massal-pilih-berkas option[value=""]').textContent).toBe("blangko menurut jenis");
  });
});

// ============================================================================
// 1.184.0 (5 Okt 2026, butir 16): keputusan pengguna "Tanpa jeda di ABT" menggantikan
// butir 14 KHUSUS ABT - tulisan ke ABT tidak lagi didahului jeda (±75% waktu Input
// ke ABT). alatJedaManusia tetap ada untuk SIPP/e-Court. Tanpa penanda ALETA tetap.
describe("butir 14 + 16: tulisan ke ABT TANPA jeda (5 Okt), tanpa penanda ALETA", () => {
  /** Mengganti alatJedaManusia dengan perekam; indeks = banyaknya permintaan saat jeda diminta. */
  function rekamJeda(h: Halaman) {
    const jeda: Array<{ jenis: string; alamat: string; ke: number }> = [];
    h.w.__a2.gantiJeda((jenis: string, o: { alamat?: string }) => {
      jeda.push({ jenis, alamat: String(o?.alamat || ""), ke: h.minta.length });
      return Promise.resolve(0);
    });
    return jeda;
  }

  for (const [nama, simpanan] of [
    ["UI Baru", ui([], nyata)],
    ["Baru (global, bukan hanya UI Baru)", baru([], nyata)],
  ] as const) {
    it(`${nama}: tulisan ABT (simpan variabel, tanya-jawab) tanpa jeda; isinya tanpa kata ALETA`, async () => {
      const h = buka({ simpanan, peran: "Hakim" });
      const jeda = rekamJeda(h);
      const input = await selesaiIsi(h);
      await tunggu(80);
      expect(jeda).toEqual([]);
      input.click();
      await sampai(() => /tersimpan|dirapikan/.test(kabarInput(h)?.textContent || "") && !input.disabled, "kabar input");
      // Tulisan LANGSUNG ke ABT. Posita SIPP dan unggah putusan lewat bot ALETA - jedanya urusan bot (agen E).
      const tulis = h.minta.map((m, i) => ({ ...m, i })).filter((m) => m.cara !== "GET" && m.url.includes("/aps_badilag/"));
      expect(tulis.length).toBeGreaterThan(0);
      // Tidak satu jeda pun diminta untuk tulisan ABT.
      expect(jeda).toEqual([]);
      for (const t of tulis) expect(decodeURIComponent(t.badan)).not.toMatch(/ALETA/i);
    });
  }

  it("alatJedaManusia W tetap hidup (untuk SIPP/e-Court) - tetapi Input ke ABT tidak menunggunya; dinolkan dalam mode coba", async () => {
    const h = buka({ simpanan: ui([], nyata), peran: "Hakim" });
    // Jeda yang SANGAT panjang bila sampai dipakai: Input ke ABT harus tetap selesai cepat.
    h.w.__a2.setelJeda(5);
    const input = await selesaiIsi(h);
    const mulai = Date.now();
    input.click();
    await sampai(() => /dirapikan/.test(kabarInput(h)?.textContent || "") && !input.disabled, "kabar input");
    // Sampai 1.183.0: 1 variabel + huruf + tanya-jawab 2021 = 3 x (0,9-2,2 dtk) x 5 >= 13 dtk.
    expect(Date.now() - mulai).toBeLessThan(4000);
    h.w.__a2.setelJeda(0.02);
    expect(await h.w.__a2.jedaAsli("simpan", { alamat: "x" })).toBeGreaterThan(0);
    const coba = buka({ simpanan: ui([]), peran: "Hakim" });
    await siapPeran(coba);
    coba.w.__a2.setelJeda(1);
    expect(await coba.w.__a2.jedaAsli("simpan", { alamat: `${ASAL_ABT}/edit_data?no_var=0222` })).toBe(0);
  });

  it("sel variabel ABT tidak lagi bertooltip ALETA", async () => {
    // 12 Okt: saklar sunting langsung MATI (bawaan) = sel tanpa petunjuk sunting;
    // MENYALA = petunjuk "klik dua kali". Tidak pernah menyebut ALETA.
    const h = buka({ simpanan: baru([]) });
    await siapPeran(h);
    const sel = await sampai(() => h.w.document.querySelector(".aleta-abt-dapat-disunting"), "sel dapat disunting");
    expect(sel.title).toBe("");
    const hidup = buka({ simpanan: baru([], { suntingLangsungAbt: true }) });
    await siapPeran(hidup);
    const selHidup = await sampai(() => hidup.w.document.querySelector(".aleta-abt-dapat-disunting"), "sel dapat disunting");
    await sampai(() => selHidup.title, "petunjuk sel");
    expect(selHidup.title).toBe("Klik dua kali untuk menyunting di tempat. Ctrl+Enter menyimpan, Esc membatalkan.");
    expect(selHidup.title).not.toMatch(/ALETA/i);
  });
});

// ============================================================================
describe("CSS blok A2", () => {
  it("di ujung berkas antara penandanya; aturan rupa berawalan html[data-aleta-kulit=\"modern\"], aturan perilaku hanya atas atribut/kelas a2", () => {
    const css = baca("panel.css");
    const mulai = css.indexOf("/* === A2 - PERBAIKAN 2 OKT === */");
    const akhir = css.indexOf("/* === AKHIR A2 === */");
    expect(mulai).toBeGreaterThan(0);
    expect(akhir).toBeGreaterThan(mulai);
    expect(css.slice(0, mulai)).not.toMatch(/aleta-a2-|data-a2-/);
    const blok = css.slice(css.indexOf("*/", mulai) + 2, akhir).replace(/\/\*[\s\S]*?\*\//g, "");
    let n = 0;
    for (const aturan of blok.split("}")) {
      if (!aturan.includes("{")) continue;
      n += 1;
      for (const b of aturan.split("{")[0].split(",")) {
        const p = b.trim();
        expect(/^html\[data-aleta-kulit="modern"\] /.test(p) || /data-a2-|aleta-a2-|\[hidden\]/.test(p), p).toBe(true);
      }
    }
    expect(n).toBeGreaterThan(8);
    expect(blok).toContain('#aleta-panel-abt [data-a2-terlipat="ya"] { display: none !important; }');
  });
});
