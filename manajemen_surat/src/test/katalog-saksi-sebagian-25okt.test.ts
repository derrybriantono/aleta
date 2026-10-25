// @vitest-environment node
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { EKSTENSI_BERKAS } from "@/server/shared/ekstensi-berkas";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI C, C2 (K10): KATALOG SAKSI DIMUAT PER JENIS PERKARA
 * ============================================================================
 *
 * Dahulu saksi-katalog-data.js (9,4 MB) disuntik ke SETIAP halaman ABT. Kini halaman hanya memuat
 * saksi-katalog-indeks.js (kecil) + saksi-katalog-muat.js, dan isi katalog (JSON) dimuat untuk jenis
 * perkara yang dibuka saja. Yang dijaga:
 *   1. berkas yang DIHASILKAN (indeks, JSON per jenis) sama dengan keluaran skrip pembangunnya; tidak ada sisa basi
 *   2. yang disuntik ke ABT kecil: indeks + pemuat (<< 1% data lengkap); data lengkap tidak lagi di manifest ABT
 *   3. pemuat: paket (utama + tambahan + keterangan) yang dimuat, TIDAK jenis lain; ingatan; gagal = false tanpa melempar
 *   4. HASIL SAMA: kenaliPaket dari katalog termuat sama persis dengan dari data lengkap, untuk semua jenis;
 *      kandidat dan kode variabel sama
 *   5. halaman ABT: tombol Susun saksi muncul sesudah paketnya termuat, dan susunan jawaban sama dengan jalur data lengkap
 *   6. manifest: web_accessible_resources untuk JSON; berkas tertanam di paket
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(AKAR, n), "utf8");
const FOLDER_JENIS = path.join(AKAR, "saksi-katalog-jenis");

const SKRIP_GENERATOR = path.resolve(__dirname, "../../scripts/susun-saksi-katalog.mjs");
async function generator() {
  return (await import(/* @vite-ignore */ pathToFileURL(SKRIP_GENERATOR).href)) as {
    bacaKatalog: () => Array<Record<string, any>>;
    bangunIsiIndeks: (k: Array<Record<string, any>>) => string;
    bangunIsiJenis: (k: Record<string, any>) => string;
    bangunIndeks: (k: Array<Record<string, any>>) => Array<Record<string, any>>;
  };
}

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

// ─── 1 dan 2. berkas hasil bangun dan ukuran ─────────────────────────────────

