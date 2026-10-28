// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AKSI, bolehAksi } from "@/lib/matriks-peran";
import { normalkanSetelan } from "@/lib/tampilan-ekstensi";
import {
  KATALOG_TAMPILAN_SIPP,
  HALAMAN_SIPP,
  pecahkanTampilanSipp,
  penyaringAman,
  saringPilihanBaru,
  sembunyiUntukEkstensi,
  usulanAturanPeran,
  type BarisAturanTampilanSipp,
} from "@/lib/tampilan-sipp";
import { TUTORIAL } from "@/lib/tutorial-isi";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_TAMPILAN_SIPP } from "@/server/db/schema";
import { getUsersFromDb } from "@/server/modules/organization/service";
import {
  halamanAdminTampilanSipp,
  halamanTampilanSippSaya,
  simpanAturanTampilanSipp,
  simpanPilihanTampilanSipp,
  tampilanSippEkstensi,
} from "@/server/modules/aleta-ecourt/tampilan-sipp";

/**
 * ============================================================================
 * TAMPILAN ALETA DI HALAMAN SIPP PER PERAN DAN PER PENGGUNA (28 Okt 2026, migrasi 0116)
 * ============================================================================
 *   - aturan berlaku: sistem (tampil) -> peran (paling longgar menang) -> pengguna -> pilihan sendiri;
 *   - terkunci (selalu/tidak) tidak dapat diubah pengguna; pilihan tersimpan di akun dan terbaca ulang;
 *   - ekstensi dijalankan SUNGGUHAN di jsdom: elemen tersembunyi tidak digambar, widget (akar bayangan) juga;
 *   - pintu masuk dari widget dan popup, hak di matriks, tutorial, migrasi di tiga tempat.
 */

const AKAR = path.resolve(process.cwd(), "..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("migrasi 0116 - tiga tempat pendaftaran", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0116_aleta_tampilan_sipp.sql");
  it("jurnal: 0116 di idx 102 tepat sekali, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    expect(j.entries.filter((e) => e.tag.startsWith("0116_"))).toEqual([expect.objectContaining({ idx: 102, tag: "0116_aleta_tampilan_sipp" })]);
    expect(j.entries.filter((e) => e.idx === 102)).toHaveLength(1);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
  });

  it("pernyataan berkas = DDL_TAMPILAN_SIPP, berjalan di pg-mem, tabel ikut cadangan, tanpa kunci asing", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual([...DDL_TAMPILAN_SIPP.tabel, ...DDL_TAMPILAN_SIPP.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT * FROM aleta_tampilan_sipp_aturan")).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_tampilan_sipp_aturan");
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(readFileSync(SQL, "utf8").replace(/--.*$/gm, ""))).toBe(false);
  });
});

