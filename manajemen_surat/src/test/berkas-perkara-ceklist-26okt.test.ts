import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { berkasBlangko, berkasVarianUkuran, jenisLayarBerkas } from "@/lib/berkas-perkara";
import {
  PENANDA_TABEL_CEKLIST,
  bersihkanBahanCeklist,
  kotaDariPengadilan,
  penandaJenisCeklist,
  susunCeklist,
  tabelCeklistRtf,
  tempelTabelCeklist,
  teksRingkasCeklist,
  type BahanCeklist,
  type BarisCeklist,
  type FaktaCeklist,
} from "@/lib/ceklist-berkas";

/**
 * Ceklist berkas perkara (Meja I): daftar dokumen menurut jenis dan keadaan, ada / tidak ada otomatis hanya dari sumber pasti, tabel RTF disusun portal,
 * layar kerja di ekstensi. Data rekaan; tanpa kata aplikasi di naskah.
 */

const AKAR = path.resolve(__dirname, "../../..");
type Bebas = any;

const fakta = (o: Partial<FaktaCeklist> = {}, k: Partial<FaktaCeklist["keadaan"]> = {}): FaktaCeklist => ({
  keadaan: { phs: true, kuasa: false, prodeo: false, ghaib: false, ecourt: true, anak: false, ...k },
  penetapan: { pmh: "2026-03-13", ppp: "2026-03-13", pjs: "2026-03-13", phs: "2026-03-13" },
  ppNama: "Siti Nurjannah, S.H.",
  kasir: { jumlah: 1240000, tanggal: "2026-03-12", baris: 1 },
  izinCerai: "",
  judulDokumen: ["SURAT GUGATAN (Docx/Rtf)", "Surat Kuasa", "KTP Penggugat", "Akta Kelahiran Anak 1"],
  tertulisDokumen: true,
  ...o,
});
const bahan = (jenis: string, f: FaktaCeklist, tangan: Record<string, boolean> = {}): BahanCeklist => ({ jenis, lawan: ["cg", "waris", "hb", "poligami", "es", "asuh"].includes(jenis), fakta: f, tangan });
const dok = (b: BarisCeklist[]) => b.filter((x): x is Extract<BarisCeklist, { kunci: string }> => "kunci" in x);
const ambil = (h: ReturnType<typeof susunCeklist>, kunci: string) => dok(h.baris).find((x) => x.kunci === kunci);

describe("daftar dokumen mengikuti jenis dan keadaan", () => {
  it("penanda jenis: CT dan CG menyala sesuai perkara, jenis lain satu kode", () => {
    expect(penandaJenisCeklist("cg")).toBe("[ ] CT   [X] CG");
    expect(penandaJenisCeklist("ct")).toBe("[X] CT   [ ] CG");
    expect(penandaJenisCeklist("dk")).toBe("[X] DK");
    expect(penandaJenisCeklist("tidak-dikenal")).toBe("[X] LN");
  });

  it("yang tidak berlaku tidak dicetak: SKTM hanya prodeo, kuasa hanya bila berkuasa, izin atasan hanya bila pihak wajib izin, akta anak hanya bila ada anak, ghaib hanya bila ghaib", () => {
    const polos = susunCeklist(bahan("cg", fakta()));
    for (const k of ["sktm", "kuasa", "advokat", "izin", "ghaib", "lahir"]) expect(ambil(polos, k), k).toBeUndefined();
    expect(ambil(polos, "setor")).toBeDefined();
    const penuh = susunCeklist(bahan("cg", fakta({ izinCerai: "belum-ada" }, { prodeo: true, kuasa: true, ghaib: true, anak: true })));
    for (const k of ["sktm", "kuasa", "advokat", "izin", "ghaib", "lahir"]) expect(ambil(penuh, k), k).toBeDefined();
    expect(ambil(penuh, "setor")).toBeUndefined();   // prodeo: SKTM menggantikan bukti setor
    expect(ambil(penuh, "nikah_asli")?.st).toBe("");  // dokumen fisik selalu petugas
  });

  it("dokumen khas per jenis perkara", () => {
    const kunci = (j: string) => dok(susunCeklist(bahan(j, fakta())).baris).map((x) => x.kunci);
    expect(kunci("dk")).toEqual(expect.arrayContaining(["tolak_kua", "lahir", "ktp_calon", "rekom"]));
    expect(kunci("in")).toEqual(expect.arrayContaining(["nikah", "ket_kua", "ket_desa"]));
    expect(kunci("waris")).toEqual(expect.arrayContaining(["kematian", "silsilah", "milik"]));
    expect(kunci("hb")).toEqual(expect.arrayContaining(["akta_cerai", "milik"]));
    expect(kunci("poligami")).toEqual(expect.arrayContaining(["setuju", "gaji", "adil"]));
    expect(kunci("es")).not.toContain("kk");
    expect(kunci("wali")).toEqual(expect.arrayContaining(["kk", "kk_anak"]));
    expect(kunci("cg")).not.toContain("nikah_asli".replace("asli", "x"));
  });

  it("sampai empat baris tambahan tulis tangan dan nomor berurutan", () => {
    const h = susunCeklist(bahan("cg", fakta()));
    expect(h.baris.filter((x) => "tangan" in x)).toHaveLength(4);
    const rtf = tabelCeklistRtf(h.baris, 10506);
    const nomor = [...rtf.matchAll(/\\fs15\\sb15\\sa15 (\d+)\\cell/g)].map((m) => Number(m[1]));
    expect(nomor).toEqual(nomor.map((_, i) => i + 1));
    expect(nomor.length).toBe(dok(h.baris).length + 4);
  });
});

