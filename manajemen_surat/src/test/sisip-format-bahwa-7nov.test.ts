/**
 * Format alinea sisipan (7 Nov 2026): "- Bahwa" berbentuk tanda hubung + tab dengan alinea menggantung seperti "- Bahwa bukti" di blangko, dan
 * "Menimbang" mengikuti alinea Menimbang, walau jangkarnya lain jenis. Alinea sesudah sisipan tetap berformat asli. Naskah rekaan, tanpa data perkara.
 */
import { describe, expect, it } from "vitest";

import { bacaRtfParagraf } from "@/lib/deteksi-sisa-blangko";
import { perintahParagraf, sisipkanParagrafBukti } from "@/lib/sisip-pertimbangan-bukti";

const MENIMBANG = String.raw`\pard \plain \s50 \qj \fi720 \li0 \ri0 \sl360 \slmult1 \widctlpar \lin0 \rin0 \itap0 \fs28 \rtlch \ltrch \dbch \af6 \hich \af6 \loch \af6 `;
const BAHWA = String.raw`\pard \plain \s50 \qj \fi-384 \li384 \ri0 \sl360 \slmult1 \widctlpar \lin384 \rin0 \itap0 \fs28 \rtlch \ltrch \dbch \af6 \hich \af6 \loch \af6 `;
const GRUP = String.raw`{\fs24 \rtlch \ltrch \dbch \af6 \hich \af4 \loch \f4 `;
const kepala = String.raw`{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0 Times New Roman;}{\f4 Arial;}}{\colortbl;\red255\green0\blue0;}` + "\n";

/** Alinea gaya Word: perintah paragraf, teks dalam grup, penutup \par di dalam grup sendiri (seperti blangko). Tanda hubung dan tab dalam run sendiri. */
function alinea(t: string, ppr: string): string {
  const m = /^-\s+(\S[\s\S]*)$/.exec(t);
  const isi = m ? `${GRUP}-}${GRUP}\\tab }${GRUP}${m[1]}}` : `${GRUP}${t}}`;
  return `${ppr}${isi}${GRUP}\\par }`;
}
type Isi = [string, string];
const rtfDari = (daftar: Isi[]) => `${kepala}${daftar.map(([t, p]) => alinea(t, p)).join("\n")}\n}`;
const M = (t: string): Isi => [t, MENIMBANG];
const B = (t: string): Isi => [t, BAHWA];

const DUDUK: Isi[] = [
  M("PUTUSAN"),
  M("TENTANG DUDUK PERKARA"),
  M("Fotokopi Kartu Tanda Penduduk, bukti surat tersebut diberi tanda P.1 serta diberi tanggal 1 Januari 2026;"),
  M("TENTANG PERTIMBANGAN HUKUM"),
];
const FAKTA: Isi[] = [
  M("Menimbang, bahwa berdasarkan analisis bukti-bukti di atas ditemukan fakta hukum sebagai berikut:"),
  M("MENGADILI"),
  M("Mengabulkan gugatan;"),
];
const NILAI_M = "Menimbang, bahwa alat bukti P.1 merupakan keterangan identitas yang sesuai dengan fakta di persidangan;";
const NILAI_B = "- Bahwa bukti P.1 berupa fotokopi Kartu Tanda Penduduk merupakan identitas resmi penduduk;";
const KARTU_B = { kode: "P.2", bunyi: "- Bahwa bukti P.2 berupa fotokopi Kutipan Akta Nikah merupakan bukti utama perkawinan;" };
const KARTU_M = { kode: "P.3", bunyi: "Menimbang, bahwa alat bukti P.3 menerangkan susunan keluarga;" };

const teksDari = (rtf: string) => bacaRtfParagraf(rtf, false).map((p) => p.teks);
/** Perintah paragraf tiap alinea hasil bacaan. */
function perintahSemua(rtf: string): Array<string | null> {
  return bacaRtfParagraf(rtf, true).map((p) => perintahParagraf(rtf, p));
}
const HUBUNG = String.raw`\fi-384\li384`;
const JOROK = String.raw`\fi720\li0`;

