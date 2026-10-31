// @vitest-environment node
/**
 * T11 (31 Okt 2026) - bukti surat dan bukti elektronik TERPISAH (blok variabel ABT 12040-12049).
 * Empat keadaan (surat saja, elektronik saja, keduanya, tanpa bukti) untuk BAS (pengantar + daftar) dan putusan (sub-bab berhuruf berurut),
 * bagian kosong tidak tercetak, variabel lama tidak berubah, dan daftar kode portal identik dengan ekstensi.
 * Fungsi ekstensi dijalankan sungguhan (dipotong dari sumbernya), bukan dibandingkan sebagai teks.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { KODE_BUKTI_PISAH as KODE_PORTAL, VAR_BUKTI, VAR_ECOURT } from "@/lib/isi-sipp-format";

const SUMBER = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/blangko-derry-isian.js"), "utf8");
const AWAL = SUMBER.indexOf("  const buangNomorAwal = ");
const AKHIR = SUMBER.indexOf("  /** Teks ruas -> { surat, el[] }");
if (AWAL < 0 || AKHIR < AWAL) throw new Error("potongan sumber bukti tidak ditemukan");

type Baris = { nm: string; an: string; no: string; tgl: string; oleh: string; meterai: number; cocok: number; manual: string | null };
type Butir = Record<string, unknown>;
type Hasil = {
  pihak: "P" | "T"; adaSurat: boolean; adaEl: boolean; akhir: "" | "surat" | "el";
  judul: { surat: string; el: string; saksi: string }; nilai: Record<string, string>;
};
const mesin = new Function(
  "tglIndo",
  `${SUMBER.slice(AWAL, AKHIR)}
return { susunBuktiPisah, susunTeksBukti, pengantarBuktiPisah, butirElBaru, buktiBaru, KODE_BUKTI_PISAH };`,
)((t: string) => t) as {
  susunBuktiPisah(rows: Baris[], pihak: string, el: { butir: Butir[]; nomori?: boolean } | null, sb: { P: string; T: string }): Hasil;
  susunTeksBukti(rows: Baris[], pihak: string, el: { butir: Butir[]; nomori?: boolean } | null, sb: { P: string; T: string }): string;
  pengantarBuktiPisah(adaSurat: boolean, adaEl: boolean, nama: string): { surat: string; el: string };
  butirElBaru(pihak: string): Butir;
  buktiBaru(nm: string, oleh?: string): Baris;
  KODE_BUKTI_PISAH: Record<string, Record<string, string>>;
};

const SB = { P: "Penggugat", T: "Tergugat" };
const surat = (nm: string, no = "") => ({ ...mesin.buktiBaru(nm, "Kantor Rekaan"), no });
const SURAT2 = [surat("Fotokopi Kartu Tanda Penduduk atas nama Budi Rekaan", "7201000000000001"), surat("Fotokopi Kutipan Akta Nikah", "123/45/VI/2020")];
const butirEl = (objek: string) => ({ ...mesin.butirElBaru("P"), bentuk: "Tangkapan layar (screenshot)", objek, periksa: 1 });
const EL1 = { butir: [butirEl("percakapan WhatsApp antara Penggugat dan Tergugat")], nomori: true };
const KODE_P = mesin.KODE_BUKTI_PISAH.P;
const KODE_T = mesin.KODE_BUKTI_PISAH.T;

const PENGANTAR_SURAT = "Atas pertanyaan Ketua Majelis, Penggugat menyatakan bahwa pada hari ini ia telah siap mengajukan alat bukti surat dan saksi-saksi. Selanjutnya Penggugat menyerahkan bukti surat berupa:";
const PENGANTAR_SURAT_EL_SAJA = "Atas pertanyaan Ketua Majelis, Penggugat menyatakan bahwa pada hari ini ia telah siap mengajukan alat bukti elektronik dan saksi-saksi.";
const PENGANTAR_TANPA = "Atas pertanyaan Ketua Majelis, Penggugat menyatakan bahwa pada hari ini ia telah siap mengajukan saksi-saksi.";
const PENGANTAR_EL = "Selanjutnya Penggugat menyerahkan bukti elektronik berupa:";

describe("T11 bukti surat dan elektronik terpisah - empat keadaan", () => {
  it("surat saja: daftar surat terisi, elektronik kosong, saksi berhuruf b", () => {
    const h = mesin.susunBuktiPisah(SURAT2, "P", { butir: [] }, SB);
    expect(h.adaSurat).toBe(true);
    expect(h.adaEl).toBe(false);
    expect(h.akhir).toBe("surat");
    const daftar = h.nilai[KODE_P.surat].split("\n");
    expect(daftar).toHaveLength(2);
    expect(daftar[0]).toContain("tanda P.1");
    expect(daftar[1]).toContain("tanda P.2");
    expect(h.nilai[KODE_P.el]).toBe("");
    expect(h.nilai[KODE_P.pengantarSurat]).toBe(PENGANTAR_SURAT);
    expect(h.nilai[KODE_P.pengantarEl]).toBe("");
    expect(h.nilai[KODE_P.putusan]).toBe(`a. Bukti Surat/Tertulis\n${h.nilai[KODE_P.surat]}\nb. Saksi`);
    expect(h.judul).toEqual({ surat: "a. Bukti Surat/Tertulis", el: "", saksi: "b. Saksi" });
  });

  it("elektronik saja: pengantar 'alat bukti elektronik dan saksi-saksi', tanpa kalimat bukti surat, tanda mulai P.1", () => {
    const h = mesin.susunBuktiPisah([], "P", EL1, SB);
    expect(h.adaSurat).toBe(false);
    expect(h.adaEl).toBe(true);
    expect(h.akhir).toBe("el");
    expect(h.nilai[KODE_P.surat]).toBe("");
    expect(h.nilai[KODE_P.el]).toContain("tanda P.1");
    expect(h.nilai[KODE_P.el]).toMatch(/^1\. Tangkapan layar/);
    expect(h.nilai[KODE_P.pengantarSurat]).toBe(PENGANTAR_SURAT_EL_SAJA);
    expect(h.nilai[KODE_P.pengantarSurat]).not.toContain("bukti surat berupa");
    expect(h.nilai[KODE_P.pengantarEl]).toBe(PENGANTAR_EL);
    expect(h.nilai[KODE_P.putusan]).toBe(`a. Bukti Elektronik\n${h.nilai[KODE_P.el]}\nb. Saksi`);
    expect(h.judul).toEqual({ surat: "", el: "a. Bukti Elektronik", saksi: "b. Saksi" });
  });

  it("keduanya: huruf a, b, c berurut; tanda elektronik melanjutkan bukti surat; Z sesudah daftar elektronik", () => {
    const h = mesin.susunBuktiPisah(SURAT2, "P", EL1, SB);
    expect(h.akhir).toBe("el");
    expect(h.nilai[KODE_P.el]).toContain("tanda P.3");
    expect(h.nilai[KODE_P.pengantarSurat]).toBe(PENGANTAR_SURAT);
    expect(h.nilai[KODE_P.pengantarEl]).toBe(PENGANTAR_EL);
    expect(h.nilai[KODE_P.putusan]).toBe(
      `a. Bukti Surat/Tertulis\n${h.nilai[KODE_P.surat]}\nb. Bukti Elektronik\n${h.nilai[KODE_P.el]}\nc. Saksi`,
    );
    expect(h.judul).toEqual({ surat: "a. Bukti Surat/Tertulis", el: "b. Bukti Elektronik", saksi: "c. Saksi" });
  });

  it("tanpa bukti: semua daftar dan pengantar 'menyerahkan' kosong; hanya pernyataan siap saksi dan sub-bab saksi 'a.'", () => {
    for (const el of [null, { butir: [] }, { butir: [{ ...mesin.butirElBaru("P") }] }]) {
      const h = mesin.susunBuktiPisah([], "P", el, SB);
      expect(h.adaSurat).toBe(false);
      expect(h.adaEl).toBe(false);
      expect(h.akhir).toBe("");
      expect(h.nilai[KODE_P.surat]).toBe("");
      expect(h.nilai[KODE_P.el]).toBe("");
      expect(h.nilai[KODE_P.pengantarSurat]).toBe(PENGANTAR_TANPA);
      expect(h.nilai[KODE_P.pengantarEl]).toBe("");
      expect(h.nilai[KODE_P.putusan]).toBe("a. Saksi");
    }
  });

  it("pihak Tergugat memakai blok 12045-12049 dan menyebut Tergugat; tanda T.n", () => {
    const h = mesin.susunBuktiPisah([surat("Fotokopi Kartu Keluarga", "7201000000000002")], "T", { butir: [{ ...butirEl("rekaman"), pengaju: "T", awalan: "T" }] }, SB);
    expect(Object.keys(h.nilai).sort()).toEqual(["12045", "12046", "12047", "12048", "12049"]);
    expect(h.nilai[KODE_T.pengantarSurat]).toContain("Tergugat menyatakan");
    expect(h.nilai[KODE_T.pengantarEl]).toBe("Selanjutnya Tergugat menyerahkan bukti elektronik berupa:");
    expect(h.nilai[KODE_T.surat]).toContain("tanda T.1");
    expect(h.nilai[KODE_T.el]).toContain("tanda T.2");
  });

  it("sebutan pihak mengikuti perkara (Pemohon/Termohon), bawaan Penggugat/Tergugat", () => {
    const h = mesin.susunBuktiPisah(SURAT2, "P", null, { P: "Pemohon", T: "Termohon" });
    expect(h.nilai[KODE_P.pengantarSurat]).toBe(PENGANTAR_SURAT.replaceAll("Penggugat", "Pemohon"));
    expect(mesin.pengantarBuktiPisah(true, false, "").surat).toContain("Penggugat menyatakan");
  });
});

describe("T11 bukti terpisah - bagian kosong tidak tercetak dan fitur lama tidak berubah", () => {
  const KEADAAN: [string, Baris[], { butir: Butir[] } | null][] = [
    ["surat saja", SURAT2, null],
    ["elektronik saja", [], EL1],
    ["keduanya", SURAT2, EL1],
    ["tanpa bukti", [], null],
  ];

  it.each(KEADAAN)("%s: tidak ada baris kosong, spasi tepi, atau kata 'Aleta' di nilai mana pun", (_n, rows, el) => {
    for (const w of ["P", "T"]) {
      const h = mesin.susunBuktiPisah(rows, w, el, SB);
      for (const v of Object.values(h.nilai)) {
        expect(v).toBe(v.trim());
        expect(v.split("\n").every((b) => b.trim() !== "" || v === "")).toBe(true);
        expect(v).not.toMatch(/aleta/i);
      }
    }
  });

  it("baris bukti surat yang masih kosong tidak dihitung (nomor tanda tidak bergeser)", () => {
    const h = mesin.susunBuktiPisah([surat("Fotokopi Kartu Keluarga"), { ...mesin.buktiBaru(""), nm: "" }, surat("Fotokopi Buku Nikah")], "P", EL1, SB);
    const daftar = h.nilai[KODE_P.surat].split("\n");
    expect(daftar).toHaveLength(2);
    expect(daftar[1]).toContain("tanda P.2");
    expect(h.nilai[KODE_P.el]).toContain("tanda P.3");
  });

  it("variabel lama: susunTeksBukti = daftar surat + daftar elektronik (butir sama, urutan sama) pada keempat keadaan", () => {
    for (const [, rows, el] of KEADAAN) {
      const h = mesin.susunBuktiPisah(rows, "P", el, SB);
      const lama = mesin.susunTeksBukti(rows, "P", el, SB);
      expect(lama).toBe([h.nilai[KODE_P.surat], h.nilai[KODE_P.el]].filter(Boolean).join("\n"));
    }
  });
});

describe("T11 bukti terpisah - identitas kode portal = ekstensi", () => {
  const SEMUA = ["12040", "12041", "12042", "12043", "12044", "12045", "12046", "12047", "12048", "12049"];

  it("KODE_BUKTI_PISAH portal sama persis dengan ekstensi, blok 12040-12049 tanpa celah atau ganda", () => {
    expect(KODE_PORTAL).toEqual(mesin.KODE_BUKTI_PISAH);
    const nilai = [...Object.values(KODE_PORTAL.P), ...Object.values(KODE_PORTAL.T)];
    expect([...nilai].sort()).toEqual(SEMUA);
    expect(new Set(nilai).size).toBe(10);
  });

  it("kesepuluh kode ada di VAR_BUKTI dan VAR_ECOURT portal dan tidak bertabrakan dengan blok jawab-replik 12020-12028", () => {
    for (const k of SEMUA) {
      expect(VAR_BUKTI).toContain(k);
      expect(VAR_ECOURT).toContain(k);
    }
    expect(new Set(VAR_BUKTI).size).toBe(VAR_BUKTI.length);
    expect(new Set(VAR_ECOURT).size).toBe(VAR_ECOURT.length);
    for (let n = 12020; n <= 12028; n += 1) expect(SEMUA).not.toContain(String(n));
  });

  it("daftar kode mesin bersama ekstensi memuat kesepuluh kode di VAR_BUKTI dan VAR_ECOURT", () => {
    const mesinBersama = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/isi-sipp-bersama.js"), "utf8");
    const g = globalThis as Record<string, unknown>;
    delete g.AletaIsiSipp;
    new Function(mesinBersama)();
    const m = g.AletaIsiSipp as { VAR_BUKTI: string[]; VAR_ECOURT: string[] };
    for (const k of SEMUA) {
      expect(m.VAR_BUKTI).toContain(k);
      expect(m.VAR_ECOURT).toContain(k);
    }
    expect([...VAR_BUKTI]).toEqual([...m.VAR_BUKTI]);
    expect([...VAR_ECOURT]).toEqual([...m.VAR_ECOURT]);
  });
});