describe("ada / tidak ada otomatis hanya dari sumber pasti", () => {
  it("penetapan: terbit = ada (OTO), belum terbit = tidak ada (OTO)", () => {
    const sesudah = susunCeklist(bahan("ct", fakta()));
    for (const k of ["pmh", "ppp", "pjs", "phs"]) expect(ambil(sesudah, k)).toMatchObject({ st: "ok", oto: true });
    const sebelum = susunCeklist(bahan("ct", fakta({ penetapan: { pmh: "2026-03-13" } }, { phs: false })));
    expect(ambil(sebelum, "pmh")?.st).toBe("ok");
    expect(ambil(sebelum, "phs")).toMatchObject({ st: "no", oto: true, sumber: "belum terbit di SIPP" });
  });

  it("kasir: panjar tercatat = SKUM dan setoran ada; belum = tidak ada; prodeo tanpa panjar diperiksa petugas", () => {
    const ada = susunCeklist(bahan("ct", fakta()));
    expect(ambil(ada, "skum")).toMatchObject({ st: "ok", sumber: expect.stringContaining("Rp 1.240.000") });
    expect(ambil(ada, "setor")?.st).toBe("ok");
    const belum = susunCeklist(bahan("ct", fakta({ kasir: { jumlah: 0, baris: 0 } })));
    expect(ambil(belum, "skum")?.st).toBe("no");
    expect(ambil(belum, "setor")?.st).toBe("no");
    const prodeo = susunCeklist(bahan("ct", fakta({ kasir: { jumlah: 0, baris: 0 } }, { prodeo: true })));
    expect(ambil(prodeo, "skum")?.st).toBe("");
  });

  it("SKTM prodeo: ditemukan di judul e-Court = ada; tidak ditemukan padahal daftar terbaca = tidak ada; daftar tak terbaca = petugas", () => {
    expect(ambil(susunCeklist(bahan("ct", fakta({ judulDokumen: ["Dokumen SKTM Pemohon"] }, { prodeo: true }))), "sktm")?.st).toBe("ok");
    expect(ambil(susunCeklist(bahan("ct", fakta({}, { prodeo: true }))), "sktm")?.st).toBe("no");
    expect(ambil(susunCeklist(bahan("ct", fakta({ tertulisDokumen: false, judulDokumen: [] }, { prodeo: true }))), "sktm")?.st).toBe("");
  });

  it("izin atasan: ada / belum ada dari izinCeraiService; belum terbaca = petugas", () => {
    const st = (izin: string) => ambil(susunCeklist(bahan("cg", fakta({ izinCerai: izin }))), "izin")?.st;
    expect(st("ada")).toBe("ok");
    expect(st("belum-ada")).toBe("no");
    expect(st("belum-terbaca")).toBe("");
    expect(st("belum-dicatat")).toBe("");
    expect(st("")).toBeUndefined();
  });

  it("dokumen lain: ditemukan di judul = ada; tidak ditemukan TIDAK dianggap tidak ada (bisa di dalam berkas bukti)", () => {
    const h = susunCeklist(bahan("cg", fakta({}, { anak: true })));
    expect(ambil(h, "ktp")).toMatchObject({ st: "ok", oto: true });
    expect(ambil(h, "lahir")?.st).toBe("ok");
    expect(ambil(h, "nikah")).toMatchObject({ st: "", oto: false });
    expect(ambil(h, "kk")?.st).toBe("");
    expect(ambil(h, "gugatan")?.st).toBe("ok");
  });

  it("tangan menimpa otomatis dan tidak bertanda OTO; ringkasan menghitung tiga golongan", () => {
    const h = susunCeklist(bahan("cg", fakta(), { nikah: true, ktp: false }));
    expect(ambil(h, "nikah")).toMatchObject({ st: "ok", oto: false, sumber: "dicentang petugas" });
    expect(ambil(h, "ktp")).toMatchObject({ st: "no", oto: false });
    const sum = dok(h.baris).reduce((a, x) => a + 1, 0);
    expect(h.ringkas.ada + h.ringkas.belum + h.ringkas.petugas).toBe(sum);
    expect(teksRingkasCeklist({ ada: 9, belum: 2, petugas: 3 })).toBe("9 ada (otomatis)   -   2 belum ada, minta ke pihak   -   3 diperiksa petugas");
  });
});

