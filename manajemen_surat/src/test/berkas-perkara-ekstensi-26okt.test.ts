import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { BAWAAN_HALAMAN, DAFTAR_CIRI, hitungDaftarIsi, rangkaiCiri, susunUrutan, tanggalIndonesia, teksRentang, uraiHalaman, type BarisDasar } from "@/lib/berkas-perkara";

/**
 * Layar kerja Sampul dan Daftar Isi di ekstensi (blangko-derry-berkas.js): bagian murninya kembaran lib/berkas-perkara.ts
 * (dijaga di sini), dan layar dijalankan di jsdom dengan host tiruan: tidak ada yang keluar kecuali permintaan ke portal.
 */

const AKAR = path.resolve(__dirname, "../../..");
const SUMBER = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-berkas.js"), "utf8");
type Bebas = any;
let BK: Bebas;
const bot: Bebas = createRequire(import.meta.url)(path.join(AKAR, "aleta_bot/services/berkasPerkaraService.js"));

beforeAll(() => {
  const g = globalThis as Bebas;
  if (!g.CSS || typeof g.CSS.escape !== "function") g.CSS = { escape: (s: string) => String(s).replace(/([^\w-])/g, "\\$1") };
  (0, eval)(SUMBER);
  BK = g.AletaBerkasKhusus;
});

const dasar = (bundel: "A" | "B", kunci: string, halaman: number, sumber: "pasti" | "perkiraan" = "pasti"): BarisDasar => ({ bundel, grup: bundel === "A" ? "II. PENETAPAN AWAL" : "PASCA PUTUSAN", kunci, nama: `Dok ${kunci}`, tanggal: "2026-01-02", halaman, sumber });

describe("kembaran murni = lib portal", () => {
  it("daftar ciri sama (kunci, nama, kelompok, sisi bawaan)", () => {
    const a = BK._murni.CIRI.map((c: Bebas) => [c.k, c.n, c.g, c.s ?? ""]);
    const b = DAFTAR_CIRI.map((c) => [c.kunci, c.nama, c.kelompok, c.sisi ?? ""]);
    expect(a).toEqual(b);
    expect(BK._murni.BAWAAN_HALAMAN).toEqual(BAWAAN_HALAMAN);
  });

  it("rangkaian ciri, halaman, tanggal, rentang", () => {
    for (const aktif of [[], ["prodeo"], ["kuasa", "ghaib", "verstek", "kumulasi", "ikrar"]]) {
      const peta = Object.fromEntries(aktif.map((k) => [k, true]));
      expect(BK._murni.rangkaiCiri(peta)).toBe(rangkaiCiri(aktif));
    }
    for (const t of ["", "3", "5-9", "5–9", "abc", "0", "9-5", " 12 "]) expect(BK._murni.uraiHalaman(t), t).toEqual(uraiHalaman(t));
    expect(BK._murni.tanggalIndonesia("2026-03-12")).toBe(tanggalIndonesia("2026-03-12"));
    expect(BK._murni.teksRentang({ awal: 2, akhir: 4 })).toBe(teksRentang({ awal: 2, akhir: 4 }));
  });

  it("hitung daftar isi dan susunan urutan identik pada banyak masukan", () => {
    const baris = [dasar("A", "a1", 3), dasar("A", "a2", 2, "perkiraan"), dasar("A", "a3", 4), dasar("B", "b1", 5), dasar("B", "b2", 1)];
    const sunting = [
      {},
      { a2: { tampil: false } },
      { a2: { halamanTeks: "6-7" }, b1: { halamanTeks: "2" } },
      { a1: { halamanTeks: "x" }, x1: { tambahan: true, judulManual: "Lain", tanggalManual: "2 Maret 2026", halamanTeks: "2" } },
    ];
    for (const s of sunting) {
      for (const bundelB of ["1", "lanjut"] as const) {
        const semua = [...baris, ...(s as Bebas).x1 ? [dasar("A", "x1", 1)] : []];
        const a = BK._murni.hitungDaftarIsi(semua, s, { bundelB });
        const b = hitungDaftarIsi(semua, s as Bebas, { bundelB });
        expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)));
      }
    }
    const urut = { a3: 1, a1: 2 };
    expect(BK._murni.susunUrutan(["a1", "a2", "a3"], urut, ["x1"])).toEqual(susunUrutan(["a1", "a2", "a3"], urut, ["x1"]));
    expect(BK._murni.susunUrutan(["a1", "a2"], {}, [])).toEqual(["a1", "a2"]);
  });

  it("hitung halaman PDF di ekstensi sama dengan di bot", () => {
    const pdf = (n: number, salah?: number) => {
      const anak = Array.from({ length: n }, (_, i) => `${3 + i} 0 R`).join(" ");
      let s = `%PDF-1.4\n2 0 obj\n<< /Type /Pages /Kids [${anak}] /Count ${salah ?? n} >>\nendobj\n`;
      for (let i = 0; i < n; i += 1) s += `${3 + i} 0 obj\n<< /Type /Page >>\nendobj\n`;
      return Buffer.from(s, "latin1");
    };
    for (const [n, salah] of [[1, undefined], [5, undefined], [4, 9]] as const) {
      const eks = BK._murni.halamanPdf(new Uint8Array(pdf(n, salah)).buffer);
      const sb = bot.strukturPdf(pdf(n, salah));
      expect(eks.halaman).toBe(sb.count || sb.objek);
      expect(eks.ragu).toBe(sb.count > 0 && sb.objek > 0 && sb.count !== sb.objek);
    }
    expect(BK._murni.halamanPdf(new Uint8Array(Buffer.from("bukan")).buffer)).toBeNull();
  });
});