describe("berkas yang dihasilkan", () => {
  it("indeks dan JSON per jenis sama dengan keluaran skrip pembangun; tidak ada berkas jenis yang basi", async () => {
    const g = await generator();
    const katalog = g.bacaKatalog();
    expect(baca("saksi-katalog-indeks.js").replace(/\r\n/g, "\n")).toBe(g.bangunIsiIndeks(katalog));
    const ada = readdirSync(FOLDER_JENIS).filter((n) => n.endsWith(".json")).sort();
    expect(ada).toEqual(katalog.map((k) => `${k.kunci}.json`).sort());
    for (const kat of katalog) expect(readFileSync(path.join(FOLDER_JENIS, `${kat.kunci}.json`), "utf8"), kat.kunci).toBe(g.bangunIsiJenis(kat));
  });

  it("isi tiap berkas jenis = butir katalog di saksi-katalog-data.js (data lengkap tidak berselisih)", () => {
    const data: Array<Record<string, any>> = new Function("globalThis", `${baca("saksi-katalog-data.js")}; return globalThis.ALETA_SAKSI_KATALOG_DATA;`)({});
    expect(data.length).toBeGreaterThan(40);
    for (const kat of data) expect(JSON.parse(readFileSync(path.join(FOLDER_JENIS, `${kat.kunci}.json`), "utf8")), kat.kunci).toEqual(kat);
  });

  it("yang disuntik ke tiap halaman ABT kecil: indeks + pemuat jauh di bawah 1% data lengkap; data lengkap tidak di manifest ABT", () => {
    const eager = Buffer.byteLength(baca("saksi-katalog-indeks.js")) + Buffer.byteLength(baca("saksi-katalog-muat.js"));
    const penuh = Buffer.byteLength(baca("saksi-katalog-data.js"));
    expect(penuh).toBeGreaterThan(5_000_000);
    expect(eager).toBeLessThan(60_000);
    expect(eager / penuh).toBeLessThan(0.01);
    const manifest = JSON.parse(baca("manifest.json"));
    const abt = manifest.content_scripts.find((c: any) => c.js.includes("abt.js"));
    expect(abt.js).not.toContain("saksi-katalog-data.js");
    for (const c of manifest.content_scripts) expect(c.js, JSON.stringify(c.matches)).not.toContain("saksi-katalog-data.js");
    expect(abt.js.indexOf("saksi-katalog-indeks.js")).toBeLessThan(abt.js.indexOf("saksi-katalog-muat.js"));
    expect(abt.js.indexOf("saksi-katalog-muat.js")).toBeLessThan(abt.js.indexOf("saksi-susun.js"));
  });

  it("manifest membuka JSON katalog bagi skrip konten (web_accessible_resources) pada alamat ABT yang sama, tanpa izin baru", () => {
    const manifest = JSON.parse(baca("manifest.json"));
    const war = (manifest.web_accessible_resources as Array<{ resources: string[]; matches: string[] }>).find((w) => w.resources.includes("saksi-katalog-jenis/*.json"));
    expect(war).toBeTruthy();
    expect(war!.matches).toEqual(expect.arrayContaining(["http://192.168.10.10/*", "http://127.0.0.1/*"]));
    expect(manifest.permissions).toEqual(["storage", "downloads", "nativeMessaging"]); // tidak ada izin "scripting" baru
  });

  it("semua berkas baru ikut tertanam di paket ekstensi", () => {
    const tertanam = EKSTENSI_BERKAS as unknown as Record<string, string>;
    const nama = Object.keys(tertanam);
    for (const f of ["saksi-katalog-indeks.js", "saksi-katalog-muat.js", "saksi-katalog-jenis/cerai-gugat.json", "saksi-katalog-jenis/wakaf.json"]) {
      expect(nama.some((n) => n === f), f).toBe(true);
    }
    expect(nama.filter((n) => n.startsWith("saksi-katalog-jenis/")).length).toBe(readdirSync(FOLDER_JENIS).filter((n) => n.endsWith(".json")).length);
  });
});

// ─── 3 dan 4. pemuat ─────────────────────────────────────────────────────────

type Dunia = { w: any; diminta: string[]; gagalKan: Set<string> };
function bukaDunia(): Dunia {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/aps_badilag/index.php/abt/main/view", runScripts: "outside-only" });
  halaman.push(dom);
  const w = dom.window as any;
  const diminta: string[] = [];
  const gagalKan = new Set<string>();
  w.chrome = { runtime: { getURL: (p: string) => `chrome-extension://uji/${p}` } };
  w.fetch = async (alamat: string) => {
    // C4: pemuat lebih dulu menanyakan portal (saklar basis data); di uji ini portal tidak menjawab -> JSON tertanam. Bukan "berkas jenis".
    if (String(alamat).includes("/aleta/api/")) return new Response("", { status: 404 });
    const berkas = String(alamat).replace("chrome-extension://uji/", "");
    diminta.push(berkas);
    const nama = path.basename(berkas);
    if (gagalKan.has(nama) || !existsSync(path.join(FOLDER_JENIS, nama))) return new Response("", { status: 404 });
    return new Response(readFileSync(path.join(FOLDER_JENIS, nama), "utf8"), { status: 200, headers: { "content-type": "application/json" } });
  };
  w.eval([baca("saksi-katalog.js"), baca("saksi-katalog-indeks.js"), baca("saksi-katalog-muat.js"), baca("saksi-susun.js")].join("\n;\n"));
  return { w, diminta, gagalKan };
}

const DATA_LENGKAP: Array<Record<string, any>> = new Function("globalThis", `${baca("saksi-katalog-data.js")}; return globalThis.ALETA_SAKSI_KATALOG_DATA;`)({});

