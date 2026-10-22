// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * F4.3 (16 Okt 2026) - sisi ekstensi anonimisasi mandiri.
 *
 * abt.js (bagian 16OKT-F43) memanggil portal /putusan/anonim-mandiri dan
 * menampilkan pratinjau naskah anonim sebelum unggah e-Doc; Blangko Derry
 * (blangko-derry-isian.js) memakai penyamar ALETA lebih dulu dan anonimisasi
 * ABT hanya bila ALETA gagal. Jalur cadangan ABT tetap diuji oleh
 * blangko-derry-isian-16okt (harness itu tidak memuat abt.js).
 */
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");

function bagianF43(): string {
  const isi = baca("abt.js");
  const awal = isi.indexOf("/* === 16OKT-F43:");
  const akhir = isi.indexOf("/* === AKHIR 16OKT-F43 === */", awal);
  if (awal < 0 || akhir < 0) throw new Error("bagian 16OKT-F43 tidak ada di abt.js");
  return isi.slice(awal, akhir);
}

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(jawab: (badan: any) => { status: number; isi: unknown }) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, { url: "http://192.168.10.10/aps_badilag/index.php/abt/main/beranda", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const minta: Array<{ url: string; badan: any }> = [];
  w.fetch = async (url: string, o: any) => {
    const badan = JSON.parse(String(o?.body || "{}"));
    minta.push({ url, badan });
    const j = jawab(badan);
    return { ok: j.status < 400, status: j.status, json: async () => j.isi };
  };
  w.btoa = (s: string) => Buffer.from(s, "latin1").toString("base64");
  w.atob = (s: string) => Buffer.from(s, "base64").toString("latin1");
  w.eval(`${bagianF43()}\nwindow.__f43 = { alatAnonimMandiri, alatPratinjauAnonim, alatRingkasAnonim };`);
  return { w, minta, f: w.__f43 };
}

const RTF = "{\\rtf1 Sulastri binti Ahmad}";
const RTF_ANON = "{\\rtf1 PENGGUGAT binti xxx}";

describe("abt.js 16OKT-F43 - klien penyamar mandiri", () => {
  it("mengirim RTF + nomor perkara ke portal dan memulangkan RTF anonim sebagai ArrayBuffer", async () => {
    const h = buka(() => ({
      status: 200,
      isi: { ok: true, data: { ok: true, rtfBase64: Buffer.from(RTF_ANON, "latin1").toString("base64"), ringkas: { "nama pihak": 2, NIK: 1 }, sisa: [], potongan: [] } },
    }));
    const buf = new TextEncoder().encode(RTF).buffer;
    const log: string[] = [];
    const r = await h.f.alatAnonimMandiri(buf, "581/Pdt.G/2026/PA.Dgl", (x: string) => log.push(x));
    expect(h.minta[0].url).toBe("/aleta/api/aleta-ecourt/putusan/anonim-mandiri");
    expect(Buffer.from(h.minta[0].badan.rtfBase64, "base64").toString("latin1")).toBe(RTF);
    expect(h.minta[0].badan.nomorPerkara).toBe("581/Pdt.G/2026/PA.Dgl");
    expect(r.ok).toBe(true);
    expect(Buffer.from(new Uint8Array(r.rtf)).toString("latin1")).toBe(RTF_ANON);
    expect(h.f.alatRingkasAnonim(r)).toBe("2 nama para pihak, 1 NIK");
    expect(log[0]).toMatch(/penyamar ALETA/);
  });

  it("portal menolak (SIPP tidak terbaca) -> ok:false beserta sebabnya, supaya Blangko Derry memakai ABT", async () => {
    const h = buka(() => ({ status: 200, isi: { ok: true, data: { ok: false, sebab: "Data para pihak di SIPP belum terbaca." } } }));
    const r = await h.f.alatAnonimMandiri(new ArrayBuffer(4), "581/Pdt.G/2026/PA.Dgl");
    expect(r).toEqual({ ok: false, sebab: "Data para pihak di SIPP belum terbaca." });
    const h2 = buka(() => ({ status: 403, isi: { ok: false, error: { message: "tidak berwenang" } } }));
    expect(await h2.f.alatAnonimMandiri(new ArrayBuffer(4), "x")).toEqual({ ok: false, sebab: "tidak berwenang" });
  });

  it("pratinjau: naskah bersorot, peringatan sisa, tiga pilihan (Esc = batal)", async () => {
    const h = buka(() => ({ status: 200, isi: {} }));
    const data = {
      ringkas: { "nama pihak": 1 },
      potongan: [{ t: "antara " }, { t: "PENGGUGAT", j: "nama pihak" }, { t: ", <umur> 30 tahun" }],
      sisa: [{ jenis: "nama saksi", kata: "Haeruddin", konteks: "saksi Haeruddin menerangkan" }],
      dilewati: [],
      tidakTerbaca: ["anak"],
    };
    const janji = h.f.alatPratinjauAnonim(data, { nomor: "581/Pdt.G/2026/PA.Dgl" });
    const d = h.w.document as Document;
    const kotak = d.querySelector(".aleta-f43-tirai") as HTMLElement;
    expect(kotak.getAttribute("role")).toBe("dialog");
    expect(kotak.querySelector("mark")!.textContent).toBe("PENGGUGAT");
    expect(kotak.querySelector(".aleta-f43-naskah")!.innerHTML).toContain("&lt;umur&gt;");
    expect(kotak.textContent).toContain("Masih ada 1 bagian");
    expect(kotak.textContent).toContain("Haeruddin");
    expect(kotak.textContent).toContain("tidak terbaca (anak)");
    expect(kotak.textContent).not.toMatch(/nama pihak|potongan|sisa/); // tanpa istilah teknis di layar
    (kotak.querySelector('[data-f43="tanpa"]') as HTMLElement).click();
    expect(await janji).toBe("tanpa");
    expect(d.querySelector(".aleta-f43-tirai")).toBeNull();
    const janji2 = h.f.alatPratinjauAnonim({ ...data, sisa: [] }, {});
    expect(d.querySelector(".aleta-f43-baik")!.textContent).toMatch(/Tidak ada nama/);
    d.dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(await janji2).toBe("batal");
  });
});

describe("Blangko Derry - titik sambung 16OKT-F43", () => {
  const isi = baca("blangko-derry-isian.js");
  it("penyamar ALETA dipanggil lebih dulu; anonimisasi ABT hanya bila ALETA gagal", () => {
    const iMandiri = isi.indexOf("alatAnonimMandiri(rtfBuf, nomor, catatLog)");
    const iAbt = isi.indexOf("await klienAbt().anonim(");
    expect(iMandiri).toBeGreaterThan(0);
    expect(iAbt).toBeGreaterThan(iMandiri);
    expect(isi).toMatch(/const h = anonimAleta && anonimAleta\.ok \? anonimAleta : tes\(\) \? \{ ok: false, pesan: "[^"]+" \} : await klienAbt\(\)\.anonim\(/); // 22 Okt: Tes putusan tidak memakai anonim ABT
  });
  it("pratinjau anonim ALETA tampil sebelum unggah e-Doc; 'Unggah putusan saja' mengirim tanpa anonim", () => {
    const iPrat = isi.indexOf("alatPratinjauAnonim(anonimAleta, { nomor })");
    const iUnggah = isi.indexOf('hasil.push(await unggahEdoc(rtfBuf, pilih === "tanpa" ? null : anonimRtf))');
    expect(iPrat).toBeGreaterThan(0);
    expect(iUnggah).toBeGreaterThan(iPrat);
  });
});
