// @vitest-environment node
/**
 * ============================================================================
 * PERBAIKAN 1 OKT 2026 - PANEL ABT DI UI BARU (AGEN A)
 * ============================================================================
 *
 * panel-alat.js dan abt.js dijalankan SUNGGUHAN di jsdom beralamat halaman
 * blangko ABT (dan beranda ABT). Yang ditiru hanya tepi luarnya: chrome.storage
 * dan jawaban jaringan.
 *
 * Yang dijaga - seluruhnya HANYA di UI Baru; tiap kelompok juga memeriksa
 * bahwa tampilan Baru tidak berubah (Lama dijaga ekstensi-abt-tahap6 "SYARAT
 * MUTLAK", Baru-tanpa-saklar dijaga uji yang sama):
 *   butir 1   bagian panel diberi bentuk lipat seragam lewat alatJadikanLipat
 *             (agen W), berkunci, tanpa melonggarkan menu peran
 *   butir 8   posita & keterangan saksi RAPI langsung di daftar Input ke ABT;
 *             0 tulisan sebelum Input; jalur tulis = jalur Rapikan
 *   butir 9   huruf alasan = kesimpulan; ⓘ aturan (tertutup) dan ⓘ kenapa
 *   butir 10  4020/8521/... tidak diperingatkan sebelum Input; diperingatkan
 *             sesudah Input + muat ulang (pita, dialog CETAK, penjaga lama)
 *   butir 11  unggah putusan perkara ini memakai blangko halaman ini dan
 *             nomor dari variabel 0001 - tidak buntu tanpa pemetaan
 *   butir 13  putusan massal: bawaan hanya putus / tunda untuk putusan
 *   butir 14  admin: dikelompokkan per hakim ketua; hakim: "majelis saya"
 *   butir 15  susun saksi: label pindah ke ⓘ; ⟳ ganti keterangan, ↶ ↷
 *   butir 16  pita error putusan / komentar BAS mengikuti menu peran
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
// ALETA_UJI_ABT hanya dipakai skrip pembukti gigitan: cacat dipasang pada SALINAN.
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
    `${SUMBER_ALAT}\n;\n${SUMBER_ABT}\n;\nwindow.__a1 = typeof t6VarianKalimat === "function" ? { t6VarianKalimat, ` +
      `a1KetuaMajelis: typeof a1KetuaMajelis === "function" ? a1KetuaMajelis : null, a1PutusanLayak: typeof a1PutusanLayak === "function" ? a1PutusanLayak : null } : null;` +
      `\n;\n/* 2 Okt (agen A, butir 14): jeda manusia dinolkan - lihat catatan di buka() */ if (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`
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
describe("butir 8: posita dan keterangan saksi RAPI langsung di daftar Input ke ABT", () => {
  it("UI Baru (hakim): kartu 5125 dan 2021 'dirapikan' tercentang tanpa klik Rapikan; 0 tulisan ABT sebelum Input; posita hanya uji kering", async () => {
    const h = buka({ simpanan: ui([], nyata), peran: "Hakim" });
    const input = await selesaiIsi(h);
    const rapi = await sampai(() => (qs(h, ".aleta-a1-rapi").length === 2 ? qs(h, ".aleta-a1-rapi") : null), "dua kartu rapi");
    expect(rapi.map((k) => k.getAttribute("data-a1-rapi"))).toEqual(["5125", "2021"]);
    expect(rapi.every((k) => k.querySelector("input").checked)).toBe(true);
    expect(rapi[0].querySelector("pre.aleta-abt-pratinjau").textContent).toBe(POSITA_RAPI);
    expect(rapi[1].querySelector("pre.aleta-abt-pratinjau").textContent).toBe("Saksi kenal dengan kedua pihak.");
    // Tombol Rapikan lama tidak pernah ditekan - tetap tersembunyi di ⋯.
    expect(tampak(tombol(h, "Rapikan posita & keterangan saksi"))).toBe(false);
    await tunggu(100);
    expect(nonGetAbt(h)).toEqual([]);
    expect(positaPost(h)).toEqual([{ perkaraId: "10018", ujiKering: true }]);
    // 1 usulan (0222) + 1 huruf (F). Disesuaikan 2 Okt (butir 9, agen A): kartu
    // "dirapikan" tidak lagi tampil, jadi tidak ikut angka di tombol - keduanya
    // tetap tercentang dan tetap ditulis saat Input (diperiksa di bawah).
    expect(input.textContent).toBe("Input ke ABT (2)");

    input.click();
    await sampai(() => /dirapikan/.test(kabarInput(h)?.textContent || "") && !input.disabled, "kabar input");
    // Jalur tulis = jalur Rapikan: posita lewat bot (ujiKering false), saksi lewat tanya-jawab ABT.
    expect(positaPost(h)).toEqual([
      { perkaraId: "10018", ujiKering: true },
      { perkaraId: "10018", ujiKering: false },
    ]);
    const simpanSaksi = nonGetAbt(h).filter((m) => /tanyajawab_perkara_edit\?aksi=simpan&no_var=2021/.test(m.url));
    expect(simpanSaksi).toHaveLength(1);
    expect(JSON.parse(new URLSearchParams(simpanSaksi[0].badan).get("data") || "[]")).toEqual([{ no: "1", tanya: "Apakah saksi kenal?", jawab: "Saksi kenal dengan kedua pihak." }]);
    expect(rapi.every((k) => k.querySelector("input").disabled)).toBe(true);
    expect(h.w.document.getElementById("2021").parentElement.children[2].textContent).toBe("Saksi kenal dengan kedua pihak.");
  });

  it("centang dimatikan: kartu rapi itu tidak ditulis", async () => {
    const h = buka({ simpanan: ui([], nyata), peran: "Hakim" });
    const input = await selesaiIsi(h);
    const rapi = await sampai(() => (qs(h, ".aleta-a1-rapi").length === 2 ? qs(h, ".aleta-a1-rapi") : null), "dua kartu rapi");
    for (const k of rapi) {
      const c = k.querySelector("input");
      c.checked = false;
      c.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    }
    expect(input.textContent).toBe("Input ke ABT (2)");
    input.click();
    await sampai(() => /tersimpan|dituliskan/i.test(kabarInput(h)?.textContent || "") && !input.disabled, "kabar input");
    expect(positaPost(h).filter((b) => b.ujiKering === false)).toEqual([]);
    expect(nonGetAbt(h).filter((m) => /aksi=simpan/.test(m.url))).toEqual([]);
  });

  it("Baru: tidak ada kartu rapi dan tidak ada permintaan posita (perilaku 1.176.0)", async () => {
    const h = buka({ simpanan: baru([], nyata), peran: "Hakim" });
    const input = await selesaiIsi(h);
    await tunggu(150);
    expect(qs(h, ".aleta-a1-rapi")).toEqual([]);
    expect(positaPost(h)).toEqual([]);
    expect(input.textContent).toBe("Input ke ABT (2)");
  });
});

// ============================================================================
describe("butir 9: huruf alasan = kesimpulan; ⓘ aturan (tertutup) dan ⓘ kenapa", () => {
  it("UI Baru: kesimpulan saksi + posita tampil; pasal tersembunyi sampai ⓘ aturan; ⓘ kenapa berisi inti keterangan tiap saksi", async () => {
    const h = buka({ simpanan: ui(["abt-27"]), peran: "Hakim" });
    await selesaiIsi(h);
    const blok = (x: string) => q(h, `.aleta-sore-alasan .aleta-abt-huruf[data-a1-huruf="${x}"]`);
    const f = await sampai(() => blok("F"), "blok huruf F");
    expect(f.querySelector(".aleta-a1-simpul-huruf").textContent).toBe("Kedua saksi menerangkan perselisihan terus-menerus, sejalan dengan dalil posita.");
    expect(blok("B").querySelector(".aleta-a1-simpul-huruf").textContent).toBe(
      "Hanya saksi 2 yang menerangkan tidak memberi nafkah, padahal posita mendalilkannya - belum dikuatkan dua saksi."
    );
    // Tidak ada uraian pasal yang tampak - ringkasan "Dasar hukum (n) - ..." lama pun tidak.
    expect(f.querySelector("details.aleta-abt-lipat")).toBeNull();
    const aturan = f.querySelector(".aleta-a1-aturan");
    expect(aturan.textContent).toContain("Pasal 19 huruf f PP 9/1975");
    expect(tampak(aturan)).toBe(false);
    const sisip = await sampai(() => Array.from(f.children).find((c: any) => c.classList.contains("aleta-t6-pasal-sisip")), "saran pasal abt-27");
    await sampai(() => !tampak(sisip), "saran pasal ikut tertutup");
    f.querySelector(".aleta-a1-info-aturan").click();
    expect(tampak(aturan)).toBe(true);
    expect(tampak(sisip)).toBe(true);
    expect(f.querySelector(".aleta-a1-info-aturan").getAttribute("aria-expanded")).toBe("true");

    const kenapa = f.querySelector(".aleta-a1-kenapa");
    expect(tampak(kenapa)).toBe(false);
    f.querySelector(".aleta-a1-info-kenapa").click();
    expect(tampak(kenapa)).toBe(true);
    // Satu terbuka dalam satu waktu.
    expect(tampak(aturan)).toBe(false);
    expect(Array.from(kenapa.querySelectorAll(".aleta-a1-inti")).map((x: any) => x.textContent)).toEqual([
      'Saksi 1: "Penggugat dan Tergugat sering bertengkar sejak November 2022"',
      'Saksi 2: "Saksi melihat sendiri keduanya bertengkar"',
      'Posita: "Bahwa sejak bulan November 2022 sering terjadi perselisihan"',
    ]);
    // Kalimat sebab lama tetap ada (dibaca uji lama), di balik ⓘ kenapa.
    expect(kenapa.querySelector(".aleta-sore-huruf-sebab").textContent).toBe("perselisihan terus-menerus: dikuatkan 2 saksi & ada di gugatan");
    // Bot belum mengirim intiCiri untuk B: kalimat saksi 2 dari tandaSepihak, ditandai perkiraan.
    const kenapaB = blok("B").querySelector(".aleta-a1-kenapa");
    expect(kenapaB.textContent).toContain('Saksi 2: "Tergugat tidak memberi nafkah sejak 2023"');
    expect(kenapaB.textContent).toContain("Perkiraan dari kata");
  });

  it("Baru: huruf tetap berbentuk lama - sebab sebaris, Dasar hukum dalam details, tanpa ⓘ 1 Okt", async () => {
    const h = buka({ simpanan: baru([]), peran: "Hakim" });
    await selesaiIsi(h);
    const f = await sampai(() => qs(h, ".aleta-sore-alasan .aleta-abt-huruf").find((b) => /Huruf F/.test(b.textContent)), "huruf F");
    expect(f.hasAttribute("data-a1-huruf")).toBe(false);
    expect(f.querySelector(".aleta-abt-huruf-kepala .aleta-sore-huruf-sebab")).not.toBeNull();
    expect(f.querySelector("details.aleta-abt-lipat")).not.toBeNull();
    expect(q(h, ".aleta-a1")).toBeNull();
  });
});

// ============================================================================
describe("butir 10: variabel turunan ABT tidak diperingatkan sebelum Input", () => {
  const pita = (h: Halaman) => q(h, ".aleta-t6-pita-bahaya");
  const pitaTunggu = (h: Halaman) => q(h, ".aleta-t6-pita-tunggu");

  it("sebelum Input: pita error tidak menyebut 4020/8521, catatan tunggu tenang; CETAK tanpa dialog error dan penjaga lama tidak menyebutnya", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim", konfirmasi: false });
    await selesaiIsi(h);
    await sampai(() => pitaTunggu(h) && !pitaTunggu(h).hidden, "catatan tunggu");
    expect(pita(h).hidden).toBe(true);
    expect(pitaTunggu(h).textContent).toContain("4020, 8521 diisi otomatis oleh ABT sesudah variabel lain diinput");
    expect(pitaTunggu(h).classList.contains("aleta-teknis")).toBe(true);
    h.w.document.getElementById("cetak").click();
    await tunggu(30);
    expect(h.w.document.querySelector(".aleta-t6-tirai")).toBeNull();
    // Penjaga lama masih bertanya soal kerangka kosong - tetapi tidak lagi menyebut 4020/8521.
    expect(h.konfirmasi.join("\n")).not.toMatch(/4020|8521/);
  });

  it("sesudah Input lewat ALETA lalu muat ulang (penanda abtInputSelesai lebih tua dari halaman): pita dan dialog CETAK menyebut 4020/8521", async () => {
    const h = buka({ simpanan: ui([], { abtInputSelesai: { "10018": Date.now() - 60000 } }), peran: "Hakim" });
    await selesaiIsi(h);
    const p = await sampai(() => (pita(h) && !pita(h).hidden ? pita(h) : null), "pita error");
    expect(p.textContent).toContain("2 variabel berbunyi pesan error (4020, 8521)");
    h.w.document.getElementById("cetak").click();
    const tirai = await sampai(() => h.w.document.querySelector(".aleta-t6-tirai"), "dialog CETAK");
    expect(tirai.textContent).toContain("4020 Kalimat Alasan (OTOMATIS)");
  });

  it("tanpa penanda tetapi tidak ada lagi yang menunggu Input (kerangka lengkap, daftar kosong): diperingatkan", async () => {
    const kosong: Pengganti = (url, _c, badan) =>
      url.includes("/abt/usulan") && JSON.parse(badan || "{}").sumber === "saksi"
        ? { isi: { data: { available: true, saksi: { ...USULAN_SAKSI, huruf: [], usulan: [] } } } }
        : url.includes("/sipp/posita")
          ? { isi: { data: { available: true, berubah: false, alasan: "sudah rapi" } } }
          : undefined;
    const h = buka({ simpanan: ui([]), peran: "Hakim", ganti: kosong, isi: { ...KERANGKA_LENGKAP, "2021": "Saksi kenal dengan kedua pihak." } });
    await sampai(() => kerjaIsiSelesai(h), "isi selesai");
    const p = await sampai(() => (pita(h) && !pita(h).hidden ? pita(h) : null), "pita error");
    expect(p.textContent).toContain("4020, 8521");
  });

  it("Input ke ABT di halaman ini: catatan berubah menjadi 'muat ulang', penanda tersimpan per perkara", async () => {
    const h = buka({ simpanan: ui([], nyata), peran: "Hakim" });
    const input = await selesaiIsi(h);
    input.click();
    await sampai(() => /muat ulang halaman untuk memeriksanya/.test(pitaTunggu(h)?.textContent || ""), "catatan muat ulang");
    expect(pita(h).hidden).toBe(true);
    await sampai(() => h.simpanan.abtInputSelesai, "penanda tersimpan");
    expect(Object.keys(h.simpanan.abtInputSelesai as object)).toEqual(["10018"]);
  });

  it("Baru (abt-5): 4020/8521 tetap diperingatkan seperti 1.176.0, dan penanda tidak pernah ditulis", async () => {
    const h = buka({ simpanan: baru(["abt-5"], nyata), peran: "Hakim" });
    const p = await sampai(() => (pita(h) && !pita(h).hidden ? pita(h) : null), "pita error Baru");
    expect(p.textContent).toContain("4020, 8521");
    const input = await selesaiIsi(h);
    input.click();
    await sampai(() => /tersimpan/.test(kabarInput(h)?.textContent || ""), "input Baru");
    await tunggu(50);
    expect(h.simpanan.abtInputSelesai).toBeUndefined();
  });
});

const kerjaIsiSelesai = (h: Halaman) => /siap diperiksa|Tidak ada data baru/.test(q(h, '[data-sore-kerja="isi"] .aleta-sore-status')?.textContent || "");

// ============================================================================
describe("butir 11: Unggah putusan perkara ini ke SIPP - tidak buntu", () => {
  const bagian = (h: Halaman) => q(h, ".aleta-abt-bagian");
  const kerjakan = (h: Halaman) => Array.from(bagian(h).querySelectorAll("button")).find((b: any) => b.textContent === "Kerjakan perkara ini") as any;

  it("UI Baru tanpa pemetaan blangko: blangko HALAMAN INI terpilih sendiri; draf, anonim, unggah putusan + anonim berjalan berurutan", async () => {
    const h = buka({ simpanan: ui([], nyata) });
    await selesaiIsi(h);
    const pilih = await sampai(() => (bagian(h)?.querySelector("select")?.value === "__halaman-ini" ? bagian(h).querySelector("select") : null), "blangko halaman ini");
    expect(pilih.selectedOptions[0].textContent).toBe("Blangko halaman ini (dari tautan CETAK)");
    h.minta.length = 0;
    kerjakan(h).click();
    const kabar = bagian(h).querySelector(".aleta-abt-kabar");
    await sampai(() => kabar.querySelector(".aleta-a1-langkah"), "hasil per langkah", 8000);
    const urut = h.minta.filter((m) => /\/preview\?|unggah-naskah|main\/anonim|unggah-sipp/.test(m.url)).map((m) => `${m.cara} ${m.url.replace(ASAL, "").split("?")[0]}`);
    expect(urut).toEqual([
      "GET /aps_badilag/index.php/abt/preview",
      "POST /aleta/api/aleta-ecourt/putusan/unggah-naskah",
      "POST /aps_badilag/index.php/abt/main/anonim",
      "POST /aleta/api/aleta-ecourt/putusan/unggah-sipp",
    ]);
    const rtf = h.minta.find((m) => m.url.includes("/preview?"))!;
    expect(new URLSearchParams(rtf.url.split("?")[1]).get("c")).toBe("10018");
    const unggah = h.minta.find((m) => m.url.includes("unggah-sipp"))!.tubuh as any;
    expect(unggah.get("nomorPerkara")).toBe(NOMOR);
    expect(unggah.get("anonimisasi")).not.toBeNull();
    expect(Array.from(kabar.querySelectorAll(".aleta-a1-langkah li")).map((x: any) => x.textContent)).toEqual([
      "✓ RTF ok",
      "✓ draf v2",
      "✓ anonim ok",
      "✓ SIPP ok (putusan + anonimisasi)",
    ]);
  });

  it("UI Baru, nomor tidak ada di kepala halaman: nomor dari variabel 0001 dipakai untuk unggah", async () => {
    const h = buka({ simpanan: ui([], nyata), tanpaJudul: true });
    await sampai(() => bagian(h)?.querySelector("select")?.value === "__halaman-ini", "blangko halaman ini");
    kerjakan(h).click();
    await sampai(() => h.minta.some((m) => m.url.includes("unggah-sipp")), "unggah", 8000);
    expect((h.minta.find((m) => m.url.includes("unggah-sipp"))!.tubuh as any).get("nomorPerkara")).toBe(NOMOR);
  });

  it("UI Baru, mode coba: tulisan ditahan dan disebut beserta jalan keluarnya - tidak berpura-pura berhasil", async () => {
    const h = buka({ simpanan: ui([]) });
    await sampai(() => bagian(h)?.querySelector("select")?.value === "__halaman-ini", "blangko halaman ini");
    kerjakan(h).click();
    const kabar = bagian(h).querySelector(".aleta-abt-kabar");
    await sampai(() => kabar.querySelector(".aleta-a1-langkah"), "hasil per langkah", 8000);
    expect(kabar.className).toContain("aleta-abt-gagal");
    expect(h.minta.filter((m) => m.cara !== "GET" && /unggah-sipp|unggah-naskah|main\/anonim/.test(m.url))).toEqual([]);
  });

  it("Baru tanpa pemetaan: perilaku 1.176.0 (tidak ada pilihan blangko halaman ini)", async () => {
    const h = buka({ simpanan: baru([], nyata) });
    await sampai(() => bagian(h)?.querySelector("select option"), "daftar blangko");
    await tunggu(80);
    const pilih = bagian(h).querySelector("select");
    expect(Array.from(pilih.options).map((o: any) => o.value)).not.toContain("__halaman-ini");
    kerjakan(h).click();
    await sampai(() => /Pilih blangko/.test(bagian(h).querySelector(".aleta-abt-kabar").textContent), "kabar lama");
  });
});

// ============================================================================
describe("butir 13 dan 14: putusan massal ABT", () => {
  const SIDANG = [
    { nomorPerkara: "501/Pdt.G/2026/PA.Dgl", perkaraId: "501", jenisPerkara: "Cerai Gugat", agenda: "Pembuktian", alasanDitunda: "Putus", majelisNama: "Dra. Munifa, S.H., Mohammad Syukri, S.H." },
    { nomorPerkara: "502/Pdt.G/2026/PA.Dgl", perkaraId: "502", jenisPerkara: "Cerai Gugat", agenda: "Kesimpulan", alasanDitunda: "Ditunda untuk musyawarah majelis", majelisNama: "Mohammad Syukri, S.H., Dra. Munifa, S.H." },
    { nomorPerkara: "503/Pdt.G/2026/PA.Dgl", perkaraId: "503", jenisPerkara: "Cerai Talak", agenda: "Pembacaan putusan", alasanDitunda: "Panggil Termohon", majelisNama: "Mohammad Syukri, S.H." },
    { nomorPerkara: "504/Pdt.G/2026/PA.Dgl", perkaraId: "504", jenisPerkara: "Cerai Talak", agenda: "Pembacaan Putusan", alasanDitunda: "", majelisNama: "Mohammad Syukri, S.H." },
    { nomorPerkara: "505/Pdt.G/2026/PA.Dgl", perkaraId: "505", jenisPerkara: "Cerai Gugat", agenda: "Pembuktian", alasanDitunda: "Pembuktian saksi", majelisNama: "Hasanuddin, S.H.I., M.H." },
  ].map((s) => ({ ...s, sudahPutus: false, ditunda: Boolean(s.alasanDitunda), sidangIkrarTalak: false }));
  const sidang: Pengganti = (url) => (url.includes("/aleta-ecourt/sidang?") ? { isi: { data: { available: true, sidang: SIDANG } } } : undefined);
  const baris = (h: Halaman) =>
    Array.from(massalDari(h)?.querySelectorAll(".aleta-massal-daftar .aleta-massal-baris:not(.aleta-a1-kelompok-semua)") || []).map(
      (l: any) => l.querySelector(".aleta-massal-nomor").textContent.slice(0, 3)
    );
  const siapDaftar = (h: Halaman) => sampai(() => baris(h).length > 0, "daftar putusan massal");

  it("UI Baru (Super Admin): bawaan hanya putus / tunda untuk putusan - dikelompokkan per hakim ketua, centang 'kerjakan semua milik X'", async () => {
    const h = buka({ beranda: true, simpanan: ui([]), ganti: sidang });
    await siapDaftar(h);
    // Urutan bawaan "agenda putusan dahulu" berlaku DI DALAM tiap kelompok.
    expect(baris(h)).toEqual(["501", "504", "502"]);
    const kelompok = Array.from(massalDari(h).querySelectorAll(".aleta-a1-kelompok")) as any[];
    expect(kelompok.map((g) => g.getAttribute("data-a1-pengguna"))).toEqual(["munifa", "mohammad syukri"]);
    const syukri = kelompok[1];
    expect(Array.from(syukri.querySelectorAll(".aleta-massal-baris:not(.aleta-a1-kelompok-semua) .aleta-massal-nomor")).map((x: any) => x.textContent.slice(0, 3))).toEqual(["504", "502"]);
    const semua = syukri.querySelector(".aleta-a1-kelompok-semua input");
    semua.checked = true;
    semua.dispatchEvent(new h.w.Event("change"));
    expect(massalDari(h).querySelector(".aleta-massal-ringkas").textContent).toBe("3 dari 5 tampil · 2 dicentang");
    // "Semua perkara" tetap ada - tidak ada yang dihapus.
    const saring = massalDari(h).querySelector(".aleta-massal-saring");
    saring.value = "semua";
    saring.dispatchEvent(new h.w.Event("change"));
    expect(baris(h)).toHaveLength(5);
  });

  it("UI Baru (hakim): 'Hanya majelis saya' menyala sendiri bila namanya terbaca; tanpa pengelompokan", async () => {
    const h = buka({ beranda: true, simpanan: ui([]), ganti: sidang, peran: "Hakim", nama: "Dra. Hj. MUNIFA, S.H." });
    await siapDaftar(h);
    expect(baris(h)).toEqual(["501", "502"]);
    expect(massalDari(h).querySelector(".aleta-a1-kelompok")).toBeNull();
    const milik = massalDari(h).querySelector(".aleta-a1-milik input");
    milik.checked = false;
    milik.dispatchEvent(new h.w.Event("change"));
    expect(baris(h)).toEqual(["504", "501", "502"]);
  });

  it("Baru: daftar datar seluruh perkara bersidang seperti 1.176.0", async () => {
    const h = buka({ beranda: true, simpanan: baru([]), ganti: sidang });
    await siapDaftar(h);
    expect(baris(h)).toHaveLength(5);
    expect(massalDari(h).querySelector(".aleta-a1-kelompok, .aleta-a1-milik")).toBeNull();
    expect(Array.from(massalDari(h).querySelector(".aleta-massal-saring").options).map((o: any) => o.value)).not.toContain("layak");
  });

  it("aturan murni: keterangan menentukan, agenda hanya bila keterangan kosong; ketua majelis tidak terpotong gelarnya", async () => {
    const h = buka({ beranda: true, simpanan: ui([]), ganti: sidang });
    await siapDaftar(h);
    const { a1PutusanLayak, a1KetuaMajelis } = h.w.__a1;
    expect(a1PutusanLayak({ alasanDitunda: "Ditunda untuk pembacaan putusan", agenda: "x" }, "2026-10-01")).toBe(true);
    expect(a1PutusanLayak({ alasanDitunda: "Belum putus, panggil ulang", agenda: "Putusan" }, "2026-10-01")).toBe(false);
    expect(a1PutusanLayak({ alasanDitunda: "0", agenda: "Musyawarah Majelis" }, "2026-10-01")).toBe(true);
    expect(a1PutusanLayak({ sudahPutus: true, tanggalPutusan: "2026-10-01", alasanDitunda: "" }, "2026-10-01")).toBe(true);
    expect(a1KetuaMajelis("Hasanuddin, S.H.I., M.H., Dra. Munifa, S.H.")).toBe("Hasanuddin, S.H.I., M.H.");
    expect(a1KetuaMajelis("")).toBe("");
  });
});

// ============================================================================
describe("butir 15: susun keterangan saksi - ⓘ menggantikan label, ⟳ ganti keterangan, ↶ ↷", () => {
  const susun = async (h: Halaman) => {
    await siapPeran(h);
    return sampai(() => q(h, ".aleta-sdg-hasil .aleta-sdg-baris"), "penyunting saksi tersusun sendiri");
  };
  const barisSaksi = (h: Halaman, kolom: number, i: number) => q(h, ".aleta-sdg-hasil").querySelectorAll(".aleta-sdg-kolom")[kolom].querySelectorAll(".aleta-sdg-baris")[i];
  const kosongSaksi = { "2021": "DATA_TIDAK_ADA", "2022": "DATA_TIDAK_ADA" };

  it("UI Baru: 'sama persis' / 'beda dengan' / 'varian habis' tidak tampil; isinya di ⓘ", async () => {
    const h = buka({ simpanan: ui([]), peran: "Panitera Pengganti", isi: kosongSaksi });
    await susun(h);
    const b2 = barisSaksi(h, 0, 1);
    const info = await sampai(() => (b2.querySelector(".aleta-a1-sdg-info")?.getAttribute("data-a1-catatan") === "sama" ? b2.querySelector(".aleta-a1-sdg-info") : null), "ⓘ sama");
    expect(tampak(b2.querySelector(".aleta-t6-lencana-sama"))).toBe(false);
    expect(tampak(b2.querySelector(".aleta-sdg-varian-habis"))).toBe(false);
    const isi = b2.querySelector(".aleta-a1-sdg-info-isi");
    expect(tampak(isi)).toBe(false);
    info.click();
    expect(tampak(isi)).toBe(true);
    expect(isi.textContent).toContain("Sama persis dengan Saksi 2 P");
    expect(isi.textContent).toContain("Ganti keterangan habis");
    expect(isi.textContent).not.toMatch(/varian/i);
    const b1 = barisSaksi(h, 0, 0);
    await sampai(() => b1.querySelector(".aleta-a1-sdg-info")?.getAttribute("data-a1-catatan") === "beda", "ⓘ beda");
    expect(tampak(b1.querySelector(".aleta-t6-beda"))).toBe(false);
    expect(b1.querySelector(".aleta-a1-sdg-info-isi").textContent).toBe("Beda dengan Saksi 2 P: paman");
    // Tidak ada label yang tampak di baris mana pun.
    for (const el of qs(h, ".aleta-t6-lencana-sama, .aleta-sdg-varian-habis, .aleta-t6-varian-ket, .aleta-sdg-baris > .aleta-t6-beda")) expect(tampak(el)).toBe(false);
  });

  it("⟳ mengganti ke alternatif, ↶ mengurungkan, ↷ mengulangi - lewat peristiwa input (data penyunting ikut)", async () => {
    const h = buka({ simpanan: ui([]), peran: "Panitera Pengganti", isi: kosongSaksi });
    await susun(h);
    const b2 = barisSaksi(h, 0, 1);
    const ganti = await sampai(() => b2.querySelector(".aleta-a1-ganti"), "tombol ganti");
    const jawab = b2.querySelector("textarea");
    const asal = jawab.value;
    const varian = h.w.__a1.t6VarianKalimat(asal);
    expect(varian.length).toBeGreaterThan(0);
    const urung = b2.querySelector(".aleta-a1-urung");
    const ulang = b2.querySelector(".aleta-a1-ulang");
    expect(urung.disabled).toBe(true);
    let masukan = 0;
    jawab.addEventListener("input", () => (masukan += 1));
    ganti.click();
    expect(jawab.value).toBe(varian[0]);
    expect(masukan).toBe(1);
    expect(urung.disabled).toBe(false);
    ganti.click();
    expect(jawab.value).toBe(varian[1] ?? asal);
    urung.click();
    expect(jawab.value).toBe(varian[0]);
    urung.click();
    expect(jawab.value).toBe(asal);
    expect(urung.disabled).toBe(true);
    ulang.click();
    expect(jawab.value).toBe(varian[0]);
    // Bunyinya kini berbeda dari Saksi 2 P - ⓘ tidak lagi "sama".
    await sampai(() => b2.querySelector(".aleta-a1-sdg-info").getAttribute("data-a1-catatan") !== "sama", "ⓘ mengikuti");
  });

  it("Baru: label lama tetap tampil, tanpa ⓘ/⟳ 1 Okt", async () => {
    const h = buka({ simpanan: baru(["abt-7"]), peran: "Panitera Pengganti", isi: kosongSaksi });
    await susun(h);
    const b2 = barisSaksi(h, 0, 1);
    await sampai(() => b2.querySelector(".aleta-t6-lencana-sama"), "lencana sama");
    expect(tampak(b2.querySelector(".aleta-t6-lencana-sama"))).toBe(true);
    expect(tampak(b2.querySelector(".aleta-sdg-varian-habis"))).toBe(true);
    expect(q(h, ".aleta-a1-sdg-deret")).toBeNull();
  });
});

// ============================================================================
describe("butir 16 dan butir 1: bagian per peran, lipat seragam", () => {
  const sudahInput = { abtInputSelesai: { "10018": 1 } };

  it("pita error putusan: tampak bagi hakim, tidak bagi panitera pengganti dan juru sita (UI Baru)", async () => {
    const hakim = buka({ simpanan: ui([], sudahInput), peran: "Hakim" });
    await selesaiIsi(hakim);
    const p = await sampai(() => (q(hakim, ".aleta-t6-pita-bahaya:not([hidden])") ? q(hakim, ".aleta-t6-pita-bahaya") : null), "pita hakim");
    expect(tampak(p)).toBe(true);
    for (const peran of ["Panitera Pengganti", "Jurusita"]) {
      const h = buka({ simpanan: ui([], sudahInput), peran });
      await siapPeran(h);
      await sampai(() => q(h, ".aleta-t6-pita-bahaya:not([hidden])"), `pita ${peran} dihitung`);
      await sampai(() => !tampak(q(h, ".aleta-t6-pita-bahaya")), `pita ${peran} tersembunyi`);
    }
  });

  it("Baru: pita error tetap tampak bagi panitera pengganti (perilaku 1.176.0)", async () => {
    const h = buka({ simpanan: baru(["abt-5"]), peran: "Panitera Pengganti" });
    await siapPeran(h);
    const p = await sampai(() => q(h, ".aleta-t6-pita-bahaya:not([hidden])"), "pita");
    await tunggu(150);
    expect(tampak(p)).toBe(true);
  });

  it("bentuk lipat seragam (alatJadikanLipat agen W): bagian kerja, unggah, dan alasan berkepala lipat dan berkunci; yang di luar menu peran tetap tersembunyi", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim" });
    await selesaiIsi(h);
    const alasan = await sampai(() => (q(h, ".aleta-sore-alasan.aleta-lipatan") ? q(h, ".aleta-sore-alasan") : null), "kartu alasan dilipat");
    const kunci = (el: any) => el.getAttribute("data-kunci");
    const isi = q(h, '[data-sore-kerja="isi"]');
    const susun = q(h, '[data-sore-kerja="susun"]');
    const unggah = q(h, ".aleta-abt-bagian");
    for (const [el, k] of [[isi, "abt:isi-input"], [susun, "abt:susun-saksi"], [unggah, "abt:unggah-putusan"], [alasan, "abt:alasan"]] as const) {
      expect(el.classList.contains("aleta-lipatan"), k).toBe(true);
      expect(kunci(el), k).toBe(k);
      expect(el.querySelector(":scope > .aleta-lipat-kepala"), k).not.toBeNull();
    }
    // Tombol di kepala (Baca ulang) tetap tombolnya sendiri - tidak melipat.
    isi.querySelector(".aleta-sore-jalankan").click();
    expect(isi.getAttribute("data-terbuka")).toBe("ya");
    // Kepala melipat; ingatannya per kunci.
    isi.querySelector(":scope > .aleta-lipat-kepala").click();
    expect(isi.getAttribute("data-terbuka")).toBe("tidak");
    await sampai(() => (h.simpanan.lipatTerbuka as any)?.["abt:isi-input"] === false, "ingatan lipat");
    // Hakim: susun saksi bukan menunya - tetap tersembunyi walau berkepala lipat.
    expect(tampak(susun)).toBe(false);
    expect(tampak(unggah)).toBe(true);
  });

  it("beranda ABT (UI Baru): Pemetaan blangko dan Putusan massal berbentuk lipat yang sama; Baru tidak", async () => {
    const h = buka({ beranda: true, simpanan: ui([]) });
    await sampai(() => massalDari(h)?.querySelectorAll(".aleta-isi > .aleta-bagian.aleta-lipatan").length === 2, "dua bagian beranda dilipat");
    expect(Array.from(massalDari(h).querySelectorAll(".aleta-isi > .aleta-bagian")).map((el: any) => el.getAttribute("data-kunci"))).toEqual([
      "abt-beranda:pemetaan-blangko-putusan",
      "abt-beranda:putusan-massal",
    ]);
    const b = buka({ beranda: true, simpanan: baru([]) });
    await sampai(() => massalDari(b)?.getAttribute("data-sore-golongan"), "beranda Baru tertata");
    await tunggu(100);
    expect(massalDari(b).querySelector(".aleta-lipatan")).toBeNull();
  });

  it("Baru: bagian panel perkara tidak diberi bentuk lipat 1 Okt", async () => {
    const h = buka({ simpanan: baru([]), peran: "Hakim" });
    await selesaiIsi(h);
    await tunggu(150);
    expect(q(h, ".aleta-lipatan")).toBeNull();
  });
});

// ============================================================================
describe("CSS blok A1", () => {
  it("seluruh aturan berada di antara penandanya dan berawalan html[data-aleta-kulit=\"modern\"]", () => {
    const css = baca("panel.css");
    const mulai = css.indexOf("/* === A1 - PERBAIKAN 1 OKT === */");
    const akhir = css.indexOf("/* === AKHIR A1 === */");
    expect(mulai).toBeGreaterThan(0);
    expect(akhir).toBeGreaterThan(mulai);
    expect(css.slice(0, mulai)).not.toMatch(/aleta-a1-/);
    const blok = css.slice(css.indexOf("*/", mulai) + 2, akhir).replace(/\/\*[\s\S]*?\*\//g, "");
    let dihitung = 0;
    for (const aturan of blok.split("}")) {
      if (!aturan.includes("{")) continue;
      dihitung += 1;
      for (const b of aturan.split("{")[0].split(",")) expect(b.trim(), b).toMatch(/^html\[data-aleta-kulit="modern"\] /);
    }
    expect(dihitung).toBeGreaterThan(20);
  });
});
