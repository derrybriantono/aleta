// @vitest-environment jsdom
/**
 * Paragraf pertimbangan bukti elektronik (7 Nov 2026): bunyi hanya dari blangko Kabul kontradiktoir (cerai gugat dan cerai talak, bukti elektronik
 * Tergugat/Termohon yang tidak dicocokkan dan tanpa digital forensic, lawan hadir dan tidak membantah). Layar membaca butir "bukti elektronik tersebut"
 * dari naskah dan katalog elektronik, kode mengikuti aslinya. Di luar keadaan itu: belumAdaBunyi, tidak dikarang. Data rekaan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BuktiAletaAbt } from "@/components/portal/bukti-aleta-abt";
import { buktiDariAlinea, butirElektronikDariAlinea, jenisElektronikDari, kalimatBaris, type BarisBukti } from "@/lib/bukti-tertulis";
import { KARTU_PERTIMBANGAN, susunParagrafBukti, type BuktiMasuk, type MasukanPertimbangan } from "@/lib/sinkron-pertimbangan-bukti";
import type { ParagrafBukti } from "@/lib/sinkron-pertimbangan-bukti";

const KTP: BarisBukti = { nm: "Kartu Tanda Penduduk", an: "Fulan Contoh bin Fulan", no: "0000000000000000", tgl: "2020-01-02", oleh: "Dinas Kependudukan", meterai: 0, cocok: 0, manual: null };
const NIKAH: BarisBukti = { nm: "Kutipan Akta Nikah", an: "", no: "123/45/VI/2010", tgl: "2010-06-01", oleh: "Kantor Urusan Agama", meterai: 0, cocok: 0, manual: null };
const DEPAN = "Tangkapan layar (screenshot) percakapan WhatsApp dengan keterangan antara kedua pihak";
const EL0 = (kode: string) => `3. ${DEPAN}, bukti elektronik tersebut tidak dapat dicocokkan dengan aslinya dengan telekomunikasi atau alat yang digunakan untuk melakukan pengambilan tangkapan layar tersebut karena Tergugat tidak dapat menghadirkannya, dan bukti tersebut tidak disertai dengan digital forensic, lalu oleh Ketua Majelis diberi tanda ${kode};`;
const EL1 = (kode: string) => `3. ${DEPAN}, bukti elektronik tersebut telah dicocokkan dengan aslinya dengan telekomunikasi atau alat yang digunakan untuk melakukan pengambilan tangkapan layar tersebut dan ternyata sesuai, lalu oleh Ketua Majelis diberi tanda ${kode};`;
const EL2 = (kode: string) => `3. ${DEPAN}, bukti elektronik tersebut disertai dengan hasil digital forensic, lalu oleh Ketua Majelis diberi tanda ${kode};`;

describe("membaca butir elektronik dari naskah", () => {
  it("kode asli, nama dari katalog elektronik, dan keadaan pemeriksaan", () => {
    const h = butirElektronikDariAlinea([{ teks: EL0("T.3") }, { teks: EL1("TK.4") }, { teks: EL2("PR.2") }, { teks: "Tidak ada hubungannya dengan bukti" }]);
    expect(h.map((x) => [x.kode, x.sisi, x.nomor, x.periksa])).toEqual([
      ["T.3", "T", 3, 0],
      ["TK.4", "T", 4, 1],
      ["PR.2", "T", 2, 2],
    ]);
    expect(h[0].nama).toBe("Percakapan WhatsApp");
    expect(h[0].jenis).toBe("el-wa");
  });

  it("bukti elektronik bukan bukti surat, dan kode berulang dihitung sekali", () => {
    const alinea = [{ teks: `1. ${kalimatBaris(KTP, "T", 0)}` }, { teks: EL0("T.3") }, { teks: EL0("T.3") }];
    expect(buktiDariAlinea(alinea).map((x) => x.kode)).toEqual(["T.1"]);
    expect(butirElektronikDariAlinea(alinea)).toHaveLength(1);
  });

  it("kalimat tanpa pola baku: keadaan tidak terbaca (null), nama dari kalimatnya", () => {
    const h = butirElektronikDariAlinea([{ teks: "Rekaman entah apa, bukti elektronik tersebut dipertimbangkan, lalu diberi tanda T.5;" }]);
    expect(h[0].periksa).toBeNull();
    expect(h[0].nama).toBe("Rekaman entah apa");
    expect(h[0].jenis).toBe("");
  });

  it("jenis elektronik dikenali dari objek katalog yang terpanjang", () => {
    expect(jenisElektronikDari("Tangkapan layar (screenshot) percakapan grup WhatsApp dengan keterangan x")?.kunci).toBe("el-wagrup");
    expect(jenisElektronikDari("barang lain")).toBeNull();
  });
});

const el = (kode: string, periksaEl: 0 | 1 | 2 | null = 0, sisi: "P" | "T" = "T", nomor = 3): BuktiMasuk => ({ sisi, nomor, kode, elektronik: true, periksaEl, baris: { nm: "Percakapan WhatsApp", manual: null } as BarisBukti });
const dasar = (o: Partial<MasukanPertimbangan> = {}): MasukanPertimbangan => ({
  jenisPerkara: "CG",
  status: "Dikabulkan",
  verstek: false,
  lawanHadir: true,
  lawanMembantah: false,
  agendaPembuktianKe: 1,
  bukti: [
    { sisi: "T", nomor: 1, baris: { ...KTP } },
    { sisi: "T", nomor: 2, baris: { ...NIKAH } },
    el("T.3"),
  ],
  ...o,
});
const KODE_EL = ["el-kabul-pengantar", "el-kabul-kedudukan", "el-kabul-formil", "el-kabul-materiil", "el-kabul-isi", "el-kabul-pengakuan"];
/** Paragraf yang kodenya memuat nomor bukti elektronik pada contoh (T.3, T.4, TK.4). */
const dariEl = (h: ReturnType<typeof susunParagrafBukti>) => h.paragraf.filter((p) => /(?:T|TK)\.[34]/.test(p.kode));

