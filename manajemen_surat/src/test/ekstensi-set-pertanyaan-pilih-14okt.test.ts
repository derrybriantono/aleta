// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * 14 OKT - "SET PERTANYAAN ALETA" DI BORANG SUSUN KETERANGAN SAKSI (ABT)
 * ============================================================================
 *
 * Laporan (tangkapan 13 Okt 59/60): pilihan set tampil sebagai kotak besar
 * dengan "— tidak dipakai —" di tengah, dan daftarnya baru keluar pada klik
 * KEDUA.
 *
 * Diukur di replika ABT (markup/CSS ABT asli + skrip ekstensi utuh, Chromium):
 *   1. Tinggi: .aleta-sdg-ruas berarah kolom, sehingga `flex: 1 1 200px` milik
 *      .aleta-sdg-set-aleta menjadi TINGGI 200px (608x200; templat 608x30).
 *   2. Dua klik: pilihan itu sendiri terbuka dengan SATU klik (tidak ada
 *      penangkap yang membatalkan bawaan, tidak ada gulir/gambar ulang). Klik
 *      pertama adalah tombol "Pilih dari set pertanyaan baku": ia hanya memuat
 *      daftar lalu menukar dirinya dengan pilihan TERTUTUP - daftar baru
 *      keluar pada klik kedua. Kini daftar dibuka (showPicker) begitu termuat.
 *
 * panel-alat.js dan abt.js dijalankan UTUH di jsdom; sisi CSS dibaca dari
 * panel.css.
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const SUMBER_ALAT = readFileSync(path.join(AKAR, "panel-alat.js"), "utf8");
const SUMBER_ABT = readFileSync(path.join(AKAR, "abt.js"), "utf8");
const GAYA = readFileSync(path.join(AKAR, "panel.css"), "utf8").replace(/\r\n/g, "\n");

const TEMPLAT = [
  { urutan_pertanyaan: "1", pertanyaan: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawaban: "Ya, saya kenal;" },
  { urutan_pertanyaan: "2", pertanyaan: "Apakah masih ada keterangan yang saksi akan sampaikan?", jawaban: "Sudah cukup;" },
];
const DAFTAR_SET = [
  { namaSet: "cg-bas", label: "Cerai gugat - praktik BAS satker", jumlah: 18, adaIsi: true, contoh: { saksiSidang: 3324 } },
  { namaSet: "cg-a1a", label: "Cerai gugat - saksi Penggugat (templat ABT A1a)", jumlah: 16, adaIsi: true },
  { namaSet: "cg-tambahan", label: "tambahan", jumlah: 2, adaIsi: true, tambahan: true },
];

const r = (status: number, badan: string) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => badan,
  json: async () => JSON.parse(badan),
  clone() {
    return this;
  },
});

function jaringan(jedaSetMs = 0) {
  const muatanSet: any[] = [];
  const fetch = async (alamat: string, o: any = {}) => {
    const a = String(alamat);
    if (a.includes("/tanyajawab_template_edit?")) return r(200, `<script>\n var ajax_data = ${JSON.stringify(TEMPLAT)} \n</script>`);
    if (a.includes("/tanyajawab_perkara_edit?")) {
      if (String(o.body || "").includes("load_template")) {
        return r(200, `<script>\n var ajax_data = ${JSON.stringify(Object.fromEntries(TEMPLAT.map((b, i) => [String(i), b])))} \n</script>`);
      }
      return r(200, `<select><option value=''>--> Load Template <--</option><option value='04'>(04) Pertanyaan Saksi CG</option></select><script>\n var ajax_data = [] \n</script>`);
    }
    if (a.includes("/edit_data?")) return r(200, '<input type="hidden" name="var_type" value="data_teks">');
    if (a.endsWith("/aleta/api/aleta-bot/abt/usulan")) {
      const muatan = JSON.parse(String(o.body || "{}"));
      if (muatan.sumber === "pertanyaan-saksi") {
        muatanSet.push(muatan);
        if (jedaSetMs) await new Promise((s) => setTimeout(s, jedaSetMs));
        return r(200, JSON.stringify({ data: { available: true, pertanyaanSaksi: { ok: true, daftar: DAFTAR_SET, huruf: [] } } }));
      }
      return r(401, "{}");
    }
    return r(401, "{}");
  };
  return { fetch, muatanSet };
}

