// @vitest-environment node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import * as jsdomModul from "jsdom";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PRATINJAU BAS DAN RELAAS DI SIPP SEBELUM DIUNDUH (20 Okt 2026)
 * ============================================================================
 *
 * ekstensi-sipp/pratinjau-bas-relaas.js dijalankan SUNGGUHAN di jsdom bersama
 * deteksi-sisa-blangko.js dan potongan alatUnduh/alatNamaUnduhanLayak dari
 * panel-alat.js (jalur chrome.downloads yang sama dengan sekarang). Yang dijaga:
 *
 *   - klik tautan e-Doc BAS / relaas (PDF, gambar) dan Cetak borang SIPP (RTF POST)
 *     dicegat; tombol asli tidak jalan; berkasnya diambil SATU kali;
 *   - pratinjau PDF memakai iframe blob (penampil PDF peramban), gambar memakai
 *     <img>; RTF/DOC/DOCX diubah ke PDF lewat rute konversi-naskah, dan bila gagal
 *     jatuh ke teks (RTF) atau pesan (DOC);
 *   - tombol Unduh memanggil unduhan dengan NAMA YANG SAMA dan berkas ASLI
 *     (bukan hasil konversi) tanpa permintaan kedua ke SIPP;
 *   - deteksi sisa blangko tampil di pratinjau; daftar masalah dapat diunduh;
 *   - saklar mati = tak ada yang dicegat; Shift/Ctrl-klik = unduh langsung;
 *   - validasi borang SIPP menang; gagal ambil -> tindakan asli (tak ada unduhan hilang);
 *   - tema gelap/terang, Esc, Tutup, tak ada permintaan ke SIPP selain pengambilan berkas.
 *
 * ALETA_TANGKAP_PRATINJAU=<awalan> menyimpan HTML tiap keadaan untuk tangkapan
 * Playwright (docs/rancangan/pratinjau-bas-relaas-20okt/tangkap.mjs).
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const DETEKSI = baca("deteksi-sisa-blangko.js");
const PRATINJAU = baca("pratinjau-bas-relaas.js");

function potongFungsi(isi: string, nama: string[]): string {
  const baris = isi.split("\n");
  const hasil: string[] = [];
  for (const n of nama) {
    const i = baris.findIndex((b) => new RegExp(`^(?:async )?function ${n}\\(`).test(b));
    if (i < 0) throw new Error(`fungsi ${n} tidak ditemukan`);
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    hasil.push(baris.slice(i, j + 1).join("\n"));
  }
  return hasil.join("\n\n");
}

const POTONGAN_ALAT = [
  ALAT.match(/const ALAT_AKHIRAN_TIPE = \{[\s\S]*?\n\};/)![0],
  ALAT.match(/const ALAT_POLA_NAMA_GENERIK = .*;/)![0],
  "const ALAT_TAUTAN_ASLI = new WeakSet();",
  potongFungsi(ALAT, ["alatTandaiTautanAsli", "alatLepasTautanAsli", "alatTautanAsli", "alatNamaUnduhanLayak", "alatBlobKeData", "alatUnduhLewatTautan", "alatUnduh"]),
].join("\n");

const SIPP = "http://192.168.10.10/SIPP/index.php/perkara_detil/XYZ";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

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
    await tunggu(5);
  }
}

const PDF = "%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF";
const PDF_B64 = Buffer.from(PDF, "latin1").toString("base64");
const RTF_BERSIH = "{\\rtf1\\ansi Berita Acara Sidang\\par Telah hadir Penggugat dan Tergugat.\\par}";
// Warna merah (sisa isian) pada nama pihak: dikenali deteksi-sisa-blangko.
const RTF_MERAH = "{\\rtf1\\ansi{\\colortbl;\\red255\\green0\\blue0;}Berita Acara Sidang\\par Telah hadir \\cf1 NAMA PIHAK\\cf0  dan seterusnya.\\par}";
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0]);
const DOC_OLE = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);

type Balasan = { status?: number; tipe?: string; disposisi?: string; isi?: string | Uint8Array; galat?: boolean };
type Konversi = { status?: number; data?: unknown; galat?: boolean };

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

interface Opsi {
  html?: string;
  balasan?: Record<string, Balasan>;
  konversi?: Konversi;
  saklar?: boolean | undefined;
  tema?: "gelap" | "terang";
  tanpaDeteksi?: boolean;
  alamat?: string;
}