describe("katalog: satu sumber, penyaring menunjuk elemen ekstensi yang sungguh ada", () => {
  const sumber = readdirSync(path.join(AKAR, "ekstensi-sipp"))
    .filter((b) => b.endsWith(".js"))
    .map((b) => baca(`ekstensi-sipp/${b}`))
    .join("\n");

  it("kunci unik berbentuk <halaman>.<nama>, halaman dikenal, isi terisi", () => {
    const kunci = KATALOG_TAMPILAN_SIPP.map((x) => x.kunci);
    expect(new Set(kunci).size).toBe(kunci.length);
    for (const el of KATALOG_TAMPILAN_SIPP) {
      expect(el.kunci).toMatch(/^[a-z]+\.[a-z0-9-]+$/);
      expect(el.kunci.split(".")[0]).toBe(el.halaman);
      expect(Object.keys(HALAMAN_SIPP)).toContain(el.halaman);
      expect(el.nama.length).toBeGreaterThan(3);
      expect(el.jelas).toMatch(/[.]$/);
      expect(el.contoh.length).toBeGreaterThan(0);
      expect(el.pilih.length + (el.bayang ? el.bayang.pilih.length : 0)).toBeGreaterThan(0);
    }
    expect(KATALOG_TAMPILAN_SIPP.length).toBeGreaterThanOrEqual(40);
  });

  it("tiap penyaring aman dan tanda pengenalnya (id/kelas/atribut/tag) ada di berkas ekstensi", () => {
    for (const el of KATALOG_TAMPILAN_SIPP) {
      for (const sel of [...el.pilih, ...(el.bayang ? [el.bayang.tuan, ...el.bayang.pilih] : [])]) {
        expect(penyaringAman(sel), `${el.kunci}: ${sel}`).toBe(true);
        const tanda = sel.match(/[#.]([a-z][a-z0-9-]+)|\[(data-[a-z0-9-]+)|^([a-z]+-[a-z-]+)/i);
        expect(tanda, `${el.kunci}: ${sel}`).toBeTruthy();
        const nama = tanda![1] || tanda![2] || tanda![3];
        // Id bertemplat (`aleta-stj-tombol-${tab}`) dicari lewat awalannya.
        const ada = sumber.includes(nama) || sumber.includes(`${nama.replace(/-[a-z]+$/, "")}-\${`);
        expect(ada, `${el.kunci}: "${nama}" tidak ada di ekstensi`).toBe(true);
      }
    }
  });

  it("penyaring tanpa :has dapat diurai peramban (jsdom)", () => {
    const d = new JSDOM("<!doctype html><body></body>").window.document;
    for (const el of KATALOG_TAMPILAN_SIPP) for (const sel of el.pilih) if (!sel.includes(":has(")) expect(() => d.querySelector(sel), sel).not.toThrow();
  });
});

describe("pemecah: sistem -> peran -> pengguna -> pilihan", () => {
  const atur = (lingkup: "peran" | "pengguna", sasaran: string, aturan: BarisAturanTampilanSipp["aturan"]): BarisAturanTampilanSipp => ({
    lingkup,
    sasaran,
    aturan,
    catatan: "",
    diubahOleh: "usr-admin",
    diubahPada: "2026-10-28T00:00:00.000Z",
  });
  const satu = (hasil: ReturnType<typeof pecahkanTampilanSipp>, kunci: string) => hasil.find((x) => x.kunci === kunci)!;

  it("tanpa aturan: semua tampil, boleh diatur, sumber sistem (fitur lama tidak berkurang)", () => {
    const h = pecahkanTampilanSipp({ aturan: [], penggunaId: "u1", golongan: ["pp"] });
    expect(h).toHaveLength(KATALOG_TAMPILAN_SIPP.length);
    expect(h.every((x) => x.tampil && !x.terkunci && x.sumber === "sistem")).toBe(true);
    expect(sembunyiUntukEkstensi(h)).toEqual([]);
  });

  it("aturan peran berlaku; pilihan sendiri hanya untuk 'boleh'; terkunci menang atas pilihan", () => {
    const aturan = [atur("peran", "pp", { "semua.ai": { mode: "boleh", bawaan: false }, "semua.menu-abt": { mode: "tidak", bawaan: false }, "daftar.tanda-baris": { mode: "selalu", bawaan: true } })];
    const h = pecahkanTampilanSipp({ aturan, penggunaId: "u1", golongan: ["pp"], pilihan: { "semua.ai": true, "semua.menu-abt": true, "daftar.tanda-baris": false, "semua.widget": false } });
    expect(satu(h, "semua.ai")).toMatchObject({ tampil: true, terkunci: false, sumber: "pilihan", bawaan: false });
    expect(satu(h, "semua.menu-abt")).toMatchObject({ tampil: false, terkunci: true, sumber: "peran", mode: "tidak" });
    expect(satu(h, "daftar.tanda-baris")).toMatchObject({ tampil: true, terkunci: true, mode: "selalu" });
    expect(satu(h, "semua.widget")).toMatchObject({ tampil: false, sumber: "pilihan" });
  });

  it("beberapa golongan: yang paling longgar menang (boleh > selalu > tidak)", () => {
    const aturan = [atur("peran", "pp", { "semua.ai": { mode: "tidak", bawaan: false } }), atur("peran", "kasir", { "semua.ai": { mode: "boleh", bawaan: false } })];
    expect(satu(pecahkanTampilanSipp({ aturan, penggunaId: "u1", golongan: ["pp", "kasir"] }), "semua.ai")).toMatchObject({ mode: "boleh", tampil: false, terkunci: false });
    expect(satu(pecahkanTampilanSipp({ aturan, penggunaId: "u1", golongan: ["pp"] }), "semua.ai")).toMatchObject({ mode: "tidak", terkunci: true });
  });

  it("aturan pengguna menimpa aturan peran", () => {
    const aturan = [atur("peran", "pp", { "semua.ai": { mode: "tidak", bawaan: false } }), atur("pengguna", "u1", { "semua.ai": { mode: "selalu", bawaan: true } })];
    expect(satu(pecahkanTampilanSipp({ aturan, penggunaId: "u1", golongan: ["pp"] }), "semua.ai")).toMatchObject({ tampil: true, terkunci: true, sumber: "pengguna" });
    expect(satu(pecahkanTampilanSipp({ aturan, penggunaId: "u2", golongan: ["pp"] }), "semua.ai")).toMatchObject({ tampil: false, sumber: "peran" });
  });

  it("menyimpan pilihan: yang terkunci ditolak, yang sama dengan bawaan tidak disimpan", () => {
    const aturan = [atur("peran", "pp", { "semua.menu-abt": { mode: "tidak", bawaan: false } })];
    const berlaku = pecahkanTampilanSipp({ aturan, penggunaId: "u1", golongan: ["pp"] });
    expect(saringPilihanBaru(berlaku, { "semua.menu-abt": true, "semua.ai": false, "semua.widget": true, "tidak.dikenal": false })).toEqual({ pilihan: { "semua.ai": false }, ditolak: ["semua.menu-abt"] });
  });

  it("usulan peran: yang lazim nyala, lainnya mati tetapi tetap boleh; pengelola semua nyala", () => {
    const kasir = usulanAturanPeran("kasir");
    expect(kasir["kasir.tombol"]).toEqual({ mode: "boleh", bawaan: true });
    expect(kasir["putusan.otomatis"]).toEqual({ mode: "boleh", bawaan: false });
    expect(Object.values(usulanAturanPeran("super-admin")).every((a) => a.mode === "boleh" && a.bawaan)).toBe(true);
  });

  it("yang dikirim ke ekstensi hanya yang tersembunyi beserta penyaringnya (dan gaya pengembali Lama Proses)", () => {
    const h = pecahkanTampilanSipp({ aturan: [], penggunaId: "u1", golongan: ["pp"], pilihan: { "daftar.lama-proses": false, "semua.sumber-daya": false } });
    const s = sembunyiUntukEkstensi(h);
    expect(s.map((x) => x.kunci).sort()).toEqual(["daftar.lama-proses", "semua.sumber-daya"]);
    expect(s.find((x) => x.kunci === "daftar.lama-proses")!.gaya).toContain("td[data-aleta-l2-lama]");
    expect(s.find((x) => x.kunci === "semua.sumber-daya")!.bayang).toEqual({ tuan: "aleta-cm-widget", pilih: [".aleta-cmw-sd"] });
  });

  it("setelan akun 'tampilan.sipp' hanya menyimpan kunci katalog bernilai nyala/mati", () => {
    const n = normalkanSetelan("tampilan.sipp", { pilihan: { "semua.ai": false, "x.y": true, "semua.widget": "ya" }, lain: 1 });
    expect(n.nilai).toEqual({ pilihan: { "semua.ai": false } });
    expect(n.dibuang).toEqual(expect.arrayContaining(["lain", "pilihan.x.y", "pilihan.semua.widget"]));
  });
});

describe("server: tersimpan di akun, terbaca ulang, hak admin", () => {
  let db: AletaDatabase;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });
  afterEach(async () => {
    await db.close();
  });
  const akun = async (id: string) => (await getUsersFromDb(db)).find((p) => p.id === id)!;

  it("admin mengunci untuk peran PP; PP menyimpan pilihannya; keluar-masuk (baca ulang) tetap sama; ekstensi menerima penyaringnya", async () => {
    await simpanAturanTampilanSipp(db, "usr-admin", { lingkup: "peran", sasaran: "pp", aturan: { "semua.menu-abt": { mode: "tidak", bawaan: false }, "semua.ai": { mode: "boleh", bawaan: false } } });
    const pp = await akun("usr-ppg");
    const awal = await halamanTampilanSippSaya(db, pp);
    expect(awal.golongan.map((g) => g.id)).toContain("pp");
    expect(awal.berlaku.find((b) => b.kunci === "semua.menu-abt")).toMatchObject({ tampil: false, terkunci: true });

    const simpan = await simpanPilihanTampilanSipp(db, pp, { "semua.menu-abt": true, "semua.widget": false, "semua.ai": true });
    expect(simpan.ditolak).toEqual(["semua.menu-abt"]);

    // "Keluar lalu masuk lagi" = dibaca ulang dari server tanpa keadaan di memori.
    const ulang = await halamanTampilanSippSaya(db, await akun("usr-ppg"));
    expect(ulang.berlaku.find((b) => b.kunci === "semua.widget")).toMatchObject({ tampil: false, sumber: "pilihan" });
    expect(ulang.berlaku.find((b) => b.kunci === "semua.ai")).toMatchObject({ tampil: true, sumber: "pilihan" });
    expect(ulang.berlaku.find((b) => b.kunci === "semua.menu-abt")).toMatchObject({ tampil: false, terkunci: true });

    const eks = await tampilanSippEkstensi(db, pp);
    expect(eks.sembunyi.map((s) => s.kunci).sort()).toEqual(["semua.menu-abt", "semua.widget"]);
    expect(eks.sembunyi.find((s) => s.kunci === "semua.menu-abt")!.pilih).toEqual(['li[data-aleta-menu="abt"]']);
    expect(eks.versi).toMatch(/^ts1-[0-9a-f]{8}$/);

    // Admin menghapus aturan peran: elemen kembali boleh, pilihan sendiri yang tersimpan tetap.
    await simpanAturanTampilanSipp(db, "usr-admin", { lingkup: "peran", sasaran: "pp", aturan: {} });
    const bebas = await halamanTampilanSippSaya(db, pp);
    expect(bebas.berlaku.find((b) => b.kunci === "semua.menu-abt")).toMatchObject({ tampil: true, terkunci: false });
    expect(bebas.berlaku.find((b) => b.kunci === "semua.widget")).toMatchObject({ tampil: false });
  });

  it("penimpaan per pengguna dan pratinjau admin", async () => {
    await simpanAturanTampilanSipp(db, "usr-super", { lingkup: "pengguna", sasaran: "usr-ppg", aturan: { "semua.ai": { mode: "selalu", bawaan: true } } });
    const h = await halamanAdminTampilanSipp(db, "usr-super", { pratinjau: "usr-ppg" });
    expect(h.aturan).toEqual([expect.objectContaining({ lingkup: "pengguna", sasaran: "usr-ppg" })]);
    expect(h.pratinjau!.berlaku.find((b) => b.kunci === "semua.ai")).toMatchObject({ tampil: true, terkunci: true, sumber: "pengguna" });
  });

  it("hanya Super Admin & Admin; Admin tidak mengubah aturan Super Admin", async () => {
    await expect(halamanAdminTampilanSipp(db, "usr-ppg")).rejects.toMatchObject({ status: 403 });
    await expect(simpanAturanTampilanSipp(db, "usr-ppg", { lingkup: "peran", sasaran: "pp", aturan: {} })).rejects.toMatchObject({ status: 403 });
    await expect(simpanAturanTampilanSipp(db, "usr-admin", { lingkup: "peran", sasaran: "super-admin", aturan: { "semua.ai": { mode: "tidak", bawaan: false } } })).rejects.toMatchObject({ status: 403 });
    await expect(simpanAturanTampilanSipp(db, "usr-admin", { lingkup: "pengguna", sasaran: "usr-super", aturan: {} })).rejects.toMatchObject({ status: 403 });
    await expect(simpanAturanTampilanSipp(db, "usr-super", { lingkup: "peran", sasaran: "super-admin", aturan: { "semua.ai": { mode: "boleh", bawaan: false } } })).resolves.toBeTruthy();
    expect((await halamanAdminTampilanSipp(db, "usr-admin")).bolehUbahSuperAdmin).toBe(false);
    const audit = await db.prepare("SELECT action FROM audit_logs WHERE entity_type = ?").all<{ action: string }>("aleta_tampilan_sipp_aturan");
    expect(audit.map((a) => a.action)).toContain("UPDATE_SIPP_DISPLAY_RULE");
  });

  it("hak di matriks peran: hanya pengelola", async () => {
    expect(AKSI["tampilan-sipp.atur"].golongan).toEqual([]);
    expect(bolehAksi(await akun("usr-admin"), "tampilan-sipp.atur")).toBe(true);
    expect(bolehAksi(await akun("usr-super"), "tampilan-sipp.atur")).toBe(true);
    expect(bolehAksi(await akun("usr-ppg"), "tampilan-sipp.atur")).toBe(false);
  });
});