describe("layar kerja (jsdom, host tiruan)", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  const fakta = () => ({
    perkara: { perkaraId: 5, nomor: "5/Pdt.G/2026/PA.Cth", jenisId: 362, jenisNama: "Dispensasi Kawin", jenis: "dk", permohonan: true },
    ciri: { prodeo: { nyala: true, sisi: "" }, pns: { nyala: true, sisi: "T" } },
    isian: { b3: "Menghindari zina", mediator: "", tglpbt: "2026-04-01" },
    dokumen: [
      { bundel: "A", grup: "I. PENDAFTARAN", kunci: "gugatan", nama: "Surat Permohonan Pemohon", tanggal: "2026-01-04", halaman: 6, sumber: "pasti", dasar: "arsip" },
      { bundel: "A", grup: "II. PENETAPAN AWAL", kunci: "phs", nama: "Penetapan Hari Sidang (PHS)", tanggal: "2026-01-08", halaman: null, sumber: "perkiraan", jenisBawaan: "phs" },
      { bundel: "A", grup: "IV. PUTUSAN / PENETAPAN", kunci: "putusan", nama: "Penetapan", tanggal: "2026-02-01", halaman: null, sumber: "perkiraan", jenisBawaan: "putusan" },
      { bundel: "B", grup: "PASCA PUTUSAN", kunci: "minutasi", nama: "Penetapan Minutasi", tanggal: "2026-02-03", halaman: null, sumber: "perkiraan", jenisBawaan: "minutasi" },
    ],
  });

  function buatHost() {
    const panggilan: Array<{ alamat: string; metode: string; badan: Bebas }> = [];
    const toast: string[] = [];
    const host = {
      ambilPortal: async (alamat: string, opsi: Bebas) => {
        const metode = String((opsi && opsi.method) || "GET");
        const badan = opsi && opsi.body ? JSON.parse(opsi.body) : null;
        panggilan.push({ alamat, metode, badan });
        if (alamat.includes("/naskah")) return { rtfBase64: btoa("{\\rtf1\\ansi Halo}"), kosong: [], mesinGalat: "" };
        if (metode === "PUT") return { ok: true, ditolak: [] };
        return { fakta: fakta(), sunting: { susunan: {}, tag: {}, isian: {} }, bawaan: { putusan: 13 } };
      },
      unduh: vi.fn(async () => ({ ok: true })),
      pdfDari: vi.fn(async () => ({ blob: new Blob(["x"]) })),
      namaUnduhan: (n: string, b: string, a: string) => `${n} - ${b}.${a}`,
      rtfKeHtml: (rtf: string) => `<p>${rtf.length}</p>`,
      toast: (t: string) => toast.push(t),
      bacaPenyimpanan: async () => ({}),
      tulisPenyimpanan: vi.fn(async () => true),
      sebagaiPeran: () => "",
    };
    return { host, panggilan, toast };
  }

  async function bukaLayar(jenis: "sampul" | "daftar-isi") {
    vi.useFakeTimers();
    const w = document.createElement("div");
    document.body.appendChild(w);
    const { host, panggilan, toast } = buatHost();
    await BK.buka(w, host, { jenis, perkaraId: "5", nomor: "5/Pdt.G/2026/PA.Cth" });
    await vi.advanceTimersByTimeAsync(50);
    return { w, host, panggilan, toast };
  }

  it("sampul: 25 ciri, yang otomatis berwarna, klik mengubah dan menyimpan setelah jeda", async () => {
    const { w, panggilan } = await bukaLayar("sampul");
    const chip = w.querySelectorAll(".bk-ciri");
    expect(chip).toHaveLength(25);
    expect(w.querySelectorAll(".bk-ciri.oto")).toHaveLength(2);
    expect(w.querySelector(".bk-f label[for=bk-in-b3]")).toBeTruthy(); // isian khas dispensasi
    (w.querySelector('[data-bkv="prodeo"]') as HTMLElement).click();
    expect(w.querySelector('[data-bkv="prodeo"]')!.className).toContain("mati-tgn");
    await vi.advanceTimersByTimeAsync(1600);
    const put = panggilan.filter((p) => p.metode === "PUT").at(-1)!;
    expect(put.badan.tag).toEqual({ prodeo: false });
    const naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.jenis).toBe("sampul");
    expect(naskah.badan.nilai["5801"]).toContain("PNS/ASN T");
    expect(naskah.badan.nilai["5801"]).not.toContain("PRODEO");
    expect(naskah.badan.nilai["5842"]).toBeUndefined(); // tidak diubah tangan: ABT yang menghitung
  });

  it("sampul: isian yang diubah tangan menimpa kode ABT; mengembalikan nilai otomatis menghapus timpaan", async () => {
    const { w, panggilan } = await bukaLayar("sampul");
    const kotak = w.querySelector("#bk-in-b3") as HTMLTextAreaElement;
    kotak.value = "Hamil di luar nikah";
    kotak.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(2000);
    let naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.nilai["5843"]).toContain("Alasan dispensasi: Hamil di luar nikah");
    kotak.value = "Menghindari zina";
    kotak.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(2000);
    naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.nilai["5843"]).toBeUndefined();
  });

  it("daftar isi: halaman manual, rentang, sembunyikan, tambah baris, dan muatan naskah", async () => {
    const { w, panggilan } = await bukaLayar("daftar-isi");
    const baris = () => w.querySelectorAll("tbody tr[data-key]");
    expect(baris()).toHaveLength(4);
    expect(w.querySelector('[data-rg="gugatan"]')!.textContent).toContain("1–6");
    expect(w.querySelector('[data-sb="gugatan"]')!.textContent).toContain("pasti");
    expect(w.querySelector('[data-sb="phs"]')!.textContent).toContain("perkiraan");
    // putusan: bawaan 13 hlm, ada pengisi dari PDF
    expect(w.querySelector('[data-bk-pdf="putusan"]')).toBeTruthy();
    const hal = w.querySelector('[data-bk-edit="halamanTeks"][data-bkk="phs"]') as HTMLInputElement;
    hal.value = "8-9";
    hal.dispatchEvent(new Event("input", { bubbles: true }));
    expect(w.querySelector('[data-sb="phs"]')!.textContent).toContain("manual");
    expect(w.querySelector('[data-rg="phs"]')!.textContent).toContain("8–9");
    expect(w.querySelector('[data-pr="phs"]')!.textContent).toContain("terlewat");
    hal.value = "dua";
    hal.dispatchEvent(new Event("input", { bubbles: true }));
    expect(hal.getAttribute("aria-invalid")).toBe("true");
    hal.value = "";
    hal.dispatchEvent(new Event("input", { bubbles: true }));
    (w.querySelector('[data-bk="sembunyi"][data-bkk="phs"]') as HTMLElement).click();
    expect(w.querySelector('tr[data-key="phs"]')!.className).toContain("tersembunyi");
    (w.querySelector('[data-bk="tambah"][data-bkv="A"]') as HTMLElement).click();
    expect(baris()).toHaveLength(5);
    await vi.advanceTimersByTimeAsync(2000);
    const naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.jenis).toBe("daftar-isi");
    expect(naskah.badan.baris.map((b: Bebas) => b.kunci)).toContain("x1");
    expect(naskah.badan.sunting.phs.tampil).toBe(false);
    expect(naskah.badan.sunting.x1.tambahan).toBe(true);
    const put = panggilan.filter((p) => p.metode === "PUT").at(-1)!;
    expect(put.badan.susunan.find((s: Bebas) => s.kunci === "phs")).toMatchObject({ tampil: false, bundel: "A" });
    expect(put.badan.isian.bundelB).toBe("1");
  });

  it("daftar isi: geser menukar urutan, urutan ikut tersimpan", async () => {
    const { w, panggilan } = await bukaLayar("daftar-isi");
    (w.querySelector('[data-bk="turun"][data-bkb="A"][data-bki="0"]') as HTMLElement).click();
    const kunci = [...w.querySelectorAll("tbody tr[data-key]")].map((r) => r.getAttribute("data-key"));
    expect(kunci.slice(0, 2)).toEqual(["phs", "gugatan"]);
    await vi.advanceTimersByTimeAsync(2000);
    const put = panggilan.filter((p) => p.metode === "PUT").at(-1)!;
    expect(put.badan.susunan.filter((s: Bebas) => s.bundel === "A").map((s: Bebas) => s.kunci).slice(0, 2)).toEqual(["phs", "gugatan"]);
  });

  it("cetak: RTF dan PDF diunduh dengan nama baku; kertas pilihan diingat", async () => {
    const { w, host } = await bukaLayar("sampul");
    const pilih = w.querySelector("[data-bk-kertas]") as HTMLSelectElement;
    pilih.value = "f4";
    pilih.dispatchEvent(new Event("change", { bubbles: true }));
    expect(host.tulisPenyimpanan).toHaveBeenCalledWith({ blangkoDerryKertas: "f4" });
    (w.querySelector('[data-bk="cetak"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);
    expect(host.unduh).toHaveBeenCalledTimes(2);
    const nama = (host.unduh.mock.calls as Bebas[]).map((c) => c[1]);
    expect(nama).toEqual(["5/Pdt.G/2026/PA.Cth - Sampul Berkas Perkara.rtf.rtf", "5/Pdt.G/2026/PA.Cth - Sampul Berkas Perkara.rtf.pdf"]);
  });

  it("jenis layar hanya untuk dua berkas itu", () => {
    expect(BK.jenisLayar("Sampul Berkas Perkara.rtf")).toBe("sampul");
    expect(BK.jenisLayar("Daftar Isi Berkas.rtf")).toBe("daftar-isi");
    expect(BK.jenisLayar("Sampul Berkas Perkara (F4).rtf")).toBe("");
    expect(BK.jenisLayar("BAS Sidang Pertama.rtf")).toBe("");
    expect(BK.KODE_SAKLAR).toBe("berkas-perkara-khusus");
  });
});
