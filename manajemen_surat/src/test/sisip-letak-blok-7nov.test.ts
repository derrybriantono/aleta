/**
 * Letak sisipan paragraf bukti pada naskah dengan blok Pemohon dan Termohon, bukti elektronik, dan alinea lanjutan:
 * sisipan tidak membelah blok bukti elektronik, bukti surat tiap pihak jatuh di blok pihaknya, dan blok lanjutan tetap utuh.
 * Naskah rekaan, tanpa data perkara.
 */
import { describe, expect, it } from "vitest";

import { bacaRtfParagraf } from "@/lib/deteksi-sisa-blangko";
import { selisihKurungRtf, sisipkanParagrafBukti } from "@/lib/sisip-pertimbangan-bukti";

const PPR = String.raw`\pard \plain \qj \fi720 \li0 \ri0 \sl360 \slmult1 \widctlpar \fs20 `;
const GRUP = String.raw`{\fs24 \rtlch \ltrch \dbch \af6 \hich \af4 \loch \f4 `;
const alinea = (t: string) => `${PPR}${GRUP}${t}}${GRUP}\\par }`;
const kepala = String.raw`{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0 Times New Roman;}{\f4 Arial;}}{\colortbl;\red255\green0\blue0;}` + "\n";
const rtfDari = (teks: string[]) => `${kepala}${teks.map(alinea).join("\n")}\n}`;
const teksDari = (rtf: string) => bacaRtfParagraf(rtf, false).map((p) => p.teks);

const DUDUK = [
  "PUTUSAN",
  "TENTANG DUDUK PERKARA",
  "Fotokopi Kartu Tanda Penduduk, bukti surat tersebut diberi tanda P.1 serta diberi tanggal 1 Januari 2026;",
  "Fotokopi Kutipan Akta Nikah, bukti surat tersebut diberi tanda P.2 serta diberi tanggal 1 Januari 2026;",
  "Fotokopi Kartu Keluarga, bukti surat tersebut diberi tanda T.1 serta diberi tanggal 1 Januari 2026;",
  "Fotokopi Kutipan Akta Nikah, bukti surat tersebut diberi tanda T.2 serta diberi tanggal 1 Januari 2026;",
  "Fotokopi Ijazah, bukti surat tersebut diberi tanda T.3 serta diberi tanggal 1 Januari 2026;",
  "Bukti elektronik berupa rekaman, diberi tanda T.4;",
  "TENTANG PERTIMBANGAN HUKUM",
  "Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan di atas;",
];
const P_PENGANTAR = "Menimbang, bahwa terhadap bukti surat yang diajukan Penggugat akan dipertimbangkan sebagai berikut:";
const P1 = "- Bahwa bukti P.1 merupakan fotokopi identitas Penggugat yang telah dicocokkan dengan aslinya;";
const P_SAKSI = "Menimbang, bahwa selain bukti surat, Penggugat juga mengajukan dua orang saksi yang telah disumpah di persidangan;";
const P_SAKSI2 = "- Bahwa saksi-saksi Penggugat telah memberikan keterangan yang saling bersesuaian di muka persidangan;";
const T_PENGANTAR = "Menimbang, bahwa terhadap bukti surat yang diajukan Tergugat akan dipertimbangkan sebagai berikut:";
const T1 = "- Bahwa bukti T.1 merupakan fotokopi yang telah dicocokkan dengan aslinya dan relevan dengan dalil Tergugat;";
const T2 = "- Bahwa bukti T.2 berupa fotokopi Kutipan Akta Nikah merupakan bukti utama perkawinan para pihak;";
const T_ELEK = "Menimbang, bahwa bukti T.4 yang diajukan Tergugat merupakan alat bukti elektronik yang harus memenuhi syarat formil dan materiil;";
const T_ELEK_L1 = "- Bahwa meskipun bukti elektronik di atas merupakan alat bukti yang sah, nilai pembuktiannya perlu diuji lebih lanjut;";
const T_ELEK_L2 = "- Bahwa dari aspek syarat formil, bukti T.4 telah memenuhi syarat sebagai alat bukti elektronik menurut hukum;";
const T_SAKSI = "Menimbang, bahwa selain bukti surat, Tergugat juga mengajukan dua orang saksi yang telah disumpah di persidangan;";
const FAKTA = "Menimbang, bahwa berdasarkan analisis bukti-bukti di atas ditemukan fakta hukum sebagai berikut:";
const AKHIR = ["Bahwa Penggugat dan Tergugat telah menikah;", "Menimbang, bahwa gugatan dapat dikabulkan;", "MENGADILI", "Mengabulkan gugatan Penggugat;"];