describe("kartu bukti elektronik dari blangko", () => {
  it("ada enam kartu, hanya pelengkap, hanya sisi T, hanya Kabul cerai", () => {
    const k = KARTU_PERTIMBANGAN.filter((x) => x.id.startsWith("el-kabul-"));
    expect(k.map((x) => x.id)).toEqual(KODE_EL);
    for (const x of k) {
      expect(x.kategori).toBe("pelengkap");
      expect(x.sisi).toBe("T");
      expect(x.keadaan).toEqual(["kabul"]);
      expect(x.perkara).toEqual(["CG", "CT"]);
      expect(x.asal.map((a) => a.berkas)).toEqual(["[02] [Kabul] CG - F.rtf", "[02] [Kabul] CT - F.rtf"]);
    }
  });

  it("cerai gugat: enam alinea berurutan, semuanya usulan, memuat kode asli dan pihaknya", () => {
    const h = susunParagrafBukti(dasar());
    const el6 = dariEl(h);
    expect(el6).toHaveLength(6);
    expect(el6.every((p) => p.cara === "usulan")).toBe(true);
    expect(el6[0].bunyi).toMatch(/^Menimbang, bahwa bukti T\.3 yang diajukan oleh Tergugat merupakan alat bukti elektronik/);
    expect(el6[1].bunyi).toContain("(vide Pasal 284 RBg/Pasal 164 HIR dan Pasal 1866 Kitab Undang-Undang Hukum Perdata)");
    expect(el6[2].bunyi).toContain("bukti T.3 telah memenuhi syarat formil");
    expect(el6[3].bunyi).toContain("Tergugat tidak dapat menunjukkan hasil digital forensic");
    expect(el6[4].bunyi).toContain("antara Tergugat dengan Penggugat");
    expect(el6[5].bunyi).toContain("pihak Penggugat tidak membantah");
    expect(el6[5].asal).toContain("[02] [Kabul] CG - F.rtf");
    expect(el6[4].asal).toContain("Periksa: isi bukti");
    // Urutan: sesudah paragraf bukti surat T.1 dan T.2 pada sisi yang sama.
    const urut = h.paragraf.map((p) => p.kode);
    expect(urut.lastIndexOf("T.1")).toBeLessThan(urut.indexOf("T.3"));
    for (const p of h.paragraf) {
      expect(p.bunyi).not.toMatch(/[{}]|#\d+#/);
      expect(p.bunyi).not.toMatch(/aleta/i);
    }
  });

  it("bukti elektronik tidak dikenai bunyi meterai, fotokopi, atau akta milik bukti surat", () => {
    const h = susunParagrafBukti(dasar());
    for (const p of h.paragraf.filter((x) => x.kode === "T.3")) expect(p.bunyi).not.toMatch(/meterai|fotokopi|akta autentik/i);
  });

  it("cerai talak: Pemohon dan Termohon, hukum acara RBg menulis Pasal 284 RBg", () => {
    const h = susunParagrafBukti(dasar({ jenisPerkara: "CT", konteks: { hukumAcara: "RBg" } }));
    const el6 = dariEl(h);
    expect(el6).toHaveLength(6);
    expect(el6[0].bunyi).toContain("diajukan oleh Termohon");
    expect(el6[1].bunyi).toContain("(vide Pasal 284 RBg dan Pasal 1866");
    expect(el6[5].bunyi).toContain("pihak Pemohon tidak membantah");
  });

  it("dua bukti elektronik: satu kelompok dengan kode gabungan", () => {
    const h = susunParagrafBukti(dasar({ bukti: [{ sisi: "T", nomor: 1, baris: { ...KTP } }, el("T.3", 0, "T", 3), el("T.4", 0, "T", 4)] }));
    const el6 = dariEl(h);
    expect(el6).toHaveLength(6);
    expect(el6[0].kode).toBe("T.3 dan T.4");
    expect(el6[0].bunyi).toContain("bukti T.3 dan T.4 yang diajukan oleh Tergugat");
  });

  it("kode naskah rekonvensi dipakai apa adanya", () => {
    const h = susunParagrafBukti(dasar({ bukti: [el("TK.4", 0, "T", 4)] }));
    expect(h.paragraf[0].kode).toBe("TK.4");
    expect(h.paragraf[0].bunyi).toContain("bukti TK.4 yang diajukan oleh Tergugat");
  });

  const alasanDari = (m: MasukanPertimbangan) => susunParagrafBukti(m).belumAdaBunyi.filter((b) => b.kode === "T.3" || b.kode === "P.3");
  it.each([
    ["sisi Penggugat", dasar({ bukti: [el("P.3", 0, "P")] }), /diajukan Tergugat atau Termohon/],
    ["verstek", dasar({ verstek: true, lawanHadir: false }), /pada putusan dikabulkan dengan lawan hadir/],
    ["lawan membantah", dasar({ lawanMembantah: true }), /tidak dibantah lawan/],
    ["dicocokkan dengan aslinya", dasar({ bukti: [el("T.3", 1)] }), /tidak dapat dicocokkan dengan aslinya dan tidak disertai digital forensic/],
    ["disertai digital forensic", dasar({ bukti: [el("T.3", 2)] }), /tidak dapat dicocokkan dengan aslinya dan tidak disertai digital forensic/],
    ["keadaan tidak terbaca", dasar({ bukti: [el("T.3", null)] }), /tidak dapat dicocokkan dengan aslinya dan tidak disertai digital forensic/],
    ["ditolak", dasar({ status: "Ditolak" }), /pada putusan dikabulkan dengan lawan hadir/],
    ["itsbat nikah", dasar({ jenisPerkara: "IN" }), /itsbat nikah dan dispensasi kawin tidak memuat bunyi bukti elektronik/],
    ["dispensasi kawin", dasar({ jenisPerkara: "DK" }), /itsbat nikah dan dispensasi kawin tidak memuat bunyi bukti elektronik/],
  ] as Array<[string, MasukanPertimbangan, RegExp]>)("%s: tanpa paragraf, dicatat belumAdaBunyi", (_n, m, alasan) => {
    const h = susunParagrafBukti(m);
    const kodeEl = m.bukti.filter((b) => b.elektronik).map((b) => b.kode);
    expect(h.paragraf.filter((p) => kodeEl.some((k) => p.kode.includes(k ?? "?")))).toHaveLength(0);
    const b = alasanDari(m);
    expect(b.length).toBeGreaterThan(0);
    expect(b[0].alasan).toMatch(alasan);
    expect(b[0].kunci).toBe("elektronik");
  });

  it("dicabut pada agenda kedua: bukti elektronik agenda sebelumnya hanya usulan", () => {
    const m = dasar({ status: "Dicabut", agendaPembuktianKe: 2 });
    const h = susunParagrafBukti(m);
    for (const p of h.paragraf) expect(p.cara).toBe("usulan");
  });

  it("bunyi kartu tidak memuat kata Aleta, penanda mentah, atau data perkara", () => {
    for (const k of KARTU_PERTIMBANGAN.filter((x) => x.id.startsWith("el-kabul-"))) {
      expect(k.bunyi).not.toMatch(/aleta/i);
      expect(k.bunyi).not.toMatch(/#\d+#/);
      expect(k.bunyi).not.toMatch(/\b\d{16}\b/);
    }
  });

  it("bunyi sama persis dengan alinea blangko sumbernya setelah penanda ditukar", () => {
    type Bahan = { blangko: Array<{ folder: string; berkas: string; alineaBukti: string[] }> };
    const bahan = JSON.parse(readFileSync(path.resolve(__dirname, "../../../docs/arahan/awan-f46-bahan-cerai.json"), "utf8")) as Bahan;
    for (const k of KARTU_PERTIMBANGAN.filter((x) => x.id.startsWith("el-kabul-"))) {
      for (const a of k.asal) {
        const alinea = bahan.blangko.find((b) => b.folder === a.folder && b.berkas === a.berkas)!.alineaBukti[a.alinea];
        const balik = k.bunyi
          .replace(/\{pihak\}/g, "#0047#")
          .replace(/\{lawan\}/g, "#0046#")
          .replace(/\{majelis\}/g, "#8554#")
          .replace("{pasalAlatBukti}", "Pasal #11885# #11851#")
          .replace(/\{kode\}/g, "T.3");
        expect(balik, `${k.id} <- ${a.berkas}`).toBe(alinea);
      }
    }
  });
});

describe("layar", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });
  const naskah = (el: string) => [
    { teks: "PUTUSAN" },
    { teks: `1. ${kalimatBaris(KTP, "T", 0)}` },
    { teks: `2. ${kalimatBaris(NIKAH, "T", 1)}` },
    { teks: el },
    { teks: "Mengabulkan gugatan Penggugat;" },
  ];
  const pasang = () => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { ada: true, P: [], T: [], nikah: null, dokumen: [] } }) })));

  it("butir elektronik tampil di daftar dengan kode aslinya dan keadaan pemeriksaannya", async () => {
    pasang();
    render(<BuktiAletaAbt alinea={naskah(EL0("T.3"))} perkaraId="11" nomor="1/Pdt.G/2026/PA.Uji" jenisPerkara="Cerai Gugat" />);
    expect(await screen.findByText("Bukti elektronik, dibaca dari naskah")).toBeTruthy();
    expect(screen.getByText("Percakapan WhatsApp")).toBeTruthy();
    expect(screen.getByText("Tidak dapat dicocokkan dengan aslinya, tanpa digital forensic")).toBeTruthy();
  });

  it("usulan paragraf elektronik muncul, bisa dicentang, dan ikut ke naskah dengan kode T.3", async () => {
    pasang();
    const onParagraf = vi.fn();
    render(<BuktiAletaAbt alinea={naskah(EL0("T.3"))} perkaraId="11" nomor="1/Pdt.G/2026/PA.Uji" jenisPerkara="Cerai Gugat" onParagraf={onParagraf} />);
    await screen.findByText("Usulan, centang yang dipakai");
    const kotak = screen.getAllByRole("checkbox").filter((c) => /alat bukti elektronik yang harus memenuhi syarat/.test(c.closest("label")?.textContent ?? ""));
    expect(kotak).toHaveLength(1);
    fireEvent.click(kotak[0]);
    await waitFor(() => {
      const terakhir = onParagraf.mock.calls.at(-1)?.[0] as ParagrafBukti[];
      expect(terakhir.some((p) => p.kode === "T.3" && /alat bukti elektronik yang harus memenuhi syarat/.test(p.bunyi))).toBe(true);
    });
  });

  it("keadaan lain: tidak ada usulan elektronik, alasannya tampil di daftar belum ada bunyinya", async () => {
    pasang();
    render(<BuktiAletaAbt alinea={naskah(EL2("T.3"))} perkaraId="11" nomor="1/Pdt.G/2026/PA.Uji" jenisPerkara="Cerai Gugat" />);
    await screen.findByText(/Belum ada bunyinya di blangko/);
    expect(screen.getAllByText(/Blangko hanya memuat bunyi bukti elektronik yang tidak dapat dicocokkan dengan aslinya dan tidak disertai digital forensic/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/alat bukti elektronik yang harus memenuhi syarat/)).toBeNull();
  });
});