const KODE = "0001 0048 0046 0047 5125 2021 2022 0222 5227 9944 7035 1268".split(" ");
const ISI: Record<string, string> = {
  "0046": "Penggugat",
  "0047": "Tergugat",
  "0048": "Cerai Gugat",
  "5125": "Bahwa sejak tahun 2024 sering terjadi perselisihan;",
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  while (terbuka.length) {
    const dom = terbuka.pop()!;
    for (let i = 0; i < 100 && !dom.window.document.getElementById("aleta-panel-abt"); i += 1) await new Promise((s) => setTimeout(s, 10));
    await new Promise((s) => setTimeout(s, 30));
    dom.window.close();
  }
});

function bukaBlangko(simpananAwal: Record<string, unknown>, fetch: (a: string, o?: any) => Promise<any>) {
  const baris = KODE.map(
    (k) =>
      `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td><td>${k in ISI ? ISI[k] : `isi ${k}`}</td>` +
      `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','');">edit</a></td></tr>`
  ).join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="content">` +
      `<h3 class="w3l_header"><span>123/Pdt.G/2026/PA.Dgl</span></h3><table>${baris}</table></div></div></body></html>`,
    { url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3", runScripts: "outside-only" }
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ...simpananAwal };
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
  w.fetch = fetch;
  w.console.warn = () => {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  // Perekam showPicker: jsdom tidak memilikinya; Chrome memilikinya sejak 121.
  const dibukaPicker: any[] = [];
  w.HTMLSelectElement.prototype.showPicker = function showPicker(this: any) {
    dibukaPicker.push(this);
  };
  w.eval(SUMBER_ALAT + "\n;\n" + SUMBER_ABT + '\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);');
  return { w, dibukaPicker };
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
const tombolBertulis = (w: any, teks: string) =>
  Array.from(panelDari(w)?.querySelectorAll("button") || []).find((b: any) => b.textContent === teks) as any;

async function bukaBorangSaksi(simpanan: Record<string, unknown>, jedaSetMs = 0) {
  const net = jaringan(jedaSetMs);
  const h = bukaBlangko(simpanan, net.fetch);
  (await tunggu(() => tombolBertulis(h.w, "Susun keterangan saksi 1 & 2"), "tombol SDG")).click();
  const form = await tunggu(() => panelDari(h.w).querySelector(".aleta-sdg-form"), "borang SDG");
  return { ...h, net, form };
}

/** Isi deklarasi CSS untuk satu pemilih persis. */
function deklarasi(pemilih: string): string[] {
  const hasil: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(GAYA.replace(/\/\*[\s\S]*?\*\//g, "")))) {
    const daftar = m[1].split(",").map((s) => s.trim());
    if (daftar.includes(pemilih)) hasil.push(m[2]);
  }
  return hasil;
}

describe("Set pertanyaan ALETA: satu baris, selebar kolom", () => {
  it("baris berarah kolom, dan pilihan set tidak membawa flex-basis/tinggi yang menjadi kotak 200px", () => {
    expect(deklarasi(".aleta-sdg-ruas").join(";")).toMatch(/flex-direction:\s*column/);
    const aturanSet = deklarasi(".aleta-sdg-baris-set-aleta .aleta-sdg-set-aleta");
    expect(aturanSet.length).toBeGreaterThan(0);
    for (const isi of [...aturanSet, ...deklarasi(".aleta-sdg-set-aleta"), ...deklarasi(".aleta-sdg-pilih")]) {
      // Pada wadah kolom, flex-basis = tinggi. Hanya auto/0-tumbuh yang boleh.
      const flex = /(?:^|;)\s*flex\s*:\s*([^;]+)/.exec(isi);
      if (flex) expect(flex[1].trim()).toMatch(/^(none|0 0 auto|auto|0 1 auto|initial)$/);
      expect(isi).not.toMatch(/(?:^|;)\s*flex-(?:basis|grow)\s*:/);
      expect(isi).not.toMatch(/(?:^|;)\s*(?:min-)?height\s*:/);
    }
  });

  it("pilihan set adalah dropdown biasa (bukan multiple/size) berkelas sama dengan Blangko tanya jawab", async () => {
    const { form } = await bukaBorangSaksi({ ujiTampilan: "ui" });
    const templat = form.querySelector("label.aleta-sdg-ruas > select.aleta-sdg-pilih");
    const set = form.querySelector(".aleta-sdg-baris-set-aleta > select.aleta-sdg-set-aleta");
    expect(templat).not.toBeNull();
    expect(set).not.toBeNull();
    expect(set.classList.contains("aleta-sdg-pilih")).toBe(true);
    expect(set.multiple).toBe(false);
    expect(set.hasAttribute("size")).toBe(false);
    expect(set.getAttribute("style")).toBeNull();
  });
});

describe("Set pertanyaan ALETA: SATU klik membuka daftar", () => {
  it("menekan tombol 'Pilih dari set...' sekali: daftar termuat, pilihan tampil, terfokus, dan showPicker dipanggil", async () => {
    const { w, form, net, dibukaPicker } = await bukaBorangSaksi({ ujiTampilan: "ui" });
    const baris = form.querySelector(".aleta-sdg-baris-set-aleta");
    const tombol = baris.querySelector("button");
    const pilih = baris.querySelector("select.aleta-sdg-set-aleta");
    expect(pilih.hidden).toBe(true);
    expect(tombol.hidden).toBe(false);
    expect(net.muatanSet).toHaveLength(0); // membuka borang tidak meminta apa pun

    tombol.click();
    await tunggu(() => !pilih.hidden, "pilihan set tampil");
    expect(net.muatanSet).toHaveLength(1);
    expect(tombol.hidden).toBe(true);
    expect(dibukaPicker).toEqual([pilih]);
    expect(w.document.activeElement).toBe(pilih);
    // Set "tambahan" tidak ditawarkan; dua set + "tidak dipakai".
    expect(Array.from(pilih.options).map((o: any) => o.value)).toEqual(["", "cg-bas", "cg-a1a"]);
  });

  it("showPicker yang ditolak (aktivasi pengguna habis) tidak menggagalkan apa pun - pilihan tetap tampil & terfokus", async () => {
    const { w, form } = await bukaBorangSaksi({ ujiTampilan: "baru" });
    w.HTMLSelectElement.prototype.showPicker = () => {
      throw new w.DOMException("showPicker() requires a user gesture", "NotAllowedError");
    };
    const baris = form.querySelector(".aleta-sdg-baris-set-aleta");
    const pilih = baris.querySelector("select.aleta-sdg-set-aleta");
    baris.querySelector("button").click();
    await tunggu(() => !pilih.hidden, "pilihan set tampil");
    expect(w.document.activeElement).toBe(pilih);
    expect(baris.querySelector("button").hidden).toBe(true);
    expect(pilih.options.length).toBe(3);
  });

  it("tidak ada pendengar yang membatalkan bawaan tekan/klik pada pilihan set maupun opsinya", async () => {
    const { w, form } = await bukaBorangSaksi({ ujiTampilan: "ui" });
    const baris = form.querySelector(".aleta-sdg-baris-set-aleta");
    const pilih = baris.querySelector("select.aleta-sdg-set-aleta");
    baris.querySelector("button").click();
    await tunggu(() => !pilih.hidden, "pilihan set tampil");
    const templat = form.querySelector("label.aleta-sdg-ruas > select.aleta-sdg-pilih");
    for (const sasaran of [pilih, pilih.options[1], templat]) {
      for (const jenis of ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick"]) {
        const Kelas = jenis.startsWith("pointer") && w.PointerEvent ? w.PointerEvent : w.MouseEvent;
        const e = new Kelas(jenis, { bubbles: true, cancelable: true, button: 0 });
        sasaran.dispatchEvent(e);
        expect(e.defaultPrevented, `${jenis} pada ${sasaran.tagName}`).toBe(false);
      }
    }
    // Memilih tetap berjalan: kotak huruf tambahan mengikuti pilihan.
    pilih.value = "cg-bas";
    pilih.dispatchEvent(new w.Event("change", { bubbles: true }));
    expect(form.querySelector(".aleta-sdg-set-huruf").hidden).toBe(false);
    pilih.value = "";
    pilih.dispatchEvent(new w.Event("change", { bubbles: true }));
    expect(form.querySelector(".aleta-sdg-set-huruf").hidden).toBe(true);
  });
});

describe("Tampilan Lama tetap tanpa baris Set pertanyaan", () => {
  it("borang Lama tidak memuat baris set maupun kotak huruf set", async () => {
    const { form, dibukaPicker } = await bukaBorangSaksi({ ujiTampilan: "lama" });
    expect(form.querySelector(".aleta-sdg-baris-set-aleta")).toBeNull();
    expect(form.querySelector(".aleta-sdg-set-huruf")).toBeNull();
    expect(dibukaPicker).toHaveLength(0);
  });
});
