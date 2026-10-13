// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PANEL ABT: "ISI DARI POSITA PERMOHONAN" UNTUK PERKARA LAIN, DAN ITSBAT
 * ============================================================================
 *
 * panel-alat.js dan abt.js dimuat SUNGGUHAN ke halaman blangko jsdom, dan
 * permintaan /abt/usulan dijawab penangan rute bot SUNGGUHAN (dipotong dari
 * internalGatewayRoutes.js, dijalankan di node:vm bersama layanan aslinya).
 *
 * Yang dijaga:
 *   1. tombol perkara lain hanya tergambar pada blangko yang memuat variabel
 *      siap MILIK JENIS PERKARANYA (0048) - variabel blangko di bawah BUKAN
 *      karangan, dibaca dari RTF blangko ABT satker (sama dengan
 *      ekstensi-tombol-saksi-blangko.test.ts). 5178 juga ada di blangko
 *      itsbat, perwalian, asal usul, dan harta bersama; di sana tidak;
 *   2. cermin variabel siap di abt.js = abtUsulanLainService.VARIABEL_SIAP;
 *   2a. kabar hanya menyebut variabel yang ADA di blangko yang dibuka, dan
 *      bawaan ABT disebut sebagai TAWARAN yang wajib diperiksa - bukan
 *      "diisi otomatis";
 *   3. muatannya membawa sumber 'posita-lain', id jenis perkara SIPP, dan
 *      alur; usulannya diterapkan lewat "Terapkan yang dicentang" yang sama -
 *      berurutan, satu edit_data dalam satu waktu, tanpa jeda tiruan (jeda
 *      'antar-variabel-abt' dibatalkan keputusan 25 September 2026, sama
 *      dengan t1-ekstensi-abt-tulis);
 *   4. itsbat mengirim sebutan pemohon (0046), sehingga labelnya "Status
 *      Pemohon sebelum nikah" - dahulu "Status Termohon".
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const SUMBER_ALAT = readFileSync(process.env.ALETA_UJI_PANEL_ALAT || path.join(AKAR, "panel-alat.js"), "utf8");
const SUMBER_ABT = readFileSync(process.env.ALETA_UJI_ABT || path.join(AKAR, "abt.js"), "utf8");

const BERKAS_RUTE = path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js");
const require_ = createRequire(BERKAS_RUTE);
let penanganBot: (body: unknown) => Promise<{ status: number; json: any }>;

beforeAll(() => {
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
  const awal = isi.lastIndexOf("\n// ====", tanda);
  const akhir = isi.indexOf('router.post("/abt/pdf"');
  if (!(tanda > 0 && awal > 0 && akhir > tanda)) throw new Error("Potongan rute /abt/usulan tidak ditemukan.");
  const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
  const konteks = vm.createContext({
    require: (p: string) => require_(p),
    abtUsulanService: require_("../services/abtUsulanService"),
    requireInternalToken: () => undefined,
    router: { post: (jalur: string, _p: unknown, f: (req: unknown, res: unknown) => Promise<void>) => void (rute[jalur] = f) },
    console,
  });
  vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#abt-usulan" });
  const f = rute["/abt/usulan"];
  penanganBot = async (body) => {
    let status = 200;
    let json: any = null;
    await f({ body: JSON.parse(JSON.stringify(body)) }, { status: (s: number) => ((status = s), { json: (j: any) => void (json = j) }), json: (j: any) => void (json = j) });
    return { status, json };
  };
});

