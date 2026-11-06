// @vitest-environment jsdom
/**
 * Kode bukti naskah rekonvensi di layar ALETA ABT (7 Nov 2026): PK, TK, PR, TR dan pasangan "PK.2/TR.2" dibaca dari duduk perkara, tampil dan dipakai
 * paragraf apa adanya. P dan T biasa tidak berubah. Data rekaan.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BuktiAletaAbt } from "@/components/portal/bukti-aleta-abt";
import { bacaKodeTanda, buktiDariAlinea, kalimatBaris, uraiKalimatBukti, type BarisBukti } from "@/lib/bukti-tertulis";
import { susunParagrafBukti, type BuktiMasuk } from "@/lib/sinkron-pertimbangan-bukti";
import { paragrafUntukNaskah } from "@/lib/sisip-pertimbangan-bukti";

const KTP: BarisBukti = { nm: "Kartu Tanda Penduduk", an: "Fulanah binti Fulan", no: "1234567890123456", tgl: "2020-01-02", oleh: "Dinas Kependudukan", meterai: 0, cocok: 0, manual: null };
const NIKAH: BarisBukti = { nm: "Kutipan Akta Nikah", an: "", no: "123/45/VI/2010", tgl: "2010-06-01", oleh: "Kantor Urusan Agama", meterai: 0, cocok: 0, manual: null };
const sebut = (r: BarisBukti, kode: string) => ({ teks: `1. ${kalimatBaris(r, "P", 0, kode)}` });

describe("kode PK, TK, PR, TR dibaca dari naskah", () => {
  it("kode dibawa apa adanya dan sisi menurut peran", () => {
    const h = buktiDariAlinea([
      sebut(KTP, "PK.1/TR.1"),
      sebut(NIKAH, "PK.2/TR.2"),
      sebut(KTP, "TK.1"),
      sebut(NIKAH, "PR.2"),
      sebut(KTP, "TR.3"),
      sebut(NIKAH, "P.4"),
      sebut(NIKAH, "T.5"),
    ]);
    expect(h.map((x) => [x.kode, x.sisi, x.nomor])).toEqual([
      ["PK.1/TR.1", "P", 1],
      ["PK.2/TR.2", "P", 2],
      ["TK.1", "T", 1],
      ["PR.2", "T", 2],
      ["TR.3", "P", 3],
      ["P.4", "P", 4],
      ["T.5", "T", 5],
    ]);
  });

  it("kode ditulis dengan spasi atau huruf kecil tetap terbaca dan dirapikan", () => {
    expect(bacaKodeTanda("pk. 2 / tr.2")).toEqual({ sisi: "P", nomor: 2 });
    const h = buktiDariAlinea([{ teks: "Kutipan Akta Nikah, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, lalu diberi tanda PK. 2/TR. 2 serta diberi tanggal dan paraf oleh Ketua Majelis;" }]);
    expect(h[0].kode).toBe("PK.2/TR.2");
  });

  it("kalimat dengan kode rekonvensi tetap terurai sebagai isian, bukan kalimat bebas", () => {
    const k = kalimatBaris(KTP, "P", 0, "PK.1/TR.1");
    expect(k).toContain("lalu diberi tanda PK.1/TR.1 serta diberi tanggal");
    const r = uraiKalimatBukti(k);
    expect(r.manual).toBeNull();
    expect(r.nm).toBe("Kartu Tanda Penduduk");
    expect(r.no).toBe("1234567890123456");
  });

  it("P dan T biasa tidak berubah", () => {
    expect(kalimatBaris(KTP, "P", 0)).toContain("diberi tanda P.1 serta");
    expect(kalimatBaris(KTP, "T", 2)).toContain("diberi tanda T.3 serta");
    const h = buktiDariAlinea([sebut(KTP, "P.1"), sebut(NIKAH, "P.2"), sebut(KTP, "T.1")]);
    expect(h.map((x) => x.kode)).toEqual(["P.1", "P.2", "T.1"]);
  });

  it("bukti elektronik dan kode ganda berulang tidak dihitung", () => {
    const h = buktiDariAlinea([
      sebut(KTP, "PK.1/TR.1"),
      sebut(KTP, "PK.1/TR.1"),
      { teks: "Tangkapan layar, bukti elektronik tersebut tidak dapat dicocokkan, lalu oleh Ketua Majelis diberi tanda TK.3 serta diberi tanggal;" },
    ]);
    expect(h).toHaveLength(1);
  });
});

describe("paragraf memakai kode asli", () => {
  const bukti: BuktiMasuk[] = [
    { sisi: "P", nomor: 1, kode: "PK.1/TR.1", baris: { ...KTP } },
    { sisi: "P", nomor: 2, kode: "PK.2/TR.2", baris: { ...NIKAH } },
  ];
  const dasar = { jenisPerkara: "CT" as const, status: "Dikabulkan", verstek: true, lawanHadir: false, lawanMembantah: false, agendaPembuktianKe: 1 };

  it("verstek: paragraf dan kodenya memuat PK.n/TR.n, tanpa P.n paksaan", () => {
    const h = susunParagrafBukti({ ...dasar, bukti });
    expect(h.paragraf.map((p) => p.kode)).toEqual(["PK.1/TR.1", "PK.2/TR.2"]);
    for (const p of h.paragraf) {
      expect(p.bunyi).toMatch(/PK\.[12]\/TR\.[12]/);
      expect(p.bunyi).not.toMatch(/(?<![A-Za-z./])P\.[12]\b/);
    }
  });

  it("kontradiktoir: kelompok kode mengikuti sebutan asli", () => {
    const h = susunParagrafBukti({ ...dasar, verstek: false, lawanHadir: true, bukti });
    const kelompok = h.paragraf.filter((p) => p.kode.includes(" dan "));
    expect(kelompok.length).toBeGreaterThan(0);
    for (const p of kelompok) expect(p.kode).toBe("PK.1/TR.1 dan PK.2/TR.2");
    expect(h.paragraf.some((p) => /bukti PK\.1\/TR\.1 dan PK\.2\/TR\.2/.test(p.bunyi))).toBe(true);
  });

  it("PR dan TR berperan sisi pengaju rekonvensi (T) dan lawannya (P) dalam sebutan pihak", () => {
    const h = susunParagrafBukti({
      ...dasar,
      verstek: false,
      lawanHadir: true,
      bukti: [
        { sisi: "T", nomor: 1, kode: "PR.1", baris: { ...KTP } },
        { sisi: "P", nomor: 1, kode: "TR.1", baris: { ...KTP } },
      ],
    });
    expect(h.paragraf.map((p) => p.kode)).toEqual(expect.arrayContaining(["PR.1", "TR.1"]));
    // Kartu KTP kabul: sisi T menyebut Termohon, sisi P menyebut Pemohon (cerai talak).
    expect(h.paragraf.find((p) => p.kode === "PR.1" && /Kartu Tanda Penduduk/.test(p.bunyi))?.bunyi).toMatch(/Termohon/);
    expect(h.paragraf.find((p) => p.kode === "TR.1" && /Kartu Tanda Penduduk/.test(p.bunyi))?.bunyi).toMatch(/Pemohon/);
  });

  it("tanpa kode asli, perilaku lama: P.n dari sisi dan nomor", () => {
    const h = susunParagrafBukti({ ...dasar, bukti: [{ sisi: "P", nomor: 1, baris: { ...KTP } }] });
    expect(h.paragraf[0].kode).toBe("P.1");
  });

  it("paragraf rekonvensi masuk daftar sisipan dengan kodenya", () => {
    const h = susunParagrafBukti({ ...dasar, bukti });
    expect(paragrafUntukNaskah(h).map((p) => p.kode)).toEqual(["PK.1/TR.1", "PK.2/TR.2"]);
  });
});

describe("layar membaca dan menampilkan kode asli", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });
  const ALINEA = [
    { teks: "PUTUSAN" },
    { teks: "Bukti yang diajukan Pemohon:" },
    sebut(KTP, "PK.1/TR.1"),
    sebut(NIKAH, "PK.2/TR.2"),
    sebut(KTP, "TK.1"),
  ];
  it("daftar bukti menampilkan PK.1/TR.1, PK.2/TR.2, TK.1 dan kalimat salinan memakai kodenya", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { ada: true, P: [], T: [], nikah: null, dokumen: [] } }) })));
    render(<BuktiAletaAbt alinea={ALINEA} perkaraId="11" nomor="1/Pdt.G/2026/PA.Uji" jenisPerkara="Cerai Talak" />);
    expect(await screen.findAllByText("PK.1/TR.1")).not.toHaveLength(0);
    expect(screen.getAllByText("PK.2/TR.2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TK.1").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getAllByText(/lalu diberi tanda PK\.1\/TR\.1 serta diberi tanggal/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/lalu diberi tanda P\.1 serta/)).toBeNull();
  });
});
