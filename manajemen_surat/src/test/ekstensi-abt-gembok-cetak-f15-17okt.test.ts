// @vitest-environment node
/**
 * ============================================================================
 * F1.5 (17 OKT 2026) - GEMBOK "RINGKAS OTOMATIS" DAN TOMBOL CETAK DI ABT BIASA
 * ============================================================================
 *
 * "Untuk tampilan ABT lama" = halaman ABT BIASA (daftar variabel blangko),
 * bukan Blangko ABT by Derry Briantono. Tampilan Lama EKSTENSI tidak berubah.
 *
 *   A. Gembok panel ABT: sama dengan panel SIPP (alatPasangGembok, situs
 *      "abt"), kunci sendiri gembokKepalaAbt - disimpan per akun (popup.js &
 *      latar.js KUNCI_SETELAN_AKUN), saklar di popup dan Widget ALETA.
 *      Tampilan Lama: tidak ada gembok.
 *   B. Cetak tepat di samping "Input semua yang pasti": naskah diambil dari
 *      tautan CETAK ABT (GET), lalu diperiksa - usulan pasti belum disimpan,
 *      isian kosong (Penting / Tidak wajib, tanda kuning + getar pada baris
 *      tabel ABT), penanda #NNNN# tersisa. "Simpan yang pasti, lalu cetak" =
 *      pratinjau Input semua yang pasti -> tulis -> periksa ulang -> cetak.
 *      "Tetap cetak" / tekan Cetak sekali lagi = cetak apa adanya, RTF yang
 *      sama dipakai ulang (tidak diminta dua kali). Saklar tiga berkas
 *      menentukan RTF saja atau RTF + PDF + anonim.
 *
 * panel-alat.js + abt.js dijalankan sungguhan di jsdom (pola uji 10 Okt).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_ABT = baca("abt.js");

const ASAL = "http://192.168.10.10";
const ASAL_ABT = `${ASAL}/aps_badilag/index.php/abt`;
const NOMOR = "533/Pdt.G/2026/PA.Dgl";
const CETAK = `${ASAL_ABT}/preview?c=10018&b=B&a=A`;
const ALAMAT = `${ASAL_ABT}/main/view?a=A&b=B&c=10018&d=3`;
const NAMA_RTF = `${NOMOR} - CG (Lite) Verstek F V.2.rtf`;

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${keterangan}`);
    await tunggu(10);
  }
}

// ─── A. Gembok (panel-alat.js saja) ─────────────────────────────────────────

type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type JsdomUji = JSDOM & { getInternalVMContext(): vm.Context };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) {
    const dom = terbuka.pop()!;
    const w = dom.window as any;
    for (const p of Array.from(w.document.querySelectorAll(".aleta-panel")) as any[]) {
      if (p.aletaPewaktuRingkas) w.clearInterval(p.aletaPewaktuRingkas);
    }
    dom.window.close();
  }
});

function bukaAlat(awal: Record<string, unknown> = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><table id="t"><tr><td>x</td></tr></table></body></html>`, {
    url: ALAMAT,
    runScripts: "outside-only",
  }) as JsdomUji;
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ...awal };
  const pendengar: Array<(u: Ubah, wil: string) => void> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (kunci: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const k of [kunci].flat()) if (k in simpanan) hasil[k] = simpanan[k];
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          const u: Ubah = {};
          for (const [k, v] of Object.entries(isi)) {
            u[k] = { oldValue: simpanan[k], newValue: v };
            simpanan[k] = v;
          }
          for (const f of pendengar) f(u, "local");
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Ubah, wil: string) => void) => void pendengar.push(f) },
    },
  };
  w.fetch = () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  const ctx = dom.getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(`alatUji.mode = ${JSON.stringify(awal.ujiTampilan === "lama" ? "lama" : "ui")};`, ctx);
  const doc = w.document as Document;
  const kotak = (el: Element, r: { left: number; top: number; right: number; bottom: number }) => {
    (el as any).getBoundingClientRect = () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top });
  };
  kotak(doc.getElementById("t")!, { left: 0, top: 0, right: 800, bottom: 900 });
  const panel = doc.createElement("div");
  panel.className = "aleta-panel aleta-panel-abt";
  panel.id = "aleta-panel-abt";
  const kepala = doc.createElement("div");
  kepala.className = "aleta-kepala";
  panel.appendChild(kepala);
  panel.appendChild(Object.assign(doc.createElement("div"), { className: "aleta-isi" }));
  doc.body.appendChild(panel);
  kotak(panel, { left: 500, top: 50, right: 950, bottom: 600 });
  const pasang = vm.runInContext("alatPasangGembok", ctx) as (p: Element, k: Element, s: string) => Promise<boolean> | null;
  const siarkan = (u: Ubah) => {
    for (const f of pendengar) f(u, "local");
  };
  return { w, panel, kepala, simpanan, pasang, siarkan };
}

describe("A. gembok 'Ringkas otomatis' di panel ABT biasa", () => {
  it("tampilan Lama: tidak ada gembok (Lama identik fd9aad7)", () => {
    const h = bukaAlat({ ujiTampilan: "lama" });
    expect(h.pasang(h.panel, h.kepala, "abt")).toBeNull();
    expect(h.panel.querySelector(".aleta-gembok-baris")).toBeNull();
    expect(h.panel.hasAttribute("data-aleta-gembok")).toBe(false);
  });

  it("bawaan terbuka = ringkas otomatis; dikunci = tampil penuh, tersimpan di gembokKepalaAbt (bukan kunci SIPP)", async () => {
    const h = bukaAlat({ gembokKepalaSipp: true });
    expect(await h.pasang(h.panel, h.kepala, "abt")).toBe(false);
    expect(h.kepala.nextElementSibling?.className).toBe("aleta-gembok-baris");
    expect(h.panel.querySelector(".aleta-gembok-label")!.textContent).toBe("Ringkas otomatis");
    await tunggu(5);
    expect(h.panel.getAttribute("data-aleta-kepala-ringkas")).toBe("ya");
    (h.panel.querySelector(".aleta-gembok") as HTMLButtonElement).click();
    await tunggu(5);
    expect(h.simpanan.gembokKepalaAbt).toBe(true);
    expect(h.simpanan.gembokKepalaSipp).toBe(true);
    expect(h.panel.getAttribute("data-aleta-gembok")).toBe("kunci");
    expect(h.panel.hasAttribute("data-aleta-kepala-ringkas")).toBe(false);
    expect(h.panel.querySelector(".aleta-gembok-label")!.textContent).toBe("Terkunci: tampil penuh");
  });

  it("diubah dari popup / Widget ALETA (kunci yang sama): panel ABT ikut seketika", async () => {
    const h = bukaAlat({ gembokKepalaAbt: true });
    expect(await h.pasang(h.panel, h.kepala, "abt")).toBe(true);
    expect(h.panel.getAttribute("data-aleta-gembok")).toBe("kunci");
    h.siarkan({ gembokKepalaAbt: { oldValue: true, newValue: false } });
    expect(h.panel.getAttribute("data-aleta-gembok")).toBe("buka");
    // Kunci SIPP tidak menyentuh panel ABT.
    h.siarkan({ gembokKepalaSipp: { oldValue: false, newValue: true } });
    expect(h.panel.getAttribute("data-aleta-gembok")).toBe("buka");
  });

  it("sinkron: popup, Widget ALETA, setelan per akun, CSS, dan pemasangnya memakai kunci yang sama", () => {
    const popupHtml = baca("popup.html");
    const popupJs = baca("popup.js");
    const latar = baca("latar.js");
    const derry = baca("blangko-derry.js");
    const css = baca("panel.css");
    expect(popupHtml).toMatch(/<input type="checkbox" id="gembokAbt">/);
    expect(popupJs).toMatch(/gembokAbt: \["gembokKepalaAbt", false\]/);
    expect(popupJs).toMatch(/kode: "abt", judul: "ABT", isi: \[[^\]]*"gembokAbt"/);
    const daftar = (sumber: string) => (sumber.match(/const KUNCI_SETELAN_AKUN = \[([\s\S]*?)\];/) || [])[1] || "";
    expect(daftar(popupJs)).toContain('"gembokKepalaAbt"');
    expect(daftar(latar)).toContain('"gembokKepalaAbt"');
    expect(derry).toMatch(/gembok: "gembokKepalaAbt"/);
    expect(derry).toMatch(/\["gembok", "Gembok panel ALETA di ABT biasa: selalu tampil penuh"/);
    expect(css).toMatch(/#aleta-panel-abt\[data-aleta-kepala-ringkas="ya"\]:not\(\[data-aleta-gembok="kunci"\]\)/);
    expect(SUMBER_ABT).toMatch(/alatPasangGembok\(panel, panel\.querySelector\(":scope > \.aleta-kepala"\), "abt"\)/);
  });
  it("butir 50-51 (17 Okt): panel massal ABT (putusan & BAS massal) juga bergembok - kunci & arti sama", async () => {
    // Pemasangnya di pasangMassalAbt, sesudah panel masuk halaman, situs "abt".
    const mulai = SUMBER_ABT.indexOf("async function pasangMassalAbt()");
    const fungsi = SUMBER_ABT.slice(mulai, SUMBER_ABT.indexOf("\n}", mulai));
    expect(fungsi).toMatch(/document\.body\.appendChild\(panel\);[\s\S]*alatPasangGembok\(panel, panel\.querySelector\(":scope > \.aleta-kepala"\), "abt"\)/);
    expect(baca("panel.css")).toMatch(/#aleta-panel-abt-massal\[data-aleta-kepala-ringkas="ya"\]:not\(\[data-aleta-gembok="kunci"\]\)/);
    expect(baca("popup.html")).toContain("panel massal di halaman depan ABT");
    // Perilakunya sama dengan panel ABT biasa: panel bernama massal, kunci gembokKepalaAbt.
    const h = bukaAlat({ gembokKepalaAbt: true });
    h.panel.id = "aleta-panel-abt-massal";
    expect(await h.pasang(h.panel, h.kepala, "abt")).toBe(true);
    expect(h.panel.getAttribute("data-aleta-gembok")).toBe("kunci");
    expect(h.panel.getAttribute("data-aleta-gembok-situs")).toBe("abt");
  });
});

// ─── B. Cetak di samping "Input semua yang pasti" (abt.js utuh) ─────────────

const ISI: Record<string, string> = {
  "0001": NOMOR,
  "0048": "Cerai Gugat",
  "0046": "Penggugat",
  "0047": "Tergugat",
  "5125": "Bahwa sejak bulan Maret 2024 sering terjadi perselisihan; sejak bulan Mei 2025 Tergugat pergi meninggalkan Penggugat;",
  "0033": "07 Oktober 2026",
  "0222": "DATA_TIDAK_ADA",
  "5227": "DATA_TIDAK_ADA",
  "0246": "DATA_TIDAK_ADA",
  "9944": "DATA_TIDAK_ADA",
  "0156": "DATA_TIDAK_ADA",
  "8523": "DATA_TIDAK_ADA",
  "8503": "F",
};
const NAMA: Record<string, string> = {
  "0001": "No Perkara",
  "0048": "Jenis Perkara",
  "5125": "POSITA LENGKAP",
  "0222": "Awal Konflik",
  "5227": "Alasan-Alasan Cerai",
  "0246": "Pisah Rumah",
  "9944": "Lama Pisah",
  "0156": "Nama Kantor Kuasa",
  "8523": "Pertimbangan Kuasa",
  "8503": "HURUF ALASAN PERCERAIAN (A-H GABUNGAN BEBAS)",
};
const S = (kalimat: string, saksi: number) => ({ saksi, kalimat });
const SAKSI = {
  butir: { saksi1: 2, saksi2: 2 },
  selisih: [],
  ciri: ["perselisihan terus-menerus"],
  ciriSepihak: [],
  ciriDiluarGugatan: [],
  ciriBelumTerbukti: [],
  gugatanTerbaca: true,
  huruf: [],
  hurufTidakDiusulkan: [],
  hurufBelumSiap: [],
  usulan: [
    {
      kode: "0246",
      nama: "Pisah Rumah",
      nilai: "bulan Mei 2025",
      keyakinan: "pasti",
      bentrok: "",
      catatan: "",
      sumber: [S("pisah tempat tinggal sejak bulan Mei 2025", 1), S("pisah sejak Mei 2025", 2)],
      kesepakatan: "sama",
      tingkat: "pasti",
      dasarTingkat: "sama",
    },
  ],
};
const SIPP = {
  ok: true,
  jumlahKuasa: 1,
  prodeo: false,
  usulan: [{ kode: "0156", nama: "Nama Kantor Kuasa", nilai: "Kantor Hukum Ma'ruf & Rekan", keyakinan: "pasti", sumber: [{ keterangan: "SIPP" }] }],
};
const RTF = "{\\rtf1\\ansi Putusan Nomor 533/Pdt.G/2026/PA.Dgl ... #9999# ... }";

type Minta = { url: string; cara: string; badan: string };

function tabel(isi: Record<string, string>) {
  return Object.keys(isi)
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>${NAMA[k] || `Variabel ${k}`}</td>` +
        `<td>${isi[k]}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`
    )
    .join("");
}
function halamanHtml(isi: Record<string, string>, tanpaCetak = false) {
  return (
    `<div id="wrapper"><div id="cssmenu"></div><div id="content"><h3 class="w3l_header"><span>${NOMOR}</span></h3>` +
    `<h2>CG (Lite) Verstek F V.2</h2>` +
    (tanpaCetak ? "" : `<p class="cetak"><a id="cetak" href="${CETAK}">CETAK</a></p>`) +
    `<table>${tabel(isi)}</table></div></div>`
  );
}

type Halaman = { w: any; minta: Minta[]; tersimpan: Record<string, string>; pesan: any[]; simpanan: Record<string, unknown> };

function buka(opsi: { simpanan?: Record<string, unknown>; tanpaCetak?: boolean; isi?: Record<string, string>; rtf?: string; tahanUsulan?: boolean } = {}): Halaman {
  const isiHalaman = opsi.isi || ISI;
  const naskah = opsi.rtf ?? RTF;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${halamanHtml(isiHalaman, opsi.tanpaCetak)}</body></html>`, {
    url: ALAMAT,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiFitur: {}, ujiIzinkanNyata: true, ...(opsi.simpanan || {}) };
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  const pesan: any[] = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.203.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (p: unknown, balik?: (x: unknown) => void) => {
        pesan.push(p);
        if (balik) balik({ ok: true });
      },
      lastError: undefined,
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (baru: Record<string, unknown>) => {
          const ubah: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(baru)) {
            ubah[k] = { oldValue: polos(simpanan[k]), newValue: polos(v) };
            simpanan[k] = polos(v);
          }
          setTimeout(() => {
            for (const f of [...pendengar]) f(polos(ubah), "local");
          }, 0);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Minta[] = [];
  const tersimpan: Record<string, string> = {};
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(Buffer.from(isi, "utf8"), { status: 200, headers: { "content-type": "text/html" } });
  const jawab = (url: string, cara: string, badan: string): Response => {
    if (url.includes("/aleta-bot/abt/usulan")) {
      const muatan = JSON.parse(badan || "{}");
      if (muatan.sumber === "siapa") return json({ data: { available: true, pengguna: { nama: "Uji Hakim", peran: "Hakim" }, kapabilitas: {} } });
      if (muatan.sumber === "sipp") return json({ data: { available: true, sipp: SIPP } });
      if (muatan.sumber === "saksi") return json({ data: { available: true, saksi: SAKSI } });
      return json({ data: { available: true } });
    }
    if (url.includes("/aleta-bot/sipp/posita")) return json({ data: { available: true, berubah: false, alasan: "sudah rapi" } });
    if (url.includes("/aleta-ecourt/abt-wajib")) return json({ ok: true, data: { jenis: "Cerai Gugat", variabel: [], catatan: "" } });
    if (url.includes("/aleta-ecourt/abt-riwayat")) return json({ ok: true, data: { daftar: [] } });
    if (url.includes("/edit_data?")) {
      if (cara === "POST") {
        const kode = new URL(url).searchParams.get("no_var") || "";
        tersimpan[kode] = new URLSearchParams(badan).get("value") || "";
        return html("<b>DATA DISIMPAN</b>");
      }
      return html('<input type="hidden" name="var_type" value="data_teks">');
    }
    if (url === CETAK && cara === "GET") {
      return new Response(Buffer.from(naskah, "latin1"), {
        status: 200,
        headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="${NAMA_RTF}"` },
      });
    }
    if (url === ALAMAT && cara === "GET") return html(`<html><body>${halamanHtml({ ...isiHalaman, ...tersimpan })}</body></html>`);
    if (url.includes("/aps_badilag/") && cara === "GET") return html("<html><body></body></html>");
    return json({ ok: false, error: { message: "tidak ada" } }, 404);
  };
  w.fetch = async (alamat: string, o?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(o?.method || "GET").toUpperCase();
    const b = typeof o?.body === "string" ? o.body : o?.body ? String(o.body) : "";
    minta.push({ url, cara, badan: b });
    // Audit D8: usulan SIPP/saksi tidak pernah tiba -> bagian "Isi dari SIPP" tidak pernah tergambar.
    if (opsi.tahanUsulan && url.includes("/aleta-bot/abt/usulan") && JSON.parse(b || "{}").sumber !== "siapa") return new Promise<Response>(() => undefined);
    return jawab(url, cara, b);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  w.confirm = () => false;
  w.document.addEventListener("click", (e: any) => {
    const a = e.target && e.target.closest && e.target.closest("a[href]");
    if (a) e.preventDefault();
  });
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_ABT}\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`);
  return { w, minta, tersimpan, pesan, simpanan };
}

const panelDari = (h: Halaman) => h.w.document.getElementById("aleta-panel-abt") as any;
const q = (h: Halaman, pemilih: string) => panelDari(h)?.querySelector(pemilih) as any;
const tulisAbt = (h: Halaman) => h.minta.filter((m) => m.cara !== "GET" && m.url.includes("/aps_badilag/"));
const ambilCetak = (h: Halaman) => h.minta.filter((m) => m.url === CETAK);
const unduhan = (h: Halaman) => h.pesan.filter((p) => p && p.jenis === "unduh");
const baris = (h: Halaman, kode: string) => h.w.document.getElementById(kode).parentElement as HTMLElement;
const siap = (h: Halaman) => sampai(() => (q(h, ".aleta-sore-input-pasti") && !q(h, ".aleta-sore-input-pasti").hidden ? q(h, ".aleta-f15-cetak") : null), "tombol Cetak siap");

describe("B. tombol Cetak di samping 'Input semua yang pasti'", () => {
  it("letaknya tepat sesudah 'Input semua yang pasti', satu baris dengan tombol Input", async () => {
    const h = buka();
    const cetak = await siap(h);
    expect(cetak.textContent).toBe("Cetak");
    expect(cetak.previousElementSibling.classList.contains("aleta-sore-input-pasti")).toBe(true);
    expect(cetak.parentElement.classList.contains("aleta-sore-tindakan")).toBe(true);
    expect(cetak.title).toContain("Sebelum mencetak");
  });

  it("audit D8: tombol Cetak sudah ada begitu panel tersusun - tanpa menunggu 'Isi dari SIPP' tergambar - dan tidak dobel sesudahnya", async () => {
    const h = buka({ tahanUsulan: true });
    const cetak = await sampai(() => q(h, ".aleta-f15-cetak"), "tombol Cetak sebelum Isi dari SIPP");
    await tunggu(300);
    expect(q(h, ".aleta-sore-input-pasti")).toBeNull(); // bagian Isi dari SIPP memang belum tergambar
    expect(panelDari(h).querySelectorAll(".aleta-f15-cetak")).toHaveLength(1);
    expect(cetak.textContent).toBe("Cetak");
    cetak.click();
    await sampai(() => ambilCetak(h).length === 1, "naskah diambil dari ABT");
    expect(tulisAbt(h)).toEqual([]);
    // Sesudah Isi dari SIPP tergambar: tetap SATU tombol, di samping 'Input semua yang pasti'.
    const h2 = buka();
    const c2 = await siap(h2);
    await tunggu(300);
    expect(panelDari(h2).querySelectorAll(".aleta-f15-cetak")).toHaveLength(1);
    expect(c2.previousElementSibling.classList.contains("aleta-sore-input-pasti")).toBe(true);
  });

  it("tekanan pertama: naskah diambil (GET) dan diperiksa - pasti belum disimpan, Penting/Tidak wajib, penanda #; NOL tulisan, NOL unduhan", async () => {
    const h = buka();
    (await siap(h)).click();
    const ingat = await sampai(() => (q(h, ".aleta-f15-ingat") && !q(h, ".aleta-f15-ingat").hidden ? q(h, ".aleta-f15-ingat") : null), "pemberitahuan");
    const teks = ingat.textContent as string;
    expect(teks).toContain("2 usulan pasti dari SIPP belum disimpan ke ABT");
    // Penting: kerangka fakta (0222/5227/0246/9944) dan isian tangan (0156 data_teks) yang kosong.
    expect(teks).toMatch(/Penting - sebaiknya diisi sebelum cetak \(5\)/);
    for (const nama of ["Awal Konflik", "Alasan-Alasan Cerai", "Pisah Rumah", "Lama Pisah", "Nama Kantor Kuasa"]) expect(teks).toContain(nama);
    // Tidak wajib: kosong yang disusun ABT sendiri (tipe bukan isian tangan).
    expect(teks).toMatch(/Tidak wajib \(1\)Pertimbangan Kuasa/);
    expect(teks).toContain("Ada 1 bagian naskah yang belum terisi otomatis.");
    // Kode teknis tidak tampil bagi hakim.
    expect(teks).not.toContain("#9999#");
    expect(Array.from(ingat.querySelectorAll("button")).map((b: any) => b.textContent)).toEqual(["Simpan 2 yang pasti, lalu cetak", "Isi dulu", "Tetap cetak"]);
    // Tanda kuning + getar pada baris tabel ABT; yang tidak wajib bergaris lembut.
    for (const k of ["0222", "5227", "0246", "9944", "0156"]) {
      expect(baris(h, k).classList.contains("aleta-f15-kosong")).toBe(true);
      expect(baris(h, k).classList.contains("aleta-f15-getar")).toBe(true);
      expect(baris(h, k).classList.contains("aleta-f15-tambahan")).toBe(false);
    }
    expect(baris(h, "8523").classList.contains("aleta-f15-tambahan")).toBe(true);
    expect(baris(h, "0156").classList.contains("aleta-f15-tambahan")).toBe(false);
    expect(baris(h, "0001").classList.contains("aleta-f15-kosong")).toBe(false);
    expect(ambilCetak(h).map((m) => m.cara)).toEqual(["GET"]);
    await tunggu(30);
    expect(tulisAbt(h)).toEqual([]);
    expect(unduhan(h)).toEqual([]);
  });

  it("Tetap cetak: satu .rtf diunduh dengan nama baku, naskah yang SAMA dipakai ulang (GET preview hanya sekali)", async () => {
    const h = buka();
    (await siap(h)).click();
    await sampai(() => (q(h, ".aleta-f15-ingat") && !q(h, ".aleta-f15-ingat").hidden ? true : null), "pemberitahuan");
    const tetap = Array.from(q(h, ".aleta-f15-ingat").querySelectorAll("button")).find((b: any) => b.textContent === "Tetap cetak") as any;
    tetap.click();
    await sampai(() => unduhan(h).length === 1, "unduhan");
    expect(unduhan(h)[0].nama).toMatch(/\.rtf$/);
    expect(unduhan(h)[0].nama).toContain("533_Pdt.G_2026_PA.Dgl");
    expect(ambilCetak(h).length).toBe(1);
    await sampai(() => /Dicetak \d\d\.\d\d/.test(q(h, ".aleta-f15-kabar").textContent), "kabar dicetak");
    expect(q(h, ".aleta-f15-ingat").hidden).toBe(true);
    expect(tulisAbt(h)).toEqual([]);
  });

  it("tekan Cetak sekali lagi sesudah pemberitahuan = tetap cetak", async () => {
    const h = buka();
    const cetak = await siap(h);
    cetak.click();
    await sampai(() => (q(h, ".aleta-f15-ingat") && !q(h, ".aleta-f15-ingat").hidden ? true : null), "pemberitahuan");
    await sampai(() => !cetak.disabled, "tombol bebas");
    cetak.click();
    await sampai(() => unduhan(h).length === 1, "unduhan");
  });

  it("urutan aman: Simpan yang pasti -> pratinjau 'Ya, simpan 2 lalu cetak' -> tulis -> periksa ulang (naskah diambil ulang) -> cetak", async () => {
    const h = buka();
    (await siap(h)).click();
    await sampai(() => (q(h, ".aleta-f15-ingat") && !q(h, ".aleta-f15-ingat").hidden ? true : null), "pemberitahuan");
    (Array.from(q(h, ".aleta-f15-ingat").querySelectorAll("button")).find((b: any) => /yang pasti, lalu cetak/.test(b.textContent)) as any).click();
    const simpan = await sampai(() => q(h, ".aleta-s5-simpan"), "pratinjau");
    expect(simpan.textContent).toBe("Ya, simpan 2 lalu cetak");
    expect(tulisAbt(h)).toEqual([]);
    simpan.click();
    // Sesudah tersimpan, pemeriksaan berjalan lagi: yang pasti tidak lagi disebut, yang kosong masih.
    const ingat = await sampai(
      () => (ambilCetak(h).length === 2 && q(h, ".aleta-f15-ingat") && !q(h, ".aleta-f15-ingat").hidden ? q(h, ".aleta-f15-ingat") : null),
      "periksa ulang"
    );
    expect(Object.keys(h.tersimpan).sort()).toEqual(["0156", "0246"]);
    expect(ingat.textContent).not.toContain("usulan pasti");
    expect(ingat.textContent).toMatch(/Penting - sebaiknya diisi sebelum cetak \(3\)/);
    // Tulisan ke ABT mendahului pengambilan naskah yang kedua.
    const iTulis = h.minta.findIndex((m) => m.cara === "POST" && m.url.includes("/edit_data?"));
    const iNaskah2 = h.minta.findIndex((m, i) => m.url === CETAK && i > iTulis);
    expect(iTulis).toBeGreaterThan(-1);
    expect(iNaskah2).toBeGreaterThan(iTulis);
    expect(unduhan(h)).toEqual([]);
    (Array.from(ingat.querySelectorAll("button")).find((b: any) => b.textContent === "Tetap cetak") as any).click();
    await sampai(() => unduhan(h).length === 1, "unduhan sesudah simpan");
  });

  it("keputusan 17 Okt: hanya isian Tidak wajib yang kosong -> TIDAK menahan cetak; langsung tercetak dengan catatan kecil", async () => {
    const isi = {
      ...ISI,
      "0222": "tahun 2024",
      "5227": "perselisihan dan pertengkaran terus-menerus",
      "0246": "bulan Mei 2025",
      "9944": "1 tahun 5 bulan",
      "0156": "Kantor Hukum Ma'ruf & Rekan",
    };
    const h = buka({ isi, rtf: "{\\rtf1\\ansi Putusan Nomor 533/Pdt.G/2026/PA.Dgl ... }" });
    // Tidak ada usulan pasti (semua sudah sama) - tombol Input pasti tersembunyi, Cetak tetap terpasang.
    const cetak = await sampai(() => q(h, ".aleta-f15-cetak"), "tombol Cetak terpasang");
    await sampai(() => h.minta.some((m) => m.url.includes("/aleta-bot/abt/usulan") && JSON.parse(m.badan || "{}").sumber === "saksi"), "usulan termuat");
    await tunggu(300);
    cetak.click();
    await sampai(() => unduhan(h).length === 1, "unduhan tanpa pemberitahuan");
    expect(q(h, ".aleta-f15-ingat").hidden).toBe(true);
    await sampai(() => /Dicetak \d\d\.\d\d/.test(q(h, ".aleta-f15-kabar").textContent), "kabar dicetak");
    expect(q(h, ".aleta-f15-kabar").textContent).toContain("(1 isian tidak wajib masih kosong)");
    expect(ambilCetak(h).length).toBe(1);
    expect(tulisAbt(h)).toEqual([]);
  });

  it("saklar pengingat isian kosong mati: isian kosong tidak disebut; penanda # tetap diperiksa", async () => {
    const h = buka({ simpanan: { blangkoDerryIngat: false } });
    (await siap(h)).click();
    const ingat = await sampai(() => (q(h, ".aleta-f15-ingat") && !q(h, ".aleta-f15-ingat").hidden ? q(h, ".aleta-f15-ingat") : null), "pemberitahuan");
    expect(ingat.textContent).not.toContain("Penting");
    expect(ingat.textContent).not.toContain("Tidak wajib");
    expect(ingat.textContent).toContain("bagian naskah yang belum terisi otomatis");
    expect(baris(h, "0222").classList.contains("aleta-f15-kosong")).toBe(false);
  });

  it("saklar tiga berkas menyala: label 'Cetak · 3 berkas', RTF dari naskah yang sama lalu PDF & anonim dicoba", async () => {
    const h = buka({ simpanan: { cetakTigaBerkas: true } });
    const cetak = await siap(h);
    expect(cetak.textContent).toBe("Cetak · 3 berkas");
    cetak.click();
    await sampai(() => (q(h, ".aleta-f15-ingat") && !q(h, ".aleta-f15-ingat").hidden ? true : null), "pemberitahuan");
    (Array.from(q(h, ".aleta-f15-ingat").querySelectorAll("button")).find((b: any) => b.textContent === "Tetap cetak") as any).click();
    await sampai(() => /RTF tersimpan/.test(q(h, ".aleta-f15-kabar").textContent), "ringkasan tiga berkas");
    expect(ambilCetak(h).length).toBe(1);
    expect(h.minta.some((m) => m.cara === "POST" && m.url.includes("/main/anonim"))).toBe(true);
    await sampai(() => unduhan(h).length >= 1, "unduhan rtf");
    expect(unduhan(h)[0].nama).toMatch(/\.rtf$/);
  });

  it("halaman tanpa tautan CETAK ABT (mis. BAS menunggu validasi): tombol tidak aktif dan tidak mengambil apa pun", async () => {
    const h = buka({ tanpaCetak: true });
    const cetak = await siap(h);
    expect(cetak.getAttribute("aria-disabled")).toBe("true");
    cetak.click();
    await sampai(() => /belum dapat dicetak/.test(q(h, ".aleta-f15-kabar").textContent), "kabar");
    expect(ambilCetak(h)).toEqual([]);
  });

  it("tampilan Lama ekstensi: tidak ada tombol Cetak panel dan tidak ada gembok", async () => {
    const h = buka({ simpanan: { ujiTampilan: "lama" } });
    await sampai(() => panelDari(h), "panel");
    await tunggu(300);
    expect(h.w.document.querySelector(".aleta-f15-cetak")).toBeNull();
    expect(panelDari(h).querySelector(".aleta-gembok-baris")).toBeNull();
  });
});