describe("pemuat saksi-katalog-muat.js", () => {
  it("memuat paket perkara ini (utama + tambahan) dan TIDAK jenis lain; ingatan mencegah muat dua kali", async () => {
    const d = bukaDunia();
    const M = d.w.AletaSaksiKatalogMuat;
    expect(M.ada()).toBe(true);
    expect(d.w.ALETA_SAKSI_KATALOG_DATA).toBeUndefined();
    const perkara = { jenisPerkaraId: "347", alurPerkaraId: "15", nama: "Cerai Gugat" };
    const utama = M.kenaliDiIndeks(perkara);
    expect(utama.kunci).toBe("cerai-gugat");
    const paket = M.paketKunci("cerai-gugat") as string[];
    expect(paket.length).toBeGreaterThan(1); // kumulasi / keterangan menempel pada cerai gugat
    expect(await M.siapkan(perkara)).toBe(true);
    const termuat = (d.w.ALETA_SAKSI_KATALOG_DATA as Array<{ kunci: string }>).map((k) => k.kunci).sort();
    expect(termuat).toEqual([...paket].sort());
    expect(termuat).not.toContain("wakaf");
    expect(d.diminta.length).toBe(paket.length);
    await M.siapkan(perkara);
    expect(d.diminta.length).toBe(paket.length);
    expect(M.versi()).toBe(paket.length);
  });

  it("jenis tanpa katalog: tidak memuat apa pun dan menjawab true", async () => {
    const d = bukaDunia();
    expect(await d.w.AletaSaksiKatalogMuat.siapkan({ jenisPerkaraId: "999999", alurPerkaraId: "15", nama: "Perkara Rekaan" })).toBe(true);
    expect(d.diminta).toEqual([]);
  });

  it("gagal memuat (404 / galat jaringan) = false tanpa melempar, katalog tidak setengah terpasang; boleh dicoba lagi", async () => {
    const d = bukaDunia();
    const M = d.w.AletaSaksiKatalogMuat;
    d.gagalKan.add("cerai-gugat.json");
    const perkara = { jenisPerkaraId: "347", alurPerkaraId: "15", nama: "Cerai Gugat" };
    expect(await M.siapkan(perkara)).toBe(false);
    expect(M.gagal()).toContain("cerai-gugat");
    expect((d.w.ALETA_SAKSI_KATALOG_DATA || []).some((k: any) => k.kunci === "cerai-gugat")).toBe(false);
    d.gagalKan.delete("cerai-gugat.json");
    expect(await M.siapkan(perkara)).toBe(true);
    expect(M.sudahDimuat("cerai-gugat")).toBe(true);
    d.w.fetch = async () => {
      throw new Error("jaringan putus");
    };
    expect(await M.siapkanKunci("wakaf")).toBe(false);
  });

  it("berkas yang kuncinya tidak cocok ditolak (bukan katalog yang diminta)", async () => {
    const d = bukaDunia();
    d.w.fetch = async () => new Response(JSON.stringify({ kunci: "lain", pertanyaan: [] }), { status: 200 });
    expect(await d.w.AletaSaksiKatalogMuat.siapkanKunci("wakaf")).toBe(false);
    expect(d.w.ALETA_SAKSI_KATALOG_DATA).toEqual([]);
  });

  it("katalog yang sudah ada di larik data (cadangan / uji) tidak dimuat lagi", async () => {
    const d = bukaDunia();
    d.w.ALETA_SAKSI_KATALOG_DATA = [JSON.parse(readFileSync(path.join(FOLDER_JENIS, "wakaf.json"), "utf8"))];
    expect(await d.w.AletaSaksiKatalogMuat.siapkanKunci("wakaf")).toBe(true);
    expect(d.diminta.filter((x) => x.endsWith("wakaf.json"))).toEqual([]);
  });
});