/** [folder, blangko, variabel yang tergambar] - dari RTF blangko satker. */
const BLANGKO: Array<[string, string, string]> = [
  ["1 Perceraian CG", "[01] [Kabul Verstek] Cerai (Format Lengkap)", "0001 8010 0194 7060 7047 7048 0046 0053 0017 8008 0306 5125 4001 0139 8507 8508 8509 8510 0690 0047 1214 0222 5227 0246 9944 7035 1268 8503 4020 0661 0663 0227 0132 0156 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 8526 8523 8524 8529 8528 8521 8522 8530 8527 8505 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 0281 6060 0312 5223 0143"],
  ["2 Itsbat Nikah", "[01] [Kabul] IN", "0001 8010 0048 7047 0046 0053 0017 8008 0306 5125 0194 1359 6032 0690 0364 0366 5197 5105 5178 7211 7212 1002 1003 1046 1217 8087 0650 0651 1001 1358 0007 7082 0033 9958 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 1242 8185 0098 1033 8505 0155 7095 8501 0032 8184 8502 8500 8004 0279 6063 0281 6060 0312 5223 0143"],
  ["3 Dispensasi Kawin", "[01] [Kabul] DK - (Anak P Cewek) Hamil", "0001 5135 8010 0048 0098 0335 0341 0345 0099 0011 0021 0100 0101 0046 1033 0336 0342 0346 1034 0010 1176 1035 1036 0053 0017 8008 0306 5125 0606 0600 1666 0999 0607 5178 2030 2029 0609 6331 0601 1551 1552 9956 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 1242 0349 8812 0997 0143 0155 7095 8501 0032 0033 8184 8502 8500 8004 0279 6063 0281 6060 0312 5223"],
  ["3 Dispensasi Kawin", "[01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil", "0001 5135 8010 0048 0098 0335 0341 0345 0099 0011 0021 0100 0101 0046 1033 0336 0342 0346 1034 0010 1176 1035 1036 0053 0017 8008 0306 5125 0600 0606 1666 0999 0601 5178 2029 2030 0609 6331 0607 0610 1551 1552 9956 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 1242 0349 8812 0997 0143 0155 7095 8501 0032 0033 8184 8502 8500 0279 6063 0281 6060 8004 0312 5223"],
  ["3 Dispensasi Kawin", "[03] [Tolak] DK - (Anak P Cewek) Belum Hamil", "0001 5135 8010 0048 0098 0335 0341 0345 0099 0011 0021 0100 0101 0046 1033 0336 0342 0346 1034 0010 1176 1035 1036 0053 0017 8008 0306 5125 0690 0606 0600 1666 0607 5178 2030 2029 0609 6331 0601 0999 1551 1552 9956 1197 1198 1199 1200 1201 1202 1241 1203 1204 1205 1206 1207 1208 1242 0349 8812 0997 0143 0155 7095 8501 0032 0033 8184 8502 8500 0279 6063 0281 6060 0312 5223"],
  ["3 Dispensasi Kawin", "[98] [Cabut] DK", "0001 5135 8010 0048 0098 0335 0341 0345 0099 0011 0021 0100 0101 0046 1033 0336 0342 0346 1034 0010 1176 1035 1036 0053 0017 8008 0306 5125 0606 0600 0690 8505 0155 7095 0032 0033 8184 0012 0015 6034 8500 0279 6063 0281 6060 0312 5223 0143 8004"],
  ["4 Kebendaan", "[00] [E-Court] HB Kabul", "0001 8010 0048 7047 7048 0053 0046 0017 8008 0306 5125 0690 1359 1064 8507 0047 8509 8510 0106 0156 0109 0370 0184 0197 0111 0170 0157 0173 0372 0185 0198 0112 8017 0056 8012 0058 9881 7111 8534 7112 7113 7114 0218 2111 9955 9951 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 2112 9911 9952 6100 6101 6102 6103 6104 6105 1251 2023 6106 6107 6108 6109 6110 6111 1252 2024 8438 5216 0225 0226 0219 5032 5197 0888 0889 1321 8501 0032 0033 8184 8502 8500 8004 0279 6063 0281 6060 0312 0242 0244 5223 0143 0155"],
  ["6 Perwalian", "Perwalian Anak oleh ortu kandung Kabul", "5368 0001 0048 7047 0046 0053 0017 8008 0306 5125 1359 0690 5114 5115 0709 0098 1025 0101 0712 6331 8131 1197 1198 1199 1200 1201 1202 1241 2025 5197 5105 0007 8513 8514 1282 1230 1203 1204 1205 1206 1207 1208 1242 8171 1069 5110 8506 2224 5178 5116 0047 2026 8515 8505 0155 7095 8501 0033 8184 8502 8004 0279 6060 6074 0312 0281 5223 0143"],
  ["- BAS ASAL USUL ANAK -", "[01a] BAS 1 Asal Usul Anak - Kabul", "0364 0366 5197 5105 5178 7211 7212 1002 1003 1046 1217 8087 0650 0651 1001 1358 0007 0001 9003 8008 0048 5174 0032 0033 7047 7046 0015 6034 4004 0046 0141 0690 0053 0017 1061 9958 1197 1198 1199 1200 1201 1202 7029 5058 1203"],
];