function lingkungan(o: Opsi = {}) {
  // Navigasi sungguhan tidak ada di jsdom ("Not implemented: navigation"): galat itu bukan bahan uji.
  const konsol = new (jsdomModul as any).VirtualConsole();
  const dom = new JSDOM(o.html ?? "<!doctype html><html><body></body></html>", { url: o.alamat ?? SIPP, runScripts: "outside-only", virtualConsole: konsol } as any);
  terbuka.push(dom);
  const w = dom.window as any;
  const permintaan: Array<{ alamat: string; init: any }> = [];
  const konversiMasuk: Array<{ alamat: string; opsi: any }> = [];
  const unduhan: Array<{ nama: string; alamat: string }> = [];
  const dihapusUrl: string[] = [];
  const penyimpanan: Record<string, unknown> = {};
  if (o.saklar !== undefined) penyimpanan.pratinjauBasRelaas = o.saklar;
  if (o.tema) penyimpanan.temaPanel = o.tema;
  const catatan: string[] = [];

  w.chrome = {
    runtime: {
      lastError: undefined,
      sendMessage: (pesan: any, balik: (x?: unknown) => void) => {
        if (pesan.jenis === "unduh") unduhan.push({ nama: pesan.nama, alamat: pesan.alamat });
        balik({ ok: true, id: unduhan.length });
      },
    },
    storage: {
      onChanged: { addListener: () => {} },
      local: {
        get: async (k: string[]) => Object.fromEntries(k.map((x) => [x, penyimpanan[x]])),
        set: async (b: Record<string, unknown>) => void Object.assign(penyimpanan, b),
      },
    },
  };
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.alatCatat = (_j: string, ringkas: string) => void catatan.push(ringkas);
  let urutanBlob = 0;
  w.URL.createObjectURL = () => `blob:http://192.168.10.10/uuid-${(urutanBlob += 1)}`;
  w.URL.revokeObjectURL = (u: string) => void dihapusUrl.push(u);
  w.HTMLAnchorElement.prototype.click = function click() {
    // Navigasi sungguhan tidak ada di jsdom; yang dihitung hanya klik yang sampai.
    this.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  };

  w.fetch = async (alamat: string, init: any = {}) => {
    permintaan.push({ alamat, init });
    const b = (o.balasan ?? {})[alamat.replace(/#.*$/, "")];
    if (!b) return { ok: false, status: 404, headers: { get: () => null }, blob: async () => new w.Blob([]) };
    if (b.galat) throw new Error("Failed to fetch");
    const status = b.status ?? 200;
    const kepala: Record<string, string> = {
      "content-type": b.tipe ?? "application/vnd.ms-word",
      ...(b.disposisi ? { "content-disposition": b.disposisi } : {}),
    };
    const isi = typeof b.isi === "string" || b.isi === undefined ? new TextEncoder().encode((b.isi as string) ?? RTF_BERSIH) : b.isi;
    return {
      ok: status < 400,
      status,
      headers: { get: (k: string) => kepala[k.toLowerCase()] ?? null },
      blob: async () => new w.Blob([isi], { type: kepala["content-type"] }),
    };
  };
  w.alatAmbil = async (alamat: string, opsi: any) => {
    konversiMasuk.push({ alamat, opsi });
    const k = o.konversi ?? { status: 200, data: { berkasBase64: PDF_B64, namaBerkas: "x.pdf", mime: "application/pdf" } };
    if (k.galat) throw new Error("Server ALETA tidak terjangkau.");
    const status = k.status ?? 200;
    return { ok: status < 400, status, json: async () => (status < 400 ? { ok: true, data: k.data } : k.data ?? {}) };
  };

  const konteks = (dom as any).getInternalVMContext();
  new vm.Script(POTONGAN_ALAT, { filename: "panel-alat.potongan.js" }).runInContext(konteks);
  if (!o.tanpaDeteksi) new vm.Script(DETEKSI, { filename: "deteksi-sisa-blangko.js" }).runInContext(konteks);
  new vm.Script(PRATINJAU, { filename: "pratinjau-bas-relaas.js" }).runInContext(konteks);

  const doc = w.document as Document;
  const tambah = (html: string) => {
    const d = doc.createElement("div");
    d.innerHTML = html;
    doc.body.appendChild(d);
    return d;
  };
  const kotak = () => doc.getElementById("aleta-pratinjau-berkas") as HTMLElement | null;
  const dalam = (p: string) => kotak()?.shadowRoot?.querySelector(`[data-p="${p}"]`) as HTMLElement | null;
  /** Klik; pulang { dibatalkan }. */
  const klik = (el: Element, tambahan: Record<string, unknown> = {}) => {
    const e = new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...tambahan });
    let sampaiAsli = false;
    // Pendengar terakhir (fase gelembung di dokumen): hanya jalan bila tak dihentikan.
    const p = (x: Event) => void (sampaiAsli = !x.defaultPrevented);
    doc.addEventListener("click", p, false);
    el.dispatchEvent(e);
    doc.removeEventListener("click", p, false);
    return { dibatalkan: e.defaultPrevented, sampaiAsli };
  };
  const kirim = (form: HTMLFormElement, tombol?: Element) => {
    const e = new w.Event("submit", { bubbles: true, cancelable: true });
    if (tombol) Object.defineProperty(e, "submitter", { value: tombol });
    form.dispatchEvent(e);
    return { dibatalkan: e.defaultPrevented };
  };
  return { w, dom, doc, permintaan, konversiMasuk, unduhan, dihapusUrl, penyimpanan, catatan, tambah, kotak, dalam, klik, kirim };
}

