// @vitest-environment node
import { describe, expect, it } from "vitest";

import { abtKeTeks, bacaSaksiAbt, penandaDariAbt } from "@/lib/keterangan-abt";

/**
 * Keterangan saksi yang sudah terekam di ABT.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Contoh di bawah SALINAN dari abt_keterangan_saksi perkara 521/Pdt.G/2026 di
 * server - termasuk saksi_id yang bernomor global (17346, 17347), bukan 1 dan
 * 2. Itulah jebakannya: menganggap saksi_id sebagai urutan saksi akan menaruh
 * keterangan saksi pertama di tempat yang tidak ada.
 *
 * Yang paling berbahaya: rekaman ABT menimpa lembar yang baru saja diketik
 * panitera. Keterangan hari ini lenyap dari naskah tanpa ia mengetahuinya, dan
 * yang tercetak adalah keadaan sebelum ALETA disentuh.
 */

const PEMERIKSAAN = {
  ada: true,
  sumber: "aps_badilag.abt_keterangan_saksi",
  jumlahSaksi: 2,
  jumlahTanyaJawab: 4,
  saksi: [
    {
      saksiId: "17346",
      saksiKe: 1,
      sidangId: "19916",
      tanyaJawab: [
        {
          urutan: 2,
          penanya: "1",
          pertanyaan: "Apakah saudara mengetahui maksud Penggugat menghadiri persidangan ini?",
          jawaban: "Penggugat menghadiri persidangan ini untuk mengajukan gugatan cerai;",
        },
        {
          urutan: 1,
          penanya: "1",
          pertanyaan: "Apakah saudara mengenal Penggugat?",
          jawaban: "Saya mengenal Penggugat karena saya adalah tante Penggugat;",
        },
      ],
    },
    {
      saksiId: "17347",
      saksiKe: 2,
      sidangId: "19916",
      tanyaJawab: [
        {
          urutan: 1,
          penanya: "1",
          pertanyaan: "Apakah saudara mengenal Penggugat?",
          jawaban: "Saya tetangga Penggugat;",
        },
      ],
    },
  ],
};

describe("membaca rekaman ABT", () => {
  it("tanya-jawab diurutkan menurut urutan pertanyaan, bukan urutan baris", () => {
    const saksi = bacaSaksiAbt(PEMERIKSAAN);
    expect(saksi[0].tanyaJawab.map((item) => item.urutan)).toEqual([1, 2]);
    expect(saksi[0].tanyaJawab[0].pertanyaan).toContain("mengenal Penggugat");
  });

  it("nomor urut saksi dipakai apa adanya, bukan saksi_id", () => {
    // saksi_id di ABT bernomor global. Memakainya sebagai urutan berarti
    // keterangan saksi pertama menuju tempat yang tidak ada di blangko.
    const saksi = bacaSaksiAbt(PEMERIKSAAN);
    expect(saksi.map((item) => item.saksiKe)).toEqual([1, 2]);
    expect(saksi[0].saksiId).toBe("17346");
  });

  it("jembatan lama tanpa saksiKe tetap terbaca menurut posisinya", () => {
    const lama = { saksi: [{ saksiId: "9", tanyaJawab: [] }, { saksiId: "10", tanyaJawab: [] }] };
    expect(bacaSaksiAbt(lama).map((item) => item.saksiKe)).toEqual([1, 2]);
  });

  it("baris yang kosong sama sekali dibuang", () => {
    const kosong = { saksi: [{ saksiKe: 1, tanyaJawab: [{ urutan: 1, pertanyaan: "", jawaban: "" }] }] };
    expect(bacaSaksiAbt(kosong)[0].tanyaJawab).toHaveLength(0);
  });

  it("bahan yang bukan pemeriksaan tidak menjatuhkan apa pun", () => {
    expect(bacaSaksiAbt(null)).toEqual([]);
    expect(bacaSaksiAbt({})).toEqual([]);
    expect(bacaSaksiAbt({ saksi: "bukan larik" })).toEqual([]);
  });
});

describe("rekaman ABT menjadi penanda", () => {
  it("saksi pertama dan kedua mengisi penanda yang berbeda", () => {
    const peta = penandaDariAbt(bacaSaksiAbt(PEMERIKSAAN), new Set());
    expect(peta.get("5058")?.nilai).toContain("tante Penggugat");
    expect(peta.get("5059")?.nilai).toContain("tetangga Penggugat");
  });

  it("pertanyaan DAN jawabannya dibawa bersama, tidak dicocokkan terpisah", () => {
    // Karena keduanya dibawa bersama, tidak ada jawaban yang dapat mendarat di
    // bawah pertanyaan yang keliru.
    const nilai = penandaDariAbt(bacaSaksiAbt(PEMERIKSAAN), new Set()).get("5058")?.nilai ?? "";
    expect(nilai).toContain("- Tanya : Apakah saudara mengenal Penggugat?");
    expect(nilai).toContain("- Jawab : Saya mengenal Penggugat karena saya adalah tante Penggugat;");
  });

  it("saksi yang sudah punya lembar ALETA DILEWATI sepenuhnya", () => {
    // Lembar ALETA selalu menang. Menimpanya dengan rekaman lama berarti
    // keterangan yang baru saja diketik panitera lenyap dari naskah.
    const peta = penandaDariAbt(bacaSaksiAbt(PEMERIKSAAN), new Set([1]));
    expect(peta.has("5058")).toBe(false);
    expect(peta.get("5059")?.nilai).toContain("tetangga Penggugat");
  });

  it("saksi ketiga tidak menumpang tempat milik saksi lain", () => {
    const bertiga = { saksi: [{ saksiKe: 3, tanyaJawab: [{ urutan: 1, pertanyaan: "T", jawaban: "J" }] }] };
    expect(penandaDariAbt(bacaSaksiAbt(bertiga), new Set()).size).toBe(0);
  });

  it("saksi tanpa satu pun jawaban tidak mengisi penandanya", () => {
    const tanpaJawab = { saksi: [{ saksiKe: 1, tanyaJawab: [{ urutan: 1, pertanyaan: "T", jawaban: "" }] }] };
    expect(penandaDariAbt(bacaSaksiAbt(tanpaJawab), new Set()).size).toBe(0);
  });

  it("asal penanda menyebut ABT, bukan ALETA", () => {
    // Yang membaca naskah berhak tahu keterangan itu berasal dari rekaman lama,
    // bukan dari yang diketik hari ini.
    const asal = penandaDariAbt(bacaSaksiAbt(PEMERIKSAAN), new Set()).get("5058")?.asal ?? "";
    expect(asal).toContain("APS Badilag");
    expect(asal).toContain("saksi ke-1");
  });
});

describe("bentuk teks untuk naskah", () => {
  it("sama dengan bentuk yang dipakai lembar ALETA", () => {
    // Dua bentuk yang berbeda berarti BAS yang sebagian keterangannya dari ABT
    // dan sebagian dari ALETA akan terbaca sebagai dua gaya penulisan pada satu
    // naskah yang sama.
    const teks = abtKeTeks([{ urutan: 1, penanya: "1", pertanyaan: "Tanya satu", jawaban: "Jawab satu" }]);
    expect(teks).toBe("- Tanya : Tanya satu\n- Jawab : Jawab satu");
  });
});
