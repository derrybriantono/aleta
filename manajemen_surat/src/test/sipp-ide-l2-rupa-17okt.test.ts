// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENANDA L2 - RUPA LENCANA BERSAMA & BARIS NON-e-COURT (audit 17 Okt)
 * ============================================================================
 *
 *   A. Penanda L2 memakai gaya lencana bersama (.aleta-tanda.aleta-tanda-<warna>,
 *      panel.css "LENCANA ALETA DI SIPP") - bulat berwarna penuh dengan (i),
 *      tetap berwarna di tema gelap, seperti rancangan sipp-dengan-ide.html.
 *      Kotak "Penanda ALETA" dan penjelasannya punya rupa tema gelap.
 *   B. Sel nomor perkara non-e-Court SIPP tidak berspasi sesudah nomornya; tombol
 *      ABT/ALETA (L1) atau lencana konten.js di sel itu dulu membuat nomornya
 *      tidak terbaca, sehingga penandanya tidak pernah tergambar.
 */

const AKAR = path.resolve(__dirname, "../../..");
const baca = (n: string) => readFileSync(path.join(AKAR, "ekstensi-sipp", n), "utf8").replace(/\r\n/g, "\n");
const KONTEN = baca("sipp-ide-l2.js");
const CSS = baca("panel.css");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 3000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    const h = periksa();
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
type Jendela = any;
const NOMOR = "123/Pdt.G/2026/PA.Dgl";
const P = (kode: string, tingkat: string, label: string) => ({ kode, tingkat, label, jelas: `Penjelasan ${label}.`, dasar: "Dasar.", sumber: "SIPP", perluDicek: false });
const JAWAB = {
  tersedia: true,
  boleh: [],
  perkara: { [NOMOR]: { penanda: [P("belum-ditunda", "merah", "Belum ditunda"), P("umur-perkara", "oranye", "5 bulan"), P("potensi-verstek", "kuning", "Potensi verstek"), P("sita", "biru", "Sita"), P("akta-cerai", "abu", "Akta cerai"), P("penetapan-awal", "hijau", "Lengkap")] } },
};

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(badan: string, alamat = "http://192.168.10.10/SIPP/perkara_list/x") {
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body>${badan}</body></html>`, { url: alamat, runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as Jendela;
  w.chrome = { storage: { local: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener() {} } } };
  const diminta: string[][] = [];
  w.fetch = async (a: string, init?: { body?: string }) => {
    if (init && init.body) diminta.push(JSON.parse(init.body).nomorPerkara);
    return { ok: true, status: 200, json: async () => ({ ok: true, data: String(a).includes("lima-bulan") ? { tersedia: false } : JAWAB }) };
  };
  w.alatUjiMode = () => "ui";
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(KONTEN, ctx, { filename: "sipp-ide-l2.js" });
  return { w, d: w.document as Document, diminta };
}

/** Sel nomor perkara NON-e-Court persis perkara_list.php (tanpa spasi) + tombol L1 + lencana konten.js. */
const BARIS_NON_ECOURT = `<table id="tablePerkaraAll"><tbody>
<tr><td>No</td><td>Nomor Perkara</td><td>Klasifikasi</td></tr>
<tr><td>1</td><td>${NOMOR}<span class="aleta-sisip aleta-l1 aleta-l1-tautan"><a class="aleta-l1-chip">ABT</a><a class="aleta-l1-chip">ALETA</a></span><div class="aleta-tanda-baris" data-aleta-tanda="1"><span class="aleta-tanda aleta-tanda-merah">GHAIB</span></div></td><td>Cerai Gugat</td></tr>
</tbody></table>`;

describe("B. baris non-e-Court dengan sisipan ALETA di sel nomornya", () => {
  it("nomornya tetap terbaca: diminta ke portal dan penandanya tergambar", async () => {
    const h = buka(BARIS_NON_ECOURT);
    await sampai(() => h.diminta.length, "permintaan penanda");
    expect(h.diminta[0]).toEqual([NOMOR]);
    await sampai(() => h.d.querySelector('[data-aleta-l2="baris"] button'), "penanda di baris");
  });
});

describe("A. rupa = lencana bersama", () => {
  it("tiap penanda .aleta-tanda.aleta-tanda-<warna> (oranye = jingga), ber-title untuk (i), tetap tombol type=button", async () => {
    const h = buka(BARIS_NON_ECOURT);
    await sampai(() => h.d.querySelectorAll('[data-aleta-l2="baris"] button').length === 6, "enam penanda");
    const pil = Array.from(h.d.querySelectorAll('[data-aleta-l2="baris"] button')) as HTMLButtonElement[];
    expect(pil.map((b) => [b.getAttribute("data-tingkat"), Array.from(b.classList).filter((k) => /^aleta-tanda-/.test(k))[0]])).toEqual([
      ["merah", "aleta-tanda-merah"],
      ["oranye", "aleta-tanda-jingga"],
      ["kuning", "aleta-tanda-kuning"],
      ["biru", "aleta-tanda-biru"],
      ["abu", "aleta-tanda-abu"],
      ["hijau", "aleta-tanda-hijau"],
    ]);
    for (const b of pil) {
      expect(b.classList.contains("aleta-tanda")).toBe(true);
      expect(b.type).toBe("button");
      expect(b.title).not.toBe("");
    }
  });

  it("panel.css punya warna rancangan terang DAN gelap untuk keenam warna penanda", () => {
    for (const w of ["merah", "jingga", "kuning", "biru", "abu", "hijau"]) {
      expect(CSS, w).toContain(`html[data-aleta-lencana="rancangan"] .aleta-tanda-${w} `);
      expect(CSS, w).toContain(`html[data-aleta-lencana="rancangan"][data-aleta-tema-sipp="gelap"] .aleta-tanda-${w} `);
    }
  });

  it("kotak Penanda ALETA, penjelasan, dan Lewat 5 bulan punya rupa tema gelap; tidak ada huruf di bawah 12,5px", () => {
    const gaya = (KONTEN.match(/g\.textContent = `([\s\S]*?)`;/) || [])[1] || "";
    for (const k of [".aleta-sisip.aleta-l2-detil", ".aleta-sisip.aleta-l2-jelas", ".aleta-sisip.aleta-l2-lima"]) {
      expect(gaya, k).toContain(`html[data-aleta-tema-sipp="gelap"] ${k}{`);
    }
    const ukuran = Array.from(gaya.matchAll(/font-size:\s*([\d.]+)px/g)).map((m) => Number(m[1]));
    expect(Math.min(...ukuran)).toBeGreaterThanOrEqual(12.5);
  });
});
