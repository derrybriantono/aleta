// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  PENANDA_SAKSI,
  bacaSaksiAbt,
  penandaDariAbt,
  pihakKumpulan,
} from "@/lib/keterangan-abt";
import { periksaKesiapan, saksiDituntut, type BahanPeriksa } from "@/lib/pemeriksaan-bas";
import { penandaDariLembar, saksiBerlembar, type Lembar } from "@/server/modules/aleta-ecourt/bas-lembar";

/**
 * ============================================================================
 * SAKSI KETIGA, KEEMPAT, DAN SAKSI TERGUGAT DI BLANGKO BAS
 * ============================================================================
 *
 * Nomor penanda dari abt_variabel APS Badilag dan blangko BAS nyata di
 * _blangko_abt (26 September 2026). Urutan penanda di bawah ini disalin dari
 * tiga blangko yang benar-benar ada:
 *
 *   [09] (E-Court) BAS 2 P Hadir & T Tidak Hadir - Putusan Verstek - (4 Saksi)
 *   22-a. BAS Lanjutan P & T Hadir ... bukti P & T - Tunda Putusan
 *   [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022
 *
 * Sebelum ini hanya saksi 1-2 Penggugat yang dipetakan: saksi ketiga dan
 * keempat tidak pernah terisi, dan lembar saksi Tergugat (kumpulan A2a)
 * mendarat di tempat saksi Penggugat dan menimpanya.
 */

const BLANGKO_4_SAKSI = [
  "1197", "1198", "1199", "1200", "1201", "1202", "7029", "5058",
  "1203", "1204", "1205", "1206", "1207", "1208", "7030", "5059",
  "6132", "6133", "6134", "6135", "6136", "6137", "7038", "6122",
  "6144", "6145", "6146", "6147", "6151", "6148", "7039", "6124",
];
const BLANGKO_P_DAN_T = ["1197", "5058", "1203", "5059", "6100", "6120", "6106", "6121"];
const BLANGKO_SAKSI_T = ["6100", "6101", "6102", "6103", "6104", "6105", "7031", "6120", "6106", "6107", "6108", "6109", "6110", "6111", "7032", "6121"];

function lembar(kodeKumpulan: string, namaKumpulan: string, saksiKe: number, nama: string, jawaban = "Kenal;"): Lembar {
  return {
    id: `${kodeKumpulan}-${saksiKe}`,
    perkaraId: "1",
    nomorPerkara: "101/Pdt.G/2026/PA.Dgl",
    kodeKumpulan,
    namaKumpulan,
    saksiKe,
    saksi: { nama, umur: "40", agama: "Islam", pendidikan: "SMA", pekerjaan: "Petani", alamat: "xxx" },
    tanggalSidang: "",
    keadaan: "draf",
    catatan: "",
    acc: "belum-selesai",
    diaccOleh: "",
    diaccAt: "",
    accDikembalikanAlasan: "",
    baris: [{ urutan: 1, pertanyaan: "Apakah saudara kenal?", jawaban }],
    diubahOleh: "uji",
    diubahAt: "",
  };
}

/** Mengisi blangko seperti blangko.isi: penanda yang punya nilai diganti, sisanya tetap. */
function isiBlangko(penanda: string[], nilai: Map<string, { nilai: string }>): string[] {
  return penanda.filter((noVar) => !nilai.has(noVar));
}

describe("tabel penanda saksi", () => {
  it("tiap nomor dipakai tepat satu saksi, dan saksi 3 P memegang 5060 DAN 6122", () => {
    const semua: string[] = [];
    for (const pihak of ["P", "T"] as const) {
      for (const p of Object.values(PENANDA_SAKSI[pihak])) {
        semua.push(p.nama, p.umur, p.agama, p.pendidikan, p.pekerjaan, p.alamat, p.sumpah, ...p.tanyaJawab);
      }
    }
    expect(new Set(semua).size).toBe(semua.length);
    expect(PENANDA_SAKSI.P[3].tanyaJawab).toEqual(["5060", "6122"]);
    expect(PENANDA_SAKSI.P[4].tanyaJawab).toEqual(["6124"]);
    expect(PENANDA_SAKSI.T[1].tanyaJawab).toEqual(["6120"]);
    expect(PENANDA_SAKSI.T[2].tanyaJawab).toEqual(["6121"]);
    expect(PENANDA_SAKSI.T[1].sumpah).toBe("7031");
    expect(PENANDA_SAKSI.T[2].sumpah).toBe("7032");
    // 12 Okt 2026 (paket abt-saksi-pertanyaan): lima saksi Penggugat dan empat saksi Tergugat - tidak lebih.
    expect(Object.keys(PENANDA_SAKSI.P)).toEqual(["1", "2", "3", "4", "5"]);
    expect(Object.keys(PENANDA_SAKSI.T)).toEqual(["1", "2", "3", "4"]);
  });

  it("pihak dibaca dari kumpulan: A2/A2a dan 'Saksi T' = Tergugat; Jawaban Lisan T bukan saksi Tergugat", () => {
    expect(pihakKumpulan("A2a", "Pertanyaan Saksi T CG")).toBe("T");
    expect(pihakKumpulan("A2", "")).toBe("T");
    expect(pihakKumpulan("X9", "Pertanyaan Saksi T lain")).toBe("T");
    expect(pihakKumpulan("A1a", "Pertanyaan Saksi P CG")).toBe("P");
    expect(pihakKumpulan("01", "Jawaban Lisan T")).toBe("P");
    expect(pihakKumpulan("A3a", "Pertanyaan Saksi P CG+IN")).toBe("P");
  });
});