describe("RTF, berkas blangko, saringan", () => {
  it("tabel RTF: kepala, kelompok, centang pada font simbol, OTO, tanpa kata aplikasi, karakter RTF aman", () => {
    const h = susunCeklist(bahan("cg", fakta({ judulDokumen: ["KTP {x}\\y"] }, { prodeo: true })));
    const rtf = tabelCeklistRtf(h.baris, 10506);
    expect(rtf).toContain("JENIS SURAT / DOKUMEN");
    expect(rtf).toContain("PENETAPAN AWAL");
    expect(rtf).toContain("\\u10003?");
    expect(rtf).toContain("\\u10007?");
    expect(rtf).toContain("OTO");
    expect(rtf).toContain("KTP \\{x\\}\\\\y");
    expect(rtf.toLowerCase()).not.toContain("aleta");
  });

  it("penanda diganti tabel: seluruh paragraf penanda; tanpa penanda RTF tak berubah", () => {
    const rtf = `{\\rtf1\\ansi\n\\pard\\plain\\ql\\f0\\fs18 {\\fs14 ${PENANDA_TABEL_CEKLIST}}\\par\n\\pard\\plain sesudah\\par\n}`;
    const hasil = tempelTabelCeklist(rtf, "TABEL\n");
    expect(hasil).toBe("{\\rtf1\\ansi\nTABEL\n\\pard\\plain sesudah\\par\n}");
    expect(tempelTabelCeklist("{\\rtf1 x}", "TABEL")).toBe("{\\rtf1 x}");
  });

  it("berkas blangko Ceklist di folder PTSP bersama sampul; varian ukuran disembunyikan", () => {
    expect(berkasBlangko("ceklist", "a4")).toEqual({ folder: "derry_briantono/99 PTSP", berkas: "Ceklist Berkas Perkara.rtf", jenisFolder: "ptsp" });
    expect(berkasBlangko("ceklist", "legal").berkas).toBe("Ceklist Berkas Perkara (Legal).rtf");
    expect(jenisLayarBerkas("derry_briantono/99 PTSP", "Ceklist Berkas Perkara.rtf")).toBe("ceklist");
    expect(berkasVarianUkuran("Ceklist Berkas Perkara (F4).rtf")).toBe(true);
    expect(berkasVarianUkuran("Ceklist Berkas Perkara.rtf")).toBe(false);
  });

  it("kota dari nama pengadilan; saringan klien membuang jenis/status tak sah dan teks bernama aplikasi", () => {
    expect(kotaDariPengadilan("Pengadilan Agama Donggala")).toBe("Donggala");
    expect(kotaDariPengadilan("PENGADILAN AGAMA PALU")).toBe("Palu");
    expect(kotaDariPengadilan("")).toBe("");
    const b = bersihkanBahanCeklist({ jenis: "naga", lawan: false, tangan: { nikah: 1, "BAD KEY": true }, fakta: { ppNama: "Panitera Pengganti: Budi", izinCerai: "aneh", judulDokumen: ["ok", "ada aleta"], kasir: { jumlah: "1000", baris: 2 }, keadaan: { phs: 1 } } });
    expect(b?.jenis).toBe("lain");
    expect(b?.lawan).toBe(false);
    expect(b?.tangan).toEqual({ nikah: true });
    expect(b?.fakta.ppNama).toBe("Budi");
    expect(b?.fakta.izinCerai).toBe("");
    expect(b?.fakta.judulDokumen).toEqual(["ok"]);
    expect(b?.fakta.kasir.jumlah).toBe(1000);
    expect(b?.fakta.keadaan.phs).toBe(true);
    expect(bersihkanBahanCeklist("x")).toBeNull();
  });
});

