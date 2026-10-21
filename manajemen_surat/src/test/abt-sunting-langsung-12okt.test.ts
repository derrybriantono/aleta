// @vitest-environment node
/**
 * ============================================================================
 * 12 OKT 2026 - SUNTING LANGSUNG DI ABT (AGEN G, butir 15 dan 16)
 * ============================================================================
 *
 * panel-alat.js dan abt.js dijalankan SUNGGUHAN di jsdom beralamat halaman
 * blangko ABT (perangkat uji yang SAMA dengan ekstensi-abt-2okt, disalin -
 * berkas uji tidak saling mengimpor). Yang dijaga:
 *   15  saklar "Sunting langsung (klik dua kali)" MATI = sel ABT tidak dapat
 *       disunting (klik, klik dua kali, Enter); dibaca seketika, termasuk
 *       saat halaman terbuka dan saat tab tidak menerima onChanged
 *   16  saklar MENYALA = klik dua kali menyunting; klik di luar kotak =
 *       batal otomatis; Esc = batal; hanya Simpan yang menulis ke ABT
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
// 21 Okt 2026: panel bawaannya lencana; uji isi/letak panel memakai panel yang disetel TERBUKA (pilihan sesudah keputusan itu).
const ui = (kode: string[], lain: Record<string, unknown> = {}) => ({ ujiTampilan: "ui", ujiFitur: fitur(kode), panelBawaanTampil: { aleta: true, sipp: true, abt: true, diubahPada: "2026-10-22T00:00:00.000Z" }, ...lain });
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
// 12 OKT 2026 - SUNTING LANGSUNG DI ABT (AGEN G, butir 15 dan 16)
// ============================================================================
const NYALA = { suntingLangsungAbt: true };
/** Menyala + tindakan nyata (tanpa itu mode coba menahan tulisan ke ABT dengan 423). */
const NYALA_NYATA = { suntingLangsungAbt: true, ...nyata };
const attr = (h: Halaman) => h.w.document.body.getAttribute("data-aleta-sunting-langsung");
const selVar = (h: Halaman, kode: string) => h.w.document.getElementById(kode).parentElement.children[2] as any;
const siapSel = async (h: Halaman, kode = "0222") => {
  const sel = await sampai(() => (selVar(h, kode).classList.contains("aleta-abt-dapat-disunting") ? selVar(h, kode) : null), "sel dapat disunting");
  await sampai(() => attr(h), "saklar sunting langsung terbaca");
  return sel;
};
const peristiwa = (h: Halaman, el: any, jenis: string, opsi: Record<string, unknown> = {}) =>
  el.dispatchEvent(new (jenis.startsWith("key") ? h.w.KeyboardEvent : h.w.MouseEvent)(jenis, { bubbles: true, cancelable: true, ...opsi }));
