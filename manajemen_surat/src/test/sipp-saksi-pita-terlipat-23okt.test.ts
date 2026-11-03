// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * T6 (23 Okt 2026): kartu ALETA di atas form "Tambah Data Pihak Saksi"
 * (#frm_user) - pita "Saksi / Pihak" (L1) dan "Saksi Putusan" (M1). 3 Nov 2026
 * (butir 10): lipatan diganti bilah mini - tersembunyi bila tidak mendesak, satu
 * tombol kecil "ALETA" membukanya, yang mendesak tampil ringkas; fungsinya utuh.
 * Kode sungguhan di jsdom: panel-alat.js + sipp-ide-l1.js + sipp-ide-m1.js
 * + panel.css, chrome.storage tiruan. Nama/NIK rekaan.
 */
const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(EKSTENSI, n), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const L1 = baca("sipp-ide-l1.js");
const M1 = baca("sipp-ide-m1.js");
// Hanya aturan lipat "kartu" dari panel.css sungguhan (jsdom lambat/rapuh atas berkas 11 ribu baris).
const CSS = baca("panel.css")
  .split("\n")
  .filter((b) => b.startsWith(".aleta-lipatan"))
  .join("\n");

const FORM = (pilih = "0") => `<div id="popup_form"><div id="form_pop"><div class="aleta-c2-sbantu"></div>
<form id="frm_user" method="post" action="http://127.0.0.1:8056/addPihak/validateInput"><table id="tableDetilPerkara">
<tr><td>Pihak <font color="red">*</font></td><td><input type="text" id="pihak" name="pihak" value="Saksi" readonly="readonly"></td></tr>
<tr><td>Saksi Putusan<font color="red">*</font></td><td><select name="is_sela" id="is_sela"><option value="-1" ${pilih === "-1" ? "selected" : ""}>- Pilih Salah Satu -</option><option value="0" ${pilih === "0" ? "selected" : ""}>Akhir</option><option value="1">Sela</option></select></td></tr>
<tr><td>Nama Lengkap <font color="red">*</font></td><td><input type="text" id="fullname" name="fullname" value=""></td></tr>
<tr><td><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr></table></form></div></div>`;
const HALAMAN = `<div id="tabs1"><table id="tableinfo"><tr><td id="first-child">Nomor Perkara</td><td>565/Pdt.G/2026/PA.Dgl</td></tr></table></div>`;

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 30));
  while (terbuka.length) terbuka.pop()!.window.close();
});
type W = any;
const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(f: () => T, ket: string): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = f();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > 3000) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}

