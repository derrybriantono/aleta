/**
 * ============================================================================
 * T4 - TEMA GELAP/TERANG DI e-COURT (ecourt.mahkamahagung.go.id), 23 Okt 2026
 * ============================================================================
 *
 * Skrip sungguhan (tema-pusat.js + ecourt-tema.js) dijalankan di JSDOM yang
 * beralamat https://ecourt.mahkamahagung.go.id dengan chrome.storage,
 * localStorage, dan matchMedia tiruan. Yang dijaga:
 *
 *   1. gelap + saklar menyala -> penanda terpasang SINKRON (sebelum
 *      chrome.storage menjawab); terang / saklar mati -> halaman tak disentuh;
 *   2. pilihan SATU sumber (chrome.storage pilihanTema / salinan origin);
 *      e-Court hanya mengikuti, tidak pernah menulis ke chrome.storage;
 *   3. tanpa kedip: muat ulang dengan salinan -> penanda benar dari awal dan
 *      tidak ditulis ulang setelah chrome.storage menjawab;
 *   4. saklar (temaEcourt) hidup: dimatikan/dinyalakan dari popup langsung berlaku;
 *   5. "sistem" ikut tampilan sistem;
 *   6. isi/atribut halaman selain satu penanda tidak berubah;
 *   7. CSS: hanya warna, lewat token dengan cadangan di var(), berlaku hanya
 *      bila penanda ada; manifest memasang pada document_start.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(EKSTENSI, n), "utf8");
const SUMBER_PUSAT = baca("tema-pusat.js");
const SUMBER_ECOURT = baca("ecourt-tema.js");
const CSS = baca("ecourt-tema.css");

type Bebas = Record<string, any>;
const PENANDA = "data-aleta-tema-ecourt";

const HTML_CONTOH = `<!doctype html><html><head><title>Halaman contoh</title></head><body>
<nav class="navbar navbar-default"><a class="navbar-brand" href="#">Beranda</a></nav>
<div class="container"><div class="panel panel-default"><div class="panel-body">
<form><input class="form-control" type="text" name="cari"><select><option>a</option></select><button class="btn btn-default">Cari</button></form>
<table class="table table-striped"><thead><tr><th>Kolom</th></tr></thead><tbody><tr><td>Isi</td></tr></tbody></table>
</div></div></div></body></html>`;

const tunggu = () => new Promise<void>((s) => setTimeout(s, 0));
async function reda(kali = 6) {
  for (let i = 0; i < kali; i += 1) await tunggu();
}

function buatChromeTiruan(awal: Bebas = {}) {
  const gudang: Bebas = { ...awal };
  const pendengar: Array<(u: Bebas, t: string) => void> = [];
  const catat = { set: [] as Bebas[] };
  const chrome = {
    storage: {
      local: {
        get(kunci: string[], cb: (h: Bebas) => void) {
          const hasil: Bebas = {};
          for (const k of kunci) if (k in gudang) hasil[k] = gudang[k];
          setTimeout(() => cb(hasil), 0);
        },
        set(nilai: Bebas) {
          catat.set.push(nilai);
          return Promise.resolve();
        },
      },
      onChanged: { addListener: (fn: (u: Bebas, t: string) => void) => pendengar.push(fn), removeListener: () => undefined },
    },
  };
  /** Meniru popup/tab lain yang menulis chrome.storage. */
  const tulisDariLuar = (nilai: Bebas) => {
    const ubah: Bebas = {};
    for (const [k, v] of Object.entries(nilai)) {
      ubah[k] = { oldValue: gudang[k], newValue: v };
      gudang[k] = v;
    }
    pendengar.forEach((fn) => fn(ubah, "local"));
  };
  return { chrome, catat, tulisDariLuar };
}

interface Halaman {
  dom: JSDOM;
  html: HTMLElement;
  catat: { set: Bebas[] };
  tulisDariLuar: (n: Bebas) => void;
  mutasi: string[];
  sistem: { balik: (gelap: boolean) => void };
}

const dibuka: Halaman[] = [];
const penyimpananAntarMuat: Record<string, string> = {};