const ALAMAT_BAS_PDF = "http://192.168.10.10/SIPP/resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_3_1792347558.pdf";
const HTML_BAS_EDOC = `<table><tr><td>Sidang ke-3 <br><a target='_new' href=resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_3_1792347558.pdf><b>Unduh Dokumen BAS</b></a></td></tr></table>`;
const ALAMAT_CETAK_BAS = "http://192.168.10.10/SIPP/c_template_bas_lanjutan_agama/cetak_bas_lanjutan_agama";
const HTML_FORM_BAS = `<div id="popup_form"><form id="frm_pen_pp_pdt" method="POST" target="_self" action="${ALAMAT_CETAK_BAS}">
  <input type="hidden" name="enc" value="ENC1"><input type="hidden" name="encjadwalsidang" value="ENC2">
  <select name="blangko_bas_lanjutan_agama"><option value="-1">--Pilih--</option><option value="BAS_01" selected>BAS 01</option></select>
  <input type="button" id="kembali" value="Kembali"><input type="submit" id="simpan_btn" value="Cetak"></form></div>`;

describe("pengenalan alamat dan berkas", () => {
  it("alamat cetak SIPP: BAS dan relaas dikenali; teguran/pengembalian panjar dan akta TIDAK", () => {
    const l = lingkungan();
    const a = l.w.aletaPratinjauBasRelaas;
    const dasar = "http://192.168.10.10/SIPP/";
    expect(a.jenisCetak(`${dasar}c_template_bas_pertama_agama/cetak_bas_pertama_agama`)).toBe("bas");
    expect(a.jenisCetak(`${dasar}c_template_bas_lanjutan_agama/cetak_bas_lanjutan_agama`)).toBe("bas");
    expect(a.jenisCetak(`${dasar}c_template_bas_eksekusi_agama/cetak_bas_eksekusi_agama`)).toBe("bas");
    expect(a.jenisCetak(`${dasar}c_template_berita_acara/cetak_BA_elektronik/E1/E2/1`)).toBe("bas");
    expect(a.jenisCetak(`${dasar}c_template_relaas_agama/cetak_relaas`)).toBe("relaas");
    expect(a.jenisCetak(`${dasar}c_template_relaas_agama/cetak_relaas_ikrar`)).toBe("relaas");
    expect(a.jenisCetak(`${dasar}c_template_relaas_agama/cetak_template_pendukung`)).toBe("relaas");
    expect(a.jenisCetak(`${dasar}c_template_relaas_agama/cetak_template_amplop`)).toBe("relaas");
    expect(a.jenisCetak(`${dasar}c_template_agama_perdata_pemberitahuan_putusan/cetak_pemberitahuan_putusan_tergugat`)).toBe("relaas");
    expect(a.jenisCetak(`${dasar}c_template_agama_perdata_pemberitahuan_putusan/cetak_teguran_panjar`)).toBe("");
    expect(a.jenisCetak(`${dasar}c_template_agama_perdata_pemberitahuan_putusan/cetak_pengembalian_sisa_panjar`)).toBe("");
    expect(a.jenisCetak(`${dasar}c_template_akta_cerai/cetak_akta_cerai`)).toBe("");
    expect(a.jenisCetak(`${dasar}c_template_relaas_agama/popup_relaas/E1`)).toBe("");
  });

  it("nama berkas e-Doc: _bas_<n>_<waktu> dan relaas_/resi_ dikenali; berkas lain tidak", () => {
    const l = lingkungan();
    const a = l.w.aletaPratinjauBasRelaas;
    expect(a.jenisBerkas("http://192.168.10.10/SIPP/resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_3_1792347558.pdf")).toBe("bas");
    expect(a.jenisBerkas("http://192.168.10.10/SIPP/resources/file/doc/2024/01/PADgl_2024_PdtG_33_relaas_7648_14307_26648_1705372784.pdf")).toBe("relaas");
    expect(a.jenisBerkas("http://192.168.10.10/SIPP/resources/file/doc/2026/10/resi_20421_36941.pdf")).toBe("relaas");
    expect(a.jenisBerkas("http://192.168.10.10/SIPP/resources/file/doc/2026/10/PADgl_2026_PdtG_600_putusan_akhir_1.pdf")).toBe("");
  });

  it("bentuk dikenali dari ISI, bukan nama", () => {
    const l = lingkungan();
    const a = l.w.aletaPratinjauBasRelaas;
    const u8 = (s: string) => Uint8Array.from(Buffer.from(s, "latin1"));
    expect(a.kenaliBentuk(u8(PDF), "x.rtf", "")).toBe("pdf");
    expect(a.kenaliBentuk(u8(RTF_BERSIH), "x.pdf", "")).toBe("rtf");
    expect(a.kenaliBentuk(JPEG, "x.pdf", "")).toBe("gambar");
    expect(a.kenaliBentuk(DOC_OLE, "x.doc", "")).toBe("doc");
    expect(a.kenaliBentuk(u8("PK\u0003\u0004zzzzzzz"), "x.docx", "")).toBe("docx");
    expect(a.kenaliBentuk(u8("PK\u0003\u0004zzzzzzz"), "x.zip", "")).toBe("lain");
  });
});