describe("ekstensi: tampilan-sipp.js dijalankan sungguhan", () => {
  const SKRIP = baca("ekstensi-sipp/tampilan-sipp.js");
  const terbuka: JSDOM[] = [];
  afterEach(() => {
    while (terbuka.length) terbuka.pop()!.window.close();
  });

  function buka(o: { url?: string; singgahan?: unknown; jawab?: unknown; gagal?: boolean }) {
    const dom = new JSDOM(
      `<!doctype html><html><head></head><body><ul id="cssmenu"><li data-aleta-menu="abt"><a>ABT By Derry</a></li><li data-aleta-menu="aleta"><a>ALETA</a></li></ul><div id="aleta-panel-sipp" class="aleta-panel">panel</div></body></html>`,
      { url: o.url ?? "http://192.168.10.10/SIPP/perkara_list", runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
    );
    terbuka.push(dom);
    const w = dom.window as any;
    const simpan: Record<string, unknown> = o.singgahan ? { tampilanSippBerlaku: o.singgahan } : {};
    const pendengar: Array<(u: any, t: string) => void> = [];
    const diminta: string[] = [];
    w.chrome = {
      storage: {
        local: {
          get: async (k: string | string[]) => Object.fromEntries([k].flat().filter((n) => n in simpan).map((n) => [n, simpan[n]])),
          set: async (x: Record<string, unknown>) => {
            Object.assign(simpan, x);
            for (const f of pendengar) f(Object.fromEntries(Object.entries(x).map(([k, v]) => [k, { newValue: v }])), "local");
          },
        },
        onChanged: { addListener: (f: any) => pendengar.push(f) },
      },
    };
    w.fetch = async (url: string) => {
      diminta.push(url);
      if (o.gagal) throw new Error("server mati");
      return { ok: true, json: async () => ({ ok: true, data: o.jawab ?? { versi: "ts1-0", sembunyi: [] } }) };
    };
    const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
    vm.runInContext(SKRIP, ctx, { filename: "tampilan-sipp.js" });
    return { w, d: w.document as Document, simpan, diminta };
  }
  const tersembunyi = (d: Document, sel: string) => {
    const el = d.querySelector(sel)!;
    return (el.ownerDocument.defaultView as Window).getComputedStyle(el).display === "none";
  };
  const sembunyiAbt = { versi: "ts1-1", sembunyi: [{ kunci: "semua.menu-abt", pilih: ['li[data-aleta-menu="abt"]'] }] };

  it("jawaban server menyembunyikan elemennya, menyimpan singgahan, dan menandai html", async () => {
    const h = buka({ jawab: sembunyiAbt });
    for (let i = 0; i < 50 && !h.d.getElementById("aleta-tampilan-sipp-gaya")?.textContent; i++) await tunggu(5);
    expect(h.diminta[0]).toContain("/aleta/api/aleta-ecourt/ekstensi/tampilan-sipp?untuk=ekstensi");
    expect(tersembunyi(h.d, 'li[data-aleta-menu="abt"]')).toBe(true);
    expect(tersembunyi(h.d, 'li[data-aleta-menu="aleta"]')).toBe(false);
    expect(tersembunyi(h.d, "#aleta-panel-sipp")).toBe(false);
    expect(h.d.documentElement.getAttribute("data-aleta-tampilan-sembunyi")).toBe("semua.menu-abt");
    expect((h.simpan.tampilanSippBerlaku as { sembunyi: unknown[] }).sembunyi).toHaveLength(1);
    // Elemen tetap ada di halaman (hanya tidak digambar): tidak ada yang dihapus dari SIPP.
    expect(h.d.querySelectorAll("#cssmenu li")).toHaveLength(2);
  });

  it("server tidak terjangkau: singgahan tetap berlaku; tanpa singgahan tidak ada yang disembunyikan", async () => {
    const a = buka({ gagal: true, singgahan: { ...sembunyiAbt, diambilPada: 0 } });
    for (let i = 0; i < 50 && !a.d.getElementById("aleta-tampilan-sipp-gaya"); i++) await tunggu(5);
    expect(tersembunyi(a.d, 'li[data-aleta-menu="abt"]')).toBe(true);
    const b = buka({ gagal: true });
    await tunggu(30);
    expect(tersembunyi(b.d, 'li[data-aleta-menu="abt"]')).toBe(false);
    expect(b.d.getElementById("aleta-tampilan-sipp-gaya")).toBeNull();
  });

  it("pilihan berubah (tab lain) berlaku seketika; kembali tampil bila tidak disembunyikan lagi", async () => {
    const h = buka({ jawab: sembunyiAbt });
    for (let i = 0; i < 50 && !tersembunyi(h.d, 'li[data-aleta-menu="abt"]'); i++) await tunggu(5);
    await h.w.chrome.storage.local.set({ tampilanSippBerlaku: { versi: "ts1-2", sembunyi: [], diambilPada: Date.now() } });
    expect(tersembunyi(h.d, 'li[data-aleta-menu="abt"]')).toBe(false);
    expect(h.d.documentElement.hasAttribute("data-aleta-tampilan-sembunyi")).toBe(false);
  });

  it("widget di akar bayangan: gaya dipasang di akar bayangannya, termasuk widget yang muncul belakangan", async () => {
    const h = buka({ jawab: { versi: "ts1-3", sembunyi: [{ kunci: "semua.sumber-daya", pilih: [], bayang: { tuan: "aleta-cm-widget", pilih: [".aleta-cmw-sd"] } }] } });
    await tunggu(30);
    const inang = h.d.createElement("aleta-cm-widget");
    const akar = inang.attachShadow({ mode: "open" });
    akar.innerHTML = `<div class="aleta-cmw-sd">RAM</div><div class="aleta-cmw-lain">lain</div>`;
    h.d.body.appendChild(inang);
    for (let i = 0; i < 50 && !akar.querySelector("style[data-aleta-tampilan-sipp]"); i++) await tunggu(5);
    expect(akar.querySelector("style[data-aleta-tampilan-sipp]")!.textContent).toContain(".aleta-cmw-sd{display:none!important}");
  });

  it("penyaring berbahaya atau rusak dilewati; halaman selain SIPP tidak disentuh", async () => {
    const h = buka({ jawab: { versi: "x", sembunyi: [{ kunci: "a", pilih: ["body{color:red}", "li[[", "@import x", 'li[data-aleta-menu="abt"]'], gaya: "<script>" }] } });
    for (let i = 0; i < 50 && !h.d.getElementById("aleta-tampilan-sipp-gaya")?.textContent; i++) await tunggu(5);
    expect(h.d.getElementById("aleta-tampilan-sipp-gaya")!.textContent).toBe('li[data-aleta-menu="abt"]{display:none!important}');
    const abt = buka({ url: "http://192.168.10.10/aps_badilag/abt/main", jawab: sembunyiAbt });
    await tunggu(30);
    expect(abt.diminta).toEqual([]);
    expect(abt.d.getElementById("aleta-tampilan-sipp-gaya")).toBeNull();
  });
});

describe("pintu masuk dan pendaftaran", () => {
  it("manifest memuat tampilan-sipp.js di SIPP pada document_start, dan susunan ekstensi mengirimnya", () => {
    const m = JSON.parse(baca("ekstensi-sipp/manifest.json")) as { content_scripts: Array<{ matches: string[]; js: string[]; run_at?: string }> };
    const k = m.content_scripts.filter((c) => c.js.includes("tampilan-sipp.js"));
    expect(k).toHaveLength(1);
    expect(k[0].run_at).toBe("document_start");
    expect(k[0].matches).toEqual(["http://192.168.10.10/SIPP/*", "http://127.0.0.1/index.php/*"]);
    expect(baca("manajemen_surat/scripts/susun-ekstensi.mjs")).toContain('"tampilan-sipp.js"');
  });

  it("widget (menu gelembung, dok, Atur widget) dan popup membuka halaman pengaturan pengguna di portal", () => {
    const cl = baca("ekstensi-sipp/checklist.js");
    expect(cl).toContain('alamatPortal("/aleta/account/tampilan-sipp")');
    expect((cl.match(/tautanTampilanSipp\(/g) || []).length).toBeGreaterThanOrEqual(4);
    const pp = baca("ekstensi-sipp/popup.js");
    expect(pp).toContain("/account/tampilan-sipp");
    expect(pp).toContain('setAttribute("data-tampilan-sipp", "buka")');
  });

  it("halaman portal ada, layar admin dijaga aksi matriks, tutorial menunjuknya, Pusat Kendali menautkannya", () => {
    expect(baca('manajemen_surat/src/app/(portal)/account/tampilan-sipp/page.tsx')).toContain("TampilanSippSaya");
    expect(baca('manajemen_surat/src/app/(portal)/admin/tampilan-sipp/page.tsx')).toContain('bolehAksi(currentUser, "tampilan-sipp.atur")');
    expect(baca("manajemen_surat/src/components/portal/admin-hub.tsx")).toContain('href="/admin/tampilan-sipp"');
    expect(TUTORIAL.some((t) => t.halaman.includes("/account/tampilan-sipp"))).toBe(true);
    expect(TUTORIAL.some((t) => (t.mencakup.aksi ?? []).includes("tampilan-sipp.atur"))).toBe(true);
  });
});