describe("perintahParagraf", () => {
  it("hanya perintah paragraf, tanpa huruf dan tanpa \\plain", () => {
    const rtf = rtfDari([...DUDUK, M(NILAI_M), ...FAKTA]);
    const p = perintahSemua(rtf)[4];
    expect(p).toBe(String.raw`\pard\s50\qj\fi720\li0\ri0\sl360\slmult1\widctlpar\lin0\rin0\itap0`);
    expect(p).not.toMatch(/plain|fs28|af6/);
  });
});

describe("sisipan '- Bahwa' berformat blangko walau jangkar Menimbang", () => {
  it("memakai perintah paragraf '- Bahwa' milik naskah, tanda hubung + tab, dan alinea sesudahnya tidak berubah", () => {
    const rtf = rtfDari([...DUDUK, M(NILAI_M), B(NILAI_B), M("Menimbang, bahwa alat bukti P.9 lain;"), ...FAKTA]);
    // Jangkar = alinea penilaian terakhir sebelum fakta (P.9, Menimbang).
    const h = sisipkanParagrafBukti(rtf, [KARTU_B]);
    expect(h.disisipkan).toEqual(["P.2"]);
    const baru = perintahSemua(h.rtf);
    const i = teksDari(h.rtf).indexOf(KARTU_B.bunyi);
    expect(i).toBeGreaterThan(0);
    expect(baru[i]).toContain(HUBUNG);
    expect(baru[i]).toContain(String.raw`\lin384`);
    // Perintah tepat sesudah \par, lalu tanda hubung, tab, teks.
    expect(h.rtf).toContain(String.raw`\par ` + baru[i] + String.raw` -\tab Bahwa bukti P.2`);
    // Alinea sebelum (jangkar) dan sesudah (fakta) memakai format asli.
    expect(baru[i - 1]).toContain(JOROK);
    expect(baru[i + 1]).toContain(JOROK);
    // Hanya satu alinea bertambah dan alinea lain tidak berubah teksnya.
    const asli = teksDari(rtf);
    const hasil = teksDari(h.rtf);
    expect(hasil.length).toBe(asli.length + 1);
    expect(hasil.filter((t) => t !== KARTU_B.bunyi)).toEqual(asli);
  });

  it("tanpa alinea '- Bahwa' di naskah: diturunkan dari jangkar (hanya indentasi diganti)", () => {
    const rtf = rtfDari([...DUDUK, M(NILAI_M), ...FAKTA]);
    const h = sisipkanParagrafBukti(rtf, [KARTU_B]);
    expect(h.disisipkan).toEqual(["P.2"]);
    const baru = perintahSemua(h.rtf);
    const i = teksDari(h.rtf).indexOf(KARTU_B.bunyi);
    expect(baru[i]).toBe(String.raw`\pard\s50\qj\fi-384\li384\ri0\sl360\slmult1\widctlpar\lin384\rin0\itap0`);
    expect(baru[i + 1]).toContain(JOROK);
  });

  it("jangkar '- Bahwa' dan kartu '- Bahwa': mewarisi tanpa perintah baru, tetap tanda hubung + tab", () => {
    const rtf = rtfDari([...DUDUK, B(NILAI_B), ...FAKTA]);
    const h = sisipkanParagrafBukti(rtf, [KARTU_B]);
    expect(h.disisipkan).toEqual(["P.2"]);
    expect(h.rtf).toContain(String.raw`\par -\tab Bahwa bukti P.2`);
    const baru = perintahSemua(h.rtf);
    const i = teksDari(h.rtf).indexOf(KARTU_B.bunyi);
    expect(baru[i]).toContain(HUBUNG);
    expect(teksDari(h.rtf)[i]).toBe(KARTU_B.bunyi);
  });
});

describe("sisipan 'Menimbang' mengikuti alinea Menimbang", () => {
  it("jangkar Menimbang: mewarisi, tanpa perintah baru", () => {
    const rtf = rtfDari([...DUDUK, M(NILAI_M), ...FAKTA]);
    const h = sisipkanParagrafBukti(rtf, [KARTU_M]);
    expect(h.disisipkan).toEqual(["P.3"]);
    expect(h.rtf).toContain(`\\par ${KARTU_M.bunyi}`);
  });

  it("jangkar '- Bahwa': memakai perintah paragraf alinea Menimbang naskah itu", () => {
    const rtf = rtfDari([...DUDUK, M("Menimbang, bahwa untuk membuktikan dalilnya, telah diajukan alat bukti surat;"), B(NILAI_B), ...FAKTA]);
    const h = sisipkanParagrafBukti(rtf, [KARTU_M]);
    expect(h.disisipkan).toEqual(["P.3"]);
    const baru = perintahSemua(h.rtf);
    const i = teksDari(h.rtf).indexOf(KARTU_M.bunyi);
    expect(baru[i]).toContain(JOROK);
    expect(baru[i]).not.toContain(HUBUNG);
    expect(baru[i + 1]).toContain(JOROK); // alinea fakta
  });
});

