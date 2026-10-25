// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * U18 - PEMERIKSA EJAAN NAMA PIHAK DI FORMULIR PIHAK SIPP, SISI EKSTENSI (rantai B, 25 Okt 2026)
 * ============================================================================
 *   - saklar kinerja.ejaanNamaPihak mati (bawaan): tidak ada pendengar, tidak ada permintaan;
 *   - menyala: nama yang diketik di #pihak_fullname dicocokkan ke server; bila varian dari nama baku, satu baris usulan
 *     dengan tombol "Salin ejaan baku" muncul di bawah kolom; HANYA usulan - isi kolom tidak berubah, tidak ada yang tersimpan;
 *   - gagal-aman: portal galat atau saklar server mati = tidak ada baris.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const EJAAN = baca("ejaan-nama.js");
const HUB = baca("pengamat-bersama.js");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = { saklar?: boolean; jawab?: (badan: any) => unknown; galat?: boolean; tanpaAlatAmbil?: boolean; denganHub?: boolean; isi?: string };

async function buka(o: Opsi = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body><form id="frm"><input id="pihak_fullname" name="pihak_fullname" value="${o.isi ?? ""}"><input id="lain" value="tetap"></form></body></html>`,
    { url: "http://192.168.10.10/SIPP/pihak", runScripts: "outside-only" } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpan: Record<string, unknown> = {};
  if (o.saklar) simpan.tampilanServer = { kinerja: { ejaanNamaPihak: true } };
  w.chrome = {
    runtime: { sendMessage: async () => ({}) },
    storage: {
      local: { get: async (k: string[]) => Object.fromEntries([k].flat().filter((n) => n in simpan).map((n) => [n, simpan[n]])) },
      onChanged: { addListener: () => undefined },
    },
  };
  const salin: string[] = [];
  Object.defineProperty(w.navigator, "clipboard", { value: { writeText: async (t: string) => void salin.push(t) }, configurable: true });
  const panggilan: Array<{ alamat: string; metode: string; badan: any }> = [];
  const ambil = async (alamat: string, opsi: any) => {
    const badan = opsi && opsi.body ? JSON.parse(opsi.body) : null;
    panggilan.push({ alamat, metode: String((opsi && opsi.method) || "GET"), badan });
    if (o.galat) throw new Error("putus");
    const data = o.jawab ? o.jawab(badan) : { tersedia: true, usulan: [] };
    return { ok: true, status: 200, json: async () => ({ ok: true, data }) };
  };
  if (!o.tanpaAlatAmbil) w.alatAmbil = ambil;
  else w.fetch = ambil;
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  if (o.denganHub) vm.runInContext(HUB, ctx, { filename: "pengamat-bersama.js" });
  vm.runInContext(EJAAN, ctx, { filename: "ejaan-nama.js" });
  await w.ALETA_EJAAN_NAMA.tungguSiap();
  await tunggu(20);
  const d = w.document as Document;
  const kolom = d.getElementById("pihak_fullname") as HTMLInputElement;
  const ketik = (nilai: string) => {
    kolom.value = nilai;
    kolom.dispatchEvent(new w.Event("input", { bubbles: true }));
  };
  return { w, d, kolom, ketik, panggilan, salin, E: w.ALETA_EJAAN_NAMA };
}
const ALIAS = { jenis: "alias", tingkat: "info", pesan: "x", nama: [], usulanBaku: "Muhammad Alwi" };

describe("ejaan-nama.js", () => {
  it("saklar mati (bawaan): tidak ada pendengar dan tidak ada satu permintaan pun", async () => {
    const h = await buka({ saklar: false });
    expect(h.E.aktif()).toBe(false);
    expect(h.E.pasang(h.d)).toBe(false);
    h.ketik("Moh. Alwi");
    await tunggu(900);
    expect(h.panggilan).toEqual([]);
    expect(h.d.getElementById("aleta-ejaan-usulan")).toBeNull();
    expect(await h.E.periksa("Moh. Alwi")).toEqual([]);
  });

  it("menyala: nama varian -> satu baris usulan dengan ejaan baku; kolom tidak berubah; hanya alias yang ditampilkan", async () => {
    const h = await buka({ saklar: true, jawab: () => ({ tersedia: true, usulan: [ALIAS, { jenis: "mirip", usulanBaku: "X" }] }) });
    expect(h.E.aktif()).toBe(true);
    expect(h.kolom.getAttribute("data-aleta-ejaan")).toBe("1");
    h.ketik("Moh. Alwi");
    await tunggu(900);
    expect(h.panggilan).toHaveLength(1);
    expect(h.panggilan[0]).toMatchObject({ metode: "POST", alamat: "/aleta/api/aleta-ecourt/alias-nama/periksa", badan: { nama: [{ asal: "Formulir pihak SIPP", nama: "Moh. Alwi" }] } });
    const kotak = h.d.getElementById("aleta-ejaan-usulan")!;
    expect(kotak.textContent).toContain('ejaan lain dari "Muhammad Alwi"');
    expect(kotak.previousElementSibling).toBe(h.kolom);
    expect(h.kolom.value).toBe("Moh. Alwi"); // tidak ditimpa
    expect((h.d.getElementById("lain") as HTMLInputElement).value).toBe("tetap");
    expect(kotak.querySelectorAll("button")).toHaveLength(1);
  });

  it("tombol 'Salin ejaan baku' menyalin teks ke papan klip atas klik petugas; tidak mengisi kolom", async () => {
    const h = await buka({ saklar: true, jawab: () => ({ tersedia: true, usulan: [ALIAS] }) });
    h.ketik("Mohd Alwi");
    await tunggu(900);
    const tombol = h.d.querySelector("#aleta-ejaan-usulan button") as HTMLButtonElement;
    tombol.click();
    await tunggu(20);
    expect(h.salin).toEqual(["Muhammad Alwi"]);
    expect(tombol.textContent).toBe("Tersalin");
    expect(h.kolom.value).toBe("Mohd Alwi");
  });

  it("ketikan beruntun digabung (satu permintaan); nama pendek tidak diperiksa; usulan hilang bila nama sudah baku", async () => {
    let n = 0;
    const h = await buka({ saklar: true, jawab: () => (++n === 1 ? { tersedia: true, usulan: [ALIAS] } : { tersedia: true, usulan: [] }) });
    h.ketik("Mo");
    h.ketik("Moh");
    h.ketik("Moh. Alwi");
    await tunggu(900);
    expect(h.panggilan).toHaveLength(1);
    expect(h.d.getElementById("aleta-ejaan-usulan")).not.toBeNull();
    h.ketik("Muhammad Alwi");
    await tunggu(900);
    expect(h.panggilan).toHaveLength(2);
    expect(h.d.getElementById("aleta-ejaan-usulan")).toBeNull();
    h.ketik("Ali");
    await tunggu(900);
    expect(h.panggilan).toHaveLength(2);
  });

  it("kolom yang sudah berisi saat halaman dibuka langsung diperiksa; dipasang sekali saja", async () => {
    const h = await buka({ saklar: true, isi: "Mohd Alwi", jawab: () => ({ tersedia: true, usulan: [ALIAS] }) });
    await tunggu(900);
    expect(h.panggilan).toHaveLength(1);
    expect(h.E.pasang(h.d)).toBe(false);
  });

  it("portal galat, saklar server mati (tersedia:false), atau tanpa alatAmbil: tidak ada baris dan tidak melempar", async () => {
    const galat = await buka({ saklar: true, galat: true });
    galat.ketik("Moh. Alwi");
    await tunggu(900);
    expect(galat.d.getElementById("aleta-ejaan-usulan")).toBeNull();
    const mati = await buka({ saklar: true, jawab: () => ({ tersedia: false, alasan: "saklar-mati" }) });
    mati.ketik("Moh. Alwi");
    await tunggu(900);
    expect(mati.d.getElementById("aleta-ejaan-usulan")).toBeNull();
    const polos = await buka({ saklar: true, tanpaAlatAmbil: true, jawab: () => ({ tersedia: true, usulan: [ALIAS] }) });
    polos.ketik("Moh. Alwi");
    await tunggu(900);
    expect(polos.d.getElementById("aleta-ejaan-usulan")).not.toBeNull();
  });

  it("formulir yang lahir menyusul (jendela modal SIPP) ikut terpasang lewat pengamat bersama", async () => {
    const dom = new JSDOM(`<!doctype html><html><body><div id="isi"></div></body></html>`, { url: "http://192.168.10.10/SIPP/pihak", runScripts: "outside-only" } as ConstructorParameters<typeof JSDOM>[1]);
    terbuka.push(dom);
    const w = dom.window as any;
    w.chrome = {
      runtime: { sendMessage: async () => ({}) },
      storage: { local: { get: async () => ({ tampilanServer: { kinerja: { ejaanNamaPihak: true } } }) }, onChanged: { addListener: () => undefined } },
    };
    w.alatAmbil = async () => ({ ok: true, status: 200, json: async () => ({ data: { tersedia: true, usulan: [ALIAS] } }) });
    Object.defineProperty(w.navigator, "clipboard", { value: { writeText: async () => undefined }, configurable: true });
    const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
    vm.runInContext(HUB, ctx, { filename: "pengamat-bersama.js" });
    vm.runInContext(EJAAN, ctx, { filename: "ejaan-nama.js" });
    await w.ALETA_EJAAN_NAMA.tungguSiap();
    await tunggu(20);
    const d = w.document as Document;
    d.getElementById("isi")!.innerHTML = `<input id="pihak_fullname" value="Mohd Alwi">`;
    await tunggu(1000);
    expect(d.getElementById("pihak_fullname")!.getAttribute("data-aleta-ejaan")).toBe("1");
    expect(d.getElementById("aleta-ejaan-usulan")).not.toBeNull();
  });
});

describe("terpasang di manifest", () => {
  const manifest = JSON.parse(baca("manifest.json"));
  it("ejaan-nama.js hanya di blok skrip SIPP (bukan ABT, bukan portal)", () => {
    const kelompok = manifest.content_scripts.filter((c: any) => c.js.includes("ejaan-nama.js"));
    expect(kelompok).toHaveLength(1);
    expect(kelompok[0].js).toContain("konten.js");
    expect(kelompok[0].js).not.toContain("abt.js");
  });
});
