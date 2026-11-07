/**
 * Sisip paragraf bukti pada naskah yang menilai bukti surat dengan alinea umum (tanpa kode), seperti blangko kewarisan, harta bersama,
 * orang hilang, dan itsbat kontensius. Letak sisipan: sesudah alinea umum itu dan sebelum alinea saksi, dan hanya untuk kode yang
 * tercatat di daftar bukti naskah. Naskah rekaan, tanpa data perkara.
 */
import { describe, expect, it } from "vitest";

import { bacaRtfParagraf } from "@/lib/deteksi-sisa-blangko";
import { bacaBagianNaskah, rencanakanSisipan, selisihKurungRtf, sisipkanParagrafBukti, SEBAB_SISIP } from "@/lib/sisip-pertimbangan-bukti";

const PPR = String.raw`\pard \plain \qj \fi720 \li0 \ri0 \sl360 \slmult1 \widctlpar \fs20 `;
const GRUP = String.raw`{\fs24 \rtlch \ltrch \dbch \af6 \hich \af4 \loch \f4 `;
const alinea = (t: string) => `${PPR}${GRUP}${t}}${GRUP}\\par }`;
const kepala = String.raw`{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0 Times New Roman;}{\f4 Arial;}}{\colortbl;\red255\green0\blue0;}` + "\n";
const rtfDari = (teks: string[]) => `${kepala}${teks.map(alinea).join("\n")}\n}`;
const teksDari = (rtf: string) => bacaRtfParagraf(rtf, false).map((p) => p.teks);

const DUDUK = [
  "PUTUSAN",
  "TENTANG DUDUK PERKARA",
  "Bahwa Penggugat telah mengajukan bukti-bukti berupa:",
  "Fotokopi Kartu Tanda Penduduk, bukti surat tersebut diberi tanda P.1 serta diberi tanggal 1 Januari 2026;",
  "Fotokopi Kutipan Akta Nikah, bukti surat tersebut diberi tanda P.2 serta diberi tanggal 1 Januari 2026;",
  "TENTANG PERTIMBANGAN HUKUM",
  "Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan di atas;",
];
const UMUM = "Menimbang, bahwa bukti-bukti surat yang diajukan para pihak merupakan fotokopi akta autentik yang telah bermeterai cukup dan dicocokkan dengan aslinya;";
const OTENTIK = "Menimbang, bahwa terhadap akta otentik sebagaimana dimaksud dalam hukum pembuktian, Majelis Hakim menilainya sebagai alat bukti yang sempurna;";
const SAKSI = "Menimbang, bahwa saksi-saksi yang diajukan para pihak bukan orang yang dilarang menjadi saksi dan telah disumpah sebelum memberi keterangan;";
const JUDUL_FAKTA = "Mengenai Fakta Hukum";
const FAKTA = "Menimbang, bahwa berdasarkan dalil para pihak dihubungkan dengan alat bukti, Majelis Hakim menemukan fakta hukum sebagai berikut:";
const AKHIR = ["Bahwa Penggugat dan Tergugat telah menikah;", "Menimbang, bahwa gugatan dapat dikabulkan;", "MENGADILI", "Mengabulkan gugatan Penggugat;"];
const BARU = (k: string) => ({ kode: k, bunyi: `- Bahwa bukti ${k} merupakan fotokopi yang telah dicocokkan dengan aslinya;` });

const naskah = (tengah: string[], depan = DUDUK) => rtfDari([...depan, ...tengah, ...AKHIR]);

