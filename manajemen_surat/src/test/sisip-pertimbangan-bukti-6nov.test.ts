/**
 * Sisip paragraf pertimbangan bukti ke naskah RTF (sisip-pertimbangan-bukti.ts): sudah ada tidak ganda (termasuk daftar dan rentang),
 * jangkar, tanpa judul, daftar bukti di duduk perkara tidak dihitung, huruf non-ASCII, kurung seimbang, isi di luar titik sisip tidak berubah,
 * usulan yang belum disetujui tidak pernah masuk. Naskah rekaan, tanpa data perkara.
 */
import { describe, expect, it } from "vitest";

import { bacaRtfParagraf } from "@/lib/deteksi-sisa-blangko";
import type { BarisBukti } from "@/lib/bukti-tertulis";
import {
  bacaBagianNaskah,
  kodeDisebut,
  paragrafUntukNaskah,
  rencanakanSisipan,
  selisihKurungRtf,
  sisipkanParagrafBukti,
  SEBAB_SISIP,
  teksKeRtfSisip,
} from "@/lib/sisip-pertimbangan-bukti";
import { susunParagrafBukti, type BuktiMasuk, type ParagrafBukti } from "@/lib/sinkron-pertimbangan-bukti";

const PPR = String.raw`\pard \plain \qj \fi720 \li0 \ri0 \sl360 \slmult1 \widctlpar \fs20 `;
const GRUP = String.raw`{\fs24 \rtlch \ltrch \dbch \af6 \hich \af4 \loch \f4 `;
/** Satu alinea gaya Word: teks dalam satu grup, penutup \par dalam grup sendiri. */
const alinea = (t: string, ppr = PPR) => `${ppr}${GRUP}${t}}${GRUP}\\par }`;
const kepala = String.raw`{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0 Times New Roman;}{\f4 Arial;}}{\colortbl;\red255\green0\blue0;}` + "\n";
const rtfDari = (teks: string[], ppr?: string) => `${kepala}${teks.map((t) => alinea(t, ppr)).join("\n")}\n}`;

const DUDUK = [
  "PUTUSAN",
  "TENTANG DUDUK PERKARA",
  "Bahwa Penggugat telah mengajukan bukti-bukti berupa:",
  "Fotokopi Kartu Tanda Penduduk, bukti surat tersebut diberi tanda P.1 serta diberi tanggal 1 Januari 2026;",
  "Fotokopi Kutipan Akta Nikah, bukti surat tersebut diberi tanda P.2 serta diberi tanggal 1 Januari 2026;",
  "Fotokopi Kartu Keluarga, bukti surat tersebut diberi tanda P.3 serta diberi tanggal 1 Januari 2026;",
  "TENTANG PERTIMBANGAN HUKUM",
];
const AKHIR = [
  "Menimbang, bahwa berdasarkan analisis bukti-bukti di atas ditemukan fakta hukum sebagai berikut:",
  "Bahwa Penggugat dan Tergugat telah menikah;",
  "Menimbang, bahwa berdasarkan bukti dan fakta di atas gugatan dapat dikabulkan;",
  "MENGADILI",
  "Mengabulkan gugatan Penggugat;",
];
const NILAI_P1 = "Menimbang, bahwa alat bukti P.1 merupakan keterangan identitas Penggugat yang sesuai dengan fakta di persidangan;";
const NILAI_P2 = "Menimbang, bahwa alat bukti P.2 menunjukkan Penggugat dan Tergugat terikat sebagai suami istri;";
const INTRO = "Menimbang, bahwa untuk membuktikan dalil gugatannya, Penggugat telah mengajukan alat bukti surat P.1 dan P.2;";
const naskah = (tengah: string[], depan = DUDUK, belakang = AKHIR) => rtfDari([...depan, ...tengah, ...belakang]);
const teksDari = (rtf: string) => bacaRtfParagraf(rtf, false).map((p) => p.teks);
const P9 = { kode: "P.9", bunyi: "Menimbang, bahwa alat bukti P.9 menerangkan sesuatu yang bukan dari blangko;" };
const P3 = { kode: "P.3", bunyi: "Menimbang, bahwa alat bukti P.3 menerangkan susunan keluarga;" };

