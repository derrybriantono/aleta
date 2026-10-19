// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * LENCANA UMUR PERKARA DI KOLOM "LAMA PROSES" (19 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: lencana umur ("4 hari", di luar mediasi/SEMA 2/2014)
 * pindah dari kolom Nomor Perkara ke kolom Lama Proses daftar perkara SIPP,
 * dan teks bawaan SIPP ("4 Hari") disembunyikan lewat CSS - TIDAK dihapus.
 * Lencana lain tetap di kolom Nomor Perkara; daftar tanpa kolom Lama Proses
 * tidak berubah. Tidak ada yang dikirim ke server selain permintaan baca
 * penanda yang memang sudah ada.
 */

const AKAR = path.resolve(__dirname, "../../..");
const KONTEN = readFileSync(path.join(AKAR, "ekstensi-sipp", "sipp-ide-l2.js"), "utf8").replace(/\r\n/g, "\n");
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
const N1 = "123/Pdt.G/2026/PA.Dgl";
const N2 = "124/Pdt.G/2026/PA.Dgl";
const P = (kode: string, tingkat: string, label: string) => ({ kode, tingkat, label, jelas: `Umur perkara ${label} di luar mediasi.`, dasar: "SEMA 2/2014.", sumber: "SIPP", perluDicek: false });
const JAWAB = {
  tersedia: true,
  boleh: [],
  perkara: {
    [N1]: { penanda: [P("umur-perkara", "hijau", "4 hari"), P("potensi-verstek", "kuning", "Potensi verstek")] },
    [N2]: { penanda: [P("umur-perkara", "hijau", "1 hari")] },
  },
};

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(badan: string) {
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body>${badan}</body></html>`, {
    url: "http://192.168.10.10/SIPP/main",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  w.chrome = { storage: { local: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener() {} } } };
  const kiriman: Array<{ url: string; cara: string; badan: string }> = [];
  w.fetch = async (a: string, init?: { method?: string; body?: string }) => {
    kiriman.push({ url: String(a), cara: String((init && init.method) || "GET").toUpperCase(), badan: String((init && init.body) || "") });
    return { ok: true, status: 200, json: async () => ({ ok: true, data: String(a).includes("lima-bulan") ? { tersedia: false } : JAWAB }) };
  };
  w.alatUjiMode = () => "ui";
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(KONTEN, ctx, { filename: "sipp-ide-l2.js" });
  return { w, d: w.document as Document, kiriman };
}

/** Replika perkara_list.php: baris kepala ber-td, kolom Lama Proses "N Hari" rata kanan. */
const DAFTAR = `<table id="tablePerkaraAll"><tbody>
<tr><td>No</td><td onclick="sorting(1)">Nomor Perkara</td><td onclick="sorting(2)">Tanggal Register</td><td onclick="sorting(7)">Lama Proses</td><td>Link</td></tr>
<tr><td>1</td><td>${N1}<span class="aleta-sisip aleta-l1 aleta-l1-tautan"><a class="aleta-l1-chip">ABT</a><a class="aleta-l1-chip">ALETA</a></span><div class="aleta-tanda-baris" data-aleta-tanda="1"><span class="aleta-tanda aleta-tanda-hijau">PRODEO</span></div></td><td align="center">15/10/2026</td><td style="text-align:right;">4 Hari</td><td>[<a href="#">detil</a>]</td></tr>
<tr><td>2</td><td>${N2}</td><td align="center">18/10/2026</td><td style="text-align:right;">1 Hari</td><td>[<a href="#">detil</a>]</td></tr>
</tbody></table>`;

const TANPA_LAMA = `<table id="tablePerkaraAll"><tbody>
<tr><td>No</td><td>Nomor Perkara</td><td>Klasifikasi</td></tr>
<tr><td>1</td><td>${N1}</td><td>Cerai Gugat</td></tr>
</tbody></table>`;

describe("lencana umur pindah ke kolom Lama Proses", () => {
  it("umur di kolom Lama Proses, teks SIPP masih ada di DOM tetapi disembunyikan CSS, tooltip tetap; lencana lain di Nomor Perkara", async () => {
    const h = buka(DAFTAR);
    const baris = await sampai(() => {
      const b = Array.from(h.d.querySelectorAll("#tablePerkaraAll tr"))[1] as HTMLTableRowElement;
      return b && b.cells[3].querySelector('[data-aleta-l2="lama"] button') ? b : null;
    }, "lencana umur di Lama Proses");
    const lama = baris.cells[3];
    const pil = lama.querySelector('[data-aleta-l2="lama"] button') as HTMLButtonElement;
    expect(pil.textContent).toBe("4 hari");
    expect(pil.getAttribute("data-kode")).toBe("umur-perkara");
    expect(pil.type).toBe("button");
    expect(pil.title).toContain("di luar mediasi");
    // Teks SIPP tidak dihapus, tidak dibungkus: simpul teksnya sendiri tetap anak sel.
    expect(Array.from(lama.childNodes).some((n) => n.nodeType === 3 && n.nodeValue === "4 Hari")).toBe(true);
    expect(lama.textContent).toContain("4 Hari");
    expect(lama.getAttribute("data-aleta-l2-lama")).toBe("1");
    const gaya = h.w.getComputedStyle(lama);
    expect(gaya.fontSize).toBe("0px");
    // Gaya pembungkus lencana mengembalikan ukuran huruf dan tidak terbungkus baris.
    const css = String(h.d.getElementById("aleta-l2-gaya")?.textContent || "");
    expect(css).toContain("td[data-aleta-l2-lama]{font-size:0!important");
    expect(css).toMatch(/td\[data-aleta-l2-lama\]>\.aleta-l2-lama\{[^}]*font-size:13px[^}]*white-space:nowrap/);
    // Kolom Nomor Perkara: tanpa umur, lencana lain tetap (Potensi verstek, PRODEO, ABT/ALETA).
    const nomor = baris.cells[1];
    const diNomor = Array.from(nomor.querySelectorAll('[data-aleta-l2="baris"] button')).map((b) => b.textContent);
    expect(diNomor).toEqual(["Potensi verstek"]);
    expect(nomor.querySelector(".aleta-l1-tautan")).not.toBeNull();
    expect(nomor.textContent).toContain("PRODEO");
    expect(nomor.textContent).not.toContain("4 hari");

    // Baris yang hanya punya lencana umur: kolom Nomor Perkara tanpa wadah sama sekali.
    const b2 = Array.from(h.d.querySelectorAll("#tablePerkaraAll tr"))[2] as HTMLTableRowElement;
    await sampai(() => b2.cells[3].querySelector('[data-aleta-l2="lama"] button'), "baris kedua");
    expect(b2.cells[1].querySelector('[data-aleta-l2="baris"]')).toBeNull();
    expect(b2.cells[3].textContent).toContain("1 Hari");

    // Hanya permintaan baca penanda; tidak ada tulisan ke SIPP.
    expect(h.kiriman.every((k) => k.url.startsWith("/aleta/api/aleta-ecourt/sipp-ide-l2"))).toBe(true);
    expect(h.kiriman.some((k) => k.url.startsWith("/SIPP/") || (k.cara !== "GET" && !k.url.includes("sipp-ide-l2")))).toBe(false);
  });

  it("kepala kolom dan kolom lain tidak disentuh; hanya sel Lama Proses yang bertanda", async () => {
    const h = buka(DAFTAR);
    await sampai(() => h.d.querySelectorAll('[data-aleta-l2="lama"]').length === 2, "dua lencana");
    const kepala = (h.d.querySelector("#tablePerkaraAll tr") as HTMLTableRowElement).cells[3];
    expect(kepala.hasAttribute("data-aleta-l2-lama")).toBe(false);
    expect(kepala.querySelector("[data-aleta-l2]")).toBeNull();
    const bertanda = Array.from(h.d.querySelectorAll("[data-aleta-l2-lama]")) as HTMLTableCellElement[];
    expect(bertanda.map((c) => c.cellIndex)).toEqual([3, 3]);
    // Penanda dimatikan (bersihkan) mencabut atributnya - teks SIPP tampil lagi.
    expect(KONTEN).toMatch(/function bersihkan\(\)[\s\S]*?removeAttribute\(ATR_LAMA\)/);
  });

  it("daftar tanpa kolom Lama Proses: lencana umur tetap di kolom Nomor Perkara", async () => {
    const h = buka(TANPA_LAMA);
    const pil = await sampai(() => h.d.querySelector('[data-aleta-l2="baris"] button[data-kode="umur-perkara"]'), "umur di nomor");
    expect(pil.textContent).toBe("4 hari");
    expect(h.d.querySelector('[data-aleta-l2="lama"]')).toBeNull();
    expect(h.d.querySelector("[data-aleta-l2-lama]")).toBeNull();
  });
});
