// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * EDOC PUTUSAN DAN EDOC ANONIMISASI TERPISAH (30 September 2026)
 *
 * Diminta pengguna: tempat unggah edoc putusan dan edoc anonimisasi yang
 * TERPISAH, dikirim SEKALIGUS - hanya di tampilan Baru dan UI Baru. Tampilan
 * Lama tetap satu pemilih yang memasangkan menurut nama berkas.
 *
 * Fungsi SUNGGUHAN dari konten.js dipotong dan dijalankan di node:vm dengan
 * DOM jsdom; alatUjiMode tiruan menentukan tampilan.
 */

const konten = () =>
  readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/konten.js"), "utf8").replace(/\r\n/g, "\n");

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

function tetapan(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => b.startsWith(`const ${nama} = `) || b.startsWith(`let ${nama} = `));
  if (mulai < 0) throw new Error(`tetapan ${nama} tidak ketemu`);
  if (baris[mulai].trimEnd().endsWith(";")) return baris[mulai];
  let j = mulai;
  while (j < baris.length && baris[j] !== "};" && baris[j] !== "];") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});

const NOMOR = "1/Pdt.G/2026/PA.Dgl";

function muat(modeAwal: string) {
  const isi = konten();
  const dom = new JSDOM("<!doctype html><html><body><div>Selamat Datang <font>petugas.satu</font></div><div id='wadah'></div></body></html>");
  halaman.push(dom);
  const permintaan: Array<{ badan: FormData; batasMs: number }> = [];
  const muatUlang: number[] = [];
  let mode = modeAwal;
  let jawab: (badan: FormData) => unknown = (badan) => ({
    ok: true,
    antrean: true,
    berkas: ["putusan", "anonimisasi"].filter((j) => badan.has(j)).map((j) => ({ jenis: j, ok: true, jalur: `resources/file/${j}.rtf` })),
  });
  const k: Record<string, unknown> = {
    document: dom.window.document,
    setTimeout: (f: () => void) => {
      muatUlang.push(1);
      return 0;
    },
    FormData,
    File,
    alatUjiMode: () => mode,
    alatPesanGagal: (_g: unknown, status: number, apa: string) => `${apa} gagal: ${status}.`,
    alatAmbil: async (_a: string, opsi: { body: FormData; batasMs: number }) => {
      permintaan.push({ badan: opsi.body, batasMs: opsi.batasMs });
      return { ok: true, status: 200, json: async () => ({ data: jawab(opsi.body) }) };
    },
    muatUlangHalamanPerkara: () => undefined,
    bagian: (judul: string) => {
      const kotak = dom.window.document.createElement("div") as unknown as HTMLDivElement & { isi: HTMLDivElement };
      kotak.appendChild(dom.window.document.createElement("h3")).textContent = judul;
      kotak.isi = dom.window.document.createElement("div");
      kotak.appendChild(kotak.isi);
      return kotak;
    },
  };
  vm.createContext(k);
  vm.runInContext(
    [
      tetapan(isi, "POLA_PERKARA"),
      tetapan(isi, "ALETA_API_UNGGAH_SIPP"),
      tetapan(isi, "BATAS_UNGGAH_SIPP_MS"),
      tetapan(isi, "PESAN_GAGAL_UNGGAH"),
      tetapan(isi, "unggahEdocPakaiCaraLama"),
      ...[
        "buatElemen",
        "perkaraIdDariHalaman",
        "namaPenggunaSipp",
        "pesanGagalUnggah",
        "namaBerkasAnonim",
        "nomorDariNamaBerkas",
        "tandaBukanNaskahPutusan",
        "pasangkanBerkasUnggah",
        "kirimBadanUnggahSipp",
        "unggahBerpasangan",
        "bagianUnggahPutusanSipp",
        "unggahEdocTerpisahBerlaku",
        "bagianUnggahEdocTerpisah",
        "pasangGantiUnggahEdoc",
      ].map((nama) => potongFungsi(isi, nama)),
      "this.__uji = { bagianUnggahPutusanSipp, BATAS_UNGGAH_SIPP_MS };",
    ].join("\n"),
    k,
    { filename: "konten.js (potongan edoc)" }
  );
  const uji = k.__uji as { bagianUnggahPutusanSipp: (n: string) => HTMLDivElement; BATAS_UNGGAH_SIPP_MS: number };
  const d = dom.window.document;
  const pasang = () => {
    const kotak = uji.bagianUnggahPutusanSipp(NOMOR);
    d.getElementById("wadah")!.appendChild(kotak);
    return kotak;
  };
  const pilih = (el: HTMLInputElement, berkas: File[]) => {
    Object.defineProperty(el, "files", { value: berkas, configurable: true });
    el.dispatchEvent(new dom.window.Event("change"));
  };
  const redam = async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setImmediate(r));
  };
  return {
    d,
    dom,
    uji,
    pasang,
    pilih,
    redam,
    permintaan,
    muatUlang,
    setMode: (m: string) => {
      mode = m;
      d.dispatchEvent(new dom.window.CustomEvent("aleta-uji-berubah"));
    },
    aturJawab: (f: (b: FormData) => unknown) => void (jawab = f),
  };
}

