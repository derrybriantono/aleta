// @vitest-environment jsdom
/**
 * Pertimbangan dari alat bukti perkara kebendaan: harta bersama (HB), kewarisan (KW), penetapan ahli waris (PAW), 7 Nov 2026.
 * Data rekaan: tanpa NIK, tanpa nama pihak nyata. Bunyi kartu harus berasal dari bahan blangko (docs/arahan/awan-f46-bahan-kebendaan.json):
 * alinea umum dari blangko, kalimat per kelompok dari cabang rumus variabel 4807/4808 (HB) dan 4829/4830 (KW).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BuktiAletaAbt } from "@/components/portal/bukti-aleta-abt";
import type { BarisBukti } from "@/lib/bukti-tertulis";
import { kalimatBaris } from "@/lib/bukti-tertulis";
import {
  adaKalimatBantahan,
  bacaKeadaan,
  jenisKebendaan,
  jenisPerkaraBukti,
  KARTU_PERTIMBANGAN,
  permohonanBukti,
  susunParagrafBukti,
  type BuktiMasuk,
  type JenisPerkaraBukti,
  type MasukanPertimbangan,
} from "@/lib/sinkron-pertimbangan-bukti";

const bar = (nm: string, o: Partial<BarisBukti> = {}): BarisBukti => ({ nm, an: "", no: "", tgl: "", oleh: "", meterai: 0, cocok: 0, manual: null, ...o });
const bk = (sisi: "P" | "T", nomor: number, nm: string, o: Partial<BarisBukti> = {}, lain: Partial<BuktiMasuk> = {}): BuktiMasuk => ({ sisi, nomor, baris: bar(nm, o), ...lain });
const dasar = (jenisPerkara: JenisPerkaraBukti, bukti: BuktiMasuk[], o: Partial<MasukanPertimbangan> = {}): MasukanPertimbangan => ({
  jenisPerkara,
  status: "Dikabulkan",
  verstek: false,
  lawanHadir: true,
  lawanMembantah: false,
  agendaPembuktianKe: 1,
  bukti,
  ...o,
});
const verstek = (jenisPerkara: JenisPerkaraBukti, bukti: BuktiMasuk[], o: Partial<MasukanPertimbangan> = {}) => dasar(jenisPerkara, bukti, { verstek: true, lawanHadir: false, ...o });
const teks = (m: MasukanPertimbangan) => susunParagrafBukti(m).paragraf.map((p) => p.bunyi).join("\n");
const tanpaPenandaMentah = (t: string) => expect(t).not.toMatch(/#\d+#|\{\w+\}|\[\[|\{\{|\.{3,}/);

/** Bukti harta bersama rekaan, urutan blangko: KTP, KK, nikah, akta cerai, sertifikat, BPKB, rekening, foto, surat lain. */
const buktiHb = (): BuktiMasuk[] => [
  bk("P", 1, "Kartu Tanda Penduduk", { an: "Penggugat Uji" }),
  bk("P", 2, "Kartu Keluarga"),
  bk("P", 3, "Kutipan Akta Nikah"),
  bk("P", 4, "Akta Cerai"),
  bk("P", 5, "Sertifikat Hak Milik"),
  bk("P", 6, "Buku Pemilik Kendaraan Bermotor (BPKB)"),
  bk("P", 7, "Rekening Koran"),
  bk("P", 8, "Foto Rumah"),
  bk("P", 9, "Surat Keterangan Usaha"),
];
const buktiKw = (): BuktiMasuk[] => [
  bk("P", 1, "Kartu Tanda Penduduk"),
  bk("P", 2, "Kartu Keluarga"),
  bk("P", 3, "Kutipan Akta Kematian", { an: "Pewaris Uji" }),
  bk("P", 4, "Kutipan Akta Nikah"),
  bk("P", 5, "Kutipan Akta Kelahiran"),
  bk("P", 6, "Surat Keterangan Ahli Waris"),
  bk("P", 7, "Sertifikat Hak Milik"),
  bk("P", 8, "Buku Tabungan"),
  bk("P", 9, "Foto Peninggalan"),
  bk("P", 10, "Surat Utang Piutang Lama"),
];

describe("jenis perkara kebendaan dan keadaan", () => {
  it("membaca jenis perkara dari teks SIPP; wasiat, hibah, wakaf belum punya bunyi; cerai tidak berubah", () => {
    expect(jenisPerkaraBukti("Harta Bersama")).toBe("HB");
    expect(jenisPerkaraBukti("Kewarisan")).toBe("KW");
    expect(jenisPerkaraBukti("Penetapan Ahli Waris")).toBe("PAW");
    expect(jenisPerkaraBukti("P3HP/Penetapan Ahli Waris")).toBe("PAW");
    for (const j of ["Wasiat", "Hibah", "Wakaf", ""]) expect(jenisPerkaraBukti(j)).toBeNull();
    expect(jenisPerkaraBukti("Cerai Gugat")).toBe("CG");
    expect(jenisPerkaraBukti("Cerai Talak")).toBe("CT");
    expect(jenisPerkaraBukti("Dispensasi Kawin")).toBe("DK");
    expect(jenisPerkaraBukti("Itsbat Nikah")).toBe("IN");
  });
  it("hanya penetapan ahli waris yang permohonan; kalimat bantahan hanya cerai", () => {
    expect(permohonanBukti("PAW")).toBe(true);
    expect(permohonanBukti("HB")).toBe(false);
    expect(permohonanBukti("KW")).toBe(false);
    expect(adaKalimatBantahan("CG")).toBe(true);
    for (const j of ["HB", "KW", "PAW", "IN", "DK"] as const) expect(adaKalimatBantahan(j)).toBe(false);
  });
  it("dikabulkan sebagian memakai keadaan dikabulkan; ditolak tidak terkena", () => {
    expect(bacaKeadaan("Dikabulkan sebagian", false).kunci).toBe("kabul");
    expect(bacaKeadaan("Dikabulkan sebagian", true).kunci).toBe("kabul-verstek");
    expect(bacaKeadaan("Dikabulkan sebagian", false, true).kunci).toBe("kabul");
    expect(bacaKeadaan("Dikabulkan sebagian", false).teks).toMatch(/sebagian/);
    expect(bacaKeadaan("Ditolak", false).kunci).toBe("tolak");
    expect(bacaKeadaan("Dikabulkan", false).kunci).toBe("kabul");
  });
  it("golongan bukti harta bersama menirukan urutan CASE rumus 4807", () => {
    const g = (nm: string) => jenisKebendaan(nm, "HB");
    expect(g("Kartu Tanda Penduduk")).toBe("kb-ktp");
    expect(g("Kartu Keluarga")).toBe("kb-kk");
    expect(g("Kutipan Akta Nikah")).toBe("kb-nikah");
    expect(g("Akta Cerai")).toBe("kb-cerai");
    expect(g("Putusan Pengadilan Agama")).toBe("kb-cerai");
    expect(g("Sertifikat Hak Milik")).toBe("kb-tanah");
    expect(g("Fotokopi Sertifikat")).toBe("kb-tanah");
    expect(g("Buku Pemilik Kendaraan Bermotor (BPKB)")).toBe("kb-kendaraan");
    expect(g("Rekening Koran")).toBe("kb-uang");
    expect(g("Kwitansi")).toBe("kb-uang");
    expect(g("Surat Keterangan Usaha")).toBe("kb-lain");
    // urutan: foto menang atas rumah dan kendaraan; kendaraan menang atas tanah; tanah menang atas uang
    expect(g("Foto Rumah")).toBe("kb-foto");
    expect(g("Foto, Kendaraan")).toBe("kb-foto");
    expect(g("Tangkapan layar rekening")).toBe("kb-foto");
    expect(g("Faktur rumah")).toBe("kb-kendaraan");
    expect(g("Kwitansi pembelian rumah")).toBe("kb-tanah");
    expect(g("Kartu Keluarga di bank")).toBe("kb-kk");
  });
  it("golongan bukti kewarisan menirukan urutan CASE rumus 4829; tanah dan kendaraan satu golongan", () => {
    const g = (nm: string) => jenisKebendaan(nm, "KW");
    expect(g("Kutipan Akta Kematian")).toBe("kb-mati");
    expect(g("Surat Keterangan Meninggal Dunia")).toBe("kb-mati");
    expect(g("Kutipan Akta Nikah")).toBe("kb-nikah");
    expect(g("Kutipan Akta Kelahiran")).toBe("kb-lahir");
    expect(g("Surat Keterangan Ahli Waris")).toBe("kb-silsilah");
    expect(g("Surat Pernyataan Silsilah")).toBe("kb-silsilah");
    expect(g("Buku Tabungan")).toBe("kb-uang");
    expect(g("Kartu Peserta BPJS")).toBe("kb-uang");
    expect(g("BPKB")).toBe("kb-tanah");
    expect(g("Sertifikat Hak Milik")).toBe("kb-tanah");
    expect(g("Akta Cerai")).toBe("kb-lain");
    expect(g("Foto Peninggalan")).toBe("kb-foto");
    expect(jenisKebendaan("apa saja", "PAW")).toBe("kb-surat");
  });
});