/** Jenis perkara (isi 0048 di halaman) menurut folder blangkonya - nama SIPP. */
const JENIS_FOLDER: Record<string, string> = {
  "1 Perceraian CG": "Cerai Gugat",
  "2 Itsbat Nikah": "Pengesahan Perkawinan/Istbat Nikah",
  "3 Dispensasi Kawin": "Dispensasi Kawin",
  "4 Kebendaan": "Harta Bersama",
  "6 Perwalian": "Perwalian",
  "- BAS ASAL USUL ANAK -": "Asal Usul Anak",
};
const SIAP_BOT = require_("../services/abtUsulanLainService").VARIABEL_SIAP as Record<string, string[]>;
const KUNCI_FOLDER: Record<string, string | null> = {
  "1 Perceraian CG": null,
  "2 Itsbat Nikah": null,
  "3 Dispensasi Kawin": "dispensasi-kawin",
  "4 Kebendaan": "harta-bersama",
  "6 Perwalian": "perwalian",
  "- BAS ASAL USUL ANAK -": "asal-usul",
};
/** Tombol perkara lain semestinya tampak: blangko memuat variabel siap milik jenisnya. */
const semestinyaTampak = (folder: string, kode: string[]) => {
  const kunci = KUNCI_FOLDER[folder];
  return Boolean(kunci) && (SIAP_BOT[kunci as string] || []).some((v) => kode.includes(v));
};

// Posita berbentuk templat PA Donggala, disamarkan (sama dengan
// abt-usulan-rute-sumber-cerita.test.ts): nama 'Xxxa', KUA/kecamatan 'Aaaa'.
const POSITA_DK = [
  "Bahwa para Pemohon telah menikah pada tanggal 26 September 2004 di Kantor Urusan Agama Kecamatan Aaaa, Kabupaten Bbbb, dan pernikahan tersebut telah dikaruniai 2 (dua) orang anak yang masing-masing bernama :",
  "Xxxa Yyya binti Zzza, umur 16 tahun",
  "Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Xxxa Yyya binti Zzza (calon mempelai wanita) dengan seorang laki-laki yang bernama Muh. Xxxb bin Zzzb (calon mempelai laki-laki), umur 21 tahun;",
  "Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Cccc, Kabupaten Dddd, guna mencatatkan pernikahan anak para Pemohon tersebut, namun ditolak dengan alasan belum cukup umur;",
].join("\n");
const POSITA_ITSBAT =
  "Bahwa pada tanggal 07 Mei 2017 telah terjadi pernikahan antara Pemohon dengan Xxxa bin Yyya di Desa Aaaa Kecamatan Bbbb;";

const halamanTerbuka: JSDOM[] = [];
afterEach(async () => {
  while (halamanTerbuka.length) {
    const dom = halamanTerbuka.pop()!;
    for (let i = 0; i < 100 && !dom.window.document.getElementById("aleta-panel-abt"); i += 1) {
      await new Promise((s) => setTimeout(s, 10));
    }
    await new Promise((s) => setTimeout(s, 30));
    dom.window.close();
  }
});

