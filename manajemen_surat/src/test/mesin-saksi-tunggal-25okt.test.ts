// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { FITUR_MESIN_SAKSI_TUNGGAL, KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { KUNCI_FITUR_SATKER } from "@/server/modules/satker/fitur";
import { tulisSetelanSistem } from "@/server/modules/satker/setelan";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI C, C3 (U7): DUA MESIN SAKSI DISATUKAN
 * ============================================================================
 *
 * Saklar Fitur Satker "mesin-saksi-tunggal" (bawaan MATI):
 *   - MATI: tombol "Susun keterangan saksi 1 & 2" persis seperti dulu (bank templat ABT + mesin bot);
 *     borang katalog tanpa alat sunting baris.
 *   - MENYALA: tombol itu memanggil mesin KATALOG yang sama dengan "Susun saksi menurut keadaan perkara";
 *     borang katalog mendapat alat penyunting lama (naik/turun, pindah, salin, hapus, tambah, pertanyaan dapat
 *     disunting) dan tautan "Cara lama" ke bank templat ABT - tidak ada kemampuan lama yang hilang.
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(AKAR, n), "utf8");

// ─── Sisi portal: saklar + rute fitur ───────────────────────────────────────

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => db }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

async function panggilFitur(kode: string) {
  const modul = await import("@/app/api/aleta-ecourt/ekstensi/fitur/route");
  const res = await modul.GET(new NextRequest(`http://localhost/api/x?kode=${encodeURIComponent(kode)}`));
  return { status: res.status, isi: (await res.json()) as { ok: boolean; data: { fitur: Record<string, boolean> } } };
}

describe("saklar mesin-saksi-tunggal di portal", () => {
  it("katalog Fitur Satker: bawaan MATI", () => {
    expect(KATALOG_FITUR_SATKER.find((f) => f.kode === FITUR_MESIN_SAKSI_TUNGGAL)).toMatchObject({ bawaan: "mati" });
    expect(keadaanFitur(FITUR_MESIN_SAKSI_TUNGGAL, {}).menyala).toBe(false);
  });

  it("rute ekstensi/fitur: mati bawaan, menyala setelah Super Admin menyalakan, kode asing false, tanpa masuk 401", async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    try {
      aktor = "usr-super";
      expect((await panggilFitur(`${FITUR_MESIN_SAKSI_TUNGGAL},tidak-ada,jejak-isian`)).isi.data.fitur).toEqual({ [FITUR_MESIN_SAKSI_TUNGGAL]: false, "tidak-ada": false, "jejak-isian": false });
      await tulisSetelanSistem(db, KUNCI_FITUR_SATKER, { fitur: { [FITUR_MESIN_SAKSI_TUNGGAL]: "stabil" }, diubahOleh: "uji", diubahPada: new Date().toISOString() }, new Date().toISOString());
      expect((await panggilFitur(FITUR_MESIN_SAKSI_TUNGGAL)).isi.data.fitur).toEqual({ [FITUR_MESIN_SAKSI_TUNGGAL]: true });
      aktor = "usr-hakim";
      expect((await panggilFitur(FITUR_MESIN_SAKSI_TUNGGAL)).isi.data.fitur[FITUR_MESIN_SAKSI_TUNGGAL]).toBe(true);
      aktor = null;
      expect((await panggilFitur(FITUR_MESIN_SAKSI_TUNGGAL)).status).toBe(401);
    } finally {
      await db?.close();
      db = null;
    }
  });
});

// ─── Sisi ekstensi ──────────────────────────────────────────────────────────