describe("harta bersama, lawan tidak hadir (verstek)", () => {
  it("tiap kelompok surat yang punya kalimat di rumus 4807 ditulis otomatis dengan daftar kodenya", () => {
    const h = susunParagrafBukti(verstek("HB", buktiHb(), { status: "Dikabulkan" }));
    expect(h.keadaan).toBe("Dikabulkan, lawan tidak hadir (verstek)");
    const oto = h.paragraf.filter((p) => p.cara === "otomatis");
    expect(oto.map((p) => p.kode)).toEqual(["P.1, P.2, P.3, P.4, P.5, P.6 dan P.7", "P.1", "P.2", "P.3", "P.4", "P.5", "P.6", "P.7"]);
    const t = oto.map((p) => p.bunyi).join("\n");
    expect(t).toContain("Menimbang, bahwa bukti-bukti surat yang diajukan Penggugat telah bermeterai cukup dan dinazegelen sesuai Pasal 3 ayat (1) huruf b");
    expect(t).toContain("sebagaimana Pasal 285 RBg/Pasal 165 HIR;");
    expect(t).toContain("Menimbang, bahwa bukti P.1 (Kartu Tanda Penduduk) telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, merupakan akta otentik");
    expect(t).toContain("yang membuktikan identitas dan tempat tinggal para pihak;");
    expect(t).toContain("yang membuktikan susunan keluarga dan tempat tinggal para pihak;");
    expect(t).toContain("yang membuktikan adanya perkawinan yang sah antara Penggugat dan Tergugat sehingga masa perkawinan dihitung sejak tanggal perkawinan tersebut;");
    expect(t).toContain("bukti P.4 (akta cerai atau putusan perceraian)");
    expect(t).toContain("harta bersama dapat dibagi sesuai Pasal 37 Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 97 Kompilasi Hukum Islam;");
    expect(t).toContain("bukti P.5 (surat-surat hak atas tanah dan bangunan)");
    expect(t).toContain("nama yang tercatat dalam bukti tersebut tidak menentukan status objek sebagai harta bersama");
    expect(t).toContain("bukti P.6 (surat-surat kendaraan bermotor)");
    expect(t).toContain("bukti P.7 (surat-surat keuangan, perbankan atau tanda pembayaran)");
    expect(t).toContain("kekuatan pembuktiannya bergantung pada pengakuan pihak lawan dan persesuaiannya dengan alat bukti lain sebagaimana Pasal 288 RBg/Pasal 1875 Kitab Undang-Undang Hukum Perdata");
    tanpaPenandaMentah(t);
    expect(h.paragraf.every((p) => !/aleta/i.test(p.bunyi + p.asal))).toBe(true);
  });
  it("foto dan surat lain adalah pelengkap: hanya usulan, dengan bunyi rumus", () => {
    const h = susunParagrafBukti(verstek("HB", buktiHb()));
    const usulan = h.paragraf.filter((p) => p.cara === "usulan");
    expect(usulan.map((p) => `${p.kode}:${p.kunci}`)).toEqual(["P.8:kb-foto", "P.9:kb-lain"]);
    expect(usulan[0].bunyi).toContain("Menimbang, bahwa bukti P.8 (foto, tangkapan layar atau rekaman) merupakan bukti elektronik yang sah");
    expect(usulan[0].bunyi).toContain("Undang-Undang Nomor 1 Tahun 2024");
    expect(usulan[1].bunyi).toBe("Menimbang, bahwa bukti P.9 telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, serta relevan dengan dalil yang hendak dibuktikan oleh Penggugat dan Tergugat;");
  });
  it("rujukan menyebut rumus dan berkas verstek folder harta bersama", () => {
    const h = susunParagrafBukti(verstek("HB", buktiHb()));
    expect(h.paragraf[1].asal).toBe("Rumus variabel 4807 (cabang k1), dipanggil di 4a Harta Bersama, [01b] [Kabul Verstek] HB.rtf, alinea 4");
    expect(h.paragraf[0].asal).toBe("4a Harta Bersama, [01b] [Kabul Verstek] HB.rtf, alinea 4");
    const tolak = susunParagrafBukti(verstek("HB", buktiHb(), { status: "Ditolak" }));
    expect(tolak.paragraf[0].asal).toContain("[03b] [Tolak Verstek] HB");
  });
  it("ditolak verstek memakai kartu yang sama; bukti sisi lawan dicatat tanpa bunyi", () => {
    const b = [...buktiHb(), bk("T", 1, "Sertifikat Hak Guna Bangunan")];
    const h = susunParagrafBukti(verstek("HB", b, { status: "Ditolak" }));
    expect(h.keadaan).toBe("Ditolak, lawan tidak hadir (verstek)");
    expect(h.paragraf.some((p) => /Menimbang, bahwa bukti P.5 \(surat-surat hak atas tanah/.test(p.bunyi))).toBe(true);
    expect(h.paragraf.some((p) => p.kode.includes("T.1"))).toBe(false);
    expect(h.belumAdaBunyi.find((x) => x.kode === "T.1")?.alasan).toBe("Pada verstek lawan tidak hadir, blangko tidak memuat bukti sisi lawan.");
  });
  it("lawan membantah tidak mengubah paragraf harta bersama (blangko tidak punya kalimat bantahan)", () => {
    expect(teks(verstek("HB", buktiHb(), { lawanMembantah: true }))).toBe(teks(verstek("HB", buktiHb())));
    expect(teks(dasar("HB", buktiHb(), { lawanMembantah: true }))).toBe(teks(dasar("HB", buktiHb())));
  });
});

describe("harta bersama, kontradiktoir", () => {
  const dua = (): BuktiMasuk[] => [
    bk("P", 1, "Kartu Tanda Penduduk"),
    bk("P", 2, "Sertifikat Hak Milik"),
    bk("T", 1, "Kartu Tanda Penduduk"),
    bk("T", 2, "Sertifikat Hak Guna Bangunan"),
  ];
  it("dikabulkan: pertimbangan formil Penggugat, akta kedua pihak, penunjukan mutatis mutandis untuk Tergugat, lalu kelompok per sisi", () => {
    const h = susunParagrafBukti(dasar("HB", dua()));
    const oto = h.paragraf.filter((p) => p.cara === "otomatis");
    expect(oto.map((p) => p.kode)).toEqual(["P.1 dan P.2", "P.1, P.2, T.1 dan T.2", "P.1", "P.2", "T.1 dan T.2", "T.1", "T.2"]);
    const t = oto.map((p) => p.bunyi);
    expect(t[0]).toBe(
      "Menimbang, bahwa bukti-bukti surat Penggugat telah bermeterai cukup dan telah dinazegelen sesuai Pasal 3 ayat (1) huruf b, Pasal 5 serta Pasal 28 huruf b dan huruf c Undang-Undang Nomor 10 Tahun 2020 tentang Bea Meterai, dan yang berupa fotokopi telah dicocokkan dan sesuai dengan aslinya sebagaimana ketentuan Pasal 1888 Kitab Undang-Undang Hukum Perdata, sehingga bukti-bukti tersebut patut dipertimbangkan lebih lanjut;"
    );
    expect(t[1]).toContain("merupakan akta otentik yang mempunyai kekuatan pembuktian sempurna dan mengikat (volledig en bindende bewijskracht) sesuai Pasal 285 RBg/Pasal 165 HIR jo. Pasal 1868");
    expect(t[4]).toBe("Menimbang, bahwa terhadap syarat formil dan materiil bukti surat dan saksi-saksi Tergugat, Majelis Hakim menunjuk pertimbangan alat bukti Penggugat di atas yang berlaku secara mutatis mutandis dalam pertimbangan ini;");
    expect(t[5]).toContain("bukti T.1 (Kartu Tanda Penduduk)");
    expect(h.paragraf.find((p) => p.kode === "T.1 dan T.2")?.asal).toContain("Periksa: kalimat blangko ini juga menyebut saksi-saksi pihak lawan");
    tanpaPenandaMentah(t.join("\n"));
  });
  it("pasal acara mengikuti hukum acara: HIR dan RBg", () => {
    const hir = teks(dasar("HB", dua(), { konteks: { hukumAcara: "HIR", majelis: "Majelis Hakim" } }));
    expect(hir).toContain("sesuai Pasal 165 HIR jo. Pasal 1868");
    expect(hir).toContain("sebagaimana Pasal 1875 Kitab Undang-Undang Hukum Perdata;");
    expect(hir).not.toContain("RBg");
    const rbg = teks(dasar("HB", dua(), { konteks: { hukumAcara: "RBg" } }));
    expect(rbg).toContain("sesuai Pasal 285 RBg jo. Pasal 1868");
    expect(rbg).toContain("sebagaimana Pasal 288 RBg;");
  });
  it("sebutan majelis dan Penggugat dalam kalimat Tergugat mengikuti konteks", () => {
    const t = teks(dasar("HB", dua(), { konteks: { majelis: "Hakim" } }));
    expect(t).toContain("saksi-saksi Tergugat, Hakim menunjuk pertimbangan");
  });
  it("dikabulkan sebagian sama dengan dikabulkan dan memberi catatan", () => {
    const sebagian = susunParagrafBukti(dasar("HB", dua(), { status: "Dikabulkan sebagian" }));
    expect(sebagian.paragraf.map((p) => p.bunyi)).toEqual(susunParagrafBukti(dasar("HB", dua())).paragraf.map((p) => p.bunyi));
    expect(sebagian.keadaan).toBe("Dikabulkan sebagian, lawan hadir");
    expect(sebagian.catatan.join(" ")).toMatch(/Dikabulkan sebagian/);
  });
  it("ditolak: satu paragraf penilaian kedua pihak dan satu paragraf akta, lalu kelompok", () => {
    const h = susunParagrafBukti(dasar("HB", dua(), { status: "Ditolak" }));
    const t = h.paragraf.map((p) => p.bunyi);
    expect(h.paragraf[0].kode).toBe("P.1, P.2, T.1 dan T.2");
    expect(t[0]).toContain("Menimbang, bahwa terhadap bukti surat yang diajukan para pihak, secara keseluruhan bukti-bukti tersebut telah bermeterai cukup dan telah dilakukan pemeteraian kemudian (nazegelen)");
    expect(t[1]).toContain("fotokopi yang tidak dapat dicocokkan dengan aslinya dinilai secara terbatas sebagai bukti permulaan;");
    expect(t.slice(2).some((x) => x.startsWith("Menimbang, bahwa bukti T.2 (surat-surat hak atas tanah dan bangunan)"))).toBe(true);
    expect(h.catatan[0]).toMatch(/tanpa menyimpulkan/);
    expect(h.paragraf[0].asal).toContain("[03] [Tolak] HB");
  });
  it("bukti elektronik hanya pada dikabulkan dengan lawan hadir, satu usulan untuk kedua pihak", () => {
    const el = (sisi: "P" | "T", nomor: number): BuktiMasuk => ({ sisi, nomor, elektronik: true, periksaEl: 1, baris: bar("Tangkapan layar percakapan", { manual: null }) });
    const b = [...dua(), el("P", 3), el("T", 3)];
    const h = susunParagrafBukti(dasar("HB", b));
    const e = h.paragraf.filter((p) => p.kunci === "elektronik");
    expect(e).toHaveLength(1);
    expect(e[0].cara).toBe("usulan");
    expect(e[0].kode).toBe("P.3 dan T.3");
    expect(e[0].bunyi).toContain("Menimbang, bahwa bukti elektronik yang diajukan para pihak berupa hasil cetak Informasi dan/atau Dokumen Elektronik");
    const ditolak = susunParagrafBukti(dasar("HB", b, { status: "Ditolak" }));
    expect(ditolak.paragraf.some((p) => p.kunci === "elektronik")).toBe(false);
    expect(ditolak.belumAdaBunyi.find((x) => x.kode === "P.3")?.alasan).toMatch(/dikabulkan dengan lawan hadir/);
  });
  it("tanpa asli, meterai kurang, pencocokan dari fotokopi, bukti disunting: tidak dikarang", () => {
    const b = dua();
    b[1].baris.cocok = 1;
    b[2].baris.meterai = 1;
    const h = susunParagrafBukti(dasar("HB", b));
    expect(h.paragraf.find((p) => p.kode === "P.2" && /tidak dapat dicocokkan/.test(p.bunyi))?.bunyi).toBe("- Bahwa bukti P.2 adalah fotokopi yang tidak dapat dicocokkan dengan aslinya;");
    expect(h.paragraf.some((p) => /Menimbang, bahwa bukti P.2 \(surat-surat hak atas tanah/.test(p.bunyi))).toBe(false);
    expect(h.belumAdaBunyi.find((x) => x.kode === "T.1")?.alasan).toBe("Blangko hanya memuat bunyi bukti bermeterai cukup dan dinazegelen.");
    const c = dua();
    c[0].baris.cocok = 2;
    c[3].baris.manual = "Surat tulisan sendiri";
    const hc = susunParagrafBukti(dasar("HB", c));
    expect(hc.belumAdaBunyi.find((x) => x.kode === "P.1")?.alasan).toBe("Blangko tidak memuat bunyi pencocokan dari fotokopi atau dari kopian sebelumnya.");
    expect(hc.belumAdaBunyi.find((x) => x.kode === "T.2")?.alasan).toBe("Bukti disunting bebas, bunyi blangko tidak berlaku.");
    expect(hc.paragraf.some((p) => p.kode === "T.2")).toBe(false);
  });
  it("bukti kode rekonvensi memakai sisi dari kodenya dan kode apa adanya", () => {
    const b: BuktiMasuk[] = [bk("P", 1, "Kartu Tanda Penduduk", {}, { kode: "PK.1" }), bk("T", 1, "Sertifikat Hak Milik", {}, { kode: "PR.1" })];
    const h = susunParagrafBukti(dasar("HB", b));
    expect(h.paragraf.map((p) => p.kode)).toContain("PK.1");
    expect(h.paragraf.map((p) => p.kode)).toContain("PR.1");
  });
});

describe("harta bersama: tidak dapat diterima, gugur, perdamaian, dicabut", () => {
  it("tidak dapat diterima tidak punya bunyi per bukti di blangko", () => {
    const h = susunParagrafBukti(dasar("HB", buktiHb(), { status: "Tidak Dapat Diterima" }));
    expect(h.paragraf).toEqual([]);
    expect(h.belumAdaBunyi).toHaveLength(9);
    expect(h.belumAdaBunyi[0].alasan).toBe("Blangko Tidak Dapat Diterima tidak memuat bunyi per alat bukti.");
  });
  it("gugur, digugurkan, perdamaian: kosong", () => {
    for (const status of ["Gugur", "Digugurkan", "Perdamaian"]) {
      const h = susunParagrafBukti(dasar("HB", buktiHb(), { status }));
      expect(h.paragraf).toEqual([]);
      expect(h.belumAdaBunyi).toEqual([]);
    }
  });
  it("dicabut menurut agenda: sebelum dan pada pembuktian pertama kosong, pada kedua bukti agenda lama menjadi usulan", () => {
    const b: BuktiMasuk[] = [bk("P", 1, "Kartu Tanda Penduduk", {}, { agendaKe: 1 }), bk("P", 2, "Sertifikat Hak Milik", {}, { agendaKe: 1 }), bk("P", 3, "Kartu Keluarga", {}, { agendaKe: 2 })];
    expect(susunParagrafBukti(dasar("HB", b, { status: "Dicabut", agendaPembuktianKe: 0 })).paragraf).toEqual([]);
    expect(susunParagrafBukti(dasar("HB", b, { status: "Dicabut", agendaPembuktianKe: 1 })).paragraf).toEqual([]);
    const h = susunParagrafBukti(dasar("HB", b, { status: "Dicabut", agendaPembuktianKe: 2 }));
    expect(h.paragraf.length).toBeGreaterThan(0);
    expect(h.paragraf.every((p) => p.cara === "usulan")).toBe(true);
    expect(h.paragraf.some((p) => p.kode.includes("P.3"))).toBe(false);
    expect(h.paragraf.map((p) => p.kode)).toContain("P.1");
  });
});

describe("kewarisan", () => {
  it("lawan tidak hadir: kelompok per jenis dari rumus 4829 dengan bunyi kewarisan", () => {
    const h = susunParagrafBukti(verstek("KW", buktiKw(), { konteks: { isian: { pewaris: "Pewaris Uji bin Fulan" } } }));
    const oto = h.paragraf.filter((p) => p.cara === "otomatis");
    expect(oto.map((p) => p.kode)).toEqual(["P.1, P.2, P.3, P.4, P.5, P.6, P.7 dan P.8", "P.1", "P.2", "P.3", "P.4", "P.5", "P.6", "P.7", "P.8"]);
    const t = oto.map((p) => p.bunyi).join("\n");
    expect(t).toContain("yang membuktikan identitas dan tempat tinggal pihak yang bersangkutan;");
    expect(t).toContain("yang membuktikan susunan keluarga dan hubungan para pihak dengan pewaris;");
    expect(t).toContain("bukti P.3 (akta atau surat keterangan kematian)");
    expect(t).toContain("yang membuktikan telah meninggalnya Almarhum Pewaris Uji bin Fulan sebagai pewaris sehingga warisan terbuka;");
    expect(t).toContain("yang membuktikan adanya perkawinan yang sah antara pewaris dengan pasangannya;");
    expect(t).toContain("yang membuktikan hubungan nasab anak dengan orang tuanya;");
    expect(t).toContain("bukti P.6 (surat keterangan atau penetapan tentang ahli waris dan silsilah)");
    expect(t).toContain("nama yang tercatat dalam bukti tersebut tidak menentukan objek sebagai harta peninggalan pewaris");
    expect(t).toContain("bukti P.8 (surat-surat keuangan, perbankan, jaminan sosial atau tanda pembayaran)");
    tanpaPenandaMentah(t);
    expect(h.paragraf.filter((p) => p.cara === "usulan").map((p) => p.kode)).toEqual(["P.9", "P.10"]);
    expect(h.paragraf[1].asal).toContain("Rumus variabel 4829 (cabang k1), dipanggil di 4b Kewarisan");
    expect(h.paragraf[0].asal).toContain("[01b] [Kabul Verstek] Kewarisan.rtf");
  });
  it("pewaris perempuan memakai Almarhumah; tanpa isian pewaris anak kalimat dihapus, bukan ditebak", () => {
    const t1 = teks(verstek("KW", buktiKw(), { konteks: { isian: { pewaris: "Pewaris Uji binti Fulan" } } }));
    expect(t1).toContain("meninggalnya Almarhumah Pewaris Uji binti Fulan sebagai pewaris");
    const t0 = teks(verstek("KW", buktiKw()));
    expect(t0).toContain("bukti P.3 (akta atau surat keterangan kematian) telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, merupakan akta otentik yang mempunyai kekuatan pembuktian sempurna dan mengikat (volledig bidende bewijskracht) sesuai Pasal 285 RBg/Pasal 165 HIR jo. Pasal 1868 Kitab Undang-Undang Hukum Perdata;");
    expect(t0).not.toContain("meninggalnya");
    expect(t0).not.toContain("Almarhum");
  });
  it("kontradiktoir dikabulkan: pertimbangan bukti para pihak, akta, lalu kelompok kedua sisi", () => {
    const b = [bk("P", 1, "Kartu Tanda Penduduk"), bk("P", 2, "Sertifikat Hak Milik"), bk("T", 1, "Kartu Tanda Penduduk"), bk("T", 2, "Buku Tabungan")];
    const h = susunParagrafBukti(dasar("KW", b));
    expect(h.paragraf.slice(0, 2).map((p) => p.kode)).toEqual(["P.1, P.2, T.1 dan T.2", "P.1, P.2, T.1 dan T.2"]);
    expect(h.paragraf[0].bunyi).toContain("Menimbang, bahwa terhadap bukti surat yang diajukan para pihak, secara keseluruhan bukti-bukti tersebut telah bermeterai cukup");
    expect(h.paragraf[1].bunyi).toContain("sebagaimana dimaksud Pasal 1868 Kitab Undang-Undang Hukum Perdata, Majelis Hakim pada asasnya melekatkan kekuatan pembuktian");
    expect(h.paragraf[0].asal).toContain("4b Kewarisan, [01] [Kabul] Kewarisan - Kontradiktoir.rtf");
    expect(h.paragraf.some((p) => /^Menimbang, bahwa bukti T\.2 \(surat-surat keuangan, perbankan, jaminan sosial/.test(p.bunyi))).toBe(true);
    // kewarisan tidak punya kalimat bukti elektronik: elektronik dicatat
    const el: BuktiMasuk = { sisi: "P", nomor: 3, elektronik: true, periksaEl: 1, baris: bar("Tangkapan layar", { manual: null }) };
    const he = susunParagrafBukti(dasar("KW", [...b, el]));
    expect(he.belumAdaBunyi.find((x) => x.kode === "P.3")?.alasan).toBe("Blangko kewarisan dan penetapan ahli waris tidak memuat bunyi bukti elektronik terpisah.");
  });
  it("ditolak, ditolak verstek, dikabulkan sebagian", () => {
    const b = [bk("P", 1, "Kartu Tanda Penduduk"), bk("P", 2, "Kutipan Akta Kematian")];
    expect(susunParagrafBukti(dasar("KW", b, { status: "Ditolak" })).paragraf[0].asal).toContain("[03] [Tolak] Kewarisan");
    expect(susunParagrafBukti(verstek("KW", b, { status: "Ditolak" })).paragraf[0].asal).toContain("[03b] [Tolak Verstek] Kewarisan");
    expect(teks(dasar("KW", b, { status: "Dikabulkan sebagian" }))).toBe(teks(dasar("KW", b)));
  });
  it("tidak dapat diterima, gugur, perdamaian, dicabut menurut agenda", () => {
    expect(susunParagrafBukti(dasar("KW", buktiKw(), { status: "Tidak Dapat Diterima" })).paragraf).toEqual([]);
    expect(susunParagrafBukti(dasar("KW", buktiKw(), { status: "Gugur" })).paragraf).toEqual([]);
    expect(susunParagrafBukti(dasar("KW", buktiKw(), { status: "Perdamaian" })).paragraf).toEqual([]);
    const b: BuktiMasuk[] = [bk("P", 1, "Kartu Tanda Penduduk", {}, { agendaKe: 1 }), bk("P", 2, "Kartu Keluarga", {}, { agendaKe: 2 })];
    expect(susunParagrafBukti(dasar("KW", b, { status: "Dicabut", agendaPembuktianKe: 1 })).paragraf).toEqual([]);
    const h = susunParagrafBukti(dasar("KW", b, { status: "Dicabut", agendaPembuktianKe: 2 }));
    expect(h.paragraf.length).toBeGreaterThan(0);
    expect(h.paragraf.every((p) => p.cara === "usulan" && !p.kode.includes("P.2"))).toBe(true);
  });
});

describe("penetapan ahli waris", () => {
  const b = (): BuktiMasuk[] => [bk("P", 1, "Kartu Tanda Penduduk"), bk("P", 2, "Kartu Keluarga"), bk("P", 3, "Kutipan Akta Kematian")];
  it("dikabulkan: hanya pertimbangan umum bukti tertulis; sebutan para Pemohon mengikuti jumlah", () => {
    const h = susunParagrafBukti(dasar("PAW", b()));
    expect(h.paragraf).toHaveLength(1);
    expect(h.paragraf[0].cara).toBe("otomatis");
    expect(h.paragraf[0].kode).toBe("P.1, P.2 dan P.3");
    expect(h.paragraf[0].bunyi).toBe(
      "Menimbang, bahwa untuk menguatkan dalil permohonannya para Pemohon telah mengajukan bukti-bukti tertulis berupa fotokopi bermeterai cukup, maka Majelis Hakim menilai alat bukti tersebut sah sebagai alat bukti berdasarkan Pasal 3 ayat (1) jo. Pasal 5 Undang-Undang Nomor 10 Tahun 2020 tentang Bea Meterai jo. Surat Edaran Direktorat Jenderal Badan Peradilan Agama Nomor 1 Tahun 2021 tentang Penyesuaian Bea Meterai di Lingkungan Peradilan Agama;"
    );
    expect(h.paragraf[0].asal).toContain("9 Penetapan Ahli Waris, [01] [Kabul] PAW");
    expect(teks(dasar("PAW", b(), { konteks: { jumlahPemohon: 1 } }))).toContain("dalil permohonannya Pemohon telah mengajukan");
    expect(h.belumAdaBunyi.map((x) => x.kode)).toEqual(["P.1", "P.2", "P.3"]);
    expect(h.belumAdaBunyi[0].alasan).toMatch(/terikat susunan ahli waris tertentu/);
    expect(h.catatan.join(" ")).toMatch(/anak kandung, pasangan dan orang tua pewaris telah meninggal/);
  });
  it("ditolak: pertimbangan formil bukti surat; verstek dan lawan tidak berlaku", () => {
    const h = susunParagrafBukti(dasar("PAW", b(), { status: "Ditolak" }));
    expect(h.paragraf).toHaveLength(1);
    expect(h.paragraf[0].bunyi).toBe(
      "Menimbang, bahwa bukti-bukti surat yang diajukan Pemohon merupakan fotokopi akta autentik dan surat yang dikeluarkan oleh pejabat yang berwenang, telah bermeterai cukup, telah dinazegelen dan dicocokkan dengan aslinya, sehingga memenuhi syarat formil dan materiil sebagai alat bukti dan mempunyai kekuatan pembuktian yang sempurna dan mengikat sebagaimana dimaksud Pasal 285 RBg/Pasal 165 HIR jo. Pasal 1870 KUH Perdata;"
    );
    expect(teks(verstek("PAW", b()))).toBe(teks(dasar("PAW", b())));
  });
  it("tanpa asli dicatat; tidak dapat diterima, gugur, dicabut kosong atau tanpa bunyi", () => {
    const c = b();
    c[1].baris.cocok = 1;
    const h = susunParagrafBukti(dasar("PAW", c));
    expect(h.paragraf.map((p) => p.bunyi)).toContain("- Bahwa bukti P.2 adalah fotokopi yang tidak dapat dicocokkan dengan aslinya;");
    expect(susunParagrafBukti(dasar("PAW", b(), { status: "Tidak Dapat Diterima" })).paragraf).toEqual([]);
    expect(susunParagrafBukti(dasar("PAW", b(), { status: "Gugur" })).paragraf).toEqual([]);
    expect(susunParagrafBukti(dasar("PAW", b(), { status: "Dicabut", agendaPembuktianKe: 1 })).paragraf).toEqual([]);
  });
});

describe("cerai, itsbat, dispensasi tidak berubah oleh kartu kebendaan", () => {
  it("kartu kebendaan tidak dipakai perkara lain, dan sebaliknya", () => {
    const b = [bk("P", 1, "Kartu Tanda Penduduk"), bk("P", 2, "Kutipan Akta Nikah")];
    for (const j of ["CG", "CT", "IN", "DK"] as const) {
      const h = susunParagrafBukti(dasar(j, b, j === "CG" || j === "CT" ? {} : { lawanHadir: false }));
      expect(h.paragraf.map((p) => p.asal).join(" "), j).not.toMatch(/Harta Bersama|Kewarisan|Ahli Waris|Rumus variabel/);
      expect(h.paragraf.map((p) => p.bunyi).join(" "), j).not.toMatch(/Menimbang, bahwa bukti P\.\d \(/);
    }
    const hb = susunParagrafBukti(dasar("HB", b));
    expect(hb.paragraf.map((p) => p.asal).join(" ")).not.toMatch(/Perceraian|Itsbat|Dispensasi/);
  });
  it("cerai gugat dengan bukti KTP dan nikah tetap menulis kalimat tidak dibantah", () => {
    const b = [bk("P", 1, "Kartu Tanda Penduduk"), bk("P", 2, "Kutipan Akta Nikah")];
    expect(teks(dasar("CG", b))).toContain("serta tidak dibantah kebenarannya oleh Tergugat");
    expect(teks(dasar("CG", b, { lawanMembantah: true }))).not.toContain("serta tidak dibantah kebenarannya oleh Tergugat");
  });
});

/* ---------------------------------------------------------------- kepatuhan: bunyi kartu berasal dari bahan */
type Bahan = { sumber: string; blangko: Array<{ folder: string; berkas: string; alineaBukti: string[] }>; variabel: Record<string, { nama: string; rumus: string; bawaan: string }> };
const berkasBahan = path.resolve(__dirname, "../../../docs/arahan/awan-f46-bahan-kebendaan.json");
const mentahBahan = readFileSync(berkasBahan, "utf8");
const bahan = JSON.parse(mentahBahan) as Bahan;
const KEBENDAAN = ["HB", "KW", "PAW"];
const KARTU_KB = KARTU_PERTIMBANGAN.filter((k) => k.perkara.some((j) => KEBENDAAN.includes(j)));
const FOLDER_PERKARA: Record<string, string> = { HB: "4a Harta Bersama", KW: "4b Kewarisan", PAW: "9 Penetapan Ahli Waris" };

/** Bentuk pembanding: penanda blangko dan penanda kartu dibawa ke satu bentuk. Berdiri sendiri dari penukar yang dipakai saat kartu dibuat. */
function bentukBlangko(t: string): string {
  return t
    .replace(/\s+/g, " ")
    .trim()
    .replace(/#(?:4807|4808|4829|4830|4848|4849)#/g, "")
    .replace(/Pasal #11886# #11851#/g, "<AKTA>")
    .replace(/#11897#/g, "<BAWAH>")
    .replace(/#8554#/g, "<MAJELIS>")
    .replace(/#0053#/g, "<PERKARA>")
    .replace(/#7036#/g, "<PARA><P>")
    .replace(/#0046#|\bPenggugat\b/g, "<P>")
    .replace(/#0047#|\bTergugat\b/g, "<T>")
    .replace(/#2026# #1025#/g, "<ALM> <PEWARIS>");
}
function bentukKartu(bunyi: string, sisi: string): string {
  const pihak = sisi === "T" ? "<T>" : "<P>";
  const lawan = sisi === "T" ? "<P>" : "<T>";
  return bunyi
    .replace(/\[\[([\s\S]*?)\]\]/g, "$1")
    .replace(/\{pihak\}/g, pihak)
    .replace(/\{lawan\}/g, lawan)
    .replace(/\{penggugat\}/g, "<P>")
    .replace(/\{tergugat\}/g, "<T>")
    .replace(/\{pasalAkta\}/g, "<AKTA>")
    .replace(/\{pasalBawahTangan\}/g, "<BAWAH>")
    .replace(/\{majelis\}/g, "<MAJELIS>")
    .replace(/\{perkara\}/g, "<PERKARA>")
    .replace(/\{para\}/g, "<PARA>")
    .replace(/\{almarhum\}/g, "<ALM>")
    .replace(/\{pewaris\}/g, "<PEWARIS>")
    .replace(/\{kode\}/g, "§");
}
const keadaanBerkas = (b: string) => {
  if (/\[Kabul Verstek\]/.test(b)) return "kabul-verstek";
  if (/\[Tolak Verstek\]/.test(b)) return "tolak-verstek";
  if (/\[Kabul\].*T Tidak Hadir Setelah Mediasi/.test(b)) return "kabul-verstek";
  if (/\[Kabul\]/.test(b)) return "kabul";
  if (/\[Tolak\]/.test(b)) return "tolak";
  if (/\[NO\]/.test(b)) return "tdt";
  return "";
};
/** Kalimat satu cabang rumus (setelah daftar kode), apa adanya dari bahan. */
function cabangRumus(no: string, cabang: string): string | null {
  const rumus = bahan.variabel[no].rumus;
  const blok = rumus.slice(0, rumus.indexOf("FROM (SELECT COUNT"));
  const re = new RegExp(`IF\\(p\\.${cabang} IS NULL, NULL, CONCAT\\("Menimbang, bahwa bukti ", IF\\(LOCATE[\\s\\S]*?\\)\\), "([\\s\\S]*?)"\\)\\)(?:,|\\)\\))`);
  return re.exec(blok)?.[1] ?? null;
}

describe("kepatuhan: bunyi kartu kebendaan berasal dari bahan blangko", () => {
  it("ada kartu untuk tiap perkara dan keadaan yang bunyinya ada di blangko; tidak dapat diterima tanpa kartu", () => {
    const ada = (j: JenisPerkaraBukti, k: string) => KARTU_KB.some((x) => x.perkara.includes(j) && (x.keadaan as string[]).includes(k));
    for (const k of ["kabul", "kabul-verstek", "tolak", "tolak-verstek"]) {
      expect(ada("HB", k), `HB ${k}`).toBe(true);
      expect(ada("KW", k), `KW ${k}`).toBe(true);
    }
    for (const k of ["kabul", "tolak"]) expect(ada("PAW", k), `PAW ${k}`).toBe(true);
    for (const k of ["tdt", "kabul-verstek", "tolak-verstek"]) expect(ada("PAW", k), `PAW ${k}`).toBe(false);
    for (const j of ["HB", "KW", "PAW"] as const) expect(ada(j, "tdt"), `${j} tdt`).toBe(false);
    expect(KARTU_KB.every((x) => x.perkara.length === 1)).toBe(true);
  });
  it("tiap blangko Kabul dan Tolak yang punya alinea bukti terjangkau kartu di keadaannya", () => {
    for (const b of bahan.blangko) {
      const perkara = Object.entries(FOLDER_PERKARA).find(([, f]) => f === b.folder)?.[0];
      const k = keadaanBerkas(b.berkas);
      if (!perkara || !k || k === "tdt") continue;
      const terjangkau = KARTU_KB.filter((x) => x.perkara[0] === perkara && (x.keadaan as string[]).includes(k));
      expect(terjangkau.length, `${b.berkas}`).toBeGreaterThan(0);
    }
  });
  it("setiap alinea umum menunjuk alinea nyata yang bunyinya sama, di folder dan keadaan yang benar", () => {
    const umum = KARTU_KB.filter((k) => !k.rumus && k.asal.length);
    expect(umum.length).toBe(12);
    for (const k of umum) {
      for (const a of k.asal) {
        const blangko = bahan.blangko.find((b) => b.folder === a.folder && b.berkas === a.berkas);
        expect(blangko, `${k.id}: blangko ${a.berkas}`).toBeTruthy();
        const alinea = blangko!.alineaBukti[a.alinea];
        expect(alinea, `${k.id}: alinea ${a.alinea}`).toBeTruthy();
        expect(bentukKartu(k.bunyi, k.sisi), `${k.id} <- ${a.berkas}`).toBe(bentukBlangko(alinea));
        expect(a.folder, k.id).toBe(FOLDER_PERKARA[k.perkara[0]]);
        const keadaan = keadaanBerkas(a.berkas);
        if (keadaan) expect(k.keadaan as string[], `${k.id} <- ${a.berkas}`).toContain(keadaan);
      }
    }
  });
  it("kalimat kelompok sama dengan cabang rumus variabel dan rumus Tergugat identik dengan rumus Penggugat", () => {
    const kelompok = KARTU_KB.filter((k) => k.rumus);
    expect(kelompok).toHaveLength(19);
    const pasangan: Record<string, string> = { "4807": "4808", "4829": "4830" };
    for (const k of kelompok) {
      const { no, cabang } = k.rumus!;
      const dariRumus = cabangRumus(no, cabang);
      expect(dariRumus, `${k.id}: cabang ${cabang} di ${no}`).toBeTruthy();
      expect(cabangRumus(pasangan[no], cabang), `${k.id}: rumus lawan`).toBe(dariRumus);
      expect(bentukKartu(k.bunyi, k.sisi), k.id).toBe(bentukBlangko(`Menimbang, bahwa bukti § ${dariRumus}`));
      expect(k.sisi).toBe("PT");
      for (const a of k.asal) {
        const blangko = bahan.blangko.find((b) => b.folder === a.folder && b.berkas === a.berkas);
        const alinea = blangko!.alineaBukti[a.alinea];
        expect(alinea.includes(`#${no}#`) || alinea.includes(`#${pasangan[no]}#`), `${k.id} <- ${a.berkas}`).toBe(true);
      }
    }
    // tiap cabang rumus tercakup kartu: HB 9 cabang, KW 10 cabang
    expect(kelompok.filter((k) => k.perkara[0] === "HB")).toHaveLength(9);
    expect(kelompok.filter((k) => k.perkara[0] === "KW")).toHaveLength(10);
    for (const [no, banyak] of [["4807", 9], ["4829", 10]] as const) {
      const rumus = bahan.variabel[no].rumus;
      const cabang = new Set([...rumus.slice(0, rumus.indexOf("FROM (SELECT COUNT")).matchAll(/IF\(p\.(k\d+) IS NULL/g)].map((m) => m[1]));
      expect(cabang.size, no).toBe(banyak);
    }
  });
  it("kartu tanpa rujukan hanya yang disahkan keputusan pemilik (bukti tanpa asli)", () => {
    const tanpa = KARTU_KB.filter((x) => x.asal.length === 0);
    expect(tanpa.length).toBe(5);
    for (const k of tanpa) {
      expect(k.sumberKhusus).toContain("Keputusan pemilik");
      expect(k.bunyi).toBe("- Bahwa bukti {kode} adalah fotokopi yang tidak dapat dicocokkan dengan aslinya;");
    }
  });
  it("kategori: kelompok bernama jenis surat pokok; foto dan lain-lain pelengkap", () => {
    for (const k of KARTU_KB) {
      const pelengkap = Array.isArray(k.kunci) && k.kunci.every((j) => ["kb-foto", "kb-lain", "elektronik"].includes(j));
      expect(k.kategori, k.id).toBe(pelengkap ? "pelengkap" : "pokok");
    }
  });
  it("tidak ada kata Aleta, penanda mentah, atau data perkara pada bunyi dan bahan", () => {
    for (const k of KARTU_KB) {
      expect(k.bunyi).not.toMatch(/aleta/i);
      expect(k.bunyi).not.toMatch(/#\d+#/);
      expect(k.bunyi).not.toMatch(/\b\d{16}\b/);
      expect(`${k.catatan ?? ""}${k.sumberKhusus ?? ""}${k.periksa ?? ""}`).not.toMatch(/aleta/i);
    }
    expect(mentahBahan.match(/\b\d{16}\b/g)).toBeNull();
    expect(mentahBahan.match(/aleta/gi)).toBeNull();
    expect(mentahBahan.match(/password|api[_-]?key|sk-ant|BEGIN (?:RSA|PRIVATE)/gi)).toBeNull();
    expect(mentahBahan.match(/(?:rekening|norek)[^"]{0,20}\d{8,}/gi)).toBeNull();
    expect(mentahBahan.match(/[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g)).toBeNull();
  });
  it("kunci tiap kartu ada dalam golongan yang dikenal penyusun", () => {
    const dikenal = new Set(["kb-ktp", "kb-kk", "kb-nikah", "kb-cerai", "kb-tanah", "kb-kendaraan", "kb-uang", "kb-foto", "kb-lain", "kb-mati", "kb-lahir", "kb-silsilah", "kb-surat", "elektronik"]);
    for (const k of KARTU_KB) for (const j of k.kunci as string[]) expect(dikenal.has(j), `${k.id}: ${j}`).toBe(true);
  });
});

/* ---------------------------------------------------------------- layar */
const BAHAN_LAYAR = (jumlah: number) => ({
  P: Array.from({ length: jumlah }, () => ({ nama: "Pemohon Uji", nikSamar: "", nikSidik: "" })),
  T: [],
  nikah: null,
  dokumen: [],
});
const naskahBukti = (nm: string, an: string) => [{ teks: `${kalimatBaris(bar(nm, { an }), "P", 0)}` }];

describe("layar Pertimbangan dari alat bukti, perkara kebendaan", () => {
  afterEach(() => vi.unstubAllGlobals());
  const pasang = (jenisPerkara: string, nm = "Kartu Tanda Penduduk", jumlah = 2) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ ok: true, data: BAHAN_LAYAR(jumlah) }) })));
    return render(createElement(BuktiAletaAbt, { alinea: naskahBukti(nm, "Fulan"), perkaraId: "1", nomor: "1/Pdt.G/2026/PA.Uji", jenisPerkara }));
  };
  const pilih = (nilai: string) => fireEvent.change(screen.getByLabelText(/Keadaan putusan/), { target: { value: nilai } });
  it("harta bersama: saklar verstek, tanpa jumlah Pemohon dan tanpa isian; Lawan membantah tidak ada", async () => {
    pasang("Harta Bersama");
    await screen.findByText("Keadaan putusan");
    expect(screen.getByText("Lawan tidak hadir (verstek)")).toBeTruthy();
    expect(screen.queryByText("Jumlah Pemohon")).toBeNull();
    expect(screen.queryByText(/Nama pewaris/)).toBeNull();
    expect(screen.queryByText(/Alamat Pemohon/)).toBeNull();
    pilih("Dikabulkan");
    await waitFor(() => expect(screen.getAllByText(/yang membuktikan identitas dan tempat tinggal para pihak/).length).toBeGreaterThan(0));
    expect(screen.queryByText("Lawan membantah")).toBeNull();
    expect(screen.getAllByText(/Rumus variabel 4807 \(cabang k1\)/).length).toBeGreaterThan(0);
  });
  it("cerai gugat tetap punya Lawan membantah saat dikabulkan", async () => {
    pasang("Cerai Gugat");
    await screen.findByText("Keadaan putusan");
    pilih("Dikabulkan");
    await waitFor(() => expect(screen.getByText("Lawan membantah")).toBeTruthy());
  });
  it("kewarisan: isian nama pewaris menulis anak kalimat surat kematian", async () => {
    pasang("Kewarisan", "Kutipan Akta Kematian");
    await screen.findByText("Keadaan putusan");
    expect(screen.getByText(/Nama pewaris/)).toBeTruthy();
    pilih("Dikabulkan");
    await waitFor(() => expect(screen.getAllByText(/akta atau surat keterangan kematian/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/meninggalnya/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Nama pewaris/), { target: { value: "Pewaris Uji bin Fulan" } });
    await waitFor(() => expect(screen.getAllByText(/meninggalnya Almarhum Pewaris Uji bin Fulan sebagai pewaris/).length).toBeGreaterThan(0));
  });
  it("penetapan ahli waris: jumlah Pemohon dibaca dari SIPP, tanpa saklar verstek", async () => {
    pasang("Penetapan Ahli Waris", "Kartu Tanda Penduduk", 1);
    await screen.findByText("Keadaan putusan");
    await waitFor(() => expect(screen.getByText("Terbaca 1 Pemohon dari SIPP.")).toBeTruthy());
    expect(screen.queryByText("Lawan tidak hadir (verstek)")).toBeNull();
    expect(screen.queryByText(/Nama pewaris/)).toBeNull();
    pilih("Dikabulkan");
    await waitFor(() => expect(screen.getAllByText(/dalil permohonannya Pemohon telah mengajukan bukti-bukti tertulis/).length).toBeGreaterThan(0));
  });
  it("Dikabulkan sebagian ada di pilihan dan menyusun paragraf", async () => {
    pasang("Harta Bersama");
    await screen.findByText("Keadaan putusan");
    expect(screen.getByRole("option", { name: "Dikabulkan sebagian" })).toBeTruthy();
    pilih("Dikabulkan sebagian");
    await waitFor(() => expect(screen.getAllByText(/Terbaca: Dikabulkan sebagian, lawan hadir/).length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getAllByText(/yang membuktikan identitas dan tempat tinggal para pihak/).length).toBeGreaterThan(0));
  });
  it("wasiat, hibah, wakaf: kosong dengan keterangan", async () => {
    pasang("Wasiat");
    expect(await screen.findByText(/belum punya bunyi pertimbangan alat bukti di blangko/)).toBeTruthy();
    expect(screen.getByText(/harta bersama, kewarisan, dan penetapan ahli waris/)).toBeTruthy();
  });
});