const klik = (h: Halaman, el: any) => peristiwa(h, el, "click");
const klikDua = (h: Halaman, el: any) => peristiwa(h, el, "dblclick");
/** Tekan di luar kotak: pointerdown + mousedown di <body> (seperti klik sungguhan). */
const tekanDiLuar = (h: Halaman) => {
  const b = h.w.document.body;
  b.dispatchEvent(new h.w.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
};
const tulisEdit = (h: Halaman) => h.minta.filter((m) => m.cara === "POST" && m.url.includes("/edit_data"));
const kotakSel = (sel: any) => sel.querySelector("textarea.aleta-abt-ketik");
const tombolSel = (sel: any, teks: string) => Array.from(sel.querySelectorAll("button")).find((b: any) => b.textContent === teks) as any;
const buatKetik = (h: Halaman, el: any, nilai: string) => {
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
};

describe("butir 15: saklar MATI = sel ABT tidak dapat disunting sama sekali", () => {
  it("satu klik, klik dua kali, dan Enter pada sel: tidak ada penyunting; atribut <body> 'tidak'; tanpa petunjuk", async () => {
    const h = buka({ simpanan: ui([]) });
    await siapPeran(h);
    const sel = await siapSel(h);
    expect(attr(h)).toBe("tidak");
    expect(sel.title).toBe("");
    klik(h, sel);
    klikDua(h, sel);
    peristiwa(h, sel, "keydown", { key: "Enter" });
    await tunggu(120);
    expect(sel.querySelector("textarea")).toBeNull();
    expect(h.w.document.querySelector(".aleta-abt-sunting")).toBeNull();
    expect(nonGetAbt(h)).toEqual([]);
  });

  it("tidak ada jalur lain: baris yang dihitung ABT (tanpa tombol edit) memang tidak punya penyunting, saklar menyala pun", async () => {
    const h = buka({ simpanan: ui([], NYALA) });
    await siapPeran(h);
    await siapSel(h);
    // Tiap sel yang dapat disunting berasal dari baris bertombol edit; 'abt-edit' lain tidak ada.
    for (const sel of Array.from(h.w.document.querySelectorAll(".aleta-abt-dapat-disunting")) as any[]) {
      expect(sel.parentElement.querySelector("a[onclick]")).not.toBeNull();
    }
  });

  it("dibaca seketika: saklar dimatikan saat halaman terbuka - atribut berganti, petunjuk lenyap, klik dua kali tak membuka apa pun", async () => {
    const h = buka({ simpanan: ui([], NYALA) });
    await siapPeran(h);
    const sel = await siapSel(h);
    await sampai(() => attr(h) === "ya", "menyala");
    await sampai(() => sel.title, "petunjuk ada");
    await h.w.chrome.storage.local.set({ suntingLangsungAbt: false });
    await sampai(() => attr(h) === "tidak", "mati seketika");
    expect(sel.title).toBe("");
    klikDua(h, sel);
    await tunggu(120);
    expect(sel.querySelector("textarea")).toBeNull();
  });

  it("penyunting yang SEDANG terbuka ikut ditutup (batal, tanpa simpan) saat saklar dimatikan", async () => {
    const h = buka({ simpanan: ui([], NYALA) });
    await siapPeran(h);
    const sel = await siapSel(h);
    const asli = sel.textContent;
    await sampai(() => attr(h) === "ya", "menyala");
    klikDua(h, sel);
    await sampai(() => kotakSel(sel), "penyunting terbuka");
    buatKetik(h, kotakSel(sel), "diketik sebelum dimatikan");
    await h.w.chrome.storage.local.set({ suntingLangsungAbt: false });
    await sampai(() => !sel.querySelector("textarea"), "penyunting tertutup");
    expect(sel.textContent).toBe(asli);
    expect(nonGetAbt(h)).toEqual([]);
  });

  it("tab yang tidak menerima onChanged (dibekukan): saklar dibaca ULANG dari penyimpanan saat klik dua kali", async () => {
    const h = buka({ simpanan: ui([], NYALA) });
    await siapPeran(h);
    const sel = await siapSel(h);
    await sampai(() => attr(h) === "ya", "menyala");
    // Mengubah simpanan TANPA pemberitahuan onChanged.
    h.simpanan.suntingLangsungAbt = false;
    klikDua(h, sel);
    await sampai(() => attr(h) === "tidak", "dikoreksi dari penyimpanan");
    expect(sel.querySelector("textarea")).toBeNull();
  });

  it("penyimpanan tak terbaca = MATI", async () => {
    const h = buka({ simpanan: ui([], NYALA) });
    await siapPeran(h);
    const sel = await siapSel(h);
    await sampai(() => attr(h) === "ya", "menyala");
    h.w.chrome.storage.local.get = async () => {
      throw new Error("penyimpanan putus");
    };
    klikDua(h, sel);
    await sampai(() => attr(h) === "tidak", "gagal baca = mati");
    expect(sel.querySelector("textarea")).toBeNull();
  });
});

describe("butir 16: saklar MENYALA - klik dua kali menyunting; di luar = batal; hanya Simpan menyimpan", () => {
  it("satu klik tidak membuka; klik dua kali membuka kotak dengan Simpan dan Batal; petunjuk menyebut klik dua kali", async () => {
    const h = buka({ simpanan: ui([], NYALA) });
    await siapPeran(h);
    const sel = await siapSel(h);
    await sampai(() => attr(h) === "ya", "menyala");
    expect(sel.title).toBe("Klik dua kali untuk menyunting di tempat. Ctrl+Enter menyimpan, Esc membatalkan.");
    klik(h, sel);
    await tunggu(100);
    expect(sel.querySelector("textarea")).toBeNull();
    klikDua(h, sel);
    await sampai(() => kotakSel(sel), "penyunting terbuka");
    expect(tombolSel(sel, "Simpan")).toBeDefined();
    expect(tombolSel(sel, "Batal")).toBeDefined();
    expect(nonGetAbt(h)).toEqual([]);
  });

  it("klik di luar kotak = BATAL otomatis tanpa simpan; klik di dalam kotak tidak membatalkan", async () => {
    const h = buka({ simpanan: ui([], NYALA) });
    await siapPeran(h);
    const sel = await siapSel(h);
    const asli = sel.textContent;
    await sampai(() => attr(h) === "ya", "menyala");
    klikDua(h, sel);
    const kotak = await sampai(() => kotakSel(sel), "penyunting terbuka");
    buatKetik(h, kotak, "ketikan yang akan dibuang");
    // Di dalam kotak: tetap terbuka.
    kotak.dispatchEvent(new h.w.MouseEvent("mousedown", { bubbles: true }));
    kotak.dispatchEvent(new h.w.Event("pointerdown", { bubbles: true }));
    await tunggu(30);
    expect(sel.querySelector("textarea")).not.toBeNull();
    // Di luar: batal.
    tekanDiLuar(h);
    expect(sel.querySelector("textarea")).toBeNull();
    expect(sel.textContent).toBe(asli);
    await tunggu(60);
    expect(nonGetAbt(h)).toEqual([]);
    // Pendengar luar dilepas: klik berikutnya tidak melakukan apa pun.
    tekanDiLuar(h);
    expect(sel.textContent).toBe(asli);
  });

  it("Esc = batal (bahkan saat fokus bukan di kotak); tombol Batal = batal; keduanya tanpa tulisan ke ABT", async () => {
    const h = buka({ simpanan: ui([], NYALA) });
    await siapPeran(h);
    const sel = await siapSel(h);
    const asli = sel.textContent;
    await sampai(() => attr(h) === "ya", "menyala");
    klikDua(h, sel);
    await sampai(() => kotakSel(sel), "terbuka 1");
    buatKetik(h, kotakSel(sel), "x");
    peristiwa(h, h.w.document.body, "keydown", { key: "Escape" });
    expect(sel.querySelector("textarea")).toBeNull();
    expect(sel.textContent).toBe(asli);
    klikDua(h, sel);
    await sampai(() => kotakSel(sel), "terbuka 2");
    buatKetik(h, kotakSel(sel), "y");
    tombolSel(sel, "Batal").click();
    expect(sel.querySelector("textarea")).toBeNull();
    expect(sel.textContent).toBe(asli);
    await tunggu(60);
    expect(nonGetAbt(h)).toEqual([]);
  });

  it("hanya tombol Simpan yang menyimpan: POST edit_data satu kali, sel berisi nilai baru, penyunting tertutup", async () => {
    const h = buka({ simpanan: ui([], NYALA_NYATA) });
    await siapPeran(h);
    const sel = await siapSel(h);
    await sampai(() => attr(h) === "ya", "menyala");
    klikDua(h, sel);
    await sampai(() => kotakSel(sel), "terbuka");
    buatKetik(h, kotakSel(sel), "bulan Maret 2024");
    tombolSel(sel, "Simpan").click();
    await sampai(() => tulisEdit(h).length === 1 && !sel.querySelector("textarea"), "tersimpan dan tertutup");
    expect(new URLSearchParams(tulisEdit(h)[0].badan).get("value")).toBe("bulan Maret 2024");
    expect(sel.textContent).toContain("bulan Maret 2024");
  });

  it("klik di luar SAAT menyimpan diabaikan (penulisan tidak dibatalkan di tengah jalan)", async () => {
    const h = buka({ simpanan: ui([], NYALA_NYATA) });
    const asliFetch = h.w.fetch;
    h.w.fetch = async (alamat: string, opsi?: { method?: string }) => {
      if (String(opsi?.method || "GET").toUpperCase() === "POST" && String(alamat).includes("/edit_data")) await tunggu(150);
      return asliFetch(alamat, opsi);
    };
    await siapPeran(h);
    const sel = await siapSel(h);
    await sampai(() => attr(h) === "ya", "menyala");
    klikDua(h, sel);
    await sampai(() => kotakSel(sel), "terbuka");
    buatKetik(h, kotakSel(sel), "nilai saat menyimpan");
    tombolSel(sel, "Simpan").click();
    await tunggu(20);
    tekanDiLuar(h);
    expect(sel.querySelector("textarea")).not.toBeNull();
    await sampai(() => !sel.querySelector("textarea"), "selesai menyimpan");
    expect(sel.textContent).toContain("nilai saat menyimpan");
    expect(tulisEdit(h).length).toBe(1);
  });

  it("sel yang berisi tombol/tautan: klik dua kali pada kontrolnya bukan undangan menyunting", async () => {
    const h = buka({ simpanan: ui([], NYALA) });
    await siapPeran(h);
    const sel = await siapSel(h);
    await sampai(() => attr(h) === "ya", "menyala");
    const tombolDalam = h.w.document.createElement("button");
    sel.appendChild(tombolDalam);
    klikDua(h, tombolDalam);
    await tunggu(100);
    expect(sel.querySelector("textarea")).toBeNull();
    tombolDalam.remove();
  });
});

describe("kartu usulan: teks usulan menurut saklar; tombol Sunting; di luar = batal; Simpan/Batal", () => {
  const siapKartu = async (h: Halaman, kode = "0222") => {
    await selesaiIsi(h);
    const kartu = await sampai(() => qs(h, ".aleta-abt-kartu").find((k) => k.querySelector(".aleta-abt-kode")?.textContent === kode), `kartu ${kode}`);
    await sampai(() => attr(h), "saklar terbaca");
    return kartu as any;
  };
  const isiKartu = (kartu: any) => kartu.querySelector(".aleta-abt-usul .aleta-abt-isi");
  const tombolSunting = (kartu: any) => Array.from(kartu.querySelectorAll("button")).find((b: any) => b.textContent === "Sunting") as any;
  const kotakKartu = (kartu: any) => kartu.querySelector("textarea.aleta-abt-sunting-kotak");
  const tombolKartu = (kartu: any, teks: string) => Array.from(kartu.querySelectorAll(".aleta-abt-sunting-bungkus button")).find((b: any) => b.textContent === teks) as any;

  it("MATI: teks tanpa tabindex/role/petunjuk; klik dua kali dan Enter tidak membuka; tombol Sunting tetap membuka", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim" });
    const kartu = await siapKartu(h);
    const isi = isiKartu(kartu);
    expect(isi.hasAttribute("tabindex")).toBe(false);
    expect(isi.hasAttribute("role")).toBe(false);
    expect(isi.title).toBe("");
    klikDua(h, isi);
    peristiwa(h, isi, "keydown", { key: "Enter" });
    peristiwa(h, isi, "keydown", { key: " " });
    await tunggu(120);
    expect(kotakKartu(kartu)).toBeNull();
    tombolSunting(kartu).click();
    expect(kotakKartu(kartu)).not.toBeNull();
    expect(tombolKartu(kartu, "Simpan")).toBeDefined();
    expect(tombolKartu(kartu, "Batal")).toBeDefined();
  });

  it("klik di luar kotak = batal (suntingan dibuang, nilai usulan tidak berubah); tidak ada tulisan ke ABT", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim" });
    const kartu = await siapKartu(h);
    const asli = isiKartu(kartu).textContent;
    tombolSunting(kartu).click();
    buatKetik(h, kotakKartu(kartu), "dibuang");
    // Klik di dalam kotak tidak membatalkan.
    kotakKartu(kartu).dispatchEvent(new h.w.MouseEvent("mousedown", { bubbles: true }));
    expect(kotakKartu(kartu)).not.toBeNull();
    tekanDiLuar(h);
    expect(kotakKartu(kartu)).toBeNull();
    expect(isiKartu(kartu).textContent).toBe(asli);
    expect(kartu.querySelector(".aleta-tanda-sunting").hidden).toBe(true);
    await tunggu(60);
    expect(nonGetAbt(h)).toEqual([]);
  });

  it("Esc dan Batal membuang; Simpan (dan Ctrl+Enter) menerapkan ke usulan: ditandai 'disunting' dan dicentang, belum menulis ke ABT", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim" });
    const kartu = await siapKartu(h);
    const asli = isiKartu(kartu).textContent;
    tombolSunting(kartu).click();
    buatKetik(h, kotakKartu(kartu), "x1");
    peristiwa(h, kotakKartu(kartu), "keydown", { key: "Escape" });
    expect(kotakKartu(kartu)).toBeNull();
    expect(isiKartu(kartu).textContent).toBe(asli);
    tombolSunting(kartu).click();
    buatKetik(h, kotakKartu(kartu), "x2");
    tombolKartu(kartu, "Batal").click();
    expect(kotakKartu(kartu)).toBeNull();
    expect(isiKartu(kartu).textContent).toBe(asli);
    tombolSunting(kartu).click();
    buatKetik(h, kotakKartu(kartu), "bulan Mei 2023");
    tombolKartu(kartu, "Simpan").click();
    expect(kotakKartu(kartu)).toBeNull();
    expect(isiKartu(kartu).textContent).toBe("bulan Mei 2023");
    expect(kartu.querySelector(".aleta-tanda-sunting").hidden).toBe(false);
    expect(kartu.querySelector("input.aleta-abt-centang").checked).toBe(true);
    tombolSunting(kartu).click();
    buatKetik(h, kotakKartu(kartu), "bulan Juni 2023");
    peristiwa(h, kotakKartu(kartu), "keydown", { key: "Enter", ctrlKey: true });
    expect(isiKartu(kartu).textContent).toBe("bulan Juni 2023");
    await tunggu(60);
    expect(nonGetAbt(h)).toEqual([]);
  });

  it("12OKT-M: saklar MATI, tombol Sunting tetap ada, dan hasilnya DITULIS ke ABT: Input ke ABT mengirim isi suntingan (bukan usulan semula); Batal/Esc tidak menulis apa pun", async () => {
    const h = buka({ simpanan: ui([], nyata), peran: "Hakim" });
    const kartu = await siapKartu(h);
    const input = await selesaiIsi(h);
    await sampai(() => attr(h) === "tidak", "saklar sunting langsung mati");
    const usulanSemula = isiKartu(kartu).textContent;
    const centang = kartu.querySelector("input.aleta-abt-centang");
    // Batal tidak mengubah apa pun dan tidak menulis.
    tombolSunting(kartu).click();
    buatKetik(h, kotakKartu(kartu), "dibatalkan");
    tombolKartu(kartu, "Batal").click();
    expect(isiKartu(kartu).textContent).toBe(usulanSemula);
    // Simpan di kartu = hanya menerapkan ke usulan; belum menulis ke ABT.
    tombolSunting(kartu).click();
    buatKetik(h, kotakKartu(kartu), "bulan Mei 2023");
    tombolKartu(kartu, "Simpan").click();
    expect(isiKartu(kartu).textContent).toBe("bulan Mei 2023");
    expect(centang.checked).toBe(true);
    await tunggu(80);
    expect(nonGetAbt(h)).toEqual([]);
    // Input ke ABT menulis isi suntingan lewat jalur edit_data yang sama.
    input.click();
    await sampai(() => tulisEdit(h).some((m) => m.url.includes("no_var=0222")), "0222 ditulis ke ABT");
    const tulis = tulisEdit(h).filter((m) => m.url.includes("no_var=0222"));
    expect(tulis).toHaveLength(1);
    expect(new URLSearchParams(tulis[0].badan).get("value")).toBe("bulan Mei 2023");
    expect(new URLSearchParams(tulis[0].badan).get("value")).not.toBe(usulanSemula);
  });

  it("MENYALA: teks berpetunjuk klik dua kali, dapat difokus; klik dua kali dan Enter membuka; satu klik tidak", async () => {
    const h = buka({ simpanan: ui([], NYALA), peran: "Hakim" });
    const kartu = await siapKartu(h);
    await sampai(() => attr(h) === "ya", "menyala");
    const isi = isiKartu(kartu);
    await sampai(() => isi.getAttribute("role") === "button", "petunjuk menyala");
    expect(isi.tabIndex).toBe(0);
    expect(isi.title).toMatch(/klik dua kali/i);
    klik(h, isi);
    await tunggu(100);
    expect(kotakKartu(kartu)).toBeNull();
    klikDua(h, isi);
    await sampai(() => kotakKartu(kartu), "dibuka klik dua kali");
    tombolKartu(kartu, "Batal").click();
    peristiwa(h, isi, "keydown", { key: "Enter" });
    await sampai(() => kotakKartu(kartu), "dibuka Enter");
  });

  it("dimatikan saat penyunting dibuka lewat klik dua kali: ikut tertutup; yang dibuka tombol Sunting tetap", async () => {
    const h = buka({ simpanan: ui([], NYALA), peran: "Hakim" });
    const kartu = await siapKartu(h);
    await sampai(() => attr(h) === "ya", "menyala");
    klikDua(h, isiKartu(kartu));
    await sampai(() => kotakKartu(kartu), "terbuka");
    await h.w.chrome.storage.local.set({ suntingLangsungAbt: false });
    await sampai(() => !kotakKartu(kartu), "tertutup bersama saklar");
    const isi = isiKartu(kartu);
    expect(isi.hasAttribute("role")).toBe(false);
    tombolSunting(kartu).click();
    expect(kotakKartu(kartu)).not.toBeNull();
    await h.w.chrome.storage.local.set({ suntingLangsungAbt: true });
    await sampai(() => attr(h) === "ya", "menyala lagi");
    await tunggu(50);
    expect(kotakKartu(kartu)).not.toBeNull();
  });
});