describe("tautan e-Doc BAS dan relaas", () => {
  it("klik Unduh Dokumen BAS (PDF): dicegat, satu GET berkredensial, pratinjau PDF dalam iframe blob", async () => {
    const l = lingkungan({ html: `<base href="http://192.168.10.10/SIPP/">${HTML_BAS_EDOC}`, balasan: { [ALAMAT_BAS_PDF]: { tipe: "application/pdf", isi: PDF } } });
    const a = l.doc.querySelector("a")!;
    const { dibatalkan, sampaiAsli } = l.klik(a);
    expect(dibatalkan).toBe(true);
    expect(sampaiAsli).toBe(false);
    const iframe = await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe PDF");
    expect(iframe.getAttribute("src")).toMatch(/^blob:http:\/\/192\.168\.10\.10\/uuid-\d+#view=FitH$/);
    expect(l.permintaan).toHaveLength(1);
    expect(l.permintaan[0].alamat).toBe(ALAMAT_BAS_PDF);
    expect(l.permintaan[0].init.credentials).toBe("include");
    expect(l.dalam("nama")!.textContent).toBe("PADgl_2026_PdtG_600_bas_3_1792347558.pdf");
    expect(l.dalam("jenis")!.textContent).toBe("Berita Acara Sidang");
    expect(l.dalam("info")!.textContent).toMatch(/^PDF - /);
    expect((l.dalam("unduh") as HTMLButtonElement).disabled).toBe(false);
    expect((l.dalam("cetak") as HTMLButtonElement).disabled).toBe(false);
    expect(l.konversiMasuk).toHaveLength(0); // PDF tidak perlu diubah
  });

  it("tombol Unduh: nama berkas SAMA, berkas asli, tanpa permintaan kedua ke SIPP", async () => {
    const l = lingkungan({ html: `<base href="http://192.168.10.10/SIPP/">${HTML_BAS_EDOC}`, balasan: { [ALAMAT_BAS_PDF]: { tipe: "application/pdf", isi: PDF } } });
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    (l.dalam("unduh") as HTMLButtonElement).click();
    await sampai(() => l.unduhan.length === 1, "unduhan terbit");
    expect(l.unduhan[0].nama).toBe("PADgl_2026_PdtG_600_bas_3_1792347558.pdf");
    expect(l.unduhan[0].alamat).toBe(`data:application/pdf;base64,${PDF_B64}`);
    expect(l.permintaan).toHaveLength(1);
    await sampai(() => l.dalam("pesan")?.textContent === "Berkas terunduh.", "pesan terunduh");
    expect(l.kotak()).not.toBeNull(); // kotak tetap terbuka sesudah mengunduh
  });

  it("Tutup menutup kotak dan melepas blob; Esc juga", async () => {
    const l = lingkungan({ html: `<base href="http://192.168.10.10/SIPP/">${HTML_BAS_EDOC}`, balasan: { [ALAMAT_BAS_PDF]: { tipe: "application/pdf", isi: PDF } } });
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    (l.dalam("tutup") as HTMLButtonElement).click();
    expect(l.kotak()).toBeNull();
    expect(l.dihapusUrl.length).toBeGreaterThan(0);
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe lagi");
    l.doc.defaultView!.dispatchEvent(new l.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(l.kotak()).toBeNull();
  });

  it("relaas e-Doc JPG di kolom upload_relaas: gambar ditampilkan, jenis Relaas", async () => {
    const alamat = "http://192.168.10.10/SIPP/resources/file/doc/2026/09/PADgl_2026_PdtG_600_relaas_9620_18823_34395_1776311351.jpg";
    const l = lingkungan({
      html: `<base href="http://192.168.10.10/SIPP/"><table><tr><td class="upload_relaas"><a target="_new" href=resources/file/doc/2026/09/PADgl_2026_PdtG_600_relaas_9620_18823_34395_1776311351.jpg>Lihat</a></td></tr></table>`,
      balasan: { [alamat]: { tipe: "image/jpeg", isi: JPEG } },
    });
    expect(l.klik(l.doc.querySelector("a")!).dibatalkan).toBe(true);
    const gambar = await sampai(() => l.dalam("badan")?.querySelector("img"), "gambar");
    expect(gambar.getAttribute("src")).toMatch(/^blob:/);
    expect(l.dalam("jenis")!.textContent).toBe("Relaas");
    expect(l.dalam("info")!.textContent).toMatch(/^Gambar - /);
  });

  it("e-Doc BAS RTF: diubah ke PDF lewat rute konversi-naskah, Unduh membawa RTF asli", async () => {
    const alamat = "http://192.168.10.10/SIPP/resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_4_1792347999.rtf";
    const l = lingkungan({
      html: `<base href="http://192.168.10.10/SIPP/"><a target='_new' href=resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_4_1792347999.rtf><b>Unduh Dokumen BAS</b></a>`,
      balasan: { [alamat]: { tipe: "application/rtf", isi: RTF_BERSIH } },
    });
    expect(l.klik(l.doc.querySelector("a")!).dibatalkan).toBe(true);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe hasil konversi");
    expect(l.konversiMasuk).toHaveLength(1);
    expect(l.konversiMasuk[0].alamat).toBe("/aleta/api/aleta-ecourt/putusan/konversi-naskah");
    const badan = l.konversiMasuk[0].opsi.body as FormData;
    expect(badan.get("ke")).toBe("pdf");
    expect((badan.get("berkas") as File).name).toBe("PADgl_2026_PdtG_600_bas_4_1792347999.rtf");
    (l.dalam("unduh") as HTMLButtonElement).click();
    await sampai(() => l.unduhan.length === 1, "unduhan terbit");
    expect(l.unduhan[0].nama).toBe("PADgl_2026_PdtG_600_bas_4_1792347999.rtf");
    expect(Buffer.from(l.unduhan[0].alamat.split(",")[1], "base64").toString("latin1")).toBe(RTF_BERSIH);
    expect(l.permintaan).toHaveLength(1);
  });

  it("tautan lain (bukan BAS/relaas) tidak disentuh", async () => {
    const l = lingkungan({
      html: `<base href="http://192.168.10.10/SIPP/"><a href=resources/file/doc/2026/09/PADgl_2026_PdtG_600_putusan_1.pdf>Unduh Dokumen</a><a href="#x">x</a>`,
    });
    for (const a of Array.from(l.doc.querySelectorAll("a"))) expect(l.klik(a).dibatalkan).toBe(false);
    await tunggu(20);
    expect(l.permintaan).toEqual([]);
    expect(l.kotak()).toBeNull();
  });
});

describe("borang cetak SIPP (RTF POST)", () => {
  const dasarRtf = (isi: string) => ({
    [ALAMAT_CETAK_BAS]: { tipe: "application/vnd.ms-word", isi, disposisi: 'attachment; filename="BAS_Lanjutan-684_Pdt.G_2026_PA.Dgl-2026-10-20.rtf"' },
  });

  it("Cetak: POST berisi isian borang, SATU kali; PDF hasil konversi tampil; Unduh = RTF asli bernama sama", async () => {
    const l = lingkungan({ html: HTML_FORM_BAS, balasan: dasarRtf(RTF_BERSIH) });
    const form = l.doc.querySelector("form")!;
    expect(l.kirim(form, l.doc.getElementById("simpan_btn")!).dibatalkan).toBe(true);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    expect(l.permintaan).toHaveLength(1);
    expect(l.permintaan[0].alamat).toBe(ALAMAT_CETAK_BAS);
    expect(l.permintaan[0].init.method).toBe("POST");
    expect(l.permintaan[0].init.credentials).toBe("include");
    const badan = l.permintaan[0].init.body as URLSearchParams;
    expect(badan.get("enc")).toBe("ENC1");
    expect(badan.get("encjadwalsidang")).toBe("ENC2");
    expect(badan.get("blangko_bas_lanjutan_agama")).toBe("BAS_01");
    expect(l.dalam("jenis")!.textContent).toBe("Berita Acara Sidang");
    (l.dalam("unduh") as HTMLButtonElement).click();
    await sampai(() => l.unduhan.length === 1, "unduhan terbit");
    expect(l.unduhan[0].nama).toBe("BAS_Lanjutan-684_Pdt.G_2026_PA.Dgl-2026-10-20.rtf");
    expect(l.permintaan).toHaveLength(1); // pratinjau dan unduhan memakai SATU pengambilan
  });

  it("validasi borang SIPP menang: submit yang sudah dibatalkan penangan SIPP tidak diambil", async () => {
    const l = lingkungan({ html: HTML_FORM_BAS, balasan: dasarRtf(RTF_BERSIH) });
    const form = l.doc.querySelector("form")!;
    form.addEventListener("submit", (e) => e.preventDefault()); // seperti message_error_show + preventDefault milik SIPP
    l.kirim(form, l.doc.getElementById("simpan_btn")!);
    await tunggu(30);
    expect(l.permintaan).toEqual([]);
    expect(l.kotak()).toBeNull();
  });

  it("Shift-klik Cetak = unduh langsung: tanpa kotak, nama sama, satu permintaan", async () => {
    const l = lingkungan({ html: HTML_FORM_BAS, balasan: dasarRtf(RTF_BERSIH) });
    const form = l.doc.querySelector("form")!;
    const tombol = l.doc.getElementById("simpan_btn")!;
    l.klik(tombol, { shiftKey: true });
    expect(l.kirim(form, tombol).dibatalkan).toBe(true);
    await sampai(() => l.unduhan.length === 1, "unduhan langsung");
    expect(l.unduhan[0].nama).toBe("BAS_Lanjutan-684_Pdt.G_2026_PA.Dgl-2026-10-20.rtf");
    expect(l.kotak()).toBeNull();
    expect(l.permintaan).toHaveLength(1);
    expect(l.konversiMasuk).toHaveLength(0);
  });

  it("relaas: borang Surat Panggilan -> pratinjau berjenis Relaas", async () => {
    const alamat = "http://192.168.10.10/SIPP/c_template_relaas_agama/cetak_relaas";
    const l = lingkungan({
      html: `<form id="form_relaas" method="POST" target="_self" action="${alamat}"><input type="hidden" name="enc" value="E1"><input type="hidden" name="blangko_relaas" value="R_201"><input type="submit" value="Cetak"></form>`,
      balasan: { [alamat]: { tipe: "application/vnd.ms-word", isi: RTF_BERSIH, disposisi: 'attachment; filename="R_201_684_Pdt_G_2026_PA_Dgl_20261020010101.rtf"' } },
    });
    l.kirim(l.doc.querySelector("form")!);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    expect(l.dalam("jenis")!.textContent).toBe("Relaas");
    expect(l.dalam("nama")!.textContent).toBe("R_201_684_Pdt_G_2026_PA_Dgl_20261020010101.rtf");
  });

  it("borang lain (bukan cetak BAS/relaas) dan borang GET tidak disentuh", async () => {
    const l = lingkungan({
      html: `<form method="POST" action="http://192.168.10.10/SIPP/c_template_akta_cerai/cetak_akta_cerai"><input name="a" value="1"></form><form method="GET" action="${ALAMAT_CETAK_BAS}"></form>`,
    });
    for (const f of Array.from(l.doc.querySelectorAll("form"))) expect(l.kirim(f).dibatalkan).toBe(false);
    await tunggu(20);
    expect(l.permintaan).toEqual([]);
  });

  it("cetak BA elektronik (onClick window.open) dicegat sebagai GET", async () => {
    const alamat = "http://192.168.10.10/SIPP/c_template_berita_acara/cetak_BA_elektronik/ENC1/ENC2/1";
    const l = lingkungan({
      html: `<a href="#" onClick="window.open('${alamat}')">BA Sidang Elektronik Lanjutan</a>`,
      balasan: { [alamat]: { isi: RTF_BERSIH, disposisi: 'attachment; filename="BAS_ELEKTRONIK_LANJUTAN_684_20261020.rtf"' } },
    });
    expect(l.klik(l.doc.querySelector("a")!).dibatalkan).toBe(true);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    expect(l.permintaan[0].init.method).toBe("GET");
    expect(l.dalam("nama")!.textContent).toBe("BAS_ELEKTRONIK_LANJUTAN_684_20261020.rtf");
  });

  it("pilihan Cetak Relas (select pilih_cetak) bernilai alamat cetak: dicegat dan pilihan dikembalikan", async () => {
    const alamat = "http://192.168.10.10/SIPP/c_template_berita_acara/cetak_BA_elektronik/ENC1/ENC2/2";
    const l = lingkungan({
      html: `<select onchange="pilih_cetak(this)"><option>Cetak Relas</option><option label="ba_sidang_elektronik" value="${alamat}">BA Sidang Elektronik Putusan</option></select>`,
      balasan: { [alamat]: { isi: RTF_BERSIH, disposisi: 'attachment; filename="BAS_ELEKTRONIK_PUTUSAN_684.rtf"' } },
    });
    const pilih = l.doc.querySelector("select")!;
    let inline = 0;
    pilih.addEventListener("change", () => (inline += 1)); // pengganti onchange SIPP: tak boleh jalan
    pilih.selectedIndex = 1;
    pilih.dispatchEvent(new l.w.Event("change", { bubbles: true }));
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    expect(inline).toBe(0);
    expect(pilih.selectedIndex).toBe(0);
    expect(l.dalam("nama")!.textContent).toBe("BAS_ELEKTRONIK_PUTUSAN_684.rtf");
  });
});

describe("saklar, Shift-klik, dan kegagalan", () => {
  it("saklar mati (tersimpan false): perilaku lama - tak ada yang dicegat atau diambil", async () => {
    const l = lingkungan({ html: `<base href="http://192.168.10.10/SIPP/">${HTML_BAS_EDOC}${HTML_FORM_BAS}`, saklar: false });
    await tunggu(10);
    expect(l.w.aletaPratinjauBasRelaas.nyalaKini()).toBe(false);
    expect(l.klik(l.doc.querySelector("a")!).dibatalkan).toBe(false);
    expect(l.kirim(l.doc.querySelector("form")!).dibatalkan).toBe(false);
    await tunggu(20);
    expect(l.permintaan).toEqual([]);
    expect(l.kotak()).toBeNull();
  });

  it("bawaan (belum pernah diatur) = menyala", async () => {
    const l = lingkungan({});
    await tunggu(10);
    expect(l.w.aletaPratinjauBasRelaas.nyalaKini()).toBe(true);
  });

  it("Shift/Ctrl-klik tautan = unduh langsung (tanpa kotak) dengan nama sama", async () => {
    for (const mod of [{ shiftKey: true }, { ctrlKey: true }]) {
      const l = lingkungan({ html: `<base href="http://192.168.10.10/SIPP/">${HTML_BAS_EDOC}`, balasan: { [ALAMAT_BAS_PDF]: { tipe: "application/pdf", isi: PDF } } });
      expect(l.klik(l.doc.querySelector("a")!, mod).dibatalkan).toBe(true);
      await sampai(() => l.unduhan.length === 1, "unduhan langsung");
      expect(l.unduhan[0].nama).toBe("PADgl_2026_PdtG_600_bas_3_1792347558.pdf");
      expect(l.kotak()).toBeNull();
      expect(l.permintaan).toHaveLength(1);
    }
  });

  it("jaringan putus: tindakan asli dijalankan (tautan diklik ulang), tak ada kotak tertinggal", async () => {
    const l = lingkungan({ html: `<base href="http://192.168.10.10/SIPP/">${HTML_BAS_EDOC}`, balasan: { [ALAMAT_BAS_PDF]: { galat: true } } });
    let asli = 0;
    l.doc.addEventListener("click", (e) => void (!e.defaultPrevented && (asli += 1)), false);
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => asli === 1, "klik asli diteruskan");
    expect(l.kotak()).toBeNull();
  });

  it("SIPP menjawab halaman web (sesi habis): pesan jelas, Unduh mati, 'Unduh seperti biasa' meneruskan klik asli", async () => {
    const l = lingkungan({
      html: `<base href="http://192.168.10.10/SIPP/">${HTML_BAS_EDOC}`,
      balasan: { [ALAMAT_BAS_PDF]: { tipe: "text/html; charset=utf-8", isi: "<html><body>Login</body></html>" } },
    });
    l.klik(l.doc.querySelector("a")!);
    const galat = await sampai(() => l.dalam("badan")?.querySelector(".galat"), "pesan galat");
    expect(galat.textContent).toMatch(/halaman web, bukan berkas/);
    expect((l.dalam("unduh") as HTMLButtonElement).disabled).toBe(true);
    let asli = 0;
    l.doc.addEventListener("click", (e) => void (!e.defaultPrevented && (asli += 1)), false);
    (galat.querySelector("button") as HTMLButtonElement).click();
    await sampai(() => asli >= 1, "klik asli diteruskan");
    expect(l.kotak()).toBeNull();
  });

  it("kode 500 dari SIPP: pesan dengan kodenya", async () => {
    const l = lingkungan({ html: `<base href="http://192.168.10.10/SIPP/">${HTML_BAS_EDOC}`, balasan: { [ALAMAT_BAS_PDF]: { status: 500 } } });
    l.klik(l.doc.querySelector("a")!);
    const galat = await sampai(() => l.dalam("badan")?.querySelector(".galat"), "pesan galat");
    expect(galat.textContent).toMatch(/kode 500/);
  });

  it("berkas yang tak dapat ditampilkan (zip) diunduh langsung tanpa kotak", async () => {
    const alamat = "http://192.168.10.10/SIPP/resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_5_1792348000.zip";
    const l = lingkungan({
      html: `<base href="http://192.168.10.10/SIPP/"><a href=resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_5_1792348000.zip>Unduh Dokumen BAS</a>`,
      balasan: { [alamat]: { tipe: "application/zip", isi: "PK\u0003\u0004isi" } },
    });
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => l.unduhan.length === 1, "unduhan");
    expect(l.unduhan[0].nama).toBe("PADgl_2026_PdtG_600_bas_5_1792348000.zip");
    expect(l.kotak()).toBeNull();
  });
});