describe("campuran dan pemulihan", () => {
  it("dua jenis berurutan: tiap alinea berformat jenisnya dan alinea sesudahnya tetap asli", () => {
    const rtf = rtfDari([...DUDUK, M(NILAI_M), B(NILAI_B), M("Menimbang, bahwa alat bukti P.9 lain;"), ...FAKTA]);
    const h = sisipkanParagrafBukti(rtf, [KARTU_B, KARTU_M, { kode: "P.4", bunyi: "- Bahwa bukti P.4 berupa fotokopi Kartu Keluarga merupakan susunan keluarga;" }]);
    expect(h.disisipkan).toEqual(["P.2", "P.3", "P.4"]);
    const teks = teksDari(h.rtf);
    const baru = perintahSemua(h.rtf);
    const bentuk = (bunyi: string) => baru[teks.indexOf(bunyi)] ?? "";
    expect(bentuk(KARTU_B.bunyi)).toContain(HUBUNG);
    expect(bentuk(KARTU_M.bunyi)).toContain(JOROK);
    expect(bentuk("- Bahwa bukti P.4 berupa fotokopi Kartu Keluarga merupakan susunan keluarga;")).toContain(HUBUNG);
    expect(baru[teks.indexOf(FAKTA[0][0]) ]).toContain(JOROK);
  });

  it("alinea berikutnya tanpa \\pard sendiri: perintah jangkar dipulihkan sebelum alinea itu", () => {
    // Alinea berikut mewarisi perintah jangkar (tanpa \pard); sisipan '- Bahwa' tidak boleh mengubahnya.
    const tanpaPard = `${GRUP}Menimbang, bahwa berdasarkan analisis bukti-bukti di atas ditemukan fakta hukum:}${GRUP}\\par }`;
    const rtf = `${kepala}${[...DUDUK, M(NILAI_M)].map(([t, p]) => alinea(t, p)).join("\n")}\n${tanpaPard}\n}`;
    const h = sisipkanParagrafBukti(rtf, [KARTU_B]);
    expect(h.disisipkan).toEqual(["P.2"]);
    const asli = String.raw`\pard\s50\qj\fi720\li0\ri0\sl360\slmult1\widctlpar\lin0\rin0\itap0`;
    const mulaiFakta = h.rtf.indexOf("Menimbang, bahwa berdasarkan analisis");
    const sebelumFakta = h.rtf.slice(0, mulaiFakta);
    // Perintah jangkar ditulis ulang tepat sesudah penutup alinea sisipan, sebelum teks alinea fakta.
    expect(sebelumFakta.lastIndexOf(asli)).toBeGreaterThan(sebelumFakta.lastIndexOf(String.raw`\fi-384`));
    expect(teksDari(h.rtf).length).toBe(teksDari(rtf).length + 1);
  });

  it("dijalankan dua kali tidak menggandakan", () => {
    const rtf = rtfDari([...DUDUK, M(NILAI_M), ...FAKTA]);
    const a = sisipkanParagrafBukti(rtf, [KARTU_B, KARTU_M]);
    const b = sisipkanParagrafBukti(a.rtf, [KARTU_B, KARTU_M]);
    expect(b.disisipkan).toEqual([]);
    expect(b.rtf).toBe(a.rtf);
  });

  it("sisipan tidak memuat perintah huruf (font dan warna tetap dari grup tempat ditaruh)", () => {
    const rtf = rtfDari([...DUDUK, M(NILAI_M), ...FAKTA]);
    const h = sisipkanParagrafBukti(rtf, [KARTU_B]);
    const idx = h.rtf.indexOf(String.raw`-\tab Bahwa bukti P.2`);
    const tambahan = h.rtf.slice(h.rtf.lastIndexOf(String.raw`\par `, idx), idx);
    expect(tambahan).not.toMatch(/\\plain|\\fs\d|\\f\d|\\af\d/);
  });
});