/** Satu pemuatan halaman e-Court: skrip dijalankan pada document_start. */
function bukaEcourt(opsi: { chrome?: Bebas; salinan?: Record<string, string>; sistemGelap?: boolean; hostLain?: string } = {}): Halaman {
  const dom = new JSDOM(HTML_CONTOH, { url: `https://${opsi.hostLain ?? "ecourt.mahkamahagung.go.id"}/Login`, runScripts: "outside-only" });
  const w = dom.window as unknown as Bebas;
  for (const [k, v] of Object.entries({ ...penyimpananAntarMuat, ...(opsi.salinan ?? {}) })) w.localStorage.setItem(k, v);
  const mq: Bebas = { matches: opsi.sistemGelap ?? false, addEventListener: (_n: string, fn: any) => (mq.fn = fn), removeEventListener: () => undefined };
  w.matchMedia = () => mq;
  const { chrome, catat, tulisDariLuar } = buatChromeTiruan(opsi.chrome ?? {});
  w.chrome = chrome;
  const html = w.document.documentElement as HTMLElement;
  const mutasi: string[] = [];
  new w.MutationObserver((daftar: MutationRecord[]) => {
    for (const r of daftar) mutasi.push(`${r.attributeName}=${(r.target as Element).getAttribute(r.attributeName!)}`);
  }).observe(html, { attributes: true, subtree: false });
  w.eval(SUMBER_PUSAT);
  w.eval(SUMBER_ECOURT);
  const h: Halaman = { dom, html, catat, tulisDariLuar, mutasi, sistem: { balik: (g) => { mq.matches = g; mq.fn?.({ matches: g }); } } };
  dibuka.push(h);
  return h;
}

/** Salinan localStorage origin e-Court yang ditinggalkan pemuatan sebelumnya. */
function salinanDari(h: Halaman): Record<string, string> {
  const ls = (h.dom.window as unknown as Bebas).localStorage as Storage;
  const hasil: Record<string, string> = {};
  for (let i = 0; i < ls.length; i += 1) hasil[ls.key(i)!] = ls.getItem(ls.key(i)!)!;
  return hasil;
}

afterEach(() => {
  while (dibuka.length) dibuka.pop()!.dom.window.close();
});

describe("1 - penanda gelap dipasang sinkron, terang membiarkan situs", () => {
  it("salinan gelap: penanda ada SEBELUM chrome.storage menjawab, dan satu-satunya atribut baru", () => {
    const h = bukaEcourt({ salinan: { "aleta-tema-pilihan": "gelap|100" } });
    expect(h.html.getAttribute(PENANDA)).toBe("gelap");
    expect(h.html.getAttributeNames()).toEqual([PENANDA]);
    expect(h.html.className).toBe("");
  });

  it("salinan terang: tidak ada penanda sama sekali", async () => {
    const h = bukaEcourt({ salinan: { "aleta-tema-pilihan": "terang|100" }, chrome: { pilihanTema: "terang", pilihanTemaWaktu: 100 } });
    await reda();
    expect(h.html.getAttributeNames()).toEqual([]);
  });

  it("kunjungan pertama tanpa salinan: bawaan produk (gelap); chrome 'terang' mencabutnya dan menyimpan salinan", async () => {
    const h = bukaEcourt({ chrome: { pilihanTema: "terang", pilihanTemaWaktu: 500 } });
    expect(h.html.getAttribute(PENANDA)).toBe("gelap");
    await reda();
    expect(h.html.hasAttribute(PENANDA)).toBe(false);
    expect(salinanDari(h)["aleta-tema-pilihan"]).toBe("terang|500");
  });

  it("host lain bukan e-Court: tidak diperlakukan sebagai e-Court (tidak ada penanda e-Court)", () => {
    const h = bukaEcourt({ hostLain: "192.168.10.10", salinan: { "aleta-tema-pilihan": "gelap|100" } });
    expect(h.html.hasAttribute(PENANDA)).toBe(false);
  });
});

