// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * T6 (23 Okt 2026): kartu ALETA di atas form "Tambah Data Pihak Saksi"
 * (#frm_user) - pita "Saksi / Pihak" (L1) dan "Saksi Putusan" (M1) - bawaannya
 * TERLIPAT, dapat dibuka dengan klik/Enter, pilihan diingat, fungsinya utuh.
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

const FORM = `<div id="popup_form"><div id="form_pop"><div class="aleta-c2-sbantu"></div>
<form id="frm_user" method="post" action="http://127.0.0.1:8056/addPihak/validateInput"><table id="tableDetilPerkara">
<tr><td>Pihak <font color="red">*</font></td><td><input type="text" id="pihak" name="pihak" value="Saksi" readonly="readonly"></td></tr>
<tr><td>Saksi Putusan<font color="red">*</font></td><td><select name="is_sela" id="is_sela"><option value="-1">- Pilih Salah Satu -</option><option value="0">Akhir</option><option value="1">Sela</option></select></td></tr>
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

function buka(opsi: { simpanan?: Record<string, unknown>; tanpaAlat?: boolean } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${HALAMAN}${FORM}</body></html>`, {
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
const pita = (w: W, k: keyof typeof PITA) => w.document.querySelector(`${PITA[k]}[data-${k}-jendela="saksi"]`);
const tampil = (w: W, e: Element | null) => Boolean(e) && w.getComputedStyle(e).display !== "none";
const kepala = (p: Element) => p.querySelector(".aleta-lipat-kepala") as HTMLElement;

describe.each(["l1", "m1"] as const)("pita saksi %s", (k) => {
  it("bawaan terlipat: hanya kepala (logo + judul) tampak, tombol & kabar tersembunyi", async () => {
    const w = buka();
    const p = (await sampai(() => pita(w, k), `pita ${k}`)) as HTMLElement;
    expect(p.getAttribute("data-terbuka")).toBe("tidak");
    expect(kepala(p).getAttribute("aria-expanded")).toBe("false");
    expect(tampil(w, kepala(p))).toBe(true);
    expect(kepala(p).textContent).toContain("ALETA");
    expect(kepala(p).textContent).toMatch(/Saksi/);
    const isi = p.querySelector(`[data-${k}="isi"]`) as HTMLElement;
    expect(isi).toBeTruthy();
    expect(tampil(w, isi.parentElement)).toBe(false);
  });

  it("klik kepala membuka (tombol tampak & masih berfungsi), klik lagi melipat, Enter juga bekerja", async () => {
    const w = buka();
    const p = (await sampai(() => pita(w, k), `pita ${k}`)) as HTMLElement;
    kepala(p).click();
    expect(p.getAttribute("data-terbuka")).toBe("ya");
    const isi = p.querySelector(`[data-${k}="isi"]`) as HTMLButtonElement;
    expect(tampil(w, isi.parentElement)).toBe(true);
    // fungsi utuh: tombol "Isi dengan ALETA" tetap mengisi pilihan yang pasti
    isi.click();
    await sampai(() => (p.querySelector(`[data-${k}="kabar"]`) as HTMLElement).textContent, `kabar ${k} terisi setelah Isi dengan ALETA`);
    kepala(p).click();
    expect(p.getAttribute("data-terbuka")).toBe("tidak");
    expect(tampil(w, isi.parentElement)).toBe(false);
    kepala(p).dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(p.getAttribute("data-terbuka")).toBe("ya");
  });

  it("pilihan diingat: pita yang dibuat lagi memakai pilihan terakhir; tersimpan di lipatTerbuka", async () => {
    const w1 = buka();
    const p1 = (await sampai(() => pita(w1, k), `pita ${k}`)) as HTMLElement;
    kepala(p1).click();
    await tunggu(20);
    const tersimpan = w1.__simpanan.lipatTerbuka as Record<string, boolean>;
    expect(Object.values(tersimpan)).toContain(true);
    const w2 = buka({ simpanan: JSON.parse(JSON.stringify(w1.__simpanan)) });
    const p2 = (await sampai(() => pita(w2, k), `pita ${k}`)) as HTMLElement;
    await tunggu(30);
    expect(p2.getAttribute("data-terbuka")).toBe("ya");
  });
});

describe("tidak merusak fungsi", () => {
  it("tanpa fungsi lipat seragam pita tetap terbuka lengkap", async () => {
    const w = buka({ tanpaAlat: true });
    for (const k of ["l1", "m1"] as const) {
      const p = (await sampai(() => pita(w, k), `pita ${k}`)) as HTMLElement;
      expect(p.getAttribute("data-terbuka")).toBeNull();
      expect(tampil(w, p.querySelector(`[data-${k}="isi"]`))).toBe(true);
    }
  });

  it("jendela lain (mis. Arsip) tidak ikut terlipat", async () => {
    const w = buka();
    await sampai(() => pita(w, "m1"), "pita m1");
    expect(w.document.querySelectorAll(".aleta-lipatan").length).toBe(2);
  });
});