const BLOK_P = [P_PENGANTAR, P1, P_SAKSI, P_SAKSI2];
const BLOK_T = [T_PENGANTAR, T1, T2, T_ELEK, T_ELEK_L1, T_ELEK_L2, T_SAKSI];
const NASKAH = rtfDari([...DUDUK, ...BLOK_P, ...BLOK_T, FAKTA, ...AKHIR]);
const baru = (k: string, tambahan = "yang telah dicocokkan dengan aslinya") => ({ kode: k, bunyi: `- Bahwa bukti ${k} merupakan fotokopi ${tambahan};` });
const elek = (k: string) => ({ kode: k, kunci: "elektronik", bunyi: `Menimbang, bahwa bukti ${k} merupakan bukti elektronik yang dicocokkan dengan perangkat asalnya;` });

/** Daftar alinea hasil tanpa alinea yang disisipkan, untuk dibandingkan dengan naskah semula. */
const tanpaSisipan = (hasil: string[], ditambah: string[]) => hasil.filter((t) => !ditambah.includes(t));

describe("letak sisipan menurut blok dan jenis bukti", () => {
  it("bukti surat Tergugat jatuh sesudah surat Tergugat dan sebelum blok elektronik, bukan di tengahnya", () => {
    const h = sisipkanParagrafBukti(NASKAH, [baru("T.3")]);
    expect(h.disisipkan).toEqual(["T.3"]);
    const sebelum = teksDari(NASKAH);
    const sesudah = teksDari(h.rtf);
    const i = sesudah.findIndex((t) => t.includes("bukti T.3"));
    expect(sesudah[i - 1]).toBe(T2);
    expect(sesudah[i + 1]).toBe(T_ELEK);
    expect(sesudah[sesudah.indexOf(T_ELEK) + 1]).toBe(T_ELEK_L1);
    expect(sesudah[sesudah.indexOf(T_ELEK) + 2]).toBe(T_ELEK_L2);
    expect(tanpaSisipan(sesudah, [sesudah[i]])).toEqual(sebelum);
    expect(selisihKurungRtf(h.rtf)).toBe(selisihKurungRtf(NASKAH));
  });

  it("bukti elektronik baru jatuh sesudah blok elektronik beserta alinea lanjutannya, sebelum saksi", () => {
    const naskah = rtfDari([...DUDUK.slice(0, -2), "Bukti elektronik berupa foto, diberi tanda T.5;", ...DUDUK.slice(-2), ...BLOK_P, ...BLOK_T, FAKTA, ...AKHIR]);
    const h = sisipkanParagrafBukti(naskah, [elek("T.5")]);
    expect(h.disisipkan).toEqual(["T.5"]);
    const sesudah = teksDari(h.rtf);
    const i = sesudah.findIndex((t) => t.includes("bukti T.5"));
    expect(sesudah[i - 1]).toBe(T_ELEK_L2);
    expect(sesudah[i + 1]).toBe(T_SAKSI);
  });

  it("bukti surat Penggugat jatuh di blok Penggugat, bukan di blok Tergugat", () => {
    const naskah = rtfDari([...DUDUK.slice(0, -2), "Fotokopi Kartu Keluarga, bukti surat tersebut diberi tanda P.3 serta diberi tanggal 1 Januari 2026;", ...DUDUK.slice(-2), ...BLOK_P, ...BLOK_T, FAKTA, ...AKHIR]);
    const h = sisipkanParagrafBukti(naskah, [baru("P.3")]);
    expect(h.disisipkan).toEqual(["P.3"]);
    const sesudah = teksDari(h.rtf);
    const i = sesudah.findIndex((t) => t.includes("bukti P.3"));
    expect(sesudah[i - 1]).toBe(P1);
    expect(sesudah[i + 1]).toBe(P_SAKSI);
  });

  it("paragraf kedua pihak sekaligus masuk ke blok masing-masing; panggilan kedua tidak menggandakan", () => {
    const naskah = rtfDari([...DUDUK.slice(0, -2), "Fotokopi Kartu Keluarga, bukti surat tersebut diberi tanda P.3 serta diberi tanggal 1 Januari 2026;", ...DUDUK.slice(-2), ...BLOK_P, ...BLOK_T, FAKTA, ...AKHIR]);
    const paragraf = [baru("T.3"), baru("P.3"), elek("T.5")];
    const h = sisipkanParagrafBukti(naskah, paragraf);
    expect(h.disisipkan.sort()).toEqual(["P.3", "T.3", "T.5"]);
    const sebelum = teksDari(naskah);
    const sesudah = teksDari(h.rtf);
    expect(sesudah).toHaveLength(sebelum.length + 3);
    const ditambah = sesudah.filter((t) => /bukti (P\.3|T\.3|T\.5)\b/.test(t) && !sebelum.includes(t));
    expect(ditambah).toHaveLength(3);
    expect(tanpaSisipan(sesudah, ditambah)).toEqual(sebelum);
    const di = (k: string) => sesudah.findIndex((t) => t.includes(`bukti ${k} merupakan`));
    expect(di("P.3")).toBe(sesudah.indexOf(P1) + 1);
    expect(di("T.3")).toBe(sesudah.indexOf(T2) + 1);
    expect(di("T.5")).toBe(sesudah.indexOf(T_ELEK_L2) + 1);
    expect(selisihKurungRtf(h.rtf)).toBe(selisihKurungRtf(naskah));
    const lagi = sisipkanParagrafBukti(h.rtf, paragraf);
    expect(lagi.disisipkan).toEqual([]);
    expect(lagi.rtf).toBe(h.rtf);
  });

  it("tanpa alinea sepihak di naskah, sisipan mengikuti penilaian berkode terakhir beserta lanjutannya", () => {
    const h = sisipkanParagrafBukti(NASKAH, [baru("PR.2")]);
    // PR tidak punya blok sendiri: aturan umum, sesudah blok penilaian berkode terakhir (blok elektronik Tergugat).
    expect(h.disisipkan).toEqual(["PR.2"]);
    const sesudah = teksDari(h.rtf);
    const i = sesudah.findIndex((t) => t.includes("bukti PR.2"));
    expect(sesudah[i - 1]).toBe(T_ELEK_L2);
    expect(sesudah[i + 1]).toBe(T_SAKSI);
  });

  it("alinea lanjutan yang menyebut saksi bukan bagian blok", () => {
    const naskah = rtfDari([...DUDUK, ...BLOK_P, ...BLOK_T, FAKTA, ...AKHIR].map((t) => (t === T_ELEK_L2 ? "- Bahwa saksi Tergugat menerangkan bukti T.4 itu miliknya sendiri;" : t)));
    const h = sisipkanParagrafBukti(naskah, [elek("T.5")]);
    // T.5 tidak tercatat di duduk perkara naskah ini, tetapi jangkar berkode ada, jadi tetap masuk; letaknya sesudah L1 dan sebelum alinea saksi.
    expect(h.disisipkan).toEqual(["T.5"]);
    const sesudah = teksDari(h.rtf);
    const i = sesudah.findIndex((t) => t.includes("bukti T.5"));
    expect(sesudah[i - 1]).toBe(T_ELEK_L1);
  });

  it("alinea berkode di dalam blok elektronik tetap dihitung elektronik: surat baru sebelum blok, elektronik baru sesudah ekornya", () => {
    const lanjutBerkode = "- Bahwa bukti T.4 pada pokoknya menerangkan komunikasi yang tidak baik antara para pihak selama berpisah tempat tinggal;";
    const ekor = "- Bahwa meskipun Tergugat tidak dapat menunjukkan digital forensic, isi rekaan itu dinilai sebagai petunjuk belaka;";
    const naskah = rtfDari([...DUDUK, ...BLOK_P, T_PENGANTAR, T1, T2, T_ELEK, T_ELEK_L1, lanjutBerkode, ekor, T_SAKSI, FAKTA, ...AKHIR]);
    const surat = teksDari(sisipkanParagrafBukti(naskah, [baru("T.3")]).rtf);
    const i = surat.findIndex((t) => t.includes("bukti T.3 merupakan"));
    expect(surat[i - 1]).toBe(T2);
    expect(surat[i + 1]).toBe(T_ELEK);
    const el = teksDari(sisipkanParagrafBukti(naskah, [elek("T.5")]).rtf);
    const j = el.findIndex((t) => t.includes("bukti T.5 merupakan"));
    expect(el[j - 1]).toBe(ekor);
    expect(el[j + 1]).toBe(T_SAKSI);
  });
});