describe("kode yang disebut", () => {
  it("membaca kata utuh, daftar, dan rentang; mengabaikan nomor surat dan huruf menempel", () => {
    expect([...kodeDisebut("alat bukti P.1 dan P.2 serta T.3")].sort()).toEqual(["P.1", "P.2", "T.3"]);
    expect([...kodeDisebut("bukti P.1 sampai dengan P.4")].sort()).toEqual(["P.1", "P.2", "P.3", "P.4"]);
    expect([...kodeDisebut("bukti T.2 s/d T.4")].sort()).toEqual(["T.2", "T.3", "T.4"]);
    expect([...kodeDisebut("bukti P.1 - P.3")].sort()).toEqual(["P.1", "P.2", "P.3"]);
    expect([...kodeDisebut("Nomor 445/S.Ker/PKM-T.1/2026, KUA.22.07/PW.1/IV, SPP.5 dan P.10")]).toEqual(["P.10"]);
    expect(kodeDisebut("bukti P.1 sampai T.3").has("P.2")).toBe(false);
  });
});

describe("letak bagian pembuktian", () => {
  it("judul, jangkar terakhir sebelum fakta, dan batas yang benar", () => {
    const teks = [...DUDUK, INTRO, NILAI_P1, NILAI_P2, ...AKHIR];
    const b = bacaBagianNaskah(teks);
    expect(b.judul).toBe(DUDUK.length - 1);
    expect(teks[b.jangkar]).toBe(NILAI_P2);
    expect(teks[b.batasFakta]).toMatch(/analisis bukti/);
    expect(b.disebut.has("P.2")).toBe(true);
    // Penyebutan sesudah batas fakta bukan jangkar; pengantar bukan penilaian.
    const hanyaPengantar = bacaBagianNaskah([...DUDUK, INTRO, ...AKHIR]);
    expect(hanyaPengantar.jangkar).toBe(-1);
  });
  it("daftar bukti di duduk perkara tidak dihitung sebagai sudah ada", () => {
    const teks = [...DUDUK, NILAI_P1, ...AKHIR];
    const b = bacaBagianNaskah(teks);
    expect(b.disebut.has("P.3")).toBe(false);
    expect(b.disebut.has("P.1")).toBe(true);
  });
});