const BERKAS_RUTE = path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js");
let penanganBot: (body: unknown) => Promise<{ status: number; json: any }>;
beforeAll(() => {
  const rq = createRequire(BERKAS_RUTE);
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
  const awal = isi.lastIndexOf("\n// ====", tanda);
  const akhir = isi.indexOf('router.post("/abt/pdf"');
  const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
  const konteks = vm.createContext({
    require: (p: string) => rq(p),
    abtUsulanService: rq("../services/abtUsulanService"),
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

const halaman: JSDOM[] = [];
afterEach(async () => {
  await new Promise((s) => setTimeout(s, 30));
  while (halaman.length) halaman.pop()!.window.close();
});
const tunggu = async <T>(cari: () => T | null | undefined | false, pesan: string, batas = 600): Promise<T> => {
  for (let i = 0; i < batas; i += 1) {
    const x = cari();
    if (x) return x;
    await new Promise((s) => setTimeout(s, 10));
  }
  throw new Error(`menunggu: ${pesan}`);
};
const jeda = (ms: number) => new Promise((s) => setTimeout(s, ms));
const html = (status: number, badan: string) => ({ ok: status >= 200 && status < 300, status, text: async () => badan, json: async () => JSON.parse(badan), clone() { return this; } });

const MENTAH = [
  { urutan_pertanyaan: "1", pertanyaan: "Apakah saksi kenal dengan #0046# dan #0047#?", jawaban: "Ya, saya kenal dengan #0046# dan #0047# karena saya adalah #1241# / #1242#;" },
  { urutan_pertanyaan: "2", pertanyaan: "Apakah saksi tahu hubungan #0046# dan #0047#?", jawaban: "Antara #0046# dan #0047# adalah suami istri yang sah;" },
];
const ganti = (t: string) => t.replace(/#0046#/g, "Penggugat").replace(/#0047#/g, "Tergugat").replace(/#1241#/g, "ibu kandung Penggugat").replace(/#1242#/g, "tetangga Penggugat").replace(/#\d{4}#/g, "xxx");
const TERGANTI = Object.fromEntries(MENTAH.map((b, i) => [String(i), { urutan_pertanyaan: b.urutan_pertanyaan, pertanyaan: ganti(b.pertanyaan), jawaban: ganti(b.jawaban) }]));

const KODE = "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 0047 0222 5227 0246 9944 7035 1268 8503 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 8505 0155 7095 8501 0032 0033".split(" ");
const ISI: Record<string, string> = { "0048": "Cerai Gugat", "0046": "Penggugat", "0047": "Tergugat", "1241": "ibu kandung", "1242": "tetangga", "0222": "Maret 2023", "5227": "tidak memberi nafkah dan sering bertengkar", "0246": "Januari 2024", "9944": "1 (satu) tahun", "7035": "Tergugat", "1268": "pihak keluarga telah berusaha mendamaikan namun tidak berhasil", "8503": "F", "1197": "xxx binti xxx", "1203": "xxx bin xxx", "5125": "Bahwa sejak tahun 2024 sering terjadi perselisihan karena Tergugat suka berjudi;" };

type Catatan = { simpan: Array<{ noVar: string; data: Array<{ no: string; tanya: string; jawab: string }> }>; usulan: any[]; templatDibaca: number };

function bukaHalaman(saklar: boolean | "galat") {
  const c: Catatan = { simpan: [], usulan: [], templatDibaca: 0 };
  const baris = KODE.map(
    (k) =>
      `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td><td>${k in ISI ? ISI[k] : `isi ${k}`}</td>` +
      `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','');">edit</a></td></tr>`
  ).join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>[2] BAS 2 P Hadir &amp; T Tidak Hadir</title></head><body><div id="wrapper"><div id="content"><h3 class="w3l_header"><span>123/Pdt.G/2026/PA.Dgl</span></h3><table>${baris}</table></div></div></body></html>`,
    { url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3", runScripts: "outside-only" }
  );
  halaman.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru" };
  w.chrome = {
    runtime: { getManifest: () => ({ version: "uji" }), getURL: (p: string) => `chrome-extension://aleta-uji/${p}`, sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }), lastError: undefined },
    storage: {
      local: {
        get: async (k: string[]) => Object.fromEntries((k || []).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
        set: async (v: Record<string, unknown>) => void Object.assign(simpanan, v),
        remove: async () => {},
      },
      onChanged: { addListener: () => {} },
    },
  };
  w.Response = globalThis.Response;
  w.fetch = async (alamat: string, o: any = {}) => {
    const a = String(alamat);
    if (/\/aleta\/api\/aleta-ecourt\/ekstensi\/fitur/.test(a)) {
      if (saklar === "galat") return html(500, "{}");
      return html(200, JSON.stringify({ ok: true, data: { fitur: { "mesin-saksi-tunggal": saklar === true } } }));
    }
    if (a.includes("/tanyajawab_template_edit?")) {
      c.templatDibaca += 1;
      return html(200, `<script>\n var ajax_data = ${JSON.stringify(MENTAH)} \n</script>`);
    }
    if (a.includes("/tanyajawab_perkara_edit?")) {
      const q = new URL(a).searchParams;
      if (q.get("aksi") === "simpan") {
        c.simpan.push({ noVar: String(q.get("no_var")), data: JSON.parse(new URLSearchParams(String(o.body || "")).get("data") || "[]") });
        return html(200, "Tanya Jawab Disimpan");
      }
      if (String(o.body || "").includes("load_template")) return html(200, `<script>\n var ajax_data = ${JSON.stringify(TERGANTI)} \n</script>`);
      return html(200, `<select><option value=''>--> Load Template <--</option><option value='04'>(04) Pertanyaan Saksi CG</option></select><script>\n var ajax_data = [] \n</script>`);
    }
    if (a.includes("/edit_data?")) return o.method === "POST" ? html(200, "<b>DATA DISIMPAN</b>") : html(200, '<input type="hidden" name="var_type" value="data_teks">');
    if (a.endsWith("/aleta/api/aleta-bot/abt/usulan")) {
      const muatan = JSON.parse(String(o.body || "{}"));
      if (muatan.sumber === "siapa" || muatan.sumber === "sipp") return html(401, "{}");
      c.usulan.push(muatan);
      const bot = await penanganBot(muatan);
      return html(200, JSON.stringify({ data: { available: true, ...bot.json } }));
    }
    return html(404, "{}");
  };
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  w.eval(
    [baca("panel-alat.js"), baca("saklar-fitur.js"), baca("saksi-katalog.js"), baca("saksi-katalog-data.js"), baca("saksi-susun.js"), baca("abt.js")].join("\n;\n") +
      '\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);\nwindow.__uji = { tahanPost: (n) => { alatCobaMenahan = () => n; } };'
  );
  return { w, c };
}

const panelDari = (w: any) => w.document.getElementById("aleta-panel-abt");
const tombolDi = (akar: any, teks: string) => Array.from(akar?.querySelectorAll("button") || []).find((b: any) => b.textContent === teks) as any;
const TOMBOL_KATALOG = "Susun saksi menurut keadaan perkara";
const TOMBOL_LAMA = "Susun keterangan saksi 1 & 2";

async function siapkan(saklar: boolean | "galat") {
  const h = bukaHalaman(saklar);
  h.w.__uji.tahanPost(false);
  const panel = await tunggu(() => panelDari(h.w), "panel ABT");
  await tunggu(() => !tombolDi(panel, TOMBOL_KATALOG)?.hidden, "tombol katalog tampak");
  await tunggu(() => !tombolDi(panel, TOMBOL_LAMA)?.hidden, "tombol lama tampak");
  await jeda(40); // saklar ditanyakan lebih awal oleh borang katalog
  return { ...h, panel };
}
const wadahKatalog = (panel: any) => panel.querySelector(".aleta-ssk");
async function susunKatalog(panel: any) {
  const wadah = await tunggu(() => (wadahKatalog(panel)?.querySelector(".aleta-sdg-form") ? wadahKatalog(panel) : null), "borang katalog");
  tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
  await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi tersusun");
  return wadah;
}

describe("tombol cerai lama: saklar MATI = persis seperti dulu", () => {
  it("menekan tombol lama membaca bank templat ABT dan borang lama; borang katalog tetap tertutup tanpa alat baris", async () => {
    const { w, c, panel } = await siapkan(false);
    tombolDi(panel, TOMBOL_LAMA).click();
    await tunggu(() => tombolDi(panel, "Susun keterangan para saksi"), "borang lama (blangko tanya jawab)");
    expect(wadahKatalog(panel).hidden).toBe(true);
    expect(c.usulan.filter((m) => m.sumber === "saksi-sdg")).toEqual([]);
    tombolDi(panel, "Susun keterangan para saksi").click();
    await tunggu(() => c.usulan.some((m) => m.sumber === "saksi-sdg"), "bot saksi-sdg dipanggil");
    // borang katalog yang dibuka sendiri tidak punya alat baris dan tidak ada tautan Cara lama
    tombolDi(panel, TOMBOL_KATALOG).click();
    const wadah = await susunKatalog(panel);
    expect(wadah.querySelectorAll(".aleta-ssk-alat").length).toBe(0);
    expect(wadah.querySelector(".aleta-ssk-cara-lama")).toBeNull();
    expect(wadah.querySelector(".aleta-ssk-tt")).toBeNull();
    const t = wadah.querySelector(".aleta-ssk-baris .aleta-ssk-tanya");
    expect(t.textContent).toMatch(/^1\. /);
    void w;
  });

  it("gagal bertanya saklar (500) juga = perilaku lama", async () => {
    const { c, panel } = await siapkan("galat");
    tombolDi(panel, TOMBOL_LAMA).click();
    await tunggu(() => tombolDi(panel, "Susun keterangan para saksi"), "borang lama");
    expect(wadahKatalog(panel).hidden).toBe(true);
    expect(c.templatDibaca).toBeGreaterThanOrEqual(0);
  });
});

describe("tombol cerai lama: saklar MENYALA memanggil mesin katalog", () => {
  it("menekan tombol lama membuka borang katalog (tanpa bank templat ABT, tanpa bot saksi-sdg) dengan tautan Cara lama", async () => {
    const { c, panel } = await siapkan(true);
    tombolDi(panel, TOMBOL_LAMA).click();
    const wadah = await tunggu(() => (wadahKatalog(panel) && !wadahKatalog(panel).hidden ? wadahKatalog(panel) : null), "borang katalog terbuka");
    await tunggu(() => wadah.querySelector(".aleta-sdg-form"), "isi borang");
    expect(wadah.textContent).toContain("Susun saksi - Cerai gugat");
    expect(tombolDi(wadah, "Cara lama (bank templat ABT)")).toBeTruthy();
    await jeda(60);
    expect(c.usulan.filter((m) => m.sumber === "saksi-sdg")).toEqual([]);
    expect(c.templatDibaca).toBe(0);
    expect(panel.textContent).toContain("mesin katalog yang sama");
  });

  it("hasil tombol lama = hasil tombol katalog (mesin yang sama, jawaban sama), dan alat sunting baris tidak mengubah jawaban mesin", async () => {
    const lama = await siapkan(true);
    tombolDi(lama.panel, TOMBOL_LAMA).click();
    const wadahLama = await susunKatalog(lama.panel);
    const katalog = await siapkan(true);
    tombolDi(katalog.panel, TOMBOL_KATALOG).click();
    const wadahKat = await susunKatalog(katalog.panel);
    const jawaban = (wadah: any) => (Array.from(wadah.querySelectorAll(".aleta-ssk-baris")) as any[]).map((b) => `${b.getAttribute("data-butir")}|${b.getAttribute("data-saksi")}|${b.querySelector("textarea").value}`);
    expect(jawaban(wadahLama).length).toBeGreaterThan(20);
    expect(jawaban(wadahLama)).toEqual(jawaban(wadahKat));
    // pembanding saklar MATI: jawaban mesin identik (alat hanya menambah cara menyunting)
    const mati = await siapkan(false);
    tombolDi(mati.panel, TOMBOL_KATALOG).click();
    const wadahMati = await susunKatalog(mati.panel);
    expect(jawaban(wadahMati)).toEqual(jawaban(wadahKat));
  });

  it("Cara lama: menutup borang katalog dan menjalankan jalur lama (bank templat ABT, mesin bot) - kemampuan lama tidak hilang", async () => {
    const { c, panel } = await siapkan(true);
    tombolDi(panel, TOMBOL_LAMA).click();
    const wadah = await tunggu(() => (wadahKatalog(panel) && !wadahKatalog(panel).hidden ? wadahKatalog(panel) : null), "borang katalog terbuka");
    const lama = await tunggu(() => tombolDi(wadah, "Cara lama (bank templat ABT)"), "tautan cara lama");
    lama.click();
    await tunggu(() => tombolDi(panel, "Susun keterangan para saksi"), "borang lama");
    expect(wadahKatalog(panel).hidden).toBe(true);
    tombolDi(panel, "Susun keterangan para saksi").click();
    await tunggu(() => c.usulan.some((m) => m.sumber === "saksi-sdg"), "bot saksi-sdg dipanggil lewat cara lama");
  });
});

describe("alat sunting baris di borang katalog (saklar menyala)", () => {
  async function borang() {
    const h = await siapkan(true);
    tombolDi(h.panel, TOMBOL_LAMA).click();
    const wadah = await susunKatalog(h.panel);
    const kolom = Array.from(wadah.querySelectorAll(".aleta-ssk-saksi")) as any[];
    const barisDi = (i: number) => Array.from(kolom[i].querySelectorAll(".aleta-ssk-baris")) as any[];
    const alatDi = (baris: any, teks: string) => Array.from(baris.querySelectorAll(".aleta-ssk-alat button")).find((b: any) => b.textContent === teks) as any;
    return { ...h, wadah, kolom, barisDi, alatDi };
  }
  const tanyaDari = (b: any) => String(b.querySelector(".aleta-ssk-tt").textContent);
  const nomorDari = (b: any) => String(b.querySelector(".aleta-ssk-no").textContent);

  it("tiap baris mendapat alat; ↑ ↓ mengubah urutan dan menomori ulang; baris pertama tidak naik lagi", async () => {
    const { barisDi, alatDi } = await borang();
    const awal = barisDi(0).map(tanyaDari);
    expect(barisDi(0).every((b) => b.querySelectorAll(".aleta-ssk-alat button").length === 5)).toBe(true);
    alatDi(barisDi(0)[0], "↑").click();
    expect(barisDi(0).map(tanyaDari)).toEqual(awal);
    alatDi(barisDi(0)[0], "↓").click();
    expect(barisDi(0).map(tanyaDari).slice(0, 2)).toEqual([awal[1], awal[0]]);
    expect(barisDi(0).map(nomorDari).slice(0, 3)).toEqual(["1. ", "2. ", "3. "]);
    alatDi(barisDi(0)[1], "↑").click();
    expect(barisDi(0).map(tanyaDari)).toEqual(awal);
  });

  it("⇄ memindahkan baris ke saksi berikutnya sebagai baris tambahan; ⧉ menyalin; ✕ menghapus", async () => {
    const { kolom, barisDi, alatDi } = await borang();
    const n0 = barisDi(0).length;
    const n1 = barisDi(1).length;
    const dipindah = tanyaDari(barisDi(0)[2]);
    alatDi(barisDi(0)[2], "⇄").click();
    expect(barisDi(0).length).toBe(n0 - 1);
    expect(barisDi(1).length).toBe(n1 + 1);
    expect(tanyaDari(barisDi(1)[barisDi(1).length - 1])).toBe(dipindah);
    const disalin = tanyaDari(barisDi(1)[0]);
    alatDi(barisDi(1)[0], "⧉").click();
    // salinan dari saksi 2 jatuh ke saksi 1 (berikutnya melingkar), aslinya tetap
    expect(barisDi(1).length).toBe(n1 + 1);
    expect(barisDi(0).length).toBe(n0);
    expect(tanyaDari(barisDi(0)[barisDi(0).length - 1])).toBe(disalin);
    expect(barisDi(0)[barisDi(0).length - 1].getAttribute("data-salinan")).toBe("1");
    alatDi(barisDi(0)[0], "✕").click();
    expect(barisDi(0).length).toBe(n0 - 1);
    expect(barisDi(0).map(nomorDari)[0]).toBe("1. ");
    void kolom;
  });

  it("+ Tambah keterangan membuat baris manual; pertanyaan dapat disunting; hasil penyimpanan ke ABT mengikuti susunan akhir tanpa awalan nomor", async () => {
    const { c, wadah, barisDi, alatDi, kolom } = await borang();
    const tambah = kolom[0].querySelector("button.aleta-sdg-tambah");
    tambah.click();
    const baru = barisDi(0)[barisDi(0).length - 1];
    baru.querySelector(".aleta-ssk-tt").textContent = "Apakah saksi pernah melihat langsung?";
    baru.querySelector("textarea").value = "Pernah melihat sendiri;";
    const yangDihapus = tanyaDari(barisDi(0)[1]);
    alatDi(barisDi(0)[1], "✕").click();
    const yangPertama = tanyaDari(barisDi(0)[0]);
    barisDi(0)[0].querySelector(".aleta-ssk-tt").textContent = "Pertanyaan pertama disunting petugas";
    tombolDi(wadah, "Simpan ke ABT").click();
    await tunggu(() => c.simpan.length >= 2, "dua saksi tersimpan");
    const saksi1 = c.simpan.find((x) => x.noVar === "2021")!.data;
    expect(saksi1[0].tanya).toBe("Pertanyaan pertama disunting petugas");
    expect(saksi1[saksi1.length - 1]).toMatchObject({ tanya: "Apakah saksi pernah melihat langsung?", jawab: "Pernah melihat sendiri;" });
    expect(saksi1.map((b) => b.no)).toEqual(saksi1.map((_, i) => String(i + 1)));
    expect(saksi1.some((b) => b.tanya === yangDihapus)).toBe(false);
    expect(saksi1.every((b) => !/^\d+\.\s/.test(b.tanya))).toBe(true);
    expect(yangPertama).not.toBe("Pertanyaan pertama disunting petugas");
    expect(JSON.stringify(c.simpan)).not.toMatch(/aleta/i);
  });

  it("baris yang dipindah ke saksi lain tersimpan di variabel saksi TUJUAN", async () => {
    const { c, wadah, barisDi, alatDi } = await borang();
    const dipindah = tanyaDari(barisDi(0)[3]);
    alatDi(barisDi(0)[3], "⇄").click();
    tombolDi(wadah, "Simpan ke ABT").click();
    await tunggu(() => c.simpan.length >= 2, "dua saksi tersimpan");
    const s1 = c.simpan.find((x) => x.noVar === "2021")!.data;
    const s2 = c.simpan.find((x) => x.noVar === "2022")!.data;
    expect(s1.some((b) => b.tanya === dipindah)).toBe(false);
    expect(s2[s2.length - 1].tanya).toBe(dipindah);
  });
});