describe("konversi gagal: cadangan", () => {
  const alamat = "http://192.168.10.10/SIPP/resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_4_1792347999.rtf";
  const html = `<base href="http://192.168.10.10/SIPP/"><a href=resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_4_1792347999.rtf>Unduh Dokumen BAS</a>`;

  it("server tak terjangkau: RTF jatuh ke teks berformat sederhana, sisa merah ditandai, Unduh tetap bisa", async () => {
    const l = lingkungan({ html, balasan: { [alamat]: { tipe: "application/rtf", isi: RTF_MERAH } }, konversi: { galat: true } });
    l.klik(l.doc.querySelector("a")!);
    const kertas = await sampai(() => l.dalam("badan")?.querySelector(".teks"), "teks cadangan");
    expect(kertas.textContent).toContain("Berita Acara Sidang");
    expect(kertas.querySelector("mark")!.textContent).toBe("NAMA PIHAK");
    expect(l.dalam("badan")!.querySelector(".catatan")!.textContent).toMatch(/Tampilan teks sederhana/);
    expect((l.dalam("unduh") as HTMLButtonElement).disabled).toBe(false);
  });

  it("mode kering (423): RTF tampil sebagai teks; DOC biner: pesan, tetap dapat diunduh", async () => {
    const l = lingkungan({ html, balasan: { [alamat]: { tipe: "application/rtf", isi: RTF_BERSIH } }, konversi: { status: 423, data: {} } });
    l.klik(l.doc.querySelector("a")!);
    const kertas = await sampai(() => l.dalam("badan")?.querySelector(".teks"), "teks cadangan");
    expect(l.dalam("badan")!.querySelector(".catatan")!.textContent).toMatch(/mode kering/);
    expect(kertas.textContent).toContain("Telah hadir Penggugat dan Tergugat.");

    const alamatDoc = "http://192.168.10.10/SIPP/resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_6_1792348111.doc";
    const l2 = lingkungan({
      html: `<base href="http://192.168.10.10/SIPP/"><a href=resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_6_1792348111.doc>Unduh Dokumen BAS</a>`,
      balasan: { [alamatDoc]: { tipe: "application/msword", isi: DOC_OLE } },
      konversi: { status: 500, data: { error: { message: "soffice tidak ada" } } },
    });
    l2.klik(l2.doc.querySelector("a")!);
    const pesan = await sampai(() => l2.dalam("badan")?.querySelector(".galat"), "pesan");
    expect(pesan.textContent).toMatch(/soffice tidak ada/);
    expect((l2.dalam("unduh") as HTMLButtonElement).disabled).toBe(false);
    (l2.dalam("unduh") as HTMLButtonElement).click();
    await sampai(() => l2.unduhan.length === 1, "unduhan");
    expect(l2.unduhan[0].nama).toBe("PADgl_2026_PdtG_600_bas_6_1792348111.doc");
  });
});