describe("menyisipkan paragraf", () => {
  it("menambah paragraf sesudah alinea penilaian bukti terakhir dan sebelum pembahasan fakta, berformat sama", () => {
    const rtf = naskah([INTRO, NILAI_P1, NILAI_P2]);
    const h = sisipkanParagrafBukti(rtf, [P3]);
    expect(h.disisipkan).toEqual(["P.3"]);
    expect(h.sudahAda).toEqual([]);
    expect(h.tidakDisisip).toEqual([]);
    const sebelum = teksDari(rtf);
    const sesudah = teksDari(h.rtf);
    expect(sesudah.length).toBe(sebelum.length + 1);
    const i = sebelum.indexOf(NILAI_P2);
    expect(sesudah[i + 1]).toBe(P3.bunyi);
    expect(sesudah[i + 2]).toMatch(/analisis bukti/);
    // Alinea baru memakai pengaturan alinea dan grup huruf yang sama dengan jangkar.
    expect(h.rtf).toContain(`${GRUP}\\par ${P3.bunyi}\\par }`);
  });

  it("sudah ada tidak ganda: kata utuh, daftar, dan rentang", () => {
    const rtf = naskah([INTRO, NILAI_P1, NILAI_P2]);
    for (const p of [{ kode: "P.1", bunyi: "Menimbang, bahwa alat bukti P.1 lain;" }, { kode: "P.2", bunyi: "Menimbang, bahwa alat bukti P.2 lain;" }, { kode: "P.1 dan P.2", bunyi: "Menimbang, bahwa bukti P.1 dan P.2 asli;" }]) {
      const h = sisipkanParagrafBukti(rtf, [p]);
      expect(h.disisipkan).toEqual([]);
      expect(h.sudahAda).toEqual([p.kode]);
      expect(h.rtf).toBe(rtf);
    }
    // Kode yang hanya disebut lewat daftar "P.1 dan P.2" di satu alinea juga sudah ada.
    const daftar = naskah([INTRO, "Menimbang, bahwa bukti surat (P.1 dan P.2) merupakan fotokopi akta autentik;"]);
    const h2 = sisipkanParagrafBukti(daftar, [{ kode: "P.2", bunyi: "Menimbang, bahwa alat bukti P.2 baru;" }]);
    expect(h2.sudahAda).toEqual(["P.2"]);
    expect(h2.rtf).toBe(daftar);
    // Rentang.
    const rentang = naskah([INTRO, "Menimbang, bahwa bukti P.1 sampai dengan P.3 berupa surat kependudukan;"]);
    const h3 = sisipkanParagrafBukti(rentang, [{ kode: "P.2", bunyi: "Menimbang, bahwa alat bukti P.2 baru;" }, P9]);
    expect(h3.sudahAda).toEqual(["P.2"]);
    expect(h3.disisipkan).toEqual(["P.9"]);
    // Kode gabungan: satu kode yang sudah disebut cukup untuk menahan paragrafnya.
    const h4 = sisipkanParagrafBukti(rtf, [{ kode: "P.2 dan P.9", bunyi: "Menimbang, bahwa bukti P.2 dan P.9 begini;" }]);
    expect(h4.sudahAda).toEqual(["P.2 dan P.9"]);
    expect(h4.rtf).toBe(rtf);
  });

  it("dijalankan dua kali: tidak pernah menggandakan", () => {
    const rtf = naskah([INTRO, NILAI_P1, NILAI_P2]);
    const a = sisipkanParagrafBukti(rtf, [P3, P9]);
    expect(a.disisipkan).toEqual(["P.3", "P.9"]);
    const b = sisipkanParagrafBukti(a.rtf, [P3, P9]);
    expect(b.disisipkan).toEqual([]);
    expect(b.sudahAda).toEqual(["P.3", "P.9"]);
    expect(b.rtf).toBe(a.rtf);
  });

  it("urut menurut kode dan paragraf ganda dibuang", () => {
    const rtf = naskah([INTRO, NILAI_P1, NILAI_P2]);
    const T1 = { kode: "T.1", bunyi: "Menimbang, bahwa alat bukti T.1 begini;" };
    const h = sisipkanParagrafBukti(rtf, [T1, P9, P3, P9]);
    expect(h.disisipkan).toEqual(["P.3", "P.9", "T.1"]);
    const t = teksDari(h.rtf);
    const i = t.indexOf(NILAI_P2);
    expect(t.slice(i + 1, i + 4)).toEqual([P3.bunyi, P9.bunyi, T1.bunyi]);
  });

  it("kode yang hanya disebut sesudah pembahasan fakta tetap dihitung sudah ada (konservatif, tidak ganda)", () => {
    const rtf = naskah([INTRO, NILAI_P1], DUDUK, [...AKHIR.slice(0, 2), "Menimbang, bahwa berdasarkan bukti P.9 gugatan dapat dikabulkan;", ...AKHIR.slice(2)]);
    const h = sisipkanParagrafBukti(rtf, [P9, P3]);
    expect(h.sudahAda).toEqual(["P.9"]);
    expect(h.disisipkan).toEqual(["P.3"]);
  });

  it("tanpa judul pertimbangan: tidak menyisip apa pun dan semuanya dilaporkan", () => {
    const tanpa = rtfDari(["PUTUSAN", "TENTANG DUDUK PERKARA", NILAI_P1, ...AKHIR]);
    const h = sisipkanParagrafBukti(tanpa, [P3, P9]);
    expect(h.rtf).toBe(tanpa);
    expect(h.disisipkan).toEqual([]);
    expect(h.tidakDisisip).toEqual([
      { kode: "P.3", sebab: SEBAB_SISIP.tanpaJudul },
      { kode: "P.9", sebab: SEBAB_SISIP.tanpaJudul },
    ]);
  });

  it("tanpa alinea penilaian bukti (jangkar) atau tanpa batas fakta: tidak menyisip", () => {
    const tanpaJangkar = naskah([INTRO]);
    const a = sisipkanParagrafBukti(tanpaJangkar, [P9]);
    expect(a.rtf).toBe(tanpaJangkar);
    expect(a.tidakDisisip).toEqual([{ kode: "P.9", sebab: SEBAB_SISIP.tanpaJangkar }]);
    const tanpaBatas = naskah([INTRO, NILAI_P1], DUDUK, ["MENGADILI", "Mengabulkan;"]);
    const b = sisipkanParagrafBukti(tanpaBatas, [P9]);
    expect(b.rtf).toBe(tanpaBatas);
    expect(b.tidakDisisip).toEqual([{ kode: "P.9", sebab: SEBAB_SISIP.tanpaBatas }]);
  });

  it("alinea di dalam tabel tidak dijadikan titik sisip", () => {
    const rtf = naskah([INTRO, NILAI_P1]).replace(`${PPR}${GRUP}${NILAI_P1}`, `${PPR}\\intbl ${GRUP}${NILAI_P1}`);
    const h = sisipkanParagrafBukti(rtf, [P9]);
    expect(h.rtf).toBe(rtf);
    expect(h.tidakDisisip).toEqual([{ kode: "P.9", sebab: SEBAB_SISIP.letakPenutup }]);
  });

  it("jangkar berwarna merah: sisipan ditulis hitam, alinea lain tetap merah", () => {
    const merah = `${PPR}${GRUP}\\cf1 ${NILAI_P1}}${GRUP}\\cf1 \\par }`;
    const rtf = rtfDari([...DUDUK, INTRO]).replace(/\n\}$/, `\n${merah}\n${AKHIR.map((t) => alinea(t)).join("\n")}\n}`);
    const h = sisipkanParagrafBukti(rtf, [P9]);
    expect(h.disisipkan).toEqual(["P.9"]);
    const sesudah = bacaRtfParagraf(h.rtf, false);
    const baru = sesudah.find((p) => p.teks === P9.bunyi);
    expect(baru?.merah).toEqual([]);
    expect(sesudah.find((p) => p.teks === NILAI_P1)?.merah.length).toBeGreaterThan(0);
    expect(selisihKurungRtf(h.rtf)).toBe(0);
  });

  it("isi di luar titik sisip tidak berubah satu bita pun, dan kurung tetap seimbang", () => {
    const rtf = naskah([INTRO, NILAI_P1, NILAI_P2]);
    const h = sisipkanParagrafBukti(rtf, [P3, P9]);
    const tambah = h.rtf.length - rtf.length;
    expect(tambah).toBeGreaterThan(0);
    let a = 0;
    while (rtf[a] === h.rtf[a]) a += 1;
    // Isi sama sebelum titik sisip dan sesudahnya (titik sisip = awal selisih).
    expect(h.rtf.slice(0, a)).toBe(rtf.slice(0, a));
    expect(h.rtf.slice(a + tambah)).toBe(rtf.slice(a));
    expect(selisihKurungRtf(rtf)).toBe(0);
    expect(selisihKurungRtf(h.rtf)).toBe(0);
    // Alinea lain identik, urutannya sama.
    const sebelum = teksDari(rtf);
    const sesudah = teksDari(h.rtf).filter((t) => t !== P3.bunyi && t !== P9.bunyi);
    expect(sesudah).toEqual(sebelum);
  });

  it("huruf non-ASCII dan karakter RTF khusus ditulis aman", () => {
    const aneh = { kode: "P.9", bunyi: "Menimbang, bahwa alat bukti P.9 dari Desa Paé – “Timur” {a} \\b 😀 selesai;" };
    const rtf = naskah([INTRO, NILAI_P1]);
    const h = sisipkanParagrafBukti(rtf, [aneh]);
    expect(h.disisipkan).toEqual(["P.9"]);
    expect(teksDari(h.rtf)).toContain(aneh.bunyi);
    expect(selisihKurungRtf(h.rtf)).toBe(0);
    expect(teksKeRtfSisip(aneh.bunyi)).toContain("\\'e9");
    expect(teksKeRtfSisip(aneh.bunyi)).toContain("\\u8211?");
    // Naskah asal murni ASCII, jadi tidak ada huruf non-ASCII mentah yang ikut masuk.
    expect(/[^ -~\r\n]/.test(h.rtf)).toBe(false);
  });

  it("naskah yang memuat huruf cp1252 mentah dibaca lewat untukBaca yang sama panjang", () => {
    const mentah = rtfDari([...DUDUK, "Menimbang, bahwa alat bukti P.1 \u0093ditulis\u0094 mentah;", ...AKHIR]);
    const bita = Buffer.from(mentah, "latin1");
    const latin1 = bita.toString("latin1");
    const cp = new TextDecoder("windows-1252").decode(bita);
    expect(cp.length).toBe(latin1.length);
    const h = sisipkanParagrafBukti(latin1, [P9], { untukBaca: cp });
    expect(h.disisipkan).toEqual(["P.9"]);
    // Byte mentah 0x93 dan 0x94 tetap di tempatnya.
    expect(h.rtf.includes("\u0093ditulis\u0094")).toBe(true);
    const lagi = sisipkanParagrafBukti(h.rtf, [P9], { untukBaca: new TextDecoder("windows-1252").decode(Buffer.from(h.rtf, "latin1")) });
    expect(lagi.sudahAda).toEqual(["P.9"]);
  });

  it("bunyi memuat kata Aleta atau kosong tidak masuk", () => {
    const rtf = naskah([INTRO, NILAI_P1]);
    const h = sisipkanParagrafBukti(rtf, [{ kode: "P.9", bunyi: "Menimbang, bahwa alat bukti P.9 dari ALETA;" }, { kode: "P.8", bunyi: "  " }, { kode: "", bunyi: "tanpa kode" }]);
    expect(h.rtf).toBe(rtf);
    expect(h.tidakDisisip.map((x) => x.sebab)).toEqual([SEBAB_SISIP.kataTerlarang, SEBAB_SISIP.bunyiKosong, SEBAB_SISIP.kodeTakTerbaca]);
  });

  it("tanpa paragraf atau masukan aneh: naskah dipulangkan apa adanya", () => {
    const rtf = naskah([INTRO, NILAI_P1]);
    expect(sisipkanParagrafBukti(rtf, []).rtf).toBe(rtf);
    expect(sisipkanParagrafBukti("", [P9]).tidakDisisip[0].sebab).toBe(SEBAB_SISIP.tanpaJudul);
    expect(sisipkanParagrafBukti("bukan rtf", [P9]).rtf).toBe("bukan rtf");
  });

  it("rencana dari teks alinea sepakat dengan hasil di RTF", () => {
    const rtf = naskah([INTRO, NILAI_P1, NILAI_P2]);
    const paragraf = [P3, P9, { kode: "P.1", bunyi: "Menimbang, bahwa alat bukti P.1 lain;" }];
    const r = rencanakanSisipan(teksDari(rtf), paragraf);
    const h = sisipkanParagrafBukti(rtf, paragraf);
    expect(r.akanMasuk).toEqual(h.disisipkan);
    expect(r.sudahAda).toEqual(h.sudahAda);
    expect(r.tidakDisisip).toEqual(h.tidakDisisip);
  });
});