describe("layar kerja ceklist di ekstensi (jsdom)", () => {
  let BK: Bebas;
  beforeAll(() => {
    const g = globalThis as Bebas;
    if (!g.CSS || typeof g.CSS.escape !== "function") g.CSS = { escape: (s: string) => String(s).replace(/([^\w-])/g, "\\$1") };
    (0, eval)(readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-berkas.js"), "utf8"));
    BK = g.AletaBerkasKhusus;
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("dikenali sebagai layar ceklist; daftar datang dari portal; status diputar otomatis > ada > tidak ada > otomatis; badan naskah memuat fakta dan tangan", async () => {
    expect(BK.jenisLayar("Ceklist Berkas Perkara.rtf")).toBe("ceklist");
    expect(BK.jenisLayar("Ceklist Berkas Perkara (F4).rtf")).toBe("");
    vi.useFakeTimers();
    const panggilan: Array<{ alamat: string; metode: string; badan: Bebas }> = [];
    const baris = [
      { grup: "PENDAFTARAN" },
      { kunci: "gugatan", nama: "Surat Gugatan", sifat: "WAJIB", st: "ok", oto: true, sumber: "e-Court: gugatan" },
      { kunci: "nikah", nama: "Fotokopi Buku Nikah", sifat: "WAJIB", st: "", oto: false, sumber: "diperiksa petugas" },
      { tangan: true },
    ];
    const host = {
      ambilPortal: async (alamat: string, opsi: Bebas) => {
        const metode = String((opsi && opsi.method) || "GET");
        const badan = opsi && opsi.body ? JSON.parse(opsi.body) : null;
        panggilan.push({ alamat, metode, badan });
        if (alamat.includes("/naskah")) return { rtfBase64: btoa("{" + String.fromCharCode(92) + "rtf1 x}"), ceklist: { baris, ringkas: { ada: 1, belum: 0, petugas: 1 } }, lampiran: [] };
        if (metode === "PUT") return { ok: true, ditolak: [] };
        return {
          fakta: {
            perkara: { perkaraId: 5, nomor: "5/Pdt.G/2026/PA.Cth", jenis: "cg", jenisNama: "Cerai Gugat", berlawanan: true, sebutanP: "Penggugat", sebutanT: "Tergugat" },
            ciri: {},
            isian: {},
            dokumen: [],
            ceklist: { keadaan: { phs: true }, penetapan: {}, kasir: {}, judulDokumen: ["a"], izinCerai: "" },
          },
          sunting: { susunan: {}, tag: {}, isian: {} },
          bawaan: {},
        };
      },
      unduh: vi.fn(async () => ({ ok: true })),
      pdfDari: vi.fn(async () => ({ blob: new Blob(["x"]) })),
      namaUnduhan: (n: string, b: string, a: string) => `${n} - ${b}.${a}`,
      rtfKeHtml: () => "<p>x</p>",
      toast: () => undefined,
      bacaPenyimpanan: async () => ({}),
      tulisPenyimpanan: vi.fn(async () => true),
      sebagaiPeran: () => "",
    };
    const w = document.createElement("div");
    document.body.appendChild(w);
    await BK.buka(w, host, { jenis: "ceklist", bentuk: "awal", perkaraId: "5", nomor: "5/Pdt.G/2026/PA.Cth" });
    await vi.advanceTimersByTimeAsync(300);
    expect(w.querySelector('[role="tablist"]')).toBeNull();   // tanpa tab sampul/daftar isi
    expect(w.textContent).toContain("Ceklist berkas (Meja I)");
    expect(w.querySelectorAll("[data-bk-cek] tbody tr[data-key]")).toHaveLength(2);
    expect(w.textContent).toContain("1 ada (otomatis atau dicentang)");
    const tombol = () => w.querySelector('[data-bk="cek"][data-bkv="nikah"]') as HTMLElement;
    tombol().click();
    expect(((globalThis as Bebas).__x = 1)).toBe(1);
    await vi.advanceTimersByTimeAsync(1800);
    let naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.jenis).toBe("ceklist");
    expect(naskah.badan.ceklist.tangan).toEqual({ nikah: true });
    expect(naskah.badan.ceklist.jenis).toBe("cg");
    expect(naskah.badan.ceklist.lawan).toBe(true);
    expect(naskah.badan.ceklist.fakta.judulDokumen).toEqual(["a"]);
    tombol().click();
    await vi.advanceTimersByTimeAsync(1800);
    naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.ceklist.tangan).toEqual({ nikah: false });
    tombol().click();
    await vi.advanceTimersByTimeAsync(1800);
    naskah = panggilan.filter((p) => p.alamat.includes("/naskah")).at(-1)!;
    expect(naskah.badan.ceklist.tangan).toEqual({});
    const put = panggilan.filter((p) => p.metode === "PUT").at(-1)!;
    expect(put.badan.tag).toEqual({});
    (w.querySelector('[data-bk="cetak"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(host.unduh).toHaveBeenCalledTimes(2);
    expect((host.unduh.mock.calls as Bebas[]).map((c) => c[1])[0]).toBe("5/Pdt.G/2026/PA.Cth - Ceklist Berkas Perkara.rtf.rtf");
  });
});
