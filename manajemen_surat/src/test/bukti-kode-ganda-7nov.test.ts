/**
 * Kode bukti yang tertulis dua kali di naskah (dua kotak bukti di Blangko ABT sama-sama terisi): pembaca tetap memakai kemunculan pertama,
 * tetapi yang kedua dilaporkan supaya tidak hilang diam-diam. Naskah rekaan, tanpa data perkara.
 */
import { describe, expect, it } from "vitest";

import { buktiDariAlinea, butirElektronikDariAlinea, kodeGandaDiNaskah } from "@/lib/bukti-tertulis";

const a = (t: string) => ({ teks: t });
const SURAT_P1 = "Fotokopi Kartu Tanda Penduduk atas nama Budi Rekaan, bukti surat tersebut diberi tanda P.1 serta diberi tanggal 1 Januari 2026;";
const SURAT_P1_LAIN = "Fotokopi Kartu Tanda Penduduk atas nama Sari Rekaan, bukti surat tersebut diberi tanda P.1 serta diberi tanggal 2 Januari 2026;";
const SURAT_P2 = "Fotokopi Kutipan Akta Nikah, bukti surat tersebut diberi tanda P.2 serta diberi tanggal 1 Januari 2026;";
const ELEK_T3 = "Rekaman percakapan WhatsApp, bukti elektronik tersebut diberi tanda T.3 serta telah dicocokkan dengan perangkat asalnya;";
const ELEK_T3_LAIN = "Foto tangkapan layar, bukti elektronik tersebut diberi tanda T.3 serta tidak dapat dicocokkan dengan aslinya;";

describe("kode bukti ganda di naskah", () => {
  it("membaca kemunculan pertama dan melaporkan kode yang kalimatnya berbeda", () => {
    const naskah = [a("Daftar bukti Penggugat:"), a(SURAT_P1), a(SURAT_P2), a("Daftar lain:"), a(SURAT_P1_LAIN)];
    const dibaca = buktiDariAlinea(naskah);
    expect(dibaca.map((x) => x.kode)).toEqual(["P.1", "P.2"]);
    expect(dibaca[0].baris.nm).toContain("Kartu Tanda Penduduk");
    expect(JSON.stringify(dibaca[0].baris)).toContain("Budi");
    expect(kodeGandaDiNaskah(naskah)).toEqual([{ kode: "P.1", jumlah: 2, elektronik: false }]);
  });

  it("salinan yang kalimatnya sama persis, walau spasinya beda, tidak dilaporkan", () => {
    const naskah = [a(SURAT_P1), a(SURAT_P2), a(`  ${SURAT_P1.replace(/ /g, "  ")}`)];
    expect(kodeGandaDiNaskah(naskah)).toEqual([]);
    expect(buktiDariAlinea(naskah).map((x) => x.kode)).toEqual(["P.1", "P.2"]);
  });

  it("bukti elektronik ganda dilaporkan terpisah dari surat dan tetap dibaca sekali", () => {
    const naskah = [a(ELEK_T3), a(SURAT_P1), a(ELEK_T3_LAIN)];
    expect(butirElektronikDariAlinea(naskah).map((x) => x.kode)).toEqual(["T.3"]);
    expect(kodeGandaDiNaskah(naskah)).toEqual([{ kode: "T.3", jumlah: 2, elektronik: true }]);
  });

  it("naskah tanpa kode berulang tidak menghasilkan laporan", () => {
    expect(kodeGandaDiNaskah([a(SURAT_P1), a(SURAT_P2), a(ELEK_T3)])).toEqual([]);
    expect(kodeGandaDiNaskah([])).toEqual([]);
  });
});