describe("hanya paragraf yang berhak masuk", () => {
  const baris = (nm: string): BarisBukti => ({ nm, an: "Fulanah binti Fulan", no: "1", tgl: "2020-01-02", oleh: "Dinas", meterai: 0, cocok: 0, manual: null });
  const bukti: BuktiMasuk[] = [
    { sisi: "P", nomor: 1, baris: baris("Kartu Tanda Penduduk") },
    { sisi: "P", nomor: 2, baris: baris("Kutipan Akta Nikah") },
    { sisi: "P", nomor: 3, baris: baris("Surat Keterangan Domisili") },
  ];
  const hasil = susunParagrafBukti({ jenisPerkara: "CG", status: "Dikabulkan", verstek: true, lawanHadir: false, lawanMembantah: false, agendaPembuktianKe: 1, bukti });

  it("perluDisetujui tidak pernah masuk, usulan hanya bila dicentang dan anggota hasil", () => {
    expect(hasil.perluDisetujui.length).toBeGreaterThan(0);
    const bunyiPerlu = hasil.perluDisetujui.map((p) => p.bunyi);
    const otomatis = hasil.paragraf.filter((p) => p.cara === "otomatis");
    expect(otomatis.length).toBeGreaterThan(0);
    const dasar = paragrafUntukNaskah(hasil);
    expect(dasar).toEqual(otomatis);
    expect(dasar.every((p) => p.cara === "otomatis")).toBe(true);
    for (const b of bunyiPerlu) expect(dasar.some((p) => p.bunyi === b)).toBe(false);
    // Paragraf tiruan dari perluDisetujui yang dipaksa berlabel usulan tetap ditolak karena bukan anggota hasil.paragraf.
    const tiruan: ParagrafBukti[] = hasil.perluDisetujui.map((p) => ({ kode: p.kode, kunci: p.kunci, bunyi: p.bunyi, cara: "usulan", asal: "tiruan" }));
    expect(paragrafUntukNaskah(hasil, tiruan)).toEqual(otomatis);
    // Usulan asli yang dicentang ikut.
    const usulanAsli = hasil.paragraf.filter((p) => p.cara === "usulan");
    expect(paragrafUntukNaskah(hasil, usulanAsli)).toEqual([...otomatis, ...usulanAsli]);
  });

  it("sampai ke naskah: paragraf otomatis masuk, usulan yang belum disetujui tidak", () => {
    const rtf = naskah(["Menimbang, bahwa Penggugat telah mengajukan alat bukti surat;", "Menimbang, bahwa alat bukti P.7 sudah dinilai;"]);
    const h = sisipkanParagrafBukti(rtf, paragrafUntukNaskah(hasil));
    const teks = teksDari(h.rtf).join("\n");
    for (const p of hasil.perluDisetujui) expect(teks).not.toContain(p.bunyi);
    expect(h.disisipkan.length).toBe(hasil.paragraf.filter((p) => p.cara === "otomatis").length);
    expect(teks).not.toMatch(/aleta/i);
  });
});