describe("deteksi sisa blangko di pratinjau", () => {
  const alamat = "http://192.168.10.10/SIPP/resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_4_1792347999.rtf";
  const html = `<base href="http://192.168.10.10/SIPP/"><a href=resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_4_1792347999.rtf>Unduh Dokumen BAS</a>`;

  it("RTF dengan tulisan merah: peringatan tampil di atas pratinjau; daftar masalah (.txt) dapat diunduh", async () => {
    const l = lingkungan({ html, balasan: { [alamat]: { tipe: "application/rtf", isi: RTF_MERAH } } });
    l.klik(l.doc.querySelector("a")!);
    const peringatan = await sampai(() => (l.dalam("peringatan") && !l.dalam("peringatan")!.hidden ? l.dalam("peringatan") : null), "peringatan");
    expect(peringatan.textContent).toMatch(/masih memuat 1 sisa blangko/);
    expect(peringatan.querySelector("mark")!.textContent).toBe("NAMA PIHAK");
    (l.dalam("daftar") as HTMLButtonElement).click();
    await sampai(() => l.unduhan.length === 1, "daftar terunduh");
    expect(l.unduhan[0].nama).toMatch(/^Daftar masalah - .*\.txt$/);
  });

  it("naskah bersih: tidak ada peringatan", async () => {
    const l = lingkungan({ html, balasan: { [alamat]: { tipe: "application/rtf", isi: RTF_BERSIH } } });
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    await tunggu(30);
    expect(l.dalam("peringatan")!.hidden).toBe(true);
  });

  it("Unduh dari pratinjau tidak menanyakan lagi lewat dialog deteksi (peringatan sudah tampil)", async () => {
    const l = lingkungan({ html, balasan: { [alamat]: { tipe: "application/rtf", isi: RTF_MERAH } } });
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    (l.dalam("unduh") as HTMLButtonElement).click();
    await sampai(() => l.unduhan.length === 1, "unduhan");
    expect(l.doc.querySelector(".aleta-sisa-tabir")).toBeNull();
  });
});