describe("lembar ALETA mengisi blangko nyata", () => {
  it("blangko (4 Saksi): keempat saksi Penggugat terisi, tanpa satu penanda saksi tersisa", () => {
    const nilai = penandaDariLembar([1, 2, 3, 4].map((ke) => lembar("A1a", "Pertanyaan Saksi P CG", ke, `Saksi ${ke}`)));
    // Sumpah dihitung ABT dari agama saksi - bukan isian lembar.
    const sisa = isiBlangko(BLANGKO_4_SAKSI, nilai).filter((v) => !["7029", "7030", "7038", "7039"].includes(v));
    expect(sisa).toEqual([]);
    expect(nilai.get("6132")?.nilai).toBe("Saksi 3");
    expect(nilai.get("6144")?.nilai).toBe("Saksi 4");
    expect(nilai.get("6151")?.nilai).toBe("Petani");
    expect(nilai.get("6147")?.nilai).toBe("SMA");
    expect(nilai.get("6122")?.nilai).toContain("Kenal;");
    expect(nilai.get("5060")?.nilai).toContain("Kenal;");
  });

  it("blangko P & T: saksi Tergugat (A2a) mengisi 6100/6120, TIDAK menimpa saksi Penggugat", () => {
    const nilai = penandaDariLembar([
      lembar("A1a", "Pertanyaan Saksi P CG", 1, "Saksi P1", "Jawaban P1;"),
      lembar("A1a", "Pertanyaan Saksi P CG", 2, "Saksi P2", "Jawaban P2;"),
      lembar("A2a", "Pertanyaan Saksi T CG", 1, "Saksi T1", "Jawaban T1;"),
      lembar("A2a", "Pertanyaan Saksi T CG", 2, "Saksi T2", "Jawaban T2;"),
    ]);
    expect(isiBlangko(BLANGKO_P_DAN_T, nilai)).toEqual([]);
    expect(nilai.get("1197")?.nilai).toBe("Saksi P1");
    expect(nilai.get("5058")?.nilai).toContain("Jawaban P1;");
    expect(nilai.get("6100")?.nilai).toBe("Saksi T1");
    expect(nilai.get("6120")?.nilai).toContain("Jawaban T1;");
    expect(nilai.get("6106")?.nilai).toBe("Saksi T2");
    expect(nilai.get("6121")?.nilai).toContain("Jawaban T2;");
    expect(nilai.get("6120")?.asal).toContain("saksi Tergugat ke-1");
  });

  it("saksi Tergugat ketiga dan keempat punya tempat sendiri (8921/8941, paket 12 Okt); yang kelima tidak - tidak menumpang tempat siapa pun", () => {
    const t3 = penandaDariLembar([lembar("A2a", "Pertanyaan Saksi T CG", 3, "T3")]);
    expect(t3.get("6138")?.nilai).toBe("T3");
    expect(t3.get("8921")?.nilai).toContain("Kenal;");
    expect(t3.has("6122")).toBe(false); // 6122 menunjuk saksi 3 PENGGUGAT
    const t4 = penandaDariLembar([lembar("A2a", "Pertanyaan Saksi T CG", 4, "T4")]);
    expect(t4.get("8934")?.nilai).toBe("T4");
    expect(t4.get("8941")?.nilai).toContain("Kenal;");
    expect(penandaDariLembar([lembar("A2a", "Pertanyaan Saksi T CG", 5, "T5")]).size).toBe(0);
    expect(penandaDariLembar([lembar("A1a", "Pertanyaan Saksi P CG", 6, "P6")]).size).toBe(0);
  });

  it("lembar saksi Tergugat ke-1 tidak menyingkirkan rekaman ABT saksi Penggugat ke-1", () => {
    const kunci = saksiBerlembar([lembar("A2a", "Pertanyaan Saksi T CG", 1, "T1")]);
    expect([...kunci]).toEqual(["T1"]);
    const abt = bacaSaksiAbt({
      saksi: [{ saksiId: "11", saksiKe: 1, tanyaJawab: [{ urutan: 1, pertanyaan: "Kenal?", jawaban: "Kenal" }] }],
    });
    expect(penandaDariAbt(abt, kunci).get("5058")?.nilai).toContain("Kenal");
    expect(penandaDariAbt(abt, new Set(["P1"])).size).toBe(0);
  });
});