const berkas = (nama: string, isi = "{\\rtf1 naskah}") => new File([isi], nama, { type: "application/rtf" });
const slotPemilih = (d: Document, s: string) => d.querySelector(`input[type=file][data-slot="${s}"]`) as HTMLInputElement;
const tombolUnggah = (d: Document) =>
  Array.from(d.querySelectorAll("button")).find((b) => b.textContent === "Unggah edoc ke SIPP") as HTMLButtonElement;

describe("tampilan Lama: tetap satu pemilih seperti sebelumnya", () => {
  it("satu pemilih multi-berkas, tanpa tempat terpisah", () => {
    const u = muat("lama");
    u.pasang();
    const pemilih = u.d.querySelectorAll("input[type=file]");
    expect(pemilih.length).toBe(1);
    expect((pemilih[0] as HTMLInputElement).multiple).toBe(true);
    expect(u.d.querySelector(".aleta-edoc-slot")).toBeNull();
    expect(u.d.body.textContent).toContain("dari SATU pemilih");
  });
});

describe("tampilan Baru dan UI Baru: edoc putusan dan edoc anonimisasi terpisah", () => {
  for (const mode of ["baru", "ui"]) {
    it(`${mode}: dua tempat, masing-masing satu berkas`, () => {
      const u = muat(mode);
      u.pasang();
      const slot = Array.from(u.d.querySelectorAll(".aleta-edoc-slot")).map((x) => x.getAttribute("data-slot"));
      expect(slot).toEqual(["putusan", "anonimisasi"]);
      expect(u.d.body.textContent).toContain("Edoc putusan");
      expect(u.d.body.textContent).toContain("Edoc anonimisasi");
      expect(slotPemilih(u.d, "putusan").multiple).toBe(false);
      expect(tombolUnggah(u.d).disabled).toBe(true);
    });
  }

  it("keduanya dikirim SEKALIGUS dalam satu kiriman; anonimisasi tanpa kata 'anonim' pun masuk slotnya", async () => {
    const u = muat("baru");
    u.pasang();
    u.pilih(slotPemilih(u.d, "putusan"), [berkas("PA.Dgl_2026_Pdt.G_1_putusan_akhir.rtf")]);
    // Nama yang dahulu membuat slot anonimisasi kosong pada cara lama.
    u.pilih(slotPemilih(u.d, "anonimisasi"), [berkas("salinan disamarkan.rtf", "{\\rtf1 samar}")]);
    expect(tombolUnggah(u.d).disabled).toBe(false);
    tombolUnggah(u.d).click();
    await u.redam();
    expect(u.permintaan.length).toBe(1);
    const badan = u.permintaan[0].badan;
    expect((badan.get("putusan") as File).name).toBe("PA.Dgl_2026_Pdt.G_1_putusan_akhir.rtf");
    expect((badan.get("anonimisasi") as File).name).toBe("salinan disamarkan.rtf");
    expect(badan.get("olehUsername")).toBe("petugas.satu");
    // Dua naskah diubah menjadi PDF dalam satu kiriman: batasnya dua kali lipat.
    expect(u.permintaan[0].batasMs).toBe(u.uji.BATAS_UNGGAH_SIPP_MS * 2);
    expect(u.d.body.textContent).toContain("Edoc putusan dan edoc anonimisasi terunggah");
    expect(u.muatUlang.length).toBe(1);
  });

  it("salah satu saja boleh: hanya anonimisasi", async () => {
    const u = muat("ui");
    u.pasang();
    u.pilih(slotPemilih(u.d, "anonimisasi"), [berkas("anonim 1-Pdt.G-2026.pdf", "%PDF-1.4")]);
    tombolUnggah(u.d).click();
    await u.redam();
    expect(u.permintaan.length).toBe(1);
    expect(u.permintaan[0].badan.has("putusan")).toBe(false);
    expect(u.permintaan[0].badan.has("anonimisasi")).toBe(true);
    expect(u.permintaan[0].batasMs).toBe(u.uji.BATAS_UNGGAH_SIPP_MS);
  });

  it("penjagaan lama tetap berlaku: perkara lain, bentuk asing, berkas yang sama di dua tempat", () => {
    const u = muat("baru");
    u.pasang();
    u.pilih(slotPemilih(u.d, "putusan"), [berkas("9_Pdt.G_2026_PA.Dgl - [01] Kabul.rtf")]);
    expect(u.d.body.textContent).toContain("berkas perkara lain");
    expect(tombolUnggah(u.d).disabled).toBe(true);
    u.pilih(slotPemilih(u.d, "putusan"), [new File(["x"], "pindaian.jpg", { type: "image/jpeg" })]);
    expect(u.d.body.textContent).toContain("bukan naskah putusan");
    const sama = berkas("PA.Dgl_2026_Pdt.G_1_putusan_akhir.rtf");
    u.pilih(slotPemilih(u.d, "putusan"), [sama]);
    u.pilih(slotPemilih(u.d, "anonimisasi"), [sama]);
    expect(u.d.body.textContent).toContain("Berkas yang sama dipilih di kedua tempat");
    expect(tombolUnggah(u.d).disabled).toBe(true);
  });

  it("sebagian gagal: disebut per berkas, halaman TIDAK dimuat ulang", async () => {
    const u = muat("baru");
    u.aturJawab(() => ({
      ok: true,
      berkas: [
        { jenis: "putusan", ok: true, jalur: "resources/file/putusan.rtf" },
        { jenis: "anonimisasi", ok: false, alasan: "berkas_kosong" },
      ],
    }));
    u.pasang();
    u.pilih(slotPemilih(u.d, "putusan"), [berkas("PA.Dgl_2026_Pdt.G_1_putusan_akhir.rtf")]);
    u.pilih(slotPemilih(u.d, "anonimisasi"), [berkas("anonim 1-Pdt.G-2026.rtf", "{\\rtf1 lain}")]);
    tombolUnggah(u.d).click();
    await u.redam();
    expect(u.d.body.textContent).toContain("Sebagian terunggah");
    expect(u.d.body.textContent).toContain("Berkasnya kosong.");
    expect(u.muatUlang.length).toBe(0);
  });

  it("cara lama tetap dapat dipilih; pengalih kembali ke Lama menyusun ulang bagiannya", () => {
    const u = muat("baru");
    u.pasang();
    const tautan = Array.from(u.d.querySelectorAll("button")).find((b) => /cara lama/.test(b.textContent || "")) as HTMLButtonElement;
    tautan.click();
    expect(u.d.querySelectorAll("input[type=file]").length).toBe(1);
    expect((u.d.querySelector("input[type=file]") as HTMLInputElement).multiple).toBe(true);

    const v = muat("ui");
    v.pasang();
    expect(v.d.querySelectorAll(".aleta-edoc-slot").length).toBe(2);
    v.setMode("lama");
    expect(v.d.querySelectorAll(".aleta-edoc-slot").length).toBe(0);
    expect(v.d.querySelectorAll("input[type=file]").length).toBe(1);
    v.setMode("baru");
    expect(v.d.querySelectorAll(".aleta-edoc-slot").length).toBe(2);
  });
});