describe("jangkar cadangan: alinea umum penilaian bukti surat", () => {
  const dasar = [UMUM, OTENTIK, SAKSI, JUDUL_FAKTA, FAKTA];

  it("terbaca sesudah alinea terakhir penilaian surat, sebelum saksi dan judul pendek", () => {
    const teks = teksDari(naskah(dasar));
    const b = bacaBagianNaskah(teks);
    expect(b.jangkar).toBe(-1);
    expect(teks[b.jangkarUmum]).toBe(OTENTIK);
    expect([...b.dikenal].sort()).toEqual(["P.1", "P.2"]);
  });

  it("menyisipkan kode yang tercatat tepat sesudah alinea umum, tanpa mengubah yang lain", () => {
    const rtf = naskah(dasar);
    const h = sisipkanParagrafBukti(rtf, [BARU("P.2")]);
    expect(h.disisipkan).toEqual(["P.2"]);
    expect(h.tidakDisisip).toEqual([]);
    const sebelum = teksDari(rtf);
    const sesudah = teksDari(h.rtf);
    const i = sebelum.indexOf(OTENTIK);
    expect(sesudah).toHaveLength(sebelum.length + 1);
    expect(sesudah[i + 1]).toBe(BARU("P.2").bunyi.replace(/^- Bahwa/, "-\tBahwa").replace("\t", " ").replace(/\s+/g, " "));
    expect(sesudah[i + 2]).toBe(SAKSI);
    expect(sesudah.filter((t, n) => n !== i + 1)).toEqual(sebelum);
    expect(selisihKurungRtf(h.rtf)).toBe(selisihKurungRtf(rtf));
  });

  it("tidak ganda pada pemanggilan kedua", () => {
    const h = sisipkanParagrafBukti(naskah(dasar), [BARU("P.1")]);
    const lagi = sisipkanParagrafBukti(h.rtf, [BARU("P.1")]);
    expect(lagi.disisipkan).toEqual([]);
    expect(lagi.sudahAda).toEqual(["P.1"]);
    expect(lagi.rtf).toBe(h.rtf);
  });

  it("kode yang tidak tercatat di daftar bukti naskah ditolak dengan sebabnya", () => {
    const rtf = naskah(dasar);
    const h = sisipkanParagrafBukti(rtf, [BARU("P.9"), BARU("P.1")]);
    expect(h.disisipkan).toEqual(["P.1"]);
    expect(h.tidakDisisip).toEqual([{ kode: "P.9", sebab: SEBAB_SISIP.kodeTakTercatat }]);
    const hanya = sisipkanParagrafBukti(rtf, [BARU("P.9")]);
    expect(hanya.rtf).toBe(rtf);
    expect(hanya.tidakDisisip).toEqual([{ kode: "P.9", sebab: SEBAB_SISIP.kodeTakTercatat }]);
  });

  it("blangko tanpa daftar bukti (tidak ada kode di duduk perkara) tetap ditolak", () => {
    const tanpaDaftar = DUDUK.filter((t) => !/diberi tanda/.test(t));
    const rtf = naskah(dasar, tanpaDaftar);
    const h = sisipkanParagrafBukti(rtf, [BARU("P.1")]);
    expect(h.rtf).toBe(rtf);
    expect(h.disisipkan).toEqual([]);
    expect(h.tidakDisisip).toEqual([{ kode: "P.1", sebab: SEBAB_SISIP.kodeTakTercatat }]);
  });

  it("alinea penilaian yang disusul pembahasan lain sebelum fakta bukan jangkar", () => {
    const lain = "Menimbang, bahwa mengenai kewenangan relatif Pengadilan Agama ini didasarkan pada tempat tinggal Tergugat sebagaimana diatur dalam hukum acara;";
    const rtf = naskah([UMUM, OTENTIK, SAKSI, lain, FAKTA]);
    expect(bacaBagianNaskah(teksDari(rtf)).jangkarUmum).toBe(-1);
    const h = sisipkanParagrafBukti(rtf, [BARU("P.1")]);
    expect(h.rtf).toBe(rtf);
    expect(h.tidakDisisip).toEqual([{ kode: "P.1", sebab: SEBAB_SISIP.tanpaJangkar }]);
  });

  it("alinea yang menyebut saksi bukan jangkar, jadi tanpa alinea surat sisipan ditolak", () => {
    const rtf = naskah([SAKSI, JUDUL_FAKTA, FAKTA]);
    expect(bacaBagianNaskah(teksDari(rtf)).jangkarUmum).toBe(-1);
    const h = sisipkanParagrafBukti(rtf, [BARU("P.1")]);
    expect(h.rtf).toBe(rtf);
    expect(h.tidakDisisip[0].sebab).toBe(SEBAB_SISIP.tanpaJangkar);
  });

  it("naskah tanpa pembahasan fakta (pencabutan, penolakan formil) tetap ditolak", () => {
    const rtf = naskah([UMUM, OTENTIK, SAKSI]);
    const h = sisipkanParagrafBukti(rtf, [BARU("P.1")]);
    expect(h.rtf).toBe(rtf);
    expect(h.tidakDisisip).toEqual([{ kode: "P.1", sebab: SEBAB_SISIP.tanpaBatas }]);
  });

  it("jangkar berkode tetap didahulukan dan tidak meminta kode tercatat", () => {
    const nilai = "Menimbang, bahwa alat bukti P.1 merupakan keterangan identitas Penggugat yang sesuai dengan fakta di persidangan;";
    const rtf = naskah([UMUM, nilai, SAKSI, JUDUL_FAKTA, FAKTA]);
    const b = bacaBagianNaskah(teksDari(rtf));
    expect(b.jangkar).toBeGreaterThan(0);
    expect(b.jangkarUmum).toBe(-1);
    const h = sisipkanParagrafBukti(rtf, [BARU("P.9")]);
    expect(h.disisipkan).toEqual(["P.9"]);
  });

  it("rencana di layar sama dengan hasil: masuk, ditolak karena kode, dan sudah ada", () => {
    const teks = teksDari(naskah(dasar));
    const r = rencanakanSisipan(teks, [BARU("P.2"), BARU("P.9")]);
    expect(r.akanMasuk).toEqual(["P.2"]);
    expect(r.tidakDisisip).toEqual([{ kode: "P.9", sebab: SEBAB_SISIP.kodeTakTercatat }]);
  });
});