const r = (status: number, badan: string) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => badan,
  json: async () => JSON.parse(badan),
  clone() {
    return this;
  },
});

function jaringan() {
  const c = { usulan: [] as any[], jawabanBot: [] as any[], editData: [] as Array<{ noVar: string; nilai: string; mulai: number; selesai: number }>, terbangMaks: 0 };
  let terbang = 0;
  const fetch = async (alamat: string, o: any = {}) => {
    const a = String(alamat);
    if (a.includes("/edit_data?")) {
      if (o.method !== "POST") return r(200, '<input type="hidden" name="var_type" value="data_teks">');
      terbang += 1;
      c.terbangMaks = Math.max(c.terbangMaks, terbang);
      const mulai = Date.now();
      await new Promise((s) => setTimeout(s, 15));
      terbang -= 1;
      c.editData.push({
        noVar: String(new URL(a).searchParams.get("no_var")),
        nilai: String(new URLSearchParams(String(o.body || "")).get("value")),
        mulai,
        selesai: Date.now(),
      });
      return r(200, "<b>DATA DISIMPAN</b>");
    }
    if (a.endsWith("/aleta/api/aleta-bot/abt/usulan")) {
      const muatan = JSON.parse(String(o.body || "{}"));
      if (muatan.sumber === "siapa" || muatan.sumber === "sipp") return r(401, "{}");
      c.usulan.push(muatan);
      const bot = await penanganBot(muatan);
      c.jawabanBot.push(bot.json);
      return r(200, JSON.stringify({ data: { available: true, ...bot.json } }));
    }
    return r(401, "{}");
  };
  return { c, fetch };
}

function bukaBlangko(kode: string[], opsi: { nomor?: string; isi?: Record<string, string>; fetch?: (a: string, o?: any) => Promise<any> } = {}) {
  const isi = opsi.isi || {};
  const baris = kode
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td>` +
        `<td>${k in isi ? isi[k].split("\n").join("<br>") : `isi ${k}`}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','');">edit</a></td></tr>`
    )
    .join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="content">` +
      `<h3 class="w3l_header"><span>${opsi.nomor || "45/Pdt.P/2026/PA.Dgl"}</span></h3><table>${baris}</table></div></div></body></html>`,
    { url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3", runScripts: "outside-only" }
  );
  halamanTerbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  w.chrome = {
    runtime: {
      getManifest: () => ({ version: "uji" }),
      getURL: (p: string) => `chrome-extension://aleta-uji/${p}`,
      sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }),
      lastError: undefined,
    },
    storage: {
      local: {
        get: async (k: string[]) => Object.fromEntries((k || []).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
        set: async (v: Record<string, unknown>) => void Object.assign(simpanan, v),
        remove: async () => {},
      },
      onChanged: { addListener: () => {} },
    },
  };
  w.fetch = opsi.fetch || jaringan().fetch;
  w.console.warn = () => {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  // Disesuaikan 2 Okt (agen A, butir 14): keputusan pengguna 2 Okt MENGEMBALIKAN
  // jeda seperti manusia sebelum tulisan ke ABT (alatJedaManusia, panel-alat.js) -
  // membalik "tanpa jeda tiruan" 26 Sep. Jeda itu dinolkan di sini dan diuji di
  // ekstensi-abt-2okt; uji ini tetap menjaga bahwa TIDAK ADA jeda LAIN.
  // Keduanya "use strict": yang diuji langsung diserahkan lewat __uji.
  w.eval(
    SUMBER_ALAT +
      "\n;\n" +
      SUMBER_ABT +
      "\n;\nwindow.__uji = { VARIABEL_SIAP_POSITA_LAIN, blangkoMemuatVariabelSiapLain, kunciJenisLain, kabarPositaLain, idJenisPerkaraSipp, idAlurPerkaraSipp };" +
      '\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);'
  );
  return w;
}