describe("tampilan", () => {
  it("tema mengikuti pilihan panel (terang) dan tombol tema menukar serta menyimpannya", async () => {
    const l = lingkungan({ html: `<base href="http://192.168.10.10/SIPP/">${HTML_BAS_EDOC}`, tema: "terang", balasan: { [ALAMAT_BAS_PDF]: { tipe: "application/pdf", isi: PDF } } });
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    await sampai(() => l.dalam("latar")!.getAttribute("data-tema") === "terang", "tema terang");
    (l.dalam("tema") as HTMLButtonElement).click();
    expect(l.dalam("latar")!.getAttribute("data-tema")).toBe("gelap");
    await tunggu(5);
    expect(l.penyimpanan.temaPanel).toBe("gelap");
  });

  it("kotak berperan dialog, diberi kelas yang diabaikan pengamat halaman, dan tak ada teks aleta di DOM terang", async () => {
    const l = lingkungan({ html: `<base href="http://192.168.10.10/SIPP/">${HTML_BAS_EDOC}`, balasan: { [ALAMAT_BAS_PDF]: { tipe: "application/pdf", isi: PDF } } });
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    expect(l.kotak()!.className).toContain("aleta-sisip");
    const dialog = l.dalam("kotak")!;
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // Teks yang tampak di kotak tidak menyebut sistem asal.
    expect(l.kotak()!.shadowRoot!.textContent!.replace(/<style[\s\S]*?<\/style>/g, "")).not.toMatch(/aleta/i);
  });

  if (process.env.ALETA_TANGKAP_PRATINJAU) {
    it("menyimpan keadaan untuk tangkapan", async () => {
      const awalan = process.env.ALETA_TANGKAP_PRATINJAU!;
      const l = lingkungan({ html: `<base href="http://192.168.10.10/SIPP/">${HTML_BAS_EDOC}`, balasan: { [ALAMAT_BAS_PDF]: { tipe: "application/pdf", isi: PDF } } });
      l.klik(l.doc.querySelector("a")!);
      await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
      writeFileSync(`${awalan}-kotak.html`, l.kotak()!.shadowRoot!.innerHTML);
    });
  }
});