describe("HASIL SAMA dengan data lengkap", () => {
  const sampelPerkara = DATA_LENGKAP.filter((k) => !(k.tambahanUntuk && k.tambahanUntuk.length) && k.contoh !== true).flatMap((k) =>
    (k.syarat.jenisPerkaraId as string[]).map((id) => ({ jenisPerkaraId: id, alurPerkaraId: (k.syarat.alurPerkaraId || [""])[0] || "", nama: k.judul }))
  );

  it("kenaliPaket (utama + tambahan, digabung) dari katalog termuat = dari data lengkap, untuk semua jenis perkara yang punya katalog", async () => {
    expect(sampelPerkara.length).toBeGreaterThan(30);
    const d = bukaDunia();
    const M = d.w.AletaSaksiKatalogMuat;
    const Mesin = d.w.AletaSaksiKatalog;
    for (const perkara of sampelPerkara) {
      await M.siapkan(perkara);
      const lazy = Mesin.kenaliPaket(d.w.ALETA_SAKSI_KATALOG_DATA, perkara);
      const penuh = Mesin.kenaliPaket(JSON.parse(JSON.stringify(DATA_LENGKAP)), perkara);
      expect(lazy === null, JSON.stringify(perkara)).toBe(penuh === null);
      if (penuh) expect(JSON.parse(JSON.stringify(lazy)), JSON.stringify(perkara)).toEqual(JSON.parse(JSON.stringify(penuh)));
    }
    // keterangan pasangan (dispensasi kawin) ikut termuat bersama utamanya
    const dk = sampelPerkara.find((p) => p.nama.toLowerCase().includes("dispensasi"))!;
    const utamaDk = Mesin.kenaliPaket(d.w.ALETA_SAKSI_KATALOG_DATA, dk);
    expect(Mesin.kenaliKeterangan(d.w.ALETA_SAKSI_KATALOG_DATA, utamaDk)).toEqual(Mesin.kenaliKeterangan(DATA_LENGKAP, Mesin.kenaliPaket(DATA_LENGKAP, dk)));
  });

  it("kandidat(alur) dari indeks = kandidatKatalog dari data lengkap; kode variabel gabungan sama", () => {
    const d = bukaDunia();
    const M = d.w.AletaSaksiKatalogMuat;
    const S = d.w.AletaSaksiSusun;
    const pakaiPenuh = (alur: string) => DATA_LENGKAP.filter((kat) => {
      if (!kat || kat.contoh === true || !kat.syarat || (kat.tambahanUntuk && kat.tambahanUntuk.length)) return false;
      const sah = (kat.syarat.alurPerkaraId || []).map(String);
      return !alur || !sah.length || sah.includes(alur);
    });
    for (const alur of ["", "15", "16", "17", "13"]) {
      expect(M.kandidat(alur).map((k: any) => k.kunci).sort(), `alur ${alur}`).toEqual(pakaiPenuh(alur).map((k) => k.kunci).sort());
    }
    expect([...S.kodeDipakaiKatalog(M.untukKodeVariabel())].sort()).toEqual([...S.kodeDipakaiKatalog(DATA_LENGKAP)].sort());
  });
});

// ─── 5. halaman ABT ──────────────────────────────────────────────────────────

const KODE_BLANGKO_CERAI = "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 0047 0222 5227 0246 9944 7035 1268 8503 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 8505 0155 7095 8501 0032 0033".split(" ");

function bukaHalaman(mode: "lazy" | "penuh", isi: Record<string, string>, gagal = false) {
  const baris = KODE_BLANGKO_CERAI.map(
    (k) =>
      `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td><td>${k in isi ? isi[k] : `isi ${k}`}</td>` +
      `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','');">edit</a></td></tr>`
  ).join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>BAS</title></head><body><div id="wrapper"><div id="content"><h3 class="w3l_header"><span>123/Pdt.G/2026/PA.Dgl</span></h3><table>${baris}</table></div></div></body></html>`,
    { url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3", runScripts: "outside-only" }
  );
  halaman.push(dom);
  const w = dom.window as any;
  const diminta: string[] = [];
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru" };
  w.chrome = {
    runtime: { getManifest: () => ({ version: "uji" }), getURL: (p: string) => `chrome-extension://uji/${p}`, sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }), lastError: undefined },
    storage: {
      local: {
        get: async (kunci: string[]) => Object.fromEntries((kunci || []).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
        set: async (v: Record<string, unknown>) => void Object.assign(simpanan, v),
        remove: async () => {},
      },
      onChanged: { addListener: () => {} },
    },
  };
  w.Response = globalThis.Response;
  w.fetch = async (alamat: string) => {
    const a = String(alamat);
    if (a.startsWith("chrome-extension://uji/saksi-katalog-jenis/")) {
      diminta.push(path.basename(a));
      if (gagal) return new Response("", { status: 500 });
      const f = path.join(FOLDER_JENIS, path.basename(a));
      return existsSync(f) ? new Response(readFileSync(f, "utf8"), { status: 200 }) : new Response("", { status: 404 });
    }
    return new Response("{}", { status: 404 });
  };
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  const katalog = mode === "lazy" ? [baca("saksi-katalog-indeks.js"), baca("saksi-katalog-muat.js")] : [baca("saksi-katalog-data.js")];
  w.eval([baca("panel-alat.js"), baca("saksi-katalog.js"), ...katalog, baca("saksi-susun.js"), baca("abt.js")].join("\n;\n") + "\n;\nwindow.__uji = { tahanPost: (n) => { alatCobaMenahan = () => n; } };");
  return { w, diminta };
}