async function tunggu<T>(cari: () => T | null | undefined | false, pesan: string): Promise<T> {
  for (let i = 0; i < 400; i += 1) {
    const x = cari();
    if (x) return x;
    await new Promise((s) => setTimeout(s, 10));
  }
  throw new Error(`tidak muncul: ${pesan}`);
}
const panelDari = (w: any) => w.document.getElementById("aleta-panel-abt");
const tombolBertulis = (w: any, pola: RegExp) =>
  Array.from(panelDari(w)?.querySelectorAll("button") || []).filter((b: any) => pola.test(b.textContent)) as any[];

describe("cermin variabel siap = abtUsulanLainService.VARIABEL_SIAP", () => {
  it("sama persis, per jenis", () => {
    const w = bukaBlangko(["0001"]);
    const bot = require_("../services/abtUsulanLainService").VARIABEL_SIAP;
    expect(JSON.parse(JSON.stringify(w.__uji.VARIABEL_SIAP_POSITA_LAIN))).toEqual(JSON.parse(JSON.stringify(bot)));
  });
});

describe("tombol 'Isi dari posita permohonan' perkara lain - hanya pada blangko bervariabel siap", () => {
  it("fixture memuat DK, cerai, itsbat, HB, perwalian, dan asal usul; tidak lebih dari 40", () => {
    expect(BLANGKO.length).toBeLessThanOrEqual(40);
  });

  for (const [folder, blangko, daftar] of BLANGKO) {
    const kode = daftar.split(" ");
    const siap = semestinyaTampak(folder, kode);
    const itsbat = kode.includes("5197") || kode.includes("8087");
    it(`${siap ? "TAMPAK" : "tersembunyi"} - ${folder} / ${blangko}`, async () => {
      const w = bukaBlangko(kode, { isi: { "0048": JENIS_FOLDER[folder] } });
      await tunggu(() => panelDari(w), "panel");
      const tombol = tombolBertulis(w, /^Isi dari posita permohonan/);
      // Tombol itsbat dan tombol perkara lain: keduanya ada di panel, masing-
      // masing tampak hanya pada blangkonya.
      expect(tombol).toHaveLength(2);
      const tampak = tombol.filter((t) => !t.hidden);
      expect(tampak).toHaveLength(Number(siap) + Number(itsbat));
      const peta = new Map(kode.map((k) => [k, {}]));
      expect(w.__uji.blangkoMemuatVariabelSiapLain(peta, w.__uji.kunciJenisLain(JENIS_FOLDER[folder]))).toBe(siap);
    });
  }

  it("jumlah: 4 blangko DK tampak, 5 blangko lain tersembunyi", () => {
    const hasil = BLANGKO.map(([folder, , d]) => semestinyaTampak(folder, d.split(" ")));
    expect(hasil.filter(Boolean)).toHaveLength(4);
    expect(hasil.filter((x) => !x)).toHaveLength(5);
  });

  it("GIGITAN: 5178 (siap untuk DK) di blangko itsbat, perwalian, dan asal usul TIDAK memunculkan tombol perkara lain", async () => {
    const ber5178 = BLANGKO.filter(([folder, , d]) => folder !== "3 Dispensasi Kawin" && d.split(" ").includes("5178"));
    expect(ber5178.map(([f]) => f).sort()).toEqual(["- BAS ASAL USUL ANAK -", "2 Itsbat Nikah", "6 Perwalian"].sort());
    for (const [folder, , d] of ber5178) {
      const w = bukaBlangko(d.split(" "), { isi: { "0048": JENIS_FOLDER[folder] } });
      await tunggu(() => panelDari(w), "panel");
      const lainTampak = tombolBertulis(w, /^Isi dari posita permohonan/).filter((t) => !t.hidden);
      // Yang tampak hanya tombol itsbat (#5197#), satu.
      expect(lainTampak, folder).toHaveLength(1);
      expect(w.__uji.blangkoMemuatVariabelSiapLain(new Map(d.split(" ").map((k) => [k, {}])), w.__uji.kunciJenisLain(JENIS_FOLDER[folder]))).toBe(false);
    }
  });

  it("jenis perkara tidak terbaca (0048 kosong, daftar sidang tidak kenal): tombol perkara lain tersembunyi", async () => {
    const DK = BLANGKO.find((b) => b[1] === "[01] [Kabul] DK - (Anak P Cewek) Hamil")!;
    const w = bukaBlangko(DK[2].split(" "), { isi: { "0048": "" } });
    await tunggu(() => panelDari(w), "panel");
    expect(tombolBertulis(w, /^Isi dari posita permohonan/).filter((t) => !t.hidden)).toHaveLength(0);
    expect(w.__uji.kunciJenisLain("")).toBeNull();
    expect(w.__uji.kunciJenisLain("Cerai Gugat")).toBeNull();
    expect(w.__uji.kunciJenisLain("362")).toBe("dispensasi-kawin");
    expect(w.__uji.kunciJenisLain("Asal Usul Anak")).toBe("asal-usul");
    expect(w.__uji.kunciJenisLain("harta-bersama")).toBe("harta-bersama");
  });
});