function buka(opsi: { simpanan?: Record<string, unknown>; tanpaAlat?: boolean; pilih?: string } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${HALAMAN}${FORM(opsi.pilih)}</body></html>`, {
    url: "http://127.0.0.1:8056/index.php/perkara_detil_agama/x",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as W;
  const simpanan: Record<string, unknown> = { ...(opsi.simpanan || {}) };
  w.__simpanan = simpanan;
  w.chrome = {
    runtime: { getManifest: () => ({ version: "1.205.38" }) },
    storage: {
      local: {
        get: async (k: string[] | string) => {
          const d = Array.isArray(k) ? k : [k];
          return Object.fromEntries(d.filter((x) => x in simpanan).map((x) => [x, simpanan[x]]));
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, isi),
        remove: async (k: string) => void delete simpanan[k],
      },
      onChanged: { addListener() {} },
    },
  };
  w.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) });
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  if (!opsi.tanpaAlat) {
    vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
    // Pita ALETA hanya hidup di tampilan Baru (bukan "lama").
    w.alatUjiMode = () => "baru";
  }
  vm.runInContext(L1, ctx, { filename: "sipp-ide-l1.js" });
  vm.runInContext(M1, ctx, { filename: "sipp-ide-m1.js" });
  w.aletaSippIdeL1.pasang(w.document);
  w.aletaSippIdeM1.pasang(w.document);
  // jsdom mengabaikan !important/kekhususan dan memakai aturan TERAKHIR - di peramban !important menang
  // atas display bawaan pita; maka aturan lipat panel.css dipasang paling akhir agar uji setara peramban.
  const gaya = w.document.createElement("style");
  gaya.textContent = CSS;
  w.document.head.appendChild(gaya);
  return w;
}

const PITA = { l1: ".aleta-l1-pita", m1: ".aleta-m1-pita" } as const;
const pita = (w: W, k: keyof typeof PITA) => w.document.querySelector(`${PITA[k]}[data-${k}-jendela="saksi"]`) as HTMLElement | null;
const bilah = (w: W) => w.document.querySelector(".aleta-mini-bilah") as HTMLElement | null;
const tombol = (w: W) => bilah(w)!.querySelector("button.aleta-mini-tombol") as HTMLButtonElement;

// 3 Nov 2026 (butir 10): lipatan T6 diganti BILAH MINI - pita tersembunyi bila tidak mendesak, satu tombol kecil
// "ALETA" per borang membuka/menutup keduanya; yang mendesak tampil ringkas (hanya peringatannya).
describe.each(["l1", "m1"] as const)("pita saksi %s", (k) => {
  it("bawaan tersembunyi bila tidak mendesak; satu tombol kecil ALETA tampak", async () => {
    const w = buka();
    const p = (await sampai(() => pita(w, k), `pita ${k}`)) as HTMLElement;
    await sampai(() => bilah(w), "bilah mini");
    expect(p.hidden).toBe(true);
    expect(bilah(w)!.hidden).toBe(false);
    expect(w.document.querySelectorAll(".aleta-mini-bilah").length).toBe(1);
    expect(tombol(w).textContent).toBe("ALETA");
    expect(tombol(w).getAttribute("aria-pressed")).toBe("false");
    expect(tombol(w).getAttribute("data-mendesak")).toBe("tidak");
  });

  it("tombol ALETA membuka pita (tombol Isi tampak & masih berfungsi), klik lagi menyembunyikannya", async () => {
    const w = buka();
    const p = (await sampai(() => pita(w, k), `pita ${k}`)) as HTMLElement;
    await sampai(() => bilah(w), "bilah mini");
    tombol(w).click();
    expect(p.hidden).toBe(false);
    expect(tombol(w).getAttribute("aria-pressed")).toBe("true");
    const isi = p.querySelector(`[data-${k}="isi"]`) as HTMLButtonElement;
    expect(isi).toBeTruthy();
    // fungsi utuh: tombol "Isi dengan ALETA" tetap mengisi pilihan yang pasti
    isi.click();
    await sampai(() => (p.querySelector(`[data-${k}="kabar"]`) as HTMLElement).textContent, `kabar ${k} terisi setelah Isi dengan ALETA`);
    tombol(w).click();
    expect(p.hidden).toBe(true);
    expect(tombol(w).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("tidak merusak fungsi", () => {
  it("tanpa fungsi lipat seragam: tombol ALETA tetap membuka pita lengkap", async () => {
    const w = buka({ tanpaAlat: true });
    await sampai(() => pita(w, "l1") && pita(w, "m1") && bilah(w), "pita & bilah");
    tombol(w).click();
    for (const k of ["l1", "m1"] as const) {
      const p = pita(w, k)!;
      expect(p.hidden).toBe(false);
      expect(p.getAttribute("data-terbuka")).toBeNull();
      expect(p.querySelector(`[data-${k}="isi"]`)).toBeTruthy();
    }
  });

  it("pita saksi tidak lagi dilipat (tombol kecil menggantikan lipatan); hanya satu tombol untuk kedua pita", async () => {
    const w = buka();
    await sampai(() => pita(w, "l1") && pita(w, "m1") && bilah(w), "pita & bilah");
    expect(w.document.querySelectorAll(".aleta-lipatan").length).toBe(0);
    expect(w.document.querySelectorAll(".aleta-mini-tombol").length).toBe(1);
  });
});

describe("yang mendesak tetap tampil sendiri (keputusan 23 Okt, bentuk 3 Nov)", () => {
  const ubahPilih = (w: W, v: string) => {
    const e = w.document.querySelector("#is_sela");
    e.value = v;
    e.dispatchEvent(new w.Event("change", { bubbles: true }));
    w.aletaSippIdeM1.pasang(w.document);
  };
  const butirKuning = (p: Element) => p.querySelector('[data-m1="cek"]')!.textContent;

  it("tanpa peringatan tetap tersembunyi", async () => {
    const w = buka({ pilih: "0" });
    const p = (await sampai(() => pita(w, "m1"), "pita m1")) as HTMLElement;
    expect(butirKuning(p)).toBe("");
    expect(p.hidden).toBe(true);
  });

  it("peringatan kuning (Saksi Putusan belum dipilih) menampilkan pita RINGKAS; pita L1 tetap tersembunyi", async () => {
    const w = buka({ pilih: "-1" });
    const p = (await sampai(() => pita(w, "m1"), "pita m1")) as HTMLElement;
    await sampai(() => !p.hidden, "pita m1 tampil sendiri");
    expect(p.classList.contains("aleta-mini-ringkas")).toBe(true);
    expect(butirKuning(p)).toMatch(/Saksi Putusan belum dipilih/);
    expect(pita(w, "l1")!.hidden).toBe(true);
    expect(tombol(w).getAttribute("data-mendesak")).toBe("ya");
  });

  it("tombol ALETA membuka rincian pita yang mendesak; klik lagi kembali ringkas (peringatan tidak hilang)", async () => {
    const w = buka({ pilih: "-1" });
    const p = (await sampai(() => pita(w, "m1"), "pita m1")) as HTMLElement;
    await sampai(() => !p.hidden, "tampil");
    tombol(w).click();
    expect(p.hidden).toBe(false);
    expect(p.classList.contains("aleta-mini-ringkas")).toBe(false);
    expect(pita(w, "l1")!.hidden).toBe(false);
    tombol(w).click();
    expect(p.hidden).toBe(false);
    expect(p.classList.contains("aleta-mini-ringkas")).toBe(true);
    expect(pita(w, "l1")!.hidden).toBe(true);
  });

  it("peringatan hilang -> pita tersembunyi lagi; muncul lagi -> tampil lagi", async () => {
    const w = buka({ pilih: "-1" });
    const p = (await sampai(() => pita(w, "m1"), "pita m1")) as HTMLElement;
    await sampai(() => !p.hidden, "tampil");
    ubahPilih(w, "0");
    await sampai(() => p.hidden, "tersembunyi sesudah peringatan hilang");
    ubahPilih(w, "-1");
    await sampai(() => !p.hidden, "tampil lagi oleh peringatan baru");
  });
});