describe("rekaman ABT saksi ketiga dan saksi Tergugat", () => {
  const tj = [{ urutan: 1, pertanyaan: "Kenal?", jawaban: "Kenal" }];

  it("tanpa pihak dari jembatan: saksi urutan 3+ TIDAK diletakkan (sepertiganya saksi Tergugat)", () => {
    const abt = bacaSaksiAbt({
      saksi: [1, 2, 3, 4].map((ke) => ({ saksiId: String(ke), saksiKe: ke, tanyaJawab: tj })),
    });
    expect([...penandaDariAbt(abt, new Set()).keys()].sort()).toEqual(["5058", "5059"]);
  });

  it("dengan pihak yang dinyatakan: saksi 3 P ke 5060+6122, saksi Tergugat ke 6120/6121", () => {
    const abt = bacaSaksiAbt({
      saksi: [
        { saksiId: "1", saksiKe: 1, pihak: "P", saksiKePihak: 1, tanyaJawab: tj },
        { saksiId: "2", saksiKe: 2, pihak: "P", saksiKePihak: 2, tanyaJawab: tj },
        { saksiId: "3", saksiKe: 3, pihak: "P", saksiKePihak: 3, tanyaJawab: tj },
        { saksiId: "4", saksiKe: 4, pihak: "T", saksiKePihak: 1, tanyaJawab: tj },
        { saksiId: "5", saksiKe: 5, pihak: "T", saksiKePihak: 2, tanyaJawab: tj },
      ],
    });
    const peta = penandaDariAbt(abt, new Set());
    expect([...peta.keys()].sort()).toEqual(["5058", "5059", "5060", "6120", "6121", "6122"]);
    expect(peta.get("6120")?.asal).toContain("saksi Tergugat ke-1");
  });

  it("pihak yang tidak sah dari jembatan diabaikan, bukan ditebak", () => {
    const abt = bacaSaksiAbt({ saksi: [{ saksiId: "9", saksiKe: 3, pihak: "X", saksiKePihak: 1, tanyaJawab: tj }] });
    expect(abt[0].pihak).toBeUndefined();
    expect(penandaDariAbt(abt, new Set()).size).toBe(0);
  });
});

describe("pemeriksaan kesiapan mengenal saksi Tergugat dan saksi ketiga", () => {
  function bahan(sebagian: Partial<BahanPeriksa>): BahanPeriksa {
    return {
      tersisa: [],
      namaPenanda: {},
      penandaBlangko: [],
      lembar: [],
      namaBlangko: "BAS.rtf",
      nomorSidang: 2,
      sidangTercatat: true,
      kehadiranTercatat: true,
      blangkoMenanyakanKehadiran: false,
      selisih: [],
      ...sebagian,
    };
  }

  it("saksi yang dituntut: P terjauh + T terjauh", () => {
    expect(saksiDituntut("22-a BAS.rtf", BLANGKO_P_DAN_T)).toBe(4);
    expect(saksiDituntut("[02] BAS 7.rtf", BLANGKO_SAKSI_T)).toBe(2);
    expect(saksiDituntut("[09] (4 Saksi).rtf", BLANGKO_4_SAKSI)).toBe(4);
    expect(saksiDituntut("IN.rtf", ["6122"])).toBe(3);
    expect(saksiDituntut("BAS biasa.rtf", ["5058", "5059"])).toBe(2);
  });

  it("sumpah saksi Tergugat (7031) dengan agama kosong disebut untuk saksi Tergugat, bukan saksi Penggugat", () => {
    const temuan = periksaKesiapan(
      bahan({
        penandaBlangko: BLANGKO_SAKSI_T,
        lembar: [{ saksiKe: 1, pihak: "T", saksiNama: "T1", saksiUmur: "40", saksiAgama: "", jumlahPertanyaan: 1, jumlahTerjawab: 1 }],
      })
    );
    const sumpah = temuan.filter((t) => t.hal.includes("Lafal sumpah"));
    expect(sumpah.map((t) => t.hal)).toEqual(["Lafal sumpah saksi Tergugat ke-1 belum dapat ditentukan"]);
  });

  it("sumpah saksi Penggugat ke-1 tidak dituntut oleh blangko yang hanya memuat sumpah saksi Tergugat", () => {
    const temuan = periksaKesiapan(
      bahan({
        penandaBlangko: BLANGKO_SAKSI_T,
        lembar: [{ saksiKe: 1, saksiNama: "P1", saksiUmur: "40", saksiAgama: "", jumlahPertanyaan: 1, jumlahTerjawab: 1 }],
      })
    );
    expect(temuan.some((t) => t.hal.includes("Lafal sumpah"))).toBe(false);
  });
});