describe("popup: nama saklar baru, kunci simpanan tetap", () => {
  it("label 'Sunting langsung (klik dua kali)'; kunci suntingLangsungAbt tidak berubah", () => {
    const popupHtml = baca("popup.html");
    expect(popupHtml).toContain("Sunting langsung (klik dua kali)");
    expect(popupHtml).not.toContain("Sunting sekali klik di ABT");
    expect(popupHtml).toContain('id="suntingLangsungAbt"');
    expect(baca("popup.js")).toContain('simpan("suntingLangsungAbt", kotakSunting.checked, kotakSunting)');
  });

  it("tidak ada pendengar 'click' yang membuka penyunting sel lagi (dulu: sekali klik tanpa menengok saklar)", () => {
    const abt = SUMBER_ABT;
    const i = abt.indexOf("function pasangSunting(");
    const badan = abt.slice(i, abt.indexOf("\n}\n", i));
    expect(badan).not.toMatch(/addEventListener\("click"/);
    expect(badan).toContain('addEventListener("dblclick"');
    expect(badan).toContain("await suntingLangsungSekarang()");
  });
});

describe("klik dua kali pada sel ABT tidak menciutkan panel ALETA saat menyunting langsung", () => {
  const dua = (h: Halaman, el: any) => el.dispatchEvent(new h.w.MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: 500, clientY: 400 }));
  it("kontrol: saklar MATI - klik dua kali di luar panel tetap menciutkannya (perilaku lama)", async () => {
    const h = buka({ simpanan: ui([]) });
    await siapPeran(h);
    const sel = await siapSel(h);
    dua(h, sel);
    expect(panelDari(h).classList.contains("aleta-panel-lencana")).toBe(true);
  });

  it("saklar MENYALA: klik dua kali pada sel membuka penyunting dan panel tetap terbentang; di dalam kotak penyunting juga", async () => {
    const h = buka({ simpanan: ui([], NYALA) });
    await siapPeran(h);
    const sel = await siapSel(h);
    await sampai(() => attr(h) === "ya", "menyala");
    dua(h, sel);
    const kotak = await sampai(() => kotakSel(sel), "penyunting terbuka");
    expect(panelDari(h).classList.contains("aleta-panel-lencana")).toBe(false);
    dua(h, kotak);
    expect(panelDari(h).classList.contains("aleta-panel-lencana")).toBe(false);
  });
});