describe("posita-lain lewat panel dan bot sungguhan", () => {
  const DK = BLANGKO.find((b) => b[1] === "[01] [Kabul] DK - (Anak P Cewek) Hamil")!;

  async function tekanPositaLain() {
    const j = jaringan();
    const w = bukaBlangko(DK[2].split(" "), {
      nomor: "45/Pdt.P/2026/PA.Dgl",
      isi: { "5125": POSITA_DK, "0048": "Dispensasi Kawin", "0046": "Pemohon" },
      fetch: j.fetch,
    });
    const tombol = await tunggu(() => tombolBertulis(w, /^Isi dari posita permohonan/).find((t) => !t.hidden), "tombol posita lain");
    tombol.click();
    await tunggu(() => panelDari(w).querySelector(".aleta-abt-kartu"), "kartu usulan");
    return { w, j };
  }

  it("muatan: sumber posita-lain, id jenis 362, alur 16; usulan hanya variabel siap, yang belum disebut", async () => {
    const { w, j } = await tekanPositaLain();
    expect(j.c.usulan[0]).toMatchObject({ sumber: "posita-lain", jenisPerkara: "362", alur: "16", pemohon: "Pemohon" });
    expect(j.c.usulan[0].posita).toContain("Xxxa Yyya binti Zzza");
    const hasil = j.c.jawabanBot[0].positaLain;
    expect(hasil.ok).toBe(true);
    expect(hasil.jenis).toBe("dispensasi-kawin");
    const kode = (Array.from(panelDari(w).querySelectorAll(".aleta-abt-kartu .aleta-abt-kode")) as any[]).map((x) => x.textContent);
    expect(kode.sort()).toEqual(hasil.usulan.map((u: any) => u.kode).filter((k: string) => DK[2].split(" ").includes(k)).sort());
    for (const k of kode) expect(SIAP_BOT["dispensasi-kawin"]).toContain(k);
    // Lencananya menyebut sumbernya - posita - bukan "satu saksi".
    const lencana = (Array.from(panelDari(w).querySelectorAll(".aleta-abt-kartu-kepala .aleta-tanda")) as any[]).map((x) => x.textContent);
    expect(lencana.length).toBe(kode.length);
    for (const l of lencana) expect(l).toBe("dari posita");
    const kabar = String(panelDari(w).querySelector(".aleta-abt-kabar").textContent);
    for (const b of hasil.belumSiap) expect(kabar).toContain(`${b.kode} (${b.alasan})`);
    // 5178 (KUA yang menolak): ALETA terukur lebih tepat dari bawaan #10103#
    // pada perkara yang sama - kartunya ada, dan tidak ada "diisi otomatis".
    expect(DK[2].split(" ")).toContain("5178");
    expect(hasil.bawaanAbt).toEqual([]);
    expect(kode).toContain("5178");
    expect(hasil.usulan.find((u: any) => u.kode === "5178")?.nilai).toBe("Kantor Urusan Agama Kecamatan Cccc, Kabupaten Dddd");
    expect(kabar).not.toMatch(/otomatis/i);
  });

  it("GIGITAN: blangko [98] Cabut DK (0606/0600 saja) - kabar tidak menyebut variabel yang tidak ada di blangko itu", async () => {
    const CABUT = BLANGKO.find((b) => b[1] === "[98] [Cabut] DK")!;
    const kodeCabut = CABUT[2].split(" ");
    for (const k of ["5178", "1666", "1551", "0999"]) expect(kodeCabut).not.toContain(k);
    const j = jaringan();
    const w = bukaBlangko(kodeCabut, { isi: { "5125": POSITA_DK, "0048": "Dispensasi Kawin", "0046": "Pemohon" }, fetch: j.fetch });
    const tombol = await tunggu(() => tombolBertulis(w, /^Isi dari posita permohonan/).find((t) => !t.hidden), "tombol posita lain");
    tombol.click();
    await tunggu(() => panelDari(w).querySelector(".aleta-abt-kartu"), "kartu usulan");
    const hasil = j.c.jawabanBot[0].positaLain;
    // Bot tetap menjawab seluruh aturan DK - penyaringnya di panel.
    expect(hasil.belumSiap.map((b: any) => b.kode)).toEqual(["1666", "1551", "0999"]);
    const kabar = String(panelDari(w).querySelector(".aleta-abt-kabar").textContent);
    for (const k of ["5178", "1666", "1551", "0999"]) expect(kabar).not.toContain(k);
    const kode = (Array.from(panelDari(w).querySelectorAll(".aleta-abt-kartu .aleta-abt-kode")) as any[]).map((x) => x.textContent);
    expect(kode.sort()).toEqual(["0600", "0606"]);
  });

  it("kabar bawaan ABT: TAWARAN yang wajib diperiksa, hanya variabel blangko ini (bot sungguhan, asal usul)", async () => {
    const lain = require_("../services/abtUsulanLainService");
    const hasil = lain.dariPositaLain("Bahwa Pemohon menikah pada tanggal 1 Mei 2010 dengan saksi nikah bernama Xxxc dan Xxxd;", { jenisPerkara: 358 });
    expect(hasil.bawaanAbt.length).toBe(7);
    const w = bukaBlangko(["0001"]);
    const BAS = BLANGKO.find((b) => b[0] === "- BAS ASAL USUL ANAK -")!;
    const kabar = String(w.__uji.kabarPositaLain(hasil, new Map(BAS[2].split(" ").map((k) => [k, {}]))));
    expect(kabar).toMatch(/^ABT menawarkan isian bawaan, tidak diusulkan ALETA - periksa sebelum menyimpan: /);
    for (const b of hasil.bawaanAbt) expect(kabar).toContain(`${b.kode} dari kueri #${b.acuan}#`);
    expect(kabar).not.toMatch(/otomatis/i);
    // Blangko yang hanya memuat 5197: hanya 5197 yang disebut.
    const sempit = String(w.__uji.kabarPositaLain(hasil, new Map([["5197", {}]])));
    expect(sempit).toBe("ABT menawarkan isian bawaan, tidak diusulkan ALETA - periksa sebelum menyimpan: 5197 dari kueri #10101#.");
    // Tidak satu pun ada di blangko: kabar kosong, bukan daftar yang menyesatkan.
    expect(w.__uji.kabarPositaLain(hasil, new Map([["0001", {}]]))).toBe("");
  });

  it("Terapkan yang dicentang: berurutan, satu edit_data dalam satu waktu, tanpa jeda tiruan", async () => {
    const { w, j } = await tekanPositaLain();
    const dicentang = (Array.from(panelDari(w).querySelectorAll(".aleta-abt-kartu .aleta-abt-centang")) as any[]).filter((c) => c.checked).length;
    expect(dicentang).toBeGreaterThanOrEqual(2);
    tombolBertulis(w, /^Terapkan yang dicentang$/)[0].click();
    await tunggu(() => j.c.editData.length === dicentang && j.c.editData, "edit_data");
    expect(j.c.terbangMaks).toBe(1);
    for (let i = 1; i < j.c.editData.length; i += 1) {
      const selang = j.c.editData[i].mulai - j.c.editData[i - 1].selesai;
      expect(selang).toBeGreaterThanOrEqual(0);
      expect(selang).toBeLessThan(1000);
    }
    expect(j.c.editData.find((x) => x.noVar === "0606")?.nilai).toBe("Xxxa Yyya binti Zzza");
  });

  it("id jenis dan alur dari nama dan nomor perkara", () => {
    const w = bukaBlangko(["0001"]);
    expect(w.__uji.idJenisPerkaraSipp("Pengesahan Perkawinan/Istbat Nikah")).toBe("360");
    expect(w.__uji.idJenisPerkaraSipp("  cerai   gugat ")).toBe("347");
    expect(w.__uji.idJenisPerkaraSipp("Jenis Baru")).toBe("Jenis Baru");
    expect(w.__uji.idAlurPerkaraSipp("1/Pdt.G.S/2025/PA.Dgl")).toBe("17");
    expect(w.__uji.idAlurPerkaraSipp("12/Pdt.G/2026/PA.Dgl")).toBe("15");
    expect(w.__uji.idAlurPerkaraSipp("45/Pdt.P/2026/PA.Dgl")).toBe("16");
  });
});