describe("2 - satu sumber pilihan; e-Court hanya mengikuti", () => {
  it("chrome.storage yang lebih baru menang atas salinan lama; tidak ada penulisan balik ke chrome.storage", async () => {
    const h = bukaEcourt({ salinan: { "aleta-tema-pilihan": "terang|100" }, chrome: { pilihanTema: "gelap", pilihanTemaWaktu: 900 } });
    expect(h.html.hasAttribute(PENANDA)).toBe(false);
    await reda();
    expect(h.html.getAttribute(PENANDA)).toBe("gelap");
    expect(salinanDari(h)["aleta-tema-pilihan"]).toBe("gelap|900");
    expect(h.catat.set).toEqual([]);
  });

  it("pilihan diganti dari popup (chrome.storage berubah) berlaku langsung di tab e-Court yang terbuka", async () => {
    const h = bukaEcourt({ salinan: { "aleta-tema-pilihan": "gelap|100" }, chrome: { pilihanTema: "gelap", pilihanTemaWaktu: 100 } });
    await reda();
    h.tulisDariLuar({ pilihanTema: "terang", pilihanTemaWaktu: 200 });
    expect(h.html.hasAttribute(PENANDA)).toBe(false);
    h.tulisDariLuar({ pilihanTema: "gelap", pilihanTemaWaktu: 300 });
    expect(h.html.getAttribute(PENANDA)).toBe("gelap");
    expect(h.catat.set).toEqual([]);
  });

  it("nilai lama temaPanel (terang) dipetakan, bukan diabaikan", async () => {
    const h = bukaEcourt({ chrome: { temaPanel: "terang" } });
    await reda();
    expect(h.html.hasAttribute(PENANDA)).toBe(false);
  });
});

describe("3 - tanpa kedip antar halaman", () => {
  it("muat ulang dengan salinan yang sama: penanda benar dari awal dan TIDAK ditulis ulang", async () => {
    const pertama = bukaEcourt({ chrome: { pilihanTema: "gelap", pilihanTemaWaktu: 700 } });
    await reda();
    const salinan = salinanDari(pertama);
    expect(salinan["aleta-tema-pilihan"]).toBe("gelap|700");
    const kedua = bukaEcourt({ salinan, chrome: { pilihanTema: "gelap", pilihanTemaWaktu: 700 } });
    expect(kedua.html.getAttribute(PENANDA)).toBe("gelap");
    await reda();
    await tunggu();
    // Hanya pemasangan awal; sesudah chrome.storage menjawab tak ada perubahan atribut lagi.
    expect(kedua.mutasi.filter((m) => m !== `${PENANDA}=gelap`)).toEqual([]);
    expect(kedua.mutasi.length).toBeLessThanOrEqual(1);
  });
});

describe("4 - saklar popup 'Tema gelap di situs e-Court' (temaEcourt)", () => {
  it("dimatikan di chrome.storage: tema gelap tetap dipilih, tetapi situs dibiarkan asli", async () => {
    const h = bukaEcourt({ salinan: { "aleta-tema-pilihan": "gelap|100" }, chrome: { pilihanTema: "gelap", pilihanTemaWaktu: 100, temaEcourt: false } });
    await reda();
    expect(h.html.hasAttribute(PENANDA)).toBe(false);
    expect(salinanDari(h)["aleta-tema-ecourt"]).toBe("0");
  });

  it("dimatikan lalu dinyalakan saat tab terbuka: berlaku seketika", async () => {
    const h = bukaEcourt({ salinan: { "aleta-tema-pilihan": "gelap|100" }, chrome: { pilihanTema: "gelap", pilihanTemaWaktu: 100 } });
    await reda();
    expect(h.html.getAttribute(PENANDA)).toBe("gelap");
    h.tulisDariLuar({ temaEcourt: false });
    expect(h.html.hasAttribute(PENANDA)).toBe(false);
    h.tulisDariLuar({ temaEcourt: true });
    expect(h.html.getAttribute(PENANDA)).toBe("gelap");
    expect(h.catat.set).toEqual([]);
  });

  it("salinan 'mati' terbaca sinkron saat muat ulang: tidak ada penanda sedetik pun", () => {
    const h = bukaEcourt({ salinan: { "aleta-tema-pilihan": "gelap|100", "aleta-tema-ecourt": "0" } });
    expect(h.html.hasAttribute(PENANDA)).toBe(false);
    expect(h.mutasi).toEqual([]);
  });

  it("chrome belum pernah mencatat saklar tetapi salinan lama 'mati': bawaan (menyala) berlaku", async () => {
    const h = bukaEcourt({ salinan: { "aleta-tema-pilihan": "gelap|100", "aleta-tema-ecourt": "0" }, chrome: { pilihanTema: "gelap", pilihanTemaWaktu: 100 } });
    await reda();
    expect(h.html.getAttribute(PENANDA)).toBe("gelap");
  });

  it("saklar e-Court tidak ikut menggerakkan lapisan gelap SIPP (kunci terpisah)", async () => {
    const h = bukaEcourt({ chrome: { pilihanTema: "gelap", pilihanTemaWaktu: 1, temaSipp: false } });
    await reda();
    expect(h.html.getAttribute(PENANDA)).toBe("gelap");
  });
});