describe("kode naskah rekonvensi (PK, TK, PR, TR)", () => {
  const NILAI_PK1 = "- Bahwa bukti PK.1/TR.1 berupa fotokopi Kartu Tanda Penduduk Pemohon merupakan identitas resmi penduduk;";
  const NILAI_PK2 = "- Bahwa bukti PK.2/TR.2 berupa fotokopi Kutipan Akta Nikah merupakan bukti utama perkawinan;";
  const SARING = "Menimbang, bahwa untuk membuktikan dalil permohonannya, Pemohon telah mengajukan bukti tertulis PK.1/TR.1 sampai dengan PK.2/TR.2;";

  it("kode dua huruf dibaca sebagai bukti: PK sama dengan P, TK sama dengan T, PR dan TR berdiri sendiri", () => {
    expect([...kodeDisebut("bukti PK.1 dan TK.2")].sort()).toEqual(["P.1", "T.2"]);
    expect([...kodeDisebut("bukti PR.1 dan TR.2")].sort()).toEqual(["PR.1", "TR.2"]);
    expect([...kodeDisebut("bukti PK.1/TR.1")].sort()).toEqual(["P.1", "TR.1"]);
    // Urutan pasangan dibalik: kode kedua tidak hilang karena didahului garis miring.
    expect([...kodeDisebut("bukti TR.3/PK.3")].sort()).toEqual(["P.3", "TR.3"]);
    expect([...kodeDisebut("bukti PK.1/TR.1 sampai dengan PK.3/TR.3")].sort()).toEqual(["P.1", "P.2", "P.3", "TR.1", "TR.2", "TR.3"]);
    expect([...kodeDisebut("bukti PR.1 sampai PR.3")].sort()).toEqual(["PR.1", "PR.2", "PR.3"]);
    expect(kodeDisebut("bukti PK.1 sampai TR.3").has("P.2")).toBe(false);
  });

  it("kode P dan T biasa tidak berubah: garis miring biasa tidak dipasangkan, nomor surat dan huruf menempel tetap diabaikan", () => {
    expect([...kodeDisebut("bukti P.1/T.1")]).toEqual(["P.1"]);
    expect([...kodeDisebut("bukti P.1/P.2")]).toEqual(["P.1"]);
    expect([...kodeDisebut("bukti P.1 sampai P.3")].sort()).toEqual(["P.1", "P.2", "P.3"]);
    expect([...kodeDisebut("Nomor 445/PK.1/2026, SPK.2, BPR.3, KTR.4 dan XTK.5")]).toEqual([]);
  });

  it("jangkar dan penanda sudah ada dikenali pada naskah berkode PK/TR", () => {
    const teks = [...DUDUK, SARING, NILAI_PK1, NILAI_PK2, ...AKHIR];
    const b = bacaBagianNaskah(teks);
    expect(teks[b.jangkar]).toBe(NILAI_PK2);
    expect(b.disebut.has("P.1") && b.disebut.has("P.2")).toBe(true);
  });

  it("paragraf baru masuk sesudah penilaian bukti terakhir; yang sudah disebut dengan kode PK tidak digandakan", () => {
    const rtf = naskah([SARING, NILAI_PK1, NILAI_PK2]);
    const h = sisipkanParagrafBukti(rtf, [{ kode: "P.2", bunyi: "Menimbang, bahwa alat bukti P.2 baru;" }, P3]);
    expect(h.sudahAda).toEqual(["P.2"]);
    expect(h.disisipkan).toEqual(["P.3"]);
    expect(h.tidakDisisip).toEqual([]);
    const sebelum = teksDari(rtf);
    const sesudah = teksDari(h.rtf);
    expect(sesudah.length).toBe(sebelum.length + 1);
    expect(sesudah[sebelum.indexOf(NILAI_PK2) + 1]).toBe(P3.bunyi);
    expect(selisihKurungRtf(h.rtf)).toBe(selisihKurungRtf(rtf));
    // Diulang: tidak pernah ganda.
    const lagi = sisipkanParagrafBukti(h.rtf, [P3]);
    expect(lagi.disisipkan).toEqual([]);
    expect(lagi.rtf).toBe(h.rtf);
  });

  it("kode calon berawalan PK, TK, PR, TR dikenali dan diurut sesudah P dan T", () => {
    const rtf = naskah([SARING, NILAI_PK1, NILAI_PK2]);
    const h = sisipkanParagrafBukti(rtf, [
      { kode: "TR.4", bunyi: "Menimbang, bahwa alat bukti TR.4 begini;" },
      { kode: "PR.4", bunyi: "Menimbang, bahwa alat bukti PR.4 begini;" },
      { kode: "TK.4", bunyi: "Menimbang, bahwa alat bukti TK.4 begini;" },
      { kode: "PK.1", bunyi: "Menimbang, bahwa alat bukti PK.1 sudah ada;" },
    ]);
    expect(h.sudahAda).toEqual(["PK.1"]);
    expect(h.disisipkan).toEqual(["TK.4", "PR.4", "TR.4"]);
    expect(h.tidakDisisip).toEqual([]);
  });

  it("naskah rekonvensi tanpa jangkar tetap dibiarkan dengan sebab yang jelas", () => {
    const rtf = naskah([SARING]);
    const h = sisipkanParagrafBukti(rtf, [P3]);
    expect(h.rtf).toBe(rtf);
    expect(h.tidakDisisip).toEqual([{ kode: "P.3", sebab: SEBAB_SISIP.tanpaJangkar }]);
  });

  it("perkiraan dari teks alinea sama dengan hasil sisip", () => {
    const teks = [...DUDUK, SARING, NILAI_PK1, NILAI_PK2, ...AKHIR];
    const r = rencanakanSisipan(teks, [{ kode: "P.1", bunyi: "Menimbang, bahwa alat bukti P.1 begini;" }, P3]);
    expect(r.sudahAda).toEqual(["P.1"]);
    expect(r.akanMasuk).toEqual(["P.3"]);
  });
});