describe("itsbat: sebutan pemohon (0046) dikirim, label 'Status Pemohon sebelum nikah'", () => {
  it("lewat panel dan bot sungguhan", async () => {
    const IN = BLANGKO.find((b) => b[1] === "[01] [Kabul] IN")!;
    const j = jaringan();
    const w = bukaBlangko(IN[2].split(" "), {
      nomor: "45/Pdt.P/2026/PA.Dgl",
      // Blangko itsbat voluntair: 0047 berbunyi "Termohon" walau tidak ada
      // termohonnya - itulah yang dahulu terpakai sebagai sebutan pemohon.
      isi: { "5125": POSITA_ITSBAT, "0046": "Pemohon", "0047": "Termohon" },
      fetch: j.fetch,
    });
    const tombol = await tunggu(() => tombolBertulis(w, /^Isi dari posita permohonan$/).find((t) => !t.hidden), "tombol itsbat");
    tombol.click();
    await tunggu(() => panelDari(w).querySelector(".aleta-abt-kartu"), "kartu usulan");
    expect(j.c.usulan[0]).toMatchObject({ sumber: "itsbat", pemohon: "Pemohon" });
    const kartuKode = (kode: string) =>
      (Array.from(panelDari(w).querySelectorAll(".aleta-abt-kartu")) as any[]).find((k) => k.querySelector(".aleta-abt-kode")?.textContent === kode);
    expect(kartuKode("7211").querySelector(".aleta-abt-nama").textContent).toBe("Umur Pemohon saat menikah");
    // 26 Sep - 12 Okt 2026: 5178, 5105, 1046, 1002, 0007 diserahkan ke "bawaan ABT" (tanpa kartu). Bawaan itu
    // tidak pernah tersimpan (228/Pdt.P/2026: baris tetap DATA_TIDAK_ADA); sejak ukur ulang 13 Okt semuanya
    // usulan ALETA - kartunya ada, dan kabar tidak lagi menyebut tawaran ABT.
    expect(kartuKode("5105")?.querySelector(".aleta-abt-kode")?.textContent).toBe("5105");
    const kabar = panelDari(w).querySelector(".aleta-abt-kabar").textContent as string;
    expect(kabar).not.toMatch(/ABT menawarkan isian bawaan/);
  });
});