const ISI_CERAI = { "0048": "Cerai Gugat", "0046": "Penggugat", "0047": "Tergugat", "1241": "ibu kandung", "1242": "tetangga", "0222": "Maret 2023", "5227": "tidak memberi nafkah dan sering bertengkar", "0246": "Januari 2024", "9944": "1 (satu) tahun", "7035": "Tergugat", "1268": "pihak keluarga telah berusaha mendamaikan namun tidak berhasil", "8503": "F" };
const tombolDi = (akar: any, teks: string) => Array.from(akar.querySelectorAll("button")).find((b: any) => b.textContent === teks) as any;
const TOMBOL = "Susun saksi menurut keadaan perkara";

async function susunHalaman(mode: "lazy" | "penuh", isi: Record<string, string>) {
  const h = bukaHalaman(mode, isi);
  h.w.__uji.tahanPost(false);
  const panel = await tunggu(() => h.w.document.getElementById("aleta-panel-abt"), "panel ABT");
  await tunggu(() => !tombolDi(panel, TOMBOL)?.hidden, "tombol katalog tampak");
  tombolDi(panel, TOMBOL).click();
  const wadah = await tunggu(() => (panel.querySelector(".aleta-ssk .aleta-sdg-form") ? panel.querySelector(".aleta-ssk") : null), "borang");
  tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
  await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi tersusun");
  return { ...h, panel, wadah };
}

describe("halaman ABT dengan katalog dimuat per jenis", () => {
  it("cerai gugat: hanya paket cerai gugat yang diminta; tombol muncul sesudah termuat; susunan jawaban SAMA dengan jalur data lengkap", async () => {
    const lazy = await susunHalaman("lazy", ISI_CERAI);
    const penuh = await susunHalaman("penuh", ISI_CERAI);
    const jawab = (x: any) => (Array.from(x.wadah.querySelectorAll(".aleta-ssk-baris")) as any[]).map((b) => `${b.getAttribute("data-butir")}|${b.getAttribute("data-saksi")}|${(b.querySelector("textarea") as any).value}`);
    expect(jawab(lazy).length).toBeGreaterThan(20);
    expect(jawab(lazy)).toEqual(jawab(penuh));
    const paket = lazy.w.AletaSaksiKatalogMuat.paketKunci("cerai-gugat").map((k: string) => `${k}.json`).sort();
    expect([...new Set(lazy.diminta)].sort()).toEqual(paket);
    expect(lazy.diminta.some((n) => /wakaf|hibah|kewarisan/.test(n))).toBe(false);
    expect(lazy.wadah.textContent).toContain("Susun saksi - Cerai gugat");
  });

  it("jenis tanpa katalog: tombol tetap tersembunyi dan tidak satu berkas jenis pun diminta", async () => {
    const h = bukaHalaman("lazy", { ...ISI_CERAI, "0048": "Perkara Rekaan" });
    const panel = await tunggu(() => h.w.document.getElementById("aleta-panel-abt"), "panel ABT");
    await new Promise((s) => setTimeout(s, 300));
    expect(tombolDi(panel, TOMBOL).hidden).toBe(true);
    expect(h.diminta).toEqual([]);
  });

  it("katalog gagal dimuat: tombol tetap tersembunyi (tidak ada yang ditebak) dan halaman tidak rusak", async () => {
    const h = bukaHalaman("lazy", ISI_CERAI, true);
    const panel = await tunggu(() => h.w.document.getElementById("aleta-panel-abt"), "panel ABT");
    await tunggu(() => h.diminta.length > 0, "pemuatan dicoba");
    await new Promise((s) => setTimeout(s, 300));
    expect(tombolDi(panel, TOMBOL).hidden).toBe(true);
    expect(h.w.AletaSaksiKatalogMuat.gagal()).toContain("cerai-gugat");
  });
});
