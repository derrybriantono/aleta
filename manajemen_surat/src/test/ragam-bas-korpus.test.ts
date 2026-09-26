// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BANK RAGAM BAS DARI KORPUS MANUSIA - DATANYA DAN AKIBATNYA
 * ============================================================================
 *
 * Data di aleta_bot/services/ragamBasBawaan.js ditambang dari 65.852 jawaban
 * saksi MANUSIA aps_badilag PA Donggala (skrip di D:/aleta-dev/kerja/
 * enam-butir/t2-ragam-bas-bot/). Yang dijaga di sini:
 *
 *   - tiap bentuk punya bukti >= 3 kemunculan di >= 3 perkara;
 *   - bentuk sekunci membawa slot, penanda, kata modal/negasi, dan kelas
 *     makna terlarang (sejak/sekitar, sering/pernah, melihat/mendengar/
 *     cerita) yang SAMA - yang berbeda hanya cara mengatakannya;
 *   - pembuka hanya yang dipakai manusia, sekitar 10%;
 *   - frasa setara alasan tanpa garis miring/kurung;
 *   - AKIBATNYA pada berita acara: pertanyaan pokok berbeda antar saksi,
 *     pertanyaan rumusan tetap seperti manusia menulisnya, berpembuka 7-13%.
 */

type Bentuk = { kunci: string; nilai: string; data: { asalKorpus: { kemunculan: number; perkara: number }; syarat?: unknown } };
type Data = {
  PEMBUKA: { nilai: string; bobot: number }[];
  RAGAM_KATA: { kata: string; ganti: string }[];
  BENTUK: Bentuk[];
  PROFIL: { kunci: string; data: { peluangRagam: number; rumusan: boolean } }[];
};
type Butir = { no: string; tanya: string; jawab: string; varian: { indeks: number; n: number; habis: boolean } };
type Hasil = { saksi: { ke: number; jawaban: Butir[] }[]; saksi1: { no: string; jawab: string }[]; saksi2: { no: string; jawab: string }[] };
type Layanan = { susunKeteranganSaksiSdg: (o: Record<string, unknown>) => Hasil };
type Pemilih = { kelompokTanya: (t: string) => { jenis: string; kelompok: string } };
type Baku = { KALIMAT: { frasaCiri: Record<string, { frasa: string; setara?: string[]; akibat?: boolean }> } };

const require_ = createRequire(import.meta.url);
const bot = (nama: string) => path.resolve(process.cwd(), "../aleta_bot/services", nama);
const data = require_(bot("ragamBasBawaan.js")) as Data;
const layanan = require_(bot("abtUsulanService.js")) as Layanan;
const pemilih = require_(bot("pemilihRagam.js")) as Pemilih;
const baku = require_(bot("abtKalimatBaku.js")) as Baku;

const kelompok = new Map<string, Bentuk[]>();
for (const b of data.BENTUK) kelompok.set(b.kunci, [...(kelompok.get(b.kunci) ?? []), b]);
const sidik = (t: string, pola: RegExp) => (t.toLowerCase().match(pola) ?? []).sort().join(",");