describe("5 - ikuti sistem", () => {
  it("sistem gelap -> penanda; sistem berganti terang -> dicabut; kembali gelap -> dipasang", async () => {
    const h = bukaEcourt({ sistemGelap: true, salinan: { "aleta-tema-pilihan": "sistem|100" }, chrome: { pilihanTema: "sistem", pilihanTemaWaktu: 100 } });
    await reda();
    expect(h.html.getAttribute(PENANDA)).toBe("gelap");
    h.sistem.balik(false);
    expect(h.html.hasAttribute(PENANDA)).toBe(false);
    h.sistem.balik(true);
    expect(h.html.getAttribute(PENANDA)).toBe("gelap");
  });

  it("sistem terang dari awal: situs dibiarkan", () => {
    const h = bukaEcourt({ sistemGelap: false, salinan: { "aleta-tema-pilihan": "sistem|100" } });
    expect(h.html.hasAttribute(PENANDA)).toBe(false);
  });
});

describe("6 - tidak mengubah isi atau perilaku situs", () => {
  it("DOM selain atribut penanda sama persis; tanpa <style>, kelas, atau elemen baru", async () => {
    const pembanding = new JSDOM(HTML_CONTOH).window.document;
    const h = bukaEcourt({ salinan: { "aleta-tema-pilihan": "gelap|100" }, chrome: { pilihanTema: "gelap", pilihanTemaWaktu: 100 } });
    await reda();
    const d = h.dom.window.document;
    expect(d.body.outerHTML).toBe(pembanding.body.outerHTML);
    expect(d.head.outerHTML).toBe(pembanding.head.outerHTML);
    expect(d.documentElement.getAttributeNames()).toEqual([PENANDA]);
    expect(h.catat.set).toEqual([]);
  });
});