describe("bank BENTUK", () => {
  it("setiap bentuk punya bukti korpus >= 3 kemunculan di >= 3 perkara", () => {
    const tanpaBukti = data.BENTUK.filter((b) => !(b.data.asalKorpus.kemunculan >= 3 && b.data.asalKorpus.perkara >= 3));
    expect(tanpaBukti).toEqual([]);
    expect(data.BENTUK.length).toBeGreaterThanOrEqual(20);
  });

  it("tiap kelompok punya >= 2 bentuk yang semuanya berbeda", () => {
    for (const [k, isi] of kelompok) {
      expect(isi.length, k).toBeGreaterThanOrEqual(2);
      expect(new Set(isi.map((b) => b.nilai)).size, k).toBe(isi.length);
    }
  });

  it("bentuk sekunci: slot, penanda, modal/negasi, dan kelas makna terlarang SAMA", () => {
    const MODAL = /\b(tidak|tak|belum|bukan|tanpa|pernah|sering|selalu|kadang|jarang|mungkin|harus|wajib)\b/g;
    const KELAS = /\b(sejak|sekitar|sering|pernah|melihat|mendengar|cerita|diceritakan)\b/g;
    for (const [k, isi] of kelompok) {
      const [dasar] = isi;
      for (const b of isi) {
        expect(b.nilai.split("{slot}").length, `${k}: ${b.nilai}`).toBe(dasar.nilai.split("{slot}").length);
        expect(sidik(b.nilai, /#\d{4}#/g), `${k}: ${b.nilai}`).toBe(sidik(dasar.nilai, /#\d{4}#/g));
        expect(sidik(b.nilai, MODAL), `${k}: ${b.nilai}`).toBe(sidik(dasar.nilai, MODAL));
        expect(sidik(b.nilai, KELAS), `${k}: ${b.nilai}`).toBe(sidik(dasar.nilai, KELAS));
        // Penanda, bukan kata sebutan; tidak bergender tanpa syarat.
        expect(b.nilai, k).not.toMatch(/penggugat|tergugat|pemohon|termohon/i);
        expect((b.nilai.match(/#\d{4}#/g) ?? []).every((p) => p === "#0046#" || p === "#0047#"), k).toBe(true);
        // Bergender = menyebut SATU jenis ("sebagai suami"), bukan pasangan
        // "suami istri" yang netral. Yang bergender wajib bersyarat perkara.
        const suami = /\bsuami\b/.test(b.nilai);
        const istri = /\b(isteri|istri)\b/.test(b.nilai);
        if (suami !== istri) expect(b.data.syarat, `${k} bergender`).toBeDefined();
      }
    }
  });
});

describe("pembuka, ganti kata, frasa setara", () => {
  it("pembuka hanya yang dipakai manusia, total bobot sekitar 10%", () => {
    expect(data.PEMBUKA.map((p) => p.nilai)).toEqual(["Ya, ", "Setahu saya, ", "Sepengetahuan saya, ", "Yang saya ketahui, "]);
    const total = data.PEMBUKA.reduce((a, p) => a + p.bobot, 0);
    expect(total).toBeGreaterThan(8);
    expect(total).toBeLessThan(12);
  });

  it("pasangan ganti kata yang menabrak tidak ada lagi", () => {
    const kata = data.RAGAM_KATA.map((r) => r.kata);
    for (const k of ["pertengkaran", "berselisih", "rumah tangga", "keluarga", "meninggalkan", "tetangga", "tidak pernah", "kurang lebih", "sejak"]) {
      expect(kata, k).not.toContain(k);
    }
  });

  it("frasa yang dipakai saksi: setara dari korpus, tanpa garis miring/kurung, penanda {pelaku}/{lawan} saja", () => {
    let bersetara = 0;
    for (const [ciri, aturan] of Object.entries(baku.KALIMAT.frasaCiri)) {
      for (const s of aturan.setara ?? []) {
        expect(s, ciri).not.toMatch(/[()/]/);
        expect((s.match(/\{[^}]*\}/g) ?? []).every((p) => p === "{pelaku}" || p === "{lawan}"), ciri).toBe(true);
      }
      if ((aturan.setara ?? []).length) bersetara++;
      expect((aturan.setara ?? []).length, ciri).toBeLessThanOrEqual(3);
    }
    expect(bersetara).toBeGreaterThanOrEqual(8);
  });
});

/** Templat berbentuk 04 (sebutan saja). */
const TEMPLAT = [
  { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Ya, saya kenal dengan Penggugat dan Tergugat karena saya adalah tetangga Penggugat;" },
  { no: "2", tanya: "Dimana Penggugat dan Tergugat bertempat tinggal setelah menikah?", jawab: "Setelah menikah Penggugat dan Tergugat membina rumah tangga di rumah orang tua Penggugat;" },
  { no: "3", tanya: "Bagaimana kehidupan rumah tangga Penggugat dan Tergugat?", jawab: "Pada awalnya kehidupan rumah tangga Penggugat dan Tergugat rukun dan harmonis, namun sekarang ini rumah tangga mereka tidak harmonis lagi karena sering terjadi perselisihan dan pertengkaran yang terus menerus;" },
  { no: "4", tanya: "Apakah saksi tahu penyebab perselisihan dan pertengkaran Penggugat dan Tergugat?", jawab: "Ya, penyebabnya xxx;" },
  { no: "5", tanya: "Bagaimana saksi bisa mengetahui penyebab perselisihan dan pertengkaran tersebut?", jawab: "Saya mengetahui karena melihat sendiri;" },
  { no: "6", tanya: "Berapa kali saksi melihat dan mendengar Penggugat dan Tergugat bertengkar?", jawab: "Saya melihat dan mendengar Penggugat dan Tergugat bertengkar kurang lebih _ kali;" },
  { no: "7", tanya: "Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?", jawab: "Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Januari 2025;" },
  { no: "8", tanya: "Sudah berapa lama Penggugat dan Tergugat berpisah tempat tinggal?", jawab: "Penggugat dan Tergugat berpisah tempat tinggal sudah kurang lebih 1 tahun 8 bulan;" },
  { no: "9", tanya: "Apakah sejak ada masalah, Penggugat dan Tergugat pernah diupayakan untuk rukun kembali?", jawab: "Ya, pihak keluarga telah berusaha untuk mendamaikan Penggugat dan Tergugat, namun tidak berhasil;" },
  { no: "10", tanya: "Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?", jawab: "Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;" },
  { no: "11", tanya: "Apakah Tergugat masih memberikan nafkah kepada Penggugat?", jawab: "Tergugat sudah tidak pernah memberikan nafkah kepada Penggugat;" },
  { no: "12", tanya: "Apakah saudara mengetahui maksud Penggugat menghadap di persidangan ini?", jawab: "Penggugat menghadap di persidangan ini untuk mengajukan cerai terhadap suaminya sebagai Tergugat;" },
  { no: "13", tanya: "Apakah masih ada yang ingin saudara sampaikan?", jawab: "Sudah cukup;" },
];
const NOMOR = Array.from({ length: 300 }, (_, i) => `${i + 1}/Pdt.G/${2023 + (i % 3)}/PA.Dgl`);
const susun = (nomorPerkara: string, tambahan?: Record<string, unknown>) =>
  layanan.susunKeteranganSaksiSdg({ templat: TEMPLAT, alasan: ["tidak memberi nafkah", "judi"], pelaku: "Tergugat", lawan: "Penggugat", nomorPerkara, kodeKumpulan: "04", ...tambahan });
const jenis = (t: string) => pemilih.kelompokTanya(t).jenis;

describe("akibatnya pada berita acara (300 nomor perkara)", () => {
  const hasil = NOMOR.map((n) => susun(n));

  it("dua saksi, pilihan sama: jawaban pokok tidak pernah identik; rumusan identik >= 80%", () => {
    let pokok = 0;
    let pokokSama = 0;
    let rumusan = 0;
    let rumusanSama = 0;
    for (const h of hasil) {
      h.saksi1.forEach((b, i) => {
        const sama = b.jawab === h.saksi2[i].jawab;
        const j = jenis(TEMPLAT[i].tanya);
        if (j === "pokok") {
          pokok++;
          if (sama) pokokSama++;
        }
        if (j === "rumusan" && !/^Sudah cukup/.test(b.jawab)) {
          rumusan++;
          if (sama) rumusanSama++;
        }
      });
    }
    expect(pokok).toBe(300 * 9);
    expect(pokokSama).toBe(0);
    expect(rumusanSama / rumusan).toBeGreaterThanOrEqual(0.8);
  });

  // Ambang 7-13% berlaku atas 27 templat ABT sungguhan (terukur 7,9% atas 100
  // nomor x 27 templat, ukur-pembuka.cjs). Templat uji ini sepertiganya
  // pertanyaan rumusan yang TIDAK PERNAH berpembuka, jadi bagiannya lebih kecil:
  // yang dijaga di sini pita 5-13% dan larangan pada rumusan.
  it("berpembuka sekitar 10% dari jawaban yang boleh, dan tidak pernah pada pertanyaan rumusan", () => {
    let semua = 0;
    let berpembuka = 0;
    for (const h of hasil) {
      for (const s of h.saksi) {
        for (const b of s.jawaban) {
          semua++;
          const ada = /^(Ya|Setahu saya|Sepengetahuan saya|Yang saya ketahui), /.test(b.jawab);
          if (ada) berpembuka++;
          if (jenis(b.tanya) === "rumusan") expect(ada, b.jawab).toBe(false);
        }
      }
    }
    expect(berpembuka / semua).toBeGreaterThan(0.05);
    expect(berpembuka / semua).toBeLessThan(0.13);
  });

  it("antar perkara: jawaban pokok saksi 1 pada posisi yang sama tidak seragam; cetak ulang sama persis", () => {
    let n = 0;
    let sama = 0;
    for (let k = 1; k < hasil.length; k++) {
      hasil[k].saksi1.forEach((b, i) => {
        if (jenis(TEMPLAT[i].tanya) !== "pokok") return;
        n++;
        if (b.jawab === hasil[k - 1].saksi1[i].jawab) sama++;
      });
    }
    expect(sama / n).toBeLessThanOrEqual(0.3);
    expect(JSON.stringify(susun(NOMOR[7]))).toBe(JSON.stringify(hasil[7]));
  });

  it("empat saksi P + dua saksi T: tidak ada bentuk berulang bila bentuknya cukup, dan tanda habis jujur", () => {
    const saksi = [1, 2, 3, 4, 5, 6].map((ke) => ({ ke, pihak: ke <= 4 ? "P" : "T", modus: "sama" }));
    for (const nomorPerkara of NOMOR.slice(0, 60)) {
      const h = susun(nomorPerkara, { saksi });
      expect(h.saksi.map((s) => s.ke)).toEqual([1, 2, 3, 4, 5, 6]);
      h.saksi[0].jawaban.forEach((b, i) => {
        const v = h.saksi.map((s) => s.jawaban[i].varian);
        if (v[0].n <= 1) return;
        if (v[0].n >= 6) expect(new Set(v.map((x) => x.indeks)).size, b.tanya).toBe(6);
        for (const x of v) expect(x.habis, b.tanya).toBe(x.n < 6);
      });
    }
  });
});