describe("7 - CSS: hanya warna, lewat token, berlaku hanya bila ada penanda", () => {
  const blok = [...CSS.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ pemilih: m[1].trim(), isi: m[2] }));

  /** Memecah daftar pemilih pada koma tingkat atas (bukan yang di dalam kurung). */
  const pisahPemilih = (teks: string) => {
    const hasil: string[] = [];
    let dalam = 0;
    let awal = 0;
    for (let i = 0; i < teks.length; i += 1) {
      if (teks[i] === "(" || teks[i] === "[") dalam += 1;
      else if (teks[i] === ")" || teks[i] === "]") dalam -= 1;
      else if (teks[i] === "," && dalam === 0) {
        hasil.push(teks.slice(awal, i).trim());
        awal = i + 1;
      }
    }
    hasil.push(teks.slice(awal).trim());
    return hasil;
  };

  it("setiap aturan dibatasi penanda e-Court gelap", () => {
    expect(blok.length).toBeGreaterThan(20);
    for (const b of blok) expect(pisahPemilih(b.pemilih).every((p) => p.startsWith(`html[${PENANDA}="gelap"]`)), b.pemilih).toBe(true);
  });

  it("hanya properti warna (tanpa ukuran huruf, tampilan, posisi, isi)", () => {
    // 27 Okt: --bs-table-* dan box-shadow ikut boleh - tabel Bootstrap 5 mewarnai sorot/belang lewat
    // box-shadow inset 9999px dari variabel itu (warna saja, bukan ukuran atau tata letak).
    const boleh = /^(--ec-[a-z0-9-]+|--bs-table-[a-z-]+|background-color|color|border-color|border-(top|right|bottom|left)-color|color-scheme|opacity|box-shadow)$/;
    for (const b of blok) {
      for (const dekl of b.isi.split(";").map((x) => x.trim()).filter(Boolean)) {
        const nama = dekl.slice(0, dekl.indexOf(":")).trim();
        expect(boleh.test(nama), `${b.pemilih} -> ${nama}`).toBe(true);
      }
    }
  });

  it("angka warna hanya di deklarasi token dan di cadangan var(); tidak ada rgb/hsl telanjang", () => {
    for (const b of blok) {
      for (const dekl of b.isi.split(";").map((x) => x.trim()).filter(Boolean)) {
        const nama = dekl.slice(0, dekl.indexOf(":")).trim();
        if (nama.startsWith("--ec-")) continue;
        const nilai = dekl.slice(dekl.indexOf(":") + 1).replace(/var\(--ec-[a-z0-9-]+,\s*#[0-9a-f]{6}\)/gi, "");
        expect(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(nilai), `${b.pemilih} -> ${dekl}`).toBe(false);
      }
    }
  });

  it("cadangan var() sama dengan nilai token (tidak berselisih)", () => {
    const token: Record<string, string> = {};
    for (const m of CSS.matchAll(/(--ec-[a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)) token[m[1]] = m[2].toLowerCase();
    expect(Object.keys(token).length).toBeGreaterThan(10);
    for (const m of CSS.matchAll(/var\((--ec-[a-z0-9-]+),\s*(#[0-9a-f]{6})\)/gi)) expect(token[m[1]], m[1]).toBe(m[2].toLowerCase());
  });

  it("pemilih bekerja pada elemen umum hanya bila penanda ada (body, tabel, form, kartu, navbar)", () => {
    const d = new JSDOM(HTML_CONTOH).window.document;
    const semua = ["body", "table", "thead th", "td", ".panel-body", ".navbar", "input.form-control", "select", "button.btn-default"];
    const cocok = (el: Element) => blok.some((b) => { try { return el.matches(b.pemilih); } catch { return false; } });
    for (const s of semua) expect(cocok(d.querySelector(s)!), `${s} tanpa penanda`).toBe(false);
    d.documentElement.setAttribute(PENANDA, "gelap");
    for (const s of semua) expect(cocok(d.querySelector(s)!), `${s} dengan penanda`).toBe(true);
  });

  it("gambar, iframe, kanvas, dan captcha tidak punya aturan", () => {
    const d = new JSDOM(`<html data-aleta-tema-ecourt="gelap"><body><img id="a"><iframe id="b"></iframe><canvas id="c"></canvas><img id="d" class="captcha"></body></html>`).window.document;
    for (const id of ["a", "b", "c", "d"]) {
      const el = d.getElementById(id)!;
      expect(blok.some((b) => { try { return el.matches(b.pemilih); } catch { return false; } }), id).toBe(false);
    }
  });
});

describe("8 - manifest dan popup", () => {
  const manifest = JSON.parse(baca("manifest.json"));
  const entri = (manifest.content_scripts as Bebas[]).filter((c) => (c.matches as string[]).includes("https://ecourt.mahkamahagung.go.id/*"));

  it("tema dipasang document_start dengan pusat lebih dulu; skrip masuk e-Court tidak berubah", () => {
    const tema = entri.find((c) => (c.js as string[]).includes("ecourt-tema.js"))!;
    expect(tema.run_at).toBe("document_start");
    expect(tema.js).toEqual(["tema-pusat.js", "ecourt-tema.js"]);
    expect(tema.css).toEqual(["ecourt-tema.css"]);
    const masuk = entri.find((c) => (c.js as string[]).includes("ecourt-masuk.js"))!;
    // T1 (ALETA Ai tahap 2b) menambah gelembung chat SESUDAH skrip masuk; skrip masuk tetap pertama.
    expect(masuk.js).toEqual(["ecourt-masuk.js", "aleta-ai-gelembung.js"]);
    expect(masuk.run_at).toBe("document_idle");
    // Versi tidak lagi dikunci ke satu nomor (rilis 1.205.39 membuat angka itu basi); cukup berbentuk versi ekstensi seri 1.205.
    expect(manifest.version).toMatch(/^1\.205\.\d+$/);
  });

  it("saklar temaEcourt: kotak di popup (bawaan menyala), terdaftar per akun di popup dan latar", () => {
    expect(baca("popup.html")).toMatch(/<input type="checkbox" id="ecourtTema" checked>/);
    expect(baca("popup.js")).toMatch(/ecourtTema: \["temaEcourt", true\]/);
    expect(baca("popup.js")).toMatch(/\{ kode: "ecourt", judul: "E-Court", isi: \["ecourtTema"\] \}/);
    expect(baca("popup.js").match(/"temaEcourt"/g)?.length).toBeGreaterThanOrEqual(1);
    expect(baca("latar.js")).toMatch(/"temaEcourt",/);
  });
});
